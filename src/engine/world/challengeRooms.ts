// Challenge Rooms — 4 timed gauntlets, one per biome mechanic
// High difficulty, no enemies — pure traversal/mechanic mastery with par times

import type { RoomData } from "./Room";
import { EXIT_ZONE_DEPTH } from "./Room";

const T = 32; // tile size

// ─── Room 1: Vine Gauntlet (3840×1080) — Herbarium Wing ──────────────

export const VINE_GAUNTLET: RoomData = {
  id: "vine-gauntlet",
  name: "Vine Gauntlet",
  width: 3840,
  height: 1080,
  biomeId: "herbarium-folio",
  defaultSpawn: { x: 128, y: 1080 - T - 128 - 64 },
  platforms: [
    // Floor (spike base)
    { x: 0, y: 1080 - T, width: 3840, height: T },
    // Left wall
    { x: 0, y: 0, width: T, height: 1080 },
    // Right wall
    { x: 3840 - T, y: 0, width: T, height: 1080 },
    // Ceiling
    { x: 0, y: 0, width: 3840, height: T },
    // Start platform (safe zone)
    { x: T, y: 1080 - T - 128, width: 256, height: T },
    // End platform (safe zone)
    { x: 3840 - T - 256, y: 1080 - T - 128, width: 256, height: T },
  ],
  obstacles: [
    // Full-width spike pit between start and end platforms
    {
      id: "vg_spikes",
      rect: { x: T + 256, y: 1080 - T - T, width: 3840 - T * 2 - 512, height: T },
      type: "spikes",
      damage: 1,
      solid: false,
    },
  ],
  exits: [
    // Left exit → herbarium-heart
    {
      direction: "left",
      zone: { x: 0, y: 1080 - T - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "herbarium-heart",
      targetSpawnPoint: { x: 1380, y: 1080 - 64 - T },
    },
  ],
  gates: [],
  enemies: [],
  vineAnchors: [
    { id: "vg_vine_1", position: { x: 500, y: 200 }, ropeLength: 200, type: "ceiling" },
    { id: "vg_vine_2", position: { x: 820, y: 160 }, ropeLength: 220, type: "hanging" },
    { id: "vg_vine_3", position: { x: 1140, y: 130 }, ropeLength: 240, type: "ceiling" },
    { id: "vg_vine_4", position: { x: 1460, y: 110 }, ropeLength: 250, type: "hanging" },
    { id: "vg_vine_5", position: { x: 1780, y: 100 }, ropeLength: 260, type: "ceiling" },
    { id: "vg_vine_6", position: { x: 2100, y: 100 }, ropeLength: 260, type: "hanging" },
    { id: "vg_vine_7", position: { x: 2420, y: 110 }, ropeLength: 250, type: "ceiling" },
    { id: "vg_vine_8", position: { x: 2740, y: 130 }, ropeLength: 240, type: "hanging" },
    { id: "vg_vine_9", position: { x: 3060, y: 160 }, ropeLength: 220, type: "ceiling" },
    { id: "vg_vine_10", position: { x: 3380, y: 200 }, ropeLength: 200, type: "hanging" },
  ],
  challengeTimer: {
    startZone: { x: T + 160, y: 1080 - T - 128 - 96, width: 96, height: 96 },
    endZone: { x: 3840 - T - 256, y: 1080 - T - 128 - 96, width: 96, height: 96 },
    parTime: 30,
  },
  cardDrop: {
    definitionId: "dash-inscription",
    tier: 2,
    position: { x: 3840 - T - 160, y: 1080 - T - 128 - 32 },
  },
};

// ─── Room 2: Gravity Maze (1920×1920) — Astral Atlas Wing ─────────────

export const GRAVITY_MAZE: RoomData = {
  id: "gravity-maze",
  name: "Gravity Maze",
  width: 1920,
  height: 1920,
  biomeId: "astral-atlas",
  defaultSpawn: { x: 128, y: 1920 - T - 96 - 64 },
  platforms: [
    // Floor
    { x: 0, y: 1920 - T, width: 1920, height: T },
    // Ceiling
    { x: 0, y: 0, width: 1920, height: T },
    // Left wall
    { x: 0, y: 0, width: T, height: 1920 },
    // Right wall
    { x: 1920 - T, y: 0, width: T, height: 1920 },
    // Start platform (bottom-left)
    { x: T, y: 1920 - T - 96, width: 256, height: T },
    // End platform (top-center)
    { x: 800, y: T + 64, width: 320, height: T },
    // Intermediate rest platforms
    { x: 300, y: 1400, width: 128, height: T },
    { x: 1500, y: 1000, width: 128, height: T },
    { x: 500, y: 600, width: 128, height: T },
  ],
  obstacles: [
    // Spike strips along walls (push-into hazards from repel wells)
    {
      id: "gm_spikes_left",
      rect: { x: T, y: 400, width: T, height: 600 },
      type: "spikes",
      damage: 1,
      solid: false,
    },
    {
      id: "gm_spikes_right",
      rect: { x: 1920 - T - T, y: 600, width: T, height: 600 },
      type: "spikes",
      damage: 1,
      solid: false,
    },
    {
      id: "gm_spikes_ceil",
      rect: { x: 400, y: T, width: 400, height: T },
      type: "spikes",
      damage: 1,
      solid: false,
    },
    {
      id: "gm_spikes_ceil2",
      rect: { x: 1120, y: T, width: 400, height: T },
      type: "spikes",
      damage: 1,
      solid: false,
    },
  ],
  exits: [
    // Bottom exit → orrery-chamber
    {
      direction: "bottom",
      zone: { x: T, y: 1920 - EXIT_ZONE_DEPTH, width: 256, height: EXIT_ZONE_DEPTH },
      targetRoomId: "orrery-chamber",
      targetSpawnPoint: { x: 720, y: 1080 - 64 - T },
    },
  ],
  gates: [],
  enemies: [],
  vineAnchors: [],
  gravityWells: [
    // Corridor 1: Bottom-left → bottom-right (attract tunnel)
    { id: "gm_attract_1", position: { x: 500, y: 1700 }, radius: 250, strength: 180, type: "attract" },
    { id: "gm_attract_2", position: { x: 900, y: 1650 }, radius: 250, strength: 180, type: "attract" },
    // Hazard: repel well blocking direct path up from start
    { id: "gm_repel_1", position: { x: 700, y: 1300 }, radius: 200, strength: 250, type: "repel" },
    // Corridor 2: Bottom-right → mid-right (vertical attract tunnel)
    { id: "gm_attract_3", position: { x: 1500, y: 1300 }, radius: 250, strength: 200, type: "attract" },
    { id: "gm_attract_4", position: { x: 1450, y: 1000 }, radius: 250, strength: 200, type: "attract" },
    // Hazard: repel well between corridors
    { id: "gm_repel_2", position: { x: 1100, y: 1100 }, radius: 220, strength: 280, type: "repel" },
    // Corridor 3: Mid-right → upper-left (diagonal attract tunnel)
    { id: "gm_attract_5", position: { x: 1200, y: 800 }, radius: 250, strength: 180, type: "attract" },
    { id: "gm_attract_6", position: { x: 800, y: 600 }, radius: 250, strength: 180, type: "attract" },
    // Hazard: repel well near center
    { id: "gm_repel_3", position: { x: 960, y: 900 }, radius: 180, strength: 300, type: "repel" },
    // Corridor 4: Upper-left → top-center (final approach)
    { id: "gm_attract_7", position: { x: 600, y: 400 }, radius: 250, strength: 200, type: "attract" },
    { id: "gm_attract_8", position: { x: 900, y: 200 }, radius: 250, strength: 200, type: "attract" },
    // Hazard: repel wells flanking the final corridor
    { id: "gm_repel_4", position: { x: 300, y: 300 }, radius: 180, strength: 250, type: "repel" },
    { id: "gm_repel_5", position: { x: 1500, y: 400 }, radius: 200, strength: 250, type: "repel" },
  ],
  challengeTimer: {
    startZone: { x: T + 180, y: 1920 - T - 96 - 64, width: 76, height: 64 },
    endZone: { x: 880, y: T + 64, width: 160, height: 64 },
    parTime: 45,
  },
  cardDrop: {
    definitionId: "scribes-haste",
    tier: 2,
    position: { x: 960, y: T + 32 },
  },
};

// ─── Room 3: Current Sprint (3840×540) — Maritime Ledger Wing ─────────

export const CURRENT_SPRINT: RoomData = {
  id: "current-sprint",
  name: "Current Sprint",
  width: 3840,
  height: 540,
  biomeId: "maritime-ledger",
  defaultSpawn: { x: 96, y: 540 - T - 96 - 64 },
  platforms: [
    // Floor
    { x: 0, y: 540 - T, width: 3840, height: T },
    // Ceiling
    { x: 0, y: 0, width: 3840, height: T },
    // Left wall
    { x: 0, y: 0, width: T, height: 540 },
    // Right wall
    { x: 3840 - T, y: 0, width: T, height: 540 },
    // Start platform (elevated)
    { x: T, y: 540 - T - 96, width: 192, height: T },
    // End platform (elevated)
    { x: 3840 - T - 192, y: 540 - T - 96, width: 192, height: T },
    // Island platforms (above whirlpools)
    { x: 960, y: 300, width: 128, height: T },
    { x: 1920, y: 280, width: 128, height: T },
    { x: 2880, y: 300, width: 128, height: T },
  ],
  obstacles: [
    // Spike rows at floor level between platforms
    {
      id: "cs_spikes_1",
      rect: { x: 600, y: 540 - T - T, width: 200, height: T },
      type: "spikes",
      damage: 1,
      solid: false,
    },
    {
      id: "cs_spikes_2",
      rect: { x: 1500, y: 540 - T - T, width: 200, height: T },
      type: "spikes",
      damage: 1,
      solid: false,
    },
    {
      id: "cs_spikes_3",
      rect: { x: 2400, y: 540 - T - T, width: 200, height: T },
      type: "spikes",
      damage: 1,
      solid: false,
    },
    {
      id: "cs_spikes_4",
      rect: { x: 3200, y: 540 - T - T, width: 200, height: T },
      type: "spikes",
      damage: 1,
      solid: false,
    },
  ],
  exits: [
    // Left exit → whirlpool-depths
    {
      direction: "left",
      zone: { x: 0, y: 540 - T - 96, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "whirlpool-depths",
      targetSpawnPoint: { x: 1380, y: 1080 - 64 - T },
    },
  ],
  gates: [],
  enemies: [],
  vineAnchors: [],
  currentZones: [
    // Jet 1: Initial boost (rightward)
    {
      id: "cs_jet_1",
      rect: { x: 200, y: 100, width: 200, height: 300 },
      direction: { x: 1, y: 0 },
      strength: 900,
      type: "jet",
    },
    // Whirlpool 1: First obstacle (clockwise)
    {
      id: "cs_whirlpool_1",
      rect: { x: 800, y: 100, width: 400, height: 400 },
      direction: { x: 0, y: 0 },
      strength: 400,
      type: "whirlpool",
      clockwise: true,
    },
    // Gust 1: Pulsing updraft (ride over whirlpool)
    {
      id: "cs_gust_1",
      rect: { x: 1200, y: 200, width: 200, height: 200 },
      direction: { x: 0, y: -1 },
      strength: 600,
      type: "gust",
      gustOnDuration: 2.0,
      gustOffDuration: 1.5,
      gustOffset: 0,
    },
    // Jet 2: Mid-section speed boost
    {
      id: "cs_jet_2",
      rect: { x: 1400, y: 80, width: 300, height: 200 },
      direction: { x: 1, y: 0 },
      strength: 1000,
      type: "jet",
    },
    // Whirlpool 2: Second obstacle (counter-clockwise)
    {
      id: "cs_whirlpool_2",
      rect: { x: 1750, y: 50, width: 450, height: 450 },
      direction: { x: 0, y: 0 },
      strength: 450,
      type: "whirlpool",
      clockwise: false,
    },
    // Gust 2: Pulsing downdraft (must time through)
    {
      id: "cs_gust_2",
      rect: { x: 2200, y: 150, width: 200, height: 250 },
      direction: { x: 0, y: 1 },
      strength: 500,
      type: "gust",
      gustOnDuration: 1.5,
      gustOffDuration: 2.0,
      gustOffset: 0.5,
    },
    // Jet 3: Recovery boost
    {
      id: "cs_jet_3",
      rect: { x: 2500, y: 100, width: 200, height: 250 },
      direction: { x: 1, y: -0.3 },
      strength: 800,
      type: "jet",
    },
    // Whirlpool 3: Final obstacle (clockwise, strongest)
    {
      id: "cs_whirlpool_3",
      rect: { x: 2750, y: 50, width: 400, height: 400 },
      direction: { x: 0, y: 0 },
      strength: 500,
      type: "whirlpool",
      clockwise: true,
    },
    // Stream: Final tailwind to finish line
    {
      id: "cs_stream_1",
      rect: { x: 3200, y: 50, width: 400, height: 400 },
      direction: { x: 1, y: 0 },
      strength: 300,
      type: "stream",
    },
  ],
  challengeTimer: {
    startZone: { x: T + 128, y: 540 - T - 96 - 64, width: 64, height: 64 },
    endZone: { x: 3840 - T - 192, y: 540 - T - 96 - 64, width: 64, height: 64 },
    parTime: 25,
  },
  cardDrop: {
    definitionId: "snap-verse",
    tier: 2,
    position: { x: 3840 - T - 128, y: 540 - T - 96 - 32 },
  },
};

// ─── Room 4: Fog Labyrinth (1920×1080) — Gothic Errata Wing ──────────

export const FOG_LABYRINTH: RoomData = {
  id: "fog-labyrinth",
  name: "Fog Labyrinth",
  width: 1920,
  height: 1080,
  biomeId: "gothic-errata",
  defaultSpawn: { x: 96, y: 1080 - T - 96 - 64 },
  platforms: [
    // Floor
    { x: 0, y: 1080 - T, width: 1920, height: T },
    // Ceiling
    { x: 0, y: 0, width: 1920, height: T },
    // Left wall
    { x: 0, y: 0, width: T, height: 1080 },
    // Right wall
    { x: 1920 - T, y: 0, width: T, height: 1080 },
    // Start platform (bottom-left, safe)
    { x: T, y: 1080 - T - 96, width: 192, height: T },
    // End platform (top-right, safe)
    { x: 1920 - T - 192, y: T + 64, width: 192, height: T },

    // Row 1 (bottom): horizontal wall segments forcing zigzag
    { x: 300, y: 900, width: 400, height: T },
    { x: 900, y: 900, width: T, height: 180 },
    { x: 1200, y: 850, width: 400, height: T },

    // Row 2: middle maze section
    { x: T, y: 700, width: 350, height: T },
    { x: 600, y: 680, width: 500, height: T },
    { x: 1400, y: 700, width: 200, height: T },
    { x: 1600, y: 600, width: T, height: 200 },

    // Row 3: upper section
    { x: 300, y: 500, width: 200, height: T },
    { x: 700, y: 480, width: 400, height: T },
    { x: 1300, y: 450, width: 300, height: T },

    // Row 4: near-top
    { x: T, y: 320, width: 500, height: T },
    { x: 800, y: 300, width: 400, height: T },
    { x: 1400, y: 280, width: 200, height: T },

    // Row 5: top approach
    { x: 400, y: 160, width: 600, height: T },
  ],
  obstacles: [
    // Dead-end traps (spikes at tempting dead ends)
    {
      id: "fl_spikes_1",
      rect: { x: 1200, y: 900 - T, width: 128, height: T },
      type: "spikes",
      damage: 1,
      solid: false,
    },
    {
      id: "fl_spikes_2",
      rect: { x: T, y: 680 - T, width: 128, height: T },
      type: "spikes",
      damage: 1,
      solid: false,
    },
    {
      id: "fl_spikes_3",
      rect: { x: 1600, y: 600 - T, width: 128, height: T },
      type: "spikes",
      damage: 1,
      solid: false,
    },
    {
      id: "fl_spikes_4",
      rect: { x: 300, y: 480 - T, width: 128, height: T },
      type: "spikes",
      damage: 1,
      solid: false,
    },
    {
      id: "fl_spikes_5",
      rect: { x: T, y: 300 - T, width: 128, height: T },
      type: "spikes",
      damage: 1,
      solid: false,
    },
  ],
  exits: [
    // Bottom-left exit → scriptorium-ruin
    {
      direction: "left",
      zone: { x: 0, y: 1080 - T - 96, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "scriptorium-ruin",
      targetSpawnPoint: { x: 1380, y: 1080 - 64 - T },
    },
  ],
  gates: [],
  enemies: [],
  vineAnchors: [],
  fogZones: [
    // Dense fog covering almost the entire room
    { id: "fl_fog_1", rect: { x: 0, y: 0, width: 1920, height: 1080 }, type: "fog", density: 0.95 },
    // Inversion zone in the middle section (controls swap left/right)
    { id: "fl_inversion_1", rect: { x: 500, y: 550, width: 600, height: 250 }, type: "inversion", density: 0 },
    // Scramble zone in the upper section (all directions shuffled)
    { id: "fl_scramble_1", rect: { x: 700, y: 200, width: 500, height: 200 }, type: "scramble", density: 0 },
  ],
  healthPickups: [
    // Hidden in upper maze section — reward for exploration
    { id: "fl_hp_1", position: { x: 1450, y: 430 }, healAmount: 1 },
  ],
  challengeTimer: {
    startZone: { x: T + 128, y: 1080 - T - 96 - 64, width: 64, height: 64 },
    endZone: { x: 1920 - T - 192, y: T + 64, width: 128, height: 64 },
    parTime: 60,
  },
  cardDrop: {
    definitionId: "stoic-page",
    tier: 2,
    position: { x: 1920 - T - 128, y: T + 32 },
  },
};

// ─── Constants ──────────────────────────────────────────────────────

/** All Challenge Room definitions keyed by ID */
export const CHALLENGE_ROOMS: Record<string, RoomData> = {
  "vine-gauntlet": VINE_GAUNTLET,
  "gravity-maze": GRAVITY_MAZE,
  "current-sprint": CURRENT_SPRINT,
  "fog-labyrinth": FOG_LABYRINTH,
};

/** All Challenge Room IDs */
export const CHALLENGE_ROOM_IDS = [
  "vine-gauntlet",
  "gravity-maze",
  "current-sprint",
  "fog-labyrinth",
] as const;
