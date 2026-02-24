import type { Vec2, Rect } from "@/lib/types";
import type { Platform } from "@/engine/physics/TileMap";
import { TileMap } from "@/engine/physics/TileMap";
import type { Obstacle } from "@/engine/physics/Obstacles";
import type { ParticleSystem } from "@/engine/core/ParticleSystem";
import { aabbOverlap } from "@/engine/physics/AABB";

// ─── Data Structures ───────────────────────────────────────────────

export interface RedactionTarget {
  /** The obstacle being targeted */
  obstacle: Obstacle;
  /** Distance from player center to obstacle center */
  distance: number;
  /** Whether this obstacle is in the player's aim direction */
  inAimDirection: boolean;
}

export interface ActiveRedaction {
  /** The obstacle being redacted */
  obstacle: Obstacle;
  /** Remaining duration in seconds */
  remainingTime: number;
  /** Total duration for visual fade calculation */
  totalDuration: number;
  /** The "redaction mark" visual — expands outward during activation */
  visualProgress: number; // 0 = just activated, 1 = fully redacted
  /** Reference to exclusion zone rect (for solid obstacles) */
  exclusionRect: Rect | null;
}

export interface RedactionParams {
  /** Maximum distance to detect redactable obstacles (px) */
  maxRedactionRange: number;
  /** Duration the obstacle stays redacted (seconds) */
  redactionDuration: number;
  /** Cooldown after a redaction expires before another can be placed (seconds) */
  redactionCooldown: number;
  /** Maximum number of simultaneously active redactions */
  maxActiveRedactions: number;
  /** Speed of the "redaction mark" visual expanding (0-1 per second) */
  redactionVisualSpeed: number;
  /** Aim cone half-angle in radians — how wide the targeting cone is */
  aimConeHalfAngle: number;
  /** Whether the ability is unlocked/available */
  enabled: boolean;
}

export const DEFAULT_REDACTION_PARAMS: RedactionParams = {
  maxRedactionRange: 200,
  redactionDuration: 5.0,
  redactionCooldown: 3.0,
  maxActiveRedactions: 2,
  redactionVisualSpeed: 6.0,
  aimConeHalfAngle: Math.PI / 4, // 45° half-angle = 90° cone
  enabled: true,
};

// ─── Visual Colors ──────────────────────────────────────────────────

const REDACTION_COLORS = {
  targetOutline: "rgba(239, 68, 68, 0.4)",
  targetHighlight: "rgba(239, 68, 68, 0.7)",
  redactionInk: "#1a1a1a",
  timerBar: "#ef4444",
  aimCone: "rgba(239, 68, 68, 0.1)",
  crosshair: "#ef4444",
  activationParticles: ["#1a1a1a", "#374151", "#4b5563"],
  dripParticles: ["#374151", "#1f2937"],
  expirationParticles: ["#6b7280", "#9ca3af"],
  rangeCircle: "rgba(239, 68, 68, 0.12)",
};

// ─── Redaction Class ────────────────────────────────────────────────

export class Redaction {
  params: RedactionParams;

  /** All detected obstacles in range */
  detectedObstacles: RedactionTarget[] = [];

  /** The currently highlighted (best) target — null if none in range */
  targetedObstacle: RedactionTarget | null = null;

  /** Currently active redactions */
  activeRedactions: ActiveRedaction[] = [];

  /** Cooldown timer (seconds remaining) */
  cooldownTimer = 0;

  /** Optional particle system for visual effects */
  particleSystem: ParticleSystem | null = null;

  /** TileMap reference for exclusion zones */
  private tileMap: TileMap | null = null;

  /** Mapping from obstacle IDs to their TileMap platforms (for solid obstacles) */
  private obstaclePlatformMap = new Map<string, Platform>();

  /** Internal pulse timer for animations */
  private pulseTimer = 0;

  constructor(params?: Partial<RedactionParams>) {
    this.params = { ...DEFAULT_REDACTION_PARAMS, ...params };
  }

  /** Whether the ability can be activated right now */
  get canActivate(): boolean {
    return (
      this.params.enabled &&
      this.targetedObstacle !== null &&
      this.cooldownTimer <= 0 &&
      this.activeRedactions.length < this.params.maxActiveRedactions
    );
  }

  /** Set the TileMap reference for exclusion zone management */
  setTileMap(tileMap: TileMap): void {
    this.tileMap = tileMap;
  }

  /** Register a solid obstacle's corresponding TileMap platform */
  registerObstaclePlatform(obstacleId: string, platform: Platform): void {
    this.obstaclePlatformMap.set(obstacleId, platform);
  }

  /**
   * Scan for redactable obstacles near the player.
   * Uses player position and facing/aim direction to rank targets.
   * Call every frame.
   */
  scanForTargets(
    playerCenter: Vec2,
    aimDirection: Vec2,
    obstacles: Obstacle[],
  ): void {
    if (!this.params.enabled) {
      this.detectedObstacles = [];
      this.targetedObstacle = null;
      return;
    }

    const range = this.params.maxRedactionRange;
    const detected: RedactionTarget[] = [];

    for (const obs of obstacles) {
      // Skip already-redacted obstacles
      if (!obs.active) continue;
      // Skip obstacles that are already being redacted
      if (this.activeRedactions.some((ar) => ar.obstacle === obs)) continue;

      const obsCenterX = obs.rect.x + obs.rect.width / 2;
      const obsCenterY = obs.rect.y + obs.rect.height / 2;
      const dx = obsCenterX - playerCenter.x;
      const dy = obsCenterY - playerCenter.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > range) continue;

      // Check if obstacle is within the aim cone
      const inAimDirection = this.isInAimCone(
        aimDirection,
        { x: dx, y: dy },
        distance,
      );

      detected.push({ obstacle: obs, distance, inAimDirection });
    }

    this.detectedObstacles = detected;

    // Pick the best target: prefer in-cone obstacles, then nearest
    const inCone = detected.filter((t) => t.inAimDirection);
    if (inCone.length > 0) {
      inCone.sort((a, b) => a.distance - b.distance);
      this.targetedObstacle = inCone[0];
    } else {
      this.targetedObstacle = null;
    }
  }

  /**
   * Activate redaction on the targeted obstacle.
   * Returns true if activation succeeded.
   */
  activate(): boolean {
    if (!this.canActivate || !this.targetedObstacle) return false;

    const obs = this.targetedObstacle.obstacle;

    // Mark obstacle as inactive (redacted)
    obs.active = false;

    // Create the exclusion zone for solid obstacles
    let exclusionRect: Rect | null = null;
    if (obs.solid && this.tileMap) {
      const platform = this.obstaclePlatformMap.get(obs.id);
      if (platform) {
        exclusionRect = { ...obs.rect };
        this.tileMap.addExclusionZone(exclusionRect, [platform]);
      }
    }

    const activeRedaction: ActiveRedaction = {
      obstacle: obs,
      remainingTime: this.params.redactionDuration,
      totalDuration: this.params.redactionDuration,
      visualProgress: 0,
      exclusionRect,
    };

    this.activeRedactions.push(activeRedaction);

    // Emit activation particles
    this.emitActivationParticles(obs.rect);

    return true;
  }

  /**
   * Update timers (active redaction durations, cooldown, visual progress).
   * Handles restoring obstacles when redaction expires.
   * Call every physics frame.
   */
  update(dt: number): void {
    this.pulseTimer += dt;

    // Update cooldown
    if (this.cooldownTimer > 0) {
      this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);
    }

    // Update active redactions
    for (let i = this.activeRedactions.length - 1; i >= 0; i--) {
      const ar = this.activeRedactions[i];

      // Advance visual progress
      if (ar.visualProgress < 1) {
        ar.visualProgress = Math.min(
          1,
          ar.visualProgress + this.params.redactionVisualSpeed * dt,
        );
      }

      ar.remainingTime -= dt;

      // Emit occasional drip particles
      if (ar.visualProgress >= 1 && Math.random() < dt * 1.5) {
        this.emitDripParticle(ar.obstacle.rect);
      }

      // Check for expiration
      if (ar.remainingTime <= 0) {
        this.expireRedaction(ar);
        this.activeRedactions.splice(i, 1);
      }
    }
  }

  /**
   * Get ejection position if player is inside a restoring barrier.
   * Call after an expiration to check if the player needs to be pushed out.
   */
  getEjectionForObstacle(
    obstacle: Obstacle,
    playerPos: Vec2,
    playerSize: Vec2,
  ): Vec2 | null {
    if (!obstacle.solid) return null;

    const playerBounds: Rect = {
      x: playerPos.x,
      y: playerPos.y,
      width: playerSize.x,
      height: playerSize.y,
    };

    if (!aabbOverlap(playerBounds, obstacle.rect)) return null;

    // Push player to nearest clear side
    const playerCenterX = playerPos.x + playerSize.x / 2;
    const obsCenterX = obstacle.rect.x + obstacle.rect.width / 2;
    const playerCenterY = playerPos.y + playerSize.y / 2;
    const obsCenterY = obstacle.rect.y + obstacle.rect.height / 2;

    const corrected = { x: playerPos.x, y: playerPos.y };

    // Determine primary push direction (horizontal vs vertical)
    const overlapX = Math.min(
      playerPos.x + playerSize.x - obstacle.rect.x,
      obstacle.rect.x + obstacle.rect.width - playerPos.x,
    );
    const overlapY = Math.min(
      playerPos.y + playerSize.y - obstacle.rect.y,
      obstacle.rect.y + obstacle.rect.height - playerPos.y,
    );

    if (overlapX < overlapY) {
      // Push horizontally
      if (playerCenterX < obsCenterX) {
        corrected.x = obstacle.rect.x - playerSize.x;
      } else {
        corrected.x = obstacle.rect.x + obstacle.rect.width;
      }
    } else {
      // Push vertically
      if (playerCenterY < obsCenterY) {
        corrected.y = obstacle.rect.y - playerSize.y;
      } else {
        corrected.y = obstacle.rect.y + obstacle.rect.height;
      }
    }

    return corrected;
  }

  /**
   * Render redaction visuals in world/camera space.
   * Call during the world-layer render pass.
   */
  render(ctx: CanvasRenderingContext2D): void {
    if (!this.params.enabled) return;

    const pulse = Math.sin(this.pulseTimer * 4) * 0.15 + 0.85;

    // Render targeting outlines on all detected obstacles
    for (const target of this.detectedObstacles) {
      const isTargeted = target === this.targetedObstacle;
      this.renderTargetOutline(ctx, target.obstacle.rect, isTargeted, pulse);
    }

    // Render active redaction marks
    for (const ar of this.activeRedactions) {
      this.renderActiveRedaction(ctx, ar);
    }
  }

  // ─── Private Methods ──────────────────────────────────────────────

  private isInAimCone(
    aimDir: Vec2,
    toObstacle: Vec2,
    distance: number,
  ): boolean {
    if (distance < 1) return true; // On top of it

    // Normalize the toObstacle vector
    const nx = toObstacle.x / distance;
    const ny = toObstacle.y / distance;

    // Dot product gives cosine of angle between aim and direction to obstacle
    const dot = aimDir.x * nx + aimDir.y * ny;
    const cosThreshold = Math.cos(this.params.aimConeHalfAngle);

    return dot >= cosThreshold;
  }

  private expireRedaction(ar: ActiveRedaction): void {
    // Restore obstacle
    ar.obstacle.active = true;

    // Remove exclusion zone for solid obstacles
    if (ar.exclusionRect && this.tileMap) {
      this.tileMap.removeExclusionZone(ar.exclusionRect);
    }

    // Start cooldown
    this.cooldownTimer = this.params.redactionCooldown;

    // Emit expiration particles
    this.emitExpirationParticles(ar.obstacle.rect);
  }

  private renderTargetOutline(
    ctx: CanvasRenderingContext2D,
    rect: Rect,
    isTargeted: boolean,
    pulse: number,
  ): void {
    ctx.save();

    if (isTargeted) {
      // Bright pulsing outline
      ctx.strokeStyle = REDACTION_COLORS.targetHighlight;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.7 * pulse;
      ctx.setLineDash([]);
      ctx.strokeRect(rect.x - 2, rect.y - 2, rect.width + 4, rect.height + 4);

      // Crosshair at center
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      const size = 6;
      ctx.strokeStyle = REDACTION_COLORS.crosshair;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(cx - size, cy);
      ctx.lineTo(cx + size, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - size);
      ctx.lineTo(cx, cy + size);
      ctx.stroke();
    } else {
      // Thin red dashed outline
      ctx.strokeStyle = REDACTION_COLORS.targetOutline;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(rect.x - 1, rect.y - 1, rect.width + 2, rect.height + 2);
    }

    ctx.setLineDash([]);
    ctx.restore();
  }

  private renderActiveRedaction(
    ctx: CanvasRenderingContext2D,
    ar: ActiveRedaction,
  ): void {
    const rect = ar.obstacle.rect;
    const isExpiring = ar.remainingTime <= 1.0;
    const timeRatio = ar.remainingTime / ar.totalDuration;

    ctx.save();

    // Draw the ghost of the original obstacle (always visible underneath)
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = ar.obstacle.redactedColor;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

    // Draw the "redaction mark" — expanding from center during activation
    const progress = ar.visualProgress;
    if (progress > 0) {
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;

      // Calculate the covered area based on visual progress
      const coveredW = rect.width * progress;
      const coveredH = rect.height * progress;
      const coveredX = cx - coveredW / 2;
      const coveredY = cy - coveredH / 2;

      // Flicker when expiring
      if (isExpiring) {
        const flickerAlpha = 0.5 + Math.random() * 0.3;
        ctx.globalAlpha = flickerAlpha;
      } else {
        ctx.globalAlpha = 0.8;
      }

      ctx.fillStyle = REDACTION_COLORS.redactionInk;
      ctx.fillRect(coveredX, coveredY, coveredW, coveredH);

      // Subtle "ink texture" lines across the redaction mark
      if (progress >= 1) {
        ctx.globalAlpha = isExpiring ? 0.15 : 0.25;
        ctx.strokeStyle = "#374151";
        ctx.lineWidth = 1;
        const lineSpacing = 6;
        for (
          let y = rect.y + lineSpacing;
          y < rect.y + rect.height;
          y += lineSpacing
        ) {
          ctx.beginPath();
          ctx.moveTo(rect.x + 2, y);
          ctx.lineTo(rect.x + rect.width - 2, y);
          ctx.stroke();
        }
      }
    }

    // Timer bar below the redaction mark
    const barHeight = 3;
    const barY = rect.y + rect.height + 4;
    const barWidth = rect.width;

    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#374151";
    ctx.fillRect(rect.x, barY, barWidth, barHeight);

    ctx.globalAlpha = 0.9;
    ctx.fillStyle = REDACTION_COLORS.timerBar;
    ctx.fillRect(rect.x, barY, barWidth * timeRatio, barHeight);

    ctx.restore();
  }

  private emitActivationParticles(rect: Rect): void {
    if (!this.particleSystem) return;

    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;

    this.particleSystem.emit({
      x: cx,
      y: cy,
      count: 12,
      speedMin: 30,
      speedMax: 100,
      angleMin: 0,
      angleMax: Math.PI * 2,
      lifeMin: 0.2,
      lifeMax: 0.5,
      sizeMin: 2,
      sizeMax: 5,
      colors: REDACTION_COLORS.activationParticles,
      gravity: 50,
    });
  }

  private emitDripParticle(rect: Rect): void {
    if (!this.particleSystem) return;

    const x = rect.x + Math.random() * rect.width;
    const y = rect.y + rect.height;

    this.particleSystem.emit({
      x,
      y,
      count: 1,
      speedMin: 5,
      speedMax: 20,
      angleMin: Math.PI / 4,
      angleMax: (3 * Math.PI) / 4, // Downward
      lifeMin: 0.3,
      lifeMax: 0.8,
      sizeMin: 1,
      sizeMax: 3,
      colors: REDACTION_COLORS.dripParticles,
      gravity: 100,
    });
  }

  private emitExpirationParticles(rect: Rect): void {
    if (!this.particleSystem) return;

    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;

    this.particleSystem.emit({
      x: cx,
      y: cy,
      count: 10,
      speedMin: 40,
      speedMax: 120,
      angleMin: 0,
      angleMax: Math.PI * 2,
      lifeMin: 0.15,
      lifeMax: 0.4,
      sizeMin: 2,
      sizeMax: 5,
      colors: REDACTION_COLORS.expirationParticles,
      gravity: 80,
    });
  }
}

// ─── Aim Direction Helper ───────────────────────────────────────────

/**
 * Compute the aim direction from held directional input.
 * Falls back to facing direction if no directional input is held.
 */
export function getAimDirection(
  isHeldLeft: boolean,
  isHeldRight: boolean,
  isHeldUp: boolean,
  isHeldDown: boolean,
  facingRight: boolean,
): Vec2 {
  let dx = 0;
  let dy = 0;
  if (isHeldLeft) dx -= 1;
  if (isHeldRight) dx += 1;
  if (isHeldUp) dy -= 1;
  if (isHeldDown) dy += 1;

  if (dx === 0 && dy === 0) {
    dx = facingRight ? 1 : -1;
  }

  const len = Math.sqrt(dx * dx + dy * dy);
  return { x: dx / len, y: dy / len };
}
