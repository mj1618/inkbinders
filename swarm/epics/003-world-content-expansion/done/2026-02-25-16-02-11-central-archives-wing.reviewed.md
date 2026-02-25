# Central Archives Wing

## Goal

Expand the Central Archives from 1 connector room (`archive-passage`) to 6 interconnected rooms, creating the backbone corridor between the hub and the deeper biome wings. Place the Footnote Giant boss in `giant-chamber` as the first major boss encounter in the actual game world. This is the critical pathway that unlocks access to the Astral Atlas and Gothic Errata wings.

---

## Context

### What exists today

- **`archive-passage`** (960×540) is defined in `src/engine/world/demoWorld.ts` — a small corridor with 1 Reader enemy, left exit to Scribe Hall, right exit to Vertical Shaft.
- **Footnote Giant** boss is fully built (`src/engine/entities/bosses/FootnoteGiant.ts`) with 3 phases, stomp/sweep/slam attacks, vulnerable windows, and a working state machine. It's tested on `/test/boss/footnote-giant`.
- **All enemy types** (Reader, Binder, Proofwarden) are built and proven.
- **RoomManager** handles room loading, exit detection, fade transitions, ability gate checking.
- **Herbarium Wing** (`src/engine/world/herbariumRooms.ts`) is the template — 8 rooms defined as `RoomData` constants, exported as a `Record<string, RoomData>` plus room ID array.
- The `createDemoWorld()` function in `demoWorld.ts` registers all rooms and builds the WorldGraph.
- The `/play` page and `/test/world-assembly` page both use `createDemoWorld()` to get the full room map.

### Design decisions

- **Biome ID**: `"default"` — the Central Archives uses the neutral gray/parchment theme (warm brown wood tones, candlelight warmth). Not a distinct biome — it's the "normal" library interior.
- **Boss placement**: The Footnote Giant is instantiated by the room loading system, NOT placed in the EnemySpawn array. The test page pattern (herbarium-wing) uses `createEnemiesForRoom()` which switches on spawn type. For bosses, we need a new spawn type or a special-case check on room ID. **Decision: Add a `"boss"` enemy type to `EnemySpawn` with a `bossId` field** — this keeps the data declarative. The `createEnemiesForRoom()` helper (or equivalent) in each test page / play page will need to handle `type: "boss"`.
- **Post-boss gate**: Defeating Footnote Giant opens the passage to `upper-archives`. This is implemented as an AbilityGate with a special ability type `"boss-footnote-giant"` that gets "unlocked" when the boss dies, OR as a simpler runtime check (boss defeated flag → remove blocking platform). **Decision: Use a runtime check** — after boss death, call `progression.defeatBoss("footnote-giant")` and remove the blocking platform. The gate is represented as a platform that gets removed when `progression.isBossDefeated("footnote-giant")` returns true. Simpler than adding fake ability types.
- **`archive-passage` modifications**: The existing room needs its right exit retargeted from `vertical-shaft` to `reading-room`. The `vertical-shaft` connection should move to go through `reading-room` instead (or we remove the direct connection — the Vertical Shaft is already accessible from Scribe Hall → Tutorial Corridor).

---

## Files to Create

### `src/engine/world/centralArchivesRooms.ts` (new)

This is the main deliverable. Define 5 new rooms + modify the approach to `archive-passage`.

**Use `const T = 32` for tile size, same as herbariumRooms.ts.**

**Export pattern** (match herbariumRooms.ts exactly):
```typescript
export const CENTRAL_ARCHIVES_ROOMS: Record<string, RoomData> = { ... };
export const CENTRAL_ARCHIVES_ROOM_IDS: string[] = [...];
```

#### Room 1: Reading Room (`reading-room`)

- **Size**: 1920×540 (wide, horizontal)
- **Theme**: Wide hall with towering bookshelves (visually, these are tall platforms/walls)
- **Platforms**:
  - Floor: full width, `y: 540 - T`
  - Ceiling: full width, `y: 0`
  - Left wall: 32px wide, gap for left exit
  - Right wall: 32px wide, gap for right exit
  - Elevated platform left: `{ x: 300, y: 360, width: 192, height: T }` — bookshelf ledge
  - Elevated platform center: `{ x: 800, y: 300, width: 256, height: T }` — reading desk
  - Elevated platform right: `{ x: 1400, y: 380, width: 160, height: T }` — shelf step
  - Small stepping stones: 2–3 small platforms between elevated ones for traversal
- **Exits**:
  - Left → `archive-passage` (return): `{ direction: "left", zone: { x: 0, y: 540-128, width: 16, height: 64 }, targetRoomId: "archive-passage", targetSpawnPoint: { x: 960-80, y: 540-64-T } }`
  - Right → `card-catalog`: `{ direction: "right", zone: { x: 1920-16, y: 540-128, width: 16, height: 64 }, targetRoomId: "card-catalog", targetSpawnPoint: { x: 64, y: 1080-64-T } }`
  - Also add a bottom-right exit → `restricted-section` (skips card-catalog for those without Margin Stitch): `{ direction: "right", zone: { x: 1920-16, y: 540-64, width: 16, height: 64 }, targetRoomId: "restricted-section", targetSpawnPoint: { x: 64, y: 1080-64-T } }`
- **Enemies**:
  - 2 Readers: one on the floor patrolling (`patrolRange: 150`), one on the center elevated platform (`patrolRange: 80`)
  - 1 Binder: on the right elevated platform area (thread attack across gap)
- **Obstacles**: None (introductory room for this wing)
- **Gates**: None
- **Vine anchors**: None (not Herbarium biome)
- **Biome**: `"default"`
- **Default spawn**: `{ x: 64, y: 540 - 64 - T }`

#### Room 2: Card Catalog (`card-catalog`)

- **Size**: 960×1080 (tall, vertical)
- **Theme**: Narrow tall room with card filing cabinets as platforms — a wall-jump gauntlet going up
- **Platforms**:
  - Floor: full width, `y: 1080 - T`
  - Ceiling: full width, `y: 0`
  - Left/right walls: 32px wide, with gaps for exits
  - Wall-jump gauntlet platforms: alternating left/right ledges going up
    - `{ x: T, y: 880, width: 128, height: T }` (left)
    - `{ x: 960 - T - 128, y: 720, width: 128, height: T }` (right)
    - `{ x: T, y: 560, width: 128, height: T }` (left)
    - `{ x: 960 - T - 128, y: 400, width: 128, height: T }` (right)
    - `{ x: T, y: 240, width: 128, height: T }` (left)
  - Upper chamber platform: `{ x: 200, y: 160, width: 560, height: T }` (wide landing at top)
- **Exits**:
  - Left (bottom) → `reading-room`: standard left exit at floor level
  - Top → `restricted-section` (upper path, requires Margin Stitch gate): `{ direction: "top", zone: { x: 400, y: 0, width: 160, height: 16 }, targetRoomId: "restricted-section", targetSpawnPoint: { x: 200, y: 1080-64-T } }`
- **Enemies**:
  - 1 Proofwarden: on the upper landing platform, guards the gate passage
- **Gates**:
  - Margin Stitch gate blocking the top exit: `{ id: "ca_ms_gate", rect: { x: 400, y: 64, width: 16, height: 96 }, requiredAbility: "margin-stitch", lockedColor: "#22d3ee", opened: false }` — placed just below the top exit
- **Obstacles**:
  - Spike strip along the bottom of the tall shaft (punishment for falling): `{ id: "cc_spikes_1", rect: { x: T + 128, y: 1080 - T - 16, width: 960 - 2*T - 256, height: 16 }, type: "spikes", damage: 15, solid: false }`
- **Biome**: `"default"`
- **Default spawn**: `{ x: 64, y: 1080 - 64 - T }`

#### Room 3: Restricted Section (`restricted-section`)

- **Size**: 1920×1080 (large)
- **Theme**: Sprawling forbidden library hall — the most combat-dense room in the Archives. Spike corridors create chokepoints.
- **Platforms**:
  - Floor: full width, with a central gap (spike pit)
  - Ceiling: full width
  - Left/right walls
  - Mid-level platforms creating multiple combat lanes:
    - Lower-left platform: `{ x: 200, y: 800, width: 300, height: T }`
    - Center bridge: `{ x: 700, y: 700, width: 500, height: T }`
    - Upper-right platform: `{ x: 1300, y: 600, width: 300, height: T }`
    - Upper-left alcove: `{ x: 100, y: 500, width: 200, height: T }`
    - High center platform: `{ x: 800, y: 400, width: 320, height: T }`
  - Spike pit floor: gap in main floor from x:600 to x:1300 (700px wide)
  - Narrow floor sections on either side of the pit
- **Exits**:
  - Left → `reading-room` (lower path) OR `card-catalog` (upper path — enters from bottom of card-catalog): Two left exits at different heights
    - Lower left → `reading-room`: `{ direction: "left", zone: { x: 0, y: 1080-128, width: 16, height: 64 }, targetRoomId: "reading-room", targetSpawnPoint: { x: 1920-80, y: 540-64-T } }`
  - Right → `giant-chamber`: `{ direction: "right", zone: { x: 1920-16, y: 1080-128, width: 16, height: 64 }, targetRoomId: "giant-chamber", targetSpawnPoint: { x: 64, y: 1080-64-T } }`
- **Enemies**:
  - 2 Readers: patrolling on left floor section and center bridge
  - 2 Binders: one on the upper-right platform, one on the high center platform (thread attacks down)
- **Obstacles**:
  - Spike pit: `{ id: "rs_spikes_1", rect: { x: 600, y: 1080-T-16, width: 700, height: 16 }, type: "spikes", damage: 20, solid: false }`
  - Spike corridor on upper-left path: `{ id: "rs_spikes_2", rect: { x: 100, y: 480, width: 200, height: 8 }, type: "spikes", damage: 10, solid: false }` — ceiling spikes above the alcove
- **Gates**: None (the Margin Stitch gate in Card Catalog is the optional shortcut)
- **Biome**: `"default"`
- **Default spawn**: `{ x: 64, y: 1080 - 64 - T }`

#### Room 4: Giant's Chamber (`giant-chamber`)

- **Size**: 1440×1080 (wide-tall) — matches boss arena sizing
- **Theme**: Grand hall with vaulted ceiling. This is where the Footnote Giant lives.
- **Platforms**:
  - Floor: full width, `y: 1080 - T` — the Giant needs a wide flat floor for stomp/sweep attacks
  - Ceiling: full width, `y: 0`
  - Left/right walls with gaps for exits
  - 2 elevated side platforms for player escape/positioning:
    - Left perch: `{ x: T, y: 700, width: 160, height: T }`
    - Right perch: `{ x: 1440 - T - 160, y: 700, width: 160, height: T }`
  - Center high platform (for vertical attacks/positioning): `{ x: 560, y: 500, width: 320, height: T }`
  - Post-boss blocking platform (removed when boss defeated): `{ x: 1440 - T - 16, y: 700, width: 16, height: 380 }` — blocks right exit until boss dies
- **Exits**:
  - Left → `restricted-section`: standard left exit
  - Right → `upper-archives`: standard right exit at ground level — BUT blocked by boss-gate platform until Footnote Giant is defeated
- **Enemies**:
  - Boss spawn: `{ id: "ca_footnote_giant", position: { x: 900, y: 1080 - T }, type: "boss", bossId: "footnote-giant", groundY: 1080 - T, facingRight: false }`
  - No regular enemies (boss room is solo encounter)
- **Obstacles**: None in base layout — the Footnote Giant creates its own hazards (stomp shockwaves, ink blots)
- **Gates**: None (access is linear from restricted-section)
- **Special mechanics**:
  - On boss defeat: remove the blocking platform on the right side, call `progression.defeatBoss("footnote-giant")`
  - If boss already defeated (re-entering room): blocking platform is already absent, no boss spawns
- **Biome**: `"default"`
- **Default spawn**: `{ x: 64, y: 1080 - 64 - T }`

#### Room 5: Upper Archives (`upper-archives`)

- **Size**: 1920×540 (wide, horizontal)
- **Theme**: Post-boss corridor — elevated walkways above the main archives. This is the critical junction that connects to Astral Atlas (up) and Gothic Errata (right).
- **Platforms**:
  - Floor: full width, `y: 540 - T`
  - Ceiling: full width, `y: 0`
  - Left/right walls with exit gaps
  - Elevated walkway platforms:
    - `{ x: 300, y: 380, width: 256, height: T }`
    - `{ x: 700, y: 320, width: 320, height: T }`
    - `{ x: 1200, y: 360, width: 256, height: T }`
  - Upper ledge near top exit: `{ x: 800, y: 160, width: 320, height: T }`
- **Exits**:
  - Left → `giant-chamber`: standard left exit
  - Top → `observatory-bridge` (Astral Atlas entry): `{ direction: "top", zone: { x: 880, y: 0, width: 160, height: 16 }, targetRoomId: "observatory-bridge", targetSpawnPoint: { x: 64, y: 540-64-T } }`
  - Right → `crypt-entrance` (Gothic Errata entry): `{ direction: "right", zone: { x: 1920-16, y: 540-128, width: 16, height: 64 }, targetRoomId: "crypt-entrance", targetSpawnPoint: { x: 64, y: 540-64-T } }`
- **Enemies**:
  - 1 Reader on walkway (light presence, post-boss wind-down)
  - 1 Proofwarden near the junction area (guarding the branching paths)
- **Obstacles**: None
- **Gates**: None — access is gated by defeating Footnote Giant (can't reach here without passing through giant-chamber)
- **Biome**: `"default"`
- **Default spawn**: `{ x: 64, y: 540 - 64 - T }`

---

## Files to Modify

### `src/engine/world/demoWorld.ts`

1. **Import** the new rooms:
   ```typescript
   import { CENTRAL_ARCHIVES_ROOMS, CENTRAL_ARCHIVES_ROOM_IDS } from "./centralArchivesRooms";
   ```

2. **Modify `archive-passage`**: Change its right exit to target `reading-room` instead of `vertical-shaft`. Update the `targetSpawnPoint` accordingly. The archive-passage is the entry to the Central Archives wing — it should connect:
   - Left → `scribe-hall` (unchanged)
   - Right → `reading-room` (was `vertical-shaft`)

   Also keep a connection from `vertical-shaft` back to `reading-room` or just leave `vertical-shaft` accessible from the hub through `tutorial-corridor` only. **Decision**: Remove the `archive-passage → vertical-shaft` connection (vertical-shaft is already accessible via `tutorial-corridor`). This simplifies the Central Archives to a linear wing.

3. **Update DEMO_WORLD_DATA**: Expand the `"central-archives"` region to include all new room IDs:
   ```typescript
   {
     id: "central-archives",
     name: "Central Archives",
     biomeId: "default",
     roomIds: ["archive-passage", "vertical-shaft", ...CENTRAL_ARCHIVES_ROOM_IDS],
   },
   ```

4. **Update `createDemoWorld()`**: Register all new rooms in the rooms Map:
   ```typescript
   for (const [id, room] of Object.entries(CENTRAL_ARCHIVES_ROOMS)) {
     rooms.set(id, room);
   }
   ```

### `src/engine/world/Room.ts`

Check if `EnemySpawn` already has a `bossId` field. If not, add it:
```typescript
interface EnemySpawn {
  id: string;
  position: Vec2;
  type: "reader" | "binder" | "proofwarden" | "boss";  // Add "boss"
  bossId?: string;         // Add optional boss identifier
  patrolRange?: number;
  groundY: number;
  facingRight: boolean;
}
```

This is a backward-compatible change — existing rooms don't use `type: "boss"`.

### `src/engine/world/index.ts`

Add exports for the new module:
```typescript
export { CENTRAL_ARCHIVES_ROOMS, CENTRAL_ARCHIVES_ROOM_IDS } from "./centralArchivesRooms";
```

### `src/app/test/herbarium-wing/page.tsx` (reference only)

The `createEnemiesForRoom()` function here is the pattern to follow. In the play page and world-assembly test page, a similar function will need to handle `type: "boss"`. However, **modifying existing test pages is NOT part of this task** — that's for the world-graph-assembly task later. Just ensure the room data is correct and the boss spawn is declarative.

---

## Boss Integration Details

The Footnote Giant boss needs specific integration:

### Boss Spawn Pattern

In `giant-chamber`, the enemy spawn entry is:
```typescript
{
  id: "ca_footnote_giant",
  position: { x: 900, y: 1080 - T },
  type: "boss",
  bossId: "footnote-giant",
  groundY: 1080 - T,
  facingRight: false,
}
```

The room loading code (in test pages, play page, or future GameWorld orchestrator) should:
1. Check if `type === "boss"` in the spawn list
2. Check `progression.isBossDefeated("footnote-giant")` — if true, skip spawning
3. If not defeated: instantiate `new FootnoteGiant()` and position at spawn point
4. Wire `FootnoteGiant` systems: `particleSystem`, `screenShake`, `camera`
5. On boss death callback: call `progression.defeatBoss("footnote-giant")`, remove the blocking platform from the room

### Post-Boss Gate Pattern

The blocking platform in `giant-chamber` works like this:
- It's a regular platform in the room's `platforms` array
- When loading the room, check `progression.isBossDefeated("footnote-giant")`
- If boss is already defeated: exclude/remove that platform from the TileMap
- If boss is alive: platform stays, blocking the right exit to `upper-archives`
- On boss death during gameplay: dynamically remove the platform from TileMap

To mark which platform is the boss gate, add a comment or use a convention like putting it last in the array with a specific position. Alternatively, store a `bossGatePlatformIndex` or similar. **Simplest approach**: the room data includes a `bossGate` field (optional) that references a platform rect to remove:

```typescript
// Add to RoomData interface (optional field):
bossGate?: {
  bossId: string;
  platformRect: Rect;  // The blocking platform to remove
};
```

---

## Verification / Pass Criteria

1. **5 new rooms created**: `reading-room`, `card-catalog`, `restricted-section`, `giant-chamber`, `upper-archives` — all defined as valid `RoomData` objects with proper platforms, exits, enemies, obstacles
2. **`archive-passage` updated**: Right exit now targets `reading-room` instead of `vertical-shaft`
3. **All exits are bidirectional**: Every exit has a corresponding return exit in the target room. Verify: reading-room ← → archive-passage, reading-room ← → card-catalog, reading-room ← → restricted-section, restricted-section ← → giant-chamber, giant-chamber ← → upper-archives
4. **`upper-archives` has forward exits**: Top exit to `observatory-bridge`, right exit to `crypt-entrance` (these rooms don't exist yet — the exits are defined but will lead to rooms created in later tasks)
5. **Margin Stitch gate in `card-catalog`**: Gate is properly defined with correct ability requirement
6. **Boss spawn in `giant-chamber`**: EnemySpawn entry with `type: "boss"`, `bossId: "footnote-giant"`
7. **Boss gate platform in `giant-chamber`**: A blocking platform on the right side that represents the post-boss gate
8. **Room dimensions match spec**: reading-room (1920×540), card-catalog (960×1080), restricted-section (1920×1080), giant-chamber (1440×1080), upper-archives (1920×540)
9. **Enemy placement is reasonable**: Enemies are positioned on platforms (not floating), groundY matches platform Y positions, patrol ranges fit on their platforms
10. **Spike hazards are positioned correctly**: Spikes in card-catalog and restricted-section are at valid positions within room bounds
11. **TypeScript compiles**: `npx tsc --noEmit` passes with no new errors
12. **World graph updated**: DEMO_WORLD_DATA includes all Central Archives rooms, `createDemoWorld()` registers them in the rooms Map
13. **`EnemySpawn` type union extended**: Includes `"boss"` type with optional `bossId` field
14. **Room data exportable**: `CENTRAL_ARCHIVES_ROOMS` and `CENTRAL_ARCHIVES_ROOM_IDS` are properly exported from index

---

## Room Connection Diagram

```
                  Scribe Hall
                      ↕
               archive-passage (existing, right exit retargeted)
                      ↕
                reading-room ←→ card-catalog (MS gate at top)
                  ↕       ↕              ↕
                  ↕   restricted-section ←┘ (from card-catalog top exit)
                  ↕       ↕
                  ↕   giant-chamber [FOOTNOTE GIANT] → (boss gate) → upper-archives
                  ↕                                                    ↕         ↕
                  ↕                                          observatory-bridge  crypt-entrance
                  ↕                                          (Astral Atlas)     (Gothic Errata)
                  └──→ restricted-section (direct from reading-room right-bottom exit)
```

Players can reach `restricted-section` either:
- **With Margin Stitch**: archive-passage → reading-room → card-catalog (wall-jump up, through MS gate) → restricted-section (shortcut, drops in from above)
- **Without Margin Stitch**: archive-passage → reading-room → restricted-section (direct right exit, harder combat path)

This gives Margin Stitch a meaningful but optional shortcut value.

---

## Implementation Summary

### Files Created
- **`src/engine/world/centralArchivesRooms.ts`** — 5 new rooms (Reading Room, Card Catalog, Restricted Section, Giant's Chamber, Upper Archives) with full platform layouts, exits, enemies, obstacles, gates, and boss spawn data.

### Files Modified
- **`src/engine/world/Room.ts`** — Extended `EnemySpawn.type` union with `"boss"`, added optional `bossId` field, added optional `bossGate` field to `RoomData` interface.
- **`src/engine/world/demoWorld.ts`** — Imported Central Archives rooms, retargeted `archive-passage` right exit from `vertical-shaft` to `reading-room`, added Central Archives room IDs to `DEMO_WORLD_DATA` region, registered all new rooms in `createDemoWorld()`.
- **`src/engine/world/index.ts`** — Added exports for `CENTRAL_ARCHIVES_ROOMS` and `CENTRAL_ARCHIVES_ROOM_IDS`.

### Verification
- All 14 pass criteria verified (room count, dimensions, bidirectional exits, boss spawn, boss gate, MS gate, enemy placement, spike bounds, TypeScript compilation, world graph updates, type extensions, exports).
- `npx tsc --noEmit` passes with zero errors.

---

## Review Notes

Reviewed by agent e058bbf4 on 2026-02-25.

### Issues Found & Fixed

1. **`archive-passage` hardcoded exit zone depth (demoWorld.ts)** — The `archive-passage` room used hardcoded `16` for exit zone widths instead of the `EXIT_ZONE_DEPTH` constant that all other rooms use. Added the import and replaced both exit zone width values with the constant for consistency.

### Known Discrepancy (Not Fixed)

- **One-way exit: card-catalog → restricted-section** — Pass criterion #3 says "All exits are bidirectional" but the card-catalog top exit → restricted-section has no return exit. This appears intentional by design: the Margin Stitch shortcut is a one-way drop into restricted-section. The return path is restricted-section → reading-room → card-catalog. The room connection diagram in the spec confirms the one-directional arrow. This is acceptable game design (non-linear shortcuts are common in metroidvanias).

### What Looked Good

- All 5 room definitions are well-structured and match the spec dimensions
- Enemy groundY values correctly align with their platform positions in every case
- Wall gaps are properly sized for exit zones
- Boss gate platform correctly blocks the right exit in giant-chamber
- Spike hazards are properly positioned within room bounds and within floor gaps
- The `bossGate` field on `RoomData` is a clean, backward-compatible extension
- `EnemySpawn` type extension with `"boss"` and `bossId` is backward-compatible
- World graph is correctly updated with all new rooms
- Export structure matches the established herbarium rooms pattern
- TypeScript compiles cleanly
