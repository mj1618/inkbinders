import type {
  CardStat,
  InkCard,
  CardDeck,
} from "./InkCard";
import { STAT_DISPLAY_NAMES } from "./InkCard";
import type { PlayerParams } from "@/engine/entities/Player";
import type { CombatParams } from "@/engine/combat/CombatParams";
import type { PlayerHealthParams } from "@/engine/combat/PlayerHealth";

// ─── Computed Modifiers ─────────────────────────────────────────

export interface ComputedModifiers {
  additive: Partial<Record<CardStat, number>>;
  multiplicative: Partial<Record<CardStat, number>>;
}

// ─── Modifier Summary Entry ─────────────────────────────────────

export interface ModifierSummaryEntry {
  stat: CardStat;
  displayName: string;
  baseValue: number;
  modifiedValue: number;
  change: string;
  sourceCards: string[];
}

// ─── Engine Params ──────────────────────────────────────────────

export interface CardModifierEngineParams {
  maxEquipped: number;
  allowDuplicates: boolean;
  diminishingReturns: boolean;
  diminishingFactor: number;
  statCaps: Partial<Record<CardStat, { min?: number; max?: number }>>;
}

export const DEFAULT_CARD_ENGINE_PARAMS: CardModifierEngineParams = {
  maxEquipped: 4,
  allowDuplicates: false,
  diminishingReturns: true,
  diminishingFactor: 0.7,
  statCaps: {
    maxRunSpeed: { max: 500 },
    jumpSpeed: { max: 600 },
    dashSpeed: { max: 900 },
    spearDamage: { max: 5 },
    snapDamage: { max: 6 },
    maxHealth: { max: 10 },
    coyoteFrames: { max: 15 },
    jumpBufferFrames: { max: 12 },
    attackSpeedBoost: { min: 0.5 },
    knockbackResistance: { min: 0.3 },
    abilityCooldownReduction: { min: 0.5 },
  },
};

// ─── Frame-count stats that must be integers ────────────────────

const FRAME_COUNT_STATS: Set<CardStat> = new Set([
  "coyoteFrames",
  "jumpBufferFrames",
  "invincibilityFrames",
  "dashCooldownReduction",
]);

// ─── Card Modifier Engine ───────────────────────────────────────

export class CardModifierEngine {
  params: CardModifierEngineParams;
  deck: CardDeck;

  constructor(params?: Partial<CardModifierEngineParams>) {
    this.params = { ...DEFAULT_CARD_ENGINE_PARAMS, ...params };
    this.deck = {
      collection: [],
      equippedIds: [],
      maxEquipped: this.params.maxEquipped,
    };
  }

  equipCard(cardId: string): boolean {
    if (this.deck.equippedIds.length >= this.params.maxEquipped) return false;
    if (this.deck.equippedIds.includes(cardId)) return false;

    const card = this.deck.collection.find((c) => c.id === cardId);
    if (!card) return false;

    // Duplicate check: same definitionId AND same tier
    if (!this.params.allowDuplicates) {
      for (const eqId of this.deck.equippedIds) {
        const eqCard = this.deck.collection.find((c) => c.id === eqId);
        if (
          eqCard &&
          eqCard.definitionId === card.definitionId &&
          eqCard.tier === card.tier
        ) {
          return false;
        }
      }
    }

    this.deck.equippedIds.push(cardId);
    return true;
  }

  unequipCard(cardId: string): void {
    const idx = this.deck.equippedIds.indexOf(cardId);
    if (idx !== -1) {
      this.deck.equippedIds.splice(idx, 1);
    }
  }

  addToCollection(card: InkCard): void {
    this.deck.collection.push(card);
  }

  removeFromCollection(cardId: string): void {
    // Also unequip if equipped
    this.unequipCard(cardId);
    const idx = this.deck.collection.findIndex((c) => c.id === cardId);
    if (idx !== -1) {
      this.deck.collection.splice(idx, 1);
    }
  }

  getEquippedCards(): InkCard[] {
    return this.deck.equippedIds
      .map((id) => this.deck.collection.find((c) => c.id === id))
      .filter((c): c is InkCard => c !== undefined);
  }

  computeModifiers(): ComputedModifiers {
    const result: ComputedModifiers = {
      additive: {},
      multiplicative: {},
    };

    const equipped = this.getEquippedCards();

    // Track how many times each stat has been added (for diminishing returns)
    const statOccurrences: Partial<Record<CardStat, number>> = {};

    for (const card of equipped) {
      for (const mod of card.modifiers) {
        if (mod.modifierType === "additive") {
          const occurrences = statOccurrences[mod.stat] ?? 0;
          let effectiveValue = mod.value;

          if (this.params.diminishingReturns && occurrences > 0) {
            effectiveValue *= Math.pow(
              this.params.diminishingFactor,
              occurrences,
            );
          }

          result.additive[mod.stat] =
            (result.additive[mod.stat] ?? 0) + effectiveValue;
          statOccurrences[mod.stat] = occurrences + 1;
        } else {
          // Multiplicative: multiply together
          result.multiplicative[mod.stat] =
            (result.multiplicative[mod.stat] ?? 1) * mod.value;
        }
      }
    }

    // Apply stat caps
    for (const [stat, value] of Object.entries(result.additive)) {
      const cap = this.params.statCaps[stat as CardStat];
      if (cap) {
        if (cap.max !== undefined && value > cap.max)
          result.additive[stat as CardStat] = cap.max;
        if (cap.min !== undefined && value < cap.min)
          result.additive[stat as CardStat] = cap.min;
      }
    }

    for (const [stat, value] of Object.entries(result.multiplicative)) {
      const cap = this.params.statCaps[stat as CardStat];
      if (cap) {
        if (cap.max !== undefined && value > cap.max)
          result.multiplicative[stat as CardStat] = cap.max;
        if (cap.min !== undefined && value < cap.min)
          result.multiplicative[stat as CardStat] = cap.min;
      }
    }

    return result;
  }

  applyToPlayerParams(baseParams: PlayerParams): PlayerParams {
    const mods = this.computeModifiers();
    const result = { ...baseParams };

    // Additive stats
    result.maxRunSpeed += mods.additive.maxRunSpeed ?? 0;
    result.jumpSpeed += mods.additive.jumpSpeed ?? 0;
    result.dashSpeed += mods.additive.dashSpeed ?? 0;
    result.airAcceleration += mods.additive.airAcceleration ?? 0;
    result.coyoteFrames += mods.additive.coyoteFrames ?? 0;
    result.jumpBufferFrames += mods.additive.jumpBufferFrames ?? 0;
    result.wallJumpHorizontalSpeed +=
      mods.additive.wallJumpHorizontalSpeed ?? 0;
    result.wallSlideGripSpeed += mods.additive.wallSlideGripSpeed ?? 0;

    // dashCooldownReduction is subtractive
    const cdReduction = mods.additive.dashCooldownReduction ?? 0;
    result.dashCooldownFrames = Math.max(
      4,
      result.dashCooldownFrames - cdReduction,
    );

    // Apply stat caps to final values
    const caps = this.params.statCaps;
    if (caps.maxRunSpeed?.max)
      result.maxRunSpeed = Math.min(result.maxRunSpeed, caps.maxRunSpeed.max);
    if (caps.jumpSpeed?.max)
      result.jumpSpeed = Math.min(result.jumpSpeed, caps.jumpSpeed.max);
    if (caps.dashSpeed?.max)
      result.dashSpeed = Math.min(result.dashSpeed, caps.dashSpeed.max);
    if (caps.coyoteFrames?.max)
      result.coyoteFrames = Math.min(
        result.coyoteFrames,
        caps.coyoteFrames.max,
      );
    if (caps.jumpBufferFrames?.max)
      result.jumpBufferFrames = Math.min(
        result.jumpBufferFrames,
        caps.jumpBufferFrames.max,
      );

    // Round frame-count stats
    result.coyoteFrames = Math.round(result.coyoteFrames);
    result.jumpBufferFrames = Math.round(result.jumpBufferFrames);
    result.dashCooldownFrames = Math.round(result.dashCooldownFrames);

    return result;
  }

  applyToCombatParams(baseParams: CombatParams): CombatParams {
    const mods = this.computeModifiers();
    const result = { ...baseParams };

    // Additive
    result.spearDamage += mods.additive.spearDamage ?? 0;
    result.snapDamage += mods.additive.snapDamage ?? 0;
    result.spearReach += mods.additive.spearReach ?? 0;
    result.snapRadius += mods.additive.snapRadius ?? 0;

    // Apply stat caps
    const caps = this.params.statCaps;
    if (caps.spearDamage?.max)
      result.spearDamage = Math.min(result.spearDamage, caps.spearDamage.max);
    if (caps.snapDamage?.max)
      result.snapDamage = Math.min(result.snapDamage, caps.snapDamage.max);

    // attackSpeedBoost: multiply all frame-count params
    const attackMul = mods.multiplicative.attackSpeedBoost ?? 1;
    result.spearWindupFrames = Math.max(
      1,
      Math.round(result.spearWindupFrames * attackMul),
    );
    result.spearActiveFrames = Math.max(
      1,
      Math.round(result.spearActiveFrames * attackMul),
    );
    result.spearRecoveryFrames = Math.max(
      1,
      Math.round(result.spearRecoveryFrames * attackMul),
    );
    result.snapWindupFrames = Math.max(
      1,
      Math.round(result.snapWindupFrames * attackMul),
    );
    result.snapActiveFrames = Math.max(
      1,
      Math.round(result.snapActiveFrames * attackMul),
    );
    result.snapRecoveryFrames = Math.max(
      1,
      Math.round(result.snapRecoveryFrames * attackMul),
    );

    return result;
  }

  applyToHealthParams(baseParams: PlayerHealthParams): PlayerHealthParams {
    const mods = this.computeModifiers();
    const result = { ...baseParams };

    // Additive
    result.maxHealth += mods.additive.maxHealth ?? 0;
    result.invincibilityFrames += mods.additive.invincibilityFrames ?? 0;

    // knockbackResistance reduces knockbackSpeed
    const kbMul = mods.multiplicative.knockbackResistance ?? 1;
    result.knockbackSpeed = Math.max(0, result.knockbackSpeed * kbMul);

    // Caps
    const caps = this.params.statCaps;
    if (caps.maxHealth?.max)
      result.maxHealth = Math.min(result.maxHealth, caps.maxHealth.max);

    // Round frame stats
    result.invincibilityFrames = Math.round(result.invincibilityFrames);

    return result;
  }

  getModifierSummary(
    basePlayerParams: PlayerParams,
    baseCombatParams: CombatParams,
    baseHealthParams: PlayerHealthParams,
  ): ModifierSummaryEntry[] {
    const entries: ModifierSummaryEntry[] = [];
    const mods = this.computeModifiers();
    const equipped = this.getEquippedCards();

    const modifiedPlayer = this.applyToPlayerParams(basePlayerParams);
    const modifiedCombat = this.applyToCombatParams(baseCombatParams);
    const modifiedHealth = this.applyToHealthParams(baseHealthParams);

    // Helper to find cards contributing to a stat
    const sourcesForStat = (stat: CardStat): string[] =>
      equipped
        .filter((c) => c.modifiers.some((m) => m.stat === stat))
        .map((c) => c.name);

    // Build entries for each stat with active modifications
    const allModifiedStats = new Set([
      ...Object.keys(mods.additive),
      ...Object.keys(mods.multiplicative),
    ]);

    for (const statStr of allModifiedStats) {
      const stat = statStr as CardStat;
      const sources = sourcesForStat(stat);
      if (sources.length === 0) continue;

      let baseValue = 0;
      let modifiedValue = 0;

      switch (stat) {
        case "maxRunSpeed":
          baseValue = basePlayerParams.maxRunSpeed;
          modifiedValue = modifiedPlayer.maxRunSpeed;
          break;
        case "jumpSpeed":
          baseValue = basePlayerParams.jumpSpeed;
          modifiedValue = modifiedPlayer.jumpSpeed;
          break;
        case "dashSpeed":
          baseValue = basePlayerParams.dashSpeed;
          modifiedValue = modifiedPlayer.dashSpeed;
          break;
        case "airAcceleration":
          baseValue = basePlayerParams.airAcceleration;
          modifiedValue = modifiedPlayer.airAcceleration;
          break;
        case "dashCooldownReduction":
          baseValue = basePlayerParams.dashCooldownFrames;
          modifiedValue = modifiedPlayer.dashCooldownFrames;
          break;
        case "coyoteFrames":
          baseValue = basePlayerParams.coyoteFrames;
          modifiedValue = modifiedPlayer.coyoteFrames;
          break;
        case "jumpBufferFrames":
          baseValue = basePlayerParams.jumpBufferFrames;
          modifiedValue = modifiedPlayer.jumpBufferFrames;
          break;
        case "wallJumpHorizontalSpeed":
          baseValue = basePlayerParams.wallJumpHorizontalSpeed;
          modifiedValue = modifiedPlayer.wallJumpHorizontalSpeed;
          break;
        case "wallSlideGripSpeed":
          baseValue = basePlayerParams.wallSlideGripSpeed;
          modifiedValue = modifiedPlayer.wallSlideGripSpeed;
          break;
        case "spearDamage":
          baseValue = baseCombatParams.spearDamage;
          modifiedValue = modifiedCombat.spearDamage;
          break;
        case "snapDamage":
          baseValue = baseCombatParams.snapDamage;
          modifiedValue = modifiedCombat.snapDamage;
          break;
        case "spearReach":
          baseValue = baseCombatParams.spearReach;
          modifiedValue = modifiedCombat.spearReach;
          break;
        case "snapRadius":
          baseValue = baseCombatParams.snapRadius;
          modifiedValue = modifiedCombat.snapRadius;
          break;
        case "attackSpeedBoost":
          baseValue = 1.0;
          modifiedValue = mods.multiplicative.attackSpeedBoost ?? 1;
          break;
        case "maxHealth":
          baseValue = baseHealthParams.maxHealth;
          modifiedValue = modifiedHealth.maxHealth;
          break;
        case "invincibilityFrames":
          baseValue = baseHealthParams.invincibilityFrames;
          modifiedValue = modifiedHealth.invincibilityFrames;
          break;
        case "knockbackResistance":
          baseValue = 1.0;
          modifiedValue = mods.multiplicative.knockbackResistance ?? 1;
          break;
        case "abilityCooldownReduction":
          baseValue = 1.0;
          modifiedValue = mods.multiplicative.abilityCooldownReduction ?? 1;
          break;
        case "abilityDurationBoost":
          baseValue = 1.0;
          modifiedValue = mods.multiplicative.abilityDurationBoost ?? 1;
          break;
        case "abilityRangeBoost":
          baseValue = 1.0;
          modifiedValue = mods.multiplicative.abilityRangeBoost ?? 1;
          break;
      }

      const diff = modifiedValue - baseValue;
      const isFrameCount = FRAME_COUNT_STATS.has(stat);
      let change: string;
      if (
        stat === "attackSpeedBoost" ||
        stat === "knockbackResistance" ||
        stat === "abilityCooldownReduction" ||
        stat === "abilityDurationBoost" ||
        stat === "abilityRangeBoost"
      ) {
        change = `×${modifiedValue.toFixed(2)}`;
      } else if (isFrameCount) {
        change = diff >= 0 ? `+${Math.round(diff)}` : `${Math.round(diff)}`;
      } else {
        change = diff >= 0 ? `+${Math.round(diff)}` : `${Math.round(diff)}`;
      }

      entries.push({
        stat,
        displayName: STAT_DISPLAY_NAMES[stat],
        baseValue,
        modifiedValue,
        change,
        sourceCards: sources,
      });
    }

    return entries;
  }

  getDeck(): CardDeck {
    return this.deck;
  }
}
