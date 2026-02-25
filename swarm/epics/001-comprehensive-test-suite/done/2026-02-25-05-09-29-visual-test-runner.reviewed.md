# Task: Create Visual Test Runner Playbook

## Summary

Create a master visual test runner document (`scripts/run-visual-tests.md`) that consolidates all visual test procedures into a single, ordered playbook. This is the definitive guide an agent or developer follows to run the full visual regression suite using browser MCP tools.

## What to Build

### 1. Master Runner Playbook

**File:** `scripts/run-visual-tests.md` (new)

Create a comprehensive markdown document that serves as the single entry point for running all visual tests. It should:

1. **Reference the existing per-category playbooks** in `scripts/visual-tests/` rather than duplicating their content
2. **Define the full test execution order** across all categories
3. **Include a pre-flight checklist** (dev server, browser, screenshots directory)
4. **Provide a summary template** for recording results
5. **Cover the integration pages** (world-assembly, hud, sprites, save-load, herbarium-wing, main menu, play page) — either inline or by referencing the integration playbook once it's created

### 2. Document Structure

The playbook should have these sections:

#### Prerequisites
- Dev server running at `http://localhost:3000` (`npm run dev`)
- Browser MCP tools available (`browser_navigate`, `browser_take_screenshot`, `browser_press_key`, `browser_click`, `browser_wait_for`, `browser_snapshot`)
- Create `test-screenshots/` directory for output: `mkdir -p test-screenshots`
- Verify test index page loads: navigate to `http://localhost:3000/test` and confirm all test pages are listed

#### Key Bindings Reference
Include the full key binding table (same as in the individual playbooks):

| Action | Primary Key | Alternate |
|--------|-------------|-----------|
| Move Left | ArrowLeft | A |
| Move Right | ArrowRight | D |
| Move Up | ArrowUp | W |
| Move Down / Crouch | ArrowDown | S |
| Jump | Space | Z |
| Dash | Shift | X |
| Attack | J | Enter |
| Weapon Switch | K | - |
| Ability 1 (Stitch) | E | - |
| Ability 2 (Redaction) | Q | - |
| Ability 3 (Paste/Mark) | R | - |
| Pause | Escape | - |

#### Execution Order

Run the visual test suites in this order (matches the build dependency order):

1. **Core Movement** (6 pages) — `scripts/visual-tests/core-movement.md`
   - `/test/ground-movement`
   - `/test/jumping`
   - `/test/wall-mechanics`
   - `/test/dash`
   - `/test/transitions`
   - `/test/movement-playground`

2. **Abilities** (4 pages) — `scripts/visual-tests/abilities.md`
   - `/test/margin-stitch`
   - `/test/redaction`
   - `/test/paste-over`
   - `/test/index-mark`

3. **Combat** (5 pages) — `scripts/visual-tests/combat.md`
   - `/test/combat-melee`
   - `/test/enemies`
   - `/test/boss/footnote-giant`
   - `/test/boss/misprint-seraph`
   - `/test/boss/index-eater`

4. **Biomes** (4 pages) — `scripts/visual-tests/biomes.md`
   - `/test/biome/herbarium-folio`
   - `/test/biome/astral-atlas`
   - `/test/biome/maritime-ledger`
   - `/test/biome/gothic-errata`

5. **World Systems** (3 pages) — `scripts/visual-tests/world-systems.md`
   - `/test/day-night`
   - `/test/ink-cards`
   - `/test/room-editor`

6. **Integration** (7 pages) — `scripts/visual-tests/integration.md` (if created by visual-test-integration task) or inline procedures
   - `/test/world-assembly`
   - `/test/hud`
   - `/test/sprites`
   - `/test/save-load`
   - `/test/herbarium-wing`
   - `/` (main menu / title screen)
   - `/play?slot=1&new=1` (play page)

#### Quick Smoke Test

Include a "quick smoke test" section that tests only 5 representative pages (one from each category) for fast regression checking:
1. `/test/ground-movement` (core movement)
2. `/test/margin-stitch` (abilities)
3. `/test/combat-melee` (combat)
4. `/test/biome/herbarium-folio` (biomes)
5. `/test/world-assembly` (integration)

For each: navigate, wait 2s, screenshot, press ArrowRight 1s + Space, screenshot. Total time: ~2 minutes.

#### Per-Page Test Procedure (Generic Template)

Document the generic procedure that applies to all canvas-based test pages:

```
1. browser_navigate → page URL
2. browser_wait_for → canvas element (timeout 5s)
3. browser_take_screenshot → test-screenshots/{category}-{page-name}-initial.png
4. Verify present:
   - <canvas> element (960×540 or similar)
   - Debug panel sidebar with sliders
   - Page header with navigation link to /test
   - Pass criteria section
5. browser_press_key → ArrowRight (hold ~1s, or press 60 times rapidly)
6. browser_press_key → Space (jump)
7. Wait 500ms
8. browser_take_screenshot → test-screenshots/{category}-{page-name}-active.png
9. Page-specific interactions (see category playbook)
10. browser_take_screenshot → test-screenshots/{category}-{page-name}-final.png
```

For non-canvas pages (save-load, main menu):
```
1. browser_navigate → page URL
2. browser_wait_for → expected element (timeout 5s)
3. browser_take_screenshot → test-screenshots/{page-name}-initial.png
4. browser_snapshot → verify expected DOM structure
5. Page-specific interactions (click buttons, enter text)
6. browser_take_screenshot → test-screenshots/{page-name}-active.png
```

#### Results Summary Template

Include a results template the tester fills in:

```markdown
# Visual Test Results — [DATE]

## Environment
- Server: localhost:3000
- Browser: [Chrome/Firefox/etc]
- Node: [version]
- Commit: [git hash]

## Summary
- Total pages tested: __/29
- Pages loading successfully: __/29
- Pages with canvas rendering: __/27
- Pages with debug panel visible: __/27
- Issues found: __

## Results by Category

### Core Movement (6 pages)
| Page | Loads | Canvas | Debug Panel | Issues |
|------|-------|--------|-------------|--------|
| ground-movement | ✅/❌ | ✅/❌ | ✅/❌ | |
| jumping | | | | |
| wall-mechanics | | | | |
| dash | | | | |
| transitions | | | | |
| movement-playground | | | | |

### Abilities (4 pages)
| Page | Loads | Canvas | Debug Panel | Ability VFX | Issues |
|------|-------|--------|-------------|-------------|--------|
| margin-stitch | | | | | |
| redaction | | | | | |
| paste-over | | | | | |
| index-mark | | | | | |

### Combat (5 pages)
| Page | Loads | Canvas | Debug Panel | Enemies/Boss | Issues |
|------|-------|--------|-------------|--------------|--------|
| combat-melee | | | | | |
| enemies | | | | | |
| boss/footnote-giant | | | | | |
| boss/misprint-seraph | | | | | |
| boss/index-eater | | | | | |

### Biomes (4 pages)
| Page | Loads | Canvas | Debug Panel | Theme Applied | Issues |
|------|-------|--------|-------------|---------------|--------|
| biome/herbarium-folio | | | | | |
| biome/astral-atlas | | | | | |
| biome/maritime-ledger | | | | | |
| biome/gothic-errata | | | | | |

### World Systems (3 pages)
| Page | Loads | Canvas/UI | Debug Panel | Issues |
|------|-------|-----------|-------------|--------|
| day-night | | | | |
| ink-cards | | | | |
| room-editor | | | | |

### Integration (7 pages)
| Page | Loads | Canvas/UI | Key Feature | Issues |
|------|-------|-----------|-------------|--------|
| world-assembly | | | Room transitions | |
| hud | | | HUD elements | |
| sprites | | | Render mode toggle | |
| save-load | | | Save slot UI | |
| herbarium-wing | | | Vine mechanics | |
| / (main menu) | | | Menu navigation | |
| /play | | | Game session | |

## Screenshots
All screenshots saved to `test-screenshots/` with naming convention:
`{category}-{page-name}-{state}.png`

## Issues Log
| # | Page | Description | Severity |
|---|------|-------------|----------|
| 1 | | | |
```

#### Troubleshooting

Common issues and fixes:
- **Blank canvas**: Check browser console for JS errors. May need to click the canvas first to give it focus for input.
- **No debug panel**: Page might be a stub — check if `TestPageStub` is still being used instead of a real implementation.
- **Input not working**: Canvas must have focus. Click on the canvas before pressing keys.
- **Page not found (404)**: Check that the route exists in `src/app/test/` and the dev server has recompiled.
- **Slow load**: First page load after `npm run dev` compiles on-demand. Wait up to 10s for initial compile.
- **Play page redirect**: `/play` requires `?slot=1&new=1` query params or it redirects to `/`.

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `scripts/run-visual-tests.md` | Create | Master visual test runner playbook |

## Verification / Pass Criteria

- [ ] `scripts/run-visual-tests.md` exists and is a well-structured markdown document
- [ ] The playbook references all 5 existing category playbooks in `scripts/visual-tests/`
- [ ] All 29 pages (27 test pages + main menu + play page) are listed with URLs
- [ ] The execution order matches the build dependency order (core → abilities → combat → biomes → world systems → integration)
- [ ] A quick smoke test section exists for fast regression checking (5 pages, ~2 minutes)
- [ ] A generic per-page test procedure template is included
- [ ] A results summary template with tables for all categories is included
- [ ] A troubleshooting section covers common issues
- [ ] Key bindings reference table is included
- [ ] The document can be followed step-by-step by an agent with browser MCP access

## Notes

- This task depends on the visual test category playbooks (Tasks 14-18) being written. If `scripts/visual-tests/integration.md` doesn't exist yet (Task 19), the runner should include inline integration test procedures or note it as "pending — follow inline procedures below."
- The playbook is a living document — as new test pages are added, they should be added here.
- The screenshot naming convention (`{category}-{page-name}-{state}.png`) enables automated comparison across runs.
- Total estimated runtime for the full suite: ~30-45 minutes with an agent, ~15-20 minutes for a human tester.

---

## Completion Summary

### What Was Built

Created `scripts/run-visual-tests.md` — the master visual test runner playbook that consolidates all visual test procedures into a single, ordered document.

The playbook includes:
- **Prerequisites** checklist (dev server, browser MCP, screenshots dir, TypeScript check)
- **Key Bindings Reference** table
- **Execution Order** for all 6 categories (29 pages total), referencing per-category playbooks
- **Quick Smoke Test** section (5 representative pages, ~2 minute runtime)
- **Generic Per-Page Test Procedure** templates (canvas-based and non-canvas variants)
- **Structural Verification Script** (bash, checks all 29 pages for HTTP 200)
- **Results Summary Template** with tables for all 6 categories
- **Troubleshooting** section with 9 common issues and fixes

All 6 category playbooks are referenced:
1. `scripts/visual-tests/core-movement.md` (6 pages)
2. `scripts/visual-tests/abilities.md` (4 pages)
3. `scripts/visual-tests/combat.md` (5 pages)
4. `scripts/visual-tests/biomes.md` (4 pages)
5. `scripts/visual-tests/world-systems.md` (3 pages)
6. `scripts/visual-tests/integration.md` (7 pages)

### Files Changed

| File | Action |
|------|--------|
| `scripts/run-visual-tests.md` | Created — master visual test runner playbook |

---

## Review Notes (c05388b8)

**Reviewed:** 2026-02-25

**Verdict:** Clean — no issues found.

- The master playbook (`scripts/run-visual-tests.md`) was created and consolidates all visual test procedures.
- Correctly references all 6 category playbooks in `scripts/visual-tests/` — all confirmed to exist on disk.
- All 29 pages listed with correct URLs in dependency order (core → abilities → combat → biomes → world systems → integration).
- Port numbers consistently use `localhost:4000` per CLAUDE.md.
- Quick smoke test section covers 5 representative pages.
- Structural verification script covers all 29 pages.
- Results template is comprehensive with per-category tables.
- Troubleshooting section covers 9 common issues.
- No engine code or React components were modified — purely documentation.
- No fixes needed.
