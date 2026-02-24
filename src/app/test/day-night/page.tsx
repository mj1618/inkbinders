"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { GameCanvas } from "@/components/canvas/GameCanvas";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { Slider } from "@/components/debug/Slider";
import { Engine } from "@/engine/core/Engine";
import { Player, DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";
import { TileMap } from "@/engine/physics/TileMap";
import type { Platform } from "@/engine/physics/TileMap";
import type { SurfaceType } from "@/engine/physics/Surfaces";
import { getSurfaceProps, SURFACE_PROPERTIES } from "@/engine/physics/Surfaces";
import { ParticleSystem } from "@/engine/core/ParticleSystem";
import { ScreenShake } from "@/engine/core/ScreenShake";
import {
  DayNightCycle,
  DEFAULT_DAY_NIGHT_PARAMS,
  type TimeOfDay,
  type DayNightParams,
} from "@/engine/world/DayNightCycle";
import {
  CorruptionModifiers,
  DEFAULT_CORRUPTION_PARAMS,
  type CorruptionParams,
} from "@/engine/world/CorruptionModifiers";
import { DayNightRenderer } from "@/engine/world/DayNightRenderer";
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS } from "@/lib/constants";
import type { PlayerParams } from "@/engine/entities/Player";
import Link from "next/link";

// --- Level Constants ---
const LEVEL_WIDTH = 1920;
const LEVEL_HEIGHT = 540;
const SPAWN_X = 60;
const SPAWN_Y = 420;
const RESPAWN_Y_THRESHOLD = 700;

// --- Ambient Particle Constants ---
const AMBIENT_RATE_DAY = 3; // particles/sec
const AMBIENT_RATE_NIGHT = 5;

/** Store original surface types alongside platforms */
interface PlatformWithOriginal extends Platform {
  originalSurface: SurfaceType;
}

function createTestLevel(): { tileMap: TileMap; originals: PlatformWithOriginal[] } {
  const platforms: Platform[] = [
    // Ground floor (full width)
    { x: 0, y: 460, width: LEVEL_WIDTH, height: 80 },

    // === Left section — normal elevated platform ===
    { x: 100, y: 360, width: 300, height: 20 },
    // Icy section on top
    { x: 160, y: 360, width: 180, height: 20, surfaceType: "icy" as SurfaceType },

    // === Center — bouncy platform (high) ===
    { x: 620, y: 280, width: 160, height: 20, surfaceType: "bouncy" as SurfaceType },

    // === Right section — sticky elevated platform ===
    { x: 1000, y: 340, width: 240, height: 20, surfaceType: "sticky" as SurfaceType },

    // === Ground surface variations ===
    // Conveyor section on the ground floor
    { x: 300, y: 440, width: 200, height: 20, surfaceType: "conveyor" as SurfaceType },

    // Additional platforms at various heights
    { x: 500, y: 400, width: 100, height: 20 },
    { x: 1300, y: 380, width: 120, height: 20 },
    { x: 1500, y: 300, width: 100, height: 20 },
    { x: 1700, y: 360, width: 120, height: 20 },

    // === Walls (for wall-slide testing) ===
    { x: 880, y: 280, width: 20, height: 180 },  // Center wall
    { x: 1400, y: 200, width: 20, height: 260 },  // Right wall

    // Boundaries
    { x: 0, y: 0, width: LEVEL_WIDTH, height: 20 },      // Ceiling
    { x: 0, y: 0, width: 20, height: LEVEL_HEIGHT },       // Left wall
    { x: LEVEL_WIDTH - 20, y: 0, width: 20, height: LEVEL_HEIGHT }, // Right wall
  ];

  const originals: PlatformWithOriginal[] = platforms.map((p) => ({
    ...p,
    originalSurface: (p.surfaceType as SurfaceType) ?? "normal",
  }));

  return { tileMap: new TileMap(platforms), originals };
}

/** Ref type for passing state between React and engine callbacks */
interface EngineRefs {
  showOverlays: boolean;
  cycle: DayNightCycle;
  corruption: CorruptionModifiers;
  particleSystem: ParticleSystem;
  ambientAccumulator: number;
  baseRiseGravity: number;
  baseFallGravity: number;
}

export default function DayNightTest() {
  const engineRef = useRef<Engine | null>(null);
  const playerRef = useRef<Player | null>(null);
  const refsRef = useRef<EngineRefs | null>(null);
  const cleanupRef = useRef<{ handleKeyDown: (e: KeyboardEvent) => void } | null>(null);

  const [showOverlays, setShowOverlays] = useState(true);
  const [params, setParams] = useState<PlayerParams>({ ...DEFAULT_PLAYER_PARAMS });

  // Day/Night cycle state for UI
  const [cycleParams, setCycleParams] = useState<DayNightParams>({
    ...DEFAULT_DAY_NIGHT_PARAMS,
  });
  const [corruptionParams, setCorruptionParams] = useState<CorruptionParams>({
    ...DEFAULT_CORRUPTION_PARAMS,
  });

  // Live readouts
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("dawn");
  const [normalizedTime, setNormalizedTime] = useState(0.25);
  const [lightLevel, setLightLevel] = useState(0.5);
  const [corruptionLevel, setCorruptionLevel] = useState(0);
  const [cycleElapsed, setCycleElapsed] = useState(0);
  const [activeModifiers, setActiveModifiers] = useState<string[]>([]);
  const [gravPulseActive, setGravPulseActive] = useState(false);

  // Visual toggles
  const [showAmbientParticles, setShowAmbientParticles] = useState(true);
  const [showFogOverlay, setShowFogOverlay] = useState(true);
  const [showClockHUD, setShowClockHUD] = useState(true);
  const [showCorruptionDistortion, setShowCorruptionDistortion] = useState(true);

  // Refs for visual toggles (to avoid stale closures)
  const visualTogglesRef = useRef({
    showAmbientParticles: true,
    showFogOverlay: true,
    showClockHUD: true,
    showCorruptionDistortion: true,
  });

  useEffect(() => {
    visualTogglesRef.current = {
      showAmbientParticles,
      showFogOverlay,
      showClockHUD,
      showCorruptionDistortion,
    };
  }, [showAmbientParticles, showFogOverlay, showClockHUD, showCorruptionDistortion]);

  // UI update throttle
  const uiUpdateCounter = useRef(0);

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

  const updateCycleParam = useCallback(
    <K extends keyof DayNightParams>(key: K, value: DayNightParams[K]) => {
      setCycleParams((prev) => {
        const next = { ...prev, [key]: value };
        if (refsRef.current) {
          refsRef.current.cycle.params[key] = value;
        }
        return next;
      });
    },
    [],
  );

  const updateCorruptionParam = useCallback(
    <K extends keyof CorruptionParams>(key: K, value: CorruptionParams[K]) => {
      setCorruptionParams((prev) => {
        const next = { ...prev, [key]: value };
        if (refsRef.current) {
          refsRef.current.corruption.params[key] = value;
        }
        return next;
      });
    },
    [],
  );

  const handleMount = useCallback((ctx: CanvasRenderingContext2D) => {
    const engine = new Engine({ ctx });
    const camera = engine.getCamera();
    const { tileMap, originals } = createTestLevel();

    const player = new Player();
    player.position.x = SPAWN_X;
    player.position.y = SPAWN_Y;
    player.input = engine.getInput();
    player.tileMap = tileMap;

    const particleSystem = new ParticleSystem();
    player.particleSystem = particleSystem;

    const screenShake = new ScreenShake();
    player.screenShake = screenShake;

    engine.getEntities().add(player);

    const cycle = new DayNightCycle();
    const corruption = new CorruptionModifiers();

    const refs: EngineRefs = {
      showOverlays: true,
      cycle,
      corruption,
      particleSystem,
      ambientAccumulator: 0,
      baseRiseGravity: DEFAULT_PLAYER_PARAMS.riseGravity,
      baseFallGravity: DEFAULT_PLAYER_PARAMS.fallGravity,
    };

    engineRef.current = engine;
    playerRef.current = player;
    refsRef.current = refs;

    // Camera setup
    camera.followSpeed = 8.0;
    camera.lookaheadX = 80;
    camera.lookaheadY = 40;

    // Set camera bounds for the level
    const halfW = CANVAS_WIDTH / 2;
    const halfH = CANVAS_HEIGHT / 2;
    camera.bounds = {
      x: halfW,
      y: halfH,
      width: LEVEL_WIDTH - CANVAS_WIDTH,
      height: LEVEL_HEIGHT - CANVAS_HEIGHT,
    };

    // Initial camera position
    camera.snapTo({
      x: SPAWN_X + player.size.x / 2,
      y: SPAWN_Y + player.size.y / 2,
    });

    // --- Keyboard shortcuts for time control ---
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "t" || e.key === "T") {
        cycle.params.running = !cycle.params.running;
        setCycleParams((prev) => ({ ...prev, running: cycle.params.running }));
      }
      if (e.key === "1") cycle.skipTo("dawn");
      if (e.key === "2") cycle.skipTo("day");
      if (e.key === "3") cycle.skipTo("dusk");
      if (e.key === "4") cycle.skipTo("night");
      if (e.key === "d" || e.key === "D") {
        refs.showOverlays = !refs.showOverlays;
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    // --- Update callback ---
    engine.onUpdate((dt) => {
      // Auto-respawn
      if (player.position.y > RESPAWN_Y_THRESHOLD) {
        player.position.x = SPAWN_X;
        player.position.y = SPAWN_Y;
        player.velocity.x = 0;
        player.velocity.y = 0;
        player.size.y = player.params.playerHeight;
        player.grounded = false;
      }

      // Update day/night cycle
      cycle.update(dt);

      // Update corruption modifiers
      corruption.update(
        dt,
        cycle.corruptionIntensity,
        originals.length,
        LEVEL_WIDTH,
        LEVEL_HEIGHT,
      );

      // Apply corruption surface flips
      const platforms = tileMap.platforms;
      for (let i = 0; i < originals.length && i < platforms.length; i++) {
        const orig = originals[i];
        const effective = corruption.getEffectiveSurface(
          orig.originalSurface,
        ) as SurfaceType;
        platforms[i].surfaceType = effective;
      }

      // Apply gravity pulse to player by modifying riseGravity/fallGravity
      // (params.gravity is unused by the Player — states use riseGravity/fallGravity)
      const gravMult = corruption.getGravityMultiplier();
      if (gravMult !== 1.0) {
        // Negative multiplier reverses gravity direction (brief float/rise effect)
        player.params.riseGravity = refs.baseRiseGravity * gravMult;
        player.params.fallGravity = refs.baseFallGravity * gravMult;
      } else {
        player.params.riseGravity = refs.baseRiseGravity;
        player.params.fallGravity = refs.baseFallGravity;
      }

      // Detect ground surface and apply to player
      const groundSurfaceType = tileMap.getGroundSurface(player);
      player.currentSurface = getSurfaceProps(groundSurfaceType);

      if (player.wallSide !== 0) {
        const wallSurfaceType = tileMap.getWallSurface(
          player,
          player.wallSide as 1 | -1,
        );
        player.currentWallSurface = getSurfaceProps(wallSurfaceType);
      }

      // Camera follow
      camera.follow(
        {
          x: player.position.x + player.size.x / 2,
          y: player.position.y + player.size.y / 2,
        },
        player.velocity,
        dt,
      );

      // Spawn ink bleed particles
      for (const pos of corruption.pendingInkBleeds) {
        // Convert from level-space random to world-space (near camera view)
        const viewBounds = camera.getViewportBounds();
        particleSystem.emit({
          x: viewBounds.x + Math.random() * viewBounds.width,
          y: viewBounds.y + Math.random() * viewBounds.height,
          count: 1,
          speedMin: 10,
          speedMax: 40,
          angleMin: 0,
          angleMax: Math.PI * 2,
          lifeMin: 0.3,
          lifeMax: 0.8,
          sizeMin: 2,
          sizeMax: 5,
          colors: ["#4338ca", "#6366f1", "#1e1b4b", "#312e81"],
          gravity: 30,
        });
      }

      // Spawn ambient particles based on time of day
      if (visualTogglesRef.current.showAmbientParticles) {
        const atmosphere = cycle.getAtmosphere();
        const rate =
          cycle.timeOfDay === "night"
            ? AMBIENT_RATE_NIGHT
            : cycle.timeOfDay === "dawn" || cycle.timeOfDay === "dusk"
              ? (AMBIENT_RATE_DAY + AMBIENT_RATE_NIGHT) / 2
              : AMBIENT_RATE_DAY;

        refs.ambientAccumulator += rate * dt;

        while (refs.ambientAccumulator >= 1) {
          refs.ambientAccumulator -= 1;
          const viewBounds = camera.getViewportBounds();
          const isNight = cycle.timeOfDay === "night";
          particleSystem.emit({
            x: viewBounds.x + Math.random() * viewBounds.width,
            y: viewBounds.y + Math.random() * viewBounds.height * 0.8,
            count: 1,
            speedMin: isNight ? 5 : 2,
            speedMax: isNight ? 30 : 10,
            angleMin: isNight ? 0 : Math.PI * 0.3,
            angleMax: isNight ? Math.PI * 2 : Math.PI * 0.7,
            lifeMin: 1.5,
            lifeMax: 3.0,
            sizeMin: 1,
            sizeMax: isNight ? 3 : 2,
            colors: atmosphere.ambientParticleColors,
            gravity: isNight ? 0 : 10,
          });
        }
      }

      // Update particles
      particleSystem.update(dt);

      // Update screen shake
      screenShake.update();

      // UI readout updates (throttled to ~10Hz)
      uiUpdateCounter.current++;
      if (uiUpdateCounter.current % 6 === 0) {
        setTimeOfDay(cycle.timeOfDay);
        setNormalizedTime(cycle.time);
        setLightLevel(cycle.lightLevel);
        setCorruptionLevel(cycle.corruptionIntensity);
        setCycleElapsed(cycle.cycleElapsed);
        setGravPulseActive(corruption.gravityPulseActive);
        setActiveModifiers(
          corruption.modifiers
            .filter((m) => m.active)
            .map((m) => m.type),
        );
      }
    });

    // --- Render callback (world-space, runs with camera applied) ---
    engine.onRender((renderer, interpolation) => {
      const atmosphere = cycle.getAtmosphere();
      const ctx = renderer.getContext();

      // Background — fill with atmosphere color (behind camera transform)
      // We need to render this in screen space, so we'll use resetCamera/applyCamera
      renderer.resetCamera();
      DayNightRenderer.renderBackground(ctx, atmosphere, CANVAS_WIDTH, CANVAS_HEIGHT);
      renderer.applyCamera(camera);

      // Render tilemap with surface colors
      const platforms = tileMap.platforms;
      for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i];
        const surfaceType = (p.surfaceType as SurfaceType) ?? "normal";
        const color = SURFACE_PROPERTIES[surfaceType].color;
        const darkened = darkenColor(color, 0.3);

        // Flicker effect
        if (corruption.isPlatformFlickering(i)) {
          ctx.globalAlpha = 0.4 + Math.random() * 0.6;
        }

        // Fill platform
        ctx.fillStyle = darkened;
        ctx.fillRect(p.x, p.y, p.width, p.height);

        // Outline
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(p.x, p.y, p.width, p.height);

        // Platform darkness overlay
        DayNightRenderer.renderPlatformDarkness(
          ctx,
          p.x,
          p.y,
          p.width,
          p.height,
          atmosphere.platformDarkness,
          corruption.isPlatformFlickering(i),
        );

        // Platform shadow
        DayNightRenderer.renderPlatformShadow(
          ctx,
          p.x,
          p.y,
          p.width,
          p.height,
          atmosphere.shadowOpacity,
        );

        ctx.globalAlpha = 1;
      }

      // Render particles (in world space)
      particleSystem.render(renderer);

      // --- Debug overlays (world-space) ---
      if (refs.showOverlays) {
        const pos = player.getInterpolatedPosition(interpolation);
        const state = player.stateMachine.getCurrentState();

        // Hitbox outline (cyan)
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

        // Surface labels on platforms (show effective surface during corruption)
        for (let i = 0; i < originals.length && i < platforms.length; i++) {
          const p = platforms[i];
          const orig = originals[i];
          const effective = (p.surfaceType as SurfaceType) ?? "normal";
          if (effective !== "normal" || orig.originalSurface !== "normal") {
            const label =
              orig.originalSurface !== effective
                ? `${orig.originalSurface} → ${effective}`
                : effective;
            renderer.drawText(
              label,
              p.x + 4,
              p.y - 4,
              "#ffffff",
              9,
            );
          }
        }
      }
    });

    // --- Screen-space debug layer ---
    const debugLayerCallback = (ctx: CanvasRenderingContext2D) => {
      const atmosphere = cycle.getAtmosphere();

      // Light tint overlay (screen-space)
      DayNightRenderer.renderLightOverlay(
        ctx,
        atmosphere,
        CANVAS_WIDTH,
        CANVAS_HEIGHT,
      );

      // Fog overlay
      if (visualTogglesRef.current.showFogOverlay && atmosphere.fogColor !== "rgba(0, 0, 0, 0)") {
        DayNightRenderer.renderFog(ctx, atmosphere.fogColor, CANVAS_WIDTH, CANVAS_HEIGHT);
      }

      // Fog-of-war (radial visibility)
      if (corruption.isFogActive()) {
        const playerScreenPos = camera.worldToScreen({
          x: player.position.x + player.size.x / 2,
          y: player.position.y + player.size.y / 2,
        });
        DayNightRenderer.renderFogOfWar(
          ctx,
          playerScreenPos,
          corruption.getFogRadius(),
          "rgba(10, 10, 26, 0.85)",
          CANVAS_WIDTH,
          CANVAS_HEIGHT,
        );
      }

      // Corruption distortion
      if (visualTogglesRef.current.showCorruptionDistortion) {
        DayNightRenderer.renderCorruptionDistortion(
          ctx,
          cycle.corruptionIntensity,
          CANVAS_WIDTH,
          CANVAS_HEIGHT,
        );
      }

      // Clock HUD
      if (visualTogglesRef.current.showClockHUD) {
        DayNightRenderer.renderClockHUDDefault(
          ctx,
          cycle.time,
          cycle.timeOfDay,
          CANVAS_WIDTH,
        );
      }

      if (!refs.showOverlays) return;

      const metrics = engine.getMetrics();

      // FPS counter (top-left)
      ctx.fillStyle = COLORS.debug.ground;
      ctx.font = "12px monospace";
      ctx.fillText(`FPS: ${Math.round(metrics.fps)}`, 8, 16);

      // Time-of-day label (top-left, below FPS)
      const todColors: Record<TimeOfDay, string> = {
        dawn: "#f472b6",
        day: "#fbbf24",
        dusk: "#ea580c",
        night: "#818cf8",
      };
      ctx.fillStyle = todColors[cycle.timeOfDay];
      ctx.font = "14px monospace";
      ctx.fillText(cycle.timeOfDay.toUpperCase(), 8, 34);

      // Light + Corruption readout
      ctx.fillStyle = "#d4d4d8";
      ctx.font = "11px monospace";
      ctx.fillText(`Light: ${cycle.lightLevel.toFixed(2)}`, 8, 50);
      ctx.fillText(`Corruption: ${cycle.corruptionIntensity.toFixed(2)}`, 8, 64);

      // Active modifiers list
      const mods = corruption.modifiers.filter((m) => m.active);
      if (mods.length > 0) {
        ctx.fillStyle = "#ef4444";
        ctx.fillText(
          mods.map((m) => m.type).join(" | "),
          8,
          78,
        );
      }

      // Gravity pulse flash
      if (corruption.gravityPulseActive) {
        ctx.fillStyle = "rgba(239, 68, 68, 0.3)";
        ctx.fillRect(0, 0, CANVAS_WIDTH, 4);
        ctx.fillStyle = "#ef4444";
        ctx.font = "12px monospace";
        ctx.fillText("GRAVITY PULSE!", 8, 96);
      }

      // Velocity readout (top-right, below clock)
      ctx.fillStyle = COLORS.debug.velocity;
      ctx.textAlign = "right";
      ctx.font = "11px monospace";
      ctx.fillText(
        `Vel: (${Math.round(player.velocity.x)}, ${Math.round(player.velocity.y)})`,
        CANVAS_WIDTH - 8,
        CANVAS_HEIGHT - 24,
      );
      ctx.fillText(
        `Pos: (${Math.round(player.position.x)}, ${Math.round(player.position.y)})`,
        CANVAS_WIDTH - 8,
        CANVAS_HEIGHT - 10,
      );
      ctx.textAlign = "left";

      // Player state diagnostics (bottom-left)
      const diagX = 8;
      const diagY = CANVAS_HEIGHT - 60;
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(diagX - 4, diagY - 14, 220, 68);
      ctx.fillStyle = "#a78bfa";
      ctx.font = "11px monospace";
      ctx.fillText(
        `State: ${player.stateMachine.getCurrentState()}`,
        diagX,
        diagY,
      );
      ctx.fillText(
        `Grounded: ${player.grounded ? "YES" : "NO"}`,
        diagX,
        diagY + 14,
      );
      ctx.fillText(
        `Surface: ${player.currentSurface.label}`,
        diagX,
        diagY + 28,
      );
      ctx.fillText(
        `Particles: ${particleSystem.getCount()}`,
        diagX,
        diagY + 42,
      );
    };
    engine.getRenderer().addLayerCallback("debug", debugLayerCallback);

    engine.start();

    // Store cleanup reference
    cleanupRef.current = { handleKeyDown };
  }, []);

  const handleUnmount = useCallback(() => {
    if (cleanupRef.current) {
      window.removeEventListener("keydown", cleanupRef.current.handleKeyDown);
      cleanupRef.current = null;
    }
    engineRef.current?.stop();
    engineRef.current = null;
    playerRef.current = null;
    refsRef.current = null;
  }, []);

  const skipTo = useCallback((tod: TimeOfDay) => {
    if (refsRef.current) {
      refsRef.current.cycle.skipTo(tod);
    }
  }, []);

  const togglePause = useCallback(() => {
    if (refsRef.current) {
      const cycle = refsRef.current.cycle;
      cycle.params.running = !cycle.params.running;
      setCycleParams((prev) => ({ ...prev, running: cycle.params.running }));
    }
  }, []);

  const setManualTime = useCallback((t: number) => {
    if (refsRef.current) {
      refsRef.current.cycle.params.running = false;
      refsRef.current.cycle.setTime(t);
      setCycleParams((prev) => ({ ...prev, running: false }));
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
          Day/Night Cycle
        </h1>
        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-mono text-amber-400">
          Phase 4 — World Systems
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
            Cycle auto-advances (120s) &middot;
            Smooth 4-phase transitions (dawn/day/dusk/night) &middot;
            Background color interpolates &middot;
            Clock HUD with sun/moon &middot;
            Ambient particles per time-of-day &middot;
            Corruption rises at night &middot;
            Surface Flip changes platforms &middot;
            Gravity Pulse fires at deep night &middot;
            Fog-of-war shrinks visibility &middot;
            Ink bleed particles at night &middot;
            Platform flicker visual &middot;
            Skip-to buttons &middot;
            Time scrubber &middot;
            Pause/Resume &middot;
            All sliders tune live &middot;
            Cycle loops seamlessly
          </div>

          {/* Controls hint */}
          <div className="w-[960px] text-xs font-mono text-zinc-600">
            Keys: Arrows=Move, Space/Z/Up=Jump, X/Shift=Dash, D=Debug, T=Pause/Resume, 1-4=Skip to Dawn/Day/Dusk/Night
          </div>
        </div>

        {/* Debug panel */}
        <DebugPanel title="Day/Night">
          {/* Cycle Info (always visible) */}
          <div className="flex flex-col gap-1 text-xs font-mono">
            <div className="text-zinc-400 uppercase tracking-wider text-[10px]">
              Cycle Info
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Time of Day:</span>
              <span
                className={
                  timeOfDay === "day"
                    ? "text-amber-400"
                    : timeOfDay === "dawn"
                      ? "text-pink-400"
                      : timeOfDay === "dusk"
                        ? "text-orange-500"
                        : "text-indigo-400"
                }
              >
                {timeOfDay.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Time:</span>
              <span className="text-zinc-300">{normalizedTime.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Light:</span>
              <span className="text-zinc-300">{lightLevel.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Corruption:</span>
              <span className={corruptionLevel > 0.5 ? "text-red-400" : "text-zinc-300"}>
                {corruptionLevel.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Elapsed:</span>
              <span className="text-zinc-300">
                {cycleElapsed.toFixed(1)}s / {cycleParams.cycleDuration}s
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Time Scale:</span>
              <span className="text-zinc-300">{cycleParams.timeScale.toFixed(1)}x</span>
            </div>
            {gravPulseActive && (
              <div className="text-red-400 animate-pulse">GRAVITY PULSE ACTIVE</div>
            )}
            {activeModifiers.length > 0 && (
              <div className="text-red-300 text-[10px] leading-tight">
                Active: {activeModifiers.join(", ")}
              </div>
            )}
          </div>

          {/* Time Controls */}
          <details open>
            <summary className="text-xs font-mono text-amber-500/80 uppercase tracking-wider cursor-pointer select-none pt-2">
              Time Controls
            </summary>
            <div className="flex flex-col gap-3 pt-2">
              <Slider
                label="Cycle Duration (s)"
                value={cycleParams.cycleDuration}
                min={20}
                max={600}
                step={10}
                onChange={(v) => updateCycleParam("cycleDuration", v)}
              />
              <Slider
                label="Day Fraction"
                value={cycleParams.dayFraction}
                min={0.2}
                max={0.8}
                step={0.05}
                onChange={(v) => updateCycleParam("dayFraction", v)}
              />
              <Slider
                label="Dawn Duration (s)"
                value={cycleParams.dawnDuration}
                min={2}
                max={20}
                step={1}
                onChange={(v) => updateCycleParam("dawnDuration", v)}
              />
              <Slider
                label="Dusk Duration (s)"
                value={cycleParams.duskDuration}
                min={2}
                max={20}
                step={1}
                onChange={(v) => updateCycleParam("duskDuration", v)}
              />
              <Slider
                label="Time Scale"
                value={cycleParams.timeScale}
                min={0.1}
                max={10.0}
                step={0.1}
                onChange={(v) => updateCycleParam("timeScale", v)}
              />
              <Slider
                label="Manual Time"
                value={normalizedTime}
                min={0}
                max={1}
                step={0.005}
                onChange={(v) => setManualTime(v)}
              />
              <div className="flex gap-1 flex-wrap">
                <button
                  onClick={togglePause}
                  className={`rounded px-2 py-1 text-xs font-mono transition-colors ${
                    cycleParams.running
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {cycleParams.running ? "Pause" : "Resume"}
                </button>
                <button
                  onClick={() => skipTo("dawn")}
                  className="rounded bg-pink-500/20 px-2 py-1 text-xs font-mono text-pink-400 hover:bg-pink-500/30"
                >
                  Dawn
                </button>
                <button
                  onClick={() => skipTo("day")}
                  className="rounded bg-amber-500/20 px-2 py-1 text-xs font-mono text-amber-400 hover:bg-amber-500/30"
                >
                  Day
                </button>
                <button
                  onClick={() => skipTo("dusk")}
                  className="rounded bg-orange-500/20 px-2 py-1 text-xs font-mono text-orange-400 hover:bg-orange-500/30"
                >
                  Dusk
                </button>
                <button
                  onClick={() => skipTo("night")}
                  className="rounded bg-indigo-500/20 px-2 py-1 text-xs font-mono text-indigo-400 hover:bg-indigo-500/30"
                >
                  Night
                </button>
              </div>
            </div>
          </details>

          {/* Corruption Modifiers */}
          <details open>
            <summary className="text-xs font-mono text-red-400 uppercase tracking-wider cursor-pointer select-none pt-2">
              Corruption Modifiers
            </summary>
            <div className="flex flex-col gap-3 pt-2">
              <label className="flex items-center gap-2 text-xs font-mono text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={corruptionParams.enabled}
                  onChange={(e) =>
                    updateCorruptionParam("enabled", e.target.checked)
                  }
                  className="accent-red-500"
                />
                Corruption Enabled
              </label>
              <Slider
                label="Gravity Pulse Interval"
                value={corruptionParams.gravityPulseInterval}
                min={1.0}
                max={20.0}
                step={0.5}
                onChange={(v) => updateCorruptionParam("gravityPulseInterval", v)}
              />
              <Slider
                label="Gravity Pulse Duration"
                value={corruptionParams.gravityPulseDuration}
                min={0.1}
                max={2.0}
                step={0.1}
                onChange={(v) =>
                  updateCorruptionParam("gravityPulseDuration", v)
                }
              />
              <Slider
                label="Gravity Pulse Mult"
                value={corruptionParams.gravityPulseMultiplier}
                min={-2.0}
                max={0.0}
                step={0.1}
                onChange={(v) =>
                  updateCorruptionParam("gravityPulseMultiplier", v)
                }
              />
              <Slider
                label="Fog Min Radius"
                value={corruptionParams.fogMinRadius}
                min={40}
                max={300}
                step={10}
                onChange={(v) => updateCorruptionParam("fogMinRadius", v)}
              />
              <Slider
                label="Fog Max Radius"
                value={corruptionParams.fogMaxRadius}
                min={200}
                max={960}
                step={20}
                onChange={(v) => updateCorruptionParam("fogMaxRadius", v)}
              />
              <Slider
                label="Ink Bleed Rate"
                value={corruptionParams.inkBleedRate}
                min={0}
                max={30}
                step={1}
                onChange={(v) => updateCorruptionParam("inkBleedRate", v)}
              />
              <Slider
                label="Platform Flicker"
                value={corruptionParams.platformFlickerChance}
                min={0.0}
                max={0.05}
                step={0.001}
                onChange={(v) =>
                  updateCorruptionParam("platformFlickerChance", v)
                }
              />
            </div>
          </details>

          {/* Visual Settings */}
          <details>
            <summary className="text-xs font-mono text-cyan-400 uppercase tracking-wider cursor-pointer select-none pt-2">
              Visual Settings
            </summary>
            <div className="flex flex-col gap-2 pt-2">
              <label className="flex items-center gap-2 text-xs font-mono text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAmbientParticles}
                  onChange={(e) => setShowAmbientParticles(e.target.checked)}
                  className="accent-cyan-500"
                />
                Ambient Particles
              </label>
              <label className="flex items-center gap-2 text-xs font-mono text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showFogOverlay}
                  onChange={(e) => setShowFogOverlay(e.target.checked)}
                  className="accent-cyan-500"
                />
                Fog Overlay
              </label>
              <label className="flex items-center gap-2 text-xs font-mono text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showClockHUD}
                  onChange={(e) => setShowClockHUD(e.target.checked)}
                  className="accent-cyan-500"
                />
                Clock HUD
              </label>
              <label className="flex items-center gap-2 text-xs font-mono text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCorruptionDistortion}
                  onChange={(e) =>
                    setShowCorruptionDistortion(e.target.checked)
                  }
                  className="accent-cyan-500"
                />
                Corruption Distortion
              </label>
            </div>
          </details>

          {/* Player State */}
          <details>
            <summary className="text-xs font-mono text-zinc-500 uppercase tracking-wider cursor-pointer select-none pt-2">
              Player Movement
            </summary>
            <div className="flex flex-col gap-3 pt-2">
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
                label="Rise Gravity"
                value={params.riseGravity}
                min={200}
                max={1500}
                step={50}
                onChange={(v) => {
                  updateParam("riseGravity", v);
                  if (refsRef.current) refsRef.current.baseRiseGravity = v;
                }}
              />
              <Slider
                label="Fall Gravity"
                value={params.fallGravity}
                min={400}
                max={2000}
                step={50}
                onChange={(v) => {
                  updateParam("fallGravity", v);
                  if (refsRef.current) refsRef.current.baseFallGravity = v;
                }}
              />
              <Slider
                label="Max Fall Speed"
                value={params.maxFallSpeed}
                min={200}
                max={1200}
                step={50}
                onChange={(v) => updateParam("maxFallSpeed", v)}
              />
            </div>
          </details>

          {/* Buttons */}
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => {
                const player = playerRef.current;
                if (player) {
                  player.position.x = SPAWN_X;
                  player.position.y = SPAWN_Y;
                  player.velocity.x = 0;
                  player.velocity.y = 0;
                }
              }}
              className="w-full rounded bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              Reset Player
            </button>
            <button
              onClick={() => {
                if (refsRef.current) {
                  refsRef.current.cycle.reset();
                  refsRef.current.corruption.reset();
                }
              }}
              className="w-full rounded bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              Reset Cycle
            </button>
            <button
              onClick={() => {
                setShowOverlays((prev) => {
                  const next = !prev;
                  if (refsRef.current) {
                    refsRef.current.showOverlays = next;
                  }
                  return next;
                });
              }}
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

/** Darken a hex color by a factor (0 = original, 1 = black) */
function darkenColor(hex: string, factor: number): string {
  const h = hex.replace("#", "");
  const r = Math.round(parseInt(h.slice(0, 2), 16) * (1 - factor));
  const g = Math.round(parseInt(h.slice(2, 4), 16) * (1 - factor));
  const b = Math.round(parseInt(h.slice(4, 6), 16) * (1 - factor));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
