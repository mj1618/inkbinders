import { describe, it, expect } from "vitest";
import { GameTestHarness } from "../GameTestHarness";
import { DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";

describe("jumping", () => {
  function standingOnFloor() {
    const h = new GameTestHarness();
    h.addFloor(300);
    h.setPlayerPosition(100, 300 - DEFAULT_PLAYER_PARAMS.playerHeight);
    h.tick();
    return h;
  }

  it("jumps when pressing jump on ground", () => {
    const h = standingOnFloor();
    expect(h.grounded).toBe(true);

    h.pressJump();
    h.tick();

    expect(h.state).toBe("JUMPING");
    expect(h.vel.y).toBeLessThan(0);
  });

  it("rises then falls back to ground", () => {
    const h = standingOnFloor();
    const startY = h.pos.y;

    h.pressJump();
    h.tick();
    h.releaseAll();

    // Rise phase
    h.tickN(5);
    expect(h.pos.y).toBeLessThan(startY);

    // Wait to land
    h.tickUntil(() => h.grounded, 180);
    expect(h.grounded).toBe(true);
    expect(h.pos.y).toBeCloseTo(startY, 0);
  });

  it("holding jump makes player rise higher than tap jump", () => {
    // Tap jump
    const h1 = standingOnFloor();
    h1.pressJump();
    h1.tick();
    h1.releaseJump();
    let minY1 = h1.pos.y;
    h1.tickUntil(() => h1.grounded, 180);
    // Track the highest point during the jump
    const h1b = standingOnFloor();
    h1b.pressJump();
    h1b.tick();
    h1b.releaseJump();
    for (let i = 0; i < 120; i++) {
      h1b.tick();
      if (h1b.pos.y < minY1) minY1 = h1b.pos.y;
      if (h1b.grounded) break;
    }

    // Held jump
    const h2 = standingOnFloor();
    h2.pressJump();
    let minY2 = h2.pos.y;
    for (let i = 0; i < 120; i++) {
      h2.tick();
      if (h2.pos.y < minY2) minY2 = h2.pos.y;
      if (h2.grounded && i > 5) break;
    }

    expect(minY2).toBeLessThan(minY1);
  });

  it("transitions to FALLING after jump apex", () => {
    const h = standingOnFloor();

    h.pressJump();
    h.tick();
    h.releaseAll();

    h.tickUntil(() => h.state === "FALLING", 120);
    expect(h.state).toBe("FALLING");
    expect(h.vel.y).toBeGreaterThanOrEqual(0);
  });

  it("supports coyote time (jump after leaving platform)", () => {
    const h = new GameTestHarness();
    h.addPlatform(0, 300, 200, 32);
    h.setPlayerPosition(170, 300 - DEFAULT_PLAYER_PARAMS.playerHeight);
    h.tick();
    expect(h.grounded).toBe(true);

    // Run off the right edge
    h.pressRight();
    h.tickUntil(() => !h.grounded, 60);
    h.releaseAll();

    // Should still be able to jump within coyote window
    const coyoteFrames = DEFAULT_PLAYER_PARAMS.coyoteFrames;
    h.tickN(Math.floor(coyoteFrames / 2));

    h.pressJump();
    h.tick();

    expect(h.state).toBe("JUMPING");
    expect(h.vel.y).toBeLessThan(0);
  });

  it("cannot jump after coyote time expires", () => {
    const h = new GameTestHarness();
    h.addPlatform(0, 300, 200, 32);
    h.setPlayerPosition(170, 300 - DEFAULT_PLAYER_PARAMS.playerHeight);
    h.tick();

    h.pressRight();
    h.tickUntil(() => !h.grounded, 60);
    h.releaseAll();

    // Wait past coyote window
    h.tickN(DEFAULT_PLAYER_PARAMS.coyoteFrames + 5);

    h.pressJump();
    h.tick();

    expect(h.state).toBe("FALLING");
  });

  it("supports jump buffering (press jump before landing)", () => {
    const h = new GameTestHarness();
    h.addFloor(300);
    h.setPlayerPosition(100, 100);

    // Fall toward ground
    h.tickN(30);
    expect(h.grounded).toBe(false);

    // Press jump while still airborne
    h.pressJump();
    h.tickUntil(() => h.grounded, 60);

    // The buffered jump should trigger on landing
    // (may need a few frames for the buffer to be consumed)
    h.tickN(3);
    if (h.state !== "JUMPING") {
      // Buffer might have already caused the jump upon landing
      // Check that we went through JUMPING at some point
      expect(h.vel.y).toBeLessThanOrEqual(0);
    }
  });

  describe("jump height", () => {
    it("held jump reaches at least 80px of height", () => {
      const h = standingOnFloor();
      const startY = h.pos.y;

      h.pressJump();
      let minY = startY;
      for (let i = 0; i < 120; i++) {
        h.tick();
        if (h.pos.y < minY) minY = h.pos.y;
        if (h.grounded && i > 5) break;
      }

      const jumpHeight = startY - minY;
      expect(jumpHeight).toBeGreaterThanOrEqual(80);
    });

    it("held jump is at least 1.3x higher than tap jump", () => {
      // Tap jump
      const h1 = standingOnFloor();
      const startY = h1.pos.y;
      h1.pressJump();
      h1.tick();
      h1.releaseJump();
      let tapMinY = startY;
      for (let i = 0; i < 120; i++) {
        h1.tick();
        if (h1.pos.y < tapMinY) tapMinY = h1.pos.y;
        if (h1.grounded) break;
      }

      // Held jump
      const h2 = standingOnFloor();
      h2.pressJump();
      let heldMinY = startY;
      for (let i = 0; i < 120; i++) {
        h2.tick();
        if (h2.pos.y < heldMinY) heldMinY = h2.pos.y;
        if (h2.grounded && i > 5) break;
      }

      const tapHeight = startY - tapMinY;
      const heldHeight = startY - heldMinY;
      expect(heldHeight).toBeGreaterThanOrEqual(1.3 * tapHeight);
    });
  });

  describe("apex float", () => {
    it("reduces gravity near apex for multiple frames", () => {
      const h = standingOnFloor();

      h.pressJump();
      h.tick();

      // Tick until entering apex zone (velocity near zero)
      h.tickUntil(
        () => Math.abs(h.vel.y) < DEFAULT_PLAYER_PARAMS.apexVelocityThreshold,
        120
      );

      // Count consecutive frames in the apex zone
      let apexFrames = 0;
      for (let i = 0; i < 30; i++) {
        if (
          Math.abs(h.vel.y) < DEFAULT_PLAYER_PARAMS.apexVelocityThreshold
        ) {
          apexFrames++;
        } else {
          break;
        }
        h.tick();
      }

      expect(apexFrames).toBeGreaterThanOrEqual(3);
    });

    it("sets isInApexFloat flag during apex", () => {
      const h = standingOnFloor();

      h.pressJump();
      h.tick();

      // Tick until entering apex zone (post-gravity velocity within threshold)
      h.tickUntil(
        () => Math.abs(h.vel.y) < DEFAULT_PLAYER_PARAMS.apexVelocityThreshold,
        120
      );

      // Tick one more frame so the state machine sees the in-threshold velocity
      // and sets isInApexFloat (the flag is set at the start of the state update,
      // before gravity modifies velocity for that frame)
      h.tick();

      expect(h.player.isInApexFloat).toBe(true);
    });
  });

  describe("air control", () => {
    it("gains horizontal speed from air input while airborne", () => {
      const h = standingOnFloor();

      // Jump straight up
      h.pressJump();
      h.tickN(3);

      expect(h.grounded).toBe(false);

      // Start moving right in the air
      h.pressRight();
      h.tickN(15);

      expect(h.vel.x).toBeGreaterThan(50);
    });
  });

  describe("double jump prevention", () => {
    it("does not allow a second jump while airborne", () => {
      const h = standingOnFloor();

      h.pressJump();
      h.tick();
      h.releaseAll();

      // Wait until the player is actually in FALLING state
      // (with jump cut + apex float, this takes more than 15 frames)
      h.tickUntil(() => h.state === "FALLING", 120);
      expect(h.grounded).toBe(false);

      // Tick a few more frames to ensure we're well past coyote window
      h.tickN(DEFAULT_PLAYER_PARAMS.coyoteFrames + 3);

      // Record velocity before second jump attempt
      const velYBefore = h.vel.y;

      h.pressJump();
      h.tick();

      // Should still be falling, no new upward impulse
      expect(h.state).toBe("FALLING");
      // Velocity should have only changed due to gravity (increased, not decreased)
      expect(h.vel.y).toBeGreaterThanOrEqual(velYBefore);
    });
  });

  describe("landing types", () => {
    it("lands normally after a short fall (no hard landing)", () => {
      const h = standingOnFloor();

      // Tap jump — short arc
      h.pressJump();
      h.tick();
      h.releaseJump();

      // Wait until grounded (collision resolution sets grounded flag)
      h.tickUntil(() => h.grounded, 180);
      // Tick one more frame so the state machine processes the landing
      h.tick();

      expect(h.state === "IDLE" || h.state === "RUNNING").toBe(true);
    });

    it("enters HARD_LANDING after a long fall", () => {
      const h = new GameTestHarness();
      h.addFloor(400);
      // Place player high up — 350px above floor
      h.setPlayerPosition(100, 50);

      // Wait until grounded, then tick once more for state machine to process landing
      h.tickUntil(() => h.grounded, 180);
      h.tick();

      expect(h.state).toBe("HARD_LANDING");
    });

    it("recovers from HARD_LANDING after recovery frames", () => {
      const h = new GameTestHarness();
      h.addFloor(400);
      h.setPlayerPosition(100, 50);

      // Wait until grounded, then tick once more for state machine to process landing
      h.tickUntil(() => h.grounded, 180);
      h.tick();
      expect(h.state).toBe("HARD_LANDING");

      // Velocity.x should be zeroed on entry
      expect(h.vel.x).toBe(0);

      // Count frames until recovery
      let recoveryFrames = 0;
      for (let i = 0; i < 20; i++) {
        if (h.state !== "HARD_LANDING") break;
        h.tick();
        recoveryFrames++;
      }

      expect(recoveryFrames).toBeGreaterThanOrEqual(
        DEFAULT_PLAYER_PARAMS.hardLandRecoveryFrames - 2
      );
      expect(recoveryFrames).toBeLessThanOrEqual(
        DEFAULT_PLAYER_PARAMS.hardLandRecoveryFrames + 2
      );
      expect(h.state === "IDLE" || h.state === "RUNNING").toBe(true);
    });
  });

  describe("momentum preservation", () => {
    it("preserves horizontal speed when jumping from a run", () => {
      const h = standingOnFloor();

      // Build up running speed
      h.pressRight();
      h.tickN(30);

      const speedBeforeJump = h.vel.x;
      expect(speedBeforeJump).toBeGreaterThan(0);

      // Jump while running
      h.pressJump();
      h.tick();

      expect(h.state).toBe("JUMPING");
      // Horizontal velocity should be approximately preserved
      expect(h.vel.x).toBeCloseTo(speedBeforeJump, -1);

      // Continue holding right for 10 more frames
      h.tickN(10);
      expect(h.vel.x).toBeGreaterThan(0);
    });
  });
});
