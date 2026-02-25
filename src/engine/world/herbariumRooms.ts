// Herbarium Wing — 8 interconnected rooms forming the first explorable biome region
// Layout: Vine Vestibule branches into two paths that converge at Herbarium Heart (mini-boss)

import type { RoomData } from "./Room";
import { EXIT_ZONE_DEPTH } from "./Room";

const T = 32; // tile size

// ─── Room 1: Vine Vestibule (960×1080) — Vine Tutorial ──────────────

export const VINE_VESTIBULE: RoomData = {
  id: "vine-vestibule",
  name: "Vine Vestibule",
  width: 960,
  height: 1080,
  biomeId: "herbarium-folio",
  defaultSpawn: { x: 480, y: 1080 - 64 - T },
  platforms: [
    // Floor
    { x: 0, y: 1080 - T, width: 960, height: T },
    // Left wall
    { x: 0, y: 0, width: T, height: 1080 },
    // Right wall
    { x: 960 - T, y: 0, width: T, height: 1080 },
    // Ceiling (with gap for top exit)
    { x: 0, y: 0, width: 400, height: T },
    { x: 560, y: 0, width: 400, height: T },

    // Mid platform (rest point between vine 1 and vine 2)
    { x: 200, y: 760, width: 200, height: T },
    // Upper platform (rest point between vine 2 and vine 3)
    { x: 560, y: 540, width: 200, height: T },
    // High landing platform near exits
    { x: 300, y: 320, width: 360, height: T },
  ],
  obstacles: [],
  exits: [
    // Top → Tutorial Corridor
    {
      direction: "top",
      zone: { x: 400, y: 0, width: 160, height: EXIT_ZONE_DEPTH },
      targetRoomId: "tutorial-corridor",
      targetSpawnPoint: { x: 960 - 80, y: 540 - 64 - T },
    },
    // Left → Overgrown Stacks
    {
      direction: "left",
      zone: { x: 0, y: 320, width: EXIT_ZONE_DEPTH, height: 96 },
      targetRoomId: "overgrown-stacks",
      targetSpawnPoint: { x: 1920 - 80, y: 1080 - 64 - T },
    },
    // Right → Root Cellar
    {
      direction: "right",
      zone: { x: 960 - EXIT_ZONE_DEPTH, y: 320, width: EXIT_ZONE_DEPTH, height: 96 },
      targetRoomId: "root-cellar",
      targetSpawnPoint: { x: 64, y: T + 64 },
    },
  ],
  gates: [],
  enemies: [],
  vineAnchors: [
    // Vine 1: reachable from floor, swing to mid platform
    { id: "vv_vine_1", position: { x: 300, y: 560 }, ropeLength: 150, type: "ceiling" },
    // Vine 2: swing from mid platform to upper platform
    { id: "vv_vine_2", position: { x: 600, y: 340 }, ropeLength: 140, type: "hanging" },
    // Vine 3: swing from upper platform to high landing
    { id: "vv_vine_3", position: { x: 480, y: 140 }, ropeLength: 130, type: "ceiling" },
  ],
};

// ─── Room 2: Overgrown Stacks (1920×1080) — Vine + Platforming ─────

export const OVERGROWN_STACKS: RoomData = {
  id: "overgrown-stacks",
  name: "Overgrown Stacks",
  width: 1920,
  height: 1080,
  biomeId: "herbarium-folio",
  defaultSpawn: { x: 1920 - 80, y: 1080 - 64 - T },
  platforms: [
    // Floor (left third only)
    { x: 0, y: 1080 - T, width: 640, height: T },
    // Right-side arrival floor
    { x: 1600, y: 1080 - T, width: 320, height: T },
    // Walls
    { x: 0, y: 0, width: T, height: 1080 },
    { x: 1920 - T, y: 0, width: T, height: 1080 },
    // Ceiling
    { x: 0, y: 0, width: 1920, height: T },

    // Narrow landing platforms between vine sections (over spike pit)
    { x: 700, y: 800, width: 96, height: T },
    { x: 950, y: 720, width: 96, height: T },
    { x: 1200, y: 760, width: 128, height: T },
    { x: 1450, y: 700, width: 96, height: T },

    // Spike pit floor (thin, with spikes on top)
    { x: 640, y: 1080 - T, width: 960, height: T },
  ],
  obstacles: [
    // Spike strip along the pit floor
    {
      id: "os_spikes_1",
      rect: { x: 660, y: 1080 - T - T, width: 920, height: T },
      type: "spikes",
      damage: 20,
      solid: false,
    },
  ],
  exits: [
    // Right → Vine Vestibule (back)
    {
      direction: "right",
      zone: { x: 1920 - EXIT_ZONE_DEPTH, y: 1080 - T - 96, width: EXIT_ZONE_DEPTH, height: 96 },
      targetRoomId: "vine-vestibule",
      targetSpawnPoint: { x: T + 16, y: 320 + 48 },
    },
    // Left → Canopy Walk
    {
      direction: "left",
      zone: { x: 0, y: 1080 - T - 96, width: EXIT_ZONE_DEPTH, height: 96 },
      targetRoomId: "canopy-walk",
      targetSpawnPoint: { x: 1920 - 80, y: 540 - 64 - T },
    },
  ],
  gates: [],
  enemies: [
    {
      id: "os_reader_1",
      position: { x: 750, y: 800 },
      type: "reader",
      patrolRange: 40,
      groundY: 800,
      facingRight: false,
    },
    {
      id: "os_reader_2",
      position: { x: 1250, y: 760 },
      type: "reader",
      patrolRange: 50,
      groundY: 760,
      facingRight: true,
    },
  ],
  vineAnchors: [
    { id: "os_vine_1", position: { x: 500, y: 500 }, ropeLength: 160, type: "ceiling" },
    { id: "os_vine_2", position: { x: 780, y: 420 }, ropeLength: 150, type: "hanging" },
    { id: "os_vine_3", position: { x: 1060, y: 380 }, ropeLength: 160, type: "ceiling" },
    { id: "os_vine_4", position: { x: 1320, y: 440 }, ropeLength: 140, type: "hanging" },
    { id: "os_vine_5", position: { x: 1560, y: 400 }, ropeLength: 150, type: "ceiling" },
  ],
};

// ─── Room 3: Root Cellar (960×1080) — Underground Ability Puzzles ───

export const ROOT_CELLAR: RoomData = {
  id: "root-cellar",
  name: "Root Cellar",
  width: 960,
  height: 1080,
  biomeId: "herbarium-folio",
  defaultSpawn: { x: 64, y: T + 64 },
  platforms: [
    // Floor
    { x: 0, y: 1080 - T, width: 960, height: T },
    // Walls
    { x: 0, y: 0, width: T, height: 1080 },
    { x: 960 - T, y: 0, width: T, height: 1080 },
    // Ceiling
    { x: 0, y: 0, width: 960, height: T },

    // Upper chamber platform (arrival from Vestibule)
    { x: T, y: 200, width: 400, height: T },
    // Right upper ledge
    { x: 560, y: 200, width: 368, height: T },

    // Internal dividing wall (Margin Stitch gate cuts through this)
    { x: 420, y: 200, width: T, height: 300 },
    // Shortcut wall extension (the gate is in the gap)
    { x: 420, y: 540, width: T, height: 200 },

    // Mid-level platforms
    { x: T, y: 500, width: 300, height: T },
    { x: 500, y: 600, width: 300, height: T },

    // Lower platforms
    { x: T, y: 780, width: 350, height: T },
    { x: 500, y: 850, width: 300, height: T },

    // High vine access platform
    { x: 600, y: 380, width: 200, height: T },
  ],
  obstacles: [
    // Barrier blocking the alternate path to the bottom exit
    {
      id: "rc_barrier_1",
      rect: { x: 200, y: 1080 - T - 96, width: T, height: 96 },
      type: "barrier",
      damage: 0,
      solid: true,
    },
  ],
  exits: [
    // Left → Vine Vestibule (back)
    {
      direction: "left",
      zone: { x: 0, y: 200, width: EXIT_ZONE_DEPTH, height: 96 },
      targetRoomId: "vine-vestibule",
      targetSpawnPoint: { x: 960 - T - 64, y: 320 + 48 },
    },
    // Bottom → Mushroom Grotto
    {
      direction: "bottom",
      zone: { x: 400, y: 1080 - EXIT_ZONE_DEPTH, width: 160, height: EXIT_ZONE_DEPTH },
      targetRoomId: "mushroom-grotto",
      targetSpawnPoint: { x: 720, y: T + 64 },
    },
  ],
  gates: [
    // Margin Stitch gate in the dividing wall — creates passage between left and right chambers
    {
      id: "rc_gate_stitch",
      rect: { x: 420, y: 460, width: T, height: 80 },
      requiredAbility: "margin-stitch",
      lockedColor: "#22d3ee",
      opened: false,
    },
  ],
  enemies: [
    {
      id: "rc_binder_1",
      position: { x: 600, y: 600 },
      type: "binder",
      patrolRange: 120,
      groundY: 600,
      facingRight: false,
    },
  ],
  vineAnchors: [
    { id: "rc_vine_1", position: { x: 700, y: 180 }, ropeLength: 120, type: "ceiling" },
  ],
};

// ─── Room 4: Canopy Walk (1920×540) — Horizontal Vine Gauntlet ──────

export const CANOPY_WALK: RoomData = {
  id: "canopy-walk",
  name: "Canopy Walk",
  width: 1920,
  height: 540,
  biomeId: "herbarium-folio",
  defaultSpawn: { x: 1920 - 80, y: 540 - 64 - T },
  platforms: [
    // Walls
    { x: 0, y: 0, width: T, height: 540 },
    { x: 1920 - T, y: 0, width: T, height: 540 },
    // Ceiling
    { x: 0, y: 0, width: 1920, height: T },

    // Starting platform (right side)
    { x: 1720, y: 540 - T, width: 200, height: T },
    // Exit platform (left side)
    { x: T, y: 540 - T, width: 200, height: T },

    // Narrow rest platforms between vine sections
    { x: 1480, y: 400, width: 64, height: T },
    { x: 1200, y: 360, width: 64, height: T },
    { x: 900, y: 380, width: 96, height: T },
    { x: 600, y: 350, width: 64, height: T },
    { x: 350, y: 390, width: 64, height: T },
  ],
  obstacles: [],
  exits: [
    // Right → Overgrown Stacks (back)
    {
      direction: "right",
      zone: { x: 1920 - EXIT_ZONE_DEPTH, y: 540 - T - 96, width: EXIT_ZONE_DEPTH, height: 96 },
      targetRoomId: "overgrown-stacks",
      targetSpawnPoint: { x: 64, y: 1080 - 64 - T },
    },
    // Left → Thorn Gallery
    {
      direction: "left",
      zone: { x: 0, y: 540 - T - 96, width: EXIT_ZONE_DEPTH, height: 96 },
      targetRoomId: "thorn-gallery",
      targetSpawnPoint: { x: 480, y: T + 64 },
    },
  ],
  gates: [],
  enemies: [
    {
      id: "cw_reader_1",
      position: { x: 920, y: 380 },
      type: "reader",
      patrolRange: 40,
      groundY: 380,
      facingRight: false,
    },
    {
      id: "cw_proofwarden_1",
      position: { x: 100, y: 540 - T },
      type: "proofwarden",
      groundY: 540 - T,
      facingRight: true,
    },
  ],
  vineAnchors: [
    { id: "cw_vine_1", position: { x: 1600, y: 120 }, ropeLength: 160, type: "ceiling" },
    { id: "cw_vine_2", position: { x: 1350, y: 100 }, ropeLength: 150, type: "hanging" },
    { id: "cw_vine_3", position: { x: 1060, y: 110 }, ropeLength: 160, type: "ceiling" },
    { id: "cw_vine_4", position: { x: 760, y: 100 }, ropeLength: 150, type: "hanging" },
    { id: "cw_vine_5", position: { x: 480, y: 120 }, ropeLength: 140, type: "ceiling" },
    { id: "cw_vine_6", position: { x: 220, y: 100 }, ropeLength: 160, type: "ceiling" },
  ],
};

// ─── Room 5: Mushroom Grotto (1440×1080) — Surface Puzzle + Combat ──

export const MUSHROOM_GROTTO: RoomData = {
  id: "mushroom-grotto",
  name: "Mushroom Grotto",
  width: 1440,
  height: 1080,
  biomeId: "herbarium-folio",
  defaultSpawn: { x: 720, y: T + 64 },
  platforms: [
    // Floor (partial with gaps)
    { x: 0, y: 1080 - T, width: 500, height: T },
    { x: 600, y: 1080 - T, width: 340, height: T },
    { x: 1040, y: 1080 - T, width: 400, height: T },
    // Walls
    { x: 0, y: 0, width: T, height: 1080 },
    { x: 1440 - T, y: 0, width: T, height: 1080 },
    // Ceiling
    { x: 0, y: 0, width: 1440, height: T },

    // Normal stone platforms
    { x: 200, y: 700, width: 180, height: T },
    { x: 900, y: 650, width: 160, height: T },
    { x: 200, y: 400, width: 200, height: T },

    // Bouncy mushroom cap platforms
    { x: 550, y: 780, width: 128, height: T, surfaceType: "bouncy" },
    { x: 1050, y: 500, width: 128, height: T, surfaceType: "bouncy" },

    // Icy moss platform
    { x: 700, y: 500, width: 160, height: T, surfaceType: "icy" },

    // Sticky fungal mat platform
    { x: 400, y: 550, width: 128, height: T, surfaceType: "sticky" },

    // Upper section platforms (reachable via vine or bouncy → paste-over)
    { x: 600, y: 280, width: 240, height: T },
    { x: 1000, y: 300, width: 200, height: T },

    // Treasure alcove platform (behind paste-over gate)
    { x: 1200, y: 300, width: 200, height: T },
  ],
  obstacles: [
    // Spikes at the bottom of floor gaps
    {
      id: "mg_spikes_1",
      rect: { x: 500, y: 1080 - T - T, width: 100, height: T },
      type: "spikes",
      damage: 15,
      solid: false,
    },
    {
      id: "mg_spikes_2",
      rect: { x: 940, y: 1080 - T - T, width: 100, height: T },
      type: "spikes",
      damage: 15,
      solid: false,
    },
  ],
  exits: [
    // Top → Root Cellar (back)
    {
      direction: "top",
      zone: { x: 640, y: 0, width: 160, height: EXIT_ZONE_DEPTH },
      targetRoomId: "root-cellar",
      targetSpawnPoint: { x: 480, y: 1080 - 64 - T },
    },
    // Right → Spore Chamber
    {
      direction: "right",
      zone: { x: 1440 - EXIT_ZONE_DEPTH, y: 1080 - T - 96, width: EXIT_ZONE_DEPTH, height: 96 },
      targetRoomId: "spore-chamber",
      targetSpawnPoint: { x: 64, y: 1080 - 64 - T },
    },
  ],
  gates: [
    // Paste-Over gate blocking the treasure alcove
    {
      id: "mg_gate_paste",
      rect: { x: 1190, y: 300 - 96, width: 16, height: 96 },
      requiredAbility: "paste-over",
      lockedColor: "#f59e0b",
      opened: false,
    },
  ],
  enemies: [
    {
      id: "mg_reader_1",
      position: { x: 300, y: 1080 - T },
      type: "reader",
      patrolRange: 100,
      groundY: 1080 - T,
      facingRight: true,
    },
    {
      id: "mg_reader_2",
      position: { x: 1100, y: 1080 - T },
      type: "reader",
      patrolRange: 80,
      groundY: 1080 - T,
      facingRight: false,
    },
    {
      id: "mg_binder_1",
      position: { x: 750, y: 650 },
      type: "binder",
      patrolRange: 100,
      groundY: 650,
      facingRight: true,
    },
  ],
  vineAnchors: [
    { id: "mg_vine_1", position: { x: 400, y: 200 }, ropeLength: 140, type: "ceiling" },
    { id: "mg_vine_2", position: { x: 1100, y: 180 }, ropeLength: 120, type: "hanging" },
  ],
};

// ─── Room 6: Thorn Gallery (960×1080) — Vertical Combat Arena ───────

export const THORN_GALLERY: RoomData = {
  id: "thorn-gallery",
  name: "Thorn Gallery",
  width: 960,
  height: 1080,
  biomeId: "herbarium-folio",
  defaultSpawn: { x: 480, y: T + 64 },
  platforms: [
    // Floor
    { x: 0, y: 1080 - T, width: 960, height: T },
    // Walls
    { x: 0, y: 0, width: T, height: 1080 },
    { x: 960 - T, y: 0, width: T, height: 1080 },
    // Ceiling
    { x: 0, y: 0, width: 960, height: T },

    // Level 1 platforms (low)
    { x: T, y: 860, width: 200, height: T },
    { x: 400, y: 900, width: 160, height: T },
    { x: 720, y: 860, width: 200, height: T },

    // Level 2 platforms (mid)
    { x: 200, y: 660, width: 180, height: T },
    { x: 580, y: 680, width: 160, height: T },

    // Level 3 platforms (upper)
    { x: T, y: 460, width: 200, height: T },
    { x: 400, y: 420, width: 160, height: T },
    { x: 720, y: 460, width: 200, height: T },

    // Top platform (near ceiling exit area)
    { x: 300, y: 240, width: 360, height: T },
  ],
  obstacles: [
    // Ceiling-mounted spikes hanging down on two mid platforms
    {
      id: "tg_spikes_1",
      rect: { x: 200, y: 660 - T, width: 180, height: T },
      type: "spikes",
      damage: 15,
      solid: false,
    },
    {
      id: "tg_spikes_2",
      rect: { x: 580, y: 680 - T, width: 160, height: T },
      type: "spikes",
      damage: 15,
      solid: false,
    },
    // Laser hazard across a gap between upper platforms
    {
      id: "tg_laser_1",
      rect: { x: 200, y: 440, width: 200, height: 8 },
      type: "laser",
      damage: 10,
      solid: false,
    },
  ],
  exits: [
    // Top → Canopy Walk (back)
    {
      direction: "top",
      zone: { x: 400, y: 0, width: 160, height: EXIT_ZONE_DEPTH },
      targetRoomId: "canopy-walk",
      targetSpawnPoint: { x: 64, y: 540 - 64 - T },
    },
    // Bottom → Herbarium Heart (through Redaction gate)
    {
      direction: "bottom",
      zone: { x: 400, y: 1080 - EXIT_ZONE_DEPTH, width: 160, height: EXIT_ZONE_DEPTH },
      targetRoomId: "herbarium-heart",
      targetSpawnPoint: { x: 200, y: T + 64 },
    },
  ],
  gates: [
    // Redaction gate blocking exit to Herbarium Heart
    {
      id: "tg_gate_redact",
      rect: { x: 472, y: 1080 - T - 96, width: 16, height: 96 },
      requiredAbility: "redaction",
      lockedColor: "#ef4444",
      opened: false,
    },
  ],
  enemies: [
    {
      id: "tg_reader_1",
      position: { x: 100, y: 860 },
      type: "reader",
      patrolRange: 80,
      groundY: 860,
      facingRight: true,
    },
    {
      id: "tg_reader_2",
      position: { x: 780, y: 860 },
      type: "reader",
      patrolRange: 80,
      groundY: 860,
      facingRight: false,
    },
    {
      id: "tg_reader_3",
      position: { x: 450, y: 900 },
      type: "reader",
      patrolRange: 60,
      groundY: 900,
      facingRight: true,
    },
    {
      id: "tg_binder_1",
      position: { x: 300, y: 660 },
      type: "binder",
      patrolRange: 80,
      groundY: 660,
      facingRight: true,
    },
    {
      id: "tg_proofwarden_1",
      position: { x: 480, y: 420 },
      type: "proofwarden",
      groundY: 420,
      facingRight: false,
    },
  ],
  vineAnchors: [
    { id: "tg_vine_1", position: { x: 150, y: 300 }, ropeLength: 120, type: "ceiling" },
    { id: "tg_vine_2", position: { x: 800, y: 280 }, ropeLength: 130, type: "hanging" },
  ],
};

// ─── Room 7: Spore Chamber (960×1080) — Environmental Puzzle ────────

export const SPORE_CHAMBER: RoomData = {
  id: "spore-chamber",
  name: "Spore Chamber",
  width: 960,
  height: 1080,
  biomeId: "herbarium-folio",
  defaultSpawn: { x: 64, y: 1080 - 64 - T },
  platforms: [
    // Floor (segmented)
    { x: 0, y: 1080 - T, width: 400, height: T },
    { x: 560, y: 1080 - T, width: 400, height: T },
    // Walls
    { x: 0, y: 0, width: T, height: 1080 },
    { x: 960 - T, y: 0, width: T, height: 1080 },
    // Ceiling
    { x: 0, y: 0, width: 960, height: T },

    // Chamber A (left side, lower) — Margin Stitch wall divides it
    { x: T, y: 780, width: 350, height: T },
    { x: T, y: 560, width: 200, height: T },

    // Internal wall between chamber A and B (Margin Stitch gate cuts through)
    { x: 420, y: 400, width: T, height: 380 },

    // Chamber B (right side)
    { x: 500, y: 700, width: 300, height: T },
    { x: 600, y: 500, width: 200, height: T },

    // Upper section — Redaction barrier blocks the path down
    { x: 200, y: 350, width: 560, height: T },

    // Top platforms leading to exit
    { x: 300, y: 200, width: 360, height: T },
  ],
  obstacles: [
    // Barrier blocking a passage in chamber B
    {
      id: "sc_barrier_1",
      rect: { x: 700, y: 350, width: T, height: 150 },
      type: "barrier",
      damage: 0,
      solid: true,
    },
    // Spikes in the floor gap
    {
      id: "sc_spikes_1",
      rect: { x: 400, y: 1080 - T - T, width: 160, height: T },
      type: "spikes",
      damage: 15,
      solid: false,
    },
  ],
  exits: [
    // Left → Mushroom Grotto (back)
    {
      direction: "left",
      zone: { x: 0, y: 1080 - T - 96, width: EXIT_ZONE_DEPTH, height: 96 },
      targetRoomId: "mushroom-grotto",
      targetSpawnPoint: { x: 1440 - 80, y: 1080 - 64 - T },
    },
    // Bottom → Herbarium Heart
    {
      direction: "bottom",
      zone: { x: 400, y: 1080 - EXIT_ZONE_DEPTH, width: 160, height: EXIT_ZONE_DEPTH },
      targetRoomId: "herbarium-heart",
      targetSpawnPoint: { x: 1440 - 200, y: T + 64 },
    },
  ],
  gates: [
    // Margin Stitch gate in the internal wall
    {
      id: "sc_gate_stitch",
      rect: { x: 420, y: 580, width: T, height: 80 },
      requiredAbility: "margin-stitch",
      lockedColor: "#22d3ee",
      opened: false,
    },
    // Redaction gate on the barrier
    {
      id: "sc_gate_redact",
      rect: { x: 700, y: 350, width: T, height: 96 },
      requiredAbility: "redaction",
      lockedColor: "#ef4444",
      opened: false,
    },
  ],
  enemies: [
    {
      id: "sc_proofwarden_1",
      position: { x: 480, y: 200 },
      type: "proofwarden",
      groundY: 200,
      facingRight: false,
    },
  ],
  vineAnchors: [
    { id: "sc_vine_1", position: { x: 200, y: 160 }, ropeLength: 120, type: "ceiling" },
  ],
};

// ─── Room 8: Herbarium Heart (1440×1080) — Mini-Boss Arena ──────────

export const HERBARIUM_HEART: RoomData = {
  id: "herbarium-heart",
  name: "Herbarium Heart",
  width: 1440,
  height: 1080,
  biomeId: "herbarium-folio",
  defaultSpawn: { x: 200, y: T + 64 },
  platforms: [
    // Floor
    { x: 0, y: 1080 - T, width: 1440, height: T },
    // Walls
    { x: 0, y: 0, width: T, height: 1080 },
    { x: 1440 - T, y: 0, width: T, height: 1080 },
    // Ceiling (with gaps for entrances)
    { x: 0, y: 0, width: 120, height: T },
    { x: 280, y: 0, width: 880, height: T },
    { x: 1320, y: 0, width: 120, height: T },

    // Elevated platforms for tactical advantage
    { x: 200, y: 720, width: 200, height: T },
    { x: 620, y: 600, width: 200, height: T },
    { x: 1040, y: 720, width: 200, height: T },
  ],
  obstacles: [
    // Spike strips along the edges
    {
      id: "hh_spikes_left",
      rect: { x: T, y: 1080 - T - T, width: 100, height: T },
      type: "spikes",
      damage: 15,
      solid: false,
    },
    {
      id: "hh_spikes_right",
      rect: { x: 1440 - T - 100, y: 1080 - T - T, width: 100, height: T },
      type: "spikes",
      damage: 15,
      solid: false,
    },
  ],
  exits: [
    // Top-left → Thorn Gallery (back)
    {
      direction: "top",
      zone: { x: 120, y: 0, width: 160, height: EXIT_ZONE_DEPTH },
      targetRoomId: "thorn-gallery",
      targetSpawnPoint: { x: 480, y: 1080 - 64 - T },
    },
    // Top-right → Spore Chamber (back)
    {
      direction: "top",
      zone: { x: 1160, y: 0, width: 160, height: EXIT_ZONE_DEPTH },
      targetRoomId: "spore-chamber",
      targetSpawnPoint: { x: 480, y: 1080 - 64 - T },
    },
  ],
  gates: [],
  enemies: [
    // Elder Binder (mini-boss) — handled with modified params at runtime
    {
      id: "hh_elder_binder",
      position: { x: 720, y: 1080 - T },
      type: "binder",
      patrolRange: 300,
      groundY: 1080 - T,
      facingRight: false,
    },
  ],
  vineAnchors: [
    { id: "hh_vine_1", position: { x: 300, y: 200 }, ropeLength: 160, type: "ceiling" },
    { id: "hh_vine_2", position: { x: 700, y: 160 }, ropeLength: 140, type: "hanging" },
    { id: "hh_vine_3", position: { x: 1000, y: 200 }, ropeLength: 150, type: "ceiling" },
    { id: "hh_vine_4", position: { x: 1200, y: 180 }, ropeLength: 130, type: "hanging" },
  ],
};

// ─── Constants ──────────────────────────────────────────────────────

/** Elder Binder (mini-boss) params — 3x HP, longer range, faster */
export const ELDER_BINDER_PARAMS = {
  health: 15,
  detectionRange: 350,
  threadRange: 200,
  threadMinRange: 50,
  threadSpeed: 480,
  threadRetractSpeed: 360,
  threadWindup: 16,
  threadDuration: 40,
  threadCooldown: 72,
  pullDuration: 30,
  contactDamage: 2,
  threadDamage: 2,
  threadKnockback: 200,
} as const;

/** All Herbarium Wing room definitions keyed by ID */
export const HERBARIUM_WING_ROOMS: Record<string, RoomData> = {
  "vine-vestibule": VINE_VESTIBULE,
  "overgrown-stacks": OVERGROWN_STACKS,
  "root-cellar": ROOT_CELLAR,
  "canopy-walk": CANOPY_WALK,
  "mushroom-grotto": MUSHROOM_GROTTO,
  "thorn-gallery": THORN_GALLERY,
  "spore-chamber": SPORE_CHAMBER,
  "herbarium-heart": HERBARIUM_HEART,
};

/** All Herbarium Wing room IDs */
export const HERBARIUM_WING_ROOM_IDS = [
  "vine-vestibule",
  "overgrown-stacks",
  "root-cellar",
  "canopy-walk",
  "mushroom-grotto",
  "thorn-gallery",
  "spore-chamber",
  "herbarium-heart",
] as const;
