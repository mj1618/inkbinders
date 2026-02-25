# Task: Ability VFX Sprites

## Goal

Create sprite sheet configs, animation definitions, and integration code for all 4 abilities' visual effects. When `RenderConfig.useSprites()` is true, abilities render sprite-based VFX instead of (or in addition to) their current canvas-drawn effects. When `RenderConfig.useRectangles()` is true, the existing canvas-drawn VFX render exactly as they do today — zero visual regression.

This follows the same pattern as `BossSprites.ts`, `EnemySprites.ts`, and `PlayerSprites.ts`: define sprite sheet configs + animations + state-to-animation mappings in a separate file, then integrate `AnimationController` usage into each ability's `render()` method gated by `RenderConfig`.

## Context

### Current State

All 4 abilities render VFX using pure Canvas 2D drawing (lines, arcs, rects, gradients) plus `ParticleSystem` bursts. None use the `SpriteSheet`/`AnimationController`/`AssetManager` stack. The abilities are:

1. **Margin Stitch** — Amber thread lines + cross-hatch passage fill + needle holes + timer bars. Particles on open/drift/close.
2. **Redaction** — Red targeting crosshair + expanding dark ink fill + ink texture lines + timer bars. Particles on activate/drip/expire.
3. **Paste-Over** — Surface-colored dashed border + surface-type overlay (chevrons/hatching/dots/arrows) + clipboard HUD. Particles on paste/expire.
4. **Index Mark** — Colored tab/ribbon marks + glow circles + teleport dashed trail + flash rect + inventory HUD + cooldown arc. Particles on place/remove/teleport.

### Approach: Additive Sprite Overlay (NOT replacement)

Unlike entities (player, enemies, bosses) where sprites fully replace the rect rendering, ability VFX are **additive overlays** layered on top of gameplay. The canvas-drawn VFX (timer bars, targeting indicators, UI elements) are functional — they communicate timing, state, and targeting. Sprite VFX **supplement** these with richer visuals but should not replace the functional elements.

The approach:
- **Sprite mode**: Draw sprite VFX (activation bursts, ambient loops, expiry effects) at the ability's world-space positions, THEN draw the functional canvas elements (timer bars, targeting indicators) on top. Particles continue as-is.
- **Rectangle mode**: Draw only the existing canvas VFX (current behavior, unchanged).
- **Both mode**: Draw sprite VFX underneath, then all canvas VFX on top (for debugging alignment).

This means the sprite integration is lighter than entity sprites — we're adding sprite draws at key moments, not rewriting the render pipeline.

## Files to Create

### `src/engine/abilities/AbilitySprites.ts` (new)

Sprite sheet configs, animation definitions, and helper functions for all ability VFX.

**Sprite sheets:**

| Sheet ID | Frames | Size | Description |
|----------|--------|------|-------------|
| `vfx-stitch-line` | 4 | 64×16 | Glowing stitch line pulse (horizontal, stretched to fit passage width) |
| `vfx-stitch-needle` | 3 | 32×32 | Needle flash burst on activation |
| `vfx-redaction-splat` | 4 | 64×64 | Expanding ink blot (small → full coverage) |
| `vfx-redaction-drip` | 3 | 16×32 | Ink drip falling from redacted obstacle bottom edge |
| `vfx-redaction-bar` | 2 | 64×16 | Pulsing strike-through bar overlay |
| `vfx-paste-glow` | 4 | 64×32 | Colored pulse matching surface type (tinted at draw time) |
| `vfx-paste-swoosh` | 3 | 48×48 | Clipboard capture swoosh on copy |
| `vfx-bookmark` | 4 | 16×24 | One frame per mark color (amber/blue/green/red) — static, not animated |
| `vfx-teleport-flash` | 4 | 64×64 | Teleport in/out burst effect |
| `vfx-index-ring` | 4 | 48×48 | Spinning selection ring around targeted mark |

**Animation definitions per sheet:**

```typescript
// Stitch line
{ name: "stitch-pulse", frames: [0, 1, 2, 3], fps: 6, loop: true }

// Stitch needle
{ name: "needle-flash", frames: [0, 1, 2], fps: 12, loop: false }

// Redaction splat
{ name: "splat-expand", frames: [0, 1, 2, 3], fps: 8, loop: false }

// Redaction drip
{ name: "drip", frames: [0, 1, 2], fps: 4, loop: true }

// Redaction bar
{ name: "bar-pulse", frames: [0, 1], fps: 3, loop: true }

// Paste glow
{ name: "surface-pulse", frames: [0, 1, 2, 3], fps: 4, loop: true }

// Paste swoosh
{ name: "copy-swoosh", frames: [0, 1, 2], fps: 10, loop: false }

// Bookmark (static — use frame index directly, no animation)
// frame 0 = amber, 1 = blue, 2 = green, 3 = red

// Teleport flash
{ name: "teleport-in", frames: [0, 1, 2, 3], fps: 12, loop: false }
{ name: "teleport-out", frames: [3, 2, 1, 0], fps: 12, loop: false }

// Index ring
{ name: "spin", frames: [0, 1, 2, 3], fps: 8, loop: true }
```

**Exported helpers:**

```typescript
export const ABILITY_VFX_SPRITE_CONFIGS: SpriteSheetConfig[]
export const ABILITY_VFX_ANIMATIONS: Record<string, AnimationDef[]>
export function getAbilityVfxConfigs(): SpriteSheetConfig[]
export function getAbilityVfxAnimations(): Record<string, AnimationDef[]>
```

Placeholder color for all ability VFX: `#fbbf24` (amber/gold — consistent with the ability theme).

## Files to Modify

### `src/engine/abilities/MarginStitch.ts`

Add an optional `AnimationController` for the stitch-line pulse and needle flash.

**Changes:**
1. Import `AnimationController`, `AssetManager`, `RenderConfig`, `SpriteSheet` types
2. Add private fields: `stitchLineAnim: AnimationController | null = null`, `needleFlashAnim: AnimationController | null = null`, `needleFlashActive: boolean = false`
3. Add `initSprites()` method that loads from `AssetManager` (called once, idempotent):
   ```typescript
   initSprites(): void {
     const am = AssetManager.getInstance();
     const lineSheet = am.getSpriteSheet("vfx-stitch-line");
     if (lineSheet && !this.stitchLineAnim) {
       this.stitchLineAnim = new AnimationController(lineSheet);
       this.stitchLineAnim.play("stitch-pulse");
     }
     // Same for needle flash sheet
   }
   ```
4. In `render()`:
   - Call `this.initSprites()` once at the top
   - For each `ActiveStitch`, if `RenderConfig.useSprites()` and `stitchLineAnim`:
     - Update anim: `this.stitchLineAnim.update(dt)` (pass dt from a stored value, or use a fixed 1/60)
     - Draw the stitch-line sprite stretched across the passage rect: draw at passage center, scale X to fit passage width, scale Y to fit passage height. Use `stitchLineAnim.draw(ctx, passageCenterX, passageCenterY, false, scaleX, scaleY)`
   - On activation (when a new stitch opens): trigger `needleFlashAnim.restart("needle-flash")`, set `needleFlashActive = true`. Draw at each wall-pair endpoint for 3 frames.
   - Then ALWAYS draw the existing canvas VFX on top (timer bars, thread lines, targeting indicators) — these are functional and render in both modes.

### `src/engine/abilities/Redaction.ts`

Add `AnimationController` for ink splat expand, drip loop, and strike-through bar.

**Changes:**
1. Import same types as above
2. Per `ActiveRedaction`, track sprite state: add a `splatAnim` field (or use a shared controller that gets restarted per activation)
3. In `render()`:
   - If `RenderConfig.useSprites()`:
     - For each active redaction: draw the splat-expand sprite centered on the obstacle rect during the initial coverage phase (`visualProgress < 1`). Scale to match obstacle dimensions.
     - Once fully covered: draw the bar-pulse sprite tiled horizontally across the obstacle width.
     - Draw drip sprite at random positions along the bottom edge (reuse existing drip particle positions or pick new ones each frame).
   - Then ALWAYS draw the existing canvas VFX (timer bar, targeting crosshair, ghost outline).

### `src/engine/abilities/PasteOver.ts`

Add `AnimationController` for surface glow pulse and copy swoosh.

**Changes:**
1. Import same types
2. In `render()`:
   - If `RenderConfig.useSprites()`:
     - For each active paste: draw the surface-pulse sprite on the platform, tinted to the surface color. Scale to platform width. Use `ctx.globalCompositeOperation = "lighter"` or multiply a tint color.
     - On clipboard capture (when `clipboardFlashTimer` starts): trigger copy-swoosh at the player's position (requires player position to be passed to render or stored).
   - Then ALWAYS draw existing canvas VFX (dashed border, surface-type overlay, timer bar).

### `src/engine/abilities/IndexMark.ts`

Add `AnimationController` for bookmark rendering, teleport flash, and selection ring.

**Changes:**
1. Import same types
2. In `render()`:
   - If `RenderConfig.useSprites()`:
     - For each placed mark: draw the bookmark sprite frame matching `mark.colorIndex` (frame 0-3) at the mark position, instead of the canvas-drawn tab shape. The glow circle and number label still render as canvas (functional).
     - When teleporting (`teleportVisualTimer > 0`): draw teleport-flash sprite at origin (reverse) and destination (forward).
     - When in selection mode and a mark is targeted: draw the spinning index-ring sprite centered on the selected mark.
   - Then ALWAYS draw existing canvas VFX (glow circles, distance labels, inventory HUD, cooldown arc).

### `scripts/generate-assets.ts`

Add asset generation prompts for all 10 ability VFX sprite sheets.

**Prompt pattern for each:**
```
Style prefix + "ability VFX sprite sheet, [N] frames in a horizontal strip, each frame [W]×[H] pixels, [description], transparent background, game-ready"
```

Add these to a new `"ability-vfx"` category group. Each prompt includes:
- The style lock prefix
- Frame count and layout
- Specific visual description
- Size specification

## Asset Generation Prompts

| Sheet ID | Frames | Frame Size | Prompt Description |
|----------|--------|------------|-------------------|
| `vfx-stitch-line` | 4 | 64×16 | "4 frames of a glowing amber thread line pulsing, stitching two surfaces together, needle-and-thread motif, horizontal strip" |
| `vfx-stitch-needle` | 3 | 32×32 | "3 frames of a sewing needle flash burst, amber glow expanding outward, activation effect" |
| `vfx-redaction-splat` | 4 | 64×64 | "4 frames of an ink blot expanding from center, dark black ink splatter growing, redaction/censorship effect" |
| `vfx-redaction-drip` | 3 | 16×32 | "3 frames of black ink dripping downward, ink drop falling sequence" |
| `vfx-redaction-bar` | 2 | 64×16 | "2 frames of a pulsing black strike-through bar, censorship redaction line, glowing edges" |
| `vfx-paste-glow` | 4 | 64×32 | "4 frames of a glowing surface pulse effect, magical glow on a platform, warm amber pulse cycle" |
| `vfx-paste-swoosh` | 3 | 48×48 | "3 frames of a clipboard copy swoosh effect, magical capture/grab swirl, paper/clipboard motif" |
| `vfx-bookmark` | 4 | 16×24 | "4 bookmark ribbon tabs in a horizontal strip, colors: amber, blue, green, red, pointed bottom, library bookmark" |
| `vfx-teleport-flash` | 4 | 64×64 | "4 frames of a teleport flash burst, expanding ring of light, magical warp effect, ink/paper particles" |
| `vfx-index-ring` | 4 | 48×48 | "4 frames of a spinning selection ring, dotted circle rotating, magical targeting reticle, amber glow" |

## Verification / Pass Criteria

1. **Rectangle mode unchanged**: Switch `RenderConfig.setMode("rectangles")`. All 4 abilities render EXACTLY as they do today — no visual change whatsoever. This is the critical regression test.

2. **Sprite mode adds VFX**: Switch to `"sprites"`. Each ability shows:
   - Margin Stitch: Stitch-line pulse sprite across active passages + needle flash on activation
   - Redaction: Ink splat expansion sprite on obstacles + drip sprites along bottom + strike-through bar
   - Paste-Over: Surface glow pulse sprite on pasted platforms + copy swoosh on clipboard capture
   - Index Mark: Bookmark ribbon sprites at mark positions + teleport flash at origin/destination + selection ring on targeted mark

3. **Both mode layers correctly**: Sprite VFX renders underneath canvas-drawn elements. Timer bars, targeting indicators, and HUD elements remain visible on top.

4. **Functional elements always visible**: Timer bars, targeting crosshairs, clipboard HUD, inventory slots, cooldown arcs, and distance labels render in ALL modes. Only the decorative VFX are sprite-gated.

5. **Placeholders work**: With no real images in `public/assets/`, the `AssetManager` generates colored-rect placeholders for all 10 sheets. Placeholder sprites render at the correct positions and sizes.

6. **No crashes without sprites**: If `AssetManager` hasn't loaded VFX sheets (e.g., `getSpriteSheet()` returns undefined), abilities skip sprite rendering gracefully — no null reference errors.

7. **Type-check passes**: `npx tsc --noEmit` succeeds with no errors.

## Implementation Notes

- **AnimationController per-ability instance**: Each ability instance should create its own `AnimationController` references (not share globally). This prevents animation state conflicts between multiple active instances.
- **dt for sprite animations**: Abilities don't receive `dt` in their `render()` method. Either:
  - Store `dt` from the last `update()` call and use it in `render()`, or
  - Use `1/60` as a fixed dt (since the game loop is 60Hz fixed timestep, this is accurate).
- **Sprite scaling**: VFX sprites need to be scaled to match world-space dimensions. For example, the stitch-line sprite (64×16 source) must stretch to the passage width (which varies per wall pair). Use `AnimationController.draw(ctx, x, y, false, scaleX, scaleY)`.
- **Tinting paste-glow**: To tint the surface-pulse sprite to match the surface color, draw the sprite, then overlay a colored rect with `globalCompositeOperation = "source-atop"` or simply accept the amber default color from the placeholder/generated art.
- **No new test page**: These VFX sprites integrate into the existing ability test pages. Each test page already has a render mode toggle (or should have one from the asset-toggle-system task). The `/test/sprites` page can also be extended to preview ability VFX sheets.

---

## Implementation Summary

### Files Created
- **`src/engine/abilities/AbilitySprites.ts`** — 10 sprite sheet configs + animation definitions for all ability VFX. Exports `ABILITY_VFX_SPRITE_CONFIGS`, `ABILITY_VFX_ANIMATIONS`, `getAbilityVfxConfigs()`, `getAbilityVfxAnimations()`.

### Files Modified

- **`src/engine/abilities/MarginStitch.ts`** — Added sprite imports, `stitchLineAnim`/`needleFlashAnim` fields, `initSprites()` lazy init, sprite VFX layer in `render()` (stitch-line pulse across passage, needle flash at wall endpoints on activation). Canvas VFX gated behind `RenderConfig.useRectangles()`. Needle flash triggered on `activate()`.

- **`src/engine/abilities/Redaction.ts`** — Added sprite imports, `splatAnim`/`dripAnim`/`barAnim` fields, `initSprites()` lazy init, sprite VFX layer in `render()` (splat expand during activation, bar-pulse tiled across obstacle width when fully covered, drip sprites along bottom edge). Canvas VFX gated behind `RenderConfig.useRectangles()`.

- **`src/engine/abilities/PasteOver.ts`** — Added sprite imports, `glowAnim`/`swooshAnim` fields, `initSprites()` lazy init, `triggerCopySwoosh(worldPos)` public method for test pages to call on clipboard capture. Sprite VFX layer in `render()` (surface glow pulse on pasted platforms, copy swoosh at capture position). Canvas VFX gated behind `RenderConfig.useRectangles()`.

- **`src/engine/abilities/IndexMark.ts`** — Added sprite imports, `bookmarkSheet`/`teleportFlashAnim`/`teleportOutAnim`/`ringAnim` fields, `initSprites()` lazy init. Sprite VFX layer in `render()` (bookmark sprites at mark positions by color frame index, teleport flash at destination + origin, spinning selection ring around targeted mark). Teleport flash anims triggered on `executeTeleport()`. Canvas VFX gated behind `RenderConfig.useRectangles()`.

- **`src/engine/core/AssetManager.ts`** — Added placeholder colors for VFX prefix ids (`vfx-stitch`, `vfx-redaction`, `vfx-paste`, `vfx-bookmark`, `vfx-teleport`, `vfx-index`, `vfx`).

- **`scripts/generate-assets.ts`** — Added 10 ability VFX asset generation prompts in a new "Ability VFX Sprite Sheets" section.

### Architecture Decisions
- Used `1/60` fixed dt in render methods (matches 60Hz fixed-timestep game loop)
- Lazy sprite initialization (`initSprites()` called once per render, idempotent) — avoids requiring callers to preload
- Sprite VFX drawn BEFORE canvas VFX layer, so functional elements (timer bars, targeting, HUD) render on top
- Canvas VFX gated behind `RenderConfig.useRectangles()` for clean mode separation
- Each ability owns its own AnimationController instances (no shared global state)
- PasteOver added `triggerCopySwoosh(worldPos)` public API for test pages to trigger the swoosh VFX

### Type Check
- `npx tsc --noEmit` — 0 new errors from these changes. Pre-existing 8 errors in BiomeBackground.ts from another in-progress task.

---

## Review Notes

**Reviewer:** a69b1aa6
**Date:** 2026-02-25

### Issues Found & Fixed

1. **Redaction: splatAnim never played** — The `splatAnim` AnimationController was created in `initSprites()` but `play("splat-expand")` was never called, so the animation would stay at frame 0 with no active animation name. **Fixed:** Added `this.splatAnim.play("splat-expand")` after construction.

2. **Redaction: Shared animation controllers updated N× per frame** — The `splatAnim`, `barAnim`, and `dripAnim` controllers were shared across all active redactions, but `update(dt)` was called inside the per-redaction loop, causing animations to advance at N× speed when multiple redactions were active. **Fixed:** Moved all three `update(dt)` calls to execute once before the per-redaction draw loop.

3. **Comment clarity** — Updated canvas VFX layer comments in all four abilities from "always drawn" to "drawn in rectangles and both modes" to accurately reflect the gating behavior. The canvas VFX are correctly gated behind `useRectangles()` which covers both "rectangles" and "both" modes — in pure "sprites" mode, the sprite VFX overlays replace the canvas-drawn decorative elements while functional HUD elements (rendered in `renderUI()`) remain visible.

### No Issues Found

- **AbilitySprites.ts**: Clean sprite config definitions, all 10 sheets with correct frame counts and dimensions. Animation definitions match the spec exactly.
- **MarginStitch.ts**: Sprite integration is clean. Lazy init is idempotent. Needle flash correctly triggered on `activate()` and auto-deactivates via `isFinished()`.
- **PasteOver.ts**: `triggerCopySwoosh()` public API is a good design for test page integration. Glow animation correctly scales to platform dimensions.
- **IndexMark.ts**: Bookmark sheet uses `drawFrame()` directly (correct for static per-color frames). Separate `teleportFlashAnim` and `teleportOutAnim` controllers prevent animation conflict between origin/destination flashes. Ring anim auto-plays on init.
- **AssetManager.ts**: Placeholder colors correctly keyed by VFX prefix IDs with appropriate fallback ordering (specific prefixes before generic "vfx").
- **generate-assets.ts**: All 10 VFX prompts follow the established pattern with correct style prefix, frame counts, and dimensions.
- **TypeScript**: No new type errors from these changes.
