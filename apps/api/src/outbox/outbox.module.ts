import { Module } from "@nestjs/common";

import { OutboxProcessorService } from "./outbox.processor.service";
import { OutboxService } from "./outbox.service";

@Module({
  providers: [OutboxProcessorService, OutboxService],
  exports: [OutboxProcessorService, OutboxService]
})
export class OutboxModule {}
