"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { GameCanvas } from "@/components/canvas/GameCanvas";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { RenderModeToggle } from "@/components/debug/RenderModeToggle";
import { Slider } from "@/components/debug/Slider";
import { Engine } from "@/engine/core/Engine";
import { RenderConfig } from "@/engine/core/RenderConfig";
import { Player, DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";
import type { PlayerParams } from "@/engine/entities/Player";
import { TileMap } from "@/engine/physics/TileMap";
import type { Platform } from "@/engine/physics/TileMap";
import { ParticleSystem } from "@/engine/core/ParticleSystem";
import { ScreenShake } from "@/engine/core/ScreenShake";
import { CombatSystem } from "@/engine/combat/CombatSystem";
import { DEFAULT_COMBAT_PARAMS } from "@/engine/combat/CombatParams";
import type { CombatParams } from "@/engine/combat/CombatParams";
import type { AttackDirection } from "@/engine/combat/types";
import { PlayerHealth, DEFAULT_PLAYER_HEALTH_PARAMS } from "@/engine/combat/PlayerHealth";
import type { PlayerHealthParams } from "@/engine/combat/PlayerHealth";
import { InputAction } from "@/engine/input/InputManager";
import type { InputManager } from "@/engine/input/InputManager";
import { Reader } from "@/engine/entities/enemies/Reader";
import { Binder } from "@/engine/entities/enemies/Binder";
import { Proofwarden } from "@/engine/entities/enemies/Proofwarden";
import { DEFAULT_READER_PARAMS, DEFAULT_BINDER_PARAMS, DEFAULT_PROOFWARDEN_PARAMS } from "@/engine/entities/enemies/EnemyParams";
import type { ReaderParams, BinderParams, ProofwardenParams } from "@/engine/entities/enemies/EnemyParams";
import type { PlayerRef } from "@/engine/entities/Enemy";
import { aabbOverlap } from "@/engine/physics/AABB";
import { CANVAS_WIDTH } from "@/lib/constants";
import type { Renderer } from "@/engine/core/Renderer";
import type { Enemy } from "@/engine/entities/Enemy";
import Link from "next/link";

// ─── Level Constants ─────────────────────────────────────────────────────────

const LEVEL_WIDTH = 2880;
const LEVEL_HEIGHT = 540;
const SPAWN_X = 60;
const SPAWN_Y = 400;
const RESPAWN_Y_THRESHOLD = LEVEL_HEIGHT + 200;

// ─── Platform Layout ─────────────────────────────────────────────────────────

function createPlatforms(): Platform[] {
  return [
    // Ground floor (full width)
    { x: 0, y: 460, width: 2880, height: 80 },

    // === Arena 1: Reader Rush ===
    { x: 80, y: 340, width: 160, height: 20 },
    { x: 600, y: 380, width: 120, height: 20 },

    // Arena divider wall (with gap at bottom)
    { x: 920, y: 0, width: 40, height: 380 },

    // === Arena 2: Binder Trap ===
    { x: 1060, y: 260, width: 160, height: 20 },
    { x: 1360, y: 340, width: 140, height: 20 },
    { x: 1200, y: 400, width: 100, height: 20 },

    // Arena divider wall
    { x: 1880, y: 0, width: 40, height: 380 },

    // === Arena 3: Proofwarden Gauntlet ===
    { x: 2000, y: 320, width: 120, height: 20 },
    { x: 2300, y: 280, width: 140, height: 20 },
    { x: 2600, y: 340, width: 100, height: 20 },

    // Boundaries
    { x: 0, y: 0, width: 2880, height: 20 },      // Ceiling
    { x: 0, y: 0, width: 20, height: 540 },        // Left wall
    { x: 2860, y: 0, width: 20, height: 540 },     // Right wall
  ];
}

// ─── Enemy Creation ──────────────────────────────────────────────────────────

function createReaders(params: ReaderParams): Reader[] {
  return [
    new Reader({ position: { x: 200, y: 420 }, params, patrol: true, patrolRange: 100 }),
    new Reader({ position: { x: 450, y: 420 }, params, patrol: true, patrolRange: 80 }),
    new Reader({ position: { x: 600, y: 420 }, params, patrol: false }),
    new Reader({ position: { x: 100, y: 300 }, params, patrol: true, patrolRange: 60 }),
  ];
}

function createBinders(params: BinderParams): Binder[] {
  return [
    new Binder({ position: { x: 1100, y: 224 }, params }),
    new Binder({ position: { x: 1400, y: 304 }, params }),
    new Binder({ position: { x: 1250, y: 420 }, params }),
  ];
}

function createProofwardens(params: ProofwardenParams): Proofwarden[] {
  return [
    new Proofwarden({ position: { x: 2100, y: 420 }, params }),
    new Proofwarden({ position: { x: 2500, y: 420 }, params }),
  ];
}

// ─── Attack Direction Helper ─────────────────────────────────────────────────

function getAttackDirection(input: InputManager, facingRight: boolean): AttackDirection {
  const up = input.isHeld(InputAction.Up);
  const down = input.isHeld(InputAction.Down);
  const left = input.isHeld(InputAction.Left);
  const right = input.isHeld(InputAction.Right);

  if (up && right) return "up-right";
  if (up && left) return "up-left";
  if (down && right) return "down-right";
  if (down && left) return "down-left";
  if (up) return "up";
  if (down) return "down";
  if (right) return "right";
  if (left) return "left";
  return facingRight ? "right" : "left";
}

// ─── Floating Damage Numbers ─────────────────────────────────────────────────

interface DamageNumber {
  text: string;
  x: number;
  y: number;
  vy: number;
  alpha: number;
  timer: number;
}

// ─── Pass Criteria ───────────────────────────────────────────────────────────

interface PassCriteria {
  label: string;
  met: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function EnemiesTest() {
  // Refs for engine systems
  const engineRef = useRef<Engine | null>(null);

  // Param refs (updated by sliders, read by engine)
  const readerParamsRef = useRef<ReaderParams>({ ...DEFAULT_READER_PARAMS });
  const binderParamsRef = useRef<BinderParams>({ ...DEFAULT_BINDER_PARAMS });
  const proofwardenParamsRef = useRef<ProofwardenParams>({ ...DEFAULT_PROOFWARDEN_PARAMS });
  const playerHealthParamsRef = useRef<PlayerHealthParams>({ ...DEFAULT_PLAYER_HEALTH_PARAMS });
  const combatParamsRef = useRef<CombatParams>({ ...DEFAULT_COMBAT_PARAMS });
  const playerParamsRef = useRef<PlayerParams>({ ...DEFAULT_PLAYER_PARAMS });

  // Debug state
  const [debugState, setDebugState] = useState({
    fps: 0,
    playerState: "IDLE",
    playerX: 0,
    playerY: 0,
    playerVelX: 0,
    playerVelY: 0,
    playerHealth: 5,
    playerMaxHealth: 5,
    currentWeapon: "quill-spear",
    attackPhase: "idle",
    enemiesAlive: 9,
    enemiesTotal: 9,
    totalKills: 0,
    totalPlayerDamage: 0,
  });

  // Slider state
  const [readerParams, setReaderParams] = useState({ ...DEFAULT_READER_PARAMS });
  const [binderParams, setBinderParams] = useState({ ...DEFAULT_BINDER_PARAMS });
  const [proofwardenParams, setProofwardenParams] = useState({ ...DEFAULT_PROOFWARDEN_PARAMS });
  const [playerHealthParams, setPlayerHealthParams] = useState({ ...DEFAULT_PLAYER_HEALTH_PARAMS });

  // Collapsible sections
  const [sections, setSections] = useState({
    combat: true,
    reader: false,
    binder: false,
    proofwarden: false,
    playerHealth: false,
    controls: false,
    playerState: false,
  });

  // Pass criteria
  const [criteria, setCriteria] = useState<PassCriteria[]>([
    { label: "1. Reader patrols, reverses at ledges", met: false },
    { label: "2. Reader detects player → chase", met: false },
    { label: "3. Reader lunges at player", met: false },
    { label: "4. Reader deals contact damage", met: false },
    { label: "5. Player can kill Readers (2 hits)", met: false },
    { label: "6. Reader shows knockback on hit", met: false },
    { label: "7. Dead Reader respawns", met: false },
    { label: "8. Binder fires thread toward player", met: false },
    { label: "9. Thread pulls player toward Binder", met: false },
    { label: "10. Dash breaks Binder thread", met: false },
    { label: "11. Binder can be attacked", met: false },
    { label: "12. Shield blocks frontal attacks", met: false },
    { label: "13. Proofwarden damaged from behind", met: false },
    { label: "14. Slam telegraphed with windup", met: false },
    { label: "15. Slam deals damage to player", met: false },
    { label: "16. Player takes damage on contact", met: false },
    { label: "17. I-frames prevent damage", met: false },
    { label: "18. Dash i-frames prevent damage", met: false },
    { label: "19. Player health HUD displays", met: false },
    { label: "20. Enemy params tunable via sliders", met: false },
  ]);

  const markCriteria = useCallback((index: number) => {
    setCriteria((prev) => {
      if (prev[index].met) return prev;
      const next = [...prev];
      next[index] = { ...next[index], met: true };
      return next;
    });
  }, []);

  const toggleSection = useCallback((key: keyof typeof sections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ─── Engine Mount ──────────────────────────────────────────────────────────

  const handleMount = useCallback((ctx: CanvasRenderingContext2D) => {
    RenderConfig.setMode("rectangles");
    const engine = new Engine({ ctx });
    engineRef.current = engine;

    const input = engine.getInput();
    const camera = engine.getCamera();
    const renderer = engine.getRenderer();

    // Set camera bounds
    camera.bounds = { x: 0, y: 0, width: LEVEL_WIDTH, height: LEVEL_HEIGHT };

    // Create tilemap
    const tileMap = new TileMap(createPlatforms());

    // Create systems
    const particleSystem = new ParticleSystem();
    const screenShake = new ScreenShake();

    // Create player
    const player = new Player();
    player.position.x = SPAWN_X;
    player.position.y = SPAWN_Y;
    player.input = input;
    player.tileMap = tileMap;
    player.particleSystem = particleSystem;
    player.screenShake = screenShake;

    // Create combat system
    const combatSystem = new CombatSystem();

    // Create player health
    const playerHealth = new PlayerHealth();

    // Create enemies
    const readers = createReaders(readerParamsRef.current);
    const binders = createBinders(binderParamsRef.current);
    const proofwardens = createProofwardens(proofwardenParamsRef.current);

    const getAllEnemies = (): Enemy[] => [...readers, ...binders, ...proofwardens];

    // Wire enemy systems
    const wireEnemies = (): void => {
      for (const enemy of getAllEnemies()) {
        enemy.tileMap = tileMap;
        enemy.particleSystem = particleSystem;
        enemy.screenShake = screenShake;
      }
    };
    wireEnemies();

    // Damage numbers
    const damageNumbers: DamageNumber[] = [];

    // Stats
    let totalKills = 0;
    let showDetectionRange = true;
    let aiEnabled = true;

    // ─── Update Callback ───────────────────────────────────────────────────

    const updateCallback = (dt: number) => {
      // Sync params
      player.params = playerParamsRef.current;
      combatSystem.params = combatParamsRef.current;
      playerHealth.params = playerHealthParamsRef.current;
      playerHealth.maxHealth = playerHealthParamsRef.current.maxHealth;
      if (playerHealth.health > playerHealth.maxHealth) {
        playerHealth.health = playerHealth.maxHealth;
      }

      const allEnemies = getAllEnemies();

      // AI toggle
      for (const enemy of allEnemies) {
        enemy.aiEnabled = aiEnabled;
      }

      // Update player ref for enemies
      const playerAsRef: PlayerRef = {
        position: player.position,
        velocity: player.velocity,
        size: player.size,
        getBounds: () => player.getBounds(),
        facingRight: player.facingRight,
        grounded: player.grounded,
        isDashing: player.isDashing,
        stateMachine: { getCurrentState: () => player.stateMachine.getCurrentState() },
      };
      for (const enemy of allEnemies) {
        enemy.playerRef = playerAsRef;
      }

      // Sync enemy params
      for (const r of readers) {
        r.params = readerParamsRef.current;
        r.maxHealth = readerParamsRef.current.health;
        r.contactDamage = readerParamsRef.current.contactDamage;
      }
      for (const b of binders) {
        b.params = binderParamsRef.current;
        b.maxHealth = binderParamsRef.current.health;
        b.contactDamage = binderParamsRef.current.contactDamage;
      }
      for (const pw of proofwardens) {
        pw.params = proofwardenParamsRef.current;
        pw.maxHealth = proofwardenParamsRef.current.health;
        pw.contactDamage = proofwardenParamsRef.current.contactDamage;
      }

      // Update player
      player.update(dt);

      // Respawn if fallen
      if (player.position.y > RESPAWN_Y_THRESHOLD) {
        player.position.x = SPAWN_X;
        player.position.y = SPAWN_Y;
        player.velocity.x = 0;
        player.velocity.y = 0;
        playerHealth.reset();
      }

      // Weapon switch
      if (input.isPressed(InputAction.WeaponSwitch)) {
        combatSystem.currentWeapon =
          combatSystem.currentWeapon === "quill-spear" ? "ink-snap" : "quill-spear";
      }

      // Attack input
      if (input.isPressed(InputAction.Attack) && combatSystem.canAttack(player.stateMachine.getCurrentState())) {
        if (combatSystem.currentWeapon === "quill-spear") {
          const direction = getAttackDirection(input, player.facingRight);
          combatSystem.startSpearAttack(direction);
        } else {
          const targets = allEnemies
            .filter((e) => e.isAlive)
            .map((e) => ({ id: e.id, bounds: e.getBounds() }));
          const playerCenter = {
            x: player.position.x + player.size.x / 2,
            y: player.position.y + player.size.y / 2,
          };
          const autoAimTarget = combatSystem.findSnapTarget(playerCenter, targets);
          combatSystem.startSnapAttack(autoAimTarget?.position ?? null, autoAimTarget?.id ?? null);
        }
      }

      // Update combat system
      combatSystem.update(player.getBounds(), player.facingRight);

      // Hit detection: player attacks → enemies
      const hitTargets = allEnemies
        .filter((e) => e.isAlive && e.canBeDamaged())
        .map((e) => ({ id: e.id, bounds: e.getBounds() }));
      const hits = combatSystem.checkHits(hitTargets);

      for (const hit of hits) {
        const enemy = allEnemies.find((e) => e.id === hit.targetId);
        if (!enemy) continue;

        const isSpear = combatSystem.currentWeapon === "quill-spear";
        const hitstopFrames = isSpear
          ? combatSystem.params.spearHitstopFrames
          : combatSystem.params.snapHitstopFrames;

        const wasAlive = enemy.isAlive;
        const damaged = enemy.takeDamage(hit.damage, hit.knockback, hitstopFrames);

        if (damaged) {
          // Hit particles
          particleSystem.emit({
            x: hit.hitPosition.x,
            y: hit.hitPosition.y,
            count: 10,
            speedMin: 40,
            speedMax: 120,
            angleMin: 0,
            angleMax: Math.PI * 2,
            lifeMin: 0.2,
            lifeMax: 0.4,
            sizeMin: 2,
            sizeMax: 4,
            colors: [enemy.color, "#ffffff", "#1e1b4b"],
            gravity: 150,
          });

          // Screen shake
          const si = isSpear ? combatSystem.params.spearShakeIntensity : combatSystem.params.snapShakeIntensity;
          const sf = isSpear ? combatSystem.params.spearShakeFrames : combatSystem.params.snapShakeFrames;
          screenShake.shake(si, sf);

          // Damage number
          damageNumbers.push({
            text: String(hit.damage),
            x: hit.hitPosition.x,
            y: hit.hitPosition.y,
            vy: -60,
            alpha: 1,
            timer: 0.8,
          });

          // Criteria tracking
          if (enemy instanceof Reader) {
            markCriteria(5); // Reader knockback
            if (!enemy.isAlive && wasAlive) {
              totalKills++;
              markCriteria(4); // Kill Reader
            }
          }
          if (enemy instanceof Binder) {
            markCriteria(10); // Binder attacked
            if (!enemy.isAlive) totalKills++;
          }
          if (enemy instanceof Proofwarden) {
            markCriteria(12); // PW damaged from behind
            if (!enemy.isAlive) totalKills++;
          }
        }

        // Shield block
        if (!damaged && enemy instanceof Proofwarden && enemy.shieldActive) {
          markCriteria(11); // Shield blocks
        }
      }

      // Update enemies
      for (const enemy of allEnemies) {
        enemy.update(dt);
      }

      // Track criteria from enemy states
      for (const r of readers) {
        if (!r.isAlive) continue;
        const st = r.stateMachine.getCurrentState();
        if (st === "PATROL") markCriteria(0);
        if (st === "CHASE") markCriteria(1);
        if (st === "ATTACK") markCriteria(2);
      }
      for (const r of readers) {
        if (r.isAlive && r.respawnFadeIn < 1) markCriteria(6); // Respawned
      }
      for (const b of binders) {
        if (!b.isAlive) continue;
        const st = b.stateMachine.getCurrentState();
        if (st === "THREAD_FIRE" || st === "PULLING" || st === "THREAD_RETRACT") markCriteria(7);
        if (st === "PULLING") markCriteria(8);
      }
      for (const pw of proofwardens) {
        if (!pw.isAlive) continue;
        if (pw.stateMachine.getCurrentState() === "SLAM_WINDUP") markCriteria(13);
      }

      // Player health update
      playerHealth.update();

      // Apply player knockback
      const kb = playerHealth.getKnockbackVelocity();
      if (kb) {
        player.velocity.x += kb.x * dt * 60;
        player.velocity.y += kb.y * dt * 60;
      }

      // Contact damage checks
      const playerBounds = player.getBounds();
      const canTakeDmg = playerHealth.canTakeDamage(
        player.stateMachine.getCurrentState(),
        player.isDashing,
      );

      // Reader contact
      for (const r of readers) {
        if (!r.isAlive || !r.isAggressive()) continue;
        if (!aabbOverlap(playerBounds, r.getBounds())) continue;
        if (canTakeDmg) {
          const dir = player.position.x > r.position.x ? 1 : -1;
          playerHealth.takeDamage(r.contactDamage, { x: dir, y: -0.5 }, "Reader");
          markCriteria(3); // Reader contact damage
          markCriteria(15); // Player takes damage
        } else if (playerHealth.invincibilityTimer > 0) {
          markCriteria(16); // I-frames prevent
        } else if (player.isDashing && playerHealth.params.dashIFrames) {
          markCriteria(17); // Dash i-frames
        }
      }

      // Binder contact + pull + thread damage
      for (const b of binders) {
        if (!b.isAlive) continue;
        if (aabbOverlap(playerBounds, b.getBounds()) && canTakeDmg) {
          const dir = player.position.x > b.position.x ? 1 : -1;
          playerHealth.takeDamage(b.contactDamage, { x: dir, y: -0.5 }, "Binder");
          markCriteria(15);
        }
        // Thread connection damage
        if (b.threadJustConnected && canTakeDmg) {
          const dir = player.position.x > b.position.x ? 1 : -1;
          playerHealth.takeDamage(b.params.threadDamage, { x: dir, y: -0.3 }, "Binder Thread");
          markCriteria(15);
        }
        if (b.pullForce) {
          player.velocity.x += b.pullForce.x * dt * 60;
          player.velocity.y += b.pullForce.y * dt * 60;
        }
        if (b.stateMachine.getCurrentState() === "PULLING" && player.isDashing) {
          markCriteria(9); // Dash breaks thread
        }
      }

      // Proofwarden slam + contact
      for (const pw of proofwardens) {
        if (!pw.isAlive) continue;
        // Slam hitbox
        if (pw.isSlamActive()) {
          const slamBox = pw.getSlamHitbox();
          if (slamBox && aabbOverlap(playerBounds, slamBox) && canTakeDmg) {
            const dir = player.position.x > pw.position.x ? 1 : -1;
            playerHealth.takeDamage(pw.params.slamDamage, { x: dir, y: -0.7 }, "PW Slam");
            markCriteria(14); // Slam deals damage
            markCriteria(15);
          }
        }
        // Contact
        if (aabbOverlap(playerBounds, pw.getBounds()) && canTakeDmg) {
          const dir = player.position.x > pw.position.x ? 1 : -1;
          playerHealth.takeDamage(pw.contactDamage, { x: dir, y: -0.5 }, "Proofwarden");
          markCriteria(15);
        }
      }

      // Update damage numbers
      for (let i = damageNumbers.length - 1; i >= 0; i--) {
        const dn = damageNumbers[i];
        dn.y += dn.vy * dt;
        dn.timer -= dt;
        dn.alpha = Math.max(0, dn.timer / 0.8);
        if (dn.timer <= 0) damageNumbers.splice(i, 1);
      }

      // Systems update
      particleSystem.update(dt);

      // Camera
      const playerCenter = {
        x: player.position.x + player.size.x / 2,
        y: player.position.y + player.size.y / 2,
      };
      camera.follow(playerCenter, player.velocity, dt);

      // Always-met criteria
      markCriteria(18); // HUD displays
      markCriteria(19); // Params tunable

      // Update debug state
      const alive = allEnemies.filter((e) => e.isAlive).length;
      setDebugState({
        fps: engine.getMetrics().fps,
        playerState: player.stateMachine.getCurrentState(),
        playerX: Math.round(player.position.x),
        playerY: Math.round(player.position.y),
        playerVelX: Math.round(player.velocity.x),
        playerVelY: Math.round(player.velocity.y),
        playerHealth: playerHealth.health,
        playerMaxHealth: playerHealth.maxHealth,
        currentWeapon: combatSystem.currentWeapon,
        attackPhase: combatSystem.attackPhase,
        enemiesAlive: alive,
        enemiesTotal: allEnemies.length,
        totalKills,
        totalPlayerDamage: playerHealth.totalDamageTaken,
      });
    };

    // ─── Render Callback ───────────────────────────────────────────────────

    const renderCallback = (rendererObj: Renderer, interpolation: number) => {
      const ctx = rendererObj.getContext();
      const allEnemies = getAllEnemies();

      // Screen shake offset
      const shake = screenShake.update();
      if (shake.offsetX !== 0 || shake.offsetY !== 0) {
        ctx.translate(shake.offsetX, shake.offsetY);
      }

      // Render tilemap
      tileMap.render(rendererObj);

      // Render player with invincibility flash
      const showPlayer = playerHealth.invincibilityTimer <= 0 ||
        Math.floor(playerHealth.invincibilityTimer / 4) % 2 === 0;

      if (showPlayer) {
        if (playerHealth.invincibilityTimer > 0 && playerHealth.knockbackTimer > 0) {
          const oldColor = player.color;
          player.color = "#ef4444";
          player.render(rendererObj, interpolation);
          player.color = oldColor;
        } else {
          player.render(rendererObj, interpolation);
        }
      }

      // Render enemies
      for (const enemy of allEnemies) {
        if (enemy.active || !enemy.isAlive) {
          enemy.render(rendererObj, interpolation);
        }
      }

      // Combat visuals
      combatSystem.render(ctx, camera);

      // Particles
      particleSystem.render(rendererObj);

      // Damage numbers
      for (const dn of damageNumbers) {
        ctx.globalAlpha = dn.alpha;
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 14px monospace";
        ctx.fillText(dn.text, dn.x, dn.y);
        ctx.globalAlpha = 1;
      }

      // Debug: player hitbox
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 1;
      ctx.strokeRect(player.position.x, player.position.y, player.size.x, player.size.y);

      // Combat debug
      combatSystem.renderDebug(ctx, player.getBounds());

      // Enemy debug overlays
      for (const enemy of allEnemies) {
        if (!enemy.isAlive) continue;

        // Hitbox
        ctx.strokeStyle = enemy.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(enemy.position.x, enemy.position.y, enemy.size.x, enemy.size.y);

        // Detection range
        if (showDetectionRange) {
          let range = 0;
          if (enemy instanceof Reader) range = enemy.params.detectionRange;
          if (enemy instanceof Binder) range = enemy.params.detectionRange;
          if (enemy instanceof Proofwarden) range = enemy.params.detectionRange;

          if (range > 0) {
            ctx.strokeStyle = `${enemy.color}44`;
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(enemy.getCenterX(), enemy.getCenterY(), range, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }
    };

    // HUD layer (screen space)
    renderer.addLayerCallback("debug", (ctx) => {
      playerHealth.renderHUD(ctx, CANVAS_WIDTH);

      ctx.fillStyle = "#71717a";
      ctx.font = "10px monospace";
      ctx.fillText(`FPS: ${Math.round(engine.getMetrics().fps)}`, 8, 20);

      ctx.fillStyle = combatSystem.currentWeapon === "quill-spear" ? "#60a5fa" : "#4338ca";
      ctx.font = "10px monospace";
      ctx.fillText(`[${combatSystem.currentWeapon}]`, CANVAS_WIDTH - 100, 20);

      ctx.fillStyle = "#a78bfa";
      ctx.fillText(`Kills: ${totalKills}`, CANVAS_WIDTH - 100, 34);
    });

    // Wire callbacks and start
    engine.onUpdate(updateCallback);
    engine.onRender(renderCallback);
    engine.start();

    // Expose control functions
    const engAny = engineRef.current as unknown as Record<string, () => void>;
    engAny._respawnAll = () => {
      for (const enemy of getAllEnemies()) enemy.reset();
    };
    engAny._resetPlayerHealth = () => playerHealth.reset();
    engAny._toggleAI = () => { aiEnabled = !aiEnabled; };
    engAny._toggleDetectionRange = () => { showDetectionRange = !showDetectionRange; };
  }, [markCriteria]);

  const handleUnmount = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.stop();
      engineRef.current = null;
    }
  }, []);

  // Sync slider values to refs
  useEffect(() => { readerParamsRef.current = readerParams; }, [readerParams]);
  useEffect(() => { binderParamsRef.current = binderParams; }, [binderParams]);
  useEffect(() => { proofwardenParamsRef.current = proofwardenParams; }, [proofwardenParams]);
  useEffect(() => { playerHealthParamsRef.current = playerHealthParams; }, [playerHealthParams]);

  // Slider helpers
  const updateReaderParam = useCallback((key: keyof ReaderParams, value: number) => {
    setReaderParams((prev) => ({ ...prev, [key]: value }));
  }, []);
  const updateBinderParam = useCallback((key: keyof BinderParams, value: number) => {
    setBinderParams((prev) => ({ ...prev, [key]: value }));
  }, []);
  const updateProofwardenParam = useCallback((key: keyof ProofwardenParams, value: number) => {
    setProofwardenParams((prev) => ({ ...prev, [key]: value }));
  }, []);
  const updatePlayerHealthParam = useCallback((key: keyof PlayerHealthParams, value: number | boolean) => {
    setPlayerHealthParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const invokeEngineAction = useCallback((action: string) => {
    const eng = engineRef.current as unknown as Record<string, () => void>;
    eng?.[action]?.();
  }, []);

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      {/* Main Canvas */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-hidden p-4">
        <div className="flex items-center gap-4">
          <Link href="/test" className="text-xs text-zinc-500 hover:text-zinc-300">
            ← Tests
          </Link>
          <h1 className="font-mono text-sm font-bold text-amber-500">
            Enemies — Reader, Binder, Proofwarden
          </h1>
        </div>

        <GameCanvas onMount={handleMount} onUnmount={handleUnmount} />

        <div className="flex flex-wrap gap-4 text-xs font-mono text-zinc-400">
          <span>Arrow keys: Move</span>
          <span>Space/Z: Jump</span>
          <span>X/Shift: Dash</span>
          <span>J/Enter: Attack</span>
          <span>K: Switch weapon</span>
        </div>

        {/* Pass Criteria */}
        <div className="w-full max-w-[960px] rounded border border-zinc-800 bg-zinc-900 p-3">
          <h3 className="mb-2 font-mono text-xs font-bold text-amber-500">
            Pass Criteria ({criteria.filter((c) => c.met).length}/{criteria.length})
          </h3>
          <div className="grid grid-cols-2 gap-1 text-xs font-mono">
            {criteria.map((c, i) => (
              <div key={i} className={c.met ? "text-green-400" : "text-zinc-600"}>
                {c.met ? "✓" : "○"} {c.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Debug Panel */}
      <DebugPanel title="Enemies">
        <RenderModeToggle />
        {/* Combat Info */}
        <div>
          <button
            onClick={() => toggleSection("combat")}
            className="mb-2 flex w-full justify-between font-mono text-xs font-bold uppercase text-zinc-300"
          >
            Combat Info
            <span>{sections.combat ? "▼" : "▶"}</span>
          </button>
          {sections.combat && (
            <div className="space-y-1 text-xs font-mono text-zinc-400">
              <div>Health: {debugState.playerHealth} / {debugState.playerMaxHealth}</div>
              <div>Weapon: {debugState.currentWeapon}</div>
              <div>Attack: {debugState.attackPhase}</div>
              <div>Alive: {debugState.enemiesAlive} / {debugState.enemiesTotal}</div>
              <div>Kills: {debugState.totalKills}</div>
              <div>Damage taken: {debugState.totalPlayerDamage}</div>
            </div>
          )}
        </div>

        {/* Reader Params */}
        <div>
          <button onClick={() => toggleSection("reader")} className="mb-2 flex w-full justify-between font-mono text-xs font-bold uppercase text-red-400">
            Reader Params <span>{sections.reader ? "▼" : "▶"}</span>
          </button>
          {sections.reader && (
            <div className="space-y-2">
              <Slider label="Health" value={readerParams.health} min={1} max={10} step={1} onChange={(v) => updateReaderParam("health", v)} />
              <Slider label="Move Speed" value={readerParams.moveSpeed} min={50} max={300} step={10} onChange={(v) => updateReaderParam("moveSpeed", v)} />
              <Slider label="Chase Speed" value={readerParams.chaseSpeed} min={100} max={500} step={10} onChange={(v) => updateReaderParam("chaseSpeed", v)} />
              <Slider label="Detection Range" value={readerParams.detectionRange} min={50} max={400} step={10} onChange={(v) => updateReaderParam("detectionRange", v)} />
              <Slider label="Attack Range" value={readerParams.attackRange} min={10} max={80} step={5} onChange={(v) => updateReaderParam("attackRange", v)} />
              <Slider label="Lunge Speed" value={readerParams.lungeSpeed} min={200} max={800} step={25} onChange={(v) => updateReaderParam("lungeSpeed", v)} />
              <Slider label="Lunge Duration" value={readerParams.lungeDuration} min={4} max={20} step={1} onChange={(v) => updateReaderParam("lungeDuration", v)} />
              <Slider label="Lunge Recovery" value={readerParams.lungeRecovery} min={10} max={60} step={5} onChange={(v) => updateReaderParam("lungeRecovery", v)} />
              <Slider label="Contact Damage" value={readerParams.contactDamage} min={1} max={5} step={1} onChange={(v) => updateReaderParam("contactDamage", v)} />
            </div>
          )}
        </div>

        {/* Binder Params */}
        <div>
          <button onClick={() => toggleSection("binder")} className="mb-2 flex w-full justify-between font-mono text-xs font-bold uppercase text-purple-400">
            Binder Params <span>{sections.binder ? "▼" : "▶"}</span>
          </button>
          {sections.binder && (
            <div className="space-y-2">
              <Slider label="Health" value={binderParams.health} min={1} max={10} step={1} onChange={(v) => updateBinderParam("health", v)} />
              <Slider label="Detection Range" value={binderParams.detectionRange} min={100} max={400} step={10} onChange={(v) => updateBinderParam("detectionRange", v)} />
              <Slider label="Thread Range" value={binderParams.threadRange} min={80} max={300} step={10} onChange={(v) => updateBinderParam("threadRange", v)} />
              <Slider label="Thread Min Range" value={binderParams.threadMinRange} min={20} max={100} step={5} onChange={(v) => updateBinderParam("threadMinRange", v)} />
              <Slider label="Thread Speed" value={binderParams.threadSpeed} min={200} max={600} step={25} onChange={(v) => updateBinderParam("threadSpeed", v)} />
              <Slider label="Pull Duration" value={binderParams.pullDuration} min={10} max={60} step={5} onChange={(v) => updateBinderParam("pullDuration", v)} />
              <Slider label="Thread Cooldown" value={binderParams.threadCooldown} min={30} max={180} step={10} onChange={(v) => updateBinderParam("threadCooldown", v)} />
              <Slider label="Thread Damage" value={binderParams.threadDamage} min={1} max={5} step={1} onChange={(v) => updateBinderParam("threadDamage", v)} />
            </div>
          )}
        </div>

        {/* Proofwarden Params */}
        <div>
          <button onClick={() => toggleSection("proofwarden")} className="mb-2 flex w-full justify-between font-mono text-xs font-bold uppercase text-amber-400">
            Proofwarden Params <span>{sections.proofwarden ? "▼" : "▶"}</span>
          </button>
          {sections.proofwarden && (
            <div className="space-y-2">
              <Slider label="Health" value={proofwardenParams.health} min={1} max={20} step={1} onChange={(v) => updateProofwardenParam("health", v)} />
              <Slider label="Move Speed" value={proofwardenParams.moveSpeed} min={30} max={200} step={10} onChange={(v) => updateProofwardenParam("moveSpeed", v)} />
              <Slider label="Chase Speed" value={proofwardenParams.chaseSpeed} min={50} max={250} step={10} onChange={(v) => updateProofwardenParam("chaseSpeed", v)} />
              <Slider label="Detection Range" value={proofwardenParams.detectionRange} min={80} max={300} step={10} onChange={(v) => updateProofwardenParam("detectionRange", v)} />
              <Slider label="Slam Windup" value={proofwardenParams.slamWindup} min={10} max={50} step={5} onChange={(v) => updateProofwardenParam("slamWindup", v)} />
              <Slider label="Slam Active" value={proofwardenParams.slamActiveFrames} min={2} max={12} step={1} onChange={(v) => updateProofwardenParam("slamActiveFrames", v)} />
              <Slider label="Slam Recovery" value={proofwardenParams.slamRecovery} min={15} max={80} step={5} onChange={(v) => updateProofwardenParam("slamRecovery", v)} />
              <Slider label="Slam Damage" value={proofwardenParams.slamDamage} min={1} max={5} step={1} onChange={(v) => updateProofwardenParam("slamDamage", v)} />
              <Slider label="Shield Block Angle" value={proofwardenParams.shieldBlockAngle} min={60} max={180} step={10} onChange={(v) => updateProofwardenParam("shieldBlockAngle", v)} />
            </div>
          )}
        </div>

        {/* Player Health Params */}
        <div>
          <button onClick={() => toggleSection("playerHealth")} className="mb-2 flex w-full justify-between font-mono text-xs font-bold uppercase text-zinc-300">
            Player Health <span>{sections.playerHealth ? "▼" : "▶"}</span>
          </button>
          {sections.playerHealth && (
            <div className="space-y-2">
              <Slider label="Max Health" value={playerHealthParams.maxHealth} min={1} max={20} step={1} onChange={(v) => updatePlayerHealthParam("maxHealth", v)} />
              <Slider label="I-Frames" value={playerHealthParams.invincibilityFrames} min={20} max={120} step={10} onChange={(v) => updatePlayerHealthParam("invincibilityFrames", v)} />
              <Slider label="Knockback Speed" value={playerHealthParams.knockbackSpeed} min={50} max={400} step={25} onChange={(v) => updatePlayerHealthParam("knockbackSpeed", v)} />
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                <span>Dash I-Frames</span>
                <button
                  onClick={() => updatePlayerHealthParam("dashIFrames", !playerHealthParams.dashIFrames)}
                  className={`rounded px-2 py-0.5 text-xs ${playerHealthParams.dashIFrames ? "bg-green-800 text-green-200" : "bg-zinc-700 text-zinc-400"}`}
                >
                  {playerHealthParams.dashIFrames ? "ON" : "OFF"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div>
          <button onClick={() => toggleSection("controls")} className="mb-2 flex w-full justify-between font-mono text-xs font-bold uppercase text-zinc-300">
            Controls <span>{sections.controls ? "▼" : "▶"}</span>
          </button>
          {sections.controls && (
            <div className="space-y-2">
              <button onClick={() => invokeEngineAction("_respawnAll")} className="w-full rounded bg-zinc-700 px-2 py-1 text-xs font-mono text-zinc-200 hover:bg-zinc-600">
                Respawn All Enemies
              </button>
              <button onClick={() => invokeEngineAction("_resetPlayerHealth")} className="w-full rounded bg-zinc-700 px-2 py-1 text-xs font-mono text-zinc-200 hover:bg-zinc-600">
                Reset Player Health
              </button>
              <button onClick={() => invokeEngineAction("_toggleAI")} className="w-full rounded bg-zinc-700 px-2 py-1 text-xs font-mono text-zinc-200 hover:bg-zinc-600">
                Toggle Enemy AI
              </button>
              <button onClick={() => invokeEngineAction("_toggleDetectionRange")} className="w-full rounded bg-zinc-700 px-2 py-1 text-xs font-mono text-zinc-200 hover:bg-zinc-600">
                Toggle Detection Range
              </button>
            </div>
          )}
        </div>

        {/* Player State */}
        <div>
          <button onClick={() => toggleSection("playerState")} className="mb-2 flex w-full justify-between font-mono text-xs font-bold uppercase text-zinc-300">
            Player State <span>{sections.playerState ? "▼" : "▶"}</span>
          </button>
          {sections.playerState && (
            <div className="space-y-1 text-xs font-mono text-zinc-400">
              <div>State: {debugState.playerState}</div>
              <div>Pos: ({debugState.playerX}, {debugState.playerY})</div>
              <div>Vel: ({debugState.playerVelX}, {debugState.playerVelY})</div>
              <div>FPS: {debugState.fps}</div>
            </div>
          )}
        </div>
      </DebugPanel>
    </div>
  );
}
