-- Seed minimal v1
-- Note: tenant fixe de dev pour démarrage local

WITH t AS (
  SELECT '00000000-0000-0000-0000-000000000001'::UUID AS tenant_id
), sy AS (
  INSERT INTO school_years (tenant_id, code, start_date, end_date, is_active)
  SELECT tenant_id, '2025-2026', DATE '2025-09-01', DATE '2026-07-31', TRUE
  FROM t
  ON CONFLICT (tenant_id, code) DO NOTHING
  RETURNING id, tenant_id
)
INSERT INTO cycles (tenant_id, code, label, sort_order)
SELECT tenant_id, 'PRIMARY', 'Primaire', 1 FROM sy
UNION ALL SELECT tenant_id, 'COLLEGE', 'College', 2 FROM sy
UNION ALL SELECT tenant_id, 'LYCEE', 'Lycee', 3 FROM sy
UNION ALL SELECT tenant_id, 'SUPERIEUR', 'Superieur', 4 FROM sy
ON CONFLICT (tenant_id, code) DO NOTHING;

WITH t AS (
  SELECT '00000000-0000-0000-0000-000000000001'::UUID AS tenant_id
), c AS (
  SELECT id, code, tenant_id FROM cycles WHERE tenant_id = (SELECT tenant_id FROM t)
)
INSERT INTO levels (tenant_id, cycle_id, code, label, sort_order)
SELECT c.tenant_id, c.id, v.code, v.label, v.sort_order
FROM c
JOIN (
  VALUES
    ('PRIMARY','CP1','CP1',1),
    ('PRIMARY','CP2','CP2',2),
    ('PRIMARY','CE1','CE1',3),
    ('PRIMARY','CE2','CE2',4),
    ('PRIMARY','CM1','CM1',5),
    ('PRIMARY','CM2','CM2',6),
    ('COLLEGE','6E','6eme',7),
    ('COLLEGE','5E','5eme',8),
    ('COLLEGE','4E','4eme',9),
    ('COLLEGE','3E','3eme',10),
    ('LYCEE','2NDE','2nde',11),
    ('LYCEE','1ERE','1ere',12),
    ('LYCEE','TLE','Terminale',13),
    ('SUPERIEUR','L1','Licence 1',14),
    ('SUPERIEUR','L2','Licence 2',15),
    ('SUPERIEUR','L3','Licence 3',16),
    ('SUPERIEUR','M1','Master 1',17),
    ('SUPERIEUR','M2','Master 2',18)
) AS v(cycle_code, code, label, sort_order)
ON c.code = v.cycle_code
ON CONFLICT (tenant_id, code) DO NOTHING;

WITH t AS (
  SELECT '00000000-0000-0000-0000-000000000001'::UUID AS tenant_id
), sy AS (
  SELECT id, tenant_id FROM school_years WHERE tenant_id = (SELECT tenant_id FROM t) AND code = '2025-2026'
)
INSERT INTO academic_periods (tenant_id, school_year_id, code, label, start_date, end_date, period_type)
SELECT tenant_id, id, 'T1', 'Trimestre 1', DATE '2025-09-01', DATE '2025-12-20', 'TRIMESTER' FROM sy
UNION ALL SELECT tenant_id, id, 'T2', 'Trimestre 2', DATE '2026-01-06', DATE '2026-03-31', 'TRIMESTER' FROM sy
UNION ALL SELECT tenant_id, id, 'T3', 'Trimestre 3', DATE '2026-04-01', DATE '2026-07-15', 'TRIMESTER' FROM sy
ON CONFLICT (tenant_id, school_year_id, code) DO NOTHING;

WITH t AS (
  SELECT '00000000-0000-0000-0000-000000000001'::UUID AS tenant_id
)
INSERT INTO subjects (tenant_id, code, label, is_arabic)
SELECT tenant_id, 'MATH', 'Mathematiques', FALSE FROM t
UNION ALL SELECT tenant_id, 'FR', 'Francais', FALSE FROM t
UNION ALL SELECT tenant_id, 'PC', 'Physique-Chimie', FALSE FROM t
UNION ALL SELECT tenant_id, 'AR', 'Arabe', TRUE FROM t
UNION ALL SELECT tenant_id, 'EDI', 'Etudes Islamiques', TRUE FROM t
ON CONFLICT (tenant_id, code) DO NOTHING;
