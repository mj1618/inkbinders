# Task: Project Scaffolding

## What to Build

Set up the entire project foundation: Next.js app with TypeScript and Tailwind, Convex backend, folder structure, and the test page index hub. This is the first task — nothing else can be built until this exists.

## Steps

### 1. Initialize Next.js App

Create a Next.js application **in the existing `/Users/matt/code/inkbinders/` directory** using the App Router, TypeScript, and Tailwind CSS. Use `npx create-next-app@latest` (or equivalent) with these options:
- TypeScript: yes
- Tailwind CSS: yes
- ESLint: yes
- App Router: yes
- `src/` directory: yes
- Import alias: `@/*` → `src/*`

**Important:** The project root already has `design/` and `swarm/` folders. Don't delete those. Initialize in the same directory or merge carefully.

### 2. Initialize Convex

Set up a **new** Convex project. Run `npx convex dev` to create the `convex/` directory. Create a minimal schema file so the project structure exists. Do NOT connect to any existing Convex deployment — this is a fresh project.

- Create `convex/schema.ts` with a placeholder game state table
- Create `convex/_generated/` (this happens automatically on `npx convex init`)
- If Convex init requires interactive prompts, just create the `convex/` folder manually with the right files

### 3. Create Engine Folder Structure

Create the following directories and placeholder index files (each `index.ts` should just export an empty object or type for now — the point is the structure exists):

```
src/engine/
  core/           # Game loop, timing, renderer
    index.ts
  physics/        # Collision, gravity, surfaces
    index.ts
  input/          # Input handling, buffering
    index.ts
  entities/       # Player, enemies, bosses
    index.ts
  states/         # State machine for player/entities
    index.ts
  abilities/      # Stitch, Redaction, Paste-Over, Index Mark
    index.ts
  world/          # Room system, biomes, day-night
    index.ts
  combat/         # Weapons, hitboxes, damage
    index.ts
  ui/             # Debug overlays, HUD, menus
    index.ts
  index.ts        # Main engine export
```

### 4. Create Shared Components Directory

```
src/components/
  debug/          # Debug panel, sliders, overlays
    DebugPanel.tsx      # Reusable debug sidebar component
    Slider.tsx          # Reusable slider bound to engine params
    index.ts
  canvas/
    GameCanvas.tsx      # Reusable canvas component that mounts the engine
    index.ts
  index.ts
```

### 5. Create Utility Directory

```
src/lib/
  constants.ts    # Game-wide constants (canvas size, colors, etc.)
  types.ts        # Shared TypeScript types
  index.ts
```

### 6. Create Test Page Routes (Stubs)

Create stub pages for ALL test routes listed in the plan. Each stub should be a simple React page that shows the test name, its status ("Not Started"), and a brief description of what it will test. Use Tailwind for styling.

**Test page index** (`src/app/test/page.tsx`):
- Hub page linking to every test page
- Each link shows: test name, phase number, status badge (not started / in progress / passing)
- Status should be read from a config object (not Convex yet — keep it simple)
- Style: clean dark theme, monospace font for the debug feel, organized by phase
- Include the project name "Inkbinders" and subtitle "Test Page Index"

**Status config** (`src/lib/testStatus.ts`):
```typescript
export type TestStatus = 'not-started' | 'in-progress' | 'passing';

export interface TestPageConfig {
  name: string;
  path: string;
  phase: number;
  phaseName: string;
  status: TestStatus;
  description: string;
}

export const TEST_PAGES: TestPageConfig[] = [
  // Phase 1 — Core Movement
  { name: 'Ground Movement', path: '/test/ground-movement', phase: 1, phaseName: 'Core Movement', status: 'not-started', description: 'Variable-speed run, acceleration curves, turn-snap, crouch-slide' },
  { name: 'Jumping', path: '/test/jumping', phase: 1, phaseName: 'Core Movement', status: 'not-started', description: 'Variable-height jump, coyote time, input buffering, apex float' },
  { name: 'Wall Mechanics', path: '/test/wall-mechanics', phase: 1, phaseName: 'Core Movement', status: 'not-started', description: 'Wall-slide with graduated friction, wall-jump with input lockout' },
  { name: 'Dash', path: '/test/dash', phase: 1, phaseName: 'Core Movement', status: 'not-started', description: '8-directional dash, i-frames, dash-cancel, speed boost' },
  { name: 'Transitions', path: '/test/transitions', phase: 1, phaseName: 'Core Movement', status: 'not-started', description: 'Seamless state transitions, squash-stretch, landing system' },
  { name: 'Movement Playground', path: '/test/movement-playground', phase: 1, phaseName: 'Core Movement', status: 'not-started', description: 'Integration test — the movement milestone gate' },
  // Phase 2 — Abilities
  { name: 'Margin Stitch', path: '/test/margin-stitch', phase: 2, phaseName: 'Abilities', status: 'not-started', description: 'Temporary passage creation between wall pairs' },
  { name: 'Redaction', path: '/test/redaction', phase: 2, phaseName: 'Abilities', status: 'not-started', description: 'Selective obstacle erasure' },
  { name: 'Paste-Over', path: '/test/paste-over', phase: 2, phaseName: 'Abilities', status: 'not-started', description: 'Surface property transfer' },
  { name: 'Index Mark', path: '/test/index-mark', phase: 2, phaseName: 'Abilities', status: 'not-started', description: 'Living map pins across rooms' },
  // Phase 3 — Combat
  { name: 'Combat Melee', path: '/test/combat-melee', phase: 3, phaseName: 'Combat', status: 'not-started', description: 'Quill-spear and ink snap weapons' },
  { name: 'Enemies', path: '/test/enemies', phase: 3, phaseName: 'Combat', status: 'not-started', description: 'Reader, Binder, Proofwarden archetypes' },
  { name: 'Footnote Giant', path: '/test/boss/footnote-giant', phase: 3, phaseName: 'Combat', status: 'not-started', description: 'First boss — prove the boss pattern' },
  // Phase 4 — World Systems
  { name: 'Herbarium Folio', path: '/test/biome/herbarium-folio', phase: 4, phaseName: 'World Systems', status: 'not-started', description: 'First biome — vine grapple movement texture' },
  { name: 'Day/Night Cycle', path: '/test/day-night', phase: 4, phaseName: 'World Systems', status: 'not-started', description: 'Cozy day / chaotic night transitions' },
  { name: 'Ink Cards', path: '/test/ink-cards', phase: 4, phaseName: 'World Systems', status: 'not-started', description: 'Crafting UI and stat modifications' },
  { name: 'Room Editor', path: '/test/room-editor', phase: 4, phaseName: 'World Systems', status: 'not-started', description: 'Layout sandbox and ability gates' },
  // Phase 5 — Remaining Content
  { name: 'Misprint Seraph', path: '/test/boss/misprint-seraph', phase: 5, phaseName: 'Content', status: 'not-started', description: 'Second boss' },
  { name: 'Index Eater', path: '/test/boss/index-eater', phase: 5, phaseName: 'Content', status: 'not-started', description: 'Third boss' },
  { name: 'Astral Atlas', path: '/test/biome/astral-atlas', phase: 5, phaseName: 'Content', status: 'not-started', description: 'Low-gravity movement texture' },
  { name: 'Maritime Ledger', path: '/test/biome/maritime-ledger', phase: 5, phaseName: 'Content', status: 'not-started', description: 'Current streams movement texture' },
  { name: 'Gothic Errata', path: '/test/biome/gothic-errata', phase: 5, phaseName: 'Content', status: 'not-started', description: 'Fear fog / input inversion' },
];
```

**Individual test page stubs**: Each test route gets a minimal page that shows:
- The test name and description
- A "Not Started" badge
- A placeholder area where the canvas will go
- A "Back to Index" link
- All styled with Tailwind, dark theme

Create stubs for these routes:
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
- `src/app/test/biome/herbarium-folio/page.tsx`
- `src/app/test/day-night/page.tsx`
- `src/app/test/ink-cards/page.tsx`
- `src/app/test/room-editor/page.tsx`
- `src/app/test/boss/misprint-seraph/page.tsx`
- `src/app/test/boss/index-eater/page.tsx`
- `src/app/test/biome/astral-atlas/page.tsx`
- `src/app/test/biome/maritime-ledger/page.tsx`
- `src/app/test/biome/gothic-errata/page.tsx`

To avoid writing 22 nearly-identical stub files, create a reusable `TestPageStub` component in `src/components/TestPageStub.tsx` that each page imports. It takes the test name, description, status, and phase as props.

### 7. Create Landing Page

Update `src/app/page.tsx` to show:
- "Inkbinders: The Library That Fights Back"
- A link to `/test` (the test page index)
- Brief one-liner about the game
- Dark theme, clean typography with Tailwind

### 8. Create AGENTS.md and CLAUDE.md

**`AGENTS.md`** (project root): Shared knowledge for all agents working on this project. Include:
- Project overview (one paragraph)
- Tech stack
- Folder structure overview
- Key conventions: test-page-first development, dark theme for all UI, Tailwind for styling
- How to run the dev server
- Where the plan lives (`swarm/PLAN.md`)
- Engine architecture overview (custom engine, no Phaser, Canvas-based)

**`CLAUDE.md`** (project root): Instructions for Claude specifically. Include:
- All the above plus:
- Code style: TypeScript strict mode, functional components, named exports
- Test pages use `'use client'` directive (they need Canvas/DOM access)
- Engine code is pure TypeScript (no React dependencies)
- All tunable values should be defined as constants with clear names, not magic numbers
- Debug overlays render on the canvas, debug panels are React components
- When creating a new test page: import TestPageStub or build on the pattern

### 9. Set Up `.env.local`

Create `.env.local` with placeholder for the Nano Banana API key (check if it already exists first — the user said it's already there):
```
NANOBANANA_API_KEY=your_key_here
```
Only create this if it doesn't already exist. If it does, don't touch it.

### 10. Verify Everything Works

- Run `npm run dev` and confirm:
  - The landing page loads at `http://localhost:3000`
  - The test index loads at `http://localhost:3000/test`
  - At least one test page stub loads (e.g., `/test/ground-movement`)
  - No TypeScript errors
  - No console errors
- Run `npm run build` to verify the project builds cleanly

## Files to Create/Modify

- All files listed in the steps above
- `package.json` (created by create-next-app)
- `tsconfig.json` (created by create-next-app)
- `tailwind.config.ts` (created by create-next-app)
- `AGENTS.md` (new)
- `CLAUDE.md` (new)

## Design Decisions (Pre-settled)

1. **App Router** (not Pages Router) — modern Next.js, matches the plan
2. **`src/` directory** — keeps app code separate from config files
3. **Static test status config** — not Convex-backed yet; a simple TypeScript object is sufficient for now
4. **Dark theme everywhere** — test pages and index use dark backgrounds (easier on eyes during long dev sessions, fits the "library at night" vibe)
5. **Reusable TestPageStub component** — avoids 22 copy-paste files
6. **Engine code is pure TypeScript** — no React dependencies in `src/engine/`; the bridge between engine and React happens in components like `GameCanvas.tsx`
7. **Placeholder engine index files** — just exports, no implementation yet. The next task (Engine Core) will fill these in.

## Verification

- [x] `npm run dev` starts without errors
- [x] Landing page shows at `/`
- [x] Test index shows at `/test` with all 22 test pages listed, grouped by phase
- [x] Each test page stub loads without errors
- [x] `npm run build` succeeds (all 27 routes generated as static pages)
- [x] All engine directories exist with index files
- [x] `AGENTS.md` and `CLAUDE.md` exist and are populated
- [x] `convex/` directory exists with schema stub
- [x] `npx tsc --noEmit` passes with zero errors

## Completion Summary

**Agent:** 403c2a53
**Completed:** 2026-02-23

### What was built

Full project scaffold for Inkbinders — a hand-inked 2D metroidvania using Next.js, TypeScript, Tailwind CSS, Convex.dev, and a custom game engine.

### Files created/modified

**Config & Root:**
- `package.json` — Next.js project with convex dependency
- `tsconfig.json` — TypeScript strict mode, `@/*` path alias
- `eslint.config.mjs` — ESLint with Next.js config
- `postcss.config.mjs` — PostCSS with Tailwind
- `next.config.ts` — Next.js configuration
- `.gitignore` — Standard Next.js ignores
- `.env.local` — Nano Banana API key placeholder
- `AGENTS.md` — Shared agent knowledge base
- `CLAUDE.md` — Claude-specific instructions

**Convex Backend:**
- `convex/schema.ts` — Game state table with key/value/updatedAt
- `convex/tsconfig.json` — Convex TypeScript config

**Engine Structure (9 modules, all with placeholder index.ts):**
- `src/engine/` — core, physics, input, entities, states, abilities, world, combat, ui

**Shared Components:**
- `src/components/debug/DebugPanel.tsx` — Reusable debug sidebar
- `src/components/debug/Slider.tsx` — Tunable parameter slider
- `src/components/canvas/GameCanvas.tsx` — Canvas component that mounts the engine
- `src/components/TestPageStub.tsx` — Reusable test page stub component

**Utilities:**
- `src/lib/constants.ts` — Canvas dimensions, fixed timestep, debug colors
- `src/lib/types.ts` — Vec2, Rect shared types
- `src/lib/testStatus.ts` — 22 test page configs with status tracking

**Pages:**
- `src/app/page.tsx` — Landing page ("The Library That Fights Back")
- `src/app/layout.tsx` — Root layout with dark theme, Geist fonts
- `src/app/test/page.tsx` — Test index hub (grouped by phase, status badges)
- 22 test page stubs under `src/app/test/` (Phase 1-5)

### Verification results
- `npx tsc --noEmit` — zero errors
- `npm run build` — 27 static routes generated successfully
- `npm run dev` — dev server starts on :3000 without errors

---

## Review

**Reviewer:** b57e9267
**Reviewed:** 2026-02-23

### Issues Found & Fixed

1. **GameCanvas callback stability bug** (`src/components/canvas/GameCanvas.tsx`): The `onMount` and `onUnmount` callbacks were listed as useEffect dependencies. If a parent component passes inline functions (which is the common pattern), the effect would re-run every render — tearing down and restarting the game loop. Fixed by storing callbacks in refs and using an empty dependency array so the effect runs once on mount.

2. **Magic numbers in GameCanvas defaults** (`src/components/canvas/GameCanvas.tsx`): Default `width=960` and `height=540` were hardcoded literals instead of using `CANVAS_WIDTH`/`CANVAS_HEIGHT` from `@/lib/constants`. Fixed by importing and using the named constants.

### Notes (no fix needed)

- `STATUS_STYLES` is duplicated in `TestPageStub.tsx` and `test/page.tsx` — acceptable for scaffolding, can be extracted to a shared module later if more statuses are added.
- `convex/schema.ts` uses `v.any()` for the value field — fine as a placeholder, should be tightened when real data shapes are defined.
- Test page stubs don't have `'use client'` — correct for now since they only render server-compatible JSX. The directive will be added when stubs are replaced with real canvas pages.

### Post-review verification
- `npx tsc --noEmit` — zero errors after fixes
