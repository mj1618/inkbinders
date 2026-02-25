// FogSystem — fog-of-war zones and input inversion/scramble for Gothic Errata biome

import type { Rect } from "@/lib/types";
import { aabbOverlap } from "@/engine/physics/AABB";
import { InputAction } from "@/engine/input/InputManager";

// ─── Fog Zone Types ──────────────────────────────────────────────────

export type FogZoneType = "fog" | "inversion" | "scramble";

export interface FogZone {
  id: string;
  rect: Rect;
  type: FogZoneType;
  /** Fog density (0-1). Higher = less visibility. Only meaningful for "fog" type. */
  density: number;
  active: boolean;
}

// ─── Params ──────────────────────────────────────────────────────────

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

// ─── Fog State ───────────────────────────────────────────────────────

export interface FogState {
  inFog: boolean;
  fogLevel: number;
  visibilityRadius: number;
  inverted: boolean;
  scrambled: boolean;
  dashClearing: boolean;
  activeZoneIds: string[];
}

// ─── Boundary Particle ──────────────────────────────────────────────

interface BoundaryParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

// ─── FogSystem ───────────────────────────────────────────────────────

export class FogSystem {
  zones: FogZone[];
  params: FogSystemParams;

  private currentFogLevel = 0;
  private currentMaxDensity = 0;
  private currentInversion = false;
  private currentScramble = false;
  private scrambleMap: Map<string, string> = new Map();
  private transitionTimer = 0;
  private dashClearTimer = 0;

  private prevInZoneType: FogZoneType | null = null;
  private lastScrambleZoneId: string | null = null;

  private lastIsDashing = false;

  private boundaryParticles: BoundaryParticle[] = [];
  private frameCount = 0;

  constructor(zones: FogZone[], params?: Partial<FogSystemParams>) {
    this.zones = zones;
    this.params = { ...DEFAULT_FOG_SYSTEM_PARAMS, ...params };
  }

  update(playerBounds: Rect, isDashing: boolean): FogState {
    this.frameCount++;
    this.lastIsDashing = isDashing;

    const overlapping = this.zones.filter(
      (z) => z.active && aabbOverlap(playerBounds, z.rect),
    );

    const activeZoneIds = overlapping.map((z) => z.id);

    // Fog level
    const fogZones = overlapping.filter((z) => z.type === "fog");
    const inFog = fogZones.length > 0;
    this.currentMaxDensity = inFog
      ? Math.max(...fogZones.map((z) => z.density))
      : 0;

    if (inFog) {
      this.currentFogLevel = Math.min(
        this.currentMaxDensity,
        this.currentFogLevel + this.params.fogFadeInRate,
      );
    } else {
      this.currentFogLevel = Math.max(
        0,
        this.currentFogLevel - this.params.fogFadeOutRate,
      );
    }

    // Dash clear
    if (isDashing && this.params.dashClearsFog && this.currentFogLevel > 0) {
      this.dashClearTimer = this.params.dashClearDuration;
    }
    if (this.dashClearTimer > 0) {
      this.dashClearTimer--;
    }

    // Control modification zones
    const inversionZone = overlapping.find((z) => z.type === "inversion");
    const scrambleZone = overlapping.find((z) => z.type === "scramble");

    const controlZoneType = inversionZone
      ? "inversion"
      : scrambleZone
        ? "scramble"
        : null;

    // Transition delay on zone entry
    if (controlZoneType !== this.prevInZoneType) {
      this.transitionTimer = this.params.controlTransitionDelay;
      this.prevInZoneType = controlZoneType as FogZoneType | null;

      if (scrambleZone && scrambleZone.id !== this.lastScrambleZoneId) {
        this.generateScrambleMap(scrambleZone.id);
        this.lastScrambleZoneId = scrambleZone.id;
      }
    }

    if (this.transitionTimer > 0) {
      this.transitionTimer--;
    }

    const delayExpired = this.transitionTimer <= 0;

    this.currentInversion = !!inversionZone && delayExpired;
    this.currentScramble =
      !this.currentInversion && !!scrambleZone && delayExpired;

    // Clear scramble tracking when exiting scramble zones
    if (!scrambleZone) {
      this.lastScrambleZoneId = null;
    }

    // Update boundary particles
    this.updateBoundaryParticles();

    const dashClearing = this.dashClearTimer > 0;
    const effectiveFogLevel = dashClearing ? 0 : this.currentFogLevel;

    return {
      inFog,
      fogLevel: effectiveFogLevel,
      visibilityRadius: this.getVisibilityRadius(),
      inverted: this.currentInversion,
      scrambled: this.currentScramble,
      dashClearing,
      activeZoneIds,
    };
  }

  getVisibilityRadius(): number {
    if (this.dashClearTimer > 0) return Infinity;
    if (this.currentFogLevel <= 0) return Infinity;

    const t = this.currentFogLevel;
    return (
      this.params.baseFogRadius +
      (this.params.minFogRadius - this.params.baseFogRadius) * t
    );
  }

  remapAction(action: string): string {
    if (this.currentInversion) {
      if (action === InputAction.Left) return InputAction.Right;
      if (action === InputAction.Right) return InputAction.Left;
      return action;
    }
    if (this.currentScramble) {
      return this.scrambleMap.get(action) ?? action;
    }
    return action;
  }

  isInverted(): boolean {
    return this.currentInversion;
  }

  isScrambled(): boolean {
    return this.currentScramble;
  }

  /** Build the InputManager remap based on current control modification.
   *  When the player is dashing and the relevant immunity toggle is off,
   *  directional remaps are suppressed so dash direction uses raw input. */
  getActiveRemap(): Map<string, string> | null {
    if (!this.currentInversion && !this.currentScramble) return null;

    if (this.currentInversion) {
      if (this.lastIsDashing && !this.params.inversionAffectsDash) return null;
      const remap = new Map<string, string>();
      remap.set(InputAction.Left, InputAction.Right);
      remap.set(InputAction.Right, InputAction.Left);
      return remap;
    }

    if (this.currentScramble) {
      if (this.lastIsDashing && !this.params.scrambleAffectsDash) return null;
      const remap = new Map<string, string>();
      for (const [from, to] of this.scrambleMap) {
        remap.set(from, to);
      }
      return remap;
    }

    return null;
  }

  getScrambleMapDisplay(): string[] {
    if (!this.currentScramble) return [];
    const labels: Record<string, string> = {
      [InputAction.Left]: "Left",
      [InputAction.Right]: "Right",
      [InputAction.Up]: "Up",
      [InputAction.Down]: "Down",
    };
    const result: string[] = [];
    for (const [from, to] of this.scrambleMap) {
      result.push(`${labels[from] ?? from} → ${labels[to] ?? to}`);
    }
    return result;
  }

  // ─── Rendering ─────────────────────────────────────────────────

  renderFogOverlay(
    ctx: CanvasRenderingContext2D,
    playerScreenX: number,
    playerScreenY: number,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    const fogLevel = this.dashClearTimer > 0 ? 0 : this.currentFogLevel;
    if (fogLevel <= 0) return;

    const radius = this.getVisibilityRadius();
    if (radius === Infinity) return;

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(13, 10, 10, ${fogLevel * 0.92})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.globalCompositeOperation = "destination-out";
    const gradient = ctx.createRadialGradient(
      playerScreenX,
      playerScreenY,
      radius * 0.3,
      playerScreenX,
      playerScreenY,
      radius,
    );
    gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
    gradient.addColorStop(0.7, "rgba(0, 0, 0, 0.8)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.restore();
  }

  renderControlEffects(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    if (this.currentInversion) {
      const alpha = this.params.inversionTintStrength;
      ctx.save();

      // Red tint on left and right edges
      const edgeWidth = 60;
      const gradientL = ctx.createLinearGradient(0, 0, edgeWidth, 0);
      gradientL.addColorStop(0, `rgba(220, 38, 38, ${alpha})`);
      gradientL.addColorStop(1, "rgba(220, 38, 38, 0)");
      ctx.fillStyle = gradientL;
      ctx.fillRect(0, 0, edgeWidth, canvasHeight);

      const gradientR = ctx.createLinearGradient(
        canvasWidth,
        0,
        canvasWidth - edgeWidth,
        0,
      );
      gradientR.addColorStop(0, `rgba(220, 38, 38, ${alpha})`);
      gradientR.addColorStop(1, "rgba(220, 38, 38, 0)");
      ctx.fillStyle = gradientR;
      ctx.fillRect(canvasWidth - edgeWidth, 0, edgeWidth, canvasHeight);

      // Mirrored arrows hint
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = "#dc2626";
      ctx.font = "16px monospace";
      ctx.textAlign = "center";
      ctx.fillText("⟵ ⟶ INVERTED ⟵ ⟶", canvasWidth / 2, 20);
      ctx.textAlign = "left";

      ctx.restore();
    }

    if (this.currentScramble) {
      const alpha = this.params.scrambleGlitchStrength;
      ctx.save();

      // Green glitch lines at random positions
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "#4ade80";
      ctx.lineWidth = 2;
      const lineCount = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < lineCount; i++) {
        const lx = Math.random() * canvasWidth;
        const ly = Math.random() * canvasHeight;
        const lw = 20 + Math.random() * 80;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + lw, ly);
        ctx.stroke();
      }

      // Scanline distortion hint
      for (let y = 0; y < canvasHeight; y += 4) {
        if (Math.random() < 0.03) {
          ctx.globalAlpha = alpha * 0.3;
          ctx.fillStyle = "#4ade80";
          ctx.fillRect(0, y, canvasWidth, 1);
        }
      }

      // Label
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = "#4ade80";
      ctx.font = "16px monospace";
      ctx.textAlign = "center";
      ctx.fillText("◈ SCRAMBLED ◈", canvasWidth / 2, 20);
      ctx.textAlign = "left";

      ctx.restore();
    }
  }

  renderZoneBoundaries(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    const viewLeft = cameraX;
    const viewRight = cameraX + canvasWidth;
    const viewTop = cameraY;
    const viewBottom = cameraY + canvasHeight;

    for (const zone of this.zones) {
      if (!zone.active) continue;

      const r = zone.rect;
      if (
        r.x + r.width < viewLeft ||
        r.x > viewRight ||
        r.y + r.height < viewTop ||
        r.y > viewBottom
      ) {
        continue;
      }

      ctx.save();

      if (zone.type === "fog") {
        // Purple edge glow
        ctx.strokeStyle = "rgba(168, 85, 247, 0.15)";
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 12]);
        ctx.strokeRect(r.x, r.y, r.width, r.height);
        ctx.setLineDash([]);

        // Inner glow
        ctx.strokeStyle = "rgba(168, 85, 247, 0.06)";
        ctx.lineWidth = 12;
        ctx.strokeRect(r.x + 6, r.y + 6, r.width - 12, r.height - 12);
      } else if (zone.type === "inversion") {
        // Pulsing red boundary
        const pulse = 0.1 + 0.05 * Math.sin(this.frameCount * 0.1);
        ctx.strokeStyle = `rgba(220, 38, 38, ${pulse})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(r.x, r.y, r.width, r.height);

        // Inner red glow
        ctx.strokeStyle = `rgba(220, 38, 38, ${pulse * 0.3})`;
        ctx.lineWidth = 10;
        ctx.strokeRect(r.x + 5, r.y + 5, r.width - 10, r.height - 10);

        // Small reversed arrows along boundary
        ctx.fillStyle = `rgba(220, 38, 38, ${pulse * 2})`;
        ctx.font = "10px monospace";
        const step = 80;
        for (let x = r.x + 20; x < r.x + r.width - 20; x += step) {
          ctx.fillText("⟵⟶", x, r.y - 4);
          ctx.fillText("⟵⟶", x, r.y + r.height + 10);
        }
      } else if (zone.type === "scramble") {
        // Jittering green boundary
        const jx = (Math.random() - 0.5) * 2;
        const jy = (Math.random() - 0.5) * 2;
        ctx.strokeStyle = "rgba(74, 222, 128, 0.12)";
        ctx.lineWidth = 3;
        ctx.strokeRect(r.x + jx, r.y + jy, r.width, r.height);

        // Inner green glow
        ctx.strokeStyle = "rgba(74, 222, 128, 0.04)";
        ctx.lineWidth = 10;
        ctx.strokeRect(r.x + 5, r.y + 5, r.width - 10, r.height - 10);

        // Static dots
        ctx.fillStyle = "rgba(74, 222, 128, 0.15)";
        for (let i = 0; i < 12; i++) {
          const px = r.x + Math.random() * r.width;
          const py = r.y + Math.random() * r.height * 0.05;
          ctx.fillRect(px, py, 2, 2);
          ctx.fillRect(
            r.x + Math.random() * r.width,
            r.y + r.height - Math.random() * r.height * 0.05,
            2,
            2,
          );
        }
      }

      ctx.restore();
    }

    // Render boundary particles
    for (const p of this.boundaryParticles) {
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha * 0.6;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.restore();
    }
  }

  renderDebug(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    const viewLeft = cameraX;
    const viewRight = cameraX + canvasWidth;
    const viewTop = cameraY;
    const viewBottom = cameraY + canvasHeight;

    for (const zone of this.zones) {
      if (!zone.active) continue;

      const r = zone.rect;
      if (
        r.x + r.width < viewLeft ||
        r.x > viewRight ||
        r.y + r.height < viewTop ||
        r.y > viewBottom
      ) {
        continue;
      }

      ctx.save();

      const color =
        zone.type === "fog"
          ? "#a855f7"
          : zone.type === "inversion"
            ? "#dc2626"
            : "#4ade80";

      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.4;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(r.x, r.y, r.width, r.height);
      ctx.setLineDash([]);

      ctx.globalAlpha = 0.6;
      ctx.fillStyle = color;
      ctx.font = "10px monospace";
      const label =
        zone.type === "fog"
          ? `FOG d=${zone.density}`
          : zone.type === "inversion"
            ? "INVERSION"
            : "SCRAMBLE";
      ctx.fillText(`[${zone.id}] ${label}`, r.x + 4, r.y + 12);

      ctx.restore();
    }
  }

  // ─── Internal ──────────────────────────────────────────────────

  private generateScrambleMap(zoneId: string): void {
    // Deterministic seed from zone ID
    let hash = 0;
    for (let i = 0; i < zoneId.length; i++) {
      hash = (hash * 31 + zoneId.charCodeAt(i)) | 0;
    }
    // Mix in entry count for re-randomization on re-entry
    hash = (hash * 16807 + this.frameCount) | 0;

    const directions = [
      InputAction.Left,
      InputAction.Right,
      InputAction.Up,
      InputAction.Down,
    ];

    // Fisher-Yates shuffle with seeded random
    const shuffled = [...directions];
    let s = Math.abs(hash);
    for (let i = shuffled.length - 1; i > 0; i--) {
      s = (s * 16807 + 0) % 2147483647;
      const j = s % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Ensure at least one direction is actually changed
    let anyChanged = false;
    for (let i = 0; i < directions.length; i++) {
      if (directions[i] !== shuffled[i]) {
        anyChanged = true;
        break;
      }
    }
    if (!anyChanged) {
      // Swap first two to guarantee disruption
      [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
    }

    this.scrambleMap.clear();
    for (let i = 0; i < directions.length; i++) {
      this.scrambleMap.set(directions[i], shuffled[i]);
    }
  }

  private updateBoundaryParticles(): void {
    // Spawn new particles along zone boundaries
    if (this.frameCount % 3 === 0) {
      for (const zone of this.zones) {
        if (!zone.active) continue;

        const r = zone.rect;
        const color =
          zone.type === "fog"
            ? "#78716c"
            : zone.type === "inversion"
              ? "#dc2626"
              : "#4ade80";

        // Spawn along edges
        const edge = Math.floor(Math.random() * 4);
        let px: number, py: number, vx: number, vy: number;

        if (edge === 0) {
          // Top
          px = r.x + Math.random() * r.width;
          py = r.y;
          vx = (Math.random() - 0.5) * 10;
          vy = zone.type === "fog" ? Math.random() * 8 : -Math.random() * 8;
        } else if (edge === 1) {
          // Bottom
          px = r.x + Math.random() * r.width;
          py = r.y + r.height;
          vx = (Math.random() - 0.5) * 10;
          vy = zone.type === "fog" ? -Math.random() * 8 : Math.random() * 8;
        } else if (edge === 2) {
          // Left
          px = r.x;
          py = r.y + Math.random() * r.height;
          vx = zone.type === "fog" ? Math.random() * 8 : -Math.random() * 8;
          vy = (Math.random() - 0.5) * 10;
        } else {
          // Right
          px = r.x + r.width;
          py = r.y + Math.random() * r.height;
          vx = zone.type === "fog" ? -Math.random() * 8 : Math.random() * 8;
          vy = (Math.random() - 0.5) * 10;
        }

        this.boundaryParticles.push({
          x: px,
          y: py,
          vx,
          vy,
          life: 1.0,
          maxLife: 1.0,
          size: 2 + Math.random() * 2,
          color,
        });
      }
    }

    // Update existing particles
    const dt = 1 / 60;
    for (const p of this.boundaryParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt * 0.8;
    }

    // Remove dead particles, cap count
    this.boundaryParticles = this.boundaryParticles.filter((p) => p.life > 0);
    if (this.boundaryParticles.length > 150) {
      this.boundaryParticles.splice(0, this.boundaryParticles.length - 150);
    }
  }
}
