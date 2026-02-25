# Visual Test Playbook — Combat Pages

## Overview

This playbook documents the visual test procedure for the 5 combat-related test pages in Inkbinders. Each test verifies that combat rendering, enemy/boss AI, hit detection, weapon switching, and debug panels work correctly.

## Prerequisites

- Dev server running: `npm run dev` (serves at `http://localhost:3000`)
- Browser with DevTools available (check console for JS errors)
- Keyboard input available (arrow keys, space, shift, J, K)

## Key Bindings Reference

| Action | Primary Key | Alternate |
|--------|-------------|-----------|
| Move Left | ArrowLeft | A |
| Move Right | ArrowRight | D |
| Move Up / Aim Up | ArrowUp | W |
| Move Down / Aim Down | ArrowDown | S |
| Jump | Space | Z |
| Dash | Shift | X |
| Attack | J | Enter |
| Weapon Switch | K | — |
| Pause | Escape | — |

## Combat System Notes

- **Combat is an overlay, NOT a player state.** Attacking does NOT interrupt movement — the player keeps running/jumping/dashing while attacks happen.
- **Two weapons:** Quill-Spear (fast mid-range directional, 8-dir aiming) and Ink-Snap (short-range auto-aim burst).
- **Hitstop is enemy-only** — the target freezes on hit, the player never freezes.
- **Floating damage numbers** are world-space (move with camera), appearing near hit points.

---

## Test 1: Combat Melee (`/test/combat-melee`)

**URL:** `http://localhost:3000/test/combat-melee`

### Expected Elements
- **Canvas:** 960x540, arena 1920x540 (scrolls with camera)
- **Player:** Colored rectangle (~32x48px) on a multi-platform arena
- **Target Dummies:** 7 dummies at various positions (colored rectangles with HP bars)
- **Debug Overlays:** Hitbox outline (cyan), velocity vector (amber), state label (purple), weapon indicator near player
- **Debug Panel:** Right sidebar with slider sections: Combat Info, Quill-Spear Params (11 sliders), Ink Snap Params (11 sliders), General Combat (3 toggles), Target Dummies (2 buttons), Player Movement (4 sliders)
- **HUD:** FPS counter (bottom-left), velocity readout (top-right), combat diagnostics box (bottom-left: State, Weapon, Phase, Cooldown, Hits, Damage)
- **Pass Criteria:** 14 criteria listed below canvas

### Test Steps

1. **Page Load**
   - Navigate to URL
   - Wait 2 seconds for canvas to initialize
   - Verify canvas is not blank (player rect and platforms visible)
   - Verify 7 target dummies are visible at various positions
   - Verify debug panel sidebar is visible with sliders
   - Check browser console for JS errors (should be none)

2. **Quill-Spear Attack**
   - Press ArrowRight for ~0.5 seconds to run toward nearest dummy
   - Press J to attack with quill-spear
   - Verify: Hitbox overlay extends from player in facing direction
   - Verify: Hitbox follows player through movement
   - Verify: Dummy takes damage (floating number appears)
   - Verify: Dummy freezes briefly (hitstop) then gets knocked back
   - Verify: Screen shake on hit, hit particles spawn

3. **Directional Aiming**
   - Hold ArrowUp + press J — hitbox shifts upward
   - Hold ArrowDown + press J — hitbox shifts downward
   - While airborne (jump + attack) — verify aerial attacks work
   - Verify: 8-directional aiming (any combination of horizontal + vertical)

4. **Weapon Switch**
   - Press K to switch to Ink Snap
   - Verify: Weapon indicator label changes near player
   - Verify: Combat diagnostics shows new weapon name

5. **Ink Snap Attack**
   - Press J to attack with ink snap
   - Verify: Auto-aim burst targets nearest enemy
   - Verify: Auto-aim range circle visible (debug overlay)
   - Verify: Different visual effect from quill-spear

6. **Attack During States**
   - Run + attack — verify state label stays "RUNNING"
   - Jump + attack — verify state label stays "JUMPING"
   - Dash + attack — verify attack works during dash
   - Wall-slide + attack — verify attack works during wall-slide

7. **Cooldown**
   - Press J rapidly
   - Verify: Attacks don't fire during cooldown period
   - Verify: Cooldown value visible in combat diagnostics

8. **Slider Test**
   - Adjust "Windup Frames" slider in Quill-Spear section
   - Attack again and verify timing feels different
   - Click "Respawn All" button — verify all dummies respawn

### Pass Criteria Checklist
- [ ] J attacks with spear, hitbox extends from player
- [ ] Hitbox follows player through movement
- [ ] Dummy takes damage, hitstop on dummy, knockback after hitstop
- [ ] Screen shake on hit, hit particles
- [ ] Attack while running/jumping/wall-sliding/dashing all work
- [ ] 8-directional aiming
- [ ] K switches to ink snap, snap auto-aims nearest target
- [ ] Cooldown prevents spam
- [ ] Floating damage numbers visible
- [ ] All params tunable via sliders
- [ ] Respawn All button works
- [ ] FPS counter visible
- [ ] Velocity readout visible
- [ ] Combat diagnostics box visible

---

## Test 2: Enemies (`/test/enemies`)

**URL:** `http://localhost:3000/test/enemies`

### Expected Elements
- **Canvas:** 960x540, arena 2880x540 (very wide, 3 arenas separated by walls)
- **Arena 1 (Reader Rush):** 4 Reader enemies — small, fast, patrol back and forth
- **Arena 2 (Binder Trap):** 3 Binder enemies — stationary, fire ink threads to pull player
- **Arena 3 (Proofwarden Gauntlet):** 2 Proofwarden enemies — shielded, slam attack
- **Debug Overlays:** Enemy hitboxes (colored outlines by type), detection range circles (dashed, semi-transparent)
- **Debug Panel:** Right sidebar with sections: Combat Info, Reader Params (9 sliders), Binder Params (8 sliders), Proofwarden Params (9 sliders), Player Health Params (4 controls), Controls (4 buttons), Player State
- **HUD:** Player health bar (top area), weapon indicator, kills counter, FPS counter
- **Pass Criteria:** 20 criteria (grid display, 2 columns with met/unmet indicators)

### Test Steps

1. **Page Load**
   - Navigate to URL
   - Wait 2 seconds for canvas to initialize
   - Verify canvas shows player and Reader enemies in Arena 1
   - Verify debug panel sidebar with slider sections is visible
   - Verify health bar HUD is displayed
   - Check browser console for JS errors

2. **Reader Enemy AI**
   - Observe: Readers patrol back and forth along their platforms
   - Run toward a Reader — verify it detects player (detection range circle)
   - Verify: Reader switches to chase state and runs toward player
   - Wait for Reader to reach attack range — verify lunge attack
   - Verify: Reader contact damage reduces player health (health bar updates)

3. **Combat with Readers**
   - Press J to attack a Reader
   - Verify: Reader takes damage (floating number), knockback arc
   - Press J again — verify Reader dies (2 hits to kill)
   - Verify: Kill counter increments
   - Verify: Reader respawns after delay

4. **Binder Enemy AI (Arena 2)**
   - Run right past Arena 1 walls into Arena 2
   - Wait for Binder to detect player
   - Verify: Binder fires ink thread toward player (visual line)
   - Verify: Thread connects and pulls player toward Binder
   - Press Shift (dash) — verify dash breaks the thread

5. **Proofwarden Enemy AI (Arena 3)**
   - Continue right into Arena 3
   - Press J to attack Proofwarden from the front
   - Verify: Shield blocks the attack (clang/block visual)
   - Run past Proofwarden, turn around, attack from behind
   - Verify: Attack connects from behind (shield only covers front)
   - Wait for Proofwarden slam telegraph
   - Verify: Slam deals damage if not dodged

6. **Player Health & I-Frames**
   - Take damage from any enemy
   - Verify: Health bar decreases
   - Verify: Brief invincibility flash (red tint) after taking damage
   - Press Shift to dash — verify dash grants i-frames
   - Click "Reset Player Health" button — verify health restores to full

7. **Debug Controls**
   - Click "Toggle Enemy AI" — verify all enemies stop moving
   - Click "Toggle Detection Range" — verify range circles hide/show
   - Click "Respawn All Enemies" — verify dead enemies respawn
   - Adjust Reader "Chase Speed" slider — verify chase speed changes

### Pass Criteria Checklist
- [ ] Reader patrols, detects player, chases
- [ ] Reader lunges at close range, deals contact damage
- [ ] Reader takes knockback on hit, dies & respawns
- [ ] Binder fires thread toward player
- [ ] Thread pulls player toward Binder
- [ ] Dash breaks Binder thread
- [ ] Binder can be attacked and killed
- [ ] Proofwarden shield blocks frontal attacks
- [ ] Proofwarden vulnerable from behind
- [ ] Proofwarden slam telegraph visible
- [ ] Proofwarden slam deals damage
- [ ] Player takes damage with i-frames
- [ ] Dash provides i-frames
- [ ] Health bar HUD displays correctly
- [ ] Floating damage numbers visible
- [ ] Kill counter increments
- [ ] All enemy types have colored hitbox outlines
- [ ] Detection range circles visible
- [ ] All params tunable via sliders
- [ ] Respawn All / Reset Health buttons work

---

## Test 3: Footnote Giant Boss (`/test/boss/footnote-giant`)

**URL:** `http://localhost:3000/test/boss/footnote-giant`

### Expected Elements
- **Canvas:** 960x540, arena 1280x540
- **Boss:** Large entity (128x128 area), stacked glyph visual
- **Boss Health Bar:** Screen-space, top center of canvas (visible after fight starts)
- **Player Health HUD:** Screen-space, bottom left
- **Boss Diagnostics:** Bottom-left box: Player State, Health, Weapon, Boss HP, Phase, Boss State, Timer, Attack, Seq Index, Elapsed Time, Damage Dealt
- **Phase 2 Platforms:** Blue with glow (or dashed outline when inactive)
- **Victory Text:** Appears after boss death with time and damage stats
- **Debug Panel:** Right sidebar with sections: Boss Info (HP/Phase/State), Boss Health & Phases (5 sliders), Pillar Slam (7 sliders), Ink Rain (5 sliders), Citation Stamp (5 sliders), Footnote Sweep (5 sliders), Controls (6 buttons)
- **Pass Criteria:** 12 criteria listed below canvas

### Test Steps

1. **Page Load**
   - Navigate to URL
   - Wait 2 seconds for canvas to initialize
   - Verify boss entity renders with stacked glyph visuals
   - Verify player rect on arena floor
   - Verify debug panel with boss parameter sliders
   - Check browser console for JS errors

2. **Phase 1 — Pillar Slam**
   - Run toward boss (ArrowRight)
   - Wait for Pillar Slam telegraph (visual indicator before attack)
   - Verify: Telegraph → slam → shockwave → stuck (vulnerable) sequence
   - Dodge the slam area, then attack during PILLAR_STUCK state
   - Verify: Floating damage numbers, boss HP decreases on health bar
   - Verify: "BLOCK" or clang effect when attacking during non-vulnerable state

3. **Phase 1 — Ink Rain**
   - Wait for Ink Rain attack pattern
   - Verify: Blots fall from above across the arena
   - Verify: Damage on contact with blots

4. **Phase 2 Transition**
   - Click "Skip to Phase 2" button in debug panel
   - Verify: Phase transition animation plays
   - Verify: Phase 2 platforms appear (blue with glow)
   - Verify: Citation Stamp attack pattern available

5. **Phase 3 Transition**
   - Click "Skip to Phase 3" button
   - Verify: Phase 3 attacks (Footnote Sweep — sweeping attack across arena)
   - Verify: New attack patterns visible

6. **Boss Death**
   - Toggle "Invincible" ON, reduce boss HP by attacking
   - Or click restart, toggle godmode, and fight through
   - Verify: Death animation plays when HP reaches 0
   - Verify: Victory text displays with elapsed time and damage dealt

7. **Debug Controls**
   - Click "Restart Fight" — verify everything resets (HP, phase, position)
   - Click "Toggle Boss AI" — verify boss stops attacking
   - Click "Show/Hide Overlays" — verify hitbox overlays toggle
   - Adjust "Slam Damage" slider — verify damage value changes

### Pass Criteria Checklist
- [ ] Boss renders with stacked glyph visuals
- [ ] Boss health bar visible at top
- [ ] Pillar Slam: telegraph → slam → shockwave → stuck (vulnerable)
- [ ] Invulnerable during non-vulnerable states (clang/block effect)
- [ ] Ink Rain falls from above
- [ ] Phase transitions at HP thresholds
- [ ] Phase 2: Citation Stamp attack visible
- [ ] Phase 3: Footnote Sweep attack visible
- [ ] Boss death animation plays
- [ ] Victory text displays with stats
- [ ] All params tunable via sliders
- [ ] Restart Fight resets everything

---

## Test 4: Misprint Seraph Boss (`/test/boss/misprint-seraph`)

**URL:** `http://localhost:3000/test/boss/misprint-seraph`

### Expected Elements
- **Canvas:** 960x720 (taller than standard — custom dimensions)
- **Arena:** 1280x720, dark purple background (#0f0a1a)
- **Boss:** Hovering entity with bob animation, wing-like visuals
- **Boss Health Bar:** Screen-space, top center (only shows after fight starts via "Start Fight" button)
- **Player Health HUD:** Screen-space, bottom left
- **Boss Diagnostics:** Extensive: Player State, Health, Weapon, Boss HP, Phase, Boss State, Timer, Attack, Hover Point, Corrupted Floor status, Vulnerable flag, Elapsed Time, Damage Dealt
- **Corrupted Floor Overlay:** Red-tinted (Phase 2), damage zone
- **Phase 2 Platforms:** Red with pink outline
- **Victory Text:** White text with pink stats after defeat
- **Debug Panel:** Boss Info, Boss Health & Phases (3 sliders), Ink Beam (4 sliders), Page Barrage (2 sliders), Dive Slash (2 sliders), Page Storm (1 slider), Desperation Slam (1 slider), Fight Controls (7 buttons)
- **Pass Criteria:** 10 criteria listed below canvas

### Test Steps

1. **Page Load**
   - Navigate to URL
   - Wait 2 seconds for canvas to initialize
   - Verify taller canvas (960x720 — not standard 540)
   - Verify dark purple background
   - Verify boss entity hovering with bob animation
   - Verify "Start Fight" button is visible in debug panel
   - Check browser console for JS errors

2. **Start Fight**
   - Click "Start Fight" button in debug panel
   - Verify: Boss health bar appears at top of canvas
   - Verify: Boss begins attack patterns

3. **Ink Beam**
   - Wait for Ink Beam attack
   - Verify: Beam sweeps across the arena horizontally
   - Verify: Beam deals damage on contact
   - Press Shift to dash through beam
   - Verify: Dash i-frames prevent beam damage

4. **Page Barrage**
   - Wait for Page Barrage attack
   - Verify: Boss fires projectile pages
   - Verify: After barrage, boss staggers (punish window)
   - Attack during stagger — verify damage applies

5. **Phase 2 (Corrupted Floor)**
   - Click "Skip to Phase 2" button
   - Verify: Corrupted floor overlay appears (red tint on ground)
   - Verify: Floor damage zone hurts player while standing on it
   - Verify: Dive Slash attack — boss dives at player
   - Verify: Page Storm — multiple pages in circular pattern

6. **Phase 3 (Desperation)**
   - Click "Skip to Phase 3" button
   - Verify: Triple Ink Beam (3 beams at once)
   - Verify: Rapid dive attacks
   - Verify: Desperation Slam — boss collapses (big punish window)

7. **Boss Death**
   - Toggle Godmode ON, fight until boss HP reaches 0
   - Verify: Death animation plays
   - Verify: Victory text with elapsed time and damage dealt

8. **Debug Controls**
   - Click "Retry" — verify fight resets completely
   - Toggle "Boss AI" — verify boss stops attacking
   - Toggle "Show/Hide Overlays" — verify hitbox overlay toggle
   - Adjust beam width slider — verify beam visual changes

### Pass Criteria Checklist
- [ ] Boss hovers with bob animation
- [ ] Teleport fade effect visible
- [ ] Ink Beam sweeps across arena
- [ ] Dash through beam with i-frames
- [ ] Page Barrage → stagger = punish window
- [ ] Phase 2: Corrupted floor damage zone, Dive Slash, Page Storm
- [ ] Phase 3: Triple Beam, Rapid Dive, Desperation Slam
- [ ] Death animation plays
- [ ] Health bar HUD visible (after fight starts)
- [ ] All params tunable, Retry resets fight

---

## Test 5: Index Eater Boss (`/test/boss/index-eater`)

**URL:** `http://localhost:3000/test/boss/index-eater`

### Expected Elements
- **Canvas:** 960x540, arena 1440x640 (wider than standard)
- **Background:** Dark parchment (#1a150e)
- **Boss:** Ground-mobile entity (128x96 area), wide body
- **Destructible Platforms:** 6 floor, 4 mid-level, 3 high — color-coded, crack indicators when damaged
- **Boss Health Bar:** Screen-space, top center (after fight starts)
- **Player Health HUD:** Screen-space, bottom left
- **Boss Diagnostics:** Player State, Health, Weapon, Boss HP, Phase, Boss State, Timer, Attack, Current Surface, Facing, Mouth %, Devoured counter, Vulnerable, Elapsed Time, Damage Dealt
- **Ink Flood Zones:** Phase 2 visual overlay (continuous damage areas)
- **Victory Text:** White text with tan/brown stats
- **Debug Panel:** Boss Info, Boss Health & Phases (3 sliders), Movement (2 sliders), Lunge Bite (2 sliders), Chain Whip (1 slider), Devour (1 slider), Drop Pounce (2 sliders), Death Thrash (2 sliders), Auto Crumble (1 slider), Fight Controls (8 buttons)
- **Pass Criteria:** 13 criteria listed below canvas

### Test Steps

1. **Page Load**
   - Navigate to URL
   - Wait 2 seconds for canvas to initialize
   - Verify dark parchment background
   - Verify boss entity on the arena floor
   - Verify destructible platforms visible (13 total: 6 floor + 4 mid + 3 high)
   - Verify debug panel with boss parameter sliders
   - Check browser console for JS errors

2. **Start Fight / Phase 1**
   - Click "Start Fight" or approach boss
   - Verify: Boss patrols floor, then chases player
   - Wait for Lunge Bite telegraph
   - Verify: Telegraph → lunge → recovery (LUNGE_RECOVERY = vulnerable)
   - Attack during LUNGE_RECOVERY — verify damage applies
   - Observe Chain Whip — damage zone behind boss
   - Observe Index Spit — 3-card fan projectile

3. **Phase 2 (Devour + Ink Flood)**
   - Click "Skip to Phase 2" button
   - Verify: Boss devours floor platforms (visual destruction, cracking animation)
   - Verify: Devoured counter increments in diagnostics
   - Verify: Ink flood zones appear on destroyed floor sections
   - Verify: Ink flood deals continuous damage to player
   - Verify: Boss has DEVOUR_STUNNED vulnerable state after eating

4. **Phase 3 (Wall Climbing + Death Thrash)**
   - Click "Skip to Phase 3" button
   - Verify: Boss climbs walls and/or ceiling (surface attachment)
   - Verify: Drop Pounce — boss drops from above (POUNCE_STUNNED = vulnerable)
   - Verify: Chain Storm — radial damage pattern
   - Verify: Auto-crumble — mid/high platforms self-destruct on timer with warning cracks

5. **Death Thrash**
   - Reduce boss HP to 3 or below (attack while godmode on, or use phase skip + attacks)
   - Verify: Death Thrash triggers — boss bounces between surfaces rapidly
   - Verify: Collapse after thrash (DEATH_THRASH_COLLAPSE = big punish window)
   - Kill boss during collapse
   - Verify: Victory text with stats

6. **Debug Controls**
   - Click "Retry" — verify everything resets including destroyed platforms
   - Click "Restore All Platforms" — verify all 13 platforms are restored
   - Toggle Boss AI — verify boss stops attacking
   - Toggle Godmode — verify player takes no damage
   - Adjust "Chase Speed" slider — verify boss movement speed changes

### Pass Criteria Checklist
- [ ] Boss patrols floor, chases player on detection
- [ ] Lunge Bite: telegraph → lunge → recovery (punish window)
- [ ] Chain Whip damage zone behind boss
- [ ] Index Spit: 3-card fan projectile
- [ ] Phase 2: Devour destroys platforms
- [ ] Phase 2: Ink Flood continuous damage zone
- [ ] Phase 3: Wall/ceiling crawl (surface attachment)
- [ ] Phase 3: Drop Pounce with stunned state
- [ ] Phase 3: Chain Storm radial damage
- [ ] Death Thrash at HP <= 3 (rapid bouncing → collapse)
- [ ] Auto-crumble timer destroys mid/high platforms
- [ ] Devoured counter displays in diagnostics
- [ ] Retry resets everything including platforms

---

## Automated Structural Verification Script

If browser-based testing is not available, run this script to verify page structure:

```bash
#!/bin/bash
# Quick verification script for combat test pages
PAGES=(
  "test/combat-melee"
  "test/enemies"
  "test/boss/footnote-giant"
  "test/boss/misprint-seraph"
  "test/boss/index-eater"
)

for page in "${PAGES[@]}"; do
  echo "=== /$page ==="
  HTML=$(curl -s "http://localhost:3000/$page")

  # Check HTTP response
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/$page")
  echo "  HTTP: $STATUS"

  # Check for canvas element
  echo "$HTML" | grep -q '<canvas' && echo "  Canvas: YES" || echo "  Canvas: NO"

  # Check for back link to /test
  echo "$HTML" | grep -q '/test' && echo "  Back link: YES" || echo "  Back link: NO"

  # Check for pass criteria
  echo "$HTML" | grep -qi 'pass.*criter\|criteria' && echo "  Pass criteria: YES" || echo "  Pass criteria: NO"

  echo ""
done

# Type-check
echo "=== TypeScript Check ==="
npx tsc --noEmit && echo "  PASS" || echo "  FAIL"
```

## Notes

- The Misprint Seraph uses a taller canvas (960x720) — verify this renders correctly without clipping.
- All combat is an overlay system — attacking should NOT change the player's state label (RUNNING stays RUNNING during attacks).
- Floating damage numbers are world-space (move with camera), not fixed screen position.
- Boss pages may require clicking "Start Fight" before the boss AI activates — this is intentional for controlled testing.
- The Index Eater's "Restore All Platforms" button is unique to this page and critical for testing destructible platform mechanics.
