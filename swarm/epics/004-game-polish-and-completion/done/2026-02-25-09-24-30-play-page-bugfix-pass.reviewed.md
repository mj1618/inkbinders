# Play Page Bugfix Pass — Final Quality Verification

## Goal

Do a systematic code review and fix pass on `src/app/play/page.tsx` and its integration with all engine systems. This is the final quality gate — every bug fixed here makes the game shippable. The play page is ~1,758 lines and wires together every system in the game.

**Process:** Read the play page top to bottom, cross-reference with engine code, identify bugs, fix them, then verify with `npx tsc --noEmit`.

## Known Bugs to Fix

These bugs were identified during planning. Fix each one.

### Bug 1: `buildObstaclesFromRoom` missing obstacle types

**File:** `src/app/play/page.tsx` lines 127-140

The `buildObstaclesFromRoom` helper only handles `"spikes"` and `"hazard_zone"`. The `"barrier"` and `"laser"` types silently fall through to `default: return createSpikes(...)`. This means barriers (which should be solid + have TileMap platforms) and lasers are wrongly created as spikes.

**Fix:** Add `case "barrier": return createBarrier(o.rect, o.damage);` and `case "laser": return createLaser(o.rect, o.damage);`. Import `createBarrier` and `createLaser` from `@/engine/physics/Obstacles` if not already imported. Check `Obstacles.ts` for the exact factory signatures — `createBarrier` needs a TileMap reference or creates a solid rect, while `createLaser` may have additional params.

**Note:** `RoomManager.loadRoom()` already handles all 4 types correctly in its own obstacle building. The play page's `buildObstaclesFromRoom` is called separately (likely for the Redaction system which needs a local `Obstacle[]` array). Make sure both paths produce consistent obstacles. If `RoomManager` already provides `currentObstacles`, consider using that instead of rebuilding.

### Bug 2: `computeCompletionPercent` uses wrong room count

**File:** `src/engine/core/GameSession.ts` line 241

```typescript
const roomPct = Math.min(this.visitedRooms.size / 90, 1);
```

The actual world has **43 rooms**, not 90. This means the rooms-visited contribution to completion % is roughly halved. A player who visits all 43 rooms gets `43/90 = 47.8%` room completion instead of 100%.

**Fix:** Change `90` to `43`. Better yet, make it a constant:

```typescript
const TOTAL_ROOM_COUNT = 43;
```

Also update the boss count denominator if needed — check whether it should be 3 (main bosses only, matches victory condition) or 4 (includes mini-boss). Currently it's `/ 4` on line 240, which includes the Tide Scribe mini-boss. If the Tide Scribe doesn't count for victory, consider whether it should count for completion. Keep it at 4 — defeating the optional mini-boss contributes to completion even if not required for victory. That's good design.

### Bug 3: Victory stats `totalRooms` may be wrong

**File:** Check where `VictoryStats.totalRooms` is set in the play page.

When the VictoryScreen is constructed, it receives stats including `totalRooms`. Make sure this matches the actual 43-room count, not some other hardcoded value. If it pulls from `computeCompletionPercent`, fixing Bug 2 fixes this too. If it's set independently, fix it there as well.

### Bug 4: Dual obstacle tracking — `currentObstacles` vs `roomManager.currentObstacles`

**File:** `src/app/play/page.tsx`

The play page maintains a local `currentObstacles` array (from `buildObstaclesFromRoom`) alongside `roomManager.currentObstacles`. These can diverge. The render path uses the play page's local array. The Redaction system targets the local array. But `RoomManager`'s obstacle handling is the authoritative source.

**Fix:** After `rebuildRoomSystems` (the room transition handler), check whether `currentObstacles` is being rebuilt from `roomManager.currentObstacles` or from `buildObstaclesFromRoom`. If both exist, remove the redundant one. The simplest fix: after room load, set `currentObstacles = roomManager.currentObstacles` (or a copy) instead of re-deriving. If `buildObstaclesFromRoom` adds information RoomManager doesn't have, document why.

### Bug 5: Fog input remap persistence after leaving Gothic Errata

**Files:** `src/app/play/page.tsx`, `src/engine/world/FogSystem.ts`

When the player leaves a Gothic Errata room (which has inversion/scramble fog zones), the input remap set by `input.setActionRemap()` might persist if not explicitly cleared on room transition.

**Fix:** In the room transition handler (`rebuildRoomSystems` or wherever rooms are swapped), add `input.setActionRemap(null)` to clear any active fog remap. This ensures control effects from one room never leak into the next. Search the play page for where `setActionRemap` is called and verify it's also cleared.

### Bug 6: Vine interaction vs Ability1 key conflict

Both VineSystem (attach/detach) and MarginStitch use the `Ability1` action (E key). In Herbarium rooms that have both vines and stitch-able walls, pressing E could trigger both systems.

**Fix:** Check the update loop ordering. If VineSystem's attach check runs before MarginStitch's activation check, and the vine attach consumes the input, this might already work. But verify: does `consumeBufferedInput(Ability1)` get called by VineSystem? If VineSystem uses `isPressed(Ability1)` without consuming, MarginStitch will also see the press. The fix is to have whichever system acts first consume the input. Vine attach should take priority when near a vine anchor (it's the local biome mechanic).

### Bug 7: GravityWell low-gravity persistence after leaving Astral Atlas

When the player leaves an Astral Atlas room, the `globalGravityMultiplier` override on `player.params.riseGravity / fallGravity / maxFallSpeed` might not be restored.

**Fix:** In the room transition handler, after loading a new room, check if the previous room was an Astral Atlas biome room. If so, restore `player.params.riseGravity`, `player.params.fallGravity`, and `player.params.maxFallSpeed` to their base values. Or better: always reset to base params at the start of each room load, then apply the new room's biome modifiers. Look for where gravity multiplier is applied in the update loop and verify it's biome-conditional.

## Investigation Bugs (May or May Not Exist)

Check for these during your code review. Fix if present, skip if not an issue.

### Check 1: Boss TargetDummy groundY

Boss enemies are `TargetDummy` instances. `TargetDummy` uses a simplified `groundY` field instead of full TileMap collision. When a boss spawns in a room, verify that `groundY` matches the actual floor platform Y in that room. If the room has non-standard floor heights, the boss might float or clip.

Check: `giant-chamber`, `seraph-spire`, `eater-sanctum`, `tide-scribe-arena` room definitions. Find the boss enemy spawn positions and the floor platform Y values. Do the Y coordinates make sense (enemy bottom at floor surface)?

### Check 2: Health pickup placement

The play page has a `HealthPickupManager`. Verify that health pickups are placed in enough rooms, especially before boss fights. Check which rooms have health pickups and whether the progression path has enough healing opportunities.

### Check 3: Room name display

`GameHUD.showRoomName(name)` is called on room transitions. Check that every room has a `displayName` in its `RoomData`. If any room has an empty or undefined display name, it'll show as blank.

### Check 4: Ability notification text

When abilities are unlocked at shrines, the HUD notification should show the ability name. Check the notification format string — does it use the ability name correctly, or could it show "undefined"?

### Check 5: Fall-off respawn

The play page has fall-off detection (Y > room height + margin). On fall-off: 1 damage + respawn at room spawn point. Check that every room has a valid `defaultSpawn` position that's on solid ground.

### Check 6: Camera bounds per room

When a room loads, camera bounds should be set to the room dimensions. Check that `camera.setBounds()` is called with the correct room size. Rooms vary from 960×540 to 1920×1080.

## Systematic Review Checklist

After fixing the known bugs, do a section-by-section review:

1. **Imports section** — Are all imported modules actually used? Any missing imports?
2. **rebuildRoomSystems** — Does it correctly tear down old room systems and set up new ones?
3. **Update loop** — Is the execution order correct? (input → player → abilities → combat → biome systems → corruption → HUD)
4. **Render loop** — Are layers in the right order? (background → platforms → obstacles → entities → FX → HUD → overlays)
5. **Room transition** — Does the fade-to-black transition cleanly swap all state?
6. **Save/load** — Does saving capture all state? Does loading restore it correctly?
7. **Boss defeat** — Does defeating a boss correctly: trigger notification, open gate, track in session, rebuild surfaces?
8. **Victory trigger** — If victory-ending task is integrated, verify the trigger logic.
9. **Card integration** — If ink-cards task is integrated, verify card drops, deck overlay, stat application.

## Verification

After all fixes:

1. `npx tsc --noEmit` — Must pass with zero errors
2. Read through every fix and verify it doesn't introduce new issues
3. Check that no imports are broken
4. Verify the play page still renders correctly by checking the component structure

## Files Likely Modified

- `src/app/play/page.tsx` (primary — most fixes here)
- `src/engine/core/GameSession.ts` (completion percent fix)
- Possibly room data files if boss groundY or health pickup placement needs fixing
- Possibly `src/engine/world/RoomManager.ts` if obstacle tracking needs consolidation

---

## Completion Summary

### Bugs Fixed

**Bug 1 + Bug 4 (combined fix): Obstacle tracking consolidation**
- Removed the redundant `buildObstaclesFromRoom()` helper entirely
- Play page now uses `roomManager.currentObstacles` directly (the authoritative source)
- This fixes both the missing barrier/laser types AND the dual-tracking divergence
- Removed unused imports: `createSpikes`, `createBarrier`, `createLaser`, `createHazardZone`
- Removed unused imports: `TileMap`, `COLORS`

**Bug 2: `computeCompletionPercent` wrong room count**
- Changed room denominator from `90` to `43` (actual room count)
- Extracted all denominators into named constants: `TOTAL_ABILITIES`, `TOTAL_BOSSES`, `TOTAL_ROOMS`

**Bug 3: Victory stats totalRooms**
- Already correct — uses `rooms.size` which dynamically reflects actual room count

**Bug 5: Fog input remap persistence**
- Already fixed — `rebuildRoomSystems()` calls `input.setActionRemap(null)`, and the update loop clears remap when `fogSystem` is null

**Bug 6: Vine vs Ability1 key conflict**
- Changed MarginStitch guard to check `vineSystem.isSwinging` live instead of a cached variable
- This prevents both vine attach AND MarginStitch firing on the same E key press

**Bug 7: GravityWell low-gravity persistence**
- Already handled — the `else` branch resets gravity to `DEFAULT_PLAYER_PARAMS` every frame when `gravityWellSystem` is null

### Investigation Findings

- **Check 1 (Boss groundY)**: All boss rooms correct. Seraph boss spawns at y=300 intentionally (floating boss), groundY at floor is fine for TargetDummy stand-in.
- **Check 2 (Health pickups)**: 13+ rooms with health pickups, well distributed across all biome regions.
- **Check 3 (Room names)**: All 43 rooms have valid display names.
- **Check 4 (Ability notifications)**: Proper ability name lookup via `abilityNames` record, no "undefined" risk.
- **Check 5 (defaultSpawn)**: Fixed `whirlpool-depths` spawn from `{ x: 100, y: 100 }` (ceiling) to `{ x: 100, y: 1080 - 64 - T }` (floor level).
- **Check 6 (Camera bounds)**: Correctly set in both initial setup and room transitions.

### Files Changed

- `src/app/play/page.tsx` — Removed `buildObstaclesFromRoom`, used `roomManager.currentObstacles` directly, fixed vine/stitch input conflict, cleaned up unused imports
- `src/engine/core/GameSession.ts` — Fixed `computeCompletionPercent` room count (90 → 43), added named constants
- `src/engine/world/maritimeLedgerRooms.ts` — Fixed `whirlpool-depths` defaultSpawn position

### Verification

- `npx tsc --noEmit` passes with zero errors

---

## Review (agent 9702459f)

All fixes verified — no issues found.

- **Bug 2 (TOTAL_ROOMS = 43):** Verified against all room files. 43 rooms confirmed (1 hub + 11 herbarium + 6 archives + 8 astral + 8 gothic + 8 maritime).
- **Bug 1+4 (obstacle consolidation):** `currentObstacles` correctly references `roomManager.currentObstacles` at both init (line 487) and room transition (line 698). No stale references.
- **Bug 6 (vine/stitch conflict):** Vine attach on line 1224-1229 sets `isSwinging = true` immediately. MarginStitch guard `!(vineSystem?.isSwinging)` on line 1380 correctly prevents double-activation on the same frame.
- **Bug 5 (fog remap):** `rebuildRoomSystems` clears remap (line 737), and the update loop also clears when fogSystem is null (line 1269).
- **whirlpool-depths spawn:** Fixed from y=100 (ceiling) to y=984 (floor level, matching floor platform at y=1048 minus player height 64). Note: storm-channel exit targetSpawnPoint `{ x: 100, y: 100 }` is correctly left as-is since it's the "entering from the top" position.
- TypeScript: zero errors. Tests: 427/427 passing.

---

## Second Review (agent 774c2752)

### Fix: storm-channel → whirlpool-depths targetSpawnPoint

The storm-channel exit to whirlpool-depths had `targetSpawnPoint: { x: 100, y: 100 }`. While not inside a platform, this is far from the ceiling gap (x=400-560) that the player is logically entering through. Changed to `{ x: 480, y: T + 48 }` (center of ceiling gap, just below ceiling) for natural top-entry feel.

### All other changes verified — no additional issues found.

- `npx tsc --noEmit`: zero errors
- All 427 tests pass
