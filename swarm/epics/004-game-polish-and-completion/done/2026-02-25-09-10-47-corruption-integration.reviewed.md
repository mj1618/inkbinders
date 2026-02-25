# Task: Corruption Integration — Wire Night Corruption Modifiers into Play Page

## Context

The `DayNightCycle` already runs on the play page (`src/app/play/page.tsx`) and provides `corruptionIntensity` (0 at day, ramping to 1 at deep night). The `CorruptionModifiers` class (`src/engine/world/CorruptionModifiers.ts`) implements 5 corruption effects that make night gameplay tense and unpredictable. But this system is only wired into the test page (`/test/day-night`), not the actual game.

The play page is ~1556 lines. Key structural sections:
- Variable declarations: ~lines 494-612
- `buildBiomeSystems()` helper: ~lines 533-603
- `rebuildRoomSystems()`: ~lines 614-680
- `engine.onUpdate()` callback: ~lines 684-1271
- `engine.onRender()` callback: ~lines 1275-1417
- Screen-space layer callback: ~lines 1421-1481

The day/night cycle update is at ~line 1261: `dayNight.update(dt)`.
The HUD receives `dayNight` as a system reference and renders the clock.

## What to Build

Wire `CorruptionModifiers` into the play page by following the exact pattern from `/test/day-night/page.tsx`.

### 1. Add Imports

At the top of `src/app/play/page.tsx`, add:
```typescript
import { CorruptionModifiers, DEFAULT_CORRUPTION_PARAMS } from "@/engine/world/CorruptionModifiers";
import { DayNightRenderer } from "@/engine/world/DayNightRenderer";
```

`DayNightRenderer` is needed for `renderFogOfWar()` and `renderCorruptionDistortion()`.

### 2. Initialize CorruptionModifiers

In the variable declarations section (~line 537, near the biome system declarations), add:

```typescript
const corruption = new CorruptionModifiers();
```

Also store baseline gravity values that corruption will modulate:
```typescript
const baseRiseGravity = player.params.riseGravity;
const baseFallGravity = player.params.fallGravity;
```

**Important:** These baseline values must be the DEFAULT player gravity, not whatever the gravity well system might have set. Store them right after creating the player, before the game loop starts.

Also track original surface types so corruption can flip them and restore them:
```typescript
// Store original surface types for corruption surface-flip
let originalSurfaces: string[] = [];
```

Update `originalSurfaces` in `rebuildRoomSystems()` (alongside the existing obstacle/enemy rebuild logic):
```typescript
originalSurfaces = roomManager.tileMap.platforms.map(
  p => p.surfaceType ?? "normal"
);
```

### 3. Wire into Update Loop

In `engine.onUpdate()`, **after** the day/night cycle update (`dayNight.update(dt)`) and **before** the HUD update, add the corruption block:

```typescript
// ─── Corruption Modifiers ────────────────────────────────
// Hub rooms are immune to corruption
const isHubRoom = roomManager.currentRoom.id === "scribe-hall";
const effectiveCorruption = isHubRoom ? 0 : dayNight.corruptionIntensity;

corruption.update(
  dt,
  effectiveCorruption,
  roomManager.tileMap.platforms.length,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
);

// Surface flip: restore originals then apply corrupted surfaces
if (corruption.isSurfaceFlipActive()) {
  const platforms = roomManager.tileMap.platforms;
  for (let i = 0; i < originalSurfaces.length && i < platforms.length; i++) {
    const effective = corruption.getEffectiveSurface(originalSurfaces[i]);
    platforms[i].surfaceType = effective as SurfaceType;
  }
} else {
  // Restore original surfaces during day
  const platforms = roomManager.tileMap.platforms;
  for (let i = 0; i < originalSurfaces.length && i < platforms.length; i++) {
    platforms[i].surfaceType = (originalSurfaces[i] as SurfaceType) ?? "normal";
  }
}

// Gravity pulse: modulate player gravity during pulse
// Only apply corruption gravity when NOT in a gravity well room
// (gravity well system already modifies these params)
if (!gravityWellSystem) {
  const gravMult = corruption.getGravityMultiplier();
  if (gravMult !== 1.0) {
    player.params.riseGravity = baseRiseGravity * gravMult;
    player.params.fallGravity = baseFallGravity * gravMult;
  } else {
    player.params.riseGravity = baseRiseGravity;
    player.params.fallGravity = baseFallGravity;
  }
}

// Ink bleed: spawn atmospheric particles
for (const _pos of corruption.pendingInkBleeds) {
  const viewBounds = camera.getViewportBounds();
  particleSystem.emit({
    x: viewBounds.x + Math.random() * viewBounds.width,
    y: viewBounds.y,  // Spawn at top of viewport (dripping down)
    count: 1,
    speedMin: 10,
    speedMax: 40,
    angleMin: Math.PI * 0.3,
    angleMax: Math.PI * 0.7, // Mostly downward
    lifeMin: 0.3,
    lifeMax: 0.8,
    sizeMin: 2,
    sizeMax: 5,
    colors: ["#4338ca", "#6366f1", "#1e1b4b", "#312e81"],
    gravity: 30,
  });
}
```

**SurfaceType import**: Make sure `SurfaceType` is imported from `@/engine/physics/Surfaces` (or wherever it's defined). Check the existing play page imports — it may already be imported.

### 4. Wire into Render Loop

#### World-space rendering (in `engine.onRender()`)

In the platform rendering section, check for platform flicker. The play page currently renders platforms via `tileMap.render()`. If `tileMap.render()` draws all platforms, you need to add flicker overlay **after** the tileMap render:

```typescript
// Platform flicker overlay (corruption)
if (corruption.getModifier("platform-flicker")?.active) {
  const platforms = roomManager.tileMap.platforms;
  for (let i = 0; i < platforms.length; i++) {
    if (corruption.isPlatformFlickering(i)) {
      const p = platforms[i];
      rCtx.save();
      rCtx.globalAlpha = 0.3 + Math.random() * 0.4;
      rCtx.fillStyle = "#000";
      rCtx.fillRect(p.x, p.y, p.width, p.height);
      rCtx.restore();
    }
  }
}
```

#### Screen-space rendering (in the screen-space layer callback)

Add **before** the HUD render, after the fog system overlay:

```typescript
// Corruption fog-of-war (night)
if (corruption.isFogActive()) {
  const playerScreenPos = camera.worldToScreen({
    x: player.position.x + player.size.x / 2,
    y: player.position.y + player.size.y / 2,
  });
  DayNightRenderer.renderFogOfWar(
    ctx,
    playerScreenPos,
    corruption.getFogRadius(),
    "rgba(10, 10, 26, 0.85)",
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
  );
}

// Corruption chromatic distortion (>0.5 corruption only)
if (effectiveCorruption > 0.5) {
  DayNightRenderer.renderCorruptionDistortion(
    ctx,
    effectiveCorruption,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
  );
}

// Gravity pulse visual indicator
if (corruption.gravityPulseActive) {
  ctx.fillStyle = "rgba(239, 68, 68, 0.15)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = "rgba(239, 68, 68, 0.6)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, 3);
  ctx.fillRect(0, CANVAS_HEIGHT - 3, CANVAS_WIDTH, 3);
}
```

**Note:** The `effectiveCorruption` variable must be accessible in the render callback. Since both update and render are closures in the same scope, this should work. If it doesn't, store it as a module-level `let` variable alongside the other biome system variables.

### 5. Handle Biome Fog vs Corruption Fog Interaction

The Gothic Errata wing already has `FogSystem` providing fog. Corruption fog is **additive** — if both are active, use the more restrictive (smaller) radius. To avoid double-fog:

```typescript
// In screen-space render:
// Only render corruption fog if biome fog isn't already active
// (biome fog is already rendered by fogSystem)
if (corruption.isFogActive() && !fogSystem) {
  // ... render corruption fog
}
```

This ensures Gothic Errata rooms use the biome fog (which has specific zones), while other rooms use corruption fog during night.

### 6. Reset Corruption on Room Transition

In `rebuildRoomSystems()`, after building biome systems:

```typescript
// Reset corruption state for new room (recalculates on next frame)
corruption.reset();
// Store original surfaces for corruption flip
originalSurfaces = roomManager.tileMap.platforms.map(
  p => p.surfaceType ?? "normal"
);
```

### 7. Check Method Signatures

Before implementing, **verify** these method signatures by reading the actual files:

- `CorruptionModifiers.update(dt, corruptionIntensity, platformCount, canvasWidth, canvasHeight)` — from `CorruptionModifiers.ts`
- `DayNightRenderer.renderFogOfWar(ctx, playerScreenPos, radius, color, width, height)` — from `DayNightRenderer.ts`
- `DayNightRenderer.renderCorruptionDistortion(ctx, intensity, width, height)` — from `DayNightRenderer.ts`
- `camera.worldToScreen(pos)` — from `Camera.ts`
- `camera.getViewportBounds()` — from `Camera.ts`
- `particleSystem.emit(config)` — from `ParticleSystem.ts`

Also verify: Does the day-night test page use `dayNight.corruptionIntensity` directly, or `dayNight.getCorruptionIntensity()`? Check the DayNightCycle API.

## Files to Modify

- `src/app/play/page.tsx` — **only file to modify**

## Files to Read for Reference

- `src/engine/world/CorruptionModifiers.ts` — the corruption system API
- `src/engine/world/DayNightRenderer.ts` — rendering helpers
- `src/engine/world/DayNightCycle.ts` — cycle API (corruption intensity getter)
- `src/app/test/day-night/page.tsx` — full reference implementation
- `src/engine/core/Camera.ts` — worldToScreen, getViewportBounds
- `src/engine/core/ParticleSystem.ts` — emit API

## Important Design Decisions

1. **No corruption in hub rooms.** The Scribe Hall is always safe. Check `roomManager.currentRoom.id === "scribe-hall"`.

2. **No gravity pulse in gravity well rooms.** If `gravityWellSystem` is active, skip corruption gravity modification — the gravity well system already modifies those params and they'd conflict.

3. **No corruption fog in fog system rooms.** Gothic Errata already has FogSystem providing specific fog zones. Don't layer corruption fog on top.

4. **Platform flicker is visual only.** Don't remove platforms from collision — just make them flash/dim briefly. The `platformFlickerChance` of 0.005 means roughly 0.5% of platforms flicker per frame, which is subtle enough.

5. **Surface flip is gameplay-affecting.** Surfaces actually change type. This is the most impactful modifier. The flip map cycles: normal→icy→bouncy→sticky→conveyor→normal.

6. **Reset on room transition.** Call `corruption.reset()` in `rebuildRoomSystems()` to prevent stale state carrying over.

## Pass Criteria

1. `npx tsc --noEmit` passes with zero errors
2. During daytime in non-hub rooms: no corruption effects visible
3. As night falls (corruption > 0.2): ink bleed particles appear
4. Corruption > 0.3: platform surfaces start cycling
5. Corruption > 0.4: occasional platform flickering
6. Corruption > 0.5: fog-of-war shrinks visibility + chromatic distortion
7. Corruption > 0.7: gravity pulses occur (brief visual indicator + gravity reversal)
8. Scribe Hall (hub) has zero corruption at all times
9. Gothic Errata rooms don't get double fog (biome fog only)
10. Gravity well rooms don't get gravity pulse conflicts
11. Returning to day restores all surfaces to original types
12. Room transitions properly reset corruption state

## Implementation Summary

### Files Changed
- `src/app/play/page.tsx` — sole file modified

### What Was Built
Wired the existing `CorruptionModifiers` system into the play page, following the pattern from the day-night test page:

1. **Imports**: Added `CorruptionModifiers`, `DayNightRenderer`, and `SurfaceType` imports
2. **Initialization**: Created `CorruptionModifiers` instance, stored baseline gravity values (`baseRiseGravity`, `baseFallGravity`), and tracked original surface types in `originalSurfaces` array. `effectiveCorruption` stored as a closure variable so both update and render callbacks can access it.
3. **Update loop** (after `dayNight.update(dt)`):
   - Hub room immunity: `effectiveCorruption = 0` for Scribe Hall
   - `corruption.update()` called each frame
   - Surface flip: restores originals when inactive, applies corrupted types when active
   - Gravity pulse: modulates player gravity only when no gravity well system is active
   - Ink bleed: spawns atmospheric ink particles from viewport top
4. **World-space render**: Platform flicker overlay after obstacle rendering (visual only — dark rects on flickering platforms)
5. **Screen-space render** (before HUD):
   - Corruption fog-of-war (radial visibility mask) — skipped when `fogSystem` is active (Gothic Errata rooms)
   - Chromatic distortion above 0.5 corruption
   - Red tint + edge lines during gravity pulses
6. **Room transitions**: `corruption.reset()` and `originalSurfaces` refresh in `rebuildRoomSystems()`

### Pass Criteria Verification
- [x] `npx tsc --noEmit` passes with zero errors
- [x] Hub rooms get zero corruption (explicit check for `scribe-hall` room ID)
- [x] Gothic Errata rooms skip corruption fog (`!fogSystem` guard)
- [x] Gravity well rooms skip corruption gravity (`!gravityWellSystem` guard)
- [x] Surfaces restore on day (else branch restores `originalSurfaces`)
- [x] Room transitions reset corruption state

---

## Review Notes

**Reviewed by:** reviewer (iteration 61)

### Bug Found & Fixed

**`originalSurfaces` parallel array desync on gate opens** — The corruption surface-flip system uses a parallel `originalSurfaces` array indexed by platform position. When gates are opened (`tryOpenGate` / `openBossGate`), platforms are spliced from `currentTileMap.platforms`, shifting indices and desynchronizing the parallel array. This would cause wrong surface types to be applied/restored during corruption at night.

**Fix:** Rebuild `originalSurfaces` from the current platforms array after every gate-opening event. Applied at 3 locations:
1. Auto-open gates after room transition (line ~821)
2. Interactive gate opening near player (line ~918)
3. Boss gate opening on boss defeat (line ~1284)

### Everything Else Looks Good

- All API signatures verified against source files
- Hub immunity, gravity well guard, fog system guard all correct
- No frame-rate dependent issues (all effects use `dt`)
- No memory leaks (no event listeners registered)
- Canvas state properly saved/restored in flicker overlay
- `effectiveCorruption` closure variable correctly shared between update and render callbacks
- `npx tsc --noEmit` passes clean after fix
