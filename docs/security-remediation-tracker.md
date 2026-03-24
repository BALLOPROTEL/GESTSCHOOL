# Security Remediation Tracker

Last updated: 2026-03-08

## P0

- [x] SR-001: Stop exposing password reset tokens in API responses and UI.
- [x] SR-002: Stop reseeding demo accounts automatically on production startup.

## P1

- [x] SR-003: Harden production entrypoints: enforce explicit CORS, protect metrics, restrict Swagger.
- [x] SR-004: Remove demo auth defaults from the web login flow.
- [x] SR-005: Add auth rate limiting for public endpoints.
- [x] SR-006: Prevent duplicate notification dispatch in multi-instance deployments.

## P2

- [x] SR-007: Strengthen password policy and user credential lifecycle.
- [x] SR-008: Align database schema, migrations, and runtime defaults for currencies.
- [x] SR-009: Replace localStorage session storage for production-safe auth handling.

## Notes

- This tracker is intentionally ordered from highest risk to lowest risk.
- Each completed item should reference the code/config changed and the validation run.
- Latest completed work:
  - `SR-005`: rate limiting added on `auth/*`, `monitoring/metrics`, and `notifications/delivery-events`.
  - `SR-006`: dispatch now claims due notifications before sending to reduce duplicate sends across replicas.
  - `SR-007`: stronger password policy enforced on password creation/reset flows and active sessions revoked after admin password changes.
  - `SR-008`: storage defaults and migrations are now normalized to `CFA`, while the UI displays `F CFA`.
  - `SR-009`: web session tokens are no longer persisted in `localStorage`; stale persisted sessions are removed on application boot.
- Latest validation:
  - `pnpm --filter @gestschool/api lint`
  - `pnpm --filter @gestschool/api build`
  - `pnpm --filter @gestschool/web-admin lint`
  - `pnpm --filter @gestschool/web-admin build`
