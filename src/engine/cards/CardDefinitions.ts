import type {
  CardCategory,
  CardTier,
  CardStat,
  StatModifier,
  InkCard,
} from "./InkCard";

export type CardDefinitionId = string;

export interface CardDefinition {
  id: CardDefinitionId;
  name: string;
  category: CardCategory;
  glyph: string;
  tiers: Record<
    CardTier,
    {
      description: string;
      modifiers: StatModifier[];
    }
  >;
}

let cardInstanceCounter = 0;

function nextCardId(): string {
  cardInstanceCounter++;
  return `card-${cardInstanceCounter}-${Date.now().toString(36)}`;
}

/** Helper to create additive modifier */
function add(stat: CardStat, value: number): StatModifier {
  return { stat, modifierType: "additive", value };
}

/** Helper to create multiplicative modifier */
function mul(stat: CardStat, value: number): StatModifier {
  return { stat, modifierType: "multiplicative", value };
}

// ═══════════════════════════════════════════════════════════════════
// Card Definitions Catalog — 14 definitions × 3 tiers = 42 variants
// ═══════════════════════════════════════════════════════════════════

export const CARD_DEFINITIONS: CardDefinition[] = [
  // ─── SWIFTNESS ──────────────────────────────────────────────────
  {
    id: "swift-strider",
    name: "Swift Strider",
    category: "swiftness",
    glyph: "ᚡ",
    tiers: {
      1: { description: "+20 run speed", modifiers: [add("maxRunSpeed", 20)] },
      2: { description: "+40 run speed", modifiers: [add("maxRunSpeed", 40)] },
      3: { description: "+60 run speed", modifiers: [add("maxRunSpeed", 60)] },
    },
  },
  {
    id: "leap-glyph",
    name: "Leap Glyph",
    category: "swiftness",
    glyph: "ᚢ",
    tiers: {
      1: { description: "+25 jump speed", modifiers: [add("jumpSpeed", 25)] },
      2: { description: "+50 jump speed", modifiers: [add("jumpSpeed", 50)] },
      3: { description: "+75 jump speed", modifiers: [add("jumpSpeed", 75)] },
    },
  },
  {
    id: "dash-inscription",
    name: "Dash Inscription",
    category: "swiftness",
    glyph: "ᚣ",
    tiers: {
      1: {
        description: "+40 dash speed, -1 dash CD",
        modifiers: [add("dashSpeed", 40), add("dashCooldownReduction", 1)],
      },
      2: {
        description: "+80 dash speed, -2 dash CD",
        modifiers: [add("dashSpeed", 80), add("dashCooldownReduction", 2)],
      },
      3: {
        description: "+120 dash speed, -4 dash CD",
        modifiers: [add("dashSpeed", 120), add("dashCooldownReduction", 4)],
      },
    },
  },
  {
    id: "air-script",
    name: "Air Script",
    category: "swiftness",
    glyph: "ᚤ",
    tiers: {
      1: {
        description: "+100 air accel",
        modifiers: [add("airAcceleration", 100)],
      },
      2: {
        description: "+200 air accel",
        modifiers: [add("airAcceleration", 200)],
      },
      3: {
        description: "+300 air accel",
        modifiers: [add("airAcceleration", 300)],
      },
    },
  },

  // ─── MIGHT ──────────────────────────────────────────────────────
  {
    id: "spear-verse",
    name: "Spear Verse",
    category: "might",
    glyph: "ᚴ",
    tiers: {
      1: {
        description: "+1 spear damage",
        modifiers: [add("spearDamage", 1)],
      },
      2: {
        description: "+1 spear damage, +8 reach",
        modifiers: [add("spearDamage", 1), add("spearReach", 8)],
      },
      3: {
        description: "+2 spear damage, +12 reach",
        modifiers: [add("spearDamage", 2), add("spearReach", 12)],
      },
    },
  },
  {
    id: "snap-verse",
    name: "Snap Verse",
    category: "might",
    glyph: "ᚵ",
    tiers: {
      1: {
        description: "+1 snap damage",
        modifiers: [add("snapDamage", 1)],
      },
      2: {
        description: "+1 snap damage, +6 radius",
        modifiers: [add("snapDamage", 1), add("snapRadius", 6)],
      },
      3: {
        description: "+2 snap damage, +10 radius",
        modifiers: [add("snapDamage", 2), add("snapRadius", 10)],
      },
    },
  },
  {
    id: "battle-tempo",
    name: "Battle Tempo",
    category: "might",
    glyph: "ᚶ",
    tiers: {
      1: {
        description: "×0.9 attack frames",
        modifiers: [mul("attackSpeedBoost", 0.9)],
      },
      2: {
        description: "×0.8 attack frames",
        modifiers: [mul("attackSpeedBoost", 0.8)],
      },
      3: {
        description: "×0.7 attack frames",
        modifiers: [mul("attackSpeedBoost", 0.7)],
      },
    },
  },

  // ─── RESILIENCE ─────────────────────────────────────────────────
  {
    id: "vellum-shield",
    name: "Vellum Shield",
    category: "resilience",
    glyph: "ᛞ",
    tiers: {
      1: { description: "+1 max health", modifiers: [add("maxHealth", 1)] },
      2: { description: "+2 max health", modifiers: [add("maxHealth", 2)] },
      3: { description: "+3 max health", modifiers: [add("maxHealth", 3)] },
    },
  },
  {
    id: "ward-inscription",
    name: "Ward Inscription",
    category: "resilience",
    glyph: "ᛟ",
    tiers: {
      1: {
        description: "+10 i-frames",
        modifiers: [add("invincibilityFrames", 10)],
      },
      2: {
        description: "+20 i-frames",
        modifiers: [add("invincibilityFrames", 20)],
      },
      3: {
        description: "+30 i-frames",
        modifiers: [add("invincibilityFrames", 30)],
      },
    },
  },
  {
    id: "stoic-page",
    name: "Stoic Page",
    category: "resilience",
    glyph: "ᛠ",
    tiers: {
      1: {
        description: "×0.85 knockback",
        modifiers: [mul("knockbackResistance", 0.85)],
      },
      2: {
        description: "×0.7 knockback",
        modifiers: [mul("knockbackResistance", 0.7)],
      },
      3: {
        description: "×0.55 knockback",
        modifiers: [mul("knockbackResistance", 0.55)],
      },
    },
  },

  // ─── PRECISION ──────────────────────────────────────────────────
  {
    id: "ledge-reader",
    name: "Ledge Reader",
    category: "precision",
    glyph: "ᛣ",
    tiers: {
      1: {
        description: "+2 coyote, +1 buffer",
        modifiers: [add("coyoteFrames", 2), add("jumpBufferFrames", 1)],
      },
      2: {
        description: "+3 coyote, +2 buffer",
        modifiers: [add("coyoteFrames", 3), add("jumpBufferFrames", 2)],
      },
      3: {
        description: "+5 coyote, +3 buffer",
        modifiers: [add("coyoteFrames", 5), add("jumpBufferFrames", 3)],
      },
    },
  },
  {
    id: "wall-binding",
    name: "Wall Binding",
    category: "precision",
    glyph: "ᛤ",
    tiers: {
      1: {
        description: "+20 wall jump, -10 slide",
        modifiers: [
          add("wallJumpHorizontalSpeed", 20),
          add("wallSlideGripSpeed", -10),
        ],
      },
      2: {
        description: "+40 wall jump, -15 slide",
        modifiers: [
          add("wallJumpHorizontalSpeed", 40),
          add("wallSlideGripSpeed", -15),
        ],
      },
      3: {
        description: "+60 wall jump, -20 slide",
        modifiers: [
          add("wallJumpHorizontalSpeed", 60),
          add("wallSlideGripSpeed", -20),
        ],
      },
    },
  },

  // ─── ARCANA ─────────────────────────────────────────────────────
  {
    id: "scribes-haste",
    name: "Scribe's Haste",
    category: "arcana",
    glyph: "ᛦ",
    tiers: {
      1: {
        description: "×0.9 ability CD",
        modifiers: [mul("abilityCooldownReduction", 0.9)],
      },
      2: {
        description: "×0.8 ability CD",
        modifiers: [mul("abilityCooldownReduction", 0.8)],
      },
      3: {
        description: "×0.7 ability CD",
        modifiers: [mul("abilityCooldownReduction", 0.7)],
      },
    },
  },
  {
    id: "ink-well",
    name: "Ink Well",
    category: "arcana",
    glyph: "ᛧ",
    tiers: {
      1: {
        description: "×1.15 ability duration",
        modifiers: [mul("abilityDurationBoost", 1.15)],
      },
      2: {
        description: "×1.3 ability duration",
        modifiers: [mul("abilityDurationBoost", 1.3)],
      },
      3: {
        description: "×1.5 ability duration",
        modifiers: [mul("abilityDurationBoost", 1.5)],
      },
    },
  },
  {
    id: "margin-expander",
    name: "Margin Expander",
    category: "arcana",
    glyph: "ᛨ",
    tiers: {
      1: {
        description: "×1.1 ability range",
        modifiers: [mul("abilityRangeBoost", 1.1)],
      },
      2: {
        description: "×1.2 ability range",
        modifiers: [mul("abilityRangeBoost", 1.2)],
      },
      3: {
        description: "×1.35 ability range",
        modifiers: [mul("abilityRangeBoost", 1.35)],
      },
    },
  },
];

/** Create an InkCard instance from a definition + tier */
export function createCard(
  definitionId: CardDefinitionId,
  tier: CardTier,
): InkCard {
  const def = CARD_DEFINITIONS.find((d) => d.id === definitionId);
  if (!def) {
    throw new Error(`Unknown card definition: ${definitionId}`);
  }
  const tierData = def.tiers[tier];
  return {
    id: nextCardId(),
    name: def.name,
    category: def.category,
    tier,
    glyph: def.glyph,
    description: tierData.description,
    modifiers: [...tierData.modifiers],
    definitionId: def.id,
  };
}

/** Get all card definitions */
export function getAllCardDefinitions(): CardDefinition[] {
  return CARD_DEFINITIONS;
}

/** Get card definitions filtered by category */
export function getCardDefinitionsByCategory(
  category: CardCategory,
): CardDefinition[] {
  return CARD_DEFINITIONS.filter((d) => d.category === category);
}
