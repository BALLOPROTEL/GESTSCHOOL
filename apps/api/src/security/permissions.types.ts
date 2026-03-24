import { UserRole } from "./roles.enum";

export const PERMISSION_RESOURCES = [
  "students",
  "users",
  "teacherPortal",
  "parentPortal",
  "enrollments",
  "reference",
  "finance",
  "payments",
  "grades",
  "reportCards",
  "attendance",
  "attendanceAttachment",
  "attendanceValidation",
  "timetable",
  "notifications",
  "mosque",
  "analytics",
  "audit"
] as const;

export type PermissionResource =
  (typeof PERMISSION_RESOURCES)[number];

export const PERMISSION_ACTIONS = [
  "read",
  "create",
  "update",
  "delete",
  "validate",
  "dispatch"
] as const;

export type PermissionAction =
  (typeof PERMISSION_ACTIONS)[number];

export type PermissionRequirement = {
  resource: PermissionResource;
  action: PermissionAction;
};

type RolePermissionMatrix = Record<
  UserRole,
  Partial<Record<PermissionResource, PermissionAction[]>>
>;

const CRUD: PermissionAction[] = ["read", "create", "update", "delete"];
const READ_ONLY: PermissionAction[] = ["read"];
const FULL_NOTIFICATIONS: PermissionAction[] = [
  "read",
  "create",
  "update",
  "delete",
  "dispatch"
];

const clone = (actions: PermissionAction[]): PermissionAction[] => [...actions];

export const ROLE_PERMISSION_MATRIX: RolePermissionMatrix = {
  [UserRole.ADMIN]: {
    students: clone(CRUD),
    users: clone(CRUD),
    teacherPortal: clone(CRUD),
    parentPortal: clone(CRUD),
    enrollments: clone(CRUD),
    reference: clone(CRUD),
    finance: clone(CRUD),
    payments: clone(CRUD),
    grades: clone(CRUD),
    reportCards: clone(CRUD),
    attendance: clone(CRUD),
    attendanceAttachment: clone(CRUD),
    attendanceValidation: ["read", "validate"],
    timetable: clone(CRUD),
    notifications: clone(FULL_NOTIFICATIONS),
    mosque: clone(CRUD),
    analytics: clone(READ_ONLY),
    audit: clone(READ_ONLY)
  },
  [UserRole.SCOLARITE]: {
    students: clone(CRUD),
    teacherPortal: clone(READ_ONLY),
    parentPortal: clone(READ_ONLY),
    enrollments: clone(CRUD),
    reference: clone(CRUD),
    finance: clone(READ_ONLY),
    payments: clone(READ_ONLY),
    grades: ["read", "create", "update"],
    reportCards: ["read", "create"],
    attendance: clone(CRUD),
    attendanceAttachment: clone(CRUD),
    attendanceValidation: ["read", "validate"],
    timetable: clone(CRUD),
    notifications: clone(FULL_NOTIFICATIONS)
  },
  [UserRole.ENSEIGNANT]: {
    teacherPortal: ["read", "create", "update"]
  },
  [UserRole.COMPTABLE]: {
    finance: clone(CRUD),
    payments: clone(CRUD),
    mosque: clone(CRUD)
  },
  [UserRole.PARENT]: {
    parentPortal: clone(READ_ONLY)
  }
};

export const hasPermission = (
  role: UserRole,
  requirement: PermissionRequirement
): boolean => {
  const resourcePermissions = ROLE_PERMISSION_MATRIX[role]?.[requirement.resource] || [];
  return resourcePermissions.includes(requirement.action);
};
