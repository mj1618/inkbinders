import { describe, it, expect } from "vitest";
import { SaveSystem } from "@/engine/save/SaveSystem";
import type { GameSaveData, SaveSlotSummary } from "@/engine/save/SaveSystem";
import { PlayerProgression } from "@/engine/world/PlayerProgression";

// ── Helpers ────────────────────────────────────────────────────────

/** Minimal valid input for createSnapshot */
function minimalSnapshotInput(overrides?: Partial<Parameters<typeof SaveSystem.createSnapshot>[0]>) {
  return {
    slot: 1,
    playerName: "Archivist",
    totalPlayTime: 120,
    currentRoomId: "scribe-hall",
    currentRoomName: "Scribe Hall",
    deathCount: 0,
    unlockedAbilities: [] as string[],
    openedGates: [] as string[],
    defeatedBosses: [] as string[],
    visitedRooms: [] as string[],
    currentHealth: 5,
    maxHealth: 5,
    ownedCards: [] as string[],
    equippedCards: [] as string[],
    ...overrides,
  };
}

// ── SaveSystem.createSnapshot ──────────────────────────────────────

describe("SaveSystem.createSnapshot", () => {
  it("1. creates valid GameSaveData", () => {
    const result = SaveSystem.createSnapshot(minimalSnapshotInput());
    expect(result).toHaveProperty("slot");
    expect(result).toHaveProperty("playerName");
    expect(result).toHaveProperty("totalPlayTime");
    expect(result).toHaveProperty("currentRoomId");
    expect(result).toHaveProperty("currentRoomName");
    expect(result).toHaveProperty("completionPercent");
    expect(result).toHaveProperty("deathCount");
    expect(result).toHaveProperty("unlockedAbilities");
    expect(result).toHaveProperty("openedGates");
    expect(result).toHaveProperty("defeatedBosses");
    expect(result).toHaveProperty("visitedRooms");
    expect(result).toHaveProperty("currentHealth");
    expect(result).toHaveProperty("maxHealth");
    expect(result).toHaveProperty("ownedCards");
    expect(result).toHaveProperty("equippedCards");
  });

  it("2. empty game is 0% completion", () => {
    const result = SaveSystem.createSnapshot(minimalSnapshotInput());
    expect(result.completionPercent).toBe(0);
  });

  it("3. all abilities unlocked = 30% completion", () => {
    const result = SaveSystem.createSnapshot(
      minimalSnapshotInput({
        unlockedAbilities: ["margin-stitch", "redaction", "paste-over", "index-mark"],
      })
    );
    expect(result.completionPercent).toBe(30);
  });

  it("4. all bosses defeated = 40% completion", () => {
    const result = SaveSystem.createSnapshot(
      minimalSnapshotInput({
        defeatedBosses: ["footnote-giant", "misprint-seraph", "index-eater", "herbarium-heart"],
      })
    );
    expect(result.completionPercent).toBe(40);
  });

  it("5. 90 rooms visited = 30% completion", () => {
    const rooms = Array.from({ length: 90 }, (_, i) => `room-${i}`);
    const result = SaveSystem.createSnapshot(minimalSnapshotInput({ visitedRooms: rooms }));
    expect(result.completionPercent).toBe(30);
  });

  it("6. full game = 100% completion", () => {
    const result = SaveSystem.createSnapshot(
      minimalSnapshotInput({
        unlockedAbilities: ["margin-stitch", "redaction", "paste-over", "index-mark"],
        defeatedBosses: ["footnote-giant", "misprint-seraph", "index-eater", "herbarium-heart"],
        visitedRooms: Array.from({ length: 90 }, (_, i) => `room-${i}`),
      })
    );
    expect(result.completionPercent).toBe(100);
  });

  it("7. partial game computes correctly", () => {
    // 2 abilities (15%) + 1 boss (10%) + 30 rooms (10%) = 35%
    const result = SaveSystem.createSnapshot(
      minimalSnapshotInput({
        unlockedAbilities: ["margin-stitch", "redaction"],
        defeatedBosses: ["footnote-giant"],
        visitedRooms: Array.from({ length: 30 }, (_, i) => `room-${i}`),
      })
    );
    expect(result.completionPercent).toBe(35);
  });

  it("8. rooms capped at 90 for calculation", () => {
    const result = SaveSystem.createSnapshot(
      minimalSnapshotInput({
        visitedRooms: Array.from({ length: 100 }, (_, i) => `room-${i}`),
      })
    );
    // rooms contribution capped at 30%, so should not exceed 30
    expect(result.completionPercent).toBe(30);
  });

  it("9. snapshot preserves input data", () => {
    const input = minimalSnapshotInput({
      slot: 3,
      playerName: "TestPlayer",
      totalPlayTime: 999,
      currentRoomId: "vine-vestibule",
      currentRoomName: "Vine Vestibule",
      deathCount: 42,
      currentHealth: 3,
      maxHealth: 7,
      ownedCards: ["card-a", "card-b"],
      equippedCards: ["card-a"],
    });
    const result = SaveSystem.createSnapshot(input);
    expect(result.slot).toBe(3);
    expect(result.playerName).toBe("TestPlayer");
    expect(result.totalPlayTime).toBe(999);
    expect(result.currentRoomId).toBe("vine-vestibule");
    expect(result.currentRoomName).toBe("Vine Vestibule");
    expect(result.deathCount).toBe(42);
    expect(result.currentHealth).toBe(3);
    expect(result.maxHealth).toBe(7);
    expect(result.ownedCards).toEqual(["card-a", "card-b"]);
    expect(result.equippedCards).toEqual(["card-a"]);
  });
});

// ── SaveSystem.formatPlayTime ──────────────────────────────────────

describe("SaveSystem.formatPlayTime", () => {
  it("10. zero seconds", () => {
    expect(SaveSystem.formatPlayTime(0)).toBe("0:00");
  });

  it("11. under a minute", () => {
    expect(SaveSystem.formatPlayTime(45)).toBe("0:45");
  });

  it("12. exactly one minute", () => {
    expect(SaveSystem.formatPlayTime(60)).toBe("1:00");
  });

  it("13. minutes and seconds", () => {
    expect(SaveSystem.formatPlayTime(65)).toBe("1:05");
  });

  it("14. many minutes", () => {
    expect(SaveSystem.formatPlayTime(599)).toBe("9:59");
  });

  it("15. exactly one hour", () => {
    expect(SaveSystem.formatPlayTime(3600)).toBe("1:00:00");
  });

  it("16. hours, minutes, seconds", () => {
    expect(SaveSystem.formatPlayTime(3665)).toBe("1:01:05");
  });

  it("17. large value", () => {
    expect(SaveSystem.formatPlayTime(7384)).toBe("2:03:04");
  });

  it("18. seconds always two digits", () => {
    expect(SaveSystem.formatPlayTime(61)).toBe("1:01");
  });

  it("19. minutes padded in hour format", () => {
    expect(SaveSystem.formatPlayTime(3661)).toBe("1:01:01");
  });
});

// ── SaveSystem.emptySummary ────────────────────────────────────────

describe("SaveSystem.emptySummary", () => {
  it("20. isEmpty is true", () => {
    expect(SaveSystem.emptySummary(1).isEmpty).toBe(true);
  });

  it("21. slot number matches", () => {
    expect(SaveSystem.emptySummary(2).slot).toBe(2);
  });

  it("22. zero values", () => {
    const summary = SaveSystem.emptySummary(1);
    expect(summary.totalPlayTime).toBe(0);
    expect(summary.deathCount).toBe(0);
    expect(summary.completionPercent).toBe(0);
  });

  it("23. empty string fields", () => {
    const summary = SaveSystem.emptySummary(1);
    expect(summary.playerName).toBe("");
  });
});

// ── SaveSystem.formatRelativeTime ──────────────────────────────────

describe("SaveSystem.formatRelativeTime", () => {
  it("24. empty string returns empty", () => {
    expect(SaveSystem.formatRelativeTime("")).toBe("");
  });

  it("25. recent time shows 'just now'", () => {
    expect(SaveSystem.formatRelativeTime(new Date().toISOString())).toBe("just now");
  });

  it("26. minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(SaveSystem.formatRelativeTime(fiveMinAgo)).toContain("min ago");
  });

  it("27. hours ago", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    expect(SaveSystem.formatRelativeTime(twoHoursAgo)).toContain("hour");
  });

  it("28. days ago", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400 * 1000).toISOString();
    expect(SaveSystem.formatRelativeTime(threeDaysAgo)).toContain("day");
  });
});

// ── PlayerProgression — tracking ───────────────────────────────────

describe("PlayerProgression — tracking", () => {
  it("29. constructor defaults", () => {
    const prog = new PlayerProgression("tutorial-corridor");
    expect(prog.data.currentRoomId).toBe("tutorial-corridor");
    expect(prog.data.maxHealth).toBe(5);
    expect(prog.data.currentHealth).toBe(5);
    expect(prog.data.unlockedAbilities.size).toBe(0);
    expect(prog.data.openedGates.size).toBe(0);
    expect(prog.data.defeatedBosses.size).toBe(0);
    expect(prog.data.visitedRooms.size).toBe(0);
    expect(prog.data.totalPlayTime).toBe(0);
    expect(prog.data.deathCount).toBe(0);
  });

  it("30. unlockAbility and hasAbility", () => {
    const prog = new PlayerProgression("tutorial-corridor");
    prog.unlockAbility("margin-stitch");
    expect(prog.hasAbility("margin-stitch")).toBe(true);
    expect(prog.hasAbility("redaction")).toBe(false);
  });

  it("31. unlockAllAbilities", () => {
    const prog = new PlayerProgression("tutorial-corridor");
    prog.unlockAllAbilities();
    expect(prog.hasAbility("margin-stitch")).toBe(true);
    expect(prog.hasAbility("redaction")).toBe(true);
    expect(prog.hasAbility("paste-over")).toBe(true);
    expect(prog.hasAbility("index-mark")).toBe(true);
  });

  it("32. openGate and isGateOpened", () => {
    const prog = new PlayerProgression("tutorial-corridor");
    prog.openGate("gate-1");
    expect(prog.isGateOpened("gate-1")).toBe(true);
    expect(prog.isGateOpened("gate-2")).toBe(false);
  });

  it("33. defeatBoss and isBossDefeated", () => {
    const prog = new PlayerProgression("tutorial-corridor");
    prog.defeatBoss("footnote-giant");
    expect(prog.isBossDefeated("footnote-giant")).toBe(true);
    expect(prog.isBossDefeated("misprint-seraph")).toBe(false);
  });

  it("34. visitRoom and isRoomVisited", () => {
    const prog = new PlayerProgression("tutorial-corridor");
    prog.visitRoom("vine-vestibule");
    expect(prog.isRoomVisited("vine-vestibule")).toBe(true);
    expect(prog.isRoomVisited("root-cellar")).toBe(false);
  });

  it("35. recordDeath increments count", () => {
    const prog = new PlayerProgression("tutorial-corridor");
    expect(prog.data.deathCount).toBe(0);
    prog.recordDeath();
    expect(prog.data.deathCount).toBe(1);
    prog.recordDeath();
    expect(prog.data.deathCount).toBe(2);
  });

  it("36. updatePlayTime accumulates", () => {
    const prog = new PlayerProgression("tutorial-corridor");
    prog.updatePlayTime(10);
    expect(prog.data.totalPlayTime).toBe(10);
    prog.updatePlayTime(5);
    expect(prog.data.totalPlayTime).toBe(15);
  });
});

// ── PlayerProgression — serialization round-trip ───────────────────

describe("PlayerProgression — serialization round-trip", () => {
  it("37. serialize produces plain object", () => {
    const prog = new PlayerProgression("tutorial-corridor");
    prog.unlockAbility("margin-stitch");
    const serialized = prog.serialize();

    // Should be a plain object, not a class instance
    expect(typeof serialized).toBe("object");
    // Abilities should be an array, not a Set
    expect(Array.isArray(serialized.unlockedAbilities)).toBe(true);
    expect(Array.isArray(serialized.openedGates)).toBe(true);
    expect(Array.isArray(serialized.defeatedBosses)).toBe(true);
    expect(Array.isArray(serialized.visitedRooms)).toBe(true);
  });

  it("38. deserialize restores state", () => {
    const prog = new PlayerProgression("vine-vestibule", 7);
    prog.unlockAbility("margin-stitch");
    prog.unlockAbility("redaction");
    prog.openGate("gate-1");
    prog.openGate("gate-2");
    prog.defeatBoss("footnote-giant");
    prog.visitRoom("vine-vestibule");
    prog.visitRoom("root-cellar");
    prog.recordDeath();
    prog.recordDeath();
    prog.updatePlayTime(300);
    prog.data.currentHealth = 4;

    const serialized = prog.serialize();
    const restored = PlayerProgression.deserialize(serialized);

    expect(restored.data.currentRoomId).toBe("vine-vestibule");
    expect(restored.data.maxHealth).toBe(7);
    expect(restored.data.currentHealth).toBe(4);
    expect(restored.data.totalPlayTime).toBe(300);
    expect(restored.data.deathCount).toBe(2);
    expect(restored.hasAbility("margin-stitch")).toBe(true);
    expect(restored.hasAbility("redaction")).toBe(true);
    expect(restored.isGateOpened("gate-1")).toBe(true);
    expect(restored.isGateOpened("gate-2")).toBe(true);
    expect(restored.isBossDefeated("footnote-giant")).toBe(true);
    expect(restored.isRoomVisited("vine-vestibule")).toBe(true);
    expect(restored.isRoomVisited("root-cellar")).toBe(true);
  });

  it("39. round-trip preserves abilities", () => {
    const prog = new PlayerProgression("tutorial-corridor");
    prog.unlockAbility("paste-over");
    prog.unlockAbility("index-mark");

    const restored = PlayerProgression.deserialize(prog.serialize());
    expect(restored.hasAbility("paste-over")).toBe(true);
    expect(restored.hasAbility("index-mark")).toBe(true);
    expect(restored.hasAbility("margin-stitch")).toBe(false);
  });

  it("40. round-trip preserves gates", () => {
    const prog = new PlayerProgression("tutorial-corridor");
    prog.openGate("gate-a");
    prog.openGate("gate-b");
    prog.openGate("gate-c");

    const restored = PlayerProgression.deserialize(prog.serialize());
    expect(restored.isGateOpened("gate-a")).toBe(true);
    expect(restored.isGateOpened("gate-b")).toBe(true);
    expect(restored.isGateOpened("gate-c")).toBe(true);
    expect(restored.isGateOpened("gate-d")).toBe(false);
  });

  it("41. round-trip preserves bosses", () => {
    const prog = new PlayerProgression("tutorial-corridor");
    prog.defeatBoss("footnote-giant");
    prog.defeatBoss("misprint-seraph");

    const restored = PlayerProgression.deserialize(prog.serialize());
    expect(restored.isBossDefeated("footnote-giant")).toBe(true);
    expect(restored.isBossDefeated("misprint-seraph")).toBe(true);
    expect(restored.isBossDefeated("index-eater")).toBe(false);
  });

  it("42. round-trip preserves numeric fields", () => {
    const prog = new PlayerProgression("tutorial-corridor", 8);
    prog.data.currentHealth = 3;
    prog.updatePlayTime(600);
    prog.recordDeath();
    prog.recordDeath();
    prog.recordDeath();

    const restored = PlayerProgression.deserialize(prog.serialize());
    expect(restored.data.maxHealth).toBe(8);
    expect(restored.data.currentHealth).toBe(3);
    expect(restored.data.totalPlayTime).toBe(600);
    expect(restored.data.deathCount).toBe(3);
  });

  it("43. deserialize with empty object uses defaults", () => {
    const restored = PlayerProgression.deserialize({});
    expect(restored.data.currentRoomId).toBe("scribe-hall");
    expect(restored.data.maxHealth).toBe(5);
    expect(restored.data.currentHealth).toBe(5);
    expect(restored.data.totalPlayTime).toBe(0);
    expect(restored.data.deathCount).toBe(0);
    expect(restored.data.unlockedAbilities.size).toBe(0);
    expect(restored.data.openedGates.size).toBe(0);
    expect(restored.data.defeatedBosses.size).toBe(0);
    expect(restored.data.visitedRooms.size).toBe(0);
  });

  it("44. deserialize with partial data fills gaps", () => {
    const restored = PlayerProgression.deserialize({
      currentRoomId: "vine-vestibule",
      deathCount: 7,
    });
    expect(restored.data.currentRoomId).toBe("vine-vestibule");
    expect(restored.data.deathCount).toBe(7);
    // Defaults for everything else
    expect(restored.data.maxHealth).toBe(5);
    expect(restored.data.currentHealth).toBe(5);
    expect(restored.data.totalPlayTime).toBe(0);
    expect(restored.data.unlockedAbilities.size).toBe(0);
  });
});
