import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  Prisma,
  type AcademicPeriod,
  type Classroom,
  type GradeEntry,
  type ReportCard,
  type Student,
  type Subject
} from "@prisma/client";

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
  classAverage: number;
  students: StudentClassSummaryView[];
};

type ReportCardView = {
  id: string;
  tenantId: string;
  studentId: string;
  classId: string;
  academicPeriodId: string;
  averageGeneral: number;
  classRank?: number;
  appreciation?: string;
  publishedAt?: string;
  pdfDataUrl?: string;
  studentName?: string;
  classLabel?: string;
  periodLabel?: string;
};

@Injectable()
export class GradesService {
  constructor(
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
    }
  ): Promise<GradeView[]> {
    const rows = await this.prisma.gradeEntry.findMany({
      where: {
        tenantId,
        classId: filters.classId,
        subjectId: filters.subjectId,
        academicPeriodId: filters.academicPeriodId,
        studentId: filters.studentId
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
    const { classroom } = await this.validateGradeContext(tenantId, {
      classId: payload.classId,
      subjectId: payload.subjectId,
      academicPeriodId: payload.academicPeriodId,
      studentId: payload.studentId
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
      studentId: payload.grades[0].studentId
    });

    for (const grade of payload.grades) {
      await this.validateGradeContext(tenantId, {
        classId: payload.classId,
        subjectId: payload.subjectId,
        academicPeriodId: payload.academicPeriodId,
        studentId: grade.studentId
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
    const summary = await this.buildClassSummary(
      tenantId,
      payload.classId,
      payload.academicPeriodId
    );

    const target = summary.students.find((item) => item.studentId === payload.studentId);
    if (!target) {
      throw new NotFoundException("Student has no enrollment in this class.");
    }

    const classroom = await this.referenceService.requireClassroom(tenantId, payload.classId);
    const period = await this.referenceService.requireAcademicPeriod(
      tenantId,
      payload.academicPeriodId
    );

    const pdf = buildSimplePdf([
      "GestSchool Report Card",
      `Class: ${classroom.label}`,
      `Period: ${period.label}`,
      `Student: ${target.studentName}`,
      `Average: ${target.averageGeneral.toFixed(2)}/20`,
      `Rank: ${target.classRank}`,
      `Appreciation: ${target.appreciation}`,
      ...target.subjectAverages.map(
        (subject) => `${subject.subjectLabel}: ${subject.average.toFixed(2)}/20`
      )
    ]);

    const saved = await this.prisma.reportCard.upsert({
      where: {
        tenantId_studentId_classId_academicPeriodId: {
          tenantId,
          studentId: payload.studentId,
          classId: payload.classId,
          academicPeriodId: payload.academicPeriodId
        }
      },
      create: {
        tenantId,
        studentId: payload.studentId,
        classId: payload.classId,
        academicPeriodId: payload.academicPeriodId,
        averageGeneral: target.averageGeneral,
        classRank: target.classRank,
        appreciation: target.appreciation,
        pdfDataUrl: toPdfDataUrl(pdf),
        publishedAt: payload.publish ?? true ? new Date() : null,
        updatedAt: new Date()
      },
      update: {
        averageGeneral: target.averageGeneral,
        classRank: target.classRank,
        appreciation: target.appreciation,
        pdfDataUrl: toPdfDataUrl(pdf),
        publishedAt: payload.publish ?? true ? new Date() : undefined,
        updatedAt: new Date()
      },
      include: {
        student: true,
        classroom: true,
        academicPeriod: true
      }
    });

    return this.reportCardView(saved);
  }

  async listReportCards(
    tenantId: string,
    filters: { classId?: string; academicPeriodId?: string; studentId?: string }
  ): Promise<ReportCardView[]> {
    const rows = await this.prisma.reportCard.findMany({
      where: {
        tenantId,
        classId: filters.classId,
        academicPeriodId: filters.academicPeriodId,
        studentId: filters.studentId
      },
      include: {
        student: true,
        classroom: true,
        academicPeriod: true
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return rows.map((row) => this.reportCardView(row));
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

    const [enrollments, gradeRows] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: {
          tenantId,
          classId,
          schoolYearId: classroom.schoolYearId
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
          academicPeriodId
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
    > = enrollments.map((enrollment) => {
      const studentMap = gradeByStudent.get(enrollment.studentId) || new Map();
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

      const studentName = `${enrollment.student.firstName} ${enrollment.student.lastName}`.trim();

      return {
        studentId: enrollment.studentId,
        matricule: enrollment.student.matricule,
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
    }
  ): Promise<{ classroom: Classroom; subject: Subject; period: AcademicPeriod; student: Student }> {
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

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        tenantId,
        classId: classroom.id,
        studentId: student.id,
        schoolYearId: classroom.schoolYearId
      }
    });

    if (!enrollment) {
      throw new ConflictException("Student is not enrolled in this class for the school year.");
    }

    return {
      classroom,
      subject,
      period,
      student
    };
  }

  private async syncReportCardsForClassPeriod(
    tenantId: string,
    classId: string,
    academicPeriodId: string
  ): Promise<void> {
    const summary = await this.buildClassSummary(tenantId, classId, academicPeriodId);

    await this.prisma.$transaction(
      summary.students.map((student) =>
        this.prisma.reportCard.upsert({
          where: {
            tenantId_studentId_classId_academicPeriodId: {
              tenantId,
              studentId: student.studentId,
              classId,
              academicPeriodId
            }
          },
          create: {
            tenantId,
            studentId: student.studentId,
            classId,
            academicPeriodId,
            averageGeneral: student.averageGeneral,
            classRank: student.classRank,
            appreciation: student.appreciation,
            updatedAt: new Date()
          },
          update: {
            averageGeneral: student.averageGeneral,
            classRank: student.classRank,
            appreciation: student.appreciation,
            updatedAt: new Date()
          }
        })
      )
    );
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
    }
  ): ReportCardView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      studentId: row.studentId,
      classId: row.classId,
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
      periodLabel: row.academicPeriod?.label
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
