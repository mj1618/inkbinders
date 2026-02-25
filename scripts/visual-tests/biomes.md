# Visual Test Playbook: Biome Pages

## Prerequisites

- Dev server running: `cd /Users/matt/code/inkbinders && npm run dev`
- Browser open to `http://localhost:3000`
- All 4 biome test pages accessible from `/test` hub

## Key Bindings (All Pages)

| Key | Action |
|-----|--------|
| Arrow Left / A | Move Left |
| Arrow Right / D | Move Right |
| Arrow Up / W | Up / Aim Up / Shorten Vine Rope |
| Arrow Down / S | Down / Aim Down / Lengthen Vine Rope |
| Z / Space | Jump (also detaches from vine) |
| X / Shift | Dash |
| E | Ability1 (Vine attach in Herbarium) |
| J / Enter | Attack |
| K | Weapon Switch |

---

## Test 1: Herbarium Folio (`/test/biome/herbarium-folio`)

**Unique mechanic:** Vine swinging — pendulum physics, momentum transfer, rope length adjustment
**Level:** 3840x1080, Spawn: (100, 740)
**Vine anchors:** 10 ceiling-mounted anchors with rope lengths 140-180px
**Goal zones:** 2 (Goal A: ground platform at far right, Goal B: elevated platform reachable via vines)

### Page Load Verification

1. Navigate to `http://localhost:3000/test/biome/herbarium-folio`
2. Wait 2 seconds for canvas initialization
3. Verify these elements are present:
   - [ ] `<canvas>` element (960x540 viewport into 3840x1080 level)
   - [ ] Player rectangle visible (left side, on starting platform)
   - [ ] Platforms rendered in Herbarium green/parchment theme
   - [ ] Vine anchors visible as ceiling-mounted indicators
   - [ ] Parallax background with leaf/vine motif (3 layers)
   - [ ] Ambient green/parchment particles drifting
   - [ ] FPS counter and diagnostics on canvas
   - [ ] Debug panel sidebar with:
     - Biome Info section (vine status)
     - Vine Physics sliders (10): Attach Range, Swing Gravity, Angular Damping, Release Boost, Rope Adjust Speed, Min/Max Rope Length, Momentum Transfer, Max Angular Vel, Pump Force
     - Vine Toggles (3): Jump Detaches, Adjust Length, Pump Swing
     - Visual Settings (5): Ambient Particles, Parallax Background, Biome Colors, Vine Ranges, Swing Arc
     - Player Movement sliders (4): Max Run Speed, Acceleration, Jump Speed, Dash Speed
     - Controls: Reset Player, Reset All Vines, Reset Goals, Teleport to Goal A/B, Debug Overlays
   - [ ] Pass criteria section (18 items)
   - [ ] Navigation link back to `/test`

### Interaction Test

1. **Move right on biome platforms:**
   - Press and hold Right Arrow for ~1 second
   - Verify: Player runs on green-themed platforms, parallax background scrolls at 3 different rates
   - Verify: Ambient leaf-like particles drift in the background
   - Screenshot: Player running, green theme visible, parallax scrolling

2. **Attach to vine:**
   - Run near a vine anchor (ceiling-mounted point), press E
   - Verify:
     - [ ] Player attaches to nearest anchor within range
     - [ ] Rope line renders from anchor to player position
     - [ ] Player begins swinging in pendulum arc
     - [ ] Player's horizontal velocity converts to angular velocity
   - Screenshot: Player attached to vine, rope visible

3. **Pump swing amplitude:**
   - While swinging, press Left/Right in sync with swing direction
   - Verify: Swing amplitude increases (pumping works)
   - Screenshot: Wide swing arc visible

4. **Adjust rope length:**
   - Press Up to shorten rope (faster swing), Down to lengthen (wider arc)
   - Verify: Rope length changes visually, swing speed adjusts
   - Screenshot: Shortened rope with faster pendulum

5. **Detach with momentum:**
   - At peak swing velocity, press Space or E to detach
   - Verify:
     - [ ] Player launches with release boost velocity
     - [ ] Momentum carries player in swing direction
     - [ ] Player transitions to JUMPING/FALLING state
   - Screenshot: Player launched from vine, mid-air trajectory

6. **Vine-to-vine chaining:**
   - Release from one vine, press E near another while mid-air
   - Verify: Player catches second vine seamlessly
   - Screenshot: Player mid-chain between vines

7. **Platform collision during swing:**
   - Swing into a platform while attached
   - Verify: Auto-detaches on collision
   - Screenshot: Auto-detach moment

### Expected Canvas Rendering

- Player: colored rectangle with cyan hitbox outline
- Vine rope: line from ceiling anchor to player
- Vine anchors: ceiling-mounted indicators with range circles (toggleable)
- Swing arc: visualization of pendulum path (toggleable)
- Platforms: green-tinted with vine tendril decoration on edges
- Parallax background: 3 layers (leaf silhouettes, stems, vine tendrils) at 0.1/0.3/0.6 scroll rates
- Ambient particles: green/parchment colored drifters
- Diagnostics: bottom-left box with vine state, position, velocity, rope info
- Goal zones: semi-transparent colored rectangles with labels

### Pass Criteria Checklist

- [ ] Normal movement on biome platforms
- [ ] Vine anchors visible
- [ ] E attaches to vine
- [ ] Pendulum physics smooth
- [ ] Momentum transfer on attach
- [ ] L/R pumps swing
- [ ] U/D adjusts rope
- [ ] Jump detaches with momentum
- [ ] Release boost
- [ ] Vine-to-vine chaining
- [ ] Rope renders
- [ ] Parallax background
- [ ] Ambient particles
- [ ] Biome-themed colors
- [ ] Goal A (ground) reachable
- [ ] Goal B (elevated via vines) reachable
- [ ] Sliders tune all params
- [ ] Camera follows through level

---

## Test 2: Astral Atlas (`/test/biome/astral-atlas`)

**Unique mechanic:** Gravity wells — attract/repel force zones with biome-wide low-gravity (0.4x base gravity)
**Level:** 3200x1200, Spawn: (100, 950)
**Gravity wells:** 8 total (4 attract, 3 repel, 1 safety repel)
**Goal zones:** 2 (Goal A: far right ground, Goal B: far right elevated)

### Page Load Verification

1. Navigate to `http://localhost:3000/test/biome/astral-atlas`
2. Wait 2 seconds for canvas initialization
3. Verify these elements are present:
   - [ ] `<canvas>` element (960x540 viewport into 3200x1200 level)
   - [ ] Player rectangle visible (left side, on ground platform)
   - [ ] Platforms rendered in deep purple/silver Astral Atlas theme
   - [ ] Gravity wells visible as pulsing concentric ring circles:
     - Attract wells: indigo (#818cf8)
     - Repel wells: pink (#f472b6)
   - [ ] Low-gravity feel on first jump (noticeably floaty)
   - [ ] Parallax background with star/constellation motif
   - [ ] Ambient purple/silver particles
   - [ ] Force vector arrow showing net gravity well force on player
   - [ ] Debug panel sidebar with:
     - Biome Info (gravity multiplier display)
     - Gravity Wells (5): Global Gravity Mul, Falloff, Max Well Force, Pulse Speed, Affects Dash toggle
     - Player Movement (7): Max Run Speed, Jump Speed, Rise/Fall/Max Fall Gravity (base values), Dash Speed, Air Acceleration
     - Visual Settings (4): Ambient Particles, Parallax Background, Biome Colors, Well Debug
     - Controls: Reset Player, Reset Goals, Teleport to Goal A/B, Debug Overlays
   - [ ] Pass criteria section (10 items)
   - [ ] Navigation link back to `/test`

### Interaction Test

1. **Test low-gravity jump:**
   - Press Space to jump
   - Verify: Jump arc is ~2.5x normal height (0.4x gravity multiplier)
   - Verify: Longer hang time, floatier descent
   - Screenshot: Player at peak of floaty jump arc

2. **Move through star-field:**
   - Press Right Arrow, run through the level
   - Verify: Parallax star-field background scrolls at different rates
   - Verify: Purple/silver themed platforms
   - Screenshot: Player running, star-field parallax visible

3. **Approach attract well:**
   - Move near an attract well (indigo pulsing rings)
   - Verify:
     - [ ] Player pulled toward well center
     - [ ] Force increases as player gets closer (falloff curve)
     - [ ] Force vector arrow (gold) visible showing pull direction
     - [ ] Pulsing concentric rings animate smoothly
   - Screenshot: Player being pulled by attract well, force arrow visible

4. **Approach repel well:**
   - Move near a repel well (pink pulsing rings)
   - Verify:
     - [ ] Player pushed away from well center
     - [ ] Distinct pink color differentiates from attract
     - [ ] Smooth force ramp-up on entry, ramp-down on exit
   - Screenshot: Player being pushed by repel well

5. **Dash through well:**
   - Dash (Shift) through a gravity well
   - Verify: Player is immune to well force during dash (default setting)
   - Verify: Toggling "Affects Dash" changes this behavior
   - Screenshot: Player dashing through well unaffected

6. **Slingshot maneuver:**
   - Enter attract well from the side at speed
   - Verify: Player accelerates through the well and exits with high velocity
   - Screenshot: Player launching out of well at high speed

### Expected Canvas Rendering

- Player: colored rectangle with cyan hitbox outline
- Gravity wells: pulsing concentric rings (indigo attract, pink repel), center dots
- Directional arrow particles: inside wells showing force direction
- Force vector: gold arrow on player showing net well force
- Platforms: purple/silver themed
- Parallax background: star-field/constellation layers
- Ambient particles: purple/silver drifters
- Diagnostics: bottom-left with velocity, gravity state, well info
- Goal zones: semi-transparent colored rectangles

### Pass Criteria Checklist

- [ ] Low-gravity feel (2.5x jump height due to 0.4x gravity multiplier)
- [ ] Attract wells pull player toward center
- [ ] Repel wells push player away
- [ ] Well slingshot behavior (400px+ gap traversal)
- [ ] Repel launch effect
- [ ] Goal A reached
- [ ] Goal B reached
- [ ] Gravity slider works (tunable in real-time)
- [ ] No movement seams at well boundaries
- [ ] Dash immunity from wells (default)

---

## Test 3: Maritime Ledger (`/test/biome/maritime-ledger`)

**Unique mechanic:** Current system — area-based directional force zones with 4 types: streams, jets, gusts, whirlpools
**Level:** 3840x1080, Spawn: (100, 880)
**Current zones:** 10 total (3 streams, 2 jets, 3 gusts, 2 whirlpools)
**Goal zones:** 4 (Goal A: ride current, Goal B: navigate currents, Goal C: ride gusts, Goal D: master whirlpool)

### Page Load Verification

1. Navigate to `http://localhost:3000/test/biome/maritime-ledger`
2. Wait 2 seconds for canvas initialization
3. Verify these elements are present:
   - [ ] `<canvas>` element (960x540 viewport into 3840x1080 level)
   - [ ] Player rectangle visible (left side, on starting platform)
   - [ ] Platforms rendered in teal/sand Maritime Ledger theme
   - [ ] Wave-line decoration on platform top edges (nautical theme)
   - [ ] Current zones visible with flow arrow/line overlays
   - [ ] Parallax background with harbor/nautical motif
   - [ ] Ambient teal/sand particles
   - [ ] Debug panel sidebar with:
     - Biome Info
     - Current Params (7): Global Strength, Grounded Multiplier, Max Current Velocity, Ramp Up Rate, Particle Density, Affects Grounded toggle, Dash Overrides Current toggle
     - Player Movement (4): Max Run Speed, Acceleration, Jump Speed, Dash Speed
     - Visual Settings (4): Ambient Particles, Parallax Background, Biome Colors, Current Debug Zones
     - Controls: Reset Player, Reset Goals, TP to Area 3 (Gusts), TP to Area 4 (Whirlpools), Debug Overlays
   - [ ] Pass criteria section (15 items)
   - [ ] Navigation link back to `/test`

### Interaction Test

1. **Enter a stream zone:**
   - Press Right Arrow to move into the first stream zone
   - Verify:
     - [ ] Player pushed in the stream's direction (constant directional force)
     - [ ] Flow visualization arrows rendered inside the zone
     - [ ] Force indicator visible showing current direction on player
   - Screenshot: Player inside stream, flow arrows visible

2. **Test grounded vs airborne force:**
   - Walk through a stream (grounded) — observe moderate push
   - Jump while inside the stream — observe stronger push
   - Verify: Airborne force is ~2.5x grounded force (grounded multiplier 0.4x)
   - Screenshot: Player airborne in stream, stronger force evident

3. **Dash through current:**
   - Dash (Shift) through a current zone
   - Verify: Player punches through unaffected (dash overrides current, default on)
   - Screenshot: Player mid-dash through current zone

4. **Test force ramp-up:**
   - Walk into and out of a stream zone
   - Verify: Force ramps up smoothly on entry (not instant snap), decays on exit
   - Screenshot: Player at zone boundary, smooth transition

5. **Gust zone pulsing:**
   - Navigate to Area 3 (gusts)
   - Verify:
     - [ ] Gusts pulse on/off (2s on, 1.5s off cycle)
     - [ ] 0.3s visual telegraph before gust activates (particles stir at 15%)
     - [ ] Player launched upward during active phase
   - Screenshot: Gust actively pushing, telegraph visible

6. **Whirlpool vortex:**
   - Navigate to Area 4 (whirlpools)
   - Verify:
     - [ ] Player path curves tangentially around vortex center
     - [ ] Circular flow arrow visualization
     - [ ] Clockwise/counter-clockwise rotation direction visible
   - Screenshot: Player being curved by whirlpool

7. **Jet launch:**
   - Step into a jet zone
   - Verify: Strong directional launch (900-1000 strength)
   - Screenshot: Player launched by jet

### Expected Canvas Rendering

- Player: colored rectangle with cyan hitbox outline
- Current zones: outlined rectangles with animated flow arrows/lines inside
- Zone type indicators: distinct arrow patterns per type (stream=lines, gust=updraft arrows, whirlpool=circular, jet=thick arrows)
- Force indicator: arrow on player showing applied current force
- Platforms: teal/sand themed with wave-line top edge decoration
- Parallax background: nautical/harbor motif layers
- Ambient particles: teal/sand colored, moving in current direction inside zones
- Diagnostics: bottom-left with velocity, current state, active zone info
- Goal zones: 4 labeled semi-transparent rectangles

### Pass Criteria Checklist

- [ ] Current push works (stream zones push player)
- [ ] Air current affects airborne player (stronger than grounded)
- [ ] Grounded reduction visible (0.4x multiplier)
- [ ] Dash override works
- [ ] Ramp up smooth entry (no velocity snap)
- [ ] Gust pulsing on/off cycle
- [ ] Gust telegraph visible (0.3s before activation)
- [ ] Whirlpool curved path (tangential force)
- [ ] Jet launch boost (strong directional launch)
- [ ] Flow visualization arrows rendered inside zones
- [ ] Goal A: Ride the current
- [ ] Goal B: Navigate currents
- [ ] Goal C: Ride the gusts
- [ ] Goal D: Master the whirlpool
- [ ] All sliders work (tune parameters in real-time)

---

## Test 4: Gothic Errata (`/test/biome/gothic-errata`)

**Unique mechanic:** Fog system — 3 distortion types: fog (visibility reduction), inversion (left/right swap), scramble (random directional remap)
**Level:** 3200x1080, Spawn: (100, 900)
**Fog zones:** 5 total (2 fog, 2 inversion, 1 scramble)
**Goal zones:** 4 (Goal A: navigate fog, Goal B: master inversion, Goal C: decode scramble, Goal D: combined gauntlet)

### Page Load Verification

1. Navigate to `http://localhost:3000/test/biome/gothic-errata`
2. Wait 2 seconds for canvas initialization
3. Verify these elements are present:
   - [ ] `<canvas>` element (960x540 viewport into 3200x1080 level)
   - [ ] Player rectangle visible (left side, on starting platform)
   - [ ] Platforms rendered in dark gray/crimson Gothic Errata theme
   - [ ] Zone boundary indicators visible:
     - Fog zones: purple glow border + drifting particles
     - Inversion zones: pulsing red border + reversed arrow icons
     - Scramble zones: jittering green border + static dot pattern
   - [ ] Parallax background with cathedral/dark motif
   - [ ] Ambient purple/crimson particles
   - [ ] Debug panel sidebar with:
     - Fog Params (8): Base Fog Radius, Min Fog Radius, Fog Fade In Rate, Fog Fade Out Rate, Dash Clear Duration, Inversion Tint, Scramble Glitch, Transition Delay
     - Fog Toggles (3): Dash Clears Fog, Inversion Affects Dash, Scramble Affects Dash
     - Visual Settings (3): Parallax Background, Biome Colors, Zone Boundaries
     - Player Movement (6): Max Run Speed, Jump Speed, Rise Gravity, Fall Gravity, Dash Speed, Air Acceleration
     - Controls: Reset Player, Reset Goals, TP to Areas 1-4, Debug Overlays
   - [ ] Pass criteria section (14 items)
   - [ ] Navigation link back to `/test`

### Interaction Test

1. **Enter fog zone (Area 1):**
   - Press Right Arrow to enter the first fog zone
   - Verify:
     - [ ] Radial visibility circle appears centered on player
     - [ ] Circle shrinks based on fog density (0.7 density = small circle)
     - [ ] Fog fades in smoothly (not instant — fogFadeInRate)
     - [ ] Area outside circle is dark overlay
   - Screenshot: Player inside fog, radial visibility circle visible

2. **Dash to clear fog:**
   - Press Shift to dash while inside fog zone
   - Verify: Fog temporarily clears (15-frame clear duration)
   - Verify: Full visibility restored briefly, then fog returns
   - Screenshot: Mid-dash, fog momentarily cleared

3. **Exit fog zone:**
   - Move out of the fog zone
   - Verify: Fog fades out smoothly (fogFadeOutRate, not instant)
   - Screenshot: Fog dissipating as player exits zone

4. **Enter inversion zone (Area 2):**
   - Navigate to Area 2
   - Verify:
     - [ ] Left/Right controls swap (press Right to go Left, Left to go Right)
     - [ ] Red tint overlay appears on screen edges
     - [ ] Grace period before inversion takes effect (10 frames transition delay)
   - Screenshot: Red tint visible, inverted controls active

5. **Enter scramble zone (Area 3):**
   - Navigate to Area 3
   - Verify:
     - [ ] All 4 directional inputs randomly remapped
     - [ ] Green glitch scanlines overlay visible
     - [ ] Mapping stays consistent within the zone (same shuffle each time inside)
     - [ ] Exiting and re-entering re-randomizes the mapping
   - Screenshot: Green glitch effect, scrambled controls active

6. **Combined gauntlet (Area 4):**
   - Navigate to Area 4
   - Verify: Fog + inversion/scramble combined
   - Verify: Multiple overlays stack (fog circle + tint/glitch)
   - Screenshot: Combined effects visible

7. **Zone boundary visuals:**
   - Walk near zone edges
   - Verify: Distinct boundary markers (purple glow for fog, pulsing red for inversion, jittering green for scramble)
   - Screenshot: Zone boundaries clearly marked

### Expected Canvas Rendering

- Player: colored rectangle with cyan hitbox outline
- Fog overlay: full-screen dark overlay with radial gradient hole at player position
- Inversion overlay: red tint on screen edges (pulsing)
- Scramble overlay: green glitch scanlines
- Zone boundaries: atmospheric borders with zone-specific colors and particle effects
- Platforms: dark gray with crimson top-line styling
- Parallax background: dark cathedral/gothic motif layers
- Ambient particles: purple/crimson drifters
- Diagnostics: bottom-left with fog state, control remap info, zone status
- Goal zones: 4 labeled semi-transparent rectangles

### Pass Criteria Checklist

- [ ] Fog reduces visibility (radial circle shrinks with density)
- [ ] Fog radius scales with density
- [ ] Smooth fog fade-in/out (not instant)
- [ ] Dash clears fog temporarily (15 frames)
- [ ] Inversion flips L/R controls
- [ ] Red tint during inversion
- [ ] Grace period on zone entry (10 frames)
- [ ] Scramble remaps directions randomly
- [ ] Scramble consistent within zone (not re-shuffled each frame)
- [ ] Green glitch during scramble
- [ ] Zone boundaries visible (purple/red/green markers)
- [ ] All 4 goals reachable
- [ ] No movement seams at zone boundaries
- [ ] Sliders tune in real-time

---

## Test Report Template

| Page | Loads? | Canvas Renders? | Debug Panel? | Biome Mechanic? | Issues |
|------|--------|-----------------|--------------|-----------------|--------|
| Herbarium Folio | | | | | |
| Astral Atlas | | | | | |
| Maritime Ledger | | | | | |
| Gothic Errata | | | | | |

### Per-Page Report Fields

For each page, record:
1. **URL:** The page URL tested
2. **Page Load:** Pass/Fail + any errors in browser console
3. **Canvas Rendering:** Pass/Fail — canvas shows player, platforms, biome theme
4. **Debug Panel:** Pass/Fail — sidebar visible with correct sliders and info sections
5. **Biome Mechanic:** Pass/Fail — biome-specific system works (vines/wells/currents/fog)
6. **Debug Overlays:** Pass/Fail — hitboxes, velocity vectors, state labels, biome debug info
7. **Pass Criteria:** Count of criteria verifiable from visual inspection
8. **Screenshots:** List of screenshots captured with descriptions
9. **Issues:** Any errors, visual glitches, or unexpected behavior

---

## Quick Smoke Test (5 minutes)

For a fast verification that all pages are functional:

1. Open each page URL in sequence
2. Verify canvas is not blank (player + platforms visible)
3. Test the biome-specific mechanic once
4. Verify debug panel responds to slider changes

| Page | URL | Quick Test | What to See |
|------|-----|------------|-------------|
| Herbarium Folio | `/test/biome/herbarium-folio` | Run near vine, press E | Player attaches, rope renders |
| Astral Atlas | `/test/biome/astral-atlas` | Jump (Space) | Noticeably floaty jump (~2.5x height) |
| Maritime Ledger | `/test/biome/maritime-ledger` | Walk into stream zone | Player pushed by current flow |
| Gothic Errata | `/test/biome/gothic-errata` | Walk into fog zone | Radial visibility circle appears |

---

## Automated Structural Verification

```bash
#!/bin/bash
# Quick verification script for biome test pages
PAGES=(
  "test/biome/herbarium-folio"
  "test/biome/astral-atlas"
  "test/biome/maritime-ledger"
  "test/biome/gothic-errata"
)

for page in "${PAGES[@]}"; do
  echo "=== /$page ==="
  HTML=$(curl -s "http://localhost:3000/$page")
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/$page")
  echo "  HTTP: $STATUS"
  echo "$HTML" | grep -q '<canvas' && echo "  Canvas: YES" || echo "  Canvas: NO"
  SLIDERS=$(echo "$HTML" | grep -c 'type="range"')
  echo "  Sliders: $SLIDERS (initial HTML; more render after React hydration)"
  echo "$HTML" | grep -q '/test' && echo "  Back link: YES" || echo "  Back link: NO"
  echo "$HTML" | grep -qi 'pass.*criter\|criteria' && echo "  Pass criteria: YES" || echo "  Pass criteria: NO"
  echo ""
done
```

Also verify TypeScript compiles cleanly:
```bash
npx tsc --noEmit
```
