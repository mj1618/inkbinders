# Task: Visual Test — Combat Pages

## Summary

Create visual test scripts for the 5 combat test pages and execute them using browser MCP tools to verify rendering correctness. If browser MCP is unavailable, create the documented test procedure as a runnable playbook and verify via HTTP/HTML structural checks.

## What to Build

### 1. Visual Test Playbook

Create `scripts/visual-tests/combat.md` — a markdown playbook documenting the visual test procedure for all 5 combat-related test pages.

### 2. Execute the Tests (if browser MCP available)

For each of these 5 pages, perform the following using browser MCP tools:

**Pages to test:**
1. `http://localhost:3000/test/combat-melee`
2. `http://localhost:3000/test/enemies`
3. `http://localhost:3000/test/boss/footnote-giant`
4. `http://localhost:3000/test/boss/misprint-seraph`
5. `http://localhost:3000/test/boss/index-eater`

**For each page:**
1. Navigate to the URL with `browser_navigate`
2. Wait 2 seconds for the page to load (canvas element should be present)
3. Take an initial screenshot — note any issues (blank canvas, missing elements, JS errors)
4. Verify these elements are present:
   - A `<canvas>` element (the game canvas)
   - A debug panel sidebar (React component with sliders)
   - Page title/header with navigation back to `/test`
   - Pass criteria section (below or beside the canvas)
5. Simulate player input:
   - Press Arrow Right for ~1 second (player should run right)
   - Press J (attack with quill-spear)
   - Press K (switch to ink snap weapon)
   - Press J again (attack with ink snap)
   - For boss pages: move toward boss to trigger fight
6. Take a post-interaction screenshot
7. Verify the canvas is not blank (something rendered — player rect, platforms, enemies/boss, debug overlays)

### 3. Test Report

Create a summary listing:
- Each page tested
- Whether it loaded successfully (HTTP 200)
- Whether the canvas rendered content (not blank)
- Whether the debug panel was visible with sliders
- Whether combat-specific UI elements are present (weapon indicator, health bars, diagnostics)
- Any errors or issues observed

## Key Bindings Reference

| Key | Action |
|-----|--------|
| Arrow Left / A | Move Left |
| Arrow Right / D | Move Right |
| Arrow Up / W | Up / Aim Up |
| Arrow Down / S | Down / Aim Down |
| Space / Z | Jump |
| Shift / X | Dash |
| J / Enter | Attack |
| K | Weapon Switch |
| Escape | Pause |

## Page-Specific Test Procedures and Expectations

### `/test/combat-melee`

**Canvas:** 960x540, arena 1920x540

**Key elements to verify:**
- Player (colored rectangle ~32x48) on a multi-platform arena
- 7 target dummies at various positions (colored rectangles with HP bars)
- Weapon indicator near player ("SPEAR" or "SNAP" label)
- FPS counter (bottom-left, screen-space)
- Velocity readout (top-right)
- Combat diagnostics box (bottom-left): State, Weapon, Phase, Cooldown, Hits, Damage

**Debug panel sections (sliders):**
- Combat Info (weapon, phase, cooldown display)
- Quill-Spear Params: Windup Frames, Active Frames, Recovery Frames, Cooldown Frames, Reach, Width, Damage, Knockback, Hitstop, Shake Intensity, Shake Frames
- Ink Snap Params: similar fields
- General Combat: attack-during-dash/wall-slide/hard-landing toggles
- Target Dummies: Respawn All, Reset Damage Counters
- Player Movement: Max Run Speed, Jump Speed, Gravity, Dash Speed

**Interaction sequence:**
1. Press Arrow Right for 30 frames (~0.5s) — run toward nearest dummy
2. Press J — quill-spear attack should show hitbox overlay extending from player
3. Verify: dummy takes damage (floating number appears), knockback, hitstop freeze on dummy
4. Press K — weapon switches to ink-snap (indicator changes)
5. Press J — ink-snap burst, auto-aim circle visible
6. Press Arrow Up + J — directional attack aiming (hitbox shifts up)
7. Screenshot: verify hitbox overlays, damage numbers, weapon switching all visible

**Pass criteria to verify on page:**
- J attacks with spear, hitbox extends from player
- Hitbox follows player through movement
- Dummy takes damage, hitstop on dummy, knockback after hitstop
- Screen shake on hit, hit particles
- Attack while running/jumping/wall-sliding/dashing all work
- 8-directional aiming
- K switches to ink snap, snap auto-aims
- Cooldown prevents spam
- Floating damage numbers visible
- All params tunable via sliders

---

### `/test/enemies`

**Canvas:** 960x540, arena 2880x540

**Key elements to verify:**
- Player with health HUD (top area)
- 3 arena sections separated by walls:
  - Arena 1: Reader Rush — 4 Reader enemies (small, fast, patrol)
  - Arena 2: Binder Trap — 3 Binder enemies (thread/grapple mechanics)
  - Arena 3: Proofwarden Gauntlet — 2 Proofwarden enemies (shield + slam)
- Enemy hitbox outlines colored by type
- Detection range circles (dashed, semi-transparent)
- Weapon indicator (top-right)
- Kills counter (top-right)
- FPS counter

**Debug panel sections (sliders):**
- Combat Info: Health, Weapon, Attack phase, Alive count, Kills, Damage taken
- Reader Params: Health, Move Speed, Chase Speed, Detection Range, Attack Range, Lunge Speed/Duration/Recovery, Contact Damage
- Binder Params: Health, Detection Range, Thread Range/Min/Speed/Cooldown, Pull Duration, Thread Damage
- Proofwarden Params: Health, Move Speed, Chase Speed, Detection Range, Slam Windup/Active/Recovery/Damage, Shield Block Angle
- Player Health Params: Max Health, I-Frames, Knockback Speed, Dash I-Frames toggle
- Controls: Respawn All Enemies, Reset Player Health, Toggle Enemy AI, Toggle Detection Range

**Interaction sequence:**
1. Press Arrow Right — run toward Reader enemies
2. Wait ~1s — Readers should detect player and start chasing
3. Press J — attack a Reader (should take damage, knockback)
4. Press J again — kill the Reader (2 hits, should die)
5. Continue right toward Binder section
6. Wait — Binder should fire thread toward player
7. Press Shift (dash) — should break Binder thread
8. Continue right toward Proofwarden
9. Press J — attack should be blocked if hitting shield (front)
10. Run past Proofwarden, turn and attack from behind
11. Screenshot: verify enemy variety, AI behaviors, health HUD

**Pass criteria (20 checkpoints on page):**
- Reader patrols, detects player, chases, lunges, deals contact damage, takes knockback, dies & respawns
- Binder fires thread, thread pulls player, dash breaks thread, Binder can be attacked
- Proofwarden shield blocks frontal attacks, vulnerable from behind, slam telegraph, slam damage
- Player takes damage with i-frames, dash i-frames, health HUD displays
- All params tunable

---

### `/test/boss/footnote-giant`

**Canvas:** 960x540, arena 1280x540

**Key elements to verify:**
- Boss (large entity, 128x128 area, stacked glyph visual)
- Boss health bar (screen-space, top of canvas)
- Player health HUD (screen-space)
- Boss diagnostics box (bottom-left): Player State, Health, Weapon, Boss HP, Phase, Boss State, Timer, Attack, Seq Index, Elapsed Time, Damage Dealt
- Phase 2 platforms (blue with glow, or dashed outline when inactive)
- Victory text (appears after boss death)

**Debug panel sections (sliders):**
- Boss Info: HP, Phase, State
- Boss Health & Phases: Max Health, Phase 2/3 Thresholds, Phase Transition Duration, Invuln Between Attacks
- Pillar Slam: Telegraph Frames, Slam Damage, Stuck Duration, Recovery Frames, Shockwave Height/Speed/Range
- Ink Rain: Telegraph Frames, Duration, Blot Count, Size, Fall Speed
- Citation Stamp: Telegraph/Damage/Shockwave/Recovery params
- Footnote Sweep: Telegraph/Damage/Height/Speed/Recovery params
- Controls: Restart Fight, Skip to Phase 2/3, Toggle Invincible, Toggle Boss AI, Show/Hide Overlays

**Interaction sequence:**
1. Run toward boss — boss should start attacking
2. Wait for Pillar Slam telegraph (visual telegraph before attack)
3. Dodge slam, attack boss during PILLAR_STUCK vulnerable state
4. Verify: floating damage numbers, boss HP decreases on health bar
5. Use "Skip to Phase 2" button in debug panel
6. Screenshot: verify Phase 2 platforms appear, new attack patterns
7. Use "Skip to Phase 3" button
8. Screenshot: verify Phase 3 attacks, death animation on defeat

**Pass criteria to verify on page:**
- Boss renders with stacked glyphs
- Health bar visible at top
- Pillar slam telegraph → slam → shockwave → stuck (vulnerable)
- Invulnerable during non-vulnerable states (clang effect)
- Ink rain falls from above
- Phase transitions at HP thresholds
- Phase 2: Citation Stamp, Phase 3: Footnote Sweep
- Boss death animation
- Victory text displays
- All params tunable, debug overlays toggleable
- Restart Fight resets everything

---

### `/test/boss/misprint-seraph`

**Canvas:** 960x720 (taller than standard)

**Key elements to verify:**
- Boss (hovering entity with bob animation, wing-like visuals)
- Boss health bar (screen-space, top — only shows after fight starts)
- Player health HUD
- Boss diagnostics box: Player State, Health, Weapon, Boss HP, Phase, Boss State, Timer, Attack, Hover Point, Corrupted Floor, Vulnerable status, Elapsed Time, Damage Dealt
- Corrupted floor overlay (red-tinted, Phase 2)
- Phase 2 platforms (red with pink outline)
- Dark purple-tinted background
- Victory text after defeat

**Debug panel sections (sliders):**
- Boss Info: HP, Phase, State, Attack, Hover Point, Corrupted Floor, Vulnerable
- Boss Health & Phases: Max Health, Phase 2/3 Thresholds
- Ink Beam: Beam Telegraph, Duration, Width, Damage
- Page Barrage: Page Count, Stagger Duration
- Dive Slash: Dive Speed, Dive Recovery
- Page Storm: Storm Page Count
- Desperation Slam: Collapse Duration
- Fight Controls: Start Fight, Retry, Skip to Phase 2/3, Toggle Boss AI, Toggle Godmode, Show/Hide Overlays

**Interaction sequence:**
1. Press "Start Fight" button (boss may require manual trigger)
2. Boss begins hovering and attacking
3. Wait for Ink Beam — verify sweep animation across arena
4. Press Shift (dash) through beam to test i-frames
5. Wait for Page Barrage — boss should stagger = punish window
6. Attack during stagger
7. Skip to Phase 2 — verify corrupted floor (red overlay) and dive slash attacks
8. Skip to Phase 3 — verify triple beam, rapid dive, desperation slam
9. Screenshot: verify boss visuals, health bar, phase transitions, damage numbers

**Pass criteria to verify on page:**
- Boss hovers with bob animation
- Teleport fade effect
- Ink Beam sweeps across arena
- Beam damage on hit, dash through beam (i-frames)
- Page Barrage → stagger = punish window
- Phase 2: corrupted floor damage zone, dive slash, page storm
- Phase 3: triple beam, rapid dive, desperation slam
- Death animation
- Health bar HUD
- All params tunable, retry resets fight

---

### `/test/boss/index-eater`

**Canvas:** 960x540, arena 1440x640

**Key elements to verify:**
- Boss (ground-mobile entity, wide body, 128x96 area)
- Destructible platforms (6 floor sections, 4 mid-level, 3 high — colored, with cracking indicators when damaged)
- Boss health bar (screen-space, top — after fight starts)
- Player health HUD
- Boss diagnostics box: Player State, Health, Weapon, Boss HP, Phase, Boss State, Timer, Attack, Current Surface, Facing direction, Mouth %, Devoured counter, Vulnerable status, Elapsed Time, Damage Dealt
- Ink flood zones (visual overlay, Phase 2)
- Dark parchment-tinted background (#1a150e)
- Victory text after defeat

**Debug panel sections (sliders):**
- Boss Info: HP, Phase, State, Attack, Current Surface, Facing, Mouth %, Devoured counter, Vulnerable
- Boss Health & Phases: Max Health, Phase 1/2 Thresholds
- Movement: Chase Speed, Climb Speed
- Lunge Bite: Lunge Distance, Recovery
- Chain Whip: Whip Radius
- Devour: Devour Stunned duration
- Drop Pounce: Pounce Speed, Pounce Stunned
- Death Thrash: Impact Count, Collapse Duration
- Auto Crumble: Crumble Interval
- Fight Controls: Start Fight, Retry, Skip to Phase 2/3, Restore All Platforms, Toggle Boss AI, Toggle Godmode, Show/Hide Overlays

**Interaction sequence:**
1. Press "Start Fight" or approach boss
2. Boss patrols floor, chases player
3. Wait for Lunge Bite — telegraph → lunge → recovery (vulnerable)
4. Attack during LUNGE_RECOVERY
5. Observe Chain Whip (damage zone behind boss)
6. Observe Index Spit (3-card fan projectile)
7. Skip to Phase 2 — boss devours floor platforms, ink flood zones appear
8. Verify: platform count decreases, visual cracking on platforms
9. Skip to Phase 3 — boss climbs walls/ceiling, Drop Pounce, Chain Storm, auto-crumble
10. Reduce HP to 3 or below — Death Thrash: boss bounces between surfaces rapidly, then collapses
11. Screenshot: verify destructible platforms, ink flood, wall climbing, devour counter

**Pass criteria to verify on page:**
- Boss patrols floor, chases player
- Lunge Bite (telegraph + lunge + recovery = punish window)
- Chain Whip behind boss
- Index Spit (3-card fan)
- Phase 2: Devour destroys platforms, Ink Flood damage zone
- Phase 3: Wall/ceiling crawl, Drop Pounce, Chain Storm radial
- Death Thrash at HP <= 3 (rapid bouncing → collapse)
- Auto-crumble timer destroys mid/high platforms
- Health bar + devour counter display
- Retry resets everything including destroyed platforms
- All params tunable

---

## Automated Verification (if no browser MCP)

If browser MCP tools are not available, perform structural verification with HTTP/HTML checks:

```bash
#!/bin/bash
# Quick verification script for combat test pages
PAGES=(
  "test/combat-melee"
  "test/enemies"
  "test/boss/footnote-giant"
  "test/boss/misprint-seraph"
  "test/boss/index-eater"
)

for page in "${PAGES[@]}"; do
  echo "=== /$page ==="
  HTML=$(curl -s "http://localhost:3000/$page")

  # Check HTTP response
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/$page")
  echo "  HTTP: $STATUS"

  # Check for canvas element
  echo "$HTML" | grep -q '<canvas' && echo "  Canvas: YES" || echo "  Canvas: NO"

  # Count slider inputs
  SLIDERS=$(echo "$HTML" | grep -c 'type="range"')
  echo "  Sliders: $SLIDERS"

  # Check for back link to /test
  echo "$HTML" | grep -q '/test' && echo "  Back link: YES" || echo "  Back link: NO"

  # Check for pass criteria
  echo "$HTML" | grep -qi 'pass.*criter\|criteria' && echo "  Pass criteria: YES" || echo "  Pass criteria: NO"

  echo ""
done
```

Also verify TypeScript compiles cleanly:
```bash
npx tsc --noEmit
```

## Prerequisites

- Dev server running at `http://localhost:3000`
- If not running, start with: `cd /Users/matt/code/inkbinders && npm run dev`

## Files to Create

- `scripts/visual-tests/combat.md` — Visual test playbook for all 5 combat pages

## Verification

- [ ] All 5 pages load without blank canvas or JS errors
- [ ] Each page has a visible canvas with rendered content (player, enemies/boss, platforms)
- [ ] Each page has a debug panel with sliders
- [ ] Combat-specific UI elements present: weapon indicator, health bars (player + boss on boss pages), combat diagnostics
- [ ] Player input causes visible movement and attacks on canvas
- [ ] Boss pages show phase transitions via debug controls
- [ ] Screenshots captured (if browser MCP available)
- [ ] Test report created summarizing results for all 5 pages
- [ ] `scripts/visual-tests/combat.md` playbook created with full procedures

## Notes

- If browser MCP tools are not available, focus on creating the playbook document and performing structural HTTP/HTML verification (same approach as the core-movement visual test task).
- Boss pages may require clicking "Start Fight" or "Retry" buttons before the boss AI activates — this is by design for controlled testing.
- The Misprint Seraph page uses a taller canvas (960x720) — verify this in the HTML.
- All combat is an overlay system — attacking should NOT interrupt the player's movement state. Verify the state label stays as RUNNING/JUMPING even while attacking.
- Floating damage numbers are world-space (move with camera) — they appear near hit points, not in a fixed screen position.

---

## Completion Summary

### What Was Done

1. **TypeScript check:** `npx tsc --noEmit` passes cleanly — no type errors.

2. **Structural verification of all 5 combat pages** (dev server on port 3000):

| Page | HTTP | Canvas | Back Nav | Pass Criteria | Combat Refs | JS Errors | HTML Size |
|------|------|--------|----------|---------------|-------------|-----------|-----------|
| `/test/combat-melee` | 200 | YES | YES | YES | YES | NONE | 32KB |
| `/test/enemies` | 200 | YES | YES | YES | YES | NONE | 26KB |
| `/test/boss/footnote-giant` | 200 | YES | YES | YES | YES | NONE | 33KB |
| `/test/boss/misprint-seraph` | 200 | YES | YES | YES | YES | NONE | 30KB |
| `/test/boss/index-eater` | 200 | YES | YES | YES | YES | NONE | 31KB |

All 5 pages load successfully with canvas elements, back navigation to `/test`, pass criteria sections, and combat-specific content references. No JavaScript error markers found in any page HTML.

3. **Visual test playbook created:** `scripts/visual-tests/combat.md` — comprehensive playbook documenting test procedures for all 5 combat pages, including:
   - Key bindings reference
   - Expected elements for each page (canvas dimensions, debug panel sections, HUD elements)
   - Step-by-step interaction sequences
   - Pass criteria checklists (14 + 20 + 12 + 10 + 13 = 69 total criteria)
   - Automated structural verification script
   - Combat system notes (overlay pattern, weapon switching, hitstop behavior)

4. **Browser MCP not available** — used HTTP/HTML structural checks per the fallback approach. All pages verified via curl with status codes, element presence, and error marker checks.

### Files Changed
- **Created:** `scripts/visual-tests/combat.md` — Visual test playbook for all 5 combat pages
- **Modified:** This file (completion summary appended)

### Issues Found
- None. All 5 pages load cleanly with expected structural elements.

---

## Review Notes (Reviewer: b79453a2)

**Reviewed:** `scripts/visual-tests/combat.md` and all 5 referenced combat test pages.

**TypeScript check:** `npx tsc --noEmit` passes cleanly.

**Playbook quality:** The visual test playbook is comprehensive and accurate:
- Canvas dimensions match actual page code (960x540 standard, 960x720 for Misprint Seraph)
- Arena dimensions correctly documented (1920, 2880, 1280, 1280, 1440)
- Debug panel sections and slider counts accurately described for each page
- Interaction sequences are thorough and well-ordered
- Pass criteria checklists (14 + 20 + 12 + 10 + 13 = 69 total) match the actual page implementations
- Automated verification script is correct
- Combat system notes (overlay pattern, weapon switching, hitstop) are accurate

**Pre-existing issue noted (not from this task):**
- `src/app/test/enemies/page.tsx:604` calls `screenShake.update()` inside the render callback instead of the update callback, making screen shake frame-rate dependent. This was not introduced by this task.

**Fixes applied:** None needed. The playbook is well-written and accurately reflects the test pages.

**Verdict:** PASS
