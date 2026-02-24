"use client";

import { useRef, useState, useCallback } from "react";
import { GameCanvas } from "@/components/canvas/GameCanvas";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { Slider } from "@/components/debug/Slider";
import { Engine } from "@/engine/core/Engine";
import { Player, DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";
import { TileMap } from "@/engine/physics/TileMap";
import type { Platform } from "@/engine/physics/TileMap";
import type { PlayerParams } from "@/engine/entities/Player";
import { ParticleSystem } from "@/engine/core/ParticleSystem";
import { ScreenShake } from "@/engine/core/ScreenShake";
import { InputAction } from "@/engine/input/InputManager";
import type { InputManager } from "@/engine/input/InputManager";
import { CombatSystem } from "@/engine/combat/CombatSystem";
import { DEFAULT_COMBAT_PARAMS } from "@/engine/combat/CombatParams";
import type { CombatParams } from "@/engine/combat/CombatParams";
import { TargetDummy } from "@/engine/combat/TargetDummy";
import type { AttackDirection, WeaponType } from "@/engine/combat/types";
import { COLORS, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/constants";
import type { Vec2 } from "@/lib/types";
import Link from "next/link";

// ─── Constants ──────────────────────────────────────────────────────

const LEVEL_WIDTH = 1920;
const LEVEL_HEIGHT = 540;
const SPAWN_X = 60;
const SPAWN_Y = 400;
const RESPAWN_Y_THRESHOLD = 600;
const MAIN_GROUND_Y = 460;

// ─── Floating Damage Number ─────────────────────────────────────────

interface FloatingNumber {
  text: string;
  x: number;
  y: number;
  vy: number;
  alpha: number;
  timer: number;
  maxTimer: number;
}

const FLOAT_DURATION = 0.8;
const FLOAT_SPEED = -60;

// ─── Attack Direction Helper ────────────────────────────────────────

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

// ─── Test Level ─────────────────────────────────────────────────────

function createTestLevel(): { tileMap: TileMap; dummies: TargetDummy[] } {
  const platforms: Platform[] = [
    // Ground
    { x: 0, y: MAIN_GROUND_Y, width: LEVEL_WIDTH, height: 80 },
    // Left elevated platform (D3)
    { x: 80, y: 360, width: 160, height: 20 },
    // Center staircase
    { x: 400, y: 380, width: 120, height: 20 },
    { x: 540, y: 300, width: 140, height: 20 },
    { x: 690, y: 220, width: 120, height: 20 }, // D5 stands here
    // Right platform (D6)
    { x: 820, y: 320, width: 180, height: 20 },
    // Right wall (for wall-slide attacks)
    { x: 1060, y: 100, width: 40, height: 360 },
    // Boundaries
    { x: 0, y: 0, width: LEVEL_WIDTH, height: 20 }, // Ceiling
    { x: 0, y: 0, width: 20, height: LEVEL_HEIGHT }, // Left wall
    { x: LEVEL_WIDTH - 20, y: 0, width: 20, height: LEVEL_HEIGHT }, // Right wall
  ];

  const tileMap = new TileMap(platforms);

  // Target dummies
  const dummies: TargetDummy[] = [
    // D1: Basic ground target
    new TargetDummy({
      position: { x: 200, y: MAIN_GROUND_Y - 40 },
      health: 3,
      color: "#ef4444",
      respawns: true,
      respawnDelay: 120,
      patrol: false,
      patrolRange: 0,
      patrolSpeed: 0,
      groundY: MAIN_GROUND_Y,
    }),
    // D2: Second ground target
    new TargetDummy({
      position: { x: 350, y: MAIN_GROUND_Y - 40 },
      health: 3,
      color: "#f97316",
      respawns: true,
      respawnDelay: 120,
      patrol: false,
      patrolRange: 0,
      patrolSpeed: 0,
      groundY: MAIN_GROUND_Y,
    }),
    // D3: Elevated platform
    new TargetDummy({
      position: { x: 140, y: 360 - 40 },
      health: 5,
      color: "#eab308",
      respawns: true,
      respawnDelay: 120,
      patrol: false,
      patrolRange: 0,
      patrolSpeed: 0,
      groundY: 360,
    }),
    // D4: Patrolling ground target
    new TargetDummy({
      position: { x: 500, y: MAIN_GROUND_Y - 40 },
      health: 4,
      color: "#f97316",
      respawns: true,
      respawnDelay: 120,
      patrol: true,
      patrolRange: 100,
      patrolSpeed: 60,
      groundY: MAIN_GROUND_Y,
    }),
    // D5: High platform
    new TargetDummy({
      position: { x: 730, y: 220 - 40 },
      health: 3,
      color: "#ef4444",
      respawns: true,
      respawnDelay: 120,
      patrol: false,
      patrolRange: 0,
      patrolSpeed: 0,
      groundY: 220,
    }),
    // D6: Mid platform
    new TargetDummy({
      position: { x: 880, y: 320 - 40 },
      health: 5,
      color: "#eab308",
      respawns: true,
      respawnDelay: 120,
      patrol: false,
      patrolRange: 0,
      patrolSpeed: 0,
      groundY: 320,
    }),
    // D7: Wall target
    new TargetDummy({
      position: { x: 1060 - 24, y: 300 },
      health: 3,
      color: "#ef4444",
      respawns: true,
      respawnDelay: 120,
      patrol: false,
      patrolRange: 0,
      patrolSpeed: 0,
      groundY: MAIN_GROUND_Y,
    }),
  ];

  // Set main floor fallback on all dummies
  for (const d of dummies) {
    d.mainFloorY = MAIN_GROUND_Y;
  }

  return { tileMap, dummies };
}

// ─── Overlay Ref Interface ──────────────────────────────────────────

interface EngineWithRefs extends Engine {
  __showOverlaysRef?: { current: boolean };
}

// ─── Combat Stats ───────────────────────────────────────────────────

interface CombatStats {
  totalHits: number;
  totalDamage: number;
}

// ─── Test Page Component ────────────────────────────────────────────

export default function CombatMeleeTest() {
  const engineRef = useRef<Engine | null>(null);
  const playerRef = useRef<Player | null>(null);
  const combatRef = useRef<CombatSystem | null>(null);
  const dummiesRef = useRef<TargetDummy[]>([]);
  const statsRef = useRef<CombatStats>({ totalHits: 0, totalDamage: 0 });
  const floatingNumbersRef = useRef<FloatingNumber[]>([]);

  const [showOverlays, setShowOverlays] = useState(true);
  const [params, setParams] = useState<PlayerParams>({ ...DEFAULT_PLAYER_PARAMS });
  const [combatParams, setCombatParams] = useState<CombatParams>({
    ...DEFAULT_COMBAT_PARAMS,
  });

  // ─── Param Updaters ─────────────────────────────────────────────

  const updateParam = useCallback(
    <K extends keyof PlayerParams>(key: K, value: PlayerParams[K]) => {
      setParams((prev) => {
        const next = { ...prev, [key]: value };
        const player = playerRef.current;
        if (player) {
          player.params[key] = value;
          if (key === "playerWidth") player.size.x = value as number;
        }
        return next;
      });
    },
    [],
  );

  const updateCombatParam = useCallback(
    <K extends keyof CombatParams>(key: K, value: CombatParams[K]) => {
      setCombatParams((prev) => {
        const next = { ...prev, [key]: value };
        const combat = combatRef.current;
        if (combat) {
          combat.params[key] = value;
        }
        return next;
      });
    },
    [],
  );

  const resetParams = useCallback(() => {
    setParams({ ...DEFAULT_PLAYER_PARAMS });
    setCombatParams({ ...DEFAULT_COMBAT_PARAMS });
    const player = playerRef.current;
    if (player) {
      Object.assign(player.params, DEFAULT_PLAYER_PARAMS);
      player.size.x = DEFAULT_PLAYER_PARAMS.playerWidth;
    }
    const combat = combatRef.current;
    if (combat) {
      Object.assign(combat.params, DEFAULT_COMBAT_PARAMS);
    }
  }, []);

  const resetPlayer = useCallback(() => {
    const player = playerRef.current;
    if (player) {
      player.position.x = SPAWN_X;
      player.position.y = SPAWN_Y;
      player.velocity.x = 0;
      player.velocity.y = 0;
      player.size.y = player.params.playerHeight;
      player.grounded = false;
      player.coyoteTimer = 0;
      player.jumpHeld = false;
      player.isInApexFloat = false;
      player.canCoyoteJump = false;
      player.wallSide = 0;
      player.wallJumpLockoutTimer = 0;
      player.wallCoyoteTimer = 0;
      player.canWallCoyoteJump = false;
      player.wallStickTimer = 0;
      player.dashCooldownTimer = 0;
      player.dashAvailable = true;
      player.isDashing = false;
      player.isInDashWindup = false;
      player.dashSpeedBoostRemaining = 0;
      player.dashTrailPositions = [];
      player.dashTrailFadeTimer = 0;
    }
    combatRef.current?.reset();
  }, []);

  const respawnDummies = useCallback(() => {
    for (const d of dummiesRef.current) {
      d.resetFull();
    }
  }, []);

  const resetStats = useCallback(() => {
    statsRef.current.totalHits = 0;
    statsRef.current.totalDamage = 0;
    for (const d of dummiesRef.current) {
      d.totalDamageReceived = 0;
    }
  }, []);

  // ─── Engine Mount ───────────────────────────────────────────────

  const handleMount = useCallback((ctx: CanvasRenderingContext2D) => {
    const engine = new Engine({ ctx });
    const camera = engine.getCamera();
    const input = engine.getInput();
    const { tileMap, dummies } = createTestLevel();

    // Camera setup for 1920x540 level
    camera.bounds = { x: 0, y: 0, width: LEVEL_WIDTH, height: LEVEL_HEIGHT };

    // Player setup
    const player = new Player();
    player.position.x = SPAWN_X;
    player.position.y = SPAWN_Y;
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

    // Track weapon selection
    let selectedWeapon: WeaponType = "quill-spear";

    engineRef.current = engine;
    playerRef.current = player;
    combatRef.current = combat;
    dummiesRef.current = dummies;

    const showOverlaysRef = { current: true };
    (engine as EngineWithRefs).__showOverlaysRef = showOverlaysRef;

    const stats = statsRef.current;
    const floatingNumbers = floatingNumbersRef.current;

    // ─── Update Callback ───────────────────────────────────────

    engine.onUpdate((dt) => {
      // Auto-respawn on fall
      if (player.position.y > RESPAWN_Y_THRESHOLD) {
        player.position.x = SPAWN_X;
        player.position.y = SPAWN_Y;
        player.velocity.x = 0;
        player.velocity.y = 0;
        player.size.y = player.params.playerHeight;
        player.grounded = false;
        player.coyoteTimer = 0;
        player.jumpHeld = false;
        player.canCoyoteJump = false;
        player.wallSide = 0;
        player.wallJumpLockoutTimer = 0;
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
          const aliveTargets = dummies
            .filter((d) => d.isAlive)
            .map((d) => ({ id: d.id, bounds: d.getBounds() }));
          const autoAimTarget = combat.findSnapTarget(
            playerCenter,
            aliveTargets,
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

      // Hit detection
      if (combat.activeHitbox && combat.attackPhase === "active") {
        const hitTargets = dummies
          .filter((d) => d.isAlive && d.invincibilityFrames <= 0)
          .map((d) => ({ id: d.id, bounds: d.getBounds() }));
        const hits = combat.checkHits(hitTargets);

        for (const hit of hits) {
          const dummy = dummies.find((d) => d.id === hit.targetId);
          if (dummy) {
            const hitstopFrames =
              combat.currentWeapon === "quill-spear"
                ? combat.params.spearHitstopFrames
                : combat.params.snapHitstopFrames;
            dummy.takeDamage(hit.damage, hit.knockback, hitstopFrames);

            // Stats
            stats.totalHits++;
            stats.totalDamage += hit.damage;

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
            const knockAngle = Math.atan2(hit.knockback.y, hit.knockback.x);
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
            });
          }
        }
      }

      // Update dummies
      for (const d of dummies) {
        d.update(dt);
      }

      // Update particles
      particleSystem.update(dt);

      // Update screen shake
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
    });

    // ─── World-Space Render Callback ─────────────────────────────

    engine.onRender((renderer, interpolation) => {
      // Draw tilemap
      tileMap.render(renderer);

      // Draw dummies
      for (const d of dummies) {
        d.render(renderer, interpolation);
      }

      // Combat visuals (attack hitbox graphics)
      const rCtx = renderer.getContext();
      combat.render(rCtx, camera);

      // Render particles (world space)
      particleSystem.render(renderer);

      // Floating damage numbers (world space)
      for (const fn of floatingNumbers) {
        rCtx.globalAlpha = fn.alpha;
        rCtx.fillStyle = "#ffffff";
        rCtx.font = "bold 14px monospace";
        rCtx.textAlign = "center";
        rCtx.fillText(fn.text, fn.x, fn.y);
        rCtx.textAlign = "left";
      }
      rCtx.globalAlpha = 1;

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
        renderer.drawLine(cx, cy, cx + vx, cy + vy, COLORS.debug.velocity, 2);
      }

      // State label
      renderer.drawText(state, pos.x, pos.y - 8, COLORS.debug.stateLabel, 10);

      // Ground contact indicator
      if (player.grounded) {
        renderer.drawCircle(
          pos.x + player.size.x / 2,
          pos.y + player.size.y + 3,
          3,
          COLORS.debug.ground,
        );
      }

      // Combat debug overlays
      combat.renderDebug(rCtx, player.getBounds());

      // Dummy debug overlays
      for (const d of dummies) {
        d.renderDebug(rCtx);
      }

      // Weapon indicator near player
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

      // Snap auto-aim range circle (debug)
      if (selectedWeapon === "ink-snap") {
        rCtx.strokeStyle = "rgba(67, 56, 202, 0.2)";
        rCtx.lineWidth = 1;
        rCtx.setLineDash([4, 4]);
        rCtx.beginPath();
        rCtx.arc(cx, cy, combat.params.snapAutoAimRange, 0, Math.PI * 2);
        rCtx.stroke();
        rCtx.setLineDash([]);
      }
    });

    // ─── Screen-Space Debug Layer ──────────────────────────────

    const debugLayerCallback = (debugCtx: CanvasRenderingContext2D) => {
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
        `VelX: ${Math.round(player.velocity.x)} px/s`,
        CANVAS_WIDTH - 8,
        16,
      );
      debugCtx.fillText(
        `VelY: ${Math.round(player.velocity.y)} px/s`,
        CANVAS_WIDTH - 8,
        32,
      );
      debugCtx.textAlign = "left";

      // Combat diagnostics (bottom-left)
      const diagX = 8;
      const diagY = CANVAS_HEIGHT - 100;
      debugCtx.fillStyle = "rgba(0, 0, 0, 0.6)";
      debugCtx.fillRect(diagX - 4, diagY - 14, 280, 110);

      debugCtx.fillStyle = "#a78bfa";
      debugCtx.font = "11px monospace";
      debugCtx.fillText(
        `State: ${player.stateMachine.getCurrentState()}`,
        diagX,
        diagY,
      );
      debugCtx.fillText(
        `Grounded: ${player.grounded ? "YES" : "NO"}`,
        diagX,
        diagY + 14,
      );

      // Combat info
      debugCtx.fillStyle = "#60a5fa";
      debugCtx.fillText(
        `Weapon: ${selectedWeapon}`,
        diagX,
        diagY + 34,
      );
      debugCtx.fillText(
        `Phase: ${combat.attackPhase} (${combat.phaseTimer})`,
        diagX,
        diagY + 48,
      );
      debugCtx.fillText(
        `Cooldown: ${combat.cooldownTimer}`,
        diagX,
        diagY + 62,
      );
      debugCtx.fillText(
        `Hits: ${stats.totalHits} | Dmg: ${stats.totalDamage}`,
        diagX,
        diagY + 76,
      );
      if (combat.snapTargetId) {
        debugCtx.fillText(
          `Snap Target: ${combat.snapTargetId}`,
          diagX,
          diagY + 90,
        );
      }
    };
    engine.getRenderer().addLayerCallback("debug", debugLayerCallback);

    engine.start();
  }, []);

  const handleUnmount = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    playerRef.current = null;
    combatRef.current = null;
    dummiesRef.current = [];
  }, []);

  const toggleOverlays = useCallback(() => {
    setShowOverlays((prev) => {
      const next = !prev;
      const engine = engineRef.current as EngineWithRefs | null;
      if (engine?.__showOverlaysRef) engine.__showOverlaysRef.current = next;
      return next;
    });
  }, []);

  // ─── Render ─────────────────────────────────────────────────────

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
        <h1 className="font-mono text-sm font-bold text-blue-500">
          Combat Melee
        </h1>
        <span className="rounded bg-blue-500/20 px-2 py-0.5 text-xs font-mono text-blue-400">
          Phase 3 — Combat
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
            J attacks with spear &middot; Hitbox extends from player &middot;
            Follows player through movement &middot; Dummy takes damage &middot;
            Hitstop on dummy (player keeps moving) &middot; Knockback after
            hitstop &middot; Screen shake on hit &middot; Hit particles
            &middot; Attack while running/jumping/wall-sliding/dashing &middot;
            8-dir aiming &middot; K switches to ink snap &middot; Snap
            auto-aims &middot; Snap deals more damage &middot; Cooldown
            prevents spam &middot; Dummy dies &amp; respawns &middot;
            Floating damage numbers &middot; All params tunable
          </div>

          {/* Controls legend */}
          <div className="w-[960px] text-xs font-mono text-zinc-600 leading-relaxed">
            <span className="text-zinc-500">Controls: </span>
            Arrows = Move &middot; Z/Space = Jump &middot; X/Shift = Dash
            &middot; Down = Crouch &middot; J/Enter = Attack &middot; K =
            Switch Weapon &middot; D = Debug Overlays
          </div>
        </div>

        {/* Debug panel */}
        <DebugPanel title="Combat Melee">
          {/* Combat Info (always visible) */}
          <div className="border-b border-zinc-800 pb-2 mb-2">
            <div className="text-xs font-mono text-blue-400 uppercase tracking-wider mb-1">
              Combat Info
            </div>
            <div className="text-xs font-mono text-zinc-400 space-y-0.5">
              <div>
                Weapon:{" "}
                <span className="text-zinc-200">
                  {combatRef.current?.currentWeapon ?? "quill-spear"}
                </span>
              </div>
              <div>
                Phase:{" "}
                <span className="text-zinc-200">
                  {combatRef.current?.attackPhase ?? "idle"} (
                  {combatRef.current?.phaseTimer ?? 0})
                </span>
              </div>
              <div>
                Cooldown:{" "}
                <span className="text-zinc-200">
                  {combatRef.current?.cooldownTimer ?? 0}
                </span>
              </div>
            </div>
          </div>

          {/* Quill-Spear Params */}
          <details open>
            <summary className="text-xs font-mono text-blue-400/80 uppercase tracking-wider cursor-pointer select-none">
              Quill-Spear Params
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <Slider
                label="Windup Frames"
                value={combatParams.spearWindupFrames}
                min={0}
                max={10}
                step={1}
                onChange={(v) => updateCombatParam("spearWindupFrames", v)}
              />
              <Slider
                label="Active Frames"
                value={combatParams.spearActiveFrames}
                min={1}
                max={12}
                step={1}
                onChange={(v) => updateCombatParam("spearActiveFrames", v)}
              />
              <Slider
                label="Recovery Frames"
                value={combatParams.spearRecoveryFrames}
                min={0}
                max={10}
                step={1}
                onChange={(v) => updateCombatParam("spearRecoveryFrames", v)}
              />
              <Slider
                label="Cooldown Frames"
                value={combatParams.spearCooldownFrames}
                min={0}
                max={30}
                step={1}
                onChange={(v) => updateCombatParam("spearCooldownFrames", v)}
              />
              <Slider
                label="Reach"
                value={combatParams.spearReach}
                min={20}
                max={100}
                step={4}
                onChange={(v) => updateCombatParam("spearReach", v)}
              />
              <Slider
                label="Width"
                value={combatParams.spearWidth}
                min={8}
                max={40}
                step={2}
                onChange={(v) => updateCombatParam("spearWidth", v)}
              />
              <Slider
                label="Damage"
                value={combatParams.spearDamage}
                min={1}
                max={10}
                step={1}
                onChange={(v) => updateCombatParam("spearDamage", v)}
              />
              <Slider
                label="Knockback"
                value={combatParams.spearKnockback}
                min={50}
                max={600}
                step={25}
                onChange={(v) => updateCombatParam("spearKnockback", v)}
              />
              <Slider
                label="Hitstop Frames"
                value={combatParams.spearHitstopFrames}
                min={0}
                max={12}
                step={1}
                onChange={(v) => updateCombatParam("spearHitstopFrames", v)}
              />
              <Slider
                label="Shake Intensity"
                value={combatParams.spearShakeIntensity}
                min={0}
                max={10}
                step={0.5}
                onChange={(v) => updateCombatParam("spearShakeIntensity", v)}
              />
              <Slider
                label="Shake Frames"
                value={combatParams.spearShakeFrames}
                min={0}
                max={10}
                step={1}
                onChange={(v) => updateCombatParam("spearShakeFrames", v)}
              />
            </div>
          </details>

          {/* Ink Snap Params */}
          <details open>
            <summary className="text-xs font-mono text-indigo-400/80 uppercase tracking-wider cursor-pointer select-none">
              Ink Snap Params
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <Slider
                label="Windup Frames"
                value={combatParams.snapWindupFrames}
                min={0}
                max={10}
                step={1}
                onChange={(v) => updateCombatParam("snapWindupFrames", v)}
              />
              <Slider
                label="Active Frames"
                value={combatParams.snapActiveFrames}
                min={1}
                max={10}
                step={1}
                onChange={(v) => updateCombatParam("snapActiveFrames", v)}
              />
              <Slider
                label="Recovery Frames"
                value={combatParams.snapRecoveryFrames}
                min={0}
                max={10}
                step={1}
                onChange={(v) => updateCombatParam("snapRecoveryFrames", v)}
              />
              <Slider
                label="Cooldown Frames"
                value={combatParams.snapCooldownFrames}
                min={0}
                max={30}
                step={1}
                onChange={(v) => updateCombatParam("snapCooldownFrames", v)}
              />
              <Slider
                label="Radius"
                value={combatParams.snapRadius}
                min={12}
                max={60}
                step={4}
                onChange={(v) => updateCombatParam("snapRadius", v)}
              />
              <Slider
                label="Auto-Aim Range"
                value={combatParams.snapAutoAimRange}
                min={40}
                max={300}
                step={10}
                onChange={(v) => updateCombatParam("snapAutoAimRange", v)}
              />
              <Slider
                label="Damage"
                value={combatParams.snapDamage}
                min={1}
                max={10}
                step={1}
                onChange={(v) => updateCombatParam("snapDamage", v)}
              />
              <Slider
                label="Knockback"
                value={combatParams.snapKnockback}
                min={100}
                max={800}
                step={25}
                onChange={(v) => updateCombatParam("snapKnockback", v)}
              />
              <Slider
                label="Hitstop Frames"
                value={combatParams.snapHitstopFrames}
                min={0}
                max={12}
                step={1}
                onChange={(v) => updateCombatParam("snapHitstopFrames", v)}
              />
              <Slider
                label="Shake Intensity"
                value={combatParams.snapShakeIntensity}
                min={0}
                max={10}
                step={0.5}
                onChange={(v) => updateCombatParam("snapShakeIntensity", v)}
              />
              <Slider
                label="Shake Frames"
                value={combatParams.snapShakeFrames}
                min={0}
                max={10}
                step={1}
                onChange={(v) => updateCombatParam("snapShakeFrames", v)}
              />
            </div>
          </details>

          {/* General Combat Params */}
          <details>
            <summary className="text-xs font-mono text-zinc-500 uppercase tracking-wider cursor-pointer select-none pt-2">
              General Combat
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                <input
                  type="checkbox"
                  checked={combatParams.attackDuringDash}
                  onChange={(e) =>
                    updateCombatParam("attackDuringDash", e.target.checked)
                  }
                  className="accent-amber-500"
                />
                Attack during dash
              </label>
              <label className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                <input
                  type="checkbox"
                  checked={combatParams.attackDuringWallSlide}
                  onChange={(e) =>
                    updateCombatParam("attackDuringWallSlide", e.target.checked)
                  }
                  className="accent-amber-500"
                />
                Attack during wall-slide
              </label>
              <label className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                <input
                  type="checkbox"
                  checked={combatParams.attackDuringHardLanding}
                  onChange={(e) =>
                    updateCombatParam(
                      "attackDuringHardLanding",
                      e.target.checked,
                    )
                  }
                  className="accent-amber-500"
                />
                Attack during hard landing
              </label>
            </div>
          </details>

          {/* Target Dummy Controls */}
          <details>
            <summary className="text-xs font-mono text-zinc-500 uppercase tracking-wider cursor-pointer select-none pt-2">
              Target Dummies
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <button
                onClick={respawnDummies}
                className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700"
              >
                Respawn All
              </button>
              <button
                onClick={resetStats}
                className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700"
              >
                Reset Damage Counters
              </button>
            </div>
          </details>

          {/* Player State (collapsed) */}
          <details>
            <summary className="text-xs font-mono text-zinc-500 uppercase tracking-wider cursor-pointer select-none pt-2">
              Player Movement
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <Slider
                label="Max Run Speed"
                value={params.maxRunSpeed}
                min={100}
                max={600}
                step={10}
                onChange={(v) => updateParam("maxRunSpeed", v)}
              />
              <Slider
                label="Jump Speed"
                value={params.jumpSpeed}
                min={200}
                max={600}
                step={10}
                onChange={(v) => updateParam("jumpSpeed", v)}
              />
              <Slider
                label="Gravity"
                value={params.gravity}
                min={400}
                max={2000}
                step={20}
                onChange={(v) => updateParam("gravity", v)}
              />
              <Slider
                label="Dash Speed"
                value={params.dashSpeed}
                min={200}
                max={800}
                step={20}
                onChange={(v) => updateParam("dashSpeed", v)}
              />
            </div>
          </details>

          {/* Controls */}
          <div className="border-t border-zinc-800 pt-2 mt-2 flex flex-col gap-2">
            <button
              onClick={toggleOverlays}
              className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700"
            >
              {showOverlays ? "Hide" : "Show"} Overlays
            </button>
            <button
              onClick={resetPlayer}
              className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700"
            >
              Reset Player
            </button>
            <button
              onClick={resetParams}
              className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700"
            >
              Reset All Params
            </button>
          </div>
        </DebugPanel>
      </div>
    </div>
  );
}
