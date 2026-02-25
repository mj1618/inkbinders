# Ability Shrine Rooms

## Goal

Create 4 special "shrine" rooms where the player first unlocks each editing ability, plus the engine infrastructure (`abilityPickup` field on `RoomData`, pickup detection in `GameWorld`, HUD notification) to support ability acquisition in the world. Each shrine has a glowing pedestal, an unlock moment, and a short teaching puzzle that requires the new ability to exit.

This task establishes a reusable pattern that the 3 biome wing tasks (astral-atlas, maritime-ledger, gothic-errata) will consume — each wing includes one shrine room connected into its layout.

---

## Context

### What exists today

- **`RoomData`** (`src/engine/world/Room.ts`) defines rooms with platforms, obstacles, exits, gates, enemies, and vine anchors. There is NO `abilityPickup` field yet.
- **`PlayerProgression`** (`src/engine/world/PlayerProgression.ts`) has `unlockAbility(ability: GateAbility)` and `hasAbility(ability: GateAbility)` — the tracking is built but nothing in the world triggers it.
- **`GameWorld`** (`src/engine/world/GameWorld.ts`) wraps `RoomManager`, `DayNightCycle`, and `PlayerProgression`. It does NOT currently check for ability pickups.
- **`GameSession`** (`src/engine/core/GameSession.ts`) has `DEV_ALL_ABILITIES = true` for dev, and `unlockAbility()` / `hasAbility()` methods.
- **`GameHUD`** (`src/engine/ui/GameHUD.ts`) has a notification system (`showNotification()`) with typed notifications (info, ability, gate, item, warning).
- **`AbilityGate`** in `Room.ts` blocks passages until the player has a specific ability. Gates are already fully functional.
- **`herbariumRooms.ts`** is the template for room file structure — export individual room constants + a `Record<string, RoomData>` + an ID array.
- **`GateAbility`** type: `"margin-stitch" | "redaction" | "paste-over" | "index-mark"`.
- **`GATE_COLORS`**: margin-stitch=#22d3ee, redaction=#ef4444, paste-over=#f59e0b, index-mark=#a78bfa.

### Design decisions

1. **`abilityPickup` as a new optional field on `RoomData`**: This keeps room data declarative. The field specifies which ability and where the pedestal is. `GameWorld.update()` (or the play page's update loop) checks player overlap with the pickup zone and triggers the unlock.

2. **Pickup is consumed once**: If `progression.hasAbility(ability)` is already true, the pickup zone is inert. No re-triggering on revisit.

3. **Shrine rooms are standalone rooms**, not embedded in wing rooms. Each shrine is a separate `RoomData` that gets connected via exits to its parent wing. The biome wing tasks will wire the exits.

4. **Teaching puzzle exits**: Each shrine has an exit blocked by a gate requiring the ability you just unlocked. This forces the player to use the ability at least once before leaving, confirming they understand it.

5. **Visual pedestal**: In rectangle rendering mode, the pedestal is a pulsing colored rectangle (matching `GATE_COLORS` for the ability). A particle burst plays on unlock. In sprite mode, `AssetManager` placeholder will render.

6. **No new player states**: Ability unlock is instant — walk into the zone, ability unlocks, particles burst, HUD notification fires, pedestal dims. Zero flow interruption.

---

## Files to Create

### `src/engine/world/abilityShrineRooms.ts` (new)

Main deliverable. Define 4 shrine rooms following the `herbariumRooms.ts` pattern.

**Use `const T = 32` for tile size.**

**Export pattern:**
```typescript
import type { RoomData } from "./Room";
import { EXIT_ZONE_DEPTH, GATE_COLORS, GATE_WIDTH, GATE_HEIGHT } from "./Room";

const T = 32;

export const STITCH_SHRINE: RoomData = { ... };
export const REDACTION_SHRINE: RoomData = { ... };
export const PASTE_SHRINE: RoomData = { ... };
export const INDEX_SHRINE: RoomData = { ... };

export const ABILITY_SHRINE_ROOMS: Record<string, RoomData> = {
  "stitch-shrine": STITCH_SHRINE,
  "redaction-shrine": REDACTION_SHRINE,
  "paste-shrine": PASTE_SHRINE,
  "index-shrine": INDEX_SHRINE,
};

export const ABILITY_SHRINE_ROOM_IDS = [
  "stitch-shrine",
  "redaction-shrine",
  "paste-shrine",
  "index-shrine",
] as const;
```

#### Room 1: Stitch Sanctum (`stitch-shrine`)

- **Ability**: Margin Stitch
- **Biome**: `"herbarium-folio"` (located in the Herbarium Wing)
- **Size**: 960×1080 (tall, vertical)
- **Layout concept**: Two chambers stacked vertically. Upper chamber has the pedestal. Lower chamber has the teaching puzzle — two parallel walls with a visible exit behind them. Player must stitch through walls to reach the exit.

**Platforms:**
- Floor: `{ x: 0, y: 1080 - T, width: 960, height: T }`
- Left wall: `{ x: 0, y: 0, width: T, height: 1080 }`
- Right wall: `{ x: 960 - T, y: 0, width: T, height: 1080 }`
- Ceiling: `{ x: 0, y: 0, width: 960, height: T }`
- Mid-floor (divides upper/lower chambers): `{ x: 0, y: 540, width: 640, height: T }` — gap on right side so player can drop down
- Upper landing near pedestal: `{ x: 300, y: 400, width: 360, height: T }` — pedestal platform
- Lower stitch-puzzle wall 1 (vertical): `{ x: 400, y: 600, width: T, height: 200 }` — first stitchable wall
- Lower stitch-puzzle wall 2 (vertical): `{ x: 600, y: 600, width: T, height: 200 }` — second stitchable wall
- Lower landing beyond walls: `{ x: 700, y: 780, width: 200, height: T }`
- Step platforms: a few small platforms to guide the player back up if needed

**Pedestal zone** (abilityPickup):
- `ability: "margin-stitch"`
- `position: { x: 480, y: 368 }` — centered on the upper landing platform
- `zone: { x: 400, y: 300, width: 160, height: 100 }` — generous overlap area

**Exits:**
- Top → back to Herbarium wing (e.g., `vine-vestibule`): `{ direction: "top", zone: { x: 400, y: 0, width: 160, height: EXIT_ZONE_DEPTH } }`
  - `targetRoomId`: `"vine-vestibule"` (the shrine branches off the Herbarium wing early)
  - `targetSpawnPoint`: `{ x: 480, y: 320 - 64 }` (near the right exit of Vine Vestibule)
- Right exit (teaching puzzle completion) → `"root-cellar"` or back to the wing:
  - `{ direction: "right", zone: { x: 960 - EXIT_ZONE_DEPTH, y: 748, width: EXIT_ZONE_DEPTH, height: 64 } }`
  - `targetRoomId`: `"overgrown-stacks"` — continues into the wing
  - `targetSpawnPoint`: `{ x: 64, y: 1080 - 64 - T }`

**Teaching gate** (blocks the right exit until Margin Stitch is used):
- Gate placed at `{ x: 900, y: 684, width: GATE_WIDTH, height: GATE_HEIGHT }`
- `requiredAbility: "margin-stitch"`
- Player picks up Margin Stitch at pedestal, uses it to stitch through the two puzzle walls, reaches the gated exit which now opens

**No enemies** — shrines are sacred, peaceful spaces.

#### Room 2: Redaction Alcove (`redaction-shrine`)

- **Ability**: Redaction
- **Biome**: `"maritime-ledger"` (located in the Maritime Ledger Wing)
- **Size**: 960×540 (small, horizontal)
- **Layout concept**: Single chamber. Pedestal on the left. Spike barrier blocks the only exit (right). Player must redact the spikes to pass.

**Platforms:**
- Floor: `{ x: 0, y: 540 - T, width: 960, height: T }`
- Left wall: `{ x: 0, y: 0, width: T, height: 540 }`
- Right wall: `{ x: 960 - T, y: 0, width: T, height: 540 }`
- Ceiling: `{ x: 0, y: 0, width: 960, height: T }`
- Raised pedestal platform: `{ x: 100, y: 380, width: 200, height: T }`
- Small stepping stone: `{ x: 500, y: 400, width: 96, height: T }`

**Pedestal zone:**
- `ability: "redaction"`
- `position: { x: 200, y: 348 }` — on the raised platform
- `zone: { x: 130, y: 300, width: 140, height: 80 }`

**Obstacles** (teaching puzzle):
- Spike row blocking exit: spikes type, `{ x: 700, y: 540 - T - 32, width: 160, height: 32 }`, damage: 1, NOT solid (player takes damage walking through if not redacted)
- Barrier behind spikes (optional): solid barrier at `{ x: 840, y: 540 - T - 96, width: T, height: 96 }`, damage: 0, solid: true — must be redacted

**Exits:**
- Left → back to Maritime Ledger wing: `{ direction: "left" }`
  - `targetRoomId`: `"cargo-hold"` — shrine branches off cargo-hold
  - Wire exits: the exact target will be set by the maritime-ledger-wing task. Use placeholder `"cargo-hold"`.
- Right → continue into Maritime Ledger wing (past the redacted obstacles): `{ direction: "right" }`
  - `targetRoomId`: `"storm-channel"` — continues deeper into the wing
  - Place exit behind the obstacle so player must redact to reach it

**No enemies.**

#### Room 3: Paste-Over Study (`paste-shrine`)

- **Ability**: Paste-Over
- **Biome**: `"astral-atlas"` (located in the Astral Atlas Wing)
- **Size**: 960×1080 (tall, vertical)
- **Layout concept**: Vertical chamber with the pedestal mid-level. Teaching puzzle: bouncy platform below, normal platform above out of reach. Player must paste the bouncy surface onto the normal platform to bounce up to the exit.

**Platforms:**
- Floor: `{ x: 0, y: 1080 - T, width: 960, height: T }`
- Left wall: `{ x: 0, y: 0, width: T, height: 1080 }`
- Right wall: `{ x: 960 - T, y: 0, width: T, height: 1080 }`
- Ceiling (with exit gap): `{ x: 0, y: 0, width: 350, height: T }`, `{ x: 610, y: 0, width: 350, height: T }`
- Pedestal platform: `{ x: 350, y: 600, width: 260, height: T }` — mid-height
- Bouncy platform (source): `{ x: 100, y: 900, width: 200, height: T, surfaceType: "bouncy" }` — near floor, player walks on it to auto-copy bouncy
- Target platform (paste destination): `{ x: 350, y: 350, width: 260, height: T }` — too high to reach with normal jump, but bounceable if pasted
- Small landing: `{ x: 650, y: 200, width: 200, height: T }` — reachable from bounce

**Pedestal zone:**
- `ability: "paste-over"`
- `position: { x: 480, y: 568 }` — on the pedestal platform
- `zone: { x: 400, y: 520, width: 160, height: 80 }`

**Exits:**
- Bottom → back to Astral Atlas wing: `{ direction: "bottom" }`
  - `targetRoomId`: `"constellation-path"` — shrine branches off constellation-path
- Top → continue into Astral Atlas wing (reachable only by bouncing on pasted platform): `{ direction: "top" }`
  - `targetRoomId`: `"nebula-crossing"` — deeper into the wing
  - `zone: { x: 350, y: 0, width: 260, height: EXIT_ZONE_DEPTH }`

**No enemies.**

#### Room 4: Index Mark Archive (`index-shrine`)

- **Ability**: Index Mark
- **Biome**: `"gothic-errata"` (located in the Gothic Errata Wing)
- **Size**: 960×1080 (tall, vertical)
- **Layout concept**: Two platforms far apart with fog between them. Player places a mark on the upper platform, drops through fog to the lower platform, then teleports back to the mark to reach the exit above.

**Platforms:**
- Floor: `{ x: 0, y: 1080 - T, width: 960, height: T }`
- Left wall: `{ x: 0, y: 0, width: T, height: 1080 }`
- Right wall: `{ x: 960 - T, y: 0, width: T, height: 1080 }`
- Ceiling (with exit gap): `{ x: 0, y: 0, width: 300, height: T }`, `{ x: 660, y: 0, width: 300, height: T }`
- Upper platform (mark placement + exit access): `{ x: 300, y: 250, width: 360, height: T }` — near the top, next to exit
- Pedestal platform: `{ x: 300, y: 550, width: 360, height: T }` — mid-height, where pickup is
- Lower platform (landing after fog drop): `{ x: 200, y: 850, width: 560, height: T }` — safe landing zone
- Step from floor to lower platform: `{ x: 100, y: 950, width: 160, height: T }`

**Pedestal zone:**
- `ability: "index-mark"`
- `position: { x: 480, y: 518 }` — on the pedestal platform
- `zone: { x: 400, y: 470, width: 160, height: 80 }`

**Teaching puzzle concept**: After unlocking Index Mark at the pedestal:
1. Player climbs/jumps to the upper platform (reachable via wall-jumps or the pedestal platform)
2. Places an Index Mark (tap R) on the upper platform
3. Drops down through fog zone between upper and lower platforms
4. Lands safely on the lower platform
5. Holds R to enter teleport select, chooses the mark, teleports back up
6. Reaches the exit at the top

**Fog zones** (Gothic Errata mechanic — defined via the FogSystem in the wing task):
- The room data itself doesn't store fog zones (FogSystem is initialized per-room by the loading code)
- However, we can note in a comment that this room should have a fog zone covering `{ x: T, y: 350, width: 960 - 2*T, height: 400 }` with density 0.6

**Exits:**
- Left → back to Gothic Errata wing: `{ direction: "left" }`
  - `targetRoomId`: `"bell-tower"` — shrine branches off bell-tower
  - `zone: { x: 0, y: 518, width: EXIT_ZONE_DEPTH, height: 64 }` — mid-height
- Top → continue into Gothic Errata wing: `{ direction: "top" }`
  - `targetRoomId`: `"mirror-hall"` — deeper into the wing
  - `zone: { x: 300, y: 0, width: 360, height: EXIT_ZONE_DEPTH }`

**No enemies.**

---

## Files to Modify

### `src/engine/world/Room.ts`

Add an optional `abilityPickup` field to `RoomData`:

```typescript
/** Optional ability pickup — a pedestal where the player first unlocks an ability */
export interface AbilityPickup {
  /** Which ability this pedestal grants */
  ability: GateAbility;
  /** World-space position of the pedestal visual center */
  position: Vec2;
  /** Trigger zone — player overlapping this rect unlocks the ability */
  zone: Rect;
}

// Add to RoomData interface:
export interface RoomData {
  // ... existing fields ...
  /** Optional ability pickup — shrine pedestal */
  abilityPickup?: AbilityPickup;
}
```

### `src/engine/world/GameWorld.ts`

Add ability pickup detection to the `update()` method:

```typescript
// In update(), after checking exits:
if (this.currentRoom?.abilityPickup) {
  const pickup = this.currentRoom.abilityPickup;
  if (!this.progression.hasAbility(pickup.ability)) {
    // Check player overlap with pickup zone
    if (rectsOverlap(playerBounds, pickup.zone)) {
      this.progression.unlockAbility(pickup.ability);
      this.lastPickedAbility = pickup.ability;
      // The play page / test page reads this and fires HUD notification + particles
    }
  }
}
```

Add a public method/field for the play page to consume:
```typescript
/** Returns the ability just picked up this frame (or null). Auto-clears after read. */
consumePickedAbility(): GateAbility | null {
  const ability = this.lastPickedAbility;
  this.lastPickedAbility = null;
  return ability;
}
```

### `src/engine/world/RoomRenderer.ts`

Add a `renderAbilityPedestal()` static method that draws the pedestal visual:

```typescript
static renderAbilityPedestal(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  pickup: AbilityPickup,
  isCollected: boolean,
  time: number,
): void {
  // If already collected, draw dimmed pedestal
  // If not collected, draw pulsing glowing pedestal with GATE_COLORS[pickup.ability]
  // Pedestal visual: 48x16 stone base + 16x32 column + glowing orb on top
  // Pulsing glow: sin(time * 3) oscillates alpha between 0.4 and 0.8
  // Particles: 2-3 slow-rising colored motes around the orb
}
```

### `src/app/play/page.tsx`

In the game loop's update callback, after `gameWorld.update()`:
```typescript
const pickedAbility = gameWorld.consumePickedAbility();
if (pickedAbility) {
  // Map ability to display name
  const abilityNames: Record<GateAbility, string> = {
    "margin-stitch": "Margin Stitch",
    "redaction": "Redaction",
    "paste-over": "Paste-Over",
    "index-mark": "Index Mark",
  };
  const keyBinds: Record<GateAbility, string> = {
    "margin-stitch": "E",
    "redaction": "Q",
    "paste-over": "R",
    "index-mark": "R",
  };
  hud.showNotification(`${abilityNames[pickedAbility]} Acquired — Press [${keyBinds[pickedAbility]}] to use`, "ability");
  // Particle burst at pedestal position
  particleSystem.burst(pickup.position.x, pickup.position.y, 20, GATE_COLORS[pickedAbility]);
  // Actually enable the ability in the game session
  gameSession.unlockAbility(pickedAbility);
}
```

### `src/engine/world/demoWorld.ts`

Do NOT register shrine rooms here yet — the biome wing tasks will integrate them into the world graph when they define their wing layouts. However, add a comment noting where they will be wired in:

```typescript
// Shrine rooms (stitch-shrine, redaction-shrine, paste-shrine, index-shrine)
// are defined in abilityShrineRooms.ts and will be integrated by each wing task.
```

---

## Pedestal Visual Design

The pedestal is a canvas-drawn element (no sprite needed — it works in rectangle mode):

### Uncollected pedestal:
1. **Base**: 48x16 dark stone rectangle at `(position.x - 24, position.y + 16)`
2. **Column**: 16x32 lighter stone rectangle at `(position.x - 8, position.y - 16)`
3. **Orb**: 12px radius circle at `(position.x, position.y - 28)`, filled with ability color from `GATE_COLORS`
4. **Glow**: 20px radius gradient from ability color (alpha 0.4-0.8 pulsing) to transparent
5. **Motes**: 2-3 particles rising slowly from the orb, ability-colored, small (2-3px), sin-wave horizontal drift

### Collected pedestal:
1. **Base + Column**: Same geometry, but dimmed (alpha 0.3)
2. **Orb**: Gone (or very dim, alpha 0.1)
3. **No glow, no motes**

---

## Verification / Pass Criteria

1. **`RoomData` interface** has optional `abilityPickup` field with `ability`, `position`, and `zone`
2. **All 4 shrine rooms** are defined in `abilityShrineRooms.ts` with correct platforms, exits, gates, and pickup zones
3. **`GameWorld.update()`** detects player overlap with pickup zone and triggers `progression.unlockAbility()`
4. **`consumePickedAbility()`** returns the ability for one frame, then returns null
5. **Pedestal renders** as a pulsing colored pedestal in uncollected state, dimmed in collected state
6. **Teaching puzzles are solvable:**
   - Stitch Sanctum: two walls can be stitched through to reach the exit
   - Redaction Alcove: spikes/barrier can be redacted to reach the exit
   - Paste-Over Study: bouncy surface can be pasted onto the target platform to bounce to the exit
   - Index Mark Archive: mark can be placed, then teleported to from below
7. **Each shrine has a gate** requiring the just-unlocked ability, blocking the teaching-puzzle exit
8. **HUD notification** fires: "[Ability Name] Acquired — Press [Key] to use"
9. **Particle burst** plays at pedestal position on unlock
10. **Pickup is one-time**: revisiting the room does NOT re-trigger the ability unlock
11. **No enemies** in any shrine room
12. **Export pattern matches** herbariumRooms.ts: individual constants + Record + ID array
13. **No breaks to existing functionality**: `RoomData` addition is optional, old rooms work unchanged

---

## Notes

- Shrine rooms are defined here but NOT connected to the world graph yet. Each biome wing task (astral-atlas-wing, maritime-ledger-wing, gothic-errata-wing) will import them and wire exits. The stitch-shrine connects to the Herbarium Wing which already exists — either this task or a follow-up should add the connection from `vine-vestibule` or an early Herbarium room.
- The fog zone for `index-shrine` is NOT defined in `RoomData` (FogSystem is initialized per-room by the loading code). Add a comment in the room definition noting the intended fog zone dimensions.
- The teaching puzzles are designed to be trivially solvable once you have the ability — they're teaching moments, not challenges. The real challenge comes in the biome wing rooms.
- Exit `targetRoomId` values reference rooms that don't exist yet (e.g., `"storm-channel"`, `"nebula-crossing"`). This is expected — the biome wing tasks will create those rooms. The shrine room definitions serve as the canonical reference for exit wiring. Until the wing tasks are complete, these exits will lead to missing rooms (which `RoomManager` handles gracefully by logging a warning and not transitioning).
- The `abilityPickup` feature is designed to be consumed by both `/play` page and any test page that wants to test ability acquisition flow.

---

## Implementation Summary

### Files Created
- **`src/engine/world/abilityShrineRooms.ts`** — 4 shrine rooms (Stitch Sanctum, Redaction Alcove, Paste-Over Study, Index Mark Archive) with full platform layouts, ability pickups, teaching gates, and exit wiring to future wing rooms.

### Files Modified
- **`src/engine/world/Room.ts`** — Added `AbilityPickup` interface (`ability`, `position`, `zone` fields) and optional `abilityPickup` field on `RoomData`.
- **`src/engine/world/GameWorld.ts`** — Added ability pickup overlap detection in `update()` and `consumePickedAbility()` method for one-shot consumption.
- **`src/engine/world/RoomRenderer.ts`** — Added `renderAbilityPedestal()` function with pulsing glow, colored orb, rising motes for uncollected state, and dimmed rendering for collected state.
- **`src/app/play/page.tsx`** — Added pickup detection (rect overlap), HUD notification on acquisition, particle burst at pedestal, and pedestal rendering in the world-space render callback.
- **`src/engine/world/index.ts`** — Exported `AbilityPickup` type, `renderAbilityPedestal`, `ABILITY_SHRINE_ROOMS`, and `ABILITY_SHRINE_ROOM_IDS`.
- **`src/engine/world/demoWorld.ts`** — Added comment noting shrine rooms will be integrated by wing tasks.

### Verification
- `npx tsc --noEmit` passes with zero errors.
- All 4 shrine rooms follow the herbariumRooms.ts export pattern (individual constants + Record + ID array).
- `RoomData` addition is optional — all existing rooms continue to work unchanged.
- Shrine rooms reference future wing rooms (cargo-hold, storm-channel, constellation-path, nebula-crossing, bell-tower, mirror-hall) that will be created by wing tasks.

---

## Review Notes

**Reviewer**: 4fb5f9de
**Status**: PASS — no fixes needed

All files reviewed. `npx tsc --noEmit` passes clean.

**Checked:**
- `AbilityPickup` interface and `abilityPickup` optional field on `RoomData` — correct types
- All 4 shrine room definitions — valid platforms, exits, gates, obstacle types (`spikes`, `barrier`), surface types (`bouncy`)
- Gate positions correctly overlap exit zones to block passage
- Teaching puzzle layouts are physically sensible (walls for stitching, spikes for redacting, bouncy platform for pasting, vertical drop for index-marking)
- `GameWorld.update()` pickup detection — correct AABB overlap, one-shot via `consumePickedAbility()`
- `play/page.tsx` pickup path — independent from GameWorld (play page uses RoomManager directly), correctly uses `session.hasAbility()`, fires HUD notification and particle burst
- `renderAbilityPedestal()` — all animations (pulse, glow, motes) are time-based, not frame-count-based — frame-rate independent
- Exports in `index.ts` are complete
- `demoWorld.ts` correctly defers shrine registration to wing tasks
- No enemies in shrine rooms as specified
- Export pattern matches herbariumRooms.ts convention
