# Visual Test Runner — Master Playbook

This is the single entry point for running the full Inkbinders visual regression suite. Follow this document step-by-step to test all 29 pages (27 test pages + main menu + play page).

---

## Prerequisites

Before starting the visual test suite:

1. **Dev server running:**
   ```bash
   npm run dev
   ```
   Serves at `http://localhost:4000`. First page load compiles on-demand — allow up to 10s for initial compile.

2. **Browser MCP tools available** (for automated testing):
   - `browser_navigate`
   - `browser_take_screenshot`
   - `browser_press_key`
   - `browser_click`
   - `browser_wait_for`
   - `browser_snapshot`

3. **Screenshots directory:**
   ```bash
   mkdir -p test-screenshots
   ```

4. **Verify test index page:**
   Navigate to `http://localhost:4000/test` and confirm all test pages are listed.

5. **TypeScript check:**
   ```bash
   npx tsc --noEmit
   ```
   Must pass with 0 errors before running visual tests.

---

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
| Weapon Switch | K | — |
| Ability 1 (Stitch) | E | — |
| Ability 2 (Redaction) | Q | — |
| Ability 3 (Paste/Mark) | R | — |
| Pause | Escape | — |

---

## Execution Order

Run the visual test suites in this order (matches the build dependency order — earlier categories must work for later ones to function):

### 1. Core Movement (6 pages)

**Playbook:** `scripts/visual-tests/core-movement.md`

| # | Page | URL |
|---|------|-----|
| 1 | Ground Movement | `/test/ground-movement` |
| 2 | Jumping | `/test/jumping` |
| 3 | Wall Mechanics | `/test/wall-mechanics` |
| 4 | Dash | `/test/dash` |
| 5 | Transitions | `/test/transitions` |
| 6 | Movement Playground | `/test/movement-playground` |

### 2. Abilities (4 pages)

**Playbook:** `scripts/visual-tests/abilities.md`

| # | Page | URL |
|---|------|-----|
| 7 | Margin Stitch | `/test/margin-stitch` |
| 8 | Redaction | `/test/redaction` |
| 9 | Paste Over | `/test/paste-over` |
| 10 | Index Mark | `/test/index-mark` |

### 3. Combat (5 pages)

**Playbook:** `scripts/visual-tests/combat.md`

| # | Page | URL |
|---|------|-----|
| 11 | Combat Melee | `/test/combat-melee` |
| 12 | Enemies | `/test/enemies` |
| 13 | Footnote Giant (Boss) | `/test/boss/footnote-giant` |
| 14 | Misprint Seraph (Boss) | `/test/boss/misprint-seraph` |
| 15 | Index Eater (Boss) | `/test/boss/index-eater` |

### 4. Biomes (4 pages)

**Playbook:** `scripts/visual-tests/biomes.md`

| # | Page | URL |
|---|------|-----|
| 16 | Herbarium Folio | `/test/biome/herbarium-folio` |
| 17 | Astral Atlas | `/test/biome/astral-atlas` |
| 18 | Maritime Ledger | `/test/biome/maritime-ledger` |
| 19 | Gothic Errata | `/test/biome/gothic-errata` |

### 5. World Systems (3 pages)

**Playbook:** `scripts/visual-tests/world-systems.md`

| # | Page | URL |
|---|------|-----|
| 20 | Day/Night Cycle | `/test/day-night` |
| 21 | Ink Cards | `/test/ink-cards` |
| 22 | Room Editor | `/test/room-editor` |

### 6. Integration (7 pages)

**Playbook:** `scripts/visual-tests/integration.md`

| # | Page | URL |
|---|------|-----|
| 23 | World Assembly | `/test/world-assembly` |
| 24 | HUD | `/test/hud` |
| 25 | Sprites | `/test/sprites` |
| 26 | Save/Load | `/test/save-load` |
| 27 | Herbarium Wing | `/test/herbarium-wing` |
| 28 | Main Menu | `/` |
| 29 | Play Page | `/play?slot=1&new=1` |

---

## Quick Smoke Test

For fast regression checking (~2 minutes), test one representative page from each category:

| # | Page | Category | URL |
|---|------|----------|-----|
| 1 | Ground Movement | Core Movement | `/test/ground-movement` |
| 2 | Margin Stitch | Abilities | `/test/margin-stitch` |
| 3 | Combat Melee | Combat | `/test/combat-melee` |
| 4 | Herbarium Folio | Biomes | `/test/biome/herbarium-folio` |
| 5 | World Assembly | Integration | `/test/world-assembly` |

**Quick smoke test procedure for each page:**

1. `browser_navigate` → page URL
2. `browser_wait_for` → canvas element (timeout 5s)
3. `browser_take_screenshot` → `test-screenshots/smoke-{page-name}-initial.png`
4. `browser_press_key` → ArrowRight (hold ~1s or press 60 times rapidly)
5. `browser_press_key` → Space (jump)
6. Wait 500ms
7. `browser_take_screenshot` → `test-screenshots/smoke-{page-name}-active.png`

---

## Per-Page Test Procedure (Generic Template)

### Canvas-based test pages (most pages)

```
1. browser_navigate → page URL
2. browser_wait_for → canvas element (timeout 5s)
3. browser_take_screenshot → test-screenshots/{category}-{page-name}-initial.png
4. Verify present:
   - <canvas> element (960x540)
   - Debug panel sidebar with sliders
   - Page header with navigation link to /test
5. browser_press_key → ArrowRight (hold ~1s, or press 60 times rapidly)
6. browser_press_key → Space (jump)
7. Wait 500ms
8. browser_take_screenshot → test-screenshots/{category}-{page-name}-active.png
9. Page-specific interactions (see category playbook)
10. browser_take_screenshot → test-screenshots/{category}-{page-name}-final.png
```

### Non-canvas pages (save-load, main menu)

```
1. browser_navigate → page URL
2. browser_wait_for → expected element (timeout 5s)
3. browser_take_screenshot → test-screenshots/{page-name}-initial.png
4. browser_snapshot → verify expected DOM structure
5. Page-specific interactions (click buttons, enter text)
6. browser_take_screenshot → test-screenshots/{page-name}-active.png
```

---

## Structural Verification Script

Quick automated check that all pages load and compile:

```bash
#!/bin/bash
# Structural Verification — All 29 Pages

DEV_SERVER="http://localhost:4000"
PASS=0
FAIL=0
TOTAL=0

check() {
  local url="$1"
  local name="$2"
  TOTAL=$((TOTAL + 1))

  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  if [ "$http_code" = "200" ]; then
    echo "  OK  $name"
    PASS=$((PASS + 1))
  else
    echo "  FAIL $name (HTTP $http_code)"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Core Movement ==="
check "$DEV_SERVER/test/ground-movement" "ground-movement"
check "$DEV_SERVER/test/jumping" "jumping"
check "$DEV_SERVER/test/wall-mechanics" "wall-mechanics"
check "$DEV_SERVER/test/dash" "dash"
check "$DEV_SERVER/test/transitions" "transitions"
check "$DEV_SERVER/test/movement-playground" "movement-playground"

echo "=== Abilities ==="
check "$DEV_SERVER/test/margin-stitch" "margin-stitch"
check "$DEV_SERVER/test/redaction" "redaction"
check "$DEV_SERVER/test/paste-over" "paste-over"
check "$DEV_SERVER/test/index-mark" "index-mark"

echo "=== Combat ==="
check "$DEV_SERVER/test/combat-melee" "combat-melee"
check "$DEV_SERVER/test/enemies" "enemies"
check "$DEV_SERVER/test/boss/footnote-giant" "footnote-giant"
check "$DEV_SERVER/test/boss/misprint-seraph" "misprint-seraph"
check "$DEV_SERVER/test/boss/index-eater" "index-eater"

echo "=== Biomes ==="
check "$DEV_SERVER/test/biome/herbarium-folio" "herbarium-folio"
check "$DEV_SERVER/test/biome/astral-atlas" "astral-atlas"
check "$DEV_SERVER/test/biome/maritime-ledger" "maritime-ledger"
check "$DEV_SERVER/test/biome/gothic-errata" "gothic-errata"

echo "=== World Systems ==="
check "$DEV_SERVER/test/day-night" "day-night"
check "$DEV_SERVER/test/ink-cards" "ink-cards"
check "$DEV_SERVER/test/room-editor" "room-editor"

echo "=== Integration ==="
check "$DEV_SERVER/test/world-assembly" "world-assembly"
check "$DEV_SERVER/test/hud" "hud"
check "$DEV_SERVER/test/sprites" "sprites"
check "$DEV_SERVER/test/save-load" "save-load"
check "$DEV_SERVER/test/herbarium-wing" "herbarium-wing"
check "$DEV_SERVER/" "main-menu"
check "$DEV_SERVER/play?slot=1&new=1" "play-page"

echo ""
echo "=== TypeScript ==="
npx tsc --noEmit 2>&1 | tail -5

echo ""
echo "=== Summary ==="
echo "Passed: $PASS / $TOTAL"
echo "Failed: $FAIL / $TOTAL"
```

---

## Results Summary Template

Copy and fill in after running the full suite:

```markdown
# Visual Test Results — [DATE]

## Environment
- Server: localhost:4000
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
| ground-movement | | | | |
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

---

## Troubleshooting

Common issues and fixes:

- **Blank canvas**: Check browser console for JS errors. May need to click the canvas first to give it focus for input.
- **No debug panel**: Page might be a stub — check if `TestPageStub` is still being used instead of a real implementation.
- **Input not working**: Canvas must have focus. Click on the canvas before pressing keys.
- **Page not found (404)**: Check that the route exists in `src/app/test/` and the dev server has recompiled.
- **Slow load**: First page load after `npm run dev` compiles on-demand. Wait up to 10s for initial compile.
- **Play page redirect**: `/play` requires `?slot=1&new=1` query params or it redirects to `/` (client-side redirect).
- **Save/Load no canvas**: This is expected — save-load is a pure React UI page, not a canvas game page.
- **Main menu canvas missing in curl**: The ink wash background canvas renders client-side via `useEffect`. The structural check via `curl` won't see it — this is expected.
- **TypeScript errors**: Run `npx tsc --noEmit` before visual testing. Fix all type errors first.
