# Project Development Timeline

- **Project:** Iloilo Public Library Management System (`library-management-system-v3`)
- **Start Date:** November 21, 2026
- **Stack:** Next.js App Router (TypeScript), Supabase PostgreSQL, Dropbox Storage, Resend Email

## Branch: tony@dev

**Author:** `antzyyy123`

### Activities Completed

#### November 21, 2026
- Cleaned up tracked `.pyc` and `tsconfig.tsbuildinfo` files, updated `.gitignore`, added `INTEGRATION_PLAN.md`, and tagged the `pre-migration` baseline. (`b3f42cb`)
- Restructured the repository by moving Flask to `legacy-flask/`, consolidating `public/` assets, grouping Next.js routes, and splitting data access into `src/repositories/`. (`7701fea`)
- Built the layered architecture (`config`, `services`, `validators`, `middleware`, `rbac`, `audit`), confirmed Supabase PostgreSQL as the single source of truth, removed legacy MySQL scripts, and set up `timeline.md`. (`7701fea`, `9576691`, `64af6f5`)
- Ported all 11 Librarian pages with role-aware staff navigation and renewal-only RBAC. (`3ea1757`)
- Added Resend email, password/PIN reset, QR login, Dropbox uploads and `/cover/[name]`, automated Supabase-to-Dropbox backups with daily cron, and `/user/settings`. (`3ea1757`)
- Removed the Flask bridge and rewrites, added the 54-route verification suite, and completed the standalone Next.js cutover while keeping `legacy-flask/` archived. (`3ea1757`)
- Restored the legacy About Us content on public and member pages, along with the legacy admin sidebar, topbar, footer, Admin Settings, and System Settings. (`e8d317c`, `6450e65`)

### Git Commit History

| Date | Time | Commit | Message |
|---|---|---|---|
| 2026-11-21 | 09:45:53 +0800 | `b3f42cb` | `chore: pre-migration cleanup, ignore generated files` |
| 2026-11-21 | 13:45:58 +0800 | `7701fea` | `feat: complete Phase 2 restructure and Phase 3 layered architecture skeleton` |
| 2026-11-21 | 13:47:48 +0800 | `9576691` | `docs: record Phase 2 and Phase 3 commit in timeline.md` |
| 2026-11-21 | 19:05:56 +0800 | `3ea1757` | `feat: complete Phases 4-6 (librarian module, auth/storage/backup/settings, standalone Next.js cutover)` |
| 2026-11-21 | 19:06:48 +0800 | `64af6f5` | `docs: record Phase 4-6 commit in timeline.md` |
| 2026-11-21 | 19:39:33 +0800 | `e8d317c` | `content: restore old About Us content (landing and member side)` |
| 2026-11-21 | 20:04:32 +0800 | `6450e65` | `content: restore legacy admin layout, admin settings, and system settings` |




















===============================================================================================
## Branch: Neil

**Author:** `Neil Mar De Asis`

### Activities Completed

#### November 21, 2026
- Normalized the database schema (`004_schema_normalization.sql`) with copy-level inventory (`book_copies`), condition filtering, B-Tree and `pg_trgm` GIN indexes, and missing foreign keys. (`92845ef`)
- Upgraded `/browse` search, converted `/login` to a civic split-screen layout, and compacted the 3-step `SignupWizard`. (`92845ef`)
- Merged `tony@dev` updates into `Neil` while preserving copy-level inventory, selective encryption, and the split-screen `/login` page. (`cb4b99f`, `05baf45`)
- Built live Member APIs (`/api/user/*`), Auth MFA and CAPTCHA APIs (`/api/auth/verify-*`, `resend-otp`), and Staff Utility APIs (`/api/staff/appearance`, `/api/admin/users`). (`1a7fb3f`)
- Completed the final helper parity audit and marked 100% of `MIGRATION.md` as done in Next.js. (`1a7fb3f`)

### Git Commit History

| Date | Time | Commit | Message |
|---|---|---|---|
| 2026-11-21 | 19:30:38 +0800 | `92845ef` | `feat: improve browse search, split-screen login, and schema normalization with copy-level inventory` |
| 2026-11-21 | 19:39:02 +0800 | `cb4b99f` | `Merge remote-tracking branch 'origin/tony@dev' into Neil` |
| 2026-11-21 | 20:08:10 +0800 | `05baf45` | `Merge branch 'tony@dev' into Neil` |
| 2026-11-21 | 23:44:40 +0800 | `1a7fb3f` | `feat: complete remaining member, auth MFA/CAPTCHA, and staff utility APIs (100% MIGRATION.md)` |


















=================================================================================================

## Ongoing Activities
- **tony@dev:** None.
- **Neil:** None.

## Pre-Production Checklist
- Run `supabase/migrations/004_schema_normalization.sql` in Supabase to create `book_copies`, indexes, and foreign-key constraints.
- Set `SUPABASE_*`, `SECRET_KEY`, `DROPBOX_*`, `RESEND_API_KEY`, `RESEND_FROM`, and `CRON_SECRET` in hosting environment variables.
- Rotate and remove previously tracked sensitive files (`cert.pem`, `key.pem`, `backup_2026-05-30_13-59-59.zip.enc`, `restore/`, `valid_id_vault/`) from Git history.
- Optionally remove `legacy-flask/` (`git rm -rf legacy-flask`) after final City Hall IT review.

## Documentation Guidelines
- Keep entries in chronological order, newest last.
- Update this file on every completed activity or Git commit.
- Never delete historical records unless explicitly instructed.
- Avoid duplicate entries.
