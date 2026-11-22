# Frontend Rules

Follow these rules for all design, layout, styling, content, animation, UI component, and responsive tasks.

## Files You MAY Edit
- `src/components/**`
- `src/app/**/page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`
- `src/app/(public)/**`, `src/app/(staff)/**`, `src/app/user/**` (UI only)
- `src/app/globals.css` and any CSS/Tailwind files
- `public/**`
- UI-only helpers (e.g., `theme-provider.tsx`)

## Files You MUST NOT Edit
- `src/app/api/**`
- `src/repositories/**`
- `src/services/**`
- `src/validators/**`
- `src/middleware.ts`
- `src/lib/auth/**`, `src/lib/audit/**`, `src/lib/email/**`, `src/lib/storage/**`, `src/lib/jobs/**`
- `src/config/**`
- `supabase/migrations/**`
- `.env*`, `vercel.json`, `next.config.ts`, `package.json` (ask first if a new UI package is required)

## Rules
1. Design/UI requests change only look, layout, text, and component structure.
2. Do not change data logic, request payloads, response shapes, validation, RBAC, or auth flow.
3. Frontend may CALL existing API endpoints, but must not create, modify, or delete them.
4. If the UI needs data an API does not provide, do NOT add the endpoint. Use clearly marked placeholder/mock data and tell the user what backend work is needed.
5. Keep existing behavior intact: forms, saving, redirects, role-based visibility, and audit-related calls.
6. Reuse existing components and design tokens before creating new ones.
7. Controls with no backend yet must stay disabled and labeled `"Not available yet"`.
8. Keep layouts responsive and preserve light/dark theme support.

## Before Finishing
1. List every changed file and verify all are within scope; revert any file outside scope.
2. Run `npx tsc --noEmit` and lint; fix only errors caused by your changes.
3. Follow `rules/timeline.md` to log the completed activity.
