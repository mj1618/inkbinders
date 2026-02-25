"use client";

import { useRef, useState, useCallback } from "react";
import { GameCanvas } from "@/components/canvas/GameCanvas";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { Slider } from "@/components/debug/Slider";
import { RenderModeToggle } from "@/components/debug/RenderModeToggle";
import { Engine } from "@/engine/core/Engine";
import { Player, DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";
import type { PlayerParams } from "@/engine/entities/Player";
import { TileMap } from "@/engine/physics/TileMap";
import type { Platform } from "@/engine/physics/TileMap";
import { ParticleSystem } from "@/engine/core/ParticleSystem";
import { ScreenShake } from "@/engine/core/ScreenShake";
import { RenderConfig } from "@/engine/core/RenderConfig";
import { MARITIME_LEDGER_THEME } from "@/engine/world/Biome";
import type { BiomeTheme } from "@/engine/world/Biome";
import { createMaritimeBackground } from "@/engine/world/BiomeBackground";
import { CurrentSystem, DEFAULT_CURRENT_PARAMS } from "@/engine/world/CurrentSystem";
import type { CurrentParams, CurrentZone } from "@/engine/world/CurrentSystem";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/constants";
import type { Rect, Vec2 } from "@/lib/types";
import { aabbOverlap } from "@/engine/physics/AABB";
import { getSurfaceProps } from "@/engine/physics/Surfaces";
import Link from "next/link";

// ─── Constants ──────────────────────────────────────────────────────

const LEVEL_WIDTH = 3840;
const LEVEL_HEIGHT = 1080;
const SPAWN_X = 100;
const SPAWN_Y = 880;
const RESPAWN_Y_THRESHOLD = LEVEL_HEIGHT + 200;

// ─── Goal Zones ─────────────────────────────────────────────────────

interface GoalZone {
  id: string;
  rect: Rect;
  label: string;
  reached: boolean;
}

function createGoalZones(): GoalZone[] {
  return [
    {
      id: "goal-a",
      rect: { x: 750, y: 880, width: 100, height: 60 },
      label: "Goal A: Ride the current",
      reached: false,
    },
    {
      id: "goal-b",
      rect: { x: 1750, y: 600, width: 100, height: 60 },
      label: "Goal B: Navigate currents",
      reached: false,
    },
    {
      id: "goal-c",
      rect: { x: 2600, y: 120, width: 100, height: 60 },
      label: "Goal C: Ride the gusts",
      reached: false,
    },
    {
      id: "goal-d",
      rect: { x: 3600, y: 420, width: 100, height: 60 },
      label: "Goal D: Master the whirlpool",
      reached: false,
    },
  ];
}

// ─── Current Zone Definitions ───────────────────────────────────────

function createCurrentZones(): CurrentZone[] {
  return [
    // ── Area 1: Current Introduction ──
    // Rightward stream carrying player across gap
    {
      id: "stream-intro",
      rect: { x: 350, y: 780, width: 450, height: 120 },
      direction: { x: 1, y: 0 },
      strength: 400,
      active: true,
      type: "stream",
    },

    // ── Area 2: Current Navigation ──
    // Upward jet to launch player to higher platform
    {
      id: "jet-launch-1",
      rect: { x: 1020, y: 700, width: 80, height: 200 },
      direction: { x: 0.3, y: -1 },
      strength: 900,
      active: true,
      type: "jet",
    },
    // Opposing leftward stream the player must dash through
    {
      id: "stream-opposing",
      rect: { x: 1200, y: 580, width: 300, height: 100 },
      direction: { x: -1, y: 0 },
      strength: 450,
      active: true,
      type: "stream",
    },
    // Helpful rightward stream to reach goal
    {
      id: "stream-help",
      rect: { x: 1550, y: 540, width: 250, height: 100 },
      direction: { x: 1, y: -0.3 },
      strength: 350,
      active: true,
      type: "stream",
    },

    // ── Area 3: Gust Gauntlet ──
    // Pulsing updraft gusts — vertical section
    {
      id: "gust-1",
      rect: { x: 2050, y: 600, width: 150, height: 300 },
      direction: { x: 0, y: -1 },
      strength: 600,
      active: true,
      type: "gust",
      gustOnDuration: 2.0,
      gustOffDuration: 1.5,
      gustTimer: 0,
      gustActive: true,
    },
    {
      id: "gust-2",
      rect: { x: 2250, y: 400, width: 150, height: 300 },
      direction: { x: 0, y: -1 },
      strength: 650,
      active: true,
      type: "gust",
      gustOnDuration: 2.0,
      gustOffDuration: 1.5,
      gustTimer: 0.8,
      gustActive: true,
    },
    {
      id: "gust-3",
      rect: { x: 2450, y: 200, width: 150, height: 300 },
      direction: { x: 0, y: -1 },
      strength: 550,
      active: true,
      type: "gust",
      gustOnDuration: 2.5,
      gustOffDuration: 1.2,
      gustTimer: 1.5,
      gustActive: false,
    },

    // ── Area 4: Whirlpool Traverse ──
    {
      id: "whirlpool-1",
      rect: { x: 2950, y: 400, width: 250, height: 250 },
      direction: { x: 0, y: 0 },
      strength: 350,
      active: true,
      type: "whirlpool",
      clockwise: true,
    },
    {
      id: "whirlpool-2",
      rect: { x: 3250, y: 300, width: 250, height: 250 },
      direction: { x: 0, y: 0 },
      strength: 300,
      active: true,
      type: "whirlpool",
      clockwise: false,
    },
    // Final jet launch to goal
    {
      id: "jet-final",
      rect: { x: 3500, y: 500, width: 80, height: 200 },
      direction: { x: 0.5, y: -1 },
      strength: 1000,
      active: true,
      type: "jet",
    },
  ];
}

// ─── Level Construction ─────────────────────────────────────────────

function createTestLevel(): TileMap {
  const platforms: Platform[] = [
    // ── Area 1: Current Introduction (x: 0–960) ──
    // Ground floor left
    { x: 0, y: 960, width: 350, height: 120 },
    // Landing platform after gap (current carries player here)
    { x: 700, y: 960, width: 260, height: 120 },

    // ── Area 2: Current Navigation (x: 960–1920) ──
    // Ground floor
    { x: 960, y: 960, width: 200, height: 120 },
    // Mid platform before opposing current
    { x: 1150, y: 760, width: 120, height: 20 },
    // Platform after opposing current
    { x: 1500, y: 700, width: 120, height: 20 },
    // Goal B platform
    { x: 1720, y: 680, width: 160, height: 20 },

    // ── Area 3: Gust Gauntlet (x: 1920–2880) ──
    // Ground floor
    { x: 1920, y: 960, width: 960, height: 120 },
    // Stepping platforms for gust riding
    { x: 2020, y: 840, width: 80, height: 20 },
    { x: 2100, y: 700, width: 80, height: 20 },
    { x: 2220, y: 560, width: 80, height: 20 },
    { x: 2350, y: 420, width: 80, height: 20 },
    { x: 2470, y: 300, width: 80, height: 20 },
    // Goal C platform at the top
    { x: 2570, y: 180, width: 160, height: 20 },

    // ── Area 4: Whirlpool Traverse (x: 2880–3840) ──
    // Entry platform
    { x: 2880, y: 700, width: 120, height: 20 },
    // Small rest platform between whirlpools
    { x: 3180, y: 600, width: 80, height: 20 },
    // Goal D platform
    { x: 3570, y: 480, width: 160, height: 20 },

    // ── Walls & ceiling ──
    { x: 0, y: 0, width: 20, height: LEVEL_HEIGHT },
    { x: LEVEL_WIDTH - 20, y: 0, width: 20, height: LEVEL_HEIGHT },
    { x: 0, y: 0, width: LEVEL_WIDTH, height: 20 },
  ];

  return new TileMap(platforms);
}

// ─── Biome Platform Rendering ───────────────────────────────────────

function renderBiomePlatforms(
  ctx: CanvasRenderingContext2D,
  tileMap: TileMap,
  theme: BiomeTheme,
): void {
  for (const plat of tileMap.platforms) {
    ctx.save();

    // Fill
    ctx.fillStyle = theme.platformFillColor;
    ctx.fillRect(plat.x, plat.y, plat.width, plat.height);

    // Stroke
    ctx.strokeStyle = theme.platformStrokeColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(plat.x, plat.y, plat.width, plat.height);

    // Wave-line top edge (nautical theme — not walls)
    if (plat.width > plat.height && plat.height <= 80) {
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(plat.x, plat.y);
      const waveAmp = 2;
      const waveLen = 16;
      for (let wx = 0; wx <= plat.width; wx += waveLen) {
        const wy = plat.y + Math.sin((wx / waveLen) * Math.PI * 2) * waveAmp;
        ctx.lineTo(plat.x + wx, wy);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }
}

// ─── Engine Ref Extension ───────────────────────────────────────────

interface EngineRefs extends Engine {
  __showOverlaysRef?: { current: boolean };
  __showAmbientParticlesRef?: { current: boolean };
  __showParallaxBgRef?: { current: boolean };
  __useBiomeColorsRef?: { current: boolean };
  __showCurrentDebugRef?: { current: boolean };
}

// ─── Test Page Component ────────────────────────────────────────────

export default function MaritimeLedgerTest() {
  const engineRef = useRef<Engine | null>(null);
  const playerRef = useRef<Player | null>(null);
  const currentSystemRef = useRef<CurrentSystem | null>(null);
  const goalZonesRef = useRef<GoalZone[]>(createGoalZones());

  const [showOverlays, setShowOverlays] = useState(true);
  const [params, setParams] = useState<PlayerParams>({ ...DEFAULT_PLAYER_PARAMS });
  const [currentParams, setCurrentParams] = useState<CurrentParams>({ ...DEFAULT_CURRENT_PARAMS });
  const [showAmbientParticles, setShowAmbientParticles] = useState(true);
  const [showParallaxBg, setShowParallaxBg] = useState(true);
  const [useBiomeColors, setUseBiomeColors] = useState(true);
  const [showCurrentDebug, setShowCurrentDebug] = useState(true);

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

  const updateCurrentParam = useCallback(
    <K extends keyof CurrentParams>(key: K, value: CurrentParams[K]) => {
      setCurrentParams((prev) => {
        const next = { ...prev, [key]: value };
        const cs = currentSystemRef.current;
        if (cs) {
          cs.params[key] = value;
        }
        return next;
      });
    },
    [],
  );

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

  const resetGoals = useCallback(() => {
    goalZonesRef.current = createGoalZones();
  }, []);

  // ─── Engine Mount ───────────────────────────────────────────────

  const handleMount = useCallback((ctx: CanvasRenderingContext2D) => {
    RenderConfig.setMode("rectangles");
    const engine = new Engine({ ctx });
    const camera = engine.getCamera();
    const input = engine.getInput();
    const tileMap = createTestLevel();

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

    // Current system
    const currentSystem = new CurrentSystem(createCurrentZones());

    // Biome background
    const biomeBackground = createMaritimeBackground(LEVEL_WIDTH, LEVEL_HEIGHT);

    // Biome theme
    const theme = MARITIME_LEDGER_THEME;

    engineRef.current = engine;
    playerRef.current = player;
    currentSystemRef.current = currentSystem;

    // Overlay refs
    const showOverlaysRef = { current: true };
    const showAmbientParticlesRef = { current: true };
    const showParallaxBgRef = { current: true };
    const useBiomeColorsRef = { current: true };
    const showCurrentDebugRef = { current: true };

    const engineRefs = engine as EngineRefs;
    engineRefs.__showOverlaysRef = showOverlaysRef;
    engineRefs.__showAmbientParticlesRef = showAmbientParticlesRef;
    engineRefs.__showParallaxBgRef = showParallaxBgRef;
    engineRefs.__useBiomeColorsRef = useBiomeColorsRef;
    engineRefs.__showCurrentDebugRef = showCurrentDebugRef;

    // Ambient particle accumulator
    let ambientParticleAccum = 0;

    // Track applied current force for debug display
    let lastAppliedForce: Vec2 = { x: 0, y: 0 };
    let lastOverlappingZones: CurrentZone[] = [];

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
        player.canWallCoyoteJump = false;
        player.wallStickTimer = 0;
        player.dashCooldownTimer = 0;
        player.dashAvailable = true;
        player.isDashing = false;
        player.isInDashWindup = false;
        player.dashTrailPositions = [];
      }

      // Surface physics
      const groundSurface = tileMap.getGroundSurface({
        position: player.position,
        size: player.size,
      });
      player.currentSurface = getSurfaceProps(groundSurface);

      const wallSide = player.wallSide;
      if (wallSide !== 0) {
        const wallSurface = tileMap.getWallSurface(
          { position: player.position, size: player.size },
          wallSide,
        );
        player.currentWallSurface = getSurfaceProps(wallSurface);
      }

      // Update gust timers
      currentSystem.updateGusts(dt);

      // Apply current forces AFTER player.update() but BEFORE resolveCollisions()
      const playerBounds: Rect = {
        x: player.position.x,
        y: player.position.y,
        width: player.size.x,
        height: player.size.y,
      };
      lastAppliedForce = currentSystem.applyToPlayer(
        player,
        dt,
        player.grounded,
        player.isDashing,
      );
      lastOverlappingZones = currentSystem.getOverlappingZones(playerBounds);

      // Camera follow
      camera.follow(
        {
          x: player.position.x + player.size.x / 2,
          y: player.position.y + player.size.y / 2,
        },
        player.velocity,
        dt,
      );

      // Update particles
      particleSystem.update(dt);

      // Update screen shake
      const shakeOffset = screenShake.update();
      camera.position.x += shakeOffset.offsetX;
      camera.position.y += shakeOffset.offsetY;

      // Current zone particles
      const viewport = camera.getViewportBounds();
      currentSystem.updateParticles(dt, particleSystem, viewport);

      // Ambient particles
      if (showAmbientParticlesRef.current) {
        ambientParticleAccum += theme.ambientParticleRate * dt;
        while (ambientParticleAccum >= 1) {
          ambientParticleAccum -= 1;
          particleSystem.emit({
            x: viewport.x + Math.random() * viewport.width,
            y: viewport.y - 10,
            count: 1,
            speedMin: 5,
            speedMax: 15,
            angleMin: Math.PI * 0.3,
            angleMax: Math.PI * 0.7,
            lifeMin: 3.0,
            lifeMax: 5.0,
            sizeMin: 2,
            sizeMax: 4,
            colors: theme.ambientParticleColors,
            gravity: 0,
          });
        }
      }

      // Goal zone checks
      const finalBounds: Rect = {
        x: player.position.x,
        y: player.position.y,
        width: player.size.x,
        height: player.size.y,
      };
      for (const zone of goalZonesRef.current) {
        if (!zone.reached && aabbOverlap(finalBounds, zone.rect)) {
          zone.reached = true;
        }
      }
    });

    // ─── World-Space Render Callback ─────────────────────────────

    engine.onRender((renderer, interpolation) => {
      const rCtx = renderer.getContext();

      // Clear with biome background color
      rCtx.save();
      rCtx.fillStyle = theme.backgroundColor;
      rCtx.fillRect(
        camera.position.x - CANVAS_WIDTH,
        camera.position.y - CANVAS_HEIGHT,
        CANVAS_WIDTH * 3,
        CANVAS_HEIGHT * 3,
      );
      rCtx.restore();

      // Parallax background
      if (showParallaxBgRef.current) {
        renderer.resetCamera();
        biomeBackground.render(
          rCtx,
          camera.position.x - CANVAS_WIDTH / 2,
          camera.position.y - CANVAS_HEIGHT / 2,
          CANVAS_WIDTH,
          CANVAS_HEIGHT,
        );
        renderer.applyCamera(camera);
      }

      // Draw platforms
      if (useBiomeColorsRef.current) {
        renderBiomePlatforms(rCtx, tileMap, theme);
      } else {
        tileMap.render(renderer);
      }

      // Render current flow effects (in-world)
      currentSystem.renderFlow(rCtx);

      // Render current debug overlays
      if (showCurrentDebugRef.current && showOverlaysRef.current) {
        currentSystem.renderDebug(rCtx);
      }

      // Render particles (world space)
      particleSystem.render(renderer);

      // Goal zone rendering
      for (const zone of goalZonesRef.current) {
        rCtx.save();
        rCtx.fillStyle = zone.reached
          ? "rgba(56, 189, 248, 0.3)"
          : "rgba(56, 189, 248, 0.08)";
        rCtx.fillRect(zone.rect.x, zone.rect.y, zone.rect.width, zone.rect.height);

        if (zone.reached) {
          rCtx.strokeStyle = "rgba(56, 189, 248, 0.7)";
          rCtx.lineWidth = 2;
          rCtx.strokeRect(
            zone.rect.x - 2,
            zone.rect.y - 2,
            zone.rect.width + 4,
            zone.rect.height + 4,
          );
        }

        rCtx.fillStyle = zone.reached
          ? "rgba(255,255,255,0.8)"
          : "rgba(255,255,255,0.3)";
        rCtx.font = "9px monospace";
        rCtx.textAlign = "center";
        rCtx.fillText(
          zone.label,
          zone.rect.x + zone.rect.width / 2,
          zone.rect.y - 4,
        );
        rCtx.textAlign = "left";
        rCtx.restore();
      }

      // Foreground tint
      rCtx.save();
      rCtx.fillStyle = theme.foregroundTint;
      rCtx.fillRect(
        camera.position.x - CANVAS_WIDTH,
        camera.position.y - CANVAS_HEIGHT,
        CANVAS_WIDTH * 3,
        CANVAS_HEIGHT * 3,
      );
      rCtx.restore();

      if (!showOverlaysRef.current) return;

      // Debug overlays
      const pos = player.getInterpolatedPosition(interpolation);
      const state = player.stateMachine.getCurrentState();

      // Player hitbox
      renderer.strokeRect(pos.x, pos.y, player.size.x, player.size.y, "#22d3ee", 1);

      // Velocity vector
      const cx = pos.x + player.size.x / 2;
      const cy = pos.y + player.size.y / 2;
      const vScale = 0.15;
      const vx = player.velocity.x * vScale;
      const vy = player.velocity.y * vScale;
      if (Math.abs(vx) > 1 || Math.abs(vy) > 1) {
        renderer.drawLine(cx, cy, cx + vx, cy + vy, "#f59e0b", 2);
      }

      // Current force vector (cyan)
      if (Math.abs(lastAppliedForce.x) > 1 || Math.abs(lastAppliedForce.y) > 1) {
        const forceScale = 0.05;
        renderer.drawLine(
          cx, cy,
          cx + lastAppliedForce.x * forceScale,
          cy + lastAppliedForce.y * forceScale,
          "#0ea5e9", 2,
        );
      }

      // State label
      const inCurrent = lastOverlappingZones.length > 0;
      const stateText = inCurrent ? `${state} [CURRENT]` : state;
      renderer.drawText(stateText, pos.x, pos.y - 8, "#a78bfa", 10);

      // Ground contact indicator
      if (player.grounded) {
        renderer.drawCircle(
          pos.x + player.size.x / 2,
          pos.y + player.size.y + 3,
          3,
          "#4ade80",
        );
      }

      // Biome name label
      rCtx.save();
      rCtx.globalAlpha = 0.15;
      rCtx.fillStyle = "#38bdf8";
      rCtx.font = "bold 24px monospace";
      rCtx.fillText("MARITIME LEDGER", 60, 60);
      rCtx.restore();
    });

    // ─── Screen-Space Debug Layer ──────────────────────────────

    const debugLayerCallback = (debugCtx: CanvasRenderingContext2D) => {
      if (!showOverlaysRef.current) return;

      const metrics = engine.getMetrics();

      // FPS counter
      debugCtx.fillStyle = "#38bdf8";
      debugCtx.font = "12px monospace";
      debugCtx.fillText(`FPS: ${Math.round(metrics.fps)}`, 8, 16);

      // Biome label
      debugCtx.fillStyle = "#7dd3fc";
      debugCtx.fillText("Maritime Ledger", 8, 32);

      // Velocity readout
      debugCtx.fillStyle = "#f59e0b";
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

      // Diagnostics (bottom-left)
      const diagX = 8;
      const diagY = CANVAS_HEIGHT - 160;
      debugCtx.fillStyle = "rgba(0, 0, 0, 0.6)";
      debugCtx.fillRect(diagX - 4, diagY - 14, 300, 170);

      debugCtx.fillStyle = "#a78bfa";
      debugCtx.font = "11px monospace";
      debugCtx.fillText(
        `State: ${player.stateMachine.getCurrentState()}`,
        diagX, diagY,
      );
      debugCtx.fillText(
        `Pos: (${Math.round(player.position.x)}, ${Math.round(player.position.y)})`,
        diagX, diagY + 14,
      );
      debugCtx.fillText(
        `Vel: (${Math.round(player.velocity.x)}, ${Math.round(player.velocity.y)})`,
        diagX, diagY + 28,
      );
      debugCtx.fillText(
        `Grounded: ${player.grounded ? "YES" : "NO"}`,
        diagX, diagY + 42,
      );
      debugCtx.fillText(
        `Dashing: ${player.isDashing ? "YES" : "NO"}`,
        diagX, diagY + 56,
      );

      // Current info
      debugCtx.fillStyle = "#38bdf8";
      const inCurrent = lastOverlappingZones.length > 0;
      debugCtx.fillText(
        `In Current: ${inCurrent ? "YES" : "NO"}`,
        diagX, diagY + 74,
      );

      if (inCurrent) {
        debugCtx.fillText(
          `Zones: ${lastOverlappingZones.map((z) => z.id).join(", ")}`,
          diagX, diagY + 88,
        );
        debugCtx.fillText(
          `Force: (${Math.round(lastAppliedForce.x)}, ${Math.round(lastAppliedForce.y)})`,
          diagX, diagY + 102,
        );
      }

      // Current force HUD indicator (top center)
      if (inCurrent) {
        const hudX = CANVAS_WIDTH / 2;
        const hudY = 30;
        debugCtx.save();
        debugCtx.fillStyle = "rgba(0, 0, 0, 0.5)";
        debugCtx.fillRect(hudX - 60, hudY - 12, 120, 24);
        debugCtx.fillStyle = "#38bdf8";
        debugCtx.font = "10px monospace";
        debugCtx.textAlign = "center";

        // Direction arrow character
        const fx = lastAppliedForce.x;
        const fy = lastAppliedForce.y;
        let arrow = "\u2192"; // right
        if (Math.abs(fy) > Math.abs(fx)) {
          arrow = fy < 0 ? "\u2191" : "\u2193";
        } else if (fx < 0) {
          arrow = "\u2190";
        }
        const forceMag = Math.round(Math.sqrt(fx * fx + fy * fy));
        debugCtx.fillText(`${arrow} ${forceMag} px/s\u00b2`, hudX, hudY + 4);
        debugCtx.textAlign = "left";
        debugCtx.restore();
      }

      // Goal status (bottom-right)
      debugCtx.textAlign = "right";
      debugCtx.font = "11px monospace";
      const goals = goalZonesRef.current;
      const goalY = CANVAS_HEIGHT - 60;
      for (let i = 0; i < goals.length; i++) {
        const g = goals[i];
        debugCtx.fillStyle = g.reached ? "#4ade80" : "#64748b";
        debugCtx.fillText(
          `${g.reached ? "\u2713" : "\u2610"} ${g.label}`,
          CANVAS_WIDTH - 8,
          goalY + i * 14,
        );
      }
      debugCtx.textAlign = "left";
    };
    engine.getRenderer().addLayerCallback("debug", debugLayerCallback);

    // Initial camera position
    camera.snapTo({
      x: player.position.x + player.size.x / 2,
      y: player.position.y + player.size.y / 2,
    });

    engine.start();
  }, []);

  const handleUnmount = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    playerRef.current = null;
    currentSystemRef.current = null;
  }, []);

  // ─── Toggle callbacks ─────────────────────────────────────────

  const toggleOverlays = useCallback(() => {
    setShowOverlays((prev) => {
      const next = !prev;
      const e = engineRef.current as EngineRefs | null;
      if (e?.__showOverlaysRef) e.__showOverlaysRef.current = next;
      return next;
    });
  }, []);

  const toggleAmbientParticles = useCallback(() => {
    setShowAmbientParticles((prev) => {
      const next = !prev;
      const e = engineRef.current as EngineRefs | null;
      if (e?.__showAmbientParticlesRef) e.__showAmbientParticlesRef.current = next;
      return next;
    });
  }, []);

  const toggleParallaxBg = useCallback(() => {
    setShowParallaxBg((prev) => {
      const next = !prev;
      const e = engineRef.current as EngineRefs | null;
      if (e?.__showParallaxBgRef) e.__showParallaxBgRef.current = next;
      return next;
    });
  }, []);

  const toggleBiomeColors = useCallback(() => {
    setUseBiomeColors((prev) => {
      const next = !prev;
      const e = engineRef.current as EngineRefs | null;
      if (e?.__useBiomeColorsRef) e.__useBiomeColorsRef.current = next;
      return next;
    });
  }, []);

  const toggleCurrentDebug = useCallback(() => {
    setShowCurrentDebug((prev) => {
      const next = !prev;
      const e = engineRef.current as EngineRefs | null;
      if (e?.__showCurrentDebugRef) e.__showCurrentDebugRef.current = next;
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
        <h1 className="font-mono text-sm font-bold text-sky-400">
          Maritime Ledger
        </h1>
        <span className="rounded bg-sky-500/20 px-2 py-0.5 text-xs font-mono text-sky-300">
          Phase 5 — Content
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
            Current push works &middot; Air current affects airborne player
            &middot; Grounded reduction visible &middot; Dash override works
            &middot; Ramp up smooth entry &middot; Gust pulsing on/off
            &middot; Gust telegraph visible &middot; Whirlpool curved path
            &middot; Jet launch boost &middot; Flow visualization arrows
            &middot; Goal A (ride current) &middot; Goal B (navigate)
            &middot; Goal C (ride gusts) &middot; Goal D (whirlpool)
            &middot; All sliders work
          </div>

          {/* Controls legend */}
          <div className="w-[960px] text-xs font-mono text-zinc-600 leading-relaxed">
            <span className="text-zinc-500">Controls: </span>
            Arrows = Move &middot; Z/Space = Jump &middot; X/Shift = Dash
          </div>
        </div>

        {/* Debug panel */}
        <DebugPanel title="Maritime Ledger">
          <RenderModeToggle />
          {/* Biome Info */}
          <div className="border-b border-zinc-800 pb-2 mb-2">
            <div className="text-xs font-mono text-sky-400 uppercase tracking-wider mb-1">
              Biome Info
            </div>
            <div className="text-xs font-mono text-zinc-400 space-y-0.5">
              <div>
                Biome: <span className="text-zinc-200">Maritime Ledger</span>
              </div>
            </div>
          </div>

          {/* Current Params */}
          <details open>
            <summary className="text-xs font-mono text-sky-400 uppercase tracking-wider cursor-pointer select-none">
              Current Params
            </summary>
            <div className="flex flex-col gap-4 pt-2">
              <Slider
                label="Global Strength"
                value={currentParams.globalStrengthMultiplier}
                min={0.0}
                max={3.0}
                step={0.1}
                onChange={(v) => updateCurrentParam("globalStrengthMultiplier", v)}
              />
              <Slider
                label="Grounded Multiplier"
                value={currentParams.groundedMultiplier}
                min={0.0}
                max={1.0}
                step={0.05}
                onChange={(v) => updateCurrentParam("groundedMultiplier", v)}
              />
              <Slider
                label="Max Current Velocity"
                value={currentParams.maxCurrentVelocity}
                min={100}
                max={1000}
                step={50}
                onChange={(v) => updateCurrentParam("maxCurrentVelocity", v)}
              />
              <Slider
                label="Ramp Up Rate"
                value={currentParams.rampUpRate}
                min={0.01}
                max={1.0}
                step={0.01}
                onChange={(v) => updateCurrentParam("rampUpRate", v)}
              />
              <Slider
                label="Particle Density"
                value={currentParams.particleDensity}
                min={0.0}
                max={3.0}
                step={0.1}
                onChange={(v) => updateCurrentParam("particleDensity", v)}
              />
              <button
                onClick={() =>
                  updateCurrentParam("affectsGrounded", !currentParams.affectsGrounded)
                }
                className={`rounded px-3 py-1 text-xs font-mono transition-colors ${
                  currentParams.affectsGrounded
                    ? "bg-sky-500/20 text-sky-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Affects Grounded: {currentParams.affectsGrounded ? "ON" : "OFF"}
              </button>
              <button
                onClick={() =>
                  updateCurrentParam("dashOverridesCurrent", !currentParams.dashOverridesCurrent)
                }
                className={`rounded px-3 py-1 text-xs font-mono transition-colors ${
                  currentParams.dashOverridesCurrent
                    ? "bg-sky-500/20 text-sky-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Dash Overrides Current: {currentParams.dashOverridesCurrent ? "ON" : "OFF"}
              </button>
            </div>
          </details>

          {/* Player Movement */}
          <details>
            <summary className="text-xs font-mono text-zinc-500 uppercase tracking-wider cursor-pointer select-none pt-2">
              Player Movement
            </summary>
            <div className="flex flex-col gap-4 pt-2">
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
                label="Jump Speed"
                value={params.jumpSpeed}
                min={200}
                max={600}
                step={10}
                onChange={(v) => updateParam("jumpSpeed", v)}
              />
              <Slider
                label="Dash Speed"
                value={params.dashSpeed}
                min={200}
                max={1200}
                step={25}
                onChange={(v) => updateParam("dashSpeed", v)}
              />
            </div>
          </details>

          {/* Visual Settings */}
          <details>
            <summary className="text-xs font-mono text-zinc-500 uppercase tracking-wider cursor-pointer select-none pt-2">
              Visual Settings
            </summary>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={toggleAmbientParticles}
                className={`rounded px-3 py-1 text-xs font-mono transition-colors ${
                  showAmbientParticles
                    ? "bg-sky-500/20 text-sky-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Ambient Particles: {showAmbientParticles ? "ON" : "OFF"}
              </button>
              <button
                onClick={toggleParallaxBg}
                className={`rounded px-3 py-1 text-xs font-mono transition-colors ${
                  showParallaxBg
                    ? "bg-sky-500/20 text-sky-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Parallax Background: {showParallaxBg ? "ON" : "OFF"}
              </button>
              <button
                onClick={toggleBiomeColors}
                className={`rounded px-3 py-1 text-xs font-mono transition-colors ${
                  useBiomeColors
                    ? "bg-sky-500/20 text-sky-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Biome Colors: {useBiomeColors ? "ON" : "OFF"}
              </button>
              <button
                onClick={toggleCurrentDebug}
                className={`rounded px-3 py-1 text-xs font-mono transition-colors ${
                  showCurrentDebug
                    ? "bg-sky-500/20 text-sky-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Current Debug Zones: {showCurrentDebug ? "ON" : "OFF"}
              </button>
            </div>
          </details>

          {/* Controls */}
          <details open>
            <summary className="text-xs font-mono text-sky-500/80 uppercase tracking-wider cursor-pointer select-none pt-2">
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
                onClick={resetGoals}
                className="w-full rounded bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Reset Goals
              </button>
              <button
                onClick={() => {
                  const player = playerRef.current;
                  if (player) {
                    player.position.x = 2000;
                    player.position.y = 900;
                    player.velocity.x = 0;
                    player.velocity.y = 0;
                    engineRef.current?.getCamera().snapTo({
                      x: player.position.x + player.size.x / 2,
                      y: player.position.y + player.size.y / 2,
                    });
                  }
                }}
                className="w-full rounded bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Teleport to Area 3 (Gusts)
              </button>
              <button
                onClick={() => {
                  const player = playerRef.current;
                  if (player) {
                    player.position.x = 2900;
                    player.position.y = 660;
                    player.velocity.x = 0;
                    player.velocity.y = 0;
                    engineRef.current?.getCamera().snapTo({
                      x: player.position.x + player.size.x / 2,
                      y: player.position.y + player.size.y / 2,
                    });
                  }
                }}
                className="w-full rounded bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Teleport to Area 4 (Whirlpools)
              </button>
              <button
                onClick={toggleOverlays}
                className={`w-full rounded px-3 py-1.5 text-xs font-mono transition-colors ${
                  showOverlays
                    ? "bg-sky-500/20 text-sky-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Debug Overlays: {showOverlays ? "ON" : "OFF"}
              </button>
            </div>
          </details>
        </DebugPanel>
      </div>
    </div>
  );
}
