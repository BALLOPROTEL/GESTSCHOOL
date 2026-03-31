import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import { OutboxService } from "../outbox/outbox.service";
import {
  NOTIFICATION_REQUESTED,
  NOTIFICATION_REQUESTED_VERSION,
  type NotificationRequestedEventMetadata,
  type NotificationRequestedEventPayload,
  type PublishNotificationRequestInput
} from "./notification-request.contract";

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

@Injectable()
export class NotificationRequestBusService {
  constructor(
    private readonly outboxService: OutboxService,
    private readonly prisma: PrismaService
  ) {}

  async publish(
    input: PublishNotificationRequestInput,
    client: PrismaClientLike = this.prisma
  ) {
    const requestId = input.requestId?.trim() || randomUUID();
    const eventId = randomUUID();
    const occurredAt = new Date().toISOString();
    const correlationId = input.correlationId?.trim() || requestId;
    const idempotencyKey =
      input.idempotencyKey?.trim() ||
      [
        "notification-request",
        input.source.domain.trim(),
        input.source.referenceType.trim(),
        input.source.referenceId.trim(),
        input.kind,
        input.channel,
        input.recipient.studentId?.trim() || input.recipient.audienceRole?.trim() || "broadcast"
      ].join(":");

    const payload: NotificationRequestedEventPayload = {
      schemaVersion: NOTIFICATION_REQUESTED_VERSION,
      requestId,
      requestedAt: occurredAt,
      kind: input.kind,
      channel: input.channel,
      recipient: {
        audienceRole: input.recipient.audienceRole?.trim() || undefined,
        studentId: input.recipient.studentId?.trim() || undefined,
        targetAddress: input.recipient.targetAddress?.trim() || undefined
      },
      content: {
        templateKey: input.content.templateKey.trim(),
        title: input.content.title.trim(),
        message: input.content.message.trim(),
        variables: input.content.variables || null
      },
      schedule: input.schedule?.scheduledAt
        ? {
            scheduledAt: input.schedule.scheduledAt
          }
        : undefined,
      source: {
        action: input.source.action.trim(),
        domain: input.source.domain.trim(),
        referenceId: input.source.referenceId.trim(),
        referenceType: input.source.referenceType.trim()
      }
    };

    const metadata: NotificationRequestedEventMetadata = {
      schemaVersion: NOTIFICATION_REQUESTED_VERSION,
      eventId,
      tenantId: input.tenantId,
      occurredAt,
      correlationId,
      idempotencyKey,
      producer: input.producer?.trim() || input.source.domain.trim(),
      causationId: input.causationId?.trim() || undefined
    };

    return this.outboxService.publish(
      {
        tenantId: input.tenantId,
        aggregateType: "NotificationRequest",
        aggregateId: requestId,
        eventType: NOTIFICATION_REQUESTED,
        payload,
        metadata,
        dedupeKey: idempotencyKey
      },
      client
    );
  }
}
