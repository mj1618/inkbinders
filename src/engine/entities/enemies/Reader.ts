import { Enemy } from "@/engine/entities/Enemy";
import type { EnemyConfig } from "@/engine/entities/Enemy";
import { StateMachine } from "@/engine/states/StateMachine";
import type { Renderer } from "@/engine/core/Renderer";
import type { Vec2 } from "@/lib/types";
import type { ReaderParams } from "./EnemyParams";
import { DEFAULT_READER_PARAMS } from "./EnemyParams";

const READER_COLOR = "#ef4444";
const READER_SIZE: Vec2 = { x: 20, y: 24 };

interface ReaderConfig {
  position: Vec2;
  params?: Partial<ReaderParams>;
  patrol?: boolean;
  patrolRange?: number;
  respawns?: boolean;
  respawnDelay?: number;
}

export class Reader extends Enemy {
  stateMachine: StateMachine<Reader>;
  params: ReaderParams;

  // Patrol
  patrol: boolean;
  patrolRange: number;
  patrolDirection = 1;

  // Lunge
  lungeTimer = 0;
  recoveryTimer = 0;
  lungeDirection = 1;

  // Bob animation
  bobTimer = 0;

  // Afterimage trail for lunge
  afterimages: Array<{ x: number; y: number; alpha: number }> = [];

  constructor(config: ReaderConfig) {
    const params = { ...DEFAULT_READER_PARAMS, ...config.params };
    const enemyConfig: EnemyConfig = {
      position: config.position,
      size: { x: READER_SIZE.x, y: READER_SIZE.y },
      color: READER_COLOR,
      health: params.health,
      contactDamage: params.contactDamage,
      respawns: config.respawns ?? true,
      respawnDelay: config.respawnDelay ?? 180,
    };
    super(enemyConfig);

    this.params = params;
    this.patrol = config.patrol ?? true;
    this.patrolRange = config.patrolRange ?? 100;

    this.stateMachine = new StateMachine<Reader>(this);
    this.registerStates();
    this.stateMachine.setState("PATROL");
  }

  private registerStates(): void {
    this.stateMachine.addState({
      name: "PATROL",
      enter: (r) => {
        r.bobTimer = 0;
      },
      update: (r, dt) => {
        if (!r.patrol) {
          r.velocity.x = 0;
          // Still check for player
          if (r.canSeePlayer(r.params.detectionRange)) {
            r.stateMachine.setState("CHASE");
          }
          return;
        }

        r.bobTimer += dt * 8;

        // Move in patrol direction
        const dir = r.patrolDirection;
        r.facingRight = dir > 0;

        // Ledge detection
        if (!r.hasGroundAhead(dir)) {
          r.patrolDirection *= -1;
          r.velocity.x = 0;
          return;
        }

        r.velocity.x = dir * r.params.moveSpeed;

        // Check patrol range
        const distFromSpawn = r.position.x - r.spawnPosition.x;
        if (Math.abs(distFromSpawn) >= r.patrolRange) {
          r.patrolDirection *= -1;
        }

        // Detect player
        if (r.canSeePlayer(r.params.detectionRange)) {
          r.stateMachine.setState("CHASE");
        }
      },
    });

    this.stateMachine.addState({
      name: "CHASE",
      update: (r, _dt) => {
        const dir = r.directionToPlayer();
        r.facingRight = dir > 0;

        // Ledge detection (respect ledges during chase)
        if (r.grounded && !r.hasGroundAhead(dir)) {
          r.velocity.x = 0;
          // Wait at ledge — don't run off
          if (!r.canSeePlayer(r.params.detectionRange * 1.5)) {
            r.stateMachine.setState("PATROL");
          }
          return;
        }

        r.velocity.x = dir * r.params.chaseSpeed;

        // Check attack range
        if (r.distanceToPlayer() <= r.params.attackRange) {
          r.stateMachine.setState("ATTACK");
          return;
        }

        // Lost player (hysteresis)
        if (!r.canSeePlayer(r.params.detectionRange * 1.5)) {
          r.stateMachine.setState("PATROL");
        }
      },
    });

    this.stateMachine.addState({
      name: "ATTACK",
      enter: (r) => {
        r.lungeTimer = r.params.lungeDuration;
        r.lungeDirection = r.directionToPlayer();
        r.facingRight = r.lungeDirection > 0;
        r.afterimages = [];
      },
      update: (r, _dt) => {
        if (r.lungeTimer > 0) {
          r.lungeTimer--;
          // Lunge ignores ledge detection
          r.velocity.x = r.lungeDirection * r.params.lungeSpeed;

          // Store afterimage
          if (r.afterimages.length < 4) {
            r.afterimages.push({ x: r.position.x, y: r.position.y, alpha: 0.6 });
          }
        } else {
          r.stateMachine.setState("RECOVER");
        }
      },
    });

    this.stateMachine.addState({
      name: "RECOVER",
      enter: (r) => {
        r.recoveryTimer = r.params.lungeRecovery;
        // Skid to a stop
        r.velocity.x *= 0.3;
      },
      update: (r, _dt) => {
        r.recoveryTimer--;
        // Friction
        r.velocity.x *= 0.9;
        if (Math.abs(r.velocity.x) < 5) r.velocity.x = 0;

        if (r.recoveryTimer <= 0) {
          if (r.canSeePlayer(r.params.detectionRange)) {
            r.stateMachine.setState("CHASE");
          } else {
            r.stateMachine.setState("PATROL");
          }
        }
      },
    });

    this.stateMachine.addState({
      name: "HURT",
      enter: (r) => {
        r.velocity.x = 0;
      },
      update: (r, _dt) => {
        // Hitstun is handled in updateBase
        if (r.hitstunFrames <= 0) {
          if (r.canSeePlayer(r.params.detectionRange)) {
            r.stateMachine.setState("CHASE");
          } else {
            r.stateMachine.setState("PATROL");
          }
        }
      },
    });

    this.stateMachine.addState({
      name: "DEAD",
      enter: () => {
        // Death handled in base
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
    this.updateBase(dt);

    // Fade afterimages
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      this.afterimages[i].alpha -= dt * 3;
      if (this.afterimages[i].alpha <= 0) {
        this.afterimages.splice(i, 1);
      }
    }
  }

  override render(renderer: Renderer, interpolation: number): void {
    // Draw afterimages
    if (this.isAlive) {
      const ctx = renderer.getContext();
      for (const img of this.afterimages) {
        ctx.globalAlpha = img.alpha;
        renderer.fillRect(img.x, img.y, this.size.x, this.size.y, READER_COLOR);
        ctx.globalAlpha = 1;
      }
    }

    const pos = this.getInterpolatedPosition(interpolation);
    const state = this.stateMachine.getCurrentState();

    // Bob animation during patrol — render manually so the bob offset is visible
    if (this.isAlive && state === "PATROL" && this.patrol) {
      pos.y += Math.sin(this.bobTimer) * 2;
      const bodyColor = this.hitFlashTimer > 0 ? "#ffffff" : this.color;
      renderer.fillRect(pos.x, pos.y, this.size.x, this.size.y, bodyColor);
      this.renderHealthBar(renderer, pos);
      return;
    }

    // Chase tilt effect (slight visual only)
    if (this.isAlive && state === "CHASE") {
      // Render with slight tilt (using save/restore transform)
      const ctx = renderer.getContext();
      const cx = pos.x + this.size.x / 2;
      const cy = pos.y + this.size.y / 2;
      const tiltAngle = this.facingRight ? 0.15 : -0.15;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tiltAngle);

      const bodyColor = this.hitFlashTimer > 0 ? "#ffffff" : this.color;
      ctx.fillStyle = bodyColor;
      ctx.fillRect(-this.size.x / 2, -this.size.y / 2, this.size.x, this.size.y);

      ctx.restore();

      // Health bar and state label (non-tilted)
      this.renderHealthBar(renderer, pos);
      return;
    }

    this.renderBase(renderer, interpolation);
  }

  private renderHealthBar(renderer: Renderer, pos: Vec2): void {
    if (!this.isAlive) return;

    const barWidth = this.size.x + 8;
    const barHeight = 3;
    const barX = pos.x - 4;
    const barY = pos.y - 8;
    const healthPct = this.health / this.maxHealth;

    renderer.fillRect(barX, barY, barWidth, barHeight, "#1c1917");
    renderer.fillRect(barX, barY, barWidth * healthPct, barHeight, "#ef4444");

    const stateName = this.stateMachine.getCurrentState();
    renderer.drawText(stateName, pos.x, pos.y - 14, "#a78bfa", 8);
  }

  override reset(): void {
    super.reset();
    this.patrolDirection = 1;
    this.lungeTimer = 0;
    this.recoveryTimer = 0;
    this.afterimages = [];
    this.stateMachine.setState("PATROL");
  }

  /** Whether the Reader is in an aggressive state that deals contact damage */
  isAggressive(): boolean {
    const state = this.stateMachine.getCurrentState();
    return state === "CHASE" || state === "ATTACK";
  }
}
