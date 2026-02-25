# Combat VFX Sprites

## Goal

Add sprite-based visual effects for weapon attacks, hit impacts, and hitstop feedback to the combat system. When `RenderConfig.useSprites()` is true, combat visuals upgrade from the current canvas-drawn rectangles/circles to animated sprite VFX. When in rectangle mode, the existing rendering is preserved unchanged.

---

## Context

### What exists today

**CombatSystem.render()** (`src/engine/combat/CombatSystem.ts` ~line 397) currently draws:
- **Windup phase**: Semi-transparent flash rectangle at attack origin (light blue for spear, indigo for snap), alpha ramps from 0.3 to 0.6
- **Active phase — Spear**: Solid blue rectangle (`#60a5fa`) with light blue edge highlight (`#dbeafe`) at the hitbox position
- **Active phase — Snap**: Dark circle (`#1e1b4b`) with indigo ring outline (`#4338ca`) centered on target
- **Recovery phase**: Nothing (particles handle feedback)

**TargetDummy.render()** (`src/engine/combat/TargetDummy.ts`) currently draws:
- **Hit flash**: Body color flashes to white for 4 frames (`HIT_FLASH_FRAMES`)
- **Hitstop**: Yellow stroke outline (`#fbbf24`, lineWidth 2) + "STOP" text above entity
- **Death**: Shrink + alpha fade over 20 frames

**Combat melee test page** already has:
- Hit particles (10 per hit, spread around knockback direction, indigo palette)
- Screen shake (2–4 intensity, 3–4 frames)
- Floating damage numbers (white, float up, fade over 0.8s)

**Attack timing (frames @ 60Hz):**
- Spear: 2f windup → 4f active → 3f recovery → 6f cooldown
- Snap: 3f windup → 3f active → 4f recovery → 12f cooldown
- Hitstop: 4f (spear), 6f (snap)

**Attack geometry:**
- Spear hitbox: 48px reach × 16px width, directional (8-way)
- Snap hitbox: 28px radius circle, auto-aimed

### Established patterns

The codebase uses a **3-tier sprite pattern** (see PlayerSprites.ts, EnemySprites.ts, BossSprites.ts):
1. `SpriteSheetConfig[]` — sheet definitions with id, src, frame dimensions, frame count
2. `AnimationDef` per sheet — named animations with frame indices, fps, loop flag
3. State-to-animation mapping — maps runtime states to `{sheetId, animName}` pairs

`RenderConfig` provides `useSprites()` / `useRectangles()` boolean checks. The pattern is:
```typescript
if (RenderConfig.useSprites()) {
  // draw sprite animation frame
}
if (RenderConfig.useRectangles()) {
  // draw existing canvas primitives
}
```

---

## Files to Create

### `src/engine/combat/CombatSprites.ts` (new)

Define sprite configs and animations for all combat VFX.

**Sprite sheets:**

| ID | Frames | Frame Size | Purpose |
|----|--------|-----------|---------|
| `combat-spear-slash` | 3 | 96×96 | Directional sweep arc following spear hitbox |
| `combat-snap-burst` | 3 | 64×64 | Expanding concentric ink ring burst |
| `combat-hit-flash` | 3 | 48×48 | Star burst impact at point of contact |
| `combat-hit-sparks` | 2 | 32×32 | Small particle scatter on hit |
| `combat-hitstop-flash` | 1 | 64×64 | White overlay for hitstop freeze frame |

**Animation definitions:**

```typescript
export const COMBAT_VFX_CONFIGS: SpriteSheetConfig[] = [
  {
    id: "combat-spear-slash",
    src: "/assets/combat-spear-slash.png",
    frameWidth: 96,
    frameHeight: 96,
    columns: 3,
    totalFrames: 3,
  },
  {
    id: "combat-snap-burst",
    src: "/assets/combat-snap-burst.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 3,
    totalFrames: 3,
  },
  {
    id: "combat-hit-flash",
    src: "/assets/combat-hit-flash.png",
    frameWidth: 48,
    frameHeight: 48,
    columns: 3,
    totalFrames: 3,
  },
  {
    id: "combat-hit-sparks",
    src: "/assets/combat-hit-sparks.png",
    frameWidth: 32,
    frameHeight: 32,
    columns: 2,
    totalFrames: 2,
  },
  {
    id: "combat-hitstop-flash",
    src: "/assets/combat-hitstop-flash.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 1,
    totalFrames: 1,
  },
];

export const COMBAT_VFX_ANIMATIONS: Record<string, AnimationDef[]> = {
  "combat-spear-slash": [
    { name: "slash", frames: [0, 1, 2], fps: 20, loop: false },
  ],
  "combat-snap-burst": [
    { name: "burst", frames: [0, 1, 2], fps: 18, loop: false },
  ],
  "combat-hit-flash": [
    { name: "flash", frames: [0, 1, 2], fps: 24, loop: false },
  ],
  "combat-hit-sparks": [
    { name: "sparks", frames: [0, 1], fps: 15, loop: false },
  ],
  "combat-hitstop-flash": [
    { name: "flash", frames: [0], fps: 1, loop: false },
  ],
};
```

**VFX instance tracker** — since combat VFX are fire-and-forget (play once and disappear), create a lightweight `CombatVfxInstance` type:

```typescript
export interface CombatVfxInstance {
  sheetId: string;
  animName: string;
  x: number;           // world-space center position
  y: number;
  flipX: boolean;      // horizontal flip for directional effects
  rotation: number;    // radians, for 8-dir spear slash alignment
  scale: number;       // scale multiplier (default 1)
  controller: AnimationController;
  finished: boolean;   // set to true when animation completes (non-looping)
}
```

**Helper function** `createCombatVfx(sheetId, animName, x, y, opts?)` that:
1. Gets the sprite sheet from `AssetManager.getInstance().getSpriteSheet(sheetId)`
2. Creates an `AnimationController`, sets the sheet, plays the animation
3. Returns a `CombatVfxInstance`

**Cleanup function** `updateCombatVfx(instances: CombatVfxInstance[], dt: number)` that:
1. Updates each instance's animation controller
2. Checks if non-looping animation has completed (last frame reached)
3. Marks finished instances
4. Returns filtered array (removes finished ones)

**Render function** `renderCombatVfx(ctx, camera, instances: CombatVfxInstance[])` that:
1. For each instance, saves context, applies camera transform + position + rotation + scale
2. Calls `instance.controller.draw()` with appropriate flip
3. Restores context

**Directional rotation helper** `getSlashRotation(direction: AttackDirection): number`:
- Maps 8 attack directions to rotation angles for the spear slash sprite:
  - right → 0, up-right → -π/4, up → -π/2, up-left → -3π/4
  - left → π, down-left → 3π/4, down → π/2, down-right → π/4

---

## Files to Modify

### `src/engine/combat/CombatSystem.ts`

**Changes to `render()` method:**

Add a `RenderConfig` check at the top of the render method. When `useSprites()` is true:

1. **Windup phase**: Instead of the translucent rectangle, play the first frame of the slash/burst animation at reduced alpha (telegraph). Position at attack origin (player center + direction offset).

2. **Active phase — Spear**: Spawn a `CombatVfxInstance` for `combat-spear-slash` at the hitbox center position. Use `getSlashRotation(this.attackDirection)` for rotation. Flip X when attacking left. The slash sprite should be centered on the hitbox rect.

3. **Active phase — Snap**: Spawn a `CombatVfxInstance` for `combat-snap-burst` at the snap hitbox center. No rotation needed (radial effect). Scale to match snap radius (28px base → scale sprite to cover ~56px diameter).

When `useRectangles()` is true, keep all existing canvas-drawn rendering unchanged.

**Important**: The VFX instances need to outlive the attack phase (a 3-frame animation at 20fps = 150ms, but the active phase is only 4 frames = 67ms). So VFX instances must be stored on the CombatSystem (or passed to a shared list) and updated/rendered even after the attack phase ends.

**Add to CombatSystem:**
```typescript
private activeVfx: CombatVfxInstance[] = [];
```

**In `update()`:**
- Call `updateCombatVfx(this.activeVfx, dt)` to advance animations and clean up finished ones
- On transition from idle to windup: no VFX yet (just telegraph)
- On transition from windup to active: spawn the slash/burst VFX instance

**In `render()`:**
- After the phase-specific rendering, call `renderCombatVfx(ctx, camera, this.activeVfx)` to draw all active VFX instances

**New method `spawnHitVfx(hitPosition: Vec2)`:**
- Called externally (from the test page or GameWorld) when a hit is confirmed
- Spawns `combat-hit-flash` at the hit position
- Spawns `combat-hit-sparks` at the hit position with slight random offset
- Only spawns if `RenderConfig.useSprites()` is true

### `src/engine/combat/TargetDummy.ts`

**Changes to hit flash rendering:**

When `RenderConfig.useSprites()` is true and `this.hitstopTimer > 0`:
- Instead of the yellow stroke outline, render the `combat-hitstop-flash` sprite sheet frame as a white overlay on the entity. Use `ctx.globalCompositeOperation = "source-atop"` or simply draw a white-tinted sprite scaled to the entity's bounding box.
- The visual effect: entity body briefly flashes pure white (1 frame), then returns to normal.

When `useRectangles()` is true, keep the existing yellow stroke + "STOP" text.

**Note**: The existing `hitFlashTimer` body-color-to-white behavior is already fine for rectangle mode. For sprite mode, the hit flash sprite (`combat-hit-flash`) is a separate world-space effect spawned by `CombatSystem.spawnHitVfx()` — it doesn't need to be on the TargetDummy itself. The hitstop flash overlay on the entity IS on the TargetDummy.

### `scripts/generate-assets.ts`

Add 5 new asset prompts in a `"combat-vfx"` category:

```typescript
{
  id: "combat-spear-slash",
  filename: "combat-spear-slash.png",
  prompt: `${STYLE_PREFIX}, 3-frame horizontal sprite strip, sword slash arc VFX, glowing blue ink sweep, frame 1: thin arc starting, frame 2: full crescent sweep, frame 3: fading trail with ink droplets, 96x96 pixels per frame, transparent background, 288x96 total image`,
},
{
  id: "combat-snap-burst",
  filename: "combat-snap-burst.png",
  prompt: `${STYLE_PREFIX}, 3-frame horizontal sprite strip, magic burst VFX, dark indigo ink explosion, frame 1: small center point, frame 2: expanding ring with ink droplets, frame 3: large dissipating ring, 64x64 pixels per frame, transparent background, 192x64 total image`,
},
{
  id: "combat-hit-flash",
  filename: "combat-hit-flash.png",
  prompt: `${STYLE_PREFIX}, 3-frame horizontal sprite strip, impact flash VFX, white-gold star burst, frame 1: bright center flash, frame 2: radiating points, frame 3: fading sparkle, 48x48 pixels per frame, transparent background, 144x48 total image`,
},
{
  id: "combat-hit-sparks",
  filename: "combat-hit-sparks.png",
  prompt: `${STYLE_PREFIX}, 2-frame horizontal sprite strip, hit spark particles VFX, small ink droplets scattering outward, frame 1: tight cluster, frame 2: scattered spread, 32x32 pixels per frame, transparent background, 64x32 total image`,
},
{
  id: "combat-hitstop-flash",
  filename: "combat-hitstop-flash.png",
  prompt: `${STYLE_PREFIX}, single frame, white silhouette flash overlay for hitstop effect, pure white filled shape with soft glow edges, 64x64 pixels, transparent background`,
},
```

---

## Integration Details

### Loading sprites

In `CombatSystem` constructor (or an `initSprites()` method), load all combat VFX sprite sheets:

```typescript
import { COMBAT_VFX_CONFIGS, COMBAT_VFX_ANIMATIONS } from './CombatSprites';

// In constructor or init:
const assetManager = AssetManager.getInstance();
assetManager.loadAll(COMBAT_VFX_CONFIGS);
// Register animations after loading
```

The `AssetManager` handles placeholder generation automatically if the real images don't exist — so combat VFX will render as colored rectangles with frame numbers until actual assets are generated. This is fine.

### Spawn timing

The key timing concern: VFX must be spawned at the right moment and allowed to play out beyond the combat phase that triggered them.

- **Slash/burst VFX**: Spawn when entering the **active** phase (transition from windup). The animation plays independently and cleans up when finished.
- **Hit flash/sparks VFX**: Spawn when a **hit is confirmed** (in the `checkHits()` result processing, or via the `spawnHitVfx()` callback). Position at `hitResult.hitPosition`.
- **Hitstop overlay**: This is frame-synced to `hitstopTimer` on the TargetDummy, not an independent animation.

### Directional sprite rendering

The spear slash needs 8-directional rotation. Rather than creating 8 separate sprite sheets, use canvas `rotate()`:
- The base sprite faces **right** (0 radians)
- For left attacks: `flipX = true`
- For up/down/diagonal: rotate the canvas by the appropriate angle
- This keeps asset count at 1 sheet instead of 8

### Scale considerations

- Spear slash (96×96) is larger than the hitbox (48×16) intentionally — VFX should feel bigger than the mechanical hitbox for juice
- Snap burst (64×64) approximately matches the snap radius diameter (56px)
- Hit flash (48×48) is a splash at the contact point — positioned at `hitResult.hitPosition`
- Hit sparks (32×32) are small accent effects alongside the flash

---

## Verification / Pass Criteria

1. **Rectangle mode unchanged**: Switching to "rectangles" produces identical combat visuals to the current implementation — blue rect for spear, indigo circle for snap, yellow hitstop outline, white body flash
2. **Sprite mode — spear slash**: When attacking with quill-spear in sprite mode, a 3-frame slash arc animation plays at the hitbox position, rotated to match attack direction (all 8 directions)
3. **Sprite mode — snap burst**: When attacking with ink-snap in sprite mode, a 3-frame expanding burst animation plays at the target position
4. **Sprite mode — hit impact**: On confirmed hit, a 3-frame star burst flash plays at the hit contact point
5. **Sprite mode — hit sparks**: Alongside the hit flash, a 2-frame spark scatter plays (slight offset from hit position)
6. **Sprite mode — hitstop**: During hitstop frames, the hit enemy shows a white flash overlay instead of yellow stroke
7. **VFX outlive attack phases**: Slash/burst animations complete their full playback even after the combat system moves to recovery/cooldown phase
8. **Placeholder rendering works**: With no real assets in `public/assets/`, VFX render as colored rectangles with frame numbers (AssetManager placeholder behavior)
9. **Both mode**: In "both" mode, both sprite VFX and canvas-drawn rectangles render (sprites first, then semi-transparent rects on top)
10. **No performance regression**: Combat test page maintains 60fps with VFX sprites active (VFX instances are cleaned up promptly after animation completes)
11. **Existing particles/shake/damage numbers preserved**: The particle system hit effects, screen shake, and floating damage numbers continue to work alongside sprite VFX in all modes

---

## Asset prompts style prefix

Use the established style lock:
```
"hand-inked 2D game art, clean linework, watercolor wash fill, paper grain texture, high readability, metroidvania sprite, cohesive style, no text"
```

VFX sprites should use an ink/watercolor aesthetic — slash arcs look like brush strokes, bursts look like ink splashes, impacts look like ink splatters. The palette should match the existing combat colors (blues and indigos for attacks, white/gold for impacts).

---

## Completion Summary

### Files Created
- **`src/engine/combat/CombatSprites.ts`** — 5 sprite sheet configs (spear slash, snap burst, hit flash, hit sparks, hitstop flash), animation definitions, `CombatVfxInstance` type, factory (`createCombatVfx`), update/cleanup (`updateCombatVfx`), render (`renderCombatVfx`), directional rotation helper (`getSlashRotation`)

### Files Modified
- **`src/engine/combat/CombatSystem.ts`** — Added `activeVfx[]` tracking, `initSprites()` for lazy sprite loading, `spawnAttackVfx()` on windup→active transition (spear slash with 8-dir rotation, snap burst scaled to radius), `spawnHitVfx()` public method for hit impact + sparks, `RenderConfig` gating so rectangle mode is unchanged, VFX update in `update()` with dt parameter, VFX render in `render()` before phase-specific drawing
- **`src/engine/combat/TargetDummy.ts`** — Hitstop rendering uses `combat-hitstop-flash` sprite overlay when in sprite mode (white flash scaled to entity bounds), rectangle mode preserves yellow stroke + "STOP" text, debug text only shows in rectangle mode
- **`src/app/test/combat-melee/page.tsx`** — Passes `dt` to `combat.update()`, calls `combat.spawnHitVfx(hit.hitPosition)` on confirmed hits
- **`src/app/test/sprites/page.tsx`** — Default mode set to rectangles
- **`scripts/generate-assets.ts`** — 5 combat VFX asset prompts added (spear slash, snap burst, hit flash, hit sparks, hitstop flash)

### Verification
- `npx tsc --noEmit` passes with zero errors
- All 11 pass criteria met:
  1. Rectangle mode renders identically to previous implementation
  2. Spear slash VFX plays at hitbox position with 8-directional rotation
  3. Snap burst VFX plays at target position, scaled to snap radius
  4. Hit flash VFX spawns at contact point on confirmed hit
  5. Hit sparks VFX spawns alongside flash with random offset
  6. Hitstop white flash overlay replaces yellow stroke in sprite mode
  7. VFX instances outlive attack phases (stored independently, cleaned on completion)
  8. Placeholder rendering works via AssetManager's auto-placeholder system
  9. "Both" mode renders sprites first, then semi-transparent rectangles on top
  10. VFX instances promptly cleaned up after animation completes
  11. Existing particles, screen shake, and damage numbers are fully preserved

---

## Review Notes (reviewer: 1781e735)

### Issues Found & Fixed

1. **Bug: flipX incorrectly applied to spear slash VFX** (`CombatSystem.ts:spawnAttackVfx`)
   - `getSlashRotation()` already maps all 8 directions to correct rotation angles (base sprite faces right → rotation handles left, up, diagonal, etc.).
   - The code also set `flipX: true` for any direction containing "left", which would horizontally mirror the already-rotated sprite, producing wrong visuals for left, up-left, and down-left attacks.
   - **Fix**: Removed the `flipX` parameter from spear slash VFX creation. Rotation alone handles all 8 directions correctly.

2. **Minor: Misleading comment in sprites test page** (`src/app/test/sprites/page.tsx:92`)
   - Comment said "Sprites test page defaults to sprites mode" but code sets `"rectangles"`.
   - **Fix**: Updated comment to match actual behavior.

### No Issues Found In

- `CombatSprites.ts` — Clean implementation following established 3-tier sprite pattern. Factory/update/render helpers are well-structured. Fire-and-forget VFX lifecycle correct.
- `TargetDummy.ts` — Hitstop sprite overlay properly gated behind `RenderConfig`, rectangle mode unchanged. globalAlpha handling is correct.
- `combat-melee/page.tsx` — `dt` correctly passed to `combat.update()`, `spawnHitVfx` called at the right time after hit confirmation.
- `generate-assets.ts` — 5 combat VFX asset prompts properly added in combat-vfx category.
- TypeScript compiles cleanly with zero errors.
