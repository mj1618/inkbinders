// RoomManager — runtime room loading, exit detection, transitions

import type { Rect } from "@/lib/types";
import { TileMap } from "@/engine/physics/TileMap";
import type { Platform } from "@/engine/physics/TileMap";
import type { Obstacle } from "@/engine/physics/Obstacles";
import {
  createSpikes,
  createBarrier,
  createLaser,
  createHazardZone,
} from "@/engine/physics/Obstacles";
import type { VineAnchor } from "./VineSystem";
import { aabbOverlap } from "@/engine/physics/AABB";
import type {
  RoomData,
  RoomId,
  RoomExit,
  AbilityGate,
  EnemySpawn,
  ExitDirection,
  GateAbility,
} from "./Room";
import {
  TRANSITION_FADE_DURATION,
  TRANSITION_TOTAL_DURATION,
  GATE_COLORS,
} from "./Room";

export interface RoomManagerConfig {
  rooms: Map<RoomId, RoomData>;
  startingRoomId: RoomId;
}

export class RoomManager {
  /** All rooms in the world */
  private rooms: Map<RoomId, RoomData>;
  /** The currently active room */
  currentRoom: RoomData;
  /** The TileMap built from the current room's platforms */
  currentTileMap: TileMap;
  /** Active obstacles in the current room */
  currentObstacles: Obstacle[] = [];
  /** Active ability gates */
  currentGates: AbilityGate[] = [];
  /** Active enemy spawns */
  currentEnemies: EnemySpawn[] = [];
  /** Active vine anchors */
  currentVineAnchors: VineAnchor[] = [];
  /** Gate platforms added to TileMap for locked gates */
  private gatePlatforms: Map<string, Platform> = new Map();

  /** Transition state */
  transitioning = false;
  transitionProgress = 0;
  transitionDirection: ExitDirection | null = null;
  private transitionTarget: RoomExit | null = null;
  /** Set of opened gate IDs (persists across room transitions within session) */
  private openedGates: Set<string> = new Set();

  constructor(config: RoomManagerConfig) {
    this.rooms = config.rooms;
    const startRoom = this.rooms.get(config.startingRoomId);
    if (!startRoom) {
      throw new Error(`Starting room "${config.startingRoomId}" not found`);
    }
    this.currentRoom = startRoom;
    this.currentTileMap = new TileMap([]);
    this.loadRoom(config.startingRoomId);
  }

  /** Load a room by ID — builds TileMap, obstacles, gates from RoomData */
  loadRoom(roomId: RoomId): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room "${roomId}" not found`);
    }
    this.currentRoom = room;

    // Build platforms
    const platforms: Platform[] = room.platforms.map((p) => ({
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
      surfaceType: p.surfaceType,
    }));

    // Build gate platforms for locked gates
    this.gatePlatforms.clear();
    this.currentGates = room.gates.map((g) => ({
      ...g,
      lockedColor: GATE_COLORS[g.requiredAbility] ?? g.lockedColor,
      opened: this.openedGates.has(g.id),
    }));

    for (const gate of this.currentGates) {
      if (!gate.opened) {
        const gatePlat: Platform = {
          x: gate.rect.x,
          y: gate.rect.y,
          width: gate.rect.width,
          height: gate.rect.height,
        };
        platforms.push(gatePlat);
        this.gatePlatforms.set(gate.id, gatePlat);
      }
    }

    this.currentTileMap = new TileMap(platforms);

    // Build obstacles
    this.currentObstacles = room.obstacles.map((o) => {
      switch (o.type) {
        case "spikes":
          return createSpikes(o.rect, o.damage);
        case "barrier":
          return createBarrier(o.rect);
        case "laser":
          return createLaser(o.rect, o.damage);
        case "hazard_zone":
          return createHazardZone(o.rect, o.damage);
      }
    });

    // Copy enemy spawns
    this.currentEnemies = [...room.enemies];

    // Build vine anchors
    this.currentVineAnchors = room.vineAnchors.map((v) => ({
      id: v.id,
      position: { ...v.position },
      ropeLength: v.ropeLength,
      active: true,
      type: v.type,
    }));
  }

  /** Check if the player is overlapping any exit zone */
  checkExits(playerRect: Rect): RoomExit | null {
    if (this.transitioning) return null;
    for (const exit of this.currentRoom.exits) {
      if (aabbOverlap(playerRect, exit.zone)) {
        return exit;
      }
    }
    return null;
  }

  /** Initiate a room transition (fade-out → load → fade-in) */
  startTransition(exit: RoomExit): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.transitionProgress = 0;
    this.transitionDirection = exit.direction;
    this.transitionTarget = exit;
  }

  /**
   * Update transition animation.
   * Returns the spawn point when the room swap happens (at the midpoint), otherwise null.
   */
  updateTransition(dt: number): { roomId: RoomId; spawnX: number; spawnY: number } | null {
    if (!this.transitioning || !this.transitionTarget) return null;

    this.transitionProgress += dt / TRANSITION_TOTAL_DURATION;

    // At the midpoint, swap rooms
    const swapPoint = TRANSITION_FADE_DURATION / TRANSITION_TOTAL_DURATION;
    const prevProgress = this.transitionProgress - dt / TRANSITION_TOTAL_DURATION;

    let result: { roomId: RoomId; spawnX: number; spawnY: number } | null = null;

    if (prevProgress < swapPoint && this.transitionProgress >= swapPoint) {
      const target = this.transitionTarget;
      this.loadRoom(target.targetRoomId);
      result = {
        roomId: target.targetRoomId,
        spawnX: target.targetSpawnPoint.x,
        spawnY: target.targetSpawnPoint.y,
      };
    }

    // Transition complete
    if (this.transitionProgress >= 1) {
      this.transitioning = false;
      this.transitionProgress = 0;
      this.transitionDirection = null;
      this.transitionTarget = null;
    }

    return result;
  }

  /** Check if player can pass through an ability gate */
  tryOpenGate(gate: AbilityGate, playerAbilities: Set<GateAbility>): boolean {
    if (gate.opened) return true;
    if (!playerAbilities.has(gate.requiredAbility)) return false;

    gate.opened = true;
    this.openedGates.add(gate.id);

    // Remove the gate platform from TileMap
    const gatePlat = this.gatePlatforms.get(gate.id);
    if (gatePlat) {
      const idx = this.currentTileMap.platforms.indexOf(gatePlat);
      if (idx !== -1) {
        this.currentTileMap.platforms.splice(idx, 1);
      }
      this.gatePlatforms.delete(gate.id);
    }

    return true;
  }

  /** Get the transition fade alpha (0 = transparent, 1 = fully black) */
  getTransitionAlpha(): number {
    if (!this.transitioning) return 0;
    const swapPoint = TRANSITION_FADE_DURATION / TRANSITION_TOTAL_DURATION;
    if (this.transitionProgress < swapPoint) {
      // Fading out
      return this.transitionProgress / swapPoint;
    }
    // Fading in
    return 1 - (this.transitionProgress - swapPoint) / (1 - swapPoint);
  }

  /** Get a room by its ID */
  getRoom(roomId: RoomId): RoomData | undefined {
    return this.rooms.get(roomId);
  }

  /** Get all room IDs */
  getRoomIds(): RoomId[] {
    return Array.from(this.rooms.keys());
  }
}
