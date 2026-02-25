// Central Archives Wing — 5 rooms forming the backbone corridor between the hub and deeper biome wings
// Layout: archive-passage → reading-room → card-catalog (MS gate shortcut) / restricted-section → giant-chamber [BOSS] → upper-archives

import type { RoomData } from "./Room";
import { EXIT_ZONE_DEPTH } from "./Room";

const T = 32; // tile size

// ─── Room 1: Reading Room (1920×540) — Wide Hall ─────────────────────

export const READING_ROOM: RoomData = {
  id: "reading-room",
  name: "Reading Room",
  width: 1920,
  height: 540,
  biomeId: "default",
  defaultSpawn: { x: 64, y: 540 - 64 - T },
  platforms: [
    // Floor
    { x: 0, y: 540 - T, width: 1920, height: T },
    // Ceiling
    { x: 0, y: 0, width: 1920, height: T },
    // Left wall (gap for left exit)
    { x: 0, y: 0, width: T, height: 540 - 128 },
    { x: 0, y: 540 - 64, width: T, height: 64 },
    // Right wall (gaps for two right exits)
    { x: 1920 - T, y: 0, width: T, height: 540 - 192 },
    { x: 1920 - T, y: 540 - 64, width: T, height: 64 },

    // Elevated platform left — bookshelf ledge
    { x: 300, y: 360, width: 192, height: T },
    // Elevated platform center — reading desk
    { x: 800, y: 300, width: 256, height: T },
    // Elevated platform right — shelf step
    { x: 1400, y: 380, width: 160, height: T },
    // Stepping stones between elevated platforms
    { x: 560, y: 400, width: 96, height: T },
    { x: 1120, y: 360, width: 96, height: T },
    { x: 1640, y: 420, width: 96, height: T },
  ],
  obstacles: [],
  exits: [
    // Left → archive-passage (return)
    {
      direction: "left",
      zone: { x: 0, y: 540 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "archive-passage",
      targetSpawnPoint: { x: 960 - 80, y: 540 - 64 - T },
    },
    // Right (upper) → card-catalog
    {
      direction: "right",
      zone: { x: 1920 - EXIT_ZONE_DEPTH, y: 540 - 192, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "card-catalog",
      targetSpawnPoint: { x: 64, y: 1080 - 64 - T },
    },
    // Right (lower) → restricted-section (direct path, no MS required)
    {
      direction: "right",
      zone: { x: 1920 - EXIT_ZONE_DEPTH, y: 540 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "restricted-section",
      targetSpawnPoint: { x: 64, y: 1080 - 64 - T },
    },
  ],
  gates: [],
  enemies: [
    // Floor patrol reader
    {
      id: "rr_reader_1",
      position: { x: 600, y: 540 - T },
      type: "reader",
      patrolRange: 150,
      groundY: 540 - T,
      facingRight: true,
    },
    // Center platform reader
    {
      id: "rr_reader_2",
      position: { x: 880, y: 300 },
      type: "reader",
      patrolRange: 80,
      groundY: 300,
      facingRight: false,
    },
    // Binder on right elevated area
    {
      id: "rr_binder_1",
      position: { x: 1440, y: 380 },
      type: "binder",
      patrolRange: 60,
      groundY: 380,
      facingRight: false,
    },
  ],
  vineAnchors: [],
};

// ─── Room 2: Card Catalog (960×1080) — Vertical Wall-Jump Gauntlet ──

export const CARD_CATALOG: RoomData = {
  id: "card-catalog",
  name: "Card Catalog",
  width: 960,
  height: 1080,
  biomeId: "default",
  defaultSpawn: { x: 64, y: 1080 - 64 - T },
  platforms: [
    // Floor
    { x: 0, y: 1080 - T, width: 960, height: T },
    // Ceiling (gap for top exit)
    { x: 0, y: 0, width: 400, height: T },
    { x: 560, y: 0, width: 400, height: T },
    // Left wall (gap for bottom-left exit)
    { x: 0, y: 0, width: T, height: 1080 - 128 },
    { x: 0, y: 1080 - 64, width: T, height: 64 },
    // Right wall
    { x: 960 - T, y: 0, width: T, height: 1080 },

    // Wall-jump gauntlet platforms — alternating left/right
    { x: T, y: 880, width: 128, height: T },           // left
    { x: 960 - T - 128, y: 720, width: 128, height: T }, // right
    { x: T, y: 560, width: 128, height: T },             // left
    { x: 960 - T - 128, y: 400, width: 128, height: T }, // right
    { x: T, y: 240, width: 128, height: T },             // left

    // Upper chamber platform — wide landing at top
    { x: 200, y: 160, width: 560, height: T },
  ],
  obstacles: [
    // Spike strip along bottom of shaft (punishment for falling)
    {
      id: "cc_spikes_1",
      rect: { x: T + 128, y: 1080 - T - 16, width: 960 - 2 * T - 256, height: 16 },
      type: "spikes",
      damage: 15,
      solid: false,
    },
  ],
  exits: [
    // Left (bottom) → reading-room
    {
      direction: "left",
      zone: { x: 0, y: 1080 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "reading-room",
      targetSpawnPoint: { x: 1920 - 80, y: 540 - 64 - T },
    },
    // Top → restricted-section (requires Margin Stitch)
    {
      direction: "top",
      zone: { x: 400, y: 0, width: 160, height: EXIT_ZONE_DEPTH },
      targetRoomId: "restricted-section",
      targetSpawnPoint: { x: 200, y: 1080 - 64 - T },
    },
  ],
  gates: [
    // Margin Stitch gate blocking top exit
    {
      id: "ca_ms_gate",
      rect: { x: 400, y: 64, width: 16, height: 96 },
      requiredAbility: "margin-stitch",
      lockedColor: "#22d3ee",
      opened: false,
    },
  ],
  enemies: [
    // Proofwarden on upper landing guards the gate passage
    {
      id: "cc_proofwarden_1",
      position: { x: 480, y: 160 },
      type: "proofwarden",
      groundY: 160,
      facingRight: false,
    },
  ],
  vineAnchors: [],
};

// ─── Room 3: Restricted Section (1920×1080) — Combat-Dense Hall ──────

export const RESTRICTED_SECTION: RoomData = {
  id: "restricted-section",
  name: "Restricted Section",
  width: 1920,
  height: 1080,
  biomeId: "default",
  defaultSpawn: { x: 64, y: 1080 - 64 - T },
  platforms: [
    // Floor — left section
    { x: 0, y: 1080 - T, width: 600, height: T },
    // Floor — right section
    { x: 1300, y: 1080 - T, width: 620, height: T },
    // Ceiling
    { x: 0, y: 0, width: 1920, height: T },
    // Left wall (gap for left exit)
    { x: 0, y: 0, width: T, height: 1080 - 128 },
    { x: 0, y: 1080 - 64, width: T, height: 64 },
    // Right wall (gap for right exit)
    { x: 1920 - T, y: 0, width: T, height: 1080 - 128 },
    { x: 1920 - T, y: 1080 - 64, width: T, height: 64 },

    // Mid-level combat platforms
    // Lower-left platform
    { x: 200, y: 800, width: 300, height: T },
    // Center bridge
    { x: 700, y: 700, width: 500, height: T },
    // Upper-right platform
    { x: 1300, y: 600, width: 300, height: T },
    // Upper-left alcove
    { x: 100, y: 500, width: 200, height: T },
    // High center platform
    { x: 800, y: 400, width: 320, height: T },
  ],
  obstacles: [
    // Spike pit in the floor gap
    {
      id: "rs_spikes_1",
      rect: { x: 600, y: 1080 - T - 16, width: 700, height: 16 },
      type: "spikes",
      damage: 20,
      solid: false,
    },
    // Ceiling spikes above upper-left alcove
    {
      id: "rs_spikes_2",
      rect: { x: 100, y: 480, width: 200, height: 8 },
      type: "spikes",
      damage: 10,
      solid: false,
    },
  ],
  exits: [
    // Left (lower) → reading-room
    {
      direction: "left",
      zone: { x: 0, y: 1080 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "reading-room",
      targetSpawnPoint: { x: 1920 - 80, y: 540 - 64 - T },
    },
    // Right → giant-chamber
    {
      direction: "right",
      zone: { x: 1920 - EXIT_ZONE_DEPTH, y: 1080 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "giant-chamber",
      targetSpawnPoint: { x: 64, y: 1080 - 64 - T },
    },
  ],
  gates: [],
  enemies: [
    // Reader patrolling left floor section
    {
      id: "rs_reader_1",
      position: { x: 300, y: 1080 - T },
      type: "reader",
      patrolRange: 150,
      groundY: 1080 - T,
      facingRight: true,
    },
    // Reader on center bridge
    {
      id: "rs_reader_2",
      position: { x: 900, y: 700 },
      type: "reader",
      patrolRange: 120,
      groundY: 700,
      facingRight: false,
    },
    // Binder on upper-right platform
    {
      id: "rs_binder_1",
      position: { x: 1400, y: 600 },
      type: "binder",
      patrolRange: 100,
      groundY: 600,
      facingRight: false,
    },
    // Binder on high center platform (thread attacks down)
    {
      id: "rs_binder_2",
      position: { x: 900, y: 400 },
      type: "binder",
      patrolRange: 80,
      groundY: 400,
      facingRight: true,
    },
  ],
  vineAnchors: [],
};

// ─── Room 4: Giant's Chamber (1440×1080) — Boss Arena ────────────────

const GIANT_CHAMBER_BOSS_GATE_RECT = {
  x: 1440 - T - 16,
  y: 700,
  width: 16,
  height: 380,
};

export const GIANT_CHAMBER: RoomData = {
  id: "giant-chamber",
  name: "Giant's Chamber",
  width: 1440,
  height: 1080,
  biomeId: "default",
  defaultSpawn: { x: 64, y: 1080 - 64 - T },
  platforms: [
    // Floor — wide flat for boss stomps
    { x: 0, y: 1080 - T, width: 1440, height: T },
    // Ceiling
    { x: 0, y: 0, width: 1440, height: T },
    // Left wall (gap for left exit)
    { x: 0, y: 0, width: T, height: 1080 - 128 },
    { x: 0, y: 1080 - 64, width: T, height: 64 },
    // Right wall (gap for right exit)
    { x: 1440 - T, y: 0, width: T, height: 700 },
    { x: 1440 - T, y: 1080 - 64, width: T, height: 64 },

    // Elevated side platforms for player positioning
    // Left perch
    { x: T, y: 700, width: 160, height: T },
    // Right perch
    { x: 1440 - T - 160, y: 700, width: 160, height: T },
    // Center high platform
    { x: 560, y: 500, width: 320, height: T },

    // Post-boss blocking platform (removed when boss defeated)
    {
      x: GIANT_CHAMBER_BOSS_GATE_RECT.x,
      y: GIANT_CHAMBER_BOSS_GATE_RECT.y,
      width: GIANT_CHAMBER_BOSS_GATE_RECT.width,
      height: GIANT_CHAMBER_BOSS_GATE_RECT.height,
    },
  ],
  obstacles: [],
  exits: [
    // Left → restricted-section
    {
      direction: "left",
      zone: { x: 0, y: 1080 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "restricted-section",
      targetSpawnPoint: { x: 1920 - 80, y: 1080 - 64 - T },
    },
    // Right → upper-archives (blocked by boss gate platform until Footnote Giant is defeated)
    {
      direction: "right",
      zone: { x: 1440 - EXIT_ZONE_DEPTH, y: 1080 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "upper-archives",
      targetSpawnPoint: { x: 64, y: 540 - 64 - T },
    },
  ],
  gates: [],
  enemies: [
    // Footnote Giant boss spawn
    {
      id: "ca_footnote_giant",
      position: { x: 900, y: 1080 - T },
      type: "boss",
      bossId: "footnote-giant",
      groundY: 1080 - T,
      facingRight: false,
    },
  ],
  vineAnchors: [],
  bossGate: {
    bossId: "footnote-giant",
    platformRect: GIANT_CHAMBER_BOSS_GATE_RECT,
  },
};

// ─── Room 5: Upper Archives (1920×540) — Post-Boss Junction ──────────

export const UPPER_ARCHIVES: RoomData = {
  id: "upper-archives",
  name: "Upper Archives",
  width: 1920,
  height: 540,
  biomeId: "default",
  defaultSpawn: { x: 64, y: 540 - 64 - T },
  platforms: [
    // Floor
    { x: 0, y: 540 - T, width: 1920, height: T },
    // Ceiling (gap for top exit)
    { x: 0, y: 0, width: 880, height: T },
    { x: 1040, y: 0, width: 880, height: T },
    // Left wall (gap for left exit)
    { x: 0, y: 0, width: T, height: 540 - 128 },
    { x: 0, y: 540 - 64, width: T, height: 64 },
    // Right wall (gap for right exit)
    { x: 1920 - T, y: 0, width: T, height: 540 - 128 },
    { x: 1920 - T, y: 540 - 64, width: T, height: 64 },

    // Elevated walkway platforms
    { x: 300, y: 380, width: 256, height: T },
    { x: 700, y: 320, width: 320, height: T },
    { x: 1200, y: 360, width: 256, height: T },
    // Upper ledge near top exit
    { x: 800, y: 160, width: 320, height: T },
  ],
  obstacles: [],
  exits: [
    // Left → giant-chamber
    {
      direction: "left",
      zone: { x: 0, y: 540 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "giant-chamber",
      targetSpawnPoint: { x: 1440 - 80, y: 1080 - 64 - T },
    },
    // Top → observatory-bridge (Astral Atlas entry — room defined in a later task)
    {
      direction: "top",
      zone: { x: 880, y: 0, width: 160, height: EXIT_ZONE_DEPTH },
      targetRoomId: "observatory-bridge",
      targetSpawnPoint: { x: 64, y: 540 - 64 - T },
    },
    // Right → crypt-entrance (Gothic Errata entry — room defined in a later task)
    {
      direction: "right",
      zone: { x: 1920 - EXIT_ZONE_DEPTH, y: 540 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "crypt-entrance",
      targetSpawnPoint: { x: 64, y: 540 - 64 - T },
    },
  ],
  gates: [],
  enemies: [
    // Light Reader on walkway (post-boss wind-down)
    {
      id: "ua_reader_1",
      position: { x: 400, y: 380 },
      type: "reader",
      patrolRange: 80,
      groundY: 380,
      facingRight: true,
    },
    // Proofwarden near the junction area
    {
      id: "ua_proofwarden_1",
      position: { x: 1000, y: 540 - T },
      type: "proofwarden",
      groundY: 540 - T,
      facingRight: false,
    },
  ],
  vineAnchors: [],
};

// ─── Exports ─────────────────────────────────────────────────────────

/** All Central Archives room definitions keyed by ID */
export const CENTRAL_ARCHIVES_ROOMS: Record<string, RoomData> = {
  "reading-room": READING_ROOM,
  "card-catalog": CARD_CATALOG,
  "restricted-section": RESTRICTED_SECTION,
  "giant-chamber": GIANT_CHAMBER,
  "upper-archives": UPPER_ARCHIVES,
};

/** All Central Archives room IDs */
export const CENTRAL_ARCHIVES_ROOM_IDS = [
  "reading-room",
  "card-catalog",
  "restricted-section",
  "giant-chamber",
  "upper-archives",
] as const;
