import { Module } from "@nestjs/common";

import { AcademicStructureService } from "./academic-structure.service";

@Module({
  providers: [AcademicStructureService],
  exports: [AcademicStructureService]
})
export class AcademicStructureModule {}
