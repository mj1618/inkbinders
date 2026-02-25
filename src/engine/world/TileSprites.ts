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
];

// ─── Biome → Tile Sheet Mapping ──────────────────────────────────────

export const BIOME_TILE_SHEET: Record<string, string> = {
  "scribe-hall": "tiles-scribe-hall",
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

/** Load all tile sprite sheets via AssetManager */
export async function loadTileSprites(): Promise<void> {
  const assetManager = AssetManager.getInstance();
  await assetManager.loadAll(TILE_SPRITE_CONFIGS);
}
