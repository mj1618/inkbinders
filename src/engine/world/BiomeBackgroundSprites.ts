// BiomeBackgroundSprites — sprite sheet configs for parallax background layers
//
// Each biome has 3 layers (far, mid, near) at 960×540 single-frame images.
// These render when RenderConfig.useSprites() is true, replacing the
// procedural rectangle backgrounds.

import type { SpriteSheetConfig } from "@/engine/core/SpriteSheet";
import { AssetManager } from "@/engine/core/AssetManager";

// ─── Layer Definition ───────────────────────────────────────────────

export interface BackgroundLayerDef {
  sheetId: string;
  parallaxFactor: number;
  description: string;
}

// ─── Per-Biome Layer Definitions ────────────────────────────────────

const SCRIBE_HALL_LAYERS: BackgroundLayerDef[] = [
  { sheetId: "bg-scribe-hall-far", parallaxFactor: 0.1, description: "Distant bookshelves, warm amber glow" },
  { sheetId: "bg-scribe-hall-mid", parallaxFactor: 0.3, description: "Candelabras, reading desks" },
  { sheetId: "bg-scribe-hall-near", parallaxFactor: 0.6, description: "Hanging scrolls, ink bottles" },
];

const HERBARIUM_FOLIO_LAYERS: BackgroundLayerDef[] = [
  { sheetId: "bg-herbarium-folio-far", parallaxFactor: 0.1, description: "Ruled notebook lines, faint leaf silhouettes" },
  { sheetId: "bg-herbarium-folio-mid", parallaxFactor: 0.3, description: "Botanical stems and leaf outlines" },
  { sheetId: "bg-herbarium-folio-near", parallaxFactor: 0.6, description: "Vine tendrils, curling plant forms" },
];

const ASTRAL_ATLAS_LAYERS: BackgroundLayerDef[] = [
  { sheetId: "bg-astral-atlas-far", parallaxFactor: 0.05, description: "Star field, distant galaxies" },
  { sheetId: "bg-astral-atlas-mid", parallaxFactor: 0.15, description: "Floating constellation charts" },
  { sheetId: "bg-astral-atlas-near", parallaxFactor: 0.4, description: "Drifting astral pages, nebula wisps" },
];

const MARITIME_LEDGER_LAYERS: BackgroundLayerDef[] = [
  { sheetId: "bg-maritime-ledger-far", parallaxFactor: 0.1, description: "Distant harbor, lighthouse silhouettes" },
  { sheetId: "bg-maritime-ledger-mid", parallaxFactor: 0.3, description: "Moored ships, rope rigging" },
  { sheetId: "bg-maritime-ledger-near", parallaxFactor: 0.6, description: "Wave spray, floating cargo" },
];

const GOTHIC_ERRATA_LAYERS: BackgroundLayerDef[] = [
  { sheetId: "bg-gothic-errata-far", parallaxFactor: 0.05, description: "Cathedral spires, dark stormy sky" },
  { sheetId: "bg-gothic-errata-mid", parallaxFactor: 0.2, description: "Broken stained glass panels" },
  { sheetId: "bg-gothic-errata-near", parallaxFactor: 0.5, description: "Drifting fog wisps, iron grates" },
];

// ─── Aggregated Maps ────────────────────────────────────────────────

export const BIOME_BACKGROUND_LAYERS: Record<string, BackgroundLayerDef[]> = {
  "scribe-hall": SCRIBE_HALL_LAYERS,
  "herbarium-folio": HERBARIUM_FOLIO_LAYERS,
  "astral-atlas": ASTRAL_ATLAS_LAYERS,
  "maritime-ledger": MARITIME_LEDGER_LAYERS,
  "gothic-errata": GOTHIC_ERRATA_LAYERS,
};

// ─── Sprite Sheet Configs ───────────────────────────────────────────

function makeConfig(sheetId: string): SpriteSheetConfig {
  return {
    id: sheetId,
    src: `/assets/backgrounds/${sheetId}.png`,
    frameWidth: 960,
    frameHeight: 540,
    columns: 1,
    totalFrames: 1,
  };
}

function buildConfigs(layers: BackgroundLayerDef[]): SpriteSheetConfig[] {
  return layers.map((l) => makeConfig(l.sheetId));
}

export const BIOME_BACKGROUND_CONFIGS: Record<string, SpriteSheetConfig[]> = {
  "scribe-hall": buildConfigs(SCRIBE_HALL_LAYERS),
  "herbarium-folio": buildConfigs(HERBARIUM_FOLIO_LAYERS),
  "astral-atlas": buildConfigs(ASTRAL_ATLAS_LAYERS),
  "maritime-ledger": buildConfigs(MARITIME_LEDGER_LAYERS),
  "gothic-errata": buildConfigs(GOTHIC_ERRATA_LAYERS),
};

// ─── Helpers ────────────────────────────────────────────────────────

/** Get sprite sheet configs for a specific biome */
export function getBiomeBackgroundConfigs(biomeId: string): SpriteSheetConfig[] {
  return BIOME_BACKGROUND_CONFIGS[biomeId] ?? [];
}

/** Get all background sprite sheet configs (for bulk loading) */
export function getAllBiomeBackgroundConfigs(): SpriteSheetConfig[] {
  return Object.values(BIOME_BACKGROUND_CONFIGS).flat();
}

/** Pre-load background sprite sheets for a biome */
export async function preloadBiomeBackground(biomeId: string): Promise<void> {
  const configs = getBiomeBackgroundConfigs(biomeId);
  if (configs.length > 0) {
    await AssetManager.getInstance().loadAll(configs);
  }
}
