import { Injectable } from "@nestjs/common";
import { type OutboxEvent } from "@prisma/client";

import { OutboxService } from "./outbox.service";

export type OutboxProcessingSummary = {
  claimedCount: number;
  processedCount: number;
  failedCount: number;
};

type ProcessPendingOutboxOptions = {
  claimTtlMs: number;
  eventTypes: string[];
  limit: number;
  maxAttempts: number;
  retryDelayMs(attempt: number): number;
  workerId: string;
  handler(event: OutboxEvent): Promise<void>;
};

@Injectable()
export class OutboxProcessorService {
  constructor(private readonly outboxService: OutboxService) {}

  async processPendingEvents(
    options: ProcessPendingOutboxOptions
  ): Promise<OutboxProcessingSummary> {
    const candidates = await this.outboxService.listProcessable(
      options.limit,
      options.claimTtlMs,
      options.eventTypes
    );

    let claimedCount = 0;
    let processedCount = 0;
    let failedCount = 0;

    for (const event of candidates) {
      const claimed = await this.outboxService.claim(
        event.id,
        options.workerId,
        options.claimTtlMs
      );
      if (!claimed) {
        continue;
      }

      claimedCount += 1;
      try {
        await options.handler(event);
        await this.outboxService.markProcessed(event);
        processedCount += 1;
      } catch (error: unknown) {
        await this.outboxService.markFailed(
          event,
          error,
          options.retryDelayMs(event.attempts + 1),
          options.maxAttempts
        );
        failedCount += 1;
      }
    }

    return {
      claimedCount,
      processedCount,
      failedCount
    };
  }
}
