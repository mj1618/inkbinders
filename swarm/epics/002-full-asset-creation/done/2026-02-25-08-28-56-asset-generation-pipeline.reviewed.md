# Asset Generation Pipeline Expansion

## Goal

Upgrade `scripts/generate-assets.ts` with proper CLI tooling: category-based generation, asset status display, force-regeneration, and robust error handling. The script already has all 106 asset prompts defined — this task adds the missing CLI features that make the pipeline usable at scale.

---

## Context

### What exists today

**`scripts/generate-assets.ts`** already has:
- 106 `AssetPrompt` entries covering every sprite category (player, enemies, bosses, tiles, backgrounds, ability VFX, combat VFX, HUD/UI, world objects)
- `STYLE_PREFIX` and `BG_STYLE_PREFIX` style lock strings
- `generateAsset()` function that calls Gemini via `@google/genai`, saves PNG to `public/assets/`
- Idempotent behavior (skips existing files)
- 1-second delay between API calls
- `--list` flag that prints all asset IDs and filenames (but no status)
- Subdirectory creation (e.g., `backgrounds/` folder)

**`public/assets/`** has some generated images from previous runs (backgrounds, enemies, combat VFX, HUD, cards).

### What's missing (per epic Task 11)

1. **`--category <name>` flag** — generate only one category (e.g., `--category player`)
2. **`--list` with status** — show exists/missing for each asset
3. **`--force` flag** — regenerate existing files (delete and re-run)
4. **Category grouping** — assets need a `category` field so they can be filtered
5. **Summary output** — show totals (X generated, Y skipped, Z failed)
6. **Better error resilience** — continue on individual failures, report summary at end

---

## Files to Modify

### `scripts/generate-assets.ts`

This is the only file to modify. All changes are within this script.

### Changes

#### 1. Add `category` field to `AssetPrompt`

Add an optional `category` string to the `AssetPrompt` interface:

```typescript
interface AssetPrompt {
  id: string;
  filename: string;
  prompt: string;
  aspectRatio?: string;
  category: string;  // NEW — required
}
```

Categories (matching the epic's terminology):
| Category | IDs prefix | Count |
|----------|-----------|-------|
| `player` | `player-*` | 9 |
| `enemies` | `reader-*`, `binder-*`, `proofwarden-*` | 13 |
| `bosses` | `giant-*`, `seraph-*`, `eater-*` | 16 |
| `tiles` | `tiles-*` | 5 |
| `backgrounds` | `bg-*` | 15 |
| `ability-vfx` | `vfx-*` | 10 |
| `combat-vfx` | `combat-*` | 5 |
| `ui` | `hud-*`, `card-*`, `ui-*` | 20 |
| `world-objects` | `vine-*`, `spikes-*`, `barrier`, `laser-*`, `ability-gate`, `exit-*`, `gravity-*`, `current-*`, `fog-*` | 14 |

Add a `category` field to every entry in `ASSET_PROMPTS`. Group the entries visually with comment headers (many of these already exist — just ensure category fields are present on every object).

#### 2. Implement `--category <name>` filtering

Parse `process.argv` for `--category <name>`. When present, filter `ASSET_PROMPTS` to only include entries matching that category. Example:

```bash
npx tsx scripts/generate-assets.ts --category player    # 9 assets
npx tsx scripts/generate-assets.ts --category enemies   # 13 assets
npx tsx scripts/generate-assets.ts --category bosses    # 16 assets
```

If the category name doesn't match any known category, print available categories and exit.

#### 3. Upgrade `--list` to show status

When `--list` is passed, for each asset check whether the file exists in `public/assets/`. Print with status indicator:

```
=== Inkbinders Assets (106 total, 47 exist, 59 missing) ===

[player] (9 total, 2 exist, 7 missing)
  ✓ player-idle         → player-idle.png
  ✗ player-run          → player-run-sheet.png
  ✗ player-jump         → player-jump-sheet.png
  ...

[enemies] (13 total, 13 exist, 0 missing)
  ✓ reader-idle         → reader-idle-sheet.png
  ...
```

The `--list` flag can be combined with `--category`:
```bash
npx tsx scripts/generate-assets.ts --list --category player
```

#### 4. Add `--force` flag

When `--force` is passed, delete existing files before generating. The existing skip logic checks `fs.existsSync(outputPath)` — when `--force` is true, skip that check (or delete the file first).

Warn the user: `"--force: Will regenerate X existing assets"`

Can combine with `--category`:
```bash
npx tsx scripts/generate-assets.ts --force --category player  # regenerate only player assets
```

#### 5. Add summary output

After generation, print a summary:

```
=== Generation Complete ===
Generated: 12
Skipped (existing): 45
Failed: 1
  - player-dash (API error: rate limit)
Total: 58/106
```

Track results in arrays (`generated`, `skipped`, `failed`) during the run.

#### 6. Better error handling

Currently errors are caught and logged per asset but the script continues. Enhance:
- Track failed asset IDs with error messages
- On completion, if any failed, suggest: `"Re-run with: npx tsx scripts/generate-assets.ts --category <cat> to retry failed assets"`
- Don't exit on individual failures — complete the full batch
- Rate limit: increase delay to 2 seconds if a rate limit error is detected (back off)

#### 7. Add `--dry-run` flag (bonus)

When `--dry-run` is passed, print what would be generated without calling the API:
```
[dry-run] Would generate 7 assets:
  player-run → player-run-sheet.png
  player-jump → player-jump-sheet.png
  ...
```

This is useful for verifying category filtering works correctly.

---

## Implementation Notes

- **Don't change any prompts.** The 106 existing prompts are complete and correct. This task only improves the CLI tooling.
- **Don't change the generation function.** The `generateAsset()` function works. Just add the wrapper CLI logic.
- **Keep it a single file.** No need to split into modules — this is a utility script.
- **CLI parsing**: Simple `process.argv` parsing is fine. No need for a CLI framework like `commander` or `yargs`.

---

## Verification / Pass Criteria

1. **`--list` shows all assets with status**: `npx tsx scripts/generate-assets.ts --list` shows 106 assets grouped by category with exists/missing indicators
2. **`--list` summary is accurate**: Total counts match actual files in `public/assets/`
3. **`--category` filters correctly**: `npx tsx scripts/generate-assets.ts --list --category player` shows only 9 player assets
4. **Invalid category shows help**: `npx tsx scripts/generate-assets.ts --category invalid` prints available categories
5. **`--force` regenerates**: With `--force --category player`, existing player assets are regenerated (deleted then re-created)
6. **`--dry-run` works**: Shows what would be generated without API calls
7. **Summary after generation**: Running without flags shows generation summary (generated/skipped/failed counts)
8. **Error resilience**: If one asset fails, the script continues and reports the failure in the summary
9. **Type-checks**: `npx tsc --noEmit` passes with no new errors
10. **All 106 assets have a `category` field**: No asset is missing the category tag

---

## Run verification commands

```bash
# Verify type-checking
npx tsc --noEmit

# Test --list
npx tsx scripts/generate-assets.ts --list

# Test --list with category
npx tsx scripts/generate-assets.ts --list --category player
npx tsx scripts/generate-assets.ts --list --category enemies

# Test invalid category
npx tsx scripts/generate-assets.ts --category nonexistent

# Test --dry-run
npx tsx scripts/generate-assets.ts --dry-run
npx tsx scripts/generate-assets.ts --dry-run --category tiles

# Don't actually run generation (costs API credits) — just verify CLI works
```

---

## Completion Summary

### Files changed
- `scripts/generate-assets.ts` — the only file modified

### What was built

1. **Added `category` field** to `AssetPrompt` interface (typed as `AssetCategory` union type) and all 106 entries. Categories: `player` (9), `enemies` (13), `bosses` (16), `tiles` (5), `backgrounds` (15), `ability-vfx` (10), `combat-vfx` (5), `ui` (19), `world-objects` (14).

2. **`--category <name>` flag** — filters assets by category. Invalid categories show available options with counts and exit with error code 1.

3. **Upgraded `--list`** — now shows ✓/✗ status for each asset (checks `public/assets/`), grouped by category with per-category and total exist/missing counts. Combinable with `--category`.

4. **`--force` flag** — deletes existing files before regenerating. Shows warning with count of assets to be regenerated. Combinable with `--category`.

5. **`--dry-run` flag** — previews what would be generated without calling the API.

6. **Generation summary** — after generation, prints counts for generated/skipped/failed with details on failures. Suggests re-run command when failures occur.

7. **Improved error handling** — tracks failed asset IDs with error messages, continues on failures, implements exponential backoff (doubles delay up to 10s) on rate limit errors (429 or "rate" in error message).

### Verification results
- `npx tsc --noEmit` — passes clean
- `--list` — shows 106 assets, 92 exist, 14 missing (world-objects not yet generated)
- `--list --category player` — shows 9 player assets, all exist
- `--category nonexistent` — prints available categories and exits
- `--dry-run` — shows 14 world-object assets to generate
- `--dry-run --category tiles` — correctly reports all tiles exist

---

## Review Notes

**Reviewer**: ffeaeb49
**Verdict**: Approved with 3 minor fixes applied

### Fixes made

1. **Fixed UI comment count** (line 460): Comment said "20 total" but there are 19 UI assets. Updated to "19 total".

2. **Improved error propagation from `generateAsset`**: Changed return type from a plain string (`"generated" | "skipped" | "failed"`) to `{ status: "generated" | "skipped" | "failed"; error?: string }`. This bubbles the actual error message into the summary instead of the unhelpful `"see error above"` placeholder. The caller now destructures `{ status, error }` and uses the real error string.

3. **Added backoff reset on success**: The `currentDelay` variable would ratchet up on rate limit errors but never reset. Added `currentDelay = 1000` after a successful generation so the delay returns to normal once rate limits clear.

### What looked good

- All 106 assets have a `category` field with correct `AssetCategory` typing
- Category counts are accurate (9+13+16+5+15+10+5+19+14 = 106)
- CLI flag parsing is clean and all flags compose correctly (`--list --category`, `--force --category`, `--dry-run --category`)
- Error handling continues on individual failures as designed
- Exponential backoff on rate limit errors with a 10s cap
- `npx tsc --noEmit` passes clean after fixes
- All CLI commands verified working after fixes
