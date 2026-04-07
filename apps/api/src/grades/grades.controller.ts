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
import { AcademicTrack } from "@prisma/client";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";

import { resolveTenantContext } from "../common/tenant-context.util";
import { type AuthenticatedUser } from "../security/authenticated-user.interface";
import { RequirePermission } from "../security/permissions.decorator";
import { Roles } from "../security/roles.decorator";
import { UserRole } from "../security/roles.enum";
import {
  BulkCreateGradesDto,
  CreateGradeDto,
  GenerateReportCardDto
} from "./dto/grades.dto";
import { GradesService } from "./grades.service";

@ApiTags("grades")
@ApiBearerAuth("bearer")
@ApiHeader({
  name: "x-tenant-id",
  required: false,
  description: "Optional tenant UUID override for development."
})
@Controller()
export class GradesController {
  constructor(
    private readonly gradesService: GradesService,
    private readonly configService: ConfigService
  ) {}

  @Get("grades")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("grades", "read")
  @ApiOperation({ summary: "List grades" })
  async listGrades(
    @Req() request: { user?: AuthenticatedUser },
    @Query("classId") classId?: string,
    @Query("subjectId") subjectId?: string,
    @Query("academicPeriodId") academicPeriodId?: string,
    @Query("studentId") studentId?: string,
    @Query("track") track?: AcademicTrack,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.gradesService.listGrades(tenantId, {
      classId,
      subjectId,
      academicPeriodId,
      studentId,
      track
    });
  }

  @Post("grades")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("grades", "create")
  @ApiOperation({ summary: "Create or update one grade" })
  async upsertGrade(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateGradeDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.gradesService.upsertGrade(tenantId, body);
  }

  @Post("grades/bulk")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("grades", "create")
  @ApiOperation({ summary: "Bulk create or update grades for one assessment" })
  async bulkUpsertGrades(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: BulkCreateGradesDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.gradesService.bulkUpsertGrades(tenantId, body);
  }

  @Get("grades/class-summary")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("grades", "read")
  @ApiOperation({ summary: "Compute class averages and ranks for one period" })
  async classSummary(
    @Req() request: { user?: AuthenticatedUser },
    @Query("classId") classId: string,
    @Query("academicPeriodId") academicPeriodId: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.gradesService.classSummary(tenantId, classId, academicPeriodId);
  }

  @Get("report-cards")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("reportCards", "read")
  @ApiOperation({ summary: "List generated report cards" })
  async listReportCards(
    @Req() request: { user?: AuthenticatedUser },
    @Query("classId") classId?: string,
    @Query("academicPeriodId") academicPeriodId?: string,
    @Query("studentId") studentId?: string,
    @Query("track") track?: AcademicTrack,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.gradesService.listReportCards(tenantId, {
      classId,
      academicPeriodId,
      studentId,
      track
    });
  }

  @Post("report-cards/generate")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("reportCards", "create")
  @ApiOperation({ summary: "Generate one report card PDF" })
  async generateReportCard(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: GenerateReportCardDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.gradesService.generateReportCard(tenantId, body);
  }

  @Get("report-cards/:id/pdf")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("reportCards", "read")
  @ApiOperation({ summary: "Get generated report card PDF data URL" })
  async getReportCardPdf(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.gradesService.getReportCardPdf(tenantId, id);
  }

  private getTenantId(
    user: AuthenticatedUser | undefined,
    tenantHeader?: string
  ): string {
    return resolveTenantContext(this.configService, user, tenantHeader);
  }
}
