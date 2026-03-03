# Deploy Demo Client (GitHub + Render + Vercel)

Ce guide te permet de mettre en ligne la v1 pour Mosquee Blanche avec:
- API NestJS + PostgreSQL sur Render
- Web-admin sur Vercel

## 1) Base de donnees (important)

La base du projet est **PostgreSQL** (pas MongoDB).

En production:
- Render cree une base geree (`gestschool-postgres`) via `render.yaml`.
- L'API utilise `DATABASE_URL` (injecte automatiquement par Render).
- Au demarrage, l'API applique:
  - `prisma migrate deploy`
  - `seed:users` (comptes demo)

## 2) Push du code sur GitHub

Si le dossier n'est pas encore un repo Git:

```powershell
git init
git add .
git commit -m "Sprint 11 + deployment setup"
git branch -M main
git remote add origin https://github.com/<ton_user>/<ton_repo>.git
git push -u origin main
```

## 3) Deployer l'API + DB sur Render

Option recommandee:
- Dans Render: `New` -> `Blueprint`
- Connecte ton repo GitHub
- Render detecte `render.yaml` et cree:
  - `gestschool-postgres` (PostgreSQL)
  - `gestschool-api` (web service)

Apres premier deploy:
1. Ouvre le service `gestschool-api` -> `Environment`.
2. Mets a jour:
   - `FILE_STORAGE_BASE_URL` avec l'URL reelle du service Render.
   - `CORS_ORIGINS` avec l'URL Vercel finale (voir etape 4).
3. Verifie:
   - `https://<api>.onrender.com/api/v1/health/live`
   - `https://<api>.onrender.com/api/docs`

## 4) Deployer le web-admin sur Vercel

Option simple:
- Vercel -> `Add New` -> `Project`
- Import repo GitHub
- Vercel utilise `vercel.json` a la racine.

Ajoute la variable d'environnement de prod:
- `VITE_API_BASE_URL=https://<api>.onrender.com/api/v1`

Lance le deploy, puis recupere l'URL:
- `https://<ton-projet>.vercel.app`

## 5) Finaliser CORS cote API

Retourne sur Render (`gestschool-api`):
- `CORS_ORIGINS=https://<ton-projet>.vercel.app`

Redeploie ensuite le service API.

## 6) Comptes de demo a envoyer au client

- `admin@gestschool.local / admin12345`
- `scolarite@gestschool.local / scolarite123`
- `comptable@gestschool.local / comptable123`

Si tu veux changer les mots de passe demo, modifie les variables Render:
- `ADMIN_PASSWORD`
- `SCOLARITE_PASSWORD`
- `COMPTABLE_PASSWORD`

Puis redeploie.

## 7) Checklist avant envoi du lien client

- Login OK depuis Vercel
- CRUD eleves OK
- Modules Mosquee / Finance / Notes OK
- Rapports & conformite OK
- Export PDF/Excel OK
- Health API OK

## 8) Message type au client

```text
Bonjour,

Voici la premiere version web de demonstration:
- Application: https://<ton-projet>.vercel.app
- Compte test: admin@gestschool.local / <mot_de_passe>

Merci de tester les modules (Eleves, Inscriptions, Comptabilite, Mosquee, Rapports)
et de nous faire un retour sur l'ergonomie et les besoins metier prioritaires.
```
