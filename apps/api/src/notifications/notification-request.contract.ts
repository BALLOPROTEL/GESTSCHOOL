import { Prisma } from "@prisma/client";

export const NOTIFICATION_REQUESTED = "notification.requested";
export const NOTIFICATION_REQUESTED_VERSION = "v1";

export type NotificationRequestKind =
  | "ATTENDANCE_ALERT"
  | "MANUAL"
  | "PAYMENT_RECEIVED";

export type NotificationRequestedEventPayload = {
  schemaVersion: typeof NOTIFICATION_REQUESTED_VERSION;
  requestId: string;
  requestedAt: string;
  kind: NotificationRequestKind;
  channel: "EMAIL" | "IN_APP" | "SMS";
  recipient: {
    audienceRole?: string;
    studentId?: string;
    targetAddress?: string;
  };
  content: {
    templateKey: string;
    title: string;
    message: string;
    variables?: Prisma.InputJsonValue | null;
  };
  schedule?: {
    scheduledAt?: string | null;
  };
  source: {
    action: string;
    domain: string;
    referenceId: string;
    referenceType: string;
  };
};

export type NotificationRequestedEventMetadata = {
  schemaVersion: typeof NOTIFICATION_REQUESTED_VERSION;
  eventId: string;
  tenantId: string;
  occurredAt: string;
  correlationId: string;
  idempotencyKey: string;
  producer: string;
  causationId?: string;
};

export type NotificationRequestedEvent = {
  payload: NotificationRequestedEventPayload;
  metadata: NotificationRequestedEventMetadata;
};

export type PublishNotificationRequestInput = {
  tenantId: string;
  kind: NotificationRequestKind;
  channel: "EMAIL" | "IN_APP" | "SMS";
  recipient: {
    audienceRole?: string;
    studentId?: string;
    targetAddress?: string;
  };
  content: {
    templateKey: string;
    title: string;
    message: string;
    variables?: Prisma.InputJsonValue;
  };
  schedule?: {
    scheduledAt?: string | null;
  };
  source: {
    action: string;
    domain: string;
    referenceId: string;
    referenceType: string;
  };
  producer?: string;
  correlationId?: string;
  causationId?: string;
  requestId?: string;
  idempotencyKey?: string;
};
