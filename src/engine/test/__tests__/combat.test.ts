import { describe, it, expect } from "vitest";
import { GameTestHarness } from "../GameTestHarness";
import { CombatSystem } from "@/engine/combat/CombatSystem";
import { DEFAULT_COMBAT_PARAMS } from "@/engine/combat/CombatParams";
import { DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";
import type { Rect } from "@/lib/types";

describe("combat system", () => {
  /** Standard player bounds for unit tests that don't need player physics. */
  const PLAYER_BOUNDS: Rect = { x: 100, y: 260, width: 24, height: 40 };
  const PLAYER_CENTER = {
    x: PLAYER_BOUNDS.x + PLAYER_BOUNDS.width / 2,
    y: PLAYER_BOUNDS.y + PLAYER_BOUNDS.height / 2,
  };

  /** Create a grounded player on a floor for integration tests. */
  function standingOnFloor() {
    const h = new GameTestHarness();
    h.addFloor(300);
    h.setPlayerPosition(400, 300 - DEFAULT_PLAYER_PARAMS.playerHeight);
    h.tick();
    return h;
  }

  /** Advance a combat system through N ticks with fixed bounds. */
  function tickCombat(
    combat: CombatSystem,
    n: number,
    bounds: Rect = PLAYER_BOUNDS,
    facingRight: boolean = true,
  ): void {
    for (let i = 0; i < n; i++) {
      combat.update(bounds, facingRight);
    }
  }

  // ── 1. Attack Phase Lifecycle — Quill-Spear ──────────────────

  it("spear attack cycles through idle → windup → active → recovery → idle", () => {
    const combat = new CombatSystem();

    expect(combat.attackPhase).toBe("idle");

    combat.startSpearAttack("right");
    expect(combat.attackPhase).toBe("windup");

    // Tick through windup
    tickCombat(combat, DEFAULT_COMBAT_PARAMS.spearWindupFrames);
    expect(combat.attackPhase).toBe("active");

    // Tick through active
    tickCombat(combat, DEFAULT_COMBAT_PARAMS.spearActiveFrames);
    expect(combat.attackPhase).toBe("recovery");

    // Tick through recovery
    tickCombat(combat, DEFAULT_COMBAT_PARAMS.spearRecoveryFrames);
    expect(combat.attackPhase).toBe("idle");

    // Cooldown should be set
    expect(combat.cooldownTimer).toBe(DEFAULT_COMBAT_PARAMS.spearCooldownFrames);
  });

  // ── 2. Attack Phase Lifecycle — Ink Snap ─────────────────────

  it("snap attack cycles through idle → windup → active → recovery → idle", () => {
    const combat = new CombatSystem();

    combat.startSnapAttack(null, null, true);
    expect(combat.attackPhase).toBe("windup");

    tickCombat(combat, DEFAULT_COMBAT_PARAMS.snapWindupFrames);
    expect(combat.attackPhase).toBe("active");

    tickCombat(combat, DEFAULT_COMBAT_PARAMS.snapActiveFrames);
    expect(combat.attackPhase).toBe("recovery");

    tickCombat(combat, DEFAULT_COMBAT_PARAMS.snapRecoveryFrames);
    expect(combat.attackPhase).toBe("idle");

    expect(combat.cooldownTimer).toBe(DEFAULT_COMBAT_PARAMS.snapCooldownFrames);
  });

  // ── 3. Hitbox Appears During Active Phase Only ───────────────

  it("hitbox is non-null only during active phase", () => {
    const combat = new CombatSystem();

    // Idle — no hitbox
    expect(combat.activeHitbox).toBeNull();

    combat.startSpearAttack("right");

    // Windup — no hitbox
    for (let i = 0; i < DEFAULT_COMBAT_PARAMS.spearWindupFrames; i++) {
      expect(combat.activeHitbox).toBeNull();
      combat.update(PLAYER_BOUNDS, true);
    }

    // Active — hitbox present
    expect(combat.attackPhase).toBe("active");
    expect(combat.activeHitbox).not.toBeNull();

    for (let i = 0; i < DEFAULT_COMBAT_PARAMS.spearActiveFrames; i++) {
      expect(combat.activeHitbox).not.toBeNull();
      combat.update(PLAYER_BOUNDS, true);
    }

    // Recovery — no hitbox
    expect(combat.attackPhase).toBe("recovery");
    expect(combat.activeHitbox).toBeNull();

    tickCombat(combat, DEFAULT_COMBAT_PARAMS.spearRecoveryFrames);

    // Back to idle — no hitbox
    expect(combat.attackPhase).toBe("idle");
    expect(combat.activeHitbox).toBeNull();
  });

  // ── 4. Hitbox Absent During Windup and Recovery ──────────────

  it("no hitbox during windup or recovery", () => {
    const combat = new CombatSystem();

    combat.startSpearAttack("right");

    // Check every frame of windup
    for (let i = 0; i < DEFAULT_COMBAT_PARAMS.spearWindupFrames; i++) {
      expect(combat.activeHitbox).toBeNull();
      combat.update(PLAYER_BOUNDS, true);
    }

    // Skip active phase
    tickCombat(combat, DEFAULT_COMBAT_PARAMS.spearActiveFrames);
    expect(combat.attackPhase).toBe("recovery");

    // Check every frame of recovery
    for (let i = 0; i < DEFAULT_COMBAT_PARAMS.spearRecoveryFrames; i++) {
      expect(combat.activeHitbox).toBeNull();
      combat.update(PLAYER_BOUNDS, true);
    }
  });

  // ── 5. Hitbox Faces Right When Facing Right ──────────────────

  it("spear hitbox extends to the right of player", () => {
    const combat = new CombatSystem();
    combat.startSpearAttack("right");

    tickCombat(combat, DEFAULT_COMBAT_PARAMS.spearWindupFrames);
    expect(combat.attackPhase).toBe("active");
    expect(combat.activeHitbox).not.toBeNull();

    const hitbox = combat.activeHitbox!;
    const playerRight = PLAYER_BOUNDS.x + PLAYER_BOUNDS.width;
    expect(hitbox.rect.x).toBeGreaterThanOrEqual(playerRight);
  });

  // ── 6. Hitbox Faces Left When Facing Left ────────────────────

  it("spear hitbox extends to the left of player", () => {
    const combat = new CombatSystem();
    combat.startSpearAttack("left");

    tickCombat(combat, DEFAULT_COMBAT_PARAMS.spearWindupFrames);
    expect(combat.attackPhase).toBe("active");
    expect(combat.activeHitbox).not.toBeNull();

    const hitbox = combat.activeHitbox!;
    const hitboxRight = hitbox.rect.x + hitbox.rect.width;
    expect(hitboxRight).toBeLessThanOrEqual(PLAYER_BOUNDS.x);
  });

  // ── 7. Weapon Switch ─────────────────────────────────────────

  it("weapon switch toggles between quill-spear and ink-snap", () => {
    const combat = new CombatSystem();
    expect(combat.currentWeapon).toBe("quill-spear");

    // Switch weapon (done at test-page level by setting directly)
    combat.currentWeapon = "ink-snap";
    expect(combat.currentWeapon).toBe("ink-snap");

    // Start a snap attack — verify it uses snap params
    combat.startSnapAttack(null, null, true);
    expect(combat.currentWeapon).toBe("ink-snap");

    tickCombat(combat, DEFAULT_COMBAT_PARAMS.snapWindupFrames);
    expect(combat.attackPhase).toBe("active");

    // Snap hitbox should use snapRadius
    const hitbox = combat.activeHitbox!;
    expect(hitbox.weapon).toBe("ink-snap");
    expect(hitbox.rect.width).toBe(DEFAULT_COMBAT_PARAMS.snapRadius * 2);
    expect(hitbox.rect.height).toBe(DEFAULT_COMBAT_PARAMS.snapRadius * 2);
  });

  // ── 8. Cooldown Prevents Rapid Attack ────────────────────────

  it("cannot attack during cooldown", () => {
    const combat = new CombatSystem();

    combat.startSpearAttack("right");

    // Complete full cycle
    const totalFrames =
      DEFAULT_COMBAT_PARAMS.spearWindupFrames +
      DEFAULT_COMBAT_PARAMS.spearActiveFrames +
      DEFAULT_COMBAT_PARAMS.spearRecoveryFrames;
    tickCombat(combat, totalFrames);

    expect(combat.attackPhase).toBe("idle");
    expect(combat.cooldownTimer).toBeGreaterThan(0);
    expect(combat.canAttack("IDLE")).toBe(false);

    // Tick through cooldown
    tickCombat(combat, DEFAULT_COMBAT_PARAMS.spearCooldownFrames);
    expect(combat.cooldownTimer).toBe(0);
    expect(combat.canAttack("IDLE")).toBe(true);
  });

  // ── 9. Cannot Attack During HARD_LANDING ─────────────────────

  it("cannot attack while in HARD_LANDING state", () => {
    const combat = new CombatSystem();
    expect(combat.canAttack("HARD_LANDING")).toBe(false);
  });

  // ── 10. Can Attack During DASHING ────────────────────────────

  it("can attack while dashing", () => {
    const combat = new CombatSystem();
    expect(combat.canAttack("DASHING")).toBe(true);
  });

  // ── 11. Can Attack During WALL_SLIDING ───────────────────────

  it("can attack while wall sliding", () => {
    const combat = new CombatSystem();
    expect(combat.canAttack("WALL_SLIDING")).toBe(true);
  });

  // ── 12. Directional Attack — Up ──────────────────────────────

  it("upward spear attack has hitbox above player", () => {
    const combat = new CombatSystem();
    combat.startSpearAttack("up");

    tickCombat(combat, DEFAULT_COMBAT_PARAMS.spearWindupFrames);
    expect(combat.activeHitbox).not.toBeNull();

    const hitbox = combat.activeHitbox!;
    const hitboxBottom = hitbox.rect.y + hitbox.rect.height;
    expect(hitboxBottom).toBeLessThanOrEqual(PLAYER_BOUNDS.y);
  });

  // ── 13. Directional Attack — Down ────────────────────────────

  it("downward spear attack has hitbox below player", () => {
    const combat = new CombatSystem();
    combat.startSpearAttack("down");

    tickCombat(combat, DEFAULT_COMBAT_PARAMS.spearWindupFrames);
    expect(combat.activeHitbox).not.toBeNull();

    const hitbox = combat.activeHitbox!;
    const playerBottom = PLAYER_BOUNDS.y + PLAYER_BOUNDS.height;
    expect(hitbox.rect.y).toBeGreaterThanOrEqual(playerBottom);
  });

  // ── 14. Diagonal Attack ──────────────────────────────────────

  it("diagonal spear attack has hitbox in the correct quadrant", () => {
    const combat = new CombatSystem();
    combat.startSpearAttack("up-right");

    tickCombat(combat, DEFAULT_COMBAT_PARAMS.spearWindupFrames);
    expect(combat.activeHitbox).not.toBeNull();

    const hitbox = combat.activeHitbox!;
    const hitboxCenterX = hitbox.rect.x + hitbox.rect.width / 2;
    const hitboxCenterY = hitbox.rect.y + hitbox.rect.height / 2;

    // Hitbox center should be to the right of and above the player center
    expect(hitboxCenterX).toBeGreaterThan(PLAYER_CENTER.x);
    expect(hitboxCenterY).toBeLessThan(PLAYER_CENTER.y);
  });

  // ── 15. Hitbox Follows Player ────────────────────────────────

  it("hitbox position updates when player moves during active phase", () => {
    const h = standingOnFloor();
    const combat = h.enableCombat();

    combat.startSpearAttack("right");

    // Tick through windup (harness updates combat automatically)
    h.tickN(DEFAULT_COMBAT_PARAMS.spearWindupFrames);
    expect(combat.attackPhase).toBe("active");
    expect(combat.activeHitbox).not.toBeNull();

    const hitboxX1 = combat.activeHitbox!.rect.x;

    // Move player right
    h.pressRight();
    h.tickN(3);

    expect(combat.activeHitbox).not.toBeNull();
    const hitboxX2 = combat.activeHitbox!.rect.x;

    // Hitbox should have moved with the player
    expect(hitboxX2).toBeGreaterThan(hitboxX1);
  });

  // ── 16. Snap Auto-Aim Target Finding ─────────────────────────

  it("findSnapTarget returns nearest target within range", () => {
    const combat = new CombatSystem();

    const targets = [
      { id: "close", bounds: { x: 180, y: 260, width: 24, height: 40 } },
      { id: "far", bounds: { x: 500, y: 260, width: 24, height: 40 } },
    ];

    const result = combat.findSnapTarget(PLAYER_CENTER, targets);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("close");
  });

  // ── 17. Snap Auto-Aim No Target ──────────────────────────────

  it("findSnapTarget returns null when no targets in range", () => {
    const combat = new CombatSystem();

    const targets = [
      { id: "far1", bounds: { x: 500, y: 260, width: 24, height: 40 } },
      { id: "far2", bounds: { x: 600, y: 260, width: 24, height: 40 } },
    ];

    const result = combat.findSnapTarget(PLAYER_CENTER, targets);
    expect(result).toBeNull();
  });

  // ── 18. Hit Detection ────────────────────────────────────────

  it("checkHits detects overlap between hitbox and target", () => {
    const combat = new CombatSystem();
    combat.startSpearAttack("right");

    tickCombat(combat, DEFAULT_COMBAT_PARAMS.spearWindupFrames);
    expect(combat.attackPhase).toBe("active");

    // Place a target overlapping the hitbox area (to the right of player bounds)
    const hitbox = combat.activeHitbox!;
    const target = {
      id: "enemy1",
      bounds: {
        x: hitbox.rect.x + 4,
        y: hitbox.rect.y,
        width: 24,
        height: 40,
      },
    };

    const hits = combat.checkHits([target]);
    expect(hits).toHaveLength(1);
    expect(hits[0].targetId).toBe("enemy1");
    expect(hits[0].damage).toBe(DEFAULT_COMBAT_PARAMS.spearDamage);
  });

  // ── 19. Multi-Hit Prevention ─────────────────────────────────

  it("same target is not hit twice by the same attack", () => {
    const combat = new CombatSystem();
    combat.startSpearAttack("right");

    tickCombat(combat, DEFAULT_COMBAT_PARAMS.spearWindupFrames);
    expect(combat.attackPhase).toBe("active");

    const hitbox = combat.activeHitbox!;
    const target = {
      id: "enemy1",
      bounds: {
        x: hitbox.rect.x + 4,
        y: hitbox.rect.y,
        width: 24,
        height: 40,
      },
    };

    const firstHits = combat.checkHits([target]);
    expect(firstHits).toHaveLength(1);

    const secondHits = combat.checkHits([target]);
    expect(secondHits).toHaveLength(0);
  });

  // ── 20. Snap Hitbox Centered on Target ───────────────────────

  it("ink-snap hitbox centers on the target position", () => {
    const targetPos = { x: 200, y: 270 };
    const combat = new CombatSystem();

    combat.startSnapAttack(targetPos, "target1", true);

    tickCombat(combat, DEFAULT_COMBAT_PARAMS.snapWindupFrames);
    expect(combat.attackPhase).toBe("active");
    expect(combat.activeHitbox).not.toBeNull();

    const hitbox = combat.activeHitbox!;
    const hitboxCenterX = hitbox.rect.x + hitbox.rect.width / 2;
    const hitboxCenterY = hitbox.rect.y + hitbox.rect.height / 2;

    expect(hitboxCenterX).toBeCloseTo(targetPos.x, 0);
    expect(hitboxCenterY).toBeCloseTo(targetPos.y, 0);
  });

  // ── 21. Spear Damage Value ───────────────────────────────────

  it("spear attack deals spearDamage", () => {
    const combat = new CombatSystem();
    combat.startSpearAttack("right");

    tickCombat(combat, DEFAULT_COMBAT_PARAMS.spearWindupFrames);

    const hitbox = combat.activeHitbox!;
    const target = {
      id: "enemy1",
      bounds: {
        x: hitbox.rect.x + 4,
        y: hitbox.rect.y,
        width: 24,
        height: 40,
      },
    };

    const hits = combat.checkHits([target]);
    expect(hits).toHaveLength(1);
    expect(hits[0].damage).toBe(DEFAULT_COMBAT_PARAMS.spearDamage);
  });

  // ── 22. Snap Damage Value ────────────────────────────────────

  it("snap attack deals snapDamage", () => {
    const targetPos = { x: 200, y: 270 };
    const combat = new CombatSystem();

    combat.startSnapAttack(targetPos, "target1", true);

    tickCombat(combat, DEFAULT_COMBAT_PARAMS.snapWindupFrames);

    const hitbox = combat.activeHitbox!;
    // Place target at the snap center (will overlap)
    const target = {
      id: "enemy1",
      bounds: {
        x: targetPos.x - 12,
        y: targetPos.y - 20,
        width: 24,
        height: 40,
      },
    };

    const hits = combat.checkHits([target]);
    expect(hits).toHaveLength(1);
    expect(hits[0].damage).toBe(DEFAULT_COMBAT_PARAMS.snapDamage);
  });
});
