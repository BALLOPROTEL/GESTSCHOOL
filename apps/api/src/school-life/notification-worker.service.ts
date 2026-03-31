import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { BackgroundTasksService } from "../background/background-tasks.service";

@Injectable()
export class NotificationWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationWorkerService.name);
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly backgroundTasks: BackgroundTasksService,
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
      const result = await this.backgroundTasks.runOnce();
      if (result.audit.processedCount > 0 || result.audit.failedCount > 0) {
        this.logger.log(
          `Processed ${result.audit.processedCount} audit outbox event(s), ` +
            `${result.audit.failedCount} failed.`
        );
      }
      if (
        result.notificationRequests.processedCount > 0 ||
        result.notificationRequests.failedCount > 0
      ) {
        this.logger.log(
          `Processed ${result.notificationRequests.processedCount} notification request event(s), ` +
            `${result.notificationRequests.failedCount} failed.`
        );
      }
      if (result.notifications.dispatchedCount > 0) {
        this.logger.log(
          `Dispatched ${result.notifications.dispatchedCount} queued notifications.`
        );
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
