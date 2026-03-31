import { Prisma } from "@prisma/client";

export const SCHOOL_LIFE_ATTENDANCE_ALERT_REQUESTED =
  "school-life.attendance-alert.requested";
export const FINANCE_PAYMENT_RECORDED = "finance.payment-recorded";
export const AUDIT_LOG_REQUESTED = "iam.audit-log.requested";

export type AttendanceAlertRequestedPayload = {
  attendanceId: string;
};

export type FinancePaymentRecordedPayload = {
  paymentId: string;
  invoiceId: string;
  invoiceNo: string;
  paidAmount: number;
  paidAt: string;
  paymentMethod: string;
  receiptNo: string;
  studentId?: string;
  studentName?: string;
};

export type AuditLogRequestedPayload = {
  action: string;
  payload?: Prisma.InputJsonValue | null;
  resource: string;
  resourceId?: string | null;
  tenantId: string;
  userId?: string | null;
};

export type OutboxPublishInput = {
  tenantId?: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  dedupeKey?: string;
};
