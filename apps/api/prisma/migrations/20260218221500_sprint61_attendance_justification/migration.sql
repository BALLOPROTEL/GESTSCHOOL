CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS justification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS validation_comment VARCHAR(400),
  ADD COLUMN IF NOT EXISTS validated_by_user_id UUID,
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_att_justification_status'
  ) THEN
    ALTER TABLE attendance
      ADD CONSTRAINT chk_att_justification_status
      CHECK (justification_status IN ('PENDING', 'APPROVED', 'REJECTED'));
  END IF;
END $$;

UPDATE attendance
SET
  justification_status = CASE
    WHEN UPPER(status) IN ('ABSENT', 'LATE') THEN 'PENDING'
    ELSE 'APPROVED'
  END,
  validation_comment = CASE
    WHEN UPPER(status) IN ('ABSENT', 'LATE') THEN validation_comment
    ELSE NULL
  END,
  validated_by_user_id = CASE
    WHEN UPPER(status) IN ('ABSENT', 'LATE') THEN validated_by_user_id
    ELSE NULL
  END,
  validated_at = CASE
    WHEN UPPER(status) IN ('ABSENT', 'LATE') THEN validated_at
    ELSE NULL
  END
WHERE justification_status IS DISTINCT FROM CASE
  WHEN UPPER(status) IN ('ABSENT', 'LATE') THEN 'PENDING'
  ELSE 'APPROVED'
END;

CREATE TABLE IF NOT EXISTS attendance_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  attendance_id UUID NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
  file_name VARCHAR(180) NOT NULL,
  file_url TEXT NOT NULL,
  mime_type VARCHAR(120),
  uploaded_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_atta_tenant_attendance
  ON attendance_attachments(tenant_id, attendance_id);

CREATE INDEX IF NOT EXISTS idx_atta_tenant_created_at
  ON attendance_attachments(tenant_id, created_at);