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
import {
  GravityWellSystem,
  DEFAULT_GRAVITY_WELL_PARAMS,
} from "@/engine/world/GravityWellSystem";
import type {
  GravityWell,
  GravityWellParams,
} from "@/engine/world/GravityWellSystem";
import { ASTRAL_ATLAS_THEME } from "@/engine/world/Biome";
import type { BiomeTheme } from "@/engine/world/Biome";
import { createAstralAtlasBackground } from "@/engine/world/BiomeBackground";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/constants";
import type { Rect } from "@/lib/types";
import { aabbOverlap } from "@/engine/physics/AABB";
import { getSurfaceProps } from "@/engine/physics/Surfaces";
import Link from "next/link";

// ─── Constants ──────────────────────────────────────────────────────

const LEVEL_WIDTH = 3200;
const LEVEL_HEIGHT = 1200;
const SPAWN_X = 100;
const SPAWN_Y = 950;
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
      rect: { x: 2850, y: 850, width: 100, height: 80 },
      label: "Goal A",
      reached: false,
    },
    {
      id: "goal-b",
      rect: { x: 2950, y: 150, width: 100, height: 80 },
      label: "Goal B",
      reached: false,
    },
  ];
}

// ─── Level Construction ─────────────────────────────────────────────

function createTestLevel(): TileMap {
  const platforms: Platform[] = [
    // === Area 1 — Low-Gravity Basics (x: 0–800) ===
    // Ground platform
    { x: 0, y: 1080, width: 800, height: 120 },
    // Floating platforms (staggered vertical)
    { x: 100, y: 820, width: 180, height: 20 },
    { x: 400, y: 600, width: 160, height: 20 },
    { x: 150, y: 400, width: 180, height: 20 },
    { x: 500, y: 250, width: 160, height: 20 },

    // === Area 2 — Attract Wells (x: 800–1600) ===
    // Entry platform
    { x: 750, y: 700, width: 160, height: 20 },
    // Floating platforms across gap
    { x: 1050, y: 600, width: 140, height: 20 },
    { x: 1350, y: 500, width: 140, height: 20 },
    // Exit platform
    { x: 1550, y: 650, width: 160, height: 20 },

    // === Area 3 — Repel Wells (x: 1600–2400) ===
    // Narrow shaft walls
    { x: 1600, y: 400, width: 20, height: 800 },
    { x: 2000, y: 200, width: 20, height: 1000 },
    // Alternating wall platforms
    { x: 1620, y: 1000, width: 150, height: 20 },
    { x: 1850, y: 850, width: 150, height: 20 },
    { x: 1620, y: 700, width: 150, height: 20 },
    { x: 1850, y: 550, width: 150, height: 20 },
    { x: 1620, y: 400, width: 150, height: 20 },
    // Top exit platform
    { x: 1750, y: 220, width: 200, height: 20 },
    // Safety platform below shaft
    { x: 1620, y: 1150, width: 400, height: 50 },

    // === Area 4 — Gravity Gauntlet (x: 2400–3200) ===
    // Entry platform
    { x: 2100, y: 400, width: 160, height: 20 },
    // Mid-height platforms
    { x: 2400, y: 600, width: 150, height: 20 },
    { x: 2650, y: 450, width: 140, height: 20 },
    // Goal A platform
    { x: 2800, y: 930, width: 200, height: 20 },
    // Vertical stepping for Goal B
    { x: 2700, y: 750, width: 120, height: 20 },
    { x: 2950, y: 550, width: 140, height: 20 },
    { x: 2750, y: 350, width: 120, height: 20 },
    // Goal B platform
    { x: 2900, y: 150, width: 200, height: 20 },
    // Bottom safety
    { x: 2400, y: 1100, width: 800, height: 100 },

    // === Boundary walls ===
    { x: 0, y: 0, width: 20, height: LEVEL_HEIGHT },
    { x: LEVEL_WIDTH - 20, y: 0, width: 20, height: LEVEL_HEIGHT },
    // Ceiling
    { x: 0, y: 0, width: LEVEL_WIDTH, height: 20 },
  ];

  return new TileMap(platforms);
}

// ─── Gravity Well Placement ─────────────────────────────────────────

function createGravityWells(): GravityWell[] {
  return [
    // Area 2 — Attract wells bridging platforms
    {
      id: "attract-1",
      position: { x: 950, y: 650 },
      radius: 200,
      strength: 300,
      type: "attract",
      active: true,
      color: "#818cf8",
    },
    {
      id: "attract-2",
      position: { x: 1200, y: 550 },
      radius: 200,
      strength: 300,
      type: "attract",
      active: true,
      color: "#818cf8",
    },

    // Area 3 — Repel wells in the shaft
    {
      id: "repel-1",
      position: { x: 1810, y: 900 },
      radius: 180,
      strength: 350,
      type: "repel",
      active: true,
      color: "#f472b6",
    },
    {
      id: "repel-2",
      position: { x: 1810, y: 600 },
      radius: 180,
      strength: 350,
      type: "repel",
      active: true,
      color: "#f472b6",
    },
    // Safety net repel at bottom
    {
      id: "repel-safety",
      position: { x: 1810, y: 1120 },
      radius: 150,
      strength: 400,
      type: "repel",
      active: true,
      color: "#f472b6",
    },

    // Area 4 — Mixed gauntlet
    {
      id: "attract-3",
      position: { x: 2300, y: 500 },
      radius: 200,
      strength: 280,
      type: "attract",
      active: true,
      color: "#818cf8",
    },
    {
      id: "repel-3",
      position: { x: 2550, y: 350 },
      radius: 180,
      strength: 320,
      type: "repel",
      active: true,
      color: "#f472b6",
    },
    {
      id: "attract-4",
      position: { x: 2850, y: 250 },
      radius: 220,
      strength: 300,
      type: "attract",
      active: true,
      color: "#818cf8",
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

    // Fill
    ctx.fillStyle = theme.platformFillColor;
    ctx.fillRect(plat.x, plat.y, plat.width, plat.height);

    // Stroke
    ctx.strokeStyle = theme.platformStrokeColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(plat.x, plat.y, plat.width, plat.height);

    // Starry top line (for horizontal platforms)
    if (plat.width > plat.height && plat.height <= 80) {
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(plat.x, plat.y);
      ctx.lineTo(plat.x + plat.width, plat.y);
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
  __showWellDebugRef?: { current: boolean };
}

// ─── Test Page Component ────────────────────────────────────────────

export default function AstralAtlasTest() {
  const engineRef = useRef<Engine | null>(null);
  const playerRef = useRef<Player | null>(null);
  const gravityWellSystemRef = useRef<GravityWellSystem | null>(null);
  const goalZonesRef = useRef<GoalZone[]>(createGoalZones());

  const [showOverlays, setShowOverlays] = useState(true);
  const [params, setParams] = useState<PlayerParams>({
    ...DEFAULT_PLAYER_PARAMS,
  });
  const [gwParams, setGwParams] = useState<GravityWellParams>({
    ...DEFAULT_GRAVITY_WELL_PARAMS,
  });
  const [showAmbientParticles, setShowAmbientParticles] = useState(true);
  const [showParallaxBg, setShowParallaxBg] = useState(true);
  const [useBiomeColors, setUseBiomeColors] = useState(true);
  const [showWellDebug, setShowWellDebug] = useState(true);

  // Store the base params for gravity multiplication
  const baseParamsRef = useRef<PlayerParams>({ ...DEFAULT_PLAYER_PARAMS });

  // ─── Param Updaters ─────────────────────────────────────────────

  const updateParam = useCallback(
    <K extends keyof PlayerParams>(key: K, value: PlayerParams[K]) => {
      setParams((prev) => {
        const next = { ...prev, [key]: value };
        // Update base params reference
        baseParamsRef.current[key] = value;
        // Push to player immediately (gravity-modified params will be
        // overwritten in the update loop, but non-gravity params like
        // maxRunSpeed, jumpSpeed, dashSpeed, airAcceleration need this)
        const player = playerRef.current;
        if (player) {
          player.params[key] = value;
        }
        return next;
      });
    },
    [],
  );

  const updateGwParam = useCallback(
    <K extends keyof GravityWellParams>(key: K, value: GravityWellParams[K]) => {
      setGwParams((prev) => {
        const next = { ...prev, [key]: value };
        const gws = gravityWellSystemRef.current;
        if (gws) {
          gws.params[key] = value;
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

    // Set camera bounds for the full level
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

    // Particle system & screen shake
    const particleSystem = new ParticleSystem();
    const screenShake = new ScreenShake();
    player.particleSystem = particleSystem;
    player.screenShake = screenShake;

    engine.getEntities().add(player);

    // Gravity well system
    const gravityWellSystem = new GravityWellSystem(
      createGravityWells(),
      { ...DEFAULT_GRAVITY_WELL_PARAMS },
    );

    // Biome background
    const biomeBackground = createAstralAtlasBackground(
      LEVEL_WIDTH,
      LEVEL_HEIGHT,
    );

    // Biome theme
    const theme = ASTRAL_ATLAS_THEME;

    engineRef.current = engine;
    playerRef.current = player;
    gravityWellSystemRef.current = gravityWellSystem;

    // Use the ref for base params so slider changes are reflected in gravity multiplication
    const baseParams = baseParamsRef.current;

    // Overlay refs
    const showOverlaysRef = { current: true };
    const showAmbientParticlesRef = { current: true };
    const showParallaxBgRef = { current: true };
    const useBiomeColorsRef = { current: true };
    const showWellDebugRef = { current: true };

    const engineExt = engine as EngineRefs;
    engineExt.__showOverlaysRef = showOverlaysRef;
    engineExt.__showAmbientParticlesRef = showAmbientParticlesRef;
    engineExt.__showParallaxBgRef = showParallaxBgRef;
    engineExt.__useBiomeColorsRef = useBiomeColorsRef;
    engineExt.__showWellDebugRef = showWellDebugRef;

    // Ambient particle accumulator
    let ambientParticleAccum = 0;

    // Time accumulator for well rendering
    let renderTime = 0;

    // ─── Update Callback ───────────────────────────────────────

    engine.onUpdate((dt) => {
      renderTime += dt;

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
        player.active = true;
      }

      // Apply low-gravity biome modifier to player params before update
      const gravMul = gravityWellSystem.params.globalGravityMultiplier;
      player.params.riseGravity = baseParams.riseGravity * gravMul;
      player.params.fallGravity = baseParams.fallGravity * gravMul;
      player.params.maxFallSpeed = baseParams.maxFallSpeed * gravMul;

      // Normal surface physics
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

      // Player update happens via EntityManager (player.active = true)

      // After player update, apply gravity well forces
      const isDashing = player.stateMachine.getCurrentState() === "DASHING";
      if (!isDashing || gravityWellSystem.params.affectsDash) {
        const playerCenter = {
          x: player.position.x + player.size.x / 2,
          y: player.position.y + player.size.y / 2,
        };
        gravityWellSystem.applyToVelocity(playerCenter, player.velocity, dt);
      }

      // Camera follow
      const camTarget = {
        x: player.position.x + player.size.x / 2,
        y: player.position.y + player.size.y / 2,
      };
      camera.follow(camTarget, player.velocity, dt);

      // Update particles
      particleSystem.update(dt);

      // Update screen shake
      const shakeOffset = screenShake.update();
      camera.position.x += shakeOffset.offsetX;
      camera.position.y += shakeOffset.offsetY;

      // Ambient particles (twinkling stars falling/drifting)
      if (showAmbientParticlesRef.current) {
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
            lifeMin: 4.0,
            lifeMax: 7.0,
            sizeMin: 1,
            sizeMax: 3,
            colors: theme.ambientParticleColors,
            gravity: 0,
          });
        }
      }

      // Gravity well ambient particles (flow toward/away from center)
      for (const well of gravityWellSystem.wells) {
        if (!well.active) continue;
        // ~3 particles/s per well, frame-rate independent
        if (Math.random() > 3 * dt) continue;
        const angle = Math.random() * Math.PI * 2;
        const dist = well.radius * (0.3 + Math.random() * 0.6);
        const px = well.position.x + Math.cos(angle) * dist;
        const py = well.position.y + Math.sin(angle) * dist;
        const toCenter = Math.atan2(
          well.position.y - py,
          well.position.x - px,
        );
        const dir = well.type === "attract" ? toCenter : toCenter + Math.PI;
        particleSystem.emit({
          x: px,
          y: py,
          count: 1,
          speedMin: 15,
          speedMax: 40,
          angleMin: dir - 0.3,
          angleMax: dir + 0.3,
          lifeMin: 0.8,
          lifeMax: 1.5,
          sizeMin: 1,
          sizeMax: 2,
          colors: [well.color],
          gravity: 0,
        });
      }

      // ─── Goal Zone Checks ─────────────────────────────────

      const playerBounds: Rect = {
        x: player.position.x,
        y: player.position.y,
        width: player.size.x,
        height: player.size.y,
      };

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

      // Draw platforms
      if (useBiomeColorsRef.current) {
        renderBiomePlatforms(rCtx, tileMap, theme);
      } else {
        tileMap.render(renderer);
      }

      // Render gravity wells
      gravityWellSystem.render(rCtx, camera.position, renderTime);

      // Render particles (world space)
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

      if (!showOverlaysRef.current) return;

      // Debug overlays
      const pos = player.getInterpolatedPosition(interpolation);
      const state = player.stateMachine.getCurrentState();

      // Well debug overlay
      if (showWellDebugRef.current) {
        gravityWellSystem.renderDebug(rCtx, camera.position);

        // Force vector on player
        const playerCenter = {
          x: pos.x + player.size.x / 2,
          y: pos.y + player.size.y / 2,
        };
        gravityWellSystem.renderForceVector(rCtx, playerCenter);
      }

      // Player hitbox
      renderer.strokeRect(
        pos.x,
        pos.y,
        player.size.x,
        player.size.y,
        "#22d3ee",
        1,
      );

      // Velocity vector
      const cx = pos.x + player.size.x / 2;
      const cy = pos.y + player.size.y / 2;
      const vScale = 0.15;
      const vx = player.velocity.x * vScale;
      const vy = player.velocity.y * vScale;
      if (Math.abs(vx) > 1 || Math.abs(vy) > 1) {
        renderer.drawLine(cx, cy, cx + vx, cy + vy, "#f59e0b", 2);
      }

      // State label
      renderer.drawText(state, pos.x, pos.y - 8, "#a78bfa", 10);

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
      rCtx.fillStyle = "#818cf8";
      rCtx.font = "bold 24px monospace";
      rCtx.fillText("ASTRAL ATLAS", 60, 60);
      rCtx.restore();
    });

    // ─── Screen-Space Debug Layer ──────────────────────────────

    const debugLayerCallback = (debugCtx: CanvasRenderingContext2D) => {
      if (!showOverlaysRef.current) return;

      const metrics = engine.getMetrics();
      const gravMul = gravityWellSystem.params.globalGravityMultiplier;

      // FPS counter
      debugCtx.fillStyle = "#818cf8";
      debugCtx.font = "12px monospace";
      debugCtx.fillText(`FPS: ${Math.round(metrics.fps)}`, 8, 16);

      // Biome label
      debugCtx.fillStyle = "#c4b5fd";
      debugCtx.fillText("Astral Atlas", 8, 32);

      // Velocity readout (top right)
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
      const diagY = CANVAS_HEIGHT - 150;
      debugCtx.fillStyle = "rgba(0, 0, 0, 0.6)";
      debugCtx.fillRect(diagX - 4, diagY - 14, 300, 160);

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
        `Vel: (${Math.round(player.velocity.x)}, ${Math.round(player.velocity.y)})`,
        diagX,
        diagY + 28,
      );
      debugCtx.fillText(
        `Grounded: ${player.grounded ? "YES" : "NO"}`,
        diagX,
        diagY + 42,
      );

      // Gravity info
      debugCtx.fillStyle = "#818cf8";
      debugCtx.fillText(
        `Gravity Mul: ${gravMul.toFixed(2)}`,
        diagX,
        diagY + 60,
      );
      debugCtx.fillText(
        `Effective Rise G: ${Math.round(baseParams.riseGravity * gravMul)}`,
        diagX,
        diagY + 74,
      );
      debugCtx.fillText(
        `Effective Fall G: ${Math.round(baseParams.fallGravity * gravMul)}`,
        diagX,
        diagY + 88,
      );

      // Well proximity info
      const playerCenter = {
        x: player.position.x + player.size.x / 2,
        y: player.position.y + player.size.y / 2,
      };
      const nearWell = gravityWellSystem.getWellAt(playerCenter);
      if (nearWell) {
        const dx = nearWell.position.x - playerCenter.x;
        const dy = nearWell.position.y - playerCenter.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const force = gravityWellSystem.computeForce(playerCenter);
        const forceMag = Math.sqrt(
          force.x * force.x + force.y * force.y,
        );
        debugCtx.fillStyle = nearWell.color;
        debugCtx.fillText(
          `In well: ${nearWell.id} (${nearWell.type})`,
          diagX,
          diagY + 106,
        );
        debugCtx.fillText(
          `Dist: ${Math.round(dist)}px  Force: ${Math.round(forceMag)} px/s\u00B2`,
          diagX,
          diagY + 120,
        );
      } else {
        debugCtx.fillStyle = "#475569";
        debugCtx.fillText("Not in any well", diagX, diagY + 106);
      }

      // Goal status (bottom-right)
      const goalA = goalZonesRef.current.find((z) => z.id === "goal-a");
      const goalB = goalZonesRef.current.find((z) => z.id === "goal-b");
      debugCtx.fillStyle = "#4ade80";
      debugCtx.textAlign = "right";
      debugCtx.fillText(
        `Goals: A ${goalA?.reached ? "\u2713" : "\u2610"} B ${goalB?.reached ? "\u2713" : "\u2610"}`,
        CANVAS_WIDTH - 8,
        CANVAS_HEIGHT - 8,
      );
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
    gravityWellSystemRef.current = null;
  }, []);

  const toggleOverlays = useCallback(() => {
    setShowOverlays((prev) => {
      const next = !prev;
      const engine = engineRef.current as EngineRefs | null;
      if (engine?.__showOverlaysRef) engine.__showOverlaysRef.current = next;
      return next;
    });
  }, []);

  const toggleAmbientParticles = useCallback(() => {
    setShowAmbientParticles((prev) => {
      const next = !prev;
      const engine = engineRef.current as EngineRefs | null;
      if (engine?.__showAmbientParticlesRef)
        engine.__showAmbientParticlesRef.current = next;
      return next;
    });
  }, []);

  const toggleParallaxBg = useCallback(() => {
    setShowParallaxBg((prev) => {
      const next = !prev;
      const engine = engineRef.current as EngineRefs | null;
      if (engine?.__showParallaxBgRef)
        engine.__showParallaxBgRef.current = next;
      return next;
    });
  }, []);

  const toggleBiomeColors = useCallback(() => {
    setUseBiomeColors((prev) => {
      const next = !prev;
      const engine = engineRef.current as EngineRefs | null;
      if (engine?.__useBiomeColorsRef)
        engine.__useBiomeColorsRef.current = next;
      return next;
    });
  }, []);

  const toggleWellDebug = useCallback(() => {
    setShowWellDebug((prev) => {
      const next = !prev;
      const engine = engineRef.current as EngineRefs | null;
      if (engine?.__showWellDebugRef)
        engine.__showWellDebugRef.current = next;
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
        <h1 className="font-mono text-sm font-bold text-indigo-400">
          Astral Atlas
        </h1>
        <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-mono text-indigo-300">
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
            Low-gravity feel (2.5x jump height) &middot; Attract wells
            pull &middot; Repel wells push &middot; Well slingshot
            (400px+ gap) &middot; Repel launch &middot; Goal A reached
            &middot; Goal B reached &middot; Gravity slider works
            &middot; No movement seams &middot; Dash immunity
          </div>

          {/* Controls legend */}
          <div className="w-[960px] text-xs font-mono text-zinc-600 leading-relaxed">
            <span className="text-zinc-500">Controls: </span>
            Arrows = Move &middot; Z/Space = Jump &middot; X/Shift = Dash
          </div>
        </div>

        {/* Debug panel */}
        <DebugPanel title="Astral Atlas">
          <RenderModeToggle />
          {/* Biome Info */}
          <div className="border-b border-zinc-800 pb-2 mb-2">
            <div className="text-xs font-mono text-indigo-400 uppercase tracking-wider mb-1">
              Biome Info
            </div>
            <div className="text-xs font-mono text-zinc-400 space-y-0.5">
              <div>
                Biome:{" "}
                <span className="text-zinc-200">Astral Atlas</span>
              </div>
              <div>
                Gravity Mul:{" "}
                <span className="text-zinc-200">
                  {gwParams.globalGravityMultiplier.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Gravity Wells */}
          <details open>
            <summary className="text-xs font-mono text-indigo-400 uppercase tracking-wider cursor-pointer select-none">
              Gravity Wells
            </summary>
            <div className="flex flex-col gap-4 pt-2">
              <Slider
                label="Global Gravity Mul"
                value={gwParams.globalGravityMultiplier}
                min={0.1}
                max={1.0}
                step={0.05}
                onChange={(v) =>
                  updateGwParam("globalGravityMultiplier", v)
                }
              />
              <Slider
                label="Falloff"
                value={gwParams.falloff}
                min={0.5}
                max={3.0}
                step={0.1}
                onChange={(v) => updateGwParam("falloff", v)}
              />
              <Slider
                label="Max Well Force"
                value={gwParams.maxWellForce}
                min={100}
                max={800}
                step={50}
                onChange={(v) => updateGwParam("maxWellForce", v)}
              />
              <Slider
                label="Pulse Speed"
                value={gwParams.pulseSpeed}
                min={0.5}
                max={5.0}
                step={0.25}
                onChange={(v) => updateGwParam("pulseSpeed", v)}
              />
              <button
                onClick={() =>
                  updateGwParam("affectsDash", !gwParams.affectsDash)
                }
                className={`rounded px-3 py-1 text-xs font-mono transition-colors ${
                  gwParams.affectsDash
                    ? "bg-indigo-500/20 text-indigo-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Affects Dash: {gwParams.affectsDash ? "ON" : "OFF"}
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
                min={100}
                max={500}
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
                label="Rise Gravity (base)"
                value={params.riseGravity}
                min={200}
                max={1200}
                step={20}
                onChange={(v) => updateParam("riseGravity", v)}
              />
              <Slider
                label="Fall Gravity (base)"
                value={params.fallGravity}
                min={200}
                max={1200}
                step={20}
                onChange={(v) => updateParam("fallGravity", v)}
              />
              <Slider
                label="Max Fall Speed (base)"
                value={params.maxFallSpeed}
                min={100}
                max={800}
                step={20}
                onChange={(v) => updateParam("maxFallSpeed", v)}
              />
              <Slider
                label="Dash Speed"
                value={params.dashSpeed}
                min={300}
                max={1000}
                step={25}
                onChange={(v) => updateParam("dashSpeed", v)}
              />
              <Slider
                label="Air Acceleration"
                value={params.airAcceleration}
                min={400}
                max={3000}
                step={100}
                onChange={(v) => updateParam("airAcceleration", v)}
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
                    ? "bg-indigo-500/20 text-indigo-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Ambient Particles:{" "}
                {showAmbientParticles ? "ON" : "OFF"}
              </button>
              <button
                onClick={toggleParallaxBg}
                className={`rounded px-3 py-1 text-xs font-mono transition-colors ${
                  showParallaxBg
                    ? "bg-indigo-500/20 text-indigo-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Parallax Background:{" "}
                {showParallaxBg ? "ON" : "OFF"}
              </button>
              <button
                onClick={toggleBiomeColors}
                className={`rounded px-3 py-1 text-xs font-mono transition-colors ${
                  useBiomeColors
                    ? "bg-indigo-500/20 text-indigo-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Biome Colors: {useBiomeColors ? "ON" : "OFF"}
              </button>
              <button
                onClick={toggleWellDebug}
                className={`rounded px-3 py-1 text-xs font-mono transition-colors ${
                  showWellDebug
                    ? "bg-indigo-500/20 text-indigo-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Well Debug: {showWellDebug ? "ON" : "OFF"}
              </button>
            </div>
          </details>

          {/* Controls */}
          <details open>
            <summary className="text-xs font-mono text-indigo-400/80 uppercase tracking-wider cursor-pointer select-none pt-2">
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
                    player.position.x = 2850;
                    player.position.y = 860;
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
                Teleport to Goal A
              </button>
              <button
                onClick={() => {
                  const player = playerRef.current;
                  if (player) {
                    player.position.x = 2970;
                    player.position.y = 130;
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
                Teleport to Goal B
              </button>
              <button
                onClick={toggleOverlays}
                className={`w-full rounded px-3 py-1.5 text-xs font-mono transition-colors ${
                  showOverlays
                    ? "bg-indigo-500/20 text-indigo-400"
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
