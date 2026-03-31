import { Injectable, Logger } from "@nestjs/common";
import { Prisma, type OutboxEvent } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import { type OutboxPublishInput } from "./outbox.types";

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  async publish(
    input: OutboxPublishInput,
    client: PrismaClientLike = this.prisma
  ): Promise<OutboxEvent | null> {
    try {
      return await client.outboxEvent.create({
        data: {
          tenantId: input.tenantId || null,
          aggregateType: input.aggregateType,
          aggregateId: input.aggregateId,
          eventType: input.eventType,
          payload: input.payload,
          metadata: input.metadata,
          dedupeKey: input.dedupeKey || null,
          status: "PENDING",
          availableAt: new Date(),
          updatedAt: new Date()
        }
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        input.dedupeKey
      ) {
        this.logger.debug(`Skipped duplicate outbox event ${input.dedupeKey}.`);
        return null;
      }
      throw error;
    }
  }

  async listProcessable(
    limit: number,
    claimTtlMs: number,
    eventTypes?: string[]
  ): Promise<OutboxEvent[]> {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - claimTtlMs);

    return this.prisma.outboxEvent.findMany({
      where: {
        eventType:
          eventTypes && eventTypes.length > 0
            ? {
                in: eventTypes
              }
            : undefined,
        availableAt: {
          lte: now
        },
        OR: [
          { status: "PENDING" },
          {
            status: "PROCESSING",
            claimedAt: {
              lte: staleBefore
            }
          }
        ]
      },
      orderBy: [{ createdAt: "asc" }],
      take: Math.max(1, Math.min(limit, 500))
    });
  }

  async claim(id: string, workerId: string, claimTtlMs: number): Promise<boolean> {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - claimTtlMs);
    const result = await this.prisma.outboxEvent.updateMany({
      where: {
        id,
        OR: [
          { status: "PENDING" },
          {
            status: "PROCESSING",
            claimedAt: {
              lte: staleBefore
            }
          }
        ]
      },
      data: {
        status: "PROCESSING",
        claimedAt: now,
        claimedBy: workerId,
        updatedAt: now
      }
    });

    return result.count === 1;
  }

  async markProcessed(event: Pick<OutboxEvent, "id" | "attempts">): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: "PROCESSED",
        attempts: event.attempts + 1,
        claimedAt: null,
        claimedBy: null,
        processedAt: new Date(),
        lastError: null,
        updatedAt: new Date()
      }
    });
  }

  async markFailed(
    event: Pick<OutboxEvent, "id" | "attempts">,
    error: unknown,
    nextDelayMs: number,
    maxAttempts: number
  ): Promise<void> {
    const attempts = event.attempts + 1;
    const permanent = attempts >= maxAttempts;
    const message = this.toErrorMessage(error);

    await this.prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: permanent ? "FAILED" : "PENDING",
        attempts,
        claimedAt: null,
        claimedBy: null,
        availableAt: permanent ? new Date() : new Date(Date.now() + nextDelayMs),
        lastError: message,
        updatedAt: new Date()
      }
    });
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message.slice(0, 1000);
    }
    return "Unexpected outbox processing error.";
  }
}
