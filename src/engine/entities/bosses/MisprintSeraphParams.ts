export interface MisprintSeraphParams {
  // Health
  maxHealth: number;
  phase1Threshold: number;
  phase2Threshold: number;
  desperationThreshold: number;

  // Body
  bodyWidth: number;
  bodyHeight: number;
  wingSpan: number;

  // Hover / movement
  hoverBobSpeed: number;
  hoverBobAmplitude: number;
  teleportFadeDuration: number;

  // Phase 1 — Ink Beam
  beamTelegraph: number;
  beamDuration: number;
  beamWidth: number;
  beamSweepAngle: number;
  beamDamage: number;
  beamCooldown: number;

  // Phase 1 — Page Barrage
  barrageTelegraph: number;
  barrageDuration: number;
  barragePageCount: number;
  barragePageSpeed: number;
  barragePageSize: number;
  barragePageDamage: number;
  barrageSpreadAngle: number;
  barrageStagger: number;
  barrageStaggerDescent: number;

  // Phase 2 — Dive Slash
  diveTelegraph: number;
  diveCrosshairDuration: number;
  diveSpeed: number;
  diveDamage: number;
  diveKnockback: number;
  diveRecovery: number;
  diveAscendDuration: number;

  // Phase 2 — Corrupted Floor
  corruptedFloorDamagePerSec: number;

  // Phase 2 — Page Storm
  stormTelegraph: number;
  stormPageCount: number;
  stormPageSpeed: number;
  stormPageDamage: number;
  stormPageBounces: number;
  stormStagger: number;

  // Phase 3 — Triple Beam
  tripleBeamTelegraph: number;
  tripleBeamWidth: number;
  tripleBeamSpacing: number;

  // Phase 3 — Rapid Dive
  rapidDiveTelegraph: number;
  rapidDiveSpeed: number;
  rapidDiveRecovery: number;
  rapidDiveCount: number;
  rapidDiveInterDelay: number;

  // Phase 3 — Rapid Barrage
  rapidBarragePageCount: number;
  rapidBarragePageSpeed: number;
  rapidBarrageStagger: number;
  rapidBarrageTracking: number;

  // Phase 3 — Desperation Slam
  desperationTelegraph: number;
  desperationDiveSpeed: number;
  desperationSlamDamage: number;
  desperationShockwaveHeight: number;
  desperationShockwaveSpeed: number;
  desperationPageCount: number;
  desperationCollapse: number;
  desperationAscend: number;

  // General
  phaseTransitionDuration: number;
  invulnBetweenAttacks: number;
  bossShakeOnHit: number;
  bossShakeFrames: number;
}

export const DEFAULT_MISPRINT_SERAPH_PARAMS: MisprintSeraphParams = {
  maxHealth: 24,
  phase1Threshold: 16,
  phase2Threshold: 8,
  desperationThreshold: 4,

  bodyWidth: 96,
  bodyHeight: 120,
  wingSpan: 200,

  hoverBobSpeed: 0.03,
  hoverBobAmplitude: 8,
  teleportFadeDuration: 8,

  // Phase 1 — Ink Beam
  beamTelegraph: 30,
  beamDuration: 40,
  beamWidth: 32,
  beamSweepAngle: 60,
  beamDamage: 2,
  beamCooldown: 25,

  // Phase 1 — Page Barrage
  barrageTelegraph: 20,
  barrageDuration: 60,
  barragePageCount: 7,
  barragePageSpeed: 350,
  barragePageSize: 16,
  barragePageDamage: 1,
  barrageSpreadAngle: 30,
  barrageStagger: 40,
  barrageStaggerDescent: 80,

  // Phase 2 — Dive Slash
  diveTelegraph: 25,
  diveCrosshairDuration: 15,
  diveSpeed: 800,
  diveDamage: 2,
  diveKnockback: 450,
  diveRecovery: 50,
  diveAscendDuration: 20,

  // Phase 2 — Corrupted Floor
  corruptedFloorDamagePerSec: 1,

  // Phase 2 — Page Storm
  stormTelegraph: 15,
  stormPageCount: 14,
  stormPageSpeed: 300,
  stormPageDamage: 1,
  stormPageBounces: 1,
  stormStagger: 35,

  // Phase 3 — Triple Beam
  tripleBeamTelegraph: 18,
  tripleBeamWidth: 20,
  tripleBeamSpacing: 30,

  // Phase 3 — Rapid Dive
  rapidDiveTelegraph: 15,
  rapidDiveSpeed: 1000,
  rapidDiveRecovery: 30,
  rapidDiveCount: 2,
  rapidDiveInterDelay: 10,

  // Phase 3 — Rapid Barrage
  rapidBarragePageCount: 11,
  rapidBarragePageSpeed: 400,
  rapidBarrageStagger: 25,
  rapidBarrageTracking: 5,

  // Phase 3 — Desperation Slam
  desperationTelegraph: 40,
  desperationDiveSpeed: 1200,
  desperationSlamDamage: 3,
  desperationShockwaveHeight: 60,
  desperationShockwaveSpeed: 500,
  desperationPageCount: 8,
  desperationCollapse: 70,
  desperationAscend: 30,

  // General
  phaseTransitionDuration: 100,
  invulnBetweenAttacks: 20,
  bossShakeOnHit: 3,
  bossShakeFrames: 4,
};
