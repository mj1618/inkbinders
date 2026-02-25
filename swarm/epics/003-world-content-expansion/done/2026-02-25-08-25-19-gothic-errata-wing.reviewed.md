# Gothic Errata Wing

## Goal

Create 8 interconnected rooms for the Gothic Errata Wing — the game's final and hardest region featuring fog-of-war, input inversion zones, and input scramble zones. The Index Eater boss lives in `eater-sanctum` as the wing's final encounter. The Index Mark ability shrine (`index-shrine`) is mid-wing. Add a `fogZones?: FogZoneDef[]` field to `RoomData` so fog zone placement is declarative (matching the `gravityWells` and `currentZones` pattern).

---

## Context

### What exists today

- **`FogSystem`** (`src/engine/world/FogSystem.ts`) is fully built with fog, inversion, and scramble zones. `FogZone` interface: `{ id, rect, type, density, active }`. `FogZoneType = "fog" | "inversion" | "scramble"`.
- **`DEFAULT_FOG_SYSTEM_PARAMS`**: `baseFogRadius=200`, `minFogRadius=80`, `dashClearsFog=true`, `controlTransitionDelay=10` frames.
- **`GOTHIC_ERRATA_THEME`** biome theme is defined in `src/engine/world/Biome.ts` (dark gray, crimson particles).
- **`createGothicErrataBackground()`** generates 3-layer parallax background in `BiomeBackground.ts`.
- **Index Eater** boss is fully built (`src/engine/entities/bosses/IndexEater.ts`) with crawl, lunge, devour, spit, stunned, death states. Has destructible platforms, ink flood zones, wall climbing (Phase 3). Tested on `/test/boss/index-eater`.
- **`upper-archives`** room (Central Archives) has an exit wired to `targetRoomId: "crypt-entrance"`.
- **`index-shrine`** room is defined in `src/engine/world/abilityShrineRooms.ts` with `biomeId: "gothic-errata"`, Index Mark ability pickup. Reference it from this wing rather than redefining.
- **`RoomData`** has `gravityWells?` and `currentZones?` but does NOT have `fogZones?` yet — this task adds it.
- **Pattern reference**: `astralAtlasRooms.ts` shows how to add a new biome-specific field to `RoomData` and define rooms using it.
- **`herbariumRooms.ts`** is the template for room file structure.
- **`centralArchivesRooms.ts`** shows boss spawn + bossGate pattern.

### Design decisions

1. **Add `FogZoneDef` to `Room.ts`**: New interface matching the `FogZone` interface but without `active` (always starts `true` at runtime):
```typescript
/** Fog zone placement — used by FogSystem (Gothic Errata biome) */
export interface FogZoneDef {
  id: string;
  rect: Rect;
  type: FogZoneType;  // import from FogSystem
  /** Fog density (0-1). Only meaningful for "fog" type zones. */
  density: number;
}
```

2. **Add `fogZones?: FogZoneDef[]` to `RoomData`** — optional, same pattern as `gravityWells` and `currentZones`.

3. **Import `FogZoneType`** from `FogSystem.ts` in `Room.ts`. If this causes circular dependency issues, duplicate the type (`"fog" | "inversion" | "scramble"`) inline in `Room.ts` instead.

4. **This is the hardest biome.** Enemy density is higher (2-5 per room), fog visibility is restricted, inversion/scramble zones disorient the player. Rooms should feel oppressive and tense, rewarding careful play and ability usage.

5. **Index Eater boss arena** uses fog zones + destructible platforms. The boss's `initDestructiblePlatforms()` is called with the arena's floor/mid/high platforms. The `onPlatformDestroyed` callback should rebuild the TileMap when platforms are destroyed.

---

## Files to Create

### `src/engine/world/gothicErrataRooms.ts` (new)

All 7 rooms (8th room `index-shrine` is in `abilityShrineRooms.ts`).

### Room Catalog

| Room ID | Name | Size | Fog Zones | Enemies | Gates | Focus |
|---------|------|------|-----------|---------|-------|-------|
| `crypt-entrance` | Crypt Entrance | 1920x540 | 1 fog (density 0.6) | 1 Reader | — | Entry room, introduce fog-of-war |
| `gargoyle-gallery` | Gargoyle Gallery | 1920x1080 | 2 fog (0.7, 0.8), 1 inversion | 2 Reader, 1 Binder | — | Large room, first inversion encounter |
| `bell-tower` | Bell Tower | 960x1080 | 1 fog (0.7), 1 scramble | 2 Proofwarden | Margin Stitch | Tall vertical climb, scramble zone mid-tower |
| `index-shrine` | Index Mark Archive | 960x1080 | 1 fog (0.6) | — | — | **Ability shrine** (defined in abilityShrineRooms.ts) |
| `mirror-hall` | Mirror Hall | 1920x540 | 3 inversion | 2 Reader, 1 Binder | Index Mark | Wide hall, constant inversion — Index Mark to teleport past |
| `scriptorium-ruin` | Scriptorium Ruin | 1440x1080 | 2 fog (0.8, 0.9), 1 scramble | 3 Reader, 2 Binder | — | Dense combat in reduced visibility |
| `collapsed-nave` | Collapsed Nave | 960x1080 | 1 fog (0.7), 2 inversion | 1 Proofwarden, 1 Binder | Redaction | Vertical arena, barriers + inversion |
| `eater-sanctum` | Eater's Sanctum | 1440x1080 | 2 fog (0.7, 0.8) | **Index Eater** (boss) | — | Boss arena, fog + destructible platforms |

### Room Layout

```
crypt-entrance → gargoyle-gallery → bell-tower (MS gate) → index-shrine
                                         |                       |
                              mirror-hall ← ← ← ← ← (Index Mark gate)
                                         |
                              scriptorium-ruin → collapsed-nave (Redaction gate) → eater-sanctum
```

### Exits (bidirectional)

```
upper-archives       ←left→  crypt-entrance
crypt-entrance       ←right→ gargoyle-gallery
gargoyle-gallery     ←top→   bell-tower
bell-tower           ←top→   index-shrine
index-shrine         ←bottom→ mirror-hall  (gate: Index Mark on mirror-hall side)
gargoyle-gallery     ←bottom→ mirror-hall  (secondary path once Index Mark is acquired)
mirror-hall          ←right→ scriptorium-ruin
scriptorium-ruin     ←right→ collapsed-nave
collapsed-nave       ←right→ eater-sanctum  (gate: Redaction on collapsed-nave side)
```

Note: `gargoyle-gallery → bell-tower` is the mandatory path. After getting Index Mark, the player can take the shortcut `index-shrine → mirror-hall` to skip back to the lower path without re-traversing gargoyle-gallery.

---

## Files to Modify

### `src/engine/world/Room.ts`

1. Add `FogZoneDef` interface (see design decisions above).
2. Add `fogZones?: FogZoneDef[]` to `RoomData` interface.
3. Import `FogZoneType` from `FogSystem.ts` (or define inline to avoid circular dependency: `type FogZoneType = "fog" | "inversion" | "scramble"`).

### `src/engine/world/demoWorld.ts`

1. Import `GOTHIC_ERRATA_ROOMS` and `GOTHIC_ERRATA_ROOM_IDS` from the new file.
2. Add "gothic-errata-wing" region to the world data.
3. Register all Gothic Errata rooms (including `index-shrine` from `abilityShrineRooms.ts`) into the rooms map.

---

## Room Specifications

### Room 1: Crypt Entrance (1920x540)

**Entry from Central Archives (upper-archives).** Introduces fog-of-war in a wide, horizontal room.

```
Platforms:
- Floor: full width at bottom (0, 508, 1920, 32)
- Ceiling: full width at top (0, 0, 1920, 32)
- Left wall: with gap for left exit near floor
- Right wall: with gap for right exit near floor
- Elevated platforms: 3 floating platforms at varying heights (300-400y)
  - (400, 380, 192, 32) — mid-left
  - (900, 340, 160, 32) — center
  - (1400, 360, 192, 32) — mid-right

Fog zones:
- 1 large fog zone covering center-right portion: { x: 600, y: 32, width: 1000, height: 476, type: "fog", density: 0.6 }
  (Player enters from left in clear air, fog starts mid-room — teaches the mechanic gently)

Obstacles:
- 2 spike clusters on floor (inside fog zone): (800, 476, 128, 32) and (1200, 476, 96, 32)

Enemies:
- 1 Reader on center platform, facing left (ambushes in fog)

Exits:
- Left → upper-archives (Central Archives)
- Right → gargoyle-gallery
```

### Room 2: Gargoyle Gallery (1920x1080)

**Large room with fog and the first inversion zone.** Two paths: up to bell-tower, down to mirror-hall (locked until Index Mark).

```
Platforms:
- Floor: full width at bottom
- Ceiling: full width at top
- Left wall: gap for left exit (returns from crypt-entrance)
- Right wall: solid (no right exit)
- Top gap: exit to bell-tower (centered, ~400px wide)
- Bottom gap: exit to mirror-hall (right side, ~160px wide)
- Interior platforms (staircase-like, ascending left to right):
  - (200, 800, 256, 32)
  - (550, 650, 192, 32)
  - (900, 500, 256, 32)
  - (1250, 400, 192, 32)
  - (1500, 280, 256, 32)
- Central column: (920, 500, 64, 580) — divides lower portion

Fog zones:
- Fog 1 (lower-left): { x: 0, y: 600, width: 900, height: 480, type: "fog", density: 0.7 }
- Fog 2 (upper-right): { x: 1000, y: 0, width: 920, height: 500, type: "fog", density: 0.8 }
- Inversion 1 (central band): { x: 600, y: 400, width: 700, height: 200, type: "inversion", density: 0 }

Obstacles:
- Spikes on central column edges: (884, 500, 32, 64) left side, (988, 500, 32, 64) right side

Enemies:
- 2 Readers: one on platform at (550, 650), one at (1250, 400)
- 1 Binder: on platform at (900, 500), controls central area

Exits:
- Left → crypt-entrance
- Top (centered, 400px wide) → bell-tower
- Bottom (right side, 160px wide) → mirror-hall (blocked by Index Mark gate)

Gates:
- Index Mark gate at bottom exit to mirror-hall
```

### Room 3: Bell Tower (960x1080)

**Tall vertical climb through fog with a scramble zone mid-tower.** Requires Margin Stitch to enter (gate at gargoyle-gallery's top exit).

```
Platforms:
- Floor: full width at bottom
- Ceiling: full width at top (gap for top exit to index-shrine)
- Left wall: solid
- Right wall: solid
- Bottom gap: exit back to gargoyle-gallery
- Ascending platforms (zigzag climb):
  - (64, 900, 192, 32)
  - (700, 780, 192, 32)
  - (128, 650, 192, 32)
  - (600, 530, 256, 32) — scramble zone starts here
  - (64, 400, 192, 32)
  - (700, 280, 192, 32)
  - (128, 160, 256, 32) — near top exit

Fog zones:
- Fog (full tower): { x: 0, y: 200, width: 960, height: 700, type: "fog", density: 0.7 }
- Scramble (mid-tower band): { x: 0, y: 450, width: 960, height: 250, type: "scramble", density: 0 }

Obstacles:
- Spikes on walls at scramble zone height: (0, 500, 32, 96) left, (928, 500, 32, 96) right
- Spike strip between platforms: (350, 650, 64, 32)

Enemies:
- 2 Proofwarden: one at (700, 780), one at (128, 400) — shielded enemies in fog are very dangerous

Gates:
- Margin Stitch gate at bottom exit (gargoyle-gallery side)

Exits:
- Bottom → gargoyle-gallery
- Top → index-shrine
```

### Room 4: Index Shrine (960x1080)

**Defined in `abilityShrineRooms.ts`** — reference only, do NOT redefine.

The shrine room should already have:
- `biomeId: "gothic-errata"`
- Index Mark ability pickup
- Fog zone covering bottom portion (density 0.6)
- Teaching puzzle: two platforms far apart with fog between — place mark, walk through fog, teleport back
- Exits: bottom → bell-tower, and a second exit to mirror-hall

**Important**: Check the actual `abilityShrineRooms.ts` file for exact exit definitions. This wing's rooms must have matching bidirectional exits.

If `index-shrine` doesn't have an exit to `mirror-hall`, add one:
- Bottom exit from `index-shrine` → `mirror-hall` (player drops down after getting ability, blocked by Index Mark gate on the mirror-hall side)

### Room 5: Mirror Hall (1920x540)

**Wide hall dominated by 3 inversion zones.** The entire room tests the player's ability to navigate with reversed controls, or use Index Mark to teleport through. Gated by Index Mark.

```
Platforms:
- Floor: full width at bottom
- Ceiling: full width at top
- Left wall: gap for top-left entry from gargoyle-gallery/index-shrine
- Right wall: gap for right exit to scriptorium-ruin
- 4 floating platforms at varying heights:
  - (300, 380, 128, 32)
  - (700, 320, 128, 32)
  - (1100, 360, 128, 32)
  - (1500, 300, 128, 32)

Fog zones:
- Inversion 1: { x: 100, y: 32, width: 500, height: 476, type: "inversion", density: 0 }
- Inversion 2: { x: 700, y: 32, width: 500, height: 476, type: "inversion", density: 0 }
- Inversion 3: { x: 1300, y: 32, width: 520, height: 476, type: "inversion", density: 0 }
(Almost the entire room is inverted — only narrow gaps between zones offer normal controls)

Obstacles:
- Spike strip on floor between inversions: (600, 476, 100, 32), (1200, 476, 100, 32)
- Laser at mid-height: { x: 400, y: 250, width: 200, height: 8 } — oscillating, damage in inversion

Enemies:
- 2 Readers: patrol on floor in inversion zones (extra disorienting)
- 1 Binder: on elevated platform at (700, 320), grapple attack while player is inverted

Gates:
- Index Mark gate at left entry (from gargoyle-gallery bottom exit / index-shrine)

Exits:
- Left → gargoyle-gallery (bottom exit)
- Top → index-shrine (if shrine has matching exit)
- Right → scriptorium-ruin
```

### Room 6: Scriptorium Ruin (1440x1080)

**Dense combat in severely reduced visibility.** Multiple fog zones with high density and a scramble zone create a terrifying combat arena.

```
Platforms:
- Floor: full width at bottom
- Ceiling: full width at top
- Left wall: gap for left exit from mirror-hall
- Right wall: gap for right exit to collapsed-nave
- Multi-level arena platforms:
  - (200, 800, 320, 32) — lower-left
  - (800, 800, 320, 32) — lower-right
  - (100, 600, 256, 32) — mid-left
  - (600, 550, 256, 32) — mid-center
  - (1100, 600, 256, 32) — mid-right
  - (400, 350, 320, 32) — upper-center
  - (900, 300, 320, 32) — upper-right

Fog zones:
- Fog 1 (lower half, very dense): { x: 0, y: 550, width: 1440, height: 530, type: "fog", density: 0.8 }
- Fog 2 (upper area): { x: 0, y: 100, width: 1440, height: 400, type: "fog", density: 0.9 }
- Scramble (mid-band between fogs): { x: 300, y: 450, width: 800, height: 150, type: "scramble", density: 0 }
(The narrow band between fog zones has scrambled controls — moving between levels is treacherous)

Obstacles:
- Spike clusters on floor: 3 sets
- Barrier in mid-center (can be redacted for shortcut): (680, 550, 32, 96), solid

Enemies:
- 3 Readers: scattered across lower platforms, patrol in fog
- 2 Binders: one mid-left (100, 600), one mid-right (1100, 600) — grapple attacks from fog

Exits:
- Left → mirror-hall
- Right → collapsed-nave
```

### Room 7: Collapsed Nave (960x1080)

**Vertical arena with inversion zones and a Redaction gate.** Tests mastery of multiple mechanics.

```
Platforms:
- Floor: full width at bottom
- Ceiling: full width at top
- Left wall: gap for left exit from scriptorium-ruin
- Right wall: gap for right exit to eater-sanctum (through Redaction gate)
- Vertical platforms (ascending):
  - (64, 900, 256, 32) — bottom-left
  - (640, 800, 256, 32) — bottom-right
  - (200, 650, 192, 32) — mid-left
  - (600, 500, 192, 32) — mid-right (inversion zone)
  - (128, 350, 256, 32) — upper-left (inversion zone)
  - (640, 200, 256, 32) — upper-right (near exit)

Fog zones:
- Fog (covers most of room): { x: 0, y: 200, width: 960, height: 700, type: "fog", density: 0.7 }
- Inversion 1 (mid-right): { x: 480, y: 400, width: 480, height: 250, type: "inversion", density: 0 }
- Inversion 2 (upper-left): { x: 0, y: 200, width: 480, height: 250, type: "inversion", density: 0 }

Obstacles:
- Barrier blocking right exit: { x: 750, y: 350, width: 32, height: 128 }, solid=true — redactable
- Spikes on walls inside inversion zones: (0, 500, 32, 64), (928, 350, 32, 64)

Enemies:
- 1 Proofwarden: on upper-left platform (128, 350) — shields up in inversion zone
- 1 Binder: on mid-right platform (600, 500) — grapple in fog

Gates:
- Redaction gate at right exit to eater-sanctum

Exits:
- Left → scriptorium-ruin
- Right → eater-sanctum
```

### Room 8: Eater's Sanctum (1440x1080)

**Boss arena for the Index Eater.** Fog limits visibility during the fight. Destructible platforms shrink the arena.

```
Platforms:
- Floor (2 segments with gap for arena center):
  - (0, 1048, 600, 32) — left floor
  - (840, 1048, 600, 32) — right floor
- Ceiling: full width at top
- Left wall: gap for left exit from collapsed-nave
- Right wall: solid (dead end — boss must be defeated to exit)
- Mid-level platforms (destructible):
  - (200, 700, 256, 32) — mid_1
  - (600, 600, 256, 32) — mid_2
  - (1000, 700, 256, 32) — mid_3
  - (400, 450, 256, 32) — mid_4
- High platforms (destructible):
  - (100, 300, 192, 32) — high_1
  - (600, 250, 256, 32) — high_2
  - (1100, 300, 192, 32) — high_3
- Floor platforms (destructible):
  - Full floor segments: 6 floor sections at y=1048

Fog zones:
- Fog 1 (lower half): { x: 0, y: 550, width: 1440, height: 530, type: "fog", density: 0.7 }
- Fog 2 (upper half): { x: 0, y: 0, width: 1440, height: 500, type: "fog", density: 0.8 }
(Small clear band in the middle — the "safe zone" shrinks as platforms are devoured)

Obstacles: None (boss IS the hazard)

Enemies:
- Index Eater boss: { type: "boss", bossId: "index-eater", position: { x: 720, y: 1016 }, groundY: 1048 }

Boss gate:
- After defeating Index Eater, open a right-side exit (post-boss passage)
- Use `bossGate` field: { bossId: "index-eater", platformRect: <right wall blocking platform> }
- The boss gate platform is part of the right wall that opens after defeat

Post-boss:
- Right exit leads back to hub (shortcut) or could be an endgame exit
- For now, wire it to "scribe-hall" as a post-boss shortcut return

Exits:
- Left → collapsed-nave
- Right → scribe-hall (blocked by boss gate, opens after boss defeat)
```

---

## Index Eater Integration

The Index Eater boss has specific requirements:

1. **Destructible platforms**: Call `indexEater.initDestructiblePlatforms(floors, mids, highs)` with the arena's platform arrays. The boss devours platforms during Phase 2+.

2. **`onPlatformDestroyed` callback**: When a platform is destroyed, the TileMap must be rebuilt without that platform. The test page pattern from `/test/boss/index-eater` shows how:
```typescript
indexEater.onPlatformDestroyed = () => {
  const activePlatforms = indexEater.getActivePlatforms();
  // Rebuild tilemap with remaining platforms + walls/ceiling
};
```

3. **Arena floor gap**: The center floor gap (`600-840, 1048`) is a fall-off hazard from the start. This creates tension and limits the player's safe ground.

4. **Fog during boss fight**: The two fog zones limit visibility throughout the fight. The boss can attack from fog, and the player must track audio/visual cues. Dash clears fog temporarily.

5. **Surface attachment**: The Index Eater crawls on walls and ceiling in Phase 3. Ensure the room has solid walls for the boss to traverse (only the left wall has an exit gap, and only at the bottom).

---

## Pass Criteria

1. All 8 rooms load and connect with bidirectional exits (7 in `gothicErrataRooms.ts` + `index-shrine` from `abilityShrineRooms.ts`)
2. `FogZoneDef` interface added to `Room.ts` and `fogZones?` field on `RoomData`
3. Every room has correct `biomeId: "gothic-errata"` (dark gray, crimson theme)
4. `FogSystem` can be created from each room's `fogZones` data
5. Fog zones limit visibility correctly (dash clears temporarily)
6. Inversion zones swap left/right input (red edge tint visible)
7. Scramble zones randomize directional input (green glitch effect visible)
8. Index Mark shrine (from `abilityShrineRooms.ts`) unlocks the ability
9. Margin Stitch gate in bell-tower blocks until ability is acquired
10. Index Mark gate in mirror-hall blocks until ability is acquired
11. Redaction gate in collapsed-nave blocks until ability is acquired
12. Index Eater boss fight works in eater-sanctum:
    - Destructible platforms are devoured during Phase 2+
    - TileMap rebuilds when platforms are destroyed
    - Boss crawls on walls/ceiling in Phase 3
    - Fog persists during the entire fight
13. Post-boss gate opens after Index Eater is defeated
14. Enemy density follows difficulty tier 4 (2-5 enemies per room)
15. No room has more than 5 enemies
16. Every room with enemies has at least one safe landing zone
17. All rooms registered in `demoWorld.ts` under "gothic-errata-wing" region

---

## Verification

After implementing, the developer should:

1. Build check: `npx tsc --noEmit` passes
2. All rooms should be importable and their IDs should resolve in the world graph
3. Each room's exits should have matching return exits in target rooms (verify bidirectionality)
4. The `index-shrine` room from `abilityShrineRooms.ts` should be included in the wing's room registry
5. Fog zones should create valid `FogSystem` instances (no zero-size zones, no overlapping inversion+scramble)

---

## Implementation Summary

### Files Created
- **`src/engine/world/gothicErrataRooms.ts`** — 7 rooms: crypt-entrance, gargoyle-gallery, bell-tower, mirror-hall, scriptorium-ruin, collapsed-nave, eater-sanctum. Each room has fog zones, appropriate enemies (tier 4 difficulty, 1-5 per room), and gates.

### Files Modified
- **`src/engine/world/Room.ts`** — Added `FogZoneDef` interface and `fogZones?: FogZoneDef[]` field to `RoomData`. Imported `FogZoneType` from `FogSystem.ts`.
- **`src/engine/world/abilityShrineRooms.ts`** — Fixed index-shrine: added gap in left wall for bell-tower entry, added `fogZones` array (1 fog zone, density 0.6), fixed mirror-hall spawn point to fit 540px room height.
- **`src/engine/world/demoWorld.ts`** — Imported `GOTHIC_ERRATA_ROOMS`/`GOTHIC_ERRATA_ROOM_IDS`, added "gothic-errata-wing" region, registered all Gothic Errata rooms + index-shrine in `createDemoWorld()`.

### What Was Built
- 8 interconnected rooms (7 new + 1 existing shrine) with full fog/inversion/scramble zone coverage
- All rooms use `biomeId: "gothic-errata"` (dark gray, crimson particles)
- Fog zones: 17 total across all 8 rooms (fog, inversion, scramble types)
- Gates: Margin Stitch (bell-tower), Index Mark (gargoyle-gallery bottom, mirror-hall left), Redaction (collapsed-nave right)
- Index Eater boss in eater-sanctum with boss gate, destructible platforms, and fog zones
- All bidirectional exits verified within the wing
- External connections: upper-archives ↔ crypt-entrance, eater-sanctum → scribe-hall (post-boss)
- `npx tsc --noEmit` passes cleanly

---

## Review Notes

**Reviewer**: a03bd04e
**Date**: 2026-02-25

### Fixes Applied

1. **Gargoyle-gallery floor gap for bottom exit** (`gothicErrataRooms.ts`):
   The floor was full-width (`width: 1920`) which blocked the bottom exit to mirror-hall at `x: 1600`. Split the floor into two segments (`width: 1600` and `width: 160`) leaving a gap at `x: 1600–1760` so the player can fall through to trigger the exit zone.

2. **Bell-tower floor gap for bottom exit** (`gothicErrataRooms.ts`):
   Same issue — full-width floor (`width: 960`) blocked the bottom exit to gargoyle-gallery at `x: 400`. Split into two segments (`width: 400` and `width: 400`) with a gap at `x: 400–560` matching the exit zone position.

3. **Index Eater boss spawn position** (`gothicErrataRooms.ts`):
   The boss was spawning at `x: 720` which is inside the center floor gap (`x: 600–840`). Moved to `x: 900` to place the boss on the right floor segment (`x: 840–1440`).

### Verified — No Issues

- **Room.ts**: `FogZoneDef` interface and `fogZones?` field on `RoomData` are clean. `FogZoneType` import from `FogSystem.ts` works without circular dependency.
- **abilityShrineRooms.ts**: `index-shrine` has correct left wall gap for bell-tower entry, fog zone, and exits to bell-tower (left) and mirror-hall (top).
- **demoWorld.ts**: Gothic Errata rooms and index-shrine correctly registered in world graph and room map.
- **Exit bidirectionality**: All room connections verified — upper-archives ↔ crypt-entrance, gargoyle-gallery ↔ bell-tower, bell-tower ↔ index-shrine, index-shrine ↔ mirror-hall, gargoyle-gallery ↔ mirror-hall, mirror-hall ↔ scriptorium-ruin, scriptorium-ruin ↔ collapsed-nave, collapsed-nave ↔ eater-sanctum, eater-sanctum → scribe-hall.
- **Enemy placements**: All enemies are positioned on valid platforms with correct `groundY` values.
- **Fog zones**: All zones have non-zero dimensions, no overlapping inversion+scramble conflicts.
- **`npx tsc --noEmit`**: Passes cleanly after fixes.
