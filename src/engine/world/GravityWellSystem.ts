// GravityWellSystem — localized gravity wells for the Astral Atlas biome

import type { Vec2 } from "@/lib/types";

export interface GravityWell {
  /** Unique ID */
  id: string;
  /** Center position in world space */
  position: Vec2;
  /** Radius of influence (pixels) */
  radius: number;
  /** Strength of the pull/push (px/s² at the center, falls off with distance) */
  strength: number;
  /** Type: attract pulls toward center, repel pushes away */
  type: "attract" | "repel";
  /** Whether the well is currently active */
  active: boolean;
  /** Visual color (derived from type by default) */
  color: string;
}

export interface GravityWellParams {
  /** Global gravity multiplier applied to the entire biome (< 1.0 = low gravity) */
  globalGravityMultiplier: number;
  /** Falloff exponent: force = strength * (1 - (dist/radius)^falloff). Higher = sharper falloff. */
  falloff: number;
  /** Maximum velocity contribution from wells per frame (px/s, capped) */
  maxWellForce: number;
  /** Multiplier for the visual indicator pulse speed */
  pulseSpeed: number;
  /** Whether wells affect dash trajectory */
  affectsDash: boolean;
}

export const DEFAULT_GRAVITY_WELL_PARAMS: GravityWellParams = {
  globalGravityMultiplier: 0.4,
  falloff: 1.5,
  maxWellForce: 400,
  pulseSpeed: 2.0,
  affectsDash: false, // Dash is sacred — immune to wells by default
};

/** Color constants for well types */
const ATTRACT_COLOR = "#818cf8"; // Indigo
const REPEL_COLOR = "#f472b6"; // Pink

export class GravityWellSystem {
  wells: GravityWell[];
  params: GravityWellParams;

  constructor(wells: GravityWell[], params: GravityWellParams) {
    this.wells = wells;
    this.params = params;
  }

  /**
   * Compute the net gravitational force at a given position from all active wells.
   * Returns a Vec2 representing the acceleration to apply this frame.
   */
  computeForce(position: Vec2): Vec2 {
    let fx = 0;
    let fy = 0;

    for (const well of this.wells) {
      if (!well.active) continue;

      const dx = well.position.x - position.x;
      const dy = well.position.y - position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > well.radius || distance < 1) continue;

      const normalizedDist = distance / well.radius;
      const forceMagnitude =
        well.strength * (1 - Math.pow(normalizedDist, this.params.falloff));

      // Normalize direction
      const nx = dx / distance;
      const ny = dy / distance;

      // Attract pulls toward center (+1), repel pushes away (-1)
      const sign = well.type === "attract" ? 1 : -1;

      fx += nx * forceMagnitude * sign;
      fy += ny * forceMagnitude * sign;
    }

    // Clamp total force
    const magnitude = Math.sqrt(fx * fx + fy * fy);
    if (magnitude > this.params.maxWellForce) {
      const scale = this.params.maxWellForce / magnitude;
      fx *= scale;
      fy *= scale;
    }

    return { x: fx, y: fy };
  }

  /**
   * Apply well forces to an entity's velocity.
   * Call this once per update tick.
   */
  applyToVelocity(position: Vec2, velocity: Vec2, dt: number): void {
    const force = this.computeForce(position);
    velocity.x += force.x * dt;
    velocity.y += force.y * dt;
  }

  /**
   * Check if a position is inside any well's radius.
   * Returns the well (or null).
   */
  getWellAt(position: Vec2): GravityWell | null {
    for (const well of this.wells) {
      if (!well.active) continue;
      const dx = well.position.x - position.x;
      const dy = well.position.y - position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= well.radius) return well;
    }
    return null;
  }

  /**
   * Render all wells: pulsing circle outlines, directional indicators, field lines.
   */
  render(
    ctx: CanvasRenderingContext2D,
    camera: { x: number; y: number },
    time: number,
  ): void {
    for (const well of this.wells) {
      if (!well.active) continue;

      const cx = well.position.x;
      const cy = well.position.y;
      const pulse = Math.sin(time * this.params.pulseSpeed * Math.PI * 2);

      // Radial fill showing influence area
      ctx.save();
      const baseAlpha = 0.06 + pulse * 0.02;
      ctx.globalAlpha = baseAlpha;
      ctx.fillStyle = well.color;
      ctx.beginPath();
      ctx.arc(cx, cy, well.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Concentric rings
      const ringCount = 3;
      for (let i = 0; i < ringCount; i++) {
        const phase = ((time * this.params.pulseSpeed + i / ringCount) % 1);
        let ringRadius: number;

        if (well.type === "attract") {
          // Rings shrink inward
          ringRadius = well.radius * (1 - phase);
        } else {
          // Rings expand outward
          ringRadius = well.radius * phase;
        }

        const ringAlpha = 0.15 * (1 - phase);
        ctx.strokeStyle = well.color;
        ctx.globalAlpha = ringAlpha;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Center dot
      ctx.globalAlpha = 0.5 + pulse * 0.2;
      ctx.fillStyle = well.color;
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();

      // Directional arrow particles (small triangles flowing in/out)
      const arrowCount = 6;
      for (let i = 0; i < arrowCount; i++) {
        const angle = (i / arrowCount) * Math.PI * 2;
        const arrowPhase = ((time * this.params.pulseSpeed * 0.7 + i / arrowCount) % 1);
        let arrowDist: number;

        if (well.type === "attract") {
          arrowDist = well.radius * (1 - arrowPhase) * 0.8;
        } else {
          arrowDist = well.radius * arrowPhase * 0.8 + well.radius * 0.1;
        }

        const ax = cx + Math.cos(angle) * arrowDist;
        const ay = cy + Math.sin(angle) * arrowDist;
        const arrowAlpha = 0.3 * (1 - arrowPhase);

        ctx.globalAlpha = arrowAlpha;
        ctx.fillStyle = well.color;
        ctx.beginPath();

        // Small triangle pointing inward (attract) or outward (repel)
        const dir = well.type === "attract" ? angle + Math.PI : angle;
        const arrowSize = 4;
        ctx.moveTo(
          ax + Math.cos(dir) * arrowSize,
          ay + Math.sin(dir) * arrowSize,
        );
        ctx.lineTo(
          ax + Math.cos(dir + 2.5) * arrowSize * 0.6,
          ay + Math.sin(dir + 2.5) * arrowSize * 0.6,
        );
        ctx.lineTo(
          ax + Math.cos(dir - 2.5) * arrowSize * 0.6,
          ay + Math.sin(dir - 2.5) * arrowSize * 0.6,
        );
        ctx.closePath();
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  /**
   * Render a debug overlay: force vectors, radius circles, strength labels.
   */
  renderDebug(
    ctx: CanvasRenderingContext2D,
    camera: { x: number; y: number },
  ): void {
    for (const well of this.wells) {
      if (!well.active) continue;

      const cx = well.position.x;
      const cy = well.position.y;

      // Radius circle
      ctx.save();
      ctx.strokeStyle = well.color;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy, well.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = well.color;
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(
        `${well.type} s=${well.strength} r=${well.radius}`,
        cx,
        cy - well.radius - 6,
      );
      ctx.fillText(well.id, cx, cy + 12);
      ctx.textAlign = "left";

      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  /**
   * Render force vector on player for debug.
   */
  renderForceVector(
    ctx: CanvasRenderingContext2D,
    position: Vec2,
    scale: number = 0.3,
  ): void {
    const force = this.computeForce(position);
    const magnitude = Math.sqrt(force.x * force.x + force.y * force.y);
    if (magnitude < 1) return;

    ctx.save();
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(position.x, position.y);
    ctx.lineTo(position.x + force.x * scale, position.y + force.y * scale);
    ctx.stroke();

    // Arrowhead
    const angle = Math.atan2(force.y, force.x);
    const headLen = 6;
    ctx.beginPath();
    ctx.moveTo(
      position.x + force.x * scale,
      position.y + force.y * scale,
    );
    ctx.lineTo(
      position.x + force.x * scale - Math.cos(angle - 0.4) * headLen,
      position.y + force.y * scale - Math.sin(angle - 0.4) * headLen,
    );
    ctx.moveTo(
      position.x + force.x * scale,
      position.y + force.y * scale,
    );
    ctx.lineTo(
      position.x + force.x * scale - Math.cos(angle + 0.4) * headLen,
      position.y + force.y * scale - Math.sin(angle + 0.4) * headLen,
    );
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
