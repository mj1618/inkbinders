# Visual Test Playbook: Ability Pages

## Prerequisites

- Dev server running: `cd /Users/matt/code/inkbinders && npm run dev`
- Browser open to `http://localhost:3000`
- All 4 ability test pages accessible from `/test` hub

## Key Bindings (All Pages)

| Key | Action |
|-----|--------|
| Arrow keys | Movement |
| Z / Space | Jump |
| X / Shift | Dash |
| Down | Crouch |
| E | Ability1 (Margin Stitch) |
| Q | Ability2 (Redaction) |
| R | Ability3 (Paste-Over / Index Mark) |

---

## Test 1: Margin Stitch (`/test/margin-stitch`)

**Ability key:** E (Ability1)
**Level:** 960x540 (standard canvas, no scrolling)
**Spawn:** Left side of level (~80, 350)

### Page Load Verification

1. Navigate to `http://localhost:3000/test/margin-stitch`
2. Wait 2 seconds for canvas initialization
3. Verify these elements are present:
   - [ ] `<canvas>` element (960x540 game canvas)
   - [ ] Player rectangle visible on canvas (left side of level)
   - [ ] Platforms/walls rendered (including wall pairs A-D)
   - [ ] Debug panel sidebar on the right with:
     - Stitch Info section (State, Timer, Cooldown, Pairs in range, Target distance)
     - Stitch Params sliders (Max Range, Duration, Cooldown, Passage Height)
     - Player Movement sliders (collapsed)
     - Controls section (Reset Player, Debug Overlays toggle, Range Circle toggle)
   - [ ] FPS counter on canvas (top-left)
   - [ ] State label above player
   - [ ] Pass criteria section (10 items)
   - [ ] Navigation link back to `/test`

### Interaction Test

1. **Move toward Wall Pair A:**
   - Press and hold Right Arrow for ~1 second
   - Verify: Player moves right, velocity vector (amber arrow) visible, state changes to RUNNING
   - Screenshot: Player has moved, wall pair visible ahead

2. **Activate Margin Stitch:**
   - With player near Wall Pair A, press E
   - Verify visual feedback:
     - [ ] Range circle (cyan dashed) appears around player (if Range Circle toggle is ON)
     - [ ] Wall pair within range is highlighted
     - [ ] Passage opens in the wall pair (semi-transparent gap)
     - [ ] Particle effects at stitch location
     - [ ] Cooldown bar below player (orange when active, green when ready)
     - [ ] Debug panel Stitch Info updates: State = ACTIVE, Timer counting down
   - Screenshot: Stitch is active, passage visible

3. **Traverse the stitched passage:**
   - Press Right Arrow to walk through the opened passage
   - Verify: Player passes through the wall pair
   - Screenshot: Player on the other side of the wall

4. **Stitch expiration:**
   - Wait for the stitch timer to expire (check Duration slider value, default ~3-5s)
   - Verify: Passage closes, wall pair restored, cooldown begins
   - Screenshot: Wall restored, cooldown indicator shown

### Expected Canvas Rendering

- Player: colored rectangle with hitbox outline
- Walls: solid colored rectangles
- Stitched passage: semi-transparent gap in wall pair
- Range circle: dashed cyan circle (toggleable)
- Particles: small colored rectangles at stitch location
- Cooldown: colored bar below player (orange = cooling, green = ready)
- Diagnostics box: bottom-left with stitch state info
- Velocity readout: top-right

---

## Test 2: Redaction (`/test/redaction`)

**Ability key:** Q (Ability2)
**Level:** 960x540 (standard canvas, no scrolling)
**Spawn:** Left side (~60, 340)

### Page Load Verification

1. Navigate to `http://localhost:3000/test/redaction`
2. Wait 2 seconds for canvas initialization
3. Verify these elements are present:
   - [ ] `<canvas>` element (960x540 game canvas)
   - [ ] Player rectangle visible (left side)
   - [ ] Obstacles visible: spike pit, barriers (solid walls), elevated spikes, overhead laser
   - [ ] HP bar above player (green)
   - [ ] Debug panel sidebar with:
     - Redaction Info (State, Active count)
     - Redaction Params sliders (Max Range, Duration, Cooldown, Max Active, Visual Speed, Aim Cone)
     - Damage & Health sliders (collapsed)
     - Player Movement sliders (collapsed)
     - Controls (Reset Player, Debug Overlays, Range Circle, Aim Cone toggles)
   - [ ] Pass criteria section (15 items)
   - [ ] Navigation link back to `/test`

### Interaction Test

1. **Approach obstacles:**
   - Press Right Arrow for ~1.5 seconds to move toward the spike pit area
   - Verify: Obstacles (spikes, barriers) rendered distinctly
   - Screenshot: Player near obstacles, obstacles visible

2. **Activate Redaction:**
   - Press Q to activate Redaction on the nearest obstacle
   - Verify visual feedback:
     - [ ] Range circle (red dashed) around player (if toggle ON)
     - [ ] Aim cone overlay (red semi-transparent sector) in facing direction (if toggle ON)
     - [ ] Targeted obstacle highlights/fades
     - [ ] Ink mark expansion animation on targeted obstacle
     - [ ] Particles at redaction site
     - [ ] Debug panel updates: State shows active, Active count increments
   - Screenshot: Redaction active on obstacle

3. **Observe redacted state:**
   - Wait ~2 seconds for redaction to be clearly visible
   - Verify: Redacted obstacle rendered semi-transparent/ghosted
   - If obstacle was spikes: they should be inert (no damage on contact)
   - If obstacle was barrier: it should be passable (no collision)
   - Screenshot: Obstacle in ghosted/redacted state

4. **Test damage (optional):**
   - Walk into an active (non-redacted) spike or laser
   - Verify: HP bar decreases, red flash on player (i-frames), damage feedback
   - Screenshot: Player taking damage, HP reduced

### Expected Canvas Rendering

- Player: colored rectangle, HP bar above (green/yellow/red)
- Obstacles: colored with alpha (red-ish for active, gray for redacted)
- Range circle: dashed red circle
- Aim cone: filled red semi-transparent sector
- Ink mark: expanding dark overlay on targeted obstacle
- Diagnostics: bottom-left with redaction state, HP, i-frames

---

## Test 3: Paste-Over (`/test/paste-over`)

**Ability key:** R (Ability3)
**Level:** 1920x540 (2x width, camera scrolls horizontally)
**Spawn:** Left side (~80, 400)

### Page Load Verification

1. Navigate to `http://localhost:3000/test/paste-over`
2. Wait 2 seconds for canvas initialization
3. Verify these elements are present:
   - [ ] `<canvas>` element (960x540 viewport into 1920px wide level)
   - [ ] Player rectangle visible (left side, Zone 1)
   - [ ] Surface platforms visible with distinct colors:
     - Normal, Bouncy (cyan), Icy (blue), Sticky (amber), Conveyor (green)
   - [ ] Zone label "SOURCE SURFACES" visible (large semi-transparent text)
   - [ ] Paste-Over HUD (top area): Clipboard, Active Pastes, Cooldown, Target indicators
   - [ ] Debug panel sidebar with:
     - Paste-Over Info (Clipboard, Active Pastes, Cooldown, Target, Standing on, Wall Surface)
     - Paste-Over Params sliders (Paste Range, Duration, Cooldown, Max Active)
     - Surface Properties sliders (Bouncy bounce/accel, Icy friction/speed, Sticky friction/speed/wall, Conveyor speed)
     - Player Movement sliders (collapsed)
     - Controls (Reset Player, Reset Params, Reset All Surfaces, Debug Overlays)
   - [ ] Pass criteria section (18 items)
   - [ ] Navigation link back to `/test`

### Interaction Test

1. **Auto-capture a surface:**
   - Press Right Arrow to move onto the bouncy platform (2nd platform in Zone 1)
   - Verify: Clipboard HUD updates to show "bouncy" was auto-captured
   - Screenshot: Player on bouncy surface, clipboard shows "bouncy"

2. **Move to a normal platform:**
   - Continue right to reach a normal-surface platform past Zone 1
   - Verify: Camera scrolls to follow player (look-ahead)
   - Screenshot: Player on normal platform, Zone 2 coming into view

3. **Paste the surface:**
   - Press R to paste the bouncy surface onto the current platform
   - Verify visual feedback:
     - [ ] Platform color changes to match bouncy surface (cyan)
     - [ ] Particles spawn at paste location
     - [ ] Paste-Over HUD shows Active Pastes count incremented
     - [ ] Timer indicator for remaining paste duration
     - [ ] Debug panel updates accordingly
   - Screenshot: Platform color changed, paste active

4. **Test bounced surface:**
   - Jump and land on the pasted-bouncy platform
   - Verify: Player bounces (reflected vertical velocity)
   - Screenshot: Player bouncing (elevated position after landing)

5. **Camera scrolling test:**
   - Continue moving right through Zones 2-4
   - Verify: Camera tracks player, zone labels change, new challenge areas appear
   - Screenshot: Player in Zone 3 or 4 with camera having scrolled

### Expected Canvas Rendering

- Player: colored rectangle with hitbox
- Platforms: color-coded by surface type (with labels)
- Zone labels: large semi-transparent text
- Clipboard HUD: top area showing captured surface
- Surface properties readout near player
- Paste timer indicator on affected platforms
- Camera pans horizontally

---

## Test 4: Index Mark (`/test/index-mark`)

**Ability key:** R (Ability3) - tap to place, hold to select + teleport
**Level:** 3840x1080 (4x width, 2x height - large exploration area)
**Spawn:** Starting Area (~60, 600)

### Page Load Verification

1. Navigate to `http://localhost:3000/test/index-mark`
2. Wait 2 seconds for canvas initialization
3. Verify these elements are present:
   - [ ] `<canvas>` element (960x540 viewport into 3840x1080 level)
   - [ ] Player rectangle visible (Starting Area, left side)
   - [ ] Tower staircase platforms visible (ascending platforms on left)
   - [ ] Area label "AREA 1: Starting" visible (large semi-transparent text)
   - [ ] Goal zones visible (colored semi-transparent rectangles with labels)
   - [ ] Index Mark HUD (top-right): mark inventory circles, cooldown indicator
   - [ ] Debug panel sidebar with:
     - Index Mark Info (Marks count/max, State)
     - Index Mark Params sliders (Max Marks, Hold Threshold, Teleport Cooldown, Visual Duration, Teleport I-Frames, Mark Lifetime, Marks Expire toggle)
     - Player Movement sliders (collapsed)
     - Controls (Reset Player, Clear All Marks, Reset Goals, Reset Params, Debug Overlays)
   - [ ] Pass criteria section (16 items)
   - [ ] Navigation link back to `/test`

### Interaction Test

1. **Place an Index Mark:**
   - Short-press R (tap and release quickly)
   - Verify: A colored bookmark tab appears at player's position (amber for first mark)
   - Verify: Debug panel shows Marks: 1/4 (or current max)
   - Screenshot: Mark visible at player position

2. **Move away from mark:**
   - Press Right Arrow for ~2-3 seconds to move significantly away from the mark
   - Verify: Mark remains visible at its original position (may scroll off-screen in large level)
   - Screenshot: Player far from mark

3. **Enter teleport selection:**
   - Hold R for ~0.5-1 second (hold for 4+ frames to enter selection mode)
   - Verify:
     - [ ] Selection mode indicator appears
     - [ ] Dashed line (selection beam) from player to selected mark
     - [ ] Debug panel shows State: SELECTING
   - Screenshot: Selection mode active

4. **Teleport to mark:**
   - Release R to teleport
   - Verify:
     - [ ] Player position snaps to mark location
     - [ ] Velocity zeroed (player stops moving)
     - [ ] Brief teleport flash/trail effect
     - [ ] Camera snaps (if distance > 400px) or smooth lerp (if closer)
     - [ ] I-frame flicker (amber) after teleport
     - [ ] Debug panel shows cooldown timer
   - Screenshot: Player at mark position, teleport effects visible

5. **Multiple marks (optional):**
   - Place 2-3 more marks at different locations
   - Hold R and use Left/Right arrows to cycle between marks
   - Verify: Selection beam moves between marks, HUD updates
   - Release to teleport to non-default mark
   - Screenshot: Multiple marks placed, cycling selection

### Expected Canvas Rendering

- Player: colored rectangle (amber flash during i-frames)
- Marks: colored bookmark tabs (amber, blue, green, red cycling)
- Selection beam: dashed line from player to selected mark
- Teleport effect: flash/trail
- Goal zones: colored semi-transparent rectangles with labels
- Area labels: large semi-transparent text
- Puzzle timer (Area 4): countdown display
- Diagnostics: bottom-left with state, marks, goals, i-frames

---

## Test Report Template

| Page | Loads? | Canvas Renders? | Debug Panel? | Ability Effect? | Issues |
|------|--------|-----------------|--------------|-----------------|--------|
| Margin Stitch | | | | | |
| Redaction | | | | | |
| Paste-Over | | | | | |
| Index Mark | | | | | |

### Per-Page Report Fields

For each page, record:
1. **URL:** The page URL tested
2. **Page Load:** Pass/Fail + any errors in browser console
3. **Canvas Rendering:** Pass/Fail — canvas shows player, platforms, obstacles
4. **Debug Panel:** Pass/Fail — sidebar visible with correct sliders and info sections
5. **Ability Activation:** Pass/Fail — ability key triggered visible effect on canvas
6. **Debug Overlays:** Pass/Fail — hitboxes, velocity vectors, state labels shown
7. **Pass Criteria:** Count of criteria that appeared verifiable from visual inspection
8. **Screenshots:** List of screenshots captured with descriptions
9. **Issues:** Any errors, visual glitches, or unexpected behavior

---

## Quick Smoke Test (5 minutes)

For a fast verification that all pages are functional:

1. Open each page URL in sequence
2. Verify canvas is not blank (player + platforms visible)
3. Press the ability key (E/Q/R) once
4. Verify any visual change occurred on canvas
5. Check debug panel updates in response

| Page | URL | Key | Quick Check |
|------|-----|-----|-------------|
| Margin Stitch | `/test/margin-stitch` | E | Passage opens in wall |
| Redaction | `/test/redaction` | Q | Obstacle fades/ghosts |
| Paste-Over | `/test/paste-over` | R | Platform color changes |
| Index Mark | `/test/index-mark` | R (tap) | Bookmark tab placed |
