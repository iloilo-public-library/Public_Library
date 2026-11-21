# Project Development Timeline

## Project Information
- **Project Name:** Iloilo Public Library Management System (`library-management-system-v3`)
- **Active Git Branch:** `tony@dev`
- **Documentation Start Date:** November 21, 2026
- **Purpose of This Document:** Official chronological record of development activities, architectural decisions, troubleshooting, project milestones, and verified Git commits starting November 21, 2026.

---

## Development Activities

### November 21, 2026

#### 1. Phase 1: Pre-Migration Repository Cleanup & Baseline Tagging
- **Date:** November 21, 2026
- **Status:** Completed
- **Description:** Cleaned the Git index of compiled Python bytecode (`__pycache__/*.pyc`) and TypeScript build cache (`tsconfig.tsbuildinfo`), updated `.gitignore`, added the initial `INTEGRATION_PLAN.md` specification, and recorded the `pre-migration` baseline commit before structural refactoring.
- **Relevant Files / Modules:** `.gitignore`, `package-lock.json`, `plan folder/INTEGRATION_PLAN.md`, `static/models/Architect lamp – pull the switch.html`

#### 2. Phase 2: Repository Restructure & Layered Architecture Setup
- **Date:** November 21, 2026
- **Status:** Completed
- **Description:** Reorganized the repository to isolate the legacy Flask application into `legacy-flask/` and structure the Next.js App Router codebase into a layered architecture without altering business logic:
  - Moved Flask modules (`app.py`, `conn.py`, `requirements.txt`, `Dockerfile`, `routes/`, `templates/`, `authentication/`, `backup/`, `email_config/`, `errors/`, `helpers/`, `landing/`, `storage/`, `task_queue/`, `static/uploads/`, `static/js/`) into `legacy-flask/`.
  - Merged static image assets and `brain.glb` into a single `public/images/` and `public/models/brain.glb` location and updated `src/` component references.
  - Moved utility scripts from `useful_tools(just in case)/` into `scripts/`.
  - Grouped Next.js pages into `src/app/(public)/` and `src/app/(staff)/` route groups.
  - Split `src/lib/admin/queries.ts` and `src/lib/admin/mutations.ts` into domain repositories under `src/repositories/` and moved `error-logger.ts` to `src/lib/audit/error-logger.ts`.
  - Created skeleton directories (`src/config/`, `src/services/`, `src/validators/`, `tests/`, `docs/`) and created `MIGRATION.md` to track route-by-route migration status.
  - Verified all Phase 2 gate checks (`next build --webpack`, `tsc --noEmit`, `npm run lint`, Flask boot test, and 30/30 HTTP 200 route checks).
- **Relevant Files / Modules:** `legacy-flask/**`, `public/images/**`, `public/models/brain.glb`, `scripts/*`, `src/app/(public)/**`, `src/app/(staff)/**`, `src/repositories/*`, `src/lib/audit/error-logger.ts`, `MIGRATION.md`, `.gitignore`

#### 3. Database Architecture Decision & Phase 3.5 Verification
- **Date:** November 21, 2026
- **Status:** Completed
- **Description:** Established Supabase PostgreSQL as the single source of truth for the application and confirmed Next.js owns authentication during the migration bridge via custom HMAC-signed `icpl_session` cookies verified against `public.users` (using `$2b$` bcrypt hashes). Confirmed legacy MySQL (`flask_mysqldb`) holds old reference data only and requires no data migration. Removed legacy MySQL migration scripts and replaced XAMPP/MySQL setup instructions in `README.md` with Next.js + Supabase documentation.
- **Relevant Files / Modules:** `plan folder/INTEGRATION_PLAN.md`, `MIGRATION.md`, `README.md`, `scripts/migrate_admin.py` (removed), `scripts/migrate_admin copy.py` (removed)

#### 4. Phase 3: Core Architecture Skeleton, RBAC Middleware, Validators & Audit Layer
- **Date:** November 21, 2026
- **Status:** Completed
- **Description:** Implemented the Next.js layered backend skeleton and Flask health bridge:
  - Installed `zod` and created environment/application constants (`src/config/env.ts`, `src/config/constants.ts`), typed error classes (`src/lib/errors.ts`), and structured logging (`src/lib/logger.ts`).
  - Implemented role-based access control helpers (`src/lib/auth/rbac.ts`) and Edge-compatible route protection middleware (`src/middleware.ts`) enforcing `admin`, `librarian`, and `user` access rules.
  - Created Zod request validators (`src/validators/common.ts`, `src/validators/auth.ts`, `src/validators/admin.ts`).
  - Added the admin service layer (`src/services/admin.service.ts`) and audit logger (`src/lib/audit/audit-logger.ts`), and wired `src/app/api/admin/data/route.ts` to validate inputs, enforce RBAC, and log mutations.
  - Removed temporary Supabase quickstart test files (`src/utils/supabase/`, `src/app/(public)/supabase-test/`).
  - Created the Flask health endpoint (`legacy-flask/api/health.py` serving `GET /api/health`), configured `/flask/:path*` rewrites in `next.config.ts`, added `flaskFetch` in `src/lib/api.ts`, and removed `legacy-flask/server.js`.
  - Passed all Phase 3 gate checks (`tsc --noEmit`, `next build --webpack`, live `/api/health` and `/flask/health` 200 checks, middleware 307 redirects on protected routes, and 400/401 API validation checks).
- **Relevant Files / Modules:** `package.json`, `next.config.ts`, `src/config/env.ts`, `src/config/constants.ts`, `src/lib/errors.ts`, `src/lib/logger.ts`, `src/lib/auth/rbac.ts`, `src/middleware.ts`, `src/validators/{common,auth,admin}.ts`, `src/services/admin.service.ts`, `src/lib/audit/audit-logger.ts`, `src/app/api/admin/data/route.ts`, `src/lib/api.ts`, `legacy-flask/api/health.py`

#### 5. Project Activity & Commit Timeline Documentation
- **Date:** November 21, 2026
- **Status:** Completed
- **Description:** Inspected the repository structure, working tree status, and Git commit history from November 21, 2026 onward to establish `timeline.md` as the official development and commit ledger.
- **Relevant Files / Modules:** `timeline.md`

---

## Git Commit History

### November 21, 2026

#### Commit `b3f42cbb09848c71dc29ff6ae881d01253537a9f`
- **Date & Time:** `2026-11-21 09:45:53 +0800`
- **Author:** `antzyyy123`
- **Commit Hash:** `b3f42cbb09848c71dc29ff6ae881d01253537a9f`
- **Commit Message:** `chore: pre-migration cleanup, ignore generated files`
- **Explanation of Changes:** Removed tracked Python `.pyc` bytecode cache files and `tsconfig.tsbuildinfo` from version control, updated `.gitignore` to ignore generated build artifacts, updated `package-lock.json`, and added `plan folder/INTEGRATION_PLAN.md` along with the static architect lamp HTML asset prior to starting the Phase 2 restructure.
- **Files / Modules Affected:**
  - Modified: `.gitignore`, `package-lock.json`
  - Added: `plan folder/INTEGRATION_PLAN.md`, `static/models/Architect lamp – pull the switch.html`
  - Deleted from index: `tsconfig.tsbuildinfo`, `authentication/__pycache__/*`, `backup/__pycache__/*`, `email_config/__pycache__/*`, `errors/__pycache__/*`, `helpers/__pycache__/*`, `landing/__pycache__/*`, `routes/__pycache__/*`

#### Commit `7701fea211b584b5d7c51c89ddd92fff3098c167`
- **Date & Time:** `2026-11-21 13:45:58 +0800`
- **Author:** `antzyyy123`
- **Commit Hash:** `7701fea211b584b5d7c51c89ddd92fff3098c167`
- **Commit Message:** `feat: complete Phase 2 restructure and Phase 3 layered architecture skeleton`
- **Explanation of Changes:** Committed all Phase 2 repository restructuring and Phase 3 architecture skeleton changes — moving the legacy Flask codebase into `legacy-flask/`, consolidating static assets into `public/`, grouping Next.js pages into `src/app/(public)/` and `src/app/(staff)/`, splitting data queries/mutations into domain repositories under `src/repositories/`, implementing RBAC middleware (`src/middleware.ts`, `src/lib/auth/rbac.ts`), Zod validators (`src/validators/*`), the admin service and audit layer (`src/services/admin.service.ts`, `src/lib/audit/audit-logger.ts`), the Flask health bridge (`legacy-flask/api/health.py`, `next.config.ts`, `src/lib/api.ts`), and adding `MIGRATION.md` and `timeline.md`.
- **Files / Modules Affected:**
  - Renamed / Moved: `legacy-flask/**`, `public/images/**`, `public/models/brain.glb`, `scripts/*`, `src/app/(public)/**`, `src/app/(staff)/**`, `src/lib/audit/error-logger.ts`
  - Added: `MIGRATION.md`, `timeline.md`, `legacy-flask/api/{__init__,health}.py`, `src/config/{constants,env}.ts`, `src/lib/{errors,logger}.ts`, `src/lib/audit/audit-logger.ts`, `src/lib/auth/rbac.ts`, `src/middleware.ts`, `src/repositories/*`, `src/services/admin.service.ts`, `src/validators/{admin,auth,common}.ts`, `docs/.gitkeep`, `tests/{e2e,integration,unit}/.gitkeep`
  - Modified: `.gitignore`, `README.md`, `next.config.ts`, `package.json`, `package-lock.json`, `plan folder/INTEGRATION_PLAN.md`, `src/app/api/admin/data/route.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/error-logs/route.ts`, `src/app/layout.tsx`, `src/app/user/home/page.tsx`, `src/components/landing/*`, `src/components/layout/*`, `src/lib/api.ts`
  - Deleted: `server.js`, `src/lib/admin/{mutations,queries}.ts`, `useful_tools(just in case)/migrate_admin*.py`

---

## Ongoing Activities

- **Phase 4 Preparation (Librarian Module Discovery):** Initial inspection of `src/components/layout/StaffSidebar.tsx`, `MIGRATION.md`, and `plan folder/INTEGRATION_PLAN.md` was started to prepare the implementation plan for porting the 11 librarian pages, then paused at the user's request before any Phase 4 files were created or modified.

---

## Planned Activities

- **Phase 4 — Port the Librarian Module (11 Pages) & Supporting APIs:**
  - Port the 11 librarian views from `legacy-flask/templates/librarians/*` and `legacy-flask/routes/librarian_routes.py` to Next.js under `src/app/(staff)/librarian/` in batches:
    1. `src/app/(staff)/librarian/home/page.tsx`
    2. `src/app/(staff)/librarian/dashboard/page.tsx`
    3. `src/app/(staff)/librarian/library-cards/page.tsx`
    4. `src/app/(staff)/librarian/users/page.tsx`
    5. `src/app/(staff)/librarian/books/page.tsx`
    6. `src/app/(staff)/librarian/announcements/page.tsx`
    7. `src/app/(staff)/librarian/inventory/page.tsx`
    8. `src/app/(staff)/librarian/account-requests/page.tsx`
    9. `src/app/(staff)/librarian/calendar/page.tsx`
    10. `src/app/(staff)/librarian/records-returns/page.tsx`
    11. `src/app/(staff)/librarian/settings/page.tsx`
  - Add librarian navigation support in `src/components/layout/StaffSidebar.tsx` and create required librarian API endpoints (`src/app/api/librarian/**`), validators, and service methods backed by Supabase.
- **Phase 5 — Port Remaining Features One at a Time:**
  - Password and PIN reset flows (`src/app/(public)/reset-password`, `src/app/(public)/reset-pin`, `src/app/api/auth/reset-password`, `src/app/api/auth/reset-pin`) and MFA/CAPTCHA/OTP verification endpoints.
  - QR authentication endpoints (`src/lib/auth/qr.ts`, `src/app/api/auth/qr/route.ts`).
  - Email delivery service (`src/lib/email/`).
  - File uploads and book cover thumbnails via Supabase Storage (`src/lib/storage/`).
  - Automated backup and background jobs targeting Supabase (`src/lib/jobs/backup.ts`, `src/app/api/backup/route.ts`).
  - Remaining member settings page (`src/app/user/settings/page.tsx`) and user/admin supporting API endpoints listed in `MIGRATION.md`.
- **Phase 6 — Final Verification & Legacy Cutover:**
  - Run unit, integration, and end-to-end verification tests, perform side-by-side validation, remove the `/flask/:path*` rewrite from `next.config.ts`, and delete `legacy-flask/`.

---

## Documentation Guidelines
- Maintain chronological order, newest activities last.
- Use clear, simple, and professional technical language.
- Keep descriptions concise but informative.
- Update this file whenever a new activity is performed or a Git commit is made.
- Never delete historical records unless explicitly instructed.
- Avoid duplicate entries.
- Preserve previously documented information when updating the file.
