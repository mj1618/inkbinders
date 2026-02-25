# Task: Expand Core Movement Headless Tests

## What to Build

Extend the existing `src/engine/test/__tests__/movement.test.ts` file with 9 new test cases that cover acceleration curves, deceleration timing, turn-around behavior, crouch mechanics (entry, slide, ceiling blocking), and max speed enforcement.

## File to Modify

`src/engine/test/__tests__/movement.test.ts`

No new files needed — this expands the existing test file.

## Context

### Existing Tests (7 tests)
The file already tests: grounded detection, run left/right, deceleration to IDLE, max speed at 120 frames, turn facing, and staying grounded on a platform. It uses a `standingOnFloor()` helper that creates a floor at y=300 and places the player at (100, 260).

### Key Values from DEFAULT_PLAYER_PARAMS
- `maxRunSpeed`: 280 px/s
- `acceleration`: 1800 px/s²
- `deceleration`: 1200 px/s²
- `turnMultiplier`: 3.0
- `crouchSpeed`: 100 px/s
- `slideInitialSpeed`: 350 px/s
- `slideFriction`: 600 px/s²
- `slideMinSpeed`: 40 px/s (threshold for CROUCH_SLIDING → CROUCHING)
- `playerWidth`: 24 px
- `playerHeight`: 40 px (standing)
- `crouchHeight`: 24 px

### State Machine States
`IDLE`, `RUNNING`, `CROUCHING`, `CROUCH_SLIDING`, `JUMPING`, `FALLING`, `WALL_SLIDING`, `WALL_JUMPING`, `DASHING`, `HARD_LANDING`

### Crouch Behavior
- From IDLE: pressing Down → CROUCHING (if speed ≤ slideMinSpeed)
- From RUNNING: pressing Down at speed > slideMinSpeed → CROUCH_SLIDING
- CROUCH_SLIDING → CROUCHING when `|vel.x| < slideMinSpeed` (40 px/s)
- Crouch entry: hitbox shrinks from 40px to 24px height, position.y shifts down by 16px (feet stay on ground)
- Stand-up: `Player.canStandUp()` checks if standing hitbox (24×40) at position.y - 16 collides with tilemap. If blocked, stays crouching.

## Test Cases to Add

### 1. Acceleration Curve (Non-linear)
**Rationale:** Player should reach 50% of max speed faster than linearly (acceleration makes early speed gain quick, asymptotic toward max).
```
- Start standing on floor
- Press right, tick N frames
- Record frame when speed >= maxRunSpeed * 0.5 (= 140 px/s) → call it F_half
- Record frame when speed >= maxRunSpeed (280 px/s) → call it F_max
- Assert: F_half < F_max * 0.5 (reaches halfway point faster than half the total time)
```
**Note:** With constant acceleration of 1800 px/s² at 60fps, each frame adds `1800 * (1/60) = 30 px/s`. So ~5 frames to reach 140, ~10 frames to reach 280. The turn multiplier applies during direction changes but not during initial acceleration. This test should still pass because `F_half ≈ 5` and `F_max ≈ 10`, and `5 < 5.0` is false. So actually with constant acceleration, F_half would be exactly half of F_max.

Re-think: The point is that acceleration may NOT be constant — it might use a curve or deceleration factor. Read the Player code to check. If it IS constant, the test should verify F_half ≤ (F_max / 2) (i.e., not slower than linear). If the engine uses a non-linear curve, verify it's actually front-loaded. Either way, measure both milestones and assert the relationship.

### 2. Deceleration Timing
```
- Start standing on floor
- Press right, tick until maxRunSpeed reached
- Release all, tick and count frames until state === 'IDLE'
- Assert: frames < 15
```
**Calculation:** Deceleration is 1200 px/s², from 280 px/s → 0. Each frame removes `1200 * (1/60) = 20 px/s`. So ~14 frames. Should be < 15.

### 3. Turn-Around Snap
```
- Start standing on floor
- Press right, tick 30 frames (get up to speed)
- Release right, press left
- Tick 2 frames
- Assert: facingRight === false
```
**Reasoning:** `turnMultiplier: 3.0` means direction change is 3× faster. After 2 frames of pressing left, the velocity should be heading left and `facingRight` should have flipped.

### 4. Crouch from Idle
```
- Start standing on floor, confirm IDLE state
- Press crouch (Down)
- Tick 1 frame
- Assert: state === 'CROUCHING'
- Assert: player.size.y === crouchHeight (24)
```

### 5. Crouch from Run (Slide Entry)
```
- Start standing on floor
- Press right, tick until speed > slideMinSpeed (40 px/s) — should be 2-3 frames
- Press crouch (Down) while still holding right
- Tick 1 frame
- Assert: state === 'CROUCH_SLIDING'
- Assert: player.size.y === crouchHeight (24)
```

### 6. Crouch-Slide Duration
```
- Start standing on floor
- Press right, tick until near maxRunSpeed
- Press crouch (Down)
- Tick 1 frame — confirm CROUCH_SLIDING
- Release right (let friction decelerate the slide)
- Tick until state !== 'CROUCH_SLIDING', max ~60 frames
- Assert: state === 'CROUCHING' (slide ended, still holding Down)
- Assert: |vel.x| < slideMinSpeed (40)
```

### 7. Crouch-Slide Under Gap
```
- Setup: floor at y=300, low ceiling platform at y=236 (leaves exactly 64px gap: 300 - 236 = 64... but player crouching is 24px tall)
  Actually: floor top = 300, player standing feet at y=260 (pos.y = 260, hitbox from 260 to 300). Crouch pos.y = 276 (shifted down 16), hitbox from 276 to 300, height 24.

  For a gap that blocks standing but allows crouching: place a ceiling so that standing hitbox (pos.y - 16 = 260, height 40, top = 260) would collide, but crouching hitbox (pos.y = 276, height 24, top = 276) does not.

  Ceiling bottom at y=265: blocks standing (260 < 265), allows crouching (276 > 265). Use a platform at x=200, y=233, width=200, height=32 (bottom at 265).

- Start player at x=100 (before the ceiling section), standing on floor
- Press right, build up speed
- Press crouch → enter CROUCH_SLIDING
- Tick until player x > 300 (past the ceiling section)
- Assert: player passed through without getting stuck
```

### 8. Cannot Stand Under Low Ceiling
```
- Same setup as test 7: floor + low ceiling
- Move player under the low ceiling while crouching
- Release crouch (release Down)
- Tick several frames
- Assert: state is still CROUCHING (can't stand up because ceiling blocks)
```

### 9. Max Speed Not Exceeded on Flat Ground
```
- Start standing on floor
- Press right, tick 300 frames
- Assert: every frame, horizontalSpeed <= maxRunSpeed + small epsilon (floating point tolerance)
```

## Implementation Notes

- Import `DEFAULT_PLAYER_PARAMS` from the Player module for threshold values (don't hardcode magic numbers)
- Keep using the `standingOnFloor()` helper for consistency
- For the ceiling tests, create a custom setup function that adds both a floor and a low ceiling platform
- Use `h.pressCrouch()` (which maps to `h.pressDown()`) for crouch input — check which one is available on the harness. The harness has `pressDown()` which maps to `InputAction.Down`. In the Player code, crouch is triggered by the `Down` action being held.
- For test 9 (max speed enforcement), track max speed across all frames rather than just checking the final value
- Use `describe()` blocks to group the new tests logically (e.g., "acceleration", "crouch mechanics")

## Verification

After implementing, run:
```bash
npm run test:run
```

All existing 7 movement tests should still pass, plus the 9 new tests. Total: 16 passing tests in `movement.test.ts`.

Check that no test is flaky by running the full suite twice.

---

## Completion Summary

### Files Changed
- `src/engine/test/__tests__/movement.test.ts` — expanded from 7 tests to 16 tests

### What Was Built
Added 9 new test cases organized into `describe()` blocks:

1. **Acceleration** — `reaches 50% max speed no slower than half the time to max speed` — measures frame milestones for 50% and 100% speed, asserts F_half ≤ F_max / 2
2. **Deceleration** — `stops within 15 frames from max speed` — releases input at max speed, verifies IDLE within 15 frames
3. **Turn-around** — `flips facing within 2 frames of pressing opposite direction` — verifies turnMultiplier makes facing flip responsive
4. **Crouch: entry from IDLE** — `enters CROUCHING from IDLE when pressing down` — presses Down while idle, verifies state and hitbox
5. **Crouch: slide entry from run** — `enters CROUCH_SLIDING from RUNNING when pressing down at speed` — verifies slide when pressing Down above slideMinSpeed
6. **Crouch: slide deceleration** — `crouch slide decelerates to CROUCHING` — verifies friction slows slide to CROUCHING state
7. **Crouch: slide under gap** — `slides under a low ceiling gap` — sets up ceiling that blocks standing but allows crouching, verifies player slides through
8. **Crouch: ceiling blocks stand** — `cannot stand up under a low ceiling` — places player crouching under ceiling, releases Down, verifies canStandUp() keeps player crouching
9. **Max speed** — `never exceeds max run speed on flat ground` — checks every frame for 300 frames that speed ≤ maxRunSpeed + epsilon

### Key Findings During Implementation
- **Crouch input is `InputAction.Down`** (not `InputAction.Crouch`). Use `h.pressDown()` not `h.pressCrouch()` for crouch tests.
- **`standingOnFloor()` helper** may leave the player in FALLING state for 1 frame after `tick()`. New crouch tests use `tickUntil(() => h.state === "IDLE", 10)` to settle.
- **Ceiling geometry**: Floor at y=300, ceiling platform at y=233 (height=32, bottom=265). Standing player top=260 overlaps ceiling bottom. Crouching player top=276 clears it.
- **Acceleration is constant** (1800 px/s²), not curved. F_half equals exactly F_max / 2.

### Verification
- All 16 movement tests pass
- Full suite: 33 tests across 4 files (movement, jumping, dash, wall-mechanics) all pass
- TypeScript type check (`npx tsc --noEmit`) clean
- Ran full suite twice to verify no flakiness

---

## Review Notes (reviewer: 15ee4df3)

**Verdict: PASS — no fixes needed.**

All 16 movement tests pass. Full suite (33 tests across 4 files) green.

Reviewed each test for:
- **Correctness**: All test geometries are mathematically correct. Floor at y=300, ceiling at y=233 (bottom=265) correctly blocks standing (top=260) but allows crouching (top=276).
- **Frame-rate independence**: All tests use the harness's fixed-timestep `tick()` — no timing issues.
- **Type safety**: Uses `DEFAULT_PLAYER_PARAMS` for all threshold values — no magic numbers.
- **State machine coverage**: Tests correctly account for the FALLING→landing→CROUCHING path when `canStandUp()` fails, and for IDLE→FALLING settling on first tick.
- **Input handling**: Uses `pressDown()` (maps to `InputAction.Down`) correctly for crouch. The `releaseRight()` + kept `pressDown()` pattern in the slide deceleration test is correct.

No issues found. Clean implementation.
