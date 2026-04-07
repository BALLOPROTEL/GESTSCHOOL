DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'academic_stage') THEN
    CREATE TYPE academic_stage AS ENUM ('PRIMARY', 'SECONDARY', 'HIGHER');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_card_mode') THEN
    CREATE TYPE report_card_mode AS ENUM ('TRACK_SINGLE', 'PRIMARY_COMBINED');
  END IF;
END $$;

ALTER TABLE cycles
  ADD COLUMN IF NOT EXISTS academic_stage academic_stage NOT NULL DEFAULT 'PRIMARY';

UPDATE cycles
SET academic_stage = CASE
  WHEN UPPER(COALESCE(code, '')) LIKE '%PRIMARY%'
    OR UPPER(COALESCE(label, '')) LIKE '%PRIMAIRE%'
  THEN 'PRIMARY'::academic_stage
  WHEN UPPER(COALESCE(code, '')) LIKE '%HIGHER%'
    OR UPPER(COALESCE(code, '')) LIKE '%SUPERIOR%'
    OR UPPER(COALESCE(code, '')) LIKE '%SUPERIEUR%'
    OR UPPER(COALESCE(code, '')) LIKE '%UNIVERSIT%'
    OR UPPER(COALESCE(label, '')) LIKE '%HIGHER%'
    OR UPPER(COALESCE(label, '')) LIKE '%SUPERIEUR%'
    OR UPPER(COALESCE(label, '')) LIKE '%UNIVERSIT%'
  THEN 'HIGHER'::academic_stage
  ELSE 'SECONDARY'::academic_stage
END;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS billing_placement_id UUID,
  ADD COLUMN IF NOT EXISTS secondary_placement_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoices_billing_placement_id_fkey'
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT invoices_billing_placement_id_fkey
      FOREIGN KEY (billing_placement_id) REFERENCES student_track_placements(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoices_secondary_placement_id_fkey'
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT invoices_secondary_placement_id_fkey
      FOREIGN KEY (secondary_placement_id) REFERENCES student_track_placements(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_billing_placement
  ON invoices (billing_placement_id);

CREATE INDEX IF NOT EXISTS idx_invoices_secondary_placement
  ON invoices (secondary_placement_id);

ALTER TABLE report_cards
  ADD COLUMN IF NOT EXISTS secondary_placement_id UUID,
  ADD COLUMN IF NOT EXISTS mode report_card_mode NOT NULL DEFAULT 'TRACK_SINGLE',
  ADD COLUMN IF NOT EXISTS summary_data JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'report_cards_secondary_placement_id_fkey'
  ) THEN
    ALTER TABLE report_cards
      ADD CONSTRAINT report_cards_secondary_placement_id_fkey
      FOREIGN KEY (secondary_placement_id) REFERENCES student_track_placements(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_report_cards_secondary_placement
  ON report_cards (secondary_placement_id);

WITH ranked_placements AS (
  SELECT
    placement.id,
    placement.tenant_id,
    placement.student_id,
    placement.school_year_id,
    ROW_NUMBER() OVER (
      PARTITION BY placement.tenant_id, placement.student_id, placement.school_year_id
      ORDER BY
        cycle.sort_order DESC,
        level.sort_order DESC,
        placement.created_at ASC
    ) AS placement_rank
  FROM student_track_placements placement
  INNER JOIN levels level
    ON level.id = placement.level_id
  INNER JOIN cycles cycle
    ON cycle.id = level.cycle_id
  WHERE placement.placement_status IN ('ACTIVE', 'COMPLETED', 'SUSPENDED')
)
UPDATE invoices invoice
SET billing_placement_id = ranked.id
FROM ranked_placements ranked
WHERE ranked.tenant_id = invoice.tenant_id
  AND ranked.student_id = invoice.student_id
  AND ranked.school_year_id = invoice.school_year_id
  AND ranked.placement_rank = 1
  AND invoice.billing_placement_id IS NULL;

WITH ranked_placements AS (
  SELECT
    placement.id,
    placement.tenant_id,
    placement.student_id,
    placement.school_year_id,
    ROW_NUMBER() OVER (
      PARTITION BY placement.tenant_id, placement.student_id, placement.school_year_id
      ORDER BY
        cycle.sort_order DESC,
        level.sort_order DESC,
        placement.created_at ASC
    ) AS placement_rank
  FROM student_track_placements placement
  INNER JOIN levels level
    ON level.id = placement.level_id
  INNER JOIN cycles cycle
    ON cycle.id = level.cycle_id
  WHERE placement.placement_status IN ('ACTIVE', 'COMPLETED', 'SUSPENDED')
)
UPDATE invoices invoice
SET secondary_placement_id = ranked.id
FROM ranked_placements ranked
WHERE ranked.tenant_id = invoice.tenant_id
  AND ranked.student_id = invoice.student_id
  AND ranked.school_year_id = invoice.school_year_id
  AND ranked.placement_rank = 2
  AND invoice.secondary_placement_id IS NULL;
