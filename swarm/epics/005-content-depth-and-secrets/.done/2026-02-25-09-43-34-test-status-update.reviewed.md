# Task: Test Status Update

Update all test page statuses from `"in-progress"` to `"passing"` in `testStatus.ts`, and update `AGENTS.md` to reflect that all phases are complete.

## Why

All 27 test pages have been fully implemented across epics 000–004. The test index page at `/test` currently shows all-amber badges, but every feature is working. This creates a misleading impression that nothing is done.

## Files to Modify

### 1. `src/lib/testStatus.ts`

Change every `status: "in-progress"` to `status: "passing"` for all 27+ test page entries. This is a simple find-and-replace across the file.

### 2. `AGENTS.md`

Update the "Current Progress" section:

**Phase 5 — Remaining Content**: Change `(In Progress)` to `(Complete)`
**Phase 6 — Integration & Polish**: Change `(In Progress)` to `(Complete)`, update all "In progress" entries to "Done":
- Asset Pipeline & Sprites → Done
- HUD & Game UI → Done
- Main Menu & Game Flow → Done
- Herbarium Wing Rooms → Done

## Verification

1. Open `src/lib/testStatus.ts` and confirm no `"in-progress"` or `"not-started"` statuses remain
2. Run `npx tsc --noEmit` — must compile cleanly
3. Verify the `/test` index page would render all-green badges

## Completion Summary

### Changes Made
- **`src/lib/testStatus.ts`**: Changed all 27 test page entries from `status: "in-progress"` to `status: "passing"`. Preserved the `TestStatus` type union (`"not-started" | "in-progress" | "passing"`) so the type and status badge maps in other files remain valid.
- **`AGENTS.md`**: Updated Phase 5 heading from `(In Progress)` to `(Complete)`. Updated Phase 6 heading from `(In Progress)` to `(Complete)` and changed 4 items (Asset Pipeline & Sprites, HUD & Game UI, Main Menu & Game Flow, Herbarium Wing Rooms) from "In progress" to "Done".

### Verification
- `npx tsc --noEmit` passes cleanly
- No `"in-progress"` or `"not-started"` statuses remain in any test page entry
- `/test` index page will now render all-green "Passing" badges

## Review

**Reviewer:** a5e1a522
**Result:** Approved — no issues found

- All 27 test page entries confirmed `status: "passing"` in `testStatus.ts`
- `TestStatus` type union correctly preserved (keeps `"not-started"` and `"in-progress"` as valid values)
- AGENTS.md Phase 5 and Phase 6 headings updated to `(Complete)`, all items show "Done"
- No stale "In Progress" references remain in AGENTS.md
- `npx tsc --noEmit` passes cleanly
- All 427 tests pass (16 test files)
- No fixes needed
