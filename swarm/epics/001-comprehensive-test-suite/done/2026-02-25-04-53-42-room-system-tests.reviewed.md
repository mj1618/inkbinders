# Task: Room System Headless Tests

## What to Build

Create comprehensive headless tests for the room system using the `GameTestHarness` (which already has room/world extensions from Task 21). These tests verify room loading, exit detection, gate mechanics, room transitions, and player spawn behavior — all without a browser.

**File to create:** `src/engine/test/__tests__/rooms.test.ts`

## Prerequisites

- Task 21 (room-world-harness-extensions) is complete — the harness has `loadRoom()`, `enableRoomManager()`, `tryOpenGate()`, `pendingExit`, `transitionToRoom()`, and related APIs.
- Preset rooms exist in `src/engine/world/presetRooms.ts`: `TUTORIAL_CORRIDOR` (1920×540), `VERTICAL_SHAFT` (960×1080), `VINE_GARDEN` (1920×1080).

## Test Cases

### Room Loading (6 tests)

1. **Room loads platforms**: Loading `TUTORIAL_CORRIDOR` creates a TileMap with the correct number of platforms (check tilemap.platforms.length matches room's platform count + gate platforms).

2. **Player spawns at defaultSpawn**: After `h.loadRoom(TUTORIAL_CORRIDOR)`, player position matches `TUTORIAL_CORRIDOR.defaultSpawn`.

3. **Room dimensions set camera bounds**: After loading a room, camera world bounds match room `width` and `height`.

4. **Surface types preserved**: Loading `VINE_GARDEN` (which has bouncy/icy platforms) preserves `surfaceType` on the loaded TileMap platforms.

5. **Obstacles loaded**: Loading a room with obstacles creates the correct obstacle objects. Check `TUTORIAL_CORRIDOR` which has spikes.

6. **Multiple room loads**: Loading one room then another replaces the TileMap and obstacles entirely (no stale data from previous room).

### Exit Detection (5 tests)

7. **Exit zone triggers on overlap**: Position player inside an exit zone of `TUTORIAL_CORRIDOR` (e.g., the left exit at x=0). After `tick()`, `h.pendingExit` should be non-null.

8. **Exit targets correct room**: The `pendingExit.targetRoomId` matches the expected target room from the room definition.

9. **No exit when not in zone**: Position player in the center of the room, far from any exit. `pendingExit` should be null.

10. **Exit spawn point is set**: The `pendingExit.targetSpawnPoint` provides valid coordinates within the target room's bounds.

11. **Multiple exits detected independently**: Position player near one exit → get that exit; move player to another exit → get the other exit.

### Gate Mechanics (6 tests)

12. **Gate platform is solid**: Load a room with gates (e.g., `TUTORIAL_CORRIDOR` has a redaction gate). Before opening, the gate's platform blocks player movement — player cannot pass through.

13. **Gate opens with correct ability**: `h.tryOpenGate(gateId, ["redaction"])` returns `true` for a redaction gate.

14. **Gate does not open with wrong ability**: `h.tryOpenGate(gateId, ["margin-stitch"])` returns `false` for a redaction gate.

15. **Opened gate removes platform**: After opening a gate, the gate's platform is removed from the TileMap. Player can now pass through the gate position.

16. **Gate stays open across room transitions**: Using `enableRoomManager()`, open a gate, transition to another room, transition back — gate should still be open (gate state persists via RoomManager's `openedGates` set).

17. **Already-opened gate returns true**: Calling `tryOpenGate()` on an already-opened gate returns `true` (or at minimum does not error).

### Room Transitions via RoomManager (5 tests)

18. **RoomManager loads starting room**: `h.enableRoomManager(rooms, "tutorial-corridor")` loads the tutorial corridor as the current room.

19. **Transition changes current room**: After detecting an exit and calling `h.transitionToRoom(exit)`, the current room changes to the target room.

20. **Player spawns at exit's target spawn**: After transitioning, player position matches `exit.targetSpawnPoint`.

21. **Bidirectional transitions**: Go from room A to room B via exit, then from room B back to room A via the return exit. Verify both transitions work.

22. **RoomManager provides room list**: `getRoomIds()` returns all registered room IDs.

### Vine System Integration (3 tests)

23. **Vine system loads with room anchors**: After `h.loadRoom()` on a room with vine anchors and `h.enableVineSystem()`, vine anchors are available for attachment.

24. **Vine attachment works**: Position player near a vine anchor, call `h.attachVine()` — returns true, player enters swinging state.

25. **Vine detachment restores movement**: After attaching and swinging, `h.detachVine()` restores player velocity from swing momentum.

## Implementation Details

### Imports
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { GameTestHarness } from '../GameTestHarness';
import { TUTORIAL_CORRIDOR, VERTICAL_SHAFT, VINE_GARDEN, PRESET_ROOMS } from '@/engine/world/presetRooms';
```

### Approach
- Use `describe()` blocks for each category: "Room Loading", "Exit Detection", "Gate Mechanics", "Room Transitions", "Vine Integration"
- Use `beforeEach()` to create a fresh `GameTestHarness` for each test
- Use the preset rooms (`TUTORIAL_CORRIDOR`, `VERTICAL_SHAFT`, `VINE_GARDEN`) as test fixtures — they already have gates, exits, obstacles, and vine anchors defined
- For gate tests, look up the actual gate IDs from the preset room data rather than hardcoding
- For exit tests, look up actual exit zones from the preset room data
- Use `DEFAULT_PLAYER_PARAMS` thresholds rather than magic numbers for assertions
- Keep tests focused on behavioral correctness, not rendering

### Key harness methods to use
- `h.loadRoom(roomData)` — standalone room load
- `h.enableRoomManager(rooms, startId)` — multi-room setup
- `h.tryOpenGate(gateId, abilities)` — gate opening
- `h.pendingExit` — exit detection
- `h.transitionToRoom(exit)` — room transition
- `h.enableVineSystem(anchors, params?)` — vine setup
- `h.attachVine()` / `h.detachVine()` — vine mechanics
- `h.pos`, `h.vel`, `h.state`, `h.grounded` — player state inspection
- `h.tick()`, `h.tickN(n)`, `h.tickUntil()` — frame simulation

### What NOT to test here
- Visual rendering (that's the visual test suite)
- Day/night cycle integration (Task 23 covers that)
- Combat within rooms (already covered in combat tests)
- Ability activation details (already covered in ability tests)

## Verification

Run `npm run test:run` — all new tests in `rooms.test.ts` should pass, and all existing tests should continue passing. Target: 25 test cases, 0 failures.

## Files to Create/Modify

- **Create:** `src/engine/test/__tests__/rooms.test.ts`
- **Read (reference only):** `src/engine/test/GameTestHarness.ts`, `src/engine/world/presetRooms.ts`, `src/engine/world/Room.ts`, `src/engine/world/RoomManager.ts`

## Completion Summary

### Files Created
- `src/engine/test/__tests__/rooms.test.ts` — 25 test cases across 5 describe blocks

### What Was Built
All 25 specified test cases implemented:

- **Room Loading (6 tests)**: Platform loading with gate platforms, defaultSpawn positioning, camera bounds, surface type preservation, obstacle loading, multiple room replacement
- **Exit Detection (5 tests)**: Exit zone overlap detection, correct target room, no false positives in center, valid spawn coordinates, independent multi-exit detection
- **Gate Mechanics (6 tests)**: Gate platform solidity, correct ability opens, wrong ability blocked, platform removal on open, persistence across room transitions via RoomManager's openedGates set, already-opened gate no-op
- **Room Transitions via RoomManager (5 tests)**: Starting room load, transition to target, player spawn at target, bidirectional transitions, getRoomIds coverage
- **Vine System Integration (3 tests)**: Vine anchor loading from room data, vine attachment within range, detach with momentum transfer

### Key Implementation Detail
Used `cloneRoom()` / `clonePresetRooms()` helpers (JSON deep clone) to prevent cross-test mutation of shared `TUTORIAL_CORRIDOR`/`PRESET_ROOMS` constants — the harness's `loadRoom` and `tryOpenGate` mutate gate `opened` state on the room data object directly.

### Results
- 25/25 new tests passing
- 299/299 total tests passing (all existing tests unaffected)
- `npx tsc --noEmit` clean

## Review Notes (reviewer: 880f75f9)

### Issues Found & Fixed
1. **Unused import** — `EXIT_ZONE_DEPTH` was imported from `@/engine/world/Room` but never used in any test. Removed the import.

### Verified Correct
- All 25 tests pass (25/25), full suite remains green (299/299)
- TypeScript type-check clean (`npx tsc --noEmit`)
- `cloneRoom()` / `clonePresetRooms()` pattern correctly prevents cross-test mutation of preset room constants
- Gate mechanics tests correctly reflect the harness `tryOpenGate` behavior (returns `false` for already-opened gates, which differs from `RoomManager.tryOpenGate` returning `true` — both are correct for their respective APIs)
- Exit detection tests correctly use `enableRoomManager` + `tick()` to trigger `checkExits()`
- Vine integration tests correctly handle anchor-to-player offset via `h.player.size` and verify momentum transfer on detach
- No frame-rate dependent issues — tests use fixed-timestep `tick()`/`tickN()` as expected
- No memory leaks — all tests create fresh harnesses in `beforeEach`
