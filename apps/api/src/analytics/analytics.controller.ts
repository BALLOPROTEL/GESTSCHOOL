import { Controller, Get, Headers, Query, Req } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";

import { resolveTenantContext } from "../common/tenant-context.util";
import { type AuthenticatedUser } from "../security/authenticated-user.interface";
import { RequirePermission } from "../security/permissions.decorator";
import { Roles } from "../security/roles.decorator";
import { UserRole } from "../security/roles.enum";
import {
  AnalyticsService,
  type AnalyticsOverviewView,
  type AuditLogExportView,
  type AuditLogPageView
} from "./analytics.service";
import {
  AnalyticsOverviewQueryDto,
  AuditLogExportQueryDto,
  AuditLogQueryDto
} from "./dto/analytics.dto";

@ApiTags("analytics")
@ApiBearerAuth("bearer")
@ApiHeader({
  name: "x-tenant-id",
  required: false,
  description: "Tenant context. Cannot override authenticated tenant."
})
@Controller("analytics")
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly configService: ConfigService
  ) {}

  @Get("overview")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.COMPTABLE)
  @RequirePermission("analytics", "read")
  @ApiOperation({ summary: "Executive reporting overview (Sprint 11)" })
  async getOverview(
    @Req() request: { user?: AuthenticatedUser },
    @Query() query: AnalyticsOverviewQueryDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<AnalyticsOverviewView> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.analyticsService.getOverview(tenantId, query);
  }

  @Get("compliance/audit-logs")
  @Roles(UserRole.ADMIN)
  @RequirePermission("audit", "read")
  @ApiOperation({ summary: "Compliance audit logs with pagination and filters" })
  async listAuditLogs(
    @Req() request: { user?: AuthenticatedUser },
    @Query() query: AuditLogQueryDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<AuditLogPageView> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.analyticsService.listAuditLogs(tenantId, query);
  }

  @Get("compliance/audit-logs/export")
  @Roles(UserRole.ADMIN)
  @RequirePermission("audit", "read")
  @ApiOperation({ summary: "Export compliance audit logs to PDF/Excel" })
  async exportAuditLogs(
    @Req() request: { user?: AuthenticatedUser },
    @Query() query: AuditLogExportQueryDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<AuditLogExportView> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.analyticsService.exportAuditLogs(tenantId, query);
  }

  private getTenantId(
    user: AuthenticatedUser | undefined,
    tenantHeader?: string
  ): string {
    return resolveTenantContext(this.configService, user, tenantHeader);
  }
}
