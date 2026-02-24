// Corruption Modifiers — Night corruption effects that modify the world

import type { Vec2 } from "@/lib/types";

export type CorruptionModifierType =
  | "surface-flip"
  | "gravity-pulse"
  | "fog-of-war"
  | "ink-bleed"
  | "platform-flicker";

export interface CorruptionModifier {
  type: CorruptionModifierType;
  /** Minimum corruption intensity to activate (0-1) */
  threshold: number;
  /** Whether this modifier is currently active */
  active: boolean;
}

export interface CorruptionParams {
  /** Whether corruption modifiers are enabled */
  enabled: boolean;
  /** Surface flip: which surface types change and to what */
  surfaceFlipMap: Record<string, string>;
  /** Gravity pulse: interval between pulses (seconds) */
  gravityPulseInterval: number;
  /** Gravity pulse: duration of each pulse (seconds) */
  gravityPulseDuration: number;
  /** Gravity pulse: gravity multiplier during pulse */
  gravityPulseMultiplier: number;
  /** Fog of war: visibility radius (px) at max corruption */
  fogMinRadius: number;
  /** Fog of war: visibility radius (px) at zero corruption */
  fogMaxRadius: number;
  /** Ink bleed: particles per second at max corruption */
  inkBleedRate: number;
  /** Platform flicker: flicker probability per frame per platform at max corruption */
  platformFlickerChance: number;
}

export const DEFAULT_CORRUPTION_PARAMS: CorruptionParams = {
  enabled: true,
  surfaceFlipMap: {
    normal: "icy",
    icy: "bouncy",
    bouncy: "sticky",
    sticky: "conveyor",
    conveyor: "normal",
  },
  gravityPulseInterval: 5.0,
  gravityPulseDuration: 0.5,
  gravityPulseMultiplier: -0.5,
  fogMinRadius: 120,
  fogMaxRadius: 600,
  inkBleedRate: 8,
  platformFlickerChance: 0.005,
};

/** Corruption modifier activation thresholds */
const MODIFIER_THRESHOLDS: Record<CorruptionModifierType, number> = {
  "ink-bleed": 0.2,
  "surface-flip": 0.3,
  "platform-flicker": 0.4,
  "fog-of-war": 0.5,
  "gravity-pulse": 0.7,
};

export class CorruptionModifiers {
  params: CorruptionParams;
  modifiers: CorruptionModifier[];

  /** Current corruption intensity (set by DayNightCycle) */
  corruptionIntensity: number = 0;

  /** Gravity pulse timer */
  gravityPulseTimer: number = 0;
  /** Whether a gravity pulse is currently active */
  gravityPulseActive: boolean = false;
  /** Time into current pulse */
  gravityPulseCurrent: number = 0;

  /** Fog radius (interpolated based on corruption) */
  fogRadius: number = 600;

  /** Platform flicker states: maps platform index -> whether it's "flickered" this frame */
  platformFlickers: Map<number, boolean> = new Map();

  /** Ink bleed accumulator for spawning particles */
  inkBleedAccumulator: number = 0;

  /** Pending ink bleed particles to spawn (consumed by test page) */
  pendingInkBleeds: Vec2[] = [];

  constructor(params?: Partial<CorruptionParams>) {
    this.params = { ...DEFAULT_CORRUPTION_PARAMS, ...params };

    this.modifiers = (
      Object.keys(MODIFIER_THRESHOLDS) as CorruptionModifierType[]
    ).map((type) => ({
      type,
      threshold: MODIFIER_THRESHOLDS[type],
      active: false,
    }));
  }

  /**
   * Update all corruption modifiers for one frame.
   */
  update(
    dt: number,
    corruptionIntensity: number,
    platformCount: number,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    this.corruptionIntensity = corruptionIntensity;

    if (!this.params.enabled) {
      for (const mod of this.modifiers) {
        mod.active = false;
      }
      this.gravityPulseActive = false;
      this.fogRadius = this.params.fogMaxRadius;
      this.platformFlickers.clear();
      this.pendingInkBleeds = [];
      return;
    }

    // Update modifier active states
    for (const mod of this.modifiers) {
      mod.active = corruptionIntensity >= mod.threshold;
    }

    // --- Gravity Pulse ---
    const gravMod = this.getModifier("gravity-pulse");
    if (gravMod?.active) {
      this.gravityPulseTimer += dt;
      // Scale interval inversely with corruption (more frequent at higher corruption)
      const scaledInterval =
        this.params.gravityPulseInterval /
        Math.max(0.5, corruptionIntensity);

      if (this.gravityPulseActive) {
        this.gravityPulseCurrent += dt;
        if (this.gravityPulseCurrent >= this.params.gravityPulseDuration) {
          this.gravityPulseActive = false;
          this.gravityPulseCurrent = 0;
          this.gravityPulseTimer = 0;
        }
      } else if (this.gravityPulseTimer >= scaledInterval) {
        this.gravityPulseActive = true;
        this.gravityPulseCurrent = 0;
        this.gravityPulseTimer = 0;
      }
    } else {
      this.gravityPulseActive = false;
      this.gravityPulseCurrent = 0;
      this.gravityPulseTimer = 0;
    }

    // --- Fog of War ---
    const fogMod = this.getModifier("fog-of-war");
    if (fogMod?.active) {
      // Interpolate fog radius based on corruption intensity
      const fogT = Math.max(
        0,
        (corruptionIntensity - fogMod.threshold) / (1 - fogMod.threshold),
      );
      this.fogRadius =
        this.params.fogMaxRadius +
        (this.params.fogMinRadius - this.params.fogMaxRadius) * fogT;
    } else {
      this.fogRadius = this.params.fogMaxRadius;
    }

    // --- Platform Flicker ---
    this.platformFlickers.clear();
    const flickerMod = this.getModifier("platform-flicker");
    if (flickerMod?.active) {
      const flickerScale = Math.max(
        0,
        (corruptionIntensity - flickerMod.threshold) /
          (1 - flickerMod.threshold),
      );
      const chance = this.params.platformFlickerChance * flickerScale;
      for (let i = 0; i < platformCount; i++) {
        if (Math.random() < chance) {
          this.platformFlickers.set(i, true);
        }
      }
    }

    // --- Ink Bleed ---
    this.pendingInkBleeds = [];
    const inkMod = this.getModifier("ink-bleed");
    if (inkMod?.active) {
      const inkScale = Math.max(
        0,
        (corruptionIntensity - inkMod.threshold) / (1 - inkMod.threshold),
      );
      const rate = this.params.inkBleedRate * inkScale;
      this.inkBleedAccumulator += rate * dt;

      while (this.inkBleedAccumulator >= 1) {
        this.inkBleedAccumulator -= 1;
        this.pendingInkBleeds.push({
          x: Math.random() * canvasWidth,
          y: Math.random() * canvasHeight,
        });
      }
    } else {
      this.inkBleedAccumulator = 0;
    }
  }

  /**
   * Get a modifier by type.
   */
  getModifier(type: CorruptionModifierType): CorruptionModifier | undefined {
    return this.modifiers.find((m) => m.type === type);
  }

  /**
   * Get the effective surface type for a platform given corruption.
   */
  getEffectiveSurface(originalSurface: string): string {
    const surfaceMod = this.getModifier("surface-flip");
    if (!surfaceMod?.active) return originalSurface;

    const flipped = this.params.surfaceFlipMap[originalSurface];
    return flipped ?? originalSurface;
  }

  /**
   * Get the current gravity multiplier (including any active pulse).
   * Returns 1.0 normally, or pulseMultiplier during a gravity pulse.
   */
  getGravityMultiplier(): number {
    if (!this.gravityPulseActive) return 1.0;
    return this.params.gravityPulseMultiplier;
  }

  /**
   * Get current fog-of-war radius.
   */
  getFogRadius(): number {
    return this.fogRadius;
  }

  /**
   * Whether a specific platform index is "flickering" this frame.
   */
  isPlatformFlickering(platformIndex: number): boolean {
    return this.platformFlickers.get(platformIndex) ?? false;
  }

  /**
   * Whether fog-of-war is active.
   */
  isFogActive(): boolean {
    return this.getModifier("fog-of-war")?.active ?? false;
  }

  /**
   * Whether surface flip is active.
   */
  isSurfaceFlipActive(): boolean {
    return this.getModifier("surface-flip")?.active ?? false;
  }

  /** Reset all modifier state */
  reset(): void {
    this.corruptionIntensity = 0;
    this.gravityPulseTimer = 0;
    this.gravityPulseActive = false;
    this.gravityPulseCurrent = 0;
    this.fogRadius = this.params.fogMaxRadius;
    this.platformFlickers.clear();
    this.inkBleedAccumulator = 0;
    this.pendingInkBleeds = [];
    for (const mod of this.modifiers) {
      mod.active = false;
    }
  }
}
