# Prisma Migration Recovery

This project has two different migration contexts:

- `production`: Supabase PostgreSQL
- `local`: your own PostgreSQL instance, often `localhost:5432/gestschool`

If `pnpm --filter @gestschool/api db:migrate:deploy` fails locally with `P3009`, the issue is usually **your local database history**, not the migration files in the repository.

## Typical local error

Example:

```text
Error: P3009
migrate found failed migrations in the target database
The `20260328194500_outbox_events` migration ... failed
```

This means Prisma has a failed row in `_prisma_migrations` for your local database.

## Safe rule

- Do **not** use your broken local database as proof that production is broken.
- Do **not** edit old migrations that are already part of deployed history.
- Fix the local database state first, then run migrations again.

## Fastest local recovery options

### Option A — recommended for local-only databases

If the local database contains only test/dev data, recreate it cleanly.

1. Drop the local database.
2. Recreate it empty.
3. Run migrations again.
4. Seed users again.

Commands:

```powershell
pnpm.cmd --filter @gestschool/api db:migrate:deploy
pnpm.cmd --filter @gestschool/api db:seed:users
```

### Option B — if the table already exists but Prisma marked migration as failed

Use `prisma migrate resolve` only on the **local** database after confirming the objects from the failed migration already exist.

Example for the outbox migration:

```powershell
pnpm.cmd --filter @gestschool/api exec prisma migrate resolve --applied 20260328194500_outbox_events
pnpm.cmd --filter @gestschool/api db:migrate:deploy
```

Only do this if:

- `outbox_events` really exists
- the migration SQL effects are already present

## Production procedure

Production must be migrated through the GitHub workflow:

- [migrate-production.yml](/d:/PROJETS/GESTSCHOOL/.github/workflows/migrate-production.yml)

Do not point local troubleshooting commands at production by accident.

## Recommended production sequence

1. Push the migration files to `main`.
2. Open GitHub Actions.
3. Run `Migrate Production`.
4. Wait for:
   - `Show migration status`
   - `Apply production migrations`
5. Verify Render API health:

```powershell
(Invoke-WebRequest -Uri "https://gestschool-c880.onrender.com/api/v1/health/live").StatusCode
(Invoke-WebRequest -Uri "https://gestschool-c880.onrender.com/api/v1/health/ready").StatusCode
```

## Supabase security follow-up

After the RLS hardening migration is applied, refresh Security Advisor. If Data API is disabled, the warning should stop once Supabase re-checks the project.
