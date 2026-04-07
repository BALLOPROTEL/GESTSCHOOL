import { Module } from "@nestjs/common";

import { AcademicStructureModule } from "../academic-structure/academic-structure.module";
import { ReferenceController } from "./reference.controller";
import { ReferenceService } from "./reference.service";

@Module({
  imports: [AcademicStructureModule],
  controllers: [ReferenceController],
  providers: [ReferenceService],
  exports: [ReferenceService]
})
export class ReferenceModule {}
