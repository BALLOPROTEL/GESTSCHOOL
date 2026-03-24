import { ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { type AuthenticatedUser } from "../security/authenticated-user.interface";
import { resolveTenantId } from "./tenant.util";

export function resolveTenantContext(
  configService: ConfigService,
  user: AuthenticatedUser | undefined,
  tenantHeader?: string
): string {
  const defaultTenantId = configService.get<string>(
    "DEFAULT_TENANT_ID",
    "00000000-0000-0000-0000-000000000001"
  );

  if (user?.tenantId) {
    const resolved = resolveTenantId(tenantHeader, user.tenantId);
    if (resolved !== user.tenantId) {
      throw new ForbiddenException("x-tenant-id cannot override authenticated tenant.");
    }
    return user.tenantId;
  }

  return resolveTenantId(tenantHeader, defaultTenantId);
}
