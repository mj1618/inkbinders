# Task: World Graph Assembly — Validate, Harden, and Finalize

## Context

The world graph is **largely already assembled**. Previous wing tasks (central-archives, astral-atlas, maritime-ledger, gothic-errata, hub-expansion) each added their rooms to `demoWorld.ts` as they were built. The current `createDemoWorld()` already:
- Collects all ~46 rooms from all 6 wing files + preset rooms + shrine rooms
- Defines 6 regions in `DEMO_WORLD_DATA` with correct biome IDs
- Has bidirectional exits between all rooms

**What remains** is validation, cleanup, and hardening — ensuring the graph is correct, adding developer-facing validation tools, and making the world-assembly test page work as a comprehensive integration test for all ~46 rooms.

---

## What to Build

### 1. Add World Graph Validation Function

**File:** `src/engine/world/WorldGraph.ts`

Add a `validate()` method to the `WorldGraph` class that checks structural integrity and returns a list of errors/warnings:

```typescript
interface ValidationResult {
  errors: string[];
  warnings: string[];
  stats: {
    totalRooms: number;
    totalExits: number;
    totalRegions: number;
    orphanedRooms: number;  // rooms in Map but not in any region
    bidirectionalExits: number;
    unidirectionalExits: number;
  };
}

validate(): ValidationResult
```

**Checks to perform:**
1. Every room ID in every region's `roomIds` resolves to a valid `RoomData` in the rooms Map (error if not)
2. Every exit's `targetRoomId` exists in the rooms Map (error if not)
3. Every exit has a corresponding return exit in the target room (warning if unidirectional — not necessarily an error for one-way drops)
4. Every room in the rooms Map appears in at least one region (warning for orphaned rooms)
5. `startingRoomId` and `hubRoomId` both exist in the rooms Map (error if not)
6. No duplicate room IDs across regions (error if found)
7. Count stats: total rooms, total exits, bidirectional pairs, orphaned rooms

### 2. Rename createDemoWorld → createFullWorld (and keep alias)

**File:** `src/engine/world/demoWorld.ts`

- Rename the main factory function to `createFullWorld()`
- Export `createDemoWorld` as an alias for backward compatibility:
  ```typescript
  export const createDemoWorld = createFullWorld;
  ```
- No other changes needed — the function already assembles the full world

### 3. Run Validation on Startup in Test Page

**File:** `src/app/test/world-assembly/page.tsx`

Add validation output to the world-assembly test page:
- Call `worldGraph.validate()` on initialization
- Display validation results in the debug panel (errors in red, warnings in yellow, stats in white)
- If any errors exist, display them prominently at the top of the debug panel
- Add a "Room Count" stat display showing total rooms per region

### 4. Update Play Page to Use createFullWorld

**File:** `src/app/play/page.tsx`

- Update import to use `createFullWorld` (or keep using `createDemoWorld` alias — either works)
- Add validation call in development mode: if `process.env.NODE_ENV === 'development'`, call `validate()` and `console.warn` any issues

### 5. Verify Total Room Count and Connections

The expected room count is **~46 rooms** across 6 regions:

| Region | Expected Rooms |
|--------|---------------|
| Hub (Scribe Hall) | 1 |
| Herbarium Wing | 11 (8 wing + tutorial-corridor + vine-garden + stitch-shrine) |
| Central Archives | 7 (archive-passage + vertical-shaft + 5 new rooms) |
| Astral Atlas Wing | 8 (7 atlas + paste-shrine) |
| Maritime Ledger Wing | 8 (7 maritime + redaction-shrine) |
| Gothic Errata Wing | 8 (7 gothic + index-shrine) |
| **Total** | **43** |

Verify this count matches. If it doesn't, investigate and fix.

### 6. Add index.ts Exports

**File:** `src/engine/world/index.ts` (create if needed, or update if exists)

Ensure all room files and the world graph are properly exported from the world module index:
- Export `createFullWorld`, `createDemoWorld` from demoWorld
- Export `WorldGraph`, `WorldGraphData`, `WorldRegion` from WorldGraph
- Export room constants from each wing file (needed by play page and test pages)

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/engine/world/WorldGraph.ts` | Add `validate()` method and `ValidationResult` interface |
| `src/engine/world/demoWorld.ts` | Rename to `createFullWorld()`, add `createDemoWorld` alias |
| `src/app/test/world-assembly/page.tsx` | Add validation display to debug panel |
| `src/app/play/page.tsx` | Optional: dev-mode validation warning |
| `src/engine/world/index.ts` | Update exports if needed |

---

## How to Verify

1. **Type check passes:** `npx tsc --noEmit` — no errors
2. **Validation passes:** `worldGraph.validate()` returns 0 errors
3. **Room count matches:** Total rooms ≈ 43-46
4. **All exits resolve:** Every `targetRoomId` maps to a real room
5. **Bidirectional exits:** The vast majority of exits have return paths (some one-way drops are acceptable)
6. **Test page works:** `/test/world-assembly` loads, shows validation results, player can navigate between rooms
7. **Play page works:** `/play` still functions correctly with the renamed function

---

## Pass Criteria

- `createFullWorld()` returns a complete WorldGraphData with all rooms
- `WorldGraph.validate()` method exists and returns a clean result (0 errors)
- Every room ID in every region resolves to valid RoomData
- Every exit's `targetRoomId` exists in the room registry
- Every exit has a corresponding return exit in the target room (warnings OK for intentional one-way paths)
- `WorldGraph.getRegion(roomId)` returns the correct region for any room
- `WorldGraph.getBiomeId(roomId)` returns the correct biome for any room
- World-assembly test page displays validation stats in debug panel
- Type check passes with no errors

---

## Implementation Summary

### Files Modified

| File | Changes |
|------|---------|
| `src/engine/world/WorldGraph.ts` | Added `ValidationResult` interface and `validate()` method — checks room existence, exit targets, bidirectional exits, orphaned rooms, duplicate IDs, and startingRoomId/hubRoomId validity |
| `src/engine/world/demoWorld.ts` | Renamed `createDemoWorld` → `createFullWorld`, kept `createDemoWorld` as deprecated alias |
| `src/app/test/world-assembly/page.tsx` | Updated import to `createFullWorld`, added validation display in debug panel (errors/warnings/stats/per-region counts), updated Room Map section from hardcoded 5-room list to dynamic region counts |
| `src/app/play/page.tsx` | Added dev-mode validation: calls `createFullWorld().worldGraph.validate()` in development, logs errors/warnings to console |
| `src/engine/world/index.ts` | Added exports for `createFullWorld` and `ValidationResult` |

### Room Count Verified

43 rooms across 6 regions:
- Hub: 1 (scribe-hall)
- Herbarium Wing: 11 (tutorial-corridor, vine-garden, stitch-shrine + 8 wing rooms)
- Central Archives: 7 (archive-passage, vertical-shaft + 5 wing rooms)
- Astral Atlas Wing: 8 (7 wing rooms + paste-shrine)
- Maritime Ledger Wing: 8 (7 wing rooms + redaction-shrine)
- Gothic Errata Wing: 8 (7 wing rooms + index-shrine)

### Verification

- `npx tsc --noEmit` — passes with 0 errors
- `npx next build` — all pages compile successfully
- `validate()` method checks 7 structural integrity rules and returns stats

---

## Review (a7615e2f)

Reviewed all 5 modified files. No fixes needed.

**WorldGraph.ts** — `validate()` method is well-structured, checks all 7 required integrity rules. Bidirectional exit counting correctly divides by 2. `ValidationResult` interface matches spec.

**demoWorld.ts** — Rename to `createFullWorld()` is clean, deprecated alias preserved. Defensive shrine room checks with conditional `if (ABILITY_SHRINE_ROOMS[...])` are good practice. All 43 rooms assembled correctly from 6 wing files.

**world-assembly/page.tsx** — Validation runs once on mount, results displayed in debug panel with proper color coding (red errors, yellow warnings, green clean). Region counts populated correctly. Warnings truncated at 10 with overflow indicator.

**play/page.tsx** — Dev-mode validation creates a separate `createFullWorld()` instance for checking, doesn't interfere with the play page's own `PRESET_ROOMS`/`RoomManager` system. Errors logged to console.error, warning count summarized to console.warn.

**index.ts** — All new exports properly included (`createFullWorld`, `createDemoWorld`, `ValidationResult`).

Type check: `npx tsc --noEmit` passes cleanly.
