// Gothic Errata Wing — 7 rooms featuring fog-of-war, input inversion, and input scramble zones
// Layout: crypt-entrance → gargoyle-gallery → bell-tower (MS gate) → [index-shrine]
//                                    ↓                                    ↓
//                         mirror-hall ← ← ← ← ← ← ← ← (Index Mark gate)
//                                    ↓
//                         scriptorium-ruin → collapsed-nave (Redaction gate) → eater-sanctum
// The 8th room (index-shrine) is defined in abilityShrineRooms.ts

import type { RoomData } from "./Room";
import { EXIT_ZONE_DEPTH, GATE_WIDTH, GATE_HEIGHT } from "./Room";

const T = 32; // tile size

// ─── Room 1: Crypt Entrance (1920×540) — Fog-of-War Introduction ──────

export const CRYPT_ENTRANCE: RoomData = {
  id: "crypt-entrance",
  name: "Crypt Entrance",
  width: 1920,
  height: 540,
  biomeId: "gothic-errata",
  defaultSpawn: { x: 64, y: 540 - 64 - T },
  platforms: [
    // Floor
    { x: 0, y: 540 - T, width: 1920, height: T },
    // Ceiling
    { x: 0, y: 0, width: 1920, height: T },
    // Left wall (gap for left exit near floor)
    { x: 0, y: 0, width: T, height: 540 - 128 },
    { x: 0, y: 540 - 64, width: T, height: 64 },
    // Right wall (gap for right exit near floor)
    { x: 1920 - T, y: 0, width: T, height: 540 - 128 },
    { x: 1920 - T, y: 540 - 64, width: T, height: 64 },
    // Elevated platforms at varying heights
    { x: 400, y: 380, width: 192, height: T },   // mid-left
    { x: 900, y: 340, width: 160, height: T },   // center
    { x: 1400, y: 360, width: 192, height: T },  // mid-right
  ],
  obstacles: [
    // Spike clusters on floor inside fog zone
    {
      id: "ce_spikes_1",
      rect: { x: 800, y: 540 - T - T, width: 128, height: T },
      type: "spikes",
      damage: 15,
      solid: false,
    },
    {
      id: "ce_spikes_2",
      rect: { x: 1200, y: 540 - T - T, width: 96, height: T },
      type: "spikes",
      damage: 15,
      solid: false,
    },
  ],
  exits: [
    // Left → upper-archives (Central Archives)
    {
      direction: "left",
      zone: { x: 0, y: 540 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "upper-archives",
      targetSpawnPoint: { x: 1920 - 80, y: 540 - 64 - T },
    },
    // Right → gargoyle-gallery
    {
      direction: "right",
      zone: { x: 1920 - EXIT_ZONE_DEPTH, y: 540 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "gargoyle-gallery",
      targetSpawnPoint: { x: 64, y: 1080 - 64 - T },
    },
  ],
  gates: [],
  enemies: [
    // Reader on center platform, ambushes from fog
    {
      id: "ce_reader_1",
      position: { x: 960, y: 340 },
      type: "reader",
      patrolRange: 70,
      groundY: 340,
      facingRight: false,
    },
  ],
  vineAnchors: [],
  fogZones: [
    // Large fog zone covering center-right portion — player enters from clear left side
    {
      id: "ce_fog_1",
      rect: { x: 600, y: T, width: 1000, height: 540 - 2 * T },
      type: "fog",
      density: 0.6,
    },
  ],
};

// ─── Room 2: Gargoyle Gallery (1920×1080) — Fog + First Inversion ──────

export const GARGOYLE_GALLERY: RoomData = {
  id: "gargoyle-gallery",
  name: "Gargoyle Gallery",
  width: 1920,
  height: 1080,
  biomeId: "gothic-errata",
  defaultSpawn: { x: 64, y: 1080 - 64 - T },
  platforms: [
    // Floor (gap at right for bottom exit to mirror-hall)
    { x: 0, y: 1080 - T, width: 1600, height: T },
    { x: 1760, y: 1080 - T, width: 160, height: T },
    // Ceiling (gap for top exit to bell-tower, centered ~400px)
    { x: 0, y: 0, width: 760, height: T },
    { x: 1160, y: 0, width: 760, height: T },
    // Left wall (gap for left exit)
    { x: 0, y: 0, width: T, height: 1080 - 128 },
    { x: 0, y: 1080 - 64, width: T, height: 64 },
    // Right wall (solid — no right exit)
    { x: 1920 - T, y: 0, width: T, height: 1080 },
    // Interior staircase platforms (ascending left to right)
    { x: 200, y: 800, width: 256, height: T },
    { x: 550, y: 650, width: 192, height: T },
    { x: 900, y: 500, width: 256, height: T },
    { x: 1250, y: 400, width: 192, height: T },
    { x: 1500, y: 280, width: 256, height: T },
    // Central column dividing lower portion
    { x: 920, y: 500, width: 64, height: 580 },
  ],
  obstacles: [
    // Spike edges on central column
    {
      id: "gg_spikes_l",
      rect: { x: 884, y: 500, width: T, height: 64 },
      type: "spikes",
      damage: 10,
      solid: false,
    },
    {
      id: "gg_spikes_r",
      rect: { x: 988, y: 500, width: T, height: 64 },
      type: "spikes",
      damage: 10,
      solid: false,
    },
  ],
  exits: [
    // Left → crypt-entrance
    {
      direction: "left",
      zone: { x: 0, y: 1080 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "crypt-entrance",
      targetSpawnPoint: { x: 1920 - 80, y: 540 - 64 - T },
    },
    // Top → bell-tower (centered gap)
    {
      direction: "top",
      zone: { x: 760, y: 0, width: 400, height: EXIT_ZONE_DEPTH },
      targetRoomId: "bell-tower",
      targetSpawnPoint: { x: 480, y: 1080 - 64 - T },
    },
    // Bottom (right side) → mirror-hall (blocked by Index Mark gate)
    {
      direction: "bottom",
      zone: { x: 1600, y: 1080 - EXIT_ZONE_DEPTH, width: 160, height: EXIT_ZONE_DEPTH },
      targetRoomId: "mirror-hall",
      targetSpawnPoint: { x: 64, y: 540 - 64 - T },
    },
  ],
  gates: [
    // Index Mark gate at bottom exit to mirror-hall
    {
      id: "gg_gate_index",
      rect: { x: 1672, y: 1080 - T - GATE_HEIGHT, width: GATE_WIDTH, height: GATE_HEIGHT },
      requiredAbility: "index-mark",
      lockedColor: "#a78bfa",
      opened: false,
    },
  ],
  enemies: [
    // Reader on ascending platform
    {
      id: "gg_reader_1",
      position: { x: 600, y: 650 },
      type: "reader",
      patrolRange: 80,
      groundY: 650,
      facingRight: true,
    },
    // Reader on upper platform
    {
      id: "gg_reader_2",
      position: { x: 1300, y: 400 },
      type: "reader",
      patrolRange: 80,
      groundY: 400,
      facingRight: false,
    },
    // Binder on center platform — controls the area
    {
      id: "gg_binder_1",
      position: { x: 960, y: 500 },
      type: "binder",
      patrolRange: 100,
      groundY: 500,
      facingRight: true,
    },
  ],
  vineAnchors: [],
  fogZones: [
    // Lower-left fog zone
    {
      id: "gg_fog_1",
      rect: { x: 0, y: 600, width: 900, height: 480 },
      type: "fog",
      density: 0.7,
    },
    // Upper-right fog zone
    {
      id: "gg_fog_2",
      rect: { x: 1000, y: 0, width: 920, height: 500 },
      type: "fog",
      density: 0.8,
    },
    // Central inversion band
    {
      id: "gg_inversion_1",
      rect: { x: 600, y: 400, width: 700, height: 200 },
      type: "inversion",
      density: 0,
    },
  ],
};

// ─── Room 3: Bell Tower (960×1080) — Vertical Climb with Scramble ──────

export const BELL_TOWER: RoomData = {
  id: "bell-tower",
  name: "Bell Tower",
  width: 960,
  height: 1080,
  biomeId: "gothic-errata",
  defaultSpawn: { x: 480, y: 1080 - 64 - T },
  platforms: [
    // Floor (gap for bottom exit to gargoyle-gallery)
    { x: 0, y: 1080 - T, width: 400, height: T },
    { x: 560, y: 1080 - T, width: 400, height: T },
    // Ceiling (gap for top exit to index-shrine)
    { x: 0, y: 0, width: 300, height: T },
    { x: 660, y: 0, width: 300, height: T },
    // Left wall (solid)
    { x: 0, y: 0, width: T, height: 1080 },
    // Right wall (gap for right exit — bell-tower connects to index-shrine via right)
    { x: 960 - T, y: 0, width: T, height: 518 },
    { x: 960 - T, y: 618, width: T, height: 462 },
    // Ascending zigzag platforms
    { x: 64, y: 900, width: 192, height: T },
    { x: 700, y: 780, width: 192, height: T },
    { x: 128, y: 650, width: 192, height: T },
    { x: 600, y: 530, width: 256, height: T },  // scramble zone starts here
    { x: 64, y: 400, width: 192, height: T },
    { x: 700, y: 280, width: 192, height: T },
    { x: 128, y: 160, width: 256, height: T },   // near top exit
  ],
  obstacles: [
    // Spikes on left wall at scramble zone height
    {
      id: "bt_spikes_l",
      rect: { x: T, y: 500, width: T, height: 96 },
      type: "spikes",
      damage: 15,
      solid: false,
    },
    // Spikes on right wall at scramble zone height
    {
      id: "bt_spikes_r",
      rect: { x: 960 - 2 * T, y: 500, width: T, height: 96 },
      type: "spikes",
      damage: 15,
      solid: false,
    },
    // Spike strip between platforms
    {
      id: "bt_spikes_mid",
      rect: { x: 350, y: 650, width: 64, height: T },
      type: "spikes",
      damage: 10,
      solid: false,
    },
  ],
  exits: [
    // Bottom → gargoyle-gallery
    {
      direction: "bottom",
      zone: { x: 400, y: 1080 - EXIT_ZONE_DEPTH, width: 160, height: EXIT_ZONE_DEPTH },
      targetRoomId: "gargoyle-gallery",
      targetSpawnPoint: { x: 960, y: T + 64 },
    },
    // Right → index-shrine (matches index-shrine's left exit to bell-tower)
    {
      direction: "right",
      zone: { x: 960 - EXIT_ZONE_DEPTH, y: 538, width: EXIT_ZONE_DEPTH, height: 80 },
      targetRoomId: "index-shrine",
      targetSpawnPoint: { x: T + 16, y: 518 + 32 },
    },
  ],
  gates: [
    // Margin Stitch gate at bottom exit (gargoyle-gallery side)
    {
      id: "bt_gate_ms",
      rect: { x: 472, y: 1080 - T - GATE_HEIGHT, width: GATE_WIDTH, height: GATE_HEIGHT },
      requiredAbility: "margin-stitch",
      lockedColor: "#22d3ee",
      opened: false,
    },
  ],
  enemies: [
    // Proofwarden on mid platform (shielded in fog)
    {
      id: "bt_pw_1",
      position: { x: 740, y: 780 },
      type: "proofwarden",
      groundY: 780,
      facingRight: false,
    },
    // Proofwarden on upper platform
    {
      id: "bt_pw_2",
      position: { x: 128, y: 400 },
      type: "proofwarden",
      groundY: 400,
      facingRight: true,
    },
  ],
  vineAnchors: [],
  fogZones: [
    // Fog covering most of tower
    {
      id: "bt_fog_1",
      rect: { x: 0, y: 200, width: 960, height: 700 },
      type: "fog",
      density: 0.7,
    },
    // Scramble zone mid-tower band
    {
      id: "bt_scramble_1",
      rect: { x: 0, y: 450, width: 960, height: 250 },
      type: "scramble",
      density: 0,
    },
  ],
};

// ─── Room 4: index-shrine is defined in abilityShrineRooms.ts ──────────
// Exits: left → bell-tower, top → mirror-hall

// ─── Room 5: Mirror Hall (1920×540) — Triple Inversion ─────────────────

export const MIRROR_HALL: RoomData = {
  id: "mirror-hall",
  name: "Mirror Hall",
  width: 1920,
  height: 540,
  biomeId: "gothic-errata",
  defaultSpawn: { x: 64, y: 540 - 64 - T },
  platforms: [
    // Floor
    { x: 0, y: 540 - T, width: 1920, height: T },
    // Ceiling (gap for top exit to index-shrine)
    { x: 0, y: 0, width: 400, height: T },
    { x: 560, y: 0, width: 1360, height: T },
    // Left wall (gap for left entry from gargoyle-gallery)
    { x: 0, y: 0, width: T, height: 540 - 128 },
    { x: 0, y: 540 - 64, width: T, height: 64 },
    // Right wall (gap for right exit to scriptorium-ruin)
    { x: 1920 - T, y: 0, width: T, height: 540 - 128 },
    { x: 1920 - T, y: 540 - 64, width: T, height: 64 },
    // Floating platforms
    { x: 300, y: 380, width: 128, height: T },
    { x: 700, y: 320, width: 128, height: T },
    { x: 1100, y: 360, width: 128, height: T },
    { x: 1500, y: 300, width: 128, height: T },
  ],
  obstacles: [
    // Spike strip on floor between inversions
    {
      id: "mh_spikes_1",
      rect: { x: 600, y: 540 - T - T, width: 100, height: T },
      type: "spikes",
      damage: 15,
      solid: false,
    },
    {
      id: "mh_spikes_2",
      rect: { x: 1200, y: 540 - T - T, width: 100, height: T },
      type: "spikes",
      damage: 15,
      solid: false,
    },
    // Laser at mid-height
    {
      id: "mh_laser_1",
      rect: { x: 400, y: 250, width: 200, height: 8 },
      type: "laser",
      damage: 10,
      solid: false,
    },
  ],
  exits: [
    // Left → gargoyle-gallery (bottom exit)
    {
      direction: "left",
      zone: { x: 0, y: 540 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "gargoyle-gallery",
      targetSpawnPoint: { x: 1660, y: 1080 - 64 - T },
    },
    // Top → index-shrine
    {
      direction: "top",
      zone: { x: 400, y: 0, width: 160, height: EXIT_ZONE_DEPTH },
      targetRoomId: "index-shrine",
      targetSpawnPoint: { x: 480, y: 1080 - 64 - T },
    },
    // Right → scriptorium-ruin
    {
      direction: "right",
      zone: { x: 1920 - EXIT_ZONE_DEPTH, y: 540 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "scriptorium-ruin",
      targetSpawnPoint: { x: 64, y: 1080 - 64 - T },
    },
  ],
  gates: [
    // Index Mark gate at left entry
    {
      id: "mh_gate_index",
      rect: { x: T + 16, y: 540 - T - GATE_HEIGHT, width: GATE_WIDTH, height: GATE_HEIGHT },
      requiredAbility: "index-mark",
      lockedColor: "#a78bfa",
      opened: false,
    },
  ],
  enemies: [
    // Readers patrolling floor in inversion zones
    {
      id: "mh_reader_1",
      position: { x: 300, y: 540 - T },
      type: "reader",
      patrolRange: 100,
      groundY: 540 - T,
      facingRight: true,
    },
    {
      id: "mh_reader_2",
      position: { x: 1400, y: 540 - T },
      type: "reader",
      patrolRange: 100,
      groundY: 540 - T,
      facingRight: false,
    },
    // Binder on elevated platform — grapple while player is inverted
    {
      id: "mh_binder_1",
      position: { x: 740, y: 320 },
      type: "binder",
      patrolRange: 60,
      groundY: 320,
      facingRight: true,
    },
  ],
  vineAnchors: [],
  fogZones: [
    // Inversion 1 — left portion
    {
      id: "mh_inv_1",
      rect: { x: 100, y: T, width: 500, height: 540 - 2 * T },
      type: "inversion",
      density: 0,
    },
    // Inversion 2 — center
    {
      id: "mh_inv_2",
      rect: { x: 700, y: T, width: 500, height: 540 - 2 * T },
      type: "inversion",
      density: 0,
    },
    // Inversion 3 — right
    {
      id: "mh_inv_3",
      rect: { x: 1300, y: T, width: 520, height: 540 - 2 * T },
      type: "inversion",
      density: 0,
    },
  ],
};

// ─── Room 6: Scriptorium Ruin (1440×1080) — Dense Combat + Fog ─────────

export const SCRIPTORIUM_RUIN: RoomData = {
  id: "scriptorium-ruin",
  name: "Scriptorium Ruin",
  width: 1440,
  height: 1080,
  biomeId: "gothic-errata",
  defaultSpawn: { x: 64, y: 1080 - 64 - T },
  platforms: [
    // Floor
    { x: 0, y: 1080 - T, width: 1440, height: T },
    // Ceiling
    { x: 0, y: 0, width: 1440, height: T },
    // Left wall (gap for left exit from mirror-hall)
    { x: 0, y: 0, width: T, height: 1080 - 128 },
    { x: 0, y: 1080 - 64, width: T, height: 64 },
    // Right wall (gap for right exit to collapsed-nave)
    { x: 1440 - T, y: 0, width: T, height: 1080 - 128 },
    { x: 1440 - T, y: 1080 - 64, width: T, height: 64 },
    // Multi-level arena platforms
    { x: 200, y: 800, width: 320, height: T },    // lower-left
    { x: 800, y: 800, width: 320, height: T },    // lower-right
    { x: 100, y: 600, width: 256, height: T },    // mid-left
    { x: 600, y: 550, width: 256, height: T },    // mid-center
    { x: 1100, y: 600, width: 256, height: T },   // mid-right
    { x: 400, y: 350, width: 320, height: T },    // upper-center
    { x: 900, y: 300, width: 320, height: T },    // upper-right
  ],
  obstacles: [
    // Spike clusters on floor
    {
      id: "sr_spikes_1",
      rect: { x: 150, y: 1080 - T - T, width: 96, height: T },
      type: "spikes",
      damage: 15,
      solid: false,
    },
    {
      id: "sr_spikes_2",
      rect: { x: 650, y: 1080 - T - T, width: 96, height: T },
      type: "spikes",
      damage: 15,
      solid: false,
    },
    {
      id: "sr_spikes_3",
      rect: { x: 1200, y: 1080 - T - T, width: 96, height: T },
      type: "spikes",
      damage: 15,
      solid: false,
    },
    // Mid-center barrier (can be redacted for shortcut)
    {
      id: "sr_barrier_1",
      rect: { x: 680, y: 550, width: T, height: 96 },
      type: "barrier",
      damage: 0,
      solid: true,
    },
  ],
  exits: [
    // Left → mirror-hall
    {
      direction: "left",
      zone: { x: 0, y: 1080 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "mirror-hall",
      targetSpawnPoint: { x: 1920 - 80, y: 540 - 64 - T },
    },
    // Right → collapsed-nave
    {
      direction: "right",
      zone: { x: 1440 - EXIT_ZONE_DEPTH, y: 1080 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "collapsed-nave",
      targetSpawnPoint: { x: 64, y: 1080 - 64 - T },
    },
  ],
  gates: [],
  enemies: [
    // Readers scattered across lower platforms
    {
      id: "sr_reader_1",
      position: { x: 300, y: 800 },
      type: "reader",
      patrolRange: 100,
      groundY: 800,
      facingRight: true,
    },
    {
      id: "sr_reader_2",
      position: { x: 900, y: 800 },
      type: "reader",
      patrolRange: 100,
      groundY: 800,
      facingRight: false,
    },
    {
      id: "sr_reader_3",
      position: { x: 500, y: 1080 - T },
      type: "reader",
      patrolRange: 80,
      groundY: 1080 - T,
      facingRight: true,
    },
    // Binders on mid-level
    {
      id: "sr_binder_1",
      position: { x: 150, y: 600 },
      type: "binder",
      patrolRange: 80,
      groundY: 600,
      facingRight: true,
    },
    {
      id: "sr_binder_2",
      position: { x: 1150, y: 600 },
      type: "binder",
      patrolRange: 80,
      groundY: 600,
      facingRight: false,
    },
  ],
  vineAnchors: [],
  fogZones: [
    // Lower half — very dense fog
    {
      id: "sr_fog_1",
      rect: { x: 0, y: 550, width: 1440, height: 530 },
      type: "fog",
      density: 0.8,
    },
    // Upper area — even denser fog
    {
      id: "sr_fog_2",
      rect: { x: 0, y: 100, width: 1440, height: 400 },
      type: "fog",
      density: 0.9,
    },
    // Scramble band between fog zones
    {
      id: "sr_scramble_1",
      rect: { x: 300, y: 450, width: 800, height: 150 },
      type: "scramble",
      density: 0,
    },
  ],
};

// ─── Room 7: Collapsed Nave (960×1080) — Vertical + Inversion ──────────

export const COLLAPSED_NAVE: RoomData = {
  id: "collapsed-nave",
  name: "Collapsed Nave",
  width: 960,
  height: 1080,
  biomeId: "gothic-errata",
  defaultSpawn: { x: 64, y: 1080 - 64 - T },
  platforms: [
    // Floor
    { x: 0, y: 1080 - T, width: 960, height: T },
    // Ceiling
    { x: 0, y: 0, width: 960, height: T },
    // Left wall (gap for left exit from scriptorium-ruin)
    { x: 0, y: 0, width: T, height: 1080 - 128 },
    { x: 0, y: 1080 - 64, width: T, height: 64 },
    // Right wall (gap for right exit to eater-sanctum)
    { x: 960 - T, y: 0, width: T, height: 300 },
    { x: 960 - T, y: 500, width: T, height: 580 },
    // Vertical platforms (ascending)
    { x: 64, y: 900, width: 256, height: T },     // bottom-left
    { x: 640, y: 800, width: 256, height: T },    // bottom-right
    { x: 200, y: 650, width: 192, height: T },    // mid-left
    { x: 600, y: 500, width: 192, height: T },    // mid-right (inversion zone)
    { x: 128, y: 350, width: 256, height: T },    // upper-left (inversion zone)
    { x: 640, y: 200, width: 256, height: T },    // upper-right (near exit)
  ],
  obstacles: [
    // Redactable barrier blocking right exit
    {
      id: "cn_barrier_1",
      rect: { x: 750, y: 350, width: T, height: 128 },
      type: "barrier",
      damage: 0,
      solid: true,
    },
    // Spikes on walls inside inversion zones
    {
      id: "cn_spikes_l",
      rect: { x: T, y: 500, width: T, height: 64 },
      type: "spikes",
      damage: 15,
      solid: false,
    },
    {
      id: "cn_spikes_r",
      rect: { x: 960 - 2 * T, y: 350, width: T, height: 64 },
      type: "spikes",
      damage: 15,
      solid: false,
    },
  ],
  exits: [
    // Left → scriptorium-ruin
    {
      direction: "left",
      zone: { x: 0, y: 1080 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "scriptorium-ruin",
      targetSpawnPoint: { x: 1440 - 80, y: 1080 - 64 - T },
    },
    // Right → eater-sanctum (through Redaction gate)
    {
      direction: "right",
      zone: { x: 960 - EXIT_ZONE_DEPTH, y: 320, width: EXIT_ZONE_DEPTH, height: 80 },
      targetRoomId: "eater-sanctum",
      targetSpawnPoint: { x: 64, y: 1080 - 64 - T },
    },
  ],
  gates: [
    // Redaction gate at right exit to eater-sanctum
    {
      id: "cn_gate_redact",
      rect: { x: 960 - T - GATE_WIDTH, y: 320, width: GATE_WIDTH, height: GATE_HEIGHT },
      requiredAbility: "redaction",
      lockedColor: "#ef4444",
      opened: false,
    },
  ],
  enemies: [
    // Proofwarden on upper-left platform — shields in inversion zone
    {
      id: "cn_pw_1",
      position: { x: 200, y: 350 },
      type: "proofwarden",
      groundY: 350,
      facingRight: true,
    },
    // Binder on mid-right platform — grapple in fog
    {
      id: "cn_binder_1",
      position: { x: 650, y: 500 },
      type: "binder",
      patrolRange: 80,
      groundY: 500,
      facingRight: false,
    },
  ],
  vineAnchors: [],
  fogZones: [
    // Fog covering most of room
    {
      id: "cn_fog_1",
      rect: { x: 0, y: 200, width: 960, height: 700 },
      type: "fog",
      density: 0.7,
    },
    // Inversion zone mid-right
    {
      id: "cn_inv_1",
      rect: { x: 480, y: 400, width: 480, height: 250 },
      type: "inversion",
      density: 0,
    },
    // Inversion zone upper-left
    {
      id: "cn_inv_2",
      rect: { x: 0, y: 200, width: 480, height: 250 },
      type: "inversion",
      density: 0,
    },
  ],
};

// ─── Room 8: Eater's Sanctum (1440×1080) — Boss Arena ──────────────────

const EATER_SANCTUM_BOSS_GATE_RECT = {
  x: 1440 - T - 16,
  y: 700,
  width: 16,
  height: 380,
};

export const EATER_SANCTUM: RoomData = {
  id: "eater-sanctum",
  name: "Eater's Sanctum",
  width: 1440,
  height: 1080,
  biomeId: "gothic-errata",
  defaultSpawn: { x: 64, y: 1080 - 64 - T },
  platforms: [
    // Floor left segment
    { x: 0, y: 1080 - T, width: 600, height: T },
    // Floor right segment
    { x: 840, y: 1080 - T, width: 600, height: T },
    // Ceiling
    { x: 0, y: 0, width: 1440, height: T },
    // Left wall (gap for left exit from collapsed-nave)
    { x: 0, y: 0, width: T, height: 1080 - 128 },
    { x: 0, y: 1080 - 64, width: T, height: 64 },
    // Right wall (gap for right exit — boss gate blocks it)
    { x: 1440 - T, y: 0, width: T, height: 700 },
    { x: 1440 - T, y: 1080 - 64, width: T, height: 64 },
    // Mid-level platforms (destructible by boss)
    { x: 200, y: 700, width: 256, height: T },   // mid_1
    { x: 600, y: 600, width: 256, height: T },   // mid_2
    { x: 1000, y: 700, width: 256, height: T },  // mid_3
    { x: 400, y: 450, width: 256, height: T },   // mid_4
    // High platforms (destructible by boss)
    { x: 100, y: 300, width: 192, height: T },   // high_1
    { x: 600, y: 250, width: 256, height: T },   // high_2
    { x: 1100, y: 300, width: 192, height: T },  // high_3
    // Post-boss blocking platform (removed when Index Eater is defeated)
    {
      x: EATER_SANCTUM_BOSS_GATE_RECT.x,
      y: EATER_SANCTUM_BOSS_GATE_RECT.y,
      width: EATER_SANCTUM_BOSS_GATE_RECT.width,
      height: EATER_SANCTUM_BOSS_GATE_RECT.height,
    },
  ],
  obstacles: [],
  exits: [
    // Left → collapsed-nave
    {
      direction: "left",
      zone: { x: 0, y: 1080 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "collapsed-nave",
      targetSpawnPoint: { x: 960 - 80, y: 1080 - 64 - T },
    },
    // Right → scribe-hall (post-boss shortcut, blocked by boss gate)
    {
      direction: "right",
      zone: { x: 1440 - EXIT_ZONE_DEPTH, y: 1080 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "scribe-hall",
      targetSpawnPoint: { x: 64, y: 1080 - 64 - T },
    },
  ],
  gates: [],
  enemies: [
    // Index Eater boss (on right floor segment, facing the arena center)
    {
      id: "es_index_eater",
      position: { x: 900, y: 1080 - T },
      type: "boss",
      bossId: "index-eater",
      groundY: 1080 - T,
      facingRight: false,
    },
  ],
  vineAnchors: [],
  bossGate: {
    bossId: "index-eater",
    platformRect: EATER_SANCTUM_BOSS_GATE_RECT,
  },
  fogZones: [
    // Lower half fog
    {
      id: "es_fog_1",
      rect: { x: 0, y: 550, width: 1440, height: 530 },
      type: "fog",
      density: 0.7,
    },
    // Upper half fog
    {
      id: "es_fog_2",
      rect: { x: 0, y: 0, width: 1440, height: 500 },
      type: "fog",
      density: 0.8,
    },
  ],
};

// ─── Exports ─────────────────────────────────────────────────────────

/** All Gothic Errata room definitions keyed by ID */
export const GOTHIC_ERRATA_ROOMS: Record<string, RoomData> = {
  "crypt-entrance": CRYPT_ENTRANCE,
  "gargoyle-gallery": GARGOYLE_GALLERY,
  "bell-tower": BELL_TOWER,
  "mirror-hall": MIRROR_HALL,
  "scriptorium-ruin": SCRIPTORIUM_RUIN,
  "collapsed-nave": COLLAPSED_NAVE,
  "eater-sanctum": EATER_SANCTUM,
};

/** All Gothic Errata room IDs */
export const GOTHIC_ERRATA_ROOM_IDS = [
  "crypt-entrance",
  "gargoyle-gallery",
  "bell-tower",
  "mirror-hall",
  "scriptorium-ruin",
  "collapsed-nave",
  "eater-sanctum",
] as const;
