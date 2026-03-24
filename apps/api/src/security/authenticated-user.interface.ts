import { UserRole } from "./roles.enum";

export type AuthenticatedUser = {
  sub: string;
  username: string;
  role: UserRole;
  tenantId: string;
  iat?: number;
  exp?: number;
};
