import type { SpriteSheetConfig, AnimationDef } from "@/engine/core/SpriteSheet";

/** Player sprite sheet configurations — 9 sheets covering all 10 states + 2 attack overlays */
export const PLAYER_SPRITE_CONFIGS: SpriteSheetConfig[] = [
  {
    id: "player-idle",
    src: "/assets/player-idle.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 4,
    totalFrames: 4,
  },
  {
    id: "player-run",
    src: "/assets/player-run-sheet.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 6,
    totalFrames: 6,
  },
  {
    id: "player-jump",
    src: "/assets/player-jump-sheet.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 3,
    totalFrames: 3,
  },
  {
    id: "player-dash",
    src: "/assets/player-dash-sheet.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 3,
    totalFrames: 3,
  },
  {
    id: "player-wall-slide",
    src: "/assets/player-wall-slide-sheet.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 2,
    totalFrames: 2,
  },
  {
    id: "player-crouch",
    src: "/assets/player-crouch-sheet.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 2,
    totalFrames: 2,
  },
  {
    id: "player-land",
    src: "/assets/player-land-sheet.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 3,
    totalFrames: 3,
  },
  {
    id: "player-attack-spear",
    src: "/assets/player-attack-spear-sheet.png",
    frameWidth: 96,
    frameHeight: 64,
    columns: 4,
    totalFrames: 4,
  },
  {
    id: "player-attack-snap",
    src: "/assets/player-attack-snap-sheet.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 3,
    totalFrames: 3,
  },
];

/** Animation definitions per sprite sheet */
export const PLAYER_ANIMATIONS: Record<string, AnimationDef[]> = {
  "player-idle": [
    { name: "idle", frames: [0, 1, 2, 3], fps: 6, loop: true },
  ],
  "player-run": [
    { name: "run", frames: [0, 1, 2, 3, 4, 5], fps: 10, loop: true },
  ],
  "player-jump": [
    { name: "jump-rise", frames: [0], fps: 1, loop: false },
    { name: "jump-apex", frames: [1], fps: 1, loop: false },
    { name: "jump-fall", frames: [2], fps: 1, loop: false },
  ],
  "player-dash": [
    { name: "dash", frames: [0, 1, 2], fps: 15, loop: false },
  ],
  "player-wall-slide": [
    { name: "wall-slide", frames: [0, 1], fps: 4, loop: true },
  ],
  "player-crouch": [
    { name: "crouch", frames: [0], fps: 1, loop: false },
    { name: "crouch-slide", frames: [1], fps: 1, loop: false },
  ],
  "player-land": [
    { name: "hard-land", frames: [0, 1, 2], fps: 8, loop: false },
  ],
  "player-attack-spear": [
    { name: "attack-spear", frames: [0, 1, 2, 3], fps: 12, loop: false },
  ],
  "player-attack-snap": [
    { name: "attack-snap", frames: [0, 1, 2], fps: 10, loop: false },
  ],
};

/**
 * Map player state machine state -> animation name + which sprite sheet to use.
 * Every state has a dedicated animation (no fallbacks).
 */
export const STATE_TO_ANIMATION: Record<string, { sheetId: string; animName: string }> = {
  IDLE:           { sheetId: "player-idle",       animName: "idle" },
  RUNNING:        { sheetId: "player-run",        animName: "run" },
  JUMPING:        { sheetId: "player-jump",       animName: "jump-rise" },
  FALLING:        { sheetId: "player-jump",       animName: "jump-fall" },
  WALL_SLIDING:   { sheetId: "player-wall-slide", animName: "wall-slide" },
  WALL_JUMPING:   { sheetId: "player-jump",       animName: "jump-rise" },
  DASHING:        { sheetId: "player-dash",       animName: "dash" },
  CROUCHING:      { sheetId: "player-crouch",     animName: "crouch" },
  CROUCH_SLIDING: { sheetId: "player-crouch",     animName: "crouch-slide" },
  HARD_LANDING:   { sheetId: "player-land",       animName: "hard-land" },
};

/**
 * Map weapon type -> attack overlay animation.
 * For future combat sprite integration — the CombatSystem or test page
 * will use this to play attack animations overlaid on the player's movement animation.
 */
export const ATTACK_TO_ANIMATION: Record<string, { sheetId: string; animName: string }> = {
  "quill-spear": { sheetId: "player-attack-spear", animName: "attack-spear" },
  "ink-snap":    { sheetId: "player-attack-snap",   animName: "attack-snap" },
};
