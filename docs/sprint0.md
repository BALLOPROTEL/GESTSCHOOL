# Sprint 0 - Socle exécutable (5 jours)

Objectif: livrer une base technique stable, sécurisée et prête à accueillir les modules métier (scolarité, notes, comptabilité) sans refonte.

## 1) Résultats attendus en fin de sprint
1. Monorepo initialisé (`api`, `web-admin`, `mobile`, `infra`, `docs`).
2. Infrastructure locale opérationnelle (`PostgreSQL`, `Redis`) via Docker.
3. Schéma DB v1 migré depuis `docs/proposition1.md`.
4. Seed minimal injecté (année active, cycles, niveaux CP1->M2, périodes, matières de base).
5. API démarrable avec `/api/v1/health`, auth de base, Swagger.
6. RBAC minimal actif et audit des opérations sensibles en place.
7. Pipeline CI minimale (lint, test, build) fonctionnelle.
8. Documentation de démarrage validée.

## 2) Périmètre Sprint 0

### In scope
- Setup technique et outillage.
- Schéma de données initial et migration.
- Contrat API v1 minimal.
- Sécurité v1 (auth + rôles + audit minimal).
- Qualité CI/CD minimale.

### Out of scope
- Logique métier complète notes/bulletins.
- Intégration paiement externe (mobile money).
- Portail parent complet.
- Module mosquée (prévu phase ultérieure).

## 3) Architecture technique à implémenter maintenant

### Stack
- API: `NestJS` + `TypeScript`
- Web admin: `React + Vite + TS`
- Mobile: `Flutter` (squelette)
- DB: `PostgreSQL 16`
- Cache/session: `Redis 7`
- Documentation API: `OpenAPI/Swagger`
- CI: GitHub Actions

### Principes de conception
- Modular monolith strict (modules internes découplés).
- API versionnée (`/api/v1`).
- Multi-tenant prêt (`tenant_id` sur les tables métier).
- Transactions obligatoires sur flux financiers.
- Journal d’audit pour notes, paiements, rôles.

## 4) Backlog priorisé Sprint 0

## P0 - Bloquant démarrage produit

### US-S0-001 - Bootstrap monorepo
En tant qu’équipe technique, je veux une structure standardisée pour développer rapidement et proprement.

Critères d’acceptation:
- Arborescence créée: `apps/`, `infra/`, `docs/`.
- Apps créées: `apps/api`, `apps/web-admin`, `apps/mobile`.
- README racine avec commandes de démarrage.

### US-S0-002 - Infrastructure locale
En tant que développeur, je veux démarrer PostgreSQL et Redis en une commande.

Critères d’acceptation:
- `docker compose -f infra/docker/docker-compose.dev.yml up -d` fonctionne.
- Healthcheck PostgreSQL `healthy`.
- Données persistées via volumes.

### US-S0-003 - Migration base de données v1
En tant que backend dev, je veux versionner la base pour garantir la reproductibilité.

Critères d’acceptation:
- `infra/migrations/V1__init.sql` créé depuis `docs/proposition1.md`.
- Migration exécutable sans erreur.
- Index critiques présents.

### US-S0-004 - Seed référentiel minimal
En tant que scolarité, je veux un référentiel prêt à l’usage pour éviter les saisies manuelles répétitives.

Critères d’acceptation:
- Seed injecte année active, cycles, niveaux CP1->M2, périodes, matières.
- Script rejouable sans casser les contraintes d’unicité.

### US-S0-005 - API skeleton + contrat minimal
En tant qu’intégrateur frontend, je veux une API disponible avec endpoints de base.

Critères d’acceptation:
- Endpoints disponibles:
  - `GET /api/v1/health`
  - `POST /api/v1/auth/login`
  - `GET /api/v1/students`
  - `POST /api/v1/students`
  - `POST /api/v1/enrollments`
  - `POST /api/v1/payments`
- Swagger exposé sur `/api/docs`.

### US-S0-006 - Sécurité v1 (RBAC + audit)
En tant qu’admin, je veux contrôler qui peut accéder à quoi.

Critères d’acceptation:
- Rôles actifs: `ADMIN`, `SCOLARITE`, `ENSEIGNANT`, `COMPTABLE`, `PARENT`.
- Refus d’accès sur route non autorisée (`403`).
- Audit log sur actions sensibles: notes, paiements, rôles.

### US-S0-007 - CI minimale
En tant qu’équipe, je veux empêcher l’intégration de code cassé.

Critères d’acceptation:
- Workflow CI exécute `install`, `lint`, `test`, `build`.
- Pipeline en échec si une app ne compile pas.

## P1 - Important mais non bloquant release sprint 0

### US-S0-008 - Checklist sécurité et exploitation
Critères d’acceptation:
- `.env.example` disponible et documenté.
- Secrets non committés.
- Procédure backup/restore locale documentée.

## 5) Plan d’exécution (J1 -> J5)
1. J1: bootstrap repo + apps + docker compose + `.env.example`.
2. J2: migration `V1__init.sql` + validation schéma + seed initial.
3. J3: API skeleton + modules auth/students/enrollments/payments + Swagger.
4. J4: RBAC + audit logs + contrôles d’accès + tests d’intégration critiques.
5. J5: CI GitHub Actions + documentation + recette technique sprint.

## 6) Commandes de démarrage standard

```powershell
# Infrastructure
docker compose -f infra/docker/docker-compose.dev.yml up -d

# Migration
psql "postgresql://gestschool:gestschool@localhost:5432/gestschool" -f infra/migrations/V1__init.sql

# Seed
psql "postgresql://gestschool:gestschool@localhost:5432/gestschool" -f infra/scripts/seed.sql

# API
cd apps/api
pnpm install
pnpm run start:dev
```

## 7) Qualité et Definition of Done
- Setup machine neuve < 15 minutes avec la doc.
- PostgreSQL/Redis démarrent sans erreur.
- Migration + seed passent en local.
- API démarre et répond `200` sur `/api/v1/health`.
- Swagger fonctionnel.
- RBAC testé au moins sur 2 routes protégées.
- Pipeline CI verte sur branche principale.
- README à jour.

## 8) Risques et mitigations
1. Dérive de périmètre vers métier trop tôt.
   - Mitigation: strict respect du périmètre Sprint 0.
2. Schéma DB trop ambitieux pour la semaine.
   - Mitigation: livrer noyau v1, reporter extensions.
3. Dette sécurité initiale.
   - Mitigation: RBAC + audit dès Sprint 0.

## 9) Livrables concrets attendus
- `infra/docker/docker-compose.dev.yml`
- `infra/migrations/V1__init.sql`
- `infra/scripts/seed.sql`
- `.env.example`
- `apps/api` opérationnel
- `.github/workflows/ci.yml`
- `README.md`
