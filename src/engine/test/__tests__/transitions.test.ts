import { describe, it, expect } from "vitest";
import { GameTestHarness } from "../GameTestHarness";
import { DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";

describe("state transitions", () => {
  function standingOnFloor() {
    const h = new GameTestHarness();
    h.addFloor(300);
    h.setPlayerPosition(100, 300 - DEFAULT_PLAYER_PARAMS.playerHeight);
    h.tickUntil(() => h.grounded, 10);
    // One more tick to settle into IDLE
    h.tick();
    return h;
  }

  function wallCorridor() {
    const h = new GameTestHarness();
    h.addFloor(500);
    h.addWalls(32, 900, 0, 540);
    h.setPlayerPosition(400, 500 - DEFAULT_PLAYER_PARAMS.playerHeight);
    h.tickUntil(() => h.grounded, 10);
    h.tick();
    return h;
  }

  /**
   * Reliably enter WALL_SLIDING on the right wall.
   * Places player adjacent to wall, gives downward velocity, holds right.
   */
  function enterWallSlide() {
    const h = new GameTestHarness();
    h.addFloor(500);
    h.addWalls(32, 900, 0, 540);
    // Position player so right edge touches right wall (900 - playerWidth = 876)
    // Place high enough above floor to have time for wall interactions
    h.setPlayerPosition(
      900 - DEFAULT_PLAYER_PARAMS.playerWidth,
      200,
    );
    h.setPlayerVelocity(0, 100); // Falling downward
    h.pressRight(); // Hold into wall
    h.tick(); // Let physics detect wall contact
    // Should now be in WALL_SLIDING or transitioning — tick until we are
    h.tickUntil(() => h.state === "WALL_SLIDING", 10);
    return h;
  }

  function tallDrop() {
    const h = new GameTestHarness();
    h.addFloor(500);
    h.setPlayerPosition(100, 100);
    return h;
  }

  // ── Group 1: Ground State Transitions ─────────────────────

  describe("ground state transitions", () => {
    it("IDLE → RUNNING: pressing horizontal input", () => {
      const h = standingOnFloor();
      expect(h.state).toBe("IDLE");

      h.pressRight();
      h.tickN(2);

      expect(h.state).toBe("RUNNING");
    });

    it("RUNNING → IDLE: releasing all input", () => {
      const h = standingOnFloor();
      h.pressRight();
      h.tickUntil(() => h.state === "RUNNING", 5);
      expect(h.state).toBe("RUNNING");

      h.releaseAll();
      h.tickUntil(() => h.state === "IDLE", 30);

      expect(h.state).toBe("IDLE");
    });

    it("IDLE → CROUCHING: pressing down", () => {
      const h = standingOnFloor();
      expect(h.state).toBe("IDLE");

      h.pressDown();
      h.tick();

      expect(h.state).toBe("CROUCHING");
    });

    it("RUNNING → CROUCHING: pressing down at low speed", () => {
      const h = standingOnFloor();
      h.pressRight();
      h.tickN(3);
      h.releaseAll();
      // Wait until speed is fully zero so the next run frame stays below slideMinSpeed
      h.tickUntil(
        () => Math.abs(h.vel.x) === 0,
        30,
      );

      // Now in IDLE with zero speed — press right briefly to get RUNNING then immediately crouch
      h.pressRight();
      h.tick();
      // Now press down while speed is low (one frame of acceleration < slideMinSpeed)
      h.pressDown();
      h.tick();

      expect(h.state).toBe("CROUCHING");
    });

    it("RUNNING → CROUCH_SLIDING: pressing down at high speed", () => {
      const h = standingOnFloor();
      h.pressRight();
      // Run until we exceed slideMinSpeed
      h.tickUntil(
        () => Math.abs(h.vel.x) > DEFAULT_PLAYER_PARAMS.slideMinSpeed + 20,
        60,
      );
      expect(h.state).toBe("RUNNING");

      h.pressDown();
      h.tick();

      expect(h.state).toBe("CROUCH_SLIDING");
    });

    it("CROUCH_SLIDING → CROUCHING: slide decelerates below minimum speed", () => {
      const h = standingOnFloor();
      h.pressRight();
      h.tickUntil(
        () => Math.abs(h.vel.x) > DEFAULT_PLAYER_PARAMS.slideMinSpeed + 20,
        60,
      );
      h.pressDown();
      h.tick();
      expect(h.state).toBe("CROUCH_SLIDING");

      // Keep holding down and let friction kill the slide
      h.tickUntil(() => h.state === "CROUCHING", 180);

      expect(h.state).toBe("CROUCHING");
    });

    it("CROUCHING → IDLE: release down with no horizontal input", () => {
      const h = standingOnFloor();
      h.pressDown();
      h.tick();
      expect(h.state).toBe("CROUCHING");

      h.releaseAll();
      h.tick();

      expect(h.state).toBe("IDLE");
    });

    it("CROUCHING → RUNNING: release down while holding horizontal input", () => {
      const h = standingOnFloor();
      h.pressDown();
      h.tick();
      expect(h.state).toBe("CROUCHING");

      // Release down while holding right
      h.releaseAll();
      h.pressRight();
      h.tick();

      expect(h.state).toBe("RUNNING");
    });
  });

  // ── Group 2: Jump/Fall Transitions ────────────────────────

  describe("jump and fall transitions", () => {
    it("IDLE → JUMPING: pressing jump from idle", () => {
      const h = standingOnFloor();
      expect(h.state).toBe("IDLE");

      h.pressJump();
      h.tick();

      expect(h.state).toBe("JUMPING");
      expect(h.vel.y).toBeLessThan(0);
    });

    it("RUNNING → JUMPING: pressing jump while running preserves horizontal velocity", () => {
      const h = standingOnFloor();
      h.pressRight();
      h.tickUntil(() => h.state === "RUNNING" && h.horizontalSpeed > 50, 30);

      h.pressJump();
      h.tick();

      expect(h.state).toBe("JUMPING");
      // Horizontal velocity should still be positive (moving right)
      expect(h.vel.x).toBeGreaterThan(0);
    });

    it("JUMPING → FALLING: after jump apex", () => {
      const h = standingOnFloor();
      h.pressJump();
      h.tick();
      h.releaseAll();

      // Wait for state to transition to FALLING (happens after velocity crosses zero)
      h.tickUntil(() => h.state === "FALLING", 120);

      expect(h.state).toBe("FALLING");
    });

    it("FALLING → IDLE: soft landing from short fall", () => {
      const h = standingOnFloor();
      // Small jump and land
      h.pressJump();
      h.tick();
      h.releaseAll();

      // Wait to land (state settles to IDLE on grounded)
      h.tickUntil(
        () => h.grounded && h.state !== "JUMPING" && h.state !== "FALLING",
        120,
      );

      // Short fall → should NOT be HARD_LANDING
      expect(h.state).not.toBe("HARD_LANDING");
      expect(["IDLE", "RUNNING"]).toContain(h.state);
    });

    it("FALLING → HARD_LANDING: long fall exceeding hard land threshold", () => {
      const h = tallDrop();
      // Player starts at y=100, floor at y=500 — long fall (>30 frames)
      h.tickUntil(() => h.state === "HARD_LANDING", 300);

      expect(h.state).toBe("HARD_LANDING");
    });

    it("HARD_LANDING → IDLE: after recovery with no input", () => {
      const h = tallDrop();
      h.tickUntil(() => h.state === "HARD_LANDING", 300);
      expect(h.state).toBe("HARD_LANDING");

      // Wait out recovery
      h.tickN(DEFAULT_PLAYER_PARAMS.hardLandRecoveryFrames + 1);

      expect(h.state).toBe("IDLE");
    });

    it("HARD_LANDING → RUNNING: after recovery while holding input", () => {
      const h = tallDrop();
      h.tickUntil(() => h.state === "HARD_LANDING", 300);

      h.pressRight();
      h.tickN(DEFAULT_PLAYER_PARAMS.hardLandRecoveryFrames + 1);

      expect(h.state).toBe("RUNNING");
    });

    it("FALLING → RUNNING: landing while holding horizontal input from short height", () => {
      const h = new GameTestHarness();
      h.addFloor(300);
      // Start slightly above the floor (short fall, not enough for hard landing)
      h.setPlayerPosition(100, 280);

      h.pressRight();
      // Wait for player to land and settle
      h.tickUntil(
        () => h.grounded && h.state !== "FALLING" && h.state !== "JUMPING",
        60,
      );

      expect(h.state).toBe("RUNNING");
    });
  });

  // ── Group 3: Wall Transitions ─────────────────────────────

  describe("wall transitions", () => {
    it("FALLING → WALL_SLIDING: moving into wall while falling", () => {
      const h = enterWallSlide();
      expect(h.state).toBe("WALL_SLIDING");
    });

    it("WALL_SLIDING → WALL_JUMPING: pressing jump while wall sliding", () => {
      const h = enterWallSlide();
      expect(h.state).toBe("WALL_SLIDING");

      h.pressJump();
      h.tick();

      expect(h.state).toBe("WALL_JUMPING");
    });

    it("WALL_JUMPING → JUMPING: after lockout expires while still rising", () => {
      const h = enterWallSlide();
      expect(h.state).toBe("WALL_SLIDING");

      h.pressJump();
      h.tick();
      expect(h.state).toBe("WALL_JUMPING");
      // Keep holding jump so jump-cut doesn't fire
      h.releaseRight();

      // Tick through lockout frames
      h.tickN(DEFAULT_PLAYER_PARAMS.wallJumpLockoutFrames);

      // Wall jump vertical speed is 360, after 8 frames of riseGravity the player should still be rising
      expect(h.vel.y).toBeLessThan(0);
      expect(h.state).toBe("JUMPING");
    });

    it("WALL_JUMPING → FALLING: after lockout expires when no longer rising", () => {
      const h = enterWallSlide();
      expect(h.state).toBe("WALL_SLIDING");

      // Wall jump then immediately release jump to trigger jump-cut
      h.pressJump();
      h.tick();
      expect(h.state).toBe("WALL_JUMPING");
      h.releaseAll();

      // After lockout + enough gravity, velocity should cross zero → FALLING
      h.tickUntil(
        () => h.state !== "WALL_JUMPING",
        DEFAULT_PLAYER_PARAMS.wallJumpLockoutFrames + 30,
      );

      expect(["JUMPING", "FALLING"]).toContain(h.state);
    });

    it("WALL_SLIDING → FALLING: releasing toward-wall input", () => {
      const h = enterWallSlide();
      expect(h.state).toBe("WALL_SLIDING");

      // Tick past wall stick
      h.tickN(DEFAULT_PLAYER_PARAMS.wallStickFrames + 1);

      h.releaseAll();
      h.pressLeft(); // Away from wall
      h.tick();

      expect(h.state).toBe("FALLING");
    });

    it("WALL_SLIDING → grounded: slide down to floor", () => {
      // Place player close to the floor so wall slide reaches it quickly
      const h = new GameTestHarness();
      h.addFloor(300);
      h.addWalls(32, 900, 0, 540);
      // Position adjacent to right wall, just above the floor
      h.setPlayerPosition(
        900 - DEFAULT_PLAYER_PARAMS.playerWidth,
        300 - DEFAULT_PLAYER_PARAMS.playerHeight - 40,
      );
      h.setPlayerVelocity(0, 100); // Falling downward
      h.pressRight();
      h.tickUntil(() => h.state === "WALL_SLIDING", 10);
      expect(h.state).toBe("WALL_SLIDING");

      // Let the player slide down to the floor
      h.tickUntil(
        () =>
          h.grounded &&
          h.state !== "FALLING" &&
          h.state !== "WALL_SLIDING",
        120,
      );
      expect(h.grounded).toBe(true);
      expect(["IDLE", "RUNNING"]).toContain(h.state);
    });
  });

  // ── Group 4: Dash Transitions ─────────────────────────────

  describe("dash transitions", () => {
    it("IDLE → DASHING: pressing dash from idle", () => {
      const h = standingOnFloor();
      expect(h.state).toBe("IDLE");

      h.pressDash();
      h.tick();

      expect(h.state).toBe("DASHING");
    });

    it("RUNNING → DASHING: pressing dash while running", () => {
      const h = standingOnFloor();
      h.pressRight();
      h.tickUntil(() => h.state === "RUNNING", 5);

      h.pressDash();
      h.tick();

      expect(h.state).toBe("DASHING");
    });

    it("JUMPING → DASHING: pressing dash while jumping", () => {
      const h = standingOnFloor();
      h.pressJump();
      h.tick();
      expect(h.state).toBe("JUMPING");

      h.pressDash();
      h.tick();

      expect(h.state).toBe("DASHING");
    });

    it("FALLING → DASHING: pressing dash while falling", () => {
      const h = standingOnFloor();
      h.pressJump();
      h.tick();
      h.releaseAll();
      h.tickUntil(() => h.state === "FALLING", 60);

      h.pressDash();
      h.tick();

      expect(h.state).toBe("DASHING");
    });

    it("CROUCHING → DASHING: pressing dash while crouching", () => {
      const h = standingOnFloor();
      h.pressDown();
      h.tick();
      expect(h.state).toBe("CROUCHING");

      h.pressDash();
      h.tick();

      expect(h.state).toBe("DASHING");
    });

    it("HARD_LANDING → DASHING: dash cancels hard landing", () => {
      const h = tallDrop();
      h.tickUntil(() => h.state === "HARD_LANDING", 300);
      expect(h.state).toBe("HARD_LANDING");

      // Dash should cancel hard landing
      h.pressDash();
      h.tick();

      expect(h.state).toBe("DASHING");
    });

    it("DASHING → RUNNING: ground dash ends while holding forward", () => {
      const h = standingOnFloor();
      h.pressRight();
      h.tickN(2);
      h.pressDash();
      h.tick();
      expect(h.state).toBe("DASHING");

      // Keep holding right through dash duration
      const dashFrames =
        DEFAULT_PLAYER_PARAMS.dashWindupFrames +
        DEFAULT_PLAYER_PARAMS.dashDurationFrames;
      h.tickN(dashFrames + 1);

      expect(h.state).toBe("RUNNING");
    });

    it("DASHING → IDLE: ground dash ends with no input", () => {
      const h = standingOnFloor();
      h.pressDash();
      h.tick();
      expect(h.state).toBe("DASHING");
      h.releaseAll();

      const dashFrames =
        DEFAULT_PLAYER_PARAMS.dashWindupFrames +
        DEFAULT_PLAYER_PARAMS.dashDurationFrames;
      h.tickN(dashFrames + 1);

      expect(h.state).toBe("IDLE");
    });

    it("DASHING → FALLING: air dash ends in open air", () => {
      // Start in the air with no floor, already falling
      const h = new GameTestHarness();
      h.setPlayerPosition(100, 100);
      h.setPlayerVelocity(0, 50); // Already moving downward
      h.tick();
      expect(h.state).toBe("FALLING");

      h.pressDash();
      h.tick();
      expect(h.state).toBe("DASHING");
      h.releaseAll();

      const dashFrames =
        DEFAULT_PLAYER_PARAMS.dashWindupFrames +
        DEFAULT_PLAYER_PARAMS.dashDurationFrames;
      h.tickN(dashFrames + 1);

      // Dash direction defaults to facing direction (horizontal), velocity.y is set to 0 on exit
      // Since velocity.y >= 0 and not grounded and not touching wall → FALLING
      expect(h.state).toBe("FALLING");
    });

    it("DASHING → WALL_SLIDING: air dash into wall", () => {
      const h = new GameTestHarness();
      h.addFloor(500);
      h.addWalls(32, 900, 0, 540);
      // Start in the air with downward velocity, close to right wall
      h.setPlayerPosition(800, 200);
      h.setPlayerVelocity(0, 50); // Falling
      h.tick();

      // Dash right into wall while holding right
      h.pressRight();
      h.pressDash();
      h.tick();
      expect(h.state).toBe("DASHING");

      const dashFrames =
        DEFAULT_PLAYER_PARAMS.dashWindupFrames +
        DEFAULT_PLAYER_PARAMS.dashDurationFrames;
      h.tickN(dashFrames + 1);

      // exitDash checks isTouchingWall + holdingIntoWall + velocity.y >= 0 → WALL_SLIDING
      // May need an extra tick if FALLING transitions to WALL_SLIDING on next frame
      if (h.state !== "WALL_SLIDING") {
        h.tickUntil(
          () => h.state === "WALL_SLIDING" || h.grounded,
          10,
        );
      }
      expect(h.state).toBe("WALL_SLIDING");
    });
  });

  // ── Group 5: Blocked Transitions ──────────────────────────

  describe("blocked transitions", () => {
    it("no double jump: pressing jump while airborne past coyote window", () => {
      const h = standingOnFloor();
      h.pressJump();
      h.tick();
      h.releaseAll();
      expect(h.state).toBe("JUMPING");

      // Wait past coyote window plus transition to FALLING
      h.tickUntil(() => h.state === "FALLING", 60);
      h.tickN(DEFAULT_PLAYER_PARAMS.coyoteFrames + 3);

      // Now try to jump — should not work
      h.pressJump();
      h.tick();

      expect(h.state).not.toBe("JUMPING");
      expect(h.state).toBe("FALLING");
    });

    it("jump can interrupt hard landing (dash-cancel philosophy)", () => {
      const h = tallDrop();
      h.tickUntil(() => h.state === "HARD_LANDING", 300);
      expect(h.state).toBe("HARD_LANDING");

      // Jump should cancel hard landing recovery
      h.pressJump();
      h.tick();

      expect(h.state).toBe("JUMPING");
    });

    it("dash cooldown blocks dash: cannot dash during cooldown", () => {
      const h = standingOnFloor();
      h.pressDash();
      h.tick();
      expect(h.state).toBe("DASHING");
      h.releaseAll();

      // Wait for dash to finish
      const dashFrames =
        DEFAULT_PLAYER_PARAMS.dashWindupFrames +
        DEFAULT_PLAYER_PARAMS.dashDurationFrames;
      h.tickN(dashFrames + 1);
      expect(h.state).not.toBe("DASHING");

      // Cooldown should be active
      expect(h.player.dashCooldownTimer).toBeGreaterThan(0);

      // Try to dash again — should fail
      h.pressDash();
      h.tick();
      expect(h.state).not.toBe("DASHING");
    });

    it("wall jump lockout prevents wall slide re-attach", () => {
      const h = enterWallSlide();
      expect(h.state).toBe("WALL_SLIDING");

      h.pressJump();
      h.tick();
      expect(h.state).toBe("WALL_JUMPING");
      h.releaseAll();

      // Immediately press back toward wall during lockout
      h.pressRight();
      h.tickN(3);

      // Should NOT be wall sliding during lockout
      expect(h.state).not.toBe("WALL_SLIDING");
      expect(h.player.wallJumpLockoutTimer).toBeGreaterThan(0);
    });
  });

  // ── Group 6: Cross-State Chains ───────────────────────────

  describe("transition chains", () => {
    it("RUNNING → JUMPING → DASHING → FALLING chain", () => {
      const h = standingOnFloor();

      // 1. RUNNING
      h.pressRight();
      h.tickUntil(() => h.state === "RUNNING", 5);
      expect(h.state).toBe("RUNNING");

      // 2. JUMPING
      h.pressJump();
      h.tick();
      expect(h.state).toBe("JUMPING");
      h.releaseAll();

      // Wait a few frames to be well into the jump
      h.tickN(5);

      // 3. DASHING
      h.pressDash();
      h.tick();
      expect(h.state).toBe("DASHING");
      h.releaseAll();

      // 4. FALLING after dash ends in air
      const dashFrames =
        DEFAULT_PLAYER_PARAMS.dashWindupFrames +
        DEFAULT_PLAYER_PARAMS.dashDurationFrames;
      h.tickN(dashFrames + 1);

      expect(["FALLING", "JUMPING"]).toContain(h.state);
    });

    it("WALL_JUMPING → JUMPING/FALLING → DASHING chain", () => {
      const h = enterWallSlide();
      expect(h.state).toBe("WALL_SLIDING");

      // Wall jump (launches left, away from right wall)
      h.pressJump();
      h.tick();
      expect(h.state).toBe("WALL_JUMPING");
      h.releaseRight();

      // Wait for lockout to expire → transitions to JUMPING or FALLING
      h.tickUntil(
        () => h.state !== "WALL_JUMPING",
        DEFAULT_PLAYER_PARAMS.wallJumpLockoutFrames + 5,
      );
      expect(["JUMPING", "FALLING"]).toContain(h.state);

      // Now dash
      h.pressDash();
      h.tick();
      expect(h.state).toBe("DASHING");
    });

    it("CROUCH_SLIDING → JUMPING → airborne chain", () => {
      const h = standingOnFloor();

      // Get into crouch slide
      h.pressRight();
      h.tickUntil(
        () => Math.abs(h.vel.x) > DEFAULT_PLAYER_PARAMS.slideMinSpeed + 20,
        60,
      );
      h.pressDown();
      h.tick();
      expect(h.state).toBe("CROUCH_SLIDING");

      // Jump out of crouch slide (auto-uncrouch)
      h.pressJump();
      h.tick();

      expect(h.state).toBe("JUMPING");
      // Player should have restored to standing height
      expect(h.player.size.y).toBe(DEFAULT_PLAYER_PARAMS.playerHeight);
    });
  });
});
