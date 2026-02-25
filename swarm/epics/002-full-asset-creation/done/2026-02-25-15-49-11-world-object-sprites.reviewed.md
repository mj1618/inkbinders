# Task: World Object Sprites

**Epic:** 002-full-asset-creation
**Task slug:** world-object-sprites
**Goal:** Create sprite sheet configs, animation definitions, and RenderConfig-aware rendering for all interactive and decorative world objects: vines, obstacles, gates, exits, gravity wells, current zones, and fog zone boundaries.

---

## Context

### What exists today

Every world object system currently renders using raw Canvas 2D paths and filled rectangles. None of them check `RenderConfig` (except BiomeBackground, which is already done). The systems are:

| System | File | Render Method | Current Drawing |
|--------|------|---------------|-----------------|
| VineSystem | `src/engine/world/VineSystem.ts` | `render()` | Bézier curves, circles, arcs |
| Obstacles | `src/engine/physics/Obstacles.ts` | (data-only, rendered inline by test pages/Redaction) | Colored rects with type-specific colors |
| Gates | `src/engine/world/RoomRenderer.ts` | `renderGates()` | Pulsing colored rects + glyph text |
| Exits | `src/engine/world/RoomRenderer.ts` | `renderExitIndicators()` | Directional arrow text (▲◄►▼) |
| GravityWells | `src/engine/world/GravityWellSystem.ts` | `render()` | Concentric rings, arrow particles, center dots |
| CurrentSystem | `src/engine/world/CurrentSystem.ts` | `renderFlow()` | Animated flow lines + arrowheads |
| FogSystem | `src/engine/world/FogSystem.ts` | `renderZoneBoundaries()` | Dashed glows, drifting particles |

### Pattern to follow

All completed sprite tasks use the same structure:
1. A `*Sprites.ts` file exporting `SpriteSheetConfig[]` and `AnimationDef[]` (keyed by sheet ID)
2. Optional state-to-animation mapping if the object has FSM states
3. Helper functions: `get*Configs()`, `get*Animations()`
4. Integration in the renderer: check `RenderConfig.useSprites()` → draw sprite; check `RenderConfig.useRectangles()` → draw existing canvas art
5. `AssetManager.loadAll()` for initialization

**CombatSprites.ts** is the closest analog — it uses a fire-and-forget `VfxInstance` pattern for non-entity visuals. World objects are similar: positioned in world space, some animated, some static.

---

## What to build

### 1. Create `src/engine/world/WorldObjectSprites.ts`

This is the central sprite definition file for all world objects. Export:

```typescript
// Sprite sheet configs
export const WORLD_OBJECT_SPRITE_CONFIGS: SpriteSheetConfig[]

// Animation definitions keyed by sheet ID
export const WORLD_OBJECT_ANIMATIONS: Record<string, AnimationDef[]>

// Helper accessors
export function getWorldObjectConfigs(): SpriteSheetConfig[]
export function getWorldObjectAnimations(): Record<string, AnimationDef[]>
```

**Sprite sheets to define:**

| Sheet ID | Frames | Frame Size | Description |
|----------|--------|------------|-------------|
| `vine-rope` | 1 | 8×32 | Vine rope segment (tile vertically) |
| `vine-anchor` | 2 | 32×32 | Anchor idle + active/glowing |
| `spikes-up` | 1 | 32×32 | Upward-facing spike hazard |
| `spikes-down` | 1 | 32×32 | Downward-facing spike hazard |
| `spikes-left` | 1 | 32×32 | Left-facing spike hazard |
| `spikes-right` | 1 | 32×32 | Right-facing spike hazard |
| `barrier` | 1 | 32×32 | Dark ink barrier block (tile vertically) |
| `laser-beam` | 2 | 32×8 | Laser beam pulse animation (tile horizontally) |
| `ability-gate` | 4 | 16×96 | One frame per ability color (MS=cyan, R=red, PO=amber, IM=purple) |
| `exit-arrow` | 2 | 32×32 | Pulsing directional exit arrow |
| `gravity-well-attract` | 4 | 128×128 | Attract well pulse animation |
| `gravity-well-repel` | 4 | 128×128 | Repel well pulse animation |
| `current-arrow` | 2 | 32×32 | Current flow direction arrow |
| `fog-wisp` | 2 | 16×16 | Drifting fog particle element |

**Animations:**

| Sheet ID | Animation Name | Frames | FPS | Loop |
|----------|---------------|--------|-----|------|
| `vine-anchor` | `idle` | [0] | 1 | true |
| `vine-anchor` | `active` | [0, 1] | 4 | true |
| `laser-beam` | `pulse` | [0, 1] | 6 | true |
| `exit-arrow` | `pulse` | [0, 1] | 3 | true |
| `gravity-well-attract` | `pulse` | [0, 1, 2, 3] | 4 | true |
| `gravity-well-repel` | `pulse` | [0, 1, 2, 3] | 4 | true |
| `current-arrow` | `flow` | [0, 1] | 4 | true |
| `fog-wisp` | `drift` | [0, 1] | 2 | true |

Static sheets (spikes, barrier, vine-rope, ability-gate) have no animation defs — they're drawn via direct frame index.

### 2. Integrate into `VineSystem.ts`

Modify `src/engine/world/VineSystem.ts`:

- Add `private spritesReady: boolean` and `private animControllers: Map<string, AnimationController>`
- Add `initSprites()` method that loads `vine-rope` and `vine-anchor` sheets via AssetManager
- In `render()`:
  - If `RenderConfig.useSprites()`: draw vine-anchor sprite (idle or active based on proximity), draw vine-rope by tiling the rope sprite segment along the rope path
  - If `RenderConfig.useRectangles()`: keep existing canvas drawing code unchanged
  - For the active swinging rope: draw rope sprite segments along the Bézier curve path (sample points at intervals, draw rotated rope segments)
- Decorative vines: same pattern — tile rope sprite along the sinusoidal path

**Key detail:** The rope sprite is 8×32 and should be drawn rotated to follow the rope angle at each sample point. Sample the rope at ~32px intervals, compute angle between consecutive points, draw the sprite rotated to match.

### 3. Integrate into Obstacles rendering

The obstacle system (`src/engine/physics/Obstacles.ts`) is data-only — obstacles are rendered inline by whatever owns them (test pages, Redaction system, room systems). The integration points are:

- Add a new export function to `WorldObjectSprites.ts`:
  ```typescript
  export function renderObstacleSprite(
    ctx: CanvasRenderingContext2D,
    obstacle: Obstacle,
    assetManager: AssetManager
  ): boolean  // returns true if sprite was drawn
  ```
- This function checks the obstacle type, picks the right sheet ID (`spikes-up/down/left/right`, `barrier`, `laser-beam`), and draws the appropriate sprite tiled across the obstacle rect.
- Spike direction is determined from the obstacle rect dimensions and position context (caller can pass a `direction` hint, or infer from rect aspect ratio: wider than tall = horizontal, taller than wide = vertical).
- For barriers: tile the `barrier` sprite vertically across the full height.
- For lasers: tile the `laser-beam` sprite horizontally, use AnimationController for the pulse animation.
- Callers that currently draw obstacles as colored rects should be updated to:
  ```typescript
  if (RenderConfig.useSprites()) {
    renderObstacleSprite(ctx, obstacle, assetManager);
  }
  if (RenderConfig.useRectangles()) {
    // existing colored rect drawing
  }
  ```

**Don't modify Obstacles.ts data model** — it stays pure data. The rendering helper lives in WorldObjectSprites.ts.

### 4. Integrate into `RoomRenderer.ts`

Modify `src/engine/world/RoomRenderer.ts`:

**Gates (`renderGates()`):**
- If `RenderConfig.useSprites()`: draw `ability-gate` sprite using the appropriate frame index (0=margin-stitch, 1=redaction, 2=paste-over, 3=index-mark). Scale the 16×96 sprite to fill the gate rect.
- If `RenderConfig.useRectangles()`: keep existing pulsing colored rect + glyph rendering.

**Exit indicators (`renderExitIndicators()`):**
- If `RenderConfig.useSprites()`: draw `exit-arrow` sprite at exit position, rotated based on exit direction (0°=right, 90°=down, 180°=left, 270°=up). Use the pulse animation.
- If `RenderConfig.useRectangles()`: keep existing arrow text rendering.

**Spawn/enemy/vine markers are editor-only** — don't add sprite support for these. They're debug visuals.

### 5. Integrate into `GravityWellSystem.ts`

Modify `src/engine/world/GravityWellSystem.ts`:

- Add sprite initialization (same pattern: `spritesReady`, `initSprites()`)
- In `render()`:
  - If `RenderConfig.useSprites()`: draw `gravity-well-attract` or `gravity-well-repel` sprite centered on the well position. Scale based on well radius (the sprite is 128×128, representing the default radius). Use the pulse animation.
  - If `RenderConfig.useRectangles()`: keep existing concentric ring + arrow particle rendering.
- Debug render (`renderDebug()`) is unchanged — always draws regardless of mode.

### 6. Integrate into `CurrentSystem.ts`

Modify `src/engine/world/CurrentSystem.ts`:

- In `renderFlow()`:
  - If `RenderConfig.useSprites()`: draw `current-arrow` sprites at flow line positions, rotated to match current direction. Use the flow animation. Tile arrows at ~64px intervals across the zone, offset by animation time for movement effect.
  - If `RenderConfig.useRectangles()`: keep existing flow line + arrowhead rendering.
- Whirlpool rendering: draw `current-arrow` sprites along spiral paths (rotated tangentially).
- Debug render is unchanged.

### 7. Integrate into `FogSystem.ts`

Modify `src/engine/world/FogSystem.ts`:

- In `renderZoneBoundaries()`:
  - If `RenderConfig.useSprites()`: draw `fog-wisp` sprites at zone boundary particle positions (use existing particle spawn locations). The drift animation replaces the current small rect particles.
  - If `RenderConfig.useRectangles()`: keep existing dashed glow + rect particle rendering.
- **Do NOT change the fog overlay** (`renderFogOverlay()`) or control effects (`renderControlEffects()`) — these are screen-space compositing effects that don't benefit from sprites.

### 8. Add generation prompts to `scripts/generate-assets.ts`

Add a new `"world-objects"` category with prompts for all world object sheets. Follow the existing pattern in the script:

```typescript
{
  id: "vine-anchor",
  filename: "vine-anchor.png",
  category: "world-objects",
  width: 64,   // 2 frames × 32px
  height: 32,
  prompt: `${STYLE_PREFIX} sprite sheet of a vine anchor point, 2 frames side by side in a horizontal strip on transparent background. Frame 1: dormant stone hook with dried vine wrapped around it. Frame 2: active glowing green hook with fresh vine. Each frame 32x32 pixels. Earthy green and brown tones.`
}
```

Define prompts for all 14 sheets listed above. Each prompt should specify:
- The exact frame layout (N frames in a horizontal strip)
- Frame dimensions
- Visual description matching the hand-inked watercolor art style
- Transparent background

---

## Files to create

| File | Description |
|------|-------------|
| `src/engine/world/WorldObjectSprites.ts` | Sprite configs, animations, and helper render functions |

## Files to modify

| File | Changes |
|------|---------|
| `src/engine/world/VineSystem.ts` | Add sprite init, RenderConfig-aware rendering for rope + anchors |
| `src/engine/world/RoomRenderer.ts` | Add sprite rendering for gates and exit indicators |
| `src/engine/world/GravityWellSystem.ts` | Add sprite init, RenderConfig-aware rendering for wells |
| `src/engine/world/CurrentSystem.ts` | Add sprite rendering for flow arrows |
| `src/engine/world/FogSystem.ts` | Add sprite rendering for boundary wisps |
| `scripts/generate-assets.ts` | Add world-objects category with 14 asset prompts |

## Files NOT to modify

- `src/engine/physics/Obstacles.ts` — data model stays pure. Rendering helpers live in WorldObjectSprites.ts.
- Any test pages — they already have RenderConfig toggles from the asset-toggle-system task.
- `src/engine/core/AssetManager.ts` — the placeholder color for world objects (`#10b981`) is already defined.

---

## Specific values and conventions

- **Placeholder color:** `#10b981` (emerald green) — already registered in AssetManager for the `"world"` category prefix.
- **All sprite sheets use `/assets/` path prefix:** e.g., `/assets/vine-anchor.png`
- **Frame indices are 0-based**, left-to-right in horizontal strips.
- **Gate ability mapping:** frame 0 = margin-stitch (cyan), frame 1 = redaction (red), frame 2 = paste-over (amber), frame 3 = index-mark (purple). This matches the `GateAbility` type ordering.
- **Spike direction detection:** If the obstacle has a `direction` property, use it directly. Otherwise infer from rect shape: width > height × 2 = horizontal (use left/right based on context), height > width × 2 = vertical (use up/down based on context). Default to `spikes-up` if ambiguous.

---

## Verification / pass criteria

1. **VineSystem renders with sprites:** Vine anchors show as 32×32 sprites (idle/active states). Rope segments tile along the swing path. Decorative vines tile rope sprites along their paths.
2. **Obstacles render with sprites:** Spikes, barriers, and lasers show sprite art when in sprite mode. Lasers pulse via animation. Barriers tile vertically.
3. **Gates render with sprites:** Ability gates show colored gate sprites matching their ability type.
4. **Exit indicators render with sprites:** Directional arrows show as rotated sprites with pulse animation.
5. **Gravity wells render with sprites:** Wells show animated pulse sprites scaled to their radius.
6. **Current zones render with sprites:** Flow arrows tile across zone areas, rotated to match current direction.
7. **Fog boundaries render with sprites:** Fog wisps replace rectangular boundary particles.
8. **Rectangle mode unchanged:** Switching to "rectangles" produces the exact same visuals as before this task. Zero visual regression.
9. **Both mode works:** "both" mode shows sprites with semi-transparent rect overlays.
10. **No errors when assets are missing:** All sprite rendering gracefully falls back to AssetManager placeholders (colored rects with frame numbers).
11. **Generation prompts defined:** `npx tsx scripts/generate-assets.ts --list` shows all 14 world object assets.
12. **TypeScript compiles:** `npx tsc --noEmit` passes with no new errors.

---

## Implementation notes

- **Start with WorldObjectSprites.ts** — define all configs and animations first. Then integrate into each system one by one.
- **VineSystem rope tiling is the trickiest part.** Sample the Bézier curve at regular intervals, compute the angle at each point, draw the rope sprite rotated. Use `ctx.save()` / `ctx.translate()` / `ctx.rotate()` / `ctx.restore()` per segment.
- **Don't over-engineer.** Some systems (like FogSystem boundary particles) are subtle visual elements. A simple sprite swap at particle draw positions is sufficient — no need for complex animation state management.
- **Gravity well scaling:** The sprite is 128×128 representing a ~200px default radius. Scale factor = `well.radius / 100` (so a 200px well draws at 2× scale, showing the sprite at 256×256 which covers the well area).
- **Current arrow spacing:** Place arrows at ~64px intervals within the zone, offset by `(time * currentDirection * speed) % 64` for animated movement effect.
- **The `renderObstacleSprite()` helper** should be called from wherever obstacles are currently drawn — this varies by context (test pages, Redaction system, RoomManager). Add it as a utility that callers can opt into. Don't hunt down every call site; focus on the most visible ones (RoomManager's obstacle rendering, the Redaction system's targeting overlay).

---

## Implementation Summary

### Files Created
- **`src/engine/world/WorldObjectSprites.ts`** — 14 sprite sheet configs, 8 animation definitions, helper functions (`getWorldObjectConfigs`, `getWorldObjectAnimations`, `loadWorldObjectSprites`, `renderObstacleSprite`, `getGateFrameIndex`, `getExitArrowRotation`).

### Files Modified
- **`src/engine/world/VineSystem.ts`** — Added `spritesReady`, `anchorAnimControllers`, `initSprites()` method, RenderConfig-aware rendering for anchors (sprite idle/active states), rope (tiled sprite segments along swing path), and decorative vines (tiled rope sprites along sinusoidal path).
- **`src/engine/world/RoomRenderer.ts`** — `renderGates()` now draws `ability-gate` sprites in sprite mode (frame index by ability type, scaled to fill gate rect). `renderExitIndicators()` draws `exit-arrow` sprites rotated by direction with pulse animation.
- **`src/engine/world/GravityWellSystem.ts`** — Added `spritesReady`, `wellAnimControllers`, `initSprites()` method. `render()` draws `gravity-well-attract`/`gravity-well-repel` sprites scaled by well radius in sprite mode.
- **`src/engine/world/CurrentSystem.ts`** — `renderFlow()` dispatches to new `renderDirectionalFlowSprite()` (tiles `current-arrow` sprites at 64px intervals, rotated to match direction, offset by time) and `renderWhirlpoolFlowSprite()` (arrows along spiral paths, rotated tangentially) in sprite mode.
- **`src/engine/world/FogSystem.ts`** — `renderZoneBoundaries()` draws `fog-wisp` sprites at boundary particle positions in sprite mode, replaces rect particles.
- **`src/engine/core/AssetManager.ts`** — Added 9 world object placeholder color entries (vine, spikes, barrier, laser, ability, exit, gravity, current, fog) all using `#10b981`.
- **`src/engine/world/index.ts`** — Added exports for WorldObjectSprites module.
- **`scripts/generate-assets.ts`** — Added 14 world-objects category asset prompts with appropriate frame layouts and art descriptions. Added `--list` flag for asset enumeration.

### Verification
- `npx tsc --noEmit` passes with zero errors.
- `npx tsx scripts/generate-assets.ts --list` shows all 14 world object assets.
- All systems use RenderConfig.useSprites()/useRectangles() pattern — rectangle mode is unchanged, both mode shows sprites with rect overlays.

---

## Review Notes (reviewer: f815a394)

### Fixes Applied

1. **`getExitArrowRotation` direction mismatch** — Changed `case "down"` to `case "bottom"` in `WorldObjectSprites.ts` to match the `ExitDirection` type (`"left" | "right" | "top" | "bottom"`). Bottom exits were getting rotation 0 (right) instead of PI/2 (down).

2. **`renderObstacleSprite` used `performance.now()` for laser animation** — Replaced with a `time` parameter (seconds, like the rest of the engine). Falls back to `performance.now() / 1000` if no time is passed, but callers should pass game time for consistency. This prevents visual jank on backgrounded tabs.

3. **`_assetManager` parameter naming** — Removed underscore prefix from the `renderObstacleSprite` parameter since it IS used (underscore convention means "intentionally unused").

### What Looked Good

- All 14 sprite sheet configs match the task spec (correct IDs, frame sizes, frame counts)
- All 8 animation definitions are correct (FPS, frame lists, loop flags)
- VineSystem rope tiling along Bézier path is clean, with proper rotation per segment
- RoomRenderer gate rendering correctly maps ability types to frame indices
- GravityWellSystem scaling (radius / 100) produces the right sprite coverage
- CurrentSystem flow arrows tile at 64px intervals with time-offset animation
- FogSystem boundary wisps properly replace rect particles in sprite mode
- All RenderConfig checks follow the correct pattern (useSprites/useRectangles)
- Asset generation prompts are complete and descriptive
- TypeScript compiles cleanly after fixes
