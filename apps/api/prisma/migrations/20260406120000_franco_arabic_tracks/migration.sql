CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  CREATE TYPE "AcademicTrack" AS ENUM ('FRANCOPHONE', 'ARABOPHONE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "RotationGroup" AS ENUM ('GROUP_A', 'GROUP_B');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "AcademicPlacementStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "PedagogicalRuleType" AS ENUM ('FIRST_CYCLE_PARALLEL_ROTATION', 'SECOND_CYCLE_WEEKLY_TRACK_SPLIT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE levels
  ADD COLUMN IF NOT EXISTS track "AcademicTrack" NOT NULL DEFAULT 'FRANCOPHONE',
  ADD COLUMN IF NOT EXISTS rotation_group "RotationGroup";

UPDATE levels
SET track = 'FRANCOPHONE'
WHERE track IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'levels_tenant_id_code_key'
  ) THEN
    ALTER TABLE levels DROP CONSTRAINT levels_tenant_id_code_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'levels_tenant_id_track_code_key'
  ) THEN
    ALTER TABLE levels
      ADD CONSTRAINT levels_tenant_id_track_code_key
      UNIQUE (tenant_id, track, code);
  END IF;
END $$;

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS track "AcademicTrack" NOT NULL DEFAULT 'FRANCOPHONE',
  ADD COLUMN IF NOT EXISTS rotation_group "RotationGroup";

UPDATE classes AS classes_to_update
SET track = levels.track
FROM levels
WHERE classes_to_update.level_id = levels.id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'classes_tenant_id_school_year_id_code_key'
  ) THEN
    ALTER TABLE classes DROP CONSTRAINT classes_tenant_id_school_year_id_code_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'classes_tenant_id_school_year_id_track_code_key'
  ) THEN
    ALTER TABLE classes
      ADD CONSTRAINT classes_tenant_id_school_year_id_track_code_key
      UNIQUE (tenant_id, school_year_id, track, code);
  END IF;
END $$;

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS track "AcademicTrack" NOT NULL DEFAULT 'FRANCOPHONE';

UPDATE enrollments AS enrollments_to_update
SET track = classes.track
FROM classes
WHERE enrollments_to_update.class_id = classes.id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_tenant_id_school_year_id_student_id_key'
  ) THEN
    ALTER TABLE enrollments DROP CONSTRAINT enrollments_tenant_id_school_year_id_student_id_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_tenant_id_school_year_id_student_id_track_key'
  ) THEN
    ALTER TABLE enrollments
      ADD CONSTRAINT enrollments_tenant_id_school_year_id_student_id_track_key
      UNIQUE (tenant_id, school_year_id, student_id, track);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS student_track_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_year_id UUID NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
  track "AcademicTrack" NOT NULL,
  level_id UUID NOT NULL REFERENCES levels(id) ON DELETE RESTRICT,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  legacy_enrollment_id UUID UNIQUE REFERENCES enrollments(id) ON DELETE SET NULL,
  placement_status "AcademicPlacementStatus" NOT NULL DEFAULT 'ACTIVE',
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_track_placements_tenant_id_school_year_id_student_id_track_key'
  ) THEN
    ALTER TABLE student_track_placements
      ADD CONSTRAINT student_track_placements_tenant_id_school_year_id_student_id_track_key
      UNIQUE (tenant_id, school_year_id, student_id, track);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_student_track_placements_student_year
  ON student_track_placements(tenant_id, student_id, school_year_id);

CREATE INDEX IF NOT EXISTS idx_student_track_placements_class
  ON student_track_placements(tenant_id, class_id, school_year_id);

WITH ranked_enrollments AS (
  SELECT
    enrollments.id,
    enrollments.tenant_id,
    enrollments.student_id,
    enrollments.school_year_id,
    enrollments.track,
    enrollments.class_id,
    classes.level_id,
    enrollments.enrollment_date,
    enrollments.enrollment_status,
    enrollments.created_at,
    enrollments.updated_at,
    ROW_NUMBER() OVER (
      PARTITION BY enrollments.tenant_id, enrollments.school_year_id, enrollments.student_id
      ORDER BY
        CASE WHEN enrollments.track = 'FRANCOPHONE' THEN 0 ELSE 1 END,
        enrollments.enrollment_date,
        enrollments.created_at,
        enrollments.id
    ) AS placement_rank
  FROM enrollments
  INNER JOIN classes ON classes.id = enrollments.class_id
)
INSERT INTO student_track_placements (
  tenant_id,
  student_id,
  school_year_id,
  track,
  level_id,
  class_id,
  legacy_enrollment_id,
  placement_status,
  is_primary,
  start_date,
  created_at,
  updated_at
)
SELECT
  ranked_enrollments.tenant_id,
  ranked_enrollments.student_id,
  ranked_enrollments.school_year_id,
  ranked_enrollments.track,
  ranked_enrollments.level_id,
  ranked_enrollments.class_id,
  ranked_enrollments.id,
  CASE UPPER(ranked_enrollments.enrollment_status)
    WHEN 'INACTIVE' THEN 'INACTIVE'::"AcademicPlacementStatus"
    WHEN 'SUSPENDED' THEN 'SUSPENDED'::"AcademicPlacementStatus"
    WHEN 'COMPLETED' THEN 'COMPLETED'::"AcademicPlacementStatus"
    ELSE 'ACTIVE'::"AcademicPlacementStatus"
  END,
  ranked_enrollments.placement_rank = 1,
  ranked_enrollments.enrollment_date,
  ranked_enrollments.created_at,
  ranked_enrollments.updated_at
FROM ranked_enrollments
WHERE NOT EXISTS (
  SELECT 1
  FROM student_track_placements
  WHERE student_track_placements.legacy_enrollment_id = ranked_enrollments.id
);

ALTER TABLE grades
  ADD COLUMN IF NOT EXISTS placement_id UUID,
  ADD COLUMN IF NOT EXISTS track "AcademicTrack" NOT NULL DEFAULT 'FRANCOPHONE';

ALTER TABLE report_cards
  ADD COLUMN IF NOT EXISTS placement_id UUID,
  ADD COLUMN IF NOT EXISTS track "AcademicTrack" NOT NULL DEFAULT 'FRANCOPHONE';

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS placement_id UUID,
  ADD COLUMN IF NOT EXISTS track "AcademicTrack" NOT NULL DEFAULT 'FRANCOPHONE';

ALTER TABLE timetable_slots
  ADD COLUMN IF NOT EXISTS track "AcademicTrack" NOT NULL DEFAULT 'FRANCOPHONE',
  ADD COLUMN IF NOT EXISTS rotation_group "RotationGroup";

UPDATE grades AS grades_to_update
SET
  track = classes.track,
  placement_id = (
    SELECT placements.id
    FROM student_track_placements AS placements
    WHERE placements.tenant_id = grades_to_update.tenant_id
      AND placements.student_id = grades_to_update.student_id
      AND placements.class_id = grades_to_update.class_id
      AND placements.school_year_id = classes.school_year_id
      AND placements.track = classes.track
    LIMIT 1
  )
FROM classes
WHERE grades_to_update.class_id = classes.id;

UPDATE report_cards AS report_cards_to_update
SET
  track = classes.track,
  placement_id = (
    SELECT placements.id
    FROM student_track_placements AS placements
    WHERE placements.tenant_id = report_cards_to_update.tenant_id
      AND placements.student_id = report_cards_to_update.student_id
      AND placements.class_id = report_cards_to_update.class_id
      AND placements.school_year_id = classes.school_year_id
      AND placements.track = classes.track
    LIMIT 1
  )
FROM classes
WHERE report_cards_to_update.class_id = classes.id;

UPDATE attendance AS attendance_to_update
SET
  track = classes.track,
  placement_id = (
    SELECT placements.id
    FROM student_track_placements AS placements
    WHERE placements.tenant_id = attendance_to_update.tenant_id
      AND placements.student_id = attendance_to_update.student_id
      AND placements.class_id = attendance_to_update.class_id
      AND placements.school_year_id = attendance_to_update.school_year_id
      AND placements.track = classes.track
    LIMIT 1
  )
FROM classes
WHERE attendance_to_update.class_id = classes.id;

UPDATE timetable_slots AS timetable_slots_to_update
SET
  track = classes.track,
  rotation_group = COALESCE(timetable_slots_to_update.rotation_group, classes.rotation_group)
FROM classes
WHERE timetable_slots_to_update.class_id = classes.id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'grades_placement_id_fkey'
  ) THEN
    ALTER TABLE grades
      ADD CONSTRAINT grades_placement_id_fkey
      FOREIGN KEY (placement_id) REFERENCES student_track_placements(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'report_cards_placement_id_fkey'
  ) THEN
    ALTER TABLE report_cards
      ADD CONSTRAINT report_cards_placement_id_fkey
      FOREIGN KEY (placement_id) REFERENCES student_track_placements(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_placement_id_fkey'
  ) THEN
    ALTER TABLE attendance
      ADD CONSTRAINT attendance_placement_id_fkey
      FOREIGN KEY (placement_id) REFERENCES student_track_placements(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_grades_track_placement
  ON grades(tenant_id, track, class_id, academic_period_id, placement_id);

CREATE INDEX IF NOT EXISTS idx_report_cards_track_placement
  ON report_cards(tenant_id, track, class_id, academic_period_id, placement_id);

CREATE INDEX IF NOT EXISTS idx_attendance_track_placement
  ON attendance(tenant_id, track, class_id, attendance_date, placement_id);

CREATE INDEX IF NOT EXISTS idx_timetable_slots_track_group
  ON timetable_slots(tenant_id, class_id, track, day_of_week, rotation_group);

CREATE TABLE IF NOT EXISTS pedagogical_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  school_year_id UUID REFERENCES school_years(id) ON DELETE CASCADE,
  cycle_id UUID REFERENCES cycles(id) ON DELETE CASCADE,
  level_id UUID REFERENCES levels(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  code VARCHAR(80) NOT NULL,
  label VARCHAR(160) NOT NULL,
  rule_type "PedagogicalRuleType" NOT NULL,
  track "AcademicTrack",
  rotation_group "RotationGroup",
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pedagogical_rules_tenant_id_code_key'
  ) THEN
    ALTER TABLE pedagogical_rules
      ADD CONSTRAINT pedagogical_rules_tenant_id_code_key
      UNIQUE (tenant_id, code);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pedagogical_rules_scope
  ON pedagogical_rules(tenant_id, school_year_id, cycle_id, level_id, class_id, rule_type, track);
