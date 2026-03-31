import { Module } from "@nestjs/common";

import { GradesModule } from "../grades/grades.module";
import { SchoolLifeModule } from "../school-life/school-life.module";
import { PortalController } from "./portal.controller";
import { PortalService } from "./portal.service";

@Module({
  imports: [GradesModule, SchoolLifeModule],
  controllers: [PortalController],
  providers: [PortalService]
})
export class PortalModule {}
