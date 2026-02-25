import { describe, it, expect, beforeEach } from "vitest";
import { GameTestHarness } from "../GameTestHarness";
import {
  TUTORIAL_CORRIDOR,
  VERTICAL_SHAFT,
  VINE_GARDEN,
  PRESET_ROOMS,
} from "@/engine/world/presetRooms";
import type { RoomData } from "@/engine/world/Room";

/** Deep-clone a RoomData to avoid cross-test mutation (e.g. gate.opened). */
function cloneRoom(room: RoomData): RoomData {
  return JSON.parse(JSON.stringify(room));
}

/** Deep-clone the preset rooms map. */
function clonePresetRooms(): Record<string, RoomData> {
  return JSON.parse(JSON.stringify(PRESET_ROOMS));
}

describe("Room Loading", () => {
  let h: GameTestHarness;

  beforeEach(() => {
    h = new GameTestHarness();
  });

  it("loads room platforms into TileMap", () => {
    const room = cloneRoom(TUTORIAL_CORRIDOR);
    h.loadRoom(room);

    // Room platforms + 1 gate platform (redaction gate, unopened)
    const expectedCount =
      room.platforms.length + room.gates.filter((g) => !g.opened).length;
    expect(h.tileMap.platforms.length).toBe(expectedCount);
  });

  it("spawns player at defaultSpawn", () => {
    h.loadRoom(cloneRoom(TUTORIAL_CORRIDOR));

    expect(h.pos.x).toBe(TUTORIAL_CORRIDOR.defaultSpawn.x);
    expect(h.pos.y).toBe(TUTORIAL_CORRIDOR.defaultSpawn.y);
  });

  it("sets camera bounds to room dimensions", () => {
    h.loadRoom(cloneRoom(TUTORIAL_CORRIDOR));

    expect(h.camera.bounds!.width).toBe(TUTORIAL_CORRIDOR.width);
    expect(h.camera.bounds!.height).toBe(TUTORIAL_CORRIDOR.height);
  });

  it("preserves surface types on platforms", () => {
    h.loadRoom(cloneRoom(VINE_GARDEN));

    const bouncyPlatforms = h.tileMap.platforms.filter(
      (p) => p.surfaceType === "bouncy",
    );
    const icyPlatforms = h.tileMap.platforms.filter(
      (p) => p.surfaceType === "icy",
    );

    const expectedBouncy = VINE_GARDEN.platforms.filter(
      (p) => p.surfaceType === "bouncy",
    ).length;
    const expectedIcy = VINE_GARDEN.platforms.filter(
      (p) => p.surfaceType === "icy",
    ).length;

    expect(bouncyPlatforms.length).toBe(expectedBouncy);
    expect(icyPlatforms.length).toBe(expectedIcy);
  });

  it("loads obstacles from room data", () => {
    h.loadRoom(cloneRoom(TUTORIAL_CORRIDOR));

    expect(h.obstacles.length).toBe(TUTORIAL_CORRIDOR.obstacles.length);
    expect(h.obstacles[0].id).toBe(TUTORIAL_CORRIDOR.obstacles[0].id);
  });

  it("replaces all data when loading a second room", () => {
    h.loadRoom(cloneRoom(TUTORIAL_CORRIDOR));
    const firstPlatformCount = h.tileMap.platforms.length;
    const firstObstacleCount = h.obstacles.length;

    h.loadRoom(cloneRoom(VERTICAL_SHAFT));

    // Platform count should differ (different room layout)
    const secondPlatformCount = h.tileMap.platforms.length;
    expect(secondPlatformCount).not.toBe(firstPlatformCount);

    // Obstacles should be cleared (Vertical Shaft has no obstacles)
    expect(h.obstacles.length).toBe(VERTICAL_SHAFT.obstacles.length);
    expect(h.obstacles.length).not.toBe(firstObstacleCount);

    // Current room should be updated
    expect(h.currentRoom?.id).toBe("vertical-shaft");
  });
});

describe("Exit Detection", () => {
  let h: GameTestHarness;

  beforeEach(() => {
    h = new GameTestHarness();
    h.enableRoomManager(clonePresetRooms(), "tutorial-corridor");
  });

  it("triggers exit when player overlaps exit zone", () => {
    // Position player inside the left exit zone of Tutorial Corridor
    const leftExit = TUTORIAL_CORRIDOR.exits[0];
    h.setPlayerPosition(leftExit.zone.x, leftExit.zone.y);
    h.tick();

    expect(h.pendingExit).not.toBeNull();
  });

  it("exit targets the correct room", () => {
    // Position player inside the right exit zone
    const rightExit = TUTORIAL_CORRIDOR.exits[1];
    h.setPlayerPosition(rightExit.zone.x, rightExit.zone.y);
    h.tick();

    expect(h.pendingExit).not.toBeNull();
    expect(h.pendingExit!.targetRoomId).toBe(rightExit.targetRoomId);
  });

  it("no exit when player is in center of room", () => {
    h.setPlayerPosition(
      TUTORIAL_CORRIDOR.width / 2,
      TUTORIAL_CORRIDOR.height / 2,
    );
    h.tick();

    expect(h.pendingExit).toBeNull();
  });

  it("exit provides valid spawn point in target room", () => {
    const rightExit = TUTORIAL_CORRIDOR.exits[1];
    h.setPlayerPosition(rightExit.zone.x, rightExit.zone.y);
    h.tick();

    expect(h.pendingExit).not.toBeNull();
    const targetRoom = PRESET_ROOMS[h.pendingExit!.targetRoomId];
    expect(h.pendingExit!.targetSpawnPoint.x).toBeGreaterThanOrEqual(0);
    expect(h.pendingExit!.targetSpawnPoint.x).toBeLessThanOrEqual(
      targetRoom.width,
    );
    expect(h.pendingExit!.targetSpawnPoint.y).toBeGreaterThanOrEqual(0);
    expect(h.pendingExit!.targetSpawnPoint.y).toBeLessThanOrEqual(
      targetRoom.height,
    );
  });

  it("detects different exits independently", () => {
    // Check left exit
    const leftExit = TUTORIAL_CORRIDOR.exits[0];
    h.setPlayerPosition(leftExit.zone.x, leftExit.zone.y);
    h.tick();
    expect(h.pendingExit).not.toBeNull();
    expect(h.pendingExit!.targetRoomId).toBe(leftExit.targetRoomId);

    // Move to center — no exit
    h.setPlayerPosition(
      TUTORIAL_CORRIDOR.width / 2,
      TUTORIAL_CORRIDOR.height / 2,
    );
    h.tick();
    expect(h.pendingExit).toBeNull();

    // Check right exit
    const rightExit = TUTORIAL_CORRIDOR.exits[1];
    h.setPlayerPosition(rightExit.zone.x, rightExit.zone.y);
    h.tick();
    expect(h.pendingExit).not.toBeNull();
    expect(h.pendingExit!.targetRoomId).toBe(rightExit.targetRoomId);
  });
});

describe("Gate Mechanics", () => {
  let h: GameTestHarness;
  let room: RoomData;

  beforeEach(() => {
    h = new GameTestHarness();
    room = cloneRoom(TUTORIAL_CORRIDOR);
    h.loadRoom(room);
  });

  it("gate platform is solid before opening", () => {
    const gate = room.gates[0];

    // Find the gate platform in the TileMap
    const gatePlat = h.tileMap.platforms.find(
      (p) =>
        p.x === gate.rect.x &&
        p.y === gate.rect.y &&
        p.width === gate.rect.width &&
        p.height === gate.rect.height,
    );
    expect(gatePlat).toBeDefined();
  });

  it("opens with the correct ability", () => {
    const gate = room.gates[0];
    expect(gate.requiredAbility).toBe("redaction");

    const result = h.tryOpenGate(gate.id, ["redaction"]);
    expect(result).toBe(true);
  });

  it("does not open with the wrong ability", () => {
    const gate = room.gates[0];
    expect(gate.requiredAbility).toBe("redaction");

    const result = h.tryOpenGate(gate.id, ["margin-stitch"]);
    expect(result).toBe(false);
  });

  it("removes gate platform after opening", () => {
    const gate = room.gates[0];
    const platformCountBefore = h.tileMap.platforms.length;

    h.tryOpenGate(gate.id, ["redaction"]);

    expect(h.tileMap.platforms.length).toBe(platformCountBefore - 1);

    // Gate platform should no longer be in TileMap
    const gatePlat = h.tileMap.platforms.find(
      (p) =>
        p.x === gate.rect.x &&
        p.y === gate.rect.y &&
        p.width === gate.rect.width &&
        p.height === gate.rect.height,
    );
    expect(gatePlat).toBeUndefined();
  });

  it("gate stays open across room transitions", () => {
    const rooms = clonePresetRooms();
    const rm = h.enableRoomManager(rooms, "tutorial-corridor");
    const gate = rm.currentGates[0];

    // Open the gate
    rm.tryOpenGate(gate, new Set(["redaction"] as const));
    expect(gate.opened).toBe(true);

    // Transition to another room and back
    const rightExit = TUTORIAL_CORRIDOR.exits[1];
    h.transitionToRoom(rightExit);
    expect(h.currentRoom?.id).toBe("vertical-shaft");

    // Go back to tutorial corridor
    const returnExit = VERTICAL_SHAFT.exits[0];
    h.transitionToRoom(returnExit);
    expect(h.currentRoom?.id).toBe("tutorial-corridor");

    // Gate should still be open — the RoomManager remembers via openedGates set
    const reloadedGate = rm.currentGates.find((g) => g.id === gate.id);
    expect(reloadedGate?.opened).toBe(true);

    // Gate platform should not be in TileMap
    const gatePlat = h.tileMap.platforms.find(
      (p) =>
        p.x === gate.rect.x &&
        p.y === gate.rect.y &&
        p.width === gate.rect.width &&
        p.height === gate.rect.height,
    );
    expect(gatePlat).toBeUndefined();
  });

  it("already-opened gate returns false from tryOpenGate (no-op)", () => {
    const gate = room.gates[0];

    // Open once
    h.tryOpenGate(gate.id, ["redaction"]);
    // Try again — gate.opened is now true, so harness returns false
    const result = h.tryOpenGate(gate.id, ["redaction"]);
    expect(result).toBe(false);
  });
});

describe("Room Transitions via RoomManager", () => {
  let h: GameTestHarness;

  beforeEach(() => {
    h = new GameTestHarness();
  });

  it("loads starting room on init", () => {
    h.enableRoomManager(clonePresetRooms(), "tutorial-corridor");

    expect(h.currentRoom?.id).toBe("tutorial-corridor");
    expect(h.currentRoom?.name).toBe("Tutorial Corridor");
  });

  it("transitions to target room", () => {
    h.enableRoomManager(clonePresetRooms(), "tutorial-corridor");

    const rightExit = TUTORIAL_CORRIDOR.exits[1];
    h.transitionToRoom(rightExit);

    expect(h.currentRoom?.id).toBe("vertical-shaft");
  });

  it("positions player at exit target spawn", () => {
    h.enableRoomManager(clonePresetRooms(), "tutorial-corridor");

    const rightExit = TUTORIAL_CORRIDOR.exits[1];
    h.transitionToRoom(rightExit);

    expect(h.pos.x).toBe(rightExit.targetSpawnPoint.x);
    expect(h.pos.y).toBe(rightExit.targetSpawnPoint.y);
  });

  it("supports bidirectional transitions", () => {
    h.enableRoomManager(clonePresetRooms(), "tutorial-corridor");
    expect(h.currentRoom?.id).toBe("tutorial-corridor");

    // Go to Vertical Shaft
    const rightExit = TUTORIAL_CORRIDOR.exits[1];
    h.transitionToRoom(rightExit);
    expect(h.currentRoom?.id).toBe("vertical-shaft");

    // Come back to Tutorial Corridor
    const returnExit = VERTICAL_SHAFT.exits[0];
    h.transitionToRoom(returnExit);
    expect(h.currentRoom?.id).toBe("tutorial-corridor");
  });

  it("provides all room IDs via getRoomIds", () => {
    const rm = h.enableRoomManager(clonePresetRooms(), "tutorial-corridor");

    const ids = rm.getRoomIds();
    expect(ids).toContain("tutorial-corridor");
    expect(ids).toContain("vertical-shaft");
    expect(ids).toContain("vine-garden");
    expect(ids.length).toBe(Object.keys(PRESET_ROOMS).length);
  });
});

describe("Vine System Integration", () => {
  let h: GameTestHarness;

  beforeEach(() => {
    h = new GameTestHarness();
  });

  it("loads vine anchors from room data", () => {
    h.loadRoom(VERTICAL_SHAFT);
    const vs = h.enableVineSystem(
      VERTICAL_SHAFT.vineAnchors.map((a) => ({
        id: a.id,
        position: { ...a.position },
        ropeLength: a.ropeLength,
        active: true,
        type: a.type,
      })),
    );

    // Vine system should have the same number of anchors as the room
    expect(VERTICAL_SHAFT.vineAnchors.length).toBeGreaterThan(0);
    // findNearestAnchor should return an anchor when player is close enough
    const anchor = vs.findNearestAnchor(VERTICAL_SHAFT.vineAnchors[0].position);
    expect(anchor).not.toBeNull();
  });

  it("attaches to vine when player is within range", () => {
    h.loadRoom(VERTICAL_SHAFT);
    const anchors = VERTICAL_SHAFT.vineAnchors.map((a) => ({
      id: a.id,
      position: { ...a.position },
      ropeLength: a.ropeLength,
      active: true,
      type: a.type,
    }));
    h.enableVineSystem(anchors);

    // Position player directly at the first vine anchor
    const anchor = VERTICAL_SHAFT.vineAnchors[0];
    h.setPlayerPosition(
      anchor.position.x - h.player.size.x / 2,
      anchor.position.y - h.player.size.y / 2,
    );

    const attached = h.attachVine();
    expect(attached).toBe(true);
    expect(h.vineSwinging).toBe(true);
  });

  it("detaches from vine and restores movement", () => {
    h.loadRoom(VERTICAL_SHAFT);
    const anchors = VERTICAL_SHAFT.vineAnchors.map((a) => ({
      id: a.id,
      position: { ...a.position },
      ropeLength: a.ropeLength,
      active: true,
      type: a.type,
    }));
    h.enableVineSystem(anchors);

    // Attach to vine
    const anchor = VERTICAL_SHAFT.vineAnchors[0];
    h.setPlayerPosition(
      anchor.position.x - h.player.size.x / 2,
      anchor.position.y - h.player.size.y / 2,
    );
    h.setPlayerVelocity(100, 0); // Give horizontal momentum for swing
    h.attachVine();
    expect(h.vineSwinging).toBe(true);

    // Swing for a few frames to build momentum
    h.tickN(10);

    // Detach
    h.detachVine();
    expect(h.vineSwinging).toBe(false);

    // Player should have some velocity from the swing
    const speed = Math.sqrt(h.vel.x ** 2 + h.vel.y ** 2);
    expect(speed).toBeGreaterThan(0);
  });
});
