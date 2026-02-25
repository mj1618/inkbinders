import { StateMachine } from "@/engine/states/StateMachine";
import type { ParticleSystem } from "@/engine/core/ParticleSystem";
import type { ScreenShake } from "@/engine/core/ScreenShake";
import type { Camera } from "@/engine/core/Camera";
import { RenderConfig } from "@/engine/core/RenderConfig";
import { AnimationController } from "@/engine/core/AnimationController";
import { AssetManager } from "@/engine/core/AssetManager";
import type { Vec2, Rect } from "@/lib/types";
import type { MisprintSeraphParams } from "./MisprintSeraphParams";
import { DEFAULT_MISPRINT_SERAPH_PARAMS } from "./MisprintSeraphParams";
import type { DamageZone } from "./types";
import {
  SERAPH_SPRITE_CONFIGS,
  SERAPH_ANIMATIONS,
  SERAPH_STATE_TO_ANIMATION,
} from "./BossSprites";

// ─── Sub-entity types ──────────────────────────────────────────────

interface PageProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  damage: number;
  rotation: number;
  rotationSpeed: number;
  bouncesRemaining: number;
  trackingRate: number;
  active: boolean;
}

interface Shockwave {
  x: number;
  y: number;
  width: number;
  height: number;
  velocityX: number;
  damage: number;
  active: boolean;
}

// ─── Constants ─────────────────────────────────────────────────────

const DEATH_DURATION = 120;
const HIT_FLASH_FRAMES = 4;
const GLYPH_SYMBOLS = ["?", "!", "¿", "¡", "«"];
const DEG_TO_RAD = Math.PI / 180;

// Arena dimensions (must match the test page)
const ARENA_WIDTH = 1280;
const ARENA_HEIGHT = 720;
const GROUND_Y = 640;

// Hover points the boss teleports between
const HOVER_POINTS: Vec2[] = [
  { x: 640, y: 180 },
  { x: 200, y: 200 },
  { x: 1080, y: 200 },
  { x: 400, y: 350 },
  { x: 880, y: 350 },
];

// Attack sequences per phase
const PHASE_1_SEQUENCE = [
  "ink-beam-left",
  "teleport",
  "page-barrage",
  "ink-beam-right",
  "page-barrage",
  "teleport",
];

const PHASE_2_SEQUENCE = [
  "dive-slash",
  "beam-horizontal",
  "teleport",
  "page-storm",
  "dive-slash",
  "beam-vertical",
  "teleport",
];

const PHASE_3_SEQUENCE = [
  "triple-beam",
  "rapid-dive",
  "teleport",
  "rapid-barrage",
  "triple-beam",
  "teleport",
  "rapid-dive",
  "rapid-barrage",
];

// ─── MisprintSeraph Class ──────────────────────────────────────────

export class MisprintSeraph {
  params: MisprintSeraphParams;

  // Health
  health: number;
  maxHealth: number;
  currentPhase: 1 | 2 | 3 = 1;
  isAlive = true;
  invincibilityFrames = 0;
  totalDamageReceived = 0;

  // Position (mobile)
  position: Vec2;
  targetHoverPoint: Vec2;
  hoverPointIndex = 0;
  size: Vec2;

  // State machine
  stateMachine: StateMachine<MisprintSeraph>;
  stateTimer = 0;

  // Attack sequencer
  attackSequence: string[] = [...PHASE_1_SEQUENCE];
  sequenceIndex = 0;
  currentAttack: string | null = null;

  // Sub-entities
  pages: PageProjectile[] = [];
  beamAngle = 0;
  beamStartAngle = 0;
  beamEndAngle = 0;
  beamActive = false;
  beamOrigin: Vec2 = { x: 0, y: 0 };
  beamCount = 1;
  beamAngles: number[] = [];
  divePath: { start: Vec2; end: Vec2 } | null = null;
  diveProgress = 0;
  diveTarget: Vec2 = { x: 0, y: 0 };
  shockwaves: Shockwave[] = [];

  // Rapid dive sub-state
  private rapidDiveIndex = 0;

  // Phase state
  corruptedFloorActive = false;
  phase2PlatformsVisible = false;

  // Teleport state
  teleportAlpha = 1;
  private teleportFromIndex = 0;
  private teleportToIndex = 0;

  // Stagger descent
  private staggerBaseY = 0;
  private staggerTargetY = 0;

  // Visual state
  hitFlashTimer = 0;
  phaseTransitionTimer = 0;
  wingFlutter = 0;
  bodyShakeOffset: Vec2 = { x: 0, y: 0 };
  deathTimer = 0;
  frameCounter = 0;
  hitstopTimer = 0;
  private haloRotation = 0;

  // Systems
  particleSystem: ParticleSystem | null = null;
  screenShake: ScreenShake | null = null;

  // Player tracking
  private playerPosition: Vec2 = { x: 0, y: 0 };

  // AI toggle
  aiEnabled = true;

  // Desperation slam used flag
  private desperationUsed = false;

  // Sprite animation
  private animControllers = new Map<string, AnimationController>();
  private activeAnimController: AnimationController | null = null;
  private spritesReady = false;

  constructor(position?: Vec2, params?: Partial<MisprintSeraphParams>) {
    this.params = { ...DEFAULT_MISPRINT_SERAPH_PARAMS, ...params };
    this.health = this.params.maxHealth;
    this.maxHealth = this.params.maxHealth;

    const startHover = HOVER_POINTS[0];
    this.position = position
      ? { ...position }
      : {
          x: startHover.x - this.params.bodyWidth / 2,
          y: startHover.y - this.params.bodyHeight / 2,
        };
    this.targetHoverPoint = { ...startHover };
    this.size = { x: this.params.bodyWidth, y: this.params.bodyHeight };

    this.stateMachine = new StateMachine<MisprintSeraph>(this);
    this.registerStates();
    this.stateMachine.setState("IDLE");
    this.initSprites();
  }

  // ─── Sprite Initialization ─────────────────────────────────────

  private initSprites(): void {
    const assetManager = AssetManager.getInstance();
    assetManager.loadAll(SERAPH_SPRITE_CONFIGS).then(() => {
      for (const config of SERAPH_SPRITE_CONFIGS) {
        const sheet = assetManager.getSpriteSheet(config.id);
        if (sheet) {
          const anims = SERAPH_ANIMATIONS[config.id];
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
        b.beamActive = false;
        b.divePath = null;
      },
      update: (b) => {
        if (!b.aiEnabled) return;
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.nextAttack();
        }
      },
    });

    // ─── Teleport States ─────────────────────────────────────
    this.stateMachine.addState({
      name: "TELEPORT_OUT",
      enter: (b) => {
        b.stateTimer = b.params.teleportFadeDuration;
        b.teleportFromIndex = b.hoverPointIndex;
        b.teleportToIndex = b.pickTeleportTarget();
        b.teleportAlpha = 1;
      },
      update: (b) => {
        b.stateTimer--;
        b.teleportAlpha = Math.max(0, b.stateTimer / b.params.teleportFadeDuration);

        // Afterimage particles
        if (b.stateTimer % 2 === 0) {
          b.particleSystem?.emit({
            x: b.position.x + b.size.x / 2,
            y: b.position.y + b.size.y / 2,
            count: 3,
            speedMin: 20,
            speedMax: 60,
            angleMin: 0,
            angleMax: Math.PI * 2,
            lifeMin: 0.2,
            lifeMax: 0.5,
            sizeMin: 2,
            sizeMax: 5,
            colors: ["#f8fafc", "#ef4444", "rgba(248, 250, 252, 0.5)"],
            gravity: 30,
          });
        }

        if (b.stateTimer <= 0) {
          b.stateMachine.setState("TELEPORT_IN");
        }
      },
    });

    this.stateMachine.addState({
      name: "TELEPORT_IN",
      enter: (b) => {
        b.stateTimer = b.params.teleportFadeDuration;
        b.teleportAlpha = 0;
        b.hoverPointIndex = b.teleportToIndex;
        const hp = HOVER_POINTS[b.hoverPointIndex];
        b.targetHoverPoint = { ...hp };
        b.position.x = hp.x - b.size.x / 2;
        b.position.y = hp.y - b.size.y / 2;
      },
      update: (b) => {
        b.stateTimer--;
        b.teleportAlpha = 1 - b.stateTimer / b.params.teleportFadeDuration;

        if (b.stateTimer <= 0) {
          b.teleportAlpha = 1;
          b.stateMachine.setState("IDLE");
        }
      },
    });

    // ─── Ink Beam States (Phase 1) ──────────────────────────
    this.stateMachine.addState({
      name: "BEAM_TELEGRAPH",
      enter: (b) => {
        b.stateTimer = b.params.beamTelegraph;
        const center = b.getBodyCenter();
        b.beamOrigin = { ...center };
        // Aim at player
        const dx = b.playerPosition.x - center.x;
        const dy = b.playerPosition.y - center.y;
        const aimAngle = Math.atan2(dy, dx);
        const halfSweep = (b.params.beamSweepAngle / 2) * DEG_TO_RAD;
        const sweepDir = b.currentAttack === "ink-beam-left" || b.currentAttack === "beam-horizontal" ? -1 : 1;
        b.beamStartAngle = aimAngle - halfSweep * sweepDir;
        b.beamEndAngle = aimAngle + halfSweep * sweepDir;
        b.beamAngle = b.beamStartAngle;
        b.beamActive = false;
        b.beamCount = 1;
        b.beamAngles = [b.beamAngle];
      },
      update: (b) => {
        b.stateTimer--;
        // Update aim toward player during telegraph
        const center = b.getBodyCenter();
        b.beamOrigin = { ...center };
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("BEAM_FIRE");
        }
      },
    });

    this.stateMachine.addState({
      name: "BEAM_FIRE",
      enter: (b) => {
        const isPhase2 = b.currentPhase >= 2;
        b.stateTimer = isPhase2 ? 30 : b.params.beamDuration;
        b.beamActive = true;
        b.beamAngle = b.beamStartAngle;
        b.beamAngles = [b.beamAngle];
        const center = b.getBodyCenter();
        b.beamOrigin = { ...center };
        b.screenShake?.shake(2, 4);
      },
      update: (b) => {
        b.stateTimer--;
        const isPhase2 = b.currentPhase >= 2;
        const totalFrames = isPhase2 ? 30 : b.params.beamDuration;
        const progress = 1 - b.stateTimer / totalFrames;
        b.beamAngle = b.beamStartAngle + (b.beamEndAngle - b.beamStartAngle) * progress;
        b.beamAngles = [b.beamAngle];
        const center = b.getBodyCenter();
        b.beamOrigin = { ...center };

        if (b.stateTimer <= 0) {
          b.beamActive = false;
          b.stateMachine.setState("BEAM_COOLDOWN");
        }
      },
    });

    this.stateMachine.addState({
      name: "BEAM_COOLDOWN",
      enter: (b) => {
        b.stateTimer = b.params.beamCooldown;
        b.beamActive = false;
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("IDLE");
        }
      },
    });

    // ─── Page Barrage States (Phase 1) ──────────────────────
    this.stateMachine.addState({
      name: "BARRAGE_TELEGRAPH",
      enter: (b) => {
        b.stateTimer = b.params.barrageTelegraph;
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("BARRAGE_FIRE");
        }
      },
    });

    this.stateMachine.addState({
      name: "BARRAGE_FIRE",
      enter: (b) => {
        const isRapid = b.currentAttack === "rapid-barrage";
        b.stateTimer = b.params.barrageDuration;
        // Spawn pages aimed at player — rapid barrage uses upgraded params
        b.spawnBarragePages(
          isRapid ? b.params.rapidBarragePageCount : b.params.barragePageCount,
          isRapid ? b.params.rapidBarragePageSpeed : b.params.barragePageSpeed,
          b.params.barrageSpreadAngle,
          b.params.barragePageDamage,
          b.params.barragePageSize,
          0,
          isRapid ? b.params.rapidBarrageTracking : 0,
        );
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("BARRAGE_STAGGER");
        }
      },
    });

    this.stateMachine.addState({
      name: "BARRAGE_STAGGER",
      enter: (b) => {
        const isRapid = b.currentAttack === "rapid-barrage";
        b.stateTimer = isRapid ? b.params.rapidBarrageStagger : b.params.barrageStagger;
        b.staggerBaseY = b.position.y;
        b.staggerTargetY = b.position.y + b.params.barrageStaggerDescent;
      },
      update: (b) => {
        b.stateTimer--;
        // Descend during stagger
        const progress = 1 - b.stateTimer / b.params.barrageStagger;
        if (progress < 0.3) {
          b.position.y = b.staggerBaseY + (b.staggerTargetY - b.staggerBaseY) * (progress / 0.3);
        } else {
          b.position.y = b.staggerTargetY;
        }
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("BARRAGE_RECOVER");
        }
      },
    });

    this.stateMachine.addState({
      name: "BARRAGE_RECOVER",
      enter: (b) => {
        b.stateTimer = 20;
        b.staggerBaseY = b.position.y;
      },
      update: (b) => {
        b.stateTimer--;
        // Ascend back to hover point
        const progress = 1 - b.stateTimer / 20;
        const hoverY = b.targetHoverPoint.y - b.size.y / 2;
        b.position.y = b.staggerBaseY + (hoverY - b.staggerBaseY) * progress;
        if (b.stateTimer <= 0) {
          b.position.y = hoverY;
          b.stateMachine.setState("IDLE");
        }
      },
    });

    // ─── Dive Slash States (Phase 2) ────────────────────────
    this.stateMachine.addState({
      name: "DIVE_TELEGRAPH",
      enter: (b) => {
        const tel = b.currentPhase === 3 ? b.params.rapidDiveTelegraph : b.params.diveTelegraph;
        b.stateTimer = tel;
        b.diveTarget = { ...b.playerPosition };
      },
      update: (b) => {
        b.stateTimer--;
        // First frames show crosshair, last frames show path
        const tel = b.currentPhase === 3 ? b.params.rapidDiveTelegraph : b.params.diveTelegraph;
        if (b.stateTimer > tel - b.params.diveCrosshairDuration) {
          // Track player during crosshair phase
          b.diveTarget = { ...b.playerPosition };
        }
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("DIVE_ATTACK");
        }
      },
    });

    this.stateMachine.addState({
      name: "DIVE_ATTACK",
      enter: (b) => {
        const center = b.getBodyCenter();
        const speed = b.currentPhase === 3 ? b.params.rapidDiveSpeed : b.params.diveSpeed;
        const dx = b.diveTarget.x - center.x;
        const dy = b.diveTarget.y - center.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const travelTime = dist > 0 ? dist / speed : 0.1;
        b.stateTimer = Math.max(4, Math.ceil(travelTime * 60));
        b.divePath = {
          start: { ...b.position },
          end: {
            x: b.diveTarget.x - b.size.x / 2,
            y: b.diveTarget.y - b.size.y / 2,
          },
        };
        b.diveProgress = 0;
        b.screenShake?.shake(3, 6);
      },
      update: (b) => {
        b.stateTimer--;
        if (b.divePath) {
          const totalFrames = Math.max(1, Math.ceil(
            Math.sqrt(
              (b.divePath.end.x - b.divePath.start.x) ** 2 +
              (b.divePath.end.y - b.divePath.start.y) ** 2,
            ) / ((b.currentPhase === 3 ? b.params.rapidDiveSpeed : b.params.diveSpeed) / 60),
          ));
          b.diveProgress = Math.min(1, b.diveProgress + 1 / totalFrames);
          b.position.x = b.divePath.start.x + (b.divePath.end.x - b.divePath.start.x) * b.diveProgress;
          b.position.y = b.divePath.start.y + (b.divePath.end.y - b.divePath.start.y) * b.diveProgress;

          // Clamp to arena
          b.position.x = Math.max(20, Math.min(ARENA_WIDTH - 20 - b.size.x, b.position.x));
          b.position.y = Math.max(20, Math.min(GROUND_Y - b.size.y, b.position.y));
        }

        if (b.stateTimer <= 0 || b.diveProgress >= 1) {
          // Impact shake
          b.screenShake?.shake(5, 8);
          b.particleSystem?.emit({
            x: b.position.x + b.size.x / 2,
            y: b.position.y + b.size.y,
            count: 12,
            speedMin: 50,
            speedMax: 200,
            angleMin: -Math.PI,
            angleMax: 0,
            lifeMin: 0.2,
            lifeMax: 0.5,
            sizeMin: 2,
            sizeMax: 6,
            colors: ["#ef4444", "#fca5a5", "#ffffff"],
            gravity: 200,
          });

          // Check if this is a rapid dive sequence
          if (b.currentAttack === "rapid-dive" && b.rapidDiveIndex < b.params.rapidDiveCount - 1) {
            b.rapidDiveIndex++;
            b.stateMachine.setState("RAPID_DIVE_INTER");
          } else {
            b.divePath = null;
            b.stateMachine.setState("DIVE_RECOVERY");
          }
        }
      },
    });

    this.stateMachine.addState({
      name: "DIVE_RECOVERY",
      enter: (b) => {
        const recovery = b.currentPhase === 3 ? b.params.rapidDiveRecovery : b.params.diveRecovery;
        b.stateTimer = recovery;
        b.divePath = null;
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("DIVE_ASCEND");
        }
      },
    });

    this.stateMachine.addState({
      name: "DIVE_ASCEND",
      enter: (b) => {
        b.stateTimer = b.params.diveAscendDuration;
        b.staggerBaseY = b.position.y;
        // Pick a random hover point to ascend to
        b.hoverPointIndex = b.pickTeleportTarget();
        b.targetHoverPoint = { ...HOVER_POINTS[b.hoverPointIndex] };
      },
      update: (b) => {
        b.stateTimer--;
        const progress = 1 - b.stateTimer / b.params.diveAscendDuration;
        const targetY = b.targetHoverPoint.y - b.size.y / 2;
        const targetX = b.targetHoverPoint.x - b.size.x / 2;
        b.position.y = b.staggerBaseY + (targetY - b.staggerBaseY) * progress;
        b.position.x = b.position.x + (targetX - b.position.x) * (progress * 0.1);
        if (b.stateTimer <= 0) {
          b.position.x = targetX;
          b.position.y = targetY;
          b.stateMachine.setState("IDLE");
        }
      },
    });

    // ─── Rapid Dive Inter (Phase 3) ─────────────────────────
    this.stateMachine.addState({
      name: "RAPID_DIVE_INTER",
      enter: (b) => {
        b.stateTimer = b.params.rapidDiveInterDelay;
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          // Re-aim at player and dive again
          b.diveTarget = { ...b.playerPosition };
          b.stateMachine.setState("DIVE_ATTACK");
        }
      },
    });

    // ─── Page Storm States (Phase 2) ────────────────────────
    this.stateMachine.addState({
      name: "STORM_TELEGRAPH",
      enter: (b) => {
        b.stateTimer = b.params.stormTelegraph;
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("STORM_FIRE");
        }
      },
    });

    this.stateMachine.addState({
      name: "STORM_FIRE",
      enter: (b) => {
        b.stateTimer = 10; // Brief fire duration
        // Spawn pages radially
        const center = b.getBodyCenter();
        const count = b.params.stormPageCount;
        const angleStep = (Math.PI * 2) / count;
        for (let i = 0; i < count; i++) {
          const angle = i * angleStep;
          b.pages.push({
            x: center.x,
            y: center.y,
            vx: Math.cos(angle) * b.params.stormPageSpeed,
            vy: Math.sin(angle) * b.params.stormPageSpeed,
            size: b.params.barragePageSize,
            damage: b.params.stormPageDamage,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 8,
            bouncesRemaining: b.params.stormPageBounces,
            trackingRate: 0,
            active: true,
          });
        }
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("STORM_STAGGER");
        }
      },
    });

    this.stateMachine.addState({
      name: "STORM_STAGGER",
      enter: (b) => {
        b.stateTimer = b.params.stormStagger;
        b.staggerBaseY = b.position.y;
        b.staggerTargetY = b.position.y + b.params.barrageStaggerDescent;
      },
      update: (b) => {
        b.stateTimer--;
        const progress = 1 - b.stateTimer / b.params.stormStagger;
        if (progress < 0.3) {
          b.position.y = b.staggerBaseY + (b.staggerTargetY - b.staggerBaseY) * (progress / 0.3);
        } else {
          b.position.y = b.staggerTargetY;
        }
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("STORM_RECOVER");
        }
      },
    });

    this.stateMachine.addState({
      name: "STORM_RECOVER",
      enter: (b) => {
        b.stateTimer = 20;
        b.staggerBaseY = b.position.y;
      },
      update: (b) => {
        b.stateTimer--;
        const progress = 1 - b.stateTimer / 20;
        const hoverY = b.targetHoverPoint.y - b.size.y / 2;
        b.position.y = b.staggerBaseY + (hoverY - b.staggerBaseY) * progress;
        if (b.stateTimer <= 0) {
          b.position.y = hoverY;
          b.stateMachine.setState("IDLE");
        }
      },
    });

    // ─── Triple Beam States (Phase 3) ───────────────────────
    this.stateMachine.addState({
      name: "TRIPLE_BEAM_TELEGRAPH",
      enter: (b) => {
        b.stateTimer = b.params.tripleBeamTelegraph;
        const center = b.getBodyCenter();
        b.beamOrigin = { ...center };
        const dx = b.playerPosition.x - center.x;
        const dy = b.playerPosition.y - center.y;
        const aimAngle = Math.atan2(dy, dx);
        const halfSweep = (b.params.beamSweepAngle / 2) * DEG_TO_RAD;
        b.beamStartAngle = aimAngle - halfSweep;
        b.beamEndAngle = aimAngle + halfSweep;
        b.beamAngle = b.beamStartAngle;
        b.beamCount = 3;
        const spacingRad = b.params.tripleBeamSpacing * DEG_TO_RAD;
        b.beamAngles = [aimAngle - spacingRad, aimAngle, aimAngle + spacingRad];
        b.beamActive = false;
      },
      update: (b) => {
        b.stateTimer--;
        const center = b.getBodyCenter();
        b.beamOrigin = { ...center };
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("TRIPLE_BEAM_FIRE");
        }
      },
    });

    this.stateMachine.addState({
      name: "TRIPLE_BEAM_FIRE",
      enter: (b) => {
        b.stateTimer = b.params.beamDuration;
        b.beamActive = true;
        const center = b.getBodyCenter();
        b.beamOrigin = { ...center };
        b.screenShake?.shake(3, 6);
      },
      update: (b) => {
        b.stateTimer--;
        const progress = 1 - b.stateTimer / b.params.beamDuration;
        const center = b.getBodyCenter();
        b.beamOrigin = { ...center };
        // Sweep all three beams
        const sweepOffset = (b.beamEndAngle - b.beamStartAngle) * progress;
        const spacingRad = b.params.tripleBeamSpacing * DEG_TO_RAD;
        const baseAngle = b.beamStartAngle + sweepOffset;
        b.beamAngles = [baseAngle - spacingRad, baseAngle, baseAngle + spacingRad];
        if (b.stateTimer <= 0) {
          b.beamActive = false;
          b.stateMachine.setState("BEAM_COOLDOWN");
        }
      },
    });

    // ─── Desperation Slam States (Phase 3, HP ≤ 4) ──────────
    this.stateMachine.addState({
      name: "DESPERATION_TELEGRAPH",
      enter: (b) => {
        b.stateTimer = b.params.desperationTelegraph;
        // Rise to top center
        b.staggerBaseY = b.position.y;
      },
      update: (b) => {
        b.stateTimer--;
        // Rise to top of arena during telegraph
        const progress = 1 - b.stateTimer / b.params.desperationTelegraph;
        const topY = 40;
        b.position.y = b.staggerBaseY + (topY - b.staggerBaseY) * Math.min(1, progress * 2);
        b.position.x += (ARENA_WIDTH / 2 - b.size.x / 2 - b.position.x) * 0.05;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("DESPERATION_SLAM");
        }
      },
    });

    this.stateMachine.addState({
      name: "DESPERATION_SLAM",
      enter: (b) => {
        b.stateTimer = 8;
        b.divePath = {
          start: { ...b.position },
          end: { x: ARENA_WIDTH / 2 - b.size.x / 2, y: GROUND_Y - b.size.y },
        };
        b.diveProgress = 0;
      },
      update: (b) => {
        b.stateTimer--;
        b.diveProgress = Math.min(1, b.diveProgress + 1 / 8);
        if (b.divePath) {
          b.position.x = b.divePath.start.x + (b.divePath.end.x - b.divePath.start.x) * b.diveProgress;
          b.position.y = b.divePath.start.y + (b.divePath.end.y - b.divePath.start.y) * b.diveProgress;
        }
        if (b.stateTimer <= 0 || b.diveProgress >= 1) {
          b.position.x = ARENA_WIDTH / 2 - b.size.x / 2;
          b.position.y = GROUND_Y - b.size.y;
          b.divePath = null;
          b.screenShake?.shake(10, 20);
          // Spawn ground shockwaves
          const impactX = b.position.x + b.size.x / 2;
          b.shockwaves.push({
            x: impactX,
            y: GROUND_Y - b.params.desperationShockwaveHeight,
            width: 40,
            height: b.params.desperationShockwaveHeight,
            velocityX: -b.params.desperationShockwaveSpeed,
            damage: b.params.desperationSlamDamage,
            active: true,
          });
          b.shockwaves.push({
            x: impactX,
            y: GROUND_Y - b.params.desperationShockwaveHeight,
            width: 40,
            height: b.params.desperationShockwaveHeight,
            velocityX: b.params.desperationShockwaveSpeed,
            damage: b.params.desperationSlamDamage,
            active: true,
          });
          // Spawn radial pages
          const center = b.getBodyCenter();
          const pageCount = b.params.desperationPageCount;
          const angleStep = (Math.PI * 2) / pageCount;
          for (let i = 0; i < pageCount; i++) {
            const angle = i * angleStep;
            b.pages.push({
              x: center.x,
              y: center.y,
              vx: Math.cos(angle) * 350,
              vy: Math.sin(angle) * 350,
              size: b.params.barragePageSize,
              damage: b.params.desperationSlamDamage,
              rotation: Math.random() * Math.PI * 2,
              rotationSpeed: (Math.random() - 0.5) * 8,
              bouncesRemaining: 0,
              trackingRate: 0,
              active: true,
            });
          }
          b.particleSystem?.emit({
            x: center.x,
            y: GROUND_Y,
            count: 30,
            speedMin: 100,
            speedMax: 350,
            angleMin: -Math.PI,
            angleMax: 0,
            lifeMin: 0.3,
            lifeMax: 1.0,
            sizeMin: 3,
            sizeMax: 8,
            colors: ["#ef4444", "#dc2626", "#ffffff", "#f8fafc"],
            gravity: 150,
          });
          b.stateMachine.setState("DESPERATION_COLLAPSE");
        }
      },
    });

    this.stateMachine.addState({
      name: "DESPERATION_COLLAPSE",
      enter: (b) => {
        b.stateTimer = b.params.desperationCollapse;
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("DESPERATION_ASCEND");
        }
      },
    });

    this.stateMachine.addState({
      name: "DESPERATION_ASCEND",
      enter: (b) => {
        b.stateTimer = b.params.desperationAscend;
        b.staggerBaseY = b.position.y;
        b.hoverPointIndex = 0;
        b.targetHoverPoint = { ...HOVER_POINTS[0] };
      },
      update: (b) => {
        b.stateTimer--;
        const progress = 1 - b.stateTimer / b.params.desperationAscend;
        const targetY = b.targetHoverPoint.y - b.size.y / 2;
        const targetX = b.targetHoverPoint.x - b.size.x / 2;
        b.position.y = b.staggerBaseY + (targetY - b.staggerBaseY) * progress;
        b.position.x += (targetX - b.position.x) * 0.08;
        if (b.stateTimer <= 0) {
          b.position.x = targetX;
          b.position.y = targetY;
          b.stateMachine.setState("IDLE");
        }
      },
    });

    // ─── Phase Transition ───────────────────────────────────
    this.stateMachine.addState({
      name: "PHASE_TRANSITION",
      enter: (b) => {
        b.stateTimer = b.params.phaseTransitionDuration;
        b.phaseTransitionTimer = b.params.phaseTransitionDuration;
        b.screenShake?.shake(6, 30);
        b.beamActive = false;
        b.divePath = null;

        b.particleSystem?.emit({
          x: b.position.x + b.size.x / 2,
          y: b.position.y + b.size.y / 2,
          count: 30,
          speedMin: 100,
          speedMax: 300,
          angleMin: 0,
          angleMax: Math.PI * 2,
          lifeMin: 0.5,
          lifeMax: 1.2,
          sizeMin: 3,
          sizeMax: 8,
          colors: ["#ef4444", "#fca5a5", "#f8fafc", "#dc2626"],
          gravity: 100,
        });
      },
      update: (b) => {
        b.stateTimer--;
        b.phaseTransitionTimer = b.stateTimer;

        if (b.stateTimer <= 0) {
          if (b.currentPhase === 2) {
            b.corruptedFloorActive = true;
            b.phase2PlatformsVisible = true;
          } else if (b.currentPhase === 3) {
            // Floor heals in phase 3
            b.corruptedFloorActive = false;
          }
          // Return to a hover point
          b.hoverPointIndex = 0;
          b.targetHoverPoint = { ...HOVER_POINTS[0] };
          b.position.x = HOVER_POINTS[0].x - b.size.x / 2;
          b.position.y = HOVER_POINTS[0].y - b.size.y / 2;
          b.teleportAlpha = 1;
          b.stateMachine.setState("IDLE");
        }
      },
    });

    // ─── Death States ───────────────────────────────────────
    this.stateMachine.addState({
      name: "DYING",
      enter: (b) => {
        b.stateTimer = DEATH_DURATION;
        b.deathTimer = DEATH_DURATION;
        b.screenShake?.shake(8, 30);
        b.beamActive = false;
        b.pages = [];
        b.shockwaves = [];
        b.divePath = null;
      },
      update: (b) => {
        b.stateTimer--;
        b.deathTimer = b.stateTimer;

        // Emit page fragment particles
        if (b.stateTimer % 4 === 0) {
          b.particleSystem?.emit({
            x: b.position.x + Math.random() * b.size.x,
            y: b.position.y + Math.random() * b.size.y,
            count: 5,
            speedMin: 50,
            speedMax: 200,
            angleMin: 0,
            angleMax: Math.PI * 2,
            lifeMin: 0.3,
            lifeMax: 0.8,
            sizeMin: 2,
            sizeMax: 6,
            colors: ["#f8fafc", "#ef4444", "#fca5a5", "#ffffff"],
            gravity: 100,
          });
        }

        // Flash at frame 60
        if (b.stateTimer === 60) {
          b.hitFlashTimer = 8;
          b.screenShake?.shake(6, 10);
        }

        if (b.stateTimer <= 0) {
          b.particleSystem?.emit({
            x: b.position.x + b.size.x / 2,
            y: b.position.y + b.size.y / 2,
            count: 40,
            speedMin: 100,
            speedMax: 400,
            angleMin: 0,
            angleMax: Math.PI * 2,
            lifeMin: 0.5,
            lifeMax: 1.5,
            sizeMin: 3,
            sizeMax: 10,
            colors: ["#ffffff", "#f8fafc", "#fca5a5", "#ef4444"],
            gravity: 80,
          });
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
      state === "BARRAGE_STAGGER" ||
      state === "DIVE_RECOVERY" ||
      state === "STORM_STAGGER" ||
      state === "DESPERATION_COLLAPSE"
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
      colors: ["#ffffff", "#fca5a5", "#ef4444"],
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

  startPhaseTransition(newPhase: 2 | 3): void {
    this.currentPhase = newPhase;

    if (newPhase === 2) {
      this.attackSequence = [...PHASE_2_SEQUENCE];
    } else {
      this.attackSequence = [...PHASE_3_SEQUENCE];
    }
    this.sequenceIndex = 0;

    // Clear active hazards
    this.pages = [];
    this.shockwaves = [];
    this.beamActive = false;
    this.divePath = null;
    this.currentAttack = null;
    this.desperationUsed = false;

    this.stateMachine.setState("PHASE_TRANSITION");
  }

  // ─── Attack Sequencer ──────────────────────────────────────────

  nextAttack(): void {
    // Check desperation slam
    if (
      this.currentPhase === 3 &&
      this.health <= this.params.desperationThreshold &&
      !this.desperationUsed
    ) {
      this.desperationUsed = true;
      this.currentAttack = "desperation-slam";
      this.stateMachine.setState("DESPERATION_TELEGRAPH");
      return;
    }

    const attack = this.attackSequence[this.sequenceIndex];
    this.sequenceIndex = (this.sequenceIndex + 1) % this.attackSequence.length;
    this.currentAttack = attack;

    switch (attack) {
      case "ink-beam-left":
      case "ink-beam-right":
      case "beam-horizontal":
      case "beam-vertical":
        this.stateMachine.setState("BEAM_TELEGRAPH");
        break;
      case "teleport":
        this.stateMachine.setState("TELEPORT_OUT");
        break;
      case "page-barrage":
        this.stateMachine.setState("BARRAGE_TELEGRAPH");
        break;
      case "dive-slash":
        this.rapidDiveIndex = 0;
        this.stateMachine.setState("DIVE_TELEGRAPH");
        break;
      case "page-storm":
        this.stateMachine.setState("STORM_TELEGRAPH");
        break;
      case "triple-beam":
        this.stateMachine.setState("TRIPLE_BEAM_TELEGRAPH");
        break;
      case "rapid-dive":
        this.rapidDiveIndex = 0;
        this.stateMachine.setState("DIVE_TELEGRAPH");
        break;
      case "rapid-barrage":
        this.stateMachine.setState("BARRAGE_TELEGRAPH");
        break;
      default:
        this.stateMachine.setState("IDLE");
        break;
    }
  }

  // ─── Teleport Target Selection ─────────────────────────────────

  private pickTeleportTarget(): number {
    const current = this.hoverPointIndex;
    let best = 0;
    let bestDist = -1;
    for (let i = 0; i < HOVER_POINTS.length; i++) {
      if (i === current) continue;
      const hp = HOVER_POINTS[i];
      const dx = hp.x - this.playerPosition.x;
      const dy = hp.y - this.playerPosition.y;
      const dist = dx * dx + dy * dy;
      if (dist > bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  }

  // ─── Spawn Page Barrage ────────────────────────────────────────

  private spawnBarragePages(
    count: number,
    speed: number,
    spreadDeg: number,
    damage: number,
    size: number,
    bounces: number,
    tracking: number,
  ): void {
    const center = this.getBodyCenter();
    const dx = this.playerPosition.x - center.x;
    const dy = this.playerPosition.y - center.y;
    const baseAngle = Math.atan2(dy, dx);
    const halfSpread = (spreadDeg / 2) * DEG_TO_RAD;

    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0.5;
      const angle = baseAngle - halfSpread + t * halfSpread * 2;
      this.pages.push({
        x: center.x,
        y: center.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size,
        damage,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 8,
        bouncesRemaining: bounces,
        trackingRate: tracking,
        active: true,
      });
    }
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

  update(dt: number, playerBounds: Rect, playerPosition: Vec2): void {
    void playerBounds;
    this.playerPosition.x = playerPosition.x;
    this.playerPosition.y = playerPosition.y;
    this.frameCounter++;

    // Tick timers
    if (this.invincibilityFrames > 0) this.invincibilityFrames--;
    if (this.hitFlashTimer > 0) this.hitFlashTimer--;

    // Hitstop
    if (this.hitstopTimer > 0) {
      this.hitstopTimer--;
      this.updateProjectiles(dt);
      return;
    }

    // Hover bob (only in non-moving states)
    const state = this.stateMachine.getCurrentState();
    if (
      this.isAlive &&
      (state === "IDLE" || state === "BEAM_TELEGRAPH" || state === "BEAM_FIRE" ||
       state === "BEAM_COOLDOWN" || state === "BARRAGE_TELEGRAPH" ||
       state === "STORM_TELEGRAPH" || state === "TRIPLE_BEAM_TELEGRAPH" ||
       state === "TRIPLE_BEAM_FIRE")
    ) {
      const hoverY = this.targetHoverPoint.y - this.size.y / 2;
      const bob = Math.sin(this.frameCounter * this.params.hoverBobSpeed * Math.PI * 2) * this.params.hoverBobAmplitude;
      this.position.y = hoverY + bob;
    }

    // Wing flutter
    this.wingFlutter = Math.sin(this.frameCounter * 0.08) * 12;
    this.haloRotation += 0.02;

    // Update state machine
    if (this.aiEnabled && this.isAlive) {
      this.stateMachine.update(dt);
    }

    // Update projectiles
    this.updateProjectiles(dt);

    // Phase 3 body shake
    if (this.currentPhase === 3 && this.isAlive) {
      this.bodyShakeOffset.x = (Math.random() * 2 - 1) * 2;
      this.bodyShakeOffset.y = (Math.random() * 2 - 1) * 1;
    } else {
      this.bodyShakeOffset.x = 0;
      this.bodyShakeOffset.y = 0;
    }

    // Sprite animation update
    const stateAnim = SERAPH_STATE_TO_ANIMATION[this.stateMachine.getCurrentState()];
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
    // Update pages
    for (const page of this.pages) {
      if (!page.active) continue;

      // Tracking (homing)
      if (page.trackingRate > 0) {
        const dx = this.playerPosition.x - page.x;
        const dy = this.playerPosition.y - page.y;
        const desiredAngle = Math.atan2(dy, dx);
        const currentAngle = Math.atan2(page.vy, page.vx);
        let angleDiff = desiredAngle - currentAngle;
        // Normalize angle diff
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        const maxTurn = page.trackingRate * DEG_TO_RAD * dt;
        const turn = Math.max(-maxTurn, Math.min(maxTurn, angleDiff));
        const speed = Math.sqrt(page.vx * page.vx + page.vy * page.vy);
        const newAngle = currentAngle + turn;
        page.vx = Math.cos(newAngle) * speed;
        page.vy = Math.sin(newAngle) * speed;
      }

      page.x += page.vx * dt;
      page.y += page.vy * dt;
      page.rotation += page.rotationSpeed * dt;

      // Wall bounce
      if (page.x < 20 || page.x > ARENA_WIDTH - 20) {
        if (page.bouncesRemaining > 0) {
          page.vx = -page.vx;
          page.bouncesRemaining--;
          page.x = Math.max(20, Math.min(ARENA_WIDTH - 20, page.x));
        } else {
          page.active = false;
        }
      }
      if (page.y < 20 || page.y > ARENA_HEIGHT) {
        if (page.bouncesRemaining > 0) {
          page.vy = -page.vy;
          page.bouncesRemaining--;
          page.y = Math.max(20, Math.min(ARENA_HEIGHT, page.y));
        } else {
          page.active = false;
        }
      }
    }
    this.pages = this.pages.filter((p) => p.active);

    // Update shockwaves
    for (const sw of this.shockwaves) {
      if (!sw.active) continue;
      sw.x += sw.velocityX * dt;
      if (sw.x < -40 || sw.x > ARENA_WIDTH + 40) {
        sw.active = false;
      }
    }
    this.shockwaves = this.shockwaves.filter((sw) => sw.active);
  }

  // ─── Get Active Hazards ────────────────────────────────────────

  getActiveHazards(): DamageZone[] {
    const hazards: DamageZone[] = [];
    const state = this.stateMachine.getCurrentState();

    // Beam hazard
    if (this.beamActive) {
      const beamLength = 1500;
      const angles = this.beamAngles.length > 0 ? this.beamAngles : [this.beamAngle];
      const beamW = state === "TRIPLE_BEAM_FIRE" ? this.params.tripleBeamWidth : this.params.beamWidth;

      for (const angle of angles) {
        // Create an AABB approximation of the rotated beam
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const halfW = beamW / 2;

        // Sample the beam at intervals and create hazard zones
        const steps = 8;
        for (let i = 0; i < steps; i++) {
          const t0 = (i / steps) * beamLength;
          const t1 = ((i + 1) / steps) * beamLength;
          const cx = this.beamOrigin.x + cos * (t0 + t1) / 2;
          const cy = this.beamOrigin.y + sin * (t0 + t1) / 2;
          const segLen = t1 - t0;
          // AABB that encloses this beam segment
          const hw = (Math.abs(cos) * segLen + Math.abs(sin) * beamW) / 2 + halfW;
          const hh = (Math.abs(sin) * segLen + Math.abs(cos) * beamW) / 2 + halfW;
          hazards.push({
            rect: { x: cx - hw, y: cy - hh, width: hw * 2, height: hh * 2 },
            damage: this.params.beamDamage,
            knockback: { x: cos * 200, y: sin * 200 },
            type: "beam",
          });
        }
      }
    }

    // Page hazards
    for (const page of this.pages) {
      if (!page.active) continue;
      hazards.push({
        rect: {
          x: page.x - page.size / 2,
          y: page.y - page.size / 2,
          width: page.size,
          height: page.size,
        },
        damage: page.damage,
        knockback: {
          x: page.vx > 0 ? 150 : -150,
          y: -100,
        },
        type: "page",
      });
    }

    // Dive body hitbox
    if (state === "DIVE_ATTACK" || state === "DESPERATION_SLAM") {
      hazards.push({
        rect: this.getBounds(),
        damage: this.currentAttack === "desperation-slam" ? this.params.desperationSlamDamage : this.params.diveDamage,
        knockback: { x: 0, y: -this.params.diveKnockback },
        type: "dive",
      });
    }

    // Shockwaves
    for (const sw of this.shockwaves) {
      if (!sw.active) continue;
      hazards.push({
        rect: { x: sw.x, y: sw.y, width: sw.width, height: sw.height },
        damage: sw.damage,
        knockback: { x: sw.velocityX > 0 ? 300 : -300, y: -200 },
        type: "shockwave",
      });
    }

    return hazards;
  }

  // ─── Render ────────────────────────────────────────────────────

  render(ctx: CanvasRenderingContext2D, _camera: Camera): void {
    const state = this.stateMachine.getCurrentState();
    const mode = RenderConfig.getMode();
    if (state === "DEAD") return;

    const bx = this.position.x + this.bodyShakeOffset.x;
    const by = this.position.y + this.bodyShakeOffset.y;

    // Death fade
    let deathAlpha = 1;
    if (state === "DYING") {
      deathAlpha = Math.max(0, this.stateTimer / DEATH_DURATION);
    }

    // Teleport alpha
    const alpha = deathAlpha * this.teleportAlpha;

    ctx.save();
    ctx.globalAlpha = alpha;

    const isFlashing = this.hitFlashTimer > 0;
    const centerX = bx + this.size.x / 2;
    const centerY = by + this.size.y / 2;

    // ─── Sprite body rendering ──────────────────────────────
    if (mode === "sprites" || mode === "both") {
      if (this.spritesReady && this.activeAnimController) {
        const sheet = this.activeAnimController.getSpriteSheet();
        if (sheet.isLoaded()) {
          const spriteOffsetX = (sheet.config.frameWidth - this.size.x) / 2;
          const spriteOffsetY = sheet.config.frameHeight - this.size.y;
          const drawX = bx - spriteOffsetX;
          const drawY = by - spriteOffsetY;

          this.activeAnimController.draw(ctx, drawX, drawY, false);

          // Hit flash overlay on top of sprite
          if (isFlashing) {
            ctx.globalAlpha = alpha * 0.7;
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(drawX, drawY, sheet.config.frameWidth, sheet.config.frameHeight);
            ctx.globalAlpha = alpha;
          }

          // Phase 2/3 red glow overlay
          if (this.currentPhase >= 2) {
            ctx.globalAlpha = alpha * 0.15;
            ctx.fillStyle = "#ef4444";
            ctx.fillRect(drawX, drawY, sheet.config.frameWidth, sheet.config.frameHeight);
            ctx.globalAlpha = alpha;
          }
        }
      } else {
        // Placeholder fallback
        ctx.fillStyle = isFlashing ? "#ffffff" : "#f8fafc";
        ctx.fillRect(bx, by, this.size.x, this.size.y);
        ctx.fillStyle = "#1e1b4b";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.fillText("Misprint Seraph", bx + this.size.x / 2, by + this.size.y / 2 + 4);
        ctx.textAlign = "left";
      }
    }

    // ─── Rectangle body rendering ───────────────────────────
    if (mode === "rectangles" || mode === "both") {
      if (mode === "both") {
        ctx.globalAlpha = alpha * 0.5;
      }

    // ─── Wings ───────────────────────────────────────────
    const wingExtent = (this.params.wingSpan - this.size.x) / 2;

    // Left wings (2 triangular shapes)
    for (let w = 0; w < 2; w++) {
      const yOffset = w * 30;
      ctx.beginPath();
      ctx.moveTo(bx, by + 20 + yOffset);
      ctx.lineTo(bx, by + 60 + yOffset);
      ctx.lineTo(bx - wingExtent, by + 40 + yOffset + this.wingFlutter * (w === 0 ? 1 : -0.7));
      ctx.closePath();
      ctx.fillStyle = isFlashing ? "rgba(255,255,255,0.6)" : "rgba(248, 250, 252, 0.4)";
      ctx.fill();
      // Wing text lines
      ctx.strokeStyle = isFlashing ? "rgba(255,255,255,0.3)" : "rgba(239, 68, 68, 0.15)";
      ctx.lineWidth = 1;
      for (let line = 0; line < 3; line++) {
        const ly = by + 25 + yOffset + line * 10;
        const lx1 = bx - wingExtent * 0.3 - line * 8;
        ctx.beginPath();
        ctx.moveTo(bx - 2, ly);
        ctx.lineTo(lx1, ly);
        ctx.stroke();
      }
    }

    // Right wings
    for (let w = 0; w < 2; w++) {
      const yOffset = w * 30;
      ctx.beginPath();
      ctx.moveTo(bx + this.size.x, by + 20 + yOffset);
      ctx.lineTo(bx + this.size.x, by + 60 + yOffset);
      ctx.lineTo(bx + this.size.x + wingExtent, by + 40 + yOffset + this.wingFlutter * (w === 0 ? -1 : 0.7));
      ctx.closePath();
      ctx.fillStyle = isFlashing ? "rgba(255,255,255,0.6)" : "rgba(248, 250, 252, 0.4)";
      ctx.fill();
      ctx.strokeStyle = isFlashing ? "rgba(255,255,255,0.3)" : "rgba(239, 68, 68, 0.15)";
      ctx.lineWidth = 1;
      for (let line = 0; line < 3; line++) {
        const ly = by + 25 + yOffset + line * 10;
        const lx1 = bx + this.size.x + wingExtent * 0.3 + line * 8;
        ctx.beginPath();
        ctx.moveTo(bx + this.size.x + 2, ly);
        ctx.lineTo(lx1, ly);
        ctx.stroke();
      }
    }

    // Phase 3: jagged wing extra vertices
    if (this.currentPhase === 3) {
      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 3; i++) {
          const sx = side === -1 ? bx - wingExtent * (0.3 + i * 0.2) : bx + this.size.x + wingExtent * (0.3 + i * 0.2);
          const sy = by + 25 + i * 15 + Math.sin(this.frameCounter * 0.1 + i) * 5;
          ctx.fillStyle = "rgba(239, 68, 68, 0.2)";
          ctx.fillRect(sx - 3, sy - 3, 6, 6);
        }
      }
    }

    // ─── Body ────────────────────────────────────────────
    // Rounded rectangle body
    const cornerR = 8;
    ctx.beginPath();
    ctx.moveTo(bx + cornerR, by);
    ctx.lineTo(bx + this.size.x - cornerR, by);
    ctx.arcTo(bx + this.size.x, by, bx + this.size.x, by + cornerR, cornerR);
    ctx.lineTo(bx + this.size.x, by + this.size.y - cornerR);
    ctx.arcTo(bx + this.size.x, by + this.size.y, bx + this.size.x - cornerR, by + this.size.y, cornerR);
    ctx.lineTo(bx + cornerR, by + this.size.y);
    ctx.arcTo(bx, by + this.size.y, bx, by + this.size.y - cornerR, cornerR);
    ctx.lineTo(bx, by + cornerR);
    ctx.arcTo(bx, by, bx + cornerR, by, cornerR);
    ctx.closePath();

    if (isFlashing) {
      ctx.fillStyle = "#ffffff";
    } else {
      const gradient = ctx.createLinearGradient(bx, by, bx, by + this.size.y);
      gradient.addColorStop(0, "#f8fafc");
      gradient.addColorStop(1, "#e2e8f0");
      ctx.fillStyle = gradient;
    }
    ctx.fill();

    // Phase 2+ red glow
    if (this.currentPhase >= 2 && !isFlashing) {
      const glowAlpha = 0.15 + Math.sin(this.frameCounter * 0.08) * 0.1;
      ctx.strokeStyle = `rgba(239, 68, 68, ${glowAlpha})`;
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    // ─── Glyphs ──────────────────────────────────────────
    ctx.font = "bold 24px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let i = 0; i < GLYPH_SYMBOLS.length; i++) {
      const jitterX = Math.sin(this.frameCounter * 0.1 + i * 1.7) * 2;
      const jitterY = Math.cos(this.frameCounter * 0.08 + i * 2.1) * 2;
      const gx = centerX + jitterX;
      const gy = by + 18 + i * 22 + jitterY;
      const fontSize = 20 + (i % 2) * 6;
      ctx.font = `bold ${fontSize}px serif`;
      ctx.fillStyle = isFlashing ? "#ffffff" : "#ef4444";
      ctx.fillText(GLYPH_SYMBOLS[i], gx, gy);
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    // ─── Halo ────────────────────────────────────────────
    ctx.save();
    ctx.translate(centerX, by - 10);
    ctx.rotate(this.haloRotation);
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.strokeStyle = isFlashing ? "rgba(255,255,255,0.5)" : "rgba(239, 68, 68, 0.3)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

      if (mode === "both") {
        ctx.globalAlpha = alpha;
      }
    } // end rectangle body rendering

    // ─── Beam telegraph / fire (ALWAYS drawn regardless of mode) ───
    if (state === "BEAM_TELEGRAPH" || state === "TRIPLE_BEAM_TELEGRAPH") {
      const progress = 1 - this.stateTimer / this.params.beamTelegraph;
      const pulseAlpha = 0.3 + Math.sin(this.frameCounter * 0.3) * 0.2;

      const angles = this.beamAngles.length > 0 ? this.beamAngles : [this.beamAngle];
      for (const angle of angles) {
        ctx.save();
        ctx.translate(this.beamOrigin.x, this.beamOrigin.y);
        ctx.rotate(angle);
        ctx.strokeStyle = `rgba(239, 68, 68, ${pulseAlpha * progress})`;
        ctx.lineWidth = 2 + progress * 3;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(1500, 0);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    if (this.beamActive) {
      const angles = this.beamAngles.length > 0 ? this.beamAngles : [this.beamAngle];
      const beamW = state === "TRIPLE_BEAM_FIRE" ? this.params.tripleBeamWidth : this.params.beamWidth;

      for (const angle of angles) {
        ctx.save();
        ctx.translate(this.beamOrigin.x, this.beamOrigin.y);
        ctx.rotate(angle);
        // Beam gradient: white center, red edges
        const gradient = ctx.createLinearGradient(0, -beamW / 2, 0, beamW / 2);
        gradient.addColorStop(0, "rgba(239, 68, 68, 0.6)");
        gradient.addColorStop(0.3, "rgba(255, 255, 255, 0.9)");
        gradient.addColorStop(0.7, "rgba(255, 255, 255, 0.9)");
        gradient.addColorStop(1, "rgba(239, 68, 68, 0.6)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, -beamW / 2, 1500, beamW);
        ctx.restore();
      }
    }

    // ─── Dive telegraph ──────────────────────────────────
    if (state === "DIVE_TELEGRAPH") {
      // Crosshair at target
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.globalAlpha = alpha * (0.5 + Math.sin(this.frameCounter * 0.3) * 0.3);
      const tx = this.diveTarget.x;
      const ty = this.diveTarget.y;
      // Crosshair
      ctx.beginPath();
      ctx.moveTo(tx - 15, ty);
      ctx.lineTo(tx + 15, ty);
      ctx.moveTo(tx, ty - 15);
      ctx.lineTo(tx, ty + 15);
      ctx.stroke();
      // Circle
      ctx.beginPath();
      ctx.arc(tx, ty, 12, 0, Math.PI * 2);
      ctx.stroke();
      // Dive path line
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = alpha;
    }

    // ─── Desperation telegraph ───────────────────────────
    if (state === "DESPERATION_TELEGRAPH") {
      const progress = 1 - this.stateTimer / this.params.desperationTelegraph;
      // Swirling pages effect
      ctx.globalAlpha = alpha * progress;
      for (let i = 0; i < 8; i++) {
        const angle = this.frameCounter * 0.1 + (i * Math.PI * 2) / 8;
        const radius = 50 - progress * 30;
        const px = centerX + Math.cos(angle) * radius;
        const py = centerY + Math.sin(angle) * radius;
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(px - 4, py - 4, 8, 8);
      }
      // Growing red glow
      ctx.beginPath();
      ctx.arc(centerX, centerY, 60 * progress, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(220, 38, 38, ${progress * 0.3})`;
      ctx.fill();
      ctx.globalAlpha = alpha;
    }

    // ─── Stagger indicator ───────────────────────────────
    if (state === "BARRAGE_STAGGER" || state === "STORM_STAGGER" || state === "DESPERATION_COLLAPSE" || state === "DIVE_RECOVERY") {
      // Stunned symbols circling head
      for (let i = 0; i < 4; i++) {
        const angle = this.frameCounter * 0.15 + (i * Math.PI * 2) / 4;
        const sx = centerX + Math.cos(angle) * 25;
        const sy = by - 5 + Math.sin(angle) * 10;
        ctx.font = "12px serif";
        ctx.fillStyle = "#f59e0b";
        ctx.textAlign = "center";
        ctx.fillText(["?", "!", "*", "~"][i], sx, sy);
      }
      ctx.textAlign = "left";
    }

    // ─── Pages ───────────────────────────────────────────
    for (const page of this.pages) {
      if (!page.active) continue;
      ctx.save();
      ctx.translate(page.x, page.y);
      ctx.rotate(page.rotation);
      const half = page.size / 2;
      ctx.fillStyle = "#f1f5f9";
      ctx.fillRect(-half, -half, page.size, page.size);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1;
      ctx.strokeRect(-half, -half, page.size, page.size);
      // Red misprint mark
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-2, -2);
      ctx.lineTo(2, 2);
      ctx.stroke();
      ctx.restore();
    }

    // ─── Shockwaves ──────────────────────────────────────
    for (const sw of this.shockwaves) {
      if (!sw.active) continue;
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(sw.x, sw.y, sw.width, sw.height);
      ctx.globalAlpha = alpha;
    }

    // ─── Vulnerability indicator ─────────────────────────
    if (this.isAlive) {
      const vulnText = this.isVulnerable() ? "VULNERABLE" : "INVULNERABLE";
      const vulnColor = this.isVulnerable() ? "#22c55e" : "#ef4444";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = vulnColor;
      ctx.globalAlpha = alpha * 0.8;
      ctx.fillText(vulnText, centerX, by - 30);
      ctx.globalAlpha = alpha;
      ctx.textAlign = "left";
    }

    ctx.restore();
  }

  // ─── Render Health Bar ─────────────────────────────────────────

  renderHealthBar(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    if (!this.isAlive && this.stateMachine.getCurrentState() === "DEAD") return;

    const barWidth = 400;
    const barHeight = 12;
    const barX = (canvasWidth - barWidth) / 2;
    const barY = canvasHeight - 40;

    // Background
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);

    // Health fill
    const healthPct = this.health / this.maxHealth;
    const fillWidth = barWidth * healthPct;

    if (fillWidth > 0) {
      const gradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
      if (this.currentPhase === 3) {
        gradient.addColorStop(0, "#ef4444");
        gradient.addColorStop(1, "#dc2626");
      } else if (this.currentPhase === 2) {
        gradient.addColorStop(0, "#fca5a5");
        gradient.addColorStop(1, "#ef4444");
      } else {
        gradient.addColorStop(0, "#f8fafc");
        gradient.addColorStop(1, "#e2e8f0");
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

    // Boss name
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#9ca3af";
    ctx.fillText("MISPRINT SERAPH", canvasWidth / 2, barY + barHeight + 14);

    // Phase indicator dots
    for (let i = 0; i < 3; i++) {
      const dotX = canvasWidth / 2 - 15 + i * 15;
      const dotY = barY + barHeight + 24;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
      if (i < this.currentPhase) {
        ctx.fillStyle = this.currentPhase === 3 ? "#ef4444" : "#fca5a5";
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
    ctx.fillText(
      `${this.health} / ${this.maxHealth}`,
      canvasWidth / 2,
      barY - 6,
    );

    ctx.textAlign = "left";
  }

  // ─── Render Debug Overlays ─────────────────────────────────────

  renderDebug(ctx: CanvasRenderingContext2D): void {
    // Boss hitbox
    ctx.strokeStyle = "#a855f7";
    ctx.lineWidth = 2;
    ctx.strokeRect(this.position.x, this.position.y, this.size.x, this.size.y);

    // Hover point markers
    for (let i = 0; i < HOVER_POINTS.length; i++) {
      const hp = HOVER_POINTS[i];
      ctx.strokeStyle = i === this.hoverPointIndex ? "#22c55e" : "#4b5563";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(hp.x, hp.y, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = "8px monospace";
      ctx.fillStyle = "#6b7280";
      ctx.fillText(String(i), hp.x + 10, hp.y + 3);
    }

    // Page hitboxes
    for (const page of this.pages) {
      if (!page.active) continue;
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        page.x - page.size / 2,
        page.y - page.size / 2,
        page.size,
        page.size,
      );
    }

    // Shockwave hitboxes
    for (const sw of this.shockwaves) {
      if (!sw.active) continue;
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1;
      ctx.strokeRect(sw.x, sw.y, sw.width, sw.height);
    }

    // State and phase labels
    ctx.font = "9px monospace";
    ctx.fillStyle = "#a78bfa";
    ctx.fillText(
      `State: ${this.stateMachine.getCurrentState()}`,
      this.position.x,
      this.position.y - 42,
    );
    ctx.fillStyle = "#818cf8";
    ctx.fillText(
      `Phase: ${this.currentPhase} | Timer: ${this.stateTimer}`,
      this.position.x,
      this.position.y - 54,
    );
  }

  // ─── Render Corrupted Floor ────────────────────────────────────

  renderCorruptedFloor(ctx: CanvasRenderingContext2D): void {
    if (!this.corruptedFloorActive) return;
    const pulseAlpha = 0.2 + Math.sin(this.frameCounter * 0.05) * 0.1;
    ctx.fillStyle = `rgba(220, 38, 38, ${pulseAlpha})`;
    ctx.fillRect(0, GROUND_Y, ARENA_WIDTH, 80);
    // Faint upward particles (visual only, no actual particles spawned each frame)
    for (let i = 0; i < 3; i++) {
      const px = Math.sin(this.frameCounter * 0.03 + i * 2.1) * ARENA_WIDTH * 0.4 + ARENA_WIDTH / 2;
      const py = GROUND_Y - Math.sin(this.frameCounter * 0.02 + i * 1.7) * 15;
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(239, 68, 68, ${0.3 + Math.sin(this.frameCounter * 0.1 + i) * 0.2})`;
      ctx.fill();
    }
  }

  // ─── Reset ─────────────────────────────────────────────────────

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
    this.teleportAlpha = 1;
    this.desperationUsed = false;

    const startHover = HOVER_POINTS[0];
    this.position = position
      ? { ...position }
      : {
          x: startHover.x - this.params.bodyWidth / 2,
          y: startHover.y - this.params.bodyHeight / 2,
        };
    this.targetHoverPoint = { ...startHover };
    this.hoverPointIndex = 0;

    this.attackSequence = [...PHASE_1_SEQUENCE];
    this.sequenceIndex = 0;
    this.currentAttack = null;

    this.pages = [];
    this.shockwaves = [];
    this.beamActive = false;
    this.divePath = null;
    this.rapidDiveIndex = 0;

    this.corruptedFloorActive = false;
    this.phase2PlatformsVisible = false;

    this.bodyShakeOffset = { x: 0, y: 0 };
    this.stateMachine.setState("IDLE");
  }

  // ─── Skip to Phase ─────────────────────────────────────────────

  skipToPhase(phase: 2 | 3): void {
    if (phase === 2) {
      this.health = this.params.phase1Threshold;
    } else {
      this.health = this.params.phase2Threshold;
    }
    this.startPhaseTransition(phase);
  }
}
