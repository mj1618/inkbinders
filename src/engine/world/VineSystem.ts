// VineSystem — pendulum-based vine grapple mechanics for Herbarium Folio biome

import type { Vec2 } from "@/lib/types";

export interface VineAnchor {
  /** Unique ID */
  id: string;
  /** Position of the anchor point (where the vine hangs from) */
  position: Vec2;
  /** Rope length (distance from anchor to the player when attached) */
  ropeLength: number;
  /** Whether this vine can be used */
  active: boolean;
  /** Visual: vine type affects rendering */
  type: "hanging" | "ceiling" | "branch";
}

export interface VineParams {
  /** Max distance from player to anchor to allow attachment */
  attachRange: number;
  /** Gravity while swinging (px/s²) */
  swingGravity: number;
  /** Angular damping (0 = no damping, 1 = instant stop) */
  angularDamping: number;
  /** Speed boost multiplier on release */
  releaseBoost: number;
  /** Whether the player can adjust rope length while swinging */
  canAdjustLength: boolean;
  /** Rate of rope length change (px/s) */
  ropeLengthAdjustSpeed: number;
  /** Minimum rope length */
  minRopeLength: number;
  /** Maximum rope length */
  maxRopeLength: number;
  /** Whether jump while swinging detaches */
  jumpDetaches: boolean;
  /** Initial angular velocity factor from player horizontal velocity */
  attachMomentumTransfer: number;
  /** Maximum angular velocity (rad/s) */
  maxAngularVelocity: number;
  /** Whether the player can input horizontal force while swinging */
  canPumpSwing: boolean;
  /** Horizontal pumping force (rad/s²) */
  pumpForce: number;
}

export const DEFAULT_VINE_PARAMS: VineParams = {
  attachRange: 80,
  swingGravity: 800,
  angularDamping: 0.005,
  releaseBoost: 1.2,
  canAdjustLength: true,
  ropeLengthAdjustSpeed: 200,
  minRopeLength: 40,
  maxRopeLength: 200,
  jumpDetaches: true,
  attachMomentumTransfer: 0.8,
  maxAngularVelocity: 8.0,
  canPumpSwing: true,
  pumpForce: 12.0,
};

export class VineSystem {
  params: VineParams;
  anchors: VineAnchor[];

  /** Currently attached vine (null if not swinging) */
  activeVine: VineAnchor | null = null;
  /** Whether the player is currently swinging */
  isSwinging = false;
  /** Current angle from anchor to player (radians, 0 = straight down, positive = right) */
  angle = 0;
  /** Current angular velocity (rad/s) */
  angularVelocity = 0;
  /** Current rope length */
  currentRopeLength = 0;
  /** Computed player position while swinging */
  swingPosition: Vec2 = { x: 0, y: 0 };
  /** Computed player velocity at current swing state (for release) */
  swingVelocity: Vec2 = { x: 0, y: 0 };
  /** Time accumulator for vine sway animation */
  swayTime = 0;

  constructor(anchors: VineAnchor[], params?: Partial<VineParams>) {
    this.anchors = anchors;
    this.params = { ...DEFAULT_VINE_PARAMS, ...params };
  }

  /**
   * Find the nearest attachable vine anchor within range of the player center.
   */
  findNearestAnchor(playerCenter: Vec2): VineAnchor | null {
    let best: VineAnchor | null = null;
    let bestDist = Infinity;

    for (const anchor of this.anchors) {
      if (!anchor.active) continue;
      const dx = playerCenter.x - anchor.position.x;
      const dy = playerCenter.y - anchor.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= this.params.attachRange && dist < bestDist) {
        bestDist = dist;
        best = anchor;
      }
    }

    return best;
  }

  /**
   * Attach the player to a vine anchor.
   * Computes initial angle and angular velocity from player's current velocity.
   */
  attach(anchor: VineAnchor, playerPosition: Vec2, playerVelocity: Vec2): void {
    this.activeVine = anchor;
    this.isSwinging = true;

    // Compute angle from anchor to player center
    const dx = playerPosition.x - anchor.position.x;
    const dy = playerPosition.y - anchor.position.y;
    this.angle = Math.atan2(dx, dy); // atan2(x, y) so 0 = straight down

    // Compute rope length (distance from anchor to player)
    const dist = Math.sqrt(dx * dx + dy * dy);
    this.currentRopeLength = Math.max(
      this.params.minRopeLength,
      Math.min(this.params.maxRopeLength, Math.min(dist, anchor.ropeLength)),
    );

    // Convert player velocity into angular velocity
    // Tangential velocity = vx * cos(angle) - vy * sin(angle)
    const tangentialSpeed =
      playerVelocity.x * Math.cos(this.angle) -
      playerVelocity.y * Math.sin(this.angle);
    this.angularVelocity =
      (tangentialSpeed / this.currentRopeLength) * this.params.attachMomentumTransfer;

    // Clamp angular velocity
    this.angularVelocity = clamp(
      this.angularVelocity,
      -this.params.maxAngularVelocity,
      this.params.maxAngularVelocity,
    );

    // Compute initial swing position
    this.computeSwingState();
  }

  /**
   * Detach from the current vine. Returns the release velocity
   * (swing velocity * releaseBoost).
   */
  detach(): Vec2 {
    const releaseVelocity: Vec2 = {
      x: this.swingVelocity.x * this.params.releaseBoost,
      y: this.swingVelocity.y * this.params.releaseBoost,
    };

    this.isSwinging = false;
    this.activeVine = null;
    this.angle = 0;
    this.angularVelocity = 0;
    this.currentRopeLength = 0;

    return releaseVelocity;
  }

  /**
   * Update the swing physics for one fixed timestep.
   * Returns the new player position.
   */
  update(
    dt: number,
    inputLeft: boolean,
    inputRight: boolean,
    inputUp: boolean,
    inputDown: boolean,
  ): Vec2 {
    if (!this.isSwinging || !this.activeVine) {
      return this.swingPosition;
    }

    // 1. Compute tangential gravity: α = -(g / L) * sin(θ)
    let angularAccel =
      -(this.params.swingGravity / this.currentRopeLength) * Math.sin(this.angle);

    // 2. Add pump input
    if (this.params.canPumpSwing) {
      if (inputRight) angularAccel += this.params.pumpForce;
      if (inputLeft) angularAccel -= this.params.pumpForce;
    }

    // 3. Apply damping
    this.angularVelocity *= 1 - this.params.angularDamping;

    // 4. Integrate angular velocity
    this.angularVelocity += angularAccel * dt;
    this.angularVelocity = clamp(
      this.angularVelocity,
      -this.params.maxAngularVelocity,
      this.params.maxAngularVelocity,
    );

    // 5. Integrate angle
    this.angle += this.angularVelocity * dt;

    // 6. Adjust rope length
    if (this.params.canAdjustLength) {
      if (inputUp) {
        this.currentRopeLength -= this.params.ropeLengthAdjustSpeed * dt;
      }
      if (inputDown) {
        this.currentRopeLength += this.params.ropeLengthAdjustSpeed * dt;
      }
      this.currentRopeLength = clamp(
        this.currentRopeLength,
        this.params.minRopeLength,
        this.params.maxRopeLength,
      );
    }

    // 7-8. Compute position and velocity
    this.computeSwingState();

    return { ...this.swingPosition };
  }

  /**
   * Render all vines (anchors, ropes, visual dressing).
   * Draws in world coordinates (assumes camera transform is already applied to ctx).
   */
  render(
    ctx: CanvasRenderingContext2D,
    showRanges: boolean,
    showArc: boolean,
    playerCenter: Vec2 | null,
  ): void {
    for (const anchor of this.anchors) {
      const ax = anchor.position.x;
      const ay = anchor.position.y;

      // Draw inactive hanging vine from anchor
      if (anchor !== this.activeVine) {
        this.renderDecorativeVine(ctx, anchor);
      }

      // Draw anchor point
      const isNearby = playerCenter
        ? this.distanceTo(playerCenter, anchor.position) <= this.params.attachRange
        : false;
      const pulse = isNearby
        ? 0.5 + 0.5 * Math.sin(this.swayTime * 4)
        : 0.6;

      ctx.save();
      ctx.globalAlpha = anchor.active ? pulse : 0.2;
      ctx.beginPath();
      ctx.arc(ax, ay, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#4ade80";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#1a3a1a";
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.restore();

      // Draw attach range circle
      if (showRanges && anchor.active) {
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.beginPath();
        ctx.arc(ax, ay, this.params.attachRange, 0, Math.PI * 2);
        ctx.strokeStyle = "#4ade80";
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }

    // Draw active vine rope
    if (this.isSwinging && this.activeVine) {
      const ax = this.activeVine.position.x;
      const ay = this.activeVine.position.y;
      const px = this.swingPosition.x;
      const py = this.swingPosition.y;

      const isFast = Math.abs(this.angularVelocity) > 4;
      const ropeColor = isFast ? "#86efac" : "#4ade80";
      const ropeWidth = isFast ? 3 : 2;

      // Draw rope with slight sag (bezier curve)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(ax, ay);

      if (isFast) {
        ctx.lineTo(px, py);
      } else {
        const midX = (ax + px) / 2;
        const midY = (ay + py) / 2;
        const sagAmount = this.currentRopeLength * 0.05;
        ctx.quadraticCurveTo(midX + sagAmount, midY + sagAmount, px, py);
      }

      ctx.strokeStyle = ropeColor;
      ctx.lineWidth = ropeWidth;
      ctx.stroke();
      ctx.restore();

      // Draw swing arc preview
      if (showArc) {
        this.renderSwingArc(ctx);
      }

      // Draw angular velocity readout near vine
      const midX = (ax + px) / 2;
      const midY = (ay + py) / 2;
      ctx.save();
      ctx.fillStyle = "#86efac";
      ctx.font = "10px monospace";
      ctx.fillText(
        `\u03C9: ${this.angularVelocity.toFixed(2)} rad/s`,
        midX + 10,
        midY - 6,
      );
      ctx.fillText(
        `L: ${Math.round(this.currentRopeLength)}px`,
        midX + 10,
        midY + 6,
      );
      ctx.restore();

      // Draw velocity vector at player position
      const velScale = 0.15;
      const vx = this.swingVelocity.x * velScale;
      const vy = this.swingVelocity.y * velScale;
      if (Math.abs(vx) > 1 || Math.abs(vy) > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + vx, py + vy);
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  /** Reset — detach and clear state */
  reset(): void {
    this.isSwinging = false;
    this.activeVine = null;
    this.angle = 0;
    this.angularVelocity = 0;
    this.currentRopeLength = 0;
    this.swingPosition = { x: 0, y: 0 };
    this.swingVelocity = { x: 0, y: 0 };
  }

  // ─── Private Methods ────────────────────────────────────────────────

  private computeSwingState(): void {
    if (!this.activeVine) return;

    // Position: anchor + (sin(θ) * L, cos(θ) * L)
    this.swingPosition = {
      x: this.activeVine.position.x + Math.sin(this.angle) * this.currentRopeLength,
      y: this.activeVine.position.y + Math.cos(this.angle) * this.currentRopeLength,
    };

    // Velocity: tangential velocity from angular motion
    // v_tangential = ω * L
    // direction: perpendicular to the rope (rotated 90° from rope direction)
    this.swingVelocity = {
      x: this.angularVelocity * this.currentRopeLength * Math.cos(this.angle),
      y: -this.angularVelocity * this.currentRopeLength * Math.sin(this.angle),
    };
  }

  private renderDecorativeVine(
    ctx: CanvasRenderingContext2D,
    anchor: VineAnchor,
  ): void {
    const ax = anchor.position.x;
    const ay = anchor.position.y;
    const hangLength = anchor.ropeLength * 0.4;
    const segments = 8;
    const segmentHeight = hangLength / segments;
    const swayOffset = Math.sin(this.swayTime * 0.8 + ax * 0.01) * 3;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(ax, ay);

    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const x = ax + Math.sin(t * Math.PI * 2 + this.swayTime * 0.5) * 4 + swayOffset * t;
      const y = ay + segmentHeight * i;
      ctx.lineTo(x, y);
    }

    ctx.strokeStyle = "#3b6b3b";
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.6;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private renderSwingArc(ctx: CanvasRenderingContext2D): void {
    if (!this.activeVine) return;

    const anchor = this.activeVine;
    const steps = 32;
    const arcAngleRange = Math.PI * 0.8;

    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.beginPath();

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = -arcAngleRange / 2 + t * arcAngleRange;
      const x = anchor.position.x + Math.sin(a) * this.currentRopeLength;
      const y = anchor.position.y + Math.cos(a) * this.currentRopeLength;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.strokeStyle = "#4ade80";
    ctx.setLineDash([3, 5]);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private distanceTo(a: Vec2, b: Vec2): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
