"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { GameCanvas } from "@/components/canvas/GameCanvas";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { RenderModeToggle } from "@/components/debug/RenderModeToggle";
import { Slider } from "@/components/debug/Slider";
import { Engine } from "@/engine/core/Engine";
import { RenderConfig } from "@/engine/core/RenderConfig";
import { Player, DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";
import { TileMap } from "@/engine/physics/TileMap";
import type { PlayerParams } from "@/engine/entities/Player";
import type { Platform } from "@/engine/physics/TileMap";
import type { Renderer } from "@/engine/core/Renderer";
import { COLORS, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/constants";
import Link from "next/link";

// ─── Level Constants ─────────────────────────────────────────────────────────

const LEVEL_WIDTH = 3840;
const LEVEL_HEIGHT = 1080;

const SPAWN_X = 60;
const SPAWN_Y = 600;

const RESPAWN_Y_THRESHOLD = LEVEL_HEIGHT + 200;

const T = 32; // Tile size

// Section boundaries (x positions)
const SECTION_BOUNDS = [0, 640, 1280, 1920, 2560, 3200, 3840];

const SECTION_NAMES = [
  "Ground Flow",
  "Vertical Climb",
  "Wall Gauntlet",
  "Dash Challenges",
  "Combination Test",
  "Victory Run",
];

const FINISH_LINE_X = 3780;

// Max ghost recording length (10 minutes at 60 fps)
const MAX_GHOST_FRAMES = 36000;

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface Checkpoint {
  id: number;
  x: number;
  sectionName: string;
  reached: boolean;
  reachTime: number;
}

interface GhostFrame {
  x: number;
  y: number;
  sizeX: number;
  sizeY: number;
  state: string;
  frame: number;
}

interface RunState {
  running: boolean;
  startTime: number;
  endTime: number;
  finished: boolean;
  frameCount: number;
}

interface SplitData {
  current: number[];
  best: number[];
}

interface PassCriteria {
  label: string;
  auto: boolean;
  met: boolean;
}

// ─── Level Construction ──────────────────────────────────────────────────────

function createObstacleCourse(): TileMap {
  const platforms: Platform[] = [];

  // Boundary walls
  platforms.push({ x: -T, y: -T, width: LEVEL_WIDTH + T * 2, height: T }); // Ceiling
  platforms.push({ x: -T, y: LEVEL_HEIGHT, width: LEVEL_WIDTH + T * 2, height: T }); // Floor catchment
  platforms.push({ x: -T, y: -T, width: T, height: LEVEL_HEIGHT + T * 2 }); // Left wall
  platforms.push({ x: LEVEL_WIDTH, y: -T, width: T, height: LEVEL_HEIGHT + T * 2 }); // Right wall

  // ─── Section 1: Ground Flow (x: 0–640) ─────────────────────────────────
  // Main floor
  platforms.push({ x: 0, y: 700, width: 640, height: T });

  // Low ceiling gap for crouch-slide (ceiling + floor form a gap of crouchHeight + 4)
  // Player crouchHeight = 24, so gap = 28px
  const slideGapY = 672; // Ceiling at y=672, floor at y=700, gap = 28
  platforms.push({ x: 160, y: slideGapY, width: 140, height: T }); // Low ceiling block

  // Step-ups: 16px, 32px, 48px rises
  platforms.push({ x: 360, y: 684, width: 40, height: 16 }); // 16px step
  platforms.push({ x: 420, y: 668, width: 40, height: T }); // 32px step
  platforms.push({ x: 480, y: 652, width: 40, height: 48 }); // 48px step

  // ─── Section 2: Vertical Climb (x: 640–1280) ──────────────────────────
  // Entry floor from Section 1
  platforms.push({ x: 640, y: 700, width: 160, height: T });

  // Vertical shaft walls
  platforms.push({ x: 680, y: 280, width: T, height: 420 }); // Left wall of shaft
  platforms.push({ x: 920, y: 280, width: T, height: 420 }); // Right wall of shaft

  // Staggered platforms inside shaft
  platforms.push({ x: 720, y: 640, width: 80, height: T / 2 }); // Low platform
  platforms.push({ x: 850, y: 560, width: 80, height: T / 2 }); // Mid-right
  platforms.push({ x: 720, y: 480, width: 80, height: T / 2 }); // Mid-left
  platforms.push({ x: 850, y: 400, width: 80, height: T / 2 }); // Upper-right

  // Coyote ledge — extends past the edge of a platform
  // Player must run off the right edge and jump late (coyote time)
  platforms.push({ x: 720, y: 340, width: 60, height: T / 2 }); // Coyote launch platform
  // Target platform is ~50px to the right and 20px up — only reachable with coyote jump
  platforms.push({ x: 830, y: 310, width: 80, height: T / 2 }); // Coyote target

  // Top exit from shaft
  platforms.push({ x: 680, y: 280, width: 280, height: T / 2 }); // Top of shaft
  // Bridge to Section 3
  platforms.push({ x: 960, y: 280, width: 320, height: T / 2 });

  // ─── Section 3: Wall Gauntlet (x: 1280–1920) ──────────────────────────
  // Descending zigzag chimney with alternating walls

  // Wall pairs for wall-jump chain (spaced ~120px apart)
  const wallGauntletStartY = 280;
  const wallSpacing = 120;
  const wallHeight = 160;

  // Left walls
  platforms.push({ x: 1300, y: wallGauntletStartY, width: T, height: wallHeight });
  platforms.push({ x: 1300, y: wallGauntletStartY + wallSpacing * 2, width: T, height: wallHeight });
  platforms.push({ x: 1300, y: wallGauntletStartY + wallSpacing * 4, width: T, height: wallHeight });

  // Right walls
  platforms.push({ x: 1420 + wallSpacing - T, y: wallGauntletStartY + wallSpacing, width: T, height: wallHeight });
  platforms.push({ x: 1420 + wallSpacing - T, y: wallGauntletStartY + wallSpacing * 3, width: T, height: wallHeight });

  // Grip test wall — single tall wall where player must slow-slide then jump
  platforms.push({ x: 1600, y: 500, width: T, height: 200 });
  // Landing platform after grip test
  platforms.push({ x: 1660, y: 680, width: 100, height: T / 2 });

  // Horizontal run to section 4
  platforms.push({ x: 1760, y: 700, width: 160, height: T });

  // ─── Section 4: Dash Challenges (x: 1920–2560) ────────────────────────
  // Entry platform
  platforms.push({ x: 1920, y: 700, width: 100, height: T });

  // Dash gap: ~200px gap — requires jump + horizontal dash
  // Landing platform after gap
  platforms.push({ x: 2220, y: 700, width: 100, height: T });

  // High platform — reachable only with jump + upward dash
  platforms.push({ x: 2100, y: 540, width: 100, height: T / 2 });

  // Crouch-slide + dash tunnel
  const tunnelY = 676; // Ceiling height for crouchHeight gap
  platforms.push({ x: 2340, y: 700, width: 200, height: T }); // Floor
  platforms.push({ x: 2340, y: tunnelY, width: 80, height: T }); // Low ceiling left
  platforms.push({ x: 2460, y: tunnelY, width: 80, height: T }); // Low ceiling right
  // Gap in ceiling from x=2420 to x=2460 — must dash through

  // Three closely-spaced platforms for dash-boosted speed
  platforms.push({ x: 2360, y: 600, width: 60, height: T / 2 });
  platforms.push({ x: 2440, y: 580, width: 60, height: T / 2 });
  platforms.push({ x: 2520, y: 560, width: 60, height: T / 2 });

  // ─── Section 5: Combination Test (x: 2560–3200) ───────────────────────
  // Wall-dash-wall combo: wall, air-dash gap, wall
  platforms.push({ x: 2580, y: 400, width: T, height: 200 }); // First wall
  platforms.push({ x: 2780, y: 400, width: T, height: 200 }); // Second wall (200px gap)

  // Staircase of tiny platforms for short-hop precision
  for (let i = 0; i < 5; i++) {
    platforms.push({ x: 2830 + i * 50, y: 580 - i * 30, width: 36, height: T / 2 });
  }

  // Descending section — dash-cancel from wall-slide into gap
  platforms.push({ x: 3080, y: 400, width: T, height: 150 }); // Wall to slide down
  platforms.push({ x: 3080, y: 550, width: 100, height: T / 2 }); // Landing

  // Crouch-slide under low ceiling → wall-slide transition
  platforms.push({ x: 3100, y: 700, width: 100, height: T }); // Floor
  platforms.push({ x: 3100, y: 672, width: 60, height: T }); // Low ceiling
  platforms.push({ x: 3180, y: 500, width: T, height: 200 }); // Wall to slide

  // ─── Section 6: Victory Run (x: 3200–3840) ────────────────────────────
  // Easy ground path
  platforms.push({ x: 3200, y: 700, width: 640, height: T });

  // Upper wall-jump challenge path
  platforms.push({ x: 3260, y: 500, width: T, height: 180 }); // Left wall
  platforms.push({ x: 3400, y: 500, width: T, height: 180 }); // Right wall
  platforms.push({ x: 3420, y: 480, width: 120, height: T / 2 }); // High platform

  // Fastest dash-chain path (high up)
  platforms.push({ x: 3300, y: 360, width: 80, height: T / 2 });
  platforms.push({ x: 3460, y: 340, width: 80, height: T / 2 });
  platforms.push({ x: 3620, y: 320, width: 80, height: T / 2 });

  // Finish platform (slightly raised to be dramatic)
  platforms.push({ x: 3750, y: 660, width: 80, height: 40 });

  return new TileMap(platforms);
}

// ─── Default Checkpoints ─────────────────────────────────────────────────────

function createCheckpoints(): Checkpoint[] {
  return SECTION_NAMES.map((name, i) => ({
    id: i,
    x: SECTION_BOUNDS[i],
    sectionName: name,
    reached: i === 0, // First checkpoint is always reached
    reachTime: 0,
  }));
}

// ─── Timer Formatting ────────────────────────────────────────────────────────

function formatTime(ms: number): string {
  if (ms <= 0) return "--:--.---";
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const millis = Math.floor(ms % 1000);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

// ─── Engine Overlay Ref Extension ────────────────────────────────────────────

interface EngineWithRefs extends Engine {
  __showOverlaysRef?: { current: boolean };
  __showGhostRef?: { current: boolean };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MovementPlaygroundTest() {
  const engineRef = useRef<Engine | null>(null);
  const playerRef = useRef<Player | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Run state
  const runStateRef = useRef<RunState>({
    running: false,
    startTime: 0,
    endTime: 0,
    finished: false,
    frameCount: 0,
  });

  // Checkpoints
  const checkpointsRef = useRef<Checkpoint[]>(createCheckpoints());
  const lastCheckpointRef = useRef<{ x: number; y: number }>({ x: SPAWN_X, y: SPAWN_Y });

  // Ghost
  const ghostRecordingRef = useRef<GhostFrame[]>([]);
  const bestGhostRef = useRef<GhostFrame[]>([]);
  const [showGhost, setShowGhost] = useState(true);

  // Timer display
  const [timerDisplay, setTimerDisplay] = useState("--:--.---");
  const [bestTimeDisplay, setBestTimeDisplay] = useState("--:--.---");
  const [currentSection, setCurrentSection] = useState("Ground Flow");
  const [splitDelta, setSplitDelta] = useState("");

  // Splits
  const splitsRef = useRef<SplitData>({ current: Array(6).fill(0), best: Array(6).fill(0) });
  const [splitDisplay, setSplitDisplay] = useState<{ time: string; best: string; reached: boolean }[]>(
    Array(6).fill(null).map(() => ({ time: "--:--.---", best: "--:--.---", reached: false })),
  );

  // Best time tracking
  const bestTimeRef = useRef(0);

  // Pass criteria
  const [criteria, setCriteria] = useState<PassCriteria[]>([
    { label: "Complete the course", auto: true, met: false },
    { label: "Crouch-slide under gap", auto: true, met: false },
    { label: "Variable-height jump", auto: true, met: false },
    { label: "Coyote time jump", auto: true, met: false },
    { label: "Wall-jump chain (4+)", auto: true, met: false },
    { label: "Dash across gap", auto: true, met: false },
    { label: "Air dash to platform", auto: true, met: false },
    { label: "Wall-dash combo", auto: true, met: false },
    { label: "Squash-stretch visible", auto: false, met: false },
    { label: "Smooth transitions", auto: false, met: false },
  ]);
  const criteriaRef = useRef(criteria);

  // Overlay and params state
  const [showOverlays, setShowOverlays] = useState(true);
  const [params, setParams] = useState<PlayerParams>({ ...DEFAULT_PLAYER_PARAMS });
  const [cameraFollowSpeed, setCameraFollowSpeed] = useState(8.0);
  const [cameraLookaheadX, setCameraLookaheadX] = useState(80);
  const [cameraLookaheadY, setCameraLookaheadY] = useState(40);

  // Criteria tracking refs (for auto-detection within engine loop)
  const consecutiveWallJumpsRef = useRef(0);
  const prevPlayerStateRef = useRef("");
  const wasGroundedRef = useRef(false);
  const wallDashComboRef = useRef<string[]>([]);

  // Ref so the keydown handler inside handleMount can call resetRun
  const resetRunRef = useRef<(() => void) | null>(null);

  // ─── Param Update ──────────────────────────────────────────────────────

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

  const resetParams = useCallback(() => {
    setParams({ ...DEFAULT_PLAYER_PARAMS });
    const player = playerRef.current;
    if (player) {
      Object.assign(player.params, DEFAULT_PLAYER_PARAMS);
      player.size.x = DEFAULT_PLAYER_PARAMS.playerWidth;
    }
  }, []);

  // ─── Run Management ────────────────────────────────────────────────────

  const resetRun = useCallback(() => {
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
    runStateRef.current = { running: false, startTime: 0, endTime: 0, finished: false, frameCount: 0 };
    checkpointsRef.current = createCheckpoints();
    lastCheckpointRef.current = { x: SPAWN_X, y: SPAWN_Y };
    ghostRecordingRef.current = [];
    splitsRef.current.current = Array(6).fill(0);
    consecutiveWallJumpsRef.current = 0;
    prevPlayerStateRef.current = "";
    wasGroundedRef.current = false;
    wallDashComboRef.current = [];

    setTimerDisplay("--:--.---");
    setCurrentSection("Ground Flow");
    setSplitDelta("");
    setSplitDisplay(Array(6).fill(null).map(() => ({ time: "--:--.---", best: "--:--.---", reached: false })));

    // Snap camera
    const camera = engineRef.current?.getCamera();
    if (camera) {
      camera.snapTo({ x: SPAWN_X + 12, y: SPAWN_Y + 20 });
    }
  }, []);
  resetRunRef.current = resetRun;

  const respawnAtCheckpoint = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    const cp = lastCheckpointRef.current;
    player.position.x = cp.x + 20;
    player.position.y = cp.y;
    player.velocity.x = 0;
    player.velocity.y = 0;
    player.size.y = player.params.playerHeight;
    player.grounded = false;
    player.coyoteTimer = 0;
    player.jumpHeld = false;
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
    player.dashTrailPositions = [];
  }, []);

  // ─── Manual Criteria Toggle ────────────────────────────────────────────

  const toggleManualCriteria = useCallback((index: number) => {
    setCriteria((prev) => {
      const next = [...prev];
      if (!next[index].auto) {
        next[index] = { ...next[index], met: !next[index].met };
      }
      criteriaRef.current = next;
      return next;
    });
  }, []);

  // ─── Engine Mount ──────────────────────────────────────────────────────

  const handleMount = useCallback((ctx: CanvasRenderingContext2D) => {
    RenderConfig.setMode("rectangles");
    const engine = new Engine({ ctx });
    const camera = engine.getCamera();
    const tileMap = createObstacleCourse();
    const player = new Player();
    player.position.x = SPAWN_X;
    player.position.y = SPAWN_Y;
    player.input = engine.getInput();
    player.tileMap = tileMap;

    engine.getEntities().add(player);
    engineRef.current = engine;
    playerRef.current = player;

    // Camera setup
    camera.bounds = { x: 0, y: 0, width: LEVEL_WIDTH, height: LEVEL_HEIGHT };
    camera.followSpeed = 8.0;
    camera.lookaheadX = 80;
    camera.lookaheadY = 40;
    camera.snapTo({ x: SPAWN_X + 12, y: SPAWN_Y + 20 });

    // Refs for overlay/ghost toggle
    const showOverlaysRef = { current: true };
    const showGhostRef = { current: true };
    (engine as EngineWithRefs).__showOverlaysRef = showOverlaysRef;
    (engine as EngineWithRefs).__showGhostRef = showGhostRef;

    // Camera params ref — updated from React state via sliders
    const cameraParamsRef = { followSpeed: 8.0, lookaheadX: 80, lookaheadY: 40 };
    (engine as EngineWithRefs & { __cameraParamsRef?: typeof cameraParamsRef }).__cameraParamsRef = cameraParamsRef;

    // ─── Key handling for test page controls (R, T, G, D) ─────────────
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") {
        // Respawn at checkpoint
        const cp = lastCheckpointRef.current;
        player.position.x = cp.x + 20;
        player.position.y = cp.y;
        player.velocity.x = 0;
        player.velocity.y = 0;
        player.size.y = player.params.playerHeight;
        player.grounded = false;
        player.dashCooldownTimer = 0;
        player.dashAvailable = true;
        player.isDashing = false;
        player.isInDashWindup = false;
      }
      if (e.key === "t" || e.key === "T") {
        resetRunRef.current?.();
      }
      if (e.key === "g" || e.key === "G") {
        showGhostRef.current = !showGhostRef.current;
      }
      if (e.key === "d" || e.key === "D") {
        showOverlaysRef.current = !showOverlaysRef.current;
      }
    };
    window.addEventListener("keydown", onKeyDown);

    // ─── Update Loop ──────────────────────────────────────────────────
    let uiUpdateCounter = 0;

    engine.onUpdate((dt) => {
      const run = runStateRef.current;

      // Auto-respawn if fallen off level
      if (player.position.y > RESPAWN_Y_THRESHOLD) {
        const cp = lastCheckpointRef.current;
        player.position.x = cp.x + 20;
        player.position.y = cp.y;
        player.velocity.x = 0;
        player.velocity.y = 0;
        player.size.y = player.params.playerHeight;
        player.grounded = false;
        player.dashCooldownTimer = 0;
        player.dashAvailable = true;
        player.isDashing = false;
        player.isInDashWindup = false;
      }

      // Start timer on first movement
      if (!run.running && !run.finished) {
        if (Math.abs(player.velocity.x) > 5 || Math.abs(player.velocity.y) > 5) {
          run.running = true;
          run.startTime = performance.now();
          run.frameCount = 0;
        }
      }

      // Timer
      if (run.running) {
        run.frameCount++;
      }

      // Ghost recording
      if (run.running && !run.finished) {
        const recording = ghostRecordingRef.current;
        if (recording.length < MAX_GHOST_FRAMES) {
          recording.push({
            x: player.position.x,
            y: player.position.y,
            sizeX: player.size.x,
            sizeY: player.size.y,
            state: player.stateMachine.getCurrentState(),
            frame: run.frameCount,
          });
        }
      }

      // Checkpoint detection
      const checkpoints = checkpointsRef.current;
      const now = run.running ? performance.now() - run.startTime : 0;
      for (const cp of checkpoints) {
        if (!cp.reached && player.position.x >= cp.x) {
          cp.reached = true;
          cp.reachTime = now;
          lastCheckpointRef.current = { x: cp.x, y: player.position.y };

          // Compute split
          if (cp.id > 0) {
            const prevTime = checkpoints[cp.id - 1].reachTime;
            splitsRef.current.current[cp.id - 1] = cp.reachTime - prevTime;
          }
        }
      }

      // Finish line detection
      if (run.running && !run.finished && player.position.x >= FINISH_LINE_X) {
        run.finished = true;
        run.endTime = performance.now();
        run.running = false;
        const totalTime = run.endTime - run.startTime;

        // Compute last split
        const lastReached = checkpoints.filter((c) => c.reached);
        if (lastReached.length > 0) {
          const lastCp = lastReached[lastReached.length - 1];
          splitsRef.current.current[lastCp.id] = totalTime - lastCp.reachTime;
        }

        // Best time / ghost
        if (bestTimeRef.current === 0 || totalTime < bestTimeRef.current) {
          bestTimeRef.current = totalTime;
          setBestTimeDisplay(formatTime(totalTime));
          bestGhostRef.current = [...ghostRecordingRef.current];
          splitsRef.current.best = [...splitsRef.current.current];
        }

        // Auto-detect criteria 1: complete the course
        setCriteria((prev) => {
          const next = [...prev];
          next[0] = { ...next[0], met: true };
          criteriaRef.current = next;
          return next;
        });
      }

      // ─── Auto-detect criteria ──────────────────────────────────────
      const currentState = player.stateMachine.getCurrentState();
      const prevState = prevPlayerStateRef.current;

      // Criteria 2: Crouch-slide through Section 1 low ceiling
      if (
        currentState === "CROUCH_SLIDING" &&
        player.position.x > 160 &&
        player.position.x < 300
      ) {
        if (!criteriaRef.current[1].met) {
          setCriteria((prev) => {
            const next = [...prev];
            next[1] = { ...next[1], met: true };
            criteriaRef.current = next;
            return next;
          });
        }
      }

      // Criteria 3: Variable-height jump — land on precision platform
      // The precision platforms are the staggered ones in section 2
      if (
        player.grounded &&
        player.position.x >= 720 &&
        player.position.x <= 800 &&
        player.position.y < 640 &&
        player.position.y > 460
      ) {
        if (!criteriaRef.current[2].met) {
          setCriteria((prev) => {
            const next = [...prev];
            next[2] = { ...next[2], met: true };
            criteriaRef.current = next;
            return next;
          });
        }
      }

      // Criteria 4: Coyote time — player crosses the coyote gap
      if (
        player.position.x >= 830 &&
        player.position.x <= 910 &&
        player.position.y < 330 &&
        player.grounded
      ) {
        if (!criteriaRef.current[3].met) {
          setCriteria((prev) => {
            const next = [...prev];
            next[3] = { ...next[3], met: true };
            criteriaRef.current = next;
            return next;
          });
        }
      }

      // Criteria 5: Wall-jump chain (4+ consecutive without touching ground)
      if (currentState === "WALL_JUMPING" && prevState !== "WALL_JUMPING") {
        consecutiveWallJumpsRef.current++;
        if (consecutiveWallJumpsRef.current >= 4 && !criteriaRef.current[4].met) {
          setCriteria((prev) => {
            const next = [...prev];
            next[4] = { ...next[4], met: true };
            criteriaRef.current = next;
            return next;
          });
        }
      }
      if (player.grounded && !wasGroundedRef.current) {
        consecutiveWallJumpsRef.current = 0;
      }

      // Criteria 6: Dash across the gap in Section 4 (x: 2020–2220)
      if (
        player.position.x >= 2220 &&
        player.position.x <= 2320 &&
        player.grounded
      ) {
        if (!criteriaRef.current[5].met) {
          setCriteria((prev) => {
            const next = [...prev];
            next[5] = { ...next[5], met: true };
            criteriaRef.current = next;
            return next;
          });
        }
      }

      // Criteria 7: Air dash to high platform (y ~540, x ~2100)
      if (
        player.grounded &&
        player.position.x >= 2100 &&
        player.position.x <= 2200 &&
        player.position.y < 560
      ) {
        if (!criteriaRef.current[6].met) {
          setCriteria((prev) => {
            const next = [...prev];
            next[6] = { ...next[6], met: true };
            criteriaRef.current = next;
            return next;
          });
        }
      }

      // Criteria 8: Wall-dash combo — WALL_SLIDING → DASHING → landing without ground
      if (currentState !== prevState) {
        const combo = wallDashComboRef.current;
        if (currentState === "WALL_SLIDING") {
          combo.length = 0;
          combo.push("WALL_SLIDING");
        } else if (combo.length > 0) {
          combo.push(currentState);
          // Check for WALL_SLIDING → DASHING → (FALLING/IDLE/RUNNING)
          if (
            combo.length >= 3 &&
            combo[0] === "WALL_SLIDING" &&
            combo.includes("DASHING") &&
            !criteriaRef.current[7].met
          ) {
            const dashIdx = combo.indexOf("DASHING");
            const afterDash = combo.slice(dashIdx + 1);
            const landed = afterDash.some(
              (s) => s === "IDLE" || s === "RUNNING" || s === "FALLING",
            );
            if (landed) {
              setCriteria((prev) => {
                const next = [...prev];
                next[7] = { ...next[7], met: true };
                criteriaRef.current = next;
                return next;
              });
            }
          }
          // Reset if grounded during combo
          if (player.grounded && currentState !== "DASHING") {
            combo.length = 0;
          }
        }
      }

      prevPlayerStateRef.current = currentState;
      wasGroundedRef.current = player.grounded;

      // Determine current section
      let sectionIdx = 0;
      for (let i = SECTION_BOUNDS.length - 2; i >= 0; i--) {
        if (player.position.x >= SECTION_BOUNDS[i]) {
          sectionIdx = i;
          break;
        }
      }

      // Camera follow
      const camParams = (engine as EngineWithRefs & { __cameraParamsRef?: { followSpeed: number; lookaheadX: number; lookaheadY: number } }).__cameraParamsRef;
      if (camParams) {
        camera.followSpeed = camParams.followSpeed;
        camera.lookaheadX = camParams.lookaheadX;
        camera.lookaheadY = camParams.lookaheadY;
      }
      camera.follow(
        { x: player.position.x + player.size.x / 2, y: player.position.y + player.size.y / 2 },
        player.velocity,
        dt,
      );

      // Update UI periodically (every 3 frames to not spam React)
      uiUpdateCounter++;
      if (uiUpdateCounter % 3 === 0) {
        if (run.running) {
          const elapsed = performance.now() - run.startTime;
          setTimerDisplay(formatTime(elapsed));
        } else if (run.finished) {
          setTimerDisplay(formatTime(run.endTime - run.startTime));
        }

        setCurrentSection(SECTION_NAMES[sectionIdx] ?? "");

        // Split delta
        const currentSplits = splitsRef.current;
        const bestSplits = splitsRef.current.best;
        if (
          run.running &&
          sectionIdx > 0 &&
          currentSplits.current[sectionIdx - 1] > 0 &&
          bestSplits[sectionIdx - 1] > 0
        ) {
          const delta = currentSplits.current[sectionIdx - 1] - bestSplits[sectionIdx - 1];
          setSplitDelta(delta >= 0 ? `+${formatTime(delta)}` : `-${formatTime(Math.abs(delta))}`);
        } else {
          setSplitDelta("");
        }

        // Update split display
        setSplitDisplay(
          SECTION_NAMES.map((_, i) => ({
            time: splitsRef.current.current[i] > 0 ? formatTime(splitsRef.current.current[i]) : "--:--.---",
            best: splitsRef.current.best[i] > 0 ? formatTime(splitsRef.current.best[i]) : "--:--.---",
            reached: checkpointsRef.current[i]?.reached ?? false,
          })),
        );
      }
    });

    // ─── Render: World space ──────────────────────────────────────────
    engine.onRender((renderer: Renderer, interpolation: number) => {
      // Draw tilemap
      tileMap.render(renderer);

      // Section boundary lines
      const rCtx = renderer.getContext();
      rCtx.setLineDash([8, 6]);
      for (let i = 1; i < SECTION_BOUNDS.length - 1; i++) {
        const sx = SECTION_BOUNDS[i];
        renderer.drawLine(sx, 0, sx, LEVEL_HEIGHT, "rgba(255, 255, 255, 0.15)", 1);
        rCtx.setLineDash([]);
        renderer.drawText(SECTION_NAMES[i] ?? "", sx + 4, 20, "rgba(255, 255, 255, 0.3)", 10);
        rCtx.setLineDash([8, 6]);
      }
      rCtx.setLineDash([]);

      // Finish line
      rCtx.setLineDash([4, 4]);
      renderer.drawLine(FINISH_LINE_X, 0, FINISH_LINE_X, LEVEL_HEIGHT, "#f59e0b", 2);
      rCtx.setLineDash([]);
      renderer.drawText("FINISH", FINISH_LINE_X - 24, 20, "#f59e0b", 12);

      // Checkpoint markers
      for (const cp of checkpointsRef.current) {
        const color = cp.reached ? "#4ade80" : "rgba(255, 255, 255, 0.2)";
        // Triangle flag
        rCtx.beginPath();
        rCtx.moveTo(cp.x, 690);
        rCtx.lineTo(cp.x + 12, 680);
        rCtx.lineTo(cp.x, 670);
        rCtx.fillStyle = color;
        rCtx.fill();
        // Pole
        renderer.drawLine(cp.x, 670, cp.x, 700, color, 1);
      }

      // Ghost replay
      if (showGhostRef.current && bestGhostRef.current.length > 0) {
        const run = runStateRef.current;
        const ghostFrames = bestGhostRef.current;
        const frameIdx = run.running ? run.frameCount : 0;
        if (frameIdx < ghostFrames.length) {
          const gf = ghostFrames[frameIdx];
          rCtx.globalAlpha = 0.3;
          renderer.fillRect(gf.x, gf.y, gf.sizeX, gf.sizeY, "#9ca3af");
          rCtx.globalAlpha = 1;
        }
      }

      if (!showOverlaysRef.current) return;

      // ─── Debug Overlays ────────────────────────────────────────────
      const pos = player.getInterpolatedPosition(interpolation);
      const state = player.stateMachine.getCurrentState();

      // Hitbox outline
      const hitboxColor = player.isDashing ? "#ffffff" : COLORS.debug.hitbox;
      const hitboxWidth = player.isDashing ? 2 : 1;
      renderer.strokeRect(pos.x, pos.y, player.size.x, player.size.y, hitboxColor, hitboxWidth);

      // Velocity vector
      const cx = pos.x + player.size.x / 2;
      const cy = pos.y + player.size.y / 2;
      const vScale = 0.15;
      const vx = player.velocity.x * vScale;
      const vy = player.velocity.y * vScale;
      if (Math.abs(vx) > 1 || Math.abs(vy) > 1) {
        renderer.drawLine(cx, cy, cx + vx, cy + vy, COLORS.debug.velocity, 2);
        const angle = Math.atan2(vy, vx);
        const headLen = 6;
        renderer.drawLine(cx + vx, cy + vy, cx + vx - headLen * Math.cos(angle - 0.4), cy + vy - headLen * Math.sin(angle - 0.4), COLORS.debug.velocity, 2);
        renderer.drawLine(cx + vx, cy + vy, cx + vx - headLen * Math.cos(angle + 0.4), cy + vy - headLen * Math.sin(angle + 0.4), COLORS.debug.velocity, 2);
      }

      // State label
      renderer.drawText(state, pos.x, pos.y - 8, COLORS.debug.stateLabel, 10);

      // Ground indicator
      if (player.grounded) {
        renderer.drawCircle(pos.x + player.size.x / 2, pos.y + player.size.y + 3, 3, COLORS.debug.ground);
      }

      // Wall contact indicators
      if (player.tileMap) {
        const wallColor = "#ec4899";
        if (player.tileMap.isTouchingWall(player, 1)) {
          renderer.fillRect(pos.x + player.size.x, pos.y + 2, 3, player.size.y - 4, wallColor);
        }
        if (player.tileMap.isTouchingWall(player, -1)) {
          renderer.fillRect(pos.x - 3, pos.y + 2, 3, player.size.y - 4, wallColor);
        }
      }

      // Dash cooldown bar
      {
        const barWidth = 24;
        const barX = pos.x + player.size.x / 2 - barWidth / 2;
        const barY = pos.y + player.size.y + 8;
        if (player.dashCooldownTimer > 0) {
          const ratio = 1 - player.dashCooldownTimer / player.params.dashCooldownFrames;
          renderer.fillRect(barX, barY, barWidth, 3, "rgba(100, 100, 100, 0.5)");
          renderer.fillRect(barX, barY, barWidth * ratio, 3, "#6b7280");
        } else if (player.dashAvailable) {
          renderer.fillRect(barX, barY, barWidth, 3, "#4ade80");
        }
      }

      // Apex float indicator
      if (player.isInApexFloat && (state === "JUMPING" || state === "FALLING" || state === "WALL_JUMPING")) {
        renderer.strokeRect(pos.x - 2, pos.y - 2, player.size.x + 4, player.size.y + 4, "rgba(251, 191, 36, 0.6)", 2);
      }
    });

    // ─── Screen-space debug layer ─────────────────────────────────────
    const debugLayerCallback = (drawCtx: CanvasRenderingContext2D) => {
      const metrics = engine.getMetrics();

      // FPS (always visible)
      drawCtx.fillStyle = COLORS.debug.ground;
      drawCtx.font = "12px monospace";
      drawCtx.textAlign = "left";
      drawCtx.fillText(`FPS: ${Math.round(metrics.fps)}`, 8, 16);

      if (!showOverlaysRef.current) return;

      // Timer HUD (top center)
      const run = runStateRef.current;
      const elapsed = run.running
        ? performance.now() - run.startTime
        : run.finished
          ? run.endTime - run.startTime
          : 0;

      drawCtx.textAlign = "center";
      drawCtx.font = "20px monospace";
      drawCtx.fillStyle = "#f5f5f5";
      drawCtx.fillText(formatTime(elapsed), CANVAS_WIDTH / 2, 28);

      // Best time
      drawCtx.font = "11px monospace";
      drawCtx.fillStyle = "#71717a";
      if (bestTimeRef.current > 0) {
        drawCtx.fillText(`Best: ${formatTime(bestTimeRef.current)}`, CANVAS_WIDTH / 2, 44);
      }
      drawCtx.textAlign = "left";

      // Velocity readout (top-right)
      drawCtx.fillStyle = COLORS.debug.velocity;
      drawCtx.textAlign = "right";
      drawCtx.font = "11px monospace";
      drawCtx.fillText(`Vel: ${Math.round(player.velocity.x)}, ${Math.round(player.velocity.y)}`, CANVAS_WIDTH - 8, 16);
      drawCtx.fillText(`Pos: ${Math.round(player.position.x)}, ${Math.round(player.position.y)}`, CANVAS_WIDTH - 8, 30);
      drawCtx.textAlign = "left";

      // ─── Minimap (top-right corner) ────────────────────────────────
      const mmW = 200;
      const mmH = 56;
      const mmX = CANVAS_WIDTH - mmW - 8;
      const mmY = 38;
      const mmScaleX = mmW / LEVEL_WIDTH;
      const mmScaleY = mmH / LEVEL_HEIGHT;

      // Background
      drawCtx.fillStyle = "rgba(0, 0, 0, 0.6)";
      drawCtx.fillRect(mmX, mmY, mmW, mmH);
      drawCtx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      drawCtx.lineWidth = 1;
      drawCtx.strokeRect(mmX, mmY, mmW, mmH);

      // Platforms
      drawCtx.fillStyle = "rgba(74, 222, 128, 0.4)";
      for (const p of tileMap.platforms) {
        const px = mmX + p.x * mmScaleX;
        const py = mmY + p.y * mmScaleY;
        const pw = Math.max(1, p.width * mmScaleX);
        const ph = Math.max(1, p.height * mmScaleY);
        drawCtx.fillRect(px, py, pw, ph);
      }

      // Section markers on minimap
      drawCtx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      for (let i = 1; i < SECTION_BOUNDS.length - 1; i++) {
        const sx = mmX + SECTION_BOUNDS[i] * mmScaleX;
        drawCtx.beginPath();
        drawCtx.moveTo(sx, mmY);
        drawCtx.lineTo(sx, mmY + mmH);
        drawCtx.stroke();
      }

      // Camera viewport indicator
      const vp = camera.getViewportBounds();
      drawCtx.strokeStyle = "rgba(245, 158, 11, 0.5)";
      drawCtx.strokeRect(
        mmX + vp.x * mmScaleX,
        mmY + vp.y * mmScaleY,
        vp.width * mmScaleX,
        vp.height * mmScaleY,
      );

      // Player dot
      const playerMmX = mmX + player.position.x * mmScaleX;
      const playerMmY = mmY + player.position.y * mmScaleY;
      drawCtx.fillStyle = "#3b82f6";
      drawCtx.fillRect(playerMmX - 2, playerMmY - 2, 4, 4);

      // Ghost dot
      if (showGhostRef.current && bestGhostRef.current.length > 0) {
        const frameIdx = runStateRef.current.running ? runStateRef.current.frameCount : 0;
        if (frameIdx < bestGhostRef.current.length) {
          const gf = bestGhostRef.current[frameIdx];
          drawCtx.fillStyle = "rgba(156, 163, 175, 0.6)";
          drawCtx.fillRect(mmX + gf.x * mmScaleX - 1, mmY + gf.y * mmScaleY - 1, 3, 3);
        }
      }

      // Checkpoint dots on minimap
      for (const cp of checkpointsRef.current) {
        const cpx = mmX + cp.x * mmScaleX;
        drawCtx.fillStyle = cp.reached ? "#4ade80" : "rgba(255, 255, 255, 0.3)";
        drawCtx.fillRect(cpx - 1, mmY + mmH - 4, 2, 4);
      }
    };

    engine.getRenderer().addLayerCallback("debug", debugLayerCallback);

    engine.start();

    // Store cleanup so handleUnmount can call it (GameCanvas ignores return values)
    cleanupRef.current = () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const handleUnmount = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    engineRef.current?.stop();
    engineRef.current = null;
    playerRef.current = null;
  }, []);

  // ─── Overlay toggle ────────────────────────────────────────────────────

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

  const toggleGhost = useCallback(() => {
    setShowGhost((prev) => {
      const next = !prev;
      const engine = engineRef.current as EngineWithRefs | null;
      if (engine?.__showGhostRef) {
        engine.__showGhostRef.current = next;
      }
      return next;
    });
  }, []);

  // ─── Camera param sync ─────────────────────────────────────────────────

  useEffect(() => {
    const engine = engineRef.current as EngineWithRefs & { __cameraParamsRef?: { followSpeed: number; lookaheadX: number; lookaheadY: number } } | null;
    if (engine?.__cameraParamsRef) {
      engine.__cameraParamsRef.followSpeed = cameraFollowSpeed;
      engine.__cameraParamsRef.lookaheadX = cameraLookaheadX;
      engine.__cameraParamsRef.lookaheadY = cameraLookaheadY;
    }
  }, [cameraFollowSpeed, cameraLookaheadX, cameraLookaheadY]);

  // Count met criteria
  const metCount = criteria.filter((c) => c.met).length;

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-zinc-800 px-4 py-2">
        <Link href="/test" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
          &larr; Tests
        </Link>
        <h1 className="font-mono text-sm font-bold text-amber-500">Movement Playground</h1>
        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-mono text-amber-400">
          Phase 1 — Core Movement
        </span>
        <span className="ml-auto font-mono text-xs text-zinc-500">
          {timerDisplay}
        </span>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas area */}
        <div className="flex flex-1 flex-col items-center justify-start gap-2 p-4 overflow-y-auto">
          {/* Timer bar */}
          <div className="w-[960px] flex items-center justify-between rounded bg-zinc-900 px-4 py-2 font-mono text-sm">
            <div className="flex items-center gap-4">
              <span className="text-zinc-400 text-xs">Timer:</span>
              <span className="text-lg text-zinc-100">{timerDisplay}</span>
              {bestTimeDisplay !== "--:--.---" && (
                <span className="text-xs text-zinc-500">Best: {bestTimeDisplay}</span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-zinc-400 text-xs">Section:</span>
              <span className="text-amber-400">{currentSection}</span>
              {splitDelta && (
                <span className={splitDelta.startsWith("+") ? "text-red-400 text-xs" : "text-green-400 text-xs"}>
                  {splitDelta}
                </span>
              )}
            </div>
          </div>

          <GameCanvas onMount={handleMount} onUnmount={handleUnmount} />

          {/* Pass Criteria */}
          <div className="w-[960px] rounded bg-zinc-900 px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Pass Criteria</span>
              <span className={`text-xs font-mono ${metCount === 10 ? "text-green-400" : "text-zinc-500"}`}>
                {metCount}/10
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              {criteria.map((c, i) => (
                <button
                  key={i}
                  onClick={() => toggleManualCriteria(i)}
                  className={`flex items-center gap-2 text-xs font-mono text-left ${
                    c.auto ? "cursor-default" : "cursor-pointer hover:text-zinc-200"
                  }`}
                  disabled={c.auto}
                >
                  <span className={c.met ? "text-green-400" : "text-zinc-600"}>
                    {c.met ? "\u2713" : "\u2610"}
                  </span>
                  <span className={c.met ? "text-zinc-300" : "text-zinc-500"}>{c.label}</span>
                  {!c.auto && <span className="text-zinc-700 text-[10px]">(manual)</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Controls Reference */}
          <div className="w-[960px] text-[10px] font-mono text-zinc-600 flex gap-4 flex-wrap">
            <span>Arrow Keys: Move</span>
            <span>Up/Z: Jump</span>
            <span>Down: Crouch</span>
            <span>X/Shift: Dash</span>
            <span>R: Respawn</span>
            <span>T: Reset Run</span>
            <span>G: Ghost</span>
            <span>D: Debug</span>
          </div>
        </div>

        {/* Debug panel */}
        <DebugPanel title="Playground">
          <RenderModeToggle />
          {/* Run Info — always visible */}
          <div className="flex flex-col gap-1 pb-2 border-b border-zinc-800">
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-500">State</span>
              <span className="text-xs font-mono text-purple-400">
                {playerRef.current?.stateMachine.getCurrentState() ?? "—"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-500">Section</span>
              <span className="text-xs font-mono text-amber-400">{currentSection}</span>
            </div>
          </div>

          {/* State Info */}
          <details>
            <summary className="text-xs font-mono text-zinc-500 uppercase tracking-wider cursor-pointer select-none pt-2">
              State Info
            </summary>
            <div className="flex flex-col gap-0.5 pt-1 text-[10px] font-mono text-zinc-400">
              <div className="flex justify-between"><span>Vel X</span><span>{Math.round(playerRef.current?.velocity.x ?? 0)}</span></div>
              <div className="flex justify-between"><span>Vel Y</span><span>{Math.round(playerRef.current?.velocity.y ?? 0)}</span></div>
              <div className="flex justify-between"><span>Pos X</span><span>{Math.round(playerRef.current?.position.x ?? 0)}</span></div>
              <div className="flex justify-between"><span>Pos Y</span><span>{Math.round(playerRef.current?.position.y ?? 0)}</span></div>
              <div className="flex justify-between"><span>Grounded</span><span>{playerRef.current?.grounded ? "Yes" : "No"}</span></div>
              <div className="flex justify-between"><span>Wall Side</span><span>{playerRef.current?.wallSide ?? 0}</span></div>
              <div className="flex justify-between"><span>Facing</span><span>{playerRef.current?.facingRight ? "R" : "L"}</span></div>
              <div className="flex justify-between"><span>Dash</span><span>{playerRef.current?.dashAvailable ? "READY" : (playerRef.current?.dashCooldownTimer ?? 0) > 0 ? "CD" : "USED"}</span></div>
              <div className="flex justify-between"><span>Coyote</span><span>{playerRef.current?.canCoyoteJump ? `${playerRef.current.coyoteTimer}f` : "—"}</span></div>
              <div className="flex justify-between"><span>Apex Float</span><span>{playerRef.current?.isInApexFloat ? "Yes" : "No"}</span></div>
            </div>
          </details>

          {/* Section Splits */}
          <details open>
            <summary className="text-xs font-mono text-green-400/80 uppercase tracking-wider cursor-pointer select-none pt-2">
              Splits
            </summary>
            <div className="flex flex-col gap-0.5 pt-1">
              {SECTION_NAMES.map((name, i) => (
                <div key={i} className="flex items-center justify-between text-[10px] font-mono">
                  <span className={splitDisplay[i].reached ? "text-zinc-300" : "text-zinc-600"}>
                    {splitDisplay[i].reached ? "\u2713" : "\u2610"} {name.slice(0, 12)}
                  </span>
                  <span className="text-zinc-500">{splitDisplay[i].time}</span>
                </div>
              ))}
            </div>
          </details>

          {/* Camera */}
          <details>
            <summary className="text-xs font-mono text-sky-400 uppercase tracking-wider cursor-pointer select-none pt-2">
              Camera
            </summary>
            <div className="flex flex-col gap-4 pt-2">
              <Slider
                label="Follow Speed"
                value={cameraFollowSpeed}
                min={2} max={20} step={0.5}
                onChange={setCameraFollowSpeed}
              />
              <Slider
                label="Look-ahead X"
                value={cameraLookaheadX}
                min={0} max={200} step={5}
                onChange={setCameraLookaheadX}
              />
              <Slider
                label="Look-ahead Y"
                value={cameraLookaheadY}
                min={0} max={80} step={5}
                onChange={setCameraLookaheadY}
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
                onClick={resetRun}
                className="w-full rounded bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Reset Run (T)
              </button>
              <button
                onClick={respawnAtCheckpoint}
                className="w-full rounded bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Respawn at Checkpoint (R)
              </button>
              <button
                onClick={toggleGhost}
                className={`w-full rounded px-3 py-1.5 text-xs font-mono transition-colors ${
                  showGhost ? "bg-amber-500/20 text-amber-400" : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Ghost: {showGhost ? "ON" : "OFF"} (G)
              </button>
              <button
                onClick={toggleOverlays}
                className={`w-full rounded px-3 py-1.5 text-xs font-mono transition-colors ${
                  showOverlays ? "bg-amber-500/20 text-amber-400" : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Debug Overlays: {showOverlays ? "ON" : "OFF"} (D)
              </button>
              <button
                onClick={resetParams}
                className="w-full rounded bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Reset All Params
              </button>
            </div>
          </details>

          {/* Physics Params */}
          <details>
            <summary className="text-xs font-mono text-zinc-500 uppercase tracking-wider cursor-pointer select-none pt-2">
              Ground Movement
            </summary>
            <div className="flex flex-col gap-4 pt-2">
              <Slider label="Max Run Speed" value={params.maxRunSpeed} min={50} max={600} step={10} onChange={(v) => updateParam("maxRunSpeed", v)} />
              <Slider label="Acceleration" value={params.acceleration} min={200} max={5000} step={100} onChange={(v) => updateParam("acceleration", v)} />
              <Slider label="Deceleration" value={params.deceleration} min={200} max={3000} step={100} onChange={(v) => updateParam("deceleration", v)} />
              <Slider label="Turn Multiplier" value={params.turnMultiplier} min={1.0} max={6.0} step={0.5} onChange={(v) => updateParam("turnMultiplier", v)} />
              <Slider label="Crouch Speed" value={params.crouchSpeed} min={20} max={200} step={10} onChange={(v) => updateParam("crouchSpeed", v)} />
              <Slider label="Slide Initial Speed" value={params.slideInitialSpeed} min={100} max={600} step={10} onChange={(v) => updateParam("slideInitialSpeed", v)} />
              <Slider label="Slide Friction" value={params.slideFriction} min={100} max={1500} step={50} onChange={(v) => updateParam("slideFriction", v)} />
            </div>
          </details>

          <details>
            <summary className="text-xs font-mono text-amber-500/80 uppercase tracking-wider cursor-pointer select-none pt-2">
              Jumping
            </summary>
            <div className="flex flex-col gap-4 pt-2">
              <Slider label="Jump Speed" value={params.jumpSpeed} min={200} max={600} step={10} onChange={(v) => updateParam("jumpSpeed", v)} />
              <Slider label="Rise Gravity" value={params.riseGravity} min={200} max={1500} step={50} onChange={(v) => updateParam("riseGravity", v)} />
              <Slider label="Fall Gravity" value={params.fallGravity} min={400} max={2000} step={50} onChange={(v) => updateParam("fallGravity", v)} />
              <Slider label="Apex Gravity Mult" value={params.apexGravityMultiplier} min={0.1} max={0.8} step={0.05} onChange={(v) => updateParam("apexGravityMultiplier", v)} />
              <Slider label="Max Fall Speed" value={params.maxFallSpeed} min={200} max={1200} step={50} onChange={(v) => updateParam("maxFallSpeed", v)} />
              <Slider label="Coyote Frames" value={params.coyoteFrames} min={0} max={15} step={1} onChange={(v) => updateParam("coyoteFrames", v)} />
              <Slider label="Jump Buffer" value={params.jumpBufferFrames} min={0} max={15} step={1} onChange={(v) => updateParam("jumpBufferFrames", v)} />
              <Slider label="Jump Cut Mult" value={params.jumpCutMultiplier} min={0.1} max={0.8} step={0.05} onChange={(v) => updateParam("jumpCutMultiplier", v)} />
              <Slider label="Air Accel" value={params.airAcceleration} min={200} max={3000} step={100} onChange={(v) => updateParam("airAcceleration", v)} />
              <Slider label="Air Decel" value={params.airDeceleration} min={100} max={2000} step={100} onChange={(v) => updateParam("airDeceleration", v)} />
            </div>
          </details>

          <details>
            <summary className="text-xs font-mono text-teal-400 uppercase tracking-wider cursor-pointer select-none pt-2">
              Wall Mechanics
            </summary>
            <div className="flex flex-col gap-4 pt-2">
              <Slider label="Slide Base Speed" value={params.wallSlideBaseSpeed} min={20} max={300} step={10} onChange={(v) => updateParam("wallSlideBaseSpeed", v)} />
              <Slider label="Slide Grip Speed" value={params.wallSlideGripSpeed} min={5} max={150} step={5} onChange={(v) => updateParam("wallSlideGripSpeed", v)} />
              <Slider label="Slide Accel" value={params.wallSlideAcceleration} min={200} max={2000} step={50} onChange={(v) => updateParam("wallSlideAcceleration", v)} />
              <Slider label="WJ Horiz Speed" value={params.wallJumpHorizontalSpeed} min={100} max={500} step={10} onChange={(v) => updateParam("wallJumpHorizontalSpeed", v)} />
              <Slider label="WJ Vert Speed" value={params.wallJumpVerticalSpeed} min={150} max={500} step={10} onChange={(v) => updateParam("wallJumpVerticalSpeed", v)} />
              <Slider label="WJ Lockout" value={params.wallJumpLockoutFrames} min={0} max={20} step={1} onChange={(v) => updateParam("wallJumpLockoutFrames", v)} />
              <Slider label="WJ Coyote" value={params.wallJumpCoyoteFrames} min={0} max={15} step={1} onChange={(v) => updateParam("wallJumpCoyoteFrames", v)} />
              <Slider label="Wall Stick" value={params.wallStickFrames} min={0} max={10} step={1} onChange={(v) => updateParam("wallStickFrames", v)} />
            </div>
          </details>

          <details>
            <summary className="text-xs font-mono text-pink-400 uppercase tracking-wider cursor-pointer select-none pt-2">
              Dash
            </summary>
            <div className="flex flex-col gap-4 pt-2">
              <Slider label="Dash Speed" value={params.dashSpeed} min={200} max={1200} step={25} onChange={(v) => updateParam("dashSpeed", v)} />
              <Slider label="Dash Duration" value={params.dashDurationFrames} min={5} max={30} step={1} onChange={(v) => updateParam("dashDurationFrames", v)} />
              <Slider label="Dash Windup" value={params.dashWindupFrames} min={0} max={5} step={1} onChange={(v) => updateParam("dashWindupFrames", v)} />
              <Slider label="Dash Cooldown" value={params.dashCooldownFrames} min={0} max={60} step={1} onChange={(v) => updateParam("dashCooldownFrames", v)} />
              <Slider label="Speed Boost" value={params.dashSpeedBoost} min={1.0} max={2.5} step={0.05} onChange={(v) => updateParam("dashSpeedBoost", v)} />
              <Slider label="Boost Decay" value={params.dashSpeedBoostDecayRate} min={200} max={2000} step={50} onChange={(v) => updateParam("dashSpeedBoostDecayRate", v)} />
            </div>
          </details>
        </DebugPanel>
      </div>
    </div>
  );
}
