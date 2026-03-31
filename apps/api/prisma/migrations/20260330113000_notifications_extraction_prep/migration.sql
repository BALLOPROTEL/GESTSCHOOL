-- Prepare the Notifications bounded context for future extraction.
-- 1. Canonical request metadata lives on notifications rows.
-- 2. Delivery attempts are stored separately for replay and observability.
-- 3. Provider callbacks are persisted idempotently for future webhook handoff.

ALTER TABLE "notifications"
ADD COLUMN "request_id" VARCHAR(80),
ADD COLUMN "correlation_id" VARCHAR(120),
ADD COLUMN "idempotency_key" VARCHAR(200),
ADD COLUMN "schema_version" VARCHAR(20),
ADD COLUMN "source_domain" VARCHAR(60),
ADD COLUMN "source_action" VARCHAR(80),
ADD COLUMN "source_reference_type" VARCHAR(80),
ADD COLUMN "source_reference_id" VARCHAR(120),
ADD COLUMN "template_key" VARCHAR(80),
ADD COLUMN "request_payload" JSONB;

CREATE UNIQUE INDEX "uq_notifications_tenant_request" ON "notifications"("tenant_id", "request_id");
CREATE UNIQUE INDEX "uq_notifications_tenant_idempotency" ON "notifications"("tenant_id", "idempotency_key");

CREATE TABLE "notification_delivery_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "attempt_no" INTEGER NOT NULL,
    "channel" VARCHAR(20) NOT NULL,
    "provider" VARCHAR(40),
    "provider_message_id" VARCHAR(160),
    "target_address" VARCHAR(190),
    "status" VARCHAR(30) NOT NULL,
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_delivery_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_notification_delivery_attempt_no" ON "notification_delivery_attempts"("notification_id", "attempt_no");
CREATE INDEX "idx_notif_attempts_tenant_notification" ON "notification_delivery_attempts"("tenant_id", "notification_id");
CREATE INDEX "idx_notif_attempts_tenant_status_created" ON "notification_delivery_attempts"("tenant_id", "status", "created_at");

CREATE TABLE "notification_provider_callbacks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "notification_id" UUID,
    "provider" VARCHAR(40) NOT NULL,
    "provider_message_id" VARCHAR(160) NOT NULL,
    "event_status" VARCHAR(30) NOT NULL,
    "dedupe_key" VARCHAR(240) NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "error_message" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_provider_callbacks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_provider_callbacks_dedupe_key_key" ON "notification_provider_callbacks"("dedupe_key");
CREATE INDEX "idx_notif_callbacks_tenant_provider_message" ON "notification_provider_callbacks"("tenant_id", "provider", "provider_message_id");
CREATE INDEX "idx_notif_callbacks_tenant_occurred" ON "notification_provider_callbacks"("tenant_id", "occurred_at");

ALTER TABLE "notification_delivery_attempts"
ADD CONSTRAINT "notification_delivery_attempts_notification_id_fkey"
FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_provider_callbacks"
ADD CONSTRAINT "notification_provider_callbacks_notification_id_fkey"
FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
