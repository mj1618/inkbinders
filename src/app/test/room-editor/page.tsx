"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { GameCanvas } from "@/components/canvas/GameCanvas";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { Slider } from "@/components/debug/Slider";
import { Engine } from "@/engine/core/Engine";
import { Player } from "@/engine/entities/Player";
import { TileMap } from "@/engine/physics/TileMap";
import type { Platform } from "@/engine/physics/TileMap";
import type { Renderer } from "@/engine/core/Renderer";
import type { Vec2 } from "@/lib/types";
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS } from "@/lib/constants";
import type { SurfaceType } from "@/engine/physics/Surfaces";
import { getSurfaceProps } from "@/engine/physics/Surfaces";
import type { ObstacleType } from "@/engine/physics/Obstacles";
import type { Obstacle } from "@/engine/physics/Obstacles";
import {
  createSpikes,
  createBarrier,
  createLaser,
  createHazardZone,
  resetObstacleIdCounter,
} from "@/engine/physics/Obstacles";
import { RoomEditor } from "@/engine/world/RoomEditor";
import type { EditorTool } from "@/engine/world/RoomEditor";
import { RoomManager } from "@/engine/world/RoomManager";
import type { RoomData, GateAbility } from "@/engine/world/Room";
import { GATE_COLORS } from "@/engine/world/Room";
import {
  renderGates,
  renderExitIndicators,
  renderBounds,
  renderTransitionOverlay,
  renderSpawnMarker,
  renderEnemyMarker,
  renderVineMarker,
} from "@/engine/world/RoomRenderer";
import { PRESET_ROOMS, PRESET_ROOM_NAMES } from "@/engine/world/presetRooms";
import Link from "next/link";

// ─── Constants ──────────────────────────────────────────────────────

const TOOL_LIST: { tool: EditorTool; label: string }[] = [
  { tool: "select", label: "Select" },
  { tool: "platform", label: "Platform" },
  { tool: "obstacle", label: "Obstacle" },
  { tool: "exit", label: "Exit" },
  { tool: "gate", label: "Gate" },
  { tool: "enemy", label: "Enemy" },
  { tool: "vine", label: "Vine" },
  { tool: "spawn", label: "Spawn" },
  { tool: "erase", label: "Erase" },
];

const SURFACE_TYPES: SurfaceType[] = ["normal", "bouncy", "icy", "sticky", "conveyor"];
const OBSTACLE_TYPES: ObstacleType[] = ["spikes", "barrier", "laser", "hazard_zone"];
const ENEMY_TYPES: Array<"reader" | "binder" | "proofwarden"> = ["reader", "binder", "proofwarden"];
const GATE_ABILITIES: GateAbility[] = ["margin-stitch", "redaction", "paste-over", "index-mark"];

// ─── Pass Criteria ──────────────────────────────────────────────────

interface PassCriteria {
  platformToolWorks: boolean;
  allElementsPlaceable: boolean;
  selectAndMove: boolean;
  deleteWorks: boolean;
  gridSnap: boolean;
  playMode: boolean;
  roomTransitions: boolean;
  abilityGates: boolean;
  exportImport: boolean;
  presetRoomsLoad: boolean;
}

// ─── Test Page ──────────────────────────────────────────────────────

export default function RoomEditorTest() {
  const engineRef = useRef<Engine | null>(null);
  const editorRef = useRef<RoomEditor | null>(null);
  const roomManagerRef = useRef<RoomManager | null>(null);
  const playerRef = useRef<Player | null>(null);
  const tileMapRef = useRef<TileMap | null>(null);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const timeRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseScreenStartRef = useRef<Vec2 | null>(null);

  const [playMode, setPlayMode] = useState(false);
  const playModeRef = useRef(false);
  const [activeTool, setActiveTool] = useState<EditorTool>("select");
  const [surfaceType, setSurfaceType] = useState<SurfaceType>("normal");
  const [obstacleType, setObstacleType] = useState<ObstacleType>("spikes");
  const [enemyType, setEnemyType] = useState<"reader" | "binder" | "proofwarden">("reader");
  const [gateAbility, setGateAbility] = useState<GateAbility>("margin-stitch");
  const [gridSize, setGridSize] = useState(32);
  const [showGrid, setShowGrid] = useState(true);
  const [roomName, setRoomName] = useState("New Room");
  const [roomWidth, setRoomWidth] = useState(960);
  const [roomHeight, setRoomHeight] = useState(540);
  const [, forceUpdate] = useState(0);
  const [criteria, setCriteria] = useState<PassCriteria>({
    platformToolWorks: false,
    allElementsPlaceable: false,
    selectAndMove: false,
    deleteWorks: false,
    gridSnap: false,
    playMode: false,
    roomTransitions: false,
    abilityGates: false,
    exportImport: false,
    presetRoomsLoad: false,
  });

  // ─── Sync editor state from React ──────────────────────────────

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.state.activeTool = activeTool;
  }, [activeTool]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.state.surfaceSubtype = surfaceType;
  }, [surfaceType]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.state.obstacleSubtype = obstacleType;
  }, [obstacleType]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.state.enemySubtype = enemyType;
  }, [enemyType]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.state.gateAbility = gateAbility;
  }, [gateAbility]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.state.gridSize = gridSize;
  }, [gridSize]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.state.showGrid = showGrid;
  }, [showGrid]);

  // ─── Play Mode Toggle ─────────────────────────────────────────

  const enterPlayMode = useCallback(() => {
    const engine = engineRef.current;
    const editor = editorRef.current;
    if (!engine || !editor) return;

    const room = editor.room;

    // Build TileMap from room platforms
    resetObstacleIdCounter();
    const platforms: Platform[] = room.platforms.map((p) => ({
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
      surfaceType: p.surfaceType,
    }));

    // Add gate platforms for locked gates
    const gatesCopy = room.gates.map((g) => ({ ...g }));
    for (const gate of gatesCopy) {
      if (!gate.opened) {
        platforms.push({
          x: gate.rect.x,
          y: gate.rect.y,
          width: gate.rect.width,
          height: gate.rect.height,
        });
      }
    }

    const tileMap = new TileMap(platforms);
    tileMapRef.current = tileMap;

    // Build obstacles
    const obstacles: Obstacle[] = room.obstacles.map((o) => {
      switch (o.type) {
        case "spikes": return createSpikes(o.rect, o.damage);
        case "barrier": return createBarrier(o.rect);
        case "laser": return createLaser(o.rect, o.damage);
        case "hazard_zone": return createHazardZone(o.rect, o.damage);
      }
    });
    obstaclesRef.current = obstacles;

    // Create player
    const player = new Player();
    player.position = { x: room.defaultSpawn.x, y: room.defaultSpawn.y };
    player.velocity = { x: 0, y: 0 };
    player.tileMap = tileMap;
    player.input = engine.getInput();
    playerRef.current = player;

    // Create RoomManager with all preset rooms + current room
    const allRooms = new Map<string, RoomData>();
    for (const [id, preset] of Object.entries(PRESET_ROOMS)) {
      allRooms.set(id, JSON.parse(JSON.stringify(preset)));
    }
    if (!allRooms.has(room.id)) {
      allRooms.set(room.id, JSON.parse(JSON.stringify(room)));
    }

    const roomManager = new RoomManager({
      rooms: allRooms,
      startingRoomId: room.id,
    });
    roomManagerRef.current = roomManager;

    // Set camera bounds
    const camera = engine.getCamera();
    camera.bounds = { x: 0, y: 0, width: room.width, height: room.height };
    camera.snapTo({ x: room.defaultSpawn.x, y: room.defaultSpawn.y });

    playModeRef.current = true;
    setPlayMode(true);

    setCriteria((c) => ({ ...c, playMode: true }));
  }, []);

  const exitPlayMode = useCallback(() => {
    playerRef.current = null;
    roomManagerRef.current = null;
    tileMapRef.current = null;
    obstaclesRef.current = [];
    playModeRef.current = false;
    setPlayMode(false);

    // Reset camera
    const engine = engineRef.current;
    const editor = editorRef.current;
    if (engine && editor) {
      const camera = engine.getCamera();
      camera.bounds = { x: 0, y: 0, width: editor.room.width, height: editor.room.height };
      camera.snapTo({ x: editor.room.width / 2, y: editor.room.height / 2 });
    }
  }, []);

  // ─── Engine Mount ──────────────────────────────────────────────

  const handleMount = useCallback((ctx: CanvasRenderingContext2D) => {
    const canvas = ctx.canvas;
    canvasRef.current = canvas;

    const engine = new Engine({ ctx });
    engineRef.current = engine;

    const editor = new RoomEditor();
    editorRef.current = editor;

    const camera = engine.getCamera();
    camera.bounds = { x: 0, y: 0, width: editor.room.width, height: editor.room.height };
    camera.snapTo({ x: editor.room.width / 2, y: editor.room.height / 2 });

    // ─── Mouse event handlers ────────────────────────────────────

    const getCanvasPos = (e: MouseEvent): Vec2 => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (playModeRef.current) return;
      const screenPos = getCanvasPos(e);
      mouseScreenStartRef.current = { ...screenPos };
      const worldPos = camera.screenToWorld(screenPos);
      editor.onMouseDown(worldPos, e.button, camera);
      forceUpdate((n) => n + 1);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (playModeRef.current) return;
      const screenPos = getCanvasPos(e);
      const worldPos = camera.screenToWorld(screenPos);
      const screenDelta = mouseScreenStartRef.current
        ? { x: screenPos.x - mouseScreenStartRef.current.x, y: screenPos.y - mouseScreenStartRef.current.y }
        : undefined;
      editor.onMouseMove(worldPos, camera, screenDelta);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (playModeRef.current) return;
      const screenPos = getCanvasPos(e);
      const worldPos = camera.screenToWorld(screenPos);
      editor.onMouseUp(worldPos);
      mouseScreenStartRef.current = null;
      forceUpdate((n) => n + 1);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        if (playModeRef.current) {
          exitPlayMode();
        } else {
          enterPlayMode();
        }
        return;
      }
      if (!playModeRef.current) {
        editor.onKeyDown(e.key);
        forceUpdate((n) => n + 1);
      }
    };

    const handleContextMenu = (e: Event) => e.preventDefault();

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);

    // ─── Update callback ────────────────────────────────────────

    engine.onUpdate((dt) => {
      timeRef.current += dt;

      if (playModeRef.current) {
        const player = playerRef.current;
        const tileMap = tileMapRef.current;
        const roomManager = roomManagerRef.current;
        if (!player || !tileMap || !roomManager) return;

        // Suppress input during transition
        if (roomManager.transitioning) {
          const result = roomManager.updateTransition(dt);
          if (result) {
            player.position = { x: result.spawnX, y: result.spawnY };
            player.velocity = { x: 0, y: 0 };
            player.tileMap = roomManager.currentTileMap;
            tileMapRef.current = roomManager.currentTileMap;
            obstaclesRef.current = roomManager.currentObstacles;
            camera.bounds = {
              x: 0,
              y: 0,
              width: roomManager.currentRoom.width,
              height: roomManager.currentRoom.height,
            };
            camera.snapTo(player.position);
            setCriteria((c) => ({ ...c, roomTransitions: true }));
          }
          return;
        }

        // Update player
        player.currentSurface = getSurfaceProps(tileMap.getGroundSurface(player));
        player.currentWallSurface = player.wallSide !== 0
          ? getSurfaceProps(tileMap.getWallSurface(player, player.wallSide as -1 | 1))
          : getSurfaceProps(undefined);
        player.update(dt);

        // Resolve collisions
        tileMap.resolveCollisions(player);

        // Check ability gates
        const allAbilities = new Set<GateAbility>([
          "margin-stitch",
          "redaction",
          "paste-over",
          "index-mark",
        ]);
        for (const gate of roomManager.currentGates) {
          if (!gate.opened) {
            const px = player.position.x;
            const py = player.position.y;
            const pw = player.size.x;
            const ph = player.size.y;
            const gx = gate.rect.x - 16;
            const gy = gate.rect.y - 16;
            const gw = gate.rect.width + 32;
            const gh = gate.rect.height + 32;
            if (px < gx + gw && px + pw > gx && py < gy + gh && py + ph > gy) {
              if (roomManager.tryOpenGate(gate, allAbilities)) {
                tileMapRef.current = roomManager.currentTileMap;
                player.tileMap = roomManager.currentTileMap;
                setCriteria((c) => ({ ...c, abilityGates: true }));
              }
            }
          }
        }

        // Check exits
        const playerRect = {
          x: player.position.x,
          y: player.position.y,
          width: player.size.x,
          height: player.size.y,
        };
        const exit = roomManager.checkExits(playerRect);
        if (exit) {
          roomManager.startTransition(exit);
        }

        // Camera follow
        camera.follow(player.position, player.velocity, dt);
      }
    });

    // ─── Render callback ────────────────────────────────────────

    engine.onRender((renderer: Renderer) => {
      const ctx = renderer.getContext();
      const time = timeRef.current;

      if (playModeRef.current) {
        const player = playerRef.current;
        const tileMap = tileMapRef.current;
        const roomManager = roomManagerRef.current;
        if (!player || !tileMap || !roomManager) return;

        const room = roomManager.currentRoom;
        ctx.fillStyle = room.biomeId === "herbarium-folio" ? "#0a1a0f" : COLORS.background;
        ctx.fillRect(0, 0, room.width, room.height);

        renderBounds(ctx, room.width, room.height);
        tileMap.render(renderer);

        // Obstacles
        for (const obs of obstaclesRef.current) {
          if (!obs.active) continue;
          ctx.fillStyle = obs.color;
          ctx.globalAlpha = 0.7;
          ctx.fillRect(obs.rect.x, obs.rect.y, obs.rect.width, obs.rect.height);
          ctx.globalAlpha = 1;
        }

        renderGates(ctx, roomManager.currentGates, time);
        renderExitIndicators(ctx, roomManager.currentRoom.exits, time);

        // Player
        ctx.fillStyle = "#f5f5dc";
        ctx.fillRect(player.position.x, player.position.y, player.size.x, player.size.y);

        // State label
        ctx.fillStyle = "#fff";
        ctx.font = "10px monospace";
        const state = player.stateMachine?.getCurrentState() ?? "?";
        ctx.fillText(state, player.position.x, player.position.y - 4);

        // Transition overlay
        if (roomManager.transitioning) {
          renderTransitionOverlay(ctx, roomManager.getTransitionAlpha(), CANVAS_WIDTH, CANVAS_HEIGHT);
        }
      } else {
        const editor = editorRef.current;
        if (!editor) return;
        const room = editor.room;

        ctx.fillStyle = room.biomeId === "herbarium-folio" ? "#0a1a0f" : COLORS.background;
        ctx.fillRect(0, 0, room.width, room.height);

        editor.renderEditor(ctx, camera);
        renderBounds(ctx, room.width, room.height);

        // Platforms
        for (const p of room.platforms) {
          const surfProps = getSurfaceProps(p.surfaceType);
          ctx.fillStyle = surfaceColorToFill(surfProps.color);
          ctx.fillRect(p.x, p.y, p.width, p.height);
          ctx.strokeStyle = surfProps.color;
          ctx.lineWidth = 1;
          ctx.strokeRect(p.x, p.y, p.width, p.height);
        }

        // Obstacles
        const obsColors: Record<ObstacleType, string> = {
          spikes: "#dc2626",
          barrier: "#7c3aed",
          laser: "#ef4444",
          hazard_zone: "#f97316",
        };
        for (const obs of room.obstacles) {
          ctx.fillStyle = obsColors[obs.type] ?? "#888";
          ctx.globalAlpha = 0.6;
          ctx.fillRect(obs.rect.x, obs.rect.y, obs.rect.width, obs.rect.height);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = obsColors[obs.type] ?? "#888";
          ctx.lineWidth = 1;
          ctx.strokeRect(obs.rect.x, obs.rect.y, obs.rect.width, obs.rect.height);
          ctx.fillStyle = "#fff";
          ctx.font = "8px monospace";
          ctx.fillText(obs.type, obs.rect.x + 2, obs.rect.y + obs.rect.height - 2);
        }

        renderGates(ctx, room.gates, time);
        renderExitIndicators(ctx, room.exits, time);

        // Exit zone shading
        for (const exit of room.exits) {
          ctx.fillStyle = "rgba(96, 165, 250, 0.15)";
          ctx.fillRect(exit.zone.x, exit.zone.y, exit.zone.width, exit.zone.height);
          ctx.strokeStyle = "rgba(96, 165, 250, 0.4)";
          ctx.lineWidth = 1;
          ctx.strokeRect(exit.zone.x, exit.zone.y, exit.zone.width, exit.zone.height);
          ctx.fillStyle = "rgba(96, 165, 250, 0.7)";
          ctx.font = "8px monospace";
          ctx.fillText(`→ ${exit.targetRoomId || "?"}`, exit.zone.x + 2, exit.zone.y + exit.zone.height / 2 + 3);
        }

        for (const enemy of room.enemies) renderEnemyMarker(ctx, enemy);
        for (const vine of room.vineAnchors) renderVineMarker(ctx, vine);
        renderSpawnMarker(ctx, room.defaultSpawn);
      }
    });

    engine.start();

    // Store cleanup for unmount
    const cleanupFn = () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      engine.stop();
    };
    (engine as unknown as Record<string, () => void>).__cleanup = cleanupFn;
  }, [enterPlayMode, exitPlayMode]);

  const handleUnmount = useCallback(() => {
    const engine = engineRef.current;
    if (engine) {
      const cleanup = (engine as unknown as Record<string, () => void>).__cleanup;
      cleanup?.();
    }
    engineRef.current = null;
    editorRef.current = null;
  }, []);

  // ─── Panel Actions ────────────────────────────────────────────

  const handleExport = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const data = editor.exportRoom();
    const json = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(json).catch(() => {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.name.replace(/\s+/g, "-").toLowerCase()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
    setCriteria((c) => ({ ...c, exportImport: true }));
  }, []);

  const handleImport = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const json = prompt("Paste room JSON:");
    if (!json) return;
    try {
      const data = JSON.parse(json) as RoomData;
      editor.importRoom(data);
      setRoomName(data.name);
      setRoomWidth(data.width);
      setRoomHeight(data.height);
      setCriteria((c) => ({ ...c, exportImport: true }));
      forceUpdate((n) => n + 1);
      const engine = engineRef.current;
      if (engine) {
        const camera = engine.getCamera();
        camera.bounds = { x: 0, y: 0, width: data.width, height: data.height };
        camera.snapTo({ x: data.width / 2, y: data.height / 2 });
      }
    } catch {
      alert("Invalid JSON");
    }
  }, []);

  const handleLoadPreset = useCallback((presetId: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const preset = PRESET_ROOMS[presetId];
    if (!preset) return;
    editor.importRoom(preset);
    setRoomName(preset.name);
    setRoomWidth(preset.width);
    setRoomHeight(preset.height);
    setCriteria((c) => ({ ...c, presetRoomsLoad: true }));
    forceUpdate((n) => n + 1);
    const engine = engineRef.current;
    if (engine) {
      const camera = engine.getCamera();
      camera.bounds = { x: 0, y: 0, width: preset.width, height: preset.height };
      camera.snapTo({ x: preset.defaultSpawn.x, y: preset.defaultSpawn.y });
    }
  }, []);

  const handleNewRoom = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.newRoom(roomWidth, roomHeight, "default");
    editor.room.name = roomName;
    forceUpdate((n) => n + 1);
    const engine = engineRef.current;
    if (engine) {
      const camera = engine.getCamera();
      camera.bounds = { x: 0, y: 0, width: roomWidth, height: roomHeight };
      camera.snapTo({ x: roomWidth / 2, y: roomHeight / 2 });
    }
  }, [roomWidth, roomHeight, roomName]);

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-zinc-950 text-white">
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-zinc-800 bg-zinc-900 px-4 py-2">
          <Link href="/test" className="text-xs text-zinc-500 hover:text-zinc-300">
            ← Tests
          </Link>
          <h1 className="font-mono text-sm font-bold text-amber-500">Room Editor</h1>
          <span className="text-xs text-zinc-500">
            {playMode ? "PLAY MODE (P to exit)" : "EDIT MODE (P to play)"}
          </span>
          <span className="ml-auto text-xs text-zinc-600">
            Middle-click to pan
          </span>
        </div>

        {/* Canvas */}
        <div className="flex flex-1 items-center justify-center bg-zinc-950 p-4">
          <GameCanvas onMount={handleMount} onUnmount={handleUnmount} />
        </div>

        {/* Pass Criteria */}
        <div className="border-t border-zinc-800 bg-zinc-900 px-4 py-2">
          <div className="flex flex-wrap gap-3 text-xs font-mono">
            {Object.entries(criteria).map(([key, val]) => (
              <span key={key} className={val ? "text-green-400" : "text-zinc-600"}>
                {val ? "✓" : "○"} {formatCriteriaName(key)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Debug Panel */}
      <DebugPanel title="Room Editor">
        {!playMode ? (
          <>
            <Section title="Tools">
              <div className="flex flex-wrap gap-1">
                {TOOL_LIST.map(({ tool, label }) => (
                  <button
                    key={tool}
                    onClick={() => setActiveTool(tool)}
                    className={`rounded px-2 py-1 text-xs font-mono ${
                      activeTool === tool
                        ? "bg-amber-500 text-black"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Tool Options">
              {activeTool === "platform" && (
                <SelectInput label="Surface" value={surfaceType} options={SURFACE_TYPES} onChange={(v) => setSurfaceType(v as SurfaceType)} />
              )}
              {activeTool === "obstacle" && (
                <SelectInput label="Obstacle" value={obstacleType} options={OBSTACLE_TYPES} onChange={(v) => setObstacleType(v as ObstacleType)} />
              )}
              {activeTool === "enemy" && (
                <SelectInput label="Enemy" value={enemyType} options={ENEMY_TYPES} onChange={(v) => setEnemyType(v as "reader" | "binder" | "proofwarden")} />
              )}
              {activeTool === "gate" && (
                <SelectInput label="Ability" value={gateAbility} options={GATE_ABILITIES} onChange={(v) => setGateAbility(v as GateAbility)} />
              )}
            </Section>

            <Section title="Grid">
              <div className="flex items-center gap-2">
                <label className="text-xs font-mono text-zinc-400">Show</label>
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                  className="accent-amber-500"
                />
              </div>
              <Slider label="Grid Size" value={gridSize} min={8} max={64} step={8} onChange={setGridSize} />
            </Section>

            <Section title="Room">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-zinc-400">Name</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => {
                    setRoomName(e.target.value);
                    if (editorRef.current) editorRef.current.room.name = e.target.value;
                  }}
                  className="rounded bg-zinc-800 px-2 py-1 text-xs text-white"
                />
              </div>
              <Slider label="Width" value={roomWidth} min={480} max={3840} step={32} onChange={(v) => {
                setRoomWidth(v);
                const editor = editorRef.current;
                if (editor) {
                  editor.room.width = v;
                  const engine = engineRef.current;
                  if (engine) {
                    engine.getCamera().bounds = { x: 0, y: 0, width: v, height: editor.room.height };
                  }
                }
              }} />
              <Slider label="Height" value={roomHeight} min={540} max={2160} step={32} onChange={(v) => {
                setRoomHeight(v);
                const editor = editorRef.current;
                if (editor) {
                  editor.room.height = v;
                  const engine = engineRef.current;
                  if (engine) {
                    engine.getCamera().bounds = { x: 0, y: 0, width: editor.room.width, height: v };
                  }
                }
              }} />
            </Section>

            <Section title="Controls">
              <div className="flex flex-col gap-1">
                <button onClick={handleNewRoom} className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700">New Room</button>
                <button onClick={handleExport} className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700">Export JSON</button>
                <button onClick={handleImport} className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700">Import JSON</button>
                <button onClick={enterPlayMode} className="rounded bg-green-700 px-2 py-1 text-xs font-mono text-white hover:bg-green-600">▶ Play Test</button>
              </div>
            </Section>

            <Section title="Presets">
              <div className="flex flex-col gap-1">
                {Object.entries(PRESET_ROOM_NAMES).map(([id, name]) => (
                  <button
                    key={id}
                    onClick={() => handleLoadPreset(id)}
                    className="rounded bg-zinc-800 px-2 py-1 text-left text-xs font-mono text-zinc-300 hover:bg-zinc-700"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Stats">
              <div className="text-xs font-mono text-zinc-500 space-y-0.5">
                <div>Platforms: {editorRef.current?.room.platforms.length ?? 0}</div>
                <div>Obstacles: {editorRef.current?.room.obstacles.length ?? 0}</div>
                <div>Exits: {editorRef.current?.room.exits.length ?? 0}</div>
                <div>Gates: {editorRef.current?.room.gates.length ?? 0}</div>
                <div>Enemies: {editorRef.current?.room.enemies.length ?? 0}</div>
                <div>Vines: {editorRef.current?.room.vineAnchors.length ?? 0}</div>
              </div>
            </Section>
          </>
        ) : (
          <>
            <Section title="Play Mode">
              <div className="text-xs font-mono text-zinc-400 space-y-1">
                <div>Arrow keys / WASD: Move</div>
                <div>Space: Jump</div>
                <div>Shift: Dash</div>
                <div>P: Exit play mode</div>
                <div className="mt-2 text-amber-500">All abilities enabled for testing.</div>
                <div className="mt-1 text-zinc-500">Walk into exit zones to transition rooms.</div>
              </div>
              <button
                onClick={exitPlayMode}
                className="mt-2 rounded bg-red-800 px-2 py-1 text-xs font-mono text-white hover:bg-red-700"
              >
                ■ Exit Play Mode
              </button>
            </Section>
            <Section title="Room Info">
              <div className="text-xs font-mono text-zinc-500 space-y-0.5">
                <div>Room: {roomManagerRef.current?.currentRoom.name ?? "?"}</div>
                <div>Size: {roomManagerRef.current?.currentRoom.width ?? 0}×{roomManagerRef.current?.currentRoom.height ?? 0}</div>
                <div>Exits: {roomManagerRef.current?.currentRoom.exits.length ?? 0}</div>
                <div>Gates: {roomManagerRef.current?.currentGates.filter((g) => !g.opened).length ?? 0} locked</div>
              </div>
            </Section>
          </>
        )}
      </DebugPanel>
    </div>
  );
}

// ─── Small UI Components ────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-500">{title}</h3>
      {children}
    </div>
  );
}

function SelectInput({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (val: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-mono text-zinc-400 w-16">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 rounded bg-zinc-800 px-2 py-1 text-xs text-white">
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

function formatCriteriaName(key: string): string {
  return key.replace(/([A-Z])/g, " $1").trim();
}

function surfaceColorToFill(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const factor = 0.3;
  return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
}
