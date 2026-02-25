---
status: in-progress
---
# Epic 001: Comprehensive Test Suite — Headless + Visual

## Tasks

- [x] expand-core-movement-tests — Expand core movement headless tests (Task 1)
- [x] expand-jumping-tests — Expand jumping headless tests (Task 2)
- [x] expand-dash-tests — Expand dash headless tests (Task 3)
- [x] expand-wall-mechanics-tests — Expand wall mechanics headless tests (Task 4)
- [x] state-transitions-tests — State machine transition coverage (Task 5)
- [x] surface-types-tests — Surface types headless tests (Task 6)
- [x] combat-system-tests — Combat system headless tests (Task 7)
- [x] health-system-tests — Health system headless tests (Task 8)
- [x] ability-harness-extensions — Extend harness with ability support (Task 9)
- [x] margin-stitch-tests — Margin Stitch ability tests (Task 10)
- [x] redaction-tests — Redaction ability tests (Task 11)
- [x] paste-over-tests — Paste-Over ability tests (Task 12)
- [x] index-mark-tests — Index Mark ability tests (Task 13)
- [x] visual-test-core-movement — Visual test core movement pages (Task 14)
- [x] visual-test-abilities — Visual test ability pages (Task 15)
- [x] visual-test-combat — Visual test combat pages (Task 16)
- [x] visual-test-biomes — Visual test biome pages (Task 17)
- [x] visual-test-world-systems — Visual test world systems pages (Task 18)
- [ ] visual-test-integration — Visual test integration pages (Task 19)
- [ ] visual-test-runner — Create visual test runner playbook (Task 20)
- [x] room-world-harness-extensions — Extend harness for room/world testing (Task 21)
- [x] room-system-tests — Room system headless tests (Task 22)
- [x] day-night-cycle-tests — Day/night cycle headless tests (Task 23)
- [ ] ink-card-system-tests — Ink card system headless tests (Task 24)
- [x] save-system-tests — Save system headless tests (Task 25)

## Goal

Verify every implemented feature in Inkbinders through two complementary strategies:

1. **Headless tests** (vitest + `GameTestHarness`) — numerical/behavioral verification of physics, state machines, combat, abilities, surfaces, and world systems. Fast, deterministic, CI-friendly.
2. **Visual browser tests** (browser MCP + screenshots) — navigate each `/test/*` page, interact briefly, and take screenshots to confirm rendering, layouts, UI elements, and visual correctness.

Together these form a regression suite that catches both logic bugs and rendering regressions.

---

## Context

### What exists today

Four headless test files in `src/engine/test/__tests__/`:
- `movement.test.ts` — 7 basic tests (grounded, run left/right, decel, max speed, turn, stay grounded)
- `jumping.test.ts` — 7 tests (basic jump, rise/fall, held vs tap, falling transition, coyote, coyote expiry, buffer)
- `dash.test.ts` — 6 tests (direction, left dash, duration, cooldown, cooldown recovery, air dash)
- `wall-mechanics.test.ts` — 4 tests (wall slide entry, slide speed, wall jump launch, lockout)

No visual/browser tests exist yet.

### Test harness capabilities

The `GameTestHarness` (see `design/test.md`) supports:
- Platform/tilemap construction (including surface types)
- Programmatic input (all actions including abilities, weapon switch)
- Frame-by-frame simulation with `tick()`, `tickN()`, `tickUntil()`, `tickWhile()`, `tickSeconds()`
- State inspection (pos, vel, state, grounded, facingRight, speed, snapshot)
- Optional combat system (`enableCombat()`)
- Optional health system (`enableHealth()`)

### Browser testing capabilities

The `cursor-ide-browser` MCP provides:
- `browser_navigate` — open a URL
- `browser_snapshot` — get page structure
- `browser_take_screenshot` — capture visual state
- `browser_press_key` — simulate keyboard input
- `browser_click` — click elements
- `browser_wait_for` — wait for selectors/conditions

The dev server runs at `http://localhost:3000`.

---

## Tasks

### Task 1: Expand Core Movement Headless Tests

**File:** `src/engine/test/__tests__/movement.test.ts`

Extend the existing movement tests with:

- **Acceleration curve**: player reaches 50% max speed faster than linearly (test speed at N frames < 0.5 × N_to_max)
- **Deceleration timing**: after releasing input at max speed, measure frames to reach IDLE — should be short (< 15 frames)
- **Turn-around snap**: running right then pressing left should flip `facingRight` within 2 frames
- **Crouch from idle**: pressing crouch enters CROUCHING state, player hitbox height shrinks
- **Crouch from run**: pressing crouch while running enters CROUCH_SLIDING state
- **Crouch-slide duration**: crouch-slide eventually transitions to CROUCHING as momentum decays
- **Crouch-slide under gap**: player in crouch-slide can pass under a low ceiling that blocks standing height (use `hasHeadroom()`)
- **Cannot stand under low ceiling**: while crouching under a low ceiling, releasing crouch keeps CROUCHING state
- **Max speed not exceeded on flat ground**: running for 300 frames never exceeds `maxRunSpeed`

### Task 2: Expand Jumping Headless Tests

**File:** `src/engine/test/__tests__/jumping.test.ts`

Add:

- **Jump height measurement**: held jump reaches at least 120px above start (or parameterized from `jumpSpeed` and gravity)
- **Tap vs held height ratio**: held jump should be at least 1.3× taller than tap jump
- **Apex float**: at the peak of a full jump, verify velocity magnitude is small for several frames (apex float zone)
- **Air control**: while jumping, holding left/right changes horizontal velocity
- **No double jump**: pressing jump while airborne (past coyote) does nothing
- **Landing state**: after a short fall, player enters IDLE (not HARD_LANDING)
- **Hard landing**: after a long fall (> threshold), player enters HARD_LANDING state
- **Hard landing recovery**: HARD_LANDING transitions to IDLE after recovery frames
- **Jump from moving**: jumping while running preserves horizontal momentum

### Task 3: Expand Dash Headless Tests

**File:** `src/engine/test/__tests__/dash.test.ts`

Add:

- **Dash distance**: ground dash covers at least `dashSpeed × dashDuration / 60` pixels
- **Dash-cancel from running**: pressing dash while running enters DASHING
- **Dash-cancel from jumping**: pressing dash while jumping enters DASHING
- **Dash-cancel from falling**: pressing dash while falling enters DASHING
- **Dash preserves speed into run**: after ground dash ends while holding forward, player speed > normal running speed briefly (dash exit boost)
- **Upward dash**: holding up + dash → positive upward velocity during dash
- **Diagonal dash**: holding right + up + dash → both positive x and negative y velocity
- **Dash resets on landing**: if dash was used in air, landing resets dash availability

### Task 4: Expand Wall Mechanics Headless Tests

**File:** `src/engine/test/__tests__/wall-mechanics.test.ts`

Add:

- **Wall slide on left wall**: mirror of right wall test
- **Wall slide speed cap**: wall slide Y velocity is capped below `maxFallSpeed`
- **Wall jump from left wall**: launches rightward
- **Wall jump height**: wall jump reaches meaningful height (velocity.y < -200 or similar)
- **Wall-to-wall chain**: wall jump from right wall → press left → reach left wall → wall slide (proves chaining works)
- **Cannot wall slide on ground**: pressing into a wall while grounded does NOT enter WALL_SLIDING
- **Wall slide exit on release**: releasing toward-wall input while wall sliding transitions to FALLING

### Task 5: State Transitions Headless Tests

**File:** `src/engine/test/__tests__/transitions.test.ts` (new)

Comprehensive state machine transition coverage:

- **IDLE → RUNNING**: press movement key
- **RUNNING → IDLE**: release movement, wait for decel
- **IDLE → JUMPING**: press jump
- **RUNNING → JUMPING**: press jump while running
- **JUMPING → FALLING**: after apex
- **FALLING → IDLE**: land on platform from short height
- **FALLING → HARD_LANDING**: land from sufficient height
- **HARD_LANDING → IDLE**: wait recovery frames
- **RUNNING → CROUCHING**: press crouch while stopped (or slow)
- **RUNNING → CROUCH_SLIDING**: press crouch at speed
- **CROUCH_SLIDING → CROUCHING**: momentum decays
- **CROUCHING → IDLE**: release crouch with headroom
- **Any grounded → DASHING**: press dash
- **DASHING → IDLE/RUNNING**: dash ends
- **FALLING → WALL_SLIDING**: fall against wall
- **WALL_SLIDING → WALL_JUMPING**: press jump on wall
- **WALL_JUMPING → FALLING**: wall jump arc completes
- **DASHING → JUMPING**: dash then jump (if applicable)
- **No invalid transitions**: HARD_LANDING cannot jump (verify)

### Task 6: Surface Types Headless Tests

**File:** `src/engine/test/__tests__/surfaces.test.ts` (new)

- **Bouncy surface**: landing on bouncy platform makes player bounce (vel.y < 0 after contact)
- **Bouncy suppress with crouch**: holding crouch on bouncy surface suppresses bounce
- **Icy surface acceleration**: on icy surface, acceleration is slower (takes more frames to reach max speed)
- **Icy surface higher max speed**: on icy surface, max achievable speed is higher than normal
- **Icy surface deceleration**: on icy surface, deceleration takes longer (more slide)
- **Sticky surface**: on sticky surface, max speed is lower than normal
- **Sticky surface friction**: on sticky surface, deceleration is faster
- **Conveyor surface**: standing on a conveyor platform pushes player in conveyor direction
- **Normal surface baseline**: normal surface has no special effects (control test)
- **Wall surface types**: icy wall has different slide behavior than normal wall

### Task 7: Combat System Headless Tests

**File:** `src/engine/test/__tests__/combat.test.ts` (new)

- **Attack while idle**: pressing attack starts windup phase
- **Attack phase cycle**: idle → windup → active → recovery → cooldown → idle
- **Attack while running**: can attack without interrupting RUNNING state
- **Attack while jumping**: can attack without interrupting JUMPING state
- **Hitbox appears during active phase**: `combat.activeHitbox` is non-null during active phase
- **Hitbox absent during windup/recovery**: no hitbox outside active phase
- **Hitbox faces right when facing right**: hitbox x > player center x
- **Hitbox faces left when facing left**: hitbox x < player center x
- **Weapon switch**: pressing WeaponSwitch toggles between quill-spear and ink-snap
- **Cooldown prevents rapid attack**: attacking during cooldown does nothing
- **Directional attack aiming**: holding up while attacking shifts hitbox upward

### Task 8: Health System Headless Tests

**File:** `src/engine/test/__tests__/health.test.ts` (new)

- **Initial health**: health starts at maxHealth
- **Take damage**: calling `takeDamage()` reduces health
- **Invincibility after damage**: after taking damage, further damage is ignored for i-frames duration
- **Invincibility expires**: after i-frames pass, player can take damage again
- **Death at zero**: health reaching 0 triggers death state
- **Cannot go negative**: health never drops below 0
- **Health boundary**: taking damage equal to remaining health results in exactly 0

### Task 9: Ability System Harness Extensions

**File:** `src/engine/test/GameTestHarness.ts` (modify)

Extend the harness to optionally wire up abilities for testing:

- Add `enableMarginStitch(params?)` → returns MarginStitch instance, wired to tileMap
- Add `enableRedaction(params?)` → returns Redaction instance
- Add `enablePasteOver(params?)` → returns PasteOver instance
- Add `enableIndexMark(params?)` → returns IndexMark instance
- Each ability gets updated in `tick()` when enabled
- These are optional — existing tests are unaffected

### Task 10: Margin Stitch Headless Tests

**File:** `src/engine/test/__tests__/margin-stitch.test.ts` (new)

Depends on Task 9.

- **Scan finds wall pair**: with two parallel walls, `scanForTargets()` finds a valid stitch target
- **Activate creates passage**: after activation, the wall segment gets an exclusion zone in the tilemap
- **Player can pass through stitched wall**: after stitch, player can move through the previously solid wall
- **Stitch expires**: after duration, the exclusion zone is removed and wall is solid again
- **No target without walls**: in open space, `scanForTargets()` finds nothing
- **Max simultaneous stitches**: cannot exceed max active stitch count

### Task 11: Redaction Headless Tests

**File:** `src/engine/test/__tests__/redaction.test.ts` (new)

Depends on Task 9.

- **Aim targeting finds obstacle**: obstacle within cone is targeted
- **Activate removes obstacle collision**: redacted barrier gets exclusion zone
- **Redacted spikes become inert**: spikes no longer deal damage after redaction
- **Redaction expires**: after duration, obstacle is restored
- **Max redactions**: cannot exceed 2 simultaneous redactions
- **Cooldown between redactions**: brief cooldown after each use
- **Out-of-range obstacle not targeted**: obstacle beyond maxRedactionRange is ignored

### Task 12: Paste-Over Headless Tests

**File:** `src/engine/test/__tests__/paste-over.test.ts` (new)

Depends on Task 9.

- **Auto-copy surface**: walking on a bouncy surface copies "bouncy" to clipboard
- **Paste surface**: pressing Ability3 on a normal platform changes it to clipboard surface
- **Pasted surface expires**: after duration, platform reverts to original surface
- **Max paste-overs**: cannot exceed 3 simultaneous pastes
- **Cooldown**: paste-over has cooldown after expiry
- **No paste without clipboard**: pressing Ability3 with empty clipboard does nothing

### Task 13: Index Mark Headless Tests

**File:** `src/engine/test/__tests__/index-mark.test.ts` (new)

Depends on Task 9.

- **Place mark**: short press of Ability3 places a mark at player position
- **Max 4 marks**: placing a 5th mark replaces the oldest
- **Teleport to mark**: hold Ability3 + release teleports player to selected mark position
- **Teleport zeroes velocity**: after teleport, player velocity is (0, 0)
- **Mark position accuracy**: placed mark position matches player position at time of placement

### Task 14: Visual Test — Core Movement Pages

**Strategy:** Start dev server, navigate to each test page, take a screenshot, verify the page renders (canvas present, debug panel visible, no blank screen).

For each page, the browser test should:
1. Navigate to the test page URL
2. Wait for the page to load (canvas element present)
3. Take a screenshot
4. Optionally press some keys (arrow keys, space) to trigger player movement
5. Wait a moment, take another screenshot
6. Verify the page is not blank (basic sanity)

**Pages:**
- `/test/ground-movement`
- `/test/jumping`
- `/test/wall-mechanics`
- `/test/dash`
- `/test/transitions`
- `/test/movement-playground`

**File:** `src/engine/test/__tests__/visual-core-movement.test.ts` (new) — or as a manual browser-MCP script in `scripts/visual-tests/core-movement.ts`

> **Note on execution model:** Visual tests run via the browser MCP during development/review. They are NOT vitest tests (canvas requires a real browser). Each visual test is a documented procedure: navigate, interact, screenshot, inspect. An agent runs these using `browser_navigate` → `browser_take_screenshot` → visual inspection.

### Task 15: Visual Test — Abilities Pages

**Pages:**
- `/test/margin-stitch`
- `/test/redaction`
- `/test/paste-over`
- `/test/index-mark`

For each:
1. Navigate to page, wait for canvas
2. Screenshot the initial state (should show level layout with ability-specific obstacles/walls)
3. Press movement keys to move player near a target
4. Press the ability key (E, Q, or R depending on page)
5. Screenshot the activated ability state (visual feedback: particles, effects, changed platforms)
6. Verify debug panel is visible with sliders

### Task 16: Visual Test — Combat Pages

**Pages:**
- `/test/combat-melee`
- `/test/enemies`
- `/test/boss/footnote-giant`
- `/test/boss/misprint-seraph`
- `/test/boss/index-eater`

For each:
1. Navigate, wait for canvas
2. Screenshot idle state (player, enemies/boss visible, health bars)
3. Press attack key (J) — screenshot during attack (hitbox overlay visible in debug mode)
4. Press K to switch weapons — screenshot showing weapon indicator change
5. For boss pages: verify boss health bar renders, boss sprite/rect visible

### Task 17: Visual Test — Biome Pages

**Pages:**
- `/test/biome/herbarium-folio`
- `/test/biome/astral-atlas`
- `/test/biome/maritime-ledger`
- `/test/biome/gothic-errata`

For each:
1. Navigate, wait for canvas
2. Screenshot — verify biome-specific background color/theme is applied
3. Move player around briefly (arrow keys)
4. Screenshot — verify biome-specific mechanics are visible:
   - Herbarium: vine anchors, green palette
   - Astral Atlas: gravity wells (pulsing rings), floaty movement
   - Maritime Ledger: current zones (flow arrows), water palette
   - Gothic Errata: fog overlay, purple/dark palette
5. Verify debug panel has biome-specific parameter sliders

### Task 18: Visual Test — World Systems Pages

**Pages:**
- `/test/day-night`
- `/test/ink-cards`
- `/test/room-editor`

For each:
1. Navigate, wait for canvas/UI
2. Screenshot initial state
3. Interact with debug panel controls (e.g., skip to night phase on day-night page)
4. Screenshot changed state (night palette, corruption effects visible)
5. Ink Cards: verify card UI renders (card grid, equipped slots)
6. Room Editor: verify editor toolbar visible, grid renders

### Task 19: Visual Test — Integration Pages

**Pages:**
- `/test/world-assembly`
- `/test/hud`
- `/test/sprites`
- `/test/save-load`
- `/test/herbarium-wing`
- `/` (main menu / title screen)
- `/play` (with `?slot=1&new=1`)

For each:
1. Navigate, wait for content
2. Screenshot initial state
3. Page-specific interactions:
   - World Assembly: move player into an exit, wait for room transition, screenshot new room
   - HUD: verify health bar, ability bar, weapon indicator, clock all render
   - Sprites: toggle rendering mode, screenshot sprite vs rectangle rendering
   - Save/Load: verify save slot UI renders, click a slot
   - Herbarium Wing: navigate through rooms, screenshot vine mechanics
   - Main Menu: verify title, menu options, ink wash background animation
   - Play page: verify game loads, HUD renders, canvas is active

### Task 20: Create Visual Test Runner Script

**File:** `scripts/run-visual-tests.md` (new)

A markdown playbook documenting the full visual test procedure. This is what an agent follows using the browser MCP:

1. Prerequisites: dev server running at localhost:3000
2. For each test page (in order):
   - Navigate to URL
   - Wait 2s for load
   - Take initial screenshot → save to `test-screenshots/{page-name}-initial.png`
   - Perform page-specific interactions (keys, clicks)
   - Wait 1s
   - Take post-interaction screenshot → save to `test-screenshots/{page-name}-active.png`
3. Summary: list of pages tested, any pages that failed to load or rendered blank
4. Screenshots are saved for human review

Include the full page list with URLs, expected key elements (canvas, debug panel, specific UI), and interaction sequences.

### Task 21: Harness Extension — Room & World Testing

**File:** `src/engine/test/GameTestHarness.ts` (modify)

Add support for room/world-level testing:

- `loadRoom(roomData: RoomData)` → rebuilds tilemap from room platforms, sets world bounds
- `enableVineSystem(anchors)` → wires vine system for swing testing
- `enableDayNightCycle(params?)` → creates cycle, updates in tick
- `getWorldState()` → returns current room, time of day, corruption level

### Task 22: Room System Headless Tests

**File:** `src/engine/test/__tests__/rooms.test.ts` (new)

Depends on Task 21.

- **Room loads platforms**: loading a RoomData creates correct tilemap
- **Player spawns at default spawn**: after loading room, player position matches defaultSpawn
- **Exit zone detection**: player standing in an exit zone triggers transition
- **Gate blocks passage**: ability gate platform is solid before opening
- **Gate opens with ability**: calling tryOpenGate with correct ability removes platform
- **Gate stays open**: once opened, gate remains open on room reload

### Task 23: Day/Night Cycle Headless Tests

**File:** `src/engine/test/__tests__/day-night.test.ts` (new)

- **Time advances**: after N seconds, time of day progresses
- **Phase transitions**: cycle goes dawn → day → dusk → night → dawn
- **Corruption at night**: corruption intensity > 0 during night phase
- **No corruption at day**: corruption intensity = 0 during day phase
- **Hub immunity**: when in hub room, corruption is always 0
- **Skip to phase**: `skipTo()` immediately sets time to target phase
- **Cycle speed**: adjusting speed multiplier changes rate of progression

### Task 24: Ink Card System Headless Tests

**File:** `src/engine/test/__tests__/ink-cards.test.ts` (new)

- **Create card**: `createCard(defId, tier)` produces valid InkCard
- **Card tiers**: tier 1, 2, 3 have increasing stat values
- **Equip card**: equipping a card adds it to equipped list
- **Unequip card**: removing equipped card returns it to collection
- **Max 4 equipped**: cannot equip more than 4 cards
- **Craft same tier**: 2 cards of same definition + tier → 1 card of next tier
- **Cannot craft tier 3**: tier 3 cards cannot be crafted further
- **Stat modifiers apply**: equipped cards modify player params correctly
- **Diminishing returns**: 2nd card on same stat applies at 0.7× rate
- **Stat caps respected**: modifiers cannot exceed caps

### Task 25: Save System Headless Tests

**File:** `src/engine/test/__tests__/save-system.test.ts` (new)

- **Create snapshot**: `createSnapshot()` produces valid `GameSaveData`
- **Completion percentage**: abilities (30%) + bosses (40%) + rooms (30%) calculated correctly
- **Empty save summary**: `emptySummary(slot)` has `isEmpty: true`
- **Format play time**: `formatPlayTime(65)` → "1:05", `formatPlayTime(3665)` → "1:01:05"
- **Serialize/deserialize round-trip**: PlayerProgression serialize → deserialize produces equivalent state

---

## Ordering & Dependencies

```
Tasks 1–4 (expand existing headless tests)     — independent, can run in parallel
Task 5 (state transitions)                      — independent
Task 6 (surface types)                          — independent
Tasks 7–8 (combat, health)                      — independent
Task 9 (harness extensions for abilities)       — prerequisite for Tasks 10–13
Tasks 10–13 (ability headless tests)            — depend on Task 9, parallel with each other
Tasks 14–19 (visual browser tests)              — independent of headless tests, depend on dev server
Task 20 (visual test runner doc)                — after Tasks 14–19
Task 21 (harness extension for rooms/world)     — independent
Task 22 (room system tests)                     — depends on Task 21
Tasks 23–25 (day-night, cards, save)            — independent of each other
```

Recommended execution order:
1. **Wave 1** (parallel): Tasks 1, 2, 3, 4, 5, 6 — expand existing + new movement tests
2. **Wave 2** (parallel): Tasks 7, 8, 9 — combat, health, harness extensions
3. **Wave 3** (parallel): Tasks 10, 11, 12, 13 — ability tests (need Task 9)
4. **Wave 4** (parallel): Tasks 21, 23, 24, 25 — world harness + standalone system tests
5. **Wave 5**: Task 22 — room tests (need Task 21)
6. **Wave 6** (parallel): Tasks 14, 15, 16, 17, 18, 19 — all visual browser tests
7. **Wave 7**: Task 20 — visual test runner playbook

---

## Success Criteria

- [ ] All headless tests pass: `npm run test:run` exits 0
- [ ] Every test page loads in the browser without blank canvas or JS errors
- [ ] Screenshots captured for all 27+ test pages show expected content
- [ ] Coverage: every player state (10 states) has at least one test entering and exiting it
- [ ] Coverage: every surface type (5 types) has at least one behavioral test
- [ ] Coverage: every ability (4 abilities) has activation and expiration tests
- [ ] Coverage: combat attack phases cycle correctly for both weapons
- [ ] Coverage: health, damage, invincibility, and death tested
- [ ] Coverage: room loading, exit detection, gate mechanics tested
- [ ] Coverage: day/night phase progression and corruption tested
- [ ] Coverage: ink card creation, crafting, and stat modification tested
- [ ] Coverage: save system snapshot and serialization tested
- [ ] No regressions: existing 24 tests still pass after all additions

---

## Estimated Scope

- ~20 new headless test files, ~150–200 individual test cases
- ~6 visual test sessions covering 27+ pages with ~50+ screenshots
- 1 harness extension PR (Tasks 9, 21)
- 1 visual test playbook document

---

## Notes

- Headless tests should use `DEFAULT_PLAYER_PARAMS` (and other `DEFAULT_*_PARAMS`) for thresholds rather than hardcoded magic numbers, so tests stay correct when tuning values change.
- Visual tests are inherently less deterministic — they confirm "something renders" rather than pixel-perfect output. The screenshots are for human/agent review, not automated pixel diff.
- The headless harness does NOT test rendering. If a feature's correctness is purely visual (parallax backgrounds, particle colors, biome palettes), it belongs in the visual test suite only.
- Some systems (VineSystem, GravityWellSystem, CurrentSystem, FogSystem) may need harness extensions beyond Task 21 to be fully testable headlessly. Scope those as follow-up if the harness changes are large.
