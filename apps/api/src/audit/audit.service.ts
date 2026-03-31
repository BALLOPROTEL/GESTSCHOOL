import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import { OutboxService } from "../outbox/outbox.service";
import {
  AUDIT_LOG_REQUESTED,
  type AuditLogRequestedPayload
} from "../outbox/outbox.types";

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

export type AuditLogRequest = {
  action: string;
  payload?: Prisma.InputJsonValue;
  resource: string;
  resourceId?: string;
  tenantId: string;
  userId?: string;
};

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxService: OutboxService
  ) {}

  async enqueueLog(
    input: AuditLogRequest,
    client: PrismaClientLike = this.prisma
  ): Promise<void> {
    const payload: AuditLogRequestedPayload = {
      tenantId: input.tenantId,
      userId: input.userId || null,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId || null,
      payload: input.payload || null
    };

    await this.outboxService.publish(
      {
        tenantId: input.tenantId,
        aggregateType: "IamAuditLog",
        aggregateId: input.resourceId || input.userId || randomUUID(),
        eventType: AUDIT_LOG_REQUESTED,
        payload
      },
      client
    );
  }

  async recordLog(
    input: AuditLogRequest,
    client: PrismaClientLike = this.prisma
  ): Promise<void> {
    await client.iamAuditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId || null,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId || null,
        payload: input.payload
      }
    });
  }
}
