import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { BackgroundModule } from "./background/background.module";
import { DatabaseModule } from "./database/database.module";
import { RedisModule } from "./infrastructure/redis/redis.module";
import { ObservabilityModule } from "./observability/observability.module";
import { NotificationWorkerService } from "./school-life/notification-worker.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", ".env.example", "../../.env", "../../.env.example"]
    }),
    DatabaseModule,
    RedisModule,
    ObservabilityModule,
    BackgroundModule
  ],
  providers: [NotificationWorkerService]
})
export class WorkerModule {}
