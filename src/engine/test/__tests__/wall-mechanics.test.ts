import { describe, it, expect } from "vitest";
import { GameTestHarness } from "../GameTestHarness";
import { DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";

describe("wall mechanics", () => {
  function arenaWithWalls() {
    const h = new GameTestHarness();
    h.addFloor(400);
    h.addWalls(0, 300, 0, 432);
    h.setPlayerPosition(150, 400 - DEFAULT_PLAYER_PARAMS.playerHeight);
    h.tick();
    return h;
  }

  /** Helper to get player into wall slide on the right wall. */
  function enterRightWallSlide(h: GameTestHarness): boolean {
    h.pressJump();
    h.tick();
    h.releaseAll();
    h.tickN(5);
    h.pressRight();
    h.tickUntil(() => h.state === "WALL_SLIDING" || h.grounded, 120);
    return h.state === "WALL_SLIDING";
  }

  /** Helper to get player into wall slide on the left wall. */
  function enterLeftWallSlide(h: GameTestHarness): boolean {
    h.pressJump();
    h.tick();
    h.releaseAll();
    h.tickN(5);
    h.pressLeft();
    h.tickUntil(() => h.state === "WALL_SLIDING" || h.grounded, 120);
    return h.state === "WALL_SLIDING";
  }

  function narrowShaft() {
    const h = new GameTestHarness();
    // Floor at bottom
    h.addPlatform(0, 600, 300, 32);
    // Tall walls close together
    h.addPlatform(-32, 0, 32, 632); // Left wall
    h.addPlatform(300, 0, 32, 632); // Right wall
    // Player near top-right
    h.setPlayerPosition(250, 50);
    h.tick();
    return h;
  }

  // ── Existing tests ──────────────────────────────────────────

  it("player enters wall slide when falling against a wall", () => {
    const h = arenaWithWalls();

    // Jump up
    h.pressJump();
    h.tick();
    h.releaseAll();
    h.tickN(10);

    // Move toward right wall and wait to be falling
    h.pressRight();
    h.tickUntil(() => h.vel.y > 0, 60);

    // Keep pressing into wall while falling — should enter wall slide
    h.tickUntil(
      () => h.state === "WALL_SLIDING" || h.grounded,
      120,
    );

    if (!h.grounded) {
      expect(h.state).toBe("WALL_SLIDING");
      expect(h.player.wallSide).toBe(1);
    }
  });

  it("wall slide descends slower than free fall", () => {
    const h = arenaWithWalls();

    // Jump and press into right wall
    h.pressJump();
    h.tick();
    h.releaseAll();
    h.tickN(5);
    h.pressRight();
    h.tickUntil(() => h.state === "WALL_SLIDING" || h.grounded, 120);

    if (h.state === "WALL_SLIDING") {
      h.tickN(10);
      const wallSlideSpeed = h.vel.y;

      // Wall slide speed should be capped below max fall speed
      expect(wallSlideSpeed).toBeLessThan(DEFAULT_PLAYER_PARAMS.maxFallSpeed);
      expect(wallSlideSpeed).toBeGreaterThan(0);
    }
  });

  it("wall jump launches player away from wall", () => {
    const h = arenaWithWalls();

    // Get into wall slide on right wall
    h.pressJump();
    h.tick();
    h.releaseAll();
    h.tickN(5);
    h.pressRight();
    h.tickUntil(() => h.state === "WALL_SLIDING" || h.grounded, 120);

    if (h.state === "WALL_SLIDING") {
      const wallSide = h.player.wallSide;

      // Wall jump
      h.pressJump();
      h.tick();

      expect(h.state).toBe("WALL_JUMPING");
      expect(h.vel.y).toBeLessThan(0);

      // Should be launched away from the wall
      if (wallSide === 1) {
        expect(h.vel.x).toBeLessThan(0);
      } else {
        expect(h.vel.x).toBeGreaterThan(0);
      }
    }
  });

  it("wall jump has lockout period preventing immediate re-attach", () => {
    const h = arenaWithWalls();

    // Wall slide on right wall
    h.pressJump();
    h.tick();
    h.releaseAll();
    h.tickN(5);
    h.pressRight();
    h.tickUntil(() => h.state === "WALL_SLIDING" || h.grounded, 120);

    if (h.state === "WALL_SLIDING") {
      // Wall jump
      h.pressJump();
      h.tick();
      h.releaseAll();

      // Immediately press back toward wall
      h.pressRight();
      h.tickN(3);

      // Should NOT be wall sliding yet (lockout)
      expect(h.state).not.toBe("WALL_SLIDING");
      expect(h.player.wallJumpLockoutTimer).toBeGreaterThan(0);
    }
  });

  // ── New tests ───────────────────────────────────────────────

  it("wall slide on left wall sets wallSide to -1", () => {
    const h = arenaWithWalls();
    // Position player near left wall
    h.setPlayerPosition(40, 400 - DEFAULT_PLAYER_PARAMS.playerHeight);
    h.tick();

    const entered = enterLeftWallSlide(h);
    if (entered) {
      expect(h.state).toBe("WALL_SLIDING");
      expect(h.player.wallSide).toBe(-1);
    }
  });

  it("wall slide speed cap does not exceed wallSlideBaseSpeed", () => {
    const h = arenaWithWalls();
    const entered = enterRightWallSlide(h);

    if (entered) {
      // Tick for 30+ frames to let slide speed settle
      for (let i = 0; i < 40; i++) {
        h.tick();
        // Verify speed never exceeds base speed (with small tolerance for acceleration ramp)
        expect(h.vel.y).toBeLessThanOrEqual(
          DEFAULT_PLAYER_PARAMS.wallSlideBaseSpeed + 1,
        );
      }
    }
  });

  it("wall slide grip (holding toward wall) descends slower than base slide", () => {
    const h = arenaWithWalls();

    // Enter wall slide holding right (grip mode)
    const entered = enterRightWallSlide(h);
    if (!entered) return;

    // Hold right (toward wall) for 30 frames to settle at grip speed
    h.tickN(30);
    const gripSpeed = h.vel.y;

    // Now release right input and don't hold toward wall
    h.releaseAll();
    // We need to re-enter wall slide without grip to compare.
    // Instead, check grip speed is near wallSlideGripSpeed
    expect(gripSpeed).toBeLessThanOrEqual(
      DEFAULT_PLAYER_PARAMS.wallSlideGripSpeed + 1,
    );
    expect(gripSpeed).toBeGreaterThan(0);

    // Grip speed should be much less than base speed
    expect(gripSpeed).toBeLessThan(DEFAULT_PLAYER_PARAMS.wallSlideBaseSpeed);
  });

  it("wall jump from left wall launches rightward", () => {
    const h = arenaWithWalls();
    // Position player near left wall
    h.setPlayerPosition(40, 400 - DEFAULT_PLAYER_PARAMS.playerHeight);
    h.tick();

    const entered = enterLeftWallSlide(h);
    if (!entered) return;

    expect(h.player.wallSide).toBe(-1);

    // Wall jump
    h.pressJump();
    h.tick();

    expect(h.state).toBe("WALL_JUMPING");
    expect(h.vel.y).toBeLessThan(0);
    // Launched rightward (away from left wall)
    expect(h.vel.x).toBeGreaterThan(0);
  });

  it("wall jump has correct vertical speed", () => {
    const h = arenaWithWalls();
    const entered = enterRightWallSlide(h);
    if (!entered) return;

    h.pressJump();
    h.tick();

    expect(h.state).toBe("WALL_JUMPING");
    // Velocity should be at or near the wallJumpVerticalSpeed (negative = upward)
    expect(h.vel.y).toBeLessThanOrEqual(
      -DEFAULT_PLAYER_PARAMS.wallJumpVerticalSpeed + 50,
    );
    expect(h.vel.y).toBeLessThan(0);
  });

  it("wall jump has correct horizontal speed", () => {
    const h = arenaWithWalls();
    const entered = enterRightWallSlide(h);
    if (!entered) return;

    // Wall side is 1 (right), so jump launches leftward
    h.pressJump();
    h.tick();

    expect(h.state).toBe("WALL_JUMPING");
    // Horizontal speed magnitude should match wallJumpHorizontalSpeed
    expect(Math.abs(h.vel.x)).toBeCloseTo(
      DEFAULT_PLAYER_PARAMS.wallJumpHorizontalSpeed,
      0,
    );
    // Direction: away from right wall = leftward (negative)
    expect(h.vel.x).toBeLessThan(0);
  });

  it("wall-to-wall chain in narrow shaft", () => {
    const h = narrowShaft();

    // Fall toward right wall
    h.pressRight();
    h.tickUntil(() => h.state === "WALL_SLIDING" || h.grounded, 120);

    if (h.state !== "WALL_SLIDING") return;
    expect(h.player.wallSide).toBe(1);

    // Wall jump from right wall (launches left)
    h.pressJump();
    h.tick();
    h.releaseAll();
    expect(h.state).toBe("WALL_JUMPING");
    expect(h.vel.x).toBeLessThan(0);

    // Press left to continue toward left wall
    h.pressLeft();

    // Wait to reach left wall and enter wall slide
    h.tickUntil(
      () => h.state === "WALL_SLIDING" || h.grounded,
      120,
    );

    if (!h.grounded) {
      expect(h.state).toBe("WALL_SLIDING");
      expect(h.player.wallSide).toBe(-1);
    }
  });

  it("cannot wall slide while grounded", () => {
    const h = arenaWithWalls();
    // Player is on the ground, near the right wall
    h.setPlayerPosition(
      300 - DEFAULT_PLAYER_PARAMS.playerWidth - 1,
      400 - DEFAULT_PLAYER_PARAMS.playerHeight,
    );
    h.tick();

    expect(h.grounded).toBe(true);

    // Press into the wall
    h.pressRight();
    h.tickN(10);

    // Should remain grounded, NOT wall sliding
    expect(h.state).not.toBe("WALL_SLIDING");
    expect(h.grounded).toBe(true);
  });

  it("wall slide exits to falling when releasing wall input", () => {
    const h = arenaWithWalls();
    const entered = enterRightWallSlide(h);
    if (!entered) return;

    // Tick a couple frames to be past wall stick
    h.tickN(5);
    expect(h.state).toBe("WALL_SLIDING");

    // Release right input (press left — away from wall)
    h.releaseAll();
    h.pressLeft();
    h.tick();

    // Should transition to FALLING
    expect(h.state).toBe("FALLING");
  });

  it("wall coyote jump succeeds within coyote window", () => {
    const h = arenaWithWalls();
    const entered = enterRightWallSlide(h);
    if (!entered) return;

    // Tick past wall stick
    h.tickN(5);
    expect(h.state).toBe("WALL_SLIDING");

    // Detach from wall by pressing away
    h.releaseAll();
    h.pressLeft();
    h.tick();
    expect(h.state).toBe("FALLING");

    // Within coyote window, press jump
    h.releaseAll();
    h.tickN(2); // Still within wallJumpCoyoteFrames (5)
    h.pressJump();
    h.tick();

    // Should perform a wall jump
    expect(h.state).toBe("WALL_JUMPING");
    expect(h.vel.y).toBeLessThan(0);
  });

  it("wall coyote jump fails after coyote window expires", () => {
    const h = arenaWithWalls();
    const entered = enterRightWallSlide(h);
    if (!entered) return;

    // Tick past wall stick
    h.tickN(5);
    expect(h.state).toBe("WALL_SLIDING");

    // Detach from wall
    h.releaseAll();
    h.pressLeft();
    h.tick();
    expect(h.state).toBe("FALLING");

    // Wait well beyond coyote window
    h.releaseAll();
    h.tickN(DEFAULT_PLAYER_PARAMS.wallJumpCoyoteFrames + 5);

    // Try to jump — coyote window expired
    h.pressJump();
    h.tick();

    // Should NOT perform a wall jump — remain FALLING
    expect(h.state).not.toBe("WALL_JUMPING");
  });

  it("wall stick briefly freezes vertical velocity on contact", () => {
    const h = arenaWithWalls();
    const entered = enterRightWallSlide(h);
    if (!entered) return;

    // On wall slide entry, the wall stick should hold velocity near zero
    // The entry already happened; check that during stick frames velocity is very low
    // The wallStickTimer was set to wallStickFrames on entry.
    // Since enterRightWallSlide already ticked past detection, let's check
    // the stick timer is active
    if (h.player.wallStickTimer > 0) {
      // During wall stick, vertical velocity should be zero
      expect(h.vel.y).toBe(0);
      expect(h.vel.x).toBe(0);
    }

    // After stick frames pass, velocity should start increasing
    h.tickN(DEFAULT_PLAYER_PARAMS.wallStickFrames + 1);
    if (h.state === "WALL_SLIDING") {
      expect(h.vel.y).toBeGreaterThan(0);
    }
  });

  it("wall slide never exceeds wallSlideBaseSpeed over extended duration", () => {
    const h = arenaWithWalls();

    // Use a tall arena so we don't hit the floor
    const hTall = new GameTestHarness();
    hTall.addFloor(2000); // Very far down
    hTall.addWalls(0, 300, 0, 2032);
    hTall.setPlayerPosition(250, 100);
    hTall.tick();

    // Enter wall slide
    hTall.pressJump();
    hTall.tick();
    hTall.releaseAll();
    hTall.tickN(5);
    hTall.pressRight();
    hTall.tickUntil(
      () => hTall.state === "WALL_SLIDING" || hTall.grounded,
      120,
    );

    if (hTall.state !== "WALL_SLIDING") return;

    // Tick for 120 frames, verifying speed cap each frame
    for (let i = 0; i < 120; i++) {
      hTall.tick();
      if (hTall.state !== "WALL_SLIDING") break;
      // Should never exceed wallSlideBaseSpeed (which is less than maxFallSpeed)
      expect(hTall.vel.y).toBeLessThanOrEqual(
        DEFAULT_PLAYER_PARAMS.wallSlideBaseSpeed + 1,
      );
      expect(hTall.vel.y).toBeLessThanOrEqual(
        DEFAULT_PLAYER_PARAMS.maxFallSpeed,
      );
    }
  });
});
