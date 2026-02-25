# Task: Ambient Atmosphere — Scribe Hall

## Summary

Add animated ambient visual effects to the Scribe Hall that make the room feel warm and alive: floating dust motes, pulsing candle glow, and subtle light shafts. These are purely visual — no gameplay impact. The system must be Scribe Hall-specific but structured so other biomes can add their own ambient effects later.

## What to Build

A new `AmbientAtmosphere` class that manages three effect types — dust motes, candle glow, and light shafts — and renders them at specific points in the draw order. The class takes an `AmbientConfig` describing what effects to show, updates particle state each frame, and exposes three separate render methods so callers can draw effects at the correct depth.

## Files to Create

### `src/engine/world/AmbientAtmosphere.ts` (new)

This is the main deliverable. Contains:

**`AmbientConfig` interface:**

```typescript
export interface AmbientConfig {
  dustMotes: {
    count: number;        // max active motes (default: 40)
    speedMin: number;     // px/s (default: 5)
    speedMax: number;     // px/s (default: 15)
    sizeMin: number;      // px (default: 1)
    sizeMax: number;      // px (default: 3)
    colors: string[];     // default: ["#fbbf24", "#f5f0e6", "#d97706"]
    driftAngle: number;   // radians, upward-left bias (default: -Math.PI * 0.6)
    driftSpread: number;  // radians of spread (default: 0.8)
    fadeIn: number;       // seconds to fade in (default: 1.0)
    fadeOut: number;      // seconds to fade out (default: 2.0)
    lifeMin: number;      // seconds (default: 4)
    lifeMax: number;      // seconds (default: 10)
    parallaxFactor: number; // how dust moves relative to camera (default: 0.7)
  };
  candleGlow: {
    enabled: boolean;
    positions: Array<{ x: number; y: number }>; // world-space candle positions
    baseRadius: number;      // px (default: 60)
    pulseAmount: number;     // radius oscillation (default: 8)
    pulseSpeed: number;      // cycles per second (default: 0.8)
    color: string;           // default: "#fbbf24"
    baseAlpha: number;       // default: 0.06
  };
  lightShafts: {
    enabled: boolean;
    shafts: Array<{
      x: number;            // world X position of shaft center
      width: number;        // px (default: 40–80)
      angle: number;        // radians from vertical (default: 0.15)
      alpha: number;        // default: 0.04
    }>;
    color: string;           // default: "#fbbf24"
    shimmerSpeed: number;    // alpha oscillation speed (default: 0.3)
  };
}
```

**`AmbientAtmosphere` class:**

```typescript
export class AmbientAtmosphere {
  constructor(config: AmbientConfig);

  /** Call each frame to update particle positions, lifecycle, etc. */
  update(dt: number, cameraX: number, cameraY: number, canvasWidth: number, canvasHeight: number): void;

  /** Light shafts — render AFTER background layers, BEFORE platforms/player */
  renderLightShafts(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number): void;

  /** Candle glow — render AFTER background layers, BEFORE platforms/player */
  renderCandleGlow(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number): void;

  /** Dust motes — render AFTER player, BEFORE foreground layers */
  renderDustMotes(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number): void;
}
```

**Internal dust mote particle:**

Each mote tracks: `x`, `y`, `vx`, `vy`, `size`, `color`, `life`, `maxLife`, `alpha`.

- Spawn within the visible camera area + 100px padding on each side
- Direction: `driftAngle ± (driftSpread * random())` — mostly upward-left for a rising dust feel
- Speed: random between `speedMin` and `speedMax`
- Alpha lifecycle: fade in over `fadeIn` seconds, hold, fade out over `fadeOut` seconds
  - `alpha = 1.0` during hold
  - First `fadeIn` seconds: `alpha = life_elapsed / fadeIn`
  - Last `fadeOut` seconds: `alpha = life_remaining / fadeOut`
- When a mote's life expires or it drifts off-screen, recycle it with new random values
- Render as small filled circles (`ctx.arc()`) with `ctx.globalAlpha = alpha`
- Motes render in world-space at `parallaxFactor: 0.7` — apply the camera offset manually: `drawX = mote.x - cameraX * 0.7`, `drawY = mote.y - cameraY * 0.7`. This makes them float "in the air" between the near background and the player.

**Candle glow:**

Each candle has a fixed world position. Render a radial gradient circle at that position:
- `radius = baseRadius + sin(elapsedTime * pulseSpeed * 2 * PI) * pulseAmount`
- Use a radial gradient from `color` at center (at `baseAlpha`) to `rgba(0,0,0,0)` at edge
- Each candle gets a slightly different phase offset (use index * 0.4) so they don't all pulse in sync
- Render in world-space: `drawX = position.x - cameraX`, `drawY = position.y - cameraY`

**Light shafts:**

Each shaft is a tall, narrow, angled rectangle:
- Full room height (0 to room height, approximately)
- Width as configured per shaft
- Rotated by `angle` radians around the top-center of the shaft
- Filled with a linear gradient from `color` at `alpha` (at top) to transparent (at bottom)
- Alpha oscillates: `drawAlpha = shaft.alpha * (0.7 + 0.3 * sin(elapsedTime * shimmerSpeed * 2 * PI + shaftIndex))`
- Render in world-space: translate to `(shaft.x - cameraX, -cameraY)`, rotate, draw rect

**Factory function:**

```typescript
export function createScribeHallAtmosphere(): AmbientAtmosphere;
```

This creates an `AmbientAtmosphere` with the Scribe Hall's specific configuration:

Dust motes:
- count: 40
- speedMin: 5, speedMax: 15
- sizeMin: 1, sizeMax: 3
- colors: `["#fbbf24", "#f5f0e6", "#d97706"]` (warm amber, parchment white, deep gold)
- driftAngle: `-Math.PI * 0.6` (mostly upward, slightly left)
- driftSpread: 0.8
- fadeIn: 1.0, fadeOut: 2.0
- lifeMin: 4, lifeMax: 10
- parallaxFactor: 0.7

Candle glow positions (matching the Scribe Hall platform layout in `scribeHall.ts`):
```typescript
[
  { x: 460, y: 480 },   // Left bookshelf top (bookshelf at x:300-620, y:500)
  { x: 1420, y: 480 },  // Right bookshelf top (bookshelf at x:1260-1580, y:500)
  { x: 960, y: 380 },   // Central desk (desk at x:800-1120, y:400)
  { x: 180, y: 780 },   // Left stepping platform (platform at x:100-260, y:800)
  { x: 1740, y: 780 },  // Right stepping platform (platform at x:1660-1820, y:800)
  { x: 960, y: 680 },   // Reading nook (platform at x:760-1160, y:700)
]
```
- baseRadius: 60, pulseAmount: 8, pulseSpeed: 0.8
- color: "#fbbf24", baseAlpha: 0.06

Light shafts (3 shafts positioned as if light streams from arched windows in the upper background):
```typescript
[
  { x: 400, width: 60, angle: 0.12, alpha: 0.04 },
  { x: 960, width: 80, angle: 0.0, alpha: 0.05 },    // Center, brightest
  { x: 1520, width: 60, angle: -0.12, alpha: 0.04 },
]
```
- color: "#fbbf24", shimmerSpeed: 0.3

## Files to Modify

### `src/engine/world/BiomeBackground.ts`

No direct changes needed — the atmosphere renders separately from `BiomeBackground`. Atmosphere is integrated by the caller (play page, test pages) at the correct points in the render order.

### `src/app/play/page.tsx`

Integrate `AmbientAtmosphere` into the play page render loop. The key changes:

1. **Import** `AmbientAtmosphere` and `createScribeHallAtmosphere` from `@/engine/world/AmbientAtmosphere`.

2. **Create instance** when entering a room with biomeId `"scribe-hall"`:
   ```typescript
   let atmosphere: AmbientAtmosphere | null = null;
   // In room-change logic:
   if (room.biomeId === "scribe-hall") {
     atmosphere = createScribeHallAtmosphere();
   } else {
     atmosphere = null;
   }
   ```

3. **Update** each frame (in the update loop, after camera position is computed):
   ```typescript
   if (atmosphere) {
     atmosphere.update(
       dt,
       camera.position.x - CANVAS_WIDTH / 2,
       camera.position.y - CANVAS_HEIGHT / 2,
       CANVAS_WIDTH,
       CANVAS_HEIGHT,
     );
   }
   ```

4. **Render light shafts and candle glow** — insert AFTER `biomeBackground.renderBackground()` returns and BEFORE `tileMap.render()`. This means they render behind platforms but in front of the background layers. Since the background renders in screen space then switches back to camera space, the atmosphere renders in world space (camera is applied):
   ```typescript
   // After biomeBackground.renderBackground() + renderer.applyCamera(camera):
   if (atmosphere) {
     atmosphere.renderLightShafts(rCtx, camera.position.x - CANVAS_WIDTH / 2, camera.position.y - CANVAS_HEIGHT / 2);
     atmosphere.renderCandleGlow(rCtx, camera.position.x - CANVAS_WIDTH / 2, camera.position.y - CANVAS_HEIGHT / 2);
   }
   // Then TileMap, obstacles, player, etc.
   ```

5. **Render dust motes** — insert AFTER the player render and BEFORE `biomeBackground.renderForeground()`. Dust floats between the player and the foreground layers:
   ```typescript
   // After player render:
   if (atmosphere) {
     atmosphere.renderDustMotes(rCtx, camera.position.x - CANVAS_WIDTH / 2, camera.position.y - CANVAS_HEIGHT / 2);
   }
   // Then biomeBackground.renderForeground()
   ```

### `src/app/test/environment-showcase/page.tsx`

Also integrate atmosphere into the showcase page so it can be tuned visually:

1. Import and create `AmbientAtmosphere` the same way as the play page.
2. Call `update()` each frame.
3. Render at the correct depth points in the showcase page's render loop.
4. If the showcase page already has atmosphere-related debug controls (dust density slider, candle glow toggle, light shaft toggle), wire them to the atmosphere instance. If not, the atmosphere just renders with default values — the showcase page's existing controls are sufficient for Task 7 (visual tuning pass).

## Design Decisions

**Why a separate class instead of extending BiomeBackground?**
BiomeBackground handles static parallax image layers. Atmosphere is animated particle effects with per-frame state (mote positions, lifecycle timers). They have fundamentally different update patterns. Keeping them separate also means other biomes can have unique atmosphere systems without touching the background code.

**Why three separate render methods instead of one?**
The render order requires effects at different depths:
- Light shafts + candle glow: behind platforms (illuminate the background architecture)
- Dust motes: in front of the player (float in the air between player and camera)
Forcing all three into one render pass would require the caller to sandwich them around their own rendering, which is worse API design.

**Why world-space rendering with manual camera offset?**
Light shafts and candle glow are at fixed world positions (tied to platforms/architecture). They must move with the camera like any world object. Dust motes use a parallax factor (0.7) to appear at mid-depth — not locked to the world, not locked to the screen.

**Why no dependency on ParticleSystem?**
`ParticleSystem` is designed for burst effects (explosions, landing dust, etc.) with one-shot emits. Ambient motes are persistent, recycling particles that live forever. Different lifecycle pattern. The implementation is simpler standalone — just an array of mote structs with update/render.

## Browser API Guards

Since this is engine code in `src/engine/`, it must work in both browser and vitest headless tests. However, `AmbientAtmosphere` only uses `CanvasRenderingContext2D` methods passed by the caller — no direct `Image`, `document`, or other browser-only API usage. No guards needed.

The class should work fine in tests if callers simply don't call `render*()` methods (which they won't in headless tests).

## Performance Budget

- Max 40 dust motes: each is one `ctx.arc()` + `ctx.fill()` = 40 draw calls
- Max 6 candle glows: each is one `createRadialGradient()` + `ctx.arc()` + `ctx.fill()` = 6 draw calls
- Max 3 light shafts: each is one `createLinearGradient()` + `ctx.fillRect()` = 3 draw calls
- Total: ~49 draw calls per frame. Negligible compared to the existing tilemap (hundreds of tile draws) and background layers (multiple full-screen image draws).
- No allocations in the hot path — pre-allocate mote array, reuse objects by resetting fields.

## Pass Criteria

1. **Dust motes drift gently upward** with visible fade-in and fade-out. They should feel like golden dust floating in warm library air.
2. **Candle glow pulses warmly** at each candelabra position. The pulse rhythm should feel organic (slightly different phase per candle), not mechanical.
3. **Light shafts create subtle golden beams** that shimmer. They should look like afternoon sunlight streaming through high windows.
4. **All effects are very subtle** — the room should feel warm and alive, not like a particle effects demo. If you have to squint to notice the light shafts, they're about right.
5. **Correct depth ordering**: light shafts and candle glow render behind platforms (between backgrounds and gameplay); dust motes render in front of the player (between player and foreground layers).
6. **No performance impact**: stable 60fps with all effects active (dev tools performance tab).
7. **Other biomes unaffected**: atmosphere is `null` for non-scribe-hall rooms. No changes to existing biome rendering.
8. **TypeScript compiles cleanly**: `npx tsc --noEmit` passes.
9. **Existing tests pass**: `npm run test:run` — no regressions.

## Verification

1. Run `npx tsc --noEmit` to verify TypeScript compiles.
2. Run `npm run test:run` to verify no test regressions.
3. Run `npm run dev` and open `http://localhost:4000/play`.
4. Start a new game — the Scribe Hall is the first room.
5. Look for: golden dust motes drifting gently upward, warm glow halos near the bookshelves and desk, faint golden light beams from above.
6. Walk around the room — effects should move naturally with the camera.
7. Navigate to another room (left exit to Tutorial Corridor) — atmosphere effects should disappear.
8. Return to Scribe Hall — effects should reappear.
9. Open `http://localhost:4000/test/environment-showcase` — verify atmosphere renders there too.

---

## Completion Summary (Agent 97b236d0)

### What was built

1. **`src/engine/world/AmbientAtmosphere.ts`** (new file):
   - `AmbientConfig` interface with full dust mote, candle glow, and light shaft configuration
   - `AmbientAtmosphere` class with `update()`, `renderLightShafts()`, `renderCandleGlow()`, `renderDustMotes()`
   - Pre-allocated mote array with lifecycle (fade-in/hold/fade-out), drift direction, and recycling
   - No hot-path allocations — motes recycled by resetting fields
   - `createScribeHallAtmosphere()` factory with all Scribe Hall-specific config values
   - ~250 lines, zero browser API dependencies (safe for headless tests)

2. **`src/app/play/page.tsx`** (modified):
   - Import of `AmbientAtmosphere` and `createScribeHallAtmosphere`
   - Instance created on room enter for `biomeId === "scribe-hall"`, null otherwise
   - Instance recreated on room transitions
   - `update()` called each frame after camera position + screen shake
   - `renderLightShafts()` + `renderCandleGlow()` inserted after background, before tilemap
   - `renderDustMotes()` inserted after player render, before foreground layers

3. **`src/app/test/environment-showcase/page.tsx`** (modified):
   - Same import and instance creation pattern
   - Update called each frame in the update loop
   - All three render passes wired into correct depth points in the showcase render loop
   - Atmosphere skipped in layer-isolation mode

4. **`src/engine/world/BiomeBackground.ts`** (fixed):
   - Removed ~220 lines of dead legacy code (`_legacyScribeEnd` block) that referenced undefined variables and caused TypeScript compilation errors
   - Dead code was left behind by a prior parallax-integration task

### Verification

- `npx tsc --noEmit` — passes (0 errors)
- `npm run test:run` — 427 tests pass across 16 files, no regressions

### Files Changed

- `src/engine/world/AmbientAtmosphere.ts` — new file (ambient atmosphere system)
- `src/app/play/page.tsx` — atmosphere integration in game render loop
- `src/app/test/environment-showcase/page.tsx` — atmosphere integration in showcase
- `src/engine/world/BiomeBackground.ts` — removed dead legacy code block

---

## Review (Agent 60e79378)

### Issues Found & Fixed

1. **Double camera transform on atmosphere renders in environment-showcase page** — The atmosphere render methods (`renderLightShafts`, `renderCandleGlow`, `renderDustMotes`) manually subtract camera coordinates from world positions. In the environment-showcase page, these methods were called after `renderer.applyCamera(camera)`, which already applies a canvas translate of `(-camera.x, -camera.y)`. This double offset caused all atmosphere effects to render at incorrect positions (pushed too far from the camera). Fixed by wrapping atmosphere render calls in `renderer.resetCamera()` / `renderer.applyCamera(camera)` so they render in screen space where their internal camera math is correct. The play page had already been fixed by a prior agent but the showcase page still had the issue.

### No Issues Found

- `AmbientAtmosphere.ts`: Clean implementation. Pre-allocated mote array with proper recycling, no hot-path allocations. Lifecycle alpha math (fade-in/hold/fade-out) is correct. Parallax factor correctly applied to dust motes. Canvas state properly saved/restored in all render methods.
- `BiomeBackground.ts`: Dead code removal is clean — no remaining references to removed code.
- Play page integration: Correct depth ordering, proper room-change handling, atmosphere correctly scoped to scribe-hall biome.

### Verification

- `npx tsc --noEmit` — passes (0 errors)
- `npm run test:run` — 427 tests pass across 16 files, no regressions
