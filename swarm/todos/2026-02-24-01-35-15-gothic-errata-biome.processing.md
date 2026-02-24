# Task: Gothic Errata — Fear Fog & Input Inversion Biome

## Overview

Implement the **Gothic Errata biome** and its test page (`/test/biome/gothic-errata`). This is Phase 5, step 24 — the fourth and final biome. Where Herbarium Folio added vine grapple locomotion, Astral Atlas modified physics with gravity wells, and Maritime Ledger introduced directional current forces, Gothic Errata's movement texture is **perception and control disruption** — fear fog zones that limit visibility and corruption zones that invert or scramble player input.

The Gothic Errata is a forbidden errata wing of the library — a section of redacted pages, torn manuscripts, and corrupted marginalia. The air is thick with ink mist. Errata fog obscures the environment, limiting the player's vision to a small radius. Corruption patches invert or scramble directional input (left becomes right, jump becomes crouch, etc.), forcing the player to navigate on muscle memory and spatial awareness.

**Core design principle:** Gothic Errata is a **mastery and composure test.** It doesn't add new traversal tools — it degrades the player's existing ones. The challenge is performing precise platforming when you can't see the full level and your controls may be lying to you. Experienced players who have internalized the movement system will thrive; players who rely on visual cues will struggle. This makes it the ideal late-game biome.

**Key distinction from Day/Night corruption:** The Day/Night cycle's corruption modifiers (`CorruptionModifiers.ts`) are global, time-based effects that apply everywhere. Gothic Errata's effects are **spatial** — specific zone-based areas within the level. They are complementary systems, not duplicates. Gothic Errata zones are always active (no day/night dependence).

## Dependencies

- Player entity with full movement (all states, jump, dash, wall mechanics) ✅
- `BiomeTheme` interface (`src/engine/world/Biome.ts`) ✅
- `BiomeBackground` class (`src/engine/world/BiomeBackground.ts`) ✅
- `ParticleSystem`, `Camera`, `ScreenShake`, `Engine` ✅
- `InputManager`, `InputAction` ✅
- `TileMap`, `Platform`, surface types ✅
- `PlayerParams` / `DEFAULT_PLAYER_PARAMS` ✅
- Pattern reference: Herbarium Folio biome test page (`src/app/test/biome/herbarium-folio/page.tsx`) ✅

## Biome Design: Gothic Errata

### Visual Theme

**Palette:** Dark gothic manuscript — charcoal blacks, deep crimsons, sickly greens, rusted iron, corrupted ink

- Background: `#0d0a0a` (near-black charcoal)
- Platform fill: `#2d1f1f` (dark maroon-brown)
- Platform stroke: `#5c3a3a` (rusted crimson)
- Accent 1: `#dc2626` (blood red — danger markers, corruption zones)
- Accent 2: `#4ade80` (sickly green — errata text, corruption particles)
- Accent 3: `#a855f7` (violet — fog boundary edges)
- Accent 4: `#78716c` (ash gray — fog itself)
- Paper texture: `#d4c4a8` with very low alpha (stained parchment grain)

Create `GOTHIC_ERRATA_THEME` in `src/engine/world/Biome.ts`:
```typescript
export const GOTHIC_ERRATA_THEME: BiomeTheme = {
  id: "gothic-errata",
  name: "Gothic Errata",
  backgroundColor: "#0d0a0a",
  platformFillColor: "#2d1f1f",
  platformStrokeColor: "#5c3a3a",
  ambientParticleColors: ["#4ade80", "#dc2626", "#a855f7", "#78716c"],
  ambientParticleRate: 3,
  foregroundTint: "rgba(220, 38, 38, 0.02)",
  palette: [
    "#0d0a0a",  // Charcoal (background)
    "#2d1f1f",  // Dark maroon (platforms)
    "#5c3a3a",  // Rusted crimson (outlines)
    "#dc2626",  // Blood red (corruption)
    "#4ade80",  // Sickly green (errata)
    "#d4c4a8",  // Stained parchment (texture)
  ],
};
```

### Parallax Background

Create `createGothicErrataBackground()` in `BiomeBackground.ts`. Three deterministic layers:

- **Layer 1** (`parallaxFactor: 0.05`): Faint manuscript lines — ruled lines at random angles (torn pages), scattered redacted blocks (black rectangles with red strikethrough lines). Very low alpha (0.06).
- **Layer 2** (`parallaxFactor: 0.2`): Corrupted marginalia — small scattered text-like squiggly lines (random short wavy paths suggesting illegible handwriting), drip marks (vertical streaks), small crosses/marks. Dark crimson (#dc2626) at 0.10 alpha.
- **Layer 3** (`parallaxFactor: 0.5`): Torn page edges — jagged vertical and horizontal lines suggesting ripped paper borders. Ash gray (#78716c) at 0.15 alpha. Occasional ink blot circles (dark, irregular).

## New Engine System: FogSystem

Create `src/engine/world/FogSystem.ts`.

This system manages fog-of-war zones and corruption/inversion zones. It's the biome's core mechanic.

### Fog Zone Data

```typescript
export interface FogZone {
  /** Unique ID */
  id: string;
  /** Rectangular area of the fog zone in world space */
  rect: Rect;
  /** Type of fog effect */
  type: "fog" | "inversion" | "scramble";
  /** Fog density (0-1). Higher = less visibility. Only for "fog" type. */
  density: number;
  /** Whether this zone is active */
  active: boolean;
}
```

**Zone types:**
- `"fog"` — Limits visibility. Within this zone, the player's view is restricted to a radial area. Everything outside the radius fades to black. The radius shrinks as `density` increases.
- `"inversion"` — Inverts horizontal controls. Left input → right movement, right input → left movement. Vertical controls unchanged. A red-tinted screen edge indicates the inversion is active.
- `"scramble"` — Remaps directional inputs randomly. Each time the player enters the zone, the mapping is shuffled (Left→Up, Right→Down, Jump→Dash, etc.). The mapping stays consistent while inside the zone. A green-tinted glitch effect indicates the scramble.

### Fog System Params

```typescript
export interface FogSystemParams {
  /** Visibility radius in fog zones (pixels). Decreases with density. */
  baseFogRadius: number;
  /** Minimum visibility radius (even at max density, player can see this far) */
  minFogRadius: number;
  /** How quickly fog fades in when entering a zone (0-1 per frame, 1 = instant) */
  fogFadeInRate: number;
  /** How quickly fog fades out when leaving a zone (0-1 per frame) */
  fogFadeOutRate: number;
  /** Whether dash clears fog temporarily (brief flash of full visibility) */
  dashClearsFog: boolean;
  /** Duration of dash-clear effect in frames */
  dashClearDuration: number;
  /** Whether inversion affects dash direction */
  inversionAffectsDash: boolean;
  /** Whether scramble affects dash direction */
  scrambleAffectsDash: boolean;
  /** Visual intensity of the inversion screen tint (0-1) */
  inversionTintStrength: number;
  /** Visual intensity of the scramble glitch effect (0-1) */
  scrambleGlitchStrength: number;
  /** Transition grace period — frames after entering an inversion/scramble zone before effect activates */
  controlTransitionDelay: number;
}

export const DEFAULT_FOG_SYSTEM_PARAMS: FogSystemParams = {
  baseFogRadius: 200,
  minFogRadius: 80,
  fogFadeInRate: 0.08,
  fogFadeOutRate: 0.15,
  dashClearsFog: true,
  dashClearDuration: 15,
  inversionAffectsDash: false,
  scrambleAffectsDash: false,
  inversionTintStrength: 0.15,
  scrambleGlitchStrength: 0.2,
  controlTransitionDelay: 10,
};
```

### FogSystem Class

```typescript
export class FogSystem {
  zones: FogZone[];
  params: FogSystemParams;

  // Internal state
  private currentFogLevel: number;       // 0 = clear, 1 = max fog (smoothed)
  private currentInversion: boolean;     // Whether horizontal controls are inverted
  private currentScramble: boolean;      // Whether controls are scrambled
  private scrambleMap: Map<string, string>; // Input action remapping
  private transitionTimer: number;       // Grace period counter
  private dashClearTimer: number;        // Remaining frames of dash-clear

  constructor(zones: FogZone[], params?: Partial<FogSystemParams>);

  /**
   * Update fog state based on player position.
   * Call each frame before input processing.
   * Returns current control modification state.
   */
  update(playerBounds: Rect, isDashing: boolean): FogState;

  /**
   * Get the current effective visibility radius at the player's position.
   * Returns Infinity when not in fog.
   */
  getVisibilityRadius(): number;

  /**
   * Remap an input action through the current control modification.
   * If no modification is active, returns the original action.
   * Usage: instead of checking `input.isHeld(InputAction.Left)`,
   * check `input.isHeld(fogSystem.remapAction(InputAction.Left))`.
   */
  remapAction(action: string): string;

  /**
   * Check if horizontal controls are currently inverted.
   */
  isInverted(): boolean;

  /**
   * Check if controls are currently scrambled.
   */
  isScrambled(): boolean;

  /**
   * Render fog overlay on the canvas.
   * This draws a radial gradient mask centered on the player.
   * Call this AFTER all world rendering, BEFORE HUD rendering.
   * Uses canvas compositing: draw a full-screen dark rect,
   * then cut out a radial gradient hole at the player position.
   */
  renderFogOverlay(
    ctx: CanvasRenderingContext2D,
    playerScreenX: number,
    playerScreenY: number,
    canvasWidth: number,
    canvasHeight: number
  ): void;

  /**
   * Render control modification screen effects.
   * - Inversion: subtle red tint on screen edges
   * - Scramble: brief green glitch lines at random positions
   */
  renderControlEffects(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number
  ): void;

  /**
   * Render debug overlay: zone outlines, zone types, current state.
   */
  renderDebug(ctx: CanvasRenderingContext2D): void;

  /**
   * Render fog zone boundaries as in-world visuals (always visible).
   * Fog zone edges have drifting particle borders.
   * Inversion zones have a red glow at the boundary.
   * Scramble zones have a green glow.
   */
  renderZoneBoundaries(ctx: CanvasRenderingContext2D): void;
}

/** Returned by update() to inform the test page of current state */
export interface FogState {
  inFog: boolean;
  fogLevel: number;           // 0-1 smoothed
  visibilityRadius: number;   // Current visibility radius (px)
  inverted: boolean;          // Horizontal controls inverted
  scrambled: boolean;         // Controls scrambled
  dashClearing: boolean;      // Fog temporarily cleared by dash
  activeZoneIds: string[];    // Which zones the player overlaps
}
```

### Input Remapping Details

**Inversion (simpler):**
- `InputAction.Left` ↔ `InputAction.Right` — swapped
- All other actions unchanged
- This is disorienting but learnable — experienced players adapt within seconds

**Scramble (harder):**
When entering a scramble zone, generate a random remapping of the 4 directional inputs:
```
[Left, Right, Up, Down] → random permutation
```
For example: Left→Down, Right→Up, Up→Right, Down→Left.
Jump, Dash, Attack, and ability buttons are NOT scrambled (that would be unfair — the disruption should test spatial awareness, not action memory).

The scramble mapping is generated once on zone entry and stays consistent until the player exits and re-enters. This lets the player learn the mapping through trial and error. Different zones may have different scramble seeds.

**Test page wiring:**
The test page replaces direct input reads with fog-filtered input:
```typescript
// Instead of:
const moveLeft = input.isHeld(InputAction.Left);
// Use:
const moveLeft = input.isHeld(fogSystem.remapAction(InputAction.Left));
```

However, since `Player.update()` reads input internally, we need a different approach. The FogSystem should intercept by temporarily modifying the InputManager's key mapping. The cleanest approach:

1. Before `player.update(dt)`, call `fogSystem.applyInputOverride(inputManager)` which swaps the key bindings in the InputManager's key map.
2. After `player.update(dt)`, call `fogSystem.restoreInputOverride(inputManager)` which restores original bindings.

This way the Player code doesn't need to know about fog — it reads the InputManager normally, but the InputManager's mappings have been temporarily swapped.

**Alternatively**, since the Player reads `InputAction` constants from the `InputManager`, and the InputManager maps physical keys to actions, we can add a `remapLayer` to the InputManager:

```typescript
// Add to InputManager:
setActionRemap(remap: Map<string, string> | null): void;
```

When a remap is set, `isHeld(action)` internally redirects: if `remap.has(action)`, check `remap.get(action)` instead. This is the cleanest approach — one line to activate, one line to deactivate, no timing issues.

**IMPORTANT:** Add the `setActionRemap` / `clearActionRemap` method to InputManager.ts. This is a minimal, clean addition:
```typescript
// In InputManager class:
private actionRemap: Map<string, string> | null = null;

setActionRemap(remap: Map<string, string> | null): void {
  this.actionRemap = remap;
}

// Modify isPressed, isHeld, consumeBufferedInput to remap:
private resolveAction(action: string): string {
  if (this.actionRemap && this.actionRemap.has(action)) {
    return this.actionRemap.get(action)!;
  }
  return action;
}

// Then in isHeld(action): use this.resolveAction(action) instead of action directly
// Same for isPressed, consumeBufferedInput
```

This is the ONE modification to an existing engine file. Everything else is new code.

### Fog Rendering

The fog overlay uses canvas compositing to create a "flashlight" effect:

```typescript
renderFogOverlay(ctx, playerScreenX, playerScreenY, canvasWidth, canvasHeight) {
  if (this.currentFogLevel <= 0) return;

  const radius = this.getVisibilityRadius();

  ctx.save();
  // Draw full-screen dark overlay
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = `rgba(13, 10, 10, ${this.currentFogLevel * 0.92})`;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Cut out a radial gradient hole at the player position
  ctx.globalCompositeOperation = "destination-out";
  const gradient = ctx.createRadialGradient(
    playerScreenX, playerScreenY, radius * 0.3,
    playerScreenX, playerScreenY, radius
  );
  gradient.addColorStop(0, "rgba(0, 0, 0, 1)");   // Fully transparent center
  gradient.addColorStop(0.7, "rgba(0, 0, 0, 0.8)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");   // Smooth fade to opaque
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.restore();
}
```

When `dashClearsFog` is true and the player dashes, the fog temporarily clears — `dashClearTimer` is set to `dashClearDuration`, and during that time `currentFogLevel` is forced to 0. This creates a satisfying "flash of clarity" on dash, rewarding aggressive play.

### Zone Boundary Rendering

Zone boundaries should be visible OUTSIDE the fog (they're atmospheric borders, not hidden traps):

- **Fog zones:** Drifting ink mist particles at the edges. Small dark particles that drift inward, suggesting the fog pulls things in. A faint purple edge glow (violet #a855f7 at 0.15 alpha).
- **Inversion zones:** Pulsing red boundary lines. Small red arrow particles that point in the wrong direction (visual hint). A subtle red glow.
- **Scramble zones:** Flickering green boundary lines that jitter position each frame. Small green "static" particles. A subtle green glow. The boundary itself is slightly unstable-looking.

## Test Level Layout

Arena: **3200×1080** pixels. The level progresses from simple fog to combined effects.

### Area 1 — Fog Introduction (x: 0–800)

Simple platforming with a single fog zone across the middle section. The player can see the platforms before entering the fog, must remember the layout, then navigate through by feel.

- Ground floor at y=960 (left half only, x: 0–400)
- 4 platforms at varying heights inside the fog zone (x: 200–700)
- **Fog zone:** rect { x: 150, y: 0, width: 550, height: 1080 }, density: 0.7
- Landing platform at x: 700, y: 960 (visible beyond the fog)
- Goal zone at x: 750, y: 900: "Navigate the fog"
- Teaches: fog limits visibility, you must memorize or guess platform positions

### Area 2 — Inversion Challenge (x: 800–1600)

A platforming gauntlet with an inversion zone. The player can see the platforms (no fog here) but controls are flipped.

- Series of 5 platforms forming a zigzag pattern (alternating left-right jumps)
- Platform spacing: 150px horizontal, 100px vertical — tight but doable with normal controls, challenging when inverted
- **Inversion zone:** rect { x: 850, y: 0, width: 700, height: 1080 }
- The inversion zone has a clear red boundary glow on entry
- `controlTransitionDelay` gives 10 frames (~0.17s) of normal controls after entry — a grace period
- Goal zone at x: 1500, y: 400: "Master the mirror"
- Teaches: inversion is disorienting but consistent — player adapts

### Area 3 — Scramble Maze (x: 1600–2400)

A wider, more forgiving platforming area with a scramble zone. Platforms are larger (generous landing zones) because scrambled controls are brutal.

- Wide platforms (160–200px) arranged in a loose grid pattern
- Multiple valid paths through the area (not a single demanding sequence)
- **Scramble zone:** rect { x: 1650, y: 0, width: 700, height: 1080 }
- Scramble mapping generated on entry, consistent within the zone
- Larger platforms and more options let the player experiment with the remapped controls
- Small "signpost" platforms just outside the zone that the player can retreat to
- Goal zone at x: 2300, y: 300: "Decode the scramble"
- Teaches: scramble is learnable — try each direction, build a mental map

### Area 4 — Combined Gauntlet (x: 2400–3200)

The final challenge: fog + control modification zones layered together. The player must navigate platforms they can't see while their controls are modified.

- Tight platforming sequence with moderate difficulty
- **Fog zone:** covers the first half (x: 2450–2800, density: 0.6)
- **Inversion zone:** covers the second half (x: 2800–3150)
- Overlap region (x: 2800–2800): brief combined effect
- A narrow corridor with walls on both sides (wall-jump sections)
- **Goal A** at x: 2700, y: 300: inside the fog (must navigate blind)
- **Goal B** at x: 3100, y: 200: inside the inversion zone (must platform with flipped controls)
- Teaches: composure under combined pressure

### Platform Construction Tips
- Fog area platforms should be wider (160–200px) — the player can't see edges clearly
- Inversion platforms should have generous horizontal spacing (player often overshoots when learning)
- Scramble platforms should be the widest (200px+) — scramble is the hardest effect
- Place "safe zones" (outside all effect zones) between areas so the player can reset
- Wall surfaces alongside tricky sections for wall-jump safety nets

## Files to Create

### 1. `src/engine/world/FogSystem.ts`
The complete FogSystem class with FogZone interface, FogSystemParams, DEFAULT_FOG_SYSTEM_PARAMS, FogState interface, and all rendering methods.

### 2. `src/app/test/biome/gothic-errata/page.tsx`
Full test page replacing the stub.

## Files to Modify

### 3. `src/engine/world/Biome.ts`
Add `GOTHIC_ERRATA_THEME` constant.

### 4. `src/engine/world/BiomeBackground.ts`
Add `createGothicErrataBackground()` factory function.

### 5. `src/engine/input/InputManager.ts`
Add `setActionRemap()` method and `resolveAction()` internal helper. This is a minimal addition — 3 methods, ~15 lines. Do NOT restructure the existing InputManager code. Just add:
- `private actionRemap: Map<string, string> | null = null;`
- `setActionRemap(remap: Map<string, string> | null): void`
- `private resolveAction(action: string): string`
- Update `isHeld()`, `isPressed()`, and `consumeBufferedInput()` to use `resolveAction()`

### 6. `src/lib/testStatus.ts`
Update Gothic Errata status from `"not-started"` to `"in-progress"`.

### 7. `AGENTS.md`
Add a FogSystem documentation section after the existing biome/world system docs.

## Test Page Structure

Follow the exact pattern of the Herbarium Folio test page:

```
'use client'
imports...

// Level constants
const LEVEL_WIDTH = 3200;
const LEVEL_HEIGHT = 1080;
const PLAYER_SPAWN = { x: 100, y: 900 };

// Platform definitions for each area
// Fog zone definitions
// Goal zone definitions

export default function GothicErrataTest() {
  // Refs: engine, player, tileMap, camera, particles, input, fogSystem
  // State: params, debug toggles, goals reached

  const onEngineReady = useCallback((engine, canvas) => {
    // Create all systems
    // Create FogSystem with zone definitions
    // Build TileMap from all platforms

    // Wire engine.onUpdate:
    //   1. fogSystem.update(playerBounds, isDashing)
    //   2. fogSystem.applyInputOverride(inputManager) — sets remap if in inversion/scramble zone
    //   3. player.update(dt)
    //   4. fogSystem.restoreInputOverride(inputManager) — clear remap
    //   5. resolveCollisions()
    //   6. camera.follow(player)
    //   7. particles.update(dt)
    //   8. goal zone checks

    // Wire engine.onRender:
    //   In camera transform:
    //     1. Biome background
    //     2. TileMap (biome-colored platforms)
    //     3. Fog zone boundaries (always visible — atmospheric borders)
    //     4. Player
    //     5. Particles
    //     6. Debug overlays (if enabled)
    //   After camera transform (screen-space):
    //     7. fogSystem.renderFogOverlay(ctx, playerScreenX, playerScreenY, ...)
    //     8. fogSystem.renderControlEffects(ctx, canvasWidth, canvasHeight)
    //     9. Goal zone HUD indicators
    //     10. State/velocity debug text
  }, []);

  return (
    <div className="flex h-screen bg-gray-950">
      <div className="flex-1 flex items-center justify-center">
        <GameCanvas onEngineReady={onEngineReady} width={960} height={540} />
      </div>
      <DebugPanel>
        {/* Fog Params section with sliders */}
        {/* Player Params section */}
        {/* Debug Info (read-only) */}
        {/* Goals / Pass Criteria */}
      </DebugPanel>
    </div>
  );
}
```

## Debug Panel Sections

1. **Fog Params** (expanded):
   | Parameter | Min | Max | Step | Default |
   |-----------|-----|-----|------|---------|
   | Base Fog Radius | 50 | 400 | 10 | 200 |
   | Min Fog Radius | 30 | 200 | 10 | 80 |
   | Fog Fade In Rate | 0.01 | 0.5 | 0.01 | 0.08 |
   | Fog Fade Out Rate | 0.01 | 0.5 | 0.01 | 0.15 |
   | Dash Clears Fog | toggle | | | true |
   | Dash Clear Duration | 5 | 40 | 1 | 15 |
   | Inversion Affects Dash | toggle | | | false |
   | Scramble Affects Dash | toggle | | | false |
   | Inversion Tint Strength | 0 | 0.5 | 0.01 | 0.15 |
   | Scramble Glitch Strength | 0 | 0.5 | 0.01 | 0.2 |
   | Control Transition Delay | 0 | 30 | 1 | 10 |

2. **Player Params** (collapsed): Standard movement sliders (maxRunSpeed, jumpSpeed, riseGravity, fallGravity, dashSpeed, airControl)

3. **Debug Info** (read-only):
   - Current player state
   - Player velocity (x, y)
   - In fog: yes/no + current density
   - Fog level (smoothed 0-1)
   - Visibility radius
   - Controls inverted: yes/no
   - Controls scrambled: yes/no
   - Active scramble map (display current remapping)
   - Dash clear active: yes/no
   - Active zone IDs

4. **Goals** (bottom):
   Pass criteria checklist with checkboxes

## Pass Criteria

1. **Fog reduces visibility:** Entering a fog zone progressively darkens the screen, leaving a radial light area around the player
2. **Fog radius scales with density:** Higher density zones produce smaller visibility radius
3. **Fog fade-in is smooth:** Entering fog zone fades in over multiple frames (not instant snap)
4. **Fog fade-out is smooth:** Exiting fog zone fades out smoothly
5. **Dash clears fog:** Dashing while in fog briefly flashes full visibility
6. **Inversion works:** Entering an inversion zone flips left/right controls
7. **Inversion visual indicator:** Red tint appears on screen edges during inversion
8. **Inversion grace period:** Controls stay normal for `controlTransitionDelay` frames after entering
9. **Scramble works:** Entering a scramble zone remaps directional controls
10. **Scramble is consistent:** The same scramble zone keeps the same remapping until exit and re-entry
11. **Scramble visual indicator:** Green glitch effect appears during scramble
12. **Zone boundaries visible:** Fog/inversion/scramble zones have visible boundary particles and glow
13. **Goal A reached:** Navigate through fog to reach goal (Area 1)
14. **Goal B reached:** Platform through inverted controls (Area 2)
15. **Goal C reached:** Traverse scramble maze (Area 3)
16. **Goal D reached:** Complete the combined gauntlet (Area 4)
17. **No movement seams:** Fog and control effects don't break state transitions
18. **Dash immune to inversion/scramble (default):** Dash direction is unaffected by control modifications when toggle is off
19. **All sliders work:** Adjusting fog params visibly changes behavior in real-time

## Implementation Notes

1. **InputManager modification is minimal.** Only add `actionRemap`, `setActionRemap()`, `resolveAction()`, and modify `isHeld()`/`isPressed()`/`consumeBufferedInput()` to call `resolveAction()`. Don't restructure anything else. The remap is a passthrough layer — when null, behavior is identical to before.

2. **FogSystem is a pure engine class** — no React dependencies. It lives in `src/engine/world/` alongside VineSystem, GravityWellSystem, and CurrentSystem.

3. **Fog rendering uses canvas compositing.** The `destination-out` composite operation cuts a transparent hole in an opaque overlay. This is a standard technique for fog-of-war in Canvas 2D. Performance is fine because it's a single draw operation per frame.

4. **Scramble mapping generation:** Use a Fisher-Yates shuffle on the directional actions array `[Left, Right, Up, Down]`. Seed the shuffle with the zone ID hash so different zones produce different scrambles, but the same zone always produces the same scramble for a given session. Re-randomize on zone re-entry (exit and enter again).

5. **The FogSystem does NOT modify Player.ts or the state machine.** It works entirely through InputManager remap and post-render overlays. The player code is untouched except for the InputManager's `resolveAction()` addition.

6. **Camera:** Use Camera with smooth follow. Level is 3200×1080, so horizontal scrolling with slight vertical range.

7. **Respawn:** If the player falls below `LEVEL_HEIGHT + 200`, respawn at `PLAYER_SPAWN` position.

8. **Zone overlap handling:** If the player is in multiple zones simultaneously (e.g., fog + inversion in Area 4's overlap), both effects apply. Fog level uses the densest overlapping fog zone. Inversion and scramble are mutually exclusive — if somehow overlapping (shouldn't happen in the test layout), inversion takes priority.

9. **Performance:** The fog overlay is a single composited rectangle + radial gradient per frame. The control effect overlays (tint, glitch lines) are a few draw calls. Total overhead should be negligible.

10. **The control transition delay is important for fairness.** When the player walks into an inversion/scramble zone, they get `controlTransitionDelay` frames of normal controls. This prevents the scenario where they jump at a zone boundary and immediately lose control mid-air. The delay lets them commit to a jump or dash before the effect kicks in.

## Verification

- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build` succeeds
- [ ] Navigate to `/test/biome/gothic-errata` — canvas renders level with visible zone boundaries
- [ ] Area 1: Fog zone darkens screen with radial visibility, platforms navigable by memory
- [ ] Area 2: Inversion zone flips left/right with red tint indicator
- [ ] Area 3: Scramble zone remaps directions with green glitch effect
- [ ] Area 4: Combined fog + inversion works correctly
- [ ] Dash clears fog briefly (flash of clarity)
- [ ] Grace period prevents instant control loss on zone entry
- [ ] Zone boundaries render with particles and colored glow
- [ ] All fog params tunable via sliders, effects update in real-time
- [ ] InputManager's `setActionRemap` works without breaking existing input behavior
- [ ] No regressions to movement, jumping, dashing, or wall mechanics
- [ ] FPS stays at ~60 with all fog/effect rendering active
- [ ] TypeScript strict, no build errors
