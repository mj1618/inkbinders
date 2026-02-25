# Task: Main Menu & Game Start Flow — Title Screen to Gameplay

## Overview

Build the **main menu system**, **game initialization flow**, and the `/play` route that ties together the save system, world assembly, and HUD into an actual playable game experience. This is a Phase 6 integration task that transforms Inkbinders from a collection of test pages into something with a front door.

Currently, the landing page (`/`) is a simple title + link to `/test`. There's no way to start a game, choose a save slot, or enter the world. The save system exists (engine-side `SaveSystem` + Convex persistence), the world assembly is being built, and the HUD is in progress — but nothing connects them. This task creates:

1. A **Title Screen** (`/`) with animated ink-wash aesthetics and menu options
2. A **Save Slot Selection** screen (new game / continue / delete)
3. A **Game Session** page (`/play`) that loads a save, initializes the world, and runs the game
4. A **GameSession** engine class that orchestrates player progression, world state, and save/load during gameplay
5. A **PlayerProgression** engine class (if not already built by the world assembly task) that tracks runtime progression state

**Core design principle:** The main menu is a React page with canvas-rendered effects (not a full engine canvas). The game session page (`/play`) hosts the real game engine canvas. The transition from menu → game is a Next.js route change. This keeps the menu lightweight and the game engine isolated.

**Scope boundary:** This task builds the menu UI, save slot flow, and game initialization plumbing. It does NOT build all 60–90 rooms or the full game content. It creates a working flow: Title → Save Select → Load/New → Enter World → Pause → Save → Return to Menu. The actual world content comes from the world assembly task; this task consumes whatever rooms exist.

## Dependencies

- `SaveSystem` (`src/engine/save/SaveSystem.ts`) ✅ — snapshot creation, formatting
- `SaveSlotSummary`, `GameSaveData`, `LoadedGameState` types ✅
- Convex save queries/mutations (`convex/saves.ts`, `convex/saveMutations.ts`) ✅
- `ConvexClientProvider` ✅ — graceful fallback when Convex is unavailable
- `Engine`, `Camera`, `ParticleSystem`, `InputManager` ✅ — game loop and systems
- `Player`, `PlayerParams`, `DEFAULT_PLAYER_PARAMS` ✅
- `TileMap`, `RoomManager` ✅ — room loading and transitions
- `GameHUD` (from HUD task, may be in progress) — **soft dependency**: if it doesn't exist yet, the game session renders a minimal fallback HUD
- `GameWorld`, `WorldGraph`, demo world (from world assembly task, may be in progress) — **soft dependency**: if it doesn't exist yet, use a single-room fallback
- `DayNightCycle` ✅
- `CombatSystem` ✅
- Ability classes ✅

**Soft dependencies explained:** This task MUST work even if the world assembly and HUD tasks haven't landed yet. It checks for the existence of `GameWorld`, `WorldGraph`, and `GameHUD` classes and falls back to simpler alternatives if they're not available. This means:
- If `GameWorld` doesn't exist → create a single tutorial-corridor room as the fallback
- If `GameHUD` doesn't exist → render a minimal health bar + room name directly
- The task is designed to be upgraded as those systems land

## What to Build

### 1. Title Screen — Update `src/app/page.tsx`

Replace the current landing page with an animated title screen. This is a React page (not a canvas-based game page), but it uses a small background canvas for visual effects.

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│                                                       │
│   (animated ink wash background — canvas element)     │
│                                                       │
│                                                       │
│                   I N K B I N D E R S                 │
│              The Library That Fights Back              │
│                                                       │
│                                                       │
│                  ▸ Continue                            │  ← only if save exists
│                    New Game                            │
│                    Test Pages                          │
│                                                       │
│                                                       │
│              © 2026 — Hand-inked with care            │
│                                                       │
└─────────────────────────────────────────────────────┘
```

**Menu options:**
- **Continue** — Shown only when at least one non-empty save slot exists. Loads the most recently saved slot and navigates to `/play`.
- **New Game** — Opens the save slot selection overlay (choose a slot for the new game).
- **Test Pages** — Navigates to `/test` (existing hub page).

**Visual effects (background canvas):**
The title screen has a small decorative canvas behind the menu. This canvas renders:
- Slowly drifting ink particles (dark gray/indigo) moving upward — like ink dissolving in water
- A faint paper grain texture overlay (noise pattern at very low alpha)
- Subtle color cycling between warm parchment and cool indigo (matching the day/night themes)
- No game engine instantiation — just a simple requestAnimationFrame loop for the background

**Implementation:**
```typescript
// Background effect — simple standalone animation, not the game engine
function InkWashBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    // Simple particle system — 50 ink droplets drifting upward
    interface InkDrop { x: number; y: number; vy: number; size: number; alpha: number; }
    const drops: InkDrop[] = [];
    // ... initialize and animate in rAF loop

    let animId: number;
    function animate() {
      // Clear, update drops, draw drops
      animId = requestAnimationFrame(animate);
    }
    animate();
    return () => cancelAnimationFrame(animId);
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}
```

**Menu interaction:**
- Keyboard navigation: Up/Down arrows or W/S to move selection, Enter to confirm
- Mouse: hover highlights, click selects
- The menu is React components over the canvas background (not rendered on the canvas)
- Use Tailwind for styling — `text-zinc-100`, `bg-zinc-950`, etc.
- Selected item: brighter text (`text-white`) + subtle left arrow indicator
- Unselected items: dimmer text (`text-zinc-400`)
- Title: large font (3xl), tracked/spaced, warm gold color (`text-amber-200`)
- Subtitle: smaller, italic, muted (`text-zinc-500`)

**Font sizes and styles:**
- Title: `text-4xl font-bold tracking-[0.25em] text-amber-200`
- Subtitle: `text-lg italic text-zinc-500`
- Menu items: `text-xl text-zinc-400 hover:text-white transition-colors`
- Selected menu item: `text-xl text-white`
- Footer: `text-sm text-zinc-700`

### 2. Save Slot Selection — `src/components/SaveSlotSelect.tsx`

A modal/overlay component shown when the player selects "New Game" or wants to manage saves. Shows 3 save slots.

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│                                                       │
│                   Select Save Slot                    │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Slot 1 — "Archivist"                           │ │
│  │  Scribe Hall · 23% · 2:15 · 3 deaths            │ │
│  │  Last saved: 5 min ago                           │ │
│  │  [Load]  [Overwrite]  [Delete]                   │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Slot 2 — Empty                                  │ │
│  │  [New Game]                                      │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Slot 3 — Empty                                  │ │
│  │  [New Game]                                      │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│                     [Back]                             │
│                                                       │
└─────────────────────────────────────────────────────┘
```

**Slot card details:**
- **Non-empty slot:** Player name, current room, completion %, play time (formatted), death count, last saved timestamp (relative). Actions: Load, Overwrite (start new in this slot), Delete (with confirmation).
- **Empty slot:** "Empty" label. Action: New Game (starts a new game in this slot).
- **Delete confirmation:** Inline confirmation — "Are you sure? This cannot be undone." with [Confirm] / [Cancel] buttons. Uses red color for the destructive action.
- **Overwrite confirmation:** Similar inline confirmation — "Overwrite existing save?" with [Confirm] / [Cancel].

**Data source:**
- Try Convex first: `useQuery(api.saves.listSaveSlots)` if connected
- Fallback: in-memory mock data (same pattern as `/test/save-load`)
- The component receives a `mode` prop: `"new-game"` (shows overwrite/new options) or `"load"` (shows load/delete options)
- Callback prop: `onSelect(action: "load" | "new", slot: number)` — called when a slot is chosen
- Callback prop: `onDelete(slot: number)` — called when delete is confirmed
- Callback prop: `onBack()` — called when back is pressed

**Styling:**
- Dark background overlay (`bg-zinc-950/80 backdrop-blur-sm`)
- Slot cards: `bg-zinc-900 border border-zinc-800 rounded-lg p-4`
- Selected slot: `border-amber-500`
- Actions: `text-sm` buttons with appropriate colors (green for Load, amber for New, red for Delete)

### 3. Name Entry — `src/components/NameEntry.tsx`

When starting a new game, prompt for a player name. Simple text input.

**Layout:**

```
┌─────────────────────────────────────────┐
│         Enter Your Name                  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  Archivist_                         │  │  ← text input
│  └────────────────────────────────────┘  │
│                                          │
│  Default: "Archivist"                    │
│                                          │
│         [Begin]    [Back]                │
└─────────────────────────────────────────┘
```

- Default name: "Archivist"
- Max length: 20 characters
- Alphanumeric + spaces only
- Auto-focused text input
- Enter key submits
- Minimal styling matching the title screen aesthetic
- Callback: `onConfirm(name: string)` and `onBack()`

### 4. GameSession Class (`src/engine/core/GameSession.ts`)

The runtime orchestrator for an active game. Pure TypeScript, no React dependencies. This class owns the game state for a single play session and provides the API that the `/play` page calls.

```typescript
export interface GameSessionConfig {
  /** The save slot this session is using (1-3) */
  slot: number;
  /** Player name */
  playerName: string;
  /** Whether this is a new game or loaded from save */
  isNewGame: boolean;
  /** Loaded game state (null for new game) */
  loadedState: LoadedGameState | null;
  /** Base player params */
  basePlayerParams?: PlayerParams;
}

export interface GameSessionState {
  /** Current slot */
  slot: number;
  /** Player name */
  playerName: string;
  /** Current room ID */
  currentRoomId: string;
  /** Current room name */
  currentRoomName: string;
  /** Total play time in seconds (accumulated) */
  totalPlayTime: number;
  /** Death count */
  deathCount: number;
  /** Unlocked abilities */
  unlockedAbilities: string[];
  /** Opened gates */
  openedGates: string[];
  /** Defeated bosses */
  defeatedBosses: string[];
  /** Visited rooms */
  visitedRooms: string[];
  /** Player health */
  currentHealth: number;
  /** Player max health */
  maxHealth: number;
  /** Card deck data */
  cardDeckData: { ownedCards: string[]; equippedCards: string[] } | null;
  /** Completion percent */
  completionPercent: number;
  /** Whether the session is paused */
  paused: boolean;
}

export class GameSession {
  readonly config: GameSessionConfig;
  private sessionStartTime: number;  // Date.now() at session start
  private accumulatedPlayTime: number;  // Loaded play time + session time

  // Progression state
  private unlockedAbilities: Set<string>;
  private openedGates: Set<string>;
  private defeatedBosses: Set<string>;
  private visitedRooms: Set<string>;

  // Health
  private currentHealth: number;
  private maxHealth: number;

  // Card state
  private cardDeckData: { ownedCards: string[]; equippedCards: string[] } | null;

  // Room
  private currentRoomId: string;
  private currentRoomName: string;

  // Pause state
  paused: boolean;

  constructor(config: GameSessionConfig);

  /** Get the starting room ID for this session */
  getStartingRoomId(): string;

  /** Get current total play time (accumulated + session time) */
  getTotalPlayTime(): number;

  /** Update room info when transitioning */
  enterRoom(roomId: string, roomName: string): void;

  /** Unlock an ability */
  unlockAbility(ability: string): void;

  /** Check if an ability is unlocked */
  hasAbility(ability: string): boolean;

  /** Open a gate */
  openGate(gateId: string): void;

  /** Defeat a boss */
  defeatBoss(bossId: string): void;

  /** Record a death */
  recordDeath(): void;

  /** Update health */
  setHealth(current: number, max: number): void;

  /** Get current session state (for UI display and save creation) */
  getState(): GameSessionState;

  /**
   * Create a save snapshot from current state.
   * Returns a GameSaveData ready to be persisted.
   */
  createSaveSnapshot(): GameSaveData;

  /** Toggle pause */
  togglePause(): void;
}
```

**New game defaults:**
- Starting room: `"scribe-hall"` (or `"tutorial-corridor"` as fallback)
- All abilities locked (for a real game). For development/testing, add a `DEV_ALL_ABILITIES` constant that can be toggled.
- Health: 5/5
- No cards
- No visited rooms, no gates, no bosses

**Loaded game initialization:**
- Restore all progression state from `LoadedGameState`
- Add accumulated play time from save
- Start in the saved room

### 5. Game Page — `src/app/play/page.tsx`

The main game page. This is where the actual game runs. It mounts the engine canvas and wires up all systems.

```
'use client'

// Route: /play?slot=1
// Reads slot number from URL search params
// If no slot param → redirect to /

// Flow:
// 1. Read slot from URL params
// 2. Load save data (Convex or mock)
// 3. Create GameSession
// 4. Mount engine canvas
// 5. Initialize world (GameWorld if available, or fallback rooms)
// 6. Create player, wire systems
// 7. Start game loop
// 8. Handle pause menu (resume / save / quit-to-menu)
// 9. Auto-save on room transitions
```

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│                                                       │
│   Full-screen canvas (960×540, centered)              │
│   with HUD overlay                                    │
│                                                       │
│   No debug panel (this is the real game, not a test)  │
│                                                       │
│   Pause menu (ESC) with:                              │
│     Resume                                            │
│     Save Game                                         │
│     Save & Quit to Menu                               │
│     Quit to Menu (no save)                            │
│                                                       │
└─────────────────────────────────────────────────────┘
```

**Key implementation details:**

**Loading state:** Show a "Loading..." screen while save data is being fetched and assets are being loaded. Simple centered text with an ink-drip animation.

**World initialization:**
```typescript
// Try to use GameWorld if available (from world assembly task)
let worldAvailable = false;
try {
  // Dynamic import to avoid hard dependency
  const worldMod = await import("@/engine/world/GameWorld");
  const demoMod = await import("@/engine/world/demoWorld");
  // If these exist, use them
  worldAvailable = true;
} catch {
  // World assembly hasn't landed yet — use fallback
  worldAvailable = false;
}

if (worldAvailable) {
  // Full world: create GameWorld, use world graph, room transitions, etc.
} else {
  // Fallback: load tutorial-corridor as a single room
  // Create player, tilemap, basic update/render loop
  // This ensures /play works even before world assembly lands
}
```

**IMPORTANT: Don't use dynamic imports.** Instead, check if the world modules exist at build time. The simpler approach: always import the preset rooms that already exist (`presetRooms.ts` has `TUTORIAL_CORRIDOR`, `VERTICAL_SHAFT`, `VINE_GARDEN`). Use `RoomManager` to load and manage room transitions between these. This works now, no dependency on the world assembly task.

**Actual approach for room setup:**
```typescript
import { TUTORIAL_CORRIDOR, VERTICAL_SHAFT, VINE_GARDEN } from "@/engine/world/presetRooms";
import { RoomManager } from "@/engine/world/RoomManager";

// Create a rooms map from what exists
const rooms = new Map<string, RoomData>();
rooms.set("tutorial-corridor", TUTORIAL_CORRIDOR);
rooms.set("vertical-shaft", VERTICAL_SHAFT);
rooms.set("vine-garden", VINE_GARDEN);

// Initialize RoomManager with starting room from session
const roomManager = new RoomManager(rooms);
roomManager.loadRoom(session.getStartingRoomId());
```

**Pause menu:**
The pause menu in the game page has more options than the test page HUD:
- **Resume** — Unpause
- **Save Game** — Save current state to the session's slot, show brief "Saved!" confirmation
- **Save & Quit** — Save then navigate to `/`
- **Quit without Saving** — Confirm dialog, then navigate to `/`

If `GameHUD` exists, delegate pause rendering to it. Otherwise, render a simple pause overlay directly in the render callback.

**Auto-save:** Trigger a save on every room transition (after the new room loads). This uses the GameSession's `createSaveSnapshot()` method.

**Save implementation:**
```typescript
// In the play page:
const saveGame = useCallback(async () => {
  const snapshot = sessionRef.current.createSaveSnapshot();
  // If Convex is connected, use mutation
  // If not, use in-memory mock (same as save-load test page)
  // Show brief "Saved!" notification
}, []);
```

### 6. useSaveSlots Hook — `src/hooks/useSaveSlots.ts`

A reusable hook that provides save slot data with Convex/mock fallback. Extracted from the pattern in the save-load test page.

```typescript
export interface UseSaveSlotsResult {
  slots: SaveSlotSummary[];
  isConnected: boolean;  // Whether Convex is connected
  isLoading: boolean;
  save: (slot: number, data: GameSaveData) => Promise<void>;
  load: (slot: number) => Promise<LoadedGameState | null>;
  deleteSave: (slot: number) => Promise<void>;
  getMostRecentSlot: () => SaveSlotSummary | null;
}

export function useSaveSlots(): UseSaveSlotsResult;
```

**Implementation:**
- Try to use Convex queries/mutations
- If Convex provider is not available (no env var), fall back to an in-memory mock store backed by localStorage
- `getMostRecentSlot()` returns the non-empty slot with the most recent `lastSaved` timestamp (for the "Continue" button)

### 7. localStorage Mock for Development

Since Convex may not be deployed, the mock save system should persist to localStorage so saves survive page refresh during development.

```typescript
// In useSaveSlots.ts mock path:
const STORAGE_KEY = "inkbinders-saves";

function loadMockSlots(): SaveSlotSummary[] {
  if (typeof window === "undefined") return [1, 2, 3].map(s => SaveSystem.emptySummary(s));
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [1, 2, 3].map(s => SaveSystem.emptySummary(s));
  return JSON.parse(stored);
}

function saveMockSlots(slots: SaveSlotSummary[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
}
```

## Files to Create

1. **`src/engine/core/GameSession.ts`** — Game session orchestrator class
2. **`src/components/SaveSlotSelect.tsx`** — Save slot selection modal component
3. **`src/components/NameEntry.tsx`** — Name entry dialog component
4. **`src/hooks/useSaveSlots.ts`** — Save slots hook with Convex/localStorage fallback
5. **`src/app/play/page.tsx`** — Main game page (runs the engine)

## Files to Modify

6. **`src/app/page.tsx`** — Replace landing page with title screen + menu
7. **`src/lib/testStatus.ts`** — Add entry for the play page route (not a test page, but note its existence in the integration section)
8. **`AGENTS.md`** — Add GameSession, main menu flow, useSaveSlots documentation

## Specific Values & Constants

| Constant | Value | Notes |
|----------|-------|-------|
| Save slots | 3 | Slots 1, 2, 3 |
| Max player name length | 20 | Characters |
| Default player name | "Archivist" | Pre-filled in name entry |
| Starting room (new game) | "tutorial-corridor" | First room ID |
| Starting health (new game) | 5 / 5 | current / max |
| Auto-save trigger | Room transition | After new room loads |
| Pause menu items | 4 | Resume, Save, Save & Quit, Quit |
| Title animation particle count | 50 | Ink drops in background |
| Title animation particle speed | -15 to -30 px/s | Upward drift |
| Title animation particle size | 2-6 px | Radius |
| Title animation particle alpha | 0.1-0.3 | Very subtle |
| Continue button threshold | ≥1 non-empty slot | Show only when saves exist |
| Loading screen min duration | 500ms | Prevent flash of loading state |
| Save notification duration | 90 frames | "Saved!" text display time |
| localStorage key | "inkbinders-saves" | For mock save persistence |
| localStorage progression key | "inkbinders-progression" | For loaded state mock |

## Implementation Notes

1. **The title screen is a React page, not a canvas game page.** It uses a small decorative canvas for the ink wash effect, but the menu itself is React/Tailwind. This keeps it fast and accessible. The game canvas only exists on `/play`.

2. **`useSaveSlots` abstracts away Convex vs localStorage.** The title screen and game page don't need to know which backend they're talking to. The hook handles the abstraction. When Convex IS connected, it uses `useQuery(api.saves.listSaveSlots)` and mutations. When not connected, it uses localStorage.

3. **`GameSession` is pure TypeScript.** No React hooks, no Convex imports. It's an engine-level class that holds game state. The React layer (`/play` page) creates it and calls its methods. The React layer handles persistence (calling Convex mutations or localStorage writes) using data from `GameSession.createSaveSnapshot()`.

4. **The `/play` route reads the slot number from URL search params.** Navigation: `router.push("/play?slot=2")`. The page reads `searchParams.get("slot")`, loads the save data, creates a `GameSession`, and starts the game. If no slot is specified, redirect to `/`.

5. **Keyboard navigation on the title screen.** The menu supports both mouse and keyboard. Track the selected index in state. Arrow keys change selection, Enter confirms. This feels appropriate for a game — players expect keyboard navigation.

6. **The "Continue" button loads the most recent save directly.** No slot selection — it finds the slot with the latest `lastSaved` timestamp and loads it. This is a convenience for players who only use one save slot (the common case).

7. **Don't break the test pages.** The `/test` route and all test pages must continue to work exactly as before. This task only modifies `/` (landing page) and adds `/play`. No engine code is modified except adding `GameSession.ts`.

8. **Pause menu in `/play` is canvas-rendered.** If `GameHUD` exists (from the HUD task), use its `renderPauseMenu()` method. If not, render a simple dark overlay + centered text directly on the canvas context. The pause menu has 4 options, navigated with arrow keys + Enter.

9. **Loading screen.** When `/play` loads, show a simple "Loading..." message with a subtle animation (pulsing text or ink drops). Don't show the canvas until all systems are initialized. Use a React state flag: `isReady`. Set it to true after engine initialization is complete. Minimum 500ms display to prevent flash.

10. **Route protection.** If someone navigates directly to `/play` without a slot parameter, redirect to `/`. If the specified slot is empty (no save data and not a new game), redirect to `/`.

11. **The Convex `useMutation` hook requires being inside `ConvexProvider`.** The layout.tsx already wraps with `ConvexClientProvider` which is safe (passes through if no Convex URL). The `useSaveSlots` hook should check if the Convex client is available before using `useQuery`/`useMutation`. Use `useConvex()` with a try/catch or check for the provider context.

12. **The `"use client"` directive is required** for `/play/page.tsx` (canvas + refs + effects) and for the root `page.tsx` (interactive menu + canvas background).

## Pass Criteria

1. **Title screen renders:** `/` shows the Inkbinders title with animated ink wash background
2. **Ink wash animation:** Background canvas shows drifting ink particles
3. **Menu navigation works:** Arrow keys and mouse can navigate menu options
4. **Continue button conditional:** "Continue" only appears when a non-empty save exists
5. **New Game → slot select:** Selecting "New Game" shows the save slot selection overlay
6. **Slot cards display:** Each slot shows summary info (or "Empty" for unused slots)
7. **Name entry works:** Starting a new game prompts for a player name with a default
8. **New game starts:** After name entry, navigates to `/play?slot=N&new=1`
9. **Load game starts:** Clicking "Load" on a non-empty slot navigates to `/play?slot=N`
10. **Delete with confirmation:** Delete shows confirmation dialog, removes save data
11. **Game page loads:** `/play?slot=1` loads save data and initializes the game engine
12. **Loading screen shows:** Brief loading screen while engine initializes
13. **Game runs:** Player can move around in the loaded room with full controls
14. **Pause menu works:** ESC opens pause overlay with 4 options
15. **Save from pause menu:** "Save Game" creates a snapshot and persists it
16. **Save & quit works:** Saves then navigates back to `/`
17. **Quit without save works:** Confirms then navigates back to `/` without saving
18. **Auto-save on room transition:** Transitioning between rooms auto-saves
19. **Session tracks play time:** Total play time accumulates correctly (loaded + session)
20. **Session tracks progression:** Deaths, visited rooms, opened gates persist in session state
21. **Test pages unaffected:** `/test/*` routes all work exactly as before
22. **localStorage fallback:** Save system works without Convex (uses localStorage)
23. **TypeScript strict:** `npx tsc --noEmit` passes with zero errors

## Verification

- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` succeeds
- [ ] Navigate to `/` — title screen with animated background and menu
- [ ] Arrow keys navigate menu, Enter selects
- [ ] "New Game" → slot select → name entry → game starts at `/play`
- [ ] "Continue" appears only when saves exist, loads most recent
- [ ] "Test Pages" navigates to `/test`
- [ ] Delete save with confirmation works
- [ ] `/play?slot=1&new=1` starts a new game in slot 1
- [ ] `/play?slot=1` loads existing save and continues
- [ ] Player can move, fight, and use abilities in the game page
- [ ] ESC pauses, menu has 4 options, all work correctly
- [ ] "Save Game" persists to localStorage (or Convex if connected)
- [ ] Returning to title screen shows updated save data
- [ ] Room transitions trigger auto-save
- [ ] Play time accumulates across save/load cycles
- [ ] `/play` without slot param redirects to `/`
- [ ] All `/test/*` pages work unchanged
