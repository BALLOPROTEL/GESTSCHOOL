# Production Readiness (Sprint 10)

## 1) Notifications externes

- Configuration providers:
  - `NOTIFY_EMAIL_PROVIDER=MOCK|WEBHOOK`
  - `NOTIFY_SMS_PROVIDER=MOCK|WEBHOOK`
  - `NOTIFY_EMAIL_WEBHOOK_URL`, `NOTIFY_SMS_WEBHOOK_URL`
  - `NOTIFY_EMAIL_WEBHOOK_TOKEN`, `NOTIFY_SMS_WEBHOOK_TOKEN`
- Worker asynchrone:
  - `NOTIFICATIONS_WORKER_ENABLED=true`
  - `NOTIFICATIONS_WORKER_INTERVAL_MS=15000`
  - `NOTIFICATIONS_WORKER_BATCH_SIZE=80`
- Retry:
  - `NOTIFY_MAX_ATTEMPTS=4`
  - `NOTIFY_RETRY_BASE_MINUTES=3`
- Callback délivrabilité:
  - `POST /api/v1/notifications/delivery-events`
  - Header: `x-notification-webhook-secret: <NOTIFICATION_WEBHOOK_SECRET>`

## 2) Stockage fichiers

- Endpoint: `POST /api/v1/storage/upload-descriptor`
- But: générer un descripteur d’upload (clé, URL d’upload, URL publique).
- Variables:
  - `FILE_STORAGE_DRIVER=LOCAL|S3|WEBHOOK`
  - `FILE_STORAGE_BASE_URL`
  - `FILE_STORAGE_S3_BUCKET`
  - `FILE_STORAGE_PRESIGN_ENDPOINT`

## 3) Monitoring

- Liveness: `GET /api/v1/health/live`
- Readiness DB: `GET /api/v1/health/ready`
- Metrics: `GET /api/v1/monitoring/metrics`
  - En production: exiger `MONITORING_METRICS_TOKEN` + header `x-metrics-token`.
- Swagger:
  - Contrôler l'exposition via `SWAGGER_ENABLED`.
  - Recommandation prod: `SWAGGER_ENABLED=false`.
- Exemple Prometheus config: `infra/monitoring/prometheus.yml`

## 4) Backups PostgreSQL

- Backup:
  - `pwsh infra/scripts/backup-postgres.ps1`
- Restore:
  - `pwsh infra/scripts/restore-postgres.ps1 -BackupFile <path.dump>`

## 5) Déploiement HA

- Docker compose prod: `infra/docker/docker-compose.prod.yml`
  - API répliquée (`deploy.replicas: 2`).
- Kubernetes:
  - `infra/k8s/api-deployment.yaml` (replicas + probes)
  - `infra/k8s/api-hpa.yaml` (autoscaling CPU)

## 6) Migrations production et Supabase

- Runtime:
  - `DATABASE_URL` est utilisee par l'API et le worker
- Migrations Prisma:
  - `DIRECT_URL` est utilisee hors runtime pour `prisma migrate deploy`
- Regle d'exploitation:
  - ne jamais lancer les migrations ou le seed au boot Render
- Ordre recommande:
  1. renseigner `DATABASE_URL` et `DIRECT_URL` avec les URLs PostgreSQL Supabase
  2. lancer le workflow GitHub Actions `Migrate Production`
  3. deployer le web et le worker Render
  4. lancer `pnpm --filter @gestschool/api db:seed:users` uniquement si un seed manuel est necessaire
- Secrets GitHub attendus:
  - `SUPABASE_DATABASE_URL`
  - `SUPABASE_DIRECT_URL`
