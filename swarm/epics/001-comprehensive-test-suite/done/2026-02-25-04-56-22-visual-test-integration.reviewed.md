# Task: Visual Test — Integration Pages

## Summary

Create a visual test playbook for the 7 integration-level test pages and execute structural verification. These pages test the highest-level systems — world assembly, HUD, sprites, save/load, herbarium wing content, the main menu, and the play page. Together they prove the game works end-to-end.

## What to Build

### 1. Visual Test Playbook

**File:** `scripts/visual-tests/integration.md`

Create a detailed markdown playbook following the established pattern (see `scripts/visual-tests/core-movement.md` for reference). The playbook documents the visual test procedure for 7 pages.

Include for each page:
- URL
- Expected Elements (canvas size, debug panel sections, headers, nav links)
- Test Steps (page load → initial screenshot → interactions → post-interaction screenshot)
- Pass Criteria checklist

### 2. Structural Verification Script

Run structural HTTP/HTML checks for all 7 pages to verify they load, contain a canvas (where applicable), have expected UI elements, and compile without TypeScript errors.

### 3. Test Report

Produce a summary table of verification results.

---

## Prerequisites

- Dev server running: `npm run dev` (serves at `http://localhost:3000`)
- Browser with DevTools available (for interactive testing)
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

## Page-Specific Test Procedures

### Page 1: World Assembly (`/test/world-assembly`)

**URL:** `http://localhost:3000/test/world-assembly`

**Expected Elements:**
- **Canvas:** 960×540, showing player in Scribe Hall (warm brown/gold palette, bookshelves)
- **Debug Panel:** Right sidebar with sections for World State (room name, time of day, corruption level), Day/Night controls (skip buttons, speed slider), HUD Config (toggle checkboxes), Room Map display
- **Header:** Title, back link to `/test`
- **HUD Elements:** Health bar (top-left), ability bar (bottom-left), weapon indicator (bottom-center), day/night clock (top-right), room name display (bottom-right, fades in)

**Test Steps:**
1. **Page Load:** Navigate to URL. Wait 2s for canvas. Verify canvas renders with player visible and Scribe Hall background (warm parchment tones).
2. **Initial Screenshot:** Capture idle state. Verify HUD elements visible: health bar, ability icons, weapon, clock.
3. **Move to Exit:** Press Right arrow for ~3 seconds to move player toward right edge. Observe room name display fading in.
4. **Room Transition:** Walk into the right exit zone. Verify fade-to-black transition triggers (0.3s out → room swap → 0.3s in). Take screenshot during/after transition.
5. **New Room Verification:** After transition completes, verify new room loads (different platform layout). Room name should appear at bottom-right.
6. **Day/Night Controls:** In debug panel, click "Skip to Night" button. Verify screen darkens, corruption effects begin (if in non-hub room), clock shows night phase.
7. **Combat Test:** Press J to attack. Verify attack animation/hitbox overlay appears. If enemies present, verify hit feedback.
8. **Minimap:** Verify minimap renders in debug panel showing room graph with player dot indicator.
9. **Return to Hub:** Navigate back toward hub room. Verify corruption effects cease in hub (immunity).

**Pass Criteria:**
- [ ] Canvas renders with player and platforms visible
- [ ] HUD elements all render (health, abilities, weapon, clock, room name)
- [ ] Room transition triggers on exit zone contact
- [ ] Fade-to-black transition animation plays
- [ ] New room loads with different layout after transition
- [ ] Day/night cycle controls change visual atmosphere
- [ ] Minimap shows room graph
- [ ] Debug panel has world state info and controls
- [ ] Hub room suppresses corruption
- [ ] Back link to `/test` works

---

### Page 2: HUD (`/test/hud`)

**URL:** `http://localhost:3000/test/hud`

**Expected Elements:**
- **Canvas:** 960×540, showing player on platforms with spikes, target dummies, and full HUD overlay
- **Debug Panel:** Right sidebar with HUD element toggles (checkboxes for health, abilities, weapon, clock, room name, minimap, notifications), notification send buttons, day/night phase skip buttons
- **HUD Layout:**
  - Health bar: top-left (120×12px red bar)
  - Ability bar: bottom-left (4 slots, 40×52px each with keybind labels and icons)
  - Weapon indicator: bottom-center (weapon name + icon + `[K]` switch hint)
  - Day/night clock: top-right (sun/moon icon, phase name, progress bar)
  - Room name: bottom-right (fade-in/hold/fade-out)

**Test Steps:**
1. **Page Load:** Navigate to URL. Wait 2s. Verify HUD elements render over game canvas.
2. **Initial Screenshot:** Capture full HUD state. All 5 main HUD sections should be visible.
3. **Toggle HUD Elements:** In debug panel, uncheck "Show Health" → health bar disappears. Re-check → reappears. Repeat for each toggle.
4. **Send Notification:** Click notification send button in debug panel. Verify notification appears on left side with fade-in animation, colored by type.
5. **Take Damage:** Walk player into spikes (ArrowDown/ArrowRight toward hazard). Health bar should decrease, flash white briefly.
6. **Weapon Switch:** Press K. Weapon indicator should change (quill-spear ↔ ink-snap). Take screenshot showing changed weapon.
7. **Attack:** Press J. Verify attack visual appears (hitbox overlay in debug mode). If near target dummy, verify hit feedback (damage number, hitstop).
8. **Ability Cooldown:** Press E/Q/R to use abilities. Verify ability bar shows cooldown sweep overlay on the used ability slot.
9. **Day/Night Clock:** Use debug panel to skip phases. Verify clock updates (sun→moon icon, phase name changes, progress arc advances).
10. **Pause Menu:** Press Escape. Verify dark overlay (70% black) with centered menu (Resume/Quit options). Press Escape again to unpause.

**Pass Criteria:**
- [ ] All 5 HUD sections render at correct positions
- [ ] HUD toggles in debug panel show/hide elements
- [ ] Notifications appear with correct styling and fade animation
- [ ] Health bar responds to damage (decreases, white flash)
- [ ] Weapon indicator updates on K press
- [ ] Ability cooldown overlays appear after ability use
- [ ] Day/night clock updates with phase changes
- [ ] Pause menu renders and dismisses correctly
- [ ] Low health (1 HP) shows red/orange pulse on health bar

---

### Page 3: Sprites (`/test/sprites`)

**URL:** `http://localhost:3000/test/sprites`

**Expected Elements:**
- **Canvas:** 960×540, showing player character with current render mode
- **Debug Panel:** Right sidebar with render mode toggle (3-way: sprites / rectangles / both), animation strip preview, asset status indicators (loaded vs placeholder), FPS slider
- **Render Modes:**
  - Rectangles: colored rectangles as in all other test pages (default for test pages)
  - Sprites: sprite sheet frames (placeholder colored rects with frame numbers if no real images exist)
  - Both: sprite + semi-transparent rectangle overlay

**Test Steps:**
1. **Page Load:** Navigate to URL. Wait 2s. Verify canvas renders player in default render mode.
2. **Initial Screenshot:** Capture default state.
3. **Switch to Rectangles:** Select "rectangles" mode. Verify player renders as a colored rectangle (same as other test pages). Take screenshot.
4. **Switch to Sprites:** Select "sprites" mode. Verify player renders using sprite system (placeholder frames with frame numbers if no real assets). Take screenshot.
5. **Switch to Both:** Select "both" mode. Verify sprite renders with semi-transparent rectangle overlay. Take screenshot.
6. **Animation Preview:** Check animation strip section in debug panel. Verify individual frames are shown.
7. **Asset Status:** Check asset status indicators. Each defined sprite sheet should show "loaded" or "placeholder" status.
8. **FPS Slider:** Adjust animation FPS slider. Verify animation speed changes visually.
9. **Player Movement:** Press arrow keys. Verify animations change with player state (idle → run → jump etc.) regardless of render mode.

**Pass Criteria:**
- [ ] Canvas renders in all 3 modes without errors
- [ ] Rectangles mode matches standard test page appearance
- [ ] Sprites mode shows sprite frames (real or placeholder)
- [ ] Both mode overlays rectangle on sprite
- [ ] Animation strip preview displays in debug panel
- [ ] Asset status indicators show for each sprite sheet
- [ ] FPS slider changes animation playback speed
- [ ] Player state changes trigger animation switches

---

### Page 4: Save/Load (`/test/save-load`)

**URL:** `http://localhost:3000/test/save-load`

**Expected Elements:**
- **This is a React UI page** (no game canvas) — different from other test pages
- **Layout:** Save slot cards/rows for 3 slots, connection status banner, operation log
- **Save Slot UI:** Each slot shows: player name, room, completion %, play time, death count, or "Empty" state
- **Controls:** Save button, Load button, Delete button per slot
- **Connection Banner:** Shows "Mock Mode" (localStorage) or "Connected" (Convex)

**Test Steps:**
1. **Page Load:** Navigate to URL. Wait 2s. Verify save slot UI renders with 3 slots.
2. **Initial Screenshot:** Capture initial state. All 3 slots should show "Empty" on fresh run.
3. **Connection Status:** Verify banner shows connection mode (likely "Mock Mode" since Convex isn't deployed).
4. **Save to Slot 1:** Click Save on slot 1. Verify slot populates with data (player name, room, completion %, play time).
5. **Save to Slot 2:** Click Save on slot 2. Verify second slot populates.
6. **Load from Slot:** Click Load on a populated slot. Verify operation log shows "Loaded" confirmation.
7. **Delete Slot:** Click Delete on a populated slot. Verify confirmation dialog appears. Confirm deletion. Verify slot returns to "Empty".
8. **Back Navigation:** Verify link back to `/test` works.

**Pass Criteria:**
- [ ] 3 save slots render
- [ ] Connection status banner is visible
- [ ] Save operation populates a slot with game data
- [ ] Load operation shows confirmation
- [ ] Delete has confirmation dialog before executing
- [ ] Deleted slot returns to empty state
- [ ] Operation log shows recent actions
- [ ] Back link to `/test` works

---

### Page 5: Herbarium Wing (`/test/herbarium-wing`)

**URL:** `http://localhost:3000/test/herbarium-wing`

**Expected Elements:**
- **Canvas:** 960×540, showing player in herbarium-folio biome (green palette, vine anchors visible)
- **Debug Panel:** Right sidebar with room map, player params, vine params, world state
- **Gameplay:** Full abilities unlocked, combat system, vine mechanics, room transitions, enemies

**Test Steps:**
1. **Page Load:** Navigate to URL. Wait 2s. Verify canvas renders with herbarium-folio theme (green/parchment palette).
2. **Initial Screenshot:** Capture starting room (likely Vine Vestibule). Verify vine anchors visible as glowing circles.
3. **Vine Mechanics:** Move player near a vine anchor. Press E (Ability1) to attach. Verify player swings from vine (pendulum motion). Press Space to detach. Take screenshot mid-swing.
4. **Room Transition:** Navigate to an exit. Verify fade-to-black transition. New room loads with different layout and possibly enemies.
5. **Enemy Encounter:** Find a room with enemies (Overgrown Stacks has 2 Readers). Verify enemies render and have basic AI (move toward player). Press J to attack. Verify hit detection.
6. **Ability Gate:** Navigate to a room with a gate (Root Cellar has Margin Stitch gate). Verify colored barrier renders. Approach gate — should auto-open (all abilities unlocked in test).
7. **Room Map:** In debug panel, verify room map shows the 8-room Herbarium Wing layout with current room highlighted.
8. **Surface Types:** Navigate to Mushroom Grotto. Verify different surface types visible (bouncy/icy/sticky platforms with distinct colors).
9. **Multiple Rooms:** Navigate through at least 3 rooms. Verify transitions work consistently.

**Pass Criteria:**
- [ ] Herbarium-folio biome theme renders (green/parchment colors)
- [ ] Vine anchors render and vine attach/swing works
- [ ] Room transitions work between connected rooms
- [ ] Enemies spawn and have basic AI
- [ ] Combat hit detection works against enemies
- [ ] Ability gates render with correct colors
- [ ] Room map in debug panel shows wing layout
- [ ] Surface type platforms are visually distinct
- [ ] Back link to `/test` works

---

### Page 6: Main Menu (`/`)

**URL:** `http://localhost:3000/`

**Expected Elements:**
- **No game canvas** — this is a React page with decorative animation
- **Ink Wash Background:** Decorative canvas with ~50 ink particles drifting upward
- **Title:** "INKBINDERS" (large, centered text)
- **Menu Options:** Continue (most recent save), New Game, Test Pages
- **Keyboard Navigation:** Up/Down to select, Enter to confirm
- **Menu Screens:** main → slot-select (on New Game) → name-entry (on slot select)

**Test Steps:**
1. **Page Load:** Navigate to URL. Wait 2s. Verify title screen renders with "INKBINDERS" text and ink wash particle background.
2. **Initial Screenshot:** Capture title screen. Verify decorative particles animate (ink wash effect).
3. **Menu Options:** Verify 3 menu options visible: Continue, New Game, Test Pages.
4. **Keyboard Navigation:** Press Down arrow to move selection. Verify selection highlight changes. Press Up to move back.
5. **New Game Flow:** Select "New Game" (navigate to it, press Enter). Verify save slot selection modal appears with 3 slots.
6. **Slot Selection:** Select an empty slot. Verify name entry screen appears with text input (default "Archivist").
7. **Name Entry:** Type a name. Verify character limit (20 chars) and allowed characters (alphanumeric + spaces).
8. **Back Navigation:** Press back/escape to return through screens (name-entry → slot-select → main).
9. **Test Pages Link:** Select "Test Pages" option. Verify navigation to `/test`.

**Pass Criteria:**
- [ ] Title "INKBINDERS" renders prominently
- [ ] Ink wash background animation plays (particles drift)
- [ ] 3 menu options visible and selectable
- [ ] Keyboard navigation (Up/Down/Enter) works
- [ ] New Game opens save slot selection
- [ ] Empty slot leads to name entry
- [ ] Name entry has character limit and validation
- [ ] Back navigation works through menu screens
- [ ] Test Pages option navigates to `/test`

---

### Page 7: Play Page (`/play`)

**URL:** `http://localhost:3000/play?slot=1&new=1`

**Expected Elements:**
- **Loading Screen:** Brief loading display (minimum 500ms) with "Loading..." text
- **Canvas:** 960×540, full game session — player in starting room with full HUD
- **HUD:** Health bar, ability bar, weapon indicator, day/night clock, room name
- **Full Systems:** Combat, all 4 abilities, day/night cycle, room transitions, pause menu

**Test Steps:**
1. **Page Load:** Navigate to URL with `?slot=1&new=1` params. Verify loading screen appears briefly.
2. **Initial Screenshot:** After loading, verify game canvas renders with player in tutorial-corridor (starting room for new game). Full HUD should be visible.
3. **Player Movement:** Press arrow keys. Verify player moves smoothly with full movement system (run, jump, dash, wall-slide).
4. **HUD Verification:** Verify all HUD elements: health bar (top-left), ability bar (bottom-left), weapon (bottom-center), clock (top-right), room name (bottom-right, fading in with "Tutorial Corridor").
5. **Combat:** Press J to attack. Verify weapon swing visual. Press K to switch weapons. Verify weapon indicator updates.
6. **Abilities:** Press E, Q, R to test abilities (may need targets nearby). Verify ability bar shows cooldown.
7. **Room Transition:** Walk to a room exit. Verify fade transition and new room loads.
8. **Pause Menu:** Press Escape. Verify 4-option pause menu: Resume, Save Game, Save & Quit, Quit. Use Up/Down to navigate. Press Escape or select Resume to unpause.
9. **Auto-Save:** After room transition, verify game state persists (no visible indicator needed — just no crash).
10. **Redirect Check:** Navigate to `/play` without params. Verify redirect to `/` (main menu).

**Pass Criteria:**
- [ ] Loading screen appears briefly on page load
- [ ] Game canvas renders with player and platforms
- [ ] Full movement system works (run, jump, dash, wall-slide)
- [ ] All HUD elements visible and functional
- [ ] Combat system works (attack, weapon switch)
- [ ] Room transitions work with fade animation
- [ ] Pause menu renders with 4 options
- [ ] Abilities are available and show cooldown feedback
- [ ] `/play` without params redirects to `/`
- [ ] No console errors during gameplay

---

## Structural Verification Script

Run the following bash script to verify pages load and contain expected elements:

```bash
#!/bin/bash
# Visual Test Structural Verification — Integration Pages

DEV_SERVER="http://localhost:3000"
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
      echo "  Canvas: MISSING"
      FAIL=$((FAIL + 1))
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

  # Check slider count (range inputs)
  sliders=$(echo "$html" | grep -oi '<input[^>]*type="range"' | wc -l | tr -d ' ')
  echo "  Sliders: $sliders"
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

---

## Verification Checklist

After creating the playbook and running structural checks:

- [ ] `scripts/visual-tests/integration.md` created with all 7 page procedures
- [ ] All 7 pages return HTTP 200
- [ ] Pages with game canvas have `<canvas>` element in HTML
- [ ] Test pages have back navigation to `/test`
- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] Verification results documented in a summary table

## Deliverables

1. **Playbook file:** `scripts/visual-tests/integration.md`
2. **Structural verification:** Run the bash script against the dev server
3. **Test report:** Summary table of all 7 pages with pass/fail status

## Notes

- The Save/Load page is a **React UI page** (not a canvas game page). It won't have a `<canvas>` element. Verify the save slot UI renders instead.
- The Main Menu has a decorative `InkWashBackground` canvas for particle effects, not a game canvas. The page itself is React-rendered.
- The Play Page requires query params (`?slot=1&new=1`) to avoid redirect. Without params it should redirect to `/`.
- Some pages may render content client-side only. The structural HTML check via `curl` may not capture dynamically rendered elements. This is expected — the playbook documents what to verify visually.
- If browser MCP is available, execute the interactive test steps. If not, the structural verification + playbook creation is the minimum deliverable.
- Follow the same format as existing playbooks in `scripts/visual-tests/` (see `core-movement.md` for reference).

---

## Completion Summary

### What Was Built

Created `scripts/visual-tests/integration.md` — a comprehensive visual test playbook for all 7 integration-level pages, following the established format from `core-movement.md`.

The playbook covers:
1. **World Assembly** (`/test/world-assembly`) — Full world integration with room transitions, day/night, HUD, minimap
2. **HUD** (`/test/hud`) — HUD element toggles, notifications, damage feedback, weapon switching, pause menu
3. **Sprites** (`/test/sprites`) — Render mode toggle (sprites/rectangles/both), animation strip preview, asset status
4. **Save/Load** (`/test/save-load`) — React UI page with 3 save slots, mock game state editor, CRUD operations
5. **Herbarium Wing** (`/test/herbarium-wing`) — Biome content with vine mechanics, 9-room layout, enemies, surface types
6. **Main Menu** (`/`) — Title screen with ink wash animation, keyboard menu navigation, new game flow
7. **Play Page** (`/play`) — Full game session with all systems, pause menu, auto-save, redirect validation

### Structural Verification Results

| Page | HTTP Status | Canvas/UI | Back Link | Notes |
|------|-------------|-----------|-----------|-------|
| /test/world-assembly | 200 OK | Canvas present | Yes | |
| /test/hud | 200 OK | Canvas present | Yes | |
| /test/sprites | 200 OK | Canvas present | Yes | |
| /test/save-load | 200 OK | N/A (React UI) | Yes | |
| /test/herbarium-wing | 200 OK | Canvas present | Yes | |
| / (main menu) | 200 OK | Client-side rendered | N/A | Canvas renders via useEffect |
| /play?slot=1&new=1 | 200 OK | Canvas present | N/A | Redirect without params is client-side |

- **TypeScript:** `npx tsc --noEmit` passes with 0 errors
- **All 7 pages:** HTTP 200
- **Canvas pages:** 5/5 test pages have canvas references in HTML; main menu canvas is client-side only (expected)
- **Back links:** 5/5 test pages have back navigation to `/test`

### Files Changed

| File | Action |
|------|--------|
| `scripts/visual-tests/integration.md` | Created — 7-page integration visual test playbook |

---

## Review Notes (c05388b8)

**Reviewed:** 2026-02-25

**Verdict:** Clean — no issues found.

- The playbook file (`scripts/visual-tests/integration.md`) was created and follows the established format from the other category playbooks.
- Port numbers correctly use `localhost:4000` per CLAUDE.md, despite the task description template referencing `localhost:3000`.
- All 7 integration pages are covered with detailed test steps, expected elements, and pass criteria checklists.
- The structural verification script uses the correct port and URLs.
- No engine code or React components were created/modified — this was purely a documentation task.
- No fixes needed.
