// Room — serializable room data model for the room system
// Rooms are containers for all level elements: platforms, obstacles, gates, enemies, vines, exits

import type { Rect, Vec2 } from "@/lib/types";
import type { SurfaceType } from "@/engine/physics/Surfaces";
import type { ObstacleType } from "@/engine/physics/Obstacles";

/** Unique room identifier */
export type RoomId = string;

/** Direction the player can exit a room */
export type ExitDirection = "left" | "right" | "top" | "bottom";

/** Which ability is needed to pass through a gate */
export type GateAbility =
  | "margin-stitch"
  | "redaction"
  | "paste-over"
  | "index-mark";

/** Serializable platform definition */
export interface RoomPlatform {
  x: number;
  y: number;
  width: number;
  height: number;
  surfaceType?: SurfaceType;
}

/** Serializable obstacle definition */
export interface RoomObstacle {
  id: string;
  rect: Rect;
  type: ObstacleType;
  damage: number;
  solid: boolean;
}

/** A connection from this room to another room */
export interface RoomExit {
  /** Which edge of this room the exit is on */
  direction: ExitDirection;
  /** The zone where the player triggers the exit (relative to room origin) */
  zone: Rect;
  /** The room this exit leads to */
  targetRoomId: RoomId;
  /** Where the player spawns in the target room (relative to target room origin) */
  targetSpawnPoint: Vec2;
}

/** An ability gate — a barrier that requires a specific ability to pass */
export interface AbilityGate {
  id: string;
  /** Gate position and size */
  rect: Rect;
  /** Which ability is needed */
  requiredAbility: GateAbility;
  /** Visual color when locked */
  lockedColor: string;
  /** Whether the gate has been opened (persists within session) */
  opened: boolean;
}

/** Ability pickup — a pedestal where the player first unlocks an ability */
export interface AbilityPickup {
  /** Which ability this pedestal grants */
  ability: GateAbility;
  /** World-space position of the pedestal visual center */
  position: Vec2;
  /** Trigger zone — player overlapping this rect unlocks the ability */
  zone: Rect;
}

/** Enemy spawn point */
export interface EnemySpawn {
  id: string;
  position: Vec2;
  type: "reader" | "binder" | "proofwarden" | "boss";
  /** Boss identifier (e.g. "footnote-giant") — only used when type is "boss" */
  bossId?: string;
  /** Patrol range for Reader, firing range for Binder, etc. */
  patrolRange?: number;
  /** Ground Y for simple enemy physics */
  groundY: number;
  /** Which direction the enemy faces initially */
  facingRight: boolean;
}

/** Vine anchor placement */
export interface RoomVineAnchor {
  id: string;
  position: Vec2;
  ropeLength: number;
  type: "hanging" | "ceiling" | "branch";
}

/** Complete room definition — everything needed to instantiate a room */
export interface RoomData {
  /** Unique room identifier */
  id: RoomId;
  /** Display name */
  name: string;
  /** Room dimensions (width × height in pixels) */
  width: number;
  height: number;
  /** Biome theme ID (references BiomeTheme.id) */
  biomeId: string;
  /** Player spawn point when entering this room for the first time */
  defaultSpawn: Vec2;
  /** All platforms in this room */
  platforms: RoomPlatform[];
  /** All obstacles */
  obstacles: RoomObstacle[];
  /** Exits to other rooms */
  exits: RoomExit[];
  /** Ability gates */
  gates: AbilityGate[];
  /** Enemy spawns */
  enemies: EnemySpawn[];
  /** Vine anchors (Herbarium Folio biome) */
  vineAnchors: RoomVineAnchor[];
  /** Optional ability pickup — shrine pedestal */
  abilityPickup?: AbilityPickup;
  /** Optional boss gate — a platform that blocks progress until a boss is defeated */
  bossGate?: {
    bossId: string;
    platformRect: Rect;
  };
}

// ─── Constants ──────────────────────────────────────────────────────

export const DEFAULT_ROOM_WIDTH = 960;
export const DEFAULT_ROOM_HEIGHT = 540;
export const MIN_ROOM_WIDTH = 480;
export const MAX_ROOM_WIDTH = 3840;
export const MIN_ROOM_HEIGHT = 540;
export const MAX_ROOM_HEIGHT = 2160;

export const DEFAULT_GRID_SIZE = 32;
export const GRID_SIZES = [8, 16, 32, 64] as const;
export const GRID_LINE_COLOR = "rgba(255, 255, 255, 0.06)";
export const GRID_MAJOR_COLOR = "rgba(255, 255, 255, 0.12)";
export const GRID_MAJOR_INTERVAL = 4;

export const TRANSITION_FADE_DURATION = 0.3;
export const TRANSITION_TOTAL_DURATION = 0.7;

export const EXIT_ZONE_DEPTH = 16;
export const EXIT_INDICATOR_SIZE = 12;
export const EXIT_INDICATOR_COLOR = "rgba(255, 255, 255, 0.4)";

export const GATE_COLORS: Record<GateAbility, string> = {
  "margin-stitch": "#22d3ee",
  redaction: "#ef4444",
  "paste-over": "#f59e0b",
  "index-mark": "#a78bfa",
};
export const GATE_WIDTH = 16;
export const GATE_HEIGHT = 96;
export const GATE_PULSE_SPEED = 2;
export const GATE_PULSE_ALPHA_MIN = 0.3;
export const GATE_PULSE_ALPHA_MAX = 0.7;

export const SELECTION_COLOR = "#22d3ee";
export const SELECTION_LINE_WIDTH = 2;
export const DRAG_PREVIEW_ALPHA = 0.4;
export const MIN_PLATFORM_SIZE = 16;

// ─── Helpers ────────────────────────────────────────────────────────

let roomElementId = 0;

export function nextRoomElementId(prefix: string): string {
  return `${prefix}_${++roomElementId}`;
}

export function resetRoomElementId(): void {
  roomElementId = 0;
}

/** Create an empty room with default values */
export function createEmptyRoom(
  width: number = DEFAULT_ROOM_WIDTH,
  height: number = DEFAULT_ROOM_HEIGHT,
  biomeId: string = "default",
): RoomData {
  return {
    id: nextRoomElementId("room"),
    name: "New Room",
    width,
    height,
    biomeId,
    defaultSpawn: { x: 64, y: height - 96 },
    platforms: [
      // Default floor
      { x: 0, y: height - 32, width, height: 32 },
    ],
    obstacles: [],
    exits: [],
    gates: [],
    enemies: [],
    vineAnchors: [],
  };
}
