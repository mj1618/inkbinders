# Task: Animation Transitions

**Epic:** 012 — Player Movement Perfection
**Task slug:** animation-transitions
**Goal:** Eliminate jarring visual cuts between player states by adding smooth animation crossfade blending when the player changes state. This is a purely visual enhancement — state machine transitions and input response remain frame-perfect.

## Context

Currently when the player changes state (e.g., IDLE → RUNNING), the sprite animation hard-cuts to the new animation frame. This looks choppy. The fix is a crossfade system that briefly renders both the outgoing and incoming animation frames with blended alpha.

### Dependencies
- **Task 3 (player-sprite-integration)** may or may not be complete when this task runs. The crossfade system must work with BOTH the old 9-sheet setup AND the new 21-sheet setup (with fallback). The implementation should be robust against either state of `PlayerSprites.ts`.

### Key Architecture
- `AnimationController` (`src/engine/core/AnimationController.ts`) — manages playback of animations on a single `SpriteSheet`. Has `play()`, `restart()`, `update(dt)`, `draw()`, `isFinished()`, `getCurrentFrameIndex()`.
- `Player.ts` lines 1467–1478 — animation resolution section where `STATE_TO_ANIMATION` is looked up and the active controller is switched.
- `Player.ts` lines 1499–1513 — sprite rendering section where `activeAnimController.draw()` is called.
- `SpriteSheet.drawFrame()` — draws a single frame with optional `flipX`, `scaleX`, `scaleY` using canvas `drawImage`.

## What to Build

### 1. Add Crossfade Support to AnimationController

**File:** `src/engine/core/AnimationController.ts`

Add crossfade state tracking and rendering:

```typescript
interface CrossfadeState {
  outgoingSheet: SpriteSheet;
  outgoingFrameIndex: number;
  progress: number;       // 0.0 (all outgoing) → 1.0 (all incoming)
  durationFrames: number; // total crossfade duration in frames
  elapsedFrames: number;  // how many frames have elapsed
}
```

Add a private field:
```typescript
private crossfade: CrossfadeState | null = null;
```

Add methods:

```typescript
/**
 * Start a crossfade from the current frame to a new animation.
 * Captures the current outgoing frame, then switches to the new animation.
 * During crossfade, draw() renders both frames with blended alpha.
 * @param durationFrames Number of game frames for the crossfade (0 = instant)
 */
crossfadeTo(animName: string, durationFrames: number): void {
  if (durationFrames <= 0) {
    // Instant switch — no crossfade
    this.crossfade = null;
    this.restart(animName);
    return;
  }

  // Capture outgoing state
  this.crossfade = {
    outgoingSheet: this.spriteSheet,
    outgoingFrameIndex: this.getCurrentFrameIndex(),
    progress: 0,
    durationFrames,
    elapsedFrames: 0,
  };

  // Start the new animation
  this.restart(animName);
}

/**
 * Start a crossfade while also switching sprite sheets.
 * Used when the state change involves a different sheet entirely.
 */
crossfadeToSheet(newSheet: SpriteSheet, animName: string, durationFrames: number): void {
  if (durationFrames <= 0) {
    this.crossfade = null;
    this.setSpriteSheet(newSheet);
    this.restart(animName);
    return;
  }

  // Capture outgoing state from current sheet
  this.crossfade = {
    outgoingSheet: this.spriteSheet,
    outgoingFrameIndex: this.getCurrentFrameIndex(),
    progress: 0,
    durationFrames,
    elapsedFrames: 0,
  };

  // Switch to new sheet and start the animation
  this.setSpriteSheet(newSheet);
  this.restart(animName);
}

/** Check if a crossfade is currently active */
isCrossfading(): boolean {
  return this.crossfade !== null;
}
```

**Modify `update(dt)`** to advance crossfade progress:

At the start of `update()`, after the existing animation frame advancement, add:

```typescript
// Advance crossfade
if (this.crossfade) {
  this.crossfade.elapsedFrames++;
  this.crossfade.progress = Math.min(1.0, this.crossfade.elapsedFrames / this.crossfade.durationFrames);
  if (this.crossfade.progress >= 1.0) {
    this.crossfade = null; // Crossfade complete
  }
}
```

**Modify `draw()`** to render crossfade blending:

Replace the existing `draw()` implementation:

```typescript
draw(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  flipX = false,
  scaleX = 1,
  scaleY = 1,
): void {
  if (this.crossfade) {
    const outAlpha = 1 - this.crossfade.progress;
    const inAlpha = this.crossfade.progress;

    // Draw outgoing frame with fading alpha
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = prevAlpha * outAlpha;
    this.crossfade.outgoingSheet.drawFrame(
      ctx, this.crossfade.outgoingFrameIndex, x, y, flipX, scaleX, scaleY,
    );

    // Draw incoming frame with increasing alpha
    ctx.globalAlpha = prevAlpha * inAlpha;
    const frameIndex = this.getCurrentFrameIndex();
    this.spriteSheet.drawFrame(ctx, frameIndex, x, y, flipX, scaleX, scaleY);

    ctx.globalAlpha = prevAlpha; // Restore
    return;
  }

  // Normal (no crossfade) rendering
  const frameIndex = this.getCurrentFrameIndex();
  this.spriteSheet.drawFrame(ctx, frameIndex, x, y, flipX, scaleX, scaleY);
}
```

**Key behavior:**
- If a new crossfade starts during an active crossfade, the new one replaces the old (the current "incoming" frame becomes the new "outgoing")
- Crossfade captures the outgoing frame index at the moment of transition (it freezes the outgoing frame — it doesn't keep animating)
- The `crossfadeTo` variant works when staying on the same sheet (e.g., switching from "idle" to "run" if they were on the same sheet). The `crossfadeToSheet` variant handles cross-sheet transitions.
- `globalAlpha` is multiplied (not set directly) so it composes correctly with any existing alpha from the rendering context (e.g., dash trail ghost rendering)

### 2. Define Crossfade Duration Table

**File:** `src/engine/entities/Player.ts`

Add a crossfade duration lookup near the top of the file (after state constants, before the class):

```typescript
/**
 * Crossfade duration in game frames when transitioning between player states.
 * Key format: "FROM_STATE->TO_STATE". Default is 0 (instant, no crossfade).
 * Crossfade is purely visual — it never delays state transitions or input response.
 */
const CROSSFADE_DURATIONS: Record<string, number> = {
  "IDLE->RUNNING":        3,   // Quick, responsive
  "RUNNING->IDLE":        4,   // Slightly longer settle
  "RUNNING->JUMPING":     2,   // Near-instant for responsiveness
  "FALLING->IDLE":        3,   // Landing transition
  "FALLING->RUNNING":     3,   // Landing into run
  "JUMPING->FALLING":     3,   // Rise to fall
  "WALL_SLIDING->IDLE":   2,   // Detach from wall
  "WALL_SLIDING->FALLING":2,   // Fall off wall
  "DASHING->IDLE":        2,   // Brief exit blend
  "DASHING->RUNNING":     2,   // Dash into run
  "DASHING->FALLING":     2,   // Dash into fall
  "HARD_LANDING->IDLE":   3,   // Recovery blend
  "HARD_LANDING->RUNNING":3,   // Recovery into run
  "CROUCHING->IDLE":      2,   // Stand up blend
  "CROUCH_SLIDING->IDLE": 3,   // Slide to stand
  "CROUCH_SLIDING->CROUCHING": 2, // Slide to crouch
};

function getCrossfadeDuration(fromState: string, toState: string): number {
  return CROSSFADE_DURATIONS[`${fromState}->${toState}`] ?? 0;
}
```

**Key design decisions:**
- **Transitions TO DASHING are always 0 (instant)** — dash must feel immediate. Not listed = 0.
- **Transitions TO WALL_SLIDING are always 0** — wall grab must feel immediate.
- **WALL_SLIDING → WALL_JUMPING is 0** — responsiveness.
- **Any → DASHING is 0** — not listed, defaults to 0.
- **Any → WALL_JUMPING is 0** — not listed, defaults to 0.
- Default (unlisted transitions) = 0 (instant, preserving current behavior).

### 3. Wire Crossfade into Player Animation Resolution

**File:** `src/engine/entities/Player.ts`

Add a new private field to the `Player` class:

```typescript
private previousAnimState = "";
private previousStateName = "";
```

Replace the animation resolution block at lines 1467–1478 with crossfade-aware logic:

```typescript
// Update sprite animation based on current state
if (this.spritesReady) {
  const currentState = this.stateMachine.getCurrentState();
  const mapping = STATE_TO_ANIMATION[currentState];
  if (mapping) {
    const animKey = `${mapping.sheetId}:${mapping.animName}`;

    if (animKey !== this.previousAnimState) {
      // State animation changed — determine crossfade duration
      const crossfadeDuration = getCrossfadeDuration(this.previousStateName, currentState);

      const controller = this.animControllers.get(mapping.sheetId);
      if (controller) {
        if (this.activeAnimController && this.activeAnimController !== controller) {
          // Cross-sheet transition: use crossfadeToSheet on the NEW controller
          controller.crossfadeToSheet(
            this.activeAnimController.getSpriteSheet(),
            mapping.animName,
            crossfadeDuration,
          );
          // Actually wait — we need to rethink this. The crossfade state
          // lives on the AnimationController that will be rendering.
          // Let me use the approach where the Player holds the crossfade state instead.
        }
        // ...
      }

      this.previousAnimState = animKey;
      this.previousStateName = currentState;
    }

    // ... update active controller
  }
}
```

Actually, there's an architectural subtlety. The `Player` currently has **one AnimationController per SpriteSheet**, and switches between them by changing `this.activeAnimController`. This means the crossfade needs to be managed at the Player level (not inside a single AnimationController), because the outgoing and incoming animations may be on different controllers.

**Revised approach — crossfade managed by Player:**

Add to `Player` class fields:

```typescript
private previousAnimState = "";
private previousStateName = "";
private crossfadeState: {
  outgoingController: AnimationController;
  outgoingFrameIndex: number;
  outgoingFacesLeft: boolean;
  progress: number;
  durationFrames: number;
  elapsedFrames: number;
} | null = null;
```

Replace the animation resolution block (lines 1467–1478):

```typescript
// Update sprite animation based on current state
if (this.spritesReady) {
  const currentState = this.stateMachine.getCurrentState();
  const mapping = STATE_TO_ANIMATION[currentState];
  if (mapping) {
    const animKey = `${mapping.sheetId}:${mapping.animName}`;

    if (animKey !== this.previousAnimState) {
      // Animation mapping changed — start crossfade if appropriate
      const crossfadeDuration = getCrossfadeDuration(this.previousStateName, currentState);

      if (crossfadeDuration > 0 && this.activeAnimController) {
        // Capture outgoing state for crossfade
        this.crossfadeState = {
          outgoingController: this.activeAnimController,
          outgoingFrameIndex: this.activeAnimController.getCurrentFrameIndex(),
          outgoingFacesLeft: this.activeAnimFacesLeft,
          progress: 0,
          durationFrames: crossfadeDuration,
          elapsedFrames: 0,
        };
      } else {
        // Instant transition (no crossfade)
        this.crossfadeState = null;
      }

      this.previousAnimState = animKey;
      this.previousStateName = currentState;
    }

    // Update crossfade progress
    if (this.crossfadeState) {
      this.crossfadeState.elapsedFrames++;
      this.crossfadeState.progress = Math.min(
        1.0,
        this.crossfadeState.elapsedFrames / this.crossfadeState.durationFrames,
      );
      if (this.crossfadeState.progress >= 1.0) {
        this.crossfadeState = null;
      }
    }

    // Set active controller and play animation
    const controller = this.animControllers.get(mapping.sheetId);
    if (controller) {
      this.activeAnimController = controller;
      this.activeAnimFacesLeft = mapping.facesLeft ?? false;
      controller.play(mapping.animName);
      controller.update(dt);
    }
  }
}
```

### 4. Wire Crossfade into Player Rendering

**File:** `src/engine/entities/Player.ts`

Modify the sprite rendering section (lines 1499–1513) to render crossfade:

```typescript
// Sprite rendering
if (RenderConfig.useSprites() && this.spritesReady && this.activeAnimController) {
  const sheet = this.activeAnimController.getSpriteSheet();
  if (sheet.isLoaded()) {
    const ctx = renderer.getContext();
    const spriteOffsetX = (sheet.config.frameWidth - this.size.x) / 2;
    const spriteOffsetY = sheet.config.frameHeight - this.size.y;
    const flipX = this.activeAnimFacesLeft ? this.facingRight : !this.facingRight;

    if (this.crossfadeState) {
      const outAlpha = 1 - this.crossfadeState.progress;
      const inAlpha = this.crossfadeState.progress;
      const prevAlpha = ctx.globalAlpha;

      // Draw outgoing frame (fading out)
      const outSheet = this.crossfadeState.outgoingController.getSpriteSheet();
      if (outSheet.isLoaded()) {
        const outFlipX = this.crossfadeState.outgoingFacesLeft
          ? this.facingRight : !this.facingRight;
        const outOffsetX = (outSheet.config.frameWidth - this.size.x) / 2;
        const outOffsetY = outSheet.config.frameHeight - this.size.y;
        ctx.globalAlpha = prevAlpha * outAlpha;
        outSheet.drawFrame(
          ctx,
          this.crossfadeState.outgoingFrameIndex,
          pos.x - outOffsetX,
          pos.y - outOffsetY,
          outFlipX,
        );
      }

      // Draw incoming frame (fading in)
      ctx.globalAlpha = prevAlpha * inAlpha;
      this.activeAnimController.draw(
        ctx,
        pos.x - spriteOffsetX,
        pos.y - spriteOffsetY,
        flipX,
      );

      ctx.globalAlpha = prevAlpha;
    } else {
      // Normal rendering (no crossfade)
      this.activeAnimController.draw(
        ctx,
        pos.x - spriteOffsetX,
        pos.y - spriteOffsetY,
        flipX,
      );
    }
  }
}
```

### 5. Rectangle Rendering Crossfade

The rectangle rendering path (lines 1516+) should also support crossfade for the "Both" render mode. This is simpler — just modulate the rectangle's alpha during crossfade:

In the rectangle rendering section, wrap the body rendering with crossfade alpha:

```typescript
if (RenderConfig.useRectangles()) {
  // ... existing color selection logic ...

  const alpha = this.crossfadeState
    ? this.crossfadeState.progress
    : 1.0;

  // Apply squash-stretch + crossfade alpha to rectangle
  // (existing rectangle rendering code, but use alpha in the color)
  // ...
}
```

This is lower priority — rectangles are debug mode only. A simple approach: during crossfade, just render the rectangle at full alpha (no blending needed for debug rects). This avoids overcomplicating the rectangle path.

**Simplest approach for rectangles: do nothing.** Rectangle mode is for debug and the hard-cut there is fine. Only sprite rendering gets the crossfade.

### 6. Handle Edge Cases

**Crossfade interrupted by another state change:**
If a new state transition happens during an active crossfade, the crossfade is immediately replaced. The current "incoming" frame becomes the new "outgoing" frame. This is already handled by the code above — when `animKey !== this.previousAnimState`, a new crossfade is created (or the old one is cleared for instant transitions).

**Same-sheet transitions (e.g., idle → run on old sprites that both use player-idle/player-run):**
Each sheet has its own `AnimationController`, so even same-sheet transitions work correctly — the outgoing controller reference and frame index are captured.

**Headless tests:**
In headless tests, `spritesReady` is false (no sprite sheets loaded), so the entire crossfade code is skipped. No impact on tests.

## Files to Modify

1. **`src/engine/core/AnimationController.ts`** — No changes needed (the crossfade is managed at the Player level instead). However, DO add the `setFrame()` method mentioned in the sprite-integration task, since later tasks need it:
   ```typescript
   setFrame(frameIndex: number): void {
     const anim = this.spriteSheet.getAnimation(this.currentAnim);
     if (!anim) return;
     this.currentFrame = Math.max(0, Math.min(frameIndex, anim.frames.length - 1));
     this.frameTimer = 0;
   }
   ```

2. **`src/engine/entities/Player.ts`** — Main changes:
   - Add `CROSSFADE_DURATIONS` table and `getCrossfadeDuration()` helper
   - Add `previousAnimState`, `previousStateName`, `crossfadeState` fields to Player class
   - Replace animation resolution block (lines ~1467–1478) with crossfade-aware version
   - Update sprite rendering block (lines ~1499–1513) to render crossfade blending

## Verification

### TypeScript Compilation
```bash
npx tsc --noEmit
```
Must pass with zero errors.

### Test Suite
```bash
npm run test:run
```
All existing tests must pass. The crossfade code only runs when `this.spritesReady` is true, which is never the case in headless tests.

### Visual Verification (manual)
1. Open any test page with the player (e.g., `/test/ground-movement`)
2. **IDLE → RUNNING**: Start running from idle. Should see a brief 3-frame blend (not a hard cut)
3. **RUNNING → IDLE**: Stop running. Should see a slightly longer 4-frame blend
4. **RUNNING → JUMPING**: Jump while running. Should see a quick 2-frame blend
5. **Any → DASHING**: Dash from any state. Should be instant (no blend — dash feels immediate)
6. **WALL_SLIDING → WALL_JUMPING**: Wall-jump. Should be instant (no blend)
7. **FALLING → landing**: Land from a fall. Should see a 3-frame blend into idle/running
8. **No double-rendering artifacts**: During crossfade, the player should look like a smooth transition, not two overlapping sprites

### Render Mode Compatibility
- **Sprites mode**: Full crossfade blending visible
- **Rectangles mode**: No change (hard-cut as before)
- **Both mode**: Sprites show crossfade, rectangles show hard-cut (this is acceptable — rectangles are debug only)

## Pass Criteria

- [ ] `CROSSFADE_DURATIONS` table defined with all relevant state transitions
- [ ] `getCrossfadeDuration()` returns 0 for unlisted transitions (preserving instant behavior)
- [ ] Player tracks `previousAnimState` and `previousStateName` for change detection
- [ ] `crossfadeState` captures outgoing controller + frame index on transition
- [ ] Crossfade progress advances each frame (linear from 0 to 1)
- [ ] Sprite rendering draws both outgoing (fading out) and incoming (fading in) frames during crossfade
- [ ] `globalAlpha` is multiplied (not set) so it composes with existing alpha
- [ ] Crossfade is interrupted cleanly when a new state transition happens mid-crossfade
- [ ] IDLE ↔ RUNNING has visible smooth transition (~3-4 frames)
- [ ] RUNNING → JUMPING blends quickly (~2 frames)
- [ ] Any → DASHING is instant (0 frames, no crossfade)
- [ ] WALL_SLIDING → WALL_JUMPING is instant (0 frames)
- [ ] Landing from fall blends smoothly into idle/running
- [ ] No visual artifacts (flickering, double-rendering at full alpha, ghost frames)
- [ ] Controls remain frame-perfect responsive (crossfade never delays state transitions)
- [ ] TypeScript compiles cleanly (`npx tsc --noEmit`)
- [ ] All existing tests pass (`npm run test:run`)
- [ ] `AnimationController.setFrame()` method added (for use by later tasks)

## Important Notes

- **Crossfade is purely visual.** The state machine transitions instantly — crossfade is a rendering-only effect. If the player presses dash during a crossfade, the dash happens immediately and the crossfade is replaced.
- **Outgoing frame is frozen.** During crossfade, the outgoing animation does NOT continue playing — it freezes on the last frame it was showing. Only the incoming animation advances. This prevents the weird "two animations playing at once" look.
- **Alpha compositing.** Use `ctx.globalAlpha = prevAlpha * alpha` (multiply) not `ctx.globalAlpha = alpha` (set). This ensures crossfade composes correctly when the canvas already has reduced alpha (e.g., rendering inside a transition overlay).
- **The crossfade lives on Player, not AnimationController.** This is because the outgoing and incoming animations are often on different `AnimationController` instances (different sprite sheets). Moving the crossfade to AnimationController would require passing sheet references around awkwardly.
- **Compatible with Task 3 changes.** If the sprite-integration task has already added fallback logic to the animation resolution block, the crossfade code should be integrated into that updated block (resolve fallback first, THEN check for crossfade). If Task 3 hasn't been applied yet, the crossfade code wraps the original simple lookup.

---

## Implementation Summary

### Files Modified

1. **`src/engine/entities/Player.ts`** — All changes in this single file:
   - Added `CROSSFADE_DURATIONS` lookup table (16 state transition pairs) and `getCrossfadeDuration()` helper after state constants
   - Added `previousStateName` and `crossfadeState` fields to Player class for tracking crossfade blending state
   - Modified animation resolution block in `update()` to capture outgoing controller + frame index on state change and start crossfade when duration > 0; added crossfade progress advancement each frame
   - Modified sprite rendering in `render()` to draw both outgoing (fading out) and incoming (fading in) frames during crossfade, with proper `globalAlpha` multiplication for compositing
   - Crossfade works with both squash-stretch and normal rendering paths
   - Crossfade works across different sprite sheets (different AnimationControllers)

### No changes needed to AnimationController
- `setFrame()` method already existed from a prior task
- Crossfade is managed at the Player level since outgoing/incoming animations may be on different controllers

### Verification
- `npx tsc --noEmit` — passes (zero errors)
- `npm run test:run` — all 427 tests pass across 16 files
- Crossfade code only runs when `spritesReady` is true, which is never the case in headless tests

---

## Review (cb6d8e06)

**Result: PASS — no issues found.**

Verified:
- Crossfade duration table correctly covers 16 state transition pairs; action transitions (→ DASHING, → WALL_SLIDING, → WALL_JUMPING) properly omitted for instant response
- Frame-counting crossfade (`elapsedFrames++`) is correct for fixed 60 Hz timestep — no frame-rate dependency
- Alpha compositing uses multiplication (`prevAlpha * alpha`) for proper composition with existing canvas state (e.g., dash trail ghost rendering)
- Crossfade interruption correctly replaces active crossfade on new state change
- Outgoing frame is frozen at capture time (no double-animation playing)
- Both squash-stretch and normal rendering paths handle crossfade correctly
- Crossfade state managed at Player level (not AnimationController) since outgoing/incoming may be on different controllers — architecturally sound
- `previousStateName` initialized to `""` so first state change always gets 0 crossfade — correct
- Headless test safety confirmed (`spritesReady` is false in tests)
- `npx tsc --noEmit` — zero errors
- `npm run test:run` — all 427 tests pass across 16 files
- No fixes needed
