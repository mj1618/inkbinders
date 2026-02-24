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
const SPAWN_X = 120;
const SPAWN_Y = 340;

/** Y-threshold below which player auto-respawns */
const RESPAWN_Y_THRESHOLD = 800;

/** Tile size for constructing level geometry */
const T = 32;

/**
 * Test level geometry optimized for wall mechanics testing.
 *
 * Layout:
 * - Main floor (split by a narrow pit)
 * - Left tall wall (~300px height) for basic wall-slide testing
 * - Mid platform pair (~80px apart) for wall-jump chain testing
 * - Narrow chimney corridor (~60px apart, tall) for vertical climbing
 * - Right tall wall (~300px height)
 * - Ceiling + boundary walls
 */
function createTestLevel(): TileMap {
  return new TileMap([
    // === Main floor ===
    // Left section of floor
    { x: 0, y: 420, width: 360, height: T },
    // Small pit: gap from x=360 to x=420 (60px gap with walls on each side)
    // Right section of floor
    { x: 420, y: 420, width: 540, height: T },

    // === Left tall wall ===
    // Wall on right side of left area: 1 tile wide, ~300px tall
    { x: 60, y: 120, width: T, height: 300 },

    // === Mid platform pair (for basic wall-jump chains) ===
    // Two walls ~80px apart, ~200px tall
    // Left wall of pair
    { x: 280, y: 160, width: T, height: 260 },
    // Right wall of pair (80px gap)
    { x: 392, y: 160, width: T, height: 260 },

    // === Narrow chimney corridor (~60px apart, tall) ===
    // Left wall of chimney
    { x: 560, y: 100, width: T, height: 320 },
    // Right wall of chimney (60px gap)
    { x: 652, y: 100, width: T, height: 320 },
    // Chimney floor to stand on before climbing
    { x: 560, y: 420, width: 124, height: T },

    // === Right tall wall ===
    { x: 860, y: 120, width: T, height: 300 },

    // === Boundary walls (left and right edges) ===
    { x: -T, y: 0, width: T, height: 600 },
    { x: 960, y: 0, width: T, height: 600 },

    // === Ceiling ===
    { x: 0, y: -T, width: 960, height: T },

    // === Pit walls (the small pit in the floor) ===
    // Left wall of pit
    { x: 360, y: 420, width: T, height: 120 },
    // Right wall of pit
    { x: 388, y: 420, width: T, height: 120 },
    // Pit floor (bottom)
    { x: 360, y: 540, width: 60, height: T },
  ]);
}

/** Internal type for passing overlay ref through the engine */
interface EngineWithOverlayRef extends Engine {
  __showOverlaysRef?: { current: boolean };
}

export default function WallMechanicsTest() {
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
      player.wallSide = 0;
      player.wallJumpLockoutTimer = 0;
      player.wallCoyoteTimer = 0;
      player.canWallCoyoteJump = false;
      player.wallStickTimer = 0;
    }
  }, []);

  const handleMount = useCallback((ctx: CanvasRenderingContext2D) => {
    const engine = new Engine({ ctx });
    const camera = engine.getCamera();
    const tileMap = createTestLevel();
    const player = new Player();
    player.position.x = SPAWN_X;
    player.position.y = SPAWN_Y;
    player.input = engine.getInput();
    player.tileMap = tileMap;

    engine.getEntities().add(player);

    engineRef.current = engine;
    playerRef.current = player;

    // Camera follows player with smooth tracking
    engine.onUpdate((_dt) => {
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
      }

      // Center camera on player
      const targetX = player.position.x + player.size.x / 2;
      const targetY = player.position.y + player.size.y / 2;
      const smoothing = 0.1;
      camera.position.x += (targetX - camera.position.x) * smoothing;
      camera.position.y += (targetY - camera.position.y) * smoothing;
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

      // Wall contact indicators (magenta bars on the side touching the wall)
      if (player.tileMap) {
        const wallColor = "#ec4899"; // magenta
        if (player.tileMap.isTouchingWall(player, 1)) {
          // Right wall: bar on right edge
          renderer.fillRect(pos.x + player.size.x, pos.y + 2, 3, player.size.y - 4, wallColor);
        }
        if (player.tileMap.isTouchingWall(player, -1)) {
          // Left wall: bar on left edge
          renderer.fillRect(pos.x - 3, pos.y + 2, 3, player.size.y - 4, wallColor);
        }
      }

      // Wall-slide friction indicator: show current slide speed vs max
      if (state === "WALL_SLIDING") {
        const maxSpeed = player.params.wallSlideBaseSpeed;
        const currentSpeed = Math.abs(player.velocity.y);
        const ratio = Math.min(currentSpeed / maxSpeed, 1);
        const barWidth = 24;
        const barX = pos.x + player.size.x / 2 - barWidth / 2;
        const barY = pos.y + player.size.y + 8;
        renderer.fillRect(barX, barY, barWidth, 3, "rgba(100, 100, 100, 0.5)");
        renderer.fillRect(barX, barY, barWidth * ratio, 3, "#2dd4bf");
      }

      // Wall-jump lockout indicator (red bar that shrinks)
      if (player.wallJumpLockoutTimer > 0) {
        const maxLockout = player.params.wallJumpLockoutFrames;
        const ratio = player.wallJumpLockoutTimer / maxLockout;
        const barWidth = 24;
        const barX = pos.x + player.size.x / 2 - barWidth / 2;
        const barY = pos.y - 14;
        renderer.fillRect(barX, barY, barWidth, 3, "rgba(100, 100, 100, 0.5)");
        renderer.fillRect(barX, barY, barWidth * ratio, 3, "#ef4444");
      }

      // Wall coyote indicator (orange bar when active)
      if (player.canWallCoyoteJump && player.wallCoyoteTimer <= player.params.wallJumpCoyoteFrames) {
        const remaining = 1 - player.wallCoyoteTimer / player.params.wallJumpCoyoteFrames;
        const barWidth = 20;
        const barX = pos.x + player.size.x / 2 - barWidth / 2;
        const barY = pos.y + player.size.y + 14;
        renderer.fillRect(barX, barY, barWidth, 3, "rgba(100, 100, 100, 0.5)");
        renderer.fillRect(barX, barY, barWidth * remaining, 3, "#f97316");
      }

      // Coyote time indicator (ground coyote)
      if (player.canCoyoteJump && player.coyoteTimer <= player.params.coyoteFrames) {
        const remaining = 1 - player.coyoteTimer / player.params.coyoteFrames;
        const barWidth = 20;
        const barX = pos.x + player.size.x / 2 - barWidth / 2;
        const barY = pos.y + player.size.y + 8;
        renderer.fillRect(barX, barY, barWidth, 3, "rgba(100, 100, 100, 0.5)");
        renderer.fillRect(barX, barY, barWidth * remaining, 3, "#fbbf24");
      }

      // Apex float indicator
      if (player.isInApexFloat && (state === "JUMPING" || state === "FALLING" || state === "WALL_JUMPING")) {
        renderer.strokeRect(
          pos.x - 2, pos.y - 2,
          player.size.x + 4, player.size.y + 4,
          "rgba(251, 191, 36, 0.6)", 2,
        );
      }
    });

    // Screen-space debug layer (FPS, velocity, wall diagnostics)
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

      // Wall diagnostics panel (bottom-left)
      const diagX = 8;
      const diagY = CANVAS_HEIGHT - 110;
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(diagX - 4, diagY - 14, 260, 120);

      ctx.fillStyle = "#a78bfa";
      ctx.font = "11px monospace";
      ctx.fillText(`State: ${player.stateMachine.getCurrentState()}`, diagX, diagY);
      ctx.fillText(`Grounded: ${player.grounded ? "YES" : "NO"}`, diagX, diagY + 14);

      const wallSideLabel = player.wallSide === -1 ? "L" : player.wallSide === 1 ? "R" : "None";
      ctx.fillText(`Wall side: ${wallSideLabel}`, diagX, diagY + 28);
      ctx.fillText(`Lockout: ${player.wallJumpLockoutTimer}f`, diagX, diagY + 42);
      ctx.fillText(`Stick: ${player.wallStickTimer}f`, diagX, diagY + 56);
      ctx.fillText(`Wall coyote: ${player.canWallCoyoteJump ? `${player.params.wallJumpCoyoteFrames - player.wallCoyoteTimer}f` : "N/A"}`, diagX, diagY + 70);
      ctx.fillText(`Coyote: ${player.canCoyoteJump ? `${player.params.coyoteFrames - player.coyoteTimer}f` : "N/A"}`, diagX, diagY + 84);
      ctx.fillText(`Jump held: ${player.jumpHeld ? "YES" : "NO"}`, diagX, diagY + 98);
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
          Wall Mechanics
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
            Slide down walls at controlled speed &middot; Hold toward wall = slower grip &middot;
            Wall-slide stops at ground &middot; Wall-jump launches at fixed angle &middot;
            Brief input lockout prevents re-stick &middot; Normal air control after lockout &middot;
            Chain wall-jumps between parallel walls &middot; Climb chimney corridor &middot;
            Wall coyote time &middot; No wall-slide when jumping upward &middot;
            All sliders update live &middot; Ground movement still works
          </div>
        </div>

        {/* Debug panel */}
        <DebugPanel title="Wall Mechanics">
          {/* Ground Movement */}
          <details open>
            <summary className="text-xs font-mono text-zinc-500 uppercase tracking-wider cursor-pointer select-none">
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
            </div>
          </details>

          {/* Jumping */}
          <details open>
            <summary className="text-xs font-mono text-amber-500/80 uppercase tracking-wider cursor-pointer select-none pt-2">
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
                label="Apex Gravity Mult"
                value={params.apexGravityMultiplier}
                min={0.1} max={0.8} step={0.05}
                onChange={(v) => updateParam("apexGravityMultiplier", v)}
              />
              <Slider
                label="Max Fall Speed"
                value={params.maxFallSpeed}
                min={200} max={1200} step={50}
                onChange={(v) => updateParam("maxFallSpeed", v)}
              />
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
            </div>
          </details>

          {/* Wall Mechanics */}
          <details open>
            <summary className="text-xs font-mono text-teal-400 uppercase tracking-wider cursor-pointer select-none pt-2">
              Wall Mechanics
            </summary>
            <div className="flex flex-col gap-4 pt-2">
              <Slider
                label="Wall Slide Base Speed"
                value={params.wallSlideBaseSpeed}
                min={20} max={300} step={10}
                onChange={(v) => updateParam("wallSlideBaseSpeed", v)}
              />
              <Slider
                label="Wall Slide Grip Speed"
                value={params.wallSlideGripSpeed}
                min={5} max={150} step={5}
                onChange={(v) => updateParam("wallSlideGripSpeed", v)}
              />
              <Slider
                label="Wall Slide Accel"
                value={params.wallSlideAcceleration}
                min={200} max={2000} step={50}
                onChange={(v) => updateParam("wallSlideAcceleration", v)}
              />
              <Slider
                label="Wall Jump H Speed"
                value={params.wallJumpHorizontalSpeed}
                min={100} max={500} step={10}
                onChange={(v) => updateParam("wallJumpHorizontalSpeed", v)}
              />
              <Slider
                label="Wall Jump V Speed"
                value={params.wallJumpVerticalSpeed}
                min={150} max={500} step={10}
                onChange={(v) => updateParam("wallJumpVerticalSpeed", v)}
              />
              <Slider
                label="Wall Jump Lockout"
                value={params.wallJumpLockoutFrames}
                min={0} max={20} step={1}
                onChange={(v) => updateParam("wallJumpLockoutFrames", v)}
              />
              <Slider
                label="Wall Jump Coyote"
                value={params.wallJumpCoyoteFrames}
                min={0} max={15} step={1}
                onChange={(v) => updateParam("wallJumpCoyoteFrames", v)}
              />
              <Slider
                label="Wall Stick Frames"
                value={params.wallStickFrames}
                min={0} max={10} step={1}
                onChange={(v) => updateParam("wallStickFrames", v)}
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
