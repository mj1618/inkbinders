# INKBINDERS: The Library That Fights Back — Project Plan

## Project Overview

Inkbinders is a hand-inked 2D metroidvania built as a web application using Next.js, TypeScript, Convex.dev, and Tailwind CSS. The game features a custom game engine (no Phaser or similar frameworks) running in the browser.

The player is a junior archivist in a living library-city where every "book" is a biome. The library suffers a nightly corruption that rewrites rooms, flips symbols, and splices pages together. Progression comes not from unlocking movement abilities, but from gaining the power to *edit the world itself* — stitching passages, redacting obstacles, and pasting surface properties.

The tech stack is:
- **Next.js** with TypeScript for the application shell, routing, and test pages
- **Convex.dev** for backend/persistence (new project — do not touch existing Convex projects)
- **Tailwind CSS** for all UI styling
- **Custom game engine** built from scratch in TypeScript using HTML5 Canvas/WebGL
- **Nano Banana API** for asset generation (API key in `.env.local` as `NANOBANANA_API_KEY`)

## Design Pillars (Priority Order)

1. **Movement feel first** — the character must feel impossibly good to control before anything else is built
2. **Editing as progression** — you unlock the power to rewrite the world, not just movement upgrades
3. **Cozy-by-day / chaos-by-night** — tension loop that drives pacing and retention

## Goals & Success Criteria

- Every feature is developed and validated in its own isolated test page (`/test/[feature]`) before integration
- The test page index (`/test`) serves as the project's real progress tracker
- The "movement milestone" must pass before any content is built: the character controller passes the "empty room test" on `/test/movement-playground`
- Each test page has visible debug info, real-time tunable sliders, and clear pass criteria
- Test pages are permanent — they are the regression suite and tuning dashboard

## Scope

### In Scope
- Custom 2D game engine (rendering, physics, input, state machine) in TypeScript
- Full character controller: ground movement, jumping, wall mechanics, dash, transitions
- 4 editing abilities: Margin Stitch, Redaction, Paste-Over, Index Mark
- Melee combat system with 2 weapons (quill-spear, ink snap)
- 3 enemy archetypes + 3 bosses (Footnote Giant, Misprint Seraph, Index Eater)
- 4 biomes with unique movement textures + hub (Scribe Hall)
- Day/night cycle with corruption modifiers
- Ink Card crafting system
- Room layout/gating system (60–90 rooms)
- 22 test pages built in strict order
- Asset generation via Nano Banana API
- Convex backend for game state persistence

### Out of Scope (for now)
- Multiplayer
- Mobile/touch controls
- Audio/music system (can be added later)
- Steam integration
- Save file import/export
- Localization
- Late-game variant abilities (2 optional — defer)

## Architecture / Approach

### Application Structure
```
src/
  app/                    # Next.js app router
    page.tsx              # Landing / main game
    test/
      page.tsx            # Test page index (hub)
      ground-movement/    # Each test page is its own route
      jumping/
      wall-mechanics/
      dash/
      transitions/
      movement-playground/
      margin-stitch/
      redaction/
      paste-over/
      index-mark/
      combat-melee/
      enemies/
      boss/[boss-name]/
      biome/[biome-name]/
      day-night/
      ink-cards/
      room-editor/
  engine/                 # Custom game engine
    core/                 # Game loop, timing, renderer
    physics/              # Collision, gravity, surfaces
    input/                # Input handling, buffering
    entities/             # Player, enemies, bosses
    states/               # State machine for player/entities
    abilities/            # Stitch, Redaction, Paste-Over, Index Mark
    world/                # Room system, biomes, day-night
    combat/               # Weapons, hitboxes, damage
    ui/                   # Debug overlays, HUD, menus
  components/             # React components (debug panels, sliders, overlays)
  lib/                    # Shared utilities
convex/                   # Convex backend schema and functions
```

### Engine Design Principles
- Fixed timestep game loop with interpolated rendering
- Component-entity approach for game objects
- State machine for player character (idle, running, jumping, wall-sliding, dashing, etc.)
- All physics values exposed as tunable parameters
- Debug overlay system that can be toggled per-system
- Canvas-based rendering with layered draw calls (background, world, entities, FX, debug)

### Test Page Architecture
- Each test page is a standalone Next.js route
- Mounts a canvas and instantiates the engine with only the systems needed for that feature
- React sidebar/overlay with sliders bound to engine parameters via refs
- Debug renderer draws hitboxes, velocity vectors, state labels, etc.
- Test index page reads status from a config or Convex to show progress

## Milestones

### Phase 1 — Foundation & Core Movement
**Priority: CRITICAL — nothing else starts until this passes**

1. **Project scaffolding**: Next.js app, Convex project, Tailwind, folder structure, test page index
2. **Engine core**: Game loop, renderer, input system, basic entity system
3. **Ground movement** (`/test/ground-movement`): Variable-speed run, acceleration/deceleration curves, turn-snap, crouch-slide
4. **Jumping** (`/test/jumping`): Variable-height jump, coyote time, input buffering, apex float, air control
5. **Wall mechanics** (`/test/wall-mechanics`): Wall-slide with graduated friction, wall-jump with input lockout
6. **Dash** (`/test/dash`): 8-directional dash, i-frames, dash-cancel, speed boost into run
7. **Transitions** (`/test/transitions`): Seamless state transitions, squash-stretch, landing system
8. **Movement playground** (`/test/movement-playground`): Integration test with varied geometry, timer, ghost replay

### Phase 2 — Editing Abilities
**Priority: HIGH — the core differentiator**

9. **Margin Stitch** (`/test/margin-stitch`): Temporary passage creation between wall pairs
10. **Redaction** (`/test/redaction`): Selective obstacle erasure (spikes, lasers, barriers)
11. **Paste-Over** (`/test/paste-over`): Surface property transfer (bouncy, icy, sticky, conveyor)
12. **Index Mark** (`/test/index-mark`): Living map pins across multi-room areas

### Phase 3 — Combat
**Priority: HIGH — built on proven movement**

13. **Melee combat** (`/test/combat-melee`): Quill-spear and ink snap, zero-interruption attacking
14. **Enemies** (`/test/enemies`): Reader (rush), Binder (grapple), Proofwarden (shield) archetypes
15. **First boss** (`/test/boss/footnote-giant`): Footnote Giant fight — prove the boss pattern

### Phase 4 — World Systems
**Priority: MEDIUM — infrastructure for content**

16. **First biome** (`/test/biome/herbarium-folio`): Vine grapple movement texture, biome visuals
17. **Day/night cycle** (`/test/day-night`): Cozy day / chaotic night transitions, corruption modifiers
18. **Ink Cards** (`/test/ink-cards`): Crafting UI, stat modifications, stacking rules
19. **Room editor** (`/test/room-editor`): Layout sandbox, ability gates, room connections

### Phase 5 — Remaining Content
**Priority: MEDIUM — repeat proven patterns**

20. **Misprint Seraph boss** (`/test/boss/misprint-seraph`)
21. **Index Eater boss** (`/test/boss/index-eater`)
22. **Astral Atlas biome** (`/test/biome/astral-atlas`): Low-gravity movement texture
23. **Maritime Ledger biome** (`/test/biome/maritime-ledger`): Current streams movement texture
24. **Gothic Errata biome** (`/test/biome/gothic-errata`): Fear fog / input inversion texture

### Phase 6 — Integration & Polish
**Priority: LOWER — after all test pages pass**

25. Full game world assembly (60–90 rooms connected)
26. Scribe Hall hub (day loop: restore pages, decorate, craft)
27. Nightly corruption modifier system
28. Asset generation pipeline via Nano Banana API
29. Game state persistence via Convex

## Detailed Requirements

### Engine Core
- Fixed-timestep game loop (target 60fps, decouple update from render)
- Canvas 2D renderer with layer ordering (background → tiles → entities → FX → debug)
- Input system: keyboard with configurable bindings, input buffering queue, coyote time tracking
- Entity system: position, velocity, collision box, state machine, sprite
- Collision detection: AABB for entities, tilemap collision for world geometry
- Camera system: smooth follow with look-ahead

### Player Character State Machine
States: Idle, Running, Jumping, Falling, WallSliding, WallJumping, Dashing, Crouching, CrouchSliding, Attacking, Landing, HardLanding
- Every state transition must be seamless (no "seams")
- Dash-cancel can interrupt almost any state
- Attack can overlay onto movement states without interrupting them

### Ground Movement
- Acceleration curve: fast ramp-up (not linear), feels instant but not teleport-y
- Deceleration curve: tiny satisfying slide
- Turn-around: single-frame snap with dust puff particle
- Max speed: tunable
- Crouch: fast squash, preserves momentum into slide
- Crouch-slide: friction-based duration, can pass under gaps

### Jumping
- Variable-height: short tap = hop, hold = full arc
- Gravity split: lower gravity on rise, higher on fall
- Apex float: brief period of reduced gravity at peak
- Coyote time: 6–8 frames after leaving ledge
- Input buffer: 4–6 frames before landing
- Air control: full with slight momentum bias from launch direction

### Wall Mechanics
- Wall-slide: graduated friction (touch = slow, hold toward = grip)
- Wall-jump: fixed launch angle, brief input lockout (punchy not stiff)
- Chaining wall-jumps should feel rhythmic

### Dash
- 8-directional
- 1–2 frame wind-up
- Fixed distance, brief i-frames
- Dash-cancel from almost any state
- Ground dash preserves speed boost into run if holding forward
- Short cooldown: timing > spamming

### Combat
- Zero flow interruption — attack while moving, dashing, wall-sliding, jumping
- Quill-spear: fast mid-range, any direction, any movement state
- Ink snap: short range, auto-aim nearest enemy, maintains flow
- Hitstop on enemy only — player never freezes
- Near-zero commitment frames

### Test Page Requirements (applies to all)
- Standalone route under `/test/[feature]`
- Canvas + React debug panel sidebar
- Debug overlay: frame times, relevant state labels, velocity readouts, hitbox overlays
- All tunable values exposed as sliders/inputs with real-time updates
- Clear pass criteria displayed on page
- Status indicator: not started / in progress / passing
- Permanent — never deleted

### Art Style
- Hand-inked lineart + soft watercolor fill
- Limited palette per biome (4–6 colors)
- Chunky, readable silhouettes
- Exaggerated squash-and-stretch on player character
- Style lock prompt: "hand-inked 2D game art, clean linework, watercolor wash fill, paper grain texture, high readability, metroidvania tileset, cohesive style, no text"

### Production Scope
- 60–90 rooms total
- 4 core editing abilities + 2 optional late-game variants
- 4 biomes + hub
- 4 main bosses + 2 mini-bosses
- Nightly corruption modifiers for replay value
