import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod
} from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AnalyticsModule } from "./analytics/analytics.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { BackgroundModule } from "./background/background.module";
import { DatabaseModule } from "./database/database.module";
import { EnrollmentsModule } from "./enrollments/enrollments.module";
import { FinanceModule } from "./finance/finance.module";
import { GradesModule } from "./grades/grades.module";
import { HealthModule } from "./health/health.module";
import { RedisModule } from "./infrastructure/redis/redis.module";
import { MosqueModule } from "./mosque/mosque.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { ObservabilityModule } from "./observability/observability.module";
import { RequestContextMiddleware } from "./observability/request-context.middleware";
import { OutboxModule } from "./outbox/outbox.module";
import { PortalModule } from "./portal/portal.module";
import { ReferenceModule } from "./reference/reference.module";
import { SecurityModule } from "./security/security.module";
import { TokenModule } from "./security/token.module";
import { SchoolLifeModule } from "./school-life/school-life.module";
import { StorageModule } from "./storage/storage.module";
import { StudentsModule } from "./students/students.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", ".env.example", "../../.env", "../../.env.example"]
    }),
    TokenModule,
    DatabaseModule,
    RedisModule,
    ObservabilityModule,
    OutboxModule,
    AuditModule,
    BackgroundModule,
    NotificationsModule,
    SecurityModule,
    HealthModule,
    AnalyticsModule,
    AuthModule,
    StudentsModule,
    ReferenceModule,
    EnrollmentsModule,
    FinanceModule,
    GradesModule,
    SchoolLifeModule,
    PortalModule,
    StorageModule,
    UsersModule,
    MosqueModule
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes({ path: "*", method: RequestMethod.ALL });
  }
}
