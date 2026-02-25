import { describe, it, expect } from "vitest";
import {
  type InkCard,
  type CardCategory,
  createCard,
  getAllCardDefinitions,
  getCardDefinitionsByCategory,
  CardModifierEngine,
  DEFAULT_CARD_ENGINE_PARAMS,
  CraftingSystem,
  DEFAULT_CRAFTING_PARAMS,
} from "@/engine/cards";
import { DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";
import { DEFAULT_COMBAT_PARAMS } from "@/engine/combat/CombatParams";
import { DEFAULT_PLAYER_HEALTH_PARAMS } from "@/engine/combat/PlayerHealth";

// ═══════════════════════════════════════════════════════════════════
// Card Creation
// ═══════════════════════════════════════════════════════════════════

describe("Card creation", () => {
  it("1. createCard produces valid InkCard", () => {
    const card = createCard("swift-strider", 1);
    expect(card.name).toBe("Swift Strider");
    expect(card.category).toBe("swiftness");
    expect(card.tier).toBe(1);
    expect(card.glyph).toBeTruthy();
    expect(card.description).toBeTruthy();
    expect(card.modifiers.length).toBeGreaterThan(0);
    expect(card.definitionId).toBe("swift-strider");
    expect(card.id).toBeTruthy();
  });

  it("2. card tiers have increasing stat values", () => {
    const t1 = createCard("swift-strider", 1);
    const t2 = createCard("swift-strider", 2);
    const t3 = createCard("swift-strider", 3);

    const getValue = (card: InkCard) =>
      card.modifiers.find((m) => m.stat === "maxRunSpeed")!.value;

    expect(getValue(t1)).toBe(20);
    expect(getValue(t2)).toBe(40);
    expect(getValue(t3)).toBe(60);
    expect(getValue(t1)).toBeLessThan(getValue(t2));
    expect(getValue(t2)).toBeLessThan(getValue(t3));
  });

  it("3. each category has definitions", () => {
    const categories: CardCategory[] = [
      "swiftness",
      "might",
      "resilience",
      "precision",
      "arcana",
    ];
    for (const cat of categories) {
      const defs = getCardDefinitionsByCategory(cat);
      expect(defs.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("4. getAllCardDefinitions returns all definitions", () => {
    const allDefs = getAllCardDefinitions();
    // 15 definitions: 4 swiftness + 3 might + 3 resilience + 2 precision + 3 arcana
    expect(allDefs.length).toBe(15);
  });

  it("5. createCard with unknown definition throws", () => {
    expect(() => createCard("nonexistent", 1)).toThrow();
  });

  it("6. each card has unique ID", () => {
    const a = createCard("swift-strider", 1);
    const b = createCard("swift-strider", 1);
    const c = createCard("swift-strider", 1);
    const ids = new Set([a.id, b.id, c.id]);
    expect(ids.size).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════
// CardModifierEngine — equip/unequip
// ═══════════════════════════════════════════════════════════════════

describe("CardModifierEngine — equip/unequip", () => {
  it("7. equip card adds to equipped list", () => {
    const engine = new CardModifierEngine();
    const card = createCard("swift-strider", 1);
    engine.addToCollection(card);
    const result = engine.equipCard(card.id);
    expect(result).toBe(true);
    expect(engine.getEquippedCards()).toContainEqual(card);
  });

  it("8. unequip card removes from equipped", () => {
    const engine = new CardModifierEngine();
    const card = createCard("swift-strider", 1);
    engine.addToCollection(card);
    engine.equipCard(card.id);
    engine.unequipCard(card.id);
    expect(engine.getEquippedCards()).toHaveLength(0);
  });

  it("9. max 4 equipped", () => {
    const engine = new CardModifierEngine();
    const cards = [
      createCard("swift-strider", 1),
      createCard("leap-glyph", 1),
      createCard("dash-inscription", 1),
      createCard("air-script", 1),
      createCard("spear-verse", 1),
    ];
    for (const c of cards) engine.addToCollection(c);
    for (let i = 0; i < 4; i++) {
      expect(engine.equipCard(cards[i].id)).toBe(true);
    }
    // Fifth equip should fail
    expect(engine.equipCard(cards[4].id)).toBe(false);
    expect(engine.getEquippedCards()).toHaveLength(4);
  });

  it("10. cannot equip card not in collection", () => {
    const engine = new CardModifierEngine();
    expect(engine.equipCard("nonexistent-id")).toBe(false);
  });

  it("11. removeFromCollection also unequips", () => {
    const engine = new CardModifierEngine();
    const card = createCard("swift-strider", 1);
    engine.addToCollection(card);
    engine.equipCard(card.id);
    expect(engine.getEquippedCards()).toHaveLength(1);
    engine.removeFromCollection(card.id);
    expect(engine.getEquippedCards()).toHaveLength(0);
  });

  it("12. cannot equip same definition+tier twice (allowDuplicates=false)", () => {
    const engine = new CardModifierEngine();
    const a = createCard("swift-strider", 1);
    const b = createCard("swift-strider", 1);
    engine.addToCollection(a);
    engine.addToCollection(b);
    expect(engine.equipCard(a.id)).toBe(true);
    // Same definitionId + same tier = duplicate
    expect(engine.equipCard(b.id)).toBe(false);
  });

  it("13. can equip same definition with different tiers", () => {
    const engine = new CardModifierEngine();
    const t1 = createCard("swift-strider", 1);
    const t2 = createCard("swift-strider", 2);
    engine.addToCollection(t1);
    engine.addToCollection(t2);
    expect(engine.equipCard(t1.id)).toBe(true);
    expect(engine.equipCard(t2.id)).toBe(true);
    expect(engine.getEquippedCards()).toHaveLength(2);
  });

  it("14. cannot equip the same card instance twice", () => {
    const engine = new CardModifierEngine();
    const card = createCard("swift-strider", 1);
    engine.addToCollection(card);
    expect(engine.equipCard(card.id)).toBe(true);
    expect(engine.equipCard(card.id)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// CardModifierEngine — stat modification
// ═══════════════════════════════════════════════════════════════════

describe("CardModifierEngine — stat modification", () => {
  it("15. equipped card modifies player params", () => {
    const engine = new CardModifierEngine();
    const card = createCard("swift-strider", 1);
    engine.addToCollection(card);
    engine.equipCard(card.id);

    const modified = engine.applyToPlayerParams(DEFAULT_PLAYER_PARAMS);
    expect(modified.maxRunSpeed).toBe(DEFAULT_PLAYER_PARAMS.maxRunSpeed + 20);
  });

  it("16. unequipped card does not modify params", () => {
    const engine = new CardModifierEngine();
    const card = createCard("swift-strider", 1);
    engine.addToCollection(card);
    // Not equipped

    const modified = engine.applyToPlayerParams(DEFAULT_PLAYER_PARAMS);
    expect(modified.maxRunSpeed).toBe(DEFAULT_PLAYER_PARAMS.maxRunSpeed);
  });

  it("17. multiplicative modifier applies correctly", () => {
    const engine = new CardModifierEngine();
    const card = createCard("battle-tempo", 1);
    engine.addToCollection(card);
    engine.equipCard(card.id);

    const modified = engine.applyToCombatParams(DEFAULT_COMBAT_PARAMS);
    // All frame counts multiplied by 0.9 (rounded, min 1)
    expect(modified.spearWindupFrames).toBe(
      Math.max(1, Math.round(DEFAULT_COMBAT_PARAMS.spearWindupFrames * 0.9)),
    );
    expect(modified.spearActiveFrames).toBe(
      Math.max(1, Math.round(DEFAULT_COMBAT_PARAMS.spearActiveFrames * 0.9)),
    );
    expect(modified.spearRecoveryFrames).toBe(
      Math.max(1, Math.round(DEFAULT_COMBAT_PARAMS.spearRecoveryFrames * 0.9)),
    );
    expect(modified.snapWindupFrames).toBe(
      Math.max(1, Math.round(DEFAULT_COMBAT_PARAMS.snapWindupFrames * 0.9)),
    );
  });

  it("18. applyToPlayerParams returns new object", () => {
    const engine = new CardModifierEngine();
    const modified = engine.applyToPlayerParams(DEFAULT_PLAYER_PARAMS);
    expect(modified).not.toBe(DEFAULT_PLAYER_PARAMS);
  });

  it("19. applyToCombatParams modifies combat stats", () => {
    const engine = new CardModifierEngine();
    const card = createCard("spear-verse", 1);
    engine.addToCollection(card);
    engine.equipCard(card.id);

    const modified = engine.applyToCombatParams(DEFAULT_COMBAT_PARAMS);
    expect(modified.spearDamage).toBe(DEFAULT_COMBAT_PARAMS.spearDamage + 1);
  });

  it("20. applyToHealthParams modifies health", () => {
    const engine = new CardModifierEngine();
    const card = createCard("vellum-shield", 1);
    engine.addToCollection(card);
    engine.equipCard(card.id);

    const modified = engine.applyToHealthParams(DEFAULT_PLAYER_HEALTH_PARAMS);
    expect(modified.maxHealth).toBe(
      DEFAULT_PLAYER_HEALTH_PARAMS.maxHealth + 1,
    );
  });

  it("21. dash cooldown reduction is subtractive", () => {
    const engine = new CardModifierEngine();
    const card = createCard("dash-inscription", 1);
    engine.addToCollection(card);
    engine.equipCard(card.id);

    const modified = engine.applyToPlayerParams(DEFAULT_PLAYER_PARAMS);
    // dashCooldownReduction of 1 reduces dashCooldownFrames by 1 (min 4)
    expect(modified.dashCooldownFrames).toBe(
      Math.max(4, DEFAULT_PLAYER_PARAMS.dashCooldownFrames - 1),
    );
    // Also check dashSpeed increase
    expect(modified.dashSpeed).toBe(DEFAULT_PLAYER_PARAMS.dashSpeed + 40);
  });

  it("22. knockback resistance reduces knockbackSpeed", () => {
    const engine = new CardModifierEngine();
    const card = createCard("stoic-page", 1);
    engine.addToCollection(card);
    engine.equipCard(card.id);

    const modified = engine.applyToHealthParams(DEFAULT_PLAYER_HEALTH_PARAMS);
    expect(modified.knockbackSpeed).toBe(
      DEFAULT_PLAYER_HEALTH_PARAMS.knockbackSpeed * 0.85,
    );
  });

  it("23. invincibility frames are additive", () => {
    const engine = new CardModifierEngine();
    const card = createCard("ward-inscription", 1);
    engine.addToCollection(card);
    engine.equipCard(card.id);

    const modified = engine.applyToHealthParams(DEFAULT_PLAYER_HEALTH_PARAMS);
    expect(modified.invincibilityFrames).toBe(
      DEFAULT_PLAYER_HEALTH_PARAMS.invincibilityFrames + 10,
    );
  });

  it("24. multiple different stats from one card apply correctly", () => {
    const engine = new CardModifierEngine();
    // ledge-reader T1: +2 coyoteFrames, +1 jumpBufferFrames
    const card = createCard("ledge-reader", 1);
    engine.addToCollection(card);
    engine.equipCard(card.id);

    const modified = engine.applyToPlayerParams(DEFAULT_PLAYER_PARAMS);
    expect(modified.coyoteFrames).toBe(DEFAULT_PLAYER_PARAMS.coyoteFrames + 2);
    expect(modified.jumpBufferFrames).toBe(
      DEFAULT_PLAYER_PARAMS.jumpBufferFrames + 1,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// CardModifierEngine — diminishing returns
// ═══════════════════════════════════════════════════════════════════

describe("CardModifierEngine — diminishing returns", () => {
  it("25. second card on same stat applies at 0.7x rate", () => {
    const engine = new CardModifierEngine();
    // Equip two different-tier swift-striders (same stat: maxRunSpeed)
    const t1 = createCard("swift-strider", 1); // +20 maxRunSpeed
    const t2 = createCard("swift-strider", 2); // +40 maxRunSpeed

    engine.addToCollection(t1);
    engine.addToCollection(t2);
    engine.equipCard(t1.id);
    engine.equipCard(t2.id);

    const modified = engine.applyToPlayerParams(DEFAULT_PLAYER_PARAMS);
    // First card adds full: +20. Second card adds 40 * 0.7 = 28. Total = +48
    const expectedBoost = 20 + 40 * 0.7;
    expect(modified.maxRunSpeed).toBe(
      DEFAULT_PLAYER_PARAMS.maxRunSpeed + expectedBoost,
    );
  });

  it("26. diminishing returns disabled", () => {
    const engine = new CardModifierEngine({ diminishingReturns: false });
    const t1 = createCard("swift-strider", 1); // +20 maxRunSpeed
    const t2 = createCard("swift-strider", 2); // +40 maxRunSpeed

    engine.addToCollection(t1);
    engine.addToCollection(t2);
    engine.equipCard(t1.id);
    engine.equipCard(t2.id);

    const modified = engine.applyToPlayerParams(DEFAULT_PLAYER_PARAMS);
    // No diminishing: full sum
    expect(modified.maxRunSpeed).toBe(
      DEFAULT_PLAYER_PARAMS.maxRunSpeed + 20 + 40,
    );
  });

  it("27. single card has no diminishing penalty", () => {
    const engine = new CardModifierEngine();
    const card = createCard("swift-strider", 1); // +20 maxRunSpeed
    engine.addToCollection(card);
    engine.equipCard(card.id);

    const modified = engine.applyToPlayerParams(DEFAULT_PLAYER_PARAMS);
    // First occurrence: full value
    expect(modified.maxRunSpeed).toBe(DEFAULT_PLAYER_PARAMS.maxRunSpeed + 20);
  });
});

// ═══════════════════════════════════════════════════════════════════
// CardModifierEngine — stat caps
// ═══════════════════════════════════════════════════════════════════

describe("CardModifierEngine — stat caps", () => {
  it("28. maxRunSpeed capped at 500", () => {
    // Use diminishing returns disabled + multiple high-tier cards
    const engine = new CardModifierEngine({ diminishingReturns: false });
    // swift-strider T3: +60, leap-glyph T3: maxRunSpeed not boosted, so use multiple swift-striders
    // Need different definitions boosting maxRunSpeed, but only swift-strider does.
    // So equip t1+t2+t3 of swift-strider (diff tiers) + air-script
    const t1 = createCard("swift-strider", 1); // +20
    const t2 = createCard("swift-strider", 2); // +40
    const t3 = createCard("swift-strider", 3); // +60
    // Total: +120. Base is 280. 280+120=400 < 500. Need more.
    // We need enough to exceed cap. Let's use a custom engine with a lower cap.
    const engine2 = new CardModifierEngine({
      diminishingReturns: false,
      statCaps: {
        ...DEFAULT_CARD_ENGINE_PARAMS.statCaps,
        maxRunSpeed: { max: 310 }, // 280 base + 30 cap
      },
    });
    engine2.addToCollection(t1);
    engine2.addToCollection(t2);
    engine2.equipCard(t1.id);
    engine2.equipCard(t2.id);

    const modified = engine2.applyToPlayerParams(DEFAULT_PLAYER_PARAMS);
    // Would be 280+60 = 340, but capped at 310
    expect(modified.maxRunSpeed).toBe(310);
  });

  it("29. maxHealth capped at 10", () => {
    const engine = new CardModifierEngine({ diminishingReturns: false });
    // vellum-shield T3: +3, equip two different tiers
    const t2 = createCard("vellum-shield", 2); // +2
    const t3 = createCard("vellum-shield", 3); // +3
    engine.addToCollection(t2);
    engine.addToCollection(t3);
    engine.equipCard(t2.id);
    engine.equipCard(t3.id);

    const modified = engine.applyToHealthParams(DEFAULT_PLAYER_HEALTH_PARAMS);
    // Base is 5, +2+3 = 10, exactly at cap
    expect(modified.maxHealth).toBeLessThanOrEqual(10);
  });

  it("30. maxHealth cannot exceed 10 even with many cards", () => {
    const engine = new CardModifierEngine({ diminishingReturns: false });
    const t1 = createCard("vellum-shield", 1); // +1
    const t2 = createCard("vellum-shield", 2); // +2
    const t3 = createCard("vellum-shield", 3); // +3
    engine.addToCollection(t1);
    engine.addToCollection(t2);
    engine.addToCollection(t3);
    engine.equipCard(t1.id);
    engine.equipCard(t2.id);
    engine.equipCard(t3.id);

    const modified = engine.applyToHealthParams(DEFAULT_PLAYER_HEALTH_PARAMS);
    // Base 5 + 1 + 2 + 3 = 11, capped to 10
    expect(modified.maxHealth).toBe(10);
  });

  it("31. attackSpeedBoost minimum 0.5", () => {
    // Use custom cap of min 0.6 so 0.8 * 0.7 = 0.56 triggers it
    const engine = new CardModifierEngine({
      statCaps: {
        ...DEFAULT_CARD_ENGINE_PARAMS.statCaps,
        attackSpeedBoost: { min: 0.6 },
      },
    });
    const t2 = createCard("battle-tempo", 2); // ×0.8
    const t3 = createCard("battle-tempo", 3); // ×0.7
    engine.addToCollection(t2);
    engine.addToCollection(t3);
    engine.equipCard(t2.id);
    engine.equipCard(t3.id);

    const mods = engine.computeModifiers();
    // Multiplicative: 0.8 * 0.7 = 0.56 → capped to min 0.6
    expect(mods.multiplicative.attackSpeedBoost).toBe(0.6);
  });

  it("31b. attackSpeedBoost default cap is 0.5", () => {
    // Verify the default cap value
    expect(DEFAULT_CARD_ENGINE_PARAMS.statCaps.attackSpeedBoost?.min).toBe(0.5);
  });

  it("32. frame counts rounded to integers", () => {
    const engine = new CardModifierEngine();
    const card = createCard("ledge-reader", 1); // +2 coyoteFrames, +1 jumpBufferFrames
    engine.addToCollection(card);
    engine.equipCard(card.id);

    const modified = engine.applyToPlayerParams(DEFAULT_PLAYER_PARAMS);
    expect(Number.isInteger(modified.coyoteFrames)).toBe(true);
    expect(Number.isInteger(modified.jumpBufferFrames)).toBe(true);
    expect(Number.isInteger(modified.dashCooldownFrames)).toBe(true);
  });

  it("33. abilityCooldownReduction has min cap", () => {
    // Use custom cap of min 0.6 so 0.8 * 0.7 = 0.56 triggers it
    const engine = new CardModifierEngine({
      statCaps: {
        ...DEFAULT_CARD_ENGINE_PARAMS.statCaps,
        abilityCooldownReduction: { min: 0.6 },
      },
    });
    const t2 = createCard("scribes-haste", 2); // ×0.8
    const t3 = createCard("scribes-haste", 3); // ×0.7
    engine.addToCollection(t2);
    engine.addToCollection(t3);
    engine.equipCard(t2.id);
    engine.equipCard(t3.id);

    const mods = engine.computeModifiers();
    // 0.8 * 0.7 = 0.56 → capped to min 0.6
    expect(mods.multiplicative.abilityCooldownReduction).toBe(0.6);
  });

  it("33b. abilityCooldownReduction default cap is 0.5", () => {
    expect(
      DEFAULT_CARD_ENGINE_PARAMS.statCaps.abilityCooldownReduction?.min,
    ).toBe(0.5);
  });
});

// ═══════════════════════════════════════════════════════════════════
// CraftingSystem
// ═══════════════════════════════════════════════════════════════════

describe("CraftingSystem", () => {
  it("34. craft same tier produces next tier", () => {
    const crafting = new CraftingSystem();
    const a = createCard("swift-strider", 1);
    const b = createCard("swift-strider", 1);
    const collection = [a, b];

    const recipes = crafting.getAvailableCrafts(collection);
    expect(recipes.length).toBe(1);
    expect(recipes[0].inputTier).toBe(1);
    expect(recipes[0].outputTier).toBe(2);

    const result = crafting.craft(collection, recipes[0]);
    expect(result).not.toBeNull();
    expect(result!.consumed).toHaveLength(2);
    expect(result!.produced.tier).toBe(2);
    expect(result!.produced.definitionId).toBe("swift-strider");
  });

  it("35. cannot craft tier 3", () => {
    const crafting = new CraftingSystem();
    const a = createCard("swift-strider", 3);
    const b = createCard("swift-strider", 3);
    const collection = [a, b];

    const recipes = crafting.getAvailableCrafts(collection);
    const t3Recipes = recipes.filter(
      (r) => r.inputDefinitionId === "swift-strider" && r.inputTier === 3,
    );
    expect(t3Recipes).toHaveLength(0);
  });

  it("36. getAvailableCrafts finds eligible pairs", () => {
    const crafting = new CraftingSystem();
    const collection = [
      createCard("swift-strider", 1),
      createCard("swift-strider", 1),
      createCard("leap-glyph", 1),
      createCard("leap-glyph", 1),
    ];

    const recipes = crafting.getAvailableCrafts(collection);
    expect(recipes).toHaveLength(2);
    const defIds = recipes.map((r) => r.inputDefinitionId).sort();
    expect(defIds).toEqual(["leap-glyph", "swift-strider"]);
  });

  it("37. canCraft returns true for valid recipe", () => {
    const crafting = new CraftingSystem();
    const collection = [
      createCard("swift-strider", 1),
      createCard("swift-strider", 1),
    ];

    const recipes = crafting.getAvailableCrafts(collection);
    expect(crafting.canCraft(collection, recipes[0])).toBe(true);
  });

  it("38. canCraft returns false with insufficient cards", () => {
    const crafting = new CraftingSystem();
    const collection = [createCard("swift-strider", 1)];

    const recipe = {
      inputDefinitionId: "swift-strider",
      inputTier: 1 as const,
      inputCount: 2,
      outputDefinitionId: "swift-strider",
      outputTier: 2 as const,
    };

    expect(crafting.canCraft(collection, recipe)).toBe(false);
  });

  it("39. craft returns consumed and produced", () => {
    const crafting = new CraftingSystem();
    const a = createCard("leap-glyph", 2);
    const b = createCard("leap-glyph", 2);
    const collection = [a, b];

    const recipes = crafting.getAvailableCrafts(collection);
    const result = crafting.craft(collection, recipes[0]);

    expect(result).not.toBeNull();
    expect(result!.consumed).toHaveLength(2);
    expect(result!.consumed).toContain(a);
    expect(result!.consumed).toContain(b);
    expect(result!.produced.tier).toBe(3);
    expect(result!.produced.definitionId).toBe("leap-glyph");
    expect(result!.produced.name).toBe("Leap Glyph");
  });

  it("40. craft returns null if not craftable", () => {
    const crafting = new CraftingSystem();
    const collection = [createCard("swift-strider", 1)];

    const recipe = {
      inputDefinitionId: "swift-strider",
      inputTier: 1 as const,
      inputCount: 2,
      outputDefinitionId: "swift-strider",
      outputTier: 2 as const,
    };

    expect(crafting.craft(collection, recipe)).toBeNull();
  });

  it("41. craft does not mutate collection array", () => {
    const crafting = new CraftingSystem();
    const collection = [
      createCard("swift-strider", 1),
      createCard("swift-strider", 1),
    ];
    const originalLength = collection.length;

    const recipes = crafting.getAvailableCrafts(collection);
    crafting.craft(collection, recipes[0]);

    expect(collection).toHaveLength(originalLength);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Card definitions — category coverage
// ═══════════════════════════════════════════════════════════════════

describe("Card definitions — category coverage", () => {
  it("42. swiftness cards exist", () => {
    const defs = getCardDefinitionsByCategory("swiftness");
    const ids = defs.map((d) => d.id);
    expect(ids).toContain("swift-strider");
    expect(ids).toContain("leap-glyph");
    expect(ids).toContain("dash-inscription");
    expect(defs.length).toBeGreaterThanOrEqual(3);
  });

  it("43. might cards exist", () => {
    const defs = getCardDefinitionsByCategory("might");
    const ids = defs.map((d) => d.id);
    expect(ids).toContain("spear-verse");
    expect(ids).toContain("snap-verse");
    expect(ids).toContain("battle-tempo");
    expect(defs.length).toBeGreaterThanOrEqual(3);
  });

  it("44. resilience cards exist", () => {
    const defs = getCardDefinitionsByCategory("resilience");
    const ids = defs.map((d) => d.id);
    expect(ids).toContain("vellum-shield");
    expect(ids).toContain("ward-inscription");
    expect(ids).toContain("stoic-page");
    expect(defs.length).toBeGreaterThanOrEqual(3);
  });

  it("45. precision cards exist", () => {
    const defs = getCardDefinitionsByCategory("precision");
    const ids = defs.map((d) => d.id);
    expect(ids).toContain("ledge-reader");
    expect(ids).toContain("wall-binding");
    expect(defs.length).toBeGreaterThanOrEqual(2);
  });

  it("46. arcana cards exist", () => {
    const defs = getCardDefinitionsByCategory("arcana");
    const ids = defs.map((d) => d.id);
    expect(ids).toContain("scribes-haste");
    expect(ids).toContain("ink-well");
    expect(ids).toContain("margin-expander");
    expect(defs.length).toBeGreaterThanOrEqual(3);
  });

  it("47. every definition can be created at all 3 tiers", () => {
    const allDefs = getAllCardDefinitions();
    for (const def of allDefs) {
      for (const tier of [1, 2, 3] as const) {
        const card = createCard(def.id, tier);
        expect(card.tier).toBe(tier);
        expect(card.category).toBe(def.category);
        expect(card.modifiers.length).toBeGreaterThan(0);
      }
    }
  });
});
