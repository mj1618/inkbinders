export interface ReaderParams {
  health: number;
  moveSpeed: number;
  chaseSpeed: number;
  detectionRange: number;
  attackRange: number;
  lungeSpeed: number;
  lungeDuration: number;
  lungeRecovery: number;
  contactDamage: number;
  lungeKnockback: number;
}

export const DEFAULT_READER_PARAMS: ReaderParams = {
  health: 2,
  moveSpeed: 160,
  chaseSpeed: 300,
  detectionRange: 200,
  attackRange: 30,
  lungeSpeed: 500,
  lungeDuration: 10,
  lungeRecovery: 30,
  contactDamage: 1,
  lungeKnockback: 200,
};

export interface BinderParams {
  health: number;
  detectionRange: number;
  threadRange: number;
  threadMinRange: number;
  threadSpeed: number;
  threadRetractSpeed: number;
  threadWindup: number;
  threadDuration: number;
  threadCooldown: number;
  pullDuration: number;
  contactDamage: number;
  threadDamage: number;
  threadKnockback: number;
}

export const DEFAULT_BINDER_PARAMS: BinderParams = {
  health: 4,
  detectionRange: 250,
  threadRange: 180,
  threadMinRange: 50,
  threadSpeed: 400,
  threadRetractSpeed: 300,
  threadWindup: 20,
  threadDuration: 40,
  threadCooldown: 90,
  pullDuration: 30,
  contactDamage: 1,
  threadDamage: 1,
  threadKnockback: 150,
};

export interface ProofwardenParams {
  health: number;
  moveSpeed: number;
  chaseSpeed: number;
  detectionRange: number;
  attackRange: number;
  slamWindup: number;
  slamActiveFrames: number;
  slamRecovery: number;
  slamDamage: number;
  slamKnockback: number;
  slamHitboxWidth: number;
  slamHitboxHeight: number;
  shieldBlockAngle: number;
  contactDamage: number;
}

export const DEFAULT_PROOFWARDEN_PARAMS: ProofwardenParams = {
  health: 6,
  moveSpeed: 80,
  chaseSpeed: 120,
  detectionRange: 180,
  attackRange: 40,
  slamWindup: 25,
  slamActiveFrames: 6,
  slamRecovery: 40,
  slamDamage: 2,
  slamKnockback: 350,
  slamHitboxWidth: 60,
  slamHitboxHeight: 30,
  shieldBlockAngle: 120,
  contactDamage: 1,
};
