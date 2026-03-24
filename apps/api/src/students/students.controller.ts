import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";

import { resolveTenantContext } from "../common/tenant-context.util";
import { type AuthenticatedUser } from "../security/authenticated-user.interface";
import { RequirePermission } from "../security/permissions.decorator";
import { Roles } from "../security/roles.decorator";
import { UserRole } from "../security/roles.enum";
import { CreateStudentDto } from "./dto/create-student.dto";
import { UpdateStudentDto } from "./dto/update-student.dto";
import { StudentsService, type StudentView } from "./students.service";

@ApiTags("students")
@ApiBearerAuth("bearer")
@Controller("students")
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly configService: ConfigService
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("students", "read")
  @ApiHeader({
    name: "x-tenant-id",
    required: false,
    description: "Optional tenant UUID override for development."
  })
  @ApiOperation({ summary: "List students from PostgreSQL" })
  async list(
    @Req() request: { user?: AuthenticatedUser },
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<StudentView[]> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.studentsService.list(tenantId);
  }

  @Get(":id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("students", "read")
  @ApiHeader({
    name: "x-tenant-id",
    required: false,
    description: "Optional tenant UUID override for development."
  })
  @ApiOperation({ summary: "Get one student by id" })
  async getById(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<StudentView> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.studentsService.getById(tenantId, id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("students", "create")
  @ApiHeader({
    name: "x-tenant-id",
    required: false,
    description: "Optional tenant UUID override for development."
  })
  @ApiOperation({ summary: "Create student in PostgreSQL" })
  async create(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateStudentDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<StudentView> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.studentsService.create(tenantId, body);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("students", "update")
  @ApiHeader({
    name: "x-tenant-id",
    required: false,
    description: "Optional tenant UUID override for development."
  })
  @ApiOperation({ summary: "Update student in PostgreSQL" })
  async update(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateStudentDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<StudentView> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.studentsService.update(tenantId, id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("students", "delete")
  @ApiHeader({
    name: "x-tenant-id",
    required: false,
    description: "Optional tenant UUID override for development."
  })
  @ApiOperation({ summary: "Soft delete student" })
  async remove(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<void> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    await this.studentsService.remove(tenantId, id);
  }

  private getTenantId(
    user: AuthenticatedUser | undefined,
    tenantHeader?: string
  ): string {
    return resolveTenantContext(this.configService, user, tenantHeader);
  }
}

