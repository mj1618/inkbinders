---
status: in-progress
---
# Epic 002: Full Asset Creation

## Tasks

- [ ] asset-toggle-system — Global render-mode toggle (sprites vs rectangles) wired into all renderers
- [ ] player-sprite-expansion — Full player sprite sheets for all 10 states
- [ ] enemy-sprites — Sprite sheets for Reader, Binder, and Proofwarden enemies
- [ ] boss-sprites — Sprite sheets for Footnote Giant, Misprint Seraph, and Index Eater
- [ ] tile-sprites-all-biomes — Tile/platform sprite sheets for all 5 biomes + Scribe Hall
- [ ] biome-backgrounds — Parallax background art for each biome
- [ ] ability-vfx-sprites — Sprite-based VFX for all 4 abilities
- [ ] combat-vfx-sprites — Sprite-based VFX for weapons, hits, and damage numbers
- [ ] hud-and-ui-sprites — HUD icons, card art, menu art, and UI elements
- [ ] world-object-sprites — Vines, obstacles, gates, exits, pickups, and environmental props
- [ ] asset-generation-pipeline — Expand generate-assets.ts to cover all new asset prompts
- [ ] asset-integration-polish — Final pass: defaults, fallback placeholders, loading screen

## Goal

Create hand-inked art assets for every visual element in Inkbinders, and make them fully optional. The game must remain 100% playable with the existing colored-rectangle rendering (the current state). Assets enhance the visuals but never gate functionality.

---

## Context

### What exists today

- `AssetManager` singleton loads sprite sheets with automatic placeholder fallback (colored rectangles with frame numbers when real images are missing)
- `SpriteSheet` + `AnimationController` handle frame slicing and animation playback
- `PlayerSprites.ts` defines 3 sprite sheet configs (idle, run, jump) and maps player states to animations
- `scripts/generate-assets.ts` has 5 asset prompts (player-idle, player-run, player-jump, tiles-scribe-hall, tiles-herbarium) using Nano Banana API (Gemini image gen)
- `/test/sprites` page has a 3-way render mode toggle (sprites / rectangles / both)
- No actual image files exist yet in `public/assets/` — everything currently renders as placeholders or raw canvas drawing

### Design constraints

- **All assets are optional.** The `AssetManager` already generates colored-rectangle placeholders when images are missing. This epic extends that pattern everywhere.
- **Test pages default to rectangles** (current behavior), with a toggle to enable sprites. This keeps test pages fast and deterministic for debugging.
- **The main game (`/play`) defaults to sprites** (with placeholder fallback if images aren't generated yet).
- **Art style:** Hand-inked lineart + soft watercolor wash fill, paper grain texture, limited palette per biome (4–6 colors), chunky readable silhouettes. Style lock prompt prefix: `"hand-inked 2D game art, clean linework, watercolor wash fill, paper grain texture, high readability, metroidvania sprite, cohesive style, no text"`

---

## Tasks

### Task 1: Asset Toggle System

**Goal:** Create a global `RenderMode` system that every renderer checks before drawing, so any part of the game can switch between sprite and rectangle rendering.

**Files to create/modify:**
- `src/engine/core/RenderConfig.ts` (new) — `RenderConfig` class with `mode: "sprites" | "rectangles" | "both"` and a global accessor
- `src/engine/entities/Player.ts` (modify) — check `RenderConfig.mode` in `render()`; if sprites, use `AnimationController`; if rectangles, draw the existing colored rect
- `src/engine/entities/Enemy.ts` (modify) — same pattern
- `src/engine/entities/bosses/*.ts` (modify) — same pattern
- All test pages (modify) — add a "Render Mode" toggle to each debug panel, defaulting to `"rectangles"`
- `src/app/play/page.tsx` (modify) — default to `"sprites"`
- `src/app/test/sprites/page.tsx` (modify) — refactor to use the shared `RenderConfig` instead of local state

**Behavior:**
- `RenderConfig.getMode()` returns the current mode
- `RenderConfig.setMode(mode)` updates it (called from React via ref, same pattern as params)
- When `mode === "rectangles"`: all entities draw colored rects as they do today — zero visual change from current behavior
- When `mode === "sprites"`: entities use their `AnimationController` + `SpriteSheet` — falls back to placeholder if no real image
- When `mode === "both"`: draw sprite first, then semi-transparent rectangle overlay (for debugging alignment)

**Pass criteria:**
- Every test page has a render mode toggle in its debug panel
- Switching to "rectangles" produces the exact same visuals as the game does today
- Switching to "sprites" shows placeholder sprites (colored rects with frame numbers) until real assets are generated
- The `/play` page defaults to "sprites"

---

### Task 2: Player Sprite Expansion

**Goal:** Define sprite sheet configs and animation mappings for all 10 player states, expanding beyond the current 3 sheets.

**Files to create/modify:**
- `src/engine/entities/PlayerSprites.ts` (modify) — add new sprite sheet configs and animations
- `scripts/generate-assets.ts` (modify) — add prompts for new player sheets

**New sprite sheets:**
| Sheet ID | Frames | Size | States |
|----------|--------|------|--------|
| `player-idle` | 4 | 64×64 | Idle (breathing loop) |
| `player-run` | 6 | 64×64 | Running |
| `player-jump` | 3 | 64×64 | Jumping (rise), Falling, Wall Jumping |
| `player-dash` | 3 | 64×64 | Dashing (wind-up, dash, trail) |
| `player-wall-slide` | 2 | 64×64 | Wall Sliding (grip, slide) |
| `player-crouch` | 2 | 64×64 | Crouching, Crouch Sliding |
| `player-land` | 3 | 64×64 | Hard Landing (impact, recover, stand) |
| `player-attack-spear` | 4 | 96×64 | Quill-spear attack (wider frames for reach) |
| `player-attack-snap` | 3 | 64×64 | Ink-snap burst |

**Updated STATE_TO_ANIMATION mapping:**
- IDLE → player-idle / idle
- RUNNING → player-run / run
- JUMPING → player-jump / jump-rise
- FALLING → player-jump / jump-fall
- WALL_SLIDING → player-wall-slide / wall-slide
- WALL_JUMPING → player-jump / jump-rise
- DASHING → player-dash / dash
- CROUCHING → player-crouch / crouch
- CROUCH_SLIDING → player-crouch / crouch-slide
- HARD_LANDING → player-land / hard-land

**Pass criteria:**
- All 10 states have dedicated animation mappings
- Placeholder sprites render correctly for each state (frame numbers visible)
- Attack animations overlay correctly during combat states

---

### Task 3: Enemy Sprites

**Goal:** Sprite sheets and animation controllers for all 3 enemy types.

**Files to create/modify:**
- `src/engine/entities/enemies/EnemySprites.ts` (new) — sprite configs + animations for all enemy types
- `src/engine/entities/enemies/Reader.ts` (modify) — integrate AnimationController
- `src/engine/entities/enemies/Binder.ts` (modify) — integrate AnimationController
- `src/engine/entities/enemies/Proofwarden.ts` (modify) — integrate AnimationController

**Sprite sheets per enemy:**
| Enemy | Sheets | Frames | Notes |
|-------|--------|--------|-------|
| Reader | idle (2f), rush (4f), hit (2f), death (3f) | 48×48 | Fast, small, swarm-type |
| Binder | idle (2f), grapple-extend (3f), grapple-retract (2f), hit (2f), death (3f) | 64×64 | Thread/tendril animations |
| Proofwarden | idle (2f), shield-up (2f), shield-break (3f), attack (3f), hit (2f), death (3f) | 64×64 | Shield glow effect |

**Pass criteria:**
- Each enemy has a working AnimationController that switches between states
- RenderConfig "rectangles" mode draws the existing colored rects
- RenderConfig "sprites" mode draws sprite frames (placeholder until generated)
- Enemy death animation plays before removal

---

### Task 4: Boss Sprites

**Goal:** Sprite sheets and animation controllers for all 3 bosses.

**Files to create/modify:**
- `src/engine/entities/bosses/BossSprites.ts` (new) — sprite configs for all bosses
- `src/engine/entities/bosses/FootnoteGiant.ts` (modify) — integrate sprites
- `src/engine/entities/bosses/MisprintSeraph.ts` (modify) — integrate sprites
- `src/engine/entities/bosses/IndexEater.ts` (modify) — integrate sprites

**Sprite sheets per boss:**
| Boss | Key sheets | Frame size | Notes |
|------|-----------|------------|-------|
| Footnote Giant | idle (4f), stomp (4f), sweep (4f), vulnerable (2f), death (4f) | 128×128 | Large, heavy animations |
| Misprint Seraph | hover (4f), dive (3f), glyph-cast (4f), stagger (2f), death (4f) | 128×128 | Floaty, wing-flap emphasis |
| Index Eater | crawl (4f), lunge (3f), devour (4f), spit (3f), stunned (2f), death (4f) | 128×96 | Ground-bound, wide body |

**Pass criteria:**
- Boss state machine transitions drive animation changes
- Attack hazard zones align with sprite frames
- Vulnerable state is visually distinct in sprite mode
- Phase transitions trigger appropriate animation changes

---

### Task 5: Tile Sprites — All Biomes

**Goal:** Platform/tile sprite sheets for every biome so platforms render as themed tiles instead of flat colored rectangles.

**Files to create/modify:**
- `src/engine/world/TileSprites.ts` (new) — tile sprite configs keyed by biome ID
- `src/engine/physics/TileMap.ts` (modify) — check RenderConfig; if sprites, draw tile sprites; if rectangles, draw current colored rects
- `scripts/generate-assets.ts` (modify) — add tile prompts

**Tile sheets (4 tiles per biome, 32×32 each):**
| Biome | Tiles | Palette |
|-------|-------|---------|
| Scribe Hall | wood floor, shelf block, stone wall, wooden beam | Warm brown/gold |
| Herbarium Folio | vine stone floor, mossy block, leaf column, thorn hedge | Deep green/parchment |
| Astral Atlas | star-glass floor, constellation block, nebula pillar, void edge | Deep purple/silver |
| Maritime Ledger | driftwood plank, coral block, barnacle pillar, kelp wall | Teal/sand |
| Gothic Errata | cracked stone floor, gargoyle block, iron column, fog grate | Dark gray/crimson |

**Surface type variants:** Each biome's floor tile gets recolored variants for bouncy (cyan tint), icy (blue tint), sticky (amber tint), conveyor (green tint with arrow).

**Pass criteria:**
- Each biome's platforms render with themed tiles when in sprite mode
- Surface type variants are visually distinct
- Rectangle mode renders the existing colored rects unchanged
- Tiles tile seamlessly at platform edges

---

### Task 6: Biome Backgrounds

**Goal:** Multi-layer parallax background images for each biome to replace the procedural `BiomeBackground` canvas drawing.

**Files to create/modify:**
- `src/engine/world/BiomeBackgroundSprites.ts` (new) — background image configs per biome
- `src/engine/world/BiomeBackground.ts` (modify) — check RenderConfig; if sprites, draw image layers; if rectangles, use current procedural drawing

**Background layers per biome (3 layers each):**
| Biome | Far (0.1) | Mid (0.3) | Near (0.6) |
|-------|-----------|-----------|------------|
| Scribe Hall | Distant bookshelves, warm glow | Candelabras, reading desks | Hanging scrolls, ink bottles |
| Herbarium Folio | Ruled lines, faint leaf silhouettes | Stems and leaf outlines | Vine tendrils (current procedural as reference) |
| Astral Atlas | Star field, distant galaxies | Floating constellation charts | Drifting astral pages |
| Maritime Ledger | Distant harbor, lighthouses | Moored ships, rope rigging | Wave spray, floating cargo |
| Gothic Errata | Cathedral spires, dark sky | Broken stained glass | Drifting fog wisps, gargoyles |

**Image size:** 960×540 per layer (canvas size), tiled horizontally for rooms wider than one screen.

**Pass criteria:**
- Each biome renders 3 parallax layers at correct scroll speeds
- Layers tile seamlessly when camera pans
- Rectangle mode uses the existing procedural backgrounds unchanged

---

### Task 7: Ability VFX Sprites

**Goal:** Sprite-based visual effects for all 4 abilities, replacing the current particle-only effects.

**Files to create/modify:**
- `src/engine/abilities/AbilitySprites.ts` (new) — VFX sprite configs for each ability
- `src/engine/abilities/MarginStitch.ts` (modify) — render stitch line sprite when active
- `src/engine/abilities/Redaction.ts` (modify) — render ink splash / redaction mark sprite
- `src/engine/abilities/PasteOver.ts` (modify) — render surface paste glow sprite
- `src/engine/abilities/IndexMark.ts` (modify) — render bookmark sprite at mark positions

**VFX sprites:**
| Ability | Sprites | Notes |
|---------|---------|-------|
| Margin Stitch | stitch-line (4f glow pulse), needle-flash (3f activation burst) | Animated glow along the passage |
| Redaction | ink-splat (4f expanding blot), ink-drip (3f dripping), redaction-bar (2f pulsing strike-through) | Blot expands over the target |
| Paste-Over | surface-glow (4f colored pulse matching surface type), copy-swoosh (3f clipboard capture) | Color matches the pasted surface |
| Index Mark | bookmark (1f per color × 4 colors), teleport-flash (4f in/out burst), selection-ring (4f spinning) | Bookmark sits at mark position |

**Pass criteria:**
- Abilities show sprite VFX when in sprite mode
- Abilities show current particle effects when in rectangle mode
- VFX align with ability activation timing and positions
- Index Mark bookmarks render as colored bookmark sprites at placed positions

---

### Task 8: Combat VFX Sprites

**Goal:** Sprite-based visual effects for weapon attacks, hits, and damage feedback.

**Files to create/modify:**
- `src/engine/combat/CombatSprites.ts` (new) — VFX sprite configs
- `src/engine/combat/CombatSystem.ts` (modify) — render weapon swing sprites during active phase
- `src/engine/combat/TargetDummy.ts` (modify) — render hit flash sprite

**VFX sprites:**
| Element | Sprites | Notes |
|---------|---------|-------|
| Quill-spear swing | slash-arc (3f directional sweep) | Follows hitbox position, 8-dir flip |
| Ink-snap burst | snap-burst (3f expanding ring) | Centered on auto-aim target |
| Hit impact | hit-flash (3f star burst), hit-sparks (2f scatter) | At point of contact |
| Damage number | — (keep existing floating text) | No sprite needed |
| Hitstop flash | white-flash (1f full-entity overlay) | On the frozen enemy |

**Pass criteria:**
- Weapon swing sprite aligns with hitbox during active phase
- Hit impact sprite appears at point of contact
- Rectangle mode shows the existing hitbox outlines as today

---

### Task 9: HUD & UI Sprites

**Goal:** Polished art for HUD elements, ink card art, and menu visuals.

**Files to create/modify:**
- `src/engine/ui/HUDSprites.ts` (new) — HUD icon sprite configs
- `src/engine/ui/GameHUD.ts` (modify) — draw sprite icons when available, fall back to canvas-drawn icons
- `src/engine/cards/CardRenderer.ts` (modify) — draw card art from sprites when available
- `src/app/page.tsx` (modify) — use title art sprite if available, fall back to text

**Sprites:**
| Element | Size | Notes |
|---------|------|-------|
| Health heart (full, half, empty) | 16×16 | Replaces red bar |
| Ability icons × 4 | 32×32 | One per ability, replaces canvas-drawn glyphs |
| Weapon icons × 2 | 32×32 | Quill-spear, ink-snap |
| Sun/moon icons | 16×16 | For day/night clock |
| Card category icons × 5 | 24×24 | Swiftness, Might, Resilience, Precision, Arcana |
| Card frame art × 3 tiers | 80×110 | Ornate card borders per tier |
| Title logo | 480×120 | "INKBINDERS" hand-lettered |
| Menu button backgrounds | 200×40 | Ink-wash button shape |

**Pass criteria:**
- HUD elements use sprites when available, gracefully fall back to canvas-drawn versions
- Card renderer shows card art in sprite mode, current colored rectangles in rectangle mode
- Title screen shows logo art in sprite mode, text title in rectangle mode

---

### Task 10: World Object Sprites

**Goal:** Sprites for all interactive and decorative world objects.

**Files to create/modify:**
- `src/engine/world/WorldObjectSprites.ts` (new) — sprite configs for world objects
- `src/engine/world/VineSystem.ts` (modify) — render vine rope + anchor as sprites
- `src/engine/physics/Obstacles.ts` (modify) — render obstacles (spikes, barriers, lasers) as sprites
- `src/engine/world/Room.ts` or `RoomRenderer.ts` (modify) — render gates, exits, spawn markers as sprites

**Sprites:**
| Object | Frames | Size | Notes |
|--------|--------|------|-------|
| Vine rope | 1f | 8×variable | Stretchy 9-slice or tiled vertically |
| Vine anchor | 2f (idle, active) | 32×32 | Glowing when in range |
| Spikes | 1f per direction (up, down, left, right) | 32×32 | Pointy, inked |
| Barrier | 1f | 32×variable | Tiled vertically, dark ink block |
| Laser | 2f (pulse) | variable×8 | Horizontal beam |
| Ability gate | 1f per ability color (4 colors) | 16×96 | Glowing barrier |
| Exit indicator | 2f (pulse) | 32×32 | Directional arrow, subtle glow |
| Gravity well | 4f (pulse) | 128×128 | Concentric rings, replaces canvas drawing |
| Current zone arrows | 2f (flow) | 32×32 | Directional flow indicators |
| Fog particles | 2f (drift) | 16×16 | Wispy fog element |

**Pass criteria:**
- World objects render as sprites when in sprite mode
- Rectangle mode renders current canvas-drawn versions unchanged
- Vine rope stretches correctly between anchor and player during swing
- Gate sprites match ability colors

---

### Task 11: Asset Generation Pipeline Expansion

**Goal:** Expand `scripts/generate-assets.ts` to generate all assets defined in Tasks 2–10.

**Files to modify:**
- `scripts/generate-assets.ts` — add all new asset prompts, organized by category

**Requirements:**
- Group prompts by category (player, enemies, bosses, tiles, backgrounds, vfx, ui, world-objects)
- Support `--category <name>` CLI flag to generate only one category (e.g., `npx tsx scripts/generate-assets.ts --category player`)
- Support `--list` flag to show all assets and their status (exists / missing)
- Keep the idempotent behavior (skip existing files)
- Add a `--force` flag to regenerate existing files
- Rate limit: 1 second delay between API calls (already exists)
- Each prompt includes the style prefix and specific size/layout instructions
- Estimated total: ~50–60 individual image files

**Pass criteria:**
- `npx tsx scripts/generate-assets.ts --list` shows all assets with status
- `npx tsx scripts/generate-assets.ts --category player` generates only player assets
- Running without flags generates all missing assets
- Each generated image is placed in `public/assets/` with the correct filename

---

### Task 12: Asset Integration Polish

**Goal:** Final integration pass ensuring everything works end-to-end with graceful fallbacks.

**Files to modify:**
- All renderers — verify fallback behavior when images are missing
- `src/engine/core/AssetManager.ts` — extend placeholder colors for all new asset categories
- `src/app/play/page.tsx` — loading screen shows asset load progress
- All test pages — verify toggle works correctly

**Requirements:**
- Loading screen on `/play` shows progress bar: "Loading assets... 12/47"
- If an asset fails to load, the placeholder is used silently (no console errors flooding)
- `AssetManager.getLoadProgress()` returns `{ loaded: number, total: number }`
- Placeholder color palette expanded: player=#f472b6, enemies=#ef4444, bosses=#8b5cf6, tiles=#8b7355, vfx=#fbbf24, ui=#60a5fa, world=#10b981
- Every test page's debug panel has a "Render Mode" section at the top (consistent placement)

**Pass criteria:**
- Game is fully playable at `/play` with zero assets in `public/assets/` (all placeholders)
- Game is fully playable at `/play` with all assets generated (all sprites)
- Every test page toggles cleanly between rectangles and sprites
- No console errors when assets are missing
- Loading progress is shown on the play page

---

## Ordering & Dependencies

```
Task 1 (toggle system)        — prerequisite for all other tasks
Tasks 2–10                     — depend on Task 1, independent of each other (parallel)
Task 11 (pipeline expansion)   — depends on Tasks 2–10 (needs all sprite configs defined)
Task 12 (integration polish)   — depends on all above (final pass)
```

Recommended execution order:
1. **Wave 1**: Task 1 — asset toggle system
2. **Wave 2** (parallel): Tasks 2, 3, 4, 5, 6, 7, 8, 9, 10 — all sprite definitions + renderer integration
3. **Wave 3**: Task 11 — expand generation pipeline
4. **Wave 4**: Task 12 — final polish pass

---

## Success Criteria

- [ ] Every entity (player, enemies, bosses) renders with sprites or rectangles based on RenderConfig
- [ ] Every biome has themed tile sprites and parallax backgrounds
- [ ] All abilities and combat have VFX sprites
- [ ] HUD elements have sprite icons with canvas-drawn fallbacks
- [ ] World objects (vines, obstacles, gates) have sprites
- [ ] `scripts/generate-assets.ts --list` shows all ~50–60 assets
- [ ] Game runs identically with zero assets (full placeholder mode)
- [ ] All test pages have a render mode toggle defaulting to rectangles
- [ ] The `/play` page defaults to sprites with loading progress
- [ ] No new runtime errors when assets are missing

---

## Notes

- The `AssetManager` placeholder system is the key enabler — it already generates colored-rect placeholders when images fail to load. This epic extends that pattern to every renderer.
- Sprite sheets should use power-of-2 friendly sizes where possible for GPU texture efficiency, but this isn't critical for Canvas 2D.
- The Nano Banana API (Gemini image gen) doesn't always produce pixel-perfect sprite sheets. The generation prompts should emphasize frame layout, but manual touchup may be needed for precise frame alignment.
- Consider adding a `public/assets/manifest.json` that lists all expected assets and their configs — the AssetManager could read this to know what to load.
