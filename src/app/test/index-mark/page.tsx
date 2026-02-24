"use client";

import { useRef, useState, useCallback } from "react";
import { GameCanvas } from "@/components/canvas/GameCanvas";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { Slider } from "@/components/debug/Slider";
import { Engine } from "@/engine/core/Engine";
import { Player, DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";
import { TileMap } from "@/engine/physics/TileMap";
import type { Platform } from "@/engine/physics/TileMap";
import type { PlayerParams } from "@/engine/entities/Player";
import { ParticleSystem } from "@/engine/core/ParticleSystem";
import { ScreenShake } from "@/engine/core/ScreenShake";
import { InputAction } from "@/engine/input/InputManager";
import { IndexMark, DEFAULT_INDEX_MARK_PARAMS } from "@/engine/abilities/IndexMark";
import type { IndexMarkParams } from "@/engine/abilities/IndexMark";
import { COLORS, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/constants";
import type { Rect } from "@/lib/types";
import { aabbOverlap } from "@/engine/physics/AABB";
import Link from "next/link";

// ─── Constants ──────────────────────────────────────────────────────

const LEVEL_WIDTH = 3840;
const LEVEL_HEIGHT = 1080;
const SPAWN_X = 60;
const SPAWN_Y = 600;
const RESPAWN_Y_THRESHOLD = LEVEL_HEIGHT + 200;
const T = 32;

/** Camera distance threshold for instant snap vs smooth follow */
const TELEPORT_SNAP_DISTANCE = 400;
/** Camera follow speed during teleport smooth transition */
const TELEPORT_CAMERA_SPEED = 24;
/** Normal camera follow speed */
const NORMAL_CAMERA_SPEED = 8;

/** Multi-mark puzzle time limit (seconds) */
const PUZZLE_TIME_LIMIT = 15;

// ─── Goal Zone ──────────────────────────────────────────────────────

interface GoalZone {
  id: string;
  rect: Rect;
  color: string;
  activeColor: string;
  activated: boolean;
  activatedAt: number;
  label: string;
}

function createGoalZones(): GoalZone[] {
  return [
    {
      id: "goal-a",
      rect: { x: 650, y: 280, width: 60, height: 20 },
      color: "rgba(245, 158, 11, 0.2)",
      activeColor: "rgba(245, 158, 11, 0.7)",
      activated: false,
      activatedAt: 0,
      label: "Goal A",
    },
    {
      id: "goal-b",
      rect: { x: 1800, y: 540, width: 60, height: 20 },
      color: "rgba(59, 130, 246, 0.2)",
      activeColor: "rgba(59, 130, 246, 0.7)",
      activated: false,
      activatedAt: 0,
      label: "Goal B",
    },
    {
      id: "goal-c",
      rect: { x: 2300, y: 120, width: 80, height: 20 },
      color: "rgba(16, 185, 129, 0.2)",
      activeColor: "rgba(16, 185, 129, 0.7)",
      activated: false,
      activatedAt: 0,
      label: "Goal C",
    },
    // Multi-mark puzzle — 4 chamber zones
    {
      id: "goal-d1",
      rect: { x: 2960, y: 750, width: 50, height: 20 },
      color: "rgba(239, 68, 68, 0.2)",
      activeColor: "rgba(239, 68, 68, 0.7)",
      activated: false,
      activatedAt: 0,
      label: "D1",
    },
    {
      id: "goal-d2",
      rect: { x: 3160, y: 750, width: 50, height: 20 },
      color: "rgba(239, 68, 68, 0.2)",
      activeColor: "rgba(239, 68, 68, 0.7)",
      activated: false,
      activatedAt: 0,
      label: "D2",
    },
    {
      id: "goal-d3",
      rect: { x: 3360, y: 750, width: 50, height: 20 },
      color: "rgba(239, 68, 68, 0.2)",
      activeColor: "rgba(239, 68, 68, 0.7)",
      activated: false,
      activatedAt: 0,
      label: "D3",
    },
    {
      id: "goal-d4",
      rect: { x: 3560, y: 750, width: 50, height: 20 },
      color: "rgba(239, 68, 68, 0.2)",
      activeColor: "rgba(239, 68, 68, 0.7)",
      activated: false,
      activatedAt: 0,
      label: "D4",
    },
  ];
}

// ─── Level Construction ─────────────────────────────────────────────

function createTestLevel(): TileMap {
  const platforms: Platform[] = [];

  // Boundary walls
  platforms.push({ x: -T, y: -T, width: LEVEL_WIDTH + T * 2, height: T }); // Ceiling
  platforms.push({ x: -T, y: LEVEL_HEIGHT, width: LEVEL_WIDTH + T * 2, height: T }); // Bottom
  platforms.push({ x: -T, y: -T, width: T, height: LEVEL_HEIGHT + T * 2 }); // Left wall
  platforms.push({ x: LEVEL_WIDTH, y: -T, width: T, height: LEVEL_HEIGHT + T * 2 }); // Right wall

  // ─── Area 1: Starting Area (x: 0–960) ─────────────────────────
  // Ground floor
  platforms.push({ x: 0, y: 780, width: 960, height: T });

  // Tower staircase (left side) — ascending platforms
  platforms.push({ x: 80, y: 700, width: 80, height: T / 2 });
  platforms.push({ x: 200, y: 620, width: 80, height: T / 2 });
  platforms.push({ x: 120, y: 540, width: 80, height: T / 2 });
  platforms.push({ x: 220, y: 460, width: 80, height: T / 2 });
  platforms.push({ x: 140, y: 380, width: 80, height: T / 2 });
  platforms.push({ x: 240, y: 300, width: 80, height: T / 2 });

  // Goal A platform (isolated — only reachable by teleport from tower top)
  platforms.push({ x: 640, y: 300, width: 80, height: T / 2 });

  // ─── Area 2: Hazard Corridor (x: 960–1920) ────────────────────
  // Upper platforms with wide gaps
  platforms.push({ x: 960, y: 560, width: 80, height: T / 2 });
  platforms.push({ x: 1160, y: 560, width: 80, height: T / 2 });
  platforms.push({ x: 1360, y: 560, width: 80, height: T / 2 });
  platforms.push({ x: 1560, y: 560, width: 80, height: T / 2 });
  platforms.push({ x: 1760, y: 560, width: 80, height: T / 2 });

  // Lower ground
  platforms.push({ x: 960, y: 780, width: 400, height: T });
  // Pit gap: 1360 to 1560 (200px)
  platforms.push({ x: 1560, y: 780, width: 360, height: T });

  // Connecting floor from area 1 to area 2
  // (small step-down ramp or just continuous floor)

  // ─── Area 3: Vertical Shaft (x: 1920–2880) ────────────────────
  // Left wall of shaft
  platforms.push({ x: 1920, y: 100, width: T, height: 680 });
  // Right wall of shaft
  platforms.push({ x: 2640, y: 100, width: T, height: 680 });

  // Zigzag platforms inside shaft
  platforms.push({ x: 1980, y: 700, width: 120, height: T / 2 });
  platforms.push({ x: 2400, y: 620, width: 120, height: T / 2 });
  platforms.push({ x: 1980, y: 540, width: 120, height: T / 2 });
  platforms.push({ x: 2400, y: 460, width: 120, height: T / 2 });
  platforms.push({ x: 1980, y: 380, width: 120, height: T / 2 });
  platforms.push({ x: 2400, y: 300, width: 120, height: T / 2 });
  platforms.push({ x: 1980, y: 220, width: 120, height: T / 2 });

  // Goal C platform at the top of the shaft
  platforms.push({ x: 2200, y: 140, width: 200, height: T / 2 });

  // Shaft entrance floor (connects to area 2 and area 4)
  platforms.push({ x: 1920, y: 780, width: 960, height: T });

  // ─── Area 4: Multi-Mark Puzzle (x: 2880–3840) ─────────────────
  // Ground floor for area 4
  platforms.push({ x: 2880, y: 780, width: 960, height: T });

  // Four isolated chambers separated by tall walls
  // Wall between chamber 1 and 2
  platforms.push({ x: 3080, y: 500, width: T / 2, height: 280 });
  // Ceiling above chamber 1 (blocks wall-jump escape)
  platforms.push({ x: 2920, y: 500, width: 160, height: T / 2 });

  // Wall between chamber 2 and 3
  platforms.push({ x: 3280, y: 500, width: T / 2, height: 280 });
  // Ceiling above chamber 2
  platforms.push({ x: 3096, y: 500, width: 184, height: T / 2 });

  // Wall between chamber 3 and 4
  platforms.push({ x: 3480, y: 500, width: T / 2, height: 280 });
  // Ceiling above chamber 3
  platforms.push({ x: 3296, y: 500, width: 184, height: T / 2 });

  // Ceiling above chamber 4
  platforms.push({ x: 3496, y: 500, width: 184, height: T / 2 });

  // Small platforms inside each chamber for standing
  platforms.push({ x: 2940, y: 720, width: 100, height: T / 2 });
  platforms.push({ x: 3140, y: 720, width: 100, height: T / 2 });
  platforms.push({ x: 3340, y: 720, width: 100, height: T / 2 });
  platforms.push({ x: 3540, y: 720, width: 100, height: T / 2 });

  return new TileMap(platforms);
}

// ─── Pass Criteria Tracking ─────────────────────────────────────────

interface PassCriteria {
  markPlacedOnPress: boolean;
  markVisualRendered: boolean;
  holdEntersSelection: boolean;
  cycleChangesSelection: boolean;
  releaseTriggersteleport: boolean;
  positionMatchesMark: boolean;
  velocityZeroed: boolean;
  cameraHandlesTeleport: boolean;
  iFramesAfterTeleport: boolean;
  cooldownPreventsReteleport: boolean;
  placeFromAnyState: boolean;
  teleportFromAnyState: boolean;
  maxMarksReplaces: boolean;
  hudShowsMarks: boolean;
  goalAReached: boolean;
  goalDPuzzleComplete: boolean;
}

// ─── Engine Ref Extension ───────────────────────────────────────────

interface EngineRefs extends Engine {
  __showOverlaysRef?: { current: boolean };
}

// ─── Test Page Component ────────────────────────────────────────────

export default function IndexMarkTest() {
  const engineRef = useRef<Engine | null>(null);
  const playerRef = useRef<Player | null>(null);
  const indexMarkRef = useRef<IndexMark | null>(null);
  const criteriaRef = useRef<PassCriteria>({
    markPlacedOnPress: false,
    markVisualRendered: false,
    holdEntersSelection: false,
    cycleChangesSelection: false,
    releaseTriggersteleport: false,
    positionMatchesMark: false,
    velocityZeroed: false,
    cameraHandlesTeleport: false,
    iFramesAfterTeleport: false,
    cooldownPreventsReteleport: false,
    placeFromAnyState: false,
    teleportFromAnyState: false,
    maxMarksReplaces: false,
    hudShowsMarks: false,
    goalAReached: false,
    goalDPuzzleComplete: false,
  });
  const placementStatesRef = useRef(new Set<string>());
  const teleportStatesRef = useRef(new Set<string>());
  const goalZonesRef = useRef<GoalZone[]>(createGoalZones());
  const puzzleTimerRef = useRef<number>(0);
  const puzzleStartedRef = useRef<boolean>(false);

  const [showOverlays, setShowOverlays] = useState(true);
  const [params, setParams] = useState<PlayerParams>({ ...DEFAULT_PLAYER_PARAMS });
  const [indexMarkParams, setIndexMarkParams] = useState<IndexMarkParams>({
    ...DEFAULT_INDEX_MARK_PARAMS,
  });

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

  const updateIndexMarkParam = useCallback(
    <K extends keyof IndexMarkParams>(key: K, value: IndexMarkParams[K]) => {
      setIndexMarkParams((prev) => {
        const next = { ...prev, [key]: value };
        const im = indexMarkRef.current;
        if (im) {
          im.params[key] = value;
        }
        return next;
      });
    },
    [],
  );

  const resetParams = useCallback(() => {
    setParams({ ...DEFAULT_PLAYER_PARAMS });
    setIndexMarkParams({ ...DEFAULT_INDEX_MARK_PARAMS });
    const player = playerRef.current;
    if (player) {
      Object.assign(player.params, DEFAULT_PLAYER_PARAMS);
      player.size.x = DEFAULT_PLAYER_PARAMS.playerWidth;
    }
    const im = indexMarkRef.current;
    if (im) {
      Object.assign(im.params, DEFAULT_INDEX_MARK_PARAMS);
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

  const clearMarks = useCallback(() => {
    const im = indexMarkRef.current;
    if (im) {
      im.clearAllMarks();
    }
  }, []);

  const resetGoals = useCallback(() => {
    goalZonesRef.current = createGoalZones();
    puzzleTimerRef.current = 0;
    puzzleStartedRef.current = false;
  }, []);

  // ─── Engine Mount ───────────────────────────────────────────────

  const handleMount = useCallback((ctx: CanvasRenderingContext2D) => {
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

    // Index Mark system
    const indexMark = new IndexMark();
    indexMark.particleSystem = particleSystem;

    engineRef.current = engine;
    playerRef.current = player;
    indexMarkRef.current = indexMark;

    // Overlay ref
    const showOverlaysRef = { current: true };
    (engine as EngineRefs).__showOverlaysRef = showOverlaysRef;

    const criteria = criteriaRef.current;

    // Camera speed override for teleport transitions
    let cameraSpeedOverride = 0;
    let cameraSpeedOverrideTimer = 0;

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

      // Camera speed override timer
      if (cameraSpeedOverrideTimer > 0) {
        cameraSpeedOverrideTimer -= dt;
        camera.followSpeed = cameraSpeedOverride;
        if (cameraSpeedOverrideTimer <= 0) {
          camera.followSpeed = NORMAL_CAMERA_SPEED;
        }
      }

      // Camera follow
      const playerCenter = {
        x: player.position.x + player.size.x / 2,
        y: player.position.y + player.size.y / 2,
      };
      camera.follow(playerCenter, player.velocity, dt);

      // ─── Index Mark Input Handling ─────────────────────────

      const currentState = player.stateMachine.getCurrentState();

      if (input.isPressed(InputAction.Ability3)) {
        indexMark.onKeyDown();
      }

      if (input.isHeld(InputAction.Ability3)) {
        const prevIdx = indexMark.teleportState.selectedIndex;
        indexMark.onKeyHeld(input);

        // Criterion: hold enters selection
        if (indexMark.teleportState.selecting) {
          criteria.holdEntersSelection = true;
        }

        // Criterion: cycle changes selection
        if (
          indexMark.teleportState.selecting &&
          indexMark.teleportState.selectedIndex !== prevIdx
        ) {
          criteria.cycleChangesSelection = true;
        }
      }

      if (input.isReleased(InputAction.Ability3)) {
        const prevMarkCount = indexMark.marks.length;
        const result = indexMark.onKeyUp(
          player.position,
          player.grounded,
        );

        if (result.action === "place") {
          // Criterion: mark placed
          criteria.markPlacedOnPress = true;
          criteria.markVisualRendered = true;

          // Track placement state
          placementStatesRef.current.add(currentState);
          if (placementStatesRef.current.size >= 2) {
            criteria.placeFromAnyState = true;
          }

          // Criterion: max marks replaces oldest
          if (
            prevMarkCount >= indexMark.params.maxMarks &&
            indexMark.marks.length === indexMark.params.maxMarks
          ) {
            criteria.maxMarksReplaces = true;
          }
        } else if (
          result.action === "teleport" &&
          result.targetPosition
        ) {
          const origin = {
            x: player.position.x,
            y: player.position.y,
          };

          // Move player
          player.position.x = result.targetPosition.x;
          player.position.y = result.targetPosition.y;
          player.velocity.x = 0;
          player.velocity.y = 0;

          // Set teleport origin for visual
          indexMark.setTeleportOrigin(origin);

          // Camera handling
          const dx = result.targetPosition.x - origin.x;
          const dy = result.targetPosition.y - origin.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > TELEPORT_SNAP_DISTANCE) {
            // Long distance — snap camera
            camera.snapTo({
              x: player.position.x + player.size.x / 2,
              y: player.position.y + player.size.y / 2,
            });
            criteria.cameraHandlesTeleport = true;
          } else {
            // Short distance — fast lerp
            cameraSpeedOverride = TELEPORT_CAMERA_SPEED;
            cameraSpeedOverrideTimer =
              indexMark.params.teleportVisualDuration;
            criteria.cameraHandlesTeleport = true;
          }

          // Criteria
          criteria.releaseTriggersteleport = true;

          // Check position match
          const selIdx = Math.min(
            indexMark.teleportState.selectedIndex,
            indexMark.marks.length - 1,
          );
          if (selIdx >= 0 && selIdx < indexMark.marks.length) {
            const mark = indexMark.marks[selIdx];
            const posMatch =
              Math.abs(player.position.x - mark.position.x) < 2 &&
              Math.abs(player.position.y - mark.position.y) < 2;
            if (posMatch) criteria.positionMatchesMark = true;
          }

          if (
            player.velocity.x === 0 &&
            player.velocity.y === 0
          ) {
            criteria.velocityZeroed = true;
          }

          if (indexMark.iFramesRemaining > 0) {
            criteria.iFramesAfterTeleport = true;
          }

          // Track teleport state
          teleportStatesRef.current.add(currentState);
          if (teleportStatesRef.current.size >= 2) {
            criteria.teleportFromAnyState = true;
          }
        } else if (result.action === "cancel") {
          // Check if cooldown prevented teleport
          if (indexMark.cooldownTimer > 0) {
            criteria.cooldownPreventsReteleport = true;
          }
        }
      }

      // HUD criterion
      if (indexMark.marks.length > 0) {
        criteria.hudShowsMarks = true;
      }

      // Update index mark
      indexMark.update(dt);

      // Update particles
      particleSystem.update(dt);

      // Update screen shake
      const shakeOffset = screenShake.update();
      camera.position.x += shakeOffset.offsetX;
      camera.position.y += shakeOffset.offsetY;

      // ─── Goal Zone Checks ──────────────────────────────────

      const playerBounds: Rect = {
        x: player.position.x,
        y: player.position.y,
        width: player.size.x,
        height: player.size.y,
      };

      const now = performance.now() / 1000;

      for (const zone of goalZonesRef.current) {
        if (!zone.activated && aabbOverlap(playerBounds, zone.rect)) {
          zone.activated = true;
          zone.activatedAt = now;

          if (zone.id === "goal-a") {
            criteria.goalAReached = true;
          }

          // Start puzzle timer on first D zone activation
          if (zone.id.startsWith("goal-d") && !puzzleStartedRef.current) {
            puzzleStartedRef.current = true;
            puzzleTimerRef.current = 0;
          }
        }
      }

      // Update puzzle timer
      if (puzzleStartedRef.current) {
        puzzleTimerRef.current += dt;

        // Check if all D zones activated within time limit
        const dZones = goalZonesRef.current.filter((z) =>
          z.id.startsWith("goal-d"),
        );
        const allDActivated = dZones.every((z) => z.activated);
        if (
          allDActivated &&
          puzzleTimerRef.current <= PUZZLE_TIME_LIMIT
        ) {
          criteria.goalDPuzzleComplete = true;
        }
      }
    });

    // ─── World-Space Render Callback ─────────────────────────────

    engine.onRender((renderer, interpolation) => {
      // Draw tilemap
      tileMap.render(renderer);

      const rCtx = renderer.getContext();

      // Draw goal zones
      for (const zone of goalZonesRef.current) {
        rCtx.save();
        rCtx.fillStyle = zone.activated ? zone.activeColor : zone.color;
        rCtx.fillRect(zone.rect.x, zone.rect.y, zone.rect.width, zone.rect.height);

        // Label
        rCtx.fillStyle = zone.activated
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

        if (zone.activated) {
          // Glow effect
          rCtx.strokeStyle = zone.activeColor;
          rCtx.lineWidth = 2;
          rCtx.strokeRect(
            zone.rect.x - 2,
            zone.rect.y - 2,
            zone.rect.width + 4,
            zone.rect.height + 4,
          );
        }
        rCtx.restore();
      }

      // Render index mark world-space visuals (marks, trails)
      indexMark.render(rCtx);

      // Render selection beam (needs player position)
      if (
        indexMark.teleportState.selecting &&
        indexMark.marks.length > 0
      ) {
        const selIdx = Math.min(
          indexMark.teleportState.selectedIndex,
          indexMark.marks.length - 1,
        );
        const mark = indexMark.marks[selIdx];
        if (mark) {
          const markColors = ["#f59e0b", "#3b82f6", "#10b981", "#ef4444"];
          const beamColor = markColors[mark.colorIndex];

          rCtx.save();
          rCtx.globalAlpha = 0.4;
          rCtx.strokeStyle = beamColor;
          rCtx.lineWidth = 2;
          rCtx.setLineDash([8, 6]);
          rCtx.beginPath();
          rCtx.moveTo(
            player.position.x + player.size.x / 2,
            player.position.y + player.size.y / 2,
          );
          rCtx.lineTo(mark.position.x + 4, mark.position.y - 8);
          rCtx.stroke();
          rCtx.setLineDash([]);
          rCtx.restore();
        }
      }

      // Render particles (world space)
      particleSystem.render(renderer);

      if (!showOverlaysRef.current) return;

      const pos = player.getInterpolatedPosition(interpolation);
      const state = player.stateMachine.getCurrentState();

      // Player hitbox
      const hitboxColor =
        indexMark.iFramesRemaining > 0
          ? indexMark.iFramesRemaining % 4 < 2
            ? "#f59e0b"
            : "transparent"
          : COLORS.debug.hitbox;
      if (hitboxColor !== "transparent") {
        renderer.strokeRect(
          pos.x,
          pos.y,
          player.size.x,
          player.size.y,
          hitboxColor,
          1,
        );
      }

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

      // Area labels
      rCtx.save();
      rCtx.globalAlpha = 0.15;
      rCtx.fillStyle = "#ffffff";
      rCtx.font = "bold 24px monospace";
      rCtx.fillText("AREA 1: Starting", 60, 100);
      rCtx.fillText("AREA 2: Hazard Corridor", 1000, 100);
      rCtx.fillText("AREA 3: Vertical Shaft", 2000, 860);
      rCtx.fillText("AREA 4: Multi-Mark Puzzle", 2920, 480);
      rCtx.restore();

      // Puzzle timer overlay (in area 4)
      if (puzzleStartedRef.current) {
        rCtx.save();
        const timerX = 3200;
        const timerY = 470;
        const remaining = Math.max(0, PUZZLE_TIME_LIMIT - puzzleTimerRef.current);
        const isExpired = puzzleTimerRef.current > PUZZLE_TIME_LIMIT;
        rCtx.fillStyle = isExpired ? "rgba(239, 68, 68, 0.8)" : "rgba(245, 158, 11, 0.8)";
        rCtx.font = "bold 16px monospace";
        rCtx.textAlign = "center";
        rCtx.fillText(
          `TIMER: ${remaining.toFixed(1)}s`,
          timerX,
          timerY,
        );
        rCtx.textAlign = "left";
        rCtx.restore();
      }
    });

    // ─── Screen-Space Debug Layer ──────────────────────────────

    const debugLayerCallback = (debugCtx: CanvasRenderingContext2D) => {
      if (!showOverlaysRef.current) return;

      const metrics = engine.getMetrics();

      // FPS counter
      debugCtx.fillStyle = COLORS.debug.ground;
      debugCtx.font = "12px monospace";
      debugCtx.fillText(`FPS: ${Math.round(metrics.fps)}`, 8, 16);

      // Velocity readout
      debugCtx.fillStyle = COLORS.debug.velocity;
      debugCtx.textAlign = "right";
      debugCtx.fillText(
        `VelX: ${Math.round(player.velocity.x)} px/s`,
        CANVAS_WIDTH - 8,
        50,
      );
      debugCtx.fillText(
        `VelY: ${Math.round(player.velocity.y)} px/s`,
        CANVAS_WIDTH - 8,
        66,
      );
      debugCtx.textAlign = "left";

      // Index Mark diagnostics (bottom-left)
      const diagX = 8;
      const diagY = CANVAS_HEIGHT - 140;
      debugCtx.fillStyle = "rgba(0, 0, 0, 0.6)";
      debugCtx.fillRect(diagX - 4, diagY - 14, 320, 150);

      debugCtx.fillStyle = "#a78bfa";
      debugCtx.font = "11px monospace";
      debugCtx.fillText(
        `State: ${player.stateMachine.getCurrentState()}`,
        diagX,
        diagY,
      );
      debugCtx.fillText(
        `Grounded: ${player.grounded ? "YES" : "NO"}`,
        diagX,
        diagY + 14,
      );
      debugCtx.fillText(
        `Pos: (${Math.round(player.position.x)}, ${Math.round(player.position.y)})`,
        diagX,
        diagY + 28,
      );

      // Index Mark info
      debugCtx.fillStyle = "#f59e0b";
      const abilityState = indexMark.teleportState.selecting
        ? "SELECTING"
        : indexMark.teleportState.visualActive
          ? "VISUAL"
          : indexMark.cooldownTimer > 0
            ? "COOLDOWN"
            : "READY";
      debugCtx.fillText(
        `Index Mark: ${abilityState}`,
        diagX,
        diagY + 48,
      );
      debugCtx.fillText(
        `Marks: ${indexMark.marks.length}/${indexMark.params.maxMarks}`,
        diagX,
        diagY + 62,
      );
      debugCtx.fillText(
        `Cooldown: ${indexMark.cooldownTimer > 0 ? indexMark.cooldownTimer.toFixed(1) + "s" : "--"}`,
        diagX,
        diagY + 76,
      );
      debugCtx.fillText(
        `I-Frames: ${indexMark.iFramesRemaining > 0 ? indexMark.iFramesRemaining : "--"}`,
        diagX,
        diagY + 90,
      );

      if (indexMark.teleportState.selecting) {
        const selIdx = Math.min(
          indexMark.teleportState.selectedIndex,
          indexMark.marks.length - 1,
        );
        debugCtx.fillText(
          `Selected: Mark ${selIdx + 1}`,
          diagX,
          diagY + 104,
        );
      }

      // Goal status
      debugCtx.fillStyle = "#4ade80";
      const goalA = goalZonesRef.current.find((z) => z.id === "goal-a");
      const goalB = goalZonesRef.current.find((z) => z.id === "goal-b");
      const goalC = goalZonesRef.current.find((z) => z.id === "goal-c");
      const dZones = goalZonesRef.current.filter((z) =>
        z.id.startsWith("goal-d"),
      );
      const allD = dZones.every((z) => z.activated);
      debugCtx.fillText(
        `Goals: A ${goalA?.activated ? "✓" : "☐"} B ${goalB?.activated ? "✓" : "☐"} C ${goalC?.activated ? "✓" : "☐"} D ${allD ? "✓" : `${dZones.filter((z) => z.activated).length}/4`}`,
        diagX,
        diagY + 124,
      );

      // Index Mark HUD (top-right mark inventory + cooldown indicator)
      indexMark.renderUI(
        debugCtx,
        camera,
        {
          x: player.position.x + player.size.x / 2,
          y: player.position.y + player.size.y / 2,
        },
        CANVAS_WIDTH,
      );
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
    indexMarkRef.current = null;
  }, []);

  const toggleOverlays = useCallback(() => {
    setShowOverlays((prev) => {
      const next = !prev;
      const engine = engineRef.current as EngineRefs | null;
      if (engine?.__showOverlaysRef) engine.__showOverlaysRef.current = next;
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
        <h1 className="font-mono text-sm font-bold text-amber-500">
          Index Mark
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
          <div className="w-[960px] text-xs font-mono text-zinc-500 leading-relaxed">
            <span className="text-zinc-400">Pass criteria: </span>
            Short press R places mark &middot; Mark tab visible at position
            &middot; Hold R enters teleport selection &middot; Left/Right cycles
            marks &middot; Release teleports to selected mark &middot; Position
            matches mark &middot; Velocity zeroed on teleport &middot; Camera
            handles teleport (snap/smooth) &middot; I-frames after teleport
            &middot; Cooldown prevents re-teleport &middot; Place from any state
            &middot; Teleport from any state &middot; Max marks replaces oldest
            &middot; HUD shows marks &middot; Goal A reachable via teleport
            &middot; Goal D puzzle: 4 zones in 15s
          </div>

          {/* Controls legend */}
          <div className="w-[960px] text-xs font-mono text-zinc-600 leading-relaxed">
            <span className="text-zinc-500">Controls: </span>
            Arrows/WASD = Move &middot; Z/Space = Jump &middot; X/Shift = Dash
            &middot; R = Index Mark (tap = place, hold = teleport selection,
            release = teleport)
          </div>
        </div>

        {/* Debug panel */}
        <DebugPanel title="Index Mark">
          {/* Index Mark Info (always visible) */}
          <div className="border-b border-zinc-800 pb-2 mb-2">
            <div className="text-xs font-mono text-amber-400 uppercase tracking-wider mb-1">
              Index Mark Info
            </div>
            <div className="text-xs font-mono text-zinc-400 space-y-0.5">
              <div>
                Marks:{" "}
                <span className="text-zinc-200">
                  {indexMarkRef.current
                    ? `${indexMarkRef.current.marks.length}/${indexMarkRef.current.params.maxMarks}`
                    : "--"}
                </span>
              </div>
              <div>
                State:{" "}
                <span className="text-zinc-200">
                  {indexMarkRef.current
                    ? indexMarkRef.current.teleportState.selecting
                      ? "SELECTING"
                      : indexMarkRef.current.teleportState.visualActive
                        ? "VISUAL"
                        : indexMarkRef.current.cooldownTimer > 0
                          ? "COOLDOWN"
                          : "READY"
                    : "--"}
                </span>
              </div>
            </div>
          </div>

          {/* Index Mark Params */}
          <details open>
            <summary className="text-xs font-mono text-amber-400 uppercase tracking-wider cursor-pointer select-none">
              Index Mark Params
            </summary>
            <div className="flex flex-col gap-4 pt-2">
              <Slider
                label="Max Marks"
                value={indexMarkParams.maxMarks}
                min={1}
                max={8}
                step={1}
                onChange={(v) => updateIndexMarkParam("maxMarks", v)}
              />
              <Slider
                label="Hold Threshold"
                value={indexMarkParams.holdThreshold}
                min={4}
                max={30}
                step={1}
                onChange={(v) => updateIndexMarkParam("holdThreshold", v)}
              />
              <Slider
                label="Teleport Cooldown"
                value={indexMarkParams.teleportCooldown}
                min={0.0}
                max={5.0}
                step={0.25}
                onChange={(v) => updateIndexMarkParam("teleportCooldown", v)}
              />
              <Slider
                label="Visual Duration"
                value={indexMarkParams.teleportVisualDuration}
                min={0.1}
                max={1.0}
                step={0.05}
                onChange={(v) =>
                  updateIndexMarkParam("teleportVisualDuration", v)
                }
              />
              <Slider
                label="Teleport I-Frames"
                value={indexMarkParams.teleportIFrames}
                min={0}
                max={30}
                step={1}
                onChange={(v) => updateIndexMarkParam("teleportIFrames", v)}
              />
              <Slider
                label="Mark Lifetime"
                value={indexMarkParams.markLifetime}
                min={5.0}
                max={120.0}
                step={5.0}
                onChange={(v) => updateIndexMarkParam("markLifetime", v)}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    updateIndexMarkParam(
                      "marksExpire",
                      !indexMarkParams.marksExpire,
                    )
                  }
                  className={`rounded px-3 py-1 text-xs font-mono transition-colors ${
                    indexMarkParams.marksExpire
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-zinc-800 text-zinc-500"
                  }`}
                >
                  Marks Expire: {indexMarkParams.marksExpire ? "ON" : "OFF"}
                </button>
              </div>
            </div>
          </details>

          {/* Player State */}
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
            <summary className="text-xs font-mono text-amber-500/80 uppercase tracking-wider cursor-pointer select-none pt-2">
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
                onClick={clearMarks}
                className="w-full rounded bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Clear All Marks
              </button>
              <button
                onClick={resetGoals}
                className="w-full rounded bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Reset Goals
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
          </details>
        </DebugPanel>
      </div>
    </div>
  );
}
