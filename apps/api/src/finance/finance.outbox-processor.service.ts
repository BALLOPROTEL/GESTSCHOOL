import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type OutboxEvent, Prisma } from "@prisma/client";

import { OutboxProcessorService } from "../outbox/outbox.processor.service";
import {
  FINANCE_PAYMENT_RECORDED,
  type FinancePaymentRecordedPayload
} from "../outbox/outbox.types";
import { SchoolLifeService } from "../school-life/school-life.service";

@Injectable()
export class FinanceOutboxProcessorService {
  constructor(
    private readonly configService: ConfigService,
    private readonly outboxProcessor: OutboxProcessorService,
    private readonly schoolLifeService: SchoolLifeService
  ) {}

  async processPendingEvents(limit?: number) {
    return this.outboxProcessor.processPendingEvents({
      claimTtlMs: this.claimTtlMs(),
      eventTypes: [FINANCE_PAYMENT_RECORDED],
      limit: this.resolveBatchSize(limit),
      maxAttempts: this.maxAttempts(),
      retryDelayMs: (attempt) => this.retryDelayMs(attempt),
      workerId: `finance:${process.pid}`,
      handler: async (event) => this.handleEvent(event)
    });
  }

  private async handleEvent(event: OutboxEvent): Promise<void> {
    const payload = this.asPaymentPayload(event.payload);
    await this.schoolLifeService.ensurePaymentReceivedNotification({
      tenantId: event.tenantId || "",
      invoiceNo: payload.invoiceNo,
      paidAmount: payload.paidAmount,
      paidAt: payload.paidAt,
      receiptNo: payload.receiptNo,
      studentId: payload.studentId,
      studentName: payload.studentName
    });
  }

  private asPaymentPayload(payload: Prisma.JsonValue): FinancePaymentRecordedPayload {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Invalid finance payment payload.");
    }

    const source = payload as Record<string, unknown>;
    const paymentId = source.paymentId;
    const invoiceId = source.invoiceId;
    const invoiceNo = source.invoiceNo;
    const paidAmount = source.paidAmount;
    const paidAt = source.paidAt;
    const paymentMethod = source.paymentMethod;
    const receiptNo = source.receiptNo;

    if (typeof paymentId !== "string" || paymentId.trim().length === 0) {
      throw new Error("Missing paymentId in finance outbox payload.");
    }
    if (typeof invoiceId !== "string" || invoiceId.trim().length === 0) {
      throw new Error("Missing invoiceId in finance outbox payload.");
    }
    if (typeof invoiceNo !== "string" || invoiceNo.trim().length === 0) {
      throw new Error("Missing invoiceNo in finance outbox payload.");
    }
    if (typeof paidAmount !== "number" || !Number.isFinite(paidAmount) || paidAmount <= 0) {
      throw new Error("Invalid paidAmount in finance outbox payload.");
    }
    if (typeof paidAt !== "string" || paidAt.trim().length === 0) {
      throw new Error("Missing paidAt in finance outbox payload.");
    }
    if (typeof paymentMethod !== "string" || paymentMethod.trim().length === 0) {
      throw new Error("Missing paymentMethod in finance outbox payload.");
    }
    if (typeof receiptNo !== "string" || receiptNo.trim().length === 0) {
      throw new Error("Missing receiptNo in finance outbox payload.");
    }

    return {
      paymentId,
      invoiceId,
      invoiceNo,
      paidAmount,
      paidAt,
      paymentMethod,
      receiptNo,
      studentId: typeof source.studentId === "string" ? source.studentId : undefined,
      studentName: typeof source.studentName === "string" ? source.studentName : undefined
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
