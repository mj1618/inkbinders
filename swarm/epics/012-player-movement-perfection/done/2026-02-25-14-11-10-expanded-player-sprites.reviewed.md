# Task: Expanded Player Sprites

**Epic:** 012 — Player Movement Perfection
**Task slug:** expanded-player-sprites
**Goal:** Generate 12 new sprite sheets that fill animation gaps, add transitional poses, and increase frame counts for key movements.
**Status:** COMPLETE

## Completion Summary

### Files Modified
- `scripts/generate-assets.ts` — Added 12 new `AssetPrompt` entries in a new "Expanded Player Sprite Sheets (Epic 012)" section, placed after the existing 9 player sheets and before enemy sheets.

### Files Generated (all in `public/assets/`)
1. `player-idle-breathe-sheet.png` — 8 frames, extended idle breathing cycle
2. `player-run-full-sheet.png` — 8 frames, full run cycle
3. `player-run-start-sheet.png` — 3 frames, idle-to-run transition
4. `player-run-stop-sheet.png` — 3 frames, run-to-idle skid
5. `player-turn-sheet.png` — 3 frames, direction reversal
6. `player-jump-rise-sheet.png` — 4 frames, jump ascent
7. `player-jump-fall-sheet.png` — 4 frames, jump descent
8. `player-wall-jump-sheet.png` — 3 frames, wall push-off
9. `player-wall-slide-full-sheet.png` — 4 frames, full wall slide
10. `player-dash-full-sheet.png` — 5 frames, full dash sequence
11. `player-crouch-enter-sheet.png` — 2 frames, standing-to-crouch
12. `player-crouch-slide-full-sheet.png` — 4 frames, full crouch slide

### Verification
- `npx tsc --noEmit` passes cleanly
- `npx tsx scripts/generate-assets.ts --category player --dry-run` correctly listed all 12 new assets
- All 12 images generated successfully (0 failures) via Nano Banana API (gemini-2.5-flash-image)
- All use `referenceImage: "player-idle.png"` for character consistency
- Original 9 player sprite sheets are untouched (timestamps unchanged)

---

## What to Build

Add 12 new player sprite sheet prompts to `scripts/generate-assets.ts` and run the asset pipeline to generate them. These sprites will later be wired into the player animation system (Task 3), but this task is purely about **defining the prompts and generating the images**.

The current player has 9 sprite sheets with thin animations (2–4 frames each). This task produces the raw art for:
- Extended idle (8 frames vs 4)
- Full run cycle (8 frames vs 4)
- Run start/stop/turn transitions (3 frames each)
- Detailed jump rise and fall (4 frames each vs 1 frame each)
- Dedicated wall-jump (3 frames, currently reuses jump-rise)
- Extended wall-slide (4 frames vs 2)
- Extended dash (5 frames vs 3)
- Crouch enter transition (2 frames)
- Extended crouch-slide (4 frames vs 1)

---

## Files to Modify

### `scripts/generate-assets.ts`

Add 12 new entries to the `ASSET_PROMPTS` array, in the player section (after the existing 9 player sheets, before the enemy sheets). Place them under a new comment block:

```typescript
// ─── Expanded Player Sprite Sheets (12 total, Epic 012) ──────────────
```

### New Sprite Sheet Definitions

All 12 new sheets use:
- `referenceImage: "player-idle.png"` for character consistency
- `aspectRatio: "16:9"` for horizontal strips
- `category: "player"`
- The existing `PLAYER_STYLE` prefix and `PLAYER_CHARACTER_DESC` constant

Here are the exact 12 entries to add:

#### 1. player-idle-breathe (8 frames, 64×64)

```typescript
{
  id: "player-idle-breathe",
  filename: "player-idle-breathe-sheet.png",
  prompt: `${PLAYER_STYLE} sprite sheet of ${PLAYER_CHARACTER_DESC} in extended idle breathing cycle, 8 frames side by side in a horizontal strip, deeper breath: chest rises slowly over 4 frames then settles over 4 frames, hood shifts slightly, satchel sways gently, subtle weight shift from foot to foot, each frame 64x64 pixels, same character same colors same proportions as idle, game sprite sheet, 512x64 total`,
  aspectRatio: "16:9",
  category: "player",
  referenceImage: "player-idle.png",
},
```

#### 2. player-run-full (8 frames, 64×64)

```typescript
{
  id: "player-run-full",
  filename: "player-run-full-sheet.png",
  prompt: `${PLAYER_STYLE} sprite sheet of ${PLAYER_CHARACTER_DESC} in a fluid run cycle, 8 frames side by side in a horizontal strip, full run cycle: right foot contact, right foot recoil/passing, left foot high-point, left foot contact, left foot recoil/passing, right foot high-point, indigo robe flowing behind with bounce, each foot strike distinct, each frame 64x64 pixels, same character same colors same proportions as idle, game sprite sheet, 512x64 total`,
  aspectRatio: "16:9",
  category: "player",
  referenceImage: "player-idle.png",
},
```

#### 3. player-run-start (3 frames, 64×64)

```typescript
{
  id: "player-run-start",
  filename: "player-run-start-sheet.png",
  prompt: `${PLAYER_STYLE} sprite sheet of ${PLAYER_CHARACTER_DESC} transitioning from standing to running, 3 frames side by side in a horizontal strip: weight shifting forward with leading foot, first stride push-off, full acceleration lean with robe trailing, each frame 64x64 pixels, same character same colors same proportions as idle, game sprite sheet, 192x64 total`,
  aspectRatio: "16:9",
  category: "player",
  referenceImage: "player-idle.png",
},
```

#### 4. player-run-stop (3 frames, 64×64)

```typescript
{
  id: "player-run-stop",
  filename: "player-run-stop-sheet.png",
  prompt: `${PLAYER_STYLE} sprite sheet of ${PLAYER_CHARACTER_DESC} skidding to a stop from running, 3 frames side by side in a horizontal strip: brake with front foot planted and robe swinging forward, deceleration with robe settling, upright stopped pose, each frame 64x64 pixels, same character same colors same proportions as idle, game sprite sheet, 192x64 total`,
  aspectRatio: "16:9",
  category: "player",
  referenceImage: "player-idle.png",
},
```

#### 5. player-turn (3 frames, 64×64)

```typescript
{
  id: "player-turn",
  filename: "player-turn-sheet.png",
  prompt: `${PLAYER_STYLE} sprite sheet of ${PLAYER_CHARACTER_DESC} performing a quick direction reversal while running, 3 frames side by side in a horizontal strip: body pivoting as robe billows in old direction, mid-turn with robe whipping around, settled facing new direction, each frame 64x64 pixels, same character same colors same proportions as idle, game sprite sheet, 192x64 total`,
  aspectRatio: "16:9",
  category: "player",
  referenceImage: "player-idle.png",
},
```

#### 6. player-jump-rise (4 frames, 64×64)

```typescript
{
  id: "player-jump-rise",
  filename: "player-jump-rise-sheet.png",
  prompt: `${PLAYER_STYLE} sprite sheet of ${PLAYER_CHARACTER_DESC} ascending during a jump, 4 frames side by side in a horizontal strip: crouch anticipation with legs bent, launch with arms up and robe compressed, mid-rise with robe trailing below, near-apex with arms reaching up, each frame 64x64 pixels, same character same colors same proportions as idle, game sprite sheet, 256x64 total`,
  aspectRatio: "16:9",
  category: "player",
  referenceImage: "player-idle.png",
},
```

#### 7. player-jump-fall (4 frames, 64×64)

```typescript
{
  id: "player-jump-fall",
  filename: "player-jump-fall-sheet.png",
  prompt: `${PLAYER_STYLE} sprite sheet of ${PLAYER_CHARACTER_DESC} falling after jump apex, 4 frames side by side in a horizontal strip: apex float with robe billowing upward, tilting downward as fall begins, fast fall with robe streaming above and arms bracing, pre-landing brace with legs extending, each frame 64x64 pixels, same character same colors same proportions as idle, game sprite sheet, 256x64 total`,
  aspectRatio: "16:9",
  category: "player",
  referenceImage: "player-idle.png",
},
```

#### 8. player-wall-jump (3 frames, 64×64)

```typescript
{
  id: "player-wall-jump",
  filename: "player-wall-jump-sheet.png",
  prompt: `${PLAYER_STYLE} sprite sheet of ${PLAYER_CHARACTER_DESC} pushing off a wall to jump away, 3 frames side by side in a horizontal strip: coiled against wall with one hand gripping, explosive push-off with legs extending from wall, launched away with robe streaming behind, each frame 64x64 pixels, same character same colors same proportions as idle, game sprite sheet, 192x64 total`,
  aspectRatio: "16:9",
  category: "player",
  referenceImage: "player-idle.png",
},
```

#### 9. player-wall-slide-full (4 frames, 64×64)

```typescript
{
  id: "player-wall-slide-full",
  filename: "player-wall-slide-full-sheet.png",
  prompt: `${PLAYER_STYLE} sprite sheet of ${PLAYER_CHARACTER_DESC} sliding down a wall, 4 frames side by side in a horizontal strip: initial grab with both hands on wall surface, steady controlled slide gripping wall, faster slide with one hand trailing, near-ground anticipation with legs extending, each frame 64x64 pixels, same character same colors same proportions as idle, game sprite sheet, 256x64 total`,
  aspectRatio: "16:9",
  category: "player",
  referenceImage: "player-idle.png",
},
```

#### 10. player-dash-full (5 frames, 64×64)

```typescript
{
  id: "player-dash-full",
  filename: "player-dash-full-sheet.png",
  prompt: `${PLAYER_STYLE} sprite sheet of ${PLAYER_CHARACTER_DESC} performing a fast dash, 5 frames side by side in a horizontal strip: crouch wind-up gathering energy, burst launch with pink ink trail igniting, mid-dash with speed blur and robe pressed flat, mid-dash continued with speed blur, exit deceleration with robe catching up, each frame 64x64 pixels, same character same colors same proportions as idle, game sprite sheet, 320x64 total`,
  aspectRatio: "16:9",
  category: "player",
  referenceImage: "player-idle.png",
},
```

#### 11. player-crouch-enter (2 frames, 64×64)

```typescript
{
  id: "player-crouch-enter",
  filename: "player-crouch-enter-sheet.png",
  prompt: `${PLAYER_STYLE} sprite sheet of ${PLAYER_CHARACTER_DESC} ducking down from standing, 2 frames side by side in a horizontal strip: beginning to lower body with knees bending, fully crouched with robe pooled around feet, each frame 64x64 pixels, same character same colors same proportions as idle, game sprite sheet, 128x64 total`,
  aspectRatio: "16:9",
  category: "player",
  referenceImage: "player-idle.png",
},
```

#### 12. player-crouch-slide-full (4 frames, 64×64)

```typescript
{
  id: "player-crouch-slide-full",
  filename: "player-crouch-slide-full-sheet.png",
  prompt: `${PLAYER_STYLE} sprite sheet of ${PLAYER_CHARACTER_DESC} performing a crouch slide along the ground, 4 frames side by side in a horizontal strip: slide start with forward momentum and sparks, fast slide low to ground with robe streaming behind, slowing down with friction dust, stopping with settled pose, each frame 64x64 pixels, same character same colors same proportions as idle, game sprite sheet, 256x64 total`,
  aspectRatio: "16:9",
  category: "player",
  referenceImage: "player-idle.png",
},
```

---

## Execution Steps

1. **Add the 12 prompts** to `ASSET_PROMPTS` in `scripts/generate-assets.ts`, in the player section after the existing 9 player sheets
2. **Verify with dry-run**: `npx tsx scripts/generate-assets.ts --category player --dry-run` — should list all 12 new assets
3. **Generate the sprites**: `npx tsx scripts/generate-assets.ts --category player` — generates all 12 images to `public/assets/`
4. **Verify the outputs** exist in `public/assets/` with correct filenames
5. **Check TypeScript**: `npx tsc --noEmit` — should compile cleanly (generate-assets.ts is a script, but must still type-check)

---

## Summary Table

| ID | Filename | Frames | Frame Size | Total Image Size |
|----|----------|--------|------------|------------------|
| player-idle-breathe | player-idle-breathe-sheet.png | 8 | 64×64 | 512×64 |
| player-run-full | player-run-full-sheet.png | 8 | 64×64 | 512×64 |
| player-run-start | player-run-start-sheet.png | 3 | 64×64 | 192×64 |
| player-run-stop | player-run-stop-sheet.png | 3 | 64×64 | 192×64 |
| player-turn | player-turn-sheet.png | 3 | 64×64 | 192×64 |
| player-jump-rise | player-jump-rise-sheet.png | 4 | 64×64 | 256×64 |
| player-jump-fall | player-jump-fall-sheet.png | 4 | 64×64 | 256×64 |
| player-wall-jump | player-wall-jump-sheet.png | 3 | 64×64 | 192×64 |
| player-wall-slide-full | player-wall-slide-full-sheet.png | 4 | 64×64 | 256×64 |
| player-dash-full | player-dash-full-sheet.png | 5 | 64×64 | 320×64 |
| player-crouch-enter | player-crouch-enter-sheet.png | 2 | 64×64 | 128×64 |
| player-crouch-slide-full | player-crouch-slide-full-sheet.png | 4 | 64×64 | 256×64 |

---

## Pass Criteria

- [ ] All 12 new asset prompts added to `ASSET_PROMPTS` in `generate-assets.ts`
- [ ] Each prompt uses `referenceImage: "player-idle.png"` and `category: "player"`
- [ ] Running `npx tsx scripts/generate-assets.ts --category player --dry-run` lists all 12 new assets
- [ ] Running `npx tsx scripts/generate-assets.ts --category player` generates all 12 images to `public/assets/`
- [ ] All 12 files exist in `public/assets/` with the correct filenames
- [ ] Character appearance is consistent across sheets (reference image used for all)
- [ ] `npx tsc --noEmit` passes
- [ ] Existing player sprite sheets (9 original) are NOT modified or overwritten

---

## Important Notes

- The generation pipeline is **idempotent** — it skips existing files. Use `--force` to regenerate specific assets if needed.
- Generation uses the `gemini-2.5-flash-image` model via Nano Banana API
- All prompts pass `player-idle.png` as reference image for character consistency — this file MUST exist before running generation. If it doesn't exist, generate it first: `npx tsx scripts/generate-assets.ts --force` with just the player-idle prompt, or generate all player assets in one go.
- The pipeline supports `--concurrency N` (default 5) for parallel generation
- Rate limiting is handled automatically with exponential backoff
- If generation fails for some sheets, simply re-run the command — it will only generate missing files
- Generated images may not have pixel-perfect frame alignment. The `AssetManager` placeholder system handles this gracefully — if a sheet loads but frames don't look right, it can be regenerated with `--force`.
- This task does NOT modify `PlayerSprites.ts` or `Player.ts` — that's Task 3 (player-sprite-integration).

---

## Review Notes

**Reviewer:** a6351d1c
**Verdict:** No issues found

- All 12 new `AssetPrompt` entries are correctly placed after the original 9 player sheets (lines 124–220)
- All entries consistently use `referenceImage: "player-idle.png"`, `category: "player"`, `aspectRatio: "16:9"`, and `PLAYER_STYLE`/`PLAYER_CHARACTER_DESC`
- No duplicate IDs across all 118 asset prompts
- All 12 generated PNG files present in `public/assets/`
- `npx tsc --noEmit` passes cleanly
- Original 9 player sprite sheets are untouched
- No fixes needed
