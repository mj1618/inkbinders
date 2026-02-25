import { Entity } from "./Entity";
import type { StateMachine } from "@/engine/states/StateMachine";
import type { TileMap } from "@/engine/physics/TileMap";
import type { ParticleSystem } from "@/engine/core/ParticleSystem";
import type { ScreenShake } from "@/engine/core/ScreenShake";
import { RenderConfig } from "@/engine/core/RenderConfig";
import { AnimationController } from "@/engine/core/AnimationController";
import { AssetManager } from "@/engine/core/AssetManager";
import type { SpriteSheetConfig, AnimationDef } from "@/engine/core/SpriteSheet";
import type { Damageable } from "@/engine/combat/types";
import type { Renderer } from "@/engine/core/Renderer";
import type { Vec2, Rect } from "@/lib/types";

const HIT_FLASH_FRAMES = 4;
const KNOCKBACK_FRICTION = 0.92;
const DEATH_SHRINK_FRAMES = 20;
const RESPAWN_FADE_FRAMES = 15;
const INVINCIBILITY_ON_HIT = 10;

export interface EnemyConfig {
  position: Vec2;
  size: Vec2;
  color: string;
  health: number;
  contactDamage: number;
  respawns: boolean;
  respawnDelay: number;
}

export interface PlayerRef {
  position: Vec2;
  velocity: Vec2;
  size: Vec2;
  getBounds(): Rect;
  facingRight: boolean;
  grounded: boolean;
  isDashing: boolean;
  stateMachine: { getCurrentState(): string };
}

export abstract class Enemy extends Entity implements Damageable {
  // --- Damageable ---
  health: number;
  maxHealth: number;
  knockbackVelocity: Vec2 = { x: 0, y: 0 };
  hitstunFrames = 0;
  invincibilityFrames = 0;
  isAlive = true;

  // --- Physics ---
  tileMap: TileMap | null = null;
  grounded = false;
  facingRight = true;
  gravity = 980;
  maxFallSpeed = 600;

  // --- Combat ---
  contactDamage: number;
  contactKnockback = 300;
  hitstopTimer = 0;

  // --- Visual ---
  hitFlashTimer = 0;
  deathProgress = 0;
  respawnFadeIn = 1;

  // --- Respawn ---
  spawnPosition: Vec2;
  respawns: boolean;
  respawnDelay: number;
  respawnTimer = 0;

  // --- State Machine ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abstract stateMachine: StateMachine<any>;

  // --- Player reference (set externally) ---
  playerRef: PlayerRef | null = null;

  // --- Systems (set externally) ---
  particleSystem: ParticleSystem | null = null;
  screenShake: ScreenShake | null = null;

  // --- AI toggle ---
  aiEnabled = true;

  // --- Sprite Animation ---
  protected animControllers = new Map<string, AnimationController>();
  protected activeAnimController: AnimationController | null = null;
  protected spritesReady = false;
  protected stateToAnimation: Record<string, { sheetId: string; animName: string }> = {};

  constructor(config: EnemyConfig) {
    super({
      position: { x: config.position.x, y: config.position.y },
      size: { x: config.size.x, y: config.size.y },
      color: config.color,
    });

    this.health = config.health;
    this.maxHealth = config.health;
    this.contactDamage = config.contactDamage;
    this.spawnPosition = { x: config.position.x, y: config.position.y };
    this.respawns = config.respawns;
    this.respawnDelay = config.respawnDelay;
  }

  /** Load sprite sheets and create animation controllers (async — sprites load in background) */
  protected initSprites(
    configs: SpriteSheetConfig[],
    animations: Record<string, AnimationDef[]>,
    stateToAnim: Record<string, { sheetId: string; animName: string }>,
  ): void {
    this.stateToAnimation = stateToAnim;
    const assetManager = AssetManager.getInstance();
    assetManager.loadAll(configs).then(() => {
      for (const config of configs) {
        const sheet = assetManager.getSpriteSheet(config.id);
        if (sheet) {
          const anims = animations[config.id];
          if (anims) {
            for (const anim of anims) {
              sheet.addAnimation(anim);
            }
          }
          this.animControllers.set(config.id, new AnimationController(sheet));
        }
      }
      this.spritesReady = true;
    }).catch(() => {
      // Sprite loading failed (e.g., headless test environment without DOM Image)
      // Enemy falls back to rectangle rendering gracefully
    });
  }

  /** Update active animation controller based on current state machine state */
  protected updateAnimation(dt: number): void {
    if (!this.spritesReady) return;
    // Freeze animation during hitstop to match the visual freeze
    if (this.hitstopTimer > 0) return;
    const state = this.stateMachine.getCurrentState();
    const mapping = this.stateToAnimation[state];
    if (mapping) {
      const controller = this.animControllers.get(mapping.sheetId);
      if (controller) {
        this.activeAnimController = controller;
        controller.play(mapping.animName);
        controller.update(dt);
      }
    }
  }

  /** Draw the sprite body at the given position (used by subclass render methods) */
  protected renderSpriteBody(ctx: CanvasRenderingContext2D, pos: Vec2): void {
    if (!this.spritesReady || !this.activeAnimController) return;
    const sheet = this.activeAnimController.getSpriteSheet();
    if (!sheet.isLoaded()) return;

    const spriteOffsetX = (sheet.config.frameWidth - this.size.x) / 2;
    const spriteOffsetY = sheet.config.frameHeight - this.size.y;
    this.activeAnimController.draw(
      ctx,
      pos.x - spriteOffsetX,
      pos.y - spriteOffsetY,
      !this.facingRight,
    );
  }

  canBeDamaged(): boolean {
    return this.isAlive && this.invincibilityFrames <= 0 && this.hitstopTimer <= 0;
  }

  takeDamage(damage: number, knockback: Vec2, hitstopFrames: number): boolean {
    if (!this.canBeDamaged()) return false;

    this.health -= damage;
    this.hitFlashTimer = HIT_FLASH_FRAMES;
    this.hitstopTimer = hitstopFrames;
    this.knockbackVelocity.x = knockback.x;
    this.knockbackVelocity.y = knockback.y;
    this.invincibilityFrames = INVINCIBILITY_ON_HIT;

    if (this.health <= 0) {
      this.health = 0;
      this.die();
    } else {
      // Enter hurt state
      this.hitstunFrames = hitstopFrames + 8; // hitstop + recovery
    }

    return true;
  }

  private die(): void {
    this.isAlive = false;
    this.active = false;
    this.deathProgress = 0;
    this.spawnDeathParticles();
    if (this.respawns) {
      this.respawnTimer = this.respawnDelay;
    }
  }

  canSeePlayer(detectionRange: number): boolean {
    if (!this.playerRef) return false;
    return this.distanceToPlayer() <= detectionRange;
  }

  distanceToPlayer(): number {
    if (!this.playerRef) return Infinity;
    const dx = this.getCenterX() - (this.playerRef.position.x + this.playerRef.size.x / 2);
    const dy = this.getCenterY() - (this.playerRef.position.y + this.playerRef.size.y / 2);
    return Math.sqrt(dx * dx + dy * dy);
  }

  directionToPlayer(): number {
    if (!this.playerRef) return 0;
    const playerCX = this.playerRef.position.x + this.playerRef.size.x / 2;
    const myCX = this.getCenterX();
    return playerCX > myCX ? 1 : -1;
  }

  getCenterX(): number {
    return this.position.x + this.size.x / 2;
  }

  getCenterY(): number {
    return this.position.y + this.size.y / 2;
  }

  hasGroundAhead(direction: number): boolean {
    if (!this.tileMap) return true;
    // Probe 1px below and 1px ahead of the leading edge
    const probeX = direction > 0
      ? this.position.x + this.size.x + 1
      : this.position.x - 2;
    const probeY = this.position.y + this.size.y + 1;
    const probe: Rect = { x: probeX, y: probeY, width: 1, height: 1 };
    return this.tileMap.checkCollision(probe) !== null;
  }

  updateBase(dt: number): void {
    this.prevPosition.x = this.position.x;
    this.prevPosition.y = this.position.y;

    // 1. Hitstop: freeze completely
    if (this.hitstopTimer > 0) {
      this.hitstopTimer--;
      return;
    }

    // 2. Dead: handle respawn
    if (!this.isAlive) {
      this.deathProgress = Math.min(1, this.deathProgress + 1 / DEATH_SHRINK_FRAMES);
      if (this.respawns && this.respawnTimer > 0) {
        this.respawnTimer--;
        if (this.respawnTimer <= 0) {
          this.reset();
        }
      }
      return;
    }

    // 3. Respawn fade-in
    if (this.respawnFadeIn < 1) {
      this.respawnFadeIn = Math.min(1, this.respawnFadeIn + 1 / RESPAWN_FADE_FRAMES);
    }

    // 4. Tick timers
    if (this.invincibilityFrames > 0) this.invincibilityFrames--;
    if (this.hitFlashTimer > 0) this.hitFlashTimer--;

    // 5. Hitstun: apply knockback, skip AI
    if (this.hitstunFrames > 0) {
      this.hitstunFrames--;
      // Apply knockback with friction
      this.position.x += this.knockbackVelocity.x * dt;
      this.position.y += this.knockbackVelocity.y * dt;
      this.knockbackVelocity.x *= KNOCKBACK_FRICTION;
      this.knockbackVelocity.y += this.gravity * dt;

      // Resolve collisions
      if (this.tileMap) {
        const result = this.tileMap.resolveCollisions(this);
        this.grounded = result.grounded;
        if (this.grounded) {
          this.knockbackVelocity.y = 0;
        }
      }

      // Stop knockback when slow
      if (this.grounded && Math.abs(this.knockbackVelocity.x) < 5) {
        this.knockbackVelocity.x = 0;
      }
      return;
    }

    // 6. Run AI (state machine)
    if (this.aiEnabled) {
      this.stateMachine.update(dt);
    }

    // 7. Apply gravity
    this.velocity.y += this.gravity * dt;
    if (this.velocity.y > this.maxFallSpeed) {
      this.velocity.y = this.maxFallSpeed;
    }

    // 8. Integrate position
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    // 9. Resolve collisions
    if (this.tileMap) {
      const result = this.tileMap.resolveCollisions(this);
      this.grounded = result.grounded;
    }
  }

  renderBase(renderer: Renderer, interpolation: number): void {
    const pos = this.getInterpolatedPosition(interpolation);

    if (!this.isAlive) {
      // Death animation
      if (this.deathProgress < 1) {
        const alpha = 1 - this.deathProgress;
        const ctx = renderer.getContext();
        ctx.globalAlpha = alpha;

        if (RenderConfig.useSprites() && this.spritesReady && this.activeAnimController) {
          this.renderSpriteBody(ctx, pos);
        }
        if (RenderConfig.useRectangles()) {
          const scale = 1 - this.deathProgress;
          const w = this.size.x * scale;
          const h = this.size.y * scale;
          const dx = (this.size.x - w) / 2;
          const dy = this.size.y - h;
          renderer.fillRect(pos.x + dx, pos.y + dy, w, h, this.color);
        }

        ctx.globalAlpha = 1;
      }
      return;
    }

    const ctx = renderer.getContext();

    // Respawn fade-in
    if (this.respawnFadeIn < 1) {
      ctx.globalAlpha = this.respawnFadeIn;
    }

    // Body color (white flash on hit)
    const bodyColor = this.hitFlashTimer > 0 ? "#ffffff" : this.color;

    if (RenderConfig.useSprites() && this.spritesReady && this.activeAnimController) {
      this.renderSpriteBody(ctx, pos);
    }
    if (RenderConfig.useRectangles()) {
      renderer.fillRect(pos.x, pos.y, this.size.x, this.size.y, bodyColor);
    }

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

    renderer.fillRect(barX, barY, barWidth, barHeight, "#1c1917");
    renderer.fillRect(barX, barY, barWidth * healthPct, barHeight, "#ef4444");

    // State label
    const stateName = this.stateMachine.getCurrentState();
    renderer.drawText(stateName, pos.x, pos.y - 14, "#a78bfa", 8);

    // Reset alpha
    ctx.globalAlpha = 1;
  }

  spawnDeathParticles(): void {
    if (!this.particleSystem) return;
    this.particleSystem.emit({
      x: this.getCenterX(),
      y: this.getCenterY(),
      count: 12,
      speedMin: 50,
      speedMax: 150,
      angleMin: 0,
      angleMax: Math.PI * 2,
      lifeMin: 0.3,
      lifeMax: 0.6,
      sizeMin: 2,
      sizeMax: 5,
      colors: [this.color, "#ffffff", "#1e1b4b"],
      gravity: 200,
    });
  }

  reset(): void {
    this.isAlive = true;
    this.active = true;
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
    this.grounded = false;
    this.deathProgress = 0;
    this.respawnFadeIn = 0;
    this.facingRight = true;
  }
}
