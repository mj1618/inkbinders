# Task: Convex Game State Persistence — Save/Load System

## Overview

Implement the **Convex backend persistence layer** for Inkbinders: a proper save/load system backed by Convex.dev. This is Phase 6, step 29 — the final infrastructure piece needed to make Inkbinders a real game with persistent state.

**What this task does:**
1. Redesigns the Convex schema from the placeholder key-value store into a proper game state model
2. Creates Convex queries and mutations for save/load operations
3. Wires up the Convex provider in the Next.js app layout
4. Creates a `/test/save-load` test page that demonstrates persistence working end-to-end
5. Provides a `SaveSystem` engine-side class that bridges game state ↔ Convex

**What this task does NOT do:**
- It does NOT require the GameWorld or PlayerProgression classes to exist yet — it defines its own serializable data shapes that match the planned interfaces
- It does NOT deploy to production — it uses `npx convex dev` for local development
- It does NOT add save/load to every test page — just the dedicated test page

**Core design principle:** The save system is a clean boundary between the game engine (pure TypeScript, no framework dependencies) and the persistence layer (Convex/React). The engine produces serializable state snapshots; the React layer sends them to Convex. The engine never imports Convex directly.

## Dependencies

- Convex npm package (already installed: `convex@^1.32.0`)
- Convex project exists with placeholder schema (`convex/schema.ts`)
- Next.js app with layout (`src/app/layout.tsx`)
- `PlayerHealth` and `PlayerHealthParams` (`src/engine/combat/PlayerHealth.ts`) — for health state shape
- Existing test page pattern (GameCanvas, DebugPanel, Slider)

## Convex Schema Design

Replace the placeholder `convex/schema.ts` with a proper game-state-aware schema:

```typescript
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
```

**Design rationale:**
- **Save slots (3):** Classic metroidvania pattern. Each slot is an independent playthrough.
- **Separated tables:** `saveSlots` has summary data for the slot select screen (quick to query). `progressionData` and `cardDeckData` have the full state (loaded only when resuming a save).
- **`roomStates`:** Per-room persistent state allows tracking which gates are opened, items collected, and bosses defeated per room. This scales to 60-90 rooms without bloating the main progression table.
- **No `v.any()`:** Everything is strongly typed with Convex validators. This matches the CLAUDE.md instruction for TypeScript strict mode.

## Convex Functions

### Queries

Create `convex/saves.ts`:

```typescript
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
```

### Mutations

Create `convex/saveMutations.ts`:

```typescript
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
```

## Engine-Side Save Interface

Create `src/engine/save/SaveSystem.ts` — a pure TypeScript class that handles serialization/deserialization of game state. This class does NOT import Convex — it produces plain objects that the React layer sends to Convex.

```typescript
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

export class SaveSystem {
  /**
   * Create a save data snapshot from current game state.
   * In the real game, this reads from GameWorld/PlayerProgression.
   * For the test page, we pass mock data.
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
    // Calculate completion percent from progression data
    const totalAbilities = 4;
    const totalBosses = 4;
    const totalRooms = 90; // approximate
    const abilityPct = data.unlockedAbilities.length / totalAbilities;
    const bossPct = data.defeatedBosses.length / totalBosses;
    const roomPct = data.visitedRooms.length / totalRooms;
    const completionPercent = Math.round(
      (abilityPct * 30 + bossPct * 40 + roomPct * 30) // weighted: bosses 40%, abilities 30%, rooms 30%
    );

    return {
      ...data,
      completionPercent,
    };
  }

  /**
   * Format play time as M:SS or H:MM:SS string.
   */
  static formatPlayTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  /**
   * Create an empty save slot summary.
   */
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
}
```

## Convex Provider Setup

Modify `src/app/layout.tsx` to add the Convex provider. Since Convex requires a client component wrapper, create a `ConvexClientProvider` component.

### Create `src/components/ConvexClientProvider.tsx`:

```typescript
"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { type ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

// If no Convex URL is configured, render children without the provider.
// This allows test pages and development to work without a Convex backend.
function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convexUrl) {
    return <>{children}</>;
  }

  const client = new ConvexReactClient(convexUrl);
  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}

export { ConvexClientProvider };
```

**IMPORTANT:** The ConvexReactClient instantiation should be done outside the component or in a ref to avoid recreating on every render. Use a module-level variable:

```typescript
"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { type ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const client = convexUrl ? new ConvexReactClient(convexUrl) : null;

function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!client) {
    return <>{children}</>;
  }
  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}

export { ConvexClientProvider };
```

### Modify `src/app/layout.tsx`:

Wrap `{children}` with the ConvexClientProvider:

```tsx
import { ConvexClientProvider } from "@/components/ConvexClientProvider";

// ... existing code ...

<body className={...}>
  <ConvexClientProvider>
    {children}
  </ConvexClientProvider>
</body>
```

**Graceful degradation:** When `NEXT_PUBLIC_CONVEX_URL` is not set (which is the current state), the provider passes children through without wrapping. This means ALL existing test pages continue to work unchanged. The save system is opt-in.

## Test Page: `/test/save-load`

Create `src/app/test/save-load/page.tsx` — a test page that demonstrates the save/load system working end-to-end.

**This is NOT a game canvas test page.** It's a React UI test page that:
1. Shows a 3-slot save select screen
2. Lets you create mock game state and save it
3. Lets you load saved state and verify it matches
4. Lets you delete saves
5. Shows real-time Convex sync (changes appear instantly via subscriptions)

### Test Page Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Save/Load System Test                                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─── Slot 1 ──────────────────┐  ┌─── Slot 2 ──────────────────┐ │
│  │ Archivist Mae               │  │ [Empty]                      │ │
│  │ Scribe Hall                 │  │                              │ │
│  │ 12% complete · 3 deaths     │  │  Click to create new save   │ │
│  │ Play time: 4:32             │  │                              │ │
│  │ Last saved: 2 min ago       │  │                              │ │
│  │ [Load] [Save] [Delete]      │  │  [New Save]                 │ │
│  └─────────────────────────────┘  └──────────────────────────────┘ │
│                                                                     │
│  ┌─── Slot 3 ──────────────────┐                                   │
│  │ [Empty]                      │                                   │
│  │                              │                                   │
│  │  Click to create new save   │                                   │
│  │                              │                                   │
│  │  [New Save]                 │                                   │
│  └──────────────────────────────┘                                   │
│                                                                     │
│  ┌─── Mock Game State Editor ──────────────────────────────────────┐│
│  │ Player Name: [input field]                                      ││
│  │ Room: [dropdown: Scribe Hall, Tutorial Corridor, ...]           ││
│  │ Health: [slider 1-10]                                           ││
│  │ Play Time: [number input seconds]                               ││
│  │ Deaths: [number input]                                          ││
│  │ Abilities: [x] Margin Stitch [x] Redaction [ ] Paste-Over ...  ││
│  │ Bosses: [ ] Footnote Giant [ ] Misprint Seraph ...              ││
│  │ Visited Rooms: [checklist]                                      ││
│  │ Cards: [mock: 3 owned, 2 equipped]                              ││
│  │ [Save to Selected Slot]                                         ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌─── Loaded State Viewer ─────────────────────────────────────────┐│
│  │ (shows full loaded data as formatted JSON)                      ││
│  │ Progression: { abilities: [...], gates: [...], ... }            ││
│  │ Cards: { owned: [...], equipped: [...] }                        ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌─── Status ──────────────────────────────────────────────────────┐│
│  │ Convex connected: ✓ / ✗                                         ││
│  │ Last operation: "Saved to slot 1" (timestamp)                   ││
│  │ Operation time: 45ms                                            ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌─── Pass Criteria ───────────────────────────────────────────────┐│
│  │ [ ] Save slot data persists to Convex                           ││
│  │ [ ] Load restores all progression fields correctly              ││
│  │ [ ] Delete removes all data for a slot                          ││
│  │ [ ] Empty slots display correctly                               ││
│  │ [ ] Real-time sync: changes appear without page refresh         ││
│  │ [ ] Completion percentage calculates correctly                  ││
│  │ [ ] Play time formats correctly (M:SS / H:MM:SS)               ││
│  │ [ ] Graceful fallback when Convex is not connected              ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

### Graceful Fallback Mode

When `NEXT_PUBLIC_CONVEX_URL` is not set (common during development), the test page should:
1. Show a clear banner: "Convex not connected — using in-memory mock mode"
2. Use local React state as a mock backend (save/load from in-memory objects)
3. All UI and functionality works identically, just without persistence across page refreshes
4. This lets the developer test the UI/UX without needing Convex running

Implement this with a `useSaveSystem` hook that returns the same API whether backed by Convex or by local state:

```typescript
// In the test page:
function useSaveSystem(): {
  slots: SaveSlotSummary[];
  isConnected: boolean;
  save: (data: GameSaveData) => Promise<void>;
  load: (slot: number) => Promise<LoadedGameState | null>;
  deleteSave: (slot: number) => Promise<void>;
  lastOperation: { type: string; timestamp: number; durationMs: number } | null;
}
```

When Convex IS connected, the hook uses `useQuery` and `useMutation` from `convex/react`.
When Convex is NOT connected, the hook uses `useState` with mock data.

### Convex Connection Detection

To detect if Convex is available, check:
1. `process.env.NEXT_PUBLIC_CONVEX_URL` exists
2. `useConvex()` hook succeeds (wrap in try-catch or check context)

A simpler approach: the `ConvexClientProvider` component can provide a context value indicating whether Convex is active. Or just check `typeof window !== 'undefined' && process.env.NEXT_PUBLIC_CONVEX_URL` in the hook.

**Simplest approach:** Just check for the env var. If it's set, use Convex hooks. If not, use mock state.

```typescript
const CONVEX_AVAILABLE = !!process.env.NEXT_PUBLIC_CONVEX_URL;
```

## Files to Create

### 1. `convex/saves.ts`
Queries: `listSaveSlots`, `getSaveSlot`, `loadProgression`, `loadRoomStates`

### 2. `convex/saveMutations.ts`
Mutations: `saveGame`, `saveRoomState`, `deleteSave`

### 3. `src/engine/save/SaveSystem.ts`
Pure TypeScript save system class with serialization helpers. No React/Convex imports.

### 4. `src/components/ConvexClientProvider.tsx`
Client component wrapping ConvexProvider with graceful fallback when URL not set.

### 5. `src/app/test/save-load/page.tsx`
Full test page with save slot UI, mock game state editor, and pass criteria.

## Files to Modify

### 6. `convex/schema.ts`
Replace placeholder with proper schema (saveSlots, progressionData, cardDeckData, roomStates tables).

### 7. `src/app/layout.tsx`
Wrap children with ConvexClientProvider.

### 8. `src/lib/testStatus.ts`
Add save-load test page entry: `{ name: "Save/Load", path: "/test/save-load", phase: 6, phaseName: "Integration", status: "in-progress", description: "Convex persistence and save slot system" }`

### 9. `AGENTS.md`
Add Save System documentation section with:
- SaveSystem class API
- Convex schema overview
- ConvexClientProvider graceful fallback pattern
- useSaveSystem hook pattern (Convex vs mock mode)

## Pass Criteria

1. **Save slot UI renders:** Three save slot cards display (filled or empty)
2. **Create new save:** Clicking "New Save" on empty slot + filling mock data + saving stores the data
3. **Load saved data:** Loading a filled slot populates the Loaded State Viewer with correct data
4. **Delete save:** Deleting a slot clears it and shows empty state
5. **Completion percent calculates:** Based on abilities (30%) + bosses (40%) + rooms (30%) weights
6. **Play time formats correctly:** Shows M:SS for < 1hr, H:MM:SS for >= 1hr
7. **Graceful fallback:** When Convex URL is not set, page works in mock mode with a banner
8. **Real-time sync:** If Convex IS connected, changes are reflected without page refresh (Convex subscription)
9. **No regressions:** Adding ConvexClientProvider to layout doesn't break any existing test pages
10. **TypeScript strict:** `npx tsc --noEmit` passes with zero errors

## Implementation Notes

1. **ConvexClientProvider MUST be graceful.** When `NEXT_PUBLIC_CONVEX_URL` is not set, it renders children directly without the provider. This is critical — without it, every existing test page would break when Convex isn't running.

2. **The save test page is a React UI page**, not a game canvas page. It uses standard React components, forms, and buttons. No GameCanvas component. The styling follows the dark theme (Tailwind classes) consistent with the rest of the app.

3. **Mock mode is the default.** Since there's no Convex deployment yet, the test page will run in mock mode by default. The developer can later run `npx convex dev` to get a local Convex backend and test real persistence.

4. **SaveSystem is a pure engine class.** It lives in `src/engine/save/` alongside the game engine code. It has NO React or Convex imports. It only knows about plain TypeScript objects. The React layer (test page) is responsible for calling Convex mutations with the data SaveSystem produces.

5. **Don't create a `convex/_generated` directory.** That's auto-generated by `npx convex dev`. It may or may not exist in the repo. The code should import from `convex/_generated/server` and `convex/_generated/api` — these paths will resolve when Convex generates them.

6. **If `convex/_generated` doesn't exist yet**, the Convex function files (`saves.ts`, `saveMutations.ts`) will have import errors until `npx convex dev` is run. This is expected. The test page's mock mode works without Convex running. Make sure the test page itself doesn't import from `convex/_generated` directly — only the `ConvexClientProvider` and `useSaveSystem` hook (when in Convex mode) import Convex client code.

7. **The test page should conditionally import Convex hooks.** Use dynamic imports or a "provider check" pattern to avoid hard failures when Convex isn't available:
   ```typescript
   // Pattern: check if we're inside a ConvexProvider before using hooks
   // The useSaveSystem hook internally checks CONVEX_AVAILABLE and
   // falls back to mock state if false
   ```

8. **Convex v1.32+ uses ConvexReactClient from "convex/react".** The import is:
   ```typescript
   import { ConvexProvider, ConvexReactClient } from "convex/react";
   import { useQuery, useMutation } from "convex/react";
   import { api } from "../convex/_generated/api";
   ```

9. **The test page should use a clean, card-based UI** with Tailwind. Save slot cards should look polished — this is effectively the game's save/load screen. Use `bg-zinc-900` cards with `border-zinc-700`, hover effects, and clear visual hierarchy.

10. **Don't over-engineer room states for the test page.** The `roomStates` table exists in the schema for future use, but the test page's mock data can just include a few sample room states. The `saveRoomState` mutation is created for completeness but doesn't need to be exercised in every test scenario.

## Verification

- [ ] `npx tsc --noEmit` passes (may need `--skipLibCheck` if convex types haven't been generated)
- [ ] `npm run build` succeeds — no import errors, ConvexClientProvider gracefully handles missing URL
- [ ] Navigate to `/test/save-load` — page renders with 3 save slot cards
- [ ] In mock mode: save, load, delete all work with in-memory state
- [ ] No existing test pages break (all 22+ pages still load correctly)
- [ ] ConvexClientProvider correctly passes through children when NEXT_PUBLIC_CONVEX_URL is absent
- [ ] SaveSystem.ts has no React or Convex imports (pure engine code)
- [ ] Schema uses proper Convex validators (no `v.any()`)
- [ ] Test page is properly styled (dark theme, Tailwind, matches app aesthetic)

---

## Review Notes (Reviewer: 8169f63f)

### Verification Results
- `npx tsc --noEmit` — **PASS** (zero errors)
- `npm run build` — **PASS** (all 24 routes render including `/test/save-load`)

### Files Reviewed
All 9 files (5 created, 4 modified) were reviewed in detail.

### Issues Found
**None requiring fixes.** The implementation is clean and well-structured:

1. **convex/schema.ts** — Proper Convex validators, no `v.any()`, correct indexes. Schema design is sound with separated tables for summary vs. full data.
2. **convex/saves.ts** — Queries are correctly structured with proper index usage.
3. **convex/saveMutations.ts** — Upsert pattern is correct across all 3 tables. `deleteSave` properly cascades to all related tables including room states.
4. **src/engine/save/SaveSystem.ts** — Pure TypeScript, no React/Convex imports. Named constants for completion weights (no magic numbers). `roomPct` properly clamped with `Math.min(..., 1)`. `formatRelativeTime` handles all edge cases.
5. **src/components/ConvexClientProvider.tsx** — Module-level client instantiation (avoids per-render recreation). Graceful passthrough when NEXT_PUBLIC_CONVEX_URL is absent.
6. **src/app/layout.tsx** — ConvexClientProvider properly wraps children.
7. **src/app/test/save-load/page.tsx** — Well-structured React UI page. `useSaveSystem` hook has correct dependency arrays. Mock store uses `useRef` (stable across renders). The 30-second interval for relative time updates is properly cleaned up on unmount. Pass criteria logic is reasonable.
8. **src/lib/testStatus.ts** — Save/Load entry correctly added to Phase 6.
9. **tsconfig.json** — `convex` in exclude list prevents false TypeScript errors from missing `_generated` directory.

### Architecture Notes
- Clean separation: engine `SaveSystem` produces plain objects, React layer handles persistence
- Graceful degradation works correctly — all existing test pages unaffected by ConvexClientProvider
- Mock mode is the correct default since no Convex deployment exists yet
- AGENTS.md was properly updated with comprehensive Save System documentation

### No fixes applied — code passes review as-is.

---

## Completion Summary

### Files Created
- `convex/saves.ts` — Convex queries: listSaveSlots, getSaveSlot, loadProgression, loadRoomStates
- `convex/saveMutations.ts` — Convex mutations: saveGame (upsert all 3 tables), saveRoomState (upsert one room), deleteSave (cascade delete)
- `src/engine/save/SaveSystem.ts` — Pure TypeScript save system class with GameSaveData/SaveSlotSummary/LoadedGameState interfaces, createSnapshot (completion % calculation), formatPlayTime, formatRelativeTime, emptySummary
- `src/components/ConvexClientProvider.tsx` — Graceful Convex wrapper that passes through when NEXT_PUBLIC_CONVEX_URL is absent
- `src/app/test/save-load/page.tsx` — Full test page with 3-slot save UI, mock state editor (player name, room, health, abilities, bosses, rooms, cards), loaded state viewer, status panel, pass criteria

### Files Modified
- `convex/schema.ts` — Replaced placeholder key-value schema with 4 proper tables (saveSlots, progressionData, cardDeckData, roomStates) using typed Convex validators (no v.any())
- `src/app/layout.tsx` — Added ConvexClientProvider import and wrapped {children}
- `src/lib/testStatus.ts` — Added save-load test page entry (Phase 6, Integration)
- `tsconfig.json` — Added "convex" to exclude list (Convex has its own tsconfig; prevents false positives from missing _generated directory)
- `AGENTS.md` — Added Save System, Convex Schema, ConvexClientProvider, and Save Test Page Pattern documentation sections; updated Phase 6 table status

### Verification
- `npx tsc --noEmit` passes with zero errors
- `npm run build` succeeds — all 23 test pages render (22 existing + save-load)
- ConvexClientProvider gracefully passes through when NEXT_PUBLIC_CONVEX_URL is absent
- SaveSystem.ts has no React or Convex imports (pure engine code)
- Test page runs in mock mode by default with in-memory state
