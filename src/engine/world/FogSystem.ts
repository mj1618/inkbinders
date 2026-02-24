// FogSystem — zone-based fog-of-war, input inversion, and input scramble
// for the Gothic Errata biome. Purely spatial effects (not time-based like Day/Night).

import type { Rect } from "@/lib/types";
import { InputAction } from "@/engine/input/InputManager";
import type { InputManager } from "@/engine/input/InputManager";
import { aabbOverlap } from "@/engine/physics/AABB";

// ─── Types ──────────────────────────────────────────────────────────

export interface FogZone {
  id: string;
  rect: Rect;
  type: "fog" | "inversion" | "scramble";
  /** Fog density 0-1 (only used for "fog" type). Higher = less visibility. */
  density: number;
  active: boolean;
}

export interface FogSystemParams {
  baseFogRadius: number;
  minFogRadius: number;
  fogFadeInRate: number;
  fogFadeOutRate: number;
  dashClearsFog: boolean;
  dashClearDuration: number;
  inversionAffectsDash: boolean;
  scrambleAffectsDash: boolean;
  inversionTintStrength: number;
  scrambleGlitchStrength: number;
  controlTransitionDelay: number;
}

export const DEFAULT_FOG_SYSTEM_PARAMS: FogSystemParams = {
  baseFogRadius: 200,
  minFogRadius: 80,
  fogFadeInRate: 0.08,
  fogFadeOutRate: 0.15,
  dashClearsFog: true,
  dashClearDuration: 15,
  inversionAffectsDash: false,
  scrambleAffectsDash: false,
  inversionTintStrength: 0.15,
  scrambleGlitchStrength: 0.2,
  controlTransitionDelay: 10,
};

export interface FogState {
  inFog: boolean;
  fogLevel: number;
  visibilityRadius: number;
  inverted: boolean;
  scrambled: boolean;
  dashClearing: boolean;
  activeZoneIds: string[];
}

// ─── Directional actions for scramble remapping ─────────────────────

const DIRECTIONAL_ACTIONS: string[] = [
  InputAction.Left,
  InputAction.Right,
  InputAction.Up,
  InputAction.Down,
];

// ─── Fisher-Yates shuffle with seed ─────────────────────────────────

function seededShuffle(arr: string[], seed: number): string[] {
  const result = [...arr];
  let s = seed;
  const rng = () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Simple hash of a string to a number */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// ─── FogSystem Class ────────────────────────────────────────────────

export class FogSystem {
  zones: FogZone[];
  params: FogSystemParams;

  // Smoothed fog level (0 = clear, 1 = max fog)
  private currentFogLevel = 0;
  // Max fog density of overlapping fog zones
  private targetFogDensity = 0;

  // Control modification state
  private currentInversion = false;
  private currentScramble = false;
  private scrambleMap: Map<string, string> = new Map();

  // Grace period counter (frames since entering a control zone)
  private transitionTimer = 0;
  // Whether we're in the grace period (controls still normal)
  private inGracePeriod = false;

  // Dash-clear timer
  private dashClearTimer = 0;

  // Track which control zone we're in (to detect re-entry)
  private lastControlZoneId: string | null = null;

  // Random seed offset that changes on each zone re-entry (for scramble variation)
  private scrambleSessionSeed = 0;

  // Active zone IDs for debug display
  private activeZoneIds: string[] = [];

  // Glitch effect frame counter
  private glitchFrame = 0;

  constructor(zones: FogZone[], params?: Partial<FogSystemParams>) {
    this.zones = zones;
    this.params = { ...DEFAULT_FOG_SYSTEM_PARAMS, ...params };
  }

  /**
   * Update fog state based on player position.
   * Call each frame before player.update().
   */
  update(playerBounds: Rect, isDashing: boolean): FogState {
    this.glitchFrame++;

    // Find overlapping zones
    const overlapping: FogZone[] = [];
    for (const zone of this.zones) {
      if (!zone.active) continue;
      if (aabbOverlap(playerBounds, zone.rect)) {
        overlapping.push(zone);
      }
    }

    this.activeZoneIds = overlapping.map((z) => z.id);

    // --- Fog level ---
    let maxDensity = 0;
    for (const zone of overlapping) {
      if (zone.type === "fog" && zone.density > maxDensity) {
        maxDensity = zone.density;
      }
    }
    this.targetFogDensity = maxDensity;

    // Dash clear logic
    if (isDashing && this.params.dashClearsFog && maxDensity > 0) {
      this.dashClearTimer = this.params.dashClearDuration;
    }
    if (this.dashClearTimer > 0) {
      this.dashClearTimer--;
    }

    // Smooth fog level
    const targetLevel = this.dashClearTimer > 0 ? 0 : maxDensity;
    if (this.currentFogLevel < targetLevel) {
      this.currentFogLevel = Math.min(
        targetLevel,
        this.currentFogLevel + this.params.fogFadeInRate,
      );
    } else if (this.currentFogLevel > targetLevel) {
      this.currentFogLevel = Math.max(
        targetLevel,
        this.currentFogLevel - this.params.fogFadeOutRate,
      );
    }

    // --- Control modification ---
    // Find the first inversion or scramble zone we overlap
    let controlZone: FogZone | null = null;
    for (const zone of overlapping) {
      if (zone.type === "inversion") {
        controlZone = zone;
        break; // Inversion takes priority
      }
      if (zone.type === "scramble" && !controlZone) {
        controlZone = zone;
      }
    }

    if (controlZone) {
      // Detect zone change (new entry or different zone)
      if (this.lastControlZoneId !== controlZone.id) {
        this.lastControlZoneId = controlZone.id;
        this.transitionTimer = 0;
        this.inGracePeriod = true;

        // Generate new scramble map on zone entry
        if (controlZone.type === "scramble") {
          this.scrambleSessionSeed++;
          const seed = hashString(controlZone.id) + this.scrambleSessionSeed;
          const shuffled = seededShuffle(DIRECTIONAL_ACTIONS, seed);
          this.scrambleMap.clear();
          for (let i = 0; i < DIRECTIONAL_ACTIONS.length; i++) {
            if (DIRECTIONAL_ACTIONS[i] !== shuffled[i]) {
              this.scrambleMap.set(DIRECTIONAL_ACTIONS[i], shuffled[i]);
            }
          }
        }
      }

      // Advance grace period
      if (this.inGracePeriod) {
        this.transitionTimer++;
        if (this.transitionTimer >= this.params.controlTransitionDelay) {
          this.inGracePeriod = false;
        }
      }

      if (!this.inGracePeriod) {
        this.currentInversion = controlZone.type === "inversion";
        this.currentScramble = controlZone.type === "scramble";
      } else {
        this.currentInversion = false;
        this.currentScramble = false;
      }
    } else {
      // Not in any control zone
      this.currentInversion = false;
      this.currentScramble = false;
      this.lastControlZoneId = null;
      this.inGracePeriod = false;
      this.transitionTimer = 0;
    }

    return {
      inFog: this.currentFogLevel > 0.01,
      fogLevel: this.currentFogLevel,
      visibilityRadius: this.getVisibilityRadius(),
      inverted: this.currentInversion,
      scrambled: this.currentScramble,
      dashClearing: this.dashClearTimer > 0,
      activeZoneIds: this.activeZoneIds,
    };
  }

  /** Get current effective visibility radius in pixels. Infinity if not in fog. */
  getVisibilityRadius(): number {
    if (this.currentFogLevel <= 0.01) return Infinity;
    if (this.dashClearTimer > 0) return Infinity;
    const range = this.params.baseFogRadius - this.params.minFogRadius;
    return this.params.baseFogRadius - range * this.currentFogLevel;
  }

  /** Check if horizontal controls are currently inverted */
  isInverted(): boolean {
    return this.currentInversion;
  }

  /** Check if controls are currently scrambled */
  isScrambled(): boolean {
    return this.currentScramble;
  }

  /** Get a copy of the current scramble mapping for debug display */
  getScrambleMap(): Map<string, string> {
    return new Map(this.scrambleMap);
  }

  /** Get the current fog level (0-1) */
  getFogLevel(): number {
    return this.currentFogLevel;
  }

  /**
   * Apply the current input remap to an InputManager.
   * Call BEFORE player.update().
   */
  applyInputOverride(inputManager: InputManager): void {
    if (this.currentInversion) {
      const remap = new Map<string, string>();
      remap.set(InputAction.Left, InputAction.Right);
      remap.set(InputAction.Right, InputAction.Left);
      // Optionally affect dash direction
      if (this.params.inversionAffectsDash) {
        remap.set(InputAction.Dash, InputAction.Dash); // no-op but keeps structure
      }
      inputManager.setActionRemap(remap);
    } else if (this.currentScramble) {
      const remap = new Map<string, string>(this.scrambleMap);
      // If scramble doesn't affect dash, ensure dash passes through
      if (!this.params.scrambleAffectsDash) {
        remap.delete(InputAction.Dash);
      }
      inputManager.setActionRemap(remap.size > 0 ? remap : null);
    } else {
      inputManager.setActionRemap(null);
    }
  }

  /**
   * Clear the input remap on an InputManager.
   * Call AFTER player.update().
   */
  restoreInputOverride(inputManager: InputManager): void {
    inputManager.setActionRemap(null);
  }

  /**
   * Render fog overlay on the canvas (screen-space).
   * Draws a dark overlay with a radial gradient hole at the player position.
   * Call AFTER all world rendering, BEFORE HUD rendering.
   */
  renderFogOverlay(
    ctx: CanvasRenderingContext2D,
    playerScreenX: number,
    playerScreenY: number,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    if (this.currentFogLevel <= 0.01) return;

    const radius = this.getVisibilityRadius();
    if (radius === Infinity) return;

    ctx.save();

    // Draw full-screen dark overlay
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(13, 10, 10, ${this.currentFogLevel * 0.92})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Cut out a radial gradient hole at the player position
    ctx.globalCompositeOperation = "destination-out";
    const gradient = ctx.createRadialGradient(
      playerScreenX, playerScreenY, radius * 0.3,
      playerScreenX, playerScreenY, radius,
    );
    gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
    gradient.addColorStop(0.7, "rgba(0, 0, 0, 0.8)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.restore();
  }

  /**
   * Render control modification screen effects (screen-space).
   * - Inversion: subtle red tint on screen edges
   * - Scramble: brief green glitch lines at random positions
   */
  renderControlEffects(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    if (this.currentInversion) {
      const strength = this.params.inversionTintStrength;
      ctx.save();
      // Red vignette on edges
      const grad = ctx.createRadialGradient(
        canvasWidth / 2, canvasHeight / 2, Math.min(canvasWidth, canvasHeight) * 0.35,
        canvasWidth / 2, canvasHeight / 2, Math.max(canvasWidth, canvasHeight) * 0.7,
      );
      grad.addColorStop(0, "rgba(220, 38, 38, 0)");
      grad.addColorStop(1, `rgba(220, 38, 38, ${strength})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.restore();
    }

    if (this.currentScramble) {
      const strength = this.params.scrambleGlitchStrength;
      ctx.save();
      ctx.globalAlpha = strength;

      // Green glitch lines at pseudo-random positions (change each frame)
      const lineCount = 3 + (this.glitchFrame % 3);
      for (let i = 0; i < lineCount; i++) {
        // Pseudo-random based on frame + index
        const seed = this.glitchFrame * 7 + i * 31;
        const y = ((seed * 16807) % 2147483647) / 2147483647 * canvasHeight;
        const x = ((seed * 48271) % 2147483647) / 2147483647 * canvasWidth * 0.5;
        const w = 50 + ((seed * 69621) % 2147483647) / 2147483647 * 200;

        ctx.fillStyle = "#4ade80";
        ctx.fillRect(x, y, w, 1 + (i % 2));
      }

      // Subtle green tint on edges
      const grad = ctx.createRadialGradient(
        canvasWidth / 2, canvasHeight / 2, Math.min(canvasWidth, canvasHeight) * 0.4,
        canvasWidth / 2, canvasHeight / 2, Math.max(canvasWidth, canvasHeight) * 0.7,
      );
      grad.addColorStop(0, "rgba(74, 222, 128, 0)");
      grad.addColorStop(1, `rgba(74, 222, 128, ${strength * 0.4})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      ctx.restore();
    }
  }

  /**
   * Render debug overlay: zone outlines and labels.
   * Call in world-space (camera transform applied).
   */
  renderDebug(ctx: CanvasRenderingContext2D): void {
    for (const zone of this.zones) {
      if (!zone.active) continue;

      let color: string;
      switch (zone.type) {
        case "fog":
          color = "#a855f7";
          break;
        case "inversion":
          color = "#dc2626";
          break;
        case "scramble":
          color = "#4ade80";
          break;
      }

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.globalAlpha = 0.6;
      ctx.strokeRect(zone.rect.x, zone.rect.y, zone.rect.width, zone.rect.height);
      ctx.setLineDash([]);

      // Label
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = color;
      ctx.font = "11px monospace";
      const label = `${zone.type.toUpperCase()} (${zone.id})${zone.type === "fog" ? ` d=${zone.density}` : ""}`;
      ctx.fillText(label, zone.rect.x + 4, zone.rect.y + 14);
      ctx.restore();
    }
  }

  /**
   * Render fog zone boundaries as in-world visuals (always visible).
   * Call in world-space (camera transform applied).
   */
  renderZoneBoundaries(ctx: CanvasRenderingContext2D): void {
    const time = this.glitchFrame;

    for (const zone of this.zones) {
      if (!zone.active) continue;

      const { x, y, width, height } = zone.rect;

      ctx.save();

      if (zone.type === "fog") {
        // Purple edge glow + drifting particles
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = "#a855f7";
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);

        // Drifting particles along edges
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = "#78716c";
        const particleCount = Math.floor((width + height) / 60);
        for (let i = 0; i < particleCount; i++) {
          const t = (time * 0.02 + i * 0.37) % 1;
          const edge = i % 4;
          let px: number, py: number;
          switch (edge) {
            case 0: px = x + t * width; py = y + Math.sin(time * 0.05 + i) * 6; break;
            case 1: px = x + width + Math.sin(time * 0.05 + i) * 6; py = y + t * height; break;
            case 2: px = x + t * width; py = y + height + Math.sin(time * 0.05 + i) * 6; break;
            default: px = x + Math.sin(time * 0.05 + i) * 6; py = y + t * height; break;
          }
          ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
        }
      } else if (zone.type === "inversion") {
        // Red pulsing boundary
        const pulse = 0.12 + Math.sin(time * 0.08) * 0.05;
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = "#dc2626";
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);

        // Small arrow particles pointing wrong direction
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = "#dc2626";
        const arrowCount = Math.floor((width + height) / 100);
        for (let i = 0; i < arrowCount; i++) {
          const t = (time * 0.015 + i * 0.41) % 1;
          const edge = i % 2;
          const px = edge === 0 ? x : x + width;
          const py = y + t * height;
          // Arrow pointing inward (wrong direction)
          const dir = edge === 0 ? 1 : -1;
          ctx.beginPath();
          ctx.moveTo(px + dir * 8, py);
          ctx.lineTo(px, py - 3);
          ctx.lineTo(px, py + 3);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        // Green flickering boundary (jittery position)
        const jitterX = (Math.sin(time * 0.3) * 2) | 0;
        const jitterY = (Math.cos(time * 0.25) * 2) | 0;
        ctx.globalAlpha = 0.12 + (time % 3 === 0 ? 0.05 : 0);
        ctx.strokeStyle = "#4ade80";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + jitterX, y + jitterY, width, height);

        // Static particles
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = "#4ade80";
        const staticCount = Math.floor((width + height) / 80);
        for (let i = 0; i < staticCount; i++) {
          const seed = time * 7 + i * 53;
          const t = ((seed * 16807) % 2147483647) / 2147483647;
          const edge = i % 4;
          let px: number, py: number;
          switch (edge) {
            case 0: px = x + t * width; py = y; break;
            case 1: px = x + width; py = y + t * height; break;
            case 2: px = x + t * width; py = y + height; break;
            default: px = x; py = y + t * height; break;
          }
          ctx.fillRect(px - 1, py - 1, 2, 2);
        }
      }

      ctx.restore();
    }
  }
}
