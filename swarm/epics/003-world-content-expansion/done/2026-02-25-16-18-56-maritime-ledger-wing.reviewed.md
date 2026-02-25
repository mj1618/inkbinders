# Maritime Ledger Wing

## Goal

Create 8 interconnected rooms for the Maritime Ledger Wing — the game's fourth region featuring ocean currents, pulsing gusts, whirlpools, and jet streams. The Tide Scribe mini-boss (an enhanced Proofwarden) lives in `tide-scribe-arena`. The Redaction ability shrine (`redaction-shrine`) is mid-wing. Add a `currentZones` field to `RoomData` so current placement is declarative (matching the `gravityWells`/`vineAnchors` pattern).

---

## Context

### What exists today

- **`CurrentSystem`** (`src/engine/world/CurrentSystem.ts`) is fully built with stream, gust, whirlpool, and jet zone types, force application, rendering, and debug overlays.
- **`CurrentZone` interface**: `{ id, rect, direction, strength, active, type: "stream"|"gust"|"whirlpool"|"jet", clockwise?, gustOnDuration?, gustOffDuration?, gustTimer? }`
- **`DEFAULT_CURRENT_PARAMS`**: `globalStrengthMultiplier=1.0`, `groundedMultiplier=0.4`, `maxCurrentVelocity=500`, `dashOverridesCurrent=true`
- **`MARITIME_LEDGER_THEME`** biome theme is defined in `src/engine/world/Biome.ts` (dark ocean navy `#0a1628`, teal/sand palette).
- **`createMaritimeLedgerBackground()`** generates 3-layer parallax background in `BiomeBackground.ts`.
- **Proofwarden** enemy (`src/engine/entities/enemies/Proofwarden.ts`) is fully built — shield, slam attack, patrol. The Tide Scribe mini-boss uses Proofwarden with overridden params (same pattern as Elder Binder in herbariumRooms.ts).
- **`RoomData`** already has `vineAnchors`, `gravityWells?` (added by Astral Atlas task), `abilityPickup`, `bossGate`, `enemies`, `gates`, `exits`, `obstacles` — but NO `currentZones` field yet.
- **`redaction-shrine`** room is already defined in `abilityShrineRooms.ts`. It has `biomeId: "maritime-ledger"`, Redaction ability pickup, and exits to `cargo-hold` (left) and `storm-channel` (right). Import and include it in this wing's room registry.
- **`herbariumRooms.ts`** is the canonical template for room file structure.
- **`centralArchivesRooms.ts`** shows the latest patterns: boss spawn with `type: "boss"` + `bossId`, boss gate with `bossGate` field.
- **Elder Binder** in `herbariumRooms.ts` shows the mini-boss pattern: `ELDER_BINDER_PARAMS` exported, `type: "binder"` in enemies array, room-loading code applies the params.

### Design decisions

1. **Add `currentZones` to `RoomData`**: New optional field, same pattern as `gravityWells`. Each entry is a `CurrentZoneDef` — a simplified serializable version of `CurrentZone` (no internal timer state). The `loadRoomSystems` function in the play page will create a `CurrentSystem` from these defs when loading a Maritime Ledger room.

2. **`CurrentZoneDef` interface** (add to `Room.ts`):
```typescript
/** Current zone placement — used by CurrentSystem */
export interface CurrentZoneDef {
  id: string;
  rect: Rect;
  direction: Vec2;
  strength: number;
  type: "stream" | "gust" | "whirlpool" | "jet";
  clockwise?: boolean;        // Whirlpool only
  gustOnDuration?: number;    // Gust only (default 2.0)
  gustOffDuration?: number;   // Gust only (default 1.5)
  gustOffset?: number;        // Stagger offset for gust timer (seconds)
}
```

3. **Tide Scribe mini-boss**: Uses Proofwarden class with `TIDE_SCRIBE_PARAMS` override. NOT a formal boss — no `bossGate` field. The enemy spawn uses `type: "proofwarden"` with `id: "ml_tide_scribe"`. Arena currents shift dynamically as part of the room's current system.

4. **No hub connection in this task**: The `harbor-approach` room needs a left exit pointing to `"scribe-hall"`, but the corresponding exit on Scribe Hall will be added in the hub-expansion task. For now, just define the exit — it will connect when the world graph is assembled.

---

## Files to Create

### `src/engine/world/maritimeLedgerRooms.ts` (new)

Main deliverable. Define 7 new rooms (harbor-approach through tide-scribe-arena). The 8th room (`redaction-shrine`) is imported from `abilityShrineRooms.ts`.

**Use `const T = 32` for tile size.**

**Import pattern:**
```typescript
import type { RoomData, CurrentZoneDef } from "./Room";
import { EXIT_ZONE_DEPTH, GATE_WIDTH, GATE_HEIGHT } from "./Room";
```

**Export pattern:**
```typescript
export const MARITIME_LEDGER_ROOMS: Record<string, RoomData> = {
  "harbor-approach": HARBOR_APPROACH,
  "tide-pool-cavern": TIDE_POOL_CAVERN,
  "cargo-hold": CARGO_HOLD,
  "storm-channel": STORM_CHANNEL,
  "whirlpool-depths": WHIRLPOOL_DEPTHS,
  "lighthouse-tower": LIGHTHOUSE_TOWER,
  "tide-scribe-arena": TIDE_SCRIBE_ARENA,
};

export const MARITIME_LEDGER_ROOM_IDS = [
  "harbor-approach",
  "tide-pool-cavern",
  "cargo-hold",
  "storm-channel",
  "whirlpool-depths",
  "lighthouse-tower",
  "tide-scribe-arena",
] as const;

export { TIDE_SCRIBE_PARAMS };
```

Note: `redaction-shrine` is NOT included in this file — it's defined in `abilityShrineRooms.ts` and will be registered separately in the world graph assembly task. This room file just references it via exit `targetRoomId`.

---

## Files to Modify

### `src/engine/world/Room.ts`

Add the `CurrentZoneDef` interface and the optional `currentZones` field to `RoomData`:

```typescript
/** Current zone placement — used by CurrentSystem */
export interface CurrentZoneDef {
  id: string;
  rect: Rect;
  direction: Vec2;
  strength: number;
  type: "stream" | "gust" | "whirlpool" | "jet";
  clockwise?: boolean;
  gustOnDuration?: number;
  gustOffDuration?: number;
  gustOffset?: number;
}

// In RoomData interface:
export interface RoomData {
  // ... existing fields ...
  currentZones?: CurrentZoneDef[];  // Optional — Maritime Ledger only
}
```

---

## Room Catalog

### Room Layout

```
harbor-approach → tide-pool-cavern → cargo-hold → redaction-shrine
                                          ↓                ↓
                              storm-channel ← ← ← (Redaction gate)
                                          ↓
                              whirlpool-depths → lighthouse-tower → tide-scribe-arena
```

Redaction Shrine exits are already hardcoded:
- Left → `cargo-hold` (spawn: `{ x: 960 - 80, y: 540 - 64 - T }`)
- Right → `storm-channel` (spawn: `{ x: 64, y: 540 - 64 - T }`)

### Room 1: Harbor Approach (`harbor-approach`)

- **Size**: 1920×540 (wide, horizontal)
- **Biome**: `"maritime-ledger"`
- **Role**: Entry room from Scribe Hall, introduces horizontal stream currents
- **Default spawn**: `{ x: 100, y: 540 - 64 - T }`

**Platforms:**
- Floor: full width, standard. Include a gap (spike pit) around x=800-1000 forcing the player to use the stream current to cross.
- Ceiling: full width.
- Left wall: gap for left exit (back to hub).
- Right wall: gap for right exit (to tide-pool-cavern).
- 2-3 mid-height platforms for the player to land on when currents push them.

**Current zones:**
- Stream 1: horizontal rightward push across the gap area, `{ rect: { x: 700, y: 200, width: 500, height: 300 }, direction: { x: 1, y: 0 }, strength: 350, type: "stream" }`
- Stream 2: lighter leftward return current near ceiling, `{ rect: { x: 300, y: T, width: 600, height: 150 }, direction: { x: -1, y: 0 }, strength: 200, type: "stream" }`

**Enemies:** 1 Reader on the far side of the gap (patrolling the landing platform).

**Exits:**
- Left → `"scribe-hall"` (will connect when hub expansion task adds the corresponding exit)
- Right → `"tide-pool-cavern"`

---

### Room 2: Tide Pool Cavern (`tide-pool-cavern`)

- **Size**: 960×1080 (tall, vertical)
- **Biome**: `"maritime-ledger"`
- **Role**: Vertical room, introduces whirlpool and gust mechanics
- **Default spawn**: `{ x: 100, y: 1080 - 64 - T }`

**Platforms:**
- Floor: full width.
- Ceiling: full width.
- Left/right walls: standard with exit gaps.
- 4-5 mid-room platforms at staggered heights for vertical climbing.
- Platforms should be placed so the whirlpool's tangential force helps the player spiral upward if they position correctly.

**Current zones:**
- Whirlpool 1 (center-room): `{ rect: { x: 200, y: 400, width: 560, height: 400 }, direction: { x: 0, y: 0 }, strength: 300, type: "whirlpool", clockwise: true }`
- Gust 1 (updraft near right wall): `{ rect: { x: 700, y: 500, width: 200, height: 400 }, direction: { x: 0, y: -1 }, strength: 550, type: "gust", gustOnDuration: 2.5, gustOffDuration: 1.5, gustOffset: 0 }`

**Enemies:** 2 Readers — one patrolling a mid-height platform, one near the top. 1 Binder on a platform overlooking the whirlpool.

**Exits:**
- Left (bottom) → `"harbor-approach"`
- Top → `"cargo-hold"`

---

### Room 3: Cargo Hold (`cargo-hold`)

- **Size**: 1920×1080 (large)
- **Biome**: `"maritime-ledger"`
- **Role**: Large room, ride currents between platform islands separated by gaps. Multiple stream currents create a flowing river effect.
- **Default spawn**: `{ x: 100, y: 1080 - 64 - T }`

**Platforms:**
- Floor segments (not continuous) — 3-4 platform islands with gaps between them.
- Ceiling: full width.
- Walls: standard with exit gaps.
- Several small stepping-stone platforms above the stream channels.
- The streams flow in the gaps between islands, carrying the player if they fall in.

**Current zones:**
- Stream 1 (lower channel, rightward): `{ rect: { x: 300, y: 800, width: 800, height: 200 }, direction: { x: 1, y: 0 }, strength: 400, type: "stream" }`
- Stream 2 (upper channel, leftward): `{ rect: { x: 400, y: 300, width: 800, height: 200 }, direction: { x: -1, y: 0 }, strength: 350, type: "stream" }`
- Stream 3 (connecting vertical channel): `{ rect: { x: 1200, y: 400, width: 200, height: 500 }, direction: { x: 0, y: -1 }, strength: 300, type: "stream" }`
- Jet 1 (launcher to upper area): `{ rect: { x: 800, y: 900, width: 100, height: 150 }, direction: { x: 0.3, y: -1 }, strength: 900, type: "jet" }`

**Enemies:** 2 Binders (one on each major platform island, threads can reach into streams).

**Exits:**
- Bottom-left → `"tide-pool-cavern"`
- Right → `"redaction-shrine"` (spawn matches shrine's left exit expectation)
- Bottom → `"storm-channel"` (opens after getting Redaction, provides shortcut from shrine path)

The right exit to `redaction-shrine` must produce a spawn point matching what the shrine expects. The shrine's left exit has `targetSpawnPoint: { x: 960 - 80, y: 540 - 64 - T }` — so cargo-hold's right exit should point to `redaction-shrine` with `targetSpawnPoint: { x: 100, y: 540 - 64 - T }` (the shrine's default spawn). Conversely, cargo-hold needs to accept the return: its platforms near the right exit need a landing spot around `{ x: 1920 - 80, y: 1080 - 64 - T }`.

---

### Room 4: Redaction Shrine (`redaction-shrine`)

**Already defined in `abilityShrineRooms.ts`** — no changes needed. Room file just references it via `targetRoomId` in adjacent rooms' exits.

The shrine's hardcoded exits:
- Left → `cargo-hold`, spawn: `{ x: 960 - 80, y: 540 - 64 - T }`
- Right → `storm-channel`, spawn: `{ x: 64, y: 540 - 64 - T }`

---

### Room 5: Storm Channel (`storm-channel`)

- **Size**: 1920×540 (wide, horizontal)
- **Biome**: `"maritime-ledger"`
- **Role**: Wide gauntlet with pulsing gusts and spike hazards. Redaction gate at the left entrance blocks progress until the ability is acquired.
- **Default spawn**: `{ x: 64, y: 540 - 64 - T }` (matches shrine's right exit)

**Platforms:**
- Floor: segments with spike pits between them.
- Ceiling: full width.
- Walls: standard with exit gaps.
- 3-4 elevated platforms that provide safe zones between gust zones.

**Current zones (4 gusts, staggered):**
- Gust 1 (updraft): `{ rect: { x: 300, y: 100, width: 250, height: 400 }, direction: { x: 0, y: -1 }, strength: 600, type: "gust", gustOnDuration: 2.0, gustOffDuration: 1.5, gustOffset: 0.0 }`
- Gust 2 (downdraft): `{ rect: { x: 600, y: 100, width: 250, height: 400 }, direction: { x: 0, y: 1 }, strength: 500, type: "gust", gustOnDuration: 1.5, gustOffDuration: 2.0, gustOffset: 0.8 }`
- Gust 3 (updraft): `{ rect: { x: 1000, y: 100, width: 250, height: 400 }, direction: { x: 0, y: -1 }, strength: 650, type: "gust", gustOnDuration: 2.0, gustOffDuration: 1.0, gustOffset: 1.5 }`
- Gust 4 (rightward push + slight updraft): `{ rect: { x: 1400, y: 200, width: 300, height: 300 }, direction: { x: 0.7, y: -0.7 }, strength: 550, type: "gust", gustOnDuration: 2.5, gustOffDuration: 1.5, gustOffset: 0.5 }`

The gusts alternate between updrafts and downdrafts. Spike pits below catch players who fall during downdraft phases. Players must time their movement between gust cycles.

**Obstacles:**
- 3-4 spike rows in the floor gaps between platforms.
- The spikes + gust combination creates the "storm" feel — gusts push you toward or away from spikes.

**Gates:**
- Redaction gate at left entrance blocking the leftward path from shrine direction. Actually — the shrine exits right into storm-channel, so the Redaction gate should be at the storm-channel's left wall area (blocking return to shrine without Redaction). Wait — the shrine already has its own Redaction gate on its teaching puzzle. The epic README says "Redaction gate" at storm-channel entrance. Let's place it on the storm-channel side: a gate near x=200 that blocks forward progress. The player enters from the left (from shrine), encounters the gate immediately, must use Redaction to pass. This reinforces the newly acquired ability.

**Enemies:** 1 Reader (far side, patrolling), 2 Proofwardens (one mid-channel, one guarding the exit).

**Exits:**
- Left → `"redaction-shrine"` (return path)
- Bottom → `"whirlpool-depths"`

---

### Room 6: Whirlpool Depths (`whirlpool-depths`)

- **Size**: 1440×1080 (wide-tall)
- **Biome**: `"maritime-ledger"`
- **Role**: Dense current puzzle room with two whirlpools and a jet launcher. The hardest traversal challenge in the wing.
- **Default spawn**: `{ x: 100, y: 100 }`

**Platforms:**
- Floor: segments around the whirlpool areas (some islands in the "water").
- Ceiling: full width.
- Walls: standard with exit gaps.
- Central platform island between the two whirlpools.
- Small platforms at whirlpool edges for the player to grab onto.

**Current zones:**
- Whirlpool 1 (lower-left): `{ rect: { x: 100, y: 600, width: 500, height: 400 }, direction: { x: 0, y: 0 }, strength: 350, type: "whirlpool", clockwise: true }`
- Whirlpool 2 (upper-right): `{ rect: { x: 800, y: 200, width: 500, height: 400 }, direction: { x: 0, y: 0 }, strength: 300, type: "whirlpool", clockwise: false }`
- Jet 1 (between whirlpools, launcher): `{ rect: { x: 650, y: 500, width: 100, height: 200 }, direction: { x: 0.5, y: -1 }, strength: 1000, type: "jet" }`

The puzzle: Player must navigate from the lower-left whirlpool, use the jet to launch to the upper-right whirlpool area, then ride the counter-clockwise whirlpool to reach the exit.

**Enemies:** 2 Readers (on platform islands), 1 Binder (overlooking whirlpool 1 from a high platform), 1 Proofwarden (guarding the exit platform).

**Exits:**
- Top → `"storm-channel"`
- Right → `"lighthouse-tower"`

---

### Room 7: Lighthouse Tower (`lighthouse-tower`)

- **Size**: 960×1080 (tall, vertical)
- **Biome**: `"maritime-ledger"`
- **Role**: Tall vertical climb with updraft gusts. Pure vertical traversal challenge.
- **Default spawn**: `{ x: 480, y: 1080 - 64 - T }`

**Platforms:**
- Floor: full width (start point).
- Ceiling: full width with exit gap.
- Walls: standard.
- 6-8 staggered platforms spiraling upward, spaced so the player needs gust assistance to reach higher ones.
- Some platforms should be narrow (64-96px width) — precision landing challenge.

**Current zones (3 vertical gusts):**
- Gust 1 (lower section, strong updraft): `{ rect: { x: 300, y: 700, width: 300, height: 300 }, direction: { x: 0, y: -1 }, strength: 650, type: "gust", gustOnDuration: 3.0, gustOffDuration: 1.5, gustOffset: 0.0 }`
- Gust 2 (mid section, moderate): `{ rect: { x: 500, y: 400, width: 250, height: 300 }, direction: { x: 0, y: -1 }, strength: 550, type: "gust", gustOnDuration: 2.0, gustOffDuration: 2.0, gustOffset: 1.0 }`
- Gust 3 (upper section, strong but short): `{ rect: { x: 200, y: 100, width: 300, height: 250 }, direction: { x: 0, y: -1 }, strength: 700, type: "gust", gustOnDuration: 1.5, gustOffDuration: 2.5, gustOffset: 2.0 }`

Players must time their jumps to catch gust updrafts. Missing a gust means falling back down. The gusts are staggered so at least one is usually active, but reaching the top requires catching 2-3 in sequence.

**Enemies:** 2 Proofwardens — one on a mid-height platform, one near the top. Their shield-slam can knock the player back down.

**Exits:**
- Left (bottom) → `"whirlpool-depths"`
- Right (top) → `"tide-scribe-arena"`

---

### Room 8: Tide Scribe's Dock (`tide-scribe-arena`)

- **Size**: 1440×1080 (wide-tall)
- **Biome**: `"maritime-ledger"`
- **Role**: Mini-boss arena. Two stream currents that periodically reverse direction during the fight.
- **Default spawn**: `{ x: 100, y: 1080 - 64 - T }`

**Platforms:**
- Floor: full width, solid (boss needs ground to patrol on).
- Ceiling: full width.
- Walls: standard with exit gaps.
- 2-3 elevated platforms (mid-height) for the player to escape to during current surges.
- Small stepping platforms near the top for aerial combat options.

**Current zones (2 streams, these reverse during the fight):**
- Stream 1 (lower half, initially rightward): `{ rect: { x: 200, y: 700, width: 1000, height: 300 }, direction: { x: 1, y: 0 }, strength: 300, type: "stream" }`
- Stream 2 (upper half, initially leftward): `{ rect: { x: 200, y: 200, width: 1000, height: 300 }, direction: { x: -1, y: 0 }, strength: 250, type: "stream" }`

**Current reversal mechanic:** Every 8-10 seconds (configurable), the stream directions flip. The room-loading code should set up a timer that calls a helper to reverse the `direction` vectors on both streams. This creates dynamic positioning pressure during the boss fight.

**Tide Scribe (mini-boss):**
Export `TIDE_SCRIBE_PARAMS` as a named constant:
```typescript
export const TIDE_SCRIBE_PARAMS = {
  health: 18,             // 3× default Proofwarden health (6)
  moveSpeed: 120,         // 1.5× default (80)
  chaseSpeed: 180,        // 1.5× default (120)
  detectionRange: 300,    // Wider detection for arena setting
  slamWindup: 15,         // Slightly faster wind-up
  slamActiveFrames: 10,   // Longer active slam
  slamDamage: 3,          // 1.5× default (2)
  slamKnockback: 500,     // Strong knockback (into currents!)
  shieldBlockAngle: 160,  // Wider shield arc — harder to flank
  contactDamage: 2,       // Higher contact damage
} as const;
```

The enemy spawn entry:
```typescript
{
  id: "ml_tide_scribe",
  position: { x: 720, y: 1080 - 64 - T },
  type: "proofwarden",
  groundY: 1080 - T,
  facingRight: false,
}
```

No `bossGate` field — the mini-boss doesn't block an exit. After defeating the Tide Scribe, the fight is simply won. A shortcut exit back to hub can be added in the hub-expansion task.

**Enemies:** Just the Tide Scribe — no other enemies in the boss arena.

**Exits:**
- Left → `"lighthouse-tower"`
- (Optional future: right/top exit back to hub as shortcut after boss defeat)

---

## `demoWorld.ts` Integration

**DO NOT modify `demoWorld.ts` in this task.** The world-graph-assembly task (Task 7) will handle connecting all wings. However, the room file should be structured so that integration is trivial:

1. Export `MARITIME_LEDGER_ROOMS` (Record<string, RoomData>) — 7 rooms
2. Export `MARITIME_LEDGER_ROOM_IDS` (readonly array)
3. Export `TIDE_SCRIBE_PARAMS` — for room-loading code to apply
4. All exits reference correct target room IDs

---

## Verification / Pass Criteria

1. **TypeScript compiles cleanly**: `npx tsc --noEmit` passes with zero errors
2. **All 7 rooms are valid `RoomData` objects**: correct types, all required fields present
3. **`CurrentZoneDef` added to `Room.ts`**: new interface + optional `currentZones` field on `RoomData`
4. **Every exit has a matching return exit**: e.g., harbor-approach's right exit → tide-pool-cavern, and tide-pool-cavern's left exit → harbor-approach
5. **Redaction shrine integration**: cargo-hold has right exit → `"redaction-shrine"`, storm-channel has left exit → `"redaction-shrine"`, spawn points match the shrine's hardcoded exits
6. **Redaction gate on storm-channel**: AbilityGate with `requiredAbility: "redaction"` blocks forward progress
7. **Tide Scribe params exported**: `TIDE_SCRIBE_PARAMS` has 3× health, 1.5× speed, wider shield
8. **Current zones declared on every room**: each room has `currentZones` array (empty for redaction-shrine which is in abilityShrineRooms.ts)
9. **Current type variety**: streams in harbor-approach/cargo-hold/tide-scribe-arena, gusts in tide-pool-cavern/storm-channel/lighthouse-tower, whirlpools in tide-pool-cavern/whirlpool-depths, jets in cargo-hold/whirlpool-depths
10. **Enemy placement follows difficulty tier 3**: 2-5 enemies per room (except shrine: 0, boss arena: 1 mini-boss)
11. **Room sizes follow established patterns**: 960×540, 960×1080, 1440×1080, 1920×540, 1920×1080

---

## Important Notes

- **Enemy ID prefix**: Use `ml_` prefix for all enemy IDs in this wing (e.g., `ml_reader_1`, `ml_binder_1`).
- **Obstacle ID prefix**: Use `ml_` prefix for obstacles (e.g., `ml_spikes_1`).
- **Gate ID prefix**: Use `ml_` prefix for gates (e.g., `ml_gate_redact`).
- **Current zone ID prefix**: Use `ml_` prefix (e.g., `ml_stream_1`, `ml_gust_1`, `ml_whirlpool_1`, `ml_jet_1`).
- **`vineAnchors: []`**: Always include this field as an empty array (not omitted) for non-Herbarium rooms.
- **`gravityWells` can be omitted**: Only Astral Atlas rooms need this field.
- **The redaction-shrine exits are already hardcoded** in `abilityShrineRooms.ts`. Do not modify that file. Just make sure cargo-hold and storm-channel exits match.
- **Gust staggering**: Set different `gustOffset` values so multiple gusts in the same room don't pulse in sync.
- **No test page needed**: This task creates room data only. The rooms will be testable via the world-assembly test page once the world-graph-assembly task connects everything. However, the rooms should be structurally valid and importable.

---

## Implementation Summary

### Files Modified
- **`src/engine/world/Room.ts`**: Added `CurrentZoneDef` interface (id, rect, direction, strength, type, clockwise?, gustOnDuration?, gustOffDuration?, gustOffset?) and `currentZones?: CurrentZoneDef[]` field to `RoomData` interface.

### Files Created
- **`src/engine/world/maritimeLedgerRooms.ts`**: 7 rooms with full current zone declarations:
  1. **Harbor Approach** (1920×540) — 2 streams, 1 reader, floor gap with spikes
  2. **Tide Pool Cavern** (960×1080) — 1 whirlpool + 1 gust, 3 enemies
  3. **Cargo Hold** (1920×1080) — 3 streams + 1 jet, 2 binders, island platforms
  4. **Storm Channel** (1920×540) — 4 staggered gusts, 3 enemies, Redaction gate, spike gauntlet
  5. **Whirlpool Depths** (1440×1080) — 2 whirlpools + 1 jet, 4 enemies, double whirlpool puzzle
  6. **Lighthouse Tower** (960×1080) — 3 staggered gusts, 2 proofwardens, vertical climb
  7. **Tide Scribe's Dock** (1440×1080) — 2 streams (reversible at runtime), 1 mini-boss

### Exports
- `MARITIME_LEDGER_ROOMS` — Record<string, RoomData> with all 7 rooms
- `MARITIME_LEDGER_ROOM_IDS` — readonly array of all 7 IDs
- `TIDE_SCRIBE_PARAMS` — enhanced Proofwarden params (18 HP, 120/180 move/chase speed, 160° shield arc)

### Current Zone Distribution
- **Streams**: harbor-approach (2), cargo-hold (3), tide-scribe-arena (2) = 7
- **Gusts**: tide-pool-cavern (1), storm-channel (4), lighthouse-tower (3) = 8
- **Whirlpools**: tide-pool-cavern (1), whirlpool-depths (2) = 3
- **Jets**: cargo-hold (1), whirlpool-depths (1) = 2

### Verification
- `npx tsc --noEmit` passes cleanly
- All 7 bidirectional exit connections verified (including shrine integration)
- Redaction gate properly blocks storm-channel forward progress
- All `ml_` prefixed IDs, all `vineAnchors: []`, biome set to `"maritime-ledger"`

---

## Review Notes (reviewer: 58fcf6d4)

### Issues Found & Fixed

1. **Storm-channel spawn point over spike pit (2 exits affected)**
   - Whirlpool-depths top exit → storm-channel had spawn `{ x: 960, y: 444 }`, which lands over the spike gap between floor segments 750–950 and 1100–1300 (spike ml_spikes_sc_3 at x=950–1100).
   - Cargo-hold bottom-center exit → storm-channel had spawn `{ x: 960, y: 96 }`, same x position — player falls from ceiling into spikes.
   - **Fix**: Changed both spawns to `x: 800` which is safely over the 750–950 floor segment.

### Verified (No Issues)

- `CurrentZoneDef` interface in Room.ts: correct fields, proper optional typing
- `RoomData.currentZones` field: properly optional, correct type
- All 7 rooms have valid `RoomData` structure, TypeScript compiles cleanly
- All bidirectional exit connections verified (harbor↔tide-pool, tide-pool↔cargo, cargo↔shrine, shrine↔storm, storm↔whirlpool, whirlpool↔lighthouse, lighthouse↔arena)
- Redaction gate on storm-channel correctly positioned with `requiredAbility: "redaction"`
- Tide Scribe params properly exported with enhanced values
- Current zone variety: streams (7), gusts (8), whirlpools (3), jets (2)
- Enemy counts within tier-3 range (2–5 per room, 1 mini-boss in arena)
- All IDs use `ml_` prefix, all rooms have `vineAnchors: []`, biome set to `"maritime-ledger"`
