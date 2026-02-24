import type { Vec2, Rect } from "@/lib/types";

/** Direction an attack can be aimed */
export type AttackDirection =
  | "left"
  | "right"
  | "up"
  | "down"
  | "up-left"
  | "up-right"
  | "down-left"
  | "down-right";

/** The phase of an attack's lifecycle */
export type AttackPhase = "idle" | "windup" | "active" | "recovery" | "cooldown";

/** Which weapon is being used */
export type WeaponType = "quill-spear" | "ink-snap";

/** A hitbox produced by an attack */
export interface AttackHitbox {
  /** World-space rectangle of the hitbox */
  rect: Rect;
  /** Damage dealt on hit */
  damage: number;
  /** Knockback impulse applied to the target on hit */
  knockback: Vec2;
  /** Which weapon produced this hitbox */
  weapon: WeaponType;
  /** Attack direction (for visual effects) */
  direction: AttackDirection;
  /** Set of entity IDs already hit by this attack (prevent multi-hit per swing) */
  hitEntities: Set<string>;
}

/** Result of a hit check */
export interface HitResult {
  /** The entity that was hit */
  targetId: string;
  /** The hitbox that hit it */
  hitbox: AttackHitbox;
  /** World-space position of the hit (center of overlap) */
  hitPosition: Vec2;
  /** Knockback to apply */
  knockback: Vec2;
  /** Damage dealt */
  damage: number;
}

/** Health component -- mixable into any entity that can take damage */
export interface Damageable {
  health: number;
  maxHealth: number;
  knockbackVelocity: Vec2;
  hitstunFrames: number;
  invincibilityFrames: number;
  isAlive: boolean;
}
