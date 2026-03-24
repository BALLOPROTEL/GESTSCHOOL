import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";

import { AnalyticsController } from "./analytics/analytics.controller";
import { AnalyticsService } from "./analytics/analytics.service";
import { AuthController } from "./auth/auth.controller";
import { AuthService } from "./auth/auth.service";
import { DevBootstrapUsersService } from "./database/dev-bootstrap-users.service";
import { DatabaseModule } from "./database/database.module";
import { EnrollmentsController } from "./enrollments/enrollments.controller";
import { EnrollmentsService } from "./enrollments/enrollments.service";
import { FinanceController } from "./finance/finance.controller";
import { FinanceService } from "./finance/finance.service";
import { GradesController } from "./grades/grades.controller";
import { GradesService } from "./grades/grades.service";
import { HealthController } from "./health/health.controller";
import { MonitoringController } from "./health/monitoring.controller";
import { PaymentsController } from "./payments/payments.controller";
import { PortalController } from "./portal/portal.controller";
import { PortalService } from "./portal/portal.service";
import { ReferenceController } from "./reference/reference.controller";
import { ReferenceService } from "./reference/reference.service";
import { MosqueController } from "./mosque/mosque.controller";
import { MosqueService } from "./mosque/mosque.service";
import { JwtAuthGuard } from "./security/jwt-auth.guard";
import { RateLimitGuard } from "./security/rate-limit.guard";
import { PermissionsGuard } from "./security/permissions.guard";
import { RolesGuard } from "./security/roles.guard";
import { SchoolLifeController } from "./school-life/school-life.controller";
import { NotificationGatewayService } from "./school-life/notification-gateway.service";
import { NotificationWorkerService } from "./school-life/notification-worker.service";
import { SchoolLifeService } from "./school-life/school-life.service";
import { StorageController } from "./storage/storage.controller";
import { StorageService } from "./storage/storage.service";
import { StudentsController } from "./students/students.controller";
import { StudentsService } from "./students/students.service";
import { UsersController } from "./users/users.controller";
import { UsersService } from "./users/users.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", ".env.example", "../../.env", "../../.env.example"]
    }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        global: true,
        secret: configService.get<string>("JWT_SECRET", "dev-only-secret-change-me")
      })
    }),
    DatabaseModule
  ],
  controllers: [
    HealthController,
    MonitoringController,
    AnalyticsController,
    AuthController,
    StudentsController,
    EnrollmentsController,
    PaymentsController,
    PortalController,
    ReferenceController,
    FinanceController,
    GradesController,
    SchoolLifeController,
    StorageController,
    UsersController,
    MosqueController
  ],
  providers: [
    AuthService,
    AnalyticsService,
    StudentsService,
    ReferenceService,
    EnrollmentsService,
    FinanceService,
    GradesService,
    PortalService,
    NotificationGatewayService,
    SchoolLifeService,
    NotificationWorkerService,
    StorageService,
    UsersService,
    MosqueService,
    DevBootstrapUsersService,
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard
    }
  ]
})
export class AppModule {}
