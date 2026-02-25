// Ability Shrine Rooms — 4 special rooms where the player first unlocks each editing ability
// Each shrine has a pedestal, an unlock moment, and a teaching puzzle requiring the new ability to exit.
// Shrine rooms are standalone and will be connected to their respective biome wings by the wing tasks.

import type { RoomData } from "./Room";
import { EXIT_ZONE_DEPTH, GATE_WIDTH, GATE_HEIGHT } from "./Room";

const T = 32; // tile size

// ─── Room 1: Stitch Sanctum (960×1080) — Margin Stitch Tutorial ────

export const STITCH_SHRINE: RoomData = {
  id: "stitch-shrine",
  name: "Stitch Sanctum",
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
    // Ceiling
    { x: 0, y: 0, width: 960, height: T },
    // Mid-floor dividing upper/lower chambers (gap on right side for drop-down)
    { x: 0, y: 540, width: 640, height: T },
    // Upper landing near pedestal
    { x: 300, y: 400, width: 360, height: T },
    // Lower stitch-puzzle wall 1 (vertical)
    { x: 400, y: 600, width: T, height: 200 },
    // Lower stitch-puzzle wall 2 (vertical)
    { x: 600, y: 600, width: T, height: 200 },
    // Lower landing beyond walls
    { x: 700, y: 780, width: 200, height: T },
    // Step platforms to guide player back up
    { x: 100, y: 900, width: 128, height: T },
    { x: 300, y: 820, width: 128, height: T },
  ],
  obstacles: [],
  exits: [
    // Top → back to Herbarium wing (vine-vestibule)
    {
      direction: "top",
      zone: { x: 400, y: 0, width: 160, height: EXIT_ZONE_DEPTH },
      targetRoomId: "vine-vestibule",
      targetSpawnPoint: { x: 480, y: 320 - 64 },
    },
    // Right exit (teaching puzzle completion) → overgrown-stacks
    {
      direction: "right",
      zone: { x: 960 - EXIT_ZONE_DEPTH, y: 748, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "overgrown-stacks",
      targetSpawnPoint: { x: 64, y: 1080 - 64 - T },
    },
  ],
  gates: [
    // Teaching gate — blocks right exit until Margin Stitch is used
    {
      id: "ss_gate_stitch",
      rect: { x: 900, y: 684, width: GATE_WIDTH, height: GATE_HEIGHT },
      requiredAbility: "margin-stitch",
      lockedColor: "#22d3ee",
      opened: false,
    },
  ],
  enemies: [],
  vineAnchors: [],
  abilityPickup: {
    ability: "margin-stitch",
    position: { x: 480, y: 368 },
    zone: { x: 400, y: 300, width: 160, height: 100 },
  },
};

// ─── Room 2: Redaction Alcove (960×540) — Redaction Tutorial ────────

export const REDACTION_SHRINE: RoomData = {
  id: "redaction-shrine",
  name: "Redaction Alcove",
  width: 960,
  height: 540,
  biomeId: "maritime-ledger",
  defaultSpawn: { x: 100, y: 540 - 64 - T },
  platforms: [
    // Floor
    { x: 0, y: 540 - T, width: 960, height: T },
    // Left wall
    { x: 0, y: 0, width: T, height: 540 },
    // Right wall
    { x: 960 - T, y: 0, width: T, height: 540 },
    // Ceiling
    { x: 0, y: 0, width: 960, height: T },
    // Raised pedestal platform
    { x: 100, y: 380, width: 200, height: T },
    // Small stepping stone
    { x: 500, y: 400, width: 96, height: T },
  ],
  obstacles: [
    // Spike row blocking exit
    {
      id: "rs_spikes_1",
      rect: { x: 700, y: 540 - T - 32, width: 160, height: 32 },
      type: "spikes",
      damage: 1,
      solid: false,
    },
    // Solid barrier behind spikes — must be redacted
    {
      id: "rs_barrier_1",
      rect: { x: 840, y: 540 - T - 96, width: T, height: 96 },
      type: "barrier",
      damage: 0,
      solid: true,
    },
  ],
  exits: [
    // Left → back to Maritime Ledger wing (cargo-hold)
    {
      direction: "left",
      zone: { x: 0, y: 540 - T - 96, width: EXIT_ZONE_DEPTH, height: 96 },
      targetRoomId: "cargo-hold",
      targetSpawnPoint: { x: 960 - 80, y: 540 - 64 - T },
    },
    // Right → continue into Maritime Ledger wing (storm-channel)
    {
      direction: "right",
      zone: { x: 960 - EXIT_ZONE_DEPTH, y: 540 - T - 96, width: EXIT_ZONE_DEPTH, height: 96 },
      targetRoomId: "storm-channel",
      targetSpawnPoint: { x: 64, y: 540 - 64 - T },
    },
  ],
  gates: [
    // Redaction gate on the barrier — opens when player has Redaction
    {
      id: "rs_gate_redact",
      rect: { x: 840, y: 540 - T - 96, width: GATE_WIDTH, height: GATE_HEIGHT },
      requiredAbility: "redaction",
      lockedColor: "#ef4444",
      opened: false,
    },
  ],
  enemies: [],
  vineAnchors: [],
  abilityPickup: {
    ability: "redaction",
    position: { x: 200, y: 348 },
    zone: { x: 130, y: 300, width: 140, height: 80 },
  },
};

// ─── Room 3: Paste-Over Study (960×1080) — Paste-Over Tutorial ──────

export const PASTE_SHRINE: RoomData = {
  id: "paste-shrine",
  name: "Paste-Over Study",
  width: 960,
  height: 1080,
  biomeId: "astral-atlas",
  defaultSpawn: { x: 480, y: 1080 - 64 - T },
  platforms: [
    // Floor
    { x: 0, y: 1080 - T, width: 960, height: T },
    // Left wall
    { x: 0, y: 0, width: T, height: 1080 },
    // Right wall
    { x: 960 - T, y: 0, width: T, height: 1080 },
    // Ceiling (with exit gap)
    { x: 0, y: 0, width: 350, height: T },
    { x: 610, y: 0, width: 350, height: T },
    // Pedestal platform (mid-height)
    { x: 350, y: 600, width: 260, height: T },
    // Bouncy platform (source) — near floor
    { x: 100, y: 900, width: 200, height: T, surfaceType: "bouncy" },
    // Target platform (paste destination) — too high for normal jump
    { x: 350, y: 350, width: 260, height: T },
    // Small landing near top
    { x: 650, y: 200, width: 200, height: T },
  ],
  obstacles: [],
  exits: [
    // Bottom → back to Astral Atlas wing (constellation-path)
    {
      direction: "bottom",
      zone: { x: 400, y: 1080 - EXIT_ZONE_DEPTH, width: 160, height: EXIT_ZONE_DEPTH },
      targetRoomId: "constellation-path",
      targetSpawnPoint: { x: 480, y: T + 64 },
    },
    // Top → continue into Astral Atlas wing (nebula-crossing)
    {
      direction: "top",
      zone: { x: 350, y: 0, width: 260, height: EXIT_ZONE_DEPTH },
      targetRoomId: "nebula-crossing",
      targetSpawnPoint: { x: 480, y: 1080 - 64 - T },
    },
  ],
  gates: [
    // Paste-Over gate blocks the top exit — must bounce to reach it
    {
      id: "ps_gate_paste",
      rect: { x: 472, y: T, width: GATE_WIDTH, height: GATE_HEIGHT },
      requiredAbility: "paste-over",
      lockedColor: "#f59e0b",
      opened: false,
    },
  ],
  enemies: [],
  vineAnchors: [],
  abilityPickup: {
    ability: "paste-over",
    position: { x: 480, y: 568 },
    zone: { x: 400, y: 520, width: 160, height: 80 },
  },
};

// ─── Room 4: Index Mark Archive (960×1080) — Index Mark Tutorial ────
// NOTE: This room should have a fog zone covering { x: T, y: 350, width: 960 - 2*T, height: 400 }
// with density 0.6. The FogSystem is initialized per-room by the loading code.

export const INDEX_SHRINE: RoomData = {
  id: "index-shrine",
  name: "Index Mark Archive",
  width: 960,
  height: 1080,
  biomeId: "gothic-errata",
  defaultSpawn: { x: 480, y: 1080 - 64 - T },
  platforms: [
    // Floor
    { x: 0, y: 1080 - T, width: 960, height: T },
    // Left wall
    { x: 0, y: 0, width: T, height: 1080 },
    // Right wall
    { x: 960 - T, y: 0, width: T, height: 1080 },
    // Ceiling (with exit gap)
    { x: 0, y: 0, width: 300, height: T },
    { x: 660, y: 0, width: 300, height: T },
    // Upper platform (mark placement + exit access)
    { x: 300, y: 250, width: 360, height: T },
    // Pedestal platform (mid-height)
    { x: 300, y: 550, width: 360, height: T },
    // Lower platform (landing after fog drop)
    { x: 200, y: 850, width: 560, height: T },
    // Step from floor to lower platform
    { x: 100, y: 950, width: 160, height: T },
  ],
  obstacles: [],
  exits: [
    // Left → back to Gothic Errata wing (bell-tower)
    {
      direction: "left",
      zone: { x: 0, y: 518, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "bell-tower",
      targetSpawnPoint: { x: 960 - 80, y: 540 - 64 - T },
    },
    // Top → continue into Gothic Errata wing (mirror-hall)
    {
      direction: "top",
      zone: { x: 300, y: 0, width: 360, height: EXIT_ZONE_DEPTH },
      targetRoomId: "mirror-hall",
      targetSpawnPoint: { x: 480, y: 1080 - 64 - T },
    },
  ],
  gates: [
    // Index Mark gate blocks the top exit — must teleport to upper platform
    {
      id: "is_gate_index",
      rect: { x: 472, y: T, width: GATE_WIDTH, height: GATE_HEIGHT },
      requiredAbility: "index-mark",
      lockedColor: "#a78bfa",
      opened: false,
    },
  ],
  enemies: [],
  vineAnchors: [],
  abilityPickup: {
    ability: "index-mark",
    position: { x: 480, y: 518 },
    zone: { x: 400, y: 470, width: 160, height: 80 },
  },
};

// ─── Exports ─────────────────────────────────────────────────────────

/** All Ability Shrine room definitions keyed by ID */
export const ABILITY_SHRINE_ROOMS: Record<string, RoomData> = {
  "stitch-shrine": STITCH_SHRINE,
  "redaction-shrine": REDACTION_SHRINE,
  "paste-shrine": PASTE_SHRINE,
  "index-shrine": INDEX_SHRINE,
};

/** All Ability Shrine room IDs */
export const ABILITY_SHRINE_ROOM_IDS = [
  "stitch-shrine",
  "redaction-shrine",
  "paste-shrine",
  "index-shrine",
] as const;
