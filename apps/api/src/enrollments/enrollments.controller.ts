import {
  Body,
  Controller,
  Delete,
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
import { type AuthenticatedUser } from "../security/authenticated-user.interface";
import { RequirePermission } from "../security/permissions.decorator";
import { Roles } from "../security/roles.decorator";
import { UserRole } from "../security/roles.enum";
import { CreateEnrollmentDto } from "./dto/create-enrollment.dto";
import { EnrollmentsService } from "./enrollments.service";

@ApiTags("enrollments")
@ApiBearerAuth("bearer")
@ApiHeader({
  name: "x-tenant-id",
  required: false,
  description: "Optional tenant UUID override for development."
})
@Controller("enrollments")
export class EnrollmentsController {
  constructor(
    private readonly enrollmentsService: EnrollmentsService,
    private readonly configService: ConfigService
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("enrollments", "read")
  @ApiOperation({ summary: "List enrollments" })
  async list(
    @Req() request: { user?: AuthenticatedUser },
    @Query("schoolYearId") schoolYearId?: string,
    @Query("classId") classId?: string,
    @Query("studentId") studentId?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.enrollmentsService.list(tenantId, { schoolYearId, classId, studentId });
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("enrollments", "create")
  @ApiOperation({ summary: "Create enrollment" })
  async create(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateEnrollmentDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.enrollmentsService.create(tenantId, body);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("enrollments", "delete")
  @ApiOperation({ summary: "Delete enrollment" })
  async remove(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<void> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    await this.enrollmentsService.remove(tenantId, id);
  }

  private getTenantId(
    user: AuthenticatedUser | undefined,
    tenantHeader?: string
  ): string {
    return resolveTenantContext(this.configService, user, tenantHeader);
  }
}

