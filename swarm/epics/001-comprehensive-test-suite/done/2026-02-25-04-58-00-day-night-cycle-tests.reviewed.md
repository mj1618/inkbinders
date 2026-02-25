# Task: Day/Night Cycle Headless Tests

## What to Build

Create comprehensive headless tests for the day/night cycle system and corruption modifiers using vitest and the `GameTestHarness`.

**File:** `src/engine/test/__tests__/day-night.test.ts` (new)

## Context

The `GameTestHarness` already has `enableDayNightCycle(params?)` which returns a `DayNightCycle` instance and calls `cycle.update(dt)` every tick. Corruption modifiers (`CorruptionModifiers`) are NOT wired into the harness — they must be instantiated and updated manually in tests.

Key imports:
```typescript
import { GameTestHarness } from "@/engine/test/GameTestHarness";
import { DayNightCycle, DEFAULT_DAY_NIGHT_PARAMS } from "@/engine/world/DayNightCycle";
import type { TimeOfDay, DayNightParams } from "@/engine/world/DayNightCycle";
import { CorruptionModifiers, DEFAULT_CORRUPTION_PARAMS } from "@/engine/world/CorruptionModifiers";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/constants";
```

## Test Cases

### describe("DayNightCycle — time progression")

1. **Time advances with running=true**: Create cycle with `running: true`, call `update(1/60)` several times. `time` should increase.

2. **Time does not advance with running=false**: Create cycle with `running: false`, call `update(1.0)`. `time` should remain unchanged.

3. **Time wraps around at 1.0**: Set time near 1.0 (e.g. 0.99), update enough to pass 1.0. Verify `time` wraps to a small positive value (stays in 0-1 range).

4. **Full cycle duration**: With default params (cycleDuration=120, timeScale=1.0), advancing by 120 seconds total should complete approximately one full cycle. `time` should be approximately back to start.

5. **TimeScale affects speed**: With `timeScale: 2.0`, advancing 60 real seconds should cover the same time as 120 seconds at `timeScale: 1.0`.

### describe("DayNightCycle — phase transitions")

6. **skipTo("dawn") → dawn phase**: After `skipTo("dawn")`, `getTimeOfDay()` returns `"dawn"`.

7. **skipTo("day") → day phase**: After `skipTo("day")`, `getTimeOfDay()` returns `"day"`.

8. **skipTo("dusk") → dusk phase**: After `skipTo("dusk")`, `getTimeOfDay()` returns `"dusk"`.

9. **skipTo("night") → night phase**: After `skipTo("night")`, `getTimeOfDay()` returns `"night"`.

10. **Phase sequence: dawn → day → dusk → night → dawn**: Start at dawn. Advance time. Verify phases cycle in order: dawn → day → dusk → night → dawn. Use `setTime()` to jump to known phase boundaries:
    - `setTime(0.25)` → dawn (default dayFraction=0.5)
    - `setTime(0.5)` → day (noon)
    - `setTime(0.75)` → dusk
    - `setTime(0.0)` → night (midnight)

11. **setTime jumps correctly**: `setTime(0.5)` should place the cycle at noon. `getTimeOfDay()` should be `"day"`. `getLightLevel()` should be 1.0.

### describe("DayNightCycle — light and corruption")

12. **Corruption at night > 0**: Skip to night. `getCorruptionIntensity()` should be > 0.

13. **Corruption at day = 0**: Skip to day. `getCorruptionIntensity()` should be 0.

14. **Corruption peaks at midnight**: Set time to 0.0 (midnight). Corruption should be at or near its maximum (close to 1.0).

15. **Light level at day = 1.0**: Skip to day. `getLightLevel()` should be 1.0.

16. **Light level at night = 0.15**: Skip to night. `getLightLevel()` should be approximately 0.15.

17. **Light level transitions during dawn/dusk**: Set time to dawn center. Light level should be between 0.15 and 1.0 (interpolating).

### describe("DayNightCycle — harness integration")

18. **Harness enableDayNightCycle returns cycle**: `const cycle = h.enableDayNightCycle()`. `cycle` should be a `DayNightCycle` instance. `h.dayNight` should equal `cycle`.

19. **Harness getters work**: Enable day/night cycle. `h.timeOfDay` should not be null. `h.corruptionIntensity` should be a number. `h.lightLevel` should be a number.

20. **Harness tick advances cycle**: Enable cycle with `running: true`. Record initial time. `h.tickN(60)`. Time should have advanced.

21. **Harness getWorldState includes day/night**: Enable cycle. `h.getWorldState()` should have non-null `timeOfDay` and correct `lightLevel`/`corruptionIntensity`.

### describe("CorruptionModifiers — activation thresholds")

22. **No modifiers active at zero corruption**: Create `CorruptionModifiers()`. Call `update(dt, 0, 10, CANVAS_WIDTH, CANVAS_HEIGHT)`. All modifiers should have `active: false`.

23. **ink-bleed activates at 0.2**: Update with `corruptionIntensity = 0.25`. `getModifier("ink-bleed")?.active` should be `true`.

24. **surface-flip activates at 0.3**: Update with `corruptionIntensity = 0.35`. `getModifier("surface-flip")?.active` should be `true`. `isSurfaceFlipActive()` should be `true`.

25. **platform-flicker activates at 0.4**: Update with `corruptionIntensity = 0.45`. `getModifier("platform-flicker")?.active` should be `true`.

26. **fog-of-war activates at 0.5**: Update with `corruptionIntensity = 0.55`. `isFogActive()` should be `true`.

27. **gravity-pulse activates at 0.7**: Update with `corruptionIntensity = 0.75`. `getModifier("gravity-pulse")?.active` should be `true`.

28. **All modifiers active at max corruption**: Update with `corruptionIntensity = 1.0`. Every modifier should be `active: true`.

### describe("CorruptionModifiers — effects")

29. **Surface flip cycles**: When surface-flip is active, `getEffectiveSurface("normal")` should return `"icy"`, `getEffectiveSurface("icy")` should return `"bouncy"`, etc. following the cycle: normal→icy→bouncy→sticky→conveyor→normal.

30. **Gravity pulse multiplier**: When gravity-pulse is active and pulse fires (advance timer past `gravityPulseInterval`), `getGravityMultiplier()` should return `gravityPulseMultiplier` (-0.5) during the pulse, and `1.0` outside the pulse.

31. **Fog radius shrinks with corruption**: At corruption 0.6, `getFogRadius()` should be between `fogMinRadius` (120) and `fogMaxRadius` (600). Higher corruption → smaller radius.

32. **Reset clears all state**: Call `reset()`. All modifiers should be inactive. Timers should be zero.

### describe("Hub immunity pattern")

33. **Hub suppresses corruption**: This is a pattern test — the hub immunity is handled by `GameWorld`, not by `DayNightCycle` itself. But we can verify: skip cycle to night, read `corruptionIntensity`. When the calling code passes 0 to `CorruptionModifiers.update()` (simulating hub immunity), no modifiers should activate.

## Specific Values Reference

**DayNightCycle defaults:**
- cycleDuration: 120s
- dayFraction: 0.5
- dawnDuration: 8s, duskDuration: 8s
- timeScale: 1.0
- Initial time: 0.25 (dawn center)

**Time boundaries (default params):**
- nightEnd (dawn start): 0.25 - 0.0333 = ~0.217
- dawn center: 0.25
- day start: 0.25 + 0.0333 = ~0.283
- dusk start: 0.75 - 0.0333 = ~0.717
- dusk center: 0.75
- night start: 0.75 + 0.0333 = ~0.783

**Corruption modifier thresholds:**
- ink-bleed: 0.2
- surface-flip: 0.3
- platform-flicker: 0.4
- fog-of-war: 0.5
- gravity-pulse: 0.7

**Surface flip cycle:** normal→icy→bouncy→sticky→conveyor→normal

**Gravity pulse defaults:**
- interval: 5.0s, duration: 0.5s, multiplier: -0.5

**Fog defaults:**
- minRadius: 120, maxRadius: 600

## Verification

- Run `npm run test:run -- --reporter=verbose day-night` — all tests should pass
- Run `npx tsc --noEmit` — no type errors
- Use `DEFAULT_*_PARAMS` constants for thresholds — never hardcode physics values

## Notes

- Use `running: false` in most tests and advance manually with `cycle.update(dt)` or `cycle.setTime(t)` for deterministic control.
- `CorruptionModifiers` is standalone — instantiate it directly, not through the harness.
- The harness `dt` is `1/60` (FIXED_TIMESTEP). When testing time progression, remember: `tickN(60)` = 1 second of game time.
- Approximate checks (e.g., `toBeCloseTo`) are appropriate for time boundaries and interpolated values.
- Don't test rendering (DayNightRenderer, DayNightAtmosphere) — those are visual-only systems covered by the visual test suite.

---

## Completion Summary

### Files Changed
- **Created:** `src/engine/test/__tests__/day-night.test.ts`

### What Was Built
Comprehensive headless test suite for the day/night cycle and corruption modifiers systems — 35 tests across 7 describe blocks:

1. **DayNightCycle — time progression** (5 tests): running/paused behavior, time wrapping at 1.0, full cycle duration verification, timeScale multiplier
2. **DayNightCycle — phase transitions** (6 tests): skipTo() for all 4 phases, full phase sequence cycling at known time values, setTime precision
3. **DayNightCycle — light and corruption** (6 tests): corruption at night > 0, corruption = 0 during day, corruption peaks at midnight (~1.0), light levels at day/night, dawn/dusk interpolation
4. **DayNightCycle — harness integration** (4 tests): enableDayNightCycle returns correct instance, harness getters (timeOfDay, corruptionIntensity, lightLevel), tick advances cycle, getWorldState includes day/night data
5. **CorruptionModifiers — activation thresholds** (7 tests): zero corruption = no modifiers, each modifier activates at its threshold (ink-bleed 0.2, surface-flip 0.3, platform-flicker 0.4, fog-of-war 0.5, gravity-pulse 0.7), all active at max corruption
6. **CorruptionModifiers — effects** (6 tests): surface flip cycle (normal→icy→bouncy→sticky→conveyor→normal), surface flip inactive passthrough, gravity pulse multiplier during/outside pulse, fog radius shrinks with corruption, reset clears all state
7. **Hub immunity pattern** (1 test): passing 0 corruption to modifiers suppresses all effects

### Verification
- `npm run test:run -- --reporter=verbose day-night` — **35/35 tests pass**
- `npx tsc --noEmit` — **no type errors**

---

## Review Notes (reviewer: fb71d470)

**Overall**: Clean, well-structured test suite. All 35 tests pass, type-checking clean.

**Fix applied:**
- Removed unused `import type { DayNightParams }` (line 7) — imported but never referenced in the test file.

**Verified correct:**
- All API calls match the source implementations (`DayNightCycle`, `CorruptionModifiers`)
- Threshold tests use values above each threshold (not exactly at threshold), correctly exercising `>=` comparison
- Gravity pulse timing test correctly calculates `scaledInterval` matching the source logic
- Fog radius interpolation math verified against source formula
- Surface flip map assertions match `DEFAULT_CORRUPTION_PARAMS.surfaceFlipMap` exactly
- Reset test covers all state fields cleared by `CorruptionModifiers.reset()`
- Harness integration tests match the `GameTestHarness` API
- No frame-rate dependent issues — all tests use fixed `dt` values
- No `any` types, proper TypeScript usage throughout
