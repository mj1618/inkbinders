// CurrentSystem — area-based directional force zones for Maritime Ledger biome

import type { Rect, Vec2 } from "@/lib/types";
import { aabbOverlap } from "@/engine/physics/AABB";
import type { ParticleSystem } from "@/engine/core/ParticleSystem";

// ─── Current Zone Types ──────────────────────────────────────────────

export type CurrentType = "stream" | "gust" | "whirlpool" | "jet";

export interface CurrentZone {
  /** Unique ID */
  id: string;
  /** Rectangular area of the current */
  rect: Rect;
  /** Direction of the current force (unit vector, can be diagonal). Ignored for whirlpool. */
  direction: Vec2;
  /** Force magnitude (px/s² — acceleration applied to player while inside) */
  strength: number;
  /** Whether this current is active */
  active: boolean;
  /** Visual: current type affects rendering */
  type: CurrentType;
  /** For whirlpool: clockwise (true) or counter-clockwise (false) */
  clockwise?: boolean;
  /** For gust type: seconds the gust is active */
  gustOnDuration?: number;
  /** For gust type: seconds the gust is inactive */
  gustOffDuration?: number;
  /** Internal timer tracking gust phase (seconds elapsed in current phase) */
  gustTimer?: number;
  /** Internal: whether gust is currently in "on" phase */
  gustActive?: boolean;
}

// ─── Current Params ──────────────────────────────────────────────────

export interface CurrentParams {
  /** Global multiplier on all current strengths (for debug tuning) */
  globalStrengthMultiplier: number;
  /** Whether currents affect the player while grounded */
  affectsGrounded: boolean;
  /** Grounded strength multiplier (currents are weaker on ground due to friction) */
  groundedMultiplier: number;
  /** Maximum velocity the player can gain from currents alone */
  maxCurrentVelocity: number;
  /** How quickly current force ramps up when entering a zone (0-1, 1 = instant) */
  rampUpRate: number;
  /** Whether dash overrides current forces */
  dashOverridesCurrent: boolean;
  /** Particle density multiplier for current visualization */
  particleDensity: number;
}

export const DEFAULT_CURRENT_PARAMS: CurrentParams = {
  globalStrengthMultiplier: 1.0,
  affectsGrounded: true,
  groundedMultiplier: 0.4,
  maxCurrentVelocity: 500,
  rampUpRate: 0.15,
  dashOverridesCurrent: true,
  particleDensity: 1.0,
};

// ─── Gust defaults ───────────────────────────────────────────────────

const DEFAULT_GUST_ON_DURATION = 2.0;
const DEFAULT_GUST_OFF_DURATION = 1.5;
const GUST_TELEGRAPH_TIME = 0.3;

// ─── Flow line animation ─────────────────────────────────────────────

interface FlowLine {
  /** Position within zone (0-1 normalized) */
  offsetX: number;
  offsetY: number;
  /** Phase for animation cycling */
  phase: number;
}

// ─── Current System ──────────────────────────────────────────────────

export class CurrentSystem {
  zones: CurrentZone[];
  params: CurrentParams;

  private zoneRamps: Map<string, number> = new Map();
  private particleTimer = 0;
  private flowLines: Map<string, FlowLine[]> = new Map();
  private time = 0;

  constructor(zones: CurrentZone[], params?: Partial<CurrentParams>) {
    this.zones = zones;
    this.params = { ...DEFAULT_CURRENT_PARAMS, ...params };

    // Initialize gust timers and flow lines
    for (const zone of zones) {
      if (zone.type === "gust") {
        zone.gustOnDuration = zone.gustOnDuration ?? DEFAULT_GUST_ON_DURATION;
        zone.gustOffDuration = zone.gustOffDuration ?? DEFAULT_GUST_OFF_DURATION;
        zone.gustTimer = zone.gustTimer ?? 0;
        zone.gustActive = zone.gustActive ?? true;
      }
      this.zoneRamps.set(zone.id, 0);
      this.flowLines.set(zone.id, this.generateFlowLines(zone));
    }
  }

  /** Generate deterministic flow lines for a zone */
  private generateFlowLines(zone: CurrentZone): FlowLine[] {
    const lines: FlowLine[] = [];
    const area = zone.rect.width * zone.rect.height;
    const baseCount = Math.max(4, Math.floor(area / 8000));
    const count = zone.type === "jet" ? baseCount * 2 : baseCount;

    // Simple deterministic pseudo-random from zone id
    let seed = 0;
    for (let i = 0; i < zone.id.length; i++) {
      seed = (seed * 31 + zone.id.charCodeAt(i)) % 2147483647;
    }
    const rng = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let i = 0; i < count; i++) {
      lines.push({
        offsetX: rng(),
        offsetY: rng(),
        phase: rng() * Math.PI * 2,
      });
    }
    return lines;
  }

  /** Advance gust timers */
  updateGusts(dt: number): void {
    for (const zone of this.zones) {
      if (zone.type !== "gust") continue;

      const onDur = zone.gustOnDuration ?? DEFAULT_GUST_ON_DURATION;
      const offDur = zone.gustOffDuration ?? DEFAULT_GUST_OFF_DURATION;
      zone.gustTimer = (zone.gustTimer ?? 0) + dt;

      if (zone.gustActive) {
        if (zone.gustTimer >= onDur) {
          zone.gustActive = false;
          zone.gustTimer = 0;
        }
      } else {
        if (zone.gustTimer >= offDur) {
          zone.gustActive = true;
          zone.gustTimer = 0;
        }
      }
    }
    this.time += dt;
  }

  /** Get the effective strength of a zone (accounts for gust pulsing) */
  private getEffectiveStrength(zone: CurrentZone): number {
    if (zone.type === "gust") {
      if (zone.gustActive) return zone.strength;
      // During off phase, check for telegraph (ramp up near end of off phase)
      const offDur = zone.gustOffDuration ?? DEFAULT_GUST_OFF_DURATION;
      const timer = zone.gustTimer ?? 0;
      const timeUntilOn = offDur - timer;
      if (timeUntilOn <= GUST_TELEGRAPH_TIME && timeUntilOn > 0) {
        // Telegraph ramp: 0 to 0.15 during the last 0.3s of off phase
        const telegraphProgress = 1 - timeUntilOn / GUST_TELEGRAPH_TIME;
        return zone.strength * 0.15 * telegraphProgress;
      }
      return 0;
    }
    return zone.strength;
  }

  /** Compute the force direction for a zone at a given entity center position */
  private getForceDirection(zone: CurrentZone, entityCenter: Vec2): Vec2 {
    if (zone.type === "whirlpool") {
      const cx = zone.rect.x + zone.rect.width / 2;
      const cy = zone.rect.y + zone.rect.height / 2;
      const dx = entityCenter.x - cx;
      const dy = entityCenter.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) return { x: 0, y: -1 }; // At center, push up

      // Tangent direction perpendicular to radial
      const nx = dx / dist;
      const ny = dy / dist;
      if (zone.clockwise) {
        return { x: ny, y: -nx }; // Clockwise tangent
      } else {
        return { x: -ny, y: nx }; // Counter-clockwise tangent
      }
    }
    // Normalize direction to ensure unit vector (callers may pass non-normalized)
    const ddx = zone.direction.x;
    const ddy = zone.direction.y;
    const len = Math.sqrt(ddx * ddx + ddy * ddy);
    if (len < 0.001) return { x: 0, y: 0 };
    return { x: ddx / len, y: ddy / len };
  }

  /** Compute the net current force on an entity at a given bounds */
  getForceAt(bounds: Rect): Vec2 {
    const force: Vec2 = { x: 0, y: 0 };
    const entityCenter: Vec2 = {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };

    for (const zone of this.zones) {
      if (!zone.active) continue;
      if (!aabbOverlap(bounds, zone.rect)) continue;

      const ramp = this.zoneRamps.get(zone.id) ?? 0;
      const effectiveStrength = this.getEffectiveStrength(zone) * this.params.globalStrengthMultiplier * ramp;
      if (effectiveStrength === 0) continue;

      const dir = this.getForceDirection(zone, entityCenter);
      force.x += dir.x * effectiveStrength;
      force.y += dir.y * effectiveStrength;
    }

    return force;
  }

  /** Apply current forces to a player. Returns the force that was applied. */
  applyToPlayer(
    player: { position: Vec2; velocity: Vec2; size: Vec2 },
    dt: number,
    isGrounded: boolean,
    isDashing: boolean,
  ): Vec2 {
    // Update ramps for all zones
    const playerBounds: Rect = {
      x: player.position.x,
      y: player.position.y,
      width: player.size.x,
      height: player.size.y,
    };

    for (const zone of this.zones) {
      const currentRamp = this.zoneRamps.get(zone.id) ?? 0;
      const isOverlapping = zone.active && aabbOverlap(playerBounds, zone.rect);

      if (isOverlapping) {
        // Ramp up
        const newRamp = Math.min(1, currentRamp + this.params.rampUpRate);
        this.zoneRamps.set(zone.id, newRamp);
      } else {
        // Ramp down
        const newRamp = Math.max(0, currentRamp - this.params.rampUpRate);
        this.zoneRamps.set(zone.id, newRamp);
      }
    }

    // Dash override
    if (isDashing && this.params.dashOverridesCurrent) {
      return { x: 0, y: 0 };
    }

    // Grounded check
    if (isGrounded && !this.params.affectsGrounded) {
      return { x: 0, y: 0 };
    }

    const force = this.getForceAt(playerBounds);

    // Apply grounded multiplier
    const multiplier = isGrounded ? this.params.groundedMultiplier : 1.0;
    force.x *= multiplier;
    force.y *= multiplier;

    // Capture velocity before applying current force
    const prevVx = player.velocity.x;
    const prevVy = player.velocity.y;

    // Apply force as velocity modification
    player.velocity.x += force.x * dt;
    player.velocity.y += force.y * dt;

    // Cap: prevent currents from pushing velocity beyond maxCurrentVelocity.
    // Only clamp the current-induced portion — never reduce pre-existing velocity.
    const maxVel = this.params.maxCurrentVelocity;
    const newSpeed = Math.sqrt(player.velocity.x * player.velocity.x + player.velocity.y * player.velocity.y);
    const prevSpeed = Math.sqrt(prevVx * prevVx + prevVy * prevVy);

    if (newSpeed > maxVel && newSpeed > prevSpeed) {
      // Clamp to the larger of maxVel and the original speed (never reduce)
      const clampTo = Math.max(maxVel, prevSpeed);
      const scale = clampTo / newSpeed;
      player.velocity.x *= scale;
      player.velocity.y *= scale;
    }

    return force;
  }

  /** Get zones overlapping a given bounds */
  getOverlappingZones(bounds: Rect): CurrentZone[] {
    return this.zones.filter(
      (z) => z.active && aabbOverlap(bounds, z.rect),
    );
  }

  /** Update particle effects for visible current zones */
  updateParticles(dt: number, particleSystem: ParticleSystem, cameraRect: Rect): void {
    this.particleTimer += dt * this.params.particleDensity;

    const SPAWN_INTERVAL = 0.08; // Seconds between particle spawns per visible zone

    while (this.particleTimer >= SPAWN_INTERVAL) {
      this.particleTimer -= SPAWN_INTERVAL;

      for (const zone of this.zones) {
        if (!zone.active) continue;

        // Skip zones not visible
        if (!aabbOverlap(zone.rect, cameraRect)) continue;

        // Skip inactive gusts (but allow telegraph particles)
        const effectiveStrength = this.getEffectiveStrength(zone);
        if (effectiveStrength === 0) continue;

        const strengthRatio = effectiveStrength / zone.strength;

        // Spawn position: random within zone
        const px = zone.rect.x + Math.random() * zone.rect.width;
        const py = zone.rect.y + Math.random() * zone.rect.height;

        // Direction for particle velocity
        const entityCenter: Vec2 = { x: px, y: py };
        const dir = this.getForceDirection(zone, entityCenter);
        const speedFactor = effectiveStrength * 0.3;

        particleSystem.emit({
          x: px,
          y: py,
          count: 1,
          speedMin: speedFactor * 0.5,
          speedMax: speedFactor * 1.0,
          angleMin: Math.atan2(dir.y, dir.x) - 0.2,
          angleMax: Math.atan2(dir.y, dir.x) + 0.2,
          lifeMin: 0.4,
          lifeMax: 0.8,
          sizeMin: 2,
          sizeMax: 3,
          colors: zone.type === "jet"
            ? ["#0ea5e9", "#38bdf8"]
            : ["#38bdf8", "#7dd3fc"],
          gravity: 0,
        });

        // Stronger zones get more particles
        if (strengthRatio > 0.5 && Math.random() < 0.3) {
          particleSystem.emit({
            x: px + (Math.random() - 0.5) * 20,
            y: py + (Math.random() - 0.5) * 20,
            count: 1,
            speedMin: speedFactor * 0.3,
            speedMax: speedFactor * 0.7,
            angleMin: Math.atan2(dir.y, dir.x) - 0.3,
            angleMax: Math.atan2(dir.y, dir.x) + 0.3,
            lifeMin: 0.3,
            lifeMax: 0.6,
            sizeMin: 1,
            sizeMax: 2,
            colors: ["#bae6fd"],
            gravity: 0,
          });
        }
      }
    }
  }

  /** Render current flow visual effects (in-world arrows/streaks) */
  renderFlow(ctx: CanvasRenderingContext2D): void {
    for (const zone of this.zones) {
      if (!zone.active) continue;

      const effectiveStrength = this.getEffectiveStrength(zone);
      const strengthRatio = zone.strength > 0 ? effectiveStrength / zone.strength : 0;
      if (strengthRatio < 0.01) continue;

      const lines = this.flowLines.get(zone.id);
      if (!lines) continue;

      ctx.save();

      if (zone.type === "whirlpool") {
        this.renderWhirlpoolFlow(ctx, zone, strengthRatio);
      } else {
        this.renderDirectionalFlow(ctx, zone, lines, strengthRatio);
      }

      ctx.restore();
    }
  }

  /** Render directional flow lines for stream/gust/jet */
  private renderDirectionalFlow(
    ctx: CanvasRenderingContext2D,
    zone: CurrentZone,
    lines: FlowLine[],
    strengthRatio: number,
  ): void {
    const dir = zone.direction;
    const angle = Math.atan2(dir.y, dir.x);
    const speed = zone.strength * 0.002; // Animation speed

    const baseAlpha = zone.type === "jet" ? 0.45 : 0.3;
    const alpha = baseAlpha * strengthRatio;
    const color = zone.type === "jet" ? "#0ea5e9" : "#38bdf8";

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = zone.type === "jet" ? 1.5 : 1;

    for (const line of lines) {
      // Animate position along direction
      const t = (line.phase + this.time * speed) % 1;

      // World position within zone
      const wx = zone.rect.x + line.offsetX * zone.rect.width;
      const wy = zone.rect.y + line.offsetY * zone.rect.height;

      // Offset along direction based on animation time
      const animOffsetX = dir.x * t * zone.rect.width * 0.3;
      const animOffsetY = dir.y * t * zone.rect.height * 0.3;

      const px = wx + animOffsetX;
      const py = wy + animOffsetY;

      // Skip if outside zone bounds
      if (
        px < zone.rect.x || px > zone.rect.x + zone.rect.width ||
        py < zone.rect.y || py > zone.rect.y + zone.rect.height
      ) continue;

      // Draw line segment
      const lineLen = zone.type === "jet" ? 12 : 10;
      const endX = px + Math.cos(angle) * lineLen;
      const endY = py + Math.sin(angle) * lineLen;

      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Arrowhead
      const headSize = zone.type === "jet" ? 4 : 3;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - Math.cos(angle - 0.5) * headSize,
        endY - Math.sin(angle - 0.5) * headSize,
      );
      ctx.lineTo(
        endX - Math.cos(angle + 0.5) * headSize,
        endY - Math.sin(angle + 0.5) * headSize,
      );
      ctx.closePath();
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  /** Render whirlpool spiral flow */
  private renderWhirlpoolFlow(
    ctx: CanvasRenderingContext2D,
    zone: CurrentZone,
    strengthRatio: number,
  ): void {
    const cx = zone.rect.x + zone.rect.width / 2;
    const cy = zone.rect.y + zone.rect.height / 2;
    const maxR = Math.min(zone.rect.width, zone.rect.height) / 2;

    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1;

    const numArms = 3;
    const pointsPerArm = 12;
    const rotDir = zone.clockwise ? 1 : -1;

    for (let arm = 0; arm < numArms; arm++) {
      const baseAngle = (arm / numArms) * Math.PI * 2 + this.time * 1.5 * rotDir;

      ctx.beginPath();
      let first = true;

      for (let i = 0; i < pointsPerArm; i++) {
        const t = i / pointsPerArm;
        const r = maxR * (0.2 + t * 0.7);
        const spiralAngle = baseAngle + t * Math.PI * 1.5 * rotDir;
        const px = cx + Math.cos(spiralAngle) * r;
        const py = cy + Math.sin(spiralAngle) * r;

        if (first) {
          ctx.moveTo(px, py);
          first = false;
        } else {
          ctx.lineTo(px, py);
        }
      }

      ctx.globalAlpha = 0.25 * strengthRatio;
      ctx.stroke();
    }

    // Center indicator
    ctx.globalAlpha = 0.15 * strengthRatio;
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#38bdf8";
    ctx.fill();

    ctx.globalAlpha = 1;
  }

  /** Render current zone debug overlays */
  renderDebug(ctx: CanvasRenderingContext2D): void {
    for (const zone of this.zones) {
      if (!zone.active) continue;

      const effectiveStrength = this.getEffectiveStrength(zone);
      const isGustOff = zone.type === "gust" && !zone.gustActive;

      // Zone outline
      ctx.save();
      const typeColor: Record<CurrentType, string> = {
        stream: "rgba(56, 189, 248, 0.25)",
        gust: isGustOff ? "rgba(56, 189, 248, 0.08)" : "rgba(56, 189, 248, 0.2)",
        whirlpool: "rgba(168, 85, 247, 0.2)",
        jet: "rgba(14, 165, 233, 0.3)",
      };

      ctx.fillStyle = typeColor[zone.type];
      ctx.fillRect(zone.rect.x, zone.rect.y, zone.rect.width, zone.rect.height);

      ctx.strokeStyle = isGustOff ? "rgba(56, 189, 248, 0.15)" : "rgba(56, 189, 248, 0.5)";
      ctx.lineWidth = 1;
      ctx.strokeRect(zone.rect.x, zone.rect.y, zone.rect.width, zone.rect.height);

      // Zone label
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "9px monospace";
      ctx.fillText(
        `${zone.type} [${Math.round(effectiveStrength)}]`,
        zone.rect.x + 3,
        zone.rect.y + 10,
      );

      // Direction arrow from center
      if (zone.type !== "whirlpool") {
        const zx = zone.rect.x + zone.rect.width / 2;
        const zy = zone.rect.y + zone.rect.height / 2;
        const arrowLen = 20;
        ctx.strokeStyle = "rgba(251, 191, 36, 0.6)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(zx, zy);
        ctx.lineTo(
          zx + zone.direction.x * arrowLen,
          zy + zone.direction.y * arrowLen,
        );
        ctx.stroke();
      }

      ctx.restore();
    }
  }
}
