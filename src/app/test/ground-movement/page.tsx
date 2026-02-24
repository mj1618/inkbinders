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
const SPAWN_X = 100;
const SPAWN_Y = 340;

/** Y-threshold below which player auto-respawns */
const RESPAWN_Y_THRESHOLD = 700;

/** Test level geometry */
function createTestLevel(): TileMap {
  return new TileMap([
    // Main floor left section
    { x: 0, y: 420, width: 340, height: 40 },
    // Elevated platform (left)
    { x: 80, y: 320, width: 120, height: 20 },
    // Main floor right section (after gap)
    { x: 420, y: 420, width: 540, height: 40 },
    // Low ceiling section — ceiling above right floor
    // The gap between floor top (420) and ceiling bottom should be ~26px
    // Ceiling at y=394 means gap = 420-394 = 26px (fits crouchHeight=24 but not playerHeight=40)
    { x: 540, y: 370, width: 200, height: 24 },
    // Right elevated platform
    { x: 780, y: 320, width: 140, height: 20 },
    // Left wall
    { x: -20, y: 0, width: 20, height: 540 },
    // Right wall
    { x: 960, y: 0, width: 20, height: 540 },
  ]);
}

export default function GroundMovementTest() {
  const engineRef = useRef<Engine | null>(null);
  const playerRef = useRef<Player | null>(null);
  const [showOverlays, setShowOverlays] = useState(true);
  const [params, setParams] = useState<PlayerParams>({ ...DEFAULT_PLAYER_PARAMS });

  const updateParam = useCallback(<K extends keyof PlayerParams>(key: K, value: PlayerParams[K]) => {
    setParams((prev) => {
      const next = { ...prev, [key]: value };
      // Update player params directly via ref
      const player = playerRef.current;
      if (player) {
        player.params[key] = value;
        // Update hitbox width if changed
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

    // Custom update: auto-respawn if player falls off screen
    engine.onUpdate((_dt) => {
      if (player.position.y > RESPAWN_Y_THRESHOLD) {
        player.position.x = SPAWN_X;
        player.position.y = SPAWN_Y;
        player.velocity.x = 0;
        player.velocity.y = 0;
        player.size.y = player.params.playerHeight;
        player.grounded = false;
      }
    });

    // Custom render: tilemap + debug overlays
    const showOverlaysRef = { current: true };
    // We'll update this ref from a layer callback that captures it

    engine.onRender((renderer, interpolation) => {
      // Draw tilemap
      tileMap.render(renderer);

      // Debug overlays
      if (!showOverlaysRef.current) return;

      const pos = player.getInterpolatedPosition(interpolation);
      const state = player.stateMachine.getCurrentState();

      // Hitbox outline (cyan)
      renderer.strokeRect(pos.x, pos.y, player.size.x, player.size.y, COLORS.debug.hitbox, 1);

      // Velocity vector (amber arrow)
      const cx = pos.x + player.size.x / 2;
      const cy = pos.y + player.size.y / 2;
      const vScale = 0.15; // Scale factor for velocity display
      const vx = player.velocity.x * vScale;
      const vy = player.velocity.y * vScale;
      if (Math.abs(vx) > 1 || Math.abs(vy) > 1) {
        renderer.drawLine(cx, cy, cx + vx, cy + vy, COLORS.debug.velocity, 2);
        // Arrowhead
        const angle = Math.atan2(vy, vx);
        const headLen = 6;
        renderer.drawLine(
          cx + vx,
          cy + vy,
          cx + vx - headLen * Math.cos(angle - 0.4),
          cy + vy - headLen * Math.sin(angle - 0.4),
          COLORS.debug.velocity,
          2,
        );
        renderer.drawLine(
          cx + vx,
          cy + vy,
          cx + vx - headLen * Math.cos(angle + 0.4),
          cy + vy - headLen * Math.sin(angle + 0.4),
          COLORS.debug.velocity,
          2,
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
    });

    // Screen-space debug (FPS, speed) — uses the debug layer
    const debugLayerCallback = (ctx: CanvasRenderingContext2D) => {
      if (!showOverlaysRef.current) return;

      const metrics = engine.getMetrics();

      // FPS counter (top-left)
      ctx.fillStyle = COLORS.debug.ground;
      ctx.font = "12px monospace";
      ctx.fillText(`FPS: ${Math.round(metrics.fps)}`, 8, 16);

      // Speed readout (top-right)
      const speed = Math.abs(player.velocity.x);
      ctx.fillStyle = COLORS.debug.velocity;
      ctx.textAlign = "right";
      ctx.fillText(`Speed: ${Math.round(speed)} px/s`, CANVAS_WIDTH - 8, 16);
      ctx.fillText(`VelY: ${Math.round(player.velocity.y)} px/s`, CANVAS_WIDTH - 8, 32);
      ctx.textAlign = "left";
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

  // Sync overlay toggle to engine ref
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
          Ground Movement
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
            Smooth accel/decel &middot; Snappy turn-around &middot; Crouch reduces hitbox &middot;
            Crouch-slide maintains momentum &middot; Slide under low ceilings &middot;
            Can&apos;t stand under ceiling &middot; Falls off ledges &middot; All sliders update live
          </div>
        </div>

        {/* Debug panel */}
        <DebugPanel title="Ground Movement">
          {/* Movement */}
          <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Movement</div>
          <Slider
            label="Max Run Speed"
            value={params.maxRunSpeed}
            min={50}
            max={600}
            step={10}
            onChange={(v) => updateParam("maxRunSpeed", v)}
          />
          <Slider
            label="Acceleration"
            value={params.acceleration}
            min={200}
            max={5000}
            step={100}
            onChange={(v) => updateParam("acceleration", v)}
          />
          <Slider
            label="Deceleration"
            value={params.deceleration}
            min={200}
            max={3000}
            step={100}
            onChange={(v) => updateParam("deceleration", v)}
          />
          <Slider
            label="Turn Multiplier"
            value={params.turnMultiplier}
            min={1.0}
            max={6.0}
            step={0.5}
            onChange={(v) => updateParam("turnMultiplier", v)}
          />

          {/* Crouch / Slide */}
          <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider pt-2">
            Crouch / Slide
          </div>
          <Slider
            label="Crouch Speed"
            value={params.crouchSpeed}
            min={20}
            max={200}
            step={10}
            onChange={(v) => updateParam("crouchSpeed", v)}
          />
          <Slider
            label="Slide Initial Speed"
            value={params.slideInitialSpeed}
            min={100}
            max={600}
            step={10}
            onChange={(v) => updateParam("slideInitialSpeed", v)}
          />
          <Slider
            label="Slide Friction"
            value={params.slideFriction}
            min={100}
            max={1500}
            step={50}
            onChange={(v) => updateParam("slideFriction", v)}
          />
          <Slider
            label="Slide Min Speed"
            value={params.slideMinSpeed}
            min={10}
            max={100}
            step={5}
            onChange={(v) => updateParam("slideMinSpeed", v)}
          />

          {/* Physics */}
          <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider pt-2">
            Physics
          </div>
          <Slider
            label="Gravity"
            value={params.fallGravity}
            min={200}
            max={2000}
            step={50}
            onChange={(v) => updateParam("fallGravity", v)}
          />
          <Slider
            label="Max Fall Speed"
            value={params.maxFallSpeed}
            min={200}
            max={1200}
            step={50}
            onChange={(v) => updateParam("maxFallSpeed", v)}
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
