---
status: in-progress
---
# Epic 004: Game Polish & Completion

## Tasks

- [ ] corruption-integration — Wire night corruption modifiers into the play page
- [ ] ink-cards-integration — Integrate Ink Card system into the play page with find/equip flow
- [ ] victory-ending — Victory screen and ending when all bosses are defeated
- [ ] play-page-bugfix-pass — Fix bugs, smooth rough edges, verify full playthrough

## Goal

Transform Inkbinders from a "technically complete" game into a polished, fun experience. The core world, abilities, and bosses all work — now we need the day/night corruption tension loop, the card system for build variety, a satisfying ending, and a bug-fixing pass to make everything smooth.

---

## Context

### What exists today

**Fully wired in `/play` page (1556 lines):**
- Full 46-room world via `createFullWorld()` with all 6 regions
- All 4 biome systems: VineSystem, GravityWellSystem, CurrentSystem, FogSystem
- All 4 abilities: Margin Stitch, Redaction, Paste-Over, Index Mark
- Combat: quill-spear + ink snap, 2 weapons
- All 3 bosses + 1 mini-boss placed in rooms
- Progression: ability unlocks at shrines, boss gates, ability gates
- Save/load via localStorage (auto-save on room transition, manual save from pause)
- HUD: health, abilities, weapon, clock, room names, notifications
- Day/Night cycle running (visual only — no gameplay effects)
- Pause menu with Resume / Save / Save & Quit / Quit

**Built but NOT wired into play page:**
- `CorruptionModifiers` — night corruption effects (surface flip, gravity pulse, fog-of-war, ink bleed, platform flicker). Only in test pages.
- `CardModifierEngine` + `CraftingSystem` + `CardRenderer` — entire Ink Card system. Only in `/test/ink-cards`.
- No victory condition — defeating all bosses has no culmination.

### Design philosophy

From PLAN.md: **"The game must be challenging, fun, and enjoyable to play. This is the single most important thing."**

Corruption modifiers add the tension loop (cozy day / chaos night). Cards add build diversity and reward exploration. A victory screen gives the player closure. Bug fixes make it all smooth.

---

## Tasks

### Task 1: Corruption Integration

**Goal:** Wire the existing `CorruptionModifiers` system into the play page so the day/night cycle actually affects gameplay during night phases.

**Files to modify:**
- `src/app/play/page.tsx` — import and wire corruption modifiers into update/render

**What already exists:**
- `CorruptionModifiers` (`src/engine/world/CorruptionModifiers.ts`) — full system with 5 modifier types
- `DayNightCycle` already runs in the play page, providing `getCorruptionIntensity()`
- Test page `/test/day-night` shows the full wiring pattern

**Corruption modifiers (all 5 types):**

| Modifier | Threshold | Effect |
|----------|-----------|--------|
| ink-bleed | 0.2 | Visual: ink particles drip from ceiling, no gameplay effect |
| surface-flip | 0.3 | Surfaces cycle types (normal→icy→bouncy→sticky→conveyor) |
| platform-flicker | 0.4 | Platforms briefly become transparent (visual + collision) |
| fog-of-war | 0.5 | Radial visibility shrinks with corruption intensity |
| gravity-pulse | 0.7 | Brief gravity reversals at interval |

**Integration pattern (from day-night test page):**
1. Each update frame, get `corruptionIntensity` from `dayNightCycle`
2. Call `updateCorruptionModifiers(intensity, modifiers, params)` to activate/deactivate based on thresholds
3. Apply active modifiers:
   - Surface flip: modify platform surface types
   - Gravity pulse: track pulse timer, apply gravity multiplier during pulse
   - Fog-of-war: render radial fog overlay (like Gothic Errata but corruption-driven)
   - Ink bleed: spawn dripping particles
   - Platform flicker: toggle platform collision/render briefly
4. Hub rooms are immune (corruption intensity forced to 0)

**Important: Keep corruption subtle and fair.**
- Surface flips should be telegraphed (visual warning before change)
- Platform flicker should be brief (3-5 frames) and infrequent
- Gravity pulses should be short and have a visual warning pulse
- The goal is atmosphere and tension, not cheap deaths

**Pass criteria:**
- Night cycle causes corruption modifiers to activate
- Modifiers only affect non-hub rooms
- Each modifier type functions as described
- Day returns everything to normal
- No additional deaths feel "unfair" due to corruption

---

### Task 2: Ink Cards Integration

**Goal:** Wire the Ink Card system into the play page. Players find cards as loot in rooms, equip them for stat bonuses, and craft higher-tier cards.

**Files to modify:**
- `src/app/play/page.tsx` — card UI overlay, card modifier application, card drops
- `src/engine/core/GameSession.ts` — track card deck in session state

**What already exists:**
- `CardModifierEngine` — computes stat modifiers from equipped cards
- `CraftingSystem` — combine 2 same cards → next tier
- `CardRenderer` — canvas-based card rendering (80×110px cards, deck bar, collection grid)
- `InkCard` + `CardDefinitions` — 15 definitions × 3 tiers = 45 variants
- Test page `/test/ink-cards` shows full integration pattern
- `GameSession` already tracks `cards: { ownedCardIds, equippedCardIds }` in save data

**Card flow in the game:**
1. **Finding cards:** Some rooms have a `cardDrop` zone (similar to `abilityPickup` but for cards). Walking over it adds a random card to inventory. One card per room, consumed on pickup.
2. **Viewing deck:** Press `Tab` to open card overlay (pause game, show deck UI). `Escape` closes.
3. **Equipping:** In deck overlay, navigate cards with arrow keys, `Enter` to equip/unequip. Max 3 equipped.
4. **Crafting:** In deck overlay, press `C` to enter craft mode. Select 2 matching cards → combine.
5. **Stat application:** Each frame, `CardModifierEngine.applyToPlayerParams()` and `applyToCombatParams()` modify active stats based on equipped cards.

**Card drop rooms (1 per region, placed in mid-wing rooms):**
- Herbarium Wing: `overgrown-stacks` — Swiftness card (movement boost)
- Central Archives: `reading-room` — Precision card (coyote/buffer boost)
- Astral Atlas: `star-chart-hall` — Arcana card (ability cooldown)
- Maritime Ledger: `cargo-hold` — Might card (damage boost)
- Gothic Errata: `gargoyle-gallery` — Resilience card (health/defense)

**Implementation notes:**
- Add `cardDrop?: { definitionId: string, tier: 1 | 2 | 3, position: Vec2 }` to `RoomData`
- Add card drop data to the 5 rooms listed above
- In update loop: check player overlap with cardDrop zone → add card to session → show notification
- Card UI renders on a separate overlay canvas or on the main canvas in screen-space
- Card stat application: call `applyToPlayerParams(baseParams, equipped)` each frame to compute modified params
- Save/load: `GameSession.createSaveSnapshot()` already includes card data

**Pass criteria:**
- Cards are findable in 5 rooms (1 per region)
- Card pickup shows notification ("Ink Card Found: [name]")
- Tab opens deck overlay with collection grid
- Equipping cards modifies player stats (visible in play)
- Crafting works (2 same → next tier)
- Card state persists across save/load
- Card UI doesn't interfere with gameplay when closed

---

### Task 3: Victory Ending

**Goal:** When all 3 main bosses (Footnote Giant, Misprint Seraph, Index Eater) are defeated, trigger an ending sequence.

**Files to modify/create:**
- `src/app/play/page.tsx` — victory detection and ending overlay
- `src/engine/ui/VictoryScreen.ts` — canvas-based ending screen (new file)

**Victory condition:**
- All 3 main bosses defeated: `footnote-giant`, `misprint-seraph`, `index-eater`
- Tide Scribe (mini-boss) is NOT required
- Elder Binder (mini-boss) is NOT required

**Victory detection:**
- After each boss defeat, check if all 3 main bosses are in `session.defeatedBosses`
- If yes, show a notification: "The Library is Restored"
- After the player returns to the Scribe Hall (hub), trigger the ending sequence

**Ending sequence:**
1. Player enters hub after defeating all 3 bosses
2. Short pause (1 second), then camera pans to center of hub
3. Overlay fades in: warm parchment background
4. Text sequence (typewriter style, 2 seconds per line):
   - "The corruption recedes..."
   - "The Library breathes again."
   - "You have restored the Index."
   - "[Player Name], Keeper of the Archive"
5. Stats display:
   - Play time
   - Deaths
   - Rooms visited
   - Abilities unlocked (should be 4/4)
   - Cards collected
6. "Thank you for playing Inkbinders"
7. After 3 seconds: "Press any key to return to title"
8. Returns to `/` (title screen)

**Implementation:**
- `VictoryScreen` is a pure engine class (canvas rendering, no React)
- Takes `GameSessionState` for stats
- `update(dt, input)` handles timing and key detection
- `render(ctx, width, height)` draws the sequence
- Play page checks `victoryTriggered` flag in update loop

**Pass criteria:**
- Defeating all 3 bosses triggers "Library Restored" notification
- Returning to hub after all bosses triggers ending
- Ending displays player stats correctly
- "Press any key" returns to title screen
- Victory state prevents re-triggering on subsequent hub visits

---

### Task 4: Play Page Bugfix Pass

**Goal:** Manual playthrough to find and fix integration bugs. This is the final quality pass.

**Files to modify:** Primarily `src/app/play/page.tsx`, room data files as needed

**Known areas to verify:**
1. **Room transitions:** Every exit leads somewhere valid, every room has return exits
2. **Biome systems:** Vine attach/detach works in Herbarium, gravity in Astral Atlas, currents in Maritime, fog in Gothic Errata
3. **Boss fights:** All 3 bosses + 2 mini-bosses are beatable without softlocks
4. **Ability gates:** All gates block correctly and open with correct ability
5. **Save/load:** Save mid-playthrough → reload → resume at correct room with all progression
6. **Health pickups:** Placed in enough rooms, especially before boss fights
7. **Fall-off respawn:** Works in every room without losing progress
8. **Console errors:** Zero JavaScript errors during normal play
9. **Performance:** No frame drops or memory leaks during extended play

**Specific bugs to look for:**
- Boss TargetDummy spawns with wrong groundY (floats or clips through floor)
- Vine interaction conflicts with Margin Stitch (both on E key)
- Gravity well rooms leaving sticky low-gravity after leaving
- Fog input remap persisting after leaving Gothic Errata
- Room name display missing for some rooms
- Ability notification showing "undefined" instead of ability name

**Process:**
1. Start new game at `/play?slot=1&new=1`
2. Play through the critical path (hub → each wing → boss → next wing)
3. Fix each bug as discovered
4. After fixes, do a second pass to verify no regressions
5. Run `npx tsc --noEmit` to verify compilation

**Pass criteria:**
- Full playthrough from new game to all bosses defeated with zero crashes
- Zero JavaScript console errors during play
- All room transitions smooth (fade-to-black, no flicker)
- All boss fights completable
- Save/load works correctly
- `npx tsc --noEmit` passes

---

## Ordering & Dependencies

```
Task 1 (Corruption Integration) — independent, adds to existing day/night
Task 2 (Ink Cards Integration)  — independent, adds new overlay system
Task 3 (Victory Ending)         — independent, new system
Task 4 (Bugfix Pass)            — depends on Tasks 1-3 (verify everything together)
```

Recommended execution:
1. **Wave 1** (parallel): Tasks 1, 2, 3
2. **Wave 2**: Task 4 — final verification after all integration

---

## Success Criteria

- [ ] Night corruption modifies gameplay (surfaces, gravity, fog, particles)
- [ ] Day returns everything to normal
- [ ] Hub rooms are always safe (no corruption)
- [ ] Ink Cards are findable, equippable, craftable in the play page
- [ ] Card stat modifiers affect player performance
- [ ] Defeating all 3 bosses triggers a victory ending
- [ ] Victory screen shows player stats and returns to title
- [ ] Full playthrough is possible with zero crashes or softlocks
- [ ] All systems work together (corruption + cards + biome systems + combat + abilities)
