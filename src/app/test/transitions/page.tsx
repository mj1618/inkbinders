"use client";

import { useRef, useState, useCallback } from "react";
import { GameCanvas } from "@/components/canvas/GameCanvas";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { RenderModeToggle } from "@/components/debug/RenderModeToggle";
import { Slider } from "@/components/debug/Slider";
import { Engine } from "@/engine/core/Engine";
import { RenderConfig } from "@/engine/core/RenderConfig";
import { ParticleSystem } from "@/engine/core/ParticleSystem";
import { ScreenShake } from "@/engine/core/ScreenShake";
import { Player, DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";
import { TileMap } from "@/engine/physics/TileMap";
import type { PlayerParams } from "@/engine/entities/Player";
import { COLORS, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/constants";
import Link from "next/link";

/** Spawn point for the player */
const SPAWN_X = 120;
const SPAWN_Y = 340;

/** Y-threshold below which player auto-respawns */
const RESPAWN_Y_THRESHOLD = 900;

/** Tile size for constructing level geometry */
const T = 32;

/**
 * Test level geometry optimized for testing every state transition.
 *
 * Layout:
 * - Wide floor for ground movement (run, turn, stop, crouch-slide)
 * - Step-up platforms (60px, 120px, 200px, 300px) for soft vs hard landing
 * - A tall drop (300px+) for guaranteed hard landing
 * - Tall walls on both sides for wall-slide/wall-jump chains
 * - Narrow chimney (60px gap) for wall-jump ping-pong
 * - Open space for dash testing in all 8 directions
 */
function createTestLevel(): TileMap {
  return new TileMap([
    // === Main floor (wide ground, x: 0-600) ===
    { x: 0, y: 420, width: 600, height: T },

    // === Step-up platforms (right side, ascending) ===
    // Step 1: 60px up from floor
    { x: 620, y: 360, width: 80, height: T },
    // Step 2: 120px up from floor
    { x: 720, y: 300, width: 80, height: T },
    // Step 3: 200px up from floor
    { x: 620, y: 220, width: 80, height: T },
    // Step 4: 300px up from floor (high drop for hard landing)
    { x: 720, y: 120, width: 80, height: T },

    // === Tall drop platform (far right, very high) ===
    { x: 850, y: 80, width: 80, height: T },
    // Landing floor for tall drop
    { x: 820, y: 420, width: 140, height: T },

    // === Left tall wall for wall-slide/wall-jump ===
    { x: 20, y: 80, width: T, height: 340 },

    // === Right tall wall ===
    { x: 908, y: 80, width: T, height: 340 },

    // === Narrow chimney (60px gap for wall-jump ping-pong) ===
    // Left chimney wall
    { x: 440, y: 120, width: T, height: 200 },
    // Right chimney wall
    { x: 532, y: 120, width: T, height: 200 },
    // Chimney floor (to land on)
    { x: 440, y: 320, width: 124, height: T / 2 },

    // === Floating platform (center area, for dash testing) ===
    { x: 250, y: 260, width: 120, height: T / 2 },

    // === Boundary walls ===
    { x: -T, y: 0, width: T, height: 700 },
    { x: 960, y: 0, width: T, height: 700 },

    // === Ceiling ===
    { x: 0, y: -T, width: 960, height: T },

    // === Pit floor (catchment) ===
    { x: 0, y: 600, width: 960, height: T },
  ]);
}

/** Internal type for passing overlay ref through the engine */
interface EngineWithOverlayRef extends Engine {
  __showOverlaysRef?: { current: boolean };
}

/** Transition log entry */
interface TransitionEntry {
  from: string;
  to: string;
  frame: number;
}

export default function TransitionsTest() {
  const engineRef = useRef<Engine | null>(null);
  const playerRef = useRef<Player | null>(null);
  const particleSystemRef = useRef<ParticleSystem | null>(null);
  const screenShakeRef = useRef<ScreenShake | null>(null);
  const [showOverlays, setShowOverlays] = useState(true);
  const [params, setParams] = useState<PlayerParams>({ ...DEFAULT_PLAYER_PARAMS, squashStretchEnabled: true });

  // Particle system toggles
  const [particlesEnabled, setParticlesEnabled] = useState(true);
  const [particleMultiplier, setParticleMultiplier] = useState(1.0);
  const [shakeEnabled, setShakeEnabled] = useState(true);
  const [shakeMultiplier, setShakeMultiplier] = useState(1.0);

  const updateParam = useCallback(<K extends keyof PlayerParams>(key: K, value: PlayerParams[K]) => {
    setParams((prev) => {
      const next = { ...prev, [key]: value };
      const player = playerRef.current;
      if (player) {
        player.params[key] = value;
        if (key === "playerWidth") {
          player.size.x = value as number;
        }
      }
      return next;
    });
  }, []);

  const resetParams = useCallback(() => {
    const defaults = { ...DEFAULT_PLAYER_PARAMS, squashStretchEnabled: true };
    setParams(defaults);
    const player = playerRef.current;
    if (player) {
      Object.assign(player.params, defaults);
      player.size.x = defaults.playerWidth;
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
      player.scaleX = 1.0;
      player.scaleY = 1.0;
      player.fallDurationFrames = 0;
      player.hardLandRecoveryTimer = 0;
      player.lastLandingType = null;
      player.landingFlashTimer = 0;
    }
    if (particleSystemRef.current) {
      particleSystemRef.current.clear();
    }
  }, []);

  const handleMount = useCallback((ctx: CanvasRenderingContext2D) => {
    RenderConfig.setMode("rectangles");
    const engine = new Engine({ ctx });
    const camera = engine.getCamera();
    const tileMap = createTestLevel();

    // Create particle system and screen shake
    const particleSystem = new ParticleSystem();
    const screenShake = new ScreenShake();

    const player = new Player({ squashStretchEnabled: true });
    player.position.x = SPAWN_X;
    player.position.y = SPAWN_Y;
    player.input = engine.getInput();
    player.tileMap = tileMap;
    player.particleSystem = particleSystem;
    player.screenShake = screenShake;

    engine.getEntities().add(player);

    engineRef.current = engine;
    playerRef.current = player;
    particleSystemRef.current = particleSystem;
    screenShakeRef.current = screenShake;

    // Transition log (last 5)
    const transitionLog: TransitionEntry[] = [];
    let frameCount = 0;
    let prevState = player.stateMachine.getCurrentState();

    // Camera follows player with smooth tracking
    engine.onUpdate((dt) => {
      frameCount++;

      // Auto-respawn if player falls off screen
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
        player.canWallCoyoteJump = false;
        player.wallStickTimer = 0;
        player.dashCooldownTimer = 0;
        player.dashAvailable = true;
        player.isDashing = false;
        player.isInDashWindup = false;
        player.dashTrailPositions = [];
        player.scaleX = 1.0;
        player.scaleY = 1.0;
        player.fallDurationFrames = 0;
        player.hardLandRecoveryTimer = 0;
      }

      // Track state transitions
      const currentState = player.stateMachine.getCurrentState();
      if (currentState !== prevState) {
        transitionLog.push({ from: prevState, to: currentState, frame: frameCount });
        if (transitionLog.length > 5) transitionLog.shift();
        prevState = currentState;
      }

      // Update particle system
      particleSystem.update(dt);

      // Center camera on player (with screen shake offset)
      const shakeOffset = screenShake.update();
      const targetX = player.position.x + player.size.x / 2;
      const targetY = player.position.y + player.size.y / 2;
      const smoothing = 0.1;
      camera.position.x += (targetX - camera.position.x) * smoothing;
      camera.position.y += (targetY - camera.position.y) * smoothing;
      camera.position.x += shakeOffset.offsetX;
      camera.position.y += shakeOffset.offsetY;
    });

    // Overlay toggle ref
    const showOverlaysRef = { current: true };

    // World-space custom render: tilemap + particles + debug overlays
    engine.onRender((renderer, interpolation) => {
      // Draw tilemap
      tileMap.render(renderer);

      // Render particles (world-space, before debug overlays)
      particleSystem.render(renderer);

      if (!showOverlaysRef.current) return;

      const pos = player.getInterpolatedPosition(interpolation);
      const state = player.stateMachine.getCurrentState();

      // Collision box outline (always shows unscaled box)
      const hitboxColor = player.isDashing ? "#ffffff" : COLORS.debug.hitbox;
      const hitboxWidth = player.isDashing ? 2 : 1;
      renderer.strokeRect(pos.x, pos.y, player.size.x, player.size.y, hitboxColor, hitboxWidth);

      // If squash-stretch is active, also show the visual rect outline to see the difference
      if (player.params.squashStretchEnabled && (player.scaleX !== 1.0 || player.scaleY !== 1.0)) {
        const cx = pos.x + player.size.x / 2;
        const cy = pos.y + player.size.y / 2;
        const visualW = player.size.x * player.scaleX;
        const visualH = player.size.y * player.scaleY;
        renderer.strokeRect(
          cx - visualW / 2, cy - visualH / 2,
          visualW, visualH,
          "rgba(251, 191, 36, 0.4)", 1,
        );
      }

      // Velocity vector (amber arrow)
      const cx = pos.x + player.size.x / 2;
      const cy = pos.y + player.size.y / 2;
      const vScale = 0.15;
      const vx = player.velocity.x * vScale;
      const vy = player.velocity.y * vScale;
      if (Math.abs(vx) > 1 || Math.abs(vy) > 1) {
        renderer.drawLine(cx, cy, cx + vx, cy + vy, COLORS.debug.velocity, 2);
        const angle = Math.atan2(vy, vx);
        const headLen = 6;
        renderer.drawLine(
          cx + vx, cy + vy,
          cx + vx - headLen * Math.cos(angle - 0.4),
          cy + vy - headLen * Math.sin(angle - 0.4),
          COLORS.debug.velocity, 2,
        );
        renderer.drawLine(
          cx + vx, cy + vy,
          cx + vx - headLen * Math.cos(angle + 0.4),
          cy + vy - headLen * Math.sin(angle + 0.4),
          COLORS.debug.velocity, 2,
        );
      }

      // State label
      renderer.drawText(state, pos.x, pos.y - 8, COLORS.debug.stateLabel, 10);

      // Squash-stretch values near player
      if (player.params.squashStretchEnabled && (player.scaleX !== 1.0 || player.scaleY !== 1.0)) {
        renderer.drawText(
          `sx:${player.scaleX.toFixed(2)} sy:${player.scaleY.toFixed(2)}`,
          pos.x - 20, pos.y - 20,
          "#fbbf24", 9,
        );
      }

      // Fall duration counter when falling
      if (state === "FALLING" && player.fallDurationFrames > 0) {
        renderer.drawText(
          `fall:${player.fallDurationFrames}f`,
          pos.x + player.size.x + 4, pos.y + 10,
          "#ef4444", 10,
        );
      }

      // Landing type indicator flash
      if (player.lastLandingType && player.landingFlashTimer > 0) {
        const flashAlpha = player.landingFlashTimer / 30;
        const landColor = player.lastLandingType === "HARD"
          ? `rgba(239, 68, 68, ${flashAlpha.toFixed(2)})`
          : `rgba(74, 222, 128, ${flashAlpha.toFixed(2)})`;
        renderer.drawText(
          player.lastLandingType,
          pos.x + player.size.x / 2 - 15,
          pos.y + player.size.y + 20,
          landColor, 12,
        );
      }

      // Ground contact indicator (green dot)
      if (player.grounded) {
        renderer.drawCircle(
          pos.x + player.size.x / 2,
          pos.y + player.size.y + 3,
          3,
          COLORS.debug.ground,
        );
      }

      // Wall contact indicators
      if (player.tileMap) {
        const wallColor = "#ec4899";
        if (player.tileMap.isTouchingWall(player, 1)) {
          renderer.fillRect(pos.x + player.size.x, pos.y + 2, 3, player.size.y - 4, wallColor);
        }
        if (player.tileMap.isTouchingWall(player, -1)) {
          renderer.fillRect(pos.x - 3, pos.y + 2, 3, player.size.y - 4, wallColor);
        }
      }

      // Hard landing recovery bar
      if (state === "HARD_LANDING" && player.hardLandRecoveryTimer > 0) {
        const barWidth = 30;
        const barX = pos.x + player.size.x / 2 - barWidth / 2;
        const barY = pos.y - 18;
        const ratio = 1 - player.hardLandRecoveryTimer / player.params.hardLandRecoveryFrames;
        renderer.fillRect(barX, barY, barWidth, 3, "rgba(100, 100, 100, 0.5)");
        renderer.fillRect(barX, barY, barWidth * ratio, 3, "#f59e0b");
      }
    });

    // Screen-space debug layer
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

      // State info panel (bottom-left)
      const diagX = 8;
      const diagY = CANVAS_HEIGHT - 160;
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(diagX - 4, diagY - 14, 280, 170);

      ctx.fillStyle = "#a78bfa";
      ctx.font = "11px monospace";
      ctx.fillText(`State: ${player.stateMachine.getCurrentState()}`, diagX, diagY);
      ctx.fillText(`Prev: ${player.stateMachine.getPreviousState() ?? "—"}`, diagX, diagY + 14);
      ctx.fillText(`Grounded: ${player.grounded ? "YES" : "NO"}`, diagX, diagY + 28);
      ctx.fillText(`Fall frames: ${player.fallDurationFrames}`, diagX, diagY + 42);

      // Squash-stretch info
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`Scale: (${player.scaleX.toFixed(2)}, ${player.scaleY.toFixed(2)})`, diagX, diagY + 62);
      ctx.fillText(`Particles: ${particleSystem.getCount()}`, diagX, diagY + 76);

      if (player.hardLandRecoveryTimer > 0) {
        ctx.fillStyle = "#f59e0b";
        ctx.fillText(`Hard land recovery: ${player.hardLandRecoveryTimer}f`, diagX, diagY + 90);
      }

      // Transition log (last 5)
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("Transitions:", diagX, diagY + 110);
      for (let i = 0; i < transitionLog.length; i++) {
        const entry = transitionLog[transitionLog.length - 1 - i];
        ctx.fillText(
          `${entry.from} → ${entry.to} @${entry.frame}`,
          diagX + 4,
          diagY + 124 + i * 12,
        );
      }
    };
    engine.getRenderer().addLayerCallback("debug", debugLayerCallback);

    // Store the ref for overlay toggle
    (engine as EngineWithOverlayRef).__showOverlaysRef = showOverlaysRef;

    engine.start();
  }, []);

  const handleUnmount = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    playerRef.current = null;
    particleSystemRef.current = null;
    screenShakeRef.current = null;
  }, []);

  const toggleOverlays = useCallback(() => {
    setShowOverlays((prev) => {
      const next = !prev;
      const engine = engineRef.current as EngineWithOverlayRef | null;
      if (engine?.__showOverlaysRef) {
        engine.__showOverlaysRef.current = next;
      }
      return next;
    });
  }, []);

  const toggleParticles = useCallback(() => {
    setParticlesEnabled((prev) => {
      const next = !prev;
      if (particleSystemRef.current) {
        particleSystemRef.current.enabled = next;
      }
      return next;
    });
  }, []);

  const updateParticleMultiplier = useCallback((value: number) => {
    setParticleMultiplier(value);
    if (particleSystemRef.current) {
      particleSystemRef.current.countMultiplier = value;
    }
  }, []);

  const toggleShake = useCallback(() => {
    setShakeEnabled((prev) => {
      const next = !prev;
      if (screenShakeRef.current) {
        screenShakeRef.current.enabled = next;
      }
      return next;
    });
  }, []);

  const updateShakeMultiplier = useCallback((value: number) => {
    setShakeMultiplier(value);
    if (screenShakeRef.current) {
      screenShakeRef.current.intensityMultiplier = value;
    }
  }, []);

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
          Transitions
        </h1>
        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-mono text-amber-400">
          Phase 1 — Core Movement
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
            Jump launch shows squash-stretch &middot; Soft landing shows small dust puff &middot;
            Hard landing shows recovery + big squash + screen shake &middot;
            Hard landing can be dash-cancelled or jump-buffered &middot;
            Turn-around shows compression + dust &middot;
            Wall-slide shows ongoing dust at wall contact &middot;
            Wall-jump shows launch squash + wall particles &middot;
            Dash start/end shows deformation + particles &middot;
            All squash-stretch returns to (1,1) smoothly &middot;
            Collision box unchanged by visual deformation
          </div>
        </div>

        {/* Debug panel */}
        <DebugPanel title="Transitions">
          <RenderModeToggle />
          {/* Squash & Stretch */}
          <details open>
            <summary className="text-xs font-mono text-amber-500/80 uppercase tracking-wider cursor-pointer select-none">
              Squash & Stretch
            </summary>
            <div className="flex flex-col gap-4 pt-2">
              <button
                onClick={() => updateParam("squashStretchEnabled", !params.squashStretchEnabled)}
                className={`w-full rounded px-3 py-1.5 text-xs font-mono transition-colors ${
                  params.squashStretchEnabled
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Squash-Stretch: {params.squashStretchEnabled ? "ON" : "OFF"}
              </button>
              <Slider
                label="Scale Return Speed"
                value={params.scaleReturnSpeed}
                min={2} max={30} step={1}
                onChange={(v) => updateParam("scaleReturnSpeed", v)}
              />
              <Slider
                label="Jump Launch X"
                value={params.jumpLaunchScaleX}
                min={0.4} max={1.0} step={0.05}
                onChange={(v) => updateParam("jumpLaunchScaleX", v)}
              />
              <Slider
                label="Jump Launch Y"
                value={params.jumpLaunchScaleY}
                min={1.0} max={2.0} step={0.05}
                onChange={(v) => updateParam("jumpLaunchScaleY", v)}
              />
              <Slider
                label="Soft Land X"
                value={params.softLandScaleX}
                min={1.0} max={2.0} step={0.05}
                onChange={(v) => updateParam("softLandScaleX", v)}
              />
              <Slider
                label="Soft Land Y"
                value={params.softLandScaleY}
                min={0.3} max={1.0} step={0.05}
                onChange={(v) => updateParam("softLandScaleY", v)}
              />
              <Slider
                label="Hard Land X"
                value={params.hardLandScaleX}
                min={1.0} max={2.5} step={0.05}
                onChange={(v) => updateParam("hardLandScaleX", v)}
              />
              <Slider
                label="Hard Land Y"
                value={params.hardLandScaleY}
                min={0.2} max={0.8} step={0.05}
                onChange={(v) => updateParam("hardLandScaleY", v)}
              />
              <Slider
                label="Dash Start X"
                value={params.dashStartScaleX}
                min={1.0} max={2.0} step={0.05}
                onChange={(v) => updateParam("dashStartScaleX", v)}
              />
              <Slider
                label="Dash Start Y"
                value={params.dashStartScaleY}
                min={0.4} max={1.0} step={0.05}
                onChange={(v) => updateParam("dashStartScaleY", v)}
              />
              <Slider
                label="Dash End X"
                value={params.dashEndScaleX}
                min={0.5} max={1.0} step={0.05}
                onChange={(v) => updateParam("dashEndScaleX", v)}
              />
              <Slider
                label="Dash End Y"
                value={params.dashEndScaleY}
                min={1.0} max={1.8} step={0.05}
                onChange={(v) => updateParam("dashEndScaleY", v)}
              />
              <Slider
                label="Wall Slide Entry X"
                value={params.wallSlideEntryScaleX}
                min={0.5} max={1.0} step={0.05}
                onChange={(v) => updateParam("wallSlideEntryScaleX", v)}
              />
              <Slider
                label="Wall Slide Entry Y"
                value={params.wallSlideEntryScaleY}
                min={1.0} max={1.5} step={0.05}
                onChange={(v) => updateParam("wallSlideEntryScaleY", v)}
              />
              <Slider
                label="Wall Jump X"
                value={params.wallJumpScaleX}
                min={0.5} max={1.0} step={0.05}
                onChange={(v) => updateParam("wallJumpScaleX", v)}
              />
              <Slider
                label="Wall Jump Y"
                value={params.wallJumpScaleY}
                min={1.0} max={1.8} step={0.05}
                onChange={(v) => updateParam("wallJumpScaleY", v)}
              />
              <Slider
                label="Turn Squash X"
                value={params.turnScaleX}
                min={0.6} max={1.0} step={0.05}
                onChange={(v) => updateParam("turnScaleX", v)}
              />
              <Slider
                label="Crouch Squash X"
                value={params.crouchSquashScaleX}
                min={1.0} max={1.6} step={0.05}
                onChange={(v) => updateParam("crouchSquashScaleX", v)}
              />
              <Slider
                label="Crouch Squash Y"
                value={params.crouchSquashScaleY}
                min={0.4} max={1.0} step={0.05}
                onChange={(v) => updateParam("crouchSquashScaleY", v)}
              />
            </div>
          </details>

          {/* Landing */}
          <details open>
            <summary className="text-xs font-mono text-red-400 uppercase tracking-wider cursor-pointer select-none pt-2">
              Landing
            </summary>
            <div className="flex flex-col gap-4 pt-2">
              <Slider
                label="Soft Land Threshold"
                value={params.softLandThresholdFrames}
                min={1} max={30} step={1}
                onChange={(v) => updateParam("softLandThresholdFrames", v)}
              />
              <Slider
                label="Hard Land Threshold"
                value={params.hardLandThresholdFrames}
                min={10} max={60} step={1}
                onChange={(v) => updateParam("hardLandThresholdFrames", v)}
              />
              <Slider
                label="Hard Land Recovery"
                value={params.hardLandRecoveryFrames}
                min={1} max={20} step={1}
                onChange={(v) => updateParam("hardLandRecoveryFrames", v)}
              />
            </div>
          </details>

          {/* Particles */}
          <details>
            <summary className="text-xs font-mono text-zinc-500 uppercase tracking-wider cursor-pointer select-none pt-2">
              Particles
            </summary>
            <div className="flex flex-col gap-4 pt-2">
              <button
                onClick={toggleParticles}
                className={`w-full rounded px-3 py-1.5 text-xs font-mono transition-colors ${
                  particlesEnabled
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Particles: {particlesEnabled ? "ON" : "OFF"}
              </button>
              <Slider
                label="Count Multiplier"
                value={particleMultiplier}
                min={0.5} max={2.0} step={0.1}
                onChange={updateParticleMultiplier}
              />
            </div>
          </details>

          {/* Screen Shake */}
          <details>
            <summary className="text-xs font-mono text-zinc-500 uppercase tracking-wider cursor-pointer select-none pt-2">
              Screen Shake
            </summary>
            <div className="flex flex-col gap-4 pt-2">
              <button
                onClick={toggleShake}
                className={`w-full rounded px-3 py-1.5 text-xs font-mono transition-colors ${
                  shakeEnabled
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Screen Shake: {shakeEnabled ? "ON" : "OFF"}
              </button>
              <Slider
                label="Intensity Multiplier"
                value={shakeMultiplier}
                min={0.5} max={3.0} step={0.1}
                onChange={updateShakeMultiplier}
              />
            </div>
          </details>

          {/* Ground Movement */}
          <details>
            <summary className="text-xs font-mono text-zinc-500 uppercase tracking-wider cursor-pointer select-none pt-2">
              Ground Movement
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
                label="Deceleration"
                value={params.deceleration}
                min={200} max={3000} step={100}
                onChange={(v) => updateParam("deceleration", v)}
              />
              <Slider
                label="Turn Multiplier"
                value={params.turnMultiplier}
                min={1.0} max={6.0} step={0.5}
                onChange={(v) => updateParam("turnMultiplier", v)}
              />
            </div>
          </details>

          {/* Jumping */}
          <details>
            <summary className="text-xs font-mono text-zinc-500 uppercase tracking-wider cursor-pointer select-none pt-2">
              Jumping
            </summary>
            <div className="flex flex-col gap-4 pt-2">
              <Slider
                label="Jump Speed"
                value={params.jumpSpeed}
                min={200} max={600} step={10}
                onChange={(v) => updateParam("jumpSpeed", v)}
              />
              <Slider
                label="Rise Gravity"
                value={params.riseGravity}
                min={200} max={1500} step={50}
                onChange={(v) => updateParam("riseGravity", v)}
              />
              <Slider
                label="Fall Gravity"
                value={params.fallGravity}
                min={400} max={2000} step={50}
                onChange={(v) => updateParam("fallGravity", v)}
              />
              <Slider
                label="Max Fall Speed"
                value={params.maxFallSpeed}
                min={200} max={1200} step={50}
                onChange={(v) => updateParam("maxFallSpeed", v)}
              />
            </div>
          </details>

          {/* Dash */}
          <details>
            <summary className="text-xs font-mono text-pink-400 uppercase tracking-wider cursor-pointer select-none pt-2">
              Dash
            </summary>
            <div className="flex flex-col gap-4 pt-2">
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

          {/* Buttons */}
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
          </div>
        </DebugPanel>
      </div>
    </div>
  );
}
