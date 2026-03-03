import { SetMetadata } from "@nestjs/common";

import {
  type PermissionAction,
  type PermissionRequirement,
  type PermissionResource
} from "./permissions.types";

export const PERMISSIONS_KEY = "permissions";

export const RequirePermissions = (
  ...permissions: PermissionRequirement[]
): ReturnType<typeof SetMetadata> => SetMetadata(PERMISSIONS_KEY, permissions);

export const RequirePermission = (
  resource: PermissionResource,
  action: PermissionAction
): ReturnType<typeof SetMetadata> =>
  RequirePermissions({ resource, action });
