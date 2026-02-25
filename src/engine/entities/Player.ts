import { Entity } from "./Entity";
import { StateMachine } from "@/engine/states/StateMachine";
import { InputManager, InputAction } from "@/engine/input/InputManager";
import { TileMap } from "@/engine/physics/TileMap";
import type { Renderer } from "@/engine/core/Renderer";
import type { ParticleSystem } from "@/engine/core/ParticleSystem";
import type { ScreenShake } from "@/engine/core/ScreenShake";
import { AnimationController } from "@/engine/core/AnimationController";
import { AssetManager } from "@/engine/core/AssetManager";
import { RenderConfig } from "@/engine/core/RenderConfig";
import {
  PLAYER_SPRITE_CONFIGS,
  PLAYER_ANIMATIONS,
  STATE_TO_ANIMATION,
  type StateAnimMapping,
} from "@/engine/entities/PlayerSprites";
import { DEFAULT_GRAVITY, MAX_FALL_SPEED } from "@/lib/constants";
import { SURFACE_PROPERTIES } from "@/engine/physics/Surfaces";
import type { SurfaceProperties } from "@/engine/physics/Surfaces";

/** Ink-style particle colors (subtle whites and light grays) */
const DUST_COLORS = ["#e5e7eb", "#d1d5db", "#f9fafb"];

export interface PlayerParams {
  maxRunSpeed: number;
  acceleration: number;
  deceleration: number;
  turnMultiplier: number;
  crouchSpeed: number;
  slideInitialSpeed: number;
  slideFriction: number;
  slideMinSpeed: number;
  gravity: number;
  maxFallSpeed: number;
  playerWidth: number;
  playerHeight: number;
  crouchHeight: number;
  // Jump parameters
  jumpSpeed: number;
  riseGravity: number;
  fallGravity: number;
  apexGravityMultiplier: number;
  apexVelocityThreshold: number;
  coyoteFrames: number;
  jumpBufferFrames: number;
  airAcceleration: number;
  airDeceleration: number;
  jumpCutMultiplier: number;
  // Wall mechanics parameters
  wallSlideBaseSpeed: number;
  wallSlideGripSpeed: number;
  wallSlideAcceleration: number;
  wallJumpHorizontalSpeed: number;
  wallJumpVerticalSpeed: number;
  wallJumpLockoutFrames: number;
  wallJumpCoyoteFrames: number;
  wallStickFrames: number;
  // Dash parameters
  dashSpeed: number;
  dashDurationFrames: number;
  dashWindupFrames: number;
  dashCooldownFrames: number;
  dashSpeedBoost: number;
  dashSpeedBoostDecayRate: number;
  // Squash-stretch parameters
  squashStretchEnabled: boolean;
  jumpLaunchScaleX: number;
  jumpLaunchScaleY: number;
  softLandScaleX: number;
  softLandScaleY: number;
  hardLandScaleX: number;
  hardLandScaleY: number;
  dashStartScaleX: number;
  dashStartScaleY: number;
  dashEndScaleX: number;
  dashEndScaleY: number;
  wallSlideEntryScaleX: number;
  wallSlideEntryScaleY: number;
  wallJumpScaleX: number;
  wallJumpScaleY: number;
  turnScaleX: number;
  crouchSquashScaleX: number;
  crouchSquashScaleY: number;
  scaleReturnSpeed: number;
  // New squash-stretch events
  apexFloatScaleX: number;
  apexFloatScaleY: number;
  fastFallScaleX: number;
  fastFallScaleY: number;
  runFootstrikeScaleX: number;
  runFootstrikeScaleY: number;
  slideBoostScaleX: number;
  slideBoostScaleY: number;
  // Landing parameters
  softLandThresholdFrames: number;
  hardLandThresholdFrames: number;
  hardLandRecoveryFrames: number;
}

export const DEFAULT_PLAYER_PARAMS: PlayerParams = {
  maxRunSpeed: 280,
  acceleration: 1800,
  deceleration: 1200,
  turnMultiplier: 3.0,
  crouchSpeed: 100,
  slideInitialSpeed: 350,
  slideFriction: 600,
  slideMinSpeed: 40,
  gravity: DEFAULT_GRAVITY,
  maxFallSpeed: MAX_FALL_SPEED,
  playerWidth: 24,
  playerHeight: 40,
  crouchHeight: 24,
  // Jump defaults
  jumpSpeed: 380,
  riseGravity: 680,
  fallGravity: 980,
  apexGravityMultiplier: 0.4,
  apexVelocityThreshold: 50,
  coyoteFrames: 7,
  jumpBufferFrames: 5,
  airAcceleration: 1400,
  airDeceleration: 600,
  jumpCutMultiplier: 0.4,
  // Wall mechanics defaults
  wallSlideBaseSpeed: 120,
  wallSlideGripSpeed: 40,
  wallSlideAcceleration: 800,
  wallJumpHorizontalSpeed: 260,
  wallJumpVerticalSpeed: 340,
  wallJumpLockoutFrames: 8,
  wallJumpCoyoteFrames: 5,
  wallStickFrames: 3,
  // Dash defaults
  dashSpeed: 600,
  dashDurationFrames: 15,
  dashWindupFrames: 1,
  dashCooldownFrames: 18,
  dashSpeedBoost: 1.4,
  dashSpeedBoostDecayRate: 800,
  // Squash-stretch defaults — tuned for sprite readability
  squashStretchEnabled: true,
  jumpLaunchScaleX: 0.75,
  jumpLaunchScaleY: 1.30,
  softLandScaleX: 1.30,
  softLandScaleY: 0.70,
  hardLandScaleX: 1.45,
  hardLandScaleY: 0.60,
  dashStartScaleX: 1.40,
  dashStartScaleY: 0.75,
  dashEndScaleX: 0.82,
  dashEndScaleY: 1.15,
  wallSlideEntryScaleX: 0.85,
  wallSlideEntryScaleY: 1.12,
  wallJumpScaleX: 0.78,
  wallJumpScaleY: 1.28,
  turnScaleX: 0.88,
  crouchSquashScaleX: 1.18,
  crouchSquashScaleY: 0.75,
  scaleReturnSpeed: 10.0,
  apexFloatScaleX: 0.95,
  apexFloatScaleY: 1.08,
  fastFallScaleX: 0.88,
  fastFallScaleY: 1.15,
  runFootstrikeScaleX: 1.05,
  runFootstrikeScaleY: 0.97,
  slideBoostScaleX: 1.30,
  slideBoostScaleY: 0.75,
  // Landing defaults
  softLandThresholdFrames: 12,
  hardLandThresholdFrames: 30,
  hardLandRecoveryFrames: 8,
};

/** Player state names */
const STATE_IDLE = "IDLE";
const STATE_RUNNING = "RUNNING";
const STATE_CROUCHING = "CROUCHING";
const STATE_CROUCH_SLIDING = "CROUCH_SLIDING";
const STATE_FALLING = "FALLING";
const STATE_JUMPING = "JUMPING";
const STATE_WALL_SLIDING = "WALL_SLIDING";
const STATE_WALL_JUMPING = "WALL_JUMPING";
const STATE_DASHING = "DASHING";
const STATE_HARD_LANDING = "HARD_LANDING";

/**
 * Crossfade duration in game frames when transitioning between player states.
 * Key format: "FROM_STATE->TO_STATE". Default is 0 (instant, no crossfade).
 * Crossfade is purely visual — it never delays state transitions or input response.
 */
const CROSSFADE_DURATIONS: Record<string, number> = {
  "IDLE->RUNNING":          3,
  "RUNNING->IDLE":          4,
  "RUNNING->JUMPING":       2,
  "FALLING->IDLE":          3,
  "FALLING->RUNNING":       3,
  "JUMPING->FALLING":       3,
  "WALL_SLIDING->IDLE":     2,
  "WALL_SLIDING->FALLING":  2,
  "DASHING->IDLE":          2,
  "DASHING->RUNNING":       2,
  "DASHING->FALLING":       2,
  "HARD_LANDING->IDLE":     3,
  "HARD_LANDING->RUNNING":  3,
  "CROUCHING->IDLE":        2,
  "CROUCH_SLIDING->IDLE":   3,
  "CROUCH_SLIDING->CROUCHING": 2,
};

function getCrossfadeDuration(fromState: string, toState: string): number {
  return CROSSFADE_DURATIONS[`${fromState}->${toState}`] ?? 0;
}

export class Player extends Entity {
  grounded = false;
  facingRight = true;
  stateMachine: StateMachine<Player>;
  params: PlayerParams;
  input: InputManager | null = null;
  tileMap: TileMap | null = null;

  // Optional systems (set externally, opt-in)
  particleSystem: ParticleSystem | null = null;
  screenShake: ScreenShake | null = null;

  // Jump state
  coyoteTimer = 0;
  jumpHeld = false;
  isInApexFloat = false;
  canCoyoteJump = false;
  /** Gravity set by the current state each frame */
  currentGravity = 0;

  // Dash state
  dashDirection: { x: number; y: number } = { x: 0, y: 0 };
  dashTimer = 0;
  dashWindupTimer = 0;
  dashCooldownTimer = 0;
  dashAvailable = true;
  isDashing = false;
  isInDashWindup = false;
  dashSpeedBoostRemaining = 0;
  dashWasGrounded = false;
  dashTrailPositions: Array<{ x: number; y: number }> = [];
  dashTrailFadeTimer = 0;

  // Wall state
  wallSide: -1 | 0 | 1 = 0;
  wallJumpLockoutTimer = 0;
  wallCoyoteTimer = 0;
  canWallCoyoteJump = false;
  wallStickTimer = 0;

  // Squash-stretch visual deformation (does NOT affect collision box)
  scaleX = 1.0;
  scaleY = 1.0;
  targetScaleX = 1.0;
  targetScaleY = 1.0;

  // Fall duration tracking (for landing system)
  fallDurationFrames = 0;

  // Hard landing recovery
  hardLandRecoveryTimer = 0;

  // Wall slide particle emit timer
  private wallSlideParticleTimer = 0;

  // Crouch slide particle emit timer
  private crouchSlideParticleTimer = 0;

  // Squash-stretch tracking for new deformation events
  private wasInApexFloat = false;
  // Apex float animation override tracking
  private apexAnimActive = false;
  private fastFallSquashApplied = false;
  private lastRunFootstrikeFrame = -1;

  // Run cycle visual state tracking
  private skidAnimTimer = 0;       // Frames remaining in skid visual
  private turnAnimTimer = 0;       // Frames remaining in turn visual
  private lastFootstepFrame = -1;  // Last animation frame that emitted dust

  // Landing type indicator (for debug overlay)
  lastLandingType: "SOFT" | "HARD" | null = null;
  landingFlashTimer = 0;

  // Bounce state: velocity.y before collision resolution zeroed it
  // Used by the FALLING state's landing logic to detect bouncy surface impacts
  preLandingVelocityY = 0;
  // Flag: true when transitioning to JUMPING from a bouncy surface bounce
  // Prevents the JUMPING enter handler from overwriting the bounce velocity
  isBouncing = false;

  // Surface physics (set externally each frame by the game loop / test page)
  currentSurface: SurfaceProperties = SURFACE_PROPERTIES.normal;
  currentWallSurface: SurfaceProperties = SURFACE_PROPERTIES.normal;

  // Sprite rendering
  private animControllers = new Map<string, AnimationController>();
  private activeAnimController: AnimationController | null = null;
  private activeAnimFacesLeft = false;
  private spritesReady = false;

  // Transition animation state
  private transitionAnimActive = false;
  private transitionAnimController: AnimationController | null = null;
  private previousStateAnimKey = "";

  // Crossfade blending state (purely visual)
  private previousStateName = "";
  private crossfadeState: {
    outgoingController: AnimationController;
    outgoingFrameIndex: number;
    outgoingFacesLeft: boolean;
    progress: number;
    durationFrames: number;
    elapsedFrames: number;
  } | null = null;

  constructor(params?: Partial<PlayerParams>) {
    super({
      size: {
        x: params?.playerWidth ?? DEFAULT_PLAYER_PARAMS.playerWidth,
        y: params?.playerHeight ?? DEFAULT_PLAYER_PARAMS.playerHeight,
      },
    });
    this.params = { ...DEFAULT_PLAYER_PARAMS, ...params };
    this.size.x = this.params.playerWidth;
    this.size.y = this.params.playerHeight;

    this.stateMachine = new StateMachine<Player>(this);
    this.registerStates();
    this.stateMachine.setState(STATE_IDLE);

    this.initSprites();
  }

  /** Load sprite sheets and create animation controllers (async — sprites load in background) */
  initSprites(): void {
    const assetManager = AssetManager.getInstance();
    assetManager.loadAll(PLAYER_SPRITE_CONFIGS).then(() => {
      for (const config of PLAYER_SPRITE_CONFIGS) {
        const sheet = assetManager.getSpriteSheet(config.id);
        if (sheet) {
          const anims = PLAYER_ANIMATIONS[config.id];
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
      // Player falls back to rectangle rendering gracefully
    });
  }

  /** Apply squash-stretch deformation (snap to values, returns to 1.0 over time) */
  private applySquash(sx: number, sy: number): void {
    if (!this.params.squashStretchEnabled) return;
    this.scaleX = sx;
    this.scaleY = sy;
    this.targetScaleX = 1.0;
    this.targetScaleY = 1.0;
  }

  /** Emit particles at the player's feet */
  private emitFeetParticles(count: number, spreadAngle: number, speed: number, life: number, sizeMin: number, sizeMax: number, gravity?: number): void {
    if (!this.particleSystem) return;
    const feetX = this.position.x + this.size.x / 2;
    const feetY = this.position.y + this.size.y;
    this.particleSystem.emit({
      x: feetX,
      y: feetY,
      count,
      speedMin: speed * 0.5,
      speedMax: speed,
      angleMin: -Math.PI / 2 - spreadAngle / 2,
      angleMax: -Math.PI / 2 + spreadAngle / 2,
      lifeMin: life * 0.7,
      lifeMax: life,
      sizeMin,
      sizeMax,
      colors: DUST_COLORS,
      gravity: gravity ?? 200,
    });
  }

  /** Emit "pebble" debris particles at the player's feet (for hard landings) */
  private emitPebbleParticles(): void {
    if (!this.particleSystem) return;
    const feetX = this.position.x + this.size.x / 2;
    const feetY = this.position.y + this.size.y;
    this.particleSystem.emit({
      x: feetX,
      y: feetY,
      count: 2,
      speedMin: 60,
      speedMax: 100,
      angleMin: -Math.PI * 0.8,
      angleMax: -Math.PI * 0.2,
      lifeMin: 0.3,
      lifeMax: 0.4,
      sizeMin: 3,
      sizeMax: 4,
      colors: ["#8b7355", "#6b5b3d"],
      gravity: 400,
    });
  }

  /** Emit particles at a wall contact point */
  private emitWallParticles(count: number, fromRight: boolean, life: number): void {
    if (!this.particleSystem) return;
    const wallX = fromRight
      ? this.position.x + this.size.x
      : this.position.x;
    const wallY = this.position.y + this.size.y / 2;
    const baseAngle = fromRight ? 0 : Math.PI;
    this.particleSystem.emit({
      x: wallX,
      y: wallY,
      count,
      speedMin: 30,
      speedMax: 80,
      angleMin: baseAngle - 0.8,
      angleMax: baseAngle + 0.8,
      lifeMin: life * 0.7,
      lifeMax: life,
      sizeMin: 1.5,
      sizeMax: 3,
      colors: DUST_COLORS,
      gravity: 100,
    });
  }

  /** Try to initiate a jump. Returns true if the jump happened. */
  private tryJump(): boolean {
    const input = this.input;
    if (!input) return false;

    if (input.isPressed(InputAction.Jump) || input.consumeBufferedInput(InputAction.Jump, this.params.jumpBufferFrames)) {
      // If crouching, try to uncrouch first
      if (this.size.y < this.params.playerHeight) {
        if (!this.canStandUp()) return false; // Blocked by ceiling
        const heightDiff = this.params.playerHeight - this.size.y;
        this.position.y -= heightDiff;
        this.size.y = this.params.playerHeight;
      }
      this.stateMachine.setState(STATE_JUMPING);
      return true;
    }
    return false;
  }

  /** Try to initiate a dash. Returns true if the dash happened. */
  private tryDash(): boolean {
    const input = this.input;
    if (!input) return false;
    if (!this.dashAvailable) return false;
    if (this.dashCooldownTimer > 0) return false;
    if (!input.isPressed(InputAction.Dash)) return false;

    this.stateMachine.setState(STATE_DASHING);
    return true;
  }

  private registerStates(): void {
    this.stateMachine.addState({
      name: STATE_IDLE,
      enter: (player) => {
        player.size.y = player.params.playerHeight;
        player.currentGravity = player.params.fallGravity;

        // Skid visual: play run-stop animation when entering IDLE from RUNNING with speed
        const prev = player.stateMachine.getPreviousState();
        if (prev === STATE_RUNNING && Math.abs(player.velocity.x) > player.params.maxRunSpeed * 0.3) {
          player.skidAnimTimer = 4;
        }
      },
      update: (player, dt) => {
        const input = player.input;
        if (!input) return;

        player.currentGravity = player.params.fallGravity;

        const surface = player.currentSurface;

        // Decelerate toward conveyor speed (or zero on non-conveyor surfaces)
        // This way the player naturally slides toward the conveyor's push speed
        const restSpeed = (player.grounded && surface.conveyorSpeed !== 0)
          ? surface.conveyorSpeed : 0;
        const decel = player.params.deceleration * surface.frictionMultiplier;
        if (player.velocity.x > restSpeed) {
          player.velocity.x = Math.max(restSpeed, player.velocity.x - decel * dt);
        } else if (player.velocity.x < restSpeed) {
          player.velocity.x = Math.min(restSpeed, player.velocity.x + decel * dt);
        }

        if (!player.grounded) {
          player.stateMachine.setState(STATE_FALLING);
          return;
        }

        // Dash check
        if (player.tryDash()) return;

        // Jump check
        if (player.tryJump()) return;

        // Transitions
        const hInput = getHorizontalInput(input);
        if (hInput !== 0) {
          player.stateMachine.setState(STATE_RUNNING);
          return;
        }
        if (input.isHeld(InputAction.Down)) {
          player.stateMachine.setState(STATE_CROUCHING);
          return;
        }
      },
      exit: (player) => {
        player.skidAnimTimer = 0;
      },
    });

    this.stateMachine.addState({
      name: STATE_RUNNING,
      enter: (player) => {
        player.currentGravity = player.params.fallGravity;
      },
      update: (player, dt) => {
        const input = player.input;
        if (!input) return;

        player.currentGravity = player.params.fallGravity;

        if (!player.grounded) {
          player.dashSpeedBoostRemaining = 0;
          player.stateMachine.setState(STATE_FALLING);
          return;
        }

        // Dash check
        if (player.tryDash()) return;

        const hInput = getHorizontalInput(input);

        if (hInput !== 0) {
          const wasFacingRight = player.facingRight;
          player.facingRight = hInput > 0;

          // Turn-around detection: emit particles + squash + turn animation
          if (wasFacingRight !== player.facingRight) {
            player.applySquash(player.params.turnScaleX, 1.0);
            player.turnAnimTimer = 3; // 3 frames of turn animation
            // Turn-around particles behind player (in old direction)
            if (player.particleSystem) {
              const behindX = wasFacingRight
                ? player.position.x + player.size.x + 2
                : player.position.x - 2;
              const feetY = player.position.y + player.size.y;
              player.particleSystem.emit({
                x: behindX,
                y: feetY - 4,
                count: 3,
                speedMin: 20,
                speedMax: 50,
                angleMin: wasFacingRight ? -0.5 : Math.PI - 0.5,
                angleMax: wasFacingRight ? 0.5 : Math.PI + 0.5,
                lifeMin: 0.07,
                lifeMax: 0.1,
                sizeMin: 1.5,
                sizeMax: 2.5,
                colors: DUST_COLORS,
                gravity: 50,
              });
            }
          }

          // Determine if turning — kill speed boost on direction change
          const turning = (hInput > 0 && player.velocity.x < 0) || (hInput < 0 && player.velocity.x > 0);
          if (turning) {
            player.dashSpeedBoostRemaining = 0;
          }

          const surface = player.currentSurface;
          const accel = turning
            ? player.params.acceleration * player.params.turnMultiplier * surface.accelerationMultiplier
            : player.params.acceleration * surface.accelerationMultiplier;

          // Dash speed boost
          let effectiveMaxSpeed = player.params.maxRunSpeed * surface.maxSpeedMultiplier;
          if (player.dashSpeedBoostRemaining > 1.0) {
            effectiveMaxSpeed = player.params.maxRunSpeed * surface.maxSpeedMultiplier * player.dashSpeedBoostRemaining;
            player.dashSpeedBoostRemaining -= player.params.dashSpeedBoostDecayRate * dt / player.params.maxRunSpeed;
            if (player.dashSpeedBoostRemaining < 1.0) {
              player.dashSpeedBoostRemaining = 0;
            }
          }

          player.velocity.x += hInput * accel * dt;

          // Conveyor push while running
          if (surface.conveyorSpeed !== 0 && player.grounded) {
            player.velocity.x += surface.conveyorSpeed * dt;
          }

          // Clamp to effective max speed
          player.velocity.x = clamp(player.velocity.x, -effectiveMaxSpeed, effectiveMaxSpeed);
        } else {
          // No input — kill boost and transition to Idle
          player.dashSpeedBoostRemaining = 0;
          player.stateMachine.setState(STATE_IDLE);
          return;
        }

        // Run animation FPS scaling: faster running = faster leg cycle
        const speedRatio = Math.abs(player.velocity.x) / player.params.maxRunSpeed;
        const runFps = 8 + speedRatio * 8; // 8fps at slow, 16fps at full speed
        if (player.activeAnimController) {
          player.activeAnimController.setFpsOverride(runFps);
        }

        // Footstep dust particles at foot-contact frames during fast running
        if (player.grounded && player.activeAnimController) {
          if (speedRatio > 0.4) {
            const currentAnimFrame = player.activeAnimController.getCurrentFrameNumber();
            if ((currentAnimFrame === 0 || currentAnimFrame === 4) && currentAnimFrame !== player.lastFootstepFrame) {
              player.lastFootstepFrame = currentAnimFrame;
              if (player.particleSystem) {
                const footX = player.position.x + player.size.x / 2;
                const footY = player.position.y + player.size.y;
                const dustSize = 1 + speedRatio * 1.5;
                player.particleSystem.emit({
                  x: footX,
                  y: footY - 1,
                  count: 2,
                  speedMin: 10,
                  speedMax: 30,
                  angleMin: -Math.PI * 0.8,
                  angleMax: -Math.PI * 0.2,
                  lifeMin: 0.12,
                  lifeMax: 0.25,
                  sizeMin: dustSize * 0.7,
                  sizeMax: dustSize,
                  colors: ["#d4c5a9"],
                  gravity: 40,
                });
              }
            }
          }
          // Reset lastFootstepFrame when animation frame changes to non-contact
          const cf = player.activeAnimController.getCurrentFrameNumber();
          if (cf !== 0 && cf !== 4) {
            player.lastFootstepFrame = -1;
          }
        }

        // Jump check (before crouch)
        if (player.tryJump()) return;

        // Crouch transitions
        if (input.isHeld(InputAction.Down)) {
          player.dashSpeedBoostRemaining = 0;
          const speed = Math.abs(player.velocity.x);
          if (speed > player.params.slideMinSpeed) {
            player.stateMachine.setState(STATE_CROUCH_SLIDING);
          } else {
            player.stateMachine.setState(STATE_CROUCHING);
          }
          return;
        }
      },
      exit: (player) => {
        // Clear run cycle visual state
        player.turnAnimTimer = 0;
        player.lastFootstepFrame = -1;
        if (player.activeAnimController) {
          player.activeAnimController.setFpsOverride(null);
        }
      },
    });

    this.stateMachine.addState({
      name: STATE_CROUCHING,
      enter: (player) => {
        // Reduce hitbox height; keep feet on ground (only if not already crouched)
        if (player.size.y > player.params.crouchHeight) {
          const heightDiff = player.params.playerHeight - player.params.crouchHeight;
          player.position.y += heightDiff;
          player.size.y = player.params.crouchHeight;
        }
        player.currentGravity = player.params.fallGravity;
        // Crouch squash
        player.applySquash(player.params.crouchSquashScaleX, player.params.crouchSquashScaleY);
      },
      update: (player, dt) => {
        const input = player.input;
        if (!input) return;

        player.currentGravity = player.params.fallGravity;

        if (!player.grounded) {
          player.stateMachine.setState(STATE_FALLING);
          return;
        }

        // Dash check
        if (player.tryDash()) return;

        const hInput = getHorizontalInput(input);

        if (hInput !== 0) {
          player.facingRight = hInput > 0;
          player.velocity.x += hInput * player.params.acceleration * dt;
          player.velocity.x = clamp(player.velocity.x, -player.params.crouchSpeed, player.params.crouchSpeed);
        } else {
          // Decelerate
          if (player.velocity.x > 0) {
            player.velocity.x = Math.max(0, player.velocity.x - player.params.deceleration * dt);
          } else if (player.velocity.x < 0) {
            player.velocity.x = Math.min(0, player.velocity.x + player.params.deceleration * dt);
          }
        }

        // Jump from crouch (uncrouch + jump handled in tryJump)
        if (player.tryJump()) return;

        // Try to stand up when crouch released
        if (!input.isHeld(InputAction.Down)) {
          if (player.canStandUp()) {
            // Restore height
            const heightDiff = player.params.playerHeight - player.params.crouchHeight;
            player.position.y -= heightDiff;
            player.size.y = player.params.playerHeight;

            if (hInput !== 0) {
              player.stateMachine.setState(STATE_RUNNING);
            } else {
              player.stateMachine.setState(STATE_IDLE);
            }
            return;
          }
          // Blocked above — stay crouching
        }
      },
      exit: (_player) => {
        // Height restoration handled in update when transitioning
      },
    });

    this.stateMachine.addState({
      name: STATE_CROUCH_SLIDING,
      enter: (player) => {
        // Reduce hitbox height; keep feet on ground (only if not already crouched)
        if (player.size.y > player.params.crouchHeight) {
          const heightDiff = player.params.playerHeight - player.params.crouchHeight;
          player.position.y += heightDiff;
          player.size.y = player.params.crouchHeight;
        }

        // Cap slide speed
        const speed = Math.abs(player.velocity.x);
        const maxSlideSpeed = Math.min(speed, player.params.slideInitialSpeed);
        player.velocity.x = player.facingRight ? maxSlideSpeed : -maxSlideSpeed;
        player.currentGravity = player.params.fallGravity;
        player.crouchSlideParticleTimer = 0;

        // Slide boost squash
        player.applySquash(player.params.slideBoostScaleX, player.params.slideBoostScaleY);
      },
      update: (player, dt) => {
        const input = player.input;
        if (!input) return;

        player.currentGravity = player.params.fallGravity;

        if (!player.grounded) {
          player.stateMachine.setState(STATE_FALLING);
          return;
        }

        // Dash check
        if (player.tryDash()) return;

        // Apply slide friction
        if (player.velocity.x > 0) {
          player.velocity.x = Math.max(0, player.velocity.x - player.params.slideFriction * dt);
        } else if (player.velocity.x < 0) {
          player.velocity.x = Math.min(0, player.velocity.x + player.params.slideFriction * dt);
        }

        // Check if slide ended (too slow)
        if (Math.abs(player.velocity.x) < player.params.slideMinSpeed) {
          player.stateMachine.setState(STATE_CROUCHING);
          return;
        }

        // Crouch-slide trail particles
        player.crouchSlideParticleTimer++;
        if (player.crouchSlideParticleTimer >= 4 && player.particleSystem) {
          player.crouchSlideParticleTimer = 0;
          const behindX = player.facingRight
            ? player.position.x - 2
            : player.position.x + player.size.x + 2;
          const feetY = player.position.y + player.size.y;
          player.particleSystem.emit({
            x: behindX,
            y: feetY - 2,
            count: 2,
            speedMin: 10,
            speedMax: 30,
            angleMin: -Math.PI * 0.8,
            angleMax: -Math.PI * 0.2,
            lifeMin: 0.07,
            lifeMax: 0.1,
            sizeMin: 1,
            sizeMax: 2,
            colors: DUST_COLORS,
            gravity: 50,
          });
        }

        // Jump from slide (uncrouch + jump handled in tryJump)
        if (player.tryJump()) return;

        // Try to stand up when crouch released
        if (!input.isHeld(InputAction.Down)) {
          if (player.canStandUp()) {
            const heightDiff = player.params.playerHeight - player.params.crouchHeight;
            player.position.y -= heightDiff;
            player.size.y = player.params.playerHeight;

            if (Math.abs(player.velocity.x) > player.params.slideMinSpeed) {
              player.stateMachine.setState(STATE_RUNNING);
            } else {
              player.stateMachine.setState(STATE_IDLE);
            }
            return;
          }
          // Blocked above — continue sliding
        }
      },
    });

    this.stateMachine.addState({
      name: STATE_JUMPING,
      enter: (player) => {
        // Only set jump velocity for fresh jumps (not when entering from WALL_JUMPING or bouncing)
        const prev = player.stateMachine.getPreviousState();
        if (player.isBouncing) {
          // Bouncy surface bounce — velocity.y was pre-set by the bounce code
          player.isBouncing = false;
          player.jumpHeld = false; // Don't allow jump-cut on bounces
          player.coyoteTimer = player.params.coyoteFrames + 1;
          player.canCoyoteJump = false;
        } else if (prev !== STATE_WALL_JUMPING) {
          player.velocity.y = -player.params.jumpSpeed;
          player.jumpHeld = true;
          player.coyoteTimer = player.params.coyoteFrames + 1; // Prevent re-jumping
          player.canCoyoteJump = false;

          // Jump launch squash + dust particles
          player.applySquash(player.params.jumpLaunchScaleX, player.params.jumpLaunchScaleY);
          player.emitFeetParticles(5, Math.PI * 0.8, 80, 0.15, 1.5, 3, 150);
        }
        player.currentGravity = player.params.riseGravity;
        player.fallDurationFrames = 0;

        // Ensure standing height
        if (player.size.y < player.params.playerHeight) {
          const heightDiff = player.params.playerHeight - player.size.y;
          player.position.y -= heightDiff;
          player.size.y = player.params.playerHeight;
        }
      },
      update: (player, dt) => {
        const input = player.input;
        if (!input) return;

        // Gravity selection: rising uses riseGravity
        let gravity = player.params.riseGravity;

        // Apex float: near zero velocity, reduce gravity
        player.isInApexFloat = Math.abs(player.velocity.y) < player.params.apexVelocityThreshold;
        if (player.isInApexFloat) {
          gravity *= player.params.apexGravityMultiplier;
        }

        player.currentGravity = gravity;

        // Variable height (jump cut): if jump released early, cut velocity
        if (player.jumpHeld && !input.isHeld(InputAction.Jump)) {
          if (player.velocity.y < 0) {
            player.velocity.y *= player.params.jumpCutMultiplier;
          }
          player.jumpHeld = false;
        }

        // Dash check
        if (player.tryDash()) return;

        // Air control
        const hInput = getHorizontalInput(input);
        if (hInput !== 0) {
          player.facingRight = hInput > 0;
          player.velocity.x += hInput * player.params.airAcceleration * dt;
          player.velocity.x = clamp(player.velocity.x, -player.params.maxRunSpeed, player.params.maxRunSpeed);
        } else {
          // Air deceleration
          if (player.velocity.x > 0) {
            player.velocity.x = Math.max(0, player.velocity.x - player.params.airDeceleration * dt);
          } else if (player.velocity.x < 0) {
            player.velocity.x = Math.min(0, player.velocity.x + player.params.airDeceleration * dt);
          }
        }

        // Wall-slide entry from JUMPING (only when moving downward past a wall)
        if (player.velocity.y > 0 && player.wallJumpLockoutTimer <= 0 && player.tileMap) {
          const hInput = getHorizontalInput(input);
          const touchingRight = player.tileMap.isTouchingWall(player, 1);
          const touchingLeft = player.tileMap.isTouchingWall(player, -1);

          if (touchingRight && (hInput > 0 || player.velocity.y > 0)) {
            player.wallSide = 1;
            player.stateMachine.setState(STATE_WALL_SLIDING);
            return;
          }
          if (touchingLeft && (hInput < 0 || player.velocity.y > 0)) {
            player.wallSide = -1;
            player.stateMachine.setState(STATE_WALL_SLIDING);
            return;
          }
        }

        // Transition to FALLING when velocity becomes downward
        if (player.velocity.y >= 0) {
          player.stateMachine.setState(STATE_FALLING);
          return;
        }
      },
    });

    this.stateMachine.addState({
      name: STATE_FALLING,
      enter: (player) => {
        // Determine if coyote jump is available
        // Coyote is available if we entered FALLING from a ground state (not from JUMPING)
        const prev = player.stateMachine.getPreviousState();
        if (prev !== STATE_JUMPING && prev !== STATE_WALL_JUMPING && prev !== STATE_DASHING) {
          player.canCoyoteJump = true;
          player.coyoteTimer = 0;
        } else {
          player.canCoyoteJump = false;
        }
        player.currentGravity = player.params.fallGravity;
        // Only reset fall duration if coming from JUMPING (we continue from it)
        // If coming from ground states, start counting
        if (prev !== STATE_JUMPING) {
          player.fallDurationFrames = 0;
        }
      },
      update: (player, dt) => {
        const input = player.input;

        // Track fall duration
        player.fallDurationFrames++;

        // Gravity: always fallGravity, with apex float modulation
        let gravity = player.params.fallGravity;
        player.isInApexFloat = Math.abs(player.velocity.y) < player.params.apexVelocityThreshold;
        if (player.isInApexFloat) {
          gravity *= player.params.apexGravityMultiplier;
        }
        player.currentGravity = gravity;

        // Coyote time: increment timer if eligible
        if (player.canCoyoteJump) {
          player.coyoteTimer++;
          if (player.coyoteTimer > player.params.coyoteFrames) {
            player.canCoyoteJump = false;
          }
        }

        // Coyote jump check
        if (input && player.canCoyoteJump) {
          if (input.isPressed(InputAction.Jump) || input.consumeBufferedInput(InputAction.Jump, player.params.jumpBufferFrames)) {
            player.canCoyoteJump = false;
            player.stateMachine.setState(STATE_JUMPING);
            return;
          }
        }

        // Wall coyote jump
        if (input && player.canWallCoyoteJump && player.wallCoyoteTimer <= player.params.wallJumpCoyoteFrames) {
          if (input.isPressed(InputAction.Jump) || input.consumeBufferedInput(InputAction.Jump, player.params.jumpBufferFrames)) {
            player.canWallCoyoteJump = false;
            player.stateMachine.setState(STATE_WALL_JUMPING);
            return;
          }
          player.wallCoyoteTimer++;
        } else {
          player.canWallCoyoteJump = false;
        }

        // Dash check
        if (input && player.tryDash()) return;

        // Air control
        if (input) {
          const hInput = getHorizontalInput(input);
          if (hInput !== 0) {
            player.facingRight = hInput > 0;
            player.velocity.x += hInput * player.params.airAcceleration * dt;
            player.velocity.x = clamp(player.velocity.x, -player.params.maxRunSpeed, player.params.maxRunSpeed);
          } else {
            // Air deceleration
            if (player.velocity.x > 0) {
              player.velocity.x = Math.max(0, player.velocity.x - player.params.airDeceleration * dt);
            } else if (player.velocity.x < 0) {
              player.velocity.x = Math.min(0, player.velocity.x + player.params.airDeceleration * dt);
            }
          }
        }

        // Wall-slide entry: touching wall, moving down or slow up, not locked out
        if (input && player.wallJumpLockoutTimer <= 0 && !player.grounded && player.tileMap) {
          const touchingRight = player.tileMap.isTouchingWall(player, 1);
          const touchingLeft = player.tileMap.isTouchingWall(player, -1);
          const hInput = getHorizontalInput(input);

          if (touchingRight && (hInput > 0 || player.velocity.y > 0) && player.velocity.y > -50) {
            player.wallSide = 1;
            player.stateMachine.setState(STATE_WALL_SLIDING);
            return;
          }
          if (touchingLeft && (hInput < 0 || player.velocity.y > 0) && player.velocity.y > -50) {
            player.wallSide = -1;
            player.stateMachine.setState(STATE_WALL_SLIDING);
            return;
          }
        }

        // Landing
        if (player.grounded) {
          // Bouncy surface handling — bounce the player upward
          // Use preLandingVelocityY because collision resolution already zeroed velocity.y
          const surface = player.currentSurface;
          const holdingCrouch = input ? input.isHeld(InputAction.Down) : false;
          const impactVelocity = Math.abs(player.preLandingVelocityY);
          if (surface.bounce > 0 && impactVelocity > 50 && !holdingCrouch) {
            // Reflect vertical velocity with bounce coefficient
            player.velocity.y = -impactVelocity * surface.bounce;
            player.grounded = false;
            player.fallDurationFrames = 0;
            player.isBouncing = true;
            player.stateMachine.setState(STATE_JUMPING);
            return;
          }

          // Determine landing type
          const fallFrames = player.fallDurationFrames;
          const isHardLanding = fallFrames >= player.params.hardLandThresholdFrames;
          const isSoftLanding = fallFrames >= player.params.softLandThresholdFrames;

          // Check for buffered jump (bounce) — works even in hard landing
          if (input && input.consumeBufferedInput(InputAction.Jump, player.params.jumpBufferFrames)) {
            // Still apply landing visual effects
            if (isHardLanding) {
              player.applySquash(player.params.hardLandScaleX, player.params.hardLandScaleY);
              player.emitFeetParticles(10, Math.PI * 1.2, 120, 0.25, 2, 4, 200);
              player.emitPebbleParticles();
              // Screen shake even on buffered-jump hard landing
              if (player.screenShake) {
                const fallRatio = Math.min(1, player.fallDurationFrames / 60);
                const magnitude = 3 + fallRatio * 2;
                const duration = 4 + Math.round(fallRatio * 2);
                player.screenShake.shake(magnitude, duration);
              }
            } else if (isSoftLanding) {
              player.applySquash(player.params.softLandScaleX, player.params.softLandScaleY);
              player.emitFeetParticles(4, Math.PI * 0.8, 60, 0.12, 1.5, 3, 150);
            }
            player.lastLandingType = isHardLanding ? "HARD" : isSoftLanding ? "SOFT" : null;
            player.landingFlashTimer = 30;
            player.stateMachine.setState(STATE_JUMPING);
            return;
          }

          // Restore standing height if we were crouching when we fell
          if (player.size.y < player.params.playerHeight) {
            if (player.canStandUp()) {
              const heightDiff = player.params.playerHeight - player.size.y;
              player.position.y -= heightDiff;
              player.size.y = player.params.playerHeight;
            } else {
              // No headroom — land in crouching state
              player.stateMachine.setState(STATE_CROUCHING);
              return;
            }
          }

          if (isHardLanding) {
            // Hard landing — recovery state
            player.stateMachine.setState(STATE_HARD_LANDING);
          } else {
            // Soft landing or no significant fall
            if (isSoftLanding) {
              player.applySquash(player.params.softLandScaleX, player.params.softLandScaleY);
              player.emitFeetParticles(4, Math.PI * 0.8, 60, 0.12, 1.5, 3, 150);
              player.lastLandingType = "SOFT";
              player.landingFlashTimer = 30;
            }

            const hInput = input ? getHorizontalInput(input) : 0;
            if (hInput !== 0) {
              player.stateMachine.setState(STATE_RUNNING);
            } else {
              player.stateMachine.setState(STATE_IDLE);
            }
          }
        }
      },
    });

    this.stateMachine.addState({
      name: STATE_HARD_LANDING,
      enter: (player) => {
        player.hardLandRecoveryTimer = player.params.hardLandRecoveryFrames;
        player.velocity.x = 0;
        player.currentGravity = player.params.fallGravity;

        // Hard landing visual effects
        player.applySquash(player.params.hardLandScaleX, player.params.hardLandScaleY);
        player.emitFeetParticles(10, Math.PI * 1.2, 120, 0.25, 2, 4, 200);
        player.emitPebbleParticles();
        player.lastLandingType = "HARD";
        player.landingFlashTimer = 30;

        // Screen shake — scale with fall duration
        if (player.screenShake) {
          const fallRatio = Math.min(1, player.fallDurationFrames / 60);
          const magnitude = 3 + fallRatio * 2;
          const duration = 4 + Math.round(fallRatio * 2);
          player.screenShake.shake(magnitude, duration);
        }
      },
      update: (player, _dt) => {
        const input = player.input;
        player.currentGravity = player.params.fallGravity;

        // Dash-cancel out of hard landing (critical for flow)
        if (input && player.tryDash()) return;

        // Jump-buffer out of hard landing
        if (input && (input.isPressed(InputAction.Jump) || input.consumeBufferedInput(InputAction.Jump, player.params.jumpBufferFrames))) {
          player.stateMachine.setState(STATE_JUMPING);
          return;
        }

        if (!player.grounded) {
          player.stateMachine.setState(STATE_FALLING);
          return;
        }

        player.hardLandRecoveryTimer--;
        if (player.hardLandRecoveryTimer <= 0) {
          const hInput = input ? getHorizontalInput(input) : 0;
          if (hInput !== 0) {
            player.stateMachine.setState(STATE_RUNNING);
          } else {
            player.stateMachine.setState(STATE_IDLE);
          }
        }
      },
    });

    this.stateMachine.addState({
      name: STATE_WALL_SLIDING,
      enter: (player) => {
        // Brief stick on wall contact
        player.wallStickTimer = player.params.wallStickFrames;
        // Zero out horizontal velocity (snap to wall)
        player.velocity.x = 0;
        // Don't cut upward velocity — let it bleed off naturally
        player.currentGravity = 0; // Gravity handled manually via slide speed
        player.canWallCoyoteJump = false;
        player.wallSlideParticleTimer = 0;

        // Wall-slide entry squash + particles (5 particles with downward bias)
        player.applySquash(player.params.wallSlideEntryScaleX, player.params.wallSlideEntryScaleY);
        player.emitWallParticles(5, player.wallSide === 1, 0.2, 0.3);
      },
      update: (player, dt) => {
        const input = player.input;
        if (!input) return;

        // No gravity — we control velocity.y directly
        player.currentGravity = 0;

        const hInput = getHorizontalInput(input);
        const holdingTowardWall = (player.wallSide === 1 && hInput > 0) || (player.wallSide === -1 && hInput < 0);
        const holdingAwayFromWall = (player.wallSide === 1 && hInput < 0) || (player.wallSide === -1 && hInput > 0);

        // Ongoing wall-slide particles (every ~6 frames)
        player.wallSlideParticleTimer++;
        if (player.wallSlideParticleTimer >= 6 && player.particleSystem) {
          player.wallSlideParticleTimer = 0;
          const wallX = player.wallSide === 1
            ? player.position.x + player.size.x
            : player.position.x;
          const contactY = player.position.y + player.size.y * 0.3;
          player.particleSystem.emit({
            x: wallX,
            y: contactY,
            count: 2,
            speedMin: 5,
            speedMax: 20,
            angleMin: Math.PI * 0.3,
            angleMax: Math.PI * 0.7,
            lifeMin: 0.1,
            lifeMax: 0.15,
            sizeMin: 1,
            sizeMax: 2,
            colors: DUST_COLORS,
            gravity: 30,
          });
        }

        // Wall stick: brief pause on initial contact
        if (player.wallStickTimer > 0) {
          player.wallStickTimer--;
          player.velocity.y = 0;
          player.velocity.x = 0;

          // Still allow dash during stick
          if (player.tryDash()) return;
          // Still allow jump during stick
          if (input.isPressed(InputAction.Jump) || input.consumeBufferedInput(InputAction.Jump, player.params.jumpBufferFrames)) {
            player.stateMachine.setState(STATE_WALL_JUMPING);
            return;
          }
          // Still allow detach during stick
          if (holdingAwayFromWall) {
            player.canWallCoyoteJump = true;
            player.wallCoyoteTimer = 0;
            player.stateMachine.setState(STATE_FALLING);
            return;
          }
          return;
        }

        // Dash check
        if (player.tryDash()) return;

        // Jump check (highest priority after stick)
        if (input.isPressed(InputAction.Jump) || input.consumeBufferedInput(InputAction.Jump, player.params.jumpBufferFrames)) {
          player.stateMachine.setState(STATE_WALL_JUMPING);
          return;
        }

        // Leave wall if holding away
        if (holdingAwayFromWall) {
          player.canWallCoyoteJump = true;
          player.wallCoyoteTimer = 0;
          player.stateMachine.setState(STATE_FALLING);
          return;
        }

        // Check if still touching wall
        if (player.tileMap && !player.tileMap.isTouchingWall(player, player.wallSide as -1 | 1)) {
          player.canWallCoyoteJump = true;
          player.wallCoyoteTimer = 0;
          player.stateMachine.setState(STATE_FALLING);
          return;
        }

        // Graduated friction: determine max slide speed based on input
        // Wall surface friction modifies the slide speed (higher friction = slower slide)
        const wallSurface = player.currentWallSurface;
        const maxSlideSpeed = holdingTowardWall
          ? player.params.wallSlideGripSpeed / wallSurface.wallFrictionMultiplier
          : player.params.wallSlideBaseSpeed / wallSurface.wallFrictionMultiplier;

        // Accelerate toward max slide speed (smoothly ramp, don't snap)
        const accel = player.params.wallSlideAcceleration;
        if (player.velocity.y < maxSlideSpeed) {
          player.velocity.y = Math.min(maxSlideSpeed, player.velocity.y + accel * dt);
        } else if (player.velocity.y > maxSlideSpeed) {
          // Decelerate if over max (e.g., switching from base to grip)
          player.velocity.y = Math.max(maxSlideSpeed, player.velocity.y - accel * dt);
        }

        // Keep snapped to wall (zero horizontal velocity)
        player.velocity.x = 0;

        // Ground: if grounded, transition to ground state
        if (player.grounded) {
          const groundH = input ? getHorizontalInput(input) : 0;
          if (groundH !== 0) {
            player.stateMachine.setState(STATE_RUNNING);
          } else {
            player.stateMachine.setState(STATE_IDLE);
          }
          return;
        }
      },
      exit: (_player) => {
        // Wall side for coyote time is already set before transition
      },
    });

    this.stateMachine.addState({
      name: STATE_WALL_JUMPING,
      enter: (player) => {
        // Launch away from wall
        player.velocity.y = -player.params.wallJumpVerticalSpeed;
        player.velocity.x = player.params.wallJumpHorizontalSpeed * (-player.wallSide as number);
        player.wallJumpLockoutTimer = player.params.wallJumpLockoutFrames;
        player.jumpHeld = true;
        player.canWallCoyoteJump = false;
        player.facingRight = player.wallSide < 0; // Face away from wall
        player.currentGravity = player.params.riseGravity;
        player.fallDurationFrames = 0;

        // Wall-jump squash + wall particles
        player.applySquash(player.params.wallJumpScaleX, player.params.wallJumpScaleY);
        player.emitWallParticles(6, player.wallSide === 1, 0.15);

        // Ensure standing height
        if (player.size.y < player.params.playerHeight) {
          const heightDiff = player.params.playerHeight - player.size.y;
          player.position.y -= heightDiff;
          player.size.y = player.params.playerHeight;
        }
      },
      update: (player, _dt) => {
        const input = player.input;
        if (!input) return;

        // Gravity: rising uses riseGravity
        let gravity = player.params.riseGravity;

        // Apex float
        player.isInApexFloat = Math.abs(player.velocity.y) < player.params.apexVelocityThreshold;
        if (player.isInApexFloat) {
          gravity *= player.params.apexGravityMultiplier;
        }

        player.currentGravity = gravity;

        // Variable height (jump cut)
        if (player.jumpHeld && !input.isHeld(InputAction.Jump)) {
          if (player.velocity.y < 0) {
            player.velocity.y *= player.params.jumpCutMultiplier;
          }
          player.jumpHeld = false;
        }

        if (player.wallJumpLockoutTimer > 0) {
          // During lockout: no air control, just gravity
          // Lockout timer is decremented in Player.update()
        } else {
          // After lockout: transition to JUMPING or FALLING
          if (player.velocity.y < 0) {
            player.stateMachine.setState(STATE_JUMPING);
          } else {
            player.stateMachine.setState(STATE_FALLING);
          }
          return;
        }
      },
    });

    this.stateMachine.addState({
      name: STATE_DASHING,
      enter: (player) => {
        const input = player.input;

        // Resolve dash direction from current input + facing
        let dx = 0;
        let dy = 0;
        if (input) {
          if (input.isHeld(InputAction.Left)) dx -= 1;
          if (input.isHeld(InputAction.Right)) dx += 1;
          if (input.isHeld(InputAction.Up)) dy -= 1;
          if (input.isHeld(InputAction.Down)) dy += 1;
        }
        // If no direction held, dash in facing direction
        if (dx === 0 && dy === 0) {
          dx = player.facingRight ? 1 : -1;
        }
        // Normalize for diagonal dashes
        const mag = Math.sqrt(dx * dx + dy * dy);
        if (mag > 0) {
          dx /= mag;
          dy /= mag;
        }

        player.dashDirection = { x: dx, y: dy };
        player.dashWasGrounded = player.grounded;
        player.dashAvailable = false;
        player.dashTrailPositions = [];
        player.dashTrailFadeTimer = 0;

        // If dashing from crouch, try to uncrouch
        if (player.size.y < player.params.playerHeight) {
          if (player.canStandUp()) {
            const heightDiff = player.params.playerHeight - player.size.y;
            player.position.y -= heightDiff;
            player.size.y = player.params.playerHeight;
          } else {
            // Can't uncrouch — only allow horizontal dash
            player.dashDirection.y = 0;
            if (player.dashDirection.x === 0) {
              player.dashDirection.x = player.facingRight ? 1 : -1;
            }
            // Re-normalize so diagonal-turned-horizontal still has full speed
            const cMag = Math.abs(player.dashDirection.x);
            if (cMag > 0 && cMag !== 1) {
              player.dashDirection.x /= cMag;
            }
          }
        }

        // Dash start squash + particles
        // For vertical dashes, swap X/Y scales
        const isVerticalDash = Math.abs(dy) > Math.abs(dx);
        if (isVerticalDash) {
          player.applySquash(player.params.dashStartScaleY, player.params.dashStartScaleX);
        } else {
          player.applySquash(player.params.dashStartScaleX, player.params.dashStartScaleY);
        }
        // Dash start particles at origin
        if (player.particleSystem) {
          player.particleSystem.emit({
            x: player.position.x + player.size.x / 2,
            y: player.position.y + player.size.y / 2,
            count: 4,
            speedMin: 30,
            speedMax: 70,
            angleMin: 0,
            angleMax: Math.PI * 2,
            lifeMin: 0.08,
            lifeMax: 0.12,
            sizeMin: 1.5,
            sizeMax: 3,
            colors: DUST_COLORS,
            gravity: 0,
          });
        }

        // Wind-up phase
        player.dashWindupTimer = player.params.dashWindupFrames;
        player.isInDashWindup = true;
        player.isDashing = false;

        // Zero velocity during wind-up
        player.velocity.x = 0;
        player.velocity.y = 0;
        player.currentGravity = 0;
      },
      update: (player, _dt) => {
        player.currentGravity = 0;

        // Phase 1: Wind-up
        if (player.dashWindupTimer > 0) {
          player.dashWindupTimer--;
          player.velocity.x = 0;
          player.velocity.y = 0;

          if (player.dashWindupTimer <= 0) {
            // Transition to active dash — fall through to Phase 2 so the
            // first active frame isn't wasted with zero velocity
            player.isDashing = true;
            player.isInDashWindup = false;
            player.dashTimer = player.params.dashDurationFrames;
          } else {
            return;
          }
        }

        // Phase 2: Active dash
        player.velocity.x = player.dashDirection.x * player.params.dashSpeed;
        player.velocity.y = player.dashDirection.y * player.params.dashSpeed;

        // Store trail position
        if (player.dashTrailPositions.length < 8) {
          player.dashTrailPositions.push({ x: player.position.x, y: player.position.y });
        } else {
          // Ring buffer: overwrite oldest
          player.dashTrailPositions.shift();
          player.dashTrailPositions.push({ x: player.position.x, y: player.position.y });
        }

        player.dashTimer--;

        if (player.dashTimer <= 0) {
          // Dash ends — transition based on state
          player.dashTrailFadeTimer = 4;

          // Dash end recoil squash + particles
          player.applySquash(player.params.dashEndScaleX, player.params.dashEndScaleY);
          if (player.particleSystem) {
            player.particleSystem.emit({
              x: player.position.x + player.size.x / 2,
              y: player.position.y + player.size.y / 2,
              count: 5,
              speedMin: 30,
              speedMax: 80,
              angleMin: 0,
              angleMax: Math.PI * 2,
              lifeMin: 0.1,
              lifeMax: 0.15,
              sizeMin: 1.5,
              sizeMax: 3,
              colors: DUST_COLORS,
              gravity: 0,
            });
          }

          exitDash(player);
        }
      },
      exit: (player) => {
        player.isDashing = false;
        player.isInDashWindup = false;
        player.dashCooldownTimer = player.params.dashCooldownFrames;
      },
    });
  }

  /** Debug: force the player into a specific state (e.g., "IDLE", "RUNNING") */
  forceState(state: string): void {
    this.stateMachine.setState(state);
  }

  /** Check if there's room to stand up from a crouch */
  canStandUp(): boolean {
    if (!this.tileMap) return true;
    const heightDiff = this.params.playerHeight - this.params.crouchHeight;
    // Check if the standing hitbox would collide with anything
    const standingBounds = {
      x: this.position.x,
      y: this.position.y - heightDiff,
      width: this.size.x,
      height: this.params.playerHeight,
    };
    return this.tileMap.checkCollision(standingBounds) === null;
  }

  override update(dt: number): void {
    // Store previous position for interpolation
    this.prevPosition.x = this.position.x;
    this.prevPosition.y = this.position.y;

    // Reset coyote timer when grounded (before state machine runs)
    if (this.grounded) {
      this.coyoteTimer = 0;
    }

    // Run state machine (sets currentGravity + applies state-specific velocity changes)
    this.stateMachine.update(dt);

    // Apply state-based gravity
    this.velocity.y += this.currentGravity * dt;
    if (this.velocity.y > this.params.maxFallSpeed) {
      this.velocity.y = this.params.maxFallSpeed;
    }

    // Apply velocity to position
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    // Decrement wall-jump lockout timer
    if (this.wallJumpLockoutTimer > 0) {
      this.wallJumpLockoutTimer--;
    }

    // Dash cooldown
    if (this.dashCooldownTimer > 0) {
      this.dashCooldownTimer--;
      if (this.dashCooldownTimer <= 0) {
        this.dashAvailable = true;
      }
    }

    // Dash trail fade
    if (this.dashTrailFadeTimer > 0) {
      this.dashTrailFadeTimer--;
      if (this.dashTrailFadeTimer <= 0) {
        this.dashTrailPositions = [];
      }
    }

    // New squash-stretch triggers (run after state machine)
    if (this.params.squashStretchEnabled) {
      const currentState = this.stateMachine.getCurrentState();

      // A. Apex float entry — subtle vertical stretch at top of jump arc
      if (this.isInApexFloat && !this.wasInApexFloat) {
        this.applySquash(this.params.apexFloatScaleX, this.params.apexFloatScaleY);
      }
      this.wasInApexFloat = this.isInApexFloat;

      // B. Fast fall stretch — vertical stretch during fast descent (fires once)
      if (currentState === STATE_FALLING && !this.isInApexFloat) {
        const fallRatio = Math.min(1, this.velocity.y / this.params.maxFallSpeed);
        if (fallRatio > 0.5 && !this.fastFallSquashApplied) {
          this.applySquash(this.params.fastFallScaleX, this.params.fastFallScaleY);
          this.fastFallSquashApplied = true;
        }
      }
      if (currentState !== STATE_FALLING && currentState !== STATE_JUMPING) {
        this.fastFallSquashApplied = false;
      }

      // C. Run footstrike — very subtle compression on foot contacts at speed
      if (currentState === STATE_RUNNING && this.activeAnimController) {
        const frameIndex = this.activeAnimController.getCurrentFrameIndex();
        if ((frameIndex === 0 || frameIndex === 4) && frameIndex !== this.lastRunFootstrikeFrame) {
          if (Math.abs(this.velocity.x) > this.params.maxRunSpeed * 0.4) {
            this.applySquash(this.params.runFootstrikeScaleX, this.params.runFootstrikeScaleY);
          }
          this.lastRunFootstrikeFrame = frameIndex;
        } else if (frameIndex !== 0 && frameIndex !== 4) {
          this.lastRunFootstrikeFrame = -1;
        }
      }
    }

    // Squash-stretch return to (1, 1) via lerp
    if (this.params.squashStretchEnabled) {
      this.scaleX += (this.targetScaleX - this.scaleX) * this.params.scaleReturnSpeed * dt;
      this.scaleY += (this.targetScaleY - this.scaleY) * this.params.scaleReturnSpeed * dt;
      // Snap if very close
      if (Math.abs(this.scaleX - this.targetScaleX) < 0.005) this.scaleX = this.targetScaleX;
      if (Math.abs(this.scaleY - this.targetScaleY) < 0.005) this.scaleY = this.targetScaleY;
    } else {
      this.scaleX = 1.0;
      this.scaleY = 1.0;
    }

    // Landing flash timer
    if (this.landingFlashTimer > 0) {
      this.landingFlashTimer--;
      if (this.landingFlashTimer <= 0) {
        this.lastLandingType = null;
      }
    }

    // Store pre-collision velocity for bounce detection
    this.preLandingVelocityY = this.velocity.y;

    // Resolve collisions with tilemap
    if (this.tileMap) {
      const result = this.tileMap.resolveCollisions(this);
      this.grounded = result.grounded;

      // Ceiling collision: if in JUMPING or WALL_JUMPING state and hit ceiling, transition to FALLING
      const currentState = this.stateMachine.getCurrentState();
      if (result.hitCeiling && (currentState === STATE_JUMPING || currentState === STATE_WALL_JUMPING)) {
        this.velocity.y = 0;
        this.stateMachine.setState(STATE_FALLING);
      }
    }

    // Update sprite animation based on current state
    if (this.spritesReady) {
      const currentState = this.stateMachine.getCurrentState();
      const rawMapping = STATE_TO_ANIMATION[currentState];
      if (rawMapping) {
        // Resolve fallback: use primary sheet if it's a real asset, otherwise fall back
        let mapping: StateAnimMapping = rawMapping;
        if (rawMapping.fallback) {
          const assetManager = AssetManager.getInstance();
          if (!assetManager.isRealAsset(rawMapping.sheetId)) {
            mapping = rawMapping.fallback;
          }
        }

        // Override animation when in apex float (both JUMPING and early FALLING)
        const isApexOverride = (currentState === STATE_JUMPING || currentState === STATE_FALLING) && this.isInApexFloat;
        if (isApexOverride) {
          const assetManager = AssetManager.getInstance();
          if (assetManager.isRealAsset("player-jump-fall")) {
            mapping = { sheetId: "player-jump-fall", animName: "jump-apex", facesLeft: true };
          } else if (assetManager.isRealAsset("player-jump")) {
            mapping = { sheetId: "player-jump", animName: "jump-apex", facesLeft: true };
          }
        }
        const apexChanged = isApexOverride !== this.apexAnimActive;
        this.apexAnimActive = isApexOverride;

        // Detect state animation change
        const animKey = `${mapping.sheetId}:${mapping.animName}`;
        if (animKey !== this.previousStateAnimKey) {
          // Capture crossfade from outgoing animation before switching
          // Use 2-frame crossfade for apex float transitions (within same state)
          const crossfadeDuration = apexChanged
            ? 2
            : getCrossfadeDuration(this.previousStateName, currentState);
          if (crossfadeDuration > 0 && this.activeAnimController) {
            this.crossfadeState = {
              outgoingController: this.activeAnimController,
              outgoingFrameIndex: this.activeAnimController.getCurrentFrameIndex(),
              outgoingFacesLeft: this.activeAnimFacesLeft,
              progress: 0,
              durationFrames: crossfadeDuration,
              elapsedFrames: 0,
            };
          } else {
            this.crossfadeState = null;
          }

          this.previousStateAnimKey = animKey;
          this.previousStateName = currentState;

          // Check for transition animation (only if primary mapping has it and its sheet is real)
          if (rawMapping.transitionAnim) {
            const transSheetId = rawMapping.transitionAnim.sheetId;
            const assetManager = AssetManager.getInstance();
            const transIsReal = assetManager.isRealAsset(transSheetId);
            const transController = transIsReal ? this.animControllers.get(transSheetId) : null;
            if (transController) {
              this.transitionAnimActive = true;
              this.transitionAnimController = transController;
              transController.restart(rawMapping.transitionAnim.animName);
              this.activeAnimController = transController;
              this.activeAnimFacesLeft = mapping.facesLeft ?? false;
              transController.update(dt);
              return;
            }
          }

          // No transition — switch directly
          this.transitionAnimActive = false;
          this.transitionAnimController = null;
        }

        // Advance crossfade progress
        if (this.crossfadeState) {
          this.crossfadeState.elapsedFrames++;
          this.crossfadeState.progress = Math.min(
            1.0,
            this.crossfadeState.elapsedFrames / this.crossfadeState.durationFrames,
          );
          if (this.crossfadeState.progress >= 1.0) {
            this.crossfadeState = null;
          }
        }

        // If transition is playing, check if it finished
        if (this.transitionAnimActive && this.transitionAnimController) {
          this.transitionAnimController.update(dt);
          if (this.transitionAnimController.isFinished()) {
            // Transition done, switch to main animation
            this.transitionAnimActive = false;
            this.transitionAnimController = null;
          } else {
            this.activeAnimController = this.transitionAnimController;
            return;
          }
        }

        // Main animation
        const controller = this.animControllers.get(mapping.sheetId);
        if (controller) {
          this.activeAnimController = controller;
          this.activeAnimFacesLeft = mapping.facesLeft ?? false;
          controller.play(mapping.animName);
          controller.update(dt);
        }

        // Run cycle animation overrides (skid, turn)
        // These temporarily swap the active controller for visual-only effects
        const assetMgr = AssetManager.getInstance();

        // Skid animation override: play run-stop when stopping from run
        if (currentState === STATE_IDLE && this.skidAnimTimer > 0) {
          const runStopController = this.animControllers.get("player-run-stop");
          if (runStopController && assetMgr.isRealAsset("player-run-stop")) {
            if (this.skidAnimTimer === 4) {
              // First frame: start the run-stop animation
              runStopController.restart("run-stop");
            }
            runStopController.update(dt);
            this.activeAnimController = runStopController;
            this.activeAnimFacesLeft = false;
          }
          this.skidAnimTimer--;
        }

        // Turn animation override: play turn during direction reversal
        if (currentState === STATE_RUNNING && this.turnAnimTimer > 0) {
          const turnController = this.animControllers.get("player-turn");
          if (turnController && assetMgr.isRealAsset("player-turn")) {
            if (this.turnAnimTimer === 3) {
              // First frame: start the turn animation
              turnController.restart("turn");
            }
            turnController.update(dt);
            this.activeAnimController = turnController;
            this.activeAnimFacesLeft = false;
          }
          this.turnAnimTimer--;
        }
      }
    }
  }

  override render(renderer: Renderer, interpolation: number): void {
    const pos = this.getInterpolatedPosition(interpolation);
    const state = this.stateMachine.getCurrentState();

    // Draw dash trail (ghost positions)
    if (this.dashTrailPositions.length > 0) {
      const len = this.dashTrailPositions.length;
      for (let i = 0; i < len; i++) {
        const t = this.dashTrailPositions[i];
        const alpha = this.dashTrailFadeTimer > 0
          ? (0.1 + 0.15 * (i / len)) * (this.dashTrailFadeTimer / 4)
          : 0.1 + 0.2 * (i / len);
        const r = 244, g = 114, b = 182; // #f472b6
        renderer.fillRect(t.x, t.y, this.size.x, this.size.y, `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`);
      }
    }

    // Sprite rendering
    if (RenderConfig.useSprites() && this.spritesReady && this.activeAnimController) {
      const sheet = this.activeAnimController.getSpriteSheet();
      if (sheet.isLoaded()) {
        const ctx = renderer.getContext();
        const flipX = this.activeAnimFacesLeft ? this.facingRight : !this.facingRight;
        const useScale = this.params.squashStretchEnabled && (this.scaleX !== 1.0 || this.scaleY !== 1.0);

        if (this.crossfadeState) {
          const prevAlpha = ctx.globalAlpha;
          const outAlpha = 1 - this.crossfadeState.progress;
          const inAlpha = this.crossfadeState.progress;

          // Draw outgoing frame (fading out)
          const outSheet = this.crossfadeState.outgoingController.getSpriteSheet();
          if (outSheet.isLoaded()) {
            const outFlipX = this.crossfadeState.outgoingFacesLeft
              ? this.facingRight : !this.facingRight;
            ctx.globalAlpha = prevAlpha * outAlpha;
            if (useScale) {
              const cx = pos.x + this.size.x / 2;
              const bottom = pos.y + this.size.y;
              outSheet.drawFrame(
                ctx,
                this.crossfadeState.outgoingFrameIndex,
                cx - outSheet.config.frameWidth * this.scaleX / 2,
                bottom - outSheet.config.frameHeight * this.scaleY,
                outFlipX,
                this.scaleX,
                this.scaleY,
              );
            } else {
              const outOffsetX = (outSheet.config.frameWidth - this.size.x) / 2;
              const outOffsetY = outSheet.config.frameHeight - this.size.y;
              outSheet.drawFrame(
                ctx,
                this.crossfadeState.outgoingFrameIndex,
                pos.x - outOffsetX,
                pos.y - outOffsetY,
                outFlipX,
              );
            }
          }

          // Draw incoming frame (fading in)
          ctx.globalAlpha = prevAlpha * inAlpha;
          if (useScale) {
            const cx = pos.x + this.size.x / 2;
            const bottom = pos.y + this.size.y;
            this.activeAnimController.draw(
              ctx,
              cx - sheet.config.frameWidth * this.scaleX / 2,
              bottom - sheet.config.frameHeight * this.scaleY,
              flipX,
              this.scaleX,
              this.scaleY,
            );
          } else {
            const spriteOffsetX = (sheet.config.frameWidth - this.size.x) / 2;
            const spriteOffsetY = sheet.config.frameHeight - this.size.y;
            this.activeAnimController.draw(
              ctx,
              pos.x - spriteOffsetX,
              pos.y - spriteOffsetY,
              flipX,
            );
          }

          ctx.globalAlpha = prevAlpha;
        } else {
          // Normal rendering (no crossfade)
          if (useScale) {
            const cx = pos.x + this.size.x / 2;
            const bottom = pos.y + this.size.y;
            this.activeAnimController.draw(
              ctx,
              cx - sheet.config.frameWidth * this.scaleX / 2,
              bottom - sheet.config.frameHeight * this.scaleY,
              flipX,
              this.scaleX,
              this.scaleY,
            );
          } else {
            const spriteOffsetX = (sheet.config.frameWidth - this.size.x) / 2;
            const spriteOffsetY = sheet.config.frameHeight - this.size.y;
            this.activeAnimController.draw(
              ctx,
              pos.x - spriteOffsetX,
              pos.y - spriteOffsetY,
              flipX,
            );
          }
        }
      }
    }

    // Rectangle rendering (with squash-stretch + state colors)
    if (RenderConfig.useRectangles()) {
      let bodyColor = "#3b82f6"; // blue
      if (state === STATE_DASHING) {
        if (this.isInDashWindup) {
          bodyColor = "#ffffff"; // white flash during wind-up
        } else {
          bodyColor = "#f472b6"; // hot pink during active dash
        }
      } else if (state === STATE_HARD_LANDING) {
        bodyColor = "#f59e0b"; // amber during hard landing recovery
      } else if (state === STATE_RUNNING) {
        const speedRatio = Math.abs(this.velocity.x) / this.params.maxRunSpeed;
        if (speedRatio > 0.9) {
          bodyColor = "#60a5fa"; // lighter blue at max speed
        }
      } else if (state === STATE_CROUCHING || state === STATE_CROUCH_SLIDING) {
        bodyColor = "#2563eb"; // darker blue when crouching
      } else if (state === STATE_JUMPING) {
        bodyColor = "#818cf8"; // indigo when jumping
      } else if (state === STATE_FALLING) {
        bodyColor = "#6366f1"; // purple when falling
      } else if (state === STATE_WALL_SLIDING) {
        bodyColor = "#2dd4bf"; // teal when wall-sliding
      } else if (state === STATE_WALL_JUMPING) {
        bodyColor = "#a78bfa"; // violet when wall-jumping
      }

      // In "both" mode, draw rectangle at 50% alpha
      const ctx = renderer.getContext();
      if (RenderConfig.getMode() === "both") {
        ctx.globalAlpha = 0.5;
      }

      // Visual rect: centered on collision box, scaled by squash-stretch
      if (this.params.squashStretchEnabled && (this.scaleX !== 1.0 || this.scaleY !== 1.0)) {
        const cx = pos.x + this.size.x / 2;
        const cy = pos.y + this.size.y / 2;
        const visualW = this.size.x * this.scaleX;
        const visualH = this.size.y * this.scaleY;
        renderer.fillRect(cx - visualW / 2, cy - visualH / 2, visualW, visualH, bodyColor);
      } else {
        renderer.fillRect(pos.x, pos.y, this.size.x, this.size.y, bodyColor);
      }

      if (RenderConfig.getMode() === "both") {
        ctx.globalAlpha = 1;
      }

      // Motion blur ghost for crouch-slide
      if (state === STATE_CROUCH_SLIDING && Math.abs(this.velocity.x) > this.params.slideMinSpeed) {
        const ghostOffset = this.facingRight ? -8 : 8;
        renderer.fillRect(pos.x + ghostOffset, pos.y, this.size.x, this.size.y, "rgba(59, 130, 246, 0.3)");
      }
    }
  }
}

function exitDash(player: Player): void {
  const input = player.input;
  const hInput = input ? getHorizontalInput(input) : 0;

  if (player.grounded) {
    // Ground dash exit
    const dashingForward = (player.dashDirection.x > 0 && hInput > 0) || (player.dashDirection.x < 0 && hInput < 0);
    if (hInput !== 0 && dashingForward) {
      player.dashSpeedBoostRemaining = player.params.dashSpeedBoost;
      player.stateMachine.setState(STATE_RUNNING);
    } else {
      player.stateMachine.setState(STATE_IDLE);
    }
  } else if (player.tileMap && (player.tileMap.isTouchingWall(player, 1) || player.tileMap.isTouchingWall(player, -1))) {
    // Air dash into wall
    const touchingRight = player.tileMap.isTouchingWall(player, 1);
    const holdingIntoWall = (touchingRight && hInput > 0) || (!touchingRight && hInput < 0);
    if (holdingIntoWall && player.velocity.y >= 0) {
      player.wallSide = touchingRight ? 1 : -1;
      player.stateMachine.setState(STATE_WALL_SLIDING);
    } else {
      player.velocity.x = player.dashDirection.x * player.params.maxRunSpeed;
      player.velocity.y = 0;
      player.stateMachine.setState(STATE_FALLING);
    }
  } else {
    // Air dash exit
    player.velocity.x = player.dashDirection.x * player.params.maxRunSpeed;
    if (player.velocity.y < 0) {
      player.stateMachine.setState(STATE_JUMPING);
    } else {
      player.velocity.y = 0;
      player.stateMachine.setState(STATE_FALLING);
    }
  }
}

function getHorizontalInput(input: InputManager): number {
  const left = input.isHeld(InputAction.Left);
  const right = input.isHeld(InputAction.Right);
  if (left && !right) return -1;
  if (right && !left) return 1;
  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
