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

#### 6. Phase 4: Port Librarian Module (11 Pages, Navigation & RBAC)
- **Date:** November 21, 2026
- **Status:** Completed (Uncommitted in working tree)
- **Description:** Ported all 11 librarian module pages from legacy Flask to Next.js App Router backed by Supabase and extended staff layout/RBAC for the `librarian` role:
  - Added `LIBRARIAN_NAV` to `StaffSidebar`, role-aware links to `StaffTopbar` & `StaffShell`, and role-aware `AdminResourceView` (read-only patron directory on `users`, renewal-only filtering on `account_requests`).
  - Updated `src/repositories/account-requests.ts` and `src/repositories/index.ts` so librarians can approve, reject, and delete library card renewal requests (`request_type === "renew"`) while preserving admin-only restrictions on other request types.
  - Updated `src/app/api/auth/login/route.ts` and `src/middleware.ts` to route librarians to `/librarian/dashboard`.
  - Created all 11 pages under `src/app/(staff)/librarian/`: `home`, `dashboard`, `library-cards`, `books`, `inventory`, `records-returns`, `users`, `account-requests`, `announcements`, `calendar`, and `settings`.
  - Verified with `tsc --noEmit` (0 errors), `next build --webpack` (51/51 routes + Middleware), and live HTTP middleware redirect checks.
- **Relevant Files / Modules:** `src/app/(staff)/librarian/**/page.tsx`, `src/components/layout/{StaffSidebar,StaffTopbar,StaffShell}.tsx`, `src/components/admin/AdminResourceView.tsx`, `src/repositories/{index,account-requests}.ts`, `src/middleware.ts`, `src/app/api/auth/login/route.ts`, `MIGRATION.md`, `plan folder/INTEGRATION_PLAN.md`

#### 7. Phase 5 (Feature 5.1): Email Service & Password/PIN Reset Flows
- **Date:** November 21, 2026
- **Status:** Completed (Uncommitted in working tree)
- **Description:** Ported the Resend email helper and implemented self-service password and 6-digit security PIN reset flows backed by Supabase:
  - Created `src/lib/email/index.ts` supporting Resend HTTPS delivery with HTML templates (`sendPasswordResetEmail`, `sendPinResetEmail`, `sendOtpEmail`) and dev-mode logging fallback.
  - Added Zod discriminated-union validators (`resetPasswordRequestSchema`, `resetPinRequestSchema`) in `src/validators/auth.ts`.
  - Created `POST /api/auth/reset-password` and `POST /api/auth/reset-pin` with 30-minute crypto tokens, `bcryptjs` hashing, lockout clearing, audit logging, and error logging.
  - Created public pages `/reset-password` and `/reset-pin`, and added a "Forgot password?" link on `/login`.
- **Relevant Files / Modules:** `src/lib/email/index.ts`, `src/validators/auth.ts`, `src/app/api/auth/reset-password/route.ts`, `src/app/api/auth/reset-pin/route.ts`, `src/app/(public)/reset-password/page.tsx`, `src/app/(public)/reset-pin/page.tsx`, `src/app/(public)/login/page.tsx`, `MIGRATION.md`, `plan folder/INTEGRATION_PLAN.md`

#### 8. Phase 5 (Feature 5.2): QR Authentication Flow
- **Date:** November 21, 2026
- **Status:** Completed (Uncommitted in working tree)
- **Description:** Ported WhatsApp-style QR code authentication from legacy Flask to Next.js backed by Supabase `public.qr_login_tokens`:
  - Created `src/lib/auth/qr.ts` with 60-second URL-safe token generation, expiry cleanup, confirmation, and one-time session consumption.
  - Added Zod validation schemas (`qrPostSchema`, `qrCheckQuerySchema`) in `src/validators/auth.ts`.
  - Created `GET` / `POST` `/api/auth/qr` for token generation, polling, mobile approval (with audit logging), and HTTP-only `icpl_session` cookie issuance.
  - Wired `/scan-qr` (`src/app/(public)/scan-qr/page.tsx`) with both desktop QR display + 2-second polling and mobile `?token=` approval mode.
- **Relevant Files / Modules:** `src/lib/auth/qr.ts`, `src/validators/auth.ts`, `src/app/api/auth/qr/route.ts`, `src/app/(public)/scan-qr/page.tsx`, `MIGRATION.md`, `plan folder/INTEGRATION_PLAN.md`

#### 9. Phase 5 (Feature 5.3): File Uploads & Book Cover Thumbnails via Dropbox
- **Date:** November 21, 2026
- **Status:** Completed (Uncommitted in working tree)
- **Description:** Ported file uploads and book cover thumbnail serving to Next.js using the existing Dropbox OAuth refresh-token setup (per owner preference):
  - Created `src/lib/storage/dropbox.ts` (OAuth token refresh with in-memory caching, upload, download, and temporary link helpers).
  - Created `src/lib/storage/index.ts` and `src/lib/storage/thumbnail.ts` with 5 MB size limits, extension allowlists, and UUID filename generation compatible with `/cover/<name>`.
  - Added `GET /cover/[name]` (`src/app/cover/[name]/route.ts`), `POST /api/storage/upload` (`src/app/api/storage/upload/route.ts` with Zod + RBAC + audit logging), and `GET /api/admin/valid-id/[userId]` (`src/app/api/admin/valid-id/[userId]/route.ts`).
- **Relevant Files / Modules:** `src/lib/storage/{dropbox,index,thumbnail}.ts`, `src/app/cover/[name]/route.ts`, `src/app/api/storage/upload/route.ts`, `src/app/api/admin/valid-id/[userId]/route.ts`, `.env.example`, `MIGRATION.md`, `plan folder/INTEGRATION_PLAN.md`

#### 10. Phase 5 (Feature 5.4): Automated Backup Job (Supabase → Dropbox)
- **Date:** November 21, 2026
- **Status:** Completed (Uncommitted in working tree)
- **Description:** Implemented the automated and manual Supabase database backup job uploading gzip-compressed JSON snapshots to Dropbox and recording logs in `public.backup_logs`:
  - Created `src/lib/jobs/backup.ts` exporting all 16 core Supabase tables into a `.json.gz` snapshot, uploading to `DROPBOX_FOLDER`, and logging real byte sizes and status.
  - Created `GET` / `POST` `/api/backup` (`src/app/api/backup/route.ts`) supporting admin manual triggers, log listing, and `CRON_SECRET`-authenticated scheduled runs.
  - Wired `mutateSystemSettings` (`action: "run_backup"`) in `src/repositories/system-settings.ts` to execute the real Supabase → Dropbox backup.
  - Configured daily Vercel Cron (`0 2 * * *`) in `vercel.json` and documented `CRON_SECRET` in `.env.example`.
- **Relevant Files / Modules:** `src/lib/jobs/backup.ts`, `src/app/api/backup/route.ts`, `src/repositories/system-settings.ts`, `vercel.json`, `.env.example`, `MIGRATION.md`, `plan folder/INTEGRATION_PLAN.md`

#### 11. Phase 5 (Feature 5.5): Member Settings Page & User Settings API
- **Date:** November 21, 2026
- **Status:** Completed (Uncommitted in working tree)
- **Description:** Ported the member settings page and self-service profile/security/privacy endpoints backed by Supabase:
  - Created `src/validators/user.ts` with Zod discriminated-union schemas for profile updates, password changes, OTP/PIN toggles, account deactivation/deletion requests, and clearing search history/favorites.
  - Created `GET` / `PUT` `/api/user/settings` (`src/app/api/user/settings/route.ts`) with Fernet PII encryption, `bcryptjs` password verification/hashing, and audit logging.
  - Created `/user/settings` (`src/app/user/settings/page.tsx`) and added a Settings icon link in `src/components/layout/MemberShell.tsx`.
- **Relevant Files / Modules:** `src/validators/user.ts`, `src/app/api/user/settings/route.ts`, `src/app/user/settings/page.tsx`, `src/components/layout/MemberShell.tsx`, `MIGRATION.md`, `plan folder/INTEGRATION_PLAN.md`

#### 12. Phase 6: Final Verification & Standalone Next.js Cutover
- **Date:** November 21, 2026
- **Status:** Completed (Uncommitted in working tree; `legacy-flask/` retained per owner request)
- **Description:** Cut over the runtime to standalone Next.js + Supabase + Dropbox and ran end-to-end route and API verification:
  - Removed Flask bridge rewrites from `next.config.ts`, removed migration-only `flaskFetch` from `src/lib/api.ts`, cleaned up legacy proxy scripts in `package.json`, and removed `FLASK_BACKEND_URL` from `.env.example`.
  - Created automated route & API verifier `tests/integration/verify-routes.mjs` (`npm run verify:routes`).
  - Verified full build and checks: `tsc --noEmit` (0 errors), `next build --webpack` (**60/60 routes** + Middleware), and `npm run verify:routes` (**54 passed, 0 failed**).
  - Kept `legacy-flask/` intact per owner instruction.
- **Relevant Files / Modules:** `next.config.ts`, `src/lib/api.ts`, `package.json`, `.env.example`, `tests/integration/verify-routes.mjs`, `MIGRATION.md`, `plan folder/INTEGRATION_PLAN.md`

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

#### Commit `3ea17572a350dcf869c96a8e29e4add78173794c`
- **Date & Time:** `2026-11-21 19:05:56 +0800`
- **Author:** `antzyyy123`
- **Commit Hash:** `3ea17572a350dcf869c96a8e29e4add78173794c`
- **Commit Message:** `feat: complete Phases 4-6 (librarian module, auth/storage/backup/settings, standalone Next.js cutover)`
- **Explanation of Changes:** Committed all Phase 4 (11 librarian pages, role-aware staff navigation, librarian renewal RBAC), Phase 5 (Resend email helper, password & PIN reset pages/APIs, QR login flow, Dropbox upload & `/cover/[name]` serving, Supabase → Dropbox backup job & Vercel Cron, `/user/settings` & `/api/user/settings`), and Phase 6 (removed Flask rewrites/bridge, added `tests/integration/verify-routes.mjs`) implementations and documentation updates.
- **Files / Modules Affected:**
  - Added: `AGENTS.md`, `src/app/(staff)/librarian/**/page.tsx` (11 pages), `src/app/(public)/{reset-password,reset-pin}/page.tsx`, `src/app/user/settings/page.tsx`, `src/app/cover/[name]/route.ts`, `src/app/api/{admin/valid-id/[userId],auth/qr,auth/reset-password,auth/reset-pin,backup,storage/upload,user/settings}/route.ts`, `src/lib/{auth/qr,email/index,jobs/backup,storage/dropbox,storage/index,storage/thumbnail}.ts`, `src/validators/user.ts`, `tests/integration/verify-routes.mjs`
  - Modified: `.env.example`, `MIGRATION.md`, `next.config.ts`, `package.json`, `plan folder/INTEGRATION_PLAN.md`, `src/app/(public)/{login,scan-qr}/page.tsx`, `src/app/api/auth/login/route.ts`, `src/components/admin/AdminResourceView.tsx`, `src/components/layout/{MemberShell,StaffShell,StaffSidebar,StaffTopbar}.tsx`, `src/lib/api.ts`, `src/middleware.ts`, `src/repositories/{account-requests,index,system-settings}.ts`, `src/validators/auth.ts`, `timeline.md`, `vercel.json`

---

## Ongoing Activities

- None — all Phase 1 through Phase 6 changes are committed cleanly on branch `tony@dev`.

---

## Planned Activities

- **Optional Legacy Cleanup:** Delete `legacy-flask/` (`git rm -rf legacy-flask`) once the owner completes final manual review and no longer needs the Flask reference folder.

---

## Documentation Guidelines
- Maintain chronological order, newest activities last.
- Use clear, simple, and professional technical language.
- Keep descriptions concise but informative.
- Update this file whenever a new activity is performed or a Git commit is made.
- Never delete historical records unless explicitly instructed.
- Avoid duplicate entries.
- Preserve previously documented information when updating the file.
