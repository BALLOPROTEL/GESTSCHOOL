import { randomUUID } from "node:crypto";

import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, type Notification, type NotificationDeliveryAttempt } from "@prisma/client";

import {
  CreateNotificationDto,
  NotificationDeliveryEventDto,
  UpdateNotificationStatusDto
} from "../school-life/dto/school-life.dto";
import {
  type DeliveryStatus,
  NotificationGatewayService,
  type NotificationChannel
} from "./notification-gateway.service";
import {
  type NotificationRequestedEvent,
  NOTIFICATION_REQUESTED_VERSION,
  type NotificationRequestedEventMetadata,
  type NotificationRequestedEventPayload
} from "./notification-request.contract";
import { PrismaService } from "../database/prisma.service";

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
  requestId?: string;
  correlationId?: string;
  idempotencyKey?: string;
  sourceDomain?: string;
  sourceAction?: string;
  templateKey?: string;
};

type NotificationWithStudent = Prisma.NotificationGetPayload<{
  include: {
    student: true;
  };
}>;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly notificationGateway: NotificationGatewayService,
    private readonly prisma: PrismaService
  ) {}

  async materializeRequestedNotification(
    tenantId: string,
    payload: NotificationRequestedEventPayload,
    metadata: NotificationRequestedEventMetadata
  ): Promise<NotificationView> {
    if (!tenantId) {
      throw new Error("notification.requested event must include a tenantId.");
    }

    const existing = await this.prisma.notification.findFirst({
      where: {
        tenantId,
        OR: [
          { requestId: payload.requestId },
          { idempotencyKey: metadata.idempotencyKey }
        ]
      },
      include: {
        student: true
      }
    });

    if (existing) {
      return this.notificationView(existing);
    }

    try {
      const requestEnvelope: NotificationRequestedEvent = {
        payload,
        metadata
      };

      const created = await this.prisma.notification.create({
        data: {
          tenantId,
          studentId: payload.recipient.studentId,
          audienceRole: payload.recipient.audienceRole,
          title: payload.content.title,
          message: payload.content.message,
          channel: payload.channel,
          status: payload.schedule?.scheduledAt ? "SCHEDULED" : "PENDING",
          targetAddress: payload.recipient.targetAddress,
          provider: payload.channel === "IN_APP" ? "IN_APP" : null,
          providerMessageId: null,
          deliveryStatus: "QUEUED",
          attempts: 0,
          lastError: null,
          nextAttemptAt: null,
          deliveredAt: null,
          scheduledAt: payload.schedule?.scheduledAt ? new Date(payload.schedule.scheduledAt) : null,
          requestId: payload.requestId,
          correlationId: metadata.correlationId,
          idempotencyKey: metadata.idempotencyKey,
          schemaVersion: payload.schemaVersion,
          sourceDomain: payload.source.domain,
          sourceAction: payload.source.action,
          sourceReferenceType: payload.source.referenceType,
          sourceReferenceId: payload.source.referenceId,
          templateKey: payload.content.templateKey,
          requestPayload: requestEnvelope as unknown as Prisma.InputJsonValue,
          updatedAt: new Date()
        },
        include: {
          student: true
        }
      });

      return this.notificationView(created);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const duplicate = await this.prisma.notification.findFirst({
          where: {
            tenantId,
            OR: [
              { requestId: payload.requestId },
              { idempotencyKey: metadata.idempotencyKey }
            ]
          },
          include: {
            student: true
          }
        });
        if (duplicate) {
          return this.notificationView(duplicate);
        }
      }
      throw error;
    }
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
    const rows = await this.prisma.notification.findMany({
      where: {
        tenantId,
        status: filters.status,
        channel: filters.channel,
        audienceRole: filters.audienceRole,
        studentId: filters.studentId,
        deliveryStatus: filters.deliveryStatus,
        provider: filters.provider
      },
      include: {
        student: true
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return rows.map((row) => this.notificationView(row));
  }

  async createNotification(
    tenantId: string,
    payload: CreateNotificationDto
  ): Promise<NotificationView> {
    if (payload.studentId) {
      await this.requireStudent(tenantId, payload.studentId);
    }

    const requestId = randomUUID();
    const now = new Date();
    const occurredAt = now.toISOString();
    const channel = payload.channel || "IN_APP";
    const targetAddress = payload.targetAddress?.trim() || null;
    const status = payload.scheduledAt ? "SCHEDULED" : "PENDING";
    const requestEnvelope: NotificationRequestedEvent = {
      payload: {
        schemaVersion: NOTIFICATION_REQUESTED_VERSION,
        requestId,
        requestedAt: occurredAt,
        kind: "MANUAL",
        channel,
        recipient: {
          audienceRole: payload.audienceRole || undefined,
          studentId: payload.studentId || undefined,
          targetAddress: targetAddress || undefined
        },
        content: {
          templateKey: "manual",
          title: payload.title.trim(),
          message: payload.message.trim(),
          variables: null
        },
        schedule: payload.scheduledAt ? { scheduledAt: payload.scheduledAt } : undefined,
        source: {
          domain: "notifications",
          action: "manual.create",
          referenceType: "notification",
          referenceId: requestId
        }
      },
      metadata: {
        schemaVersion: NOTIFICATION_REQUESTED_VERSION,
        eventId: requestId,
        tenantId,
        occurredAt,
        correlationId: requestId,
        idempotencyKey: `manual:${tenantId}:${requestId}`,
        producer: "notifications"
      }
    };

    const created = await this.prisma.notification.create({
      data: {
        tenantId,
        studentId: payload.studentId,
        audienceRole: payload.audienceRole,
        title: payload.title.trim(),
        message: payload.message.trim(),
        channel,
        status,
        targetAddress,
        provider: channel === "IN_APP" ? "IN_APP" : null,
        providerMessageId: null,
        deliveryStatus: "QUEUED",
        attempts: 0,
        lastError: null,
        nextAttemptAt: null,
        deliveredAt: null,
        scheduledAt: payload.scheduledAt ? new Date(payload.scheduledAt) : null,
        requestId,
        correlationId: requestId,
        idempotencyKey: `manual:${tenantId}:${requestId}`,
        schemaVersion: NOTIFICATION_REQUESTED_VERSION,
        sourceDomain: "notifications",
        sourceAction: "manual.create",
        sourceReferenceType: "notification",
        sourceReferenceId: requestId,
        templateKey: "manual",
        requestPayload: requestEnvelope as unknown as Prisma.InputJsonValue,
        updatedAt: now
      },
      include: {
        student: true
      }
    });

    return this.notificationView(created);
  }

  async dispatchPendingNotifications(
    tenantId: string,
    limit?: number
  ): Promise<{ dispatchedCount: number; notifications: NotificationView[] }> {
    return this.dispatchNotifications({ tenantId }, limit);
  }

  async dispatchPendingNotificationsGlobal(
    limit?: number
  ): Promise<{ dispatchedCount: number; notifications: NotificationView[] }> {
    return this.dispatchNotifications({}, limit);
  }

  async recordDeliveryEvent(payload: NotificationDeliveryEventDto): Promise<NotificationView> {
    const where: Prisma.NotificationWhereInput = {
      providerMessageId: payload.providerMessageId.trim(),
      provider: payload.provider?.trim() || undefined
    };

    const existing = await this.prisma.notification.findFirst({
      where,
      include: {
        student: true
      }
    });

    if (!existing) {
      throw new NotFoundException("Notification not found for provider event.");
    }

    const eventTime = payload.occurredAt ? new Date(payload.occurredAt) : new Date();
    const status = payload.status.trim().toUpperCase();
    const normalizedStatus = this.normalizeDeliveryStatus(status);
    const callbackStored = await this.persistProviderCallback(
      existing,
      payload,
      normalizedStatus,
      eventTime
    );

    if (!callbackStored) {
      const current = await this.prisma.notification.findFirst({
        where: { id: existing.id },
        include: { student: true }
      });
      if (!current) {
        throw new NotFoundException("Notification not found for duplicate provider event.");
      }
      return this.notificationView(current);
    }

    const updated = await this.prisma.notification.update({
      where: { id: existing.id },
      data: {
        status:
          normalizedStatus === "FAILED" || normalizedStatus === "UNDELIVERABLE"
            ? "FAILED"
            : "SENT",
        deliveryStatus: normalizedStatus,
        sentAt: existing.sentAt || eventTime,
        deliveredAt: normalizedStatus === "DELIVERED" ? eventTime : existing.deliveredAt,
        lastError:
          normalizedStatus === "FAILED" || normalizedStatus === "UNDELIVERABLE"
            ? payload.errorMessage?.trim() || existing.lastError
            : null,
        nextAttemptAt: null,
        updatedAt: eventTime
      },
      include: {
        student: true
      }
    });

    await this.prisma.notificationDeliveryAttempt.updateMany({
      where: {
        notificationId: existing.id,
        providerMessageId: existing.providerMessageId || payload.providerMessageId.trim()
      },
      data: {
        status: normalizedStatus,
        errorMessage:
          normalizedStatus === "FAILED" || normalizedStatus === "UNDELIVERABLE"
            ? payload.errorMessage?.trim() || updated.lastError
            : null,
        finishedAt: eventTime,
        updatedAt: eventTime
      }
    });

    return this.notificationView(updated);
  }

  async updateNotificationStatus(
    tenantId: string,
    id: string,
    payload: UpdateNotificationStatusDto
  ): Promise<NotificationView> {
    const existing = await this.requireNotification(tenantId, id);

    const sentAt =
      payload.status === "SENT"
        ? payload.sentAt
          ? new Date(payload.sentAt)
          : new Date()
        : payload.status === "PENDING" || payload.status === "SCHEDULED"
          ? null
          : payload.sentAt
            ? new Date(payload.sentAt)
            : existing.sentAt;

    const normalizedDeliveryStatus =
      payload.status === "SENT" ? "DELIVERED" : payload.status === "FAILED" ? "FAILED" : "QUEUED";

    const updated = await this.prisma.notification.update({
      where: { id: existing.id },
      data: {
        status: payload.status,
        deliveryStatus: normalizedDeliveryStatus,
        deliveredAt: payload.status === "SENT" ? sentAt : null,
        nextAttemptAt: null,
        lastError: payload.status === "FAILED" ? existing.lastError : null,
        sentAt,
        updatedAt: new Date()
      },
      include: {
        student: true
      }
    });

    return this.notificationView(updated);
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

  private async dispatchSingleNotification(row: NotificationWithStudent): Promise<NotificationView> {
    const now = new Date();
    const channel = this.normalizeNotificationChannel(row.channel);
    const nextAttempt = row.attempts + 1;
    const attempt = await this.startDeliveryAttempt(row, channel, nextAttempt, now);

    let resolvedTargetAddress: string | null = null;
    try {
      resolvedTargetAddress = await this.resolveNotificationTargetAddress(row, channel);
      const dispatchResult = await this.notificationGateway.dispatch({
        notificationId: row.id,
        tenantId: row.tenantId,
        channel,
        title: row.title,
        message: row.message,
        targetAddress: resolvedTargetAddress || undefined
      });

      const updated = await this.prisma.notification.update({
        where: { id: row.id },
        data: {
          status: "SENT",
          sentAt: now,
          targetAddress: resolvedTargetAddress || row.targetAddress,
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

      await this.finishDeliveryAttempt(attempt, {
        finishedAt: now,
        provider: dispatchResult.provider,
        providerMessageId: dispatchResult.providerMessageId,
        status: dispatchResult.deliveryStatus,
        targetAddress: resolvedTargetAddress || row.targetAddress || undefined
      });

      return this.notificationView(updated);
    } catch (error: unknown) {
      const maxAttempts = this.notificationMaxAttempts();
      const canRetry = channel !== "IN_APP" && nextAttempt < maxAttempts;
      const retryDelayMinutes = this.notificationRetryDelayMinutes(nextAttempt);
      const nextAttemptAt = canRetry
        ? new Date(now.getTime() + retryDelayMinutes * 60 * 1000)
        : null;
      const errorMessage = this.extractDispatchErrorMessage(error);

      const updated = await this.prisma.notification.update({
        where: { id: row.id },
        data: {
          status: canRetry ? "PENDING" : "FAILED",
          deliveryStatus: canRetry ? "RETRYING" : "FAILED",
          attempts: nextAttempt,
          nextAttemptAt,
          lastError: errorMessage,
          provider: row.provider || this.defaultProviderName(channel),
          updatedAt: now
        },
        include: {
          student: true
        }
      });

      await this.finishDeliveryAttempt(attempt, {
        finishedAt: now,
        provider: updated.provider || undefined,
        providerMessageId: updated.providerMessageId || undefined,
        status: canRetry ? "RETRYING" : "FAILED",
        targetAddress: resolvedTargetAddress || row.targetAddress || undefined,
        errorMessage
      });

      return this.notificationView(updated);
    }
  }

  private async startDeliveryAttempt(
    row: NotificationWithStudent,
    channel: NotificationChannel,
    attemptNo: number,
    startedAt: Date
  ): Promise<NotificationDeliveryAttempt> {
    return this.prisma.notificationDeliveryAttempt.create({
      data: {
        tenantId: row.tenantId,
        notificationId: row.id,
        attemptNo,
        channel,
        provider: row.provider || this.defaultProviderName(channel),
        targetAddress: row.targetAddress || null,
        providerMessageId: row.providerMessageId || null,
        status: "PROCESSING",
        errorMessage: null,
        startedAt,
        finishedAt: null,
        updatedAt: startedAt
      }
    });
  }

  private async finishDeliveryAttempt(
    attempt: Pick<NotificationDeliveryAttempt, "id">,
    result: {
      finishedAt: Date;
      provider?: string;
      providerMessageId?: string;
      status: string;
      targetAddress?: string;
      errorMessage?: string;
    }
  ): Promise<void> {
    await this.prisma.notificationDeliveryAttempt.update({
      where: { id: attempt.id },
      data: {
        provider: result.provider || null,
        providerMessageId: result.providerMessageId || null,
        targetAddress: result.targetAddress || null,
        status: result.status,
        errorMessage: result.errorMessage || null,
        finishedAt: result.finishedAt,
        updatedAt: result.finishedAt
      }
    });
  }

  private async persistProviderCallback(
    notification: Pick<Notification, "id" | "tenantId" | "provider" | "providerMessageId">,
    payload: NotificationDeliveryEventDto,
    normalizedStatus: DeliveryStatus,
    occurredAt: Date
  ): Promise<boolean> {
    const provider = payload.provider?.trim() || notification.provider || "UNKNOWN";
    const providerMessageId =
      notification.providerMessageId || payload.providerMessageId.trim();
    const dedupeKey = payload.occurredAt?.trim()
      ? [provider, providerMessageId, normalizedStatus, occurredAt.toISOString()].join(":")
      : [provider, providerMessageId, normalizedStatus].join(":");

    try {
      await this.prisma.notificationProviderCallback.create({
        data: {
          tenantId: notification.tenantId,
          notificationId: notification.id,
          provider,
          providerMessageId,
          eventStatus: normalizedStatus,
          dedupeKey,
          occurredAt,
          errorMessage: payload.errorMessage?.trim() || null,
          payload: payload as unknown as Prisma.InputJsonValue,
          updatedAt: occurredAt
        }
      });
      return true;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return false;
      }
      throw error;
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

  private notificationView(row: NotificationWithStudent): NotificationView {
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
        : undefined,
      requestId: row.requestId || undefined,
      correlationId: row.correlationId || undefined,
      idempotencyKey: row.idempotencyKey || undefined,
      sourceDomain: row.sourceDomain || undefined,
      sourceAction: row.sourceAction || undefined,
      templateKey: row.templateKey || undefined
    };
  }
}
