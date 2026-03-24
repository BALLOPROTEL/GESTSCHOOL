import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { ROLES_KEY } from "./roles.decorator";
import { type AuthenticatedUser } from "./authenticated-user.interface";
import { UserRole } from "./roles.enum";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
    }>();

    const role = request.user?.role;
    if (!role || !Object.values(UserRole).includes(role)) {
      throw new ForbiddenException("Role missing or invalid in token.");
    }

    if (!requiredRoles.includes(role)) {
      throw new ForbiddenException("You are not allowed to access this route.");
    }

    return true;
  }
}
