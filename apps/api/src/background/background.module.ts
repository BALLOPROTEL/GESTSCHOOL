import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { BackgroundTasksService } from "./background-tasks.service";

@Module({
  imports: [AuditModule, NotificationsModule],
  providers: [BackgroundTasksService],
  exports: [BackgroundTasksService]
})
export class BackgroundModule {}
