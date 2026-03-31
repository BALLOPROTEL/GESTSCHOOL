import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AuditOutboxProcessorService } from "../audit/audit.outbox-processor.service";
import { NotificationRequestProcessorService } from "../notifications/notification-request-processor.service";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class BackgroundTasksService {
  constructor(
    private readonly auditOutboxProcessor: AuditOutboxProcessorService,
    private readonly configService: ConfigService,
    private readonly notificationRequestProcessor: NotificationRequestProcessorService,
    private readonly notificationsService: NotificationsService
  ) {}

  async runOnce(): Promise<{
    audit: Awaited<ReturnType<AuditOutboxProcessorService["processPendingEvents"]>>;
    notifications: Awaited<ReturnType<NotificationsService["dispatchPendingNotificationsGlobal"]>>;
    notificationRequests: Awaited<
      ReturnType<NotificationRequestProcessorService["processPendingEvents"]>
    >;
  }> {
    const audit = await this.auditOutboxProcessor.processPendingEvents();
    const notificationRequests = await this.notificationRequestProcessor.processPendingEvents();
    const notifications = await this.notificationsService.dispatchPendingNotificationsGlobal(
      this.notificationBatchSize()
    );

    return {
      audit,
      notifications,
      notificationRequests
    };
  }

  private notificationBatchSize(): number {
    const raw = Number(this.configService.get<string>("NOTIFICATIONS_WORKER_BATCH_SIZE", "80"));
    return Number.isFinite(raw) && raw > 0 ? raw : 80;
  }
}
