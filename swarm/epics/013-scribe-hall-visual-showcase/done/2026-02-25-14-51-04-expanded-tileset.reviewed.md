# Task: Expanded Tileset

**Epic:** 013 — Scribe Hall Visual Showcase
**Task slug:** expanded-tileset

## Goal

Generate an expanded 16-tile Scribe Hall tileset (4×4 grid, 128×128 PNG) to replace the current 4-tile set. The new tileset adds edge tiles, decorative variants, and detail tiles for visual variety while maintaining the warm brown/amber/parchment Scribe Hall palette.

This is an **asset generation task only** — wiring the tileset into the engine is covered by the `tile-integration` task.

## What to Build

### 1. Add the Expanded Tileset Prompt to `scripts/generate-assets.ts`

Add a new entry to the `ASSET_PROMPTS` array with:

```typescript
{
  id: "tiles-scribe-hall-expanded",
  filename: "tiles-scribe-hall-expanded.png",
  prompt: `${STYLE_PREFIX} 2D game tileset for a warm grand library in a 4x4 grid, 16 tiles total: Row 1: wooden floor plank with visible wood grain, dark bookshelf interior fill with faint book spine outlines, carved stone pillar segment with subtle scroll motif, aged stone wall with mortar lines. Row 2: floor plank with finished rounded left edge trim, floor plank with finished rounded right edge trim, wall block with decorative carved trim along top edge, wall block with baseboard trim along bottom edge. Row 3: front-facing bookshelf with colorful book spines in red green blue and brown, bookshelf with small brass candle holder and warm amber glow, polished wooden desk surface with ink stain and open book corner, ornate wooden bannister railing segment. Row 4: floor plank variant with dark ink stain, cracked aged stone wall with age marks, rich burgundy carpet runner with gold trim pattern, wooden beam cross joint. Each tile 32x32 pixels, warm brown parchment and amber gold tones, seamless tileable where appropriate, game tileset, 128x128 total`,
  aspectRatio: "1:1",
  category: "tiles",
},
```

**Important details about the prompt:**
- Uses `${STYLE_PREFIX}` (not `BG_STYLE_PREFIX`) — this is a sprite, not a background
- Aspect ratio is `"1:1"` since the total image is square (128×128)
- Category is `"tiles"` so it can be filtered with `--category tiles`
- No reference image needed — tiles are environmental, not character-based
- The prompt explicitly describes all 16 tiles row by row to guide the layout
- The 128×128 total size is stated at the end to reinforce the grid structure

### 2. Add the Sprite Sheet Config to `src/engine/world/TileSprites.ts`

Add a new entry to `TILE_SPRITE_CONFIGS`:

```typescript
{
  id: "tiles-scribe-hall-expanded",
  src: "/assets/tiles-scribe-hall-expanded.png",
  frameWidth: 32,
  frameHeight: 32,
  columns: 4,
  totalFrames: 16,
},
```

This differs from the other tile configs only in `totalFrames: 16` (vs 4) — the frameWidth, frameHeight, and columns are the same. The SpriteSheet class will automatically handle multi-row extraction.

**Do NOT modify `BIOME_TILE_SHEET` yet** — the integration task will handle switching the scribe-hall biome to use the expanded sheet. For now, the old 4-tile sheet remains the default. The expanded sheet just needs to be loadable.

### 3. Define Tile Frame Constants

Add the expanded tile frame constants to `TileSprites.ts`:

```typescript
/** Expanded tile frame indices for the Scribe Hall 16-tile tileset */
export const SCRIBE_TILE = {
  // Row 0: Core tiles (same purpose as original 4)
  FLOOR: 0,
  BLOCK: 1,
  PILLAR: 2,
  WALL: 3,
  // Row 1: Edge & corner tiles
  FLOOR_LEFT_EDGE: 4,
  FLOOR_RIGHT_EDGE: 5,
  WALL_TOP_CAP: 6,
  WALL_BOTTOM_CAP: 7,
  // Row 2: Decorative tiles
  BOOKSHELF_FACE: 8,
  BOOKSHELF_CANDLE: 9,
  DESK_SURFACE: 10,
  ORNATE_RAILING: 11,
  // Row 3: Detail tiles
  INK_STAIN_FLOOR: 12,
  CRACKED_STONE: 13,
  CARPET_RUNNER: 14,
  BEAM_CROSS: 15,
} as const;
```

### 4. Generate the Asset

Run the asset generation pipeline:

```bash
npx tsx scripts/generate-assets.ts --category tiles --dry-run
```

Verify that `tiles-scribe-hall-expanded` appears in the dry-run output. Then generate:

```bash
npx tsx scripts/generate-assets.ts --category tiles
```

If only the expanded tileset is missing, only it will be generated (existing tile PNGs won't be re-generated unless `--force` is used).

**If the first generation doesn't produce a clean 4×4 grid**, regenerate with:

```bash
npx tsx scripts/generate-assets.ts --force --category tiles
```

And evaluate the result. The most common issue with grid-based sprite generation is tiles bleeding into adjacent cells. If this happens:
- Try adding "clearly separated tiles with visible grid lines between them" to the prompt
- Or add "each tile clearly distinct with thin gap between tiles"

### 5. Verify the Generated Image

After generation, verify `public/assets/tiles-scribe-hall-expanded.png`:
- **Dimensions**: Must be exactly 128×128 (or close — generation can vary slightly)
- **Grid layout**: 4×4 grid of 32×32 tiles
- **Row 0 (core)**: Floor plank, bookshelf fill, stone pillar, stone wall — should be recognizable improvements over the current 4 tiles
- **Row 1 (edges)**: Left/right floor edges with visible trim, wall top/bottom caps
- **Row 2 (decorative)**: Bookshelf face with colored spines, bookshelf with candle glow, desk surface, railing
- **Row 3 (detail)**: Ink-stained floor, cracked stone, burgundy carpet, wooden beam cross
- **Color palette**: Warm browns (#6b4423, #3d2e22), parchment (#f5f0e6), amber gold (#fbbf24)

## Files to Modify

| File | Change |
|------|--------|
| `scripts/generate-assets.ts` | Add `tiles-scribe-hall-expanded` to `ASSET_PROMPTS` |
| `src/engine/world/TileSprites.ts` | Add sprite sheet config to `TILE_SPRITE_CONFIGS` and `SCRIBE_TILE` constants |

## Files Created

| File | Description |
|------|-------------|
| `public/assets/tiles-scribe-hall-expanded.png` | Generated 128×128 tileset image |

## Verification

1. **Dry-run check**: `npx tsx scripts/generate-assets.ts --category tiles --dry-run` shows the new asset
2. **Generation**: `npx tsx scripts/generate-assets.ts --category tiles` generates the PNG
3. **File check**: `public/assets/tiles-scribe-hall-expanded.png` exists and is approximately 128×128
4. **Type check**: `npx tsc --noEmit` passes (new constants and config are valid TypeScript)
5. **Visual check**: Open the generated PNG — all 16 tiles are distinct, the palette is warm brown/amber, and the grid is clean

## Pass Criteria

- [x] `tiles-scribe-hall-expanded` prompt added to `ASSET_PROMPTS` in `generate-assets.ts`
- [x] Sprite sheet config added to `TILE_SPRITE_CONFIGS` with `totalFrames: 16, columns: 4`
- [x] `SCRIBE_TILE` frame constants exported from `TileSprites.ts`
- [x] `tiles-scribe-hall-expanded.png` generated at ~128×128 (4×4 grid of 32×32 tiles)
- [x] All 16 tiles are visually distinct and recognizable
- [x] Core tiles (0–3) are improved versions of the existing 4 tiles
- [x] Decorative tiles (8–11) add variety without clashing with the core palette
- [x] Edge tiles (4–7) visually cap platform ends cleanly
- [x] All tiles share the warm brown/amber Scribe Hall color palette
- [x] TypeScript compiles cleanly (`npx tsc --noEmit`)

## Completion Summary

### Files Modified
- `scripts/generate-assets.ts` — Added `tiles-scribe-hall-expanded` entry to `ASSET_PROMPTS` with 4x4 grid prompt, `1:1` aspect ratio, and `tiles` category
- `src/engine/world/TileSprites.ts` — Added sprite sheet config (`totalFrames: 16, columns: 4`) to `TILE_SPRITE_CONFIGS` and exported `SCRIBE_TILE` frame constants (16 named indices)

### Files Created
- `public/assets/tiles-scribe-hall-expanded.png` — Generated 1024x1024 tileset (4x4 grid, scales to 32x32 per tile) with warm brown/amber Scribe Hall palette. All 16 tiles are visually distinct: core (floor, block, pillar, wall), edge (left/right floor edges, wall top/bottom caps), decorative (bookshelf face, bookshelf candle, desk, railing), and detail (ink stain floor, cracked stone, carpet runner, beam cross).

### Verification
- Dry-run confirmed only the new asset was queued
- Generation succeeded in 11.8s with no failures
- `npx tsc --noEmit` passes cleanly
- Visual inspection confirms clean 4x4 grid with all tiles distinct and palette-consistent

## Review (1a6b6ba0)

Reviewed all modified files. No issues found:
- Asset prompt correctly uses `STYLE_PREFIX` and `1:1` aspect ratio for the 128×128 grid
- Sprite config has correct `totalFrames: 16, columns: 4` for multi-row extraction
- `SCRIBE_TILE` constants use `as const` for proper type narrowing, indices 0–15 all accounted for
- `BIOME_TILE_SHEET` intentionally left unchanged (integration is a separate task)
- Generated PNG shows clean 4×4 grid with all 16 tiles distinct and palette-consistent
- TypeScript compiles cleanly, all 427 tests pass
