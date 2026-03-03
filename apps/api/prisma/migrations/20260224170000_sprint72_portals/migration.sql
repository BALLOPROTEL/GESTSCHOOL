CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS teacher_class_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  school_year_id UUID NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_teacher_assignments_scope'
  ) THEN
    ALTER TABLE teacher_class_assignments
      ADD CONSTRAINT uq_teacher_assignments_scope
      UNIQUE (tenant_id, user_id, class_id, school_year_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_tenant_user
  ON teacher_class_assignments(tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_tenant_class
  ON teacher_class_assignments(tenant_id, class_id);

CREATE TABLE IF NOT EXISTS parent_student_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  parent_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relationship VARCHAR(40),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_parent_links_scope'
  ) THEN
    ALTER TABLE parent_student_links
      ADD CONSTRAINT uq_parent_links_scope
      UNIQUE (tenant_id, parent_user_id, student_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_parent_links_tenant_parent
  ON parent_student_links(tenant_id, parent_user_id);

CREATE INDEX IF NOT EXISTS idx_parent_links_tenant_student
  ON parent_student_links(tenant_id, student_id);
