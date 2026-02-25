# Astral Atlas Wing

## Goal

Create 8 interconnected rooms for the Astral Atlas Wing — the game's third region featuring low-gravity floating environments and gravity well mechanics. The Misprint Seraph boss lives in `seraph-spire` as the wing's final encounter. The Paste-Over ability shrine (`paste-shrine`) is mid-wing. Add an optional `gravityWells` field to `RoomData` so gravity well placement is declarative (matching the `vineAnchors` pattern).

---

## Context

### What exists today

- **`GravityWellSystem`** (`src/engine/world/GravityWellSystem.ts`) is fully built with attract/repel wells, force falloff, rendering, and debug overlays.
- **`GravityWell` interface**: `{ id, position, radius, strength, type: "attract"|"repel", active, color }`
- **`DEFAULT_GRAVITY_WELL_PARAMS`**: `globalGravityMultiplier=0.4`, `falloff=1.5`, `maxWellForce=400`, `affectsDash=false`
- **`ASTRAL_ATLAS_THEME`** biome theme is defined in `src/engine/world/Biome.ts` (deep navy, silver particles, purple/silver palette).
- **`createAstralAtlasBackground()`** generates 3-layer parallax background in `BiomeBackground.ts`.
- **Misprint Seraph** boss is fully built (`src/engine/entities/bosses/MisprintSeraph.ts`) with hover, dive, glyph-cast, stagger, death states. Tested on `/test/boss/misprint-seraph`.
- **`RoomData`** has `vineAnchors`, `abilityPickup`, `bossGate`, `enemies`, `gates`, `exits`, `obstacles` — but NO `gravityWells` field.
- **`upper-archives`** room (Central Archives) has a top exit already wired to `targetRoomId: "observatory-bridge"` with spawn `{ x: 64, y: 540 - 64 - T }`.
- **`paste-shrine`** room is being defined in `abilityShrineRooms.ts` (ability-shrine-rooms task in progress). It has `biomeId: "astral-atlas"`, Paste-Over ability pickup, and exits to `constellation-path` (bottom) and `nebula-crossing` (top). Import and include it in this wing's room registry.
- **`herbariumRooms.ts`** is the template for room file structure.
- **`centralArchivesRooms.ts`** shows the latest patterns: boss spawn with `type: "boss"` + `bossId`, boss gate with `bossGate` field.

### Design decisions

1. **Add `gravityWells` to `RoomData`**: New optional field, same as `vineAnchors`. Each entry is a `GravityWellDef` (simplified version of `GravityWell` — just `id`, `position`, `radius`, `strength`, `type`). The `loadRoomSystems` function in the play page / test page will create a `GravityWellSystem` from these defs when loading an Astral Atlas room.

2. **`GravityWellDef` interface** (add to `Room.ts`):
```typescript
/** Gravity well placement — used by GravityWellSystem */
export interface GravityWellDef {
  id: string;
  position: Vec2;
  radius: number;
  strength: number;
  type: "attract" | "repel";
}
```

3. **Global gravity multiplier**: All Astral Atlas rooms use `globalGravityMultiplier: 0.4` (applied by the play page when the biome is `"astral-atlas"`). This is NOT per-room — it's per-biome. The play page / test page applies this when entering an astral-atlas room.

4. **Misprint Seraph placement**: Use `enemies: [{ type: "boss", bossId: "misprint-seraph" }]` in `seraph-spire` + `bossGate` field to block post-boss exit until defeated.

5. **Paste-Over gate**: `nebula-crossing` has an AbilityGate requiring Paste-Over — blocks access to the deep wing until the player gets the ability at the shrine.

6. **Room file exports**: `ASTRAL_ATLAS_ROOMS` (Record) + `ASTRAL_ATLAS_ROOM_IDS` (array) + individual room constants.

---

## Files to Create

### `src/engine/world/astralAtlasRooms.ts` (new)

Main deliverable. Define 7 new rooms (observatory-bridge through seraph-spire). The 8th room (`paste-shrine`) is imported from `abilityShrineRooms.ts`.

**Use `const T = 32` for tile size.**

**Import pattern:**
```typescript
import type { RoomData } from "./Room";
import { EXIT_ZONE_DEPTH, GATE_WIDTH, GATE_HEIGHT } from "./Room";
```

**Export pattern:**
```typescript
export const ASTRAL_ATLAS_ROOMS: Record<string, RoomData> = {
  "observatory-bridge": OBSERVATORY_BRIDGE,
  "star-chart-hall": STAR_CHART_HALL,
  "constellation-path": CONSTELLATION_PATH,
  "nebula-crossing": NEBULA_CROSSING,
  "zero-g-vault": ZERO_G_VAULT,
  "orrery-chamber": ORRERY_CHAMBER,
  "seraph-spire": SERAPH_SPIRE,
};

export const ASTRAL_ATLAS_ROOM_IDS = [
  "observatory-bridge",
  "star-chart-hall",
  "constellation-path",
  "nebula-crossing",
  "zero-g-vault",
  "orrery-chamber",
  "seraph-spire",
] as const;
```

Note: `paste-shrine` is NOT included here — it's defined in `abilityShrineRooms.ts` and will be registered separately in the world graph assembly task. This room file just references it via exit `targetRoomId`.

#### Room 1: Observatory Bridge (`observatory-bridge`)

- **Size**: 1920×540 (wide, horizontal)
- **Biome**: `"astral-atlas"`
- **Role**: Entry room from Central Archives, introduces low gravity feeling
- **Default spawn**: `{ x: 64, y: 540 - 64 - T }` (matches upper-archives exit)

**Platforms:**
- Floor: `{ x: 0, y: 540 - T, width: 1920, height: T }`
- Ceiling: `{ x: 0, y: 0, width: 1920, height: T }`
- Left wall (gap for left exit): `{ x: 0, y: 0, width: T, height: 540 - 128 }`, `{ x: 0, y: 540 - 64, width: T, height: 64 }`
- Right wall (gap for right exit): `{ x: 1920 - T, y: 0, width: T, height: 540 - 128 }`, `{ x: 1920 - T, y: 540 - 64, width: T, height: 64 }`
- Floating platforms (emphasis on low-grav):
  - `{ x: 400, y: 360, width: 160, height: T }` — first floating island
  - `{ x: 700, y: 280, width: 128, height: T }` — higher floating
  - `{ x: 1000, y: 340, width: 192, height: T }` — mid-level rest point
  - `{ x: 1350, y: 260, width: 160, height: T }` — near-top floating
  - `{ x: 1600, y: 380, width: 128, height: T }` — descending toward exit

**Gravity wells:**
- Attract well 1: `{ id: "ob_attract_1", position: { x: 600, y: 320 }, radius: 200, strength: 150, type: "attract" }` — gentle pull between first platforms
- Attract well 2: `{ id: "ob_attract_2", position: { x: 1200, y: 300 }, radius: 220, strength: 180, type: "attract" }` — stronger pull in mid-section

**Exits:**
- Left → `upper-archives`: `{ direction: "left", zone: { x: 0, y: 540-128, width: EXIT_ZONE_DEPTH, height: 64 }, targetRoomId: "upper-archives", targetSpawnPoint: { x: 960, y: 64 } }`
- Right → `star-chart-hall`: `{ direction: "right", zone: { x: 1920 - EXIT_ZONE_DEPTH, y: 540-128, width: EXIT_ZONE_DEPTH, height: 64 }, targetRoomId: "star-chart-hall", targetSpawnPoint: { x: 64, y: 1080 - 64 - T } }`

**Enemies:**
- 1 Reader on the mid-level platform: `{ id: "ob_reader_1", position: { x: 1050, y: 340 - T }, type: "reader", patrolRange: 96, groundY: 340, facingRight: true }`

**Gates, obstacles**: None
**Vine anchors**: None (wrong biome)

#### Room 2: Star Chart Hall (`star-chart-hall`)

- **Size**: 1920×1080 (large)
- **Biome**: `"astral-atlas"`
- **Role**: Large exploration room, navigate between attract and repel wells
- **Default spawn**: `{ x: 64, y: 1080 - 64 - T }`

**Platforms:**
- Floor: `{ x: 0, y: 1080 - T, width: 1920, height: T }`
- Ceiling: `{ x: 0, y: 0, width: 1920, height: T }`
- Left wall (gap for left exit): `{ x: 0, y: 0, width: T, height: 1080 - 128 }`, `{ x: 0, y: 1080 - 64, width: T, height: 64 }`
- Right wall (gap for right exit): `{ x: 1920 - T, y: 0, width: T, height: 1080 - 128 }`, `{ x: 1920 - T, y: 1080 - 64, width: T, height: 64 }`
- Floating islands (constellation pattern):
  - `{ x: 300, y: 800, width: 192, height: T }` — lower left island
  - `{ x: 700, y: 650, width: 160, height: T }` — mid-left
  - `{ x: 1100, y: 500, width: 192, height: T }` — center
  - `{ x: 500, y: 400, width: 128, height: T }` — upper left
  - `{ x: 900, y: 300, width: 160, height: T }` — upper center
  - `{ x: 1400, y: 350, width: 192, height: T }` — upper right
  - `{ x: 1600, y: 600, width: 160, height: T }` — mid-right
  - `{ x: 1200, y: 800, width: 128, height: T }` — lower center-right

**Gravity wells:**
- Attract well 1: `{ id: "sch_attract_1", position: { x: 500, y: 550 }, radius: 250, strength: 200, type: "attract" }` — left cluster
- Attract well 2: `{ id: "sch_attract_2", position: { x: 1300, y: 450 }, radius: 250, strength: 200, type: "attract" }` — right cluster
- Attract well 3: `{ id: "sch_attract_3", position: { x: 900, y: 700 }, radius: 200, strength: 160, type: "attract" }` — center low
- Repel well: `{ id: "sch_repel_1", position: { x: 960, y: 200 }, radius: 200, strength: 250, type: "repel" }` — top center danger zone pushing players down

**Exits:**
- Left → `observatory-bridge`: `{ direction: "left", zone: { x: 0, y: 1080-128, width: EXIT_ZONE_DEPTH, height: 64 }, targetRoomId: "observatory-bridge", targetSpawnPoint: { x: 1920 - 80, y: 540 - 64 - T } }`
- Right → `constellation-path`: `{ direction: "right", zone: { x: 1920-EXIT_ZONE_DEPTH, y: 1080-128, width: EXIT_ZONE_DEPTH, height: 64 }, targetRoomId: "constellation-path", targetSpawnPoint: { x: 64, y: 1080 - 64 - T } }`
- Bottom → `nebula-crossing`: `{ direction: "bottom", zone: { x: 880, y: 1080 - EXIT_ZONE_DEPTH, width: 160, height: EXIT_ZONE_DEPTH }, targetRoomId: "nebula-crossing", targetSpawnPoint: { x: 64, y: 540 - 64 - T } }`

**Enemies:**
- 2 Readers: one on lower-left island, one on mid-right island
- 1 Binder: on center platform (thread reaches across gap)

#### Room 3: Constellation Path (`constellation-path`)

- **Size**: 960×1080 (tall, vertical)
- **Biome**: `"astral-atlas"`
- **Role**: Vertical ascent room, chain between gravity wells to climb upward
- **Default spawn**: `{ x: 64, y: 1080 - 64 - T }`

**Platforms:**
- Floor: `{ x: 0, y: 1080 - T, width: 960, height: T }`
- Left wall: `{ x: 0, y: 0, width: T, height: 1080 }`
- Right wall (gap for right exit to shrine): `{ x: 960 - T, y: 0, width: T, height: 520 }`, `{ x: 960 - T, y: 620, width: T, height: 460 }`
- Ceiling: `{ x: 0, y: 0, width: 960, height: T }`
- Floating platforms (ascending spiral pattern):
  - `{ x: 100, y: 900, width: 160, height: T }` — start
  - `{ x: 600, y: 750, width: 128, height: T }`
  - `{ x: 200, y: 600, width: 160, height: T }`
  - `{ x: 650, y: 450, width: 128, height: T }`
  - `{ x: 300, y: 300, width: 160, height: T }`
  - `{ x: 700, y: 180, width: 128, height: T }` — near top

**Gravity wells (4 attract, creating stepping-stone pull points):**
- `{ id: "cp_attract_1", position: { x: 350, y: 820 }, radius: 180, strength: 180, type: "attract" }`
- `{ id: "cp_attract_2", position: { x: 400, y: 660 }, radius: 180, strength: 180, type: "attract" }`
- `{ id: "cp_attract_3", position: { x: 450, y: 500 }, radius: 180, strength: 200, type: "attract" }`
- `{ id: "cp_attract_4", position: { x: 500, y: 300 }, radius: 180, strength: 200, type: "attract" }`

**Exits:**
- Left → `star-chart-hall`: `{ direction: "left", zone: { x: 0, y: 1080 - 128, width: EXIT_ZONE_DEPTH, height: 64 }, targetRoomId: "star-chart-hall", targetSpawnPoint: { x: 1920 - 80, y: 1080 - 64 - T } }`
- Right → `paste-shrine`: `{ direction: "right", zone: { x: 960 - EXIT_ZONE_DEPTH, y: 540, width: EXIT_ZONE_DEPTH, height: 80 }, targetRoomId: "paste-shrine", targetSpawnPoint: { x: 64, y: 1080 - 64 - T } }`

**Enemies:**
- 1 Proofwarden on an upper platform (shields + ranged challenge while climbing)

#### Room 4: Paste-Over Study (`paste-shrine`)

This room is defined in `abilityShrineRooms.ts` — NOT in this file. This wing references it via exit `targetRoomId: "paste-shrine"`.

The shrine's exits connect to:
- Bottom → `constellation-path` (return)
- Top → `nebula-crossing` (continues deeper into wing)

#### Room 5: Nebula Crossing (`nebula-crossing`)

- **Size**: 1920×540 (wide)
- **Biome**: `"astral-atlas"`
- **Role**: Wide gauntlet with repel wells pushing into hazards; requires Paste-Over
- **Default spawn**: `{ x: 64, y: 540 - 64 - T }`

**Platforms:**
- Floor: `{ x: 0, y: 540 - T, width: 1920, height: T }`
- Ceiling: `{ x: 0, y: 0, width: 1920, height: T }`
- Left wall: `{ x: 0, y: 0, width: T, height: 540 }`
- Right wall (gap for right exit): `{ x: 1920 - T, y: 0, width: T, height: 540 - 128 }`, `{ x: 1920 - T, y: 540 - 64, width: T, height: 64 }`
- Floating platforms (spread across, some with surface types):
  - `{ x: 300, y: 380, width: 160, height: T }` — safe island
  - `{ x: 600, y: 300, width: 128, height: T, surfaceType: "bouncy" }` — bouncy source (for paste-over)
  - `{ x: 900, y: 360, width: 192, height: T }` — mid rest point
  - `{ x: 1200, y: 280, width: 160, height: T }` — near repel zone
  - `{ x: 1500, y: 380, width: 128, height: T }` — before exit

**Gravity wells:**
- Repel well 1: `{ id: "nc_repel_1", position: { x: 750, y: 270 }, radius: 200, strength: 220, type: "repel" }` — pushes off platforms
- Repel well 2: `{ id: "nc_repel_2", position: { x: 1350, y: 250 }, radius: 220, strength: 250, type: "repel" }` — stronger push
- Attract well 1: `{ id: "nc_attract_1", position: { x: 500, y: 440 }, radius: 180, strength: 150, type: "attract" }` — floor anchor
- Attract well 2: `{ id: "nc_attract_2", position: { x: 1100, y: 440 }, radius: 180, strength: 150, type: "attract" }` — floor anchor

**Obstacles:**
- Spikes on ceiling sections: `{ id: "nc_spikes_1", rect: { x: 600, y: T, width: 300, height: T }, type: "spikes", damage: 1, solid: false }` — repel well pushes upward into these
- Spikes on ceiling section 2: `{ id: "nc_spikes_2", rect: { x: 1200, y: T, width: 300, height: T }, type: "spikes", damage: 1, solid: false }`

**Gates:**
- Paste-Over gate at x≈200 blocking entry: `{ id: "nc_gate_paste", rect: { x: 200, y: 540 - T - GATE_HEIGHT, width: GATE_WIDTH, height: GATE_HEIGHT }, requiredAbility: "paste-over", lockedColor: "#f59e0b", opened: false }`

**Exits:**
- Left → `star-chart-hall` (alternate entry path via bottom exit): `{ direction: "left", zone: { x: 0, y: 540 - 128, width: EXIT_ZONE_DEPTH, height: 64 }, targetRoomId: "star-chart-hall", targetSpawnPoint: { x: 960, y: 1080 - 64 - T } }`
- Right → `zero-g-vault`: `{ direction: "right", zone: { x: 1920 - EXIT_ZONE_DEPTH, y: 540 - 128, width: EXIT_ZONE_DEPTH, height: 64 }, targetRoomId: "zero-g-vault", targetSpawnPoint: { x: 64, y: 1080 - 64 - T } }`

**Enemies:**
- 2 Readers on floating platforms
- 1 Binder on mid rest point (thread + well combo)

#### Room 6: Zero-G Vault (`zero-g-vault`)

- **Size**: 960×1080 (tall)
- **Biome**: `"astral-atlas"`
- **Role**: Tall arena with pure low gravity (no wells), floating combat
- **Default spawn**: `{ x: 64, y: 1080 - 64 - T }`

**Platforms:**
- Floor: `{ x: 0, y: 1080 - T, width: 960, height: T }`
- Left wall: `{ x: 0, y: 0, width: T, height: 1080 }`
- Right wall (gap for right exit): `{ x: 960 - T, y: 0, width: T, height: 480 }`, `{ x: 960 - T, y: 600, width: T, height: 480 }`
- Ceiling: `{ x: 0, y: 0, width: 960, height: T }`
- Sparse floating platforms (combat arenas in the air):
  - `{ x: 200, y: 850, width: 200, height: T }` — low platform
  - `{ x: 560, y: 700, width: 192, height: T }` — mid
  - `{ x: 150, y: 550, width: 180, height: T }` — left mid
  - `{ x: 580, y: 400, width: 160, height: T }` — right upper
  - `{ x: 300, y: 250, width: 200, height: T }` — high

**Gravity wells:** None (pure low-grav room, `globalGravityMultiplier=0.4` only)

**Exits:**
- Left → `nebula-crossing`: `{ direction: "left", zone: { x: 0, y: 1080 - 128, width: EXIT_ZONE_DEPTH, height: 64 }, targetRoomId: "nebula-crossing", targetSpawnPoint: { x: 1920 - 80, y: 540 - 64 - T } }`
- Right → `orrery-chamber`: `{ direction: "right", zone: { x: 960 - EXIT_ZONE_DEPTH, y: 520, width: EXIT_ZONE_DEPTH, height: 80 }, targetRoomId: "orrery-chamber", targetSpawnPoint: { x: 64, y: 1080 - 64 - T } }`

**Enemies:**
- 2 Proofwardens on separated platforms (shields in low-grav means projectiles float longer)

#### Room 7: Orrery Chamber (`orrery-chamber`)

- **Size**: 1440×1080 (wide-tall)
- **Biome**: `"astral-atlas"`
- **Role**: Convergence room before the boss, dense enemy encounter with orbiting gravity wells
- **Default spawn**: `{ x: 64, y: 1080 - 64 - T }`

**Platforms:**
- Floor: `{ x: 0, y: 1080 - T, width: 1440, height: T }`
- Ceiling: `{ x: 0, y: 0, width: 1440, height: T }`
- Left wall (gap for left exit): `{ x: 0, y: 0, width: T, height: 1080 - 128 }`, `{ x: 0, y: 1080 - 64, width: T, height: 64 }`
- Right wall (gap for right exit): `{ x: 1440 - T, y: 0, width: T, height: 1080 - 128 }`, `{ x: 1440 - T, y: 1080 - 64, width: T, height: 64 }`
- Orbital ring of platforms:
  - `{ x: 200, y: 800, width: 160, height: T }`
  - `{ x: 550, y: 650, width: 160, height: T }`
  - `{ x: 900, y: 500, width: 192, height: T }`
  - `{ x: 600, y: 350, width: 160, height: T }`
  - `{ x: 250, y: 450, width: 160, height: T }`
  - `{ x: 1100, y: 700, width: 160, height: T }`
  - `{ x: 1200, y: 350, width: 160, height: T }`

**Gravity wells (3 attract forming a triangular pull pattern):**
- `{ id: "oc_attract_1", position: { x: 400, y: 600 }, radius: 280, strength: 220, type: "attract" }` — left
- `{ id: "oc_attract_2", position: { x: 1040, y: 600 }, radius: 280, strength: 220, type: "attract" }` — right
- `{ id: "oc_attract_3", position: { x: 720, y: 300 }, radius: 250, strength: 200, type: "attract" }` — top center

**Exits:**
- Left → `zero-g-vault`: `{ direction: "left", zone: { x: 0, y: 1080 - 128, width: EXIT_ZONE_DEPTH, height: 64 }, targetRoomId: "zero-g-vault", targetSpawnPoint: { x: 960 - 80, y: 540 } }`
- Right → `seraph-spire`: `{ direction: "right", zone: { x: 1440 - EXIT_ZONE_DEPTH, y: 1080 - 128, width: EXIT_ZONE_DEPTH, height: 64 }, targetRoomId: "seraph-spire", targetSpawnPoint: { x: 64, y: 1080 - 64 - T } }`

**Enemies:**
- 3 Readers (scattered on platforms, agile chasers in low grav)
- 1 Binder (upper platform, thread attack from height)
- 1 Proofwarden (center-right, shielded)

#### Room 8: Seraph's Spire (`seraph-spire`)

- **Size**: 1440×1080 (wide-tall)
- **Biome**: `"astral-atlas"`
- **Role**: Boss arena for Misprint Seraph, tall room for flight patterns
- **Default spawn**: `{ x: 64, y: 1080 - 64 - T }`

**Platforms:**
- Floor: `{ x: 0, y: 1080 - T, width: 1440, height: T }`
- Ceiling: `{ x: 0, y: 0, width: 1440, height: T }`
- Left wall (gap for entry): `{ x: 0, y: 0, width: T, height: 1080 - 128 }`, `{ x: 0, y: 1080 - 64, width: T, height: 64 }`
- Right wall (full — exit is top): `{ x: 1440 - T, y: 0, width: T, height: 1080 }`
- Combat platforms (sparse, give player vertical options vs flying boss):
  - `{ x: 200, y: 800, width: 256, height: T }` — left low
  - `{ x: 800, y: 750, width: 256, height: T }` — center low
  - `{ x: 400, y: 550, width: 224, height: T }` — left mid
  - `{ x: 900, y: 500, width: 224, height: T }` — right mid
  - `{ x: 600, y: 300, width: 256, height: T }` — center high
- Post-boss blocking platform (removed when Misprint Seraph is defeated):
  - `{ x: 580, y: T, width: 280, height: T }` — blocks ceiling exit

**Gravity wells (2 repel — push player into boss's dive paths):**
- `{ id: "ss_repel_1", position: { x: 360, y: 200 }, radius: 200, strength: 180, type: "repel" }` — top-left
- `{ id: "ss_repel_2", position: { x: 1080, y: 200 }, radius: 200, strength: 180, type: "repel" }` — top-right

**Boss:**
- `enemies: [{ id: "ss_seraph", position: { x: 720, y: 300 }, type: "boss", bossId: "misprint-seraph", groundY: 1080 - T, facingRight: true }]`

**Boss gate:**
- `bossGate: { bossId: "misprint-seraph", platformRect: { x: 580, y: T, width: 280, height: T } }`

**Exits:**
- Left → `orrery-chamber`: `{ direction: "left", zone: { x: 0, y: 1080 - 128, width: EXIT_ZONE_DEPTH, height: 64 }, targetRoomId: "orrery-chamber", targetSpawnPoint: { x: 1440 - 80, y: 1080 - 64 - T } }`
- Top → shortcut back to hub (or `observatory-bridge`): `{ direction: "top", zone: { x: 580, y: 0, width: 280, height: EXIT_ZONE_DEPTH }, targetRoomId: "observatory-bridge", targetSpawnPoint: { x: 960, y: 540 - 64 - T } }`

**No obstacles. No gates (boss itself IS the gate).**

---

## Files to Modify

### `src/engine/world/Room.ts`

Add the `GravityWellDef` interface and the optional `gravityWells` field to `RoomData`:

```typescript
/** Gravity well placement for the GravityWellSystem (Astral Atlas biome) */
export interface GravityWellDef {
  id: string;
  position: Vec2;
  radius: number;
  strength: number;
  type: "attract" | "repel";
}

// Add to RoomData interface:
export interface RoomData {
  // ... existing fields ...
  /** Gravity wells (Astral Atlas biome) */
  gravityWells?: GravityWellDef[];
}
```

### `src/engine/world/demoWorld.ts`

Register the Astral Atlas rooms and add the region to the world graph:

```typescript
import { ASTRAL_ATLAS_ROOMS, ASTRAL_ATLAS_ROOM_IDS } from "./astralAtlasRooms";
// If abilityShrineRooms.ts is available:
import { ABILITY_SHRINE_ROOMS } from "./abilityShrineRooms";

// In DEMO_WORLD_DATA.regions, add:
{
  id: "astral-atlas-wing",
  name: "Astral Atlas Wing",
  biomeId: "astral-atlas",
  roomIds: [...ASTRAL_ATLAS_ROOM_IDS, "paste-shrine"],
}

// In createDemoWorld(), add:
for (const [id, room] of Object.entries(ASTRAL_ATLAS_ROOMS)) {
  rooms.set(id, room);
}
// Register paste-shrine if available from ABILITY_SHRINE_ROOMS
if (ABILITY_SHRINE_ROOMS["paste-shrine"]) {
  rooms.set("paste-shrine", ABILITY_SHRINE_ROOMS["paste-shrine"]);
}
```

**Important**: The `ability-shrine-rooms` task is currently in progress. If `abilityShrineRooms.ts` doesn't exist yet when you build this, create a minimal placeholder paste-shrine room inline (matching the spec from the shrine task) and add a TODO comment. Alternatively, just skip registering it — the room exits to `paste-shrine` will gracefully fail (RoomManager logs a warning but doesn't crash).

### `src/engine/world/index.ts`

Add export for the new room file:

```typescript
export { ASTRAL_ATLAS_ROOMS, ASTRAL_ATLAS_ROOM_IDS } from "./astralAtlasRooms";
```

---

## How loadRoomSystems Should Handle Gravity Wells

The play page and test pages need to create a `GravityWellSystem` when entering an Astral Atlas room. This is NOT handled in the room file — it's handled in the game loop. The pattern:

```typescript
// In loadRoomSystems (play page or test page):
if (room.gravityWells && room.gravityWells.length > 0) {
  const wells = room.gravityWells.map(def => ({
    ...def,
    active: true,
    color: def.type === "attract" ? "#8b5cf6" : "#ef4444",
  }));
  gravityWellSystemRef.current = new GravityWellSystem(wells);
} else {
  gravityWellSystemRef.current = null;
}

// In update loop, if biome is astral-atlas:
if (biomeId === "astral-atlas") {
  // Apply global low gravity
  player.params.riseGravity = baseParams.riseGravity * 0.4;
  player.params.fallGravity = baseParams.fallGravity * 0.4;
  player.params.maxFallSpeed = baseParams.maxFallSpeed * 0.4;
}
if (gravityWellSystemRef.current) {
  gravityWellSystemRef.current.applyToVelocity(playerCenter, player.velocity, dt);
}
```

**This wiring is NOT part of this task** — it will be handled by the world-graph-assembly or the play page update in a later task. The room file just provides the data.

---

## Verification / Pass Criteria

1. **All 7 rooms** are defined in `astralAtlasRooms.ts` with correct platforms, exits, wells, enemies, and biome ID
2. **Exit wiring is correct**: observatory-bridge ← upper-archives, and all room-to-room exits have matching return exits
3. **Gravity well definitions** follow the `GravityWellDef` interface and are placed meaningfully per room design
4. **Misprint Seraph** boss is placed in `seraph-spire` with `type: "boss"`, `bossId: "misprint-seraph"`
5. **Boss gate** in seraph-spire blocks the post-boss exit until Misprint Seraph is defeated
6. **Paste-Over gate** in `nebula-crossing` blocks progress until ability is acquired
7. **`paste-shrine` exits** reference `constellation-path` and `nebula-crossing` (matching shrine task spec)
8. **`RoomData` interface** gains optional `gravityWells?: GravityWellDef[]` field
9. **`GravityWellDef` interface** is exported from `Room.ts`
10. **`demoWorld.ts`** registers all Astral Atlas rooms and adds the region to the world graph
11. **Export pattern** matches `herbariumRooms.ts`: Record + ID array + individual constants
12. **No breaks** to existing rooms — `gravityWells` field is optional
13. **TypeScript compiles** with no errors (`npx tsc --noEmit` passes)
14. **Enemy placement** follows difficulty tier 2–3: 1–4 enemies per room, no room exceeds 5
15. **Room sizes** follow established patterns (960×540, 960×1080, 1440×1080, 1920×540, 1920×1080)

---

## Notes

- The global gravity multiplier (0.4×) is applied per-biome at the game loop level, NOT per-room. The room file doesn't control this — it just provides well placement data. The play page checks `getBiomeId(roomId)` and applies the multiplier when it's `"astral-atlas"`.
- Repel wells near ceiling spikes (in nebula-crossing) create a natural hazard: the well pushes upward into the spikes. Players can dash through repel wells (dash is immune unless `affectsDash=true`).
- The Misprint Seraph boss start position (720, 300) is mid-air — the boss hovers, so it doesn't need a ground platform. The `groundY` field in EnemySpawn is used for regular enemies but should still be set for the spawn definition (use `1080 - T` as floor reference).
- The `paste-shrine` room from `abilityShrineRooms.ts` has bottom exit to `constellation-path` and top exit to `nebula-crossing`. This wing's rooms should have matching return exits. Constellation-path has a right exit to `paste-shrine`; nebula-crossing uses the bottom exit from star-chart-hall as its entry from the upper path.
- If `abilityShrineRooms.ts` doesn't exist yet: that's OK. Just define exits that target `paste-shrine` — `RoomManager` handles missing rooms gracefully with a console warning. The room will be wired once the shrine task completes.

---

## Implementation Summary

### Files Created
- `src/engine/world/astralAtlasRooms.ts` — 7 rooms: observatory-bridge, star-chart-hall, constellation-path, nebula-crossing, zero-g-vault, orrery-chamber, seraph-spire

### Files Modified
- `src/engine/world/Room.ts` — Added `GravityWellDef` interface and optional `gravityWells?: GravityWellDef[]` field to `RoomData`
- `src/engine/world/demoWorld.ts` — Imported and registered all Astral Atlas rooms + paste-shrine, added "astral-atlas-wing" region to world graph
- `src/engine/world/index.ts` — Exported `GravityWellDef`, `ASTRAL_ATLAS_ROOMS`, `ASTRAL_ATLAS_ROOM_IDS`

### What Was Built
- 7 rooms with gravity well mechanics (15 wells total: attract and repel)
- Misprint Seraph boss arena (seraph-spire) with bossGate blocking top exit
- Paste-Over ability gate in nebula-crossing
- Bidirectional exits between all rooms, with connections to Central Archives (upper-archives) and paste-shrine (from abilityShrineRooms.ts)
- Zero-g-vault as a pure low-gravity combat room (no wells)
- TypeScript compiles cleanly (`npx tsc --noEmit` passes)

---

## Review Notes

**Reviewed by:** 5632ca2d
**Date:** 2026-02-25

### Issues Found & Fixed

1. **constellation-path left wall blocked exit** — Left wall was full-height (`height: 1080`), blocking the left exit zone. Split into two wall segments with a 128px gap matching the exit zone location.

2. **nebula-crossing left wall blocked exit** — Left wall was full-height (`height: 540`), blocking the left exit zone to star-chart-hall. Split into two wall segments with a 128px gap.

3. **zero-g-vault left wall blocked exit** — Left wall was full-height (`height: 1080`), blocking the left exit zone to nebula-crossing. Split into two wall segments with a 128px gap.

All three followed the same pattern: the room had a left exit defined but the left wall platform was solid (no gap), making the exit unreachable. Fixed by splitting the wall into upper and lower segments with a gap matching the standard exit gap pattern used by other rooms (128px gap: `height: roomHeight - 128` top + `height: 64` bottom).

### Verified OK

- Room.ts `GravityWellDef` interface and optional `gravityWells` field on `RoomData` — correct, non-breaking
- demoWorld.ts registration of Astral Atlas rooms and paste-shrine — correct
- world/index.ts exports — all new types and constants exported
- All 7 rooms have correct biomeId, dimensions, platforms, exits, enemies, and gravity wells
- Bidirectional exit wiring is consistent across all room pairs
- Boss placement (seraph-spire) with bossGate correctly blocks top exit
- Paste-Over ability gate in nebula-crossing correctly placed
- Enemy counts per room within difficulty tier 2–3 limits
- TypeScript compiles cleanly after fixes
