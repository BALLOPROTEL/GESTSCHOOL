# Supabase Data API Hardening

This project uses Prisma over direct PostgreSQL connections. It does **not** rely on Supabase's auto-generated Data API for normal application traffic.

To keep the Data API from exposing the `public` schema:

1. Apply Prisma migration `20260408094500_supabase_public_rls_hardening`.
2. In Supabase Dashboard, review `Project Settings -> Data API`.
3. If you do not use the Data API, disable it or remove `public` from the exposed schemas.

## What the migration does

- Enables RLS on every current table in `public`.
- Creates a single allow policy for non-public database roles.
- Revokes grants from `anon`, `authenticated`, and `authenticator`.
- Attempts to auto-secure future `CREATE TABLE` operations in `public`.

## Why Prisma still works

The policy intentionally blocks only the PostgREST-facing roles:

- `anon`
- `authenticated`
- `authenticator`

Direct PostgreSQL application roles used by Prisma remain allowed, which keeps:

- local development
- CI
- production migrations
- backend runtime queries

working as before.
