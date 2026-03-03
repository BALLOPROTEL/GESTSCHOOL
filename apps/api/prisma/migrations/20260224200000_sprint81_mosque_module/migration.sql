CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS mosque_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  member_code VARCHAR(40) NOT NULL,
  full_name VARCHAR(140) NOT NULL,
  sex CHAR(1),
  phone VARCHAR(30),
  email VARCHAR(120),
  address TEXT,
  joined_at DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_mosque_members_sex CHECK (sex IS NULL OR sex IN ('M', 'F'))
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mosque_members_tenant_id_member_code_key'
  ) THEN
    ALTER TABLE mosque_members
      ADD CONSTRAINT mosque_members_tenant_id_member_code_key
      UNIQUE (tenant_id, member_code);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mosque_members_tenant_status
  ON mosque_members(tenant_id, status);

CREATE TABLE IF NOT EXISTS mosque_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code VARCHAR(40) NOT NULL,
  title VARCHAR(160) NOT NULL,
  activity_date DATE NOT NULL,
  category VARCHAR(40) NOT NULL,
  location VARCHAR(120),
  description TEXT,
  is_school_linked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mosque_activities_tenant_id_code_key'
  ) THEN
    ALTER TABLE mosque_activities
      ADD CONSTRAINT mosque_activities_tenant_id_code_key
      UNIQUE (tenant_id, code);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mosque_activities_tenant_date
  ON mosque_activities(tenant_id, activity_date);

CREATE TABLE IF NOT EXISTS mosque_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  member_id UUID REFERENCES mosque_members(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'XOF',
  channel VARCHAR(30) NOT NULL DEFAULT 'CASH',
  donated_at TIMESTAMPTZ NOT NULL,
  reference_no VARCHAR(60),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mosque_donations_tenant_id_reference_no_key'
  ) THEN
    ALTER TABLE mosque_donations
      ADD CONSTRAINT mosque_donations_tenant_id_reference_no_key
      UNIQUE (tenant_id, reference_no);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mosque_donations_tenant_donated_at
  ON mosque_donations(tenant_id, donated_at);

CREATE INDEX IF NOT EXISTS idx_mosque_donations_tenant_member
  ON mosque_donations(tenant_id, member_id);
