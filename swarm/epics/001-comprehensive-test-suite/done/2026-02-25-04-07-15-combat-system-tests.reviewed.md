# Task: Combat System Headless Tests

## Summary

Create `src/engine/test/__tests__/combat.test.ts` — a comprehensive headless test suite for the `CombatSystem` class verifying attack phases, hitbox production, weapon switching, directional aiming, hit detection, and state restrictions.

## Context

The `CombatSystem` (`src/engine/combat/CombatSystem.ts`) is an overlay system that runs in parallel with the player state machine. The player keeps moving/jumping/dashing while attacks happen. Key concepts:

- Two weapons: **quill-spear** (fast mid-range directional, 8-dir aiming) and **ink-snap** (short-range auto-aim burst)
- Attack lifecycle: `idle → windup → active → recovery → idle` (with cooldown timer tracked separately)
- Hitbox produced only during `active` phase
- Hitbox follows player position each frame during active phase
- Multi-hit prevention via `hitEntities: Set<string>` on each `AttackHitbox`
- `canAttack()` checks: not during another attack, not during cooldown, state restrictions (no attack during HARD_LANDING by default, OK during DASHING and WALL_SLIDING)

The harness already has `enableCombat(params?)` which creates a `CombatSystem` and updates it each tick with `combat.update(playerBounds, facingRight)`. The harness also has `pressAttack()` and `h.input.press(InputAction.WeaponSwitch)` for weapon switching.

**Important**: The harness calls `combat.update()` automatically, but it does NOT automatically trigger attacks. The test must manually call `combat.startSpearAttack(direction)` or `combat.startSnapAttack(targetPosition, targetId, facingRight)` on the combat system to initiate attacks, or wire up the attack input → combat start logic manually per test.

## What to Build

**File:** `src/engine/test/__tests__/combat.test.ts` (new)

### Test Cases

#### 1. Attack Phase Lifecycle — Quill-Spear

```
"spear attack cycles through idle → windup → active → recovery → idle"
```
- Setup: grounded player, enable combat
- Call `combat.startSpearAttack("right")`
- Verify `attackPhase === "windup"` immediately
- Tick `spearWindupFrames` → verify transitions to `"active"`
- Tick `spearActiveFrames` → verify transitions to `"recovery"`
- Tick `spearRecoveryFrames` → verify transitions to `"idle"`
- Verify `cooldownTimer > 0` after returning to idle

#### 2. Attack Phase Lifecycle — Ink Snap

```
"snap attack cycles through idle → windup → active → recovery → idle"
```
- Same structure as above but with snap params
- Call `combat.startSnapAttack(null, null, true)` (no target)
- Verify timings match snap-specific params

#### 3. Hitbox Appears During Active Phase Only

```
"hitbox is non-null only during active phase"
```
- Start spear attack
- During windup: verify `combat.activeHitbox === null`
- During active: verify `combat.activeHitbox !== null`
- During recovery: verify `combat.activeHitbox === null`
- During idle (after): verify `combat.activeHitbox === null`

#### 4. Hitbox Absent During Windup and Recovery

```
"no hitbox during windup or recovery"
```
- Start spear attack, check hitbox at each phase transition boundary

#### 5. Hitbox Faces Right When Facing Right

```
"spear hitbox extends to the right of player"
```
- Player at known position, facing right
- Start spear attack "right"
- Advance to active phase
- Verify `hitbox.rect.x >= playerBounds.x + playerBounds.width` (hitbox starts at right edge of player)

#### 6. Hitbox Faces Left When Facing Left

```
"spear hitbox extends to the left of player"
```
- Player facing left
- Start spear attack "left"
- Advance to active phase
- Verify `hitbox.rect.x + hitbox.rect.width <= playerBounds.x` (hitbox ends at left edge of player)

#### 7. Weapon Switch

```
"weapon switch toggles between quill-spear and ink-snap"
```
- Enable combat, verify `combat.currentWeapon === "quill-spear"` (default)
- Toggle: set `combat.currentWeapon = "ink-snap"` (weapon switch is done at test-page level, not by combat system itself)
- Start snap attack, verify it uses snap params

#### 8. Cooldown Prevents Rapid Attack

```
"cannot attack during cooldown"
```
- Start and complete a full spear attack cycle (to idle with cooldown active)
- Verify `combat.cooldownTimer > 0`
- Verify `combat.canAttack("IDLE") === false`
- Tick until cooldown expires
- Verify `combat.canAttack("IDLE") === true`

#### 9. Cannot Attack During HARD_LANDING (default)

```
"cannot attack while in HARD_LANDING state"
```
- Verify `combat.canAttack("HARD_LANDING") === false`

#### 10. Can Attack During DASHING (default)

```
"can attack while dashing"
```
- Verify `combat.canAttack("DASHING") === true`

#### 11. Can Attack During WALL_SLIDING (default)

```
"can attack while wall sliding"
```
- Verify `combat.canAttack("WALL_SLIDING") === true`

#### 12. Directional Attack — Up

```
"upward spear attack has hitbox above player"
```
- Start `combat.startSpearAttack("up")`
- Advance to active phase
- Verify hitbox `rect.y + rect.height <= playerBounds.y` (hitbox is above player)

#### 13. Directional Attack — Down

```
"downward spear attack has hitbox below player"
```
- Start `combat.startSpearAttack("down")`
- Advance to active phase
- Verify hitbox `rect.y >= playerBounds.y + playerBounds.height`

#### 14. Diagonal Attack

```
"diagonal spear attack has hitbox in the correct quadrant"
```
- Start `combat.startSpearAttack("up-right")`
- Advance to active phase
- Verify hitbox is to the right of and above the player center

#### 15. Hitbox Follows Player

```
"hitbox position updates when player moves during active phase"
```
- Start spear attack, advance to active phase
- Record hitbox.rect.x
- Press right, tick a few frames (player moves)
- Verify hitbox.rect.x has changed (moved with player)

#### 16. Snap Auto-Aim Target Finding

```
"findSnapTarget returns nearest target within range"
```
- Create combat system
- Call `combat.findSnapTarget(playerCenter, targets)` with one target in range and one out of range
- Verify it returns the in-range target

#### 17. Snap Auto-Aim No Target

```
"findSnapTarget returns null when no targets in range"
```
- All targets beyond `snapAutoAimRange`
- Returns null

#### 18. Hit Detection

```
"checkHits detects overlap between hitbox and target"
```
- Start spear attack right, advance to active phase
- Create a target rect overlapping the hitbox
- Call `combat.checkHits([target])`
- Verify 1 hit result returned with correct targetId and damage

#### 19. Multi-Hit Prevention

```
"same target is not hit twice by the same attack"
```
- Start attack, advance to active
- Call `checkHits` twice with same target
- First call returns 1 hit, second call returns 0 hits

#### 20. Snap Hitbox Centered on Target

```
"ink-snap hitbox centers on the target position"
```
- Start snap attack with a target position
- Advance to active phase
- Verify hitbox is centered on the target (within snap radius tolerance)

#### 21. Spear Damage Value

```
"spear attack deals spearDamage"
```
- Start spear attack, create overlapping target
- checkHits → verify `result.damage === DEFAULT_COMBAT_PARAMS.spearDamage`

#### 22. Snap Damage Value

```
"snap attack deals snapDamage"
```
- Start snap attack, create overlapping target
- checkHits → verify `result.damage === DEFAULT_COMBAT_PARAMS.snapDamage`

## Implementation Notes

- Import `CombatSystem` directly for unit-level tests, and also use via `h.enableCombat()` for integration-level tests that need the player moving
- Use `DEFAULT_COMBAT_PARAMS` for all frame count thresholds — never hardcode magic numbers
- For phase advancement, use a helper function that ticks exactly N frames to reach each phase
- Player bounds for hitbox computation: use `h.player.getBounds()` or construct manually: `{ x: 100, y: 260, width: 24, height: 40 }` (default player size)
- The `combat.update(playerBounds, facingRight)` call needs valid player bounds — the harness handles this automatically
- For tests that don't need player physics, you can call `combat.update(bounds, facing)` directly without the harness

## Verification

- All tests pass: `npm run test:run`
- No regressions in existing test files (movement, jumping, dash, wall-mechanics, transitions, surfaces)
- Tests use param constants, not magic numbers
- Each test is self-contained with its own setup

## Completion Summary

### Files Changed
- **Created:** `src/engine/test/__tests__/combat.test.ts` (new, ~310 lines)

### What Was Built
All 22 test cases implemented as specified:
1. Spear attack phase lifecycle (idle → windup → active → recovery → idle)
2. Snap attack phase lifecycle
3. Hitbox non-null only during active phase
4. No hitbox during windup or recovery
5. Spear hitbox extends right of player when facing right
6. Spear hitbox extends left of player when facing left
7. Weapon switch between quill-spear and ink-snap
8. Cooldown prevents rapid attacks
9. Cannot attack during HARD_LANDING
10. Can attack during DASHING
11. Can attack during WALL_SLIDING
12. Upward spear hitbox positioned above player
13. Downward spear hitbox positioned below player
14. Diagonal spear hitbox in correct quadrant
15. Hitbox follows player movement (integration test using harness)
16. findSnapTarget returns nearest in-range target
17. findSnapTarget returns null when no targets in range
18. checkHits detects overlapping targets
19. Multi-hit prevention (same target not hit twice per attack)
20. Snap hitbox centers on target position
21. Spear deals spearDamage
22. Snap deals snapDamage

### Test Results
- 140 tests pass (22 new + 118 existing), 0 failures
- `npx tsc --noEmit` passes with no errors
- Tests use `DEFAULT_COMBAT_PARAMS` constants throughout (no magic numbers)
- Mix of unit tests (direct CombatSystem instantiation) and integration tests (via GameTestHarness)
- Helper `tickCombat()` function for advancing combat frames without the harness

---

## Review Notes (fda6d333)

### Assessment
Code reviewed: `src/engine/test/__tests__/combat.test.ts` (~467 lines, 22 test cases)

### Issues Found
None. The test file is well-structured and correct:

- **Phase lifecycle tests** correctly trace through the full windup → active → recovery → idle cycle for both weapons, using param constants for frame counts
- **Hitbox positioning tests** correctly verify directional placement relative to player bounds for all 8 directions (4 cardinal + 4 diagonal)
- **Hit detection tests** properly verify AABB overlap, multi-hit prevention via `hitEntities` Set, and damage values from params
- **Integration test** (hitbox follows player, test 15) correctly uses the full GameTestHarness with `enableCombat()` to verify hitbox tracks player movement
- **Snap auto-aim tests** correctly test both in-range and out-of-range scenarios
- All tests use `DEFAULT_COMBAT_PARAMS` constants — no magic numbers
- Good mix of unit tests (direct `CombatSystem` instantiation) and integration tests (via `GameTestHarness`)

### Verification
- All 22 combat tests pass
- Full suite: 140 tests across 7 files, all passing
- No TypeScript errors
