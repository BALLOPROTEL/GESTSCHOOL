# GestSchool - Quick Start Sprint 1

## Prerequisites
- Node.js 20+ (Node 22 also works)
- pnpm 10+
- Docker Desktop
- psql client (recommended)

## 1) Start local infrastructure
```powershell
docker compose -f infra/docker/docker-compose.dev.yml up -d
```

## 2) Initialize database
```powershell
# Snapshot bootstrap (optional)
psql "postgresql://gestschool:gestschool@localhost:5432/gestschool" -f infra/migrations/V1__init.sql

# Seed baseline reference data
psql "postgresql://gestschool:gestschool@localhost:5432/gestschool" -f infra/scripts/seed.sql
Copy-Item apps/api/.env.example apps/api/.env -Force
```

## 3) Install dependencies
```powershell
pnpm install
```

## 4) Apply Prisma migrations + seed users
```powershell
pnpm --filter @gestschool/api db:generate
pnpm --filter @gestschool/api db:migrate:deploy
pnpm --filter @gestschool/api db:seed:users
```

## 5) Start API
```powershell
pnpm dev:api
```

## 5b) Start Worker
```powershell
pnpm dev:worker
```

## 5c) Start Web Admin
```powershell
Copy-Item apps/web-admin/.env.example apps/web-admin/.env -Force
pnpm dev:web
```

## 6) Login and get JWT token
```powershell
$loginBody = @{
  username = "admin@gestschool.local"
  password = "admin12345"
  tenantId = "00000000-0000-0000-0000-000000000001"
} | ConvertTo-Json

$auth = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/auth/login -ContentType "application/json" -Body $loginBody
$token = $auth.accessToken
$refreshToken = $auth.refreshToken
```

Seed users available by default (`pnpm --filter @gestschool/api seed:users`):
- `admin@gestschool.local / admin12345`
- `scolarite@gestschool.local / scolarite123`
- `comptable@gestschool.local / comptable123`
- `enseignant@gestschool.local / teacher1234`
- `parent@gestschool.local / parent1234`

## 7) Validate endpoints
- Health: `http://localhost:3000/api/v1/health`
- Readiness: `http://localhost:3000/api/v1/health/ready`
- Swagger: `http://localhost:3000/api/docs`
- Protected routes require `Authorization: Bearer <token>`.
- Example:
```powershell
Invoke-RestMethod -Method Get -Uri http://localhost:3000/api/v1/students -Headers @{ Authorization = "Bearer $token" }
```

## 8) Refresh and logout
```powershell
# Refresh tokens (rotation)
$refreshBody = @{ refreshToken = $refreshToken } | ConvertTo-Json
$newAuth = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/auth/refresh -ContentType "application/json" -Body $refreshBody

# Logout (revoke refresh token)
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/auth/logout -ContentType "application/json" -Body $refreshBody
```

## 9) Run e2e tests on PostgreSQL
```powershell
# Standard (fast)
pnpm --filter @gestschool/api test:e2e:db

# Fresh Prisma client rebuild (use this if you see a prisma:// datasource error)
pnpm --filter @gestschool/api test:e2e:db:fresh
```

## 10) Sprint 2 API endpoints
- Reference CRUD:
  - `GET|POST|PATCH|DELETE /api/v1/school-years`
  - `GET|POST|PATCH|DELETE /api/v1/cycles`
  - `GET|POST|PATCH|DELETE /api/v1/levels`
  - `GET|POST|PATCH|DELETE /api/v1/classes`
  - `GET|POST|PATCH|DELETE /api/v1/subjects`
  - `GET|POST|PATCH|DELETE /api/v1/academic-periods`
- Enrollments:
  - `GET|POST /api/v1/enrollments`
  - `DELETE /api/v1/enrollments/:id`

## Stop infrastructure
```powershell
docker compose -f infra/docker/docker-compose.dev.yml down
```

## Sprint 0 reference
See `docs/sprint0.md`.

## Deployment (GitHub + Render + Vercel)
- Guide complet: `docs/deployment-github-vercel-render.md`
- Render blueprint file: `render.yaml`
- Vercel config: `vercel.json`

## Production database operations
- Runtime:
  - `DATABASE_URL` is used by the API and the worker.
- Schema migrations:
  - `DIRECT_URL` is used by Prisma migrations outside the Render runtime.
- Recommended production flow:
```powershell
# 1. Set Supabase env vars in GitHub + Render
# 2. Run the manual GitHub Actions workflow: "Migrate Production"
# 3. Deploy Render web + worker
# 4. Run seed only if explicitly needed
pnpm --filter @gestschool/api db:seed:users
```
- Render services must not execute `prisma migrate deploy` or seed commands at boot.
