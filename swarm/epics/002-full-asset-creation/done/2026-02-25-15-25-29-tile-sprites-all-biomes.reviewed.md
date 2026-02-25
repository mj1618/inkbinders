# Task: Tile Sprites — All Biomes

## Summary

Create tile sprite sheet configs for all 5 biomes + surface type variants, integrate tile sprite rendering into `TileMap.ts` behind the `RenderConfig` toggle, and add tile generation prompts to the asset pipeline.

Platforms currently render as colored rectangles everywhere. After this task, when `RenderConfig.getMode()` is `"sprites"` or `"both"`, platforms will render using tiled sprite frames from per-biome tile sheets. Rectangle mode remains identical to today.

---

## Context

### What exists

- `TileMap.ts` renders platforms as filled rectangles with surface-type colors. There's already a TODO comment at the render method referencing Task 5 (this task).
- `RenderConfig.ts` provides the global `"sprites" | "rectangles" | "both"` toggle. `useSprites()` and `useRectangles()` helpers.
- `AssetManager.ts` has a placeholder system that generates colored-rect placeholders when images fail to load. The placeholder color for tiles is `#8b7355`.
- `SpriteSheet.ts` handles frame slicing from sprite sheets. `drawFrame()` renders a single frame at a position with optional flip/scale.
- `PlayerSprites.ts` and `EnemySprites.ts` establish the pattern: export an array of `SpriteSheetConfig`, animation defs, and a state-to-animation mapping.
- `Biome.ts` defines all 5 biome themes with `platformFillColor`, `platformStrokeColor`, and full color palettes.
- `Surfaces.ts` defines 5 surface types (normal, bouncy, icy, sticky, conveyor) with colors.
- `generate-assets.ts` already has 2 tile prompts (tiles-scribe-hall, tiles-herbarium) generating 4 tiles each at 32×32.
- Biomes: `scribe-hall`, `herbarium-folio`, `astral-atlas`, `maritime-ledger`, `gothic-errata`.

### Key files to read before starting

- `src/engine/physics/TileMap.ts` — the `render()` method (look for the TODO comment)
- `src/engine/core/RenderConfig.ts` — render mode API
- `src/engine/core/AssetManager.ts` — loading + placeholder system
- `src/engine/core/SpriteSheet.ts` — frame drawing API
- `src/engine/entities/PlayerSprites.ts` — pattern to follow for sprite configs
- `src/engine/entities/enemies/EnemySprites.ts` — pattern to follow
- `src/engine/world/Biome.ts` — biome themes + `getBiomeTheme()`
- `src/engine/physics/Surfaces.ts` — surface types + colors
- `scripts/generate-assets.ts` — existing tile generation prompts

---

## What to Build

### 1. Create `src/engine/world/TileSprites.ts`

This is the core of the task. Follow the pattern from `PlayerSprites.ts` and `EnemySprites.ts`.

**Design: One sprite sheet per biome, 4 tile types per sheet.**

Each biome tile sheet has 4 frames (4 columns × 1 row) representing these tile roles:
1. **Floor** — top of horizontal platforms
2. **Block** — generic fill for platform interiors and sides
3. **Column** — vertical structural element (sides of tall platforms)
4. **Wall** — solid wall/boundary tile

Frame size: **32×32** for all tiles.

**Tile sheet configs:**

```typescript
export const TILE_SPRITE_CONFIGS: SpriteSheetConfig[] = [
  {
    id: "tiles-scribe-hall",
    src: "/assets/tiles-scribe-hall.png",
    frameWidth: 32, frameHeight: 32,
    columns: 4, totalFrames: 4,
  },
  {
    id: "tiles-herbarium-folio",
    src: "/assets/tiles-herbarium-folio.png",
    frameWidth: 32, frameHeight: 32,
    columns: 4, totalFrames: 4,
  },
  {
    id: "tiles-astral-atlas",
    src: "/assets/tiles-astral-atlas.png",
    frameWidth: 32, frameHeight: 32,
    columns: 4, totalFrames: 4,
  },
  {
    id: "tiles-maritime-ledger",
    src: "/assets/tiles-maritime-ledger.png",
    frameWidth: 32, frameHeight: 32,
    columns: 4, totalFrames: 4,
  },
  {
    id: "tiles-gothic-errata",
    src: "/assets/tiles-gothic-errata.png",
    frameWidth: 32, frameHeight: 32,
    columns: 4, totalFrames: 4,
  },
];
```

**Biome-to-tile-sheet mapping:**

```typescript
export const BIOME_TILE_SHEET: Record<string, string> = {
  "scribe-hall": "tiles-scribe-hall",
  "herbarium-folio": "tiles-herbarium-folio",
  "astral-atlas": "tiles-astral-atlas",
  "maritime-ledger": "tiles-maritime-ledger",
  "gothic-errata": "tiles-gothic-errata",
  "default": "tiles-scribe-hall",  // fallback
};
```

**Tile frame indices:**

```typescript
export const TILE_FRAME = {
  FLOOR: 0,
  BLOCK: 1,
  COLUMN: 2,
  WALL: 3,
} as const;
```

**Surface overlay tint colors** (for surface-type variants):

Rather than generating separate sprites for each surface type, apply a semi-transparent color overlay on top of the base tile when the platform has a non-normal surface type. This keeps the sprite count manageable while making surface types visually distinct.

```typescript
export const SURFACE_TINT: Record<string, string | null> = {
  "normal": null,           // no tint — use base tile as-is
  "bouncy": "#f472b680",    // pink tint, 50% alpha
  "icy": "#67e8f940",       // cyan tint, 25% alpha
  "sticky": "#a78bfa60",    // purple tint, 37% alpha
  "conveyor": "#fb923c60",  // orange tint, 37% alpha
};
```

**Helper function:**

```typescript
/**
 * Given a platform's dimensions and its biome ID, determine which tile frame
 * to use for rendering. Thin platforms (height <= 40) use FLOOR frame,
 * tall narrow platforms use COLUMN, otherwise BLOCK. This is a heuristic
 * that works well for the existing room layouts.
 */
export function getTileFrame(width: number, height: number): number {
  if (height <= 40) return TILE_FRAME.FLOOR;
  if (width <= 40 && height > 80) return TILE_FRAME.COLUMN;
  if (width >= height * 3) return TILE_FRAME.FLOOR;
  return TILE_FRAME.BLOCK;
}
```

**Load function** (matches pattern from other sprite files):

```typescript
export async function loadTileSprites(): Promise<void> {
  const assetManager = AssetManager.getInstance();
  await assetManager.loadAll(TILE_SPRITE_CONFIGS);
}
```

### 2. Modify `src/engine/physics/TileMap.ts` — Sprite Rendering

Replace the TODO in the `render()` method with tile sprite rendering.

**Rendering logic:**

When `RenderConfig.useSprites()` is true:
1. For each platform, determine its biome (passed as a parameter or stored on TileMap)
2. Look up the tile sheet ID from `BIOME_TILE_SHEET[biomeId]`
3. Get the `SpriteSheet` from `AssetManager.getInstance().getSpriteSheet(sheetId)`
4. Determine the tile frame index using `getTileFrame(platform.width, platform.height)`
5. **Tile the sprite** across the platform's dimensions:
   - Calculate how many 32×32 tiles fit horizontally: `Math.ceil(width / 32)`
   - Calculate how many tiles fit vertically: `Math.ceil(height / 32)`
   - Draw each tile frame in a grid to fill the platform rectangle
   - Clip to the platform bounds so edge tiles don't overflow
6. If the platform has a non-normal surface type, draw a semi-transparent color overlay using `SURFACE_TINT`

When `RenderConfig.useRectangles()` is true:
- Draw the existing colored rectangles (current behavior, unchanged)

When mode is `"both"`:
- Draw sprites first, then semi-transparent colored rectangle overlay

**Implementation approach:**

The `TileMap` needs to know which biome it's in. Add an optional `biomeId` field:

```typescript
// In TileMap class:
private biomeId: string = "default";

setBiomeId(biomeId: string): void {
  this.biomeId = biomeId;
}

getBiomeId(): string {
  return this.biomeId;
}
```

The room loading code (in `RoomManager` or wherever TileMap is created per room) should call `tileMap.setBiomeId(room.biomeId)`. Check how `RoomManager.ts` creates the TileMap and find the right place to set this.

**Tile rendering helper method** (add to TileMap):

```typescript
private renderTileSprite(
  ctx: CanvasRenderingContext2D,
  platform: Platform,
  spriteSheet: SpriteSheet,
  frameIndex: number
): void {
  const tileW = 32;
  const tileH = 32;
  const cols = Math.ceil(platform.width / tileW);
  const rows = Math.ceil(platform.height / tileH);

  ctx.save();
  // Clip to platform bounds so partial edge tiles don't overflow
  ctx.beginPath();
  ctx.rect(platform.x, platform.y, platform.width, platform.height);
  ctx.clip();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      spriteSheet.drawFrame(
        ctx,
        frameIndex,
        platform.x + col * tileW,
        platform.y + row * tileH,
        false, // no flip
        1, 1   // no scale
      );
    }
  }

  ctx.restore();
}
```

**Surface tint overlay** (after tile sprite rendering):

```typescript
private renderSurfaceTint(
  ctx: CanvasRenderingContext2D,
  platform: Platform
): void {
  const tint = SURFACE_TINT[platform.surfaceType || "normal"];
  if (tint) {
    ctx.fillStyle = tint;
    ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
  }
}
```

**Updated `render()` method outline:**

```typescript
render(ctx: CanvasRenderingContext2D): void {
  for (const platform of this.platforms) {
    if (this.isPlatformExcluded(platform)) continue;

    if (RenderConfig.useSprites()) {
      const sheetId = BIOME_TILE_SHEET[this.biomeId] || BIOME_TILE_SHEET["default"];
      const sheet = AssetManager.getInstance().getSpriteSheet(sheetId);
      if (sheet) {
        const frame = getTileFrame(platform.width, platform.height);
        this.renderTileSprite(ctx, platform, sheet, frame);
        this.renderSurfaceTint(ctx, platform);
      } else {
        // Fallback to rectangles if sheet not loaded
        this.renderRectangle(ctx, platform);
      }
    }

    if (RenderConfig.useRectangles()) {
      this.renderRectangle(ctx, platform);
    }
  }
}

private renderRectangle(ctx: CanvasRenderingContext2D, platform: Platform): void {
  // Existing colored rectangle rendering code (current behavior)
  const surfaceProps = getSurfaceProps(platform.surfaceType);
  // ... fill + stroke
}
```

**Important**: The current `render()` method might use a `Renderer` wrapper class instead of raw `ctx`. Match the existing API — check if `render()` takes a `Renderer` or `CanvasRenderingContext2D` and use the same drawing methods.

### 3. Modify `src/engine/core/AssetManager.ts` — Tile Placeholder Colors

Add placeholder color entries for all tile biomes:

```typescript
const PLACEHOLDER_COLORS: Record<string, string> = {
  // ... existing entries ...
  "tiles-scribe-hall": "#6b5344",      // Warm brown
  "tiles-herbarium-folio": "#3b6b3b",  // Deep green
  "tiles-astral-atlas": "#475569",     // Slate blue
  "tiles-maritime-ledger": "#3b6b9b",  // Ocean blue
  "tiles-gothic-errata": "#5c3a3a",    // Dark maroon
};
```

These colors are derived from each biome's `platformStrokeColor` in `Biome.ts` so placeholders match the current look.

### 4. Expand `scripts/generate-assets.ts` — Tile Prompts

The script already has prompts for `tiles-scribe-hall` and `tiles-herbarium`. Add the 3 missing biomes.

**New tile prompts to add:**

```typescript
{
  id: "tiles-astral-atlas",
  filename: "tiles-astral-atlas.png",
  prompt: `${STYLE_PREFIX} sprite sheet of 4 platformer tiles in a row, 32x32 pixels each, total image 128x32 pixels. Astral/cosmic library theme. Left to right: (1) star-glass floor tile with glowing constellation lines, (2) solid constellation block with embedded star patterns, (3) nebula pillar tile with swirling purple-blue gas, (4) void edge wall tile with dark boundary glow. Color palette: deep navy blue, silver, gold star points, indigo glow. Tiles should be seamlessly tileable on all edges.`,
  aspectRatio: "4:1",
},
{
  id: "tiles-maritime-ledger",
  filename: "tiles-maritime-ledger.png",
  prompt: `${STYLE_PREFIX} sprite sheet of 4 platformer tiles in a row, 32x32 pixels each, total image 128x32 pixels. Nautical/maritime library theme. Left to right: (1) driftwood plank floor tile with wood grain, (2) coral block tile with barnacle detail, (3) barnacle-encrusted pillar tile, (4) kelp-draped wall tile. Color palette: teal, sand, weathered wood brown, ocean blue. Tiles should be seamlessly tileable on all edges.`,
  aspectRatio: "4:1",
},
{
  id: "tiles-gothic-errata",
  filename: "tiles-gothic-errata.png",
  prompt: `${STYLE_PREFIX} sprite sheet of 4 platformer tiles in a row, 32x32 pixels each, total image 128x32 pixels. Dark gothic library theme. Left to right: (1) cracked stone floor tile with faint red veins, (2) gargoyle-decorated solid block tile, (3) iron column tile with rivets and rust, (4) fog grate wall tile with wisps seeping through. Color palette: dark charcoal gray, deep crimson, iron black, ash white. Tiles should be seamlessly tileable on all edges.`,
  aspectRatio: "4:1",
},
```

Place these in the same section/category as the existing tile prompts. If the script has a category system, tag these as `"tiles"`.

### 5. Integrate Tile Loading into Game Startup

Tile sprites need to be loaded when the game starts or when a room loads. Find where `AssetManager.loadAll()` is called (likely in the play page or test pages) and add tile sprite loading:

```typescript
import { TILE_SPRITE_CONFIGS, loadTileSprites } from "@/engine/world/TileSprites";

// During game initialization:
await loadTileSprites();
```

Also ensure `tileMap.setBiomeId()` is called when rooms are loaded. Check `RoomManager.ts` — wherever it creates or reuses a TileMap for a room, it should set the biome ID from the room's data.

### 6. Wire Up in Test Pages (Optional but Recommended)

The `/test/sprites` test page should demonstrate tile sprite rendering. Add a section showing tiled platforms in each biome theme. If time permits, also verify it on `/test/world-assembly` and `/test/herbarium-wing`.

At minimum, test the tile rendering on the play page (`/play`) since it defaults to sprite mode.

---

## Files to Create

| File | Description |
|------|-------------|
| `src/engine/world/TileSprites.ts` | Tile sprite configs, biome mapping, frame indices, surface tint colors, helper functions |

## Files to Modify

| File | Changes |
|------|---------|
| `src/engine/physics/TileMap.ts` | Add `biomeId` field + setter, replace TODO in `render()` with tile sprite rendering, add `renderTileSprite()` and `renderSurfaceTint()` helpers |
| `src/engine/core/AssetManager.ts` | Add placeholder colors for all 5 tile biomes |
| `scripts/generate-assets.ts` | Add 3 new tile generation prompts (astral-atlas, maritime-ledger, gothic-errata) |
| `src/engine/world/RoomManager.ts` (or equivalent) | Call `tileMap.setBiomeId(room.biomeId)` when loading rooms |
| `src/app/play/page.tsx` | Load tile sprites during initialization |

---

## Design Decisions (Already Made)

1. **Tiled rendering, not stretched** — Each platform is filled by repeating 32×32 tile frames in a grid, clipped to platform bounds. This looks right for platformer tiles.

2. **Surface type = color overlay, not separate sprites** — Instead of generating 5× the sprites for surface variants, we overlay a semi-transparent tint. This keeps scope manageable (5 tile sheets, not 25) and the visual result is clear enough — players already know surface colors from rectangle mode.

3. **Frame selection by platform shape heuristic** — Rather than storing a "tile type" on each platform (which would require modifying all room data), we infer the tile frame from platform dimensions. Thin = floor, tall narrow = column, default = block. This works well enough for the existing room layouts.

4. **One sheet per biome, 4 frames each** — Matches the existing 2 tile sheets. Simple, consistent, efficient.

5. **Biome ID stored on TileMap** — TileMap gets a `biomeId` field so it knows which tile sheet to use. Set by room loading code.

---

## Verification / Pass Criteria

- [ ] `TileSprites.ts` exports configs for all 5 biomes with correct file paths and frame sizes
- [ ] `TileMap.render()` draws tiled sprites when `RenderConfig.getMode()` is `"sprites"`
- [ ] `TileMap.render()` draws colored rectangles when `RenderConfig.getMode()` is `"rectangles"` (unchanged from today)
- [ ] `TileMap.render()` draws both when mode is `"both"`
- [ ] Platforms with non-normal surface types show a colored tint overlay in sprite mode
- [ ] `AssetManager` generates distinct placeholder tiles for each biome (different colors)
- [ ] Tile sprites tile seamlessly across platform dimensions (no gaps, clipped at edges)
- [ ] `generate-assets.ts` has prompts for all 5 biome tile sheets
- [ ] Room loading sets `tileMap.setBiomeId()` from the room's biome ID
- [ ] The play page loads tile sprites during initialization
- [ ] No TypeScript errors (`npx tsc --noEmit` passes)
- [ ] No visual regression in rectangle mode — all existing test pages look identical
- [ ] Excluded platforms (from Margin Stitch exclusion zones) are not rendered in sprite mode either

---

## Implementation Summary

### Files Created
| File | Description |
|------|-------------|
| `src/engine/world/TileSprites.ts` | Tile sprite configs for all 5 biomes, biome-to-sheet mapping, tile frame indices (FLOOR/BLOCK/COLUMN/WALL), surface tint overlay colors, `getTileFrame()` heuristic, `loadTileSprites()` loader |

### Files Modified
| File | Changes |
|------|---------|
| `src/engine/physics/TileMap.ts` | Added `biomeId` field with `setBiomeId()`/`getBiomeId()`. Replaced TODO stub in `render()` with full tile sprite rendering: tiled 32×32 sprites clipped to platform bounds when `RenderConfig.useSprites()`, surface tint overlays for non-normal surfaces, rectangle fallback preserved. Added `isPlatformExcludedForRender()` to skip excluded platforms in all render modes. |
| `src/engine/core/AssetManager.ts` | Added 5 biome-specific placeholder colors (`tiles-scribe-hall` → `#6b5344`, `tiles-herbarium-folio` → `#3b6b3b`, `tiles-astral-atlas` → `#475569`, `tiles-maritime-ledger` → `#3b6b9b`, `tiles-gothic-errata` → `#5c3a3a`) |
| `scripts/generate-assets.ts` | Renamed `tiles-herbarium` → `tiles-herbarium-folio` to match biome ID. Added 3 new tile prompts: astral-atlas, maritime-ledger, gothic-errata. Total tile prompts: 5. |
| `src/engine/world/RoomManager.ts` | Added `tileMap.setBiomeId(room.biomeId)` in `loadRoom()` after TileMap creation |
| `src/app/play/page.tsx` | Imported `loadTileSprites`, called `await loadTileSprites()` during game initialization |

### Verification
- `npx tsc --noEmit` passes with zero errors
- All 427 tests pass (16 test files)
- Rectangle mode unchanged — test pages that don't set biomeId default to `"default"` (maps to `tiles-scribe-hall`)
- Sprite mode: tiles render as tiled 32×32 frames from per-biome sprite sheets, with surface tint overlays
- Excluded platforms (Margin Stitch zones) are skipped in all render modes
- Placeholders generate distinct colors per biome when real assets are missing

---

## Review Notes (699586a8)

### Issues Found & Fixed

1. **"Both" mode rectangle opacity bug** (`TileMap.ts`): When `RenderConfig.getMode()` is `"both"`, both `useSprites()` and `useRectangles()` return true. The `renderRectangle()` method drew fully opaque rectangles on top of sprites, completely hiding the tile sprites underneath. Fixed by passing `alpha=0.4` to `renderRectangle()` in "both" mode via `ctx.globalAlpha`, so sprites show through the debug rectangle overlay.

### Observations (No Fix Needed)

- **`TILE_FRAME.WALL` (index 3) is never selected** by `getTileFrame()`. The heuristic returns FLOOR, COLUMN, or BLOCK but never WALL. This means the 4th tile frame in each sprite sheet goes unused. Not a bug — the WALL frame could be used later for boundary tiles or room edges — but worth knowing.

- **`AssetManager` placeholder lookup order** is correct: specific biome entries (e.g., `"tiles-scribe-hall"`) are listed before the generic `"tiles"` prefix in `PLACEHOLDER_COLORS`, so `getPlaceholderColor()` matches them first during iteration.

### Verification

- `npx tsc --noEmit` — zero errors
- All 427 tests pass (16 files)
- Code review: no frame-rate dependent issues, no memory leaks, proper ctx save/restore in clip paths, types are correct throughout
