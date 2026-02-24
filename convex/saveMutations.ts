import { mutation } from "./_generated/server";
import { v } from "convex/values";

/** Save game state to a slot (upsert pattern) */
export const saveGame = mutation({
  args: {
    slot: v.number(),
    playerName: v.string(),
    totalPlayTime: v.number(),
    currentRoomId: v.string(),
    currentRoomName: v.string(),
    completionPercent: v.number(),
    deathCount: v.number(),
    // Progression
    unlockedAbilities: v.array(v.string()),
    openedGates: v.array(v.string()),
    defeatedBosses: v.array(v.string()),
    visitedRooms: v.array(v.string()),
    currentHealth: v.number(),
    maxHealth: v.number(),
    // Cards
    ownedCards: v.array(v.string()),
    equippedCards: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { slot } = args;

    // Upsert save slot summary
    const existingSlot = await ctx.db
      .query("saveSlots")
      .withIndex("by_slot", (q) => q.eq("slot", slot))
      .first();

    const slotData = {
      slot,
      playerName: args.playerName,
      lastSaved: new Date().toISOString(),
      totalPlayTime: args.totalPlayTime,
      currentRoomId: args.currentRoomId,
      currentRoomName: args.currentRoomName,
      completionPercent: args.completionPercent,
      deathCount: args.deathCount,
    };

    if (existingSlot) {
      await ctx.db.patch(existingSlot._id, slotData);
    } else {
      await ctx.db.insert("saveSlots", slotData);
    }

    // Upsert progression
    const existingProg = await ctx.db
      .query("progressionData")
      .withIndex("by_slot", (q) => q.eq("slot", slot))
      .first();

    const progData = {
      slot,
      unlockedAbilities: args.unlockedAbilities,
      openedGates: args.openedGates,
      defeatedBosses: args.defeatedBosses,
      visitedRooms: args.visitedRooms,
      currentHealth: args.currentHealth,
      maxHealth: args.maxHealth,
    };

    if (existingProg) {
      await ctx.db.patch(existingProg._id, progData);
    } else {
      await ctx.db.insert("progressionData", progData);
    }

    // Upsert cards
    const existingCards = await ctx.db
      .query("cardDeckData")
      .withIndex("by_slot", (q) => q.eq("slot", slot))
      .first();

    const cardData = {
      slot,
      ownedCards: args.ownedCards,
      equippedCards: args.equippedCards,
    };

    if (existingCards) {
      await ctx.db.patch(existingCards._id, cardData);
    } else {
      await ctx.db.insert("cardDeckData", cardData);
    }
  },
});

/** Save room state for a specific room (upsert) */
export const saveRoomState = mutation({
  args: {
    slot: v.number(),
    roomId: v.string(),
    openedGates: v.array(v.string()),
    collectedItems: v.array(v.string()),
    bossDefeated: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("roomStates")
      .withIndex("by_slot_room", (q) =>
        q.eq("slot", args.slot).eq("roomId", args.roomId)
      )
      .first();

    const data = {
      slot: args.slot,
      roomId: args.roomId,
      openedGates: args.openedGates,
      collectedItems: args.collectedItems,
      bossDefeated: args.bossDefeated,
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("roomStates", data);
    }
  },
});

/** Delete a save slot and all associated data */
export const deleteSave = mutation({
  args: { slot: v.number() },
  handler: async (ctx, { slot }) => {
    // Delete save slot
    const slotDoc = await ctx.db
      .query("saveSlots")
      .withIndex("by_slot", (q) => q.eq("slot", slot))
      .first();
    if (slotDoc) await ctx.db.delete(slotDoc._id);

    // Delete progression
    const progDoc = await ctx.db
      .query("progressionData")
      .withIndex("by_slot", (q) => q.eq("slot", slot))
      .first();
    if (progDoc) await ctx.db.delete(progDoc._id);

    // Delete cards
    const cardDoc = await ctx.db
      .query("cardDeckData")
      .withIndex("by_slot", (q) => q.eq("slot", slot))
      .first();
    if (cardDoc) await ctx.db.delete(cardDoc._id);

    // Delete all room states
    const roomDocs = await ctx.db
      .query("roomStates")
      .withIndex("by_slot_room", (q) => q.eq("slot", slot))
      .collect();
    for (const doc of roomDocs) {
      await ctx.db.delete(doc._id);
    }
  },
});
