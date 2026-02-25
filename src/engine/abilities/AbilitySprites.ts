import type { SpriteSheetConfig, AnimationDef } from "@/engine/core/SpriteSheet";

// ─── Margin Stitch VFX Sprite Sheets ────────────────────────────────────────

const STITCH_LINE_CONFIG: SpriteSheetConfig = {
  id: "vfx-stitch-line",
  src: "/assets/vfx-stitch-line-sheet.png",
  frameWidth: 64,
  frameHeight: 16,
  columns: 4,
  totalFrames: 4,
};

const STITCH_NEEDLE_CONFIG: SpriteSheetConfig = {
  id: "vfx-stitch-needle",
  src: "/assets/vfx-stitch-needle-sheet.png",
  frameWidth: 32,
  frameHeight: 32,
  columns: 3,
  totalFrames: 3,
};

// ─── Redaction VFX Sprite Sheets ────────────────────────────────────────────

const REDACTION_SPLAT_CONFIG: SpriteSheetConfig = {
  id: "vfx-redaction-splat",
  src: "/assets/vfx-redaction-splat-sheet.png",
  frameWidth: 64,
  frameHeight: 64,
  columns: 4,
  totalFrames: 4,
};

const REDACTION_DRIP_CONFIG: SpriteSheetConfig = {
  id: "vfx-redaction-drip",
  src: "/assets/vfx-redaction-drip-sheet.png",
  frameWidth: 16,
  frameHeight: 32,
  columns: 3,
  totalFrames: 3,
};

const REDACTION_BAR_CONFIG: SpriteSheetConfig = {
  id: "vfx-redaction-bar",
  src: "/assets/vfx-redaction-bar-sheet.png",
  frameWidth: 64,
  frameHeight: 16,
  columns: 2,
  totalFrames: 2,
};

// ─── Paste-Over VFX Sprite Sheets ───────────────────────────────────────────

const PASTE_GLOW_CONFIG: SpriteSheetConfig = {
  id: "vfx-paste-glow",
  src: "/assets/vfx-paste-glow-sheet.png",
  frameWidth: 64,
  frameHeight: 32,
  columns: 4,
  totalFrames: 4,
};

const PASTE_SWOOSH_CONFIG: SpriteSheetConfig = {
  id: "vfx-paste-swoosh",
  src: "/assets/vfx-paste-swoosh-sheet.png",
  frameWidth: 48,
  frameHeight: 48,
  columns: 3,
  totalFrames: 3,
};

// ─── Index Mark VFX Sprite Sheets ───────────────────────────────────────────

const BOOKMARK_CONFIG: SpriteSheetConfig = {
  id: "vfx-bookmark",
  src: "/assets/vfx-bookmark-sheet.png",
  frameWidth: 16,
  frameHeight: 24,
  columns: 4,
  totalFrames: 4,
};

const TELEPORT_FLASH_CONFIG: SpriteSheetConfig = {
  id: "vfx-teleport-flash",
  src: "/assets/vfx-teleport-flash-sheet.png",
  frameWidth: 64,
  frameHeight: 64,
  columns: 4,
  totalFrames: 4,
};

const INDEX_RING_CONFIG: SpriteSheetConfig = {
  id: "vfx-index-ring",
  src: "/assets/vfx-index-ring-sheet.png",
  frameWidth: 48,
  frameHeight: 48,
  columns: 4,
  totalFrames: 4,
};

// ─── All Ability VFX Sprite Configs ─────────────────────────────────────────

export const ABILITY_VFX_SPRITE_CONFIGS: SpriteSheetConfig[] = [
  STITCH_LINE_CONFIG,
  STITCH_NEEDLE_CONFIG,
  REDACTION_SPLAT_CONFIG,
  REDACTION_DRIP_CONFIG,
  REDACTION_BAR_CONFIG,
  PASTE_GLOW_CONFIG,
  PASTE_SWOOSH_CONFIG,
  BOOKMARK_CONFIG,
  TELEPORT_FLASH_CONFIG,
  INDEX_RING_CONFIG,
];

// ─── Animation Definitions ──────────────────────────────────────────────────

export const ABILITY_VFX_ANIMATIONS: Record<string, AnimationDef[]> = {
  "vfx-stitch-line": [
    { name: "stitch-pulse", frames: [0, 1, 2, 3], fps: 6, loop: true },
  ],
  "vfx-stitch-needle": [
    { name: "needle-flash", frames: [0, 1, 2], fps: 12, loop: false },
  ],
  "vfx-redaction-splat": [
    { name: "splat-expand", frames: [0, 1, 2, 3], fps: 8, loop: false },
  ],
  "vfx-redaction-drip": [
    { name: "drip", frames: [0, 1, 2], fps: 4, loop: true },
  ],
  "vfx-redaction-bar": [
    { name: "bar-pulse", frames: [0, 1], fps: 3, loop: true },
  ],
  "vfx-paste-glow": [
    { name: "surface-pulse", frames: [0, 1, 2, 3], fps: 4, loop: true },
  ],
  "vfx-paste-swoosh": [
    { name: "copy-swoosh", frames: [0, 1, 2], fps: 10, loop: false },
  ],
  // vfx-bookmark: no animations — use frame index directly (0=amber, 1=blue, 2=green, 3=red)
  "vfx-teleport-flash": [
    { name: "teleport-in", frames: [0, 1, 2, 3], fps: 12, loop: false },
    { name: "teleport-out", frames: [3, 2, 1, 0], fps: 12, loop: false },
  ],
  "vfx-index-ring": [
    { name: "spin", frames: [0, 1, 2, 3], fps: 8, loop: true },
  ],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

export function getAbilityVfxConfigs(): SpriteSheetConfig[] {
  return ABILITY_VFX_SPRITE_CONFIGS;
}

export function getAbilityVfxAnimations(): Record<string, AnimationDef[]> {
  return ABILITY_VFX_ANIMATIONS;
}
