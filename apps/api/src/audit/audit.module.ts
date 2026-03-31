import { Module } from "@nestjs/common";

import { OutboxModule } from "../outbox/outbox.module";
import { AuditOutboxProcessorService } from "./audit.outbox-processor.service";
import { AuditService } from "./audit.service";

@Module({
  imports: [OutboxModule],
  providers: [AuditService, AuditOutboxProcessorService],
  exports: [AuditService, AuditOutboxProcessorService]
})
export class AuditModule {}
