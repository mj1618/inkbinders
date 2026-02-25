import { describe, it, expect } from "vitest";
import { GameTestHarness } from "../GameTestHarness";
import { DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";
import { SURFACE_PROPERTIES } from "@/engine/physics/Surfaces";

describe("surface types", () => {
  /** Create a harness with a floor of the given surface type. */
  function floorWithSurface(surfaceType?: "normal" | "bouncy" | "icy" | "sticky" | "conveyor") {
    const h = new GameTestHarness();
    h.addPlatform(0, 300, 960, 32, surfaceType);
    h.setPlayerPosition(100, 300 - DEFAULT_PLAYER_PARAMS.playerHeight);
    h.tick(); // settle onto floor
    return h;
  }

  /** Get player running to the right and return the harness once grounded+idle. */
  function standingOnSurface(surfaceType?: "normal" | "bouncy" | "icy" | "sticky" | "conveyor") {
    const h = floorWithSurface(surfaceType);
    h.tickUntil(() => h.state === "IDLE", 10);
    return h;
  }

  // ── Normal Surface Baseline ──────────────────────────────────

  describe("normal surface", () => {
    it("has no speed modification", () => {
      const h = standingOnSurface("normal");
      const maxSpeed = DEFAULT_PLAYER_PARAMS.maxRunSpeed;

      h.pressRight();
      h.tickN(120);

      // Speed should approach maxRunSpeed but never exceed it
      expect(h.horizontalSpeed).toBeGreaterThan(maxSpeed * 0.9);
      expect(h.horizontalSpeed).toBeLessThanOrEqual(maxSpeed + 0.1);
    });

    it("undefined surface type behaves like normal", () => {
      const h = standingOnSurface(undefined);
      const maxSpeed = DEFAULT_PLAYER_PARAMS.maxRunSpeed;

      h.pressRight();
      h.tickN(120);

      expect(h.horizontalSpeed).toBeGreaterThan(maxSpeed * 0.9);
      expect(h.horizontalSpeed).toBeLessThanOrEqual(maxSpeed + 0.1);
    });
  });

  // ── Bouncy Surface ───────────────────────────────────────────

  describe("bouncy surface", () => {
    it("landing on bouncy surface causes upward bounce", () => {
      const h = new GameTestHarness();
      h.addPlatform(0, 400, 960, 32, "bouncy");
      // Start 200px above the platform — enough fall speed to trigger bounce (>50px/s)
      h.setPlayerPosition(100, 200);

      // Wait until collision grounds the player (bounce happens one frame later)
      h.tickUntil(() => h.grounded, 120);
      // The bounce triggers on the next state machine update when FALLING sees grounded=true
      h.tick();

      // After bounce, player should be moving upward and in JUMPING state
      expect(h.vel.y).toBeLessThan(0);
      expect(h.state).toBe("JUMPING");
    });

    it("bounce velocity reflects with bounce coefficient", () => {
      const h = new GameTestHarness();
      h.addPlatform(0, 400, 960, 32, "bouncy");
      h.setPlayerPosition(100, 200);

      // Let player fall until grounded, then one more tick for the bounce
      h.tickUntil(() => h.grounded, 120);
      // preLandingVelocityY was stored on the frame collision resolved
      const impactVelocity = Math.abs(h.player.preLandingVelocityY);
      h.tick(); // bounce frame

      // The bounce velocity should be roughly impactVelocity * bounce coefficient
      const bounceCoeff = SURFACE_PROPERTIES.bouncy.bounce;
      // vel.y after bounce = -impactVelocity * bounce + gravity * dt (one frame of gravity)
      // So |vel.y| should be close to impactVelocity * bounce
      expect(Math.abs(h.vel.y)).toBeGreaterThan(0);
      expect(Math.abs(h.vel.y)).toBeLessThanOrEqual(impactVelocity * bounceCoeff + 50);
      expect(Math.abs(h.vel.y)).toBeGreaterThan(impactVelocity * bounceCoeff * 0.5);
    });

    it("holding crouch suppresses bounce", () => {
      const h = new GameTestHarness();
      h.addPlatform(0, 400, 960, 32, "bouncy");
      h.setPlayerPosition(100, 200);

      // Hold crouch before landing
      h.pressDown();

      // Wait until grounded
      h.tickUntil(() => h.grounded, 120);
      // One more tick: FALLING sees grounded=true, but crouch suppresses bounce
      h.tick();

      // Player should remain grounded and not bouncing
      expect(h.grounded).toBe(true);
      expect(h.vel.y).toBeGreaterThanOrEqual(0);
      // Should be in a grounded state (CROUCHING since down is held)
      expect(["CROUCHING", "HARD_LANDING", "IDLE"].includes(h.state)).toBe(true);
    });
  });

  // ── Icy Surface ──────────────────────────────────────────────

  describe("icy surface", () => {
    it("has slower acceleration than normal", () => {
      const hNormal = standingOnSurface("normal");
      const hIcy = standingOnSurface("icy");

      hNormal.pressRight();
      hIcy.pressRight();

      // Use a small number of frames before normal hits max speed clamping
      hNormal.tickN(10);
      hIcy.tickN(10);

      // Icy acceleration is 0.25x normal — should be much slower in early frames
      expect(hIcy.horizontalSpeed).toBeLessThan(hNormal.horizontalSpeed);
      // Icy should be significantly slower (accelMultiplier 0.25x)
      expect(hIcy.horizontalSpeed).toBeLessThan(hNormal.horizontalSpeed * 0.5);
    });

    it("allows higher max speed than normal", () => {
      // Need a very long platform so the player doesn't run off the icy surface
      const h = new GameTestHarness({ worldWidth: 10000 });
      h.addPlatform(0, 300, 10000, 32, "icy");
      h.setPlayerPosition(100, 300 - DEFAULT_PLAYER_PARAMS.playerHeight);
      h.tick();
      h.tickUntil(() => h.state === "IDLE", 10);

      const normalMaxSpeed = DEFAULT_PLAYER_PARAMS.maxRunSpeed;
      const icyMaxSpeedMultiplier = SURFACE_PROPERTIES.icy.maxSpeedMultiplier;

      h.pressRight();
      // Icy has slow acceleration (0.25x), needs many frames to reach max speed
      h.tickN(600);

      // Should exceed normal max speed
      expect(h.horizontalSpeed).toBeGreaterThan(normalMaxSpeed);
      // Should approach icy max speed
      const icyMaxSpeed = normalMaxSpeed * icyMaxSpeedMultiplier;
      expect(h.horizontalSpeed).toBeGreaterThan(icyMaxSpeed * 0.9);
    });

    it("takes longer to decelerate than normal", () => {
      // Normal surface deceleration
      const hNormal = standingOnSurface("normal");
      hNormal.pressRight();
      hNormal.tickN(60); // reach max speed
      hNormal.releaseAll();
      const normalDecelFrames = hNormal.tickWhile(() => hNormal.horizontalSpeed > 1, 300);

      // Icy surface deceleration
      const hIcy = standingOnSurface("icy");
      hIcy.pressRight();
      hIcy.tickN(60); // get to some speed (won't be max icy speed, but some speed)
      const icySpeedBeforeRelease = hIcy.horizontalSpeed;
      hIcy.releaseAll();
      const icyDecelFrames = hIcy.tickWhile(() => hIcy.horizontalSpeed > 1, 3000);

      // Icy friction is 0.08x — deceleration should take much longer
      // Even if icy reached a lower speed (due to slow accel), friction is so low it slides longer
      expect(icyDecelFrames).toBeGreaterThan(normalDecelFrames);
      // Should be dramatically longer given 0.08 friction multiplier
      expect(icyDecelFrames).toBeGreaterThan(normalDecelFrames * 3);
    });
  });

  // ── Sticky Surface ───────────────────────────────────────────

  describe("sticky surface", () => {
    it("has lower max speed than normal", () => {
      const h = standingOnSurface("sticky");
      const normalMaxSpeed = DEFAULT_PLAYER_PARAMS.maxRunSpeed;
      const stickyMaxMultiplier = SURFACE_PROPERTIES.sticky.maxSpeedMultiplier;

      h.pressRight();
      h.tickN(120);

      const stickyMaxSpeed = normalMaxSpeed * stickyMaxMultiplier;
      expect(h.horizontalSpeed).toBeLessThanOrEqual(stickyMaxSpeed + 0.1);
      expect(h.horizontalSpeed).toBeGreaterThan(stickyMaxSpeed * 0.9);
    });

    it("decelerates faster than normal", () => {
      // Normal surface
      const hNormal = standingOnSurface("normal");
      hNormal.pressRight();
      hNormal.tickN(60);
      hNormal.releaseAll();
      const normalFrames = hNormal.tickWhile(() => hNormal.horizontalSpeed > 1, 120);

      // Sticky surface
      const hSticky = standingOnSurface("sticky");
      hSticky.pressRight();
      hSticky.tickN(60);
      hSticky.releaseAll();
      const stickyFrames = hSticky.tickWhile(() => hSticky.horizontalSpeed > 1, 120);

      // Sticky friction is 4.0x — should stop much faster
      expect(stickyFrames).toBeLessThan(normalFrames);
    });
  });

  // ── Conveyor Surface ─────────────────────────────────────────

  describe("conveyor surface", () => {
    it("pushes idle player in conveyor direction", () => {
      const h = standingOnSurface("conveyor");
      const startX = h.pos.x;

      // Don't press any movement — just stand on the conveyor
      h.tickN(30);

      // Conveyor speed is 150 px/s (positive = right)
      expect(h.vel.x).toBeGreaterThan(0);
      expect(h.pos.x).toBeGreaterThan(startX);
    });

    it("accelerates player to approximately conveyor speed when idle", () => {
      const h = standingOnSurface("conveyor");
      const conveyorSpeed = SURFACE_PROPERTIES.conveyor.conveyorSpeed;

      // Give it time to ramp up to conveyor speed
      h.tickN(120);

      // Velocity should approach conveyor speed
      expect(h.vel.x).toBeGreaterThan(conveyorSpeed * 0.5);
      expect(h.vel.x).toBeLessThanOrEqual(conveyorSpeed + 10);
    });

    it("adds push force on top of player running speed", () => {
      const h = standingOnSurface("conveyor");

      // Run in the same direction as conveyor
      h.pressRight();
      h.tickN(60);

      // Player should be moving faster than on a normal surface
      const hNormal = standingOnSurface("normal");
      hNormal.pressRight();
      hNormal.tickN(60);

      // Conveyor adds to velocity, but max speed clamping may limit it
      // At minimum, the player should be at or near max speed
      expect(h.horizontalSpeed).toBeGreaterThanOrEqual(hNormal.horizontalSpeed * 0.95);
    });
  });

  // ── Wall Surface Types ───────────────────────────────────────

  describe("wall surface types", () => {
    /** Set up a wall slide scenario with a specific wall surface type. */
    function wallSlideSetup(wallSurfaceType?: "normal" | "bouncy" | "icy" | "sticky" | "conveyor") {
      const h = new GameTestHarness();
      h.addFloor(600);
      // Right wall with the specified surface type
      h.addPlatform(300, 0, 32, 632, wallSurfaceType);
      // Left wall (normal)
      h.addPlatform(-32, 0, 32, 632);
      // Start near the right wall, elevated
      h.setPlayerPosition(250, 50);
      h.tick();
      return h;
    }

    /** Get into wall sliding state against the right wall. */
    function enterWallSlide(h: GameTestHarness): boolean {
      h.pressRight();
      h.tickUntil(() => h.state === "WALL_SLIDING" || h.grounded, 120);
      return h.state === "WALL_SLIDING";
    }

    it("icy wall has faster slide than normal wall", () => {
      // Normal wall
      const hNormal = wallSlideSetup("normal");
      const slidingNormal = enterWallSlide(hNormal);
      expect(slidingNormal).toBe(true);
      hNormal.tickN(30);
      const normalSlideVy = hNormal.vel.y;

      // Icy wall
      const hIcy = wallSlideSetup("icy");
      const slidingIcy = enterWallSlide(hIcy);
      expect(slidingIcy).toBe(true);
      hIcy.tickN(30);
      const icySlideVy = hIcy.vel.y;

      // Icy wall friction multiplier is 0.15 — divides into slide speed
      // So icy wall slide is faster (higher vel.y, since positive = downward)
      expect(icySlideVy).toBeGreaterThan(normalSlideVy);
    });

    it("sticky wall has slower slide than normal wall", () => {
      // Normal wall
      const hNormal = wallSlideSetup("normal");
      const slidingNormal = enterWallSlide(hNormal);
      expect(slidingNormal).toBe(true);
      hNormal.tickN(30);
      const normalSlideVy = hNormal.vel.y;

      // Sticky wall
      const hSticky = wallSlideSetup("sticky");
      const slidingSticky = enterWallSlide(hSticky);
      expect(slidingSticky).toBe(true);
      hSticky.tickN(30);
      const stickySlideVy = hSticky.vel.y;

      // Sticky wall friction multiplier is 5.0 — divides into slide speed
      // So sticky wall slide is slower (lower vel.y)
      expect(stickySlideVy).toBeLessThan(normalSlideVy);
    });
  });
});
