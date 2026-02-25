# Task: Visual Test — Biome Pages

## Summary

Create visual test scripts for the 4 biome test pages and execute them using browser MCP tools to verify rendering correctness. If browser MCP is unavailable, create the documented test procedure as a runnable playbook and verify via HTTP/HTML structural checks.

## What to Build

### 1. Visual Test Playbook

Create `scripts/visual-tests/biomes.md` — a markdown playbook documenting the visual test procedure for all 4 biome test pages.

### 2. Execute the Tests (if browser MCP available)

For each of these 4 pages, perform the following using browser MCP tools:

**Pages to test:**
1. `http://localhost:3000/test/biome/herbarium-folio`
2. `http://localhost:3000/test/biome/astral-atlas`
3. `http://localhost:3000/test/biome/maritime-ledger`
4. `http://localhost:3000/test/biome/gothic-errata`

**For each page:**
1. Navigate to the URL with `browser_navigate`
2. Wait 2 seconds for the page to load (canvas element should be present)
3. Take an initial screenshot — note any issues (blank canvas, missing elements, JS errors)
4. Verify these elements are present:
   - A `<canvas>` element (the game canvas, 960x540)
   - A debug panel sidebar (React component with sliders)
   - Page title/header with navigation back to `/test`
   - Pass criteria section
5. Simulate player input (Arrow keys for movement, Space for jump, Shift for dash, E for vine/ability)
6. Take a post-interaction screenshot
7. Verify biome-specific visual elements are rendered (background colors, unique mechanics, ambient particles)

### 3. Test Report

Create a summary listing:
- Each page tested
- Whether it loaded successfully (HTTP 200)
- Whether the canvas rendered content (not blank)
- Whether the debug panel was visible with sliders
- Whether biome-specific visual elements are present
- Any errors or issues observed

## Key Bindings Reference

| Key | Action |
|-----|--------|
| Arrow Left / A | Move Left |
| Arrow Right / D | Move Right |
| Arrow Up / W | Up / Aim Up / Shorten Vine Rope |
| Arrow Down / S | Down / Aim Down / Lengthen Vine Rope |
| Space / Z | Jump (also detaches from vine) |
| Shift / X | Dash |
| E | Ability1 (Vine attach/detach in Herbarium) |
| J / Enter | Attack |
| K | Weapon Switch |

## Page-Specific Test Procedures and Expectations

### `/test/biome/herbarium-folio`

**Canvas:** 960x540, Level: 3840x1080

**Unique mechanic:** Vine swinging system — pendulum physics, momentum transfer, rope length adjustment.

**Key elements to verify:**
- Player (colored rectangle ~32x48) on platforms with Herbarium green theme
- 10 vine anchors visible (ceiling-mounted, with rope length indicators)
- Parallax background with leaf/vine motif (3 layers at different scroll rates)
- Ambient green/parchment particles drifting
- FPS counter and diagnostics on canvas
- Goal zone indicators (A and B)

**Debug panel sections (sliders):**
- Biome Info: current biome name, vine status
- Vine Physics: 10 sliders — attach range, swing gravity, angular damping, release boost, rope adjust speed, min/max rope length, momentum transfer, max angular velocity, pump force
- Vine Toggles: jump detaches, adjust length, pump swing
- Visual Settings: ambient particles, parallax background, biome colors, vine ranges, swing arc
- Player Movement: max run speed, acceleration, jump speed, dash speed
- Controls: reset player, reset vines, reset goals, teleport to goals, debug overlays

**Interaction sequence:**
1. Press Arrow Right for ~1s — run right, observe green-themed platforms and parallax scrolling
2. Run near a vine anchor, press E — player should attach to vine and start swinging
3. Press Left/Right to pump swing — pendulum motion should increase amplitude
4. Press Up/Down to adjust rope length
5. Press Space to detach — player should launch with momentum boost
6. Dash (Shift) near obstacles — observe particles and movement
7. Screenshot: verify vine rendering (rope line from anchor to player), swing arc visualization, biome colors

**Pass criteria (14 checkpoints on page):**
- E attaches to nearest vine anchor within range
- Swing follows pendulum physics (natural arc)
- Left/Right pumps swing amplitude
- Up/Down adjusts rope length (shorter = faster)
- Jump or E detaches with release boost velocity
- Momentum transfers between player velocity and swing
- Vine rope renders from anchor to player
- Platform collision during swing auto-detaches
- Biome-themed colors (green/parchment palette)
- Parallax background scrolls at 3 rates
- Ambient particles (leaf-like drifters)
- Vine-to-vine chaining possible
- Goal zones reachable via vine mechanics
- All params tunable via sliders

---

### `/test/biome/astral-atlas`

**Canvas:** 960x540, Level: 3200x1200

**Unique mechanic:** Gravity well system — attract/repel force zones with biome-wide low-gravity multiplier (0.4x base gravity).

**Key elements to verify:**
- Player on platforms with deep purple/silver Astral Atlas theme
- 8 gravity wells visible as pulsing concentric ring circles:
  - Attract wells (indigo #818cf8) — pull player toward center
  - Repel wells (pink #f472b6) — push player away from center
- Low-gravity feel: noticeably floaty jumps (~2.5x normal height)
- Parallax background with star/constellation motif
- Ambient purple/silver particles drifting
- Force vector arrow showing net gravity well force on player
- Goal zone indicators

**Debug panel sections (sliders):**
- Biome Info: gravity multiplier display
- Gravity Wells: 5 sliders — global gravity multiplier, falloff exponent, max well force, pulse speed, affects dash toggle
- Player Movement: 7 sliders — max run speed, jump speed, rise/fall/max fall gravity, dash speed, air acceleration
- Visual Settings: ambient particles, parallax background, biome colors, well debug overlays
- Controls: reset player, reset goals, teleport to goals, debug overlays

**Interaction sequence:**
1. Press Space — jump should go noticeably higher than normal (low gravity)
2. Press Arrow Right — run through areas, observe parallax star-field scrolling
3. Move near an attract well — player should be pulled toward the well center
4. Move near a repel well — player should be pushed away from the well center
5. Dash through a well — player should be immune to well force during dash (unless `affectsDash` is on)
6. Try slingshot: enter an attract well from the side, build up speed, exit with high velocity
7. Screenshot: verify pulsing well rings, force vector arrow, purple/silver theme, low-gravity arc

**Pass criteria (10 checkpoints on page):**
- Low-gravity feel (2.5x jump height due to 0.4x gravity multiplier)
- Attract wells pull player toward center with visible concentric rings
- Repel wells push player away with distinct pink color
- Slingshot behavior: high-speed exit from attract well approach
- Well force immune during dash (default)
- Smooth force ramp-up/down when entering/exiting wells
- Pulsing visual effect on wells
- Parallax star-field background
- No movement seams at well boundaries
- All params tunable

---

### `/test/biome/maritime-ledger`

**Canvas:** 960x540, Level: 3840x1080

**Unique mechanic:** Current system — area-based directional force zones with 4 types: streams (constant), jets (strong launch), gusts (pulsing on/off), whirlpools (circular vortex).

**Key elements to verify:**
- Player on platforms with teal/sand Maritime Ledger theme
- Current zones rendered as flow arrow/line overlays within zone boundaries
- 10 current zones across 4 areas:
  - Streams: directional flow lines (constant force, 350-450 strength)
  - Jets: vertical/diagonal launch indicators (strong force, 900-1000 strength)
  - Gusts: pulsing updraft indicators with on/off cycle (550-650 strength)
  - Whirlpools: circular flow arrows (clockwise/counter-clockwise, 300-350 strength)
- Wave-line rendering on platforms (nautical theme)
- On-screen current force indicator (direction arrow + magnitude) when player is inside a current
- Parallax background with harbor/nautical motif
- Ambient teal/sand particles
- 4 goal zones

**Debug panel sections (sliders):**
- Biome Info: static display
- Current Params: 6 sliders + 2 toggles — global strength multiplier, grounded multiplier, max current velocity, ramp up rate, particle density, affects grounded toggle, dash overrides current toggle
- Player Movement: 4 sliders — max run speed, acceleration, jump speed, dash speed
- Visual Settings: ambient particles, parallax background, biome colors, current debug zones
- Controls: reset player, reset goals, teleport to areas 3/4, debug overlays

**Interaction sequence:**
1. Press Arrow Right — run into a stream zone, player should be pushed in the stream direction
2. Jump while in a stream — observe stronger force while airborne vs grounded (40% grounded multiplier)
3. Dash through a current zone — player should punch through unaffected (if dash overrides current is on)
4. Find a jet zone — step into it, player should be launched strongly in the jet direction
5. Find a gust zone — observe pulsing on/off behavior (2s on, 1.5s off cycle), with 0.3s telegraph before activation
6. Find a whirlpool — enter and observe curved trajectory around the vortex center
7. Screenshot: verify flow arrows inside current zones, force indicator on player, teal/sand theme, wave rendering

**Pass criteria (14 checkpoints on page):**
- Stream zones push player in constant direction
- Force is stronger airborne than grounded (grounded multiplier 0.4x)
- Dash overrides current force (default on)
- Smooth force ramp-up when entering a zone (not instant snap)
- Gust zones pulse on/off with visual telegraph
- Whirlpools curve player path tangentially
- Jets launch player strongly in one direction
- Flow visualization arrows render inside zones
- On-screen force indicator when inside current
- Biome-themed teal/sand colors
- Parallax nautical background
- Wave-line platform decoration
- 4 goal zones reachable using current mechanics
- All params tunable

---

### `/test/biome/gothic-errata`

**Canvas:** 960x540, Level: 3200x1080

**Unique mechanic:** Fog system — three distortion types: fog (visibility reduction), inversion (left/right swap), scramble (random directional remap). Uses `InputManager.setActionRemap()` for transparent input modification.

**Key elements to verify:**
- Player on platforms with dark gray/crimson Gothic Errata theme
- Fog overlay: radial visibility circle centered on player, shrinks based on zone density
- Zone boundary indicators:
  - Fog zones: purple glow border + drifting particles
  - Inversion zones: pulsing red border + reversed arrow icons
  - Scramble zones: jittering green border + static dot pattern
- Screen-space control effect overlays:
  - Inversion active: red tint on screen edges
  - Scramble active: green glitch scanlines
- 5 fog zones across 4 areas
- Parallax background with cathedral/dark motif
- Ambient purple/crimson particles

**Debug panel sections (sliders):**
- Fog Params: 8 sliders — base fog radius, min fog radius, fade in rate, fade out rate, dash clear duration, inversion tint strength, scramble glitch strength, control transition delay
- Fog Toggles: dash clears fog, inversion affects dash, scramble affects dash
- Visual Settings: parallax background, biome colors, zone boundaries
- Player Movement: 6 sliders — max run speed, jump speed, rise/fall gravity, dash speed, air acceleration
- Controls: reset player, reset goals, teleport to areas 1/2/3/4, debug overlays

**Interaction sequence:**
1. Press Arrow Right — enter Area 1 (fog intro)
2. Observe fog overlay: visibility circle should appear and shrink as fog density increases
3. Dash (Shift) — fog should temporarily clear (dash clears fog, 15-frame clear duration)
4. Continue to Area 2 (inversion challenge) — left/right controls should swap
5. Observe: red tint overlay on screen edges indicating inversion is active
6. Note: there is a grace period (10 frames) before inversion takes effect on zone entry
7. Continue to Area 3 (scramble maze) — all 4 directional inputs randomly remapped
8. Observe: green glitch scanlines indicating scramble is active
9. Note: scramble mapping stays consistent within a zone (same shuffle each time), re-randomizes on re-entry
10. Continue to Area 4 (combined gauntlet) — fog + inversion/scramble combined
11. Screenshot: verify fog circle, red/green control overlays, zone boundary visuals, dark theme

**Pass criteria (14 checkpoints on page):**
- Fog zones reduce visibility (radial circle shrinks with density)
- Fog fades in/out smoothly (not instant)
- Dash clears fog temporarily (15 frames)
- Inversion zones swap Left ↔ Right controls
- Red tint overlay visible during inversion
- Grace period before control modification takes effect (10 frames)
- Scramble zones remap all 4 directions randomly
- Scramble mapping is consistent within a zone (not re-shuffled each frame)
- Green glitch overlay visible during scramble
- Zone boundaries have distinct visual indicators (purple/red/green)
- Biome-themed dark gray/crimson palette
- Parallax dark cathedral background
- 4 goal zones reachable through fog/control challenges
- All params tunable via sliders

---

## Automated Verification (if no browser MCP)

If browser MCP tools are not available, perform structural verification with HTTP/HTML checks:

```bash
#!/bin/bash
# Quick verification script for biome test pages
PAGES=(
  "test/biome/herbarium-folio"
  "test/biome/astral-atlas"
  "test/biome/maritime-ledger"
  "test/biome/gothic-errata"
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

- `scripts/visual-tests/biomes.md` — Visual test playbook for all 4 biome pages

## Verification

- [ ] All 4 pages load without blank canvas or JS errors
- [ ] Each page has a visible canvas with rendered content (player, platforms, biome theme)
- [ ] Each page has a debug panel with biome-specific sliders
- [ ] Biome-specific visual elements present:
  - Herbarium: vine anchors, green palette, parallax leaf background
  - Astral Atlas: gravity well rings (pulsing), purple/silver palette, star-field background
  - Maritime Ledger: current zone flow arrows, teal/sand palette, wave-line platforms
  - Gothic Errata: fog overlay circle, zone boundary markers, dark gray/crimson palette
- [ ] Each page has biome-specific parameter sliders (vine physics, gravity wells, currents, fog)
- [ ] Player input causes visible movement on canvas
- [ ] Screenshots captured (if browser MCP available)
- [ ] Test report created summarizing results for all 4 pages
- [ ] `scripts/visual-tests/biomes.md` playbook created with full procedures

## Notes

- If browser MCP tools are not available, focus on creating the playbook document and performing structural HTTP/HTML verification (same approach as core-movement and combat visual test tasks).
- Each biome has a unique movement mechanic that goes beyond visual theming:
  - Herbarium = vine grapple (pendulum physics)
  - Astral Atlas = gravity wells (attract/repel force fields + low-gravity)
  - Maritime Ledger = currents (4 zone types with directional force)
  - Gothic Errata = fog (visibility + input disruption)
- Biome mechanics are world systems that apply forces or modify input — they do NOT change the player state machine.
- The fog system's input remapping is transparent via `InputManager.setActionRemap()` — player code is completely unmodified.
- Parallax backgrounds use 3 layers per biome with distinct scroll rates (0.1, 0.3, 0.6).
- All biome test pages share the same basic structure: GameCanvas + DebugPanel + Slider, with biome-specific systems wired into the update/render callbacks.

---

## Completion Summary

### What Was Done

1. **Created visual test playbook** at `scripts/visual-tests/biomes.md` — comprehensive test procedures for all 4 biome test pages, following the established pattern from `core-movement.md`, `abilities.md`, and `combat.md`.

2. **Ran structural HTTP/HTML verification** for all 4 biome pages:
   - All 4 pages return HTTP 200
   - All 4 pages have `<canvas>` elements in initial HTML
   - All 4 pages have slider components (hydrated client-side)
   - All 4 pages have navigation back links to `/test`
   - All 4 pages have pass criteria sections

3. **TypeScript type checks** pass cleanly (`npx tsc --noEmit` — no errors).

### Structural Verification Results

| Page | HTTP | Canvas | Sliders | Back Link | Pass Criteria |
|------|------|--------|---------|-----------|---------------|
| Herbarium Folio | 200 | YES | YES | YES | YES |
| Astral Atlas | 200 | YES | YES | YES | YES |
| Maritime Ledger | 200 | YES | YES | YES | YES |
| Gothic Errata | 200 | YES | YES | YES | YES |

### Files Created

- `scripts/visual-tests/biomes.md` — 450+ line visual test playbook covering:
  - Page load verification checklists for each biome
  - Detailed interaction test sequences (vine swinging, gravity wells, currents, fog)
  - Expected canvas rendering descriptions
  - Pass criteria checklists (18 + 10 + 15 + 14 = 57 total criteria)
  - Test report template
  - Quick smoke test guide (5-minute version)
  - Automated structural verification bash script

### Files Read (not modified)

- `src/app/test/biome/herbarium-folio/page.tsx`
- `src/app/test/biome/astral-atlas/page.tsx`
- `src/app/test/biome/maritime-ledger/page.tsx`
- `src/app/test/biome/gothic-errata/page.tsx`
- `scripts/visual-tests/abilities.md` (pattern reference)
- `scripts/visual-tests/core-movement.md` (pattern reference)
- `scripts/visual-tests/combat.md` (pattern reference)

---

## Review Notes (reviewer: d3fa102d)

### Files Reviewed
- `scripts/visual-tests/biomes.md` — Playbook is comprehensive and well-structured, covers all 4 biomes with detailed interaction sequences and pass criteria checklists.
- `src/app/test/biome/herbarium-folio/page.tsx` — Clean. Vine system properly integrated, all sliders wired, cleanup on unmount correct.
- `src/app/test/biome/astral-atlas/page.tsx` — **Bug found and fixed** (see below).
- `src/app/test/biome/maritime-ledger/page.tsx` — Clean. Current system properly integrated, gust timers frame-rate independent, all params wired.
- `src/app/test/biome/gothic-errata/page.tsx` — Clean. Fog system properly integrated, input remap cleaned up on unmount and respawn.

### Bug Fixed

**Astral Atlas `updateParam` not pushing to player** — The `updateParam` callback updated `baseParamsRef.current` (used for gravity multiplication) but did NOT push the value to `player.params`. This meant non-gravity params like `maxRunSpeed`, `jumpSpeed`, `dashSpeed`, and `airAcceleration` sliders had no effect on the running game. Fixed by adding `player.params[key] = value` to the callback, matching the pattern used by Herbarium Folio and Maritime Ledger.

### TypeScript
- `npx tsc --noEmit` passes cleanly after fix.
