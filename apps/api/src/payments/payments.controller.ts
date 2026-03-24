import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";

import { resolveTenantContext } from "../common/tenant-context.util";
import { FinanceService } from "../finance/finance.service";
import { type AuthenticatedUser } from "../security/authenticated-user.interface";
import { RequirePermission } from "../security/permissions.decorator";
import { Roles } from "../security/roles.decorator";
import { UserRole } from "../security/roles.enum";
import { CreatePaymentDto } from "./dto/create-payment.dto";

@ApiTags("payments")
@ApiBearerAuth("bearer")
@ApiHeader({
  name: "x-tenant-id",
  required: false,
  description: "Optional tenant UUID override for development."
})
@Controller("payments")
export class PaymentsController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly configService: ConfigService
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE, UserRole.SCOLARITE)
  @RequirePermission("payments", "read")
  @ApiOperation({ summary: "List payments" })
  async list(
    @Req() request: { user?: AuthenticatedUser },
    @Query("invoiceId") invoiceId?: string,
    @Query("schoolYearId") schoolYearId?: string,
    @Query("studentId") studentId?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.financeService.listPayments(tenantId, {
      invoiceId,
      schoolYearId,
      studentId
    });
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE)
  @RequirePermission("payments", "create")
  @ApiOperation({ summary: "Record payment and update invoice atomically" })
  async create(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreatePaymentDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.financeService.recordPayment(tenantId, body);
  }

  @Get(":id/receipt")
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE, UserRole.SCOLARITE)
  @RequirePermission("payments", "read")
  @ApiOperation({ summary: "Generate payment receipt" })
  async receipt(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.financeService.getReceipt(tenantId, id);
  }

  private getTenantId(
    user: AuthenticatedUser | undefined,
    tenantHeader?: string
  ): string {
    return resolveTenantContext(this.configService, user, tenantHeader);
  }
}
