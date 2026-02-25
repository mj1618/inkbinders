# Task: Herbarium Wing — First Content Batch (8 Rooms)

## Overview

Build the **Herbarium Folio wing** — 8 interconnected rooms that form the first explorable biome region of Inkbinders. This turns the "5-room tech demo" world into a playable ~15 minute exploration section with environmental puzzles, vine traversal, enemy encounters, ability gates, and a mini-boss encounter.

This is the **first real content task** — all engine systems exist, the world assembly infrastructure exists, and the room editor exists. This task uses those systems to create actual game content. It's the bridge from "tech demo" to "game."

**Core design principle:** Each room should teach or test something. The Herbarium wing is the first biome the player encounters after leaving Scribe Hall, so it introduces the vine grapple mechanic, Margin Stitch usage, and Reader enemies gradually. Rooms progress from safe/tutorial to challenging. The player needs the Margin Stitch ability to fully explore the wing and the Redaction ability to access the mini-boss.

**Why now:** All 5 Phase 6 infrastructure tasks (world assembly, HUD, sprites, main menu, Gothic Errata) are in progress. When they land, the game needs actual content to play through. This task can be picked up as soon as the world assembly task completes (which provides the `GameWorld`, `WorldGraph`, `PlayerProgression` classes and the `demoWorld.ts` pattern).

## Dependencies

- `GameWorld`, `WorldGraph`, `PlayerProgression` (`src/engine/world/`) — from world-assembly task (may be landing imminently)
- `demoWorld.ts` pattern — for defining room data and world graph regions
- `RoomData` interface (`src/engine/world/Room.ts`) ✅
- `RoomManager` (`src/engine/world/RoomManager.ts`) ✅ — room loading, exits, transitions
- `presetRooms.ts` ✅ — existing rooms (Tutorial Corridor, Vertical Shaft, Vine Garden)
- `VineSystem` (`src/engine/world/VineSystem.ts`) ✅ — vine grapple mechanic
- `BiomeTheme` and `HERBARIUM_FOLIO_THEME` (`src/engine/world/Biome.ts`) ✅
- `BiomeBackground` (`createHerbariumBackground`) ✅
- Enemies: Reader, Binder, Proofwarden ✅
- Abilities: MarginStitch, Redaction, PasteOver ✅
- `AbilityGate` system in RoomData ✅
- Obstacle system (`src/engine/physics/Obstacles.ts`) ✅ — spikes, barriers, hazards
- Surface types (bouncy, icy, sticky, conveyor) ✅
- `TileMap`, `Platform` ✅

## Room Design: Herbarium Wing

The Herbarium Folio wing is a vertical-and-horizontal branch extending from the Tutorial Corridor (which connects to Scribe Hall). The theme is a botanical library wing — vine-covered stone, mossy platforms, and living plant-creatures.

### Room Layout / World Graph

```
                              [Scribe Hall]
                                    |
                            [Tutorial Corridor] ← already exists
                                    |
                         [Vine Vestibule] ← teaches vine basics
                           /              \
              [Overgrown Stacks]    [Root Cellar] ← underground path
                     |                     |
              [Canopy Walk]          [Mushroom Grotto]
                     |                     |
              [Thorn Gallery]        [Spore Chamber]
                     \                    /
                      [Herbarium Heart] ← mini-boss room
```

This creates a branching layout with two paths that converge at the Herbarium Heart (mini-boss). Players can explore either branch. The left path (Overgrown Stacks → Canopy Walk → Thorn Gallery) focuses on vine traversal and vertical platforming. The right path (Root Cellar → Mushroom Grotto → Spore Chamber) focuses on ability usage and enemy combat.

### Room Definitions

#### Room 1: Vine Vestibule (960×1080) — Vine Tutorial

**Purpose:** Introduce vine grapple mechanic in a safe environment.

```
┌──────────────────────────────────┐
│  [ceiling]                        │
│                                   │
│         ○ vine anchor 1           │
│                                   │
│    ┌──plat──┐                     │
│    └────────┘    ○ vine anchor 2  │
│                                   │
│                  ┌──plat──┐       │
│                  └────────┘       │
│                                   │
│         ○ vine anchor 3           │
│                                   │
│ [exit    ┌──────plat──────┐ exit] │
│  left]   └────────────────┘ right]│
│                                   │
│ ════════[floor]═══════════════════│
│ [exit                       exit  │
│  up to                     down   │
│  Tutorial]                 to     │
│                            Root]  │
└──────────────────────────────────┘
```

- **Size:** 960×1080 (tall room, emphasizes vertical movement)
- **Biome:** herbarium-folio
- **Vine anchors:** 3 anchors arranged vertically, teaching the player to swing and chain
- **Platforms:** Wide, forgiving platforms between vine anchors
- **Enemies:** None (tutorial room)
- **Exits:**
  - Top → Tutorial Corridor (back to hub path)
  - Left → Overgrown Stacks
  - Right → Root Cellar
- **Hazards:** None
- **Gates:** None
- **Design goal:** Player learns to attach to vines (E key), swing, and detach. Wide platforms make failure safe (fall back to floor).

#### Room 2: Overgrown Stacks (1920×1080) — Vine + Platforming

**Purpose:** Vine traversal combined with precision platforming over a hazard pit.

- **Size:** 1920×1080 (wide, horizontal focus)
- **Biome:** herbarium-folio
- **Vine anchors:** 5 anchors across the ceiling, requiring swing-to-swing chaining
- **Platforms:** Narrow platforms (96-128px) between vine sections
- **Floor:** Left third has floor; middle and right have a spike pit (fall = damage + respawn at last platform)
- **Enemies:** 2 Readers patrolling the narrow platforms
- **Exits:**
  - Right → Vine Vestibule (back)
  - Left → Canopy Walk
- **Hazards:** Spike strip along the pit floor
- **Gates:** None
- **Design goal:** Vine chaining across a dangerous gap. The Readers add pressure — the player must time their swings to avoid or fight enemies on landing platforms.

#### Room 3: Root Cellar (960×1080) — Underground Ability Puzzles

**Purpose:** Introduce ability gates and teach Margin Stitch usage.

- **Size:** 960×1080 (tall underground room)
- **Biome:** herbarium-folio (darker variant — add mossy stone platforms)
- **Vine anchors:** 1 (for reaching a high platform)
- **Platforms:** Stone ledges, some separated by solid walls
- **Floor:** Full floor at the bottom
- **Enemies:** 1 Binder (grapple enemy) guarding the gate area
- **Exits:**
  - Top → Vine Vestibule (back)
  - Bottom → Mushroom Grotto
- **Hazards:** 1 barrier obstacle blocking the bottom exit (requires Redaction OR going around)
- **Gates:** 1 Margin Stitch gate blocking a shortcut between two platforms — teaches that Margin Stitch creates passages through walls
- **Design goal:** The player encounters their first ability gate. If they have Margin Stitch, they can create a passage through a wall to reach a platform more easily. The bottom exit has a barrier that can be redacted if the player has that ability, or they can find an alternate path around it.

#### Room 4: Canopy Walk (1920×540) — Horizontal Vine Gauntlet

**Purpose:** Fast-paced horizontal vine traversal at height.

- **Size:** 1920×540 (wide and short — a canopy-level walkway)
- **Biome:** herbarium-folio
- **Vine anchors:** 6 anchors spaced along the ceiling — the player must chain all 6 to cross
- **Platforms:** Very narrow platforms (64px) between vine sections — basically just rest points
- **Floor:** No floor — fall = death/respawn at the entrance
- **Enemies:** 1 Reader on a central platform, 1 Proofwarden (shield enemy) near the exit
- **Exits:**
  - Right → Overgrown Stacks (back)
  - Left → Thorn Gallery
- **Hazards:** No floor (bottomless pit — respawn at room entrance)
- **Gates:** None
- **Design goal:** The most demanding vine room. The player has practiced vine basics in the Vestibule and chaining in the Stacks. Now they must chain 6 vines with narrow rest platforms and enemies. The Proofwarden near the exit requires combat during or between swings.

#### Room 5: Mushroom Grotto (1440×1080) — Surface Puzzle + Combat

**Purpose:** Introduce surface type gameplay and PasteOver ability in a combat context.

- **Size:** 1440×1080 (medium-wide, tall)
- **Biome:** herbarium-folio
- **Vine anchors:** 2 (for reaching upper sections)
- **Platforms:**
  - Several normal stone platforms
  - 2 bouncy platforms (mushroom caps — surface type: bouncy)
  - 1 icy platform (slippery moss)
  - 1 sticky platform (fungal adhesive)
- **Floor:** Partial floor with gaps
- **Enemies:** 2 Readers, 1 Binder
- **Exits:**
  - Top → Root Cellar (back)
  - Right → Spore Chamber
- **Hazards:** Spike strips at the bottom of gaps
- **Gates:** 1 PasteOver gate blocking a treasure alcove (optional — just for completionist exploration)
- **Surface mechanic:** The room is designed so the player can walk on a bouncy mushroom platform (which copies to their clipboard), then paste that bounce property onto a normal platform to reach a high ledge. This teaches PasteOver usage.
- **Design goal:** The player encounters multiple surface types and learns they can be copied and pasted. The combat encounters happen on/near special surfaces, creating interesting dynamics (fighting on ice is slippery, fighting near bounce pads sends enemies flying).

#### Room 6: Thorn Gallery (960×1080) — Vertical Combat Arena

**Purpose:** Dense enemy encounter with environmental hazards.

- **Size:** 960×1080 (tall, vertical arena)
- **Biome:** herbarium-folio
- **Vine anchors:** 2 (for dodging and repositioning)
- **Platforms:** Multi-level arena with platforms at 4 different heights
- **Floor:** Full floor
- **Enemies:** 3 Readers (patrol different levels), 1 Binder, 1 Proofwarden
- **Exits:**
  - Top → Canopy Walk (back)
  - Bottom → Herbarium Heart (through a Redaction gate)
- **Hazards:** Spike strips on 2 of the middle platforms (ceiling-mounted spikes that hang down), 1 laser hazard across a gap
- **Gates:** 1 Redaction gate blocking the exit to Herbarium Heart — the player must have Redaction ability to proceed to the mini-boss
- **Design goal:** A combat gauntlet. The multiple enemy types and hazards create a dynamic encounter that tests all of the player's movement skills (dash through lasers, wall-jump between levels, use vines to reposition). The Redaction gate ensures the player has the ability before facing the mini-boss.

#### Room 7: Spore Chamber (960×1080) — Environmental Puzzle

**Purpose:** Complex ability puzzle combining Margin Stitch and Redaction.

- **Size:** 960×1080 (tall)
- **Biome:** herbarium-folio
- **Vine anchors:** 1
- **Platforms:** Interconnected chambers separated by walls with specific gate requirements
- **Floor:** Segmented — different chambers at different levels
- **Enemies:** 1 Proofwarden guarding the exit
- **Exits:**
  - Left → Mushroom Grotto (back)
  - Bottom → Herbarium Heart
- **Hazards:** 2 barrier obstacles, 1 spike strip
- **Gates:**
  - 1 Margin Stitch gate (wall passage)
  - 1 Redaction gate (barrier removal)
- **Design goal:** A puzzle room. The player must use Margin Stitch to create a passage through one wall, then Redaction to remove a barrier in another section, navigating between chambers to reach the exit. This tests ability mastery before the mini-boss.

#### Room 8: Herbarium Heart (1440×1080) — Mini-Boss Arena

**Purpose:** Mini-boss encounter. A large Binder enemy (enhanced version) guards the deepest room.

- **Size:** 1440×1080 (wide arena)
- **Biome:** herbarium-folio
- **Vine anchors:** 4 (positioned around the arena for repositioning during the fight)
- **Platforms:** Arena layout — flat floor with 3 elevated platforms for tactical advantage
- **Floor:** Full floor (the mini-boss needs room to move)
- **Enemies:** 1 "Elder Binder" — a Binder with 3x HP, longer grapple range, and faster attacks
  - **Implementation:** Create the Elder Binder as a Binder enemy with modified params (not a full boss class). Increase health to 15 (vs normal 5), grapple range to 200 (vs 120), patrol range to 300.
  - When defeated, drop a notification: "Elder Binder defeated!" and record in progression
- **Exits:**
  - Top-left → Thorn Gallery (back)
  - Top-right → Spore Chamber (back)
  - **No forward exit** — this is a dead end. The reward is the defeat itself (and any future item/ability unlock placed here)
- **Hazards:** Spike strips along the edges (arena boundary)
- **Gates:** None (gates are on the entrances in Thorn Gallery and Spore Chamber)
- **Design goal:** A culminating encounter. The Elder Binder tests everything: vine repositioning, dash-dodging grapple attacks, and sustained combat. The 4 vine anchors let the player swing around the arena to evade. The enclosed space with spike edges creates tension.

## Files to Create

### 1. `src/engine/world/herbariumRooms.ts`

All 8 room definitions as `RoomData` constants. Follow the same pattern as `presetRooms.ts` and `scribeHall.ts`.

```typescript
import type { RoomData } from "./Room";

export const VINE_VESTIBULE: RoomData = { /* ... */ };
export const OVERGROWN_STACKS: RoomData = { /* ... */ };
export const ROOT_CELLAR: RoomData = { /* ... */ };
export const CANOPY_WALK: RoomData = { /* ... */ };
export const MUSHROOM_GROTTO: RoomData = { /* ... */ };
export const THORN_GALLERY: RoomData = { /* ... */ };
export const SPORE_CHAMBER: RoomData = { /* ... */ };
export const HERBARIUM_HEART: RoomData = { /* ... */ };

/** All Herbarium Wing room IDs */
export const HERBARIUM_WING_ROOM_IDS = [
  "vine-vestibule",
  "overgrown-stacks",
  "root-cellar",
  "canopy-walk",
  "mushroom-grotto",
  "thorn-gallery",
  "spore-chamber",
  "herbarium-heart",
] as const;
```

### 2. `src/app/test/herbarium-wing/page.tsx`

A test page at `/test/herbarium-wing` that lets the player explore the full Herbarium wing. This page wires up:
- `GameWorld` (if available) or manual `RoomManager` with all 8 rooms + Tutorial Corridor + Scribe Hall
- Full player movement with all abilities unlocked
- VineSystem for rooms with vine anchors
- Enemy spawning per room
- Surface types for the Mushroom Grotto
- Ability gates
- Room transitions
- Day/night cycle (optional — can be disabled by default, toggled in debug panel)
- Camera with smooth follow

**Debug panel:**
1. **World State** (expanded):
   - Current room name + ID
   - Rooms visited count / 10 total (8 wing rooms + Tutorial Corridor + Scribe Hall)
   - Gates opened count
   - Enemies defeated count

2. **Room Map** (expanded):
   - Text list of all rooms with [✓] visited markers
   - Current room highlighted
   - Shows connections

3. **Player Params** (collapsed):
   - Standard movement sliders

4. **Vine Params** (collapsed):
   - VineSystem tunable params (when in a vine room)

5. **Goals** (bottom):
   - Pass criteria checklist

## Files to Modify

### 3. `src/engine/world/demoWorld.ts` (or equivalent)

Add the Herbarium wing rooms to the world graph and rooms map:

```typescript
import {
  VINE_VESTIBULE,
  OVERGROWN_STACKS,
  ROOT_CELLAR,
  CANOPY_WALK,
  MUSHROOM_GROTTO,
  THORN_GALLERY,
  SPORE_CHAMBER,
  HERBARIUM_HEART,
} from "./herbariumRooms";

// Add to rooms map:
rooms.set("vine-vestibule", VINE_VESTIBULE);
rooms.set("overgrown-stacks", OVERGROWN_STACKS);
rooms.set("root-cellar", ROOT_CELLAR);
rooms.set("canopy-walk", CANOPY_WALK);
rooms.set("mushroom-grotto", MUSHROOM_GROTTO);
rooms.set("thorn-gallery", THORN_GALLERY);
rooms.set("spore-chamber", SPORE_CHAMBER);
rooms.set("herbarium-heart", HERBARIUM_HEART);

// Add to world graph regions:
{
  id: "herbarium-wing",
  name: "Herbarium Wing",
  biomeId: "herbarium-folio",
  roomIds: [
    "tutorial-corridor",  // already exists
    "vine-vestibule",
    "overgrown-stacks",
    "root-cellar",
    "canopy-walk",
    "mushroom-grotto",
    "thorn-gallery",
    "spore-chamber",
    "herbarium-heart",
  ],
},
```

### 4. `src/engine/world/presetRooms.ts`

Modify the Tutorial Corridor to add an exit down to the Vine Vestibule:

```typescript
// Add exit to TUTORIAL_CORRIDOR:
{
  direction: "down",
  zone: { x: 960 - 64, y: 540 - 16, width: 128, height: 16 },
  targetRoomId: "vine-vestibule",
  targetSpawnPoint: { x: 480, y: 100 },
},
```

### 5. `src/lib/testStatus.ts`

Add entry for the Herbarium Wing test page:
```typescript
{
  name: "Herbarium Wing",
  path: "/test/herbarium-wing",
  phase: 5,
  phaseName: "Content",
  status: "in-progress",
  description: "8 rooms: vine traversal, ability gates, mini-boss"
}
```

### 6. `AGENTS.md`

Add a "Room Content" section documenting:
- The room definition pattern (how to create new rooms)
- The Herbarium Wing layout and connections
- The Elder Binder mini-boss approach (modified Binder params)
- Room naming conventions (kebab-case IDs, descriptive display names)

## Specific Values & Constants

### Room Dimensions

| Room | Width | Height | Notes |
|------|-------|--------|-------|
| Vine Vestibule | 960 | 1080 | Tall, vertical focus |
| Overgrown Stacks | 1920 | 1080 | Wide, horizontal vine chaining |
| Root Cellar | 960 | 1080 | Tall underground |
| Canopy Walk | 1920 | 540 | Wide and short, no floor |
| Mushroom Grotto | 1440 | 1080 | Medium-wide, surface puzzles |
| Thorn Gallery | 960 | 1080 | Tall combat arena |
| Spore Chamber | 960 | 1080 | Tall ability puzzle |
| Herbarium Heart | 1440 | 1080 | Wide mini-boss arena |

### Enemy Placement

| Room | Readers | Binders | Proofwardens | Mini-Boss |
|------|---------|---------|--------------|-----------|
| Vine Vestibule | 0 | 0 | 0 | - |
| Overgrown Stacks | 2 | 0 | 0 | - |
| Root Cellar | 0 | 1 | 0 | - |
| Canopy Walk | 1 | 0 | 1 | - |
| Mushroom Grotto | 2 | 1 | 0 | - |
| Thorn Gallery | 3 | 1 | 1 | - |
| Spore Chamber | 0 | 0 | 1 | - |
| Herbarium Heart | 0 | 0 | 0 | Elder Binder |

### Vine Anchor Placement

| Room | Anchor Count | Notes |
|------|-------------|-------|
| Vine Vestibule | 3 | Vertical progression, wide swing arcs |
| Overgrown Stacks | 5 | Horizontal chain, ceiling-mounted |
| Root Cellar | 1 | Utility — reach a high platform |
| Canopy Walk | 6 | Full horizontal chain, demanding |
| Mushroom Grotto | 2 | Utility — reach upper sections |
| Thorn Gallery | 2 | Combat repositioning |
| Spore Chamber | 1 | Utility |
| Herbarium Heart | 4 | Arena repositioning during boss fight |

### Ability Gates

| Room | Gate Type | Purpose |
|------|-----------|---------|
| Root Cellar | Margin Stitch | Shortcut through a wall (optional) |
| Mushroom Grotto | Paste-Over | Access treasure alcove (optional) |
| Thorn Gallery | Redaction | Required — blocks path to mini-boss |
| Spore Chamber | Margin Stitch + Redaction | Puzzle — must use both to reach exit |

### Elder Binder (Mini-Boss) Params

| Param | Normal Binder | Elder Binder | Notes |
|-------|---------------|--------------|-------|
| Health | 5 | 15 | 3x HP |
| Grapple range | 120 | 200 | Longer reach |
| Patrol range | 100 | 300 | Wider arena coverage |
| Movement speed | normal | 1.2x | Slightly faster |
| Attack cooldown | normal | 0.8x | Attacks more frequently |

Create the Elder Binder by passing modified params to the existing Binder enemy constructor. Do NOT create a new enemy class — just override the relevant params.

### Surface Types (Mushroom Grotto)

| Platform | Surface | Color | Effect |
|----------|---------|-------|--------|
| Mushroom cap 1 | bouncy | green | Launches player upward on landing |
| Mushroom cap 2 | bouncy | green | Same |
| Moss patch | icy | light blue | Reduced friction, higher max speed |
| Fungal mat | sticky | purple | Increased friction, wall grip boost |

## Implementation Notes

1. **Dependency on world-assembly task.** This task needs `GameWorld`, `WorldGraph`, `PlayerProgression`, and the `demoWorld.ts` pattern to exist. If those files don't exist yet when this task is picked up, the agent should:
   - Create rooms in `herbariumRooms.ts` regardless (room data doesn't depend on GameWorld)
   - Build the test page using `RoomManager` directly (same pattern as the room-editor test page)
   - Add rooms to `demoWorld.ts` if it exists, or document the needed additions if it doesn't

2. **VineSystem wiring per room.** The test page must create a new `VineSystem` instance when entering a room with vine anchors, passing the room's `vineAnchors` array. When transitioning to a room without vines, set the vine system to null. The vine system state doesn't persist across rooms.

3. **Enemy creation per room.** Create enemy instances from the room's `enemies` array when entering. Destroy them on exit. Use the standard enemy factory pattern from the enemies test page. The Elder Binder is just a Binder with overridden params — no new class needed.

4. **Room connections must be bidirectional.** Every exit must have a corresponding exit in the target room pointing back. Double-check all 8 rooms' exits form a connected graph with no dead-end one-way doors (except Herbarium Heart, which has entrances from both Thorn Gallery and Spore Chamber but no forward exit).

5. **Surface type rooms.** The Mushroom Grotto platforms with surface types must set `surfaceType` on the Platform objects. The test page reads `tileMap.getGroundSurface()` each frame to apply surface modifiers to the player, same as the paste-over test page.

6. **Camera bounds per room.** Set camera bounds to the room dimensions on each room transition. Use `camera.setBounds(0, 0, room.width, room.height)`.

7. **Player spawn on room entry.** Use the exit's `targetSpawnPoint` for positioning. Set `player.x`/`player.y` directly during the transition fade-out.

8. **All rooms use HERBARIUM_FOLIO_THEME.** Set `tileMap.platformColor` and background rendering to match the theme. The Root Cellar can use slightly darker platform colors for variety but stays within the herbarium palette.

9. **The test page is a standalone experience.** It creates its own engine, player, and systems — it doesn't depend on the main game flow (`/play`). This is the standard test page pattern. The rooms are ALSO registered in the world graph for use by the real game, but the test page works independently.

10. **Platform sizing guidelines:**
    - Tutorial/safe rooms: Wide platforms (160-200px minimum)
    - Combat rooms: Medium platforms (96-128px)
    - Vine rooms: Narrow landing platforms (64-96px) between vine sections
    - Leave at least 64px vertical clearance for the player (48px hitbox + margin)

## Pass Criteria

1. **Vine Vestibule loads:** Room renders with herbarium theme, 3 vine anchors visible
2. **Vine tutorial works:** Player can attach, swing, and detach from vines in the Vestibule
3. **Room transition works:** Walking into an exit triggers fade-to-black transition
4. **All 8 rooms accessible:** Can navigate from Tutorial Corridor through all 8 rooms following the graph
5. **Bidirectional exits:** Can go forward and backtrack through every connection
6. **Enemies spawn:** Correct enemy types appear in each room
7. **Vine chaining:** Can chain swing across 5+ vines in Overgrown Stacks
8. **Margin Stitch gate:** Gate in Root Cellar opens with Margin Stitch ability
9. **Redaction gate:** Gate in Thorn Gallery opens with Redaction ability
10. **Surface types work:** Mushroom Grotto has functional bouncy/icy/sticky platforms
11. **PasteOver puzzle:** Can copy bouncy surface and paste it onto a normal platform in Mushroom Grotto
12. **Elder Binder fight:** Mini-boss in Herbarium Heart is beatable with enhanced stats
13. **Canopy Walk challenge:** Can traverse the 6-vine chain without falling (though falling respawns at entrance)
14. **Spore Chamber puzzle:** Both Margin Stitch and Redaction gates work to access the exit
15. **Biome theme consistent:** All rooms render with herbarium-folio colors and parallax background
16. **Camera bounds per room:** Camera stays within room bounds in every room
17. **No regressions:** Existing test pages work unchanged
18. **TypeScript strict:** `npx tsc --noEmit` passes

## Verification

- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` succeeds
- [ ] Navigate to `/test/herbarium-wing` — starts in Tutorial Corridor or Vine Vestibule
- [ ] Can navigate through all 8 rooms and back
- [ ] Vine mechanics work in rooms with vine anchors
- [ ] Enemies appear and are fightable in appropriate rooms
- [ ] Ability gates block/open correctly
- [ ] Surface types function in Mushroom Grotto
- [ ] Elder Binder mini-boss is a challenging but beatable encounter
- [ ] Room transitions are smooth (fade-to-black)
- [ ] Debug panel shows room map, visited count, and world state
- [ ] All pass criteria checkable on the test page
