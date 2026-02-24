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
 * Test level geometry optimized for dash testing.
 *
 * Layout:
 * - Floor A: wide platform for ground dash
 * - Floor B: short platform for ground-to-air dash
 * - Dash gap: ~200px gap requiring jump + dash to cross
 * - Floor C: landing after gap
 * - Floor D: wide platform continuing right
 * - Left/Right tall walls for wall-dash combos
 * - Floating platform reachable with jump + upward dash
 * - Low obstacles for dash distance testing
 * - Ceiling section for downward dash / crouch-dash testing
 */
function createTestLevel(): TileMap {
  return new TileMap([
    // === Floor A: wide ground platform (x: 0-250) ===
    { x: 0, y: 420, width: 250, height: T },

    // === Floor B: short platform (x: 270-370) ===
    { x: 270, y: 420, width: 100, height: T },

    // === Dash gap: 200px from 370 to 570 (requires jump + dash) ===

    // === Floor C: landing platform (x: 570-680) ===
    { x: 570, y: 420, width: 110, height: T },

    // === Floor D: wide platform (x: 700-960) ===
    { x: 700, y: 420, width: 260, height: T },

    // === Left tall wall (for wall-dash combo testing) ===
    { x: 20, y: 140, width: T, height: 280 },

    // === Right tall wall ===
    { x: 908, y: 140, width: T, height: 280 },

    // === Floating platform (reachable with jump + upward dash) ===
    // Above the center area, at y=220, ~120px wide
    { x: 400, y: 220, width: 120, height: T / 2 },

    // === Low obstacles for dash distance testing ===
    // Small blocks on Floor A
    { x: 160, y: 388, width: T, height: T },
    // Small block on Floor D
    { x: 780, y: 388, width: T, height: T },

    // === Ceiling section (low ceiling for crouch-dash testing) ===
    // Low ceiling over Floor D right section
    { x: 820, y: 360, width: 140, height: T / 2 },

    // === Boundary walls (left and right edges) ===
    { x: -T, y: 0, width: T, height: 600 },
    { x: 960, y: 0, width: T, height: 600 },

    // === Ceiling ===
    { x: 0, y: -T, width: 960, height: T },

    // === Pit floor below the dash gap (catchment) ===
    { x: 370, y: 540, width: 200, height: T },
  ]);
}

/** Internal type for passing overlay ref through the engine */
interface EngineWithOverlayRef extends Engine {
  __showOverlaysRef?: { current: boolean };
}

export default function DashTest() {
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
      // Reset dash state
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
        player.dashCooldownTimer = 0;
        player.dashAvailable = true;
        player.isDashing = false;
        player.isInDashWindup = false;
        player.dashTrailPositions = [];
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

      // Hitbox outline — white flash during i-frames, cyan normally
      const hitboxColor = player.isDashing ? "#ffffff" : COLORS.debug.hitbox;
      const hitboxWidth = player.isDashing ? 2 : 1;
      renderer.strokeRect(pos.x, pos.y, player.size.x, player.size.y, hitboxColor, hitboxWidth);

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

      // Dash direction indicator (magenta arrow during dash)
      if (state === "DASHING" && (player.isDashing || player.isInDashWindup)) {
        const dashLen = 40;
        const ddx = player.dashDirection.x * dashLen;
        const ddy = player.dashDirection.y * dashLen;
        renderer.drawLine(cx, cy, cx + ddx, cy + ddy, "#ec4899", 3);
        const dAngle = Math.atan2(ddy, ddx);
        const dHeadLen = 8;
        renderer.drawLine(
          cx + ddx, cy + ddy,
          cx + ddx - dHeadLen * Math.cos(dAngle - 0.4),
          cy + ddy - dHeadLen * Math.sin(dAngle - 0.4),
          "#ec4899", 3,
        );
        renderer.drawLine(
          cx + ddx, cy + ddy,
          cx + ddx - dHeadLen * Math.cos(dAngle + 0.4),
          cy + ddy - dHeadLen * Math.sin(dAngle + 0.4),
          "#ec4899", 3,
        );
      }

      // Dash distance marker (thin line to projected end position)
      if (state === "DASHING" && player.isDashing) {
        const remainingDist = player.params.dashSpeed * (player.dashTimer / 60);
        const endX = pos.x + player.size.x / 2 + player.dashDirection.x * remainingDist;
        const endY = pos.y + player.size.y / 2 + player.dashDirection.y * remainingDist;
        renderer.drawLine(cx, cy, endX, endY, "rgba(236, 72, 153, 0.3)", 1);
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

      // Wall contact indicators (magenta bars)
      if (player.tileMap) {
        const wallColor = "#ec4899";
        if (player.tileMap.isTouchingWall(player, 1)) {
          renderer.fillRect(pos.x + player.size.x, pos.y + 2, 3, player.size.y - 4, wallColor);
        }
        if (player.tileMap.isTouchingWall(player, -1)) {
          renderer.fillRect(pos.x - 3, pos.y + 2, 3, player.size.y - 4, wallColor);
        }
      }

      // Dash cooldown indicator (bar below player)
      {
        const barWidth = 24;
        const barX = pos.x + player.size.x / 2 - barWidth / 2;
        const barY = pos.y + player.size.y + 8;
        if (player.dashCooldownTimer > 0) {
          const ratio = 1 - player.dashCooldownTimer / player.params.dashCooldownFrames;
          renderer.fillRect(barX, barY, barWidth, 3, "rgba(100, 100, 100, 0.5)");
          renderer.fillRect(barX, barY, barWidth * ratio, 3, "#6b7280");
        } else if (player.dashAvailable) {
          renderer.fillRect(barX, barY, barWidth, 3, "#4ade80");
        }
      }

      // Speed boost indicator (orange bar when active)
      if (player.dashSpeedBoostRemaining > 1.0) {
        const boostDenom = player.params.dashSpeedBoost - 1.0;
        const boostRatio = boostDenom > 0 ? (player.dashSpeedBoostRemaining - 1.0) / boostDenom : 0;
        const barWidth = 24;
        const barX = pos.x + player.size.x / 2 - barWidth / 2;
        const barY = pos.y + player.size.y + 14;
        renderer.fillRect(barX, barY, barWidth, 3, "rgba(100, 100, 100, 0.5)");
        renderer.fillRect(barX, barY, barWidth * boostRatio, 3, "#f97316");
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

      // Coyote time indicator
      if (player.canCoyoteJump && player.coyoteTimer <= player.params.coyoteFrames) {
        const remaining = 1 - player.coyoteTimer / player.params.coyoteFrames;
        const barWidth = 20;
        const barX = pos.x + player.size.x / 2 - barWidth / 2;
        const barY = pos.y + player.size.y + 20;
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

      // Wind-up indicator (white outline flash)
      if (player.isInDashWindup) {
        renderer.strokeRect(
          pos.x - 3, pos.y - 3,
          player.size.x + 6, player.size.y + 6,
          "rgba(255, 255, 255, 0.8)", 2,
        );
      }
    });

    // Screen-space debug layer (FPS, velocity, dash diagnostics)
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

      // Dash diagnostics panel (bottom-left)
      const diagX = 8;
      const diagY = CANVAS_HEIGHT - 140;
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(diagX - 4, diagY - 14, 280, 150);

      ctx.fillStyle = "#a78bfa";
      ctx.font = "11px monospace";
      ctx.fillText(`State: ${player.stateMachine.getCurrentState()}`, diagX, diagY);
      ctx.fillText(`Grounded: ${player.grounded ? "YES" : "NO"}`, diagX, diagY + 14);

      const wallSideLabel = player.wallSide === -1 ? "L" : player.wallSide === 1 ? "R" : "None";
      ctx.fillText(`Wall side: ${wallSideLabel}`, diagX, diagY + 28);
      ctx.fillText(`Lockout: ${player.wallJumpLockoutTimer}f`, diagX, diagY + 42);

      // Dash-specific diagnostics
      ctx.fillStyle = "#f472b6";
      const dashStatus = player.dashAvailable ? "AVAILABLE" : player.dashCooldownTimer > 0 ? "COOLDOWN" : "USED";
      ctx.fillText(`Dash: ${dashStatus}`, diagX, diagY + 62);
      ctx.fillText(`Cooldown: ${player.dashCooldownTimer}f`, diagX, diagY + 76);
      ctx.fillText(`Speed boost: ${player.dashSpeedBoostRemaining > 1 ? player.dashSpeedBoostRemaining.toFixed(2) + "x" : "none"}`, diagX, diagY + 90);
      ctx.fillText(`Dash dir: (${player.dashDirection.x.toFixed(2)}, ${player.dashDirection.y.toFixed(2)})`, diagX, diagY + 104);
      ctx.fillText(`I-frames: ${player.isDashing ? "YES" : "NO"}`, diagX, diagY + 118);
      ctx.fillText(`Windup: ${player.isInDashWindup ? "YES" : "NO"}`, diagX, diagY + 132);
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
          Dash
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
            8-dir + neutral dash &middot; Wind-up freeze frame &middot;
            Fixed distance regardless of starting velocity &middot; No gravity during dash &middot;
            Dash-cancel from idle/run/jump/fall/wall-slide/crouch/slide &middot;
            No dash during wall-jump lockout or another dash &middot;
            Ground dash + hold fwd = speed boost &middot; Boost decays smoothly &middot;
            Cooldown prevents spam &middot; Air dash preserves momentum &middot;
            Wall collision stops dash &middot; Down-dash lands &middot;
            Ghost trail visible &middot; All sliders tune live &middot;
            Existing mechanics unaffected
          </div>
        </div>

        {/* Debug panel */}
        <DebugPanel title="Dash">
          {/* Ground Movement */}
          <details>
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
          <details>
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
          <details>
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

          {/* Dash */}
          <details open>
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
                label="Dash Windup"
                value={params.dashWindupFrames}
                min={0} max={5} step={1}
                onChange={(v) => updateParam("dashWindupFrames", v)}
              />
              <Slider
                label="Dash Cooldown"
                value={params.dashCooldownFrames}
                min={0} max={60} step={1}
                onChange={(v) => updateParam("dashCooldownFrames", v)}
              />
              <Slider
                label="Dash Speed Boost"
                value={params.dashSpeedBoost}
                min={1.0} max={2.5} step={0.05}
                onChange={(v) => updateParam("dashSpeedBoost", v)}
              />
              <Slider
                label="Dash Boost Decay"
                value={params.dashSpeedBoostDecayRate}
                min={200} max={2000} step={50}
                onChange={(v) => updateParam("dashSpeedBoostDecayRate", v)}
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
