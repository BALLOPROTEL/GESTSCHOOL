import { Module } from "@nestjs/common";

import { AcademicStructureModule } from "../academic-structure/academic-structure.module";
import { GradesModule } from "../grades/grades.module";
import { SchoolLifeModule } from "../school-life/school-life.module";
import { PortalController } from "./portal.controller";
import { PortalService } from "./portal.service";

@Module({
  imports: [AcademicStructureModule, GradesModule, SchoolLifeModule],
  controllers: [PortalController],
  providers: [PortalService]
})
export class PortalModule {}
