"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { GameCanvas } from "@/components/canvas/GameCanvas";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { RenderModeToggle } from "@/components/debug/RenderModeToggle";
import { Slider } from "@/components/debug/Slider";
import { Engine } from "@/engine/core/Engine";
import { RenderConfig } from "@/engine/core/RenderConfig";
import { AssetManager } from "@/engine/core/AssetManager";
import { Player } from "@/engine/entities/Player";
import { PLAYER_SPRITE_CONFIGS } from "@/engine/entities/PlayerSprites";
import { TileMap } from "@/engine/physics/TileMap";
import { ParticleSystem } from "@/engine/core/ParticleSystem";
import { ScreenShake } from "@/engine/core/ScreenShake";
import {
  BiomeBackground,
  createBackgroundForBiome,
} from "@/engine/world/BiomeBackground";
import { AmbientAtmosphere, createScribeHallAtmosphere } from "@/engine/world/AmbientAtmosphere";
import { BIOME_BACKGROUND_LAYERS } from "@/engine/world/BiomeBackgroundSprites";
import { preloadBiomeBackground } from "@/engine/world/BiomeBackgroundSprites";
import { loadTileSprites } from "@/engine/world/TileSprites";
import { SCRIBE_HALL } from "@/engine/world/scribeHall";
import { COLORS, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/constants";
import type { Vec2 } from "@/lib/types";
import Link from "next/link";

// ─── Types ──────────────────────────────────────────────────────────

type ViewMode = "full" | "layer-isolation" | "parallax-scroll" | "tile-preview";

// ─── Constants ──────────────────────────────────────────────────────

const ROOM = SCRIBE_HALL;
const SPAWN = ROOM.defaultSpawn ?? { x: 960, y: 1000 };

const DEFAULT_LAYER_NAMES = [
  "L0: Sky (0.02)",
  "L1: Far-deep (0.08)",
  "L2: Mid-detail (0.20)",
  "L3: Near-detail (0.40)",
  "L4: FG-near (1.15)",
  "L5: FG-far (1.40)",
];

// ─── Engine ref extensions ──────────────────────────────────────────

interface EngineRefs extends Engine {
  __viewModeRef?: { current: ViewMode };
  __layerVisRef?: { current: boolean[] };
  __parallaxRef?: { current: number[] };
  __opacityRef?: { current: number[] };
  __autoScrollRef?: { current: number };
  __zoomRef?: { current: number };
  __followRef?: { current: boolean };
  __showGridRef?: { current: boolean };
  __showPlatOutlineRef?: { current: boolean };
  __showLayerBoundsRef?: { current: boolean };
  __fgOverPlayerRef?: { current: boolean };
  __isolatedLayerRef?: { current: number };
  __cleanup?: () => void;
}

// ─── Component ──────────────────────────────────────────────────────

export default function EnvironmentShowcaseTest() {
  const engineRef = useRef<Engine | null>(null);
  const playerRef = useRef<Player | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgRef = useRef<BiomeBackground | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("full");
  const [layerVisibility, setLayerVisibility] = useState<boolean[]>([true, true, true, true, true, true]);
  const [parallaxFactors, setParallaxFactors] = useState<number[]>([0.02, 0.08, 0.20, 0.40, 1.15, 1.40]);
  const [opacityValues, setOpacityValues] = useState<number[]>([1.0, 1.0, 1.0, 1.0, 0.25, 0.15]);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState(30);
  const [zoom, setZoom] = useState(1.0);
  const [followPlayer, setFollowPlayer] = useState(true);
  const [showTileGrid, setShowTileGrid] = useState(false);
  const [showPlatformOutlines, setShowPlatformOutlines] = useState(false);
  const [showLayerBounds, setShowLayerBounds] = useState(false);
  const [fgOverPlayer, setFgOverPlayer] = useState(true);
  const [isolatedLayer, setIsolatedLayer] = useState(0);
  const [cameraX, setCameraX] = useState(SPAWN.x);
  const [cameraY, setCameraY] = useState(SPAWN.y);
  const [layerNames, setLayerNames] = useState<string[]>(DEFAULT_LAYER_NAMES);

  // ─── Sync refs for game loop ────────────────────────────────────

  useEffect(() => {
    const e = engineRef.current as EngineRefs | null;
    if (e?.__viewModeRef) e.__viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    const e = engineRef.current as EngineRefs | null;
    if (e?.__layerVisRef) e.__layerVisRef.current = layerVisibility;
  }, [layerVisibility]);

  useEffect(() => {
    const e = engineRef.current as EngineRefs | null;
    if (e?.__parallaxRef) e.__parallaxRef.current = parallaxFactors;
  }, [parallaxFactors]);

  useEffect(() => {
    const e = engineRef.current as EngineRefs | null;
    if (e?.__opacityRef) e.__opacityRef.current = opacityValues;
  }, [opacityValues]);

  useEffect(() => {
    const e = engineRef.current as EngineRefs | null;
    if (e?.__autoScrollRef) e.__autoScrollRef.current = autoScrollSpeed;
  }, [autoScrollSpeed]);

  useEffect(() => {
    const e = engineRef.current as EngineRefs | null;
    if (e?.__zoomRef) e.__zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    const e = engineRef.current as EngineRefs | null;
    if (e?.__followRef) e.__followRef.current = followPlayer;
  }, [followPlayer]);

  useEffect(() => {
    const e = engineRef.current as EngineRefs | null;
    if (e?.__showGridRef) e.__showGridRef.current = showTileGrid;
  }, [showTileGrid]);

  useEffect(() => {
    const e = engineRef.current as EngineRefs | null;
    if (e?.__showPlatOutlineRef) e.__showPlatOutlineRef.current = showPlatformOutlines;
  }, [showPlatformOutlines]);

  useEffect(() => {
    const e = engineRef.current as EngineRefs | null;
    if (e?.__showLayerBoundsRef) e.__showLayerBoundsRef.current = showLayerBounds;
  }, [showLayerBounds]);

  useEffect(() => {
    const e = engineRef.current as EngineRefs | null;
    if (e?.__fgOverPlayerRef) e.__fgOverPlayerRef.current = fgOverPlayer;
  }, [fgOverPlayer]);

  useEffect(() => {
    const e = engineRef.current as EngineRefs | null;
    if (e?.__isolatedLayerRef) e.__isolatedLayerRef.current = isolatedLayer;
  }, [isolatedLayer]);

  // ─── Engine mount ─────────────────────────────────────────────────

  const handleMount = useCallback((ctx: CanvasRenderingContext2D) => {
    RenderConfig.setMode("both");
    const engine = new Engine({ ctx });
    const camera = engine.getCamera();
    const input = engine.getInput();
    const tileMap = new TileMap(ROOM.platforms);
    tileMap.setBiomeId(ROOM.biomeId);

    camera.bounds = { x: 0, y: 0, width: ROOM.width, height: ROOM.height };

    // Player setup
    const player = new Player();
    player.position.x = SPAWN.x;
    player.position.y = SPAWN.y;
    player.input = input;
    player.tileMap = tileMap;

    const particleSystem = new ParticleSystem();
    const screenShake = new ScreenShake();
    player.particleSystem = particleSystem;
    player.screenShake = screenShake;

    engine.getEntities().add(player);

    engineRef.current = engine;
    playerRef.current = player;
    canvasRef.current = ctx.canvas;

    // ─── Refs for game loop ───────────────────────────────────────

    const viewModeRef: { current: ViewMode } = { current: "full" };
    const layerVisRef = { current: [true, true, true, true, true, true] };
    const parallaxRef = { current: [0.02, 0.08, 0.20, 0.40, 1.15, 1.40] };
    const opacityRef = { current: [1.0, 1.0, 1.0, 1.0, 0.25, 0.15] };
    const autoScrollRef = { current: 30 };
    const zoomRef = { current: 1.0 };
    const followRef = { current: true };
    const showGridRef = { current: false };
    const showPlatOutlineRef = { current: false };
    const showLayerBoundsRef = { current: false };
    const fgOverPlayerRef = { current: true };
    const isolatedLayerRef = { current: 0 };

    const eRef = engine as EngineRefs;
    eRef.__viewModeRef = viewModeRef;
    eRef.__layerVisRef = layerVisRef;
    eRef.__parallaxRef = parallaxRef;
    eRef.__opacityRef = opacityRef;
    eRef.__autoScrollRef = autoScrollRef;
    eRef.__zoomRef = zoomRef;
    eRef.__followRef = followRef;
    eRef.__showGridRef = showGridRef;
    eRef.__showPlatOutlineRef = showPlatOutlineRef;
    eRef.__showLayerBoundsRef = showLayerBoundsRef;
    eRef.__fgOverPlayerRef = fgOverPlayerRef;
    eRef.__isolatedLayerRef = isolatedLayerRef;

    // ─── Load assets ──────────────────────────────────────────────

    let background: BiomeBackground | null = null;
    const atmosphereInstance: AmbientAtmosphere | null =
      ROOM.biomeId === "scribe-hall" ? createScribeHallAtmosphere() : null;

    const assetManager = AssetManager.getInstance();
    Promise.all([
      preloadBiomeBackground(ROOM.biomeId),
      loadTileSprites(),
      assetManager.loadAll(PLAYER_SPRITE_CONFIGS),
    ]).then(() => {
      background = createBackgroundForBiome(ROOM.biomeId, ROOM.width, ROOM.height);
      bgRef.current = background;

      // Update layer names from actual background data
      const bgLayers = BIOME_BACKGROUND_LAYERS[ROOM.biomeId];
      if (bgLayers) {
        const names = bgLayers.map(
          (l, i) => `L${i}: ${l.description.split(",")[0]} (${l.parallaxFactor.toFixed(2)})`,
        );
        // Dispatch custom event to update React state
        ctx.canvas.dispatchEvent(new CustomEvent("layers-loaded", { detail: names }));
      }
    });

    // Listen for layer name updates
    const handleLayersLoaded = (e: Event) => {
      const ce = e as CustomEvent<string[]>;
      setLayerNames(ce.detail);
    };
    ctx.canvas.addEventListener("layers-loaded", handleLayersLoaded);

    // Snap camera to spawn
    camera.snapTo({ x: SPAWN.x, y: SPAWN.y });

    // Auto-scroll accumulator
    let autoScrollX = SPAWN.x;

    // ─── Update callback ──────────────────────────────────────────

    engine.onUpdate((dt) => {
      const mode = viewModeRef.current;

      // Camera zoom
      camera.zoom = zoomRef.current;

      if (mode === "parallax-scroll") {
        // Auto-scroll camera
        autoScrollX += autoScrollRef.current * dt;
        // Wrap within room bounds
        if (autoScrollX < 0) autoScrollX = ROOM.width;
        if (autoScrollX > ROOM.width) autoScrollX = 0;
        camera.position.x = autoScrollX;
        camera.position.y = ROOM.height / 2;
      } else if (mode === "tile-preview") {
        camera.position.x = CANVAS_WIDTH / 2;
        camera.position.y = CANVAS_HEIGHT / 2;
      } else {
        // Full or layer-isolation: player control
        if (player.position.y > ROOM.height + 100) {
          player.position.x = SPAWN.x;
          player.position.y = SPAWN.y;
          player.velocity.x = 0;
          player.velocity.y = 0;
          player.grounded = false;
        }

        if (followRef.current) {
          const playerCenter: Vec2 = {
            x: player.position.x + player.size.x / 2,
            y: player.position.y + player.size.y / 2,
          };
          camera.follow(playerCenter, player.velocity, dt);
        }

        particleSystem.update(dt);
        const shakeOffset = screenShake.update();
        camera.position.x += shakeOffset.offsetX;
        camera.position.y += shakeOffset.offsetY;
      }

      // Atmosphere update
      if (atmosphereInstance) {
        atmosphereInstance.update(
          dt,
          camera.position.x - CANVAS_WIDTH / 2,
          camera.position.y - CANVAS_HEIGHT / 2,
          CANVAS_WIDTH,
          CANVAS_HEIGHT,
        );
      }

      // Broadcast camera position for React UI
      ctx.canvas.dispatchEvent(
        new CustomEvent("camera-update", {
          detail: { x: Math.round(camera.position.x), y: Math.round(camera.position.y) },
        }),
      );
    });

    // Camera position updates
    const handleCameraUpdate = (e: Event) => {
      const ce = e as CustomEvent<{ x: number; y: number }>;
      setCameraX(ce.detail.x);
      setCameraY(ce.detail.y);
    };
    ctx.canvas.addEventListener("camera-update", handleCameraUpdate);

    // ─── Render callback ──────────────────────────────────────────

    engine.onRender((renderer, interpolation) => {
      const mode = viewModeRef.current;
      const rCtx = renderer.getContext();

      if (mode === "tile-preview") {
        // Tile preview mode — show tile variants on dark canvas
        // Reset camera transform so we draw in screen space
        renderer.resetCamera();
        rCtx.save();
        rCtx.fillStyle = "#18181b";
        rCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        const assetManager = AssetManager.getInstance();
        const tileSheet = assetManager.getSpriteSheet("tiles-scribe-hall");
        const frameNames = ["FLOOR", "BLOCK", "COLUMN", "WALL"];

        if (tileSheet && tileSheet.isLoaded()) {
          const zooms = [1, 2, 4];
          const startY = 60;
          let yOffset = startY;

          for (let z = 0; z < zooms.length; z++) {
            const scale = zooms[z];
            const drawSize = 32 * scale;

            rCtx.fillStyle = "#a1a1aa";
            rCtx.font = "12px monospace";
            rCtx.fillText(`${scale}x (${drawSize}x${drawSize})`, 20, yOffset - 8);

            for (let f = 0; f < 4; f++) {
              const drawX = 20 + f * (drawSize + 16);
              tileSheet.drawFrame(rCtx, f, drawX, yOffset, false, scale, scale);

              // Frame label
              rCtx.fillStyle = "#71717a";
              rCtx.font = "10px monospace";
              rCtx.textAlign = "center";
              rCtx.fillText(
                `${f}: ${frameNames[f]}`,
                drawX + drawSize / 2,
                yOffset + drawSize + 14,
              );
              rCtx.textAlign = "left";
            }
            yOffset += drawSize + 36;
          }
        } else {
          rCtx.fillStyle = "#71717a";
          rCtx.font = "14px monospace";
          rCtx.fillText("Loading tile sprites...", 40, 80);
        }

        rCtx.restore();
        // Re-apply camera transform so the engine's resetCamera() in render() is balanced
        renderer.applyCamera(camera);
        return;
      }

      // Background layers — render in screen space (same as BiomeBackground.render())
      // because each layer applies its own parallax offset relative to the camera
      if (background) {
        renderer.resetCamera();

        const camX = camera.position.x - CANVAS_WIDTH / 2;
        const camY = camera.position.y - CANVAS_HEIGHT / 2;

        for (let i = 0; i < background.layers.length; i++) {
          const layer = background.layers[i];

          // Visibility check
          if (mode === "layer-isolation" && i !== isolatedLayerRef.current) continue;
          if (mode !== "layer-isolation" && !layerVisRef.current[i]) continue;

          // Apply parallax override
          const origParallax = layer.parallaxFactor;
          layer.parallaxFactor = parallaxRef.current[i] ?? origParallax;

          // Apply opacity override
          const prevAlpha = rCtx.globalAlpha;
          rCtx.globalAlpha = opacityRef.current[i] ?? 1.0;

          rCtx.save();
          const offsetX = -camX * layer.parallaxFactor;
          const offsetY = -camY * layer.parallaxFactor;
          rCtx.translate(offsetX, offsetY);
          layer.render(rCtx, camX, camY, CANVAS_WIDTH, CANVAS_HEIGHT);
          rCtx.restore();

          rCtx.globalAlpha = prevAlpha;
          layer.parallaxFactor = origParallax;
        }

        renderer.applyCamera(camera);
      }

      // Atmosphere: light shafts + candle glow (screen space — behind platforms, in front of background)
      if (atmosphereInstance && mode !== "layer-isolation") {
        renderer.resetCamera();
        const camX = camera.position.x - CANVAS_WIDTH / 2;
        const camY = camera.position.y - CANVAS_HEIGHT / 2;
        atmosphereInstance.renderLightShafts(rCtx, camX, camY);
        atmosphereInstance.renderCandleGlow(rCtx, camX, camY);
        renderer.applyCamera(camera);
      }

      // Tilemap
      if (mode !== "layer-isolation") {
        tileMap.render(renderer);
      }

      // Particles (behind player)
      if (mode === "full" || mode === "layer-isolation") {
        particleSystem.render(renderer);
      }

      // Atmosphere: dust motes (screen space — in front of player, before foreground)
      if (atmosphereInstance && mode !== "layer-isolation") {
        renderer.resetCamera();
        const camX = camera.position.x - CANVAS_WIDTH / 2;
        const camY = camera.position.y - CANVAS_HEIGHT / 2;
        atmosphereInstance.renderDustMotes(rCtx, camX, camY);
        renderer.applyCamera(camera);
      }

      // Debug overlays
      if (showGridRef.current && mode !== "layer-isolation") {
        rCtx.save();
        rCtx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        rCtx.lineWidth = 0.5;
        const camBounds = camera.getViewportBounds();
        const startX = Math.floor(camBounds.x / 32) * 32;
        const startY = Math.floor(camBounds.y / 32) * 32;
        for (let gx = startX; gx < camBounds.x + camBounds.width; gx += 32) {
          rCtx.beginPath();
          rCtx.moveTo(gx, camBounds.y);
          rCtx.lineTo(gx, camBounds.y + camBounds.height);
          rCtx.stroke();
        }
        for (let gy = startY; gy < camBounds.y + camBounds.height; gy += 32) {
          rCtx.beginPath();
          rCtx.moveTo(camBounds.x, gy);
          rCtx.lineTo(camBounds.x + camBounds.width, gy);
          rCtx.stroke();
        }
        rCtx.restore();
      }

      if (showPlatOutlineRef.current && mode !== "layer-isolation") {
        rCtx.save();
        rCtx.strokeStyle = "#ef4444";
        rCtx.lineWidth = 1;
        for (const p of ROOM.platforms) {
          rCtx.strokeRect(p.x, p.y, p.width, p.height);
        }
        rCtx.restore();
      }
    });

    // ─── Debug layer (screen-space HUD) ─────────────────────────

    const debugLayerCallback = (debugCtx: CanvasRenderingContext2D) => {
      const mode = viewModeRef.current;
      const metrics = engine.getMetrics();

      // FPS
      debugCtx.fillStyle = COLORS.debug.ground;
      debugCtx.font = "12px monospace";
      debugCtx.fillText(`FPS: ${Math.round(metrics.fps)}`, 8, 16);

      // Camera position
      debugCtx.fillStyle = "#a78bfa";
      debugCtx.font = "10px monospace";
      debugCtx.fillText(
        `Camera: ${Math.round(camera.position.x)}, ${Math.round(camera.position.y)}`,
        8,
        32,
      );

      // Room info
      debugCtx.fillStyle = "#22d3ee";
      debugCtx.fillText(`Room: ${ROOM.name} (${ROOM.width}x${ROOM.height})`, 8, 44);
      debugCtx.fillText(`Biome: ${ROOM.biomeId}`, 8, 56);
      debugCtx.fillText(
        `Platforms: ${ROOM.platforms.length} | Layers: ${background?.layers.length ?? 0}`,
        8,
        68,
      );

      // Mode label
      debugCtx.fillStyle = "#fbbf24";
      debugCtx.font = "11px monospace";
      debugCtx.textAlign = "right";
      debugCtx.fillText(`Mode: ${mode}`, CANVAS_WIDTH - 8, 16);
      debugCtx.textAlign = "left";

      // Player state HUD (in playable modes)
      if (mode === "full" || mode === "layer-isolation") {
        const pos = player.getInterpolatedPosition(0);
        const state = player.stateMachine.getCurrentState();

        debugCtx.fillStyle = "rgba(0, 0, 0, 0.5)";
        debugCtx.fillRect(CANVAS_WIDTH - 200, CANVAS_HEIGHT - 52, 196, 48);

        debugCtx.fillStyle = "#a78bfa";
        debugCtx.font = "10px monospace";
        debugCtx.fillText(
          `State: ${state}`,
          CANVAS_WIDTH - 194,
          CANVAS_HEIGHT - 38,
        );
        debugCtx.fillStyle = "#f59e0b";
        debugCtx.fillText(
          `Pos: ${Math.round(pos.x)}, ${Math.round(pos.y)}`,
          CANVAS_WIDTH - 194,
          CANVAS_HEIGHT - 24,
        );
        debugCtx.fillStyle = "#22d3ee";
        debugCtx.fillText(
          `Vel: ${Math.round(player.velocity.x)}, ${Math.round(player.velocity.y)}`,
          CANVAS_WIDTH - 194,
          CANVAS_HEIGHT - 10,
        );
      }
    };
    engine.getRenderer().addLayerCallback("debug", debugLayerCallback);

    engine.start();

    // Cleanup
    eRef.__cleanup = () => {
      ctx.canvas.removeEventListener("layers-loaded", handleLayersLoaded);
      ctx.canvas.removeEventListener("camera-update", handleCameraUpdate);
    };
  }, []);

  const handleUnmount = useCallback(() => {
    const engine = engineRef.current as EngineRefs | null;
    engine?.stop();
    engine?.__cleanup?.();
    engineRef.current = null;
    playerRef.current = null;
    bgRef.current = null;
  }, []);

  // ─── Screenshot capture ─────────────────────────────────────────

  const handleScreenshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `environment-showcase-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }, []);

  // ─── Camera manual control ──────────────────────────────────────

  const handleManualCameraX = useCallback((value: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    const camera = engine.getCamera();
    camera.position.x = value;
  }, []);

  const handleManualCameraY = useCallback((value: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    const camera = engine.getCamera();
    camera.position.y = value;
  }, []);

  const resetCamera = useCallback(() => {
    const engine = engineRef.current;
    const player = playerRef.current;
    if (!engine || !player) return;
    engine.getCamera().snapTo({
      x: player.position.x + player.size.x / 2,
      y: player.position.y + player.size.y / 2,
    });
    setFollowPlayer(true);
    const e = engine as EngineRefs;
    if (e.__followRef) e.__followRef.current = true;
  }, []);

  // ─── Layer visibility toggle ────────────────────────────────────

  const toggleLayer = useCallback((index: number) => {
    setLayerVisibility((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }, []);

  // ─── Parallax update ───────────────────────────────────────────

  const updateParallax = useCallback((index: number, value: number) => {
    setParallaxFactors((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  // ─── Opacity update ────────────────────────────────────────────

  const updateOpacity = useCallback((index: number, value: number) => {
    setOpacityValues((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  // ─── Render ───────────────────────────────────────────────────────

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
          Environment Showcase
        </h1>
        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-mono text-amber-400">
          Phase 7 — Polish
        </span>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas area */}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
          <GameCanvas onMount={handleMount} onUnmount={handleUnmount} />

          <div className="w-[960px] text-xs font-mono text-zinc-600 leading-relaxed">
            <span className="text-zinc-500">Controls: </span>
            Arrows/WASD = Move &middot; Z/Space = Jump &middot; X/Shift = Dash
            &middot; Down = Crouch
          </div>
        </div>

        {/* Debug panel */}
        <DebugPanel title="Environment Showcase">
          {/* View Mode */}
          <div className="border-b border-zinc-800 pb-2">
            <div className="text-xs font-mono text-amber-400/80 uppercase tracking-wider mb-1">
              View Mode
            </div>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  { key: "full", label: "Full Room" },
                  { key: "layer-isolation", label: "Layer Isolation" },
                  { key: "parallax-scroll", label: "Parallax Scroll" },
                  { key: "tile-preview", label: "Tile Preview" },
                ] as const
              ).map((m) => (
                <button
                  key={m.key}
                  onClick={() => setViewMode(m.key)}
                  className={`px-2 py-1 text-xs rounded font-mono ${
                    viewMode === m.key
                      ? "bg-amber-600 text-white"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Layer selector (only in Layer Isolation mode) */}
            {viewMode === "layer-isolation" && (
              <div className="mt-2">
                <select
                  value={isolatedLayer}
                  onChange={(e) => setIsolatedLayer(Number(e.target.value))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs font-mono text-zinc-300"
                >
                  {layerNames.map((name, i) => (
                    <option key={i} value={i}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Layer Controls */}
          <details open>
            <summary className="text-xs font-mono text-amber-400/80 uppercase tracking-wider cursor-pointer select-none">
              Layer Controls
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              {layerNames.map((name, i) => (
                <div key={i} className="border-b border-zinc-800/50 pb-2">
                  <label className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                    <input
                      type="checkbox"
                      checked={layerVisibility[i] ?? true}
                      onChange={() => toggleLayer(i)}
                      className="accent-amber-500"
                    />
                    {name}
                  </label>
                  <div className="ml-4 mt-1 flex flex-col gap-1">
                    <Slider
                      label="Parallax"
                      value={parallaxFactors[i] ?? 0.5}
                      min={0}
                      max={2.0}
                      step={0.01}
                      onChange={(v) => updateParallax(i, v)}
                    />
                    <Slider
                      label="Opacity"
                      value={opacityValues[i] ?? 1.0}
                      min={0}
                      max={1.0}
                      step={0.01}
                      onChange={(v) => updateOpacity(i, v)}
                    />
                  </div>
                </div>
              ))}
              <label className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                <input
                  type="checkbox"
                  checked={showLayerBounds}
                  onChange={(e) => setShowLayerBounds(e.target.checked)}
                  className="accent-amber-500"
                />
                Show Layer Boundaries
              </label>
              <label className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                <input
                  type="checkbox"
                  checked={fgOverPlayer}
                  onChange={(e) => setFgOverPlayer(e.target.checked)}
                  className="accent-amber-500"
                />
                Show FG Over Player
              </label>
            </div>
          </details>

          {/* Tile Controls */}
          <details>
            <summary className="text-xs font-mono text-amber-400/80 uppercase tracking-wider cursor-pointer select-none">
              Tile Controls
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                <input
                  type="checkbox"
                  checked={showTileGrid}
                  onChange={(e) => setShowTileGrid(e.target.checked)}
                  className="accent-amber-500"
                />
                Show Tile Grid
              </label>
              <label className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                <input
                  type="checkbox"
                  checked={showPlatformOutlines}
                  onChange={(e) => setShowPlatformOutlines(e.target.checked)}
                  className="accent-amber-500"
                />
                Show Platform Outlines
              </label>
              <RenderModeToggle />
            </div>
          </details>

          {/* Camera Controls */}
          <details>
            <summary className="text-xs font-mono text-amber-400/80 uppercase tracking-wider cursor-pointer select-none">
              Camera Controls
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                <input
                  type="checkbox"
                  checked={followPlayer}
                  onChange={(e) => setFollowPlayer(e.target.checked)}
                  className="accent-amber-500"
                />
                Follow Player
              </label>

              {!followPlayer && (
                <>
                  <Slider
                    label="Camera X"
                    value={cameraX}
                    min={0}
                    max={ROOM.width}
                    step={1}
                    onChange={handleManualCameraX}
                  />
                  <Slider
                    label="Camera Y"
                    value={cameraY}
                    min={0}
                    max={ROOM.height}
                    step={1}
                    onChange={handleManualCameraY}
                  />
                </>
              )}

              {viewMode === "parallax-scroll" && (
                <Slider
                  label="Auto-Scroll Speed"
                  value={autoScrollSpeed}
                  min={-200}
                  max={200}
                  step={5}
                  onChange={setAutoScrollSpeed}
                />
              )}

              <Slider
                label="Zoom"
                value={zoom}
                min={0.5}
                max={3.0}
                step={0.1}
                onChange={setZoom}
              />

              <button
                onClick={resetCamera}
                className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700"
              >
                Reset Camera
              </button>
            </div>
          </details>

          {/* Info Section */}
          <details open>
            <summary className="text-xs font-mono text-amber-400/80 uppercase tracking-wider cursor-pointer select-none">
              Info
            </summary>
            <div className="mt-2 text-xs font-mono text-zinc-400 space-y-1">
              <div>
                Camera:{" "}
                <span className="text-zinc-200">
                  {cameraX}, {cameraY}
                </span>
              </div>
              <div>
                Room: <span className="text-zinc-200">{ROOM.name}</span>
              </div>
              <div>
                Biome: <span className="text-zinc-200">{ROOM.biomeId}</span>
              </div>
              <div>
                Platforms:{" "}
                <span className="text-zinc-200">{ROOM.platforms.length}</span>
              </div>
              <div>
                Layers:{" "}
                <span className="text-zinc-200">{layerNames.length}</span>
              </div>
            </div>
          </details>

          {/* Actions */}
          <div className="border-t border-zinc-800 pt-2 mt-2 flex flex-col gap-2">
            <button
              onClick={handleScreenshot}
              className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700"
            >
              Screenshot
            </button>
          </div>
        </DebugPanel>
      </div>
    </div>
  );
}
