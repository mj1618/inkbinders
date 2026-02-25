# Task: Squash-and-Stretch Tuning

**Epic:** 012 — Player Movement Perfection
**Task slug:** squash-stretch-tuning

---

## Goal

Enable squash-stretch by default and tune every deformation value to complement the new sprite animations. Add 4 new deformation events (apex float, fast fall, run footstrike, slide boost). The player should feel bouncy and alive without looking broken.

---

## Context

### What exists

The squash-stretch system is **fully implemented** but **disabled by default** (`squashStretchEnabled: false`).

**Current architecture in `Player.ts`:**
- `scaleX`/`scaleY` instance fields (default 1.0), with `targetScaleX`/`targetScaleY` always at 1.0
- `applySquash(sx, sy)` — sets scaleX/scaleY instantly, returns to 1.0 via lerp at `scaleReturnSpeed`
- Lerp runs every frame in `update()` when enabled
- **9 existing trigger points:** turn-around, crouch entry, jump launch, soft landing (2 sites), hard landing (2 sites), wall-slide entry, wall-jump, dash start, dash end
- Sprite rendering **already supports squash-stretch** — `scaleX`/`scaleY` passed to `AnimationController.draw()`, anchored at bottom-center of the sprite frame

**Current default values (all set in `DEFAULT_PLAYER_PARAMS`, ~line 132):**
```
squashStretchEnabled: false
jumpLaunchScaleX: 0.7,  jumpLaunchScaleY: 1.4
softLandScaleX: 1.4,    softLandScaleY: 0.6
hardLandScaleX: 1.6,    hardLandScaleY: 0.5
dashStartScaleX: 1.5,   dashStartScaleY: 0.7
dashEndScaleX: 0.8,     dashEndScaleY: 1.2
wallSlideEntryScaleX: 0.8, wallSlideEntryScaleY: 1.15
wallJumpScaleX: 0.75,   wallJumpScaleY: 1.35
turnScaleX: 0.85
crouchSquashScaleX: 1.2, crouchSquashScaleY: 0.7
scaleReturnSpeed: 12.0
```

The current values are quite extreme (e.g. 0.5 hardLandScaleY, 1.6 hardLandScaleX). They need to be dialed back so the character reads well with the new sprite art.

---

## What to do

### 1. Enable squash-stretch by default

In `src/engine/entities/Player.ts`, change `DEFAULT_PLAYER_PARAMS`:

```typescript
squashStretchEnabled: true,   // was: false
```

### 2. Tune existing deformation values

Update `DEFAULT_PLAYER_PARAMS` with these less-extreme values:

```typescript
// Squash-stretch — tuned for sprite readability
squashStretchEnabled: true,
jumpLaunchScaleX: 0.75,       // was: 0.7 — less extreme horizontal squash
jumpLaunchScaleY: 1.30,       // was: 1.4 — less extreme vertical stretch
softLandScaleX: 1.30,         // was: 1.4 — subtler landing squash
softLandScaleY: 0.70,         // was: 0.6 — less extreme compression
hardLandScaleX: 1.45,         // was: 1.6 — still dramatic but not cartoonish
hardLandScaleY: 0.60,         // was: 0.5 — noticeable without breaking silhouette
dashStartScaleX: 1.40,        // was: 1.5 — stretch in dash direction
dashStartScaleY: 0.75,        // was: 0.7 — slight squash perpendicular
dashEndScaleX: 0.82,          // was: 0.8 — subtle recoil
dashEndScaleY: 1.15,          // was: 1.2 — brief vertical rebound
wallSlideEntryScaleX: 0.85,   // was: 0.8 — subtle horizontal compress
wallSlideEntryScaleY: 1.12,   // was: 1.15 — slight vertical stretch
wallJumpScaleX: 0.78,         // was: 0.75 — horizontal squash on push-off
wallJumpScaleY: 1.28,         // was: 1.35 — vertical stretch for launch feel
turnScaleX: 0.88,             // was: 0.85 — subtle horizontal squash
crouchSquashScaleX: 1.18,     // was: 1.2 — slight horizontal spread
crouchSquashScaleY: 0.75,     // was: 0.7 — noticeable squat
scaleReturnSpeed: 10.0,       // was: 12.0 — slightly slower return for more bounce
```

### 3. Add 4 new deformation events

Add 8 new params to `PlayerParams` interface (~line 65):

```typescript
// New squash-stretch events
apexFloatScaleX: number;      // default 0.95
apexFloatScaleY: number;      // default 1.08
fastFallScaleX: number;       // default 0.88
fastFallScaleY: number;       // default 1.15
runFootstrikeScaleX: number;  // default 1.05
runFootstrikeScaleY: number;  // default 0.97
slideBoostScaleX: number;     // default 1.30
slideBoostScaleY: number;     // default 0.75
```

Add defaults to `DEFAULT_PLAYER_PARAMS`:
```typescript
apexFloatScaleX: 0.95,
apexFloatScaleY: 1.08,
fastFallScaleX: 0.88,
fastFallScaleY: 1.15,
runFootstrikeScaleX: 1.05,
runFootstrikeScaleY: 0.97,
slideBoostScaleX: 1.30,
slideBoostScaleY: 0.75,
```

### 4. Implement the 4 new deformation triggers in Player.update()

**A. Apex float entry** — when `isInApexFloat` first becomes true:

Add a tracking field to Player:
```typescript
private wasInApexFloat = false;
```

In the update method, after the existing apex float detection logic (search for `isInApexFloat`):
```typescript
// Apex float entry squash
if (this.isInApexFloat && !this.wasInApexFloat) {
  this.applySquash(this.params.apexFloatScaleX, this.params.apexFloatScaleY);
}
this.wasInApexFloat = this.isInApexFloat;
```

**B. Fast fall stretch** — when falling fast (once, not every frame):

Add a tracking field:
```typescript
private fastFallSquashApplied = false;
```

In the FALLING state update (or in the general update after state machine runs), when the player is falling:
```typescript
if (currentState === 'FALLING' && !this.isInApexFloat) {
  const fallRatio = Math.min(1, this.velocity.y / this.params.maxFallSpeed);
  if (fallRatio > 0.5 && !this.fastFallSquashApplied) {
    this.applySquash(this.params.fastFallScaleX, this.params.fastFallScaleY);
    this.fastFallSquashApplied = true;
  }
}
```

Reset `fastFallSquashApplied = false` when:
- Landing (entering IDLE, RUNNING, or HARD_LANDING from a falling state)
- Entering any non-FALLING state

The simplest place: in the squash-stretch section of update, check if state is NOT FALLING and NOT JUMPING, then reset `fastFallSquashApplied = false`.

**C. Run footstrike** — every 4th run animation frame:

Add a tracking field:
```typescript
private lastRunFootstrikeFrame = -1;
```

In the RUNNING state update, after animation advances:
```typescript
if (currentState === 'RUNNING' && this.activeAnimController) {
  const frameIndex = this.activeAnimController.getCurrentFrameIndex();
  // Footstrike on frames 0 and 4 of the 8-frame run cycle
  if ((frameIndex === 0 || frameIndex === 4) && frameIndex !== this.lastRunFootstrikeFrame) {
    if (Math.abs(this.velocity.x) > this.params.maxRunSpeed * 0.4) {
      this.applySquash(this.params.runFootstrikeScaleX, this.params.runFootstrikeScaleY);
    }
    this.lastRunFootstrikeFrame = frameIndex;
  } else if (frameIndex !== 0 && frameIndex !== 4) {
    this.lastRunFootstrikeFrame = -1;
  }
}
```

**D. Slide boost** — at crouch-slide start:

This should trigger at the moment of entering CROUCH_SLIDING state. Find where the state machine transitions to CROUCH_SLIDING (the enter handler for CROUCH_SLIDING state):
```typescript
this.applySquash(this.params.slideBoostScaleX, this.params.slideBoostScaleY);
```

### 5. Add showcase page sliders for new params

In `/test/movement-showcase/page.tsx`, find the squash-stretch slider section and add sliders for the 8 new params:
- Apex Float Scale X (0.8–1.0)
- Apex Float Scale Y (1.0–1.2)
- Fast Fall Scale X (0.7–1.0)
- Fast Fall Scale Y (1.0–1.3)
- Run Footstrike Scale X (1.0–1.15)
- Run Footstrike Scale Y (0.9–1.0)
- Slide Boost Scale X (1.0–1.5)
- Slide Boost Scale Y (0.6–1.0)

---

## Files to modify

| File | Changes |
|------|---------|
| `src/engine/entities/Player.ts` | Enable squash-stretch, tune 16 existing values, add 8 new params to interface + defaults, add 4 tracking fields, add 4 new trigger events in update logic |
| `src/app/test/movement-showcase/page.tsx` | Add sliders for 8 new squash-stretch params |

---

## Verification

1. **TypeScript compiles:** `npx tsc --noEmit` passes
2. **Tests pass:** `npm run test:run` — no regressions
3. **Visual check — Squash on every event:**
   - Jump launch → brief vertical stretch
   - Landing (soft) → brief horizontal squash
   - Landing (hard) → dramatic horizontal squash
   - Dash start → horizontal stretch in dash direction
   - Dash end → brief vertical rebound
   - Turn-around while running → subtle horizontal squash
   - Crouch entry → horizontal spread + vertical squash
   - Wall-slide entry → slight horizontal compress
   - Wall-jump → vertical stretch
   - **NEW:** Apex float → subtle vertical stretch at top of jump arc
   - **NEW:** Fast fall → vertical stretch during fast descent (fires once)
   - **NEW:** Run footstrike → very subtle compression on foot contacts (at speed)
   - **NEW:** Slide boost → strong horizontal stretch at crouch-slide start
4. **Sprite rendering:** Squash-stretch visually deforms the sprite (not just rectangles). Bottom-center anchor point means the feet stay planted.
5. **Scale return:** After each event, scaleX/scaleY smoothly lerp back to 1.0 with no snapping or oscillation.
6. **Readability:** The character still reads as the same shape — deformations are noticeable but not extreme.
7. **Showcase sliders:** All 8 new params visible in the movement showcase page's squash-stretch section and update in real-time.

---

## Important notes

- The squash-stretch system is **purely visual** — it affects rendering only, never collision boxes
- `applySquash()` early-returns if `squashStretchEnabled` is false, so all existing behavior is preserved when disabled
- The `scaleReturnSpeed` of 10.0 means deformations last ~0.1s before returning to normal — fast enough to feel snappy, slow enough to be visible
- Run footstrike is very subtle (1.05/0.97) — it should be felt more than seen. If it's distracting, the values can be pulled even closer to 1.0.
- The fast fall squash fires only once per fall, preventing the character from pulsing during long falls

---

## Implementation Summary

**Completed by agent 8f19f706**

### Changes made

| File | Changes |
|------|---------|
| `src/engine/entities/Player.ts` | Enabled `squashStretchEnabled: true`, tuned all 16 existing deformation values to less-extreme defaults, added 8 new params (`apexFloatScaleX/Y`, `fastFallScaleX/Y`, `runFootstrikeScaleX/Y`, `slideBoostScaleX/Y`) to interface + defaults, added 3 tracking fields (`wasInApexFloat`, `fastFallSquashApplied`, `lastRunFootstrikeFrame`), implemented 4 new deformation triggers (apex float entry, fast fall stretch, run footstrike, slide boost) |
| `src/app/test/movement-showcase/page.tsx` | Added 8 new sliders in the Squash-Stretch section for all new params with appropriate min/max ranges |

### Verification

- `npx tsc --noEmit` — passes cleanly
- `npm run test:run` — 427 tests across 16 files, all passing, no regressions

---

## Review

**Reviewed by agent 751c8ea2 — no issues found**

- All 8 new `PlayerParams` fields properly typed and added to interface + defaults
- 4 new deformation triggers implemented correctly with one-shot tracking:
  - Apex float entry: `wasInApexFloat` flag gates to fire once on transition
  - Fast fall stretch: `fastFallSquashApplied` gates to fire once per fall, correctly reset on non-falling states
  - Run footstrike: frame-based detection on animation frames 0/4, properly guarded by sprite availability
  - Slide boost: fires in `CROUCH_SLIDING` enter handler — clean one-shot placement
- Squash-stretch lerp return uses `dt`-scaled exponential decay — acceptable for visual-only effects
- All 8 new sliders wired in movement-showcase page with appropriate min/max ranges
- Tests: 427 passing, no regressions
