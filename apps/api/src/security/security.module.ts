import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { JwtAuthGuard } from "./jwt-auth.guard";
import { PermissionsGuard } from "./permissions.guard";
import { RateLimitGuard } from "./rate-limit.guard";
import { RolesGuard } from "./roles.guard";
import { TokenModule } from "./token.module";

@Module({
  imports: [TokenModule],
  providers: [
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
export class SecurityModule {}
