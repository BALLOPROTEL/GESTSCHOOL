import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { SchoolLifeService } from "./school-life.service";

@Injectable()
export class NotificationWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationWorkerService.name);
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly schoolLifeService: SchoolLifeService,
    private readonly configService: ConfigService
  ) {}

  onModuleInit(): void {
    const enabled = this.parseBoolean(
      this.configService.get<string>("NOTIFICATIONS_WORKER_ENABLED", "true")
    );

    if (!enabled) {
      this.logger.log("Background notification worker disabled.");
      return;
    }

    const intervalRaw = Number(
      this.configService.get<string>("NOTIFICATIONS_WORKER_INTERVAL_MS", "15000")
    );
    const intervalMs = Number.isFinite(intervalRaw) && intervalRaw >= 1000 ? intervalRaw : 15000;

    this.timer = setInterval(() => {
      void this.runTick();
    }, intervalMs);
    this.timer.unref?.();

    void this.runTick();
    this.logger.log(`Background notification worker started (${intervalMs}ms).`);
  }

  onModuleDestroy(): void {
    if (!this.timer) {
      return;
    }
    clearInterval(this.timer);
    this.timer = null;
  }

  private async runTick(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    try {
      const batchRaw = Number(
        this.configService.get<string>("NOTIFICATIONS_WORKER_BATCH_SIZE", "80")
      );
      const batchSize = Number.isFinite(batchRaw) && batchRaw > 0 ? batchRaw : 80;
      const result = await this.schoolLifeService.dispatchPendingNotificationsGlobal(batchSize);
      if (result.dispatchedCount > 0) {
        this.logger.log(`Dispatched ${result.dispatchedCount} queued notifications.`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unexpected worker error";
      this.logger.error(message);
    } finally {
      this.isRunning = false;
    }
  }

  private parseBoolean(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    return !(normalized === "0" || normalized === "false" || normalized === "no");
  }
}
