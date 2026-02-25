# Task: Room & World Harness Extensions

Extend `GameTestHarness` to support room loading, room transitions, vine system, and day/night cycle for headless testing. This unblocks Tasks 22–25 (room system tests, day/night tests, etc).

## What to Build

Modify `src/engine/test/GameTestHarness.ts` to add room/world-level testing capabilities. The harness already supports player physics, combat, health, and all 4 abilities. This task adds the remaining game systems.

## Files to Modify

- `src/engine/test/GameTestHarness.ts` — main harness file, add new methods and tick() integration

## Implementation Details

### 1. `loadRoom(roomData: RoomData)`

Add a method that loads a single room into the harness:

```typescript
loadRoom(roomData: RoomData): void {
  // Store current room reference
  this._currentRoom = roomData;

  // Rebuild tilemap from room platforms
  const platforms: Platform[] = roomData.platforms.map(p => ({
    x: p.x, y: p.y, width: p.width, height: p.height,
    surfaceType: p.surfaceType
  }));
  // Add gate platforms (solid until opened)
  for (const gate of roomData.gates) {
    if (!gate.opened) {
      platforms.push({
        x: gate.rect.x, y: gate.rect.y,
        width: gate.rect.width, height: gate.rect.height
      });
    }
  }
  this.setTileMap(platforms);

  // Set camera world bounds
  this.camera.setWorldBounds(0, 0, roomData.width, roomData.height);

  // Position player at default spawn
  this.setPlayerPosition(roomData.defaultSpawn.x, roomData.defaultSpawn.y);

  // Load obstacles from room data
  this._obstacles = [];
  for (const obs of roomData.obstacles) {
    // Convert RoomObstacle to Obstacle using factory helpers from Obstacles.ts
    // Match type to factory: spikes, barrier, laser, hazard_zone
    this.addObstacleFromRoom(obs);
  }
}
```

Private helper `addObstacleFromRoom(roomObs: RoomObstacle)` should use the obstacle factory functions (`createSpikes`, `createBarrier`, `createLaser`, `createHazardZone`) based on `roomObs.type`.

### 2. `enableRoomManager(rooms: Record<string, RoomData>, startingRoomId: string)`

Add a method that creates a `RoomManager` and wires it into the harness:

```typescript
enableRoomManager(rooms: Record<string, RoomData>, startingRoomId: string): RoomManager {
  this._roomManager = new RoomManager({
    rooms,
    startingRoomId
  });
  // Load the starting room (which also sets up tilemap etc.)
  this.loadRoomFromManager(startingRoomId);
  return this._roomManager;
}
```

Private helper `loadRoomFromManager(roomId)` calls `_roomManager.loadRoom(roomId)` then syncs the harness tilemap/obstacles from `_roomManager.currentTileMap` and `_roomManager.currentObstacles`.

In `tick()`, when `_roomManager` is enabled:
- After player movement, call `_roomManager.checkExits(playerBounds)` to detect exit overlap
- Store the detected exit for test inspection: `get pendingExit(): RoomExit | null`
- Do NOT auto-transition — let tests call `transitionToRoom(exit)` explicitly for control

Add `transitionToRoom(exit: RoomExit): void` that:
- Calls `_roomManager.startTransition(exit)`
- Immediately completes the transition (no fade animation in headless mode)
- Loads the target room
- Positions player at the exit's `targetSpawnPoint`

### 3. `tryOpenGate(gateId: string, abilities: GateAbility[])`

Add a method to test gate opening:

```typescript
tryOpenGate(gateId: string, abilities: GateAbility[]): boolean {
  if (!this._currentRoom) return false;
  const gate = this._currentRoom.gates.find(g => g.id === gateId);
  if (!gate || gate.opened) return false;
  if (!abilities.includes(gate.requiredAbility)) return false;

  // Mark gate as opened
  gate.opened = true;

  // Remove the gate's platform from tilemap
  // Find and remove the platform that matches the gate rect
  this.removePlatformAt(gate.rect.x, gate.rect.y, gate.rect.width, gate.rect.height);

  return true;
}
```

### 4. `enableVineSystem(anchors: VineAnchor[], params?: Partial<VineParams>)`

```typescript
enableVineSystem(anchors: VineAnchor[], params?: Partial<VineParams>): VineSystem {
  this._vineSystem = new VineSystem(anchors, params);
  return this._vineSystem;
}
```

In `tick()`, when `_vineSystem` is enabled and `_vineSystem.isSwinging`:
- Call `_vineSystem.update(dt, inputLeft, inputRight, inputUp, inputDown)` to get the swing position
- Set `player.active = false` to suppress normal player update
- Override player position from `_vineSystem.swingPosition`

Add input helpers:
- `attachVine()`: find nearest anchor via `_vineSystem.findNearestAnchor(playerCenter)`, call `_vineSystem.attach(anchor, pos, vel)`
- `detachVine()`: call `_vineSystem.detach()`, set velocity to returned velocity, reactivate player

Add state getters:
- `get vineSwinging(): boolean`
- `get vineAngle(): number`
- `get vineVelocity(): Vec2`

### 5. `enableDayNightCycle(params?: Partial<DayNightParams>)`

```typescript
enableDayNightCycle(params?: Partial<DayNightParams>): DayNightCycle {
  this._dayNight = new DayNightCycle(params);
  return this._dayNight;
}
```

In `tick()`, when `_dayNight` is enabled:
- Call `_dayNight.update(this.dt)` each frame

Add state getters:
- `get timeOfDay(): TimeOfDay | null`
- `get corruptionIntensity(): number`
- `get lightLevel(): number`
- `get dayNightTime(): number` (normalized 0-1)

### 6. `getWorldState()`

Composite getter that returns current world state:

```typescript
getWorldState(): WorldState {
  return {
    roomId: this._currentRoom?.id ?? null,
    roomName: this._currentRoom?.name ?? null,
    timeOfDay: this._dayNight?.getTimeOfDay() ?? null,
    lightLevel: this._dayNight?.getLightLevel() ?? 1,
    corruptionIntensity: this._dayNight?.getCorruptionIntensity() ?? 0,
    transitioning: this._roomManager?.transitioning ?? false,
  };
}
```

Define `WorldState` interface in the harness file (or export from it).

## Integration into tick()

The existing `tick()` method should be extended (not rewritten). Add the new systems after the existing ones:

```typescript
tick(): void {
  // ... existing: input.update, surface detection, player.update, combat, health ...

  // Vine system (when swinging, overrides player position)
  if (this._vineSystem?.isSwinging) {
    const pos = this._vineSystem.update(
      this.dt,
      this.input.isHeld('Left'),
      this.input.isHeld('Right'),
      this.input.isHeld('Up'),
      this.input.isHeld('Down')
    );
    this.player.x = pos.x - this.player.width / 2;
    this.player.y = pos.y - this.player.height / 2;
  }

  // Day/night cycle
  if (this._dayNight) {
    this._dayNight.update(this.dt);
  }

  // Room exit detection
  if (this._roomManager && !this._roomManager.transitioning) {
    const playerBounds = {
      x: this.player.x, y: this.player.y,
      width: this.player.width, height: this.player.height
    };
    this._pendingExit = this._roomManager.checkExits(playerBounds);
  }

  // ... existing: camera follow ...
}
```

Important: when vine system is active and player is swinging, skip the normal `player.update()` call (set `player.active = false` before the update block, restore after). Match the pattern used in the vine test page.

## Pass Criteria

1. `loadRoom(roomData)` correctly builds tilemap with platform count matching `roomData.platforms.length` + locked gate count
2. Player spawns at `defaultSpawn` after `loadRoom()`
3. `enableRoomManager()` loads starting room and allows exit detection via `pendingExit`
4. `transitionToRoom(exit)` loads the target room and positions player at spawn point
5. `tryOpenGate()` removes the gate platform from tilemap when ability matches
6. `tryOpenGate()` returns false when ability doesn't match
7. `enableVineSystem()` creates vine system; `attachVine()` / `detachVine()` work
8. Vine swinging updates player position from vine physics (not normal movement)
9. `enableDayNightCycle()` advances time each tick; `timeOfDay` changes over time
10. `getWorldState()` returns composite state from all enabled systems
11. All existing tests still pass — no regressions

## Important Notes

- Import `RoomData`, `RoomExit`, `AbilityGate`, `GateAbility` from `@/engine/world/Room`
- Import `RoomManager`, `RoomManagerConfig` from `@/engine/world/RoomManager`
- Import `VineSystem`, `VineAnchor`, `VineParams` from `@/engine/world/VineSystem`
- Import `DayNightCycle`, `DayNightParams`, `TimeOfDay` from `@/engine/world/DayNightCycle`
- Import obstacle factories from `@/engine/physics/Obstacles`
- The harness must remain usable WITHOUT any of these new systems — all new fields are optional/null by default
- Run `npm run test:run` at the end to verify zero regressions
- The `InputManager` methods `isHeld()` use action string constants (e.g., `'Left'`, `'Right'`). Check `InputManager.ts` for the exact action names used by VineSystem.

---

## Completion Summary

### Files Changed
- `src/engine/test/GameTestHarness.ts` — extended with room/world-level testing capabilities (340 lines → 811 lines)

### What Was Built

**New imports**: `RoomData`, `RoomExit`, `RoomObstacle`, `GateAbility`, `RoomManager`, `VineSystem`, `VineAnchor`, `VineParams`, `DayNightCycle`, `DayNightParams`, `TimeOfDay`, obstacle factory functions (`createSpikes`, `createBarrier`, `createLaser`, `createHazardZone`).

**New interface**: `WorldState` — composite state from all enabled systems.

**New private fields**: `_currentRoom`, `_roomManager`, `_pendingExit`, `_vineSystem`, `_dayNight`, `_gatePlatforms`.

**Room system methods**:
- `loadRoom(roomData)` — standalone room loading: builds tilemap from platforms + locked gates, loads obstacles via factory functions, sets camera bounds, positions player at default spawn
- `enableRoomManager(rooms, startingRoomId)` — creates RoomManager with Map, loads starting room, syncs tilemap/obstacles
- `loadRoomFromManager(roomId)` — private helper that syncs harness state from RoomManager
- `transitionToRoom(exit)` — instant headless room transition (no fade animation)
- `tryOpenGate(gateId, abilities)` — opens gate if ability matches, removes gate platform from tilemap, notifies RoomManager if active
- `removePlatformAt(x, y, width, height)` — finds and removes platform by position/size match
- `addObstacleFromRoom(roomObs)` — private helper converting RoomObstacle → Obstacle via factory functions
- Getters: `currentRoom`, `roomManager`, `pendingExit`

**Vine system methods**:
- `enableVineSystem(anchors, params?)` — creates VineSystem
- `attachVine()` — finds nearest anchor, attaches with momentum transfer
- `detachVine()` — detaches, applies release velocity to player
- Getters: `vineSystem`, `vineSwinging`, `vineAngle`, `vineVelocity`

**Day/night cycle methods**:
- `enableDayNightCycle(params?)` — creates DayNightCycle
- Getters: `dayNight`, `timeOfDay`, `corruptionIntensity`, `lightLevel`, `dayNightTime`

**World state**: `getWorldState()` — returns composite state from all enabled systems.

**tick() integration**:
- Vine system: when swinging, sets `player.active = false` before update (suppresses Entity.update), calls `vineSystem.update()` with directional input, overrides player position from pendulum physics, restores `player.active = true` after
- Day/night: calls `_dayNight.update(dt)` each frame
- Room exits: after player movement, checks exit overlap via `_roomManager.checkExits()`, stores in `_pendingExit` for test inspection (no auto-transition)

**Note**: Used correct `InputAction.Left`/`.Right`/`.Up`/`.Down` constants (lowercase strings: `"left"`, `"right"`, etc.) rather than the capitalized strings shown in the task spec's pseudocode.

### Verification
- `npx tsc --noEmit` — zero type errors
- `npm run test:run` — all 274 tests pass, 12 test files, zero regressions
- All new systems are opt-in (null by default) — harness remains fully backward compatible

---

## Review Notes (Reviewer: 6458feb8)

**API compatibility**: Verified all 7 dependency modules (`Room.ts`, `RoomManager.ts`, `VineSystem.ts`, `DayNightCycle.ts`, `Obstacles.ts`, `Camera.ts`, `Player.ts`/`Entity.ts`) — all APIs match, no mismatched property names, missing methods, or incompatible signatures.

**Fixes applied:**

1. **Avoided double room load in `enableRoomManager`**: The `RoomManager` constructor already calls `loadRoom(startingRoomId)` internally. Then `loadRoomFromManager()` was calling `loadRoom()` again redundantly. Fixed by checking `currentRoom.id !== roomId` before re-calling `loadRoom`, so the sync-to-harness logic still runs but the room isn't rebuilt twice.

2. **Added exhaustive check to `addObstacleFromRoom` switch**: The switch on `roomObs.type` covered all 4 `ObstacleType` values but had no `default` case. Added a `never`-typed exhaustive check with a descriptive error, ensuring future `ObstacleType` additions produce a compile-time error rather than silently leaving `obstacle` uninitialized.

**No issues found with:**
- Vine system tick integration (correct `player.active = false` suppression and restoration)
- Day/night cycle integration
- Room exit detection ordering (correctly after player movement, before camera follow)
- Gate platform tracking via `_gatePlatforms` Map with position-based fallback
- Input action constants (correctly uses `InputAction.Left`/`.Right`/`.Up`/`.Down`)
- Camera bounds direct assignment
- Obstacle factory usage (barrier correctly omits damage param)
- All new fields are optional/null by default — full backward compatibility

**Post-fix verification**: `npx tsc --noEmit` — zero errors, `npm run test:run` — all 274 tests pass.
