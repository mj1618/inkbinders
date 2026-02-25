import { describe, it, expect, beforeEach } from "vitest";
import { GameTestHarness } from "../GameTestHarness";
import { DEFAULT_PASTE_OVER_PARAMS, PasteOver } from "@/engine/abilities/PasteOver";
import { DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";
import type { Platform } from "@/engine/physics/TileMap";
import type { SurfaceType } from "@/engine/physics/Surfaces";

const PH = DEFAULT_PLAYER_PARAMS.playerHeight; // 40

/**
 * Standard level: normal floor + bouncy platform + normal target platform.
 * Player starts grounded on the normal floor.
 */
function createPasteOverLevel() {
  const h = new GameTestHarness({
    platforms: [
      { x: 0, y: 300, width: 400, height: 32 },
      { x: 400, y: 300, width: 200, height: 32, surfaceType: "bouncy" as SurfaceType },
      { x: 700, y: 300, width: 200, height: 32 },
    ],
  });
  h.setPlayerPosition(100, 300 - PH);
  h.tickUntil(() => h.grounded, 60);
  const pasteOver = h.enablePasteOver();
  return { h, pasteOver };
}

/** Move the player to a given x position and settle onto the platform. */
function movePlayerTo(h: GameTestHarness, x: number, floorY: number = 300) {
  h.releaseAll();
  h.setPlayerPosition(x, floorY - PH);
  // Tick a few frames to let surface detection + collision settle
  h.tickN(3);
}

describe("paste-over ability", () => {
  // ── Group 1: Auto-Capture (clipboard) ──────────────────────

  describe("auto-capture", () => {
    it("walking on bouncy surface captures it", () => {
      const { h, pasteOver } = createPasteOverLevel();
      movePlayerTo(h, 450);
      expect(pasteOver.clipboard).toBe("bouncy");
    });

    it("walking on normal surface does NOT capture", () => {
      const { h, pasteOver } = createPasteOverLevel();
      // Player starts on normal floor
      h.tickN(5);
      expect(pasteOver.clipboard).toBeNull();
    });

    it("clipboard retains last non-normal surface", () => {
      const { h, pasteOver } = createPasteOverLevel();
      // Move to bouncy
      movePlayerTo(h, 450);
      expect(pasteOver.clipboard).toBe("bouncy");
      // Move back to normal
      movePlayerTo(h, 100);
      expect(pasteOver.clipboard).toBe("bouncy");
    });

    it("clipboard updates when walking on different surface", () => {
      const h = new GameTestHarness({
        platforms: [
          { x: 0, y: 300, width: 300, height: 32, surfaceType: "bouncy" as SurfaceType },
          { x: 300, y: 300, width: 300, height: 32 },
          { x: 600, y: 300, width: 300, height: 32, surfaceType: "icy" as SurfaceType },
        ],
      });
      h.setPlayerPosition(100, 300 - PH);
      h.tickUntil(() => h.grounded, 60);
      const pasteOver = h.enablePasteOver();

      // Stand on bouncy
      movePlayerTo(h, 100);
      expect(pasteOver.clipboard).toBe("bouncy");

      // Move to icy
      movePlayerTo(h, 700);
      expect(pasteOver.clipboard).toBe("icy");
    });

    it("auto-capture triggers flash timer", () => {
      const { h, pasteOver } = createPasteOverLevel();
      movePlayerTo(h, 450);
      // Flash timer was set to 0.3 on capture, then decremented by a few ticks
      // Since movePlayerTo ticks 3 frames (~0.05s), it should still be > 0
      expect(pasteOver.clipboardFlashTimer).toBeGreaterThan(0);
    });

    it("no capture when disabled", () => {
      const { h, pasteOver } = createPasteOverLevel();
      pasteOver.params.enabled = false;
      movePlayerTo(h, 450);
      expect(pasteOver.clipboard).toBeNull();
    });
  });

  // ── Group 2: Target Scanning ───────────────────────────────

  describe("target scanning", () => {
    it("target platform found when grounded with clipboard", () => {
      const { h, pasteOver } = createPasteOverLevel();
      // Capture bouncy first
      movePlayerTo(h, 450);
      expect(pasteOver.clipboard).toBe("bouncy");
      // Move to target platform
      movePlayerTo(h, 750);
      expect(pasteOver.targetPlatform).not.toBeNull();
    });

    it("target platform is null when clipboard is empty", () => {
      const { h, pasteOver } = createPasteOverLevel();
      // Clipboard is null, player is grounded
      h.tickN(5);
      expect(pasteOver.clipboard).toBeNull();
      expect(pasteOver.targetPlatform).toBeNull();
    });

    it("target platform is null when airborne", () => {
      const { h, pasteOver } = createPasteOverLevel();
      // Capture bouncy first
      movePlayerTo(h, 450);
      expect(pasteOver.clipboard).toBe("bouncy");
      // Jump into the air
      h.pressJump();
      h.tick();
      h.releaseJump();
      // Tick a couple frames to get airborne
      h.tickN(5);
      expect(h.grounded).toBe(false);
      expect(pasteOver.targetPlatform).toBeNull();
    });

    it("target updates when moving to different platform", () => {
      const { h, pasteOver } = createPasteOverLevel();
      // Capture bouncy
      movePlayerTo(h, 450);
      const bouncyTarget = pasteOver.targetPlatform;
      expect(bouncyTarget).not.toBeNull();

      // Move to normal target platform at x=700
      movePlayerTo(h, 750);
      const normalTarget = pasteOver.targetPlatform;
      expect(normalTarget).not.toBeNull();
      expect(normalTarget).not.toBe(bouncyTarget);
    });
  });

  // ── Group 3: Activation ────────────────────────────────────

  describe("activation", () => {
    it("successful activation returns true", () => {
      const { h, pasteOver } = createPasteOverLevel();
      movePlayerTo(h, 450); // capture bouncy
      movePlayerTo(h, 750); // stand on normal target
      expect(pasteOver.activate()).toBe(true);
    });

    it("activation changes platform surfaceType", () => {
      const { h, pasteOver } = createPasteOverLevel();
      movePlayerTo(h, 450);
      movePlayerTo(h, 750);
      const platform = pasteOver.targetPlatform!;
      expect(platform.surfaceType).toBeUndefined();
      pasteOver.activate();
      expect(platform.surfaceType).toBe("bouncy");
    });

    it("activation sets isPastedOver", () => {
      const { h, pasteOver } = createPasteOverLevel();
      movePlayerTo(h, 450);
      movePlayerTo(h, 750);
      const platform = pasteOver.targetPlatform!;
      pasteOver.activate();
      expect(platform.isPastedOver).toBe(true);
    });

    it("activation preserves originalSurfaceType", () => {
      const { h, pasteOver } = createPasteOverLevel();
      movePlayerTo(h, 450);
      movePlayerTo(h, 750);
      const platform = pasteOver.targetPlatform!;
      pasteOver.activate();
      // Original surface was undefined (normal)
      expect(platform.originalSurfaceType).toBeUndefined();
    });

    it("activation adds to activePastes", () => {
      const { h, pasteOver } = createPasteOverLevel();
      movePlayerTo(h, 450);
      movePlayerTo(h, 750);
      pasteOver.activate();
      expect(pasteOver.activePastes.length).toBe(1);
    });

    it("cannot activate without clipboard", () => {
      const { h, pasteOver } = createPasteOverLevel();
      // Stay on normal floor, clipboard is null
      h.tickN(5);
      expect(pasteOver.clipboard).toBeNull();
      expect(pasteOver.canActivate).toBe(false);
      expect(pasteOver.activate()).toBe(false);
    });

    it("cannot activate when airborne", () => {
      const { h, pasteOver } = createPasteOverLevel();
      movePlayerTo(h, 450); // capture bouncy
      // Jump
      h.pressJump();
      h.tick();
      h.releaseJump();
      h.tickN(5);
      expect(h.grounded).toBe(false);
      expect(pasteOver.canActivate).toBe(false);
    });

    it("cannot activate during cooldown", () => {
      const { h, pasteOver } = createPasteOverLevel();
      movePlayerTo(h, 450); // capture bouncy
      movePlayerTo(h, 750); // stand on target
      pasteOver.activate();
      // Let it expire (8.0s duration + a tiny margin)
      h.tickSeconds(DEFAULT_PASTE_OVER_PARAMS.pasteDuration + 0.1);
      // Cooldown should be active
      expect(pasteOver.cooldownTimer).toBeGreaterThan(0);
      expect(pasteOver.canActivate).toBe(false);
    });

    it("canActivate reflects all conditions", () => {
      const { h, pasteOver } = createPasteOverLevel();

      // No clipboard, no target → false
      expect(pasteOver.canActivate).toBe(false);

      // Capture bouncy → still no target on this platform (clipboard set, but on bouncy)
      movePlayerTo(h, 450);
      // Standing on bouncy with bouncy clipboard — target is the bouncy platform itself
      // canActivate should be true if target is found
      const hasTarget = pasteOver.targetPlatform !== null;
      expect(pasteOver.canActivate).toBe(hasTarget);

      // Move to target and verify true
      movePlayerTo(h, 750);
      expect(pasteOver.canActivate).toBe(true);

      // Disable → false
      pasteOver.params.enabled = false;
      expect(pasteOver.canActivate).toBe(false);
      pasteOver.params.enabled = true;
      expect(pasteOver.canActivate).toBe(true);
    });
  });

  // ── Group 4: Duration & Expiration ─────────────────────────

  describe("duration and expiration", () => {
    it("paste lasts for duration", () => {
      const { h, pasteOver } = createPasteOverLevel();
      movePlayerTo(h, 450);
      movePlayerTo(h, 750);
      pasteOver.activate();

      // Tick just under the duration
      h.tickSeconds(DEFAULT_PASTE_OVER_PARAMS.pasteDuration - 0.2);
      expect(pasteOver.activePastes.length).toBe(1);
      expect(pasteOver.activePastes[0].remainingTime).toBeGreaterThan(0);
    });

    it("paste expires after duration", () => {
      const { h, pasteOver } = createPasteOverLevel();
      movePlayerTo(h, 450);
      movePlayerTo(h, 750);
      pasteOver.activate();

      h.tickSeconds(DEFAULT_PASTE_OVER_PARAMS.pasteDuration + 0.1);
      expect(pasteOver.activePastes.length).toBe(0);
    });

    it("surface restored on expiration", () => {
      const { h, pasteOver } = createPasteOverLevel();
      movePlayerTo(h, 450);
      movePlayerTo(h, 750);
      const platform = pasteOver.targetPlatform!;
      pasteOver.activate();
      expect(platform.surfaceType).toBe("bouncy");

      h.tickSeconds(DEFAULT_PASTE_OVER_PARAMS.pasteDuration + 0.1);
      // Original surface was undefined (normal)
      expect(platform.surfaceType).toBeUndefined();
    });

    it("isPastedOver cleared on expiration", () => {
      const { h, pasteOver } = createPasteOverLevel();
      movePlayerTo(h, 450);
      movePlayerTo(h, 750);
      const platform = pasteOver.targetPlatform!;
      pasteOver.activate();

      h.tickSeconds(DEFAULT_PASTE_OVER_PARAMS.pasteDuration + 0.1);
      expect(platform.isPastedOver).toBe(false);
    });

    it("originalSurfaceType cleared on expiration", () => {
      const { h, pasteOver } = createPasteOverLevel();
      movePlayerTo(h, 450);
      movePlayerTo(h, 750);
      const platform = pasteOver.targetPlatform!;
      pasteOver.activate();

      h.tickSeconds(DEFAULT_PASTE_OVER_PARAMS.pasteDuration + 0.1);
      expect(platform.originalSurfaceType).toBeUndefined();
    });

    it("remainingTime decreases over time", () => {
      const { h, pasteOver } = createPasteOverLevel();
      movePlayerTo(h, 450);
      movePlayerTo(h, 750);
      pasteOver.activate();

      const initialRemaining = pasteOver.activePastes[0].remainingTime;
      h.tickN(60); // 1 second
      expect(pasteOver.activePastes[0].remainingTime).toBeLessThan(initialRemaining);
    });
  });

  // ── Group 5: Cooldown ──────────────────────────────────────

  describe("cooldown", () => {
    it("cooldown starts on paste expiration", () => {
      const { h, pasteOver } = createPasteOverLevel();
      movePlayerTo(h, 450);
      movePlayerTo(h, 750);
      pasteOver.activate();

      // Let it expire
      h.tickSeconds(DEFAULT_PASTE_OVER_PARAMS.pasteDuration + 0.05);
      expect(pasteOver.cooldownTimer).toBeGreaterThan(0);
      expect(pasteOver.cooldownTimer).toBeLessThanOrEqual(DEFAULT_PASTE_OVER_PARAMS.pasteCooldown);
    });

    it("cooldown prevents activation", () => {
      const { h, pasteOver } = createPasteOverLevel();
      movePlayerTo(h, 450);
      movePlayerTo(h, 750);
      pasteOver.activate();

      h.tickSeconds(DEFAULT_PASTE_OVER_PARAMS.pasteDuration + 0.05);
      expect(pasteOver.cooldownTimer).toBeGreaterThan(0);
      // Re-acquire target
      movePlayerTo(h, 750);
      expect(pasteOver.canActivate).toBe(false);
    });

    it("cooldown expires and allows reactivation", () => {
      const { h, pasteOver } = createPasteOverLevel();
      movePlayerTo(h, 450);
      movePlayerTo(h, 750);
      pasteOver.activate();

      // Wait for paste to expire + cooldown
      h.tickSeconds(
        DEFAULT_PASTE_OVER_PARAMS.pasteDuration +
        DEFAULT_PASTE_OVER_PARAMS.pasteCooldown +
        0.2,
      );
      expect(pasteOver.cooldownTimer).toBeLessThanOrEqual(0);
      // Re-acquire target
      movePlayerTo(h, 750);
      expect(pasteOver.canActivate).toBe(true);
    });

    it("cooldown does NOT start on activation", () => {
      const { h, pasteOver } = createPasteOverLevel();
      movePlayerTo(h, 450);
      movePlayerTo(h, 750);
      pasteOver.activate();

      // Right after activation, cooldown should be 0
      expect(pasteOver.cooldownTimer).toBe(0);
    });
  });

  // ── Group 6: Max Active Pastes ─────────────────────────────

  describe("max active pastes", () => {
    function createMultiPlatformLevel() {
      const h = new GameTestHarness({
        platforms: [
          // Bouncy capture platform
          { x: 0, y: 300, width: 200, height: 32, surfaceType: "bouncy" as SurfaceType },
          // 4 normal target platforms
          { x: 300, y: 300, width: 200, height: 32 },
          { x: 600, y: 300, width: 200, height: 32 },
          { x: 900, y: 300, width: 200, height: 32 },
          { x: 1200, y: 300, width: 200, height: 32 },
        ],
        worldWidth: 1600,
      });
      h.setPlayerPosition(50, 300 - PH);
      h.tickUntil(() => h.grounded, 60);
      const pasteOver = h.enablePasteOver();
      // Capture bouncy
      movePlayerTo(h, 50);
      expect(pasteOver.clipboard).toBe("bouncy");
      return { h, pasteOver };
    }

    it("can activate up to maxActivePastes", () => {
      const { h, pasteOver } = createMultiPlatformLevel();

      movePlayerTo(h, 350);
      expect(pasteOver.activate()).toBe(true);

      movePlayerTo(h, 650);
      expect(pasteOver.activate()).toBe(true);

      movePlayerTo(h, 950);
      expect(pasteOver.activate()).toBe(true);

      expect(pasteOver.activePastes.length).toBe(DEFAULT_PASTE_OVER_PARAMS.maxActivePastes);
    });

    it("cannot exceed max", () => {
      const { h, pasteOver } = createMultiPlatformLevel();

      movePlayerTo(h, 350);
      pasteOver.activate();
      movePlayerTo(h, 650);
      pasteOver.activate();
      movePlayerTo(h, 950);
      pasteOver.activate();

      // Try a 4th
      movePlayerTo(h, 1250);
      expect(pasteOver.canActivate).toBe(false);
      expect(pasteOver.activate()).toBe(false);
      expect(pasteOver.activePastes.length).toBe(DEFAULT_PASTE_OVER_PARAMS.maxActivePastes);
    });

    it("freeing a slot allows new activation", () => {
      const { h, pasteOver } = createMultiPlatformLevel();

      movePlayerTo(h, 350);
      pasteOver.activate();
      movePlayerTo(h, 650);
      pasteOver.activate();
      movePlayerTo(h, 950);
      pasteOver.activate();

      // Let the first paste expire
      h.tickSeconds(DEFAULT_PASTE_OVER_PARAMS.pasteDuration + 0.1);
      expect(pasteOver.activePastes.length).toBe(0); // all 3 expire at once since activated close together

      // Wait for cooldown too
      h.tickSeconds(DEFAULT_PASTE_OVER_PARAMS.pasteCooldown + 0.1);

      // Now we should be able to activate again
      movePlayerTo(h, 1250);
      expect(pasteOver.canActivate).toBe(true);
      expect(pasteOver.activate()).toBe(true);
    });
  });

  // ── Group 7: Replacement Behavior ──────────────────────────

  describe("replacement behavior", () => {
    it("pasting same platform replaces existing paste", () => {
      const { h, pasteOver } = createPasteOverLevel();
      movePlayerTo(h, 450); // capture bouncy
      movePlayerTo(h, 750); // target
      pasteOver.activate();
      expect(pasteOver.activePastes.length).toBe(1);

      // Re-paste the same platform
      movePlayerTo(h, 750);
      pasteOver.activate();
      expect(pasteOver.activePastes.length).toBe(1);
    });

    it("replacement refreshes duration", () => {
      const { h, pasteOver } = createPasteOverLevel();
      movePlayerTo(h, 450);
      movePlayerTo(h, 750);
      pasteOver.activate();

      // Wait a bit
      h.tickSeconds(3.0);
      const remainingBefore = pasteOver.activePastes[0].remainingTime;
      expect(remainingBefore).toBeLessThan(DEFAULT_PASTE_OVER_PARAMS.pasteDuration);

      // Re-paste
      movePlayerTo(h, 750);
      pasteOver.activate();
      expect(pasteOver.activePastes[0].remainingTime).toBeCloseTo(
        DEFAULT_PASTE_OVER_PARAMS.pasteDuration,
        0,
      );
    });

    it("replacement does NOT count toward max", () => {
      const h = new GameTestHarness({
        platforms: [
          { x: 0, y: 300, width: 200, height: 32, surfaceType: "bouncy" as SurfaceType },
          { x: 300, y: 300, width: 200, height: 32 },
          { x: 600, y: 300, width: 200, height: 32 },
          { x: 900, y: 300, width: 200, height: 32 },
        ],
        worldWidth: 1200,
      });
      h.setPlayerPosition(50, 300 - PH);
      h.tickUntil(() => h.grounded, 60);
      const pasteOver = h.enablePasteOver();
      movePlayerTo(h, 50); // capture bouncy

      // Fill 2 slots
      movePlayerTo(h, 350);
      pasteOver.activate();
      movePlayerTo(h, 650);
      pasteOver.activate();
      expect(pasteOver.activePastes.length).toBe(2);

      // Re-paste an already-pasted platform — removes old, adds new = still 2
      movePlayerTo(h, 350);
      expect(pasteOver.canActivate).toBe(true);
      pasteOver.activate();
      expect(pasteOver.activePastes.length).toBe(2);

      // Can still fill the 3rd slot since re-paste didn't increase count
      movePlayerTo(h, 950);
      expect(pasteOver.canActivate).toBe(true);
      pasteOver.activate();
      expect(pasteOver.activePastes.length).toBe(3);
    });

    it("re-pasting at max capacity succeeds (replacement, not new)", () => {
      const h = new GameTestHarness({
        platforms: [
          { x: 0, y: 300, width: 200, height: 32, surfaceType: "bouncy" as SurfaceType },
          { x: 300, y: 300, width: 200, height: 32 },
          { x: 600, y: 300, width: 200, height: 32 },
          { x: 900, y: 300, width: 200, height: 32 },
        ],
        worldWidth: 1200,
      });
      h.setPlayerPosition(50, 300 - PH);
      h.tickUntil(() => h.grounded, 60);
      const pasteOver = h.enablePasteOver();
      movePlayerTo(h, 50); // capture bouncy

      // Fill all 3 slots
      movePlayerTo(h, 350);
      pasteOver.activate();
      movePlayerTo(h, 650);
      pasteOver.activate();
      movePlayerTo(h, 950);
      pasteOver.activate();
      expect(pasteOver.activePastes.length).toBe(DEFAULT_PASTE_OVER_PARAMS.maxActivePastes);

      // Re-paste platform at x=350 — should succeed even at max capacity
      movePlayerTo(h, 350);
      expect(pasteOver.activate()).toBe(true);
      expect(pasteOver.activePastes.length).toBe(DEFAULT_PASTE_OVER_PARAMS.maxActivePastes);
    });
  });

  // ── Group 8: Behavioral Integration ────────────────────────

  describe("behavioral integration", () => {
    it("pasted bouncy surface makes player bounce", () => {
      const h = new GameTestHarness({
        platforms: [
          { x: 0, y: 300, width: 200, height: 32, surfaceType: "bouncy" as SurfaceType },
          { x: 400, y: 400, width: 200, height: 32 },
        ],
      });
      h.setPlayerPosition(50, 300 - PH);
      h.tickUntil(() => h.grounded, 60);
      const pasteOver = h.enablePasteOver();

      // Capture bouncy
      movePlayerTo(h, 50);
      expect(pasteOver.clipboard).toBe("bouncy");

      // Paste onto the normal platform at y=400
      movePlayerTo(h, 450, 400);
      pasteOver.activate();
      expect(pasteOver.targetPlatform?.surfaceType).toBe("bouncy");

      // Drop the player from above to get significant fall velocity
      h.setPlayerPosition(450, 200);
      // The bounce sets grounded=false and transitions to JUMPING in the same tick
      // as landing. So we watch for the JUMPING state appearing during the fall.
      let bounced = false;
      for (let i = 0; i < 120; i++) {
        h.tick();
        // Once the player has started falling (was FALLING) and then enters JUMPING,
        // that's a bounce.
        if (h.state === "JUMPING" && h.vel.y < 0 && i > 5) {
          bounced = true;
          break;
        }
      }
      expect(bounced).toBe(true);
    });

    it("surface reverts to normal after expiry — no bounce", () => {
      const h = new GameTestHarness({
        platforms: [
          { x: 0, y: 300, width: 200, height: 32, surfaceType: "bouncy" as SurfaceType },
          { x: 400, y: 400, width: 200, height: 32 },
        ],
      });
      h.setPlayerPosition(50, 300 - PH);
      h.tickUntil(() => h.grounded, 60);
      const pasteOver = h.enablePasteOver();

      movePlayerTo(h, 50); // capture bouncy
      movePlayerTo(h, 450, 400); // paste on target
      pasteOver.activate();

      // Let paste expire
      h.tickSeconds(DEFAULT_PASTE_OVER_PARAMS.pasteDuration + 0.1);
      // Wait for cooldown too
      h.tickSeconds(DEFAULT_PASTE_OVER_PARAMS.pasteCooldown + 0.1);

      // Drop player onto the same platform from above
      h.setPlayerPosition(450, 200);
      h.tickUntil(() => h.grounded, 120);
      h.tick();
      // Should NOT bounce — surface reverted to normal
      expect(h.vel.y).toBeGreaterThanOrEqual(0);
    });

    it("pasted icy surface affects friction", () => {
      // Compare deceleration on normal vs pasted-icy platform
      // Normal surface first
      const hNormal = new GameTestHarness({
        platforms: [{ x: 0, y: 300, width: 2000, height: 32 }],
        worldWidth: 3000,
      });
      hNormal.setPlayerPosition(100, 300 - PH);
      hNormal.tickUntil(() => hNormal.grounded, 60);
      hNormal.pressRight();
      hNormal.tickN(60);
      hNormal.releaseAll();
      const normalDecelFrames = hNormal.tickWhile(() => hNormal.horizontalSpeed > 1, 300);

      // Icy-pasted surface
      const h = new GameTestHarness({
        platforms: [
          { x: 0, y: 300, width: 200, height: 32, surfaceType: "icy" as SurfaceType },
          { x: 200, y: 300, width: 2000, height: 32 },
        ],
        worldWidth: 3000,
      });
      h.setPlayerPosition(50, 300 - PH);
      h.tickUntil(() => h.grounded, 60);
      const pasteOver = h.enablePasteOver();

      // Capture icy
      movePlayerTo(h, 50);
      expect(pasteOver.clipboard).toBe("icy");

      // Paste on the long normal platform
      movePlayerTo(h, 300);
      pasteOver.activate();

      // Run right and build speed (staying on the pasted platform)
      h.pressRight();
      h.tickN(60);
      h.releaseAll();
      // Icy friction is 0.08x normal — deceleration should take much longer
      const icyDecelFrames = h.tickWhile(() => h.horizontalSpeed > 1, 3000);

      expect(icyDecelFrames).toBeGreaterThan(normalDecelFrames);
      expect(icyDecelFrames).toBeGreaterThan(normalDecelFrames * 3);
    });
  });

  // ── Group 9: Edge Cases ────────────────────────────────────

  describe("edge cases", () => {
    it("disabled ability cannot activate", () => {
      const { h, pasteOver } = createPasteOverLevel();
      movePlayerTo(h, 450); // capture bouncy
      pasteOver.params.enabled = false;
      movePlayerTo(h, 750);
      // scanForTarget returns early when disabled
      h.tickN(3);
      expect(pasteOver.canActivate).toBe(false);
      expect(pasteOver.activate()).toBe(false);
    });

    it("clearAllPastes restores all surfaces", () => {
      const h = new GameTestHarness({
        platforms: [
          { x: 0, y: 300, width: 200, height: 32, surfaceType: "bouncy" as SurfaceType },
          { x: 300, y: 300, width: 200, height: 32 },
          { x: 600, y: 300, width: 200, height: 32 },
        ],
        worldWidth: 1000,
      });
      h.setPlayerPosition(50, 300 - PH);
      h.tickUntil(() => h.grounded, 60);
      const pasteOver = h.enablePasteOver();

      // Capture bouncy
      movePlayerTo(h, 50);

      // Paste on two platforms
      movePlayerTo(h, 350);
      const platform1 = pasteOver.targetPlatform!;
      pasteOver.activate();

      movePlayerTo(h, 650);
      const platform2 = pasteOver.targetPlatform!;
      pasteOver.activate();

      expect(pasteOver.activePastes.length).toBe(2);
      expect(platform1.surfaceType).toBe("bouncy");
      expect(platform2.surfaceType).toBe("bouncy");

      // Clear all
      pasteOver.clearAllPastes();
      expect(pasteOver.activePastes.length).toBe(0);
      expect(platform1.surfaceType).toBeUndefined();
      expect(platform2.surfaceType).toBeUndefined();
      expect(platform1.isPastedOver).toBe(false);
      expect(platform2.isPastedOver).toBe(false);
    });
  });
});
