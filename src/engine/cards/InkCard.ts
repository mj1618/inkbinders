/** Card stat categories — each category modifies a group of related stats */
export type CardCategory =
  | "swiftness"
  | "might"
  | "resilience"
  | "precision"
  | "arcana";

/** Card tier — higher tier = stronger effect */
export type CardTier = 1 | 2 | 3;

/** Individual stat that a card can modify */
export type CardStat =
  // Swiftness (movement)
  | "maxRunSpeed"
  | "jumpSpeed"
  | "dashSpeed"
  | "airAcceleration"
  | "dashCooldownReduction"
  // Might (combat offense)
  | "spearDamage"
  | "snapDamage"
  | "spearReach"
  | "snapRadius"
  | "attackSpeedBoost"
  // Resilience (defense)
  | "maxHealth"
  | "invincibilityFrames"
  | "knockbackResistance"
  // Precision (technique)
  | "coyoteFrames"
  | "jumpBufferFrames"
  | "wallJumpHorizontalSpeed"
  | "wallSlideGripSpeed"
  // Arcana (ability)
  | "abilityCooldownReduction"
  | "abilityDurationBoost"
  | "abilityRangeBoost";

/** How the stat modification is applied */
export type ModifierType = "additive" | "multiplicative";

/** A single stat modification provided by a card */
export interface StatModifier {
  stat: CardStat;
  modifierType: ModifierType;
  value: number;
}

/** An Ink Card instance */
export interface InkCard {
  id: string;
  name: string;
  category: CardCategory;
  tier: CardTier;
  glyph: string;
  description: string;
  modifiers: StatModifier[];
  /** The definition ID this card was created from */
  definitionId: string;
}

/** The player's card collection and equipped deck */
export interface CardDeck {
  collection: InkCard[];
  equippedIds: string[];
  maxEquipped: number;
}

/** Category display colors */
export const CATEGORY_COLORS: Record<CardCategory, string> = {
  swiftness: "#22d3ee",
  might: "#f59e0b",
  resilience: "#4ade80",
  precision: "#a78bfa",
  arcana: "#6366f1",
};

/** Category display names */
export const CATEGORY_NAMES: Record<CardCategory, string> = {
  swiftness: "Swiftness",
  might: "Might",
  resilience: "Resilience",
  precision: "Precision",
  arcana: "Arcana",
};

/** Human-readable stat names */
export const STAT_DISPLAY_NAMES: Record<CardStat, string> = {
  maxRunSpeed: "Max Run Speed",
  jumpSpeed: "Jump Speed",
  dashSpeed: "Dash Speed",
  airAcceleration: "Air Acceleration",
  dashCooldownReduction: "Dash CD Reduction",
  spearDamage: "Spear Damage",
  snapDamage: "Snap Damage",
  spearReach: "Spear Reach",
  snapRadius: "Snap Radius",
  attackSpeedBoost: "Attack Speed",
  maxHealth: "Max Health",
  invincibilityFrames: "I-Frames",
  knockbackResistance: "KB Resistance",
  coyoteFrames: "Coyote Frames",
  jumpBufferFrames: "Jump Buffer",
  wallJumpHorizontalSpeed: "Wall Jump H-Speed",
  wallSlideGripSpeed: "Wall Slide Grip",
  abilityCooldownReduction: "Ability CD",
  abilityDurationBoost: "Ability Duration",
  abilityRangeBoost: "Ability Range",
};
