import { StateMachine } from "@/engine/states/StateMachine";
import type { ParticleSystem } from "@/engine/core/ParticleSystem";
import type { ScreenShake } from "@/engine/core/ScreenShake";
import type { Camera } from "@/engine/core/Camera";
import type { Vec2, Rect } from "@/lib/types";
import type { FootnoteGiantParams } from "./FootnoteGiantParams";
import { DEFAULT_FOOTNOTE_GIANT_PARAMS } from "./FootnoteGiantParams";
import type { DamageZone } from "./types";

// ─── Sub-entity types ──────────────────────────────────────────────

interface Shockwave {
  x: number;
  y: number;
  width: number;
  height: number;
  velocityX: number;
  distanceTraveled: number;
  maxDistance: number;
  damage: number;
  active: boolean;
}

interface InkBlot {
  x: number;
  y: number;
  size: number;
  velocityY: number;
  damage: number;
  active: boolean;
}

interface SweepBeam {
  x: number;
  y: number;
  width: number;
  height: number;
  velocityX: number;
  damage: number;
  active: boolean;
}

// ─── State names ───────────────────────────────────────────────────

type FootnoteGiantState =
  | "IDLE"
  | "PILLAR_TELEGRAPH"
  | "PILLAR_SLAM"
  | "PILLAR_STUCK"
  | "PILLAR_RECOVER"
  | "INK_RAIN_TELEGRAPH"
  | "INK_RAIN"
  | "CITATION_TELEGRAPH"
  | "CITATION_STAMP"
  | "CITATION_RECOVERY"
  | "SWEEP_TELEGRAPH"
  | "SWEEP"
  | "SWEEP_RECOVERY"
  | "PHASE_TRANSITION"
  | "DYING"
  | "DEAD";

// ─── Constants ─────────────────────────────────────────────────────

const HIT_FLASH_FRAMES = 4;
const BOSS_WIDTH = 128;
const BOSS_HEIGHT = 160;
const GROUND_Y = 460;
const GLYPH_SYMBOLS = ["¶", "§", "‡", "†"];
const GLYPH_FONT = "bold 36px serif";
const GLYPH_HEIGHT = 28;
const BRACKET_HEIGHT = 40;
const DEATH_DURATION = 120;

// Pillar slam danger zone width
const SLAM_ZONE_WIDTH = 80;

// Attack sequences per phase
const PHASE_1_SEQUENCE = [
  "pillar-slam-left",
  "ink-rain",
  "pillar-slam-right",
  "pillar-slam-left",
  "ink-rain",
  "pillar-slam-right",
];

const PHASE_2_SEQUENCE = [
  "fast-slam-left",
  "citation-stamp",
  "fast-slam-right",
  "fast-slam-center",
  "focused-rain",
  "citation-stamp",
];

const PHASE_3_SEQUENCE = [
  "triple-slam",
  "citation-stamp-plus-rain",
  "footnote-sweep",
  "triple-slam",
  "footnote-sweep",
  "citation-stamp-plus-rain",
];

// ─── FootnoteGiant Class ──────────────────────────────────────────

export class FootnoteGiant {
  params: FootnoteGiantParams;

  // Health
  health: number;
  maxHealth: number;
  currentPhase: 1 | 2 | 3 = 1;
  isAlive = true;
  invincibilityFrames = 0;

  // Position (fixed)
  position: Vec2;
  size: Vec2 = { x: BOSS_WIDTH, y: BOSS_HEIGHT };

  // State machine
  stateMachine: StateMachine<FootnoteGiant>;
  stateTimer = 0;

  // Attack sequencer
  attackSequence: string[] = [...PHASE_1_SEQUENCE];
  sequenceIndex = 0;

  // Attack state
  currentAttack: string | null = null;
  pillarSlamSide: "left" | "center" | "right" = "left";
  slamDangerZone: Rect | null = null;
  shockwaves: Shockwave[] = [];
  inkBlots: InkBlot[] = [];
  sweepBeam: SweepBeam | null = null;

  // Triple slam sub-state
  private tripleSlamIndex = 0;
  private tripleSlamSides: Array<"left" | "center" | "right"> = [
    "left",
    "center",
    "right",
  ];

  // Citation stamp shockwave (full ground)
  private stampShockwaveLeft: Shockwave | null = null;
  private stampShockwaveRight: Shockwave | null = null;

  // Ink rain spawn tracking
  private inkRainSpawnTimer = 0;
  private inkRainSpawnedCount = 0;

  // Player position (updated each frame)
  private playerPosition: Vec2 = { x: 0, y: 0 };

  // Visual state
  hitFlashTimer = 0;
  phaseTransitionTimer = 0;
  glyphOffsets: Vec2[] = GLYPH_SYMBOLS.map(() => ({ x: 0, y: 0 }));
  bodyShakeOffset: Vec2 = { x: 0, y: 0 };
  deathTimer = 0;
  private frameCounter = 0;
  private citationNumber = 0;

  // Phase 2 platforms visible
  phase2PlatformsVisible = false;

  // Hitstop
  hitstopTimer = 0;

  // Systems (set externally)
  particleSystem: ParticleSystem | null = null;
  screenShake: ScreenShake | null = null;

  // AI toggle
  aiEnabled = true;

  // Total damage tracking
  totalDamageReceived = 0;

  constructor(params?: Partial<FootnoteGiantParams>) {
    this.params = { ...DEFAULT_FOOTNOTE_GIANT_PARAMS, ...params };
    this.health = this.params.maxHealth;
    this.maxHealth = this.params.maxHealth;

    // Boss stands at right side of arena, feet on ground
    this.position = { x: 1080, y: GROUND_Y - BOSS_HEIGHT };

    this.stateMachine = new StateMachine<FootnoteGiant>(this);
    this.registerStates();
    this.stateMachine.setState("IDLE");
  }

  // ─── State Registration ────────────────────────────────────────

  private registerStates(): void {
    this.stateMachine.addState({
      name: "IDLE",
      enter: (b) => {
        // Short pause for triple slam continuation, normal otherwise
        if (b.currentAttack === "triple-slam" && b.tripleSlamIndex < b.tripleSlamSides.length) {
          b.stateTimer = 5; // Very brief pause between triple slams
        } else {
          b.stateTimer = b.currentPhase === 3
            ? Math.min(b.params.invulnBetweenAttacks, 15)
            : b.params.invulnBetweenAttacks;
        }
        b.slamDangerZone = null;
      },
      update: (b) => {
        if (!b.aiEnabled) return;
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          // Check if we're continuing a triple slam
          if (b.continueTripleSlam()) return;
          b.nextAttack();
        }
      },
    });

    // ─── Pillar Slam States ────────────────────────────────────

    this.stateMachine.addState({
      name: "PILLAR_TELEGRAPH",
      enter: (b) => {
        const telegraphFrames = b.currentPhase === 1
          ? b.params.pillarSlamTelegraph
          : b.currentPhase === 2
            ? Math.max(30, b.params.pillarSlamTelegraph - 10)
            : Math.max(20, b.params.pillarSlamTelegraph - 20);
        b.stateTimer = telegraphFrames;
        b.slamDangerZone = b.computeSlamDangerZone(b.pillarSlamSide);
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("PILLAR_SLAM");
        }
      },
    });

    this.stateMachine.addState({
      name: "PILLAR_SLAM",
      enter: (b) => {
        b.stateTimer = 6;
        // Spawn shockwaves from slam impact
        if (b.slamDangerZone) {
          const impactX = b.slamDangerZone.x + b.slamDangerZone.width / 2;
          const speed = b.currentPhase >= 2
            ? Math.max(b.params.shockwaveSpeed, 400)
            : b.params.shockwaveSpeed;
          // Left-traveling shockwave
          b.shockwaves.push({
            x: impactX,
            y: GROUND_Y - b.params.shockwaveHeight,
            width: 20,
            height: b.params.shockwaveHeight,
            velocityX: -speed,
            distanceTraveled: 0,
            maxDistance: b.params.shockwaveRange,
            damage: b.params.shockwaveDamage,
            active: true,
          });
          // Right-traveling shockwave
          b.shockwaves.push({
            x: impactX,
            y: GROUND_Y - b.params.shockwaveHeight,
            width: 20,
            height: b.params.shockwaveHeight,
            velocityX: speed,
            distanceTraveled: 0,
            maxDistance: b.params.shockwaveRange,
            damage: b.params.shockwaveDamage,
            active: true,
          });
        }
        // Screen shake on slam
        b.screenShake?.shake(5, 8);
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("PILLAR_STUCK");
        }
      },
    });

    this.stateMachine.addState({
      name: "PILLAR_STUCK",
      enter: (b) => {
        const stuckFrames = b.currentPhase === 1
          ? b.params.pillarSlamStuck
          : b.currentPhase === 2
            ? Math.max(40, b.params.pillarSlamStuck - 10)
            : Math.max(25, b.params.pillarSlamStuck - 25);
        b.stateTimer = stuckFrames;
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("PILLAR_RECOVER");
        }
      },
    });

    this.stateMachine.addState({
      name: "PILLAR_RECOVER",
      enter: (b) => {
        b.stateTimer = b.currentPhase === 3
          ? Math.max(20, b.params.pillarSlamRecover - 10)
          : b.params.pillarSlamRecover;
        b.slamDangerZone = null;
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("IDLE");
        }
      },
    });

    // ─── Ink Rain States ───────────────────────────────────────

    this.stateMachine.addState({
      name: "INK_RAIN_TELEGRAPH",
      enter: (b) => {
        b.stateTimer = b.params.inkRainTelegraph;
        b.inkRainSpawnedCount = 0;
        b.inkRainSpawnTimer = 0;
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("INK_RAIN");
        }
      },
    });

    this.stateMachine.addState({
      name: "INK_RAIN",
      enter: (b) => {
        b.stateTimer = b.params.inkRainDuration;
        b.inkRainSpawnedCount = 0;
        b.inkRainSpawnTimer = 0;
      },
      update: (b) => {
        b.stateTimer--;

        // Spawn ink blots over the duration
        const blotCount = b.currentPhase >= 2 ? 3 : b.params.inkRainBlotCount;
        const spawnInterval = Math.floor(b.params.inkRainDuration / blotCount);

        b.inkRainSpawnTimer++;
        if (
          b.inkRainSpawnTimer >= spawnInterval &&
          b.inkRainSpawnedCount < blotCount
        ) {
          b.inkRainSpawnTimer = 0;
          b.inkRainSpawnedCount++;

          // Bias toward player position
          const spread = b.currentPhase >= 2 ? 60 : 100;
          const targetX =
            b.playerPosition.x + (Math.random() * 2 - 1) * spread;
          const clampedX = Math.max(30, Math.min(1250, targetX));

          const fallSpeed = b.currentPhase >= 2
            ? Math.max(b.params.inkRainFallSpeed, 450)
            : b.params.inkRainFallSpeed;

          b.inkBlots.push({
            x: clampedX,
            y: 0,
            size: b.params.inkRainBlotSize,
            velocityY: fallSpeed,
            damage: b.params.inkRainDamage,
            active: true,
          });
        }

        if (b.stateTimer <= 0) {
          b.stateMachine.setState("IDLE");
        }
      },
    });

    // ─── Citation Stamp States ─────────────────────────────────

    this.stateMachine.addState({
      name: "CITATION_TELEGRAPH",
      enter: (b) => {
        b.stateTimer = b.params.citationStampTelegraph;
        b.citationNumber++;
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("CITATION_STAMP");
        }
      },
    });

    this.stateMachine.addState({
      name: "CITATION_STAMP",
      enter: (b) => {
        b.stateTimer = 4;
        // Full-ground shockwave
        const bossCenter = b.position.x + b.size.x / 2;
        b.stampShockwaveLeft = {
          x: bossCenter,
          y: GROUND_Y - b.params.citationStampShockwaveHeight,
          width: 30,
          height: b.params.citationStampShockwaveHeight,
          velocityX: -b.params.citationStampShockwaveSpeed,
          distanceTraveled: 0,
          maxDistance: 1300,
          damage: b.params.citationStampDamage,
          active: true,
        };
        b.stampShockwaveRight = {
          x: bossCenter,
          y: GROUND_Y - b.params.citationStampShockwaveHeight,
          width: 30,
          height: b.params.citationStampShockwaveHeight,
          velocityX: b.params.citationStampShockwaveSpeed,
          distanceTraveled: 0,
          maxDistance: 1300,
          damage: b.params.citationStampDamage,
          active: true,
        };
        b.screenShake?.shake(8, 12);
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("CITATION_RECOVERY");
        }
      },
    });

    this.stateMachine.addState({
      name: "CITATION_RECOVERY",
      enter: (b) => {
        b.stateTimer = b.params.citationStampRecovery;
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("IDLE");
        }
      },
    });

    // ─── Sweep States ──────────────────────────────────────────

    this.stateMachine.addState({
      name: "SWEEP_TELEGRAPH",
      enter: (b) => {
        b.stateTimer = b.params.footnoteSweepTelegraph;
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("SWEEP");
        }
      },
    });

    this.stateMachine.addState({
      name: "SWEEP",
      enter: (b) => {
        // Beam starts at boss and sweeps left
        b.sweepBeam = {
          x: b.position.x,
          y: GROUND_Y - b.params.footnoteSweepHeight,
          width: 60,
          height: b.params.footnoteSweepHeight,
          velocityX: -b.params.footnoteSweepSpeed,
          damage: b.params.footnoteSweepDamage,
          active: true,
        };
        b.stateTimer = Math.ceil((1300 / b.params.footnoteSweepSpeed) * 60);
      },
      update: (b) => {
        b.stateTimer--;
        if (b.sweepBeam && b.sweepBeam.active) {
          if (b.sweepBeam.x + b.sweepBeam.width < 0) {
            b.sweepBeam.active = false;
          }
        }
        if (b.stateTimer <= 0 || !b.sweepBeam?.active) {
          b.sweepBeam = null;
          b.stateMachine.setState("SWEEP_RECOVERY");
        }
      },
    });

    this.stateMachine.addState({
      name: "SWEEP_RECOVERY",
      enter: (b) => {
        b.stateTimer = b.params.footnoteSweepRecovery;
      },
      update: (b) => {
        b.stateTimer--;
        if (b.stateTimer <= 0) {
          b.stateMachine.setState("IDLE");
        }
      },
    });

    // ─── Phase Transition ──────────────────────────────────────

    this.stateMachine.addState({
      name: "PHASE_TRANSITION",
      enter: (b) => {
        b.stateTimer = b.params.phaseTransitionDuration;
        b.phaseTransitionTimer = b.params.phaseTransitionDuration;
        b.screenShake?.shake(6, 30);

        // Emit transition particles
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
          colors: ["#4338ca", "#a5b4fc", "#e0e7ff", "#1e1b4b"],
          gravity: 100,
        });
      },
      update: (b) => {
        b.stateTimer--;
        b.phaseTransitionTimer = b.stateTimer;

        // Glyph separation animation
        const progress = 1 - b.stateTimer / b.params.phaseTransitionDuration;
        const separation = Math.sin(progress * Math.PI) * 30;
        for (let i = 0; i < b.glyphOffsets.length; i++) {
          b.glyphOffsets[i].x =
            Math.sin(progress * Math.PI * 4 + i * 1.5) * separation;
          b.glyphOffsets[i].y =
            Math.cos(progress * Math.PI * 3 + i * 2) * separation * 0.5;
        }

        if (b.stateTimer <= 0) {
          // Reset glyph offsets
          for (const offset of b.glyphOffsets) {
            offset.x = 0;
            offset.y = 0;
          }

          if (b.currentPhase === 2) {
            b.phase2PlatformsVisible = true;
            // Platform appear particles
            const platPositions = [
              { x: 120, y: 300 },
              { x: 440, y: 260 },
              { x: 750, y: 320 },
            ];
            for (const p of platPositions) {
              b.particleSystem?.emit({
                x: p.x,
                y: p.y,
                count: 8,
                speedMin: 30,
                speedMax: 80,
                angleMin: -Math.PI,
                angleMax: 0,
                lifeMin: 0.3,
                lifeMax: 0.6,
                sizeMin: 2,
                sizeMax: 4,
                colors: ["#4338ca", "#a5b4fc"],
                gravity: 100,
              });
            }
          }

          b.stateMachine.setState("IDLE");
        }
      },
    });

    // ─── Death States ──────────────────────────────────────────

    this.stateMachine.addState({
      name: "DYING",
      enter: (b) => {
        b.stateTimer = DEATH_DURATION;
        b.deathTimer = DEATH_DURATION;
        b.screenShake?.shake(8, 30);
      },
      update: (b) => {
        b.stateTimer--;
        b.deathTimer = b.stateTimer;

        // Emit particles during death
        if (b.stateTimer % 5 === 0) {
          b.particleSystem?.emit({
            x:
              b.position.x +
              Math.random() * b.size.x,
            y:
              b.position.y +
              Math.random() * b.size.y,
            count: 5,
            speedMin: 50,
            speedMax: 200,
            angleMin: 0,
            angleMax: Math.PI * 2,
            lifeMin: 0.3,
            lifeMax: 0.8,
            sizeMin: 2,
            sizeMax: 6,
            colors: ["#1e1b4b", "#4338ca", "#a5b4fc", "#ffffff"],
            gravity: 100,
          });
        }

        if (b.stateTimer <= 0) {
          // Final burst
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
            colors: ["#ffffff", "#e0e7ff", "#a5b4fc", "#4338ca"],
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
      state === "PILLAR_STUCK" ||
      state === "CITATION_RECOVERY" ||
      state === "SWEEP_RECOVERY"
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

    // Hit particles
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
      colors: ["#ffffff", "#a5b4fc", "#1e1b4b"],
      gravity: 200,
    });

    if (this.health <= 0) {
      this.health = 0;
      this.stateMachine.setState("DYING");
      return true;
    }

    // Check phase transition
    this.checkPhaseTransition();

    return true;
  }

  /** Attempt to damage the boss when invulnerable — returns false, emits clang */
  tryBlockedHit(): void {
    // Clang particles (gray sparks)
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
    } else if (
      this.currentPhase === 2 &&
      this.health <= this.params.phase2Threshold
    ) {
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

    // Clear active hazards and attack state
    this.shockwaves = [];
    this.inkBlots = [];
    this.sweepBeam = null;
    this.slamDangerZone = null;
    this.stampShockwaveLeft = null;
    this.stampShockwaveRight = null;
    this.currentAttack = null;
    this.tripleSlamIndex = 0;

    this.stateMachine.setState("PHASE_TRANSITION");
  }

  // ─── Attack Sequencer ──────────────────────────────────────────

  nextAttack(): void {
    const attack = this.attackSequence[this.sequenceIndex];
    this.sequenceIndex =
      (this.sequenceIndex + 1) % this.attackSequence.length;
    this.currentAttack = attack;

    switch (attack) {
      case "pillar-slam-left":
        this.pillarSlamSide = "left";
        this.stateMachine.setState("PILLAR_TELEGRAPH");
        break;
      case "pillar-slam-right":
        this.pillarSlamSide = "right";
        this.stateMachine.setState("PILLAR_TELEGRAPH");
        break;
      case "fast-slam-left":
        this.pillarSlamSide = "left";
        this.stateMachine.setState("PILLAR_TELEGRAPH");
        break;
      case "fast-slam-right":
        this.pillarSlamSide = "right";
        this.stateMachine.setState("PILLAR_TELEGRAPH");
        break;
      case "fast-slam-center":
        this.pillarSlamSide = "center";
        this.stateMachine.setState("PILLAR_TELEGRAPH");
        break;
      case "ink-rain":
      case "focused-rain":
        this.stateMachine.setState("INK_RAIN_TELEGRAPH");
        break;
      case "citation-stamp":
        this.stateMachine.setState("CITATION_TELEGRAPH");
        break;
      case "citation-stamp-plus-rain":
        // Start citation stamp; rain will be spawned during CITATION_STAMP enter
        this.stateMachine.setState("CITATION_TELEGRAPH");
        break;
      case "triple-slam":
        this.startTripleSlam();
        break;
      case "footnote-sweep":
        this.stateMachine.setState("SWEEP_TELEGRAPH");
        break;
      default:
        this.stateMachine.setState("IDLE");
        break;
    }
  }

  // ─── Triple Slam (Phase 3) ────────────────────────────────────

  private startTripleSlam(): void {
    this.tripleSlamIndex = 0;
    this.tripleSlamSides = ["left", "right", "center"];
    this.pillarSlamSide = this.tripleSlamSides[0];
    this.stateMachine.setState("PILLAR_TELEGRAPH");
  }

  /** Called by IDLE to check if we're in a triple slam sequence */
  continueTripleSlam(): boolean {
    if (this.currentAttack !== "triple-slam") return false;

    this.tripleSlamIndex++;
    if (this.tripleSlamIndex >= this.tripleSlamSides.length) {
      return false; // Triple slam complete
    }

    this.pillarSlamSide = this.tripleSlamSides[this.tripleSlamIndex];
    this.stateMachine.setState("PILLAR_TELEGRAPH");
    return true;
  }

  // ─── Compute Slam Danger Zone ──────────────────────────────────

  private computeSlamDangerZone(side: "left" | "center" | "right"): Rect {
    const bossCenter = this.position.x + this.size.x / 2;
    let zoneX: number;

    switch (side) {
      case "left":
        zoneX = bossCenter - 300;
        break;
      case "center":
        zoneX = bossCenter - 160;
        break;
      case "right":
        zoneX = bossCenter - 40;
        break;
    }

    return {
      x: Math.max(20, zoneX),
      y: GROUND_Y - 120,
      width: SLAM_ZONE_WIDTH,
      height: 120,
    };
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

  // ─── Main Update ───────────────────────────────────────────────

  update(dt: number, playerBounds: Rect, playerPosition: Vec2): void {
    this.playerPosition.x = playerPosition.x;
    this.playerPosition.y = playerPosition.y;
    this.frameCounter++;

    // Tick timers
    if (this.invincibilityFrames > 0) this.invincibilityFrames--;
    if (this.hitFlashTimer > 0) this.hitFlashTimer--;

    // Hitstop: freeze boss AI but keep projectiles moving
    if (this.hitstopTimer > 0) {
      this.hitstopTimer--;
      // Still update projectiles during hitstop
      this.updateProjectiles(dt);
      return;
    }

    // Update state machine
    if (this.aiEnabled && this.isAlive) {
      this.stateMachine.update(dt);
    }

    // Handle citation-stamp-plus-rain: spawn rain batch on stamp frame
    if (
      this.currentAttack === "citation-stamp-plus-rain" &&
      this.stateMachine.getCurrentState() === "CITATION_STAMP" &&
      this.inkBlots.length === 0
    ) {
      // Spawn 3 blots at once — the simultaneous stamp+rain combo
      const blotCount = 3;
      for (let i = 0; i < blotCount; i++) {
        const targetX =
          this.playerPosition.x + (Math.random() * 2 - 1) * 80;
        this.inkBlots.push({
          x: Math.max(30, Math.min(1250, targetX)),
          y: 0,
          size: this.params.inkRainBlotSize,
          velocityY: 450,
          damage: this.params.inkRainDamage,
          active: true,
        });
      }
    }

    // Update projectiles
    this.updateProjectiles(dt);

    // Animate glyphs (breathing/bobbing)
    if (
      this.isAlive &&
      this.stateMachine.getCurrentState() !== "PHASE_TRANSITION"
    ) {
      for (let i = 0; i < this.glyphOffsets.length; i++) {
        this.glyphOffsets[i].y =
          Math.sin(this.frameCounter * 0.05 + i * 1.2) * 3;
      }
    }

    // Phase 3 constant shake
    if (this.currentPhase === 3 && this.isAlive) {
      this.bodyShakeOffset.x = (Math.random() * 2 - 1) * 2;
      this.bodyShakeOffset.y = (Math.random() * 2 - 1) * 1;
    } else {
      this.bodyShakeOffset.x = 0;
      this.bodyShakeOffset.y = 0;
    }
  }

  private updateProjectiles(dt: number): void {
    // Update shockwaves
    for (const sw of this.shockwaves) {
      if (!sw.active) continue;
      sw.x += sw.velocityX * dt;
      sw.distanceTraveled += Math.abs(sw.velocityX * dt);
      if (
        sw.distanceTraveled >= sw.maxDistance ||
        sw.x < -20 ||
        sw.x > 1300
      ) {
        sw.active = false;
      }
    }
    this.shockwaves = this.shockwaves.filter((sw) => sw.active);

    // Update stamp shockwaves
    if (this.stampShockwaveLeft?.active) {
      const sw = this.stampShockwaveLeft;
      sw.x += sw.velocityX * dt;
      sw.distanceTraveled += Math.abs(sw.velocityX * dt);
      if (sw.x + sw.width < 0 || sw.distanceTraveled >= sw.maxDistance) {
        sw.active = false;
      }
    }
    if (this.stampShockwaveRight?.active) {
      const sw = this.stampShockwaveRight;
      sw.x += sw.velocityX * dt;
      sw.distanceTraveled += Math.abs(sw.velocityX * dt);
      if (sw.x > 1300 || sw.distanceTraveled >= sw.maxDistance) {
        sw.active = false;
      }
    }

    // Update ink blots
    for (const blot of this.inkBlots) {
      if (!blot.active) continue;
      blot.y += blot.velocityY * dt;
      if (blot.y > GROUND_Y) {
        blot.active = false;
        // Splat particle
        this.particleSystem?.emit({
          x: blot.x,
          y: GROUND_Y,
          count: 4,
          speedMin: 20,
          speedMax: 60,
          angleMin: -Math.PI,
          angleMax: 0,
          lifeMin: 0.1,
          lifeMax: 0.3,
          sizeMin: 1,
          sizeMax: 3,
          colors: ["#1e1b4b", "#312e81"],
          gravity: 200,
        });
      }
    }
    this.inkBlots = this.inkBlots.filter((b) => b.active);

    // Update sweep beam
    if (this.sweepBeam?.active) {
      this.sweepBeam.x += this.sweepBeam.velocityX * dt;
      if (this.sweepBeam.x + this.sweepBeam.width < 0) {
        this.sweepBeam.active = false;
      }
    }
  }

  // ─── Get Active Hazards ────────────────────────────────────────

  getActiveHazards(): DamageZone[] {
    const hazards: DamageZone[] = [];

    // Slam danger zone (only active during PILLAR_SLAM)
    const state = this.stateMachine.getCurrentState();
    if (state === "PILLAR_SLAM" && this.slamDangerZone) {
      hazards.push({
        rect: this.slamDangerZone,
        damage: this.params.pillarSlamDamage,
        knockback: { x: 0, y: -this.params.pillarSlamKnockback },
        type: "slam",
      });
    }

    // Shockwaves
    for (const sw of this.shockwaves) {
      if (!sw.active) continue;
      hazards.push({
        rect: { x: sw.x, y: sw.y, width: sw.width, height: sw.height },
        damage: sw.damage,
        knockback: {
          x: sw.velocityX > 0 ? 200 : -200,
          y: -150,
        },
        type: "shockwave",
      });
    }

    // Stamp shockwaves
    if (this.stampShockwaveLeft?.active) {
      const sw = this.stampShockwaveLeft;
      hazards.push({
        rect: { x: sw.x, y: sw.y, width: sw.width, height: sw.height },
        damage: sw.damage,
        knockback: { x: -300, y: -200 },
        type: "stamp",
      });
    }
    if (this.stampShockwaveRight?.active) {
      const sw = this.stampShockwaveRight;
      hazards.push({
        rect: { x: sw.x, y: sw.y, width: sw.width, height: sw.height },
        damage: sw.damage,
        knockback: { x: 300, y: -200 },
        type: "stamp",
      });
    }

    // Ink blots
    for (const blot of this.inkBlots) {
      if (!blot.active) continue;
      hazards.push({
        rect: {
          x: blot.x - blot.size / 2,
          y: blot.y - blot.size / 2,
          width: blot.size,
          height: blot.size,
        },
        damage: blot.damage,
        knockback: { x: 0, y: 100 },
        type: "ink-blot",
      });
    }

    // Sweep beam
    if (this.sweepBeam?.active) {
      hazards.push({
        rect: {
          x: this.sweepBeam.x,
          y: this.sweepBeam.y,
          width: this.sweepBeam.width,
          height: this.sweepBeam.height,
        },
        damage: this.sweepBeam.damage,
        knockback: { x: -300, y: -200 },
        type: "sweep",
      });
    }

    // Citation stamp body damage during CITATION_STAMP
    if (state === "CITATION_STAMP") {
      hazards.push({
        rect: {
          x: this.position.x - 20,
          y: GROUND_Y - this.params.citationStampShockwaveHeight,
          width: this.size.x + 40,
          height: this.params.citationStampShockwaveHeight,
        },
        damage: this.params.citationStampDamage,
        knockback: { x: -this.params.citationStampKnockback, y: -200 },
        type: "stamp",
      });
    }

    return hazards;
  }

  // ─── Render ────────────────────────────────────────────────────

  render(ctx: CanvasRenderingContext2D, _camera: Camera): void {
    const state = this.stateMachine.getCurrentState();

    // Don't render if dead
    if (state === "DEAD") return;

    const bx = this.position.x + this.bodyShakeOffset.x;
    const by = this.position.y + this.bodyShakeOffset.y;

    // Death fade
    let deathAlpha = 1;
    if (state === "DYING") {
      deathAlpha = Math.max(0, this.stateTimer / DEATH_DURATION);
    }

    ctx.save();
    ctx.globalAlpha = deathAlpha;

    // Hit flash
    const isFlashing = this.hitFlashTimer > 0;

    // ─── Bracket base ───────────────────────────────────────
    const bracketY = by + this.size.y - BRACKET_HEIGHT;
    const bracketColor = isFlashing ? "#ffffff" : "#1e1b4b";
    ctx.fillStyle = bracketColor;
    ctx.fillRect(bx, bracketY, this.size.x, BRACKET_HEIGHT);

    // Bracket details (vertical lines on sides)
    ctx.fillStyle = isFlashing ? "#ffffff" : "#4338ca";
    ctx.fillRect(bx, bracketY, 6, BRACKET_HEIGHT);
    ctx.fillRect(bx + this.size.x - 6, bracketY, 6, BRACKET_HEIGHT);

    // ─── Glyph stack ────────────────────────────────────────
    const glyphStartY = by + this.size.y - BRACKET_HEIGHT - GLYPH_SYMBOLS.length * GLYPH_HEIGHT;
    ctx.font = GLYPH_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let i = 0; i < GLYPH_SYMBOLS.length; i++) {
      const gx = bx + this.size.x / 2 + this.glyphOffsets[i].x;
      const gy = glyphStartY + i * GLYPH_HEIGHT + GLYPH_HEIGHT / 2 + this.glyphOffsets[i].y;

      // Phase 3: red glyphs
      let glyphColor: string;
      let strokeColor: string;
      if (this.currentPhase === 3) {
        glyphColor = isFlashing ? "#ffffff" : "#ef4444";
        strokeColor = isFlashing ? "#ffffff" : "#991b1b";
      } else {
        glyphColor = isFlashing ? "#ffffff" : "#a5b4fc";
        strokeColor = isFlashing ? "#ffffff" : "#4338ca";
      }

      // Glyph stroke
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.strokeText(GLYPH_SYMBOLS[i], gx, gy);

      // Glyph fill
      ctx.fillStyle = glyphColor;
      ctx.fillText(GLYPH_SYMBOLS[i], gx, gy);
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    // ─── Attack telegraphs ──────────────────────────────────

    // Pillar slam danger zone
    if (
      (state === "PILLAR_TELEGRAPH" || state === "PILLAR_SLAM") &&
      this.slamDangerZone
    ) {
      const zone = this.slamDangerZone;
      const pulseAlpha = state === "PILLAR_TELEGRAPH"
        ? 0.2 + Math.sin(this.frameCounter * 0.3) * 0.15
        : 0.6;
      const zoneColor = state === "PILLAR_SLAM" ? "#ef4444" : "#f59e0b";

      ctx.globalAlpha = deathAlpha * pulseAlpha;
      ctx.fillStyle = zoneColor;
      ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
      ctx.globalAlpha = deathAlpha;

      // Outline
      ctx.strokeStyle = zoneColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
    }

    // Ink rain telegraph (dots at top)
    if (state === "INK_RAIN_TELEGRAPH") {
      ctx.globalAlpha = deathAlpha * 0.4;
      ctx.fillStyle = "#1e1b4b";
      for (let i = 0; i < 5; i++) {
        const dotX = 100 + i * 200 + Math.sin(this.frameCounter * 0.1 + i) * 30;
        ctx.beginPath();
        ctx.arc(dotX, 30 + Math.sin(this.frameCounter * 0.15 + i * 2) * 10, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = deathAlpha;
    }

    // Citation stamp telegraph
    if (state === "CITATION_TELEGRAPH") {
      const progress = 1 - this.stateTimer / this.params.citationStampTelegraph;
      const numSize = 20 + progress * 40;
      ctx.font = `bold ${numSize}px serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = "#ef4444";
      ctx.globalAlpha = deathAlpha * (0.3 + progress * 0.7);
      ctx.fillText(
        String(this.citationNumber),
        bx + this.size.x / 2,
        by - 20 - progress * 30,
      );

      // Ground flash
      ctx.globalAlpha = deathAlpha * progress * 0.3;
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(20, GROUND_Y - 10, 1240, 10);

      ctx.globalAlpha = deathAlpha;
      ctx.textAlign = "left";
      ctx.font = GLYPH_FONT;
    }

    // Sweep telegraph
    if (state === "SWEEP_TELEGRAPH") {
      const progress = 1 - this.stateTimer / this.params.footnoteSweepTelegraph;
      ctx.globalAlpha = deathAlpha * (0.2 + progress * 0.5);
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(
        20,
        GROUND_Y - this.params.footnoteSweepHeight,
        this.position.x - 20,
        this.params.footnoteSweepHeight,
      );
      ctx.globalAlpha = deathAlpha;
    }

    // ─── Shockwaves ─────────────────────────────────────────
    for (const sw of this.shockwaves) {
      if (!sw.active) continue;
      const fadeAlpha = 1 - sw.distanceTraveled / sw.maxDistance;
      ctx.globalAlpha = deathAlpha * fadeAlpha * 0.6;
      ctx.fillStyle = "#f59e0b";
      ctx.fillRect(sw.x, sw.y, sw.width, sw.height);
      ctx.globalAlpha = deathAlpha;
    }

    // Stamp shockwaves
    if (this.stampShockwaveLeft?.active) {
      const sw = this.stampShockwaveLeft;
      ctx.globalAlpha = deathAlpha * 0.7;
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(sw.x, sw.y, sw.width, sw.height);
      ctx.globalAlpha = deathAlpha;
    }
    if (this.stampShockwaveRight?.active) {
      const sw = this.stampShockwaveRight;
      ctx.globalAlpha = deathAlpha * 0.7;
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(sw.x, sw.y, sw.width, sw.height);
      ctx.globalAlpha = deathAlpha;
    }

    // ─── Ink blots ──────────────────────────────────────────
    for (const blot of this.inkBlots) {
      if (!blot.active) continue;
      ctx.fillStyle = "#1e1b4b";
      ctx.beginPath();
      ctx.arc(blot.x, blot.y, blot.size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#312e81";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // ─── Sweep beam ─────────────────────────────────────────
    if (this.sweepBeam?.active) {
      ctx.globalAlpha = deathAlpha * 0.8;
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(
        this.sweepBeam.x,
        this.sweepBeam.y,
        this.sweepBeam.width,
        this.sweepBeam.height,
      );
      // Glow outline
      ctx.strokeStyle = "#fca5a5";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        this.sweepBeam.x,
        this.sweepBeam.y,
        this.sweepBeam.width,
        this.sweepBeam.height,
      );
      ctx.globalAlpha = deathAlpha;
    }

    // ─── Vulnerability indicator ────────────────────────────
    if (this.isAlive) {
      const vulnText = this.isVulnerable() ? "VULNERABLE" : "INVULNERABLE";
      const vulnColor = this.isVulnerable() ? "#22c55e" : "#ef4444";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = vulnColor;
      ctx.globalAlpha = deathAlpha * 0.8;
      ctx.fillText(vulnText, bx + this.size.x / 2, by - 30);
      ctx.globalAlpha = deathAlpha;
      ctx.textAlign = "left";
    }

    ctx.restore();
  }

  // ─── Render Health Bar ─────────────────────────────────────────

  renderHealthBar(ctx: CanvasRenderingContext2D, canvasWidth: number): void {
    if (!this.isAlive && this.stateMachine.getCurrentState() === "DEAD") return;

    const barWidth = 400;
    const barHeight = 16;
    const barX = (canvasWidth - barWidth) / 2;
    const barY = 40;

    // Background
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);

    // Health fill with gradient
    const healthPct = this.health / this.maxHealth;
    const fillWidth = barWidth * healthPct;

    if (fillWidth > 0) {
      const gradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
      gradient.addColorStop(0, "#4338ca");
      gradient.addColorStop(1, healthPct < 0.3 ? "#ef4444" : "#6366f1");
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

    // Boss name and phase
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#9ca3af";
    ctx.fillText("FOOTNOTE GIANT", canvasWidth / 2 - 60, barY - 6);

    const phaseNames = { 1: "Phase I", 2: "Phase II", 3: "Phase III" } as const;
    const phaseColor = this.currentPhase === 3 ? "#ef4444" : "#a5b4fc";
    ctx.fillStyle = phaseColor;
    ctx.fillText(phaseNames[this.currentPhase], canvasWidth / 2 + 60, barY - 6);

    // HP text
    ctx.font = "bold 10px monospace";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(
      `${this.health} / ${this.maxHealth}`,
      canvasWidth / 2,
      barY + barHeight + 12,
    );

    ctx.textAlign = "left";
  }

  // ─── Render Debug Overlays ─────────────────────────────────────

  renderDebug(ctx: CanvasRenderingContext2D): void {
    // Boss hitbox
    ctx.strokeStyle = "#a855f7";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      this.position.x,
      this.position.y,
      this.size.x,
      this.size.y,
    );

    // Slam danger zones
    if (this.slamDangerZone) {
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(
        this.slamDangerZone.x,
        this.slamDangerZone.y,
        this.slamDangerZone.width,
        this.slamDangerZone.height,
      );
      ctx.setLineDash([]);
    }

    // Shockwave hitboxes
    for (const sw of this.shockwaves) {
      if (!sw.active) continue;
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 1;
      ctx.strokeRect(sw.x, sw.y, sw.width, sw.height);
    }

    // Stamp shockwave hitboxes
    if (this.stampShockwaveLeft?.active) {
      const sw = this.stampShockwaveLeft;
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1;
      ctx.strokeRect(sw.x, sw.y, sw.width, sw.height);
    }
    if (this.stampShockwaveRight?.active) {
      const sw = this.stampShockwaveRight;
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1;
      ctx.strokeRect(sw.x, sw.y, sw.width, sw.height);
    }

    // Ink blot hitboxes
    for (const blot of this.inkBlots) {
      if (!blot.active) continue;
      ctx.strokeStyle = "#312e81";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(blot.x, blot.y, blot.size / 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Sweep beam hitbox
    if (this.sweepBeam?.active) {
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        this.sweepBeam.x,
        this.sweepBeam.y,
        this.sweepBeam.width,
        this.sweepBeam.height,
      );
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

  // ─── Reset ─────────────────────────────────────────────────────

  reset(): void {
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
    this.citationNumber = 0;
    this.totalDamageReceived = 0;

    this.position = { x: 1080, y: GROUND_Y - BOSS_HEIGHT };

    this.attackSequence = [...PHASE_1_SEQUENCE];
    this.sequenceIndex = 0;
    this.currentAttack = null;
    this.pillarSlamSide = "left";
    this.slamDangerZone = null;
    this.shockwaves = [];
    this.inkBlots = [];
    this.sweepBeam = null;
    this.stampShockwaveLeft = null;
    this.stampShockwaveRight = null;
    this.tripleSlamIndex = 0;

    this.phase2PlatformsVisible = false;
    this.bodyShakeOffset = { x: 0, y: 0 };
    for (const offset of this.glyphOffsets) {
      offset.x = 0;
      offset.y = 0;
    }

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
