CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS fee_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  school_year_id UUID NOT NULL REFERENCES school_years(id),
  level_id UUID NOT NULL REFERENCES levels(id),
  label VARCHAR(120) NOT NULL,
  total_amount NUMERIC(14,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'CFA',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fee_plans_tenant_id_school_year_id_level_id_label_key'
  ) THEN
    ALTER TABLE fee_plans
      ADD CONSTRAINT fee_plans_tenant_id_school_year_id_level_id_label_key
      UNIQUE (tenant_id, school_year_id, level_id, label);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  student_id UUID NOT NULL REFERENCES students(id),
  school_year_id UUID NOT NULL REFERENCES school_years(id),
  fee_plan_id UUID REFERENCES fee_plans(id),
  invoice_no VARCHAR(40) NOT NULL,
  amount_due NUMERIC(14,2) NOT NULL,
  amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (amount_paid >= 0),
  CHECK (amount_due >= 0),
  CHECK (amount_paid <= amount_due)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_tenant_id_invoice_no_key'
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT invoices_tenant_id_invoice_no_key
      UNIQUE (tenant_id, invoice_no);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_student_status
  ON invoices(tenant_id, student_id, status);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  receipt_no VARCHAR(40) NOT NULL,
  paid_amount NUMERIC(14,2) NOT NULL,
  payment_method VARCHAR(30) NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL,
  reference_external VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (paid_amount > 0)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_tenant_id_receipt_no_key'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_tenant_id_receipt_no_key
      UNIQUE (tenant_id, receipt_no);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payments_tenant_paid_at
  ON payments(tenant_id, paid_at);

CREATE TABLE IF NOT EXISTS grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  student_id UUID NOT NULL REFERENCES students(id),
  class_id UUID NOT NULL REFERENCES classes(id),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  academic_period_id UUID NOT NULL REFERENCES academic_periods(id),
  assessment_label VARCHAR(120) NOT NULL,
  assessment_type VARCHAR(30) NOT NULL DEFAULT 'DEVOIR',
  score NUMERIC(5,2) NOT NULL,
  score_max NUMERIC(5,2) NOT NULL DEFAULT 20,
  absent BOOLEAN NOT NULL DEFAULT FALSE,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (score >= 0),
  CHECK (score_max > 0),
  CHECK (score <= score_max)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_grades_tenant_student_class_subject_period_assess'
  ) THEN
    ALTER TABLE grades
      ADD CONSTRAINT uq_grades_tenant_student_class_subject_period_assess
      UNIQUE (tenant_id, student_id, class_id, subject_id, academic_period_id, assessment_label);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_grades_tenant_class_period
  ON grades(tenant_id, class_id, academic_period_id);

CREATE TABLE IF NOT EXISTS report_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  student_id UUID NOT NULL REFERENCES students(id),
  class_id UUID NOT NULL REFERENCES classes(id),
  academic_period_id UUID NOT NULL REFERENCES academic_periods(id),
  avg_general NUMERIC(6,3) NOT NULL,
  class_rank INT,
  appreciation VARCHAR(40),
  pdf_url TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_report_cards_tenant_student_class_period'
  ) THEN
    ALTER TABLE report_cards
      ADD CONSTRAINT uq_report_cards_tenant_student_class_period
      UNIQUE (tenant_id, student_id, class_id, academic_period_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_report_cards_tenant_class_period
  ON report_cards(tenant_id, class_id, academic_period_id);
