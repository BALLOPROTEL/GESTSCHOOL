import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";

import { resolveTenantContext } from "../common/tenant-context.util";
import { type AuthenticatedUser } from "../security/authenticated-user.interface";
import { RequirePermission } from "../security/permissions.decorator";
import { Roles } from "../security/roles.decorator";
import { UserRole } from "../security/roles.enum";
import {
  CreateFeePlanDto,
  CreateInvoiceDto,
  UpdateFeePlanDto,
  UpdateInvoiceDto
} from "./dto/finance.dto";
import { FinanceService } from "./finance.service";

@ApiTags("finance")
@ApiBearerAuth("bearer")
@ApiHeader({
  name: "x-tenant-id",
  required: false,
  description: "Optional tenant UUID override for development."
})
@Controller()
export class FinanceController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly configService: ConfigService
  ) {}

  @Get("fee-plans")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.COMPTABLE)
  @RequirePermission("finance", "read")
  @ApiOperation({ summary: "List fee plans" })
  async listFeePlans(
    @Req() request: { user?: AuthenticatedUser },
    @Query("schoolYearId") schoolYearId?: string,
    @Query("levelId") levelId?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.financeService.listFeePlans(tenantId, { schoolYearId, levelId });
  }

  @Post("fee-plans")
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE)
  @RequirePermission("finance", "create")
  @ApiOperation({ summary: "Create fee plan" })
  async createFeePlan(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateFeePlanDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.financeService.createFeePlan(tenantId, body);
  }

  @Patch("fee-plans/:id")
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE)
  @RequirePermission("finance", "update")
  @ApiOperation({ summary: "Update fee plan" })
  async updateFeePlan(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateFeePlanDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.financeService.updateFeePlan(tenantId, id, body);
  }

  @Delete("fee-plans/:id")
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE)
  @RequirePermission("finance", "delete")
  @ApiOperation({ summary: "Delete fee plan" })
  async deleteFeePlan(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    await this.financeService.deleteFeePlan(tenantId, id);
  }

  @Get("invoices")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.COMPTABLE)
  @RequirePermission("finance", "read")
  @ApiOperation({ summary: "List invoices" })
  async listInvoices(
    @Req() request: { user?: AuthenticatedUser },
    @Query("schoolYearId") schoolYearId?: string,
    @Query("studentId") studentId?: string,
    @Query("status") status?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.financeService.listInvoices(tenantId, {
      schoolYearId,
      studentId,
      status: status?.trim().toUpperCase()
    });
  }

  @Post("invoices")
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE)
  @RequirePermission("finance", "create")
  @ApiOperation({ summary: "Create invoice" })
  async createInvoice(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateInvoiceDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.financeService.createInvoice(tenantId, body);
  }

  @Patch("invoices/:id")
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE)
  @RequirePermission("finance", "update")
  @ApiOperation({ summary: "Update invoice" })
  async updateInvoice(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateInvoiceDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.financeService.updateInvoice(tenantId, id, body);
  }

  @Delete("invoices/:id")
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE)
  @RequirePermission("finance", "delete")
  @ApiOperation({ summary: "Delete invoice" })
  async deleteInvoice(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    await this.financeService.deleteInvoice(tenantId, id);
  }

  @Get("finance/recovery")
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE, UserRole.SCOLARITE)
  @RequirePermission("finance", "read")
  @ApiOperation({ summary: "Finance recovery dashboard" })
  async recoveryDashboard(
    @Req() request: { user?: AuthenticatedUser },
    @Query("schoolYearId") schoolYearId?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.financeService.recoveryDashboard(tenantId, schoolYearId);
  }

  private getTenantId(
    user: AuthenticatedUser | undefined,
    tenantHeader?: string
  ): string {
    return resolveTenantContext(this.configService, user, tenantHeader);
  }
}
