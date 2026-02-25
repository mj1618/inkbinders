# Task: Movement Showcase Test Page

Build a dedicated test page at `/test/movement-showcase` that serves as the primary tool for inspecting, tuning, and perfecting every aspect of the player character's movement and animations. This is the foundation tool that all subsequent tasks in this epic depend on.

## Files to Create/Modify

- **Create** `src/app/test/movement-showcase/page.tsx` — the showcase page
- **Modify** `src/lib/testStatus.ts` — add test page entry

## Page Layout

The page follows the standard test page pattern: `'use client'` directive, `GameCanvas` + `DebugPanel` layout. The canvas is split into two zones: a Pose Gallery (top half) and a Live Playground (bottom half), with a debug panel sidebar for controls.

```
┌───────────────────────────────────────────────┬──────────────┐
│                                               │  Debug Panel │
│  ┌──────────────────────────────────────┐     │              │
│  │       POSE GALLERY (top half)        │     │  [Mode]      │
│  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ │     │  [Time]      │
│  │  │IDLE│ │ RUN│ │JUMP│ │FALL│ │DASH│ │     │  [Render]    │
│  │  └────┘ └────┘ └────┘ └────┘ └────┘ │     │  [Squash]    │
│  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ │     │  [Animation] │
│  │  │WALL│ │WJMP│ │CRCH│ │SLID│ │LAND│ │     │  [Particles] │
│  │  └────┘ └────┘ └────┘ └────┘ └────┘ │     │  [Params]    │
│  └──────────────────────────────────────┘     │              │
│  ┌──────────────────────────────────────┐     │              │
│  │      LIVE PLAYGROUND (bottom)        │     │              │
│  │   [Playable character on terrain]    │     │              │
│  └──────────────────────────────────────┘     │              │
└───────────────────────────────────────────────┴──────────────┘
```

## Pose Gallery (Top Half of Canvas, y: 0–270)

Render all 10 player states in a 5×2 grid of "state cells" at 2× zoom (128×128 display per cell).

**State cells (row 1):** IDLE, RUNNING, JUMPING, FALLING, DASHING
**State cells (row 2):** WALL_SLIDING, WALL_JUMPING, CROUCHING, CROUCH_SLIDING, HARD_LANDING

Each cell renders:
- The state's animation playing at its natural FPS, looped
- State name label below the sprite (white text, 10px font)
- Current frame number in top-right corner (e.g., "2/4")
- A subtle border (1px, semi-transparent white)
- The currently selected cell gets a highlighted border (cyan, 2px)

**How to render each cell:**
- Use `AssetManager.getSpriteSheet(mapping.sheetId)` to get the sprite sheet
- Create a per-cell `AnimationController` (10 total, one per state)
- Each controller plays the corresponding animation from `STATE_TO_ANIMATION` at its defined FPS
- Update all controllers each frame with `dt * timeScale`
- Draw using `spriteSheet.drawFrame(ctx, frameIndex, cellX + 32, cellY + 32, false, 2, 2)` for 2× zoom
- Apply `RenderConfig` mode — show sprites, rectangles, or both

**Cell interaction:**
- Track mouse position on canvas. When the user clicks a cell, mark it as "selected"
- Selected cell gets a cyan border glow
- When a cell is selected, render an **Animation Strip** below the gallery grid (y: 220–270):
  - All frames of that state's animation laid out horizontally at 3× zoom (192×192 per frame)
  - Current frame highlighted with a cyan outline
  - Frame index number below each frame
  - If the strip is wider than the canvas, center it and clip

## Frame Stepper

When the gallery is active and a cell is selected:
- **Space** pauses/resumes time (toggle `paused` state)
- When paused, **Left/Right arrow** keys step backward/forward through frames of the selected animation
- Frame counter in the debug panel shows `Frame 2/4` (current/total)
- Arrow keys only step gallery frames, NOT playground input

## Live Playground (Bottom Half of Canvas, y: 270–540)

A miniature playable level using the standard `Player`, `TileMap`, `InputManager` setup.

**Playground camera:** Use a `Camera` instance with bounds set to the playground area. Offset the camera's viewport so it renders into the bottom half of the canvas (y: 270–540). Use `ctx.save()` + `ctx.rect(0, 270, 960, 270)` + `ctx.clip()` to clip rendering.

**Test terrain layout (960×540 world space, rendered in the 960×270 viewport):**
```
        ┌──────┐
        │ high │
        │plat. │          ┌─────┐
   ┌────┘      └────┐     │     │
   │  mid platform   │     │wall │
   └────┐      ┌────┘     │     │
        │      │   gap     │     │
════════╧══════╧═══   ════╧═════╧════
        floor               floor
```

Specific platforms (using T=32):
```typescript
const PLAYGROUND_PLATFORMS = [
  // Main floor left
  { x: 0, y: 420, width: 360, height: 32 },
  // Main floor right (after gap)
  { x: 440, y: 420, width: 520, height: 32 },
  // Mid platform
  { x: 160, y: 320, width: 200, height: 32 },
  // High platform
  { x: 220, y: 220, width: 120, height: 32 },
  // Right wall
  { x: 700, y: 180, width: 32, height: 240 },
  // Left wall
  { x: 0, y: 180, width: 32, height: 240 },
  // Ceiling section (for crouch testing)
  { x: 500, y: 360, width: 120, height: 32 },
];
```

The playground player uses the real `Player` class with `DEFAULT_PLAYER_PARAMS` (modified by slider refs). Standard input handling for movement — but only when the playground area is "active" (mouse is in the bottom half, or always active in Playground-only mode).

**Playground HUD overlay:**
Render in the bottom-right of the playground area:
- Current state name (e.g., "RUNNING")
- Velocity: `vx: 320  vy: -180`
- Squash-stretch scale: `sx: 1.2  sy: 0.8`
- Grounded: yes/no

## Debug Panel Sections

Use the standard `DebugPanel` + `Slider` pattern. Sections (use collapsible sections):

### 1. View Mode
- Three buttons: **Gallery** / **Playground** / **Split** (default: Split)
- Gallery mode: gallery takes full canvas height
- Playground mode: playground takes full canvas height
- Split mode: gallery top half, playground bottom half

### 2. Time Control
- **Time Scale** slider: 0.1 to 2.0, step 0.1, default 1.0
- **Pause** button (toggles, shows "Resume" when paused)
- **Step Frame** button (advances one frame when paused)
- Time scale affects `dt` passed to both gallery animation controllers and playground player

### 3. Render
- **Render Mode** toggle: Sprites / Rectangles / Both (uses `RenderConfig.setMode()`)
- **Show Hitbox** checkbox (default: true)
- **Show Velocity Vector** checkbox (default: true)

### 4. Squash-Stretch
- **Enabled** toggle (maps to `params.squashStretchEnabled`)
- Then expose all existing squash-stretch params as sliders:
  - `jumpLaunchScaleX` (0.5–1.0, step 0.01, default 0.7)
  - `jumpLaunchScaleY` (1.0–1.5, step 0.01, default 1.4)
  - `softLandScaleX` (1.0–1.5, step 0.01, default 1.4)
  - `softLandScaleY` (0.5–1.0, step 0.01, default 0.6)
  - `hardLandScaleX` (1.0–2.0, step 0.01, default 1.6)
  - `hardLandScaleY` (0.3–1.0, step 0.01, default 0.5)
  - `dashStartScaleX` (1.0–2.0, step 0.01, default 1.5)
  - `dashStartScaleY` (0.5–1.0, step 0.01, default 0.7)
  - `dashEndScaleX` (0.5–1.0, step 0.01, default 0.8)
  - `dashEndScaleY` (1.0–1.5, step 0.01, default 1.2)
  - `wallSlideEntryScaleX` (0.5–1.0, step 0.01, default 0.8)
  - `wallSlideEntryScaleY` (1.0–1.5, step 0.01, default 1.15)
  - `wallJumpScaleX` (0.5–1.0, step 0.01, default 0.75)
  - `wallJumpScaleY` (1.0–1.5, step 0.01, default 1.35)
  - `turnScaleX` (0.5–1.0, step 0.01, default 0.85)
  - `scaleReturnSpeed` (1–30, step 0.5, default 12)

### 5. State Trigger Buttons
A row of buttons that force the playground player into specific states for gallery-free testing:
- "Force Idle", "Force Run", "Force Jump", etc.
- These call `player.forceState(stateName)` — which may need to be added as a debug method on Player if it doesn't exist. If so, add a simple `forceState(state: string)` that calls `this.stateMachine.transitionTo(state)`.

### 6. Animation Info
- **Current animation**: display name (e.g., "run")
- **Sheet**: display sheet ID (e.g., "player-run")
- **Frame**: current frame index / total frames
- **FPS**: current animation FPS
- **FPS Override** slider (1–30, step 1) — allows overriding the animation FPS for testing

### 7. Physics Params
Expose key movement params as sliders (same pattern as other test pages):
- `maxRunSpeed` (100–600, step 10, default from `DEFAULT_PLAYER_PARAMS`)
- `acceleration` (500–3000, step 50)
- `deceleration` (500–3000, step 50)
- `jumpSpeed` (200–600, step 10)
- `riseGravity` (500–2000, step 50)
- `fallGravity` (500–2000, step 50)
- `dashSpeed` (200–800, step 10)

## Implementation Notes

**Loading sprites:** On mount, use `AssetManager.getInstance().loadAll(PLAYER_SPRITE_CONFIGS)` to load all player sprite sheets. Create `AnimationController` instances for each gallery cell after sheets are loaded.

**Gallery AnimationControllers:** Create 10 `AnimationController` instances (one per state), each referencing the correct `SpriteSheet` from `AssetManager`. Each controller plays the state's mapped animation continuously. Update them each frame with the gallery's scaled `dt`.

**Input partitioning:** The gallery uses Space and arrow keys for frame stepping. The playground uses WASD/arrow keys for movement. To avoid conflicts:
- When paused, arrow keys control gallery frame stepping (not player)
- When unpaused, arrow keys control the playground player normally
- Space always toggles pause (never used by the player; Jump is bound to another key in `InputManager`)

Actually, check the input bindings — Jump is likely `w` or `space`. If Jump is `space`, then:
- Add a separate keyboard listener for Space (pause toggle) that runs BEFORE the InputManager snapshot
- Or: only use Space for pause in gallery mode; use a debug panel button for playground pause
- Simplest approach: Space pauses time. When paused, the player's InputManager doesn't receive updates, so Jump (space) doesn't fire. This naturally works.

**Canvas coordinate system:**
- Gallery renders in canvas space (0,0)–(960,270) when in Split mode
- Playground renders offset by 270px (or use camera offset)
- Use `ctx.save()`/`ctx.restore()` with clip regions to isolate the two zones

**Player `forceState()` method:** Add to `Player.ts`:
```typescript
forceState(state: string): void {
  this.stateMachine.transitionTo(state);
}
```
This is a debug-only method. The existing `StateMachine.transitionTo()` handles entering the new state.

## Test Status Entry

Add to `TEST_PAGES` in `testStatus.ts`:
```typescript
{ name: "Movement Showcase", path: "/test/movement-showcase", phase: 7, phaseName: "Polish", status: "in-progress", description: "Animation inspector, frame stepper, and movement tuning" },
```

## Pass Criteria

1. All 10 player states render correctly in the pose gallery with animation playback
2. Clicking a gallery cell selects it and shows the full animation strip at 3× zoom
3. Frame stepper works: Space pauses, Left/Right step through frames when paused
4. Time scale slider (0.1–2.0) smoothly adjusts animation and gameplay speed
5. Live playground is fully playable with all movement states
6. Render mode toggle (Sprites/Rectangles/Both) works in both gallery and playground
7. Squash-stretch sliders update player deformation in real-time
8. View mode switching (Gallery/Playground/Split) works correctly
9. State trigger buttons force the playground player into specific states
10. Playground HUD shows real-time state, velocity, and scale values
11. TypeScript compiles cleanly (`npx tsc --noEmit`)

---

## Implementation Summary

### Files Created
- `src/app/test/movement-showcase/page.tsx` — Full movement showcase test page (~560 lines)

### Files Modified
- `src/engine/entities/Player.ts` — Added `forceState(state: string)` debug method
- `src/lib/testStatus.ts` — Added Phase 7 "Movement Showcase" entry

### What Was Built
1. **Pose Gallery** — 10 player states displayed in a 5x2 grid at 2x zoom with per-cell AnimationControllers, frame counters, and state labels
2. **Animation Strip** — Click a gallery cell to see all frames of that animation laid out horizontally with current frame highlighted
3. **Frame Stepper** — Space pauses time; Left/Right arrows step through frames of the selected animation when paused
4. **Live Playground** — Miniature playable level with platforms, walls, gaps, and a ceiling section for crouch testing
5. **View Mode Toggle** — Gallery / Playground / Split (default) — each mode reconfigures the canvas layout
6. **Time Scale** — Slider (0.1–2.0) smoothly adjusts animation and gameplay speed
7. **Render Mode** — Sprites / Rectangles / Both toggle works in both gallery and playground
8. **Squash-Stretch Sliders** — All 16 squash-stretch parameters exposed as sliders
9. **State Trigger Buttons** — Force the playground player into any of the 10 states
10. **Animation Info Panel** — Shows current animation name, sheet ID, frame, FPS with FPS override slider
11. **Physics Params** — Key movement params (speed, acceleration, gravity, dash speed, etc.) as sliders
12. **Playground HUD** — Real-time state, velocity, squash-stretch scale, and grounded indicator

### Verification
- TypeScript compiles cleanly (`npx tsc --noEmit` — 0 errors)
- All 427 tests pass (`npm run test:run`)

---

## Review Notes

**Reviewer:** a9077fcf
**Status:** Fixes applied

### Issues Found & Fixed

1. **Duplicate checkbox binding (bug):** Both "Show Hitbox" and "Show Velocity Vector" checkboxes were bound to the same `showOverlays` state — toggling one toggled both. Split into independent `showHitbox` and `showVelocity` state variables with separate refs (`__showHitboxRef`, `__showVelocityRef`), so hitbox and velocity vector overlays can be toggled independently. The render callback now checks each ref separately.

2. **Unused import removed:** `InputAction` was imported but unused in the component (it's used internally by the engine through `InputManager`). Removed the dead import.

3. **Dead-code ternary (cleanup):** `const hudY = mode === "split" ? CANVAS_HEIGHT - 80 : CANVAS_HEIGHT - 80` — both branches produced the same value. Simplified to `const hudY = CANVAS_HEIGHT - 80`.

### Items Reviewed Without Issues

- `Player.forceState()` correctly uses `this.stateMachine.setState(state)` matching the StateMachine API
- All API usages (AnimationController, Engine, Renderer, SpriteSheet, AssetManager) match their implementations
- Gallery cell rendering, frame stepping logic, and animation strip are correct
- Event listener cleanup in `__cleanup` properly removes all 3 canvas listeners and the document keydown listener
- No memory leaks — engine.stop() and cleanup function are called on unmount
- Physics in the playground runs on the engine's fixed timestep (no frame-rate dependency)
- Time scale correctly applied via `dt * timeScaleRef.current`
- testStatus.ts entry is correct

### Post-Fix Verification
- TypeScript compiles cleanly (`npx tsc --noEmit` — 0 errors)
- All 427 tests pass (`npm run test:run`)
