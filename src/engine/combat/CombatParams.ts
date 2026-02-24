export interface CombatParams {
  // === Quill-Spear ===
  /** Frames of wind-up before the hitbox becomes active */
  spearWindupFrames: number;
  /** Frames the spear hitbox is active */
  spearActiveFrames: number;
  /** Frames of recovery after the active phase */
  spearRecoveryFrames: number;
  /** Cooldown frames before the next spear attack */
  spearCooldownFrames: number;
  /** Width of the spear hitbox (extends from player center) */
  spearReach: number;
  /** Height of the spear hitbox */
  spearWidth: number;
  /** Damage per hit */
  spearDamage: number;
  /** Knockback speed applied to target */
  spearKnockback: number;
  /** Duration of hitstop (target-only freeze) in frames */
  spearHitstopFrames: number;
  /** Screen shake intensity on hit */
  spearShakeIntensity: number;
  /** Screen shake duration in frames */
  spearShakeFrames: number;

  // === Ink Snap ===
  /** Frames of wind-up before the snap fires */
  snapWindupFrames: number;
  /** Frames the snap hitbox is active */
  snapActiveFrames: number;
  /** Frames of recovery after the active phase */
  snapRecoveryFrames: number;
  /** Cooldown frames before the next snap */
  snapCooldownFrames: number;
  /** Radius of the snap area of effect */
  snapRadius: number;
  /** Auto-aim range -- how far away the snap can target an enemy */
  snapAutoAimRange: number;
  /** Damage per hit */
  snapDamage: number;
  /** Knockback speed applied to target (outward from snap center) */
  snapKnockback: number;
  /** Hitstop frames on target */
  snapHitstopFrames: number;
  /** Screen shake intensity on hit */
  snapShakeIntensity: number;
  /** Screen shake duration in frames */
  snapShakeFrames: number;

  // === General ===
  /** Whether the player can attack during dash */
  attackDuringDash: boolean;
  /** Whether the player can attack while wall-sliding */
  attackDuringWallSlide: boolean;
  /** Whether the player can attack while in hard landing recovery */
  attackDuringHardLanding: boolean;
}

export const DEFAULT_COMBAT_PARAMS: CombatParams = {
  // Quill-Spear: fast, mid-range, directional
  spearWindupFrames: 2,
  spearActiveFrames: 4,
  spearRecoveryFrames: 3,
  spearCooldownFrames: 6,
  spearReach: 48,
  spearWidth: 16,
  spearDamage: 1,
  spearKnockback: 250,
  spearHitstopFrames: 4,
  spearShakeIntensity: 2,
  spearShakeFrames: 3,

  // Ink Snap: short-range, auto-aim, burst
  snapWindupFrames: 3,
  snapActiveFrames: 3,
  snapRecoveryFrames: 4,
  snapCooldownFrames: 12,
  snapRadius: 28,
  snapAutoAimRange: 120,
  snapDamage: 2,
  snapKnockback: 400,
  snapHitstopFrames: 6,
  snapShakeIntensity: 4,
  snapShakeFrames: 4,

  // General
  attackDuringDash: true,
  attackDuringWallSlide: true,
  attackDuringHardLanding: false,
};
