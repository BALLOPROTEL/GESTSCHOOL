import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type OutboxEvent, Prisma } from "@prisma/client";

import { OutboxProcessorService } from "../outbox/outbox.processor.service";
import {
  AUDIT_LOG_REQUESTED,
  type AuditLogRequestedPayload
} from "../outbox/outbox.types";
import { AuditService } from "./audit.service";

@Injectable()
export class AuditOutboxProcessorService {
  constructor(
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    private readonly outboxProcessor: OutboxProcessorService
  ) {}

  async processPendingEvents(limit?: number) {
    return this.outboxProcessor.processPendingEvents({
      claimTtlMs: this.claimTtlMs(),
      eventTypes: [AUDIT_LOG_REQUESTED],
      limit: this.resolveBatchSize(limit),
      maxAttempts: this.maxAttempts(),
      retryDelayMs: (attempt) => this.retryDelayMs(attempt),
      workerId: `audit:${process.pid}`,
      handler: async (event) => this.handleEvent(event)
    });
  }

  private async handleEvent(event: OutboxEvent): Promise<void> {
    const payload = this.asAuditPayload(event.payload);
    await this.auditService.recordLog({
      tenantId: event.tenantId || payload.tenantId,
      userId: payload.userId || undefined,
      action: payload.action,
      resource: payload.resource,
      resourceId: payload.resourceId || undefined,
      payload: payload.payload === null ? undefined : payload.payload
    });
  }

  private asAuditPayload(payload: Prisma.JsonValue): AuditLogRequestedPayload {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Invalid audit payload.");
    }

    const source = payload as Record<string, unknown>;
    const action = source.action;
    const resource = source.resource;
    const tenantId = source.tenantId;

    if (typeof action !== "string" || typeof resource !== "string") {
      throw new Error("Missing audit action or resource.");
    }

    return {
      tenantId: typeof tenantId === "string" ? tenantId : "",
      userId: typeof source.userId === "string" ? source.userId : null,
      action,
      resource,
      resourceId: typeof source.resourceId === "string" ? source.resourceId : null,
      payload: (source.payload as Prisma.InputJsonValue | null | undefined) || null
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
