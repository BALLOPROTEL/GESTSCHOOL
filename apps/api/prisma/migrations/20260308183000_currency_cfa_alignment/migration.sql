ALTER TABLE fee_plans
  ALTER COLUMN currency SET DEFAULT 'CFA';

ALTER TABLE mosque_donations
  ALTER COLUMN currency SET DEFAULT 'CFA';

UPDATE fee_plans
SET currency = 'CFA'
WHERE UPPER(TRIM(currency)) = 'XOF';

UPDATE mosque_donations
SET currency = 'CFA'
WHERE UPPER(TRIM(currency)) = 'XOF';
