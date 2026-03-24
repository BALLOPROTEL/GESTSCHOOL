import {
  BadRequestException,
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
  Put,
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
import { CreateParentLinkDto } from "./dto/create-parent-link.dto";
import { CreateTeacherAssignmentDto } from "./dto/create-teacher-assignment.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateRolePermissionsDto } from "./dto/update-role-permissions.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import {
  type ParentLinkView,
  type TeacherAssignmentView,
  UsersService,
  type RolePermissionView,
  type UserView
} from "./users.service";

@ApiTags("users")
@ApiBearerAuth("bearer")
@ApiHeader({
  name: "x-tenant-id",
  required: false,
  description: "Tenant context. Cannot override authenticated tenant."
})
@Controller("users")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService
  ) {}

  @Get("roles/:role/permissions")
  @Roles(UserRole.ADMIN)
  @RequirePermission("users", "read")
  @ApiOperation({ summary: "List effective permissions for one role" })
  async listRolePermissions(
    @Req() request: { user?: AuthenticatedUser },
    @Param("role") role: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<RolePermissionView[]> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.usersService.listRolePermissions(tenantId, this.parseRole(role));
  }

  @Put("roles/:role/permissions")
  @Roles(UserRole.ADMIN)
  @RequirePermission("users", "update")
  @ApiOperation({ summary: "Upsert custom role permissions for current tenant" })
  async updateRolePermissions(
    @Req() request: { user?: AuthenticatedUser },
    @Param("role") role: string,
    @Body() body: UpdateRolePermissionsDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<RolePermissionView[]> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    const actorUserId = this.getActorUserId(request.user);
    return this.usersService.updateRolePermissions(
      tenantId,
      actorUserId,
      this.parseRole(role),
      body
    );
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @RequirePermission("users", "read")
  @ApiOperation({ summary: "List users for current tenant" })
  async list(
    @Req() request: { user?: AuthenticatedUser },
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<UserView[]> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.usersService.list(tenantId);
  }

  @Get("teacher-assignments")
  @Roles(UserRole.ADMIN)
  @RequirePermission("users", "read")
  @ApiOperation({ summary: "List teacher/class assignments for current tenant" })
  async listTeacherAssignments(
    @Req() request: { user?: AuthenticatedUser },
    @Query("userId") userId?: string,
    @Query("classId") classId?: string,
    @Query("schoolYearId") schoolYearId?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<TeacherAssignmentView[]> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.usersService.listTeacherAssignments(tenantId, {
      userId,
      classId,
      schoolYearId
    });
  }

  @Post("teacher-assignments")
  @Roles(UserRole.ADMIN)
  @RequirePermission("users", "create")
  @ApiOperation({ summary: "Assign one teacher to one class/school year" })
  async createTeacherAssignment(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateTeacherAssignmentDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<TeacherAssignmentView> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    const actorUserId = this.getActorUserId(request.user);
    return this.usersService.createTeacherAssignment(tenantId, actorUserId, body);
  }

  @Delete("teacher-assignments/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN)
  @RequirePermission("users", "delete")
  @ApiOperation({ summary: "Delete one teacher assignment" })
  async removeTeacherAssignment(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<void> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    const actorUserId = this.getActorUserId(request.user);
    await this.usersService.removeTeacherAssignment(tenantId, actorUserId, id);
  }

  @Get("parent-links")
  @Roles(UserRole.ADMIN)
  @RequirePermission("users", "read")
  @ApiOperation({ summary: "List parent/student links for current tenant" })
  async listParentLinks(
    @Req() request: { user?: AuthenticatedUser },
    @Query("parentUserId") parentUserId?: string,
    @Query("studentId") studentId?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<ParentLinkView[]> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.usersService.listParentLinks(tenantId, {
      parentUserId,
      studentId
    });
  }

  @Post("parent-links")
  @Roles(UserRole.ADMIN)
  @RequirePermission("users", "create")
  @ApiOperation({ summary: "Link one parent account to one student" })
  async createParentLink(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateParentLinkDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<ParentLinkView> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    const actorUserId = this.getActorUserId(request.user);
    return this.usersService.createParentLink(tenantId, actorUserId, body);
  }

  @Delete("parent-links/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN)
  @RequirePermission("users", "delete")
  @ApiOperation({ summary: "Delete one parent/student link" })
  async removeParentLink(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<void> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    const actorUserId = this.getActorUserId(request.user);
    await this.usersService.removeParentLink(tenantId, actorUserId, id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @RequirePermission("users", "create")
  @ApiOperation({ summary: "Create a user in current tenant" })
  async create(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateUserDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<UserView> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    const actorUserId = this.getActorUserId(request.user);
    return this.usersService.create(tenantId, actorUserId, body);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN)
  @RequirePermission("users", "update")
  @ApiOperation({ summary: "Update one user" })
  async update(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateUserDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<UserView> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    const actorUserId = this.getActorUserId(request.user);
    return this.usersService.update(tenantId, actorUserId, id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN)
  @RequirePermission("users", "delete")
  @ApiOperation({ summary: "Soft delete one user and revoke tokens" })
  async remove(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<void> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    const actorUserId = this.getActorUserId(request.user);
    await this.usersService.remove(tenantId, actorUserId, id);
  }

  private parseRole(role: string): UserRole {
    const normalized = role.trim().toUpperCase() as UserRole;
    if (!Object.values(UserRole).includes(normalized)) {
      throw new BadRequestException("Invalid role.");
    }
    return normalized;
  }

  private getActorUserId(user: AuthenticatedUser | undefined): string {
    if (!user?.sub) {
      throw new BadRequestException("Missing authenticated user context.");
    }
    return user.sub;
  }

  private getTenantId(
    user: AuthenticatedUser | undefined,
    tenantHeader?: string
  ): string {
    return resolveTenantContext(this.configService, user, tenantHeader);
  }
}
