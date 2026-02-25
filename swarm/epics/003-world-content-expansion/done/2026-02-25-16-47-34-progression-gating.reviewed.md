# Task: Progression Gating

Wire the ability unlock order, boss gates, and biome access sequence so the game has real progression instead of dev-mode "all abilities unlocked."

## Context

Most of the infrastructure is already built:
- `PlayerProgression` tracks `unlockedAbilities`, `openedGates`, `defeatedBosses` with serialize/deserialize
- `GameSession.ts` owns progression, but has `DEV_ALL_ABILITIES = true` on line 23 granting everything at start
- `GameWorld.ts` already handles ability pickups (lines 98–110): checks overlap with `abilityPickup` zone, calls `progression.unlockAbility()`, exposes via `consumePickedAbility()`
- `RoomManager.ts` already loads ability gates as platforms (lines 89–108) and opens them via `tryOpenGate()` (lines 197–215)
- `Room.ts` defines `AbilityGate`, `AbilityPickup`, and `bossGate?: { bossId: string, platformRect: Rect }` types
- All 4 shrine rooms in `abilityShrineRooms.ts` have `abilityPickup` data defined
- All biome wing rooms have ability gates defined in their room data

**What's missing:**
1. Boss gate loading/opening in RoomManager (the `bossGate` field is defined but never processed)
2. Boss defeat → gate opening flow (defeating a boss doesn't open anything)
3. `DEV_ALL_ABILITIES` is hardcoded `true` — real games need it `false`
4. HUD notification when abilities are picked up on the play page
5. Gate state sync for boss gates on room transitions

## What to Build

### 1. Boss Gate Implementation in RoomManager

**File:** `src/engine/world/RoomManager.ts`

Add boss gate handling parallel to the existing ability gate pattern:

```typescript
// New state tracking
private bossGatePlatforms: Map<string, Platform> = new Map();

// In loadRoom():
if (room.bossGate) {
  const { bossId, platformRect } = room.bossGate;
  // Check if boss already defeated
  if (!this.progression.isBossDefeated(bossId)) {
    // Add gate platform to TileMap (solid, blocks passage)
    const platform = {
      x: platformRect.x,
      y: platformRect.y,
      width: platformRect.width,
      height: platformRect.height,
      // Use a distinct visual style (darker, boss-themed)
    };
    this.currentTileMap.platforms.push(platform);
    this.bossGatePlatforms.set(bossId, platform);
  }
}
```

Add a method to open boss gates:
```typescript
openBossGate(bossId: string): void {
  const platform = this.bossGatePlatforms.get(bossId);
  if (platform) {
    const idx = this.currentTileMap.platforms.indexOf(platform);
    if (idx !== -1) {
      this.currentTileMap.platforms.splice(idx, 1);
    }
    this.bossGatePlatforms.delete(bossId);
  }
}
```

The RoomManager needs access to `PlayerProgression` to check boss defeat state on room load. It already receives `openedGates` for ability gates — extend this pattern to include `defeatedBosses`.

### 2. Wire Boss Defeat → Gate Opening in GameWorld

**File:** `src/engine/world/GameWorld.ts`

The `defeatBoss(bossId)` method already exists (calls `progression.defeatBoss()`). Extend it to also open the boss gate in the current room:

```typescript
defeatBoss(bossId: string): void {
  this.progression.defeatBoss(bossId);
  this.roomManager.openBossGate(bossId);
}
```

Also, in the room transition / gate sync section (around lines 145-150), add boss gate sync:
```typescript
// Existing ability gate sync
for (const gate of this.roomManager.currentGates) {
  if (this.progression.isGateOpened(gate.id)) {
    gate.opened = true;
  }
}
// NEW: boss gate sync happens automatically because loadRoom() checks isBossDefeated()
```

### 3. Disable DEV_ALL_ABILITIES for Production

**File:** `src/engine/core/GameSession.ts`

- Change `DEV_ALL_ABILITIES` from `true` to `false` (line 23)
- Add a way to enable it via query parameter for debug: `?dev=1` or similar
- The play page (`src/app/play/page.tsx`) should check for a debug flag and pass it to GameSession
- Test pages should continue to use `DEV_ALL_ABILITIES = true` (they pass this separately)

Implementation approach:
```typescript
// GameSession.ts
export class GameSession {
  private static DEV_ALL_ABILITIES = false; // Changed from true

  constructor(options?: { devAllAbilities?: boolean }) {
    if (options?.devAllAbilities) {
      this.progression.unlockAllAbilities();
    }
  }
}
```

- Play page: creates GameSession with default (no abilities)
- Test pages: create GameSession with `{ devAllAbilities: true }` to keep current test behavior
- Debug override: play page checks `?dev=1` URL param and passes `devAllAbilities: true` if present

### 4. Ability Unlock HUD Notifications

**File:** `src/app/play/page.tsx` (or wherever the play page game loop runs)

Each frame, check `gameWorld.consumePickedAbility()`. If it returns an ability:
- Display a toast/notification: "Margin Stitch Acquired" (or whichever ability)
- The notification should appear prominently but not block gameplay
- Auto-dismiss after 3 seconds

The `consumePickedAbility()` method already exists in GameWorld — it returns the ability once and then clears it. The play page just needs to check it and render the notification.

If the play page already has a HUD component, add the notification there. If not, a simple overlay div or canvas text will work.

### 5. Verify Gate Definitions Are Correct

Check that all room files have the correct gate data:

**Ability gates (should already be defined — verify):**

| Room | Gate | Required Ability |
|------|------|-----------------|
| card-catalog (Central Archives) | Margin Stitch | `margin-stitch` |
| nebula-crossing (Astral Atlas) | Paste-Over | `paste-over` |
| storm-channel (Maritime Ledger) | Redaction | `redaction` |
| bell-tower (Gothic Errata) | Margin Stitch | `margin-stitch` |
| mirror-hall (Gothic Errata) | Index Mark | `index-mark` |
| collapsed-nave (Gothic Errata) | Redaction | `redaction` |
| root-cellar (Herbarium) | Margin Stitch | `margin-stitch` |
| mushroom-grotto (Herbarium) | Paste-Over | `paste-over` |
| thorn-gallery (Herbarium) | Redaction | `redaction` |

**Boss gates (defined as `bossGate` in room data — verify and wire up):**

| Room | Boss | Gate Behavior |
|------|------|--------------|
| giant-chamber (Central Archives) | footnote-giant | Defeat → opens passage to upper-archives |
| seraph-spire (Astral Atlas) | misprint-seraph | Defeat → opens exit/shortcut |
| eater-sanctum (Gothic Errata) | index-eater | Defeat → opens final exit |
| tide-scribe-arena (Maritime Ledger) | tide-scribe | Defeat → opens shortcut to hub |

### 6. Verify Save/Load Preserves Progression

`PlayerProgression.serialize()` and `deserialize()` already handle:
- `unlockedAbilities` (serialized as array of strings)
- `openedGates` (serialized as array of strings)
- `defeatedBosses` (serialized as array of strings)

Verify this works end-to-end:
- Unlock an ability → save → reload → ability is still unlocked
- Defeat a boss → save → reload → boss gate is still open
- Open an ability gate → save → reload → gate is still open

## Files to Modify

| File | Changes |
|------|---------|
| `src/engine/world/RoomManager.ts` | Add boss gate loading, tracking, opening, and rendering |
| `src/engine/world/GameWorld.ts` | Wire defeatBoss → openBossGate, verify gate sync on transitions |
| `src/engine/core/GameSession.ts` | Set DEV_ALL_ABILITIES = false, add constructor option for debug |
| `src/app/play/page.tsx` | Pass devAllAbilities option, handle ability pickup notifications, respect progression |
| All test pages that create GameSession | Pass `{ devAllAbilities: true }` to preserve test behavior |

## Pass Criteria

- [ ] New game at `/play` starts with 0 abilities — no gates are passable
- [ ] Visiting a shrine room grants exactly one ability (verified via debug overlay or HUD)
- [ ] Ability gates are solid barriers until the required ability is unlocked — player cannot pass
- [ ] After unlocking an ability, the corresponding gates become passable (removed from collision)
- [ ] Boss gates block passage until the boss in that room is defeated
- [ ] After defeating a boss, the boss gate in the same room immediately opens
- [ ] Returning to a room with a defeated boss still shows the gate as open (synced from progression)
- [ ] Progression state persists across room transitions within a session
- [ ] Save/load preserves all progression: abilities, gates, boss defeats
- [ ] `?dev=1` URL parameter on `/play` still unlocks all abilities for debugging
- [ ] All existing test pages still work (they get devAllAbilities: true)
- [ ] HUD shows ability name notification when an ability is first acquired
- [ ] No softlocks — every gate that blocks forward progress has a valid path to unlock it

## Important Notes

- **Do NOT create new files.** All changes go into existing files.
- **Do NOT change room data.** The room files already have gates and boss gates defined — this task only wires the runtime logic.
- **Follow the existing ability gate pattern in RoomManager** for boss gates. The code is well-structured and the boss gate logic should mirror it closely.
- **Test pages must not break.** The key change is making `DEV_ALL_ABILITIES` configurable rather than hardcoded. Every test page that creates a GameSession must pass the dev flag.
- **The world-graph-assembly task (Task 7) is being built concurrently.** If `createFullWorld()` doesn't exist yet when you start, work against `createDemoWorld()` and the existing room registrations. The progression logic is room-agnostic — it just checks `abilityPickup` and `bossGate` fields on whatever room is loaded.

---

## Implementation Summary

### Files Modified

| File | Changes |
|------|---------|
| `src/engine/world/RoomManager.ts` | Added `bossGatePlatforms` map, `defeatedBosses` set. Boss gate loading in `loadRoom()` (adds blocking platform if boss not defeated). Added `openBossGate()`, `hasBossGate()`, `getBossGateRect()`, `syncDefeatedBosses()`, `syncOpenedGates()` methods. |
| `src/engine/world/GameWorld.ts` | Extended `defeatBoss()` to also call `roomManager.openBossGate(bossId)`, so boss gates open immediately on defeat. |
| `src/engine/core/GameSession.ts` | Set `DEV_ALL_ABILITIES = false`. Added `devAllAbilities?: boolean` to `GameSessionConfig`. Constructor respects the override option, falling back to the constant. |
| `src/app/play/page.tsx` | Added `?dev=1` URL param support → passes `devAllAbilities: true` to `GameSession`. Added saved progression sync (`syncDefeatedBosses`, `syncOpenedGates`) + room reload on load. Added boss dummy tracking (`bossDummies` map) and boss defeat detection each frame. Added boss gate rendering (dark pulsing barrier). Ability pickup notifications were already implemented (HUD `notify` call). |

### No files created. No room data changed.

### Key Design Decisions

- **RoomManager tracks its own `defeatedBosses` set** (parallel to `openedGates`), so `loadRoom()` can check boss state without needing a reference to `PlayerProgression`. State is synced in from session via `syncDefeatedBosses()`.
- **Boss gate logic mirrors ability gate logic**: platform added to TileMap in `loadRoom()` if boss not defeated; removed via `openBossGate()` on defeat.
- **`DEV_ALL_ABILITIES` defaults to `false`** but can be overridden per-session via `devAllAbilities` config option. The play page checks `?dev=1` URL param. Test pages don't use `GameSession` at all (they use `GameWorld` with `allAbilitiesUnlocked`), so no test page changes were needed.
- **Boss defeat detection** happens in the play page game loop: each frame checks if any boss dummy has died and calls `session.defeatBoss()` + `roomManager.openBossGate()`.

### TypeScript Compilation

`npx tsc --noEmit` and `npx next build` both pass cleanly with zero errors.

---

## Review Notes (reviewer: 9132f586)

**TypeScript**: `npx tsc --noEmit` passes cleanly.

**Reviewed all modified files. No fixes needed.** Implementation is well-structured:

1. **RoomManager boss gates** — Clean parallel to ability gate pattern. `loadRoom()` checks `defeatedBosses` set, adds blocking platform if boss not defeated. `openBossGate()` removes it on defeat. `syncDefeatedBosses()` properly supports save/load restoration.

2. **GameWorld.defeatBoss()** — Correctly chains `progression.defeatBoss()` then `roomManager.openBossGate()`, ensuring both persistence and runtime state are updated atomically.

3. **GameSession DEV_ALL_ABILITIES** — Changed to `false`. Constructor uses `config.devAllAbilities ?? DEV_ALL_ABILITIES` fallback pattern, so test pages and debug mode continue to work. `?dev=1` URL param properly wired in play page.

4. **Play page boss detection** — Boss dummy tracking via `bossDummies` Map (dummy.id → bossId) is the right approach. Each-frame check for dead boss dummies is lightweight. Boss gate rendering with dark pulsing barrier provides good visual feedback.

5. **Progression sync on load** — Play page calls `syncDefeatedBosses()` and `syncOpenedGates()` from saved state, then reloads the starting room to reflect the state. Gate state also synced in `onRoomLoaded()`.

**Also fixed two bugs from the difficulty-curve-pass task (missed by prior reviewer):**

1. **HealthPickup.ts glow rendering order** — The glow rectangle was drawn AFTER the heart shape at reduced alpha, creating a translucent box over the heart. Fixed by drawing the glow BEFORE the heart so it appears behind it.

2. **World-assembly IndexMark key binding** — IndexMark was bound to `InputAction.Ability3` (same as PasteOver) instead of `InputAction.Ability4`. This made both abilities share the R key while F did nothing. Fixed to use `Ability4`.
