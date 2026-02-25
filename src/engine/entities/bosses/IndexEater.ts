import { StateMachine } from "@/engine/states/StateMachine";
import type { ParticleSystem } from "@/engine/core/ParticleSystem";
import type { ScreenShake } from "@/engine/core/ScreenShake";
import type { Camera } from "@/engine/core/Camera";
import { RenderConfig } from "@/engine/core/RenderConfig";
import { AnimationController } from "@/engine/core/AnimationController";
import { AssetManager } from "@/engine/core/AssetManager";
import type { Vec2, Rect } from "@/lib/types";
import type { Platform } from "@/engine/physics/TileMap";
import type { IndexEaterParams } from "./IndexEaterParams";
import { DEFAULT_INDEX_EATER_PARAMS } from "./IndexEaterParams";
import type { DamageZone } from "./types";
import {
  EATER_SPRITE_CONFIGS,
  EATER_ANIMATIONS,
  EATER_STATE_TO_ANIMATION,
} from "./BossSprites";

// ─── Sub-entity types ──────────────────────────────────────────────

interface DestructiblePlatform {
  platform: Platform;
  tier: "floor" | "mid" | "high";
  destroyed: boolean;
  cracking: boolean;
  crackProgress: number;
  id: string;
}

interface CardProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  damage: number;
  rotation: number;
  rotationSpeed: number;
  active: boolean;
  stuck: boolean;
  stuckTimer: number;
}

interface InkFloodZone {
  rect: Rect;
  damagePerSec: number;
  remainingFrames: number;
  fadeProgress: number;
}

interface Shockwave {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  damage: number;
  range: number;
  originX: number;
  active: boolean;
}

// ─── Constants ─────────────────────────────────────────────────────

const DEATH_DURATION = 120;
const HIT_FLASH_FRAMES = 4;
const DEG_TO_RAD = Math.PI / 180;
const STUCK_CARD_DURATION = 120; // frames before stuck cards disappear

// Arena dimensions (must match the test page)
const ARENA_WIDTH = 1440;
const ARENA_HEIGHT = 640;

// Attack sequences per phase
const PHASE_1_SEQUENCE = [
  "chase",
  "lunge-bite",
  "chase",
  "chain-whip",
  "chase",
  "index-spit",
  "lunge-bite",
  "chase",
  "chain-whip",
  "index-spit",
  "patrol",
];

const PHASE_2_SEQUENCE = [
  "chase",
  "lunge-bite",
  "devour",
  "chase",
  "chain-whip",
  "ink-flood",
  "chase",
  "lunge-bite",
  "devour",
  "chase",
  "chain-whip",
];

const PHASE_3_SEQUENCE = [
  "climb-wall",
  "drop-pounce",
  "chain-storm",
  "climb-ceiling",
  "drop-pounce",
  "devour",
];

// Colors
const BODY_COLOR = "#d4a574";
const BODY_COLOR_DARK = "#c4956a";
const TAB_COLOR = "#5c3d2e";
const INK_COLOR = "#1e293b";
const CHAIN_COLOR = "#78716c";

// ─── IndexEater Class ──────────────────────────────────────────────

export class IndexEater {
  params: IndexEaterParams;

  // Health
  health: number;
  maxHealth: number;
  currentPhase: 1 | 2 | 3 = 1;
  isAlive = true;
  invincibilityFrames = 0;
  totalDamageReceived = 0;

  // Position (mobile)
  position: Vec2;
  size: Vec2;
  velocity: Vec2 = { x: 0, y: 0 };
  facingRight = false;

  // Surface attachment
  currentSurface: "floor" | "left-wall" | "right-wall" | "ceiling" = "floor";
  surfacePlatform: Platform | null = null;

  // State machine
  stateMachine: StateMachine<IndexEater>;
  stateTimer = 0;

  // Attack sequencer
  attackSequence: string[] = [...PHASE_1_SEQUENCE];
  sequenceIndex = 0;
  currentAttack: string | null = null;

  // Lunge state
  private lungeStartX = 0;
  private lungeTargetX = 0;

  // Chain whip state
  private whipAngle = 0;

  // Index spit / projectiles
  spitCards: CardProjectile[] = [];

  // Devour state
  private devourTargetPlatform: DestructiblePlatform | null = null;

  // Ink flood state
  inkFloodZones: InkFloodZone[] = [];

  // Pounce state (Phase 3)
  private pounceTarget: Vec2 | null = null;
  private pounceStart: Vec2 | null = null;
  private pounceProgress = 0;

  // Chain storm state
  private chainStormAngleOffset = 0;

  // Death thrash state
  private thrashImpactsRemaining = 0;
  private thrashTarget: Vec2 | null = null;
  private deathThrashUsed = false;

  // Arena state
  destructiblePlatforms: DestructiblePlatform[] = [];
  destroyedCount = 0;
  autoCrumbleTimer = 0;
  crumblingPlatform: DestructiblePlatform | null = null;
  crumbleWarningTimer = 0;

  // Platform change callback (set by test page)
  onPlatformDestroyed: (() => void) | null = null;

  // Shockwaves
  shockwaves: Shockwave[] = [];

  // Visual state
  hitFlashTimer = 0;
  phaseTransitionTimer = 0;
  private legAnimCounter = 0;
  mouthOpen = 0;
  private bodyRotation = 0;
  private targetBodyRotation = 0;
  deathTimer = 0;
  frameCounter = 0;
  hitstopTimer = 0;

  // Systems (set externally)
  particleSystem: ParticleSystem | null = null;
  screenShake: ScreenShake | null = null;
  camera: Camera | null = null;

  // AI toggle
  aiEnabled = true;

  // Player tracking
  private playerPosition: Vec2 = { x: 0, y: 0 };

  // Sprite animation
  private animControllers = new Map<string, AnimationController>();
  private activeAnimController: AnimationController | null = null;
  private spritesReady = false;

  constructor(position?: Vec2, params?: Partial<IndexEaterParams>) {
    this.params = { ...DEFAULT_INDEX_EATER_PARAMS, ...params };
    this.health = this.params.maxHealth;
    this.maxHealth = this.params.maxHealth;

    this.position = position ? { ...position } : { x: 1100, y: 480 };
    this.size = { x: this.params.bodyWidth, y: this.params.bodyHeight };

    this.stateMachine = new StateMachine<IndexEater>(this);
    this.registerStates();
    this.stateMachine.setState("IDLE");
    this.initSprites();
  }

  // ─── Sprite Initialization ─────────────────────────────────────

  private initSprites(): void {
    const assetManager = AssetManager.getInstance();
    assetManager.loadAll(EATER_SPRITE_CONFIGS).then(() => {
      for (const config of EATER_SPRITE_CONFIGS) {
        const sheet = assetManager.getSpriteSheet(config.id);
        if (sheet) {
          const anims = EATER_ANIMATIONS[config.id];
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
      // Sprite loading failed — fall back to rectangle rendering
    });
  }

  // ─── State Registration ────────────────────────────────────────

  private registerStates(): void {
    // ─── IDLE ──────────────────────────────────────────────────
    this.stateMachine.addState({
      name: "IDLE",
      enter: (b) => {
        b.stateTimer = b.params.invulnBetweenAttacks;
        b.mouthOpen = 0;
      },
      update: (b) => {
        if (!b.aiEnabled) return;
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.nextAttack();
        }
      },
    });

    // ─── PATROL ────────────────────────────────────────────────
    this.stateMachine.addState({
      name: "PATROL",
      enter: (b) => {
        b.stateTimer = 60;
        b.mouthOpen = 0;
      },
      update: (b) => {
        if (!b.aiEnabled) {
          b.moveOnSurface(b.params.patrolSpeed * 0.5);
          return;
        }
        b.moveOnSurface(b.params.patrolSpeed);
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.nextAttack();
        }
      },
    });

    // ─── CHASE ─────────────────────────────────────────────────
    this.stateMachine.addState({
      name: "CHASE",
      enter: (b) => {
        b.stateTimer = 90; // chase for up to 90 frames
        b.mouthOpen = 0;
      },
      update: (b) => {
        if (!b.aiEnabled) return;
        // Face toward player
        const bcx = b.position.x + b.size.x / 2;
        b.facingRight = b.playerPosition.x > bcx;

        b.moveOnSurface(b.params.chaseSpeed);
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.nextAttack();
        }
      },
    });

    // ─── LUNGE BITE ────────────────────────────────────────────
    this.stateMachine.addState({
      name: "LUNGE_TELEGRAPH",
      enter: (b) => {
        const isP2 = b.currentPhase >= 2;
        b.stateTimer = isP2 ? b.params.p2LungeTelegraph : b.params.lungeTelegraph;
        b.mouthOpen = 0;
        b.velocity.x = 0;
        // Face the player
        const bcx = b.position.x + b.size.x / 2;
        b.facingRight = b.playerPosition.x > bcx;
      },
      update: (b) => {
        b.stateTimer--;
        // Open mouth during telegraph
        const isP2 = b.currentPhase >= 2;
        const total = isP2 ? b.params.p2LungeTelegraph : b.params.lungeTelegraph;
        b.mouthOpen = Math.min(1, 1 - b.stateTimer / total);
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("LUNGE_ATTACK");
        }
      },
    });

    this.stateMachine.addState({
      name: "LUNGE_ATTACK",
      enter: (b) => {
        b.stateTimer = b.params.lungeDuration;
        const isP2 = b.currentPhase >= 2;
        const dist = isP2 ? b.params.p2LungeDistance : b.params.lungeDistance;
        b.lungeStartX = b.position.x;
        b.lungeTargetX = b.facingRight
          ? b.position.x + dist
          : b.position.x - dist;
        b.mouthOpen = 1;
      },
      update: (b) => {
        b.stateTimer--;
        const progress = 1 - b.stateTimer / b.params.lungeDuration;
        // Ease-out: fast start, slow end
        const easedProgress = 1 - (1 - progress) * (1 - progress);
        b.position.x = b.lungeStartX + (b.lungeTargetX - b.lungeStartX) * easedProgress;
        // Clamp to arena bounds
        b.position.x = Math.max(20, Math.min(ARENA_WIDTH - 20 - b.size.x, b.position.x));

        if (b.stateTimer <= 0) {
          b.stateMachine.setState("LUNGE_RECOVERY");
        }
      },
    });

    this.stateMachine.addState({
      name: "LUNGE_RECOVERY",
      enter: (b) => {
        const isP2 = b.currentPhase >= 2;
        b.stateTimer = isP2 ? b.params.p2LungeRecovery : b.params.lungeRecovery;
        b.mouthOpen = 0;
        b.velocity.x = 0;
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("IDLE");
        }
      },
    });

    // ─── CHAIN WHIP ────────────────────────────────────────────
    this.stateMachine.addState({
      name: "WHIP_TELEGRAPH",
      enter: (b) => {
        b.stateTimer = b.params.whipTelegraph;
        b.velocity.x = 0;
        b.whipAngle = 0;
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("WHIP_ATTACK");
        }
      },
    });

    this.stateMachine.addState({
      name: "WHIP_ATTACK",
      enter: (b) => {
        b.stateTimer = b.params.whipDuration;
        b.whipAngle = 0;
      },
      update: (b) => {
        b.stateTimer--;
        // Sweep the whip from one side to the other behind the boss
        const progress = 1 - b.stateTimer / b.params.whipDuration;
        b.whipAngle = progress * Math.PI;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("WHIP_COOLDOWN");
        }
      },
    });

    this.stateMachine.addState({
      name: "WHIP_COOLDOWN",
      enter: (b) => {
        b.stateTimer = b.params.whipCooldown;
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("IDLE");
        }
      },
    });

    // ─── INDEX SPIT ────────────────────────────────────────────
    this.stateMachine.addState({
      name: "SPIT_TELEGRAPH",
      enter: (b) => {
        b.stateTimer = b.params.spitTelegraph;
        b.velocity.x = 0;
        // Face the player
        const bcx = b.position.x + b.size.x / 2;
        b.facingRight = b.playerPosition.x > bcx;
        b.mouthOpen = 0;
      },
      update: (b) => {
        b.stateTimer--;
        b.mouthOpen = Math.min(0.6, (1 - b.stateTimer / b.params.spitTelegraph) * 0.6);
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("SPIT_FIRE");
        }
      },
    });

    this.stateMachine.addState({
      name: "SPIT_FIRE",
      enter: (b) => {
        b.stateTimer = 8;
        b.mouthOpen = 1;
        b.spawnCards();
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.mouthOpen = 0;
          b.stateMachine.setState("SPIT_COOLDOWN");
        }
      },
    });

    this.stateMachine.addState({
      name: "SPIT_COOLDOWN",
      enter: (b) => {
        b.stateTimer = b.params.spitCooldown;
        b.mouthOpen = 0;
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("IDLE");
        }
      },
    });

    // ─── DEVOUR ────────────────────────────────────────────────
    this.stateMachine.addState({
      name: "DEVOUR_TELEGRAPH",
      enter: (b) => {
        const isP3 = b.currentPhase === 3;
        b.stateTimer = isP3 ? b.params.p3DevourTelegraph : b.params.devourTelegraph;
        b.velocity.x = 0;
        b.mouthOpen = 0;
        // Pick target platform
        b.devourTargetPlatform = b.pickDevourTarget();
        if (b.devourTargetPlatform) {
          b.devourTargetPlatform.cracking = true;
          b.devourTargetPlatform.crackProgress = 0;
        }
      },
      update: (b) => {
        b.stateTimer--;
        const isP3 = b.currentPhase === 3;
        const total = isP3 ? b.params.p3DevourTelegraph : b.params.devourTelegraph;
        const progress = 1 - b.stateTimer / total;
        b.mouthOpen = progress;
        if (b.devourTargetPlatform) {
          b.devourTargetPlatform.crackProgress = progress;
        }
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("DEVOUR_EATING");
        }
      },
    });

    this.stateMachine.addState({
      name: "DEVOUR_EATING",
      enter: (b) => {
        b.stateTimer = b.params.devourDuration;
        b.mouthOpen = 1;
        // Destroy the platform
        if (b.devourTargetPlatform && !b.devourTargetPlatform.destroyed) {
          b.destroyPlatform(b.devourTargetPlatform);
        }
        b.screenShake?.shake(6, 10);
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          // Spawn shockwaves if not Phase 3
          if (b.currentPhase < 3 && b.devourTargetPlatform) {
            const plat = b.devourTargetPlatform.platform;
            const cx = plat.x + plat.width / 2;
            b.spawnShockwave(cx, plat.y, -1, b.params.devourShockwaveSpeed, b.params.devourShockwaveRange, b.params.devourShockwaveHeight, b.params.devourShockwaveDamage);
            b.spawnShockwave(cx, plat.y, 1, b.params.devourShockwaveSpeed, b.params.devourShockwaveRange, b.params.devourShockwaveHeight, b.params.devourShockwaveDamage);
          }
          b.stateMachine.setState("DEVOUR_STUNNED");
        }
      },
    });

    this.stateMachine.addState({
      name: "DEVOUR_STUNNED",
      enter: (b) => {
        const isP3 = b.currentPhase === 3;
        b.stateTimer = isP3 ? b.params.p3DevourStunned : b.params.devourStunned;
        b.mouthOpen = 0.6;
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("DEVOUR_RECOVER");
        }
      },
    });

    this.stateMachine.addState({
      name: "DEVOUR_RECOVER",
      enter: (b) => {
        b.stateTimer = b.params.devourRecover;
        b.mouthOpen = 0;
        b.devourTargetPlatform = null;
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("IDLE");
        }
      },
    });

    // ─── INK FLOOD ─────────────────────────────────────────────
    this.stateMachine.addState({
      name: "INK_FLOOD_TELEGRAPH",
      enter: (b) => {
        b.stateTimer = b.params.inkFloodTelegraph;
        b.velocity.x = 0;
        b.mouthOpen = 0.3;
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("INK_FLOOD_ACTIVE");
        }
      },
    });

    this.stateMachine.addState({
      name: "INK_FLOOD_ACTIVE",
      enter: (b) => {
        b.stateTimer = b.params.inkFloodDuration;
        b.mouthOpen = 0;
        // Spawn ink flood zones on current and adjacent floor sections
        b.spawnInkFlood();
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("INK_FLOOD_COOLDOWN");
        }
      },
    });

    this.stateMachine.addState({
      name: "INK_FLOOD_COOLDOWN",
      enter: (b) => {
        b.stateTimer = 20;
        b.mouthOpen = 0;
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("IDLE");
        }
      },
    });

    // ─── CLIMBING ──────────────────────────────────────────────
    this.stateMachine.addState({
      name: "CLIMB_TO_WALL",
      enter: (b) => {
        b.stateTimer = 15;
        b.velocity.x = 0;
        // Pick nearest wall
        const cx = b.position.x + b.size.x / 2;
        if (cx < ARENA_WIDTH / 2) {
          b.currentSurface = "left-wall";
          b.targetBodyRotation = Math.PI / 2;
        } else {
          b.currentSurface = "right-wall";
          b.targetBodyRotation = -Math.PI / 2;
        }
      },
      update: (b) => {
        b.stateTimer--;
        // Animate rotation
        const progress = 1 - b.stateTimer / 15;
        b.bodyRotation = b.bodyRotation + (b.targetBodyRotation - b.bodyRotation) * progress;
        // Move toward wall
        if (b.currentSurface === "left-wall") {
          b.position.x += (20 - b.position.x) * progress * 0.3;
        } else {
          b.position.x += (ARENA_WIDTH - 20 - b.size.x - b.position.x) * progress * 0.3;
        }
        if (b.stateTimer <= 0) {
          // Snap to wall
          if (b.currentSurface === "left-wall") {
            b.position.x = 20;
            b.bodyRotation = Math.PI / 2;
          } else {
            b.position.x = ARENA_WIDTH - 20 - b.size.y; // on wall, body is rotated
            b.bodyRotation = -Math.PI / 2;
          }
          b.stateMachine.setState("WALL_CRAWL");
        }
      },
    });

    this.stateMachine.addState({
      name: "WALL_CRAWL",
      enter: (b) => {
        b.stateTimer = 30;
      },
      update: (b) => {
        if (!b.aiEnabled) return;
        // Move vertically toward player
        const bcy = b.position.y + b.size.y / 2;
        const dir = b.playerPosition.y < bcy ? -1 : 1;
        b.position.y += dir * b.params.climbSpeed / 60;
        b.position.y = Math.max(20, Math.min(ARENA_HEIGHT - b.size.y, b.position.y));
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.nextAttack();
        }
      },
    });

    this.stateMachine.addState({
      name: "CLIMB_TO_CEILING",
      enter: (b) => {
        b.stateTimer = 15;
        b.currentSurface = "ceiling";
        b.targetBodyRotation = Math.PI;
      },
      update: (b) => {
        b.stateTimer--;
        const progress = 1 - b.stateTimer / 15;
        b.bodyRotation = b.bodyRotation + (b.targetBodyRotation - b.bodyRotation) * progress;
        b.position.y += (20 - b.position.y) * progress * 0.3;
        if (b.stateTimer <= 0) {
          b.position.y = 20;
          b.bodyRotation = Math.PI;
          b.stateMachine.setState("CEILING_CRAWL");
        }
      },
    });

    this.stateMachine.addState({
      name: "CEILING_CRAWL",
      enter: (b) => {
        b.stateTimer = 30;
      },
      update: (b) => {
        if (!b.aiEnabled) return;
        const bcx = b.position.x + b.size.x / 2;
        const dir = b.playerPosition.x > bcx ? 1 : -1;
        b.position.x += dir * b.params.climbSpeed / 60;
        b.position.x = Math.max(20, Math.min(ARENA_WIDTH - 20 - b.size.x, b.position.x));
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.nextAttack();
        }
      },
    });

    // ─── DROP POUNCE ───────────────────────────────────────────
    this.stateMachine.addState({
      name: "POUNCE_TELEGRAPH",
      enter: (b) => {
        b.stateTimer = b.params.pounceTelegraph;
        b.pounceTarget = { ...b.playerPosition };
        b.pounceStart = { x: b.position.x + b.size.x / 2, y: b.position.y + b.size.y / 2 };
        b.pounceProgress = 0;
      },
      update: (b) => {
        b.stateTimer--;
        // Update target to player position during telegraph
        b.pounceTarget = { ...b.playerPosition };
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("POUNCE_ATTACK");
        }
      },
    });

    this.stateMachine.addState({
      name: "POUNCE_ATTACK",
      enter: (b) => {
        if (!b.pounceTarget || !b.pounceStart) {
          b.stateMachine.setState("IDLE");
          return;
        }
        const dx = b.pounceTarget.x - b.pounceStart.x;
        const dy = b.pounceTarget.y - b.pounceStart.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const frames = Math.max(4, Math.ceil(dist / (b.params.pounceSpeed / 60)));
        b.stateTimer = frames;
        b.pounceProgress = 0;
        b.bodyRotation = 0;
        b.currentSurface = "floor";
      },
      update: (b) => {
        if (!b.pounceTarget || !b.pounceStart) return;
        b.stateTimer--;
        const dx = b.pounceTarget.x - b.pounceStart.x;
        const dy = b.pounceTarget.y - b.pounceStart.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const frames = Math.max(4, Math.ceil(dist / (b.params.pounceSpeed / 60)));
        b.pounceProgress = 1 - b.stateTimer / frames;
        b.position.x = b.pounceStart.x + dx * b.pounceProgress - b.size.x / 2;
        b.position.y = b.pounceStart.y + dy * b.pounceProgress - b.size.y / 2;
        // Clamp
        b.position.x = Math.max(20, Math.min(ARENA_WIDTH - 20 - b.size.x, b.position.x));
        b.position.y = Math.max(20, Math.min(ARENA_HEIGHT - b.size.y, b.position.y));

        if (b.stateTimer <= 0) {
          b.stateMachine.setState("POUNCE_IMPACT");
        }
      },
    });

    this.stateMachine.addState({
      name: "POUNCE_IMPACT",
      enter: (b) => {
        b.stateTimer = 5;
        b.screenShake?.shake(5, 8);
        b.bodyRotation = 0;
        b.currentSurface = "floor";
        // Shockwave
        const cx = b.position.x + b.size.x / 2;
        const cy = b.position.y + b.size.y;
        b.spawnShockwave(cx, cy - b.params.pounceShockwaveHeight, -1, 300, b.params.pounceShockwaveRange, b.params.pounceShockwaveHeight, b.params.pounceDamage);
        b.spawnShockwave(cx, cy - b.params.pounceShockwaveHeight, 1, 300, b.params.pounceShockwaveRange, b.params.pounceShockwaveHeight, b.params.pounceDamage);
        b.particleSystem?.emit({
          x: cx,
          y: cy,
          count: 15,
          speedMin: 100,
          speedMax: 300,
          angleMin: Math.PI * 0.8,
          angleMax: Math.PI * 1.2,
          lifeMin: 0.2,
          lifeMax: 0.6,
          sizeMin: 2,
          sizeMax: 6,
          colors: [BODY_COLOR, TAB_COLOR, "#ffffff"],
          gravity: 300,
        });
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("POUNCE_STUNNED");
        }
      },
    });

    this.stateMachine.addState({
      name: "POUNCE_STUNNED",
      enter: (b) => {
        b.stateTimer = b.params.pounceStunned;
        b.mouthOpen = 0.4;
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("POUNCE_RECOVER");
        }
      },
    });

    this.stateMachine.addState({
      name: "POUNCE_RECOVER",
      enter: (b) => {
        b.stateTimer = b.params.pounceRecover;
        b.mouthOpen = 0;
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("IDLE");
        }
      },
    });

    // ─── CHAIN STORM ───────────────────────────────────────────
    this.stateMachine.addState({
      name: "CHAIN_STORM_TELEGRAPH",
      enter: (b) => {
        b.stateTimer = b.params.chainStormTelegraph;
        b.velocity.x = 0;
        b.chainStormAngleOffset = 0;
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("CHAIN_STORM_ACTIVE");
        }
      },
    });

    this.stateMachine.addState({
      name: "CHAIN_STORM_ACTIVE",
      enter: (b) => {
        b.stateTimer = b.params.chainStormDuration;
        b.chainStormAngleOffset = 0;
      },
      update: (b) => {
        b.stateTimer--;
        b.chainStormAngleOffset += 0.15;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("CHAIN_STORM_COOLDOWN");
        }
      },
    });

    this.stateMachine.addState({
      name: "CHAIN_STORM_COOLDOWN",
      enter: (b) => {
        b.stateTimer = b.params.chainStormCooldown;
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("IDLE");
        }
      },
    });

    // ─── DEATH THRASH ──────────────────────────────────────────
    this.stateMachine.addState({
      name: "DEATH_THRASH_TELEGRAPH",
      enter: (b) => {
        b.stateTimer = b.params.deathThrashTelegraph;
        // Move to ceiling center
        b.currentSurface = "ceiling";
        b.bodyRotation = Math.PI;
        b.position.x = ARENA_WIDTH / 2 - b.size.x / 2;
        b.position.y = 20;
        b.velocity.x = 0;
        b.mouthOpen = 1;
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.thrashImpactsRemaining = b.params.deathThrashImpactCount;
          b.stateMachine.setState("DEATH_THRASH_BOUNCE");
        }
      },
    });

    this.stateMachine.addState({
      name: "DEATH_THRASH_BOUNCE",
      enter: (b) => {
        b.stateTimer = b.params.deathThrashImpactInterval;
        b.bodyRotation = 0;
        b.currentSurface = "floor";
        // Pick target near player
        b.thrashTarget = {
          x: b.playerPosition.x + (Math.random() - 0.5) * 200,
          y: b.playerPosition.y,
        };
        b.thrashTarget.x = Math.max(40, Math.min(ARENA_WIDTH - 40, b.thrashTarget.x));
        b.thrashTarget.y = Math.max(40, Math.min(ARENA_HEIGHT - 40, b.thrashTarget.y));
        b.pounceStart = { x: b.position.x + b.size.x / 2, y: b.position.y + b.size.y / 2 };
      },
      update: (b) => {
        if (!b.thrashTarget || !b.pounceStart) return;
        b.stateTimer--;
        // Move toward thrash target
        const dx = b.thrashTarget.x - b.pounceStart.x;
        const dy = b.thrashTarget.y - b.pounceStart.y;
        const totalFrames = b.params.deathThrashImpactInterval;
        const progress = 1 - b.stateTimer / totalFrames;
        b.position.x = b.pounceStart.x + dx * progress - b.size.x / 2;
        b.position.y = b.pounceStart.y + dy * progress - b.size.y / 2;
        b.position.x = Math.max(20, Math.min(ARENA_WIDTH - 20 - b.size.x, b.position.x));
        b.position.y = Math.max(20, Math.min(ARENA_HEIGHT - b.size.y, b.position.y));

        if (b.stateTimer <= 0) {
          // Impact!
          b.screenShake?.shake(5, 6);
          const cx = b.position.x + b.size.x / 2;
          const cy = b.position.y + b.size.y;
          b.spawnShockwave(cx, cy - b.params.deathThrashShockwaveHeight, -1, 400, b.params.deathThrashShockwaveRange, b.params.deathThrashShockwaveHeight, b.params.deathThrashDamage);
          b.spawnShockwave(cx, cy - b.params.deathThrashShockwaveHeight, 1, 400, b.params.deathThrashShockwaveRange, b.params.deathThrashShockwaveHeight, b.params.deathThrashDamage);

          b.particleSystem?.emit({
            x: cx,
            y: cy,
            count: 12,
            speedMin: 80,
            speedMax: 250,
            angleMin: 0,
            angleMax: Math.PI * 2,
            lifeMin: 0.2,
            lifeMax: 0.5,
            sizeMin: 2,
            sizeMax: 5,
            colors: [BODY_COLOR, TAB_COLOR, INK_COLOR],
            gravity: 200,
          });

          b.thrashImpactsRemaining--;
          if (b.thrashImpactsRemaining <= 0) {
            b.stateMachine.setState("DEATH_THRASH_COLLAPSE");
          } else {
            // Bounce to next target
            b.pounceStart = { x: b.position.x + b.size.x / 2, y: b.position.y + b.size.y / 2 };
            b.thrashTarget = {
              x: b.playerPosition.x + (Math.random() - 0.5) * 200,
              y: Math.random() < 0.5 ? 60 : ARENA_HEIGHT - 100,
            };
            b.thrashTarget.x = Math.max(40, Math.min(ARENA_WIDTH - 40, b.thrashTarget.x));
            b.stateTimer = b.params.deathThrashImpactInterval;
          }
        }
      },
    });

    this.stateMachine.addState({
      name: "DEATH_THRASH_COLLAPSE",
      enter: (b) => {
        b.stateTimer = b.params.deathThrashCollapse;
        b.bodyRotation = 0;
        b.currentSurface = "floor";
        b.mouthOpen = 0.8;
        // Fall to bottom
        b.position.y = ARENA_HEIGHT - 80 - b.size.y;
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("DEATH_THRASH_RECOVER");
        }
      },
    });

    this.stateMachine.addState({
      name: "DEATH_THRASH_RECOVER",
      enter: (b) => {
        b.stateTimer = b.params.deathThrashRecover;
        b.mouthOpen = 0;
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("IDLE");
        }
      },
    });

    // ─── PHASE TRANSITION ──────────────────────────────────────
    this.stateMachine.addState({
      name: "PHASE_TRANSITION",
      enter: (b) => {
        b.stateTimer = b.params.phaseTransitionDuration;
        b.phaseTransitionTimer = b.params.phaseTransitionDuration;
        b.mouthOpen = 1;
        b.velocity.x = 0;
        b.screenShake?.shake(4, 20);
        b.particleSystem?.emit({
          x: b.position.x + b.size.x / 2,
          y: b.position.y + b.size.y / 2,
          count: 20,
          speedMin: 50,
          speedMax: 200,
          angleMin: 0,
          angleMax: Math.PI * 2,
          lifeMin: 0.3,
          lifeMax: 0.8,
          sizeMin: 3,
          sizeMax: 8,
          colors: [BODY_COLOR, TAB_COLOR, INK_COLOR, "#ffffff"],
          gravity: 100,
        });
      },
      update: (b) => {
        b.stateTimer--;
        b.phaseTransitionTimer = b.stateTimer;
        if (b.stateTimer <= 0) {
          b.mouthOpen = 0;
          // Phase 2 transition: devour a floor section
          if (b.currentPhase === 2) {
            b.stateMachine.setState("DEVOUR_TELEGRAPH");
          } else if (b.currentPhase === 3) {
            // Phase 3: climb the wall
            b.stateMachine.setState("CLIMB_TO_WALL");
          } else {
            b.stateMachine.setState("IDLE");
          }
        }
      },
    });

    // ─── DYING ─────────────────────────────────────────────────
    this.stateMachine.addState({
      name: "DYING",
      enter: (b) => {
        b.stateTimer = DEATH_DURATION;
        b.deathTimer = DEATH_DURATION;
        b.velocity.x = 0;
        b.mouthOpen = 1;
        b.screenShake?.shake(4, 20);
      },
      update: (b) => {
        b.stateTimer--;
        b.deathTimer = b.stateTimer;

        // Segment disconnect particles
        if (b.stateTimer % 15 === 0 && b.stateTimer > 30) {
          const segIdx = Math.floor((DEATH_DURATION - b.stateTimer) / 15) % b.params.segmentCount;
          const sx = b.position.x + segIdx * b.params.segmentWidth + b.params.segmentWidth / 2;
          const sy = b.position.y + b.size.y / 2;
          b.particleSystem?.emit({
            x: sx,
            y: sy,
            count: 8,
            speedMin: 40,
            speedMax: 120,
            angleMin: 0,
            angleMax: Math.PI * 2,
            lifeMin: 0.3,
            lifeMax: 0.7,
            sizeMin: 2,
            sizeMax: 5,
            colors: [BODY_COLOR, TAB_COLOR, CHAIN_COLOR],
            gravity: 150,
          });
        }

        // Ink burst at frame 60
        if (b.stateTimer === 60) {
          b.particleSystem?.emit({
            x: b.position.x + b.size.x / 2,
            y: b.position.y + b.size.y / 2,
            count: 25,
            speedMin: 100,
            speedMax: 350,
            angleMin: 0,
            angleMax: Math.PI * 2,
            lifeMin: 0.4,
            lifeMax: 1.0,
            sizeMin: 3,
            sizeMax: 8,
            colors: [BODY_COLOR, TAB_COLOR, INK_COLOR, "#ffffff", CHAIN_COLOR],
            gravity: 100,
          });
        }

        if (b.stateTimer <= 0) {
          b.stateMachine.setState("DEAD");
        }
      },
    });

    this.stateMachine.addState({
      name: "DEAD",
      enter: (b) => {
        b.isAlive = false;
      },
    });
  }

  // ─── Vulnerability ─────────────────────────────────────────────

  isVulnerable(): boolean {
    if (!this.isAlive) return false;
    if (this.invincibilityFrames > 0) return false;
    if (this.hitstopTimer > 0) return false;

    const state = this.stateMachine.getCurrentState();
    return (
      state === "LUNGE_RECOVERY" ||
      state === "DEVOUR_STUNNED" ||
      state === "POUNCE_STUNNED" ||
      state === "DEATH_THRASH_COLLAPSE"
    );
  }

  // ─── Take Damage ───────────────────────────────────────────────

  takeDamage(damage: number, hitstopFrames: number): boolean {
    if (!this.isVulnerable()) return false;

    this.health -= damage;
    this.totalDamageReceived += damage;
    this.hitFlashTimer = HIT_FLASH_FRAMES;
    this.hitstopTimer = hitstopFrames;
    this.invincibilityFrames = 10;

    this.screenShake?.shake(
      this.params.bossShakeOnHit,
      this.params.bossShakeFrames,
    );

    this.particleSystem?.emit({
      x: this.position.x + this.size.x / 2,
      y: this.position.y + this.size.y / 2,
      count: 8,
      speedMin: 50,
      speedMax: 150,
      angleMin: Math.PI * 0.5,
      angleMax: Math.PI * 1.5,
      lifeMin: 0.2,
      lifeMax: 0.5,
      sizeMin: 2,
      sizeMax: 5,
      colors: [BODY_COLOR, TAB_COLOR, "#ffffff"],
      gravity: 200,
    });

    if (this.health <= 0) {
      this.health = 0;
      this.stateMachine.setState("DYING");
      return true;
    }

    this.checkPhaseTransition();
    return true;
  }

  tryBlockedHit(): void {
    this.particleSystem?.emit({
      x: this.position.x + this.size.x / 2,
      y: this.position.y + this.size.y / 3,
      count: 4,
      speedMin: 30,
      speedMax: 100,
      angleMin: Math.PI * 0.3,
      angleMax: Math.PI * 0.7,
      lifeMin: 0.1,
      lifeMax: 0.3,
      sizeMin: 1,
      sizeMax: 3,
      colors: ["#9ca3af", "#d1d5db", "#ffffff"],
      gravity: 200,
    });
    this.screenShake?.shake(1, 2);
  }

  // ─── Phase Transition Check ────────────────────────────────────

  checkPhaseTransition(): void {
    if (this.currentPhase === 1 && this.health <= this.params.phase1Threshold) {
      this.startPhaseTransition(2);
    } else if (this.currentPhase === 2 && this.health <= this.params.phase2Threshold) {
      this.startPhaseTransition(3);
    }
  }

  private startPhaseTransition(newPhase: 2 | 3): void {
    this.currentPhase = newPhase;

    if (newPhase === 2) {
      this.attackSequence = [...PHASE_2_SEQUENCE];
    } else {
      this.attackSequence = [...PHASE_3_SEQUENCE];
    }
    this.sequenceIndex = 0;

    // Clear active hazards
    this.spitCards = [];
    this.shockwaves = [];
    this.currentAttack = null;
    this.deathThrashUsed = false;

    this.stateMachine.setState("PHASE_TRANSITION");
  }

  // ─── Attack Sequencer ──────────────────────────────────────────

  private nextAttack(): void {
    // Check death thrash
    if (
      this.currentPhase === 3 &&
      this.health <= this.params.deathThrashThreshold &&
      !this.deathThrashUsed
    ) {
      this.deathThrashUsed = true;
      this.currentAttack = "death-thrash";
      this.stateMachine.setState("DEATH_THRASH_TELEGRAPH");
      return;
    }

    const attack = this.attackSequence[this.sequenceIndex];
    this.sequenceIndex = (this.sequenceIndex + 1) % this.attackSequence.length;
    this.currentAttack = attack;

    switch (attack) {
      case "chase":
        this.stateMachine.setState("CHASE");
        break;
      case "patrol":
        this.stateMachine.setState("PATROL");
        break;
      case "lunge-bite":
        this.stateMachine.setState("LUNGE_TELEGRAPH");
        break;
      case "chain-whip":
        this.stateMachine.setState("WHIP_TELEGRAPH");
        break;
      case "index-spit":
        this.stateMachine.setState("SPIT_TELEGRAPH");
        break;
      case "devour":
        this.stateMachine.setState("DEVOUR_TELEGRAPH");
        break;
      case "ink-flood":
        this.stateMachine.setState("INK_FLOOD_TELEGRAPH");
        break;
      case "climb-wall":
        this.stateMachine.setState("CLIMB_TO_WALL");
        break;
      case "climb-ceiling":
        this.stateMachine.setState("CLIMB_TO_CEILING");
        break;
      case "drop-pounce":
        this.stateMachine.setState("POUNCE_TELEGRAPH");
        break;
      case "chain-storm":
        this.stateMachine.setState("CHAIN_STORM_TELEGRAPH");
        break;
      default:
        this.stateMachine.setState("IDLE");
        break;
    }
  }

  // ─── Movement ──────────────────────────────────────────────────

  private moveOnSurface(speed: number): void {
    if (this.currentSurface !== "floor") return;

    const dir = this.facingRight ? 1 : -1;
    const moveAmount = (dir * speed) / 60;
    this.position.x += moveAmount;

    // Clamp to arena
    this.position.x = Math.max(20, Math.min(ARENA_WIDTH - 20 - this.size.x, this.position.x));

    // Turn at edges — check if we've reached an arena wall
    const bcx = this.position.x + this.size.x / 2;
    if (bcx <= 30 || bcx >= ARENA_WIDTH - 30) {
      this.facingRight = !this.facingRight;
    }
  }

  // ─── Projectile / Hazard Spawners ──────────────────────────────

  private spawnCards(): void {
    const center = this.getBodyCenter();
    const dx = this.playerPosition.x - center.x;
    const dy = this.playerPosition.y - center.y;
    const baseAngle = Math.atan2(dy, dx);
    const halfSpread = (this.params.spitSpreadAngle / 2) * DEG_TO_RAD;
    const count = this.params.spitCardCount;

    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0.5;
      const angle = baseAngle - halfSpread + t * halfSpread * 2;
      this.spitCards.push({
        x: center.x,
        y: center.y,
        vx: Math.cos(angle) * this.params.spitCardSpeed,
        vy: Math.sin(angle) * this.params.spitCardSpeed,
        size: this.params.spitCardSize,
        damage: this.params.spitCardDamage,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 8,
        active: true,
        stuck: false,
        stuckTimer: 0,
      });
    }
  }

  private spawnShockwave(x: number, y: number, dir: number, speed: number, range: number, height: number, damage: number): void {
    this.shockwaves.push({
      x: x,
      y: y,
      width: 20,
      height: height,
      vx: dir * speed,
      damage: damage,
      range: range,
      originX: x,
      active: true,
    });
  }

  private spawnInkFlood(): void {
    // Find the floor section the boss is on and adjacent ones
    const bcx = this.position.x + this.size.x / 2;
    const floorPlatforms = this.destructiblePlatforms.filter(
      (dp) => dp.tier === "floor" && !dp.destroyed,
    );

    // Sort by distance to boss center
    floorPlatforms.sort((a, b) => {
      const aDist = Math.abs(a.platform.x + a.platform.width / 2 - bcx);
      const bDist = Math.abs(b.platform.x + b.platform.width / 2 - bcx);
      return aDist - bDist;
    });

    // Take the nearest + adjacent
    const count = Math.min(1 + this.params.inkFloodRange * 2, floorPlatforms.length);
    for (let i = 0; i < count; i++) {
      const plat = floorPlatforms[i].platform;
      this.inkFloodZones.push({
        rect: { x: plat.x, y: plat.y - 4, width: plat.width, height: plat.height + 4 },
        damagePerSec: this.params.inkFloodDamagePerSec,
        remainingFrames: this.params.inkFloodDuration + this.params.inkFloodPersist,
        fadeProgress: 0,
      });
    }
  }

  // ─── Platform Destruction ──────────────────────────────────────

  private pickDevourTarget(): DestructiblePlatform | null {
    const isP3 = this.currentPhase === 3;
    const bcx = this.position.x + this.size.x / 2;

    // In Phase 3: can eat any tier
    // In Phase 2: can eat floor and mid
    // In Phase 1: shouldn't devour (but just in case)
    const candidates = this.destructiblePlatforms.filter((dp) => {
      if (dp.destroyed) return false;
      if (!isP3 && dp.tier === "high") return false;
      return true;
    });

    if (candidates.length === 0) return null;

    // Prefer platform closest to the player
    const pcx = this.playerPosition.x;
    candidates.sort((a, b) => {
      const aDist = Math.abs(a.platform.x + a.platform.width / 2 - pcx);
      const bDist = Math.abs(b.platform.x + b.platform.width / 2 - pcx);
      return aDist - bDist;
    });

    // Don't eat the one the boss is standing on (if possible)
    const standing = candidates.find((dp) => {
      const plat = dp.platform;
      return bcx >= plat.x && bcx <= plat.x + plat.width;
    });

    // If the closest to player is the one we're standing on, pick the next
    if (candidates[0] === standing && candidates.length > 1) {
      return candidates[1];
    }

    return candidates[0];
  }

  private destroyPlatform(dp: DestructiblePlatform): void {
    dp.destroyed = true;
    dp.cracking = false;
    this.destroyedCount++;

    // Particle burst
    const plat = dp.platform;
    this.particleSystem?.emit({
      x: plat.x + plat.width / 2,
      y: plat.y,
      count: 25,
      speedMin: 60,
      speedMax: 250,
      angleMin: Math.PI * 0.6,
      angleMax: Math.PI * 1.4,
      lifeMin: 0.3,
      lifeMax: 0.8,
      sizeMin: 3,
      sizeMax: 8,
      colors: ["#6b7280", "#9ca3af", BODY_COLOR, "#d1d5db"],
      gravity: 300,
    });

    // Notify test page to rebuild TileMap
    this.onPlatformDestroyed?.();
  }

  // ─── Public Arena Methods ──────────────────────────────────────

  initDestructiblePlatforms(
    floors: Platform[],
    mids: Platform[],
    highs: Platform[],
  ): void {
    this.destructiblePlatforms = [];
    this.destroyedCount = 0;

    for (let i = 0; i < floors.length; i++) {
      this.destructiblePlatforms.push({
        platform: floors[i],
        tier: "floor",
        destroyed: false,
        cracking: false,
        crackProgress: 0,
        id: `floor-${i}`,
      });
    }
    for (let i = 0; i < mids.length; i++) {
      this.destructiblePlatforms.push({
        platform: mids[i],
        tier: "mid",
        destroyed: false,
        cracking: false,
        crackProgress: 0,
        id: `mid-${i}`,
      });
    }
    for (let i = 0; i < highs.length; i++) {
      this.destructiblePlatforms.push({
        platform: highs[i],
        tier: "high",
        destroyed: false,
        cracking: false,
        crackProgress: 0,
        id: `high-${i}`,
      });
    }
  }

  getActivePlatforms(): Platform[] {
    return this.destructiblePlatforms
      .filter((dp) => !dp.destroyed)
      .map((dp) => dp.platform);
  }

  // ─── Get Bounds ────────────────────────────────────────────────

  getBounds(): Rect {
    return {
      x: this.position.x,
      y: this.position.y,
      width: this.size.x,
      height: this.size.y,
    };
  }

  getBodyCenter(): Vec2 {
    return {
      x: this.position.x + this.size.x / 2,
      y: this.position.y + this.size.y / 2,
    };
  }

  // ─── Main Update ───────────────────────────────────────────────

  update(dt: number, _playerBounds: Rect, playerPosition: Vec2): void {
    this.playerPosition.x = playerPosition.x;
    this.playerPosition.y = playerPosition.y;
    this.frameCounter++;
    this.legAnimCounter++;

    // Tick timers
    if (this.invincibilityFrames > 0) this.invincibilityFrames--;
    if (this.hitFlashTimer > 0) this.hitFlashTimer--;

    // Hitstop
    if (this.hitstopTimer > 0) {
      this.hitstopTimer--;
      this.updateProjectiles(dt);
      this.updateInkFlood();
      return;
    }

    // Facing direction (during non-attack states)
    const state = this.stateMachine.getCurrentState();
    if (
      this.isAlive &&
      this.currentSurface === "floor" &&
      (state === "PATROL" || state === "IDLE")
    ) {
      // Keep current facing direction during patrol
    }

    // Update state machine
    if (this.isAlive) {
      this.stateMachine.update(dt);
    }

    // Auto-crumble in Phase 3
    if (this.currentPhase === 3 && this.isAlive && this.aiEnabled) {
      this.updateAutoCrumble();
    }

    // Update projectiles
    this.updateProjectiles(dt);

    // Update ink flood
    this.updateInkFlood();

    // Update shockwaves
    this.updateShockwaves(dt);

    // Sprite animation update
    const stateAnim = EATER_STATE_TO_ANIMATION[this.stateMachine.getCurrentState()];
    if (stateAnim && this.spritesReady) {
      const controller = this.animControllers.get(stateAnim.sheetId);
      if (controller) {
        if (this.activeAnimController !== controller) {
          this.activeAnimController = controller;
        }
        controller.play(stateAnim.animName);
        controller.update(dt);
      }
    }
  }

  private updateProjectiles(dt: number): void {
    for (const card of this.spitCards) {
      if (!card.active) continue;

      if (card.stuck) {
        card.stuckTimer--;
        if (card.stuckTimer <= 0) {
          card.active = false;
        }
        continue;
      }

      card.x += card.vx * dt;
      card.y += card.vy * dt;
      card.rotation += card.rotationSpeed * dt;

      // Wall/ceiling collision
      if (card.x < 20 || card.x > ARENA_WIDTH - 20 || card.y < 20 || card.y > ARENA_HEIGHT) {
        card.stuck = true;
        card.stuckTimer = STUCK_CARD_DURATION;
        card.vx = 0;
        card.vy = 0;
      }
    }
    this.spitCards = this.spitCards.filter((c) => c.active);
  }

  private updateInkFlood(): void {
    for (let i = this.inkFloodZones.length - 1; i >= 0; i--) {
      const zone = this.inkFloodZones[i];
      zone.remainingFrames--;
      if (zone.remainingFrames <= this.params.inkFloodPersist) {
        zone.fadeProgress = 1 - zone.remainingFrames / this.params.inkFloodPersist;
      }
      if (zone.remainingFrames <= 0) {
        this.inkFloodZones.splice(i, 1);
      }
    }
  }

  private updateShockwaves(dt: number): void {
    for (const sw of this.shockwaves) {
      if (!sw.active) continue;
      sw.x += sw.vx * dt;
      const traveled = Math.abs(sw.x - sw.originX);
      if (traveled > sw.range) {
        sw.active = false;
      }
    }
    this.shockwaves = this.shockwaves.filter((sw) => sw.active);
  }

  private updateAutoCrumble(): void {
    this.autoCrumbleTimer++;

    if (this.crumblingPlatform) {
      this.crumbleWarningTimer--;
      this.crumblingPlatform.crackProgress = 1 - this.crumbleWarningTimer / this.params.autoCrumbleWarning;
      if (this.crumbleWarningTimer <= 0) {
        this.destroyPlatform(this.crumblingPlatform);
        this.crumblingPlatform = null;
        this.autoCrumbleTimer = 0;
      }
      return;
    }

    if (this.autoCrumbleTimer >= this.params.autoCrumbleInterval) {
      // Pick a random surviving mid or high platform
      const candidates = this.destructiblePlatforms.filter(
        (dp) => !dp.destroyed && (dp.tier === "mid" || dp.tier === "high"),
      );
      if (candidates.length > 0) {
        const idx = Math.floor(Math.random() * candidates.length);
        this.crumblingPlatform = candidates[idx];
        this.crumblingPlatform.cracking = true;
        this.crumblingPlatform.crackProgress = 0;
        this.crumbleWarningTimer = this.params.autoCrumbleWarning;
      }
      this.autoCrumbleTimer = 0;
    }
  }

  // ─── Get Active Hazards ────────────────────────────────────────

  getActiveHazards(): DamageZone[] {
    const hazards: DamageZone[] = [];
    const state = this.stateMachine.getCurrentState();

    // Lunge hitbox
    if (state === "LUNGE_ATTACK") {
      const hx = this.facingRight
        ? this.position.x + this.size.x
        : this.position.x - this.params.lungeHitboxWidth;
      hazards.push({
        rect: {
          x: hx,
          y: this.position.y + (this.size.y - this.params.lungeHitboxHeight) / 2,
          width: this.params.lungeHitboxWidth,
          height: this.params.lungeHitboxHeight,
        },
        damage: this.params.lungeDamage,
        knockback: {
          x: (this.facingRight ? 1 : -1) * this.params.lungeKnockback,
          y: -200,
        },
        type: "lunge",
      });
    }

    // Chain whip hitbox
    if (state === "WHIP_ATTACK") {
      const isP2 = this.currentPhase >= 2;
      const radius = isP2 ? this.params.p2WhipRadius : this.params.whipRadius;
      // Whip sweeps behind the boss
      const behind = this.facingRight ? -1 : 1;
      const centerX = this.position.x + this.size.x / 2 + behind * 20;
      const centerY = this.position.y + this.size.y / 2;
      // Approximate the arc as a rect behind the boss
      hazards.push({
        rect: {
          x: behind > 0 ? centerX : centerX - radius,
          y: centerY - radius / 2,
          width: radius,
          height: radius,
        },
        damage: this.params.whipDamage,
        knockback: {
          x: behind * this.params.whipKnockback,
          y: -150,
        },
        type: "whip",
      });
    }

    // Card projectile hazards
    for (const card of this.spitCards) {
      if (!card.active || card.stuck) continue;
      hazards.push({
        rect: {
          x: card.x - card.size / 2,
          y: card.y - card.size / 2,
          width: card.size,
          height: card.size,
        },
        damage: card.damage,
        knockback: {
          x: card.vx > 0 ? 150 : -150,
          y: -100,
        },
        type: "spit",
      });
    }

    // Ink flood hazards
    for (const zone of this.inkFloodZones) {
      if (zone.fadeProgress >= 1) continue;
      hazards.push({
        rect: zone.rect,
        damage: 0, // Continuous damage tracked by test page
        knockback: { x: 0, y: -50 },
        type: "flood",
      });
    }

    // Pounce body hitbox
    if (state === "POUNCE_ATTACK") {
      hazards.push({
        rect: this.getBounds(),
        damage: this.params.pounceDamage,
        knockback: { x: 0, y: -this.params.pounceKnockback },
        type: "pounce",
      });
    }

    // Chain storm
    if (state === "CHAIN_STORM_ACTIVE") {
      const cx = this.position.x + this.size.x / 2;
      const cy = this.position.y + this.size.y / 2;
      const chainCount = this.params.chainStormChainCount;
      for (let i = 0; i < chainCount; i++) {
        const angle = this.chainStormAngleOffset + (i * Math.PI * 2) / chainCount;
        const endX = cx + Math.cos(angle) * this.params.chainStormRadius;
        const endY = cy + Math.sin(angle) * this.params.chainStormRadius;
        // Create a small hitbox at the chain tip
        hazards.push({
          rect: {
            x: endX - 15,
            y: endY - 15,
            width: 30,
            height: 30,
          },
          damage: this.params.chainStormDamage,
          knockback: {
            x: Math.cos(angle) * 200,
            y: Math.sin(angle) * 200,
          },
          type: "chain-storm",
        });
      }
    }

    // Death thrash body hitbox during bounce
    if (state === "DEATH_THRASH_BOUNCE") {
      hazards.push({
        rect: this.getBounds(),
        damage: this.params.deathThrashDamage,
        knockback: { x: 0, y: -400 },
        type: "thrash",
      });
    }

    // Shockwaves
    for (const sw of this.shockwaves) {
      if (!sw.active) continue;
      hazards.push({
        rect: { x: sw.x, y: sw.y, width: sw.width, height: sw.height },
        damage: sw.damage,
        knockback: { x: sw.vx > 0 ? 300 : -300, y: -200 },
        type: "devour-shockwave",
      });
    }

    return hazards;
  }

  // ─── Render ────────────────────────────────────────────────────

  render(ctx: CanvasRenderingContext2D, _camera: Camera): void {
    const state = this.stateMachine.getCurrentState();
    const mode = RenderConfig.getMode();
    if (state === "DEAD") return;

    const isFlashing = this.hitFlashTimer > 0;
    const deathProgress = state === "DYING" ? 1 - this.stateTimer / DEATH_DURATION : 0;

    ctx.save();

    if (state === "DYING") {
      ctx.globalAlpha = Math.max(0, 1 - deathProgress);
    }

    const cx = this.position.x + this.size.x / 2;
    const cy = this.position.y + this.size.y / 2;

    // Apply rotation for wall/ceiling positions
    if (Math.abs(this.bodyRotation) > 0.01) {
      ctx.translate(cx, cy);
      ctx.rotate(this.bodyRotation);
      ctx.translate(-cx, -cy);
    }

    // ─── Sprite body rendering ──────────────────────────────
    if (mode === "sprites" || mode === "both") {
      if (this.spritesReady && this.activeAnimController) {
        const sheet = this.activeAnimController.getSpriteSheet();
        if (sheet.isLoaded()) {
          // Center sprite over boss center, the rotation is already applied above
          const spriteOffsetX = (sheet.config.frameWidth - this.size.x) / 2;
          const spriteOffsetY = sheet.config.frameHeight - this.size.y;
          const drawX = this.position.x - spriteOffsetX;
          const drawY = this.position.y - spriteOffsetY;

          this.activeAnimController.draw(ctx, drawX, drawY, !this.facingRight);

          // Hit flash overlay on top of sprite
          if (isFlashing) {
            const savedAlpha = ctx.globalAlpha;
            ctx.globalAlpha = savedAlpha * 0.7;
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(drawX, drawY, sheet.config.frameWidth, sheet.config.frameHeight);
            ctx.globalAlpha = savedAlpha;
          }
        }
      } else {
        // Placeholder fallback
        ctx.fillStyle = isFlashing ? "#ffffff" : "#8b5cf6";
        ctx.fillRect(this.position.x, this.position.y, this.size.x, this.size.y);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.fillText("Index Eater", this.position.x + this.size.x / 2, this.position.y + this.size.y / 2 + 4);
        ctx.textAlign = "left";
      }
    }

    // ─── Rectangle body rendering ───────────────────────────
    if (mode === "rectangles" || mode === "both") {
      if (mode === "both") {
        ctx.globalAlpha = ctx.globalAlpha * 0.5;
      }

    // ─── Body Segments ───────────────────────────────────
    const segW = this.params.segmentWidth;
    const segH = this.size.y;
    const headIdx = this.facingRight ? this.params.segmentCount - 1 : 0;

    for (let i = 0; i < this.params.segmentCount; i++) {
      const segX = this.position.x + i * segW;
      const segY = this.position.y;

      // Lunge stretch effect
      let stretchOffset = 0;
      if (state === "LUNGE_ATTACK") {
        stretchOffset = (this.facingRight ? 1 : -1) * (i - 1.5) * 3;
      }

      // Death segment separation
      let deathOffset = 0;
      if (state === "DYING") {
        deathOffset = (i - 1.5) * deathProgress * 20;
      }

      const drawX = segX + stretchOffset + deathOffset;

      // Segment body fill
      if (isFlashing) {
        ctx.fillStyle = "#ffffff";
      } else {
        const gradient = ctx.createLinearGradient(drawX, segY, drawX, segY + segH);
        gradient.addColorStop(0, BODY_COLOR);
        gradient.addColorStop(1, BODY_COLOR_DARK);
        ctx.fillStyle = gradient;
      }

      // Rounded rect for segment
      const r = 4;
      ctx.beginPath();
      ctx.moveTo(drawX + r, segY);
      ctx.lineTo(drawX + segW - r, segY);
      ctx.arcTo(drawX + segW, segY, drawX + segW, segY + r, r);
      ctx.lineTo(drawX + segW, segY + segH - r);
      ctx.arcTo(drawX + segW, segY + segH, drawX + segW - r, segY + segH, r);
      ctx.lineTo(drawX + r, segY + segH);
      ctx.arcTo(drawX, segY + segH, drawX, segY + segH - r, r);
      ctx.lineTo(drawX, segY + r);
      ctx.arcTo(drawX, segY, drawX + r, segY, r);
      ctx.closePath();
      ctx.fill();

      // Ink stain patches
      if (!isFlashing) {
        const patchSeed = i * 7 + 3;
        for (let p = 0; p < 2; p++) {
          const px = drawX + ((patchSeed + p * 13) % segW);
          const py = segY + ((patchSeed + p * 17) % (segH - 10)) + 5;
          ctx.fillStyle = INK_COLOR;
          ctx.globalAlpha = 0.3;
          ctx.fillRect(px - 4, py - 3, 8, 6);
          ctx.globalAlpha = 1;
        }
      }

      // Filing tab legs
      if (!isFlashing) {
        ctx.fillStyle = TAB_COLOR;
        const legPhase = this.legAnimCounter * 0.15 + i * 1.2;
        for (let l = 0; l < 2; l++) {
          const lx = drawX + 8 + l * (segW - 16);
          const legBob = Math.sin(legPhase + l * Math.PI) * 3;
          ctx.fillRect(lx - 3, segY + segH + legBob, 6, 8);
        }
      }

      // Chain links between segments
      if (i < this.params.segmentCount - 1 && !isFlashing) {
        let nextStretchOffset = 0;
        if (state === "LUNGE_ATTACK") {
          nextStretchOffset = (this.facingRight ? 1 : -1) * ((i + 1) - 1.5) * 3;
        }
        let nextDeathOffset = 0;
        if (state === "DYING") {
          nextDeathOffset = ((i + 1) - 1.5) * deathProgress * 20;
        }
        const nextX = this.position.x + (i + 1) * segW + nextStretchOffset + nextDeathOffset;
        ctx.strokeStyle = CHAIN_COLOR;
        ctx.lineWidth = 2;
        for (let c = 0; c < 2; c++) {
          const cy2 = segY + 15 + c * (segH - 30);
          ctx.beginPath();
          ctx.moveTo(drawX + segW, cy2);
          ctx.lineTo(nextX, cy2);
          ctx.stroke();
          // Small chain link rectangles
          const linkX = (drawX + segW + nextX) / 2;
          ctx.fillStyle = CHAIN_COLOR;
          ctx.fillRect(linkX - 2, cy2 - 3, 4, 6);
        }
      }

      // ─── Head rendering ─────────────────────────────
      if (i === headIdx) {
        // Eyes
        const eyeY = segY + 15;
        const eye1X = drawX + segW * 0.3;
        const eye2X = drawX + segW * 0.7;
        ctx.fillStyle = isFlashing ? "#ffffff" : INK_COLOR;
        ctx.beginPath();
        ctx.arc(eye1X, eyeY, 3, 0, Math.PI * 2);
        ctx.arc(eye2X, eyeY, 3, 0, Math.PI * 2);
        ctx.fill();

        // Mouth / jaw
        if (this.mouthOpen > 0.01) {
          const jawDrop = this.mouthOpen * 25;
          const jawY = segY + segH * 0.6;
          // Upper jaw teeth
          ctx.fillStyle = isFlashing ? "#ffffff" : TAB_COLOR;
          for (let t = 0; t < 6; t++) {
            const tx = drawX + 4 + t * (segW - 8) / 6;
            ctx.beginPath();
            ctx.moveTo(tx, jawY);
            ctx.lineTo(tx + 3, jawY + 6);
            ctx.lineTo(tx + 6, jawY);
            ctx.closePath();
            ctx.fill();
          }
          // Lower jaw teeth (mirrored, dropped)
          for (let t = 0; t < 6; t++) {
            const tx = drawX + 4 + t * (segW - 8) / 6;
            ctx.beginPath();
            ctx.moveTo(tx, jawY + jawDrop);
            ctx.lineTo(tx + 3, jawY + jawDrop - 6);
            ctx.lineTo(tx + 6, jawY + jawDrop);
            ctx.closePath();
            ctx.fill();
          }
          // Red glow in mouth during telegraph
          if (state === "LUNGE_TELEGRAPH" || state === "DEVOUR_TELEGRAPH") {
            ctx.fillStyle = `rgba(239, 68, 68, ${this.mouthOpen * 0.4})`;
            ctx.fillRect(drawX + 4, jawY, segW - 8, jawDrop);
          }
        }
      }

      // ─── Tail rendering ─────────────────────────────
      const tailIdx = this.facingRight ? 0 : this.params.segmentCount - 1;
      if (i === tailIdx) {
        // Paper scraps trailing from tail
        if (!isFlashing) {
          const tailEdge = this.facingRight ? drawX : drawX + segW;
          for (let s = 0; s < 3; s++) {
            const sx = tailEdge + (this.facingRight ? -1 : 1) * (8 + s * 10);
            const sy = segY + segH * 0.3 + Math.sin(this.frameCounter * 0.05 + s * 1.5) * 5 + s * 15;
            ctx.fillStyle = BODY_COLOR;
            ctx.globalAlpha = 0.6;
            ctx.fillRect(sx - 4, sy - 2, 8, 4);
            ctx.globalAlpha = 1;
          }
        }

        // Chain whip rendering
        if (state === "WHIP_TELEGRAPH" || state === "WHIP_ATTACK") {
          const whipStartX = this.facingRight ? drawX : drawX + segW;
          const whipStartY = segY + segH / 2;
          const behind = this.facingRight ? -1 : 1;
          const isP2 = this.currentPhase >= 2;
          const radius = isP2 ? this.params.p2WhipRadius : this.params.whipRadius;

          if (state === "WHIP_TELEGRAPH") {
            // Chain rising
            ctx.strokeStyle = CHAIN_COLOR;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(whipStartX, whipStartY);
            ctx.lineTo(whipStartX + behind * 30, whipStartY - 30);
            ctx.stroke();
          } else {
            // Chain sweeping
            const endX = whipStartX + Math.cos(this.whipAngle + (behind > 0 ? 0 : Math.PI)) * radius;
            const endY = whipStartY + Math.sin(this.whipAngle + (behind > 0 ? 0 : Math.PI)) * radius * 0.6;
            ctx.strokeStyle = isFlashing ? "#ffffff" : CHAIN_COLOR;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(whipStartX, whipStartY);
            ctx.quadraticCurveTo(
              (whipStartX + endX) / 2,
              whipStartY - 20,
              endX,
              endY,
            );
            ctx.stroke();
            // Chain links along path
            for (let cl = 0; cl < 4; cl++) {
              const t = cl / 4;
              const clx = whipStartX + (endX - whipStartX) * t;
              const cly = whipStartY + (endY - whipStartY) * t - 10 * Math.sin(t * Math.PI);
              ctx.fillStyle = CHAIN_COLOR;
              ctx.fillRect(clx - 2, cly - 3, 4, 6);
            }
          }
        }
      }
    }

      if (mode === "both") {
        // Restore alpha from the 0.5 reduction
        ctx.globalAlpha = state === "DYING" ? Math.max(0, 1 - deathProgress) : 1;
      }
    } // end rectangle body rendering

    // ─── Chain Storm Rendering (ALWAYS drawn regardless of mode) ──
    if (state === "CHAIN_STORM_TELEGRAPH" || state === "CHAIN_STORM_ACTIVE") {
      const chainCount = this.params.chainStormChainCount;
      const isActive = state === "CHAIN_STORM_ACTIVE";
      const radius = isActive ? this.params.chainStormRadius : this.params.chainStormRadius * 0.3;

      for (let i = 0; i < chainCount; i++) {
        const angle = this.chainStormAngleOffset + (i * Math.PI * 2) / chainCount;
        const endX = cx + Math.cos(angle) * radius;
        const endY = cy + Math.sin(angle) * radius;

        ctx.strokeStyle = isFlashing ? "#ffffff" : CHAIN_COLOR;
        ctx.lineWidth = isActive ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Chain link at tip
        if (isActive) {
          ctx.fillStyle = TAB_COLOR;
          ctx.fillRect(endX - 4, endY - 4, 8, 8);
        }
      }
    }

    // ─── Pounce Telegraph ─────────────────────────────
    if (state === "POUNCE_TELEGRAPH" && this.pounceTarget) {
      const tx = this.pounceTarget.x;
      const ty = this.pounceTarget.y;
      const pulseAlpha = 0.5 + Math.sin(this.frameCounter * 0.3) * 0.3;
      ctx.strokeStyle = `rgba(239, 68, 68, ${pulseAlpha})`;
      ctx.lineWidth = 2;
      // Crosshair
      ctx.beginPath();
      ctx.moveTo(tx - 15, ty);
      ctx.lineTo(tx + 15, ty);
      ctx.moveTo(tx, ty - 15);
      ctx.lineTo(tx, ty + 15);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(tx, ty, 12, 0, Math.PI * 2);
      ctx.stroke();
      // Line from boss to target
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ─── Vulnerability Indicator ──────────────────────
    if (this.isAlive) {
      const vulnText = this.isVulnerable() ? "VULNERABLE" : "";
      if (vulnText) {
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = "#22c55e";
        ctx.globalAlpha = 0.8;
        ctx.fillText(vulnText, cx, this.position.y - 20);
        ctx.globalAlpha = 1;
        ctx.textAlign = "left";
      }
    }

    // ─── Stunned indicators ───────────────────────────
    if (state === "LUNGE_RECOVERY" || state === "DEVOUR_STUNNED" || state === "POUNCE_STUNNED" || state === "DEATH_THRASH_COLLAPSE") {
      for (let i = 0; i < 3; i++) {
        const angle = this.frameCounter * 0.15 + (i * Math.PI * 2) / 3;
        const sx = cx + Math.cos(angle) * 30;
        const sy = this.position.y - 5 + Math.sin(angle) * 8;
        ctx.font = "10px serif";
        ctx.fillStyle = "#f59e0b";
        ctx.textAlign = "center";
        ctx.fillText(["?", "!", "*"][i], sx, sy);
      }
      ctx.textAlign = "left";
    }

    ctx.restore();

    // ─── Ink Flood Zones (rendered without boss rotation) ──
    for (const zone of this.inkFloodZones) {
      const alpha = Math.max(0, 0.7 * (1 - zone.fadeProgress));
      ctx.fillStyle = `rgba(10, 10, 10, ${alpha})`;
      ctx.fillRect(zone.rect.x, zone.rect.y, zone.rect.width, zone.rect.height);
      // Ripple effect
      if (zone.fadeProgress < 0.8) {
        const rippleRadius = (this.frameCounter % 30) * 2;
        ctx.strokeStyle = `rgba(30, 30, 30, ${0.3 * (1 - zone.fadeProgress)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(
          zone.rect.x + zone.rect.width / 2,
          zone.rect.y + 2,
          rippleRadius,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
    }

    // ─── Card Projectiles ─────────────────────────────
    for (const card of this.spitCards) {
      if (!card.active) continue;
      ctx.save();
      ctx.translate(card.x, card.y);
      ctx.rotate(card.rotation);
      const half = card.size / 2;
      ctx.fillStyle = card.stuck ? "rgba(212, 165, 116, 0.5)" : BODY_COLOR;
      ctx.fillRect(-half, -half, card.size, card.size);
      ctx.strokeStyle = card.stuck ? "rgba(92, 61, 46, 0.5)" : TAB_COLOR;
      ctx.lineWidth = 1;
      ctx.strokeRect(-half, -half, card.size, card.size);
      // Tab on top
      if (!card.stuck) {
        ctx.fillStyle = TAB_COLOR;
        ctx.fillRect(-2, -half - 3, 4, 3);
      }
      ctx.restore();
    }

    // ─── Shockwaves ───────────────────────────────────
    for (const sw of this.shockwaves) {
      if (!sw.active) continue;
      const alpha = 0.6 * (1 - Math.abs(sw.x - sw.originX) / sw.range);
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = TAB_COLOR;
      ctx.fillRect(sw.x, sw.y, sw.width, sw.height);
      ctx.globalAlpha = 1;
    }
  }

  // ─── Render Destructible Platforms ──────────────────────────────

  renderDestructiblePlatforms(ctx: CanvasRenderingContext2D): void {
    for (const dp of this.destructiblePlatforms) {
      const plat = dp.platform;

      if (dp.destroyed) {
        // Faded stump
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = "#4b5563";
        ctx.fillRect(plat.x, plat.y + plat.height / 2, plat.width, plat.height / 2);
        // Jagged top edge
        ctx.strokeStyle = "#6b7280";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(plat.x, plat.y + plat.height / 2);
        for (let x = plat.x; x < plat.x + plat.width; x += 12) {
          const jag = Math.sin(x * 0.3) * 4 + plat.y + plat.height / 2;
          ctx.lineTo(x + 6, jag - 3);
          ctx.lineTo(x + 12, jag + 2);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }

      // Cracking overlay
      if (dp.cracking && dp.crackProgress > 0) {
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 1.5;
        const progress = dp.crackProgress;
        // Draw crack lines
        for (let c = 0; c < 4; c++) {
          const startX = plat.x + plat.width * ((c + 1) / 5);
          const startY = plat.y;
          const endX = startX + (c % 2 === 0 ? 15 : -15) * progress;
          const endY = plat.y + plat.height * progress;
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(startX + 5 * (c % 2 === 0 ? 1 : -1), startY + plat.height * 0.4 * progress);
          ctx.lineTo(endX, endY);
          ctx.stroke();
        }
      }
    }
  }

  // ─── Render Health Bar ──────────────────────────────────────────

  renderHealthBar(ctx: CanvasRenderingContext2D, canvasWidth: number): void {
    if (!this.isAlive && this.stateMachine.getCurrentState() === "DEAD") return;

    const barWidth = 400;
    const barHeight = 12;
    const barX = (canvasWidth - barWidth) / 2;
    const barY = 500;

    // Background
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);

    // Health fill
    const healthPct = this.health / this.maxHealth;
    const fillWidth = barWidth * healthPct;

    if (fillWidth > 0) {
      const gradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
      if (this.currentPhase === 3) {
        gradient.addColorStop(0, INK_COLOR);
        gradient.addColorStop(1, "#374151");
      } else if (this.currentPhase === 2) {
        gradient.addColorStop(0, TAB_COLOR);
        gradient.addColorStop(1, BODY_COLOR_DARK);
      } else {
        gradient.addColorStop(0, BODY_COLOR);
        gradient.addColorStop(1, BODY_COLOR_DARK);
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(barX, barY, fillWidth, barHeight);
    }

    // Phase markers
    const phase2X = barX + barWidth * (this.params.phase1Threshold / this.maxHealth);
    const phase3X = barX + barWidth * (this.params.phase2Threshold / this.maxHealth);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(phase2X, barY, 2, barHeight);
    ctx.fillRect(phase3X, barY, 2, barHeight);

    // Border
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // Boss name + devour counter
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#9ca3af";
    const totalDestructible = this.destructiblePlatforms.length;
    ctx.fillText(
      `INDEX EATER    Devoured: ${this.destroyedCount}/${totalDestructible}`,
      canvasWidth / 2,
      barY + barHeight + 14,
    );

    // Phase indicator dots
    for (let i = 0; i < 3; i++) {
      const dotX = canvasWidth / 2 - 15 + i * 15;
      const dotY = barY + barHeight + 24;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
      if (i < this.currentPhase) {
        ctx.fillStyle = this.currentPhase === 3 ? INK_COLOR : BODY_COLOR;
        ctx.fill();
      } else {
        ctx.strokeStyle = "#4b5563";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // HP text
    ctx.font = "bold 10px monospace";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`${this.health} / ${this.maxHealth}`, canvasWidth / 2, barY - 6);

    ctx.textAlign = "left";
  }

  // ─── Render Debug Overlays ──────────────────────────────────────

  renderDebug(ctx: CanvasRenderingContext2D): void {
    // Boss hitbox
    ctx.strokeStyle = "#a855f7";
    ctx.lineWidth = 2;
    ctx.strokeRect(this.position.x, this.position.y, this.size.x, this.size.y);

    // State and phase labels
    ctx.font = "9px monospace";
    ctx.fillStyle = "#a78bfa";
    ctx.fillText(
      `State: ${this.stateMachine.getCurrentState()}`,
      this.position.x,
      this.position.y - 32,
    );
    ctx.fillStyle = "#818cf8";
    ctx.fillText(
      `Phase: ${this.currentPhase} | Timer: ${this.stateTimer}`,
      this.position.x,
      this.position.y - 44,
    );
    ctx.fillStyle = "#9ca3af";
    ctx.fillText(
      `Surface: ${this.currentSurface}`,
      this.position.x,
      this.position.y - 56,
    );

    // Card projectile hitboxes
    for (const card of this.spitCards) {
      if (!card.active || card.stuck) continue;
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        card.x - card.size / 2,
        card.y - card.size / 2,
        card.size,
        card.size,
      );
    }

    // Shockwave hitboxes
    for (const sw of this.shockwaves) {
      if (!sw.active) continue;
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1;
      ctx.strokeRect(sw.x, sw.y, sw.width, sw.height);
    }

    // Ink flood zone outlines
    for (const zone of this.inkFloodZones) {
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(zone.rect.x, zone.rect.y, zone.rect.width, zone.rect.height);
      ctx.setLineDash([]);
    }
  }

  // ─── Reset ──────────────────────────────────────────────────────

  reset(position?: Vec2): void {
    this.health = this.params.maxHealth;
    this.maxHealth = this.params.maxHealth;
    this.currentPhase = 1;
    this.isAlive = true;
    this.invincibilityFrames = 0;
    this.hitstopTimer = 0;
    this.hitFlashTimer = 0;
    this.stateTimer = 0;
    this.deathTimer = 0;
    this.phaseTransitionTimer = 0;
    this.frameCounter = 0;
    this.totalDamageReceived = 0;
    this.deathThrashUsed = false;
    this.mouthOpen = 0;
    this.bodyRotation = 0;
    this.targetBodyRotation = 0;
    this.currentSurface = "floor";

    this.position = position ? { ...position } : { x: 1100, y: 480 };
    this.velocity = { x: 0, y: 0 };
    this.facingRight = false;

    this.attackSequence = [...PHASE_1_SEQUENCE];
    this.sequenceIndex = 0;
    this.currentAttack = null;

    this.spitCards = [];
    this.shockwaves = [];
    this.inkFloodZones = [];
    this.autoCrumbleTimer = 0;
    this.crumblingPlatform = null;
    this.crumbleWarningTimer = 0;

    // Restore all destructible platforms
    for (const dp of this.destructiblePlatforms) {
      dp.destroyed = false;
      dp.cracking = false;
      dp.crackProgress = 0;
    }
    this.destroyedCount = 0;

    this.onPlatformDestroyed?.();
    this.stateMachine.setState("IDLE");
  }

  // ─── Skip to Phase ──────────────────────────────────────────────

  skipToPhase(phase: 2 | 3): void {
    if (phase === 2) {
      this.health = this.params.phase1Threshold;
      // Destroy 1 floor section
      const floors = this.destructiblePlatforms.filter((dp) => dp.tier === "floor" && !dp.destroyed);
      if (floors.length > 0) {
        this.destroyPlatform(floors[Math.floor(floors.length / 2)]);
      }
    } else {
      this.health = this.params.phase2Threshold;
      // Destroy 3 floor sections + 1 mid
      const floors = this.destructiblePlatforms.filter((dp) => dp.tier === "floor" && !dp.destroyed);
      for (let i = 0; i < Math.min(3, floors.length); i++) {
        this.destroyPlatform(floors[i]);
      }
      const mids = this.destructiblePlatforms.filter((dp) => dp.tier === "mid" && !dp.destroyed);
      if (mids.length > 0) {
        this.destroyPlatform(mids[0]);
      }
    }
    this.startPhaseTransition(phase);
  }
}
