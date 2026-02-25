// GameWorld — Top-level world orchestrator
// Owns RoomManager, DayNightCycle, PlayerProgression; coordinates global game state

import type { Rect } from "@/lib/types";
import type { RoomExit, RoomId, EnemySpawn } from "./Room";
import type { BiomeTheme } from "./Biome";
import { getBiomeTheme, DEFAULT_THEME } from "./Biome";
import { RoomManager } from "./RoomManager";
import { DayNightCycle } from "./DayNightCycle";
import type { DayNightParams } from "./DayNightCycle";
import type { DayNightAtmosphere } from "./DayNightAtmosphere";
import { PlayerProgression } from "./PlayerProgression";
import { WorldGraph } from "./WorldGraph";
import type { PlayerParams } from "@/engine/entities/Player";

export interface GameWorldConfig {
  worldGraph: WorldGraph;
  basePlayerParams?: Partial<PlayerParams>;
  dayNightParams?: Partial<DayNightParams>;
  allAbilitiesUnlocked?: boolean;
}

export interface WorldFrameState {
  timeOfDay: string;
  lightLevel: number;
  corruptionIntensity: number;
  atmosphereColors: DayNightAtmosphere;
  transitioning: boolean;
  transitionProgress: number;
  currentRoomId: RoomId;
  theme: BiomeTheme;
  isHub: boolean;
}

export interface RoomTransitionResult {
  roomId: RoomId;
  spawnX: number;
  spawnY: number;
}

export class GameWorld {
  readonly worldGraph: WorldGraph;
  readonly roomManager: RoomManager;
  readonly dayNight: DayNightCycle;
  readonly progression: PlayerProgression;

  currentTheme: BiomeTheme;
  private roomTransitionCb: ((result: RoomTransitionResult) => void) | null = null;

  constructor(config: GameWorldConfig) {
    this.worldGraph = config.worldGraph;

    this.roomManager = new RoomManager({
      rooms: config.worldGraph.rooms,
      startingRoomId: config.worldGraph.data.startingRoomId,
    });

    this.dayNight = new DayNightCycle(config.dayNightParams);

    this.progression = new PlayerProgression(
      config.worldGraph.data.startingRoomId,
    );

    if (config.allAbilitiesUnlocked) {
      this.progression.unlockAllAbilities();
    }

    // Mark starting room as visited
    this.progression.visitRoom(config.worldGraph.data.startingRoomId);

    // Set initial theme
    this.currentTheme = this.resolveTheme(config.worldGraph.data.startingRoomId);
  }

  update(dt: number, playerBounds: Rect): WorldFrameState {
    // Advance day/night
    this.dayNight.update(dt);

    // Track play time
    this.progression.updatePlayTime(dt);

    // Update room transition animation
    const transitionResult = this.roomManager.updateTransition(dt);
    if (transitionResult) {
      this.onRoomLoaded(transitionResult.roomId);
      this.roomTransitionCb?.(transitionResult);
    }

    // Check exit zones (only when not transitioning)
    if (!this.roomManager.transitioning) {
      const exit = this.roomManager.checkExits(playerBounds);
      if (exit) {
        this.transitionToRoom(exit);
      }
    }

    const isHub = this.worldGraph.isHub(this.roomManager.currentRoom.id);
    const corruptionIntensity = isHub ? 0 : this.dayNight.corruptionIntensity;

    return {
      timeOfDay: this.dayNight.timeOfDay,
      lightLevel: this.dayNight.lightLevel,
      corruptionIntensity,
      atmosphereColors: this.dayNight.getAtmosphere(),
      transitioning: this.roomManager.transitioning,
      transitionProgress: this.roomManager.transitionProgress,
      currentRoomId: this.roomManager.currentRoom.id,
      theme: this.currentTheme,
      isHub,
    };
  }

  transitionToRoom(exit: RoomExit): void {
    this.roomManager.startTransition(exit);
  }

  private onRoomLoaded(roomId: RoomId): void {
    this.progression.visitRoom(roomId);
    this.progression.data.currentRoomId = roomId;
    this.currentTheme = this.resolveTheme(roomId);

    // Sync opened gates into room manager
    for (const gate of this.roomManager.currentGates) {
      if (this.progression.isGateOpened(gate.id)) {
        gate.opened = true;
      }
    }
  }

  tryOpenGate(gateId: string): boolean {
    const gate = this.roomManager.currentGates.find((g) => g.id === gateId);
    if (!gate) return false;

    const opened = this.roomManager.tryOpenGate(
      gate,
      this.progression.getAbilitiesAsSet(),
    );
    if (opened) {
      this.progression.openGate(gateId);
    }
    return opened;
  }

  getCurrentTheme(): BiomeTheme {
    return this.currentTheme;
  }

  getActiveEnemySpawns(): EnemySpawn[] {
    return this.roomManager.currentEnemies;
  }

  defeatBoss(bossId: string): void {
    this.progression.defeatBoss(bossId);
  }

  isHubRoom(): boolean {
    return this.worldGraph.isHub(this.roomManager.currentRoom.id);
  }

  /** Register a callback fired when a room transition completes (room swapped, spawn point available). */
  onRoomTransition(cb: (result: RoomTransitionResult) => void): void {
    this.roomTransitionCb = cb;
  }

  private resolveTheme(roomId: RoomId): BiomeTheme {
    const biomeId = this.worldGraph.getBiomeId(roomId);
    return getBiomeTheme(biomeId) ?? DEFAULT_THEME;
  }
}
