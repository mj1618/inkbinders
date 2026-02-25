# Task: Deep Parallax Backgrounds

**Epic:** 013 — Scribe Hall Visual Showcase
**Task slug:** `deep-parallax-backgrounds`
**Type:** Asset generation + minor code (prompt definitions only)

---

## Goal

Generate 6 high-quality layered background images for the Scribe Hall that create convincing depth when scrolled at different parallax speeds. This replaces the current 3-layer setup with a richer 6-layer architecture including 2 foreground layers that will eventually render over the player.

This task is **asset generation only** — it adds prompts to `generate-assets.ts` and runs the generator. The wiring into `BiomeBackground.ts` happens in the later `parallax-integration` task.

---

## Layer Architecture (back to front)

```
Layer 0 (parallax 0.02) — Sky/ambiance:    very distant, nearly fixed
Layer 1 (parallax 0.08) — Far architecture: distant bookshelves, arched windows
Layer 2 (parallax 0.20) — Mid architecture: reading desks, candelabras, pillars
Layer 3 (parallax 0.40) — Near architecture: close bookshelves, inkwells, book stacks
──── PLAYER LAYER (parallax 1.0) ────
Layer 4 (parallax 1.15) — Near foreground:  hanging scrolls, candle sconces
Layer 5 (parallax 1.40) — Far foreground:   drifting dust, cobweb wisps
```

**Critical design principle:** Foreground layers (4, 5) must have transparent backgrounds and sparse composition so they don't obscure gameplay when rendered over the player at reduced opacity.

---

## What to Do

### Step 1: Add 6 New Asset Prompts

**File to modify:** `scripts/generate-assets.ts`

Add 6 new entries to the `ASSET_PROMPTS` array. Place them near the existing Scribe Hall background prompts (currently around lines 695-715).

The existing `BG_STYLE_PREFIX` is:
```
"hand-inked 2D game background art, clean linework, watercolor wash fill, paper grain texture, parallax layer, seamless horizontal tiling, no characters, no text, atmospheric depth,"
```

**New prompts to add:**

```typescript
// ---- Scribe Hall 6-Layer Deep Parallax ----

{
  id: "bg-scribe-hall-sky",
  filename: "backgrounds/bg-scribe-hall-sky.png",
  prompt: `${BG_STYLE_PREFIX} warm amber gradient background for a grand old library, barely visible arched cathedral windows glowing with golden afternoon light, paper grain texture, extremely subtle, mostly warm dark gradient from deep brown at bottom to warm amber at top, 960x540`,
  aspectRatio: "16:9",
  category: "backgrounds",
},
{
  id: "bg-scribe-hall-far-deep",
  filename: "backgrounds/bg-scribe-hall-far-deep.png",
  prompt: `${BG_STYLE_PREFIX} distant silhouettes of towering library bookshelves 3-4 stories tall in a grand hall, dark brown and amber tones, faint golden glow between shelves from hidden candles, vaulted stone ceiling barely visible at top, very dark atmospheric, warm library depth, 960x540`,
  aspectRatio: "16:9",
  category: "backgrounds",
},
{
  id: "bg-scribe-hall-mid-detail",
  filename: "backgrounds/bg-scribe-hall-mid-detail.png",
  prompt: `${BG_STYLE_PREFIX} mid-distance library scene with wooden reading desks and open leather-bound books, brass candelabras with warm yellow-orange flame glow, stone pillars with carved decorative book motifs, wooden ladder leaning against shelf, ink bottles and quill stands, warm brown and amber watercolor, 960x540`,
  aspectRatio: "16:9",
  category: "backgrounds",
},
{
  id: "bg-scribe-hall-near-detail",
  filename: "backgrounds/bg-scribe-hall-near-detail.png",
  prompt: `${BG_STYLE_PREFIX} close-up library scene with bookshelf showing individually colored book spines in warm reds greens and blues, brass reading lamp casting warm light pool on wooden shelf, glass ink bottles, rolled parchment scrolls tied with ribbon, antique globe, detailed warm watercolor, 960x540`,
  aspectRatio: "16:9",
  category: "backgrounds",
},
{
  id: "bg-scribe-hall-fg-near",
  filename: "backgrounds/bg-scribe-hall-fg-near.png",
  prompt: `${BG_STYLE_PREFIX} foreground library elements on transparent background, sparse composition with 30 percent coverage, hanging scroll ends from chains above, wall-mounted brass candle sconces with warm glow halos, partial bookshelf edge entering from right side, thin lantern chains, warm amber tones, transparent background PNG, 960x540`,
  aspectRatio: "16:9",
  category: "backgrounds",
},
{
  id: "bg-scribe-hall-fg-far",
  filename: "backgrounds/bg-scribe-hall-fg-far.png",
  prompt: `${BG_STYLE_PREFIX} very sparse foreground dust and atmosphere on transparent background, less than 15 percent coverage, a few clusters of floating golden dust motes, faint cobweb threads in upper corners, single thin chain with tiny lantern, one candle smoke wisp, extremely subtle, transparent background PNG, 960x540`,
  aspectRatio: "16:9",
  category: "backgrounds",
},
```

**Placement:** Add these right after the existing 3 Scribe Hall background prompts. Do NOT remove the existing 3 prompts — they stay as fallbacks and can be used by other code that still references them.

### Step 2: Verify Prompts with Dry Run

Run:
```bash
npx tsx scripts/generate-assets.ts --category backgrounds --dry-run
```

Verify all 6 new asset IDs appear in the output:
- `bg-scribe-hall-sky`
- `bg-scribe-hall-far-deep`
- `bg-scribe-hall-mid-detail`
- `bg-scribe-hall-near-detail`
- `bg-scribe-hall-fg-near`
- `bg-scribe-hall-fg-far`

### Step 3: Generate the Images

Run:
```bash
npx tsx scripts/generate-assets.ts --category backgrounds --filter scribe-hall
```

If the `--filter` flag doesn't exist, run all backgrounds (the pipeline skips already-existing files):
```bash
npx tsx scripts/generate-assets.ts --category backgrounds
```

If some images need regeneration (e.g., foreground layers came out opaque instead of transparent), use the `--force` flag with specific IDs:
```bash
npx tsx scripts/generate-assets.ts --id bg-scribe-hall-fg-near --force
npx tsx scripts/generate-assets.ts --id bg-scribe-hall-fg-far --force
```

### Step 4: Validate Output

Check that all 6 images were generated:
```bash
ls -la public/assets/backgrounds/bg-scribe-hall-*.png
```

Expected files:
```
bg-scribe-hall-sky.png
bg-scribe-hall-far-deep.png
bg-scribe-hall-mid-detail.png
bg-scribe-hall-near-detail.png
bg-scribe-hall-fg-near.png
bg-scribe-hall-fg-far.png
```

Plus the existing 3:
```
bg-scribe-hall-far.png
bg-scribe-hall-mid.png
bg-scribe-hall-near.png
```

### Step 5: TypeScript Compilation

Run `npx tsc --noEmit` to ensure the prompt additions compile cleanly.

---

## Color Palette Reference

All Scribe Hall layers should share this warm palette:
- Warm parchment: `#f5f0e6`
- Aged wood dark: `#3d2e22`
- Aged wood mid: `#6b4423`
- Amber glow: `#fbbf24`
- Candlelight: `#f59e0b`
- Deep shadow: `#1a1512`
- Deepest shadow: `#0f0a05`

---

## Layer-Specific Art Direction

### Layer 0 — Sky (`bg-scribe-hall-sky`)
- **Nearly a solid gradient** — so subtle it's almost invisible
- Deep brown at bottom → warm amber at top
- Faint arched cathedral window shapes barely visible in the glow
- This layer provides the base warmth that everything else sits on
- Should tile seamlessly (it's mostly a gradient, so tiling is trivial)

### Layer 1 — Far Deep (`bg-scribe-hall-far-deep`)
- **Dark silhouettes** — bookshelves are shapes, not detailed
- 3-4 stories tall, towering over the scene
- Faint golden glow between shelves from unseen candles
- Vaulted stone ceiling at the very top edge
- Very dark overall — this is atmosphere, not information

### Layer 2 — Mid Detail (`bg-scribe-hall-mid-detail`)
- **Readable objects** — desks, candelabras, pillars are recognizable
- Brass candelabras with warm flame glow (key visual anchor)
- Stone pillars with carved book motifs divide the scene
- Wooden ladders leaning against shelves add life
- More color variety than Layer 1, but still warm tones

### Layer 3 — Near Detail (`bg-scribe-hall-near-detail`)
- **Individually visible objects** — you can almost read the book spines
- Colorful book spines (warm reds, greens, blues — not neon)
- Brass reading lamps cast warm pools of light
- Glass ink bottles, rolled parchment scrolls, an antique globe
- Most detailed of the background layers

### Layer 4 — Foreground Near (`bg-scribe-hall-fg-near`)
- **TRANSPARENT BACKGROUND** — PNG with alpha channel
- Sparse: ~30% of the image has content, 70% is empty
- Hanging scroll ends dangling from chains above
- Wall-mounted brass candle sconces with warm glow halos
- Partial bookshelf edge entering from one side
- Elements positioned mainly at top and sides (less obstruction)

### Layer 5 — Foreground Far (`bg-scribe-hall-fg-far`)
- **TRANSPARENT BACKGROUND** — PNG with alpha channel
- Very sparse: <15% of the image has content
- Floating golden dust mote clusters (organic groupings, not grid)
- Faint cobweb threads in upper corners
- A single thin chain with a tiny lantern
- One candle smoke wisp
- This layer should be barely noticeable — pure atmosphere

---

## Foreground Layer Notes

The foreground layers (4, 5) are the trickiest to generate correctly:

1. **Transparent backgrounds are hard for image generators.** The prompt explicitly requests "transparent background PNG" but the generator may produce an opaque image anyway. If this happens:
   - Regenerate with `--force`, possibly adding "alpha channel, no background, isolated elements only" to the prompt
   - As a last resort, the image can be post-processed (but prefer getting it right from generation)

2. **Sparse composition is critical.** If the generator fills the entire frame with content, the foreground will obscure gameplay. The prompts specify exact coverage percentages (30% and 15%).

3. **Element positioning matters.** Foreground elements should cluster at edges and top of the image, leaving the center-bottom area relatively clear (that's where the player typically is).

---

## Pass Criteria

- [ ] All 6 new asset prompts added to `ASSET_PROMPTS` in `generate-assets.ts`
- [ ] Running `npx tsx scripts/generate-assets.ts --category backgrounds --dry-run` lists all 6 new assets
- [ ] All 6 images generated to `public/assets/backgrounds/`
- [ ] Background layers (0-3) are opaque images with warm amber/brown palette
- [ ] Background layers tile reasonably when placed side-by-side (seamless horizontal)
- [ ] Foreground layers (4-5) have transparent backgrounds with sparse elements
- [ ] Layer 0 (sky) is very subtle — almost a solid warm gradient
- [ ] Layer 3 (near detail) has clearly visible individual books and objects
- [ ] Layers get progressively more detailed from back to front (0 → 3)
- [ ] Foreground elements are positioned mainly at edges/top, not center
- [ ] Existing 3 Scribe Hall background files are NOT deleted or overwritten
- [ ] `npx tsc --noEmit` passes
- [ ] No changes to any file other than `scripts/generate-assets.ts`

---

## Files Modified

| File | Change |
|------|--------|
| `scripts/generate-assets.ts` | Add 6 new `AssetPrompt` entries to `ASSET_PROMPTS` array |

## Files Created (by the generator)

| File | Description |
|------|-------------|
| `public/assets/backgrounds/bg-scribe-hall-sky.png` | Layer 0: warm ambient sky gradient |
| `public/assets/backgrounds/bg-scribe-hall-far-deep.png` | Layer 1: distant towering bookshelves |
| `public/assets/backgrounds/bg-scribe-hall-mid-detail.png` | Layer 2: reading desks, candelabras, pillars |
| `public/assets/backgrounds/bg-scribe-hall-near-detail.png` | Layer 3: close bookshelves, ink bottles, lamps |
| `public/assets/backgrounds/bg-scribe-hall-fg-near.png` | Layer 4: hanging scrolls, candle sconces (transparent) |
| `public/assets/backgrounds/bg-scribe-hall-fg-far.png` | Layer 5: floating dust, cobwebs (transparent) |

---

## Completion Summary

### What was done
- Added 6 new `AssetPrompt` entries to `ASSET_PROMPTS` in `scripts/generate-assets.ts`, placed after the existing 3 Scribe Hall background prompts
- All 6 images generated successfully via `npx tsx scripts/generate-assets.ts --category backgrounds`
- The `bg-scribe-hall-fg-far` prompt was enhanced with "alpha channel, no background, isolated elements only" to ensure transparent background on first regen attempt

### Pass criteria results
- [x] All 6 new asset prompts added to `ASSET_PROMPTS` in `generate-assets.ts`
- [x] Dry-run lists all 6 new assets
- [x] All 6 images generated to `public/assets/backgrounds/`
- [x] Background layers (0-3) are opaque images with warm amber/brown palette
- [x] Foreground layers (4-5) have transparent backgrounds with sparse elements
- [x] Layer 0 (sky) shows grand library with warm amber/golden tones
- [x] Layer 3 (near detail) has clearly visible individual books, lamp, globe, ink bottles
- [x] Layers get progressively more detailed from back to front (0 → 3)
- [x] Foreground elements are positioned mainly at edges/top, not center
- [x] Existing 3 Scribe Hall background files are NOT deleted
- [x] `npx tsc --noEmit` passes
- [x] Only `scripts/generate-assets.ts` was modified (code change)

### Files modified
| File | Change |
|------|--------|
| `scripts/generate-assets.ts` | Added 6 new `AssetPrompt` entries for deep parallax backgrounds |

### Files created (by generator)
| File | Size |
|------|------|
| `public/assets/backgrounds/bg-scribe-hall-sky.png` | ~2.1 MB |
| `public/assets/backgrounds/bg-scribe-hall-far-deep.png` | ~2.0 MB |
| `public/assets/backgrounds/bg-scribe-hall-mid-detail.png` | ~2.3 MB |
| `public/assets/backgrounds/bg-scribe-hall-near-detail.png` | ~2.0 MB |
| `public/assets/backgrounds/bg-scribe-hall-fg-near.png` | ~1.5 MB |
| `public/assets/backgrounds/bg-scribe-hall-fg-far.png` | ~2.0 MB |

---

## Review Notes

**Reviewer:** 1b31a7aa | **Date:** 2026-02-25

**Verdict:** No issues found.

- All 6 new `AssetPrompt` entries are correctly structured with proper `id`, `filename`, `prompt`, `aspectRatio`, and `category` fields
- No duplicate IDs — all 9 scribe-hall background IDs are unique
- `BG_STYLE_PREFIX` template variable used correctly in all prompts
- Foreground layer prompts include appropriate transparency keywords
- Original 3 Scribe Hall backgrounds (`far`, `mid`, `near`) are preserved
- All 6 generated images exist on disk
- `npx tsc --noEmit` passes cleanly
- Only `scripts/generate-assets.ts` was modified (no unintended changes)
