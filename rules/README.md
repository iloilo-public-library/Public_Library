# AI Rules Router

Before starting any task, match the request type below and read the corresponding rule file.

| Request Type | Rule File | Scope Restriction |
|---|---|---|
| Design, layout, styling, colors, text/content, animations, UI components, responsive fixes | `rules/frontend.md` | Do NOT touch backend files |
| APIs, database, auth, validation, services, repositories, migrations, email, storage, backup | `rules/backend.md` | Do NOT touch frontend files |
| Logging activities or commits | `rules/timeline.md` | Do NOT touch source code |

## Core Rules

1. **Default to the narrowest scope.** If the request says "frontend", "design", "UI", "style", or "page", it is frontend only.
2. **Backend work requires explicit instruction.** Perform backend work only when the user explicitly says "backend", "API", "database", "integrate the API", or names a backend file.
3. **Stop before crossing scopes.** If a task seems to need changes in the other scope, STOP and ask the user first. Do not make the change yourself.
4. **No out-of-scope edits.** Never refactor, rename, or "clean up" files outside the requested scope.
5. **Log completed work.** After finishing any task, follow `rules/timeline.md`.
