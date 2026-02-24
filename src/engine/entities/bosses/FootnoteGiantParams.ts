export interface FootnoteGiantParams {
  // Health
  maxHealth: number;
  phase1Threshold: number;
  phase2Threshold: number;

  // Phase 1 — Pillar Slam
  pillarSlamTelegraph: number;
  pillarSlamDamage: number;
  pillarSlamKnockback: number;
  pillarSlamStuck: number;
  pillarSlamRecover: number;
  shockwaveHeight: number;
  shockwaveSpeed: number;
  shockwaveRange: number;
  shockwaveDamage: number;

  // Phase 1 — Ink Rain
  inkRainTelegraph: number;
  inkRainDuration: number;
  inkRainBlotCount: number;
  inkRainBlotSize: number;
  inkRainFallSpeed: number;
  inkRainDamage: number;
  inkRainCooldown: number;

  // Phase 2 — Citation Stamp
  citationStampTelegraph: number;
  citationStampDamage: number;
  citationStampKnockback: number;
  citationStampShockwaveHeight: number;
  citationStampShockwaveSpeed: number;
  citationStampRecovery: number;

  // Phase 3 — Footnote Sweep
  footnoteSweepTelegraph: number;
  footnoteSweepDamage: number;
  footnoteSweepHeight: number;
  footnoteSweepSpeed: number;
  footnoteSweepRecovery: number;

  // General
  phaseTransitionDuration: number;
  invulnBetweenAttacks: number;
  bossShakeOnHit: number;
  bossShakeFrames: number;
}

export const DEFAULT_FOOTNOTE_GIANT_PARAMS: FootnoteGiantParams = {
  maxHealth: 30,
  phase1Threshold: 20,
  phase2Threshold: 10,

  pillarSlamTelegraph: 40,
  pillarSlamDamage: 2,
  pillarSlamKnockback: 400,
  pillarSlamStuck: 50,
  pillarSlamRecover: 30,
  shockwaveHeight: 40,
  shockwaveSpeed: 300,
  shockwaveRange: 200,
  shockwaveDamage: 1,

  inkRainTelegraph: 30,
  inkRainDuration: 90,
  inkRainBlotCount: 5,
  inkRainBlotSize: 24,
  inkRainFallSpeed: 350,
  inkRainDamage: 1,
  inkRainCooldown: 20,

  citationStampTelegraph: 35,
  citationStampDamage: 2,
  citationStampKnockback: 500,
  citationStampShockwaveHeight: 60,
  citationStampShockwaveSpeed: 500,
  citationStampRecovery: 60,

  footnoteSweepTelegraph: 25,
  footnoteSweepDamage: 1,
  footnoteSweepHeight: 40,
  footnoteSweepSpeed: 600,
  footnoteSweepRecovery: 35,

  phaseTransitionDuration: 100,
  invulnBetweenAttacks: 30,
  bossShakeOnHit: 3,
  bossShakeFrames: 4,
};
