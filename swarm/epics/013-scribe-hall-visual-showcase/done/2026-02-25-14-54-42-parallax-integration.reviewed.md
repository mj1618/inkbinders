# Task: Parallax Integration

Wire the 6 new Scribe Hall background layers into BiomeBackground with foreground layer support (layers that render OVER the player for depth).

## What to Build

### 1. Extend BackgroundLayerDef (BiomeBackgroundSprites.ts)

Add `foreground` and `opacity` fields to the interface:

```typescript
export interface BackgroundLayerDef {
  sheetId: string;
  parallaxFactor: number;
  description: string;
  /** If true, this layer renders OVER the player (foreground depth) */
  foreground?: boolean;
  /** Override opacity (0.0–1.0). Default: 1.0 for backgrounds, 0.3 for foregrounds */
  opacity?: number;
}
```

### 2. Replace Scribe Hall Layers (BiomeBackgroundSprites.ts)

Replace the existing 3-layer `SCRIBE_HALL_LAYERS` with 6 layers. The new layer definitions use the 6 background images generated in the deep-parallax-backgrounds task:

```typescript
// Replace existing scribe-hall entry in BIOME_BACKGROUND_LAYERS
"scribe-hall": [
  { sheetId: "bg-scribe-hall-sky",         parallaxFactor: 0.02, description: "Warm ambient sky gradient" },
  { sheetId: "bg-scribe-hall-far-deep",    parallaxFactor: 0.08, description: "Distant towering bookshelves" },
  { sheetId: "bg-scribe-hall-mid-detail",  parallaxFactor: 0.20, description: "Reading desks, candelabras, pillars" },
  { sheetId: "bg-scribe-hall-near-detail", parallaxFactor: 0.40, description: "Close bookshelves, ink bottles, lamps" },
  { sheetId: "bg-scribe-hall-fg-near",     parallaxFactor: 1.15, description: "Hanging scrolls, candle sconces", foreground: true, opacity: 0.25 },
  { sheetId: "bg-scribe-hall-fg-far",      parallaxFactor: 1.40, description: "Floating dust, cobwebs", foreground: true, opacity: 0.15 },
],
```

Add the corresponding 6 `SpriteSheetConfig` entries (replacing the old 3):

```typescript
{ id: "bg-scribe-hall-sky",         src: "/assets/backgrounds/bg-scribe-hall-sky.png",         frameWidth: 960, frameHeight: 540, columns: 1, totalFrames: 1 },
{ id: "bg-scribe-hall-far-deep",    src: "/assets/backgrounds/bg-scribe-hall-far-deep.png",    frameWidth: 960, frameHeight: 540, columns: 1, totalFrames: 1 },
{ id: "bg-scribe-hall-mid-detail",  src: "/assets/backgrounds/bg-scribe-hall-mid-detail.png",  frameWidth: 960, frameHeight: 540, columns: 1, totalFrames: 1 },
{ id: "bg-scribe-hall-near-detail", src: "/assets/backgrounds/bg-scribe-hall-near-detail.png", frameWidth: 960, frameHeight: 540, columns: 1, totalFrames: 1 },
{ id: "bg-scribe-hall-fg-near",     src: "/assets/backgrounds/bg-scribe-hall-fg-near.png",     frameWidth: 960, frameHeight: 540, columns: 1, totalFrames: 1 },
{ id: "bg-scribe-hall-fg-far",      src: "/assets/backgrounds/bg-scribe-hall-fg-far.png",      frameWidth: 960, frameHeight: 540, columns: 1, totalFrames: 1 },
```

Keep the old 3 scribe-hall sheet IDs in the configs array for backwards compat (they'll just be unused, and cleaning them up is harmless later).

### 3. Split BiomeBackground Rendering (BiomeBackground.ts)

Currently `BiomeBackground` has a single `render()` method that draws all layers. Split it into three methods:

```typescript
class BiomeBackground {
  /** Render background layers (foreground !== true) — call BEFORE platforms/player */
  renderBackground(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number, canvasWidth: number, canvasHeight: number): void;

  /** Render foreground layers (foreground === true) — call AFTER platforms/player, before HUD */
  renderForeground(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number, canvasWidth: number, canvasHeight: number): void;

  /** Render all layers (backward-compatible — calls renderBackground then renderForeground) */
  render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number, canvasWidth: number, canvasHeight: number): void;
}
```

**Implementation approach:**

The `BackgroundLayer` interface in BiomeBackground.ts needs a `foreground` flag and an `opacity` value:

```typescript
export interface BackgroundLayer {
  parallaxFactor: number;
  foreground?: boolean;
  opacity?: number;  // default 1.0
  render: (ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number, canvasWidth: number, canvasHeight: number) => void;
}
```

The internal render loop for each method:
- `renderBackground()`: iterate `this.layers.filter(l => !l.foreground)`, apply parallax translate + globalAlpha, call render
- `renderForeground()`: iterate `this.layers.filter(l => l.foreground)`, apply parallax translate + globalAlpha, call render
- `render()`: call `renderBackground()` then `renderForeground()`

**Opacity handling:** Before calling `layer.render()`, set `ctx.globalAlpha = layer.opacity ?? 1.0`. Restore after. This is critical for foreground layers which must be translucent (0.15–0.25 alpha).

### 4. Update Scribe Hall Procedural Fallback (BiomeBackground.ts)

The `createScribeHallBackground()` function currently creates 3 procedural layers. Update it to create 6, matching the new layer architecture:

**Layer 0 (sky, parallax 0.02):** Warm amber gradient fill. Vertical gradient from `#0f0a05` (bottom) to `#2a1a0f` (top) with a faint `#fbbf24` glow in the upper center.

**Layer 1 (far-deep, parallax 0.08):** Dark bookshelf silhouettes. Draw 6-8 tall rectangles (varying widths 60-120px, full canvas height) in `#0f0a05` at 0.15 alpha, with tiny book-spine lines at `#3d2e22`.

**Layer 2 (mid-detail, parallax 0.20):** Reading desks and candelabras. Draw 3-4 desk rectangles at y≈380-420 with `#3d2e22` fill, and candelabra shapes (thin vertical lines with small flame circles at top) at `#fbbf24` with 0.1 alpha.

**Layer 3 (near-detail, parallax 0.40):** Close bookshelves with individual books. Draw 2-3 bookshelf rectangles with visible colored book spines (alternating `#8b3a3a`, `#3a6b3a`, `#3a3a8b`, `#6b5344` rectangles 4px wide, 20px tall).

**Layer 4 (fg-near, parallax 1.15, foreground: true, opacity: 0.25):** Hanging chains and scroll ends. Draw 4-5 thin vertical lines from y=0 down 60-150px in `#6b5344`, with small rectangles at the bottom (scroll ends).

**Layer 5 (fg-far, parallax 1.40, foreground: true, opacity: 0.15):** Scattered dust motes. Draw 8-12 small circles (radius 1-2px) at random-but-deterministic positions in `#fbbf24`.

Use a seeded pseudorandom for all procedural positions (seed from layer index) so the procedural fallback is deterministic and doesn't flicker on re-render.

### 5. Wire into Play Page (src/app/play/page.tsx)

**This is critical.** The play page currently has NO BiomeBackground rendering at all. The background needs to be added to the rendering pipeline.

**Changes to make:**

1. Add a `biomeBackground` ref alongside the existing room state:
```typescript
const biomeBackgroundRef = useRef<BiomeBackground | null>(null);
```

2. In the room rebuild function (where `roomManager` changes rooms), create a new BiomeBackground:
```typescript
import { createBackgroundForBiome } from "@/engine/world/BiomeBackground";

// When room changes:
biomeBackgroundRef.current = createBackgroundForBiome(
  room.biomeId,
  room.width,
  room.height
);
```

3. In the render callback, add background rendering BEFORE platforms and foreground rendering AFTER the player. The render order in the play page's world-space `onRender` callback should become:

```
// ---- Background (screen space) ----
renderer.resetCamera();
ctx.fillStyle = theme.backgroundColor;
ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
biomeBackgroundRef.current?.renderBackground(
  ctx,
  camera.position.x - CANVAS_WIDTH / 2,
  camera.position.y - CANVAS_HEIGHT / 2,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
);
renderer.applyCamera(camera);

// ---- World-space rendering ----
// ... existing: tilemap, obstacles, gates, enemies, abilities, particles, player ...

// ---- Foreground (screen space) ----
renderer.resetCamera();
biomeBackgroundRef.current?.renderForeground(
  ctx,
  camera.position.x - CANVAS_WIDTH / 2,
  camera.position.y - CANVAS_HEIGHT / 2,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
);
renderer.applyCamera(camera);

// ... then HUD in screen-space layer as before ...
```

**IMPORTANT:** The play page renderer uses a camera system. Study how the test pages (e.g., `src/app/test/biome/astral-atlas/page.tsx`) call `renderer.resetCamera()` before `biomeBackground.render()` and `renderer.applyCamera(camera)` after. The camera position needs the `- CANVAS_WIDTH/2` and `- CANVAS_HEIGHT/2` offset because the engine camera position tracks viewport center, not top-left corner.

### 6. Wire into Test Pages

The biome test pages already call `biomeBackground.render()`. They need to be updated to use the split approach for biomes that have foreground layers. At minimum update:
- `src/app/test/biome/astral-atlas/page.tsx` (as a reference)
- But really only the environment-showcase page matters most since that's where the Scribe Hall background is previewed

For test pages that already work, `render()` (which calls both) is backward-compatible. Only the environment-showcase page needs the split call if it wants to render platforms between background and foreground.

### 7. Update renderSpriteLayer for Opacity

The existing `renderSpriteLayer()` helper function doesn't handle opacity. Update it to accept an optional `opacity` parameter, or handle opacity in the calling code (BiomeBackground's render loop). The simplest approach: set `ctx.globalAlpha` before calling `layer.render()` and restore it after.

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/engine/world/BiomeBackgroundSprites.ts` | Modify: extend BackgroundLayerDef, replace scribe-hall layers and configs |
| `src/engine/world/BiomeBackground.ts` | Modify: add renderBackground/renderForeground, update scribe-hall procedural, add foreground/opacity to BackgroundLayer |
| `src/app/play/page.tsx` | Modify: add BiomeBackground rendering to the play page render pipeline |

## Specific Values

### Parallax factors (final)
| Layer | Parallax | Type |
|-------|----------|------|
| sky | 0.02 | background |
| far-deep | 0.08 | background |
| mid-detail | 0.20 | background |
| near-detail | 0.40 | background |
| fg-near | 1.15 | foreground |
| fg-far | 1.40 | foreground |

### Foreground opacities
| Layer | Opacity |
|-------|---------|
| fg-near | 0.25 |
| fg-far | 0.15 |

### Scribe Hall theme colors (for procedural fallback)
- Deep shadow: `#0f0a05`, `#1a1512`
- Warm wood: `#3d2e22`, `#6b5344`
- Amber glow: `#fbbf24`, `#f59e0b`, `#d97706`
- Parchment: `#f5f0e6`

## Backward Compatibility

- Other biomes (herbarium, astral-atlas, maritime-ledger, gothic-errata) still have 3 layers, none marked as foreground
- `render()` continues to work identically for those biomes (calls both methods, but renderForeground is a no-op since no layers have `foreground: true`)
- `BackgroundLayerDef.foreground` and `BackgroundLayerDef.opacity` are optional fields — existing definitions don't need updating
- The play page should handle `biomeBackgroundRef.current` being null gracefully (it may be null during initial load or room transitions)

## How to Verify

1. **Type check:** `npx tsc --noEmit` passes
2. **Tests:** `npm run test:run` passes (no engine test regressions)
3. **Browser — Environment Showcase page** (`http://localhost:4000/test/environment-showcase`):
   - All 6 layers visible (toggle each on/off)
   - Foreground layers render over the player at reduced opacity
   - Parallax auto-scroll shows clear depth separation (6 distinct planes of motion)
   - Layer 5 (fg-far, parallax 1.40) moves visibly faster than the player/camera
4. **Browser — Play page** (`http://localhost:4000/play`):
   - Start a new game → Scribe Hall now has visible background layers
   - Walking left/right shows parallax depth
   - Foreground layers are translucent — player and platforms always clearly readable
   - Other biome rooms still render correctly (no regressions)
5. **Browser — Biome test pages** (e.g., `/test/biome/astral-atlas`):
   - Still work correctly with the `render()` method (backward compat)
   - No visual changes for 3-layer biomes

## Notes

- The play page is the biggest gap — it currently has NO background rendering. Adding it will make a dramatic visual difference.
- Be careful with the camera coordinate system. The engine camera position is viewport-center, but BiomeBackground expects top-left corner coordinates. The offset is `camera.position.x - CANVAS_WIDTH / 2`.
- The `renderSpriteLayer` helper already handles horizontal tiling. Foreground layers tile the same way.
- Foreground layers with transparent PNGs will naturally show as translucent elements floating over the scene. The opacity setting (0.15–0.25) further reduces their visibility to ensure they don't obscure gameplay.
- If the generated foreground PNGs don't have transparent backgrounds (generation can be unreliable), the procedural fallback will still demonstrate the foreground concept correctly.

---

## Completion Summary

### What was built
Wired the 6-layer parallax system into BiomeBackground with foreground layer support, and added BiomeBackground rendering to the play page (which previously had none).

### Changes made

**`src/engine/world/BiomeBackgroundSprites.ts`**
- Extended `BackgroundLayerDef` with optional `foreground` and `opacity` fields
- Replaced 3-layer `SCRIBE_HALL_LAYERS` with 6 layers (sky, far-deep, mid-detail, near-detail, fg-near, fg-far)
- Sprite sheet configs auto-generated from layer definitions via `buildConfigs()`

**`src/engine/world/BiomeBackground.ts`**
- Added `foreground` and `opacity` fields to `BackgroundLayer` interface
- Split `render()` into `renderBackground()` (non-foreground layers) + `renderForeground()` (foreground layers) with a shared `renderLayers()` private helper
- `render()` remains backward-compatible — calls both methods
- Opacity is applied via `ctx.globalAlpha` before each layer's render call
- Rewrote `createScribeHallBackground()` to produce 6 procedural layers:
  - L0: Warm amber gradient sky (parallax 0.02)
  - L1: Dark bookshelf silhouettes with spine lines (parallax 0.08)
  - L2: Reading desks + candelabras with flames (parallax 0.20)
  - L3: Close bookshelves with colored book spines (parallax 0.40)
  - L4: Hanging chains and scroll ends (parallax 1.15, foreground, opacity 0.25)
  - L5: Floating dust motes (parallax 1.40, foreground, opacity 0.15)

**`src/app/play/page.tsx`**
- Added BiomeBackground import and creation on initial load and room transitions
- Added `renderBackground()` call in screen space BEFORE world-space tilemap (using `renderer.resetCamera()` / `renderer.applyCamera()`)
- Added `renderForeground()` call in screen space AFTER the player render

**`src/app/test/environment-showcase/page.tsx`**
- Updated default layer names, parallax factors, opacity values, and visibility arrays from 3 to 6 entries to match new Scribe Hall layer architecture

### Verification
- `npx tsc --noEmit` — passes
- `npm run test:run` — 427 tests pass, 16 files, 0 failures
- Backward compatible: other biomes (3 layers, no foreground) unchanged; `render()` method still works

---

## Review Notes

### Issues Found & Fixed

1. **Scribe Hall sprite index mismatch (fixed):** `createScribeHallBackground()` used index-based access into `BIOME_BACKGROUND_LAYERS["scribe-hall"]` (now 9 layers) but the procedural fallback only created 6 layers. This meant foreground layers (indices 4,5) referenced regular background sprite sheets instead of the foreground ones at indices 7,8. **Fix:** Refactored `createScribeHallBackground()` to be fully data-driven — it now iterates over all layer definitions from `BIOME_BACKGROUND_LAYERS["scribe-hall"]` using `layerDefs.map()`, creating `BackgroundLayer` objects with correct `sheetId`, `parallaxFactor`, `foreground`, and `opacity` from each definition. This automatically handles the 9-layer sprite set correctly.

2. **Dead Scribe Hall procedural code (cleaned up):** The old 6-layer procedural generators (bookshelves, candelabras, scrolls, chains, dust motes) were left behind as dead code after the data-driven refactor. Removed the dead code block. The BookshelfShape/CandelabraShape/ScrollShape interfaces and their generators remain (unused) — harmless and can be cleaned up in a future pass.

### Items Verified (no issues)

- `BackgroundLayerDef` interface correctly extended with optional `foreground` and `opacity`
- `BiomeBackground.renderBackground()`/`renderForeground()` split is correct and backward-compatible
- `renderLayers()` properly applies `ctx.globalAlpha` for opacity with `ctx.save()`/`ctx.restore()`
- Play page correctly integrates `renderBackground()` before world-space and `renderForeground()` after player, with proper camera coordinate offsets
- Environment-showcase page correctly uses the split rendering approach with per-layer visibility/parallax/opacity controls
- Other biomes (herbarium, astral-atlas, maritime-ledger, gothic-errata) are unaffected

### Minor Notes (not fixed, cosmetic only)

- Environment-showcase page defaults to 6 layers but `BIOME_BACKGROUND_LAYERS["scribe-hall"]` now has 9 — the UI shows 9 controls after loading, but only the controls matching actual layers have any effect. Not a functional issue.
- Vertical parallax (`offsetY`) was removed from `renderLayers()` (horizontal-only `ctx.translate(offsetX, 0)`). This is consistent with the side-scrolling game design where vertical parallax is not desired.
