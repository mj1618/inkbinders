import { describe, it, expect } from "vitest";
import { GameTestHarness } from "../GameTestHarness";
import { DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";

describe("ground movement", () => {
  function standingOnFloor() {
    const h = new GameTestHarness();
    h.addFloor(300);
    h.setPlayerPosition(100, 300 - DEFAULT_PLAYER_PARAMS.playerHeight);
    h.tick();
    return h;
  }

  it("player falls to ground and becomes grounded", () => {
    const h = new GameTestHarness();
    h.addFloor(300);
    // Start just above the floor so the fall is short (no hard landing)
    h.setPlayerPosition(100, 250);

    expect(h.grounded).toBe(false);
    h.tickUntil(() => h.grounded, 120);
    expect(h.grounded).toBe(true);
    // State transitions to IDLE on the next frame after grounded is set
    h.tick();
    expect(h.state).toBe("IDLE");
  });

  it("player runs right when holding right", () => {
    const h = standingOnFloor();

    h.pressRight();
    h.tickN(30);

    expect(h.vel.x).toBeGreaterThan(0);
    expect(h.state).toBe("RUNNING");
    expect(h.facingRight).toBe(true);
  });

  it("player runs left when holding left", () => {
    const h = standingOnFloor();

    h.pressLeft();
    h.tickN(30);

    expect(h.vel.x).toBeLessThan(0);
    expect(h.state).toBe("RUNNING");
    expect(h.facingRight).toBe(false);
  });

  it("player decelerates to idle after releasing movement", () => {
    const h = standingOnFloor();

    h.pressRight();
    h.tickN(30);
    const runningSpeed = h.vel.x;
    expect(runningSpeed).toBeGreaterThan(0);

    h.releaseAll();
    h.tickN(5);
    expect(h.vel.x).toBeLessThan(runningSpeed);

    h.tickUntil(() => h.state === "IDLE", 120);
    expect(h.state).toBe("IDLE");
  });

  it("player reaches max run speed", () => {
    const h = standingOnFloor();
    const maxSpeed = DEFAULT_PLAYER_PARAMS.maxRunSpeed;

    h.pressRight();
    h.tickN(120);

    expect(h.horizontalSpeed).toBeCloseTo(maxSpeed, 0);
  });

  it("player turns and changes facing direction", () => {
    const h = standingOnFloor();

    h.pressRight();
    h.tickN(10);
    expect(h.facingRight).toBe(true);

    h.releaseAll();
    h.tick();
    h.pressLeft();
    h.tickN(10);
    expect(h.facingRight).toBe(false);
  });

  it("player stays grounded on a platform", () => {
    const h = standingOnFloor();

    h.pressRight();
    for (let i = 0; i < 30; i++) {
      h.tick();
      expect(h.grounded).toBe(true);
    }
  });

  describe("acceleration", () => {
    it("reaches 50% max speed no slower than half the time to max speed", () => {
      const h = standingOnFloor();
      const halfSpeed = DEFAULT_PLAYER_PARAMS.maxRunSpeed * 0.5;
      const maxSpeed = DEFAULT_PLAYER_PARAMS.maxRunSpeed;

      h.pressRight();

      let fHalf = -1;
      let fMax = -1;
      for (let i = 0; i < 120; i++) {
        h.tick();
        if (fHalf === -1 && h.horizontalSpeed >= halfSpeed) fHalf = i + 1;
        if (fMax === -1 && h.horizontalSpeed >= maxSpeed - 1) {
          fMax = i + 1;
          break;
        }
      }

      expect(fHalf).toBeGreaterThan(0);
      expect(fMax).toBeGreaterThan(0);
      // With constant acceleration, F_half should be <= F_max / 2
      expect(fHalf).toBeLessThanOrEqual(fMax / 2);
    });
  });

  describe("deceleration", () => {
    it("stops within 15 frames from max speed", () => {
      const h = standingOnFloor();

      h.pressRight();
      h.tickUntil(() => h.horizontalSpeed >= DEFAULT_PLAYER_PARAMS.maxRunSpeed - 1, 60);

      h.releaseAll();
      const frames = h.tickUntil(() => h.state === "IDLE", 30);
      expect(frames).toBeLessThan(15);
    });
  });

  describe("turn-around", () => {
    it("flips facing within 2 frames of pressing opposite direction", () => {
      const h = standingOnFloor();

      h.pressRight();
      h.tickN(30);
      expect(h.facingRight).toBe(true);

      h.releaseAll();
      h.tick();
      h.pressLeft();
      h.tickN(2);
      expect(h.facingRight).toBe(false);
    });
  });

  describe("crouch mechanics", () => {
    it("enters CROUCHING from IDLE when pressing down", () => {
      const h = standingOnFloor();
      // Settle onto the ground (may need extra frames to transition to IDLE)
      h.tickUntil(() => h.state === "IDLE", 10);

      h.pressDown();
      h.tick();
      expect(h.state).toBe("CROUCHING");
      expect(h.player.size.y).toBe(DEFAULT_PLAYER_PARAMS.crouchHeight);
    });

    it("enters CROUCH_SLIDING from RUNNING when pressing down at speed", () => {
      const h = standingOnFloor();
      h.tickUntil(() => h.state === "IDLE", 10);

      h.pressRight();
      // Tick until speed exceeds slideMinSpeed
      h.tickUntil(
        () => h.horizontalSpeed > DEFAULT_PLAYER_PARAMS.slideMinSpeed,
        10,
      );

      h.pressDown();
      h.tick();
      expect(h.state).toBe("CROUCH_SLIDING");
      expect(h.player.size.y).toBe(DEFAULT_PLAYER_PARAMS.crouchHeight);
    });

    it("crouch slide decelerates to CROUCHING", () => {
      const h = standingOnFloor();
      h.tickUntil(() => h.state === "IDLE", 10);

      h.pressRight();
      h.tickUntil(
        () => h.horizontalSpeed >= DEFAULT_PLAYER_PARAMS.maxRunSpeed - 1,
        30,
      );

      // Enter slide (hold Down while running)
      h.pressDown();
      h.tick();
      expect(h.state).toBe("CROUCH_SLIDING");

      // Release right only, keep Down held so player stays crouching
      h.releaseRight();
      h.tick(); // Let input update propagate

      const frames = h.tickUntil(
        () => h.state === "CROUCHING",
        120,
      );
      expect(frames).toBeGreaterThan(0);
      expect(h.state).toBe("CROUCHING");
      expect(h.horizontalSpeed).toBeLessThan(DEFAULT_PLAYER_PARAMS.slideMinSpeed);
    });

    it("slides under a low ceiling gap", () => {
      const h = new GameTestHarness();
      // Floor at y=300
      h.addFloor(300);
      // Low ceiling starting at x=120, 40px wide: bottom at y=265
      // Standing player (top=260) overlaps ceiling (bottom=265) → blocked
      // Crouching player (top=276) doesn't overlap → fits through
      h.addPlatform(120, 233, 40, 32);

      h.setPlayerPosition(50, 300 - DEFAULT_PLAYER_PARAMS.playerHeight);
      h.tickUntil(() => h.grounded, 10);

      // Build speed
      h.pressRight();
      h.tickUntil(
        () => h.horizontalSpeed > DEFAULT_PLAYER_PARAMS.slideMinSpeed,
        10,
      );

      // Enter crouch slide
      h.pressDown();
      h.tick();
      expect(h.state).toBe("CROUCH_SLIDING");
      expect(h.player.size.y).toBe(DEFAULT_PLAYER_PARAMS.crouchHeight);

      // The ceiling section goes from x=120 to x=160
      // Player width is 24, so player needs right edge past 160: pos.x > 160 - 24 = 136
      // But we want the player center to pass through, so check pos.x > 160
      let passedCeiling = false;
      for (let i = 0; i < 60; i++) {
        h.tick();
        // Player's right edge has passed the ceiling's right edge
        if (h.pos.x + DEFAULT_PLAYER_PARAMS.playerWidth > 160) {
          passedCeiling = true;
          break;
        }
      }
      expect(passedCeiling).toBe(true);
    });

    it("cannot stand up under a low ceiling", () => {
      const h = new GameTestHarness();
      // Floor at y=300, ceiling everywhere at y=233 (bottom=265)
      // Standing player (top=260) collides with ceiling. Crouching (top=276) does not.
      // We need a gap-free ceiling over the entire floor to trap the player.
      // But the player can't START standing under this ceiling (would collide).
      // So we place the player already at crouching height.
      h.addFloor(300);
      h.addPlatform(0, 233, 960, 32);

      // Place the player at crouching position directly
      const crouchY = 300 - DEFAULT_PLAYER_PARAMS.crouchHeight;
      h.setPlayerPosition(100, crouchY);
      h.player.size.y = DEFAULT_PLAYER_PARAMS.crouchHeight;

      // Hold down to enter/stay in crouching
      h.pressDown();
      h.tickUntil(() => h.grounded, 10);

      // Player should be crouching and grounded
      expect(h.grounded).toBe(true);
      expect(h.player.size.y).toBe(DEFAULT_PLAYER_PARAMS.crouchHeight);

      // Release down to try to stand up
      h.releaseAll();
      h.tickN(10);

      // Should still be crouching because ceiling blocks standing
      expect(h.state).toBe("CROUCHING");
      expect(h.player.size.y).toBe(DEFAULT_PLAYER_PARAMS.crouchHeight);
    });
  });

  describe("max speed", () => {
    it("never exceeds max run speed on flat ground", () => {
      const h = standingOnFloor();
      const maxSpeed = DEFAULT_PLAYER_PARAMS.maxRunSpeed;
      const epsilon = 0.1;

      h.pressRight();
      for (let i = 0; i < 300; i++) {
        h.tick();
        expect(h.horizontalSpeed).toBeLessThanOrEqual(maxSpeed + epsilon);
      }
    });
  });
});
