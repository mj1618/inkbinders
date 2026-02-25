# Task: Wall Mechanics Polish

**Epic:** 012-player-movement-perfection
**Task slug:** wall-mechanics-polish
**Goal:** Make wall interactions (slide, jump, detach) look distinct and satisfying with speed-based frame selection, dedicated wall-jump animation, improved particles, and correct wall-facing direction.

**Important:** All enhancements in this task are **purely visual/cosmetic**. Wall physics remain unchanged. Controls remain frame-perfect responsive. The state machine is NOT modified — these are animation, particle, and rendering improvements only.

---

## Context

### What exists now

- **WALL_SLIDING state** (`Player.ts`): Full physics with graduated friction. `wallStickFrames` (3 frames) initial stick, then smooth acceleration to `wallSlideGripSpeed` (40 px/s when holding toward) or `wallSlideBaseSpeed` (120 px/s otherwise). `wallSide` tracks which wall (-1=left, 1=right).
- **WALL_JUMPING state** (`Player.ts`): Launch with `wallJumpVerticalSpeed` (340) up and `wallJumpHorizontalSpeed` (260) away. `wallJumpLockoutFrames` (8 frames) prevents re-grabbing. Faces away from wall on launch.
- **Wall-slide animation**: Uses `player-wall-slide-full` (4 frames @ 6fps, loop) with fallback to `player-wall-slide` (2 frames @ 4fps). Currently just plays the loop animation regardless of slide speed.
- **Wall-jump animation**: Uses `player-wall-jump` (3 frames @ 15fps, no loop, facesLeft) with fallback to `player-jump` → `jump-rise`. This already plays the dedicated sheet.
- **Wall particles**: `emitWallParticles(count, fromRight, life)` emits dust at wall contact point:
  - Entry burst: 3 particles
  - Ongoing: every 6 frames, 2 particles at upper-middle of player
  - Wall-jump burst: 6 particles
  - All use `DUST_COLORS` = `["#e5e7eb", "#d1d5db", "#f9fafb"]` (gray/white)
- **Squash-stretch on wall**: Entry = `(0.85, 1.12)`, wall-jump = `(0.78, 1.28)`
- **Crossfade durations**: WALL_SLIDING → any = 2 frames, any → WALL_SLIDING = 2 frames, WALL_SLIDING → WALL_JUMPING = 0 frames (instant)
- **Wall facing**: Currently during WALL_SLIDING, the player's `facingRight` is set to `wallSide > 0` (faces right when on right wall). The wall-jump sprite has `facesLeft: true`.
- **AnimationController**: Has `setFrame(frameIndex)` method for directly setting displayed frame. Has `setFpsOverride(fps)`. Has `play()`, `restart()`, `isFinished()`.

### What this task adds

1. **Speed-based wall-slide frame selection** — tie the wall-slide animation frame to actual slide speed instead of a time-based loop
2. **Wall-slide entry "grab" frame** — hold frame 0 during the wallStick pause
3. **Improved wall-slide particles** — more particles, exit burst, and biome color support
4. **Wall-slide facing correction** — character should face TOWARD the wall (gripping it), not away
5. **Wall-jump exit particles** — burst in departure direction when leaving wall-slide

---

## Implementation

### 1. Wall-Slide Speed-Based Frame Selection

**File:** `src/engine/entities/Player.ts`

In the WALL_SLIDING state update handler, **after** the physics calculates velocity, override the animation frame based on current slide speed instead of letting the animation loop play:

```typescript
// Speed-based frame selection for wall-slide
const slideSpeed = Math.abs(player.velocity.y);
const gripSpeed = player.params.wallSlideGripSpeed;   // 40
const baseSpeed = player.params.wallSlideBaseSpeed;    // 120

let targetFrame: number;
if (player.wallStickTimer > 0) {
  // During stick: show grab frame (frame 0)
  targetFrame = 0;
} else if (slideSpeed <= gripSpeed * 1.2) {
  // Grip frame (frame 1) — slow, controlled slide
  targetFrame = 1;
} else if (slideSpeed <= baseSpeed * 0.8) {
  // Steady frame (frame 2) — moderate slide
  targetFrame = 2;
} else {
  // Speed frame (frame 3) — fast slide
  targetFrame = 3;
}

player.activeAnimController.setFrame(targetFrame);
```

This replaces the looping animation with direct frame control. The key thresholds:
- Frame 0 (grab): only during `wallStickTimer > 0`
- Frame 1 (grip): slide speed ≤ 48 px/s (gripSpeed × 1.2)
- Frame 2 (steady): slide speed ≤ 96 px/s (baseSpeed × 0.8)
- Frame 3 (fast): slide speed > 96 px/s

**Important:** This means the wall-slide animation should NOT use `play()` with a loop. Instead, after switching to the wall-slide sheet, use `setFrame()` each update tick. You may need to stop the animation auto-advance by calling `setFpsOverride(0)` or similar approach so `update()` doesn't override the frame.

### 2. Wall-Slide Facing Correction

**File:** `src/engine/entities/Player.ts`

Currently in the WALL_SLIDING enter handler, the player faces away from the wall. Fix this so the player faces TOWARD the wall (the character is gripping it):

```typescript
// In WALL_SLIDING enter:
// OLD: player.facingRight = player.wallSide > 0;  // faces right on right wall (away from wall)
// NEW: player.facingRight = player.wallSide > 0;
// Actually — the wallSide convention: wallSide=1 means the wall is to the RIGHT of the player.
// To face the wall: if wall is to the right (wallSide=1), face right. If wall is to the left (wallSide=-1), face left.
// This means facingRight = (wallSide > 0) — which is TOWARD the wall. This is actually correct!
```

Wait — let me re-read the code more carefully. The wallSide=1 means wall is to the RIGHT. `facingRight = (wallSide > 0)` means facing right when wall is right = facing TOWARD the wall. This is already correct in terms of the boolean.

The real issue is the SPRITE ART DIRECTION. The `player-wall-slide-full` sprite sheet shows the character gripping a wall. The question is: does the sprite show the character facing left (gripping a wall to their left) or facing right (gripping a wall to their right)?

**Check the `facesLeft` field in STATE_TO_ANIMATION:**
Currently `WALL_SLIDING` does NOT have `facesLeft` set in the mapping, meaning the sprite draws facing right by default. When `facingRight = true` (wall to right), no flip is applied — the character would face right (toward the wall). When `facingRight = false` (wall to left), the sprite is flipped — the character would face left (toward the wall). So the facing is already toward-the-wall.

**However**, verify this by checking how `facingRight` interacts with the `flipX` rendering. If the sprite art shows the character reaching to their RIGHT to grip a wall, then:
- `wallSide=1` (right wall): `facingRight=true`, no flip → character grips to the right ✓
- `wallSide=-1` (left wall): `facingRight=false`, flip → character grips to the left ✓

This should already work correctly. If during testing the character appears to face away from the wall, the fix is either:
- Toggle the `facesLeft` field on the wall-slide mapping, OR
- Flip the `facingRight` assignment

**Action:** Verify the current behavior during testing. If the character faces away from the wall, add `facesLeft: true` to the `WALL_SLIDING` entry in `STATE_TO_ANIMATION` (PlayerSprites.ts). If it already faces toward the wall, no change needed.

### 3. Improved Wall Particles

**File:** `src/engine/entities/Player.ts`

#### 3a. Increase wall-slide entry burst

Change the entry burst from 3 particles to 5, with a slight downward velocity bias:

```typescript
// In WALL_SLIDING enter handler, replace:
//   player.emitWallParticles(3, player.wallSide === 1, 0.15);
// With:
player.emitWallParticles(5, player.wallSide === 1, 0.2);
```

Also modify the `emitWallParticles` method to add a slight downward bias to the angles:

In the emit call, shift the angle range slightly downward to make particles appear to scrape downward:
```typescript
// Current angles: baseAngle ± 0.8
// New entry angles: baseAngle + 0.3 (slight downward bias)
// For the entry burst specifically, pass a downward flag or adjust in the call
```

Actually, to keep it simple, just increase the count. The downward bias can be achieved by adjusting the `baseAngle` offset in the entry call specifically. Add a `downBias` parameter to `emitWallParticles`:

```typescript
private emitWallParticles(count: number, fromRight: boolean, life: number, downBias = 0) {
  // ... existing code ...
  const baseAngle = fromRight ? 0 : Math.PI;
  // Add downBias to shift particle angles downward (positive = more downward)
  const biasedAngle = baseAngle + downBias;
  // Use biasedAngle ± spread for particle directions
}
```

Entry call: `emitWallParticles(5, wallSide === 1, 0.2, 0.3)` — slight downward bias
Ongoing call: keep the existing 2 particles every 6 frames but change to every 5 frames
Wall-jump call: `emitWallParticles(6, wallSide === 1, 0.15)` — no bias (already good)

#### 3b. Increase ongoing particle frequency

Change from every 6 frames to every 5 frames:

```typescript
// In WALL_SLIDING update:
// OLD: if (player.wallSlideParticleTimer >= 6) {
// NEW: if (player.wallSlideParticleTimer >= 5) {
```

#### 3c. Add wall-slide EXIT burst

When LEAVING wall-slide (transitioning to FALLING, JUMPING, IDLE, or RUNNING), emit 3 particles in the departure direction:

```typescript
// In WALL_SLIDING exit handler (or at the point where state transitions away from WALL_SLIDING):
// Emit departure particles going AWAY from the wall
const departureFromRight = player.wallSide === 1;
player.emitWallParticles(3, !departureFromRight, 0.15);
// Note: !departureFromRight flips the direction — particles go away from wall
```

If WALL_SLIDING doesn't have an explicit exit handler, add one. The state machine supports `exit` hooks. Add:

```typescript
// Add to WALL_SLIDING state definition:
exit(player) {
  // Departure particles
  if (player.particleSystem) {
    // Emit 3 particles going away from the wall
    player.emitWallParticles(3, player.wallSide !== 1, 0.15);
  }
}
```

Wait — the direction logic for "away from wall": if `wallSide === 1` (right wall), particles should go LEFT (away from right wall). `emitWallParticles(count, fromRight=false, ...)` emits from the LEFT side going left. Actually `fromRight` controls WHERE the particles originate, not where they go. Let me reconsider.

`emitWallParticles(count, fromRight, life)`:
- `fromRight=true`: particles emit from the RIGHT side of the player (wall is on right), traveling rightward (away from player body, toward wall)
- `fromRight=false`: particles emit from the LEFT side

For departure particles, we want particles going AWAY from the wall:
- If wall is on right (`wallSide=1`): emit from left side going left → `fromRight=false`
- If wall is on left (`wallSide=-1`): emit from right side going right → `fromRight=true`

So: `player.emitWallParticles(3, player.wallSide === -1, 0.15);`

Actually, re-reading the emit code: `wallX = fromRight ? position.x + size.x : position.x` — so `fromRight=true` means origin is at the RIGHT edge of the player, and `baseAngle = fromRight ? 0 : Math.PI` — angle 0 is rightward, π is leftward.

So `fromRight=true` emits FROM the right edge GOING rightward. For wall contact on the right, that makes sense (particles scrape off the wall going right).

For DEPARTURE from a right wall, we want particles going LEFT (away from wall). That's `fromRight=false`: origin at left edge, going leftward (angle π). But we actually want them to originate from the WALL SIDE and go away. Let me think again...

Actually the simplest approach: for the departure burst, emit particles from the wall side but flip the angle to go away:

```typescript
// Exit particles — from wall side, going away from wall
const wallX = player.wallSide === 1
  ? player.position.x + player.size.x   // right wall contact
  : player.position.x;                  // left wall contact
const wallY = player.position.y + player.size.y * 0.4;

// Away from wall direction
const awayAngle = player.wallSide === 1 ? Math.PI : 0;  // left if right wall, right if left wall

player.particleSystem.emit({
  x: wallX, y: wallY,
  count: 3,
  speedMin: 40, speedMax: 100,
  angleMin: awayAngle - 0.6, angleMax: awayAngle + 0.6,
  lifeMin: 0.1, lifeMax: 0.2,
  sizeMin: 1.5, sizeMax: 3,
  colors: DUST_COLORS,
  gravity: 80,
});
```

Place this in the WALL_SLIDING `exit` handler. If no exit handler exists, add one to the state definition.

#### 3d. Biome-colored wall particles (optional stretch goal)

Add a `wallParticleColor` param to PlayerParams with a default of `null` (use `DUST_COLORS`). When set, use that color array instead. The play page / game world sets this based on the current biome:

```typescript
// In PlayerParams:
wallParticleColors: string[] | null;  // null = use DUST_COLORS

// Default: null (uses standard gray dust)

// Biome overrides (set by game loop when entering a biome room):
// scribe-hall: null (standard gray)
// herbarium-folio: ["#86efac", "#4ade80", "#bbf7d0"] (green leaf)
// gothic-errata: ["#9ca3af", "#6b7280", "#d1d5db"] (stone gray)
// astral-atlas: ["#c4b5fd", "#a78bfa", "#ddd6fe"] (purple shimmer)
// maritime-ledger: ["#7dd3fc", "#38bdf8", "#bae6fd"] (water blue)
```

This is a new `PlayerParams` field. The `emitWallParticles` method checks `this.params.wallParticleColors ?? DUST_COLORS`.

**This is a stretch goal.** If it adds too much scope, skip it — the standard gray dust is fine.

### 4. Wall-Jump Animation Timing

**File:** `src/engine/entities/Player.ts`

The wall-jump animation (`player-wall-jump`, 3 frames @ 15fps) should complete in roughly the lockout duration. 3 frames @ 15fps = 0.2s, lockout = 8 frames at 60fps = 0.133s. The animation is slightly longer than the lockout, which is fine — it will still be playing as the state transitions to JUMPING/FALLING, then the crossfade (2 frames) handles the visual blend.

**No changes needed here** — the current implementation already plays the dedicated wall-jump sheet with correct timing. Just verify during testing that the wall-jump animation is visible (not instantly crossfaded away).

### 5. Summary of Changes

| File | Change | Type |
|------|--------|------|
| `src/engine/entities/Player.ts` | Speed-based wall-slide frame selection in WALL_SLIDING update | Animation logic |
| `src/engine/entities/Player.ts` | Wall-slide entry: 3→5 particles with downward bias | Particles |
| `src/engine/entities/Player.ts` | Wall-slide ongoing: every 6→5 frames | Particles |
| `src/engine/entities/Player.ts` | Wall-slide EXIT handler: 3 departure particles | Particles |
| `src/engine/entities/Player.ts` | Optional: `wallParticleColors` param | Stretch |
| `src/engine/entities/PlayerSprites.ts` | Maybe: add/adjust `facesLeft` on WALL_SLIDING if facing is wrong | Animation |

---

## Verification

### Using the movement-showcase page (`/test/movement-showcase`)

1. **Speed-based frame selection:**
   - Wall-slide against a wall. Hold toward wall → observe slow grip frame (frame 1)
   - Release toward → observe faster slide frames (2, 3)
   - Just touch wall → observe grab frame (frame 0) during stick
   - Use time scale slider at 0.1× to clearly see frame transitions

2. **Wall-slide facing:**
   - Slide on a RIGHT wall → character should face right (toward wall, gripping it)
   - Slide on a LEFT wall → character should face left (toward wall, gripping it)
   - If character faces away from wall in either case, fix the facesLeft/facingRight logic

3. **Entry particles:**
   - Touch a wall → 5 particles should burst from contact point with slight downward bias
   - More visible than the old 3-particle burst

4. **Ongoing particles:**
   - While sliding, small particles scrape from the wall every ~5 frames
   - Visible at normal speed, not overwhelming

5. **Exit particles:**
   - Let go of wall (press away) → 3 particles burst AWAY from the wall
   - Wall-jump → 6 particles at wall + 3 departure particles from exit handler

6. **Wall-jump animation:**
   - Wall-jump should show the dedicated 3-frame push-off animation
   - Coiled → push-off → launch visible before transitioning to jump-rise
   - Use 0.1× time scale to see all 3 frames

7. **No physics changes:**
   - Wall-slide speeds unchanged (40 grip, 120 base)
   - Wall-jump launch unchanged (260 horizontal, 340 vertical)
   - Wall-stick duration unchanged (3 frames)
   - Coyote jump from wall unchanged (5 frames)

### Pass Criteria

- [ ] Wall-slide uses speed-based frame selection (4 distinct visual states based on slide speed)
- [ ] Wall-stick pause shows the "grab" frame (frame 0)
- [ ] Wall-slide entry emits 5 particles (up from 3) with downward bias
- [ ] Wall-slide ongoing particles emit every 5 frames (up from 6)
- [ ] Wall-slide exit (detach/state change) emits 3 departure particles away from wall
- [ ] Wall-jump has a visible 3-frame push-off animation (coiled → push → launch)
- [ ] Character faces toward the wall during wall-slide (not away)
- [ ] All visual enhancements are purely cosmetic (physics unchanged)
- [ ] Controls remain frame-perfect responsive throughout
- [ ] TypeScript compiles cleanly (`npx tsc --noEmit`)
- [ ] Existing tests pass (`npm run test:run`) — no regressions

---

## Notes

- **Frame selection vs animation loop:** The speed-based frame selection effectively replaces the wall-slide loop animation with manual frame control. Make sure to prevent the AnimationController from auto-advancing frames during wall-slide. Use `setFpsOverride(0)` or `setFrame()` on every tick to override.
- **Exit handler pattern:** The run-cycle-refinement task used `skidAnimTimer` and `turnAnimTimer` as overlay timers. Wall-slide exit particles are simpler — just emit in the exit hook, no timer needed.
- **The `emitWallParticles` helper** already exists and handles the basic pattern. Modifications should keep the same API shape, just add the optional `downBias` parameter.
- **Wall-jump is already wired** — the STATE_TO_ANIMATION maps WALL_JUMPING to `player-wall-jump`. Just verify it actually plays (the crossfade from WALL_SLIDING → WALL_JUMPING is 0 frames, so no blend delay).

---

## Completion Summary

### Changes Made

**File: `src/engine/entities/Player.ts`**

1. **Speed-based wall-slide frame selection**: Replaced the looping wall-slide animation with direct frame control based on slide speed. Uses `setFpsOverride(0)` to prevent auto-advance, then `setFrame()` each tick:
   - Frame 0 (grab): during `wallStickTimer > 0`
   - Frame 1 (grip): slide speed ≤ 48 px/s
   - Frame 2 (steady): slide speed ≤ 96 px/s
   - Frame 3 (fast): slide speed > 96 px/s

2. **Wall-stick grab frame**: Added explicit frame 0 hold during the stick phase (which returns early before the main velocity code), so the grab frame displays during the initial stick pause.

3. **Wall-facing correction**: Added `player.facingRight = player.wallSide > 0` in the WALL_SLIDING enter handler to ensure the character always faces toward the wall.

4. **Entry particle increase**: 3→5 particles with 0.3 radian downward bias via new `downBias` parameter on `emitWallParticles`.

5. **`emitWallParticles` downBias parameter**: Added optional 4th parameter `downBias = 0` that shifts the particle angle range downward for a wall-scrape effect.

6. **Ongoing particle frequency**: Changed from every 6 frames to every 5 frames.

7. **Wall-slide exit handler**: Replaced empty exit handler with one that:
   - Resets `setFpsOverride(null)` to restore normal animation behavior
   - Emits 3 departure particles away from the wall (originating from wall side, traveling in the away-from-wall direction)

### Skipped (stretch goals)
- Biome-colored wall particles — standard gray dust is sufficient for now

### Verification
- `npx tsc --noEmit` — clean, no errors
- `npm run test:run` — 427 tests passing, 16 test files, no regressions
- All changes are purely cosmetic — wall physics, speeds, timers unchanged

---

## Review

**Reviewer:** 485dd064
**Result:** Pass — no issues found

### Checked

1. **Speed-based frame selection** (lines 1313-1333): Correctly uses `setFpsOverride(0)` to disable auto-advance, then `setFrame()` each tick. The `Infinity` frameDuration from `1/0` safely prevents the `while` loop in `AnimationController.update()` from advancing frames. `setFrame()` resets `frameTimer` to 0 each tick, preventing timer accumulation that could cause a frame burst when the override is removed on exit.

2. **Ordering correctness**: State machine `update()` runs before the sprite animation update section in `Player.update()`. During WALL_SLIDING, `setFrame()` sets the current frame, then `play()` is a no-op (animation already playing), then `update(dt)` runs with fps=0 (no advance). Frame selection is preserved correctly.

3. **Wall-stick grab frame** (lines 1247-1249): Correctly holds frame 0 during stick phase. The early return at line 1266 means the later speed-based selection block's `wallStickTimer > 0` check (line 1321) is dead code — harmless but unreachable.

4. **Exit handler** (lines 1346-1375): Properly resets `setFpsOverride(null)` before emitting departure particles. Particle direction math is correct: `awayAngle = wallSide === 1 ? π : 0` sends particles away from the wall on both sides.

5. **emitWallParticles downBias** (lines 417-441): New optional parameter shifts particle angle range downward. Entry call uses `downBias=0.3` for scrape effect. Angle math is symmetrical for left/right walls.

6. **No physics changes**: Wall-slide velocity calculations (grip speed, base speed, acceleration), wall-stick duration, wall-jump launch speeds, and all timing constants are untouched. Only animation frame selection, particle counts/frequency, and facing direction were modified.

7. **TypeScript**: Compiles cleanly. No `any` types introduced.

8. **Tests**: 427 tests pass across 16 files, no regressions.
