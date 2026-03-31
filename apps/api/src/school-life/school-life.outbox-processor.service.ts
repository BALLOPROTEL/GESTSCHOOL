import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type OutboxEvent, Prisma } from "@prisma/client";

import { OutboxProcessorService } from "../outbox/outbox.processor.service";
import {
  SCHOOL_LIFE_ATTENDANCE_ALERT_REQUESTED,
  type AttendanceAlertRequestedPayload
} from "../outbox/outbox.types";
import { SchoolLifeService } from "./school-life.service";

@Injectable()
export class SchoolLifeOutboxProcessorService {
  private readonly logger = new Logger(SchoolLifeOutboxProcessorService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly outboxProcessor: OutboxProcessorService,
    private readonly schoolLifeService: SchoolLifeService
  ) {}

  async processPendingEvents(limit?: number): Promise<{
    claimedCount: number;
    processedCount: number;
    failedCount: number;
  }> {
    return this.outboxProcessor.processPendingEvents({
      claimTtlMs: this.claimTtlMs(),
      eventTypes: [SCHOOL_LIFE_ATTENDANCE_ALERT_REQUESTED],
      limit: this.resolveBatchSize(limit),
      maxAttempts: this.maxAttempts(),
      retryDelayMs: (attempt) => this.retryDelayMs(attempt),
      workerId: `school-life:${process.pid}`,
      handler: async (event) => {
        try {
          await this.handleEvent(event);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Unexpected outbox error";
          this.logger.warn(`Outbox event ${event.id} failed: ${message}`);
          throw error;
        }
      }
    });
  }

  private async handleEvent(event: OutboxEvent): Promise<void> {
    if (event.eventType === SCHOOL_LIFE_ATTENDANCE_ALERT_REQUESTED) {
      const payload = this.asAttendancePayload(event.payload);
      await this.schoolLifeService.ensureAttendanceAlertNotification(
        event.tenantId || "",
        payload.attendanceId
      );
      return;
    }

    throw new Error(`Unsupported outbox event type ${event.eventType}.`);
  }

  private asAttendancePayload(payload: Prisma.JsonValue): AttendanceAlertRequestedPayload {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Invalid attendance alert payload.");
    }

    const attendanceId = (payload as Record<string, unknown>).attendanceId;
    if (typeof attendanceId !== "string" || attendanceId.trim().length === 0) {
      throw new Error("Missing attendanceId in outbox payload.");
    }

    return { attendanceId };
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
