import { describe, it, expect } from "vitest";
import { GameTestHarness } from "../GameTestHarness";
import {
  DayNightCycle,
  DEFAULT_DAY_NIGHT_PARAMS,
} from "@/engine/world/DayNightCycle";
import {
  CorruptionModifiers,
  DEFAULT_CORRUPTION_PARAMS,
} from "@/engine/world/CorruptionModifiers";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/constants";

describe("DayNightCycle — time progression", () => {
  it("time advances with running=true", () => {
    const cycle = new DayNightCycle({ running: true });
    const initial = cycle.time;
    cycle.update(1 / 60);
    cycle.update(1 / 60);
    cycle.update(1 / 60);
    expect(cycle.time).toBeGreaterThan(initial);
  });

  it("time does not advance with running=false", () => {
    const cycle = new DayNightCycle({ running: false });
    const initial = cycle.time;
    cycle.update(1.0);
    expect(cycle.time).toBe(initial);
  });

  it("time wraps around at 1.0", () => {
    const cycle = new DayNightCycle({ running: false });
    cycle.setTime(0.99);
    cycle.params.running = true;
    // Advance enough to pass 1.0: need > 0.01 * cycleDuration = 1.2s
    cycle.update(2.0);
    expect(cycle.time).toBeGreaterThanOrEqual(0);
    expect(cycle.time).toBeLessThan(1.0);
    // Should have wrapped — time should be a small positive value
    expect(cycle.time).toBeLessThan(0.99);
  });

  it("full cycle duration completes one cycle", () => {
    const cycle = new DayNightCycle({ running: true });
    const initial = cycle.time;
    // Advance by exactly one full cycle duration
    const totalSteps = 1000;
    const dtPerStep = DEFAULT_DAY_NIGHT_PARAMS.cycleDuration / totalSteps;
    for (let i = 0; i < totalSteps; i++) {
      cycle.update(dtPerStep);
    }
    // Should be approximately back to start (modular arithmetic)
    expect(cycle.time).toBeCloseTo(initial, 2);
  });

  it("timeScale affects speed", () => {
    const cycle1x = new DayNightCycle({ running: true, timeScale: 1.0 });
    const cycle2x = new DayNightCycle({ running: true, timeScale: 2.0 });

    const initial = cycle1x.time;

    // Advance cycle1x by 120s, cycle2x by 60s — should end up at the same time
    for (let i = 0; i < 120; i++) {
      cycle1x.update(1.0);
    }
    for (let i = 0; i < 60; i++) {
      cycle2x.update(1.0);
    }

    expect(cycle2x.time).toBeCloseTo(cycle1x.time, 4);
  });
});

describe("DayNightCycle — phase transitions", () => {
  it("skipTo(dawn) → dawn phase", () => {
    const cycle = new DayNightCycle({ running: false });
    cycle.skipTo("dawn");
    expect(cycle.getTimeOfDay()).toBe("dawn");
  });

  it("skipTo(day) → day phase", () => {
    const cycle = new DayNightCycle({ running: false });
    cycle.skipTo("day");
    expect(cycle.getTimeOfDay()).toBe("day");
  });

  it("skipTo(dusk) → dusk phase", () => {
    const cycle = new DayNightCycle({ running: false });
    cycle.skipTo("dusk");
    expect(cycle.getTimeOfDay()).toBe("dusk");
  });

  it("skipTo(night) → night phase", () => {
    const cycle = new DayNightCycle({ running: false });
    cycle.skipTo("night");
    expect(cycle.getTimeOfDay()).toBe("night");
  });

  it("phase sequence cycles correctly at known time values", () => {
    const cycle = new DayNightCycle({ running: false });

    // With default params (dayFraction=0.5):
    // nightEnd (dawn center) = 0.25
    // dawnHalf = 8/120/2 = 0.0333
    // dayStart = 0.25 + 0.0333 = 0.2833
    // dayEnd (dusk center) = 0.75
    // duskEnd (nightStart) = 0.75 + 0.0333 = 0.7833

    // Mid-day
    cycle.setTime(0.5);
    expect(cycle.getTimeOfDay()).toBe("day");

    // Dawn center
    cycle.setTime(0.25);
    expect(cycle.getTimeOfDay()).toBe("dawn");

    // Dusk center
    cycle.setTime(0.75);
    expect(cycle.getTimeOfDay()).toBe("dusk");

    // Midnight
    cycle.setTime(0.0);
    expect(cycle.getTimeOfDay()).toBe("night");

    // Verify the full sequence by stepping through
    cycle.setTime(0.25); // dawn
    expect(cycle.getTimeOfDay()).toBe("dawn");

    cycle.setTime(0.5); // day
    expect(cycle.getTimeOfDay()).toBe("day");

    cycle.setTime(0.75); // dusk
    expect(cycle.getTimeOfDay()).toBe("dusk");

    cycle.setTime(0.9); // night
    expect(cycle.getTimeOfDay()).toBe("night");

    // Back to dawn
    cycle.setTime(0.25);
    expect(cycle.getTimeOfDay()).toBe("dawn");
  });

  it("setTime jumps correctly to noon", () => {
    const cycle = new DayNightCycle({ running: false });
    cycle.setTime(0.5);
    expect(cycle.getTimeOfDay()).toBe("day");
    expect(cycle.getLightLevel()).toBe(1.0);
  });
});

describe("DayNightCycle — light and corruption", () => {
  it("corruption at night > 0", () => {
    const cycle = new DayNightCycle({ running: false });
    cycle.skipTo("night");
    expect(cycle.getCorruptionIntensity()).toBeGreaterThan(0);
  });

  it("corruption at day = 0", () => {
    const cycle = new DayNightCycle({ running: false });
    cycle.skipTo("day");
    expect(cycle.getCorruptionIntensity()).toBe(0);
  });

  it("corruption peaks at midnight", () => {
    const cycle = new DayNightCycle({ running: false });
    cycle.setTime(0.0); // midnight
    const midnightCorruption = cycle.getCorruptionIntensity();
    // Corruption at midnight should be at or near its peak
    // The sine curve peaks at sin(0.5 * PI) = 1.0 at night center
    expect(midnightCorruption).toBeCloseTo(1.0, 1);
  });

  it("light level at day = 1.0", () => {
    const cycle = new DayNightCycle({ running: false });
    cycle.skipTo("day");
    expect(cycle.getLightLevel()).toBe(1.0);
  });

  it("light level at night = 0.15", () => {
    const cycle = new DayNightCycle({ running: false });
    cycle.skipTo("night");
    expect(cycle.getLightLevel()).toBeCloseTo(0.15, 2);
  });

  it("light level transitions during dawn/dusk", () => {
    const cycle = new DayNightCycle({ running: false });
    cycle.skipTo("dawn");
    const dawnLight = cycle.getLightLevel();
    // Dawn should be interpolating between NIGHT_LIGHT (0.15) and DAY_LIGHT (1.0)
    expect(dawnLight).toBeGreaterThan(0.15);
    expect(dawnLight).toBeLessThan(1.0);

    cycle.skipTo("dusk");
    const duskLight = cycle.getLightLevel();
    // Dusk should also be between 0.15 and 1.0
    expect(duskLight).toBeGreaterThan(0.15);
    expect(duskLight).toBeLessThan(1.0);
  });
});

describe("DayNightCycle — harness integration", () => {
  it("enableDayNightCycle returns cycle", () => {
    const h = new GameTestHarness();
    h.addFloor(300);
    const cycle = h.enableDayNightCycle();
    expect(cycle).toBeInstanceOf(DayNightCycle);
    expect(h.dayNight).toBe(cycle);
  });

  it("harness getters work", () => {
    const h = new GameTestHarness();
    h.addFloor(300);
    h.enableDayNightCycle();

    expect(h.timeOfDay).not.toBeNull();
    expect(typeof h.corruptionIntensity).toBe("number");
    expect(typeof h.lightLevel).toBe("number");
  });

  it("harness tick advances cycle", () => {
    const h = new GameTestHarness();
    h.addFloor(300);
    h.setPlayerPosition(100, 268);
    h.enableDayNightCycle({ running: true });

    const initialTime = h.dayNightTime;
    h.tickN(60); // 1 second of game time
    expect(h.dayNightTime).toBeGreaterThan(initialTime);
  });

  it("harness getWorldState includes day/night", () => {
    const h = new GameTestHarness();
    h.addFloor(300);
    h.setPlayerPosition(100, 268);
    h.enableDayNightCycle();

    const state = h.getWorldState();
    expect(state.timeOfDay).not.toBeNull();
    expect(typeof state.lightLevel).toBe("number");
    expect(typeof state.corruptionIntensity).toBe("number");
  });
});

describe("CorruptionModifiers — activation thresholds", () => {
  it("no modifiers active at zero corruption", () => {
    const mods = new CorruptionModifiers();
    mods.update(1 / 60, 0, 10, CANVAS_WIDTH, CANVAS_HEIGHT);
    for (const mod of mods.modifiers) {
      expect(mod.active).toBe(false);
    }
  });

  it("ink-bleed activates at 0.2", () => {
    const mods = new CorruptionModifiers();
    mods.update(1 / 60, 0.25, 10, CANVAS_WIDTH, CANVAS_HEIGHT);
    expect(mods.getModifier("ink-bleed")?.active).toBe(true);
  });

  it("surface-flip activates at 0.3", () => {
    const mods = new CorruptionModifiers();
    mods.update(1 / 60, 0.35, 10, CANVAS_WIDTH, CANVAS_HEIGHT);
    expect(mods.getModifier("surface-flip")?.active).toBe(true);
    expect(mods.isSurfaceFlipActive()).toBe(true);
  });

  it("platform-flicker activates at 0.4", () => {
    const mods = new CorruptionModifiers();
    mods.update(1 / 60, 0.45, 10, CANVAS_WIDTH, CANVAS_HEIGHT);
    expect(mods.getModifier("platform-flicker")?.active).toBe(true);
  });

  it("fog-of-war activates at 0.5", () => {
    const mods = new CorruptionModifiers();
    mods.update(1 / 60, 0.55, 10, CANVAS_WIDTH, CANVAS_HEIGHT);
    expect(mods.isFogActive()).toBe(true);
  });

  it("gravity-pulse activates at 0.7", () => {
    const mods = new CorruptionModifiers();
    mods.update(1 / 60, 0.75, 10, CANVAS_WIDTH, CANVAS_HEIGHT);
    expect(mods.getModifier("gravity-pulse")?.active).toBe(true);
  });

  it("all modifiers active at max corruption", () => {
    const mods = new CorruptionModifiers();
    mods.update(1 / 60, 1.0, 10, CANVAS_WIDTH, CANVAS_HEIGHT);
    for (const mod of mods.modifiers) {
      expect(mod.active).toBe(true);
    }
  });
});

describe("CorruptionModifiers — effects", () => {
  it("surface flip cycles correctly", () => {
    const mods = new CorruptionModifiers();
    // Activate surface-flip (threshold 0.3)
    mods.update(1 / 60, 0.5, 10, CANVAS_WIDTH, CANVAS_HEIGHT);
    expect(mods.isSurfaceFlipActive()).toBe(true);

    // Test the full surface cycle: normal→icy→bouncy→sticky→conveyor→normal
    expect(mods.getEffectiveSurface("normal")).toBe("icy");
    expect(mods.getEffectiveSurface("icy")).toBe("bouncy");
    expect(mods.getEffectiveSurface("bouncy")).toBe("sticky");
    expect(mods.getEffectiveSurface("sticky")).toBe("conveyor");
    expect(mods.getEffectiveSurface("conveyor")).toBe("normal");
  });

  it("surface flip does not affect surfaces when inactive", () => {
    const mods = new CorruptionModifiers();
    // Below threshold — no flip
    mods.update(1 / 60, 0.1, 10, CANVAS_WIDTH, CANVAS_HEIGHT);
    expect(mods.isSurfaceFlipActive()).toBe(false);
    expect(mods.getEffectiveSurface("normal")).toBe("normal");
    expect(mods.getEffectiveSurface("icy")).toBe("icy");
  });

  it("gravity pulse multiplier during active pulse", () => {
    const mods = new CorruptionModifiers();
    // Activate gravity-pulse (threshold 0.7)
    // At corruption 0.8, the scaledInterval = 5.0 / max(0.5, 0.8) = 6.25s
    const corruption = 0.8;

    // Advance time to trigger a pulse
    // scaledInterval = gravityPulseInterval / max(0.5, corruption) = 5.0 / 0.8 = 6.25s
    const scaledInterval =
      DEFAULT_CORRUPTION_PARAMS.gravityPulseInterval /
      Math.max(0.5, corruption);

    // Advance past the interval to trigger a pulse
    const stepsToTrigger = Math.ceil(scaledInterval / (1 / 60)) + 1;
    for (let i = 0; i < stepsToTrigger; i++) {
      mods.update(1 / 60, corruption, 10, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // Now pulse should be active
    expect(mods.gravityPulseActive).toBe(true);
    expect(mods.getGravityMultiplier()).toBe(
      DEFAULT_CORRUPTION_PARAMS.gravityPulseMultiplier,
    );
  });

  it("gravity pulse multiplier = 1.0 when not pulsing", () => {
    const mods = new CorruptionModifiers();
    // Just activate it — timer hasn't elapsed yet
    mods.update(1 / 60, 0.75, 10, CANVAS_WIDTH, CANVAS_HEIGHT);
    expect(mods.gravityPulseActive).toBe(false);
    expect(mods.getGravityMultiplier()).toBe(1.0);
  });

  it("fog radius shrinks with corruption", () => {
    const mods = new CorruptionModifiers();
    // Fog activates at 0.5 threshold
    mods.update(1 / 60, 0.6, 10, CANVAS_WIDTH, CANVAS_HEIGHT);
    const fogAt06 = mods.getFogRadius();
    expect(fogAt06).toBeGreaterThan(DEFAULT_CORRUPTION_PARAMS.fogMinRadius);
    expect(fogAt06).toBeLessThan(DEFAULT_CORRUPTION_PARAMS.fogMaxRadius);

    // Higher corruption → smaller radius
    mods.update(1 / 60, 0.9, 10, CANVAS_WIDTH, CANVAS_HEIGHT);
    const fogAt09 = mods.getFogRadius();
    expect(fogAt09).toBeLessThan(fogAt06);

    // At max corruption, fog should be at or near fogMinRadius
    mods.update(1 / 60, 1.0, 10, CANVAS_WIDTH, CANVAS_HEIGHT);
    const fogAtMax = mods.getFogRadius();
    expect(fogAtMax).toBeCloseTo(DEFAULT_CORRUPTION_PARAMS.fogMinRadius, 0);
  });

  it("reset clears all state", () => {
    const mods = new CorruptionModifiers();
    // Activate everything
    mods.update(1 / 60, 1.0, 10, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Verify something is active before reset
    expect(mods.modifiers.some((m) => m.active)).toBe(true);

    mods.reset();

    // All modifiers should be inactive
    for (const mod of mods.modifiers) {
      expect(mod.active).toBe(false);
    }
    expect(mods.gravityPulseTimer).toBe(0);
    expect(mods.gravityPulseActive).toBe(false);
    expect(mods.gravityPulseCurrent).toBe(0);
    expect(mods.fogRadius).toBe(DEFAULT_CORRUPTION_PARAMS.fogMaxRadius);
    expect(mods.inkBleedAccumulator).toBe(0);
    expect(mods.pendingInkBleeds).toHaveLength(0);
    expect(mods.platformFlickers.size).toBe(0);
  });
});

describe("Hub immunity pattern", () => {
  it("hub suppresses corruption by passing 0 to modifiers", () => {
    const cycle = new DayNightCycle({ running: false });
    cycle.skipTo("night");

    // Cycle reports corruption at night
    const corruption = cycle.getCorruptionIntensity();
    expect(corruption).toBeGreaterThan(0);

    const mods = new CorruptionModifiers();
    // Hub immunity: pass 0 instead of the actual corruption
    mods.update(1 / 60, 0, 10, CANVAS_WIDTH, CANVAS_HEIGHT);

    // No modifiers should activate despite it being night
    for (const mod of mods.modifiers) {
      expect(mod.active).toBe(false);
    }
  });
});
