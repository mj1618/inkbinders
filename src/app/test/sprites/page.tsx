"use client";

import { useRef, useState, useCallback } from "react";
import { GameCanvas } from "@/components/canvas/GameCanvas";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { Slider } from "@/components/debug/Slider";
import { RenderModeToggle } from "@/components/debug/RenderModeToggle";
import { Engine } from "@/engine/core/Engine";
import { Player, DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";
import { TileMap } from "@/engine/physics/TileMap";
import { AssetManager } from "@/engine/core/AssetManager";
import { AnimationController } from "@/engine/core/AnimationController";
import { RenderConfig } from "@/engine/core/RenderConfig";
import {
  PLAYER_SPRITE_CONFIGS,
  PLAYER_ANIMATIONS,
  STATE_TO_ANIMATION,
} from "@/engine/entities/PlayerSprites";
import type { PlayerParams } from "@/engine/entities/Player";
import { COLORS, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/constants";
import Link from "next/link";

const SPAWN_X = 200;
const SPAWN_Y = 380;
const RESPAWN_Y_THRESHOLD = 700;

const ANIMATION_STRIP_Y = CANVAS_HEIGHT - 80;
const ANIMATION_STRIP_FRAME_SIZE = 48;
const ANIMATION_STRIP_PADDING = 8;

function createTestLevel(): TileMap {
  return new TileMap([
    // Floor
    { x: 0, y: 460, width: 960, height: 40 },
    // Left wall
    { x: -20, y: 0, width: 20, height: 540 },
    // Right wall
    { x: 960, y: 0, width: 20, height: 540 },
    // Stepping platforms
    { x: 120, y: 360, width: 120, height: 16 },
    { x: 340, y: 300, width: 120, height: 16 },
    { x: 560, y: 360, width: 120, height: 16 },
    { x: 740, y: 280, width: 140, height: 16 },
  ]);
}

interface SpriteState {
  animFps: number;
  showOverlays: boolean;
  assetStatus: Record<string, boolean>;
  currentAnim: string;
  currentFrame: number;
  totalFrames: number;
  playerState: string;
}

export default function SpritesTest() {
  const engineRef = useRef<Engine | null>(null);
  const playerRef = useRef<Player | null>(null);
  const stateRef = useRef<SpriteState>({
    animFps: 10,
    showOverlays: true,
    assetStatus: {},
    currentAnim: "",
    currentFrame: 0,
    totalFrames: 0,
    playerState: "IDLE",
  });

  const [animFps, setAnimFps] = useState(10);
  const [showOverlays, setShowOverlays] = useState(true);
  const [assetStatus, setAssetStatus] = useState<Record<string, boolean>>({});
  const [currentAnim, setCurrentAnim] = useState("idle");
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [playerState, setPlayerState] = useState("IDLE");
  const [params, setParams] = useState<PlayerParams>({ ...DEFAULT_PLAYER_PARAMS });

  const updateParam = useCallback(<K extends keyof PlayerParams>(key: K, value: PlayerParams[K]) => {
    setParams((prev) => {
      const next = { ...prev, [key]: value };
      const player = playerRef.current;
      if (player) {
        player.params[key] = value;
        if (key === "playerWidth") player.size.x = value as number;
      }
      return next;
    });
  }, []);

  const handleMount = useCallback((ctx: CanvasRenderingContext2D) => {
    // Sprites test page defaults to sprites mode
    RenderConfig.setMode("sprites");

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

    const assetManager = AssetManager.getInstance();
    assetManager.clear();

    // Extra animation controllers for the strip preview (sprites page only)
    const animControllers = new Map<string, AnimationController>();
    let activeController: AnimationController | null = null;

    assetManager.loadAll(PLAYER_SPRITE_CONFIGS).then(() => {
      const status: Record<string, boolean> = {};
      for (const config of PLAYER_SPRITE_CONFIGS) {
        const sheet = assetManager.getSpriteSheet(config.id);
        status[config.id] = assetManager.isRealAsset(config.id);

        if (sheet) {
          const anims = PLAYER_ANIMATIONS[config.id];
          if (anims) {
            for (const anim of anims) {
              sheet.addAnimation(anim);
            }
          }
          animControllers.set(config.id, new AnimationController(sheet));
        }
      }
      setAssetStatus(status);
      stateRef.current.assetStatus = status;
    });

    let uiUpdateTimer = 0;

    engine.onUpdate((dt) => {
      if (player.position.y > RESPAWN_Y_THRESHOLD) {
        player.position.x = SPAWN_X;
        player.position.y = SPAWN_Y;
        player.velocity.x = 0;
        player.velocity.y = 0;
        player.size.y = player.params.playerHeight;
        player.grounded = false;
      }

      // Update strip preview controllers
      const state = player.stateMachine.getCurrentState();
      const mapping = STATE_TO_ANIMATION[state];
      if (mapping) {
        const controller = animControllers.get(mapping.sheetId);
        if (controller) {
          if (activeController !== controller) {
            activeController = controller;
          }

          controller.setFpsOverride(stateRef.current.animFps);
          controller.play(mapping.animName);
          controller.update(dt);
        }
      }

      uiUpdateTimer += dt;
      if (uiUpdateTimer >= 0.1) {
        uiUpdateTimer = 0;
        if (activeController) {
          setCurrentAnim(activeController.getCurrentAnimation());
          setCurrentFrame(activeController.getCurrentFrameNumber());
          setTotalFrames(activeController.getTotalFrames());
        }
        setPlayerState(state);
        stateRef.current.playerState = state;
      }
    });

    engine.onRender((renderer, interpolation) => {
      const pos = player.getInterpolatedPosition(interpolation);

      tileMap.render(renderer);

      // Player rendering is now driven by RenderConfig
      player.render(renderer, interpolation);

      if (stateRef.current.showOverlays) {
        const state = player.stateMachine.getCurrentState();
        renderer.strokeRect(pos.x, pos.y, player.size.x, player.size.y, COLORS.debug.hitbox, 1);

        const cx = pos.x + player.size.x / 2;
        const cy = pos.y + player.size.y / 2;
        const vScale = 0.15;
        const vx = player.velocity.x * vScale;
        const vy = player.velocity.y * vScale;
        if (Math.abs(vx) > 1 || Math.abs(vy) > 1) {
          renderer.drawLine(cx, cy, cx + vx, cy + vy, COLORS.debug.velocity, 2);
        }

        renderer.drawText(state, pos.x, pos.y - 8, COLORS.debug.stateLabel, 10);

        if (player.grounded) {
          renderer.drawCircle(pos.x + player.size.x / 2, pos.y + player.size.y + 3, 3, COLORS.debug.ground);
        }
      }
    });

    engine.getRenderer().addLayerCallback("debug", (rawCtx: CanvasRenderingContext2D) => {
      const metrics = engine.getMetrics();
      rawCtx.fillStyle = COLORS.debug.ground;
      rawCtx.font = "12px monospace";
      rawCtx.fillText(`FPS: ${Math.round(metrics.fps)}`, 8, 16);

      rawCtx.fillStyle = COLORS.debug.velocity;
      rawCtx.textAlign = "right";
      rawCtx.fillText(`Speed: ${Math.round(Math.abs(player.velocity.x))} px/s`, CANVAS_WIDTH - 8, 16);
      rawCtx.textAlign = "left";

      const modeLabel = `Render: ${RenderConfig.getMode()}`;
      rawCtx.fillStyle = "#a78bfa";
      rawCtx.fillText(modeLabel, 8, 32);

      renderAnimationStrip(rawCtx, animControllers, stateRef.current.playerState);
    });

    engine.start();
  }, []);

  const handleUnmount = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    playerRef.current = null;
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

  const handleAnimFpsChange = useCallback((fps: number) => {
    setAnimFps(fps);
    stateRef.current.animFps = fps;
  }, []);

  const handleOverlayToggle = useCallback(() => {
    setShowOverlays((prev) => {
      const next = !prev;
      stateRef.current.showOverlays = next;
      return next;
    });
  }, []);

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <div className="flex items-center gap-4 border-b border-zinc-800 px-4 py-2">
        <Link href="/test" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
          &larr; Tests
        </Link>
        <h1 className="font-mono text-sm font-bold text-amber-500">Sprites</h1>
        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-mono text-amber-400">
          Phase 6 — Integration
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
          <GameCanvas onMount={handleMount} onUnmount={handleUnmount} />

          <div className="w-[960px] text-xs font-mono text-zinc-500 leading-relaxed">
            <span className="text-zinc-400">Pass criteria: </span>
            Sprites load or fallback to placeholders &middot;
            Frame slicing correct &middot;
            Horizontal flip works &middot;
            State-driven animation switching &middot;
            Animation strip preview visible &middot;
            Rendering mode toggle works &middot;
            No regressions on rectangle rendering
          </div>
        </div>

        <DebugPanel title="Sprites">
          <RenderModeToggle />

          {/* Asset status */}
          <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Asset Status</div>
          <div className="flex flex-col gap-1">
            {PLAYER_SPRITE_CONFIGS.map((config) => (
              <div key={config.id} className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400">{config.id}</span>
                <span className={assetStatus[config.id] ? "text-green-400" : "text-amber-400"}>
                  {assetStatus[config.id] === undefined ? "..." : assetStatus[config.id] ? "real" : "placeholder"}
                </span>
              </div>
            ))}
          </div>

          {/* Animation info */}
          <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider pt-2">Animation</div>
          <div className="flex flex-col gap-1 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-zinc-400">State</span>
              <span className="text-amber-400">{playerState}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Animation</span>
              <span className="text-amber-400">{currentAnim}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Frame</span>
              <span className="text-amber-400">{currentFrame + 1}/{totalFrames}</span>
            </div>
          </div>
          <Slider
            label="Animation FPS"
            value={animFps}
            min={1}
            max={30}
            step={1}
            onChange={handleAnimFpsChange}
          />

          {/* Player params */}
          <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider pt-2">Player Params</div>
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
            min={100}
            max={800}
            step={10}
            onChange={(v) => updateParam("jumpSpeed", v)}
          />
          <Slider
            label="Acceleration"
            value={params.acceleration}
            min={200}
            max={5000}
            step={100}
            onChange={(v) => updateParam("acceleration", v)}
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
              onClick={handleOverlayToggle}
              className={`w-full rounded px-3 py-1.5 text-xs font-mono transition-colors ${
                showOverlays ? "bg-amber-500/20 text-amber-400" : "bg-zinc-800 text-zinc-500"
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

function renderAnimationStrip(
  ctx: CanvasRenderingContext2D,
  controllers: Map<string, AnimationController>,
  playerState: string,
): void {
  const mapping = STATE_TO_ANIMATION[playerState];
  if (!mapping) return;

  const controller = controllers.get(mapping.sheetId);
  if (!controller) return;

  const sheet = controller.getSpriteSheet();
  if (!sheet.isLoaded()) return;

  const anim = sheet.getAnimation(mapping.animName);
  if (!anim) return;

  const stripWidth =
    anim.frames.length * (ANIMATION_STRIP_FRAME_SIZE + ANIMATION_STRIP_PADDING) + ANIMATION_STRIP_PADDING;
  const stripX = (CANVAS_WIDTH - stripWidth) / 2;

  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(
    stripX,
    ANIMATION_STRIP_Y,
    stripWidth,
    ANIMATION_STRIP_FRAME_SIZE + ANIMATION_STRIP_PADDING * 2,
  );

  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    stripX,
    ANIMATION_STRIP_Y,
    stripWidth,
    ANIMATION_STRIP_FRAME_SIZE + ANIMATION_STRIP_PADDING * 2,
  );

  const currentFrameIdx = controller.getCurrentFrameIndex();

  for (let i = 0; i < anim.frames.length; i++) {
    const frameIdx = anim.frames[i];
    const fx = stripX + ANIMATION_STRIP_PADDING + i * (ANIMATION_STRIP_FRAME_SIZE + ANIMATION_STRIP_PADDING);
    const fy = ANIMATION_STRIP_Y + ANIMATION_STRIP_PADDING;

    if (frameIdx === currentFrameIdx) {
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.strokeRect(fx - 2, fy - 2, ANIMATION_STRIP_FRAME_SIZE + 4, ANIMATION_STRIP_FRAME_SIZE + 4);
    }

    const { sx, sy, sw, sh } = sheet.getFrameRect(frameIdx);
    const source = sheet.getImageSource();
    if (source) {
      ctx.drawImage(
        source,
        sx, sy, sw, sh,
        fx, fy, ANIMATION_STRIP_FRAME_SIZE, ANIMATION_STRIP_FRAME_SIZE,
      );
    }

    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "9px monospace";
    ctx.fillText(String(frameIdx), fx + 2, fy + ANIMATION_STRIP_FRAME_SIZE - 3);
  }

  ctx.fillStyle = "#a78bfa";
  ctx.font = "10px monospace";
  ctx.fillText(
    `${mapping.animName} [${mapping.sheetId}]`,
    stripX,
    ANIMATION_STRIP_Y - 4,
  );
}
