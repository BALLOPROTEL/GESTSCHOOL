CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  student_id UUID NOT NULL REFERENCES students(id),
  class_id UUID NOT NULL REFERENCES classes(id),
  school_year_id UUID NOT NULL REFERENCES school_years(id),
  attendance_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PRESENT',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_att_tenant_student_class_date'
  ) THEN
    ALTER TABLE attendance
      ADD CONSTRAINT uq_att_tenant_student_class_date
      UNIQUE (tenant_id, student_id, class_id, attendance_date);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_att_tenant_class_date
  ON attendance(tenant_id, class_id, attendance_date);

CREATE TABLE IF NOT EXISTS timetable_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  class_id UUID NOT NULL REFERENCES classes(id),
  school_year_id UUID NOT NULL REFERENCES school_years(id),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  day_of_week INT NOT NULL,
  start_time CHAR(5) NOT NULL,
  end_time CHAR(5) NOT NULL,
  room VARCHAR(80),
  teacher_name VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (day_of_week BETWEEN 1 AND 7),
  CHECK (start_time < end_time)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_tts_tenant_class_day_start'
  ) THEN
    ALTER TABLE timetable_slots
      ADD CONSTRAINT uq_tts_tenant_class_day_start
      UNIQUE (tenant_id, class_id, day_of_week, start_time);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tts_tenant_class_day
  ON timetable_slots(tenant_id, class_id, day_of_week);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  student_id UUID REFERENCES students(id),
  audience_role VARCHAR(30),
  title VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  channel VARCHAR(20) NOT NULL DEFAULT 'IN_APP',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_tenant_status_channel
  ON notifications(tenant_id, status, channel);

CREATE INDEX IF NOT EXISTS idx_notif_tenant_student
  ON notifications(tenant_id, student_id);
