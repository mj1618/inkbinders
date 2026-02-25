import type { SpriteSheetConfig, AnimationDef } from "@/engine/core/SpriteSheet";

// ─── Footnote Giant Sprites (128×128 frames) ────────────────────────────────

export const GIANT_SPRITE_CONFIGS: SpriteSheetConfig[] = [
  {
    id: "giant-idle",
    src: "/assets/giant-idle-sheet.png",
    frameWidth: 128,
    frameHeight: 128,
    columns: 4,
    totalFrames: 4,
  },
  {
    id: "giant-stomp",
    src: "/assets/giant-stomp-sheet.png",
    frameWidth: 128,
    frameHeight: 128,
    columns: 4,
    totalFrames: 4,
  },
  {
    id: "giant-sweep",
    src: "/assets/giant-sweep-sheet.png",
    frameWidth: 128,
    frameHeight: 128,
    columns: 4,
    totalFrames: 4,
  },
  {
    id: "giant-vulnerable",
    src: "/assets/giant-vulnerable-sheet.png",
    frameWidth: 128,
    frameHeight: 128,
    columns: 2,
    totalFrames: 2,
  },
  {
    id: "giant-death",
    src: "/assets/giant-death-sheet.png",
    frameWidth: 128,
    frameHeight: 128,
    columns: 4,
    totalFrames: 4,
  },
];

export const GIANT_ANIMATIONS: Record<string, AnimationDef[]> = {
  "giant-idle": [
    { name: "idle", frames: [0, 1, 2, 3], fps: 3, loop: true },
  ],
  "giant-stomp": [
    { name: "stomp-telegraph", frames: [0], fps: 1, loop: false },
    { name: "stomp-slam", frames: [1, 2], fps: 12, loop: false },
    { name: "stomp-stuck", frames: [3], fps: 1, loop: false },
  ],
  "giant-sweep": [
    { name: "sweep-telegraph", frames: [0], fps: 1, loop: false },
    { name: "sweep", frames: [1, 2, 3], fps: 10, loop: false },
  ],
  "giant-vulnerable": [
    { name: "vulnerable", frames: [0, 1], fps: 4, loop: true },
  ],
  "giant-death": [
    { name: "death", frames: [0, 1, 2, 3], fps: 4, loop: false },
  ],
};

export const GIANT_STATE_TO_ANIMATION: Record<string, { sheetId: string; animName: string }> = {
  IDLE:               { sheetId: "giant-idle",       animName: "idle" },
  PILLAR_TELEGRAPH:   { sheetId: "giant-stomp",      animName: "stomp-telegraph" },
  PILLAR_SLAM:        { sheetId: "giant-stomp",      animName: "stomp-slam" },
  PILLAR_STUCK:       { sheetId: "giant-stomp",      animName: "stomp-stuck" },
  PILLAR_RECOVER:     { sheetId: "giant-idle",       animName: "idle" },
  INK_RAIN_TELEGRAPH: { sheetId: "giant-idle",       animName: "idle" },
  INK_RAIN:           { sheetId: "giant-idle",       animName: "idle" },
  CITATION_TELEGRAPH: { sheetId: "giant-stomp",      animName: "stomp-telegraph" },
  CITATION_STAMP:     { sheetId: "giant-stomp",      animName: "stomp-slam" },
  CITATION_RECOVERY:  { sheetId: "giant-vulnerable", animName: "vulnerable" },
  SWEEP_TELEGRAPH:    { sheetId: "giant-sweep",      animName: "sweep-telegraph" },
  SWEEP:              { sheetId: "giant-sweep",      animName: "sweep" },
  SWEEP_RECOVERY:     { sheetId: "giant-vulnerable", animName: "vulnerable" },
  PHASE_TRANSITION:   { sheetId: "giant-idle",       animName: "idle" },
  DYING:              { sheetId: "giant-death",      animName: "death" },
  DEAD:               { sheetId: "giant-death",      animName: "death" },
};

// ─── Misprint Seraph Sprites (128×128 frames) ───────────────────────────────

export const SERAPH_SPRITE_CONFIGS: SpriteSheetConfig[] = [
  {
    id: "seraph-hover",
    src: "/assets/seraph-hover-sheet.png",
    frameWidth: 128,
    frameHeight: 128,
    columns: 4,
    totalFrames: 4,
  },
  {
    id: "seraph-dive",
    src: "/assets/seraph-dive-sheet.png",
    frameWidth: 128,
    frameHeight: 128,
    columns: 3,
    totalFrames: 3,
  },
  {
    id: "seraph-cast",
    src: "/assets/seraph-cast-sheet.png",
    frameWidth: 128,
    frameHeight: 128,
    columns: 4,
    totalFrames: 4,
  },
  {
    id: "seraph-stagger",
    src: "/assets/seraph-stagger-sheet.png",
    frameWidth: 128,
    frameHeight: 128,
    columns: 2,
    totalFrames: 2,
  },
  {
    id: "seraph-death",
    src: "/assets/seraph-death-sheet.png",
    frameWidth: 128,
    frameHeight: 128,
    columns: 4,
    totalFrames: 4,
  },
];

export const SERAPH_ANIMATIONS: Record<string, AnimationDef[]> = {
  "seraph-hover": [
    { name: "hover", frames: [0, 1, 2, 3], fps: 6, loop: true },
  ],
  "seraph-dive": [
    { name: "dive-telegraph", frames: [0], fps: 1, loop: false },
    { name: "dive", frames: [1, 2], fps: 12, loop: false },
  ],
  "seraph-cast": [
    { name: "cast-telegraph", frames: [0], fps: 1, loop: false },
    { name: "cast", frames: [1, 2, 3], fps: 8, loop: false },
  ],
  "seraph-stagger": [
    { name: "stagger", frames: [0, 1], fps: 4, loop: true },
  ],
  "seraph-death": [
    { name: "death", frames: [0, 1, 2, 3], fps: 4, loop: false },
  ],
};

export const SERAPH_STATE_TO_ANIMATION: Record<string, { sheetId: string; animName: string }> = {
  IDLE:                    { sheetId: "seraph-hover",   animName: "hover" },
  TELEPORT_OUT:            { sheetId: "seraph-hover",   animName: "hover" },
  TELEPORT_IN:             { sheetId: "seraph-hover",   animName: "hover" },
  BEAM_TELEGRAPH:          { sheetId: "seraph-cast",    animName: "cast-telegraph" },
  BEAM_FIRE:               { sheetId: "seraph-cast",    animName: "cast" },
  BEAM_COOLDOWN:           { sheetId: "seraph-hover",   animName: "hover" },
  BARRAGE_TELEGRAPH:       { sheetId: "seraph-cast",    animName: "cast-telegraph" },
  BARRAGE_FIRE:            { sheetId: "seraph-cast",    animName: "cast" },
  BARRAGE_STAGGER:         { sheetId: "seraph-stagger", animName: "stagger" },
  BARRAGE_RECOVER:         { sheetId: "seraph-hover",   animName: "hover" },
  DIVE_TELEGRAPH:          { sheetId: "seraph-dive",    animName: "dive-telegraph" },
  DIVE_ATTACK:             { sheetId: "seraph-dive",    animName: "dive" },
  DIVE_RECOVERY:           { sheetId: "seraph-stagger", animName: "stagger" },
  DIVE_ASCEND:             { sheetId: "seraph-hover",   animName: "hover" },
  RAPID_DIVE_INTER:        { sheetId: "seraph-hover",   animName: "hover" },
  STORM_TELEGRAPH:         { sheetId: "seraph-cast",    animName: "cast-telegraph" },
  STORM_FIRE:              { sheetId: "seraph-cast",    animName: "cast" },
  STORM_STAGGER:           { sheetId: "seraph-stagger", animName: "stagger" },
  STORM_RECOVER:           { sheetId: "seraph-hover",   animName: "hover" },
  TRIPLE_BEAM_TELEGRAPH:   { sheetId: "seraph-cast",    animName: "cast-telegraph" },
  TRIPLE_BEAM_FIRE:        { sheetId: "seraph-cast",    animName: "cast" },
  DESPERATION_TELEGRAPH:   { sheetId: "seraph-cast",    animName: "cast-telegraph" },
  DESPERATION_SLAM:        { sheetId: "seraph-dive",    animName: "dive" },
  DESPERATION_COLLAPSE:    { sheetId: "seraph-stagger", animName: "stagger" },
  DESPERATION_ASCEND:      { sheetId: "seraph-hover",   animName: "hover" },
  PHASE_TRANSITION:        { sheetId: "seraph-hover",   animName: "hover" },
  DYING:                   { sheetId: "seraph-death",   animName: "death" },
  DEAD:                    { sheetId: "seraph-death",   animName: "death" },
};

// ─── Index Eater Sprites (128×96 frames) ─────────────────────────────────────

export const EATER_SPRITE_CONFIGS: SpriteSheetConfig[] = [
  {
    id: "eater-crawl",
    src: "/assets/eater-crawl-sheet.png",
    frameWidth: 128,
    frameHeight: 96,
    columns: 4,
    totalFrames: 4,
  },
  {
    id: "eater-lunge",
    src: "/assets/eater-lunge-sheet.png",
    frameWidth: 128,
    frameHeight: 96,
    columns: 3,
    totalFrames: 3,
  },
  {
    id: "eater-devour",
    src: "/assets/eater-devour-sheet.png",
    frameWidth: 128,
    frameHeight: 96,
    columns: 4,
    totalFrames: 4,
  },
  {
    id: "eater-spit",
    src: "/assets/eater-spit-sheet.png",
    frameWidth: 128,
    frameHeight: 96,
    columns: 3,
    totalFrames: 3,
  },
  {
    id: "eater-stunned",
    src: "/assets/eater-stunned-sheet.png",
    frameWidth: 128,
    frameHeight: 96,
    columns: 2,
    totalFrames: 2,
  },
  {
    id: "eater-death",
    src: "/assets/eater-death-sheet.png",
    frameWidth: 128,
    frameHeight: 96,
    columns: 4,
    totalFrames: 4,
  },
];

export const EATER_ANIMATIONS: Record<string, AnimationDef[]> = {
  "eater-crawl": [
    { name: "crawl", frames: [0, 1, 2, 3], fps: 6, loop: true },
  ],
  "eater-lunge": [
    { name: "lunge-telegraph", frames: [0], fps: 1, loop: false },
    { name: "lunge", frames: [1, 2], fps: 12, loop: false },
  ],
  "eater-devour": [
    { name: "devour-telegraph", frames: [0], fps: 1, loop: false },
    { name: "devour", frames: [1, 2], fps: 6, loop: false },
    { name: "devour-stunned", frames: [3], fps: 1, loop: false },
  ],
  "eater-spit": [
    { name: "spit-telegraph", frames: [0], fps: 1, loop: false },
    { name: "spit", frames: [1, 2], fps: 8, loop: false },
  ],
  "eater-stunned": [
    { name: "stunned", frames: [0, 1], fps: 4, loop: true },
  ],
  "eater-death": [
    { name: "death", frames: [0, 1, 2, 3], fps: 4, loop: false },
  ],
};

export const EATER_STATE_TO_ANIMATION: Record<string, { sheetId: string; animName: string }> = {
  IDLE:                    { sheetId: "eater-crawl",    animName: "crawl" },
  PATROL:                  { sheetId: "eater-crawl",    animName: "crawl" },
  CHASE:                   { sheetId: "eater-crawl",    animName: "crawl" },
  LUNGE_TELEGRAPH:         { sheetId: "eater-lunge",    animName: "lunge-telegraph" },
  LUNGE_ATTACK:            { sheetId: "eater-lunge",    animName: "lunge" },
  LUNGE_RECOVERY:          { sheetId: "eater-stunned",  animName: "stunned" },
  WHIP_TELEGRAPH:          { sheetId: "eater-crawl",    animName: "crawl" },
  WHIP_ATTACK:             { sheetId: "eater-crawl",    animName: "crawl" },
  WHIP_COOLDOWN:           { sheetId: "eater-crawl",    animName: "crawl" },
  SPIT_TELEGRAPH:          { sheetId: "eater-spit",     animName: "spit-telegraph" },
  SPIT_FIRE:               { sheetId: "eater-spit",     animName: "spit" },
  SPIT_COOLDOWN:           { sheetId: "eater-crawl",    animName: "crawl" },
  DEVOUR_TELEGRAPH:        { sheetId: "eater-devour",   animName: "devour-telegraph" },
  DEVOUR_EATING:           { sheetId: "eater-devour",   animName: "devour" },
  DEVOUR_STUNNED:          { sheetId: "eater-devour",   animName: "devour-stunned" },
  DEVOUR_RECOVER:          { sheetId: "eater-crawl",    animName: "crawl" },
  INK_FLOOD_TELEGRAPH:     { sheetId: "eater-crawl",    animName: "crawl" },
  INK_FLOOD_ACTIVE:        { sheetId: "eater-crawl",    animName: "crawl" },
  INK_FLOOD_COOLDOWN:      { sheetId: "eater-crawl",    animName: "crawl" },
  CLIMB_TO_WALL:           { sheetId: "eater-crawl",    animName: "crawl" },
  WALL_CRAWL:              { sheetId: "eater-crawl",    animName: "crawl" },
  CLIMB_TO_CEILING:        { sheetId: "eater-crawl",    animName: "crawl" },
  CEILING_CRAWL:           { sheetId: "eater-crawl",    animName: "crawl" },
  POUNCE_TELEGRAPH:        { sheetId: "eater-lunge",    animName: "lunge-telegraph" },
  POUNCE_ATTACK:           { sheetId: "eater-lunge",    animName: "lunge" },
  POUNCE_IMPACT:           { sheetId: "eater-lunge",    animName: "lunge" },
  POUNCE_STUNNED:          { sheetId: "eater-stunned",  animName: "stunned" },
  POUNCE_RECOVER:          { sheetId: "eater-crawl",    animName: "crawl" },
  CHAIN_STORM_TELEGRAPH:   { sheetId: "eater-crawl",    animName: "crawl" },
  CHAIN_STORM_ACTIVE:      { sheetId: "eater-crawl",    animName: "crawl" },
  CHAIN_STORM_COOLDOWN:    { sheetId: "eater-crawl",    animName: "crawl" },
  DEATH_THRASH_TELEGRAPH:  { sheetId: "eater-crawl",    animName: "crawl" },
  DEATH_THRASH_BOUNCE:     { sheetId: "eater-crawl",    animName: "crawl" },
  DEATH_THRASH_COLLAPSE:   { sheetId: "eater-stunned",  animName: "stunned" },
  DEATH_THRASH_RECOVER:    { sheetId: "eater-crawl",    animName: "crawl" },
  PHASE_TRANSITION:        { sheetId: "eater-crawl",    animName: "crawl" },
  DYING:                   { sheetId: "eater-death",    animName: "death" },
  DEAD:                    { sheetId: "eater-death",    animName: "death" },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

type BossType = "footnote-giant" | "misprint-seraph" | "index-eater";

const CONFIGS: Record<BossType, SpriteSheetConfig[]> = {
  "footnote-giant": GIANT_SPRITE_CONFIGS,
  "misprint-seraph": SERAPH_SPRITE_CONFIGS,
  "index-eater": EATER_SPRITE_CONFIGS,
};

const ANIMATIONS: Record<BossType, Record<string, AnimationDef[]>> = {
  "footnote-giant": GIANT_ANIMATIONS,
  "misprint-seraph": SERAPH_ANIMATIONS,
  "index-eater": EATER_ANIMATIONS,
};

const STATE_MAPS: Record<BossType, Record<string, { sheetId: string; animName: string }>> = {
  "footnote-giant": GIANT_STATE_TO_ANIMATION,
  "misprint-seraph": SERAPH_STATE_TO_ANIMATION,
  "index-eater": EATER_STATE_TO_ANIMATION,
};

export function getBossSpriteConfigs(bossType: BossType): SpriteSheetConfig[] {
  return CONFIGS[bossType];
}

export function getBossAnimations(bossType: BossType): Record<string, AnimationDef[]> {
  return ANIMATIONS[bossType];
}

export function getBossStateToAnimation(bossType: BossType): Record<string, { sheetId: string; animName: string }> {
  return STATE_MAPS[bossType];
}
