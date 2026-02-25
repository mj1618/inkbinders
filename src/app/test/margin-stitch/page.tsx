"use client";

import { useRef, useState, useCallback } from "react";
import { GameCanvas } from "@/components/canvas/GameCanvas";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { RenderModeToggle } from "@/components/debug/RenderModeToggle";
import { Slider } from "@/components/debug/Slider";
import { Engine } from "@/engine/core/Engine";
import { RenderConfig } from "@/engine/core/RenderConfig";
import { Player, DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";
import type { PlayerParams } from "@/engine/entities/Player";
import { TileMap } from "@/engine/physics/TileMap";
import { ParticleSystem } from "@/engine/core/ParticleSystem";
import { MarginStitch, DEFAULT_MARGIN_STITCH_PARAMS } from "@/engine/abilities/MarginStitch";
import type { MarginStitchParams } from "@/engine/abilities/MarginStitch";
import { InputAction } from "@/engine/input/InputManager";
import { COLORS, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/constants";
import Link from "next/link";

// ─── Constants ─────────────────────────────────────────────────────

const SPAWN_X = 80;
const SPAWN_Y = 350;
const RESPAWN_Y_THRESHOLD = 700;
const T = 32; // tile size

// ─── Test Level ────────────────────────────────────────────────────

/**
 * Test level for Margin Stitch ability.
 *
 * Layout:
 * - Floor spans most of the level
 * - Wall Pair A (easy, ~120px gap) — left side, tutorial pair
 * - Wall Pair B (medium, ~80px gap) — center, platform behind wall
 * - Wall Pair C (in the air) — chimney above ground, tests mid-air stitch
 * - Wall Pair D (stitch-and-dash, ~140px gap) — right side
 * - Isolated room — sealed area only reachable by stitch
 * - Too-far pair (~200px, out of range) — should NOT be targetable
 * - Boundary walls
 */
function createTestLevel(): TileMap {
  return new TileMap([
    // === Floor ===
    { x: 0, y: 460, width: 960, height: T },

    // === Boundary walls ===
    { x: -T, y: 0, width: T, height: 600 },    // left
    { x: 960, y: 0, width: T, height: 600 },    // right
    { x: 0, y: -T, width: 960, height: T },      // ceiling

    // === Wall Pair A (easy, ~120px gap) — left side ===
    // Two tall walls ~120px apart, player can stitch and walk through
    { x: 60, y: 180, width: T, height: 280 },    // WA-left (wall A left side)
    { x: 212, y: 180, width: T, height: 280 },   // WA-right (120px gap: 92→212)

    // === Wall Pair B (medium, ~80px gap) — center ===
    // Platform behind the right wall is only reachable by stitching
    { x: 340, y: 200, width: T, height: 260 },   // WB-left
    { x: 452, y: 200, width: T, height: 260 },   // WB-right (80px gap: 372→452)
    // Platform inside (only reachable via stitch)
    { x: 380, y: 400, width: 64, height: T / 2 },

    // === Wall Pair C (in the air) — chimney-like structure ===
    // Sealed chimney above ground, player must jump + stitch mid-air
    { x: 540, y: 240, width: T, height: 140 },   // WC-left
    { x: 652, y: 240, width: T, height: 140 },   // WC-right (80px gap: 572→652)
    // Top and bottom of chimney
    { x: 540, y: 230, width: 144, height: 10 },  // chimney top
    // Platform inside chimney
    { x: 580, y: 340, width: 64, height: T / 2 },

    // === Wall Pair D (stitch-and-dash, ~140px gap) — right side ===
    { x: 730, y: 200, width: T, height: 260 },   // WD-left
    { x: 902, y: 200, width: T, height: 260 },   // WD-right (140px gap: 762→902)

    // === Isolated room (sealed, only reachable by stitch through WD-right) ===
    // Small sealed room to the right of WD-right, accessible via stitch
    // Uses the boundary wall (x: 960) as the right side
    // Goal marker platform inside
    { x: 910, y: 400, width: 40, height: T / 2 },

    // === Too-far pair (~200px gap, should NOT be targetable) ===
    // Two small blocks far apart on the floor
    { x: 300, y: 100, width: T / 2, height: 80 },  // TF-left
    { x: 516, y: 100, width: T / 2, height: 80 },  // TF-right (200px gap: 316→516)

    // === Platforms for navigation ===
    { x: 150, y: 380, width: 60, height: T / 2 },   // step near pair A
    { x: 500, y: 420, width: 80, height: T / 2 },    // step before chimney
    { x: 680, y: 380, width: 50, height: T / 2 },    // step after chimney
  ]);
}

// ─── Pass Criteria Tracking ────────────────────────────────────────

interface PassCriteria {
  wallPairsDetected: boolean;
  stitchActivated: boolean;
  passageTraversed: boolean;
  activatedFromIdle: boolean;
  activatedFromRunning: boolean;
  activatedMidAir: boolean;
  activatedWhileDashing: boolean;
  stitchClosed: boolean;
  cooldownPrevented: boolean;
  outOfRangeNotTargetable: boolean;
}

const INITIAL_CRITERIA: PassCriteria = {
  wallPairsDetected: false,
  stitchActivated: false,
  passageTraversed: false,
  activatedFromIdle: false,
  activatedFromRunning: false,
  activatedMidAir: false,
  activatedWhileDashing: false,
  stitchClosed: false,
  cooldownPrevented: false,
  outOfRangeNotTargetable: false,
};

// ─── Component ─────────────────────────────────────────────────────

interface EngineWithRefs extends Engine {
  __showOverlaysRef?: { current: boolean };
  __showRangeRef?: { current: boolean };
}

export default function MarginStitchTest() {
  const engineRef = useRef<Engine | null>(null);
  const playerRef = useRef<Player | null>(null);
  const stitchRef = useRef<MarginStitch | null>(null);
  const [showOverlays, setShowOverlays] = useState(true);
  const [showRange, setShowRange] = useState(true);
  const [params, setParams] = useState<PlayerParams>({ ...DEFAULT_PLAYER_PARAMS });
  const [stitchParams, setStitchParams] = useState<MarginStitchParams>({ ...DEFAULT_MARGIN_STITCH_PARAMS });
  const [criteria, setCriteria] = useState<PassCriteria>({ ...INITIAL_CRITERIA });

  // Stitch info readout state
  const [stitchInfo, setStitchInfo] = useState({
    abilityState: "READY" as "READY" | "ACTIVE" | "COOLDOWN",
    activeTimer: 0,
    cooldownTimer: 0,
    detectedPairs: 0,
    targetDistance: 0,
  });

  const updateParam = useCallback(<K extends keyof PlayerParams>(key: K, value: PlayerParams[K]) => {
    setParams((prev) => {
      const next = { ...prev, [key]: value };
      const player = playerRef.current;
      if (player) {
        player.params[key] = value;
        if (key === "playerWidth") {
          player.size.x = value as number;
          stitchRef.current?.setPlayerWidth(value as number);
        }
      }
      return next;
    });
  }, []);

  const updateStitchParam = useCallback(<K extends keyof MarginStitchParams>(key: K, value: MarginStitchParams[K]) => {
    setStitchParams((prev) => {
      const next = { ...prev, [key]: value };
      if (stitchRef.current) {
        stitchRef.current.params[key] = value;
      }
      return next;
    });
  }, []);

  const resetParams = useCallback(() => {
    setParams({ ...DEFAULT_PLAYER_PARAMS });
    const player = playerRef.current;
    if (player) {
      Object.assign(player.params, DEFAULT_PLAYER_PARAMS);
      player.size.x = DEFAULT_PLAYER_PARAMS.playerWidth;
    }
    setStitchParams({ ...DEFAULT_MARGIN_STITCH_PARAMS });
    if (stitchRef.current) {
      Object.assign(stitchRef.current.params, DEFAULT_MARGIN_STITCH_PARAMS);
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
  }, []);

  const handleMount = useCallback((ctx: CanvasRenderingContext2D) => {
    RenderConfig.setMode("rectangles");
    const engine = new Engine({ ctx });
    const camera = engine.getCamera();
    const tileMap = createTestLevel();
    const player = new Player();
    const particles = new ParticleSystem();
    const marginStitch = new MarginStitch();

    // Setup player
    player.position.x = SPAWN_X;
    player.position.y = SPAWN_Y;
    player.input = engine.getInput();
    player.tileMap = tileMap;
    player.particleSystem = particles;

    // Setup stitch
    marginStitch.setTileMap(tileMap);
    marginStitch.setPlayerWidth(player.params.playerWidth);
    marginStitch.particleSystem = particles;

    engine.getEntities().add(player);

    engineRef.current = engine;
    playerRef.current = player;
    stitchRef.current = marginStitch;

    // Criteria refs for update closure
    const criteriaRef = { current: { ...INITIAL_CRITERIA } };
    // Track which side the player entered a stitch passage from (null = not inside)
    let passageEntrySide: "left" | "right" | null = null;

    // Overlay toggle refs
    const showOverlaysRef = { current: true };
    const showRangeRef = { current: true };

    // ─── Update callback ───
    engine.onUpdate((dt) => {
      // Auto-respawn if player falls off screen
      if (player.position.y > RESPAWN_Y_THRESHOLD) {
        player.position.x = SPAWN_X;
        player.position.y = SPAWN_Y;
        player.velocity.x = 0;
        player.velocity.y = 0;
        player.size.y = player.params.playerHeight;
        player.grounded = false;
      }

      // Camera follows player (single-screen, snap to center)
      const targetX = CANVAS_WIDTH / 2;
      const targetY = CANVAS_HEIGHT / 2;
      camera.position.x += (targetX - camera.position.x) * 0.1;
      camera.position.y += (targetY - camera.position.y) * 0.1;

      // Scan for wall pairs
      const playerCenter = {
        x: player.position.x + player.size.x / 2,
        y: player.position.y + player.size.y / 2,
      };
      marginStitch.scanForPairs(playerCenter, tileMap);

      // Check stitch activation input
      const input = engine.getInput();
      if (input.isPressed(InputAction.Ability1)) {
        if (marginStitch.canActivate) {
          const state = player.stateMachine.getCurrentState();

          marginStitch.activate(playerCenter.y);

          // Track which state the stitch was activated from
          if (state === "IDLE") criteriaRef.current.activatedFromIdle = true;
          if (state === "RUNNING") criteriaRef.current.activatedFromRunning = true;
          if (state === "JUMPING" || state === "FALLING" || state === "WALL_JUMPING")
            criteriaRef.current.activatedMidAir = true;
          if (state === "DASHING") criteriaRef.current.activatedWhileDashing = true;

          criteriaRef.current.stitchActivated = true;
        } else if (marginStitch.cooldownTimer > 0) {
          criteriaRef.current.cooldownPrevented = true;
        }
      }

      // Update stitch timers
      marginStitch.update(dt);

      // Check if stitch just closed and player needs ejection
      if (marginStitch.activeStitch && !marginStitch.activeStitch.isOpen) {
        const ejection = marginStitch.getEjectionPosition(player.position, player.size);
        if (ejection) {
          player.position.x = ejection.x;
          player.position.y = ejection.y;
        }
        criteriaRef.current.stitchClosed = true;
      }

      // Update particles
      particles.update(dt);

      // Detect passage traversal (track entry side, flag when exiting opposite side)
      if (marginStitch.activeStitch?.isOpen) {
        const rect = marginStitch.activeStitch.passageRect;
        const px = player.position.x + player.size.x / 2;
        const insidePassage = px > rect.x && px < rect.x + rect.width;

        if (insidePassage && passageEntrySide === null) {
          // Player just entered — record which side they came from
          const passageMidX = rect.x + rect.width / 2;
          passageEntrySide = px < passageMidX ? "left" : "right";
        } else if (!insidePassage && passageEntrySide !== null) {
          // Player just exited — check if they came out the opposite side
          const exitedLeft = px <= rect.x;
          const exitedRight = px >= rect.x + rect.width;
          if (
            (passageEntrySide === "left" && exitedRight) ||
            (passageEntrySide === "right" && exitedLeft)
          ) {
            criteriaRef.current.passageTraversed = true;
          }
          passageEntrySide = null;
        }
      } else {
        passageEntrySide = null;
      }

      // Detect wall pairs in range
      if (marginStitch.detectedPairs.length > 0) {
        criteriaRef.current.wallPairsDetected = true;
      }

      // Check too-far pair is not targetable
      // The too-far pair has ~200px gap which exceeds the default 160px range
      // Only validate once the system has detected at least one pair (proves
      // scanning is working, but the far pair is correctly excluded)
      const hasOutOfRangePair = marginStitch.detectedPairs.some((p) => p.gap > 180);
      if (!hasOutOfRangePair && marginStitch.detectedPairs.length > 0) {
        criteriaRef.current.outOfRangeNotTargetable = true;
      }

      // Update stitch info for UI
      const abilityState = marginStitch.activeStitch?.isOpen
        ? "ACTIVE" as const
        : marginStitch.cooldownTimer > 0
          ? "COOLDOWN" as const
          : "READY" as const;

      setStitchInfo({
        abilityState,
        activeTimer: marginStitch.activeStitch?.remainingTime ?? 0,
        cooldownTimer: marginStitch.cooldownTimer,
        detectedPairs: marginStitch.detectedPairs.length,
        targetDistance: marginStitch.targetedPair?.distanceToPlayer ?? 0,
      });

      // Push criteria to React state periodically (every 10 frames)
      if (input.getFrameCount() % 10 === 0) {
        setCriteria({ ...criteriaRef.current });
      }
    });

    // ─── World-space render callback ───
    engine.onRender((renderer, interpolation) => {
      // Draw tilemap
      tileMap.render(renderer);

      // Render stitch visuals (targeting + active) in world space
      const rawCtx = renderer.getContext();
      marginStitch.render(rawCtx, camera);

      // Render particles in world space
      particles.render(renderer);

      if (!showOverlaysRef.current) return;

      const pos = player.getInterpolatedPosition(interpolation);
      const state = player.stateMachine.getCurrentState();

      // Player hitbox
      renderer.strokeRect(pos.x, pos.y, player.size.x, player.size.y, COLORS.debug.hitbox, 1);

      // Velocity vector (amber arrow)
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
        renderer.drawCircle(pos.x + player.size.x / 2, pos.y + player.size.y + 3, 3, COLORS.debug.ground);
      }

      // Stitch cooldown bar near player (below ground indicator)
      if (marginStitch.cooldownTimer > 0) {
        const barWidth = 24;
        const barX = pos.x + player.size.x / 2 - barWidth / 2;
        const barY = pos.y + player.size.y + 8;
        const ratio = 1 - marginStitch.cooldownTimer / marginStitch.params.stitchCooldown;
        renderer.fillRect(barX, barY, barWidth, 3, "rgba(100, 100, 100, 0.5)");
        renderer.fillRect(barX, barY, barWidth * ratio, 3, "#f59e0b");
      } else if (marginStitch.canActivate) {
        const barWidth = 24;
        const barX = pos.x + player.size.x / 2 - barWidth / 2;
        const barY = pos.y + player.size.y + 8;
        renderer.fillRect(barX, barY, barWidth, 3, "#4ade80");
      }

      // Dash cooldown indicator
      if (player.dashCooldownTimer > 0) {
        const barWidth = 24;
        const barX = pos.x + player.size.x / 2 - barWidth / 2;
        const barY = pos.y + player.size.y + 14;
        const ratio = 1 - player.dashCooldownTimer / player.params.dashCooldownFrames;
        renderer.fillRect(barX, barY, barWidth, 3, "rgba(100, 100, 100, 0.5)");
        renderer.fillRect(barX, barY, barWidth * ratio, 3, "#6b7280");
      }
    });

    // ─── Screen-space debug layer ───
    const debugLayerCallback = (ctx: CanvasRenderingContext2D) => {
      if (!showOverlaysRef.current) return;

      const metrics = engine.getMetrics();

      // FPS counter
      ctx.fillStyle = COLORS.debug.ground;
      ctx.font = "12px monospace";
      ctx.fillText(`FPS: ${Math.round(metrics.fps)}`, 8, 16);

      // Velocity readout
      ctx.fillStyle = COLORS.debug.velocity;
      ctx.textAlign = "right";
      ctx.fillText(`VelX: ${Math.round(player.velocity.x)} px/s`, CANVAS_WIDTH - 8, 16);
      ctx.fillText(`VelY: ${Math.round(player.velocity.y)} px/s`, CANVAS_WIDTH - 8, 32);
      ctx.textAlign = "left";

      // Stitch state readout (bottom-left)
      const diagX = 8;
      const diagY = CANVAS_HEIGHT - 100;
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(diagX - 4, diagY - 14, 280, 110);

      ctx.fillStyle = "#a78bfa";
      ctx.font = "11px monospace";
      ctx.fillText(`State: ${player.stateMachine.getCurrentState()}`, diagX, diagY);
      ctx.fillText(`Grounded: ${player.grounded ? "YES" : "NO"}`, diagX, diagY + 14);
      ctx.fillText(`Pos: (${Math.round(player.position.x)}, ${Math.round(player.position.y)})`, diagX, diagY + 28);

      // Stitch-specific info
      ctx.fillStyle = "#f59e0b";
      const abilityLabel = marginStitch.activeStitch?.isOpen
        ? "ACTIVE"
        : marginStitch.cooldownTimer > 0
          ? "COOLDOWN"
          : "READY";
      ctx.fillText(`Stitch: ${abilityLabel}`, diagX, diagY + 48);
      ctx.fillText(`Pairs: ${marginStitch.detectedPairs.length}`, diagX, diagY + 62);
      if (marginStitch.targetedPair) {
        ctx.fillText(`Target dist: ${Math.round(marginStitch.targetedPair.distanceToPlayer)}px`, diagX, diagY + 76);
      }
      if (marginStitch.activeStitch?.isOpen) {
        ctx.fillText(`Timer: ${marginStitch.activeStitch.remainingTime.toFixed(1)}s`, diagX, diagY + 90);
      } else if (marginStitch.cooldownTimer > 0) {
        ctx.fillText(`Cooldown: ${marginStitch.cooldownTimer.toFixed(1)}s`, diagX, diagY + 90);
      }

      // Range circle (screen-space, since camera is centered)
      if (showRangeRef.current) {
        const playerScreenX = player.position.x + player.size.x / 2;
        const playerScreenY = player.position.y + player.size.y / 2;
        marginStitch.renderUI(ctx, { x: playerScreenX, y: playerScreenY }, camera);
      }

      // Controls hint (top-right area)
      ctx.fillStyle = "rgba(100, 100, 100, 0.5)";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.fillText("E: Stitch | Arrows: Move | Z/Space: Jump | X/Shift: Dash", CANVAS_WIDTH - 8, CANVAS_HEIGHT - 8);
      ctx.textAlign = "left";
    };
    engine.getRenderer().addLayerCallback("debug", debugLayerCallback);

    // Store refs for overlay toggle
    (engine as EngineWithRefs).__showOverlaysRef = showOverlaysRef;
    (engine as EngineWithRefs).__showRangeRef = showRangeRef;

    engine.start();
  }, []);

  const handleUnmount = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    playerRef.current = null;
    stitchRef.current = null;
  }, []);

  const toggleOverlays = useCallback(() => {
    setShowOverlays((prev) => {
      const next = !prev;
      const engine = engineRef.current as EngineWithRefs | null;
      if (engine?.__showOverlaysRef) {
        engine.__showOverlaysRef.current = next;
      }
      return next;
    });
  }, []);

  const toggleRange = useCallback(() => {
    setShowRange((prev) => {
      const next = !prev;
      const engine = engineRef.current as EngineWithRefs | null;
      if (engine?.__showRangeRef) {
        engine.__showRangeRef.current = next;
      }
      return next;
    });
  }, []);

  const passCount = Object.values(criteria).filter(Boolean).length;
  const totalCriteria = Object.keys(criteria).length;

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
          Margin Stitch
        </h1>
        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-mono text-amber-400">
          Phase 2 — Abilities
        </span>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas area */}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
          <GameCanvas onMount={handleMount} onUnmount={handleUnmount} />

          {/* Pass criteria */}
          <div className="w-[960px] text-xs font-mono leading-relaxed">
            <div className="text-zinc-400 mb-1">
              Pass Criteria: {passCount}/{totalCriteria}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-zinc-500">
              <CriterionRow label="Wall pairs detected in range" pass={criteria.wallPairsDetected} />
              <CriterionRow label="Stitch activated on target pair" pass={criteria.stitchActivated} />
              <CriterionRow label="Player traversed stitched passage" pass={criteria.passageTraversed} />
              <CriterionRow label="Activated from IDLE state" pass={criteria.activatedFromIdle} />
              <CriterionRow label="Activated from RUNNING state" pass={criteria.activatedFromRunning} />
              <CriterionRow label="Activated mid-air (JUMP/FALL)" pass={criteria.activatedMidAir} />
              <CriterionRow label="Activated while DASHING" pass={criteria.activatedWhileDashing} />
              <CriterionRow label="Stitch closed after timer" pass={criteria.stitchClosed} />
              <CriterionRow label="Cooldown prevents re-stitch" pass={criteria.cooldownPrevented} />
              <CriterionRow label="Out-of-range pair not targetable" pass={criteria.outOfRangeNotTargetable} />
            </div>
          </div>
        </div>

        {/* Debug panel */}
        <DebugPanel title="Margin Stitch">
          <RenderModeToggle />
          {/* Stitch Info (always visible) */}
          <div className="pb-2 border-b border-zinc-800 mb-2">
            <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-1">
              Stitch Info
            </div>
            <div className="text-xs font-mono space-y-0.5">
              <div className="flex justify-between">
                <span className="text-zinc-500">State</span>
                <span className={
                  stitchInfo.abilityState === "ACTIVE" ? "text-amber-400" :
                  stitchInfo.abilityState === "COOLDOWN" ? "text-red-400" :
                  "text-green-400"
                }>{stitchInfo.abilityState}</span>
              </div>
              {stitchInfo.abilityState === "ACTIVE" && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Timer</span>
                  <span className="text-amber-400">{stitchInfo.activeTimer.toFixed(1)}s</span>
                </div>
              )}
              {stitchInfo.abilityState === "COOLDOWN" && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Cooldown</span>
                  <span className="text-red-400">{stitchInfo.cooldownTimer.toFixed(1)}s</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-zinc-500">Pairs in range</span>
                <span className="text-zinc-300">{stitchInfo.detectedPairs}</span>
              </div>
              {stitchInfo.targetDistance > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Target dist</span>
                  <span className="text-zinc-300">{Math.round(stitchInfo.targetDistance)}px</span>
                </div>
              )}
            </div>
          </div>

          {/* Stitch Params */}
          <details open>
            <summary className="text-xs font-mono text-amber-500/80 uppercase tracking-wider cursor-pointer select-none">
              Stitch Params
            </summary>
            <div className="flex flex-col gap-4 pt-2">
              <Slider
                label="Max Range"
                value={stitchParams.maxStitchRange}
                min={60} max={300} step={10}
                onChange={(v) => updateStitchParam("maxStitchRange", v)}
              />
              <Slider
                label="Duration"
                value={stitchParams.stitchDuration}
                min={1.0} max={10.0} step={0.5}
                onChange={(v) => updateStitchParam("stitchDuration", v)}
              />
              <Slider
                label="Cooldown"
                value={stitchParams.stitchCooldown}
                min={0.0} max={10.0} step={0.5}
                onChange={(v) => updateStitchParam("stitchCooldown", v)}
              />
              <Slider
                label="Passage Height"
                value={stitchParams.passageHeight}
                min={30} max={80} step={2}
                onChange={(v) => updateStitchParam("passageHeight", v)}
              />
            </div>
          </details>

          {/* Player State (collapsed) */}
          <details>
            <summary className="text-xs font-mono text-zinc-500 uppercase tracking-wider cursor-pointer select-none pt-2">
              Player Movement
            </summary>
            <div className="flex flex-col gap-4 pt-2">
              <Slider
                label="Max Run Speed"
                value={params.maxRunSpeed}
                min={50} max={600} step={10}
                onChange={(v) => updateParam("maxRunSpeed", v)}
              />
              <Slider
                label="Acceleration"
                value={params.acceleration}
                min={200} max={5000} step={100}
                onChange={(v) => updateParam("acceleration", v)}
              />
              <Slider
                label="Jump Speed"
                value={params.jumpSpeed}
                min={200} max={600} step={10}
                onChange={(v) => updateParam("jumpSpeed", v)}
              />
              <Slider
                label="Dash Speed"
                value={params.dashSpeed}
                min={200} max={1200} step={25}
                onChange={(v) => updateParam("dashSpeed", v)}
              />
              <Slider
                label="Dash Duration"
                value={params.dashDurationFrames}
                min={5} max={30} step={1}
                onChange={(v) => updateParam("dashDurationFrames", v)}
              />
              <Slider
                label="Dash Cooldown"
                value={params.dashCooldownFrames}
                min={0} max={60} step={1}
                onChange={(v) => updateParam("dashCooldownFrames", v)}
              />
            </div>
          </details>

          {/* Controls */}
          <details open>
            <summary className="text-xs font-mono text-zinc-500 uppercase tracking-wider cursor-pointer select-none pt-2">
              Controls
            </summary>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={resetPlayer}
                className="w-full rounded bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Reset Player
              </button>
              <button
                onClick={resetParams}
                className="w-full rounded bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Reset Params
              </button>
              <button
                onClick={toggleOverlays}
                className={`w-full rounded px-3 py-1.5 text-xs font-mono transition-colors ${
                  showOverlays
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Debug Overlays: {showOverlays ? "ON" : "OFF"}
              </button>
              <button
                onClick={toggleRange}
                className={`w-full rounded px-3 py-1.5 text-xs font-mono transition-colors ${
                  showRange
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Range Circle: {showRange ? "ON" : "OFF"}
              </button>
            </div>
          </details>

          {/* Keyboard reference */}
          <div className="pt-2 border-t border-zinc-800 mt-2">
            <div className="text-xs font-mono text-zinc-600 space-y-0.5">
              <div>Arrows &mdash; Move</div>
              <div>Z / Space &mdash; Jump</div>
              <div>Down &mdash; Crouch</div>
              <div>X / Shift &mdash; Dash</div>
              <div>E &mdash; Stitch</div>
            </div>
          </div>
        </DebugPanel>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────

function CriterionRow({ label, pass }: { label: string; pass: boolean }) {
  return (
    <div className={pass ? "text-green-400" : "text-zinc-600"}>
      {pass ? "\u2713" : "\u2610"} {label}
    </div>
  );
}
