# Visual Test Playbook — Core Movement Pages

## Overview

This playbook documents the visual test procedure for the 6 core movement test pages in Inkbinders. Each test verifies that the page renders correctly, the debug panel is functional, and player input causes visible movement on the canvas.

## Prerequisites

- Dev server running: `npm run dev` (serves at `http://localhost:3000`)
- Browser with DevTools available (check console for JS errors)
- Keyboard input available (arrow keys, space, shift)

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

---

## Test 1: Ground Movement (`/test/ground-movement`)

**URL:** `http://localhost:3000/test/ground-movement`

### Expected Elements
- **Canvas:** 960x540, showing player rectangle (~32x48px) on platforms
- **Debug Panel:** Right sidebar with 10 sliders in 3 sections (Movement, Crouch/Slide, Physics)
- **Header:** Title "Ground Movement", phase badge, link back to `/test`
- **Pass Criteria:** 8 criteria listed below canvas
- **Debug Overlays:** Hitbox outline (cyan), velocity vector (amber arrow), state label (purple)

### Test Steps

1. **Page Load**
   - Navigate to URL
   - Wait 2 seconds for canvas to initialize
   - Verify canvas is not blank (player rect and platforms visible)
   - Verify debug panel sidebar is visible with sliders
   - Check browser console for JS errors (should be none)

2. **Movement Test**
   - Press and hold ArrowRight for ~1 second
   - Verify: Player moves right with visible acceleration
   - Verify: State label changes to "RUNNING"
   - Verify: Velocity vector arrow appears and grows
   - Release ArrowRight
   - Verify: Player decelerates to stop

3. **Turn-around Test**
   - While moving right, press ArrowLeft
   - Verify: Player quickly reverses direction
   - Verify: Dust particles appear at turn point

4. **Crouch Test**
   - Press ArrowDown while standing
   - Verify: Player hitbox shrinks (squash visual)
   - Verify: State label shows "CROUCHING"

5. **Slider Test**
   - Adjust "Max Run Speed" slider
   - Move player again
   - Verify: Movement speed changes to match new slider value

### Pass Criteria Checklist
- [ ] Smooth accel/decel
- [ ] Snappy turn-around
- [ ] Crouch reduces hitbox
- [ ] Crouch-slide maintains momentum
- [ ] Slide under low ceilings
- [ ] Can't stand under ceiling
- [ ] Falls off ledges
- [ ] All sliders update live

---

## Test 2: Jumping (`/test/jumping`)

**URL:** `http://localhost:3000/test/jumping`

### Expected Elements
- **Canvas:** 960x540, multi-platform level with gaps
- **Debug Panel:** 19 sliders in 5 sections (Movement, Crouch/Slide, Jump, Input Tuning, Air Control)
- **Debug Overlays:** Coyote time indicator (gold bar), apex glow effect

### Test Steps

1. **Page Load**
   - Navigate to URL, wait 2s
   - Verify canvas renders player on platforms
   - Verify debug panel has Jump-specific sliders (jumpSpeed, coyoteFrames, etc.)

2. **Short Hop**
   - Tap Space quickly
   - Verify: Player does a small hop
   - Verify: State transitions IDLE → JUMPING → FALLING → IDLE

3. **Full Jump**
   - Press and hold Space
   - Verify: Player jumps higher than the short hop
   - Verify: Floaty rise, snappier fall (asymmetric arc)

4. **Apex Hang Time**
   - Perform a full jump and watch the peak
   - Verify: Brief hang time at the apex (floaty moment)
   - Verify: Apex glow effect visible at jump peak

5. **Coyote Time**
   - Run off a ledge (ArrowRight to walk off edge)
   - Immediately press Space after leaving the platform
   - Verify: Jump still activates briefly after leaving ground (coyote time)
   - Verify: Gold bar overlay shows coyote time window

6. **Air Control**
   - Jump and steer with ArrowLeft/ArrowRight while airborne
   - Verify: Player can adjust horizontal direction mid-air

### Pass Criteria Checklist
- [ ] Short tap = small hop
- [ ] Hold = full arc
- [ ] Floaty rise / snappy fall
- [ ] Apex hang time
- [ ] Coyote time (~7f)
- [ ] Jump buffer on landing
- [ ] Air control with momentum bias
- [ ] Ceiling stops jump
- [ ] Jump from crouch
- [ ] All sliders update live

---

## Test 3: Wall Mechanics (`/test/wall-mechanics`)

**URL:** `http://localhost:3000/test/wall-mechanics`

### Expected Elements
- **Canvas:** 960x540, walls on both sides of the level, chimney corridor
- **Debug Panel:** 25 sliders including wall-specific params (wallSlideSpeed, wallJumpSpeed, etc.)
- **Debug Overlays:** Wall-touching indicator, state labels for WALL_SLIDING/WALL_JUMPING

### Test Steps

1. **Page Load**
   - Navigate to URL, wait 2s
   - Verify canvas shows vertical walls on left and right
   - Verify debug panel has Wall Mechanics sliders

2. **Wall Slide**
   - Jump toward a wall and hold the direction into the wall (ArrowRight at right wall)
   - Verify: Player slides down the wall at controlled speed
   - Verify: State label shows "WALL_SLIDING"
   - Verify: Dust particles at wall contact

3. **Wall Jump**
   - While wall sliding, press Space
   - Verify: Player launches away from the wall
   - Verify: Brief input lockout prevents immediate re-stick
   - Verify: State shows "WALL_JUMPING" then "FALLING"

4. **Wall Jump Chaining**
   - Between two parallel walls (chimney corridor), wall-jump back and forth
   - Verify: Can chain wall-jumps to climb upward

5. **Wall Coyote Time**
   - Fall past a wall and immediately press Space
   - Verify: Wall-jump activates briefly after leaving wall

### Pass Criteria Checklist
- [ ] Slide down walls at controlled speed
- [ ] Hold toward wall = slower grip
- [ ] Wall-slide stops at ground
- [ ] Wall-jump launches at fixed angle
- [ ] Brief input lockout prevents re-stick
- [ ] Normal air control after lockout
- [ ] Chain wall-jumps between parallel walls
- [ ] Climb chimney corridor
- [ ] Wall coyote time
- [ ] No wall-slide when jumping upward
- [ ] All sliders update live
- [ ] Ground movement still works

---

## Test 4: Dash (`/test/dash`)

**URL:** `http://localhost:3000/test/dash`

### Expected Elements
- **Canvas:** 960x540, level with space for 8-directional dashing
- **Debug Panel:** 31 sliders covering dash speed, duration, cooldown, wind-up, boost
- **Debug Overlays:** Dash trail/afterimage, cooldown indicator

### Test Steps

1. **Page Load**
   - Navigate to URL, wait 2s
   - Verify canvas and debug panel render

2. **Ground Dash**
   - Press Shift (or X) while standing
   - Verify: Player dashes forward with fixed distance
   - Verify: Ghost trail/afterimage visible during dash
   - Verify: State shows "DASHING"

3. **8-Directional Dash**
   - Hold ArrowRight + ArrowUp, then Shift
   - Verify: Player dashes diagonally up-right
   - Try all 8 directions (cardinal + diagonal)

4. **Air Dash**
   - Jump, then press Shift while airborne
   - Verify: Dash works in the air
   - Verify: No gravity during dash (horizontal dash stays level)

5. **Dash Cooldown**
   - Dash, then immediately try to dash again
   - Verify: Second dash is blocked by cooldown
   - Verify: Cooldown indicator visible

6. **Dash-Cancel**
   - While running, dash
   - While wall-sliding, dash
   - While falling, dash
   - Verify: Dash works from all these states

### Pass Criteria Checklist
- [ ] 8-dir + neutral dash
- [ ] Wind-up freeze frame
- [ ] Fixed distance regardless of starting velocity
- [ ] No gravity during dash
- [ ] Dash-cancel from idle/run/jump/fall/wall-slide/crouch/slide
- [ ] No dash during wall-jump lockout or another dash
- [ ] Ground dash + hold fwd = speed boost
- [ ] Boost decays smoothly
- [ ] Cooldown prevents spam
- [ ] Air dash preserves momentum
- [ ] Wall collision stops dash
- [ ] Down-dash lands
- [ ] Ghost trail visible
- [ ] All sliders tune live
- [ ] Existing mechanics unaffected

---

## Test 5: Transitions (`/test/transitions`)

**URL:** `http://localhost:3000/test/transitions`

### Expected Elements
- **Canvas:** 960x540, varied geometry (platforms at different heights/gaps)
- **Debug Panel:** 34 sliders covering squash/stretch, particles, screen shake
- **Debug Overlays:** Squash/stretch deformation visible on player

### Test Steps

1. **Page Load**
   - Navigate to URL, wait 2s
   - Verify canvas shows multiple platforms at varying heights

2. **Landing Feedback**
   - Jump from a high platform to the ground
   - Verify: Squash on landing (player briefly compresses)
   - Verify: Dust particles on soft landing
   - Verify: Screen shake on hard landing (from high enough)

3. **Jump Launch Squash**
   - Jump from ground
   - Verify: Player shows vertical stretch at jump launch

4. **Turn-around Compression**
   - Run right then quickly switch to left
   - Verify: Brief horizontal compression at turn point
   - Verify: Dust particles at feet

5. **Wall-slide / Wall-jump Visuals**
   - Wall-slide on a wall
   - Verify: Ongoing dust particles at wall contact
   - Wall-jump away
   - Verify: Launch squash/stretch + wall particles

6. **Dash Deformation**
   - Perform a dash
   - Verify: Horizontal stretch during dash
   - Verify: Squash/stretch returns to (1,1) smoothly after

### Pass Criteria Checklist
- [ ] Jump launch shows squash-stretch
- [ ] Soft landing shows small dust puff
- [ ] Hard landing shows recovery + big squash + screen shake
- [ ] Hard landing can be dash-cancelled or jump-buffered
- [ ] Turn-around shows compression + dust
- [ ] Wall-slide shows ongoing dust at wall contact
- [ ] Wall-jump shows launch squash + wall particles
- [ ] Dash start/end shows deformation + particles
- [ ] All squash-stretch returns to (1,1) smoothly
- [ ] Collision box unchanged by visual deformation

---

## Test 6: Movement Playground (`/test/movement-playground`)

**URL:** `http://localhost:3000/test/movement-playground`

### Expected Elements
- **Canvas:** 960x540, complex level with varied geometry (gaps, walls, ceilings, platforms at various heights)
- **Debug Panel:** 34 sliders, all movement mechanics combined
- **Debug Overlays:** All overlays from previous pages (hitbox, velocity, state, coyote indicator, etc.)

### Test Steps

1. **Page Load**
   - Navigate to URL, wait 2s
   - Verify canvas shows complex multi-section level
   - Verify all debug sliders are present

2. **Full Movement Vocabulary**
   - Run (ArrowRight) → jump (Space) → wall-slide (hold into wall) → wall-jump (Space) → dash (Shift) → land
   - Verify: All state transitions are seamless
   - Verify: State label updates correctly for each state
   - Verify: Visual effects (particles, squash-stretch) all present

3. **Complex Movement Chains**
   - Perform a dash-jump (dash then immediately jump)
   - Perform a crouch-slide under a low ceiling
   - Chain wall-jumps up a chimney
   - Verify: All mechanics integrate smoothly

4. **Timer / Speedrun**
   - If timer is present, verify it tracks elapsed time
   - Navigate through the level as quickly as possible
   - Verify: Timer updates in real-time

5. **Debug Panel Integration**
   - Toggle "Debug Overlays" checkbox
   - Verify: Overlays appear/disappear
   - Adjust a few sliders and confirm they affect gameplay

### Pass Criteria Checklist
- [ ] All movement mechanics available (run, jump, dash, wall, crouch)
- [ ] Seamless state transitions
- [ ] Complex level with varied geometry
- [ ] All debug overlays present and toggleable
- [ ] Timer display for speedrun practice
- [ ] All sliders update live

---

## Quick Verification Script

For automated or semi-automated testing, the following checks can be performed via curl:

```bash
# Check all 6 pages return HTTP 200
for page in ground-movement jumping wall-mechanics dash transitions movement-playground; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/test/$page")
  echo "$page: $status"
done

# Check each page contains expected elements in HTML
for page in ground-movement jumping wall-mechanics dash transitions movement-playground; do
  html=$(curl -s "http://localhost:3000/test/$page")
  canvas=$(echo "$html" | grep -c '<canvas')
  slider=$(echo "$html" | grep -c 'type="range"')
  backlink=$(echo "$html" | grep -c 'href="/test"')
  echo "$page: canvas=$canvas sliders=$slider backlink=$backlink"
done
```

## Test Report Template

| Page | HTTP Status | Canvas Renders | Debug Panel | Sliders Work | Input Works | Errors |
|------|-------------|----------------|-------------|-------------|-------------|--------|
| ground-movement | | | | | | |
| jumping | | | | | | |
| wall-mechanics | | | | | | |
| dash | | | | | | |
| transitions | | | | | | |
| movement-playground | | | | | | |
