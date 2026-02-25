# Task: Full Playthrough Test — Wire Full World to Play Page + E2E Verification

## Context

The game has ~46 rooms across 6 regions, 4 ability shrines, 3 bosses, 1 mini-boss, ability gates, boss gates, and progression tracking — all built and individually tested. But the `/play` page currently only loads 3 rooms from `PRESET_ROOMS` (tutorial-corridor, vertical-shaft, vine-garden). It never calls `createFullWorld()` for actual gameplay.

**Critical gaps in `/play` page (`src/app/play/page.tsx`):**
1. Uses `PRESET_ROOMS` (3 rooms) instead of `createFullWorld()` (all ~46 rooms)
2. No biome-specific system loading: VineSystem, GravityWellSystem, CurrentSystem, FogSystem are absent
3. Without these, Herbarium Wing vine swinging, Astral Atlas gravity wells, Maritime Ledger current streams, and Gothic Errata fog/inversion won't work

**What IS wired correctly on the play page:**
- GameSession with progression tracking, ability unlock, boss defeat, gate opening
- Ability pickup detection (checks `abilityPickup` zones on rooms)
- Boss defeat → `roomManager.openBossGate()` flow
- Auto-gate opening when player has required ability
- Combat system, 4 abilities, day/night, HUD, pause menu, save/load
- Fall-off respawn, health pickups
- Room transition with fade-to-black

## What to Build

### 1. Wire `createFullWorld()` into the Play Page

**File:** `src/app/play/page.tsx`

Replace the `PRESET_ROOMS` room map with `createFullWorld()`:

```typescript
// REPLACE THIS:
const rooms = new Map<string, typeof PRESET_ROOMS[string]>();
for (const [id, data] of Object.entries(PRESET_ROOMS)) {
  rooms.set(id, data);
}

// WITH THIS:
const { worldGraph, rooms } = createFullWorld();
```

Then pass the full `rooms` map to `RoomManager`. The `createFullWorld()` import is already present on line 47. Remove the `PRESET_ROOMS` import since it's no longer needed for room loading (keep `PRESET_ROOM_NAMES` if it's used for display names).

Also, the dev-mode validation block (lines 358-367) that calls `createFullWorld()` separately can be removed or simplified since we're now using the full world by default.

### 2. Add Per-Room Biome System Loading

**File:** `src/app/play/page.tsx`

Add imports for biome systems:
```typescript
import { VineSystem } from "@/engine/world/VineSystem";
import { GravityWellSystem } from "@/engine/world/GravityWellSystem";
import { CurrentSystem } from "@/engine/world/CurrentSystem";
import { FogSystem } from "@/engine/world/FogSystem";
```

Add mutable system references alongside existing `dummies`, `currentObstacles`, etc.:
```typescript
let vineSystem: VineSystem | null = null;
let gravityWellSystem: GravityWellSystem | null = null;
let currentSystem: CurrentSystem | null = null;
let fogSystem: FogSystem | null = null;
```

In `rebuildRoomSystems()`, create biome systems based on current room data:
```typescript
// After existing obstacle/enemy setup:

// Vine system
vineSystem = null;
if (roomManager.currentRoom.vineAnchors.length > 0) {
  vineSystem = new VineSystem(roomManager.currentRoom.vineAnchors.map(a => ({
    position: a.position,
    ropeLength: a.ropeLength ?? 120,
    active: true,
    type: a.type ?? "swing",
  })));
}

// Gravity well system (Astral Atlas biome)
gravityWellSystem = null;
if (roomManager.currentRoom.gravityWells?.length) {
  const { GravityWellSystem } = await import("@/engine/world/GravityWellSystem");
  gravityWellSystem = new GravityWellSystem(
    roomManager.currentRoom.gravityWells.map(w => ({
      id: w.id,
      position: w.position,
      radius: w.radius,
      strength: w.strength,
      type: w.type,
      active: true,
      color: w.type === "attract" ? "#c084fc" : "#f97316",
    }))
  );
}

// Current system (Maritime Ledger biome)
currentSystem = null;
if (roomManager.currentRoom.currentZones?.length) {
  currentSystem = new CurrentSystem(
    roomManager.currentRoom.currentZones.map(z => ({
      id: z.id,
      rect: z.rect,
      direction: z.direction,
      strength: z.strength,
      active: true,
      type: z.type,
      clockwise: z.clockwise,
      gustOnDuration: z.gustOnDuration,
      gustOffDuration: z.gustOffDuration,
    }))
  );
}

// Fog system (Gothic Errata biome)
fogSystem = null;
if (roomManager.currentRoom.fogZones?.length) {
  fogSystem = new FogSystem(
    roomManager.currentRoom.fogZones.map(z => ({
      id: z.id,
      rect: z.rect,
      type: z.type,
      density: z.density,
      active: true,
    }))
  );
}
```

**IMPORTANT**: Check the actual constructor signatures and the room data types to make sure you pass the right shapes. Look at how the test pages wire these systems (e.g., `/test/herbarium-wing`, `/test/biome/astral-atlas`, `/test/biome/maritime-ledger`, `/test/biome/gothic-errata`) for reference.

### 3. Wire Biome Systems into the Update Loop

In the engine `onUpdate()` callback, after player movement and before combat:

```typescript
// Vine system
if (vineSystem) {
  // Check vine attach/detach (same pattern as herbarium-wing test page)
  // When attached: player.active = false, position from swingPosition
  // When detached: player.active = true, velocity from swingVelocity
  vineSystem.update(dt, player, input);
}

// Gravity wells (Astral Atlas)
if (gravityWellSystem) {
  // Apply global gravity multiplier to player params
  const gMult = gravityWellSystem.params.globalGravityMultiplier;
  player.params.riseGravity = DEFAULT_PLAYER_PARAMS.riseGravity * gMult;
  player.params.fallGravity = DEFAULT_PLAYER_PARAMS.fallGravity * gMult;
  player.params.maxFallSpeed = DEFAULT_PLAYER_PARAMS.maxFallSpeed * gMult;

  // Apply well forces
  const playerState = player.stateMachine.getCurrentState();
  if (playerState !== "DASHING" || gravityWellSystem.params.affectsDash) {
    gravityWellSystem.applyToVelocity(playerCenter, player.velocity, dt);
  }
} else {
  // Reset to default gravity when not in a gravity well room
  player.params.riseGravity = DEFAULT_PLAYER_PARAMS.riseGravity;
  player.params.fallGravity = DEFAULT_PLAYER_PARAMS.fallGravity;
  player.params.maxFallSpeed = DEFAULT_PLAYER_PARAMS.maxFallSpeed;
}

// Current streams (Maritime Ledger)
if (currentSystem) {
  currentSystem.updateGusts(dt);
  const playerState = player.stateMachine.getCurrentState();
  currentSystem.applyToPlayer(player, dt, player.grounded, playerState === "DASHING");
  currentSystem.updateParticles(dt, camera);
}

// Fog system (Gothic Errata)
if (fogSystem) {
  const fogState = fogSystem.update(player.getBounds(), player.isDashing);
  const remap = fogSystem.getActiveRemap();
  input.setActionRemap(remap);
}
```

Again, check the actual API signatures by reading the biome test pages. The above is pseudo-code showing the pattern — adapt to the actual method signatures.

### 4. Wire Biome Systems into the Render Loop

In `engine.onRender()`, add biome system rendering in world space:

```typescript
// Before player rendering:
if (vineSystem) {
  vineSystem.render(rCtx, camera);
}
if (gravityWellSystem) {
  gravityWellSystem.render(rCtx, camera, time);
}
if (currentSystem) {
  currentSystem.renderFlow(rCtx, camera, time);
}
```

In the screen-space layer (after HUD), add fog overlay:
```typescript
if (fogSystem) {
  fogSystem.renderFogOverlay(screenCtx, CANVAS_WIDTH, CANVAS_HEIGHT);
  fogSystem.renderControlEffects(screenCtx, CANVAS_WIDTH, CANVAS_HEIGHT);
}
```

### 5. Handle Room Name Display

The play page uses `PRESET_ROOM_NAMES` for display names, but the full world rooms have `name` properties on the `RoomData` objects. Update the room name logic to prefer `room.name`:

```typescript
// Instead of:
const roomName = PRESET_ROOM_NAMES[roomManager.currentRoom.id] ?? roomManager.currentRoom.name;

// Just use:
const roomName = roomManager.currentRoom.name ?? roomManager.currentRoom.id;
```

### 6. Verify Type Compilation

After wiring, run `npx tsc --noEmit` to verify everything compiles. Fix any type errors. Common issues:
- Room data field name mismatches between `RoomData` type and biome system constructors
- Missing optional chaining on optional fields
- Import paths

### 7. Manual Playthrough Verification

Load the game at `/play?slot=1&new=1` and verify the following critical path:

**Hub & Tutorial:**
- [ ] Spawn in Tutorial Corridor (or Scribe Hall per `GameSession.getStartingRoomId()`)
- [ ] HUD renders (health, abilities, weapon, clock)
- [ ] Room name displays on entry

**Herbarium Wing (first biome):**
- [ ] Navigate from Tutorial Corridor → Vine Vestibule
- [ ] Vines work (attach, swing, detach) — VineSystem is active
- [ ] Reach Stitch Shrine → "Margin Stitch Acquired" notification
- [ ] Ability gate opens when approaching with Margin Stitch

**Central Archives:**
- [ ] Navigate from Scribe Hall → Archive Passage → Reading Room
- [ ] Enemies spawn and take damage
- [ ] Reach Giant's Chamber → Footnote Giant (boss dummy, 10 HP)
- [ ] Defeat boss → "Boss defeated — gate opened!" notification
- [ ] Passage to Upper Archives opens

**Astral Atlas Wing:**
- [ ] Enter Observatory Bridge from Upper Archives
- [ ] Gravity wells active — player floats (0.4× gravity)
- [ ] Reach Paste Shrine → "Paste-Over Acquired" notification
- [ ] Navigate to Seraph's Spire → defeat Misprint Seraph

**Maritime Ledger Wing:**
- [ ] Enter Harbor Approach from Scribe Hall
- [ ] Current streams push player — CurrentSystem is active
- [ ] Reach Redaction Shrine → "Redaction Acquired" notification
- [ ] Navigate to Tide Scribe's Dock → defeat Tide Scribe

**Gothic Errata Wing:**
- [ ] Enter Crypt Entrance from Upper Archives
- [ ] Fog zones limit visibility — FogSystem is active
- [ ] Inversion zones swap left/right
- [ ] Reach Index Shrine → "Index Mark Acquired" notification
- [ ] Navigate to Eater's Sanctum → defeat Index Eater

**Persistence:**
- [ ] Save game via pause menu
- [ ] Reload page → load save → resume at last room with abilities intact
- [ ] Gates that were opened remain open
- [ ] Defeated bosses remain defeated

**No Softlocks:**
- [ ] Player can always backtrack to hub from any room
- [ ] Every exit has a return exit in the target room
- [ ] Fall-off respawn works in all rooms

### 8. Fix Integration Issues

As you discover bugs during the wiring and verification, fix them. Common issues to watch for:

- **Missing return exits**: Room A has exit to Room B, but Room B has no exit back to Room A. Fix in the room data file.
- **Boss spawn position over pits**: Boss TargetDummy spawns where there's no floor. Adjust `groundY` or spawn position in room data.
- **Gate not blocking**: Gate platform rect doesn't actually block the passage. Verify gate rect placement.
- **Biome system constructor mismatch**: The room data field types might not exactly match what the system constructor expects. Add adapters as needed.
- **Vine interaction conflicts with abilities**: Player pressing E might activate vine OR Margin Stitch. Need to disambiguate (vine takes priority when in range).

## Files to Create/Modify

**Primary modifications:**
- `src/app/play/page.tsx` — main integration: full world, biome systems, rendering

**Possible room data fixes:**
- `src/engine/world/centralArchivesRooms.ts`
- `src/engine/world/astralAtlasRooms.ts`
- `src/engine/world/maritimeLedgerRooms.ts`
- `src/engine/world/gothicErrataRooms.ts`
- `src/engine/world/herbariumRooms.ts`
- `src/engine/world/abilityShrineRooms.ts`
- `src/engine/world/demoWorld.ts`
- `src/engine/world/presetRooms.ts`

## Pass Criteria

1. `npx tsc --noEmit` passes with no errors
2. `/play?slot=1&new=1` starts in the full world (all ~46 rooms loaded)
3. Player can reach every biome wing from the hub
4. VineSystem works in Herbarium Wing rooms on the play page
5. GravityWellSystem works in Astral Atlas Wing rooms
6. CurrentSystem works in Maritime Ledger Wing rooms
7. FogSystem works in Gothic Errata Wing rooms
8. All 4 abilities unlock at correct shrine rooms
9. All ability gates block until required ability is earned
10. All boss gates open when boss is defeated
11. Save/load preserves progression (abilities, gates, bosses, room)
12. No JavaScript console errors during normal play
13. No softlocks — player can always reach hub from any room
14. Every room transition works (no "room not found" errors)

---

## Implementation Summary

### Files Modified

- **`src/app/play/page.tsx`** — Primary integration file. All changes in this one file.

### What Was Done

1. **Replaced `PRESET_ROOMS` (3 rooms) with `createFullWorld()` (~46 rooms)**
   - Removed `PRESET_ROOMS` and `PRESET_ROOM_NAMES` imports from `presetRooms.ts`
   - Now calls `createFullWorld()` which returns the full world graph + rooms map
   - Dev-mode world graph validation reuses the same `worldGraph` instance (no duplicate call)

2. **Added biome system imports and per-room loading**
   - Imported `VineSystem`, `GravityWellSystem`, `CurrentSystem`, `FogSystem` with their types
   - Created `buildBiomeSystems()` helper that creates biome system instances from room data
   - Maps `RoomVineAnchor` → `VineAnchor`, `GravityWellDef` → `GravityWell`, `CurrentZoneDef` → `CurrentZone`, `FogZoneDef` → `FogZone`
   - Called on initial room load and in `rebuildRoomSystems()` on every room transition
   - Clears fog input remap on room transition to prevent stale inversion/scramble

3. **Wired biome systems into update loop** (before combat section)
   - **VineSystem**: Sway animation, swing physics with directional input, jump-to-detach, jump-to-attach when near vine anchor
   - **GravityWellSystem**: Global gravity multiplier (0.4×) applied to player params, well forces applied to velocity, dash immunity check, gravity reset when leaving gravity rooms
   - **CurrentSystem**: Gust timer updates, force application via `applyToPlayer()`, particle spawning within camera viewport
   - **FogSystem**: `update()` with player bounds + dash state, input remap via `getActiveRemap()` → `input.setActionRemap()`

4. **Wired biome systems into render loop**
   - World-space: vine rendering (anchors + ropes), gravity well rendering (concentric rings + particles), current flow rendering (animated flow lines), fog zone boundaries (atmospheric borders)
   - Screen-space: fog overlay (radial visibility mask centered on player screen position), control effects (inversion red tint, scramble green glitch)

5. **Fixed room name display**
   - Replaced `PRESET_ROOM_NAMES[id]` fallback with `room.name ?? room.id`
   - Uses full world room data for transition room names

6. **Type compilation**: `npx tsc --noEmit` passes with zero errors

### Technical Notes

- Added `lastDt` variable to bridge dt from update loop to render loop (for vine/gravity well sprite animation controllers)
- `playerState` variable moved before biome section (was previously only in combat section) and duplicate removed
- Gravity params (riseGravity, fallGravity, maxFallSpeed) are reset to defaults when leaving gravity well rooms to prevent sticky low-gravity

---

## Review Notes (reviewer: 4fdd0829)

Reviewed all biome system integrations in `src/app/play/page.tsx`. No fixes needed.

**Verified:**
- `createFullWorld()` correctly replaces `PRESET_ROOMS` — all ~46 rooms loaded
- All four biome system constructors match the room data type mappings (RoomVineAnchor→VineAnchor, GravityWellDef→GravityWell, CurrentZoneDef→CurrentZone, FogZoneDef→FogZone)
- Method signatures for all biome system calls (update, render, applyToPlayer, etc.) match the actual APIs
- VineSystem vine/Margin Stitch input priority is correctly handled (vine attach first, then vineSwinging guard prevents double-trigger)
- Player `active` flag on Entity base class correctly suppresses physics during vine swinging, and EntityManager respects it
- Gravity params properly reset when leaving gravity well rooms
- Fog input remap cleared both on room transition and when not in fog room
- Camera correctly tracks vine swing position when swinging
- Saved progression (bosses, gates) properly synced + room reloaded
- `npx tsc --noEmit` passes with zero errors
