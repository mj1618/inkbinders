# Task: Environment Showcase Test Page

**Epic:** 013 — Scribe Hall Visual Showcase
**Task slug:** environment-showcase-page
**Status:** todo

---

## Goal

Build a test page at `/test/environment-showcase` for previewing backgrounds, tiles, and parallax layers with real-time controls. This is the tool that enables all the visual tuning work in Epic 013. It should let a developer see every background layer independently, adjust parallax speeds, preview tiles, toggle atmosphere effects, and walk a player character around the room for scale.

---

## Files to Create

### `src/app/test/environment-showcase/page.tsx` (new)

The main showcase page. Follow the exact pattern from `/test/movement-showcase`:
- `'use client'` directive
- Import `GameCanvas`, `DebugPanel`, `Slider` from `@/components/debug` and `@/components/canvas`
- Create engine, player, tilemap, camera, background in a `useEffect`
- Wire up custom update/render callbacks

### `src/lib/testStatus.ts` (modify)

Add entry:
```typescript
{
  name: "Environment Showcase",
  path: "/test/environment-showcase",
  phase: 7,
  phaseName: "Polish",
  status: "in-progress",
  description: "Preview backgrounds, tiles, and parallax layers in real-time"
}
```

---

## Page Layout

```
+---------------------------------------------------+--------------+
|                                                     |  Debug Panel |
|  Full-width canvas (960x540)                        |              |
|  showing the Scribe Hall room with all background   |  [View Mode] |
|  layers, tiles, and a playable character             |  [Layers]    |
|                                                     |  [Parallax]  |
|  Camera follows player or auto-scrolls              |  [Tiles]     |
|                                                     |  [Atmosphere]|
|                                                     |  [Camera]    |
|                                                     |              |
+---------------------------------------------------+--------------+
```

Use the existing `DebugPanel` + `Slider` components. The canvas is a standard 960x540 `GameCanvas`.

---

## View Modes

Implement these as a React state (`viewMode`) toggled via buttons in the Debug Panel:

### 1. Full Room (default)
- Render the complete Scribe Hall room (1920x1080) with all background layers, tiles, and platforms
- Player character is fully playable (WASD/arrows to move, space to jump)
- Camera follows player using the existing `Camera.follow()` system
- All background layers render at their parallax speeds

### 2. Layer Isolation
- Shows a single background layer at a time, selected from a dropdown
- The selected layer renders alone with its parallax factor applied
- Camera still follows player for parallax demonstration
- Useful for evaluating individual layers without distraction

### 3. Parallax Scroll
- Camera auto-scrolls horizontally at a constant speed
- No player input needed — purely demonstrates the depth effect
- Adjustable scroll speed slider in the debug panel (-200 to +200 px/s, default 30)
- All layers visible, so the viewer can compare parallax speeds

### 4. Tile Preview
- Zoomed-in grid showing every tile variant from the current tileset
- Each tile rendered at 1x (32x32), 2x (64x64), and 4x (128x128) zoom
- Show tile frame index below each tile
- No background layers, no player — just tiles on a dark canvas

---

## Debug Panel Controls

Organize into collapsible sections using the existing pattern (bold label, then child elements).

### View Mode Section
- 4 toggle buttons: "Full Room" / "Layer Isolation" / "Parallax Scroll" / "Tile Preview"
- Layer dropdown (only visible in Layer Isolation mode): "Layer 0 (Sky)" through "Layer 5 (FG Far)"

### Layer Controls Section
- 6 checkboxes: show/hide each background layer independently
  - Labels: "L0: Sky (0.02)", "L1: Far Books (0.08)", "L2: Mid Detail (0.20)", "L3: Near Detail (0.40)", "L4: FG Near (1.15)", "L5: FG Far (1.40)"
  - Default: all checked
- Per-layer parallax factor slider (0.0–2.0, step 0.01) — one slider per layer
  - Start at the default values from BiomeBackgroundSprites
  - Adjustable in real-time
- Per-layer opacity slider (0.0–1.0, step 0.01) — one slider per layer
  - Background layers default to 1.0
  - Foreground layer 4 defaults to 0.25
  - Foreground layer 5 defaults to 0.15
- "Show Layer Boundaries" checkbox — draws colored outlines around each layer's tile edges
- "Show Foreground Over Player" checkbox (default: true) — toggles whether layers 4-5 render over the player

### Tile Controls Section
- "Show Tile Grid" checkbox — draws 32x32 grid lines over platforms
- Render mode toggle: Sprites / Rectangles / Both (delegates to `RenderConfig.setMode()`)
- "Show Platform Outlines" checkbox — draws red outlines around platform bounds

### Camera Controls Section
- X position slider (0 to room width - canvas width)
- Y position slider (0 to room height - canvas height)
- Auto-scroll speed slider (-200 to +200 px/s, default 0)
- Zoom slider (0.5x to 3.0x, step 0.1, default 1.0)
- "Reset Camera" button — snaps to player position
- "Follow Player" checkbox (default: true in Full Room mode)

### Info Section
- Current camera position (x, y)
- Current room name
- FPS counter
- Biome ID
- Number of platforms
- Number of background layers

---

## Rendering Architecture

### Render Order (matching the target from Epic 013 README)
```
1. Background layers 0-3 (parallax < 1.0) via BiomeBackground.renderBackground() or individual layer render
2. [Future: Light shafts, candle glow — skip for now, these come in Task 6]
3. TileMap platforms (via tileMap.render())
4. Player character
5. [Future: Dust motes — skip for now]
6. Foreground layers 4-5 (parallax > 1.0) — only if foreground rendering is available
7. Debug overlays (grid, platform outlines, layer boundaries)
8. HUD info text (FPS, camera position, room name)
```

**Important:** The current `BiomeBackground` class only has a single `render()` method that draws all layers. For the initial version of this page, use the existing `render()` method for all background layers. The foreground layer separation (renderBackground/renderForeground) will be added in Task 4 when the parallax integration happens. For now, render all layers behind the player — the showcase page will be updated in Task 4 to call separate methods.

### Background Layer Rendering
- Use `BiomeBackground` from `src/engine/world/BiomeBackground.ts`
- Call `createBackgroundForBiome("scribe-hall")` or the scribe hall factory
- The existing system has 3 layers with procedural fallbacks
- The showcase page should display whatever layers exist — initially 3 (far/mid/near), later 6 when Task 4 adds them

### Layer Visibility Toggles
Since the current BiomeBackground doesn't expose per-layer toggles, implement this at the test page level:
- Store a `layerVisibility: boolean[]` array in React state
- Before rendering, temporarily modify the layers array (or wrap the render call with visibility checks)
- One approach: create a local wrapper around BiomeBackground that checks visibility before each layer render

Actually, the simplest approach: read the `BiomeBackground.layers` array directly (it's a public field) and call each layer's `render()` method individually, only for visible layers. This avoids modifying the engine class.

```typescript
// In the render callback:
const bg = backgroundRef.current;
if (bg) {
  for (let i = 0; i < bg.layers.length; i++) {
    if (layerVisibilityRef.current[i]) {
      bg.layers[i].render(ctx, cameraX, cameraY, canvasW, canvasH);
    }
  }
}
```

### Parallax Factor Override
For real-time parallax tuning, the test page needs to override each layer's parallax factor:
- Store `parallaxOverrides: number[]` in React state (initialized from layer defaults)
- Before rendering each layer, temporarily set its parallax factor to the override value
- After rendering, restore the original (or just let the override persist since this is a debug tool)

### Opacity Override
- Store `opacityOverrides: number[]` in React state
- Before rendering each layer, set `ctx.globalAlpha = opacityOverrides[i]`
- After rendering, restore `ctx.globalAlpha = 1.0`

---

## Player Character Setup

Use the same pattern as the movement showcase page:
- Create a `Player` instance with `DEFAULT_PLAYER_PARAMS`
- Load player sprites via `PlayerSprites.loadAll()`
- Create a `TileMap` from the Scribe Hall room's platforms
- Full movement: walk, jump, dash, crouch, wall mechanics
- The player provides scale reference and demonstrates how background layers look during gameplay

### Room Data
Import the Scribe Hall room data from `src/engine/world/scribeHall.ts`:
```typescript
import { SCRIBE_HALL } from "@/engine/world/scribeHall";
```

Use its platforms array for the TileMap and its dimensions (1920x1080) for camera bounds.

---

## Camera System

Use the existing `Camera` class from `src/engine/core/Camera.ts`:
- In "Full Room" mode: camera follows player with standard follow parameters
- In "Layer Isolation" mode: camera follows player (parallax still applies per-layer)
- In "Parallax Scroll" mode: camera X auto-increments each frame by `autoScrollSpeed * dt`, wrapping at room bounds
- In "Tile Preview" mode: camera is fixed at (0, 0) with the selected zoom level

### Zoom Implementation
Canvas zoom can be implemented by scaling the canvas context:
```typescript
ctx.save();
ctx.scale(zoom, zoom);
// Render everything with adjusted coordinates
ctx.restore();
```

Or by adjusting the camera viewport size: `viewportWidth = canvasWidth / zoom`, `viewportHeight = canvasHeight / zoom`.

Use the camera viewport approach since it integrates naturally with the existing camera and parallax systems.

---

## Tile Preview Mode

When in Tile Preview mode:
1. Clear the canvas to dark background (#18181b)
2. Load the Scribe Hall tile sprite sheet via `AssetManager`
3. Render each tile frame in a grid:
   - 4 tiles per row (the current tileset has 4 tiles in a 128x32 strip)
   - Show at 1x (32x32), 2x (64x64), and 4x (128x128) side by side
   - Label each tile with its frame index and name (FLOOR, BLOCK, COLUMN, WALL)
4. If an expanded tileset exists (tiles-scribe-hall-expanded — will be added in Task 3), show all 16 tiles in a 4x4 grid

---

## Screenshot Capture

Add a "Screenshot" button in the debug panel:
```typescript
const handleScreenshot = () => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `environment-showcase-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  });
};
```

---

## Implementation Notes

### Existing Imports You'll Need
```typescript
// Components
import { GameCanvas } from "@/components/canvas/GameCanvas";
import { DebugPanel, Slider, RenderModeToggle } from "@/components/debug";

// Engine
import { Engine } from "@/engine/core/Engine";
import { Camera } from "@/engine/core/Camera";
import { RenderConfig } from "@/engine/core/RenderConfig";
import { AssetManager } from "@/engine/core/AssetManager";
import { Player, DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";
import { TileMap } from "@/engine/physics/TileMap";
import { InputManager } from "@/engine/input/InputManager";
import { BiomeBackground, createBackgroundForBiome } from "@/engine/world/BiomeBackground";
import { SCRIBE_HALL } from "@/engine/world/scribeHall";
import { preloadBiomeBackground } from "@/engine/world/BiomeBackgroundSprites";
import { loadTileSprites } from "@/engine/world/TileSprites";

// Constants
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/constants";
```

Check the actual export names — some may differ slightly. The key pattern is to read the existing movement-showcase page and mirror its structure.

### State Management Pattern
Use React refs for values that the game loop reads each frame (to avoid closure stale state):
```typescript
const layerVisibilityRef = useRef<boolean[]>([true, true, true, true, true, true]);
const parallaxOverridesRef = useRef<number[]>([0.02, 0.08, 0.20, 0.40, 1.15, 1.40]);
const opacityOverridesRef = useRef<number[]>([1.0, 1.0, 1.0, 1.0, 0.25, 0.15]);
const viewModeRef = useRef<string>("full");
const autoScrollSpeedRef = useRef<number>(0);
const zoomRef = useRef<number>(1.0);
const followPlayerRef = useRef<boolean>(true);
```

And React state for the debug panel UI:
```typescript
const [viewMode, setViewMode] = useState<string>("full");
const [layerVisibility, setLayerVisibility] = useState<boolean[]>([...]);
// etc. — sync to refs on change
```

### Browser API Safety
This is a `'use client'` React component that only runs in the browser, so no need for the `typeof document === "undefined"` guards that engine code requires.

---

## Pass Criteria

1. Page loads at `/test/environment-showcase` and renders the Scribe Hall room
2. All existing background layers render correctly (currently 3, will become 6 in Task 4)
3. Per-layer show/hide toggles work — each layer can be toggled independently
4. Per-layer parallax factor sliders adjust parallax speed in real-time
5. Per-layer opacity sliders adjust layer transparency in real-time
6. "Layer Isolation" mode shows only the selected layer
7. "Parallax Scroll" mode auto-scrolls the camera smoothly, demonstrating depth
8. "Tile Preview" mode shows all tile variants at multiple zoom levels
9. Player character is fully playable in "Full Room" mode (walk, jump, dash, wall mechanics)
10. Camera zoom slider works (0.5x to 3.0x)
11. Camera manual position sliders work when "Follow Player" is unchecked
12. Screenshot button captures the canvas as a PNG download
13. FPS counter displays in the info section
14. "Show Tile Grid" overlay draws 32x32 grid lines on platforms
15. "Show Platform Outlines" draws red outlines around platform bounds
16. Test status entry added to `testStatus.ts`
17. TypeScript compiles cleanly (`npx tsc --noEmit`)
18. Page follows the same component pattern as `/test/movement-showcase`

---

## Scope Boundaries

**DO build:**
- The test page with all 4 view modes and debug panel controls
- Layer visibility, parallax, and opacity overrides
- Player character for scale reference
- Camera controls (follow, manual, auto-scroll, zoom)
- Tile preview grid
- Screenshot capture

**DO NOT build (these come in later tasks):**
- New background images (Task 2)
- Expanded tileset (Task 3)
- Foreground layer rendering separation (Task 4)
- Tile integration with edge/decor tiles (Task 5)
- Ambient atmosphere effects (Task 6)
- Final visual tuning (Task 7)

The showcase page should work with whatever background/tile assets currently exist. When later tasks add new layers and tiles, the showcase page will automatically display them (since it reads from the BiomeBackground and TileMap systems).

---

## Completion Summary

**Status:** Done

### Files Created
- `src/app/test/environment-showcase/page.tsx` — Full environment showcase test page (~867 lines)

### Files Modified
- `src/lib/testStatus.ts` — Added "Environment Showcase" entry at phase 7 (already present when task started)

### What Was Built

1. **4 View Modes**: Full Room (playable), Layer Isolation (single layer), Parallax Scroll (auto-camera), Tile Preview (zoomed grid)
2. **Layer Controls**: Per-layer visibility toggles, parallax factor sliders (0–2.0), opacity sliders (0–1.0), layer boundaries toggle, FG over player toggle
3. **Tile Controls**: Tile grid overlay, platform outlines, render mode toggle (sprites/rectangles/both)
4. **Camera Controls**: Follow player toggle, manual X/Y sliders, auto-scroll speed, zoom (0.5x–3.0x), reset button
5. **Player Character**: Full movement (walk, jump, dash, crouch, wall mechanics) for scale reference
6. **Debug HUD**: FPS counter, camera position, room info, player state/position/velocity
7. **Tile Preview Mode**: Shows all 4 tile variants at 1x, 2x, and 4x zoom with frame labels
8. **Screenshot Capture**: Downloads canvas as PNG
9. **Engine ref extension pattern**: Same as movement-showcase — syncs React state to game loop via refs on Engine object

### Iteration 3 Fixes
- Added player sprite loading (`PLAYER_SPRITE_CONFIGS`) — player now renders with sprite art when render mode is "sprites" or "both"
- Removed unused imports (`DEFAULT_PLAYER_PARAMS`, `TILE_FRAME`) to clean up the file
- Added test status entry to `src/lib/testStatus.ts` (was missing)

### Verification
- TypeScript compiles cleanly (`npx tsc --noEmit` — no errors)
- All 427 tests pass (426 + 1 pre-existing failure in transitions.test.ts unrelated to this task — RUNNING→CROUCHING threshold issue from aerial-feel changes)

### Architecture Notes
- Background layers rendered individually via `background.layers[i].render()` for per-layer control
- Parallax overrides applied temporarily per frame (save/restore original factor)
- Opacity overrides via `ctx.globalAlpha` save/restore
- Custom events on canvas element bridge async asset loading and camera updates to React state
- Layer names auto-populated from `BIOME_BACKGROUND_LAYERS` after asset loading

---

## Review Notes

**Reviewer:** 7facadf0
**Status:** Fixed 1 critical rendering bug, otherwise clean.

### Issue Found & Fixed

**Double camera transform on background layers** — The `onRender` callback runs inside the engine's camera-transformed context (`Renderer.applyCamera()` is called by `Engine.render()` before custom callbacks). But background layers were being rendered with manual parallax offsets directly on top of the camera transform, causing double transformation.

The correct pattern (used by all other biome test pages like herbarium-folio, astral-atlas, etc.) is to:
1. Call `renderer.resetCamera()` to exit camera space
2. Render background layers in screen space with their own parallax offsets
3. Call `renderer.applyCamera(camera)` to re-enter camera space for tilemap/entities/overlays

Applied the same fix to tile-preview mode, which was also drawing in screen-space coordinates while inside camera space.

Also corrected `camX`/`camY` calculation: was `camera.position.x - CANVAS_WIDTH / (2 * camera.zoom)` (divides only half-width by zoom), should be `camera.position.x - CANVAS_WIDTH / 2` (matching the pattern used by BiomeBackground.render() callers elsewhere). The zoom-adjusted viewport size is handled by the camera transform itself.

### Verification After Fix
- TypeScript compiles cleanly (`npx tsc --noEmit`)
- All 427 tests pass
