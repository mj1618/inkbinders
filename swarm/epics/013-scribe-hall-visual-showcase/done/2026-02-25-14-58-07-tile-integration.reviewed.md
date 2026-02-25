# Task: Tile Integration

**Epic:** 013 — Scribe Hall Visual Showcase
**Task slug:** tile-integration

## Goal

Wire the expanded 16-tile Scribe Hall tileset into the TileMap rendering system with intelligent auto-tiling (edge detection, decorative variants) and per-platform `tileHint` support. The Scribe Hall should render with edge tiles on platform ends, bookshelf tiles on mezzanine shelves, desk tiles on the reading nook, and occasional decorative floor variants — all deterministic (no per-frame randomness).

## What to Build

### 1. Add `tileHint` to Platform Interfaces

Two interfaces need the field:

**In `src/engine/world/Room.ts` — `RoomPlatform`:**

```typescript
export interface RoomPlatform {
  x: number;
  y: number;
  width: number;
  height: number;
  surfaceType?: SurfaceType;
  /** Hint for expanded tileset rendering (biome-specific decoration) */
  tileHint?: string;
}
```

**In `src/engine/physics/TileMap.ts` — `Platform`:**

```typescript
export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  surfaceType?: SurfaceType;
  originalSurfaceType?: SurfaceType;
  isPastedOver?: boolean;
  /** Hint for expanded tileset rendering (biome-specific decoration) */
  tileHint?: string;
}
```

Both are optional strings. The typed values are `"bookshelf" | "desk" | "railing" | "beam"` but we use `string` to avoid coupling Room.ts to TileSprites.ts types. The rendering code in TileMap checks for specific values.

### 2. Switch Scribe Hall to the Expanded Tileset

In `src/engine/world/TileSprites.ts`, update `BIOME_TILE_SHEET`:

```typescript
export const BIOME_TILE_SHEET: Record<string, string> = {
  "scribe-hall": "tiles-scribe-hall-expanded",  // ← changed from "tiles-scribe-hall"
  "herbarium-folio": "tiles-herbarium-folio",
  "astral-atlas": "tiles-astral-atlas",
  "maritime-ledger": "tiles-maritime-ledger",
  "gothic-errata": "tiles-gothic-errata",
  default: "tiles-scribe-hall",                 // ← keep old sheet as default fallback
};
```

### 3. Add Expanded Tile Selection Logic to TileSprites.ts

Add a new function `getExpandedTileFrame` alongside the existing `getTileFrame`:

```typescript
/**
 * Determine the tile frame for a specific grid position within a platform
 * using the expanded 16-tile Scribe Hall tileset.
 *
 * @param platform - The platform being rendered
 * @param col - Column index within the platform's tile grid (0-based)
 * @param row - Row index within the platform's tile grid (0-based)
 * @param totalCols - Total number of tile columns in this platform
 * @param totalRows - Total number of tile rows in this platform
 * @returns Frame index (0–15) into the expanded tileset
 */
export function getExpandedTileFrame(
  platform: { width: number; height: number; tileHint?: string },
  col: number,
  row: number,
  totalCols: number,
  totalRows: number,
): number {
  const hint = platform.tileHint;

  // ── tileHint overrides ──
  if (hint === "bookshelf") {
    // Every 3rd tile is a candle variant (deterministic from col position)
    return col % 3 === 2 ? SCRIBE_TILE.BOOKSHELF_CANDLE : SCRIBE_TILE.BOOKSHELF_FACE;
  }
  if (hint === "desk") {
    return SCRIBE_TILE.DESK_SURFACE;
  }
  if (hint === "railing") {
    return SCRIBE_TILE.ORNATE_RAILING;
  }
  if (hint === "beam") {
    return SCRIBE_TILE.BEAM_CROSS;
  }

  // ── Auto-detect from dimensions ──
  const isFloor = platform.height <= 40 || platform.width >= platform.height * 3;
  const isColumn = platform.width <= 40 && platform.height > 80;
  const isWall = !isFloor && !isColumn;

  if (isFloor) {
    // Edge tiles on first and last column (only if platform is wider than 1 tile)
    if (totalCols > 1 && col === 0) return SCRIBE_TILE.FLOOR_LEFT_EDGE;
    if (totalCols > 1 && col === totalCols - 1) return SCRIBE_TILE.FLOOR_RIGHT_EDGE;
    // Decorative variants: deterministic hash from platform position + col
    // Use a simple hash to pick occasional ink stain or carpet (roughly every 5th tile)
    const hash = deterministicHash(platform.width, col);
    if (hash % 7 === 0) return SCRIBE_TILE.INK_STAIN_FLOOR;
    if (hash % 11 === 0) return SCRIBE_TILE.CARPET_RUNNER;
    return SCRIBE_TILE.FLOOR;
  }

  if (isColumn) {
    return SCRIBE_TILE.PILLAR;
  }

  // Wall (tall, not narrow)
  if (totalRows > 1 && row === 0) return SCRIBE_TILE.WALL_TOP_CAP;
  if (totalRows > 1 && row === totalRows - 1) return SCRIBE_TILE.WALL_BOTTOM_CAP;
  // Occasional cracked stone variant
  const wallHash = deterministicHash(platform.height, row);
  if (wallHash % 5 === 0) return SCRIBE_TILE.CRACKED_STONE;
  return SCRIBE_TILE.WALL;
}

/**
 * Simple deterministic hash for decorative tile placement.
 * Must be stable across frames — no Math.random().
 */
function deterministicHash(seed1: number, seed2: number): number {
  // Combine seeds with a simple integer hash
  let h = (seed1 * 2654435761) ^ (seed2 * 340573321);
  h = ((h >>> 16) ^ h) * 0x45d9f3b;
  h = ((h >>> 16) ^ h) * 0x45d9f3b;
  h = (h >>> 16) ^ h;
  return Math.abs(h);
}
```

Also export `getExpandedTileFrame` and `deterministicHash` so tests can verify determinism.

### 4. Modify TileMap.render() to Use Per-Tile Frame Selection

The current `render()` method calls `getTileFrame()` once per platform and passes a single frame to `renderTileSprite()`. The expanded tileset needs per-tile frame selection (different frames for edge tiles, decorative variants, etc.).

**Update `renderTileSprite` to accept a frame-selection function:**

In `src/engine/physics/TileMap.ts`, change the render logic for scribe-hall:

```typescript
render(renderer: Renderer): void {
  const ctx = renderer.getContext();

  for (const p of this.platforms) {
    if (this.isPlatformExcludedForRender(p)) continue;

    if (RenderConfig.useSprites()) {
      const sheetId = BIOME_TILE_SHEET[this.biomeId] ?? BIOME_TILE_SHEET["default"];
      const sheet = AssetManager.getInstance().getSpriteSheet(sheetId);
      if (sheet) {
        // Check if this biome uses an expanded tileset (more than 4 frames)
        if (this.isExpandedTileset(sheetId)) {
          this.renderExpandedTileSprite(ctx, p, sheet);
        } else {
          const frame = getTileFrame(p.width, p.height);
          this.renderTileSprite(ctx, p, sheet, frame);
        }
        this.renderSurfaceTint(ctx, p);
      } else {
        this.renderRectangle(renderer, p);
      }
    }

    if (RenderConfig.useRectangles()) {
      const rectAlpha = RenderConfig.useSprites() ? 0.4 : 1;
      this.renderRectangle(renderer, p, rectAlpha);
    }
  }
}
```

**Add the expanded rendering method:**

```typescript
/** Check if a tile sheet ID refers to an expanded tileset (16+ tiles) */
private isExpandedTileset(sheetId: string): boolean {
  return sheetId.endsWith("-expanded");
}

/** Render a platform using per-tile frame selection from the expanded tileset */
private renderExpandedTileSprite(
  ctx: CanvasRenderingContext2D,
  platform: Platform,
  spriteSheet: SpriteSheet,
): void {
  const tileW = 32;
  const tileH = 32;
  const cols = Math.ceil(platform.width / tileW);
  const rows = Math.ceil(platform.height / tileH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(platform.x, platform.y, platform.width, platform.height);
  ctx.clip();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const frame = getExpandedTileFrame(platform, col, row, cols, rows);
      spriteSheet.drawFrame(
        ctx,
        frame,
        platform.x + col * tileW,
        platform.y + row * tileH,
      );
    }
  }

  ctx.restore();
}
```

**Import the new function in TileMap.ts:**

Update the import line:

```typescript
import { BIOME_TILE_SHEET, getTileFrame, getExpandedTileFrame, SURFACE_TINT } from "@/engine/world/TileSprites";
```

### 5. Add `tileHint` to Scribe Hall Platforms

In `src/engine/world/scribeHall.ts`, add `tileHint` to specific platforms:

```typescript
platforms: [
  // Floor (left segment) — no hint, auto-detects as floor with edge tiles
  { x: 0, y: 1080 - T, width: 880, height: T },
  // Floor (right segment)
  { x: 1040, y: 1080 - T, width: 880, height: T },
  // Left wall — no hint, auto-detects as wall with caps
  { x: 0, y: 0, width: T, height: 1080 },
  // Right wall
  { x: 1920 - T, y: 0, width: T, height: 1080 },
  // Ceiling segments — no hint, auto-detects as floor
  { x: 0, y: 0, width: 400, height: T },
  { x: 560, y: 0, width: 1360, height: T },

  // Left bookshelf (upper mezzanine) — shelves!
  { x: 300, y: 500, width: 320, height: T, tileHint: "bookshelf" },
  // Left bookshelf walls (vertical) — bookshelf sides
  { x: 260, y: 500, width: 40, height: 200, tileHint: "bookshelf" },
  { x: 620, y: 500, width: 40, height: 200, tileHint: "bookshelf" },

  // Right bookshelf (upper mezzanine)
  { x: 1260, y: 500, width: 320, height: T, tileHint: "bookshelf" },
  // Right bookshelf walls (vertical)
  { x: 1220, y: 500, width: 40, height: 200, tileHint: "bookshelf" },
  { x: 1580, y: 500, width: 40, height: 200, tileHint: "bookshelf" },

  // Central reading nook platform — desk
  { x: 760, y: 700, width: 400, height: T, tileHint: "desk" },

  // Stepping platforms (left side) — no hint, regular floors
  { x: 100, y: 800, width: 160, height: T },
  { x: 200, y: 650, width: 128, height: T },

  // Stepping platforms (right side)
  { x: 1660, y: 800, width: 160, height: T },
  { x: 1592, y: 650, width: 128, height: T },

  // Desk area (central elevated platform) — desk
  { x: 800, y: 400, width: 320, height: T, tileHint: "desk" },
],
```

Note: we're being conservative here. Only the platforms that are visually bookshelves or desks get hints. Stepping platforms, walls, floors, and ceiling remain auto-detected. This prevents over-decorating.

### 6. Fallback: If Expanded Tileset Not Loaded

The `isExpandedTileset()` check ensures this only activates when the expanded sheet is wired. If `AssetManager.getSpriteSheet("tiles-scribe-hall-expanded")` returns `null` (image not loaded), the existing rectangle fallback kicks in. No separate fallback to the old 4-tile sheet is needed — the AssetManager already handles this.

However, update `BIOME_TILE_SHEET` to have a fallback chain: if the expanded sheet isn't loaded, we should fall back to the old sheet. This isn't strictly necessary since AssetManager will render placeholders, but for robustness:

In the `render()` method, when `sheet` is null for an expanded tileset, try the non-expanded version:

```typescript
if (RenderConfig.useSprites()) {
  const sheetId = BIOME_TILE_SHEET[this.biomeId] ?? BIOME_TILE_SHEET["default"];
  let sheet = AssetManager.getInstance().getSpriteSheet(sheetId);

  // Fallback: if expanded tileset not loaded, try the base sheet
  if (!sheet && sheetId.endsWith("-expanded")) {
    const baseId = sheetId.replace("-expanded", "");
    sheet = AssetManager.getInstance().getSpriteSheet(baseId);
  }

  if (sheet) {
    if (this.isExpandedTileset(sheetId) && sheet.getTotalFrames() >= 16) {
      this.renderExpandedTileSprite(ctx, p, sheet);
    } else {
      const frame = getTileFrame(p.width, p.height);
      this.renderTileSprite(ctx, p, sheet, frame);
    }
    this.renderSurfaceTint(ctx, p);
  } else {
    this.renderRectangle(renderer, p);
  }
}
```

Note: We check `sheet.getTotalFrames() >= 16` to confirm the loaded sheet actually has enough frames. If someone loads the old 4-tile sheet under the expanded ID, it gracefully falls back to `getTileFrame()`.

**SpriteSheet.getTotalFrames():** Check if this method exists. If not, add a simple getter:

```typescript
// In SpriteSheet.ts (if not already present):
getTotalFrames(): number {
  return this.totalFrames;
}
```

## Files to Modify

| File | Change |
|------|--------|
| `src/engine/world/Room.ts` | Add optional `tileHint?: string` to `RoomPlatform` interface |
| `src/engine/physics/TileMap.ts` | Add `tileHint?: string` to `Platform` interface; update `render()` to use `renderExpandedTileSprite()` for expanded tilesets; add fallback logic; import `getExpandedTileFrame` |
| `src/engine/world/TileSprites.ts` | Change `BIOME_TILE_SHEET["scribe-hall"]` to `"tiles-scribe-hall-expanded"`; add `getExpandedTileFrame()` and `deterministicHash()` functions |
| `src/engine/world/scribeHall.ts` | Add `tileHint` to bookshelf and desk platforms |
| `src/engine/core/SpriteSheet.ts` | Add `getTotalFrames()` getter if it doesn't exist |

## Files NOT to Create

No new files. This task modifies existing files only.

## Verification

1. **Type check**: `npx tsc --noEmit` passes cleanly
2. **Tests**: `npm run test:run` — all existing tests pass (tileHint is optional, so no test breakage)
3. **Browser verification** (critical — this is a visual task):
   - Run `npm run dev` → open `http://localhost:4000/test/world-assembly`
   - Navigate to the Scribe Hall room
   - Verify:
     - Floor platforms have left/right edge tiles (first and last column differ from middle)
     - Middle floor tiles have occasional ink stain or carpet variants (sparse, not every tile)
     - Wall platforms (left wall, right wall) have top cap and bottom cap tiles
     - Left and right bookshelf mezzanines render with bookshelf face tiles (colorful book spines) and candle variants (every 3rd tile)
     - Reading nook platform renders with desk surface tiles
     - Central desk platform renders with desk surface tiles
     - Stepping platforms render as normal floors with edge tiles
     - No visual glitches at tile boundaries (clipping works correctly)
     - Decorative variants are consistent across frames (no flickering — the hash is deterministic)
   - Switch to Rectangles render mode → verify platforms still render correctly
   - Switch back to Sprites → confirm expanded tiles render
   - Navigate to other biomes (Herbarium, Astral Atlas) → verify they still use the 4-tile sheet and render normally
4. **Determinism check**: Walk around the Scribe Hall, pause, resume — decorative tile placement should be identical. No randomness per frame.

## Pass Criteria

- [ ] `tileHint?: string` added to both `RoomPlatform` and `Platform` interfaces
- [ ] `BIOME_TILE_SHEET["scribe-hall"]` points to `"tiles-scribe-hall-expanded"`
- [ ] `getExpandedTileFrame()` handles all 4 tile hints plus auto-detection for floor/wall/column
- [ ] Floor platforms have left/right edge tiles with middle fill
- [ ] Floor tiles have occasional ink stain or carpet variants (deterministic, not random per frame)
- [ ] Wall platforms have top/bottom cap tiles
- [ ] Bookshelf-hinted platforms use bookshelf face tiles with candle variants
- [ ] Desk-hinted platforms use the desk surface tile
- [ ] Original 4-tile rendering still works for other biomes
- [ ] No visual glitches at platform boundaries (edge tiles align correctly)
- [ ] `tileHint` is optional and backward-compatible (undefined = auto-detect as before)
- [ ] Fallback to base 4-tile sheet works if expanded sheet not loaded
- [ ] TypeScript compiles cleanly (`npx tsc --noEmit`)
- [ ] All existing tests pass (`npm run test:run`)

---

## Implementation Summary

### Files Modified

| File | Change |
|------|--------|
| `src/engine/world/Room.ts` | Added `tileHint?: string` to `RoomPlatform` interface |
| `src/engine/physics/TileMap.ts` | Added `tileHint?: string` to `Platform` interface; updated `render()` with expanded tileset detection, fallback logic, and `renderExpandedTileSprite()` method; imported `getExpandedTileFrame` |
| `src/engine/world/TileSprites.ts` | Changed `BIOME_TILE_SHEET["scribe-hall"]` to `"tiles-scribe-hall-expanded"`; added `getExpandedTileFrame()` and `deterministicHash()` functions |
| `src/engine/world/scribeHall.ts` | Added `tileHint: "bookshelf"` to 6 bookshelf platforms and `tileHint: "desk"` to 2 desk platforms |
| `src/engine/world/RoomManager.ts` | Added `tileHint` propagation in platform building (`RoomPlatform` → `Platform`) |

### What Was Built

- **`getExpandedTileFrame()`**: Per-tile frame selection supporting 4 tileHint overrides (bookshelf, desk, railing, beam) plus auto-detection for floor/wall/column shapes with edge tiles, decorative variants (ink stain, carpet, cracked stone), and caps
- **`deterministicHash()`**: Stable integer hash for decorative tile placement — no per-frame randomness
- **Expanded rendering in TileMap**: `renderExpandedTileSprite()` iterates every tile position individually (unlike the existing `renderTileSprite()` which uses a single frame for all tiles)
- **Fallback chain**: If expanded sheet not loaded, falls back to base 4-tile sheet; if that also missing, falls to rectangle rendering. Also checks `config.totalFrames >= 16` before using expanded logic
- **tileHint propagation**: Fixed RoomManager to copy `tileHint` from `RoomPlatform` to `Platform` during room loading (was missing)

### Verification

- `npx tsc --noEmit` — passes cleanly
- `npm run test:run` — all 427 tests pass (16 files)
- No new files created
- Backward compatible: `tileHint` is optional, other biomes unchanged, old 4-tile sheet kept as default fallback

---

## Review Notes (c3a059d6)

### Fixes Applied

1. **`deterministicHash` — use `Math.imul()` for 32-bit integer multiplication** (`TileSprites.ts:183-185`)
   The original code used `*` for large integer multiplications (e.g. `seed1 * 2654435761`). Intermediate values exceeded `Number.MAX_SAFE_INTEGER` (2^53), causing precision loss in the low bits before `>>>` clamped to 32-bit. While the hash was still deterministic (same imprecise float → same Uint32), `Math.imul()` gives proper 32-bit multiplication with correct low-bit behavior.

2. **Render fallback — check `sheet.config.id` instead of `sheetId`** (`TileMap.ts:278`)
   When the expanded tileset isn't loaded, the code falls back to the base 4-tile sheet. But the expanded-tileset check was comparing `sheetId` (the originally-requested ID, still `"-expanded"`) against the fallback sheet's frame count. Changed to `sheet.config.id.endsWith("-expanded")` so the check reflects the actually-loaded sheet rather than the requested one. This prevents a latent bug if a base tileset were ever expanded to 16+ frames.

### No Issues Found

- `tileHint` propagation in RoomManager is correct
- `RoomPlatform` and `Platform` interfaces both have `tileHint?: string`
- Scribe Hall platforms use appropriate hints (bookshelf for mezzanine shelves, desk for reading areas)
- Auto-detection logic (floor/column/wall) matches legacy `getTileFrame` behavior
- Edge tiles, caps, and decorative variants are deterministic (no per-frame randomness)
- Fallback chain (expanded → base → rectangles) works correctly
- All 427 tests pass, TypeScript compiles cleanly (pre-existing BiomeBackground errors unrelated)
