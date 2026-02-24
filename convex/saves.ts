import { query } from "./_generated/server";
import { v } from "convex/values";

/** List all save slots (for the slot select screen) */
export const listSaveSlots = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("saveSlots")
      .withIndex("by_slot")
      .collect();
  },
});

/** Get a specific save slot summary */
export const getSaveSlot = query({
  args: { slot: v.number() },
  handler: async (ctx, { slot }) => {
    return await ctx.db
      .query("saveSlots")
      .withIndex("by_slot", (q) => q.eq("slot", slot))
      .first();
  },
});

/** Load full progression data for a save slot */
export const loadProgression = query({
  args: { slot: v.number() },
  handler: async (ctx, { slot }) => {
    const progression = await ctx.db
      .query("progressionData")
      .withIndex("by_slot", (q) => q.eq("slot", slot))
      .first();
    const cards = await ctx.db
      .query("cardDeckData")
      .withIndex("by_slot", (q) => q.eq("slot", slot))
      .first();
    return { progression, cards };
  },
});

/** Load all room states for a save slot */
export const loadRoomStates = query({
  args: { slot: v.number() },
  handler: async (ctx, { slot }) => {
    return await ctx.db
      .query("roomStates")
      .withIndex("by_slot_room", (q) => q.eq("slot", slot))
      .collect();
  },
});
