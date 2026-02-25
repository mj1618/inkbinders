import type { SpriteSheetConfig, AnimationDef } from "@/engine/core/SpriteSheet";

// ─── Reader Sprites (48×48 frames) ──────────────────────────────────────────

export const READER_SPRITE_CONFIGS: SpriteSheetConfig[] = [
  {
    id: "reader-idle",
    src: "/assets/reader-idle-sheet.png",
    frameWidth: 48,
    frameHeight: 48,
    columns: 2,
    totalFrames: 2,
  },
  {
    id: "reader-rush",
    src: "/assets/reader-rush-sheet.png",
    frameWidth: 48,
    frameHeight: 48,
    columns: 4,
    totalFrames: 4,
  },
  {
    id: "reader-hit",
    src: "/assets/reader-hit-sheet.png",
    frameWidth: 48,
    frameHeight: 48,
    columns: 2,
    totalFrames: 2,
  },
  {
    id: "reader-death",
    src: "/assets/reader-death-sheet.png",
    frameWidth: 48,
    frameHeight: 48,
    columns: 3,
    totalFrames: 3,
  },
];

export const READER_ANIMATIONS: Record<string, AnimationDef[]> = {
  "reader-idle": [
    { name: "idle", frames: [0, 1], fps: 4, loop: true },
  ],
  "reader-rush": [
    { name: "rush", frames: [0, 1, 2, 3], fps: 10, loop: true },
  ],
  "reader-hit": [
    { name: "hit", frames: [0, 1], fps: 6, loop: false },
  ],
  "reader-death": [
    { name: "death", frames: [0, 1, 2], fps: 6, loop: false },
  ],
};

export const READER_STATE_TO_ANIMATION: Record<string, { sheetId: string; animName: string }> = {
  PATROL:  { sheetId: "reader-idle",  animName: "idle" },
  CHASE:   { sheetId: "reader-rush",  animName: "rush" },
  ATTACK:  { sheetId: "reader-rush",  animName: "rush" },
  RECOVER: { sheetId: "reader-idle",  animName: "idle" },
  HURT:    { sheetId: "reader-hit",   animName: "hit" },
  DEAD:    { sheetId: "reader-death", animName: "death" },
};

// ─── Binder Sprites (64×64 frames) ─────────────────────────────────────────

export const BINDER_SPRITE_CONFIGS: SpriteSheetConfig[] = [
  {
    id: "binder-idle",
    src: "/assets/binder-idle-sheet.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 2,
    totalFrames: 2,
  },
  {
    id: "binder-grapple",
    src: "/assets/binder-grapple-sheet.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 5,
    totalFrames: 5,
  },
  {
    id: "binder-hit",
    src: "/assets/binder-hit-sheet.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 2,
    totalFrames: 2,
  },
  {
    id: "binder-death",
    src: "/assets/binder-death-sheet.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 3,
    totalFrames: 3,
  },
];

export const BINDER_ANIMATIONS: Record<string, AnimationDef[]> = {
  "binder-idle": [
    { name: "idle", frames: [0, 1], fps: 3, loop: true },
  ],
  "binder-grapple": [
    { name: "grapple-extend", frames: [0, 1, 2], fps: 8, loop: false },
    { name: "grapple-retract", frames: [3, 4], fps: 8, loop: false },
  ],
  "binder-hit": [
    { name: "hit", frames: [0, 1], fps: 6, loop: false },
  ],
  "binder-death": [
    { name: "death", frames: [0, 1, 2], fps: 6, loop: false },
  ],
};

export const BINDER_STATE_TO_ANIMATION: Record<string, { sheetId: string; animName: string }> = {
  IDLE:           { sheetId: "binder-idle",    animName: "idle" },
  WINDUP:         { sheetId: "binder-grapple", animName: "grapple-extend" },
  THREAD_FIRE:    { sheetId: "binder-grapple", animName: "grapple-extend" },
  PULLING:        { sheetId: "binder-grapple", animName: "grapple-retract" },
  THREAD_RETRACT: { sheetId: "binder-grapple", animName: "grapple-retract" },
  HURT:           { sheetId: "binder-hit",     animName: "hit" },
  DEAD:           { sheetId: "binder-death",   animName: "death" },
};

// ─── Proofwarden Sprites (64×64 frames) ─────────────────────────────────────

export const PROOFWARDEN_SPRITE_CONFIGS: SpriteSheetConfig[] = [
  {
    id: "proofwarden-idle",
    src: "/assets/proofwarden-idle-sheet.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 2,
    totalFrames: 2,
  },
  {
    id: "proofwarden-shield",
    src: "/assets/proofwarden-shield-sheet.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 5,
    totalFrames: 5,
  },
  {
    id: "proofwarden-attack",
    src: "/assets/proofwarden-attack-sheet.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 3,
    totalFrames: 3,
  },
  {
    id: "proofwarden-hit",
    src: "/assets/proofwarden-hit-sheet.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 2,
    totalFrames: 2,
  },
  {
    id: "proofwarden-death",
    src: "/assets/proofwarden-death-sheet.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 3,
    totalFrames: 3,
  },
];

export const PROOFWARDEN_ANIMATIONS: Record<string, AnimationDef[]> = {
  "proofwarden-idle": [
    { name: "idle", frames: [0, 1], fps: 3, loop: true },
  ],
  "proofwarden-shield": [
    { name: "shield-up", frames: [0, 1], fps: 4, loop: true },
    { name: "shield-break", frames: [2, 3, 4], fps: 8, loop: false },
  ],
  "proofwarden-attack": [
    { name: "slam", frames: [0, 1, 2], fps: 8, loop: false },
  ],
  "proofwarden-hit": [
    { name: "hit", frames: [0, 1], fps: 6, loop: false },
  ],
  "proofwarden-death": [
    { name: "death", frames: [0, 1, 2], fps: 6, loop: false },
  ],
};

export const PROOFWARDEN_STATE_TO_ANIMATION: Record<string, { sheetId: string; animName: string }> = {
  PATROL:        { sheetId: "proofwarden-idle",   animName: "idle" },
  CHASE:         { sheetId: "proofwarden-idle",   animName: "idle" },
  SLAM_WINDUP:   { sheetId: "proofwarden-attack", animName: "slam" },
  SLAM_ACTIVE:   { sheetId: "proofwarden-attack", animName: "slam" },
  SLAM_RECOVERY: { sheetId: "proofwarden-attack", animName: "slam" },
  HURT:          { sheetId: "proofwarden-hit",    animName: "hit" },
  DEAD:          { sheetId: "proofwarden-death",  animName: "death" },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

type EnemyType = "reader" | "binder" | "proofwarden";

const CONFIGS: Record<EnemyType, SpriteSheetConfig[]> = {
  reader: READER_SPRITE_CONFIGS,
  binder: BINDER_SPRITE_CONFIGS,
  proofwarden: PROOFWARDEN_SPRITE_CONFIGS,
};

const ANIMATIONS: Record<EnemyType, Record<string, AnimationDef[]>> = {
  reader: READER_ANIMATIONS,
  binder: BINDER_ANIMATIONS,
  proofwarden: PROOFWARDEN_ANIMATIONS,
};

const STATE_MAPS: Record<EnemyType, Record<string, { sheetId: string; animName: string }>> = {
  reader: READER_STATE_TO_ANIMATION,
  binder: BINDER_STATE_TO_ANIMATION,
  proofwarden: PROOFWARDEN_STATE_TO_ANIMATION,
};

export function getEnemySpriteConfigs(type: EnemyType): SpriteSheetConfig[] {
  return CONFIGS[type];
}

export function getEnemyAnimations(type: EnemyType): Record<string, AnimationDef[]> {
  return ANIMATIONS[type];
}

export function getEnemyStateToAnimation(type: EnemyType): Record<string, { sheetId: string; animName: string }> {
  return STATE_MAPS[type];
}
