# Task: Health System Headless Tests

## What to Build

Create a comprehensive headless test suite for the `PlayerHealth` system (`src/engine/combat/PlayerHealth.ts`). This covers damage, invincibility frames, knockback, death, and boundary conditions.

## File to Create

`src/engine/test/__tests__/health.test.ts`

## Implementation Details

### Setup Pattern

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { GameTestHarness } from '../../test/GameTestHarness';
import { PlayerHealth } from '../../combat/PlayerHealth';
import { DEFAULT_PLAYER_HEALTH_PARAMS } from '../../combat/PlayerHealth';

// Each test creates a harness with a floor platform and enables health:
const h = new GameTestHarness({
  platforms: [{ x: 0, y: 300, width: 960, height: 32 }],
});
h.setPlayerPosition(100, 260);
h.tickUntil(() => h.grounded, 60);
const health = h.enableHealth();
```

### Test Cases to Implement

#### Basic Health

1. **Initial health equals maxHealth**: After `enableHealth()`, `health.health` should equal `health.maxHealth` (default 5).

2. **Take damage reduces health**: Call `health.takeDamage(1, { x: 1, y: 0 }, 'test')`. Verify `health.health === maxHealth - 1`.

3. **Take damage returns true on success**: `takeDamage()` should return `true` when damage is applied.

4. **Multiple damage sources tracked**: After taking damage from `'spikes'`, verify `health.lastDamageSource === 'spikes'`. Then take damage from `'enemy'` (after i-frames expire), verify source updates.

5. **Total damage accumulates**: Take damage twice (with i-frame expiry between). Verify `health.totalDamageTaken` equals the sum.

#### Invincibility Frames

6. **Invincibility starts after damage**: After `takeDamage()`, `health.invincibilityTimer` should equal `DEFAULT_PLAYER_HEALTH_PARAMS.invincibilityFrames` (60).

7. **Damage blocked during invincibility**: Take damage, then immediately try `takeDamage()` again — it should return `false` and health should not change.

8. **Invincibility timer counts down**: After damage, call `health.update()` (via `h.tick()`) N times. Verify `invincibilityTimer` decreases by 1 per tick.

9. **Invincibility expires after full duration**: Tick exactly `invincibilityFrames` times. Verify `invincibilityTimer === 0`. Then `takeDamage()` should succeed again (return `true`).

10. **Can take damage again after expiry**: Take damage, tick through full invincibility duration, then take damage again. Verify health dropped by 2 total.

#### Death

11. **Death at zero health**: Take damage equal to remaining health (e.g., `takeDamage(5, ...)` with maxHealth=5). Verify `health.health === 0`.

12. **Cannot go negative**: Take damage exceeding remaining health. Verify `health.health === 0`, never negative.

13. **No damage after death**: After health reaches 0, further `takeDamage()` calls return `false` and health remains 0.

#### Knockback

14. **Knockback velocity exists after damage**: After `takeDamage(1, { x: 1, y: 0 }, 'test')`, `health.getKnockbackVelocity()` should return a non-null Vec2 with positive x component.

15. **Knockback decays over time**: Take damage, tick several frames, verify knockback magnitude decreases.

16. **Knockback ends after duration**: Tick `knockbackDuration` frames. Verify `health.getKnockbackVelocity()` returns null (or zero magnitude).

17. **Knockback direction matches input**: Take damage with direction `{ x: -1, y: 0 }`. Verify knockback velocity has negative x.

#### Custom Parameters

18. **Custom maxHealth**: `enableHealth({ maxHealth: 3 })`. Verify `health.health === 3` and `health.maxHealth === 3`.

19. **Custom invincibility frames**: `enableHealth({ invincibilityFrames: 30 })`. Take damage, verify timer starts at 30, expires after 30 ticks.

20. **Health boundary — damage equals remaining**: With `maxHealth: 3`, take 1 damage, wait out i-frames, take 2 damage. Verify `health.health === 0` exactly.

#### Dash I-Frames Integration

21. **canTakeDamage returns false while dashing**: Enable health with `dashIFrames: true`. Put the player in DASHING state. Verify `health.canTakeDamage('DASHING', true) === false`.

22. **canTakeDamage returns true when not dashing**: Verify `health.canTakeDamage('RUNNING', false) === true` (assuming not invincible).

### Key Values (from DEFAULT_PLAYER_HEALTH_PARAMS)

- `maxHealth`: 5
- `invincibilityFrames`: 60
- `knockbackSpeed`: 200
- `knockbackDuration`: 10
- `dashIFrames`: true

Use these defaults for threshold comparisons — do NOT hardcode magic numbers. Import and reference the params constants.

## Verification

Run: `npm run test:run -- --testPathPattern=health`

**Pass criteria:**
- All tests pass
- No existing tests broken (`npm run test:run` exits 0)
- Tests use `DEFAULT_PLAYER_HEALTH_PARAMS` for thresholds, not hardcoded values
- Each test is independent (uses fresh harness in `beforeEach` or inline setup)

---

## Completion Summary

### Files Changed
- **Created:** `src/engine/test/__tests__/health.test.ts` — 22 test cases

### What Was Built
Comprehensive headless test suite for the `PlayerHealth` system covering:
- **Basic Health (5 tests):** initial health, damage reduction, return value, damage source tracking, totalDamageTaken accumulation
- **Invincibility Frames (5 tests):** timer initialization, damage blocking, countdown, expiry, damage re-enable after expiry
- **Death (3 tests):** zero health, cannot go negative, no damage after death
- **Knockback (4 tests):** velocity exists after damage, decay over time, ends after duration, direction matches input
- **Custom Parameters (3 tests):** custom maxHealth, custom invincibilityFrames, boundary damage equals remaining
- **Dash I-Frames Integration (2 tests):** canTakeDamage false while dashing, true when not dashing

All tests use `DEFAULT_PLAYER_HEALTH_PARAMS` constants for thresholds (no magic numbers). Each test creates a fresh harness via the `setup()` helper.

### Verification
- `npx vitest run health` — 22/22 tests pass
- `npx vitest run` — 162/162 tests pass across all 8 test files (no regressions)
- `npx tsc --noEmit` — clean, no type errors

---

## Review Notes (be313dfa)

**Fix applied:**
- Removed unused `PlayerHealth` import from `health.test.ts` (line 3). Only `DEFAULT_PLAYER_HEALTH_PARAMS` is used directly; the `PlayerHealth` type is returned by the harness's `enableHealth()`.

**Observations (no action needed):**
- `totalDamageTaken` in `PlayerHealth.takeDamage()` adds the raw requested damage, not the clamped amount. E.g., if health=3 and damage=7, totalDamageTaken increases by 7 even though only 3 HP was lost. The tests don't exercise this edge case (they use damage amounts within remaining health), but the underlying engine behavior may be worth revisiting later.
- All 22 tests are well-structured: each uses a fresh harness via the `setup()` helper, references `DEFAULT_PLAYER_HEALTH_PARAMS` for thresholds, and covers the full specification.
- Test numbering in `it()` descriptions matches the task spec 1:1.

**Verdict:** Approved with one minor fix (unused import).
