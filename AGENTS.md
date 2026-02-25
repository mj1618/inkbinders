# Inkbinders — Agent Knowledge Base

## Project Overview

Inkbinders is a hand-inked 2D metroidvania built with Next.js, TypeScript, Convex.dev, and Tailwind CSS. It uses a custom Canvas-based game engine (no Phaser). The player controls a living manuscript navigating enchanted libraries, mastering ink-based abilities, and surviving day/night cycles.

## Tech Stack

- **Framework:** Next.js (App Router) with TypeScript
- **Styling:** Tailwind CSS v4
- **Backend:** Convex.dev (fresh project — schema in `convex/schema.ts`)
- **Game Engine:** Custom Canvas-based engine in `src/engine/`
- **Assets:** Nano Banana API (key in `.env.local` as `NANOBANANA_API_KEY`)

## Folder Structure

```
inkbinders/
├── convex/               # Convex backend (schema, functions)
├── design/               # Game design docs
├── public/               # Static assets
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── test/         # Test page routes (one per feature)
│   │   │   ├── page.tsx  # Test index hub
│   │   │   ├── ground-movement/
│   │   │   ├── jumping/
│   │   │   ├── boss/     # Boss test pages
│   │   │   ├── biome/    # Biome test pages
│   │   │   └── ...
│   │   ├── layout.tsx
│   │   └── page.tsx      # Landing page
│   ├── components/
│   │   ├── canvas/       # GameCanvas — mounts the engine
│   │   ├── debug/        # DebugPanel, Slider — test page controls
│   │   └── TestPageStub.tsx
│   ├── engine/
│   │   ├── core/         # Game loop, timing, renderer
│   │   ├── physics/      # Collision, gravity, surfaces
│   │   ├── input/        # Input handling, buffering
│   │   ├── entities/     # Player, enemies, bosses
│   │   ├── states/       # State machine for player/entities
│   │   ├── abilities/    # Stitch, Redaction, Paste-Over, Index Mark
│   │   ├── world/        # Room system, biomes, day-night
│   │   ├── combat/       # Weapons, hitboxes, damage
│   │   └── ui/           # Debug overlays, HUD, menus
│   └── lib/
│       ├── constants.ts  # Game-wide constants
│       ├── types.ts      # Shared TypeScript types
│       └── testStatus.ts # Test page status config
├── swarm/                # Swarm orchestration (tasks, plan)
│   ├── PLAN.md
│   ├── todos/
│   └── done/
├── AGENTS.md             # This file
└── CLAUDE.md             # Claude-specific instructions
```

## Key Conventions

- **Test-page-first development:** Every feature gets a test page as a Next.js route under `src/app/test/[feature]/`. Test pages mount a canvas and a React debug panel.
- **Dark theme everywhere:** All UI uses dark backgrounds. Fits the "library at night" vibe and is easier on eyes during dev.
- **Tailwind for styling:** No CSS modules or styled-components.
- **Custom game engine:** Canvas-based rendering with a fixed-timestep game loop. No Phaser, no external game frameworks.
- **Debug overlays:** Render hitboxes, velocity vectors, state labels directly on the canvas.
- **Debug panels:** React components with sliders for all tunable values. All physics values are tunable at runtime.
- **Movement feel is priority #1:** If it doesn't feel good, it's not done.

## Running the Project

```bash
npm run dev      # Start Next.js dev server (port 4000)
npm run build    # Production build
npx tsc --noEmit # Type-check without emitting
```

The dev server runs on **port 4000** (not the Next.js default of 3000).

## Where Things Live

- **Game design plan:** `swarm/PLAN.md`
- **Design docs:** `design/`
- **Test status config:** `src/lib/testStatus.ts` — update status when a feature is implemented
- **Engine entry point:** `src/engine/index.ts`

## Architecture Patterns (Learned from Implementation)

### Player State Machine
The Player entity (`src/engine/entities/Player.ts`) uses a `StateMachine` with enter/update/exit lifecycle hooks. States: IDLE, RUNNING, CROUCHING, CROUCH_SLIDING, JUMPING, FALLING, WALL_SLIDING, WALL_JUMPING, DASHING, HARD_LANDING (10 states total).

Key patterns:
- **Dash-cancel** uses `tryDash()` helper, checked early in each state's update (after grounded check, before movement)
- **Jump** uses `tryJump()` helper with input buffering and coyote time
- **State priority**: grounded check → dash → jump → movement input
- States are string constants (e.g., `STATE_IDLE = "IDLE"`)

### PlayerParams
All tunable physics values are in the `PlayerParams` interface with `DEFAULT_PLAYER_PARAMS` defaults. Test pages pass params via React refs so sliders update in real time. Never use magic numbers — always add to PlayerParams.

### TileMap & Collision
- `TileMap` holds an array of `Platform` objects (AABB rects)
- `resolveCollisions()` uses minimum-penetration-depth per overlap, with up to 3 passes
- `isTouchingWall()` uses 1px probe rects for adjacency detection
- `hasHeadroom()` checks if the player can stand up from crouch

### Test Page Pattern
Each test page follows this structure:
1. `'use client'` directive
2. Imports `GameCanvas`, `DebugPanel`, `Slider` components
3. Creates engine, player, tilemap in a `useEffect`
4. Wires up custom update/render callbacks via `engine.onUpdate()`/`engine.onRender()`
5. Debug panel with collapsible slider sections
6. Pass criteria checklist at bottom

### Engine Systems
- `ParticleSystem` (`src/engine/core/ParticleSystem.ts`) — immediate-mode particles, colored rects with velocity/gravity/alpha fade, max 200 particles
- `ScreenShake` (`src/engine/core/ScreenShake.ts`) — frame-count-based shake with decaying intensity
- `Camera` (`src/engine/core/Camera.ts`) — viewport with world↔screen conversion, smooth follow with exponential lerp (`follow()`), velocity-based look-ahead (`lookaheadX`/`lookaheadY`), world bounds clamping, `snapTo()` for instant position set
- `InputManager` — keyboard input with per-frame snapshots, buffered input queue, `isPressed()`/`isHeld()`/`consumeBufferedInput()` API

### Input Actions
Defined in `InputManager.ts`: Left, Right, Up, Down, Jump, Dash, Attack, Crouch, Ability1, Ability2, Ability3. When adding new actions, add the action constant AND the key binding in `DEFAULT_KEY_MAP`. Current bindings: E = Ability1 (Stitch), Q = Ability2 (Redaction), R = Ability3 (Paste-Over / Index Mark — each test page wires it to its own ability).

### TileMap Exclusion Zones
`TileMap` supports `exclusionZones` — rectangles where specific platforms are excluded from collision. Used by abilities (Margin Stitch) to create temporary passages through walls. The `resolveCollisions()` method checks `isPlatformExcluded()` before resolving each platform. API: `addExclusionZone(rect, platforms)` / `removeExclusionZone(rect)`.

### Ability System Pattern
Abilities live in `src/engine/abilities/`. They are **world-editing systems**, not player states — the Player's state machine is NOT modified by abilities. Key patterns:
- Each ability has a `Params` interface with `DEFAULT_*_PARAMS` defaults
- Abilities operate on the TileMap/world, not the Player entity
- Activation is instant (zero flow interruption — player keeps moving)
- Wire up in the test page's update callback: `ability.scanForTargets()` → input check → `ability.activate()` → `ability.update(dt)`
- Abilities use ParticleSystem for visual effects and render directly on the canvas context

### Obstacles System
`src/engine/physics/Obstacles.ts` defines the `Obstacle` interface — hazards that can be redacted (erased). Types: `spikes`, `barrier`, `laser`, `hazard_zone`.
- **Spikes**: Not solid, deal damage on overlap. When redacted, become inert.
- **Barriers**: Solid (have corresponding TileMap Platform). When redacted, exclusion zone removes collision.
- **Lasers/Hazard zones**: Not solid, deal damage on overlap.
- Factory helpers: `createSpikes()`, `createBarrier()`, `createLaser()`, `createHazardZone()`
- Overlap checks: `checkDamageOverlap()` for active obstacles dealing damage
- Obstacles are test-page-local for now (created in test level setup, not a global registry)

### Redaction System
`Redaction` class (`src/engine/abilities/Redaction.ts`) — targeted obstacle erasure:
- Cone-based aim targeting: scans obstacles within `maxRedactionRange` using `aimConeHalfAngle` cone
- `getAimDirection()` helper computes aim from held directional input, defaults to facing direction
- Solid obstacles use TileMap exclusion zones (same as Margin Stitch)
- Player ejection on restore: `getEjectionForObstacle()` pushes player out if inside a restoring barrier
- Duration-based with visual timer bars, ink mark expansion animation, particle effects
- Max 2 simultaneous active redactions with cooldown between uses

### Index Mark System
`IndexMark` class (`src/engine/abilities/IndexMark.ts`) — waypoint teleportation:
- Tap ability key (short press < holdThreshold frames) to place a colored bookmark mark at the player's position
- Hold ability key (≥ holdThreshold frames) to enter teleport selection mode, Left/Right to cycle marks, release to teleport
- Max 4 marks; placing a 5th replaces the oldest (FIFO)
- Teleport: instant position set, velocity zeroed, brief i-frames, camera snap (>400px) or fast lerp (≤400px)
- Input: `Ability3` action bound to `r` key; uses `isReleased()` on InputManager for key-up detection
- `onKeyDown()` / `onKeyHeld(input)` / `onKeyUp(playerPos, grounded)` — three-method input API
- Mark colors: amber (#f59e0b), blue (#3b82f6), green (#10b981), red (#ef4444) — cycling through slots
- `PlacedMark` stores position, colorIndex, wasGrounded (for landing behavior at destination)
- `TeleportState` tracks selecting, selectedIndex, holdFrames, visual effect timers
- Test page handles position/velocity override and camera snap — IndexMark returns the target position
- This is a navigation/utility ability — no physics modification, no TileMap changes
- Test level: 3840×1080 with 4 areas (Starting, Hazard Corridor, Vertical Shaft, Multi-Mark Puzzle)
- Goal zones test teleport utility: Goal A (tower-to-platform), Goal D (4 chambers in 15s)

## Current Progress

### Phase 1 — Core Movement (Complete)

| Step | Feature | Status |
|------|---------|--------|
| 1 | Project scaffolding | Done |
| 2 | Engine core | Done |
| 3 | Ground movement | Done |
| 4 | Jumping | Done |
| 5 | Wall mechanics | Done |
| 6 | Dash | Done |
| 7 | Transitions | Done |
| 8 | Movement playground | Done |

### Phase 2 — Abilities (Complete)

| Step | Feature | Status |
|------|---------|--------|
| 1 | Margin Stitch | Done |
| 2 | Redaction | Done |
| 3 | Paste-Over | Done |
| 4 | Index Mark | Done |

### Phase 3 — Combat (Complete)

| Step | Feature | Status |
|------|---------|--------|
| 1 | Combat Melee | Done |
| 2 | Enemies | Done |
| 3 | Footnote Giant (Boss) | Done |

### Phase 4 — World Systems (Complete)

| Step | Feature | Status |
|------|---------|--------|
| 1 | Herbarium Folio (biome) | Done |
| 2 | Day/Night Cycle | Done |
| 3 | Ink Cards | Done |
| 4 | Room Editor | Done |

### Phase 5 — Remaining Content (Complete)

| Step | Feature | Status |
|------|---------|--------|
| 1 | Misprint Seraph (Boss) | Done |
| 2 | Index Eater (Boss) | Done |
| 3 | Astral Atlas (biome) | Done |
| 4 | Maritime Ledger (biome) | Done |
| 5 | Gothic Errata (biome) | Done |

### Phase 6 — Integration & Polish (Complete)

| Step | Feature | Status |
|------|---------|--------|
| 1 | Game World Assembly | Done |
| 2 | Asset Pipeline & Sprites | Done |
| 3 | Convex Save System | Done |
| 4 | HUD & Game UI | Done |
| 5 | Main Menu & Game Flow | Done |
| 6 | Herbarium Wing Rooms (content) | Done |

### Boss Pattern
Bosses follow the `FootnoteGiant` pattern in `src/engine/entities/bosses/`:
- Separate params file (`*Params.ts`) with `DEFAULT_*_PARAMS`
- `StateMachine<BossClass>` with named states and enter/update/exit hooks
- `stateTimer` counts frames within each state
- `attackSequence: string[]` with `sequenceIndex` cycling through attacks per phase
- `getActiveHazards(): DamageZone[]` returns current damage zones for player collision
- `isVulnerable()` checks if boss is in a punishable state
- `takeDamage(damage, hitstopFrames)` deals damage, triggers phase transitions
- `update(dt, playerBounds, playerPosition)` advances AI
- `render(ctx, camera)` draws all visuals
- Systems are set externally: `particleSystem`, `screenShake`, `camera`
- `DamageZone` interface shared via `src/engine/entities/bosses/types.ts` (or inline in FootnoteGiant)

### Index Eater Boss
`IndexEater` class (`src/engine/entities/bosses/IndexEater.ts`) — ground-mobile platform-devouring boss:
- **Ground-mobile**: walks along floor platforms, climbs walls and ceilings in Phase 3
- **Core mechanic**: devours destructible platforms, shrinking the arena over time
- **3 phases**: Phase 1 (ground chase + attacks), Phase 2 (devour + ink flood), Phase 3 (wall climbing + drop pounce + death thrash)
- **Destructible platforms**: `DestructiblePlatform` tracks floor (6), mid (4), high (3) platforms with destroyed/cracking state
- **Surface attachment**: `currentSurface` field ("floor" | "left-wall" | "right-wall" | "ceiling") determines movement and rendering rotation
- **Arena**: 1440×640, wider than tall, horizontal focus
- **`onPlatformDestroyed` callback**: Test page rebuilds TileMap when platforms are destroyed
- **`initDestructiblePlatforms(floors, mids, highs)`**: initializes trackable platforms
- **`getActivePlatforms()`**: returns non-destroyed platforms for TileMap rebuild
- **Auto-crumble (Phase 3)**: mid/high platforms self-destruct on a timer with warning cracks
- **Death Thrash**: at HP ≤ 3, boss bounces between surfaces rapidly, then collapses (big punish window)
- **Vulnerable states**: `LUNGE_RECOVERY`, `DEVOUR_STUNNED`, `POUNCE_STUNNED`, `DEATH_THRASH_COLLAPSE`
- **DamageZone types added**: "lunge", "whip", "spit", "devour-shockwave", "flood", "pounce", "chain-storm", "thrash"
- **Ink flood**: continuous damage zones on floor sections, tracked via `inkFloodZones[]`, fade over time
- **Card projectiles**: `spitCards[]` — fan pattern, stick into platforms on collision, destroyed on player hit

### Biome System
`BiomeTheme` interface (`src/engine/world/Biome.ts`) defines visual themes: background color, platform colors, ambient particle colors, foreground tint, palette. `HERBARIUM_FOLIO_THEME` is the first implementation. Biomes are purely visual + mechanic overlay — they don't modify player physics (that's handled by surface types).

### VineSystem
`VineSystem` class (`src/engine/world/VineSystem.ts`) — pendulum-based vine grapple:
- Simple pendulum model: `α = -(g/L)*sin(θ)` with pump input and damping
- `VineAnchor` defines anchor points (position, ropeLength, active, type)
- `VineParams` has all tunable values: attachRange, swingGravity, angularDamping, releaseBoost, pumpForce, etc.
- Player presses E (Ability1) near anchor to attach, jump/E to detach
- While swinging, `player.active = false` to suppress EntityManager's `player.update()`. Test page manually updates position from `vineSystem.swingPosition` and renders the player with slight rotation.
- On detach, `player.active = true`, velocity set to `swingVelocity * releaseBoost`
- Momentum transfer: player's horizontal velocity converts to angular velocity on attach
- Left/Right pumps swing, Up/Down adjusts rope length
- Vine-to-vine chaining: release from one vine, catch another mid-air
- Auto-detach on platform collision during swing
- Renders in world coordinates (called within camera transform context)

### GravityWellSystem
`GravityWellSystem` class (`src/engine/world/GravityWellSystem.ts`) — localized gravity wells for the Astral Atlas biome:
- `GravityWell` interface: id, position (Vec2), radius, strength, type ("attract" | "repel"), active, color
- `GravityWellParams` has all tunable values: globalGravityMultiplier (biome-wide low gravity), falloff exponent, maxWellForce cap, pulseSpeed, affectsDash toggle
- `DEFAULT_GRAVITY_WELL_PARAMS`: globalGravityMultiplier=0.4, falloff=1.5, maxWellForce=400, affectsDash=false
- `computeForce(position)` — sum forces from all active wells using falloff: `strength * (1 - (dist/radius)^falloff)`, clamped to maxWellForce
- `applyToVelocity(position, velocity, dt)` — adds well force × dt to velocity directly (additive, like wind)
- `getWellAt(position)` — returns the well containing the position, or null
- `render(ctx, camera, time)` — pulsing concentric rings, directional arrow particles, center dots
- `renderDebug(ctx, camera)` — radius circles, strength/type labels
- `renderForceVector(ctx, position)` — gold arrow showing net force on player
- Global gravity: test page overrides `player.params.riseGravity/fallGravity/maxFallSpeed` each frame with `base × globalGravityMultiplier`
- Dash immunity: skip `applyToVelocity()` when player state is DASHING (unless affectsDash=true)
- Wells are world objects, not player modifications — pure engine class, no React dependencies

### CurrentSystem
`CurrentSystem` class (`src/engine/world/CurrentSystem.ts`) — area-based directional force zones for the Maritime Ledger biome:
- `CurrentZone` interface: id, rect, direction (Vec2), strength (px/s²), active, type (`"stream" | "gust" | "whirlpool" | "jet"`), clockwise (whirlpool), gustOnDuration/gustOffDuration/gustTimer/gustActive (gust)
- `CurrentParams` has all tunable values: globalStrengthMultiplier, affectsGrounded, groundedMultiplier (0.4), maxCurrentVelocity (500), rampUpRate (0.15), dashOverridesCurrent, particleDensity
- Force application: `applyToPlayer(player, dt, isGrounded, isDashing)` — modifies velocity directly, returns applied force vector
- **Current types**: stream (steady directional), gust (pulsing on/off updraft/downdraft), whirlpool (tangential force around center), jet (high-strength narrow launcher)
- **Whirlpool math**: force direction is tangent to circle centered on zone, perpendicular to (player - center): `clockwise → (ny, -nx)`, counter-clockwise → `(-ny, nx)`
- **Gust pulsing**: `gustOnDuration` (2.0s) + `gustOffDuration` (1.5s) cycle. Telegraph: 0.3s before activation, particles stir at 15% strength
- **Ramp up/down**: force smoothly ramps 0→1 at `rampUpRate` per frame when entering a zone, decays at same rate on exit (prevents velocity snaps)
- **Dash override**: when `dashOverridesCurrent=true`, dashing ignores all current forces (player punches through)
- **Grounded multiplier**: currents are 40% effective while grounded (friction counteracts), full strength airborne
- **Rendering**: `renderFlow()` draws animated directional flow lines/arrows in-world. `renderDebug()` shows zone outlines + labels + force vectors
- **Particles**: `updateParticles()` spawns bubble/droplet particles inside visible zones, moving in current direction
- Currents are world systems, NOT surface types — area-based force fields independent of platform contact
- Wire in test page update: `currentSystem.updateGusts(dt)` → `currentSystem.applyToPlayer()` (after player.update, before resolveCollisions) → `currentSystem.updateParticles()`

### FogSystem
`FogSystem` class (`src/engine/world/FogSystem.ts`) — fog-of-war and input disruption zones for the Gothic Errata biome:
- `FogZone` interface: id, rect, type (`"fog" | "inversion" | "scramble"`), density (0-1), active
- `FogSystemParams` has all tunable values: baseFogRadius (200), minFogRadius (80), fogFadeInRate (0.08), fogFadeOutRate (0.15), dashClearsFog, dashClearDuration (15 frames), inversionAffectsDash, scrambleAffectsDash, inversionTintStrength (0.15), scrambleGlitchStrength (0.2), controlTransitionDelay (10 frames)
- `update(playerBounds, isDashing)` → `FogState` with inFog, fogLevel, visibilityRadius, inverted, scrambled, dashClearing, activeZoneIds
- **Fog zones**: Radial visibility mask centered on player. Canvas compositing: full-screen dark overlay + `destination-out` radial gradient hole. Radius shrinks with density: `baseFogRadius + (minFogRadius - baseFogRadius) * fogLevel`
- **Inversion zones**: Swap Left ↔ Right input actions. Red tint on screen edges as visual indicator
- **Scramble zones**: Fisher-Yates shuffle of [Left, Right, Up, Down] on zone entry. Mapping stays consistent within zone, re-randomizes on re-entry. Green glitch scanlines as indicator
- **Input remapping**: Uses `InputManager.setActionRemap(Map)` — transparent layer that redirects `isHeld()/isPressed()/consumeBufferedInput()` queries. Player code is unmodified.
- `getActiveRemap()` → `Map<string, string> | null` — call before `player.update()`, set via `input.setActionRemap()`, clear after
- **Dash clears fog**: When `dashClearsFog=true`, dashing sets `dashClearTimer` which forces fogLevel to 0 temporarily
- **Transition delay**: `controlTransitionDelay` frames of normal controls after entering an inversion/scramble zone (prevents mid-air control loss)
- **Zone rendering**: `renderZoneBoundaries()` draws atmospheric borders (fog = purple glow + drifting particles, inversion = pulsing red + reversed arrows, scramble = jittering green + static dots). `renderFogOverlay()` and `renderControlEffects()` are screen-space overlays.
- Inversion and scramble are mutually exclusive (inversion takes priority if overlapping)
- FogSystem is a pure engine class — no React dependencies, no Player/TileMap modification

### BiomeBackground
`BiomeBackground` class (`src/engine/world/BiomeBackground.ts`) — parallax background layers:
- Each layer has a `parallaxFactor` (0 = fixed, 1 = moves with camera)
- `createHerbariumBackground()` generates 3 deterministic layers (seeded pseudo-random)
- Rendered in screen-space: temporarily reset camera transform, apply parallax offsets, re-apply camera
- Layer 1 (0.1): ruled lines + faint leaf silhouettes
- Layer 2 (0.3): stems and leaf outlines
- Layer 3 (0.6): vine tendrils

### Day/Night Cycle System
`DayNightCycle` class (`src/engine/world/DayNightCycle.ts`) — temporal rhythm system:
- Normalized time model: `t` from 0.0 (midnight) to 1.0 (midnight again), with 4 phases: dawn, day, dusk, night
- Phase boundaries computed from `dayFraction` (default 0.5) and dawn/dusk durations
- `update(dt)` advances time; `getTimeOfDay()`, `getLightLevel()`, `getCorruptionIntensity()`, `getAtmosphere()` derive state
- `skipTo(timeOfDay)` and `setTime(t)` for debug control; `params.running` for pause/resume
- Default cycle: 120s total, 50% day, 8s dawn/dusk transitions
- **The cycle is a world system, NOT a player modification** — test page reads cycle state and applies effects

`DayNightAtmosphere` (`src/engine/world/DayNightAtmosphere.ts`) — color palettes:
- 4 palettes: DAY_COLORS (warm parchment), NIGHT_COLORS (deep indigo), DAWN_COLORS (rosy pink), DUSK_COLORS (amber)
- `interpolateColors(a, b, t)` smoothly blends between palettes
- `lerpColor()` for hex, `lerpRgba()` for rgba strings

`CorruptionModifiers` (`src/engine/world/CorruptionModifiers.ts`) — night corruption effects:
- 5 modifiers with staggered thresholds: ink-bleed (0.2), surface-flip (0.3), platform-flicker (0.4), fog-of-war (0.5), gravity-pulse (0.7)
- Surface flip cycles: normal→icy→bouncy→sticky→conveyor→normal
- Gravity pulse: brief reversal at deep night (configurable interval/duration/multiplier)
- Fog-of-war: radial visibility that shrinks with corruption intensity
- Test page orchestrates: reads corruption state, applies to platforms/gravity/particles

`DayNightRenderer` (`src/engine/world/DayNightRenderer.ts`) — static rendering helpers:
- Background, light overlay, fog overlay, fog-of-war (radial gradient via canvas compositing)
- Clock HUD with sun/moon icons and progress arc
- Corruption chromatic aberration distortion (>0.5 corruption only)
- Platform darkness and flicker overlays

### Ink Cards System
`src/engine/cards/` — crafting, stat modification, and deck management system:
- **InkCard** (`InkCard.ts`): Data model for cards — `CardCategory` (swiftness/might/resilience/precision/arcana), `CardTier` (1/2/3), `CardStat` (20 stat types), `StatModifier` (additive or multiplicative), `InkCard` (instance), `CardDeck` (collection + equipped). Category colors and stat display names exported as constants.
- **CardDefinitions** (`CardDefinitions.ts`): 15 card definitions × 3 tiers = 45 card variants. `createCard(definitionId, tier)` factory. Categories: Swiftness (run/jump/dash/air), Might (spear/snap damage/reach + attack speed), Resilience (health/i-frames/KB resistance), Precision (coyote/buffer/wall mechanics), Arcana (ability CD/duration/range).
- **CardModifierEngine** (`CardModifierEngine.ts`): Core system that computes aggregate stat modifiers from equipped cards. `computeModifiers()` → `ComputedModifiers` (additive + multiplicative maps). `applyToPlayerParams()`, `applyToCombatParams()`, `applyToHealthParams()` produce new param objects (never mutate input). Diminishing returns (0.7× for 2nd card on same stat), stat caps (prevent game-breaking builds), frame-count rounding. `getModifierSummary()` for UI display.
- **CraftingSystem** (`CraftingSystem.ts`): Combine 2 cards of same definition + tier → 1 card of next tier. `getAvailableCrafts()`, `canCraft()`, `craft()`. Tier 3 is max.
- **CardRenderer** (`CardRenderer.ts`): Canvas-based card UI rendering — individual cards (80×110px, category-colored border, tier dots, glyph, name), deck bar (equipped slots), collection grid (4-column scrollable), crafting panel, stat comparison, tooltips.
- **Pattern**: Cards do NOT directly mutate params. Test page holds base params + calls `cardEngine.applyTo*Params(baseParams)` each frame → syncs result to player/combat. Deck mode swaps the render callback (card UI instead of game world); update callback skipped.
- **Modifier order**: additive first, then multiplicative, then stat caps. `dashCooldownReduction` is subtractive (reduces frames). `attackSpeedBoost` multiplies all 6 combat frame-count params.
- **Test page**: Play mode (sandbox + target dummy + cards modify stats) / Deck mode (collection grid + crafting + stat preview). Tab toggles modes. Arrow keys + mouse for navigation. Enter = equip/unequip. C = craft. Q = switch panel focus.

### Room System
`src/engine/world/Room.ts`, `RoomManager.ts`, `RoomRenderer.ts`, `RoomEditor.ts`, `presetRooms.ts` — room data model, runtime management, visual editor:
- **RoomData**: Serializable room definition containing platforms, obstacles, exits, ability gates, enemy spawns, vine anchors, biome ID, default spawn point
- **RoomManager**: Runtime loading (RoomData → TileMap + Obstacle[] + gates), exit zone detection, fade-to-black room transitions (0.3s out → swap → 0.3s in), ability gate opening with TileMap platform removal, session-scoped gate persistence
- **RoomRenderer**: Static rendering functions — gates (pulsing colored barriers with ability glyph), exit indicators (directional arrows), bounds outline, transition overlay, spawn/enemy/vine markers
- **RoomEditor**: Interactive editor class with 9 tools (select, platform, obstacle, exit, gate, enemy, vine, spawn, erase), grid snap, hit testing, element selection/move/delete, JSON import/export, middle-mouse camera panning
- **AbilityGate**: Colored barriers requiring specific abilities — gates are solid (added as TileMap platforms), removed when opened. Colors: margin-stitch=#22d3ee, redaction=#ef4444, paste-over=#f59e0b, index-mark=#a78bfa
- **Preset rooms**: Tutorial Corridor (1920×540), Vertical Shaft (960×1080), Vine Garden (1920×1080) — connected via exits for testing room transitions
- **Test page pattern**: Edit mode (editor tools active, no player) / Play mode (P key toggle, player with full movement + auto-open gates + exit transitions). All abilities enabled in play mode for testing.
- **Room constants**: Grid default 32px (8/16/32/64 options), EXIT_ZONE_DEPTH=16px, GATE_WIDTH=16, GATE_HEIGHT=96, transition total 0.7s

### Surface Types System
`SurfaceType` on platforms (`'normal' | 'bouncy' | 'icy' | 'sticky' | 'conveyor'`). Modifies player physics via multipliers (acceleration, friction, max speed, bounce, conveyor push). Surface properties live in `src/engine/physics/Surfaces.ts`. Platform gets optional `surfaceType` field — backward compatible (undefined = normal). Player gets `currentSurface` / `currentWallSurface` fields set each frame by the game loop / test page. TileMap has `getGroundSurface()`, `getWallSurface()`, `getGroundPlatform()`, `getWallPlatform()` helper methods. TileMap renders platforms color-coded by surface type.

### Paste-Over System
`PasteOver` class (`src/engine/abilities/PasteOver.ts`) — surface property transfer:
- Auto-copy: player walks on a non-normal surface → clipboard captures that surface type
- Explicit paste: press R (Ability3) to paste clipboard surface onto the current ground/wall platform
- Duration-based: pasted surface reverts after timer expires
- Max 3 simultaneous active paste-overs, cooldown after paste expires
- Bouncy surfaces reflect vertical velocity on landing (suppressible by holding crouch)
- Icy surfaces reduce friction dramatically, allow higher max speed
- Sticky surfaces increase friction, reduce max speed, increase wall grip
- Conveyor surfaces push player in a direction while grounded
- Surface modifiers are multipliers on existing physics — `1.0` = no change
- Platform `surfaceType` is optional; `undefined` = normal. Fully backward compatible.

### Combat System
**Critical pattern: combat is an overlay, NOT a player state.** The `CombatSystem` class runs in parallel with the player state machine — the player keeps running/jumping/dashing while attacks happen. No new player states are added. The combat system produces hitboxes relative to the player position each frame.

Key architecture:
- `CombatSystem` (`src/engine/combat/CombatSystem.ts`) — core controller, attack phases (idle→windup→active→recovery→cooldown), hitbox production, hit detection
- `CombatParams` (`src/engine/combat/CombatParams.ts`) — all tunable combat values
- `TargetDummy` (`src/engine/combat/TargetDummy.ts`) — simple test entity that takes damage/knockback, hitstop freeze, knockback arcs, patrol, respawn
- Types in `src/engine/combat/types.ts` — AttackHitbox, HitResult, Damageable, AttackDirection, WeaponType
- Two weapons: quill-spear (fast mid-range directional, 8-dir aiming) and ink-snap (short-range auto-aim burst)
- Hitstop is enemy-only — the target freezes on hit, the player never freezes
- `InputAction.WeaponSwitch` bound to `k` for toggling weapons
- Wire combat in test page's `engine.onUpdate()` — same pattern as abilities
- Hitbox follows player through movement (recomputed each frame during active phase)
- Multi-hit prevention via `hitEntities: Set<string>` on each AttackHitbox
- Horizontal spear knockback has upward bias (-0.3×) for satisfying arcs
- Floating damage numbers: simple screen-space overlay with velocity + alpha fade
- TargetDummy uses simplified ground collision (groundY field) rather than full TileMap

### Save System
`SaveSystem` class (`src/engine/save/SaveSystem.ts`) — pure TypeScript serialization layer:
- **Pure engine code**: No React or Convex imports. Produces plain objects the React layer sends to Convex.
- **`GameSaveData`**: Serializable snapshot of full game state (slot, player name, room, abilities, bosses, cards, health, play time, deaths)
- **`SaveSlotSummary`**: Lightweight slot summary for the save select UI (includes `isEmpty` flag)
- **`LoadedGameState`**: Full deserialized state returned by the persistence layer
- **`createSnapshot(data)`**: Computes completion percentage (abilities 30% + bosses 40% + rooms 30%) and returns a `GameSaveData`
- **`formatPlayTime(seconds)`**: Returns `M:SS` or `H:MM:SS` string
- **`formatRelativeTime(isoString)`**: Returns "just now", "2 min ago", "1 hour ago", etc.
- **`emptySummary(slot)`**: Creates an empty save slot summary

### Convex Schema
Four tables in `convex/schema.ts`:
- **`saveSlots`**: Summary per save file (slot 1-3, player name, room, completion %, deaths, play time). Index: `by_slot`.
- **`progressionData`**: Full progression (abilities, gates, bosses, visited rooms, health). Index: `by_slot`.
- **`cardDeckData`**: Card inventory (owned + equipped card IDs). Index: `by_slot`.
- **`roomStates`**: Per-room persistent state (opened gates, collected items, boss defeated). Index: `by_slot_room`.

Queries in `convex/saves.ts`: `listSaveSlots`, `getSaveSlot`, `loadProgression`, `loadRoomStates`.
Mutations in `convex/saveMutations.ts`: `saveGame` (upsert all 3 tables), `saveRoomState` (upsert one room), `deleteSave` (cascade delete all data for a slot).

### ConvexClientProvider
`src/components/ConvexClientProvider.tsx` — graceful Convex wrapper:
- Checks `NEXT_PUBLIC_CONVEX_URL` env var at module level
- If URL exists: creates `ConvexReactClient` and wraps children in `ConvexProvider`
- If URL is absent: passes children through unwrapped (all test pages work without Convex)
- Client is instantiated at module scope (not per-render)
- Added to `src/app/layout.tsx` wrapping `{children}`

### Save Test Page Pattern
The `/test/save-load` page is a **React UI page** (not a canvas page):
- `useSaveSystem()` hook provides unified API: `slots`, `isConnected`, `save`, `load`, `deleteSave`, `lastOperation`
- When Convex is not connected: uses in-memory mock store (same UI, no persistence across refresh)
- When Convex IS connected: would use `useQuery`/`useMutation` from `convex/react`
- Mock mode is the default since no Convex deployment exists yet
- Banner shows connection status; all UI works identically in both modes

### GameHUD System
`GameHUD` class (`src/engine/ui/GameHUD.ts`) — unified in-game heads-up display:
- **Pure engine class**: No React dependencies. Renders on a `CanvasRenderingContext2D` in screen-space.
- **Null-safe**: All system references in `GameHUDSystems` can be null except `input`. HUD gracefully skips elements when systems are unavailable.
- **`GameHUDConfig`**: Toggle individual HUD elements on/off: `showHealth`, `showAbilities`, `showWeapon`, `showClock`, `showRoomName`, `showMinimap`, `showNotifications`
- **`GameHUDSystems`**: References to game systems: `health` (PlayerHealth), `combat` (CombatSystem), `marginStitch`, `redaction`, `pasteOver`, `indexMark`, `dayNight` (DayNightCycle), `input` (InputManager)
- **Health bar**: Top-left (16, 12), 120x12px, red fill proportional to HP, white flash on damage (6 frames), red/orange pulse at 1 HP
- **Ability bar**: Bottom-left, 4 slots (40x52px each, 4px spacing) with keybind label, canvas-drawn icon, cooldown sweep overlay, active count dots
- **Weapon indicator**: Bottom-center, shows current weapon icon + name, `[K]` switch hint. Quill-spear = diagonal line with pointed tip, ink-snap = starburst
- **Day/night clock**: Top-right, sun/moon icon + phase name + time + progress bar
- **Room name display**: Bottom-right, fade-in (20f) → hold (120f) → fade-out (30f). Call `showRoomName(name)` on room transitions.
- **Notifications**: Left side above ability bar, typed (info/ability/gate/item/warning) with colors/prefixes, FIFO queue (max 5), fade-in (10f) → hold (90f) → fade-out (20f)
- **Pause menu**: `InputAction.Pause` (Escape key) toggles pause. Dark overlay (70% black), centered 200x120px menu with "Resume" / "Quit" options. Up/Down navigate, Jump/Attack confirm.
- **Pause state management**: `hud.paused` boolean checked by game loop. `hud.checkPause()` toggles pause on ESC press. `hud.handlePauseInput()` returns `PauseAction` or null.
- **Render order**: Call `hud.render()` in screen-space (after camera restore), then `hud.renderPauseMenu()` for pause overlay.
- **InputAction.Pause**: Added to `InputManager.ts` — `Pause: "pause"`, bound to `Escape` key in `DEFAULT_KEY_MAP`.
- Test page: `/test/hud` — sandbox with player, combat, abilities, day/night, spikes, dummies, full HUD. Debug panel toggles HUD elements, sends notifications, skips day/night phases.

### Sprite System & Asset Pipeline
`SpriteSheet` class (`src/engine/core/SpriteSheet.ts`) — sprite sheet loading, frame slicing, and rendering:
- `SpriteSheetConfig`: id, src path, frameWidth, frameHeight, columns, totalFrames
- `AnimationDef`: name, frame indices, fps, loop boolean
- `load()` returns a promise; on failure the sheet remains unloaded (AssetManager provides placeholder)
- `setImageSource(source)` accepts `CanvasImageSource` — used for placeholders
- `getFrameRect(frameIndex)` returns `{sx, sy, sw, sh}` source rectangle
- `drawFrame(ctx, frameIndex, x, y, flipX, scaleX, scaleY)` renders a single frame with optional flip and scale
- Frame layout: left-to-right, top-to-bottom, 0-indexed

`AnimationController` class (`src/engine/core/AnimationController.ts`) — animation playback:
- `play(animName)` switches animation (no restart if already playing)
- `restart(animName)` force-restarts from frame 0
- `update(dt)` advances frame timing based on animation FPS
- `setSpriteSheet(sheet)` swaps the underlying sheet (resets animation state)
- `getCurrentFrameIndex()` returns the sprite sheet frame index for the current animation frame
- `draw(ctx, x, y, flipX, scaleX, scaleY)` renders the current frame

`AssetManager` singleton (`src/engine/core/AssetManager.ts`) — centralized asset loading/caching:
- `getInstance()` returns the singleton
- `loadSpriteSheet(config)` loads and caches; on image load failure, generates a canvas-based placeholder
- `loadAll(configs)` loads multiple sheets in parallel
- `getSpriteSheet(id)` retrieves cached sheet
- `isRealAsset(id)` checks if the sheet loaded from its real image (not placeholder)
- `createPlaceholder(config, color)` generates colored rectangle frames with frame numbers
- Placeholder colors: player=#f472b6, tiles=#8b7355

`PlayerSprites` (`src/engine/entities/PlayerSprites.ts`) — player sprite definitions:
- `PLAYER_SPRITE_CONFIGS`: 3 sheets — player-idle (1 frame), player-run (4 frames), player-jump (3 frames), all 64×64
- `PLAYER_ANIMATIONS`: animation defs keyed by sheet ID
- `STATE_TO_ANIMATION`: maps player state machine states to `{sheetId, animName}` pairs
- Many states fall back to idle/run — only idle, run, jump-rise, jump-fall have dedicated sprites initially

Asset generation script (`scripts/generate-assets.ts`):
- Uses `@google/genai` SDK with `NANOBANANA_API_KEY` from `.env.local`
- Run: `npx tsx scripts/generate-assets.ts`
- Generates 5 assets: player-idle, player-run-sheet, player-jump-sheet, tiles-scribe-hall, tiles-herbarium
- Idempotent — skips existing files. Delete a file to regenerate.
- Style prefix: "hand-inked 2D game art, clean linework, watercolor wash fill, paper grain texture"
- Outputs to `public/assets/`
- `@google/genai` and `dotenv` are dev/script dependencies only — never imported in `src/`

Test page: `/test/sprites` — sprite rendering demo with rendering mode toggle (sprites/rectangles/both), animation strip preview, asset status indicators, FPS slider.

### Main Menu & Game Flow
Title screen (`/`), save slot selection, name entry, and the `/play` game page.

**Title Screen** (`src/app/page.tsx`):
- React page (not canvas game), with `InkWashBackground` decorative canvas (50 ink particles drifting upward)
- Menu options: Continue (most recent save), New Game (opens slot select), Test Pages (`/test`)
- Keyboard (Up/Down/Enter) and mouse navigation
- `MenuScreen` states: `"main" | "slot-select" | "name-entry"`

**Save Slot Select** (`src/components/SaveSlotSelect.tsx`):
- Modal overlay showing 3 save slots
- Props: `slots`, `mode: "new-game" | "load"`, `onSelect`, `onDelete`, `onBack`
- Empty slots show "New Game" button; filled slots show Load/Overwrite/Delete
- Inline confirmation dialogs for destructive actions

**Name Entry** (`src/components/NameEntry.tsx`):
- Modal with text input, default "Archivist", max 20 chars, alphanumeric + spaces
- Props: `onConfirm(name)`, `onBack()`

**useSaveSlots Hook** (`src/hooks/useSaveSlots.ts`):
- Returns: `slots`, `isConnected`, `isLoading`, `save()`, `load()`, `deleteSave()`, `getMostRecentSlot()`, `refresh()`
- Uses localStorage mock (Convex not deployed); keys: `inkbinders-saves`, `inkbinders-progression-{slot}`
- `save()` persists both slot summary and full progression data
- `load()` returns `LoadedGameState | null`

**GameSession** (`src/engine/core/GameSession.ts`):
- Pure TypeScript runtime orchestrator for an active game session
- Constructor: `GameSessionConfig` with `slot`, `playerName`, `isNewGame`, `loadedState`
- Tracks: abilities, gates, bosses, rooms, health, cards, play time, deaths
- `getStartingRoomId()`, `getTotalPlayTime()`, `enterRoom()`, `unlockAbility()`, `hasAbility()`, `getUnlockedAbilities()`
- `createSaveSnapshot()` → `GameSaveData` ready to persist
- `DEV_ALL_ABILITIES = true` flag for development (all abilities unlocked)
- New game defaults: `tutorial-corridor`, 5/5 HP, no cards, no bosses

### Game World Assembly
`PlayerProgression` class (`src/engine/world/PlayerProgression.ts`) — tracks player accomplishments:
- `PlayerProgressionData`: unlocked abilities, opened gates, defeated bosses, visited rooms, card deck, health, room ID, play time, deaths
- `CardDeckData`: owned + equipped card IDs
- `unlockAbility()`, `hasAbility()`, `unlockAllAbilities()` — ability tracking
- `openGate()`, `isGateOpened()` — gate persistence across room transitions
- `defeatBoss()`, `visitRoom()`, `recordDeath()`, `updatePlayTime()`
- `serialize()` / `deserialize()` — plain object conversion for future Convex persistence
- For testing: `unlockAllAbilities()` gives all 4 abilities

`WorldGraph` class (`src/engine/world/WorldGraph.ts`) — room layout and biome regions:
- `WorldRegion`: id, name, biomeId, roomIds
- `WorldGraphData`: regions, startingRoomId, hubRoomId
- `getRegion(roomId)`, `getRoomsInRegion(regionId)`, `getAdjacentRooms(roomId)`, `getBiomeId(roomId)`
- `isHub(roomId)` — checks if room is the hub (Scribe Hall)

`GameWorld` class (`src/engine/world/GameWorld.ts`) — top-level world orchestrator:
- Wraps `RoomManager`, `DayNightCycle`, `PlayerProgression`
- `GameWorldConfig`: worldGraph, dayNightParams, allAbilitiesUnlocked flag
- `update(dt, playerBounds)` → `WorldFrameState` (timeOfDay, lightLevel, corruptionIntensity, atmosphereColors, transitioning, theme, isHub)
- `transitionToRoom(exit)` — triggers fade-to-black room transition
- `tryOpenGate(gateId)` — checks abilities and opens gate, persists to progression
- Hub immunity: corruption intensity forced to 0 when in hub room
- `resolveTheme()` uses `getBiomeTheme()` to look up biome colors

**Scribe Hall** (`src/engine/world/scribeHall.ts`) — 1920×1080 hub room:
- Warm parchment theme (`SCRIBE_HALL_THEME` in Biome.ts)
- No enemies, no obstacles, no gates
- Exits: left → Tutorial Corridor, right → Archive Passage
- Bookshelves, mezzanines, reading nook, desk platform
- Always safe — corruption suppressed in hub

**Demo World** (`src/engine/world/demoWorld.ts`) — 5-room playable world:
- `ARCHIVE_PASSAGE`: 960×540 connector room (1 Reader enemy)
- `DEMO_WORLD_DATA`: 3 regions (Hub, Herbarium Wing, Central Archives)
- `createDemoWorld()` factory → `{ worldGraph, rooms }` ready for GameWorld
- Room connections: Scribe Hall ↔ Tutorial Corridor ↔ Vertical Shaft ↔ Vine Garden, Scribe Hall ↔ Archive Passage ↔ Vertical Shaft

**Biome Theme Registry** (`getBiomeTheme()` in Biome.ts):
- `DEFAULT_THEME` (neutral gray), `SCRIBE_HALL_THEME` (warm brown/gold)
- All biome themes registered: default, scribe-hall, herbarium-folio, astral-atlas, maritime-ledger, gothic-errata
- `getBiomeTheme(biomeId)` → `BiomeTheme` lookup with fallback to DEFAULT_THEME

**Test page** (`/test/world-assembly`):
- Full integrated world demo: player starts in Scribe Hall, explores 5 connected rooms
- Day/night cycle runs globally, corruption applies in non-hub rooms
- Enemies spawn per room, gates auto-open on proximity
- Minimap renders room graph with player dot
- Debug panel: world state, day/night controls, HUD config, room map
- 15 pass criteria for verification

**Play Page** (`src/app/play/page.tsx`):
- Route: `/play?slot=N` (load save) or `/play?slot=N&new=1` (new game)
- Redirects to `/` if no valid slot param
- Flow: load save → create GameSession → init engine → mount canvas → start game loop
- Uses `PRESET_ROOMS` from `presetRooms.ts` (tutorial-corridor, vertical-shaft, vine-garden)
- `RoomManager` handles room loading, exit detection, fade transitions
- Full systems: combat, all 4 abilities, day/night, HUD, particles, screen shake
- Custom 4-option pause menu: Resume, Save Game, Save & Quit, Quit (with confirmation)
- Auto-save on room transition
- Auto-open gates when player has required ability
- Fall-off respawn with 1 damage + death counter
- Loading screen with minimum 500ms display

### Room Content — Herbarium Wing
`src/engine/world/herbariumRooms.ts` — 8 interconnected rooms forming the first explorable biome region:

**Room definition pattern:**
- Each room is a `RoomData` constant with platforms, obstacles, exits, gates, enemies, and vine anchors
- Room IDs are kebab-case (e.g., `"vine-vestibule"`)
- Display names are title case (e.g., `"Vine Vestibule"`)
- All rooms use `biomeId: "herbarium-folio"`
- Exits are bidirectional — every exit has a corresponding return exit in the target room
- `EXIT_ZONE_DEPTH` (16px) from `Room.ts` defines exit trigger zone thickness

**Layout (two branching paths converging at mini-boss):**
```
Tutorial Corridor → Vine Vestibule → Overgrown Stacks → Canopy Walk → Thorn Gallery ─┐
                                   → Root Cellar → Mushroom Grotto → Spore Chamber ──┤
                                                                         Herbarium Heart ←┘
```

**Room catalog:**
| Room | Size | Vines | Enemies | Gates | Focus |
|------|------|-------|---------|-------|-------|
| Vine Vestibule | 960×1080 | 3 | none | none | Vine tutorial |
| Overgrown Stacks | 1920×1080 | 5 | 2 Reader | none | Vine chaining over spike pit |
| Root Cellar | 960×1080 | 1 | 1 Binder | Margin Stitch | Underground ability puzzle |
| Canopy Walk | 1920×540 | 6 | 1 Reader, 1 Proofwarden | none | 6-vine chain gauntlet |
| Mushroom Grotto | 1440×1080 | 2 | 2 Reader, 1 Binder | Paste-Over | Surface types (bouncy/icy/sticky) |
| Thorn Gallery | 960×1080 | 2 | 3 Reader, 1 Binder, 1 PW | Redaction | Vertical combat arena |
| Spore Chamber | 960×1080 | 1 | 1 Proofwarden | Margin Stitch + Redaction | Ability puzzle |
| Herbarium Heart | 1440×1080 | 4 | Elder Binder | none | Mini-boss arena |

**Elder Binder (mini-boss):**
- NOT a new class — uses `Binder` with `ELDER_BINDER_PARAMS` override
- 15 HP (3× normal), 200px thread range, 2 contact/thread damage, faster attacks
- Spawned by `createEnemiesForRoom()` checking for `id === "hh_elder_binder"`

**Test page pattern** (`/test/herbarium-wing`):
- Standalone experience using `RoomManager` with all preset + herbarium rooms
- `loadRoomSystems()` called on each room transition: creates VineSystem, enemies, updates camera bounds
- All abilities unlocked (gates auto-open on proximity)
- Combat system with weapon switching (J = attack, K = switch)
- Debug panel: world state, room map, player/vine param sliders
- Pass criteria tracked automatically (vine chaining, gate opens, transitions, etc.)

### Headless Test Harness
`src/engine/test/` — headless game testing framework using vitest:
- **`GameTestHarness`** (`GameTestHarness.ts`): Core testing class that runs the engine without a browser or canvas. Creates Player, TileMap, TestInputManager, Camera. No rendering, no DOM.
- **`TestInputManager`** (`TestInputManager.ts`): Extends `InputManager` with programmatic `press(action)`, `release(action)`, `releaseAll()` methods. Never attaches DOM listeners.
- **Run tests**: `npm test` (watch mode) or `npm run test:run` (single run)
- **Config**: `vitest.config.ts` at project root, uses `vite-tsconfig-paths` for `@/*` alias

**Harness API:**
- **Setup**: `new GameTestHarness({ platforms, playerParams })`, `addPlatform()`, `addFloor()`, `addWalls()`, `setPlayerPosition()`, `setPlayerVelocity()`
- **Simulation**: `tick()` (1 frame), `tickN(n)`, `tickUntil(predicate, maxFrames)`, `tickWhile(predicate, maxFrames)`, `tickSeconds(seconds)`
- **Input**: `pressJump()`, `pressLeft()`, `pressRight()`, `pressDash()`, `pressAttack()`, `pressUp()`, `pressDown()`, `pressCrouch()`, `releaseAll()`, `releaseJump()`, etc.
- **Inspection**: `pos`, `vel`, `state`, `grounded`, `facingRight`, `speed`, `horizontalSpeed`, `snapshot()`
- **Optional systems**: `enableCombat(params?)`, `enableHealth(params?)`
- **`tick()` cycle**: `input.update()` → surface detection → `player.update(dt)` (state machine + gravity + velocity + position + collision) → combat update → camera follow

**Example test:**
```typescript
const h = new GameTestHarness({ platforms: [{ x: 0, y: 300, width: 960, height: 32 }] });
h.setPlayerPosition(100, 260);
h.tickUntil(() => h.grounded, 60);
h.pressJump();
h.tick();
expect(h.state).toBe('JUMPING');
expect(h.vel.y).toBeLessThan(0);
```

**Test files**: `src/engine/test/__tests__/` — movement, jumping, dash, wall mechanics examples
