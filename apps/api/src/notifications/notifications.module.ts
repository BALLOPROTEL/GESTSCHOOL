import { Module } from "@nestjs/common";

import { OutboxModule } from "../outbox/outbox.module";
import { NotificationGatewayService } from "./notification-gateway.service";
import { NotificationRequestBusService } from "./notification-request-bus.service";
import { NotificationRequestProcessorService } from "./notification-request-processor.service";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [OutboxModule],
  providers: [
    NotificationGatewayService,
    NotificationRequestBusService,
    NotificationRequestProcessorService,
    NotificationsService
  ],
  exports: [
    NotificationGatewayService,
    NotificationRequestBusService,
    NotificationRequestProcessorService,
    NotificationsService
  ]
})
export class NotificationsModule {}
