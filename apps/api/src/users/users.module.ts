import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { DevBootstrapUsersService } from "../database/dev-bootstrap-users.service";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [AuditModule],
  controllers: [UsersController],
  providers: [UsersService, DevBootstrapUsersService],
  exports: [UsersService]
})
export class UsersModule {}
