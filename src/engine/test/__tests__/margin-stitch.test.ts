import { describe, it, expect } from "vitest";
import { GameTestHarness } from "../GameTestHarness";
import { DEFAULT_MARGIN_STITCH_PARAMS } from "@/engine/abilities/MarginStitch";

describe("margin stitch ability", () => {
  /**
   * Standard test level: floor platform + two parallel walls forming a gap.
   * Left wall right-edge at x=200, right wall left-edge at x=280 → 80px gap.
   * Walls span y=100..300, floor at y=300. Player starts on the floor near the walls.
   */
  function createWallPairLevel() {
    const h = new GameTestHarness({
      platforms: [
        // Floor
        { x: 0, y: 300, width: 960, height: 32 },
        // Left wall (right edge at x=200)
        { x: 100, y: 100, width: 100, height: 200 },
        // Right wall (left edge at x=280)
        { x: 280, y: 100, width: 100, height: 200 },
      ],
    });
    h.setPlayerPosition(230, 260);
    h.tickUntil(() => h.grounded, 60);
    const stitch = h.enableMarginStitch();
    h.tick(); // one tick to trigger scanForPairs
    return { h, stitch };
  }

  /** Level with only a floor — no walls to pair. */
  function createOpenLevel() {
    const h = new GameTestHarness({
      platforms: [{ x: 0, y: 300, width: 960, height: 32 }],
    });
    h.setPlayerPosition(100, 260);
    h.tickUntil(() => h.grounded, 60);
    const stitch = h.enableMarginStitch();
    h.tick();
    return { h, stitch };
  }

  // ── Wall Pair Detection (scanForPairs) ──────────────────────────────

  it("1. scan finds wall pair", () => {
    const { stitch } = createWallPairLevel();
    expect(stitch.detectedPairs.length).toBeGreaterThanOrEqual(1);
    expect(stitch.targetedPair).not.toBeNull();
  });

  it("2. no target in open space", () => {
    const { stitch } = createOpenLevel();
    expect(stitch.detectedPairs.length).toBe(0);
    expect(stitch.targetedPair).toBeNull();
  });

  it("3. pair respects max range", () => {
    const range = DEFAULT_MARGIN_STITCH_PARAMS.maxStitchRange;

    // Place walls far from the player
    const h = new GameTestHarness({
      platforms: [
        { x: 0, y: 300, width: 960, height: 32 },
        // Walls far away at x=700..800 and x=850..950 (100px gap)
        { x: 700, y: 100, width: 100, height: 200 },
        { x: 850, y: 100, width: 100, height: 200 },
      ],
    });
    h.setPlayerPosition(100, 260);
    h.tickUntil(() => h.grounded, 60);
    const stitch = h.enableMarginStitch();
    h.tick();

    // Player at x=100 is far from walls at x=700+ — should be out of range
    expect(stitch.detectedPairs.length).toBe(0);

    // Move player closer
    h.setPlayerPosition(750, 260);
    h.tick();
    expect(stitch.detectedPairs.length).toBeGreaterThanOrEqual(1);
  });

  it("4. gap too narrow rejected", () => {
    // Player width is 24, MIN_PASSAGE_CLEARANCE is 4, so min gap = 28
    // Create walls with a 20px gap (too narrow)
    const h = new GameTestHarness({
      platforms: [
        { x: 0, y: 300, width: 960, height: 32 },
        { x: 100, y: 100, width: 100, height: 200 }, // right edge at x=200
        { x: 220, y: 100, width: 100, height: 200 }, // left edge at x=220, gap=20
      ],
    });
    h.setPlayerPosition(180, 260);
    h.tickUntil(() => h.grounded, 60);
    const stitch = h.enableMarginStitch();
    h.tick();

    expect(stitch.detectedPairs.length).toBe(0);
  });

  it("5. gap too wide rejected", () => {
    // Create walls with gap > maxStitchRange (200px > 160px)
    const h = new GameTestHarness({
      platforms: [
        { x: 0, y: 300, width: 960, height: 32 },
        { x: 100, y: 100, width: 100, height: 200 }, // right edge at x=200
        { x: 400, y: 100, width: 100, height: 200 }, // left edge at x=400, gap=200
      ],
    });
    h.setPlayerPosition(300, 260);
    h.tickUntil(() => h.grounded, 60);
    const stitch = h.enableMarginStitch();
    h.tick();

    // The gap of 200px exceeds maxStitchRange of 160px — no pairs should be detected
    expect(stitch.detectedPairs.length).toBe(0);
  });

  it("6. targeted pair is nearest", () => {
    // Two wall pairs at different distances from the player
    const h = new GameTestHarness({
      platforms: [
        { x: 0, y: 300, width: 960, height: 32 },
        // Near pair: right edge at x=200, left edge at x=260 (gap=60)
        { x: 150, y: 100, width: 50, height: 200 },
        { x: 260, y: 100, width: 50, height: 200 },
        // Far pair: right edge at x=500, left edge at x=560 (gap=60)
        { x: 450, y: 100, width: 50, height: 200 },
        { x: 560, y: 100, width: 50, height: 200 },
      ],
    });
    h.setPlayerPosition(220, 260);
    h.tickUntil(() => h.grounded, 60);
    const stitch = h.enableMarginStitch();
    h.tick();

    expect(stitch.detectedPairs.length).toBeGreaterThanOrEqual(1);
    expect(stitch.targetedPair).not.toBeNull();

    // The near pair should be targeted
    const target = stitch.targetedPair!;
    // Target walls should be the ones near x=200/260, not x=500/560
    expect(target.wallA.surfaceX).toBeLessThan(400);
  });

  // ── Activation ──────────────────────────────────────────────────────

  it("7. activate creates passage", () => {
    const { h, stitch } = createWallPairLevel();
    const result = stitch.activate(h.playerCenter.y);
    expect(result).toBe(true);
    expect(stitch.activeStitch).not.toBeNull();
    expect(stitch.activeStitch!.isOpen).toBe(true);
  });

  it("8. activate returns true on success", () => {
    const { h, stitch } = createWallPairLevel();
    expect(stitch.canActivate).toBe(true);
    const result = stitch.activate(h.playerCenter.y);
    expect(result).toBe(true);
  });

  it("9. activate fails without target", () => {
    const { h, stitch } = createOpenLevel();
    expect(stitch.targetedPair).toBeNull();
    const result = stitch.activate(h.playerCenter.y);
    expect(result).toBe(false);
  });

  it("10. activate fails during cooldown", () => {
    const { h, stitch } = createWallPairLevel();

    // Activate, let it expire
    stitch.activate(h.playerCenter.y);
    h.tickSeconds(DEFAULT_MARGIN_STITCH_PARAMS.stitchDuration + 0.1);

    // Should be on cooldown now
    expect(stitch.cooldownTimer).toBeGreaterThan(0);

    // Try to activate again — should fail
    const result = stitch.activate(h.playerCenter.y);
    expect(result).toBe(false);
  });

  it("11. canActivate reflects state", () => {
    const { h, stitch } = createWallPairLevel();

    // With valid target: can activate
    expect(stitch.canActivate).toBe(true);

    // Activate and let expire (triggers cooldown)
    stitch.activate(h.playerCenter.y);
    h.tickSeconds(DEFAULT_MARGIN_STITCH_PARAMS.stitchDuration + 0.1);

    // During cooldown: cannot activate
    expect(stitch.canActivate).toBe(false);

    // After cooldown: can activate again
    h.tickSeconds(DEFAULT_MARGIN_STITCH_PARAMS.stitchCooldown + 0.1);
    expect(stitch.canActivate).toBe(true);
  });

  // ── TileMap Exclusion / Player Traversal ────────────────────────────

  it("12. exclusion zone lets player overlap wall", () => {
    // The exclusion zone suppresses wall collision while the player's bounds
    // overlap the passage rect. This lets the player penetrate into the wall
    // region — something impossible without the stitch.
    const { h, stitch } = createWallPairLevel();

    // Record the blocked position without stitch
    const blockedX = 280 - h.player.size.x; // = 256, right wall left edge minus player width

    // Activate stitch
    stitch.activate(h.playerCenter.y);
    expect(stitch.activeStitch).not.toBeNull();
    expect(h.tileMap.exclusionZones.length).toBe(1);

    // Move player rightward — with the stitch active, the right wall (x=280)
    // should be excluded and the player can enter its space
    h.pressRight();
    h.tickN(30);

    // Without the stitch, the player would stop at x=256 (blocked by wall).
    // With the stitch, the player should reach further because the wall
    // collision is suppressed while within the passage rect.
    expect(h.pos.x).toBeGreaterThan(blockedX);
  });

  it("13. wall is solid before stitch", () => {
    const { h, stitch } = createWallPairLevel();

    // Position player between the walls WITHOUT activating stitch
    h.setPlayerPosition(210, 200);
    h.tick();

    // Try to run through
    h.pressRight();
    h.tickN(120);

    // Player should be blocked by the right wall (cannot pass x=280 - playerWidth)
    expect(h.pos.x).toBeLessThanOrEqual(280);
  });

  it("14. passage rect is spatially precise", () => {
    const h = new GameTestHarness({
      platforms: [
        { x: 0, y: 400, width: 960, height: 32 }, // Floor
        // Tall walls spanning y=0..400
        { x: 100, y: 0, width: 100, height: 400 }, // right edge x=200
        { x: 280, y: 0, width: 100, height: 400 }, // left edge x=280
      ],
    });
    h.setPlayerPosition(230, 360);
    h.tickUntil(() => h.grounded, 60);
    const stitch = h.enableMarginStitch();
    h.tick();

    // Activate with player near the bottom of the walls
    stitch.activate(h.playerCenter.y);
    expect(stitch.activeStitch).not.toBeNull();

    // The passage should be centered around the player's Y
    const passageRect = stitch.activeStitch!.passageRect;

    // Now try to move through at a position ABOVE the passage (outside the exclusion zone rect)
    // Release existing stitch first, set up again
    h.releaseAll();
    h.setPlayerPosition(210, 50); // Well above the passage
    h.tick();

    h.pressRight();
    h.tickN(60);

    // Player should be blocked above the passage — wall is still solid there
    expect(h.pos.x).toBeLessThanOrEqual(280);
  });

  // ── Duration and Expiry ─────────────────────────────────────────────

  it("15. stitch expires after duration", () => {
    const { h, stitch } = createWallPairLevel();
    stitch.activate(h.playerCenter.y);
    expect(stitch.activeStitch).not.toBeNull();
    expect(stitch.activeStitch!.isOpen).toBe(true);

    // Advance past the stitch duration
    h.tickSeconds(DEFAULT_MARGIN_STITCH_PARAMS.stitchDuration + 0.1);

    // Stitch should have expired (closed then cleared after one frame)
    // After the clear cycle, activeStitch should be null
    h.tick(); // extra tick for pendingStitchClear
    expect(stitch.activeStitch).toBeNull();
  });

  it("16. wall becomes solid after expiry", () => {
    const { h, stitch } = createWallPairLevel();

    h.setPlayerPosition(210, 200);
    h.tick();
    stitch.activate(h.playerCenter.y);

    // Let the stitch expire
    h.releaseAll();
    h.tickSeconds(DEFAULT_MARGIN_STITCH_PARAMS.stitchDuration + 0.2);

    // Move player back to before the wall and try to pass
    h.setPlayerPosition(210, 200);
    h.tick();
    h.pressRight();
    h.tickN(120);

    // Wall should be solid again — player can't pass
    expect(h.pos.x).toBeLessThanOrEqual(280);
  });

  it("17. remaining time decreases", () => {
    const { h, stitch } = createWallPairLevel();
    stitch.activate(h.playerCenter.y);

    const initialTime = stitch.activeStitch!.remainingTime;
    h.tickN(30); // half a second at 60Hz
    const laterTime = stitch.activeStitch!.remainingTime;

    expect(laterTime).toBeLessThan(initialTime);
  });

  // ── Cooldown ────────────────────────────────────────────────────────

  it("18. cooldown starts after expiry", () => {
    const { h, stitch } = createWallPairLevel();
    stitch.activate(h.playerCenter.y);

    // Let stitch expire
    h.tickSeconds(DEFAULT_MARGIN_STITCH_PARAMS.stitchDuration + 0.1);

    expect(stitch.cooldownTimer).toBeGreaterThan(0);
    // Cooldown should be approximately stitchCooldown
    expect(stitch.cooldownTimer).toBeLessThanOrEqual(
      DEFAULT_MARGIN_STITCH_PARAMS.stitchCooldown,
    );
  });

  it("19. cooldown prevents activation", () => {
    const { h, stitch } = createWallPairLevel();
    stitch.activate(h.playerCenter.y);
    h.tickSeconds(DEFAULT_MARGIN_STITCH_PARAMS.stitchDuration + 0.1);

    expect(stitch.canActivate).toBe(false);
    const result = stitch.activate(h.playerCenter.y);
    expect(result).toBe(false);
  });

  it("20. cooldown expires and allows reactivation", () => {
    const { h, stitch } = createWallPairLevel();
    stitch.activate(h.playerCenter.y);

    // Wait for stitch to expire + full cooldown
    const totalWait =
      DEFAULT_MARGIN_STITCH_PARAMS.stitchDuration +
      DEFAULT_MARGIN_STITCH_PARAMS.stitchCooldown +
      0.2;
    h.tickSeconds(totalWait);

    expect(stitch.cooldownTimer).toBe(0);
    expect(stitch.canActivate).toBe(true);

    const result = stitch.activate(h.playerCenter.y);
    expect(result).toBe(true);
  });

  // ── Replacement Behavior ────────────────────────────────────────────

  it("21. activating replaces existing stitch", () => {
    // Two wall pairs
    const h = new GameTestHarness({
      platforms: [
        { x: 0, y: 300, width: 960, height: 32 },
        // Pair A
        { x: 100, y: 100, width: 50, height: 200 }, // right edge x=150
        { x: 210, y: 100, width: 50, height: 200 }, // left edge x=210
        // Pair B
        { x: 500, y: 100, width: 50, height: 200 }, // right edge x=550
        { x: 610, y: 100, width: 50, height: 200 }, // left edge x=610
      ],
    });
    h.setPlayerPosition(170, 260);
    h.tickUntil(() => h.grounded, 60);
    const stitch = h.enableMarginStitch();
    h.tick();

    // Activate on pair A (nearest)
    stitch.activate(h.playerCenter.y);
    expect(stitch.activeStitch).not.toBeNull();
    const firstPassage = stitch.activeStitch!.passageRect;

    // Move near pair B and activate there
    h.setPlayerPosition(570, 260);
    h.tick();

    stitch.activate(h.playerCenter.y);
    expect(stitch.activeStitch).not.toBeNull();
    expect(stitch.activeStitch!.isOpen).toBe(true);

    // The passage should be different (pair B region)
    const secondPassage = stitch.activeStitch!.passageRect;
    expect(secondPassage.x).not.toBe(firstPassage.x);
  });

  it("22. replacement does not trigger cooldown", () => {
    const h = new GameTestHarness({
      platforms: [
        { x: 0, y: 300, width: 960, height: 32 },
        // Pair A
        { x: 100, y: 100, width: 50, height: 200 },
        { x: 210, y: 100, width: 50, height: 200 },
        // Pair B
        { x: 500, y: 100, width: 50, height: 200 },
        { x: 610, y: 100, width: 50, height: 200 },
      ],
    });
    h.setPlayerPosition(170, 260);
    h.tickUntil(() => h.grounded, 60);
    const stitch = h.enableMarginStitch();
    h.tick();

    // Activate on pair A
    stitch.activate(h.playerCenter.y);

    // Move near pair B and replace
    h.setPlayerPosition(570, 260);
    h.tick();
    stitch.activate(h.playerCenter.y);

    // No cooldown — replacement is free
    expect(stitch.cooldownTimer).toBe(0);
  });

  // ── Edge Cases ──────────────────────────────────────────────────────

  it("23. disabled ability cannot activate", () => {
    const { h, stitch } = createWallPairLevel();
    stitch.params.enabled = false;
    h.tick(); // rescan with disabled

    expect(stitch.canActivate).toBe(false);
    expect(stitch.detectedPairs.length).toBe(0);
    expect(stitch.targetedPair).toBeNull();

    const result = stitch.activate(h.playerCenter.y);
    expect(result).toBe(false);
  });

  it("24. getEjectionPosition returns correction when player is inside closed passage", () => {
    const { h, stitch } = createWallPairLevel();

    // Activate stitch
    stitch.activate(h.playerCenter.y);
    expect(stitch.activeStitch).not.toBeNull();
    const passage = stitch.activeStitch!.passageRect;

    // Tick until the stitch just closes (remainingTime drops to 0).
    // The harness tick order is: player.update → stitch.scanForPairs → stitch.update.
    // When stitch.update finds remainingTime <= 0, it calls closeStitch() which
    // sets isOpen=false and pendingStitchClear=true. On the NEXT tick's update,
    // activeStitch is set to null. So we have exactly one frame to check ejection.
    h.tickUntil(
      () => stitch.activeStitch !== null && !stitch.activeStitch.isOpen,
      // Max frames: stitchDuration * 60 + some buffer
      Math.ceil(DEFAULT_MARGIN_STITCH_PARAMS.stitchDuration * 60) + 10,
    );

    // The activeStitch should exist with isOpen=false for this one frame
    expect(stitch.activeStitch).not.toBeNull();
    expect(stitch.activeStitch!.isOpen).toBe(false);

    // Simulate the player being inside the passage at close time
    // (in the real game the test page handles this before collision resolves)
    const insidePos = { x: passage.x + 10, y: passage.y + 4 };
    const ejection = stitch.getEjectionPosition(insidePos, h.player.size);
    expect(ejection).not.toBeNull();

    // Ejection should push the player outside the passage
    if (ejection) {
      const playerRight = ejection.x + h.player.size.x;
      const playerLeft = ejection.x;
      const outsideLeft = playerRight <= passage.x;
      const outsideRight = playerLeft >= passage.x + passage.width;
      expect(outsideLeft || outsideRight).toBe(true);
    }
  });
});
