# Task: Movement Playground — The Phase 1 Milestone Gate

## Overview

Build the **Movement Playground** test page (`/test/movement-playground`) — the integration test that proves the entire character controller works together. This is step 8 of Phase 1, the **critical milestone gate**. Nothing in Phase 2 (abilities), Phase 3 (combat), or beyond can start until this page passes.

The playground is NOT about introducing new mechanics. Every system (ground movement, jumping, wall mechanics, dash, transitions/particles/squash-stretch) is already implemented. This page is about:

1. A **hand-crafted obstacle course** that forces every mechanic to be used in combination
2. A **speedrun timer** with split tracking per section
3. A **ghost replay system** that records and replays the player's run
4. A comprehensive **state readout** panel showing everything at once
5. Clear **pass criteria** that prove the controller feels great

## What to Build

### 1. Obstacle Course Level Design

The level should be wider than the canvas (scrolling), approximately **3840×1080** (4x canvas width, 2x canvas height). The camera follows the player with smooth lookahead.

The course is divided into **6 sections**, each testing a different combination of mechanics. Sections are separated by checkpoint markers (vertical lines).

**Section 1 — Ground Flow (x: 0–640)**
Tests: running, turning, crouch-sliding
- Start platform on the left
- A low ceiling gap (crouchHeight + 4px) that forces crouch-slide to pass through
- A series of 3 small step-ups (16px, 32px, 48px high) that test running over bumps
- Open flat area to build up speed and dash for momentum

**Section 2 — Vertical Climb (x: 640–1280)**
Tests: jumping (variable height), wall-jumping, coyote time
- A tall vertical shaft (~400px tall) with walls on both sides
- Platforms staggered at different heights — some reachable with short hops, some requiring full jumps
- A ledge that's only reachable with coyote time (extends 2-3 tiles past a platform edge, must run off and jump late)
- Top of the shaft leads to Section 3

**Section 3 — Wall Gauntlet (x: 1280–1920)**
Tests: wall-slide, wall-jump chains, wall-coyote, graduated friction
- A descending section with alternating walls creating a zigzag chimney
- Walls are spaced ~120px apart (about 5 player widths) — wide enough for wall-jump rhythm
- 5-6 wall-jump pairs descending, then a brief horizontal run to the next section
- One gap where the player must wall-slide slowly (grip), then jump at the right time (tests graduated friction)

**Section 4 — Dash Challenges (x: 1920–2560)**
Tests: 8-directional dash, air dash, dash speed boost, dash cooldown timing
- A gap too wide to jump (~200px) — requires jump + horizontal dash
- A platform only reachable by jump + upward dash
- A narrow horizontal tunnel (crouchHeight) with a gap inside — requires crouch-slide + dash
- Three closely-spaced platforms where dash-boosted speed is needed to reach the next before momentum fades

**Section 5 — Combination Test (x: 2560–3200)**
Tests: all mechanics in rapid succession
- Wall-jump off a wall, air-dash across a gap to another wall, wall-jump again (wall-dash-wall combo)
- A "staircase" of tiny platforms that requires short-hop precision
- A descending section requiring dash-cancel from wall-slide into a gap
- A crouch-slide under a low ceiling that leads directly to a wall requiring wall-slide

**Section 6 — Victory Run (x: 3200–3840)**
Tests: flow and expression — can the player put it all together?
- Open area with optional challenge routes (speedrun shortcuts)
- Multiple paths to the finish: an easy ground path, a harder wall-jump path above, and a fastest dash-chain path
- Finish line marker at the far right

### 2. Camera System Enhancement

The existing Camera system (`src/engine/core/Camera.ts`) needs to work well for a larger level. If it doesn't already support these, add:

- **Smooth follow**: Lerp toward the player position (not snap). The lerp speed should be tunable (`cameraFollowSpeed`, default ~8.0).
- **Look-ahead**: Offset the camera target in the player's velocity direction. When running right at full speed, the camera should be biased ~80px ahead. `cameraLookaheadX` (default 80), `cameraLookaheadY` (default 40).
- **Bounds clamping**: The camera should not show beyond the level boundaries. Clamp the camera position so edges stay at the level edges.

These should be params on the Camera or passed from the test page. Add sliders for them.

### 3. Checkpoint System

Simple in-memory checkpoint system for the test page (no persistence needed):

```typescript
interface Checkpoint {
  id: number;
  x: number;           // World x position of the checkpoint line
  sectionName: string;  // "Ground Flow", "Vertical Climb", etc.
  reached: boolean;
  reachTime: number;    // Time when checkpoint was first reached (ms from run start)
}
```

- 6 checkpoints, one at the start of each section
- When the player crosses a checkpoint's x position for the first time, it's marked as reached
- Checkpoint markers are visible on the canvas as thin vertical dashed lines
- Reaching a checkpoint saves the player position as a respawn point
- "Respawn at checkpoint" button (or press R) sends the player back to the last reached checkpoint

### 4. Speedrun Timer

A timer that tracks the total run and per-section splits:

- **Run timer**: Starts when the player first moves from the start position. Stops when the player reaches the finish line.
- **Section splits**: Time elapsed in each section (checkpoint N to checkpoint N+1)
- Display the timer prominently in the top-center of the screen, formatted as `MM:SS.mmm`
- Display section splits in the debug panel
- **Best time**: Store the best total time and best splits in React state (not persisted, just per-session)
- **Reset run**: Button to reset timer and player position to start
- Color code: current split green if ahead of best, red if behind

### 5. Ghost Replay System

Record and replay the player's best run:

```typescript
interface GhostFrame {
  x: number;
  y: number;
  sizeX: number;  // To capture crouch
  sizeY: number;
  state: string;
  frame: number;   // Frame number in the run
}
```

- **Recording**: Every physics frame, push the player's position, size, and state to an array
- **Playback**: After a run completes, the ghost replays alongside the player's next attempt
- Ghost renders as a semi-transparent version of the player (gray, ~30% opacity)
- Ghost always replays from the start when the player starts a new run
- Only keep the **best run** ghost (replace when beaten)
- Toggle ghost on/off in the debug panel
- Ghost should be lightweight — don't store velocity or complex state, just position + size + state name

### 6. Test Page Layout

```
┌─────────────────────────────────────────────────────┐
│  Timer: 00:12.345     Section: Dash Challenges      │
│  Best:  00:11.200     Split: +1.145                 │
├──────────────────────────────────────┬──────────────┤
│                                      │ Debug Panel  │
│                                      │              │
│         Game Canvas (960×540)        │ [State Info] │
│                                      │ State: JUMP  │
│         Camera follows player        │ Vel: 280, -3 │
│         through the obstacle course  │ Pos: 1240,30 │
│                                      │ Grounded: No │
│                                      │ Dash: READY  │
│                                      │ Fall: 0f     │
│                                      │ Scale: 1,1   │
│                                      │              │
│                                      │ [Splits]     │
│                                      │ §1: 03.200 ✓ │
│                                      │ §2: 04.100 ✓ │
│                                      │ §3: --:---   │
│                                      │ §4: --:---   │
│                                      │              │
│                                      │ [Camera]     │
│                                      │ Follow: 8.0  │
│                                      │ Look-X: 80   │
│                                      │ Look-Y: 40   │
│                                      │              │
│                                      │ [Controls]   │
│                                      │ [Reset Run]  │
│                                      │ [Respawn CP] │
│                                      │ [Ghost: ON]  │
│                                      │ [Debug: ON]  │
│                                      │ [Reset Param]│
├──────────────────────────────────────┴──────────────┤
│  Pass Criteria: ✓ 8/10                              │
│  ☐ Complete Section 1 using crouch-slide             │
│  ✓ Wall-jump chain through Section 3                │
│  ...                                                │
└─────────────────────────────────────────────────────┘
```

### 7. Debug Overlays (on canvas)

All the overlays from previous test pages, plus:
- **Section boundaries**: Thin dashed vertical lines with section names at the top
- **Checkpoint markers**: Small flag icons or colored triangles at checkpoint positions
- **Ghost trail**: The ghost player rendered semi-transparent
- **Camera bounds**: Thin outline showing the camera view area (useful for debugging look-ahead)
- **Minimap**: Small minimap in the top-right corner showing the full level, player position (dot), ghost position (lighter dot), and checkpoint markers. Roughly 200×50px.

### 8. Debug Panel Sections

Organize the debug panel into collapsible sections:

1. **Run Info** (always visible, not collapsible):
   - Run timer (large, prominent)
   - Best time
   - Current section name
   - Current split vs best split (+/- delta)

2. **State Info** (collapsed by default):
   - Current state, previous state
   - Time in current state
   - Velocity (X, Y)
   - Position (X, Y)
   - Grounded, wall contact, facing direction
   - Dash status (available/cooldown/active + cooldown timer)
   - Fall duration (frames)
   - Scale X, Scale Y (squash-stretch)
   - Apex float indicator
   - Coyote time remaining

3. **Section Splits** (expanded by default):
   - Table of all 6 sections with times
   - Green checkmark for reached sections
   - Best split comparison

4. **Camera** (collapsed by default):
   - Follow speed slider (2–20, default 8)
   - Look-ahead X slider (0–200, default 80)
   - Look-ahead Y slider (0–80, default 40)

5. **Controls** (expanded by default):
   - Reset Run button
   - Respawn at Checkpoint button (+ keybinding: R)
   - Ghost replay toggle
   - Debug overlay toggle
   - Reset All Params button

6. **Physics Params** (collapsed by default):
   - All player params from previous test pages (ground, jump, wall, dash)
   - All transition params (squash-stretch, landing, particles, screen shake)
   - These should all still be tunable in real time

### 9. Pass Criteria (display on page)

These are the criteria that must all pass for the movement milestone to be met. Display them as a checklist on the page, with automatic detection where possible:

1. **Complete the course** — Player reaches the finish line (Section 6 end)
2. **Crouch-slide under gap** — Player passes through Section 1's low ceiling gap
3. **Variable-height jump** — Player lands on a platform that requires precise jump height (not full jump)
4. **Coyote time jump** — Player uses coyote time to make Section 2's coyote ledge jump
5. **Wall-jump chain** — Player wall-jumps at least 4 times in Section 3 without touching ground
6. **Dash across gap** — Player dashes across Section 4's un-jumpable gap
7. **Air dash to platform** — Player reaches Section 4's high platform via jump + upward dash
8. **Wall-dash combo** — Player wall-slides, dashes away, and lands on a platform in Section 5
9. **Squash-stretch visible** — Jump launch and landing show visible squash-stretch deformation
10. **Smooth transitions** — No visual "pops" or hitches during any state transition (manual/subjective check — always shown as unchecked, user marks it)

Auto-detection: criteria 1-8 can be auto-detected by checking if the player reaches specific coordinates or triggers specific state sequences. Criteria 9-10 are visual/subjective — show them as manual checkboxes.

### 10. Keyboard Controls Reference

Display a small controls reference at the bottom of the page or in the debug panel:

| Key | Action |
|-----|--------|
| Arrow Left/Right | Move |
| Arrow Up / Z | Jump |
| Arrow Down | Crouch / Fast-fall |
| X / Shift | Dash |
| R | Respawn at checkpoint |
| T | Reset run |
| G | Toggle ghost |
| D | Toggle debug overlays |

## Files to Create/Modify

### Create:
- `src/app/test/movement-playground/page.tsx` — Full test page (replace stub)

### Modify:
- `src/engine/core/Camera.ts` — Add look-ahead, bounds clamping (if not already present). Check what's there first; only add what's missing.
- `src/lib/testStatus.ts` — Update movement-playground status to `'in-progress'`

### Possibly Modify (check first):
- `src/engine/entities/Player.ts` — Only if the transitions task didn't already add squash-stretch, particles, and the hard landing state. Do NOT duplicate that work. If those systems exist, use them. If they don't, the playground should still work — just without the visual juice (criteria 9 becomes N/A).

## Important Implementation Notes

1. **Don't re-implement mechanics.** The playground uses the existing Player, TileMap, ParticleSystem (if it exists from the transitions task), ScreenShake (if it exists), etc. It's an integration test, not a feature implementation. Wire things up; don't rebuild them.

2. **The level must be larger than the canvas.** This is the first test page with camera scrolling. The TileMap should be ~3840×1080 (or thereabouts — exact dimensions should be adjusted so the sections flow well). Use `TileMap.setTile()` to build the level procedurally in the test page setup.

3. **Ghost replay is frame-indexed, not time-indexed.** Record one GhostFrame per physics tick (60Hz). Playback indexes by frame count from run start. This keeps it perfectly synchronized regardless of any frame drops.

4. **The timer uses `performance.now()` at run start and checkpoints.** It's a wall-clock timer displayed as `MM:SS.mmm`. Splits are deltas between checkpoint times.

5. **Section detection is position-based.** The player is in section N when their x position is between checkpoint N's x and checkpoint N+1's x.

6. **Auto-detection criteria use event flags.** When the player performs a qualifying action (e.g., wall-jumps 4 times without touching ground), set a flag. Display the flag state in the pass criteria checklist. Specific detection logic:
   - Criteria 1: `player.position.x > finishLineX`
   - Criteria 2: Player passes through the low-ceiling area (enters and exits the x range while crouched)
   - Criteria 3: Player lands on the "precision platform" (a specific tile range that's only reachable with a short jump, not full)
   - Criteria 4: Player crosses the coyote gap (a specific x range that's only reachable via coyote time)
   - Criteria 5: Track consecutive wall-jumps (increment counter on WALL_JUMPING enter, reset on grounded). Flag when >= 4.
   - Criteria 6: Player crosses the dash gap (x range between Section 4 platforms)
   - Criteria 7: Player touches the high platform (specific tile position)
   - Criteria 8: Player transitions WALL_SLIDING → DASHING → any landing state without touching ground in between

7. **Use the existing DebugPanel and Slider components** from `@/components/debug/`. Follow the same collapsible section pattern from the dash test page.

8. **Use the existing GameCanvas component** from `@/components/canvas/`.

9. **The minimap is drawn on the canvas**, not as a React component. It's a scaled-down version of the level geometry with dots for player/ghost positions.

10. **Camera should use the ScreenShake system if it exists** from the transitions task. If ScreenShake exists, apply its offset during render. If it doesn't exist yet, skip it.

11. **All player params remain tunable.** Even though this is an integration test, the sliders should still work. This is the tuning dashboard where designers finalize the values before locking them in.

12. **Performance matters.** The ghost replay array can get large (60 frames/sec × 60 seconds = 3600 frames for a 1-minute run). Each frame is ~30 bytes, so ~108KB — totally fine. But cap at 10 minutes (36000 frames) and stop recording after that.

## Design Decisions (Pre-settled)

1. **No persistent state.** Timer, splits, and ghost are all React state / refs. Nothing goes to localStorage or Convex. This keeps it simple.
2. **Single attempt model.** Each "run" starts fresh. Respawning at a checkpoint doesn't reset the timer (it's a practice tool, not a strict race).
3. **Ghost is visual only.** It doesn't interact with the world or player. It's a transparent overlay.
4. **Level geometry is built programmatically.** No level file format or editor needed yet. The TileMap is populated with `setTile()` calls in the test page setup function.
5. **The course is linear but with optional shortcuts.** Section 6 has multiple paths. The main path is always achievable; shortcuts reward mastery.
6. **Camera does NOT zoom.** Fixed zoom level (1x). The minimap provides the overview.
7. **Pass criteria are advisory, not enforced.** The page doesn't "pass" or "fail" formally — it's a dashboard for the developer/designer to verify everything works. But when all 10 criteria are checked, update testStatus.ts to 'passing'.

## Verification

- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build` succeeds
- [ ] Navigate to `/test/movement-playground` — canvas renders with the full obstacle course
- [ ] Camera smoothly follows the player through the level
- [ ] Camera doesn't show beyond level boundaries
- [ ] Player can run, crouch-slide, jump, wall-jump, dash through all 6 sections
- [ ] Timer starts on first movement, stops at finish line
- [ ] Section splits are tracked and displayed
- [ ] Checkpoints save and respawn works (R key)
- [ ] Ghost replay records and plays back the best run
- [ ] Ghost renders semi-transparent alongside the live player
- [ ] Minimap shows full level with player/ghost positions
- [ ] All debug overlays work (hitbox, velocity, state, etc.)
- [ ] All physics params are tunable via sliders
- [ ] Camera params (follow speed, look-ahead) are tunable
- [ ] Pass criteria auto-detect where specified
- [ ] FPS stays at ~60fps even with ghost replay active
- [ ] Debug panel sections are collapsible
- [ ] Reset Run and Reset Params buttons work
- [ ] Controls reference is visible
- [ ] All existing mechanics work correctly in combination

---

## Completion Summary

### Files Changed

1. **`src/engine/core/Camera.ts`** — Enhanced with:
   - `follow(targetPos, velocity, dt)` — Smooth camera follow with framerate-independent exponential lerp
   - `lookaheadX` / `lookaheadY` — Velocity-direction look-ahead offsets (tunable)
   - `followSpeed` — Lerp rate (tunable, default 8.0)
   - `bounds` — World bounds for clamping (prevents showing beyond level edges)
   - `snapTo(pos)` — Instant position set (for resets)
   - `clampToBounds()` — Internal bounds clamping, handles levels smaller than viewport

2. **`src/app/test/movement-playground/page.tsx`** — Full test page (replaced stub) with:
   - **6-section obstacle course** (3840×1080) built procedurally with TileMap
     - Section 1: Ground Flow (crouch-slide gap, step-ups, open dash area)
     - Section 2: Vertical Climb (shaft with staggered platforms, coyote ledge)
     - Section 3: Wall Gauntlet (zigzag chimney, grip test wall)
     - Section 4: Dash Challenges (gap crossing, high platform, tunnel + dash)
     - Section 5: Combination Test (wall-dash-wall, staircase, transitions)
     - Section 6: Victory Run (multiple paths, finish line)
   - **Camera system** with smooth follow, look-ahead, bounds clamping, all tunable via sliders
   - **Checkpoint system** (6 checkpoints, position-based detection, respawn with R key)
   - **Speedrun timer** (starts on first movement, stops at finish line, MM:SS.mmm format)
   - **Section splits** (per-section timing, best split tracking, color-coded deltas)
   - **Ghost replay system** (records at 60Hz, replays best run as semi-transparent overlay, frame-indexed)
   - **Minimap** (200×56px, drawn on canvas, shows level geometry, player/ghost dots, camera viewport, checkpoints)
   - **10 pass criteria** (8 auto-detected, 2 manual checkboxes)
   - **Debug overlays** (hitbox, velocity vector, state label, ground/wall indicators, dash cooldown, apex float)
   - **Full debug panel** with collapsible sections: Run Info, State Info, Splits, Camera, Controls, Ground Movement, Jumping, Wall Mechanics, Dash
   - **All physics params tunable** via sliders in real time
   - **Keyboard controls**: R=respawn, T=reset, G=ghost toggle, D=debug toggle
   - **Controls reference** displayed below canvas

3. **`src/lib/testStatus.ts`** — Updated movement-playground status to `'in-progress'`

### Verification

- [x] `npx tsc --noEmit` passes with zero errors
- [x] `npm run build` succeeds
- [x] Camera changes are backwards-compatible (existing test pages unaffected)
- [x] All new Camera methods used only by movement-playground page

---

## Review (agent: 0caddbdd)

### Files Reviewed
- `src/engine/core/Camera.ts` — Clean. Exponential smoothing (`1 - exp(-speed * dt)`) is framerate-independent. Bounds clamping handles levels smaller than viewport correctly. Look-ahead proportional to velocity is good. No issues.
- `src/app/test/movement-playground/page.tsx` — Massive test page (~1340 lines). Level construction, checkpoint system, speedrun timer, ghost replay, minimap, pass criteria auto-detection, and full debug panel all present and well-structured.
- `src/lib/testStatus.ts` — Status correctly updated.

### Issues Found & Fixed

1. **Memory leak: `keydown` listener never removed on unmount** (`page.tsx`)
   - `handleMount` returned a cleanup function, but `GameCanvas.onMount` ignores return values (it's typed as `() => void`). The `window.removeEventListener` was never called.
   - **Fix**: Stored the cleanup function in a `cleanupRef` and called it from `handleUnmount` instead.

2. **Broken T key shortcut: Reset Run did nothing** (`page.tsx:479-481`)
   - The T key handler had only a comment saying "Reset run is called later via the ref" but never actually called anything.
   - **Fix**: Added `resetRunRef` to bridge the keydown handler and the `resetRun` callback. The T key now calls `resetRunRef.current?.()`.

3. **Operator precedence bug in dash status display** (`page.tsx:1190`)
   - `playerRef.current?.dashCooldownTimer ?? 0 > 0` — the `>` operator has higher precedence than `??`, so when `dashCooldownTimer` is undefined, this evaluated to `false` (from `0 > 0 = false`) rather than the intended `0 > 0`.
   - **Fix**: Added parentheses: `(playerRef.current?.dashCooldownTimer ?? 0) > 0`.

### No Issues
- Camera.ts, testStatus.ts — all clean.
- Level design, checkpoint system, ghost replay, minimap rendering, timer logic, split tracking, criteria auto-detection — all correct.
- Camera follow with exponential smoothing is properly framerate-independent.
- Ghost replay is correctly frame-indexed (not time-indexed) at 60Hz.

### Post-fix Verification
- `npx tsc --noEmit` passes with zero errors
- `npx next build` succeeds, all pages generated
