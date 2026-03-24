# Web Admin

React + Vite admin app for Sprint 1 and Sprint 2.

## Features
- Login screen (`/auth/login`)
- Token persistence (`accessToken` + `refreshToken` in localStorage)
- Automatic refresh on `401` (`/auth/refresh`)
- Logout (`/auth/logout`)
- Students CRUD (list/create/update/delete)
- Academic reference pages (school years, cycles, levels, classes, subjects, periods)
- Enrollments page (create/list/filter/delete)

## Run
```powershell
Copy-Item apps/web-admin/.env.example apps/web-admin/.env -Force
pnpm --filter @gestschool/web-admin dev
```

Default URL: `http://localhost:5180`

## UI flow check
1. Login with `admin@gestschool.local / admin12345`.
2. Click `Tester refresh` and verify no auth error appears.
3. Click `Logout`.
4. Confirm session is cleared and login form is shown again.
