export type Session = {
  accessToken: string;
  refreshToken: string;
  user: { username: string; role: string; tenantId: string };
  tenantId: string;
};

export type Student = {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  sex: "M" | "F";
  birthDate?: string;
};

export type AcademicTrack = "FRANCOPHONE" | "ARABOPHONE";
export type RotationGroup = "GROUP_A" | "GROUP_B";
export type AcademicPlacementStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "COMPLETED";
export type AcademicStage = "PRIMARY" | "SECONDARY" | "HIGHER";
export type ReportCardMode = "TRACK_SINGLE" | "PRIMARY_COMBINED";

export type SchoolYear = { id: string; code: string; isActive: boolean };
export type Cycle = { id: string; code: string; label: string; academicStage: AcademicStage };
export type Level = {
  id: string;
  cycleId: string;
  code: string;
  label: string;
  track: AcademicTrack;
  rotationGroup?: RotationGroup;
};
export type ClassItem = {
  id: string;
  schoolYearId: string;
  levelId: string;
  code: string;
  label: string;
  track: AcademicTrack;
  rotationGroup?: RotationGroup;
};
export type Subject = { id: string; code: string; label: string; isArabic: boolean };
export type Period = {
  id: string;
  schoolYearId: string;
  code: string;
  label: string;
  periodType: string;
};

export type Enrollment = {
  id: string;
  schoolYearId: string;
  classId: string;
  studentId: string;
  track: AcademicTrack;
  placementId?: string;
  isPrimary?: boolean;
  enrollmentDate: string;
  enrollmentStatus: string;
  studentName?: string;
  classLabel?: string;
  schoolYearCode?: string;
  primaryClassLabel?: string;
  secondaryClassLabel?: string;
  primaryTrack?: AcademicTrack;
  secondaryTrack?: AcademicTrack;
};

export type FeePlan = {
  id: string;
  schoolYearId: string;
  levelId: string;
  label: string;
  totalAmount: number;
  currency: string;
};

export type Invoice = {
  id: string;
  studentId: string;
  schoolYearId: string;
  feePlanId?: string;
  billingPlacementId?: string;
  secondaryPlacementId?: string;
  invoiceNo: string;
  amountDue: number;
  amountPaid: number;
  remainingAmount: number;
  status: string;
  dueDate?: string;
  studentName?: string;
  schoolYearCode?: string;
  feePlanLabel?: string;
  primaryTrack?: AcademicTrack;
  primaryClassId?: string;
  primaryClassLabel?: string;
  primaryLevelId?: string;
  primaryLevelLabel?: string;
  secondaryTrack?: AcademicTrack;
  secondaryClassId?: string;
  secondaryClassLabel?: string;
  secondaryLevelId?: string;
  secondaryLevelLabel?: string;
};

export type PaymentRecord = {
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

export type RecoveryDashboard = {
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

export type GradeEntry = {
  id: string;
  studentId: string;
  studentName?: string;
  classId: string;
  placementId?: string;
  track: AcademicTrack;
  subjectId: string;
  subjectLabel?: string;
  academicPeriodId: string;
  assessmentLabel: string;
  assessmentType: string;
  score: number;
  scoreMax: number;
  absent: boolean;
};

export type ClassSummaryStudent = {
  studentId: string;
  placementId?: string;
  track: AcademicTrack;
  matricule: string;
  studentName: string;
  averageGeneral: number;
  classRank: number;
  noteCount: number;
  appreciation: string;
};

export type ClassSummary = {
  classId: string;
  academicPeriodId: string;
  track: AcademicTrack;
  classAverage: number;
  students: ClassSummaryStudent[];
};

export type ReportCard = {
  id: string;
  studentId: string;
  classId: string;
  placementId?: string;
  secondaryPlacementId?: string;
  track: AcademicTrack;
  mode: ReportCardMode;
  academicPeriodId: string;
  averageGeneral: number;
  classRank?: number;
  appreciation?: string;
  pdfDataUrl?: string;
  studentName?: string;
  classLabel?: string;
  periodLabel?: string;
  secondaryClassLabel?: string;
  sections?: Array<{
    placementId?: string;
    track: AcademicTrack;
    classId: string;
    classLabel?: string;
    levelCode?: string;
    levelLabel?: string;
    academicStage: AcademicStage;
    averageGeneral: number;
    classRank?: number;
    appreciation: string;
    subjectAverages: Array<{
      subjectId: string;
      subjectLabel: string;
      average: number;
    }>;
  }>;
};

export type WorkflowStepDef = {
  id: string;
  title: string;
  hint: string;
  done?: boolean;
};

export type FieldErrors = Record<string, string>;
export type ThemeMode = "light" | "dark";
export type RememberedLogin = {
  username: string;
  tenantId?: string;
  remember: boolean;
};
export type ForgotPasswordResponse = {
  message: string;
};
export type AuthMessageResponse = {
  message: string;
};

export type Role = "ADMIN" | "SCOLARITE" | "ENSEIGNANT" | "COMPTABLE" | "PARENT";

export type UserAccount = {
  id: string;
  tenantId: string;
  username: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PermissionResource =
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

export type PermissionAction = "read" | "create" | "update" | "delete" | "validate" | "dispatch";

export type RolePermissionView = {
  role: Role;
  resource: PermissionResource;
  action: PermissionAction;
  allowed: boolean;
  source: "DEFAULT" | "CUSTOM";
};

export type TeacherAssignment = {
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

export type ParentLink = {
  id: string;
  parentUserId: string;
  studentId: string;
  relationship?: string;
  isPrimary: boolean;
  parentUsername: string;
  studentMatricule: string;
  studentName: string;
};

export type TeacherOverview = {
  classesCount: number;
  studentsCount: number;
  gradesCount: number;
  pendingJustifications: number;
  timetableSlotsCount: number;
  notificationsCount: number;
};

export type TeacherClass = {
  assignmentId: string;
  classId: string;
  classLabel: string;
  schoolYearId: string;
  schoolYearCode: string;
  track?: AcademicTrack;
  subjectId?: string;
  subjectLabel?: string;
};

export type TeacherStudent = {
  enrollmentId: string;
  placementId?: string;
  studentId: string;
  matricule: string;
  studentName: string;
  classId: string;
  classLabel: string;
  schoolYearId: string;
  schoolYearCode: string;
  track?: AcademicTrack;
  placementStatus?: AcademicPlacementStatus;
  isPrimary?: boolean;
};

export type PortalNotification = {
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

export type ParentOverview = {
  childrenCount: number;
  openInvoicesCount: number;
  remainingAmount: number;
  absencesCount: number;
  reportCardsCount: number;
  notificationsCount: number;
};

export type TrackPlacementSummary = {
  placementId: string;
  enrollmentId?: string;
  track: AcademicTrack;
  placementStatus: AcademicPlacementStatus;
  isPrimary: boolean;
  levelId: string;
  levelCode: string;
  levelLabel: string;
  academicStage?: AcademicStage;
  classId?: string;
  classLabel?: string;
  schoolYearId: string;
  schoolYearCode?: string;
};

export type ParentChild = {
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
  primaryTrack?: AcademicTrack;
  primaryPlacement?: TrackPlacementSummary;
  secondaryPlacement?: TrackPlacementSummary;
  secondaryClassId?: string;
  secondaryClassLabel?: string;
  placements?: TrackPlacementSummary[];
};

export type MosqueMember = {
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

export type MosqueActivity = {
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

export type MosqueDonation = {
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

export type MosqueDashboard = {
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

export type MosqueExportResponse = {
  format: "PDF" | "EXCEL";
  fileName: string;
  mimeType: string;
  dataUrl: string;
  dataBase64: string;
  generatedAt: string;
  rowCount: number;
};

export type MosqueDonationReceipt = {
  receiptNo: string;
  pdfDataUrl: string;
};

export type AnalyticsTrendPoint = {
  bucket: string;
  label: string;
  value: number;
};

export type AnalyticsOverview = {
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

export type AuditLogItem = {
  id: string;
  createdAt: string;
  action: string;
  resource: string;
  resourceId?: string;
  userId?: string;
  username?: string;
  payloadPreview?: string;
};

export type AuditLogPage = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: AuditLogItem[];
};

export type AuditLogExportResponse = {
  format: "PDF" | "EXCEL";
  fileName: string;
  mimeType: string;
  dataUrl: string;
  dataBase64: string;
  generatedAt: string;
  rowCount: number;
};

export type ScreenId =
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

export type ScreenDef = {
  id: ScreenId;
  label: string;
  group: "principal" | "vie" | "portail";
  roles: Role[];
};

export type ModuleTone = "blue" | "orange" | "violet" | "green" | "teal" | "pink" | "indigo" | "slate";

export type ModuleIconName =
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

export type ModuleTile = {
  screen: ScreenId;
  title: string;
  subtitle: string;
  icon: ModuleIconName;
  tone: ModuleTone;
  tags: string[];
};

export type HeroSlide = {
  quote: string;
  author: string;
  label: string;
};
