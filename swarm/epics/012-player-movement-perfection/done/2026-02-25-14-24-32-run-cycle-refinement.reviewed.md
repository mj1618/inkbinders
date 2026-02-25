# Task: Run Cycle Refinement

**Epic:** 012-player-movement-perfection
**Task slug:** run-cycle-refinement
**Goal:** Make running feel fast, responsive, and visually distinct at different speeds. Add skid/brake animation on stop, turn-around robe swirl animation, speed-based animation FPS, and footstep dust particles.

**Important:** All enhancements in this task are **purely visual/cosmetic**. Physics remain unchanged. Controls remain frame-perfect responsive. The state machine is NOT modified — these are animation overlays and particle effects only.

---

## Context

### What exists now

- **RUNNING state** (`Player.ts` ~line 471): Full physics with acceleration (1800), deceleration (1200), turn multiplier (3.0), dash boost carry, surface interactions
- **Run animation**: `player-run-full` (8 frames, 12fps loop) with fallback to `player-run` (4 frames, 10fps)
- **Run-start transition**: `player-run-start` (3 frames, 15fps) plays on entry to RUNNING via `transitionAnim` in `STATE_TO_ANIMATION`
- **Run-stop sheet**: `player-run-stop` exists in `PLAYER_SPRITE_CONFIGS` and `PLAYER_ANIMATIONS` (3 frames, 12fps) but is NOT used anywhere — no state or visual references it
- **Turn sheet**: `player-turn` exists in `PLAYER_SPRITE_CONFIGS` and `PLAYER_ANIMATIONS` (3 frames, 15fps) but is NOT used — turn-around only does squash + 3 particles
- **Crossfade**: RUNNING → IDLE has 4-frame visual blend (no skid, just alpha fade)
- **Turn-around** (`Player.ts` ~line 493): Detects `facingRight` change, applies squash (0.85, 1.0), emits 3 particles. No animation change.
- **AnimationController**: Has `setFpsOverride(fps)` method? Check — if not, will need to add it. Has `getCurrentAnimFrame()` to get current frame index in animation.

### What this task adds

1. **Skid/brake visual on stop** — plays `player-run-stop` for a few frames when entering IDLE from RUNNING with speed
2. **Turn-around robe swirl** — plays `player-turn` for 3 frames when direction reverses during RUNNING
3. **Run animation FPS scaling** — faster character = faster animation playback
4. **Footstep dust particles** — subtle foot-contact particles during fast running

### What the squash-stretch-tuning task covers (DO NOT duplicate)

The squash-stretch task adds `runFootstrikeScaleX/Y` (1.05, 0.97) that fires on run animation frames 0 and 4. That task handles the *deformation* component. This task handles the *particle* component on the same frame triggers. These two systems are independent — footstrike squash and footstep dust can coexist without interfering.

---

## Implementation

### 1. Add run-phase tracking fields to Player

Add these fields to the Player class (NOT to PlayerParams — these are internal state, not tunable values):

```typescript
// Run visual state tracking
private runPhase: "accelerating" | "full-speed" | "decelerating" | "turning" | null = null;
private skidAnimTimer: number = 0;       // Frames remaining in skid visual
private turnAnimTimer: number = 0;       // Frames remaining in turn visual
private lastFootstepFrame: number = -1;  // Last animation frame that emitted dust
```

### 2. Skid/brake visual on stopping (IDLE state modification)

When the player enters IDLE from RUNNING with significant horizontal velocity, override the idle animation with the run-stop sheet for a brief duration.

**In the IDLE state enter handler or at the top of IDLE update:**

```typescript
// In state machine IDLE.enter():
if (previousState === STATE_RUNNING && Math.abs(player.velocity.x) > player.params.maxRunSpeed * 0.3) {
  player.skidAnimTimer = 4; // 4 frames of skid animation
}
```

**In the animation selection logic (where STATE_TO_ANIMATION is applied):**

When `this.skidAnimTimer > 0` and current state is IDLE:
- Override the animation to use `player-run-stop` sheet, `run-stop` animation
- Decrement `skidAnimTimer` each frame
- When `skidAnimTimer` reaches 0, let normal IDLE animation take over (the crossfade will handle the blend)

```typescript
// In the animation update section of Player.update() or render():
if (this.currentState === STATE_IDLE && this.skidAnimTimer > 0) {
  // Use run-stop animation instead of idle
  const runStopSheet = AssetManager.getInstance().getSpriteSheet("player-run-stop");
  if (runStopSheet && AssetManager.getInstance().isRealAsset("player-run-stop")) {
    // Override animation to run-stop
    overrideMapping = { sheetId: "player-run-stop", animName: "run-stop" };
  }
  this.skidAnimTimer--;
}
```

**Important:** The skid visual does NOT delay the IDLE state transition. The player is physically in IDLE (decelerating normally) — only the *rendered animation* shows the skid. Input is fully responsive.

### 3. Turn-around robe swirl animation

When direction reverses during RUNNING, briefly show the `player-turn` sheet before resuming the run animation.

**In the turn-around detection block (~line 493 in Player.ts):**

```typescript
if (wasFacingRight !== player.facingRight) {
  // Existing: squash + particles (keep these)
  player.applySquash(player.params.turnScaleX, 1.0);
  // ... existing particle emission ...

  // NEW: Start turn animation
  player.turnAnimTimer = 3; // 3 frames of turn animation
}
```

**In the animation selection logic:**

When `this.turnAnimTimer > 0` and current state is RUNNING:
- Override the animation to use `player-turn` sheet, `turn` animation
- Decrement `turnAnimTimer` each frame
- When it reaches 0, resume normal run animation

```typescript
if (this.currentState === STATE_RUNNING && this.turnAnimTimer > 0) {
  const turnSheet = AssetManager.getInstance().getSpriteSheet("player-turn");
  if (turnSheet && AssetManager.getInstance().isRealAsset("player-turn")) {
    overrideMapping = { sheetId: "player-turn", animName: "turn" };
  }
  this.turnAnimTimer--;
}
```

**Priority:** Turn animation overrides run-start transition. If a turn happens during run-start, the turn animation takes precedence (it's more visually important).

### 4. Run animation FPS scaling

Tie the run animation playback speed to the player's actual horizontal speed. Faster running = faster leg cycle.

**In the RUNNING state update, after velocity is computed:**

```typescript
const speedRatio = Math.abs(player.velocity.x) / player.params.maxRunSpeed;
const runFps = 8 + speedRatio * 8; // 8fps at slow, 16fps at full speed
player.activeAnimController.setFpsOverride(runFps);
```

**AnimationController.setFpsOverride():** Check if this method exists. If not, add it:

```typescript
// In AnimationController:
private fpsOverride: number | null = null;

setFpsOverride(fps: number | null): void {
  this.fpsOverride = fps;
}

// In update(), use fpsOverride if set:
const effectiveFps = this.fpsOverride ?? currentAnim.fps;
```

**Clear the override** when leaving RUNNING state (in RUNNING exit handler or when state changes):
```typescript
player.activeAnimController.setFpsOverride(null);
```

### 5. Footstep dust particles

Emit subtle dust particles at the player's feet on foot-contact frames of the 8-frame run cycle.

**Foot contact frames:** Frame 0 and Frame 4 of the `run-full` animation (these are the "contact" frames where a foot strikes the ground in an 8-frame walk/run cycle).

**In the RUNNING state update, after animation updates:**

```typescript
if (player.grounded) {
  const speedRatio = Math.abs(player.velocity.x) / player.params.maxRunSpeed;
  if (speedRatio > 0.4) {
    const currentAnimFrame = player.activeAnimController.getCurrentAnimFrame();
    // Foot contact on frames 0 and 4
    if ((currentAnimFrame === 0 || currentAnimFrame === 4) && currentAnimFrame !== player.lastFootstepFrame) {
      player.lastFootstepFrame = currentAnimFrame;

      // Emit 2 small dust particles at feet
      const footX = player.position.x;
      const footY = player.position.y + player.height / 2; // Bottom of player
      const dustSize = 1 + speedRatio * 1.5; // 1.0-2.5px based on speed

      for (let i = 0; i < 2; i++) {
        player.particleSystem?.addParticle({
          x: footX + (Math.random() - 0.5) * 8,
          y: footY - Math.random() * 2,
          vx: (Math.random() - 0.5) * 30 - player.velocity.x * 0.05, // Slight opposite to movement
          vy: -(10 + Math.random() * 20),  // Upward drift
          life: 0.15 + Math.random() * 0.1,
          size: dustSize,
          color: "#d4c5a9",  // Parchment dust color
          gravity: 40,
        });
      }
    }
  }
}

// Reset lastFootstepFrame when animation frame changes to non-contact
const currentAnimFrame = player.activeAnimController.getCurrentAnimFrame();
if (currentAnimFrame !== 0 && currentAnimFrame !== 4) {
  player.lastFootstepFrame = -1;
}
```

**Color choice:** `#d4c5a9` (warm parchment dust) — matches the library aesthetic. Not gray road dust — this is a library with wooden/parchment floors.

### 6. Clear state on state exit

When leaving RUNNING:
- Clear `turnAnimTimer = 0`
- Clear `lastFootstepFrame = -1`
- Clear FPS override: `activeAnimController.setFpsOverride(null)`

When leaving IDLE:
- Clear `skidAnimTimer = 0`

---

## Files to modify

| File | Changes |
|------|---------|
| `src/engine/entities/Player.ts` | Add run-phase fields, skid timer in IDLE enter, turn anim timer in turn detection, FPS scaling in RUNNING update, footstep particle emission, animation override logic, state exit cleanup |
| `src/engine/core/AnimationController.ts` | Add `setFpsOverride(fps)` method and `fpsOverride` field (if not already present). Add `getCurrentAnimFrame()` (if not already present — might be `getCurrentFrameIndex()` instead) |

**Do NOT modify:**
- `PlayerSprites.ts` — run-stop, turn, and run-full are already defined there
- `PlayerParams` — no new tunable params needed (the values here are visual timing, not physics)

---

## Verification checklist

1. **Run start**: Entering RUNNING from IDLE shows brief `run-start` acceleration animation (this already works — just verify it still works)
2. **Full-speed run**: At max speed, run animation plays at ~16fps (noticeably faster than slow running at ~8fps)
3. **Run stop/skid**: Releasing movement input while running fast shows 4-frame skid animation before idle
4. **Turn-around**: Pressing opposite direction during run shows 3-frame turn animation (robe swirl) before continuing run
5. **Footstep dust**: Small parchment-colored dust puffs appear at feet during fast running (speed > 40% max)
6. **No footstep dust at slow speed**: Walking slowly (< 40% max speed) shows no dust
7. **Particle count**: Dust particles are subtle — 2 per foot contact, small (1-2.5px), short-lived (0.15-0.25s)
8. **FPS scaling visible**: Side-by-side comparison — slow run vs fast run has clearly different animation speed
9. **Controls remain responsive**: Skid animation does NOT delay input response. Turn animation does NOT delay direction change. The player is always in the correct physics state.
10. **No state machine changes**: No new player states added. IDLE and RUNNING physics are unchanged.
11. **TypeScript compiles**: `npx tsc --noEmit` passes
12. **Tests pass**: `npm run test:run` passes (no test regressions)
13. **Render modes**: Skid and turn animations work in all 3 render modes (sprites / rectangles / both). In rectangle mode, the phase-tracking logic still runs but rectangle rendering ignores animation overrides (this is fine).

---

## Edge cases to handle

- **Skid + jump**: If player jumps during skid (skidAnimTimer > 0 in IDLE), the skid timer should be cleared immediately (jumping exits IDLE)
- **Turn during run-start**: If player turns direction during the run-start transition animation, the turn animation should take priority
- **Very short run**: If player runs for < 3 frames then stops, skid may look weird with 4-frame duration. Only trigger skid if `skidAnimTimer` would be meaningful — the speed check (`> 0.3 * maxRunSpeed`) handles this
- **Surface changes during run**: FPS scaling uses `maxRunSpeed` which may be modified by surfaces. Use the base `params.maxRunSpeed`, not any surface-modified value, for the ratio
- **Missing assets**: If `player-run-stop` or `player-turn` assets aren't real (placeholder), skip the animation override and fall back to normal crossfade behavior. Check `AssetManager.isRealAsset()` before applying overrides.
- **Skid facing**: The skid animation should face the same direction the player was running (not flip on stop). Since `facingRight` doesn't change when entering IDLE, this should work naturally.

---

## Completion Summary

### Files modified

| File | Changes |
|------|---------|
| `src/engine/entities/Player.ts` | Added 3 new private fields (`skidAnimTimer`, `turnAnimTimer`, `lastFootstepFrame`); IDLE enter handler now sets `skidAnimTimer` when entering from RUNNING with speed > 30% max; IDLE exit handler clears `skidAnimTimer`; RUNNING turn-around detection now sets `turnAnimTimer = 3`; RUNNING exit handler clears `turnAnimTimer`, `lastFootstepFrame`, and FPS override; RUNNING update now includes run FPS scaling (8-16fps based on speed) and footstep dust particle emission (2 parchment-colored particles per foot contact at >40% max speed); sprite animation update section adds overrides to swap to `player-run-stop` (skid) and `player-turn` (turn) controllers when timers are active |

### No files modified (confirmed already present)

| File | Status |
|------|--------|
| `src/engine/core/AnimationController.ts` | `setFpsOverride()`, `fpsOverride` field, and `getCurrentFrameNumber()` already existed |
| `src/engine/entities/PlayerSprites.ts` | `player-run-stop`, `player-turn`, and `player-run-full` sheets/animations already defined |

### What was built

1. **Skid/brake visual on stop** — IDLE enter handler detects RUNNING→IDLE transition with speed >30% maxRunSpeed, sets 4-frame skid timer. Animation override swaps to `player-run-stop` sheet during timer. Cleared on IDLE exit.
2. **Turn-around robe swirl** — Turn detection in RUNNING state sets 3-frame turn timer. Animation override swaps to `player-turn` sheet during timer. Cleared on RUNNING exit.
3. **Run animation FPS scaling** — Speed ratio (current/max) linearly maps to 8-16fps via `setFpsOverride()`. Override cleared on RUNNING exit.
4. **Footstep dust particles** — On frames 0 and 4 of run animation at >40% max speed, emits 2 small parchment-colored (`#d4c5a9`) particles using `ParticleSystem.emit()`. 0.12-0.25s lifespan, 1-2.5px size.

### Verification

- `npx tsc --noEmit` — passes
- `npm run test:run` — all 427 tests pass (16 test files)
- No state machine changes, no physics changes — purely visual
- All edge cases handled: skid cleared on IDLE exit (e.g., jump during skid), turn cleared on RUNNING exit, FPS override cleared on state exit, missing assets gracefully fall back

---

## Review (agent 4acdba57)

### Files reviewed
- `src/engine/entities/Player.ts` — all 4 additions (skid, turn, FPS scaling, footstep dust)
- `src/engine/core/AnimationController.ts` — confirmed `setFpsOverride()`, `getCurrentFrameNumber()`, `getCurrentFrameIndex()` already present
- `src/engine/entities/PlayerSprites.ts` — confirmed `player-run-stop`, `player-turn`, `player-run-full` sheets/animations already defined

### Findings

**No issues found.** Implementation is clean and correct:

1. **Skid animation** — timer set on IDLE enter from RUNNING with speed >30% max, cleared on IDLE exit. Animation override restarts on first frame, falls back gracefully if asset is placeholder.
2. **Turn animation** — timer set on direction reversal in RUNNING, cleared on RUNNING exit. Override takes priority over run-start transition (runs after main animation selection).
3. **FPS scaling** — linear 8-16fps mapping from speed ratio, uses base `params.maxRunSpeed` (not surface-modified). Override cleared on RUNNING exit.
4. **Footstep dust** — 2 parchment-colored particles on animation frames 0 and 4 at >40% max speed. Proper dedup via `lastFootstepFrame` tracking. Cleared on RUNNING exit.
5. **State exit cleanup** — all timers and overrides properly cleared on state transitions.
6. **No state machine changes** — all additions are purely visual overlays on existing states.

**Minor note (not a bug):** During the 3-frame turn animation, `activeAnimController` points to the turn controller, so FPS override and footstep frame checks operate on the turn controller briefly. This is harmless — at most one spurious dust puff during a turn, which is visually indistinguishable from the existing turn particles.

### Verification
- `npx tsc --noEmit` — passes
- `npm run test:run` — 427 tests pass (16 files)
