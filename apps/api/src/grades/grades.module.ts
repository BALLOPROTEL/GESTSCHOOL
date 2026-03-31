import { Module } from "@nestjs/common";

import { ReferenceModule } from "../reference/reference.module";
import { GradesController } from "./grades.controller";
import { GradesService } from "./grades.service";

@Module({
  imports: [ReferenceModule],
  controllers: [GradesController],
  providers: [GradesService],
  exports: [GradesService]
})
export class GradesModule {}
