import type { InkCard, CardTier } from "./InkCard";
import type { CardDefinitionId } from "./CardDefinitions";
import { createCard } from "./CardDefinitions";

// ─── Crafting Recipe ────────────────────────────────────────────

export interface CraftingRecipe {
  inputDefinitionId: CardDefinitionId;
  inputTier: CardTier;
  inputCount: number;
  outputDefinitionId: CardDefinitionId;
  outputTier: CardTier;
}

// ─── Crafting Params ────────────────────────────────────────────

export interface CraftingParams {
  cardsPerUpgrade: number;
  allowCrossCategoryCraft: boolean;
}

export const DEFAULT_CRAFTING_PARAMS: CraftingParams = {
  cardsPerUpgrade: 2,
  allowCrossCategoryCraft: false,
};

// ─── Crafting System ────────────────────────────────────────────

export class CraftingSystem {
  params: CraftingParams;

  constructor(params?: Partial<CraftingParams>) {
    this.params = { ...DEFAULT_CRAFTING_PARAMS, ...params };
  }

  getAvailableCrafts(collection: InkCard[]): CraftingRecipe[] {
    const recipes: CraftingRecipe[] = [];

    // Group cards by definitionId + tier
    const groups = new Map<string, InkCard[]>();
    for (const card of collection) {
      const key = `${card.definitionId}:${card.tier}`;
      const group = groups.get(key);
      if (group) {
        group.push(card);
      } else {
        groups.set(key, [card]);
      }
    }

    for (const [key, cards] of groups) {
      if (cards.length < this.params.cardsPerUpgrade) continue;
      const first = cards[0];
      // Can't upgrade Tier 3
      if (first.tier >= 3) continue;

      const outputTier = (first.tier + 1) as CardTier;
      recipes.push({
        inputDefinitionId: first.definitionId,
        inputTier: first.tier,
        inputCount: this.params.cardsPerUpgrade,
        outputDefinitionId: first.definitionId,
        outputTier,
      });
    }

    return recipes;
  }

  canCraft(collection: InkCard[], recipe: CraftingRecipe): boolean {
    const matching = collection.filter(
      (c) =>
        c.definitionId === recipe.inputDefinitionId &&
        c.tier === recipe.inputTier,
    );
    return matching.length >= recipe.inputCount;
  }

  craft(
    collection: InkCard[],
    recipe: CraftingRecipe,
  ): { consumed: InkCard[]; produced: InkCard } | null {
    if (!this.canCraft(collection, recipe)) return null;

    // Find cards to consume
    const consumed: InkCard[] = [];
    for (const card of collection) {
      if (consumed.length >= recipe.inputCount) break;
      if (
        card.definitionId === recipe.inputDefinitionId &&
        card.tier === recipe.inputTier
      ) {
        consumed.push(card);
      }
    }

    if (consumed.length < recipe.inputCount) return null;

    const produced = createCard(recipe.outputDefinitionId, recipe.outputTier);
    return { consumed, produced };
  }
}
