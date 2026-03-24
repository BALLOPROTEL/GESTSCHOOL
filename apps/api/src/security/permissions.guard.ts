import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { PrismaService } from "../database/prisma.service";
import { type AuthenticatedUser } from "./authenticated-user.interface";
import { PERMISSIONS_KEY } from "./permissions.decorator";
import {
  hasPermission,
  type PermissionRequirement
} from "./permissions.types";
import { UserRole } from "./roles.enum";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<PermissionRequirement[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    const role = user?.role;

    if (!user || !role || !Object.values(UserRole).includes(role)) {
      throw new ForbiddenException("Role missing or invalid in token.");
    }

    const customPermissions = await this.prisma.rolePermission.findMany({
      where: {
        tenantId: user.tenantId,
        role,
        OR: requiredPermissions.map((permission) => ({
          resource: permission.resource,
          action: permission.action
        }))
      }
    });

    const customMap = new Map<string, boolean>();
    for (const entry of customPermissions) {
      customMap.set(`${entry.resource}:${entry.action}`, entry.allowed);
    }

    for (const requirement of requiredPermissions) {
      const key = `${requirement.resource}:${requirement.action}`;
      const effectivePermission = customMap.has(key)
        ? customMap.get(key) === true
        : hasPermission(role, requirement);

      if (!effectivePermission) {
        throw new ForbiddenException(
          `Missing permission ${requirement.resource}:${requirement.action}.`
        );
      }
    }

    return true;
  }
}
