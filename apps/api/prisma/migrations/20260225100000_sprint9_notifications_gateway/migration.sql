ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS target_address VARCHAR(190),
  ADD COLUMN IF NOT EXISTS provider VARCHAR(40),
  ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR(160),
  ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(30) NOT NULL DEFAULT 'QUEUED',
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

UPDATE notifications
SET delivery_status = CASE
  WHEN status = 'SENT' THEN 'DELIVERED'
  WHEN status = 'FAILED' THEN 'FAILED'
  ELSE 'QUEUED'
END
WHERE delivery_status IS NULL OR delivery_status = '';

CREATE INDEX IF NOT EXISTS idx_notif_tenant_status_next_attempt
  ON notifications(tenant_id, status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_notif_tenant_provider_message
  ON notifications(tenant_id, provider_message_id);
