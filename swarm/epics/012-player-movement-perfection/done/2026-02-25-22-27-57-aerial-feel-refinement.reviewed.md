# Task: Aerial Feel Refinement

**Epic:** 012 — Player Movement Perfection
**Task slug:** aerial-feel-refinement

---

## Goal

Make the entire jump arc — launch, rise, apex hang, fall, and landing — look and feel polished. Add apex float animation override, pebble particles for hard landings, and ensure the full jump arc reads as a cohesive fluid motion.

---

## Context

### What already exists

**Jump arc structure:**
- JUMPING state (`Player.ts:773–869`): applies `riseGravity`, enters apex float when `|velocity.y| < apexVelocityThreshold`, transitions to FALLING when `velocity.y >= 0`
- FALLING state (`Player.ts:871–1043`): applies `fallGravity`, tracks `fallDurationFrames`, detects landing tiers (soft ≥12 frames, hard ≥30 frames)
- HARD_LANDING state (`Player.ts:1045–1089`): recovery animation for `hardLandRecoveryFrames` (8 frames), dash-cancellable

**Sprites (already integrated from Task 3):**
- `player-jump-rise` sheet: 4 frames (anticipation → launch → rise → near-apex) at 12fps, non-looping
- `player-jump-fall` sheet: 4 frames (apex float → tilt down → fast fall → brace) at 10fps, non-looping
- `jump-apex` animation ALREADY defined in `player-jump-fall` sheet (frame [0], 1fps, no loop) — `PlayerSprites.ts:134`
- `jump-apex` fallback also in original `player-jump` sheet (frame [1]) — `PlayerSprites.ts:104`
- `player-land` sheet: 3 frames (impact → push → stand) at 8fps for HARD_LANDING

**STATE_TO_ANIMATION (current):**
- JUMPING → `player-jump-rise:jump-rise-full` (fallback: `player-jump:jump-rise`)
- FALLING → `player-jump-fall:jump-fall-full` (fallback: `player-jump:jump-fall`)
- HARD_LANDING → `player-land:hard-land`

**Squash-stretch (already done in Task 5):**
- Jump launch: `0.75 × 1.30` ✓
- Soft land: `1.30 × 0.70` ✓
- Hard land: `1.45 × 0.60` ✓
- Apex float entry: `0.95 × 1.08` ✓ (via `wasInApexFloat` tracking, `Player.ts:1516–1517`)
- Fast fall: `0.88 × 1.15` ✓ (once per fall via `fastFallSquashApplied`, `Player.ts:1522–1527`)

**Screen shake for hard landing:** magnitude 3, 4 frames (`Player.ts:1059–1061`) ✓

**Particles currently emitted:**
- Jump launch: 5 dust particles (`Player.ts:804`)
- Soft landing: 4 dust particles (`Player.ts:1013, 1041`)
- Hard landing: 10 dust particles (`Player.ts:1010, 1066`)
- All use `DUST_COLORS` and the `emitFeetParticles()` helper

**What does NOT exist yet:**
1. **No apex float animation override** — `jump-apex` animation is defined but never triggered. The player stays on `jump-rise-full` through the apex instead of switching to the billowing-robe apex frame.
2. **No pebble particles** for hard landings — only dust. The epic spec calls for 2 larger, darker "pebble" particles that bounce.
3. **No differentiated crossfade duration for landing** — all landings use the same generic crossfade from the transitions table. Soft landings from a short fall should blend more smoothly into idle/run.

**Crossfade system (from Task 4):**
The `getCrossfadeDuration()` function in `Player.ts` maps state transitions to crossfade frame counts. The animation update code (`Player.ts:1593–`) detects state animation changes via `previousStateAnimKey` and applies crossfade. This system is **purely visual** — it never delays state transitions.

---

## What to do

### 1. Apex float animation override

When the player is in the apex float zone (near the top of the jump arc), override the animation to use the dedicated `jump-apex` animation. This shows the character's robe billowing at the peak — a distinct visual that makes the apex feel intentional.

In the animation update section of `Player.ts` (around line 1596, where `STATE_TO_ANIMATION` is consulted), add an override check:

```typescript
// After resolving rawMapping and applying fallback logic...
// Override animation when in apex float (both JUMPING and FALLING near apex)
const currentState = this.stateMachine.getCurrentState();
if ((currentState === 'JUMPING' || currentState === 'FALLING') && this.isInApexFloat) {
  // Use apex animation — check if expanded sheet is available
  const assetManager = AssetManager.getInstance();
  if (assetManager.isRealAsset("player-jump-fall")) {
    mapping = { sheetId: "player-jump-fall", animName: "jump-apex", facesLeft: true };
  } else if (assetManager.isRealAsset("player-jump")) {
    mapping = { sheetId: "player-jump", animName: "jump-apex", facesLeft: true };
  }
  // If neither is a real asset, keep the resolved mapping (placeholder frames)
}
```

**Important:** The override is AFTER fallback resolution but BEFORE the `animKey !== previousStateAnimKey` check. This means the apex animation will naturally crossfade in (using the JUMPING→JUMPING or FALLING→FALLING self-transition, which has 0-frame crossfade — resulting in an instant swap, which is correct for apex detection that happens mid-state).

However, we want a brief 2-frame crossfade when entering/exiting apex float. To achieve this, detect the apex override change separately:

Add a tracking field:
```typescript
private apexAnimActive = false;
```

In the animation update:
```typescript
const isApexOverride = (currentState === 'JUMPING' || currentState === 'FALLING') && this.isInApexFloat;
if (isApexOverride !== this.apexAnimActive) {
  // Apex state changed — apply 2-frame crossfade for smooth visual transition
  // This is handled by the existing crossfade system since animKey changes
  this.apexAnimActive = isApexOverride;
}
```

The existing `animKey !== previousStateAnimKey` check will detect the mapping change and apply a crossfade. We need to make sure the crossfade duration for this specific case is 2 frames. Modify `getCrossfadeDuration()` or handle it inline: if the previous and current states are both JUMPING/FALLING and we're transitioning to/from apex, use 2 frames.

### 2. Pebble particles for hard landings

Add a second particle burst for hard landings — 2 larger, darker "pebble" particles that arc up and fall with higher gravity, simulating debris kicked up by impact.

Add a new private helper to Player:

```typescript
/** Emit "pebble" debris particles at the player's feet (for hard landings) */
private emitPebbleParticles(): void {
  if (!this.particleSystem) return;
  const feetX = this.position.x + this.size.x / 2;
  const feetY = this.position.y + this.size.y;
  this.particleSystem.emit({
    x: feetX,
    y: feetY,
    count: 2,
    speedMin: 60,
    speedMax: 100,
    angleMin: -Math.PI * 0.8,   // mostly upward, wide horizontal spread
    angleMax: -Math.PI * 0.2,
    lifeMin: 0.3,
    lifeMax: 0.4,
    sizeMin: 3,
    sizeMax: 4,
    colors: ["#8b7355", "#6b5b3d"],  // stone brown shades
    gravity: 400,  // heavy — falls quickly for a satisfying bounce feel
  });
}
```

Call `this.emitPebbleParticles()` wherever hard landing particles are emitted:
- In the FALLING state hard landing branch (`Player.ts:~1010`, after `emitFeetParticles(10, ...)`)
- In the HARD_LANDING enter handler (`Player.ts:~1066`, after `emitFeetParticles(10, ...)`)

### 3. Soft landing crossfade polish

Currently soft landings transition to idle/run with the default crossfade duration. Since the player just went through a fall → land visual sequence, the transition to idle should feel slightly cushioned (3-frame blend).

In the `getCrossfadeDuration()` function, check if the transition is from FALLING to IDLE or FALLING to RUNNING:

```typescript
// Soft landing: longer blend
if (fromState === 'FALLING' && (toState === 'IDLE' || toState === 'RUNNING')) {
  return 3;
}
```

This may already be covered by a generic entry. Check what exists and add/modify if needed. The key is that FALLING → IDLE should be 3 frames, not 0 or some other value.

### 4. Hard landing screen shake tuning

The current hard landing screen shake is `shake(3, 4)` — magnitude 3, 4 frames. This is fine for moderate falls, but for very long falls (50+ frames of falling), it should be slightly more intense. Scale shake magnitude with fall duration:

```typescript
// In HARD_LANDING enter handler
if (player.screenShake) {
  const fallRatio = Math.min(1, player.fallDurationFrames / 60);  // 0–1 based on fall length
  const magnitude = 3 + fallRatio * 2;  // 3–5 magnitude
  const duration = 4 + Math.round(fallRatio * 2);  // 4–6 frames
  player.screenShake.shake(magnitude, duration);
}
```

Also in the FALLING state's hard landing branch where screen shake is triggered (if applicable — check if screen shake is called there too, or only in the HARD_LANDING enter handler).

### 5. Add showcase page slider for screen shake tuning (optional, small)

In the movement-showcase page, add a "Landing" section or extend the existing "Squash-Stretch" section with:
- A label showing the last landing type (None / Soft / Hard) — read from `player.lastLandingType`
- The `fallDurationFrames` count on landing

This is a small quality-of-life addition for the tuning task (Task 9) later.

---

## Files to modify

| File | Changes |
|------|---------|
| `src/engine/entities/Player.ts` | (1) Add `apexAnimActive` tracking field. (2) Add apex float animation override in the animation update section (~line 1596). (3) Add `emitPebbleParticles()` private method. (4) Call pebble particles on hard landing (2 call sites). (5) Tune screen shake to scale with fall duration. (6) Ensure FALLING→IDLE/RUNNING crossfade is 3 frames. |
| `src/app/test/movement-showcase/page.tsx` | (optional) Add landing info display (last landing type, fall frames) |

---

## Verification

1. **TypeScript compiles:** `npx tsc --noEmit` passes
2. **Tests pass:** `npm run test:run` — no regressions (427 tests)
3. **Apex float animation override:**
   - Jump and reach the peak of the arc → the sprite briefly shows the billowing-robe apex frame (frame 0 of `player-jump-fall`)
   - The apex frame is visible for 2–4 frames (matching the apex float duration at `apexGravityMultiplier`)
   - Transitions smoothly from jump-rise into apex, then from apex into jump-fall-full
   - Works with both expanded sprites and fallback (original) sprites
4. **Pebble particles on hard landing:**
   - Fall from a high platform (30+ frames of falling) → 2 larger, dark brown particles appear alongside the regular dust burst
   - Pebble particles arc upward then fall quickly (gravity 400, heavier than dust at 200)
   - Pebble particles are visually distinct from dust (darker color, larger size)
5. **Soft landing crossfade:**
   - Fall from a medium height (12–29 frames) → landing into idle shows a 3-frame visual blend (not a hard cut)
   - Verify by using slow motion (0.25×) on the showcase page
6. **Screen shake scaling:**
   - Short hard landing (30 frames of fall): shake magnitude ~3, duration ~4 frames
   - Long hard landing (60+ frames of fall): shake magnitude ~5, duration ~6 frames
   - Shake is always brief and never disorienting
7. **Full jump arc cohesion:**
   - The complete arc (launch → rise → apex hang → fall → land) should look like ONE fluid motion
   - The jump-rise animation plays through during ascent
   - At the peak, the apex frame appears briefly (robe billows)
   - The jump-fall animation plays through during descent
   - Landing shows appropriate squash + particles based on tier
   - No jarring visual cuts at any point in the arc

---

## Important notes

- The apex animation override is purely visual — it does NOT affect physics, state transitions, or input handling
- The `jump-apex` animation is already defined in PlayerSprites.ts — no new sprite sheets or animation defs needed
- Pebble particles use the existing `ParticleSystem.emit()` API with different colors/sizes/gravity — no new particle system features needed
- The crossfade system (from Task 4) handles all animation blending — this task only adjusts which durations are used for specific transitions
- Screen shake scaling is bounded (max magnitude 5, max 6 frames) to prevent disorienting effects
- All changes are backward-compatible — if sprite sheets aren't loaded, fallback animations work normally

---

## Completion Summary

### Files modified
| File | Changes |
|------|---------|
| `src/engine/entities/Player.ts` | Added apex float animation override, pebble particles, and screen shake scaling |

### What was built

1. **Apex float animation override** — When `isInApexFloat` is true during JUMPING or FALLING states, the animation mapping is overridden to use the `jump-apex` animation from `player-jump-fall` (or `player-jump` as fallback). Added `apexAnimActive` tracking field to detect transitions into/out of apex float and apply a 2-frame crossfade for smooth visual blending.

2. **Pebble particles for hard landings** — Added `emitPebbleParticles()` private method that emits 2 larger, darker stone-brown particles (`#8b7355`, `#6b5b3d`) with high gravity (400) for a satisfying debris bounce feel. Called at both hard landing particle emission sites: the FALLING state's buffered-jump hard landing branch and the HARD_LANDING enter handler.

3. **Soft landing crossfade** — Already existed at 3 frames (`FALLING->IDLE: 3`, `FALLING->RUNNING: 3` in `CROSSFADE_DURATIONS`). No changes needed.

4. **Screen shake scaling with fall duration** — Replaced the fixed `shake(3, 4)` call in HARD_LANDING enter handler with dynamic scaling: magnitude `3 + fallRatio * 2` (3–5) and duration `4 + round(fallRatio * 2)` (4–6 frames), where `fallRatio = min(1, fallDurationFrames / 60)`.

### Verification
- `npx tsc --noEmit` — passes
- `npm run test:run` — 427 tests pass, 16 files, no regressions

---

## Review Notes

**Reviewed by:** agent 8c9cb790

**Issues found and fixed:**

1. **Missing screen shake on buffered-jump hard landing** — The FALLING state's buffered-jump path (line ~1074) applied squash, dust particles, and pebble particles for hard landings, but did NOT trigger screen shake. The HARD_LANDING enter handler had screen shake, but the buffered-jump path bypasses HARD_LANDING entirely (goes FALLING → JUMPING). Added the same fall-duration-scaled screen shake (`magnitude 3–5, duration 4–6 frames`) to the buffered-jump hard landing branch so both paths are consistent.

**No issues found in:**
- Apex float animation override: correctly checks JUMPING/FALLING + isInApexFloat, proper fallback chain, 2-frame crossfade on apex transitions
- Pebble particles: appropriate colors, gravity, sizes; called at both hard landing sites
- Soft landing crossfade: pre-existing at 3 frames, correctly left unchanged
- Screen shake scaling in HARD_LANDING: properly bounded, frame-rate independent
- No stale state issues with `isInApexFloat` or `apexAnimActive` flags
- All particle emissions are event-driven, no frame-rate dependent physics
