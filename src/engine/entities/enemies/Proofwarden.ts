import { Enemy } from "@/engine/entities/Enemy";
import type { EnemyConfig } from "@/engine/entities/Enemy";
import { StateMachine } from "@/engine/states/StateMachine";
import type { Renderer } from "@/engine/core/Renderer";
import type { Vec2, Rect } from "@/lib/types";
import type { ProofwardenParams } from "./EnemyParams";
import { DEFAULT_PROOFWARDEN_PARAMS } from "./EnemyParams";

const PROOFWARDEN_COLOR = "#f59e0b";
const PROOFWARDEN_DIM_COLOR = "#d97706";
const SHIELD_COLOR = "#fbbf24";
const PROOFWARDEN_SIZE: Vec2 = { x: 32, y: 40 };
const DEG2RAD = Math.PI / 180;

interface ProofwardenConfig {
  position: Vec2;
  params?: Partial<ProofwardenParams>;
  respawns?: boolean;
  respawnDelay?: number;
}

export class Proofwarden extends Enemy {
  stateMachine: StateMachine<Proofwarden>;
  params: ProofwardenParams;

  // Patrol
  patrolDirection = 1;

  // Slam
  slamWindupTimer = 0;
  slamActiveTimer = 0;
  slamRecoveryTimer = 0;
  slamHitbox: Rect | null = null;

  // Shield state
  shieldActive = true;

  // Visual
  bodyScaleY = 1;
  shieldFlashTimer = 0;

  constructor(config: ProofwardenConfig) {
    const params = { ...DEFAULT_PROOFWARDEN_PARAMS, ...config.params };
    const enemyConfig: EnemyConfig = {
      position: config.position,
      size: { x: PROOFWARDEN_SIZE.x, y: PROOFWARDEN_SIZE.y },
      color: PROOFWARDEN_COLOR,
      health: params.health,
      contactDamage: params.contactDamage,
      respawns: config.respawns ?? true,
      respawnDelay: config.respawnDelay ?? 180,
    };
    super(enemyConfig);

    this.params = params;

    this.stateMachine = new StateMachine<Proofwarden>(this);
    this.registerStates();
    this.stateMachine.setState("PATROL");
  }

  private registerStates(): void {
    this.stateMachine.addState({
      name: "PATROL",
      enter: (pw) => {
        pw.shieldActive = true;
        pw.bodyScaleY = 1;
        pw.slamHitbox = null;
      },
      update: (pw, _dt) => {
        const dir = pw.patrolDirection;
        pw.facingRight = dir > 0;

        // Ledge detection
        if (pw.grounded && !pw.hasGroundAhead(dir)) {
          pw.patrolDirection *= -1;
          pw.velocity.x = 0;
          return;
        }

        pw.velocity.x = dir * pw.params.moveSpeed;

        // Detect player
        if (pw.canSeePlayer(pw.params.detectionRange)) {
          pw.stateMachine.setState("CHASE");
        }
      },
    });

    this.stateMachine.addState({
      name: "CHASE",
      enter: (pw) => {
        pw.shieldActive = true;
        pw.bodyScaleY = 1;
        pw.slamHitbox = null;
      },
      update: (pw, _dt) => {
        const dir = pw.directionToPlayer();
        pw.facingRight = dir > 0;

        // Ledge detection
        if (pw.grounded && !pw.hasGroundAhead(dir)) {
          pw.velocity.x = 0;
          // Check if player is still in range
          if (!pw.canSeePlayer(pw.params.detectionRange * 1.5)) {
            pw.stateMachine.setState("PATROL");
          }
          return;
        }

        pw.velocity.x = dir * pw.params.chaseSpeed;

        // Check attack range
        if (pw.distanceToPlayer() <= pw.params.attackRange) {
          pw.stateMachine.setState("SLAM_WINDUP");
          return;
        }

        // Lost player
        if (!pw.canSeePlayer(pw.params.detectionRange * 1.5)) {
          pw.stateMachine.setState("PATROL");
        }
      },
    });

    this.stateMachine.addState({
      name: "SLAM_WINDUP",
      enter: (pw) => {
        pw.slamWindupTimer = pw.params.slamWindup;
        pw.velocity.x = 0;
        pw.shieldActive = true;
        pw.shieldFlashTimer = 0;
      },
      update: (pw, _dt) => {
        pw.slamWindupTimer--;
        pw.shieldFlashTimer++;

        // Visual: body raises up
        pw.bodyScaleY = 1 + 0.1 * (1 - pw.slamWindupTimer / pw.params.slamWindup);

        if (pw.slamWindupTimer <= 0) {
          pw.stateMachine.setState("SLAM_ACTIVE");
        }
      },
    });

    this.stateMachine.addState({
      name: "SLAM_ACTIVE",
      enter: (pw) => {
        pw.slamActiveTimer = pw.params.slamActiveFrames;
        pw.bodyScaleY = 0.85;

        // Create slam hitbox in front
        const frontX = pw.facingRight
          ? pw.position.x + pw.size.x
          : pw.position.x - pw.params.slamHitboxWidth;
        const hitboxY = pw.position.y + (pw.size.y - pw.params.slamHitboxHeight) / 2;

        pw.slamHitbox = {
          x: frontX,
          y: hitboxY,
          width: pw.params.slamHitboxWidth,
          height: pw.params.slamHitboxHeight,
        };

        // Screen shake on slam
        if (pw.screenShake) {
          pw.screenShake.shake(3, 4);
        }
      },
      update: (pw, _dt) => {
        pw.slamActiveTimer--;

        // Update hitbox position to follow enemy
        if (pw.slamHitbox) {
          pw.slamHitbox.x = pw.facingRight
            ? pw.position.x + pw.size.x
            : pw.position.x - pw.params.slamHitboxWidth;
          pw.slamHitbox.y = pw.position.y + (pw.size.y - pw.params.slamHitboxHeight) / 2;
        }

        if (pw.slamActiveTimer <= 0) {
          pw.slamHitbox = null;
          pw.stateMachine.setState("SLAM_RECOVERY");
        }
      },
    });

    this.stateMachine.addState({
      name: "SLAM_RECOVERY",
      enter: (pw) => {
        pw.slamRecoveryTimer = pw.params.slamRecovery;
        pw.shieldActive = false; // Shield down during recovery!
        pw.slamHitbox = null;
        pw.velocity.x = 0;
      },
      update: (pw, _dt) => {
        pw.slamRecoveryTimer--;
        // Slight wobble
        pw.bodyScaleY = 0.95 + 0.05 * Math.sin(pw.slamRecoveryTimer * 0.5);

        if (pw.slamRecoveryTimer <= 0) {
          pw.shieldActive = true;
          pw.bodyScaleY = 1;
          if (pw.canSeePlayer(pw.params.detectionRange)) {
            pw.stateMachine.setState("CHASE");
          } else {
            pw.stateMachine.setState("PATROL");
          }
        }
      },
    });

    this.stateMachine.addState({
      name: "HURT",
      enter: (pw) => {
        pw.velocity.x = 0;
        pw.slamHitbox = null;
      },
      update: (pw, _dt) => {
        if (pw.hitstunFrames <= 0) {
          pw.shieldActive = true;
          pw.bodyScaleY = 1;
          if (pw.canSeePlayer(pw.params.detectionRange)) {
            pw.stateMachine.setState("CHASE");
          } else {
            pw.stateMachine.setState("PATROL");
          }
        }
      },
    });

    this.stateMachine.addState({
      name: "DEAD",
      enter: (pw) => {
        pw.slamHitbox = null;
        pw.shieldActive = false;
      },
    });
  }

  override takeDamage(damage: number, knockback: Vec2, hitstopFrames: number): boolean {
    // Shield block check — uses shieldBlockAngle for proper angular coverage
    if (this.shieldActive && this.isAlive && this.invincibilityFrames <= 0) {
      // Knockback points away from the attack source, so the attack came from -knockback direction.
      // Compute the angle the attack came FROM (relative to Proofwarden).
      const attackAngle = Math.atan2(-knockback.y, -knockback.x);
      // Shield faces the direction the Proofwarden is looking
      const shieldAngle = this.facingRight ? 0 : Math.PI;
      // Angular difference (wrapped to [-PI, PI])
      let angleDiff = attackAngle - shieldAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      const halfBlock = (this.params.shieldBlockAngle / 2) * DEG2RAD;
      if (Math.abs(angleDiff) <= halfBlock) {
        // BLOCKED
        this.spawnBlockParticles();
        if (this.screenShake) {
          this.screenShake.shake(1.5, 2);
        }
        return false;
      }
    }

    const hit = super.takeDamage(damage, knockback, hitstopFrames);
    if (hit && this.isAlive) {
      this.stateMachine.setState("HURT");
    } else if (hit && !this.isAlive) {
      this.stateMachine.setState("DEAD");
    }
    return hit;
  }

  private spawnBlockParticles(): void {
    if (!this.particleSystem) return;
    const shieldX = this.facingRight
      ? this.position.x + this.size.x
      : this.position.x;
    this.particleSystem.emit({
      x: shieldX,
      y: this.getCenterY(),
      count: 7,
      speedMin: 60,
      speedMax: 140,
      angleMin: this.facingRight ? -Math.PI / 3 : Math.PI - Math.PI / 3,
      angleMax: this.facingRight ? Math.PI / 3 : Math.PI + Math.PI / 3,
      lifeMin: 0.1,
      lifeMax: 0.25,
      sizeMin: 2,
      sizeMax: 4,
      colors: [SHIELD_COLOR, "#ffffff", "#fef3c7"],
      gravity: 100,
    });
  }

  override update(dt: number): void {
    this.updateBase(dt);
  }

  override render(renderer: Renderer, interpolation: number): void {
    const pos = this.getInterpolatedPosition(interpolation);
    const state = this.stateMachine.getCurrentState();
    const ctx = renderer.getContext();

    if (!this.isAlive) {
      this.renderBase(renderer, interpolation);
      return;
    }

    if (this.respawnFadeIn < 1) {
      ctx.globalAlpha = this.respawnFadeIn;
    }

    // Body with scale
    const bodyColor = this.hitFlashTimer > 0
      ? "#ffffff"
      : state === "SLAM_RECOVERY"
        ? PROOFWARDEN_DIM_COLOR
        : this.color;

    const h = this.size.y * this.bodyScaleY;
    const yOffset = this.size.y - h;
    renderer.fillRect(pos.x, pos.y + yOffset, this.size.x, h, bodyColor);

    // Hitstop glow
    if (this.hitstopTimer > 0) {
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.strokeRect(pos.x - 1, pos.y + yOffset - 1, this.size.x + 2, h + 2);
    }

    // Shield arc
    if (this.shieldActive && state !== "SLAM_RECOVERY") {
      const shieldAngleRad = this.params.shieldBlockAngle * DEG2RAD;
      const centerAngle = this.facingRight ? 0 : Math.PI;
      const cx = this.facingRight
        ? pos.x + this.size.x
        : pos.x;
      const cy = pos.y + this.size.y / 2;
      const shieldRadius = this.size.y * 0.45;

      // Flash during windup
      if (state === "SLAM_WINDUP") {
        const flash = Math.sin(this.shieldFlashTimer * 0.8) > 0;
        ctx.strokeStyle = flash ? "#ffffff" : SHIELD_COLOR;
      } else {
        ctx.strokeStyle = SHIELD_COLOR;
      }

      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(
        cx,
        cy,
        shieldRadius,
        centerAngle - shieldAngleRad / 2,
        centerAngle + shieldAngleRad / 2,
      );
      ctx.stroke();

      // White edge
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(
        cx,
        cy,
        shieldRadius + 2,
        centerAngle - shieldAngleRad / 2,
        centerAngle + shieldAngleRad / 2,
      );
      ctx.stroke();
    }

    // Slam hitbox
    if (this.slamHitbox && state === "SLAM_ACTIVE") {
      ctx.fillStyle = "rgba(245, 158, 11, 0.5)";
      ctx.fillRect(
        this.slamHitbox.x,
        this.slamHitbox.y,
        this.slamHitbox.width,
        this.slamHitbox.height,
      );
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        this.slamHitbox.x,
        this.slamHitbox.y,
        this.slamHitbox.width,
        this.slamHitbox.height,
      );
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

    ctx.globalAlpha = 1;
  }

  override reset(): void {
    super.reset();
    this.patrolDirection = 1;
    this.slamWindupTimer = 0;
    this.slamActiveTimer = 0;
    this.slamRecoveryTimer = 0;
    this.slamHitbox = null;
    this.shieldActive = true;
    this.bodyScaleY = 1;
    this.shieldFlashTimer = 0;
    this.stateMachine.setState("PATROL");
  }

  /** Whether the slam hitbox is active */
  isSlamActive(): boolean {
    return this.stateMachine.getCurrentState() === "SLAM_ACTIVE" && this.slamHitbox !== null;
  }

  /** Whether the Proofwarden is in an aggressive contact state */
  isAggressive(): boolean {
    return this.stateMachine.getCurrentState() === "SLAM_ACTIVE";
  }

  /** Get the slam hitbox (null when not attacking) */
  getSlamHitbox(): Rect | null {
    return this.slamHitbox;
  }
}
