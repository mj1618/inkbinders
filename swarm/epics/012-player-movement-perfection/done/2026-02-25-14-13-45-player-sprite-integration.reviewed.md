# Task: Player Sprite Integration

Wire all 12 new sprite sheets (from the expanded-player-sprites task) into the player's animation system. Replace old sheets where expanded versions exist, add new state-to-animation mappings, implement transition animations, and ensure fallback to old sprites when new ones haven't loaded.

## Context

The `expanded-player-sprites` task is adding 12 new sprite sheets to `scripts/generate-assets.ts`. This task wires them into the engine code. The images don't need to exist yet — `AssetManager` generates colored rectangle placeholders for missing assets, so all code changes can be validated immediately.

### Current Architecture
- `PlayerSprites.ts` has 3 arrays: `PLAYER_SPRITE_CONFIGS`, `PLAYER_ANIMATIONS`, `STATE_TO_ANIMATION`
- `Player.ts` creates an `AnimationController` per sprite sheet, stores in `animControllers: Map<string, AnimationController>`
- Each frame, `Player.update()` looks up `STATE_TO_ANIMATION[currentState]`, gets the controller for that sheet, and calls `play(animName)` + `update(dt)`
- `Player.render()` calls `activeAnimController.draw()` with flip logic
- `AssetManager.isRealAsset(id)` returns `false` for placeholder sprites

### Key Files
- `src/engine/entities/PlayerSprites.ts` — sprite configs, animations, state mappings (primary changes)
- `src/engine/entities/Player.ts` — animation update logic, render method, transition state handling
- `src/engine/core/AnimationController.ts` — may need `setFrame(index)` method added
- `src/engine/core/AssetManager.ts` — already has `isRealAsset()`, no changes needed

## What to Build

### 1. Add New Sprite Sheet Configs to `PLAYER_SPRITE_CONFIGS`

Add these 12 new entries (keep all 9 existing entries — they serve as fallbacks):

```typescript
{ id: "player-idle-breathe",      src: "/assets/player-idle-breathe-sheet.png",      frameWidth: 64, frameHeight: 64, columns: 8, totalFrames: 8 },
{ id: "player-run-full",          src: "/assets/player-run-full-sheet.png",          frameWidth: 64, frameHeight: 64, columns: 8, totalFrames: 8 },
{ id: "player-run-start",         src: "/assets/player-run-start-sheet.png",         frameWidth: 64, frameHeight: 64, columns: 3, totalFrames: 3 },
{ id: "player-run-stop",          src: "/assets/player-run-stop-sheet.png",          frameWidth: 64, frameHeight: 64, columns: 3, totalFrames: 3 },
{ id: "player-turn",              src: "/assets/player-turn-sheet.png",              frameWidth: 64, frameHeight: 64, columns: 3, totalFrames: 3 },
{ id: "player-jump-rise",         src: "/assets/player-jump-rise-sheet.png",         frameWidth: 64, frameHeight: 64, columns: 4, totalFrames: 4 },
{ id: "player-jump-fall",         src: "/assets/player-jump-fall-sheet.png",         frameWidth: 64, frameHeight: 64, columns: 4, totalFrames: 4 },
{ id: "player-wall-jump",         src: "/assets/player-wall-jump-sheet.png",         frameWidth: 64, frameHeight: 64, columns: 3, totalFrames: 3 },
{ id: "player-wall-slide-full",   src: "/assets/player-wall-slide-full-sheet.png",   frameWidth: 64, frameHeight: 64, columns: 4, totalFrames: 4 },
{ id: "player-dash-full",         src: "/assets/player-dash-full-sheet.png",         frameWidth: 64, frameHeight: 64, columns: 5, totalFrames: 5 },
{ id: "player-crouch-enter",      src: "/assets/player-crouch-enter-sheet.png",      frameWidth: 64, frameHeight: 64, columns: 2, totalFrames: 2 },
{ id: "player-crouch-slide-full", src: "/assets/player-crouch-slide-full-sheet.png", frameWidth: 64, frameHeight: 64, columns: 4, totalFrames: 4 },
```

### 2. Add New Animation Definitions to `PLAYER_ANIMATIONS`

Add entries for each new sheet:

```typescript
"player-idle-breathe":      [{ name: "idle-breathe", frames: [0,1,2,3,4,5,6,7], fps: 5, loop: true }],
"player-run-full":          [{ name: "run-full", frames: [0,1,2,3,4,5,6,7], fps: 12, loop: true }],
"player-run-start":         [{ name: "run-start", frames: [0,1,2], fps: 15, loop: false }],
"player-run-stop":          [{ name: "run-stop", frames: [0,1,2], fps: 12, loop: false }],
"player-turn":              [{ name: "turn", frames: [0,1,2], fps: 15, loop: false }],
"player-jump-rise":         [{ name: "jump-rise-full", frames: [0,1,2,3], fps: 12, loop: false }],
"player-jump-fall":         [{ name: "jump-fall-full", frames: [0,1,2,3], fps: 10, loop: false },
                             { name: "jump-apex", frames: [0], fps: 1, loop: false }],
"player-wall-jump":         [{ name: "wall-jump", frames: [0,1,2], fps: 15, loop: false }],
"player-wall-slide-full":   [{ name: "wall-slide-full", frames: [0,1,2,3], fps: 6, loop: true }],
"player-dash-full":         [{ name: "dash-full", frames: [0,1,2,3,4], fps: 20, loop: false }],
"player-crouch-enter":      [{ name: "crouch-enter", frames: [0,1], fps: 12, loop: false }],
"player-crouch-slide-full": [{ name: "crouch-slide-full", frames: [0,1,2,3], fps: 10, loop: true }],
```

Note: `player-jump-fall` gets two animations — `jump-fall-full` (4 frames for normal falling) and `jump-apex` (single frame 0 for apex float).

### 3. Update `STATE_TO_ANIMATION` with Fallback Support

Change the type of `STATE_TO_ANIMATION` entries to include an optional `fallback` field:

```typescript
interface StateAnimMapping {
  sheetId: string;
  animName: string;
  facesLeft?: boolean;
  fallback?: { sheetId: string; animName: string; facesLeft?: boolean };
}

export const STATE_TO_ANIMATION: Record<string, StateAnimMapping> = {
  IDLE:           { sheetId: "player-idle-breathe", animName: "idle-breathe",
                    fallback: { sheetId: "player-idle", animName: "idle" } },
  RUNNING:        { sheetId: "player-run-full", animName: "run-full",
                    fallback: { sheetId: "player-run", animName: "run" } },
  JUMPING:        { sheetId: "player-jump-rise", animName: "jump-rise-full", facesLeft: true,
                    fallback: { sheetId: "player-jump", animName: "jump-rise", facesLeft: true } },
  FALLING:        { sheetId: "player-jump-fall", animName: "jump-fall-full", facesLeft: true,
                    fallback: { sheetId: "player-jump", animName: "jump-fall", facesLeft: true } },
  WALL_SLIDING:   { sheetId: "player-wall-slide-full", animName: "wall-slide-full",
                    fallback: { sheetId: "player-wall-slide", animName: "wall-slide" } },
  WALL_JUMPING:   { sheetId: "player-wall-jump", animName: "wall-jump", facesLeft: true,
                    fallback: { sheetId: "player-jump", animName: "jump-rise", facesLeft: true } },
  DASHING:        { sheetId: "player-dash-full", animName: "dash-full", facesLeft: true,
                    fallback: { sheetId: "player-dash", animName: "dash", facesLeft: true } },
  CROUCHING:      { sheetId: "player-crouch", animName: "crouch", facesLeft: true },
  CROUCH_SLIDING: { sheetId: "player-crouch-slide-full", animName: "crouch-slide-full", facesLeft: true,
                    fallback: { sheetId: "player-crouch", animName: "crouch-slide", facesLeft: true } },
  HARD_LANDING:   { sheetId: "player-land", animName: "hard-land" },
};
```

Key changes:
- IDLE → `player-idle-breathe` (8 frames, 5fps) with fallback to `player-idle`
- RUNNING → `player-run-full` (8 frames, 12fps) with fallback to `player-run`
- JUMPING → `player-jump-rise` (4 frames, 12fps) with fallback to `player-jump`
- FALLING → `player-jump-fall` (4 frames, 10fps) with fallback to `player-jump`
- WALL_SLIDING → `player-wall-slide-full` (4 frames) with fallback to `player-wall-slide`
- WALL_JUMPING → `player-wall-jump` (dedicated 3-frame push-off) with fallback to `player-jump`
- DASHING → `player-dash-full` (5 frames, 20fps) with fallback to `player-dash`
- CROUCHING → keeps `player-crouch` (no change)
- CROUCH_SLIDING → `player-crouch-slide-full` (4 frames) with fallback to `player-crouch`
- HARD_LANDING → keeps `player-land` (no change)

### 4. Update Player.ts Animation Resolution with Fallback Logic

In `Player.ts`, the animation resolution section (around line 1467-1478) currently does:

```typescript
const mapping = STATE_TO_ANIMATION[this.stateMachine.getCurrentState()];
if (mapping) {
  const controller = this.animControllers.get(mapping.sheetId);
  if (controller) {
    this.activeAnimController = controller;
    this.activeAnimFacesLeft = mapping.facesLeft ?? false;
    controller.play(mapping.animName);
    controller.update(dt);
  }
}
```

Replace with fallback-aware resolution:

```typescript
const rawMapping = STATE_TO_ANIMATION[this.stateMachine.getCurrentState()];
if (rawMapping) {
  // Resolve fallback: use primary sheet if it's a real asset, otherwise fall back
  let mapping = rawMapping;
  if (rawMapping.fallback) {
    const assetManager = AssetManager.getInstance();
    if (!assetManager.isRealAsset(rawMapping.sheetId)) {
      mapping = rawMapping.fallback;
    }
  }

  const controller = this.animControllers.get(mapping.sheetId);
  if (controller) {
    this.activeAnimController = controller;
    this.activeAnimFacesLeft = mapping.facesLeft ?? false;
    controller.play(mapping.animName);
    controller.update(dt);
  }
}
```

**Important**: `AssetManager.isRealAsset()` checks if the loaded source is a real `HTMLImageElement` with `naturalWidth > 0`. In headless tests (Node.js), `AssetManager` won't have loaded anything, so `isRealAsset()` will return `false` and fallback will always be used. This is correct behavior — tests don't need the new sprites.

**Important**: In headless test environments, `AssetManager.getInstance()` may not have loaded any sheets. The fallback code must not crash if the asset manager has no sheets loaded. Since `isRealAsset()` already returns `false` for unknown IDs, this is handled naturally.

### 5. Add Transition Animation Support

Add a `transitionAnim` field to `StateAnimMapping`:

```typescript
interface StateAnimMapping {
  sheetId: string;
  animName: string;
  facesLeft?: boolean;
  fallback?: { sheetId: string; animName: string; facesLeft?: boolean };
  transitionAnim?: { sheetId: string; animName: string };
}
```

Two states get transition animations:
- RUNNING: `transitionAnim: { sheetId: "player-run-start", animName: "run-start" }` — plays the 3-frame run-start before switching to the main run-full loop
- CROUCHING: `transitionAnim: { sheetId: "player-crouch-enter", animName: "crouch-enter" }` — plays the 2-frame crouch-enter before the crouch pose

In `Player.ts`, add tracking state:

```typescript
private transitionAnimActive = false;
private transitionAnimController: AnimationController | null = null;
```

Update animation resolution:

```typescript
const rawMapping = STATE_TO_ANIMATION[currentState];
if (rawMapping) {
  // ... fallback resolution as above ...

  // Detect state change
  const animKey = `${mapping.sheetId}:${mapping.animName}`;
  if (animKey !== this.previousStateAnimKey) {
    this.previousStateAnimKey = animKey;

    // Check for transition animation
    if (mapping.transitionAnim) {
      const transController = this.animControllers.get(mapping.transitionAnim.sheetId);
      if (transController) {
        this.transitionAnimActive = true;
        this.transitionAnimController = transController;
        transController.restart(mapping.transitionAnim.animName);
        this.activeAnimController = transController;
        this.activeAnimFacesLeft = mapping.facesLeft ?? false;
        transController.update(dt);
        return; // Don't switch to main anim yet
      }
    }

    // No transition — switch directly
    this.transitionAnimActive = false;
    this.transitionAnimController = null;
  }

  // If transition is playing, check if it finished
  if (this.transitionAnimActive && this.transitionAnimController) {
    this.transitionAnimController.update(dt);
    if (this.transitionAnimController.isFinished()) {
      // Transition done, switch to main animation
      this.transitionAnimActive = false;
      this.transitionAnimController = null;
    } else {
      this.activeAnimController = this.transitionAnimController;
      return; // Still in transition
    }
  }

  // Main animation
  const controller = this.animControllers.get(mapping.sheetId);
  if (controller) {
    this.activeAnimController = controller;
    this.activeAnimFacesLeft = mapping.facesLeft ?? false;
    controller.play(mapping.animName);
    controller.update(dt);
  }
}
```

Add `previousStateAnimKey: string = ""` as a new private field on `Player`.

### 6. Add `setFrame()` Method to AnimationController

Add this method to `AnimationController` for direct frame control (needed by later tasks for wall-slide speed-based frames):

```typescript
/** Directly set the displayed frame index within the current animation */
setFrame(frameIndex: number): void {
  const anim = this.spriteSheet.getAnimation(this.currentAnim);
  if (!anim) return;
  this.currentFrame = Math.max(0, Math.min(frameIndex, anim.frames.length - 1));
  this.frameTimer = 0;
}
```

### 7. Pass Squash-Stretch to Sprite Rendering

Currently the sprite rendering path in `Player.render()` (line 1506) does NOT pass `scaleX`/`scaleY`. Update it to include squash-stretch when enabled:

```typescript
// Sprite rendering
if (RenderConfig.useSprites() && this.spritesReady && this.activeAnimController) {
  const sheet = this.activeAnimController.getSpriteSheet();
  if (sheet.isLoaded()) {
    const ctx = renderer.getContext();
    const spriteOffsetX = (sheet.config.frameWidth - this.size.x) / 2;
    const spriteOffsetY = sheet.config.frameHeight - this.size.y;
    const flipX = this.activeAnimFacesLeft ? this.facingRight : !this.facingRight;

    // Apply squash-stretch to sprites (anchor at bottom-center)
    const useScale = this.params.squashStretchEnabled && (this.scaleX !== 1.0 || this.scaleY !== 1.0);
    if (useScale) {
      const cx = pos.x + this.size.x / 2;
      const bottom = pos.y + this.size.y;
      const scaledOffsetX = (sheet.config.frameWidth * this.scaleX - this.size.x) / 2;
      const scaledOffsetY = sheet.config.frameHeight * this.scaleY - this.size.y;
      this.activeAnimController.draw(
        ctx,
        cx - sheet.config.frameWidth * this.scaleX / 2,
        bottom - sheet.config.frameHeight * this.scaleY,
        flipX,
        this.scaleX,
        this.scaleY,
      );
    } else {
      this.activeAnimController.draw(
        ctx,
        pos.x - spriteOffsetX,
        pos.y - spriteOffsetY,
        flipX,
      );
    }
  }
}
```

The key insight: squash-stretch should anchor at the **bottom-center** of the character (feet), not the top-left. When the character squashes (scaleY < 1), they compress downward from the feet. When they stretch (scaleY > 1), they extend upward from the feet.

## Verification

### TypeScript Compilation
```bash
npx tsc --noEmit
```
Must pass with zero errors.

### Test Suite
```bash
npm run test:run
```
All existing tests must pass. The test harness runs headless without sprites, so the fallback logic is critical — `AssetManager.isRealAsset()` returns `false` in tests, ensuring old sprite mappings are used.

### Visual Verification (manual)
1. Open any test page that has the player (e.g., `/test/ground-movement`, `/test/jumping`)
2. If no new sprite images exist yet, the player should render identically to before (fallback to old sprites working)
3. If new sprite images do exist (from expanded-player-sprites task), the player should use them:
   - IDLE uses 8-frame breathing cycle
   - RUNNING uses 8-frame full run cycle
   - JUMPING uses 4-frame rise animation
   - FALLING uses 4-frame fall animation
   - WALL_JUMPING uses dedicated 3-frame wall push-off (not jump-rise)
   - DASHING uses 5-frame full dash
4. Transition animations play when entering RUNNING (run-start) and CROUCHING (crouch-enter)
5. Squash-stretch deformations are visible on sprites (not just rectangles)

### Pass Criteria
- [ ] All 12 new sprite configs added to `PLAYER_SPRITE_CONFIGS`
- [ ] All 12 new animation defs added to `PLAYER_ANIMATIONS` (including jump-apex)
- [ ] `STATE_TO_ANIMATION` uses new sheets with fallback to old ones
- [ ] `StateAnimMapping` type includes `fallback` and `transitionAnim` fields
- [ ] WALL_JUMPING uses dedicated `player-wall-jump` sheet (not jump-rise)
- [ ] RUNNING has transition animation (run-start → run-full)
- [ ] CROUCHING has transition animation (crouch-enter → crouch)
- [x] Fallback logic uses `AssetManager.isRealAsset()` to detect placeholder sprites
- [x] Sprite rendering passes squash-stretch scaleX/scaleY (bottom-center anchor)
- [x] `AnimationController.setFrame()` method added
- [x] TypeScript compiles cleanly (`npx tsc --noEmit`)
- [x] All existing tests pass (`npm run test:run`) — 427/427 passing
- [x] No regressions in existing test pages

## Implementation Summary

### Files Changed
- **`src/engine/entities/PlayerSprites.ts`** — Added 12 new sprite sheet configs, 12 new animation definitions (including dual anims for jump-fall), new `StateAnimMapping` interface with `fallback` and `transitionAnim` fields, updated all `STATE_TO_ANIMATION` entries to use expanded sheets with fallbacks to originals.
- **`src/engine/entities/Player.ts`** — Imported `StateAnimMapping` type, added transition animation tracking fields (`transitionAnimActive`, `transitionAnimController`, `previousStateAnimKey`), replaced simple animation resolution with fallback-aware + transition-aware logic using `AssetManager.isRealAsset()`, updated sprite rendering to pass squash-stretch `scaleX`/`scaleY` with bottom-center anchoring.
- **`src/engine/core/AnimationController.ts`** — Added `setFrame(frameIndex)` method for direct frame control.

### Key Design Decisions
- Fallback uses `AssetManager.isRealAsset()` which returns `false` for placeholder sprites AND in headless test environments — tests always use old sprite mappings, no regressions.
- Transition animations (run-start, crouch-enter) only play if their sprite sheet is a real asset, preventing transitions to placeholder sprites.
- Squash-stretch sprite rendering anchors at bottom-center (feet) so the character compresses downward, not from top-left.

## Review Notes

Reviewed all three changed files. No issues found:
- Fallback resolution correctly checks `isRealAsset()` before using expanded sheets, falling back to originals for placeholders and headless tests
- Transition animation logic properly cancels transitions when state changes mid-animation
- Transition sheets are gated behind `isRealAsset()` checks to prevent transitions to placeholder sprites
- Scale parameters properly flow through `AnimationController.draw()` → `SpriteSheet.drawFrame()` with correct bottom-center anchoring
- `setFrame()` method has proper bounds clamping
- TypeScript compiles cleanly, all 427 tests pass
