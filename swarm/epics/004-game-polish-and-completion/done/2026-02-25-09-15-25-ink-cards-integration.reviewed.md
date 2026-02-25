# Ink Cards Integration — Wire Card System into Play Page

## Goal

Wire the existing Ink Card system (CardModifierEngine, CraftingSystem, CardRenderer) into the `/play` page so players can find cards in rooms, equip them for stat bonuses, view their deck, and craft higher-tier cards. The card system is fully built and tested in `/test/ink-cards` — this task is purely integration.

## What Already Exists

All card engine code lives in `src/engine/cards/`:
- `CardModifierEngine` — computes stat modifiers from equipped cards, applies to player/combat/health params
- `CraftingSystem` — combine 2 same-definition same-tier cards → next tier
- `CardRenderer` — static canvas rendering: cards (80×110px), deck bar, collection grid, crafting panel, stat comparison, tooltips
- `InkCard` / `CardDefinitions` — 15 definitions × 3 tiers = 45 variants; `createCard(definitionId, tier)` factory
- `GameSession` already tracks `cardDeckData: { ownedCards: string[]; equippedCards: string[] }` in save data

The test page `/test/ink-cards` is the canonical integration reference.

## Implementation Steps

### 1. Add `cardDrop` field to `RoomData`

**File: `src/engine/world/Room.ts`**

Add an optional field to the `RoomData` interface:

```typescript
/** Card drop — a card the player can find in this room (one-time pickup) */
cardDrop?: {
  definitionId: string;
  tier: 1 | 2 | 3;
  position: Vec2;
};
```

Place it after the `bossGate` field. This is backward-compatible (optional field).

### 2. Add card drops to 5 rooms (1 per region)

Add `cardDrop` data to these 5 existing room definitions. Pick a mid-room position on a platform the player will naturally walk across. Each card should be tier 1:

| Room File | Room ID | Card Definition ID | Card Name |
|-----------|---------|-------------------|-----------|
| `herbariumRooms.ts` | `overgrown-stacks` | `"swift-strider"` | Swiftness (movement boost) |
| `centralArchivesRooms.ts` | `reading-room` | `"ledge-reader"` | Precision (coyote/buffer boost) |
| `astralAtlasRooms.ts` | `star-chart-hall` | `"scribes-haste"` | Arcana (ability cooldown) |
| `maritimeLedgerRooms.ts` | `cargo-hold` | `"spear-verse"` | Might (damage boost) |
| `gothicErrataRooms.ts` | `gargoyle-gallery` | `"vellum-shield"` | Resilience (health/defense) |

For each room, look at the existing platform layout to find a good position. Place the card drop on a main walkable platform, roughly center of the room, elevated slightly above the platform (e.g., platform top Y - 20). The position marks where a floating card visual will appear.

### 3. Add `setCardDeckData()` method to `GameSession`

**File: `src/engine/core/GameSession.ts`**

Add a public setter so the play page can sync card engine state back to the session before saving:

```typescript
setCardDeckData(data: { ownedCards: string[]; equippedCards: string[] }): void {
  this.cardDeckData = data;
}
```

### 4. Wire card system into play page

**File: `src/app/play/page.tsx`**

This is the main integration. Add these in the `handleMount` function:

#### 4a. Initialization (alongside other engine systems)

```typescript
import { CardModifierEngine, CraftingSystem, CardRenderer, createCard, CardDeck } from "@/engine/cards";

const cardEngine = new CardModifierEngine();
const crafting = new CraftingSystem();

// Restore cards from save
if (loadedState) {
  for (const cardStr of loadedState.ownedCards) {
    // Cards stored as "definitionId:tier" strings
    const [defId, tierStr] = cardStr.split(":");
    const tier = (parseInt(tierStr) || 1) as 1 | 2 | 3;
    cardEngine.addToCollection(createCard(defId, tier));
  }
  for (const cardStr of loadedState.equippedCards) {
    const [defId, tierStr] = cardStr.split(":");
    const tier = (parseInt(tierStr) || 1) as 1 | 2 | 3;
    // Find the card in collection by definition and tier
    const deck = cardEngine.getDeck();
    const match = deck.collection.find(c => c.definitionId === defId && c.tier === tier && !deck.equippedIds.includes(c.id));
    if (match) cardEngine.equipCard(match.id);
  }
}

// Store base params for card modification (snapshot before any card modifiers)
const basePlayerParams = { ...player.params };
const baseCombatParams = { ...combat.params };
const baseHealthParams = { ...playerHealth.params };

// Deck UI state
const deckMode = { current: false };
const deckUI = {
  selectedCollectionIndex: 0,
  selectedRecipeIndex: 0,
  collectionScrollOffset: 0,
  activePanel: "collection" as "collection" | "crafting",
};

// Track which rooms have had their card collected (persisted via ownedCards)
const collectedCardRooms = new Set<string>();
```

#### 4b. Card save serialization helper

```typescript
function syncCardStateToSession() {
  const deck = cardEngine.getDeck();
  const ownedCards = deck.collection.map(c => `${c.definitionId}:${c.tier}`);
  const equippedCards = deck.collection
    .filter(c => deck.equippedIds.includes(c.id))
    .map(c => `${c.definitionId}:${c.tier}`);
  session.setCardDeckData({ ownedCards, equippedCards });
}
```

Call `syncCardStateToSession()` before every `doSave()` call. Find all existing `doSave()` calls in the file and add `syncCardStateToSession()` immediately before each one.

#### 4c. Card pickup in update loop

In the update loop, after room transition logic but during the main update body, check for card pickup:

```typescript
// Card pickup check
const currentRoom = roomManager.getCurrentRoom();
if (currentRoom?.cardDrop && !collectedCardRooms.has(currentRoom.id)) {
  const drop = currentRoom.cardDrop;
  const dropRect = { x: drop.position.x - 16, y: drop.position.y - 16, width: 32, height: 32 };
  const playerRect = player.getBounds();
  // Simple AABB overlap
  if (
    playerRect.x < dropRect.x + dropRect.width &&
    playerRect.x + playerRect.width > dropRect.x &&
    playerRect.y < dropRect.y + dropRect.height &&
    playerRect.y + playerRect.height > dropRect.y
  ) {
    const card = createCard(drop.definitionId, drop.tier);
    cardEngine.addToCollection(card);
    collectedCardRooms.add(currentRoom.id);
    hud.showNotification(`Ink Card Found: ${card.name}`, "item");
  }
}
```

#### 4d. Apply card modifiers every frame

In the update loop, AFTER biome system modifications (gravity wells, etc.) but BEFORE combat input processing:

```typescript
// Apply card stat modifiers
if (cardEngine.getDeck().equippedIds.length > 0) {
  const modifiedPlayer = cardEngine.applyToPlayerParams(basePlayerParams);
  Object.assign(player.params, modifiedPlayer);
  player.size.x = player.params.playerWidth;

  const modifiedCombat = cardEngine.applyToCombatParams(baseCombatParams);
  Object.assign(combat.params, modifiedCombat);

  const modifiedHealth = cardEngine.applyToHealthParams(baseHealthParams);
  playerHealth.params = modifiedHealth;
  playerHealth.maxHealth = modifiedHealth.maxHealth;
  if (playerHealth.health > playerHealth.maxHealth) {
    playerHealth.health = playerHealth.maxHealth;
  }
}
```

**Important:** Base params must be captured ONCE at init time, not re-captured every frame. The card engine applies modifiers to the base values, not the already-modified values.

#### 4e. Deck mode toggle (Tab key)

Add a new `InputAction.Deck` to the input manager, or handle `Tab` key directly. The simplest approach: handle Tab key in a `keydown` listener on the canvas/window.

When deck mode opens:
- Set `deckMode.current = true`
- Game update loop is SKIPPED (same as pause — check `if (deckMode.current) return;` at top of update)
- Render loop draws the deck UI instead of the game world

When deck mode closes (Escape or Tab again):
- Set `deckMode.current = false`
- Resume normal update/render

#### 4f. Deck UI input handling

When `deckMode.current === true`, handle these keys:

| Key | Action |
|-----|--------|
| `Tab` or `Escape` | Close deck mode |
| `ArrowUp` / `ArrowDown` | Navigate collection or recipe list |
| `ArrowLeft` / `ArrowRight` | Switch between collection and crafting panels |
| `Enter` | Equip/unequip selected card |
| `C` | Craft selected recipe (if in crafting panel) |

Wire these in a `keydown` event listener that checks `deckMode.current`.

#### 4g. Deck screen rendering

In the screen-space render layer (the layer that draws the HUD), add deck rendering when `deckMode.current === true`:

```typescript
if (deckMode.current) {
  // Dark overlay
  ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Title
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "bold 24px monospace";
  ctx.textAlign = "center";
  ctx.fillText("INK DECK", canvas.width / 2, 40);

  const deck = cardEngine.getDeck();

  // Equipped deck bar (top center)
  CardRenderer.renderDeckBar(ctx, deck, canvas.width / 2 - 150, 60, -1);

  // Collection grid (left panel)
  CardRenderer.renderCollectionGrid(
    ctx, deck.collection,
    40, 160, 360, 340,
    deckUI.collectionScrollOffset,
    deckUI.activePanel === "collection" ? deckUI.selectedCollectionIndex : -1,
    new Set(deck.equippedIds)
  );

  // Crafting panel (right side)
  const recipes = crafting.getAvailableCrafts(deck.collection);
  CardRenderer.renderCraftingPanel(
    ctx, recipes, deck.collection,
    440, 160, 300, 340,
    deckUI.activePanel === "crafting" ? deckUI.selectedRecipeIndex : -1
  );

  // Stat comparison (bottom)
  const summary = cardEngine.getModifierSummary(basePlayerParams, baseCombatParams, baseHealthParams);
  CardRenderer.renderStatComparison(ctx, summary, 40, canvas.height - 80, canvas.width - 80);

  // Tooltip for selected card
  if (deckUI.activePanel === "collection" && deck.collection[deckUI.selectedCollectionIndex]) {
    const selectedCard = deck.collection[deckUI.selectedCollectionIndex];
    CardRenderer.renderTooltip(ctx, selectedCard, canvas.width / 2 - 100, canvas.height - 180, 200);
  }

  // Controls hint
  ctx.fillStyle = "#94a3b8";
  ctx.font = "12px monospace";
  ctx.textAlign = "center";
  ctx.fillText("[Tab] Close  [Arrows] Navigate  [Enter] Equip/Unequip  [C] Craft  [←/→] Switch Panel", canvas.width / 2, canvas.height - 16);
}
```

#### 4h. Card drop visual in world rendering

When rendering the world (in the camera-space render callback), draw floating card icons at card drop positions for uncollected cards:

```typescript
// Render uncollected card drops
const currentRoom = roomManager.getCurrentRoom();
if (currentRoom?.cardDrop && !collectedCardRooms.has(currentRoom.id)) {
  const drop = currentRoom.cardDrop;
  // Floating bob animation
  const bobY = Math.sin(Date.now() * 0.003) * 4;
  // Glowing card icon
  ctx.save();
  ctx.shadowColor = "#f59e0b";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#f59e0b";
  ctx.fillRect(drop.position.x - 10, drop.position.y - 14 + bobY, 20, 28);
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(drop.position.x - 10, drop.position.y - 14 + bobY, 20, 28);
  // Card glyph
  ctx.fillStyle = "#1e1b4b";
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "center";
  ctx.fillText("✦", drop.position.x, drop.position.y + 4 + bobY);
  ctx.restore();
}
```

#### 4i. Mini deck HUD during gameplay

When NOT in deck mode, render a small equipped-cards indicator in the HUD area. Place it below the health bar (top-left area):

```typescript
// Mini equipped cards bar (during gameplay, not deck mode)
if (!deckMode.current) {
  const deck = cardEngine.getDeck();
  const equipped = deck.collection.filter(c => deck.equippedIds.includes(c.id));
  if (equipped.length > 0) {
    const miniY = 32; // Below health bar
    const miniX = 16;
    for (let i = 0; i < equipped.length; i++) {
      CardRenderer.renderCard(ctx, equipped[i], {
        x: miniX + i * 36,
        y: miniY,
        width: 32,
        height: 44,
        selected: false,
        equipped: true,
        highlighted: false,
        dimmed: false,
      });
    }
  }
}
```

### 5. Card serialization format

Cards are serialized as `"definitionId:tier"` strings in the save data. Examples:
- `"swift-strider:1"` — tier 1 swift strider
- `"spear-verse:2"` — tier 2 spear verse

This format works with the existing `GameSession.createSaveSnapshot()` since `ownedCards` and `equippedCards` are already `string[]`.

### 6. Persist collected card rooms

The `collectedCardRooms` set prevents double-collecting. To persist this across saves, the simplest approach: the ownedCards list IS the persistence. On load, iterate all rooms that have `cardDrop` and check if the `definitionId:tier` string already exists in the loaded ownedCards — if so, add that room to `collectedCardRooms`.

```typescript
// Rebuild collectedCardRooms from loaded cards
if (loadedState) {
  const loadedCardStrings = new Set(loadedState.ownedCards);
  for (const [roomId, roomData] of Object.entries(allRooms)) {
    if (roomData.cardDrop) {
      const key = `${roomData.cardDrop.definitionId}:${roomData.cardDrop.tier}`;
      if (loadedCardStrings.has(key)) {
        collectedCardRooms.add(roomId);
      }
    }
  }
}
```

## Files to Modify

1. **`src/engine/world/Room.ts`** — Add `cardDrop` to `RoomData` interface
2. **`src/engine/world/herbariumRooms.ts`** — Add card drop to `overgrown-stacks`
3. **`src/engine/world/centralArchivesRooms.ts`** — Add card drop to `reading-room`
4. **`src/engine/world/astralAtlasRooms.ts`** — Add card drop to `star-chart-hall`
5. **`src/engine/world/maritimeLedgerRooms.ts`** — Add card drop to `cargo-hold`
6. **`src/engine/world/gothicErrataRooms.ts`** — Add card drop to `gargoyle-gallery`
7. **`src/engine/core/GameSession.ts`** — Add `setCardDeckData()` method
8. **`src/app/play/page.tsx`** — All integration code (init, update, render, deck UI, save sync)

## Verification

1. **Type check:** `npx tsc --noEmit` passes
2. **Card pickup:** Walk into `overgrown-stacks` room → see floating card icon → walk over it → notification "Ink Card Found: Swift Strider" appears → card icon disappears
3. **Deck view:** Press Tab → game pauses, deck overlay shows with the collected card in the collection grid
4. **Equip:** In deck view, select card → press Enter → card appears in equipped bar → close deck → mini card appears in HUD
5. **Stat modification:** With a swiftness card equipped, player runs noticeably faster
6. **Crafting:** Collect 2 of the same card (if possible) → in deck view, crafting panel shows available recipe → press C → cards combine to tier 2
7. **Save/load:** Collect a card → save → reload page → card is still in collection, room still shows as collected
8. **All 5 rooms:** Visit each of the 5 card drop rooms and verify each card is findable
9. **Deck doesn't interfere:** When deck is closed, game runs normally with no performance impact
10. **No console errors** during card operations

## Implementation Summary

### Files Modified

1. **`src/engine/world/Room.ts`** — Added optional `cardDrop` field to `RoomData` interface (`definitionId`, `tier`, `position`)
2. **`src/engine/world/herbariumRooms.ts`** — Added tier-1 "swift-strider" card drop to `overgrown-stacks` (on central landing platform at y=700)
3. **`src/engine/world/centralArchivesRooms.ts`** — Added tier-1 "ledge-reader" card drop to `reading-room` (on central reading desk at y=280)
4. **`src/engine/world/astralAtlasRooms.ts`** — Added tier-1 "scribes-haste" card drop to `star-chart-hall` (on center floating island at y=480)
5. **`src/engine/world/maritimeLedgerRooms.ts`** — Added tier-1 "spear-verse" card drop to `cargo-hold` (on upper platform at y=330)
6. **`src/engine/world/gothicErrataRooms.ts`** — Added tier-1 "vellum-shield" card drop to `gargoyle-gallery` (on center staircase at y=480)
7. **`src/engine/core/GameSession.ts`** — Added `setCardDeckData()` public method to sync card state back to session before saving
8. **`src/app/play/page.tsx`** — Full card system integration:
   - Imports: CardModifierEngine, CraftingSystem, CardRenderer, createCard
   - Initialization: card engine, crafting system, base params snapshot, deck UI state, collectedCardRooms rebuild from save data
   - Card save sync: `syncCardStateToSession()` called before every `doSave()` (4 call sites)
   - Deck mode: Tab key toggles deck overlay via window keydown listener, Escape also closes
   - Deck UI input: arrow keys navigate, left/right switch panels, Enter equips/unequips, C crafts
   - Card pickup: AABB collision between player and card drop position (32×32 zone), adds to collection with notification
   - Card stat modifiers: applies equipped card bonuses every frame (player, combat, health params) after biome systems, before combat
   - Deck screen rendering: dark overlay with title, equipped bar, collection grid, crafting panel, stat comparison, tooltip, controls hint
   - Card drop visual: floating golden card icon with bob animation and glow in world-space
   - Mini deck HUD: small equipped card icons below health bar during gameplay
   - Event listener cleanup on unmount via cleanupRef

### Verification

- `npx tsc --noEmit` passes with zero errors

---

## Review Notes (Reviewer: b83d6f6c)

### Fix Applied: Card modifier ordering vs gravity systems

**Bug:** `Object.assign(player.params, modifiedPlayer)` in the card stat modifiers section overwrote gravity params (`riseGravity`, `fallGravity`, `maxFallSpeed`) that the gravity well system had just set. The `applyToPlayerParams` method returns `{ ...basePlayerParams, ...cardMods }` which includes all base gravity values, undoing the gravity well multiplier.

**Fix:** Moved the card stat modifier block from AFTER biome systems to BEFORE biome systems in the update loop. This ensures gravity wells (Astral Atlas) and corruption gravity pulses have the final word on gravity parameters. The card system modifies speed/dash/wall params, while gravity systems control gravity — no conflicts after reordering.

**File:** `src/app/play/page.tsx`

### Other Observations (No Fixes Needed)

- Card drop visual correctly uses `time * 3` (frame-rate independent) instead of `Date.now()` from the spec
- All 5 card drops use tier 1 and reference valid card definition IDs
- Deck UI keyboard handling properly clears `deckKeyQueue` after processing
- `syncCardStateToSession()` is called before all 4 `doSave()` call sites
- `collectedCardRooms` rebuild from save data correctly iterates the rooms map
- Event listener cleanup is properly wired through `cleanupRef`
- All card engine APIs (CardModifierEngine, CraftingSystem, CardRenderer, createCard) verified to exist with correct signatures
- `hud.notify()` is the correct method name (not `showNotification`)

### Verification After Fix

- `npx tsc --noEmit` passes with zero errors
- All 427 tests pass across 16 test files
