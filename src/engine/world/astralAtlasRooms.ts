// Astral Atlas Wing — 7 rooms featuring low-gravity environments and gravity well mechanics
// Layout: observatory-bridge → star-chart-hall → constellation-path → [paste-shrine] → nebula-crossing → zero-g-vault → orrery-chamber → seraph-spire
// The 8th room (paste-shrine) is defined in abilityShrineRooms.ts and referenced via exit targetRoomId

import type { RoomData } from "./Room";
import { EXIT_ZONE_DEPTH, GATE_WIDTH, GATE_HEIGHT } from "./Room";

const T = 32; // tile size

// ─── Room 1: Observatory Bridge (1920×540) — Entry from Central Archives ─

export const OBSERVATORY_BRIDGE: RoomData = {
  id: "observatory-bridge",
  name: "Observatory Bridge",
  width: 1920,
  height: 540,
  biomeId: "astral-atlas",
  defaultSpawn: { x: 64, y: 540 - 64 - T },
  platforms: [
    // Floor
    { x: 0, y: 540 - T, width: 1920, height: T },
    // Ceiling
    { x: 0, y: 0, width: 1920, height: T },
    // Left wall (gap for left exit)
    { x: 0, y: 0, width: T, height: 540 - 128 },
    { x: 0, y: 540 - 64, width: T, height: 64 },
    // Right wall (gap for right exit)
    { x: 1920 - T, y: 0, width: T, height: 540 - 128 },
    { x: 1920 - T, y: 540 - 64, width: T, height: 64 },
    // Floating platforms (emphasis on low-grav)
    { x: 400, y: 360, width: 160, height: T },
    { x: 700, y: 280, width: 128, height: T },
    { x: 1000, y: 340, width: 192, height: T },
    { x: 1350, y: 260, width: 160, height: T },
    { x: 1600, y: 380, width: 128, height: T },
  ],
  obstacles: [],
  exits: [
    // Left → upper-archives (return to Central Archives)
    {
      direction: "left",
      zone: { x: 0, y: 540 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "upper-archives",
      targetSpawnPoint: { x: 960, y: 64 },
    },
    // Right → star-chart-hall
    {
      direction: "right",
      zone: { x: 1920 - EXIT_ZONE_DEPTH, y: 540 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "star-chart-hall",
      targetSpawnPoint: { x: 64, y: 1080 - 64 - T },
    },
  ],
  gates: [],
  enemies: [
    // Reader on mid-level platform
    {
      id: "ob_reader_1",
      position: { x: 1050, y: 340 - T },
      type: "reader",
      patrolRange: 96,
      groundY: 340,
      facingRight: true,
    },
  ],
  vineAnchors: [],
  gravityWells: [
    { id: "ob_attract_1", position: { x: 600, y: 320 }, radius: 200, strength: 150, type: "attract" },
    { id: "ob_attract_2", position: { x: 1200, y: 300 }, radius: 220, strength: 180, type: "attract" },
  ],
};

// ─── Room 2: Star Chart Hall (1920×1080) — Large Exploration Room ────

export const STAR_CHART_HALL: RoomData = {
  id: "star-chart-hall",
  name: "Star Chart Hall",
  width: 1920,
  height: 1080,
  biomeId: "astral-atlas",
  defaultSpawn: { x: 64, y: 1080 - 64 - T },
  platforms: [
    // Floor
    { x: 0, y: 1080 - T, width: 1920, height: T },
    // Ceiling
    { x: 0, y: 0, width: 1920, height: T },
    // Left wall (gap for left exit)
    { x: 0, y: 0, width: T, height: 1080 - 128 },
    { x: 0, y: 1080 - 64, width: T, height: 64 },
    // Right wall (gap for right exit)
    { x: 1920 - T, y: 0, width: T, height: 1080 - 128 },
    { x: 1920 - T, y: 1080 - 64, width: T, height: 64 },
    // Floating islands (constellation pattern)
    { x: 300, y: 800, width: 192, height: T },
    { x: 700, y: 650, width: 160, height: T },
    { x: 1100, y: 500, width: 192, height: T },
    { x: 500, y: 400, width: 128, height: T },
    { x: 900, y: 300, width: 160, height: T },
    { x: 1400, y: 350, width: 192, height: T },
    { x: 1600, y: 600, width: 160, height: T },
    { x: 1200, y: 800, width: 128, height: T },
  ],
  obstacles: [],
  exits: [
    // Left → observatory-bridge
    {
      direction: "left",
      zone: { x: 0, y: 1080 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "observatory-bridge",
      targetSpawnPoint: { x: 1920 - 80, y: 540 - 64 - T },
    },
    // Right → constellation-path
    {
      direction: "right",
      zone: { x: 1920 - EXIT_ZONE_DEPTH, y: 1080 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "constellation-path",
      targetSpawnPoint: { x: 64, y: 1080 - 64 - T },
    },
    // Bottom → nebula-crossing (alternate entry)
    {
      direction: "bottom",
      zone: { x: 880, y: 1080 - EXIT_ZONE_DEPTH, width: 160, height: EXIT_ZONE_DEPTH },
      targetRoomId: "nebula-crossing",
      targetSpawnPoint: { x: 64, y: 540 - 64 - T },
    },
  ],
  gates: [],
  enemies: [
    // Reader on lower-left island
    {
      id: "sch_reader_1",
      position: { x: 350, y: 800 },
      type: "reader",
      patrolRange: 80,
      groundY: 800,
      facingRight: true,
    },
    // Reader on mid-right island
    {
      id: "sch_reader_2",
      position: { x: 1640, y: 600 },
      type: "reader",
      patrolRange: 70,
      groundY: 600,
      facingRight: false,
    },
    // Binder on center platform
    {
      id: "sch_binder_1",
      position: { x: 1150, y: 500 },
      type: "binder",
      patrolRange: 80,
      groundY: 500,
      facingRight: false,
    },
  ],
  vineAnchors: [],
  gravityWells: [
    { id: "sch_attract_1", position: { x: 500, y: 550 }, radius: 250, strength: 200, type: "attract" },
    { id: "sch_attract_2", position: { x: 1300, y: 450 }, radius: 250, strength: 200, type: "attract" },
    { id: "sch_attract_3", position: { x: 900, y: 700 }, radius: 200, strength: 160, type: "attract" },
    { id: "sch_repel_1", position: { x: 960, y: 200 }, radius: 200, strength: 250, type: "repel" },
  ],
};

// ─── Room 3: Constellation Path (960×1080) — Vertical Ascent ─────────

export const CONSTELLATION_PATH: RoomData = {
  id: "constellation-path",
  name: "Constellation Path",
  width: 960,
  height: 1080,
  biomeId: "astral-atlas",
  defaultSpawn: { x: 64, y: 1080 - 64 - T },
  platforms: [
    // Floor
    { x: 0, y: 1080 - T, width: 960, height: T },
    // Left wall (gap for left exit)
    { x: 0, y: 0, width: T, height: 1080 - 128 },
    { x: 0, y: 1080 - 64, width: T, height: 64 },
    // Right wall (gap for right exit to shrine)
    { x: 960 - T, y: 0, width: T, height: 520 },
    { x: 960 - T, y: 620, width: T, height: 460 },
    // Ceiling
    { x: 0, y: 0, width: 960, height: T },
    // Floating platforms (ascending spiral)
    { x: 100, y: 900, width: 160, height: T },
    { x: 600, y: 750, width: 128, height: T },
    { x: 200, y: 600, width: 160, height: T },
    { x: 650, y: 450, width: 128, height: T },
    { x: 300, y: 300, width: 160, height: T },
    { x: 700, y: 180, width: 128, height: T },
  ],
  obstacles: [],
  exits: [
    // Left → star-chart-hall
    {
      direction: "left",
      zone: { x: 0, y: 1080 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "star-chart-hall",
      targetSpawnPoint: { x: 1920 - 80, y: 1080 - 64 - T },
    },
    // Right → paste-shrine
    {
      direction: "right",
      zone: { x: 960 - EXIT_ZONE_DEPTH, y: 540, width: EXIT_ZONE_DEPTH, height: 80 },
      targetRoomId: "paste-shrine",
      targetSpawnPoint: { x: 64, y: 1080 - 64 - T },
    },
  ],
  gates: [],
  enemies: [
    // Proofwarden on upper platform (shields + ranged challenge while climbing)
    {
      id: "cp_proofwarden_1",
      position: { x: 350, y: 300 },
      type: "proofwarden",
      groundY: 300,
      facingRight: true,
    },
  ],
  vineAnchors: [],
  gravityWells: [
    { id: "cp_attract_1", position: { x: 350, y: 820 }, radius: 180, strength: 180, type: "attract" },
    { id: "cp_attract_2", position: { x: 400, y: 660 }, radius: 180, strength: 180, type: "attract" },
    { id: "cp_attract_3", position: { x: 450, y: 500 }, radius: 180, strength: 200, type: "attract" },
    { id: "cp_attract_4", position: { x: 500, y: 300 }, radius: 180, strength: 200, type: "attract" },
  ],
};

// ─── Room 4: paste-shrine is defined in abilityShrineRooms.ts ────────
// Exits: bottom → constellation-path, top → nebula-crossing

// ─── Room 5: Nebula Crossing (1920×540) — Repel Well Gauntlet ────────

export const NEBULA_CROSSING: RoomData = {
  id: "nebula-crossing",
  name: "Nebula Crossing",
  width: 1920,
  height: 540,
  biomeId: "astral-atlas",
  defaultSpawn: { x: 64, y: 540 - 64 - T },
  platforms: [
    // Floor
    { x: 0, y: 540 - T, width: 1920, height: T },
    // Ceiling
    { x: 0, y: 0, width: 1920, height: T },
    // Left wall (gap for left exit)
    { x: 0, y: 0, width: T, height: 540 - 128 },
    { x: 0, y: 540 - 64, width: T, height: 64 },
    // Right wall (gap for right exit)
    { x: 1920 - T, y: 0, width: T, height: 540 - 128 },
    { x: 1920 - T, y: 540 - 64, width: T, height: 64 },
    // Floating platforms
    { x: 300, y: 380, width: 160, height: T },
    { x: 600, y: 300, width: 128, height: T, surfaceType: "bouncy" },
    { x: 900, y: 360, width: 192, height: T },
    { x: 1200, y: 280, width: 160, height: T },
    { x: 1500, y: 380, width: 128, height: T },
  ],
  obstacles: [
    // Ceiling spikes — repel wells push upward into these
    {
      id: "nc_spikes_1",
      rect: { x: 600, y: T, width: 300, height: T },
      type: "spikes",
      damage: 1,
      solid: false,
    },
    {
      id: "nc_spikes_2",
      rect: { x: 1200, y: T, width: 300, height: T },
      type: "spikes",
      damage: 1,
      solid: false,
    },
  ],
  exits: [
    // Left → star-chart-hall (alternate entry via bottom exit)
    {
      direction: "left",
      zone: { x: 0, y: 540 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "star-chart-hall",
      targetSpawnPoint: { x: 960, y: 1080 - 64 - T },
    },
    // Right → zero-g-vault
    {
      direction: "right",
      zone: { x: 1920 - EXIT_ZONE_DEPTH, y: 540 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "zero-g-vault",
      targetSpawnPoint: { x: 64, y: 1080 - 64 - T },
    },
  ],
  gates: [
    // Paste-Over gate blocking entry
    {
      id: "nc_gate_paste",
      rect: { x: 200, y: 540 - T - GATE_HEIGHT, width: GATE_WIDTH, height: GATE_HEIGHT },
      requiredAbility: "paste-over",
      lockedColor: "#f59e0b",
      opened: false,
    },
  ],
  enemies: [
    // Reader on safe island
    {
      id: "nc_reader_1",
      position: { x: 350, y: 380 },
      type: "reader",
      patrolRange: 70,
      groundY: 380,
      facingRight: true,
    },
    // Reader near exit
    {
      id: "nc_reader_2",
      position: { x: 1540, y: 380 },
      type: "reader",
      patrolRange: 60,
      groundY: 380,
      facingRight: false,
    },
    // Binder on mid rest point (thread + well combo)
    {
      id: "nc_binder_1",
      position: { x: 950, y: 360 },
      type: "binder",
      patrolRange: 80,
      groundY: 360,
      facingRight: true,
    },
  ],
  vineAnchors: [],
  gravityWells: [
    { id: "nc_repel_1", position: { x: 750, y: 270 }, radius: 200, strength: 220, type: "repel" },
    { id: "nc_repel_2", position: { x: 1350, y: 250 }, radius: 220, strength: 250, type: "repel" },
    { id: "nc_attract_1", position: { x: 500, y: 440 }, radius: 180, strength: 150, type: "attract" },
    { id: "nc_attract_2", position: { x: 1100, y: 440 }, radius: 180, strength: 150, type: "attract" },
  ],
};

// ─── Room 6: Zero-G Vault (960×1080) — Pure Low Gravity Combat ───────

export const ZERO_G_VAULT: RoomData = {
  id: "zero-g-vault",
  name: "Zero-G Vault",
  width: 960,
  height: 1080,
  biomeId: "astral-atlas",
  defaultSpawn: { x: 64, y: 1080 - 64 - T },
  platforms: [
    // Floor
    { x: 0, y: 1080 - T, width: 960, height: T },
    // Left wall (gap for left exit)
    { x: 0, y: 0, width: T, height: 1080 - 128 },
    { x: 0, y: 1080 - 64, width: T, height: 64 },
    // Right wall (gap for right exit)
    { x: 960 - T, y: 0, width: T, height: 480 },
    { x: 960 - T, y: 600, width: T, height: 480 },
    // Ceiling
    { x: 0, y: 0, width: 960, height: T },
    // Sparse floating platforms (combat arenas in the air)
    { x: 200, y: 850, width: 200, height: T },
    { x: 560, y: 700, width: 192, height: T },
    { x: 150, y: 550, width: 180, height: T },
    { x: 580, y: 400, width: 160, height: T },
    { x: 300, y: 250, width: 200, height: T },
  ],
  obstacles: [],
  exits: [
    // Left → nebula-crossing
    {
      direction: "left",
      zone: { x: 0, y: 1080 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "nebula-crossing",
      targetSpawnPoint: { x: 1920 - 80, y: 540 - 64 - T },
    },
    // Right → orrery-chamber
    {
      direction: "right",
      zone: { x: 960 - EXIT_ZONE_DEPTH, y: 520, width: EXIT_ZONE_DEPTH, height: 80 },
      targetRoomId: "orrery-chamber",
      targetSpawnPoint: { x: 64, y: 1080 - 64 - T },
    },
  ],
  gates: [],
  enemies: [
    // Proofwarden on separated platforms (shields in low-grav)
    {
      id: "zgv_proofwarden_1",
      position: { x: 250, y: 550 },
      type: "proofwarden",
      groundY: 550,
      facingRight: true,
    },
    {
      id: "zgv_proofwarden_2",
      position: { x: 620, y: 400 },
      type: "proofwarden",
      groundY: 400,
      facingRight: false,
    },
  ],
  vineAnchors: [],
};

// ─── Room 7: Orrery Chamber (1440×1080) — Dense Pre-Boss Encounter ───

export const ORRERY_CHAMBER: RoomData = {
  id: "orrery-chamber",
  name: "Orrery Chamber",
  width: 1440,
  height: 1080,
  biomeId: "astral-atlas",
  defaultSpawn: { x: 64, y: 1080 - 64 - T },
  platforms: [
    // Floor
    { x: 0, y: 1080 - T, width: 1440, height: T },
    // Ceiling
    { x: 0, y: 0, width: 1440, height: T },
    // Left wall (gap for left exit)
    { x: 0, y: 0, width: T, height: 1080 - 128 },
    { x: 0, y: 1080 - 64, width: T, height: 64 },
    // Right wall (gap for right exit)
    { x: 1440 - T, y: 0, width: T, height: 1080 - 128 },
    { x: 1440 - T, y: 1080 - 64, width: T, height: 64 },
    // Orbital ring of platforms
    { x: 200, y: 800, width: 160, height: T },
    { x: 550, y: 650, width: 160, height: T },
    { x: 900, y: 500, width: 192, height: T },
    { x: 600, y: 350, width: 160, height: T },
    { x: 250, y: 450, width: 160, height: T },
    { x: 1100, y: 700, width: 160, height: T },
    { x: 1200, y: 350, width: 160, height: T },
  ],
  obstacles: [],
  exits: [
    // Left → zero-g-vault
    {
      direction: "left",
      zone: { x: 0, y: 1080 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "zero-g-vault",
      targetSpawnPoint: { x: 960 - 80, y: 540 },
    },
    // Right → seraph-spire
    {
      direction: "right",
      zone: { x: 1440 - EXIT_ZONE_DEPTH, y: 1080 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "seraph-spire",
      targetSpawnPoint: { x: 64, y: 1080 - 64 - T },
    },
  ],
  gates: [],
  enemies: [
    // Readers scattered on platforms
    {
      id: "oc_reader_1",
      position: { x: 250, y: 800 },
      type: "reader",
      patrolRange: 70,
      groundY: 800,
      facingRight: true,
    },
    {
      id: "oc_reader_2",
      position: { x: 600, y: 650 },
      type: "reader",
      patrolRange: 70,
      groundY: 650,
      facingRight: false,
    },
    {
      id: "oc_reader_3",
      position: { x: 1150, y: 700 },
      type: "reader",
      patrolRange: 70,
      groundY: 700,
      facingRight: true,
    },
    // Binder on upper platform (thread attack from height)
    {
      id: "oc_binder_1",
      position: { x: 650, y: 350 },
      type: "binder",
      patrolRange: 60,
      groundY: 350,
      facingRight: true,
    },
    // Proofwarden (center-right, shielded)
    {
      id: "oc_proofwarden_1",
      position: { x: 950, y: 500 },
      type: "proofwarden",
      groundY: 500,
      facingRight: false,
    },
  ],
  vineAnchors: [],
  gravityWells: [
    { id: "oc_attract_1", position: { x: 400, y: 600 }, radius: 280, strength: 220, type: "attract" },
    { id: "oc_attract_2", position: { x: 1040, y: 600 }, radius: 280, strength: 220, type: "attract" },
    { id: "oc_attract_3", position: { x: 720, y: 300 }, radius: 250, strength: 200, type: "attract" },
  ],
};

// ─── Room 8: Seraph's Spire (1440×1080) — Boss Arena ─────────────────

const SERAPH_SPIRE_BOSS_GATE_RECT = {
  x: 580,
  y: T,
  width: 280,
  height: T,
};

export const SERAPH_SPIRE: RoomData = {
  id: "seraph-spire",
  name: "Seraph's Spire",
  width: 1440,
  height: 1080,
  biomeId: "astral-atlas",
  defaultSpawn: { x: 64, y: 1080 - 64 - T },
  platforms: [
    // Floor
    { x: 0, y: 1080 - T, width: 1440, height: T },
    // Ceiling
    { x: 0, y: 0, width: 1440, height: T },
    // Left wall (gap for entry)
    { x: 0, y: 0, width: T, height: 1080 - 128 },
    { x: 0, y: 1080 - 64, width: T, height: 64 },
    // Right wall (full — exit is top)
    { x: 1440 - T, y: 0, width: T, height: 1080 },
    // Combat platforms (sparse, vertical options vs flying boss)
    { x: 200, y: 800, width: 256, height: T },
    { x: 800, y: 750, width: 256, height: T },
    { x: 400, y: 550, width: 224, height: T },
    { x: 900, y: 500, width: 224, height: T },
    { x: 600, y: 300, width: 256, height: T },
    // Post-boss blocking platform (removed when Misprint Seraph is defeated)
    {
      x: SERAPH_SPIRE_BOSS_GATE_RECT.x,
      y: SERAPH_SPIRE_BOSS_GATE_RECT.y,
      width: SERAPH_SPIRE_BOSS_GATE_RECT.width,
      height: SERAPH_SPIRE_BOSS_GATE_RECT.height,
    },
  ],
  obstacles: [],
  exits: [
    // Left → orrery-chamber
    {
      direction: "left",
      zone: { x: 0, y: 1080 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "orrery-chamber",
      targetSpawnPoint: { x: 1440 - 80, y: 1080 - 64 - T },
    },
    // Top → shortcut back to observatory-bridge
    {
      direction: "top",
      zone: { x: 580, y: 0, width: 280, height: EXIT_ZONE_DEPTH },
      targetRoomId: "observatory-bridge",
      targetSpawnPoint: { x: 960, y: 540 - 64 - T },
    },
  ],
  gates: [],
  enemies: [
    // Misprint Seraph boss spawn
    {
      id: "ss_seraph",
      position: { x: 720, y: 300 },
      type: "boss",
      bossId: "misprint-seraph",
      groundY: 1080 - T,
      facingRight: true,
    },
  ],
  vineAnchors: [],
  gravityWells: [
    { id: "ss_repel_1", position: { x: 360, y: 200 }, radius: 200, strength: 180, type: "repel" },
    { id: "ss_repel_2", position: { x: 1080, y: 200 }, radius: 200, strength: 180, type: "repel" },
  ],
  bossGate: {
    bossId: "misprint-seraph",
    platformRect: SERAPH_SPIRE_BOSS_GATE_RECT,
  },
};

// ─── Exports ─────────────────────────────────────────────────────────

/** All Astral Atlas room definitions keyed by ID */
export const ASTRAL_ATLAS_ROOMS: Record<string, RoomData> = {
  "observatory-bridge": OBSERVATORY_BRIDGE,
  "star-chart-hall": STAR_CHART_HALL,
  "constellation-path": CONSTELLATION_PATH,
  "nebula-crossing": NEBULA_CROSSING,
  "zero-g-vault": ZERO_G_VAULT,
  "orrery-chamber": ORRERY_CHAMBER,
  "seraph-spire": SERAPH_SPIRE,
};

/** All Astral Atlas room IDs */
export const ASTRAL_ATLAS_ROOM_IDS = [
  "observatory-bridge",
  "star-chart-hall",
  "constellation-path",
  "nebula-crossing",
  "zero-g-vault",
  "orrery-chamber",
  "seraph-spire",
] as const;
