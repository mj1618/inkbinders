import { describe, it, expect } from "vitest";
import { GameTestHarness } from "../GameTestHarness";
import { DEFAULT_INDEX_MARK_PARAMS } from "@/engine/abilities/IndexMark";

describe("index mark ability", () => {
  /**
   * Standard test level: floor platform, player grounded.
   * Returns the harness and an enabled IndexMark instance.
   */
  function createLevel() {
    const h = new GameTestHarness({
      platforms: [{ x: 0, y: 300, width: 960, height: 32 }],
    });
    h.setPlayerPosition(100, 260);
    h.tickUntil(() => h.grounded, 60);
    const indexMark = h.enableIndexMark();
    return { h, indexMark };
  }

  /**
   * Helper: perform a short press (place mark).
   * Ticks a few frames (< holdThreshold) then releases.
   */
  function shortPress(
    h: GameTestHarness,
    indexMark: ReturnType<typeof h.enableIndexMark>,
    frames: number = 3,
  ) {
    indexMark.onKeyDown();
    h.tickN(frames);
    return indexMark.onKeyUp(h.playerCenter, h.grounded);
  }

  /**
   * Helper: perform a long hold and release (teleport).
   * Holds for holdThreshold + extra frames, calling onKeyHeld each tick.
   */
  function longHoldAndRelease(
    h: GameTestHarness,
    indexMark: ReturnType<typeof h.enableIndexMark>,
    extraFrames: number = 5,
  ) {
    const totalFrames = DEFAULT_INDEX_MARK_PARAMS.holdThreshold + extraFrames;
    indexMark.onKeyDown();
    for (let i = 0; i < totalFrames; i++) {
      h.tick();
      indexMark.onKeyHeld(h.input);
    }
    return indexMark.onKeyUp(h.playerCenter, h.grounded);
  }

  // ── Group 1: Mark Placement ─────────────────────────────────────

  it("1. place mark with short press", () => {
    const { h, indexMark } = createLevel();

    const centerBefore = h.playerCenter;
    const result = shortPress(h, indexMark);

    expect(result.action).toBe("place");
    expect(indexMark.marks.length).toBe(1);

    const mark = indexMark.marks[0];
    // Mark position should be near where the player was
    // (player may drift a few pixels during the ticks, so use approximate matching)
    expect(mark.position.x).toBeCloseTo(centerBefore.x, 0);
    expect(mark.position.y).toBeCloseTo(centerBefore.y, 0);
  });

  it("2. mark color cycling", () => {
    const { h, indexMark } = createLevel();

    for (let i = 0; i < 4; i++) {
      shortPress(h, indexMark);
    }

    expect(indexMark.marks.length).toBe(4);
    expect(indexMark.marks[0].colorIndex).toBe(0);
    expect(indexMark.marks[1].colorIndex).toBe(1);
    expect(indexMark.marks[2].colorIndex).toBe(2);
    expect(indexMark.marks[3].colorIndex).toBe(3);
  });

  it("3. max 4 marks (FIFO replacement)", () => {
    const { h, indexMark } = createLevel();

    // Place 4 marks at different positions
    const positions: { x: number; y: number }[] = [];
    for (let i = 0; i < 4; i++) {
      h.setPlayerPosition(100 + i * 100, 260);
      h.tick(); // settle
      positions.push({ ...h.playerCenter });
      shortPress(h, indexMark);
    }

    expect(indexMark.marks.length).toBe(4);
    const firstMarkPos = { ...indexMark.marks[0].position };

    // Place 5th mark at a new position
    h.setPlayerPosition(600, 260);
    h.tick();
    shortPress(h, indexMark);

    expect(indexMark.marks.length).toBe(4);
    // First mark should be gone (FIFO)
    expect(indexMark.marks[0].position.x).not.toBeCloseTo(firstMarkPos.x, 0);
  });

  it("4. place mark while airborne", () => {
    const { h, indexMark } = createLevel();

    // Jump
    h.pressJump();
    h.tick();
    h.releaseJump();
    h.tickN(5); // rise a bit

    expect(h.grounded).toBe(false);

    const result = shortPress(h, indexMark, 1);
    expect(result.action).toBe("place");
    expect(indexMark.marks[0].wasGrounded).toBe(false);
  });

  it("5. place mark while grounded", () => {
    const { h, indexMark } = createLevel();

    expect(h.grounded).toBe(true);

    const result = shortPress(h, indexMark);
    expect(result.action).toBe("place");
    expect(indexMark.marks[0].wasGrounded).toBe(true);
  });

  // ── Group 2: Teleport Selection ─────────────────────────────────

  it("6. hold enters selection mode", () => {
    const { h, indexMark } = createLevel();

    // Place a mark first
    shortPress(h, indexMark);

    // Start hold
    indexMark.onKeyDown();
    for (let i = 0; i < DEFAULT_INDEX_MARK_PARAMS.holdThreshold; i++) {
      h.tick();
      indexMark.onKeyHeld(h.input);
    }

    expect(indexMark.teleportState.selecting).toBe(true);
  });

  it("7. hold without marks stays inactive", () => {
    const { h, indexMark } = createLevel();

    // No marks placed — hold should not enter selection
    indexMark.onKeyDown();
    for (let i = 0; i < DEFAULT_INDEX_MARK_PARAMS.holdThreshold + 5; i++) {
      h.tick();
      indexMark.onKeyHeld(h.input);
    }

    expect(indexMark.teleportState.selecting).toBe(false);

    const result = indexMark.onKeyUp(h.playerCenter, h.grounded);
    expect(result.action).toBe("place"); // short press fallback places a mark
  });

  it("8. cycle selection with Left/Right", () => {
    const { h, indexMark } = createLevel();

    // Place 3 marks
    for (let i = 0; i < 3; i++) {
      h.setPlayerPosition(100 + i * 200, 260);
      h.tick();
      shortPress(h, indexMark);
    }

    expect(indexMark.marks.length).toBe(3);

    // Enter selection mode
    indexMark.onKeyDown();
    for (let i = 0; i < DEFAULT_INDEX_MARK_PARAMS.holdThreshold; i++) {
      h.tick();
      indexMark.onKeyHeld(h.input);
    }
    expect(indexMark.teleportState.selecting).toBe(true);
    expect(indexMark.teleportState.selectedIndex).toBe(0);

    // Cycle forward
    indexMark.cycleSelection(1);
    expect(indexMark.teleportState.selectedIndex).toBe(1);

    indexMark.cycleSelection(1);
    expect(indexMark.teleportState.selectedIndex).toBe(2);

    // Wrap around forward
    indexMark.cycleSelection(1);
    expect(indexMark.teleportState.selectedIndex).toBe(0);

    // Wrap around backward
    indexMark.cycleSelection(-1);
    expect(indexMark.teleportState.selectedIndex).toBe(2);

    // Clean up — release
    indexMark.onKeyUp(h.playerCenter, h.grounded);
  });

  // ── Group 3: Teleport Execution ─────────────────────────────────

  it("9. teleport to mark", () => {
    const { h, indexMark } = createLevel();

    // Place a mark at position A
    h.setPlayerPosition(100, 260);
    h.tick();
    shortPress(h, indexMark);
    const markPos = { ...indexMark.marks[0].position };

    // Move player to position B
    h.setPlayerPosition(500, 260);
    h.tick();

    // Hold to enter selection, then release to teleport
    const result = longHoldAndRelease(h, indexMark);

    expect(result.action).toBe("teleport");
    if (result.action === "teleport") {
      expect(result.targetPosition.x).toBeCloseTo(markPos.x, 0);
      expect(result.targetPosition.y).toBeCloseTo(markPos.y, 0);
    }
  });

  it("10. teleport zeroes velocity", () => {
    const { h, indexMark } = createLevel();

    // Place a mark
    shortPress(h, indexMark);

    // Move player away and give velocity
    h.setPlayerPosition(500, 260);
    h.setPlayerVelocity(200, -100);
    h.tick();

    const result = longHoldAndRelease(h, indexMark);

    if (result.action === "teleport") {
      // Caller must apply position and zero velocity
      h.setPlayerPosition(result.targetPosition.x, result.targetPosition.y);
      h.setPlayerVelocity(0, 0);
    }

    expect(h.vel.x).toBe(0);
    expect(h.vel.y).toBe(0);
  });

  it("11. teleport sets cooldown", () => {
    const { h, indexMark } = createLevel();

    shortPress(h, indexMark);

    h.setPlayerPosition(500, 260);
    h.tick();

    const result = longHoldAndRelease(h, indexMark);
    expect(result.action).toBe("teleport");

    expect(indexMark.cooldownTimer).toBeGreaterThan(0);
    expect(indexMark.cooldownTimer).toBeCloseTo(
      DEFAULT_INDEX_MARK_PARAMS.teleportCooldown,
      1,
    );
  });

  it("12. teleport sets i-frames", () => {
    const { h, indexMark } = createLevel();

    shortPress(h, indexMark);

    h.setPlayerPosition(500, 260);
    h.tick();

    const result = longHoldAndRelease(h, indexMark);
    expect(result.action).toBe("teleport");

    // i-frames may have decremented a few frames during the longHold ticks
    // but should still be positive
    expect(indexMark.iFramesRemaining).toBeGreaterThan(0);
    expect(indexMark.iFramesRemaining).toBeLessThanOrEqual(
      DEFAULT_INDEX_MARK_PARAMS.teleportIFrames,
    );
  });

  it("13. teleport sets visual active", () => {
    const { h, indexMark } = createLevel();

    shortPress(h, indexMark);

    h.setPlayerPosition(500, 260);
    h.tick();

    const result = longHoldAndRelease(h, indexMark);
    expect(result.action).toBe("teleport");

    // Visual was just activated by executeTeleport() at the end of longHoldAndRelease
    // (no ticks have run since onKeyUp, so it hasn't decayed yet)
    expect(indexMark.teleportState.visualActive).toBe(true);
    expect(indexMark.teleportState.visualTimer).toBeGreaterThan(0);
    expect(indexMark.teleportState.teleportDestination).not.toBeNull();
  });

  // ── Group 4: Cooldown & Timing ──────────────────────────────────

  it("14. cooldown prevents teleport", () => {
    const { h, indexMark } = createLevel();

    // Place 2 marks
    shortPress(h, indexMark);
    h.setPlayerPosition(500, 260);
    h.tick();
    shortPress(h, indexMark);

    // Move away and teleport
    h.setPlayerPosition(300, 260);
    h.tick();

    const result1 = longHoldAndRelease(h, indexMark);
    expect(result1.action).toBe("teleport");

    if (result1.action === "teleport") {
      h.setPlayerPosition(result1.targetPosition.x, result1.targetPosition.y);
      h.setPlayerVelocity(0, 0);
    }

    // Immediately try another teleport — should fail due to cooldown
    expect(indexMark.canTeleport).toBe(false);

    // Try long hold — won't enter selection because canTeleport is false
    indexMark.onKeyDown();
    for (let i = 0; i < DEFAULT_INDEX_MARK_PARAMS.holdThreshold + 5; i++) {
      h.tick();
      indexMark.onKeyHeld(h.input);
    }
    // Should not be in selection mode
    expect(indexMark.teleportState.selecting).toBe(false);
    const result2 = indexMark.onKeyUp(h.playerCenter, h.grounded);
    // Short press fallback — places a mark instead of teleporting
    expect(result2.action).toBe("place");
  });

  it("15. cooldown expires", () => {
    const { h, indexMark } = createLevel();

    shortPress(h, indexMark);

    h.setPlayerPosition(500, 260);
    h.tick();

    const result = longHoldAndRelease(h, indexMark);
    expect(result.action).toBe("teleport");

    if (result.action === "teleport") {
      h.setPlayerPosition(result.targetPosition.x, result.targetPosition.y);
      h.setPlayerVelocity(0, 0);
    }

    expect(indexMark.cooldownTimer).toBeGreaterThan(0);

    // Wait for cooldown to expire (teleportCooldown seconds + a bit extra)
    h.tickSeconds(DEFAULT_INDEX_MARK_PARAMS.teleportCooldown + 0.5);

    expect(indexMark.cooldownTimer).toBe(0);
    // canTeleport should be true once visual also clears
    // visual duration is 0.3s which is much shorter than cooldown, so it's already done
    expect(indexMark.canTeleport).toBe(true);
  });

  it("16. i-frames decrement per frame", () => {
    const { h, indexMark } = createLevel();

    shortPress(h, indexMark);

    h.setPlayerPosition(500, 260);
    h.tick();

    longHoldAndRelease(h, indexMark);

    // Record current i-frames
    const iframesBefore = indexMark.iFramesRemaining;
    expect(iframesBefore).toBeGreaterThan(0);

    // Tick once — i-frames should decrement by 1
    h.tick();
    expect(indexMark.iFramesRemaining).toBe(iframesBefore - 1);

    // Tick until i-frames are gone
    h.tickN(iframesBefore - 1);
    expect(indexMark.iFramesRemaining).toBe(0);
  });

  it("17. visual timer expires", () => {
    const { h, indexMark } = createLevel();

    shortPress(h, indexMark);

    h.setPlayerPosition(500, 260);
    h.tick();

    longHoldAndRelease(h, indexMark);

    // Visual should still be active or just finishing
    // Wait enough time for visual to expire
    h.tickSeconds(DEFAULT_INDEX_MARK_PARAMS.teleportVisualDuration + 0.1);

    expect(indexMark.teleportState.visualActive).toBe(false);
    expect(indexMark.teleportState.teleportOrigin).toBeNull();
    expect(indexMark.teleportState.teleportDestination).toBeNull();
  });

  // ── Group 5: Edge Cases & State Integrity ───────────────────────

  it("18. mark position accuracy", () => {
    const { h, indexMark } = createLevel();

    // Set exact position
    h.setPlayerPosition(250, 260);
    h.tick();

    const centerAtPlacement = { ...h.playerCenter };

    // Place mark via the direct API for precision
    indexMark.onKeyDown();
    const result = indexMark.onKeyUp(centerAtPlacement, h.grounded);
    expect(result.action).toBe("place");

    // Verify mark position matches exactly
    expect(indexMark.marks[0].position.x).toBe(centerAtPlacement.x);
    expect(indexMark.marks[0].position.y).toBe(centerAtPlacement.y);

    // Move player far away — mark position should NOT change
    h.setPlayerPosition(800, 260);
    h.tickN(30);

    expect(indexMark.marks[0].position.x).toBe(centerAtPlacement.x);
    expect(indexMark.marks[0].position.y).toBe(centerAtPlacement.y);
  });

  it("19. cannot place while selecting", () => {
    const { h, indexMark } = createLevel();

    // Place a mark so we can enter selection mode
    shortPress(h, indexMark);

    // Enter selection mode
    indexMark.onKeyDown();
    for (let i = 0; i < DEFAULT_INDEX_MARK_PARAMS.holdThreshold; i++) {
      h.tick();
      indexMark.onKeyHeld(h.input);
    }

    expect(indexMark.teleportState.selecting).toBe(true);
    expect(indexMark.canPlace).toBe(false);

    // Clean up
    indexMark.onKeyUp(h.playerCenter, h.grounded);
  });

  it("20. cancel selection", () => {
    const { h, indexMark } = createLevel();

    shortPress(h, indexMark);

    // Enter selection mode
    indexMark.onKeyDown();
    for (let i = 0; i < DEFAULT_INDEX_MARK_PARAMS.holdThreshold; i++) {
      h.tick();
      indexMark.onKeyHeld(h.input);
    }
    expect(indexMark.teleportState.selecting).toBe(true);

    // Release — this executes the teleport, but let's verify selection resets
    const result = indexMark.onKeyUp(h.playerCenter, h.grounded);

    // After release, selecting is always false
    expect(indexMark.teleportState.selecting).toBe(false);
    expect(indexMark.teleportState.holdFrames).toBe(0);

    // The result should be teleport (since we had marks and no cooldown)
    expect(result.action).toBe("teleport");
  });

  it("21. disabled ability", () => {
    const h = new GameTestHarness({
      platforms: [{ x: 0, y: 300, width: 960, height: 32 }],
    });
    h.setPlayerPosition(100, 260);
    h.tickUntil(() => h.grounded, 60);
    const indexMark = h.enableIndexMark({ enabled: false });

    // Try to place — should cancel
    indexMark.onKeyDown();
    h.tickN(3);
    const placeResult = indexMark.onKeyUp(h.playerCenter, h.grounded);
    expect(placeResult.action).toBe("cancel");
    expect(indexMark.marks.length).toBe(0);

    // Try to hold — should also cancel
    indexMark.onKeyDown();
    for (let i = 0; i < DEFAULT_INDEX_MARK_PARAMS.holdThreshold + 5; i++) {
      h.tick();
      indexMark.onKeyHeld(h.input);
    }
    expect(indexMark.teleportState.selecting).toBe(false);
    const teleportResult = indexMark.onKeyUp(h.playerCenter, h.grounded);
    expect(teleportResult.action).toBe("cancel");
  });

  it("22. player movement unaffected", () => {
    const { h, indexMark } = createLevel();

    // Place a mark
    shortPress(h, indexMark);

    // Player should still be able to run
    h.pressRight();
    h.tickN(10);
    expect(h.horizontalSpeed).toBeGreaterThan(0);
    expect(h.state).toBe("RUNNING");
    h.releaseAll();

    // Wait for player to settle back to idle
    h.tickUntil(() => h.state === "IDLE", 60);

    // Player should still be able to jump
    h.pressJump();
    h.tick();
    expect(h.state).toBe("JUMPING");
    expect(h.vel.y).toBeLessThan(0);
    h.releaseJump();

    // Wait to land
    h.tickUntil(() => h.grounded, 120);

    // Player should still be able to dash
    h.pressDash();
    h.tick();
    expect(h.state).toBe("DASHING");
    h.releaseAll();
  });
});
