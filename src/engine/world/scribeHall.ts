// Scribe Hall — the player's home base hub room

import type { RoomData } from "./Room";
import { EXIT_ZONE_DEPTH } from "./Room";

const T = 32;

export const SCRIBE_HALL: RoomData = {
  id: "scribe-hall",
  name: "Scribe Hall",
  width: 1920,
  height: 1080,
  biomeId: "scribe-hall",
  defaultSpawn: { x: 960, y: 1080 - T - 32 },
  platforms: [
    // Floor (left segment)
    { x: 0, y: 1080 - T, width: 880, height: T },
    // Floor (right segment)
    { x: 1040, y: 1080 - T, width: 880, height: T },
    // Left wall
    { x: 0, y: 0, width: T, height: 1080 },
    // Right wall
    { x: 1920 - T, y: 0, width: T, height: 1080 },
    // Ceiling
    { x: 0, y: 0, width: 1920, height: T },

    // Left bookshelf (upper mezzanine)
    { x: 300, y: 500, width: 320, height: T },
    { x: 260, y: 500, width: 40, height: 200 },
    { x: 620, y: 500, width: 40, height: 200 },

    // Right bookshelf (upper mezzanine)
    { x: 1260, y: 500, width: 320, height: T },
    { x: 1220, y: 500, width: 40, height: 200 },
    { x: 1580, y: 500, width: 40, height: 200 },

    // Central reading nook platform
    { x: 760, y: 700, width: 400, height: T },

    // Stepping platforms (left side)
    { x: 100, y: 800, width: 160, height: T },
    { x: 200, y: 650, width: 128, height: T },

    // Stepping platforms (right side)
    { x: 1660, y: 800, width: 160, height: T },
    { x: 1592, y: 650, width: 128, height: T },

    // Desk area (central elevated platform)
    { x: 800, y: 400, width: 320, height: T },
  ],
  obstacles: [],
  exits: [
    // Left exit → Tutorial Corridor (Herbarium Folio wing)
    {
      direction: "left",
      zone: { x: 0, y: 1080 - T - 128, width: 16, height: 96 },
      targetRoomId: "tutorial-corridor",
      targetSpawnPoint: { x: 1920 - 80, y: 540 - 64 - T },
    },
    // Right exit → Archive Passage
    {
      direction: "right",
      zone: { x: 1920 - 16, y: 1080 - T - 128, width: 16, height: 96 },
      targetRoomId: "archive-passage",
      targetSpawnPoint: { x: 64, y: 540 - 64 - T },
    },
    // Bottom (hidden) → Founder's Vault (secret room, requires all 4 abilities to clear gates)
    // MUST come before harbor-approach exit — first-match wins in checkExits, and this zone
    // is a subset of the harbor-approach zone. Gates physically block access until all 4 open.
    {
      direction: "bottom",
      zone: { x: 920, y: 1080 - EXIT_ZONE_DEPTH, width: 80, height: EXIT_ZONE_DEPTH },
      targetRoomId: "founders-vault",
      targetSpawnPoint: { x: 480, y: T + 64 },
    },
    // Bottom exit → Harbor Approach (Maritime Ledger Wing)
    {
      direction: "bottom",
      zone: { x: 880, y: 1080 - EXIT_ZONE_DEPTH, width: 160, height: EXIT_ZONE_DEPTH },
      targetRoomId: "harbor-approach",
      targetSpawnPoint: { x: 64, y: 540 - 64 - T },
    },
  ],
  gates: [
    // 4 ability gates side-by-side in the floor gap — all must be opened to reach Founder's Vault
    {
      id: "sh_gate_stitch",
      rect: { x: 880, y: 1060, width: 40, height: 20 },
      requiredAbility: "margin-stitch",
      lockedColor: "#22d3ee",
      opened: false,
    },
    {
      id: "sh_gate_redact",
      rect: { x: 920, y: 1060, width: 40, height: 20 },
      requiredAbility: "redaction",
      lockedColor: "#ef4444",
      opened: false,
    },
    {
      id: "sh_gate_paste",
      rect: { x: 960, y: 1060, width: 40, height: 20 },
      requiredAbility: "paste-over",
      lockedColor: "#f59e0b",
      opened: false,
    },
    {
      id: "sh_gate_index",
      rect: { x: 1000, y: 1060, width: 40, height: 20 },
      requiredAbility: "index-mark",
      lockedColor: "#a78bfa",
      opened: false,
    },
  ],
  enemies: [],
  vineAnchors: [],
};
