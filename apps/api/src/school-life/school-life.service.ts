import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AcademicTrack, Prisma, RotationGroup, type AttendanceAttachment } from "@prisma/client";

import { AcademicStructureService } from "../academic-structure/academic-structure.service";
import { PrismaService } from "../database/prisma.service";
import { NotificationRequestBusService } from "../notifications/notification-request-bus.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ReferenceService } from "../reference/reference.service";
import {
  BulkAttendanceDto,
  CreateAttendanceAttachmentDto,
  CreateAttendanceDto,
  CreateNotificationDto,
  CreateTimetableSlotDto,
  NotificationDeliveryEventDto,
  UpdateAttendanceDto,
  UpdateAttendanceValidationDto,
  UpdateNotificationStatusDto,
  UpdateTimetableSlotDto
} from "./dto/school-life.dto";
import {
  NotificationGatewayService,
  type DeliveryStatus,
  type NotificationChannel
} from "./notification-gateway.service";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
type AttendanceJustificationStatus = "PENDING" | "APPROVED" | "REJECTED";

type AttendanceAttachmentView = {
  id: string;
  attendanceId: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string;
  uploadedByUserId?: string;
  createdAt: string;
};

type AttendanceView = {
  id: string;
  tenantId: string;
  studentId: string;
  classId: string;
  schoolYearId: string;
  placementId?: string;
  track: AcademicTrack;
  attendanceDate: string;
  status: string;
  reason?: string;
  justificationStatus: AttendanceJustificationStatus;
  validationComment?: string;
  validatedByUserId?: string;
  validatedAt?: string;
  attachments: AttendanceAttachmentView[];
  studentName?: string;
  classLabel?: string;
  schoolYearCode?: string;
};

type AttendanceWithRelations = Prisma.AttendanceGetPayload<{
  include: {
    student: true;
    classroom: true;
    schoolYear: true;
    attachments: true;
  };
}>;

type AttendanceSummaryView = {
  total: number;
  byStatus: {
    PRESENT: number;
    ABSENT: number;
    LATE: number;
    EXCUSED: number;
  };
  absenceRatePercent: number;
  topAbsentees: Array<{
    studentId: string;
    studentName: string;
    absentCount: number;
  }>;
};

type BulkAttendanceResult = {
  classId: string;
  attendanceDate: string;
  createdCount: number;
  updatedCount: number;
  errorCount: number;
  errors: Array<{
    studentId: string;
    message: string;
  }>;
};

type TimetableSlotView = {
  id: string;
  tenantId: string;
  classId: string;
  schoolYearId: string;
  subjectId: string;
  track: AcademicTrack;
  rotationGroup?: RotationGroup;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string;
  teacherName?: string;
  classLabel?: string;
  subjectLabel?: string;
  schoolYearCode?: string;
};

type TimetableGridView = {
  classId?: string;
  schoolYearId?: string;
  days: Array<{
    dayOfWeek: number;
    dayLabel: string;
    slots: TimetableSlotView[];
  }>;
};

type NotificationView = {
  id: string;
  tenantId: string;
  studentId?: string;
  audienceRole?: string;
  title: string;
  message: string;
  channel: string;
  status: string;
  targetAddress?: string;
  provider?: string;
  providerMessageId?: string;
  deliveryStatus: string;
  attempts: number;
  lastError?: string;
  nextAttemptAt?: string;
  deliveredAt?: string;
  scheduledAt?: string;
  sentAt?: string;
  studentName?: string;
};

type PaymentReceivedNotificationInput = {
  tenantId: string;
  invoiceNo: string;
  paidAmount: number;
  paidAt: string;
  receiptNo: string;
  studentId?: string;
  studentName?: string;
};

type NotificationWithStudent = Prisma.NotificationGetPayload<{
  include: {
    student: true;
  };
}>;

const DAY_LABELS = new Map<number, string>([
  [1, "Lundi"],
  [2, "Mardi"],
  [3, "Mercredi"],
  [4, "Jeudi"],
  [5, "Vendredi"],
  [6, "Samedi"],
  [7, "Dimanche"]
]);

@Injectable()
export class SchoolLifeService {
  constructor(
    private readonly academicStructureService: AcademicStructureService,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly notificationRequestBus: NotificationRequestBusService,
    private readonly referenceService: ReferenceService,
    private readonly notificationGateway: NotificationGatewayService,
    private readonly configService: ConfigService,
  ) {}

  async getAttendanceSummary(
    tenantId: string,
    filters: {
      classId?: string;
      fromDate?: string;
      toDate?: string;
    }
  ): Promise<AttendanceSummaryView> {
    const where: Prisma.AttendanceWhereInput = {
      tenantId,
      classId: filters.classId
    };

    if (filters.fromDate || filters.toDate) {
      where.attendanceDate = {
        gte: filters.fromDate ? new Date(filters.fromDate) : undefined,
        lte: filters.toDate ? new Date(filters.toDate) : undefined
      };
    }

    const rows = await this.prisma.attendance.findMany({
      where,
      select: {
        status: true,
        studentId: true,
        student: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    const byStatus = {
      PRESENT: 0,
      ABSENT: 0,
      LATE: 0,
      EXCUSED: 0
    };

    const absencesByStudent = new Map<string, { studentName: string; absentCount: number }>();

    for (const row of rows) {
      const status = this.normalizeAttendanceStatus(row.status);
      byStatus[status] += 1;

      if (status === "ABSENT") {
        const current = absencesByStudent.get(row.studentId);
        const studentName = `${row.student.firstName} ${row.student.lastName}`.trim();
        if (current) {
          current.absentCount += 1;
        } else {
          absencesByStudent.set(row.studentId, {
            studentName,
            absentCount: 1
          });
        }
      }
    }

    const total = rows.length;
    const absenceRatePercent =
      total === 0 ? 0 : Number((((byStatus.ABSENT + byStatus.LATE) / total) * 100).toFixed(2));

    const topAbsentees = Array.from(absencesByStudent.entries())
      .map(([studentId, value]) => ({
        studentId,
        studentName: value.studentName,
        absentCount: value.absentCount
      }))
      .sort((left, right) => right.absentCount - left.absentCount)
      .slice(0, 5);

    return {
      total,
      byStatus,
      absenceRatePercent,
      topAbsentees
    };
  }

  async listAttendance(
    tenantId: string,
    filters: {
      classId?: string;
      studentId?: string;
      status?: string;
      fromDate?: string;
      toDate?: string;
    }
  ): Promise<AttendanceView[]> {
    const where: Prisma.AttendanceWhereInput = {
      tenantId,
      classId: filters.classId,
      studentId: filters.studentId,
      status: filters.status
    };

    if (filters.fromDate || filters.toDate) {
      where.attendanceDate = {
        gte: filters.fromDate ? new Date(filters.fromDate) : undefined,
        lte: filters.toDate ? new Date(filters.toDate) : undefined
      };
    }

    const rows = await this.prisma.attendance.findMany({
      where,
      include: {
          student: true,
          classroom: true,
          schoolYear: true,
          attachments: {
            orderBy: [{ createdAt: "desc" }]
          }
        },
      orderBy: [{ attendanceDate: "desc" }, { createdAt: "desc" }]
    });

    return rows.map((row) => this.attendanceView(row));
  }

  async createAttendance(
    tenantId: string,
    payload: CreateAttendanceDto
  ): Promise<AttendanceView> {
    const classroom = await this.referenceService.requireClassroom(tenantId, payload.classId);
    const student = await this.requireStudent(tenantId, payload.studentId);
    const placement = await this.academicStructureService.requirePlacementForStudentClass(
      tenantId,
      student.id,
      classroom.id,
      classroom.schoolYearId
    );

    const status = this.normalizeAttendanceStatus(payload.status || "PRESENT");
    const requiresJustification = this.requiresAttendanceJustification(status);

    try {
      const created = await this.prisma.$transaction(async (transaction) => {
        const createdAttendance = await transaction.attendance.create({
          data: {
            tenantId,
            studentId: student.id,
            classId: classroom.id,
            schoolYearId: classroom.schoolYearId,
            placementId: placement.id,
            track: placement.track,
            attendanceDate: new Date(payload.attendanceDate),
            status,
            reason: payload.reason?.trim(),
            justificationStatus: requiresJustification ? "PENDING" : "APPROVED",
            validationComment: null,
            validatedByUserId: null,
            validatedAt: null,
            updatedAt: new Date()
          },
          include: {
            student: true,
            classroom: true,
            schoolYear: true,
            attachments: {
              orderBy: [{ createdAt: "desc" }]
            }
          }
        });

        await this.enqueueAttendanceAlertRequested(transaction, createdAttendance);
        return createdAttendance;
      });

      return this.attendanceView(created);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "Attendance already exists for this student, class and date."
        );
      }
      throw error;
    }
  }

  async upsertAttendanceBulk(
    tenantId: string,
    payload: BulkAttendanceDto
  ): Promise<BulkAttendanceResult> {
    const classroom = await this.referenceService.requireClassroom(tenantId, payload.classId);
    const attendanceDate = new Date(payload.attendanceDate);
    const defaultStatus = this.normalizeAttendanceStatus(payload.defaultStatus || "PRESENT");

    let createdCount = 0;
    let updatedCount = 0;
    const errors: Array<{ studentId: string; message: string }> = [];
    const seenStudentIds = new Set<string>();

    for (const entry of payload.entries) {
      if (seenStudentIds.has(entry.studentId)) {
        errors.push({
          studentId: entry.studentId,
          message: "Duplicate student in entries payload."
        });
        continue;
      }
      seenStudentIds.add(entry.studentId);

      try {
        await this.requireStudent(tenantId, entry.studentId);
        const placement = await this.academicStructureService.requirePlacementForStudentClass(
          tenantId,
          entry.studentId,
          classroom.id,
          classroom.schoolYearId
        );

        const status = this.normalizeAttendanceStatus(entry.status || defaultStatus);
        const requiresJustification = this.requiresAttendanceJustification(status);

        const existing = await this.prisma.attendance.findFirst({
          where: {
            tenantId,
            studentId: entry.studentId,
            classId: classroom.id,
            attendanceDate
          }
        });

        if (existing) {
          await this.prisma.$transaction(async (transaction) => {
            const updatedAttendance = await transaction.attendance.update({
              where: { id: existing.id },
              data: {
                status,
                reason: entry.reason?.trim(),
                placementId: placement.id,
                track: placement.track,
                justificationStatus: requiresJustification ? "PENDING" : "APPROVED",
                validationComment: null,
                validatedByUserId: null,
                validatedAt: null,
                updatedAt: new Date()
              },
              include: {
                student: true,
                classroom: true,
                schoolYear: true,
                attachments: {
                  orderBy: [{ createdAt: "desc" }]
                }
              }
            });

            await this.enqueueAttendanceAlertRequested(transaction, updatedAttendance);
          });
          updatedCount += 1;
        } else {
          await this.prisma.$transaction(async (transaction) => {
            const createdAttendance = await transaction.attendance.create({
              data: {
                tenantId,
                studentId: entry.studentId,
                classId: classroom.id,
                schoolYearId: classroom.schoolYearId,
                placementId: placement.id,
                track: placement.track,
                attendanceDate,
                status,
                reason: entry.reason?.trim(),
                justificationStatus: requiresJustification ? "PENDING" : "APPROVED",
                validationComment: null,
                validatedByUserId: null,
                validatedAt: null,
                updatedAt: new Date()
              },
              include: {
                student: true,
                classroom: true,
                schoolYear: true,
                attachments: {
                  orderBy: [{ createdAt: "desc" }]
                }
              }
            });

            await this.enqueueAttendanceAlertRequested(transaction, createdAttendance);
          });
          createdCount += 1;
        }
      } catch (error: unknown) {
        errors.push({
          studentId: entry.studentId,
          message: this.extractErrorMessage(error)
        });
      }
    }

    return {
      classId: classroom.id,
      attendanceDate: payload.attendanceDate,
      createdCount,
      updatedCount,
      errorCount: errors.length,
      errors
    };
  }

  async updateAttendance(
    tenantId: string,
    id: string,
    payload: UpdateAttendanceDto
  ): Promise<AttendanceView> {
    const existing = await this.requireAttendance(tenantId, id);

    const classId = payload.classId || existing.classId;
    const studentId = payload.studentId || existing.studentId;

    const classroom = await this.referenceService.requireClassroom(tenantId, classId);
    await this.requireStudent(tenantId, studentId);
    const placement = await this.academicStructureService.requirePlacementForStudentClass(
      tenantId,
      studentId,
      classroom.id,
      classroom.schoolYearId
    );

    const nextStatus = payload.status
      ? this.normalizeAttendanceStatus(payload.status)
      : this.normalizeAttendanceStatus(existing.status);
    const requiresJustification = this.requiresAttendanceJustification(nextStatus);
    const validationReset = payload.status
      ? {
          justificationStatus: requiresJustification ? "PENDING" : "APPROVED",
          validationComment: null,
          validatedByUserId: null,
          validatedAt: null
        }
      : {};

    try {
      const updated = await this.prisma.$transaction(async (transaction) => {
        const updatedAttendance = await transaction.attendance.update({
          where: { id: existing.id },
          data: {
            studentId,
            classId: classroom.id,
            schoolYearId: classroom.schoolYearId,
            placementId: placement.id,
            track: placement.track,
            attendanceDate: payload.attendanceDate
              ? new Date(payload.attendanceDate)
              : undefined,
            status: payload.status ? nextStatus : undefined,
            reason: payload.reason,
            ...validationReset,
            updatedAt: new Date()
          },
          include: {
            student: true,
            classroom: true,
            schoolYear: true,
            attachments: {
              orderBy: [{ createdAt: "desc" }]
            }
          }
        });

        await this.enqueueAttendanceAlertRequested(transaction, updatedAttendance);
        return updatedAttendance;
      });

      return this.attendanceView(updated);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "Attendance already exists for this student, class and date."
        );
      }
      throw error;
    }
  }

  async deleteAttendance(tenantId: string, id: string): Promise<void> {
    await this.requireAttendance(tenantId, id);
    await this.prisma.attendance.delete({ where: { id } });
  }

  async listAttendanceAttachments(
    tenantId: string,
    attendanceId: string
  ): Promise<AttendanceAttachmentView[]> {
    await this.requireAttendance(tenantId, attendanceId);

    const rows = await this.prisma.attendanceAttachment.findMany({
      where: {
        tenantId,
        attendanceId
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return rows.map((row) => this.attendanceAttachmentView(row));
  }

  async addAttendanceAttachment(
    tenantId: string,
    attendanceId: string,
    payload: CreateAttendanceAttachmentDto,
    uploadedByUserId?: string
  ): Promise<AttendanceAttachmentView> {
    await this.requireAttendance(tenantId, attendanceId);

    const created = await this.prisma.attendanceAttachment.create({
      data: {
        tenantId,
        attendanceId,
        fileName: payload.fileName.trim(),
        fileUrl: payload.fileUrl.trim(),
        mimeType: payload.mimeType?.trim(),
        uploadedByUserId: uploadedByUserId || null,
        updatedAt: new Date()
      }
    });

    return this.attendanceAttachmentView(created);
  }

  async deleteAttendanceAttachment(
    tenantId: string,
    attendanceId: string,
    attachmentId: string
  ): Promise<void> {
    await this.requireAttendance(tenantId, attendanceId);

    const attachment = await this.prisma.attendanceAttachment.findFirst({
      where: {
        id: attachmentId,
        tenantId,
        attendanceId
      }
    });

    if (!attachment) {
      throw new NotFoundException("Attendance attachment not found.");
    }

    await this.prisma.attendanceAttachment.delete({ where: { id: attachment.id } });
  }

  async updateAttendanceValidation(
    tenantId: string,
    attendanceId: string,
    payload: UpdateAttendanceValidationDto,
    validatedByUserId?: string
  ): Promise<AttendanceView> {
    const attendance = await this.requireAttendance(tenantId, attendanceId);

    if (!this.requiresAttendanceJustification(attendance.status)) {
      throw new ConflictException(
        "Only ABSENT or LATE attendance records can be validated."
      );
    }

    const status = this.normalizeJustificationStatus(payload.status);
    const now = new Date();

    const updated = await this.prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        justificationStatus: status,
        validationComment: payload.comment?.trim() || null,
        validatedByUserId: status === "PENDING" ? null : validatedByUserId || null,
        validatedAt: status === "PENDING" ? null : now,
        updatedAt: now
      },
      include: {
          student: true,
          classroom: true,
          schoolYear: true,
          attachments: {
            orderBy: [{ createdAt: "desc" }]
          }
        }
    });

    return this.attendanceView(updated);
  }

  async listTimetableSlots(
    tenantId: string,
    filters: {
      classId?: string;
      schoolYearId?: string;
      dayOfWeek?: number;
      track?: AcademicTrack;
    }
  ): Promise<TimetableSlotView[]> {
    const rows = await this.prisma.timetableSlot.findMany({
      where: {
        tenantId,
        classId: filters.classId,
        schoolYearId: filters.schoolYearId,
        dayOfWeek: filters.dayOfWeek,
        track: filters.track
      },
      include: {
        classroom: true,
        subject: true,
        schoolYear: true
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }]
    });

    return rows.map((row) => this.timetableSlotView(row));
  }

  async getTimetableGrid(
    tenantId: string,
    filters: { classId?: string; schoolYearId?: string; track?: AcademicTrack }
  ): Promise<TimetableGridView> {
    const slots = await this.listTimetableSlots(tenantId, {
      classId: filters.classId,
      schoolYearId: filters.schoolYearId,
      track: filters.track
    });

    const days = Array.from({ length: 7 }, (_, index) => {
      const dayOfWeek = index + 1;
      return {
        dayOfWeek,
        dayLabel: DAY_LABELS.get(dayOfWeek) || `Jour ${dayOfWeek}`,
        slots: [] as TimetableSlotView[]
      };
    });

    for (const slot of slots) {
      const day = days[slot.dayOfWeek - 1];
      if (day) {
        day.slots.push(slot);
      }
    }

    return {
      classId: filters.classId,
      schoolYearId: filters.schoolYearId,
      days
    };
  }

  async createTimetableSlot(
    tenantId: string,
    payload: CreateTimetableSlotDto
  ): Promise<TimetableSlotView> {
    const classroom = await this.referenceService.requireClassroom(tenantId, payload.classId);
    await this.referenceService.requireSubject(tenantId, payload.subjectId);

    this.validateTimes(payload.startTime, payload.endTime);

    const ruleContext = await this.academicStructureService.validateTimetableSlotAgainstPedagogicalRules(
      tenantId,
      {
        classId: classroom.id,
        dayOfWeek: payload.dayOfWeek,
        startTime: payload.startTime,
        track: payload.track,
        rotationGroup: payload.rotationGroup
      }
    );

    await this.ensureNoTimetableConflict(tenantId, {
      classId: classroom.id,
      schoolYearId: classroom.schoolYearId,
      dayOfWeek: payload.dayOfWeek,
      startTime: payload.startTime,
      endTime: payload.endTime,
      teacherName: payload.teacherName
    });

    try {
      const created = await this.prisma.timetableSlot.create({
        data: {
          tenantId,
          classId: classroom.id,
          schoolYearId: classroom.schoolYearId,
          track: ruleContext.track,
          rotationGroup: ruleContext.rotationGroup || null,
          subjectId: payload.subjectId,
          dayOfWeek: payload.dayOfWeek,
          startTime: payload.startTime,
          endTime: payload.endTime,
          room: payload.room?.trim(),
          teacherName: payload.teacherName?.trim(),
          updatedAt: new Date()
        },
        include: {
          classroom: true,
          subject: true,
          schoolYear: true
        }
      });

      return this.timetableSlotView(created);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "A slot already exists for this class, day and start time."
        );
      }
      throw error;
    }
  }

  async updateTimetableSlot(
    tenantId: string,
    id: string,
    payload: UpdateTimetableSlotDto
  ): Promise<TimetableSlotView> {
    const existing = await this.requireTimetableSlot(tenantId, id);

    const classId = payload.classId || existing.classId;
    const classroom = await this.referenceService.requireClassroom(tenantId, classId);

    if (payload.subjectId) {
      await this.referenceService.requireSubject(tenantId, payload.subjectId);
    }

    const startTime = payload.startTime || existing.startTime;
    const endTime = payload.endTime || existing.endTime;
    const dayOfWeek = payload.dayOfWeek || existing.dayOfWeek;
    const teacherName = payload.teacherName ?? existing.teacherName ?? undefined;

    this.validateTimes(startTime, endTime);

    const ruleContext = await this.academicStructureService.validateTimetableSlotAgainstPedagogicalRules(
      tenantId,
      {
        classId: classroom.id,
        dayOfWeek,
        startTime,
        track: payload.track || existing.track,
        rotationGroup: payload.rotationGroup || existing.rotationGroup || undefined
      }
    );

    await this.ensureNoTimetableConflict(tenantId, {
      classId: classroom.id,
      schoolYearId: classroom.schoolYearId,
      dayOfWeek,
      startTime,
      endTime,
      teacherName,
      excludeId: existing.id
    });

    try {
      const updated = await this.prisma.timetableSlot.update({
        where: { id: existing.id },
        data: {
          classId: classroom.id,
          schoolYearId: classroom.schoolYearId,
          track: ruleContext.track,
          rotationGroup: ruleContext.rotationGroup || null,
          subjectId: payload.subjectId,
          dayOfWeek: payload.dayOfWeek,
          startTime: payload.startTime,
          endTime: payload.endTime,
          room: payload.room,
          teacherName: payload.teacherName,
          updatedAt: new Date()
        },
        include: {
          classroom: true,
          subject: true,
          schoolYear: true
        }
      });

      return this.timetableSlotView(updated);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "A slot already exists for this class, day and start time."
        );
      }
      throw error;
    }
  }

  async deleteTimetableSlot(tenantId: string, id: string): Promise<void> {
    await this.requireTimetableSlot(tenantId, id);
    await this.prisma.timetableSlot.delete({ where: { id } });
  }

  async listNotifications(
    tenantId: string,
    filters: {
      status?: string;
      channel?: string;
      audienceRole?: string;
      studentId?: string;
      deliveryStatus?: string;
      provider?: string;
    }
  ): Promise<NotificationView[]> {
    return this.notificationsService.listNotifications(tenantId, filters);
  }

  async createNotification(
    tenantId: string,
    payload: CreateNotificationDto
  ): Promise<NotificationView> {
    return this.notificationsService.createNotification(tenantId, payload);
  }

  async dispatchPendingNotifications(
    tenantId: string,
    limit?: number
  ): Promise<{ dispatchedCount: number; notifications: NotificationView[] }> {
    return this.notificationsService.dispatchPendingNotifications(tenantId, limit);
  }

  async dispatchPendingNotificationsGlobal(
    limit?: number
  ): Promise<{ dispatchedCount: number; notifications: NotificationView[] }> {
    return this.notificationsService.dispatchPendingNotificationsGlobal(limit);
  }

  async recordDeliveryEvent(payload: NotificationDeliveryEventDto): Promise<NotificationView> {
    return this.notificationsService.recordDeliveryEvent(payload);
  }

  async ensureAttendanceAlertNotification(
    tenantId: string,
    attendanceId: string
  ): Promise<void> {
    if (!tenantId) {
      return;
    }

    const attendance = await this.prisma.attendance.findFirst({
      where: {
        id: attendanceId,
        tenantId
      },
      include: {
        student: true,
        classroom: true,
        schoolYear: true
      }
    });

    if (!attendance || !this.isAttendanceAlertStatus(attendance.status)) {
      return;
    }

    await this.maybeCreateAttendanceNotification(attendance);
  }

  async ensurePaymentReceivedNotification(
    input: PaymentReceivedNotificationInput
  ): Promise<void> {
    if (!input.tenantId || !input.studentId) {
      return;
    }

    const title = "Paiement recu";
    const studentLabel = input.studentName?.trim() || "Votre enfant";
    const paidDate = input.paidAt.slice(0, 10);
    const amountLabel = input.paidAmount.toFixed(2);
    const message =
      `${studentLabel}: paiement ${input.receiptNo} de ${amountLabel} ` +
      `enregistre pour la facture ${input.invoiceNo} le ${paidDate}.`;

    const existing = await this.prisma.notification.findFirst({
      where: {
        tenantId: input.tenantId,
        studentId: input.studentId,
        audienceRole: "PARENT",
        channel: "IN_APP",
        title,
        message
      }
    });

    if (existing) {
      return;
    }

    await this.prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        studentId: input.studentId,
        audienceRole: "PARENT",
        title,
        message,
        channel: "IN_APP",
        status: "PENDING",
        provider: "IN_APP",
        providerMessageId: null,
        deliveryStatus: "QUEUED",
        attempts: 0,
        lastError: null,
        nextAttemptAt: null,
        deliveredAt: null,
        updatedAt: new Date()
      }
    });
  }

  async updateNotificationStatus(
    tenantId: string,
    id: string,
    payload: UpdateNotificationStatusDto
  ): Promise<NotificationView> {
    return this.notificationsService.updateNotificationStatus(tenantId, id, payload);
  }

  private async maybeCreateAttendanceNotification(
    attendance: Prisma.AttendanceGetPayload<{
      include: {
        student: true;
        classroom: true;
        schoolYear: true;
      };
    }>
  ): Promise<void> {
    if (!this.isAttendanceAlertStatus(attendance.status)) {
      return;
    }

    const studentName = `${attendance.student.firstName} ${attendance.student.lastName}`.trim();
    const dateLabel = attendance.attendanceDate.toISOString().slice(0, 10);
    const isLate = this.normalizeAttendanceStatus(attendance.status) === "LATE";

    const title = isLate ? "Alerte retard" : "Alerte absence";
    const message = isLate
      ? `${studentName} est en retard le ${dateLabel} (${attendance.classroom.label}).`
      : `${studentName} est absent le ${dateLabel} (${attendance.classroom.label}).`;

    const existing = await this.prisma.notification.findFirst({
      where: {
        tenantId: attendance.tenantId,
        studentId: attendance.studentId,
        title,
        message,
        audienceRole: "PARENT",
        channel: "IN_APP"
      }
    });

    if (existing) {
      return;
    }

    await this.prisma.notification.create({
      data: {
        tenantId: attendance.tenantId,
        studentId: attendance.studentId,
        audienceRole: "PARENT",
        title,
        message,
        channel: "IN_APP",
        status: "PENDING",
        provider: "IN_APP",
        providerMessageId: null,
        deliveryStatus: "QUEUED",
        attempts: 0,
        lastError: null,
        nextAttemptAt: null,
        deliveredAt: null,
        updatedAt: new Date()
      }
    });
  }

  private async enqueueAttendanceAlertRequested(
    transaction: Prisma.TransactionClient,
    attendance: Pick<
      AttendanceWithRelations,
      "attendanceDate" | "classroom" | "id" | "status" | "student" | "studentId" | "tenantId"
    >
  ): Promise<void> {
    if (!this.isAttendanceAlertStatus(attendance.status)) {
      return;
    }

    const normalizedStatus = this.normalizeAttendanceStatus(attendance.status);
    const studentName = `${attendance.student.firstName} ${attendance.student.lastName}`.trim();
    const dateLabel = attendance.attendanceDate.toISOString().slice(0, 10);
    const isLate = normalizedStatus === "LATE";

    await this.notificationRequestBus.publish(
      {
        tenantId: attendance.tenantId,
        kind: "ATTENDANCE_ALERT",
        channel: "IN_APP",
        recipient: {
          audienceRole: "PARENT",
          studentId: attendance.studentId
        },
        content: {
          templateKey: "attendance-alert",
          title: isLate ? "Alerte retard" : "Alerte absence",
          message: isLate
            ? `${studentName} est en retard le ${dateLabel} (${attendance.classroom.label}).`
            : `${studentName} est absent le ${dateLabel} (${attendance.classroom.label}).`,
          variables: {
            attendanceId: attendance.id,
            attendanceDate: dateLabel,
            classLabel: attendance.classroom.label,
            status: normalizedStatus,
            studentId: attendance.studentId,
            studentName
          }
        },
        source: {
          domain: "school-life",
          action: "attendance.alert.requested",
          referenceType: "attendance",
          referenceId: attendance.id
        },
        correlationId: attendance.id,
        idempotencyKey: `notification-request:school-life:attendance:${attendance.id}:${normalizedStatus}`
      },
      transaction
    );
  }

  private async dispatchNotifications(
    scope: Prisma.NotificationWhereInput,
    limit?: number
  ): Promise<{ dispatchedCount: number; notifications: NotificationView[] }> {
    const cappedLimit = Math.max(1, Math.min(limit ?? 100, 500));
    const now = new Date();

    const rows = await this.prisma.notification.findMany({
      where: {
        ...scope,
        status: {
          in: ["PENDING", "SCHEDULED"]
        },
        OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
        AND: [{ OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }]
      },
      include: {
        student: true
      },
      orderBy: [{ createdAt: "asc" }],
      take: cappedLimit
    });

    if (rows.length === 0) {
      return {
        dispatchedCount: 0,
        notifications: []
      };
    }

    const updatedRows: NotificationView[] = [];
    for (const row of rows) {
      const claimed = await this.claimNotificationForDispatch(row.id, now);
      if (!claimed) {
        continue;
      }
      const updated = await this.dispatchSingleNotification(row);
      updatedRows.push(updated);
    }

    return {
      dispatchedCount: updatedRows.filter((row) => row.status === "SENT").length,
      notifications: updatedRows
    };
  }

  private async claimNotificationForDispatch(id: string, now: Date): Promise<boolean> {
    const claimUntil = new Date(now.getTime() + this.notificationDispatchClaimTtlMs());
    const result = await this.prisma.notification.updateMany({
      where: {
        id,
        status: {
          in: ["PENDING", "SCHEDULED"]
        },
        OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
        AND: [{ OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }]
      },
      data: {
        nextAttemptAt: claimUntil,
        updatedAt: now
      }
    });

    return result.count === 1;
  }

  private async dispatchSingleNotification(
    row: NotificationWithStudent
  ): Promise<NotificationView> {
    const now = new Date();
    const channel = this.normalizeNotificationChannel(row.channel);
    const nextAttempt = row.attempts + 1;

    try {
      const targetAddress = await this.resolveNotificationTargetAddress(row, channel);
      const dispatchResult = await this.notificationGateway.dispatch({
        notificationId: row.id,
        tenantId: row.tenantId,
        channel,
        title: row.title,
        message: row.message,
        targetAddress: targetAddress || undefined
      });

      const updated = await this.prisma.notification.update({
        where: { id: row.id },
        data: {
          status: "SENT",
          sentAt: now,
          targetAddress: targetAddress || row.targetAddress,
          provider: dispatchResult.provider,
          providerMessageId: dispatchResult.providerMessageId,
          deliveryStatus: dispatchResult.deliveryStatus,
          attempts: nextAttempt,
          lastError: null,
          nextAttemptAt: null,
          deliveredAt: dispatchResult.deliveryStatus === "DELIVERED" ? now : row.deliveredAt,
          updatedAt: now
        },
        include: {
          student: true
        }
      });

      return this.notificationView(updated);
    } catch (error: unknown) {
      const maxAttempts = this.notificationMaxAttempts();
      const canRetry = channel !== "IN_APP" && nextAttempt < maxAttempts;
      const retryDelayMinutes = this.notificationRetryDelayMinutes(nextAttempt);
      const nextAttemptAt = canRetry
        ? new Date(now.getTime() + retryDelayMinutes * 60 * 1000)
        : null;

      const updated = await this.prisma.notification.update({
        where: { id: row.id },
        data: {
          status: canRetry ? "PENDING" : "FAILED",
          deliveryStatus: canRetry ? "RETRYING" : "FAILED",
          attempts: nextAttempt,
          nextAttemptAt,
          lastError: this.extractDispatchErrorMessage(error),
          provider: row.provider || this.defaultProviderName(channel),
          updatedAt: now
        },
        include: {
          student: true
        }
      });

      return this.notificationView(updated);
    }
  }

  private normalizeNotificationChannel(value: string): NotificationChannel {
    const normalized = value.trim().toUpperCase();
    if (normalized === "EMAIL" || normalized === "SMS") {
      return normalized;
    }
    return "IN_APP";
  }

  private defaultProviderName(channel: NotificationChannel): string {
    if (channel === "EMAIL") return "EMAIL_GATEWAY";
    if (channel === "SMS") return "SMS_GATEWAY";
    return "IN_APP";
  }

  private async resolveNotificationTargetAddress(
    row: NotificationWithStudent,
    channel: NotificationChannel
  ): Promise<string | null> {
    if (channel === "IN_APP") {
      return null;
    }

    if (row.targetAddress) {
      const explicit = row.targetAddress.trim();
      if (channel === "EMAIL" && this.isValidEmail(explicit)) return explicit;
      if (channel === "SMS" && this.isValidPhone(explicit)) return explicit;
      throw new ConflictException(`Invalid targetAddress for ${channel} notification.`);
    }

    if (row.student) {
      if (channel === "EMAIL" && row.student.email && this.isValidEmail(row.student.email)) {
        return row.student.email.trim();
      }
      if (channel === "SMS" && row.student.phone && this.isValidPhone(row.student.phone)) {
        return row.student.phone.trim();
      }
    }

    if (row.audienceRole === "PARENT" && row.studentId) {
      const parentAddress = await this.resolveParentAddress(row.tenantId, row.studentId, channel);
      if (parentAddress) {
        return parentAddress;
      }
    }

    if (row.audienceRole) {
      const audienceAddress = await this.resolveAudienceAddress(
        row.tenantId,
        row.audienceRole,
        channel
      );
      if (audienceAddress) {
        return audienceAddress;
      }
    }

    throw new ConflictException(`No deliverable target found for ${channel} notification.`);
  }

  private async resolveParentAddress(
    tenantId: string,
    studentId: string,
    channel: NotificationChannel
  ): Promise<string | null> {
    const links = await this.prisma.parentStudentLink.findMany({
      where: {
        tenantId,
        studentId
      },
      include: {
        parent: true
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }]
    });

    for (const link of links) {
      const value = link.parent.username?.trim();
      if (!value) continue;
      if (channel === "EMAIL" && this.isValidEmail(value)) {
        return value;
      }
      if (channel === "SMS" && this.isValidPhone(value)) {
        return value;
      }
    }

    return null;
  }

  private async resolveAudienceAddress(
    tenantId: string,
    audienceRole: string,
    channel: NotificationChannel
  ): Promise<string | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId,
        role: audienceRole,
        isActive: true,
        deletedAt: null
      },
      orderBy: [{ createdAt: "asc" }]
    });

    if (!user?.username) {
      return null;
    }

    const candidate = user.username.trim();
    if (channel === "EMAIL" && this.isValidEmail(candidate)) {
      return candidate;
    }
    if (channel === "SMS" && this.isValidPhone(candidate)) {
      return candidate;
    }
    return null;
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  private isValidPhone(value: string): boolean {
    return /^\+?[0-9]{8,20}$/.test(value.trim());
  }

  private notificationMaxAttempts(): number {
    const raw = Number(this.configService.get<string>("NOTIFY_MAX_ATTEMPTS", "4"));
    if (!Number.isFinite(raw) || raw < 1) {
      return 4;
    }
    return Math.floor(raw);
  }

  private notificationRetryDelayMinutes(attempt: number): number {
    const baseRaw = Number(this.configService.get<string>("NOTIFY_RETRY_BASE_MINUTES", "3"));
    const base = Number.isFinite(baseRaw) && baseRaw > 0 ? baseRaw : 3;
    return Math.min(base * Math.pow(2, Math.max(0, attempt - 1)), 120);
  }

  private notificationDispatchClaimTtlMs(): number {
    const raw = Number(
      this.configService.get<string>("NOTIFICATIONS_DISPATCH_CLAIM_TTL_SECONDS", "120")
    );
    if (!Number.isFinite(raw) || raw <= 0) {
      return 120_000;
    }
    return raw * 1000;
  }

  private extractDispatchErrorMessage(error: unknown): string {
    if (error instanceof ConflictException) {
      return error.message;
    }
    if (error instanceof Error) {
      return error.message.slice(0, 500);
    }
    return "Notification dispatch failed.";
  }

  private normalizeDeliveryStatus(value: string): DeliveryStatus {
    const normalized = value.trim().toUpperCase();
    if (normalized === "DELIVERED") return "DELIVERED";
    if (normalized === "FAILED") return "FAILED";
    if (normalized === "RETRYING") return "RETRYING";
    if (normalized === "UNDELIVERABLE") return "UNDELIVERABLE";
    if (normalized === "QUEUED") return "QUEUED";
    return "SENT_TO_PROVIDER";
  }

  private async ensureNoTimetableConflict(
    tenantId: string,
    payload: {
      classId: string;
      schoolYearId: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      teacherName?: string;
      excludeId?: string;
    }
  ): Promise<void> {
    const normalizedTeacherName = payload.teacherName?.trim() || undefined;

    const rows = await this.prisma.timetableSlot.findMany({
      where: {
        tenantId,
        schoolYearId: payload.schoolYearId,
        dayOfWeek: payload.dayOfWeek,
        id: payload.excludeId ? { not: payload.excludeId } : undefined,
        OR: [
          { classId: payload.classId },
          ...(normalizedTeacherName ? [{ teacherName: normalizedTeacherName }] : [])
        ]
      }
    });

    for (const row of rows) {
      if (!this.timesOverlap(payload.startTime, payload.endTime, row.startTime, row.endTime)) {
        continue;
      }

      if (row.classId === payload.classId) {
        throw new ConflictException("Classroom already has another slot in this time range.");
      }

      if (normalizedTeacherName && row.teacherName === normalizedTeacherName) {
        throw new ConflictException("Teacher already has another slot in this time range.");
      }
    }
  }

  private async requireStudent(tenantId: string, id: string) {
    const row = await this.prisma.student.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null
      }
    });

    if (!row) {
      throw new NotFoundException("Student not found.");
    }

    return row;
  }

  private async requireAttendance(tenantId: string, id: string) {
    const row = await this.prisma.attendance.findFirst({
      where: {
        id,
        tenantId
      }
    });

    if (!row) {
      throw new NotFoundException("Attendance record not found.");
    }

    return row;
  }

  private async requireTimetableSlot(tenantId: string, id: string) {
    const row = await this.prisma.timetableSlot.findFirst({
      where: {
        id,
        tenantId
      }
    });

    if (!row) {
      throw new NotFoundException("Timetable slot not found.");
    }

    return row;
  }

  private async requireNotification(tenantId: string, id: string) {
    const row = await this.prisma.notification.findFirst({
      where: {
        id,
        tenantId
      }
    });

    if (!row) {
      throw new NotFoundException("Notification not found.");
    }

    return row;
  }

  private normalizeAttendanceStatus(status: string): AttendanceStatus {
    const normalized = status.trim().toUpperCase();
    if (normalized === "ABSENT") return "ABSENT";
    if (normalized === "LATE") return "LATE";
    if (normalized === "EXCUSED") return "EXCUSED";
    return "PRESENT";
  }

  private normalizeJustificationStatus(status: string): AttendanceJustificationStatus {
    const normalized = status.trim().toUpperCase();
    if (normalized === "APPROVED") return "APPROVED";
    if (normalized === "REJECTED") return "REJECTED";
    return "PENDING";
  }

  private requiresAttendanceJustification(status: string): boolean {
    const normalized = this.normalizeAttendanceStatus(status);
    return normalized === "ABSENT" || normalized === "LATE";
  }

  private isAttendanceAlertStatus(status: string): boolean {
    return this.requiresAttendanceJustification(status);
  }

  private validateTimes(startTime: string, endTime: string): void {
    if (this.parseTimeToMinutes(startTime) >= this.parseTimeToMinutes(endTime)) {
      throw new ConflictException("startTime must be earlier than endTime.");
    }
  }

  private timesOverlap(
    leftStart: string,
    leftEnd: string,
    rightStart: string,
    rightEnd: string
  ): boolean {
    const leftStartMinutes = this.parseTimeToMinutes(leftStart);
    const leftEndMinutes = this.parseTimeToMinutes(leftEnd);
    const rightStartMinutes = this.parseTimeToMinutes(rightStart);
    const rightEndMinutes = this.parseTimeToMinutes(rightEnd);

    return leftStartMinutes < rightEndMinutes && rightStartMinutes < leftEndMinutes;
  }

  private parseTimeToMinutes(value: string): number {
    const [hour, minute] = value.split(":").map((item) => Number(item));
    return hour * 60 + minute;
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof NotFoundException || error instanceof ConflictException) {
      return error.message;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return "Duplicate attendance row for this student/date.";
    }

    return "Unexpected error.";
  }

  private attendanceView(row: AttendanceWithRelations): AttendanceView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      studentId: row.studentId,
      classId: row.classId,
      schoolYearId: row.schoolYearId,
      placementId: row.placementId || undefined,
      track: row.track,
      attendanceDate: row.attendanceDate.toISOString().slice(0, 10),
      status: row.status,
      reason: row.reason || undefined,
      justificationStatus: this.normalizeJustificationStatus(row.justificationStatus),
      validationComment: row.validationComment || undefined,
      validatedByUserId: row.validatedByUserId || undefined,
      validatedAt: row.validatedAt?.toISOString(),
      attachments: row.attachments.map((attachment) =>
        this.attendanceAttachmentView(attachment)
      ),
      studentName: `${row.student.firstName} ${row.student.lastName}`.trim(),
      classLabel: row.classroom.label,
      schoolYearCode: row.schoolYear.code
    };
  }

  private attendanceAttachmentView(
    row: AttendanceAttachment
  ): AttendanceAttachmentView {
    return {
      id: row.id,
      attendanceId: row.attendanceId,
      fileName: row.fileName,
      fileUrl: row.fileUrl,
      mimeType: row.mimeType || undefined,
      uploadedByUserId: row.uploadedByUserId || undefined,
      createdAt: row.createdAt.toISOString()
    };
  }

  private timetableSlotView(
    row: Prisma.TimetableSlotGetPayload<{
      include: {
        classroom: true;
        subject: true;
        schoolYear: true;
      };
    }>
  ): TimetableSlotView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      classId: row.classId,
      schoolYearId: row.schoolYearId,
      subjectId: row.subjectId,
      track: row.track,
      rotationGroup: row.rotationGroup || undefined,
      dayOfWeek: row.dayOfWeek,
      startTime: row.startTime,
      endTime: row.endTime,
      room: row.room || undefined,
      teacherName: row.teacherName || undefined,
      classLabel: row.classroom.label,
      subjectLabel: row.subject.label,
      schoolYearCode: row.schoolYear.code
    };
  }

  private notificationView(
    row: Prisma.NotificationGetPayload<{
      include: {
        student: true;
      };
    }>
  ): NotificationView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      studentId: row.studentId || undefined,
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
      studentName: row.student
        ? `${row.student.firstName} ${row.student.lastName}`.trim()
        : undefined
    };
  }
}
