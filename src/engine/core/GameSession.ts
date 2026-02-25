// GameSession — runtime orchestrator for an active game session.
// Pure TypeScript, no React dependencies.
// Owns game progression state and produces save snapshots.

import {
  SaveSystem,
  type GameSaveData,
  type LoadedGameState,
} from "@/engine/save/SaveSystem";
import type { PlayerParams } from "@/engine/entities/Player";

// ─── Constants ──────────────────────────────────────────────────────

/** Starting room for new games */
const DEFAULT_STARTING_ROOM = "tutorial-corridor";
const DEFAULT_STARTING_ROOM_NAME = "Tutorial Corridor";

/** Starting health for new games */
const DEFAULT_HEALTH = 5;
const DEFAULT_MAX_HEALTH = 5;

/** Toggle this for development — when true, all abilities are unlocked from the start */
export const DEV_ALL_ABILITIES = true;

const ALL_ABILITIES = [
  "margin-stitch",
  "redaction",
  "paste-over",
  "index-mark",
];

// ─── Types ──────────────────────────────────────────────────────────

export interface GameSessionConfig {
  /** The save slot this session is using (1-3) */
  slot: number;
  /** Player name */
  playerName: string;
  /** Whether this is a new game or loaded from save */
  isNewGame: boolean;
  /** Loaded game state (null for new game) */
  loadedState: LoadedGameState | null;
  /** Base player params (optional override) */
  basePlayerParams?: PlayerParams;
}

export interface GameSessionState {
  slot: number;
  playerName: string;
  currentRoomId: string;
  currentRoomName: string;
  totalPlayTime: number;
  deathCount: number;
  unlockedAbilities: string[];
  openedGates: string[];
  defeatedBosses: string[];
  visitedRooms: string[];
  currentHealth: number;
  maxHealth: number;
  cardDeckData: { ownedCards: string[]; equippedCards: string[] } | null;
  completionPercent: number;
  paused: boolean;
}

// ─── GameSession Class ──────────────────────────────────────────────

export class GameSession {
  readonly config: GameSessionConfig;
  private sessionStartTime: number;
  private accumulatedPlayTime: number;

  // Progression state
  private unlockedAbilities: Set<string>;
  private openedGates: Set<string>;
  private defeatedBosses: Set<string>;
  private visitedRooms: Set<string>;

  // Health
  private currentHealth: number;
  private maxHealth: number;

  // Death count
  private deathCount: number;

  // Card state
  private cardDeckData: { ownedCards: string[]; equippedCards: string[] } | null;

  // Room
  private currentRoomId: string;
  private currentRoomName: string;

  // Pause state
  paused = false;

  constructor(config: GameSessionConfig) {
    this.config = config;
    this.sessionStartTime = Date.now();

    if (config.isNewGame || !config.loadedState) {
      // New game defaults
      this.accumulatedPlayTime = 0;
      this.currentRoomId = DEFAULT_STARTING_ROOM;
      this.currentRoomName = DEFAULT_STARTING_ROOM_NAME;
      this.unlockedAbilities = new Set(DEV_ALL_ABILITIES ? ALL_ABILITIES : []);
      this.openedGates = new Set();
      this.defeatedBosses = new Set();
      this.visitedRooms = new Set([DEFAULT_STARTING_ROOM]);
      this.currentHealth = DEFAULT_HEALTH;
      this.maxHealth = DEFAULT_MAX_HEALTH;
      this.deathCount = 0;
      this.cardDeckData = null;
    } else {
      // Loaded game
      const s = config.loadedState;
      this.accumulatedPlayTime = s.totalPlayTime;
      this.currentRoomId = s.currentRoomId || DEFAULT_STARTING_ROOM;
      this.currentRoomName = s.currentRoomName || DEFAULT_STARTING_ROOM_NAME;
      this.unlockedAbilities = new Set(s.unlockedAbilities);
      this.openedGates = new Set(s.openedGates);
      this.defeatedBosses = new Set(s.defeatedBosses);
      this.visitedRooms = new Set(s.visitedRooms);
      this.currentHealth = s.currentHealth;
      this.maxHealth = s.maxHealth;
      this.deathCount = s.deathCount;
      this.cardDeckData =
        s.ownedCards.length > 0 || s.equippedCards.length > 0
          ? { ownedCards: [...s.ownedCards], equippedCards: [...s.equippedCards] }
          : null;
    }
  }

  /** Get the starting room ID for this session */
  getStartingRoomId(): string {
    return this.currentRoomId;
  }

  /** Get current total play time (accumulated + session time) */
  getTotalPlayTime(): number {
    const sessionTime = (Date.now() - this.sessionStartTime) / 1000;
    return this.accumulatedPlayTime + sessionTime;
  }

  /** Update room info when transitioning */
  enterRoom(roomId: string, roomName: string): void {
    this.currentRoomId = roomId;
    this.currentRoomName = roomName;
    this.visitedRooms.add(roomId);
  }

  /** Unlock an ability */
  unlockAbility(ability: string): void {
    this.unlockedAbilities.add(ability);
  }

  /** Check if an ability is unlocked */
  hasAbility(ability: string): boolean {
    return this.unlockedAbilities.has(ability);
  }

  /** Get all unlocked abilities as a Set (for gate checking) */
  getUnlockedAbilities(): Set<string> {
    return new Set(this.unlockedAbilities);
  }

  /** Open a gate */
  openGate(gateId: string): void {
    this.openedGates.add(gateId);
  }

  /** Defeat a boss */
  defeatBoss(bossId: string): void {
    this.defeatedBosses.add(bossId);
  }

  /** Record a death */
  recordDeath(): void {
    this.deathCount++;
  }

  /** Update health */
  setHealth(current: number, max: number): void {
    this.currentHealth = current;
    this.maxHealth = max;
  }

  /** Get current session state (for UI display and save creation) */
  getState(): GameSessionState {
    return {
      slot: this.config.slot,
      playerName: this.config.playerName,
      currentRoomId: this.currentRoomId,
      currentRoomName: this.currentRoomName,
      totalPlayTime: this.getTotalPlayTime(),
      deathCount: this.deathCount,
      unlockedAbilities: Array.from(this.unlockedAbilities),
      openedGates: Array.from(this.openedGates),
      defeatedBosses: Array.from(this.defeatedBosses),
      visitedRooms: Array.from(this.visitedRooms),
      currentHealth: this.currentHealth,
      maxHealth: this.maxHealth,
      cardDeckData: this.cardDeckData,
      completionPercent: this.computeCompletionPercent(),
      paused: this.paused,
    };
  }

  /**
   * Create a save snapshot from current state.
   * Returns a GameSaveData ready to be persisted.
   */
  createSaveSnapshot(): GameSaveData {
    return SaveSystem.createSnapshot({
      slot: this.config.slot,
      playerName: this.config.playerName,
      totalPlayTime: this.getTotalPlayTime(),
      currentRoomId: this.currentRoomId,
      currentRoomName: this.currentRoomName,
      deathCount: this.deathCount,
      unlockedAbilities: Array.from(this.unlockedAbilities),
      openedGates: Array.from(this.openedGates),
      defeatedBosses: Array.from(this.defeatedBosses),
      visitedRooms: Array.from(this.visitedRooms),
      currentHealth: this.currentHealth,
      maxHealth: this.maxHealth,
      ownedCards: this.cardDeckData?.ownedCards ?? [],
      equippedCards: this.cardDeckData?.equippedCards ?? [],
    });
  }

  /** Toggle pause */
  togglePause(): void {
    this.paused = !this.paused;
  }

  private computeCompletionPercent(): number {
    const abilityPct = this.unlockedAbilities.size / 4;
    const bossPct = this.defeatedBosses.size / 4;
    const roomPct = Math.min(this.visitedRooms.size / 90, 1);
    return Math.round(abilityPct * 30 + bossPct * 40 + roomPct * 30);
  }
}
