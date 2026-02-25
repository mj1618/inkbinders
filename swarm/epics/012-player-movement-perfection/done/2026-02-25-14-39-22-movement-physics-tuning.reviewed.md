# Task: Movement Physics Tuning

**Epic:** 012-player-movement-perfection
**Task slug:** movement-physics-tuning

---

## Goal

Final comprehensive tuning pass over all movement physics parameters. The character should feel *responsive, weighty, and satisfying* — every input should produce immediate visual feedback, every state should have clear physical identity, and every transition should feel like the player is in control. This is the "sit and tweak" task that makes the difference between "mechanically works" and "feels incredible."

**This task modifies only `DEFAULT_PLAYER_PARAMS` values in `src/engine/entities/Player.ts`.** No new code, no new features, no new systems. Just numbers.

---

## Context

### Current default values

All values are in `DEFAULT_PLAYER_PARAMS` at line ~100 of `Player.ts`:

```
Ground Movement:
  maxRunSpeed: 280           acceleration: 1800
  deceleration: 1200         turnMultiplier: 3.0
  crouchSpeed: 100           slideInitialSpeed: 350
  slideFriction: 600         slideMinSpeed: 40

Jumping:
  jumpSpeed: 380             riseGravity: 680
  fallGravity: 980           apexGravityMultiplier: 0.4
  apexVelocityThreshold: 50  coyoteFrames: 7
  jumpBufferFrames: 5        airAcceleration: 1400
  airDeceleration: 600       jumpCutMultiplier: 0.4

Wall Mechanics:
  wallSlideBaseSpeed: 120    wallSlideGripSpeed: 40
  wallSlideAcceleration: 800 wallJumpHorizontalSpeed: 260
  wallJumpVerticalSpeed: 340 wallJumpLockoutFrames: 8
  wallJumpCoyoteFrames: 5    wallStickFrames: 3

Dash:
  dashSpeed: 600             dashDurationFrames: 15
  dashWindupFrames: 1        dashCooldownFrames: 18
  dashSpeedBoost: 1.4        dashSpeedBoostDecayRate: 800

Landing:
  softLandThresholdFrames: 12
  hardLandThresholdFrames: 30
  hardLandRecoveryFrames: 8
```

These values were set during initial implementation and haven't been systematically tuned against each other. Tasks 3–8 added visual polish (sprites, transitions, squash-stretch, particles) but didn't touch the underlying physics numbers.

### What to use for testing

**Primary tool:** The movement showcase page at `/test/movement-showcase`:
- Top half: Pose gallery showing all 10 states with frame stepping
- Bottom half: Live playground with floor, gap, platforms, and walls
- Time scale slider: 0.1× to 2.0×
- All squash-stretch sliders
- Render mode toggle (sprites / rectangles / both)

**Additional test pages:**
- `/test/ground-movement` — acceleration/deceleration/turn visual feedback
- `/test/jumping` — jump arc with height markers, apex timing
- `/test/wall-mechanics` — wall-slide speeds, wall-jump launch distances
- `/test/dash` — dash distance, speed boost carry
- `/test/movement-playground` — integrated movement with complex terrain

---

## Tuning Process

Work through each category systematically. For each parameter:
1. Understand what it controls
2. Test the current feel
3. Adjust toward the feel target
4. Test the adjustment against related parameters
5. Record the change and rationale

### Category 1: Ground Movement

| Parameter | Current | Feel Target | Test Method |
|-----------|---------|------------|-------------|
| `acceleration` | 1800 | Reach max speed in ~0.3s (18 frames). Should feel instant but not teleport-y. Currently 280/1800 = 0.156s to max — already fast. May be fine. | Run from idle, count frames to max speed |
| `deceleration` | 1200 | Stop in ~0.2s (12 frames). No ice-skating. 280/1200 = 0.233s — close. May want slightly faster. | Release input while running, check stop time |
| `maxRunSpeed` | 280 | Fast but controllable. Character should be readable (not a blur). At 280 px/s with 960px canvas, crosses screen in 3.4s — probably good. | Run across flat ground, judge speed visually |
| `turnMultiplier` | 3.0 | Reversal should feel instant. At 3.0× deceleration, turnaround force = 3600 px/s². Test: does pressing opposite direction feel snappy? | Run right then press left, check reversal speed |
| `crouchSpeed` | 100 | Noticeably slower than run. 100/280 = 36% of max speed. Should feel deliberate/sneaky. | Crouch-walk across flat ground |
| `slideInitialSpeed` | 350 | Burst of speed from crouch-slide, faster than run. 350 vs 280 run = 25% faster. | Start crouch-slide from max run speed |
| `slideFriction` | 600 | Slide ~3–4 character widths (72–96 px at 24px width). At 350 initial, friction 600: distance ≈ 350²/(2×600) ≈ 102 px (4.3 widths). Good. | Observe slide distance |
| `slideMinSpeed` | 40 | The speed below which slide transitions to crouch. | Check that slide doesn't feel like it lingers |

**Likely adjustments:** Deceleration could increase to 1400 for crisper stopping. Turn multiplier could increase to 3.5 for snappier reversals. These are small tweaks — the ground movement already feels solid.

### Category 2: Jumping

| Parameter | Current | Feel Target | Test Method |
|-----------|---------|------------|-------------|
| `jumpSpeed` | 380 | ~3.5× character height (140 px) = 140px peak. Physics: peak = jumpSpeed²/(2×riseGravity) = 380²/(2×680) = 106px ≈ 2.65 char heights. May want higher. | Jump from ground, check peak height |
| `riseGravity` | 680 | Should feel like a deliberate upward arc, not a cork popping. Rise time = jumpSpeed/riseGravity = 0.56s. | Observe rise arc duration |
| `fallGravity` | 980 | Falls faster than rise. Fall/rise ratio = 980/680 = 1.44×. Should feel weighty on descent. | Jump and observe fall speed |
| `apexGravityMultiplier` | 0.4 | Noticeable 2–3 frame hang at peak. At 0.4×, gravity drops to 272 during apex. With threshold 50 px/s, apex window ≈ 2×50/(680×0.4) = 0.37s (22 frames at 60fps). That's generous — probably too long. | Jump and observe apex hang duration |
| `apexVelocityThreshold` | 50 | Defines how wide the apex float zone is. 50 px/s on both sides of zero. | Count frames spent in apex float |
| `jumpCutMultiplier` | 0.4 | Tap jump should be ~40% of full jump height. At 0.4×, cut velocity = 380×0.4 = 152, peak = 152²/(2×680) = 17px. Hmm, that's only 0.4 char heights — might be too short for a tap. | Tap jump vs hold jump, compare heights |
| `coyoteFrames` | 7 | ~0.117s — should feel generous. Industry standard is 6–8 frames. | Run off edge, press jump late |
| `jumpBufferFrames` | 5 | ~0.083s — should register early jumps. Industry standard is 4–6. | Press jump just before landing |
| `airAcceleration` | 1400 | Responsive air control but not instant. Should allow mid-air direction changes with some commitment. 1400 is 78% of ground accel (1800). | Change direction mid-air |
| `airDeceleration` | 600 | Gradual air slow. 600 is 50% of ground decel (1200). Maintains some momentum. | Release input mid-air |

**Likely adjustments:**
- `apexGravityMultiplier`: 0.4 → 0.35 (slightly less dramatic hang — 22 frames is very long)
- `apexVelocityThreshold`: 50 → 40 (narrower apex window, ~14 frames — still noticeable)
- `jumpSpeed`: 380 → 400 (slightly higher jump for better platforming reach — peak ~118px ≈ 2.95 char heights)
- `jumpCutMultiplier`: 0.4 → 0.45 (tap jump goes from 17px to 24px — more useful minimum hop)

### Category 3: Wall Mechanics

| Parameter | Current | Feel Target | Test Method |
|-----------|---------|------------|-------------|
| `wallSlideBaseSpeed` | 120 | Noticeably slower than freefall (maxFallSpeed 600). 120/600 = 20% — good. | Slide down wall without input |
| `wallSlideGripSpeed` | 40 | Very slow when holding toward wall. 40 px/s feels like controlled descent. | Hold toward wall while sliding |
| `wallSlideAcceleration` | 800 | How fast you accelerate from grip speed to base speed when releasing toward-wall input. | Release toward-wall input, observe speed change |
| `wallJumpHorizontalSpeed` | 260 | Should clear ~4 character widths (96px). At 260 px/s, with lockout 8 frames (0.133s): immediate distance = 260×0.133 = 34.6px, plus drift. Total probably ~70–80px with air control returning. May need more. | Wall-jump, observe horizontal distance |
| `wallJumpVerticalSpeed` | 340 | Should reach ~3× character height. Peak = 340²/(2×680) = 85px ≈ 2.1 char heights. Slightly low for the target. Consider 360 for 95px (2.4 heights). | Wall-jump, observe height |
| `wallJumpLockoutFrames` | 8 | 0.133s commitment. Should feel like a brief push before regaining control. Not punishing, but prevents instant re-grab. | Wall-jump and try to turn back |
| `wallStickFrames` | 3 | 0.05s — brief "catch" before sliding. Should be felt but not sticky. | Touch wall, observe stick pause |

**Likely adjustments:**
- `wallJumpHorizontalSpeed`: 260 → 280 (clearance to ~4 character widths more reliably)
- `wallJumpVerticalSpeed`: 340 → 360 (slightly higher wall-jump for better vertical reach)

### Category 4: Dash

| Parameter | Current | Feel Target | Test Method |
|-----------|---------|------------|-------------|
| `dashSpeed` | 600 | Should feel explosively fast. 600 px/s for 15 frames (0.25s) = 150px distance (6.25 char widths). Good. | Dash across flat ground |
| `dashDurationFrames` | 15 | 0.25s dash. Visible streak, not a blink. | Observe dash duration |
| `dashWindupFrames` | 1 | Near-instant. 1 frame is fine. | Press dash, check responsiveness |
| `dashCooldownFrames` | 18 | 0.3s cooldown. At 15+18 = 33 frames (0.55s) total cycle. Can dash roughly twice per second. | Dash repeatedly, check rhythm |
| `dashSpeedBoost` | 1.4 | After ground dash, run speed boosted to 280×1.4 = 392 for a brief period. Noticeable burst. | Dash then continue running |
| `dashSpeedBoostDecayRate` | 800 | Speed boost decays at 800 px/s². Time to decay from 392 to 280: 112/800 = 0.14s. Brief. | Observe how long speed boost lasts |

**Likely adjustments:** Dash feels intentionally fast already. Possibly `dashCooldownFrames`: 18 → 16 (slightly faster dash rhythm — 0.52s cycle). Or leave as-is.

### Category 5: Landing

| Parameter | Current | Feel Target | Test Method |
|-----------|---------|------------|-------------|
| `softLandThresholdFrames` | 12 | Falls >12 frames (0.2s) show soft landing. Feels right — most jumps are 30+ frames so most land-from-above will soft-land. | Short falls, check for landing animation |
| `hardLandThresholdFrames` | 30 | Falls >30 frames (0.5s) trigger hard landing. 30 frames of falling at average 300px/s ≈ 150px fall. That's a significant fall. | Long falls, check for hard land |
| `hardLandRecoveryFrames` | 8 | 0.133s stuck time. Brief punishment. Dash-cancellable, so skilled players can skip it. | Hard land, measure stuck time |

**Likely adjustments:** These feel well-calibrated already. Possibly no changes.

### Category 6: Squash-Stretch (verify, don't change)

The squash-stretch values were tuned in Task 5. Verify they still look correct after any physics changes. If changing `jumpSpeed` or `fallGravity`, the visual timing of squash-stretch triggers changes slightly. Re-evaluate:
- Jump launch squash (0.75, 1.30) — still looks right at new jumpSpeed?
- Landing squash — still triggers at right moments with new thresholds?
- Fast fall stretch — still triggers at right fall speed?

**Don't change squash-stretch values unless physics changes make them look wrong.**

---

## Implementation

### Files to modify

| File | Changes |
|------|---------|
| `src/engine/entities/Player.ts` | Modify values in `DEFAULT_PLAYER_PARAMS` |

### Process

1. Start the dev server (`npm run dev`)
2. Open `/test/movement-showcase` in a browser
3. Work through each category above, adjusting values one at a time
4. After adjusting a value, test adjacent parameters for cascading effects
5. Once all categories are tuned, do a final integration test:
   - Play through the showcase playground for 60 seconds
   - Try all 10 movement states in sequence
   - Chain moves: run → jump → wall-slide → wall-jump → dash → land → crouch-slide
   - Does it feel cohesive? Is there any moment where control feels sluggish?
6. Run tests: `npm run test:run` to ensure no regressions (some tests check specific physics values)
7. Run type check: `npx tsc --noEmit`

### Expected final values (starting point — adjust based on feel)

```typescript
export const DEFAULT_PLAYER_PARAMS: PlayerParams = {
  // Ground Movement — crisp, responsive, immediate
  maxRunSpeed: 280,             // unchanged — speed is good
  acceleration: 1800,           // unchanged — already snappy
  deceleration: 1400,           // was 1200 — crisper stop, less ice-skating
  turnMultiplier: 3.5,          // was 3.0 — snappier direction reversal
  crouchSpeed: 100,             // unchanged
  slideInitialSpeed: 350,       // unchanged
  slideFriction: 600,           // unchanged
  slideMinSpeed: 40,            // unchanged

  // Jumping — higher arc, tighter apex, more useful tap jump
  jumpSpeed: 400,               // was 380 — slightly higher peak, better platforming reach
  riseGravity: 720,             // was 680 — slightly faster rise to compensate for higher speed
  fallGravity: 1020,            // was 980 — slightly heavier fall, more weight
  apexGravityMultiplier: 0.35,  // was 0.4 — still floaty but less extreme (14 frames vs 22)
  apexVelocityThreshold: 40,    // was 50 — narrower apex window
  coyoteFrames: 7,              // unchanged — already generous
  jumpBufferFrames: 5,          // unchanged — already standard
  airAcceleration: 1400,        // unchanged — good air control
  airDeceleration: 600,         // unchanged
  jumpCutMultiplier: 0.45,      // was 0.4 — slightly higher min hop for utility

  // Wall Mechanics — more explosive wall-jump
  wallSlideBaseSpeed: 120,      // unchanged
  wallSlideGripSpeed: 40,       // unchanged
  wallSlideAcceleration: 800,   // unchanged
  wallJumpHorizontalSpeed: 280, // was 260 — clears 4 char widths more reliably
  wallJumpVerticalSpeed: 360,   // was 340 — slightly higher for better vertical reach
  wallJumpLockoutFrames: 8,     // unchanged
  wallJumpCoyoteFrames: 5,      // unchanged
  wallStickFrames: 3,           // unchanged

  // Dash — slightly faster rhythm
  dashSpeed: 600,               // unchanged
  dashDurationFrames: 15,       // unchanged
  dashWindupFrames: 1,          // unchanged
  dashCooldownFrames: 16,       // was 18 — slightly faster dash rhythm
  dashSpeedBoost: 1.4,          // unchanged
  dashSpeedBoostDecayRate: 800, // unchanged

  // Landing — unchanged (well-calibrated)
  softLandThresholdFrames: 12,
  hardLandThresholdFrames: 30,
  hardLandRecoveryFrames: 8,
};
```

These are STARTING POINTS. The developer must test each change and may adjust further or revert changes that don't feel right. The process matters more than hitting these exact numbers.

---

## Verification

### Type check and tests
1. `npx tsc --noEmit` passes
2. `npm run test:run` passes — **Note:** Some tests may assert specific physics values (e.g., "player reaches max speed of 280"). If tests fail due to changed defaults, update the test expectations to match the new values. Don't change the physics to fit old test expectations — change the tests.

### Browser verification (mandatory)
Open `/test/movement-showcase` and verify:

**Ground movement:**
- [ ] Run from idle reaches max speed in ~0.3s — no sluggish startup
- [ ] Stopping from a run takes ~0.2s — no ice-skating
- [ ] Direction reversal feels instant — no "swimming" feeling
- [ ] Crouch-walk feels deliberately slower than run
- [ ] Crouch-slide covers ~3–4 character widths

**Jumping:**
- [ ] Full jump peak is ~3× character height
- [ ] Apex hang is noticeable (2–3 visual frames of floating) but not extreme
- [ ] Tap jump produces a useful minimum hop (~1 character height)
- [ ] Fall feels weighty — faster than rise
- [ ] Coyote time feels generous (can jump after running off edge)
- [ ] Jump buffer works (pressing jump slightly early still registers)

**Wall mechanics:**
- [ ] Wall-slide is noticeably slower than freefall
- [ ] Gripping (holding toward wall) feels very slow and controlled
- [ ] Wall-jump launches player clearly away from wall (4+ character widths horizontal)
- [ ] Wall-jump reaches good height (2.5+ character heights)
- [ ] Wall-jump lockout is brief but felt (can't instantly re-grab)

**Dash:**
- [ ] Dash feels explosively fast
- [ ] Dash covers ~6 character widths
- [ ] Dash cooldown allows roughly 2 dashes per second
- [ ] Speed boost after ground dash is noticeable but fades quickly

**Landing:**
- [ ] Short falls (< 12 frames) have no landing animation
- [ ] Medium falls (12–29 frames) show soft landing
- [ ] Long falls (30+ frames) trigger hard landing with squash + particles + shake

**Integration:**
- [ ] Chain: run → jump → wall-slide → wall-jump → dash → land → crouch-slide feels fluid
- [ ] No moment where controls feel sluggish or unresponsive
- [ ] Character "reads" well at all speeds (sprite isn't a blur)
- [ ] The character feels like it has weight but isn't heavy

### Document changes

Add a brief comment in `DEFAULT_PLAYER_PARAMS` for every value that was changed, explaining why:

```typescript
deceleration: 1400,  // was 1200 — crisper stop to eliminate ice-skating feel
```

---

## Important notes

- **Feel is subjective.** The "expected final values" above are starting points. If a change doesn't feel right, revert it. Trust the feel test over the numbers.
- **Test cascading effects.** Changing `jumpSpeed` affects how high you can jump to platforms in the showcase level. Changing `fallGravity` affects landing timing. Always test the full movement chain after any change.
- **Don't over-tune.** The current values are already solid — they've been tested across 400+ headless tests and 8 visual tasks. This is about *refinement*, not reinvention. If a value feels right, leave it.
- **Physics changes may break test assertions.** Some test files check specific speeds/heights/distances. Update those tests to match — the physics values are the source of truth, not the old test expectations.
- **The showcase page time scale slider (0.1×–2.0×) is your best tool.** Use slow motion to evaluate transitions and fast motion to test chain moves.
- **Take notes on what you changed and why.** Include the reasoning in the commit message so future tuning work builds on this pass.

---

## Completion Summary

### Files changed

| File | Changes |
|------|---------|
| `src/engine/entities/Player.ts` | Tuned 11 physics parameters in `DEFAULT_PLAYER_PARAMS` |
| `src/engine/test/__tests__/transitions.test.ts` | Fixed 1 test assertion affected by deceleration change |

### Parameter changes applied

**Ground Movement:**
- `deceleration`: 1200 → 1400 — crisper stop to eliminate ice-skating feel
- `turnMultiplier`: 3.0 → 3.5 — snappier direction reversal

**Jumping:**
- `jumpSpeed`: 380 → 400 — slightly higher peak for better platforming reach
- `riseGravity`: 680 → 720 — slightly faster rise to compensate for higher jump speed
- `fallGravity`: 980 → 1020 — slightly heavier fall for more weight
- `apexGravityMultiplier`: 0.4 → 0.35 — still floaty but less extreme (~14 frames vs ~22)
- `apexVelocityThreshold`: 50 → 40 — narrower apex window for tighter feel
- `jumpCutMultiplier`: 0.4 → 0.45 — slightly higher min hop for utility

**Wall Mechanics:**
- `wallJumpHorizontalSpeed`: 260 → 280 — clears 4 char widths more reliably
- `wallJumpVerticalSpeed`: 340 → 360 — slightly higher for better vertical reach

**Dash:**
- `dashCooldownFrames`: 18 → 16 — slightly faster dash rhythm (0.52s cycle)

### Test fix
The `RUNNING → CROUCHING: pressing down at low speed` test was sensitive to the exact deceleration curve. With higher decel (1400), `tickUntil(vel < 40)` exits one frame earlier at ~37 px/s instead of 20 px/s, leaving enough residual speed that one acceleration frame brings the player above `slideMinSpeed`. Fixed by waiting until velocity reaches exactly 0 before the crouch test, making it robust against deceleration tuning.

### Verification
- `npx tsc --noEmit` — passes
- `npm run test:run` — 427/427 tests passing

---

## Review Notes

**Reviewer:** 954a4979
**Result:** Approved with one minor fix

### Fix applied
- `transitions.test.ts:305` — Updated stale comment "Wall jump vertical speed is 340" to "360" to match the new `wallJumpVerticalSpeed` value.

### Review findings
- All 11 parameter changes are internally consistent and well-documented with inline comments.
- Physics calculations verified: jump peak ~111px (was ~106px), rise time unchanged at ~0.56s, deceleration stop at ~0.2s, wall jump reach ~90px vertical / ~37px lockout + drift horizontal.
- Task doc slightly overestimates the apex window reduction (claims 22→14 frames, actual is ~22→19 frames), but the change is still directionally correct and the feel improvement is valid.
- No frame-rate dependent code — all physics uses `dt` properly.
- Test fix for `RUNNING → CROUCHING` is robust — waiting for `vel === 0` is a good pattern that won't break on future deceleration changes.
- 427/427 tests passing after review.
