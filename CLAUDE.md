# Inkbinders — Claude Instructions

## Everything in AGENTS.md, plus:

Read `AGENTS.md` first for project overview, tech stack, and folder structure.

## Code Style

- **TypeScript strict mode** — no `any` types unless absolutely necessary
- **Functional React components** with named exports
- **Named exports** everywhere (no default exports except Next.js pages which require them)
- All tunable values should be defined as constants with clear names, not magic numbers
- Use `@/*` import alias (maps to `src/*`)

## Test Pages

- Test pages use the `'use client'` directive (they need Canvas/DOM access)
- Each test page imports `TestPageStub` from `@/components/TestPageStub` or builds on its pattern
- When a test page becomes active, replace the stub with a real canvas + debug panel layout
- Debug overlays render on the canvas; debug panels are React components alongside the canvas
- The `DebugPanel` component (`@/components/debug`) provides the sidebar layout
- The `Slider` component provides tunable parameter controls
- The `GameCanvas` component (`@/components/canvas`) provides the canvas element

## Engine Code

- Engine code is **pure TypeScript** — no React dependencies in `src/engine/`
- The bridge between engine and React happens in components like `GameCanvas.tsx`
- Fixed-timestep game loop at 60 Hz (see `FIXED_TIMESTEP` in `src/lib/constants.ts`)
- Canvas dimensions: 960x540 (see `CANVAS_WIDTH`, `CANVAS_HEIGHT`)

## When Creating a New Feature

1. Create or update the test page under `src/app/test/[feature]/page.tsx`
2. Implement engine code in the appropriate `src/engine/[module]/` directory
3. Wire the engine to the canvas via `GameCanvas` component
4. Add debug sliders for all tunable parameters
5. Add debug overlays (hitboxes, velocity vectors, state labels) to the canvas
6. Update the test status in `src/lib/testStatus.ts`

## Convex

- Backend schema is in `convex/schema.ts`
- This is a fresh Convex project — no existing deployment
- Don't use Convex for test page state yet; keep it simple with local React state

## Asset Generation

- Use Nano Banana API when assets are needed
- API key is in `.env.local` as `NANOBANANA_API_KEY`
