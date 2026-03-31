import { Module } from "@nestjs/common";

import { HealthController } from "./health.controller";
import { MonitoringController } from "./monitoring.controller";

@Module({
  controllers: [HealthController, MonitoringController]
})
export class HealthModule {}
