// TileSprites — tile sprite sheet configs, biome mapping, frame indices, surface tint

import type { SpriteSheetConfig } from "@/engine/core/SpriteSheet";
import { AssetManager } from "@/engine/core/AssetManager";

// ─── Sprite Sheet Configs ────────────────────────────────────────────

export const TILE_SPRITE_CONFIGS: SpriteSheetConfig[] = [
  {
    id: "tiles-scribe-hall",
    src: "/assets/tiles-scribe-hall.png",
    frameWidth: 32,
    frameHeight: 32,
    columns: 4,
    totalFrames: 4,
  },
  {
    id: "tiles-herbarium-folio",
    src: "/assets/tiles-herbarium-folio.png",
    frameWidth: 32,
    frameHeight: 32,
    columns: 4,
    totalFrames: 4,
  },
  {
    id: "tiles-astral-atlas",
    src: "/assets/tiles-astral-atlas.png",
    frameWidth: 32,
    frameHeight: 32,
    columns: 4,
    totalFrames: 4,
  },
  {
    id: "tiles-maritime-ledger",
    src: "/assets/tiles-maritime-ledger.png",
    frameWidth: 32,
    frameHeight: 32,
    columns: 4,
    totalFrames: 4,
  },
  {
    id: "tiles-gothic-errata",
    src: "/assets/tiles-gothic-errata.png",
    frameWidth: 32,
    frameHeight: 32,
    columns: 4,
    totalFrames: 4,
  },
  {
    id: "tiles-scribe-hall-expanded",
    src: "/assets/tiles-scribe-hall-expanded.png",
    frameWidth: 32,
    frameHeight: 32,
    columns: 4,
    totalFrames: 16,
  },
];

// ─── Biome → Tile Sheet Mapping ──────────────────────────────────────

export const BIOME_TILE_SHEET: Record<string, string> = {
  "scribe-hall": "tiles-scribe-hall-expanded",
  "herbarium-folio": "tiles-herbarium-folio",
  "astral-atlas": "tiles-astral-atlas",
  "maritime-ledger": "tiles-maritime-ledger",
  "gothic-errata": "tiles-gothic-errata",
  default: "tiles-scribe-hall",
};

// ─── Tile Frame Indices ──────────────────────────────────────────────

export const TILE_FRAME = {
  FLOOR: 0,
  BLOCK: 1,
  COLUMN: 2,
  WALL: 3,
} as const;

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

// ─── Surface Overlay Tints ───────────────────────────────────────────

export const SURFACE_TINT: Record<string, string | null> = {
  normal: null,
  bouncy: "#f472b680",   // pink, 50% alpha
  icy: "#67e8f940",      // cyan, 25% alpha
  sticky: "#a78bfa60",   // purple, 37% alpha
  conveyor: "#fb923c60", // orange, 37% alpha
};

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Determine which tile frame to use based on platform dimensions.
 * Thin platforms use FLOOR, tall narrow ones use COLUMN, otherwise BLOCK.
 */
export function getTileFrame(width: number, height: number): number {
  if (height <= 40) return TILE_FRAME.FLOOR;
  if (width <= 40 && height > 80) return TILE_FRAME.COLUMN;
  if (width >= height * 3) return TILE_FRAME.FLOOR;
  return TILE_FRAME.BLOCK;
}

/**
 * Determine the tile frame for a specific grid position within a platform
 * using the expanded 16-tile Scribe Hall tileset.
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

  if (isFloor) {
    if (totalCols > 1 && col === 0) return SCRIBE_TILE.FLOOR_LEFT_EDGE;
    if (totalCols > 1 && col === totalCols - 1) return SCRIBE_TILE.FLOOR_RIGHT_EDGE;
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
  const wallHash = deterministicHash(platform.height, row);
  if (wallHash % 5 === 0) return SCRIBE_TILE.CRACKED_STONE;
  return SCRIBE_TILE.WALL;
}

/**
 * Simple deterministic hash for decorative tile placement.
 * Must be stable across frames — no Math.random().
 */
export function deterministicHash(seed1: number, seed2: number): number {
  let h = Math.imul(seed1, 2654435761) ^ Math.imul(seed2, 340573321);
  h = Math.imul((h >>> 16) ^ h, 0x45d9f3b);
  h = Math.imul((h >>> 16) ^ h, 0x45d9f3b);
  h = (h >>> 16) ^ h;
  return Math.abs(h);
}

/** Load all tile sprite sheets via AssetManager */
export async function loadTileSprites(): Promise<void> {
  const assetManager = AssetManager.getInstance();
  await assetManager.loadAll(TILE_SPRITE_CONFIGS);
}
