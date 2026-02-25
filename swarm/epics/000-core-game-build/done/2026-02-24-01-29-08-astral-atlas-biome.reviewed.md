# Task: Astral Atlas — Low-Gravity Biome

## Overview

Implement the **Astral Atlas biome** and its test page (`/test/biome/astral-atlas`). This is Phase 5, step 22 — the second biome. Where Herbarium Folio's movement texture was vine grapple (pendulum swinging), Astral Atlas's movement texture is **low gravity with gravity wells** — reduced gravity creates floaty, extended jumps and longer air time, while localized gravity wells (attract/repel zones) create orbital-style platforming.

The Astral Atlas is a celestial chart wing of the library — pages of star maps, constellation diagrams, and astronomical tables. The air is thin (low gravity), the platforms float (unanchored), and gravity wells scattered throughout the space pull and push the player through curved trajectories. Mastering this biome means mastering air control, timing well exits, and chaining floaty jumps across vast gaps.

**Core design principle:** The Astral Atlas is an **air control and trajectory planning test.** The reduced gravity gives the player more time in the air but also makes them more vulnerable — it's harder to change direction quickly when everything is floaty. Gravity wells add the twist: they bend the player's path, and the player must learn to use them as slingshots and brakes.

## Dependencies

- Player entity with full movement (all states, jump, dash, wall mechanics) ✅
- `BiomeTheme` interface (`src/engine/world/Biome.ts`) ✅
- `BiomeBackground` class (`src/engine/world/BiomeBackground.ts`) ✅
- `ParticleSystem`, `Camera`, `ScreenShake`, `Engine` ✅
- `InputManager`, `InputAction` ✅
- `TileMap`, `Platform`, surface types ✅
- `PlayerParams` / `DEFAULT_PLAYER_PARAMS` ✅
- Pattern reference: Herbarium Folio biome test page (`src/app/test/biome/herbarium-folio/page.tsx`) ✅

## Biome Design: Astral Atlas

### Visual Theme

**Palette:** Deep space + celestial chart aesthetics on aged paper
- Background: `#0a0e1a` (near-black navy)
- Platform fill: `#1e293b` (slate blue)
- Platform stroke: `#475569` (medium slate)
- Accent 1: `#fbbf24` (gold — stars, constellation nodes)
- Accent 2: `#818cf8` (indigo — gravity wells, attract)
- Accent 3: `#f472b6` (pink — repel wells)
- Paper texture: `#f5f5dc` with low alpha (parchment grain)

Create `ASTRAL_ATLAS_THEME` in `src/engine/world/Biome.ts`:
```typescript
export const ASTRAL_ATLAS_THEME: BiomeTheme = {
  id: "astral-atlas",
  name: "Astral Atlas",
  backgroundColor: "#0a0e1a",
  platformFillColor: "#1e293b",
  platformStrokeColor: "#475569",
  ambientParticleColors: ["#fbbf24", "#fde68a", "#818cf8", "#e0e7ff"],
  ambientParticleRate: 4,  // More particles — twinkling stars
  foregroundTint: "rgba(99, 102, 241, 0.03)",
  palette: [
    "#0a0e1a",  // Deep navy (background)
    "#1e293b",  // Slate blue (platforms)
    "#475569",  // Medium slate (outlines)
    "#fbbf24",  // Gold (stars, nodes)
    "#818cf8",  // Indigo (gravity wells)
    "#f5f5dc",  // Parchment (texture)
  ],
};
```

### Parallax Background

Create `createAstralAtlasBackground()` in `src/engine/world/BiomeBackground.ts`:
- **Layer 1** (parallax 0.05): Fixed star field — small dots at random positions (seeded), some gold, some white, some faintly blinking (alpha oscillation)
- **Layer 2** (parallax 0.15): Constellation lines — thin lines connecting star pairs, faint grid lines like a celestial chart (light slate at very low alpha)
- **Layer 3** (parallax 0.4): Larger star clusters and nebula patches — soft circles with radial gradient (indigo/gold, very low alpha)

Use a seeded pseudo-random generator (same pattern as `createHerbariumBackground`) so the background is deterministic.

## New Engine System: GravityWellSystem

Create `src/engine/world/GravityWellSystem.ts`.

### Gravity Well Data

```typescript
export interface GravityWell {
  /** Unique ID */
  id: string;
  /** Center position in world space */
  position: Vec2;
  /** Radius of influence (pixels) */
  radius: number;
  /** Strength of the pull/push (px/s² at the center, falls off with distance) */
  strength: number;
  /** Type: attract pulls toward center, repel pushes away */
  type: "attract" | "repel";
  /** Whether the well is currently active */
  active: boolean;
  /** Visual color (derived from type by default) */
  color: string;
}
```

### Gravity Well Params

```typescript
export interface GravityWellParams {
  /** Global gravity multiplier applied to the entire biome (< 1.0 = low gravity) */
  globalGravityMultiplier: number;
  /** Falloff exponent: force = strength * (1 - (dist/radius)^falloff). Higher = sharper falloff. */
  falloff: number;
  /** Maximum velocity contribution from wells per frame (px/s, capped) */
  maxWellForce: number;
  /** Multiplier for the visual indicator pulse speed */
  pulseSpeed: number;
  /** Whether wells affect dash trajectory */
  affectsDash: boolean;
}

export const DEFAULT_GRAVITY_WELL_PARAMS: GravityWellParams = {
  globalGravityMultiplier: 0.4,
  falloff: 1.5,
  maxWellForce: 400,
  pulseSpeed: 2.0,
  affectsDash: false,  // Dash is sacred — immune to wells by default
};
```

### GravityWellSystem Class

```typescript
export class GravityWellSystem {
  wells: GravityWell[];
  params: GravityWellParams;

  constructor(wells: GravityWell[], params: GravityWellParams);

  /**
   * Compute the net gravitational force at a given position from all active wells.
   * Returns a Vec2 representing the acceleration to apply this frame.
   */
  computeForce(position: Vec2): Vec2;

  /**
   * Apply well forces to an entity's velocity.
   * Call this once per update tick.
   */
  applyToVelocity(position: Vec2, velocity: Vec2, dt: number): void;

  /**
   * Check if a position is inside any well's radius.
   * Returns the well (or null).
   */
  getWellAt(position: Vec2): GravityWell | null;

  /**
   * Render all wells: pulsing circle outlines, directional indicators, field lines.
   */
  render(ctx: CanvasRenderingContext2D, camera: { x: number; y: number }, time: number): void;

  /**
   * Render a debug overlay: force vectors, radius circles, strength labels.
   */
  renderDebug(ctx: CanvasRenderingContext2D, camera: { x: number; y: number }): void;
}
```

### Force Calculation

For each active well, compute force on the player:
```
direction = well.position - playerPosition
distance = length(direction)
if distance > well.radius → no force
normalizedDist = distance / well.radius
forceMagnitude = well.strength * (1 - normalizedDist^falloff)
forceVector = normalize(direction) * forceMagnitude * (attract ? 1 : -1)
```

Sum all well forces, clamp to `maxWellForce`, and add to player velocity each tick.

### Rendering

Attract wells: concentric indigo circles pulsing inward (rings shrink toward center over time). Small arrow particles flowing inward.
Repel wells: concentric pink circles pulsing outward (rings expand from center). Small arrow particles flowing outward.
Both: faint radial gradient fill showing the influence area. Strength indicated by opacity.

## Global Gravity Modification

The biome applies a **global gravity multiplier** to make the whole area floaty. This is done at the test page level (NOT by modifying Player internals):

In the test page's update callback, before calling `player.update(dt)`:
```typescript
// Apply low-gravity biome modifier
const gravMul = gravityWellParamsRef.current.globalGravityMultiplier;
player.params.riseGravity = baseParams.riseGravity * gravMul;
player.params.fallGravity = baseParams.fallGravity * gravMul;
player.params.maxFallSpeed = baseParams.maxFallSpeed * gravMul;
// Jump speed stays the same — lower gravity = higher jumps naturally
```

After `player.update(dt)`, apply well forces:
```typescript
gravityWellSystem.applyToVelocity(
  { x: player.position.x + player.bounds.width / 2, y: player.position.y + player.bounds.height / 2 },
  player.velocity,
  dt
);
```

**Important:** Store `baseParams` separately (snapshot of original params). Each frame, derive modified params from base × multiplier. This way slider changes to `globalGravityMultiplier` work in real time.

## Test Level Layout

Arena: **3200×1200** pixels. The level is wide and tall to exploit the floaty movement.

### Area 1 — Low-Gravity Basics (x: 0–800)
Simple flat area with normal-ish platforms, but in low gravity. Player gets used to the float.
- Ground platform at y=1080 (solid floor)
- 3 floating platforms at varying heights (staggered, 200–400px apart vertically)
- Goal: jump between platforms to reach the top
- Teaches: low-gravity jumping is higher, falling is slower, air control is critical

### Area 2 — Attract Wells (x: 800–1600)
Introduce attract wells over a large gap.
- No floor (bottomless pit below y=1100)
- 3–4 floating platforms spread far apart (250px+ gaps — too far for normal jump)
- 2 attract wells positioned between platforms, pulling the player across the gap
- Goal: use attract wells as "slingshots" — jump into the well's field, let it pull you toward the next platform
- Teaches: timing entry into wells, using well pull to extend jump distance

### Area 3 — Repel Wells (x: 1600–2400)
Introduce repel wells creating "bouncy" zones.
- Narrow vertical shaft with platforms on alternating sides
- 2 repel wells in the shaft center, pushing the player toward the walls
- The player must wall-jump up the shaft, with repel wells boosting lateral movement
- 1 repel well at the bottom of a gap acting as a "safety net" that pushes the player up if they fall
- Goal: use repel wells to gain height and redirect mid-air
- Teaches: repel wells as launchers/redirectors

### Area 4 — Gravity Gauntlet (x: 2400–3200)
Mix attract and repel wells in a complex traversal puzzle.
- Floating platform chain with alternating well types
- Attract well → pull through gap → repel well → launch upward → platform → attract well → pull across → land
- 2 goal zones:
  - **Goal A** (x: 2900, y: 900): Reachable by basic well navigation
  - **Goal B** (x: 3000, y: 200): Reachable only by chaining well slingshots vertically
- Teaches: reading the "gravity map" and planning trajectories through multiple wells

### Platform Construction Tips
- Platforms should be slightly wider than normal (the floatiness makes precision harder)
- Use platform width 120–200px (generous landing zones)
- Vertical spacing between platforms: 250–400px (exploit the higher jumps)
- Horizontal gaps: 300–500px (wells bridge these)

## Test Page: `/test/biome/astral-atlas`

Replace the stub at `src/app/test/biome/astral-atlas/page.tsx` with a full test page.

### Structure

Follow the exact pattern of the Herbarium Folio test page:
1. `'use client'` directive
2. Import `GameCanvas`, `DebugPanel`, `Slider`, engine systems
3. `useEffect` to create engine, player, tilemap, GravityWellSystem, BiomeBackground, Camera, ParticleSystem
4. Custom update callback: apply gravity multiplier → `player.update(dt)` → `gravityWellSystem.applyToVelocity()` → collision → camera → goals
5. Custom render callback: biome background → platforms (biome colors) → gravity wells → player → particles → debug overlay
6. Debug panel with slider sections

### Debug Panel Sliders

**Gravity Section:**
- `globalGravityMultiplier` — range 0.1–1.0, step 0.05, default 0.4
- `falloff` — range 0.5–3.0, step 0.1, default 1.5
- `maxWellForce` — range 100–800, step 50, default 400
- `affectsDash` — toggle (boolean), default false

**Player Section** (same as other test pages):
- `maxRunSpeed` — range 100–500
- `jumpSpeed` — range 200–600
- `riseGravity` — range 200–1200 (base value, before multiplier)
- `fallGravity` — range 200–1200 (base value, before multiplier)
- `maxFallSpeed` — range 100–800 (base value, before multiplier)
- `dashSpeed` — range 300–1000
- `airControl` — range 0–1

### Debug Overlay

Render on canvas:
- **Gravity well fields:** Faint colored circles showing well radius
- **Force vector on player:** Arrow from player center showing net well force direction + magnitude
- **Player state label** + velocity readout
- **Effective gravity display:** Show current gravity values (after multiplier)
- **Well proximity indicator:** When player is inside a well, show distance-to-center and force magnitude
- **Goal zone outlines:** Green when reached, amber when not

### Pass Criteria

Display these at the bottom of the debug panel:

1. **Low-gravity feel:** Jumps reach 2.5× normal height, falls take 2.5× longer
2. **Attract wells pull:** Player visibly curves toward attract well centers
3. **Repel wells push:** Player is pushed away from repel well centers
4. **Well slingshot:** Player can use an attract well to cross a 400px+ gap
5. **Repel launch:** Player can use a repel well to gain significant upward velocity
6. **Goal A reached:** Navigate to Goal A using well-assisted traversal
7. **Goal B reached:** Navigate to Goal B by chaining multiple wells
8. **Gravity slider works:** Adjusting globalGravityMultiplier visibly changes jump height in real time
9. **No movement seams:** Low gravity doesn't break state transitions (idle↔run, jump↔fall, wall-slide, dash all work)
10. **Dash immunity:** Dashing through a well is unaffected by well forces (when affectsDash = false)

## Files to Create/Modify

### Create:
1. `src/engine/world/GravityWellSystem.ts` — GravityWell interface, GravityWellParams, DEFAULT_GRAVITY_WELL_PARAMS, GravityWellSystem class

### Modify:
2. `src/engine/world/Biome.ts` — Add `ASTRAL_ATLAS_THEME` constant
3. `src/engine/world/BiomeBackground.ts` — Add `createAstralAtlasBackground()` function
4. `src/app/test/biome/astral-atlas/page.tsx` — Replace stub with full test page
5. `src/lib/testStatus.ts` — Update Astral Atlas status from `"not-started"` to `"in-progress"`

## Implementation Notes

- **Do NOT modify Player.ts.** All gravity modification happens externally in the test page via `player.params` overrides. The Player's `currentGravity` is derived from its params each state update, so overwriting `riseGravity`/`fallGravity`/`maxFallSpeed` on the params object before `player.update(dt)` is sufficient.
- **Gravity wells are additive forces,** not gravity overrides. They add to velocity directly (like wind), they don't change `currentGravity`.
- **Dash immunity:** When the player is in the DASHING state, skip `gravityWellSystem.applyToVelocity()` unless `params.affectsDash` is true. Check `player.stateMachine.currentState` or equivalent.
- **Particle effects:** Gravity wells should spawn ambient particles that flow toward/away from center, making the invisible force visible. Use the biome's `ambientParticleColors`.
- **Camera:** Use the Camera system with smooth follow. The level is 3200×1200, so the camera should follow the player with bounds clamping.
- **Respawn:** If the player falls below `LEVEL_HEIGHT + 200`, respawn at the start position.
- **The GravityWellSystem is a pure engine class** — no React dependencies. It lives in `src/engine/world/` alongside VineSystem. Same philosophy: engine system that the test page wires up.
- **Keep the well count small** (6–8 wells total) and the level readable. The point is to test the mechanic, not create a maze.

---

## Implementation Summary

### Files Created
- `src/engine/world/GravityWellSystem.ts` (317 lines) — GravityWell interface, GravityWellParams with defaults, GravityWellSystem class with force computation (inverse-distance falloff, maxWellForce clamp), velocity application, well proximity detection, pulsing concentric-ring rendering (attract=inward, repel=outward), debug overlays (radius circles, labels, force vectors)

### Files Modified
- `src/engine/world/Biome.ts` — Added `ASTRAL_ATLAS_THEME` constant (deep navy background, slate blue platforms, gold/indigo/pink accent colors, 4 ambient particle rate)
- `src/engine/world/BiomeBackground.ts` — Added `createAstralAtlasBackground()` with 3 parallax layers: deep star field (0.05 parallax, 80 blinking stars), constellation lines + celestial grid (0.15 parallax), nebula clusters (0.4 parallax). All deterministic via seeded RNG.
- `src/app/test/biome/astral-atlas/page.tsx` (1205 lines) — Full test page replacing stub. 4-area level (3200×1200): Low-Gravity Basics, Attract Wells, Repel Wells (shaft), Gravity Gauntlet. 8 gravity wells total. Debug panel with gravity well sliders (globalGravityMultiplier, falloff, maxWellForce, pulseSpeed, affectsDash), player movement sliders, visual toggles. Screen-space diagnostics showing effective gravity, well proximity, force magnitude. Goal zones A and B.
- `src/lib/testStatus.ts` — Updated Astral Atlas status from "not-started" to "in-progress"
- `AGENTS.md` — Added GravityWellSystem documentation section, updated Astral Atlas status to "In progress"

### Key Design Decisions
- Global gravity modifier applied externally via `player.params` overrides each frame (base × multiplier), NOT by modifying Player internals
- Gravity wells are additive forces on velocity (like wind), not gravity overrides
- Dash immunity: skip well force application when player state is "DASHING" (unless affectsDash=true)
- Well ambient particles flow toward/away from center, making invisible forces visible
- TypeScript passes with zero errors (`npx tsc --noEmit`)

---

## Review Notes (b80de7d8)

### Issues Found & Fixed

1. **Bug: Stale `baseParams` broke gravity slider interaction** (`page.tsx`)
   - The `handleMount` closure captured a one-time snapshot (`const baseParams = { ...DEFAULT_PLAYER_PARAMS }`) that never updated when sliders changed riseGravity/fallGravity/maxFallSpeed. The gravity multiplication (`baseParams.riseGravity * gravMul`) always used the original defaults regardless of slider changes.
   - **Fix**: Changed to use `baseParamsRef.current` which is already updated by the `updateParam` callback.

2. **Dead/broken radial gradient code** (`GravityWellSystem.ts:141-144`)
   - Attempted to convert hex colors to rgba via string manipulation (`.replace(")",...)`), but hex colors don't contain `)`, so this produced garbage. The gradient variable was created but never assigned to `fillStyle`; the simpler `globalAlpha + fillStyle` approach on the following lines was already doing the right thing.
   - **Fix**: Removed the dead gradient code, kept the working simple fill.

3. **Frame-rate dependent well particle spawning** (`page.tsx:518`)
   - `Math.random() > 0.05` was checked per frame, making spawn rate proportional to frame rate (~3/s at 60fps, ~1.5/s at 30fps).
   - **Fix**: Changed to `Math.random() > 3 * dt` for frame-rate independent spawning (~3 particles/sec regardless of frame rate).

### No Issues Found

- `Biome.ts` — ASTRAL_ATLAS_THEME matches spec, all required fields present
- `BiomeBackground.ts` — `createAstralAtlasBackground()` follows the established pattern, 3 parallax layers, seeded RNG, proper types
- `testStatus.ts` — Status correctly updated to "in-progress"
- All API usage verified: `getInterpolatedPosition`, `addLayerCallback`, `aabbOverlap`, `getSurfaceProps`, `getCurrentState`, `resetCamera`/`applyCamera`, Camera `follow`/`snapTo`/`getViewportBounds` — all match engine signatures
- No memory leaks — `handleUnmount` properly stops engine and clears refs
- No frame-rate dependent physics (gravity wells use `force * dt` correctly)
- TypeScript compiles clean after fixes
