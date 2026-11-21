# Project Development Timeline

## Project Information
- **Project Name:** Iloilo Public Library Management System (`library-management-system-v3`)
- **Active Git Branch:** `tony@dev`
- **Documentation Start Date:** November 21, 2026
- **Stack:** Next.js App Router (TypeScript) + Supabase PostgreSQL + Dropbox Storage + Resend Email
- **Purpose of This Document:** Official chronological record of development activities, architectural decisions, verification milestones, and verified Git commits starting November 21, 2026.

---

## Executive Milestone Summary

| Phase | Scope | Status | Commit |
|---|---|---|---|
| **Phase 1** | Pre-migration cleanup, `.gitignore` updates, `pre-migration` baseline tag | Completed | `b3f42cb` |
| **Phase 2** | Move Flask to `legacy-flask/`, merge `public/` assets, reorganize `src/` & `repositories/` | Completed | `7701fea` |
| **Phase 3 & 3.5** | Layered skeleton (`config`, `services`, `validators`, `middleware`, `rbac`, `audit`), Supabase source-of-truth confirmation, MySQL script removal | Completed | `7701fea` |
| **Phase 4** | Port all 11 Librarian pages, role-aware staff navigation, and librarian renewal RBAC | Completed | `3ea1757` |
| **Phase 5** | Email (Resend), Password/PIN reset, QR login, Dropbox uploads & `/cover/[name]`, Supabase → Dropbox backup job & cron, `/user/settings` | Completed | `3ea1757` |
| **Phase 6** | Remove Flask bridge/rewrites, add route verification suite (`54/54` passed), standalone Next.js cutover (`legacy-flask/` retained per owner request) | Completed | `3ea1757` |
| **Phase 7** | IT Head schema audit & normalization (`book_copies`, high-scale B-Tree + `pg_trgm` GIN indexes), UI upgrades (`/browse`, `/login`, `SignupWizard`), legacy content parity, and 100% `MIGRATION.md` API completion (Member, MFA/CAPTCHA, Staff Utility APIs) | Completed | `92845ef`, `6450e65`, `1a7fb3f` |

---

## Development Activities

### November 21, 2026

#### 1. Phase 1 — Pre-Migration Cleanup & Baseline Tagging
- **Date:** November 21, 2026 | **Status:** Completed
- **Summary:** Removed tracked Python `.pyc` cache files and `tsconfig.tsbuildinfo`, updated `.gitignore`, added `plan folder/INTEGRATION_PLAN.md`, and tagged the `pre-migration` baseline.
- **Key Files:** `.gitignore`, `package-lock.json`, `plan folder/INTEGRATION_PLAN.md`

#### 2. Phase 2 — Repository Restructure & Layered Layout
- **Date:** November 21, 2026 | **Status:** Completed
- **Summary:** Isolated legacy Flask under `legacy-flask/`, merged static images and `brain.glb` into `public/`, moved utility scripts to `scripts/`, grouped Next.js routes into `(public)` and `(staff)`, split admin data access into `src/repositories/`, created skeleton folders (`config/`, `services/`, `validators/`, `tests/`, `docs/`), and initialized `MIGRATION.md`. Passed all Phase 2 build, lint, and route checks.
- **Key Files:** `legacy-flask/**`, `public/**`, `scripts/*`, `src/app/(public)/**`, `src/app/(staff)/**`, `src/repositories/*`, `src/lib/audit/error-logger.ts`, `MIGRATION.md`

#### 3. Phase 3 & 3.5 — Core Architecture Skeleton & Database Decision
- **Date:** November 21, 2026 | **Status:** Completed
- **Summary:** Confirmed Supabase PostgreSQL as the single source of truth (no MySQL migration needed), removed legacy MySQL scripts, and updated `README.md`. Installed `zod` and implemented `src/config/{env,constants}.ts`, `src/lib/{errors,logger}.ts`, `src/lib/auth/rbac.ts`, Edge `src/middleware.ts`, Zod validators (`src/validators/{common,auth,admin}.ts`), `src/services/admin.service.ts`, `src/lib/audit/audit-logger.ts`, and the temporary Flask `/api/health` bridge. Removed temporary Supabase quickstart files and `server.js`.
- **Key Files:** `src/config/*`, `src/lib/{errors,logger}.ts`, `src/lib/auth/rbac.ts`, `src/middleware.ts`, `src/validators/*`, `src/services/admin.service.ts`, `src/lib/audit/audit-logger.ts`, `src/app/api/admin/data/route.ts`, `README.md`

#### 4. Project Activity & Commit Timeline Setup
- **Date:** November 21, 2026 | **Status:** Completed
- **Summary:** Audited the repository structure, working tree, and Git history from November 21, 2026 onward to establish `timeline.md`.
- **Key Files:** `timeline.md`

#### 5. Phase 4 — Librarian Module (11 Pages, Navigation & RBAC)
- **Date:** November 21, 2026 | **Status:** Completed
- **Summary:** Ported all 11 librarian views (`home`, `dashboard`, `library-cards`, `books`, `inventory`, `records-returns`, `users`, `account-requests`, `announcements`, `calendar`, `settings`) to `src/app/(staff)/librarian/`. Added `LIBRARIAN_NAV` to `StaffSidebar`, role-aware links to `StaffTopbar`/`StaffShell`, read-only patron viewing and renewal-only request filtering in `AdminResourceView`, renewal RBAC in `src/repositories/account-requests.ts`, and librarian login/middleware redirects to `/librarian/dashboard`.
- **Key Files:** `src/app/(staff)/librarian/**/page.tsx`, `src/components/layout/{StaffSidebar,StaffTopbar,StaffShell}.tsx`, `src/components/admin/AdminResourceView.tsx`, `src/repositories/{index,account-requests}.ts`, `src/middleware.ts`, `src/app/api/auth/login/route.ts`

#### 6. Phase 5 — Remaining Core Features (Features 5.1 – 5.5)
- **Date:** November 21, 2026 | **Status:** Completed
- **Summary:**
  - **5.1 Email & Password/PIN Reset:** Added Resend HTTPS helper (`src/lib/email/index.ts`), `POST /api/auth/reset-password`, `POST /api/auth/reset-pin`, public `/reset-password` and `/reset-pin` pages, and a "Forgot password?" link on `/login`.
  - **5.2 QR Authentication:** Added `src/lib/auth/qr.ts` and `GET`/`POST /api/auth/qr` backed by Supabase `qr_login_tokens`, and wired `/scan-qr` for desktop QR polling and mobile approval.
  - **5.3 Dropbox Storage & Thumbnails:** Preserved Dropbox per owner preference; built `src/lib/storage/{dropbox,index,thumbnail}.ts`, `GET /cover/[name]`, `POST /api/storage/upload`, and `GET /api/admin/valid-id/[userId]`.
  - **5.4 Automated Backup Job:** Built `src/lib/jobs/backup.ts` and `GET`/`POST /api/backup` exporting all 16 core Supabase tables as `.json.gz` snapshots to Dropbox, wired `/system-settings` manual backups, and added daily Vercel Cron (`0 2 * * *`) in `vercel.json`.
  - **5.5 Member Settings:** Added `src/validators/user.ts`, `GET`/`PUT /api/user/settings`, `/user/settings` page, and Settings link in `MemberShell`.
- **Key Files:** `src/lib/{email/index,auth/qr,storage/*,jobs/backup}.ts`, `src/app/api/{auth/reset-password,auth/reset-pin,auth/qr,storage/upload,admin/valid-id/[userId],backup,user/settings}/route.ts`, `src/app/cover/[name]/route.ts`, `src/app/(public)/{reset-password,reset-pin,scan-qr}/page.tsx`, `src/app/user/settings/page.tsx`, `src/validators/{auth,user}.ts`, `vercel.json`

#### 7. Phase 6 — Final Verification & Standalone Next.js Cutover
- **Date:** November 21, 2026 | **Status:** Completed (`legacy-flask/` kept archived per owner request)
- **Summary:** Removed Flask rewrites from `next.config.ts`, removed `flaskFetch` from `src/lib/api.ts`, removed legacy proxy scripts from `package.json` and `FLASK_BACKEND_URL` from `.env.example`, and added `tests/integration/verify-routes.mjs` (`npm run verify:routes`). Verified `tsc --noEmit` (0 errors), `next build --webpack` (60/60 routes + Middleware), and `npm run verify:routes` (54/54 passed, 0 failed).
- **Key Files:** `next.config.ts`, `src/lib/api.ts`, `package.json`, `.env.example`, `tests/integration/verify-routes.mjs`, `MIGRATION.md`, `plan folder/INTEGRATION_PLAN.md`

#### 8. Restore Legacy "About Us" Content (Public & Member Sides)
- **Date:** November 21, 2026 | **Status:** Completed (`e8d317c`)
- **Summary:** Restored the verbatim legacy Flask About Us content (Who We Are, Legal Mandate RA 7743, Vision, Mission & 5-item Quality Policy, 9 Core Values, 8 Library Sections, 15 General Guidelines, 3 Fines & Penalties cards, Main Library + 10 District & Community Branches, Find Us Google Maps iframe & contact details, and S+ Premium 6-member Dev Team) into the existing Next.js design via `AboutUsContent.tsx`. Wired `/no_user_about`, added member-protected `/user/about` with `MemberShell` navigation, and restored exact legacy wording in `VisionMissionSection.tsx` and `ServicesSection.tsx`.
- **Key Files:** `src/components/landing/AboutUsContent.tsx`, `src/app/(public)/no_user_about/page.tsx`, `src/app/user/about/page.tsx`, `src/components/layout/MemberShell.tsx`, `src/components/landing/{VisionMissionSection,ServicesSection}.tsx`, `tests/integration/verify-routes.mjs`, `MIGRATION.md`

#### 9. Restore Legacy Admin Layout Content (Sidebar, Topbar & Footer)
- **Date:** November 21, 2026 | **Status:** Completed (`6450e65`)
- **Summary:** Restored legacy Flask admin sidebar structure, order, labels, and collapsible groups (`Main`: Home, Dashboard, Announcement; `Management`: User Management [Admins, Librarians, Users / Members], Borrow Management [Borrowing Form, Borrow History], Book Management, divider, Event Calendar, Account Requests; sidebar footer: System Settings + Admin / Account settings + Logout), restored admin topbar items (`Iloilo City Library`, `Account Requests` bell, `Event Calendar`, keeping `ThemeToggle`, `System Settings`, and `Logout`), and added `AdminFooter.tsx` (CTA band, 4-column grid, partners belt, legal modals) rendered for `role="admin"` only in `StaffShell.tsx` and `dashboard/page.tsx`. Librarian layout (`LIBRARIAN_NAV` and `role="librarian"`) left untouched.
- **Key Files:** `src/components/layout/{StaffSidebar,StaffTopbar,StaffShell,AdminFooter}.tsx`, `src/app/(staff)/dashboard/page.tsx`, `MIGRATION.md`, `timeline.md`

#### 10. Restore Legacy Admin Settings & System Settings Content
- **Date:** November 21, 2026 | **Status:** Completed (`6450e65`)
- **Summary:** Restored verbatim legacy Flask sections, tabs, field labels, order, help texts, button labels, password strength checklist, and emergency lockdown confirmation modal into `src/app/(staff)/admin-settings/page.tsx` (Overview, Personal Details [Profile Info + Contact], Password & Security [MFA + Change Password], Appearance) and `src/app/(staff)/system-settings/page.tsx` (Maintenance, Emergency, Backup tabs) while preserving existing Next.js design, save logic, Zod validation, RBAC, and audit logging. Controls without a Next.js backend (Interface Language, System Files backup scope, Clear Log History, Notify admin after backup, Recent Lockdown Events history) are clearly marked `"Not available yet"` and disabled. Librarian settings left untouched.
- **Key Files:** `src/app/(staff)/admin-settings/page.tsx`, `src/app/(staff)/system-settings/page.tsx`, `MIGRATION.md`, `timeline.md`

#### 10B. Database Schema Normalization, Copy-Level Inventory & Civic UI Upgrades
- **Date:** November 21, 2026 | **Status:** Completed (`92845ef`, merged `cb4b99f` & `05baf45`)
- **Summary:** Addressed IT Head schema review findings by creating `004_schema_normalization.sql`: added physical copy-level tracking (`public.book_copies` with unique `accession_number`, `condition`, `circulation_status`, and `condition_notes`), independent sorting/filtering by Available Copies, Damaged Copies, and Condition in `/admin/inventory` and `/admin/books`, high-scale B-Tree + PostgreSQL `pg_trgm` GIN indexes across books, users, library cards, and circulation tables for 1M+ row readiness, and missing FK constraints. Upgraded `/browse` search & collection popover, converted `/login` to a full-viewport civic split-screen with auto-flicker desk lamp and official Iloilo City Government typography, and compacted the 3-step `SignupWizard`.
- **Key Files:** `supabase/migrations/{001_initial_schema,002_seed_data,004_schema_normalization}.sql`, `src/repositories/{inventory,books,users,admin-profile,library-cards}.ts`, `src/components/admin/{AdminResourceView,AdminActionModals}.tsx`, `src/app/(public)/{browse,login}/page.tsx`, `src/components/auth/SignupWizard.tsx`

#### 11. Member / Patron APIs & Live Member Views
- **Date:** November 21, 2026 | **Status:** Completed (`Neil` branch)
- **Summary:** Built dedicated Zod-validated, session-scoped member APIs (`/api/user/borrowed-books`, `/api/user/return-history`, `/api/user/renew`, `/api/user/favorites`, `/api/user/search-history`, `/api/user/notifications`) backed by `src/repositories/member.ts`, cleaned up obsolete blind-index writes in `/api/user/settings`, and wired `/user/borrowed`, `/user/borrow-history`, `/user/notifications`, and `/user/browse` (with favorites toggle & debounced search history) to live Supabase endpoints.
- **Key Files:** `src/repositories/member.ts`, `src/validators/user.ts`, `src/app/api/user/{borrowed-books,return-history,renew,favorites,search-history,notifications,settings}/route.ts`, `src/app/user/{borrowed,borrow-history,notifications,browse}/page.tsx`, `MIGRATION.md`, `timeline.md`

#### 12. Auth MFA & CAPTCHA APIs
- **Date:** November 21, 2026 | **Status:** Completed (`Neil` branch)
- **Summary:** Implemented stateless HMAC-signed arithmetic CAPTCHA (`GET`/`POST /api/auth/verify-captcha`), bcrypt-verified OTP & PIN validation (`POST /api/auth/verify-otp`, `POST /api/auth/verify-pin`), and 6-digit OTP generation/delivery via Resend (`POST /api/auth/resend-otp`), all Zod-validated and audit-logged.
- **Key Files:** `src/validators/auth.ts`, `src/app/api/auth/{verify-captcha,verify-otp,verify-pin,resend-otp}/route.ts`, `MIGRATION.md`, `timeline.md`

#### 13. Staff Utility APIs (`/api/staff/appearance` & `/api/admin/users`)
- **Date:** November 21, 2026 | **Status:** Completed (`Neil` branch)
- **Summary:** Implemented staff appearance preference persistence (`GET`/`PUT /api/staff/appearance` with `user_preferences` + `staff_appearance` compatibility) and RBAC-protected server-side user/member search & detail lookup (`GET /api/admin/users?q=&role=&id=`), validated with Zod and audit-logged.
- **Key Files:** `src/validators/admin.ts`, `src/app/api/staff/appearance/route.ts`, `src/app/api/admin/users/route.ts`, `MIGRATION.md`, `timeline.md`

#### 14. Final Helper Parity Audit & 100% Migration Table Completion
- **Date:** November 21, 2026 | **Status:** Completed (`Neil` branch)
- **Summary:** Audited all remaining helper, session, error-handling, cron job, and frontend JS parity items (`fernet.ts`, `utils.ts`, `session.ts`, `middleware.ts`, `errors.ts`, `error.tsx`, `error-logger.ts`, `backup.ts`, `vercel.json`, `theme-provider.tsx`) and marked every row in `MIGRATION.md` as `Done in Next.js` (0 `Not started` items remaining).
- **Key Files:** `MIGRATION.md`, `timeline.md`

---

## Git Commit History

### November 21, 2026

| Time (+0800) | Commit | Author | Message & Scope |
|---|---|---|---|
| `09:45:53` | `b3f42cb` (`b3f42cbb09848c71dc29ff6ae881d01253537a9f`) | `antzyyy123` | `chore: pre-migration cleanup, ignore generated files` — Untracked `.pyc` and `tsconfig.tsbuildinfo`; updated `.gitignore` & `package-lock.json`; added `INTEGRATION_PLAN.md`. |
| `13:45:58` | `7701fea` (`7701fea211b584b5d7c51c89ddd92fff3098c167`) | `antzyyy123` | `feat: complete Phase 2 restructure and Phase 3 layered architecture skeleton` — Moved Flask to `legacy-flask/`, consolidated `public/`, split `src/repositories/`, added `config/`, `services/`, `validators/`, `middleware.ts`, `rbac.ts`, `audit-logger.ts`, `MIGRATION.md`, and `timeline.md`. |
| `13:47:48` | `9576691` (`9576691c482895454c1c5b9df1e5f405d72241bf`) | `antzyyy123` | `docs: record Phase 2 and Phase 3 commit in timeline.md` — Logged commit `7701fea` in `timeline.md`. |
| `19:05:56` | `3ea1757` (`3ea17572a350dcf869c96a8e29e4add78173794c`) | `antzyyy123` | `feat: complete Phases 4-6 (librarian module, auth/storage/backup/settings, standalone Next.js cutover)` — Added 11 librarian pages, email + password/PIN reset, QR auth, Dropbox storage + `/cover/[name]`, Supabase → Dropbox backup + cron, `/user/settings`, route verification script, and removed Flask bridge (52 files). |
| `19:06:48` | `64af6f5` (`64af6f50e819ca526536cf86b401579ca7f9a0a8`) | `antzyyy123` | `docs: record Phase 4-6 commit in timeline.md` — Logged commit `3ea1757` in `timeline.md`. |
| `19:30:38` | `92845ef` (`92845ef8f2fd738286c4a8d4cfc356dac7b8aa39`) | `Neil Mar De Asis` | `feat: improve browse search, split-screen login, and schema normalization with copy-level inventory` — Added `004_schema_normalization.sql` (`book_copies`, B-Tree + `pg_trgm` GIN indexes, FKs), inventory condition sorting/filtering, `/browse` popover search, civic split-screen `/login`, and compact `SignupWizard`. |
| `19:39:02` | `cb4b99f` (`cb4b99f842405a0a8ca861979e11266bbe32587c`) | `Neil Mar De Asis` | `Merge remote-tracking branch 'origin/tony@dev' into Neil` — Integrated Phase 2–3 layered repository restructure and ported copy-level inventory & selective encryption updates into `src/repositories/*`. |
| `19:39:33` | `e8d317c` (`e8d317c71692804319b6ec58f13e7467d7a20543`) | `antzyyy123` | `content: restore old About Us content (landing and member side)` — Restored legacy About Us content (`AboutUsContent.tsx`, `/no_user_about`, `/user/about`). |
| `20:04:32` | `6450e65` (`6450e6526d499dc0ddc5305fdeb5f33902d6349e`) | `antzyyy123` | `content: restore legacy admin layout, admin settings, and system settings` — Restored legacy admin sidebar/topbar/footer and settings tabs. |
| `20:08:10` | `05baf45` (`05baf45cdc56c7ff84e27079519947391820d36d`) | `Neil Mar De Asis` | `Merge branch 'tony@dev' into Neil` — Integrated Phases 4–6 and legacy content restorations while preserving split-screen `/login` + Forgot Password link. |
| `23:44:40` | `1a7fb3f` (`1a7fb3f25be1c977d03c5559f33a5e9dd28bfa05`) | `Neil Mar De Asis` | `feat: complete remaining member, auth MFA/CAPTCHA, and staff utility APIs (100% MIGRATION.md)` — Implemented all remaining Member APIs (`/api/user/*` + `member.ts`), Auth MFA/CAPTCHA APIs (`/api/auth/{verify-captcha,verify-otp,verify-pin,resend-otp}`), Staff Utility APIs (`/api/staff/appearance`, `/api/admin/users`), and completed 100% of `MIGRATION.md`. |

---

## Ongoing Activities

- None — Phases 1 through 7 and 100% of the `MIGRATION.md` Flask-to-Next.js migration table are complete and verified (`tsc --noEmit`: 0 errors).

---

## Pre-Production / City Hall Hosting Checklist

- **Run Database Migration 004 in Supabase:** Execute `supabase/migrations/004_schema_normalization.sql` in the Supabase SQL Editor to create `public.book_copies`, add B-Tree + `pg_trgm` GIN indexes for 1M+ row scale, and enforce foreign-key constraints.
- **Configure Hosting Environment Variables:** Set `SUPABASE_*`, `SECRET_KEY`, `DROPBOX_*`, `RESEND_API_KEY`, `RESEND_FROM`, and `CRON_SECRET` in Vercel / City Hall hosting settings (see `.env.example`).
- **Owner Security Cleanup (Phase 1 Holdover):** Rotate and remove previously tracked sensitive files (`cert.pem`, `key.pem`, `backup_2026-05-30_13-59-59.zip.enc`, `restore/`, `valid_id_vault/`) from Git history/index by hand.
- **Optional Legacy Archive Removal:** Delete `legacy-flask/` (`git rm -rf legacy-flask`) once final manual review by City Hall IT is complete.

---

## Documentation Guidelines
- Maintain chronological order, newest activities last.
- Use clear, simple, and professional technical language.
- Keep descriptions concise but informative.
- Update this file whenever a new activity is performed or a Git commit is made.
- Never delete historical records unless explicitly instructed.
- Avoid duplicate entries.
- Preserve previously documented information when updating the file.
