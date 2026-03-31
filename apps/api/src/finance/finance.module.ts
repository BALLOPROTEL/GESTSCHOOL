import { Module } from "@nestjs/common";

import { NotificationsModule } from "../notifications/notifications.module";
import { PaymentsController } from "../payments/payments.controller";
import { ReferenceModule } from "../reference/reference.module";
import { FinanceController } from "./finance.controller";
import { FinanceService } from "./finance.service";

@Module({
  imports: [NotificationsModule, ReferenceModule],
  controllers: [FinanceController, PaymentsController],
  providers: [FinanceService],
  exports: [FinanceService]
})
export class FinanceModule {}
