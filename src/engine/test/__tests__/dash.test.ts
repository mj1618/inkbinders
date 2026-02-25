import { describe, it, expect } from "vitest";
import { GameTestHarness } from "../GameTestHarness";
import { DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";
import { FIXED_TIMESTEP } from "@/lib/constants";
import { InputAction } from "@/engine/input/InputManager";

describe("dash", () => {
  function standingOnFloor() {
    const h = new GameTestHarness();
    h.addFloor(300);
    h.setPlayerPosition(400, 300 - DEFAULT_PLAYER_PARAMS.playerHeight);
    h.tick();
    return h;
  }

  it("dashes in facing direction", () => {
    const h = standingOnFloor();
    expect(h.facingRight).toBe(true);

    h.pressDash();
    h.tick();
    expect(h.state).toBe("DASHING");

    // Tick past the wind-up phase before checking velocity
    h.releaseAll();
    h.tickN(DEFAULT_PLAYER_PARAMS.dashWindupFrames + 1);
    expect(h.vel.x).toBeGreaterThan(0);
  });

  it("dashes left when facing left", () => {
    const h = standingOnFloor();

    // Face left by running left briefly
    h.pressLeft();
    h.tickN(3);
    h.releaseAll();
    h.tick();
    expect(h.facingRight).toBe(false);

    h.pressDash();
    h.tick();
    expect(h.state).toBe("DASHING");

    // Tick past the wind-up phase before checking velocity
    h.releaseAll();
    h.tickN(DEFAULT_PLAYER_PARAMS.dashWindupFrames + 1);
    expect(h.vel.x).toBeLessThan(0);
  });

  it("dash has a finite duration", () => {
    const h = standingOnFloor();
    const dashFrames =
      DEFAULT_PLAYER_PARAMS.dashDurationFrames +
      DEFAULT_PLAYER_PARAMS.dashWindupFrames;

    h.pressDash();
    h.tick();
    h.releaseAll();

    h.tickN(dashFrames + 5);

    expect(h.state).not.toBe("DASHING");
  });

  it("dash goes on cooldown", () => {
    const h = standingOnFloor();

    h.pressDash();
    h.tick();
    h.releaseAll();

    // Wait for dash to end
    h.tickUntil(() => h.state !== "DASHING", 60);

    // Immediately try to dash again
    h.pressDash();
    h.tick();
    h.releaseAll();

    // Should NOT be dashing (cooldown active)
    expect(h.state).not.toBe("DASHING");
  });

  it("can dash again after cooldown expires", () => {
    const h = standingOnFloor();

    h.pressDash();
    h.tick();
    h.releaseAll();

    // Wait for dash + cooldown
    h.tickN(
      DEFAULT_PLAYER_PARAMS.dashDurationFrames +
        DEFAULT_PLAYER_PARAMS.dashWindupFrames +
        DEFAULT_PLAYER_PARAMS.dashCooldownFrames +
        5,
    );

    h.pressDash();
    h.tick();

    expect(h.state).toBe("DASHING");
  });

  it("can dash in the air", () => {
    const h = standingOnFloor();

    // Jump first
    h.pressJump();
    h.tick();
    h.releaseAll();
    h.tickN(5);
    expect(h.grounded).toBe(false);

    h.pressDash();
    h.tick();

    expect(h.state).toBe("DASHING");
  });

  describe("dash distance", () => {
    it("covers expected distance on ground dash", () => {
      const h = standingOnFloor();
      const startX = h.pos.x;

      h.pressDash();
      h.tick();
      h.releaseAll();

      // Tick through full dash duration + extra frames for exit
      const totalDashFrames =
        DEFAULT_PLAYER_PARAMS.dashWindupFrames +
        DEFAULT_PLAYER_PARAMS.dashDurationFrames;
      h.tickN(totalDashFrames + 5);

      expect(h.state).not.toBe("DASHING");

      const distance = h.pos.x - startX;
      const theoreticalDistance =
        DEFAULT_PLAYER_PARAMS.dashSpeed *
        DEFAULT_PLAYER_PARAMS.dashDurationFrames *
        FIXED_TIMESTEP;

      // At least 90% of theoretical max (tolerance for wind-up frame)
      expect(distance).toBeGreaterThanOrEqual(theoreticalDistance * 0.9);
    });
  });

  describe("dash-cancel", () => {
    it("cancels running into dash", () => {
      const h = standingOnFloor();

      // Get into RUNNING state
      h.pressRight();
      h.tickN(10);
      expect(h.state).toBe("RUNNING");

      h.pressDash();
      h.tick();

      expect(h.state).toBe("DASHING");
    });

    it("cancels jumping into dash", () => {
      const h = standingOnFloor();

      // Jump
      h.pressJump();
      h.tick();
      expect(h.state).toBe("JUMPING");
      h.releaseAll();

      // A few airborne frames
      h.tickN(3);
      expect(h.grounded).toBe(false);

      h.pressDash();
      h.tick();

      expect(h.state).toBe("DASHING");
    });

    it("cancels falling into dash", () => {
      const h = standingOnFloor();

      // Jump, then wait for apex to reach FALLING
      h.pressJump();
      h.tick();
      h.releaseAll();

      h.tickUntil(() => h.state === "FALLING", 120);
      expect(h.state).toBe("FALLING");

      h.pressDash();
      h.tick();

      expect(h.state).toBe("DASHING");
    });
  });

  describe("speed boost", () => {
    it("preserves speed into run after ground dash", () => {
      const h = standingOnFloor();

      // Hold right for the entire test
      h.pressRight();
      h.tickN(5);
      expect(h.state).toBe("RUNNING");

      // Dash while holding right
      h.pressDash();
      h.tick();
      expect(h.state).toBe("DASHING");

      // Release dash but keep holding right
      h.input.release(InputAction.Dash);

      // During the dash, gravity is zeroed and vy=0, so the player sits
      // exactly flush with the floor (no overlap → grounded=false). In the
      // real game, sub-pixel gravity drift maintains overlap. Simulate this
      // by nudging the player 0.1px into the ground after each dash tick so
      // the next frame's collision resolution detects overlap and sets
      // grounded=true.
      let dashFrameCount = 0;
      while (h.state === "DASHING" && dashFrameCount < 60) {
        h.player.position.y += 0.1;
        h.tick();
        dashFrameCount++;
      }

      expect(h.state).toBe("RUNNING");

      // Speed should be above normal max (boost active)
      expect(h.horizontalSpeed).toBeGreaterThan(
        DEFAULT_PLAYER_PARAMS.maxRunSpeed,
      );

      // Still boosted after 5 frames
      h.tickN(5);
      expect(h.horizontalSpeed).toBeGreaterThan(
        DEFAULT_PLAYER_PARAMS.maxRunSpeed,
      );

      // Boost decays back to normal after enough frames
      h.tickN(60);
      expect(h.horizontalSpeed).toBeLessThanOrEqual(
        DEFAULT_PLAYER_PARAMS.maxRunSpeed + 1,
      );
    });
  });

  describe("directional dash", () => {
    it("dashes upward when holding up", () => {
      const h = standingOnFloor();

      // Hold up before dashing
      h.pressUp();
      h.pressDash();
      h.tick(); // Enter DASHING

      // Tick past wind-up into active phase
      h.tickN(DEFAULT_PLAYER_PARAMS.dashWindupFrames + 2);

      expect(h.vel.y).toBeLessThan(0); // Moving upward
      expect(Math.abs(h.vel.x)).toBeLessThan(10); // Minimal horizontal movement
    });

    it("dashes diagonally when holding right and up", () => {
      const h = standingOnFloor();

      // Hold right + up before dashing
      h.pressRight();
      h.pressUp();
      h.pressDash();
      h.tick(); // Enter DASHING

      // Tick past wind-up into active phase
      h.tickN(DEFAULT_PLAYER_PARAMS.dashWindupFrames + 2);

      expect(h.vel.x).toBeGreaterThan(0); // Moving right
      expect(h.vel.y).toBeLessThan(0); // Moving upward

      // Both components should be approximately equal in magnitude
      // (normalized diagonal: dashSpeed / sqrt(2) ≈ 424)
      const ratio = Math.abs(h.vel.x) / Math.abs(h.vel.y);
      expect(ratio).toBeGreaterThan(0.9);
      expect(ratio).toBeLessThan(1.1);
    });
  });

  describe("air dash reset", () => {
    it("can dash again after air dash cooldown expires", () => {
      const h = standingOnFloor();

      // Jump
      h.pressJump();
      h.tick();
      h.releaseAll();
      h.tickN(5);
      expect(h.grounded).toBe(false);

      // Air dash
      h.pressDash();
      h.tick();
      expect(h.state).toBe("DASHING");
      h.releaseAll();

      // Wait for dash to end
      h.tickUntil(() => h.state !== "DASHING", 60);
      expect(h.state).toBe("FALLING");

      // Wait for cooldown to expire
      h.tickN(DEFAULT_PLAYER_PARAMS.dashCooldownFrames + 5);
      expect(h.player.dashAvailable).toBe(true);

      // Land
      h.tickUntil(() => h.grounded, 300);

      // Should be able to dash again
      h.pressDash();
      h.tick();
      expect(h.state).toBe("DASHING");
    });
  });
});
