// Day/Night Cycle — Core time management, time-of-day computation, cycle advancement

import {
  type DayNightAtmosphere,
  DAY_COLORS,
  NIGHT_COLORS,
  DAWN_COLORS,
  DUSK_COLORS,
  interpolateColors,
} from "./DayNightAtmosphere";

export type TimeOfDay = "dawn" | "day" | "dusk" | "night";

export interface DayNightParams {
  /** Total cycle duration in seconds (real time for one full day+night) */
  cycleDuration: number;
  /** Fraction of cycle spent in day (0-1) */
  dayFraction: number;
  /** Duration of dawn transition in seconds */
  dawnDuration: number;
  /** Duration of dusk transition in seconds */
  duskDuration: number;
  /** Time speed multiplier (1.0 = normal, 2.0 = double speed) */
  timeScale: number;
  /** Whether the cycle auto-advances or is paused */
  running: boolean;
}

export const DEFAULT_DAY_NIGHT_PARAMS: DayNightParams = {
  cycleDuration: 120, // 2 minutes for a full day+night
  dayFraction: 0.5, // 50% day, 50% night
  dawnDuration: 8, // 8 seconds of dawn transition
  duskDuration: 8, // 8 seconds of dusk transition
  timeScale: 1.0,
  running: true,
};

/**
 * Time model:
 *
 * Normalized time `t` from 0.0 to 1.0:
 * - 0.0  = midnight (deepest night)
 * - ~0.25 = dawn center
 * - 0.5  = noon (brightest day)
 * - ~0.75 = dusk center
 * - 1.0  = midnight again (wraps)
 *
 * Phase boundaries (using dayFraction=0.5, dawn/dusk 8s out of 120s ≈ 0.067):
 *   nightEnd = (1-dayFraction)/2 = 0.25
 *   dayStart = nightEnd (dawn is a transition *into* day)
 *   dayEnd = nightEnd + dayFraction = 0.75
 *   nightStart = dayEnd (dusk is a transition *into* night)
 *
 * Dawn transition: centered around nightEnd, width = dawnDuration/cycleDuration
 * Dusk transition: centered around dayEnd, width = duskDuration/cycleDuration
 */
export class DayNightCycle {
  params: DayNightParams;

  /** Normalized time (0.0 to 1.0, wraps) */
  time: number = 0.25;
  /** Current time of day */
  timeOfDay: TimeOfDay = "dawn";
  /** Transition progress for dawn/dusk (0.0 = start of transition, 1.0 = end) */
  transitionProgress: number = 0;

  /** Corruption intensity (0.0 during day, ramps to 1.0 at deepest night) */
  corruptionIntensity: number = 0;

  /** Light level (0.0 = pitch dark, 1.0 = bright day) */
  lightLevel: number = 0.5;

  /** Current atmosphere (interpolated each frame) */
  private atmosphere: DayNightAtmosphere;

  /** Accumulated cycle time in seconds */
  cycleElapsed: number = 0;

  constructor(params?: Partial<DayNightParams>) {
    this.params = { ...DEFAULT_DAY_NIGHT_PARAMS, ...params };
    this.cycleElapsed = this.time * this.params.cycleDuration;
    this.atmosphere = this.computeAtmosphere();
    this.updateDerivedState();
  }

  /**
   * Advance time by dt seconds (real time x timeScale).
   */
  update(dt: number): void {
    if (!this.params.running) return;

    const advance = (dt * this.params.timeScale) / this.params.cycleDuration;
    this.time = (this.time + advance) % 1.0;
    if (this.time < 0) this.time += 1.0;

    this.cycleElapsed =
      (this.cycleElapsed + dt * this.params.timeScale) %
      this.params.cycleDuration;

    this.updateDerivedState();
  }

  private updateDerivedState(): void {
    this.timeOfDay = this.getTimeOfDay();
    this.lightLevel = this.getLightLevel();
    this.corruptionIntensity = this.getCorruptionIntensity();
    this.atmosphere = this.computeAtmosphere();
  }

  /**
   * Get the current TimeOfDay based on normalized time.
   */
  getTimeOfDay(): TimeOfDay {
    const t = this.time;
    const nightEnd = (1 - this.params.dayFraction) / 2;
    const dayEnd = nightEnd + this.params.dayFraction;
    const dawnHalf =
      this.params.dawnDuration / this.params.cycleDuration / 2;
    const duskHalf =
      this.params.duskDuration / this.params.cycleDuration / 2;

    // Dawn: transition zone centered at nightEnd
    if (t >= nightEnd - dawnHalf && t < nightEnd + dawnHalf) {
      return "dawn";
    }
    // Day: from after dawn to before dusk
    if (t >= nightEnd + dawnHalf && t < dayEnd - duskHalf) {
      return "day";
    }
    // Dusk: transition zone centered at dayEnd
    if (t >= dayEnd - duskHalf && t < dayEnd + duskHalf) {
      return "dusk";
    }
    // Night: everything else
    return "night";
  }

  /**
   * Get light level (0-1) based on current time.
   * Day = 1.0, Night = 0.15, Dawn/Dusk = interpolated.
   */
  getLightLevel(): number {
    const DAY_LIGHT = 1.0;
    const NIGHT_LIGHT = 0.15;

    const t = this.time;
    const nightEnd = (1 - this.params.dayFraction) / 2;
    const dayEnd = nightEnd + this.params.dayFraction;
    const dawnHalf =
      this.params.dawnDuration / this.params.cycleDuration / 2;
    const duskHalf =
      this.params.duskDuration / this.params.cycleDuration / 2;

    const tod = this.getTimeOfDay();

    if (tod === "day") return DAY_LIGHT;
    if (tod === "night") return NIGHT_LIGHT;

    if (tod === "dawn") {
      const dawnStart = nightEnd - dawnHalf;
      const dawnEnd = nightEnd + dawnHalf;
      const progress = (t - dawnStart) / (dawnEnd - dawnStart);
      return NIGHT_LIGHT + (DAY_LIGHT - NIGHT_LIGHT) * progress;
    }

    // Dusk
    const duskStart = dayEnd - duskHalf;
    const duskEnd = dayEnd + duskHalf;
    const progress = (t - duskStart) / (duskEnd - duskStart);
    return DAY_LIGHT + (NIGHT_LIGHT - DAY_LIGHT) * progress;
  }

  /**
   * Get corruption intensity (0-1).
   * Day = 0, Night ramps from 0 to 1 based on how deep into night.
   * Dawn = fading from some corruption to 0.
   */
  getCorruptionIntensity(): number {
    const t = this.time;
    const nightEnd = (1 - this.params.dayFraction) / 2;
    const dayEnd = nightEnd + this.params.dayFraction;
    const dawnHalf =
      this.params.dawnDuration / this.params.cycleDuration / 2;
    const duskHalf =
      this.params.duskDuration / this.params.cycleDuration / 2;

    const tod = this.getTimeOfDay();

    if (tod === "day") return 0;

    if (tod === "dawn") {
      // Corruption fading out during dawn
      const dawnStart = nightEnd - dawnHalf;
      const dawnEnd = nightEnd + dawnHalf;
      const progress = (t - dawnStart) / (dawnEnd - dawnStart);
      return Math.max(0, 1.0 - progress) * 0.5; // Fading from 0.5 to 0
    }

    if (tod === "dusk") {
      // Corruption starting to build during dusk
      const duskStart = dayEnd - duskHalf;
      const duskEnd = dayEnd + duskHalf;
      const progress = (t - duskStart) / (duskEnd - duskStart);
      return progress * 0.3; // Building from 0 to 0.3
    }

    // Night: corruption ramps based on distance from midnight (t=0 or t=1)
    // Midnight = deepest corruption (1.0)
    // Edges of night = lower corruption
    const nightStart = dayEnd + duskHalf;
    const nightEndTime = nightEnd - dawnHalf;

    // Normalize night position: how far through the night are we?
    // Night spans from nightStart to 1.0 and from 0.0 to nightEndTime
    const totalNight = (1.0 - nightStart) + nightEndTime;

    let nightProgress: number;
    if (t >= nightStart) {
      nightProgress = (t - nightStart) / totalNight;
    } else {
      nightProgress = (1.0 - nightStart + t) / totalNight;
    }

    // Corruption peaks at midnight (center of night) — use sine curve
    return Math.sin(nightProgress * Math.PI);
  }

  /**
   * Get interpolated atmosphere for the current time.
   */
  getAtmosphere(): DayNightAtmosphere {
    return this.atmosphere;
  }

  private computeAtmosphere(): DayNightAtmosphere {
    const t = this.time;
    const nightEnd = (1 - this.params.dayFraction) / 2;
    const dayEnd = nightEnd + this.params.dayFraction;
    const dawnHalf =
      this.params.dawnDuration / this.params.cycleDuration / 2;
    const duskHalf =
      this.params.duskDuration / this.params.cycleDuration / 2;

    const tod = this.getTimeOfDay();
    const corruption = this.getCorruptionIntensity();

    if (tod === "dawn") {
      const dawnStart = nightEnd - dawnHalf;
      const dawnEnd = nightEnd + dawnHalf;
      const progress = (t - dawnStart) / (dawnEnd - dawnStart);
      // Night → Dawn → Day
      if (progress < 0.5) {
        return interpolateColors(NIGHT_COLORS, DAWN_COLORS, progress * 2, corruption);
      }
      return interpolateColors(DAWN_COLORS, DAY_COLORS, (progress - 0.5) * 2, corruption);
    }

    if (tod === "day") {
      return interpolateColors(DAY_COLORS, DAY_COLORS, 0, corruption);
    }

    if (tod === "dusk") {
      const duskStart = dayEnd - duskHalf;
      const duskEnd = dayEnd + duskHalf;
      const progress = (t - duskStart) / (duskEnd - duskStart);
      // Day → Dusk → Night
      if (progress < 0.5) {
        return interpolateColors(DAY_COLORS, DUSK_COLORS, progress * 2, corruption);
      }
      return interpolateColors(DUSK_COLORS, NIGHT_COLORS, (progress - 0.5) * 2, corruption);
    }

    // Night
    return interpolateColors(NIGHT_COLORS, NIGHT_COLORS, 0, corruption);
  }

  /**
   * Set time to a specific normalized value (for debug controls).
   */
  setTime(t: number): void {
    this.time = ((t % 1.0) + 1.0) % 1.0;
    this.cycleElapsed = this.time * this.params.cycleDuration;
    this.updateDerivedState();
  }

  /**
   * Skip to a specific time of day.
   */
  skipTo(timeOfDay: TimeOfDay): void {
    const nightEnd = (1 - this.params.dayFraction) / 2;
    const dayEnd = nightEnd + this.params.dayFraction;

    switch (timeOfDay) {
      case "dawn":
        this.setTime(nightEnd);
        break;
      case "day":
        this.setTime((nightEnd + dayEnd) / 2); // Noon
        break;
      case "dusk":
        this.setTime(dayEnd);
        break;
      case "night":
        this.setTime(0); // Midnight
        break;
    }
  }

  /**
   * Reset to dawn.
   */
  reset(): void {
    const nightEnd = (1 - this.params.dayFraction) / 2;
    this.setTime(nightEnd);
  }
}
