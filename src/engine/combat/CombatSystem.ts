import type { Vec2, Rect } from "@/lib/types";
import type { Renderer } from "@/engine/core/Renderer";
import type { Camera } from "@/engine/core/Camera";
import type {
  AttackDirection,
  AttackPhase,
  WeaponType,
  AttackHitbox,
  HitResult,
} from "./types";
import { CombatParams, DEFAULT_COMBAT_PARAMS } from "./CombatParams";
import { aabbOverlap, aabbIntersection } from "@/engine/physics/AABB";
import { RenderConfig } from "@/engine/core/RenderConfig";
import { AssetManager } from "@/engine/core/AssetManager";
import {
  COMBAT_VFX_CONFIGS,
  COMBAT_VFX_ANIMATIONS,
  type CombatVfxInstance,
  createCombatVfx,
  updateCombatVfx,
  renderCombatVfx,
  getSlashRotation,
} from "./CombatSprites";

/** Diagonal reach multiplier (approximating 45 deg rotation) */
const DIAGONAL_FACTOR = 0.7;

/** Small offset for diagonal hitbox overlap with player */
const DIAGONAL_OVERLAP = 8;

export class CombatSystem {
  params: CombatParams;

  /** Current weapon the player is using */
  currentWeapon: WeaponType = "quill-spear";

  /** Current attack lifecycle phase */
  attackPhase: AttackPhase = "idle";

  /** Frames remaining in the current phase */
  phaseTimer = 0;

  /** Direction of the current attack */
  attackDirection: AttackDirection = "right";

  /** Active hitbox (null when not in active phase) */
  activeHitbox: AttackHitbox | null = null;

  /** Cooldown timer (frames remaining) */
  cooldownTimer = 0;

  /** Auto-aim target position for ink snap */
  snapTargetPosition: Vec2 | null = null;

  /** Auto-aim target ID for ink snap */
  snapTargetId: string | null = null;

  /** Whether combat system is enabled */
  enabled = true;

  /** Visual: phase progress for rendering (0-1) */
  private phaseProgress = 0;

  /** Total frames for current phase (for progress calculation) */
  private phaseTotalFrames = 0;

  /** Active sprite VFX instances (fire-and-forget) */
  private activeVfx: CombatVfxInstance[] = [];

  /** Whether VFX sprites have been initialized */
  private spritesInitialized = false;

  /** Tracks whether we already spawned the attack VFX for the current attack */
  private attackVfxSpawned = false;

  constructor(params?: Partial<CombatParams>) {
    this.params = { ...DEFAULT_COMBAT_PARAMS, ...params };
  }

  /** Load and initialize combat VFX sprite sheets. Safe to call multiple times. */
  initSprites(): void {
    if (this.spritesInitialized) return;
    this.spritesInitialized = true;

    const am = AssetManager.getInstance();
    am.loadAll(COMBAT_VFX_CONFIGS).then(() => {
      for (const [sheetId, anims] of Object.entries(COMBAT_VFX_ANIMATIONS)) {
        const sheet = am.getSpriteSheet(sheetId);
        if (sheet) {
          for (const anim of anims) sheet.addAnimation(anim);
        }
      }
    });
  }

  /**
   * Check if the player can attack right now.
   * Considers: current attack phase, cooldown, player state restrictions.
   */
  canAttack(playerState: string): boolean {
    if (!this.enabled) return false;
    if (this.attackPhase !== "idle") return false;
    if (this.cooldownTimer > 0) return false;

    // State restrictions
    if (playerState === "HARD_LANDING" && !this.params.attackDuringHardLanding) {
      return false;
    }
    if (playerState === "DASHING" && !this.params.attackDuringDash) {
      return false;
    }
    if (playerState === "WALL_SLIDING" && !this.params.attackDuringWallSlide) {
      return false;
    }

    return true;
  }

  /**
   * Start a quill-spear attack in the given direction.
   */
  startSpearAttack(direction: AttackDirection): void {
    this.currentWeapon = "quill-spear";
    this.attackDirection = direction;
    this.attackPhase = "windup";
    this.phaseTimer = this.params.spearWindupFrames;
    this.phaseTotalFrames = this.params.spearWindupFrames;
    this.phaseProgress = 0;
    this.activeHitbox = null;
    this.attackVfxSpawned = false;
  }

  /**
   * Start an ink-snap attack.
   * Auto-aims at nearest target within range. If no target, aims in facing direction.
   */
  startSnapAttack(targetPosition: Vec2 | null, targetId: string | null = null, facingRight: boolean = true): void {
    this.currentWeapon = "ink-snap";
    this.snapTargetPosition = targetPosition;
    this.snapTargetId = targetId;
    this.attackDirection = facingRight ? "right" : "left";
    this.attackPhase = "windup";
    this.phaseTimer = this.params.snapWindupFrames;
    this.phaseTotalFrames = this.params.snapWindupFrames;
    this.phaseProgress = 0;
    this.activeHitbox = null;
    this.attackVfxSpawned = false;
  }

  /**
   * Main update -- advance attack phase timers, produce/clear hitbox.
   * Call every fixed-timestep frame.
   */
  update(playerBounds: Rect, facingRight: boolean, dt?: number): void {
    // Tick cooldown
    if (this.cooldownTimer > 0) {
      this.cooldownTimer--;
    }

    // Update active VFX (even when attack is idle, VFX may still be playing out)
    if (dt !== undefined && this.activeVfx.length > 0) {
      this.activeVfx = updateCombatVfx(this.activeVfx, dt);
    }

    if (this.attackPhase === "idle") return;

    // Update phase progress
    if (this.phaseTotalFrames > 0) {
      this.phaseProgress = 1 - this.phaseTimer / this.phaseTotalFrames;
    }

    this.phaseTimer--;

    if (this.phaseTimer <= 0) {
      // Transition to next phase
      this.advancePhase(playerBounds, facingRight);
    } else if (this.attackPhase === "active") {
      // Recompute hitbox position to follow the player
      this.updateActiveHitbox(playerBounds, facingRight);
    }
  }

  private advancePhase(playerBounds: Rect, facingRight: boolean): void {
    const isSpear = this.currentWeapon === "quill-spear";

    switch (this.attackPhase) {
      case "windup":
        // Transition to active
        this.attackPhase = "active";
        this.phaseTimer = isSpear
          ? this.params.spearActiveFrames
          : this.params.snapActiveFrames;
        this.phaseTotalFrames = this.phaseTimer;
        this.phaseProgress = 0;
        // Create hitbox
        this.createHitbox(playerBounds, facingRight);
        // Spawn attack VFX on entering active phase
        this.spawnAttackVfx(playerBounds, facingRight);
        break;

      case "active":
        // Transition to recovery
        this.attackPhase = "recovery";
        this.phaseTimer = isSpear
          ? this.params.spearRecoveryFrames
          : this.params.snapRecoveryFrames;
        this.phaseTotalFrames = this.phaseTimer;
        this.phaseProgress = 0;
        this.activeHitbox = null;
        break;

      case "recovery":
        // Transition to cooldown (internal -- we go idle but track cooldown separately)
        this.attackPhase = "idle";
        this.cooldownTimer = isSpear
          ? this.params.spearCooldownFrames
          : this.params.snapCooldownFrames;
        this.activeHitbox = null;
        this.snapTargetPosition = null;
        this.snapTargetId = null;
        break;

      default:
        this.attackPhase = "idle";
        this.activeHitbox = null;
        break;
    }
  }

  private createHitbox(playerBounds: Rect, facingRight: boolean): void {
    const isSpear = this.currentWeapon === "quill-spear";

    const rect = isSpear
      ? this.computeSpearHitbox(playerBounds)
      : this.computeSnapHitbox(playerBounds, this.snapTargetPosition);

    const damage = isSpear ? this.params.spearDamage : this.params.snapDamage;
    const knockbackSpeed = isSpear
      ? this.params.spearKnockback
      : this.params.snapKnockback;

    let knockback: Vec2;
    if (isSpear) {
      knockback = this.computeSpearKnockback(knockbackSpeed);
    } else {
      // Snap knockback direction computed per-target in checkHits
      knockback = { x: facingRight ? knockbackSpeed : -knockbackSpeed, y: -knockbackSpeed * 0.3 };
    }

    this.activeHitbox = {
      rect,
      damage,
      knockback,
      weapon: this.currentWeapon,
      direction: this.attackDirection,
      hitEntities: new Set(),
    };
  }

  private computeSpearKnockback(speed: number): Vec2 {
    const dir = this.attackDirection;
    const UPWARD_BIAS = 0.3;

    switch (dir) {
      case "right":
        return { x: speed, y: -speed * UPWARD_BIAS };
      case "left":
        return { x: -speed, y: -speed * UPWARD_BIAS };
      case "up":
        return { x: 0, y: -speed };
      case "down":
        return { x: 0, y: speed };
      case "up-right":
        return { x: speed * DIAGONAL_FACTOR, y: -speed * DIAGONAL_FACTOR };
      case "up-left":
        return { x: -speed * DIAGONAL_FACTOR, y: -speed * DIAGONAL_FACTOR };
      case "down-right":
        return { x: speed * DIAGONAL_FACTOR, y: speed * DIAGONAL_FACTOR };
      case "down-left":
        return { x: -speed * DIAGONAL_FACTOR, y: speed * DIAGONAL_FACTOR };
    }
  }

  private updateActiveHitbox(playerBounds: Rect, facingRight: boolean): void {
    if (!this.activeHitbox) return;

    const isSpear = this.currentWeapon === "quill-spear";
    this.activeHitbox.rect = isSpear
      ? this.computeSpearHitbox(playerBounds)
      : this.computeSnapHitbox(playerBounds, this.snapTargetPosition);
  }

  /**
   * Compute the quill-spear hitbox position based on player bounds and attack direction.
   */
  computeSpearHitbox(playerBounds: Rect): Rect {
    const { spearReach, spearWidth } = this.params;
    const cx = playerBounds.x + playerBounds.width / 2;
    const cy = playerBounds.y + playerBounds.height / 2;
    const right = playerBounds.x + playerBounds.width;
    const left = playerBounds.x;
    const top = playerBounds.y;
    const bottom = playerBounds.y + playerBounds.height;

    const diagReach = spearReach * DIAGONAL_FACTOR;

    switch (this.attackDirection) {
      case "right":
        return { x: right, y: cy - spearWidth / 2, width: spearReach, height: spearWidth };
      case "left":
        return { x: left - spearReach, y: cy - spearWidth / 2, width: spearReach, height: spearWidth };
      case "up":
        return { x: cx - spearWidth / 2, y: top - spearReach, width: spearWidth, height: spearReach };
      case "down":
        return { x: cx - spearWidth / 2, y: bottom, width: spearWidth, height: spearReach };
      case "up-right":
        return { x: right - DIAGONAL_OVERLAP, y: top - diagReach, width: diagReach, height: diagReach };
      case "up-left":
        return { x: left - diagReach + DIAGONAL_OVERLAP, y: top - diagReach, width: diagReach, height: diagReach };
      case "down-right":
        return { x: right - DIAGONAL_OVERLAP, y: bottom, width: diagReach, height: diagReach };
      case "down-left":
        return { x: left - diagReach + DIAGONAL_OVERLAP, y: bottom, width: diagReach, height: diagReach };
    }
  }

  /**
   * Compute the ink-snap hitbox as a circle approximated by a square.
   */
  computeSnapHitbox(playerBounds: Rect, targetPosition: Vec2 | null): Rect {
    const { snapRadius } = this.params;
    const size = snapRadius * 2;

    if (targetPosition) {
      return {
        x: targetPosition.x - snapRadius,
        y: targetPosition.y - snapRadius,
        width: size,
        height: size,
      };
    }

    // No target: center on player's forward edge
    const cx = playerBounds.x + playerBounds.width / 2;
    const cy = playerBounds.y + playerBounds.height / 2;
    const offsetX = this.attackDirection === "left" ? -this.params.spearReach * 0.5 : this.params.spearReach * 0.5;

    return {
      x: cx + offsetX - snapRadius,
      y: cy - snapRadius,
      width: size,
      height: size,
    };
  }

  /**
   * Find the nearest damageable target within ink-snap auto-aim range.
   */
  findSnapTarget(
    playerCenter: Vec2,
    targets: Array<{ id: string; bounds: Rect }>,
  ): { id: string; position: Vec2 } | null {
    let bestDist = this.params.snapAutoAimRange;
    let bestTarget: { id: string; position: Vec2 } | null = null;

    for (const t of targets) {
      const tcx = t.bounds.x + t.bounds.width / 2;
      const tcy = t.bounds.y + t.bounds.height / 2;
      const dx = tcx - playerCenter.x;
      const dy = tcy - playerCenter.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < bestDist) {
        bestDist = dist;
        bestTarget = { id: t.id, position: { x: tcx, y: tcy } };
      }
    }

    return bestTarget;
  }

  /**
   * Check the active hitbox against a list of potential targets.
   * Returns all new hits (targets not already hit by this attack).
   */
  checkHits(targets: Array<{ id: string; bounds: Rect }>): HitResult[] {
    if (!this.activeHitbox || this.attackPhase !== "active") return [];

    const results: HitResult[] = [];
    const hitbox = this.activeHitbox;

    for (const target of targets) {
      // Skip already-hit entities
      if (hitbox.hitEntities.has(target.id)) continue;

      if (aabbOverlap(hitbox.rect, target.bounds)) {
        // Compute hit position (center of overlap region)
        const intersection = aabbIntersection(hitbox.rect, target.bounds);
        const hitPosition: Vec2 = intersection
          ? {
              x: intersection.x + intersection.width / 2,
              y: intersection.y + intersection.height / 2,
            }
          : {
              x: target.bounds.x + target.bounds.width / 2,
              y: target.bounds.y + target.bounds.height / 2,
            };

        // Compute knockback direction
        let knockback: Vec2;
        if (this.currentWeapon === "ink-snap" && this.snapTargetPosition) {
          // Outward from snap center
          const dx = target.bounds.x + target.bounds.width / 2 - this.snapTargetPosition.x;
          const dy = target.bounds.y + target.bounds.height / 2 - this.snapTargetPosition.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          knockback = {
            x: (dx / len) * this.params.snapKnockback,
            y: (dy / len) * this.params.snapKnockback - this.params.snapKnockback * 0.3,
          };
        } else {
          knockback = { ...hitbox.knockback };
        }

        hitbox.hitEntities.add(target.id);

        results.push({
          targetId: target.id,
          hitbox,
          hitPosition,
          knockback,
          damage: hitbox.damage,
        });
      }
    }

    return results;
  }

  /**
   * Render attack visuals: wind-up flash, active hitbox, recovery fade.
   * Also renders any active sprite VFX instances.
   */
  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    // Always render active VFX instances (they outlive attack phases)
    if (RenderConfig.useSprites() && this.activeVfx.length > 0) {
      renderCombatVfx(ctx, this.activeVfx);
    }

    if (this.attackPhase === "idle") return;

    const isSpear = this.currentWeapon === "quill-spear";

    if (RenderConfig.useRectangles()) {
      if (this.attackPhase === "windup") {
        // Flash at the attack origin
        if (this.activeHitbox) {
          const r = this.activeHitbox.rect;
          ctx.globalAlpha = 0.3 + this.phaseProgress * 0.3;
          ctx.fillStyle = isSpear ? "#dbeafe" : "#4338ca";
          ctx.fillRect(r.x, r.y, r.width, r.height);
          ctx.globalAlpha = 1;
        }
      } else if (this.attackPhase === "active" && this.activeHitbox) {
        const r = this.activeHitbox.rect;

        if (isSpear) {
          // Spear thrust visual -- tapered rectangle
          ctx.fillStyle = "#60a5fa";
          ctx.globalAlpha = 0.8;
          ctx.fillRect(r.x, r.y, r.width, r.height);

          // Edge highlight
          ctx.strokeStyle = "#dbeafe";
          ctx.lineWidth = 1;
          ctx.strokeRect(r.x, r.y, r.width, r.height);
          ctx.globalAlpha = 1;
        } else {
          // Ink snap burst -- circular splash
          const cx = r.x + r.width / 2;
          const cy = r.y + r.height / 2;
          const radius = r.width / 2;

          // Dark ink burst
          ctx.globalAlpha = 0.7;
          ctx.fillStyle = "#1e1b4b";
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fill();

          // Indigo ring
          ctx.strokeStyle = "#4338ca";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  /**
   * Spawn a hit impact VFX at the given world position.
   * Call when a hit is confirmed (from test page or game loop).
   */
  spawnHitVfx(hitPosition: Vec2): void {
    if (!RenderConfig.useSprites()) return;
    this.initSprites();

    // Hit flash at contact point
    const flash = createCombatVfx("combat-hit-flash", "flash", hitPosition.x, hitPosition.y);
    if (flash) this.activeVfx.push(flash);

    // Hit sparks with slight random offset
    const offsetX = (Math.random() - 0.5) * 12;
    const offsetY = (Math.random() - 0.5) * 12;
    const sparks = createCombatVfx(
      "combat-hit-sparks",
      "sparks",
      hitPosition.x + offsetX,
      hitPosition.y + offsetY,
    );
    if (sparks) this.activeVfx.push(sparks);
  }

  /** Spawn the attack VFX (slash arc or snap burst) when entering active phase. */
  private spawnAttackVfx(playerBounds: Rect, facingRight: boolean): void {
    if (!RenderConfig.useSprites()) return;
    if (this.attackVfxSpawned) return;
    this.attackVfxSpawned = true;
    this.initSprites();

    if (!this.activeHitbox) return;
    const r = this.activeHitbox.rect;
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;

    if (this.currentWeapon === "quill-spear") {
      const rotation = getSlashRotation(this.attackDirection);
      // Rotation alone handles all 8 directions (base sprite faces right).
      // flipX is not needed — it would incorrectly mirror the rotated sprite.
      const vfx = createCombatVfx("combat-spear-slash", "slash", cx, cy, {
        rotation,
      });
      if (vfx) this.activeVfx.push(vfx);
    } else {
      // Ink snap burst — scale to match snap radius
      const snapDiameter = this.params.snapRadius * 2;
      const scale = snapDiameter / 64; // 64 is snap burst frame size
      const vfx = createCombatVfx("combat-snap-burst", "burst", cx, cy, { scale });
      if (vfx) this.activeVfx.push(vfx);
    }
  }

  /**
   * Render debug overlays for the combat system.
   */
  renderDebug(ctx: CanvasRenderingContext2D, playerBounds: Rect): void {
    // Active hitbox outline
    if (this.activeHitbox && this.attackPhase === "active") {
      const r = this.activeHitbox.rect;
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x, r.y, r.width, r.height);
    }

    // Windup hitbox preview
    if (this.attackPhase === "windup") {
      const isSpear = this.currentWeapon === "quill-spear";
      const previewRect = isSpear
        ? this.computeSpearHitbox(playerBounds)
        : this.computeSnapHitbox(playerBounds, this.snapTargetPosition);
      ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(previewRect.x, previewRect.y, previewRect.width, previewRect.height);
      ctx.setLineDash([]);
    }

    // Snap auto-aim line
    if (
      this.currentWeapon === "ink-snap" &&
      this.snapTargetPosition &&
      this.attackPhase !== "idle"
    ) {
      const pcx = playerBounds.x + playerBounds.width / 2;
      const pcy = playerBounds.y + playerBounds.height / 2;
      ctx.strokeStyle = "#4338ca";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(pcx, pcy);
      ctx.lineTo(this.snapTargetPosition.x, this.snapTargetPosition.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Attack direction indicator
    if (this.attackPhase !== "idle") {
      const pcx = playerBounds.x + playerBounds.width / 2;
      const pcy = playerBounds.y + playerBounds.height / 2;
      const arrowLen = 20;
      const dir = this.getDirectionVector(this.attackDirection);
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pcx, pcy);
      ctx.lineTo(pcx + dir.x * arrowLen, pcy + dir.y * arrowLen);
      ctx.stroke();
    }
  }

  private getDirectionVector(dir: AttackDirection): Vec2 {
    switch (dir) {
      case "right": return { x: 1, y: 0 };
      case "left": return { x: -1, y: 0 };
      case "up": return { x: 0, y: -1 };
      case "down": return { x: 0, y: 1 };
      case "up-right": return { x: DIAGONAL_FACTOR, y: -DIAGONAL_FACTOR };
      case "up-left": return { x: -DIAGONAL_FACTOR, y: -DIAGONAL_FACTOR };
      case "down-right": return { x: DIAGONAL_FACTOR, y: DIAGONAL_FACTOR };
      case "down-left": return { x: -DIAGONAL_FACTOR, y: DIAGONAL_FACTOR };
    }
  }

  /** Reset combat state */
  reset(): void {
    this.attackPhase = "idle";
    this.phaseTimer = 0;
    this.cooldownTimer = 0;
    this.activeHitbox = null;
    this.snapTargetPosition = null;
    this.snapTargetId = null;
    this.phaseProgress = 0;
    this.phaseTotalFrames = 0;
    this.activeVfx = [];
    this.attackVfxSpawned = false;
  }
}
