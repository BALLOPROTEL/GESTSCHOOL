import { Children, FormEvent, ReactNode, cloneElement, isValidElement, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SchoolLifePanel } from "./school-life-panel";

type Session = {
  accessToken: string;
  refreshToken: string;
  user: { username: string; role: string; tenantId: string };
  tenantId: string;
};

type Student = {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  sex: "M" | "F";
  birthDate?: string;
};

type SchoolYear = { id: string; code: string; isActive: boolean };
type Cycle = { id: string; code: string; label: string };
type Level = { id: string; cycleId: string; code: string; label: string };
type ClassItem = { id: string; schoolYearId: string; levelId: string; code: string; label: string };
type Subject = { id: string; code: string; label: string; isArabic: boolean };
type Period = { id: string; schoolYearId: string; code: string; label: string; periodType: string };
type Enrollment = {
  id: string;
  schoolYearId: string;
  classId: string;
  studentId: string;
  enrollmentDate: string;
  enrollmentStatus: string;
  studentName?: string;
  classLabel?: string;
  schoolYearCode?: string;
};

type FeePlan = {
  id: string;
  schoolYearId: string;
  levelId: string;
  label: string;
  totalAmount: number;
  currency: string;
};

type Invoice = {
  id: string;
  studentId: string;
  schoolYearId: string;
  feePlanId?: string;
  invoiceNo: string;
  amountDue: number;
  amountPaid: number;
  remainingAmount: number;
  status: string;
  dueDate?: string;
  studentName?: string;
  schoolYearCode?: string;
  feePlanLabel?: string;
};

type PaymentRecord = {
  id: string;
  invoiceId: string;
  invoiceNo?: string;
  studentId?: string;
  studentName?: string;
  schoolYearId?: string;
  receiptNo: string;
  paidAmount: number;
  paymentMethod: string;
  paidAt: string;
  referenceExternal?: string;
};

type RecoveryDashboard = {
  totals: {
    amountDue: number;
    amountPaid: number;
    remainingAmount: number;
    recoveryRatePercent: number;
  };
  invoices: {
    total: number;
    open: number;
    partial: number;
    paid: number;
    void: number;
  };
};

type GradeEntry = {
  id: string;
  studentId: string;
  studentName?: string;
  classId: string;
  subjectId: string;
  subjectLabel?: string;
  academicPeriodId: string;
  assessmentLabel: string;
  assessmentType: string;
  score: number;
  scoreMax: number;
  absent: boolean;
};

type ClassSummaryStudent = {
  studentId: string;
  matricule: string;
  studentName: string;
  averageGeneral: number;
  classRank: number;
  noteCount: number;
  appreciation: string;
};

type ClassSummary = {
  classId: string;
  academicPeriodId: string;
  classAverage: number;
  students: ClassSummaryStudent[];
};

type ReportCard = {
  id: string;
  studentId: string;
  classId: string;
  academicPeriodId: string;
  averageGeneral: number;
  classRank?: number;
  appreciation?: string;
  pdfDataUrl?: string;
  studentName?: string;
  classLabel?: string;
  periodLabel?: string;
};

type WorkflowStepDef = {
  id: string;
  title: string;
  hint: string;
  done?: boolean;
};

type FieldErrors = Record<string, string>;
type ThemeMode = "light" | "dark";
type RememberedLogin = {
  username: string;
  tenantId?: string;
  remember: boolean;
};
type ForgotPasswordResponse = {
  message: string;
};
type AuthMessageResponse = {
  message: string;
};

const hasFieldErrors = (errors: FieldErrors): boolean => Object.keys(errors).length > 0;

const API = import.meta.env.DEV
  ? "/api/v1"
  : import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:3000/api/v1";
const DEFAULT_TENANT = "00000000-0000-0000-0000-000000000001";
const DEFAULT_CURRENCY = "CFA";
const SCHOOL_NAME = "Al Manarat Islamiyat";
const PLATFORM_NAME = "Gest-School";
const CHANNEL_LABELS: Record<string, string> = {
  CASH: "Especes",
  MOBILE_MONEY: "Mobile money",
  BANK: "Banque",
  TRANSFER: "Virement",
  OTHER: "Autre"
};
const STORAGE_KEY = "gestschool.web-admin.session";
const THEME_STORAGE_KEY = "gestschool.web-admin.theme";
const LOGIN_HINT_STORAGE_KEY = "gestschool.web-admin.login-hint";
const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{12,128}$/;
const STRONG_PASSWORD_HINT =
  "Le mot de passe doit contenir au moins 12 caracteres, avec majuscule, minuscule, chiffre et caractere special.";

const today = (): string => new Date().toISOString().slice(0, 10);
const isStrongPassword = (value: string): boolean => STRONG_PASSWORD_REGEX.test(value);
const formatLookupLabel = (map: Record<string, string>, value?: string): string => {
  const normalized = (value || "").trim().toUpperCase();
  return map[normalized] || value || "-";
};
const formatRoleLabel = (value?: string): string => formatLookupLabel(ROLE_LABELS, value);
const formatInvoiceStatusLabel = (value?: string): string => formatLookupLabel(INVOICE_STATUS_LABELS, value);
const formatAttendanceStatusLabel = (value?: string): string =>
  formatLookupLabel(ATTENDANCE_STATUS_LABELS, value);
const formatValidationStatusLabel = (value?: string): string =>
  formatLookupLabel(VALIDATION_STATUS_LABELS, value);
const formatPortalNotificationStatusLabel = (value?: string): string =>
  formatLookupLabel(PORTAL_NOTIFICATION_STATUS_LABELS, value);
const formatAudienceRoleLabel = (value?: string): string =>
  formatLookupLabel(AUDIENCE_ROLE_LABELS, value);
const formatMemberStatusLabel = (value?: string): string => formatLookupLabel(MEMBER_STATUS_LABELS, value);
const formatEnrollmentStatusLabel = (value?: string): string =>
  formatLookupLabel(ENROLLMENT_STATUS_LABELS, value);
const formatWeekdayLabel = (day?: number): string => WEEKDAY_LABELS[day || 0] || String(day || "-");
const formatPermissionActionLabel = (value: PermissionAction): string =>
  PERMISSION_ACTION_LABELS[value] || value;
const formatPermissionResourceLabel = (value: PermissionResource): string =>
  PERMISSION_RESOURCE_LABELS[value] || value;

const parseError = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { message?: string | string[]; error?: string };
    if (Array.isArray(payload.message)) return payload.message.join(", ");
    if (typeof payload.message === "string") return payload.message;
    if (typeof payload.error === "string") return payload.error;
  } catch {
    // ignore
  }
  if (response.status >= 500 && ["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return "Erreur API locale. Verifie que `pnpm dev:api` tourne puis redemarre `pnpm dev:web` pour recharger le proxy.";
  }
  return `Erreur HTTP ${response.status}`;
};

const triggerFileDownload = (fileName: string, dataUrl: string): void => {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.click();
};

const readRememberedLogin = (): RememberedLogin | null => {
  const raw = localStorage.getItem(LOGIN_HINT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RememberedLogin>;
    if (!parsed.remember) return null;
    if (typeof parsed.username !== "string") return null;
    return {
      username: parsed.username,
      tenantId: typeof parsed.tenantId === "string" ? parsed.tenantId : DEFAULT_TENANT,
      remember: true
    };
  } catch {
    return null;
  }
};

const readThemePreference = (): ThemeMode => {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
};

type Role = "ADMIN" | "SCOLARITE" | "ENSEIGNANT" | "COMPTABLE" | "PARENT";

type UserAccount = {
  id: string;
  tenantId: string;
  username: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type PermissionResource =
  | "students"
  | "users"
  | "teacherPortal"
  | "parentPortal"
  | "enrollments"
  | "reference"
  | "finance"
  | "payments"
  | "grades"
  | "reportCards"
  | "attendance"
  | "attendanceAttachment"
  | "attendanceValidation"
  | "timetable"
  | "notifications"
  | "mosque"
  | "analytics"
  | "audit";

type PermissionAction = "read" | "create" | "update" | "delete" | "validate" | "dispatch";

type RolePermissionView = {
  role: Role;
  resource: PermissionResource;
  action: PermissionAction;
  allowed: boolean;
  source: "DEFAULT" | "CUSTOM";
};

type TeacherAssignment = {
  id: string;
  userId: string;
  classId: string;
  schoolYearId: string;
  subjectId?: string;
  teacherUsername: string;
  classLabel: string;
  schoolYearCode: string;
  subjectLabel?: string;
};

type ParentLink = {
  id: string;
  parentUserId: string;
  studentId: string;
  relationship?: string;
  isPrimary: boolean;
  parentUsername: string;
  studentMatricule: string;
  studentName: string;
};

type TeacherOverview = {
  classesCount: number;
  studentsCount: number;
  gradesCount: number;
  pendingJustifications: number;
  timetableSlotsCount: number;
  notificationsCount: number;
};

type TeacherClass = {
  assignmentId: string;
  classId: string;
  classLabel: string;
  schoolYearId: string;
  schoolYearCode: string;
  subjectId?: string;
  subjectLabel?: string;
};

type TeacherStudent = {
  enrollmentId: string;
  studentId: string;
  matricule: string;
  studentName: string;
  classId: string;
  classLabel: string;
  schoolYearId: string;
  schoolYearCode: string;
};

type PortalNotification = {
  id: string;
  studentId?: string;
  studentName?: string;
  audienceRole?: string;
  title: string;
  message: string;
  channel: string;
  status: string;
  scheduledAt?: string;
  sentAt?: string;
  createdAt: string;
};

type ParentOverview = {
  childrenCount: number;
  openInvoicesCount: number;
  remainingAmount: number;
  absencesCount: number;
  reportCardsCount: number;
  notificationsCount: number;
};

type ParentChild = {
  linkId: string;
  studentId: string;
  matricule: string;
  studentName: string;
  relationship?: string;
  isPrimary: boolean;
  classId?: string;
  classLabel?: string;
  schoolYearId?: string;
  schoolYearCode?: string;
};

type MosqueMember = {
  id: string;
  tenantId: string;
  memberCode: string;
  fullName: string;
  sex?: "M" | "F";
  phone?: string;
  email?: string;
  address?: string;
  joinedAt?: string;
  status: "ACTIVE" | "INACTIVE";
};

type MosqueActivity = {
  id: string;
  tenantId: string;
  code: string;
  title: string;
  activityDate: string;
  category: string;
  location?: string;
  description?: string;
  isSchoolLinked: boolean;
};

type MosqueDonation = {
  id: string;
  tenantId: string;
  memberId?: string;
  memberCode?: string;
  memberName?: string;
  amount: number;
  currency: string;
  channel: string;
  donatedAt: string;
  referenceNo?: string;
  notes?: string;
};

type MosqueDashboard = {
  totals: {
    members: number;
    activeMembers: number;
    activitiesThisMonth: number;
    donationsThisMonth: number;
    donationsTotal: number;
    averageDonation: number;
  };
  donationsByChannel: Array<{
    channel: string;
    count: number;
    totalAmount: number;
  }>;
};

type MosqueExportResponse = {
  format: "PDF" | "EXCEL";
  fileName: string;
  mimeType: string;
  dataUrl: string;
  dataBase64: string;
  generatedAt: string;
  rowCount: number;
};

type MosqueDonationReceipt = {
  receiptNo: string;
  pdfDataUrl: string;
};

type AnalyticsTrendPoint = {
  bucket: string;
  label: string;
  value: number;
};

type AnalyticsOverview = {
  generatedAt: string;
  window: {
    from: string;
    to: string;
    days: number;
  };
  students: {
    total: number;
    active: number;
    createdInWindow: number;
  };
  academics: {
    schoolYears: number;
    classes: number;
    subjects: number;
    activeEnrollments: number;
  };
  finance: {
    amountDue: number;
    amountPaid: number;
    remainingAmount: number;
    recoveryRatePercent: number;
    paymentsInWindow: number;
    overdueInvoices: number;
  };
  schoolLife: {
    attendanceEntries: number;
    absences: number;
    justifiedAbsences: number;
    justificationRatePercent: number;
    notificationsQueued: number;
    notificationsFailed: number;
  };
  mosque: {
    members: number;
    activeMembers: number;
    activitiesInWindow: number;
    donationsInWindow: number;
    donationsCountInWindow: number;
  };
  trends: {
    payments: AnalyticsTrendPoint[];
    donations: AnalyticsTrendPoint[];
    absences: AnalyticsTrendPoint[];
  };
};

type AuditLogItem = {
  id: string;
  createdAt: string;
  action: string;
  resource: string;
  resourceId?: string;
  userId?: string;
  username?: string;
  payloadPreview?: string;
};

type AuditLogPage = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: AuditLogItem[];
};

type AuditLogExportResponse = {
  format: "PDF" | "EXCEL";
  fileName: string;
  mimeType: string;
  dataUrl: string;
  dataBase64: string;
  generatedAt: string;
  rowCount: number;
};

type ScreenId =
  | "dashboard"
  | "iam"
  | "students"
  | "reference"
  | "enrollments"
  | "finance"
  | "reports"
  | "mosque"
  | "grades"
  | "schoolLifeOverview"
  | "schoolLifeAttendance"
  | "schoolLifeTimetable"
  | "schoolLifeNotifications"
  | "teacherPortal"
  | "parentPortal";

type ScreenDef = {
  id: ScreenId;
  label: string;
  group: "principal" | "vie" | "portail";
  roles: Role[];
};

const SCREEN_DEFS: ScreenDef[] = [
  { id: "dashboard", label: "Tableau de bord", group: "principal", roles: ["ADMIN", "SCOLARITE", "COMPTABLE"] },
  { id: "iam", label: "Utilisateurs & droits", group: "principal", roles: ["ADMIN"] },
  { id: "students", label: "Eleves", group: "principal", roles: ["ADMIN", "SCOLARITE"] },
  { id: "reference", label: "Referentiel", group: "principal", roles: ["ADMIN", "SCOLARITE"] },
  { id: "enrollments", label: "Inscriptions", group: "principal", roles: ["ADMIN", "SCOLARITE"] },
  { id: "finance", label: "Comptabilite", group: "principal", roles: ["ADMIN", "SCOLARITE", "COMPTABLE"] },
  { id: "reports", label: "Rapports & conformite", group: "principal", roles: ["ADMIN"] },
  { id: "mosque", label: "Mosquee", group: "principal", roles: ["ADMIN", "COMPTABLE"] },
  { id: "grades", label: "Notes & bulletins", group: "principal", roles: ["ADMIN", "SCOLARITE"] },
  { id: "schoolLifeOverview", label: "Pilotage", group: "vie", roles: ["ADMIN", "SCOLARITE"] },
  { id: "schoolLifeAttendance", label: "Absences", group: "vie", roles: ["ADMIN", "SCOLARITE"] },
  { id: "schoolLifeTimetable", label: "Emploi du temps", group: "vie", roles: ["ADMIN", "SCOLARITE"] },
  { id: "schoolLifeNotifications", label: "Notifications", group: "vie", roles: ["ADMIN", "SCOLARITE"] },
  { id: "teacherPortal", label: "Portail enseignant", group: "portail", roles: ["ENSEIGNANT"] },
  { id: "parentPortal", label: "Portail parent", group: "portail", roles: ["PARENT"] }
];

const ROLE_HOME_SCREEN: Record<Role, ScreenId> = {
  ADMIN: "dashboard",
  SCOLARITE: "dashboard",
  ENSEIGNANT: "teacherPortal",
  COMPTABLE: "finance",
  PARENT: "parentPortal"
};

const ROLE_CONTEXT_LABELS: Record<Role, string> = {
  ADMIN: "Administration",
  SCOLARITE: "Scolarite",
  ENSEIGNANT: "Espace enseignant",
  COMPTABLE: "Espace comptable",
  PARENT: "Espace parent"
};

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  SCOLARITE: "Scolarite",
  ENSEIGNANT: "Enseignant",
  COMPTABLE: "Comptable",
  PARENT: "Parent"
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  OPEN: "Ouverte",
  PARTIAL: "Partiellement reglee",
  PAID: "Soldee",
  VOID: "Annulee"
};

const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Retard",
  EXCUSED: "Excuse"
};

const VALIDATION_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  APPROVED: "Validee",
  REJECTED: "Rejetee"
};

const PORTAL_NOTIFICATION_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  SCHEDULED: "Planifiee",
  SENT: "Envoyee",
  FAILED: "Echec",
  DELIVERED: "Livree",
  SENT_TO_PROVIDER: "Transmise",
  RETRYING: "Nouvelle tentative",
  UNDELIVERABLE: "Non distribuable"
};

const AUDIENCE_ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administration",
  SCOLARITE: "Scolarite",
  ENSEIGNANT: "Enseignants",
  COMPTABLE: "Comptabilite",
  PARENT: "Parents"
};

const MEMBER_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif",
  INACTIVE: "Inactif"
};

const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  ENROLLED: "Inscrit",
  PENDING: "En attente",
  CANCELLED: "Annulee",
  COMPLETED: "Finalisee"
};

const WEEKDAY_LABELS: Record<number, string> = {
  1: "Lundi",
  2: "Mardi",
  3: "Mercredi",
  4: "Jeudi",
  5: "Vendredi",
  6: "Samedi",
  7: "Dimanche"
};

const PERMISSION_ACTION_LABELS: Record<PermissionAction, string> = {
  read: "Lecture",
  create: "Creation",
  update: "Modification",
  delete: "Suppression",
  validate: "Validation",
  dispatch: "Envoi"
};

const PERMISSION_RESOURCE_LABELS: Record<PermissionResource, string> = {
  students: "Eleves",
  users: "Utilisateurs",
  teacherPortal: "Portail enseignant",
  parentPortal: "Portail parent",
  enrollments: "Inscriptions",
  reference: "Referentiel",
  finance: "Finance",
  payments: "Paiements",
  grades: "Notes",
  reportCards: "Bulletins",
  attendance: "Absences",
  attendanceAttachment: "Justificatifs",
  attendanceValidation: "Validation absences",
  timetable: "Emploi du temps",
  notifications: "Notifications",
  mosque: "Mosquee",
  analytics: "Analytique",
  audit: "Audit"
};

const hasScreenAccess = (role: Role, screen: ScreenId): boolean =>
  SCREEN_DEFS.some((entry) => entry.id === screen && entry.roles.includes(role));

const ROLE_VALUES: Role[] = ["ADMIN", "SCOLARITE", "ENSEIGNANT", "COMPTABLE", "PARENT"];
const PERMISSION_RESOURCE_VALUES: PermissionResource[] = [
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
];
const PERMISSION_ACTION_VALUES: PermissionAction[] = [
  "read",
  "create",
  "update",
  "delete",
  "validate",
  "dispatch"
];

type ModuleTone = "blue" | "orange" | "violet" | "green" | "teal" | "pink" | "indigo" | "slate";
type ModuleIconName =
  | "users"
  | "shield"
  | "clipboard"
  | "graduation"
  | "wallet"
  | "book"
  | "calendar"
  | "clock"
  | "bell"
  | "chart"
  | "settings"
  | "teacher"
  | "parent"
  | "moon";

type ModuleTile = {
  screen: ScreenId;
  title: string;
  subtitle: string;
  icon: ModuleIconName;
  tone: ModuleTone;
  tags: string[];
};

type HeroSlide = {
  quote: string;
  author: string;
  label: string;
};

const MODULE_TILES: ModuleTile[] = [
  {
    screen: "iam",
    title: "Utilisateurs & droits",
    subtitle: "Comptes, roles et permissions",
    icon: "shield",
    tone: "indigo",
    tags: ["users", "roles", "permissions", "iam"]
  },
  {
    screen: "students",
    title: "Eleves",
    subtitle: "Dossiers et profils",
    icon: "users",
    tone: "blue",
    tags: ["eleves", "matricule", "profil"]
  },
  {
    screen: "enrollments",
    title: "Inscriptions",
    subtitle: "Affectation classe/annee",
    icon: "clipboard",
    tone: "orange",
    tags: ["inscriptions", "admission", "classe"]
  },
  {
    screen: "schoolLifeOverview",
    title: "Vie scolaire",
    subtitle: "Pilotage quotidien",
    icon: "graduation",
    tone: "violet",
    tags: ["vie scolaire", "discipline", "suivi"]
  },
  {
    screen: "schoolLifeAttendance",
    title: "Absences",
    subtitle: "Pointage et justificatifs",
    icon: "calendar",
    tone: "pink",
    tags: ["absence", "retard", "justificatif"]
  },
  {
    screen: "schoolLifeTimetable",
    title: "Emploi du temps",
    subtitle: "Planning hebdomadaire",
    icon: "clock",
    tone: "teal",
    tags: ["planning", "emploi du temps", "cours"]
  },
  {
    screen: "schoolLifeNotifications",
    title: "Communication",
    subtitle: "Notifications multi-canal",
    icon: "bell",
    tone: "indigo",
    tags: ["communication", "notification", "messages"]
  },
  {
    screen: "finance",
    title: "Finance",
    subtitle: "Factures, paiements, recouvrement",
    icon: "wallet",
    tone: "green",
    tags: ["finance", "paiement", "facture"]
  },
  {
    screen: "reports",
    title: "Rapports & conformite",
    subtitle: "Indicateurs executifs et journal d'audit",
    icon: "chart",
    tone: "orange",
    tags: ["reporting", "audit", "conformite", "kpi"]
  },
  {
    screen: "mosque",
    title: "Mosquee",
    subtitle: "Membres, activites et dons",
    icon: "moon",
    tone: "teal",
    tags: ["mosquee", "dons", "activites", "membres"]
  },
  {
    screen: "grades",
    title: "Notes & bulletins",
    subtitle: "Evaluations et bulletins PDF",
    icon: "book",
    tone: "blue",
    tags: ["notes", "bulletin", "moyenne"]
  },
  {
    screen: "reference",
    title: "Parametres",
    subtitle: "Referentiel academique",
    icon: "settings",
    tone: "slate",
    tags: ["parametres", "referentiel", "configuration"]
  },
  {
    screen: "teacherPortal",
    title: "Portail enseignant",
    subtitle: "Espace pedagogique",
    icon: "teacher",
    tone: "orange",
    tags: ["enseignant", "portail", "pedagogie"]
  },
  {
    screen: "parentPortal",
    title: "Portail parent",
    subtitle: "Suivi famille",
    icon: "parent",
    tone: "violet",
    tags: ["parent", "famille", "suivi"]
  }
];

const HERO_SLIDES: HeroSlide[] = [
  {
    quote: "Ouvrez des ecoles, vous fermerez des prisons.",
    author: "Victor Hugo",
    label: "Citation"
  },
  {
    quote: "Bienvenue sur GestSchool: suivi unifie de la vie academique et financiere.",
    author: "Annonce Systeme",
    label: "Annonce"
  },
  {
    quote: "Un ecran clair, des workflows simples, une equipe plus efficace.",
    author: "Equipe Produit",
    label: "Vision"
  }
];

function ModuleIcon(props: { name: ModuleIconName }): JSX.Element {
  const { name } = props;

  if (name === "users") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm8 1a3 3 0 1 1 0-6 3 3 0 0 1 0 6ZM2 20a6 6 0 0 1 12 0H2Zm12 0a5 5 0 0 1 8 0h-8Z" />
      </svg>
    );
  }

  if (name === "shield") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Zm0 4.1 4 1.5v3.4c0 3.4-1.9 6.7-4 8.1-2.1-1.4-4-4.7-4-8.1V7.6l4-1.5Z" />
      </svg>
    );
  }

  if (name === "clipboard") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 2h6l1 2h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3l1-2Zm-2 8h10v2H7v-2Zm0 4h10v2H7v-2Z" />
      </svg>
    );
  }

  if (name === "graduation") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3 10 5-10 5L2 8l10-5Zm-6 8 6 3 6-3v4a6 6 0 1 1-12 0v-4Z" />
      </svg>
    );
  }

  if (name === "wallet") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 7a3 3 0 0 1 3-3h12v3h3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7Zm12 5h6v3h-6a1.5 1.5 0 1 1 0-3Z" />
      </svg>
    );
  }

  if (name === "book") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 4h7a3 3 0 0 1 3 3v13H7a3 3 0 0 0-3 3V4Zm16 0h-7a3 3 0 0 0-3 3v13h7a3 3 0 0 1 3 3V4Z" />
      </svg>
    );
  }

  if (name === "calendar") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2V2Zm-2 8h14v10H5V10Zm3 3h3v3H8v-3Z" />
      </svg>
    );
  }

  if (name === "clock") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm1 5h-2v6l5 3 1-1.7-4-2.3V7Z" />
      </svg>
    );
  }

  if (name === "bell") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2a6 6 0 0 1 6 6v3c0 1.5.6 3 1.7 4.1L21 16v2H3v-2l1.3-.9A5.8 5.8 0 0 0 6 11V8a6 6 0 0 1 6-6Zm0 20a3 3 0 0 1-2.8-2h5.6A3 3 0 0 1 12 22Z" />
      </svg>
    );
  }

  if (name === "chart") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 19h16v2H2V3h2v16Zm3-2H5v-6h2v6Zm5 0H9V7h3v10Zm5 0h-3V4h3v13Zm2-8h2v8h-2V9Z" />
      </svg>
    );
  }

  if (name === "settings") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 2 2 2.5 3.2-.3.8 3 2.8 1.6-1.6 2.8.8 3-3 .8-2 2.5-2-2.5-3 .8-.8-3-2.8-1.6 1.6-2.8-.8-3 3.2-.3L12 2Zm0 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
      </svg>
    );
  }

  if (name === "teacher") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM4 20a8 8 0 0 1 16 0H4Zm11-8h7v7h-7v-7Zm2 2v3h3v-3h-3Z" />
      </svg>
    );
  }

  if (name === "moon") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13.7 2.1A9.8 9.8 0 1 0 22 15.8a8.2 8.2 0 0 1-10.1-13.7h1.8Zm-.8 2.5a6.6 6.6 0 1 1-7.4 9.8 8.3 8.3 0 0 0 7.4-9.8Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm-8 17a8 8 0 0 1 16 0H4Z" />
    </svg>
  );
}

function WorkflowGuide(props: {
  title: string;
  steps: WorkflowStepDef[];
  activeStepId: string;
  onStepChange: (stepId: string) => void;
  children: ReactNode;
}): JSX.Element {
  const { title, steps, activeStepId, onStepChange, children } = props;
  const activeStep = steps.find((step) => step.id === activeStepId) || steps[0];

  const walk = (currentNode: ReactNode): ReactNode =>
    Children.map(currentNode, (node) => {
      if (!isValidElement(node)) return node;

      const currentProps = node.props as {
        children?: ReactNode;
        className?: string;
        ["data-step-id"]?: string;
      };

      const nestedChildren = walk(currentProps.children);
      const stepId = currentProps["data-step-id"];
      const isStepNode = typeof stepId === "string" && stepId.length > 0;

      if (!isStepNode) {
        if (nestedChildren !== currentProps.children) {
          return cloneElement(node, { children: nestedChildren });
        }
        return node;
      }

      const isActive = stepId === activeStep.id;
      const className = [currentProps.className, isActive ? "workflow-step-active" : "workflow-hidden"]
        .filter(Boolean)
        .join(" ");

      return cloneElement(node, {
        className,
        "aria-hidden": !isActive,
        "data-active-step": isActive ? "true" : "false",
        children: nestedChildren
      });
    });

  const managedChildren = walk(children);

  return (
    <section className="workflow-shell workflow-shell-compact">
      {steps.length > 1 ? (
        <div className="workflow-tabs" role="tablist" aria-label={title}>
          {steps.map((step) => (
            <button
              key={step.id}
              type="button"
              role="tab"
              aria-selected={step.id === activeStep.id}
              className={`workflow-tab ${step.id === activeStep.id ? "is-active" : ""}`.trim()}
              onClick={() => onStepChange(step.id)}
            >
              {step.title}
            </button>
          ))}
        </div>
      ) : null}
      <div className="workflow-body">{managedChildren}</div>
    </section>
  );
}

export function App(): JSX.Element {
  const [tab, setTab] = useState<ScreenId>("dashboard");
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(session);
  const rememberedLogin = useMemo(() => readRememberedLogin(), []);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readThemePreference());

  const [loginForm, setLoginForm] = useState({
    username: rememberedLogin?.username || "",
    password: "",
    tenantId: rememberedLogin?.tenantId || DEFAULT_TENANT
  });
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [rememberMe, setRememberMe] = useState(Boolean(rememberedLogin?.remember));
  const [authAssistMode, setAuthAssistMode] = useState<"none" | "forgot" | "first">("none");
  const [authAssistLoading, setAuthAssistLoading] = useState(false);
  const [forgotPasswordForm, setForgotPasswordForm] = useState({
    username: rememberedLogin?.username || "",
    tenantId: rememberedLogin?.tenantId || DEFAULT_TENANT
  });
  const [resetPasswordForm, setResetPasswordForm] = useState({
    token: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [firstConnectionForm, setFirstConnectionForm] = useState({
    username: rememberedLogin?.username || "",
    tenantId: rememberedLogin?.tenantId || DEFAULT_TENANT,
    temporaryPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentForm, setStudentForm] = useState({
    matricule: "",
    firstName: "",
    lastName: "",
    sex: "M" as "M" | "F",
    birthDate: ""
  });

  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);

  const [levelCycleFilter, setLevelCycleFilter] = useState("");
  const [classYearFilter, setClassYearFilter] = useState("");
  const [classLevelFilter, setClassLevelFilter] = useState("");
  const [periodYearFilter, setPeriodYearFilter] = useState("");

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [enrollmentFilters, setEnrollmentFilters] = useState({ schoolYearId: "", classId: "", studentId: "" });
  const [enrollmentForm, setEnrollmentForm] = useState({
    schoolYearId: "",
    classId: "",
    studentId: "",
    enrollmentDate: today(),
    enrollmentStatus: "ENROLLED"
  });

  const [syForm, setSyForm] = useState({ code: "", startDate: "", endDate: "", isActive: false });
  const [cycleForm, setCycleForm] = useState({ code: "", label: "", sortOrder: 1 });
  const [levelForm, setLevelForm] = useState({ cycleId: "", code: "", label: "", sortOrder: 1 });
  const [classForm, setClassForm] = useState({ schoolYearId: "", levelId: "", code: "", label: "", capacity: "" });
  const [subjectForm, setSubjectForm] = useState({ code: "", label: "", isArabic: false });
  const [periodForm, setPeriodForm] = useState({
    schoolYearId: "",
    code: "",
    label: "",
    startDate: "",
    endDate: "",
    periodType: "TRIMESTER"
  });

  const [feePlans, setFeePlans] = useState<FeePlan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [recovery, setRecovery] = useState<RecoveryDashboard | null>(null);

  const [feePlanForm, setFeePlanForm] = useState({
    schoolYearId: "",
    levelId: "",
    label: "",
    totalAmount: "",
      currency: DEFAULT_CURRENCY
  });
  const [invoiceForm, setInvoiceForm] = useState({
    studentId: "",
    schoolYearId: "",
    feePlanId: "",
    amountDue: "",
    dueDate: ""
  });
  const [paymentForm, setPaymentForm] = useState({
    invoiceId: "",
    paidAmount: "",
    paymentMethod: "CASH",
    referenceExternal: ""
  });

  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [gradeFilters, setGradeFilters] = useState({
    classId: "",
    subjectId: "",
    academicPeriodId: "",
    studentId: ""
  });
  const [gradeForm, setGradeForm] = useState({
    studentId: "",
    classId: "",
    subjectId: "",
    academicPeriodId: "",
    assessmentLabel: "Devoir 1",
    assessmentType: "DEVOIR",
    score: "",
    scoreMax: "20"
  });
  const [classSummary, setClassSummary] = useState<ClassSummary | null>(null);
  const [reportCards, setReportCards] = useState<ReportCard[]>([]);
  const [reportForm, setReportForm] = useState({
    studentId: "",
    classId: "",
    academicPeriodId: ""
  });
  const [receiptPdfUrl, setReceiptPdfUrl] = useState("");
  const [reportPdfUrl, setReportPdfUrl] = useState("");
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherAssignment[]>([]);
  const [parentLinks, setParentLinks] = useState<ParentLink[]>([]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
    username: "",
    password: "",
    role: "ENSEIGNANT" as Role,
    isActive: true
  });
  const [rolePermissionTarget, setRolePermissionTarget] = useState<Role>("ADMIN");
  const [rolePermissions, setRolePermissions] = useState<RolePermissionView[]>([]);
  const [teacherAssignmentForm, setTeacherAssignmentForm] = useState({
    userId: "",
    classId: "",
    schoolYearId: "",
    subjectId: ""
  });
  const [parentLinkForm, setParentLinkForm] = useState({
    parentUserId: "",
    studentId: "",
    relationship: "",
    isPrimary: false
  });

  const [teacherOverview, setTeacherOverview] = useState<TeacherOverview | null>(null);
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [teacherStudents, setTeacherStudents] = useState<TeacherStudent[]>([]);
  const [teacherGrades, setTeacherGrades] = useState<GradeEntry[]>([]);
  const [teacherTimetable, setTeacherTimetable] = useState<
    Array<{
      id: string;
      classId: string;
      classLabel?: string;
      schoolYearId: string;
      schoolYearCode?: string;
      subjectId: string;
      subjectLabel?: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      room?: string;
      teacherName?: string;
    }>
  >([]);
  const [teacherNotifications, setTeacherNotifications] = useState<PortalNotification[]>([]);
  const [teacherPortalFilters, setTeacherPortalFilters] = useState({
    classId: "",
    subjectId: "",
    academicPeriodId: "",
    studentId: ""
  });
  const [teacherGradeForm, setTeacherGradeForm] = useState({
    studentId: "",
    classId: "",
    subjectId: "",
    academicPeriodId: "",
    assessmentLabel: "Devoir 1",
    assessmentType: "DEVOIR",
    score: "",
    scoreMax: "20",
    comment: ""
  });
  const [teacherAttendanceForm, setTeacherAttendanceForm] = useState({
    classId: "",
    attendanceDate: today(),
    defaultStatus: "PRESENT",
    reason: ""
  });
  const [teacherAttendanceStudents, setTeacherAttendanceStudents] = useState<string[]>([]);
  const [teacherNotificationForm, setTeacherNotificationForm] = useState({
    classId: "",
    studentId: "",
    title: "",
    message: "",
    channel: "IN_APP"
  });

  const [parentOverview, setParentOverview] = useState<ParentOverview | null>(null);
  const [parentChildren, setParentChildren] = useState<ParentChild[]>([]);
  const [parentGrades, setParentGrades] = useState<
    Array<
      GradeEntry & {
        classLabel?: string;
        periodLabel?: string;
      }
    >
  >([]);
  const [parentReportCards, setParentReportCards] = useState<ReportCard[]>([]);
  const [parentAttendance, setParentAttendance] = useState<
    Array<{
      id: string;
      studentId: string;
      studentName?: string;
      classId: string;
      classLabel?: string;
      attendanceDate: string;
      status: string;
      reason?: string;
      justificationStatus: string;
    }>
  >([]);
  const [parentInvoices, setParentInvoices] = useState<Invoice[]>([]);
  const [parentPayments, setParentPayments] = useState<PaymentRecord[]>([]);
  const [parentTimetable, setParentTimetable] = useState<
    Array<{
      slotId: string;
      studentId: string;
      studentName: string;
      classId: string;
      classLabel: string;
      schoolYearId: string;
      schoolYearCode?: string;
      subjectLabel: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      room?: string;
      teacherName?: string;
    }>
  >([]);
  const [parentNotifications, setParentNotifications] = useState<PortalNotification[]>([]);
  const [parentStudentFilter, setParentStudentFilter] = useState("");

  const [mosqueDashboard, setMosqueDashboard] = useState<MosqueDashboard | null>(null);
  const [mosqueMembers, setMosqueMembers] = useState<MosqueMember[]>([]);
  const [mosqueActivities, setMosqueActivities] = useState<MosqueActivity[]>([]);
  const [mosqueDonations, setMosqueDonations] = useState<MosqueDonation[]>([]);
  const [mosqueMemberFilters, setMosqueMemberFilters] = useState({ status: "", q: "" });
  const [mosqueActivityFilters, setMosqueActivityFilters] = useState({
    category: "",
    from: "",
    to: "",
    q: ""
  });
  const [mosqueDonationFilters, setMosqueDonationFilters] = useState({
    memberId: "",
    channel: "",
    from: "",
    to: ""
  });
  const [mosqueMemberForm, setMosqueMemberForm] = useState({
    memberCode: "",
    fullName: "",
    sex: "",
    phone: "",
    email: "",
    address: "",
    joinedAt: "",
    status: "ACTIVE"
  });
  const [mosqueActivityForm, setMosqueActivityForm] = useState({
    code: "",
    title: "",
    activityDate: today(),
    category: "JUMUAH",
    location: "",
    description: "",
    isSchoolLinked: false
  });
  const [mosqueDonationForm, setMosqueDonationForm] = useState({
    memberId: "",
    amount: "",
    currency: DEFAULT_CURRENCY,
    channel: "CASH",
    donatedAt: `${today()}T08:00`,
    referenceNo: "",
    notes: ""
  });
  const [mosqueExportFormat, setMosqueExportFormat] = useState<"PDF" | "EXCEL">("PDF");
  const [analyticsOverview, setAnalyticsOverview] = useState<AnalyticsOverview | null>(null);
  const [analyticsFilters, setAnalyticsFilters] = useState({
    from: "",
    to: "",
    schoolYearId: ""
  });
  const [auditLogs, setAuditLogs] = useState<AuditLogPage | null>(null);
  const [auditFilters, setAuditFilters] = useState({
    resource: "",
    action: "",
    userId: "",
    q: "",
    from: "",
    to: "",
    page: 1,
    pageSize: 20
  });
  const [auditExportFormat, setAuditExportFormat] = useState<"PDF" | "EXCEL">("PDF");
  const analyticsFiltersRef = useRef(analyticsFilters);
  const auditFiltersRef = useRef(auditFilters);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [moduleQueryInput, setModuleQueryInput] = useState("");
  const [moduleQuery, setModuleQuery] = useState("");
  const [studentWorkflowStep, setStudentWorkflowStep] = useState("entry");
  const [referenceWorkflowStep, setReferenceWorkflowStep] = useState("years");
  const [enrollmentWorkflowStep, setEnrollmentWorkflowStep] = useState("create");
  const [financeWorkflowStep, setFinanceWorkflowStep] = useState("overview");
  const [gradesWorkflowStep, setGradesWorkflowStep] = useState("filters");
  const [iamWorkflowStep, setIamWorkflowStep] = useState("accounts");
  const [mosqueWorkflowStep, setMosqueWorkflowStep] = useState("members");
  const [reportWorkflowStep, setReportWorkflowStep] = useState("overview");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const [loginErrors, setLoginErrors] = useState<FieldErrors>({});
  const [studentErrors, setStudentErrors] = useState<FieldErrors>({});
  const [enrollmentErrors, setEnrollmentErrors] = useState<FieldErrors>({});
  const [feePlanErrors, setFeePlanErrors] = useState<FieldErrors>({});
  const [invoiceErrors, setInvoiceErrors] = useState<FieldErrors>({});
  const [paymentErrors, setPaymentErrors] = useState<FieldErrors>({});
  const [gradeErrors, setGradeErrors] = useState<FieldErrors>({});
  const [reportErrors, setReportErrors] = useState<FieldErrors>({});
  const [schoolYearErrors, setSchoolYearErrors] = useState<FieldErrors>({});
  const [cycleErrors, setCycleErrors] = useState<FieldErrors>({});
  const [levelErrors, setLevelErrors] = useState<FieldErrors>({});
  const [classErrors, setClassErrors] = useState<FieldErrors>({});
  const [subjectErrors, setSubjectErrors] = useState<FieldErrors>({});
  const [periodErrors, setPeriodErrors] = useState<FieldErrors>({});
  const [userErrors, setUserErrors] = useState<FieldErrors>({});
  const [teacherAssignmentErrors, setTeacherAssignmentErrors] = useState<FieldErrors>({});
  const [parentLinkErrors, setParentLinkErrors] = useState<FieldErrors>({});
  const [teacherPortalErrors, setTeacherPortalErrors] = useState<FieldErrors>({});
  const [mosqueMemberErrors, setMosqueMemberErrors] = useState<FieldErrors>({});
  const [mosqueActivityErrors, setMosqueActivityErrors] = useState<FieldErrors>({});
  const [mosqueDonationErrors, setMosqueDonationErrors] = useState<FieldErrors>({});

  const currentRole = (session?.user.role as Role | undefined) || null;
  const currentRoleLabel = currentRole ? formatRoleLabel(currentRole) : "Visiteur";
  const fieldError = (errors: FieldErrors, key: string): JSX.Element | null =>
    errors[key] ? <span className="field-error">{errors[key]}</span> : null;
  const focusFirstInlineErrorField = (stepId?: string): void => {
    window.setTimeout(() => {
      const scope = stepId
        ? document.querySelector(`[data-step-id="${stepId}"][data-active-step="true"]`)
        : document;

      if (!scope) return;
      const errorNode = scope.querySelector(".field-error");
      if (!errorNode) return;

      const label = errorNode.closest("label");
      const input = label?.querySelector<HTMLElement>("input, select, textarea");
      if (!input) return;

      input.focus();
      input.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  };

  const schoolYearLabel = useMemo(() => {
    if (currentRole === "PARENT") {
      return (
        parentChildren.find((item) => item.schoolYearCode)?.schoolYearCode ||
        parentTimetable.find((item) => item.schoolYearCode)?.schoolYearCode ||
        "2025-2026"
      );
    }

    if (currentRole === "ENSEIGNANT") {
      return teacherClasses.find((item) => item.schoolYearCode)?.schoolYearCode || "2025-2026";
    }

    return schoolYears.find((item) => item.isActive)?.code || schoolYears[0]?.code || "2025-2026";
  }, [currentRole, parentChildren, parentTimetable, schoolYears, teacherClasses]);

  const homeTiles = useMemo(() => {
    if (!currentRole) return [] as ModuleTile[];

    return MODULE_TILES.filter((tile) => hasScreenAccess(currentRole, tile.screen));
  }, [currentRole]);

  const filteredTiles = useMemo(() => {
    const query = moduleQuery.trim().toLowerCase();
    if (!query) return homeTiles;

    return homeTiles.filter((tile) => {
      const haystack = [tile.title, tile.subtitle, ...tile.tags].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [homeTiles, moduleQuery]);

  const currentSlide = HERO_SLIDES[2];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setModuleQuery(moduleQueryInput);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [moduleQueryInput]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!error) {
      return undefined;
    }

    const timer = window.setTimeout(() => setError(null), 5200);
    return () => window.clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeMode);
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    analyticsFiltersRef.current = analyticsFilters;
  }, [analyticsFilters]);

  useEffect(() => {
    auditFiltersRef.current = auditFilters;
  }, [auditFilters]);

  useEffect(() => {
    if (session && !lastSyncAt) {
      setLastSyncAt(new Date().toISOString());
    }
  }, [lastSyncAt, session]);

  useEffect(() => {
    if (!currentRole) return;
    if (hasScreenAccess(currentRole, tab)) return;
    setTab(ROLE_HOME_SCREEN[currentRole] || "dashboard");
  }, [currentRole, tab]);

  const clearData = useCallback(() => {
    setStudents([]);
    setSchoolYears([]);
    setCycles([]);
    setLevels([]);
    setClasses([]);
    setSubjects([]);
    setPeriods([]);
    setEnrollments([]);
    setFeePlans([]);
    setInvoices([]);
    setPayments([]);
    setRecovery(null);
    setGrades([]);
    setClassSummary(null);
    setReportCards([]);
    setReceiptPdfUrl("");
    setReportPdfUrl("");
    setUsers([]);
    setTeacherAssignments([]);
    setParentLinks([]);
    setRolePermissions([]);
    setTeacherOverview(null);
    setTeacherClasses([]);
    setTeacherStudents([]);
    setTeacherGrades([]);
    setTeacherTimetable([]);
    setTeacherNotifications([]);
    setParentOverview(null);
    setParentChildren([]);
    setParentGrades([]);
    setParentReportCards([]);
    setParentAttendance([]);
    setParentInvoices([]);
    setParentPayments([]);
    setParentTimetable([]);
    setParentNotifications([]);
    setMosqueDashboard(null);
    setMosqueMembers([]);
    setMosqueActivities([]);
    setMosqueDonations([]);
    setMosqueExportFormat("PDF");
    setAnalyticsOverview(null);
    setAuditLogs(null);
    setAuditExportFormat("PDF");
    setReportWorkflowStep("overview");
    setLastSyncAt(null);
    setModuleQueryInput("");
    setModuleQuery("");
  }, []);

  const refresh = useCallback(async (): Promise<Session | null> => {
    const current = sessionRef.current;
    if (!current?.refreshToken) return null;
    try {
      const response = await fetch(`${API}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: current.refreshToken })
      });
      if (!response.ok) {
        setSession(null);
        clearData();
        setError("Session expiree.");
        return null;
      }
      const payload = (await response.json()) as Omit<Session, "tenantId"> & { user: Session["user"] };
      const next: Session = { ...payload, tenantId: current.tenantId || payload.user.tenantId };
      setSession(next);
      setLastSyncAt(new Date().toISOString());
      setNotice("Session actualisee.");
      return next;
    } catch {
      setSession(null);
      clearData();
      setError("API indisponible ou CORS refuse. Verifie CORS_ORIGINS sur Render.");
      return null;
    }
  }, [clearData]);

  const api = useCallback(
    async (path: string, init: RequestInit = {}, retry = true): Promise<Response> => {
      const send = async (active: Session | null): Promise<Response> => {
        const headers = new Headers(init.headers ?? {});
        if (init.body !== undefined && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
          headers.set("Content-Type", "application/json");
        }
        if (active?.accessToken) headers.set("Authorization", `Bearer ${active.accessToken}`);
        if (active?.tenantId) headers.set("x-tenant-id", active.tenantId);
        return fetch(`${API}${path}`, { ...init, headers });
      };
      const first = await send(sessionRef.current);
      if (first.status !== 401 || !retry || !sessionRef.current?.refreshToken) return first;
      const next = await refresh();
      if (!next) return first;
      return send(next);
    },
    [refresh]
  );

  const loadStudents = useCallback(async () => {
    if (!sessionRef.current) return;
    setStudentsLoading(true);
    const response = await api("/students");
    setStudentsLoading(false);
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setStudents((await response.json()) as Student[]);
  }, [api]);

  const loadUsers = useCallback(async () => {
    if (!sessionRef.current) return;
    const response = await api("/users");
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setUsers((await response.json()) as UserAccount[]);
  }, [api]);

  const loadRolePermissions = useCallback(
    async (role = rolePermissionTarget) => {
      if (!sessionRef.current) return;
      const response = await api(`/users/roles/${encodeURIComponent(role)}/permissions`);
      if (!response.ok) {
        setError(await parseError(response));
        return;
      }
      setRolePermissions((await response.json()) as RolePermissionView[]);
    },
    [api, rolePermissionTarget]
  );

  const loadTeacherAssignments = useCallback(async () => {
    if (!sessionRef.current) return;
    const response = await api("/users/teacher-assignments");
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setTeacherAssignments((await response.json()) as TeacherAssignment[]);
  }, [api]);

  const loadParentLinks = useCallback(async () => {
    if (!sessionRef.current) return;
    const response = await api("/users/parent-links");
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setParentLinks((await response.json()) as ParentLink[]);
  }, [api]);

  const loadTeacherPortalData = useCallback(
    async (filters = teacherPortalFilters) => {
      if (!sessionRef.current) return;
      const query = new URLSearchParams();
      if (filters.classId) query.set("classId", filters.classId);
      if (filters.subjectId) query.set("subjectId", filters.subjectId);
      if (filters.academicPeriodId) query.set("academicPeriodId", filters.academicPeriodId);
      if (filters.studentId) query.set("studentId", filters.studentId);
      const suffix = query.toString() ? `?${query.toString()}` : "";

      const responses = await Promise.all([
        api("/portal/teacher/overview"),
        api("/portal/teacher/classes"),
        api(`/portal/teacher/students${filters.classId ? `?classId=${encodeURIComponent(filters.classId)}` : ""}`),
        api(`/portal/teacher/grades${suffix}`),
        api(`/portal/teacher/timetable${filters.classId ? `?classId=${encodeURIComponent(filters.classId)}` : ""}`),
        api(`/portal/teacher/notifications${filters.classId ? `?classId=${encodeURIComponent(filters.classId)}` : ""}`)
      ]);

      const failed = responses.find((item) => !item.ok);
      if (failed) {
        setError(await parseError(failed));
        return;
      }

      const [overview, classRows, studentRows, gradeRows, timetableRows, notificationRows] = await Promise.all([
        responses[0].json() as Promise<TeacherOverview>,
        responses[1].json() as Promise<TeacherClass[]>,
        responses[2].json() as Promise<TeacherStudent[]>,
        responses[3].json() as Promise<GradeEntry[]>,
        responses[4].json() as Promise<
          Array<{
            id: string;
            classId: string;
            classLabel?: string;
            schoolYearId: string;
            schoolYearCode?: string;
            subjectId: string;
            subjectLabel?: string;
            dayOfWeek: number;
            startTime: string;
            endTime: string;
            room?: string;
            teacherName?: string;
          }>
        >,
        responses[5].json() as Promise<PortalNotification[]>
      ]);

      setTeacherOverview(overview);
      setTeacherClasses(classRows);
      setTeacherStudents(studentRows);
      setTeacherGrades(gradeRows);
      setTeacherTimetable(timetableRows);
      setTeacherNotifications(notificationRows);
    },
    [api, teacherPortalFilters]
  );

  const loadParentPortalData = useCallback(
    async (studentId = parentStudentFilter) => {
      if (!sessionRef.current) return;
      const query = studentId ? `?studentId=${encodeURIComponent(studentId)}` : "";

      const responses = await Promise.all([
        api("/portal/parent/overview"),
        api("/portal/parent/children"),
        api(`/portal/parent/grades${query}`),
        api(`/portal/parent/report-cards${query}`),
        api(`/portal/parent/attendance${query}`),
        api(`/portal/parent/invoices${query}`),
        api(`/portal/parent/payments${query}`),
        api(`/portal/parent/timetable${query}`),
        api(`/portal/parent/notifications${query}`)
      ]);

      const failed = responses.find((item) => !item.ok);
      if (failed) {
        setError(await parseError(failed));
        return;
      }

      const [
        overview,
        childrenRows,
        gradeRows,
        reportRows,
        attendanceRows,
        invoiceRows,
        paymentRows,
        timetableRows,
        notificationRows
      ] = await Promise.all([
        responses[0].json() as Promise<ParentOverview>,
        responses[1].json() as Promise<ParentChild[]>,
        responses[2].json() as Promise<Array<GradeEntry & { classLabel?: string; periodLabel?: string }>>,
        responses[3].json() as Promise<ReportCard[]>,
        responses[4].json() as Promise<
          Array<{
            id: string;
            studentId: string;
            studentName?: string;
            classId: string;
            classLabel?: string;
            attendanceDate: string;
            status: string;
            reason?: string;
            justificationStatus: string;
          }>
        >,
        responses[5].json() as Promise<Invoice[]>,
        responses[6].json() as Promise<PaymentRecord[]>,
        responses[7].json() as Promise<
          Array<{
            slotId: string;
            studentId: string;
            studentName: string;
            classId: string;
            classLabel: string;
            schoolYearId: string;
            schoolYearCode?: string;
            subjectLabel: string;
            dayOfWeek: number;
            startTime: string;
            endTime: string;
            room?: string;
            teacherName?: string;
          }>
        >,
        responses[8].json() as Promise<PortalNotification[]>
      ]);

      setParentOverview(overview);
      setParentChildren(childrenRows);
      setParentGrades(gradeRows);
      setParentReportCards(reportRows);
      setParentAttendance(attendanceRows);
      setParentInvoices(invoiceRows);
      setParentPayments(paymentRows);
      setParentTimetable(timetableRows);
      setParentNotifications(notificationRows);
    },
    [api, parentStudentFilter]
  );

  const loadMosqueData = useCallback(
    async (filters = {
      memberFilters: mosqueMemberFilters,
      activityFilters: mosqueActivityFilters,
      donationFilters: mosqueDonationFilters
    }) => {
      if (!sessionRef.current) return;

      const memberQuery = new URLSearchParams();
      if (filters.memberFilters.status) memberQuery.set("status", filters.memberFilters.status);
      if (filters.memberFilters.q.trim()) memberQuery.set("q", filters.memberFilters.q.trim());
      const memberSuffix = memberQuery.toString() ? `?${memberQuery.toString()}` : "";

      const activityQuery = new URLSearchParams();
      if (filters.activityFilters.category) activityQuery.set("category", filters.activityFilters.category);
      if (filters.activityFilters.from) activityQuery.set("from", filters.activityFilters.from);
      if (filters.activityFilters.to) activityQuery.set("to", filters.activityFilters.to);
      if (filters.activityFilters.q.trim()) activityQuery.set("q", filters.activityFilters.q.trim());
      const activitySuffix = activityQuery.toString() ? `?${activityQuery.toString()}` : "";

      const donationQuery = new URLSearchParams();
      if (filters.donationFilters.memberId) donationQuery.set("memberId", filters.donationFilters.memberId);
      if (filters.donationFilters.channel) donationQuery.set("channel", filters.donationFilters.channel);
      if (filters.donationFilters.from) donationQuery.set("from", filters.donationFilters.from);
      if (filters.donationFilters.to) donationQuery.set("to", filters.donationFilters.to);
      const donationSuffix = donationQuery.toString() ? `?${donationQuery.toString()}` : "";

      const responses = await Promise.all([
        api("/mosque/dashboard"),
        api(`/mosque/members${memberSuffix}`),
        api(`/mosque/activities${activitySuffix}`),
        api(`/mosque/donations${donationSuffix}`)
      ]);

      const failed = responses.find((item) => !item.ok);
      if (failed) {
        setError(await parseError(failed));
        return;
      }

      const [dashboardView, memberRows, activityRows, donationRows] = await Promise.all([
        responses[0].json() as Promise<MosqueDashboard>,
        responses[1].json() as Promise<MosqueMember[]>,
        responses[2].json() as Promise<MosqueActivity[]>,
        responses[3].json() as Promise<MosqueDonation[]>
      ]);

      setMosqueDashboard(dashboardView);
      setMosqueMembers(memberRows);
      setMosqueActivities(activityRows);
      setMosqueDonations(donationRows);
    },
    [api, mosqueActivityFilters, mosqueDonationFilters, mosqueMemberFilters]
  );

  const loadAnalytics = useCallback(
    async (filters: { from: string; to: string; schoolYearId: string }) => {
      if (!sessionRef.current) return;
      const query = new URLSearchParams();
      if (filters.from) query.set("from", filters.from);
      if (filters.to) query.set("to", filters.to);
      if (filters.schoolYearId) query.set("schoolYearId", filters.schoolYearId);
      const suffix = query.toString() ? `?${query.toString()}` : "";
      const response = await api(`/analytics/overview${suffix}`);
      if (!response.ok) {
        setError(await parseError(response));
        return;
      }
      setAnalyticsOverview((await response.json()) as AnalyticsOverview);
    },
    [api]
  );

  const loadAuditLogs = useCallback(
    async (filters: {
      resource: string;
      action: string;
      userId: string;
      q: string;
      from: string;
      to: string;
      page: number;
      pageSize: number;
    }) => {
      if (!sessionRef.current) return;
      const query = new URLSearchParams();
      if (filters.resource) query.set("resource", filters.resource);
      if (filters.action) query.set("action", filters.action);
      if (filters.userId) query.set("userId", filters.userId);
      if (filters.q.trim()) query.set("q", filters.q.trim());
      if (filters.from) query.set("from", filters.from);
      if (filters.to) query.set("to", filters.to);
      query.set("page", String(filters.page || 1));
      query.set("pageSize", String(filters.pageSize || 20));
      const response = await api(`/analytics/compliance/audit-logs?${query.toString()}`);
      if (!response.ok) {
        setError(await parseError(response));
        return;
      }
      setAuditLogs((await response.json()) as AuditLogPage);
    },
    [api]
  );

  const loadReference = useCallback(async () => {
    if (!sessionRef.current) return;
    const responses = await Promise.all([
      api("/school-years"),
      api("/cycles"),
      api("/levels"),
      api("/classes"),
      api("/subjects"),
      api("/academic-periods")
    ]);
    const failed = responses.find((item) => !item.ok);
    if (failed) {
      setError(await parseError(failed));
      return;
    }
    const [schoolYearsData, cyclesData, levelsData, classesData, subjectsData, periodsData] = await Promise.all([
      responses[0].json() as Promise<SchoolYear[]>,
      responses[1].json() as Promise<Cycle[]>,
      responses[2].json() as Promise<Level[]>,
      responses[3].json() as Promise<ClassItem[]>,
      responses[4].json() as Promise<Subject[]>,
      responses[5].json() as Promise<Period[]>
    ]);
    setSchoolYears(schoolYearsData);
    setCycles(cyclesData);
    setLevels(levelsData);
    setClasses(classesData);
    setSubjects(subjectsData);
    setPeriods(periodsData);
  }, [api]);

  const loadEnrollments = useCallback(
    async (filters = enrollmentFilters) => {
      if (!sessionRef.current) return;
      const query = new URLSearchParams();
      if (filters.schoolYearId) query.set("schoolYearId", filters.schoolYearId);
      if (filters.classId) query.set("classId", filters.classId);
      if (filters.studentId) query.set("studentId", filters.studentId);
      const suffix = query.toString() ? `?${query.toString()}` : "";
      const response = await api(`/enrollments${suffix}`);
      if (!response.ok) {
        setError(await parseError(response));
        return;
      }
      setEnrollments((await response.json()) as Enrollment[]);
    },
    [api, enrollmentFilters]
  );

  const loadFinance = useCallback(async () => {
    if (!sessionRef.current) return;

    const responses = await Promise.all([
      api("/fee-plans"),
      api("/invoices"),
      api("/payments"),
      api("/finance/recovery")
    ]);

    const failed = responses.find((item) => !item.ok);
    if (failed) {
      setError(await parseError(failed));
      return;
    }

    const [feePlanRows, invoiceRows, paymentRows, recoveryView] = await Promise.all([
      responses[0].json() as Promise<FeePlan[]>,
      responses[1].json() as Promise<Invoice[]>,
      responses[2].json() as Promise<PaymentRecord[]>,
      responses[3].json() as Promise<RecoveryDashboard>
    ]);

    setFeePlans(feePlanRows);
    setInvoices(invoiceRows);
    setPayments(paymentRows);
    setRecovery(recoveryView);
  }, [api]);

  const loadGrades = useCallback(
    async (filters = gradeFilters) => {
      if (!sessionRef.current) return;

      const query = new URLSearchParams();
      if (filters.classId) query.set("classId", filters.classId);
      if (filters.subjectId) query.set("subjectId", filters.subjectId);
      if (filters.academicPeriodId) query.set("academicPeriodId", filters.academicPeriodId);
      if (filters.studentId) query.set("studentId", filters.studentId);
      const suffix = query.toString() ? `?${query.toString()}` : "";

      const response = await api(`/grades${suffix}`);
      if (!response.ok) {
        setError(await parseError(response));
        return;
      }

      setGrades((await response.json()) as GradeEntry[]);
    },
    [api, gradeFilters]
  );

  const loadReportCards = useCallback(async () => {
    if (!sessionRef.current) return;
    const response = await api("/report-cards");
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    setReportCards((await response.json()) as ReportCard[]);
  }, [api]);

  const syncHeaderData = useCallback(async (): Promise<void> => {
    if (!currentRole) return;

    setError(null);
    setNotice(null);

    await refresh();

    if (hasScreenAccess(currentRole, "students")) {
      await loadStudents();
    }
    if (hasScreenAccess(currentRole, "iam")) {
      await loadUsers();
      await loadRolePermissions(rolePermissionTarget);
      await loadTeacherAssignments();
      await loadParentLinks();
    }
    if (hasScreenAccess(currentRole, "reference")) {
      await loadReference();
    }
    if (hasScreenAccess(currentRole, "enrollments")) {
      await loadEnrollments();
    }
    if (hasScreenAccess(currentRole, "finance")) {
      await loadFinance();
    }
    if (hasScreenAccess(currentRole, "reports")) {
      await loadAnalytics(analyticsFiltersRef.current);
      await loadAuditLogs(auditFiltersRef.current);
    }
    if (hasScreenAccess(currentRole, "mosque")) {
      await loadMosqueData();
    }
    if (hasScreenAccess(currentRole, "grades")) {
      await loadGrades();
      await loadReportCards();
    }
    if (hasScreenAccess(currentRole, "teacherPortal")) {
      await loadTeacherPortalData();
    }
    if (hasScreenAccess(currentRole, "parentPortal")) {
      await loadParentPortalData();
    }

    setLastSyncAt(new Date().toISOString());
    setNotice("Synchronisation terminee.");
  }, [
    currentRole,
    loadAnalytics,
    loadAuditLogs,
    loadEnrollments,
    loadFinance,
    loadMosqueData,
    loadGrades,
    loadReference,
    loadReportCards,
    loadTeacherAssignments,
    loadParentLinks,
    loadTeacherPortalData,
    loadParentPortalData,
    loadRolePermissions,
    loadStudents,
    loadUsers,
    refresh,
    rolePermissionTarget
  ]);

  useEffect(() => {
    if (!session || !currentRole) {
      clearData();
      return;
    }

    const needStudents = ["students", "enrollments", "grades", "schoolLifeAttendance"].some(
      (screen) => hasScreenAccess(currentRole, screen as ScreenId)
    );
    const needReference = ["reference", "enrollments", "grades", "schoolLifeAttendance", "schoolLifeTimetable", "teacherPortal"].some(
      (screen) => hasScreenAccess(currentRole, screen as ScreenId)
    );

    if (needStudents) void loadStudents();
    if (hasScreenAccess(currentRole, "iam")) {
      void loadUsers();
      void loadRolePermissions(rolePermissionTarget);
      void loadTeacherAssignments();
      void loadParentLinks();
    }
    if (needReference) void loadReference();
    if (hasScreenAccess(currentRole, "enrollments")) void loadEnrollments();
    if (hasScreenAccess(currentRole, "finance")) void loadFinance();
    if (hasScreenAccess(currentRole, "reports")) {
      void loadAnalytics(analyticsFiltersRef.current);
      void loadAuditLogs(auditFiltersRef.current);
    }
    if (hasScreenAccess(currentRole, "mosque")) void loadMosqueData();
    if (hasScreenAccess(currentRole, "grades")) {
      void loadGrades();
      void loadReportCards();
    }
    if (hasScreenAccess(currentRole, "teacherPortal")) {
      void loadTeacherPortalData();
    }
    if (hasScreenAccess(currentRole, "parentPortal")) {
      void loadParentPortalData();
    }
  }, [
    clearData,
    currentRole,
    loadAnalytics,
    loadAuditLogs,
    loadEnrollments,
    loadFinance,
    loadMosqueData,
    loadGrades,
    loadReference,
    loadReportCards,
    loadTeacherAssignments,
    loadParentLinks,
    loadTeacherPortalData,
    loadParentPortalData,
    loadRolePermissions,
    loadStudents,
    loadUsers,
    rolePermissionTarget,
    session
  ]);

  useEffect(() => {
    if (!levelForm.cycleId && cycles[0]) setLevelForm((prev) => ({ ...prev, cycleId: cycles[0].id }));
    if (!classForm.schoolYearId && schoolYears[0]) setClassForm((prev) => ({ ...prev, schoolYearId: schoolYears[0].id }));
    if (!classForm.levelId && levels[0]) setClassForm((prev) => ({ ...prev, levelId: levels[0].id }));
    if (!periodForm.schoolYearId && schoolYears[0]) setPeriodForm((prev) => ({ ...prev, schoolYearId: schoolYears[0].id }));

    if (!enrollmentForm.schoolYearId && schoolYears[0]) setEnrollmentForm((prev) => ({ ...prev, schoolYearId: schoolYears[0].id }));
    if (!enrollmentForm.classId && classes[0]) setEnrollmentForm((prev) => ({ ...prev, classId: classes[0].id }));
    if (!enrollmentForm.studentId && students[0]) setEnrollmentForm((prev) => ({ ...prev, studentId: students[0].id }));

    if (!feePlanForm.schoolYearId && schoolYears[0]) setFeePlanForm((prev) => ({ ...prev, schoolYearId: schoolYears[0].id }));
    if (!feePlanForm.levelId && levels[0]) setFeePlanForm((prev) => ({ ...prev, levelId: levels[0].id }));

    if (!invoiceForm.studentId && students[0]) setInvoiceForm((prev) => ({ ...prev, studentId: students[0].id }));
    if (!invoiceForm.schoolYearId && schoolYears[0]) setInvoiceForm((prev) => ({ ...prev, schoolYearId: schoolYears[0].id }));

    if (!paymentForm.invoiceId && invoices[0]) setPaymentForm((prev) => ({ ...prev, invoiceId: invoices[0].id }));

    if (!gradeForm.studentId && students[0]) setGradeForm((prev) => ({ ...prev, studentId: students[0].id }));
    if (!gradeForm.classId && classes[0]) setGradeForm((prev) => ({ ...prev, classId: classes[0].id }));
    if (!gradeForm.subjectId && subjects[0]) setGradeForm((prev) => ({ ...prev, subjectId: subjects[0].id }));
    const gradeFormSchoolYearId = classes.find((item) => item.id === gradeForm.classId)?.schoolYearId;
    const compatiblePeriodsForGradeForm = gradeFormSchoolYearId
      ? periods.filter((item) => item.schoolYearId === gradeFormSchoolYearId)
      : periods;
    if (!gradeForm.academicPeriodId && compatiblePeriodsForGradeForm[0])
      setGradeForm((prev) => ({ ...prev, academicPeriodId: compatiblePeriodsForGradeForm[0].id }));

    if (!reportForm.studentId && students[0]) setReportForm((prev) => ({ ...prev, studentId: students[0].id }));
    if (!reportForm.classId && classes[0]) setReportForm((prev) => ({ ...prev, classId: classes[0].id }));
    const reportFormSchoolYearId = classes.find((item) => item.id === reportForm.classId)?.schoolYearId;
    const compatiblePeriodsForReportForm = reportFormSchoolYearId
      ? periods.filter((item) => item.schoolYearId === reportFormSchoolYearId)
      : periods;
    if (!reportForm.academicPeriodId && compatiblePeriodsForReportForm[0])
      setReportForm((prev) => ({ ...prev, academicPeriodId: compatiblePeriodsForReportForm[0].id }));

    const teacherUsers = users.filter((item) => item.role === "ENSEIGNANT" && item.isActive);
    const parentUsers = users.filter((item) => item.role === "PARENT" && item.isActive);
    if (!teacherAssignmentForm.userId && teacherUsers[0]) {
      setTeacherAssignmentForm((prev) => ({ ...prev, userId: teacherUsers[0].id }));
    }
    if (!teacherAssignmentForm.classId && classes[0]) {
      setTeacherAssignmentForm((prev) => ({ ...prev, classId: classes[0].id }));
    }
    if (!teacherAssignmentForm.schoolYearId && schoolYears[0]) {
      setTeacherAssignmentForm((prev) => ({ ...prev, schoolYearId: schoolYears[0].id }));
    }
    if (!parentLinkForm.parentUserId && parentUsers[0]) {
      setParentLinkForm((prev) => ({ ...prev, parentUserId: parentUsers[0].id }));
    }
    if (!parentLinkForm.studentId && students[0]) {
      setParentLinkForm((prev) => ({ ...prev, studentId: students[0].id }));
    }
    if (!mosqueDonationForm.memberId && mosqueMembers[0]) {
      setMosqueDonationForm((prev) => ({ ...prev, memberId: mosqueMembers[0].id }));
    }

    if (!teacherPortalFilters.classId && teacherClasses[0]) {
      setTeacherPortalFilters((prev) => ({ ...prev, classId: teacherClasses[0].classId }));
    }
    if (!teacherGradeForm.classId && teacherClasses[0]) {
      setTeacherGradeForm((prev) => ({ ...prev, classId: teacherClasses[0].classId }));
    }
    if (!teacherAttendanceForm.classId && teacherClasses[0]) {
      setTeacherAttendanceForm((prev) => ({ ...prev, classId: teacherClasses[0].classId }));
    }
    if (!teacherNotificationForm.classId && teacherClasses[0]) {
      setTeacherNotificationForm((prev) => ({ ...prev, classId: teacherClasses[0].classId }));
    }

    if (!teacherGradeForm.studentId && teacherStudents[0]) {
      setTeacherGradeForm((prev) => ({ ...prev, studentId: teacherStudents[0].studentId }));
    }
    if (!teacherGradeForm.subjectId && subjects[0]) {
      setTeacherGradeForm((prev) => ({ ...prev, subjectId: subjects[0].id }));
    }
    const teacherFormSchoolYearId = teacherClasses.find((item) => item.classId === teacherGradeForm.classId)?.schoolYearId;
    const compatiblePeriodsForTeacherGrade = teacherFormSchoolYearId
      ? periods.filter((item) => item.schoolYearId === teacherFormSchoolYearId)
      : periods;
    if (!teacherGradeForm.academicPeriodId && compatiblePeriodsForTeacherGrade[0]) {
      setTeacherGradeForm((prev) => ({ ...prev, academicPeriodId: compatiblePeriodsForTeacherGrade[0].id }));
    }
  }, [
    classForm.levelId,
    classForm.schoolYearId,
    classes,
    cycles,
    enrollmentForm.classId,
    enrollmentForm.schoolYearId,
    enrollmentForm.studentId,
    feePlanForm.levelId,
    feePlanForm.schoolYearId,
    gradeForm.academicPeriodId,
    gradeForm.classId,
    gradeForm.studentId,
    gradeForm.subjectId,
    invoiceForm.schoolYearId,
    invoiceForm.studentId,
    invoices,
    levelForm.cycleId,
    levels,
    paymentForm.invoiceId,
    periodForm.schoolYearId,
    periods,
    reportForm.academicPeriodId,
    reportForm.classId,
    reportForm.studentId,
    schoolYears,
    students,
    subjects,
    teacherAssignmentForm.classId,
    teacherAssignmentForm.schoolYearId,
    teacherAssignmentForm.userId,
    teacherAttendanceForm.classId,
    teacherClasses,
    teacherGradeForm.academicPeriodId,
    teacherGradeForm.classId,
    teacherGradeForm.studentId,
    teacherGradeForm.subjectId,
    teacherNotificationForm.classId,
    teacherPortalFilters.classId,
    teacherStudents,
    parentLinkForm.parentUserId,
    parentLinkForm.studentId,
    mosqueDonationForm.memberId,
    mosqueMembers,
    users
  ]);

  useEffect(() => {
    const ensureCompatiblePeriod = (
      classId: string,
      periodId: string,
      onMismatch: (nextPeriodId: string) => void
    ): void => {
      if (!classId) return;
      const classroom = classes.find((item) => item.id === classId);
      if (!classroom) return;
      const compatiblePeriods = periods.filter((item) => item.schoolYearId === classroom.schoolYearId);
      if (compatiblePeriods.length === 0) return;
      const current = periods.find((item) => item.id === periodId);
      if (!current || current.schoolYearId !== classroom.schoolYearId) {
        onMismatch(compatiblePeriods[0].id);
      }
    };

    ensureCompatiblePeriod(gradeForm.classId, gradeForm.academicPeriodId, (nextPeriodId) => {
      if (nextPeriodId !== gradeForm.academicPeriodId) {
        setGradeForm((prev) => ({ ...prev, academicPeriodId: nextPeriodId }));
      }
    });

    ensureCompatiblePeriod(reportForm.classId, reportForm.academicPeriodId, (nextPeriodId) => {
      if (nextPeriodId !== reportForm.academicPeriodId) {
        setReportForm((prev) => ({ ...prev, academicPeriodId: nextPeriodId }));
      }
    });

    ensureCompatiblePeriod(teacherGradeForm.classId, teacherGradeForm.academicPeriodId, (nextPeriodId) => {
      if (nextPeriodId !== teacherGradeForm.academicPeriodId) {
        setTeacherGradeForm((prev) => ({ ...prev, academicPeriodId: nextPeriodId }));
      }
    });

    ensureCompatiblePeriod(teacherPortalFilters.classId, teacherPortalFilters.academicPeriodId, (nextPeriodId) => {
      if (nextPeriodId !== teacherPortalFilters.academicPeriodId) {
        setTeacherPortalFilters((prev) => ({ ...prev, academicPeriodId: nextPeriodId }));
      }
    });

    if (gradeFilters.classId && gradeFilters.academicPeriodId) {
      const classroom = classes.find((item) => item.id === gradeFilters.classId);
      const period = periods.find((item) => item.id === gradeFilters.academicPeriodId);
      if (classroom && period && classroom.schoolYearId !== period.schoolYearId) {
        setGradeFilters((prev) => ({ ...prev, academicPeriodId: "" }));
      }
    }
  }, [
    classes,
    gradeFilters.academicPeriodId,
    gradeFilters.classId,
    gradeForm.academicPeriodId,
    gradeForm.classId,
    periods,
    reportForm.academicPeriodId,
    reportForm.classId,
    teacherGradeForm.academicPeriodId,
    teacherGradeForm.classId,
    teacherPortalFilters.academicPeriodId,
    teacherPortalFilters.classId
  ]);

  const shownStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter((item) => `${item.matricule} ${item.firstName} ${item.lastName}`.toLowerCase().includes(q));
  }, [studentSearch, students]);

  const shownLevels = useMemo(
    () => (levelCycleFilter ? levels.filter((item) => item.cycleId === levelCycleFilter) : levels),
    [levelCycleFilter, levels]
  );
  const shownClasses = useMemo(
    () =>
      classes.filter((item) => {
        const byYear = !classYearFilter || item.schoolYearId === classYearFilter;
        const byLevel = !classLevelFilter || item.levelId === classLevelFilter;
        return byYear && byLevel;
      }),
    [classLevelFilter, classYearFilter, classes]
  );
  const shownPeriods = useMemo(
    () => (periodYearFilter ? periods.filter((item) => item.schoolYearId === periodYearFilter) : periods),
    [periodYearFilter, periods]
  );

  const resetStudentForm = (): void => {
    setEditingStudentId(null);
    setStudentForm({
      matricule: "",
      firstName: "",
      lastName: "",
      sex: "M",
      birthDate: ""
    });
  };

  const resetUserForm = (): void => {
    setEditingUserId(null);
    setUserForm({
      username: "",
      password: "",
      role: "ENSEIGNANT",
      isActive: true
    });
  };

  const getEffectivePermission = (
    resource: PermissionResource,
    action: PermissionAction
  ): boolean => {
    const row = rolePermissions.find(
      (item) => item.resource === resource && item.action === action
    );
    return row?.allowed ?? false;
  };

  const toggleRolePermission = (
    resource: PermissionResource,
    action: PermissionAction,
    allowed: boolean
  ): void => {
    setRolePermissions((previous) => {
      const index = previous.findIndex(
        (item) => item.resource === resource && item.action === action
      );

      if (index < 0) {
        return [
          ...previous,
          {
            role: rolePermissionTarget,
            resource,
            action,
            allowed,
            source: "CUSTOM"
          }
        ];
      }

      const next = [...previous];
      next[index] = {
        ...next[index],
        allowed,
        source: "CUSTOM"
      };
      return next;
    });
  };

  const submitUser = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);

    const errors: FieldErrors = {};
    if (!userForm.username.trim()) errors.username = "Nom utilisateur requis.";
    if (!editingUserId && !isStrongPassword(userForm.password.trim())) {
      errors.password = STRONG_PASSWORD_HINT;
    }
    if (userForm.password.trim() && !isStrongPassword(userForm.password.trim())) {
      errors.password = STRONG_PASSWORD_HINT;
    }

    setUserErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("accounts");
      return;
    }

    const payload: Record<string, unknown> = {
      username: userForm.username.trim(),
      role: userForm.role,
      isActive: userForm.isActive
    };
    if (userForm.password.trim()) {
      payload.password = userForm.password.trim();
    }

    const response = await api(editingUserId ? `/users/${editingUserId}` : "/users", {
      method: editingUserId ? "PATCH" : "POST",
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    setUserErrors({});
    setNotice(editingUserId ? "Utilisateur mis a jour." : "Utilisateur cree.");
    setIamWorkflowStep("accounts");
    resetUserForm();
    await loadUsers();
  };

  const startEditUser = (item: UserAccount): void => {
    setEditingUserId(item.id);
    setUserForm({
      username: item.username,
      password: "",
      role: item.role,
      isActive: item.isActive
    });
    setIamWorkflowStep("accounts");
  };

  const deleteUserAccount = async (id: string): Promise<void> => {
    if (!window.confirm("Supprimer cet utilisateur ?")) return;
    const response = await api(`/users/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    if (editingUserId === id) {
      resetUserForm();
    }
    setNotice("Utilisateur supprime.");
    await loadUsers();
  };

  const saveRolePermissions = async (): Promise<void> => {
    setError(null);

    const permissions = PERMISSION_RESOURCE_VALUES.flatMap((resource) =>
      PERMISSION_ACTION_VALUES.map((action) => ({
        resource,
        action,
        allowed: getEffectivePermission(resource, action)
      }))
    );

    const response = await api(
      `/users/roles/${encodeURIComponent(rolePermissionTarget)}/permissions`,
      {
        method: "PUT",
        body: JSON.stringify({ permissions })
      }
    );

    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    setRolePermissions((await response.json()) as RolePermissionView[]);
    setNotice(`Droits ${formatRoleLabel(rolePermissionTarget)} mis a jour.`);
    setIamWorkflowStep("permissions");
  };

  const submitTeacherAssignment = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {};
    if (!teacherAssignmentForm.userId) errors.userId = "Enseignant requis.";
    if (!teacherAssignmentForm.classId) errors.classId = "Classe requise.";
    if (!teacherAssignmentForm.schoolYearId) errors.schoolYearId = "Annee requise.";
    setTeacherAssignmentErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("links");
      return;
    }

    const response = await api("/users/teacher-assignments", {
      method: "POST",
      body: JSON.stringify({
        userId: teacherAssignmentForm.userId,
        classId: teacherAssignmentForm.classId,
        schoolYearId: teacherAssignmentForm.schoolYearId,
        subjectId: teacherAssignmentForm.subjectId || undefined
      })
    });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setTeacherAssignmentErrors({});
    setNotice("Affectation enseignant creee.");
    setIamWorkflowStep("links");
    setTeacherAssignmentForm((prev) => ({ ...prev, subjectId: "" }));
    await loadTeacherAssignments();
  };

  const deleteTeacherAssignment = async (id: string): Promise<void> => {
    if (!window.confirm("Supprimer cette affectation enseignant ?")) return;
    const response = await api(`/users/teacher-assignments/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setNotice("Affectation enseignant supprimee.");
    await loadTeacherAssignments();
  };

  const submitParentLink = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {};
    if (!parentLinkForm.parentUserId) errors.parentUserId = "Compte parent requis.";
    if (!parentLinkForm.studentId) errors.studentId = "Eleve requis.";
    setParentLinkErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("links");
      return;
    }

    const response = await api("/users/parent-links", {
      method: "POST",
      body: JSON.stringify({
        parentUserId: parentLinkForm.parentUserId,
        studentId: parentLinkForm.studentId,
        relationship: parentLinkForm.relationship.trim() || undefined,
        isPrimary: parentLinkForm.isPrimary
      })
    });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setParentLinkErrors({});
    setNotice("Lien parent-eleve cree.");
    setIamWorkflowStep("links");
    setParentLinkForm((prev) => ({ ...prev, relationship: "", isPrimary: false }));
    await loadParentLinks();
  };

  const deleteParentLink = async (id: string): Promise<void> => {
    if (!window.confirm("Supprimer ce lien parent-eleve ?")) return;
    const response = await api(`/users/parent-links/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setNotice("Lien parent-eleve supprime.");
    await loadParentLinks();
  };

  const submitTeacherGrade = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {};
    if (!teacherGradeForm.studentId) errors.studentId = "Eleve requis.";
    if (!teacherGradeForm.classId) errors.classId = "Classe requise.";
    if (!teacherGradeForm.subjectId) errors.subjectId = "Matiere requise.";
    if (!teacherGradeForm.academicPeriodId) errors.academicPeriodId = "Periode requise.";
    if (!teacherGradeForm.assessmentLabel.trim()) errors.assessmentLabel = "Libelle requis.";
    const score = Number(teacherGradeForm.score);
    const scoreMax = Number(teacherGradeForm.scoreMax || 20);
    if (!Number.isFinite(score) || score < 0) errors.score = "Note invalide.";
    if (!Number.isFinite(scoreMax) || scoreMax <= 0) errors.scoreMax = "Bareme invalide.";
    if (!hasFieldErrors(errors) && score > scoreMax) {
      errors.score = "La note ne peut pas depasser le bareme.";
    }
    setTeacherPortalErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("teacher-grade");
      return;
    }

    const response = await api("/portal/teacher/grades", {
      method: "POST",
      body: JSON.stringify({
        studentId: teacherGradeForm.studentId,
        classId: teacherGradeForm.classId,
        subjectId: teacherGradeForm.subjectId,
        academicPeriodId: teacherGradeForm.academicPeriodId,
        assessmentLabel: teacherGradeForm.assessmentLabel.trim(),
        assessmentType: teacherGradeForm.assessmentType,
        score,
        scoreMax,
        comment: teacherGradeForm.comment.trim() || undefined
      })
    });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setTeacherPortalErrors({});
    setNotice("Note enregistree.");
    await loadTeacherPortalData(teacherPortalFilters);
  };

  const submitTeacherAttendanceBulk = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {};
    if (!teacherAttendanceForm.classId) errors.classId = "Classe requise.";
    if (!teacherAttendanceForm.attendanceDate) errors.attendanceDate = "Date requise.";
    if (teacherAttendanceStudents.length === 0) errors.students = "Selectionner au moins un eleve.";
    setTeacherPortalErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("teacher-attendance");
      return;
    }

    const response = await api("/portal/teacher/attendance/bulk", {
      method: "POST",
      body: JSON.stringify({
        classId: teacherAttendanceForm.classId,
        attendanceDate: teacherAttendanceForm.attendanceDate,
        defaultStatus: teacherAttendanceForm.defaultStatus,
        entries: teacherAttendanceStudents.map((studentId) => ({
          studentId,
          reason: teacherAttendanceForm.reason.trim() || undefined
        }))
      })
    });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setTeacherPortalErrors({});
    setNotice("Pointage enregistre.");
    await loadTeacherPortalData(teacherPortalFilters);
  };

  const submitTeacherNotification = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {};
    if (!teacherNotificationForm.classId) errors.classId = "Classe requise.";
    if (!teacherNotificationForm.title.trim()) errors.title = "Titre requis.";
    if (!teacherNotificationForm.message.trim()) errors.message = "Message requis.";
    setTeacherPortalErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("teacher-notifications");
      return;
    }

    const response = await api("/portal/teacher/notifications", {
      method: "POST",
      body: JSON.stringify({
        classId: teacherNotificationForm.classId,
        studentId: teacherNotificationForm.studentId || undefined,
        title: teacherNotificationForm.title.trim(),
        message: teacherNotificationForm.message.trim(),
        channel: teacherNotificationForm.channel
      })
    });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setTeacherPortalErrors({});
    setNotice("Notification parent envoyee.");
    setTeacherNotificationForm((prev) => ({ ...prev, title: "", message: "" }));
    await loadTeacherPortalData(teacherPortalFilters);
  };

  const toggleThemeMode = (): void => {
    setThemeMode((prev) => (prev === "light" ? "dark" : "light"));
  };

  const toggleForgotPasswordPanel = (): void => {
    setAuthAssistMode((prev) => (prev === "forgot" ? "none" : "forgot"));
    setError(null);
    setNotice(null);
  };

  const toggleFirstConnectionPanel = (): void => {
    setAuthAssistMode((prev) => (prev === "first" ? "none" : "first"));
    setError(null);
    setNotice(null);
  };

  const requestForgotPasswordToken = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!forgotPasswordForm.username.trim()) {
      setError("Renseigner votre identifiant pour demander un token de reinitialisation.");
      return;
    }

    setAuthAssistLoading(true);
    try {
      const response = await fetch(`${API}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: forgotPasswordForm.username.trim(),
          tenantId: DEFAULT_TENANT
        })
      });
      if (!response.ok) {
        setError(await parseError(response));
        return;
      }

      const payload = (await response.json()) as ForgotPasswordResponse;
      setNotice(payload.message || "Demande de reinitialisation enregistree.");
    } catch {
      setError("Connexion API impossible pendant la demande de reinitialisation.");
    } finally {
      setAuthAssistLoading(false);
    }
  };

  const submitResetPassword = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!resetPasswordForm.token.trim()) {
      setError("Token de reinitialisation requis.");
      return;
    }
    if (!isStrongPassword(resetPasswordForm.newPassword)) {
      setError(STRONG_PASSWORD_HINT);
      return;
    }
    if (resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword) {
      setError("La confirmation du mot de passe ne correspond pas.");
      return;
    }

    setAuthAssistLoading(true);
    try {
      const response = await fetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: resetPasswordForm.token.trim(),
          newPassword: resetPasswordForm.newPassword
        })
      });
      if (!response.ok) {
        setError(await parseError(response));
        return;
      }

      const payload = (await response.json()) as AuthMessageResponse;
      setNotice(payload.message || "Mot de passe reinitialise.");
      setLoginForm((prev) => ({
        ...prev,
        username: forgotPasswordForm.username.trim() || prev.username,
        tenantId: DEFAULT_TENANT,
        password: ""
      }));
      setResetPasswordForm({ token: "", newPassword: "", confirmPassword: "" });
      setAuthAssistMode("none");
    } catch {
      setError("Connexion API impossible pendant la reinitialisation du mot de passe.");
    } finally {
      setAuthAssistLoading(false);
    }
  };

  const submitFirstConnection = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!firstConnectionForm.username.trim()) {
      setError("Identifiant requis.");
      return;
    }
    if (!firstConnectionForm.temporaryPassword || firstConnectionForm.temporaryPassword.length < 8) {
      setError("Mot de passe temporaire invalide.");
      return;
    }
    if (!isStrongPassword(firstConnectionForm.newPassword)) {
      setError(STRONG_PASSWORD_HINT);
      return;
    }
    if (firstConnectionForm.newPassword !== firstConnectionForm.confirmPassword) {
      setError("La confirmation du mot de passe ne correspond pas.");
      return;
    }

    setAuthAssistLoading(true);
    try {
      const response = await fetch(`${API}/auth/first-connection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: firstConnectionForm.username.trim(),
          tenantId: DEFAULT_TENANT,
          temporaryPassword: firstConnectionForm.temporaryPassword,
          newPassword: firstConnectionForm.newPassword
        })
      });
      if (!response.ok) {
        setError(await parseError(response));
        return;
      }

      const payload = (await response.json()) as AuthMessageResponse;
      setNotice(payload.message || "Premiere connexion finalisee.");
      setLoginForm((prev) => ({
        ...prev,
        username: firstConnectionForm.username.trim(),
        tenantId: DEFAULT_TENANT,
        password: firstConnectionForm.newPassword
      }));
      setFirstConnectionForm((prev) => ({
        ...prev,
        temporaryPassword: "",
        newPassword: "",
        confirmPassword: ""
      }));
      setAuthAssistMode("none");
    } catch {
      setError("Connexion API impossible pendant l'activation du compte.");
    } finally {
      setAuthAssistLoading(false);
    }
  };

  const login = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const errors: FieldErrors = {};
    if (!loginForm.username.trim()) errors.username = "Nom utilisateur requis.";
    if (!loginForm.password || loginForm.password.length < 8) errors.password = "Minimum 8 caracteres.";
    setLoginErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField();
      return;
    }
    setLoadingAuth(true);
    try {
      const response = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: loginForm.username.trim(),
          password: loginForm.password,
          tenantId: DEFAULT_TENANT
        })
      });
      if (!response.ok) {
        setError(await parseError(response));
        return;
      }
      const payload = (await response.json()) as Omit<Session, "tenantId"> & { user: Session["user"] };
      const nextSession = { ...payload, tenantId: payload.user.tenantId || DEFAULT_TENANT };
      const role = (nextSession.user.role as Role) || "ADMIN";
      const cleanUsername = loginForm.username.trim();
      const cleanTenant = payload.user.tenantId || DEFAULT_TENANT;
      setLoginErrors({});
      setSession(nextSession);
      setLastSyncAt(new Date().toISOString());
      setAuthAssistMode("none");
      if (rememberMe) {
        localStorage.setItem(
          LOGIN_HINT_STORAGE_KEY,
          JSON.stringify({
            username: cleanUsername,
            tenantId: cleanTenant,
            remember: true
          } as RememberedLogin)
        );
      } else {
        localStorage.removeItem(LOGIN_HINT_STORAGE_KEY);
      }
      setNotice("Connexion reussie.");
      setTab(ROLE_HOME_SCREEN[role] || "dashboard");
    } catch {
      setError("Connexion API impossible. En local, verifie que l'API Nest tourne sur le port 3000.");
    } finally {
      setLoadingAuth(false);
    }
  };

  const logout = async (): Promise<void> => {
    const current = sessionRef.current;
    if (current?.refreshToken) {
      await fetch(`${API}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: current.refreshToken })
      }).catch(() => undefined);
    }
    setSession(null);
    setAuthAssistMode("none");
    setResetPasswordForm({ token: "", newPassword: "", confirmPassword: "" });
    clearData();
    resetStudentForm();
    resetUserForm();
    setTeacherPortalFilters({ classId: "", subjectId: "", academicPeriodId: "", studentId: "" });
    setTeacherGradeForm((prev) => ({
      ...prev,
      studentId: "",
      classId: "",
      subjectId: "",
      academicPeriodId: "",
      score: "",
      scoreMax: "20",
      comment: ""
    }));
    setTeacherAttendanceForm({ classId: "", attendanceDate: today(), defaultStatus: "PRESENT", reason: "" });
    setTeacherAttendanceStudents([]);
    setTeacherNotificationForm({ classId: "", studentId: "", title: "", message: "", channel: "IN_APP" });
    setParentStudentFilter("");
    setTeacherAssignmentForm({ userId: "", classId: "", schoolYearId: "", subjectId: "" });
    setParentLinkForm({ parentUserId: "", studentId: "", relationship: "", isPrimary: false });
    setMosqueWorkflowStep("members");
    setMosqueMemberFilters({ status: "", q: "" });
    setMosqueActivityFilters({ category: "", from: "", to: "", q: "" });
    setMosqueDonationFilters({ memberId: "", channel: "", from: "", to: "" });
    setMosqueMemberForm({
      memberCode: "",
      fullName: "",
      sex: "",
      phone: "",
      email: "",
      address: "",
      joinedAt: "",
      status: "ACTIVE"
    });
    setMosqueActivityForm({
      code: "",
      title: "",
      activityDate: today(),
      category: "JUMUAH",
      location: "",
      description: "",
      isSchoolLinked: false
    });
    setMosqueDonationForm({
      memberId: "",
      amount: "",
      currency: DEFAULT_CURRENCY,
      channel: "CASH",
      donatedAt: `${today()}T08:00`,
      referenceNo: "",
      notes: ""
    });
    setMosqueExportFormat("PDF");
    setAnalyticsFilters({ from: "", to: "", schoolYearId: "" });
    setAuditFilters({
      resource: "",
      action: "",
      userId: "",
      q: "",
      from: "",
      to: "",
      page: 1,
      pageSize: 20
    });
    setAuditExportFormat("PDF");
    setMosqueMemberErrors({});
    setMosqueActivityErrors({});
    setMosqueDonationErrors({});
    setNotice("Deconnexion reussie.");
    setError(null);
  };

  const submitStudent = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {};
    if (!studentForm.matricule.trim()) errors.matricule = "Matricule requis.";
    if (!studentForm.firstName.trim()) errors.firstName = "Prenom requis.";
    if (!studentForm.lastName.trim()) errors.lastName = "Nom requis.";
    if (!studentForm.sex) errors.sex = "Sexe requis.";
    if (studentForm.birthDate && studentForm.birthDate > today()) {
      errors.birthDate = "Date de naissance invalide.";
    }
    setStudentErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("entry");
      return;
    }
    const response = await api(editingStudentId ? `/students/${editingStudentId}` : "/students", {
      method: editingStudentId ? "PATCH" : "POST",
      body: JSON.stringify({
        matricule: studentForm.matricule.trim(),
        firstName: studentForm.firstName.trim(),
        lastName: studentForm.lastName.trim(),
        sex: studentForm.sex,
        birthDate: studentForm.birthDate || undefined
      })
    });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setStudentErrors({});
    resetStudentForm();
    setNotice(editingStudentId ? "Élève modifié." : "Élève ajouté.");
    setStudentWorkflowStep("list");
    await loadStudents();
    await loadEnrollments();
  };

  const deleteStudent = async (id: string): Promise<void> => {
    if (!window.confirm("Supprimer cet élève ?")) return;
    const response = await api(`/students/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    if (editingStudentId === id) resetStudentForm();
    setNotice("Élève supprimé.");
    await loadStudents();
    await loadEnrollments();
  };

  const createRef = async (path: string, payload: unknown, message: string): Promise<boolean> => {
    setError(null);
    const response = await api(path, { method: "POST", body: JSON.stringify(payload) });
    if (!response.ok) {
      setError(await parseError(response));
      return false;
    }
    setNotice(message);
    await loadReference();
    await loadEnrollments();
    return true;
  };

  const deleteRef = async (path: string, message: string): Promise<void> => {
    const response = await api(path, { method: "DELETE" });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setNotice(message);
    await loadReference();
    await loadEnrollments();
  };

  const loadMosqueWithCurrentFilters = async (): Promise<void> => {
    await loadMosqueData({
      memberFilters: mosqueMemberFilters,
      activityFilters: mosqueActivityFilters,
      donationFilters: mosqueDonationFilters
    });
  };

  const exportMosqueData = async (
    scope: "members" | "activities" | "donations"
  ): Promise<void> => {
    setError(null);
    const query = new URLSearchParams();
    query.set("format", mosqueExportFormat);

    if (scope === "members") {
      if (mosqueMemberFilters.status) query.set("status", mosqueMemberFilters.status);
      if (mosqueMemberFilters.q) query.set("q", mosqueMemberFilters.q);
    }
    if (scope === "activities") {
      if (mosqueActivityFilters.category) query.set("category", mosqueActivityFilters.category);
      if (mosqueActivityFilters.from) query.set("from", mosqueActivityFilters.from);
      if (mosqueActivityFilters.to) query.set("to", mosqueActivityFilters.to);
      if (mosqueActivityFilters.q) query.set("q", mosqueActivityFilters.q);
    }
    if (scope === "donations") {
      if (mosqueDonationFilters.memberId) query.set("memberId", mosqueDonationFilters.memberId);
      if (mosqueDonationFilters.channel) query.set("channel", mosqueDonationFilters.channel);
      if (mosqueDonationFilters.from) query.set("from", mosqueDonationFilters.from);
      if (mosqueDonationFilters.to) query.set("to", mosqueDonationFilters.to);
    }

    const response = await api(`/mosque/${scope}/export?${query.toString()}`);
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    const payload = (await response.json()) as MosqueExportResponse;
    triggerFileDownload(payload.fileName, payload.dataUrl);
    setNotice(`Export ${scope} ${payload.format} genere (${payload.rowCount} ligne(s)).`);
  };

  const openMosqueDonationReceipt = async (donationId: string): Promise<void> => {
    setError(null);
    const response = await api(`/mosque/donations/${donationId}/receipt`);
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    const payload = (await response.json()) as MosqueDonationReceipt;
    window.open(payload.pdfDataUrl, "_blank", "noopener,noreferrer");
    setNotice(`Recu ${payload.receiptNo} ouvert.`);
  };

  const exportAuditLogs = async (): Promise<void> => {
    setError(null);
    const query = new URLSearchParams();
    query.set("format", auditExportFormat);
    if (auditFilters.resource) query.set("resource", auditFilters.resource);
    if (auditFilters.action) query.set("action", auditFilters.action);
    if (auditFilters.userId) query.set("userId", auditFilters.userId);
    if (auditFilters.q.trim()) query.set("q", auditFilters.q.trim());
    if (auditFilters.from) query.set("from", auditFilters.from);
    if (auditFilters.to) query.set("to", auditFilters.to);
    query.set("limit", "1000");
    const response = await api(`/analytics/compliance/audit-logs/export?${query.toString()}`);
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    const payload = (await response.json()) as AuditLogExportResponse;
    triggerFileDownload(payload.fileName, payload.dataUrl);
    setNotice(`Export audit ${payload.format} genere (${payload.rowCount} ligne(s)).`);
  };

  const submitMosqueMember = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {};
    if (!mosqueMemberForm.memberCode.trim()) errors.memberCode = "Code membre requis.";
    if (!mosqueMemberForm.fullName.trim()) errors.fullName = "Nom complet requis.";
    if (!mosqueMemberForm.status) errors.status = "Statut requis.";
    setMosqueMemberErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("mosque-members");
      return;
    }

    const response = await api("/mosque/members", {
      method: "POST",
      body: JSON.stringify({
        memberCode: mosqueMemberForm.memberCode.trim(),
        fullName: mosqueMemberForm.fullName.trim(),
        sex: mosqueMemberForm.sex || undefined,
        phone: mosqueMemberForm.phone.trim() || undefined,
        email: mosqueMemberForm.email.trim() || undefined,
        address: mosqueMemberForm.address.trim() || undefined,
        joinedAt: mosqueMemberForm.joinedAt || undefined,
        status: mosqueMemberForm.status
      })
    });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setMosqueMemberErrors({});
    setNotice("Membre mosquee cree.");
    setMosqueWorkflowStep("members");
    setMosqueMemberForm({
      memberCode: "",
      fullName: "",
      sex: "",
      phone: "",
      email: "",
      address: "",
      joinedAt: "",
      status: "ACTIVE"
    });
    await loadMosqueWithCurrentFilters();
  };

  const deleteMosqueMember = async (id: string): Promise<void> => {
    if (!window.confirm("Supprimer ce membre ?")) return;
    const response = await api(`/mosque/members/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setNotice("Membre mosquee supprime.");
    await loadMosqueWithCurrentFilters();
  };

  const submitMosqueActivity = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {};
    if (!mosqueActivityForm.code.trim()) errors.code = "Code activite requis.";
    if (!mosqueActivityForm.title.trim()) errors.title = "Titre activite requis.";
    if (!mosqueActivityForm.activityDate) errors.activityDate = "Date activite requise.";
    if (!mosqueActivityForm.category.trim()) errors.category = "Categorie requise.";
    setMosqueActivityErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("mosque-activities");
      return;
    }

    const response = await api("/mosque/activities", {
      method: "POST",
      body: JSON.stringify({
        code: mosqueActivityForm.code.trim(),
        title: mosqueActivityForm.title.trim(),
        activityDate: mosqueActivityForm.activityDate,
        category: mosqueActivityForm.category.trim(),
        location: mosqueActivityForm.location.trim() || undefined,
        description: mosqueActivityForm.description.trim() || undefined,
        isSchoolLinked: mosqueActivityForm.isSchoolLinked
      })
    });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setMosqueActivityErrors({});
    setNotice("Activite mosquee creee.");
    setMosqueWorkflowStep("activities");
    setMosqueActivityForm((prev) => ({
      ...prev,
      code: "",
      title: "",
      location: "",
      description: "",
      isSchoolLinked: false
    }));
    await loadMosqueWithCurrentFilters();
  };

  const deleteMosqueActivity = async (id: string): Promise<void> => {
    if (!window.confirm("Supprimer cette activite ?")) return;
    const response = await api(`/mosque/activities/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setNotice("Activite mosquee supprimee.");
    await loadMosqueWithCurrentFilters();
  };

  const submitMosqueDonation = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {};
    const amount = Number(mosqueDonationForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.amount = "Montant invalide.";
    }
    if (!mosqueDonationForm.currency.trim()) errors.currency = "Devise requise.";
    if (!mosqueDonationForm.channel) errors.channel = "Canal requis.";
    setMosqueDonationErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("mosque-donations");
      return;
    }

    const response = await api("/mosque/donations", {
      method: "POST",
      body: JSON.stringify({
        memberId: mosqueDonationForm.memberId || undefined,
        amount,
        currency: mosqueDonationForm.currency.trim().toUpperCase(),
        channel: mosqueDonationForm.channel,
        donatedAt: mosqueDonationForm.donatedAt
          ? new Date(mosqueDonationForm.donatedAt).toISOString()
          : undefined,
        referenceNo: mosqueDonationForm.referenceNo.trim() || undefined,
        notes: mosqueDonationForm.notes.trim() || undefined
      })
    });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setMosqueDonationErrors({});
    setNotice("Don enregistre.");
    setMosqueWorkflowStep("donations");
    setMosqueDonationForm((prev) => ({
      ...prev,
      amount: "",
      referenceNo: "",
      notes: ""
    }));
    await loadMosqueWithCurrentFilters();
  };

  const deleteMosqueDonation = async (id: string): Promise<void> => {
    if (!window.confirm("Supprimer ce don ?")) return;
    const response = await api(`/mosque/donations/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setNotice("Don supprime.");
    await loadMosqueWithCurrentFilters();
  };

  const submitEnrollment = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {};
    if (!enrollmentForm.schoolYearId) errors.schoolYearId = "Annee scolaire requise.";
    if (!enrollmentForm.classId) errors.classId = "Classe requise.";
    if (!enrollmentForm.studentId) errors.studentId = "Eleve requis.";
    if (!enrollmentForm.enrollmentDate) errors.enrollmentDate = "Date d'inscription requise.";
    if (!enrollmentForm.enrollmentStatus.trim()) errors.enrollmentStatus = "Statut requis.";
    const selectedClass = classes.find((item) => item.id === enrollmentForm.classId);
    if (selectedClass && selectedClass.schoolYearId !== enrollmentForm.schoolYearId) {
      errors.classId = "La classe doit appartenir a l'annee selectionnee.";
    }
    setEnrollmentErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("create");
      return;
    }
    const response = await api("/enrollments", {
      method: "POST",
      body: JSON.stringify({
        schoolYearId: enrollmentForm.schoolYearId,
        classId: enrollmentForm.classId,
        studentId: enrollmentForm.studentId,
        enrollmentDate: enrollmentForm.enrollmentDate || today(),
        enrollmentStatus: enrollmentForm.enrollmentStatus.trim().toUpperCase() || "ENROLLED"
      })
    });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setEnrollmentErrors({});
    setNotice("Inscription créée.");
    setEnrollmentWorkflowStep("list");
    await loadEnrollments(enrollmentFilters);
  };

  const deleteEnrollment = async (id: string): Promise<void> => {
    if (!window.confirm("Supprimer cette inscription ?")) return;
    const response = await api(`/enrollments/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setNotice("Inscription supprimée.");
    await loadEnrollments(enrollmentFilters);
  };

  const resetEnrollmentFilters = async (): Promise<void> => {
    const next = { schoolYearId: "", classId: "", studentId: "" };
    setEnrollmentFilters(next);
    await loadEnrollments(next);
  };

  const submitFeePlan = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {};
    if (!feePlanForm.schoolYearId) errors.schoolYearId = "Annee scolaire requise.";
    if (!feePlanForm.levelId) errors.levelId = "Niveau requis.";
    if (!feePlanForm.label.trim()) errors.label = "Libelle requis.";
    if (!feePlanForm.currency.trim()) errors.currency = "Devise requise.";
    if (feePlanForm.currency.trim() && feePlanForm.currency.trim().length !== 3) {
      errors.currency = "Code devise sur 3 lettres (ex: CFA, affiche F CFA).";
    }

    const totalAmount = Number(feePlanForm.totalAmount);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      errors.totalAmount = "Le montant total doit etre > 0.";
    }
    setFeePlanErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("feePlans");
      return;
    }

    const response = await api("/fee-plans", {
      method: "POST",
      body: JSON.stringify({
        schoolYearId: feePlanForm.schoolYearId,
        levelId: feePlanForm.levelId,
        label: feePlanForm.label.trim(),
        totalAmount,
        currency: feePlanForm.currency.trim().toUpperCase()
      })
    });

    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    setFeePlanErrors({});
    setNotice("Plan tarifaire cree.");
    setFinanceWorkflowStep("feePlans");
    setFeePlanForm((prev) => ({ ...prev, label: "", totalAmount: "" }));
    await loadFinance();
  };

  const deleteFeePlan = async (id: string): Promise<void> => {
    if (!window.confirm("Supprimer ce plan de frais ?")) return;
    const response = await api(`/fee-plans/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    setNotice("Plan tarifaire supprime.");
    await loadFinance();
  };

  const submitInvoice = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {};
    if (!invoiceForm.studentId) errors.studentId = "Eleve requis.";
    if (!invoiceForm.schoolYearId) errors.schoolYearId = "Annee scolaire requise.";
    if (!invoiceForm.feePlanId && !invoiceForm.amountDue.trim()) {
      errors.amountDue = "Saisir un montant ou choisir un plan de frais.";
    }

    const payload: Record<string, unknown> = {
      studentId: invoiceForm.studentId,
      schoolYearId: invoiceForm.schoolYearId,
      dueDate: invoiceForm.dueDate || undefined
    };

    if (invoiceForm.feePlanId) {
      payload.feePlanId = invoiceForm.feePlanId;
    }

    if (invoiceForm.amountDue.trim()) {
      const amountDue = Number(invoiceForm.amountDue);
      if (!Number.isFinite(amountDue) || amountDue < 0) {
        errors.amountDue = "Le montant doit etre >= 0.";
      } else {
        payload.amountDue = amountDue;
      }
    }
    setInvoiceErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("invoices");
      return;
    }

    const response = await api("/invoices", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    setInvoiceErrors({});
    setNotice("Facture creee.");
    setFinanceWorkflowStep("invoices");
    setInvoiceForm((prev) => ({ ...prev, feePlanId: "", amountDue: "", dueDate: "" }));
    await loadFinance();
  };

  const deleteInvoice = async (id: string): Promise<void> => {
    if (!window.confirm("Supprimer cette facture ?")) return;
    const response = await api(`/invoices/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    setNotice("Facture supprimee.");
    await loadFinance();
  };

  const submitPayment = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {};
    if (!paymentForm.invoiceId) errors.invoiceId = "Facture requise.";
    if (!paymentForm.paymentMethod) errors.paymentMethod = "Mode de paiement requis.";

    const paidAmount = Number(paymentForm.paidAmount);
    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      errors.paidAmount = "Le montant verse doit etre > 0.";
    }
    setPaymentErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("payments");
      return;
    }

    const response = await api("/payments", {
      method: "POST",
      body: JSON.stringify({
        invoiceId: paymentForm.invoiceId,
        paidAmount,
        paymentMethod: paymentForm.paymentMethod,
        referenceExternal: paymentForm.referenceExternal || undefined
      })
    });

    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    setPaymentErrors({});
    setNotice("Paiement enregistre.");
    setFinanceWorkflowStep("payments");
    setPaymentForm((prev) => ({ ...prev, paidAmount: "", referenceExternal: "" }));
    await loadFinance();
  };

  const openReceipt = async (paymentId: string): Promise<void> => {
    const response = await api(`/payments/${paymentId}/receipt`);
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    const payload = (await response.json()) as { pdfDataUrl: string };
    setReceiptPdfUrl(payload.pdfDataUrl);
    window.open(payload.pdfDataUrl, "_blank", "noopener,noreferrer");
  };

  const hasCompatibleClassPeriod = (classId: string, academicPeriodId: string): boolean => {
    const classroom = classes.find((item) => item.id === classId);
    const period = periods.find((item) => item.id === academicPeriodId);
    if (!classroom || !period) {
      return false;
    }
    return classroom.schoolYearId === period.schoolYearId;
  };

  const submitGrade = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {};
    if (!gradeForm.studentId) errors.studentId = "Eleve requis.";
    if (!gradeForm.classId) errors.classId = "Classe requise.";
    if (!gradeForm.subjectId) errors.subjectId = "Matiere requise.";
    if (!gradeForm.academicPeriodId) errors.academicPeriodId = "Periode requise.";
    if (!gradeForm.assessmentLabel.trim()) errors.assessmentLabel = "Evaluation requise.";

    const score = Number(gradeForm.score);
    const scoreMax = Number(gradeForm.scoreMax || "20");

    if (!Number.isFinite(score) || score < 0) {
      errors.score = "La note doit etre >= 0.";
    }

    if (!Number.isFinite(scoreMax) || scoreMax <= 0) {
      errors.scoreMax = "Le bareme doit etre > 0.";
    }
    if (Number.isFinite(score) && Number.isFinite(scoreMax) && score > scoreMax) {
      errors.score = "La note ne peut pas depasser le bareme.";
    }

    if (!hasCompatibleClassPeriod(gradeForm.classId, gradeForm.academicPeriodId)) {
      errors.academicPeriodId = "La periode doit appartenir a la meme annee scolaire.";
    }
    setGradeErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("entry");
      return;
    }

    const response = await api("/grades", {
      method: "POST",
      body: JSON.stringify({
        studentId: gradeForm.studentId,
        classId: gradeForm.classId,
        subjectId: gradeForm.subjectId,
        academicPeriodId: gradeForm.academicPeriodId,
        assessmentLabel: gradeForm.assessmentLabel.trim(),
        assessmentType: gradeForm.assessmentType,
        score,
        scoreMax
      })
    });

    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    setGradeErrors({});
    setNotice("Note enregistree.");
    setGradesWorkflowStep("entry");
    setGradeForm((prev) => ({ ...prev, score: "" }));
    await loadGrades(gradeFilters);
    await loadReportCards();
  };

  const applyGradeFilters = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    if (
      gradeFilters.classId &&
      gradeFilters.academicPeriodId &&
      !hasCompatibleClassPeriod(gradeFilters.classId, gradeFilters.academicPeriodId)
    ) {
      setError("La periode filtree doit appartenir a la meme annee scolaire que la classe.");
      return;
    }
    await loadGrades(gradeFilters);
  };

  const computeClassSummary = async (): Promise<void> => {
    if (!gradeFilters.classId || !gradeFilters.academicPeriodId) {
      setError("Selectionne d'abord une classe et une periode.");
      return;
    }

    if (!hasCompatibleClassPeriod(gradeFilters.classId, gradeFilters.academicPeriodId)) {
      setError("La periode doit appartenir a la meme annee scolaire que la classe selectionnee.");
      return;
    }

    const response = await api(
      `/grades/class-summary?classId=${encodeURIComponent(gradeFilters.classId)}&academicPeriodId=${encodeURIComponent(gradeFilters.academicPeriodId)}`
    );

    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    setClassSummary((await response.json()) as ClassSummary);
    setGradesWorkflowStep("summary");
    setNotice("Synthese de classe calculee.");
  };

  const generateReportCard = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {};
    if (!reportForm.studentId) errors.studentId = "Eleve requis.";
    if (!reportForm.classId) errors.classId = "Classe requise.";
    if (!reportForm.academicPeriodId) errors.academicPeriodId = "Periode requise.";

    if (!hasCompatibleClassPeriod(reportForm.classId, reportForm.academicPeriodId)) {
      errors.academicPeriodId = "Classe et periode doivent etre dans la meme annee scolaire.";
    }
    setReportErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("reports");
      return;
    }

    const response = await api("/report-cards/generate", {
      method: "POST",
      body: JSON.stringify({
        studentId: reportForm.studentId,
        classId: reportForm.classId,
        academicPeriodId: reportForm.academicPeriodId,
        publish: true
      })
    });

    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    setReportErrors({});
    const payload = (await response.json()) as ReportCard;
    setReportPdfUrl(payload.pdfDataUrl || "");
    if (payload.pdfDataUrl) {
      window.open(payload.pdfDataUrl, "_blank", "noopener,noreferrer");
    }

    setNotice("Bulletin genere.");
    setGradesWorkflowStep("reports");
    await loadReportCards();
  };

  const openReportCardPdf = async (reportCardId: string): Promise<void> => {
    const response = await api(`/report-cards/${reportCardId}/pdf`);
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    const payload = (await response.json()) as { pdfDataUrl: string };
    setReportPdfUrl(payload.pdfDataUrl);
    window.open(payload.pdfDataUrl, "_blank", "noopener,noreferrer");
  };

  const schoolYearById = new Map(schoolYears.map((item) => [item.id, item]));
  const classById = new Map(classes.map((item) => [item.id, item]));
  const studentById = new Map(students.map((item) => [item.id, item]));
  const levelById = new Map(levels.map((item) => [item.id, item]));
  const formatAmount = (value: number): string => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
  const formatCurrencyLabel = (currency?: string): string => {
    const normalized = (currency || DEFAULT_CURRENCY).trim().toUpperCase();
    return normalized === "XOF" || normalized === "CFA" ? "F CFA" : normalized;
  };
  const formatChannelLabel = (value?: string): string => {
    const normalized = (value || "").trim().toUpperCase();
    return CHANNEL_LABELS[normalized] || value || "-";
  };
  const formatMoney = (value: number, currency?: string): string =>
    `${formatAmount(value)} ${formatCurrencyLabel(currency)}`;
  const gradeFilterClass = classById.get(gradeFilters.classId);
  const gradeFormClass = classById.get(gradeForm.classId);
  const reportFormClass = classById.get(reportForm.classId);

  const gradeFilterPeriods = gradeFilterClass
    ? periods.filter((item) => item.schoolYearId === gradeFilterClass.schoolYearId)
    : periods;
  const gradeFormPeriods = gradeFormClass
    ? periods.filter((item) => item.schoolYearId === gradeFormClass.schoolYearId)
    : periods;
  const reportFormPeriods = reportFormClass
    ? periods.filter((item) => item.schoolYearId === reportFormClass.schoolYearId)
    : periods;

  const renderStudents = (): JSX.Element => {
    const studentSteps: WorkflowStepDef[] = [
      {
        id: "entry",
        title: editingStudentId ? "Edition du dossier" : "Nouveau dossier",
        hint: "Renseigner les informations d'identite de l'eleve."
      },
      {
        id: "list",
        title: "Base eleves",
        hint: "Filtrer, verifier et corriger les dossiers existants.",
        done: students.length > 0
      }
    ];

    return (
      <WorkflowGuide
        title="Eleves"
        steps={studentSteps}
        activeStepId={studentWorkflowStep}
        onStepChange={setStudentWorkflowStep}
      >
        {studentWorkflowStep === "entry" ? (
          <section data-step-id="entry" className="panel editor-panel workflow-section">
            <div className="table-header">
              <h2>{editingStudentId ? "Modifier un eleve" : "Ajouter un eleve"}</h2>
            </div>
            <p className="hint">Matricule unique, identite complete, puis validation.</p>
            <form className="form-grid" onSubmit={(event) => void submitStudent(event)}>
              <label>
                Matricule
                <input
                  value={studentForm.matricule}
                  onChange={(event) => setStudentForm((prev) => ({ ...prev, matricule: event.target.value }))}
                  required
                />
                {fieldError(studentErrors, "matricule")}
              </label>
              <label>
                Prenom
                <input
                  value={studentForm.firstName}
                  onChange={(event) => setStudentForm((prev) => ({ ...prev, firstName: event.target.value }))}
                  required
                />
                {fieldError(studentErrors, "firstName")}
              </label>
              <label>
                Nom
                <input
                  value={studentForm.lastName}
                  onChange={(event) => setStudentForm((prev) => ({ ...prev, lastName: event.target.value }))}
                  required
                />
                {fieldError(studentErrors, "lastName")}
              </label>
              <label>
                Sexe
                <select
                  value={studentForm.sex}
                  onChange={(event) => setStudentForm((prev) => ({ ...prev, sex: event.target.value as "M" | "F" }))}
                >
                  <option value="M">M</option>
                  <option value="F">F</option>
                </select>
                {fieldError(studentErrors, "sex")}
              </label>
              <label>
                Date de naissance
                <input
                  type="date"
                  value={studentForm.birthDate}
                  onChange={(event) => setStudentForm((prev) => ({ ...prev, birthDate: event.target.value }))}
                />
                {fieldError(studentErrors, "birthDate")}
              </label>
              <div className="actions">
                <button type="submit">{editingStudentId ? "Mettre a jour" : "Ajouter"}</button>
                <button type="button" className="button-ghost" onClick={resetStudentForm}>
                  Reinitialiser
                </button>
                <button type="button" className="button-ghost" onClick={() => setStudentWorkflowStep("list")}>
                  Aller a la liste
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {studentWorkflowStep === "list" ? (
          <section data-step-id="list" className="panel table-panel workflow-section">
            <div className="table-header">
              <h2>Liste des eleves</h2>
              <input
                className="search-input"
                placeholder="Filtrer par matricule, nom ou prenom"
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
              />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Matricule</th>
                    <th>Nom</th>
                    <th>Sexe</th>
                    <th>Naissance</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {studentsLoading ? (
                    <tr>
                      <td colSpan={5} className="empty-row">
                        Chargement...
                      </td>
                    </tr>
                  ) : shownStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty-row">
                        Aucun eleve.
                      </td>
                    </tr>
                  ) : (
                    shownStudents.map((item) => (
                      <tr key={item.id}>
                        <td>{item.matricule}</td>
                        <td>
                          {item.firstName} {item.lastName}
                        </td>
                        <td>{item.sex}</td>
                        <td>{item.birthDate || "-"}</td>
                        <td>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="button-ghost"
                              onClick={() => {
                                setEditingStudentId(item.id);
                                setStudentForm({
                                  matricule: item.matricule,
                                  firstName: item.firstName,
                                  lastName: item.lastName,
                                  sex: item.sex,
                                  birthDate: item.birthDate || ""
                                });
                                setStudentWorkflowStep("entry");
                              }}
                            >
                              Modifier
                            </button>
                            <button type="button" className="button-danger" onClick={() => void deleteStudent(item.id)}>
                              Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </WorkflowGuide>
    );
  };
  const renderFinance = (): JSX.Element => {
    const financeSteps: WorkflowStepDef[] = [
      { id: "overview", title: "Pilotage", hint: "Suivre recouvrement et caisses.", done: !!recovery },
      { id: "feePlans", title: "Plans de frais", hint: "Definir les plans de frais.", done: feePlans.length > 0 },
      { id: "invoices", title: "Factures", hint: "Generer les factures eleves.", done: invoices.length > 0 },
      { id: "payments", title: "Paiements", hint: "Enregistrer les encaissements.", done: payments.length > 0 }
    ];

    const scrollToFinance = (stepId: string): void => {
      setFinanceWorkflowStep(stepId);
      const targetByStep: Record<string, string> = {
        overview: "finance-overview",
        feePlans: "finance-fee-plans",
        invoices: "finance-invoices",
        payments: "finance-payments"
      };
      const target = targetByStep[stepId];
      if (!target) return;
      window.setTimeout(() => {
        document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    };

    return (
      <WorkflowGuide
        title="Comptabilite"
        steps={financeSteps}
        activeStepId={financeWorkflowStep}
        onStepChange={scrollToFinance}
      >
        <section id="finance-overview" data-step-id="overview" className="panel table-panel workflow-section module-modern">
          <div className="table-header">
            <h2>Synthese du recouvrement</h2>
          </div>
          <p className="section-lead">Suivez la sante financiere avant de passer aux operations de saisie.</p>
          <div className="metrics-grid">
            <article className="metric-card">
              <span>Total du</span>
              <strong>{formatMoney(recovery?.totals.amountDue || 0)}</strong>
            </article>
            <article className="metric-card">
              <span>Montant encaisse</span>
              <strong>{formatMoney(recovery?.totals.amountPaid || 0)}</strong>
            </article>
            <article className="metric-card">
              <span>Reste a recouvrer</span>
              <strong>{formatMoney(recovery?.totals.remainingAmount || 0)}</strong>
            </article>
            <article className="metric-card">
              <span>Taux recouvrement</span>
              <strong>{(recovery?.totals.recoveryRatePercent || 0).toFixed(2)}%</strong>
            </article>
          </div>
          <div className="actions">
            <button type="button" className="button-ghost" onClick={() => void loadFinance()}>
              Recharger comptabilite
            </button>
            {receiptPdfUrl ? (
              <button
                type="button"
                className="button-ghost"
                onClick={() => window.open(receiptPdfUrl, "_blank", "noopener,noreferrer")}
              >
                Ouvrir le dernier recu
              </button>
            ) : null}
          </div>
        </section>

        <section id="finance-fee-plans" data-step-id="feePlans" className="panel editor-panel workflow-section module-modern">
          <h2>Plans de frais</h2>
          <p className="section-lead">Definissez les frais par annee et niveau, puis reutilisez-les pour la facturation.</p>
          <form className="form-grid module-form" onSubmit={(event) => void submitFeePlan(event)}>
            <label>
              Annee scolaire
              <select
                value={feePlanForm.schoolYearId}
                onChange={(event) => setFeePlanForm((prev) => ({ ...prev, schoolYearId: event.target.value }))}
                required
              >
                <option value="">Choisir...</option>
                {schoolYears.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code}
                  </option>
                ))}
              </select>
              {fieldError(feePlanErrors, "schoolYearId")}
            </label>
            <label>
              Niveau
              <select
                value={feePlanForm.levelId}
                onChange={(event) => setFeePlanForm((prev) => ({ ...prev, levelId: event.target.value }))}
                required
              >
                <option value="">Choisir...</option>
                {levels.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label}
                  </option>
                ))}
              </select>
              {fieldError(feePlanErrors, "levelId")}
            </label>
            <label>
              Libelle
              <input
                value={feePlanForm.label}
                onChange={(event) => setFeePlanForm((prev) => ({ ...prev, label: event.target.value }))}
                required
              />
              {fieldError(feePlanErrors, "label")}
            </label>
            <label>
              Montant total
              <input
                type="number"
                min={0}
                value={feePlanForm.totalAmount}
                onChange={(event) => setFeePlanForm((prev) => ({ ...prev, totalAmount: event.target.value }))}
                required
              />
              {fieldError(feePlanErrors, "totalAmount")}
            </label>
            <label>
              Devise
              <input
                maxLength={3}
                value={feePlanForm.currency}
                onChange={(event) => setFeePlanForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))}
              />
              {fieldError(feePlanErrors, "currency")}
            </label>
            <button type="submit">Creer le plan de frais</button>
          </form>
        </section>

        <section data-step-id="feePlans" className="panel table-panel workflow-section module-modern">
          <div className="table-header">
            <h2>Liste des plans de frais</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Libelle</th>
                  <th>Annee</th>
                  <th>Niveau</th>
                  <th>Total</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {feePlans.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-row">
                      Aucun plan de frais.
                    </td>
                  </tr>
                ) : (
                  feePlans.map((item) => (
                    <tr key={item.id}>
                      <td>{item.label}</td>
                      <td>{schoolYearById.get(item.schoolYearId)?.code || "-"}</td>
                      <td>{levelById.get(item.levelId)?.label || "-"}</td>
                      <td>
                        {formatMoney(item.totalAmount, item.currency)}
                      </td>
                      <td>
                        <button type="button" className="button-danger" onClick={() => void deleteFeePlan(item.id)}>
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section id="finance-invoices" data-step-id="invoices" className="panel editor-panel workflow-section module-modern">
          <h2>Factures</h2>
          <p className="section-lead">Associez un eleve, une annee et un montant du pour generer une facture claire.</p>
          <form className="form-grid module-form" onSubmit={(event) => void submitInvoice(event)}>
            <label>
              Eleve
              <select
                value={invoiceForm.studentId}
                onChange={(event) => setInvoiceForm((prev) => ({ ...prev, studentId: event.target.value }))}
                required
              >
                <option value="">Choisir...</option>
                {students.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.matricule} - {item.firstName} {item.lastName}
                  </option>
                ))}
              </select>
              {fieldError(invoiceErrors, "studentId")}
            </label>
            <label>
              Annee scolaire
              <select
                value={invoiceForm.schoolYearId}
                onChange={(event) => setInvoiceForm((prev) => ({ ...prev, schoolYearId: event.target.value }))}
                required
              >
                <option value="">Choisir...</option>
                {schoolYears.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code}
                  </option>
                ))}
              </select>
              {fieldError(invoiceErrors, "schoolYearId")}
            </label>
            <label>
              Plan de frais (optionnel)
              <select
                value={invoiceForm.feePlanId}
                onChange={(event) => setInvoiceForm((prev) => ({ ...prev, feePlanId: event.target.value }))}
              >
                <option value="">Aucun (montant manuel)</option>
                {feePlans.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              {fieldError(invoiceErrors, "feePlanId")}
            </label>
            <label>
              Montant du (optionnel)
              <input
                type="number"
                min={0}
                value={invoiceForm.amountDue}
                onChange={(event) => setInvoiceForm((prev) => ({ ...prev, amountDue: event.target.value }))}
                placeholder="Requis si aucun plan de frais"
              />
              {fieldError(invoiceErrors, "amountDue")}
            </label>
            <label>
              Date echeance
              <input
                type="date"
                value={invoiceForm.dueDate}
                onChange={(event) => setInvoiceForm((prev) => ({ ...prev, dueDate: event.target.value }))}
              />
            </label>
            <button type="submit">Creer facture</button>
          </form>
        </section>

        <section data-step-id="invoices" className="panel table-panel workflow-section module-modern">
          <div className="table-header">
            <h2>Liste factures</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Numero</th>
                  <th>Eleve</th>
                  <th>Du</th>
                  <th>Paye</th>
                  <th>Reste</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-row">
                      Aucune facture.
                    </td>
                  </tr>
                ) : (
                  invoices.map((item) => (
                    <tr key={item.id}>
                      <td>{item.invoiceNo}</td>
                      <td>{item.studentName || studentById.get(item.studentId)?.matricule || "-"}</td>
                      <td>{formatAmount(item.amountDue)}</td>
                      <td>{formatAmount(item.amountPaid)}</td>
                      <td>{formatAmount(item.remainingAmount)}</td>
                      <td>{formatInvoiceStatusLabel(item.status)}</td>
                      <td>
                        <button type="button" className="button-danger" onClick={() => void deleteInvoice(item.id)}>
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section id="finance-payments" data-step-id="payments" className="panel editor-panel workflow-section module-modern">
          <h2>Paiements</h2>
          <p className="section-lead">Enregistrez chaque encaissement et rattachez-le a la facture correspondante.</p>
          <form className="form-grid module-form" onSubmit={(event) => void submitPayment(event)}>
            <label>
              Facture
              <select
                value={paymentForm.invoiceId}
                onChange={(event) => setPaymentForm((prev) => ({ ...prev, invoiceId: event.target.value }))}
                required
              >
                <option value="">Choisir...</option>
                {invoices.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.invoiceNo} - reste {formatAmount(item.remainingAmount)}
                  </option>
                ))}
              </select>
              {fieldError(paymentErrors, "invoiceId")}
            </label>
            <label>
              Montant verse
              <input
                type="number"
                min={0}
                value={paymentForm.paidAmount}
                onChange={(event) => setPaymentForm((prev) => ({ ...prev, paidAmount: event.target.value }))}
                required
              />
              {fieldError(paymentErrors, "paidAmount")}
            </label>
            <label>
              Mode paiement
              <select
                value={paymentForm.paymentMethod}
                onChange={(event) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    paymentMethod: event.target.value as "CASH" | "MOBILE_MONEY" | "BANK"
                  }))
                }
              >
                <option value="CASH">{formatChannelLabel("CASH")}</option>
                <option value="MOBILE_MONEY">{formatChannelLabel("MOBILE_MONEY")}</option>
                <option value="BANK">{formatChannelLabel("BANK")}</option>
              </select>
              {fieldError(paymentErrors, "paymentMethod")}
            </label>
            <label>
              Reference externe
              <input
                value={paymentForm.referenceExternal}
                onChange={(event) => setPaymentForm((prev) => ({ ...prev, referenceExternal: event.target.value }))}
              />
            </label>
            <button type="submit">Enregistrer paiement</button>
          </form>
        </section>

        <section data-step-id="payments" className="panel table-panel workflow-section module-modern">
          <div className="table-header">
            <h2>Historique paiements</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Recu</th>
                  <th>Facture</th>
                  <th>Eleve</th>
                  <th>Montant</th>
                  <th>Mode</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-row">
                      Aucun paiement.
                    </td>
                  </tr>
                ) : (
                  payments.map((item) => (
                    <tr key={item.id}>
                      <td>{item.receiptNo}</td>
                      <td>{item.invoiceNo || "-"}</td>
                      <td>{item.studentName || "-"}</td>
                      <td>{formatAmount(item.paidAmount)}</td>
                      <td>{formatChannelLabel(item.paymentMethod)}</td>
                      <td>{new Date(item.paidAt).toLocaleString("fr-FR")}</td>
                      <td>
                        <button type="button" className="button-ghost" onClick={() => void openReceipt(item.id)}>
                          Recu en PDF
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </WorkflowGuide>
    );
  };

  const renderMosque = (): JSX.Element => {
    const mosqueSteps: WorkflowStepDef[] = [
      { id: "members", title: "Membres", hint: "Gerer le registre des fideles.", done: mosqueMembers.length > 0 },
      { id: "activities", title: "Activites", hint: "Planifier les activites de la mosquee.", done: mosqueActivities.length > 0 },
      { id: "donations", title: "Dons", hint: "Saisir et suivre les donations.", done: mosqueDonations.length > 0 },
      { id: "overview", title: "Pilotage", hint: "Suivre les indicateurs clefs du module.", done: !!mosqueDashboard }
    ];

    const scrollToMosque = (stepId: string): void => {
      setMosqueWorkflowStep(stepId);
      const targetByStep: Record<string, string> = {
        members: "mosque-members",
        activities: "mosque-activities",
        donations: "mosque-donations",
        overview: "mosque-overview"
      };
      const target = targetByStep[stepId];
      if (!target) return;
      window.setTimeout(() => {
        document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    };

    return (
      <WorkflowGuide
        title="Module mosquee"
        steps={mosqueSteps}
        activeStepId={mosqueWorkflowStep}
        onStepChange={scrollToMosque}
      >
        <>
          <section id="mosque-members" data-step-id="members" className="panel table-panel workflow-section">
            <div className="table-header">
              <h2>Registre des membres</h2>
              <div className="inline-actions">
                <label>
                  Format
                  <select
                    value={mosqueExportFormat}
                    onChange={(event) =>
                      setMosqueExportFormat(event.target.value as "PDF" | "EXCEL")
                    }
                  >
                    <option value="PDF">PDF</option>
                    <option value="EXCEL">Excel</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => void exportMosqueData("members")}
                >
                  Exporter membres
                </button>
              </div>
            </div>
            <form data-step-id="mosque-members" className="form-grid compact-form" onSubmit={(event) => void submitMosqueMember(event)}>
              <label>
                Code membre
                <input value={mosqueMemberForm.memberCode} onChange={(event) => setMosqueMemberForm((prev) => ({ ...prev, memberCode: event.target.value }))} required />
                {fieldError(mosqueMemberErrors, "memberCode")}
              </label>
              <label>
                Nom complet
                <input value={mosqueMemberForm.fullName} onChange={(event) => setMosqueMemberForm((prev) => ({ ...prev, fullName: event.target.value }))} required />
                {fieldError(mosqueMemberErrors, "fullName")}
              </label>
              <label>
                Sexe
                <select value={mosqueMemberForm.sex} onChange={(event) => setMosqueMemberForm((prev) => ({ ...prev, sex: event.target.value }))}>
                  <option value="">Non precise</option>
                  <option value="M">M</option>
                  <option value="F">F</option>
                </select>
              </label>
              <label>
                Statut
                <select value={mosqueMemberForm.status} onChange={(event) => setMosqueMemberForm((prev) => ({ ...prev, status: event.target.value }))}>
                  <option value="ACTIVE">{formatMemberStatusLabel("ACTIVE")}</option>
                  <option value="INACTIVE">{formatMemberStatusLabel("INACTIVE")}</option>
                </select>
                {fieldError(mosqueMemberErrors, "status")}
              </label>
              <label>
                Telephone
                <input value={mosqueMemberForm.phone} onChange={(event) => setMosqueMemberForm((prev) => ({ ...prev, phone: event.target.value }))} />
              </label>
              <label>
                Email
                <input type="email" value={mosqueMemberForm.email} onChange={(event) => setMosqueMemberForm((prev) => ({ ...prev, email: event.target.value }))} />
              </label>
              <label>
                Date adhesion
                <input type="date" value={mosqueMemberForm.joinedAt} onChange={(event) => setMosqueMemberForm((prev) => ({ ...prev, joinedAt: event.target.value }))} />
              </label>
              <label>
                Adresse
                <input value={mosqueMemberForm.address} onChange={(event) => setMosqueMemberForm((prev) => ({ ...prev, address: event.target.value }))} />
              </label>
              <button type="submit">Creer membre</button>
            </form>

            <form
              className="filter-grid"
              onSubmit={(event) => {
                event.preventDefault();
                void loadMosqueWithCurrentFilters();
              }}
            >
              <label>
                Statut
                <select value={mosqueMemberFilters.status} onChange={(event) => setMosqueMemberFilters((prev) => ({ ...prev, status: event.target.value }))}>
                  <option value="">Tous</option>
                  <option value="ACTIVE">{formatMemberStatusLabel("ACTIVE")}</option>
                  <option value="INACTIVE">{formatMemberStatusLabel("INACTIVE")}</option>
                </select>
              </label>
              <label>
                Recherche
                <input value={mosqueMemberFilters.q} onChange={(event) => setMosqueMemberFilters((prev) => ({ ...prev, q: event.target.value }))} placeholder="Nom, code ou telephone" />
              </label>
              <div className="actions">
                <button type="submit">Filtrer</button>
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => {
                    const next = { status: "", q: "" };
                    setMosqueMemberFilters(next);
                    void loadMosqueData({
                      memberFilters: next,
                      activityFilters: mosqueActivityFilters,
                      donationFilters: mosqueDonationFilters
                    });
                  }}
                >
                  Reinitialiser
                </button>
              </div>
            </form>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Nom</th>
                    <th>Statut</th>
                    <th>Contact</th>
                    <th>Adhesion</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mosqueMembers.length === 0 ? (
                    <tr><td colSpan={6} className="empty-row">Aucun membre.</td></tr>
                  ) : (
                    mosqueMembers.map((item) => (
                      <tr key={item.id}>
                        <td>{item.memberCode}</td>
                        <td>{item.fullName}</td>
                        <td>{formatMemberStatusLabel(item.status)}</td>
                        <td>{item.phone || item.email || "-"}</td>
                        <td>{item.joinedAt || "-"}</td>
                        <td>
                          <button type="button" className="button-danger" onClick={() => void deleteMosqueMember(item.id)}>
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section id="mosque-activities" data-step-id="activities" className="panel table-panel workflow-section">
            <div className="table-header">
              <h2>Activites mosquee</h2>
              <div className="inline-actions">
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => void exportMosqueData("activities")}
                >
                  Exporter activites
                </button>
              </div>
            </div>
            <form data-step-id="mosque-activities" className="form-grid compact-form" onSubmit={(event) => void submitMosqueActivity(event)}>
              <label>
                Code
                <input value={mosqueActivityForm.code} onChange={(event) => setMosqueActivityForm((prev) => ({ ...prev, code: event.target.value }))} required />
                {fieldError(mosqueActivityErrors, "code")}
              </label>
              <label>
                Titre
                <input value={mosqueActivityForm.title} onChange={(event) => setMosqueActivityForm((prev) => ({ ...prev, title: event.target.value }))} required />
                {fieldError(mosqueActivityErrors, "title")}
              </label>
              <label>
                Date
                <input type="date" value={mosqueActivityForm.activityDate} onChange={(event) => setMosqueActivityForm((prev) => ({ ...prev, activityDate: event.target.value }))} required />
                {fieldError(mosqueActivityErrors, "activityDate")}
              </label>
              <label>
                Categorie
                <input value={mosqueActivityForm.category} onChange={(event) => setMosqueActivityForm((prev) => ({ ...prev, category: event.target.value }))} required />
                {fieldError(mosqueActivityErrors, "category")}
              </label>
              <label>
                Lieu
                <input value={mosqueActivityForm.location} onChange={(event) => setMosqueActivityForm((prev) => ({ ...prev, location: event.target.value }))} />
              </label>
              <label className="check-row">
                <input type="checkbox" checked={mosqueActivityForm.isSchoolLinked} onChange={(event) => setMosqueActivityForm((prev) => ({ ...prev, isSchoolLinked: event.target.checked }))} />
                Liee a la vie scolaire
              </label>
              <label>
                Description
                <input value={mosqueActivityForm.description} onChange={(event) => setMosqueActivityForm((prev) => ({ ...prev, description: event.target.value }))} />
              </label>
              <button type="submit">Creer activite</button>
            </form>

            <form
              className="filter-grid"
              onSubmit={(event) => {
                event.preventDefault();
                void loadMosqueWithCurrentFilters();
              }}
            >
              <label>
                Categorie
                <input value={mosqueActivityFilters.category} onChange={(event) => setMosqueActivityFilters((prev) => ({ ...prev, category: event.target.value }))} />
              </label>
              <label>
                Du
                <input type="date" value={mosqueActivityFilters.from} onChange={(event) => setMosqueActivityFilters((prev) => ({ ...prev, from: event.target.value }))} />
              </label>
              <label>
                Au
                <input type="date" value={mosqueActivityFilters.to} onChange={(event) => setMosqueActivityFilters((prev) => ({ ...prev, to: event.target.value }))} />
              </label>
              <label>
                Recherche
                <input value={mosqueActivityFilters.q} onChange={(event) => setMosqueActivityFilters((prev) => ({ ...prev, q: event.target.value }))} />
              </label>
              <div className="actions">
                <button type="submit">Filtrer</button>
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => {
                    const next = { category: "", from: "", to: "", q: "" };
                    setMosqueActivityFilters(next);
                    void loadMosqueData({
                      memberFilters: mosqueMemberFilters,
                      activityFilters: next,
                      donationFilters: mosqueDonationFilters
                    });
                  }}
                >
                  Reinitialiser
                </button>
              </div>
            </form>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Code</th>
                    <th>Titre</th>
                    <th>Categorie</th>
                    <th>Lieu</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mosqueActivities.length === 0 ? (
                    <tr><td colSpan={6} className="empty-row">Aucune activite.</td></tr>
                  ) : (
                    mosqueActivities.map((item) => (
                      <tr key={item.id}>
                        <td>{item.activityDate}</td>
                        <td>{item.code}</td>
                        <td>{item.title}</td>
                        <td>{item.category}</td>
                        <td>{item.location || "-"}</td>
                        <td>
                          <button type="button" className="button-danger" onClick={() => void deleteMosqueActivity(item.id)}>
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section id="mosque-donations" data-step-id="donations" className="panel table-panel workflow-section">
            <div className="table-header">
              <h2>Dons & recettes</h2>
              <div className="inline-actions">
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => void exportMosqueData("donations")}
                >
                  Exporter dons
                </button>
              </div>
            </div>
            <form data-step-id="mosque-donations" className="form-grid compact-form" onSubmit={(event) => void submitMosqueDonation(event)}>
              <label>
                Membre (optionnel)
                <select value={mosqueDonationForm.memberId} onChange={(event) => setMosqueDonationForm((prev) => ({ ...prev, memberId: event.target.value }))}>
                  <option value="">Aucun</option>
                  {mosqueMembers.map((item) => (
                    <option key={item.id} value={item.id}>{item.memberCode} - {item.fullName}</option>
                  ))}
                </select>
              </label>
              <label>
                Montant
                <input type="number" min={0} value={mosqueDonationForm.amount} onChange={(event) => setMosqueDonationForm((prev) => ({ ...prev, amount: event.target.value }))} required />
                {fieldError(mosqueDonationErrors, "amount")}
              </label>
              <label>
                Devise
                <input value={mosqueDonationForm.currency} onChange={(event) => setMosqueDonationForm((prev) => ({ ...prev, currency: event.target.value }))} />
                {fieldError(mosqueDonationErrors, "currency")}
              </label>
              <label>
                Canal
                <select value={mosqueDonationForm.channel} onChange={(event) => setMosqueDonationForm((prev) => ({ ...prev, channel: event.target.value }))}>
                  <option value="CASH">{formatChannelLabel("CASH")}</option>
                  <option value="MOBILE_MONEY">{formatChannelLabel("MOBILE_MONEY")}</option>
                  <option value="BANK">{formatChannelLabel("BANK")}</option>
                  <option value="TRANSFER">{formatChannelLabel("TRANSFER")}</option>
                  <option value="OTHER">{formatChannelLabel("OTHER")}</option>
                </select>
                {fieldError(mosqueDonationErrors, "channel")}
              </label>
              <label>
                Date/heure don
                <input type="datetime-local" value={mosqueDonationForm.donatedAt} onChange={(event) => setMosqueDonationForm((prev) => ({ ...prev, donatedAt: event.target.value }))} />
              </label>
              <label>
                Reference
                <input value={mosqueDonationForm.referenceNo} onChange={(event) => setMosqueDonationForm((prev) => ({ ...prev, referenceNo: event.target.value }))} />
              </label>
              <label>
                Notes
                <input value={mosqueDonationForm.notes} onChange={(event) => setMosqueDonationForm((prev) => ({ ...prev, notes: event.target.value }))} />
              </label>
              <button type="submit">Enregistrer don</button>
            </form>

            <form
              className="filter-grid"
              onSubmit={(event) => {
                event.preventDefault();
                void loadMosqueWithCurrentFilters();
              }}
            >
              <label>
                Membre
                <select value={mosqueDonationFilters.memberId} onChange={(event) => setMosqueDonationFilters((prev) => ({ ...prev, memberId: event.target.value }))}>
                  <option value="">Tous</option>
                  {mosqueMembers.map((item) => (
                    <option key={item.id} value={item.id}>{item.memberCode}</option>
                  ))}
                </select>
              </label>
              <label>
                Canal
                <select value={mosqueDonationFilters.channel} onChange={(event) => setMosqueDonationFilters((prev) => ({ ...prev, channel: event.target.value }))}>
                  <option value="">Tous</option>
                  <option value="CASH">{formatChannelLabel("CASH")}</option>
                  <option value="MOBILE_MONEY">{formatChannelLabel("MOBILE_MONEY")}</option>
                  <option value="BANK">{formatChannelLabel("BANK")}</option>
                  <option value="TRANSFER">{formatChannelLabel("TRANSFER")}</option>
                  <option value="OTHER">{formatChannelLabel("OTHER")}</option>
                </select>
              </label>
              <label>
                Du
                <input type="date" value={mosqueDonationFilters.from} onChange={(event) => setMosqueDonationFilters((prev) => ({ ...prev, from: event.target.value }))} />
              </label>
              <label>
                Au
                <input type="date" value={mosqueDonationFilters.to} onChange={(event) => setMosqueDonationFilters((prev) => ({ ...prev, to: event.target.value }))} />
              </label>
              <div className="actions">
                <button type="submit">Filtrer</button>
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => {
                    const next = { memberId: "", channel: "", from: "", to: "" };
                    setMosqueDonationFilters(next);
                    void loadMosqueData({
                      memberFilters: mosqueMemberFilters,
                      activityFilters: mosqueActivityFilters,
                      donationFilters: next
                    });
                  }}
                >
                  Reinitialiser
                </button>
              </div>
            </form>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Membre</th>
                    <th>Canal</th>
                    <th>Montant</th>
                    <th>Reference</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mosqueDonations.length === 0 ? (
                    <tr><td colSpan={6} className="empty-row">Aucun don.</td></tr>
                  ) : (
                    mosqueDonations.map((item) => (
                      <tr key={item.id}>
                        <td>{new Date(item.donatedAt).toLocaleString("fr-FR")}</td>
                        <td>{item.memberName || item.memberCode || "-"}</td>
                        <td>{formatChannelLabel(item.channel)}</td>
                        <td>{formatMoney(item.amount, item.currency)}</td>
                        <td>{item.referenceNo || "-"}</td>
                        <td>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="button-ghost"
                              onClick={() => void openMosqueDonationReceipt(item.id)}
                            >
                              Recu en PDF
                            </button>
                            <button type="button" className="button-danger" onClick={() => void deleteMosqueDonation(item.id)}>
                              Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section id="mosque-overview" data-step-id="overview" className="panel table-panel workflow-section">
            <div className="table-header">
              <h2>Synthese du module mosquee</h2>
              <button type="button" className="button-ghost" onClick={() => void loadMosqueWithCurrentFilters()}>
                Actualiser
              </button>
            </div>
            <div className="metrics-grid">
              <article className="metric-card">
                <span>Membres</span>
                <strong>{mosqueDashboard?.totals.members ?? 0}</strong>
                <small className="subtle">Actifs: {mosqueDashboard?.totals.activeMembers ?? 0}</small>
              </article>
              <article className="metric-card">
                <span>Activites ce mois</span>
                <strong>{mosqueDashboard?.totals.activitiesThisMonth ?? 0}</strong>
                <small className="subtle">Calendrier communautaire</small>
              </article>
              <article className="metric-card">
                <span>Dons ce mois</span>
                <strong>{formatMoney(mosqueDashboard?.totals.donationsThisMonth ?? 0)}</strong>
                <small className="subtle">Moyenne: {formatMoney(mosqueDashboard?.totals.averageDonation ?? 0)}</small>
              </article>
              <article className="metric-card">
                <span>Total dons</span>
                <strong>{formatMoney(mosqueDashboard?.totals.donationsTotal ?? 0)}</strong>
                <small className="subtle">Cumule historique</small>
              </article>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Canal</th>
                    <th>Transactions</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {mosqueDashboard?.donationsByChannel?.length ? (
                    mosqueDashboard.donationsByChannel.map((item) => (
                      <tr key={item.channel}>
                        <td>{formatChannelLabel(item.channel)}</td>
                        <td>{item.count}</td>
                        <td>{formatMoney(item.totalAmount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={3} className="empty-row">Aucune donnee.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      </WorkflowGuide>
    );
  };

  const renderGrades = (): JSX.Element => {
    const gradeSteps: WorkflowStepDef[] = [
      { id: "filters", title: "Filtres", hint: "Cibler classe, matiere et periode." },
      { id: "entry", title: "Saisie", hint: "Enregistrer les notes de l'evaluation.", done: grades.length > 0 },
      { id: "summary", title: "Moyennes", hint: "Calculer moyenne generale et rangs.", done: !!classSummary },
      { id: "reports", title: "Bulletins", hint: "Generer les bulletins PDF.", done: reportCards.length > 0 }
    ];

    const scrollToGrades = (stepId: string): void => {
      setGradesWorkflowStep(stepId);
      const targetByStep: Record<string, string> = {
        filters: "grades-filters",
        entry: "grades-entry",
        summary: "grades-summary",
        reports: "grades-reports"
      };
      const target = targetByStep[stepId];
      if (!target) return;
      window.setTimeout(() => {
        document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    };

    return (
      <WorkflowGuide
        title="Notes & bulletins"
        steps={gradeSteps}
        activeStepId={gradesWorkflowStep}
        onStepChange={scrollToGrades}
      >
        <section id="grades-filters" data-step-id="filters" className="panel table-panel workflow-section module-modern">
          <div className="table-header">
            <h2>Filtres notes</h2>
          </div>
          <p className="section-lead">Ciblez une classe, une matiere et une periode pour travailler sans surcharge.</p>
          <form className="filter-grid module-filter" onSubmit={(event) => void applyGradeFilters(event)}>
            <label>
              Classe
              <select
                value={gradeFilters.classId}
                onChange={(event) => setGradeFilters((prev) => ({ ...prev, classId: event.target.value }))}
              >
                <option value="">Toutes</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Matiere
              <select
                value={gradeFilters.subjectId}
                onChange={(event) => setGradeFilters((prev) => ({ ...prev, subjectId: event.target.value }))}
              >
                <option value="">Toutes</option>
                {subjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Periode
              <select
                value={gradeFilters.academicPeriodId}
                onChange={(event) =>
                  setGradeFilters((prev) => ({ ...prev, academicPeriodId: event.target.value }))
                }
              >
                <option value="">Toutes</option>
                {gradeFilterPeriods.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Eleve
              <select
                value={gradeFilters.studentId}
                onChange={(event) => setGradeFilters((prev) => ({ ...prev, studentId: event.target.value }))}
              >
                <option value="">Tous</option>
                {students.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.matricule} - {item.firstName} {item.lastName}
                  </option>
                ))}
              </select>
            </label>
            <div className="actions">
              <button type="submit">Filtrer</button>
              <button
                type="button"
                className="button-ghost"
                onClick={() => {
                  const next = { classId: "", subjectId: "", academicPeriodId: "", studentId: "" };
                  setGradeFilters(next);
                  setClassSummary(null);
                  void loadGrades(next);
                }}
              >
                Reinitialiser
              </button>
              <button type="button" className="button-ghost" onClick={() => void computeClassSummary()}>
                Calculer moyennes/rangs
              </button>
            </div>
          </form>
        </section>

        <section id="grades-entry" data-step-id="entry" className="panel editor-panel workflow-section module-modern">
          <h2>Saisie note</h2>
          <p className="section-lead">Saisissez une evaluation a la fois avec validations inline.</p>
          <form className="form-grid module-form" onSubmit={(event) => void submitGrade(event)}>
            <label>
              Eleve
              <select
                value={gradeForm.studentId}
                onChange={(event) => setGradeForm((prev) => ({ ...prev, studentId: event.target.value }))}
                required
              >
                <option value="">Choisir...</option>
                {students.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.matricule} - {item.firstName} {item.lastName}
                  </option>
                ))}
              </select>
              {fieldError(gradeErrors, "studentId")}
            </label>
            <label>
              Classe
              <select
                value={gradeForm.classId}
                onChange={(event) => setGradeForm((prev) => ({ ...prev, classId: event.target.value }))}
                required
              >
                <option value="">Choisir...</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label}
                  </option>
                ))}
              </select>
              {fieldError(gradeErrors, "classId")}
            </label>
            <label>
              Matiere
              <select
                value={gradeForm.subjectId}
                onChange={(event) => setGradeForm((prev) => ({ ...prev, subjectId: event.target.value }))}
                required
              >
                <option value="">Choisir...</option>
                {subjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label}
                  </option>
                ))}
              </select>
              {fieldError(gradeErrors, "subjectId")}
            </label>
            <label>
              Periode
              <select
                value={gradeForm.academicPeriodId}
                onChange={(event) =>
                  setGradeForm((prev) => ({ ...prev, academicPeriodId: event.target.value }))
                }
                required
              >
                <option value="">Choisir...</option>
                {gradeFormPeriods.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label}
                  </option>
                ))}
              </select>
              {fieldError(gradeErrors, "academicPeriodId")}
            </label>
            <label>
              Evaluation
              <input
                value={gradeForm.assessmentLabel}
                onChange={(event) => setGradeForm((prev) => ({ ...prev, assessmentLabel: event.target.value }))}
                required
              />
              {fieldError(gradeErrors, "assessmentLabel")}
            </label>
            <label>
              Type
              <select
                value={gradeForm.assessmentType}
                onChange={(event) =>
                  setGradeForm((prev) => ({
                    ...prev,
                    assessmentType: event.target.value as "DEVOIR" | "COMPOSITION" | "ORAL" | "TP"
                  }))
                }
              >
                <option value="DEVOIR">DEVOIR</option>
                <option value="COMPOSITION">COMPOSITION</option>
                <option value="ORAL">ORAL</option>
                <option value="TP">TP</option>
              </select>
            </label>
            <label>
              Note
              <input
                type="number"
                min={0}
                step="0.01"
                value={gradeForm.score}
                onChange={(event) => setGradeForm((prev) => ({ ...prev, score: event.target.value }))}
                required
              />
              {fieldError(gradeErrors, "score")}
            </label>
            <label>
              Bareme
              <input
                type="number"
                min={1}
                step="0.01"
                value={gradeForm.scoreMax}
                onChange={(event) => setGradeForm((prev) => ({ ...prev, scoreMax: event.target.value }))}
                required
              />
              {fieldError(gradeErrors, "scoreMax")}
            </label>
            <button type="submit">Enregistrer note</button>
          </form>
        </section>

        <section data-step-id="entry" className="panel table-panel workflow-section module-modern">
          <div className="table-header">
            <h2>Notes enregistrees</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Eleve</th>
                  <th>Classe</th>
                  <th>Matiere</th>
                  <th>Periode</th>
                  <th>Evaluation</th>
                  <th>Type</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {grades.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-row">
                      Aucune note.
                    </td>
                  </tr>
                ) : (
                  grades.map((item) => (
                    <tr key={item.id}>
                      <td>{item.studentName || studentById.get(item.studentId)?.matricule || "-"}</td>
                      <td>{classById.get(item.classId)?.label || "-"}</td>
                      <td>{item.subjectLabel || subjects.find((subject) => subject.id === item.subjectId)?.label || "-"}</td>
                      <td>{periods.find((period) => period.id === item.academicPeriodId)?.label || "-"}</td>
                      <td>{item.assessmentLabel}</td>
                      <td>{item.assessmentType}</td>
                      <td>
                        {item.score}/{item.scoreMax}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section id="grades-summary" data-step-id="summary" className="panel table-panel workflow-section module-modern">
          <div className="table-header">
            <h2>Moyennes et rangs</h2>
          </div>
          {classSummary && classSummary.students.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Matricule</th>
                    <th>Eleve</th>
                    <th>Moyenne</th>
                    <th>Rang</th>
                    <th>Notes</th>
                    <th>Appreciation</th>
                  </tr>
                </thead>
                <tbody>
                  {classSummary.students
                    .slice()
                    .sort((left, right) => left.classRank - right.classRank)
                    .map((item) => (
                      <tr key={item.studentId}>
                        <td>{item.matricule}</td>
                        <td>{item.studentName}</td>
                        <td>{item.averageGeneral.toFixed(2)}</td>
                        <td>{item.classRank}</td>
                        <td>{item.noteCount}</td>
                        <td>{item.appreciation}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="subtle">Aucun resume calcule pour l'instant.</p>
          )}
        </section>

        <section id="grades-reports" data-step-id="reports" className="panel editor-panel workflow-section module-modern">
          <h2>Generation bulletin PDF</h2>
          <p className="section-lead">Generez un bulletin par eleve/periode et ouvrez le PDF en un clic.</p>
          <form className="form-grid module-form" onSubmit={(event) => void generateReportCard(event)}>
            <label>
              Eleve
              <select
                value={reportForm.studentId}
                onChange={(event) => setReportForm((prev) => ({ ...prev, studentId: event.target.value }))}
                required
              >
                <option value="">Choisir...</option>
                {students.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.matricule} - {item.firstName} {item.lastName}
                  </option>
                ))}
              </select>
              {fieldError(reportErrors, "studentId")}
            </label>
            <label>
              Classe
              <select
                value={reportForm.classId}
                onChange={(event) => setReportForm((prev) => ({ ...prev, classId: event.target.value }))}
                required
              >
                <option value="">Choisir...</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label}
                  </option>
                ))}
              </select>
              {fieldError(reportErrors, "classId")}
            </label>
            <label>
              Periode
              <select
                value={reportForm.academicPeriodId}
                onChange={(event) =>
                  setReportForm((prev) => ({ ...prev, academicPeriodId: event.target.value }))
                }
                required
              >
                <option value="">Choisir...</option>
                {reportFormPeriods.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label}
                  </option>
                ))}
              </select>
              {fieldError(reportErrors, "academicPeriodId")}
            </label>
            <button type="submit">Generer bulletin</button>
          </form>
          <div className="actions">
            <button type="button" className="button-ghost" onClick={() => void loadReportCards()}>
              Recharger bulletins
            </button>
            {reportPdfUrl ? (
              <button
                type="button"
                className="button-ghost"
                onClick={() => window.open(reportPdfUrl, "_blank", "noopener,noreferrer")}
              >
                Ouvrir dernier bulletin
              </button>
            ) : null}
          </div>
        </section>

        <section data-step-id="reports" className="panel table-panel workflow-section module-modern">
          <div className="table-header">
            <h2>Bulletins generes</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Eleve</th>
                  <th>Classe</th>
                  <th>Periode</th>
                  <th>Moyenne</th>
                  <th>Rang</th>
                  <th>Appreciation</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reportCards.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-row">
                      Aucun bulletin.
                    </td>
                  </tr>
                ) : (
                  reportCards.map((item) => (
                    <tr key={item.id}>
                      <td>{item.studentName || studentById.get(item.studentId)?.matricule || "-"}</td>
                      <td>{item.classLabel || classById.get(item.classId)?.label || "-"}</td>
                      <td>{item.periodLabel || periods.find((period) => period.id === item.academicPeriodId)?.label || "-"}</td>
                      <td>{item.averageGeneral.toFixed(2)}</td>
                      <td>{item.classRank || "-"}</td>
                      <td>{item.appreciation || "-"}</td>
                      <td>
                        <button type="button" className="button-ghost" onClick={() => void openReportCardPdf(item.id)}>
                          PDF
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </WorkflowGuide>
    );
  };

  const renderReports = (): JSX.Element => {
    const reportSteps: WorkflowStepDef[] = [
      {
        id: "overview",
        title: "Indicateurs executifs",
        hint: "Synthese multi-modules",
        done: !!analyticsOverview
      },
      {
        id: "compliance",
        title: "Journal d'audit",
        hint: "Tracabilite des actions",
        done: (auditLogs?.items.length || 0) > 0
      },
      {
        id: "export",
        title: "Exports metier",
        hint: "Livrables de pilotage"
      }
    ];

    const renderTrend = (
      title: string,
      points: AnalyticsTrendPoint[],
      unit: "amount" | "count"
    ): JSX.Element => {
      const max = Math.max(...points.map((point) => point.value), 0);
      return (
        <article className="panel trend-panel">
          <h4>{title}</h4>
          <div className="trend-list">
            {points.length === 0 ? (
              <p className="subtle">Aucune donnee.</p>
            ) : (
              points.map((point) => (
                <div key={`${title}-${point.bucket}`} className="trend-row">
                  <span>{point.label}</span>
                  <div className="trend-track">
                    <span
                      style={{
                        width: `${max > 0 ? Math.max(8, Math.round((point.value / max) * 100)) : 0}%`
                      }}
                    />
                  </div>
                  <strong>
                    {unit === "amount"
                      ? formatMoney(point.value)
                      : point.value.toLocaleString("fr-FR")}
                  </strong>
                </div>
              ))
            )}
          </div>
        </article>
      );
    };

    return (
      <WorkflowGuide
        title="Rapports avances et conformite"
        steps={reportSteps}
        activeStepId={reportWorkflowStep}
        onStepChange={setReportWorkflowStep}
      >
        <section className="panel table-panel" data-step-id="overview">
          <div className="table-header">
            <h2>Filtrer la fenetre de pilotage</h2>
            <span className="subtle">
              Derniere generation:{" "}
              {analyticsOverview?.generatedAt
                ? new Date(analyticsOverview.generatedAt).toLocaleString("fr-FR")
                : "-"}
            </span>
          </div>
          <form
            className="filter-grid"
            onSubmit={(event) => {
              event.preventDefault();
              void loadAnalytics(analyticsFilters);
            }}
          >
            <label>
              Du
              <input
                type="date"
                value={analyticsFilters.from}
                onChange={(event) =>
                  setAnalyticsFilters((prev) => ({ ...prev, from: event.target.value }))
                }
              />
            </label>
            <label>
              Au
              <input
                type="date"
                value={analyticsFilters.to}
                onChange={(event) =>
                  setAnalyticsFilters((prev) => ({ ...prev, to: event.target.value }))
                }
              />
            </label>
            <label>
              Annee scolaire
              <select
                value={analyticsFilters.schoolYearId}
                onChange={(event) =>
                  setAnalyticsFilters((prev) => ({
                    ...prev,
                    schoolYearId: event.target.value
                  }))
                }
              >
                <option value="">Toutes</option>
                {schoolYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.code}
                  </option>
                ))}
              </select>
            </label>
            <div className="actions">
              <button type="submit">Actualiser KPI</button>
              <button
                type="button"
                className="button-ghost"
                onClick={() => {
                  const next = { from: "", to: "", schoolYearId: "" };
                  setAnalyticsFilters(next);
                  void loadAnalytics(next);
                }}
              >
                Reinitialiser
              </button>
            </div>
          </form>
          <div className="metrics-grid reports-grid">
            <article className="metric-card">
              <span>Eleves actifs</span>
              <strong>{analyticsOverview?.students.active ?? 0}</strong>
              <small className="subtle">
                +{analyticsOverview?.students.createdInWindow ?? 0} sur la periode
              </small>
            </article>
            <article className="metric-card">
              <span>Inscriptions actives</span>
              <strong>{analyticsOverview?.academics.activeEnrollments ?? 0}</strong>
              <small className="subtle">
                {analyticsOverview?.academics.classes ?? 0} classes surveillees
              </small>
            </article>
            <article className="metric-card">
              <span>Recouvrement</span>
              <strong>
                {(analyticsOverview?.finance.recoveryRatePercent ?? 0).toFixed(1)}%
              </strong>
              <small className="subtle">
                Reste {formatMoney(analyticsOverview?.finance.remainingAmount ?? 0)}
              </small>
            </article>
            <article className="metric-card">
              <span>Absences</span>
              <strong>{analyticsOverview?.schoolLife.absences ?? 0}</strong>
              <small className="subtle">
                {analyticsOverview?.schoolLife.justificationRatePercent?.toFixed(1) ?? "0.0"}% justifiees
              </small>
            </article>
            <article className="metric-card">
              <span>Dons mosquee</span>
              <strong>
                {formatMoney(analyticsOverview?.mosque.donationsInWindow ?? 0)}
              </strong>
              <small className="subtle">
                {analyticsOverview?.mosque.donationsCountInWindow ?? 0} transactions
              </small>
            </article>
            <article className="metric-card">
              <span>Alertes notifications</span>
              <strong>{analyticsOverview?.schoolLife.notificationsFailed ?? 0}</strong>
              <small className="subtle">
                {analyticsOverview?.schoolLife.notificationsQueued ?? 0} en attente
              </small>
            </article>
          </div>
          <div className="split-grid">
            {renderTrend("Paiements mensuels", analyticsOverview?.trends.payments || [], "amount")}
            {renderTrend("Dons mensuels", analyticsOverview?.trends.donations || [], "amount")}
            {renderTrend("Absences mensuelles", analyticsOverview?.trends.absences || [], "count")}
          </div>
        </section>

        <section className="panel table-panel" data-step-id="compliance">
          <div className="table-header">
            <h2>Journal de conformite</h2>
            <span className="subtle">
              {auditLogs ? `${auditLogs.total} evenement(s)` : "Aucun chargement"}
            </span>
          </div>
          <form
            className="filter-grid"
            onSubmit={(event) => {
              event.preventDefault();
              const next = { ...auditFilters, page: 1 };
              setAuditFilters(next);
              void loadAuditLogs(next);
            }}
          >
            <label>
              Ressource
              <input
                value={auditFilters.resource}
                onChange={(event) =>
                  setAuditFilters((prev) => ({ ...prev, resource: event.target.value }))
                }
                placeholder="users, finance, auth..."
              />
            </label>
            <label>
              Action
              <input
                value={auditFilters.action}
                onChange={(event) =>
                  setAuditFilters((prev) => ({ ...prev, action: event.target.value }))
                }
                placeholder="USER_CREATED..."
              />
            </label>
            <label>
              Utilisateur
              <select
                value={auditFilters.userId}
                onChange={(event) =>
                  setAuditFilters((prev) => ({ ...prev, userId: event.target.value }))
                }
              >
                <option value="">Tous</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Recherche
              <input
                value={auditFilters.q}
                onChange={(event) =>
                  setAuditFilters((prev) => ({ ...prev, q: event.target.value }))
                }
                placeholder="ID ressource, identifiant utilisateur..."
              />
            </label>
            <label>
              Du
              <input
                type="date"
                value={auditFilters.from}
                onChange={(event) =>
                  setAuditFilters((prev) => ({ ...prev, from: event.target.value }))
                }
              />
            </label>
            <label>
              Au
              <input
                type="date"
                value={auditFilters.to}
                onChange={(event) =>
                  setAuditFilters((prev) => ({ ...prev, to: event.target.value }))
                }
              />
            </label>
            <label>
              Taille page
              <select
                value={auditFilters.pageSize}
                onChange={(event) =>
                  setAuditFilters((prev) => ({
                    ...prev,
                    pageSize: Number(event.target.value) || 20,
                    page: 1
                  }))
                }
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
            <div className="actions">
              <button type="submit">Filtrer audit</button>
              <button
                type="button"
                className="button-ghost"
                onClick={() => {
                  const next = {
                    resource: "",
                    action: "",
                    userId: "",
                    q: "",
                    from: "",
                    to: "",
                    page: 1,
                    pageSize: 20
                  };
                  setAuditFilters(next);
                  void loadAuditLogs(next);
                }}
              >
                Reinitialiser
              </button>
            </div>
          </form>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Utilisateur</th>
                  <th>Action</th>
                  <th>Ressource</th>
                  <th>ID Ressource</th>
                  <th>Payload</th>
                </tr>
              </thead>
              <tbody>
                {!auditLogs || auditLogs.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-row">
                      Aucun log d'audit.
                    </td>
                  </tr>
                ) : (
                  auditLogs.items.map((item) => (
                    <tr key={item.id}>
                      <td>{new Date(item.createdAt).toLocaleString("fr-FR")}</td>
                      <td>{item.username || "-"}</td>
                      <td>{item.action}</td>
                      <td>{item.resource}</td>
                      <td>{item.resourceId || "-"}</td>
                      <td>{item.payloadPreview || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="pagination-row">
            <span className="subtle">
              Page {auditLogs?.page || 1} / {auditLogs?.totalPages || 1}
            </span>
            <div className="actions">
              <button
                type="button"
                className="button-ghost"
                disabled={!auditLogs || auditLogs.page <= 1}
                onClick={() => {
                  if (!auditLogs) return;
                  const next = { ...auditFilters, page: Math.max(1, auditLogs.page - 1) };
                  setAuditFilters(next);
                  void loadAuditLogs(next);
                }}
              >
                Prec.
              </button>
              <button
                type="button"
                className="button-ghost"
                disabled={!auditLogs || auditLogs.page >= auditLogs.totalPages}
                onClick={() => {
                  if (!auditLogs) return;
                  const next = {
                    ...auditFilters,
                    page: Math.min(auditLogs.totalPages, auditLogs.page + 1)
                  };
                  setAuditFilters(next);
                  void loadAuditLogs(next);
                }}
              >
                Suiv.
              </button>
            </div>
          </div>
        </section>

        <section className="panel table-panel" data-step-id="export">
          <div className="table-header">
            <h2>Livrables d'export</h2>
            <span className="subtle">Exporter des preuves exploitables pour audit et pilotage.</span>
          </div>
          <div className="split-grid">
            <article className="panel soft-card">
              <h3>Pack audit</h3>
              <p className="subtle">
                Exporte les actions sensibles (auth, permissions, creation/suppression).
              </p>
              <label>
                Format
                <select
                  value={auditExportFormat}
                  onChange={(event) =>
                    setAuditExportFormat(event.target.value as "PDF" | "EXCEL")
                  }
                >
                  <option value="PDF">PDF</option>
                  <option value="EXCEL">Excel</option>
                </select>
              </label>
              <button type="button" onClick={() => void exportAuditLogs()}>
                Exporter audit
              </button>
            </article>
            <article className="panel soft-card">
                <h3>Points de controle avant mise en ligne</h3>
                <ul className="plain-list">
                  <li>API de production avec sondes de sante et metriques d'exploitation</li>
                  <li>Sauvegarde PostgreSQL automatisee</li>
                  <li>Notifications externes avec suivi de delivrabilite</li>
                  <li>Exports PDF et Excel metier pour la finance, la mosquee et l'audit</li>
                </ul>
              </article>
          </div>
        </section>
      </WorkflowGuide>
    );
  };

  const renderDashboard = (): JSX.Element => {
    if (!currentRole) {
      return <></>;
    }

    const activeModules = filteredTiles.slice(0, 8);
    const primaryModule = filteredTiles[0];
    const openInvoices = invoices.filter((item) => item.status !== "PAID").length;
    const pendingReports = Math.max(0, classes.length - reportCards.length);
    const lowRecovery = (recovery?.totals.recoveryRatePercent ?? 0) < 70;
    let heroEyebrow = "Accueil simplifie";
    let heroTitle = "Tableau de bord clair et actionnable";
    let heroText = currentSlide.quote;
    let primaryActionScreen: ScreenId = primaryModule?.screen || ROLE_HOME_SCREEN[currentRole];
    let primaryActionLabel = primaryModule
      ? `Ouvrir ${primaryModule.title}`
      : "Ouvrir l'espace principal";

    let dashboardCards: Array<{ label: string; value: string | number; hint: string }> = [];
    let dashboardTasks: Array<{ id: string; title: string; text: string; screen: ScreenId }> = [];
    let dashboardNotifications: Array<{
      id: string;
      tone: "warning" | "info";
      title: string;
      text: string;
    }> = [];

    if (currentRole === "PARENT") {
      heroEyebrow = "Espace parent";
      heroTitle = "Suivi famille strictement limite a vos enfants";
      heroText =
        "Accedez uniquement aux absences, bulletins, emplois du temps et paiements qui concernent votre famille.";
      primaryActionScreen = "parentPortal";
      primaryActionLabel = "Ouvrir le portail parent";
      dashboardCards = [
        {
          label: "Enfants",
          value: parentOverview?.childrenCount ?? parentChildren.length,
          hint: "Suivi famille"
        },
        {
          label: "Factures ouvertes",
          value: parentOverview?.openInvoicesCount ?? parentInvoices.filter((item) => item.status !== "PAID").length,
          hint: "A regler"
        },
        {
          label: "Reste a payer",
          value: formatMoney(parentOverview?.remainingAmount ?? 0),
          hint: "Situation famille"
        },
        {
          label: "Notifications",
          value: parentOverview?.notificationsCount ?? parentNotifications.length,
          hint: "Messages recus"
        }
      ];
      dashboardTasks = [
        {
          id: "parent-portal",
          title: "Ouvrir le portail parent",
          text: "Retrouver les notes, absences et bulletins de vos enfants.",
          screen: "parentPortal"
        },
        {
          id: "family-payments",
          title: "Verifier les paiements",
          text: "Consulter les factures ouvertes et les reglements deja recus.",
          screen: "parentPortal"
        },
        {
          id: "family-timetable",
          title: "Consulter l'emploi du temps",
          text: "Voir les horaires utiles directement depuis l'espace famille.",
          screen: "parentPortal"
        }
      ];
      dashboardNotifications = [
        (parentOverview?.remainingAmount ?? 0) > 0
          ? {
              id: "parent-remaining",
              tone: "warning",
              title: "Paiements a suivre",
              text: `Reste a payer: ${formatMoney(parentOverview?.remainingAmount ?? 0)}`
            }
          : null,
        (parentOverview?.absencesCount ?? 0) > 0
          ? {
              id: "parent-attendance",
              tone: "info",
              title: "Absences ou retards a consulter",
              text: `${parentOverview?.absencesCount ?? 0} evenement(s) concernent vos enfants.`
            }
          : null,
        parentNotifications[0]
          ? {
              id: `parent-notification-${parentNotifications[0].id}`,
              tone: "info",
              title: parentNotifications[0].title,
              text: parentNotifications[0].message
            }
          : null
      ].filter(
        (
          item
        ): item is {
          id: string;
          tone: "warning" | "info";
          title: string;
          text: string;
        } => item !== null
      );
    } else if (currentRole === "ENSEIGNANT") {
      heroEyebrow = "Espace enseignant";
      heroTitle = "Vue enseignant limitee a vos classes";
      heroText =
        "Retrouvez vos classes, vos notes, votre emploi du temps et les notifications utiles a votre mission.";
      primaryActionScreen = "teacherPortal";
      primaryActionLabel = "Ouvrir le portail enseignant";
      dashboardCards = [
        {
          label: "Classes",
          value: teacherOverview?.classesCount ?? teacherClasses.length,
          hint: "Affectations"
        },
        {
          label: "Eleves suivis",
          value: teacherOverview?.studentsCount ?? teacherStudents.length,
          hint: "Perimetre"
        },
        {
          label: "Notes",
          value: teacherOverview?.gradesCount ?? teacherGrades.length,
          hint: "Saisies"
        },
        {
          label: "Notifications",
          value: teacherOverview?.notificationsCount ?? teacherNotifications.length,
          hint: "Messages utiles"
        }
      ];
      dashboardTasks = [
        {
          id: "teacher-portal",
          title: "Ouvrir le portail enseignant",
          text: "Acceder aux classes, eleves et notes sous votre responsabilite.",
          screen: "teacherPortal"
        },
        {
          id: "teacher-grades",
          title: "Saisir les notes",
          text: "Renseigner les evaluations de vos classes affectees.",
          screen: "teacherPortal"
        },
        {
          id: "teacher-timetable",
          title: "Consulter l'emploi du temps",
          text: "Verifier rapidement vos creneaux hebdomadaires.",
          screen: "teacherPortal"
        }
      ];
      dashboardNotifications = [
        (teacherOverview?.pendingJustifications ?? 0) > 0
          ? {
              id: "teacher-justifications",
              tone: "warning",
              title: "Justificatifs en attente",
              text: `${teacherOverview?.pendingJustifications ?? 0} justificatif(s) restent a suivre.`
            }
          : null,
        teacherNotifications[0]
          ? {
              id: `teacher-notification-${teacherNotifications[0].id}`,
              tone: "info",
              title: teacherNotifications[0].title,
              text: teacherNotifications[0].message
            }
          : null,
        teacherNotifications[1]
          ? {
              id: `teacher-notification-${teacherNotifications[1].id}`,
              tone: "info",
              title: teacherNotifications[1].title,
              text: teacherNotifications[1].message
            }
          : null
      ].filter(
        (
          item
        ): item is {
          id: string;
          tone: "warning" | "info";
          title: string;
          text: string;
        } => item !== null
      );
    } else {
      const backOfficeCards: Array<{ label: string; value: string | number; hint: string } | null> = [
        hasScreenAccess(currentRole, "students")
          ? { label: "Eleves", value: students.length, hint: "Population" }
          : null,
        hasScreenAccess(currentRole, "reference") || hasScreenAccess(currentRole, "enrollments")
          ? { label: "Classes", value: classes.length, hint: "Organisation" }
          : null,
        hasScreenAccess(currentRole, "enrollments")
          ? { label: "Inscriptions", value: enrollments.length, hint: "Actives" }
          : null,
        hasScreenAccess(currentRole, "finance")
          ? {
              label: "Recouvrement",
              value: `${recovery ? recovery.totals.recoveryRatePercent.toFixed(1) : "0.0"}%`,
              hint: "Sante financiere"
            }
          : null,
        hasScreenAccess(currentRole, "grades")
          ? { label: "Bulletins", value: reportCards.length, hint: "Publies" }
          : null,
        hasScreenAccess(currentRole, "mosque")
          ? {
              label: "Dons mosquee",
              value: formatMoney(mosqueDashboard?.totals.donationsTotal ?? 0),
              hint: "Total cumule"
            }
          : null
      ];
      dashboardCards = backOfficeCards.filter(
        (item): item is { label: string; value: string | number; hint: string } => item !== null
      );

      dashboardTasks = [
        hasScreenAccess(currentRole, "students")
          ? {
              id: "students",
              title: "Creer un eleve",
              text: "Commencer un nouveau dossier eleve.",
              screen: "students" as ScreenId
            }
          : null,
        hasScreenAccess(currentRole, "enrollments")
          ? {
              id: "enrollments",
              title: "Valider les inscriptions",
              text: "Relier eleves, classes et annee scolaire.",
              screen: "enrollments" as ScreenId
            }
          : null,
        hasScreenAccess(currentRole, "finance")
          ? {
              id: "finance",
              title: "Suivre les paiements",
              text: "Verifier factures ouvertes et recouvrement.",
              screen: "finance" as ScreenId
            }
          : null,
        hasScreenAccess(currentRole, "grades")
          ? {
              id: "grades",
              title: "Publier les bulletins",
              text: "Generer les bulletins PDF de periode.",
              screen: "grades" as ScreenId
            }
          : null,
        hasScreenAccess(currentRole, "reports")
          ? {
              id: "reports",
              title: "Consulter les rapports",
              text: "Suivre les indicateurs et les journaux de conformite.",
              screen: "reports" as ScreenId
            }
          : null
      ].filter(
        (
          item
        ): item is {
          id: string;
          title: string;
          text: string;
          screen: ScreenId;
        } => item !== null
      );

      dashboardNotifications = [
        hasScreenAccess(currentRole, "finance") && lowRecovery
          ? {
              id: "recovery",
              tone: "warning",
              title: "Recouvrement a surveiller",
              text: `Taux actuel: ${(recovery?.totals.recoveryRatePercent ?? 0).toFixed(1)}%`
            }
          : null,
        hasScreenAccess(currentRole, "finance") && openInvoices > 0
          ? {
              id: "invoices",
              tone: "info",
              title: "Factures en attente",
              text: `${openInvoices} facture(s) restent a suivre.`
            }
          : null,
        hasScreenAccess(currentRole, "grades") && pendingReports > 0
          ? {
              id: "reports",
              tone: "info",
              title: "Bulletins a publier",
              text: `${pendingReports} classe(s) sans bulletin genere.`
            }
          : null
      ].filter(
        (
          item
        ): item is {
          id: string;
          tone: "warning" | "info";
          title: string;
          text: string;
        } => item !== null
      );
    }

    return (
      <>
        <section className="panel dashboard-hero">
          <div>
            <p className="eyebrow">{heroEyebrow}</p>
            <h2>{heroTitle}</h2>
            <p className="subtle">{heroText}</p>
          </div>
          <button
            type="button"
            className="hero-primary-cta"
            onClick={() => setTab(primaryActionScreen)}
          >
            {primaryActionLabel}
          </button>
        </section>

        <section className="dashboard-kpi-grid">
          {dashboardCards.slice(0, 4).map((card) => (
            <article key={card.label} className="panel metric-card kpi-card">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small className="subtle">{card.hint}</small>
            </article>
          ))}
        </section>

        <section className="dashboard-main-grid">
          <article className="panel dashboard-modules" aria-label="Modules applicatifs">
            <div className="table-header">
              <h2>Modules</h2>
              {moduleQuery.trim() ? (
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => {
                    setModuleQueryInput("");
                    setModuleQuery("");
                  }}
                >
                  Effacer filtre
                </button>
              ) : null}
            </div>
            <div className="module-grid">
              {activeModules.length === 0 ? (
                <article className="empty-modules">
                  <h3>Aucun module trouve</h3>
                  <p className="subtle">Essaie un mot-cle plus simple.</p>
                </article>
              ) : (
                activeModules.map((tile) => (
                  <button
                    key={tile.screen}
                    type="button"
                    className="module-card"
                    onClick={() => setTab(tile.screen)}
                  >
                    <span className={`module-icon tone-${tile.tone}`}>
                      <ModuleIcon name={tile.icon} />
                    </span>
                    <span className="module-text">
                      <strong>{tile.title}</strong>
                      <small>{tile.subtitle}</small>
                    </span>
                  </button>
                ))
              )}
            </div>
          </article>

            <aside className="dashboard-side">
              <article className="panel priority-panel">
                <div className="table-header">
                  <h3>{currentRole === "PARENT" ? "Actions utiles" : "Taches prioritaires"}</h3>
                </div>
                <div className="priority-list">
                  {dashboardTasks.length === 0 ? (
                    <p className="subtle">Aucune action prioritaire pour ce profil.</p>
                  ) : (
                    dashboardTasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        className="priority-item"
                        onClick={() => setTab(task.screen)}
                      >
                        <strong>{task.title}</strong>
                        <small>{task.text}</small>
                      </button>
                    ))
                  )}
                </div>
              </article>

              <article className="panel priority-panel">
                <div className="table-header">
                  <h3>{currentRole === "PARENT" ? "Informations recentes" : "Notifications recentes"}</h3>
                </div>
                <div className="notice-list">
                  {dashboardNotifications.length === 0 ? (
                    <p className="subtle">
                      {currentRole === "PARENT"
                        ? "Aucune information sensible ou urgente a signaler."
                        : "Aucune alerte critique pour le moment."}
                    </p>
                  ) : (
                    dashboardNotifications.map((item) => (
                      <article key={item.id} className={`notice-card notice-${item.tone}`}>
                      <strong>{item.title}</strong>
                      <p>{item.text}</p>
                    </article>
                  ))
                )}
              </div>
            </article>
          </aside>
        </section>
      </>
    );
  };

  const renderTeacherPortal = (): JSX.Element => {
    const teacherClass = teacherPortalFilters.classId
      ? teacherClasses.find((item) => item.classId === teacherPortalFilters.classId)
      : teacherClasses[0];
    const teacherPeriods = teacherClass
      ? periods.filter((item) => item.schoolYearId === teacherClass.schoolYearId)
      : periods;
    const teacherStudentsForClass = teacherPortalFilters.classId
      ? teacherStudents.filter((item) => item.classId === teacherPortalFilters.classId)
      : teacherStudents;

    return (
      <>
        <section className="panel table-panel workflow-section">
          <div className="table-header">
            <h2>Portail enseignant metier</h2>
            <div className="actions">
              <button
                type="button"
                className="button-ghost"
                onClick={() => void loadTeacherPortalData(teacherPortalFilters)}
              >
                Recharger
              </button>
            </div>
          </div>
          <div className="metrics-grid">
            <article className="metric-card">
              <span>Classes</span>
              <strong>{teacherOverview?.classesCount ?? 0}</strong>
            </article>
            <article className="metric-card">
              <span>Eleves suivis</span>
              <strong>{teacherOverview?.studentsCount ?? 0}</strong>
            </article>
            <article className="metric-card">
              <span>Notes saisies</span>
              <strong>{teacherOverview?.gradesCount ?? 0}</strong>
            </article>
            <article className="metric-card">
              <span>Justifs en attente</span>
              <strong>{teacherOverview?.pendingJustifications ?? 0}</strong>
            </article>
            <article className="metric-card">
              <span>Creneaux EDT</span>
              <strong>{teacherOverview?.timetableSlotsCount ?? 0}</strong>
            </article>
            <article className="metric-card">
              <span>Notifications</span>
              <strong>{teacherOverview?.notificationsCount ?? 0}</strong>
            </article>
          </div>
          <form
            className="filter-grid"
            onSubmit={(event) => {
              event.preventDefault();
              void loadTeacherPortalData(teacherPortalFilters);
            }}
          >
            <label>
              Classe
              <select
                value={teacherPortalFilters.classId}
                onChange={(event) =>
                  setTeacherPortalFilters((prev) => ({
                    ...prev,
                    classId: event.target.value
                  }))
                }
              >
                <option value="">Toutes</option>
                {teacherClasses.map((item) => (
                  <option key={item.assignmentId} value={item.classId}>
                    {item.classLabel} ({item.schoolYearCode})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Matiere
              <select
                value={teacherPortalFilters.subjectId}
                onChange={(event) =>
                  setTeacherPortalFilters((prev) => ({ ...prev, subjectId: event.target.value }))
                }
              >
                <option value="">Toutes</option>
                {subjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Periode
              <select
                value={teacherPortalFilters.academicPeriodId}
                onChange={(event) =>
                  setTeacherPortalFilters((prev) => ({
                    ...prev,
                    academicPeriodId: event.target.value
                  }))
                }
              >
                <option value="">Toutes</option>
                {teacherPeriods.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Eleve
              <select
                value={teacherPortalFilters.studentId}
                onChange={(event) =>
                  setTeacherPortalFilters((prev) => ({ ...prev, studentId: event.target.value }))
                }
              >
                <option value="">Tous</option>
                {teacherStudentsForClass.map((item) => (
                  <option key={item.enrollmentId} value={item.studentId}>
                    {item.matricule} - {item.studentName}
                  </option>
                ))}
              </select>
            </label>
            <div className="actions">
              <button type="submit">Filtrer</button>
              <button
                type="button"
                className="button-ghost"
                onClick={() => {
                  const reset = { classId: "", subjectId: "", academicPeriodId: "", studentId: "" };
                  setTeacherPortalFilters(reset);
                  void loadTeacherPortalData(reset);
                }}
              >
                Reinitialiser
              </button>
            </div>
          </form>
        </section>

        <section className="panel table-panel workflow-section">
          <div className="table-header">
            <h2>Actions metier</h2>
          </div>
          <div className="split-grid">
            <form data-step-id="teacher-grade" className="form-grid compact-form" onSubmit={(event) => void submitTeacherGrade(event)}>
              <h3>Saisir une note</h3>
              <label>
                Classe
                <select
                  value={teacherGradeForm.classId}
                  onChange={(event) => setTeacherGradeForm((prev) => ({ ...prev, classId: event.target.value }))}
                >
                  {teacherClasses.map((item) => (
                    <option key={item.assignmentId} value={item.classId}>
                      {item.classLabel}
                    </option>
                  ))}
                </select>
                {fieldError(teacherPortalErrors, "classId")}
              </label>
              <label>
                Eleve
                <select
                  value={teacherGradeForm.studentId}
                  onChange={(event) => setTeacherGradeForm((prev) => ({ ...prev, studentId: event.target.value }))}
                >
                  {teacherStudentsForClass.map((item) => (
                    <option key={item.enrollmentId} value={item.studentId}>
                      {item.matricule} - {item.studentName}
                    </option>
                  ))}
                </select>
                {fieldError(teacherPortalErrors, "studentId")}
              </label>
              <label>
                Matiere
                <select
                  value={teacherGradeForm.subjectId}
                  onChange={(event) => setTeacherGradeForm((prev) => ({ ...prev, subjectId: event.target.value }))}
                >
                  {subjects.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code}
                    </option>
                  ))}
                </select>
                {fieldError(teacherPortalErrors, "subjectId")}
              </label>
              <label>
                Periode
                <select
                  value={teacherGradeForm.academicPeriodId}
                  onChange={(event) =>
                    setTeacherGradeForm((prev) => ({ ...prev, academicPeriodId: event.target.value }))
                  }
                >
                  {teacherPeriods.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code}
                    </option>
                  ))}
                </select>
                {fieldError(teacherPortalErrors, "academicPeriodId")}
              </label>
              <label>
                Evaluation
                <input
                  value={teacherGradeForm.assessmentLabel}
                  onChange={(event) => setTeacherGradeForm((prev) => ({ ...prev, assessmentLabel: event.target.value }))}
                />
                {fieldError(teacherPortalErrors, "assessmentLabel")}
              </label>
              <label>
                Note
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={teacherGradeForm.score}
                  onChange={(event) => setTeacherGradeForm((prev) => ({ ...prev, score: event.target.value }))}
                />
                {fieldError(teacherPortalErrors, "score")}
              </label>
              <label>
                Bareme
                <input
                  type="number"
                  min={1}
                  step="0.01"
                  value={teacherGradeForm.scoreMax}
                  onChange={(event) => setTeacherGradeForm((prev) => ({ ...prev, scoreMax: event.target.value }))}
                />
                {fieldError(teacherPortalErrors, "scoreMax")}
              </label>
              <button type="submit">Enregistrer note</button>
            </form>

            <form data-step-id="teacher-attendance" className="form-grid compact-form" onSubmit={(event) => void submitTeacherAttendanceBulk(event)}>
              <h3>Pointage en masse</h3>
              <label>
                Classe
                <select
                  value={teacherAttendanceForm.classId}
                  onChange={(event) => setTeacherAttendanceForm((prev) => ({ ...prev, classId: event.target.value }))}
                >
                  {teacherClasses.map((item) => (
                    <option key={item.assignmentId} value={item.classId}>
                      {item.classLabel}
                    </option>
                  ))}
                </select>
                {fieldError(teacherPortalErrors, "classId")}
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={teacherAttendanceForm.attendanceDate}
                  onChange={(event) => setTeacherAttendanceForm((prev) => ({ ...prev, attendanceDate: event.target.value }))}
                />
                {fieldError(teacherPortalErrors, "attendanceDate")}
              </label>
              <label>
                Statut
                <select
                  value={teacherAttendanceForm.defaultStatus}
                  onChange={(event) =>
                    setTeacherAttendanceForm((prev) => ({ ...prev, defaultStatus: event.target.value }))
                  }
                >
                  <option value="PRESENT">{formatAttendanceStatusLabel("PRESENT")}</option>
                  <option value="ABSENT">{formatAttendanceStatusLabel("ABSENT")}</option>
                  <option value="LATE">{formatAttendanceStatusLabel("LATE")}</option>
                  <option value="EXCUSED">{formatAttendanceStatusLabel("EXCUSED")}</option>
                </select>
              </label>
              <label>
                Eleves (multi-select)
                <select
                  multiple
                  value={teacherAttendanceStudents}
                  onChange={(event) =>
                    setTeacherAttendanceStudents(
                      Array.from(event.target.selectedOptions).map((item) => item.value)
                    )
                  }
                >
                  {teacherStudentsForClass.map((item) => (
                    <option key={item.enrollmentId} value={item.studentId}>
                      {item.matricule} - {item.studentName}
                    </option>
                  ))}
                </select>
                {fieldError(teacherPortalErrors, "students")}
              </label>
              <button type="submit">Enregistrer pointage</button>
            </form>

            <form data-step-id="teacher-notifications" className="form-grid compact-form" onSubmit={(event) => void submitTeacherNotification(event)}>
              <h3>Notifier les parents</h3>
              <label>
                Classe
                <select
                  value={teacherNotificationForm.classId}
                  onChange={(event) => setTeacherNotificationForm((prev) => ({ ...prev, classId: event.target.value }))}
                >
                  {teacherClasses.map((item) => (
                    <option key={item.assignmentId} value={item.classId}>
                      {item.classLabel}
                    </option>
                  ))}
                </select>
                {fieldError(teacherPortalErrors, "classId")}
              </label>
              <label>
                Eleve cible (optionnel)
                <select
                  value={teacherNotificationForm.studentId}
                  onChange={(event) => setTeacherNotificationForm((prev) => ({ ...prev, studentId: event.target.value }))}
                >
                  <option value="">Tous les parents de la classe</option>
                  {teacherStudentsForClass.map((item) => (
                    <option key={item.enrollmentId} value={item.studentId}>
                      {item.studentName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Titre
                <input
                  value={teacherNotificationForm.title}
                  onChange={(event) => setTeacherNotificationForm((prev) => ({ ...prev, title: event.target.value }))}
                />
                {fieldError(teacherPortalErrors, "title")}
              </label>
              <label>
                Message
                <textarea
                  rows={3}
                  value={teacherNotificationForm.message}
                  onChange={(event) => setTeacherNotificationForm((prev) => ({ ...prev, message: event.target.value }))}
                />
                {fieldError(teacherPortalErrors, "message")}
              </label>
              <button type="submit">Envoyer notification</button>
            </form>
          </div>
        </section>

        <section className="panel table-panel workflow-section">
          <div className="table-header">
            <h2>Notes recentes</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Eleve</th>
                  <th>Matiere</th>
                  <th>Periode</th>
                  <th>Evaluation</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {teacherGrades.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-row">Aucune note.</td>
                  </tr>
                ) : (
                  teacherGrades.map((item) => (
                    <tr key={item.id}>
                      <td>{item.studentName || "-"}</td>
                      <td>{item.subjectLabel || "-"}</td>
                        <td>{periods.find((period) => period.id === item.academicPeriodId)?.label || "-"}</td>
                      <td>{item.assessmentLabel}</td>
                      <td>{item.score}/{item.scoreMax}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="split-grid">
          <section className="panel table-panel workflow-section">
            <div className="table-header">
              <h2>Emploi du temps</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Jour</th>
                    <th>Classe</th>
                    <th>Matiere</th>
                    <th>Horaire</th>
                    <th>Salle</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherTimetable.length === 0 ? (
                    <tr><td colSpan={5} className="empty-row">Aucun creneau.</td></tr>
                  ) : (
                    teacherTimetable.map((item) => (
                      <tr key={item.id}>
                        <td>{formatWeekdayLabel(item.dayOfWeek)}</td>
                        <td>{item.classLabel || "-"}</td>
                        <td>{item.subjectLabel || "-"}</td>
                        <td>{item.startTime} - {item.endTime}</td>
                        <td>{item.room || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel table-panel workflow-section">
            <div className="table-header">
              <h2>Notifications</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Titre</th>
                    <th>Cible</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherNotifications.length === 0 ? (
                    <tr><td colSpan={4} className="empty-row">Aucune notification.</td></tr>
                  ) : (
                    teacherNotifications.map((item) => (
                      <tr key={item.id}>
                        <td>{new Date(item.createdAt).toLocaleString("fr-FR")}</td>
                        <td>{item.title}</td>
                        <td>{item.studentName || formatAudienceRoleLabel(item.audienceRole) || "-"}</td>
                        <td>{formatPortalNotificationStatusLabel(item.status)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </>
    );
  };

  const renderIam = (): JSX.Element => {
    const iamSteps: WorkflowStepDef[] = [
      {
        id: "accounts",
        title: editingUserId ? "Edition compte" : "Comptes utilisateurs",
        hint: "Creer, modifier et desactiver les comptes.",
        done: users.length > 0
      },
      {
        id: "permissions",
        title: "Droits par profil",
        hint: "Ajuster les autorisations API par ressource et action.",
        done: rolePermissions.some((item) => item.source === "CUSTOM")
      },
      {
        id: "links",
        title: "Affectations portail",
        hint: "Lier enseignant-classes et parent-eleves.",
        done: teacherAssignments.length > 0 || parentLinks.length > 0
      }
    ];

    const goToStep = (stepId: string): void => {
      setIamWorkflowStep(stepId);
      const targetByStep: Record<string, string> = {
        accounts: "iam-accounts",
        permissions: "iam-permissions",
        links: "iam-links"
      };
      const target = targetByStep[stepId];
      if (!target) return;
      window.setTimeout(() => {
        document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    };

    return (
      <WorkflowGuide
        title="Utilisateurs & droits"
        steps={iamSteps}
        activeStepId={iamWorkflowStep}
        onStepChange={goToStep}
      >
        <>
          <section id="iam-accounts" data-step-id="accounts" className="panel editor-panel workflow-section">
            <h2>{editingUserId ? "Modifier utilisateur" : "Creer utilisateur"}</h2>
            <form className="form-grid" onSubmit={(event) => void submitUser(event)}>
              <label>
                Nom utilisateur
                <input
                  value={userForm.username}
                  onChange={(event) => setUserForm((prev) => ({ ...prev, username: event.target.value }))}
                  required
                />
                {fieldError(userErrors, "username")}
              </label>
              <label>
                Mot de passe {editingUserId ? "(laisser vide pour conserver)" : ""}
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(event) => setUserForm((prev) => ({ ...prev, password: event.target.value }))}
                  required={!editingUserId}
                  minLength={12}
                />
                {fieldError(userErrors, "password")}
              </label>
              <label>
                Profil
                <select
                  value={userForm.role}
                  onChange={(event) => setUserForm((prev) => ({ ...prev, role: event.target.value as Role }))}
                >
                  {ROLE_VALUES.map((role) => (
                    <option key={role} value={role}>
                      {formatRoleLabel(role)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={userForm.isActive}
                  onChange={(event) =>
                    setUserForm((prev) => ({ ...prev, isActive: event.target.checked }))
                  }
                />
                Compte actif
              </label>
              <div className="actions">
                <button type="submit">{editingUserId ? "Mettre a jour" : "Creer utilisateur"}</button>
                {editingUserId ? (
                  <button type="button" className="button-ghost" onClick={resetUserForm}>
                    Annuler
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section data-step-id="accounts" className="panel table-panel workflow-section">
            <div className="table-header">
              <h2>Utilisateurs du tenant</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Identifiant</th>
                    <th>Profil</th>
                    <th>Statut</th>
                    <th>Maj</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty-row">
                        Aucun utilisateur.
                      </td>
                    </tr>
                  ) : (
                    users.map((item) => (
                      <tr key={item.id}>
                        <td>{item.username}</td>
                        <td>{formatRoleLabel(item.role)}</td>
                        <td>{item.isActive ? "ACTIF" : "INACTIF"}</td>
                        <td>{new Date(item.updatedAt).toLocaleString("fr-FR")}</td>
                        <td>
                          <div className="inline-actions">
                            <button type="button" className="button-ghost" onClick={() => startEditUser(item)}>
                              Modifier
                            </button>
                            <button type="button" className="button-danger" onClick={() => void deleteUserAccount(item.id)}>
                              Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section id="iam-permissions" data-step-id="permissions" className="panel table-panel workflow-section">
            <div className="table-header">
              <h2>Droits API par profil</h2>
              <div className="inline-actions">
                <label>
                  Profil cible
                  <select
                    value={rolePermissionTarget}
                    onChange={(event) => {
                      const nextRole = event.target.value as Role;
                      setRolePermissionTarget(nextRole);
                      void loadRolePermissions(nextRole);
                    }}
                  >
                    {ROLE_VALUES.map((role) => (
                      <option key={role} value={role}>
                        {formatRoleLabel(role)}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="button-ghost" onClick={() => void loadRolePermissions(rolePermissionTarget)}>
                  Recharger
                </button>
                <button type="button" onClick={() => void saveRolePermissions()}>
                  Enregistrer les droits
                </button>
              </div>
            </div>
            <p className="subtle">
              Cochez pour autoriser. Les routes restent proteges par les profils d'ecran et d'API.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ressource</th>
                    {PERMISSION_ACTION_VALUES.map((action) => (
                      <th key={action}>{formatPermissionActionLabel(action)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_RESOURCE_VALUES.map((resource) => (
                    <tr key={resource}>
                      <td>{formatPermissionResourceLabel(resource)}</td>
                      {PERMISSION_ACTION_VALUES.map((action) => (
                        <td key={`${resource}:${action}`}>
                          <input
                            type="checkbox"
                            checked={getEffectivePermission(resource, action)}
                            onChange={(event) =>
                              toggleRolePermission(resource, action, event.target.checked)
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="iam-links" data-step-id="links" className="panel table-panel workflow-section">
            <div className="table-header">
              <h2>Affectations portail metier</h2>
            </div>
            <div className="split-grid">
              <form className="form-grid compact-form" onSubmit={(event) => void submitTeacherAssignment(event)}>
                <h3>Affecter un enseignant</h3>
                <label>
                  Enseignant
                  <select
                    value={teacherAssignmentForm.userId}
                    onChange={(event) =>
                      setTeacherAssignmentForm((prev) => ({ ...prev, userId: event.target.value }))
                    }
                  >
                    {users
                      .filter((item) => item.role === "ENSEIGNANT" && item.isActive)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.username}
                        </option>
                      ))}
                  </select>
                  {fieldError(teacherAssignmentErrors, "userId")}
                </label>
                <label>
                  Classe
                  <select
                    value={teacherAssignmentForm.classId}
                    onChange={(event) =>
                      setTeacherAssignmentForm((prev) => ({ ...prev, classId: event.target.value }))
                    }
                  >
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} - {item.label}
                      </option>
                    ))}
                  </select>
                  {fieldError(teacherAssignmentErrors, "classId")}
                </label>
                <label>
                  Annee scolaire
                  <select
                    value={teacherAssignmentForm.schoolYearId}
                    onChange={(event) =>
                      setTeacherAssignmentForm((prev) => ({ ...prev, schoolYearId: event.target.value }))
                    }
                  >
                    {schoolYears.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code}
                      </option>
                    ))}
                  </select>
                  {fieldError(teacherAssignmentErrors, "schoolYearId")}
                </label>
                <label>
                  Matiere (optionnel)
                  <select
                    value={teacherAssignmentForm.subjectId}
                    onChange={(event) =>
                      setTeacherAssignmentForm((prev) => ({ ...prev, subjectId: event.target.value }))
                    }
                  >
                    <option value="">Toutes</option>
                    {subjects.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} - {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit">Creer affectation</button>
              </form>

              <form className="form-grid compact-form" onSubmit={(event) => void submitParentLink(event)}>
                <h3>Lier un parent a un eleve</h3>
                <label>
                  Compte parent
                  <select
                    value={parentLinkForm.parentUserId}
                    onChange={(event) =>
                      setParentLinkForm((prev) => ({ ...prev, parentUserId: event.target.value }))
                    }
                  >
                    {users
                      .filter((item) => item.role === "PARENT" && item.isActive)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.username}
                        </option>
                      ))}
                  </select>
                  {fieldError(parentLinkErrors, "parentUserId")}
                </label>
                <label>
                  Eleve
                  <select
                    value={parentLinkForm.studentId}
                    onChange={(event) =>
                      setParentLinkForm((prev) => ({ ...prev, studentId: event.target.value }))
                    }
                  >
                    {students.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.matricule} - {item.firstName} {item.lastName}
                      </option>
                    ))}
                  </select>
                  {fieldError(parentLinkErrors, "studentId")}
                </label>
                <label>
                  Lien de parente
                  <input
                    value={parentLinkForm.relationship}
                    onChange={(event) =>
                      setParentLinkForm((prev) => ({ ...prev, relationship: event.target.value }))
                    }
                    placeholder="Pere, Mere, Tuteur..."
                  />
                </label>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={parentLinkForm.isPrimary}
                    onChange={(event) =>
                      setParentLinkForm((prev) => ({ ...prev, isPrimary: event.target.checked }))
                    }
                  />
                  Contact principal
                </label>
                <button type="submit">Creer lien parent</button>
              </form>
            </div>

            <div className="split-grid">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Enseignant</th>
                      <th>Classe</th>
                      <th>Annee</th>
                      <th>Matiere</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teacherAssignments.length === 0 ? (
                      <tr><td colSpan={5} className="empty-row">Aucune affectation.</td></tr>
                    ) : (
                      teacherAssignments.map((item) => (
                        <tr key={item.id}>
                          <td>{item.teacherUsername}</td>
                          <td>{item.classLabel}</td>
                          <td>{item.schoolYearCode}</td>
                          <td>{item.subjectLabel || "Toutes"}</td>
                          <td>
                            <button
                              type="button"
                              className="button-danger"
                              onClick={() => void deleteTeacherAssignment(item.id)}
                            >
                              Supprimer
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Parent</th>
                      <th>Eleve</th>
                      <th>Relation</th>
                      <th>Principal</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parentLinks.length === 0 ? (
                      <tr><td colSpan={5} className="empty-row">Aucun lien parent-eleve.</td></tr>
                    ) : (
                      parentLinks.map((item) => (
                        <tr key={item.id}>
                          <td>{item.parentUsername}</td>
                          <td>{item.studentMatricule} - {item.studentName}</td>
                          <td>{item.relationship || "-"}</td>
                          <td>{item.isPrimary ? "Oui" : "Non"}</td>
                          <td>
                            <button
                              type="button"
                              className="button-danger"
                              onClick={() => void deleteParentLink(item.id)}
                            >
                              Supprimer
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      </WorkflowGuide>
    );
  };

  const renderParentPortal = (): JSX.Element => {
    return (
      <>
        <section className="panel table-panel workflow-section">
          <div className="table-header">
            <h2>Portail parent metier</h2>
            <div className="actions">
              <button type="button" className="button-ghost" onClick={() => void loadParentPortalData(parentStudentFilter)}>
                Recharger
              </button>
            </div>
          </div>
          <div className="metrics-grid">
            <article className="metric-card">
              <span>Enfants lies</span>
              <strong>{parentOverview?.childrenCount ?? 0}</strong>
            </article>
            <article className="metric-card">
              <span>Factures ouvertes</span>
              <strong>{parentOverview?.openInvoicesCount ?? 0}</strong>
            </article>
            <article className="metric-card">
              <span>Reste a payer</span>
              <strong>{formatMoney(parentOverview?.remainingAmount ?? 0)}</strong>
            </article>
            <article className="metric-card">
              <span>Absences/retards</span>
              <strong>{parentOverview?.absencesCount ?? 0}</strong>
            </article>
            <article className="metric-card">
              <span>Bulletins</span>
              <strong>{parentOverview?.reportCardsCount ?? 0}</strong>
            </article>
            <article className="metric-card">
              <span>Notifications</span>
              <strong>{parentOverview?.notificationsCount ?? 0}</strong>
            </article>
          </div>
          <form
            className="filter-grid"
            onSubmit={(event) => {
              event.preventDefault();
              void loadParentPortalData(parentStudentFilter);
            }}
          >
            <label>
              Enfant
              <select
                value={parentStudentFilter}
                onChange={(event) => setParentStudentFilter(event.target.value)}
              >
                <option value="">Tous</option>
                {parentChildren.map((item) => (
                  <option key={item.linkId} value={item.studentId}>
                    {item.matricule} - {item.studentName}
                  </option>
                ))}
              </select>
            </label>
            <div className="actions">
              <button type="submit">Filtrer</button>
              <button
                type="button"
                className="button-ghost"
                onClick={() => {
                  setParentStudentFilter("");
                  void loadParentPortalData("");
                }}
              >
                Reinitialiser
              </button>
            </div>
          </form>
        </section>

        <div className="split-grid">
          <section className="panel table-panel workflow-section">
            <div className="table-header">
              <h2>Notes</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Eleve</th>
                    <th>Matiere</th>
                    <th>Periode</th>
                    <th>Evaluation</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {parentGrades.length === 0 ? (
                    <tr><td colSpan={5} className="empty-row">Aucune note.</td></tr>
                  ) : (
                    parentGrades.map((item) => (
                      <tr key={item.id}>
                        <td>{item.studentName || "-"}</td>
                        <td>{item.subjectLabel || "-"}</td>
                        <td>{item.periodLabel || periods.find((period) => period.id === item.academicPeriodId)?.label || "-"}</td>
                        <td>{item.assessmentLabel}</td>
                        <td>{item.score}/{item.scoreMax}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel table-panel workflow-section">
            <div className="table-header">
              <h2>Bulletins</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Eleve</th>
                    <th>Classe</th>
                    <th>Periode</th>
                    <th>Moyenne</th>
                    <th>Rang</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {parentReportCards.length === 0 ? (
                    <tr><td colSpan={6} className="empty-row">Aucun bulletin.</td></tr>
                  ) : (
                    parentReportCards.map((item) => (
                      <tr key={item.id}>
                        <td>{item.studentName || "-"}</td>
                        <td>{item.classLabel || "-"}</td>
                        <td>{item.periodLabel || "-"}</td>
                        <td>{item.averageGeneral.toFixed(2)}</td>
                        <td>{item.classRank || "-"}</td>
                        <td>
                          {item.pdfDataUrl ? (
                            <button
                              type="button"
                              className="button-ghost"
                              onClick={() => window.open(item.pdfDataUrl, "_blank", "noopener,noreferrer")}
                            >
                              Consulter le PDF
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="split-grid">
          <section className="panel table-panel workflow-section">
            <div className="table-header">
              <h2>Absences</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Eleve</th>
                    <th>Classe</th>
                    <th>Statut</th>
                    <th>Validation</th>
                  </tr>
                </thead>
                <tbody>
                  {parentAttendance.length === 0 ? (
                    <tr><td colSpan={5} className="empty-row">Aucune absence.</td></tr>
                  ) : (
                    parentAttendance.map((item) => (
                      <tr key={item.id}>
                        <td>{item.attendanceDate}</td>
                        <td>{item.studentName || "-"}</td>
                        <td>{item.classLabel || "-"}</td>
                        <td>{formatAttendanceStatusLabel(item.status)}</td>
                        <td>{formatValidationStatusLabel(item.justificationStatus)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel table-panel workflow-section">
            <div className="table-header">
              <h2>Comptabilite famille</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Facture</th>
                    <th>Eleve</th>
                    <th>Du</th>
                    <th>Paye</th>
                    <th>Reste</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {parentInvoices.length === 0 ? (
                    <tr><td colSpan={6} className="empty-row">Aucune facture.</td></tr>
                  ) : (
                    parentInvoices.map((item) => (
                      <tr key={item.id}>
                        <td>{item.invoiceNo}</td>
                        <td>{item.studentName || "-"}</td>
                        <td>{formatAmount(item.amountDue)}</td>
                        <td>{formatAmount(item.amountPaid)}</td>
                        <td>{formatAmount(item.remainingAmount)}</td>
                        <td>{formatInvoiceStatusLabel(item.status)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="split-grid">
          <section className="panel table-panel workflow-section">
            <div className="table-header">
              <h2>Paiements</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Eleve</th>
                    <th>Facture</th>
                    <th>Recu</th>
                    <th>Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {parentPayments.length === 0 ? (
                    <tr><td colSpan={5} className="empty-row">Aucun paiement.</td></tr>
                  ) : (
                    parentPayments.map((item) => (
                      <tr key={item.id}>
                        <td>{new Date(item.paidAt).toLocaleString("fr-FR")}</td>
                        <td>{item.studentName || "-"}</td>
                        <td>{item.invoiceNo || "-"}</td>
                        <td>{item.receiptNo}</td>
                        <td>{formatAmount(item.paidAmount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel table-panel workflow-section">
            <div className="table-header">
              <h2>Emploi du temps</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Eleve</th>
                    <th>Jour</th>
                    <th>Matiere</th>
                    <th>Horaire</th>
                    <th>Salle</th>
                  </tr>
                </thead>
                <tbody>
                  {parentTimetable.length === 0 ? (
                    <tr><td colSpan={5} className="empty-row">Aucun creneau.</td></tr>
                  ) : (
                    parentTimetable.map((item) => (
                      <tr key={item.slotId}>
                        <td>{item.studentName}</td>
                        <td>{formatWeekdayLabel(item.dayOfWeek)}</td>
                        <td>{item.subjectLabel}</td>
                        <td>{item.startTime} - {item.endTime}</td>
                        <td>{item.room || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <section className="panel table-panel workflow-section">
          <div className="table-header">
            <h2>Notifications recues</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Titre</th>
                  <th>Message</th>
                  <th>Cible</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {parentNotifications.length === 0 ? (
                  <tr><td colSpan={5} className="empty-row">Aucune notification.</td></tr>
                ) : (
                  parentNotifications.map((item) => (
                    <tr key={item.id}>
                      <td>{new Date(item.createdAt).toLocaleString("fr-FR")}</td>
                      <td>{item.title}</td>
                      <td>{item.message}</td>
                      <td>{item.studentName || formatAudienceRoleLabel(item.audienceRole) || "-"}</td>
                      <td>{formatPortalNotificationStatusLabel(item.status)}</td>
                    </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  };

  const renderForbidden = (): JSX.Element => (
    <section className="panel table-panel">
      <h2>Acces refuse</h2>
      <p className="subtle">Votre profil ({currentRoleLabel}) n'a pas acces a cet ecran.</p>
    </section>
  );

  const renderActiveScreen = (): JSX.Element => {
    if (!currentRole || !hasScreenAccess(currentRole, tab)) {
      return renderForbidden();
    }

    if (tab === "dashboard") return renderDashboard();
    if (tab === "iam") return renderIam();
    if (tab === "students") return renderStudents();
    if (tab === "reference") {
      const referenceSteps: WorkflowStepDef[] = [
        { id: "years", title: "Annees", hint: "Configurer les annees scolaires.", done: schoolYears.length > 0 },
        { id: "cycles", title: "Cycles / niveaux", hint: "Structurer les parcours.", done: cycles.length > 0 && levels.length > 0 },
        { id: "classes", title: "Classes / matieres", hint: "Creer classes et matieres.", done: classes.length > 0 && subjects.length > 0 },
        { id: "periods", title: "Periodes", hint: "Definir les periodes academiques.", done: periods.length > 0 }
      ];

      const scrollToReference = (stepId: string): void => {
        setReferenceWorkflowStep(stepId);
        const targetByStep: Record<string, string> = {
          years: "reference-years",
          cycles: "reference-cycles",
          classes: "reference-classes",
          periods: "reference-periods"
        };
        const target = targetByStep[stepId];
        if (!target) return;
        window.setTimeout(() => {
          document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 0);
      };

      return (
        <WorkflowGuide
          title="Referentiel academique"
          steps={referenceSteps}
          activeStepId={referenceWorkflowStep}
          onStepChange={scrollToReference}
        >
          <section className="panel table-panel module-modern">
            <div className="table-header">
              <h2>Referentiel academique</h2>
            </div>
            <p className="section-lead">Unifiez les parametres metier: annee, structure pedagogique, classes et periodes.</p>
            <div className="reference-grid">
              <article id="reference-years" data-step-id="years" className="panel card-panel module-modern module-stack">
                <h3>Annees scolaires</h3>
                <p className="section-lead">Definissez la fenetre de travail de l'etablissement avant tout autre parametrage.</p>
                <form
                  className="form-grid module-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const errors: FieldErrors = {};
                    if (!syForm.code.trim()) errors.code = "Code annee requis.";
                    if (!syForm.startDate) errors.startDate = "Date de debut requise.";
                    if (!syForm.endDate) errors.endDate = "Date de fin requise.";
                    if (syForm.startDate && syForm.endDate && syForm.endDate < syForm.startDate) {
                      errors.endDate = "La date de fin doit etre apres la date de debut.";
                    }
                    setSchoolYearErrors(errors);
                    if (hasFieldErrors(errors)) {
                      focusFirstInlineErrorField("years");
                      return;
                    }
                    void createRef(
                      "/school-years",
                      {
                        code: syForm.code.trim(),
                        startDate: syForm.startDate,
                        endDate: syForm.endDate,
                        isActive: syForm.isActive
                      },
                      "Annee creee."
                    ).then((ok) => {
                      if (ok) {
                        setSchoolYearErrors({});
                        setSyForm({ code: "", startDate: "", endDate: "", isActive: false });
                      }
                    });
                  }}
                >
                  <label>
                    Code
                    <input value={syForm.code} onChange={(event) => setSyForm((prev) => ({ ...prev, code: event.target.value }))} required />
                    {fieldError(schoolYearErrors, "code")}
                  </label>
                  <label>
                    Debut
                    <input type="date" value={syForm.startDate} onChange={(event) => setSyForm((prev) => ({ ...prev, startDate: event.target.value }))} required />
                    {fieldError(schoolYearErrors, "startDate")}
                  </label>
                  <label>
                    Fin
                    <input type="date" value={syForm.endDate} onChange={(event) => setSyForm((prev) => ({ ...prev, endDate: event.target.value }))} required />
                    {fieldError(schoolYearErrors, "endDate")}
                  </label>
                  <label className="check-row">
                    <input type="checkbox" checked={syForm.isActive} onChange={(event) => setSyForm((prev) => ({ ...prev, isActive: event.target.checked }))} />
                    Annee active
                  </label>
                  <button type="submit">Creer</button>
                </form>
                <div className="mini-list">
                  {schoolYears.map((item) => (
                    <div key={item.id} className="mini-item">
                      <span>{item.code} {item.isActive ? "(En cours)" : ""}</span>
                      <button type="button" className="button-ghost" onClick={() => void deleteRef(`/school-years/${item.id}`, "Annee supprimee.")}>
                        Suppr.
                      </button>
                    </div>
                  ))}
                </div>
              </article>

              <article id="reference-cycles" data-step-id="cycles" className="panel card-panel module-modern module-stack">
                <h3>Cycles / Niveaux</h3>
                <p className="section-lead">Creez d'abord les cycles, puis les niveaux associes pour structurer les parcours.</p>
                <form
                  className="form-grid module-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const errors: FieldErrors = {};
                    if (!cycleForm.code.trim()) errors.code = "Code cycle requis.";
                    if (!cycleForm.label.trim()) errors.label = "Libelle cycle requis.";
                    if (!Number.isFinite(cycleForm.sortOrder) || cycleForm.sortOrder < 0) {
                      errors.sortOrder = "Ordre invalide.";
                    }
                    setCycleErrors(errors);
                    if (hasFieldErrors(errors)) {
                      focusFirstInlineErrorField("cycles");
                      return;
                    }
                    void createRef("/cycles", cycleForm, "Cycle cree.").then((ok) => {
                      if (ok) {
                        setCycleErrors({});
                        setCycleForm({ code: "", label: "", sortOrder: 1 });
                      }
                    });
                  }}
                >
                  <label>
                    Code cycle
                    <input value={cycleForm.code} onChange={(event) => setCycleForm((prev) => ({ ...prev, code: event.target.value }))} required />
                    {fieldError(cycleErrors, "code")}
                  </label>
                  <label>
                    Libelle cycle
                    <input value={cycleForm.label} onChange={(event) => setCycleForm((prev) => ({ ...prev, label: event.target.value }))} required />
                    {fieldError(cycleErrors, "label")}
                  </label>
                  <label>
                    Ordre
                    <input type="number" min={0} value={cycleForm.sortOrder} onChange={(event) => setCycleForm((prev) => ({ ...prev, sortOrder: Number(event.target.value) || 0 }))} required />
                    {fieldError(cycleErrors, "sortOrder")}
                  </label>
                  <button type="submit">Creer cycle</button>
                </form>
                <div className="mini-list">
                  {cycles.map((item) => (
                    <div key={item.id} className="mini-item">
                      <span>{item.code} - {item.label}</span>
                      <button type="button" className="button-ghost" onClick={() => void deleteRef(`/cycles/${item.id}`, "Cycle supprime.")}>
                        Suppr.
                      </button>
                    </div>
                  ))}
                </div>
                <p className="form-block-title">Niveaux par cycle</p>
                <form
                  className="form-grid module-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const errors: FieldErrors = {};
                    if (!levelForm.cycleId) errors.cycleId = "Choisir un cycle.";
                    if (!levelForm.code.trim()) errors.code = "Code niveau requis.";
                    if (!levelForm.label.trim()) errors.label = "Libelle niveau requis.";
                    if (!Number.isFinite(levelForm.sortOrder) || levelForm.sortOrder < 0) {
                      errors.sortOrder = "Ordre invalide.";
                    }
                    setLevelErrors(errors);
                    if (hasFieldErrors(errors)) {
                      focusFirstInlineErrorField("cycles");
                      return;
                    }
                    void createRef("/levels", levelForm, "Niveau cree.").then((ok) => {
                      if (ok) {
                        setLevelErrors({});
                        setLevelForm((prev) => ({ ...prev, code: "", label: "", sortOrder: 1 }));
                      }
                    });
                  }}
                >
                  <label>
                    Cycle
                    <select value={levelForm.cycleId} onChange={(event) => setLevelForm((prev) => ({ ...prev, cycleId: event.target.value }))}>
                      {cycles.map((item) => (
                        <option key={item.id} value={item.id}>{item.code}</option>
                      ))}
                    </select>
                    {fieldError(levelErrors, "cycleId")}
                  </label>
                  <label>
                    Code niveau
                    <input value={levelForm.code} onChange={(event) => setLevelForm((prev) => ({ ...prev, code: event.target.value }))} required />
                    {fieldError(levelErrors, "code")}
                  </label>
                  <label>
                    Libelle niveau
                    <input value={levelForm.label} onChange={(event) => setLevelForm((prev) => ({ ...prev, label: event.target.value }))} required />
                    {fieldError(levelErrors, "label")}
                  </label>
                  <button type="submit">Creer niveau</button>
                </form>
                <label>
                  Filtre cycle
                  <select value={levelCycleFilter} onChange={(event) => setLevelCycleFilter(event.target.value)}>
                    <option value="">Tous</option>
                    {cycles.map((item) => (
                      <option key={item.id} value={item.id}>{item.code}</option>
                    ))}
                  </select>
                </label>
                <div className="mini-list">
                  {shownLevels.map((item) => (
                    <div key={item.id} className="mini-item">
                      <span>{item.code} - {item.label}</span>
                      <button type="button" className="button-ghost" onClick={() => void deleteRef(`/levels/${item.id}`, "Niveau supprime.")}>
                        Suppr.
                      </button>
                    </div>
                  ))}
                </div>
              </article>

              <article id="reference-classes" data-step-id="classes" className="panel card-panel module-modern module-stack">
                <h3>Classes / Matieres / Periodes</h3>
                <p className="section-lead">Parametrez les classes et les matieres depuis un seul espace de configuration.</p>
                <form
                  className="form-grid module-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const errors: FieldErrors = {};
                    if (!classForm.schoolYearId) errors.schoolYearId = "Annee requise.";
                    if (!classForm.levelId) errors.levelId = "Niveau requis.";
                    if (!classForm.code.trim()) errors.code = "Code classe requis.";
                    if (!classForm.label.trim()) errors.label = "Libelle classe requis.";
                    if (classForm.capacity.trim() && (!Number.isFinite(Number(classForm.capacity)) || Number(classForm.capacity) <= 0)) {
                      errors.capacity = "Capacite invalide.";
                    }
                    setClassErrors(errors);
                    if (hasFieldErrors(errors)) {
                      focusFirstInlineErrorField("classes");
                      return;
                    }
                    void createRef(
                      "/classes",
                      {
                        ...classForm,
                        capacity: classForm.capacity.trim() ? Number(classForm.capacity) : undefined
                      },
                      "Classe creee."
                    ).then((ok) => {
                      if (ok) {
                        setClassErrors({});
                        setClassForm((prev) => ({ ...prev, code: "", label: "", capacity: "" }));
                      }
                    });
                  }}
                >
                  <label>
                    Annee
                    <select value={classForm.schoolYearId} onChange={(event) => setClassForm((prev) => ({ ...prev, schoolYearId: event.target.value }))}>
                      {schoolYears.map((item) => (
                        <option key={item.id} value={item.id}>{item.code}</option>
                      ))}
                    </select>
                    {fieldError(classErrors, "schoolYearId")}
                  </label>
                  <label>
                    Niveau
                    <select value={classForm.levelId} onChange={(event) => setClassForm((prev) => ({ ...prev, levelId: event.target.value }))}>
                      {levels.map((item) => (
                        <option key={item.id} value={item.id}>{item.code}</option>
                      ))}
                    </select>
                    {fieldError(classErrors, "levelId")}
                  </label>
                  <label>
                    Code classe
                    <input value={classForm.code} onChange={(event) => setClassForm((prev) => ({ ...prev, code: event.target.value }))} required />
                    {fieldError(classErrors, "code")}
                  </label>
                  <label>
                    Libelle classe
                    <input value={classForm.label} onChange={(event) => setClassForm((prev) => ({ ...prev, label: event.target.value }))} required />
                    {fieldError(classErrors, "label")}
                  </label>
                  <label>
                    Capacite (optionnel)
                    <input
                      type="number"
                      min={1}
                      value={classForm.capacity}
                      onChange={(event) => setClassForm((prev) => ({ ...prev, capacity: event.target.value }))}
                    />
                    {fieldError(classErrors, "capacity")}
                  </label>
                  <button type="submit">Creer classe</button>
                </form>
                <div className="filter-grid module-filter">
                  <label>
                    Filtre annee
                    <select value={classYearFilter} onChange={(event) => setClassYearFilter(event.target.value)}>
                      <option value="">Toutes</option>
                      {schoolYears.map((item) => (
                        <option key={item.id} value={item.id}>{item.code}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Filtre niveau
                    <select value={classLevelFilter} onChange={(event) => setClassLevelFilter(event.target.value)}>
                      <option value="">Tous</option>
                      {levels.map((item) => (
                        <option key={item.id} value={item.id}>{item.code}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mini-list">
                  {shownClasses.map((item) => (
                    <div key={item.id} className="mini-item">
                      <span>{item.code} - {item.label}</span>
                      <button type="button" className="button-ghost" onClick={() => void deleteRef(`/classes/${item.id}`, "Classe supprimee.")}>
                        Suppr.
                      </button>
                    </div>
                  ))}
                </div>
                <p className="form-block-title">Matieres enseignees</p>
                <form
                  className="form-grid module-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const errors: FieldErrors = {};
                    if (!subjectForm.code.trim()) errors.code = "Code matiere requis.";
                    if (!subjectForm.label.trim()) errors.label = "Libelle matiere requis.";
                    setSubjectErrors(errors);
                    if (hasFieldErrors(errors)) {
                      focusFirstInlineErrorField("classes");
                      return;
                    }
                    void createRef("/subjects", subjectForm, "Matiere creee.").then((ok) => {
                      if (ok) {
                        setSubjectErrors({});
                        setSubjectForm({ code: "", label: "", isArabic: false });
                      }
                    });
                  }}
                >
                  <label>
                    Code matiere
                    <input value={subjectForm.code} onChange={(event) => setSubjectForm((prev) => ({ ...prev, code: event.target.value }))} required />
                    {fieldError(subjectErrors, "code")}
                  </label>
                  <label>
                    Libelle matiere
                    <input value={subjectForm.label} onChange={(event) => setSubjectForm((prev) => ({ ...prev, label: event.target.value }))} required />
                    {fieldError(subjectErrors, "label")}
                  </label>
                  <label className="check-row">
                    <input type="checkbox" checked={subjectForm.isArabic} onChange={(event) => setSubjectForm((prev) => ({ ...prev, isArabic: event.target.checked }))} />
                    Matiere arabe
                  </label>
                  <button type="submit">Creer matiere</button>
                </form>
                <div className="mini-list">
                  {subjects.map((item) => (
                    <div key={item.id} className="mini-item">
                      <span>{item.code} - {item.label} {item.isArabic ? "(AR)" : ""}</span>
                      <button type="button" className="button-ghost" onClick={() => void deleteRef(`/subjects/${item.id}`, "Matiere supprimee.")}>
                        Suppr.
                      </button>
                    </div>
                  ))}
                </div>
              </article>

              <article id="reference-periods" data-step-id="periods" className="panel card-panel module-modern module-stack">
                <h3>Periodes academiques</h3>
                <p className="section-lead">Ajoutez les periodes (trimestres/semestres) en cohérence avec l'annee active.</p>
                <form
                  className="form-grid module-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const errors: FieldErrors = {};
                    if (!periodForm.schoolYearId) errors.schoolYearId = "Annee requise.";
                    if (!periodForm.code.trim()) errors.code = "Code periode requis.";
                    if (!periodForm.label.trim()) errors.label = "Libelle periode requis.";
                    if (!periodForm.startDate) errors.startDate = "Date debut requise.";
                    if (!periodForm.endDate) errors.endDate = "Date fin requise.";
                    if (periodForm.startDate && periodForm.endDate && periodForm.endDate < periodForm.startDate) {
                      errors.endDate = "La date de fin doit etre apres la date de debut.";
                    }
                    setPeriodErrors(errors);
                    if (hasFieldErrors(errors)) {
                      focusFirstInlineErrorField("periods");
                      return;
                    }
                    void createRef("/academic-periods", periodForm, "Periode creee.").then((ok) => {
                      if (ok) {
                        setPeriodErrors({});
                        setPeriodForm((prev) => ({ ...prev, code: "", label: "", startDate: "", endDate: "", periodType: "TRIMESTER" }));
                      }
                    });
                  }}
                >
                  <label>
                    Annee
                    <select value={periodForm.schoolYearId} onChange={(event) => setPeriodForm((prev) => ({ ...prev, schoolYearId: event.target.value }))}>
                      {schoolYears.map((item) => (
                        <option key={item.id} value={item.id}>{item.code}</option>
                      ))}
                    </select>
                    {fieldError(periodErrors, "schoolYearId")}
                  </label>
                  <label>
                    Code
                    <input value={periodForm.code} onChange={(event) => setPeriodForm((prev) => ({ ...prev, code: event.target.value }))} required />
                    {fieldError(periodErrors, "code")}
                  </label>
                  <label>
                    Libelle
                    <input value={periodForm.label} onChange={(event) => setPeriodForm((prev) => ({ ...prev, label: event.target.value }))} required />
                    {fieldError(periodErrors, "label")}
                  </label>
                  <label>
                    Debut
                    <input type="date" value={periodForm.startDate} onChange={(event) => setPeriodForm((prev) => ({ ...prev, startDate: event.target.value }))} required />
                    {fieldError(periodErrors, "startDate")}
                  </label>
                  <label>
                    Fin
                    <input type="date" value={periodForm.endDate} onChange={(event) => setPeriodForm((prev) => ({ ...prev, endDate: event.target.value }))} required />
                    {fieldError(periodErrors, "endDate")}
                  </label>
                  <button type="submit">Creer periode</button>
                </form>
                <label>
                  Filtre annee
                  <select value={periodYearFilter} onChange={(event) => setPeriodYearFilter(event.target.value)}>
                    <option value="">Toutes</option>
                    {schoolYears.map((item) => (
                      <option key={item.id} value={item.id}>{item.code}</option>
                    ))}
                  </select>
                </label>
                <div className="mini-list">
                  {shownPeriods.map((item) => (
                    <div key={item.id} className="mini-item">
                      <span>{item.code} - {item.label} ({item.periodType})</span>
                      <button type="button" className="button-ghost" onClick={() => void deleteRef(`/academic-periods/${item.id}`, "Periode supprimee.")}>
                        Suppr.
                      </button>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </section>
        </WorkflowGuide>
      );
    }
    if (tab === "enrollments") {
      const enrollmentSteps: WorkflowStepDef[] = [
        { id: "create", title: "Creation", hint: "Lier eleve, classe et annee." },
        { id: "list", title: "Suivi", hint: "Filtrer et gerer les inscriptions.", done: enrollments.length > 0 }
      ];

      const scrollToEnrollments = (stepId: string): void => {
        setEnrollmentWorkflowStep(stepId);
        const targetByStep: Record<string, string> = {
          create: "enrollments-create",
          list: "enrollments-list"
        };
        const target = targetByStep[stepId];
        if (!target) return;
        window.setTimeout(() => {
          document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 0);
      };

      return (
        <WorkflowGuide
          title="Inscriptions"
          steps={enrollmentSteps}
          activeStepId={enrollmentWorkflowStep}
          onStepChange={scrollToEnrollments}
        >
          <>
            <section id="enrollments-create" data-step-id="create" className="panel editor-panel workflow-section module-modern">
              <h2>Nouvelle inscription</h2>
              <p className="section-lead">Liez l'eleve a sa classe et son annee scolaire en une seule operation.</p>
              <form className="form-grid module-form" onSubmit={(event) => void submitEnrollment(event)}>
                <label>
                  Annee scolaire
                  <select
                    value={enrollmentForm.schoolYearId}
                    onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, schoolYearId: event.target.value }))}
                    required
                  >
                    {schoolYears.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code}
                      </option>
                    ))}
                  </select>
                  {fieldError(enrollmentErrors, "schoolYearId")}
                </label>
                <label>
                  Classe
                  <select
                    value={enrollmentForm.classId}
                    onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, classId: event.target.value }))}
                    required
                  >
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} - {item.label}
                      </option>
                    ))}
                  </select>
                  {fieldError(enrollmentErrors, "classId")}
                </label>
                <label>
                  Eleve
                  <select
                    value={enrollmentForm.studentId}
                    onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, studentId: event.target.value }))}
                    required
                  >
                    {students.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.matricule} - {item.firstName} {item.lastName}
                      </option>
                    ))}
                  </select>
                  {fieldError(enrollmentErrors, "studentId")}
                </label>
                <label>
                  Date d'inscription
                  <input
                    type="date"
                    value={enrollmentForm.enrollmentDate}
                    onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, enrollmentDate: event.target.value }))}
                    required
                  />
                  {fieldError(enrollmentErrors, "enrollmentDate")}
                </label>
                <label>
                  Statut
                  <input
                    value={enrollmentForm.enrollmentStatus}
                    onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, enrollmentStatus: event.target.value }))}
                  />
                  {fieldError(enrollmentErrors, "enrollmentStatus")}
                </label>
                <button type="submit">Creer inscription</button>
              </form>
            </section>

            <section id="enrollments-list" data-step-id="list" className="panel table-panel workflow-section module-modern">
              <div className="table-header">
                <h2>Liste des inscriptions</h2>
              </div>
              <p className="section-lead">Filtrez rapidement pour trouver la bonne inscription et agir sans bruit.</p>
              <form
                className="filter-grid module-filter"
                onSubmit={(event) => {
                  event.preventDefault();
                  void loadEnrollments(enrollmentFilters);
                }}
              >
                <label>
                  Filtre annee
                  <select
                    value={enrollmentFilters.schoolYearId}
                    onChange={(event) =>
                      setEnrollmentFilters((prev) => ({ ...prev, schoolYearId: event.target.value }))
                    }
                  >
                    <option value="">Toutes</option>
                    {schoolYears.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Filtre classe
                  <select
                    value={enrollmentFilters.classId}
                    onChange={(event) =>
                      setEnrollmentFilters((prev) => ({ ...prev, classId: event.target.value }))
                    }
                  >
                    <option value="">Toutes</option>
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Filtre eleve
                  <select
                    value={enrollmentFilters.studentId}
                    onChange={(event) =>
                      setEnrollmentFilters((prev) => ({ ...prev, studentId: event.target.value }))
                    }
                  >
                    <option value="">Tous</option>
                    {students.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.matricule}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="actions">
                  <button type="submit">Filtrer</button>
                  <button type="button" className="button-ghost" onClick={() => void resetEnrollmentFilters()}>
                    Reinitialiser
                  </button>
                </div>
              </form>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Annee</th>
                      <th>Classe</th>
                      <th>Eleve</th>
                      <th>Date</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="empty-row">
                          Aucune inscription.
                        </td>
                      </tr>
                    ) : (
                      enrollments.map((item) => {
                        const localClass = classById.get(item.classId);
                        const localStudent = studentById.get(item.studentId);
                        const fallbackStudent = localStudent
                          ? `${localStudent.firstName} ${localStudent.lastName}`.trim()
                          : "-";
                        return (
                          <tr key={item.id}>
                            <td>{item.schoolYearCode || schoolYearById.get(item.schoolYearId)?.code || "-"}</td>
                            <td>{item.classLabel || localClass?.label || "-"}</td>
                            <td>{item.studentName || fallbackStudent}</td>
                            <td>{item.enrollmentDate}</td>
                            <td>{formatEnrollmentStatusLabel(item.enrollmentStatus)}</td>
                            <td>
                              <button
                                type="button"
                                className="button-danger"
                                onClick={() => void deleteEnrollment(item.id)}
                              >
                                Supprimer
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        </WorkflowGuide>
      );
    }
    if (tab === "finance") return renderFinance();
    if (tab === "reports") return renderReports();
    if (tab === "mosque") return renderMosque();
    if (tab === "grades") return renderGrades();
    if (tab === "schoolLifeOverview") {
      return (
        <SchoolLifePanel
          api={api}
          students={students}
          classes={classes}
          subjects={subjects}
          onError={setError}
          onNotice={setNotice}
          focusSection="overview"
        />
      );
    }
    if (tab === "schoolLifeAttendance") {
      return (
        <SchoolLifePanel
          api={api}
          students={students}
          classes={classes}
          subjects={subjects}
          onError={setError}
          onNotice={setNotice}
          focusSection="attendance"
          readOnly={!currentRole || currentRole === "PARENT"}
        />
      );
    }
    if (tab === "schoolLifeTimetable") {
      return (
        <SchoolLifePanel
          api={api}
          students={students}
          classes={classes}
          subjects={subjects}
          onError={setError}
          onNotice={setNotice}
          focusSection="timetable"
          readOnly={currentRole === "PARENT"}
        />
      );
    }
    if (tab === "schoolLifeNotifications") {
      return (
        <SchoolLifePanel
          api={api}
          students={students}
          classes={classes}
          subjects={subjects}
          onError={setError}
          onNotice={setNotice}
          focusSection="notifications"
          readOnly={currentRole === "PARENT"}
        />
      );
    }
    if (tab === "teacherPortal") return renderTeacherPortal();
    if (tab === "parentPortal") return renderParentPortal();

    return renderDashboard();
  };

  const activeScreen = SCREEN_DEFS.find((entry) => entry.id === tab) ?? SCREEN_DEFS[0];
  const profileInitial = session?.user.username?.charAt(0)?.toUpperCase() || "U";
  const profileContextLabel = currentRole ? ROLE_CONTEXT_LABELS[currentRole] : "Session";
  const quickLinks = homeTiles.filter((tile) => tile.screen !== tab).slice(0, 4);
  const visibleScreens = currentRole
    ? SCREEN_DEFS.filter((entry) => entry.roles.includes(currentRole))
    : [];
  const navPrincipal = visibleScreens.filter((entry) => entry.group === "principal");
  const navVieScolaire = visibleScreens.filter((entry) => entry.group === "vie");
  const navPortail = visibleScreens.filter((entry) => entry.group === "portail");
  const lastSyncLabel = lastSyncAt
    ? new Date(lastSyncAt).toLocaleString("fr-FR")
    : "Non synchronise";

  return (
    <main className={`page ${!session ? "page-auth" : ""}`.trim()} data-theme={themeMode}>
      <div className="aurora aurora-left" />
      <div className="aurora aurora-right" />

      {!session ? (
        <section className="auth-layout fade-up">
          <article className="panel auth-visual">
            <div className="auth-visual-surface">
              <span className="auth-float auth-float-1">{"\u{1F393}"}</span>
              <span className="auth-float auth-float-2">{"\u{1F4DA}"}</span>
              <span className="auth-float auth-float-3">{"\u{1F9E0}"}</span>
              <span className="auth-float auth-float-4">{"\u{1F4DD}"}</span>
              <h2>Bienvenue a {SCHOOL_NAME}</h2>
              <img
                className="auth-illustration-photo"
                src="/loginPage.png"
                alt={`Apercu reel de l'interface ${PLATFORM_NAME}`}
                loading="lazy"
              />
            </div>
          </article>

          <section className="panel auth-panel auth-card">
            <div className="auth-card-head">
              <h2>Connexion</h2>
              <button type="button" className="auth-theme-toggle" onClick={toggleThemeMode}>
                {themeMode === "light" ? "Mode sombre" : "Mode clair"}
              </button>
            </div>
            <form className="form-grid auth-form-grid" onSubmit={(event) => void login(event)}>
              <label className="auth-field">
                <span className="visually-hidden">Email ou identifiant</span>
                <input
                  value={loginForm.username}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, username: event.target.value }))}
                  placeholder="Email ou Identifiant"
                  required
                />
                {fieldError(loginErrors, "username")}
              </label>
              <label className="auth-field">
                <span className="visually-hidden">Mot de passe</span>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder="Mot de Passe"
                  required
                  minLength={8}
                />
                {fieldError(loginErrors, "password")}
              </label>

              <div className="auth-inline-row">
                <label className="auth-check">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => {
                      const next = event.target.checked;
                      setRememberMe(next);
                      if (!next) localStorage.removeItem(LOGIN_HINT_STORAGE_KEY);
                    }}
                  />
                  <span>Se souvenir de moi</span>
                </label>
                <button type="button" className="auth-link-button" onClick={toggleForgotPasswordPanel}>
                  Mot de passe oublie?
                </button>
              </div>

              <button type="submit" className="auth-submit" disabled={loadingAuth}>
                {loadingAuth ? "Connexion..." : "Se Connecter"}
              </button>
              <button
                type="button"
                className="auth-bottom-link"
                aria-expanded={authAssistMode === "first"}
                onClick={toggleFirstConnectionPanel}
              >
                Premiere connexion ? {authAssistMode === "first" ? "Masquer" : "Activer"}
              </button>
            </form>
            {authAssistMode === "forgot" ? (
              <article className="auth-assist-panel">
                <h3>Reinitialisation du mot de passe</h3>
                <form className="auth-assist-grid" onSubmit={(event) => void requestForgotPasswordToken(event)}>
                  <label>
                    Identifiant
                    <input
                      value={forgotPasswordForm.username}
                      onChange={(event) =>
                        setForgotPasswordForm((prev) => ({ ...prev, username: event.target.value }))
                      }
                      required
                    />
                  </label>
                  <button type="submit" disabled={authAssistLoading}>
                    {authAssistLoading ? "Envoi..." : "Envoyer les instructions"}
                  </button>
                </form>
                <form className="auth-assist-grid" onSubmit={(event) => void submitResetPassword(event)}>
                  <label>
                    Code de reinitialisation
                    <input
                      value={resetPasswordForm.token}
                      onChange={(event) =>
                        setResetPasswordForm((prev) => ({ ...prev, token: event.target.value }))
                      }
                      required
                    />
                  </label>
                  <label>
                    Nouveau mot de passe
                    <input
                      type="password"
                      value={resetPasswordForm.newPassword}
                      onChange={(event) =>
                        setResetPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
                      }
                      minLength={12}
                      required
                    />
                  </label>
                  <label>
                    Confirmation
                    <input
                      type="password"
                      value={resetPasswordForm.confirmPassword}
                      onChange={(event) =>
                        setResetPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                      }
                      minLength={12}
                      required
                    />
                  </label>
                  <button type="submit" disabled={authAssistLoading}>
                    {authAssistLoading ? "Validation..." : "Valider la reinitialisation"}
                  </button>
                </form>
                <p className="auth-assist-note">
                  Le jeton de reinitialisation n'est plus affiche dans l'application. Utiliser un
                  jeton transmis par un canal securise.
                </p>
              </article>
            ) : null}
            {authAssistMode === "first" ? (
              <article className="auth-first-steps">
                <h3>Activation premiere connexion</h3>
                <form className="auth-assist-grid" onSubmit={(event) => void submitFirstConnection(event)}>
                  <label>
                    Identifiant
                    <input
                      value={firstConnectionForm.username}
                      onChange={(event) =>
                        setFirstConnectionForm((prev) => ({ ...prev, username: event.target.value }))
                      }
                      required
                    />
                  </label>
                  <label>
                    Mot de passe temporaire
                    <input
                      type="password"
                      value={firstConnectionForm.temporaryPassword}
                      onChange={(event) =>
                        setFirstConnectionForm((prev) => ({
                          ...prev,
                          temporaryPassword: event.target.value
                        }))
                      }
                      minLength={8}
                      required
                    />
                  </label>
                  <label>
                    Nouveau mot de passe
                    <input
                      type="password"
                      value={firstConnectionForm.newPassword}
                      onChange={(event) =>
                        setFirstConnectionForm((prev) => ({ ...prev, newPassword: event.target.value }))
                      }
                      minLength={12}
                      required
                    />
                  </label>
                  <label>
                    Confirmation
                    <input
                      type="password"
                      value={firstConnectionForm.confirmPassword}
                      onChange={(event) =>
                        setFirstConnectionForm((prev) => ({
                          ...prev,
                          confirmPassword: event.target.value
                        }))
                      }
                      minLength={12}
                      required
                    />
                  </label>
                  <button type="submit" disabled={authAssistLoading}>
                    {authAssistLoading ? "Activation..." : "Activer le compte"}
                  </button>
                </form>
              </article>
            ) : null}
          </section>
        </section>
      ) : (
        <section className="workspace fade-up">
          <header className="panel app-header app-header-v2 app-shell-header">
            <div className="brand-block">
              <span className="brand-logo">
                <img src="/logo.png" alt={`Logo ${SCHOOL_NAME}`} className="brand-logo-image" />
              </span>
              <div className="brand-copy">
                <p className="brand-name">{SCHOOL_NAME}</p>
                <h1>{activeScreen.label}</h1>
              </div>
            </div>

            <div className="top-search">
              <input
                id="module-search"
                value={moduleQueryInput}
                onChange={(event) => setModuleQueryInput(event.target.value)}
                placeholder="Recherche rapide..."
              />
            </div>

            <div className="header-right">
              <div className="header-shortcuts">
                <button type="button" className="header-shortcut theme-toggle" onClick={toggleThemeMode}>
                  {themeMode === "light" ? "Mode sombre" : "Mode clair"}
                </button>
                <button type="button" className="header-shortcut" onClick={() => void refresh()}>
                  Actualiser
                </button>
                <button type="button" className="header-shortcut" onClick={() => void syncHeaderData()}>
                  Synchroniser
                </button>
                <span className="sync-pill">
                  <span className="sync-dot" />
                  Maj: {lastSyncLabel}
                </span>
              </div>
              <div className="profile-pill">
                <span className="avatar-badge">{profileInitial}</span>
                <div className="profile-meta">
                  <strong>{session.user.username}</strong>
                  <small>
                    {profileContextLabel} | Annee: {schoolYearLabel}
                  </small>
                </div>
                <button type="button" className="button-danger" onClick={() => void logout()}>
                  Se deconnecter
                </button>
              </div>
            </div>
          </header>

          <div className="app-shell">
            <aside className="panel app-sidebar">
              <div className="sidebar-head">
                <p className="eyebrow">Navigation</p>
                <strong>Modules</strong>
              </div>

              <div className="sidebar-group">
                <p className="sidebar-title">Principal</p>
                {navPrincipal.map((screen) => (
                  <button
                    key={screen.id}
                    type="button"
                    className={`sidebar-link ${tab === screen.id ? "is-active" : ""}`}
                    onClick={() => setTab(screen.id)}
                  >
                    {screen.label}
                  </button>
                ))}
              </div>

              {navVieScolaire.length > 0 ? (
                <div className="sidebar-group">
                  <p className="sidebar-title">Vie scolaire</p>
                  {navVieScolaire.map((screen) => (
                    <button
                      key={screen.id}
                      type="button"
                      className={`sidebar-link ${tab === screen.id ? "is-active" : ""}`}
                      onClick={() => setTab(screen.id)}
                    >
                      {screen.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {navPortail.length > 0 ? (
                <div className="sidebar-group">
                  <p className="sidebar-title">Portails</p>
                  {navPortail.map((screen) => (
                    <button
                      key={screen.id}
                      type="button"
                      className={`sidebar-link ${tab === screen.id ? "is-active" : ""}`}
                      onClick={() => setTab(screen.id)}
                    >
                      {screen.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </aside>

            <div className="app-shell-main">
              {tab !== "dashboard" ? (
                <section className="panel context-bar">
                  <div>
                    <p className="eyebrow">Module actif</p>
                    <h2>{activeScreen.label}</h2>
                  </div>
                  <div className="context-actions">
                    <button type="button" className="button-ghost" onClick={() => setTab("dashboard")}>
                      Retour accueil
                    </button>
                    {quickLinks.slice(0, 2).map((tile) => (
                      <button
                        key={`shortcut-${tile.screen}`}
                        type="button"
                        className="mini-link"
                        onClick={() => setTab(tile.screen)}
                      >
                        {tile.title}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="screen-host">{renderActiveScreen()}</section>

              <footer className="panel app-footer app-footer-minimal">
                <div className="footer-head">
                  <strong>{SCHOOL_NAME}</strong>
                  <div className="footer-meta">
                    <span>Annee: {schoolYearLabel}</span>
                    <span>Derniere sync: {lastSyncLabel}</span>
                  </div>
                </div>
              </footer>
            </div>
          </div>
        </section>
      )}

      {error || notice ? (
        <div className="toast-stack" aria-live="polite" aria-atomic="true">
          {error ? (
            <div className="toast-pop toast-pop-error" role="alert">
              <div>
                <strong>Attention</strong>
                <p>{error}</p>
              </div>
              <button type="button" aria-label="Fermer la notification d'erreur" onClick={() => setError(null)}>
                Fermer
              </button>
            </div>
          ) : null}
          {notice ? (
            <div className="toast-pop toast-pop-success" role="status">
              <div>
                <strong>Information</strong>
                <p>{notice}</p>
              </div>
              <button type="button" aria-label="Fermer la notification" onClick={() => setNotice(null)}>
                Fermer
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}

