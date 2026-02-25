// Maritime Ledger Wing — 7 rooms featuring ocean currents, gusts, whirlpools, and jet streams
// Layout: harbor-approach → tide-pool-cavern → cargo-hold → redaction-shrine (separate file)
//                                                    ↓                ↓
//                                        storm-channel ← ← ← (from shrine)
//                                                    ↓
//                                        whirlpool-depths → lighthouse-tower → tide-scribe-arena
// The 8th room (redaction-shrine) is defined in abilityShrineRooms.ts

import type { RoomData } from "./Room";
import { EXIT_ZONE_DEPTH, GATE_WIDTH, GATE_HEIGHT } from "./Room";

const T = 32; // tile size

// ─── Room 1: Harbor Approach (1920×540) — Entry + Horizontal Streams ─

const HARBOR_APPROACH: RoomData = {
  id: "harbor-approach",
  name: "Harbor Approach",
  width: 1920,
  height: 540,
  biomeId: "maritime-ledger",
  defaultSpawn: { x: 100, y: 540 - 64 - T },
  platforms: [
    // Floor (with gap for spike pit around x=800-1000)
    { x: 0, y: 540 - T, width: 780, height: T },
    { x: 1020, y: 540 - T, width: 900, height: T },
    // Ceiling
    { x: 0, y: 0, width: 1920, height: T },
    // Left wall (gap for left exit)
    { x: 0, y: 0, width: T, height: 540 - 128 },
    { x: 0, y: 540 - 64, width: T, height: 64 },
    // Right wall (gap for right exit)
    { x: 1920 - T, y: 0, width: T, height: 540 - 128 },
    { x: 1920 - T, y: 540 - 64, width: T, height: 64 },

    // Mid-height platforms for current-riding landings
    { x: 650, y: 320, width: 160, height: T },
    { x: 1050, y: 280, width: 160, height: T },
    { x: 1400, y: 340, width: 128, height: T },
  ],
  obstacles: [
    // Spikes in the floor gap
    {
      id: "ml_spikes_ha_1",
      rect: { x: 780, y: 540 - T - T, width: 240, height: T },
      type: "spikes",
      damage: 1,
      solid: false,
    },
  ],
  exits: [
    // Left → scribe-hall (hub — will connect when hub expansion task adds the return exit)
    {
      direction: "left",
      zone: { x: 0, y: 540 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "scribe-hall",
      targetSpawnPoint: { x: 1920 - 80, y: 1080 - 64 - T },
    },
    // Right → tide-pool-cavern
    {
      direction: "right",
      zone: { x: 1920 - EXIT_ZONE_DEPTH, y: 540 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "tide-pool-cavern",
      targetSpawnPoint: { x: 64, y: 1080 - 64 - T },
    },
  ],
  gates: [],
  enemies: [
    {
      id: "ml_reader_ha_1",
      position: { x: 1200, y: 540 - T },
      type: "reader",
      patrolRange: 120,
      groundY: 540 - T,
      facingRight: false,
    },
  ],
  vineAnchors: [],
  currentZones: [
    // Stream 1: rightward push across the gap
    {
      id: "ml_stream_ha_1",
      rect: { x: 700, y: 200, width: 500, height: 300 },
      direction: { x: 1, y: 0 },
      strength: 350,
      type: "stream",
    },
    // Stream 2: lighter leftward return current near ceiling
    {
      id: "ml_stream_ha_2",
      rect: { x: 300, y: T, width: 600, height: 150 },
      direction: { x: -1, y: 0 },
      strength: 200,
      type: "stream",
    },
  ],
};

// ─── Room 2: Tide Pool Cavern (960×1080) — Vertical + Whirlpool ─────

const TIDE_POOL_CAVERN: RoomData = {
  id: "tide-pool-cavern",
  name: "Tide Pool Cavern",
  width: 960,
  height: 1080,
  biomeId: "maritime-ledger",
  defaultSpawn: { x: 100, y: 1080 - 64 - T },
  platforms: [
    // Floor
    { x: 0, y: 1080 - T, width: 960, height: T },
    // Ceiling (gap for top exit)
    { x: 0, y: 0, width: 360, height: T },
    { x: 600, y: 0, width: 360, height: T },
    // Left wall (gap for left exit at bottom)
    { x: 0, y: 0, width: T, height: 1080 - 128 },
    { x: 0, y: 1080 - 64, width: T, height: 64 },
    // Right wall
    { x: 960 - T, y: 0, width: T, height: 1080 },

    // Staggered platforms for vertical climbing through whirlpool
    { x: T, y: 880, width: 160, height: T },
    { x: 600, y: 780, width: 160, height: T },
    { x: 200, y: 640, width: 128, height: T },
    { x: 700, y: 520, width: 160, height: T },
    { x: 300, y: 380, width: 128, height: T },

    // Top landing near exit
    { x: 360, y: 160, width: 240, height: T },
  ],
  obstacles: [],
  exits: [
    // Left (bottom) → harbor-approach
    {
      direction: "left",
      zone: { x: 0, y: 1080 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "harbor-approach",
      targetSpawnPoint: { x: 1920 - 80, y: 540 - 64 - T },
    },
    // Top → cargo-hold
    {
      direction: "top",
      zone: { x: 360, y: 0, width: 240, height: EXIT_ZONE_DEPTH },
      targetRoomId: "cargo-hold",
      targetSpawnPoint: { x: 100, y: 1080 - 64 - T },
    },
  ],
  gates: [],
  enemies: [
    {
      id: "ml_reader_tp_1",
      position: { x: 640, y: 780 },
      type: "reader",
      patrolRange: 60,
      groundY: 780,
      facingRight: false,
    },
    {
      id: "ml_reader_tp_2",
      position: { x: 400, y: 160 },
      type: "reader",
      patrolRange: 60,
      groundY: 160,
      facingRight: true,
    },
    {
      id: "ml_binder_tp_1",
      position: { x: 250, y: 640 },
      type: "binder",
      patrolRange: 50,
      groundY: 640,
      facingRight: true,
    },
  ],
  vineAnchors: [],
  currentZones: [
    // Whirlpool — center-room, helps spiral players upward
    {
      id: "ml_whirlpool_tp_1",
      rect: { x: 200, y: 400, width: 560, height: 400 },
      direction: { x: 0, y: 0 },
      strength: 300,
      type: "whirlpool",
      clockwise: true,
    },
    // Gust updraft near right wall — boost for climbing
    {
      id: "ml_gust_tp_1",
      rect: { x: 700, y: 500, width: 200, height: 400 },
      direction: { x: 0, y: -1 },
      strength: 550,
      type: "gust",
      gustOnDuration: 2.5,
      gustOffDuration: 1.5,
      gustOffset: 0,
    },
  ],
};

// ─── Room 3: Cargo Hold (1920×1080) — Large Current River Room ───────

const CARGO_HOLD: RoomData = {
  id: "cargo-hold",
  name: "Cargo Hold",
  width: 1920,
  height: 1080,
  biomeId: "maritime-ledger",
  defaultSpawn: { x: 100, y: 1080 - 64 - T },
  platforms: [
    // Floor segments (island style with gaps)
    { x: 0, y: 1080 - T, width: 500, height: T },
    { x: 700, y: 1080 - T, width: 400, height: T },
    { x: 1400, y: 1080 - T, width: 520, height: T },
    // Ceiling
    { x: 0, y: 0, width: 1920, height: T },
    // Left wall
    { x: 0, y: 0, width: T, height: 1080 },
    // Right wall (gap for right exit to shrine)
    { x: 1920 - T, y: 0, width: T, height: 1080 - 128 },
    { x: 1920 - T, y: 1080 - 64, width: T, height: 64 },

    // Stepping-stone platforms above stream channels
    { x: 520, y: 700, width: 128, height: T },
    { x: 1150, y: 650, width: 128, height: T },
    { x: 1300, y: 450, width: 128, height: T },

    // Upper platforms
    { x: 400, y: 400, width: 200, height: T },
    { x: 800, y: 350, width: 200, height: T },
    { x: 1500, y: 300, width: 200, height: T },

    // Landing platform near right exit (for return from shrine)
    { x: 1720, y: 1080 - T - 96, width: 168, height: T },
  ],
  obstacles: [],
  exits: [
    // Bottom-left → tide-pool-cavern
    {
      direction: "bottom",
      zone: { x: 0, y: 1080 - EXIT_ZONE_DEPTH, width: 160, height: EXIT_ZONE_DEPTH },
      targetRoomId: "tide-pool-cavern",
      targetSpawnPoint: { x: 480, y: T + 64 },
    },
    // Right → redaction-shrine
    {
      direction: "right",
      zone: { x: 1920 - EXIT_ZONE_DEPTH, y: 1080 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "redaction-shrine",
      targetSpawnPoint: { x: 100, y: 540 - 64 - T },
    },
    // Bottom (center) → storm-channel (shortcut from shrine path)
    {
      direction: "bottom",
      zone: { x: 880, y: 1080 - EXIT_ZONE_DEPTH, width: 160, height: EXIT_ZONE_DEPTH },
      targetRoomId: "storm-channel",
      targetSpawnPoint: { x: 800, y: T + 64 },
    },
  ],
  gates: [],
  enemies: [
    {
      id: "ml_binder_ch_1",
      position: { x: 300, y: 1080 - T },
      type: "binder",
      patrolRange: 120,
      groundY: 1080 - T,
      facingRight: true,
    },
    {
      id: "ml_binder_ch_2",
      position: { x: 1500, y: 1080 - T },
      type: "binder",
      patrolRange: 100,
      groundY: 1080 - T,
      facingRight: false,
    },
  ],
  vineAnchors: [],
  currentZones: [
    // Stream 1: lower channel, rightward
    {
      id: "ml_stream_ch_1",
      rect: { x: 300, y: 800, width: 800, height: 200 },
      direction: { x: 1, y: 0 },
      strength: 400,
      type: "stream",
    },
    // Stream 2: upper channel, leftward
    {
      id: "ml_stream_ch_2",
      rect: { x: 400, y: 300, width: 800, height: 200 },
      direction: { x: -1, y: 0 },
      strength: 350,
      type: "stream",
    },
    // Stream 3: connecting vertical channel
    {
      id: "ml_stream_ch_3",
      rect: { x: 1200, y: 400, width: 200, height: 500 },
      direction: { x: 0, y: -1 },
      strength: 300,
      type: "stream",
    },
    // Jet 1: launcher to upper area
    {
      id: "ml_jet_ch_1",
      rect: { x: 800, y: 900, width: 100, height: 150 },
      direction: { x: 0.3, y: -1 },
      strength: 900,
      type: "jet",
    },
  ],
  healthPickups: [
    { id: "ch_hp_1", position: { x: 850, y: 680 }, healAmount: 1 },
  ],
  cardDrop: {
    definitionId: "spear-verse",
    tier: 1,
    position: { x: 900, y: 330 },
  },
};

// ─── Room 5: Storm Channel (1920×540) — Gust Gauntlet ───────────────

const STORM_CHANNEL: RoomData = {
  id: "storm-channel",
  name: "Storm Channel",
  width: 1920,
  height: 540,
  biomeId: "maritime-ledger",
  defaultSpawn: { x: 64, y: 540 - 64 - T },
  platforms: [
    // Floor segments with spike pits
    { x: 0, y: 540 - T, width: 280, height: T },
    { x: 400, y: 540 - T, width: 200, height: T },
    { x: 750, y: 540 - T, width: 200, height: T },
    { x: 1100, y: 540 - T, width: 200, height: T },
    { x: 1500, y: 540 - T, width: 420, height: T },
    // Ceiling
    { x: 0, y: 0, width: 1920, height: T },
    // Left wall (gap for left exit)
    { x: 0, y: 0, width: T, height: 540 - 128 },
    { x: 0, y: 540 - 64, width: T, height: 64 },
    // Right wall
    { x: 1920 - T, y: 0, width: T, height: 540 },

    // Elevated safe platforms between gust zones
    { x: 350, y: 300, width: 128, height: T },
    { x: 700, y: 260, width: 128, height: T },
    { x: 1100, y: 280, width: 128, height: T },
    { x: 1450, y: 320, width: 128, height: T },
  ],
  obstacles: [
    // Spikes in floor gaps
    {
      id: "ml_spikes_sc_1",
      rect: { x: 280, y: 540 - T - T, width: 120, height: T },
      type: "spikes",
      damage: 1,
      solid: false,
    },
    {
      id: "ml_spikes_sc_2",
      rect: { x: 600, y: 540 - T - T, width: 150, height: T },
      type: "spikes",
      damage: 1,
      solid: false,
    },
    {
      id: "ml_spikes_sc_3",
      rect: { x: 950, y: 540 - T - T, width: 150, height: T },
      type: "spikes",
      damage: 1,
      solid: false,
    },
    {
      id: "ml_spikes_sc_4",
      rect: { x: 1300, y: 540 - T - T, width: 200, height: T },
      type: "spikes",
      damage: 1,
      solid: false,
    },
  ],
  exits: [
    // Left → redaction-shrine (return path)
    {
      direction: "left",
      zone: { x: 0, y: 540 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "redaction-shrine",
      targetSpawnPoint: { x: 960 - 100, y: 540 - 64 - T },
    },
    // Bottom → whirlpool-depths
    {
      direction: "bottom",
      zone: { x: 880, y: 540 - EXIT_ZONE_DEPTH, width: 160, height: EXIT_ZONE_DEPTH },
      targetRoomId: "whirlpool-depths",
      targetSpawnPoint: { x: 480, y: T + 48 },
    },
  ],
  gates: [
    // Redaction gate blocking forward progress
    {
      id: "ml_gate_redact",
      rect: { x: 200, y: 540 - T - GATE_HEIGHT, width: GATE_WIDTH, height: GATE_HEIGHT },
      requiredAbility: "redaction",
      lockedColor: "#ef4444",
      opened: false,
    },
  ],
  enemies: [
    {
      id: "ml_reader_sc_1",
      position: { x: 1600, y: 540 - T },
      type: "reader",
      patrolRange: 100,
      groundY: 540 - T,
      facingRight: false,
    },
    {
      id: "ml_proofwarden_sc_1",
      position: { x: 850, y: 540 - T },
      type: "proofwarden",
      groundY: 540 - T,
      facingRight: true,
    },
    {
      id: "ml_proofwarden_sc_2",
      position: { x: 1500, y: 540 - T },
      type: "proofwarden",
      groundY: 540 - T,
      facingRight: false,
    },
  ],
  vineAnchors: [],
  currentZones: [
    // Gust 1: updraft
    {
      id: "ml_gust_sc_1",
      rect: { x: 300, y: 100, width: 250, height: 400 },
      direction: { x: 0, y: -1 },
      strength: 600,
      type: "gust",
      gustOnDuration: 2.0,
      gustOffDuration: 1.5,
      gustOffset: 0.0,
    },
    // Gust 2: downdraft
    {
      id: "ml_gust_sc_2",
      rect: { x: 600, y: 100, width: 250, height: 400 },
      direction: { x: 0, y: 1 },
      strength: 500,
      type: "gust",
      gustOnDuration: 1.5,
      gustOffDuration: 2.0,
      gustOffset: 0.8,
    },
    // Gust 3: updraft
    {
      id: "ml_gust_sc_3",
      rect: { x: 1000, y: 100, width: 250, height: 400 },
      direction: { x: 0, y: -1 },
      strength: 650,
      type: "gust",
      gustOnDuration: 2.0,
      gustOffDuration: 1.0,
      gustOffset: 1.5,
    },
    // Gust 4: rightward push + slight updraft
    {
      id: "ml_gust_sc_4",
      rect: { x: 1400, y: 200, width: 300, height: 300 },
      direction: { x: 0.7, y: -0.7 },
      strength: 550,
      type: "gust",
      gustOnDuration: 2.5,
      gustOffDuration: 1.5,
      gustOffset: 0.5,
    },
  ],
  healthPickups: [
    { id: "sc_hp_1", position: { x: 760, y: 240 }, healAmount: 1 },
  ],
};

// ─── Room 6: Whirlpool Depths (1440×1080) — Double Whirlpool Puzzle ──

const WHIRLPOOL_DEPTHS: RoomData = {
  id: "whirlpool-depths",
  name: "Whirlpool Depths",
  width: 1440,
  height: 1080,
  biomeId: "maritime-ledger",
  defaultSpawn: { x: 100, y: 1080 - 64 - T },
  platforms: [
    // Floor segments (islands around whirlpools)
    { x: 0, y: 1080 - T, width: 400, height: T },
    { x: 550, y: 1080 - T, width: 300, height: T },
    { x: 1050, y: 1080 - T, width: 390, height: T },
    // Ceiling (gap for top exit)
    { x: 0, y: 0, width: 400, height: T },
    { x: 560, y: 0, width: 880, height: T },
    // Left wall
    { x: 0, y: 0, width: T, height: 1080 },
    // Right wall (gap for right exit)
    { x: 1440 - T, y: 0, width: T, height: 1080 - 128 },
    { x: 1440 - T, y: 1080 - 64, width: T, height: 64 },

    // Central island between whirlpools
    { x: 580, y: 580, width: 280, height: T },
    // Small platforms at whirlpool edges
    { x: 80, y: 560, width: 96, height: T },
    { x: 450, y: 420, width: 96, height: T },
    { x: 880, y: 380, width: 96, height: T },
    { x: 1200, y: 300, width: 128, height: T },

    // Exit platform (upper right)
    { x: 1200, y: 1080 - T - 128, width: 208, height: T },
  ],
  obstacles: [],
  exits: [
    // Top → storm-channel
    {
      direction: "top",
      zone: { x: 400, y: 0, width: 160, height: EXIT_ZONE_DEPTH },
      targetRoomId: "storm-channel",
      targetSpawnPoint: { x: 800, y: 540 - 64 - T },
    },
    // Right → lighthouse-tower
    {
      direction: "right",
      zone: { x: 1440 - EXIT_ZONE_DEPTH, y: 1080 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "lighthouse-tower",
      targetSpawnPoint: { x: 64, y: 1080 - 64 - T },
    },
  ],
  gates: [],
  enemies: [
    {
      id: "ml_reader_wd_1",
      position: { x: 200, y: 1080 - T },
      type: "reader",
      patrolRange: 100,
      groundY: 1080 - T,
      facingRight: true,
    },
    {
      id: "ml_reader_wd_2",
      position: { x: 650, y: 580 },
      type: "reader",
      patrolRange: 80,
      groundY: 580,
      facingRight: false,
    },
    {
      id: "ml_binder_wd_1",
      position: { x: 120, y: 560 },
      type: "binder",
      patrolRange: 40,
      groundY: 560,
      facingRight: true,
    },
    {
      id: "ml_proofwarden_wd_1",
      position: { x: 1250, y: 1080 - T - 128 },
      type: "proofwarden",
      groundY: 1080 - T - 128,
      facingRight: false,
    },
  ],
  vineAnchors: [],
  currentZones: [
    // Whirlpool 1: lower-left, clockwise
    {
      id: "ml_whirlpool_wd_1",
      rect: { x: 100, y: 600, width: 500, height: 400 },
      direction: { x: 0, y: 0 },
      strength: 350,
      type: "whirlpool",
      clockwise: true,
    },
    // Whirlpool 2: upper-right, counter-clockwise
    {
      id: "ml_whirlpool_wd_2",
      rect: { x: 800, y: 200, width: 500, height: 400 },
      direction: { x: 0, y: 0 },
      strength: 300,
      type: "whirlpool",
      clockwise: false,
    },
    // Jet: launcher between whirlpools
    {
      id: "ml_jet_wd_1",
      rect: { x: 650, y: 500, width: 100, height: 200 },
      direction: { x: 0.5, y: -1 },
      strength: 1000,
      type: "jet",
    },
  ],
};

// ─── Room 7: Lighthouse Tower (960×1080) — Vertical Gust Climb ───────

const LIGHTHOUSE_TOWER: RoomData = {
  id: "lighthouse-tower",
  name: "Lighthouse Tower",
  width: 960,
  height: 1080,
  biomeId: "maritime-ledger",
  defaultSpawn: { x: 480, y: 1080 - 64 - T },
  platforms: [
    // Floor
    { x: 0, y: 1080 - T, width: 960, height: T },
    // Ceiling
    { x: 0, y: 0, width: 960, height: T },
    // Left wall (gap for left exit at bottom)
    { x: 0, y: 0, width: T, height: 1080 - 128 },
    { x: 0, y: 1080 - 64, width: T, height: 64 },
    // Right wall (gap for right exit at top)
    { x: 960 - T, y: 0, width: T, height: 200 },
    { x: 960 - T, y: 296, width: T, height: 784 },

    // Spiraling platforms upward
    { x: T, y: 920, width: 160, height: T },
    { x: 700, y: 840, width: 128, height: T },
    { x: 200, y: 740, width: 96, height: T },
    { x: 600, y: 640, width: 128, height: T },
    { x: T, y: 540, width: 128, height: T },
    { x: 500, y: 440, width: 96, height: T },
    { x: 800, y: 340, width: 96, height: T },
    { x: 300, y: 240, width: 128, height: T },

    // Top landing near right exit
    { x: 700, y: 160, width: 228, height: T },
  ],
  obstacles: [],
  exits: [
    // Left (bottom) → whirlpool-depths
    {
      direction: "left",
      zone: { x: 0, y: 1080 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "whirlpool-depths",
      targetSpawnPoint: { x: 1440 - 80, y: 1080 - 64 - T },
    },
    // Right (top) → tide-scribe-arena
    {
      direction: "right",
      zone: { x: 960 - EXIT_ZONE_DEPTH, y: 200, width: EXIT_ZONE_DEPTH, height: 96 },
      targetRoomId: "tide-scribe-arena",
      targetSpawnPoint: { x: 100, y: 1080 - 64 - T },
    },
  ],
  gates: [],
  enemies: [
    {
      id: "ml_proofwarden_lt_1",
      position: { x: 200, y: 540 },
      type: "proofwarden",
      groundY: 540,
      facingRight: true,
    },
    {
      id: "ml_proofwarden_lt_2",
      position: { x: 750, y: 160 },
      type: "proofwarden",
      groundY: 160,
      facingRight: false,
    },
  ],
  vineAnchors: [],
  currentZones: [
    // Gust 1: lower section, strong updraft
    {
      id: "ml_gust_lt_1",
      rect: { x: 300, y: 700, width: 300, height: 300 },
      direction: { x: 0, y: -1 },
      strength: 650,
      type: "gust",
      gustOnDuration: 3.0,
      gustOffDuration: 1.5,
      gustOffset: 0.0,
    },
    // Gust 2: mid section, moderate
    {
      id: "ml_gust_lt_2",
      rect: { x: 500, y: 400, width: 250, height: 300 },
      direction: { x: 0, y: -1 },
      strength: 550,
      type: "gust",
      gustOnDuration: 2.0,
      gustOffDuration: 2.0,
      gustOffset: 1.0,
    },
    // Gust 3: upper section, strong but short
    {
      id: "ml_gust_lt_3",
      rect: { x: 200, y: 100, width: 300, height: 250 },
      direction: { x: 0, y: -1 },
      strength: 700,
      type: "gust",
      gustOnDuration: 1.5,
      gustOffDuration: 2.5,
      gustOffset: 2.0,
    },
  ],
  healthPickups: [
    { id: "lt_hp_1", position: { x: 500, y: 420 }, healAmount: 1 },
  ],
};

// ─── Room 8: Tide Scribe's Dock (1440×1080) — Mini-Boss Arena ────────

const TIDE_SCRIBE_ARENA: RoomData = {
  id: "tide-scribe-arena",
  name: "Tide Scribe's Dock",
  width: 1440,
  height: 1080,
  biomeId: "maritime-ledger",
  defaultSpawn: { x: 100, y: 1080 - 64 - T },
  platforms: [
    // Floor — full width for boss patrol
    { x: 0, y: 1080 - T, width: 1440, height: T },
    // Ceiling
    { x: 0, y: 0, width: 1440, height: T },
    // Left wall (gap for left exit)
    { x: 0, y: 0, width: T, height: 1080 - 128 },
    { x: 0, y: 1080 - 64, width: T, height: 64 },
    // Right wall
    { x: 1440 - T, y: 0, width: T, height: 1080 },

    // Elevated mid-height platforms for escaping current surges
    { x: 200, y: 680, width: 200, height: T },
    { x: 620, y: 600, width: 200, height: T },
    { x: 1040, y: 680, width: 200, height: T },

    // Stepping platforms near ceiling for aerial combat options
    { x: 400, y: 350, width: 128, height: T },
    { x: 800, y: 300, width: 128, height: T },
  ],
  obstacles: [],
  exits: [
    // Left → lighthouse-tower
    {
      direction: "left",
      zone: { x: 0, y: 1080 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "lighthouse-tower",
      targetSpawnPoint: { x: 960 - 80, y: 200 + 48 },
    },
  ],
  gates: [],
  enemies: [
    // Tide Scribe mini-boss — enhanced Proofwarden
    {
      id: "ml_tide_scribe",
      position: { x: 720, y: 1080 - T },
      type: "proofwarden",
      groundY: 1080 - T,
      facingRight: false,
    },
  ],
  vineAnchors: [],
  currentZones: [
    // Stream 1: lower half, initially rightward (reversal managed at runtime)
    {
      id: "ml_stream_ts_1",
      rect: { x: 200, y: 700, width: 1000, height: 300 },
      direction: { x: 1, y: 0 },
      strength: 300,
      type: "stream",
    },
    // Stream 2: upper half, initially leftward (reversal managed at runtime)
    {
      id: "ml_stream_ts_2",
      rect: { x: 200, y: 200, width: 1000, height: 300 },
      direction: { x: -1, y: 0 },
      strength: 250,
      type: "stream",
    },
  ],
};

// ─── Tide Scribe Mini-Boss Params ────────────────────────────────────

/** Tide Scribe mini-boss params — enhanced Proofwarden (3× HP, 1.5× speed, wider shield) */
export const TIDE_SCRIBE_PARAMS = {
  health: 18,
  moveSpeed: 120,
  chaseSpeed: 180,
  detectionRange: 300,
  slamWindup: 15,
  slamActiveFrames: 10,
  slamDamage: 3,
  slamKnockback: 500,
  shieldBlockAngle: 160,
  contactDamage: 2,
} as const;

// ─── Exports ─────────────────────────────────────────────────────────

/** All Maritime Ledger Wing room definitions keyed by ID */
export const MARITIME_LEDGER_ROOMS: Record<string, RoomData> = {
  "harbor-approach": HARBOR_APPROACH,
  "tide-pool-cavern": TIDE_POOL_CAVERN,
  "cargo-hold": CARGO_HOLD,
  "storm-channel": STORM_CHANNEL,
  "whirlpool-depths": WHIRLPOOL_DEPTHS,
  "lighthouse-tower": LIGHTHOUSE_TOWER,
  "tide-scribe-arena": TIDE_SCRIBE_ARENA,
};

/** All Maritime Ledger Wing room IDs */
export const MARITIME_LEDGER_ROOM_IDS = [
  "harbor-approach",
  "tide-pool-cavern",
  "cargo-hold",
  "storm-channel",
  "whirlpool-depths",
  "lighthouse-tower",
  "tide-scribe-arena",
] as const;
