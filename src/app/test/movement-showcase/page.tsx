"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { GameCanvas } from "@/components/canvas/GameCanvas";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { RenderModeToggle } from "@/components/debug/RenderModeToggle";
import { Slider } from "@/components/debug/Slider";
import { Engine } from "@/engine/core/Engine";
import { RenderConfig } from "@/engine/core/RenderConfig";
import { AnimationController } from "@/engine/core/AnimationController";
import { AssetManager } from "@/engine/core/AssetManager";
import { Player, DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";
import type { PlayerParams } from "@/engine/entities/Player";
import {
  PLAYER_SPRITE_CONFIGS,
  PLAYER_ANIMATIONS,
  STATE_TO_ANIMATION,
} from "@/engine/entities/PlayerSprites";
import { TileMap } from "@/engine/physics/TileMap";
import type { Platform } from "@/engine/physics/TileMap";
import { ParticleSystem } from "@/engine/core/ParticleSystem";
import { ScreenShake } from "@/engine/core/ScreenShake";
import { COLORS, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/constants";
import type { Vec2 } from "@/lib/types";
import Link from "next/link";

// ─── Constants ──────────────────────────────────────────────────────

const SPAWN_X = 120;
const SPAWN_Y = 350;

/** All 10 player state names in gallery display order */
const GALLERY_STATES = [
  "IDLE",
  "RUNNING",
  "JUMPING",
  "FALLING",
  "DASHING",
  "WALL_SLIDING",
  "WALL_JUMPING",
  "CROUCHING",
  "CROUCH_SLIDING",
  "HARD_LANDING",
] as const;

type ViewMode = "gallery" | "playground" | "split";

/** Gallery cell dimensions at 2x zoom (64*2 = 128, but we use a bit less to fit 5 columns) */
const CELL_W = 128;
const CELL_H = 128;
const CELL_COLS = 5;
const CELL_PAD = 12;
const GALLERY_LEFT_PAD = 60;
const GALLERY_TOP_PAD = 10;

/** Animation strip in gallery */
const STRIP_Y = 220;
const STRIP_FRAME_SIZE = 48; // 3x zoom would be too wide; use smaller frames

/** Playground platforms */
const PLAYGROUND_PLATFORMS: Platform[] = [
  // Main floor left
  { x: 0, y: 420, width: 360, height: 32 },
  // Main floor right (after gap)
  { x: 440, y: 420, width: 520, height: 32 },
  // Mid platform
  { x: 160, y: 320, width: 200, height: 32 },
  // High platform
  { x: 220, y: 220, width: 120, height: 32 },
  // Right wall
  { x: 700, y: 180, width: 32, height: 240 },
  // Left wall
  { x: 0, y: 180, width: 32, height: 240 },
  // Ceiling section (for crouch testing)
  { x: 500, y: 360, width: 120, height: 32 },
];

// ─── Gallery Cell Info ──────────────────────────────────────────────

interface GalleryCellInfo {
  state: string;
  sheetId: string;
  animName: string;
  controller: AnimationController;
  x: number;
  y: number;
}

// ─── Engine Ref Extension ───────────────────────────────────────────

interface EngineWithRefs extends Engine {
  __showHitboxRef?: { current: boolean };
  __showVelocityRef?: { current: boolean };
  __pausedRef?: { current: boolean };
  __timeScaleRef?: { current: number };
  __viewModeRef?: { current: ViewMode };
  __selectedCellRef?: { current: number };
  __galleryCellsRef?: { current: GalleryCellInfo[] };
  __galleryFrameStepRef?: { current: number }; // -1 = none, else frame to show
}

// ─── Test Page Component ────────────────────────────────────────────

export default function MovementShowcaseTest() {
  const engineRef = useRef<Engine | null>(null);
  const playerRef = useRef<Player | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [params, setParams] = useState<PlayerParams>({ ...DEFAULT_PLAYER_PARAMS });
  const [showHitbox, setShowHitbox] = useState(true);
  const [showVelocity, setShowVelocity] = useState(true);
  const [paused, setPaused] = useState(false);
  const [timeScale, setTimeScale] = useState(1.0);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [selectedCell, setSelectedCell] = useState(-1);
  const [fpsOverride, setFpsOverride] = useState<number | null>(null);

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
      player.dashCooldownTimer = 0;
      player.dashAvailable = true;
      player.isDashing = false;
      player.isInDashWindup = false;
      player.dashSpeedBoostRemaining = 0;
      player.dashTrailPositions = [];
      player.dashTrailFadeTimer = 0;
    }
  }, []);

  // ─── Sync refs for engine callbacks ───────────────────────────────

  useEffect(() => {
    const engine = engineRef.current as EngineWithRefs | null;
    if (engine?.__pausedRef) engine.__pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const engine = engineRef.current as EngineWithRefs | null;
    if (engine?.__timeScaleRef) engine.__timeScaleRef.current = timeScale;
  }, [timeScale]);

  useEffect(() => {
    const engine = engineRef.current as EngineWithRefs | null;
    if (engine?.__viewModeRef) engine.__viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    const engine = engineRef.current as EngineWithRefs | null;
    if (engine?.__selectedCellRef) engine.__selectedCellRef.current = selectedCell;
  }, [selectedCell]);

  useEffect(() => {
    const engine = engineRef.current as EngineWithRefs | null;
    if (engine?.__showHitboxRef) engine.__showHitboxRef.current = showHitbox;
  }, [showHitbox]);

  useEffect(() => {
    const engine = engineRef.current as EngineWithRefs | null;
    if (engine?.__showVelocityRef) engine.__showVelocityRef.current = showVelocity;
  }, [showVelocity]);

  // ─── FPS Override sync ────────────────────────────────────────────

  useEffect(() => {
    const engine = engineRef.current as EngineWithRefs | null;
    if (!engine?.__galleryCellsRef) return;
    for (const cell of engine.__galleryCellsRef.current) {
      cell.controller.setFpsOverride(fpsOverride);
    }
  }, [fpsOverride]);

  // ─── Engine Mount ─────────────────────────────────────────────────

  const handleMount = useCallback((ctx: CanvasRenderingContext2D) => {
    RenderConfig.setMode("both");
    const engine = new Engine({ ctx });
    const camera = engine.getCamera();
    const input = engine.getInput();
    const tileMap = new TileMap(PLAYGROUND_PLATFORMS);

    // Camera bounds for playground
    camera.bounds = { x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT };

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

    engineRef.current = engine;
    playerRef.current = player;

    // Store canvas element ref for mouse events
    const canvas = ctx.canvas;
    canvasRef.current = canvas;

    // ─── Refs for callback access ─────────────────────────────────

    const showHitboxRef = { current: true };
    const showVelocityRef = { current: true };
    const pausedRef = { current: false };
    const timeScaleRef = { current: 1.0 };
    const viewModeRef: { current: ViewMode } = { current: "split" };
    const selectedCellRef = { current: -1 };
    const galleryCellsRef: { current: GalleryCellInfo[] } = { current: [] };
    const galleryFrameStepRef = { current: -1 };

    const eRef = engine as EngineWithRefs;
    eRef.__showHitboxRef = showHitboxRef;
    eRef.__showVelocityRef = showVelocityRef;
    eRef.__pausedRef = pausedRef;
    eRef.__timeScaleRef = timeScaleRef;
    eRef.__viewModeRef = viewModeRef;
    eRef.__selectedCellRef = selectedCellRef;
    eRef.__galleryCellsRef = galleryCellsRef;
    eRef.__galleryFrameStepRef = galleryFrameStepRef;

    // ─── Load sprites and create gallery controllers ──────────────

    const assetManager = AssetManager.getInstance();
    assetManager.loadAll(PLAYER_SPRITE_CONFIGS).then(() => {
      const cells: GalleryCellInfo[] = [];

      for (let i = 0; i < GALLERY_STATES.length; i++) {
        const state = GALLERY_STATES[i];
        const mapping = STATE_TO_ANIMATION[state];
        if (!mapping) continue;

        const sheet = assetManager.getSpriteSheet(mapping.sheetId);
        if (!sheet) continue;

        // Ensure animations are registered on the sheet
        const anims = PLAYER_ANIMATIONS[mapping.sheetId];
        if (anims) {
          for (const anim of anims) {
            if (!sheet.getAnimation(anim.name)) {
              sheet.addAnimation(anim);
            }
          }
        }

        const controller = new AnimationController(sheet);
        controller.play(mapping.animName);

        const col = i % CELL_COLS;
        const row = Math.floor(i / CELL_COLS);
        const x = GALLERY_LEFT_PAD + col * (CELL_W + CELL_PAD);
        const y = GALLERY_TOP_PAD + row * (CELL_H + CELL_PAD);

        cells.push({
          state,
          sheetId: mapping.sheetId,
          animName: mapping.animName,
          controller,
          x,
          y,
        });
      }

      galleryCellsRef.current = cells;
    });

    // ─── Mouse click handler for gallery cell selection ───────────

    const handleCanvasClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      const mode = viewModeRef.current;
      // Only handle gallery clicks in gallery or split mode
      if (mode === "playground") return;

      for (let i = 0; i < galleryCellsRef.current.length; i++) {
        const cell = galleryCellsRef.current[i];
        if (mx >= cell.x && mx <= cell.x + CELL_W && my >= cell.y && my <= cell.y + CELL_H) {
          selectedCellRef.current = selectedCellRef.current === i ? -1 : i;
          // Fire React state update via a custom event
          canvas.dispatchEvent(new CustomEvent("gallery-select", { detail: selectedCellRef.current }));
          return;
        }
      }
    };
    canvas.addEventListener("click", handleCanvasClick);

    // ─── Keyboard handler for pause/frame step ────────────────────

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        pausedRef.current = !pausedRef.current;
        canvas.dispatchEvent(new CustomEvent("pause-toggle", { detail: pausedRef.current }));
      }

      if (pausedRef.current && selectedCellRef.current >= 0) {
        const cell = galleryCellsRef.current[selectedCellRef.current];
        if (!cell) return;
        const sheet = cell.controller.getSpriteSheet();
        const anim = sheet.getAnimation(cell.animName);
        if (!anim) return;
        const totalFrames = anim.frames.length;
        const currentFrame = cell.controller.getCurrentFrameNumber();

        if (e.code === "ArrowRight") {
          e.preventDefault();
          const nextFrame = (currentFrame + 1) % totalFrames;
          galleryFrameStepRef.current = nextFrame;
        } else if (e.code === "ArrowLeft") {
          e.preventDefault();
          const nextFrame = (currentFrame - 1 + totalFrames) % totalFrames;
          galleryFrameStepRef.current = nextFrame;
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    // ─── Gallery custom event listener for React sync ─────────────

    const handleGallerySelect = (e: Event) => {
      const ce = e as CustomEvent<number>;
      // We need external state update - trigger via parent
      selectedCellRef.current = ce.detail;
    };
    canvas.addEventListener("gallery-select", handleGallerySelect);

    const handlePauseToggle = (e: Event) => {
      const ce = e as CustomEvent<boolean>;
      pausedRef.current = ce.detail;
    };
    canvas.addEventListener("pause-toggle", handlePauseToggle);

    // ─── Update Callback ──────────────────────────────────────────

    engine.onUpdate((dt) => {
      const effectiveDt = pausedRef.current ? 0 : dt * timeScaleRef.current;

      // Update gallery animation controllers
      const cells = galleryCellsRef.current;
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        // Handle frame stepping for selected cell
        if (pausedRef.current && i === selectedCellRef.current && galleryFrameStepRef.current >= 0) {
          // Force frame directly via restart + step to target
          const sheet = cell.controller.getSpriteSheet();
          const anim = sheet.getAnimation(cell.animName);
          if (anim) {
            cell.controller.restart(cell.animName);
            // Step through frames to reach desired frame
            const targetFrame = galleryFrameStepRef.current;
            for (let f = 0; f < targetFrame; f++) {
              cell.controller.update(1 / (anim.fps || 10));
            }
          }
          galleryFrameStepRef.current = -1;
        } else if (!pausedRef.current) {
          cell.controller.update(effectiveDt);
        }
      }

      // Player updates only in playground or split mode, and only when not paused
      if (viewModeRef.current !== "gallery" && !pausedRef.current) {
        // Auto-respawn on fall
        if (player.position.y > 600) {
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
        }

        // Camera follow
        const playerCenter: Vec2 = {
          x: player.position.x + player.size.x / 2,
          y: player.position.y + player.size.y / 2,
        };
        camera.follow(playerCenter, player.velocity, effectiveDt);

        // Particles & screen shake
        particleSystem.update(effectiveDt);
        const shakeOffset = screenShake.update();
        camera.position.x += shakeOffset.offsetX;
        camera.position.y += shakeOffset.offsetY;
      }
    });

    // ─── World-Space Render Callback ──────────────────────────────

    engine.onRender((renderer, interpolation) => {
      const mode = viewModeRef.current;
      const rCtx = renderer.getContext();

      // ─── Playground rendering ─────────────────────────────────
      if (mode === "playground" || mode === "split") {
        rCtx.save();

        if (mode === "split") {
          // Clip to bottom half
          rCtx.beginPath();
          rCtx.rect(0, 270, CANVAS_WIDTH, 270);
          rCtx.clip();

          // Offset rendering to bottom half
          rCtx.translate(0, 270);
        }

        // Draw tilemap
        tileMap.render(renderer);

        // Particles
        particleSystem.render(renderer);

        // Debug overlays
        {
          const pos = player.getInterpolatedPosition(interpolation);
          const state = player.stateMachine.getCurrentState();

          // Player hitbox
          if (showHitboxRef.current) {
            renderer.strokeRect(
              pos.x,
              pos.y,
              player.size.x,
              player.size.y,
              COLORS.debug.hitbox,
              1,
            );
          }

          // Velocity vector
          if (showVelocityRef.current) {
            const cx = pos.x + player.size.x / 2;
            const cy = pos.y + player.size.y / 2;
            const vScale = 0.15;
            const vx = player.velocity.x * vScale;
            const vy = player.velocity.y * vScale;
            if (Math.abs(vx) > 1 || Math.abs(vy) > 1) {
              renderer.drawLine(cx, cy, cx + vx, cy + vy, COLORS.debug.velocity, 2);
            }
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
        }

        rCtx.restore();
      }
    });

    // ─── Screen-Space Debug Layer ─────────────────────────────────

    const debugLayerCallback = (debugCtx: CanvasRenderingContext2D) => {
      const mode = viewModeRef.current;
      const cells = galleryCellsRef.current;

      // ─── Gallery rendering (screen space) ─────────────────────
      if ((mode === "gallery" || mode === "split") && cells.length > 0) {
        const galleryH = mode === "gallery" ? CANVAS_HEIGHT : 270;

        // Gallery background
        debugCtx.fillStyle = "rgba(0, 0, 0, 0.3)";
        debugCtx.fillRect(0, 0, CANVAS_WIDTH, galleryH);

        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i];
          const isSelected = i === selectedCellRef.current;

          // Cell border
          debugCtx.strokeStyle = isSelected ? "#22d3ee" : "rgba(255, 255, 255, 0.15)";
          debugCtx.lineWidth = isSelected ? 2 : 1;
          debugCtx.strokeRect(cell.x, cell.y, CELL_W, CELL_H);

          // Draw sprite at 2x zoom centered in cell
          const sheet = cell.controller.getSpriteSheet();
          const frameIndex = cell.controller.getCurrentFrameIndex();
          const fw = sheet.config.frameWidth;
          const fh = sheet.config.frameHeight;
          const zoom = 2;
          const drawW = fw * zoom;
          const drawH = fh * zoom;
          const drawX = cell.x + (CELL_W - drawW) / 2;
          const drawY = cell.y + (CELL_H - drawH) / 2 - 8;

          if (RenderConfig.useSprites() && sheet.isLoaded()) {
            sheet.drawFrame(debugCtx, frameIndex, drawX, drawY, false, zoom, zoom);
          }

          if (RenderConfig.useRectangles()) {
            // Draw a colored rectangle representing the state
            const rectW = 24 * zoom;
            const rectH = 40 * zoom;
            const rectX = cell.x + (CELL_W - rectW) / 2;
            const rectY = cell.y + (CELL_H - rectH) / 2 - 8;
            const alpha = RenderConfig.getMode() === "both" ? 0.4 : 0.8;
            debugCtx.fillStyle = `rgba(59, 130, 246, ${alpha})`;
            debugCtx.fillRect(rectX, rectY, rectW, rectH);
          }

          // State name label
          debugCtx.fillStyle = "#ffffff";
          debugCtx.font = "9px monospace";
          debugCtx.textAlign = "center";
          debugCtx.fillText(cell.state, cell.x + CELL_W / 2, cell.y + CELL_H - 4);

          // Frame counter in top-right
          const total = cell.controller.getTotalFrames();
          const current = cell.controller.getCurrentFrameNumber() + 1;
          debugCtx.fillStyle = "rgba(255, 255, 255, 0.6)";
          debugCtx.font = "8px monospace";
          debugCtx.textAlign = "right";
          debugCtx.fillText(`${current}/${total}`, cell.x + CELL_W - 4, cell.y + 12);
        }

        debugCtx.textAlign = "left";

        // ─── Animation Strip for selected cell ──────────────────
        if (selectedCellRef.current >= 0 && selectedCellRef.current < cells.length) {
          const cell = cells[selectedCellRef.current];
          const sheet = cell.controller.getSpriteSheet();
          const anim = sheet.getAnimation(cell.animName);
          if (anim) {
            const stripFrameSize = STRIP_FRAME_SIZE;
            const totalW = anim.frames.length * (stripFrameSize + 4);
            const startX = Math.max(0, (CANVAS_WIDTH - totalW) / 2);
            const currentFrameNum = cell.controller.getCurrentFrameNumber();

            // Strip background
            debugCtx.fillStyle = "rgba(0, 0, 0, 0.5)";
            debugCtx.fillRect(startX - 4, STRIP_Y - 4, totalW + 8, stripFrameSize + 24);

            for (let f = 0; f < anim.frames.length; f++) {
              const fx = startX + f * (stripFrameSize + 4);
              const fy = STRIP_Y;
              const isCurrent = f === currentFrameNum;

              // Frame border
              debugCtx.strokeStyle = isCurrent ? "#22d3ee" : "rgba(255, 255, 255, 0.2)";
              debugCtx.lineWidth = isCurrent ? 2 : 1;
              debugCtx.strokeRect(fx, fy, stripFrameSize, stripFrameSize);

              // Draw frame
              const zoom = stripFrameSize / Math.max(sheet.config.frameWidth, sheet.config.frameHeight);
              if (sheet.isLoaded()) {
                sheet.drawFrame(debugCtx, anim.frames[f], fx, fy, false, zoom, zoom);
              }

              // Frame index
              debugCtx.fillStyle = isCurrent ? "#22d3ee" : "rgba(255, 255, 255, 0.5)";
              debugCtx.font = "8px monospace";
              debugCtx.textAlign = "center";
              debugCtx.fillText(String(f), fx + stripFrameSize / 2, fy + stripFrameSize + 10);
            }
            debugCtx.textAlign = "left";
          }
        }
      }

      // ─── Playground HUD overlay ─────────────────────────────────
      if (mode === "playground" || mode === "split") {
        const hudY = CANVAS_HEIGHT - 80;
        const hudX = CANVAS_WIDTH - 220;

        debugCtx.fillStyle = "rgba(0, 0, 0, 0.6)";
        debugCtx.fillRect(hudX - 4, hudY - 14, 220, 75);

        debugCtx.font = "11px monospace";
        debugCtx.fillStyle = "#a78bfa";
        debugCtx.fillText(
          `State: ${player.stateMachine.getCurrentState()}`,
          hudX,
          hudY,
        );

        debugCtx.fillStyle = "#f59e0b";
        debugCtx.fillText(
          `vx: ${Math.round(player.velocity.x)}  vy: ${Math.round(player.velocity.y)}`,
          hudX,
          hudY + 16,
        );

        debugCtx.fillStyle = "#22d3ee";
        debugCtx.fillText(
          `sx: ${player.scaleX.toFixed(2)}  sy: ${player.scaleY.toFixed(2)}`,
          hudX,
          hudY + 32,
        );

        debugCtx.fillStyle = "#4ade80";
        debugCtx.fillText(
          `Grounded: ${player.grounded ? "yes" : "no"}`,
          hudX,
          hudY + 48,
        );
      }

      // ─── FPS + pause indicator ────────────────────────────────
      const metrics = engine.getMetrics();
      debugCtx.fillStyle = COLORS.debug.ground;
      debugCtx.font = "12px monospace";
      debugCtx.fillText(`FPS: ${Math.round(metrics.fps)}`, 8, 16);

      if (pausedRef.current) {
        debugCtx.fillStyle = "#ef4444";
        debugCtx.font = "bold 14px monospace";
        debugCtx.textAlign = "center";
        debugCtx.fillText("PAUSED", CANVAS_WIDTH / 2, CANVAS_HEIGHT - 8);
        debugCtx.textAlign = "left";
      }

      // ─── Split mode divider line ──────────────────────────────
      if (viewModeRef.current === "split") {
        debugCtx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        debugCtx.lineWidth = 1;
        debugCtx.beginPath();
        debugCtx.moveTo(0, 270);
        debugCtx.lineTo(CANVAS_WIDTH, 270);
        debugCtx.stroke();
      }
    };
    engine.getRenderer().addLayerCallback("debug", debugLayerCallback);

    engine.start();

    // ─── Cleanup stored on engine for unmount ───────────────────
    (engine as EngineWithRefs & { __cleanup?: () => void }).__cleanup = () => {
      canvas.removeEventListener("click", handleCanvasClick);
      canvas.removeEventListener("gallery-select", handleGallerySelect);
      canvas.removeEventListener("pause-toggle", handlePauseToggle);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleUnmount = useCallback(() => {
    const engine = engineRef.current as EngineWithRefs & { __cleanup?: () => void } | null;
    engine?.stop();
    engine?.__cleanup?.();
    engineRef.current = null;
    playerRef.current = null;
  }, []);

  // ─── React event bridge ─────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleGallerySelectEvent = (e: Event) => {
      const ce = e as CustomEvent<number>;
      setSelectedCell(ce.detail);
    };
    const handlePauseToggleEvent = (e: Event) => {
      const ce = e as CustomEvent<boolean>;
      setPaused(ce.detail);
    };

    canvas.addEventListener("gallery-select", handleGallerySelectEvent);
    canvas.addEventListener("pause-toggle", handlePauseToggleEvent);

    return () => {
      canvas.removeEventListener("gallery-select", handleGallerySelectEvent);
      canvas.removeEventListener("pause-toggle", handlePauseToggleEvent);
    };
  }, []);

  // ─── Force state handler ────────────────────────────────────────

  const forceState = useCallback((state: string) => {
    const player = playerRef.current;
    if (!player) return;
    // Reset velocity/position for certain states
    player.velocity.x = 0;
    player.velocity.y = 0;
    player.forceState(state);
  }, []);

  // ─── Selected cell animation info ─────────────────────────────

  const getSelectedAnimInfo = useCallback((): {
    animName: string;
    sheetId: string;
    frame: string;
    fps: number;
  } | null => {
    const engine = engineRef.current as EngineWithRefs | null;
    if (!engine?.__galleryCellsRef || selectedCell < 0) return null;
    const cell = engine.__galleryCellsRef.current[selectedCell];
    if (!cell) return null;
    const sheet = cell.controller.getSpriteSheet();
    const anim = sheet.getAnimation(cell.animName);
    if (!anim) return null;
    return {
      animName: cell.animName,
      sheetId: cell.sheetId,
      frame: `${cell.controller.getCurrentFrameNumber() + 1}/${anim.frames.length}`,
      fps: fpsOverride ?? anim.fps,
    };
  }, [selectedCell, fpsOverride]);

  const animInfo = getSelectedAnimInfo();

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
          Movement Showcase
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

          {/* Controls legend */}
          <div className="w-[960px] text-xs font-mono text-zinc-600 leading-relaxed">
            <span className="text-zinc-500">Controls: </span>
            Arrows/WASD = Move &middot; Z/Space = Jump &middot; X/Shift = Dash
            &middot; Down = Crouch &middot; Space = Pause (global) &middot;
            Left/Right = Step frames (when paused) &middot; Click gallery = Select
          </div>
        </div>

        {/* Debug panel */}
        <DebugPanel title="Movement Showcase">
          {/* View Mode */}
          <div className="border-b border-zinc-800 pb-2">
            <div className="text-xs font-mono text-amber-400/80 uppercase tracking-wider mb-1">
              View Mode
            </div>
            <div className="flex gap-1">
              {(["gallery", "playground", "split"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`px-2 py-1 text-xs rounded font-mono ${
                    viewMode === m
                      ? "bg-amber-600 text-white"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Time Control */}
          <div className="border-b border-zinc-800 pb-2">
            <div className="text-xs font-mono text-amber-400/80 uppercase tracking-wider mb-1">
              Time Control
            </div>
            <Slider
              label="Time Scale"
              value={timeScale}
              min={0.1}
              max={2.0}
              step={0.1}
              onChange={setTimeScale}
            />
            <div className="flex gap-1 mt-2">
              <button
                onClick={() => {
                  setPaused((p) => {
                    const next = !p;
                    const engine = engineRef.current as EngineWithRefs | null;
                    if (engine?.__pausedRef) engine.__pausedRef.current = next;
                    return next;
                  });
                }}
                className={`px-2 py-1 text-xs rounded font-mono ${
                  paused
                    ? "bg-green-700 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                {paused ? "Resume" : "Pause"}
              </button>
              <button
                onClick={() => {
                  // Step one frame: briefly unpause, run one frame, re-pause
                  const engine = engineRef.current as EngineWithRefs | null;
                  if (!engine?.__pausedRef) return;
                  engine.__pausedRef.current = false;
                  requestAnimationFrame(() => {
                    if (engine.__pausedRef) engine.__pausedRef.current = true;
                  });
                }}
                className="px-2 py-1 text-xs rounded font-mono bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              >
                Step Frame
              </button>
            </div>
          </div>

          {/* Render */}
          <RenderModeToggle />
          <div className="flex flex-col gap-1 -mt-2">
            <label className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <input
                type="checkbox"
                checked={showHitbox}
                onChange={(e) => setShowHitbox(e.target.checked)}
                className="accent-amber-500"
              />
              Show Hitbox
            </label>
            <label className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <input
                type="checkbox"
                checked={showVelocity}
                onChange={(e) => setShowVelocity(e.target.checked)}
                className="accent-amber-500"
              />
              Show Velocity Vector
            </label>
          </div>

          {/* Squash-Stretch */}
          <details>
            <summary className="text-xs font-mono text-amber-400/80 uppercase tracking-wider cursor-pointer select-none">
              Squash-Stretch
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                <input
                  type="checkbox"
                  checked={params.squashStretchEnabled}
                  onChange={(e) => updateParam("squashStretchEnabled", e.target.checked)}
                  className="accent-amber-500"
                />
                Enabled
              </label>
              <Slider label="Jump Launch X" value={params.jumpLaunchScaleX} min={0.5} max={1.0} step={0.01} onChange={(v) => updateParam("jumpLaunchScaleX", v)} />
              <Slider label="Jump Launch Y" value={params.jumpLaunchScaleY} min={1.0} max={1.5} step={0.01} onChange={(v) => updateParam("jumpLaunchScaleY", v)} />
              <Slider label="Soft Land X" value={params.softLandScaleX} min={1.0} max={1.5} step={0.01} onChange={(v) => updateParam("softLandScaleX", v)} />
              <Slider label="Soft Land Y" value={params.softLandScaleY} min={0.5} max={1.0} step={0.01} onChange={(v) => updateParam("softLandScaleY", v)} />
              <Slider label="Hard Land X" value={params.hardLandScaleX} min={1.0} max={2.0} step={0.01} onChange={(v) => updateParam("hardLandScaleX", v)} />
              <Slider label="Hard Land Y" value={params.hardLandScaleY} min={0.3} max={1.0} step={0.01} onChange={(v) => updateParam("hardLandScaleY", v)} />
              <Slider label="Dash Start X" value={params.dashStartScaleX} min={1.0} max={2.0} step={0.01} onChange={(v) => updateParam("dashStartScaleX", v)} />
              <Slider label="Dash Start Y" value={params.dashStartScaleY} min={0.5} max={1.0} step={0.01} onChange={(v) => updateParam("dashStartScaleY", v)} />
              <Slider label="Dash End X" value={params.dashEndScaleX} min={0.5} max={1.0} step={0.01} onChange={(v) => updateParam("dashEndScaleX", v)} />
              <Slider label="Dash End Y" value={params.dashEndScaleY} min={1.0} max={1.5} step={0.01} onChange={(v) => updateParam("dashEndScaleY", v)} />
              <Slider label="Wall Slide Entry X" value={params.wallSlideEntryScaleX} min={0.5} max={1.0} step={0.01} onChange={(v) => updateParam("wallSlideEntryScaleX", v)} />
              <Slider label="Wall Slide Entry Y" value={params.wallSlideEntryScaleY} min={1.0} max={1.5} step={0.01} onChange={(v) => updateParam("wallSlideEntryScaleY", v)} />
              <Slider label="Wall Jump X" value={params.wallJumpScaleX} min={0.5} max={1.0} step={0.01} onChange={(v) => updateParam("wallJumpScaleX", v)} />
              <Slider label="Wall Jump Y" value={params.wallJumpScaleY} min={1.0} max={1.5} step={0.01} onChange={(v) => updateParam("wallJumpScaleY", v)} />
              <Slider label="Turn X" value={params.turnScaleX} min={0.5} max={1.0} step={0.01} onChange={(v) => updateParam("turnScaleX", v)} />
              <Slider label="Scale Return Speed" value={params.scaleReturnSpeed} min={1} max={30} step={0.5} onChange={(v) => updateParam("scaleReturnSpeed", v)} />
            </div>
          </details>

          {/* State Trigger Buttons */}
          <details>
            <summary className="text-xs font-mono text-amber-400/80 uppercase tracking-wider cursor-pointer select-none">
              State Triggers
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-1">
              {GALLERY_STATES.map((state) => (
                <button
                  key={state}
                  onClick={() => forceState(state)}
                  className="rounded bg-zinc-800 px-1 py-1 text-[10px] font-mono text-zinc-300 hover:bg-zinc-700 truncate"
                >
                  {state}
                </button>
              ))}
            </div>
          </details>

          {/* Animation Info */}
          <details open>
            <summary className="text-xs font-mono text-amber-400/80 uppercase tracking-wider cursor-pointer select-none">
              Animation Info
            </summary>
            <div className="mt-2 text-xs font-mono text-zinc-400 space-y-1">
              {animInfo ? (
                <>
                  <div>Anim: <span className="text-zinc-200">{animInfo.animName}</span></div>
                  <div>Sheet: <span className="text-zinc-200">{animInfo.sheetId}</span></div>
                  <div>Frame: <span className="text-zinc-200">{animInfo.frame}</span></div>
                  <div>FPS: <span className="text-zinc-200">{animInfo.fps}</span></div>
                </>
              ) : (
                <div className="text-zinc-500 italic">Click a gallery cell to inspect</div>
              )}
              <Slider
                label="FPS Override"
                value={fpsOverride ?? 10}
                min={1}
                max={30}
                step={1}
                onChange={(v) => setFpsOverride(v)}
              />
              <button
                onClick={() => setFpsOverride(null)}
                className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700 mt-1"
              >
                Reset FPS
              </button>
            </div>
          </details>

          {/* Physics Params */}
          <details>
            <summary className="text-xs font-mono text-amber-400/80 uppercase tracking-wider cursor-pointer select-none">
              Physics Params
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <Slider label="Max Run Speed" value={params.maxRunSpeed} min={100} max={600} step={10} onChange={(v) => updateParam("maxRunSpeed", v)} />
              <Slider label="Acceleration" value={params.acceleration} min={500} max={3000} step={50} onChange={(v) => updateParam("acceleration", v)} />
              <Slider label="Deceleration" value={params.deceleration} min={500} max={3000} step={50} onChange={(v) => updateParam("deceleration", v)} />
              <Slider label="Jump Speed" value={params.jumpSpeed} min={200} max={600} step={10} onChange={(v) => updateParam("jumpSpeed", v)} />
              <Slider label="Rise Gravity" value={params.riseGravity} min={500} max={2000} step={50} onChange={(v) => updateParam("riseGravity", v)} />
              <Slider label="Fall Gravity" value={params.fallGravity} min={500} max={2000} step={50} onChange={(v) => updateParam("fallGravity", v)} />
              <Slider label="Dash Speed" value={params.dashSpeed} min={200} max={800} step={10} onChange={(v) => updateParam("dashSpeed", v)} />
            </div>
          </details>

          {/* Controls */}
          <div className="border-t border-zinc-800 pt-2 mt-2 flex flex-col gap-2">
            <button
              onClick={() => {
                const next = !(showHitbox && showVelocity);
                setShowHitbox(next);
                setShowVelocity(next);
              }}
              className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700"
            >
              {showHitbox && showVelocity ? "Hide" : "Show"} Overlays
            </button>
            <button
              onClick={resetPlayer}
              className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700"
            >
              Reset Player
            </button>
            <button
              onClick={resetParams}
              className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700"
            >
              Reset All Params
            </button>
          </div>
        </DebugPanel>
      </div>
    </div>
  );
}
