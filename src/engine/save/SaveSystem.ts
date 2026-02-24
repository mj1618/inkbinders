// Pure TypeScript save system — no React or Convex imports.
// Produces serializable snapshots for the persistence layer.

/** Serializable snapshot of the full game state */
export interface GameSaveData {
  slot: number;
  playerName: string;
  totalPlayTime: number;
  currentRoomId: string;
  currentRoomName: string;
  completionPercent: number;
  deathCount: number;
  unlockedAbilities: string[];
  openedGates: string[];
  defeatedBosses: string[];
  visitedRooms: string[];
  currentHealth: number;
  maxHealth: number;
  ownedCards: string[];
  equippedCards: string[];
}

/** Save slot summary (for slot selection UI) */
export interface SaveSlotSummary {
  slot: number;
  playerName: string;
  lastSaved: string;
  totalPlayTime: number;
  currentRoomId: string;
  currentRoomName: string;
  completionPercent: number;
  deathCount: number;
  isEmpty: boolean;
}

/** Loaded progression + cards (from persistence layer) */
export interface LoadedGameState {
  slot: number;
  playerName: string;
  totalPlayTime: number;
  currentRoomId: string;
  currentRoomName: string;
  completionPercent: number;
  deathCount: number;
  lastSaved: string;
  unlockedAbilities: string[];
  openedGates: string[];
  defeatedBosses: string[];
  visitedRooms: string[];
  currentHealth: number;
  maxHealth: number;
  ownedCards: string[];
  equippedCards: string[];
}

// Completion weight constants
const ABILITY_WEIGHT = 30;
const BOSS_WEIGHT = 40;
const ROOM_WEIGHT = 30;
const TOTAL_ABILITIES = 4;
const TOTAL_BOSSES = 4;
const TOTAL_ROOMS = 90;

export class SaveSystem {
  /**
   * Create a save data snapshot from current game state.
   * Calculates completion percentage from progression data.
   */
  static createSnapshot(data: {
    slot: number;
    playerName: string;
    totalPlayTime: number;
    currentRoomId: string;
    currentRoomName: string;
    deathCount: number;
    unlockedAbilities: string[];
    openedGates: string[];
    defeatedBosses: string[];
    visitedRooms: string[];
    currentHealth: number;
    maxHealth: number;
    ownedCards: string[];
    equippedCards: string[];
  }): GameSaveData {
    const abilityPct = data.unlockedAbilities.length / TOTAL_ABILITIES;
    const bossPct = data.defeatedBosses.length / TOTAL_BOSSES;
    const roomPct = Math.min(data.visitedRooms.length / TOTAL_ROOMS, 1);
    const completionPercent = Math.round(
      abilityPct * ABILITY_WEIGHT + bossPct * BOSS_WEIGHT + roomPct * ROOM_WEIGHT
    );

    return {
      ...data,
      completionPercent,
    };
  }

  /** Format play time as M:SS or H:MM:SS string. */
  static formatPlayTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  /** Create an empty save slot summary. */
  static emptySummary(slot: number): SaveSlotSummary {
    return {
      slot,
      playerName: "",
      lastSaved: "",
      totalPlayTime: 0,
      currentRoomId: "",
      currentRoomName: "",
      completionPercent: 0,
      deathCount: 0,
      isEmpty: true,
    };
  }

  /** Format a relative time string (e.g. "2 min ago", "1 hour ago"). */
  static formatRelativeTime(isoString: string): string {
    if (!isoString) return "";
    const now = Date.now();
    const then = new Date(isoString).getTime();
    const diffSec = Math.floor((now - then) / 1000);

    if (diffSec < 60) return "just now";
    if (diffSec < 3600) {
      const mins = Math.floor(diffSec / 60);
      return `${mins} min ago`;
    }
    if (diffSec < 86400) {
      const hours = Math.floor(diffSec / 3600);
      return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    }
    const days = Math.floor(diffSec / 86400);
    return `${days} day${days > 1 ? "s" : ""} ago`;
  }
}
