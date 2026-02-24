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
import { FootnoteGiant } from "@/engine/entities/bosses/FootnoteGiant";
import {
  DEFAULT_FOOTNOTE_GIANT_PARAMS,
  type FootnoteGiantParams,
} from "@/engine/entities/bosses/FootnoteGiantParams";
import type { AttackDirection, WeaponType } from "@/engine/combat/types";
import { aabbOverlap } from "@/engine/physics/AABB";
import { COLORS, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/constants";
import type { Vec2 } from "@/lib/types";
import Link from "next/link";

// ─── Arena Constants ───────────────────────────────────────────────

const ARENA_WIDTH = 1280;
const ARENA_HEIGHT = 540;
const GROUND_Y = 460;
const PLAYER_SPAWN_X = 100;
const PLAYER_SPAWN_Y = 420;

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

// ─── Arena Setup ───────────────────────────────────────────────────

function createArena(): {
  tileMap: TileMap;
  phase2Platforms: Platform[];
} {
  const basePlatforms: Platform[] = [
    // Ground floor
    { x: 0, y: GROUND_Y, width: ARENA_WIDTH, height: 80 },
    // Left wall
    { x: 0, y: 0, width: 20, height: ARENA_HEIGHT },
    // Right wall
    { x: ARENA_WIDTH - 20, y: 0, width: 20, height: ARENA_HEIGHT },
    // Ceiling
    { x: 0, y: 0, width: ARENA_WIDTH, height: 20 },
  ];

  // Phase 2+ platforms (always in collision, conditionally rendered)
  const phase2Platforms: Platform[] = [
    { x: 80, y: 300, width: 80, height: 20 },
    { x: 400, y: 260, width: 80, height: 20 },
    { x: 700, y: 320, width: 100, height: 20 },
  ];

  const tileMap = new TileMap([...basePlatforms, ...phase2Platforms]);

  return { tileMap, phase2Platforms };
}

// ─── Overlay Ref Interface ─────────────────────────────────────────

interface EngineWithRefs extends Engine {
  __showOverlaysRef?: { current: boolean };
}

// ─── Component ─────────────────────────────────────────────────────

export default function FootnoteGiantTest() {
  const engineRef = useRef<Engine | null>(null);
  const playerRef = useRef<Player | null>(null);
  const combatRef = useRef<CombatSystem | null>(null);
  const bossRef = useRef<FootnoteGiant | null>(null);
  const playerHealthRef = useRef<PlayerHealth | null>(null);
  const floatingNumbersRef = useRef<FloatingNumber[]>([]);
  const elapsedRef = useRef(0);
  const invincibleRef = useRef(false);

  const [showOverlays, setShowOverlays] = useState(true);
  const [bossParams, setBossParams] = useState<FootnoteGiantParams>({
    ...DEFAULT_FOOTNOTE_GIANT_PARAMS,
  });
  const [playerInvincible, setPlayerInvincible] = useState(false);
  const [bossAiEnabled, setBossAiEnabled] = useState(true);

  // ─── Boss Param Updater ──────────────────────────────────────

  const updateBossParam = useCallback(
    <K extends keyof FootnoteGiantParams>(
      key: K,
      value: FootnoteGiantParams[K],
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

  const restartFight = useCallback(() => {
    const boss = bossRef.current;
    const player = playerRef.current;
    const playerHealth = playerHealthRef.current;
    const combat = combatRef.current;

    if (boss) boss.reset();
    if (playerHealth) playerHealth.reset();
    if (combat) combat.reset();
    if (player) {
      player.position.x = PLAYER_SPAWN_X;
      player.position.y = PLAYER_SPAWN_Y;
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
    floatingNumbersRef.current.length = 0;
  }, []);

  const skipToPhase = useCallback((phase: 2 | 3) => {
    const boss = bossRef.current;
    if (boss) boss.skipToPhase(phase);
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
    const engine = new Engine({ ctx });
    const camera = engine.getCamera();
    const input = engine.getInput();
    const { tileMap, phase2Platforms } = createArena();

    // Camera for 1280px arena
    camera.bounds = { x: 0, y: 0, width: ARENA_WIDTH, height: ARENA_HEIGHT };

    // Player
    const player = new Player();
    player.position.x = PLAYER_SPAWN_X;
    player.position.y = PLAYER_SPAWN_Y;
    player.input = input;
    player.tileMap = tileMap;

    // Particle system & screen shake
    const particleSystem = new ParticleSystem();
    const screenShake = new ScreenShake();
    player.particleSystem = particleSystem;
    player.screenShake = screenShake;

    engine.getEntities().add(player);

    // Combat system
    const combat = new CombatSystem();

    // Player health
    const playerHealth = new PlayerHealth();

    // Boss
    const boss = new FootnoteGiant();
    boss.particleSystem = particleSystem;
    boss.screenShake = screenShake;

    // Track weapon
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
    let victoryTimer = 0;

    // ─── Update Callback ─────────────────────────────────────

    engine.onUpdate((dt) => {
      // Track elapsed time
      if (boss.isAlive) {
        elapsedRef.current += dt;
      }

      // Auto-respawn on fall
      if (player.position.y > 600) {
        player.position.x = PLAYER_SPAWN_X;
        player.position.y = PLAYER_SPAWN_Y;
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

      // Toggle debug overlays with D key
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

      // Update combat system
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
              // Screen shake
              const shakeIntensity =
                combat.currentWeapon === "quill-spear"
                  ? combat.params.spearShakeIntensity
                  : combat.params.snapShakeIntensity;
              const shakeFrames =
                combat.currentWeapon === "quill-spear"
                  ? combat.params.spearShakeFrames
                  : combat.params.snapShakeFrames;
              screenShake.shake(shakeIntensity, shakeFrames);

              // Hit particles
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
                colors: ["#1e1b4b", "#4338ca", "#e0e7ff", "#ffffff"],
                gravity: 200,
              });

              // Floating damage number
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
            // Blocked hit (clang)
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
            const canDamage = invincibleLocal.current
              ? false
              : playerHealth.canTakeDamage(playerState, player.isDashing);
            if (canDamage) {
              // Determine knockback direction from player to hazard center
              const hcx = hazard.rect.x + hazard.rect.width / 2;
              const pcx = player.position.x + player.size.x / 2;
              const kbDir: Vec2 = {
                x: pcx < hcx ? -1 : 1,
                y: hazard.knockback.y < 0 ? -1 : 0,
              };

              playerHealth.takeDamage(hazard.damage, kbDir, hazard.type);
              screenShake.shake(3, 4);

              // Damage number on player
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
              break; // Only take one hit per frame
            }
          }
        }
      }

      // Update player health
      playerHealth.update();

      // Apply player knockback from damage
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
      // Draw tilemap
      tileMap.render(renderer);

      // Draw phase 2 platforms conditionally
      const rCtx = renderer.getContext();
      if (boss.phase2PlatformsVisible) {
        // Phase 2+ platforms are already in the tilemap for collision
        // Draw them with special styling
        rCtx.fillStyle = "#4338ca";
        for (const plat of phase2Platforms) {
          rCtx.fillRect(plat.x, plat.y, plat.width, plat.height);
          // Glow outline
          rCtx.strokeStyle = "#a5b4fc";
          rCtx.lineWidth = 1;
          rCtx.strokeRect(plat.x, plat.y, plat.width, plat.height);
        }
      } else {
        // Phase 1: render as faint outlines
        rCtx.strokeStyle = "rgba(99, 102, 241, 0.15)";
        rCtx.lineWidth = 1;
        rCtx.setLineDash([4, 4]);
        for (const plat of phase2Platforms) {
          rCtx.strokeRect(plat.x, plat.y, plat.width, plat.height);
        }
        rCtx.setLineDash([]);
      }

      // Boss render
      boss.render(rCtx, camera);

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
        // Victory text in world space at center of arena
        rCtx.fillText("VICTORY", ARENA_WIDTH / 2, ARENA_HEIGHT / 2 - 20);
        rCtx.font = "16px monospace";
        rCtx.fillStyle = "#a5b4fc";
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

      const pos = player.getInterpolatedPosition(interpolation);
      const state = player.stateMachine.getCurrentState();

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
        renderer.drawLine(
          cx,
          cy,
          cx + vx,
          cy + vy,
          COLORS.debug.velocity,
          2,
        );
      }

      // State label
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
        selectedWeapon === "quill-spear" ? "#60a5fa" : "#4338ca";
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
      // Boss health bar (always visible)
      boss.renderHealthBar(debugCtx, CANVAS_WIDTH);

      // Player health HUD
      playerHealth.renderHUD(debugCtx, CANVAS_WIDTH);

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
        CANVAS_WIDTH - 8,
        16,
      );
      debugCtx.fillText(
        `VelY: ${Math.round(player.velocity.y)}`,
        CANVAS_WIDTH - 8,
        32,
      );
      debugCtx.textAlign = "left";

      // Boss diagnostics (bottom-left)
      const diagX = 8;
      const diagY = CANVAS_HEIGHT - 130;
      debugCtx.fillStyle = "rgba(0, 0, 0, 0.7)";
      debugCtx.fillRect(diagX - 4, diagY - 14, 260, 140);

      debugCtx.font = "10px monospace";
      debugCtx.fillStyle = "#a78bfa";
      let lineY = diagY;
      const line = (text: string, color = "#a78bfa") => {
        debugCtx.fillStyle = color;
        debugCtx.fillText(text, diagX, lineY);
        lineY += 13;
      };

      line(`Player: ${player.stateMachine.getCurrentState()}`, "#60a5fa");
      line(`Health: ${playerHealth.health}/${playerHealth.maxHealth}`, "#ef4444");
      line(`Weapon: ${selectedWeapon}`, "#60a5fa");
      line(`Boss HP: ${boss.health}/${boss.maxHealth}`, "#a5b4fc");
      line(`Phase: ${boss.currentPhase}`, "#818cf8");
      line(`State: ${boss.stateMachine.getCurrentState()}`, "#a78bfa");
      line(`Timer: ${boss.stateTimer}`, "#a78bfa");
      line(`Attack: ${boss.currentAttack ?? "none"}`, "#f59e0b");
      line(`Seq Index: ${boss.sequenceIndex}`, "#f59e0b");
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
        <h1 className="font-mono text-sm font-bold text-indigo-500">
          Footnote Giant
        </h1>
        <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-mono text-indigo-400">
          Phase 3 — Combat (Boss)
        </span>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas area */}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
          <GameCanvas onMount={handleMount} onUnmount={handleUnmount} />

          {/* Pass criteria */}
          <div className="w-[960px] text-xs font-mono text-zinc-500 leading-relaxed">
            <span className="text-zinc-400">Pass criteria: </span>
            Boss renders with stacked glyphs &middot; Health bar at top
            &middot; Pillar slam telegraph &middot; Slam deals damage
            &middot; Shockwave on ground &middot; Vulnerable during
            PILLAR_STUCK &middot; Invulnerable otherwise (clang) &middot;
            Ink rain falls &middot; Phase transition at HP threshold &middot;
            Phase 2 Citation Stamp &middot; Phase 3 Footnote Sweep &middot;
            Boss death animation &middot; Victory text &middot; All params
            tunable &middot; Debug overlays
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
        <DebugPanel title="Footnote Giant">
          {/* Boss Info (always visible) */}
          <div className="border-b border-zinc-800 pb-2 mb-2">
            <div className="text-xs font-mono text-indigo-400 uppercase tracking-wider mb-1">
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
            </div>
          </div>

          {/* Boss Health & Phases */}
          <details>
            <summary className="text-xs font-mono text-indigo-400/80 uppercase tracking-wider cursor-pointer select-none">
              Boss Health &amp; Phases
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <Slider
                label="Max Health"
                value={bossParams.maxHealth}
                min={10}
                max={60}
                step={5}
                onChange={(v) => updateBossParam("maxHealth", v)}
              />
              <Slider
                label="Phase 2 Threshold"
                value={bossParams.phase1Threshold}
                min={5}
                max={25}
                step={5}
                onChange={(v) => updateBossParam("phase1Threshold", v)}
              />
              <Slider
                label="Phase 3 Threshold"
                value={bossParams.phase2Threshold}
                min={1}
                max={15}
                step={1}
                onChange={(v) => updateBossParam("phase2Threshold", v)}
              />
              <Slider
                label="Phase Transition Duration"
                value={bossParams.phaseTransitionDuration}
                min={40}
                max={200}
                step={10}
                onChange={(v) =>
                  updateBossParam("phaseTransitionDuration", v)
                }
              />
              <Slider
                label="Invuln Between Attacks"
                value={bossParams.invulnBetweenAttacks}
                min={5}
                max={60}
                step={5}
                onChange={(v) =>
                  updateBossParam("invulnBetweenAttacks", v)
                }
              />
            </div>
          </details>

          {/* Pillar Slam */}
          <details>
            <summary className="text-xs font-mono text-amber-400/80 uppercase tracking-wider cursor-pointer select-none pt-2">
              Pillar Slam
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <Slider
                label="Telegraph Frames"
                value={bossParams.pillarSlamTelegraph}
                min={10}
                max={80}
                step={5}
                onChange={(v) =>
                  updateBossParam("pillarSlamTelegraph", v)
                }
              />
              <Slider
                label="Slam Damage"
                value={bossParams.pillarSlamDamage}
                min={1}
                max={5}
                step={1}
                onChange={(v) =>
                  updateBossParam("pillarSlamDamage", v)
                }
              />
              <Slider
                label="Stuck Duration"
                value={bossParams.pillarSlamStuck}
                min={15}
                max={80}
                step={5}
                onChange={(v) => updateBossParam("pillarSlamStuck", v)}
              />
              <Slider
                label="Recovery Frames"
                value={bossParams.pillarSlamRecover}
                min={10}
                max={60}
                step={5}
                onChange={(v) =>
                  updateBossParam("pillarSlamRecover", v)
                }
              />
              <Slider
                label="Shockwave Height"
                value={bossParams.shockwaveHeight}
                min={20}
                max={80}
                step={5}
                onChange={(v) => updateBossParam("shockwaveHeight", v)}
              />
              <Slider
                label="Shockwave Speed"
                value={bossParams.shockwaveSpeed}
                min={100}
                max={600}
                step={25}
                onChange={(v) => updateBossParam("shockwaveSpeed", v)}
              />
              <Slider
                label="Shockwave Range"
                value={bossParams.shockwaveRange}
                min={80}
                max={400}
                step={20}
                onChange={(v) => updateBossParam("shockwaveRange", v)}
              />
            </div>
          </details>

          {/* Ink Rain */}
          <details>
            <summary className="text-xs font-mono text-blue-400/80 uppercase tracking-wider cursor-pointer select-none pt-2">
              Ink Rain
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <Slider
                label="Telegraph Frames"
                value={bossParams.inkRainTelegraph}
                min={10}
                max={60}
                step={5}
                onChange={(v) =>
                  updateBossParam("inkRainTelegraph", v)
                }
              />
              <Slider
                label="Duration Frames"
                value={bossParams.inkRainDuration}
                min={30}
                max={150}
                step={10}
                onChange={(v) => updateBossParam("inkRainDuration", v)}
              />
              <Slider
                label="Blot Count"
                value={bossParams.inkRainBlotCount}
                min={2}
                max={10}
                step={1}
                onChange={(v) =>
                  updateBossParam("inkRainBlotCount", v)
                }
              />
              <Slider
                label="Blot Size"
                value={bossParams.inkRainBlotSize}
                min={12}
                max={40}
                step={4}
                onChange={(v) => updateBossParam("inkRainBlotSize", v)}
              />
              <Slider
                label="Fall Speed"
                value={bossParams.inkRainFallSpeed}
                min={150}
                max={600}
                step={25}
                onChange={(v) =>
                  updateBossParam("inkRainFallSpeed", v)
                }
              />
            </div>
          </details>

          {/* Citation Stamp */}
          <details>
            <summary className="text-xs font-mono text-red-400/80 uppercase tracking-wider cursor-pointer select-none pt-2">
              Citation Stamp
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <Slider
                label="Telegraph Frames"
                value={bossParams.citationStampTelegraph}
                min={15}
                max={60}
                step={5}
                onChange={(v) =>
                  updateBossParam("citationStampTelegraph", v)
                }
              />
              <Slider
                label="Damage"
                value={bossParams.citationStampDamage}
                min={1}
                max={5}
                step={1}
                onChange={(v) =>
                  updateBossParam("citationStampDamage", v)
                }
              />
              <Slider
                label="Shockwave Height"
                value={bossParams.citationStampShockwaveHeight}
                min={30}
                max={100}
                step={5}
                onChange={(v) =>
                  updateBossParam("citationStampShockwaveHeight", v)
                }
              />
              <Slider
                label="Shockwave Speed"
                value={bossParams.citationStampShockwaveSpeed}
                min={200}
                max={800}
                step={25}
                onChange={(v) =>
                  updateBossParam("citationStampShockwaveSpeed", v)
                }
              />
              <Slider
                label="Recovery Frames"
                value={bossParams.citationStampRecovery}
                min={20}
                max={100}
                step={5}
                onChange={(v) =>
                  updateBossParam("citationStampRecovery", v)
                }
              />
            </div>
          </details>

          {/* Footnote Sweep */}
          <details>
            <summary className="text-xs font-mono text-rose-400/80 uppercase tracking-wider cursor-pointer select-none pt-2">
              Footnote Sweep
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <Slider
                label="Telegraph Frames"
                value={bossParams.footnoteSweepTelegraph}
                min={10}
                max={50}
                step={5}
                onChange={(v) =>
                  updateBossParam("footnoteSweepTelegraph", v)
                }
              />
              <Slider
                label="Damage"
                value={bossParams.footnoteSweepDamage}
                min={1}
                max={3}
                step={1}
                onChange={(v) =>
                  updateBossParam("footnoteSweepDamage", v)
                }
              />
              <Slider
                label="Sweep Height"
                value={bossParams.footnoteSweepHeight}
                min={20}
                max={60}
                step={5}
                onChange={(v) =>
                  updateBossParam("footnoteSweepHeight", v)
                }
              />
              <Slider
                label="Sweep Speed"
                value={bossParams.footnoteSweepSpeed}
                min={200}
                max={1000}
                step={50}
                onChange={(v) =>
                  updateBossParam("footnoteSweepSpeed", v)
                }
              />
              <Slider
                label="Recovery Frames"
                value={bossParams.footnoteSweepRecovery}
                min={15}
                max={60}
                step={5}
                onChange={(v) =>
                  updateBossParam("footnoteSweepRecovery", v)
                }
              />
            </div>
          </details>

          {/* Controls */}
          <div className="border-t border-zinc-800 pt-2 mt-2 flex flex-col gap-2">
            <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-1">
              Controls
            </div>
            <button
              onClick={restartFight}
              className="rounded bg-indigo-900 px-2 py-1 text-xs font-mono text-indigo-200 hover:bg-indigo-800"
            >
              Restart Fight
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
              onClick={toggleInvincible}
              className={`rounded px-2 py-1 text-xs font-mono ${
                playerInvincible
                  ? "bg-green-900 text-green-200"
                  : "bg-zinc-800 text-zinc-300"
              } hover:opacity-80`}
            >
              {playerInvincible ? "Invincible: ON" : "Invincible: OFF"}
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
