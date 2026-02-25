# Task: Visual Test — Core Movement Pages

## Summary

Create visual test scripts for the 6 core movement test pages and execute them using the browser MCP tools to verify rendering correctness. If browser MCP is unavailable, create the documented test procedure as a runnable script.

## What to Build

### 1. Visual Test Script

Create `scripts/visual-tests/core-movement.md` — a markdown playbook documenting the visual test procedure for the 6 core movement test pages.

### 2. Execute the Tests (if browser MCP available)

For each of these 6 pages, perform the following using browser MCP tools:

**Pages to test:**
1. `http://localhost:3000/test/ground-movement`
2. `http://localhost:3000/test/jumping`
3. `http://localhost:3000/test/wall-mechanics`
4. `http://localhost:3000/test/dash`
5. `http://localhost:3000/test/transitions`
6. `http://localhost:3000/test/movement-playground`

**For each page:**
1. Navigate to the URL with `browser_navigate`
2. Wait 2 seconds for the page to load (canvas element should be present)
3. Take an initial screenshot → note any issues (blank canvas, missing elements, JS errors)
4. Verify these elements are present:
   - A `<canvas>` element (the game canvas)
   - A debug panel sidebar (React component with sliders)
   - Page title/header with navigation back to `/test`
   - Pass criteria section (below or beside the canvas)
5. Simulate player input:
   - Press Arrow Right for ~1 second (player should run right)
   - Press Space (player should jump)
   - Press Arrow Left for ~0.5 seconds
6. Take a post-interaction screenshot
7. Verify the canvas is not blank (something rendered — player rect, platforms, debug overlays)

### 3. Test Report

Create a summary at the end (or in the task output) listing:
- Each page tested
- Whether it loaded successfully
- Whether the canvas rendered content (not blank)
- Whether the debug panel was visible
- Any errors or issues observed

## Expected Test Page Structure

Each core movement test page should have:
- **Canvas**: 960×540 game canvas showing a player (colored rectangle, ~32×48px) on platforms
- **Debug panel**: Right-side panel with collapsible sections, containing Slider components
- **Debug overlays on canvas**: Hitbox outline (cyan), velocity vector (amber arrow), state label (purple text)
- **Screen-space text**: FPS counter, velocity readout, diagnostics (top-left area of canvas)
- **Header**: Page title, phase badge, link back to `/test`
- **Pass criteria**: Checklist of expected behaviors

## Page-Specific Expectations

### `/test/ground-movement`
- Player runs left/right with acceleration curves
- Crouch (down arrow) shows squash
- Turn-around creates dust particles
- Debug sliders: maxRunSpeed, runAcceleration, runDeceleration, etc.

### `/test/jumping`
- Variable-height jump (tap vs hold Space)
- Coyote time indicator (gold bar in debug overlay)
- Apex float glow effect at jump peak
- Debug sliders: jumpSpeed, coyoteFrames, jumpBufferFrames, etc.

### `/test/wall-mechanics`
- Walls on both sides of the level
- Wall slide when pressing toward wall while falling
- Wall jump launches away from wall
- Debug sliders: wallSlideSpeed, wallJumpSpeed, etc.

### `/test/dash`
- 8-directional dash (arrow keys + Shift or dedicated dash key)
- Dash trail/afterimage effect
- Cooldown indicator
- Debug sliders: dashSpeed, dashDuration, dashCooldown, etc.

### `/test/transitions`
- Varied geometry (platforms at different heights/gaps)
- Squash/stretch visual feedback on landing
- Seamless state transitions visible in state label overlay
- Multiple platform types for testing different transitions

### `/test/movement-playground`
- Complex level with varied geometry
- Timer display for speedrun practice
- All movement mechanics available (run, jump, dash, wall, crouch)
- Integration of all previous movement features

## Prerequisites

- Dev server running at `http://localhost:3000`
- If browser MCP is not available, start the dev server with: `cd /Users/matt/code/inkbinders && npm run dev`

## Verification

- [ ] All 6 pages load without blank canvas or JS errors
- [ ] Each page has a visible canvas with rendered content
- [ ] Each page has a debug panel with sliders
- [ ] Player input causes visible movement on canvas
- [ ] Screenshots captured (if browser MCP available)
- [ ] Test report created summarizing results
- [ ] `scripts/visual-tests/core-movement.md` playbook created

## Notes

- If browser MCP tools are not available, focus on creating the playbook document (`scripts/visual-tests/core-movement.md`) with detailed step-by-step instructions that can be followed later by an agent with browser access.
- The playbook should specify exact URLs, wait times, key sequences, and expected visual elements.
- Screenshots are for human review — they don't need pixel-perfect matching, just "something rendered" verification.
- Test pages use keyboard input: Arrow keys for movement, Space for jump, Shift for dash (check InputManager DEFAULT_KEY_MAP for exact bindings).

---

## Completion Summary

### What Was Built

1. **Visual test playbook** created at `scripts/visual-tests/core-movement.md`:
   - Detailed step-by-step test procedures for all 6 core movement pages
   - Key binding reference table
   - Page-specific test steps and expected behaviors
   - Pass criteria checklists for each page
   - Quick verification bash script for automated HTTP/HTML checks
   - Test report template

2. **Automated verification performed** (browser MCP not available, used HTTP/HTML checks):
   - All 6 pages return HTTP 200
   - All 6 pages contain `<canvas>` element (960x540)
   - All 6 pages contain range input sliders (debug panel)
   - All 6 pages contain back-link to `/test`
   - All 6 pages contain pass criteria sections
   - No JS errors detected (only standard Next.js framework boilerplate)
   - TypeScript type check (`npx tsc --noEmit`) passes clean

### Test Report

| Page | HTTP Status | Canvas Present | Sliders Present | Back Link | Pass Criteria | Errors |
|------|-------------|----------------|-----------------|-----------|---------------|--------|
| ground-movement | 200 | Yes (960x540) | Yes (10 sliders) | Yes | Yes (8 criteria) | None |
| jumping | 200 | Yes (960x540) | Yes (19 sliders) | Yes | Yes (10 criteria) | None |
| wall-mechanics | 200 | Yes (960x540) | Yes (25 sliders) | Yes | Yes (12 criteria) | None |
| dash | 200 | Yes (960x540) | Yes (31 sliders) | Yes | Yes (15 criteria) | None |
| transitions | 200 | Yes (960x540) | Yes (34 sliders) | Yes | Yes (10 criteria) | None |
| movement-playground | 200 | Yes (960x540) | Yes (34 sliders) | Yes | Yes | None |

### Notes
- Browser MCP tools were not available, so interactive testing (keyboard input, canvas rendering verification) could not be performed
- The playbook document contains full instructions for future interactive testing
- All server-side rendering and HTML structure verified as correct

### Files Changed
- `scripts/visual-tests/core-movement.md` (new) — Visual test playbook

---

## Review Notes (reviewer: 5a94be14)

### Issues Found & Fixed

1. **Slider count for `/test/jumping` was wrong** — Playbook and test report both claimed 20 sliders, but the actual page has 19 `<Slider>` components (4 Movement + 4 Crouch/Slide + 6 Jump + 3 Input Tuning + 2 Air Control = 19). Fixed in both `scripts/visual-tests/core-movement.md` and this task file's test report table.

### Verified Correct

- Key bindings table matches `DEFAULT_KEY_MAP` in `src/engine/input/InputManager.ts` exactly
- Canvas dimensions (960x540) match `CANVAS_WIDTH`/`CANVAS_HEIGHT` in `src/lib/constants.ts`
- Slider counts for the other 5 pages (ground-movement: 10, wall-mechanics: 25, dash: 31, transitions: 34, movement-playground: 34) are all accurate
- Test procedures are comprehensive and well-structured
- Quick verification bash script is correct
- Pass criteria checklists align with what each page tests

### Overall

Clean work. The playbook is thorough and actionable. One minor data error fixed.
