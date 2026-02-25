# Visual Test Playbook — World Systems Pages

## Overview

This playbook documents the visual test procedure for the 3 world systems test pages in Inkbinders. Each test verifies that the page renders correctly, the debug panel is functional, and system-specific features operate as expected.

## Prerequisites

- Dev server running: `npm run dev` (serves at `http://localhost:3000`)
- Browser with DevTools available (check console for JS errors)
- Keyboard input available (arrow keys, space, shift, tab, number keys)

## Key Bindings Reference

| Action | Primary Key | Alternate |
|--------|-------------|-----------|
| Move Left | ArrowLeft | A |
| Move Right | ArrowRight | D |
| Jump | Space | Z |
| Dash | Shift | X |
| Attack | J | - |
| Weapon Switch | K | - |
| Debug Overlays | ` (backtick) | - |

### Page-Specific Bindings

| Page | Key | Action |
|------|-----|--------|
| Day/Night | T | Pause/Resume cycle |
| Day/Night | 1-4 | Skip to Dawn/Day/Dusk/Night |
| Ink Cards | Tab | Toggle Play/Deck mode |
| Ink Cards | Enter | Equip/Unequip card |
| Ink Cards | C | Craft |
| Ink Cards | Q | Switch panel focus |
| Room Editor | P | Toggle Play/Edit mode |
| Room Editor | Mouse | Click to place/select elements |
| Room Editor | Middle-click | Pan camera |

---

## Test 1: Day/Night Cycle (`/test/day-night`)

**URL:** `http://localhost:3000/test/day-night`

### Expected Elements
- **Canvas:** 960x540, showing a 1920x540 level with player, platforms (with surface types), and ambient particles
- **Clock HUD:** Top-right area — sun/moon icon, phase label, progress bar
- **Debug Panel:** Right sidebar with sections: Cycle Info, Time Controls, Corruption Modifiers, Visual Settings, Player Movement
- **Header:** Title "Day/Night Cycle", phase badge "Phase 4 — World Systems", link back to `/test`
- **Pass Criteria:** 16 criteria listed below canvas
- **Controls Hint:** Key binding reference below pass criteria
- **Debug Overlays:** Hitbox (cyan), velocity vector (amber), state label (purple), surface labels on non-normal platforms

### Test Steps

1. **Page Load**
   - Navigate to URL
   - Wait 2 seconds for canvas to initialize
   - Verify canvas is not blank (player rect and colored platforms visible)
   - Verify debug panel sidebar with "Cycle Info" readout visible
   - Check browser console for JS errors (should be none)
   - Verify Clock HUD renders in top-right (sun icon, time phase, progress bar)

2. **Cycle Auto-Advance**
   - Observe the Time readout in the debug panel
   - Verify time value increases automatically (default 120s cycle)
   - Verify "Time of Day" label changes between phases as time advances

3. **Phase Skip — Day to Night**
   - Click the "Night" button in Time Controls section (or press `4`)
   - Verify: Background color shifts from warm parchment to dark indigo/blue
   - Verify: Clock HUD shows moon icon and "NIGHT" label
   - Verify: Corruption readout increases above 0
   - Verify: Ambient particles change color/behavior (more frequent, darker colors)

4. **Phase Skip — Night Corruption Effects**
   - While at night, observe corruption modifiers
   - If corruption > 0.2: Look for ink-bleed particles (purple/indigo dots)
   - If corruption > 0.3: Look for "surface-flip" in active modifiers — platform surface labels should change
   - If corruption > 0.4: Look for platform flickering (platforms briefly go semi-transparent)
   - If corruption > 0.7: Look for gravity pulse (brief reversed gravity, red flash at top of canvas)

5. **Phase Skip — Dawn**
   - Click "Dawn" button (or press `1`)
   - Verify: Background transitions to rosy pink palette
   - Verify: Clock HUD shows sun icon and "DAWN" label
   - Verify: Corruption drops back toward 0

6. **Pause/Resume**
   - Click "Pause" button (or press `T`)
   - Verify: Time readout stops advancing
   - Verify: Button label changes to "Resume"
   - Click "Resume" (or press `T` again)
   - Verify: Time resumes advancing

7. **Manual Time Scrubber**
   - Drag the "Manual Time" slider from 0 to 1
   - Verify: Background color smoothly transitions through all 4 phases
   - Verify: Clock HUD updates in sync

8. **Slider Tunability**
   - Adjust "Cycle Duration" slider (increase to 600s)
   - Verify: Cycle slows down proportionally
   - Adjust "Time Scale" slider (increase to 5x)
   - Verify: Cycle speeds up

9. **Player Movement During Cycle**
   - Use arrow keys to move the player
   - Verify: Player moves and interacts with platforms regardless of cycle phase
   - Verify: Surface types (icy, bouncy, sticky, conveyor) still function during night corruption

10. **Visual Toggle Checkboxes**
    - Uncheck "Ambient Particles" → Verify: Floating particles stop spawning
    - Uncheck "Fog Overlay" → Verify: Atmospheric fog disappears
    - Uncheck "Clock HUD" → Verify: Clock HUD disappears from top-right
    - Uncheck "Corruption Distortion" → Verify: Chromatic aberration effect at high corruption is removed
    - Re-check all to restore

### Pass Criteria Checklist
- [ ] Cycle auto-advances (120s)
- [ ] Smooth 4-phase transitions (dawn/day/dusk/night)
- [ ] Background color interpolates
- [ ] Clock HUD with sun/moon
- [ ] Ambient particles per time-of-day
- [ ] Corruption rises at night
- [ ] Surface Flip changes platforms
- [ ] Gravity Pulse fires at deep night
- [ ] Fog-of-war shrinks visibility
- [ ] Ink bleed particles at night
- [ ] Platform flicker visual
- [ ] Skip-to buttons work
- [ ] Time scrubber works
- [ ] Pause/Resume works
- [ ] All sliders tune live
- [ ] Cycle loops seamlessly

---

## Test 2: Ink Cards (`/test/ink-cards`)

**URL:** `http://localhost:3000/test/ink-cards`

### Expected Elements
- **Canvas:** 960x540, showing either a game sandbox (Play mode) or card collection UI (Deck mode)
- **Mode Indicator:** Header badge showing "Play Mode" (green) or "Deck Mode" (indigo)
- **Debug Panel:** Right sidebar with sections: Deck Info, Active Modifiers, Card Engine Params, Stat Caps, Collection Manager
- **Header:** Title "Ink Cards", phase badge, mode badge, link back to `/test`
- **Pass Criteria:** 14 criteria listed below canvas
- **Controls:** Key binding reference

### Test Steps

1. **Page Load**
   - Navigate to URL
   - Wait 2 seconds for canvas to initialize
   - Verify initial mode (Play or Deck) is shown
   - Verify debug panel sidebar with "Deck Info" section visible
   - Check Deck Info shows: collection count ~24 cards, 0 equipped
   - Check browser console for JS errors

2. **Play Mode — Basic Sandbox**
   - If in Deck mode, press Tab to switch to Play mode
   - Verify: Canvas shows game level with player rectangle, platforms, and a red target dummy
   - Move player with arrow keys — verify movement works
   - Press J to attack — verify attack hitbox visual appears
   - Press K to switch weapons — verify weapon indicator changes

3. **Switch to Deck Mode**
   - Press Tab to toggle to Deck mode
   - Verify: Mode badge changes to "Deck Mode" (indigo)
   - Verify: Canvas shows card collection grid (4-column layout)
   - Verify: Cards render as colored rectangles (80x110px) with category-colored borders
   - Verify: Equipped slots bar visible at top of canvas (4 empty dashed slots)
   - Verify: Crafting panel visible to the right of the collection grid

4. **Card Selection and Navigation**
   - Use arrow keys to navigate the card grid
   - Verify: Selected card highlights with a border
   - Verify: Tooltip appears showing card name, tier, stat modifiers
   - Verify: Different card categories have different border colors (blue=swiftness, red=might, green=resilience, yellow=precision, purple=arcana)

5. **Equip/Unequip Cards**
   - With a card selected, press Enter to equip
   - Verify: Card appears in the equipped slots bar at top
   - Verify: "Active Modifiers" section in debug panel shows stat changes
   - Verify: Deck Info updates equipped count (e.g., "1 / 4")
   - Press Enter again to unequip
   - Verify: Card removed from equipped bar, modifiers clear

6. **Stat Modifications in Play Mode**
   - Equip a Swiftness card (e.g., "Swift Strider")
   - Press Tab to switch to Play mode
   - Verify: Player movement speed noticeably faster
   - Switch back to Deck mode, equip a Might card
   - Switch to Play mode, attack the dummy
   - Verify: Damage numbers may be higher

7. **Crafting**
   - In Deck mode, press Q to switch focus to crafting panel
   - Verify: Available craft recipes listed (requires 2 same-tier, same-definition cards)
   - Select a recipe with arrow keys
   - Press C to craft
   - Verify: Two input cards consumed, one higher-tier card produced
   - Verify: Crafting recipe list updates

8. **Card Engine Params (Sliders)**
   - Adjust "Max Equipped" slider (increase to 8)
   - Verify: More equip slots become available
   - Toggle "Diminishing Returns" checkbox off
   - Verify: Stacking same-stat cards gives full value (no 0.7x reduction)
   - Adjust "Diminishing Factor" slider
   - Verify: Modifier summary in debug panel updates

9. **Collection Manager**
   - Click "Add Random Card" button in debug panel
   - Verify: New card appears in collection grid
   - Click "Add All Tier 1s"
   - Verify: Collection grows significantly
   - Click "Clear Collection"
   - Verify: All cards removed (collection count = 0)
   - Click "Reset to Starting Deck"
   - Verify: Collection restored to ~24 starting cards

10. **Tier Dots**
    - Verify: Tier 1 cards show 1 dot, Tier 2 cards show 2 dots
    - Craft a pair to create a Tier 2 → verify 2 dots
    - If Tier 2 pair available, craft to Tier 3 → verify 3 dots

### Pass Criteria Checklist
- [ ] Deck mode shows cards
- [ ] Category-colored borders
- [ ] Tier dots
- [ ] Tooltip on select
- [ ] Enter equips/unequips
- [ ] Max 4 equipped
- [ ] Stat preview shows before/after
- [ ] Crafting 2x same → next tier
- [ ] Swiftness cards increase speed
- [ ] Might cards increase damage
- [ ] Resilience cards increase health
- [ ] Diminishing returns visible
- [ ] Stat caps enforced
- [ ] All params tunable

---

## Test 3: Room Editor (`/test/room-editor`)

**URL:** `http://localhost:3000/test/room-editor`

### Expected Elements
- **Canvas:** 960x540, showing a room grid with room bounds outline
- **Editor Toolbar:** 9 tool buttons in the debug panel (Select, Platform, Obstacle, Exit, Gate, Enemy, Vine, Spawn, Erase)
- **Grid Overlay:** Default 32px grid visible on canvas
- **Debug Panel:** Right sidebar with sections: Tools, Tool Options, Grid, Room, Controls, Presets, Stats
- **Header:** Title "Room Editor", mode indicator (EDIT/PLAY), middle-click hint, link back to `/test`
- **Pass Criteria:** 10 criteria rendered as checkmarks at bottom

### Test Steps

1. **Page Load**
   - Navigate to URL
   - Wait 2 seconds for canvas to initialize
   - Verify: Canvas shows editor view (grid lines, room bounds outline, spawn marker)
   - Verify: Toolbar with 9 tool buttons visible in debug panel
   - Verify: "EDIT MODE" indicator in header
   - Verify: Stats section shows element counts (platforms, obstacles, exits, etc.)
   - Check browser console for JS errors

2. **Grid Display**
   - Verify: Grid lines visible on canvas (32px spacing default)
   - Toggle "Show" grid checkbox → verify grid disappears/reappears
   - Adjust "Grid Size" slider to 16px → verify grid becomes finer
   - Adjust to 64px → verify grid becomes coarser

3. **Platform Tool**
   - Click "Platform" tool button in toolbar
   - Verify: Button highlights (amber background)
   - Click and drag on canvas to place a platform
   - Verify: Platform rectangle appears with grid-snapped edges
   - Verify: Stats section updates platform count
   - Test surface type dropdown: select "bouncy" → place another platform → verify different color

4. **Select Tool**
   - Click "Select" tool button
   - Click on an existing platform
   - Verify: Platform highlights/selects (visual indicator)
   - Drag selected platform to move it
   - Verify: Platform snaps to grid while moving

5. **Erase Tool**
   - Click "Erase" tool button
   - Click on a platform
   - Verify: Platform is removed
   - Verify: Stats section updates

6. **Other Element Tools**
   - Test Obstacle tool: select obstacle type (spikes), click canvas to place
   - Test Exit tool: click to place an exit zone (blue shading)
   - Test Gate tool: select ability (margin-stitch), click to place gate (colored barrier)
   - Test Enemy tool: select enemy type, click to place enemy marker
   - Test Vine tool: click to place vine anchor marker
   - Test Spawn tool: click to set spawn point marker

7. **Play Mode Toggle**
   - Press P to enter Play mode
   - Verify: Header changes to "PLAY MODE (P to exit)"
   - Verify: Player rectangle appears at spawn point
   - Verify: Arrow keys move the player
   - Verify: Player collides with placed platforms
   - Verify: "playMode" pass criterion turns green
   - Press P to exit back to Edit mode
   - Verify: Player disappears, editor tools return

8. **Room Transitions (Play Mode)**
   - Load a preset room that has exits (e.g., "Tutorial Corridor")
   - Enter Play mode (P)
   - Walk player into an exit zone
   - Verify: Fade-to-black transition occurs
   - Verify: New room loads with its platforms
   - Verify: "roomTransitions" pass criterion turns green

9. **Ability Gates (Play Mode)**
   - Load a preset room with gates (or place a gate in editor)
   - Enter Play mode
   - Walk near the gate
   - Verify: Gate opens (all abilities enabled in play mode)
   - Verify: "abilityGates" pass criterion turns green

10. **Export/Import**
    - Click "Export JSON" button in Controls section
    - Verify: Room data copied to clipboard (or downloaded as JSON file)
    - Click "Import JSON" → paste exported JSON
    - Verify: Room reloads with same elements
    - Verify: "exportImport" pass criterion turns green

11. **Preset Rooms**
    - Click a preset room button (e.g., "Tutorial Corridor", "Vertical Shaft", "Vine Garden")
    - Verify: Room loads with predefined platforms, exits, gates, enemies
    - Verify: Camera adjusts to new room dimensions
    - Verify: "presetRoomsLoad" pass criterion turns green

12. **Room Settings**
    - Change "Name" input field
    - Adjust "Width" and "Height" sliders
    - Click "New Room" button
    - Verify: Canvas clears to empty room with new dimensions

### Pass Criteria Checklist
- [ ] Platform tool works
- [ ] All elements placeable
- [ ] Select and move
- [ ] Delete works
- [ ] Grid snap
- [ ] Play mode
- [ ] Room transitions
- [ ] Ability gates
- [ ] Export/Import
- [ ] Preset rooms load

---

## Automated Structural Verification Script

If browser MCP is unavailable, run this script to verify pages serve correctly:

```bash
#!/usr/bin/env bash
# Run from project root: bash scripts/visual-tests/verify-world-systems.sh

PASS=0
FAIL=0

for page in day-night ink-cards room-editor; do
  URL="http://localhost:3000/test/$page"
  echo "=== Testing $URL ==="

  # Check HTTP status
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
  if [ "$STATUS" = "200" ]; then
    echo "  HTTP Status: $STATUS ✓"
    ((PASS++))
  else
    echo "  HTTP Status: $STATUS ✗"
    ((FAIL++))
  fi

  # Check for canvas element
  HTML=$(curl -s "$URL")
  echo "$HTML" | grep -q 'canvas' && { echo "  Canvas: Present ✓"; ((PASS++)); } || { echo "  Canvas: MISSING ✗"; ((FAIL++)); }

  # Check for back link to /test
  echo "$HTML" | grep -q 'href="/test"' && { echo "  Back link: Present ✓"; ((PASS++)); } || { echo "  Back link: MISSING ✗"; ((FAIL++)); }

  # Check for range inputs (sliders)
  echo "$HTML" | grep -q 'range' && { echo "  Sliders: Present ✓"; ((PASS++)); } || { echo "  Sliders: MISSING ✗"; ((FAIL++)); }

  echo ""
done

echo "=== Results: $PASS passed, $FAIL failed ==="
```

Also verify types:
```bash
npx tsc --noEmit
```

---

## Test Report Template

```markdown
# World Systems Visual Test Report — [DATE]

## Environment
- Node version: [version]
- Browser: [browser + version]
- Dev server: http://localhost:3000

## Results Summary

| Page | HTTP | Canvas | Debug Panel | Interaction | Notes |
|------|------|--------|-------------|-------------|-------|
| /test/day-night | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | |
| /test/ink-cards | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | |
| /test/room-editor | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | |

## TypeScript Check
- `npx tsc --noEmit`: ✓ PASS / ✗ FAIL

## Issues Found
- [list any issues]

## Screenshots
- [attach if browser MCP was used]
```
