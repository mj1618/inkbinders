# Task: Ink Card System Headless Tests

## What to Build

Create comprehensive headless tests for the ink card system: card creation, crafting, stat modification with diminishing returns, equip/unequip, and stat caps.

**File:** `src/engine/test/__tests__/ink-cards.test.ts` (new)

## Context

The ink card system spans 4 files in `src/engine/cards/`:
- `InkCard.ts` — types, interfaces, constants
- `CardDefinitions.ts` — 14 card definitions × 3 tiers, `createCard()` factory
- `CraftingSystem.ts` — same-definition crafting (2 cards → 1 higher tier)
- `CardModifierEngine.ts` — stat computation with diminishing returns and caps

Key imports:
```typescript
import {
  type InkCard, type CardDeck, type CardCategory, type CardTier, type CardStat,
  createCard, getAllCardDefinitions, getCardDefinitionsByCategory,
  CardModifierEngine, CraftingSystem,
  DEFAULT_CARD_ENGINE_PARAMS, DEFAULT_CRAFTING_PARAMS,
} from "@/engine/cards";
import { DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";
import { DEFAULT_COMBAT_PARAMS } from "@/engine/combat/CombatParams";
import { DEFAULT_PLAYER_HEALTH_PARAMS } from "@/engine/combat/PlayerHealth";
```

## Test Cases

### describe("Card creation")

1. **createCard produces valid InkCard**: `createCard("swift-strider", 1)` returns an object with `name`, `category: "swiftness"`, `tier: 1`, `glyph`, `description`, `modifiers` array, `definitionId: "swift-strider"`, and a non-empty `id`.

2. **Card tiers have increasing stat values**: Create `swift-strider` at tiers 1, 2, 3. The additive modifier on `maxRunSpeed` should increase: tier1 = +20, tier2 = +40, tier3 = +60.

3. **Each category has definitions**: For each category ("swiftness", "might", "resilience", "precision", "arcana"), `getCardDefinitionsByCategory(category)` should return at least 2 definitions.

4. **getAllCardDefinitions returns all 14**: `getAllCardDefinitions().length` should be 14 (verify against actual count — may be 15 if the 15th was added).

5. **createCard with unknown definition throws**: `createCard("nonexistent", 1)` should throw an error.

6. **Each card has unique ID**: Create 3 cards with the same definition and tier. All `.id` values should be different.

### describe("CardModifierEngine — equip/unequip")

7. **Equip card adds to equipped list**: Create engine, add card to collection, equip it. `getEquippedCards()` should contain the card.

8. **Unequip card removes from equipped**: Equip a card, then unequip it. `getEquippedCards()` should be empty.

9. **Max 4 equipped**: Add 5 cards to collection, equip 4. Fifth equip should return `false`. `getEquippedCards().length` should be 4.

10. **Cannot equip card not in collection**: `equipCard("nonexistent-id")` should return `false`.

11. **removeFromCollection also unequips**: Add and equip a card. Remove it from collection. `getEquippedCards()` should be empty.

### describe("CardModifierEngine — stat modification")

12. **Equipped card modifies player params**: Equip a `swift-strider` tier 1 (+20 maxRunSpeed). `applyToPlayerParams(DEFAULT_PLAYER_PARAMS).maxRunSpeed` should be `DEFAULT_PLAYER_PARAMS.maxRunSpeed + 20`.

13. **Unequipped card does not modify params**: Add a card to collection but don't equip it. `applyToPlayerParams(DEFAULT_PLAYER_PARAMS)` should return unmodified params.

14. **Multiplicative modifier applies correctly**: Equip a `battle-tempo` tier 1 (×0.9 attack frames). `applyToCombatParams(DEFAULT_COMBAT_PARAMS)` should have all frame counts multiplied by 0.9 (rounded down, min 1).

15. **applyToPlayerParams returns new object**: The returned params should not be the same reference as the input.

16. **applyToCombatParams modifies combat stats**: Equip `spear-verse` tier 1 (+1 spearDamage). `applyToCombatParams(DEFAULT_COMBAT_PARAMS).spearDamage` should be `DEFAULT_COMBAT_PARAMS.spearDamage + 1`.

17. **applyToHealthParams modifies health**: Equip `vellum-shield` tier 1 (+1 maxHealth). `applyToHealthParams(DEFAULT_PLAYER_HEALTH_PARAMS).maxHealth` should be `DEFAULT_PLAYER_HEALTH_PARAMS.maxHealth + 1`.

### describe("CardModifierEngine — diminishing returns")

18. **Second card on same stat applies at 0.7× rate**: Equip two different swiftness cards that both boost `maxRunSpeed`. First card adds full value, second card adds value × 0.7. Verify total is less than 2× a single card's boost.

    Example: Equip `swift-strider` T1 (+20) and `swift-strider` T2 (+40). Total maxRunSpeed boost should be 20 + (40 × 0.7) = 48, so `maxRunSpeed = base + 48`.

    Note: You may need two different-tier or different-definition cards that both have the same stat, since `allowDuplicates` defaults to false. Check if two swift-striders of different tiers count as duplicates. If they do, use two different definitions that both boost the same stat.

19. **Diminishing returns disabled**: Create engine with `{ diminishingReturns: false }`. Equip two cards boosting the same stat. Total should be the simple sum (no 0.7× factor).

### describe("CardModifierEngine — stat caps")

20. **maxRunSpeed capped at 500**: Equip cards that would push maxRunSpeed beyond 500. Verify the result is capped at 500.

21. **maxHealth capped at 10**: Equip cards that would push maxHealth beyond 10. Verify cap.

22. **attackSpeedBoost minimum 0.5**: Equip enough battle-tempo cards to push the multiplier below 0.5. Verify it floors at 0.5.

23. **Frame counts rounded to integers**: Equip a card that modifies `coyoteFrames`. Verify the result is an integer (use `Math.floor` or similar).

### describe("CraftingSystem")

24. **Craft same tier produces next tier**: Create 2 `swift-strider` T1 cards. Craft them. Result should be a `swift-strider` T2 card.

25. **Cannot craft tier 3**: Create 2 `swift-strider` T3 cards. `getAvailableCrafts()` should not include a recipe for this pair.

26. **getAvailableCrafts finds eligible pairs**: Add 2 `swift-strider` T1 and 2 `leap-glyph` T1 to collection. `getAvailableCrafts()` should return 2 recipes.

27. **canCraft returns true for valid recipe**: With 2 matching cards in collection, `canCraft()` should return `true`.

28. **canCraft returns false with insufficient cards**: With only 1 card of a definition+tier, `canCraft()` for that recipe should return `false`.

29. **craft returns consumed and produced**: `craft()` result should have `consumed` (array of 2 input cards) and `produced` (1 card of next tier).

30. **craft returns null if not craftable**: Attempting to craft with insufficient cards returns `null`.

31. **craft does not mutate collection**: Pass a collection array to `craft()`. The original array length should be unchanged after the call.

### describe("Card definitions — category coverage")

32. **Swiftness cards exist**: At least 3 definitions in "swiftness" category: swift-strider, leap-glyph, dash-inscription.

33. **Might cards exist**: At least 3 definitions: spear-verse, snap-verse, battle-tempo.

34. **Resilience cards exist**: At least 3 definitions: vellum-shield, ward-inscription, stoic-page.

35. **Precision cards exist**: At least 2 definitions: ledge-reader, wall-binding.

36. **Arcana cards exist**: At least 3 definitions: scribes-haste, ink-well, margin-expander.

## Specific Values Reference

**Card stat modifications (tier 1 values, for test assertions):**
- swift-strider: +20 maxRunSpeed
- leap-glyph: +25 jumpSpeed
- dash-inscription: +40 dashSpeed, -1 dashCooldownReduction
- spear-verse: +1 spearDamage
- snap-verse: +1 snapDamage
- battle-tempo: ×0.9 (all attack frame counts)
- vellum-shield: +1 maxHealth
- ward-inscription: +10 invincibilityFrames
- ledge-reader: +2 coyoteFrames, +1 jumpBufferFrames
- scribes-haste: ×0.9 abilityCooldownReduction

**Stat caps (DEFAULT_CARD_ENGINE_PARAMS):**
- maxRunSpeed: max 500
- jumpSpeed: max 600
- dashSpeed: max 900
- spearDamage: max 5
- snapDamage: max 6
- maxHealth: max 10
- coyoteFrames: max 15
- jumpBufferFrames: max 12
- attackSpeedBoost: min 0.5
- knockbackResistance: min 0.3
- abilityCooldownReduction: min 0.5

**Crafting defaults:**
- cardsPerUpgrade: 2
- allowCrossCategoryCraft: false

**Diminishing returns:**
- diminishingFactor: 0.7
- Applied per-stat: 2nd additive stack is × 0.7, 3rd is × 0.7², etc.

## Verification

- Run `npm run test:run -- --reporter=verbose ink-cards` — all tests pass
- Run `npx tsc --noEmit` — no type errors
- Use imported constants (DEFAULT_*_PARAMS, stat caps) rather than hardcoded values

## Notes

- `createCard()` generates non-deterministic IDs (includes timestamp). Always capture the returned card's `.id` rather than constructing IDs manually.
- `CardModifierEngine.equipCard()` returns `false` for various failure modes (deck full, not in collection, duplicate). Test each failure mode.
- `craft()` does NOT mutate the input `collection` array — the caller is responsible for removing consumed cards. Verify this invariant.
- The `allowDuplicates` flag (default `false`) prevents equipping two cards with the same `definitionId` AND `tier`. Cards of different tiers from the same definition may or may not be considered duplicates — check the actual logic and write tests accordingly.
- For diminishing returns testing: you need two different cards that both modify the same stat. Check if different tiers of the same definition count as duplicates before relying on that approach.

---

## Implementation Summary

**Agent:** f6fa2d14 | **Date:** 2026-02-25

### Files Created
- `src/engine/test/__tests__/ink-cards.test.ts` — 49 tests across 6 describe blocks

### What Was Built
Comprehensive headless test suite for the ink card system covering:

1. **Card creation** (6 tests): Card factory, tier scaling, category filtering, unique IDs, error handling
2. **Equip/unequip** (8 tests): Equip/unequip, max 4 limit, collection membership, duplicate prevention (same definitionId+tier), different tiers allowed, double-equip prevention
3. **Stat modification** (10 tests): Player params (additive), combat params (spear damage), health params (maxHealth, invincibility, knockback resistance), multiplicative modifiers (attack speed), dash cooldown reduction (subtractive), multi-stat cards
4. **Diminishing returns** (3 tests): 0.7× factor on 2nd card same stat, disabled mode, single card no penalty
5. **Stat caps** (8 tests): maxRunSpeed cap, maxHealth cap at 10, attackSpeedBoost min floor, abilityCooldownReduction min floor, frame count rounding, default cap value verification
6. **Crafting** (8 tests): Tier upgrade, tier 3 not craftable, available craft detection, canCraft true/false, craft result structure, null on insufficient, collection immutability
7. **Category coverage** (6 tests): All 5 categories have expected definitions, all 15 definitions createable at all 3 tiers

### Corrections from Task Spec
- Actual definition count is **15** (not 14) — `air-script` is the 4th swiftness card
- `attackSpeedBoost` and `abilityCooldownReduction` min caps can't be triggered with available card tiers at default 0.5 (0.8 × 0.7 = 0.56 > 0.5) — tests use custom caps to verify capping logic works correctly, plus separate tests verify default cap values

### Verification
- `npm run test:run -- --reporter=verbose ink-cards` → 49/49 pass
- `npx tsc --noEmit` → 0 errors
- `npm run test:run` → 427/427 pass (no regressions)

---

## Review (agent 93afd85c)

**Result: PASS — no fixes needed.**

All 49 tests pass. Code reviewed for:
- Correct assertions against actual `CardModifierEngine`, `CraftingSystem`, and `createCard` behavior
- Proper type imports (no `any`), uses source constants rather than hardcoded values
- Diminishing returns testing correctly uses different tiers of same definition (allowed by duplicate check)
- Stat cap tests smartly use custom engine params to trigger capping, plus verify default cap values separately
- Crafting immutability invariant verified (collection array length unchanged after craft)
- Good edge case coverage: double-equip, max equipped, same-def-same-tier duplicate, unknown card equip
