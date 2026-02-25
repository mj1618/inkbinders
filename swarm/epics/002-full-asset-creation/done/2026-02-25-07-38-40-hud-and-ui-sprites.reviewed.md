# HUD & UI Sprites

## Goal

Replace canvas-drawn HUD icons, card art elements, and menu visuals with sprite-based rendering. When `RenderConfig.useSprites()` is true, HUD elements use polished sprite icons. When in rectangle mode, the existing canvas-drawn versions render unchanged. This task covers the sprite **definitions, integration, and generation prompts** — not the HUD layout or logic (which already works).

---

## Context

### What exists today

**GameHUD** (`src/engine/ui/GameHUD.ts`) renders entirely with canvas primitives:
- **Health bar**: Red rectangle fill (120×12px) at (16, 12), with damage flash (white 6f), low HP pulse (orange/red), border with rounded corners
- **Ability icons**: 4 slots (40×52px each) at bottom-left, with procedurally drawn 24px icons:
  - Stitch: two vertical lines + dashed horizontal bridges (cyan `#22d3ee`)
  - Redaction: black rect + red X (`#ef4444`)
  - Paste: stamp/paintbrush shape (orange `#f59e0b`)
  - Index: bookmark/pin shape (purple `#a78bfa`)
- **Weapon indicator**: Bottom-center (80×44px), canvas-drawn quill-spear (diagonal line) or ink-snap (6-ray starburst)
- **Day/night clock**: Top-right, canvas-drawn sun (filled circle + 8 rays, amber) or crescent moon (two overlapping circles, indigo)
- **Room name**: Bottom-right pill with text fade in/out
- **Notifications**: Stacked text with type-colored prefixes
- **Pause menu**: Centered overlay with text options

**CardRenderer** (`src/engine/cards/CardRenderer.ts`) draws cards (80×110px) with:
- Dark blue background (`#1a1a2e`) + category color gradient tint
- Category-colored border (2px)
- Unicode glyph centered at 52% height
- Tier dots (top-right)
- Name text (bottom)

**Title page** (`src/app/page.tsx`) renders:
- "INKBINDERS" as amber-200 monospace text (`text-4xl`, `tracking-[0.25em]`)
- Ink wash particle background (50 particles)

**DayNightRenderer** (`src/engine/world/DayNightRenderer.ts`) has a circular clock:
- 36px radius, centered at (canvasWidth - 60, 60)
- Canvas-drawn sun/moon icons, progress arc, phase labels

**No `HUDSprites.ts` exists yet.** The `src/engine/ui/` directory contains only `GameHUD.ts` and `index.ts`.

---

## Files to Create

### `src/engine/ui/HUDSprites.ts` (new)

Define sprite configs and animations for all HUD/UI sprite elements.

**Sprite sheets:**

| ID | Frames | Frame Size | Purpose |
|----|--------|-----------|---------|
| `hud-health-heart` | 3 | 16×16 | Full heart, half heart, empty heart |
| `hud-ability-stitch` | 1 | 32×32 | Margin Stitch ability icon |
| `hud-ability-redaction` | 1 | 32×32 | Redaction ability icon |
| `hud-ability-paste` | 1 | 32×32 | Paste-Over ability icon |
| `hud-ability-index` | 1 | 32×32 | Index Mark ability icon |
| `hud-weapon-spear` | 1 | 32×32 | Quill-spear weapon icon |
| `hud-weapon-snap` | 1 | 32×32 | Ink-snap weapon icon |
| `hud-sun` | 1 | 16×16 | Sun icon for day/dawn |
| `hud-moon` | 1 | 16×16 | Moon icon for night/dusk |
| `card-category-swiftness` | 1 | 24×24 | Card category icon |
| `card-category-might` | 1 | 24×24 | Card category icon |
| `card-category-resilience` | 1 | 24×24 | Card category icon |
| `card-category-precision` | 1 | 24×24 | Card category icon |
| `card-category-arcana` | 1 | 24×24 | Card category icon |
| `card-frame-tier1` | 1 | 80×110 | Ornate card border — tier 1 |
| `card-frame-tier2` | 1 | 80×110 | Ornate card border — tier 2 |
| `card-frame-tier3` | 1 | 80×110 | Ornate card border — tier 3 |
| `ui-title-logo` | 1 | 480×120 | "INKBINDERS" hand-lettered logo |
| `ui-menu-button` | 1 | 200×40 | Ink-wash button background shape |

**Config structure:**

```typescript
import { SpriteSheetConfig, AnimationDef } from '../core/SpriteSheet';

export const HUD_SPRITE_CONFIGS: SpriteSheetConfig[] = [
  // Health hearts
  {
    id: "hud-health-heart",
    src: "/assets/hud-health-heart.png",
    frameWidth: 16,
    frameHeight: 16,
    columns: 3,
    totalFrames: 3, // frame 0=full, 1=half, 2=empty
  },

  // Ability icons (single-frame each)
  {
    id: "hud-ability-stitch",
    src: "/assets/hud-ability-stitch.png",
    frameWidth: 32,
    frameHeight: 32,
    columns: 1,
    totalFrames: 1,
  },
  {
    id: "hud-ability-redaction",
    src: "/assets/hud-ability-redaction.png",
    frameWidth: 32,
    frameHeight: 32,
    columns: 1,
    totalFrames: 1,
  },
  {
    id: "hud-ability-paste",
    src: "/assets/hud-ability-paste.png",
    frameWidth: 32,
    frameHeight: 32,
    columns: 1,
    totalFrames: 1,
  },
  {
    id: "hud-ability-index",
    src: "/assets/hud-ability-index.png",
    frameWidth: 32,
    frameHeight: 32,
    columns: 1,
    totalFrames: 1,
  },

  // Weapon icons
  {
    id: "hud-weapon-spear",
    src: "/assets/hud-weapon-spear.png",
    frameWidth: 32,
    frameHeight: 32,
    columns: 1,
    totalFrames: 1,
  },
  {
    id: "hud-weapon-snap",
    src: "/assets/hud-weapon-snap.png",
    frameWidth: 32,
    frameHeight: 32,
    columns: 1,
    totalFrames: 1,
  },

  // Sun/moon icons
  {
    id: "hud-sun",
    src: "/assets/hud-sun.png",
    frameWidth: 16,
    frameHeight: 16,
    columns: 1,
    totalFrames: 1,
  },
  {
    id: "hud-moon",
    src: "/assets/hud-moon.png",
    frameWidth: 16,
    frameHeight: 16,
    columns: 1,
    totalFrames: 1,
  },

  // Card category icons
  {
    id: "card-category-swiftness",
    src: "/assets/card-category-swiftness.png",
    frameWidth: 24,
    frameHeight: 24,
    columns: 1,
    totalFrames: 1,
  },
  {
    id: "card-category-might",
    src: "/assets/card-category-might.png",
    frameWidth: 24,
    frameHeight: 24,
    columns: 1,
    totalFrames: 1,
  },
  {
    id: "card-category-resilience",
    src: "/assets/card-category-resilience.png",
    frameWidth: 24,
    frameHeight: 24,
    columns: 1,
    totalFrames: 1,
  },
  {
    id: "card-category-precision",
    src: "/assets/card-category-precision.png",
    frameWidth: 24,
    frameHeight: 24,
    columns: 1,
    totalFrames: 1,
  },
  {
    id: "card-category-arcana",
    src: "/assets/card-category-arcana.png",
    frameWidth: 24,
    frameHeight: 24,
    columns: 1,
    totalFrames: 1,
  },

  // Card frame borders (one per tier)
  {
    id: "card-frame-tier1",
    src: "/assets/card-frame-tier1.png",
    frameWidth: 80,
    frameHeight: 110,
    columns: 1,
    totalFrames: 1,
  },
  {
    id: "card-frame-tier2",
    src: "/assets/card-frame-tier2.png",
    frameWidth: 80,
    frameHeight: 110,
    columns: 1,
    totalFrames: 1,
  },
  {
    id: "card-frame-tier3",
    src: "/assets/card-frame-tier3.png",
    frameWidth: 80,
    frameHeight: 110,
    columns: 1,
    totalFrames: 1,
  },

  // Title logo
  {
    id: "ui-title-logo",
    src: "/assets/ui-title-logo.png",
    frameWidth: 480,
    frameHeight: 120,
    columns: 1,
    totalFrames: 1,
  },

  // Menu button background
  {
    id: "ui-menu-button",
    src: "/assets/ui-menu-button.png",
    frameWidth: 200,
    frameHeight: 40,
    columns: 1,
    totalFrames: 1,
  },
];
```

**Helper constants:**

```typescript
// Heart frame indices
export const HEART_FULL = 0;
export const HEART_HALF = 1;
export const HEART_EMPTY = 2;

// Ability-to-sprite-ID mapping
export const ABILITY_ICON_MAP: Record<string, string> = {
  "margin-stitch": "hud-ability-stitch",
  "redaction": "hud-ability-redaction",
  "paste-over": "hud-ability-paste",
  "index-mark": "hud-ability-index",
};

// Weapon-to-sprite-ID mapping
export const WEAPON_ICON_MAP: Record<string, string> = {
  "quill-spear": "hud-weapon-spear",
  "ink-snap": "hud-weapon-snap",
};

// Category-to-sprite-ID mapping
export const CARD_CATEGORY_ICON_MAP: Record<string, string> = {
  "swiftness": "card-category-swiftness",
  "might": "card-category-might",
  "resilience": "card-category-resilience",
  "precision": "card-category-precision",
  "arcana": "card-category-arcana",
};

// Tier-to-frame-sprite-ID mapping
export const CARD_FRAME_MAP: Record<number, string> = {
  1: "card-frame-tier1",
  2: "card-frame-tier2",
  3: "card-frame-tier3",
};
```

---

## Files to Modify

### `src/engine/ui/GameHUD.ts`

Load HUD sprites in constructor or via an `initSprites()` method. Then modify each rendering method to check `RenderConfig.useSprites()`.

**Health bar → Heart icons:**

When `RenderConfig.useSprites()`:
- Replace the single red rectangle bar with a row of heart icons
- For `maxHp = 5`: render 5 heart slots at (16, 12) with 2px spacing
- Each heart is 16×16, using frame index:
  - Full heart: frame 0 (for HP points that are fully filled)
  - Half heart: frame 1 (if HP system supports half-hearts; otherwise skip)
  - Empty heart: frame 2 (for HP points that are depleted)
- Damage flash: briefly render all hearts as white-tinted (use `ctx.globalCompositeOperation` or draw white overlay)
- Low HP pulse: scale hearts slightly on pulse beat

When `RenderConfig.useRectangles()`: keep current bar rendering.

**Ability icons → Sprite icons:**

When `RenderConfig.useSprites()`:
- In `renderAbilityBar()`, instead of the procedural canvas-drawn icons, use:
  ```typescript
  const sheet = AssetManager.getInstance().getSpriteSheet(ABILITY_ICON_MAP[abilityId]);
  if (sheet) sheet.drawFrame(ctx, 0, iconX, iconY);
  ```
- The slot background, border, keybind label, cooldown overlay, and active dots remain canvas-drawn (they're UI chrome, not art)
- Only the 24×24 icon drawing in the center of each slot changes

When `RenderConfig.useRectangles()`: keep current procedural icons.

**Weapon indicator → Sprite icons:**

When `RenderConfig.useSprites()`:
- Replace the canvas-drawn quill-spear line / ink-snap starburst with:
  ```typescript
  const sheet = AssetManager.getInstance().getSpriteSheet(WEAPON_ICON_MAP[weaponType]);
  if (sheet) sheet.drawFrame(ctx, 0, iconX, iconY);
  ```
- Weapon name text and slot background remain canvas-drawn

When `RenderConfig.useRectangles()`: keep current rendering.

**Sun/moon icons → Sprite icons:**

When `RenderConfig.useSprites()`:
- In the clock rendering section, replace the canvas-drawn sun circle+rays and moon crescent with:
  ```typescript
  const iconId = (timeOfDay === "day" || timeOfDay === "dawn") ? "hud-sun" : "hud-moon";
  const sheet = AssetManager.getInstance().getSpriteSheet(iconId);
  if (sheet) sheet.drawFrame(ctx, 0, iconX, iconY);
  ```
- Clock background circle, progress arc, and text remain canvas-drawn

When `RenderConfig.useRectangles()`: keep current rendering.

### `src/engine/cards/CardRenderer.ts`

**Card frame borders:**

When `RenderConfig.useSprites()`:
- Instead of drawing the colored rectangle border around each card, draw the tier-appropriate card frame sprite:
  ```typescript
  const frameSheet = AssetManager.getInstance().getSpriteSheet(CARD_FRAME_MAP[card.tier]);
  if (frameSheet) frameSheet.drawFrame(ctx, 0, cardX, cardY);
  ```
- The frame sprite is 80×110 (same as card size) and includes ornate border art
- Card content (glyph, name, tier dots) renders on top of the frame sprite

**Category icons:**

When `RenderConfig.useSprites()`:
- Replace the unicode glyph in the center of cards with the category icon sprite:
  ```typescript
  const catSheet = AssetManager.getInstance().getSpriteSheet(CARD_CATEGORY_ICON_MAP[card.category]);
  if (catSheet) catSheet.drawFrame(ctx, 0, glyphX, glyphY);
  ```
- The 24×24 icon is centered at the same position as the current glyph

When `RenderConfig.useRectangles()`: keep current canvas-drawn cards.

### `src/app/page.tsx`

**Title logo:**

When `RenderConfig.useSprites()` (check at render time):
- Load the `ui-title-logo` sprite sheet
- Replace the text "INKBINDERS" with the 480×120 logo sprite centered on the page
- The subtitle "The Library That Fights Back" stays as text below the logo

When sprites are not available or `useRectangles()`: keep current text rendering.

**Note**: Since the title page is React (not canvas), the sprite rendering works differently here. Instead of `SpriteSheet.drawFrame()`, load the image directly as an `<img>` element using the src path (`/assets/ui-title-logo.png`). If the image fails to load (doesn't exist yet), fall back to the text title. Use an `onError` handler or check `AssetManager.isRealAsset()`.

**Menu button backgrounds:**

When sprite assets exist:
- Behind each menu option text, render the `ui-menu-button` sprite (200×40) as a decorative background
- The text still renders on top

When assets don't exist: keep current text-only menu items.

### `scripts/generate-assets.ts`

Add all HUD/UI sprites in a `"hud-ui"` category. Group prompts logically:

```typescript
// HUD Icons
{
  id: "hud-health-heart",
  filename: "hud-health-heart.png",
  prompt: `${STYLE_PREFIX}, 3-frame horizontal sprite strip, pixel-art heart icons for health HUD, frame 1: full red heart with ink outline, frame 2: half heart (left half filled), frame 3: empty heart outline only, 16x16 pixels per frame, transparent background, 48x16 total image`,
},
{
  id: "hud-ability-stitch",
  filename: "hud-ability-stitch.png",
  prompt: `${STYLE_PREFIX}, single icon, margin stitch ability, two parallel pages with glowing cyan thread stitching between them, 32x32 pixels, transparent background, cyan and white color palette`,
},
{
  id: "hud-ability-redaction",
  filename: "hud-ability-redaction.png",
  prompt: `${STYLE_PREFIX}, single icon, redaction ability, black ink rectangle with red strike-through X mark, dripping ink edges, 32x32 pixels, transparent background, black and red color palette`,
},
{
  id: "hud-ability-paste",
  filename: "hud-ability-paste.png",
  prompt: `${STYLE_PREFIX}, single icon, paste-over ability, glowing stamp or paintbrush pressing onto a surface, amber/orange glow, 32x32 pixels, transparent background, amber and gold color palette`,
},
{
  id: "hud-ability-index",
  filename: "hud-ability-index.png",
  prompt: `${STYLE_PREFIX}, single icon, index mark ability, ornate bookmark ribbon with purple glow, pin/waypoint marker shape, 32x32 pixels, transparent background, purple and lavender color palette`,
},
{
  id: "hud-weapon-spear",
  filename: "hud-weapon-spear.png",
  prompt: `${STYLE_PREFIX}, single icon, quill spear weapon, elegant writing quill with sharp pointed nib angled diagonally, blue ink glow, 32x32 pixels, transparent background, blue color palette`,
},
{
  id: "hud-weapon-snap",
  filename: "hud-weapon-snap.png",
  prompt: `${STYLE_PREFIX}, single icon, ink snap weapon, starburst explosion of dark ink droplets radiating outward, 6 rays, indigo glow, 32x32 pixels, transparent background, indigo color palette`,
},
{
  id: "hud-sun",
  filename: "hud-sun.png",
  prompt: `${STYLE_PREFIX}, single icon, sun for daytime, warm glowing sun with 8 short rays, amber/gold watercolor, 16x16 pixels, transparent background`,
},
{
  id: "hud-moon",
  filename: "hud-moon.png",
  prompt: `${STYLE_PREFIX}, single icon, crescent moon for nighttime, elegant thin crescent with soft indigo glow, 16x16 pixels, transparent background`,
},

// Card Category Icons
{
  id: "card-category-swiftness",
  filename: "card-category-swiftness.png",
  prompt: `${STYLE_PREFIX}, single icon, swiftness card category, flowing wind trail or speed lines, cyan/teal color, 24x24 pixels, transparent background`,
},
{
  id: "card-category-might",
  filename: "card-category-might.png",
  prompt: `${STYLE_PREFIX}, single icon, might card category, clenched fist or rising flame, amber/gold color, 24x24 pixels, transparent background`,
},
{
  id: "card-category-resilience",
  filename: "card-category-resilience.png",
  prompt: `${STYLE_PREFIX}, single icon, resilience card category, shield or oak leaf, green color, 24x24 pixels, transparent background`,
},
{
  id: "card-category-precision",
  filename: "card-category-precision.png",
  prompt: `${STYLE_PREFIX}, single icon, precision card category, crosshair target or magnifying glass, purple/lavender color, 24x24 pixels, transparent background`,
},
{
  id: "card-category-arcana",
  filename: "card-category-arcana.png",
  prompt: `${STYLE_PREFIX}, single icon, arcana card category, mystic rune circle or glowing glyph, indigo/blue-violet color, 24x24 pixels, transparent background`,
},

// Card Frames
{
  id: "card-frame-tier1",
  filename: "card-frame-tier1.png",
  prompt: `${STYLE_PREFIX}, ornate card border frame tier 1, simple clean ink border with subtle corner flourishes, parchment texture interior, 80x110 pixels, transparent outside border`,
},
{
  id: "card-frame-tier2",
  filename: "card-frame-tier2.png",
  prompt: `${STYLE_PREFIX}, ornate card border frame tier 2, elegant ink border with vine-like decorative corners and side accents, golden line accent, parchment texture interior, 80x110 pixels, transparent outside border`,
},
{
  id: "card-frame-tier3",
  filename: "card-frame-tier3.png",
  prompt: `${STYLE_PREFIX}, ornate card border frame tier 3, elaborate illuminated manuscript border with detailed floral corner ornaments and gold leaf accents, glowing edges, parchment interior, 80x110 pixels, transparent outside border`,
},

// Title & Menu
{
  id: "ui-title-logo",
  filename: "ui-title-logo.png",
  prompt: `${STYLE_PREFIX}, game logo text "INKBINDERS", hand-lettered calligraphy with ink drips and quill flourishes, amber/gold on dark background, ornate but readable, 480x120 pixels`,
},
{
  id: "ui-menu-button",
  filename: "ui-menu-button.png",
  prompt: `${STYLE_PREFIX}, horizontal UI button background, ink-wash rectangle with torn paper edges and subtle watercolor gradient, dark parchment center, 200x40 pixels, transparent background`,
},
```

---

## Integration Details

### Loading sprites

In `GameHUD` constructor or `initSprites()`:
```typescript
import { HUD_SPRITE_CONFIGS } from './HUDSprites';
const assetManager = AssetManager.getInstance();
assetManager.loadAll(HUD_SPRITE_CONFIGS);
```

No animations needed — all HUD sprites are single-frame static icons (except the health heart which has 3 static frames selected by index, not animation).

### Health rendering with hearts

The current health system uses integer HP (e.g., 5/5). Convert to hearts:
- Each heart = 1 HP
- For `hp = 3, maxHp = 5`: render 3 full hearts + 2 empty hearts
- Heart row position: same as current HP bar (16, 12)
- Heart spacing: 18px (16px icon + 2px gap)
- Total width for 5 hearts: 5×18 - 2 = 88px (fits in similar space to the 120px bar)

### Card frame rendering order

For cards with sprite frames:
1. Draw card frame sprite (80×110) as the background
2. Draw category icon sprite (24×24) centered at 52% height
3. Draw text elements (name, tier dots) on top
4. Cooldown/selection overlays on top of everything

### Title page image fallback

Since the title page is React, not engine canvas:
```tsx
const [logoLoaded, setLogoLoaded] = useState(false);

// In render:
{logoLoaded ? (
  <img src="/assets/ui-title-logo.png" alt="INKBINDERS" width={480} height={120}
       onError={() => setLogoLoaded(false)} />
) : (
  <h1 className="text-4xl font-bold text-amber-200 tracking-[0.25em]">INKBINDERS</h1>
)}
```

Use an `onLoad` callback to set `logoLoaded = true` only after the image successfully loads.

---

## Verification / Pass Criteria

1. **Rectangle mode unchanged**: Switching to "rectangles" produces identical HUD visuals to the current implementation — canvas-drawn health bar, procedural ability icons, text title
2. **Sprite mode — health hearts**: Health displays as a row of heart icons (full/empty) instead of a rectangle bar
3. **Sprite mode — ability icons**: Each ability slot shows its sprite icon instead of the procedural canvas drawing
4. **Sprite mode — weapon icons**: Weapon indicator shows sprite icon instead of canvas-drawn quill/starburst
5. **Sprite mode — sun/moon**: Clock shows sprite sun/moon instead of canvas-drawn circle+rays/crescent
6. **Sprite mode — card frames**: Cards render with ornate frame sprites (tier-specific) instead of simple colored borders
7. **Sprite mode — card category icons**: Card glyphs are replaced with category icon sprites
8. **Sprite mode — title logo**: Landing page shows "INKBINDERS" logo sprite instead of text
9. **Placeholder rendering works**: With no real assets, all HUD sprites render as colored rectangles with frame numbers (AssetManager placeholder)
10. **Graceful fallback**: If any individual sprite fails to load, the canvas-drawn version is used for that element (no blank spots)
11. **Both mode**: In "both" mode, sprite icons render with semi-transparent canvas versions overlaid
12. **HUD toggle still works**: All debug panel toggles (show/hide health, abilities, weapon, clock) continue to work in sprite mode
13. **Cooldown overlay preserved**: Ability cooldown sweep animation works correctly on top of sprite icons
14. **Damage flash preserved**: Health heart damage flash (white tint) and low HP pulse work in sprite mode
15. **No layout shift**: Heart icons and sprite icons occupy approximately the same space as their canvas-drawn counterparts — no HUD elements overlapping or misaligned

---

## Asset style notes

Use the established style lock prefix for all prompts:
```
"hand-inked 2D game art, clean linework, watercolor wash fill, paper grain texture, high readability, metroidvania sprite, cohesive style, no text"
```

**HUD icons** should be chunky and highly readable at small sizes (16–32px). Thick outlines, minimal detail, strong silhouettes. Think: Hollow Knight's HUD icon clarity.

**Card frames** should feel like illuminated manuscript borders — more ornate at higher tiers. Tier 1 is simple and clean, tier 3 is elaborate with gold leaf accents.

**Title logo** should be hand-lettered calligraphy that feels like it was written with a quill — ink drips, slight flourishes, but still clearly readable as "INKBINDERS".

**Color palette for icons** matches existing HUD colors:
- Stitch: cyan `#22d3ee`
- Redaction: red `#ef4444`
- Paste-Over: amber `#f59e0b`
- Index Mark: purple `#a78bfa`
- Quill-spear: blue `#60a5fa`
- Ink-snap: indigo `#818cf8`
- Sun: amber `#fbbf24`
- Moon: indigo `#818cf8`
- Hearts: red `#ef4444`

---

## Implementation Summary

### Files Created
- **`src/engine/ui/HUDSprites.ts`** — 20 sprite sheet configs for all HUD/UI elements (health hearts, ability icons, weapon icons, sun/moon, card category icons, card frames, title logo, menu button). Includes helper constants (`HEART_FULL`, `HEART_EMPTY`), lookup maps (`ABILITY_ICON_MAP`, `WEAPON_ICON_MAP`, `CARD_CATEGORY_ICON_MAP`, `CARD_FRAME_MAP`), and `getHUDSpriteConfigs()` accessor.

### Files Modified
- **`src/engine/ui/GameHUD.ts`** — Added `RenderConfig`-aware rendering for all HUD elements:
  - Health bar: sprite mode renders a row of heart icons (full/empty) with damage flash (white overlay) and low HP pulse (scale animation). Rectangle mode unchanged.
  - Ability icons: sprite mode draws 32×32 sprite icons centered in slots. Rectangle mode keeps procedural canvas drawing.
  - Weapon indicator: sprite mode draws weapon sprite icon. Rectangle mode keeps quill-line/starburst drawing.
  - Clock sun/moon: sprite mode draws 16×16 sun/moon icons. Rectangle mode keeps circle+rays/crescent.
  - All sprites loaded via `AssetManager.loadAll()` in constructor.

- **`src/engine/cards/CardRenderer.ts`** — Added `RenderConfig`-aware rendering for cards:
  - Card frames: sprite mode draws tier-specific ornate frame sprites (80×110, scaled to card size). Falls back to rectangle mode if sprite unavailable.
  - Category icons: sprite mode draws 24×24 category icon sprites centered on cards. Falls back to unicode glyph in rectangle mode.

- **`src/app/page.tsx`** — Added sprite-aware title and menu components:
  - `TitleLogo` component: probes for `/assets/ui-title-logo.png` and shows it if available, otherwise falls back to text `<h1>`.
  - `MenuButton` component: probes for `/assets/ui-menu-button.png` and renders it behind button text when available.

- **`src/engine/ui/index.ts`** — Added exports for all `HUDSprites` symbols.

- **`src/engine/core/AssetManager.ts`** — Added placeholder colors for `hud:`, `card:`, and `ui:` prefixed asset IDs.

- **`scripts/generate-assets.ts`** — Added 20 HUD/UI asset generation prompts covering health hearts, ability icons, weapon icons, sun/moon, card category icons, card frames (3 tiers), title logo, and menu button background.

### TypeScript
- `npx tsc --noEmit` passes with zero errors.

---

## Review Notes

Reviewed by agent e058bbf4 on 2026-02-25.

### Issues Found & Fixed

1. **"Both" mode opacity missing (GameHUD.ts)** — In "both" render mode, rectangle-drawn HUD elements (health bar, ability icons, weapon icon, clock sun/moon) were drawn at full opacity on top of sprite versions, obscuring them. The established project pattern (see `Player.ts`, `TileMap.ts`) is to draw rectangles at 0.4 alpha in "both" mode. Fixed all four HUD element renderers to apply `ctx.globalAlpha = 0.4` (or `*= 0.4` when compounded with cooldown alpha) when both sprites and rectangles are rendering.

2. **"Both" mode opacity missing (CardRenderer.ts)** — Same issue for card frame borders and category icons. Fixed to apply 0.4 alpha for rectangle-mode rendering when a sprite frame was also drawn. Properly handles the `dimmed` flag interaction.

3. **Damage flash `source-atop` composite op (GameHUD.ts)** — The heart damage flash used `ctx.globalCompositeOperation = "source-atop"` to draw a white overlay. On a fully opaque canvas (which the game canvas is after world rendering), `source-atop` draws everywhere within the rect bounds rather than only on the heart pixels. Simplified to a direct `fillRect` white overlay, which at 16×16 for 6 frames produces an acceptable brief flash effect.

### What Looked Good

- HUDSprites.ts: Clean config definitions, correct types, useful lookup maps
- Sprite/rectangle mode branching is consistent and has proper fallbacks
- AssetManager placeholder colors cover all new prefixes
- Title page uses graceful image probe + fallback pattern
- Menu button handles load/error states correctly
- generate-assets.ts prompts are well-structured and match the sprite configs
- No frame-rate dependent issues (uses fixed-timestep frameCount)
- All TypeScript types are sound — `npx tsc --noEmit` passes
