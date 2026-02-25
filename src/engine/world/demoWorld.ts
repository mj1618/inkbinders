// Demo World — Assembles all rooms and the world graph into a playable demo

import type { RoomData, RoomId } from "./Room";
import { EXIT_ZONE_DEPTH } from "./Room";
import { WorldGraph } from "./WorldGraph";
import type { WorldGraphData } from "./WorldGraph";
import { SCRIBE_HALL } from "./scribeHall";
import { TUTORIAL_CORRIDOR, VERTICAL_SHAFT, VINE_GARDEN } from "./presetRooms";
import { HERBARIUM_WING_ROOMS, HERBARIUM_WING_ROOM_IDS } from "./herbariumRooms";
import { CENTRAL_ARCHIVES_ROOMS, CENTRAL_ARCHIVES_ROOM_IDS } from "./centralArchivesRooms";

const T = 32;

// ─── Archive Passage ─────────────────────────────────────────────────
// Small connecting corridor (960×540) linking Scribe Hall to the Vertical Shaft

export const ARCHIVE_PASSAGE: RoomData = {
  id: "archive-passage",
  name: "Archive Passage",
  width: 960,
  height: 540,
  biomeId: "default",
  defaultSpawn: { x: 64, y: 540 - 64 - T },
  platforms: [
    // Floor
    { x: 0, y: 540 - T, width: 960, height: T },
    // Walls (with gaps for exits)
    { x: 0, y: 0, width: T, height: 540 - 128 },
    { x: 0, y: 540 - 64, width: T, height: 64 },
    { x: 960 - T, y: 0, width: T, height: 540 - 128 },
    { x: 960 - T, y: 540 - 64, width: T, height: 64 },
    // Ceiling
    { x: 0, y: 0, width: 960, height: T },
    // Stepping platforms
    { x: 200, y: 380, width: 128, height: T },
    { x: 500, y: 320, width: 128, height: T },
    { x: 750, y: 400, width: 128, height: T },
  ],
  obstacles: [],
  exits: [
    // Left → Scribe Hall
    {
      direction: "left",
      zone: { x: 0, y: 540 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "scribe-hall",
      targetSpawnPoint: { x: 1920 - 80, y: 1080 - 64 - T },
    },
    // Right → Reading Room (Central Archives wing)
    {
      direction: "right",
      zone: { x: 960 - EXIT_ZONE_DEPTH, y: 540 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "reading-room",
      targetSpawnPoint: { x: 64, y: 540 - 64 - T },
    },
  ],
  gates: [],
  enemies: [
    {
      id: "enemy_ap_1",
      position: { x: 500, y: 540 - T },
      type: "reader",
      patrolRange: 100,
      groundY: 540 - T,
      facingRight: true,
    },
  ],
  vineAnchors: [],
};

// Shrine rooms (stitch-shrine, redaction-shrine, paste-shrine, index-shrine)
// are defined in abilityShrineRooms.ts and will be integrated by each wing task.

// ─── World Graph Data ────────────────────────────────────────────────

export const DEMO_WORLD_DATA: WorldGraphData = {
  startingRoomId: "scribe-hall",
  hubRoomId: "scribe-hall",
  regions: [
    {
      id: "hub",
      name: "Scribe Hall",
      biomeId: "scribe-hall",
      roomIds: ["scribe-hall"],
    },
    {
      id: "herbarium-wing",
      name: "Herbarium Wing",
      biomeId: "herbarium-folio",
      roomIds: ["tutorial-corridor", "vine-garden", ...HERBARIUM_WING_ROOM_IDS],
    },
    {
      id: "central-archives",
      name: "Central Archives",
      biomeId: "default",
      roomIds: ["archive-passage", "vertical-shaft", ...CENTRAL_ARCHIVES_ROOM_IDS],
    },
  ],
};

// ─── Factory ─────────────────────────────────────────────────────────

export function createDemoWorld(): { worldGraph: WorldGraph; rooms: Map<RoomId, RoomData> } {
  const rooms = new Map<RoomId, RoomData>();
  rooms.set("scribe-hall", SCRIBE_HALL);
  rooms.set("tutorial-corridor", TUTORIAL_CORRIDOR);
  rooms.set("vertical-shaft", VERTICAL_SHAFT);
  rooms.set("vine-garden", VINE_GARDEN);
  rooms.set("archive-passage", ARCHIVE_PASSAGE);
  for (const [id, room] of Object.entries(HERBARIUM_WING_ROOMS)) {
    rooms.set(id, room);
  }
  for (const [id, room] of Object.entries(CENTRAL_ARCHIVES_ROOMS)) {
    rooms.set(id, room);
  }

  const worldGraph = new WorldGraph(DEMO_WORLD_DATA, rooms);
  return { worldGraph, rooms };
}
