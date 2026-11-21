# MIGRATION.md

Tracking migration of the Iloilo Public Library system from **Flask + Jinja** (`legacy-flask/`) to **Next.js App Router + TypeScript** (`src/`).

## Phase 2 Restructure Status
- [x] Step 0: Pre-checks (`pre-migration` tag, clean tree, `git mv` verified)
- [x] Step 1: Moved Flask app into `legacy-flask/`
- [x] Step 2: Merged static images and `brain.glb` into `public/` and updated `src/` references
- [x] Step 3: Moved `useful_tools(just in case)/` to `scripts/`
- [x] Step 4: Reorganized `src/` into `(public)`, `(staff)`, `src/repositories/`, and `src/lib/audit/`
- [x] Step 5: Created empty skeleton folders (`config/`, `services/`, `validators/`, `tests/*`, `docs/`)
- [x] Step 6: Created `MIGRATION.md`
- [x] Step 7: Updated `.gitignore`
- [x] Gate checks (1–5) — passed (`next build --webpack` 40/40 routes, `tsc --noEmit` 0 errors, `npm run lint` unchanged from baseline, Flask booted in `legacy-flask/`, 30/30 HTTP 200 route checks, `git status` clean of unintended changes)

## Phase 3 Skeleton Status
- [x] Step 0: Discovery complete (auth/session, roles, bcrypt compatibility, MySQL vs Supabase)
- [x] Step 1: Added `zod`, `src/config/{env,constants}.ts`, `src/lib/{errors,logger}.ts`
- [x] Step 2: Added `src/lib/auth/rbac.ts` and Edge-compatible `src/middleware.ts`
- [x] Step 3: Added Zod validators in `src/validators/{common,auth,admin}.ts`
- [x] Step 4: Added `src/services/admin.service.ts`, `src/lib/audit/audit-logger.ts`, wired `src/app/api/admin/data/route.ts`
- [x] Step 5: Removed temporary `src/utils/supabase/` and `src/app/(public)/supabase-test/` quickstart files
- [x] Step 6: Added `legacy-flask/api/health.py` (`GET /api/health` only), `/flask/:path*` rewrite in `next.config.ts`, and `flaskFetch` in `src/lib/api.ts`
- [x] Step 7: Removed `legacy-flask/server.js`
- [x] Step 8: Gate checks passed (`tsc --noEmit` 0 errors, `next build --webpack` 40/40 routes + Middleware, Flask `/api/health` 200, Next.js `/flask/health` 200, middleware 307 redirects on protected routes, API validation 400 & RBAC 401)

---

## Flask to Next.js Migration Table

> **Statuses:** `Done in Next.js` (matching page or route already exists in `src/`) | `Not started`

### Public & Landing Routes / Templates

| Flask item | Type (page/api/helper/job) | Target in Next.js | Status |
|---|---|---|---|
| `landing/no_user_routes.py` — `/` | page | `src/app/(public)/page.tsx` | Done in Next.js |
| `landing/no_user_routes.py` — `/no_user_about` | page | `src/app/(public)/no_user_about/page.tsx` | Done in Next.js |
| `landing/no_user_routes.py` — `/browse` | page | `src/app/(public)/browse/page.tsx` | Done in Next.js |
| `landing/no_user_routes.py` — `/api/public/books` | api | `src/app/api/public/books/route.ts` | Done in Next.js |
| `templates/homepage.html` | page | `src/app/(public)/page.tsx` | Done in Next.js |
| `templates/aboutus.html` | page | `src/app/(public)/no_user_about/page.tsx` | Done in Next.js |
| `templates/books.html` | page | `src/app/(public)/browse/page.tsx` | Done in Next.js |
| `templates/maintenance.html` | page | `src/app/(public)/maintenance/page.tsx` | Done in Next.js |
| `templates/error.html` | page | `src/app/error.tsx`, `src/app/not-found.tsx` | Done in Next.js |
| `templates/template.html` | page | `src/app/layout.tsx` | Done in Next.js |

### Authentication, MFA, Password/PIN Reset & QR Auth

| Flask item | Type (page/api/helper/job) | Target in Next.js | Status |
|---|---|---|---|
| `authentication/authentication.py` — `/login` (GET) | page | `src/app/(public)/login/page.tsx` | Done in Next.js |
| `authentication/authentication.py` — `/login` (POST) | api | `src/app/api/auth/login/route.ts` | Done in Next.js |
| `authentication/authentication.py` — `/signup` | api | `src/app/api/auth/signup/route.ts` | Done in Next.js |
| `authentication/authentication.py` — `/api/check_email` | api | `src/app/api/check_email/route.ts` | Done in Next.js |
| `authentication/authentication.py` — `/logout` | api | `src/app/logout/route.ts` | Done in Next.js |
| `authentication/authentication.py` — `/home` | page | `src/app/(public)/page.tsx` (role redirect) | Done in Next.js |
| `authentication/authentication.py` — `/verify_captcha` | api | `src/app/api/auth/verify-captcha/route.ts` | Not started |
| `authentication/authentication.py` — `/verify_otp` | api | `src/app/api/auth/verify-otp/route.ts` | Not started |
| `authentication/authentication.py` — `/verify_pin` | api | `src/app/api/auth/verify-pin/route.ts` | Not started |
| `authentication/authentication.py` — `/resend_otp` | api | `src/app/api/auth/resend-otp/route.ts` | Not started |
| `authentication/authentication.py` — `/forgot_password` | api | `src/app/api/auth/reset-password/route.ts` | Not started |
| `authentication/authentication.py` — `/reset_password/<token>` & `/reset_password` | page / api | `src/app/(public)/reset-password/page.tsx`, `src/app/api/auth/reset-password/route.ts` | Not started |
| `templates/reset_password.html` | page | `src/app/(public)/reset-password/page.tsx` | Not started |
| `authentication/authentication.py` — `/reset-pin/<token>` & `/reset-pin` | page / api | `src/app/(public)/reset-pin/page.tsx`, `src/app/api/auth/reset-pin/route.ts` | Not started |
| `authentication/authentication.py` — `/forgot_pin/verify_password`, `/forgot_pin/verify_otp`, `/forgot_pin/set_new` | api | `src/app/api/auth/reset-pin/route.ts` | Not started |
| `templates/reset_pin.html` | page | `src/app/(public)/reset-pin/page.tsx` | Not started |
| `authentication/qr_auth.py` — `/scan-qr` | page | `src/app/(public)/scan-qr/page.tsx` | Done in Next.js |
| `templates/scan_qr.html` | page | `src/app/(public)/scan-qr/page.tsx` | Done in Next.js |
| `authentication/qr_auth.py` — `/qr/generate`, `/qr/check/<token>`, `/qr/confirm` | api | `src/lib/auth/qr.ts`, `src/app/api/auth/qr/route.ts` | Not started |

### Admin Pages, Templates & APIs

| Flask item | Type (page/api/helper/job) | Target in Next.js | Status |
|---|---|---|---|
| `routes/admin_routes.py` — `/admin/home` (`templates/admins/admin_home.html`) | page | `src/app/(staff)/admin/home/page.tsx` | Done in Next.js |
| `routes/admin_routes.py` — `/dashboard` (`templates/admins/dashboard.html`) | page | `src/app/(staff)/dashboard/page.tsx` | Done in Next.js |
| `routes/admin_routes.py` — `/dashboard/stats` | api | `src/app/api/dashboard/stats/route.ts` | Done in Next.js |
| `routes/admin_routes.py` — `/admin/inventory` | page | `src/app/(staff)/admin/inventory/page.tsx` | Done in Next.js |
| `routes/admin_routes.py` — `/book_management` (`templates/admins/book_management.html`) | page | `src/app/(staff)/admin/books/page.tsx` | Done in Next.js |
| `routes/admin_routes.py` — `/admin_management` (`templates/admins/admin_management.html`) | page | `src/app/(staff)/admin/admins/page.tsx` | Done in Next.js |
| `routes/admin_routes.py` — `/librarian_management` (`templates/admins/librarian_management.html`) | page | `src/app/(staff)/admin/librarians/page.tsx` | Done in Next.js |
| `routes/admin_routes.py` — `/user_management` (`templates/admins/user_management.html`) | page | `src/app/(staff)/admin/users/page.tsx` | Done in Next.js |
| `routes/admin_routes.py` — `/admin/announcements` (`templates/admins/announcement.html`) | page | `src/app/(staff)/admin/announcements/page.tsx` | Done in Next.js |
| `routes/admin_routes.py` — `/admin/account-requests` (`templates/admins/admin_account_requests.html`) | page | `src/app/(staff)/admin/account-requests/page.tsx` | Done in Next.js |
| `routes/admin_routes.py` — `/admin/event` (`templates/admins/calendar_event.html`) | page | `src/app/(staff)/admin/calendar/page.tsx` | Done in Next.js |
| `routes/admin_routes.py` — `/library-cards` (`templates/admins/library_cards.html`) | page | `src/app/(staff)/admin/library-cards/page.tsx` | Done in Next.js |
| `routes/admin_routes.py` — `/records_returns` (`templates/admins/records_returns.html`) | page | `src/app/(staff)/admin/records-returns/page.tsx` | Done in Next.js |
| `routes/admin_routes.py` — `/admin-settings` (`templates/admins/admin_settings.html`) | page | `src/app/(staff)/admin-settings/page.tsx` | Done in Next.js |
| `routes/admin_routes.py` — `/system-settings` (`templates/admins/system_settings.html`) | page | `src/app/(staff)/system-settings/page.tsx` | Done in Next.js |
| `templates/admins/login.html` | page | `src/app/(public)/login/page.tsx` | Done in Next.js |
| `templates/admin_template/{sidebar,topbar,footer}_template.html` | page | `src/components/layout/StaffSidebar.tsx`, `StaffTopbar.tsx` | Done in Next.js |
| `routes/admin_routes.py` — CRUD endpoints (`/add_book`, `/update_book`, `/delete_book`, `/update_inventory`, `/unlock_user`, `/delete_user`, `/reset_user_password`, `/admin/deactivate_user`, `/admin/reactivate_user`, `/api/admin/account-requests/*`, `/api/events*`, `/api/library-cards*`, `/register/*`, `/api/admin/profile`, `/admin/update_profile`, `/admin/security/*`, `/api/admin/system-settings`) | api | `src/app/api/admin/data/route.ts` + `src/repositories/*` | Done in Next.js |
| `routes/admin_routes.py` — `/cover/<name>` | api | `src/lib/storage/` (Supabase Storage) | Not started |
| `routes/admin_routes.py` — `/admin/valid-id/<int:user_id>` | api | `src/app/api/admin/valid-id/[userId]/route.ts` | Not started |
| `routes/admin_routes.py` — `/api/staff/appearance` | api | `src/components/theme-provider.tsx` / `src/app/api/staff/appearance/route.ts` | Not started |
| `routes/admin_routes.py` — `/api/users/search`, `/api/members/search`, `/api/admin/user/<int:user_id>` | api | `src/app/api/admin/users/route.ts` | Not started |
| `routes/admin_routes.py` — `/api/admin/backup/run`, `/api/admin/backup/logs`, `/api/admin/backup/schedule` | api / job | `src/app/api/backup/route.ts`, `src/lib/jobs/backup.ts` | Not started |

### Librarian Pages (11 pages), Templates & APIs

| Flask item | Type (page/api/helper/job) | Target in Next.js | Status |
|---|---|---|---|
| `routes/librarian_routes.py` — `/librarian/home` (`templates/librarians/librarian_home.html`) | page | `src/app/(staff)/librarian/home/page.tsx` | Not started |
| `routes/librarian_routes.py` — `/librarian_dashboard` (`templates/librarians/dashboard.html`) | page | `src/app/(staff)/librarian/dashboard/page.tsx` | Not started |
| `routes/librarian_routes.py` — `/librarian/library-cards` (`templates/librarians/library_cards.html`) | page | `src/app/(staff)/librarian/library-cards/page.tsx` | Not started |
| `routes/librarian_routes.py` — `/librarian_user_management` (`templates/librarians/user_management.html`) | page | `src/app/(staff)/librarian/users/page.tsx` | Not started |
| `routes/librarian_routes.py` — `/librarian_book_management` (`templates/librarians/book_management.html`) | page | `src/app/(staff)/librarian/books/page.tsx` | Not started |
| `routes/librarian_routes.py` — `/librarian/announcements` (`templates/librarians/announcement.html`) | page | `src/app/(staff)/librarian/announcements/page.tsx` | Not started |
| `routes/librarian_routes.py` — `/librarian/inventory` (`templates/librarians/inventory_status.html`) | page | `src/app/(staff)/librarian/inventory/page.tsx` | Not started |
| `routes/librarian_routes.py` — `/librarian/account-requests` (`templates/librarians/librarian_account_requests.html`) | page | `src/app/(staff)/librarian/account-requests/page.tsx` | Not started |
| `routes/librarian_routes.py` — `/librarian/event` (`templates/librarians/calendar_event.html`) | page | `src/app/(staff)/librarian/calendar/page.tsx` | Not started |
| `templates/librarians/records_returns.html` | page | `src/app/(staff)/librarian/records-returns/page.tsx` | Not started |
| `routes/librarian_routes.py` — `/librarian-settings` (`templates/librarians/librarian_settings.html`) | page | `src/app/(staff)/librarian/settings/page.tsx` | Not started |
| `templates/librarian_template/{sidebar,topbar,footer}_template.html` | page | `src/components/librarian/` / `src/components/layout/` | Not started |
| `routes/librarian_routes.py` — librarian APIs (`/librarian_dashboard/stats`, `/librarian_add_book`, `/librarian_update_book`, `/librarian_delete_book`, `/api/fetch-book-by-isbn`, `/api/validate-isbn`, `/api/announcements*`, `/api/inventory*`, `/api/librarian/account-requests*`, `/librarian/register/*`, `/librarian/api/library-cards*`, `/api/librarian/profile*`, `/api/librarian/security/*`) | api | `src/app/api/librarian/**/route.ts` | Not started |

### User / Member Pages, Templates & APIs

| Flask item | Type (page/api/helper/job) | Target in Next.js | Status |
|---|---|---|---|
| `routes/user_routes.py` — `/user/home` (`templates/users/user_home.html`) | page | `src/app/user/home/page.tsx` | Done in Next.js |
| `routes/user_routes.py` — `/user/browse` (`templates/users/books.html`) | page | `src/app/user/browse/page.tsx` | Done in Next.js |
| `routes/user_routes.py` — `/user/notifications` (`templates/users/notification.html`) | page | `src/app/user/notifications/page.tsx` | Done in Next.js |
| `routes/user_routes.py` — `/user/event` (`templates/users/calendar_event.html`) | page | `src/app/user/event/page.tsx` | Done in Next.js |
| `routes/user_routes.py` — `/user/borrowed` (`templates/users/borrowed_books.html`) | page | `src/app/user/borrowed/page.tsx` | Done in Next.js |
| `routes/user_routes.py` — `/user/borrow-history` (`templates/users/borrow_history.html`) | page | `src/app/user/borrow-history/page.tsx` | Done in Next.js |
| `routes/user_routes.py` — `/user/edit_profile` (`templates/users/edit_profile.html`) | page | `src/app/user/edit_profile/page.tsx` | Done in Next.js |
| `routes/user_routes.py` — `/about` (`templates/users/aboutus.html`) | page | `src/app/(public)/no_user_about/page.tsx` | Done in Next.js |
| `routes/user_routes.py` — `/user/settings` (`templates/users/settings.html`) | page | `src/app/user/settings/page.tsx` | Not started |
| `templates/user_template/{topbar,footer,profile_sidebar}_template.html` | page | `src/components/layout/MemberShell.tsx` | Done in Next.js |
| `routes/user_routes.py` — member APIs (`/api/user/daily-active-count`, `/user/upload_valid_id`, `/user/valid-id/view`, `/api/user/notifications*`, `/api/books`, `/api/user/favorites*`, `/user/update_profile`, `/user/change_password`, `/user/scan_valid_id`, `/api/user/search-history`, `/user/clear_search_history`, `/user/clear_favorites`, `/api/user/appearance`, `/api/user/storage*`, `/user/submit-account-request`, `/api/user/account-request/status`, `/api/user/borrowed-books`, `/api/user/return-history`, `/api/user/renew/<id>`, `/api/user/card/<id>/download-pdf`, `/api/user/recent-activity`, `/api/user/mfa/*`) | api | `src/app/api/user/**/route.ts` | Not started |

### Helpers, Jobs, Infrastructure & Static JS

| Flask item | Type (page/api/helper/job) | Target in Next.js | Status |
|---|---|---|---|
| `helpers/helpers.py` | helper | `src/lib/crypto/fernet.ts`, `src/lib/utils.ts`, `src/repositories/*` | Not started |
| `helpers/login_sessions.py` | helper | `src/lib/auth/session.ts`, `src/middleware.ts` | Not started |
| `errors/error_handlers.py` | helper | `src/lib/errors.ts`, `src/app/error.tsx`, `src/lib/audit/error-logger.ts` | Not started |
| `email_config/email_config.py` | helper | `src/lib/email/` | Not started |
| `backup/backup.py`, `backup/config.py`, `backup/scheduler.py` | job | `src/lib/jobs/backup.ts`, `scripts/` | Not started |
| `task_queue/queue_worker.py` + `app.py` `/api/queue/stats` | job | `src/lib/jobs/` (Supabase / Vercel cron) | Not started |
| `storage/book_thumbnail.py` | helper | `src/lib/storage/thumbnail.ts` | Not started |
| `static/js/*` (`appearance.js`, `login.js`, `staff_appearance.js`, `admin_js/*`) | helper | React components & `src/components/theme-provider.tsx` | Not started |
| `app.py` `/static/models/<filename>` | api | `public/models/brain.glb` (served statically by Next.js) | Done in Next.js |
