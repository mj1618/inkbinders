// Preset room definitions for the Room Editor test page

import type { RoomData } from "./Room";
import { EXIT_ZONE_DEPTH } from "./Room";

const T = 32; // tile size

// ─── Preset 1: Tutorial Corridor ────────────────────────────────────
// 1920×540 room with flat floor, a few platforms, a redaction gate, exit right, 2 Readers

export const TUTORIAL_CORRIDOR: RoomData = {
  id: "tutorial-corridor",
  name: "Tutorial Corridor",
  width: 1920,
  height: 540,
  biomeId: "default",
  defaultSpawn: { x: 64, y: 540 - 64 - T },
  platforms: [
    // Floor (full width)
    { x: 0, y: 540 - T, width: 1920, height: T },
    // Left wall
    { x: 0, y: 0, width: T, height: 540 },
    // Ceiling
    { x: 0, y: 0, width: 1920, height: T },
    // Stepping platforms
    { x: 300, y: 400, width: 128, height: T },
    { x: 500, y: 340, width: 128, height: T },
    { x: 700, y: 300, width: 160, height: T },
    // Mid-section platforms after gate
    { x: 1100, y: 380, width: 128, height: T },
    { x: 1300, y: 320, width: 128, height: T },
    { x: 1500, y: 380, width: 160, height: T },
    // Right wall (with gap for exit)
    { x: 1920 - T, y: 0, width: T, height: 540 - 128 },
    { x: 1920 - T, y: 540 - 64, width: T, height: 64 },
  ],
  obstacles: [
    // Spikes on the floor before the gate
    { id: "obs_1", rect: { x: 800, y: 540 - T - T, width: 64, height: T }, type: "spikes", damage: 20, solid: false },
  ],
  exits: [
    // Right exit → Vertical Shaft
    {
      direction: "right",
      zone: { x: 1920 - EXIT_ZONE_DEPTH, y: 540 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "vertical-shaft",
      targetSpawnPoint: { x: 64, y: 1080 - 64 - T },
    },
  ],
  gates: [
    // Redaction gate in the middle
    {
      id: "gate_redaction_1",
      rect: { x: 950, y: 540 - T - 96, width: 16, height: 96 },
      requiredAbility: "redaction",
      lockedColor: "#ef4444",
      opened: false,
    },
  ],
  enemies: [
    {
      id: "enemy_1",
      position: { x: 400, y: 540 - T },
      type: "reader",
      patrolRange: 120,
      groundY: 540 - T,
      facingRight: true,
    },
    {
      id: "enemy_2",
      position: { x: 1400, y: 540 - T },
      type: "reader",
      patrolRange: 100,
      groundY: 540 - T,
      facingRight: false,
    },
  ],
  vineAnchors: [],
};

// ─── Preset 2: Vertical Shaft ───────────────────────────────────────
// 960×1080 room (tall), wall-jump-friendly, vine anchors at top, margin-stitch gate

export const VERTICAL_SHAFT: RoomData = {
  id: "vertical-shaft",
  name: "Vertical Shaft",
  width: 960,
  height: 1080,
  biomeId: "default",
  defaultSpawn: { x: 64, y: 1080 - 64 - T },
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

    // Wall-jump platforms (alternating sides going up)
    { x: T, y: 900, width: 128, height: T },
    { x: 960 - T - 128, y: 780, width: 128, height: T },
    { x: T, y: 660, width: 128, height: T },
    { x: 960 - T - 128, y: 540, width: 128, height: T },
    { x: T, y: 420, width: 128, height: T },

    // Narrow passage walls for margin-stitch gate
    { x: 350, y: 300, width: 128, height: T },
    { x: 480, y: 300, width: 128, height: T },

    // Upper platforms
    { x: 960 - T - 128, y: 200, width: 128, height: T },
    { x: T, y: 100, width: 200, height: T },
  ],
  obstacles: [],
  exits: [
    // Left exit → Tutorial Corridor
    {
      direction: "left",
      zone: { x: 0, y: 1080 - 128, width: EXIT_ZONE_DEPTH, height: 64 },
      targetRoomId: "tutorial-corridor",
      targetSpawnPoint: { x: 1920 - 80, y: 540 - 64 - T },
    },
    // Top exit → Vine Garden
    {
      direction: "top",
      zone: { x: 400, y: 0, width: 160, height: EXIT_ZONE_DEPTH },
      targetRoomId: "vine-garden",
      targetSpawnPoint: { x: 480, y: 1080 - 64 - T },
    },
  ],
  gates: [
    // Margin-stitch gate in the narrow passage
    {
      id: "gate_stitch_1",
      rect: { x: 470, y: 300 - 96, width: 16, height: 96 },
      requiredAbility: "margin-stitch",
      lockedColor: "#22d3ee",
      opened: false,
    },
  ],
  enemies: [
    {
      id: "enemy_3",
      position: { x: 480, y: 900 },
      type: "proofwarden",
      groundY: 900,
      facingRight: false,
    },
  ],
  vineAnchors: [
    { id: "vine_1", position: { x: 300, y: 160 }, ropeLength: 100, type: "ceiling" },
    { id: "vine_2", position: { x: 650, y: 120 }, ropeLength: 80, type: "hanging" },
  ],
};

// ─── Preset 3: Vine Garden ──────────────────────────────────────────
// 1920×1080 room (large), Herbarium Folio theme, many vines, bouncy/icy surfaces

export const VINE_GARDEN: RoomData = {
  id: "vine-garden",
  name: "Vine Garden",
  width: 1920,
  height: 1080,
  biomeId: "herbarium-folio",
  defaultSpawn: { x: 480, y: 1080 - 64 - T },
  platforms: [
    // Floor (partial — gaps for challenge)
    { x: 0, y: 1080 - T, width: 640, height: T },
    { x: 800, y: 1080 - T, width: 320, height: T },
    { x: 1280, y: 1080 - T, width: 640, height: T },
    // Walls
    { x: 0, y: 0, width: T, height: 1080 },
    { x: 1920 - T, y: 0, width: T, height: 1080 },
    // Ceiling
    { x: 0, y: 0, width: 1920, height: T },

    // Bouncy platforms (mid-height)
    { x: 200, y: 700, width: 128, height: T, surfaceType: "bouncy" },
    { x: 500, y: 650, width: 128, height: T, surfaceType: "bouncy" },

    // Icy platforms
    { x: 900, y: 600, width: 192, height: T, surfaceType: "icy" },
    { x: 1200, y: 550, width: 128, height: T, surfaceType: "icy" },

    // Stepping stones through vine section
    { x: 400, y: 400, width: 96, height: T },
    { x: 700, y: 350, width: 96, height: T },
    { x: 1000, y: 300, width: 96, height: T },
    { x: 1300, y: 250, width: 128, height: T },

    // Far-end platform (after index-mark gate)
    { x: 1600, y: 300, width: 288, height: T },
  ],
  obstacles: [
    // Hazard zone in the floor gap
    { id: "obs_10", rect: { x: 640, y: 1080 - T, width: 160, height: T }, type: "hazard_zone", damage: 15, solid: false },
    { id: "obs_11", rect: { x: 1120, y: 1080 - T, width: 160, height: T }, type: "hazard_zone", damage: 15, solid: false },
  ],
  exits: [
    // Bottom exit → Vertical Shaft
    {
      direction: "bottom",
      zone: { x: 400, y: 1080 - EXIT_ZONE_DEPTH, width: 160, height: EXIT_ZONE_DEPTH },
      targetRoomId: "vertical-shaft",
      targetSpawnPoint: { x: 480, y: T + 16 },
    },
  ],
  gates: [
    // Index Mark gate at far end
    {
      id: "gate_index_1",
      rect: { x: 1580, y: 300 - 96, width: 16, height: 96 },
      requiredAbility: "index-mark",
      lockedColor: "#a78bfa",
      opened: false,
    },
    // Paste-over gate mid-section
    {
      id: "gate_paste_1",
      rect: { x: 850, y: 600 - 96, width: 16, height: 96 },
      requiredAbility: "paste-over",
      lockedColor: "#f59e0b",
      opened: false,
    },
  ],
  enemies: [
    {
      id: "enemy_4",
      position: { x: 300, y: 1080 - T },
      type: "binder",
      patrolRange: 150,
      groundY: 1080 - T,
      facingRight: true,
    },
    {
      id: "enemy_5",
      position: { x: 1400, y: 1080 - T },
      type: "binder",
      patrolRange: 120,
      groundY: 1080 - T,
      facingRight: false,
    },
  ],
  vineAnchors: [
    { id: "vine_3", position: { x: 300, y: 200 }, ropeLength: 140, type: "hanging" },
    { id: "vine_4", position: { x: 550, y: 150 }, ropeLength: 120, type: "ceiling" },
    { id: "vine_5", position: { x: 800, y: 180 }, ropeLength: 130, type: "branch" },
    { id: "vine_6", position: { x: 1050, y: 140 }, ropeLength: 110, type: "hanging" },
    { id: "vine_7", position: { x: 1350, y: 160 }, ropeLength: 100, type: "ceiling" },
  ],
};

// ─── All Presets ────────────────────────────────────────────────────

export const PRESET_ROOMS: Record<string, RoomData> = {
  "tutorial-corridor": TUTORIAL_CORRIDOR,
  "vertical-shaft": VERTICAL_SHAFT,
  "vine-garden": VINE_GARDEN,
};

export const PRESET_ROOM_NAMES: Record<string, string> = {
  "tutorial-corridor": "Tutorial Corridor",
  "vertical-shaft": "Vertical Shaft",
  "vine-garden": "Vine Garden",
};
