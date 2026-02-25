# Headless Game Testing Guide

The headless test harness lets you test gameplay mechanics without a browser. It runs the engine's physics, state machine, collision, and input systems in pure TypeScript via vitest. No canvas, no DOM, no rendering.

---

## Quick start

```bash
npm test          # watch mode — reruns on file change
npm run test:run  # single run — good for CI
```

Tests live in `src/engine/test/__tests__/`. Create a new `.test.ts` file there and it will be picked up automatically.

---

## Core concepts

### The harness

Every test starts by creating a `GameTestHarness`. This sets up a player, a tilemap, and a programmatic input manager — everything the engine needs except rendering.

```typescript
import { describe, it, expect } from "vitest";
import { GameTestHarness } from "@/engine/test";

it("player lands on a platform", () => {
  const h = new GameTestHarness();
  h.addFloor(300);                    // floor at y=300
  h.setPlayerPosition(100, 250);      // start just above
  h.tickUntil(() => h.grounded, 60);  // advance until grounded (max 60 frames)
  expect(h.grounded).toBe(true);
});
```

### Frame-by-frame simulation

The harness advances the game one fixed-timestep frame (1/60s) at a time. Each `tick()` runs:

1. Input snapshot (pressed/held/released)
2. Surface detection (ground and wall material)
3. `player.update(dt)` — state machine, gravity, velocity, position, collision
4. Optional combat/health updates
5. Camera follow

You control exactly how many frames pass and what inputs are active.

### Programmatic input

Instead of keyboard events, you call methods to press and release actions:

```typescript
h.pressRight();    // hold right
h.tickN(30);       // run for 30 frames
h.releaseAll();    // let go of everything
h.pressJump();     // tap jump
h.tick();          // one frame with jump pressed
h.releaseAll();    // release
```

Inputs persist until released — `pressRight()` means "hold right" until you call `releaseRight()` or `releaseAll()`.

---

## Building test levels

### Platforms

```typescript
// Add individual platforms
h.addPlatform(x, y, width, height);
h.addPlatform(0, 300, 960, 32, "bouncy");  // with surface type

// Convenience: full-width floor
h.addFloor(300);           // floor at y=300, width 960, height 32
h.addFloor(400, 1920);     // wider floor

// Convenience: walls on both sides
const { left, right } = h.addWalls(0, 300, 0, 540);

// Remove a platform
h.removePlatform(right);

// Replace all platforms at once
h.setTileMap([
  { x: 0, y: 300, width: 400, height: 32 },
  { x: 500, y: 250, width: 200, height: 32 },
]);
```

### Player setup

```typescript
h.setPlayerPosition(100, 260);    // set position (also resets prevPosition)
h.setPlayerVelocity(200, -100);   // set velocity directly
```

### Custom player params

Override any physics parameter at construction time:

```typescript
const h = new GameTestHarness({
  playerParams: {
    maxRunSpeed: 400,
    jumpSpeed: 500,
    coyoteFrames: 10,
    dashCooldownFrames: 30,
  },
  platforms: [
    { x: 0, y: 300, width: 960, height: 32 },
  ],
});
```

---

## Advancing time

| Method | What it does |
|--------|-------------|
| `h.tick()` | Advance exactly 1 frame |
| `h.tickN(30)` | Advance 30 frames |
| `h.tickSeconds(2)` | Advance 2 seconds (120 frames at 60 Hz) |
| `h.tickUntil(() => h.grounded, 60)` | Advance until grounded, throw if not within 60 frames |
| `h.tickWhile(() => !h.grounded, 60)` | Advance while airborne, return elapsed frames (no throw) |

`tickUntil` throws if the predicate isn't met — this makes test failures obvious. Use `tickWhile` for the non-throwing variant.

---

## Input reference

### Press helpers (start holding)

| Method | Action |
|--------|--------|
| `h.pressLeft()` | Move left |
| `h.pressRight()` | Move right |
| `h.pressUp()` | Aim up |
| `h.pressDown()` | Aim down |
| `h.pressJump()` | Jump |
| `h.pressDash()` | Dash |
| `h.pressCrouch()` | Crouch |
| `h.pressAttack()` | Attack |

### Release helpers

| Method | Action |
|--------|--------|
| `h.releaseJump()` | Release jump (important for variable-height jumps) |
| `h.releaseLeft()` | Release left |
| `h.releaseRight()` | Release right |
| `h.releaseAll()` | Release every held input |

### Raw input access

For actions not covered by helpers (abilities, weapon switch, pause), use the input manager directly:

```typescript
import { InputAction } from "@/engine/input/InputManager";

h.input.press(InputAction.Ability1);   // Margin Stitch (E key)
h.input.press(InputAction.Ability2);   // Redaction (Q key)
h.input.press(InputAction.Ability3);   // Index Mark (R key)
h.input.press(InputAction.WeaponSwitch);
h.input.release(InputAction.Ability1);
```

---

## Inspecting state

### Convenience getters

| Getter | Type | Description |
|--------|------|-------------|
| `h.pos` | `Vec2` | Player position `{x, y}` |
| `h.vel` | `Vec2` | Player velocity `{x, y}` |
| `h.state` | `string` | State machine state: `IDLE`, `RUNNING`, `JUMPING`, `FALLING`, `DASHING`, `WALL_SLIDING`, `WALL_JUMPING`, `CROUCHING`, `CROUCH_SLIDING`, `HARD_LANDING` |
| `h.grounded` | `boolean` | On the ground? |
| `h.facingRight` | `boolean` | Facing direction |
| `h.speed` | `number` | Total speed (magnitude of velocity) |
| `h.horizontalSpeed` | `number` | Absolute horizontal speed |
| `h.frame` | `number` | Current frame count |

### Deep player access

For anything not on the convenience API, access the player directly:

```typescript
h.player.wallSide           // -1 (left wall), 0 (none), 1 (right wall)
h.player.dashAvailable      // can dash?
h.player.dashCooldownTimer  // frames remaining on cooldown
h.player.coyoteTimer        // frames since leaving ground
h.player.jumpHeld           // is jump being held?
h.player.isInApexFloat      // at the top of the jump arc?
h.player.currentSurface     // ground surface properties
h.player.stateMachine.getCurrentState()  // same as h.state
```

### Snapshots

Capture the full player state at a point in time for later comparison:

```typescript
const before = h.snapshot();
h.pressJump();
h.tickN(10);
const after = h.snapshot();

expect(after.position.y).toBeLessThan(before.position.y);
expect(after.state).toBe("JUMPING");
```

A `PlayerSnapshot` contains: `frame`, `position`, `velocity`, `state`, `grounded`, `facingRight`, `wallSide`, `dashAvailable`, `dashCooldownTimer`, `coyoteTimer`.

---

## Optional systems

### Combat

```typescript
const combat = h.enableCombat({ spearWindupFrames: 2 });
// combat updates automatically each tick
// inspect: combat.attackPhase, combat.activeHitbox, etc.
```

### Health

```typescript
const health = h.enableHealth({ maxHealth: 5 });
// health.update() called each tick
// inspect: health.health, health.invincibilityTimer, etc.
```

---

## Common patterns

### Setup helper

Most test files share a setup function. Put it at the top of your describe block:

```typescript
describe("my feature", () => {
  function setup() {
    const h = new GameTestHarness();
    h.addFloor(300);
    h.setPlayerPosition(100, 300 - 40); // 40 = default player height
    h.tick(); // settle onto ground
    return h;
  }

  it("does something", () => {
    const h = setup();
    // ...
  });
});
```

### Testing a jump arc

```typescript
it("reaches a platform at height Y", () => {
  const h = setup();
  h.addPlatform(200, 200, 100, 16); // target platform

  h.pressRight();
  h.pressJump();
  h.tickN(5);
  h.releaseAll();

  // Wait to either land on the platform or fall back to floor
  h.tickUntil(() => h.grounded, 120);

  // Check we landed on the higher platform, not the floor
  expect(h.pos.y).toBeLessThan(250);
});
```

### Testing coyote time

```typescript
it("can jump N frames after leaving a ledge", () => {
  const h = new GameTestHarness();
  h.addPlatform(0, 300, 200, 32); // short platform
  h.setPlayerPosition(180, 260);
  h.tick();

  // Run off the edge
  h.pressRight();
  h.tickUntil(() => !h.grounded, 60);
  h.releaseAll();

  // Jump within the coyote window
  h.tickN(3);
  h.pressJump();
  h.tick();

  expect(h.state).toBe("JUMPING");
});
```

### Testing dash cooldown

```typescript
it("cannot double-dash during cooldown", () => {
  const h = setup();

  h.pressDash();
  h.tick();
  h.releaseAll();
  h.tickUntil(() => h.state !== "DASHING", 60);

  // Try to dash again immediately
  h.pressDash();
  h.tick();
  expect(h.state).not.toBe("DASHING");
});
```

### Testing wall mechanics

```typescript
function arenaWithWalls() {
  const h = new GameTestHarness();
  h.addFloor(400);
  h.addWalls(0, 300, 0, 432);
  h.setPlayerPosition(150, 360);
  h.tick();
  return h;
}

it("wall slides when falling against a wall", () => {
  const h = arenaWithWalls();

  h.pressJump();
  h.tick();
  h.releaseAll();
  h.tickN(10);

  h.pressRight();
  h.tickUntil(() => h.state === "WALL_SLIDING" || h.grounded, 120);

  if (!h.grounded) {
    expect(h.state).toBe("WALL_SLIDING");
  }
});
```

### Testing surface types

```typescript
it("bounces on a bouncy platform", () => {
  const h = new GameTestHarness();
  h.addPlatform(0, 300, 960, 32, "bouncy");
  h.setPlayerPosition(100, 100); // drop from high up

  h.tickUntil(() => h.grounded, 120);
  // After landing on bouncy surface, player should bounce upward
  h.tickN(2);
  expect(h.vel.y).toBeLessThan(0); // moving up = bounce
});
```

### Measuring distances and timing

```typescript
it("dash covers at least 80px", () => {
  const h = setup();
  const startX = h.pos.x;

  h.pressDash();
  h.tick();
  h.releaseAll();
  h.tickUntil(() => h.state !== "DASHING", 60);

  const distance = h.pos.x - startX;
  expect(distance).toBeGreaterThan(80);
});

it("jump lasts about 40 frames", () => {
  const h = setup();

  h.pressJump();
  h.tick();
  h.releaseAll();

  const airTime = h.tickUntil(() => h.grounded, 120);
  expect(airTime).toBeGreaterThan(30);
  expect(airTime).toBeLessThan(60);
});
```

---

## What to test

Use headless tests for mechanics that can be verified numerically. Things like:

- **Movement feel**: Does the player reach max speed in N frames? Does deceleration take the right number of frames?
- **Jump tuning**: How high does a tap jump go vs. a held jump? Is coyote time the right window?
- **Dash behavior**: Does the cooldown work? Does dash preserve momentum into a run?
- **Wall mechanics**: Does wall slide cap at the right speed? Does wall jump launch at the right angle?
- **State transitions**: Does every state transition happen correctly? Are there any impossible state combinations?
- **Surface interactions**: Does bouncy bounce? Does icy reduce friction? Does conveyor push?
- **Combat**: Do attack phases cycle correctly? Do hitboxes appear at the right time?
- **Regression**: If you change a parameter, do existing behaviors still work?

For visual things (does the animation look right? does the parallax feel good?), use the browser test pages at `/test/[feature]` instead.

---

## Tips

- **One tick = one frame = 1/60s.** The engine runs at a fixed 60 Hz timestep.
- **Input persists until released.** If you call `pressRight()`, the player keeps running right on every subsequent tick until you call `releaseRight()` or `releaseAll()`.
- **State transitions take a frame.** When the player lands, `grounded` becomes `true` at the end of that tick, but the state machine transitions to `IDLE` on the *next* tick. If your test needs `state === "IDLE"` after landing, tick one extra frame.
- **Dash has a wind-up.** The default is 1 frame of wind-up where velocity is zero. Check velocity after `dashWindupFrames + 1` frames, not immediately.
- **Long falls trigger hard landing.** If you drop the player from high up, they'll enter `HARD_LANDING` instead of `IDLE`. Start the player close to the floor to avoid this in basic tests.
- **Use `DEFAULT_PLAYER_PARAMS` for thresholds.** Don't hardcode magic numbers — reference the param constants so tests stay correct when tuning values change.
- **`tickUntil` throws on timeout.** This is intentional — a test that can't reach its target state should fail loudly. Use `tickWhile` if you want a soft timeout.
