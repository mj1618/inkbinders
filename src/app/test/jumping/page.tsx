"use client";

import { useRef, useState, useCallback } from "react";
import { GameCanvas } from "@/components/canvas/GameCanvas";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { Slider } from "@/components/debug/Slider";
import { Engine } from "@/engine/core/Engine";
import { Player, DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";
import { TileMap } from "@/engine/physics/TileMap";
import type { PlayerParams } from "@/engine/entities/Player";
import { COLORS, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/constants";
import Link from "next/link";

/** Spawn point for the player */
const SPAWN_X = 80;
const SPAWN_Y = 340;

/** Y-threshold below which player auto-respawns */
const RESPAWN_Y_THRESHOLD = 700;

/** Test level geometry optimized for jump testing */
function createTestLevel(): TileMap {
  return new TileMap([
    // Main floor (wide base)
    { x: 0, y: 420, width: 380, height: 40 },

    // Step 1: ~80px above floor (easy hop) — floor top is at y=420, so platform at y=340
    { x: 140, y: 340, width: 80, height: 16 },

    // Step 2: ~140px above floor — platform at y=280
    { x: 280, y: 280, width: 80, height: 16 },

    // Floor section after first gap (narrow gap ~60px)
    // Main floor ends at x=380, this starts at x=440 → 60px gap
    { x: 440, y: 420, width: 160, height: 40 },

    // Step 3: ~200px above floor — platform at y=220
    { x: 480, y: 220, width: 80, height: 16 },

    // Wide gap section — floor ends at x=600, next starts at x=760 → 160px gap
    // High platform: ~280px above floor — platform at y=140 (unreachable)
    { x: 660, y: 140, width: 80, height: 16 },

    // Floor after wide gap
    { x: 760, y: 420, width: 200, height: 40 },

    // Low ceiling section — ceiling forces crouch, tests jumping into ceilings
    // Gap between floor top (420) and ceiling bottom = ~26px
    { x: 790, y: 370, width: 140, height: 24 },

    // Left wall
    { x: -20, y: 0, width: 20, height: 540 },

    // Right wall (also tall for future wall-jump testing)
    { x: 960, y: 0, width: 20, height: 540 },

    // Ceiling block in the middle area — tests head bonking
    { x: 300, y: 180, width: 60, height: 16 },
  ]);
}

export default function JumpingTest() {
  const engineRef = useRef<Engine | null>(null);
  const playerRef = useRef<Player | null>(null);
  const [showOverlays, setShowOverlays] = useState(true);
  const [params, setParams] = useState<PlayerParams>({ ...DEFAULT_PLAYER_PARAMS });

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
    setParams({ ...DEFAULT_PLAYER_PARAMS });
    const player = playerRef.current;
    if (player) {
      Object.assign(player.params, DEFAULT_PLAYER_PARAMS);
      player.size.x = DEFAULT_PLAYER_PARAMS.playerWidth;
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
    }
  }, []);

  const handleMount = useCallback((ctx: CanvasRenderingContext2D) => {
    const engine = new Engine({ ctx });
    const tileMap = createTestLevel();
    const player = new Player();
    player.position.x = SPAWN_X;
    player.position.y = SPAWN_Y;
    player.input = engine.getInput();
    player.tileMap = tileMap;

    engine.getEntities().add(player);

    engineRef.current = engine;
    playerRef.current = player;

    // Auto-respawn if player falls off screen
    engine.onUpdate((_dt) => {
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
      }
    });

    // Overlay toggle ref
    const showOverlaysRef = { current: true };

    // World-space custom render: tilemap + debug overlays on player
    engine.onRender((renderer, interpolation) => {
      // Draw tilemap
      tileMap.render(renderer);

      if (!showOverlaysRef.current) return;

      const pos = player.getInterpolatedPosition(interpolation);
      const state = player.stateMachine.getCurrentState();

      // Hitbox outline (cyan)
      renderer.strokeRect(pos.x, pos.y, player.size.x, player.size.y, COLORS.debug.hitbox, 1);

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

      // State label (purple)
      renderer.drawText(state, pos.x, pos.y - 8, COLORS.debug.stateLabel, 10);

      // Ground contact indicator (green dot)
      if (player.grounded) {
        renderer.drawCircle(
          pos.x + player.size.x / 2,
          pos.y + player.size.y + 3,
          3,
          COLORS.debug.ground,
        );
      }

      // Coyote time indicator — small depleting bar when coyote is available
      if (player.canCoyoteJump && player.coyoteTimer <= player.params.coyoteFrames) {
        const barWidth = 20;
        const remaining = 1 - player.coyoteTimer / player.params.coyoteFrames;
        const barX = pos.x + player.size.x / 2 - barWidth / 2;
        const barY = pos.y + player.size.y + 8;
        // Background
        renderer.fillRect(barX, barY, barWidth, 3, "rgba(100, 100, 100, 0.5)");
        // Fill
        renderer.fillRect(barX, barY, barWidth * remaining, 3, "#fbbf24");
      }

      // Apex float indicator — glow around player when apex float active
      if (player.isInApexFloat && (state === "JUMPING" || state === "FALLING")) {
        renderer.strokeRect(
          pos.x - 2, pos.y - 2,
          player.size.x + 4, player.size.y + 4,
          "rgba(251, 191, 36, 0.6)", 2,
        );
      }
    });

    // Screen-space debug layer (FPS, velocity, jump diagnostics)
    const debugLayerCallback = (ctx: CanvasRenderingContext2D) => {
      if (!showOverlaysRef.current) return;

      const metrics = engine.getMetrics();

      // FPS counter (top-left)
      ctx.fillStyle = COLORS.debug.ground;
      ctx.font = "12px monospace";
      ctx.fillText(`FPS: ${Math.round(metrics.fps)}`, 8, 16);

      // Velocity readout (top-right)
      ctx.fillStyle = COLORS.debug.velocity;
      ctx.textAlign = "right";
      ctx.fillText(`VelX: ${Math.round(player.velocity.x)} px/s`, CANVAS_WIDTH - 8, 16);
      ctx.fillText(`VelY: ${Math.round(player.velocity.y)} px/s`, CANVAS_WIDTH - 8, 32);
      ctx.textAlign = "left";

      // Jump diagnostics panel (bottom-left)
      const diagX = 8;
      const diagY = CANVAS_HEIGHT - 80;
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(diagX - 4, diagY - 14, 220, 80);

      ctx.fillStyle = "#a78bfa";
      ctx.font = "11px monospace";
      ctx.fillText(`State: ${player.stateMachine.getCurrentState()}`, diagX, diagY);
      ctx.fillText(`Grounded: ${player.grounded ? "YES" : "NO"}`, diagX, diagY + 14);
      ctx.fillText(`Coyote: ${player.canCoyoteJump ? `${player.params.coyoteFrames - player.coyoteTimer}f` : "N/A"}`, diagX, diagY + 28);
      ctx.fillText(`Jump held: ${player.jumpHeld ? "YES" : "NO"}`, diagX, diagY + 42);
      ctx.fillText(`Apex float: ${player.isInApexFloat ? "YES" : "NO"}`, diagX, diagY + 56);
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
          Jumping
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
            Short tap = small hop &middot; Hold = full arc &middot;
            Floaty rise / snappy fall &middot; Apex hang time &middot;
            Coyote time (~7f) &middot; Jump buffer on landing &middot;
            Air control with momentum bias &middot; Ceiling stops jump &middot;
            Jump from crouch &middot; All sliders update live
          </div>
        </div>

        {/* Debug panel */}
        <DebugPanel title="Jumping">
          {/* Movement */}
          <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Movement</div>
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

          {/* Crouch / Slide */}
          <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider pt-2">
            Crouch / Slide
          </div>
          <Slider
            label="Crouch Speed"
            value={params.crouchSpeed}
            min={20} max={200} step={10}
            onChange={(v) => updateParam("crouchSpeed", v)}
          />
          <Slider
            label="Slide Initial Speed"
            value={params.slideInitialSpeed}
            min={100} max={600} step={10}
            onChange={(v) => updateParam("slideInitialSpeed", v)}
          />
          <Slider
            label="Slide Friction"
            value={params.slideFriction}
            min={100} max={1500} step={50}
            onChange={(v) => updateParam("slideFriction", v)}
          />
          <Slider
            label="Slide Min Speed"
            value={params.slideMinSpeed}
            min={10} max={100} step={5}
            onChange={(v) => updateParam("slideMinSpeed", v)}
          />

          {/* Jump */}
          <div className="text-xs font-mono text-amber-500/80 uppercase tracking-wider pt-2">
            Jump
          </div>
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
            label="Apex Gravity Mult"
            value={params.apexGravityMultiplier}
            min={0.1} max={0.8} step={0.05}
            onChange={(v) => updateParam("apexGravityMultiplier", v)}
          />
          <Slider
            label="Apex Vel Threshold"
            value={params.apexVelocityThreshold}
            min={10} max={100} step={5}
            onChange={(v) => updateParam("apexVelocityThreshold", v)}
          />
          <Slider
            label="Max Fall Speed"
            value={params.maxFallSpeed}
            min={200} max={1200} step={50}
            onChange={(v) => updateParam("maxFallSpeed", v)}
          />

          {/* Input Tuning */}
          <div className="text-xs font-mono text-amber-500/80 uppercase tracking-wider pt-2">
            Input Tuning
          </div>
          <Slider
            label="Coyote Frames"
            value={params.coyoteFrames}
            min={0} max={15} step={1}
            onChange={(v) => updateParam("coyoteFrames", v)}
          />
          <Slider
            label="Jump Buffer Frames"
            value={params.jumpBufferFrames}
            min={0} max={15} step={1}
            onChange={(v) => updateParam("jumpBufferFrames", v)}
          />
          <Slider
            label="Jump Cut Multiplier"
            value={params.jumpCutMultiplier}
            min={0.1} max={0.8} step={0.05}
            onChange={(v) => updateParam("jumpCutMultiplier", v)}
          />

          {/* Air Control */}
          <div className="text-xs font-mono text-amber-500/80 uppercase tracking-wider pt-2">
            Air Control
          </div>
          <Slider
            label="Air Acceleration"
            value={params.airAcceleration}
            min={200} max={3000} step={100}
            onChange={(v) => updateParam("airAcceleration", v)}
          />
          <Slider
            label="Air Deceleration"
            value={params.airDeceleration}
            min={100} max={2000} step={100}
            onChange={(v) => updateParam("airDeceleration", v)}
          />

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

/** Internal type for passing overlay ref through the engine */
interface EngineWithOverlayRef extends Engine {
  __showOverlaysRef?: { current: boolean };
}
