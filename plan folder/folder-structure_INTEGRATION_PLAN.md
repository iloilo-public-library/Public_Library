# INTEGRATION_PLAN.md

> **Agent: read this entire file before doing anything. It is the source of truth for the folder structure, the rules, and the current phase. If a chat prompt conflicts with the HARD RULES below, stop and ask.**

---

## 1. Project context

- Government public library system (Iloilo Public Library).
- Migrating a **Flask + Jinja** app to a single **Next.js (App Router, TypeScript)** app, **incrementally**.
- **Next.js in `src/` is the final system.** Flask is temporary and will live in `legacy-flask/` until every feature is ported, then it is deleted.
- Database and storage: **Supabase**.
- Repo root: `C:/Users/Angelo Ojera/Downloads/new integrated public library` (branch `tony@dev`). The folder name has spaces; do not rename the root folder.

---

## 2. HARD RULES (apply to every phase)

1. **NEVER open, read, print, copy or commit:** `.env*`, `cert.pem`, `key.pem`, `valid_id_vault/`, `backups/`, `restore/`, `restore.zip`, `*.zip.enc`, or anything inside them. If a task seems to need them, stop and ask.
2. Never hardcode or log secrets. Use environment variables only.
3. Do not modify the logic of any Flask file. You may only move Flask files and make the smallest path fix needed for Flask to still start. List every such fix in the report.
4. Work on **ONE phase at a time**. Do only what the current phase says. When finished, stop and report. Do not start the next phase.
5. Use `git mv` for moves so history is kept. Never delete a file unless the phase explicitly says so. If unsure, leave it and list it in the report.
6. Do not rewrite or redesign existing React pages or components. Move files and fix imports only.
7. Update `MIGRATION.md` after every moved or ported item.
8. From Phase 3 onward: validate every API input with Zod and check the user's role on every route.
9. Before big changes, show the plan and wait for approval.
10. If a command fails because of sandbox or permission limits (for example, writing to `.git/`), tell the user immediately and give the exact commands for them to run. Do not fail partway through a phase.

---

## 3. Target architecture (Next.js)

Data flows one way:

```
route handler -> validator (Zod) -> service -> repository -> Supabase
```

| Layer | Location | Responsibility |
|---|---|---|
| Route handler (controller) | `src/app/**/route.ts` | Thin. Validate input, check role, call a service, return a response. No business rules, no queries. |
| Validators | `src/validators/` | Zod schemas for every API input. |
| Services | `src/services/` | Business rules and workflows. Calls `lib/audit` on every create, update and delete. |
| Repositories | `src/repositories/` | The only place that queries Supabase. |
| Middleware | `src/middleware.ts`, `src/lib/auth/` | Session and role-based access (admin, librarian, user). |
| Config | `src/config/` | Environment validation and constants. |

---

## 4. Final integrated folder structure

```
integrated-public-library/
├── src/                                   # NEXT.JS (the final system)
│   ├── app/
│   │   ├── (public)/                      # no login needed
│   │   │   ├── page.tsx                   # landing (/)
│   │   │   ├── browse/  no_user_about/  login/  scan-qr/  maintenance/
│   │   │   ├── reset-password/            # NEW (ported from Flask)
│   │   │   └── reset-pin/                 # NEW (ported from Flask)
│   │   ├── (staff)/                       # protected: admin and librarian
│   │   │   ├── dashboard/  admin-settings/  system-settings/
│   │   │   ├── admin/                     # 12 existing pages
│   │   │   └── librarian/                 # NEW: 11 pages from Flask
│   │   ├── user/                          # 7 existing pages
│   │   ├── logout/route.ts
│   │   ├── api/
│   │   │   ├── auth/ (login, session, signup, qr, reset-password, reset-pin)
│   │   │   ├── admin/  librarian/  user/  public/books/
│   │   │   ├── dashboard/stats/  error-logs/  check_email/  health/supabase/
│   │   │   └── backup/
│   │   └── layout.tsx  error.tsx  not-found.tsx  globals.css
│   ├── components/                        # admin, auth, catalog, landing, layout, ui + librarian/
│   ├── config/                            # env validation, constants
│   ├── services/                          # business rules
│   ├── repositories/                      # all Supabase queries
│   ├── validators/                        # Zod schemas
│   ├── middleware.ts                      # route protection by role
│   ├── lib/
│   │   ├── auth/ (session.ts, rbac.ts, qr.ts)
│   │   ├── audit/ (error-logger.ts)
│   │   ├── crypto/fernet.ts
│   │   ├── email/  storage/  jobs/        # replace Flask email_config, storage, task_queue, backup
│   │   ├── supabase/ (client.ts, server.ts)
│   │   ├── api.ts                         # calls to Flask during migration only
│   │   └── logger.ts  errors.ts  utils.ts
│   └── types/library.ts
│
├── public/                                # images, models/brain.glb (ONE copy)
├── supabase/migrations/                   # 001 to 003, continue numbering
├── scripts/                               # decrypt_tool, encryption, migrate_admin
├── tests/                                 # unit, integration, e2e
├── docs/                                  # architecture, security-policy, api-spec, deployment
├── .github/workflows/
│
├── legacy-flask/                          # TEMPORARY: deleted at the end
│   ├── app.py  conn.py  requirements.txt  Dockerfile
│   ├── api/                               # NEW: JSON-only routes for Next.js
│   ├── routes/  templates/                # old, untouched
│   ├── authentication/  backup/  email_config/  errors/
│   ├── helpers/  landing/  storage/  task_queue/
│   └── static/uploads/
│
├── .env.example  .gitignore
├── next.config.ts                         # rewrite: /flask/:path* -> http://localhost:5000/api/:path*
├── package.json  tsconfig.json  components.json  postcss.config.mjs
├── Dockerfile  docker-compose.yml  vercel.json
├── MIGRATION.md
└── README.md
```

### Where current root files go

| Current | Becomes |
|---|---|
| `app.py`, `conn.py`, `requirements.txt` | `legacy-flask/` |
| `routes/`, `templates/`, `authentication/`, `backup/`, `email_config/`, `errors/`, `helpers/`, `landing/`, `storage/`, `task_queue/` | `legacy-flask/` (same names) |
| `static/uploads/` | `legacy-flask/static/uploads/` |
| `static/js/` | `legacy-flask/static/js/` (deleted once pages are ported) |
| `static/images`, `public/static/images`, both `brain.glb` | `public/` (single copy) |
| `useful_tools(just in case)/` | `scripts/` |
| `server.js` | moved to `legacy-flask/` in Phase 2, removed in Phase 3 once the `next.config.ts` rewrite exists |
| `application/*.apk` | releases, not git |
| `src/` | stays, reorganized as shown above |

### Kept out of the repo (never opened by the agent)

`cert.pem`, `key.pem`, `valid_id_vault/`, `backups/`, `restore/`, `restore.zip`, `backup_*.zip.enc`, `.env`. The owner rotates the key pair and moves these out by hand.

---

## 5. Run-time flow during migration

```
Browser -> Next.js (:3000) -> /flask/... -> legacy-flask (:5000) -> database
```

Users open only port 3000. When the last feature is ported, delete `legacy-flask/` and the rewrite; the root is already the finished structure.

---

## 6. Flask to Next.js mapping

| Flask | Next.js |
|---|---|
| `routes/admin_routes.py`, `librarian_routes.py`, `user_routes.py` | `src/app/api/<role>/.../route.ts` calling `services/` |
| `authentication/authentication.py` | `lib/auth/session.ts` and `rbac.ts` |
| `authentication/qr_auth.py` | `lib/auth/qr.ts` and `app/api/auth/qr/route.ts` |
| `helpers/login_sessions.py` | `lib/auth/session.ts` and `middleware.ts` |
| `errors/error_handlers.py` | `lib/errors.ts`, `error.tsx`, `lib/audit/error-logger.ts` |
| `email_config/` | `lib/email/` |
| `backup/` (backup, scheduler, config) | `lib/jobs/backup.ts` and `scripts/` |
| `task_queue/queue_worker.py` | `lib/jobs/` (or Supabase cron / Vercel cron) |
| `storage/book_thumbnail.py` | `lib/storage/thumbnail.ts` |
| `templates/librarians/*` | `app/(staff)/librarian/<page>/page.tsx` |
| `templates/reset_password.html`, `reset_pin.html` | `app/(public)/reset-password`, `reset-pin` |
| `static/js/*` | React components and `theme-provider`; no standalone JS |
| `static/uploads/` | Supabase Storage (private buckets for card photos and valid IDs) |

---

## 7. Phases

| # | Phase | Who | Status |
|---|---|---|---|
| 1 | Security cleanup: rotate `cert.pem` and `key.pem`, move vault and backups out of the repo, create `pre-migration` tag | **Owner, by hand** | In progress |
| 2 | Restructure: move Flask into `legacy-flask/`, reorganize `src/`, merge assets | Agent | Blocked until tag exists and tree is clean |
| 3 | Skeleton: `config`, `services`, `middleware`, `rbac`, audit, Flask `api/`, `next.config.ts` rewrite, remove `server.js` | Agent | Complete |
| 3.5 | MySQL check: confirm nothing important exists only in MySQL (owner compares row counts). No migration. | Owner | Complete |
| 4 | Port the librarian module (11 pages) in batches of about 3 | Agent | Complete |
| 5 | Remaining features: password/PIN reset, email, QR auth, uploads & thumbnails (Dropbox), backup and cron jobs, member settings. *(Note: Backup job targets Supabase → Dropbox. Owner elected to keep Dropbox for uploads and book cover thumbnails.)* | Agent, one feature at a time | Complete |
| 6 | Verify and cut over: tests, side-by-side run, delete `legacy-flask/` | Agent and owner | Complete (`legacy-flask/` kept per owner request) |

### Known environment issue

The agent's terminal sandbox may not be able to write to `.git/` (`index.lock: Permission denied`). Commands that need it (`git rm`, `git add`, `git commit`, `git tag`, `git mv`) must either be run by the owner, or the owner must allow the agent write access. If blocked, report it and give the exact commands; do not continue partway.

---

## 8. PHASE 1 (owner runs these in their own terminal)

The agent does NOT run these. Owner commands, from the repo root:

```powershell
git rm --cached -r -f -q "*.pyc"
git rm --cached -f tsconfig.tsbuildinfo
git status --short
git add .gitignore package-lock.json "static/models/Architect lamp – pull the switch.html"
git commit -m "chore: pre-migration cleanup, ignore generated files"
git tag pre-migration
git log -1 --oneline
git tag -l
git status
git ls-files | findstr /i "cert.pem key.pem .env valid_id_vault backups restore .enc"
```

Required `.gitignore` entries: `__pycache__/`, `*.pyc`, `*.tsbuildinfo`, `node_modules/`, `.next/`.

Expected result: `git status` says "working tree clean" and `git tag -l` shows `pre-migration`.

---

## 9. PHASE 2: RESTRUCTURE (current phase once Phase 1 is done)

**No new features. No logic changes.**

**Goal:** move the Flask app into `legacy-flask/`, reorganize `src/` into the layered structure, and merge duplicate assets, without breaking anything.

### STEP 0: Pre-checks
- Confirm the git tag `pre-migration` exists and the working tree is clean. If not, STOP and tell the owner.
- Confirm you can run `git mv`. If sandbox permissions block it, tell the owner now.
- Inspect the current root layout and show a short plan of every move below. **WAIT for approval before moving anything.**

### STEP 1: Move Flask into `legacy-flask/`
Create `legacy-flask/` and `git mv` these from the project root into it, keeping the same names:

`app.py`, `conn.py`, `requirements.txt`, `Dockerfile` (the Flask one, if applicable), `routes/`, `templates/`, `authentication/`, `backup/`, `email_config/`, `errors/`, `helpers/`, `landing/`, `storage/`, `task_queue/`, `server.js`

Also move:
- `static/uploads/` -> `legacy-flask/static/uploads/`
- `static/js/` -> `legacy-flask/static/js/`
- `static/models/Architect lamp*.html` -> `legacy-flask/static/models/`

Do NOT touch: `backups/`, `restore/`, `valid_id_vault/`, `*.zip.enc`, `restore.zip`, `cert.pem`, `key.pem`, `.env`. Leave them in place and list them in the report.

After moving, check that `app.py`'s `static_folder`, `template_folder` and any relative paths still resolve. Make only the minimal path fixes needed so `python app.py` starts from inside `legacy-flask/`. List each fix.

### STEP 2: Merge assets into `public/`
- Merge `static/images` and `public/static/images` into `public/images/` (no duplicates; if two files share a name but differ, keep both and list them).
- Keep ONE copy of `brain.glb` at `public/models/brain.glb`. Update every `src/` reference that pointed to the old location.
- Remove the now-empty `static/` and `public/static/` folders.

### STEP 3: Tools
- `git mv "useful_tools(just in case)/"` to `scripts/`; rename files if needed so there are no spaces or brackets.
- Do NOT delete `migrate_admin copy.py`. Move it to `scripts/` and list it for the owner to decide.

### STEP 4: Reorganize `src/` (move files and fix imports only)
- Create route groups (they do not change URLs):
  - `src/app/(public)/`: `page.tsx`, `browse/`, `no_user_about/`, `login/`, `scan-qr/`, `maintenance/`
  - `src/app/(staff)/`: `dashboard/`, `admin-settings/`, `system-settings/`, `admin/` (all 12 pages)
  - `src/app/user/`, `src/app/logout/`, `src/app/api/`, `layout.tsx`, `error.tsx`, `not-found.tsx`, `globals.css` stay where they are.
  - Confirm `(public)` and `(staff)` do not create duplicate or conflicting routes.
- `src/lib/admin/queries.ts` -> split by module into `src/repositories/` (books, users, library-cards, announcements, inventory, etc.). Keep function bodies identical.
- `src/lib/admin/mutations.ts` -> move into `src/repositories/` the same way. Do NOT split into services yet (Phase 3).
- `src/lib/admin/error-logger.ts` -> `src/lib/audit/error-logger.ts`
- Keep `src/lib/auth/session.ts`, `src/lib/crypto/fernet.ts`, `src/lib/supabase/*`, `src/lib/api.ts`, `src/lib/utils.ts` where they are.
- Update all imports using the existing tsconfig path alias; do not invent new ones.
- Do not rename components or change any component code.

### STEP 5: Create the empty skeleton
Add a `.gitkeep` or a short `README.md` in each:
`src/config/`, `src/services/`, `src/validators/`, `tests/unit/`, `tests/integration/`, `tests/e2e/`, `docs/`

Do not write any logic in them yet.

### STEP 6: Create `MIGRATION.md` (project root)
Read `legacy-flask/routes/*.py` and `legacy-flask/templates/**` (read-only) and create a table with one row per Flask route, template and helper module:

| Flask item | Type (page/api/helper/job) | Target in Next.js | Status |
|---|---|---|---|

Statuses: "Done in Next.js" or "Not started". Mark "Done" only if a matching page or route already exists in `src/`. Include the 11 librarian pages, `reset_password`, `reset_pin`, QR auth, backup, email, task queue and thumbnail.

### STEP 7: `.gitignore`
Make sure it ignores: `.env*`, `cert.pem`, `key.pem`, `valid_id_vault/`, `backups/`, `restore/`, `restore.zip`, `*.zip.enc`, `*.apk`, `node_modules/`, `.next/`, `legacy-flask/static/uploads/`, `__pycache__/`, `logs/`. Do not run `git rm` on anything already tracked; list tracked sensitive files for the owner instead.

### GATE (all must pass; report the output of each)
1. `npm run build` passes with no new errors.
2. `npm run lint` shows no new errors compared with before.
3. `python app.py` starts from inside `legacy-flask/` (start, confirm it boots, stop it).
4. Every existing URL still resolves: `/`, `/browse`, `/login`, `/scan-qr`, `/maintenance`, `/no_user_about`, `/dashboard`, `/admin/*`, `/user/*`.
5. `git status` shows only the moves and edits described above.

### REPORT FORMAT
(a) everything moved, (b) every import or path fix, (c) files left alone and why, (d) sensitive files still tracked in git, (e) anything that failed or was uncertain, (f) gate results.

**Then STOP. Do not start Phase 3.**

---

## 10. Open questions (owner to answer before Phase 3)

1. Does `legacy-flask/conn.py` connect to the **same Supabase database** that `src/lib/supabase` uses, or to a separate database? If separate, a data-migration step is added before Phase 4.
   - **Answered:** Source of truth = Supabase Postgres. Flask = MySQL (`flask_mysqldb`; vars `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DB`), old data only, used as a UI and logic reference. `isbn_cache` is MySQL only (rebuildable cache). `error_logs` is Supabase only. Next.js owns login.
2. Who owns login during the bridge period? Recommended: Next.js owns login as early as possible, so Flask does not hold session state.
   - **Answered:** Next.js owns login during the bridge period (custom HMAC-signed `icpl_session` cookie verified against the Supabase `public.users` table).
3. Keep `legacy-flask/` as the folder name? (Currently yes.)

---

## 11. Status log

Update this section at the end of every phase.

- [x] Phase 1: `pre-migration` tag created, tree clean
- [x] Phase 2: restructure complete, gates passed
- [x] Phase 3: skeleton complete
- [x] Phase 4: librarian module ported
- [x] Phase 5: remaining features ported
- [x] Phase 6: verified & cut over to standalone Next.js (`legacy-flask/` kept archived per owner request)
