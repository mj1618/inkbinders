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
import { InputAction } from "@/engine/input/InputManager";
import { GOTHIC_ERRATA_THEME } from "@/engine/world/Biome";
import type { BiomeTheme } from "@/engine/world/Biome";
import { createGothicErrataBackground } from "@/engine/world/BiomeBackground";
import {
  FogSystem,
  DEFAULT_FOG_SYSTEM_PARAMS,
} from "@/engine/world/FogSystem";
import type { FogSystemParams, FogState } from "@/engine/world/FogSystem";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/constants";
import type { Rect } from "@/lib/types";
import { aabbOverlap } from "@/engine/physics/AABB";
import { getSurfaceProps } from "@/engine/physics/Surfaces";
import Link from "next/link";

// ─── Constants ──────────────────────────────────────────────────────

const LEVEL_WIDTH = 3200;
const LEVEL_HEIGHT = 1080;
const SPAWN_X = 100;
const SPAWN_Y = 900;
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
      rect: { x: 700, y: 560, width: 80, height: 60 },
      label: "Goal A: Navigate the fog",
      reached: false,
    },
    {
      id: "goal-b",
      rect: { x: 1450, y: 360, width: 80, height: 60 },
      label: "Goal B: Master the mirror",
      reached: false,
    },
    {
      id: "goal-c",
      rect: { x: 2250, y: 260, width: 80, height: 60 },
      label: "Goal C: Decode the scramble",
      reached: false,
    },
    {
      id: "goal-d",
      rect: { x: 3050, y: 200, width: 80, height: 60 },
      label: "Goal D: Combined gauntlet",
      reached: false,
    },
  ];
}

// ─── Level Construction ─────────────────────────────────────────────

function createTestLevel(): TileMap {
  const platforms: Platform[] = [
    // === Area 1 — Fog Introduction (x: 0–800) ===

    // Ground floor left
    { x: 0, y: 960, width: 400, height: 80 },
    // Landing platform right of fog
    { x: 680, y: 960, width: 200, height: 80 },

    // Platforms inside fog zone (wide for blind navigation)
    { x: 220, y: 820, width: 180, height: 20 },
    { x: 400, y: 700, width: 200, height: 20 },
    { x: 260, y: 580, width: 180, height: 20 },
    { x: 500, y: 480, width: 200, height: 20 },

    // Goal A platform
    { x: 680, y: 620, width: 120, height: 20 },

    // === Safe zone between Area 1 and 2 (x: 780–860) ===
    { x: 780, y: 960, width: 80, height: 80 },

    // === Area 2 — Inversion Challenge (x: 860–1600) ===

    // Entry platform
    { x: 860, y: 900, width: 160, height: 20 },
    // Zigzag platforms (alternating left-right jumps)
    { x: 1000, y: 780, width: 120, height: 20 },
    { x: 880, y: 660, width: 120, height: 20 },
    { x: 1050, y: 540, width: 120, height: 20 },
    { x: 900, y: 420, width: 120, height: 20 },
    // Goal B platform
    { x: 1400, y: 420, width: 140, height: 20 },
    // High shortcut
    { x: 1200, y: 340, width: 100, height: 20 },
    // Wall (right boundary for safety)
    { x: 1540, y: 300, width: 20, height: 700 },

    // === Safe zone between Area 2 and 3 (x: 1560–1650) ===
    { x: 1560, y: 960, width: 100, height: 80 },
    { x: 1560, y: 800, width: 100, height: 20 },

    // === Area 3 — Scramble Maze (x: 1650–2400) ===

    // Wide platforms (forgiving for scrambled controls)
    { x: 1670, y: 900, width: 200, height: 20 },
    { x: 1900, y: 800, width: 200, height: 20 },
    { x: 1700, y: 680, width: 200, height: 20 },
    { x: 1950, y: 580, width: 200, height: 20 },
    { x: 1750, y: 460, width: 200, height: 20 },
    { x: 2000, y: 360, width: 200, height: 20 },
    // Alternative wider path
    { x: 2150, y: 500, width: 200, height: 20 },
    { x: 2100, y: 680, width: 160, height: 20 },
    // Goal C platform
    { x: 2200, y: 320, width: 180, height: 20 },
    // Signpost platform (outside scramble zone)
    { x: 1620, y: 660, width: 60, height: 20 },

    // === Safe zone between Area 3 and 4 (x: 2380–2460) ===
    { x: 2380, y: 960, width: 80, height: 80 },
    { x: 2380, y: 760, width: 80, height: 20 },

    // === Area 4 — Combined Gauntlet (x: 2460–3200) ===

    // Entry
    { x: 2460, y: 900, width: 140, height: 20 },
    // Fog section platforms
    { x: 2560, y: 780, width: 160, height: 20 },
    { x: 2660, y: 640, width: 160, height: 20 },
    { x: 2520, y: 500, width: 160, height: 20 },
    // Transition platform (fog → inversion)
    { x: 2750, y: 400, width: 120, height: 20 },
    // Inversion section platforms
    { x: 2900, y: 520, width: 140, height: 20 },
    { x: 2820, y: 380, width: 120, height: 20 },
    { x: 2960, y: 280, width: 140, height: 20 },
    // Goal D platform
    { x: 3020, y: 260, width: 120, height: 20 },
    // Walls for wall-jump safety
    { x: 2450, y: 200, width: 20, height: 800 },
    { x: 3180, y: 200, width: 20, height: 800 },

    // === World boundaries ===
    { x: 0, y: 0, width: 20, height: LEVEL_HEIGHT },
    { x: LEVEL_WIDTH - 20, y: 0, width: 20, height: LEVEL_HEIGHT },
    { x: 0, y: 0, width: LEVEL_WIDTH, height: 20 },
  ];

  return new TileMap(platforms);
}

// ─── Fog Zone Definitions ───────────────────────────────────────────

function createFogZones() {
  return [
    {
      id: "fog-1",
      rect: { x: 150, y: 0, width: 550, height: LEVEL_HEIGHT },
      type: "fog" as const,
      density: 0.7,
      active: true,
    },
    {
      id: "inv-1",
      rect: { x: 850, y: 0, width: 700, height: LEVEL_HEIGHT },
      type: "inversion" as const,
      density: 0,
      active: true,
    },
    {
      id: "scr-1",
      rect: { x: 1650, y: 0, width: 700, height: LEVEL_HEIGHT },
      type: "scramble" as const,
      density: 0,
      active: true,
    },
    {
      id: "fog-2",
      rect: { x: 2450, y: 0, width: 350, height: LEVEL_HEIGHT },
      type: "fog" as const,
      density: 0.6,
      active: true,
    },
    {
      id: "inv-2",
      rect: { x: 2800, y: 0, width: 380, height: LEVEL_HEIGHT },
      type: "inversion" as const,
      density: 0,
      active: true,
    },
  ];
}

// ─── Biome Platform Rendering ───────────────────────────────────────

function renderBiomePlatforms(
  ctx: CanvasRenderingContext2D,
  tileMap: TileMap,
  theme: BiomeTheme,
): void {
  for (const plat of tileMap.platforms) {
    ctx.save();

    ctx.fillStyle = theme.platformFillColor;
    ctx.fillRect(plat.x, plat.y, plat.width, plat.height);

    ctx.strokeStyle = theme.platformStrokeColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(plat.x, plat.y, plat.width, plat.height);

    // Crimson top line for horizontal platforms
    if (plat.width > plat.height && plat.height <= 80) {
      ctx.strokeStyle = "#5c3a3a";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plat.x, plat.y);
      ctx.lineTo(plat.x + plat.width, plat.y);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ─── Engine Ref Extension ───────────────────────────────────────────

interface EngineRefs extends Engine {
  __showOverlaysRef?: { current: boolean };
  __showParallaxBgRef?: { current: boolean };
  __showBiomeColorsRef?: { current: boolean };
  __showBoundariesRef?: { current: boolean };
}

// ─── Ambient particle colors ────────────────────────────────────────

const AMBIENT_PARTICLE_COLORS = GOTHIC_ERRATA_THEME.ambientParticleColors;

// ─── Test Page Component ────────────────────────────────────────────

export default function GothicErrataTest() {
  const engineRef = useRef<Engine | null>(null);
  const playerRef = useRef<Player | null>(null);
  const fogSystemRef = useRef<FogSystem | null>(null);
  const goalZonesRef = useRef<GoalZone[]>(createGoalZones());
  const fogStateRef = useRef<FogState>({
    inFog: false,
    fogLevel: 0,
    visibilityRadius: Infinity,
    inverted: false,
    scrambled: false,
    dashClearing: false,
    activeZoneIds: [],
  });

  const [showOverlays, setShowOverlays] = useState(true);
  const [params, setParams] = useState<PlayerParams>({ ...DEFAULT_PLAYER_PARAMS });
  const [fogParams, setFogParams] = useState<FogSystemParams>({
    ...DEFAULT_FOG_SYSTEM_PARAMS,
  });
  const [showParallaxBg, setShowParallaxBg] = useState(true);
  const [useBiomeColors, setUseBiomeColors] = useState(true);
  const [showBoundaries, setShowBoundaries] = useState(true);

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

  const updateFogParam = useCallback(
    <K extends keyof FogSystemParams>(key: K, value: FogSystemParams[K]) => {
      setFogParams((prev) => {
        const next = { ...prev, [key]: value };
        const fs = fogSystemRef.current;
        if (fs) {
          fs.params[key] = value;
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
    // Clear input remap
    engineRef.current?.getInput().setActionRemap(null);
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

    camera.bounds = {
      x: 0,
      y: 0,
      width: LEVEL_WIDTH,
      height: LEVEL_HEIGHT,
    };

    // Player setup
    const player = new Player();
    player.position.x = SPAWN_X;
    player.position.y = SPAWN_Y;
    player.input = input;
    player.tileMap = tileMap;

    const particleSystem = new ParticleSystem();
    const screenShake = new ScreenShake();
    player.particleSystem = particleSystem;
    player.screenShake = screenShake;

    engine.getEntities().add(player);

    // Fog system
    const fogSystem = new FogSystem(createFogZones());

    // Biome background
    const biomeBackground = createGothicErrataBackground(
      LEVEL_WIDTH,
      LEVEL_HEIGHT,
    );

    const theme = GOTHIC_ERRATA_THEME;

    engineRef.current = engine;
    playerRef.current = player;
    fogSystemRef.current = fogSystem;

    // Refs for closures
    const showOverlaysRef = { current: true };
    const showParallaxBgRef = { current: true };
    const showBiomeColorsRef = { current: true };
    const showBoundariesRef = { current: true };
    (engine as EngineRefs).__showOverlaysRef = showOverlaysRef;
    (engine as EngineRefs).__showParallaxBgRef = showParallaxBgRef;
    (engine as EngineRefs).__showBiomeColorsRef = showBiomeColorsRef;
    (engine as EngineRefs).__showBoundariesRef = showBoundariesRef;

    let ambientParticleAccum = 0;

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
        input.setActionRemap(null);
      }

      // Player bounds for fog check
      const playerBounds: Rect = {
        x: player.position.x,
        y: player.position.y,
        width: player.size.x,
        height: player.size.y,
      };

      // 1. Update fog system
      const isDashing =
        player.stateMachine.getCurrentState() === "DASHING";
      const state = fogSystem.update(playerBounds, isDashing);
      fogStateRef.current = state;

      // 2. Apply input override before player update
      const remap = fogSystem.getActiveRemap();
      input.setActionRemap(remap);

      // 3. Normal surface physics
      const groundSurface = tileMap.getGroundSurface({
        position: player.position,
        size: player.size,
      });
      player.currentSurface = getSurfaceProps(groundSurface);

      if (player.wallSide !== 0) {
        const wallSurface = tileMap.getWallSurface(
          { position: player.position, size: player.size },
          player.wallSide,
        );
        player.currentWallSurface = getSurfaceProps(wallSurface);
      }

      // 4. Camera follow
      const camTarget = {
        x: player.position.x + player.size.x / 2,
        y: player.position.y + player.size.y / 2,
      };
      camera.follow(camTarget, player.velocity, dt);

      // 5. Update particles
      particleSystem.update(dt);

      // 6. Screen shake
      const shakeOffset = screenShake.update();
      camera.position.x += shakeOffset.offsetX;
      camera.position.y += shakeOffset.offsetY;

      // Ambient particles
      ambientParticleAccum += theme.ambientParticleRate * dt;
      while (ambientParticleAccum >= 1) {
        ambientParticleAccum -= 1;
        const viewport = camera.getViewportBounds();
        particleSystem.emit({
          x: viewport.x + Math.random() * viewport.width,
          y: viewport.y - 10,
          count: 1,
          speedMin: 3,
          speedMax: 10,
          angleMin: Math.PI * 0.3,
          angleMax: Math.PI * 0.7,
          lifeMin: 3.0,
          lifeMax: 6.0,
          sizeMin: 2,
          sizeMax: 3,
          colors: AMBIENT_PARTICLE_COLORS,
          gravity: 0,
        });
      }

      // 7. Goal zone checks
      for (const zone of goalZonesRef.current) {
        if (!zone.reached && aabbOverlap(playerBounds, zone.rect)) {
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

      // Platforms
      if (showBiomeColorsRef.current) {
        renderBiomePlatforms(rCtx, tileMap, theme);
      } else {
        tileMap.render(renderer);
      }

      // Zone boundaries (in world space, always visible)
      if (showBoundariesRef.current) {
        const viewport = camera.getViewportBounds();
        fogSystem.renderZoneBoundaries(
          rCtx,
          viewport.x,
          viewport.y,
          viewport.width,
          viewport.height,
        );
      }

      // Particles (world space)
      particleSystem.render(renderer);

      // Goal zone rendering
      for (const zone of goalZonesRef.current) {
        rCtx.save();
        rCtx.fillStyle = zone.reached
          ? "rgba(74, 222, 128, 0.3)"
          : "rgba(74, 222, 128, 0.08)";
        rCtx.fillRect(
          zone.rect.x,
          zone.rect.y,
          zone.rect.width,
          zone.rect.height,
        );

        if (zone.reached) {
          rCtx.strokeStyle = "rgba(74, 222, 128, 0.7)";
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

      // Debug overlays
      if (showOverlaysRef.current) {
        const pos = player.getInterpolatedPosition(interpolation);
        const playerState = player.stateMachine.getCurrentState();

        renderer.strokeRect(
          pos.x,
          pos.y,
          player.size.x,
          player.size.y,
          "#22d3ee",
          1,
        );

        const cx = pos.x + player.size.x / 2;
        const cy = pos.y + player.size.y / 2;
        const vScale = 0.15;
        const vx = player.velocity.x * vScale;
        const vy = player.velocity.y * vScale;
        if (Math.abs(vx) > 1 || Math.abs(vy) > 1) {
          renderer.drawLine(cx, cy, cx + vx, cy + vy, "#f59e0b", 2);
        }

        renderer.drawText(playerState, pos.x, pos.y - 8, "#a78bfa", 10);

        if (player.grounded) {
          renderer.drawCircle(
            pos.x + player.size.x / 2,
            pos.y + player.size.y + 3,
            3,
            "#4ade80",
          );
        }

        // Debug zone outlines
        const viewport = camera.getViewportBounds();
        fogSystem.renderDebug(
          rCtx,
          viewport.x,
          viewport.y,
          viewport.width,
          viewport.height,
        );

        // Biome name label
        rCtx.save();
        rCtx.globalAlpha = 0.15;
        rCtx.fillStyle = "#dc2626";
        rCtx.font = "bold 24px monospace";
        rCtx.fillText("GOTHIC ERRATA", 60, 60);
        rCtx.restore();
      }
    });

    // ─── Screen-Space Debug Layer (fog overlay + control effects) ──

    const debugLayerCallback = (debugCtx: CanvasRenderingContext2D) => {
      // Fog overlay (screen-space — always rendered, not just debug)
      const pos = player.getInterpolatedPosition(1);
      const viewport = camera.getViewportBounds();
      const playerScreenX = pos.x + player.size.x / 2 - viewport.x;
      const playerScreenY = pos.y + player.size.y / 2 - viewport.y;

      fogSystem.renderFogOverlay(
        debugCtx,
        playerScreenX,
        playerScreenY,
        CANVAS_WIDTH,
        CANVAS_HEIGHT,
      );

      // Control modification effects (screen-space)
      fogSystem.renderControlEffects(debugCtx, CANVAS_WIDTH, CANVAS_HEIGHT);

      if (!showOverlaysRef.current) return;

      const metrics = engine.getMetrics();
      const fs = fogStateRef.current;

      // FPS counter
      debugCtx.fillStyle = "#dc2626";
      debugCtx.font = "12px monospace";
      debugCtx.fillText(`FPS: ${Math.round(metrics.fps)}`, 8, 16);

      // Biome label
      debugCtx.fillStyle = "#5c3a3a";
      debugCtx.fillText("Gothic Errata", 8, 32);

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

      // Fog diagnostics (bottom-left)
      const diagX = 8;
      const diagY = CANVAS_HEIGHT - 170;
      debugCtx.fillStyle = "rgba(0, 0, 0, 0.6)";
      debugCtx.fillRect(diagX - 4, diagY - 14, 280, 180);

      debugCtx.fillStyle = "#a78bfa";
      debugCtx.font = "11px monospace";
      debugCtx.fillText(
        `State: ${player.stateMachine.getCurrentState()}`,
        diagX,
        diagY,
      );
      debugCtx.fillText(
        `Pos: (${Math.round(player.position.x)}, ${Math.round(player.position.y)})`,
        diagX,
        diagY + 14,
      );
      debugCtx.fillText(
        `Grounded: ${player.grounded ? "YES" : "NO"}`,
        diagX,
        diagY + 28,
      );

      // Fog state info
      debugCtx.fillStyle = "#a855f7";
      debugCtx.fillText(
        `In Fog: ${fs.inFog ? "YES" : "NO"}  Level: ${fs.fogLevel.toFixed(2)}`,
        diagX,
        diagY + 46,
      );
      debugCtx.fillText(
        `Vis Radius: ${fs.visibilityRadius === Infinity ? "∞" : Math.round(fs.visibilityRadius)}`,
        diagX,
        diagY + 60,
      );
      debugCtx.fillText(
        `Dash Clear: ${fs.dashClearing ? "YES" : "NO"}`,
        diagX,
        diagY + 74,
      );

      // Control state
      debugCtx.fillStyle = fs.inverted ? "#dc2626" : "#5c3a3a";
      debugCtx.fillText(
        `Inverted: ${fs.inverted ? "YES" : "NO"}`,
        diagX,
        diagY + 92,
      );
      debugCtx.fillStyle = fs.scrambled ? "#4ade80" : "#5c3a3a";
      debugCtx.fillText(
        `Scrambled: ${fs.scrambled ? "YES" : "NO"}`,
        diagX,
        diagY + 106,
      );

      if (fs.scrambled) {
        const mapping = fogSystem.getScrambleMapDisplay();
        debugCtx.fillStyle = "#4ade80";
        for (let i = 0; i < mapping.length; i++) {
          debugCtx.fillText(
            `  ${mapping[i]}`,
            diagX,
            diagY + 120 + i * 12,
          );
        }
      }

      // Active zones
      debugCtx.fillStyle = "#78716c";
      const zoneY = fs.scrambled
        ? diagY + 120 + fogSystem.getScrambleMapDisplay().length * 12
        : diagY + 120;
      debugCtx.fillText(
        `Zones: ${fs.activeZoneIds.length > 0 ? fs.activeZoneIds.join(", ") : "none"}`,
        diagX,
        zoneY,
      );

      // Goal status (bottom-right)
      debugCtx.textAlign = "right";
      debugCtx.font = "11px monospace";
      const goals = goalZonesRef.current;
      for (let i = 0; i < goals.length; i++) {
        const g = goals[i];
        debugCtx.fillStyle = g.reached ? "#4ade80" : "#5c3a3a";
        debugCtx.fillText(
          `${g.reached ? "\u2713" : "\u2610"} ${g.label}`,
          CANVAS_WIDTH - 8,
          CANVAS_HEIGHT - 8 - (goals.length - 1 - i) * 14,
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
    engineRef.current?.getInput().setActionRemap(null);
    engineRef.current?.stop();
    engineRef.current = null;
    playerRef.current = null;
    fogSystemRef.current = null;
  }, []);

  const toggleOverlays = useCallback(() => {
    setShowOverlays((prev) => {
      const next = !prev;
      const engine = engineRef.current as EngineRefs | null;
      if (engine?.__showOverlaysRef) engine.__showOverlaysRef.current = next;
      return next;
    });
  }, []);

  const toggleParallaxBg = useCallback(() => {
    setShowParallaxBg((prev) => {
      const next = !prev;
      const engine = engineRef.current as EngineRefs | null;
      if (engine?.__showParallaxBgRef) engine.__showParallaxBgRef.current = next;
      return next;
    });
  }, []);

  const toggleBiomeColors = useCallback(() => {
    setUseBiomeColors((prev) => {
      const next = !prev;
      const engine = engineRef.current as EngineRefs | null;
      if (engine?.__showBiomeColorsRef) engine.__showBiomeColorsRef.current = next;
      return next;
    });
  }, []);

  const toggleBoundaries = useCallback(() => {
    setShowBoundaries((prev) => {
      const next = !prev;
      const engine = engineRef.current as EngineRefs | null;
      if (engine?.__showBoundariesRef) engine.__showBoundariesRef.current = next;
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
        <h1 className="font-mono text-sm font-bold text-red-500">
          Gothic Errata
        </h1>
        <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs font-mono text-red-400">
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
            Fog reduces visibility &middot; Fog radius scales with density
            &middot; Smooth fog fade-in/out &middot; Dash clears fog
            &middot; Inversion flips L/R controls &middot; Red tint during inversion
            &middot; Grace period on zone entry &middot; Scramble remaps directions
            &middot; Scramble consistent within zone &middot; Green glitch during scramble
            &middot; Zone boundaries visible &middot; All 4 goals reachable
            &middot; No movement seams &middot; Sliders tune in real-time
          </div>

          {/* Controls legend */}
          <div className="w-[960px] text-xs font-mono text-zinc-600 leading-relaxed">
            <span className="text-zinc-500">Controls: </span>
            Arrows/WASD = Move &middot; Z/Space = Jump &middot; X/Shift = Dash
            &middot; S/Down = Crouch
          </div>
        </div>

        {/* Debug panel */}
        <DebugPanel title="Gothic Errata">
          <RenderModeToggle />
          {/* Fog Params (expanded) */}
          <details open>
            <summary className="text-xs font-mono text-red-400 uppercase tracking-wider cursor-pointer select-none">
              Fog Params
            </summary>
            <div className="flex flex-col gap-4 pt-2">
              <Slider
                label="Base Fog Radius"
                value={fogParams.baseFogRadius}
                min={50}
                max={400}
                step={10}
                onChange={(v) => updateFogParam("baseFogRadius", v)}
              />
              <Slider
                label="Min Fog Radius"
                value={fogParams.minFogRadius}
                min={30}
                max={200}
                step={10}
                onChange={(v) => updateFogParam("minFogRadius", v)}
              />
              <Slider
                label="Fog Fade In Rate"
                value={fogParams.fogFadeInRate}
                min={0.01}
                max={0.5}
                step={0.01}
                onChange={(v) => updateFogParam("fogFadeInRate", v)}
              />
              <Slider
                label="Fog Fade Out Rate"
                value={fogParams.fogFadeOutRate}
                min={0.01}
                max={0.5}
                step={0.01}
                onChange={(v) => updateFogParam("fogFadeOutRate", v)}
              />
              <Slider
                label="Dash Clear Duration"
                value={fogParams.dashClearDuration}
                min={5}
                max={40}
                step={1}
                onChange={(v) => updateFogParam("dashClearDuration", v)}
              />
              <Slider
                label="Inversion Tint"
                value={fogParams.inversionTintStrength}
                min={0}
                max={0.5}
                step={0.01}
                onChange={(v) => updateFogParam("inversionTintStrength", v)}
              />
              <Slider
                label="Scramble Glitch"
                value={fogParams.scrambleGlitchStrength}
                min={0}
                max={0.5}
                step={0.01}
                onChange={(v) => updateFogParam("scrambleGlitchStrength", v)}
              />
              <Slider
                label="Transition Delay"
                value={fogParams.controlTransitionDelay}
                min={0}
                max={30}
                step={1}
                onChange={(v) => updateFogParam("controlTransitionDelay", v)}
              />
            </div>
          </details>

          {/* Fog Toggles */}
          <details open>
            <summary className="text-xs font-mono text-red-400/80 uppercase tracking-wider cursor-pointer select-none pt-2">
              Fog Toggles
            </summary>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() =>
                  updateFogParam("dashClearsFog", !fogParams.dashClearsFog)
                }
                className={`rounded px-3 py-1 text-xs font-mono transition-colors ${
                  fogParams.dashClearsFog
                    ? "bg-red-500/20 text-red-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Dash Clears Fog: {fogParams.dashClearsFog ? "ON" : "OFF"}
              </button>
              <button
                onClick={() =>
                  updateFogParam(
                    "inversionAffectsDash",
                    !fogParams.inversionAffectsDash,
                  )
                }
                className={`rounded px-3 py-1 text-xs font-mono transition-colors ${
                  fogParams.inversionAffectsDash
                    ? "bg-red-500/20 text-red-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Inversion Affects Dash:{" "}
                {fogParams.inversionAffectsDash ? "ON" : "OFF"}
              </button>
              <button
                onClick={() =>
                  updateFogParam(
                    "scrambleAffectsDash",
                    !fogParams.scrambleAffectsDash,
                  )
                }
                className={`rounded px-3 py-1 text-xs font-mono transition-colors ${
                  fogParams.scrambleAffectsDash
                    ? "bg-red-500/20 text-red-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Scramble Affects Dash:{" "}
                {fogParams.scrambleAffectsDash ? "ON" : "OFF"}
              </button>
            </div>
          </details>

          {/* Visual Settings */}
          <details>
            <summary className="text-xs font-mono text-zinc-500 uppercase tracking-wider cursor-pointer select-none pt-2">
              Visual Settings
            </summary>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={toggleParallaxBg}
                className={`rounded px-3 py-1 text-xs font-mono transition-colors ${
                  showParallaxBg
                    ? "bg-red-500/20 text-red-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Parallax Background: {showParallaxBg ? "ON" : "OFF"}
              </button>
              <button
                onClick={toggleBiomeColors}
                className={`rounded px-3 py-1 text-xs font-mono transition-colors ${
                  useBiomeColors
                    ? "bg-red-500/20 text-red-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Biome Colors: {useBiomeColors ? "ON" : "OFF"}
              </button>
              <button
                onClick={toggleBoundaries}
                className={`rounded px-3 py-1 text-xs font-mono transition-colors ${
                  showBoundaries
                    ? "bg-red-500/20 text-red-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Zone Boundaries: {showBoundaries ? "ON" : "OFF"}
              </button>
            </div>
          </details>

          {/* Player Movement (collapsed) */}
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
                label="Jump Speed"
                value={params.jumpSpeed}
                min={200}
                max={600}
                step={10}
                onChange={(v) => updateParam("jumpSpeed", v)}
              />
              <Slider
                label="Rise Gravity"
                value={params.riseGravity}
                min={200}
                max={3000}
                step={50}
                onChange={(v) => updateParam("riseGravity", v)}
              />
              <Slider
                label="Fall Gravity"
                value={params.fallGravity}
                min={200}
                max={3000}
                step={50}
                onChange={(v) => updateParam("fallGravity", v)}
              />
              <Slider
                label="Dash Speed"
                value={params.dashSpeed}
                min={200}
                max={1200}
                step={25}
                onChange={(v) => updateParam("dashSpeed", v)}
              />
              <Slider
                label="Air Acceleration"
                value={params.airAcceleration}
                min={0}
                max={3000}
                step={50}
                onChange={(v) => updateParam("airAcceleration", v)}
              />
            </div>
          </details>

          {/* Controls */}
          <details open>
            <summary className="text-xs font-mono text-red-500/80 uppercase tracking-wider cursor-pointer select-none pt-2">
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
                    player.position.x = 100;
                    player.position.y = 900;
                    player.velocity.x = 0;
                    player.velocity.y = 0;
                    engineRef.current?.getInput().setActionRemap(null);
                  }
                }}
                className="w-full rounded bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                TP: Area 1 (Fog)
              </button>
              <button
                onClick={() => {
                  const player = playerRef.current;
                  if (player) {
                    player.position.x = 820;
                    player.position.y = 920;
                    player.velocity.x = 0;
                    player.velocity.y = 0;
                    engineRef.current?.getInput().setActionRemap(null);
                  }
                }}
                className="w-full rounded bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                TP: Area 2 (Inversion)
              </button>
              <button
                onClick={() => {
                  const player = playerRef.current;
                  if (player) {
                    player.position.x = 1600;
                    player.position.y = 920;
                    player.velocity.x = 0;
                    player.velocity.y = 0;
                    engineRef.current?.getInput().setActionRemap(null);
                  }
                }}
                className="w-full rounded bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                TP: Area 3 (Scramble)
              </button>
              <button
                onClick={() => {
                  const player = playerRef.current;
                  if (player) {
                    player.position.x = 2420;
                    player.position.y = 920;
                    player.velocity.x = 0;
                    player.velocity.y = 0;
                    engineRef.current?.getInput().setActionRemap(null);
                  }
                }}
                className="w-full rounded bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                TP: Area 4 (Combined)
              </button>
              <button
                onClick={toggleOverlays}
                className={`w-full rounded px-3 py-1.5 text-xs font-mono transition-colors ${
                  showOverlays
                    ? "bg-red-500/20 text-red-400"
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
