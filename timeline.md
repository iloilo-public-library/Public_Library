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

#### November 22, 2026
- Simplified `timeline.md` into a branch-separated summary, set up the AI rules system (`rules/`), and added pointer instructions to `AGENTS.md`. (`e32a18f`, `46ec48f`, `5c705e3`)
- Redesigned `/login` with the top-bar Log In/Sign Up nav, non-overlapping hologram projector funnel, small Baybayin book (`Noto_Sans_Tagalog`), CSS 3D book-opening intro & 3-page riffle flip transitions (`useBookFlip.ts`), reused landing-page floating 3D props, and `PhysicsLamp` while preserving all auth logic and `SignupWizard`. (`d20b571`)
- Removed the `/login` book, Baybayin font/text, hologram effects, and page-flip hook, enlarged the translucent navy + gold-bordered auth card (`AuthCard.tsx`), moved the lamp and floating props into the sliding hero panel, removed in-card tabs, and added the CSS swap/roll/expand/float-label/shake/morph animations. (`05689ed`)
- Restored the legacy standalone two-column Admin Settings layout (`100dvh`, fixed left sidebar with mobile drawer, sticky topbar, search, Overview with full Login Activity tiles, GitHub-style heatmap, Last 7 days bar chart, and Recent sessions list, Personal Details, Password & Security, and Appearance), hardened backend Zod/PIN/session queries (fixing the Zod v4 `nullableIdSchema` mutation bug), and enabled all 3 themes and 3 languages. (`e2740fb`)

#### November 23, 2026
- Restored the legacy Admin Announcements Board layout inside `StaffShell` with stat cards, category filter pills, live search, pinned/all card grids with read-more expand, accessible Create/Edit and Delete modals, live preview, and wired the live `"Send To"` member picker + recipient badges. (`ba807cd`)
- Added backend "Send To" recipient support for admin announcements (`target_user_id` Zod validation, active-member check, staff-only `target_user_name`, member notification privacy enforcement, audit logging of recipient ID, and minimal `GET /api/admin/users?role=member` picker mode). (`ba807cd`)
- Restored the legacy Admin Dashboard (`Library Dashboard`) with 7 animated KPI cards, hand-built accessible SVG/CSS charts (`Users by Role`, `Online Status`, `Books Added`), `Collection Condition` health meter, `Alerts & Attention` panel, and `Book Availability Snapshot` table without touching backend files. (`ba807cd`)
- Restored the legacy Admin Management, Librarian Management, and User Management pages via one shared `AccountManagementView` component with stat cards, debounced search, status filter pills, sortable columns, pagination, accessible Add/Reset/Confirm/5-tab View Details modals (including protected Valid ID preview), and self-delete protection. (`ba807cd`)
- Restored the legacy Admin Account Requests page (`src/app/(staff)/admin/account-requests/page.tsx`) with 6 stat cards, category section switcher (`New Signups`, `Card Renewals`, `Deactivation / Deletion`), status filter pills, debounced search, colored-strip request cards, 2-tab Detail modal with protected Valid ID preview (`/api/admin/valid-id/[userId]`), and focus-trapped Approve/Reject/Delete confirmation modals without affecting `/librarian/account-requests`. (`ba807cd`)
- Removed the admin top bar navigation (`StaffTopbar`) from `StaffShell` (admin role only) and `/dashboard`, adjusted main top spacing, and kept a mobile-only menu button for opening the sidebar on small screens. (`ba807cd`)
- Restored the legacy Admin Home page (`src/app/(staff)/admin/home/page.tsx`) with Hero Option B, the interactive Holographic Guardian Eagle SVG scene with 6 orbiting Next.js shortcuts + Pause/Play orbit toggle + eye-tracking, floating Pending Account Requests alert card, 4 quick-action cards, and 3-metric catalog summary row wired to `GET /api/dashboard/stats`. (`ba807cd`)
- Restored the legacy Admin Event Calendar page (`src/app/(staff)/admin/calendar/page.tsx`) with a pure CSS Grid + `Intl`/`Date` Asia/Manila calendar engine (`Month`/`Week`/`Day`/`List` views, keyboard arrow/PageUp/PageDown/Enter nav, URL hash sync, mobile compact strip + agenda), 3 header stat chips, 5-category legend filter with icons, `Events Summary` + `Next Upcoming Events`, and focus-trapped Add/Edit/Detail/Delete modals. (`ba807cd`)
- Added full Event Calendar backend support (migrations `005`–`007`, pure recurrence engine `src/lib/calendar/recurrence.ts` with 7 Node unit tests, range-filtered/expanded `events` & `event_categories` repository, hardened 2 MB magic-byte/EXIF-stripped Dropbox event cover upload + `/cover/events/[name]` serving + cleanup, and `CRON_SECRET`-protected `GET /api/cron/event-reminders` in `vercel.json`) and wired the entire Admin Event Calendar UI end-to-end. (`ba807cd`)
- Restored the legacy Admin Borrowing Form (`src/app/(staff)/admin/library-cards/page.tsx`) and Borrow History (`src/app/(staff)/admin/records-returns/page.tsx`) pages via `src/components/circulation/*` with Member/Borrower tabs, keyboard-accessible `role="combobox"` member & book/ISBN barcode pickers, stock validation, confirmation modal + printable receipt, 4 circulation stat cards, `All Records`/`Return History` tabs, Overdue/date-range filters, CSV export, mobile stacked cards, polished button variants, and focus-trapped View/Return/Edit/Delete modals. (`ba807cd`)

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
| 2026-11-22 | 14:09:59 +0800 | `e32a18f` | `docs: simplify timeline.md and separate by branch` |
| 2026-11-22 | 14:21:07 +0800 | `46ec48f` | `chore: add AI rules system and AGENTS.md pointer` |
| 2026-11-22 | 14:22:11 +0800 | `5c705e3` | `docs: record AI rules system commit in timeline.md` |
| 2026-11-22 | 17:25:19 +0800 | `d20b571` | `feat(login): add hologram projector layout, Baybayin 3D book flip, PhysicsLamp, and shared floating props` |
| 2026-11-22 | 17:59:21 +0800 | `05689ed` | `feat(login): remove book/hologram, enlarge gold auth card, add swap/roll/morph animations, and move lamp with hero` |
| 2026-11-22 | 19:02 | `e2740fb` | `feat(admin-settings): restore legacy layout, login activity, 3 themes/languages, and fix Zod v4 mutations` |
| 2026-11-23 | 11:37:28 +0800 | `ba807cd` | `feat(admin): restore announcements, dashboard, accounts, requests, home, calendar, and circulation pages` |




















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

#### November 23, 2026
- Unified member navigation, added missing admin sidebar links, removed developer jargon across UI routes, authored `docs/PROJECT_OVERVIEW.md`, and merged `origin/tony@dev` into `Neil`. (`dfafb8f`, `a572c77`)
- Seeded and normalized the `anthonyojera47@gmail.com` admin account (`008_seed_admin_account.sql`) and updated `/api/auth/login`, `/api/auth/reset-password`, and `/api/auth/reset-pin` to match both `username` and `email_display`. (`b86e840`)
- Displayed `Book ID` (`book_id` / `#<id>`) across the Admin and Librarian Inventory tables, Book Management tables, Borrowing Form book picker, and Borrow History views to distinguish books with identical titles. (`b86e840`)
- Added `src/types/inventory.ts` (`CopyCondition`, `CirculationStatus`, `BookCopyRecord`, `BookWithInventoryRow`, `AddBookWithCopiesInput`) and `src/components/admin/AddBookModal.tsx` with a cohesive two-section layout, ISBN metadata lookup, copy stepper, and live accession barcode chip preview (`C001…C00N`) wired into `AdminActionModals.tsx`. (`b86e840`)
- Upgraded `lookupByIsbn` in `/api/admin/data` to strip ISBN hyphens, match exact `industryIdentifiers`, merge Google Books and Open Library subjects, filter out internal Open Library tags (`series:...`, `Accessible book`, etc.), and auto-fill both `category` and `class`/`genre`. (`b86e840`)
- Added `Destroyed` copy condition support (`009_destroyed_condition_and_catalog_code.sql`, `books.ts`, `inventory.ts`, `AdminResourceView.tsx`, `AdminActionModals.tsx`), fixed multi-word table pill wrapping (`whitespace-nowrap`), redesigned all `AdminActionModals`, eliminated focus-stealing `useEffect` loops across modal components, and hardened API route authentication, RBAC, email lookups, and PostgREST embeds. (`b86e840`)
- Unified the search, filter, sort, and edit command bars across all Admin, Librarian, and Member pages (`AdminResourceView.tsx`, `AccountManagementView.tsx`, `/admin/account-requests`, `BorrowHistoryView.tsx`, `/admin/announcements`, `/admin/error-logs`, `/user/borrowed`, `/user/borrow-history`, `/user/notifications`) to match the `48px` Browse Catalog design language. (`b86e840`)
- Updated the `/api/cron/event-reminders` schedule in `vercel.json` from `*/15 * * * *` to `0 0 * * *` (daily at 08:00 AM Manila time) with a 24-hour reminder dispatch window to comply with Vercel Hobby plan daily cron limits. (`b86e840`)
- Added a custom page-turning book loader (`src/components/ui/book-loader.tsx`, `src/app/loading.tsx`) restyled to the ICPL design (navy + gold-tooled cover, Plus Jakarta Sans / DM Mono type) over an animated library backdrop (drifting accent/gold/green aurora, catalog dot grid, bookshelf silhouettes, rising gold dust motes, reading-lamp halo, progress shimmer), theme-aware and `prefers-reduced-motion` safe. (`27e76f2`)

#### November 24, 2026
- Removed the Terms link from the login card footer, moved the "Forgot password?" link below the password input box, and relocated Back to Home to a top-left icon button in `AuthCard`. (`db485f2`)
- Overhauled `PublicTopbar` to a streamlined, icon-free glassmorphic header with scroll-triggered backdrop blur, smooth active-pill transitions, scroll-spy click locking, and no theme toggle or locked preview icons. (`db485f2`)
- Fixed `PublicTopbar` section hash routing from `/no_user_about` back to `/#<section>` and eliminated scroll transition stutters using a fixed header height with GPU-composited `opacity` fade on the blurred glass layer. (`12816ff`)
- Replaced the login button's circular loading spinner with the fullscreen `BookLoader` screen on sign-in submission in `LibraryLoginPage` and `LoginPage`. (`12816ff`)
- Removed `ThemeToggle` across every page and component (`MemberShell`, `StaffTopbar`, `LibraryLoginPage`, `/librarian/settings`, `/user/settings`) and upgraded `MemberShell` and `StaffTopbar` to use GPU-composited scroll-reactive glassmorphic headers with smooth active-pill transitions. (`12816ff`)
- Enhanced `AboutUsContent` with editorial serif typography, warm gold and sky accent glassmorphism, ambient hero dot-grid and radial glows, a 4-item key-facts strip, quick-jump section pills, 2-column scannable guidelines and branches grids, and updated policy cards. (`12816ff`)
- Overhauled the Member Portal (`MemberShell` slide-over Notifications Feed drawer, interactive Month/List Event Calendar in `/user/event`, restyled activity-feed cards in `/user/notifications`, and unified editorial serif + frosted glassmorphism styling on `/user/borrowed`, `/user/borrow-history`, and `/user/settings`). (`12816ff`)
- Restructured `/user/settings` with a sticky left sidebar (`Overview`, `Personal Details`, `Password & Security`, `Preferences`) while keeping all existing profile, password, OTP/PIN, privacy controls, and session history intact. (`12816ff`)
- Added 4 daylight themes (`light` Ice White/Deep Teal/Peach, `cobalt` Mauve Lavender, `riso` Riso Cream, `clay` Raw Clay) in `globals.css`, `staff-i18n.ts`, `layout.tsx`, and `/user/settings` Preferences, wired live Filipino/Hiligaynon translations across landing and member pages, replaced `public/images/logo.png` with a transparent emblem PNG, and unified theme-matched header and section contrast across all 6 themes. (`12816ff`)

### Git Commit History

| Date | Time | Commit | Message |
|---|---|---|---|
| 2026-11-21 | 19:30:38 +0800 | `92845ef` | `feat: improve browse search, split-screen login, and schema normalization with copy-level inventory` |
| 2026-11-21 | 19:39:02 +0800 | `cb4b99f` | `Merge remote-tracking branch 'origin/tony@dev' into Neil` |
| 2026-11-21 | 20:08:10 +0800 | `05baf45` | `Merge branch 'tony@dev' into Neil` |
| 2026-11-21 | 23:44:40 +0800 | `1a7fb3f` | `feat: complete remaining member, auth MFA/CAPTCHA, and staff utility APIs (100% MIGRATION.md)` |
| 2026-11-23 | 11:39 | `dfafb8f` | `ui: unify member navigation, add missing admin sidebar links, remove developer jargon, and add PROJECT_OVERVIEW.md` |
| 2026-11-23 | 11:43 | `a572c77` | `Merge branch 'tony@dev' of https://github.com/iloilo-public-library/Public_Library into Neil` |
| 2026-11-23 | 14:15 | `b86e840` | `feat: redesign modals, add destroyed copy tracking, unify catalog search/filters, and harden api routes` |
| 2026-11-23 | 15:08 | `27e76f2` | `feat(ui): add animated page-turning book loader and ambient library backdrop` |
| 2026-11-24 | 08:40 | `db485f2` | `ui: refine login card layout and overhaul public topbar with glassmorphism and scroll blur` |
| 2026-11-24 | 14:30 | `12816ff` | `feat(ui): overhaul member portal, about us, 6 themes, i18n translations, and transparent logo` |


















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
