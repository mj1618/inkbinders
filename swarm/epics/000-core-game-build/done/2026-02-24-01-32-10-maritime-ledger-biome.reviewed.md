# Task: Maritime Ledger — Current Streams Biome

## Overview

Implement the **Maritime Ledger biome** and its test page (`/test/biome/maritime-ledger`). This is Phase 5, step 23 — the third biome. Where Herbarium Folio's movement texture was vine grapple (pendulum swinging) and Astral Atlas's texture is low gravity with gravity wells, Maritime Ledger's movement texture is **water currents** — directional force zones that push the player through the air and along the ground, creating a traversal puzzle of riding, fighting, and chaining currents.

The Maritime Ledger is a nautical cartography wing of the library — pages of tide charts, sea route maps, and navigational tables. Ink currents flow through the air between platforms like invisible rivers, carrying the player along. Mastering this biome means reading the flow patterns and using currents as launching ramps, brakes, and steering aids.

**Core design principle:** The Maritime Ledger is a **momentum management and current-reading test.** Unlike conveyors (which only affect grounded movement on specific platforms), currents are area-based force zones that apply in mid-air too. The player must learn to ride currents for speed, fight against them for precision, and chain current-assisted jumps across otherwise-impossible gaps. Some sections require the player to dash through opposing currents; others reward surrendering to the flow.

## Dependencies

- Player entity with full movement (all states, jump, dash, wall mechanics) ✓
- `BiomeTheme` interface (`src/engine/world/Biome.ts`) ✓
- `BiomeBackground` class (`src/engine/world/BiomeBackground.ts`) ✓
- `ParticleSystem`, `Camera`, `ScreenShake`, `Engine` ✓
- `InputManager`, `InputAction` ✓
- `TileMap`, `Platform`, surface types ✓
- `PlayerParams` / `DEFAULT_PLAYER_PARAMS` ✓
- Pattern reference: Herbarium Folio biome test page (`src/app/test/biome/herbarium-folio/page.tsx`) ✓

## Biome Design: Maritime Ledger

### Visual Theme

**Palette:** Nautical chart aesthetics — deep ocean blues, aged parchment, compass rose gold, depth contour lines

- Background: `#0a1628` (deep ocean navy)
- Platform fill: `#1e3a5f` (maritime blue)
- Platform stroke: `#3b6b9b` (compass blue)
- Accent 1: `#fbbf24` (gold — compass roses, navigation markers)
- Accent 2: `#38bdf8` (sky blue — current flow indicators)
- Accent 3: `#0ea5e9` (bright blue — strong current zones)
- Accent 4: `#ef4444` (red — danger markers, opposing currents)
- Paper texture: `#f5f5dc` with low alpha (aged chart paper)

Create `MARITIME_LEDGER_THEME` in `src/engine/world/Biome.ts`:
```typescript
export const MARITIME_LEDGER_THEME: BiomeTheme = {
  id: "maritime-ledger",
  name: "Maritime Ledger",
  backgroundColor: "#0a1628",
  platformFillColor: "#1e3a5f",
  platformStrokeColor: "#3b6b9b",
  ambientParticleColors: ["#38bdf8", "#7dd3fc", "#fbbf24", "#bae6fd"],
  ambientParticleRate: 3,
  foregroundTint: "rgba(56, 189, 248, 0.03)",
  palette: [
    "#0a1628",  // Deep ocean navy (background)
    "#1e3a5f",  // Maritime blue (platforms)
    "#3b6b9b",  // Compass blue (outlines)
    "#38bdf8",  // Sky blue (currents, highlights)
    "#fbbf24",  // Gold (compass roses, markers)
    "#f5f5dc",  // Parchment (paper grain)
  ],
};
```

### Parallax Background

Create `createMaritimeBackground()` in `BiomeBackground.ts` following the `createHerbariumBackground()` pattern. Three deterministic layers:

- **Layer 1** (`parallaxFactor: 0.1`): Faint depth contour lines — concentric curved arcs suggesting ocean floor topology. Very low opacity (#3b6b9b at 0.08 alpha). Occasional latitude/longitude grid lines.
- **Layer 2** (`parallaxFactor: 0.3`): Compass rose ornaments — small decorative compass shapes at scattered positions. Navigation route dotted lines connecting points. Gold (#fbbf24) at 0.12 alpha.
- **Layer 3** (`parallaxFactor: 0.6`): Current flow arrows — small chevron/arrow shapes indicating current direction. Slightly brighter (#38bdf8 at 0.2 alpha). These visually hint at the actual current zones in the foreground.

## What to Build

### 1. Current System (`src/engine/world/CurrentSystem.ts`)

A new engine system for area-based directional force zones. This is the biome's signature mechanic.

```typescript
export interface CurrentZone {
  /** Unique ID */
  id: string;
  /** Rectangular area of the current */
  rect: Rect;
  /** Direction of the current force (unit vector, can be diagonal) */
  direction: Vec2;
  /** Force magnitude (px/s² — acceleration applied to player while inside) */
  strength: number;
  /** Whether this current is active */
  active: boolean;
  /** Visual: current type affects rendering */
  type: "stream" | "gust" | "whirlpool" | "jet";
}

export interface CurrentParams {
  /** Global multiplier on all current strengths (for debug tuning) */
  globalStrengthMultiplier: number;
  /** Whether currents affect the player while grounded (true) or only airborne (false = air only) */
  affectsGrounded: boolean;
  /** Grounded strength multiplier (currents are weaker on ground due to friction) */
  groundedMultiplier: number;
  /** Maximum velocity the player can gain from currents alone (caps current-induced speed) */
  maxCurrentVelocity: number;
  /** How quickly current force ramps up when entering a zone (0-1, 1 = instant) */
  rampUpRate: number;
  /** Whether dash overrides current forces (true = dash ignores currents) */
  dashOverridesCurrent: boolean;
  /** Particle density multiplier for current visualization */
  particleDensity: number;
}

export const DEFAULT_CURRENT_PARAMS: CurrentParams = {
  globalStrengthMultiplier: 1.0,
  affectsGrounded: true,
  groundedMultiplier: 0.4,          // Currents are weaker on ground
  maxCurrentVelocity: 500,           // Cap so currents don't break physics
  rampUpRate: 0.15,                  // Smooth entry, not jarring snap
  dashOverridesCurrent: true,        // Dash punches through currents
  particleDensity: 1.0,
};
```

**CurrentSystem class API:**

```typescript
export class CurrentSystem {
  zones: CurrentZone[];
  params: CurrentParams;

  // Track per-zone ramp factor (smooth entry/exit)
  private zoneRamps: Map<string, number>;
  // Accumulator for particle spawning
  private particleTimer: number;

  constructor(zones: CurrentZone[], params?: Partial<CurrentParams>);

  /** Compute the net current force on an entity at a given position + bounds */
  getForceAt(bounds: Rect): Vec2;

  /** Apply current forces to a player. Returns the force that was applied (for debug display).
   *  Call this in the test page update loop AFTER player.update() but BEFORE resolveCollisions().
   *  The force is applied as velocity modification: player.velocity += force * dt */
  applyToPlayer(player: Player, dt: number, isGrounded: boolean, isDashing: boolean): Vec2;

  /** Update particle effects for visible current zones */
  updateParticles(dt: number, particleSystem: ParticleSystem, cameraRect: Rect): void;

  /** Render current zone debug overlays */
  renderDebug(ctx: CanvasRenderingContext2D): void;

  /** Render current flow visual effects (in-world arrows/streaks) */
  renderFlow(ctx: CanvasRenderingContext2D): void;

  /** Check which zones overlap a given bounds */
  getOverlappingZones(bounds: Rect): CurrentZone[];
}
```

**Current type behaviors:**

| Type | Description | Visual |
|------|-------------|--------|
| `stream` | Steady horizontal or diagonal push. The bread-and-butter current. | Parallel streak lines with small arrowheads in the flow direction |
| `gust` | Vertical updraft or downdraft. Temporary — pulses on/off on a timer. | Rising/falling particles, wider spacing |
| `whirlpool` | Circular force that pushes the player along a curved path. Not a true vortex — the force direction rotates based on player position relative to the zone center. | Spiral particle trails converging on the center |
| `jet` | High-strength narrow current (like a water cannon). Short zones with strong force. Perfect for launching the player. | Dense bright streak lines, tight clustering |

**Whirlpool force computation:** For a whirlpool zone, the force direction is the tangent to a circle centered on the zone center, at the player's position. This creates a swirling push effect. Direction = perpendicular to (player_center - zone_center), normalized.

**Ramp-up/down:** When the player enters a current zone, the force ramps up from 0 to full over several frames (`rampUpRate` per frame, so at 0.15 it takes ~7 frames to reach full force). When the player exits, the ramp decays at the same rate. This prevents jarring velocity snaps.

### 2. Current Zone Rendering

Current zones need in-world visual indicators so the player can "read" the currents. This is NOT debug rendering — it's the actual gameplay visual.

**Flow rendering in `CurrentSystem.renderFlow()`:**
- Each zone renders animated flow lines within its bounds
- Flow lines are short line segments (8-12px) with small arrowhead tips
- Lines move in the current direction, wrapping around when they exit the zone boundary
- Animation: lines advance at a speed proportional to the current strength
- Color: use the biome's accent color (#38bdf8) with moderate alpha (0.3–0.5)
- Stronger currents have more flow lines (density proportional to strength)
- Jet currents render denser, brighter lines
- Whirlpool currents render curved spiral lines converging on center
- Gust currents render wider-spaced vertical lines that pulse with the on/off timer

**Particle effects in `updateParticles()`:**
- Spawn small bubble/droplet particles inside active zones
- Particles move in the current direction at the current's strength
- Use biome accent colors (#38bdf8, #7dd3fc)
- Spawn rate proportional to `particleDensity` param
- Particles are small (2-3px), short-lived (0.5-1.0s), with alpha fade

### 3. Gust Pulsing

Gust-type currents pulse on/off to create timing challenges:

```typescript
// Add to CurrentZone interface:
/** For gust type: seconds the gust is active */
gustOnDuration?: number;   // default 2.0
/** For gust type: seconds the gust is inactive */
gustOffDuration?: number;  // default 1.5
/** Internal timer tracking gust phase */
gustTimer?: number;
```

When a gust zone is in its "off" phase, its effective strength is 0. The flow rendering fades out during off phase and builds back during on phase. A subtle visual telegraph (faint particles starting to stir) begins 0.3s before the gust activates.

### 4. Test Level Layout

The test level is a horizontal underwater-themed arena (3840×1080, same as Herbarium Folio) with four areas that progressively test current mastery:

**Area 1: Current Introduction (x: 0–960)**
- Solid ground floor with a single rightward stream current above a gap
- Player walks off a ledge into the current, which carries them across a gap to the next platform
- Simple, teaches "currents push you"
- One goal zone at the end: "Ride the current"
- Platforms: ground floor with a gap at x:400-700, landing platform at x:700. Stream zone rect covering the gap at mid-height.

**Area 2: Current Navigation (x: 960–1920)**
- Multiple stream and jet currents at different angles
- Some currents help (carry you to the next platform), others hinder (push you into pits)
- Requires the player to jump into helpful currents and dash through opposing ones
- Introduce opposing currents: a leftward current blocking a rightward path — must dash through it
- Platforms at varying heights with current zones connecting them

**Area 3: Gust Gauntlet (x: 1920–2880)**
- Vertical section with updraft gusts that pulse on/off
- The player must time jumps to ride the updrafts when active
- A series of small platforms with gust zones between them
- Falling during gust-off means dropping to a lower level (not death — there's a ground floor)
- Tests timing and air control within pulsing currents
- Goal zone at the top: "Ride the gusts"

**Area 4: Whirlpool Traverse (x: 2880–3840)**
- Two or three whirlpool zones over a large open area with minimal platforms
- The player must enter the whirlpool current, ride the circular force to gain speed, then exit at the right angle to launch toward the next whirlpool or platform
- This is the hardest section — requires reading the rotation direction and timing the exit
- A jet current at the end launches the player to the final goal platform
- Goal zone: "Master the whirlpool"

### 5. Test Page (`src/app/test/biome/maritime-ledger/page.tsx`)

Replace the stub with a full biome test page following the Herbarium Folio pattern:

**Structure:**
1. `'use client'` directive
2. Import `GameCanvas`, `DebugPanel`, `Slider`, engine systems, `MARITIME_LEDGER_THEME`, `createMaritimeBackground`, `CurrentSystem`
3. Create engine, player, tilemap, camera, particles, current system in `useEffect`
4. Custom update callback: `player.update()` → `currentSystem.applyToPlayer()` → `resolveCollisions()` → camera follow → particle update → goal zone checks
5. Custom render callback: background → biome tint → platforms → current flow → player → particles → debug → goal zones → HUD

**Debug Panel sections (collapsible):**

1. **Current Params** — sliders for all `CurrentParams` values:
   - `globalStrengthMultiplier` (0.0–3.0, step 0.1)
   - `affectsGrounded` (checkbox/toggle)
   - `groundedMultiplier` (0.0–1.0, step 0.05)
   - `maxCurrentVelocity` (100–1000, step 50)
   - `rampUpRate` (0.01–1.0, step 0.01)
   - `dashOverridesCurrent` (checkbox/toggle)
   - `particleDensity` (0.0–3.0, step 0.1)

2. **Player Params** — standard movement sliders (same set as Herbarium Folio)

3. **Debug Info** (read-only):
   - Current player state
   - Player velocity (x, y)
   - Active current zones overlapping player (list with names + force vectors)
   - Net current force being applied (x, y)
   - Whether player is grounded, in current, dashing
   - FPS / frame time

4. **Goals** — checklist of pass criteria

**HUD overlay on canvas:**
- Current zone indicator: when inside a current, show a small arrow icon in the direction of force + strength label
- Goal zone markers with labels

### 6. Update `testStatus.ts`

Change Maritime Ledger from `"not-started"` to `"in-progress"` at the start, and to `"passing"` once all pass criteria are met.

### 7. Update `AGENTS.md`

Add a "CurrentSystem" section documenting:
- `CurrentZone` interface and types (stream, gust, whirlpool, jet)
- `CurrentParams` defaults
- How currents apply force (velocity modification, ramp up/down, grounded multiplier)
- How gust pulsing works
- Test page wiring pattern

## Specific Physics Values

| Parameter | Value | Notes |
|-----------|-------|-------|
| `globalStrengthMultiplier` | 1.0 | Tunable master knob |
| `groundedMultiplier` | 0.4 | Currents are 40% effective on ground |
| `maxCurrentVelocity` | 500 | px/s cap from current forces |
| `rampUpRate` | 0.15 | ~7 frames to full force |
| `dashOverridesCurrent` | true | Dash punches through currents |
| Stream strength (typical) | 300–500 | px/s² acceleration |
| Jet strength | 800–1200 | px/s² — powerful launchers |
| Gust strength (updraft) | 400–700 | px/s² — must overcome gravity (~980) partially |
| Whirlpool strength | 250–400 | px/s² — moderate push in tangential direction |
| Gust on duration | 2.0s | Active phase |
| Gust off duration | 1.5s | Inactive phase |
| Gust telegraph | 0.3s | Visual warning before activation |

## Pass Criteria

Display these on the test page with checkboxes:

1. **Current push works:** Player standing in a stream current is visibly pushed in the correct direction
2. **Air current:** Player jumping through a current zone is pushed while airborne (not just grounded)
3. **Grounded reduction:** Current force is noticeably weaker while grounded vs airborne
4. **Dash override:** Dashing through an opposing current maintains dash trajectory (not deflected)
5. **Ramp up:** Entering a current zone has a smooth force ramp (no velocity snap)
6. **Gust pulsing:** Gust zones visibly cycle on/off with correct timing
7. **Gust telegraph:** A visual warning appears before gust activation
8. **Whirlpool orbit:** Player entering a whirlpool zone is pushed along a curved path (not straight)
9. **Jet launch:** Player passing through a jet zone gains a significant velocity boost
10. **Flow visualization:** Current zones render visible animated flow lines/arrows
11. **Goal A reached:** Successfully ride a current across a gap (Area 1)
12. **Goal B reached:** Navigate through opposing currents (Area 2)
13. **Goal C reached:** Time gust updrafts to reach a high platform (Area 3)
14. **Goal D reached:** Chain whirlpool exits to cross a large gap (Area 4)
15. **All sliders work:** Adjusting current params visibly changes behavior in real-time

## Files to Create/Modify

### Create:
- `src/engine/world/CurrentSystem.ts` — current zone system (core engine module)
- `src/app/test/biome/maritime-ledger/page.tsx` — full test page (replace stub)

### Modify:
- `src/engine/world/Biome.ts` — add `MARITIME_LEDGER_THEME`
- `src/engine/world/BiomeBackground.ts` — add `createMaritimeBackground()` factory
- `src/lib/testStatus.ts` — update Maritime Ledger status to `"in-progress"`

### Update after implementation:
- `AGENTS.md` — add CurrentSystem documentation section

## Implementation Notes

- **Currents are NOT surface types.** Surface types modify friction/acceleration when touching a platform. Currents are area-based force fields that apply to the player regardless of ground contact. They are completely separate systems.
- **Force application order:** In the update loop, apply currents AFTER `player.update()` but BEFORE `resolveCollisions()`. This way the current modifies velocity, and then collision resolution handles the result.
- **Whirlpool math:** For a whirlpool at center C, player at P, the force direction is `normalize(perpendicular(P - C))`. The perpendicular is `(-dy, dx)` for clockwise or `(dy, -dx)` for counter-clockwise. Add a `clockwise: boolean` field to `CurrentZone` for whirlpool direction.
- **Gust timer:** Track the gust timer on the `CurrentZone` object itself. The `CurrentSystem.update()` method should advance all gust timers each frame.
- **Do NOT modify Player.ts or the player state machine.** Currents apply external velocity changes — the player code doesn't know about currents. This follows the same pattern as abilities (world-editing systems that don't modify the player state machine).
- **Particle spawning for currents:** Spawn particles at random positions within the zone rect, with initial velocity matching the current direction × strength. Use the biome's accent colors.
- Use `aabbOverlap()` from `src/engine/physics/AABB.ts` for zone-player overlap testing.

---

## Completion Summary

### Files Created:
- `src/engine/world/CurrentSystem.ts` — Core engine module: `CurrentZone` interface, `CurrentParams` with `DEFAULT_CURRENT_PARAMS`, `CurrentSystem` class with force computation, gust pulsing, ramp up/down, whirlpool tangential force, flow rendering (directional arrows, whirlpool spirals), debug overlays, particle spawning
- `src/app/test/biome/maritime-ledger/page.tsx` — Full test page replacing stub, with 4-area test level (Current Introduction, Current Navigation, Gust Gauntlet, Whirlpool Traverse), 4 goal zones, debug panel with Current Params sliders + toggles, Player Movement sliders, Visual Settings toggles, area teleport buttons, screen-space diagnostics (state, velocity, current zone info, force HUD indicator), biome-themed rendering

### Files Modified:
- `src/engine/world/Biome.ts` — Added `MARITIME_LEDGER_THEME` (ocean navy bg, maritime blue platforms, compass blue outlines, sky blue/gold palette)
- `src/engine/world/BiomeBackground.ts` — Added `createMaritimeBackground()` factory with 3 parallax layers (depth contour arcs + lat/long grid, compass roses + navigation routes, current flow arrows)
- `src/lib/testStatus.ts` — Maritime Ledger status updated from `"not-started"` to `"in-progress"`
- `AGENTS.md` — Added CurrentSystem documentation section, updated Maritime Ledger status to In Progress

### What was built:
- **CurrentSystem engine module** with 4 current types (stream, gust, whirlpool, jet), gust pulsing with telegraph, whirlpool tangential force, ramp up/down smoothing, dash override, grounded multiplier, max velocity cap
- **Flow visualization** — animated directional flow lines with arrowheads, whirlpool spiral arms, all rendered in world space
- **Maritime Ledger biome theme** — deep ocean navy palette with nautical chart aesthetics
- **Parallax background** — depth contours, compass roses, current flow arrows across 3 layers
- **Full test page** with 4 traversal challenge areas, complete debug panel with all tunable parameters, current force HUD indicator, area teleport shortcuts

### Verification:
- `npx tsc --noEmit` — Clean (no errors)
- `npx next build` — All 27 pages compiled successfully including `/test/biome/maritime-ledger`

---

## Review (agent 70a7aa2b)

**Files reviewed:** `CurrentSystem.ts`, `Biome.ts`, `BiomeBackground.ts`, `page.tsx` (maritime-ledger test page), `testStatus.ts`

### Issues found and fixed:

1. **Non-normalized direction vectors in `CurrentSystem.getForceDirection()`** — The `CurrentZone` interface documents `direction` as a "unit vector", but the test page zone definitions used non-unit vectors (e.g., `{ x: 0.3, y: -1 }` for jets, which has magnitude 1.044; `{ x: 0.5, y: -1 }` which has magnitude 1.118). This caused jets to apply slightly more force than their `strength` parameter implies. **Fixed** by normalizing the direction vector in `getForceDirection()` before returning it for non-whirlpool zones. Whirlpool tangent computation was already producing unit vectors, so no change needed there.

### Items reviewed with no issues:

- **Gust pulsing** — Timer logic correct, on/off transitions clean, telegraph ramp (0.15 strength for 0.3s before activation) works correctly
- **Ramp up/down** — Per-frame rate of 0.15 is acceptable in the fixed-timestep (60 Hz) engine; ~7 frames = ~0.117s to full force, consistent with the spec
- **Velocity capping** — `applyToPlayer` correctly caps current-induced velocity without reducing pre-existing velocity (smart clamp logic)
- **Whirlpool tangential force** — Perpendicular-to-radial computation is correct for both CW and CCW directions
- **Dash override** — Correctly returns zero force when dashing and `dashOverridesCurrent` is true, but still updates ramp factors (so re-entry after dash is smooth)
- **Test page update order** — updateGusts → applyToPlayer → camera follow → particles. Correct per the pattern
- **All sliders wired** — All 7 `CurrentParams` values are wired to debug panel controls (5 sliders + 2 toggle buttons)
- **Biome theme and background** — `MARITIME_LEDGER_THEME` and `createMaritimeBackground()` follow established patterns exactly
- **Memory management** — Engine cleanup in `handleUnmount` stops engine and nulls refs; no leaked listeners
- **TypeScript** — `npx tsc --noEmit` passes clean after fix
