import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type OutboxEvent, Prisma } from "@prisma/client";

import { OutboxProcessorService } from "../outbox/outbox.processor.service";
import {
  NOTIFICATION_REQUESTED,
  NOTIFICATION_REQUESTED_VERSION,
  type NotificationRequestedEventMetadata,
  type NotificationRequestedEventPayload
} from "./notification-request.contract";
import { NotificationsService } from "./notifications.service";

@Injectable()
export class NotificationRequestProcessorService {
  constructor(
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly outboxProcessor: OutboxProcessorService
  ) {}

  async processPendingEvents(limit?: number) {
    return this.outboxProcessor.processPendingEvents({
      claimTtlMs: this.claimTtlMs(),
      eventTypes: [NOTIFICATION_REQUESTED],
      limit: this.resolveBatchSize(limit),
      maxAttempts: this.maxAttempts(),
      retryDelayMs: (attempt) => this.retryDelayMs(attempt),
      workerId: `notifications:${process.pid}`,
      handler: async (event) => this.handleEvent(event)
    });
  }

  private async handleEvent(event: OutboxEvent): Promise<void> {
    const payload = this.asPayload(event.payload);
    const metadata = this.asMetadata(event.metadata);
    await this.notificationsService.materializeRequestedNotification(
      metadata.tenantId || event.tenantId || "",
      payload,
      metadata
    );
  }

  private asPayload(payload: Prisma.JsonValue): NotificationRequestedEventPayload {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Invalid notification.requested payload.");
    }

    const source = payload as Record<string, unknown>;
    const schemaVersion = source.schemaVersion;
    const requestId = source.requestId;
    const requestedAt = source.requestedAt;
    const kind = source.kind;
    const channel = source.channel;
    const recipient = source.recipient;
    const content = source.content;
    const schedule = source.schedule;
    const eventSource = source.source;

    if (schemaVersion !== NOTIFICATION_REQUESTED_VERSION) {
      throw new Error(`Unsupported notification schema version ${String(schemaVersion)}.`);
    }
    if (typeof requestId !== "string" || requestId.trim().length === 0) {
      throw new Error("Missing requestId in notification.requested payload.");
    }
    if (typeof requestedAt !== "string" || requestedAt.trim().length === 0) {
      throw new Error("Missing requestedAt in notification.requested payload.");
    }
    if (
      kind !== "ATTENDANCE_ALERT" &&
      kind !== "MANUAL" &&
      kind !== "PAYMENT_RECEIVED"
    ) {
      throw new Error("Unsupported notification kind.");
    }
    if (channel !== "EMAIL" && channel !== "IN_APP" && channel !== "SMS") {
      throw new Error("Unsupported notification channel.");
    }
    if (!recipient || typeof recipient !== "object" || Array.isArray(recipient)) {
      throw new Error("Missing notification recipient.");
    }
    if (!content || typeof content !== "object" || Array.isArray(content)) {
      throw new Error("Missing notification content.");
    }
    if (!eventSource || typeof eventSource !== "object" || Array.isArray(eventSource)) {
      throw new Error("Missing notification source.");
    }

    const recipientValue = recipient as Record<string, unknown>;
    const contentValue = content as Record<string, unknown>;
    const sourceValue = eventSource as Record<string, unknown>;
    const scheduleValue =
      schedule && typeof schedule === "object" && !Array.isArray(schedule)
        ? (schedule as Record<string, unknown>)
        : null;

    if (
      typeof contentValue.templateKey !== "string" ||
      typeof contentValue.title !== "string" ||
      typeof contentValue.message !== "string"
    ) {
      throw new Error("Invalid notification content payload.");
    }
    if (
      typeof sourceValue.domain !== "string" ||
      typeof sourceValue.action !== "string" ||
      typeof sourceValue.referenceType !== "string" ||
      typeof sourceValue.referenceId !== "string"
    ) {
      throw new Error("Invalid notification source payload.");
    }

    return {
      schemaVersion: NOTIFICATION_REQUESTED_VERSION,
      requestId,
      requestedAt,
      kind,
      channel,
      recipient: {
        audienceRole:
          typeof recipientValue.audienceRole === "string"
            ? recipientValue.audienceRole
            : undefined,
        studentId:
          typeof recipientValue.studentId === "string" ? recipientValue.studentId : undefined,
        targetAddress:
          typeof recipientValue.targetAddress === "string"
            ? recipientValue.targetAddress
            : undefined
      },
      content: {
        templateKey: contentValue.templateKey,
        title: contentValue.title,
        message: contentValue.message,
        variables:
          (contentValue.variables as Prisma.InputJsonValue | null | undefined) || null
      },
      schedule: scheduleValue
        ? {
            scheduledAt:
              typeof scheduleValue.scheduledAt === "string" ? scheduleValue.scheduledAt : null
          }
        : undefined,
      source: {
        domain: sourceValue.domain,
        action: sourceValue.action,
        referenceType: sourceValue.referenceType,
        referenceId: sourceValue.referenceId
      }
    };
  }

  private asMetadata(payload: Prisma.JsonValue | null): NotificationRequestedEventMetadata {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Invalid notification.requested metadata.");
    }

    const source = payload as Record<string, unknown>;
    const schemaVersion = source.schemaVersion;
    const eventId = source.eventId;
    const tenantId = source.tenantId;
    const occurredAt = source.occurredAt;
    const correlationId = source.correlationId;
    const idempotencyKey = source.idempotencyKey;
    const producer = source.producer;

    if (
      schemaVersion !== NOTIFICATION_REQUESTED_VERSION ||
      typeof eventId !== "string" ||
      eventId.trim().length === 0 ||
      typeof tenantId !== "string" ||
      tenantId.trim().length === 0 ||
      typeof occurredAt !== "string" ||
      occurredAt.trim().length === 0 ||
      typeof correlationId !== "string" ||
      correlationId.trim().length === 0 ||
      typeof idempotencyKey !== "string" ||
      idempotencyKey.trim().length === 0 ||
      typeof producer !== "string" ||
      producer.trim().length === 0
    ) {
      throw new Error("Invalid notification.requested metadata payload.");
    }

    return {
      schemaVersion: NOTIFICATION_REQUESTED_VERSION,
      eventId,
      tenantId,
      occurredAt,
      correlationId,
      idempotencyKey,
      producer,
      causationId: typeof source.causationId === "string" ? source.causationId : undefined
    };
  }

  private resolveBatchSize(limit?: number): number {
    const configured = Number(this.configService.get<string>("OUTBOX_WORKER_BATCH_SIZE", "80"));
    const base = Number.isFinite(configured) && configured > 0 ? configured : 80;
    return Math.max(1, Math.min(limit ?? base, 500));
  }

  private claimTtlMs(): number {
    const raw = Number(this.configService.get<string>("OUTBOX_CLAIM_TTL_SECONDS", "120"));
    const seconds = Number.isFinite(raw) && raw > 0 ? raw : 120;
    return seconds * 1000;
  }

  private maxAttempts(): number {
    const raw = Number(this.configService.get<string>("OUTBOX_MAX_ATTEMPTS", "6"));
    return Number.isFinite(raw) && raw > 0 ? raw : 6;
  }

  private retryDelayMs(attempt: number): number {
    const raw = Number(this.configService.get<string>("OUTBOX_RETRY_BASE_SECONDS", "15"));
    const baseSeconds = Number.isFinite(raw) && raw > 0 ? raw : 15;
    return Math.min(baseSeconds * Math.max(1, attempt) * 1000, 10 * 60 * 1000);
  }
}
