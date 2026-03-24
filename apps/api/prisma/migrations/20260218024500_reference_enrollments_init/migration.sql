CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS school_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code VARCHAR(20) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'school_years_tenant_id_code_key'
  ) THEN
    ALTER TABLE school_years
      ADD CONSTRAINT school_years_tenant_id_code_key UNIQUE (tenant_id, code);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code VARCHAR(20) NOT NULL,
  label VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cycles_tenant_id_code_key'
  ) THEN
    ALTER TABLE cycles
      ADD CONSTRAINT cycles_tenant_id_code_key UNIQUE (tenant_id, code);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  cycle_id UUID NOT NULL REFERENCES cycles(id),
  code VARCHAR(20) NOT NULL,
  label VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'levels_tenant_id_code_key'
  ) THEN
    ALTER TABLE levels
      ADD CONSTRAINT levels_tenant_id_code_key UNIQUE (tenant_id, code);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  school_year_id UUID NOT NULL REFERENCES school_years(id),
  level_id UUID NOT NULL REFERENCES levels(id),
  code VARCHAR(30) NOT NULL,
  label VARCHAR(100) NOT NULL,
  capacity INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'classes_tenant_id_school_year_id_code_key'
  ) THEN
    ALTER TABLE classes
      ADD CONSTRAINT classes_tenant_id_school_year_id_code_key
      UNIQUE (tenant_id, school_year_id, code);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code VARCHAR(20) NOT NULL,
  label VARCHAR(120) NOT NULL,
  is_arabic BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subjects_tenant_id_code_key'
  ) THEN
    ALTER TABLE subjects
      ADD CONSTRAINT subjects_tenant_id_code_key UNIQUE (tenant_id, code);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS academic_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  school_year_id UUID NOT NULL REFERENCES school_years(id),
  code VARCHAR(20) NOT NULL,
  label VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  period_type VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'academic_periods_tenant_id_school_year_id_code_key'
  ) THEN
    ALTER TABLE academic_periods
      ADD CONSTRAINT academic_periods_tenant_id_school_year_id_code_key
      UNIQUE (tenant_id, school_year_id, code);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  school_year_id UUID NOT NULL REFERENCES school_years(id),
  student_id UUID NOT NULL REFERENCES students(id),
  class_id UUID NOT NULL REFERENCES classes(id),
  enrollment_date DATE NOT NULL,
  enrollment_status VARCHAR(20) NOT NULL DEFAULT 'ENROLLED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_tenant_id_school_year_id_student_id_key'
  ) THEN
    ALTER TABLE enrollments
      ADD CONSTRAINT enrollments_tenant_id_school_year_id_student_id_key
      UNIQUE (tenant_id, school_year_id, student_id);
  END IF;
END $$;
