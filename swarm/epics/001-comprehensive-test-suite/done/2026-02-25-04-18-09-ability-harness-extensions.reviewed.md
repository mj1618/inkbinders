# Task: Extend GameTestHarness with Ability Support

## Goal

Add optional ability wiring to `GameTestHarness` so all 4 abilities (Margin Stitch, Redaction, Paste-Over, Index Mark) can be tested headlessly. Tasks 10–13 depend on this.

## File to Modify

`src/engine/test/GameTestHarness.ts`

## What to Build

Add four `enable*()` methods — one per ability — following the same pattern as the existing `enableCombat()` and `enableHealth()`. Each method:
1. Creates the ability instance with optional partial params
2. Stores it as a nullable private field
3. Wires it into `tick()` at the correct point in the update cycle
4. Returns the ability instance for test assertions
5. Also add a public getter for each (same pattern as `combat`/`health`)

### Specific Methods

#### `enableMarginStitch(params?): MarginStitch`

```typescript
private _marginStitch: MarginStitch | null = null;
get marginStitch(): MarginStitch | null { return this._marginStitch; }

enableMarginStitch(params?: Partial<MarginStitchParams>): MarginStitch {
  this._marginStitch = new MarginStitch(params);
  this._marginStitch.setTileMap(this._tileMap);
  // Note: no particleSystem in headless mode — leave as null (default)
  return this._marginStitch;
}
```

In `tick()`, after player update and before camera follow:
```typescript
if (this._marginStitch) {
  const center = this.playerCenter;
  this._marginStitch.scanForPairs(center, this._tileMap);
  this._marginStitch.update(this.dt);
}
```

**Important:** If `setTileMap()` is called, also update `_marginStitch.setTileMap(newTileMap)`.

#### `enableRedaction(params?): Redaction`

```typescript
private _redaction: Redaction | null = null;
private _obstacles: Obstacle[] = [];
get redaction(): Redaction | null { return this._redaction; }
get obstacles(): Obstacle[] { return this._obstacles; }

enableRedaction(params?: Partial<RedactionParams>): Redaction {
  this._redaction = new Redaction(params);
  this._redaction.setTileMap(this._tileMap);
  return this._redaction;
}
```

Also add:
```typescript
addObstacle(obstacle: Obstacle): Obstacle {
  this._obstacles.push(obstacle);
  // If it's a solid barrier, register its platform with Redaction
  if (obstacle.solid && this._redaction) {
    const platform = this.addPlatform(
      obstacle.rect.x, obstacle.rect.y,
      obstacle.rect.width, obstacle.rect.height
    );
    this._redaction.registerObstaclePlatform(obstacle.id, platform);
  }
  return obstacle;
}
```

In `tick()`, after player update:
```typescript
if (this._redaction) {
  const center = this.playerCenter;
  const aim = { x: this.player.facingRight ? 1 : -1, y: 0 };
  this._redaction.scanForTargets(center, aim, this._obstacles);
  this._redaction.update(this.dt);
}
```

**Important:** If `setTileMap()` is called, also update `_redaction.setTileMap(newTileMap)`.

#### `enablePasteOver(params?): PasteOver`

```typescript
private _pasteOver: PasteOver | null = null;
get pasteOver(): PasteOver | null { return this._pasteOver; }

enablePasteOver(params?: Partial<PasteOverParams>): PasteOver {
  this._pasteOver = new PasteOver(params);
  return this._pasteOver;
}
```

In `tick()`, after surface detection (since autoCapture needs the current surface):
```typescript
if (this._pasteOver) {
  const groundSurface = this._tileMap.getGroundSurface(this.player);
  this._pasteOver.autoCapture(groundSurface);
  this._pasteOver.scanForTarget(
    this.player.position,
    this.player.size,
    this._tileMap,
    this.player.wallSide !== 0 ? this.player.wallSide as -1 | 1 : undefined
  );
  this._pasteOver.update(this.dt);
}
```

#### `enableIndexMark(params?): IndexMark`

```typescript
private _indexMark: IndexMark | null = null;
get indexMark(): IndexMark | null { return this._indexMark; }

enableIndexMark(params?: Partial<IndexMarkParams>): IndexMark {
  this._indexMark = new IndexMark(params);
  return this._indexMark;
}
```

In `tick()`, after player update:
```typescript
if (this._indexMark) {
  this._indexMark.update(this.dt);
}
```

**Note:** IndexMark input is driven manually by tests (calling `onKeyDown()`, `onKeyHeld()`, `onKeyUp()` directly) — it does NOT auto-scan or auto-activate. This matches the three-method input API described in AGENTS.md. The harness just handles the `update(dt)` call for timer/cooldown advancement.

### Helper Properties

Add a shared `playerCenter` helper (used by multiple abilities):

```typescript
get playerCenter(): Vec2 {
  return {
    x: this.player.position.x + this.player.size.x / 2,
    y: this.player.position.y + this.player.size.y / 2,
  };
}
```

Refactor the existing camera follow code in `tick()` to use this helper too.

### Input Helpers

Add ability input helpers matching the existing pattern:

```typescript
pressAbility1(): void { this.input.press(InputAction.Ability1); }  // E key — Margin Stitch
pressAbility2(): void { this.input.press(InputAction.Ability2); }  // Q key — Redaction
pressAbility3(): void { this.input.press(InputAction.Ability3); }  // R key — PasteOver / IndexMark
releaseAbility3(): void { this.input.release(InputAction.Ability3); }  // For IndexMark key-up
```

### Imports to Add

```typescript
import { MarginStitch } from "@/engine/abilities/MarginStitch";
import type { MarginStitchParams } from "@/engine/abilities/MarginStitch";
import { Redaction } from "@/engine/abilities/Redaction";
import type { RedactionParams } from "@/engine/abilities/Redaction";
import { PasteOver } from "@/engine/abilities/PasteOver";
import type { PasteOverParams } from "@/engine/abilities/PasteOver";
import { IndexMark } from "@/engine/abilities/IndexMark";
import type { IndexMarkParams } from "@/engine/abilities/IndexMark";
import type { Obstacle } from "@/engine/physics/Obstacles";
```

### Update Cycle Order in `tick()`

The full tick order should be:

1. `input.update()`
2. Surface detection
3. PasteOver autoCapture + scanForTarget (needs current surface)
4. `player.update(dt)` (state machine, gravity, velocity, position, collision)
5. MarginStitch scanForPairs + update
6. Redaction scanForTargets + update
7. PasteOver update (timer advancement — scan already done above)
8. IndexMark update (timer/cooldown only — input is manual)
9. Combat update
10. Health update
11. Camera follow

The key constraint: PasteOver `autoCapture` needs to run AFTER surface detection but can run before player update. MarginStitch and Redaction scanning should run after player update (so they use the post-movement position). PasteOver `update` (timers) runs after player update too. IndexMark is order-independent since it only runs timers.

### setTileMap() Update

Update the existing `setTileMap()` method to propagate the new tilemap to abilities that hold a reference:

```typescript
setTileMap(platforms: Platform[]): void {
  this._tileMap = new TileMap(platforms);
  this.player.tileMap = this._tileMap;
  if (this._marginStitch) this._marginStitch.setTileMap(this._tileMap);
  if (this._redaction) this._redaction.setTileMap(this._tileMap);
}
```

## What NOT to Do

- Don't add rendering methods (no canvas in headless mode)
- Don't add ParticleSystem or ScreenShake (not needed for behavioral tests)
- Don't change any existing test files — this only modifies the harness
- Don't auto-activate abilities in tick — tests control activation explicitly

## Verification

After implementing, run the existing test suite to confirm no regressions:

```bash
npm run test:run
```

All existing tests must still pass. No new test files are written in this task — that's Tasks 10–13.

Additionally, verify the harness compiles cleanly:

```bash
npx tsc --noEmit
```

## Pass Criteria

- [ ] `enableMarginStitch()` creates and wires MarginStitch, returns instance
- [ ] `enableRedaction()` creates and wires Redaction, returns instance
- [ ] `enablePasteOver()` creates and wires PasteOver, returns instance
- [ ] `enableIndexMark()` creates and wires IndexMark, returns instance
- [ ] `addObstacle()` helper adds obstacles and registers solid ones with Redaction
- [ ] `playerCenter` helper computes player bounding box center
- [ ] `pressAbility1/2/3()` and `releaseAbility3()` input helpers exist
- [ ] `setTileMap()` propagates to MarginStitch and Redaction
- [ ] All 4 abilities are updated in `tick()` when enabled
- [ ] Existing tests pass without changes (`npm run test:run` exits 0)
- [ ] TypeScript compiles cleanly (`npx tsc --noEmit`)

---

## Completion Summary

### Files Changed
- **Modified:** `src/engine/test/GameTestHarness.ts`

### What Was Built
Extended the `GameTestHarness` with full ability support:

**New imports:** MarginStitch, Redaction, PasteOver, IndexMark, and Obstacle types.

**New private fields:** `_marginStitch`, `_redaction`, `_pasteOver`, `_indexMark`, `_obstacles`.

**New enable methods (4):**
- `enableMarginStitch(params?)` — creates instance, wires `setTileMap()`
- `enableRedaction(params?)` — creates instance, wires `setTileMap()`
- `enablePasteOver(params?)` — creates instance
- `enableIndexMark(params?)` — creates instance

**New getters (6):** `marginStitch`, `redaction`, `pasteOver`, `indexMark`, `obstacles`, `playerCenter`

**New helpers:**
- `addObstacle(obstacle)` — adds obstacle to list, registers solid barriers with Redaction
- `pressAbility1()`, `pressAbility2()`, `pressAbility3()`, `releaseAbility3()` — input helpers

**Updated `tick()` order:**
1. input.update() → 2. surface detection → 3. PasteOver autoCapture+scan → 4. player.update() → 5. MarginStitch scan+update → 6. Redaction scan+update → 7. PasteOver update → 8. IndexMark update → 9. Combat update → 10. Health update → 11. Camera follow

**Updated `setTileMap()`:** Propagates new tilemap to MarginStitch and Redaction.

### Verification
- `npx tsc --noEmit` — clean, no type errors
- `npx vitest run` — 162/162 tests pass across all 8 test files (no regressions)

---

## Review Notes (be313dfa)

**No fixes needed.** The implementation is clean and correct.

**What was verified:**
- All four `enable*()` methods match the ability constructors (optional `Partial<*Params>`)
- `setTileMap()` correctly propagates to MarginStitch and Redaction (the two abilities that hold tileMap references)
- `scanForPairs`, `scanForTargets`, `scanForTarget` signatures match the ability APIs
- `addObstacle()` correctly registers solid barriers with Redaction via `registerObstaclePlatform()`
- `playerCenter` computed property is used consistently in tick and camera follow
- Tick update order is correct: input → surface detection → PasteOver scan → player update → MarginStitch → Redaction → PasteOver update → IndexMark update → Combat → Health → Camera
- PasteOver's `autoCapture(groundSurface)` receives `SurfaceType | undefined` as expected
- Ability input helpers (`pressAbility1/2/3`, `releaseAbility3`) map to correct `InputAction` enum values
- No memory leaks — abilities are stored as nullable fields with no event listeners or subscriptions

**Minor note:** The PasteOver `scanForTarget` wallSide parameter receives `undefined` when `wallSide === 0`, which falls back to the method's default of `0`. Functionally correct but could be simplified to always pass `this.player.wallSide as -1 | 0 | 1`. Not worth changing.

**Verdict:** Approved as-is.
