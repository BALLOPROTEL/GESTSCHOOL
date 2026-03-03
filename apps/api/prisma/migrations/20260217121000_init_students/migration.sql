CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  matricule VARCHAR(30) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  sex CHAR(1) NOT NULL CHECK (sex IN ('M', 'F')),
  birth_date DATE,
  birth_place VARCHAR(120),
  nationality VARCHAR(80),
  address TEXT,
  phone VARCHAR(30),
  email VARCHAR(120),
  photo_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'students_tenant_id_matricule_key'
  ) THEN
    ALTER TABLE students
      ADD CONSTRAINT students_tenant_id_matricule_key
      UNIQUE (tenant_id, matricule);
  END IF;
END $$;
