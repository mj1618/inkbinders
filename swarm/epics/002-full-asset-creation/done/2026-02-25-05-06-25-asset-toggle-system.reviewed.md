# Task: Asset Toggle System — Global RenderMode for Sprites vs Rectangles

## Summary

Create a global `RenderConfig` system that every renderer checks before drawing, so any part of the game can switch between sprite rendering and rectangle rendering. This is the foundation for all subsequent asset tasks — nothing else in this epic can proceed until this toggle exists and works everywhere.

## What to Build

### 1. RenderConfig Class

**File:** `src/engine/core/RenderConfig.ts` (new)

Create a simple global render configuration:

```typescript
export type RenderMode = "sprites" | "rectangles" | "both";

export class RenderConfig {
  private static mode: RenderMode = "rectangles";

  static getMode(): RenderMode {
    return RenderConfig.mode;
  }

  static setMode(mode: RenderMode): void {
    RenderConfig.mode = mode;
  }

  static useSprites(): boolean {
    return RenderConfig.mode === "sprites" || RenderConfig.mode === "both";
  }

  static useRectangles(): boolean {
    return RenderConfig.mode === "rectangles" || RenderConfig.mode === "both";
  }
}
```

Export from `src/engine/core/index.ts`.

### 2. Player.ts — Conditional Rendering

**File:** `src/engine/entities/Player.ts` (modify the `render` method, around line 1423)

The Player's `render()` method currently draws colored rectangles with state-dependent colors. Modify it:

- When `RenderConfig.useRectangles()` is true: draw the existing colored rectangle (exact current behavior, zero visual change)
- When `RenderConfig.useSprites()` is true: use the AnimationController + PlayerSprites system to draw the sprite frame
  - Look up `STATE_TO_ANIMATION[this.stateMachine.currentState]` to get the correct `{sheetId, animName}`
  - Get the sprite sheet from `AssetManager.getInstance().getSpriteSheet(sheetId)`
  - If the sheet exists and is loaded, play the animation and call `animController.draw()`
  - The AnimationController should be a field on Player (create it if not already there)
  - When `mode === "both"`: draw sprite first, then the rectangle at 50% alpha on top

**Animation controller setup:**
- Add an `animController: AnimationController | null` field to Player
- Add an `initSprites()` method that loads sprite sheets via AssetManager and creates the controller
- Call `initSprites()` from the constructor (async — sprites load in background)
- In `update()`, after state machine update, call `animController.update(dt)` and set the correct animation based on current state using `STATE_TO_ANIMATION`
- In `render()`, check `RenderConfig.useSprites()` and draw via `animController.draw()` if sprites are available

**Important:** The existing rectangle rendering must remain EXACTLY as-is when `mode === "rectangles"`. No visual change to current behavior.

### 3. Enemy.ts Base Class — Conditional Rendering

**File:** `src/engine/entities/Enemy.ts` (modify `renderBase`, around line 249)

Same pattern as Player:
- When `RenderConfig.useRectangles()`: draw existing colored rectangles (current behavior)
- When `RenderConfig.useSprites()`: draw via AnimationController (placeholder sprites for now — enemies don't have sprite configs yet, so they'll fall back to AssetManager placeholders)
- Enemies don't need sprite integration yet (that's Task 3) — just add the conditional check with a TODO comment for sprite rendering, and keep drawing rectangles when no sprite is available

### 4. Boss Classes — Conditional Rendering

**Files:**
- `src/engine/entities/bosses/FootnoteGiant.ts` (modify `render`)
- `src/engine/entities/bosses/MisprintSeraph.ts` (modify `render`)
- `src/engine/entities/bosses/IndexEater.ts` (modify `render`)

Bosses render directly to canvas context, not through the Renderer wrapper. Add:
- `if (RenderConfig.useRectangles())` around the existing canvas drawing code
- A placeholder `if (RenderConfig.useSprites())` block that draws a simple colored rect with the boss name as text (temporary until Task 4 adds real boss sprites)
- When `mode === "both"`: draw both

### 5. TileMap — Conditional Rendering (Prep Only)

**File:** `src/engine/physics/TileMap.ts` (modify `render`, around line 242)

Wrap the existing platform rendering in `if (RenderConfig.useRectangles())`. Add a `// TODO: sprite tile rendering (Task 5)` comment in the sprites branch. For now, always draw rectangles regardless of mode (tiles without sprites should still be visible).

### 6. Sprites Test Page Refactor

**File:** `src/app/test/sprites/page.tsx` (modify)

The sprites test page currently has a local `RenderMode` state. Refactor it to use the global `RenderConfig`:
- Remove the local `renderMode` state
- Import and use `RenderConfig.setMode()` / `RenderConfig.getMode()`
- The toggle in the debug panel should call `RenderConfig.setMode()`
- The engine render callback should check `RenderConfig.useSprites()` / `RenderConfig.useRectangles()`

### 7. All Test Pages — Add Render Mode Toggle

Add a "Render Mode" dropdown/buttons to the debug panel of EVERY test page. The toggle should appear at the TOP of the debug panel (before other controls) for consistent placement.

**Files to modify (add render mode toggle):**
- `src/app/test/ground-movement/page.tsx`
- `src/app/test/jumping/page.tsx`
- `src/app/test/wall-mechanics/page.tsx`
- `src/app/test/dash/page.tsx`
- `src/app/test/transitions/page.tsx`
- `src/app/test/movement-playground/page.tsx`
- `src/app/test/margin-stitch/page.tsx`
- `src/app/test/redaction/page.tsx`
- `src/app/test/paste-over/page.tsx`
- `src/app/test/index-mark/page.tsx`
- `src/app/test/combat-melee/page.tsx`
- `src/app/test/enemies/page.tsx`
- `src/app/test/boss/footnote-giant/page.tsx`
- `src/app/test/boss/misprint-seraph/page.tsx`
- `src/app/test/boss/index-eater/page.tsx`
- `src/app/test/biome/herbarium-folio/page.tsx`
- `src/app/test/biome/astral-atlas/page.tsx`
- `src/app/test/biome/maritime-ledger/page.tsx`
- `src/app/test/biome/gothic-errata/page.tsx`
- `src/app/test/day-night/page.tsx`
- `src/app/test/ink-cards/page.tsx`
- `src/app/test/room-editor/page.tsx`
- `src/app/test/world-assembly/page.tsx`
- `src/app/test/hud/page.tsx`
- `src/app/test/sprites/page.tsx` (refactor existing)
- `src/app/test/herbarium-wing/page.tsx`

**Pattern for the toggle** (add to each page's debug panel):

```tsx
// At top of debug panel, before other sections
<div className="mb-4 pb-3 border-b border-gray-700">
  <label className="block text-xs text-gray-400 mb-1">Render Mode</label>
  <div className="flex gap-1">
    {(["rectangles", "sprites", "both"] as const).map((mode) => (
      <button
        key={mode}
        onClick={() => {
          RenderConfig.setMode(mode);
          setRenderMode(mode); // local state for UI highlight
        }}
        className={`px-2 py-1 text-xs rounded ${
          renderMode === mode
            ? "bg-blue-600 text-white"
            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
        }`}
      >
        {mode}
      </button>
    ))}
  </div>
</div>
```

Each test page needs:
1. Import `RenderConfig` from `@/engine/core/RenderConfig`
2. Local React state: `const [renderMode, setRenderMode] = useState<RenderMode>("rectangles")`
3. Initialize in useEffect: `RenderConfig.setMode("rectangles")` (test pages default to rectangles)
4. The toggle buttons in the debug panel

**To make this manageable:** Create a reusable `RenderModeToggle` component in `src/components/debug/RenderModeToggle.tsx` that encapsulates the toggle UI and syncs with `RenderConfig`. Then import it in each test page's debug panel.

### 8. Play Page — Default to Sprites

**File:** `src/app/play/page.tsx` (modify)

- Import `RenderConfig`
- In the useEffect setup (before the engine starts), call `RenderConfig.setMode("sprites")`
- The play page defaults to sprites (with AssetManager placeholder fallback if no real images exist)
- No toggle needed in the play page UI (players don't need this control — it's a dev tool)

## Context

### Current rendering architecture

Three rendering approaches exist in the codebase:
1. **Entity-based** (Player, Enemies): Override `render(renderer: Renderer, interpolation: number)` — use `renderer.fillRect()` etc.
2. **Raw canvas** (Bosses): Take `CanvasRenderingContext2D` directly and draw with `ctx.fillRect()`, `ctx.beginPath()`, etc.
3. **TileMap**: Uses `renderer.fillRect()` and `renderer.strokeRect()` for platforms

### Existing sprite system

- `AssetManager` singleton loads `SpriteSheet` objects, generates colored-rectangle placeholders on image load failure
- `AnimationController` handles frame advancement and drawing via `SpriteSheet.drawFrame()`
- `PlayerSprites.ts` defines 3 sheet configs (idle, run, jump) and `STATE_TO_ANIMATION` mapping
- The sprites test page (`/test/sprites`) already demonstrates the toggle pattern with local state

### Key constraint

**Rectangle rendering must be EXACTLY the same as today** when `mode === "rectangles"`. This is the default for all test pages. No visual regression. The toggle is purely additive — it enables sprite rendering without changing the existing rectangle path.

## Verification / Pass Criteria

1. **RenderConfig class exists** at `src/engine/core/RenderConfig.ts` with `getMode()`, `setMode()`, `useSprites()`, `useRectangles()` API
2. **Every test page** has a "Render Mode" toggle at the top of its debug panel
3. **Default modes**: test pages default to `"rectangles"`, play page defaults to `"sprites"`
4. **Rectangle mode** produces visually identical output to current behavior (zero visual regression)
5. **Sprites mode** shows placeholder sprites for the player (colored rects with frame numbers from AssetManager) — enemies and bosses draw rectangles in sprite mode too until their sprite tasks are done
6. **Both mode** draws sprites + semi-transparent rectangles overlaid
7. **Sprites test page** uses the global `RenderConfig` instead of local render mode state
8. **Player.ts** has an AnimationController field that updates each frame and draws when in sprite mode
9. **No TypeScript errors**: `npx tsc --noEmit` passes
10. **No test regressions**: `npm run test:run` passes (headless tests don't use rendering)
11. **Build succeeds**: `npm run build` passes

## Implementation Notes

- The `RenderModeToggle` component should be created to avoid duplicating the toggle UI across 26+ test pages
- Player sprite initialization is async (image loading) — the AnimationController should gracefully handle the case where sheets aren't loaded yet (just skip sprite drawing and fall back to rectangles)
- Bosses have complex rendering with telegraphs, shockwaves, etc. — only wrap the main body rendering in the mode check. Effect rendering (telegraphs, particles) should always show regardless of mode.
- The `RenderConfig` class uses static methods because there's only one render mode per page — no need for instancing or React context

---

## Implementation Summary

### Files Created
- **`src/engine/core/RenderConfig.ts`** — Global static RenderConfig class with `getMode()`, `setMode()`, `useSprites()`, `useRectangles()` API
- **`src/components/debug/RenderModeToggle.tsx`** — Reusable toggle component for debug panels (3 buttons: rectangles / sprites / both)

### Files Modified
- **`src/engine/core/index.ts`** — Added RenderConfig and RenderMode exports
- **`src/engine/entities/Player.ts`** — Added AnimationController field, `initSprites()` method, sprite update in `update()`, conditional rendering in `render()` based on RenderConfig mode. In "both" mode, sprites render first, then rectangles at 50% alpha.
- **`src/engine/entities/Enemy.ts`** — Wrapped body rendering in `renderBase()` with `RenderConfig.useRectangles()` check. Sprite-only mode still draws rectangles (no enemy sprites yet).
- **`src/engine/entities/bosses/FootnoteGiant.ts`** — Added sprite-mode placeholder (colored rect #4338ca + "Footnote Giant" label), early return before complex rendering
- **`src/engine/entities/bosses/MisprintSeraph.ts`** — Added sprite-mode placeholder (colored rect #f8fafc + "Misprint Seraph" label), respects teleportAlpha
- **`src/engine/entities/bosses/IndexEater.ts`** — Added sprite-mode placeholder (colored rect #365314 + "Index Eater" label)
- **`src/engine/physics/TileMap.ts`** — Added RenderConfig import, always renders rectangles (no tile sprites yet)
- **`src/app/test/sprites/page.tsx`** — Refactored to use global RenderConfig instead of local renderMode state, defaults to "sprites" mode
- **`src/app/play/page.tsx`** — Defaults to "sprites" mode via `RenderConfig.setMode("sprites")` on mount
- **All 25 other test pages** — Each received: RenderConfig import, `RenderConfig.setMode("rectangles")` in mount handler, RenderModeToggle component as first child of DebugPanel

### Verification Results
- `npx tsc --noEmit` — passes clean (no errors)
- `npm run test:run` — 16 test files, 427 tests all passing (293 non-fatal sprite loading errors expected in headless test environment)
- `npm run build` — passes clean, all pages compile

---

## Review Notes (reviewer: 0b4a3e0a)

### Fix Applied

**`src/engine/entities/Player.ts` — Added `.catch()` to `initSprites()` promise chain**

The `initSprites()` method calls `AssetManager.loadAll()` which internally creates `new Image()` objects. In headless test environments (Vitest without DOM), `Image` is not defined, causing `ReferenceError` that propagated as unhandled promise rejections (293 per test run). Added a `.catch()` handler so the Player gracefully falls back to rectangle rendering when sprite loading fails. This eliminated all 293 test errors.

### Verified (post-fix)
- `npx tsc --noEmit` — passes clean
- `npm run test:run` — 16 files, 427 tests, **0 errors** (down from 293)
- `npm run build` — passes clean

### Review Findings

**Overall: Clean implementation.** The asset toggle system is well-structured:

1. **RenderConfig.ts** — Simple, correct static class. All three modes covered by `useSprites()` / `useRectangles()` boolean helpers.
2. **RenderModeToggle.tsx** — Clean reusable component. Properly syncs local React state with the global static config.
3. **Player.ts sprite integration** — AnimationController map per sprite sheet, state-driven animation switching via `STATE_TO_ANIMATION`, proper offset calculation for sprite drawing. The "both" mode correctly draws sprites first, then rectangles at 50% alpha with `globalAlpha` save/restore.
4. **Enemy.ts** — Minimal change, correctly wraps body rendering. Falls back to rectangles in sprites-only mode (no enemy sprites yet).
5. **Boss rendering** — All three bosses (FootnoteGiant, MisprintSeraph, IndexEater) have sprite-mode placeholders with labeled colored rectangles. Effect rendering (telegraphs, shockwaves, particles) always shows regardless of mode, which is correct.
6. **TileMap** — Always renders tiles (correct since there are no tile sprites). TODO comment for Task 5.
7. **Test pages** — All 26 test pages verified with RenderModeToggle import and `RenderConfig.setMode("rectangles")` on mount.
8. **Play page** — Correctly defaults to "sprites" mode.
9. **No visual regression risk** — Rectangle rendering paths are unchanged; the toggle is purely additive.
