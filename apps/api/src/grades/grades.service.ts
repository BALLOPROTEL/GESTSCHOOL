import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AcademicStage,
  AcademicPlacementStatus,
  AcademicTrack,
  Prisma,
  ReportCardMode,
  type AcademicPeriod,
  type Classroom,
  type GradeEntry,
  type ReportCard,
  type Student,
  type Subject
} from "@prisma/client";

import { AcademicStructureService } from "../academic-structure/academic-structure.service";
import { buildSimplePdf, toPdfDataUrl } from "../common/pdf.util";
import { PrismaService } from "../database/prisma.service";
import { ReferenceService } from "../reference/reference.service";
import {
  BulkCreateGradesDto,
  CreateGradeDto,
  GenerateReportCardDto
} from "./dto/grades.dto";

type GradeView = {
  id: string;
  tenantId: string;
  studentId: string;
  studentName?: string;
  classId: string;
  placementId?: string;
  track: AcademicTrack;
  subjectId: string;
  subjectLabel?: string;
  academicPeriodId: string;
  assessmentLabel: string;
  assessmentType: string;
  score: number;
  scoreMax: number;
  absent: boolean;
  comment?: string;
};

type SubjectAverageView = {
  subjectId: string;
  subjectLabel: string;
  average: number;
};

type StudentClassSummaryView = {
  studentId: string;
  placementId?: string;
  track: AcademicTrack;
  matricule: string;
  studentName: string;
  averageGeneral: number;
  classRank: number;
  noteCount: number;
  appreciation: string;
  subjectAverages: SubjectAverageView[];
};

type ClassSummaryView = {
  classId: string;
  academicPeriodId: string;
  track: AcademicTrack;
  classAverage: number;
  students: StudentClassSummaryView[];
};

type ReportCardView = {
  id: string;
  tenantId: string;
  studentId: string;
  classId: string;
  placementId?: string;
  secondaryPlacementId?: string;
  track: AcademicTrack;
  mode: ReportCardMode;
  academicPeriodId: string;
  averageGeneral: number;
  classRank?: number;
  appreciation?: string;
  publishedAt?: string;
  pdfDataUrl?: string;
  studentName?: string;
  classLabel?: string;
  periodLabel?: string;
  secondaryClassLabel?: string;
  sections?: ReportCardSectionView[];
};

type ReportCardSectionView = {
  placementId?: string;
  track: AcademicTrack;
  classId: string;
  classLabel?: string;
  levelCode?: string;
  levelLabel?: string;
  academicStage: AcademicStage;
  averageGeneral: number;
  classRank?: number;
  appreciation: string;
  subjectAverages: SubjectAverageView[];
};

type ReportCardDraft = {
  studentId: string;
  classId: string;
  placementId?: string;
  secondaryPlacementId?: string;
  track: AcademicTrack;
  mode: ReportCardMode;
  academicPeriodId: string;
  averageGeneral: number;
  classRank?: number;
  appreciation?: string;
  pdfDataUrl?: string;
  summaryData: {
    mode: ReportCardMode;
    sections: ReportCardSectionView[];
  };
};

@Injectable()
export class GradesService {
  constructor(
    private readonly academicStructureService: AcademicStructureService,
    private readonly prisma: PrismaService,
    private readonly referenceService: ReferenceService
  ) {}

  async listGrades(
    tenantId: string,
    filters: {
      classId?: string;
      subjectId?: string;
      academicPeriodId?: string;
      studentId?: string;
      track?: AcademicTrack;
    }
  ): Promise<GradeView[]> {
    const rows = await this.prisma.gradeEntry.findMany({
      where: {
        tenantId,
        classId: filters.classId,
        subjectId: filters.subjectId,
        academicPeriodId: filters.academicPeriodId,
        studentId: filters.studentId,
        track: filters.track
      },
      include: {
        student: true,
        subject: true
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return rows.map((row) => this.gradeView(row));
  }

  async upsertGrade(
    tenantId: string,
    payload: CreateGradeDto
  ): Promise<GradeView> {
    const { classroom, placement } = await this.validateGradeContext(tenantId, {
      classId: payload.classId,
      subjectId: payload.subjectId,
      academicPeriodId: payload.academicPeriodId,
      studentId: payload.studentId,
      track: payload.track,
      placementId: payload.placementId
    });

    const scoreMax = payload.scoreMax ?? 20;
    if (payload.score > scoreMax) {
      throw new ConflictException("score cannot exceed scoreMax.");
    }

    const saved = await this.prisma.gradeEntry.upsert({
      where: {
        tenantId_studentId_classId_subjectId_academicPeriodId_assessmentLabel: {
          tenantId,
          studentId: payload.studentId,
          classId: payload.classId,
          subjectId: payload.subjectId,
          academicPeriodId: payload.academicPeriodId,
          assessmentLabel: payload.assessmentLabel.trim()
        }
      },
      create: {
        tenantId,
        studentId: payload.studentId,
        classId: payload.classId,
        placementId: placement.id,
        track: placement.track,
        subjectId: payload.subjectId,
        academicPeriodId: payload.academicPeriodId,
        assessmentLabel: payload.assessmentLabel.trim(),
        assessmentType: payload.assessmentType || "DEVOIR",
        score: payload.score,
        scoreMax,
        absent: payload.absent ?? false,
        comment: payload.comment,
        updatedAt: new Date()
      },
      update: {
        assessmentType: payload.assessmentType || "DEVOIR",
        score: payload.score,
        scoreMax,
        absent: payload.absent ?? false,
        placementId: placement.id,
        track: placement.track,
        comment: payload.comment,
        updatedAt: new Date()
      },
      include: {
        student: true,
        subject: true
      }
    });

    await this.syncReportCardsForClassPeriod(tenantId, classroom.id, payload.academicPeriodId);

    return this.gradeView(saved);
  }

  async bulkUpsertGrades(
    tenantId: string,
    payload: BulkCreateGradesDto
  ): Promise<{ upsertedCount: number }> {
    if (payload.grades.length === 0) {
      return { upsertedCount: 0 };
    }

    const { classroom } = await this.validateGradeContext(tenantId, {
      classId: payload.classId,
      subjectId: payload.subjectId,
      academicPeriodId: payload.academicPeriodId,
      studentId: payload.grades[0].studentId,
      track: payload.track
    });

    const placementByStudentId = new Map<
      string,
      { id: string; track: AcademicTrack }
    >();
    for (const grade of payload.grades) {
      const context = await this.validateGradeContext(tenantId, {
        classId: payload.classId,
        subjectId: payload.subjectId,
        academicPeriodId: payload.academicPeriodId,
        studentId: grade.studentId,
        track: payload.track
      });
      placementByStudentId.set(grade.studentId, {
        id: context.placement.id,
        track: context.placement.track
      });
    }

    const scoreMax = payload.scoreMax ?? 20;

    await this.prisma.$transaction(
      payload.grades.map((item) => {
        if (item.score > scoreMax) {
          throw new ConflictException("score cannot exceed scoreMax.");
        }

        return this.prisma.gradeEntry.upsert({
          where: {
            tenantId_studentId_classId_subjectId_academicPeriodId_assessmentLabel: {
              tenantId,
              studentId: item.studentId,
              classId: payload.classId,
              subjectId: payload.subjectId,
              academicPeriodId: payload.academicPeriodId,
              assessmentLabel: payload.assessmentLabel.trim()
            }
          },
          create: {
            tenantId,
            studentId: item.studentId,
            classId: payload.classId,
            placementId: placementByStudentId.get(item.studentId)?.id,
            track: placementByStudentId.get(item.studentId)?.track || classroom.track,
            subjectId: payload.subjectId,
            academicPeriodId: payload.academicPeriodId,
            assessmentLabel: payload.assessmentLabel.trim(),
            assessmentType: payload.assessmentType || "DEVOIR",
            score: item.score,
            scoreMax,
            absent: item.absent ?? false,
            comment: item.comment,
            updatedAt: new Date()
          },
          update: {
            assessmentType: payload.assessmentType || "DEVOIR",
            score: item.score,
            scoreMax,
            absent: item.absent ?? false,
            placementId: placementByStudentId.get(item.studentId)?.id,
            track: placementByStudentId.get(item.studentId)?.track || classroom.track,
            comment: item.comment,
            updatedAt: new Date()
          }
        });
      })
    );

    await this.syncReportCardsForClassPeriod(tenantId, classroom.id, payload.academicPeriodId);

    return { upsertedCount: payload.grades.length };
  }

  async classSummary(
    tenantId: string,
    classId: string,
    academicPeriodId: string
  ): Promise<ClassSummaryView> {
    return this.buildClassSummary(tenantId, classId, academicPeriodId);
  }

  async generateReportCard(
    tenantId: string,
    payload: GenerateReportCardDto
  ): Promise<ReportCardView> {
    const classroom = await this.referenceService.requireClassroom(tenantId, payload.classId);
    const period = await this.referenceService.requireAcademicPeriod(
      tenantId,
      payload.academicPeriodId
    );

    if (classroom.schoolYearId !== period.schoolYearId) {
      throw new ConflictException("Classroom and period must belong to the same school year.");
    }

    const cards = await this.syncStudentReportCardsForPeriod(
      tenantId,
      payload.studentId,
      classroom.schoolYearId,
      payload.academicPeriodId,
      payload.publish ?? true
    );

    const preferred =
      cards.find(
        (card) =>
          card.classId === payload.classId ||
          card.sections?.some((section) => section.classId === payload.classId) ||
          (payload.placementId &&
            (card.placementId === payload.placementId ||
              card.secondaryPlacementId === payload.placementId)) ||
          (payload.track &&
            card.sections?.some((section) => section.track === payload.track))
      ) || cards[0];

    if (!preferred) {
      throw new NotFoundException("Student has no report card context for this period.");
    }

    return preferred;
  }

  async listReportCards(
    tenantId: string,
    filters: {
      classId?: string;
      academicPeriodId?: string;
      studentId?: string;
      track?: AcademicTrack;
    }
  ): Promise<ReportCardView[]> {
    const rows = await this.prisma.reportCard.findMany({
      where: {
        tenantId,
        academicPeriodId: filters.academicPeriodId,
        studentId: filters.studentId
      },
      include: {
        student: true,
        classroom: true,
        academicPeriod: true,
        placement: {
          include: {
            classroom: true,
            level: true
          }
        },
        secondaryPlacement: {
          include: {
            classroom: true,
            level: true
          }
        }
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return rows
      .map((row) => this.reportCardView(row))
      .filter((row) => {
        if (
          filters.classId &&
          row.classId !== filters.classId &&
          !row.sections?.some((section) => section.classId === filters.classId)
        ) {
          return false;
        }
        if (
          filters.track &&
          !row.sections?.some((section) => section.track === filters.track)
        ) {
          return false;
        }
        return true;
      });
  }

  async getReportCardPdf(
    tenantId: string,
    reportCardId: string
  ): Promise<{ reportCardId: string; pdfDataUrl: string }> {
    const row = await this.prisma.reportCard.findFirst({
      where: {
        id: reportCardId,
        tenantId
      }
    });

    if (!row) {
      throw new NotFoundException("Report card not found.");
    }

    if (!row.pdfDataUrl) {
      throw new NotFoundException("Report card PDF not generated yet.");
    }

    return {
      reportCardId: row.id,
      pdfDataUrl: row.pdfDataUrl
    };
  }

  private async buildClassSummary(
    tenantId: string,
    classId: string,
    academicPeriodId: string
  ): Promise<ClassSummaryView> {
    const classroom = await this.referenceService.requireClassroom(tenantId, classId);
    const period = await this.referenceService.requireAcademicPeriod(tenantId, academicPeriodId);

    if (classroom.schoolYearId !== period.schoolYearId) {
      throw new ConflictException("Classroom and period must belong to the same school year.");
    }

    const [placements, gradeRows] = await Promise.all([
      this.prisma.studentTrackPlacement.findMany({
        where: {
          tenantId,
          classId,
          schoolYearId: classroom.schoolYearId,
          track: classroom.track,
          placementStatus: {
            in: [AcademicPlacementStatus.ACTIVE, AcademicPlacementStatus.COMPLETED]
          }
        },
        include: {
          student: true
        },
        orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }]
      }),
      this.prisma.gradeEntry.findMany({
        where: {
          tenantId,
          classId,
          academicPeriodId,
          track: classroom.track
        },
        include: {
          subject: true
        }
      })
    ]);

    const gradeByStudent = new Map<
      string,
      Map<string, { subjectLabel: string; sum: number; count: number }>
    >();

    for (const grade of gradeRows) {
      const normalized = grade.absent
        ? 0
        : (this.decimalToNumber(grade.score) / this.decimalToNumber(grade.scoreMax)) * 20;

      const studentSubjects =
        gradeByStudent.get(grade.studentId) ||
        new Map<string, { subjectLabel: string; sum: number; count: number }>();

      const current = studentSubjects.get(grade.subjectId) || {
        subjectLabel: grade.subject.label,
        sum: 0,
        count: 0
      };

      current.sum += normalized;
      current.count += 1;
      studentSubjects.set(grade.subjectId, current);
      gradeByStudent.set(grade.studentId, studentSubjects);
    }

    const summaryRows: Array<
      Omit<StudentClassSummaryView, "classRank"> & { classRank?: number }
    > = placements.map((placement) => {
      const studentMap = gradeByStudent.get(placement.studentId) || new Map();
      const subjectAverages = Array.from(studentMap.entries()).map(([subjectId, value]) => ({
        subjectId,
        subjectLabel: value.subjectLabel,
        average: this.round3(value.sum / value.count)
      }));

      const averageGeneral =
        subjectAverages.length > 0
          ? this.round3(
              subjectAverages.reduce((sum, value) => sum + value.average, 0) /
                subjectAverages.length
            )
          : 0;

      const studentName = `${placement.student.firstName} ${placement.student.lastName}`.trim();

      return {
        studentId: placement.studentId,
        placementId: placement.id,
        track: placement.track,
        matricule: placement.student.matricule,
        studentName,
        averageGeneral,
        noteCount: subjectAverages.length,
        appreciation: this.resolveAppreciation(averageGeneral),
        subjectAverages
      };
    });

    const sorted = [...summaryRows].sort((left, right) => {
      if (right.averageGeneral !== left.averageGeneral) {
        return right.averageGeneral - left.averageGeneral;
      }
      return left.studentName.localeCompare(right.studentName);
    });

    let previousAverage: number | null = null;
    let previousRank = 0;

    for (let index = 0; index < sorted.length; index += 1) {
      const row = sorted[index];
      const rank =
        previousAverage !== null && Math.abs(previousAverage - row.averageGeneral) < 0.0001
          ? previousRank
          : index + 1;

      row.classRank = rank;
      previousAverage = row.averageGeneral;
      previousRank = rank;
    }

    const ranks = new Map(sorted.map((row) => [row.studentId, row.classRank || 0]));

    const students = summaryRows.map((row) => ({
      ...row,
      classRank: ranks.get(row.studentId) || 0
    }));

    const notedStudents = students.filter((student) => student.noteCount > 0);
    const classAverage =
      notedStudents.length > 0
        ? this.round3(
            notedStudents.reduce((sum, student) => sum + student.averageGeneral, 0) /
              notedStudents.length
          )
        : 0;

    return {
      classId,
      academicPeriodId,
      track: classroom.track,
      classAverage,
      students
    };
  }

  private async validateGradeContext(
    tenantId: string,
    context: {
      classId: string;
      subjectId: string;
      academicPeriodId: string;
      studentId: string;
      track?: AcademicTrack;
      placementId?: string;
    }
  ): Promise<{
    classroom: Classroom;
    subject: Subject;
    period: AcademicPeriod;
    student: Student;
    placement: {
      id: string;
      track: AcademicTrack;
      classId: string | null;
      schoolYearId: string;
      studentId: string;
    };
  }> {
    const [classroom, subject, period] = await Promise.all([
      this.referenceService.requireClassroom(tenantId, context.classId),
      this.referenceService.requireSubject(tenantId, context.subjectId),
      this.referenceService.requireAcademicPeriod(tenantId, context.academicPeriodId)
    ]);

    if (classroom.schoolYearId !== period.schoolYearId) {
      throw new ConflictException("Classroom and period must belong to the same school year.");
    }

    const student = await this.prisma.student.findFirst({
      where: {
        id: context.studentId,
        tenantId,
        deletedAt: null
      }
    });

    if (!student) {
      throw new NotFoundException("Student not found.");
    }

    const placement = context.placementId
      ? await this.prisma.studentTrackPlacement.findFirst({
          where: {
            id: context.placementId,
            tenantId,
            studentId: student.id
          },
          select: {
            id: true,
            track: true,
            classId: true,
            schoolYearId: true,
            studentId: true
          }
        })
      : await this.academicStructureService.requirePlacementForStudentClass(
          tenantId,
          student.id,
          classroom.id,
          classroom.schoolYearId,
          context.track
        );

    if (!placement) {
      throw new ConflictException("Student has no academic placement in this class for the school year.");
    }

    if (placement.classId !== classroom.id || placement.schoolYearId !== classroom.schoolYearId) {
      throw new ConflictException("Placement must belong to the same class and school year.");
    }

    return {
      classroom,
      subject,
      period,
      student,
      placement
    };
  }

  private async syncReportCardsForClassPeriod(
    tenantId: string,
    classId: string,
    academicPeriodId: string
  ): Promise<void> {
    const classroom = await this.referenceService.requireClassroom(tenantId, classId);
    const impactedPlacements = await this.prisma.studentTrackPlacement.findMany({
      where: {
        tenantId,
        classId,
        schoolYearId: classroom.schoolYearId,
        placementStatus: {
          in: [AcademicPlacementStatus.ACTIVE, AcademicPlacementStatus.COMPLETED]
        }
      },
      select: {
        studentId: true
      },
      distinct: ["studentId"]
    });

    for (const placement of impactedPlacements) {
      await this.syncStudentReportCardsForPeriod(
        tenantId,
        placement.studentId,
        classroom.schoolYearId,
        academicPeriodId,
        false
      );
    }
  }

  private async syncStudentReportCardsForPeriod(
    tenantId: string,
    studentId: string,
    schoolYearId: string,
    academicPeriodId: string,
    publish: boolean
  ): Promise<ReportCardView[]> {
    const drafts = await this.buildStudentReportCardDrafts(
      tenantId,
      studentId,
      schoolYearId,
      academicPeriodId
    );

    const existingRows = await this.prisma.reportCard.findMany({
      where: {
        tenantId,
        studentId,
        academicPeriodId
      }
    });

    const expectedClassIds = new Set(drafts.map((draft) => draft.classId));
    const obsoleteIds = existingRows
      .filter((row) => !expectedClassIds.has(row.classId))
      .map((row) => row.id);

    const savedRows = await this.prisma.$transaction(async (transaction) => {
      const saved = await Promise.all(
        drafts.map((draft) =>
          transaction.reportCard.upsert({
            where: {
              tenantId_studentId_classId_academicPeriodId: {
                tenantId,
                studentId,
                classId: draft.classId,
                academicPeriodId
              }
            },
            create: {
              tenantId,
              studentId,
              classId: draft.classId,
              placementId: draft.placementId,
              secondaryPlacementId: draft.secondaryPlacementId,
              track: draft.track,
              mode: draft.mode,
              academicPeriodId,
              averageGeneral: draft.averageGeneral,
              classRank: draft.classRank ?? null,
              appreciation: draft.appreciation,
              summaryData: draft.summaryData as Prisma.InputJsonValue,
              pdfDataUrl: draft.pdfDataUrl,
              publishedAt: publish ? new Date() : null,
              updatedAt: new Date()
            },
            update: {
              placementId: draft.placementId,
              secondaryPlacementId: draft.secondaryPlacementId,
              track: draft.track,
              mode: draft.mode,
              averageGeneral: draft.averageGeneral,
              classRank: draft.classRank ?? null,
              appreciation: draft.appreciation,
              summaryData: draft.summaryData as Prisma.InputJsonValue,
              pdfDataUrl: draft.pdfDataUrl,
              publishedAt: publish ? new Date() : undefined,
              updatedAt: new Date()
            },
            include: {
              student: true,
              classroom: true,
              academicPeriod: true,
              placement: {
                include: {
                  classroom: true,
                  level: true
                }
              },
              secondaryPlacement: {
                include: {
                  classroom: true,
                  level: true
                }
              }
            }
          })
        )
      );

      if (obsoleteIds.length > 0) {
        await transaction.reportCard.deleteMany({
          where: {
            id: { in: obsoleteIds }
          }
        });
      }

      return saved;
    });

    return savedRows.map((row) => this.reportCardView(row));
  }

  private async buildStudentReportCardDrafts(
    tenantId: string,
    studentId: string,
    schoolYearId: string,
    academicPeriodId: string
  ): Promise<ReportCardDraft[]> {
    const strategy = await this.academicStructureService.resolveReportCardStrategy(
      tenantId,
      studentId,
      schoolYearId
    );

    if (strategy.placements.length === 0) {
      throw new NotFoundException("Student has no active academic placement for this school year.");
    }

    const reportablePlacements = strategy.placements.filter((placement) =>
      Boolean(placement.classId)
    );
    if (reportablePlacements.length === 0) {
      throw new ConflictException("No classroom-bound placement is available for report card generation.");
    }

    if (strategy.mode === ReportCardMode.PRIMARY_COMBINED) {
      const sections = await Promise.all(
        reportablePlacements.map((placement) =>
          this.buildPlacementReportSection(tenantId, placement, academicPeriodId)
        )
      );

      const leadSection = sections[0];
      const secondarySection = sections[1];
      const averageGeneral =
        sections.reduce((total, section) => total + section.averageGeneral, 0) /
        sections.length;
      const appreciation = this.resolveAppreciation(averageGeneral);
      const pdf = buildSimplePdf([
        "GestSchool Primary Report Card",
        `Student: ${leadSection.studentName}`,
        `Period: ${leadSection.periodLabel}`,
        "Combined primary bulletin across active tracks",
        ...sections.flatMap((section) => [
          `${section.track} - ${section.classLabel || section.levelLabel || section.classId}`,
          `Average: ${section.averageGeneral.toFixed(2)}/20`,
          `Rank: ${section.classRank ?? "-"}`,
          `Appreciation: ${section.appreciation}`,
          ...section.subjectAverages.map(
            (subject) => `${subject.subjectLabel}: ${subject.average.toFixed(2)}/20`
          )
        ])
      ]);

      return [
        {
          studentId,
          classId: leadSection.classId,
          placementId: leadSection.placementId,
          secondaryPlacementId: secondarySection?.placementId,
          track: leadSection.track,
          mode: ReportCardMode.PRIMARY_COMBINED,
          academicPeriodId,
          averageGeneral,
          classRank: undefined,
          appreciation,
          pdfDataUrl: toPdfDataUrl(pdf),
          summaryData: {
            mode: ReportCardMode.PRIMARY_COMBINED,
            sections: sections.map((section) => this.toReportCardSectionPayload(section))
          }
        }
      ];
    }

    const drafts = await Promise.all(
      reportablePlacements.map(async (placement) => {
        const section = await this.buildPlacementReportSection(
          tenantId,
          placement,
          academicPeriodId
        );
        const pdf = buildSimplePdf([
          "GestSchool Report Card",
          `Class: ${section.classLabel || section.classId}`,
          `Period: ${section.periodLabel}`,
          `Student: ${section.studentName}`,
          `Track: ${section.track}`,
          `Average: ${section.averageGeneral.toFixed(2)}/20`,
          `Rank: ${section.classRank ?? "-"}`,
          `Appreciation: ${section.appreciation}`,
          ...section.subjectAverages.map(
            (subject) => `${subject.subjectLabel}: ${subject.average.toFixed(2)}/20`
          )
        ]);

        return {
          studentId,
          classId: section.classId,
          placementId: section.placementId,
          track: section.track,
          mode: ReportCardMode.TRACK_SINGLE,
          academicPeriodId,
          averageGeneral: section.averageGeneral,
          classRank: section.classRank,
          appreciation: section.appreciation,
          pdfDataUrl: toPdfDataUrl(pdf),
          summaryData: {
            mode: ReportCardMode.TRACK_SINGLE,
            sections: [this.toReportCardSectionPayload(section)]
          }
        } satisfies ReportCardDraft;
      })
    );

    return drafts;
  }

  private async buildPlacementReportSection(
    tenantId: string,
    placement: {
      id: string;
      track: AcademicTrack;
      classId?: string;
      classLabel?: string;
      levelCode?: string;
      levelLabel?: string;
      academicStage?: AcademicStage;
      studentId: string;
    },
    academicPeriodId: string
  ): Promise<
    ReportCardSectionView & {
      studentName: string;
      periodLabel: string;
    }
  > {
    if (!placement.classId) {
      throw new ConflictException("Report card generation requires a classroom placement.");
    }

    const summary = await this.buildClassSummary(
      tenantId,
      placement.classId,
      academicPeriodId
    );
    const target =
      summary.students.find((item) => item.placementId === placement.id) ||
      summary.students.find((item) => item.studentId === placement.studentId);

    if (!target) {
      throw new NotFoundException("Student has no track placement in this class.");
    }

    const period = await this.referenceService.requireAcademicPeriod(
      tenantId,
      academicPeriodId
    );

    return {
      placementId: target.placementId,
      track: target.track,
      classId: summary.classId,
      classLabel: placement.classLabel,
      levelCode: placement.levelCode,
      levelLabel: placement.levelLabel,
      academicStage: placement.academicStage || AcademicStage.SECONDARY,
      averageGeneral: target.averageGeneral,
      classRank: target.classRank,
      appreciation: target.appreciation,
      subjectAverages: target.subjectAverages,
      studentName: target.studentName,
      periodLabel: period.label
    };
  }

  private toReportCardSectionPayload(
    section: ReportCardSectionView
  ): ReportCardSectionView {
    return {
      placementId: section.placementId,
      track: section.track,
      classId: section.classId,
      classLabel: section.classLabel,
      levelCode: section.levelCode,
      levelLabel: section.levelLabel,
      academicStage: section.academicStage,
      averageGeneral: section.averageGeneral,
      classRank: section.classRank,
      appreciation: section.appreciation,
      subjectAverages: section.subjectAverages.map((subject) => ({
        subjectId: subject.subjectId,
        subjectLabel: subject.subjectLabel,
        average: subject.average
      }))
    };
  }

  private gradeView(
    row: GradeEntry & {
      student?: { firstName: string; lastName: string } | null;
      subject?: { label: string } | null;
    }
  ): GradeView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      studentId: row.studentId,
      placementId: row.placementId || undefined,
      track: row.track,
      studentName: row.student
        ? `${row.student.firstName} ${row.student.lastName}`.trim()
        : undefined,
      classId: row.classId,
      subjectId: row.subjectId,
      subjectLabel: row.subject?.label,
      academicPeriodId: row.academicPeriodId,
      assessmentLabel: row.assessmentLabel,
      assessmentType: row.assessmentType,
      score: this.decimalToNumber(row.score),
      scoreMax: this.decimalToNumber(row.scoreMax),
      absent: row.absent,
      comment: row.comment || undefined
    };
  }

  private reportCardView(
    row: ReportCard & {
      student?: { firstName: string; lastName: string } | null;
      classroom?: { label: string } | null;
      academicPeriod?: { label: string } | null;
      placement?: {
        track: AcademicTrack;
        classId: string | null;
        classroom?: { label: string } | null;
        level?: { code: string; label: string } | null;
      } | null;
      secondaryPlacement?: {
        track: AcademicTrack;
        classId: string | null;
        classroom?: { label: string } | null;
        level?: { code: string; label: string } | null;
      } | null;
    }
  ): ReportCardView {
    const summary =
      row.summaryData && typeof row.summaryData === "object" && !Array.isArray(row.summaryData)
        ? (row.summaryData as { sections?: ReportCardSectionView[] })
        : undefined;
    const sections =
      summary?.sections?.map((section) => ({
        placementId: section.placementId,
        track: section.track,
        classId: section.classId,
        classLabel: section.classLabel,
        levelCode: section.levelCode,
        levelLabel: section.levelLabel,
        academicStage: section.academicStage,
        averageGeneral: section.averageGeneral,
        classRank: section.classRank,
        appreciation: section.appreciation,
        subjectAverages: section.subjectAverages || []
      })) ||
      [
        {
          placementId: row.placementId || undefined,
          track: row.track,
          classId: row.classId,
          classLabel: row.classroom?.label || row.placement?.classroom?.label || undefined,
          levelCode: row.placement?.level?.code,
          levelLabel: row.placement?.level?.label,
          academicStage: AcademicStage.SECONDARY,
          averageGeneral: this.decimalToNumber(row.averageGeneral),
          classRank: row.classRank === null ? undefined : row.classRank,
          appreciation: row.appreciation || this.resolveAppreciation(this.decimalToNumber(row.averageGeneral)),
          subjectAverages: []
        }
      ];

    return {
      id: row.id,
      tenantId: row.tenantId,
      studentId: row.studentId,
      classId: row.classId,
      placementId: row.placementId || undefined,
      secondaryPlacementId: row.secondaryPlacementId || undefined,
      track: row.track,
      mode: row.mode,
      academicPeriodId: row.academicPeriodId,
      averageGeneral: this.decimalToNumber(row.averageGeneral),
      classRank: row.classRank === null ? undefined : row.classRank,
      appreciation: row.appreciation || undefined,
      publishedAt: row.publishedAt?.toISOString(),
      pdfDataUrl: row.pdfDataUrl || undefined,
      studentName: row.student
        ? `${row.student.firstName} ${row.student.lastName}`.trim()
        : undefined,
      classLabel: row.classroom?.label,
      periodLabel: row.academicPeriod?.label,
      secondaryClassLabel:
        row.secondaryPlacement?.classroom?.label || undefined,
      sections
    };
  }

  private resolveAppreciation(average: number): string {
    if (average >= 16) {
      return "EXCELLENT";
    }
    if (average >= 14) {
      return "TRES BIEN";
    }
    if (average >= 12) {
      return "BIEN";
    }
    if (average >= 10) {
      return "PASSABLE";
    }
    if (average >= 8) {
      return "FAIBLE";
    }
    return "MEDIOCRE";
  }

  private decimalToNumber(value: Prisma.Decimal | number | null): number {
    if (value === null) {
      return 0;
    }

    if (typeof value === "number") {
      return value;
    }

    return Number(value.toString());
  }

  private round3(value: number): number {
    return Math.round(value * 1000) / 1000;
  }
}
