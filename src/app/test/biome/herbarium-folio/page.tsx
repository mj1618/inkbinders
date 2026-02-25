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
import { VineSystem, DEFAULT_VINE_PARAMS } from "@/engine/world/VineSystem";
import type { VineAnchor, VineParams } from "@/engine/world/VineSystem";
import { HERBARIUM_FOLIO_THEME } from "@/engine/world/Biome";
import type { BiomeTheme } from "@/engine/world/Biome";
import { createHerbariumBackground } from "@/engine/world/BiomeBackground";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/constants";
import type { Rect } from "@/lib/types";
import { aabbOverlap } from "@/engine/physics/AABB";
import { getSurfaceProps } from "@/engine/physics/Surfaces";
import type { SurfaceType } from "@/engine/physics/Surfaces";
import Link from "next/link";

// ─── Constants ──────────────────────────────────────────────────────

const LEVEL_WIDTH = 3840;
const LEVEL_HEIGHT = 1080;
const SPAWN_X = 100;
const SPAWN_Y = 740;
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
      rect: { x: 3400, y: 920, width: 200, height: 80 },
      label: "Goal A (ground)",
      reached: false,
    },
    {
      id: "goal-b",
      rect: { x: 3500, y: 270, width: 200, height: 80 },
      label: "Goal B (elevated)",
      reached: false,
    },
  ];
}

// ─── Level Construction ─────────────────────────────────────────────

function createTestLevel(): TileMap {
  const platforms: Platform[] = [
    // === Ground sections (with gaps requiring vine traversal) ===
    { x: 0, y: 1000, width: 480, height: 80 },
    { x: 560, y: 1000, width: 400, height: 80 },
    { x: 1040, y: 1000, width: 400, height: 80 },
    { x: 1520, y: 1000, width: 400, height: 80 },
    { x: 2000, y: 1000, width: 400, height: 80 },
    { x: 2480, y: 1000, width: 400, height: 80 },
    { x: 2960, y: 1000, width: 880, height: 80 },

    // === Low stepping platforms (over gaps) ===
    { x: 490, y: 900, width: 60, height: 20 },
    { x: 1000, y: 880, width: 60, height: 20 },
    { x: 1920, y: 890, width: 60, height: 20 },

    // === Start platform (elevated) ===
    { x: 60, y: 780, width: 160, height: 20 },

    // === Mid-tier platforms ===
    { x: 300, y: 660, width: 200, height: 20 },
    { x: 800, y: 600, width: 200, height: 20 },
    { x: 1600, y: 480, width: 300, height: 20 },
    { x: 2600, y: 580, width: 180, height: 20 },

    // === High-tier platforms (vine chains needed) ===
    { x: 1200, y: 350, width: 160, height: 20, surfaceType: "sticky" as SurfaceType },
    { x: 2400, y: 320, width: 160, height: 20 },

    // === Goal platforms ===
    { x: 3400, y: 1000, width: 200, height: 80 },
    { x: 3500, y: 350, width: 200, height: 20 },

    // === Walls ===
    { x: 0, y: 0, width: 20, height: 1080 },
    { x: 3820, y: 0, width: 20, height: 1080 },

    // === Ceiling ===
    { x: 0, y: 0, width: 3840, height: 20 },
  ];

  return new TileMap(platforms);
}

// ─── Vine Anchor Placement ──────────────────────────────────────────

function createVineAnchors(): VineAnchor[] {
  return [
    { id: "v1", position: { x: 200, y: 80 }, ropeLength: 150, active: true, type: "ceiling" },
    { id: "v2", position: { x: 480, y: 60 }, ropeLength: 180, active: true, type: "ceiling" },
    { id: "v3", position: { x: 900, y: 80 }, ropeLength: 160, active: true, type: "ceiling" },
    { id: "v4", position: { x: 1150, y: 60 }, ropeLength: 140, active: true, type: "ceiling" },
    { id: "v5", position: { x: 1550, y: 80 }, ropeLength: 170, active: true, type: "ceiling" },
    { id: "v6", position: { x: 2000, y: 60 }, ropeLength: 150, active: true, type: "ceiling" },
    { id: "v7", position: { x: 2350, y: 80 }, ropeLength: 160, active: true, type: "ceiling" },
    { id: "v8", position: { x: 2700, y: 60 }, ropeLength: 180, active: true, type: "ceiling" },
    { id: "v9", position: { x: 3100, y: 80 }, ropeLength: 150, active: true, type: "ceiling" },
    { id: "v10", position: { x: 3450, y: 60 }, ropeLength: 140, active: true, type: "ceiling" },
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

    // Grassy top line (only for horizontal platforms, not walls)
    if (plat.width > plat.height && plat.height <= 80) {
      ctx.strokeStyle = "#4ade80";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plat.x, plat.y);
      ctx.lineTo(plat.x + plat.width, plat.y);
      ctx.stroke();

      // Small vine tendrils from platform edges
      if (plat.width >= 100) {
        ctx.strokeStyle = "#3b6b3b";
        ctx.lineWidth = 0.8;

        // Left edge tendril
        ctx.beginPath();
        ctx.moveTo(plat.x + 5, plat.y);
        ctx.quadraticCurveTo(plat.x - 5, plat.y - 15, plat.x - 2, plat.y - 25);
        ctx.stroke();

        // Right edge tendril
        ctx.beginPath();
        ctx.moveTo(plat.x + plat.width - 5, plat.y);
        ctx.quadraticCurveTo(
          plat.x + plat.width + 5,
          plat.y - 15,
          plat.x + plat.width + 2,
          plat.y - 25,
        );
        ctx.stroke();
      }
    }

    // Sticky surface indicator
    if (plat.surfaceType === "sticky") {
      ctx.fillStyle = "rgba(167, 139, 250, 0.3)";
      ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
    }

    ctx.restore();
  }
}

// ─── Engine Ref Extension ───────────────────────────────────────────

interface EngineRefs extends Engine {
  __showOverlaysRef?: { current: boolean };
}

// ─── Ambient particle timer ─────────────────────────────────────────

const AMBIENT_PARTICLE_COLORS = HERBARIUM_FOLIO_THEME.ambientParticleColors;

// ─── Test Page Component ────────────────────────────────────────────

export default function HerbariumFolioTest() {
  const engineRef = useRef<Engine | null>(null);
  const playerRef = useRef<Player | null>(null);
  const vineSystemRef = useRef<VineSystem | null>(null);
  const goalZonesRef = useRef<GoalZone[]>(createGoalZones());

  const [showOverlays, setShowOverlays] = useState(true);
  const [params, setParams] = useState<PlayerParams>({ ...DEFAULT_PLAYER_PARAMS });
  const [vineParams, setVineParams] = useState<VineParams>({ ...DEFAULT_VINE_PARAMS });
  const [showVineRanges, setShowVineRanges] = useState(true);
  const [showSwingArc, setShowSwingArc] = useState(true);
  const [showAmbientParticles, setShowAmbientParticles] = useState(true);
  const [showParallaxBg, setShowParallaxBg] = useState(true);
  const [useBiomeColors, setUseBiomeColors] = useState(true);

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

  const updateVineParam = useCallback(
    <K extends keyof VineParams>(key: K, value: VineParams[K]) => {
      setVineParams((prev) => {
        const next = { ...prev, [key]: value };
        const vs = vineSystemRef.current;
        if (vs) {
          vs.params[key] = value;
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
    // Also detach from vine
    const vs = vineSystemRef.current;
    if (vs && vs.isSwinging) {
      vs.reset();
    }
  }, []);

  const resetVines = useCallback(() => {
    const vs = vineSystemRef.current;
    if (vs) {
      vs.reset();
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

    // Vine system
    const vineSystem = new VineSystem(createVineAnchors());

    // Biome background
    const biomeBackground = createHerbariumBackground(LEVEL_WIDTH, LEVEL_HEIGHT);

    // Biome theme
    const theme = HERBARIUM_FOLIO_THEME;

    engineRef.current = engine;
    playerRef.current = player;
    vineSystemRef.current = vineSystem;

    // Overlay ref
    const showOverlaysRef = { current: true };
    (engine as EngineRefs).__showOverlaysRef = showOverlaysRef;

    // Visual toggle refs (captured by closure, updated via setState effects)
    const showVineRangesRef = { current: true };
    const showSwingArcRef = { current: true };
    const showAmbientParticlesRef = { current: true };
    const showParallaxBgRef = { current: true };
    const useBiomeColorsRef = { current: true };

    // Expose refs for toggle updates
    (engine as EngineRefs & {
      __showVineRangesRef?: { current: boolean };
      __showSwingArcRef?: { current: boolean };
      __showAmbientParticlesRef?: { current: boolean };
      __showParallaxBgRef?: { current: boolean };
      __useBiomeColorsRef?: { current: boolean };
    }).__showVineRangesRef = showVineRangesRef;
    (engine as EngineRefs & { __showSwingArcRef?: { current: boolean } }).__showSwingArcRef = showSwingArcRef;
    (engine as EngineRefs & { __showAmbientParticlesRef?: { current: boolean } }).__showAmbientParticlesRef = showAmbientParticlesRef;
    (engine as EngineRefs & { __showParallaxBgRef?: { current: boolean } }).__showParallaxBgRef = showParallaxBgRef;
    (engine as EngineRefs & { __useBiomeColorsRef?: { current: boolean } }).__useBiomeColorsRef = useBiomeColorsRef;

    // Ambient particle accumulator
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
        if (vineSystem.isSwinging) vineSystem.reset();
        player.active = true;
      }

      // Update vine system sway time (for decorative vines)
      vineSystem.swayTime += dt;

      // Player center
      const playerCenter = {
        x: player.position.x + player.size.x / 2,
        y: player.position.y + player.size.y / 2,
      };

      // ─── Vine Input Handling ──────────────────────────────

      if (vineSystem.isSwinging) {
        // While swinging: skip normal player physics, drive vine system

        // Detach conditions
        let shouldDetach = false;

        // E toggles off
        if (input.isPressed(InputAction.Ability1)) {
          shouldDetach = true;
        }

        // Jump detaches
        if (
          vineSystem.params.jumpDetaches &&
          (input.isPressed(InputAction.Jump) || input.isPressed(InputAction.Up))
        ) {
          shouldDetach = true;
        }

        // Dash detaches and starts dash
        const dashDetach =
          input.isPressed(InputAction.Dash) && player.dashAvailable;

        if (dashDetach) {
          shouldDetach = true;
        }

        if (shouldDetach) {
          const releaseVel = vineSystem.detach();
          player.position.x = vineSystem.swingPosition.x;
          player.position.y = vineSystem.swingPosition.y;
          player.velocity.x = releaseVel.x;
          player.velocity.y = releaseVel.y;
          player.grounded = false;
          // Re-enable normal player update
          player.active = true;
        } else {
          // Update swing
          const inputLeft = input.isHeld(InputAction.Left);
          const inputRight = input.isHeld(InputAction.Right);
          const inputUp = input.isHeld(InputAction.Up);
          const inputDown = input.isHeld(InputAction.Down);

          const newPos = vineSystem.update(dt, inputLeft, inputRight, inputUp, inputDown);

          // Check for platform collision during swing
          const swingBounds: Rect = {
            x: newPos.x,
            y: newPos.y,
            width: player.size.x,
            height: player.size.y,
          };

          let collidesWithPlatform = false;
          for (const plat of tileMap.platforms) {
            if (aabbOverlap(swingBounds, plat)) {
              collidesWithPlatform = true;
              break;
            }
          }

          if (collidesWithPlatform) {
            // Auto-detach on platform collision
            const releaseVel = vineSystem.detach();
            // Don't update position to collision pos — keep prev valid position
            player.velocity.x = releaseVel.x * 0.5; // Reduce velocity on collision detach
            player.velocity.y = releaseVel.y * 0.5;
            player.grounded = false;
            // Re-enable normal player update
            player.active = true;
          } else {
            // Apply swing position to player (update prevPosition for interpolation)
            player.prevPosition.x = player.position.x;
            player.prevPosition.y = player.position.y;
            player.position.x = newPos.x;
            player.position.y = newPos.y;
          }
        }

        // Emit trail particles during fast swings
        if (vineSystem.isSwinging && Math.abs(vineSystem.angularVelocity) > 3) {
          particleSystem.emit({
            x: player.position.x + player.size.x / 2,
            y: player.position.y + player.size.y / 2,
            count: 1,
            speedMin: 10,
            speedMax: 30,
            angleMin: 0,
            angleMax: Math.PI * 2,
            lifeMin: 0.3,
            lifeMax: 0.6,
            sizeMin: 2,
            sizeMax: 3,
            colors: ["#4ade80", "#86efac"],
            gravity: 0,
          });
        }
      } else {
        // Not swinging — check for vine attach
        if (input.isPressed(InputAction.Ability1)) {
          const nearest = vineSystem.findNearestAnchor(playerCenter);
          if (nearest) {
            vineSystem.attach(nearest, playerCenter, player.velocity);
            // Suppress normal player update while swinging
            player.active = false;
            // Set position immediately to vine swing position
            player.position.x = vineSystem.swingPosition.x;
            player.position.y = vineSystem.swingPosition.y;
          }
        }

        // Normal surface physics
        const groundSurface = tileMap.getGroundSurface({
          position: player.position,
          size: player.size,
        });
        player.currentSurface = getSurfaceProps(groundSurface);

        const wallSide = player.wallSide;
        if (wallSide !== 0) {
          const wallSurface = tileMap.getWallSurface(
            {
              position: player.position,
              size: player.size,
            },
            wallSide,
          );
          player.currentWallSurface = getSurfaceProps(wallSurface);
        }
      }

      // Camera follow (works whether swinging or not)
      const camTarget = vineSystem.isSwinging
        ? {
            x: vineSystem.swingPosition.x + player.size.x / 2,
            y: vineSystem.swingPosition.y + player.size.y / 2,
          }
        : {
            x: player.position.x + player.size.x / 2,
            y: player.position.y + player.size.y / 2,
          };
      const camVel = vineSystem.isSwinging ? vineSystem.swingVelocity : player.velocity;
      camera.follow(camTarget, camVel, dt);

      // Update particles
      particleSystem.update(dt);

      // Update screen shake
      const shakeOffset = screenShake.update();
      camera.position.x += shakeOffset.offsetX;
      camera.position.y += shakeOffset.offsetY;

      // Ambient particles
      if (showAmbientParticlesRef.current) {
        ambientParticleAccum += theme.ambientParticleRate * dt;
        while (ambientParticleAccum >= 1) {
          ambientParticleAccum -= 1;
          // Spawn at random position near the top of the viewport
          const viewport = camera.getViewportBounds();
          particleSystem.emit({
            x: viewport.x + Math.random() * viewport.width,
            y: viewport.y - 10,
            count: 1,
            speedMin: 5,
            speedMax: 15,
            angleMin: Math.PI * 0.3,  // Drift downward
            angleMax: Math.PI * 0.7,
            lifeMin: 3.0,
            lifeMax: 5.0,
            sizeMin: 2,
            sizeMax: 4,
            colors: AMBIENT_PARTICLE_COLORS,
            gravity: 0,
          });
        }
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
        // We need to temporarily reset camera transform to render parallax correctly
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

      // Draw platforms (biome-themed or default)
      if (useBiomeColorsRef.current) {
        renderBiomePlatforms(rCtx, tileMap, theme);
      } else {
        tileMap.render(renderer);
      }

      // Render vine system (anchors, decorative ropes, active rope) — world coordinates
      vineSystem.render(
        rCtx,
        showVineRangesRef.current && showOverlaysRef.current,
        showSwingArcRef.current && showOverlaysRef.current,
        vineSystem.isSwinging
          ? null
          : {
              x: player.position.x + player.size.x / 2,
              y: player.position.y + player.size.y / 2,
            },
      );

      // Manually render player when swinging (entity manager skips inactive entities)
      if (!player.active) {
        const pos = player.getInterpolatedPosition(interpolation);
        // Apply slight rotation while swinging
        if (vineSystem.isSwinging) {
          rCtx.save();
          const cx = pos.x + player.size.x / 2;
          const cy = pos.y + player.size.y / 2;
          rCtx.translate(cx, cy);
          rCtx.rotate(vineSystem.angle * 0.3);
          rCtx.translate(-cx, -cy);
          renderer.fillRect(pos.x, pos.y, player.size.x, player.size.y, player.color);
          rCtx.restore();
        } else {
          renderer.fillRect(pos.x, pos.y, player.size.x, player.size.y, player.color);
        }
      }

      // Render particles (world space)
      particleSystem.render(renderer);

      // Goal zone rendering
      for (const zone of goalZonesRef.current) {
        rCtx.save();
        rCtx.fillStyle = zone.reached
          ? "rgba(74, 222, 128, 0.3)"
          : "rgba(74, 222, 128, 0.08)";
        rCtx.fillRect(zone.rect.x, zone.rect.y, zone.rect.width, zone.rect.height);

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

      // Player hitbox
      renderer.strokeRect(
        pos.x,
        pos.y,
        player.size.x,
        player.size.y,
        "#22d3ee",
        1,
      );

      // Velocity vector (only when not swinging — vine system draws its own)
      if (!vineSystem.isSwinging) {
        const cx = pos.x + player.size.x / 2;
        const cy = pos.y + player.size.y / 2;
        const vScale = 0.15;
        const vx = player.velocity.x * vScale;
        const vy = player.velocity.y * vScale;
        if (Math.abs(vx) > 1 || Math.abs(vy) > 1) {
          renderer.drawLine(cx, cy, cx + vx, cy + vy, "#f59e0b", 2);
        }
      }

      // State label
      const stateText = vineSystem.isSwinging ? `${state} [VINE]` : state;
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
      rCtx.fillStyle = "#4ade80";
      rCtx.font = "bold 24px monospace";
      rCtx.fillText("HERBARIUM FOLIO", 60, 60);
      rCtx.restore();
    });

    // ─── Screen-Space Debug Layer ──────────────────────────────

    const debugLayerCallback = (debugCtx: CanvasRenderingContext2D) => {
      if (!showOverlaysRef.current) return;

      const metrics = engine.getMetrics();

      // FPS counter
      debugCtx.fillStyle = "#4ade80";
      debugCtx.font = "12px monospace";
      debugCtx.fillText(`FPS: ${Math.round(metrics.fps)}`, 8, 16);

      // Biome label
      debugCtx.fillStyle = "#86efac";
      debugCtx.fillText("Herbarium Folio", 8, 32);

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

      // Vine diagnostics (bottom-left)
      const diagX = 8;
      const diagY = CANVAS_HEIGHT - 130;
      debugCtx.fillStyle = "rgba(0, 0, 0, 0.6)";
      debugCtx.fillRect(diagX - 4, diagY - 14, 280, 140);

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

      // Vine info
      debugCtx.fillStyle = "#4ade80";
      debugCtx.fillText(
        `Swinging: ${vineSystem.isSwinging ? "YES" : "NO"}`,
        diagX,
        diagY + 60,
      );
      debugCtx.fillText(
        `Active Vine: ${vineSystem.activeVine?.id ?? "none"}`,
        diagX,
        diagY + 74,
      );
      if (vineSystem.isSwinging) {
        const angleDeg = ((vineSystem.angle * 180) / Math.PI).toFixed(1);
        debugCtx.fillText(`Angle: ${angleDeg}°`, diagX, diagY + 88);
        debugCtx.fillText(
          `ω: ${vineSystem.angularVelocity.toFixed(2)} rad/s`,
          diagX,
          diagY + 102,
        );
        debugCtx.fillText(
          `Rope: ${Math.round(vineSystem.currentRopeLength)}px`,
          diagX,
          diagY + 116,
        );
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
    vineSystemRef.current = null;
  }, []);

  const toggleOverlays = useCallback(() => {
    setShowOverlays((prev) => {
      const next = !prev;
      const engine = engineRef.current as EngineRefs | null;
      if (engine?.__showOverlaysRef) engine.__showOverlaysRef.current = next;
      return next;
    });
  }, []);

  const toggleVineRanges = useCallback(() => {
    setShowVineRanges((prev) => {
      const next = !prev;
      const engine = engineRef.current;
      if (engine) {
        (engine as EngineRefs & { __showVineRangesRef?: { current: boolean } }).__showVineRangesRef!.current = next;
      }
      return next;
    });
  }, []);

  const toggleSwingArc = useCallback(() => {
    setShowSwingArc((prev) => {
      const next = !prev;
      const engine = engineRef.current;
      if (engine) {
        (engine as EngineRefs & { __showSwingArcRef?: { current: boolean } }).__showSwingArcRef!.current = next;
      }
      return next;
    });
  }, []);

  const toggleAmbientParticles = useCallback(() => {
    setShowAmbientParticles((prev) => {
      const next = !prev;
      const engine = engineRef.current;
      if (engine) {
        (engine as EngineRefs & { __showAmbientParticlesRef?: { current: boolean } }).__showAmbientParticlesRef!.current = next;
      }
      return next;
    });
  }, []);

  const toggleParallaxBg = useCallback(() => {
    setShowParallaxBg((prev) => {
      const next = !prev;
      const engine = engineRef.current;
      if (engine) {
        (engine as EngineRefs & { __showParallaxBgRef?: { current: boolean } }).__showParallaxBgRef!.current = next;
      }
      return next;
    });
  }, []);

  const toggleBiomeColors = useCallback(() => {
    setUseBiomeColors((prev) => {
      const next = !prev;
      const engine = engineRef.current;
      if (engine) {
        (engine as EngineRefs & { __useBiomeColorsRef?: { current: boolean } }).__useBiomeColorsRef!.current = next;
      }
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
        <h1 className="font-mono text-sm font-bold text-green-500">
          Herbarium Folio
        </h1>
        <span className="rounded bg-green-500/20 px-2 py-0.5 text-xs font-mono text-green-400">
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
            Normal movement on biome platforms &middot; Vine anchors visible
            &middot; E attaches to vine &middot; Pendulum physics smooth
            &middot; Momentum transfer on attach &middot; L/R pumps swing
            &middot; U/D adjusts rope &middot; Jump detaches with momentum
            &middot; Release boost &middot; Vine-to-vine chaining
            &middot; Rope renders &middot; Parallax background
            &middot; Ambient particles &middot; Biome-themed colors
            &middot; Goal A (ground) &middot; Goal B (elevated via vines)
            &middot; Sliders tune all params &middot; Camera follows through level
          </div>

          {/* Controls legend */}
          <div className="w-[960px] text-xs font-mono text-zinc-600 leading-relaxed">
            <span className="text-zinc-500">Controls: </span>
            Arrows = Move &middot; Z/Space = Jump &middot; X/Shift = Dash
            &middot; E = Attach/detach vine &middot; Up/Down = Adjust rope (while swinging)
          </div>
        </div>

        {/* Debug panel */}
        <DebugPanel title="Herbarium Folio">
          <RenderModeToggle />
          {/* Biome Info (always visible) */}
          <div className="border-b border-zinc-800 pb-2 mb-2">
            <div className="text-xs font-mono text-green-400 uppercase tracking-wider mb-1">
              Biome Info
            </div>
            <div className="text-xs font-mono text-zinc-400 space-y-0.5">
              <div>
                Biome: <span className="text-zinc-200">Herbarium Folio</span>
              </div>
              <div>
                Swinging:{" "}
                <span className="text-zinc-200">
                  {vineSystemRef.current?.isSwinging ? "YES" : "NO"}
                </span>
              </div>
              <div>
                Active Vine:{" "}
                <span className="text-zinc-200">
                  {vineSystemRef.current?.activeVine?.id ?? "none"}
                </span>
              </div>
            </div>
          </div>

          {/* Vine Physics */}
          <details open>
            <summary className="text-xs font-mono text-green-400 uppercase tracking-wider cursor-pointer select-none">
              Vine Physics
            </summary>
            <div className="flex flex-col gap-4 pt-2">
              <Slider
                label="Attach Range"
                value={vineParams.attachRange}
                min={30}
                max={150}
                step={5}
                onChange={(v) => updateVineParam("attachRange", v)}
              />
              <Slider
                label="Swing Gravity"
                value={vineParams.swingGravity}
                min={400}
                max={1200}
                step={25}
                onChange={(v) => updateVineParam("swingGravity", v)}
              />
              <Slider
                label="Angular Damping"
                value={vineParams.angularDamping}
                min={0.0}
                max={0.05}
                step={0.001}
                onChange={(v) => updateVineParam("angularDamping", v)}
              />
              <Slider
                label="Release Boost"
                value={vineParams.releaseBoost}
                min={1.0}
                max={2.0}
                step={0.05}
                onChange={(v) => updateVineParam("releaseBoost", v)}
              />
              <Slider
                label="Rope Adjust Speed"
                value={vineParams.ropeLengthAdjustSpeed}
                min={50}
                max={400}
                step={25}
                onChange={(v) => updateVineParam("ropeLengthAdjustSpeed", v)}
              />
              <Slider
                label="Min Rope Length"
                value={vineParams.minRopeLength}
                min={20}
                max={100}
                step={5}
                onChange={(v) => updateVineParam("minRopeLength", v)}
              />
              <Slider
                label="Max Rope Length"
                value={vineParams.maxRopeLength}
                min={100}
                max={400}
                step={10}
                onChange={(v) => updateVineParam("maxRopeLength", v)}
              />
              <Slider
                label="Momentum Transfer"
                value={vineParams.attachMomentumTransfer}
                min={0.0}
                max={1.0}
                step={0.05}
                onChange={(v) => updateVineParam("attachMomentumTransfer", v)}
              />
              <Slider
                label="Max Angular Vel"
                value={vineParams.maxAngularVelocity}
                min={2.0}
                max={15.0}
                step={0.5}
                onChange={(v) => updateVineParam("maxAngularVelocity", v)}
              />
              <Slider
                label="Pump Force"
                value={vineParams.pumpForce}
                min={2.0}
                max={30.0}
                step={1.0}
                onChange={(v) => updateVineParam("pumpForce", v)}
              />
            </div>
          </details>

          {/* Vine Toggles */}
          <details>
            <summary className="text-xs font-mono text-zinc-500 uppercase tracking-wider cursor-pointer select-none pt-2">
              Vine Toggles
            </summary>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() =>
                  updateVineParam("jumpDetaches", !vineParams.jumpDetaches)
                }
                className={`rounded px-3 py-1 text-xs font-mono transition-colors ${
                  vineParams.jumpDetaches
                    ? "bg-green-500/20 text-green-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Jump Detaches: {vineParams.jumpDetaches ? "ON" : "OFF"}
              </button>
              <button
                onClick={() =>
                  updateVineParam("canAdjustLength", !vineParams.canAdjustLength)
                }
                className={`rounded px-3 py-1 text-xs font-mono transition-colors ${
                  vineParams.canAdjustLength
                    ? "bg-green-500/20 text-green-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Adjust Length: {vineParams.canAdjustLength ? "ON" : "OFF"}
              </button>
              <button
                onClick={() =>
                  updateVineParam("canPumpSwing", !vineParams.canPumpSwing)
                }
                className={`rounded px-3 py-1 text-xs font-mono transition-colors ${
                  vineParams.canPumpSwing
                    ? "bg-green-500/20 text-green-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Pump Swing: {vineParams.canPumpSwing ? "ON" : "OFF"}
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
                onClick={toggleAmbientParticles}
                className={`rounded px-3 py-1 text-xs font-mono transition-colors ${
                  showAmbientParticles
                    ? "bg-green-500/20 text-green-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Ambient Particles: {showAmbientParticles ? "ON" : "OFF"}
              </button>
              <button
                onClick={toggleParallaxBg}
                className={`rounded px-3 py-1 text-xs font-mono transition-colors ${
                  showParallaxBg
                    ? "bg-green-500/20 text-green-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Parallax Background: {showParallaxBg ? "ON" : "OFF"}
              </button>
              <button
                onClick={toggleBiomeColors}
                className={`rounded px-3 py-1 text-xs font-mono transition-colors ${
                  useBiomeColors
                    ? "bg-green-500/20 text-green-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Biome Colors: {useBiomeColors ? "ON" : "OFF"}
              </button>
              <button
                onClick={toggleVineRanges}
                className={`rounded px-3 py-1 text-xs font-mono transition-colors ${
                  showVineRanges
                    ? "bg-green-500/20 text-green-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Vine Ranges: {showVineRanges ? "ON" : "OFF"}
              </button>
              <button
                onClick={toggleSwingArc}
                className={`rounded px-3 py-1 text-xs font-mono transition-colors ${
                  showSwingArc
                    ? "bg-green-500/20 text-green-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Swing Arc: {showSwingArc ? "ON" : "OFF"}
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

          {/* Controls */}
          <details open>
            <summary className="text-xs font-mono text-green-500/80 uppercase tracking-wider cursor-pointer select-none pt-2">
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
                onClick={resetVines}
                className="w-full rounded bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Reset All Vines
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
                    player.position.x = 3450;
                    player.position.y = 940;
                    player.velocity.x = 0;
                    player.velocity.y = 0;
                    vineSystemRef.current?.reset();
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
                    player.position.x = 3550;
                    player.position.y = 310;
                    player.velocity.x = 0;
                    player.velocity.y = 0;
                    vineSystemRef.current?.reset();
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
                    ? "bg-green-500/20 text-green-400"
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
