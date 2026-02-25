import { describe, it, expect } from "vitest";
import { GameTestHarness } from "../GameTestHarness";
import { DEFAULT_PLAYER_HEALTH_PARAMS } from "@/engine/combat/PlayerHealth";

describe("health system", () => {
  /** Create a harness with a grounded player and health enabled. */
  function setup(healthParams?: Partial<typeof DEFAULT_PLAYER_HEALTH_PARAMS>) {
    const h = new GameTestHarness({
      platforms: [{ x: 0, y: 300, width: 960, height: 32 }],
    });
    h.setPlayerPosition(100, 260);
    h.tickUntil(() => h.grounded, 60);
    const health = h.enableHealth(healthParams);
    return { h, health };
  }

  // ── Basic Health ────────────────────────────────────────────────

  it("1. initial health equals maxHealth", () => {
    const { health } = setup();
    expect(health.health).toBe(DEFAULT_PLAYER_HEALTH_PARAMS.maxHealth);
    expect(health.maxHealth).toBe(DEFAULT_PLAYER_HEALTH_PARAMS.maxHealth);
  });

  it("2. takeDamage reduces health", () => {
    const { health } = setup();
    health.takeDamage(1, { x: 1, y: 0 }, "test");
    expect(health.health).toBe(DEFAULT_PLAYER_HEALTH_PARAMS.maxHealth - 1);
  });

  it("3. takeDamage returns true on success", () => {
    const { health } = setup();
    const result = health.takeDamage(1, { x: 1, y: 0 }, "test");
    expect(result).toBe(true);
  });

  it("4. multiple damage sources tracked", () => {
    const { h, health } = setup();
    health.takeDamage(1, { x: 1, y: 0 }, "spikes");
    expect(health.lastDamageSource).toBe("spikes");

    // Wait out invincibility
    h.tickN(DEFAULT_PLAYER_HEALTH_PARAMS.invincibilityFrames);
    health.takeDamage(1, { x: -1, y: 0 }, "enemy");
    expect(health.lastDamageSource).toBe("enemy");
  });

  it("5. totalDamageTaken accumulates", () => {
    const { h, health } = setup();
    health.takeDamage(1, { x: 1, y: 0 }, "a");

    // Wait out invincibility
    h.tickN(DEFAULT_PLAYER_HEALTH_PARAMS.invincibilityFrames);
    health.takeDamage(2, { x: 1, y: 0 }, "b");

    expect(health.totalDamageTaken).toBe(3);
  });

  // ── Invincibility Frames ────────────────────────────────────────

  it("6. invincibility starts after damage", () => {
    const { health } = setup();
    health.takeDamage(1, { x: 1, y: 0 }, "test");
    expect(health.invincibilityTimer).toBe(
      DEFAULT_PLAYER_HEALTH_PARAMS.invincibilityFrames,
    );
  });

  it("7. damage blocked during invincibility", () => {
    const { health } = setup();
    health.takeDamage(1, { x: 1, y: 0 }, "test");
    const healthAfterFirst = health.health;

    const result = health.takeDamage(1, { x: 1, y: 0 }, "test2");
    expect(result).toBe(false);
    expect(health.health).toBe(healthAfterFirst);
  });

  it("8. invincibility timer counts down each tick", () => {
    const { h, health } = setup();
    health.takeDamage(1, { x: 1, y: 0 }, "test");
    const initialTimer = health.invincibilityTimer;

    h.tick();
    expect(health.invincibilityTimer).toBe(initialTimer - 1);

    h.tickN(4);
    expect(health.invincibilityTimer).toBe(initialTimer - 5);
  });

  it("9. invincibility expires after full duration", () => {
    const { h, health } = setup();
    health.takeDamage(1, { x: 1, y: 0 }, "test");

    h.tickN(DEFAULT_PLAYER_HEALTH_PARAMS.invincibilityFrames);
    expect(health.invincibilityTimer).toBe(0);

    // Can take damage again
    const result = health.takeDamage(1, { x: 1, y: 0 }, "test2");
    expect(result).toBe(true);
  });

  it("10. can take damage again after invincibility expiry", () => {
    const { h, health } = setup();
    health.takeDamage(1, { x: 1, y: 0 }, "a");
    h.tickN(DEFAULT_PLAYER_HEALTH_PARAMS.invincibilityFrames);
    health.takeDamage(1, { x: 1, y: 0 }, "b");

    expect(health.health).toBe(DEFAULT_PLAYER_HEALTH_PARAMS.maxHealth - 2);
  });

  // ── Death ───────────────────────────────────────────────────────

  it("11. death at zero health", () => {
    const { health } = setup();
    health.takeDamage(DEFAULT_PLAYER_HEALTH_PARAMS.maxHealth, { x: 1, y: 0 }, "lethal");
    expect(health.health).toBe(0);
  });

  it("12. health cannot go negative", () => {
    const { health } = setup();
    health.takeDamage(DEFAULT_PLAYER_HEALTH_PARAMS.maxHealth + 10, { x: 1, y: 0 }, "overkill");
    expect(health.health).toBe(0);
  });

  it("13. no damage after death", () => {
    const { health } = setup();
    health.takeDamage(DEFAULT_PLAYER_HEALTH_PARAMS.maxHealth, { x: 1, y: 0 }, "lethal");
    expect(health.health).toBe(0);

    const result = health.takeDamage(1, { x: 1, y: 0 }, "post-death");
    expect(result).toBe(false);
    expect(health.health).toBe(0);
  });

  // ── Knockback ───────────────────────────────────────────────────

  it("14. knockback velocity exists after damage", () => {
    const { health } = setup();
    health.takeDamage(1, { x: 1, y: 0 }, "test");

    const kb = health.getKnockbackVelocity();
    expect(kb).not.toBeNull();
    expect(kb!.x).toBeGreaterThan(0);
  });

  it("15. knockback decays over time", () => {
    const { h, health } = setup();
    health.takeDamage(1, { x: 1, y: 0 }, "test");

    const kbInitial = health.getKnockbackVelocity()!;
    const initialMag = Math.sqrt(kbInitial.x ** 2 + kbInitial.y ** 2);

    h.tickN(3);

    const kbLater = health.getKnockbackVelocity()!;
    const laterMag = Math.sqrt(kbLater.x ** 2 + kbLater.y ** 2);

    expect(laterMag).toBeLessThan(initialMag);
  });

  it("16. knockback ends after duration", () => {
    const { h, health } = setup();
    health.takeDamage(1, { x: 1, y: 0 }, "test");

    h.tickN(DEFAULT_PLAYER_HEALTH_PARAMS.knockbackDuration);

    const kb = health.getKnockbackVelocity();
    expect(kb).toBeNull();
  });

  it("17. knockback direction matches input", () => {
    const { health } = setup();
    health.takeDamage(1, { x: -1, y: 0 }, "test");

    const kb = health.getKnockbackVelocity()!;
    expect(kb.x).toBeLessThan(0);
  });

  // ── Custom Parameters ──────────────────────────────────────────

  it("18. custom maxHealth", () => {
    const { health } = setup({ maxHealth: 3 });
    expect(health.health).toBe(3);
    expect(health.maxHealth).toBe(3);
  });

  it("19. custom invincibility frames", () => {
    const { h, health } = setup({ invincibilityFrames: 30 });
    health.takeDamage(1, { x: 1, y: 0 }, "test");
    expect(health.invincibilityTimer).toBe(30);

    h.tickN(30);
    expect(health.invincibilityTimer).toBe(0);

    const result = health.takeDamage(1, { x: 1, y: 0 }, "test2");
    expect(result).toBe(true);
  });

  it("20. health boundary — damage equals remaining", () => {
    const { h, health } = setup({ maxHealth: 3 });
    health.takeDamage(1, { x: 1, y: 0 }, "a");
    expect(health.health).toBe(2);

    h.tickN(DEFAULT_PLAYER_HEALTH_PARAMS.invincibilityFrames);
    health.takeDamage(2, { x: 1, y: 0 }, "b");
    expect(health.health).toBe(0);
  });

  // ── Dash I-Frames Integration ──────────────────────────────────

  it("21. canTakeDamage returns false while dashing", () => {
    const { health } = setup({ dashIFrames: true });
    expect(health.canTakeDamage("DASHING", true)).toBe(false);
  });

  it("22. canTakeDamage returns true when not dashing", () => {
    const { health } = setup();
    expect(health.canTakeDamage("RUNNING", false)).toBe(true);
  });
});
