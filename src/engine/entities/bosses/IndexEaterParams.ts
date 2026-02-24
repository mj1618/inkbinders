export interface IndexEaterParams {
  // Health
  maxHealth: number;
  phase1Threshold: number;
  phase2Threshold: number;
  deathThrashThreshold: number;

  // Body
  bodyWidth: number;
  bodyHeight: number;
  segmentWidth: number;
  segmentCount: number;

  // Movement
  patrolSpeed: number;
  chaseSpeed: number;
  climbSpeed: number;
  detectionRange: number;
  gapJumpDistance: number;

  // Phase 1 — Lunge Bite
  lungeTelegraph: number;
  lungeDistance: number;
  lungeDuration: number;
  lungeDamage: number;
  lungeKnockback: number;
  lungeRecovery: number;
  lungeHitboxWidth: number;
  lungeHitboxHeight: number;

  // Phase 1 — Chain Whip
  whipTelegraph: number;
  whipDuration: number;
  whipRadius: number;
  whipDamage: number;
  whipKnockback: number;
  whipCooldown: number;

  // Phase 1 — Index Spit
  spitTelegraph: number;
  spitCardCount: number;
  spitCardSpeed: number;
  spitCardSize: number;
  spitCardDamage: number;
  spitSpreadAngle: number;
  spitCooldown: number;

  // Phase 2 — Devour
  devourTelegraph: number;
  devourDuration: number;
  devourStunned: number;
  devourRecover: number;
  devourShockwaveHeight: number;
  devourShockwaveRange: number;
  devourShockwaveSpeed: number;
  devourShockwaveDamage: number;

  // Phase 2 — Ink Flood
  inkFloodTelegraph: number;
  inkFloodDuration: number;
  inkFloodPersist: number;
  inkFloodDamagePerSec: number;
  inkFloodRange: number;

  // Phase 2 faster attacks
  p2LungeTelegraph: number;
  p2LungeDistance: number;
  p2LungeRecovery: number;
  p2WhipRadius: number;
  p2WhipShockwaveRange: number;

  // Phase 3 — Drop Pounce
  pounceTelegraph: number;
  pounceSpeed: number;
  pounceDamage: number;
  pounceKnockback: number;
  pounceShockwaveRange: number;
  pounceShockwaveHeight: number;
  pounceStunned: number;
  pounceRecover: number;

  // Phase 3 — Chain Storm
  chainStormTelegraph: number;
  chainStormDuration: number;
  chainStormRadius: number;
  chainStormChainCount: number;
  chainStormDamage: number;
  chainStormCooldown: number;

  // Phase 3 — Desperate Devour
  p3DevourTelegraph: number;
  p3DevourStunned: number;

  // Phase 3 — Death Thrash
  deathThrashTelegraph: number;
  deathThrashImpactCount: number;
  deathThrashImpactInterval: number;
  deathThrashSpeed: number;
  deathThrashDamage: number;
  deathThrashShockwaveRange: number;
  deathThrashShockwaveHeight: number;
  deathThrashCollapse: number;
  deathThrashRecover: number;

  // Phase 3 — Auto-crumble
  autoCrumbleInterval: number;
  autoCrumbleWarning: number;

  // General
  phaseTransitionDuration: number;
  invulnBetweenAttacks: number;
  bossShakeOnHit: number;
  bossShakeFrames: number;
}

export const DEFAULT_INDEX_EATER_PARAMS: IndexEaterParams = {
  maxHealth: 28,
  phase1Threshold: 19,
  phase2Threshold: 9,
  deathThrashThreshold: 3,

  bodyWidth: 160,
  bodyHeight: 80,
  segmentWidth: 40,
  segmentCount: 4,

  patrolSpeed: 100,
  chaseSpeed: 220,
  climbSpeed: 120,
  detectionRange: 400,
  gapJumpDistance: 50,

  // Phase 1 — Lunge Bite
  lungeTelegraph: 25,
  lungeDistance: 200,
  lungeDuration: 10,
  lungeDamage: 2,
  lungeKnockback: 450,
  lungeRecovery: 45,
  lungeHitboxWidth: 120,
  lungeHitboxHeight: 60,

  // Phase 1 — Chain Whip
  whipTelegraph: 20,
  whipDuration: 15,
  whipRadius: 120,
  whipDamage: 1,
  whipKnockback: 300,
  whipCooldown: 25,

  // Phase 1 — Index Spit
  spitTelegraph: 15,
  spitCardCount: 3,
  spitCardSpeed: 300,
  spitCardSize: 20,
  spitCardDamage: 1,
  spitSpreadAngle: 40,
  spitCooldown: 30,

  // Phase 2 — Devour
  devourTelegraph: 30,
  devourDuration: 20,
  devourStunned: 55,
  devourRecover: 25,
  devourShockwaveHeight: 40,
  devourShockwaveRange: 200,
  devourShockwaveSpeed: 350,
  devourShockwaveDamage: 1,

  // Phase 2 — Ink Flood
  inkFloodTelegraph: 20,
  inkFloodDuration: 40,
  inkFloodPersist: 120,
  inkFloodDamagePerSec: 1,
  inkFloodRange: 1,

  // Phase 2 faster attacks
  p2LungeTelegraph: 18,
  p2LungeDistance: 260,
  p2LungeRecovery: 35,
  p2WhipRadius: 160,
  p2WhipShockwaveRange: 100,

  // Phase 3 — Drop Pounce
  pounceTelegraph: 20,
  pounceSpeed: 900,
  pounceDamage: 2,
  pounceKnockback: 500,
  pounceShockwaveRange: 80,
  pounceShockwaveHeight: 40,
  pounceStunned: 40,
  pounceRecover: 15,

  // Phase 3 — Chain Storm
  chainStormTelegraph: 18,
  chainStormDuration: 25,
  chainStormRadius: 140,
  chainStormChainCount: 6,
  chainStormDamage: 1,
  chainStormCooldown: 20,

  // Phase 3 — Desperate Devour
  p3DevourTelegraph: 20,
  p3DevourStunned: 35,

  // Phase 3 — Death Thrash
  deathThrashTelegraph: 35,
  deathThrashImpactCount: 5,
  deathThrashImpactInterval: 12,
  deathThrashSpeed: 1000,
  deathThrashDamage: 2,
  deathThrashShockwaveRange: 150,
  deathThrashShockwaveHeight: 60,
  deathThrashCollapse: 60,
  deathThrashRecover: 25,

  // Phase 3 — Auto-crumble
  autoCrumbleInterval: 300,
  autoCrumbleWarning: 60,

  // General
  phaseTransitionDuration: 100,
  invulnBetweenAttacks: 25,
  bossShakeOnHit: 3,
  bossShakeFrames: 4,
};
