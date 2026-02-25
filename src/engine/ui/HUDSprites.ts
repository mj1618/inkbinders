import type { SpriteSheetConfig } from "@/engine/core/SpriteSheet";

// ─── Heart Frame Indices ─────────────────────────────────────────────────────

export const HEART_FULL = 0;
export const HEART_HALF = 1;
export const HEART_EMPTY = 2;

// ─── HUD Sprite Sheet Configs ────────────────────────────────────────────────

export const HUD_SPRITE_CONFIGS: SpriteSheetConfig[] = [
  // Health hearts
  {
    id: "hud-health-heart",
    src: "/assets/hud-health-heart.png",
    frameWidth: 16,
    frameHeight: 16,
    columns: 3,
    totalFrames: 3,
  },

  // Ability icons (single-frame each)
  {
    id: "hud-ability-stitch",
    src: "/assets/hud-ability-stitch.png",
    frameWidth: 32,
    frameHeight: 32,
    columns: 1,
    totalFrames: 1,
  },
  {
    id: "hud-ability-redaction",
    src: "/assets/hud-ability-redaction.png",
    frameWidth: 32,
    frameHeight: 32,
    columns: 1,
    totalFrames: 1,
  },
  {
    id: "hud-ability-paste",
    src: "/assets/hud-ability-paste.png",
    frameWidth: 32,
    frameHeight: 32,
    columns: 1,
    totalFrames: 1,
  },
  {
    id: "hud-ability-index",
    src: "/assets/hud-ability-index.png",
    frameWidth: 32,
    frameHeight: 32,
    columns: 1,
    totalFrames: 1,
  },

  // Weapon icons
  {
    id: "hud-weapon-spear",
    src: "/assets/hud-weapon-spear.png",
    frameWidth: 32,
    frameHeight: 32,
    columns: 1,
    totalFrames: 1,
  },
  {
    id: "hud-weapon-snap",
    src: "/assets/hud-weapon-snap.png",
    frameWidth: 32,
    frameHeight: 32,
    columns: 1,
    totalFrames: 1,
  },

  // Sun/moon icons
  {
    id: "hud-sun",
    src: "/assets/hud-sun.png",
    frameWidth: 16,
    frameHeight: 16,
    columns: 1,
    totalFrames: 1,
  },
  {
    id: "hud-moon",
    src: "/assets/hud-moon.png",
    frameWidth: 16,
    frameHeight: 16,
    columns: 1,
    totalFrames: 1,
  },

  // Card category icons
  {
    id: "card-category-swiftness",
    src: "/assets/card-category-swiftness.png",
    frameWidth: 24,
    frameHeight: 24,
    columns: 1,
    totalFrames: 1,
  },
  {
    id: "card-category-might",
    src: "/assets/card-category-might.png",
    frameWidth: 24,
    frameHeight: 24,
    columns: 1,
    totalFrames: 1,
  },
  {
    id: "card-category-resilience",
    src: "/assets/card-category-resilience.png",
    frameWidth: 24,
    frameHeight: 24,
    columns: 1,
    totalFrames: 1,
  },
  {
    id: "card-category-precision",
    src: "/assets/card-category-precision.png",
    frameWidth: 24,
    frameHeight: 24,
    columns: 1,
    totalFrames: 1,
  },
  {
    id: "card-category-arcana",
    src: "/assets/card-category-arcana.png",
    frameWidth: 24,
    frameHeight: 24,
    columns: 1,
    totalFrames: 1,
  },

  // Card frame borders (one per tier)
  {
    id: "card-frame-tier1",
    src: "/assets/card-frame-tier1.png",
    frameWidth: 80,
    frameHeight: 110,
    columns: 1,
    totalFrames: 1,
  },
  {
    id: "card-frame-tier2",
    src: "/assets/card-frame-tier2.png",
    frameWidth: 80,
    frameHeight: 110,
    columns: 1,
    totalFrames: 1,
  },
  {
    id: "card-frame-tier3",
    src: "/assets/card-frame-tier3.png",
    frameWidth: 80,
    frameHeight: 110,
    columns: 1,
    totalFrames: 1,
  },

  // Title logo
  {
    id: "ui-title-logo",
    src: "/assets/ui-title-logo.png",
    frameWidth: 480,
    frameHeight: 120,
    columns: 1,
    totalFrames: 1,
  },

  // Menu button background
  {
    id: "ui-menu-button",
    src: "/assets/ui-menu-button.png",
    frameWidth: 200,
    frameHeight: 40,
    columns: 1,
    totalFrames: 1,
  },
];

// ─── Lookup Maps ─────────────────────────────────────────────────────────────

export const ABILITY_ICON_MAP: Record<string, string> = {
  "margin-stitch": "hud-ability-stitch",
  redaction: "hud-ability-redaction",
  "paste-over": "hud-ability-paste",
  "index-mark": "hud-ability-index",
};

export const WEAPON_ICON_MAP: Record<string, string> = {
  "quill-spear": "hud-weapon-spear",
  "ink-snap": "hud-weapon-snap",
};

export const CARD_CATEGORY_ICON_MAP: Record<string, string> = {
  swiftness: "card-category-swiftness",
  might: "card-category-might",
  resilience: "card-category-resilience",
  precision: "card-category-precision",
  arcana: "card-category-arcana",
};

export const CARD_FRAME_MAP: Record<number, string> = {
  1: "card-frame-tier1",
  2: "card-frame-tier2",
  3: "card-frame-tier3",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getHUDSpriteConfigs(): SpriteSheetConfig[] {
  return HUD_SPRITE_CONFIGS;
}
