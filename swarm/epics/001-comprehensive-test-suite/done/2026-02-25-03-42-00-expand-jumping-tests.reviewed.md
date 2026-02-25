# Task: Expand Jumping Headless Tests

## What to Build

Extend the existing `src/engine/test/__tests__/jumping.test.ts` file with 9 new test cases that cover jump height measurement, tap vs held height ratio, apex float mechanics, air control, double-jump prevention, landing states (soft vs hard), hard landing recovery, and jumping from a run.

## File to Modify

`src/engine/test/__tests__/jumping.test.ts`

No new files needed — this expands the existing test file.

## Context

### Existing Tests (7 tests)
The file already tests: basic jump on ground, rise-then-land arc, held vs tap jump height comparison, FALLING transition after apex, coyote time, coyote expiry, and jump buffering. It uses a `standingOnFloor()` helper that creates a floor at y=300 and positions the player at `(100, 300 - playerHeight)`.

### Key Values from DEFAULT_PLAYER_PARAMS
- `jumpSpeed`: 380 px/s (initial upward velocity)
- `riseGravity`: 680 px/s² (gravity while ascending)
- `fallGravity`: 980 px/s² (gravity while descending)
- `apexGravityMultiplier`: 0.4 (gravity reduction near apex)
- `apexVelocityThreshold`: 50 px/s (velocity below which apex float activates)
- `jumpCutMultiplier`: 0.4 (velocity multiplier on early jump release)
- `airAcceleration`: 1400 px/s²
- `airDeceleration`: 600 px/s²
- `maxRunSpeed`: 280 px/s (air horizontal speed cap)
- `softLandThresholdFrames`: 12 (frames of falling before "soft" landing effects)
- `hardLandThresholdFrames`: 30 (frames of falling before HARD_LANDING state)
- `hardLandRecoveryFrames`: 8 (frames locked in HARD_LANDING before recovery)
- `playerHeight`: 40 px
- `coyoteFrames`: 7
- `jumpBufferFrames`: 5

### Jump Mechanics (from Player.ts)
- **JUMPING enter**: Sets `velocity.y = -jumpSpeed`, `jumpHeld = true`, `coyoteTimer = coyoteFrames + 1`, `canCoyoteJump = false`
- **JUMPING update**: Uses `riseGravity` (680). When `|velocity.y| < apexVelocityThreshold` (50), gravity multiplied by `apexGravityMultiplier` (0.4) → apex float effect. If jump released while ascending, `velocity.y *= jumpCutMultiplier` (0.4) → jump cut
- **JUMPING → FALLING**: When `velocity.y >= 0`
- **FALLING update**: Uses `fallGravity` (980). Tracks `fallDurationFrames` each frame. Apex float also applies if `|velocity.y| < threshold`
- **Landing from FALLING**:
  - `fallDurationFrames < softLandThresholdFrames` (12) → normal land → IDLE or RUNNING
  - `12 ≤ fallDurationFrames < hardLandThresholdFrames` (30) → soft land (visual effects only) → IDLE or RUNNING
  - `fallDurationFrames >= hardLandThresholdFrames` (30) → HARD_LANDING
- **HARD_LANDING**: Zeroes velocity.x, locks for `hardLandRecoveryFrames` (8), then → IDLE or RUNNING. Can be canceled by dash or buffered jump
- **Air control**: While jumping/falling, horizontal acceleration = `airAcceleration` (1400), decel = `airDeceleration` (600), clamped to `maxRunSpeed`

## Test Cases to Add

### 1. Jump Height Measurement (Held Jump)
```
- Start standing on floor, record startY
- Press jump, HOLD it (don't release)
- Track minY (highest point = lowest Y value) across 120 frames
- Assert: (startY - minY) >= 80px (sanity: held jump gets meaningful height)
```
**Calculation:** With jumpSpeed=380 and riseGravity=680 (reduced to ~272 near apex via apex float):
- Without apex float: height ≈ v²/(2g) = 380²/(2×680) ≈ 106px
- With apex float adding extra hang time: height should be somewhat larger
- 80px is a conservative lower bound that should always pass

### 2. Tap vs Held Jump Height Ratio
```
- Tap jump: press jump, tick 1 frame, release jump, track minY until grounded
- Held jump: press and hold jump, track minY until grounded
- Assert: (startY - heldMinY) >= 1.3 × (startY - tapMinY)
```
**Reasoning:** Jump cut multiplier is 0.4, which dramatically reduces velocity on release. The held jump should be significantly taller. 1.3× is a conservative ratio — the actual ratio will be closer to 2×.

### 3. Apex Float Verification
```
- Start standing on floor
- Press and hold jump
- Tick until |velocity.y| < apexVelocityThreshold (entering apex zone)
- Record how many consecutive frames velocity stays within [-apexVelocityThreshold, +apexVelocityThreshold]
- Assert: apexFrames >= 3 (apex float should create noticeable hang time)
```
**Reasoning:** Without apex float (multiplier=1.0), the velocity would cross through the threshold zone quickly. With multiplier=0.4, gravity is reduced to 272 px/s² near apex, so velocity changes ~4.5 px/s per frame instead of ~11.3, meaning the threshold zone of ±50 spans more frames.

**Also verify:** `player.isInApexFloat` is `true` during these frames (the Player tracks this flag).

### 4. Air Control (Horizontal Movement While Airborne)
```
- Start standing on floor (no horizontal velocity)
- Press jump (no horizontal input initially)
- Tick 3 frames to get airborne
- Press right (start air control)
- Tick 15 frames
- Assert: velocity.x > 0 (player is moving right)
- Assert: velocity.x > 50 (meaningful horizontal speed gained)
```
**Calculation:** airAcceleration=1400, each frame adds 1400/60 ≈ 23.3 px/s. After 15 frames: ~350 px/s, clamped to maxRunSpeed=280. Should definitely be > 50.

### 5. No Double Jump
```
- Start standing on floor
- Press jump, tick 1 frame (enter JUMPING)
- Release jump
- Tick 15 frames (well past coyote window which is already disabled from JUMPING)
- Assert: state is JUMPING or FALLING (airborne)
- Press jump again
- Tick 1 frame
- Assert: state is NOT JUMPING (should still be FALLING; no double jump)
- Assert: velocity.y has not changed significantly (no new upward impulse)
```
**Note:** The player enters JUMPING with `canCoyoteJump = false` and `coyoteTimer = coyoteFrames + 1`. So no coyote jump possible. And there's no double-jump mechanic. The second jump press should do nothing.

### 6. Landing State After Short Fall
```
- Start standing on floor
- Press jump, tick 1 frame, release jump
- Wait until grounded (tap jump = short arc, < 30 fall frames)
- Assert: state is IDLE or RUNNING (NOT HARD_LANDING)
```
**Reasoning:** A normal tap jump rise+fall is much shorter than hardLandThresholdFrames (30 falling frames). The player should land normally.

### 7. Hard Landing After Long Fall
```
- Create floor at y=400 (lower)
- Place player at y=50 (high up, 350px above floor)
- Let player fall naturally (no jump, just drop)
- Wait until grounded
- Assert: state === 'HARD_LANDING'
```
**Calculation:** Fall distance is 350px. With fallGravity=980, time to fall 350px ≈ sqrt(2×350/980) ≈ 0.845s ≈ 51 frames. At 30 frame threshold, this should easily trigger hard landing.

### 8. Hard Landing Recovery
```
- Same setup as test 7 (long fall → HARD_LANDING)
- Assert: state === 'HARD_LANDING'
- Assert: velocity.x === 0 (horizontal velocity zeroed on entry)
- Record the frame when HARD_LANDING starts
- Tick until state changes from HARD_LANDING (max 20 frames)
- Assert: elapsed frames approximately equals hardLandRecoveryFrames (8) ± 2
- Assert: state is IDLE or RUNNING (recovered)
```

### 9. Jump From Running Preserves Horizontal Momentum
```
- Start standing on floor
- Press right, tick 30 frames (build up to near max speed)
- Record horizontal speed before jump
- Press jump, tick 1 frame
- Assert: state === 'JUMPING'
- Assert: velocity.x is approximately equal to pre-jump horizontal speed (momentum preserved)
- Tick 10 more frames (still holding right)
- Assert: velocity.x is still positive and near maxRunSpeed (air control maintains speed)
```
**Reasoning:** Jumping does not zero horizontal velocity. The player carries their ground speed into the air. Air control (airAcceleration) allows maintaining or even gaining speed.

## Implementation Notes

- Import `DEFAULT_PLAYER_PARAMS` from the Player module for all threshold values (no magic numbers)
- Reuse the existing `standingOnFloor()` helper for tests that start grounded
- For hard landing tests, create a custom setup with a higher drop: floor at y=400, player at y=50
- Use `describe()` sub-blocks to group related tests (e.g., "jump height", "apex float", "landing types", "air control")
- For tracking minY (highest point), loop through frames and track: `if (h.pos.y < minY) minY = h.pos.y`
- The apex float test should check `h.player.isInApexFloat` flag directly
- For the "no double jump" test, record `vel.y` before the second jump press and compare after — should be unchanged (except for gravity)
- For hard landing, the player needs to fall freely (no jump). Just place them in the air above a floor and let gravity do the work. They'll enter FALLING from the first tick.
- Hard landing recovery: don't forget the player could dash-cancel or buffer-jump out of HARD_LANDING. For the clean test, don't press any buttons during recovery.

## Verification

After implementing, run:
```bash
npm run test:run
```

All existing 7 jumping tests should still pass, plus the 9 new tests. Total: 16 passing tests in `jumping.test.ts`.

Full suite should remain green (33+ tests across all files).

Run twice to verify no flakiness. Also run `npx tsc --noEmit` to verify type safety.

---

## Implementation Summary

### File Modified
- `src/engine/test/__tests__/jumping.test.ts`

### What Was Built
Added 10 new test cases (task called for 9, but the apex float tests were split into 2) organized into 5 `describe` sub-blocks:

1. **Jump height** (2 tests):
   - `held jump reaches at least 80px of height` — tracks minY across 120 frames
   - `held jump is at least 1.3x higher than tap jump` — compares tap vs held jump heights

2. **Apex float** (2 tests):
   - `reduces gravity near apex for multiple frames` — counts consecutive frames with velocity within `apexVelocityThreshold`, verifies ≥3
   - `sets isInApexFloat flag during apex` — checks `player.isInApexFloat` is true during apex zone

3. **Air control** (1 test):
   - `gains horizontal speed from air input while airborne` — jumps straight up, then presses right, verifies vel.x > 50

4. **Double jump prevention** (1 test):
   - `does not allow a second jump while airborne` — jumps, waits for FALLING state, attempts second jump, verifies it's ignored

5. **Landing types** (3 tests):
   - `lands normally after a short fall (no hard landing)` — tap jump → IDLE/RUNNING (not HARD_LANDING)
   - `enters HARD_LANDING after a long fall` — 350px drop → HARD_LANDING state
   - `recovers from HARD_LANDING after recovery frames` — verifies vel.x zeroed, recovery within ±2 frames of `hardLandRecoveryFrames`

6. **Momentum preservation** (1 test):
   - `preserves horizontal speed when jumping from a run` — builds running speed, jumps, verifies vel.x preserved

### Key Implementation Insights
- **Frame timing**: `grounded` is set by collision resolution AFTER the state machine runs. Tests that check landing state need to tick one extra frame after `tickUntil(() => h.grounded)` for the state machine to process the landing.
- **Apex float flag timing**: `isInApexFloat` is set using pre-gravity velocity during state machine update, but post-tick velocity (what tests see) reflects gravity applied afterwards. Need to tick one more frame after velocity enters the threshold range so the flag catches up.
- **Jump cut + apex float**: With `jumpCutMultiplier=0.4` and `apexGravityMultiplier=0.4`, a tap jump stays in JUMPING state for ~22 frames (not the 13 expected without apex float). Tests need `tickUntil(() => h.state === "FALLING")` rather than a fixed frame count.

### Verification
- All 43 tests pass (17 jumping + 16 movement + 6 dash + 4 wall mechanics)
- Ran twice with identical results (no flakiness)
- `npx tsc --noEmit` passes cleanly

---

## Review Notes (reviewer: 30a6ea92)

### Verdict: PASS — no fixes needed

All 10 new tests reviewed against `Player.ts` state machine logic. Findings:

1. **Test correctness**: All assertions match the engine's actual behavior. Conservative thresholds (80px, 1.3x ratio, ≥3 apex frames) leave appropriate margin.

2. **Frame timing**: The `tickUntil(() => h.grounded)` + extra `h.tick()` pattern for landing state detection is correctly applied in tests 7, 8, and 9. This accounts for the one-frame delay between collision resolution setting `grounded=true` and the state machine processing the landing.

3. **No frame-rate dependencies**: All tests use `h.tick()` (fixed timestep via `FIXED_TIMESTEP`). No wall-clock timers or real-time dependencies.

4. **No magic numbers**: All threshold comparisons use `DEFAULT_PLAYER_PARAMS` constants.

5. **Apex float flag test**: Correctly handles the timing subtlety — `isInApexFloat` is set at the start of the state update using pre-gravity velocity, so the extra tick after `tickUntil` is needed.

6. **Double jump test**: Properly accounts for the fact that entering FALLING from JUMPING sets `canCoyoteJump = false`, and adds extra frames past the coyote window as a belt-and-suspenders measure.

7. **Hard landing recovery**: Tolerance of ±2 frames is appropriate given the enter/exit timing of the recovery timer countdown.

8. **TypeScript**: Clean compile with `--noEmit`. No `any` types used.

9. **All 43 tests pass** across the full suite (verified during review run).
