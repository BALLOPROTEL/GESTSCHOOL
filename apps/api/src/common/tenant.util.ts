import { BadRequestException } from "@nestjs/common";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveTenantId(
  tenantHeaderValue: string | undefined,
  defaultTenantId: string
): string {
  const candidate = tenantHeaderValue?.trim() || defaultTenantId;

  if (!UUID_PATTERN.test(candidate)) {
    throw new BadRequestException("x-tenant-id must be a valid UUID.");
  }

  return candidate;
}
