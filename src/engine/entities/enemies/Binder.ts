import { Enemy } from "@/engine/entities/Enemy";
import type { EnemyConfig } from "@/engine/entities/Enemy";
import { StateMachine } from "@/engine/states/StateMachine";
import { RenderConfig } from "@/engine/core/RenderConfig";
import type { Renderer } from "@/engine/core/Renderer";
import type { Vec2, Rect } from "@/lib/types";
import { aabbOverlap } from "@/engine/physics/AABB";
import type { BinderParams } from "./EnemyParams";
import { DEFAULT_BINDER_PARAMS } from "./EnemyParams";
import {
  getEnemySpriteConfigs,
  getEnemyAnimations,
  BINDER_STATE_TO_ANIMATION,
} from "./EnemySprites";

const BINDER_COLOR = "#a855f7";
const BINDER_SIZE: Vec2 = { x: 28, y: 36 };
const THREAD_COLOR = "#7c3aed";
const THREAD_TARGET_COLOR = "rgba(124, 58, 237, 0.27)";

interface BinderConfig {
  position: Vec2;
  params?: Partial<BinderParams>;
  respawns?: boolean;
  respawnDelay?: number;
}

export class Binder extends Enemy {
  stateMachine: StateMachine<Binder>;
  params: BinderParams;

  // Thread state
  threadTipX = 0;
  threadTipY = 0;
  threadTargetX = 0;
  threadTargetY = 0;
  threadTimer = 0;
  cooldownTimer = 0;
  pullTimer = 0;

  // Windup timer
  windupTimer = 0;

  // Pull force exposed for test page to apply to player
  pullForce: Vec2 | null = null;

  // Flag: thread just connected this frame (test page should apply threadDamage)
  threadJustConnected = false;

  // Idle bob
  idleBobTimer = 0;
  idleScaleX = 1;

  constructor(config: BinderConfig) {
    const params = { ...DEFAULT_BINDER_PARAMS, ...config.params };
    const enemyConfig: EnemyConfig = {
      position: config.position,
      size: { x: BINDER_SIZE.x, y: BINDER_SIZE.y },
      color: BINDER_COLOR,
      health: params.health,
      contactDamage: params.contactDamage,
      respawns: config.respawns ?? true,
      respawnDelay: config.respawnDelay ?? 180,
    };
    super(enemyConfig);

    this.params = params;

    this.stateMachine = new StateMachine<Binder>(this);
    this.registerStates();
    this.stateMachine.setState("IDLE");

    this.initSprites(
      getEnemySpriteConfigs("binder"),
      getEnemyAnimations("binder"),
      BINDER_STATE_TO_ANIMATION,
    );
  }

  private registerStates(): void {
    this.stateMachine.addState({
      name: "IDLE",
      enter: (b) => {
        b.velocity.x = 0;
        b.pullForce = null;
      },
      update: (b, dt) => {
        b.idleBobTimer += dt * 3;
        b.idleScaleX = 0.95 + 0.1 * Math.sin(b.idleBobTimer);

        // Face toward player
        if (b.canSeePlayer(b.params.detectionRange)) {
          b.facingRight = b.directionToPlayer() > 0;
        }

        // Tick cooldown
        if (b.cooldownTimer > 0) {
          b.cooldownTimer--;
          return;
        }

        // Check thread fire conditions
        const dist = b.distanceToPlayer();
        if (
          dist <= b.params.threadRange &&
          dist >= b.params.threadMinRange &&
          b.cooldownTimer <= 0 &&
          b.playerRef
        ) {
          b.stateMachine.setState("WINDUP");
        }
      },
    });

    this.stateMachine.addState({
      name: "WINDUP",
      enter: (b) => {
        b.windupTimer = b.params.threadWindup;
        b.pullForce = null;
      },
      update: (b, _dt) => {
        b.windupTimer--;

        // Cancel if player leaves range
        const dist = b.distanceToPlayer();
        if (dist > b.params.threadRange * 1.2 || !b.playerRef) {
          b.stateMachine.setState("IDLE");
          return;
        }

        b.facingRight = b.directionToPlayer() > 0;

        if (b.windupTimer <= 0) {
          b.stateMachine.setState("THREAD_FIRE");
        }
      },
    });

    this.stateMachine.addState({
      name: "THREAD_FIRE",
      enter: (b) => {
        // Snapshot target position at moment of fire
        if (b.playerRef) {
          b.threadTargetX = b.playerRef.position.x + b.playerRef.size.x / 2;
          b.threadTargetY = b.playerRef.position.y + b.playerRef.size.y / 2;
        }
        b.threadTipX = b.getCenterX();
        b.threadTipY = b.getCenterY();
        b.threadTimer = b.params.threadDuration;
        b.pullForce = null;
      },
      update: (b, dt) => {
        b.threadTimer--;

        // Extend thread toward target
        const dx = b.threadTargetX - b.threadTipX;
        const dy = b.threadTargetY - b.threadTipY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 2) {
          const moveSpeed = b.params.threadSpeed * dt;
          b.threadTipX += (dx / dist) * moveSpeed;
          b.threadTipY += (dy / dist) * moveSpeed;
        }

        // Check if thread tip hits player
        if (b.playerRef) {
          const tipRect: Rect = {
            x: b.threadTipX - 4,
            y: b.threadTipY - 4,
            width: 8,
            height: 8,
          };
          if (aabbOverlap(tipRect, b.playerRef.getBounds())) {
            b.stateMachine.setState("PULLING");
            return;
          }
        }

        // Thread reached max extension or timed out
        const distFromBinder = Math.sqrt(
          (b.threadTipX - b.getCenterX()) ** 2 +
          (b.threadTipY - b.getCenterY()) ** 2
        );
        if (distFromBinder >= b.params.threadRange || b.threadTimer <= 0) {
          b.stateMachine.setState("THREAD_RETRACT");
        }
      },
    });

    this.stateMachine.addState({
      name: "PULLING",
      enter: (b) => {
        b.pullTimer = b.params.pullDuration;
        b.threadJustConnected = true;
      },
      update: (b, _dt) => {
        b.pullTimer--;

        if (!b.playerRef) {
          b.stateMachine.setState("THREAD_RETRACT");
          return;
        }

        // Update thread tip to follow player during pull
        b.threadTipX = b.playerRef.position.x + b.playerRef.size.x / 2;
        b.threadTipY = b.playerRef.position.y + b.playerRef.size.y / 2;

        // Compute pull force toward binder
        const dx = b.getCenterX() - b.threadTipX;
        const dy = b.getCenterY() - b.threadTipY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 1) {
          b.pullForce = {
            x: (dx / dist) * b.params.threadKnockback,
            y: (dy / dist) * b.params.threadKnockback,
          };
        }

        // Player can dash to break thread
        if (b.playerRef.isDashing) {
          b.spawnThreadBreakParticles();
          b.pullForce = null;
          b.stateMachine.setState("THREAD_RETRACT");
          return;
        }

        if (b.pullTimer <= 0) {
          b.pullForce = null;
          b.stateMachine.setState("THREAD_RETRACT");
        }
      },
    });

    this.stateMachine.addState({
      name: "THREAD_RETRACT",
      enter: (b) => {
        b.pullForce = null;
        b.threadTimer = 15; // Short retract time
      },
      update: (b, dt) => {
        b.threadTimer--;

        // Retract thread tip toward binder
        const dx = b.getCenterX() - b.threadTipX;
        const dy = b.getCenterY() - b.threadTipY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 2) {
          const speed = b.params.threadRetractSpeed * dt;
          b.threadTipX += (dx / dist) * speed;
          b.threadTipY += (dy / dist) * speed;
        }

        if (dist <= 4 || b.threadTimer <= 0) {
          b.cooldownTimer = b.params.threadCooldown;
          b.stateMachine.setState("IDLE");
        }
      },
    });

    this.stateMachine.addState({
      name: "HURT",
      enter: (b) => {
        b.velocity.x = 0;
        b.pullForce = null;
        // Cancel thread if in windup or fire
        b.threadTimer = 0;
      },
      update: (b, _dt) => {
        if (b.hitstunFrames <= 0) {
          b.cooldownTimer = Math.max(b.cooldownTimer, 30); // Small cooldown after hurt
          b.stateMachine.setState("IDLE");
        }
      },
    });

    this.stateMachine.addState({
      name: "DEAD",
      enter: (b) => {
        b.pullForce = null;
      },
    });
  }

  override takeDamage(damage: number, knockback: Vec2, hitstopFrames: number): boolean {
    const hit = super.takeDamage(damage, knockback, hitstopFrames);
    if (hit && this.isAlive) {
      this.stateMachine.setState("HURT");
    } else if (hit && !this.isAlive) {
      this.stateMachine.setState("DEAD");
    }
    return hit;
  }

  override update(dt: number): void {
    // Clear one-frame flag after test page has had a chance to read it
    this.threadJustConnected = false;
    this.updateBase(dt);
    this.updateAnimation(dt);
  }

  override render(renderer: Renderer, interpolation: number): void {
    const pos = this.getInterpolatedPosition(interpolation);
    const state = this.stateMachine.getCurrentState();
    const ctx = renderer.getContext();

    // Draw thread
    if (this.isAlive && (state === "THREAD_FIRE" || state === "PULLING" || state === "THREAD_RETRACT")) {
      const startX = pos.x + this.size.x / 2;
      const startY = pos.y + this.size.y / 2;

      // Thread line
      ctx.strokeStyle = THREAD_COLOR;
      ctx.lineWidth = state === "PULLING" ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(this.threadTipX, this.threadTipY);
      ctx.stroke();

      // Thread tip node
      ctx.fillStyle = THREAD_COLOR;
      ctx.beginPath();
      ctx.arc(this.threadTipX, this.threadTipY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Targeting line during windup
    if (this.isAlive && state === "WINDUP" && this.playerRef) {
      const startX = pos.x + this.size.x / 2;
      const startY = pos.y + this.size.y / 2;
      const targetX = this.playerRef.position.x + this.playerRef.size.x / 2;
      const targetY = this.playerRef.position.y + this.playerRef.size.y / 2;

      ctx.strokeStyle = THREAD_TARGET_COLOR;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Body with idle bob/pulse
    if (this.isAlive && state === "IDLE") {
      if (RenderConfig.useSprites()) {
        this.renderSpriteBody(ctx, pos);
      }
      if (RenderConfig.useRectangles()) {
        const bodyColor = this.hitFlashTimer > 0 ? "#ffffff" : this.color;
        const w = this.size.x * this.idleScaleX;
        const xOffset = (this.size.x - w) / 2;
        renderer.fillRect(pos.x + xOffset, pos.y, w, this.size.y, bodyColor);
      }

      // Health bar and state label
      const barWidth = this.size.x + 8;
      const barHeight = 3;
      const barX = pos.x - 4;
      const barY = pos.y - 8;
      const healthPct = this.health / this.maxHealth;
      renderer.fillRect(barX, barY, barWidth, barHeight, "#1c1917");
      renderer.fillRect(barX, barY, barWidth * healthPct, barHeight, "#ef4444");
      renderer.drawText(state, pos.x, pos.y - 14, "#a78bfa", 8);
    } else {
      this.renderBase(renderer, interpolation);
    }
  }

  private spawnThreadBreakParticles(): void {
    if (!this.particleSystem || !this.playerRef) return;
    this.particleSystem.emit({
      x: this.threadTipX,
      y: this.threadTipY,
      count: 7,
      speedMin: 40,
      speedMax: 120,
      angleMin: 0,
      angleMax: Math.PI * 2,
      lifeMin: 0.2,
      lifeMax: 0.4,
      sizeMin: 2,
      sizeMax: 4,
      colors: [BINDER_COLOR, THREAD_COLOR, "#c084fc"],
      gravity: 150,
    });
  }

  override reset(): void {
    super.reset();
    this.cooldownTimer = 0;
    this.threadTimer = 0;
    this.pullTimer = 0;
    this.windupTimer = 0;
    this.pullForce = null;
    this.threadJustConnected = false;
    this.stateMachine.setState("IDLE");
  }

  /** Whether the Binder is in an aggressive state */
  isAggressive(): boolean {
    const state = this.stateMachine.getCurrentState();
    return state === "PULLING";
  }

  /** Whether the thread is active and visible */
  isThreadActive(): boolean {
    const state = this.stateMachine.getCurrentState();
    return state === "THREAD_FIRE" || state === "PULLING" || state === "THREAD_RETRACT";
  }
}
