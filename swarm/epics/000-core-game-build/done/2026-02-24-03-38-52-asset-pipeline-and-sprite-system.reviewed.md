# Task: Asset Pipeline & Sprite System — From Rectangles to Hand-Inked Art

## Overview

Build the **sprite rendering system** and **asset generation pipeline** that transforms Inkbinders from colored rectangles into a hand-inked 2D metroidvania with real art. This is Phase 6, step 28 — the visual polish pipeline.

Currently, every entity in the game (player, enemies, bosses, platforms) is rendered as `fillRect()` calls with solid colors and simple alpha effects. This task adds:

1. A **SpriteSheet** class for loading, slicing, and rendering sprite sheets
2. A **`drawImage` method** on the `Renderer` class for sprite rendering
3. An **AssetManager** singleton for loading and caching image assets
4. A **Nano Banana API generation script** that produces the initial art assets
5. A **`/test/sprites` test page** that demonstrates sprite rendering with animations
6. Integration of sprite rendering into the **Player entity** as a proof of concept

**Core design principle:** The sprite system is an *additive layer* — it does NOT remove the existing rectangle rendering. Every entity keeps its `fillRect` rendering as a fallback. The sprite system provides an alternative render path that test pages opt into. This means all existing test pages continue to work unchanged. The sprite test page demonstrates the new rendering.

**Scope boundary:** This task creates the infrastructure and generates a starter set of assets (player character sprite sheet + one tileset). It does NOT retrofit every test page or every entity. That's incremental follow-up work. It delivers a working pipeline from "prompt → generated image → loaded in engine → rendered on canvas."

## Dependencies

- Engine `Renderer` class (`src/engine/core/Renderer.ts`) ✅
- Player entity (`src/engine/entities/Player.ts`) ✅
- `PlayerParams` and state machine ✅
- All canvas/engine infrastructure ✅
- Nano Banana API key in `.env.local` as `NANOBANANA_API_KEY` ✅
- `@google/genai` npm package — **needs to be installed**

## What to Build

### 1. Install `@google/genai` SDK

```bash
npm install @google/genai
```

This is Google's official Gemini/Nano Banana TypeScript SDK.

### 2. SpriteSheet Class (`src/engine/core/SpriteSheet.ts`)

A pure TypeScript class for working with sprite sheet images. No React dependencies.

```typescript
export interface SpriteSheetConfig {
  /** Unique asset ID for caching */
  id: string;
  /** Path to the sprite sheet image (relative to public/) */
  src: string;
  /** Width of each frame in pixels */
  frameWidth: number;
  /** Height of each frame in pixels */
  frameHeight: number;
  /** Number of columns in the sheet */
  columns: number;
  /** Total number of frames in the sheet */
  totalFrames: number;
}

export interface AnimationDef {
  /** Name of the animation (e.g., "idle", "run", "jump") */
  name: string;
  /** Frame indices into the sprite sheet (0-based, left-to-right, top-to-bottom) */
  frames: number[];
  /** Frames per second for this animation */
  fps: number;
  /** Whether the animation loops */
  loop: boolean;
}

export class SpriteSheet {
  readonly config: SpriteSheetConfig;
  readonly image: HTMLImageElement;
  private loaded: boolean = false;
  private animations: Map<string, AnimationDef> = new Map();

  constructor(config: SpriteSheetConfig);

  /** Returns a promise that resolves when the image is loaded */
  load(): Promise<void>;

  /** Check if the sprite sheet image is loaded */
  isLoaded(): boolean;

  /** Register an animation definition */
  addAnimation(anim: AnimationDef): void;

  /** Get an animation by name */
  getAnimation(name: string): AnimationDef | undefined;

  /**
   * Get the source rectangle for a specific frame index.
   * Frame 0 is top-left, frames go left-to-right then top-to-bottom.
   */
  getFrameRect(frameIndex: number): { sx: number; sy: number; sw: number; sh: number };

  /**
   * Draw a specific frame at the given world position.
   * Supports horizontal flip (for facing direction) and scale.
   */
  drawFrame(
    ctx: CanvasRenderingContext2D,
    frameIndex: number,
    x: number,
    y: number,
    flipX?: boolean,
    scaleX?: number,
    scaleY?: number
  ): void;
}
```

### 3. AnimationController Class (`src/engine/core/AnimationController.ts`)

Manages which animation is playing and advances frame timing.

```typescript
export class AnimationController {
  private spriteSheet: SpriteSheet;
  private currentAnim: string = "";
  private currentFrame: number = 0;
  private frameTimer: number = 0;
  private finished: boolean = false;

  constructor(spriteSheet: SpriteSheet);

  /** Play an animation. If it's already playing, does nothing (no restart). */
  play(animName: string): void;

  /** Force-restart an animation from frame 0 */
  restart(animName: string): void;

  /** Update animation timing. Call once per frame with dt in seconds. */
  update(dt: number): void;

  /** Get the current frame index into the sprite sheet */
  getCurrentFrameIndex(): number;

  /** Check if a non-looping animation has finished */
  isFinished(): boolean;

  /** Get the current animation name */
  getCurrentAnimation(): string;

  /**
   * Draw the current animation frame at the given position.
   * Delegates to SpriteSheet.drawFrame() with the current frame index.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    flipX?: boolean,
    scaleX?: number,
    scaleY?: number
  ): void;
}
```

### 4. AssetManager Singleton (`src/engine/core/AssetManager.ts`)

Centralized loading and caching for all game assets (images, sprite sheets).

```typescript
export class AssetManager {
  private static instance: AssetManager;
  private spriteSheets: Map<string, SpriteSheet> = new Map();
  private images: Map<string, HTMLImageElement> = new Map();
  private loading: Map<string, Promise<void>> = new Map();

  static getInstance(): AssetManager;

  /** Register and load a sprite sheet. Returns immediately if already loaded. */
  loadSpriteSheet(config: SpriteSheetConfig): Promise<SpriteSheet>;

  /** Get a loaded sprite sheet by ID */
  getSpriteSheet(id: string): SpriteSheet | undefined;

  /** Load a single image */
  loadImage(id: string, src: string): Promise<HTMLImageElement>;

  /** Get a loaded image by ID */
  getImage(id: string): HTMLImageElement | undefined;

  /** Load multiple assets in parallel. Returns when all are loaded. */
  loadAll(configs: SpriteSheetConfig[]): Promise<void>;

  /** Check if all registered assets are loaded */
  isReady(): boolean;

  /** Clear all cached assets */
  clear(): void;
}
```

### 5. Renderer `drawImage` Method

Add to the existing `Renderer` class in `src/engine/core/Renderer.ts`:

```typescript
/** Draw an image or image region at the given position */
drawImage(
  image: HTMLImageElement | HTMLCanvasElement,
  sx: number, sy: number, sw: number, sh: number,  // source rect
  dx: number, dy: number, dw: number, dh: number   // dest rect
): void {
  this.ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
}

/** Draw an image with optional horizontal flip */
drawImageFlipped(
  image: HTMLImageElement | HTMLCanvasElement,
  sx: number, sy: number, sw: number, sh: number,
  dx: number, dy: number, dw: number, dh: number,
  flipX: boolean
): void {
  if (!flipX) {
    this.ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
    return;
  }
  this.ctx.save();
  this.ctx.translate(dx + dw, dy);
  this.ctx.scale(-1, 1);
  this.ctx.drawImage(image, sx, sy, sw, sh, 0, 0, dw, dh);
  this.ctx.restore();
}
```

### 6. Asset Generation Script (`scripts/generate-assets.ts`)

A Node.js script that uses the Nano Banana API to generate game art assets. This is run manually by the developer, not at runtime. Generated images are saved to `public/assets/`.

**IMPORTANT:** This script runs with `npx tsx scripts/generate-assets.ts`. It uses the `@google/genai` SDK and reads `NANOBANANA_API_KEY` from `.env.local`.

```typescript
// scripts/generate-assets.ts
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";

// Load .env.local
dotenv.config({ path: ".env.local" });

const API_KEY = process.env.NANOBANANA_API_KEY;
if (!API_KEY) {
  console.error("Missing NANOBANANA_API_KEY in .env.local");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// Art style lock — every prompt starts with this
const STYLE_PREFIX = "hand-inked 2D game art, clean linework, watercolor wash fill, paper grain texture, high readability, metroidvania sprite, cohesive style, no text, no background, transparent background PNG,";

interface AssetPrompt {
  id: string;
  filename: string;
  prompt: string;
  aspectRatio?: string;
}

const ASSET_PROMPTS: AssetPrompt[] = [
  // Player character — idle pose (single frame for now)
  {
    id: "player-idle",
    filename: "player-idle.png",
    prompt: `${STYLE_PREFIX} small hooded archivist character, front-facing idle pose, wearing ink-stained robe with scroll belt, chunky readable silhouette, warm parchment and indigo tones, 64x64 pixel art scale, game sprite`,
  },
  // Player character — run cycle (4 frames in a strip)
  {
    id: "player-run",
    filename: "player-run-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character running, 4 frames side by side in a horizontal strip, each frame 64x64 pixels, ink-stained robe flowing, dynamic pose progression, warm parchment and indigo tones, game sprite sheet, 256x64 total`,
  },
  // Player character — jump (3 frames: rise, apex, fall)
  {
    id: "player-jump",
    filename: "player-jump-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character jumping, 3 frames side by side: jump launch crouching, mid-air at apex with robe flowing, falling with arms up, each frame 64x64 pixels, warm parchment and indigo tones, game sprite sheet, 192x64 total`,
  },
  // Platform tileset — Scribe Hall theme
  {
    id: "tiles-scribe-hall",
    filename: "tiles-scribe-hall.png",
    prompt: `${STYLE_PREFIX} 2D game tileset for a cozy library, 4 tiles in a row: wooden floor plank, wooden shelf block, stone wall block, wooden beam, each tile 32x32 pixels, warm brown and parchment tones, seamless tileable edges, game tileset, 128x32 total`,
  },
  // Platform tileset — Herbarium Folio theme
  {
    id: "tiles-herbarium",
    filename: "tiles-herbarium.png",
    prompt: `${STYLE_PREFIX} 2D game tileset for an enchanted botanical garden library, 4 tiles in a row: vine-covered stone floor, mossy stone block, leaf-wrapped column, thorny hedge block, each tile 32x32 pixels, deep green and aged parchment tones, seamless tileable edges, game tileset, 128x32 total`,
  },
];

async function generateAsset(prompt: AssetPrompt): Promise<void> {
  const outputDir = path.join(process.cwd(), "public", "assets");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, prompt.filename);

  // Skip if already generated
  if (fs.existsSync(outputPath)) {
    console.log(`[skip] ${prompt.filename} already exists`);
    return;
  }

  console.log(`[gen] Generating ${prompt.filename}...`);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: prompt.prompt,
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: prompt.aspectRatio || "1:1",
        },
      },
    });

    // Find the image part in the response
    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
      console.error(`[err] No content in response for ${prompt.filename}`);
      return;
    }

    for (const part of candidate.content.parts) {
      if (part.inlineData) {
        const buffer = Buffer.from(part.inlineData.data, "base64");
        fs.writeFileSync(outputPath, buffer);
        console.log(`[ok] Saved ${prompt.filename} (${buffer.length} bytes)`);
        return;
      }
    }

    console.error(`[err] No image data in response for ${prompt.filename}`);
  } catch (error) {
    console.error(`[err] Failed to generate ${prompt.filename}:`, error);
  }
}

async function main() {
  console.log("=== Inkbinders Asset Generator ===");
  console.log(`Generating ${ASSET_PROMPTS.length} assets...\n`);

  // Generate sequentially to respect rate limits
  for (const prompt of ASSET_PROMPTS) {
    await generateAsset(prompt);
    // Brief delay between API calls
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log("\nDone!");
}

main();
```

**The script is designed to be idempotent** — it skips files that already exist. Developers can re-run it safely. To regenerate an asset, delete the file first.

### 7. Player Sprite Definitions (`src/engine/entities/PlayerSprites.ts`)

Define the sprite sheet config and animation mappings for the player character. This file maps player state machine states to animation names.

```typescript
import type { SpriteSheetConfig, AnimationDef } from "@/engine/core/SpriteSheet";

/** Player sprite sheet configurations */
export const PLAYER_SPRITE_CONFIGS: SpriteSheetConfig[] = [
  {
    id: "player-idle",
    src: "/assets/player-idle.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 1,
    totalFrames: 1,
  },
  {
    id: "player-run",
    src: "/assets/player-run-sheet.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 4,
    totalFrames: 4,
  },
  {
    id: "player-jump",
    src: "/assets/player-jump-sheet.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 3,
    totalFrames: 3,
  },
];

/** Animation definitions for the player */
export const PLAYER_ANIMATIONS: AnimationDef[] = [
  { name: "idle", frames: [0], fps: 1, loop: true },
  { name: "run", frames: [0, 1, 2, 3], fps: 10, loop: true },
  { name: "jump-rise", frames: [0], fps: 1, loop: false },
  { name: "jump-apex", frames: [1], fps: 1, loop: false },
  { name: "jump-fall", frames: [2], fps: 1, loop: false },
];

/**
 * Map player state machine state → animation name + which sprite sheet to use.
 * The test page uses this to drive the AnimationController.
 */
export const STATE_TO_ANIMATION: Record<string, { sheetId: string; animName: string }> = {
  IDLE: { sheetId: "player-idle", animName: "idle" },
  RUNNING: { sheetId: "player-run", animName: "run" },
  JUMPING: { sheetId: "player-jump", animName: "jump-rise" },
  FALLING: { sheetId: "player-jump", animName: "jump-fall" },
  WALL_SLIDING: { sheetId: "player-idle", animName: "idle" },   // Fallback for now
  WALL_JUMPING: { sheetId: "player-jump", animName: "jump-rise" },
  DASHING: { sheetId: "player-run", animName: "run" },          // Fallback for now
  CROUCHING: { sheetId: "player-idle", animName: "idle" },      // Fallback for now
  CROUCH_SLIDING: { sheetId: "player-run", animName: "run" },   // Fallback for now
  HARD_LANDING: { sheetId: "player-idle", animName: "idle" },   // Fallback for now
};
```

**Note:** Many states fall back to idle/run because we only have 3 sprite sheets initially. This is intentional — the pipeline delivers the infrastructure and a starter set. More animations are added incrementally as assets are generated.

### 8. Placeholder Assets

Since the Nano Banana API might not be available or the developer may not want to run the generation script immediately, create **placeholder assets** — simple programmatically-generated PNGs that the sprite system can use for testing.

Create `scripts/generate-placeholders.ts`:

```typescript
// scripts/generate-placeholders.ts
// Generates simple colored rectangle placeholder sprites for testing
// the sprite system without needing the Nano Banana API.
// Run: npx tsx scripts/generate-placeholders.ts

import * as fs from "node:fs";
import * as path from "node:path";

// We'll use a Canvas polyfill (node-canvas) or just write raw PNG data
// Actually, simpler: create 1x1 colored PNGs that the browser will stretch
// OR generate proper placeholder sheets using the canvas API at runtime

// For simplicity, create a tiny script that outputs colored PNG buffers
// using the PNG spec directly (no dependencies needed for small images)

function createPlaceholderPNG(width: number, height: number, r: number, g: number, b: number): Buffer {
  // Minimal valid PNG with a solid color
  // This is a well-known technique for generating tiny PNGs programmatically
  // For our purposes, we'll create an HTML file that generates them in-browser instead

  // Actually, the simplest approach: create a small JS utility that the test page
  // can call to generate placeholder canvases if the real assets aren't found
  console.log(`Would create ${width}x${height} placeholder (${r},${g},${b})`);
  return Buffer.alloc(0); // Placeholder
}

// Create public/assets directory
const outputDir = path.join(process.cwd(), "public", "assets");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log("Placeholder asset directory created at public/assets/");
console.log("Run 'npx tsx scripts/generate-assets.ts' to generate real assets.");
```

**Better approach for placeholders:** Instead of generating static placeholder PNGs (which is complex in Node without canvas libraries), build the placeholder generation into the `AssetManager`:

```typescript
// In AssetManager:
/** Create a colored rectangle placeholder sprite sheet as a canvas */
createPlaceholder(config: SpriteSheetConfig, color: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = config.frameWidth * config.columns;
  canvas.height = config.frameHeight * Math.ceil(config.totalFrames / config.columns);
  const ctx = canvas.getContext("2d")!;

  // Draw colored rectangles for each frame with frame numbers
  for (let i = 0; i < config.totalFrames; i++) {
    const col = i % config.columns;
    const row = Math.floor(i / config.columns);
    const x = col * config.frameWidth;
    const y = row * config.frameHeight;

    // Frame background
    ctx.fillStyle = color;
    ctx.fillRect(x + 2, y + 2, config.frameWidth - 4, config.frameHeight - 4);

    // Frame border
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1, y + 1, config.frameWidth - 2, config.frameHeight - 2);

    // Frame number
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px monospace";
    ctx.fillText(String(i), x + 4, y + 14);
  }

  return canvas;
}
```

The `SpriteSheet` should accept either an `HTMLImageElement` (real asset) or `HTMLCanvasElement` (placeholder) as its image source. Update `drawFrame` to use the generic `CanvasImageSource` type.

### 9. Sprite Test Page (`src/app/test/sprites/page.tsx`)

A test page that demonstrates the sprite system working. Shows:

- A player character rendered with sprites (or placeholders) instead of rectangles
- Animation state changes driven by the state machine
- Side-by-side comparison: rectangle rendering vs sprite rendering
- Asset loading status (which assets are loaded, which are placeholders)
- Animation controls (play/pause, speed, manual frame advance)

**Layout:**

```
┌─────────────────────────────────────────────┬──────────────────────┐
│                                             │  Debug Panel         │
│   Canvas (960x540)                          │                      │
│                                             │  [Asset Status]      │
│   Player with sprite rendering              │  player-idle: ✓/✗    │
│   Platforms with tile rendering             │  player-run: ✓/✗     │
│   or placeholder colored rects              │  player-jump: ✓/✗    │
│                                             │  tiles-scribe: ✓/✗   │
│                                             │                      │
│   Bottom area: animation strip preview      │  [Animation]         │
│   showing all frames of current animation   │  Current: "run"      │
│                                             │  Frame: 2/4          │
│                                             │  FPS: [slider]       │
│                                             │  [Play] [Pause]      │
│                                             │  [< Prev] [Next >]   │
│                                             │                      │
│                                             │  [Rendering]         │
│                                             │  ○ Sprites            │
│                                             │  ○ Rectangles        │
│                                             │  ○ Both (overlay)    │
│                                             │                      │
│                                             │  [Player Params]     │
│                                             │  (standard sliders)  │
│                                             │                      │
│                                             │  [Pass Criteria]     │
└─────────────────────────────────────────────┴──────────────────────┘
```

**Test page architecture:**

The test page creates a small test level (960×540, no scrolling) with a few platforms. The player moves with full controls. The rendering switches between rectangle mode (existing) and sprite mode (new) via a toggle.

```typescript
// In the render callback:
if (renderMode === "sprites" || renderMode === "both") {
  // Determine current animation from player state
  const stateMapping = STATE_TO_ANIMATION[playerState];
  if (stateMapping) {
    const sheet = assetManager.getSpriteSheet(stateMapping.sheetId);
    if (sheet?.isLoaded()) {
      animController.play(stateMapping.animName);
      animController.update(dt);
      animController.draw(ctx, playerX, playerY, !player.facingRight);
    }
  }
}

if (renderMode === "rectangles" || renderMode === "both") {
  // Existing rectangle rendering
  player.render(renderer, interpolation);
}
```

**Animation strip preview:** At the bottom of the canvas, draw all frames of the current animation in a horizontal strip (small, 32px tall scaled down). Highlight the current frame. This is a visual debugging aid.

**Level setup:**
- Single room, 960×540
- Floor platform (full width)
- A few stepping platforms
- Left and right walls
- Player spawns center-bottom
- Same controls as other test pages

### 10. `public/assets/` Directory

Create the directory structure:

```
public/
  assets/
    player-idle.png        (generated or placeholder)
    player-run-sheet.png   (generated or placeholder)
    player-jump-sheet.png  (generated or placeholder)
    tiles-scribe-hall.png  (generated or placeholder)
    tiles-herbarium.png    (generated or placeholder)
```

The `generate-assets.ts` script creates this directory and populates it. The `AssetManager` falls back to canvas-generated placeholders if the files don't exist (image load fails → create placeholder).

## Files to Create

1. **`src/engine/core/SpriteSheet.ts`** — SpriteSheet class with frame slicing and drawing
2. **`src/engine/core/AnimationController.ts`** — Animation playback controller
3. **`src/engine/core/AssetManager.ts`** — Singleton asset loader and cache
4. **`src/engine/entities/PlayerSprites.ts`** — Player sprite configs, animations, state-to-anim mapping
5. **`scripts/generate-assets.ts`** — Nano Banana API asset generation script
6. **`src/app/test/sprites/page.tsx`** — Sprite system test page

## Files to Modify

7. **`src/engine/core/Renderer.ts`** — Add `drawImage()` and `drawImageFlipped()` methods
8. **`src/lib/testStatus.ts`** — Add sprites test page entry: `{ name: "Sprites", path: "/test/sprites", phase: 6, phaseName: "Integration", status: "in-progress", description: "Sprite rendering and asset pipeline" }`
9. **`AGENTS.md`** — Add Sprite System and Asset Pipeline documentation sections

## Specific Values & Constants

| Constant | Value | Notes |
|----------|-------|-------|
| Player sprite frame size | 64×64 px | Each frame in the sheet |
| Player collision box | 24×48 px | Unchanged from current (sprite is larger than hitbox) |
| Tile size | 32×32 px | Standard tile grid |
| Run animation FPS | 10 | Frames per second |
| Idle animation FPS | 1 | Essentially static |
| Jump animation FPS | 1 | Single frame per phase |
| Placeholder color (player) | #f472b6 | Matches current player rectangle color |
| Placeholder color (tiles) | varies by biome | Uses existing biome theme platformFillColor |
| Asset load timeout | 5000 ms | Max time to wait for image load before using placeholder |

## Art Style Reference

All Nano Banana prompts must include this style prefix:

```
"hand-inked 2D game art, clean linework, watercolor wash fill, paper grain texture, high readability, metroidvania sprite, cohesive style, no text"
```

The player character is described as: "small hooded archivist character, ink-stained robe with scroll belt, chunky readable silhouette, warm parchment and indigo tones."

## Implementation Notes

1. **`SpriteSheet.drawFrame()` uses the raw canvas context**, not the Renderer. This is because sprite drawing needs `ctx.drawImage()` with source rectangle clipping, which the Renderer's new `drawImage` method provides. However, `SpriteSheet.drawFrame()` takes `ctx` directly for maximum flexibility (the Renderer may not be accessible in all contexts).

2. **Placeholder generation is browser-side.** The `AssetManager` creates canvas-based placeholders at runtime if an image fails to load. This means the sprite test page works immediately without running the generation script. The placeholders are visually distinct (colored rectangles with frame numbers) so the developer knows they're not real assets.

3. **`SpriteSheet` uses `CanvasImageSource`** as the image type (union of HTMLImageElement and HTMLCanvasElement). This lets it accept both real loaded images and canvas-generated placeholders transparently.

4. **The generation script is a standalone CLI tool.** It's not imported by any game code. It produces PNGs in `public/assets/`. The game code only references the output path strings. If the generation script fails or the API key is missing, the game falls back to placeholders.

5. **Don't modify the Player class's `render()` method.** The sprite rendering is done in the test page's render callback, outside the Player. This keeps the Player entity unchanged and lets test pages opt into sprite rendering. Later, when sprites are mature, we can add an optional sprite render path to Player.

6. **The `@google/genai` package is only used by the scripts/, not by the game engine or Next.js app.** It's a dev dependency used for offline asset generation. Don't import it in any `src/` code.

7. **Aspect ratios for generation:** Player sprites should use `1:1`. Tile sheets should use `4:1` (or closest available: `16:9` works for wider sheets, `1:1` for square).

8. **Rate limiting:** The generation script inserts a 1-second delay between API calls. Nano Banana API has rate limits — don't parallelize the calls.

9. **`.gitignore` update:** Add a comment in the generation script noting that generated assets in `public/assets/` SHOULD be committed to git (they're production assets, not build artifacts). Do NOT add `public/assets/` to `.gitignore`.

10. **`dotenv` package:** The generation script needs to read `.env.local`. Install `dotenv` as a dev dependency: `npm install -D dotenv`. Alternatively, use `tsx`'s built-in `.env` loading if available.

## Pass Criteria

1. **SpriteSheet loads images:** SpriteSheet class can load a PNG from `public/assets/` and report `isLoaded() === true`
2. **Frame slicing works:** `getFrameRect()` returns correct source rectangles for multi-frame sheets
3. **drawFrame renders:** A sprite frame renders on the canvas at the correct position
4. **Horizontal flip works:** `drawFrame(ctx, frame, x, y, true)` renders the frame mirrored
5. **AnimationController plays:** Run animation cycles through frames at the configured FPS
6. **State-driven animation:** Player state changes (idle→run→jump→fall) switch the animation
7. **Placeholders work:** If real assets aren't present, colored rectangle placeholders render in their place
8. **AssetManager caches:** Loading the same sprite sheet twice returns the cached instance
9. **Rendering toggle works:** Switching between "Sprites", "Rectangles", and "Both" modes works
10. **Animation strip preview:** Bottom of canvas shows all frames with current frame highlighted
11. **No regressions:** All existing test pages render identically (no changes to Player.render())
12. **Generation script runs:** `npx tsx scripts/generate-assets.ts` executes without errors (may skip if no API key)
13. **TypeScript strict:** `npx tsc --noEmit` passes

## Verification

- [ ] `npm install @google/genai dotenv` — packages install
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` succeeds
- [ ] Navigate to `/test/sprites` — canvas renders with player and platforms
- [ ] Player moves with keyboard controls, animation changes with state
- [ ] Toggle rendering mode between sprites/rectangles/both
- [ ] If real assets exist: sprite frames display correctly
- [ ] If real assets missing: colored placeholder rectangles display with frame numbers
- [ ] Animation strip at bottom shows frames with highlight
- [ ] All existing test pages (`/test/ground-movement`, etc.) still work unchanged
- [ ] `npx tsx scripts/generate-assets.ts` runs (generates assets if API key present, errors gracefully if not)
