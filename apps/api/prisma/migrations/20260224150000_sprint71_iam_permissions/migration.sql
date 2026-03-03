CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  role VARCHAR(30) NOT NULL,
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(30) NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_role_permissions_tenant_role_resource_action'
  ) THEN
    ALTER TABLE role_permissions
      ADD CONSTRAINT uq_role_permissions_tenant_role_resource_action
      UNIQUE (tenant_id, role, resource, action);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_role_permissions_tenant_role
  ON role_permissions(tenant_id, role);

CREATE TABLE IF NOT EXISTS iam_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  resource VARCHAR(60) NOT NULL,
  resource_id TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iam_audit_logs_tenant_created
  ON iam_audit_logs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_iam_audit_logs_tenant_user
  ON iam_audit_logs(tenant_id, user_id);
