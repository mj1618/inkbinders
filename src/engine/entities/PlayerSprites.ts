import type { SpriteSheetConfig, AnimationDef } from "@/engine/core/SpriteSheet";

/** Player sprite sheet configurations */
export const PLAYER_SPRITE_CONFIGS: SpriteSheetConfig[] = [
  {
    id: "player-idle",
    src: "/assets/player-idle.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 1,
    totalFrames: 1,
  },
  {
    id: "player-run",
    src: "/assets/player-run-sheet.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 4,
    totalFrames: 4,
  },
  {
    id: "player-jump",
    src: "/assets/player-jump-sheet.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 3,
    totalFrames: 3,
  },
];

/** Animation definitions per sprite sheet */
export const PLAYER_ANIMATIONS: Record<string, AnimationDef[]> = {
  "player-idle": [
    { name: "idle", frames: [0], fps: 1, loop: true },
  ],
  "player-run": [
    { name: "run", frames: [0, 1, 2, 3], fps: 10, loop: true },
  ],
  "player-jump": [
    { name: "jump-rise", frames: [0], fps: 1, loop: false },
    { name: "jump-apex", frames: [1], fps: 1, loop: false },
    { name: "jump-fall", frames: [2], fps: 1, loop: false },
  ],
};

/**
 * Map player state machine state -> animation name + which sprite sheet to use.
 * The test page uses this to drive the AnimationController.
 */
export const STATE_TO_ANIMATION: Record<string, { sheetId: string; animName: string }> = {
  IDLE: { sheetId: "player-idle", animName: "idle" },
  RUNNING: { sheetId: "player-run", animName: "run" },
  JUMPING: { sheetId: "player-jump", animName: "jump-rise" },
  FALLING: { sheetId: "player-jump", animName: "jump-fall" },
  WALL_SLIDING: { sheetId: "player-idle", animName: "idle" },
  WALL_JUMPING: { sheetId: "player-jump", animName: "jump-rise" },
  DASHING: { sheetId: "player-run", animName: "run" },
  CROUCHING: { sheetId: "player-idle", animName: "idle" },
  CROUCH_SLIDING: { sheetId: "player-run", animName: "run" },
  HARD_LANDING: { sheetId: "player-idle", animName: "idle" },
};
