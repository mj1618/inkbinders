// RoomEditor — interactive room editor with tools, grid, selection, import/export

import type { Vec2, Rect } from "@/lib/types";
import type { Camera } from "@/engine/core/Camera";
import type { SurfaceType } from "@/engine/physics/Surfaces";
import type { ObstacleType } from "@/engine/physics/Obstacles";
import type {
  RoomData,
  RoomPlatform,
  RoomObstacle,
  RoomExit,
  AbilityGate,
  EnemySpawn,
  RoomVineAnchor,
  ExitDirection,
  GateAbility,
} from "./Room";
import {
  DEFAULT_GRID_SIZE,
  GRID_LINE_COLOR,
  GRID_MAJOR_COLOR,
  GRID_MAJOR_INTERVAL,
  SELECTION_COLOR,
  SELECTION_LINE_WIDTH,
  DRAG_PREVIEW_ALPHA,
  MIN_PLATFORM_SIZE,
  GATE_COLORS,
  GATE_WIDTH,
  GATE_HEIGHT,
  EXIT_ZONE_DEPTH,
  createEmptyRoom,
  nextRoomElementId,
} from "./Room";

// ─── Types ──────────────────────────────────────────────────────────

export type EditorTool =
  | "select"
  | "platform"
  | "obstacle"
  | "exit"
  | "gate"
  | "enemy"
  | "vine"
  | "spawn"
  | "erase";

/** Identifies an element in the room for selection */
export interface SelectedElement {
  type: "platform" | "obstacle" | "exit" | "gate" | "enemy" | "vine" | "spawn";
  index: number;
}

export interface EditorState {
  activeTool: EditorTool;
  selectedElement: SelectedElement | null;
  gridSize: number;
  showGrid: boolean;
  obstacleSubtype: ObstacleType;
  surfaceSubtype: SurfaceType;
  enemySubtype: "reader" | "binder" | "proofwarden";
  gateAbility: GateAbility;
  dragging: boolean;
  dragStart: Vec2 | null;
  dragCurrent: Vec2 | null;
  /** For the select tool: offset from element origin to drag start */
  dragOffset: Vec2 | null;
  /** Camera panning state */
  panning: boolean;
  panStart: Vec2 | null;
  panCameraStart: Vec2 | null;
}

export class RoomEditor {
  state: EditorState;
  room: RoomData;

  constructor(room?: RoomData) {
    this.room = room ?? createEmptyRoom();
    this.state = {
      activeTool: "select",
      selectedElement: null,
      gridSize: DEFAULT_GRID_SIZE,
      showGrid: true,
      obstacleSubtype: "spikes",
      surfaceSubtype: "normal",
      enemySubtype: "reader",
      gateAbility: "margin-stitch",
      dragging: false,
      dragStart: null,
      dragCurrent: null,
      dragOffset: null,
      panning: false,
      panStart: null,
      panCameraStart: null,
    };
  }

  // ─── Coordinate Conversion ──────────────────────────────────────

  screenToWorld(screenX: number, screenY: number, camera: Camera): Vec2 {
    return camera.screenToWorld({ x: screenX, y: screenY });
  }

  snapToGrid(pos: Vec2): Vec2 {
    if (this.state.gridSize <= 0) return pos;
    return {
      x: Math.round(pos.x / this.state.gridSize) * this.state.gridSize,
      y: Math.round(pos.y / this.state.gridSize) * this.state.gridSize,
    };
  }

  // ─── Mouse Handlers ─────────────────────────────────────────────

  onMouseDown(worldPos: Vec2, button: number, camera: Camera): void {
    // Middle mouse button or left button + space = pan
    if (button === 1) {
      this.state.panning = true;
      this.state.panStart = { ...worldPos };
      this.state.panCameraStart = { ...camera.position };
      return;
    }

    const snapped = this.snapToGrid(worldPos);

    switch (this.state.activeTool) {
      case "select":
        this.handleSelectDown(worldPos, snapped);
        break;
      case "platform":
        this.state.dragging = true;
        this.state.dragStart = { ...snapped };
        this.state.dragCurrent = { ...snapped };
        break;
      case "obstacle":
        this.placeObstacle(snapped);
        break;
      case "exit":
        this.state.dragging = true;
        this.state.dragStart = { ...snapped };
        this.state.dragCurrent = { ...snapped };
        break;
      case "gate":
        this.placeGate(snapped);
        break;
      case "enemy":
        this.placeEnemy(snapped);
        break;
      case "vine":
        this.placeVine(snapped);
        break;
      case "spawn":
        this.room.defaultSpawn = { ...snapped };
        break;
      case "erase":
        this.eraseAt(worldPos);
        break;
    }
  }

  onMouseMove(worldPos: Vec2, camera: Camera, screenDelta?: Vec2): void {
    // Handle panning
    if (this.state.panning && this.state.panStart && this.state.panCameraStart && screenDelta) {
      camera.position.x = this.state.panCameraStart.x - screenDelta.x;
      camera.position.y = this.state.panCameraStart.y - screenDelta.y;
      return;
    }

    const snapped = this.snapToGrid(worldPos);

    if (this.state.activeTool === "select" && this.state.dragging && this.state.selectedElement && this.state.dragOffset) {
      this.moveSelected(snapped);
      return;
    }

    if (this.state.dragging) {
      this.state.dragCurrent = { ...snapped };
    }
  }

  onMouseUp(worldPos: Vec2): void {
    if (this.state.panning) {
      this.state.panning = false;
      this.state.panStart = null;
      this.state.panCameraStart = null;
      return;
    }

    const snapped = this.snapToGrid(worldPos);

    if (this.state.activeTool === "platform" && this.state.dragging && this.state.dragStart) {
      this.finalizePlatform(this.state.dragStart, snapped);
    } else if (this.state.activeTool === "exit" && this.state.dragging && this.state.dragStart) {
      this.finalizeExit(this.state.dragStart, snapped);
    }

    this.state.dragging = false;
    this.state.dragStart = null;
    this.state.dragCurrent = null;
    this.state.dragOffset = null;
  }

  onKeyDown(key: string): void {
    switch (key) {
      case "g":
      case "G":
        this.state.showGrid = !this.state.showGrid;
        break;
      case "Delete":
      case "Backspace":
        this.deleteSelected();
        break;
      case "Escape":
        this.state.selectedElement = null;
        this.state.dragging = false;
        break;
    }
  }

  // ─── Selection ──────────────────────────────────────────────────

  private handleSelectDown(worldPos: Vec2, snapped: Vec2): void {
    const hit = this.hitTest(worldPos);
    if (hit) {
      this.state.selectedElement = hit;
      this.state.dragging = true;
      // Calculate offset from element origin to click position
      const rect = this.getElementRect(hit);
      if (rect) {
        this.state.dragOffset = {
          x: snapped.x - rect.x,
          y: snapped.y - rect.y,
        };
      }
    } else {
      this.state.selectedElement = null;
    }
  }

  private hitTest(worldPos: Vec2): SelectedElement | null {
    // Test in reverse render order so topmost element is selected first

    // Spawn point (8px radius)
    const sp = this.room.defaultSpawn;
    if (Math.abs(worldPos.x - sp.x) < 12 && Math.abs(worldPos.y - sp.y) < 12) {
      return { type: "spawn", index: 0 };
    }

    // Enemies
    for (let i = this.room.enemies.length - 1; i >= 0; i--) {
      const e = this.room.enemies[i];
      if (Math.abs(worldPos.x - e.position.x) < 16 && Math.abs(worldPos.y - e.position.y) < 16) {
        return { type: "enemy", index: i };
      }
    }

    // Vine anchors
    for (let i = this.room.vineAnchors.length - 1; i >= 0; i--) {
      const v = this.room.vineAnchors[i];
      if (Math.abs(worldPos.x - v.position.x) < 12 && Math.abs(worldPos.y - v.position.y) < 12) {
        return { type: "vine", index: i };
      }
    }

    // Gates
    for (let i = this.room.gates.length - 1; i >= 0; i--) {
      const g = this.room.gates[i];
      if (pointInRect(worldPos, g.rect)) {
        return { type: "gate", index: i };
      }
    }

    // Exits
    for (let i = this.room.exits.length - 1; i >= 0; i--) {
      const e = this.room.exits[i];
      if (pointInRect(worldPos, e.zone)) {
        return { type: "exit", index: i };
      }
    }

    // Obstacles
    for (let i = this.room.obstacles.length - 1; i >= 0; i--) {
      const o = this.room.obstacles[i];
      if (pointInRect(worldPos, o.rect)) {
        return { type: "obstacle", index: i };
      }
    }

    // Platforms
    for (let i = this.room.platforms.length - 1; i >= 0; i--) {
      const p = this.room.platforms[i];
      if (pointInRect(worldPos, p)) {
        return { type: "platform", index: i };
      }
    }

    return null;
  }

  private getElementRect(el: SelectedElement): Rect | null {
    switch (el.type) {
      case "platform": {
        const p = this.room.platforms[el.index];
        return p ? { x: p.x, y: p.y, width: p.width, height: p.height } : null;
      }
      case "obstacle":
        return this.room.obstacles[el.index]?.rect ?? null;
      case "exit":
        return this.room.exits[el.index]?.zone ?? null;
      case "gate":
        return this.room.gates[el.index]?.rect ?? null;
      case "enemy": {
        const e = this.room.enemies[el.index];
        return e ? { x: e.position.x - 8, y: e.position.y - 16, width: 16, height: 16 } : null;
      }
      case "vine": {
        const v = this.room.vineAnchors[el.index];
        return v ? { x: v.position.x - 4, y: v.position.y - 4, width: 8, height: 8 } : null;
      }
      case "spawn":
        return {
          x: this.room.defaultSpawn.x - 8,
          y: this.room.defaultSpawn.y - 8,
          width: 16,
          height: 16,
        };
    }
  }

  private moveSelected(snappedPos: Vec2): void {
    const el = this.state.selectedElement;
    if (!el || !this.state.dragOffset) return;

    const newX = snappedPos.x - this.state.dragOffset.x;
    const newY = snappedPos.y - this.state.dragOffset.y;

    switch (el.type) {
      case "platform": {
        const p = this.room.platforms[el.index];
        if (p) { p.x = newX; p.y = newY; }
        break;
      }
      case "obstacle": {
        const o = this.room.obstacles[el.index];
        if (o) { o.rect.x = newX; o.rect.y = newY; }
        break;
      }
      case "exit": {
        const e = this.room.exits[el.index];
        if (e) { e.zone.x = newX; e.zone.y = newY; }
        break;
      }
      case "gate": {
        const g = this.room.gates[el.index];
        if (g) { g.rect.x = newX; g.rect.y = newY; }
        break;
      }
      case "enemy": {
        const e = this.room.enemies[el.index];
        if (e) {
          e.position.x = snappedPos.x;
          e.position.y = snappedPos.y;
        }
        break;
      }
      case "vine": {
        const v = this.room.vineAnchors[el.index];
        if (v) {
          v.position.x = snappedPos.x;
          v.position.y = snappedPos.y;
        }
        break;
      }
      case "spawn":
        this.room.defaultSpawn.x = snappedPos.x;
        this.room.defaultSpawn.y = snappedPos.y;
        break;
    }
  }

  // ─── Placement Handlers ─────────────────────────────────────────

  private finalizePlatform(start: Vec2, end: Vec2): void {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);

    if (w < MIN_PLATFORM_SIZE || h < MIN_PLATFORM_SIZE) return;

    const platform: RoomPlatform = {
      x,
      y,
      width: w,
      height: h,
      surfaceType: this.state.surfaceSubtype === "normal" ? undefined : this.state.surfaceSubtype,
    };
    this.room.platforms.push(platform);
  }

  private placeObstacle(pos: Vec2): void {
    const sizeMap: Record<ObstacleType, { w: number; h: number }> = {
      spikes: { w: 32, h: 32 },
      barrier: { w: 32, h: 64 },
      laser: { w: 32, h: 8 },
      hazard_zone: { w: 64, h: 32 },
    };
    const size = sizeMap[this.state.obstacleSubtype];
    const obstacle: RoomObstacle = {
      id: nextRoomElementId("obs"),
      rect: { x: pos.x, y: pos.y - size.h, width: size.w, height: size.h },
      type: this.state.obstacleSubtype,
      damage: this.state.obstacleSubtype === "barrier" ? 0 : 10,
      solid: this.state.obstacleSubtype === "barrier",
    };
    this.room.obstacles.push(obstacle);
  }

  private finalizeExit(start: Vec2, end: Vec2): void {
    // Determine exit direction from position relative to room bounds
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;

    let direction: ExitDirection;
    const distLeft = midX;
    const distRight = this.room.width - midX;
    const distTop = midY;
    const distBottom = this.room.height - midY;
    const minDist = Math.min(distLeft, distRight, distTop, distBottom);

    if (minDist === distLeft) direction = "left";
    else if (minDist === distRight) direction = "right";
    else if (minDist === distTop) direction = "top";
    else direction = "bottom";

    // Create zone along the detected edge
    let zone: Rect;
    const spanStart = Math.min(start.y, end.y);
    const spanEnd = Math.max(start.y, end.y);
    const hSpanStart = Math.min(start.x, end.x);
    const hSpanEnd = Math.max(start.x, end.x);
    const span = Math.max(32, spanEnd - spanStart);
    const hSpan = Math.max(32, hSpanEnd - hSpanStart);

    switch (direction) {
      case "left":
        zone = { x: 0, y: spanStart, width: EXIT_ZONE_DEPTH, height: span };
        break;
      case "right":
        zone = { x: this.room.width - EXIT_ZONE_DEPTH, y: spanStart, width: EXIT_ZONE_DEPTH, height: span };
        break;
      case "top":
        zone = { x: hSpanStart, y: 0, width: hSpan, height: EXIT_ZONE_DEPTH };
        break;
      case "bottom":
        zone = { x: hSpanStart, y: this.room.height - EXIT_ZONE_DEPTH, width: hSpan, height: EXIT_ZONE_DEPTH };
        break;
    }

    const exit: RoomExit = {
      direction,
      zone,
      targetRoomId: "",
      targetSpawnPoint: { x: 64, y: 64 },
    };
    this.room.exits.push(exit);
  }

  private placeGate(pos: Vec2): void {
    const gate: AbilityGate = {
      id: nextRoomElementId("gate"),
      rect: { x: pos.x, y: pos.y - GATE_HEIGHT, width: GATE_WIDTH, height: GATE_HEIGHT },
      requiredAbility: this.state.gateAbility,
      lockedColor: GATE_COLORS[this.state.gateAbility],
      opened: false,
    };
    this.room.gates.push(gate);
  }

  private placeEnemy(pos: Vec2): void {
    const enemy: EnemySpawn = {
      id: nextRoomElementId("enemy"),
      position: { ...pos },
      type: this.state.enemySubtype,
      patrolRange: 100,
      groundY: pos.y,
      facingRight: true,
    };
    this.room.enemies.push(enemy);
  }

  private placeVine(pos: Vec2): void {
    const vine: RoomVineAnchor = {
      id: nextRoomElementId("vine"),
      position: { ...pos },
      ropeLength: 120,
      type: "hanging",
    };
    this.room.vineAnchors.push(vine);
  }

  private eraseAt(worldPos: Vec2): void {
    const hit = this.hitTest(worldPos);
    if (!hit) return;
    this.deleteElement(hit);
  }

  // ─── Delete ─────────────────────────────────────────────────────

  deleteSelected(): void {
    if (!this.state.selectedElement) return;
    this.deleteElement(this.state.selectedElement);
    this.state.selectedElement = null;
  }

  private deleteElement(el: SelectedElement): void {
    switch (el.type) {
      case "platform":
        this.room.platforms.splice(el.index, 1);
        break;
      case "obstacle":
        this.room.obstacles.splice(el.index, 1);
        break;
      case "exit":
        this.room.exits.splice(el.index, 1);
        break;
      case "gate":
        this.room.gates.splice(el.index, 1);
        break;
      case "enemy":
        this.room.enemies.splice(el.index, 1);
        break;
      case "vine":
        this.room.vineAnchors.splice(el.index, 1);
        break;
      case "spawn":
        // Can't delete spawn — just reset it
        this.room.defaultSpawn = { x: 64, y: this.room.height - 96 };
        break;
    }
  }

  // ─── Import/Export ──────────────────────────────────────────────

  exportRoom(): RoomData {
    return JSON.parse(JSON.stringify(this.room));
  }

  importRoom(data: RoomData): void {
    this.room = JSON.parse(JSON.stringify(data));
    this.state.selectedElement = null;
  }

  newRoom(width: number, height: number, biomeId: string): void {
    this.room = createEmptyRoom(width, height, biomeId);
    this.state.selectedElement = null;
  }

  // ─── Rendering ──────────────────────────────────────────────────

  renderEditor(ctx: CanvasRenderingContext2D, camera: Camera): void {
    // Grid
    if (this.state.showGrid) {
      this.renderGrid(ctx, camera);
    }

    // Selection highlight
    if (this.state.selectedElement) {
      const rect = this.getElementRect(this.state.selectedElement);
      if (rect) {
        ctx.strokeStyle = SELECTION_COLOR;
        ctx.lineWidth = SELECTION_LINE_WIDTH;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(rect.x - 2, rect.y - 2, rect.width + 4, rect.height + 4);
        ctx.setLineDash([]);
      }
    }

    // Drag preview
    if (this.state.dragging && this.state.dragStart && this.state.dragCurrent) {
      if (this.state.activeTool === "platform" || this.state.activeTool === "exit") {
        const x = Math.min(this.state.dragStart.x, this.state.dragCurrent.x);
        const y = Math.min(this.state.dragStart.y, this.state.dragCurrent.y);
        const w = Math.abs(this.state.dragCurrent.x - this.state.dragStart.x);
        const h = Math.abs(this.state.dragCurrent.y - this.state.dragStart.y);

        ctx.globalAlpha = DRAG_PREVIEW_ALPHA;
        ctx.fillStyle = this.state.activeTool === "platform" ? "#4ade80" : "#60a5fa";
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = this.state.activeTool === "platform" ? "#4ade80" : "#60a5fa";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
      }
    }
  }

  private renderGrid(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const gs = this.state.gridSize;
    if (gs <= 0) return;

    const viewport = camera.getViewportBounds();
    const startX = Math.floor(viewport.x / gs) * gs;
    const startY = Math.floor(viewport.y / gs) * gs;
    const endX = viewport.x + viewport.width;
    const endY = viewport.y + viewport.height;

    // Clamp to room bounds
    const minX = Math.max(0, startX);
    const minY = Math.max(0, startY);
    const maxX = Math.min(this.room.width, endX);
    const maxY = Math.min(this.room.height, endY);

    ctx.lineWidth = 0.5;

    for (let x = minX; x <= maxX; x += gs) {
      const isMajor = (x / gs) % GRID_MAJOR_INTERVAL === 0;
      ctx.strokeStyle = isMajor ? GRID_MAJOR_COLOR : GRID_LINE_COLOR;
      ctx.beginPath();
      ctx.moveTo(x, minY);
      ctx.lineTo(x, maxY);
      ctx.stroke();
    }

    for (let y = minY; y <= maxY; y += gs) {
      const isMajor = (y / gs) % GRID_MAJOR_INTERVAL === 0;
      ctx.strokeStyle = isMajor ? GRID_MAJOR_COLOR : GRID_LINE_COLOR;
      ctx.beginPath();
      ctx.moveTo(minX, y);
      ctx.lineTo(maxX, y);
      ctx.stroke();
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

function pointInRect(point: Vec2, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}
