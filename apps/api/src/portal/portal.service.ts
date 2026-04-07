import {
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import {
  AcademicPlacementStatus,
  AcademicStage,
  Prisma,
  ReportCardMode
} from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import { CreateGradeDto } from "../grades/dto/grades.dto";
import { GradesService } from "../grades/grades.service";
import { BulkAttendanceDto, CreateNotificationDto } from "../school-life/dto/school-life.dto";
import { SchoolLifeService } from "../school-life/school-life.service";

@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gradesService: GradesService,
    private readonly schoolLifeService: SchoolLifeService
  ) {}

  async getTeacherOverview(tenantId: string, teacherUserId: string) {
    const classIds = await this.getTeacherClassIds(tenantId, teacherUserId);
    if (classIds.length === 0) {
      return {
        classesCount: 0,
        studentsCount: 0,
        gradesCount: 0,
        pendingJustifications: 0,
        timetableSlotsCount: 0,
        notificationsCount: 0
      };
    }

    const [placementRows, gradesCount, pendingJustifications, timetableSlotsCount, notificationsCount] =
      await Promise.all([
        this.prisma.studentTrackPlacement.findMany({
          where: {
            tenantId,
            classId: { in: classIds },
            placementStatus: {
              in: [AcademicPlacementStatus.ACTIVE, AcademicPlacementStatus.COMPLETED]
            }
          },
          select: { studentId: true },
          distinct: ["studentId"]
        }),
        this.prisma.gradeEntry.count({ where: { tenantId, classId: { in: classIds } } }),
        this.prisma.attendance.count({
          where: { tenantId, classId: { in: classIds }, justificationStatus: "PENDING" }
        }),
        this.prisma.timetableSlot.count({ where: { tenantId, classId: { in: classIds } } }),
        this.prisma.notification.count({
          where: {
            tenantId,
            OR: [
              { audienceRole: "ENSEIGNANT" },
              {
                student: {
                  trackPlacements: {
                    some: {
                      tenantId,
                      classId: { in: classIds },
                      placementStatus: {
                        in: [AcademicPlacementStatus.ACTIVE, AcademicPlacementStatus.COMPLETED]
                      }
                    }
                  }
                }
              }
            ]
          }
        })
      ]);

    return {
      classesCount: classIds.length,
      studentsCount: placementRows.length,
      gradesCount,
      pendingJustifications,
      timetableSlotsCount,
      notificationsCount
    };
  }

  async listTeacherClasses(tenantId: string, teacherUserId: string) {
    const rows = await this.prisma.teacherClassAssignment.findMany({
      where: { tenantId, userId: teacherUserId },
      include: { classroom: true, schoolYear: true, subject: true },
      orderBy: [{ schoolYear: { code: "desc" } }, { classroom: { label: "asc" } }]
    });

    return rows.map((row) => ({
      assignmentId: row.id,
      classId: row.classId,
      classLabel: row.classroom.label,
      schoolYearId: row.schoolYearId,
      schoolYearCode: row.schoolYear.code,
      track: row.classroom.track,
      subjectId: row.subjectId || undefined,
      subjectLabel: row.subject?.label
    }));
  }

  async listTeacherStudents(tenantId: string, teacherUserId: string, classId?: string) {
    const classIds = this.resolveTeacherScopedClassIds(
      await this.getTeacherClassIds(tenantId, teacherUserId),
      classId
    );
    if (classIds.length === 0) return [];

    const rows = await this.prisma.studentTrackPlacement.findMany({
      where: {
        tenantId,
        classId: { in: classIds },
        placementStatus: {
          in: [AcademicPlacementStatus.ACTIVE, AcademicPlacementStatus.COMPLETED]
        }
      },
      include: { student: true, classroom: true, schoolYear: true },
      orderBy: [{ classroom: { label: "asc" } }, { student: { lastName: "asc" } }]
    });

    return rows.map((row) => ({
      placementId: row.id,
      enrollmentId: row.legacyEnrollmentId || row.id,
      studentId: row.studentId,
      matricule: row.student.matricule,
      studentName: `${row.student.firstName} ${row.student.lastName}`.trim(),
      classId: row.classId!,
      classLabel: row.classroom?.label || "-",
      schoolYearId: row.schoolYearId,
      schoolYearCode: row.schoolYear.code,
      track: row.track,
      placementStatus: row.placementStatus,
      isPrimary: row.isPrimary
    }));
  }

  async listTeacherGrades(
    tenantId: string,
    teacherUserId: string,
    filters: { classId?: string; subjectId?: string; academicPeriodId?: string; studentId?: string }
  ) {
    const classIds = this.resolveTeacherScopedClassIds(
      await this.getTeacherClassIds(tenantId, teacherUserId),
      filters.classId
    );
    if (classIds.length === 0) return [];

    const rows = await this.prisma.gradeEntry.findMany({
      where: {
        tenantId,
        classId: { in: classIds },
        subjectId: filters.subjectId,
        academicPeriodId: filters.academicPeriodId,
        studentId: filters.studentId
      },
      include: { student: true, subject: true },
      orderBy: [{ updatedAt: "desc" }]
    });

    return rows.map((row) => ({
      id: row.id,
      placementId: row.placementId || undefined,
      track: row.track,
      studentId: row.studentId,
      studentName: `${row.student.firstName} ${row.student.lastName}`.trim(),
      classId: row.classId,
      subjectId: row.subjectId,
      subjectLabel: row.subject.label,
      academicPeriodId: row.academicPeriodId,
      assessmentLabel: row.assessmentLabel,
      assessmentType: row.assessmentType,
      score: this.decimalToNumber(row.score),
      scoreMax: this.decimalToNumber(row.scoreMax),
      absent: row.absent,
      comment: row.comment || undefined
    }));
  }

  async upsertTeacherGrade(tenantId: string, teacherUserId: string, payload: CreateGradeDto) {
    await this.assertTeacherCanAccessClass(tenantId, teacherUserId, payload.classId);
    await this.assertTeacherCanAccessSubject(tenantId, teacherUserId, payload.classId, payload.subjectId);
    return this.gradesService.upsertGrade(tenantId, payload);
  }

  async bulkUpsertTeacherAttendance(
    tenantId: string,
    teacherUserId: string,
    payload: BulkAttendanceDto
  ) {
    await this.assertTeacherCanAccessClass(tenantId, teacherUserId, payload.classId);
    return this.schoolLifeService.upsertAttendanceBulk(tenantId, payload);
  }

  async listTeacherTimetable(
    tenantId: string,
    teacherUserId: string,
    filters: { classId?: string; schoolYearId?: string; dayOfWeek?: number }
  ) {
    const classIds = this.resolveTeacherScopedClassIds(
      await this.getTeacherClassIds(tenantId, teacherUserId),
      filters.classId
    );
    if (classIds.length === 0) return [];

    const rows = await this.prisma.timetableSlot.findMany({
      where: {
        tenantId,
        classId: { in: classIds },
        schoolYearId: filters.schoolYearId,
        dayOfWeek: filters.dayOfWeek
      },
      include: { classroom: true, schoolYear: true, subject: true },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }]
    });

    return rows.map((row) => ({
      id: row.id,
      classId: row.classId,
      classLabel: row.classroom.label,
      schoolYearId: row.schoolYearId,
      schoolYearCode: row.schoolYear.code,
      track: row.track,
      rotationGroup: row.rotationGroup || undefined,
      subjectId: row.subjectId,
      subjectLabel: row.subject.label,
      dayOfWeek: row.dayOfWeek,
      startTime: row.startTime,
      endTime: row.endTime,
      room: row.room || undefined,
      teacherName: row.teacherName || undefined
    }));
  }

  async listTeacherNotifications(tenantId: string, teacherUserId: string, classId?: string) {
    const classIds = this.resolveTeacherScopedClassIds(
      await this.getTeacherClassIds(tenantId, teacherUserId),
      classId
    );
    const studentRows =
      classIds.length === 0
        ? []
        : await this.prisma.studentTrackPlacement.findMany({
            where: {
              tenantId,
              classId: { in: classIds },
              placementStatus: {
                in: [AcademicPlacementStatus.ACTIVE, AcademicPlacementStatus.COMPLETED]
              }
            },
            select: { studentId: true }
          });
    const studentIds = [...new Set(studentRows.map((row) => row.studentId))];

    const rows = await this.prisma.notification.findMany({
      where: {
        tenantId,
        OR: [
          { audienceRole: "ENSEIGNANT" },
          ...(studentIds.length > 0 ? [{ studentId: { in: studentIds } }] : [])
        ]
      },
      include: { student: true },
      orderBy: [{ createdAt: "desc" }],
      take: 100
    });

    return rows.map((row) => this.notificationView(row));
  }

  async createTeacherNotification(
    tenantId: string,
    teacherUserId: string,
    payload: {
      classId: string;
      studentId?: string;
      title: string;
      message: string;
      channel?: "IN_APP" | "EMAIL" | "SMS";
      targetAddress?: string;
      scheduledAt?: string;
    }
  ) {
    await this.assertTeacherCanAccessClass(tenantId, teacherUserId, payload.classId);
    if (payload.studentId) {
      const placement = await this.prisma.studentTrackPlacement.findFirst({
        where: {
          tenantId,
          classId: payload.classId,
          studentId: payload.studentId,
          placementStatus: {
            in: [AcademicPlacementStatus.ACTIVE, AcademicPlacementStatus.COMPLETED]
          }
        },
        select: { id: true }
      });
      if (!placement) {
        throw new ForbiddenException("Target student is not part of selected class.");
      }
    }

    const body: CreateNotificationDto = {
      studentId: payload.studentId,
      audienceRole: "PARENT",
      title: payload.title,
      message: payload.message,
      channel: payload.channel,
      targetAddress: payload.targetAddress,
      scheduledAt: payload.scheduledAt
    };
    return this.schoolLifeService.createNotification(tenantId, body);
  }

  async getParentOverview(tenantId: string, parentUserId: string) {
    const studentIds = await this.getParentStudentIds(tenantId, parentUserId);
    if (studentIds.length === 0) {
      return {
        childrenCount: 0,
        openInvoicesCount: 0,
        remainingAmount: 0,
        absencesCount: 0,
        reportCardsCount: 0,
        notificationsCount: 0
      };
    }

    const [childrenCount, openInvoices, absencesCount, reportCardsCount, notificationsCount] =
      await Promise.all([
        this.prisma.parentStudentLink.count({
          where: { tenantId, parentUserId }
        }),
        this.prisma.invoice.findMany({
          where: {
            tenantId,
            studentId: { in: studentIds },
            status: { in: ["OPEN", "PARTIAL"] }
          },
          select: { amountDue: true, amountPaid: true }
        }),
        this.prisma.attendance.count({
          where: {
            tenantId,
            studentId: { in: studentIds },
            status: { in: ["ABSENT", "LATE"] }
          }
        }),
        this.prisma.reportCard.count({
          where: {
            tenantId,
            studentId: { in: studentIds }
          }
        }),
        this.prisma.notification.count({
          where: {
            tenantId,
            OR: [{ audienceRole: "PARENT" }, { studentId: { in: studentIds } }]
          }
        })
      ]);

    const remainingAmount = openInvoices.reduce((sum, item) => {
      const due = this.decimalToNumber(item.amountDue);
      const paid = this.decimalToNumber(item.amountPaid);
      return sum + Math.max(0, due - paid);
    }, 0);

    return {
      childrenCount,
      openInvoicesCount: openInvoices.length,
      remainingAmount: this.roundAmount(remainingAmount),
      absencesCount,
      reportCardsCount,
      notificationsCount
    };
  }

  async listParentChildren(tenantId: string, parentUserId: string) {
    const rows = await this.prisma.parentStudentLink.findMany({
      where: { tenantId, parentUserId },
      include: {
        student: {
          include: {
            trackPlacements: {
              where: {
                placementStatus: {
                  in: [AcademicPlacementStatus.ACTIVE, AcademicPlacementStatus.COMPLETED]
                }
              },
              include: {
                level: {
                  include: {
                    cycle: true
                  }
                },
                classroom: true,
                schoolYear: true
              },
              orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }]
            }
          }
        }
      },
      orderBy: [{ isPrimary: "desc" }, { student: { lastName: "asc" } }]
    });

    return rows.map((row) => {
      const placements = row.student.trackPlacements.map((placement) => ({
        placementId: placement.id,
        enrollmentId: placement.legacyEnrollmentId || undefined,
        track: placement.track,
        placementStatus: placement.placementStatus,
        isPrimary: placement.isPrimary,
        levelId: placement.levelId,
        levelCode: placement.level.code,
        levelLabel: placement.level.label,
        academicStage: placement.level.cycle.academicStage,
        classId: placement.classId || undefined,
        classLabel: placement.classroom?.label,
        schoolYearId: placement.schoolYearId,
        schoolYearCode: placement.schoolYear.code
      }));
      const primaryPlacement =
        placements.find((placement) => placement.isPrimary) || placements[0];
      const secondaryPlacement =
        placements.find((placement) => !placement.isPrimary) ||
        placements.find((placement) => placement.placementId !== primaryPlacement?.placementId);
      return {
        linkId: row.id,
        studentId: row.studentId,
        matricule: row.student.matricule,
        studentName: `${row.student.firstName} ${row.student.lastName}`.trim(),
        relationship: row.relationship || undefined,
        isPrimary: row.isPrimary,
        classId: primaryPlacement?.classId,
        classLabel: primaryPlacement?.classLabel,
        schoolYearId: primaryPlacement?.schoolYearId,
        schoolYearCode: primaryPlacement?.schoolYearCode,
        primaryTrack: primaryPlacement?.track,
        primaryPlacement,
        secondaryPlacement,
        secondaryClassId: secondaryPlacement?.classId,
        secondaryClassLabel: secondaryPlacement?.classLabel,
        placements
      };
    });
  }

  async listParentGrades(
    tenantId: string,
    parentUserId: string,
    filters: { studentId?: string; academicPeriodId?: string; classId?: string }
  ) {
    const studentIds = await this.resolveParentScopedStudentIds(
      tenantId,
      parentUserId,
      filters.studentId
    );
    if (studentIds.length === 0) return [];

    const rows = await this.prisma.gradeEntry.findMany({
      where: {
        tenantId,
        studentId: { in: studentIds },
        academicPeriodId: filters.academicPeriodId,
        classId: filters.classId
      },
      include: {
        student: true,
        classroom: true,
        subject: true,
        academicPeriod: true
      },
      orderBy: [{ updatedAt: "desc" }]
    });

    return rows.map((row) => ({
      id: row.id,
      placementId: row.placementId || undefined,
      track: row.track,
      studentId: row.studentId,
      studentName: `${row.student.firstName} ${row.student.lastName}`.trim(),
      classId: row.classId,
      classLabel: row.classroom.label,
      subjectId: row.subjectId,
      subjectLabel: row.subject.label,
      academicPeriodId: row.academicPeriodId,
      periodLabel: row.academicPeriod.label,
      assessmentLabel: row.assessmentLabel,
      assessmentType: row.assessmentType,
      score: this.decimalToNumber(row.score),
      scoreMax: this.decimalToNumber(row.scoreMax),
      absent: row.absent,
      comment: row.comment || undefined,
      updatedAt: row.updatedAt.toISOString()
    }));
  }

  async listParentReportCards(
    tenantId: string,
    parentUserId: string,
    filters: { studentId?: string; academicPeriodId?: string; classId?: string }
  ) {
    const studentIds = await this.resolveParentScopedStudentIds(
      tenantId,
      parentUserId,
      filters.studentId
    );
    if (studentIds.length === 0) return [];

    const rows = await this.prisma.reportCard.findMany({
      where: {
        tenantId,
        studentId: { in: studentIds },
        academicPeriodId: filters.academicPeriodId,
        OR: filters.classId
          ? [
              { classId: filters.classId },
              {
                secondaryPlacement: {
                  is: {
                    classId: filters.classId
                  }
                }
              }
            ]
          : undefined
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
      orderBy: [{ updatedAt: "desc" }]
    });

    return rows.map((row) => ({
      id: row.id,
      placementId: row.placementId || undefined,
      secondaryPlacementId: row.secondaryPlacementId || undefined,
      track: row.track,
      mode: row.mode as ReportCardMode,
      studentId: row.studentId,
      studentName: `${row.student.firstName} ${row.student.lastName}`.trim(),
      classId: row.classId,
      classLabel: row.classroom.label,
      academicPeriodId: row.academicPeriodId,
      periodLabel: row.academicPeriod.label,
      averageGeneral: this.decimalToNumber(row.averageGeneral),
      classRank: row.classRank || undefined,
      appreciation: row.appreciation || undefined,
      publishedAt: row.publishedAt?.toISOString(),
      pdfDataUrl: row.pdfDataUrl || undefined,
      secondaryClassLabel: row.secondaryPlacement?.classroom?.label || undefined,
      sections:
        row.summaryData && typeof row.summaryData === "object" && !Array.isArray(row.summaryData)
          ? ((row.summaryData as { sections?: unknown }).sections as Array<{
              placementId?: string;
              track: "FRANCOPHONE" | "ARABOPHONE";
              classId: string;
              classLabel?: string;
              levelCode?: string;
              levelLabel?: string;
              academicStage: AcademicStage;
              averageGeneral: number;
              classRank?: number;
              appreciation: string;
              subjectAverages: Array<{
                subjectId: string;
                subjectLabel: string;
                average: number;
              }>;
            }> | undefined)
          : undefined
    }));
  }

  async listParentAttendance(
    tenantId: string,
    parentUserId: string,
    filters: { studentId?: string; classId?: string; fromDate?: string; toDate?: string }
  ) {
    const studentIds = await this.resolveParentScopedStudentIds(
      tenantId,
      parentUserId,
      filters.studentId
    );
    if (studentIds.length === 0) return [];

    const rows = await this.prisma.attendance.findMany({
      where: {
        tenantId,
        studentId: { in: studentIds },
        classId: filters.classId,
        attendanceDate:
          filters.fromDate || filters.toDate
            ? {
                gte: filters.fromDate ? new Date(filters.fromDate) : undefined,
                lte: filters.toDate ? new Date(filters.toDate) : undefined
              }
            : undefined
      },
      include: { student: true, classroom: true },
      orderBy: [{ attendanceDate: "desc" }, { createdAt: "desc" }]
    });

    return rows.map((row) => ({
      id: row.id,
      placementId: row.placementId || undefined,
      track: row.track,
      studentId: row.studentId,
      studentName: `${row.student.firstName} ${row.student.lastName}`.trim(),
      classId: row.classId,
      classLabel: row.classroom.label,
      attendanceDate: row.attendanceDate.toISOString().slice(0, 10),
      status: row.status,
      reason: row.reason || undefined,
      justificationStatus: row.justificationStatus
    }));
  }

  async listParentInvoices(tenantId: string, parentUserId: string, studentId?: string) {
    const studentIds = await this.resolveParentScopedStudentIds(
      tenantId,
      parentUserId,
      studentId
    );
    if (studentIds.length === 0) return [];

    const rows = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        studentId: { in: studentIds }
      },
      include: {
        student: true,
        schoolYear: true,
        billingPlacement: {
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

    return rows.map((row) => {
      const amountDue = this.decimalToNumber(row.amountDue);
      const amountPaid = this.decimalToNumber(row.amountPaid);
      return {
        id: row.id,
        studentId: row.studentId,
        studentName: `${row.student.firstName} ${row.student.lastName}`.trim(),
        schoolYearId: row.schoolYearId,
        schoolYearCode: row.schoolYear.code,
        billingPlacementId: row.billingPlacementId || undefined,
        secondaryPlacementId: row.secondaryPlacementId || undefined,
        invoiceNo: row.invoiceNo,
        amountDue,
        amountPaid,
        remainingAmount: this.roundAmount(amountDue - amountPaid),
        status: row.status,
        dueDate: row.dueDate?.toISOString().slice(0, 10),
        primaryTrack: row.billingPlacement?.track,
        primaryClassId: row.billingPlacement?.classId || undefined,
        primaryClassLabel: row.billingPlacement?.classroom?.label || undefined,
        primaryLevelId: row.billingPlacement?.levelId || undefined,
        primaryLevelLabel: row.billingPlacement?.level?.label || undefined,
        secondaryTrack: row.secondaryPlacement?.track,
        secondaryClassId: row.secondaryPlacement?.classId || undefined,
        secondaryClassLabel: row.secondaryPlacement?.classroom?.label || undefined,
        secondaryLevelId: row.secondaryPlacement?.levelId || undefined,
        secondaryLevelLabel: row.secondaryPlacement?.level?.label || undefined
      };
    });
  }

  async listParentPayments(tenantId: string, parentUserId: string, studentId?: string) {
    const studentIds = await this.resolveParentScopedStudentIds(
      tenantId,
      parentUserId,
      studentId
    );
    if (studentIds.length === 0) return [];

    const rows = await this.prisma.payment.findMany({
      where: {
        tenantId,
        invoice: {
          studentId: { in: studentIds }
        }
      },
      include: {
        invoice: {
          include: {
            student: true
          }
        }
      },
      orderBy: [{ paidAt: "desc" }]
    });

    return rows.map((row) => ({
      id: row.id,
      invoiceId: row.invoiceId,
      studentId: row.invoice.studentId,
      studentName: `${row.invoice.student.firstName} ${row.invoice.student.lastName}`.trim(),
      invoiceNo: row.invoice.invoiceNo,
      receiptNo: row.receiptNo,
      paidAmount: this.decimalToNumber(row.paidAmount),
      paymentMethod: row.paymentMethod,
      paidAt: row.paidAt.toISOString()
    }));
  }

  async listParentTimetable(tenantId: string, parentUserId: string, studentId?: string) {
    const children = await this.listParentChildren(tenantId, parentUserId);
    const scopedChildren = studentId
      ? children.filter((item) => item.studentId === studentId)
      : children;

    if (studentId && scopedChildren.length === 0) {
      throw new ForbiddenException("Student is not linked to current parent.");
    }

    type ParentPlacementTimetableContext = {
      studentId: string;
      studentName: string;
      placementId?: string;
      track?: string;
      classId: string;
      classLabel?: string;
      schoolYearId: string;
      schoolYearCode?: string;
    };

    const placementChildren = scopedChildren.flatMap<ParentPlacementTimetableContext>((child) => {
      if (Array.isArray(child.placements) && child.placements.length > 0) {
        return child.placements
          .filter(
            (placement) => Boolean(placement.classId) && Boolean(placement.schoolYearId)
          )
          .map((placement) => ({
            studentId: child.studentId,
            studentName: child.studentName,
            placementId: placement.placementId || undefined,
            track: placement.track,
            classId: placement.classId!,
            classLabel: placement.classLabel,
            schoolYearId: placement.schoolYearId!,
            schoolYearCode: placement.schoolYearCode
          }));
      }

      if (child.classId && child.schoolYearId) {
        return [
          {
            studentId: child.studentId,
            studentName: child.studentName,
            placementId: undefined,
            track: child.primaryTrack,
            classId: child.classId,
            classLabel: child.classLabel,
            schoolYearId: child.schoolYearId,
            schoolYearCode: child.schoolYearCode
          }
        ];
      }

      return [];
    });
    if (placementChildren.length === 0) return [];

    const classIds = [...new Set(placementChildren.map((item) => item.classId))];
    const rows = await this.prisma.timetableSlot.findMany({
      where: {
        tenantId,
        classId: { in: classIds }
      },
      include: {
        classroom: true,
        schoolYear: true,
        subject: true
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }]
    });

    return rows
      .flatMap((row) =>
        placementChildren
          .filter((child) => child.classId === row.classId)
          .map((child) => ({
            slotId: row.id,
            placementId: child.placementId,
            track: row.track,
            rotationGroup: row.rotationGroup || undefined,
            studentId: child.studentId,
            studentName: child.studentName,
            classId: row.classId,
            classLabel: row.classroom.label,
            schoolYearId: row.schoolYearId,
            schoolYearCode: row.schoolYear.code,
            subjectLabel: row.subject.label,
            dayOfWeek: row.dayOfWeek,
            startTime: row.startTime,
            endTime: row.endTime,
            room: row.room || undefined,
            teacherName: row.teacherName || undefined
          }))
      );
  }

  async listParentNotifications(tenantId: string, parentUserId: string, studentId?: string) {
    const studentIds = await this.resolveParentScopedStudentIds(
      tenantId,
      parentUserId,
      studentId
    );

    const rows = await this.prisma.notification.findMany({
      where: {
        tenantId,
        OR: [
          { audienceRole: "PARENT" },
          ...(studentIds.length > 0 ? [{ studentId: { in: studentIds } }] : [])
        ]
      },
      include: { student: true },
      orderBy: [{ createdAt: "desc" }],
      take: 120
    });

    return rows.map((row) => this.notificationView(row));
  }

  private async getTeacherClassIds(tenantId: string, teacherUserId: string): Promise<string[]> {
    const rows = await this.prisma.teacherClassAssignment.findMany({
      where: { tenantId, userId: teacherUserId },
      select: { classId: true }
    });
    return [...new Set(rows.map((row) => row.classId))];
  }

  private async assertTeacherCanAccessClass(
    tenantId: string,
    teacherUserId: string,
    classId: string
  ): Promise<void> {
    const assignment = await this.prisma.teacherClassAssignment.findFirst({
      where: { tenantId, userId: teacherUserId, classId },
      select: { id: true }
    });
    if (!assignment) {
      throw new ForbiddenException("Teacher is not assigned to this class.");
    }
  }

  private async assertTeacherCanAccessSubject(
    tenantId: string,
    teacherUserId: string,
    classId: string,
    subjectId: string
  ): Promise<void> {
    const assignments = await this.prisma.teacherClassAssignment.findMany({
      where: { tenantId, userId: teacherUserId, classId },
      select: { subjectId: true }
    });
    if (assignments.length === 0) {
      throw new ForbiddenException("Teacher is not assigned to this class.");
    }
    const scopedSubjects = assignments
      .map((item) => item.subjectId)
      .filter((item): item is string => Boolean(item));
    if (scopedSubjects.length > 0 && !scopedSubjects.includes(subjectId)) {
      throw new ForbiddenException("Teacher is not assigned to this subject for the class.");
    }
  }

  private resolveTeacherScopedClassIds(assignedClassIds: string[], classId?: string): string[] {
    if (!classId) return assignedClassIds;
    if (!assignedClassIds.includes(classId)) {
      throw new ForbiddenException("Teacher is not assigned to selected class.");
    }
    return [classId];
  }

  private decimalToNumber(value: Prisma.Decimal | number | null): number {
    if (value === null) return 0;
    if (typeof value === "number") return value;
    return Number(value.toString());
  }

  private roundAmount(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private async getParentStudentIds(
    tenantId: string,
    parentUserId: string
  ): Promise<string[]> {
    const rows = await this.prisma.parentStudentLink.findMany({
      where: { tenantId, parentUserId },
      select: { studentId: true }
    });
    return [...new Set(rows.map((row) => row.studentId))];
  }

  private async resolveParentScopedStudentIds(
    tenantId: string,
    parentUserId: string,
    studentId?: string
  ): Promise<string[]> {
    const studentIds = await this.getParentStudentIds(tenantId, parentUserId);
    if (!studentId) return studentIds;
    if (!studentIds.includes(studentId)) {
      throw new ForbiddenException("Student is not linked to current parent.");
    }
    return [studentId];
  }

  private notificationView(
    row: Prisma.NotificationGetPayload<{ include: { student: true } }>
  ) {
    return {
      id: row.id,
      studentId: row.studentId || undefined,
      studentName: row.student
        ? `${row.student.firstName} ${row.student.lastName}`.trim()
        : undefined,
      audienceRole: row.audienceRole || undefined,
      title: row.title,
      message: row.message,
      channel: row.channel,
      status: row.status,
      targetAddress: row.targetAddress || undefined,
      provider: row.provider || undefined,
      providerMessageId: row.providerMessageId || undefined,
      deliveryStatus: row.deliveryStatus,
      attempts: row.attempts,
      lastError: row.lastError || undefined,
      nextAttemptAt: row.nextAttemptAt?.toISOString(),
      deliveredAt: row.deliveredAt?.toISOString(),
      scheduledAt: row.scheduledAt?.toISOString(),
      sentAt: row.sentAt?.toISOString(),
      createdAt: row.createdAt.toISOString()
    };
  }
}
