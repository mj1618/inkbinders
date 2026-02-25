# Task: Visual Test — Ability Pages

## Summary

Create visual test scripts for the 4 ability test pages and execute them using the browser MCP tools to verify rendering correctness. If browser MCP is unavailable, create the documented test procedure as a runnable playbook.

## What to Build

### 1. Visual Test Playbook

Create `scripts/visual-tests/abilities.md` — a markdown playbook documenting the visual test procedure for the 4 ability test pages.

### 2. Execute the Tests (if browser MCP available)

For each of these 4 pages, perform the following using browser MCP tools:

**Pages to test:**
1. `http://localhost:3000/test/margin-stitch`
2. `http://localhost:3000/test/redaction`
3. `http://localhost:3000/test/paste-over`
4. `http://localhost:3000/test/index-mark`

**For each page:**
1. Navigate to the URL with `browser_navigate`
2. Wait 2 seconds for the page to load (canvas element should be present)
3. Take an initial screenshot → note any issues (blank canvas, missing elements, JS errors)
4. Verify these elements are present:
   - A `<canvas>` element (the game canvas)
   - A debug panel sidebar (React component with sliders)
   - Page title/header with navigation back to `/test`
   - Pass criteria section (below or beside the canvas)
   - Ability-specific info readout in the debug panel
5. Simulate player input to test the ability (page-specific — see below)
6. Take a post-interaction screenshot
7. Verify the canvas is not blank and that the ability activation produced visual feedback

### 3. Test Report

Create a summary listing:
- Each page tested
- Whether it loaded successfully
- Whether the canvas rendered content (not blank)
- Whether the debug panel was visible with ability-specific controls
- Whether the ability key triggered a visible effect
- Any errors or issues observed

## Expected Test Page Structure (All 4 Pages)

Each ability test page has:
- **Canvas**: 960×540 game canvas showing a player (colored rectangle) in a level with ability-specific obstacles/walls
- **Debug panel**: Right-side panel with collapsible sections:
  - Ability Info readout (state, timer, active count)
  - Ability Params sliders (range, duration, cooldown, etc.)
  - Player Movement sliders (collapsed by default)
  - Control buttons (Reset Player, Toggle Debug Overlays)
- **Debug overlays on canvas**: Hitbox outline, velocity vector, state label, FPS counter, ability-specific indicators
- **Header**: Page title, phase badge, link back to `/test`
- **Pass criteria**: Checklist of expected behaviors below the canvas

## Page-Specific Test Procedures

### `/test/margin-stitch`

**Ability key:** E (Ability1)

**Level layout:** Multiple wall pairs (A-D) with varying gap sizes, platforms for navigation, isolated room accessible only through stitch.

**Test steps:**
1. After page loads, take initial screenshot (player should be at left side of level)
2. Press Arrow Right for ~1 second to run player toward the first wall pair (Wall Pair A)
3. Take screenshot — verify player moved and wall pair is visible
4. Press E to activate Margin Stitch — a passage should open in the wall pair
5. Take screenshot — verify visual feedback:
   - Targeting circle appeared around player (range indicator)
   - Wall pair highlights or passage opens (semi-transparent gap)
   - Particles/glow effect visible at stitch location
   - Cooldown indicator below player (orange when active, green when ready)
6. Press Arrow Right to walk through the stitched passage
7. Take screenshot — player should be on the other side of the wall

**Expected visual elements:**
- Range circle (cyan dashed) around player when E key held/pressed
- Highlighted wall pairs within range
- Semi-transparent passage where stitch is active
- Particle effects during stitch opening/closing
- Cooldown bar below player

### `/test/redaction`

**Ability key:** Q (Ability2)

**Level layout:** Spike pits, barriers (solid walls), elevated spikes, overhead laser, out-of-range spikes. Player spawns at left side.

**Test steps:**
1. After page loads, take initial screenshot (player near left side, obstacles visible)
2. Press Arrow Right for ~1.5 seconds to approach the spike pit area
3. Take screenshot — verify obstacles (spikes, barriers) are visible with distinct rendering
4. Press Q to activate Redaction — the nearest obstacle should become redacted
5. Take screenshot — verify visual feedback:
   - Red/orange range circle around player (dashed line)
   - Aim cone overlay showing targeting direction
   - Targeted obstacle highlights/fades (becomes semi-transparent with ink mark)
   - Particles spawning at redaction site
6. Wait ~2 seconds for redaction to be clearly active
7. Take screenshot showing the redacted obstacle in its inactive/ghosted state

**Expected visual elements:**
- Range circle (red dashed) around player
- Aim cone (red semi-transparent sector) in facing direction
- Ink mark expansion animation on targeted obstacle
- Redacted obstacles rendered semi-transparent/ghosted
- HP bar above player (green)
- Invincibility frame flicker (red) if player takes damage

### `/test/paste-over`

**Ability key:** R (Ability3)

**Level layout:** 1920px wide (camera scrolls). 4 zones: Source Surfaces (normal/bouncy/icy/sticky/conveyor platforms), Bounce Challenge, Speed Run Challenge, Wall Grip Challenge. Camera follows player horizontally.

**Test steps:**
1. After page loads, take initial screenshot (Zone 1 with labeled surface platforms visible)
2. Press Arrow Right to move onto the bouncy platform (2nd platform in Zone 1)
3. Take screenshot — verify surface labels are visible on platforms ("bouncy", "icy", etc.)
4. Check that the clipboard display (top-left HUD) shows "bouncy" was auto-captured
5. Press Arrow Right more to reach a normal platform past Zone 1
6. Press R to paste the bouncy surface onto the normal platform
7. Take screenshot — verify visual feedback:
   - Target platform color changes to match pasted surface type
   - Particles spawn at paste location
   - Paste-Over HUD shows active paste count
8. Jump on the pasted platform to verify bounce effect
9. Take screenshot showing player bouncing

**Expected visual elements:**
- Color-coded surface labels on platforms (bouncy=cyan, icy=blue, sticky=amber, conveyor=green)
- Clipboard HUD indicator (top-left) showing captured surface type
- Zone labels (large semi-transparent text)
- Platform color change when paste is active
- Timer indicator showing remaining paste duration

### `/test/index-mark`

**Ability key:** R (Ability3)

**Level layout:** 3840×1080 (4 areas). Starting area with tower, Hazard Corridor, Vertical Shaft, Multi-Mark Puzzle with 4 isolated chambers. Camera follows with smart teleport handling.

**Test steps:**
1. After page loads, take initial screenshot (Starting area visible)
2. Short-press R to place an Index Mark at current position
3. Take screenshot — verify a colored bookmark tab appears at the player's position (amber for first mark)
4. Press Arrow Right for ~2 seconds to move away from the mark
5. Take screenshot — mark should remain visible at its placed position
6. Hold R for ~0.5-1 second to enter teleport selection mode
7. Take screenshot — verify selection beam/indicator appears showing available marks
8. Release R to teleport back to the placed mark
9. Take screenshot — verify player has teleported:
   - Player position matches mark location
   - Trail/flash effect visible during teleport
   - Camera snapped or smoothly transitioned to new position

**Expected visual elements:**
- Colored bookmark tabs at mark positions (amber, blue, green, red cycling)
- Selection beam (dashed line) during hold-to-select
- Teleport flash/trail effect
- Goal zones (colored platforms) in various areas
- Area labels (large semi-transparent text)
- I-frame flicker after teleport (amber)
- Mark count in HUD

## Prerequisites

- Dev server running at `http://localhost:3000`
- If browser MCP is not available, start the dev server with: `cd /Users/matt/code/inkbinders && npm run dev`
- All 4 ability test pages must be accessible (they should exist already from Phase 2 development)

## Verification

- [ ] All 4 pages load without blank canvas or JS errors
- [ ] Each page has a visible canvas with rendered content (player, platforms, obstacles/walls)
- [ ] Each page has a debug panel with ability-specific sliders and info readout
- [ ] Ability key (E/Q/R) triggers a visible effect on canvas
- [ ] Post-ability screenshots show visual feedback (particles, highlights, state changes)
- [ ] Screenshots captured (if browser MCP available)
- [ ] Test report created summarizing results for all 4 pages
- [ ] `scripts/visual-tests/abilities.md` playbook created

## Notes

- If browser MCP tools are not available, focus on creating the playbook document (`scripts/visual-tests/abilities.md`) with detailed step-by-step instructions that can be followed later by an agent with browser access.
- The playbook should specify exact URLs, wait times, key sequences, and expected visual elements for each page.
- Screenshots are for human review — they don't need pixel-perfect matching, just "something rendered" and "ability had a visible effect" verification.
- Key bindings: Arrow keys = movement, Z/Space = jump, X/Shift = dash, E = Ability1 (Stitch), Q = Ability2 (Redaction), R = Ability3 (Paste-Over / Index Mark).
- The Paste-Over and Index Mark pages both use R (Ability3) but are separate test pages wiring different abilities.
- Paste-Over has a scrolling level (1920px wide) — the camera will pan as the player moves right.
- Index Mark has a very large level (3840×1080) — teleporting across the level should trigger camera snap for long distances or smooth lerp for short ones.

---

## Completion Summary

### What Was Built

1. **Visual test playbook** (`scripts/visual-tests/abilities.md`):
   - Comprehensive step-by-step visual test procedures for all 4 ability pages
   - Page load verification checklists (canvas, debug panel, overlays, pass criteria)
   - Interaction test sequences for each ability (Margin Stitch E, Redaction Q, Paste-Over R, Index Mark R tap/hold)
   - Expected canvas rendering details per page
   - Test report template for recording results
   - Quick smoke test procedure (5-minute fast pass)

2. **Server-side verification** (browser MCP not available):
   - All 4 pages return HTTP 200: margin-stitch, redaction, paste-over, index-mark
   - All pages contain `<canvas>` element references in SSR HTML
   - All pages contain Next.js client framework (`__next`, script tags)
   - No actual page errors — Tailwind class names (`text-amber-500`, etc.) were the only "500"/"error" string matches
   - TypeScript type check (`npx tsc --noEmit`) passed clean with zero errors
   - Dev server compiles all 4 pages successfully (no build errors)

### Test Report

| Page | HTTP Status | Canvas in HTML | Client Scripts | TypeScript | Build |
|------|------------|----------------|----------------|------------|-------|
| `/test/margin-stitch` | 200 | Yes | Yes (19 scripts) | Pass | Pass |
| `/test/redaction` | 200 | Yes | Yes (19 scripts) | Pass | Pass |
| `/test/paste-over` | 200 | Yes | Yes (19 scripts) | Pass | Pass |
| `/test/index-mark` | 200 | Yes | Yes (19 scripts) | Pass | Pass |

**Note:** Canvas rendering, debug overlays, and ability activation could not be verified without browser MCP tools. The playbook documents the exact steps for a future agent with browser access to complete this verification.

### Files Changed

- `scripts/visual-tests/abilities.md` — **created** (comprehensive visual test playbook)

---

## Review Notes (68e81e02)

**Reviewer:** 68e81e02
**Verdict:** Approved — no issues found.

This was a documentation-only task. The created playbook (`scripts/visual-tests/abilities.md`) is well-structured with:
- Correct key bindings verified against `InputManager.ts` (E=Ability1, Q=Ability2, R=Ability3)
- Accurate level dimensions per page (960×540 standard, 1920×540 paste-over, 3840×1080 index-mark)
- Good coverage: page load verification, interaction sequences, expected canvas rendering, and test report template
- Useful quick smoke test section for fast verification

No code was modified — no engine, component, or application files to review for bugs. TypeScript type check passed per the completion summary. All looks good.
