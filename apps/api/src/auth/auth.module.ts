import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { TokenModule } from "../security/token.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  imports: [AuditModule, TokenModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService]
})
export class AuthModule {}
