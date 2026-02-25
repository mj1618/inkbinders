# Task: Full Player Sprite Sheets for All 10 States

## Overview

Expand `PlayerSprites.ts` to define sprite sheet configs and animation mappings for all 10 player states, plus attack overlay animations. Currently only 3 sheets exist (idle/1 frame, run/4 frames, jump/3 frames) and most states fall back to idle or run. After this task, every state has a dedicated sprite sheet with appropriate frame counts and animations, and the generate-assets script has prompts for all new sheets.

## What to Build

### 1. Update `src/engine/entities/PlayerSprites.ts`

Replace the current 3-sheet config with 9 sprite sheet configs covering all 10 player states plus 2 attack overlays:

| Sheet ID | Filename | Frames | Size | Columns | Animation Defs |
|----------|----------|--------|------|---------|----------------|
| `player-idle` | `player-idle.png` | 4 | 64×64 | 4 | `idle`: [0,1,2,3] @ 6fps, loop |
| `player-run` | `player-run-sheet.png` | 6 | 64×64 | 6 | `run`: [0,1,2,3,4,5] @ 10fps, loop |
| `player-jump` | `player-jump-sheet.png` | 3 | 64×64 | 3 | `jump-rise`: [0] @ 1fps, no-loop; `jump-apex`: [1] @ 1fps, no-loop; `jump-fall`: [2] @ 1fps, no-loop |
| `player-dash` | `player-dash-sheet.png` | 3 | 64×64 | 3 | `dash`: [0,1,2] @ 15fps, no-loop |
| `player-wall-slide` | `player-wall-slide-sheet.png` | 2 | 64×64 | 2 | `wall-slide`: [0,1] @ 4fps, loop |
| `player-crouch` | `player-crouch-sheet.png` | 2 | 64×64 | 2 | `crouch`: [0] @ 1fps, no-loop; `crouch-slide`: [1] @ 1fps, no-loop |
| `player-land` | `player-land-sheet.png` | 3 | 64×64 | 3 | `hard-land`: [0,1,2] @ 8fps, no-loop |
| `player-attack-spear` | `player-attack-spear-sheet.png` | 4 | 96×64 | 4 | `attack-spear`: [0,1,2,3] @ 12fps, no-loop |
| `player-attack-snap` | `player-attack-snap-sheet.png` | 3 | 64×64 | 3 | `attack-snap`: [0,1,2] @ 10fps, no-loop |

### 2. Update `STATE_TO_ANIMATION` mapping

Every player state gets a dedicated animation:

```typescript
export const STATE_TO_ANIMATION: Record<string, { sheetId: string; animName: string }> = {
  IDLE:           { sheetId: "player-idle",       animName: "idle" },
  RUNNING:        { sheetId: "player-run",        animName: "run" },
  JUMPING:        { sheetId: "player-jump",       animName: "jump-rise" },
  FALLING:        { sheetId: "player-jump",       animName: "jump-fall" },
  WALL_SLIDING:   { sheetId: "player-wall-slide", animName: "wall-slide" },
  WALL_JUMPING:   { sheetId: "player-jump",       animName: "jump-rise" },
  DASHING:        { sheetId: "player-dash",       animName: "dash" },
  CROUCHING:      { sheetId: "player-crouch",     animName: "crouch" },
  CROUCH_SLIDING: { sheetId: "player-crouch",     animName: "crouch-slide" },
  HARD_LANDING:   { sheetId: "player-land",       animName: "hard-land" },
};
```

### 3. Add Attack Animation Mappings

Export a new mapping for combat overlay animations. The `CombatSystem` or test page will use this to play attack animations overlaid on the player's current movement animation:

```typescript
export const ATTACK_TO_ANIMATION: Record<string, { sheetId: string; animName: string }> = {
  "quill-spear": { sheetId: "player-attack-spear", animName: "attack-spear" },
  "ink-snap":    { sheetId: "player-attack-snap",   animName: "attack-snap" },
};
```

### 4. Update `Player.ts` to handle new sprite sheets

The `initSprites()` method already loads `PLAYER_SPRITE_CONFIGS` and creates `AnimationController` instances per sheet. Since we're expanding the configs, it should automatically pick up the new sheets. Verify:

- `initSprites()` loads all 9 sheets (was 3)
- `update()` sprite animation section uses the new `STATE_TO_ANIMATION` mappings (already works via the mapping object)
- No changes needed to the render method — it already draws from `this.activeAnimController`

**One minor update needed**: For the `player-attack-spear` sheet which is 96×64 (wider than the 64×64 player), the sprite rendering offset calculation already handles this:
```typescript
const spriteOffsetX = (sheet.config.frameWidth - this.size.x) / 2;
```
This will center the 96px wide attack sprite over the 32px wide player collision box — correct behavior.

### 5. Update `scripts/generate-assets.ts`

Add new prompts for the 6 new player sprite sheets. The 3 existing prompts (player-idle, player-run, player-jump) need to be updated to match the new frame counts (idle goes from 1→4 frames, run from 4→6 frames).

**Updated/new prompts:**

```typescript
// UPDATE existing player-idle prompt:
{
  id: "player-idle",
  filename: "player-idle.png",
  prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character in idle breathing pose, 4 frames side by side in a horizontal strip, subtle breathing animation: chest rises and falls, robe sways gently, each frame 64x64 pixels, warm parchment and indigo tones, game sprite sheet, 256x64 total`,
  aspectRatio: "16:9",
}

// UPDATE existing player-run prompt (4 → 6 frames):
{
  id: "player-run",
  filename: "player-run-sheet.png",
  prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character running, 6 frames side by side in a horizontal strip, full run cycle with contact-pass-reach progression, ink-stained robe flowing, each frame 64x64 pixels, warm parchment and indigo tones, game sprite sheet, 384x64 total`,
  aspectRatio: "16:9",
}

// NEW: player-dash
{
  id: "player-dash",
  filename: "player-dash-sheet.png",
  prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character dashing, 3 frames side by side: wind-up crouch with trailing ink, mid-dash blur with ink streak behind, dash exit with momentum lean, each frame 64x64 pixels, warm parchment and hot pink ink trail tones, game sprite sheet, 192x64 total`,
  aspectRatio: "16:9",
}

// NEW: player-wall-slide
{
  id: "player-wall-slide",
  filename: "player-wall-slide-sheet.png",
  prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character sliding down a wall, 2 frames side by side: gripping wall with one hand reaching up, sliding down with robe trailing upward, each frame 64x64 pixels, warm parchment and teal tones, game sprite sheet, 128x64 total`,
  aspectRatio: "16:9",
}

// NEW: player-crouch
{
  id: "player-crouch",
  filename: "player-crouch-sheet.png",
  prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character crouching, 2 frames side by side: low crouch with robe pooled around feet, crouch-slide with speed lines and robe streaming behind, each frame 64x64 pixels, warm parchment and dark blue tones, game sprite sheet, 128x64 total`,
  aspectRatio: "16:9",
}

// NEW: player-land
{
  id: "player-land",
  filename: "player-land-sheet.png",
  prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character landing hard, 3 frames side by side: heavy impact with dust puff and squashed pose, recovery pushing up from ground, standing up with slight wobble, each frame 64x64 pixels, warm parchment and amber tones, game sprite sheet, 192x64 total`,
  aspectRatio: "16:9",
}

// NEW: player-attack-spear
{
  id: "player-attack-spear",
  filename: "player-attack-spear-sheet.png",
  prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character thrusting a quill spear, 4 frames side by side: wind-up with spear pulled back, forward thrust with arm extended, spear at full extension with ink splash at tip, recovery pulling spear back, each frame 96x64 pixels (wider to show spear reach), warm parchment and steel blue tones, game sprite sheet, 384x64 total`,
  aspectRatio: "16:9",
}

// NEW: player-attack-snap
{
  id: "player-attack-snap",
  filename: "player-attack-snap-sheet.png",
  prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character performing an ink snap attack, 3 frames side by side: hand raised with gathering ink energy, snap gesture with ink burst radiating outward, fade out with ink droplets scattering, each frame 64x64 pixels, warm parchment and dark violet tones, game sprite sheet, 192x64 total`,
  aspectRatio: "16:9",
}
```

### 6. Update AssetManager placeholder colors

In `src/engine/core/AssetManager.ts`, the player placeholder color is already `#f472b6`. No change needed — all player sheets start with `player-` prefix and will get the pink placeholder.

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/engine/entities/PlayerSprites.ts` | **Modify** — expand from 3 to 9 sprite sheet configs, update animations, update STATE_TO_ANIMATION, add ATTACK_TO_ANIMATION |
| `scripts/generate-assets.ts` | **Modify** — update 2 existing prompts (idle, run), add 6 new prompts (dash, wall-slide, crouch, land, attack-spear, attack-snap) |
| `src/engine/entities/Player.ts` | **Verify only** — the existing initSprites/update/render code should handle the expanded configs without modification. If the animControllers Map lookup or sprite offset math needs adjustment for the wider attack-spear frames, fix it. |

## What NOT to Do

- Do NOT modify the Player state machine or add new states
- Do NOT change the `RenderConfig` system (already done in previous task)
- Do NOT generate actual image files — just define the configs and prompts
- Do NOT touch test pages — the toggle system already exists and will pick up new sheets automatically
- Do NOT add attack overlay rendering to `Player.render()` yet — the `ATTACK_TO_ANIMATION` export is for future combat sprite integration (Task 8 in this epic). For now, just export the mapping.

## Verification / Pass Criteria

1. **TypeScript compiles**: `npx tsc --noEmit` passes with no errors
2. **All 10 states mapped**: Every state in `STATE_TO_ANIMATION` has a dedicated `sheetId` + `animName` (no fallbacks to idle/run for states that should have their own animation)
3. **9 sprite sheet configs**: `PLAYER_SPRITE_CONFIGS.length === 9`
4. **Frame counts match**: Each config's `totalFrames` matches the number of frames in its animations
5. **Generate script has 11 prompts**: The script's `ASSET_PROMPTS` array has all 5 existing prompts (including tiles) + 6 new player prompts = 11 total
6. **Existing tests pass**: `npm run test:run` still passes — the headless test harness doesn't load sprites (no DOM), so this is a safe change
7. **Placeholder rendering**: When running the dev server, navigating to `/test/sprites` and switching to "sprites" mode shows placeholder rectangles for all 9 player sheets (each with correct frame count and pink color)
8. **Attack mapping exported**: `ATTACK_TO_ANIMATION` is exported and maps `"quill-spear"` and `"ink-snap"` to their respective sheet/anim pairs

---

## Completion Summary

### Files Modified
- **`src/engine/entities/PlayerSprites.ts`** — Expanded from 3 to 9 sprite sheet configs covering all 10 player states + 2 attack overlays. Updated `PLAYER_ANIMATIONS` with animation definitions for all new sheets. Updated `STATE_TO_ANIMATION` so every state has a dedicated animation (no fallbacks). Added new `ATTACK_TO_ANIMATION` export mapping weapon types to attack overlay animations.
- **`scripts/generate-assets.ts`** — Updated 2 existing prompts (idle: 1→4 frames, run: 4→6 frames) and added 6 new player sprite prompts (dash, wall-slide, crouch, land, attack-spear, attack-snap). Total prompts: 11 (9 player + 2 tiles).

### Verified
- `npx tsc --noEmit` passes with no errors
- `npm run test:run` passes all 427 tests across 16 test files
- `Player.ts` required no modifications — `initSprites()`, `update()`, and `render()` all handle the expanded configs automatically
- All 10 states mapped with dedicated animations, 9 sprite sheet configs, frame counts match, attack mapping exported

---

## Review (agent 78f9ce77)

**Reviewed files:** `PlayerSprites.ts`, `generate-assets.ts`, `Player.ts`, `AssetManager.ts`, `SpriteSheet.ts`, `AnimationController.ts`

**Checks performed:**
- All 9 sprite sheet configs have correct frame dimensions, column counts, and totalFrames
- All animation frame indices are within bounds (e.g., idle [0,1,2,3] with totalFrames=4)
- All sheets are single-row (columns === totalFrames) — correct for horizontal strips
- STATE_TO_ANIMATION maps all 10 player states with no fallbacks
- ATTACK_TO_ANIMATION correctly exports quill-spear and ink-snap mappings
- generate-assets.ts has 11 prompts (9 player + 2 tiles) with filenames matching PlayerSprites.ts src paths
- Player.initSprites() iterates all configs — picks up 9 sheets automatically
- Player.update() sprite section uses STATE_TO_ANIMATION lookup — works with expanded mappings
- Player.render() sprite offset math handles 96×64 attack-spear frames correctly: (96-24)/2 = 36px centering
- AssetManager placeholder generation handles all new sheets via "player" prefix → #f472b6
- No `any` types, no frame-rate dependent issues, no memory leaks
- `npx tsc --noEmit` passes
- `npm run test:run` passes all 427 tests across 16 test files

**Issues found:** None

**Fixes applied:** None needed — implementation is clean and matches the spec exactly.
