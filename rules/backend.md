# Backend Rules

Follow these rules for all API, database, auth, validation, service, repository, migration, email, storage, and backup tasks.

## Files You MAY Edit
- `src/app/api/**`
- `src/repositories/**`
- `src/services/**`
- `src/validators/**`
- `src/middleware.ts`
- `src/lib/auth/**`, `src/lib/audit/**`, `src/lib/email/**`, `src/lib/storage/**`, `src/lib/jobs/**`, `src/lib/errors*`, `src/lib/logger*`
- `src/config/**`
- `supabase/migrations/**`
- `scripts/**`, `vercel.json`, `.env.example`

## Files You MUST NOT Edit
- `src/components/**`
- `src/app/**/page.tsx`, `layout.tsx`
- CSS, Tailwind, `public/**`
- Any visual design, layout, or text content

## Rules
1. Backend requests change only logic, data, and APIs. Do not restyle or redesign anything.
2. Validate every API input with Zod in `src/validators/`. Follow the layering: `route -> service -> repository`.
3. Every protected route must enforce RBAC and session checks. Keep audit logging on sensitive actions.
4. Never hardcode secrets. Use environment variables and update `.env.example` when adding a new variable.
5. Database changes go in a NEW numbered migration file. Never edit an already-applied migration. Tell the user to run the new migration in Supabase.
6. Do not change an existing API's request/response shape without telling the user.
7. If a backend change requires a UI update, do NOT edit the UI. List what the frontend must change.
8. Supabase PostgreSQL is the single source of truth. Do not add other databases.

## Before Finishing
1. List every changed file and verify all are within scope; revert any file outside scope.
2. Run `npx tsc --noEmit` (and `npm run verify:routes` if routes were touched).
3. Tell the user about any environment variables or migrations that need manual setup.
4. Follow `rules/timeline.md` to log the completed activity.
