# Task: Game World Assembly — Scribe Hall Hub & World Graph

## Overview

Implement the **game world assembly** infrastructure and the **Scribe Hall hub room**, with a test page at `/test/world-assembly`. This is Phase 6, step 25+26 combined — the foundation for the integrated game. All the mechanical pieces (movement, abilities, combat, biomes, rooms, day/night, cards) exist as isolated test page systems. This task connects them into a playable multi-room world with a hub, progression tracking, and global systems.

**Core design principle:** The GameWorld class is the top-level orchestrator that makes Inkbinders a *game* instead of a collection of tech demos. It owns the room graph, tracks player progression (which abilities are unlocked, which gates are opened, which bosses are defeated), manages global systems (day/night cycle), and handles the full lifecycle from room entry to room exit.

**Scope boundary:** This task builds the *infrastructure* — GameWorld class, world graph definition, Scribe Hall room, progression state, and a small connected world demo (Scribe Hall + 3–4 rooms across 2 biomes). It does NOT build all 60–90 rooms — that's a later task. It does NOT implement Convex persistence — that's a separate task. It creates the skeleton that all future world content plugs into.

## Dependencies

- Room data model (`src/engine/world/Room.ts`) ✅
- RoomManager (`src/engine/world/RoomManager.ts`) ✅ — handles loading, exits, transitions
- Preset rooms (`src/engine/world/presetRooms.ts`) ✅ — 3 rooms as reference
- DayNightCycle (`src/engine/world/DayNightCycle.ts`) ✅
- DayNightAtmosphere + DayNightRenderer ✅
- CorruptionModifiers ✅
- BiomeTheme system (`src/engine/world/Biome.ts`) ✅
- All abilities (MarginStitch, Redaction, PasteOver, IndexMark) ✅
- CombatSystem ✅
- VineSystem ✅
- All enemy types (Reader, Binder, Proofwarden) ✅
- CardModifierEngine ✅
- Player with full state machine ✅
- Camera, ParticleSystem, ScreenShake ✅

## What to Build

### 1. PlayerProgression (`src/engine/world/PlayerProgression.ts`)

A pure data class tracking what the player has accomplished. This is the save-game state (eventually persisted to Convex, but for now in-memory only).

```typescript
export interface PlayerProgressionData {
  /** Which abilities the player has unlocked */
  unlockedAbilities: Set<GateAbility>;
  /** Which gates have been opened (by gate ID) */
  openedGates: Set<string>;
  /** Which bosses have been defeated (by boss ID) */
  defeatedBosses: Set<string>;
  /** Which rooms have been visited (by room ID) */
  visitedRooms: Set<string>;
  /** Player's card deck (serialized) */
  cardDeckData: CardDeckData | null;
  /** Current player health */
  currentHealth: number;
  /** Max player health */
  maxHealth: number;
  /** Current room ID (for save/resume) */
  currentRoomId: RoomId;
  /** Total play time in seconds */
  totalPlayTime: number;
  /** Number of deaths */
  deathCount: number;
}

export interface CardDeckData {
  /** All owned card IDs */
  ownedCards: string[];
  /** Equipped card IDs (up to 4) */
  equippedCards: string[];
}

export class PlayerProgression {
  data: PlayerProgressionData;

  constructor(startingRoomId: RoomId);

  /** Unlock an ability (e.g., after collecting it in a room) */
  unlockAbility(ability: GateAbility): void;
  /** Check if an ability is unlocked */
  hasAbility(ability: GateAbility): boolean;
  /** Mark a gate as opened */
  openGate(gateId: string): void;
  /** Check if a gate has been opened */
  isGateOpened(gateId: string): boolean;
  /** Mark a boss as defeated */
  defeatBoss(bossId: string): void;
  /** Check if a boss is defeated */
  isBossDefeated(bossId: string): boolean;
  /** Mark a room as visited */
  visitRoom(roomId: RoomId): void;
  /** Export to plain object (for future Convex serialization) */
  serialize(): Record<string, unknown>;
  /** Import from plain object */
  static deserialize(data: Record<string, unknown>): PlayerProgression;
}
```

**For the test page demo**, all 4 abilities start unlocked so the player can open any gate.

### 2. WorldGraph (`src/engine/world/WorldGraph.ts`)

The world graph defines the complete room layout — which rooms exist, how they connect, and which biome they belong to. This is the "map" of the game world.

```typescript
export interface WorldRegion {
  /** Region/biome identifier */
  id: string;
  /** Display name */
  name: string;
  /** Biome theme ID (matches BiomeTheme.id) */
  biomeId: string;
  /** Room IDs in this region */
  roomIds: RoomId[];
}

export interface WorldGraphData {
  /** All regions in the world */
  regions: WorldRegion[];
  /** The starting room when beginning a new game */
  startingRoomId: RoomId;
  /** The hub room (Scribe Hall) */
  hubRoomId: RoomId;
}

export class WorldGraph {
  data: WorldGraphData;
  /** All rooms in the world, keyed by ID */
  rooms: Map<RoomId, RoomData>;

  constructor(data: WorldGraphData, rooms: Map<RoomId, RoomData>);

  /** Get the region a room belongs to */
  getRegion(roomId: RoomId): WorldRegion | null;
  /** Get all rooms in a region */
  getRoomsInRegion(regionId: string): RoomData[];
  /** Get all rooms reachable from a given room (via exits) */
  getAdjacentRooms(roomId: RoomId): RoomId[];
  /** Get the biome ID for a room */
  getBiomeId(roomId: RoomId): string;
}
```

### 3. GameWorld (`src/engine/world/GameWorld.ts`)

The top-level orchestrator. Owns RoomManager, DayNightCycle, PlayerProgression, and coordinates the global game state.

```typescript
export interface GameWorldConfig {
  worldGraph: WorldGraph;
  /** Initial player params (base, before card mods) */
  basePlayerParams: PlayerParams;
  /** Day/night cycle params */
  dayNightParams?: Partial<DayNightParams>;
  /** Whether abilities are all unlocked (for testing) */
  allAbilitiesUnlocked?: boolean;
}

export class GameWorld {
  readonly worldGraph: WorldGraph;
  readonly roomManager: RoomManager;
  readonly dayNight: DayNightCycle;
  readonly atmosphere: typeof DayNightAtmosphere; // static helper module
  readonly progression: PlayerProgression;

  /** Current biome theme (derived from current room) */
  currentTheme: BiomeTheme;

  constructor(config: GameWorldConfig);

  /**
   * Update the world for one frame.
   * Advances day/night cycle, checks room exits, handles transitions.
   * Returns a WorldFrameState with everything the renderer needs.
   */
  update(dt: number, playerBounds: Rect): WorldFrameState;

  /**
   * Handle a room transition triggered by the player hitting an exit zone.
   * Called by the test page when RoomManager detects an exit.
   */
  transitionToRoom(exit: RoomExit): void;

  /**
   * Try to open a gate. Checks if the player has the required ability.
   * Returns true if the gate was opened.
   */
  tryOpenGate(gateId: string): boolean;

  /**
   * Get the biome theme for the current room.
   */
  getCurrentTheme(): BiomeTheme;

  /**
   * Get corruption modifiers for the current time of day.
   */
  getCorruptionState(): CorruptionState;

  /**
   * Spawn enemies for the current room based on room data and defeat state.
   */
  getActiveEnemySpawns(): EnemySpawn[];

  /**
   * Register a boss defeat.
   */
  defeatBoss(bossId: string): void;
}

export interface WorldFrameState {
  /** Current day/night phase */
  timeOfDay: string;
  /** Light level (0-1) */
  lightLevel: number;
  /** Corruption intensity (0-1) */
  corruptionIntensity: number;
  /** Current atmosphere colors */
  atmosphereColors: AtmosphereColors;
  /** Whether a room transition is in progress */
  transitioning: boolean;
  /** Transition progress (0-1) */
  transitionProgress: number;
  /** Current room ID */
  currentRoomId: RoomId;
  /** Current biome theme */
  theme: BiomeTheme;
}
```

### 4. Scribe Hall Room Definition

The Scribe Hall is the player's home base — a cozy, safe room where the player can rest between expeditions. It's the central hub with exits to different biome regions.

**Design:** The Scribe Hall is a large room (1920×1080) designed as a warm, inviting library study. No enemies. No hazards. Multiple exits lead to different biome wings.

```
Scribe Hall Layout (1920×1080):
┌─────────────────────────────────────────────────────────────────────┐
│  [ceiling]                                                          │
│                                                                     │
│           ┌──book shelves──┐         ┌──book shelves──┐            │
│           │                │         │                │            │
│   [exit   │   upper mez.   │  desk   │   upper mez.   │  [exit    │
│   left]   └────────────────┘  area   └────────────────┘  right]   │
│                                                                     │
│      ┌─platforms─┐     ┌──reading nook──┐     ┌─platforms─┐       │
│      └───────────┘     └────────────────┘     └───────────┘       │
│                                                                     │
│   [exit                    [floor]                    [exit         │
│   bottom-left]            ┌spawn┐                   bottom-right] │
│  ═══════════════════════════════════════════════════════════════════│
│  [floor — full width, safe ground]                                 │
└─────────────────────────────────────────────────────────────────────┘
```

**Exits (4 directions to biome wings):**
- **Left exit** → Tutorial Corridor (leads to Herbarium Folio wing)
- **Right exit** → leads to a new "Archive Passage" room (connects to other biomes)
- **Bottom-left exit** → leads down to a new "Foundation Cellar" room (connects to underground areas)
- **Bottom-right exit** → leads down to another wing

**Visual theme:** Warm parchment tones, bookshelves rendered as thick platform blocks, a reading desk area, candle-like ambient particles. This is the one room that always feels safe and cozy, regardless of the day/night cycle (corruption is suppressed in the hub).

Create `SCRIBE_HALL` in a new file `src/engine/world/scribeHall.ts` alongside the existing `presetRooms.ts`.

```typescript
// Scribe Hall room data
export const SCRIBE_HALL: RoomData = {
  id: "scribe-hall",
  name: "Scribe Hall",
  width: 1920,
  height: 1080,
  biomeId: "scribe-hall", // unique hub biome
  defaultSpawn: { x: 960, y: 1080 - 64 - 32 }, // center of floor
  platforms: [
    // Floor (full width, solid)
    { x: 0, y: 1080 - 32, width: 1920, height: 32 },
    // Left wall
    { x: 0, y: 0, width: 32, height: 1080 },
    // Right wall
    { x: 1920 - 32, y: 0, width: 32, height: 1080 },
    // Ceiling
    { x: 0, y: 0, width: 1920, height: 32 },

    // Left bookshelf (upper mezzanine)
    { x: 300, y: 500, width: 320, height: 32 },
    { x: 260, y: 500, width: 40, height: 200 },  // shelf back wall
    { x: 620, y: 500, width: 40, height: 200 },  // shelf side wall

    // Right bookshelf (upper mezzanine)
    { x: 1260, y: 500, width: 320, height: 32 },
    { x: 1220, y: 500, width: 40, height: 200 },
    { x: 1580, y: 500, width: 40, height: 200 },

    // Central reading nook platform
    { x: 760, y: 700, width: 400, height: 32 },

    // Stepping platforms (left side)
    { x: 100, y: 800, width: 160, height: 32 },
    { x: 200, y: 650, width: 128, height: 32 },

    // Stepping platforms (right side)
    { x: 1660, y: 800, width: 160, height: 32 },
    { x: 1592, y: 650, width: 128, height: 32 },

    // Desk area (central elevated platform)
    { x: 800, y: 400, width: 320, height: 32 },
  ],
  obstacles: [], // No hazards in the hub
  exits: [
    // Left exit → Tutorial Corridor (Herbarium Folio wing)
    {
      direction: "left",
      zone: { x: 0, y: 1080 - 32 - 128, width: 16, height: 96 },
      targetRoomId: "tutorial-corridor",
      targetSpawnPoint: { x: 1920 - 80, y: 540 - 64 - 32 },
    },
    // Right exit → Archive Passage
    {
      direction: "right",
      zone: { x: 1920 - 16, y: 1080 - 32 - 128, width: 16, height: 96 },
      targetRoomId: "archive-passage",
      targetSpawnPoint: { x: 64, y: 540 - 64 - 32 },
    },
  ],
  gates: [], // No gates in the hub
  enemies: [], // No enemies in the hub
  vineAnchors: [],
};
```

### 5. Additional Rooms for the Demo World

Create 1–2 new simple rooms to connect the Scribe Hall to the existing preset rooms and demonstrate the world graph working. These go in a new `src/engine/world/demoWorld.ts`.

**Archive Passage** — a small connecting corridor (960×540) with a few platforms. Links Scribe Hall (left) to the Vertical Shaft (right). Biome: default.

**Update existing preset rooms** to link back to the Scribe Hall:
- Tutorial Corridor gets a left exit back to Scribe Hall
- Modify `presetRooms.ts` to add the new exit

### 6. Scribe Hall BiomeTheme

Create `SCRIBE_HALL_THEME` in `Biome.ts`:

```typescript
export const SCRIBE_HALL_THEME: BiomeTheme = {
  id: "scribe-hall",
  name: "Scribe Hall",
  backgroundColor: "#1a1512",       // Warm dark brown
  platformFillColor: "#3d2e22",     // Rich wood brown
  platformStrokeColor: "#6b5344",   // Lighter wood grain
  ambientParticleColors: ["#fbbf24", "#f59e0b", "#d97706", "#fcd34d"], // Warm candlelight
  ambientParticleRate: 1.5,         // Gentle, not busy
  foregroundTint: "rgba(251, 191, 36, 0.02)", // Faint warm glow
  palette: [
    "#1a1512",  // Warm dark (background)
    "#3d2e22",  // Wood brown (platforms)
    "#6b5344",  // Wood grain (outlines)
    "#fbbf24",  // Gold (candle glow)
    "#f5f0e6",  // Warm parchment (text, highlights)
    "#8b7355",  // Leather (accents)
  ],
};
```

### 7. Demo World Definition (`src/engine/world/demoWorld.ts`)

Assembles all rooms and the world graph into a playable demo:

```typescript
import { WorldGraph, WorldGraphData } from "./WorldGraph";
import { SCRIBE_HALL } from "./scribeHall";
import { TUTORIAL_CORRIDOR, VERTICAL_SHAFT, VINE_GARDEN } from "./presetRooms";
import { ARCHIVE_PASSAGE } from "./demoWorld"; // defined in same file

export const ARCHIVE_PASSAGE: RoomData = {
  id: "archive-passage",
  name: "Archive Passage",
  width: 960,
  height: 540,
  biomeId: "default",
  defaultSpawn: { x: 64, y: 540 - 64 - 32 },
  platforms: [
    // Floor
    { x: 0, y: 540 - 32, width: 960, height: 32 },
    // Walls
    { x: 0, y: 0, width: 32, height: 540 },
    { x: 960 - 32, y: 0, width: 32, height: 540 },
    // Ceiling
    { x: 0, y: 0, width: 960, height: 32 },
    // Some stepping platforms
    { x: 200, y: 380, width: 128, height: 32 },
    { x: 500, y: 320, width: 128, height: 32 },
    { x: 750, y: 400, width: 128, height: 32 },
  ],
  obstacles: [],
  exits: [
    // Left → Scribe Hall
    {
      direction: "left",
      zone: { x: 0, y: 540 - 32 - 128, width: 16, height: 96 },
      targetRoomId: "scribe-hall",
      targetSpawnPoint: { x: 1920 - 80, y: 1080 - 64 - 32 },
    },
    // Right → Vertical Shaft
    {
      direction: "right",
      zone: { x: 960 - 16, y: 540 - 32 - 128, width: 16, height: 96 },
      targetRoomId: "vertical-shaft",
      targetSpawnPoint: { x: 64, y: 1080 - 64 - 32 },
    },
  ],
  gates: [],
  enemies: [
    {
      id: "enemy_ap_1",
      position: { x: 500, y: 540 - 32 },
      type: "reader",
      patrolRange: 100,
      groundY: 540 - 32,
      facingRight: true,
    },
  ],
  vineAnchors: [],
};

// Build the demo world graph
export const DEMO_WORLD_DATA: WorldGraphData = {
  startingRoomId: "scribe-hall",
  hubRoomId: "scribe-hall",
  regions: [
    {
      id: "hub",
      name: "Scribe Hall",
      biomeId: "scribe-hall",
      roomIds: ["scribe-hall"],
    },
    {
      id: "herbarium-wing",
      name: "Herbarium Wing",
      biomeId: "herbarium-folio",
      roomIds: ["tutorial-corridor", "vine-garden"],
    },
    {
      id: "central-archives",
      name: "Central Archives",
      biomeId: "default",
      roomIds: ["archive-passage", "vertical-shaft"],
    },
  ],
};

export function createDemoWorld(): { worldGraph: WorldGraph; rooms: Map<string, RoomData> } {
  const rooms = new Map<string, RoomData>();
  rooms.set("scribe-hall", SCRIBE_HALL);
  rooms.set("tutorial-corridor", TUTORIAL_CORRIDOR);
  rooms.set("vertical-shaft", VERTICAL_SHAFT);
  rooms.set("vine-garden", VINE_GARDEN);
  rooms.set("archive-passage", ARCHIVE_PASSAGE);

  const worldGraph = new WorldGraph(DEMO_WORLD_DATA, rooms);
  return { worldGraph, rooms };
}
```

### 8. World Assembly Test Page (`src/app/test/world-assembly/page.tsx`)

A test page that demonstrates the full integrated world. The player starts in the Scribe Hall and can explore the connected rooms.

**Features:**
- Player starts in Scribe Hall
- Can walk through exits to transition between rooms (fade-to-black transitions)
- Day/night cycle runs globally (time advances across room transitions)
- Biome theme changes per room (Scribe Hall = warm brown, Vine Garden = green herbarium, etc.)
- Ability gates can be opened (all abilities unlocked for testing)
- Enemies spawn in rooms (Readers patrol, can be fought)
- Progression state tracks visited rooms, opened gates
- Hub room (Scribe Hall) is safe — no enemies, no corruption
- Corruption effects apply during night phase in non-hub rooms

**Debug Panel sections:**

1. **World State** (expanded):
   - Current room name + ID
   - Current biome
   - Rooms visited: X / Y total
   - Gates opened: X / Y total
   - Deaths: N
   - Play time: M:SS

2. **Day/Night** (collapsed):
   - Time of day (dawn/day/dusk/night)
   - Light level
   - Corruption intensity
   - Cycle speed slider (0.1–5.0, default 1.0)
   - Skip to phase buttons (Dawn, Day, Dusk, Night)

3. **Player Params** (collapsed):
   - Standard movement sliders

4. **Room Map** (collapsed):
   - Simple text list of all rooms with [✓] for visited
   - Current room highlighted
   - Shows exits and where they lead

5. **Goals** (bottom):
   - Pass criteria checklist

**Update loop (in `engine.onUpdate()`):**
1. `gameWorld.update(dt, playerBounds)` — advances day/night, checks transitions
2. Player update (with combat, abilities wired)
3. Collision resolution with current TileMap
4. Camera follow
5. Enemy updates
6. Particle updates

**Render loop (in `engine.onRender()`):**
1. Day/Night background (atmosphere-colored)
2. Biome background (parallax) if current biome has one
3. TileMap platforms (biome-colored)
4. Room elements (gates, exit indicators, spawn markers)
5. Enemies
6. Player
7. Combat hitboxes (debug)
8. Particles
9. Day/Night overlays (light level, corruption effects)
10. Room transition fade overlay
11. HUD (room name, day/night clock, health)

**Room transition handling:**
When `roomManager` detects the player in an exit zone:
1. Start fade-out (0.3s)
2. At fade midpoint: load new room, reposition player, update biome theme, rebuild TileMap, spawn enemies
3. Fade-in (0.3s)
4. Update progression (mark room as visited)

### 9. Minimap HUD

Add a small minimap in the top-right corner of the canvas showing the room graph:
- Each room is a small rectangle (proportional to room size, scaled down)
- Current room is highlighted (bright border)
- Visited rooms are filled, unvisited are hollow outlines
- Exits draw lines connecting room rectangles
- Player dot shows approximate position within the current room
- Hub room has a special icon/color (gold border)

This is rendered as a canvas overlay in screen-space (after camera transform is reset).

**Minimap constants:**
- `MINIMAP_X = 720` (top-right area)
- `MINIMAP_Y = 16`
- `MINIMAP_WIDTH = 220`
- `MINIMAP_HEIGHT = 140`
- `MINIMAP_BG_ALPHA = 0.6`
- Room scale: fit all rooms into the minimap area, rooms proportional to actual size

### 10. Update Existing Files

**Modify `presetRooms.ts`:**
- Add a left exit to Tutorial Corridor that leads back to Scribe Hall
- Add a left exit to Vertical Shaft that also leads to Archive Passage (update the existing left exit target)

**Modify `src/lib/testStatus.ts`:**
- Add a new entry for "World Assembly" test page: `{ name: "World Assembly", path: "/test/world-assembly", phase: 6, phaseName: "Integration", status: "in-progress", description: "Connected world with Scribe Hall hub" }`

**Modify `Biome.ts`:**
- Add `SCRIBE_HALL_THEME`
- Add a `DEFAULT_THEME` for rooms with biomeId "default" (neutral gray/brown)
- Export a `getBiomeTheme(biomeId: string): BiomeTheme` lookup function

## Specific Values & Constants

| Constant | Value | Notes |
|----------|-------|-------|
| Scribe Hall size | 1920×1080 | Large hub room |
| Archive Passage size | 960×540 | Small connector |
| Room transition duration | 0.7s total | 0.3s fade-out + 0.1s black + 0.3s fade-in |
| Day/night cycle default | 120s | Same as day-night test page |
| Hub corruption immunity | true | Scribe Hall never gets corruption |
| Starting abilities (test) | All 4 unlocked | For demo exploration |
| Minimap room scale | Auto-fit | Scale rooms proportionally into minimap area |
| Minimap background alpha | 0.6 | Semi-transparent overlay |

## Pass Criteria

Display these on the test page:

1. **Scribe Hall loads:** Game starts in Scribe Hall with correct warm theme
2. **Room transition works:** Walking into an exit triggers fade-to-black transition to the target room
3. **Biome theme changes:** Entering Vine Garden changes to green herbarium theme; returning to Scribe Hall restores warm theme
4. **Multi-room traversal:** Can travel Scribe Hall → Tutorial Corridor → Vertical Shaft → Vine Garden and back
5. **Archive Passage route:** Can travel Scribe Hall → Archive Passage → Vertical Shaft (alternative path)
6. **Day/night runs globally:** The cycle continues across room transitions (time doesn't reset)
7. **Hub is safe:** Scribe Hall has no enemies, no corruption effects, no hazards
8. **Corruption in non-hub rooms:** Corruption modifiers (fog, surface flip, etc.) apply at night in exploration rooms
9. **Gates work:** Ability gates in rooms can be opened and stay open across room transitions
10. **Enemies spawn:** Enemies appear in rooms that have spawn points
11. **Progression tracks visits:** Debug panel shows visited room count incrementing
12. **Minimap renders:** Room graph minimap appears in top-right, shows current room highlighted
13. **Player dot on minimap:** Player position shows as a dot within the current room on the minimap
14. **Return to hub:** Can always navigate back to Scribe Hall from any room
15. **Room name HUD:** Current room name displays on canvas

## Files to Create

- `src/engine/world/PlayerProgression.ts` — progression tracking class
- `src/engine/world/WorldGraph.ts` — world graph / region definition
- `src/engine/world/GameWorld.ts` — top-level world orchestrator
- `src/engine/world/scribeHall.ts` — Scribe Hall room data
- `src/engine/world/demoWorld.ts` — demo world assembly (Archive Passage + world graph + factory)
- `src/app/test/world-assembly/page.tsx` — test page

## Files to Modify

- `src/engine/world/Biome.ts` — add SCRIBE_HALL_THEME, DEFAULT_THEME, getBiomeTheme() lookup
- `src/engine/world/presetRooms.ts` — add exit from Tutorial Corridor back to Scribe Hall
- `src/lib/testStatus.ts` — add World Assembly test page entry

## Update After Implementation

- `AGENTS.md` — add sections for GameWorld, PlayerProgression, WorldGraph, Scribe Hall, demo world pattern

## Implementation Notes

1. **GameWorld wraps RoomManager.** Don't rewrite room loading/transition logic — GameWorld delegates to RoomManager and adds global state (day/night, progression, biome theming) on top.

2. **Biome theme lookup.** The `getBiomeTheme()` function maps `biomeId` strings to `BiomeTheme` objects. This is how the test page knows which colors to use. When a room transition completes, read the new room's `biomeId` and update the rendering theme.

3. **Hub immunity.** When `currentRoom.id === worldGraph.data.hubRoomId`, skip all corruption effects (surface flip, fog-of-war, platform flicker, gravity pulse). The hub is always safe.

4. **Enemy management in the test page.** Create enemy instances when entering a room (from `EnemySpawn` data). Destroy them on room exit. Don't persist enemy state across room transitions — enemies respawn each visit (standard metroidvania pattern).

5. **The minimap is purely visual** — no click interaction. It's a canvas-rendered overlay, not a React component. Render it in the engine's render callback after clearing the camera transform.

6. **Don't wire VineSystem or biome-specific systems (CurrentSystem, GravityWellSystem, FogSystem) yet.** Those will be added when rooms specify them. For now, rooms with `biomeId: "herbarium-folio"` render with the green theme but don't auto-attach vines — that's a future room-content task. The test page can optionally wire VineSystem for the Vine Garden room as a stretch goal.

7. **Day/night cycle speed slider** in the debug panel lets testers fast-forward through the cycle. Default cycle is 120s but setting speed to 5.0 makes it 24s — useful for testing corruption effects.

8. **Player health / death.** If the player dies (health reaches 0 from enemy damage or hazards), respawn at the current room's `defaultSpawn` with full health. Increment `deathCount` in progression. Don't transition to a death screen — just instant respawn for now.

## Verification

- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` succeeds
- [ ] Navigate to `/test/world-assembly` — canvas renders Scribe Hall with warm theme
- [ ] Walk left to exit → fades to Tutorial Corridor with different theme
- [ ] Walk right through Tutorial Corridor → exits to Vertical Shaft
- [ ] Climb Vertical Shaft → exit to Vine Garden (green herbarium theme)
- [ ] Walk right from Scribe Hall → Archive Passage → right → Vertical Shaft
- [ ] Day/night cycle runs, corruption appears at night in non-hub rooms
- [ ] Return to Scribe Hall — warm theme, no corruption, no enemies
- [ ] Minimap shows room graph with current room highlighted
- [ ] Debug panel shows world state, progression, and room map
- [ ] All 15 pass criteria checkable
