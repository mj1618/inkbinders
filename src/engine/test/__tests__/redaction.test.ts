import { describe, it, expect, beforeEach } from "vitest";
import { GameTestHarness } from "../GameTestHarness";
import { DEFAULT_REDACTION_PARAMS } from "@/engine/abilities/Redaction";
import {
  createSpikes,
  createBarrier,
  resetObstacleIdCounter,
  checkDamageOverlap,
} from "@/engine/physics/Obstacles";

beforeEach(() => {
  resetObstacleIdCounter();
});

/**
 * Standard level: floor + player grounded, facing right.
 * Player center ≈ (112, 280) with default 24×40 size.
 */
function createRedactionLevel() {
  const h = new GameTestHarness({
    platforms: [{ x: 0, y: 300, width: 960, height: 32 }],
  });
  h.setPlayerPosition(100, 260);
  h.tickUntil(() => h.grounded, 60);
  const redaction = h.enableRedaction();
  return { h, redaction };
}

describe("redaction ability", () => {
  // ── Group 1: Target Detection ──────────────────────────────────────

  describe("target detection", () => {
    it("1. scans and finds obstacle in range", () => {
      const { h, redaction } = createRedactionLevel();
      // Spikes 100px to the right of player center (~212, 280)
      h.addObstacle(createSpikes({ x: 200, y: 270, width: 32, height: 16 }));
      h.tick();

      expect(redaction.detectedObstacles.length).toBe(1);
      expect(redaction.targetedObstacle).not.toBeNull();
    });

    it("2. out-of-range obstacle not targeted", () => {
      const { h, redaction } = createRedactionLevel();
      // Spikes 300px to the right — beyond maxRedactionRange (200)
      h.addObstacle(createSpikes({ x: 450, y: 270, width: 32, height: 16 }));
      h.tick();

      expect(redaction.targetedObstacle).toBeNull();
    });

    it("3. obstacle outside aim cone not targeted", () => {
      const { h, redaction } = createRedactionLevel();
      // Spikes directly above player (90° from horizontal facing right)
      h.addObstacle(createSpikes({ x: 100, y: 100, width: 32, height: 16 }));
      h.tick();

      // May be detected (in range) but should not be targeted (outside ±45° cone)
      expect(redaction.targetedObstacle).toBeNull();
    });

    it("4. nearest obstacle is targeted", () => {
      const { h, redaction } = createRedactionLevel();
      const closeSpikes = createSpikes({
        x: 180,
        y: 270,
        width: 32,
        height: 16,
      });
      const farSpikes = createSpikes({
        x: 250,
        y: 270,
        width: 32,
        height: 16,
      });
      h.addObstacle(closeSpikes);
      h.addObstacle(farSpikes);
      h.tick();

      expect(redaction.targetedObstacle).not.toBeNull();
      expect(redaction.targetedObstacle!.obstacle).toBe(closeSpikes);
    });

    it("5. already-redacted obstacle skipped", () => {
      const { h, redaction } = createRedactionLevel();
      const obsA = createSpikes({ x: 180, y: 270, width: 32, height: 16 });
      const obsB = createSpikes({ x: 220, y: 270, width: 32, height: 16 });
      h.addObstacle(obsA);
      h.addObstacle(obsB);

      // Target and activate on A
      h.tick();
      expect(redaction.targetedObstacle!.obstacle).toBe(obsA);
      redaction.activate();

      // Next scan should skip A, target B
      h.tick();
      expect(redaction.targetedObstacle).not.toBeNull();
      expect(redaction.targetedObstacle!.obstacle).toBe(obsB);
    });
  });

  // ── Group 2: Activation ────────────────────────────────────────────

  describe("activation", () => {
    it("6. successful activation returns true", () => {
      const { h, redaction } = createRedactionLevel();
      h.addObstacle(createSpikes({ x: 180, y: 270, width: 32, height: 16 }));
      h.tick();

      expect(redaction.activate()).toBe(true);
    });

    it("7. activation sets obstacle.active to false", () => {
      const { h, redaction } = createRedactionLevel();
      const spikes = createSpikes({ x: 180, y: 270, width: 32, height: 16 });
      h.addObstacle(spikes);
      h.tick();

      redaction.activate();
      expect(spikes.active).toBe(false);
    });

    it("8. activation creates exclusion zone for solid obstacle", () => {
      const { h, redaction } = createRedactionLevel();
      // Barrier blocking the path to the right
      const barrier = createBarrier({ x: 200, y: 260, width: 32, height: 40 });
      h.addObstacle(barrier);
      h.tick();

      // Before redaction: barrier platform is in tilemap and blocks
      const platformCountBefore = h.tileMap.platforms.length;
      expect(platformCountBefore).toBeGreaterThan(1); // floor + barrier

      redaction.activate();

      // After redaction: exclusion zone should be added
      expect(h.tileMap.exclusionZones.length).toBe(1);
    });

    it("9. non-solid obstacles skip exclusion zone", () => {
      const { h, redaction } = createRedactionLevel();
      const spikes = createSpikes({ x: 180, y: 270, width: 32, height: 16 });
      h.addObstacle(spikes);
      h.tick();

      redaction.activate();
      // Spikes are not solid — no exclusion zone needed
      expect(h.tileMap.exclusionZones.length).toBe(0);
      expect(spikes.active).toBe(false);
    });

    it("10. cannot activate without target", () => {
      const { h, redaction } = createRedactionLevel();
      // No obstacles added
      h.tick();

      expect(redaction.canActivate).toBe(false);
      expect(redaction.activate()).toBe(false);
    });

    it("11. cannot activate during cooldown", () => {
      const { h, redaction } = createRedactionLevel();
      const spikes1 = createSpikes({ x: 180, y: 270, width: 32, height: 16 });
      h.addObstacle(spikes1);
      h.tick();
      redaction.activate();

      // Wait for redaction to expire
      h.tickSeconds(DEFAULT_REDACTION_PARAMS.redactionDuration + 0.1);

      expect(redaction.cooldownTimer).toBeGreaterThan(0);

      // Add a new obstacle to target
      const spikes2 = createSpikes({ x: 200, y: 270, width: 32, height: 16 });
      h.addObstacle(spikes2);
      h.tick();

      expect(redaction.canActivate).toBe(false);
    });

    it("12. activation adds to activeRedactions", () => {
      const { h, redaction } = createRedactionLevel();
      h.addObstacle(createSpikes({ x: 180, y: 270, width: 32, height: 16 }));
      h.tick();

      expect(redaction.activeRedactions.length).toBe(0);
      redaction.activate();
      expect(redaction.activeRedactions.length).toBe(1);
    });
  });

  // ── Group 3: Duration & Expiration ─────────────────────────────────

  describe("duration and expiration", () => {
    it("13. redaction lasts for duration", () => {
      const { h, redaction } = createRedactionLevel();
      h.addObstacle(createSpikes({ x: 180, y: 270, width: 32, height: 16 }));
      h.tick();
      redaction.activate();

      // Tick for slightly less than full duration
      h.tickSeconds(DEFAULT_REDACTION_PARAMS.redactionDuration - 0.2);

      expect(redaction.activeRedactions.length).toBe(1);
    });

    it("14. redaction expires after duration", () => {
      const { h, redaction } = createRedactionLevel();
      h.addObstacle(createSpikes({ x: 180, y: 270, width: 32, height: 16 }));
      h.tick();
      redaction.activate();

      // Tick past the full duration
      h.tickSeconds(DEFAULT_REDACTION_PARAMS.redactionDuration + 0.1);

      expect(redaction.activeRedactions.length).toBe(0);
    });

    it("15. obstacle restored on expiration", () => {
      const { h, redaction } = createRedactionLevel();
      const spikes = createSpikes({ x: 180, y: 270, width: 32, height: 16 });
      h.addObstacle(spikes);
      h.tick();
      redaction.activate();
      expect(spikes.active).toBe(false);

      // Wait for expiry
      h.tickSeconds(DEFAULT_REDACTION_PARAMS.redactionDuration + 0.1);

      expect(spikes.active).toBe(true);
    });

    it("16. exclusion zone removed on expiration", () => {
      const { h, redaction } = createRedactionLevel();
      const barrier = createBarrier({ x: 200, y: 260, width: 32, height: 40 });
      h.addObstacle(barrier);
      h.tick();
      redaction.activate();

      expect(h.tileMap.exclusionZones.length).toBe(1);

      // Wait for expiry
      h.tickSeconds(DEFAULT_REDACTION_PARAMS.redactionDuration + 0.1);

      expect(h.tileMap.exclusionZones.length).toBe(0);
      expect(barrier.active).toBe(true);
    });

    it("17. cooldown starts on expiration", () => {
      const { h, redaction } = createRedactionLevel();
      h.addObstacle(createSpikes({ x: 180, y: 270, width: 32, height: 16 }));
      h.tick();
      redaction.activate();

      // Wait for expiry
      h.tickSeconds(DEFAULT_REDACTION_PARAMS.redactionDuration + 0.1);

      expect(redaction.cooldownTimer).toBeGreaterThan(0);
      expect(redaction.cooldownTimer).toBeLessThanOrEqual(
        DEFAULT_REDACTION_PARAMS.redactionCooldown,
      );
    });
  });

  // ── Group 4: Cooldown ──────────────────────────────────────────────

  describe("cooldown", () => {
    it("18. cooldown prevents activation", () => {
      const { h, redaction } = createRedactionLevel();
      const spikes1 = createSpikes({ x: 180, y: 270, width: 32, height: 16 });
      h.addObstacle(spikes1);
      h.tick();
      redaction.activate();

      // Wait for expiry (starts cooldown)
      h.tickSeconds(DEFAULT_REDACTION_PARAMS.redactionDuration + 0.1);
      expect(redaction.cooldownTimer).toBeGreaterThan(0);

      // New target available
      const spikes2 = createSpikes({ x: 200, y: 270, width: 32, height: 16 });
      h.addObstacle(spikes2);
      h.tick();

      expect(redaction.canActivate).toBe(false);
      expect(redaction.activate()).toBe(false);
    });

    it("19. cooldown expires and allows activation", () => {
      const { h, redaction } = createRedactionLevel();
      const spikes1 = createSpikes({ x: 180, y: 270, width: 32, height: 16 });
      h.addObstacle(spikes1);
      h.tick();
      redaction.activate();

      // Wait for expiry + cooldown
      h.tickSeconds(
        DEFAULT_REDACTION_PARAMS.redactionDuration +
          DEFAULT_REDACTION_PARAMS.redactionCooldown +
          0.2,
      );

      expect(redaction.cooldownTimer).toBe(0);

      // spikes1 is now restored and can be targeted again
      h.tick();
      expect(redaction.canActivate).toBe(true);
    });
  });

  // ── Group 5: Max Active Redactions ─────────────────────────────────

  describe("max active redactions", () => {
    it("20. can activate up to max", () => {
      const { h, redaction } = createRedactionLevel();
      const spikes1 = createSpikes({ x: 180, y: 270, width: 32, height: 16 });
      const spikes2 = createSpikes({ x: 220, y: 270, width: 32, height: 16 });
      h.addObstacle(spikes1);
      h.addObstacle(spikes2);

      // Activate first
      h.tick();
      expect(redaction.targetedObstacle!.obstacle).toBe(spikes1);
      redaction.activate();
      expect(redaction.activeRedactions.length).toBe(1);

      // Activate second
      h.tick();
      expect(redaction.targetedObstacle!.obstacle).toBe(spikes2);
      redaction.activate();
      expect(redaction.activeRedactions.length).toBe(2);
    });

    it("21. cannot exceed max active", () => {
      const { h, redaction } = createRedactionLevel();
      const spikes1 = createSpikes({ x: 170, y: 270, width: 20, height: 16 });
      const spikes2 = createSpikes({ x: 200, y: 270, width: 20, height: 16 });
      const spikes3 = createSpikes({ x: 230, y: 270, width: 20, height: 16 });
      h.addObstacle(spikes1);
      h.addObstacle(spikes2);
      h.addObstacle(spikes3);

      // Activate two
      h.tick();
      redaction.activate();
      h.tick();
      redaction.activate();
      expect(redaction.activeRedactions.length).toBe(2);

      // Third target available but max reached
      h.tick();
      expect(redaction.targetedObstacle).not.toBeNull();
      expect(redaction.canActivate).toBe(false);
      expect(redaction.activate()).toBe(false);
    });

    it("22. freeing a slot allows new activation", () => {
      const { h, redaction } = createRedactionLevel();
      const spikes1 = createSpikes({ x: 170, y: 270, width: 20, height: 16 });
      const spikes2 = createSpikes({ x: 200, y: 270, width: 20, height: 16 });
      const spikes3 = createSpikes({ x: 230, y: 270, width: 20, height: 16 });
      h.addObstacle(spikes1);
      h.addObstacle(spikes2);
      h.addObstacle(spikes3);

      // Activate two
      h.tick();
      redaction.activate();
      h.tick();
      redaction.activate();
      expect(redaction.activeRedactions.length).toBe(2);

      // Wait for both to expire + cooldown
      h.tickSeconds(
        DEFAULT_REDACTION_PARAMS.redactionDuration +
          DEFAULT_REDACTION_PARAMS.redactionCooldown +
          0.2,
      );

      expect(redaction.activeRedactions.length).toBe(0);
      expect(redaction.cooldownTimer).toBe(0);

      // Now activate the third
      h.tick();
      expect(redaction.canActivate).toBe(true);
      expect(redaction.activate()).toBe(true);
      expect(redaction.activeRedactions.length).toBe(1);
    });
  });

  // ── Group 6: Spike/Damage Integration ──────────────────────────────

  describe("spike/damage integration", () => {
    it("23. redacted spikes don't deal damage", () => {
      const { h, redaction } = createRedactionLevel();
      // Spikes to the right of the player, overlapping vertically
      // Player is at (100, 260) with size 24×40, so right edge = 124
      // Place spikes starting at x=124 so they're to the right and in the aim cone
      const spikes = createSpikes({ x: 124, y: 270, width: 40, height: 20 });
      h.addObstacle(spikes);
      h.tick();

      // Target the spikes — to the right, within aim cone
      expect(redaction.targetedObstacle).not.toBeNull();
      redaction.activate();
      expect(spikes.active).toBe(false);

      // Move player into the spike area
      h.setPlayerPosition(124, 270);
      h.tick();

      const playerBounds = h.player.getBounds();
      // After redaction: no damage (spikes inactive)
      expect(checkDamageOverlap(playerBounds, h.obstacles)).toBeNull();
    });

    it("24. restored spikes deal damage again", () => {
      const { h, redaction } = createRedactionLevel();
      // Spikes to the right, in aim cone
      const spikes = createSpikes({ x: 124, y: 270, width: 40, height: 20 });
      h.addObstacle(spikes);
      h.tick();

      expect(redaction.targetedObstacle).not.toBeNull();
      redaction.activate();
      expect(spikes.active).toBe(false);

      // Move player into the spike area
      h.setPlayerPosition(124, 270);
      h.tick();

      // During redaction: no damage
      expect(
        checkDamageOverlap(h.player.getBounds(), h.obstacles),
      ).toBeNull();

      // Wait for expiry
      h.tickSeconds(DEFAULT_REDACTION_PARAMS.redactionDuration + 0.1);

      // After expiry: spikes restored, damage again
      expect(spikes.active).toBe(true);
      expect(
        checkDamageOverlap(h.player.getBounds(), h.obstacles),
      ).toBe(spikes);
    });
  });

  // ── Group 7: Ejection on Restore (Barrier) ─────────────────────────

  describe("ejection on restore", () => {
    it("25. ejection when player inside restoring barrier", () => {
      const { h, redaction } = createRedactionLevel();
      // Barrier to the right of player
      const barrier = createBarrier({
        x: 200,
        y: 260,
        width: 32,
        height: 40,
      });
      h.addObstacle(barrier);
      h.tick();
      redaction.activate();

      // Simulate player being inside the barrier area.
      // Call getEjectionForObstacle directly with a position inside the barrier.
      const insidePos = { x: 205, y: 265 };
      const playerSize = { x: h.player.size.x, y: h.player.size.y };

      const ejection = redaction.getEjectionForObstacle(
        barrier,
        insidePos,
        playerSize,
      );

      expect(ejection).not.toBeNull();
      // Player should be pushed out — either left or right of the barrier
      if (ejection) {
        const outsideLeft = ejection.x + playerSize.x <= barrier.rect.x;
        const outsideRight =
          ejection.x >= barrier.rect.x + barrier.rect.width;
        const outsideTop = ejection.y + playerSize.y <= barrier.rect.y;
        const outsideBottom =
          ejection.y >= barrier.rect.y + barrier.rect.height;
        expect(
          outsideLeft || outsideRight || outsideTop || outsideBottom,
        ).toBe(true);
      }
    });
  });
});
