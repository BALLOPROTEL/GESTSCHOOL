import {
  BadRequestException,
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
import { MosqueService } from "./mosque.service";
import {
  CreateMosqueActivityDto,
  CreateMosqueDonationDto,
  CreateMosqueMemberDto,
  UpdateMosqueActivityDto,
  UpdateMosqueDonationDto,
  UpdateMosqueMemberDto
} from "./dto/mosque.dto";

@ApiTags("mosque")
@ApiBearerAuth("bearer")
@ApiHeader({
  name: "x-tenant-id",
  required: false,
  description: "Optional tenant UUID override for development."
})
@Controller("mosque")
export class MosqueController {
  constructor(
    private readonly mosqueService: MosqueService,
    private readonly configService: ConfigService
  ) {}

  @Get("dashboard")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.COMPTABLE)
  @RequirePermission("mosque", "read")
  @ApiOperation({ summary: "Mosque dashboard" })
  async dashboard(
    @Req() request: { user?: AuthenticatedUser },
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.mosqueService.dashboard(tenantId);
  }

  @Get("members")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.COMPTABLE)
  @RequirePermission("mosque", "read")
  @ApiOperation({ summary: "List mosque members" })
  async listMembers(
    @Req() request: { user?: AuthenticatedUser },
    @Query("status") status?: string,
    @Query("q") q?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.mosqueService.listMembers(tenantId, { status, q });
  }

  @Get("members/export")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.COMPTABLE)
  @RequirePermission("mosque", "read")
  @ApiOperation({ summary: "Export mosque members (PDF/Excel)" })
  async exportMembers(
    @Req() request: { user?: AuthenticatedUser },
    @Query("status") status?: string,
    @Query("q") q?: string,
    @Query("format") format?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.mosqueService.exportMembers(tenantId, { status, q }, this.parseExportFormat(format));
  }

  @Post("members")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.COMPTABLE)
  @RequirePermission("mosque", "create")
  @ApiOperation({ summary: "Create mosque member" })
  async createMember(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateMosqueMemberDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.mosqueService.createMember(tenantId, body);
  }

  @Patch("members/:id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.COMPTABLE)
  @RequirePermission("mosque", "update")
  @ApiOperation({ summary: "Update mosque member" })
  async updateMember(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateMosqueMemberDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.mosqueService.updateMember(tenantId, id, body);
  }

  @Delete("members/:id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.COMPTABLE)
  @RequirePermission("mosque", "delete")
  @ApiOperation({ summary: "Delete mosque member" })
  async deleteMember(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    await this.mosqueService.deleteMember(tenantId, id);
  }

  @Get("activities")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.COMPTABLE)
  @RequirePermission("mosque", "read")
  @ApiOperation({ summary: "List mosque activities" })
  async listActivities(
    @Req() request: { user?: AuthenticatedUser },
    @Query("category") category?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("q") q?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.mosqueService.listActivities(tenantId, { category, from, to, q });
  }

  @Get("activities/export")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.COMPTABLE)
  @RequirePermission("mosque", "read")
  @ApiOperation({ summary: "Export mosque activities (PDF/Excel)" })
  async exportActivities(
    @Req() request: { user?: AuthenticatedUser },
    @Query("category") category?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("q") q?: string,
    @Query("format") format?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.mosqueService.exportActivities(
      tenantId,
      { category, from, to, q },
      this.parseExportFormat(format)
    );
  }

  @Post("activities")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.COMPTABLE)
  @RequirePermission("mosque", "create")
  @ApiOperation({ summary: "Create mosque activity" })
  async createActivity(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateMosqueActivityDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.mosqueService.createActivity(tenantId, body);
  }

  @Patch("activities/:id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.COMPTABLE)
  @RequirePermission("mosque", "update")
  @ApiOperation({ summary: "Update mosque activity" })
  async updateActivity(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateMosqueActivityDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.mosqueService.updateActivity(tenantId, id, body);
  }

  @Delete("activities/:id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.COMPTABLE)
  @RequirePermission("mosque", "delete")
  @ApiOperation({ summary: "Delete mosque activity" })
  async deleteActivity(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    await this.mosqueService.deleteActivity(tenantId, id);
  }

  @Get("donations")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.COMPTABLE)
  @RequirePermission("mosque", "read")
  @ApiOperation({ summary: "List mosque donations" })
  async listDonations(
    @Req() request: { user?: AuthenticatedUser },
    @Query("memberId") memberId?: string,
    @Query("channel") channel?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.mosqueService.listDonations(tenantId, {
      memberId,
      channel,
      from,
      to
    });
  }

  @Get("donations/export")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.COMPTABLE)
  @RequirePermission("mosque", "read")
  @ApiOperation({ summary: "Export mosque donations (PDF/Excel)" })
  async exportDonations(
    @Req() request: { user?: AuthenticatedUser },
    @Query("memberId") memberId?: string,
    @Query("channel") channel?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("format") format?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.mosqueService.exportDonations(
      tenantId,
      { memberId, channel, from, to },
      this.parseExportFormat(format)
    );
  }

  @Post("donations")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.COMPTABLE)
  @RequirePermission("mosque", "create")
  @ApiOperation({ summary: "Create mosque donation" })
  async createDonation(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateMosqueDonationDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.mosqueService.createDonation(tenantId, body);
  }

  @Get("donations/:id/receipt")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.COMPTABLE)
  @RequirePermission("mosque", "read")
  @ApiOperation({ summary: "Generate donation receipt PDF" })
  async donationReceipt(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.mosqueService.getDonationReceipt(tenantId, id);
  }

  @Patch("donations/:id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.COMPTABLE)
  @RequirePermission("mosque", "update")
  @ApiOperation({ summary: "Update mosque donation" })
  async updateDonation(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateMosqueDonationDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.mosqueService.updateDonation(tenantId, id, body);
  }

  @Delete("donations/:id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.COMPTABLE)
  @RequirePermission("mosque", "delete")
  @ApiOperation({ summary: "Delete mosque donation" })
  async deleteDonation(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    await this.mosqueService.deleteDonation(tenantId, id);
  }

  private getTenantId(
    user: AuthenticatedUser | undefined,
    tenantHeader?: string
  ): string {
    return resolveTenantContext(this.configService, user, tenantHeader);
  }

  private parseExportFormat(value?: string): "PDF" | "EXCEL" {
    if (!value) return "PDF";
    const normalized = value.trim().toUpperCase();
    if (normalized === "PDF" || normalized === "EXCEL") {
      return normalized;
    }
    throw new BadRequestException("format must be one of: PDF, EXCEL.");
  }
}
