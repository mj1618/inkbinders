# Visual Test Playbook — Integration Pages

## Overview

This playbook documents the visual test procedure for the 7 integration-level test pages in Inkbinders. These pages test the highest-level systems — world assembly, HUD, sprites, save/load, herbarium wing content, the main menu, and the play page. Together they prove the game works end-to-end.

## Prerequisites

- Dev server running: `npm run dev` (serves at `http://localhost:4000`)
- Browser with DevTools available (check console for JS errors)
- Keyboard input available

## Key Bindings Reference

| Action | Primary Key | Alternate |
|--------|-------------|-----------|
| Move Left | ArrowLeft | A |
| Move Right | ArrowRight | D |
| Move Up | ArrowUp | W |
| Move Down / Crouch | ArrowDown | S |
| Jump | Space | Z |
| Dash | Shift | X |
| Attack | J | Enter |
| Weapon Switch | K | — |
| Ability 1 (Stitch) | E | — |
| Ability 2 (Redaction) | Q | — |
| Ability 3 (Paste/Mark) | R | — |
| Pause | Escape | — |

---

## Test 1: World Assembly (`/test/world-assembly`)

**URL:** `http://localhost:4000/test/world-assembly`

### Expected Elements
- **Canvas:** 960×540, showing player in starting room with platforms and obstacles
- **Debug Panel:** Right sidebar with sections for Render Mode, World State (room name, ID, biome, visited/total rooms, gates opened, deaths, play time), Day/Night (phase, light level, corruption intensity, cycle speed slider, phase skip buttons), HUD Config (toggle checkboxes for health, abilities, weapon, clock, room name, minimap, notifications), Room Map (5 interconnected rooms), Controls (Debug Overlays toggle)
- **Header:** Title, back link to `/test`
- **HUD Elements:** Health bar (top-left), ability bar (bottom-left), weapon indicator (bottom-center), day/night clock (top-right), room name display (bottom-right, fades in)

### Test Steps

1. **Page Load**
   - Navigate to URL
   - Wait 2 seconds for canvas to initialize
   - Verify canvas renders with player visible and platforms
   - Verify debug panel sidebar is visible with World State info
   - Check browser console for JS errors (should be none)

2. **HUD Verification**
   - Verify HUD elements visible: health bar, ability icons, weapon indicator, clock
   - In debug panel, toggle HUD Config checkboxes to show/hide individual elements

3. **Move to Exit**
   - Press Right arrow for ~3 seconds to move player toward right edge
   - Observe room name display fading in at bottom-right

4. **Room Transition**
   - Walk into an exit zone
   - Verify fade-to-black transition triggers (fade out → room swap → fade in)
   - After transition completes, verify new room loads with different layout
   - Room name should appear at bottom-right

5. **Day/Night Controls**
   - In debug panel, click phase skip buttons (Skip to Night, etc.)
   - Verify screen darkens in night phase
   - Verify corruption effects begin in non-hub rooms
   - Verify clock display updates

6. **Combat Test**
   - Press J to attack
   - Verify attack animation/hitbox overlay appears
   - If enemies are present in current room, verify hit feedback (damage, hitstop)

7. **Room Map**
   - In debug panel, verify Room Map section shows 5 rooms with current room highlighted
   - Verify visited room count updates after transitions

8. **Pause Menu**
   - Press Escape
   - Verify dark overlay with centered menu (Resume/Quit options)
   - Press Escape again to unpause

### Pass Criteria Checklist
- [ ] Canvas renders with player and platforms visible
- [ ] HUD elements all render (health, abilities, weapon, clock, room name)
- [ ] Room transition triggers on exit zone contact
- [ ] Fade-to-black transition animation plays
- [ ] New room loads with different layout after transition
- [ ] Day/night cycle controls change visual atmosphere
- [ ] Room map shows 5 interconnected rooms
- [ ] Debug panel has world state info and controls
- [ ] Hub room suppresses corruption
- [ ] Pause menu renders and dismisses
- [ ] Back link to `/test` works

---

## Test 2: HUD (`/test/hud`)

**URL:** `http://localhost:4000/test/hud`

### Expected Elements
- **Canvas:** 960×540, showing player on platforms with spikes, target dummies, and full HUD overlay
- **Debug Panel:** Right sidebar with Render Mode toggle, HUD Config (checkboxes for health, abilities, weapon, clock, room name, minimap, notifications), HUD Actions (buttons for room name display, info/ability/gate/item/warning notifications), Day/Night Cycle (speed slider, phase skip buttons), Controls (Debug Overlays toggle)
- **HUD Layout:**
  - Health bar: top-left (red bar)
  - Ability bar: bottom-left (4 slots with keybind labels and icons)
  - Weapon indicator: bottom-center (weapon name + icon + `[K]` switch hint)
  - Day/night clock: top-right (sun/moon icon, phase name, progress bar)
  - Room name: bottom-right (fade-in/hold/fade-out)

### Test Steps

1. **Page Load**
   - Navigate to URL, wait 2s
   - Verify HUD elements render over game canvas
   - All 5 main HUD sections should be visible

2. **Toggle HUD Elements**
   - In debug panel, uncheck "Show Health" → health bar disappears
   - Re-check → reappears
   - Repeat for each HUD element toggle

3. **Send Notifications**
   - Click notification buttons in debug panel (Info, Ability, Gate, Item, Warning)
   - Verify notification appears on screen with color coding by type
   - Verify fade-in animation on notification appearance

4. **Take Damage**
   - Walk player into spikes (move toward hazard)
   - Health bar should decrease and flash white briefly
   - Verify invincibility blink after taking damage

5. **Weapon Switch**
   - Press K
   - Weapon indicator should change (quill-spear ↔ ink-snap)

6. **Attack**
   - Press J
   - Verify attack visual appears (hitbox overlay in debug mode)
   - If near target dummy, verify hit feedback

7. **Ability Cooldown**
   - Press E/Q/R to use abilities
   - Verify ability bar shows cooldown sweep overlay on the used ability slot

8. **Day/Night Clock**
   - Use debug panel to skip phases
   - Verify clock updates (sun→moon icon, phase name changes, progress arc advances)

9. **Pause Menu**
   - Press Escape
   - Verify dark overlay (70% black) with centered menu (Resume/Quit options)
   - Press Escape again to unpause

### Pass Criteria Checklist
- [ ] All 5 HUD sections render at correct positions
- [ ] HUD toggles in debug panel show/hide elements
- [ ] Notifications appear with correct styling and fade animation
- [ ] Health bar responds to damage (decreases, white flash)
- [ ] Weapon indicator updates on K press
- [ ] Ability cooldown overlays appear after ability use
- [ ] Day/night clock updates with phase changes
- [ ] Pause menu renders and dismisses correctly
- [ ] Low health shows visual pulse/warning on health bar

---

## Test 3: Sprites (`/test/sprites`)

**URL:** `http://localhost:4000/test/sprites`

### Expected Elements
- **Canvas:** 960×540, showing player character with current render mode, plus animation strip preview at bottom
- **Debug Panel:** Right sidebar with Render Mode toggle (sprites / rectangles / both), Asset Status (lists all player sprite configs with real/placeholder indicators), Animation (current state, animation name, frame counter), Animation FPS slider (1-30), Player Params sliders (max run speed, jump speed, acceleration), Reset Player button, Debug Overlays toggle

### Test Steps

1. **Page Load**
   - Navigate to URL, wait 2s
   - Verify canvas renders player in default render mode
   - Verify animation strip preview visible at bottom of canvas

2. **Switch to Rectangles**
   - Select "rectangles" mode in Render Mode toggle
   - Verify player renders as a colored rectangle (same as other test pages)

3. **Switch to Sprites**
   - Select "sprites" mode
   - Verify player renders using sprite system (placeholder frames with frame numbers if no real assets loaded)

4. **Switch to Both**
   - Select "both" mode
   - Verify sprite renders with semi-transparent rectangle overlay

5. **Asset Status**
   - Check Asset Status section in debug panel
   - Each defined sprite config should show "real" or "placeholder" status

6. **Animation Preview**
   - Verify animation strip at bottom of canvas shows individual frames for current animation
   - Verify current frame is highlighted

7. **FPS Slider**
   - Adjust Animation FPS slider (1-30)
   - Verify animation speed changes visually (slower at low FPS, faster at high)

8. **Player Movement**
   - Press arrow keys to move
   - Verify animations change with player state (idle → run → jump etc.)
   - Verify horizontal flip when changing direction

### Pass Criteria Checklist
- [ ] Canvas renders in all 3 modes without errors
- [ ] Rectangles mode matches standard test page appearance
- [ ] Sprites mode shows sprite frames (real or placeholder)
- [ ] Both mode overlays rectangle on sprite
- [ ] Animation strip preview displays at bottom of canvas
- [ ] Asset status indicators show for each sprite config
- [ ] FPS slider changes animation playback speed
- [ ] Player state changes trigger animation switches
- [ ] Current frame highlighted in strip preview

---

## Test 4: Save/Load (`/test/save-load`)

**URL:** `http://localhost:4000/test/save-load`

### Expected Elements
- **This is a React UI page** (no game canvas) — different from other test pages
- **Layout:** Save slot cards for 3 slots, mock game state editor, loaded state viewer, status display
- **Save Slot Cards:** Each slot shows player name, room, completion %, play time, death count, or "Empty" state
- **Mock Game State Editor:** Player name, room selection, health slider, play time, death count, ability/boss/room checkboxes, card lists
- **Status Display:** Connection mode (mock/Convex), last operation, operation timing

### Test Steps

1. **Page Load**
   - Navigate to URL, wait 2s
   - Verify save slot UI renders with 3 slot cards
   - No canvas expected — this is pure React UI

2. **Connection Status**
   - Verify status display shows connection mode (likely "Mock" since Convex isn't deployed)

3. **Customize Game State**
   - In the Mock Game State Editor, change player name, select a room, adjust health/play time/death count
   - Toggle some ability/boss/room checkboxes

4. **Save to Slot 1**
   - Click Save on slot 1
   - Verify slot card populates with data (player name, room, completion %, play time)
   - Verify status shows save operation completed with timing

5. **Save to Slot 2**
   - Click Save on slot 2
   - Verify second slot card populates

6. **Load from Slot**
   - Click Load on a populated slot
   - Verify Loaded State Viewer shows the loaded save data
   - Verify status shows "Loaded" confirmation

7. **Delete Slot**
   - Click Delete on a populated slot
   - Verify slot card returns to "Empty" state

8. **Back Navigation**
   - Verify link back to `/test` works

### Pass Criteria Checklist
- [ ] 3 save slots render as cards
- [ ] Connection status display is visible
- [ ] Save operation populates a slot with game data
- [ ] Load operation displays data in Loaded State Viewer
- [ ] Delete removes slot data and returns to empty state
- [ ] Game state editor allows customizing save data
- [ ] Operation timing is displayed
- [ ] Back link to `/test` works

---

## Test 5: Herbarium Wing (`/test/herbarium-wing`)

**URL:** `http://localhost:4000/test/herbarium-wing`

### Expected Elements
- **Canvas:** 960×540, showing player in herbarium-folio biome (green palette, vine anchors visible)
- **Debug Panel:** Right sidebar with Render Mode toggle, World State (current room, room ID, visited count, gates opened, enemies defeated, Elder Binder status), Room Map (9-room hierarchical list with visited/current indicators), Player Params (max run speed, jump speed, dash speed, acceleration sliders), Vine Params (attach range, swing gravity, release boost, pump force sliders), Controls Legend

### Test Steps

1. **Page Load**
   - Navigate to URL, wait 2s
   - Verify canvas renders with herbarium-folio biome theme (green/parchment palette)
   - Verify vine anchors visible as glowing circles

2. **Vine Mechanics**
   - Move player near a vine anchor
   - Press E (Ability 1) to attach
   - Verify player swings from vine (pendulum motion)
   - Press Space to detach with release boost
   - Verify momentum carries player after release

3. **Vine Params**
   - Adjust Vine Params sliders (attach range, swing gravity, release boost, pump force)
   - Verify vine mechanics change to match new values

4. **Room Transition**
   - Navigate to an exit
   - Verify fade-to-black transition
   - New room loads with different layout and possibly enemies

5. **Enemy Encounter**
   - Find a room with enemies (check Room Map for rooms with enemy counts)
   - Verify enemies render and have basic AI (move toward player)
   - Press J to attack, verify hit detection

6. **Surface Types**
   - Navigate to rooms with special surfaces (bouncy, icy, sticky, conveyor)
   - Verify different surface types have distinct visual appearance
   - Verify physics differ on each surface type

7. **Room Map**
   - In debug panel, verify Room Map shows the 9-room Herbarium Wing layout
   - Verify current room is highlighted
   - Verify visited room count updates as you explore

8. **Gate System**
   - Navigate to a room with an ability gate
   - Verify colored barrier renders
   - Approach gate — should auto-open (all abilities unlocked in test)

### Pass Criteria Checklist
- [ ] Herbarium-folio biome theme renders (green/parchment colors)
- [ ] Vine anchors render and vine attach/swing works
- [ ] Vine parameter sliders affect mechanics
- [ ] Room transitions work between connected rooms
- [ ] Enemies spawn and have basic AI
- [ ] Combat hit detection works against enemies
- [ ] Surface type platforms are visually distinct with different physics
- [ ] Room map in debug panel shows 9-room wing layout
- [ ] Ability gates render with correct colors
- [ ] Back link to `/test` works

---

## Test 6: Main Menu (`/`)

**URL:** `http://localhost:4000/`

### Expected Elements
- **No game canvas** — this is a React page with decorative animated canvas
- **Ink Wash Background:** Decorative canvas with falling ink drops, grain texture, oscillating colors
- **Title:** "INKBINDERS" (large, centered text)
- **Menu Options:** Continue (if saves exist), New Game, Test Pages
- **Keyboard Navigation:** Up/Down or W/S to select, Enter to confirm
- **Mouse:** Hover to select, click to confirm

### Test Steps

1. **Page Load**
   - Navigate to URL, wait 2s
   - Verify title screen renders with "INKBINDERS" text
   - Verify ink wash particle background animates (ink drops falling, grain texture)

2. **Menu Options**
   - Verify menu options visible: New Game, Test Pages (Continue appears only if saves exist)

3. **Keyboard Navigation**
   - Press Down arrow to move selection
   - Verify selection highlight changes visually
   - Press Up to move back

4. **New Game Flow**
   - Select "New Game" and press Enter
   - Verify save slot selection screen appears with 3 slots

5. **Slot Selection**
   - Select an empty slot
   - Verify name entry screen appears with text input (default "Archivist")

6. **Name Entry**
   - Type a name
   - Verify character limit (20 chars) and allowed characters (alphanumeric + spaces)

7. **Back Navigation**
   - Press Escape to return through screens (name-entry → slot-select → main)
   - Verify each back step works

8. **Test Pages Link**
   - Select "Test Pages" option and press Enter
   - Verify navigation to `/test`

### Pass Criteria Checklist
- [ ] Title "INKBINDERS" renders prominently
- [ ] Ink wash background animation plays (ink drops drift)
- [ ] Menu options visible and selectable
- [ ] Keyboard navigation (Up/Down/Enter) works
- [ ] Mouse hover/click selection works
- [ ] New Game opens save slot selection
- [ ] Empty slot leads to name entry with default "Archivist"
- [ ] Name entry has character limit and validation
- [ ] Back navigation works through menu screens
- [ ] Test Pages option navigates to `/test`

---

## Test 7: Play Page (`/play`)

**URL:** `http://localhost:4000/play?slot=1&new=1`

### Expected Elements
- **Loading Screen:** Brief loading display (minimum 500ms) with "Loading..." text
- **Canvas:** 960×540, full game session — player in starting room with full HUD
- **HUD:** Health bar, ability bar, weapon indicator, day/night clock, room name
- **Pause Menu:** 4 options — Resume, Save Game, Save & Quit, Quit (with confirmation)
- **Full Systems:** Combat, all 4 abilities, day/night cycle, room transitions, auto-save

### Test Steps

1. **Page Load**
   - Navigate to URL with `?slot=1&new=1` params
   - Verify loading screen appears briefly (minimum 500ms)
   - After loading, verify game canvas renders with player in starting room

2. **HUD Verification**
   - Verify all HUD elements: health bar (top-left), ability bar (bottom-left), weapon (bottom-center), clock (top-right), room name (bottom-right, fading in)

3. **Player Movement**
   - Press arrow keys
   - Verify player moves smoothly with full movement system (run, jump, dash, wall-slide)

4. **Combat**
   - Press J to attack
   - Verify weapon swing visual
   - Press K to switch weapons
   - Verify weapon indicator updates

5. **Abilities**
   - Press E, Q, R to test abilities
   - Verify ability bar shows cooldown on used abilities

6. **Room Transition**
   - Walk to a room exit
   - Verify fade transition and new room loads
   - Verify auto-save notification appears after transition

7. **Pause Menu**
   - Press Escape
   - Verify 4-option pause menu: Resume, Save Game, Save & Quit, Quit
   - Use Up/Down to navigate between options
   - Press Escape or select Resume to unpause

8. **Quit Confirmation**
   - Open pause menu, select Quit
   - Verify confirmation dialog appears before quitting

9. **Redirect Check**
   - Navigate to `/play` without params
   - Verify redirect to `/` (main menu)

### Pass Criteria Checklist
- [ ] Loading screen appears briefly on page load
- [ ] Game canvas renders with player and platforms
- [ ] Full movement system works (run, jump, dash, wall-slide)
- [ ] All HUD elements visible and functional
- [ ] Combat system works (attack, weapon switch)
- [ ] Room transitions work with fade animation
- [ ] Auto-save triggers on room transition
- [ ] Pause menu renders with 4 options and keyboard navigation
- [ ] Quit has confirmation dialog
- [ ] Abilities are available and show cooldown feedback
- [ ] `/play` without params redirects to `/`
- [ ] No console errors during gameplay

---

## Quick Verification Script

For automated structural verification, run the following checks:

```bash
#!/bin/bash
# Visual Test Structural Verification — Integration Pages

DEV_SERVER="http://localhost:4000"
PASS=0
FAIL=0

check_page() {
  local url="$1"
  local name="$2"
  local expect_canvas="$3"

  echo "--- $name ---"

  # Check HTTP status
  status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  if [ "$status" = "200" ]; then
    echo "  HTTP: 200 OK"
    PASS=$((PASS + 1))
  else
    echo "  HTTP: $status FAIL"
    FAIL=$((FAIL + 1))
    return
  fi

  # Fetch page HTML
  html=$(curl -s "$url")

  # Check for canvas element (if expected)
  if [ "$expect_canvas" = "yes" ]; then
    if echo "$html" | grep -qi "canvas"; then
      echo "  Canvas: present"
      PASS=$((PASS + 1))
    else
      echo "  Canvas: MISSING (may render client-side)"
    fi
  fi

  # Check for back link to /test (test pages only)
  if echo "$url" | grep -q "/test/"; then
    if echo "$html" | grep -q '/test"' || echo "$html" | grep -q "'/test'"; then
      echo "  Back link: present"
      PASS=$((PASS + 1))
    else
      echo "  Back link: not detected (may be dynamic)"
    fi
  fi
}

echo "=== Integration Visual Test Verification ==="
echo ""

check_page "$DEV_SERVER/test/world-assembly" "World Assembly" "yes"
check_page "$DEV_SERVER/test/hud" "HUD" "yes"
check_page "$DEV_SERVER/test/sprites" "Sprites" "yes"
check_page "$DEV_SERVER/test/save-load" "Save/Load" "no"
check_page "$DEV_SERVER/test/herbarium-wing" "Herbarium Wing" "yes"
check_page "$DEV_SERVER/" "Main Menu" "yes"
check_page "$DEV_SERVER/play?slot=1&new=1" "Play Page" "yes"

echo ""
echo "=== TypeScript Check ==="
npx tsc --noEmit 2>&1 | tail -5

echo ""
echo "=== Summary ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"
```

## Test Report Template

| Page | HTTP Status | Canvas/UI Renders | Debug Panel | Key Feature | Issues |
|------|-------------|-------------------|-------------|-------------|--------|
| world-assembly | | | | Room transitions | |
| hud | | | | HUD elements | |
| sprites | | | | Render mode toggle | |
| save-load | | | | Save slot UI | |
| herbarium-wing | | | | Vine mechanics | |
| / (main menu) | | | N/A | Menu navigation | |
| /play | | | N/A | Game session | |
