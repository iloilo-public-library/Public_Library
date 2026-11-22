# Timeline Rules

Update `timeline.md` after EVERY completed task and EVERY Git commit.

## Branch Selection
Run `git branch --show-current` to determine the target section:
- `tony@dev` (author: `antzyyy123`) -> log under `## Branch: tony@dev`
- `Neil` (author: `Neil Mar De Asis`) -> log under `## Branch: Neil`
- Merge commits are logged under the branch where the merge was made.

## Activity Format
- Add entries under that branch's `### Activities Completed` inside the matching `#### [Date]` heading.
- Format: **one bullet, one sentence, past tense**, starting with a verb (`Built`, `Added`, `Restored`, `Fixed`, `Removed`, etc.) and ending with the 7-character commit hash(es) in parentheses.
- Combine closely related small changes into one bullet.
- Do NOT include phase labels, "Key Files" lists, or per-bullet status/date fields.

## Commit Table Format
One row per commit, chronological order (newest last):

```markdown
| Date | Time | Commit | Message |
|---|---|---|---|
```

- Fetch exact commit metadata with:
  ```bash
  git log -1 --format="%h|%ad|%s" --date=format:"%Y-%m-%d|%H:%M"
  ```
- Use the 7-character hash and a short one-line message.
- Never invent, edit, or guess a hash, time, date, or message.

## Rules
1. Keep entries in chronological order with newest last.
2. Never delete historical records unless the user explicitly instructs you to.
3. Check for existing entries first — no duplicates.
4. If work is complete but not yet committed, add the activity bullet with `(uncommitted)` until the commit exists.
5. Only edit `timeline.md` during logging; never modify source code.
6. Keep `## Ongoing Activities` updated per branch (`None.` if nothing is in progress).
