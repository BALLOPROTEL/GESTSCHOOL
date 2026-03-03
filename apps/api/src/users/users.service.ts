import { hash } from "bcryptjs";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type User } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import {
  PERMISSION_ACTIONS,
  PERMISSION_RESOURCES,
  hasPermission,
  type PermissionAction,
  type PermissionResource
} from "../security/permissions.types";
import { UserRole } from "../security/roles.enum";
import { CreateParentLinkDto } from "./dto/create-parent-link.dto";
import { CreateTeacherAssignmentDto } from "./dto/create-teacher-assignment.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import {
  type RolePermissionItemDto,
  UpdateRolePermissionsDto
} from "./dto/update-role-permissions.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

type TeacherAssignmentWithRelations = Prisma.TeacherClassAssignmentGetPayload<{
  include: {
    user: true;
    classroom: true;
    schoolYear: true;
    subject: true;
  };
}>;

type ParentLinkWithRelations = Prisma.ParentStudentLinkGetPayload<{
  include: {
    parent: true;
    student: true;
  };
}>;

export type UserView = {
  id: string;
  tenantId: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RolePermissionView = {
  role: UserRole;
  resource: PermissionResource;
  action: PermissionAction;
  allowed: boolean;
  source: "DEFAULT" | "CUSTOM";
};

export type TeacherAssignmentView = {
  id: string;
  tenantId: string;
  userId: string;
  classId: string;
  schoolYearId: string;
  subjectId?: string;
  teacherUsername: string;
  classLabel: string;
  schoolYearCode: string;
  subjectLabel?: string;
  createdAt: string;
  updatedAt: string;
};

export type ParentLinkView = {
  id: string;
  tenantId: string;
  parentUserId: string;
  studentId: string;
  relationship?: string;
  isPrimary: boolean;
  parentUsername: string;
  studentMatricule: string;
  studentName: string;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string): Promise<UserView[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        tenantId,
        deletedAt: null
      },
      orderBy: [{ username: "asc" }]
    });

    return rows.map((row) => this.toView(row));
  }

  async create(
    tenantId: string,
    actorUserId: string,
    payload: CreateUserDto
  ): Promise<UserView> {
    const passwordHash = await hash(payload.password, 10);

    try {
      const created = await this.prisma.user.create({
        data: {
          tenantId,
          username: payload.username.trim(),
          passwordHash,
          role: payload.role,
          isActive: payload.isActive ?? true,
          updatedAt: new Date()
        }
      });

      await this.logAudit(tenantId, actorUserId, "USER_CREATED", "users", created.id, {
        username: created.username,
        role: created.role,
        isActive: created.isActive
      });

      return this.toView(created);
    } catch (error: unknown) {
      this.handleKnownPrismaConflict(error, "Username already exists for this tenant.");
      throw error;
    }
  }

  async update(
    tenantId: string,
    actorUserId: string,
    id: string,
    payload: UpdateUserDto
  ): Promise<UserView> {
    const existing = await this.requireUser(tenantId, id);
    if (existing.id === actorUserId && payload.isActive === false) {
      throw new ConflictException("You cannot deactivate your own account.");
    }
    const data: Prisma.UserUpdateInput = {
      username: payload.username?.trim(),
      role: payload.role,
      isActive: payload.isActive,
      updatedAt: new Date()
    };

    if (payload.password) {
      data.passwordHash = await hash(payload.password, 10);
    }

    try {
      const updated = await this.prisma.$transaction(async (transaction) => {
        const row = await transaction.user.update({
          where: { id: existing.id },
          data
        });

        if (payload.isActive === false) {
          await transaction.refreshToken.updateMany({
            where: {
              userId: existing.id,
              revokedAt: null
            },
            data: {
              revokedAt: new Date()
            }
          });
        }

        return row;
      });

      await this.logAudit(tenantId, actorUserId, "USER_UPDATED", "users", updated.id, {
        username: updated.username,
        role: updated.role,
        isActive: updated.isActive
      });

      return this.toView(updated);
    } catch (error: unknown) {
      this.handleKnownPrismaConflict(error, "Username already exists for this tenant.");
      throw error;
    }
  }

  async remove(tenantId: string, actorUserId: string, id: string): Promise<void> {
    if (id === actorUserId) {
      throw new ConflictException("You cannot delete your own account.");
    }

    const existing = await this.requireUser(tenantId, id);
    const now = new Date();

    await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: existing.id },
        data: {
          isActive: false,
          deletedAt: now,
          updatedAt: now
        }
      });

      await transaction.refreshToken.updateMany({
        where: {
          userId: existing.id,
          revokedAt: null
        },
        data: {
          revokedAt: now
        }
      });

      await transaction.iamAuditLog.create({
        data: {
          tenantId,
          userId: actorUserId,
          action: "USER_DELETED",
          resource: "users",
          resourceId: existing.id,
          payload: {
            username: existing.username
          }
        }
      });
    });
  }

  async listTeacherAssignments(
    tenantId: string,
    filters: { userId?: string; classId?: string; schoolYearId?: string } = {}
  ): Promise<TeacherAssignmentView[]> {
    const rows = await this.prisma.teacherClassAssignment.findMany({
      where: {
        tenantId,
        userId: filters.userId,
        classId: filters.classId,
        schoolYearId: filters.schoolYearId
      },
      include: {
        user: true,
        classroom: true,
        schoolYear: true,
        subject: true
      },
      orderBy: [{ schoolYear: { code: "desc" } }, { classroom: { label: "asc" } }]
    });

    return rows.map((row) => this.teacherAssignmentView(row));
  }

  async createTeacherAssignment(
    tenantId: string,
    actorUserId: string,
    payload: CreateTeacherAssignmentDto
  ): Promise<TeacherAssignmentView> {
    await this.requireUserWithRole(
      tenantId,
      payload.userId,
      UserRole.ENSEIGNANT,
      "Teacher user not found."
    );
    const classroom = await this.requireClassroom(tenantId, payload.classId);
    await this.requireSchoolYear(tenantId, payload.schoolYearId);

    if (classroom.schoolYearId !== payload.schoolYearId) {
      throw new ConflictException(
        "Classroom and school year must match for teacher assignment."
      );
    }

    if (payload.subjectId) {
      await this.requireSubject(tenantId, payload.subjectId);
    }

    try {
      const created = await this.prisma.teacherClassAssignment.create({
        data: {
          tenantId,
          userId: payload.userId,
          classId: payload.classId,
          schoolYearId: payload.schoolYearId,
          subjectId: payload.subjectId,
          updatedAt: new Date()
        },
        include: {
          user: true,
          classroom: true,
          schoolYear: true,
          subject: true
        }
      });

      await this.logAudit(
        tenantId,
        actorUserId,
        "TEACHER_ASSIGNMENT_CREATED",
        "teacher_assignments",
        created.id,
        {
          userId: created.userId,
          classId: created.classId,
          schoolYearId: created.schoolYearId,
          subjectId: created.subjectId
        }
      );

      return this.teacherAssignmentView(created);
    } catch (error: unknown) {
      this.handleKnownPrismaConflict(error, "Teacher assignment already exists.");
      throw error;
    }
  }

  async removeTeacherAssignment(
    tenantId: string,
    actorUserId: string,
    id: string
  ): Promise<void> {
    const existing = await this.prisma.teacherClassAssignment.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      throw new NotFoundException("Teacher assignment not found.");
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.teacherClassAssignment.delete({
        where: { id: existing.id }
      });

      await transaction.iamAuditLog.create({
        data: {
          tenantId,
          userId: actorUserId,
          action: "TEACHER_ASSIGNMENT_DELETED",
          resource: "teacher_assignments",
          resourceId: existing.id,
          payload: {
            userId: existing.userId,
            classId: existing.classId,
            schoolYearId: existing.schoolYearId
          }
        }
      });
    });
  }

  async listParentLinks(
    tenantId: string,
    filters: { parentUserId?: string; studentId?: string } = {}
  ): Promise<ParentLinkView[]> {
    const rows = await this.prisma.parentStudentLink.findMany({
      where: {
        tenantId,
        parentUserId: filters.parentUserId,
        studentId: filters.studentId
      },
      include: {
        parent: true,
        student: true
      },
      orderBy: [{ parent: { username: "asc" } }, { student: { lastName: "asc" } }]
    });

    return rows.map((row) => this.parentLinkView(row));
  }

  async createParentLink(
    tenantId: string,
    actorUserId: string,
    payload: CreateParentLinkDto
  ): Promise<ParentLinkView> {
    await this.requireUserWithRole(
      tenantId,
      payload.parentUserId,
      UserRole.PARENT,
      "Parent user not found."
    );
    await this.requireStudent(tenantId, payload.studentId);

    try {
      const created = await this.prisma.$transaction(async (transaction) => {
        if (payload.isPrimary) {
          await transaction.parentStudentLink.updateMany({
            where: {
              tenantId,
              parentUserId: payload.parentUserId
            },
            data: {
              isPrimary: false,
              updatedAt: new Date()
            }
          });
        }

        const row = await transaction.parentStudentLink.create({
          data: {
            tenantId,
            parentUserId: payload.parentUserId,
            studentId: payload.studentId,
            relationship: payload.relationship?.trim(),
            isPrimary: payload.isPrimary ?? false,
            updatedAt: new Date()
          },
          include: {
            parent: true,
            student: true
          }
        });

        await transaction.iamAuditLog.create({
          data: {
            tenantId,
            userId: actorUserId,
            action: "PARENT_LINK_CREATED",
            resource: "parent_links",
            resourceId: row.id,
            payload: {
              parentUserId: row.parentUserId,
              studentId: row.studentId,
              relationship: row.relationship,
              isPrimary: row.isPrimary
            }
          }
        });

        return row;
      });

      return this.parentLinkView(created);
    } catch (error: unknown) {
      this.handleKnownPrismaConflict(error, "Parent/student link already exists.");
      throw error;
    }
  }

  async removeParentLink(
    tenantId: string,
    actorUserId: string,
    id: string
  ): Promise<void> {
    const existing = await this.prisma.parentStudentLink.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      throw new NotFoundException("Parent link not found.");
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.parentStudentLink.delete({
        where: { id: existing.id }
      });

      await transaction.iamAuditLog.create({
        data: {
          tenantId,
          userId: actorUserId,
          action: "PARENT_LINK_DELETED",
          resource: "parent_links",
          resourceId: existing.id,
          payload: {
            parentUserId: existing.parentUserId,
            studentId: existing.studentId
          }
        }
      });
    });
  }

  async listRolePermissions(
    tenantId: string,
    role: UserRole
  ): Promise<RolePermissionView[]> {
    const customRows = await this.prisma.rolePermission.findMany({
      where: {
        tenantId,
        role
      }
    });

    const customMap = new Map<string, boolean>();
    for (const row of customRows) {
      customMap.set(`${row.resource}:${row.action}`, row.allowed);
    }

    const entries: RolePermissionView[] = [];
    for (const resource of PERMISSION_RESOURCES) {
      for (const action of PERMISSION_ACTIONS) {
        const key = `${resource}:${action}`;
        const defaultAllowed = hasPermission(role, { resource, action });
        if (!defaultAllowed && !customMap.has(key)) {
          continue;
        }

        entries.push({
          role,
          resource,
          action,
          allowed: customMap.has(key) ? customMap.get(key) === true : defaultAllowed,
          source: customMap.has(key) ? "CUSTOM" : "DEFAULT"
        });
      }
    }

    return entries.sort(
      (left, right) =>
        left.resource.localeCompare(right.resource) ||
        left.action.localeCompare(right.action)
    );
  }

  async updateRolePermissions(
    tenantId: string,
    actorUserId: string,
    role: UserRole,
    payload: UpdateRolePermissionsDto
  ): Promise<RolePermissionView[]> {
    const normalized = new Map<string, RolePermissionItemDto>();
    for (const item of payload.permissions) {
      normalized.set(`${item.resource}:${item.action}`, item);
    }

    await this.prisma.$transaction(async (transaction) => {
      for (const item of normalized.values()) {
        const defaultAllowed = hasPermission(role, {
          resource: item.resource,
          action: item.action
        });

        if (item.allowed === defaultAllowed) {
          await transaction.rolePermission.deleteMany({
            where: {
              tenantId,
              role,
              resource: item.resource,
              action: item.action
            }
          });
          continue;
        }

        await transaction.rolePermission.upsert({
          where: {
            tenantId_role_resource_action: {
              tenantId,
              role,
              resource: item.resource,
              action: item.action
            }
          },
          create: {
            tenantId,
            role,
            resource: item.resource,
            action: item.action,
            allowed: item.allowed,
            updatedAt: new Date()
          },
          update: {
            allowed: item.allowed,
            updatedAt: new Date()
          }
        });
      }

      await transaction.iamAuditLog.create({
        data: {
          tenantId,
          userId: actorUserId,
          action: "ROLE_PERMISSIONS_UPDATED",
          resource: "role_permissions",
          payload: {
            role,
            updatedPermissions: [...normalized.values()]
          } as unknown as Prisma.InputJsonValue
        }
      });
    });

    return this.listRolePermissions(tenantId, role);
  }

  private async requireUser(tenantId: string, id: string): Promise<User> {
    const row = await this.prisma.user.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null
      }
    });

    if (!row) {
      throw new NotFoundException("User not found.");
    }

    return row;
  }

  private async requireUserWithRole(
    tenantId: string,
    id: string,
    role: UserRole,
    message: string
  ): Promise<User> {
    const row = await this.requireUser(tenantId, id);
    if (row.role !== role) {
      throw new ConflictException(message);
    }
    return row;
  }

  private async requireClassroom(
    tenantId: string,
    id: string
  ): Promise<{ id: string; schoolYearId: string; label: string }> {
    const row = await this.prisma.classroom.findFirst({
      where: { id, tenantId },
      select: { id: true, schoolYearId: true, label: true }
    });

    if (!row) {
      throw new NotFoundException("Classroom not found.");
    }

    return row;
  }

  private async requireSchoolYear(
    tenantId: string,
    id: string
  ): Promise<{ id: string; code: string }> {
    const row = await this.prisma.schoolYear.findFirst({
      where: { id, tenantId },
      select: { id: true, code: true }
    });

    if (!row) {
      throw new NotFoundException("School year not found.");
    }

    return row;
  }

  private async requireSubject(
    tenantId: string,
    id: string
  ): Promise<{ id: string; label: string }> {
    const row = await this.prisma.subject.findFirst({
      where: { id, tenantId },
      select: { id: true, label: true }
    });

    if (!row) {
      throw new NotFoundException("Subject not found.");
    }

    return row;
  }

  private async requireStudent(tenantId: string, id: string): Promise<void> {
    const row = await this.prisma.student.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null
      },
      select: { id: true }
    });

    if (!row) {
      throw new NotFoundException("Student not found.");
    }
  }

  private async logAudit(
    tenantId: string,
    actorUserId: string,
    action: string,
    resource: string,
    resourceId: string,
    payload?: Prisma.InputJsonValue
  ): Promise<void> {
    await this.prisma.iamAuditLog.create({
      data: {
        tenantId,
        userId: actorUserId,
        action,
        resource,
        resourceId,
        payload
      }
    });
  }

  private toView(row: User): UserView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      username: row.username,
      role: row.role as UserRole,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private teacherAssignmentView(row: TeacherAssignmentWithRelations): TeacherAssignmentView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      userId: row.userId,
      classId: row.classId,
      schoolYearId: row.schoolYearId,
      subjectId: row.subjectId || undefined,
      teacherUsername: row.user.username,
      classLabel: row.classroom.label,
      schoolYearCode: row.schoolYear.code,
      subjectLabel: row.subject?.label,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private parentLinkView(row: ParentLinkWithRelations): ParentLinkView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      parentUserId: row.parentUserId,
      studentId: row.studentId,
      relationship: row.relationship || undefined,
      isPrimary: row.isPrimary,
      parentUsername: row.parent.username,
      studentMatricule: row.student.matricule,
      studentName: `${row.student.firstName} ${row.student.lastName}`.trim(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private handleKnownPrismaConflict(error: unknown, message: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException(message);
    }
  }
}
