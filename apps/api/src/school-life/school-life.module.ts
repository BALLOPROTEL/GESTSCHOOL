import { Module } from "@nestjs/common";

import { AcademicStructureModule } from "../academic-structure/academic-structure.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ReferenceModule } from "../reference/reference.module";
import { NotificationGatewayService } from "./notification-gateway.service";
import { SchoolLifeController } from "./school-life.controller";
import { SchoolLifeService } from "./school-life.service";

@Module({
  imports: [AcademicStructureModule, NotificationsModule, ReferenceModule],
  controllers: [SchoolLifeController],
  providers: [NotificationGatewayService, SchoolLifeService],
  exports: [NotificationGatewayService, SchoolLifeService]
})
export class SchoolLifeModule {}
