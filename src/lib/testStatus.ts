export type TestStatus = "not-started" | "in-progress" | "passing";

export interface TestPageConfig {
  name: string;
  path: string;
  phase: number;
  phaseName: string;
  status: TestStatus;
  description: string;
}

export const TEST_PAGES: TestPageConfig[] = [
  // Phase 1 — Core Movement
  { name: "Ground Movement", path: "/test/ground-movement", phase: 1, phaseName: "Core Movement", status: "in-progress", description: "Variable-speed run, acceleration curves, turn-snap, crouch-slide" },
  { name: "Jumping", path: "/test/jumping", phase: 1, phaseName: "Core Movement", status: "in-progress", description: "Variable-height jump, coyote time, input buffering, apex float" },
  { name: "Wall Mechanics", path: "/test/wall-mechanics", phase: 1, phaseName: "Core Movement", status: "in-progress", description: "Wall-slide with graduated friction, wall-jump with input lockout" },
  { name: "Dash", path: "/test/dash", phase: 1, phaseName: "Core Movement", status: "in-progress", description: "8-directional dash, i-frames, dash-cancel, speed boost" },
  { name: "Transitions", path: "/test/transitions", phase: 1, phaseName: "Core Movement", status: "in-progress", description: "Seamless state transitions, squash-stretch, landing system" },
  { name: "Movement Playground", path: "/test/movement-playground", phase: 1, phaseName: "Core Movement", status: "in-progress", description: "Integration test — the movement milestone gate" },
  // Phase 2 — Abilities
  { name: "Margin Stitch", path: "/test/margin-stitch", phase: 2, phaseName: "Abilities", status: "in-progress", description: "Temporary passage creation between wall pairs" },
  { name: "Redaction", path: "/test/redaction", phase: 2, phaseName: "Abilities", status: "in-progress", description: "Selective obstacle erasure" },
  { name: "Paste-Over", path: "/test/paste-over", phase: 2, phaseName: "Abilities", status: "in-progress", description: "Surface property transfer" },
  { name: "Index Mark", path: "/test/index-mark", phase: 2, phaseName: "Abilities", status: "in-progress", description: "Living map pins across rooms" },
  // Phase 3 — Combat
  { name: "Combat Melee", path: "/test/combat-melee", phase: 3, phaseName: "Combat", status: "in-progress", description: "Quill-spear and ink snap weapons" },
  { name: "Enemies", path: "/test/enemies", phase: 3, phaseName: "Combat", status: "in-progress", description: "Reader, Binder, Proofwarden archetypes" },
  { name: "Footnote Giant", path: "/test/boss/footnote-giant", phase: 3, phaseName: "Combat", status: "in-progress", description: "First boss — prove the boss pattern" },
  // Phase 4 — World Systems
  { name: "Herbarium Folio", path: "/test/biome/herbarium-folio", phase: 4, phaseName: "World Systems", status: "in-progress", description: "First biome — vine grapple movement texture" },
  { name: "Day/Night Cycle", path: "/test/day-night", phase: 4, phaseName: "World Systems", status: "in-progress", description: "Cozy day / chaotic night transitions" },
  { name: "Ink Cards", path: "/test/ink-cards", phase: 4, phaseName: "World Systems", status: "in-progress", description: "Crafting UI and stat modifications" },
  { name: "Room Editor", path: "/test/room-editor", phase: 4, phaseName: "World Systems", status: "in-progress", description: "Layout sandbox and ability gates" },
  // Phase 5 — Remaining Content
  { name: "Misprint Seraph", path: "/test/boss/misprint-seraph", phase: 5, phaseName: "Content", status: "in-progress", description: "Second boss — aerial Misprint Seraph" },
  { name: "Index Eater", path: "/test/boss/index-eater", phase: 5, phaseName: "Content", status: "in-progress", description: "Third boss — ground-mobile platform devourer" },
  { name: "Astral Atlas", path: "/test/biome/astral-atlas", phase: 5, phaseName: "Content", status: "in-progress", description: "Low-gravity movement texture" },
  { name: "Maritime Ledger", path: "/test/biome/maritime-ledger", phase: 5, phaseName: "Content", status: "in-progress", description: "Current streams movement texture" },
  { name: "Gothic Errata", path: "/test/biome/gothic-errata", phase: 5, phaseName: "Content", status: "in-progress", description: "Fear fog / input inversion" },
  // Phase 6 — Integration
  { name: "Save/Load", path: "/test/save-load", phase: 6, phaseName: "Integration", status: "in-progress", description: "Convex persistence and save slot system" },
  { name: "HUD & UI", path: "/test/hud", phase: 6, phaseName: "Integration", status: "in-progress", description: "In-game HUD, ability bar, and pause menu" },
  { name: "World Assembly", path: "/test/world-assembly", phase: 6, phaseName: "Integration", status: "in-progress", description: "Connected world with Scribe Hall hub" },
  { name: "Sprites", path: "/test/sprites", phase: 6, phaseName: "Integration", status: "in-progress", description: "Sprite rendering and asset pipeline" },
  { name: "Main Menu & Game Flow", path: "/play", phase: 6, phaseName: "Integration", status: "in-progress", description: "Title screen, save slots, game session, /play route" },
  { name: "Herbarium Wing", path: "/test/herbarium-wing", phase: 6, phaseName: "Content", status: "in-progress", description: "8 rooms: vine traversal, ability gates, mini-boss" },
];
