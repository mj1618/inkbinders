import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Player save slots — each row is one save file
  saveSlots: defineTable({
    /** Slot number (1-3) */
    slot: v.number(),
    /** Player display name for the save */
    playerName: v.string(),
    /** ISO timestamp of last save */
    lastSaved: v.string(),
    /** Total play time in seconds */
    totalPlayTime: v.number(),
    /** Current room ID */
    currentRoomId: v.string(),
    /** Current room display name (for UI) */
    currentRoomName: v.string(),
    /** Percentage completion (0-100) */
    completionPercent: v.number(),
    /** Death count */
    deathCount: v.number(),
  }).index("by_slot", ["slot"]),

  // Full progression data per save slot — separated for size
  progressionData: defineTable({
    /** References the save slot */
    slot: v.number(),
    /** Unlocked abilities (array of strings: "margin-stitch", "redaction", "paste-over", "index-mark") */
    unlockedAbilities: v.array(v.string()),
    /** Opened gate IDs */
    openedGates: v.array(v.string()),
    /** Defeated boss IDs */
    defeatedBosses: v.array(v.string()),
    /** Visited room IDs */
    visitedRooms: v.array(v.string()),
    /** Current player health */
    currentHealth: v.number(),
    /** Max player health */
    maxHealth: v.number(),
  }).index("by_slot", ["slot"]),

  // Card deck data per save slot
  cardDeckData: defineTable({
    /** References the save slot */
    slot: v.number(),
    /** All owned card instance IDs (serialized) */
    ownedCards: v.array(v.string()),
    /** Equipped card IDs (up to 4) */
    equippedCards: v.array(v.string()),
  }).index("by_slot", ["slot"]),

  // Room state per save slot — tracks per-room persistent state
  roomStates: defineTable({
    /** References the save slot */
    slot: v.number(),
    /** Room ID */
    roomId: v.string(),
    /** Opened gate IDs within this room */
    openedGates: v.array(v.string()),
    /** Collected item IDs */
    collectedItems: v.array(v.string()),
    /** Whether this room's boss is defeated */
    bossDefeated: v.boolean(),
  }).index("by_slot_room", ["slot", "roomId"]),
});
