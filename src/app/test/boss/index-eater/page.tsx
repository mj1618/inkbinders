"use client";

import { useRef, useState, useCallback } from "react";
import { GameCanvas } from "@/components/canvas/GameCanvas";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { Slider } from "@/components/debug/Slider";
import { Engine } from "@/engine/core/Engine";
import { Player, DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";
import { TileMap } from "@/engine/physics/TileMap";
import type { Platform } from "@/engine/physics/TileMap";
import { ParticleSystem } from "@/engine/core/ParticleSystem";
import { ScreenShake } from "@/engine/core/ScreenShake";
import { InputAction } from "@/engine/input/InputManager";
import type { InputManager } from "@/engine/input/InputManager";
import { CombatSystem } from "@/engine/combat/CombatSystem";
import { DEFAULT_COMBAT_PARAMS } from "@/engine/combat/CombatParams";
import { PlayerHealth } from "@/engine/combat/PlayerHealth";
import { IndexEater } from "@/engine/entities/bosses/IndexEater";
import {
  DEFAULT_INDEX_EATER_PARAMS,
  type IndexEaterParams,
} from "@/engine/entities/bosses/IndexEaterParams";
import type { AttackDirection, WeaponType } from "@/engine/combat/types";
import { aabbOverlap } from "@/engine/physics/AABB";
import { COLORS } from "@/lib/constants";
import type { Vec2 } from "@/lib/types";
import Link from "next/link";

// ─── Arena Constants ───────────────────────────────────────────────

const CANVAS_W = 960;
const CANVAS_H = 540;
const ARENA_WIDTH = 1440;
const ARENA_HEIGHT = 640;
const GROUND_Y = 560;
const PLAYER_SPAWN: Vec2 = { x: 200, y: 520 };
const BOSS_SPAWN: Vec2 = { x: 1100, y: GROUND_Y - 80 };

// ─── Platform Definitions ──────────────────────────────────────────

const FLOOR_SECTIONS: Platform[] = [
  { x: 20, y: GROUND_Y, width: 200, height: 80 },
  { x: 260, y: GROUND_Y, width: 200, height: 80 },
  { x: 500, y: GROUND_Y, width: 200, height: 80 },
  { x: 740, y: GROUND_Y, width: 200, height: 80 },
  { x: 980, y: GROUND_Y, width: 200, height: 80 },
  { x: 1220, y: GROUND_Y, width: 200, height: 80 },
];

const MID_PLATFORMS: Platform[] = [
  { x: 120, y: 400, width: 160, height: 20 },
  { x: 400, y: 340, width: 200, height: 20 },
  { x: 840, y: 340, width: 200, height: 20 },
  { x: 1160, y: 400, width: 160, height: 20 },
];

const HIGH_PLATFORMS: Platform[] = [
  { x: 200, y: 200, width: 140, height: 20 },
  { x: 650, y: 180, width: 140, height: 20 },
  { x: 1100, y: 200, width: 140, height: 20 },
];

const WALLS: Platform[] = [
  { x: 0, y: 0, width: 20, height: 640 },
  { x: 1420, y: 0, width: 20, height: 640 },
  { x: 0, y: 0, width: 1440, height: 20 },
];

// ─── Floating Damage Number ────────────────────────────────────────

interface FloatingNumber {
  text: string;
  x: number;
  y: number;
  vy: number;
  alpha: number;
  timer: number;
  maxTimer: number;
  color: string;
}

const FLOAT_DURATION = 0.8;
const FLOAT_SPEED = -60;

// ─── Attack Direction Helper ───────────────────────────────────────

function getAttackDirection(
  input: InputManager,
  facingRight: boolean,
): AttackDirection {
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

// ─── Overlay Ref Interface ─────────────────────────────────────────

interface EngineWithRefs extends Engine {
  __showOverlaysRef?: { current: boolean };
}

// ─── Component ─────────────────────────────────────────────────────

export default function IndexEaterTest() {
  const engineRef = useRef<Engine | null>(null);
  const playerRef = useRef<Player | null>(null);
  const combatRef = useRef<CombatSystem | null>(null);
  const bossRef = useRef<IndexEater | null>(null);
  const playerHealthRef = useRef<PlayerHealth | null>(null);
  const tileMapRef = useRef<TileMap | null>(null);
  const floatingNumbersRef = useRef<FloatingNumber[]>([]);
  const elapsedRef = useRef(0);
  const invincibleRef = useRef(false);
  const floodDamageAccRef = useRef(0);

  const [showOverlays, setShowOverlays] = useState(true);
  const [bossParams, setBossParams] = useState<IndexEaterParams>({
    ...DEFAULT_INDEX_EATER_PARAMS,
  });
  const [playerInvincible, setPlayerInvincible] = useState(false);
  const [bossAiEnabled, setBossAiEnabled] = useState(true);
  const [fightStarted, setFightStarted] = useState(false);
  const fightStartedRef = useRef(false);

  // ─── Boss Param Updater ──────────────────────────────────────

  const updateBossParam = useCallback(
    <K extends keyof IndexEaterParams>(
      key: K,
      value: IndexEaterParams[K],
    ) => {
      setBossParams((prev) => {
        const next = { ...prev, [key]: value };
        const boss = bossRef.current;
        if (boss) {
          boss.params[key] = value;
          if (key === "maxHealth") {
            boss.maxHealth = value as number;
          }
        }
        return next;
      });
    },
    [],
  );

  // ─── Actions ─────────────────────────────────────────────────

  const startFight = useCallback(() => {
    const boss = bossRef.current;
    if (boss) {
      boss.aiEnabled = true;
      fightStartedRef.current = true;
      setFightStarted(true);
    }
  }, []);

  const restartFight = useCallback(() => {
    const boss = bossRef.current;
    const player = playerRef.current;
    const playerHealth = playerHealthRef.current;
    const combat = combatRef.current;

    if (boss) boss.reset(BOSS_SPAWN);
    if (playerHealth) playerHealth.reset();
    if (combat) combat.reset();
    if (player) {
      player.position.x = PLAYER_SPAWN.x;
      player.position.y = PLAYER_SPAWN.y;
      player.velocity.x = 0;
      player.velocity.y = 0;
      player.size.y = player.params.playerHeight;
      player.grounded = false;
      player.coyoteTimer = 0;
      player.jumpHeld = false;
      player.dashAvailable = true;
      player.isDashing = false;
      player.isInDashWindup = false;
    }
    elapsedRef.current = 0;
    floodDamageAccRef.current = 0;
    floatingNumbersRef.current.length = 0;
    fightStartedRef.current = false;
    setFightStarted(false);
  }, []);

  const skipToPhase = useCallback((phase: 2 | 3) => {
    const boss = bossRef.current;
    if (boss) {
      boss.skipToPhase(phase);
      if (!fightStartedRef.current) {
        boss.aiEnabled = true;
        fightStartedRef.current = true;
        setFightStarted(true);
      }
    }
  }, []);

  const restoreAllPlatforms = useCallback(() => {
    const boss = bossRef.current;
    if (boss) {
      for (const dp of boss.destructiblePlatforms) {
        dp.destroyed = false;
        dp.cracking = false;
        dp.crackProgress = 0;
      }
      boss.destroyedCount = 0;
      boss.onPlatformDestroyed?.();
    }
  }, []);

  const toggleInvincible = useCallback(() => {
    setPlayerInvincible((prev) => {
      const next = !prev;
      invincibleRef.current = next;
      return next;
    });
  }, []);

  const toggleBossAi = useCallback(() => {
    setBossAiEnabled((prev) => {
      const next = !prev;
      const boss = bossRef.current;
      if (boss) boss.aiEnabled = next;
      return next;
    });
  }, []);

  // ─── Engine Mount ────────────────────────────────────────────

  const handleMount = useCallback((ctx: CanvasRenderingContext2D) => {
    const engine = new Engine({ ctx, width: CANVAS_W, height: CANVAS_H });
    const camera = engine.getCamera();
    const input = engine.getInput();

    // Camera bounds for 1440×640 arena on 960×540 canvas
    camera.bounds = { x: 0, y: 0, width: ARENA_WIDTH, height: ARENA_HEIGHT };

    // Build initial tileMap
    const allPlatforms = [...FLOOR_SECTIONS, ...MID_PLATFORMS, ...HIGH_PLATFORMS, ...WALLS];
    let tileMap = new TileMap(allPlatforms);
    tileMapRef.current = tileMap;

    // Player
    const player = new Player();
    player.position.x = PLAYER_SPAWN.x;
    player.position.y = PLAYER_SPAWN.y;
    player.input = input;
    player.tileMap = tileMap;

    // Systems
    const particleSystem = new ParticleSystem();
    const screenShake = new ScreenShake();
    player.particleSystem = particleSystem;
    player.screenShake = screenShake;

    engine.getEntities().add(player);

    // Combat
    const combat = new CombatSystem();

    // Player health
    const playerHealth = new PlayerHealth();

    // Boss
    const boss = new IndexEater(BOSS_SPAWN);
    boss.particleSystem = particleSystem;
    boss.screenShake = screenShake;
    boss.camera = camera;
    boss.aiEnabled = false;

    // Initialize destructible platforms
    boss.initDestructiblePlatforms(FLOOR_SECTIONS, MID_PLATFORMS, HIGH_PLATFORMS);

    // Platform destruction callback — rebuild tileMap
    boss.onPlatformDestroyed = () => {
      const activePlatforms = boss.getActivePlatforms();
      tileMap = new TileMap([...activePlatforms, ...WALLS]);
      tileMapRef.current = tileMap;
      player.tileMap = tileMap;
    };

    let selectedWeapon: WeaponType = "quill-spear";

    engineRef.current = engine;
    playerRef.current = player;
    combatRef.current = combat;
    bossRef.current = boss;
    playerHealthRef.current = playerHealth;

    const showOverlaysRef = { current: true };
    (engine as EngineWithRefs).__showOverlaysRef = showOverlaysRef;

    const floatingNumbers = floatingNumbersRef.current;
    const invincibleLocal = invincibleRef;
    const floodDamageAcc = floodDamageAccRef;
    let victoryTimer = 0;

    // ─── Update Callback ─────────────────────────────────────

    engine.onUpdate((dt) => {
      // Track elapsed time
      if (boss.isAlive && fightStartedRef.current) {
        elapsedRef.current += dt;
      }

      // Auto-respawn on fall below arena
      if (player.position.y > ARENA_HEIGHT + 100) {
        // Find nearest surviving platform
        const activePlatforms = boss.getActivePlatforms();
        let nearestPlat: Platform | null = null;
        let nearestDist = Infinity;
        for (const plat of activePlatforms) {
          const dist = Math.abs(plat.x + plat.width / 2 - player.position.x);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestPlat = plat;
          }
        }
        if (nearestPlat) {
          player.position.x = nearestPlat.x + nearestPlat.width / 2 - player.size.x / 2;
          player.position.y = nearestPlat.y - 50;
        } else {
          // Fallback: walls still exist
          player.position.x = PLAYER_SPAWN.x;
          player.position.y = PLAYER_SPAWN.y;
        }
        player.velocity.x = 0;
        player.velocity.y = 0;
        player.size.y = player.params.playerHeight;
        player.grounded = false;
      }

      // Camera follow
      const playerCenter: Vec2 = {
        x: player.position.x + player.size.x / 2,
        y: player.position.y + player.size.y / 2,
      };
      camera.follow(playerCenter, player.velocity, dt);

      // Weapon switching
      if (input.isPressed(InputAction.WeaponSwitch)) {
        selectedWeapon =
          selectedWeapon === "quill-spear" ? "ink-snap" : "quill-spear";
        combat.currentWeapon = selectedWeapon;
      }

      // Toggle debug overlays
      if (input.isPressed(InputAction.Ability1)) {
        showOverlaysRef.current = !showOverlaysRef.current;
      }

      // Attack input
      const playerState = player.stateMachine.getCurrentState();
      if (
        input.isPressed(InputAction.Attack) &&
        combat.canAttack(playerState)
      ) {
        if (selectedWeapon === "quill-spear") {
          const direction = getAttackDirection(input, player.facingRight);
          combat.startSpearAttack(direction);
        } else {
          const bossTarget = boss.isAlive
            ? [{ id: "boss", bounds: boss.getBounds() }]
            : [];
          const autoAimTarget = combat.findSnapTarget(
            playerCenter,
            bossTarget,
          );
          combat.startSnapAttack(
            autoAimTarget?.position ?? null,
            autoAimTarget?.id ?? null,
            player.facingRight,
          );
        }
      }

      // Update combat
      combat.update(player.getBounds(), player.facingRight);

      // Player attacks boss
      if (
        combat.activeHitbox &&
        combat.attackPhase === "active" &&
        boss.isAlive
      ) {
        const hits = combat.checkHits([
          { id: "boss", bounds: boss.getBounds() },
        ]);

        for (const hit of hits) {
          if (boss.isVulnerable()) {
            const hitstopFrames =
              combat.currentWeapon === "quill-spear"
                ? combat.params.spearHitstopFrames
                : combat.params.snapHitstopFrames;
            const damaged = boss.takeDamage(hit.damage, hitstopFrames);

            if (damaged) {
              const shakeIntensity =
                combat.currentWeapon === "quill-spear"
                  ? combat.params.spearShakeIntensity
                  : combat.params.snapShakeIntensity;
              const shakeFrames =
                combat.currentWeapon === "quill-spear"
                  ? combat.params.spearShakeFrames
                  : combat.params.snapShakeFrames;
              screenShake.shake(shakeIntensity, shakeFrames);

              const knockAngle = Math.atan2(
                hit.knockback.y,
                hit.knockback.x,
              );
              particleSystem.emit({
                x: hit.hitPosition.x,
                y: hit.hitPosition.y,
                count: 10,
                speedMin: 80,
                speedMax: 200,
                angleMin: knockAngle - 0.8,
                angleMax: knockAngle + 0.8,
                lifeMin: 0.15,
                lifeMax: 0.4,
                sizeMin: 2,
                sizeMax: 5,
                colors: ["#f8fafc", "#d4a574", "#5c3d2e", "#ffffff"],
                gravity: 200,
              });

              floatingNumbers.push({
                text: String(hit.damage),
                x: hit.hitPosition.x,
                y: hit.hitPosition.y,
                vy: FLOAT_SPEED,
                alpha: 1,
                timer: FLOAT_DURATION,
                maxTimer: FLOAT_DURATION,
                color: "#ffffff",
              });
            }
          } else {
            boss.tryBlockedHit();
            floatingNumbers.push({
              text: "BLOCK",
              x: hit.hitPosition.x,
              y: hit.hitPosition.y - 10,
              vy: FLOAT_SPEED * 0.5,
              alpha: 1,
              timer: 0.5,
              maxTimer: 0.5,
              color: "#9ca3af",
            });
          }
        }
      }

      // Update boss
      if (boss.isAlive || boss.stateMachine.getCurrentState() === "DYING") {
        boss.update(dt, player.getBounds(), {
          x: player.position.x + player.size.x / 2,
          y: player.position.y + player.size.y / 2,
        });
      }

      // Boss hazards damage player
      if (boss.isAlive) {
        const hazards = boss.getActiveHazards();
        for (const hazard of hazards) {
          if (aabbOverlap(hazard.rect, player.getBounds())) {
            // Ink flood uses continuous damage
            if (hazard.type === "flood") continue;

            // Card projectile: deactivate on hit
            if (hazard.type === "spit") {
              for (const card of boss.spitCards) {
                if (
                  card.active &&
                  !card.stuck &&
                  Math.abs(card.x - (hazard.rect.x + hazard.rect.width / 2)) < card.size &&
                  Math.abs(card.y - (hazard.rect.y + hazard.rect.height / 2)) < card.size
                ) {
                  card.active = false;
                  break;
                }
              }
            }

            const canDamage = invincibleLocal.current
              ? false
              : playerHealth.canTakeDamage(playerState, player.isDashing);
            if (canDamage) {
              const hcx = hazard.rect.x + hazard.rect.width / 2;
              const pcx = player.position.x + player.size.x / 2;
              const kbDir: Vec2 = {
                x: pcx < hcx ? -1 : 1,
                y: hazard.knockback.y < 0 ? -1 : 0,
              };

              playerHealth.takeDamage(hazard.damage, kbDir, hazard.type);
              screenShake.shake(3, 4);

              floatingNumbers.push({
                text: String(hazard.damage),
                x: player.position.x + player.size.x / 2,
                y: player.position.y,
                vy: FLOAT_SPEED,
                alpha: 1,
                timer: FLOAT_DURATION,
                maxTimer: FLOAT_DURATION,
                color: "#ef4444",
              });

              break;
            }
          }
        }

        // Ink flood continuous damage
        if (!invincibleLocal.current) {
          let inFlood = false;
          for (const zone of boss.inkFloodZones) {
            if (zone.fadeProgress >= 1) continue;
            if (aabbOverlap(zone.rect, player.getBounds())) {
              inFlood = true;
              break;
            }
          }
          if (inFlood) {
            floodDamageAcc.current += dt;
            if (floodDamageAcc.current >= 1.0 / boss.params.inkFloodDamagePerSec) {
              floodDamageAcc.current = 0;
              if (playerHealth.canTakeDamage(playerState, player.isDashing)) {
                playerHealth.takeDamage(1, { x: 0, y: -1 }, "flood");
                floatingNumbers.push({
                  text: "1",
                  x: player.position.x + player.size.x / 2,
                  y: player.position.y,
                  vy: FLOAT_SPEED,
                  alpha: 1,
                  timer: FLOAT_DURATION,
                  maxTimer: FLOAT_DURATION,
                  color: "#1e293b",
                });
              }
            }
          } else {
            floodDamageAcc.current = 0;
          }
        }
      }

      // Update player health
      playerHealth.update();

      // Apply player knockback
      const kb = playerHealth.getKnockbackVelocity();
      if (kb) {
        player.velocity.x = kb.x * 2;
        player.velocity.y = Math.min(player.velocity.y, kb.y * 2 - 100);
      }

      // Particles
      particleSystem.update(dt);

      // Screen shake
      const shakeOffset = screenShake.update();
      camera.position.x += shakeOffset.offsetX;
      camera.position.y += shakeOffset.offsetY;

      // Update floating numbers
      for (let i = floatingNumbers.length - 1; i >= 0; i--) {
        const fn = floatingNumbers[i];
        fn.y += fn.vy * dt;
        fn.timer -= dt;
        fn.alpha = Math.max(0, fn.timer / fn.maxTimer);
        if (fn.timer <= 0) {
          floatingNumbers.splice(i, 1);
        }
      }

      // Victory timer
      if (!boss.isAlive && boss.stateMachine.getCurrentState() === "DEAD") {
        victoryTimer += dt;
      } else {
        victoryTimer = 0;
      }
    });

    // ─── World-Space Render Callback ───────────────────────────

    engine.onRender((renderer, interpolation) => {
      const rCtx = renderer.getContext();

      // Dark parchment background
      rCtx.fillStyle = "#1a150e";
      rCtx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

      // Destroyed platform stumps (draw before active platforms)
      boss.renderDestructiblePlatforms(rCtx);

      // Draw tilemap (active platforms)
      tileMap.render(renderer);

      // Boss render
      boss.render(rCtx, camera);

      // Player (simple rect for now)
      const pos = player.getInterpolatedPosition(interpolation);
      rCtx.fillStyle = "#e2e8f0";
      rCtx.fillRect(pos.x, pos.y, player.size.x, player.size.y);

      // Combat visuals
      combat.render(rCtx, camera);

      // Particles
      particleSystem.render(renderer);

      // Floating damage numbers (world space)
      for (const fn of floatingNumbers) {
        rCtx.globalAlpha = fn.alpha;
        rCtx.fillStyle = fn.color;
        rCtx.font = "bold 14px monospace";
        rCtx.textAlign = "center";
        rCtx.fillText(fn.text, fn.x, fn.y);
        rCtx.textAlign = "left";
      }
      rCtx.globalAlpha = 1;

      // Victory text
      if (
        !boss.isAlive &&
        boss.stateMachine.getCurrentState() === "DEAD" &&
        victoryTimer > 2
      ) {
        rCtx.font = "bold 48px monospace";
        rCtx.textAlign = "center";
        rCtx.fillStyle = "#ffffff";
        const victoryAlpha = Math.min(1, (victoryTimer - 2) / 1);
        rCtx.globalAlpha = victoryAlpha;
        rCtx.fillText("VICTORY", ARENA_WIDTH / 2, ARENA_HEIGHT / 2 - 20);
        rCtx.font = "16px monospace";
        rCtx.fillStyle = "#d4a574";
        rCtx.fillText(
          `Time: ${elapsedRef.current.toFixed(1)}s | Damage Dealt: ${boss.totalDamageReceived}`,
          ARENA_WIDTH / 2,
          ARENA_HEIGHT / 2 + 20,
        );
        rCtx.textAlign = "left";
        rCtx.globalAlpha = 1;
      }

      // Debug overlays
      if (!showOverlaysRef.current) return;

      // Player hitbox
      renderer.strokeRect(
        pos.x,
        pos.y,
        player.size.x,
        player.size.y,
        COLORS.debug.hitbox,
        1,
      );

      // Velocity vector
      const cx = pos.x + player.size.x / 2;
      const cy = pos.y + player.size.y / 2;
      const vScale = 0.15;
      const vx = player.velocity.x * vScale;
      const vy = player.velocity.y * vScale;
      if (Math.abs(vx) > 1 || Math.abs(vy) > 1) {
        renderer.drawLine(cx, cy, cx + vx, cy + vy, COLORS.debug.velocity, 2);
      }

      // State label
      const state = player.stateMachine.getCurrentState();
      renderer.drawText(state, pos.x, pos.y - 8, COLORS.debug.stateLabel, 10);

      // Ground indicator
      if (player.grounded) {
        renderer.drawCircle(
          pos.x + player.size.x / 2,
          pos.y + player.size.y + 3,
          3,
          COLORS.debug.ground,
        );
      }

      // Combat debug
      combat.renderDebug(rCtx, player.getBounds());

      // Boss debug
      boss.renderDebug(rCtx);

      // Weapon indicator
      const weaponLabel =
        selectedWeapon === "quill-spear" ? "SPEAR" : "SNAP";
      const weaponColor =
        selectedWeapon === "quill-spear" ? "#60a5fa" : "#dc2626";
      renderer.drawText(
        weaponLabel,
        pos.x + player.size.x + 4,
        pos.y + player.size.y / 2 + 4,
        weaponColor,
        9,
      );
    });

    // ─── Screen-Space Debug Layer ──────────────────────────────

    const debugLayerCallback = (debugCtx: CanvasRenderingContext2D) => {
      // Boss health bar (screen space)
      if (fightStartedRef.current || !boss.isAlive) {
        boss.renderHealthBar(debugCtx, CANVAS_W);
      }

      // Player health HUD
      playerHealth.renderHUD(debugCtx, CANVAS_W);

      if (!showOverlaysRef.current) return;

      const metrics = engine.getMetrics();

      // FPS counter
      debugCtx.fillStyle = COLORS.debug.ground;
      debugCtx.font = "12px monospace";
      debugCtx.fillText(`FPS: ${Math.round(metrics.fps)}`, 8, 16);

      // Velocity readout
      debugCtx.fillStyle = COLORS.debug.velocity;
      debugCtx.textAlign = "right";
      debugCtx.fillText(
        `VelX: ${Math.round(player.velocity.x)}`,
        CANVAS_W - 8,
        16,
      );
      debugCtx.fillText(
        `VelY: ${Math.round(player.velocity.y)}`,
        CANVAS_W - 8,
        32,
      );
      debugCtx.textAlign = "left";

      // Boss diagnostics (bottom-left)
      const diagX = 8;
      const diagY = CANVAS_H - 190;
      debugCtx.fillStyle = "rgba(0, 0, 0, 0.7)";
      debugCtx.fillRect(diagX - 4, diagY - 14, 280, 200);

      debugCtx.font = "10px monospace";
      let lineY = diagY;
      const line = (text: string, color = "#a78bfa") => {
        debugCtx.fillStyle = color;
        debugCtx.fillText(text, diagX, lineY);
        lineY += 13;
      };

      line(`Player: ${player.stateMachine.getCurrentState()}`, "#60a5fa");
      line(`Health: ${playerHealth.health}/${playerHealth.maxHealth}`, "#ef4444");
      line(`Weapon: ${selectedWeapon}`, "#60a5fa");
      line(`Boss HP: ${boss.health}/${boss.maxHealth}`, "#d4a574");
      line(`Phase: ${boss.currentPhase}`, "#ef4444");
      line(`State: ${boss.stateMachine.getCurrentState()}`, "#a78bfa");
      line(`Timer: ${boss.stateTimer}`, "#a78bfa");
      line(`Attack: ${boss.currentAttack ?? "none"}`, "#f59e0b");
      line(`Surface: ${boss.currentSurface}`, "#9ca3af");
      line(`Facing: ${boss.facingRight ? "right" : "left"}`, "#9ca3af");
      line(`Mouth: ${(boss.mouthOpen * 100).toFixed(0)}%`, "#9ca3af");
      line(`Devoured: ${boss.destroyedCount}/${boss.destructiblePlatforms.length}`, "#d4a574");
      line(`Vulnerable: ${boss.isVulnerable() ? "YES" : "NO"}`, boss.isVulnerable() ? "#22c55e" : "#ef4444");
      line(`Time: ${elapsedRef.current.toFixed(1)}s`, "#9ca3af");
      line(`Dmg Dealt: ${boss.totalDamageReceived}`, "#22c55e");
    };
    engine.getRenderer().addLayerCallback("debug", debugLayerCallback);

    engine.start();
  }, []);

  const handleUnmount = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    playerRef.current = null;
    combatRef.current = null;
    bossRef.current = null;
    playerHealthRef.current = null;
    tileMapRef.current = null;
    floatingNumbersRef.current.length = 0;
  }, []);

  const toggleOverlays = useCallback(() => {
    setShowOverlays((prev) => {
      const next = !prev;
      const engine = engineRef.current as EngineWithRefs | null;
      if (engine?.__showOverlaysRef) engine.__showOverlaysRef.current = next;
      return next;
    });
  }, []);

  // ─── Render ──────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-zinc-800 px-4 py-2">
        <Link
          href="/test"
          className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          &larr; Tests
        </Link>
        <h1 className="font-mono text-sm font-bold text-amber-500">
          Index Eater
        </h1>
        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-mono text-amber-400">
          Phase 5 — Content (Boss 3)
        </span>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas area */}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
          <GameCanvas
            width={CANVAS_W}
            height={CANVAS_H}
            onMount={handleMount}
            onUnmount={handleUnmount}
          />

          {/* Pass criteria */}
          <div className="w-[960px] text-xs font-mono text-zinc-500 leading-relaxed">
            <span className="text-zinc-400">Pass criteria: </span>
            Boss patrols floor &middot; Chases player &middot;
            Lunge Bite (telegraph + lunge + recovery) &middot;
            Chain Whip behind boss &middot;
            Index Spit (3 cards fan) &middot;
            Punish during LUNGE_RECOVERY &middot;
            Phase 2: Devour destroys platforms &middot;
            Ink Flood damage zone &middot;
            Phase 3: Wall/ceiling crawl + Drop Pounce &middot;
            Chain Storm radial &middot;
            Death Thrash (HP &le; 3) &middot;
            Auto-crumble &middot;
            Health bar + devour counter &middot;
            Retry resets all
          </div>

          {/* Controls legend */}
          <div className="w-[960px] text-xs font-mono text-zinc-600 leading-relaxed">
            <span className="text-zinc-500">Controls: </span>
            Arrows = Move &middot; Z/Space = Jump &middot; X/Shift = Dash
            &middot; Down = Crouch &middot; J/Enter = Attack &middot; K =
            Switch Weapon &middot; E = Toggle Debug
          </div>
        </div>

        {/* Debug panel */}
        <DebugPanel title="Index Eater">
          {/* Boss Info (always visible) */}
          <div className="border-b border-zinc-800 pb-2 mb-2">
            <div className="text-xs font-mono text-amber-400 uppercase tracking-wider mb-1">
              Boss Info
            </div>
            <div className="text-xs font-mono text-zinc-400 space-y-0.5">
              <div>
                HP:{" "}
                <span className="text-zinc-200">
                  {bossRef.current?.health ?? bossParams.maxHealth} /{" "}
                  {bossRef.current?.maxHealth ?? bossParams.maxHealth}
                </span>
              </div>
              <div>
                Phase:{" "}
                <span className="text-zinc-200">
                  {bossRef.current?.currentPhase ?? 1}
                </span>
              </div>
              <div>
                State:{" "}
                <span className="text-zinc-200">
                  {bossRef.current?.stateMachine.getCurrentState() ?? "IDLE"}
                </span>
              </div>
              <div>
                Attack:{" "}
                <span className="text-zinc-200">
                  {bossRef.current?.currentAttack ?? "none"}
                </span>
              </div>
              <div>
                Surface:{" "}
                <span className="text-zinc-200">
                  {bossRef.current?.currentSurface ?? "floor"}
                </span>
              </div>
              <div>
                Facing:{" "}
                <span className="text-zinc-200">
                  {bossRef.current?.facingRight ? "right" : "left"}
                </span>
              </div>
              <div>
                Devoured:{" "}
                <span className="text-zinc-200">
                  {bossRef.current?.destroyedCount ?? 0} / {bossRef.current?.destructiblePlatforms.length ?? 0}
                </span>
              </div>
              <div>
                Mouth:{" "}
                <span className="text-zinc-200">
                  {((bossRef.current?.mouthOpen ?? 0) * 100).toFixed(0)}%
                </span>
              </div>
              <div>
                Vulnerable:{" "}
                <span className={bossRef.current?.isVulnerable() ? "text-green-400" : "text-red-400"}>
                  {bossRef.current?.isVulnerable() ? "YES" : "NO"}
                </span>
              </div>
            </div>
          </div>

          {/* Boss Health & Phases */}
          <details>
            <summary className="text-xs font-mono text-amber-400/80 uppercase tracking-wider cursor-pointer select-none">
              Boss Health &amp; Phases
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <Slider
                label="Max Health"
                value={bossParams.maxHealth}
                min={8}
                max={48}
                step={2}
                onChange={(v) => updateBossParam("maxHealth", v)}
              />
              <Slider
                label="Phase 1 Threshold"
                value={bossParams.phase1Threshold}
                min={4}
                max={40}
                step={2}
                onChange={(v) => updateBossParam("phase1Threshold", v)}
              />
              <Slider
                label="Phase 2 Threshold"
                value={bossParams.phase2Threshold}
                min={2}
                max={30}
                step={2}
                onChange={(v) => updateBossParam("phase2Threshold", v)}
              />
            </div>
          </details>

          {/* Movement */}
          <details>
            <summary className="text-xs font-mono text-blue-400/80 uppercase tracking-wider cursor-pointer select-none pt-2">
              Movement
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <Slider
                label="Chase Speed"
                value={bossParams.chaseSpeed}
                min={100}
                max={400}
                step={20}
                onChange={(v) => updateBossParam("chaseSpeed", v)}
              />
              <Slider
                label="Climb Speed"
                value={bossParams.climbSpeed}
                min={50}
                max={250}
                step={10}
                onChange={(v) => updateBossParam("climbSpeed", v)}
              />
            </div>
          </details>

          {/* Lunge Bite */}
          <details>
            <summary className="text-xs font-mono text-red-400/80 uppercase tracking-wider cursor-pointer select-none pt-2">
              Lunge Bite
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <Slider
                label="Lunge Distance"
                value={bossParams.lungeDistance}
                min={100}
                max={400}
                step={20}
                onChange={(v) => updateBossParam("lungeDistance", v)}
              />
              <Slider
                label="Lunge Recovery"
                value={bossParams.lungeRecovery}
                min={20}
                max={80}
                step={5}
                onChange={(v) => updateBossParam("lungeRecovery", v)}
              />
            </div>
          </details>

          {/* Chain Whip */}
          <details>
            <summary className="text-xs font-mono text-orange-400/80 uppercase tracking-wider cursor-pointer select-none pt-2">
              Chain Whip
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <Slider
                label="Whip Radius"
                value={bossParams.whipRadius}
                min={60}
                max={220}
                step={10}
                onChange={(v) => updateBossParam("whipRadius", v)}
              />
            </div>
          </details>

          {/* Devour */}
          <details>
            <summary className="text-xs font-mono text-rose-400/80 uppercase tracking-wider cursor-pointer select-none pt-2">
              Devour
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <Slider
                label="Devour Stunned"
                value={bossParams.devourStunned}
                min={25}
                max={90}
                step={5}
                onChange={(v) => updateBossParam("devourStunned", v)}
              />
            </div>
          </details>

          {/* Drop Pounce */}
          <details>
            <summary className="text-xs font-mono text-purple-400/80 uppercase tracking-wider cursor-pointer select-none pt-2">
              Drop Pounce
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <Slider
                label="Pounce Speed"
                value={bossParams.pounceSpeed}
                min={500}
                max={1400}
                step={100}
                onChange={(v) => updateBossParam("pounceSpeed", v)}
              />
              <Slider
                label="Pounce Stunned"
                value={bossParams.pounceStunned}
                min={15}
                max={60}
                step={5}
                onChange={(v) => updateBossParam("pounceStunned", v)}
              />
            </div>
          </details>

          {/* Death Thrash */}
          <details>
            <summary className="text-xs font-mono text-yellow-400/80 uppercase tracking-wider cursor-pointer select-none pt-2">
              Death Thrash
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <Slider
                label="Impact Count"
                value={bossParams.deathThrashImpactCount}
                min={3}
                max={8}
                step={1}
                onChange={(v) => updateBossParam("deathThrashImpactCount", v)}
              />
              <Slider
                label="Collapse Duration"
                value={bossParams.deathThrashCollapse}
                min={30}
                max={100}
                step={10}
                onChange={(v) => updateBossParam("deathThrashCollapse", v)}
              />
            </div>
          </details>

          {/* Auto Crumble */}
          <details>
            <summary className="text-xs font-mono text-zinc-400/80 uppercase tracking-wider cursor-pointer select-none pt-2">
              Auto Crumble
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <Slider
                label="Crumble Interval"
                value={bossParams.autoCrumbleInterval}
                min={120}
                max={600}
                step={30}
                onChange={(v) => updateBossParam("autoCrumbleInterval", v)}
              />
            </div>
          </details>

          {/* Fight Controls */}
          <div className="border-t border-zinc-800 pt-2 mt-2 flex flex-col gap-2">
            <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-1">
              Fight Controls
            </div>
            {!fightStarted && (
              <button
                onClick={startFight}
                className="rounded bg-amber-900 px-2 py-1 text-xs font-mono text-amber-200 hover:bg-amber-800"
              >
                Start Fight
              </button>
            )}
            <button
              onClick={restartFight}
              className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700"
            >
              Retry
            </button>
            <button
              onClick={() => skipToPhase(2)}
              className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700"
            >
              Skip to Phase 2
            </button>
            <button
              onClick={() => skipToPhase(3)}
              className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700"
            >
              Skip to Phase 3
            </button>
            <button
              onClick={restoreAllPlatforms}
              className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700"
            >
              Restore All Platforms
            </button>
            <button
              onClick={toggleBossAi}
              className={`rounded px-2 py-1 text-xs font-mono ${
                bossAiEnabled
                  ? "bg-zinc-800 text-zinc-300"
                  : "bg-amber-900 text-amber-200"
              } hover:opacity-80`}
            >
              {bossAiEnabled ? "Boss AI: ON" : "Boss AI: PAUSED"}
            </button>
            <button
              onClick={toggleInvincible}
              className={`rounded px-2 py-1 text-xs font-mono ${
                playerInvincible
                  ? "bg-green-900 text-green-200"
                  : "bg-zinc-800 text-zinc-300"
              } hover:opacity-80`}
            >
              {playerInvincible ? "Godmode: ON" : "Godmode: OFF"}
            </button>
            <button
              onClick={toggleOverlays}
              className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700"
            >
              {showOverlays ? "Hide" : "Show"} Overlays
            </button>
          </div>
        </DebugPanel>
      </div>
    </div>
  );
}
