import type { Vec2, Rect } from "@/lib/types";
import type { Renderer } from "@/engine/core/Renderer";
import { Entity } from "@/engine/entities/Entity";
import type { Damageable } from "./types";

const DEFAULT_GRAVITY = 980;
const HIT_FLASH_FRAMES = 4;
const BOUNCE_FACTOR = 0.3;
const DEATH_SHRINK_FRAMES = 20;
const RESPAWN_FADE_FRAMES = 15;
const KNOCKBACK_FRICTION = 0.95;

export interface TargetDummyConfig {
  position: Vec2;
  health: number;
  color: string;
  respawns: boolean;
  respawnDelay: number;
  patrol: boolean;
  patrolRange: number;
  patrolSpeed: number;
  groundY: number;
  sizeX?: number;
  sizeY?: number;
}

export class TargetDummy extends Entity implements Damageable {
  health: number;
  maxHealth: number;
  knockbackVelocity: Vec2 = { x: 0, y: 0 };
  hitstunFrames = 0;
  invincibilityFrames = 0;
  isAlive = true;

  /** Spawn position for respawning */
  spawnPosition: Vec2;
  /** Whether it respawns */
  respawns: boolean;
  /** Respawn delay in frames */
  respawnDelay: number;
  /** Respawn timer (counts down when dead) */
  respawnTimer = 0;

  /** Patrol behavior */
  patrol: boolean;
  patrolRange: number;
  patrolSpeed: number;
  patrolDirection = 1;

  /** Hit flash timer (frames remaining) */
  hitFlashTimer = 0;

  /** Hitstop: when > 0, the dummy freezes in place */
  hitstopTimer = 0;

  /** Total damage received (for display) */
  totalDamageReceived = 0;

  /** Gravity for knockback arcs */
  gravity = DEFAULT_GRAVITY;

  /** Ground Y position (for landing after knockback) */
  groundY: number;

  /** Main floor Y (fallback when knocked off platforms) */
  mainFloorY = 460;

  /** Whether the dummy is grounded */
  grounded = true;

  /** Death animation progress (0 = alive, 1 = fully shrunk) */
  deathProgress = 0;

  /** Respawn fade-in progress (0 = invisible, 1 = fully visible) */
  respawnFadeIn = 1;

  constructor(config: TargetDummyConfig) {
    super({
      position: { x: config.position.x, y: config.position.y },
      size: { x: config.sizeX ?? 24, y: config.sizeY ?? 40 },
      color: config.color,
    });

    this.health = config.health;
    this.maxHealth = config.health;
    this.spawnPosition = { x: config.position.x, y: config.position.y };
    this.respawns = config.respawns;
    this.respawnDelay = config.respawnDelay;
    this.patrol = config.patrol;
    this.patrolRange = config.patrolRange;
    this.patrolSpeed = config.patrolSpeed;
    this.groundY = config.groundY;
  }

  /** Apply damage and knockback. Returns true if the dummy was hit. */
  takeDamage(damage: number, knockback: Vec2, hitstopFrames: number): boolean {
    if (!this.isAlive || this.invincibilityFrames > 0) return false;

    this.health -= damage;
    this.totalDamageReceived += damage;
    this.hitFlashTimer = HIT_FLASH_FRAMES;
    this.hitstopTimer = hitstopFrames;

    // Store knockback to apply after hitstop ends
    this.knockbackVelocity.x = knockback.x;
    this.knockbackVelocity.y = knockback.y;

    if (this.health <= 0) {
      this.health = 0;
      this.die();
    }

    return true;
  }

  private die(): void {
    this.isAlive = false;
    this.deathProgress = 0;
    if (this.respawns) {
      this.respawnTimer = this.respawnDelay;
    }
  }

  /** Update: apply knockback physics, hitstun, gravity, respawn timer, patrol movement */
  update(dt: number): void {
    this.prevPosition.x = this.position.x;
    this.prevPosition.y = this.position.y;

    if (!this.isAlive) {
      // Death animation
      this.deathProgress = Math.min(1, this.deathProgress + 1 / DEATH_SHRINK_FRAMES);

      // Respawn countdown
      if (this.respawns && this.respawnTimer > 0) {
        this.respawnTimer--;
        if (this.respawnTimer <= 0) {
          this.respawn();
        }
      }
      return;
    }

    // Respawn fade-in
    if (this.respawnFadeIn < 1) {
      this.respawnFadeIn = Math.min(1, this.respawnFadeIn + 1 / RESPAWN_FADE_FRAMES);
    }

    // Tick invincibility
    if (this.invincibilityFrames > 0) {
      this.invincibilityFrames--;
    }

    // Tick hit flash
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer--;
    }

    // Hitstop: freeze completely
    if (this.hitstopTimer > 0) {
      this.hitstopTimer--;
      if (this.hitstopTimer <= 0) {
        // Apply knockback after hitstop ends
        this.grounded = false;
      }
      return;
    }

    // Apply knockback physics
    if (
      Math.abs(this.knockbackVelocity.x) > 1 ||
      Math.abs(this.knockbackVelocity.y) > 1 ||
      !this.grounded
    ) {
      this.position.x += this.knockbackVelocity.x * dt;
      this.position.y += this.knockbackVelocity.y * dt;

      // Apply gravity
      this.knockbackVelocity.y += this.gravity * dt;

      // Friction on X
      this.knockbackVelocity.x *= KNOCKBACK_FRICTION;

      // Check ground collision
      const feetY = this.position.y + this.size.y;
      const effectiveGroundY = feetY > this.groundY + this.size.y ? this.mainFloorY : this.groundY;

      if (feetY >= effectiveGroundY) {
        this.position.y = effectiveGroundY - this.size.y;
        this.grounded = true;

        // Small bounce
        if (Math.abs(this.knockbackVelocity.y) > 50) {
          this.knockbackVelocity.y = -this.knockbackVelocity.y * BOUNCE_FACTOR;
          this.grounded = false;
        } else {
          this.knockbackVelocity.y = 0;
        }
      }

      // Stop X velocity when slow enough and grounded
      if (this.grounded && Math.abs(this.knockbackVelocity.x) < 5) {
        this.knockbackVelocity.x = 0;
      }
    } else {
      // Patrol movement
      if (this.patrol && this.grounded) {
        this.position.x += this.patrolDirection * this.patrolSpeed * dt;

        const distFromSpawn = this.position.x - this.spawnPosition.x;
        if (Math.abs(distFromSpawn) >= this.patrolRange) {
          this.patrolDirection *= -1;
          this.position.x = this.spawnPosition.x + this.patrolDirection * this.patrolRange;
        }
      }
    }

    // Tick hitstun
    if (this.hitstunFrames > 0) {
      this.hitstunFrames--;
    }
  }

  /** Render: colored rect with health bar, hit flash, damage numbers */
  render(renderer: Renderer, interpolation: number): void {
    const pos = this.getInterpolatedPosition(interpolation);

    if (!this.isAlive) {
      // Death animation: shrink and fade
      if (this.deathProgress < 1) {
        const scale = 1 - this.deathProgress;
        const alpha = 1 - this.deathProgress;
        const ctx = renderer.getContext();
        ctx.globalAlpha = alpha;
        const w = this.size.x * scale;
        const h = this.size.y * scale;
        const dx = (this.size.x - w) / 2;
        const dy = this.size.y - h;
        renderer.fillRect(pos.x + dx, pos.y + dy, w, h, this.color);
        ctx.globalAlpha = 1;
      }
      return;
    }

    const ctx = renderer.getContext();

    // Respawn fade-in
    if (this.respawnFadeIn < 1) {
      ctx.globalAlpha = this.respawnFadeIn;
    }

    // Body color
    const bodyColor = this.hitFlashTimer > 0 ? "#ffffff" : this.color;
    renderer.fillRect(pos.x, pos.y, this.size.x, this.size.y, bodyColor);

    // Hitstop glow outline
    if (this.hitstopTimer > 0) {
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.strokeRect(pos.x - 1, pos.y - 1, this.size.x + 2, this.size.y + 2);
    }

    // Health bar
    const barWidth = this.size.x + 8;
    const barHeight = 3;
    const barX = pos.x - 4;
    const barY = pos.y - 8;
    const healthPct = this.health / this.maxHealth;

    // Background
    renderer.fillRect(barX, barY, barWidth, barHeight, "#1c1917");
    // Health fill
    renderer.fillRect(barX, barY, barWidth * healthPct, barHeight, "#ef4444");

    // Hitstop frame counter
    if (this.hitstopTimer > 0) {
      renderer.drawText(
        `STOP ${this.hitstopTimer}`,
        pos.x,
        pos.y - 14,
        "#fbbf24",
        9,
      );
    }

    // Reset alpha
    ctx.globalAlpha = 1;
  }

  /** Render debug info (hitbox outline, knockback vector) */
  renderDebug(ctx: CanvasRenderingContext2D): void {
    if (!this.isAlive) return;

    // Hitbox outline
    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 1;
    ctx.strokeRect(this.position.x, this.position.y, this.size.x, this.size.y);

    // Knockback velocity vector
    if (
      Math.abs(this.knockbackVelocity.x) > 5 ||
      Math.abs(this.knockbackVelocity.y) > 5
    ) {
      const cx = this.position.x + this.size.x / 2;
      const cy = this.position.y + this.size.y / 2;
      const scale = 0.05;
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(
        cx + this.knockbackVelocity.x * scale,
        cy + this.knockbackVelocity.y * scale,
      );
      ctx.stroke();
    }
  }

  /** Respawn at original position */
  private respawn(): void {
    this.isAlive = true;
    this.health = this.maxHealth;
    this.position.x = this.spawnPosition.x;
    this.position.y = this.spawnPosition.y;
    this.prevPosition.x = this.spawnPosition.x;
    this.prevPosition.y = this.spawnPosition.y;
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.knockbackVelocity.x = 0;
    this.knockbackVelocity.y = 0;
    this.hitstunFrames = 0;
    this.hitstopTimer = 0;
    this.hitFlashTimer = 0;
    this.invincibilityFrames = 0;
    this.grounded = true;
    this.deathProgress = 0;
    this.respawnFadeIn = 0;
    this.patrolDirection = 1;
  }

  /** Reset to spawn state */
  resetFull(): void {
    this.respawn();
    this.totalDamageReceived = 0;
  }
}
