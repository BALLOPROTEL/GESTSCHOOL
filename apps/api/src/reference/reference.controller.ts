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
  CreateAcademicPeriodDto,
  CreateClassroomDto,
  CreateCycleDto,
  CreateLevelDto,
  CreateSchoolYearDto,
  CreateSubjectDto,
  UpdateAcademicPeriodDto,
  UpdateClassroomDto,
  UpdateCycleDto,
  UpdateLevelDto,
  UpdateSchoolYearDto,
  UpdateSubjectDto
} from "./dto/reference.dto";
import { ReferenceService } from "./reference.service";

@ApiTags("reference")
@ApiBearerAuth("bearer")
@ApiHeader({
  name: "x-tenant-id",
  required: false,
  description: "Optional tenant UUID override for development."
})
@Controller()
export class ReferenceController {
  constructor(
    private readonly referenceService: ReferenceService,
    private readonly configService: ConfigService
  ) {}

  @Get("school-years")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.ENSEIGNANT)
  @RequirePermission("reference", "read")
  @ApiOperation({ summary: "List school years" })
  async listSchoolYears(
    @Req() request: { user?: AuthenticatedUser },
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.referenceService.listSchoolYears(tenantId);
  }

  @Post("school-years")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("reference", "create")
  @ApiOperation({ summary: "Create school year" })
  async createSchoolYear(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateSchoolYearDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.referenceService.createSchoolYear(tenantId, body);
  }

  @Patch("school-years/:id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("reference", "update")
  @ApiOperation({ summary: "Update school year" })
  async updateSchoolYear(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateSchoolYearDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.referenceService.updateSchoolYear(tenantId, id, body);
  }

  @Delete("school-years/:id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("reference", "delete")
  @ApiOperation({ summary: "Delete school year" })
  async deleteSchoolYear(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    await this.referenceService.deleteSchoolYear(tenantId, id);
  }

  @Get("cycles")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.ENSEIGNANT)
  @RequirePermission("reference", "read")
  @ApiOperation({ summary: "List cycles" })
  async listCycles(
    @Req() request: { user?: AuthenticatedUser },
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.referenceService.listCycles(tenantId);
  }

  @Post("cycles")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("reference", "create")
  @ApiOperation({ summary: "Create cycle" })
  async createCycle(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateCycleDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.referenceService.createCycle(tenantId, body);
  }

  @Patch("cycles/:id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("reference", "update")
  @ApiOperation({ summary: "Update cycle" })
  async updateCycle(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateCycleDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.referenceService.updateCycle(tenantId, id, body);
  }

  @Delete("cycles/:id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("reference", "delete")
  @ApiOperation({ summary: "Delete cycle" })
  async deleteCycle(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    await this.referenceService.deleteCycle(tenantId, id);
  }

  @Get("levels")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.ENSEIGNANT)
  @RequirePermission("reference", "read")
  @ApiOperation({ summary: "List levels" })
  async listLevels(
    @Req() request: { user?: AuthenticatedUser },
    @Query("cycleId") cycleId?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.referenceService.listLevels(tenantId, cycleId);
  }

  @Post("levels")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("reference", "create")
  @ApiOperation({ summary: "Create level" })
  async createLevel(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateLevelDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.referenceService.createLevel(tenantId, body);
  }

  @Patch("levels/:id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("reference", "update")
  @ApiOperation({ summary: "Update level" })
  async updateLevel(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateLevelDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.referenceService.updateLevel(tenantId, id, body);
  }

  @Delete("levels/:id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("reference", "delete")
  @ApiOperation({ summary: "Delete level" })
  async deleteLevel(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    await this.referenceService.deleteLevel(tenantId, id);
  }

  @Get("classes")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.ENSEIGNANT)
  @RequirePermission("reference", "read")
  @ApiOperation({ summary: "List classes" })
  async listClasses(
    @Req() request: { user?: AuthenticatedUser },
    @Query("schoolYearId") schoolYearId?: string,
    @Query("levelId") levelId?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.referenceService.listClassrooms(tenantId, { schoolYearId, levelId });
  }

  @Post("classes")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("reference", "create")
  @ApiOperation({ summary: "Create class" })
  async createClass(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateClassroomDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.referenceService.createClassroom(tenantId, body);
  }

  @Patch("classes/:id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("reference", "update")
  @ApiOperation({ summary: "Update class" })
  async updateClass(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateClassroomDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.referenceService.updateClassroom(tenantId, id, body);
  }

  @Delete("classes/:id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("reference", "delete")
  @ApiOperation({ summary: "Delete class" })
  async deleteClass(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    await this.referenceService.deleteClassroom(tenantId, id);
  }

  @Get("subjects")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.ENSEIGNANT)
  @RequirePermission("reference", "read")
  @ApiOperation({ summary: "List subjects" })
  async listSubjects(
    @Req() request: { user?: AuthenticatedUser },
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.referenceService.listSubjects(tenantId);
  }

  @Post("subjects")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("reference", "create")
  @ApiOperation({ summary: "Create subject" })
  async createSubject(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateSubjectDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.referenceService.createSubject(tenantId, body);
  }

  @Patch("subjects/:id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("reference", "update")
  @ApiOperation({ summary: "Update subject" })
  async updateSubject(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateSubjectDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.referenceService.updateSubject(tenantId, id, body);
  }

  @Delete("subjects/:id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("reference", "delete")
  @ApiOperation({ summary: "Delete subject" })
  async deleteSubject(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    await this.referenceService.deleteSubject(tenantId, id);
  }

  @Get("academic-periods")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE, UserRole.ENSEIGNANT)
  @RequirePermission("reference", "read")
  @ApiOperation({ summary: "List academic periods" })
  async listAcademicPeriods(
    @Req() request: { user?: AuthenticatedUser },
    @Query("schoolYearId") schoolYearId?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.referenceService.listAcademicPeriods(tenantId, schoolYearId);
  }

  @Post("academic-periods")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("reference", "create")
  @ApiOperation({ summary: "Create academic period" })
  async createAcademicPeriod(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateAcademicPeriodDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.referenceService.createAcademicPeriod(tenantId, body);
  }

  @Patch("academic-periods/:id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("reference", "update")
  @ApiOperation({ summary: "Update academic period" })
  async updateAcademicPeriod(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateAcademicPeriodDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.referenceService.updateAcademicPeriod(tenantId, id, body);
  }

  @Delete("academic-periods/:id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("reference", "delete")
  @ApiOperation({ summary: "Delete academic period" })
  async deleteAcademicPeriod(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    await this.referenceService.deleteAcademicPeriod(tenantId, id);
  }

  private getTenantId(
    user: AuthenticatedUser | undefined,
    tenantHeader?: string
  ): string {
    return resolveTenantContext(this.configService, user, tenantHeader);
  }
}
