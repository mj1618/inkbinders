"use client";

import { useRef, useState, useCallback } from "react";
import { GameCanvas } from "@/components/canvas/GameCanvas";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { RenderModeToggle } from "@/components/debug/RenderModeToggle";
import { Slider } from "@/components/debug/Slider";
import { Engine } from "@/engine/core/Engine";
import { RenderConfig } from "@/engine/core/RenderConfig";
import { Player, DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";
import type { PlayerParams } from "@/engine/entities/Player";
import { TileMap } from "@/engine/physics/TileMap";
import type { Platform } from "@/engine/physics/TileMap";
import { ParticleSystem } from "@/engine/core/ParticleSystem";
import { PasteOver, DEFAULT_PASTE_OVER_PARAMS } from "@/engine/abilities/PasteOver";
import type { PasteOverParams } from "@/engine/abilities/PasteOver";
import { SURFACE_PROPERTIES, getSurfaceProps } from "@/engine/physics/Surfaces";
import type { SurfaceType, SurfaceProperties } from "@/engine/physics/Surfaces";
import { InputAction } from "@/engine/input/InputManager";
import { COLORS, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/constants";
import Link from "next/link";

// ─── Constants ─────────────────────────────────────────────────────

const SPAWN_X = 80;
const SPAWN_Y = 400;
const RESPAWN_Y_THRESHOLD = 700;

/** Level dimensions — 2x canvas width for scrolling */
const LEVEL_WIDTH = 1920;
const LEVEL_HEIGHT = 540;

// ─── Test Level ────────────────────────────────────────────────────

function createTestLevel(): TileMap {
  const platforms: Platform[] = [
    // === Ground floor ===
    { x: 0, y: 480, width: LEVEL_WIDTH, height: 60 },

    // === Boundary walls + ceiling ===
    { x: -32, y: 0, width: 32, height: LEVEL_HEIGHT },       // left wall
    { x: LEVEL_WIDTH, y: 0, width: 32, height: LEVEL_HEIGHT }, // right wall
    { x: 0, y: -32, width: LEVEL_WIDTH, height: 32 },         // ceiling

    // === Zone 1: Source Surfaces (x: 60–440) ===
    // Five small platforms in a row, each with a different surface type
    { x: 60, y: 440, width: 80, height: 20, surfaceType: "normal" },
    { x: 150, y: 440, width: 80, height: 20, surfaceType: "bouncy" },
    { x: 240, y: 440, width: 80, height: 20, surfaceType: "icy" },
    { x: 330, y: 440, width: 80, height: 20, surfaceType: "sticky" },
    { x: 420, y: 440, width: 80, height: 20, surfaceType: "conveyor" },

    // === Zone 2: Bounce Challenge (x: 560–720) ===
    // Target platform — paste bouncy here to bounce up to goal
    { x: 560, y: 380, width: 160, height: 20 },
    // Goal platform (high up, only reachable by bouncing)
    { x: 600, y: 200, width: 80, height: 20 },

    // === Zone 3: Speed Run Challenge (x: 960–1380) ===
    // Long normal platform — paste icy here for speed
    { x: 960, y: 440, width: 240, height: 20 },
    // Three small aerial platforms spaced 120px apart
    { x: 1220, y: 360, width: 40, height: 16 },
    { x: 1290, y: 340, width: 40, height: 16 },
    { x: 1360, y: 320, width: 40, height: 16 },

    // === Zone 4: Wall Grip Challenge (x: 1480–1860) ===
    // Two tall icy walls (pre-set icy so they're slippery)
    { x: 1500, y: 180, width: 20, height: 300, surfaceType: "icy" },
    { x: 1820, y: 180, width: 20, height: 300, surfaceType: "icy" },
    // Goal platform between the walls (high up)
    { x: 1620, y: 200, width: 120, height: 20 },
    // Conveyor on the ground pushing toward the walls
    { x: 1540, y: 460, width: 100, height: 20, surfaceType: "conveyor" },
  ];

  return new TileMap(platforms);
}

// ─── Pass Criteria Tracking ────────────────────────────────────────

interface PassCriteria {
  autoCaptureBouncy: boolean;
  autoCaptureIcy: boolean;
  autoCaptureSticky: boolean;
  autoCaptureConveyor: boolean;
  pasteActivated: boolean;
  bouncyBounce: boolean;
  icySlide: boolean;
  icyHighSpeed: boolean;
  stickyQuickStop: boolean;
  stickyWallGrip: boolean;
  conveyorPush: boolean;
  pasteFromAnyState: boolean;
  pasteExpired: boolean;
  threeActivePastes: boolean;
  cooldownPrevented: boolean;
  bounceChallenge: boolean;
  speedChallenge: boolean;
  wallChallenge: boolean;
}

const INITIAL_CRITERIA: PassCriteria = {
  autoCaptureBouncy: false,
  autoCaptureIcy: false,
  autoCaptureSticky: false,
  autoCaptureConveyor: false,
  pasteActivated: false,
  bouncyBounce: false,
  icySlide: false,
  icyHighSpeed: false,
  stickyQuickStop: false,
  stickyWallGrip: false,
  conveyorPush: false,
  pasteFromAnyState: false,
  pasteExpired: false,
  threeActivePastes: false,
  cooldownPrevented: false,
  bounceChallenge: false,
  speedChallenge: false,
  wallChallenge: false,
};

// ─── Component ─────────────────────────────────────────────────────

interface EngineWithRefs extends Engine {
  __showOverlaysRef?: { current: boolean };
}

export default function PasteOverTest() {
  const engineRef = useRef<Engine | null>(null);
  const playerRef = useRef<Player | null>(null);
  const pasteOverRef = useRef<PasteOver | null>(null);
  const [showOverlays, setShowOverlays] = useState(true);
  const [params, setParams] = useState<PlayerParams>({ ...DEFAULT_PLAYER_PARAMS });
  const [pasteParams, setPasteParams] = useState<PasteOverParams>({ ...DEFAULT_PASTE_OVER_PARAMS });
  const [criteria, setCriteria] = useState<PassCriteria>({ ...INITIAL_CRITERIA });

  // Surface property sliders state — mutable copies
  const [surfaceValues, setSurfaceValues] = useState({
    bouncyBounce: SURFACE_PROPERTIES.bouncy.bounce,
    bouncyAccelMult: SURFACE_PROPERTIES.bouncy.accelerationMultiplier,
    icyFrictionMult: SURFACE_PROPERTIES.icy.frictionMultiplier,
    icyMaxSpeedMult: SURFACE_PROPERTIES.icy.maxSpeedMultiplier,
    stickyFrictionMult: SURFACE_PROPERTIES.sticky.frictionMultiplier,
    stickyMaxSpeedMult: SURFACE_PROPERTIES.sticky.maxSpeedMultiplier,
    stickyWallFrictionMult: SURFACE_PROPERTIES.sticky.wallFrictionMultiplier,
    conveyorSpeed: SURFACE_PROPERTIES.conveyor.conveyorSpeed,
  });

  // Paste-over info readout state
  const [pasteInfo, setPasteInfo] = useState({
    clipboard: null as SurfaceType | null,
    activePastes: 0,
    maxPastes: DEFAULT_PASTE_OVER_PARAMS.maxActivePastes,
    cooldownTimer: 0,
    hasTarget: false,
    standingSurface: "normal" as string,
    wallSurface: "none" as string,
  });

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

  const updatePasteParam = useCallback(<K extends keyof PasteOverParams>(key: K, value: PasteOverParams[K]) => {
    setPasteParams((prev) => {
      const next = { ...prev, [key]: value };
      if (pasteOverRef.current) {
        pasteOverRef.current.params[key] = value;
      }
      return next;
    });
  }, []);

  const updateSurfaceValue = useCallback((key: string, value: number) => {
    setSurfaceValues((prev) => {
      const next = { ...prev, [key]: value };

      // Apply to the mutable SURFACE_PROPERTIES
      switch (key) {
        case "bouncyBounce":
          SURFACE_PROPERTIES.bouncy.bounce = value;
          break;
        case "bouncyAccelMult":
          SURFACE_PROPERTIES.bouncy.accelerationMultiplier = value;
          break;
        case "icyFrictionMult":
          SURFACE_PROPERTIES.icy.frictionMultiplier = value;
          break;
        case "icyMaxSpeedMult":
          SURFACE_PROPERTIES.icy.maxSpeedMultiplier = value;
          break;
        case "stickyFrictionMult":
          SURFACE_PROPERTIES.sticky.frictionMultiplier = value;
          break;
        case "stickyMaxSpeedMult":
          SURFACE_PROPERTIES.sticky.maxSpeedMultiplier = value;
          break;
        case "stickyWallFrictionMult":
          SURFACE_PROPERTIES.sticky.wallFrictionMultiplier = value;
          break;
        case "conveyorSpeed":
          SURFACE_PROPERTIES.conveyor.conveyorSpeed = value;
          break;
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
    setPasteParams({ ...DEFAULT_PASTE_OVER_PARAMS });
    if (pasteOverRef.current) {
      Object.assign(pasteOverRef.current.params, DEFAULT_PASTE_OVER_PARAMS);
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
      player.isBouncing = false;
    }
  }, []);

  const resetSurfaces = useCallback(() => {
    if (pasteOverRef.current) {
      pasteOverRef.current.clearAllPastes();
      pasteOverRef.current.clipboard = null;
    }
  }, []);

  const handleMount = useCallback((ctx: CanvasRenderingContext2D) => {
    RenderConfig.setMode("rectangles");
    const engine = new Engine({ ctx });
    const camera = engine.getCamera();
    const tileMap = createTestLevel();
    const player = new Player();
    const particles = new ParticleSystem();
    const pasteOver = new PasteOver();

    // Setup camera for scrolling level
    camera.bounds = { x: 0, y: 0, width: LEVEL_WIDTH, height: LEVEL_HEIGHT };
    camera.followSpeed = 6.0;
    camera.lookaheadX = 100;
    camera.lookaheadY = 30;

    // Setup player
    player.position.x = SPAWN_X;
    player.position.y = SPAWN_Y;
    player.input = engine.getInput();
    player.tileMap = tileMap;
    player.particleSystem = particles;

    // Setup paste-over
    pasteOver.particleSystem = particles;

    engine.getEntities().add(player);

    engineRef.current = engine;
    playerRef.current = player;
    pasteOverRef.current = pasteOver;

    // Criteria refs for update closure
    const criteriaRef = { current: { ...INITIAL_CRITERIA } };

    // For icy slide detection
    let icySlideTimer = 0;
    // For sticky quick-stop detection
    let stickyStopCheckPrevVelX = 0;
    let stickyStopTimer = 0;
    // For conveyor push detection
    let conveyorIdleTimer = 0;
    let conveyorStartX = 0;

    // Overlay toggle ref
    const showOverlaysRef = { current: true };

    // Snap camera to player initially
    camera.snapTo({
      x: player.position.x + player.size.x / 2,
      y: player.position.y + player.size.y / 2,
    });

    // ─── Update callback ───
    engine.onUpdate((dt) => {
      // Auto-respawn if player falls off screen
      if (player.position.y > RESPAWN_Y_THRESHOLD) {
        player.position.x = SPAWN_X;
        player.position.y = SPAWN_Y;
        player.velocity.x = 0;
        player.velocity.y = 0;
        player.size.y = player.params.playerHeight;
        player.grounded = false;
      }

      // Camera follows player
      const playerCenter = {
        x: player.position.x + player.size.x / 2,
        y: player.position.y + player.size.y / 2,
      };
      camera.follow(playerCenter, player.velocity, dt);

      // Detect ground and wall surfaces
      const groundSurfaceType = tileMap.getGroundSurface(player);
      const groundSurfaceProps = getSurfaceProps(groundSurfaceType);
      player.currentSurface = groundSurfaceProps;

      // Detect wall surface based on which side the player is touching
      if (player.wallSide !== 0) {
        const wallSurfaceType = tileMap.getWallSurface(player, player.wallSide as -1 | 1);
        player.currentWallSurface = getSurfaceProps(wallSurfaceType);
      } else {
        player.currentWallSurface = SURFACE_PROPERTIES.normal;
      }

      // Auto-capture surface type from ground
      pasteOver.autoCapture(groundSurfaceType);

      // Also auto-capture from wall surfaces when wall-sliding
      if (player.wallSide !== 0) {
        const wallSurfaceType = tileMap.getWallSurface(player, player.wallSide as -1 | 1);
        pasteOver.autoCapture(wallSurfaceType);
      }

      // Scan for paste target
      pasteOver.scanForTarget(
        player.position,
        player.size,
        tileMap,
        player.wallSide as -1 | 0 | 1,
      );

      // Check paste activation input
      const input = engine.getInput();
      if (input.isPressed(InputAction.Ability3)) {
        if (pasteOver.canActivate) {
          const state = player.stateMachine.getCurrentState();
          pasteOver.activate();
          criteriaRef.current.pasteActivated = true;

          // Track activation from non-IDLE state
          if (state !== "IDLE") {
            criteriaRef.current.pasteFromAnyState = true;
          }
        } else if (pasteOver.cooldownTimer > 0) {
          criteriaRef.current.cooldownPrevented = true;
        }
      }

      // Toggle debug overlays with J/Enter key (Attack action)
      if (input.isPressed(InputAction.Attack)) {
        showOverlaysRef.current = !showOverlaysRef.current;
      }

      // Update paste-over timers
      const prevPasteCount = pasteOver.activePastes.length;
      pasteOver.update(dt);
      if (prevPasteCount > 0 && pasteOver.activePastes.length < prevPasteCount) {
        criteriaRef.current.pasteExpired = true;
      }

      // Update particles
      particles.update(dt);

      // ─── Criteria Detection ───

      // Auto-capture detection
      if (pasteOver.clipboard === "bouncy") criteriaRef.current.autoCaptureBouncy = true;
      if (pasteOver.clipboard === "icy") criteriaRef.current.autoCaptureIcy = true;
      if (pasteOver.clipboard === "sticky") criteriaRef.current.autoCaptureSticky = true;
      if (pasteOver.clipboard === "conveyor") criteriaRef.current.autoCaptureConveyor = true;

      // Three active pastes
      if (pasteOver.activePastes.length >= 3) {
        criteriaRef.current.threeActivePastes = true;
      }

      // Bouncy bounce: velocity.y becomes negative after landing on bouncy surface
      if (
        groundSurfaceType === "bouncy" &&
        player.velocity.y < -10 &&
        player.stateMachine.getCurrentState() === "JUMPING"
      ) {
        criteriaRef.current.bouncyBounce = true;
      }

      // Icy slide: player velocity > 10 for > 0.5s after releasing keys on icy surface
      if (groundSurfaceType === "icy" && !input.isHeld(InputAction.Left) && !input.isHeld(InputAction.Right)) {
        if (Math.abs(player.velocity.x) > 10) {
          icySlideTimer += dt;
          if (icySlideTimer > 0.5) {
            criteriaRef.current.icySlide = true;
          }
        } else {
          icySlideTimer = 0;
        }
      } else {
        icySlideTimer = 0;
      }

      // Icy high speed: velocity.x exceeds maxRunSpeed * 1.3
      if (groundSurfaceType === "icy" && Math.abs(player.velocity.x) > player.params.maxRunSpeed * 1.3) {
        criteriaRef.current.icyHighSpeed = true;
      }

      // Sticky quick stop: velocity reaches 0 within 0.1s of releasing keys
      if (groundSurfaceType === "sticky") {
        if (!input.isHeld(InputAction.Left) && !input.isHeld(InputAction.Right)) {
          if (Math.abs(stickyStopCheckPrevVelX) > 50 && Math.abs(player.velocity.x) < 5) {
            if (stickyStopTimer < 0.1) {
              criteriaRef.current.stickyQuickStop = true;
            }
          }
          stickyStopTimer += dt;
        } else {
          stickyStopTimer = 0;
        }
      }
      stickyStopCheckPrevVelX = player.velocity.x;

      // Sticky wall grip: wall-slide speed < wallSlideGripSpeed * 0.3 on sticky wall
      if (player.wallSide !== 0) {
        const wallSurfaceType = tileMap.getWallSurface(player, player.wallSide as -1 | 1);
        if (wallSurfaceType === "sticky" && player.velocity.y < player.params.wallSlideGripSpeed * 0.3) {
          criteriaRef.current.stickyWallGrip = true;
        }
      }

      // Conveyor push: position.x changes by > 50px in 1s while idle
      if (groundSurfaceType === "conveyor" && !input.isHeld(InputAction.Left) && !input.isHeld(InputAction.Right)) {
        if (conveyorIdleTimer === 0) {
          conveyorStartX = player.position.x;
        }
        conveyorIdleTimer += dt;
        if (conveyorIdleTimer >= 1.0) {
          if (Math.abs(player.position.x - conveyorStartX) > 50) {
            criteriaRef.current.conveyorPush = true;
          }
          conveyorIdleTimer = 0;
        }
      } else {
        conveyorIdleTimer = 0;
      }

      // Bounce challenge: reach the high platform at y=200 in zone 2
      if (player.position.x > 600 && player.position.x < 680 && player.position.y < 210 && player.grounded) {
        criteriaRef.current.bounceChallenge = true;
      }

      // Speed challenge: reach the last aerial platform in zone 3
      if (player.position.x > 1360 && player.position.x < 1400 && player.position.y < 330 && player.grounded) {
        criteriaRef.current.speedChallenge = true;
      }

      // Wall grip challenge: reach the goal platform between walls in zone 4
      if (player.position.x > 1620 && player.position.x < 1740 && player.position.y < 210 && player.grounded) {
        criteriaRef.current.wallChallenge = true;
      }

      // Push UI state to React periodically (every 10 frames to avoid 60fps re-renders)
      if (input.getFrameCount() % 10 === 0) {
        setPasteInfo({
          clipboard: pasteOver.clipboard,
          activePastes: pasteOver.activePastes.length,
          maxPastes: pasteOver.params.maxActivePastes,
          cooldownTimer: pasteOver.cooldownTimer,
          hasTarget: pasteOver.targetPlatform !== null,
          standingSurface: groundSurfaceProps.label,
          wallSurface: player.wallSide !== 0
            ? getSurfaceProps(tileMap.getWallSurface(player, player.wallSide as -1 | 1)).label
            : "none",
        });
        setCriteria({ ...criteriaRef.current });
      }
    });

    // ─── World-space render callback ───
    engine.onRender((renderer, interpolation) => {
      // Draw tilemap
      tileMap.render(renderer);

      // Render surface type labels on platforms
      if (showOverlaysRef.current) {
        for (const p of tileMap.platforms) {
          if (p.surfaceType && p.surfaceType !== "normal") {
            const surfaceProps = getSurfaceProps(p.surfaceType);
            renderer.drawText(
              surfaceProps.label,
              p.x + p.width / 2 - surfaceProps.label.length * 3,
              p.y - 4,
              surfaceProps.color,
              9,
            );
          }
        }
      }

      // Render paste-over visuals in world space
      const rawCtx = renderer.getContext();
      pasteOver.render(rawCtx, camera);

      // Render particles in world space
      particles.render(renderer);

      if (!showOverlaysRef.current) return;

      const pos = player.getInterpolatedPosition(interpolation);
      const state = player.stateMachine.getCurrentState();

      // Player hitbox
      renderer.strokeRect(pos.x, pos.y, player.size.x, player.size.y, COLORS.debug.hitbox, 1);

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
        renderer.drawCircle(pos.x + player.size.x / 2, pos.y + player.size.y + 3, 3, COLORS.debug.ground);
      }

      // Current surface props readout near player
      const surface = player.currentSurface;
      if (surface.type !== "normal") {
        renderer.drawText(
          `Surface: ${surface.label}`,
          pos.x - 20,
          pos.y + player.size.y + 16,
          surface.color,
          9,
        );
        renderer.drawText(
          `accel:${surface.accelerationMultiplier.toFixed(1)} fric:${surface.frictionMultiplier.toFixed(2)} spd:${surface.maxSpeedMultiplier.toFixed(1)}`,
          pos.x - 40,
          pos.y + player.size.y + 26,
          "#9ca3af",
          8,
        );
      }

      // Zone labels
      renderer.drawText("SOURCE SURFACES", 140, 425, "#6b7280", 10);
      renderer.drawText("BOUNCE CHALLENGE", 570, 170, "#f472b6", 10);
      renderer.drawText("SPEED CHALLENGE", 1060, 300, "#67e8f9", 10);
      renderer.drawText("WALL GRIP CHALLENGE", 1580, 170, "#a78bfa", 10);
    });

    // ─── Screen-space debug layer ───
    const debugLayerCallback = (ctx: CanvasRenderingContext2D) => {
      // Paste-over HUD (clipboard indicator)
      pasteOver.renderUI(ctx);

      if (!showOverlaysRef.current) return;

      const metrics = engine.getMetrics();

      // FPS counter
      ctx.fillStyle = COLORS.debug.ground;
      ctx.font = "12px monospace";
      ctx.fillText(`FPS: ${Math.round(metrics.fps)}`, 8, 16);

      // Velocity readout
      ctx.fillStyle = COLORS.debug.velocity;
      ctx.textAlign = "right";
      ctx.fillText(`VelX: ${Math.round(player.velocity.x)} px/s`, CANVAS_WIDTH - 8, 16);
      ctx.fillText(`VelY: ${Math.round(player.velocity.y)} px/s`, CANVAS_WIDTH - 8, 32);
      ctx.textAlign = "left";

      // State readout (bottom-left)
      const diagX = 8;
      const diagY = CANVAS_HEIGHT - 70;
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(diagX - 4, diagY - 14, 280, 80);

      ctx.fillStyle = "#a78bfa";
      ctx.font = "11px monospace";
      ctx.fillText(`State: ${player.stateMachine.getCurrentState()}`, diagX, diagY);
      ctx.fillText(`Grounded: ${player.grounded ? "YES" : "NO"}`, diagX, diagY + 14);
      ctx.fillText(`Pos: (${Math.round(player.position.x)}, ${Math.round(player.position.y)})`, diagX, diagY + 28);
      ctx.fillText(`Surface: ${player.currentSurface.label}`, diagX, diagY + 42);
      if (player.wallSide !== 0) {
        ctx.fillText(`Wall Surface: ${player.currentWallSurface.label}`, diagX, diagY + 56);
      }

      // Controls hint
      ctx.fillStyle = "rgba(100, 100, 100, 0.5)";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.fillText("R: Paste | Arrows: Move | Z/Space: Jump | X/Shift: Dash", CANVAS_WIDTH - 8, CANVAS_HEIGHT - 8);
      ctx.textAlign = "left";
    };
    engine.getRenderer().addLayerCallback("debug", debugLayerCallback);

    // Store refs for overlay toggle
    (engine as EngineWithRefs).__showOverlaysRef = showOverlaysRef;

    engine.start();
  }, []);

  const handleUnmount = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    playerRef.current = null;
    pasteOverRef.current = null;
  }, []);

  const toggleOverlays = useCallback(() => {
    setShowOverlays((prev) => {
      const next = !prev;
      const engine = engineRef.current as EngineWithRefs | null;
      if (engine?.__showOverlaysRef) {
        engine.__showOverlaysRef.current = next;
      }
      return next;
    });
  }, []);

  const passCount = Object.values(criteria).filter(Boolean).length;
  const totalCriteria = Object.keys(criteria).length;

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
          Paste-Over
        </h1>
        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-mono text-amber-400">
          Phase 2 — Abilities
        </span>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas area */}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
          <GameCanvas onMount={handleMount} onUnmount={handleUnmount} />

          {/* Pass criteria */}
          <div className="w-[960px] text-xs font-mono leading-relaxed">
            <div className="text-zinc-400 mb-1">
              Pass Criteria: {passCount}/{totalCriteria}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-zinc-500">
              <CriterionRow label="Auto-capture bouncy surface" pass={criteria.autoCaptureBouncy} />
              <CriterionRow label="Auto-capture icy surface" pass={criteria.autoCaptureIcy} />
              <CriterionRow label="Auto-capture sticky surface" pass={criteria.autoCaptureSticky} />
              <CriterionRow label="Auto-capture conveyor surface" pass={criteria.autoCaptureConveyor} />
              <CriterionRow label="Paste-over activated on platform" pass={criteria.pasteActivated} />
              <CriterionRow label="Bouncy: player bounces on landing" pass={criteria.bouncyBounce} />
              <CriterionRow label="Icy: player slides after releasing keys" pass={criteria.icySlide} />
              <CriterionRow label="Icy: player reaches high max speed" pass={criteria.icyHighSpeed} />
              <CriterionRow label="Sticky: player stops almost instantly" pass={criteria.stickyQuickStop} />
              <CriterionRow label="Sticky: strong wall grip (slow slide)" pass={criteria.stickyWallGrip} />
              <CriterionRow label="Conveyor: pushes idle player" pass={criteria.conveyorPush} />
              <CriterionRow label="Paste from non-IDLE state" pass={criteria.pasteFromAnyState} />
              <CriterionRow label="Paste-over expires (timer countdown)" pass={criteria.pasteExpired} />
              <CriterionRow label="3 active paste-overs simultaneously" pass={criteria.threeActivePastes} />
              <CriterionRow label="Cooldown prevents re-paste" pass={criteria.cooldownPrevented} />
              <CriterionRow label="Bounce challenge completed" pass={criteria.bounceChallenge} />
              <CriterionRow label="Speed challenge completed" pass={criteria.speedChallenge} />
              <CriterionRow label="Wall grip challenge completed" pass={criteria.wallChallenge} />
            </div>
          </div>
        </div>

        {/* Debug panel */}
        <DebugPanel title="Paste-Over">
          <RenderModeToggle />
          {/* Paste-Over Info (always visible) */}
          <div className="pb-2 border-b border-zinc-800 mb-2">
            <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-1">
              Paste-Over Info
            </div>
            <div className="text-xs font-mono space-y-0.5">
              <div className="flex justify-between">
                <span className="text-zinc-500">Clipboard</span>
                <span className={pasteInfo.clipboard ? "text-amber-400" : "text-zinc-600"}>
                  {pasteInfo.clipboard ?? "Empty"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Active Pastes</span>
                <span className="text-zinc-300">{pasteInfo.activePastes}/{pasteInfo.maxPastes}</span>
              </div>
              {pasteInfo.cooldownTimer > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Cooldown</span>
                  <span className="text-red-400">{pasteInfo.cooldownTimer.toFixed(1)}s</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-zinc-500">Target</span>
                <span className={pasteInfo.hasTarget ? "text-green-400" : "text-zinc-600"}>
                  {pasteInfo.hasTarget ? "YES" : "NO"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Standing on</span>
                <span className="text-zinc-300">{pasteInfo.standingSurface}</span>
              </div>
              {pasteInfo.wallSurface !== "none" && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Wall Surface</span>
                  <span className="text-zinc-300">{pasteInfo.wallSurface}</span>
                </div>
              )}
            </div>
          </div>

          {/* Paste-Over Params */}
          <details open>
            <summary className="text-xs font-mono text-amber-500/80 uppercase tracking-wider cursor-pointer select-none">
              Paste-Over Params
            </summary>
            <div className="flex flex-col gap-4 pt-2">
              <Slider
                label="Paste Range"
                value={pasteParams.maxPasteRange}
                min={20} max={120} step={4}
                onChange={(v) => updatePasteParam("maxPasteRange", v)}
              />
              <Slider
                label="Duration"
                value={pasteParams.pasteDuration}
                min={2.0} max={20.0} step={1.0}
                onChange={(v) => updatePasteParam("pasteDuration", v)}
              />
              <Slider
                label="Cooldown"
                value={pasteParams.pasteCooldown}
                min={0.0} max={10.0} step={0.5}
                onChange={(v) => updatePasteParam("pasteCooldown", v)}
              />
              <Slider
                label="Max Active"
                value={pasteParams.maxActivePastes}
                min={1} max={6} step={1}
                onChange={(v) => updatePasteParam("maxActivePastes", v)}
              />
            </div>
          </details>

          {/* Surface Properties */}
          <details open>
            <summary className="text-xs font-mono text-amber-500/80 uppercase tracking-wider cursor-pointer select-none pt-2">
              Surface Properties
            </summary>
            <div className="flex flex-col gap-4 pt-2">
              <Slider
                label="Bouncy: Bounce"
                value={surfaceValues.bouncyBounce}
                min={0.0} max={1.0} step={0.05}
                onChange={(v) => updateSurfaceValue("bouncyBounce", v)}
              />
              <Slider
                label="Bouncy: Accel Mult"
                value={surfaceValues.bouncyAccelMult}
                min={0.1} max={2.0} step={0.1}
                onChange={(v) => updateSurfaceValue("bouncyAccelMult", v)}
              />
              <Slider
                label="Icy: Friction Mult"
                value={surfaceValues.icyFrictionMult}
                min={0.01} max={1.0} step={0.01}
                onChange={(v) => updateSurfaceValue("icyFrictionMult", v)}
              />
              <Slider
                label="Icy: Max Speed Mult"
                value={surfaceValues.icyMaxSpeedMult}
                min={0.5} max={3.0} step={0.1}
                onChange={(v) => updateSurfaceValue("icyMaxSpeedMult", v)}
              />
              <Slider
                label="Sticky: Friction Mult"
                value={surfaceValues.stickyFrictionMult}
                min={1.0} max={10.0} step={0.5}
                onChange={(v) => updateSurfaceValue("stickyFrictionMult", v)}
              />
              <Slider
                label="Sticky: Max Speed Mult"
                value={surfaceValues.stickyMaxSpeedMult}
                min={0.2} max={1.0} step={0.05}
                onChange={(v) => updateSurfaceValue("stickyMaxSpeedMult", v)}
              />
              <Slider
                label="Sticky: Wall Friction"
                value={surfaceValues.stickyWallFrictionMult}
                min={1.0} max={10.0} step={0.5}
                onChange={(v) => updateSurfaceValue("stickyWallFrictionMult", v)}
              />
              <Slider
                label="Conveyor: Speed"
                value={surfaceValues.conveyorSpeed}
                min={50} max={400} step={10}
                onChange={(v) => updateSurfaceValue("conveyorSpeed", v)}
              />
            </div>
          </details>

          {/* Player State (collapsed) */}
          <details>
            <summary className="text-xs font-mono text-zinc-500 uppercase tracking-wider cursor-pointer select-none pt-2">
              Player Movement
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
                min={200} max={5000} step={100}
                onChange={(v) => updateParam("deceleration", v)}
              />
              <Slider
                label="Jump Speed"
                value={params.jumpSpeed}
                min={200} max={600} step={10}
                onChange={(v) => updateParam("jumpSpeed", v)}
              />
              <Slider
                label="Dash Speed"
                value={params.dashSpeed}
                min={200} max={1200} step={25}
                onChange={(v) => updateParam("dashSpeed", v)}
              />
            </div>
          </details>

          {/* Controls */}
          <details open>
            <summary className="text-xs font-mono text-zinc-500 uppercase tracking-wider cursor-pointer select-none pt-2">
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
                onClick={resetParams}
                className="w-full rounded bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Reset Params
              </button>
              <button
                onClick={resetSurfaces}
                className="w-full rounded bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Reset All Surfaces
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
          </details>

          {/* Keyboard reference */}
          <div className="pt-2 border-t border-zinc-800 mt-2">
            <div className="text-xs font-mono text-zinc-600 space-y-0.5">
              <div>Arrows &mdash; Move</div>
              <div>Z / Space &mdash; Jump</div>
              <div>Down &mdash; Crouch</div>
              <div>X / Shift &mdash; Dash</div>
              <div>R &mdash; Paste surface</div>
            </div>
          </div>
        </DebugPanel>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────

function CriterionRow({ label, pass }: { label: string; pass: boolean }) {
  return (
    <div className={pass ? "text-green-400" : "text-zinc-600"}>
      {pass ? "\u2713" : "\u2610"} {label}
    </div>
  );
}
