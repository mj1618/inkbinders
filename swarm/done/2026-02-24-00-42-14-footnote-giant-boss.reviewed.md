# Task: Footnote Giant — First Boss Fight

## Overview

Implement the **Footnote Giant boss** and its test page (`/test/boss/footnote-giant`). This is Phase 3, step 15 — the first boss fight and the Phase 3 capstone. It proves the boss pattern: multi-phase encounter with telegraphed attacks, punish windows, arena platforming, and a health bar HUD.

The Footnote Giant is a massive corrupted footnote annotation — a towering construct of stacked reference marks (*, †, ‡, §) that has outgrown its margin and now blocks the archive corridor. It attacks by slamming its "reference pillars," raining ink blots, and stamping the ground with citation numbers.

**Core design principle:** The boss fight is a **movement puzzle**. Each phase tests a different movement skill the player has mastered. Phase 1 tests ground positioning and jump timing. Phase 2 tests wall mechanics and dash. Phase 3 tests all movement plus combat timing. The boss is never an HP sponge — it has clear patterns with generous punish windows.

## Dependencies

- Phase 1 movement system ✅
- Combat system (`src/engine/combat/`) — CombatSystem, combat types ✅
- Enemy base class (`src/engine/entities/Enemy.ts`) — from enemies task
- PlayerHealth (`src/engine/combat/PlayerHealth.ts`) — from enemies task
- ParticleSystem, ScreenShake, Camera ✅
- StateMachine ✅

**This task depends on the enemies task being complete.** It uses the Enemy base class, PlayerHealth, and patterns established in the enemies test page. If enemies is not yet done when this task is picked up, wait for it.

## Boss Design: Footnote Giant

### Concept

The Footnote Giant is a 3-phase boss that occupies the right side of the arena. It's large (128×160 pixels — roughly 4× player size), anchored to the ground (it doesn't chase the player). Instead, it attacks with long-range area denial, forcing the player to navigate the arena to find safe spots and punish windows.

**Thematic visual:** A tall stack of glowing reference symbols (†, ‡, §, ¶) with heavy ink outlines, sitting on a massive footnote bracket. The symbols pulse and separate during attacks. Think "a tower of living typography."

### Stats

| Param | Value | Description |
|-------|-------|-------------|
| `maxHealth` | 30 | Total HP across all phases |
| `phase1Threshold` | 20 | HP at which Phase 2 begins (takes 10 damage in Phase 1) |
| `phase2Threshold` | 10 | HP at which Phase 3 begins |
| `size` | { x: 128, y: 160 } | Large boss body |
| `bodyColor` | `#1e1b4b` | Deep indigo body |
| `glyphColor` | `#a5b4fc` | Light indigo glyphs |
| `accentColor` | `#4338ca` | Indigo accent |
| `damageFlashColor` | `#ffffff` | White flash on hit |

### Phase 1 — Pillar Slam (HP 30→20)

**Tests: Ground positioning, jump timing**

The boss alternates between two attacks:

**Attack A — Pillar Slam:**
1. **Telegraph (40 frames / 667ms):** One of the boss's reference pillars glows brightly and raises up. A shadow/indicator appears on the ground showing where it will slam (a rectangular danger zone, 80px wide). The shadow pulses.
2. **Slam (6 frames / 100ms):** The pillar slams down into the danger zone. Massive screen shake. Deals 2 damage + strong knockback to the player if caught in the zone. Creates a shockwave that travels along the ground (40px tall, moves at 300 px/s in both directions from impact point, fades after 200px travel).
3. **Stuck (50 frames / 833ms):** The pillar is stuck in the ground — this is the **punish window**. The boss's vulnerable hitbox (the body above the stuck pillar) is exposed. The stuck pillar itself has a glowing weak point.
4. **Recover (30 frames / 500ms):** The pillar retracts. Boss is invulnerable during recovery.

The boss cycles through slamming its left pillar, then right pillar. The danger zones are predictable — the player learns to stand between them and jump over shockwaves.

**Attack B — Ink Rain (used between every 2nd pillar slam):**
1. **Telegraph (30 frames / 500ms):** The boss's top glyph glows. Small ink drops appear at the top of the screen, falling slowly (visual telegraph).
2. **Rain (90 frames / 1500ms):** 4-6 ink blots fall from the top of the screen at random X positions (biased toward the player's position ± 100px). Each blot is 24×24, falls at 350 px/s, deals 1 damage on contact. Player must dodge by moving laterally or dashing.
3. **Cooldown (20 frames / 333ms):** Brief pause before next attack.

**Phase 1 Attack Pattern:**
`Pillar Slam Left → Ink Rain → Pillar Slam Right → Pillar Slam Left → Ink Rain → Pillar Slam Right → ...`

**Punish opportunity:** Hit the boss during the "Stuck" window after each pillar slam. The spear reaches easily. 3-4 hits per window = 3-4 damage per cycle. ~3 cycles to end Phase 1.

### Phase 2 — Citation Stamp (HP 20→10)

**Tests: Wall mechanics, dash**

The boss gets faster and adds a new attack. The arena gains wall platforms.

**Phase transition:** When HP hits 20, the boss recoils (100 frames / 1.67s), screen shakes violently, ink splatters everywhere, the boss's glyphs rearrange and glow brighter. Two wall platforms rise from the ground on the left side of the arena (they weren't there in Phase 1 — they "grow" out of the floor during the transition, or simply appear with a particle burst).

**Attack A — Fast Pillar Slam (same as Phase 1 but faster):**
- Telegraph: 30 frames (was 40)
- Stuck duration: 40 frames (was 50)
- Shockwave speed: 400 px/s (was 300)
- Now alternates between 3 positions instead of 2 (left, center, right)

**Attack B — Citation Stamp:**
1. **Telegraph (35 frames):** A large number glyph (1, 2, 3...) appears above the boss, growing larger. The ground beneath the boss flashes.
2. **Stamp (4 frames):** The boss slams its entire body downward. A massive shockwave travels across the ENTIRE ground floor (60px tall, 500 px/s). The ONLY safe positions are: in the air, on a wall (wall-sliding), or on the new wall platforms. This forces the player to use wall mechanics.
3. **Recovery (60 frames / 1s):** Boss is grounded and exhausted. Extended punish window. The boss's whole body is a valid hitbox.

**Attack C — Focused Ink Rain (faster, fewer blots, targeted):**
- 3 blots, fall speed 450 px/s, more tightly clustered on player position

**Phase 2 Attack Pattern:**
`Fast Slam → Citation Stamp → Fast Slam → Fast Slam → Focused Rain → Citation Stamp → ...`

**Punish opportunity:** The Citation Stamp recovery (60 frames) is the main window. Jump down from the wall/platform and attack the grounded boss. 4-5 hits per window.

### Phase 3 — Desperate Scrawl (HP 10→0)

**Tests: All movement + combat timing**

The boss enters desperation mode. Attacks are faster, overlapping, and the arena gets more chaotic.

**Phase transition:** At HP 10, the boss convulses, splits apart briefly (glyphs separate and swirl), then reassembles in a more chaotic form. Ink splashes across the arena. The boss's body pulses with red energy. Background color shifts darker.

**Attack A — Triple Slam:** Three rapid pillar slams in quick succession (telegraph 20 frames each, stuck only 25 frames, recovery 20 frames). The player must weave between three danger zones.

**Attack B — Citation Stamp (enhanced):** Same as Phase 2, but followed immediately by Ink Rain (simultaneous — player must be on walls AND dodge blots).

**Attack C — Footnote Sweep:**
1. **Telegraph (25 frames):** The boss's bottom bracket glows. A horizontal line indicator appears at ground level.
2. **Sweep (8 frames):** A beam sweeps across the arena from right to left, 40px tall, starting at the boss and reaching the left wall. Player must jump over it. The beam lingers for 8 frames at each position.
3. **Recovery (35 frames):** Punish window.

**Phase 3 Attack Pattern (semi-random):**
Pick from: Triple Slam, Enhanced Stamp, Footnote Sweep — cycling with brief pauses. Each attack has its own recovery/punish window. The boss's invulnerability window between attacks is shorter (15 frames vs 30).

**Final blow:** When HP reaches 0, the boss staggers (120 frames), body fragments scatter outward (massive particle burst), the glyphs float apart and dissolve. Victory screen flashes. The boss doesn't respawn (in the test page, add a "Restart Fight" button).

### Arena Layout

The arena is 1280×540 (roughly 1.33× canvas width, minimal camera scroll to keep the boss fight intimate).

```
┌══════════════════════════════════════════════════════════════════════┐
│                                                                      │
│                                              ┌────────────────────┐ │
│                                              │                    │ │
│   ┌──────┐              ┌──────┐            │   FOOTNOTE GIANT   │ │
│   │ Wall │              │ Wall │            │      128×160       │ │
│   │ Plat │              │ Plat │            │                    │ │
│   │(P2+) │              │(P2+) │            │                    │ │
│   └──────┘              └──────┘            │                    │ │
│                                              └────────────────────┘ │
│  PLAYER                                                              │
│  START                                                               │
│                                                                      │
│══════════════════════════════════════════════════════════════════════│
│  ░░░░ slam zone L ░░░░  ░░░░ slam zone C ░░░░  ░░░░ slam zone R ░░│
└══════════════════════════════════════════════════════════════════════┘
```

**Detailed Platform Layout:**
```typescript
const platforms: Platform[] = [
  // Ground floor
  { x: 0, y: 460, width: 1280, height: 80 },
  // Left wall
  { x: 0, y: 0, width: 20, height: 540 },
  // Right wall
  { x: 1260, y: 0, width: 20, height: 540 },
  // Ceiling
  { x: 0, y: 0, width: 1280, height: 20 },
  // Boss platform (the boss stands on the ground at right side)
  // No special platform needed — boss is at ground level

  // Phase 2+ wall platforms (created during phase transition)
  // Left wall platform
  { x: 80, y: 300, width: 80, height: 20 },
  // Center wall platform
  { x: 400, y: 260, width: 80, height: 20 },
  // Right approach platform (for getting close to boss at height)
  { x: 700, y: 320, width: 100, height: 20 },
];

// Phase 2+ platforms are added to the TileMap during the phase transition
// Store them separately and add via tileMap.addPlatform() or similar
// If TileMap doesn't have addPlatform(), just include them from the start
// but make them invisible until Phase 2 (render conditionally)
```

**Boss position:** The boss stands at x=1080, y=300 (top of the 160px body, feet at y=460 on the ground). The boss does NOT move horizontally — it's anchored.

**Player spawn:** x=100, y=420

### Boss Entity Architecture

```typescript
// src/engine/entities/bosses/FootnoteGiant.ts

export interface FootnoteGiantParams {
  // Health
  maxHealth: number;                // 30
  phase1Threshold: number;          // 20 — below this, Phase 2
  phase2Threshold: number;          // 10 — below this, Phase 3

  // Phase 1 — Pillar Slam
  pillarSlamTelegraph: number;      // 40 frames (Phase 1), 30 (Phase 2), 20 (Phase 3)
  pillarSlamDamage: number;         // 2
  pillarSlamKnockback: number;      // 400 px/s
  pillarSlamStuck: number;          // 50 frames (Phase 1), 40 (Phase 2), 25 (Phase 3)
  pillarSlamRecover: number;        // 30 frames
  shockwaveHeight: number;          // 40 px
  shockwaveSpeed: number;           // 300 px/s (Phase 1), 400 (Phase 2+)
  shockwaveRange: number;           // 200 px travel distance
  shockwaveDamage: number;          // 1

  // Phase 1 — Ink Rain
  inkRainTelegraph: number;         // 30 frames
  inkRainDuration: number;          // 90 frames
  inkRainBlotCount: number;         // 5 (Phase 1), 3 (Phase 2, more focused)
  inkRainBlotSize: number;          // 24 px
  inkRainFallSpeed: number;         // 350 px/s (Phase 1), 450 (Phase 2+)
  inkRainDamage: number;            // 1
  inkRainCooldown: number;          // 20 frames

  // Phase 2 — Citation Stamp
  citationStampTelegraph: number;   // 35 frames
  citationStampDamage: number;      // 2
  citationStampKnockback: number;   // 500 px/s
  citationStampShockwaveHeight: number; // 60 px
  citationStampShockwaveSpeed: number;  // 500 px/s
  citationStampRecovery: number;    // 60 frames

  // Phase 3 — Footnote Sweep
  footnoteSweepTelegraph: number;   // 25 frames
  footnoteSweepDamage: number;      // 1
  footnoteSweepHeight: number;      // 40 px
  footnoteSweepSpeed: number;       // 600 px/s (speed of sweep moving left)
  footnoteSweepRecovery: number;    // 35 frames

  // General
  phaseTransitionDuration: number;  // 100 frames
  invulnBetweenAttacks: number;     // 30 frames (Phase 1/2), 15 (Phase 3)
  bossShakeOnHit: number;           // 3 (screen shake intensity on hit)
  bossShakeFrames: number;          // 4
}

export const DEFAULT_FOOTNOTE_GIANT_PARAMS: FootnoteGiantParams = {
  maxHealth: 30,
  phase1Threshold: 20,
  phase2Threshold: 10,

  pillarSlamTelegraph: 40,
  pillarSlamDamage: 2,
  pillarSlamKnockback: 400,
  pillarSlamStuck: 50,
  pillarSlamRecover: 30,
  shockwaveHeight: 40,
  shockwaveSpeed: 300,
  shockwaveRange: 200,
  shockwaveDamage: 1,

  inkRainTelegraph: 30,
  inkRainDuration: 90,
  inkRainBlotCount: 5,
  inkRainBlotSize: 24,
  inkRainFallSpeed: 350,
  inkRainDamage: 1,
  inkRainCooldown: 20,

  citationStampTelegraph: 35,
  citationStampDamage: 2,
  citationStampKnockback: 500,
  citationStampShockwaveHeight: 60,
  citationStampShockwaveSpeed: 500,
  citationStampRecovery: 60,

  footnoteSweepTelegraph: 25,
  footnoteSweepDamage: 1,
  footnoteSweepHeight: 40,
  footnoteSweepSpeed: 600,
  footnoteSweepRecovery: 35,

  phaseTransitionDuration: 100,
  invulnBetweenAttacks: 30,
  bossShakeOnHit: 3,
  bossShakeFrames: 4,
};
```

### Boss State Machine

```
States:
  IDLE              — brief pause between attacks, boss is invulnerable
  PILLAR_TELEGRAPH  — telegraphing a pillar slam (danger zone indicator)
  PILLAR_SLAM       — pillar slamming down
  PILLAR_STUCK      — pillar stuck in ground (VULNERABLE — punish window)
  PILLAR_RECOVER    — pillar retracting (invulnerable)
  INK_RAIN_TELEGRAPH — telegraphing ink rain
  INK_RAIN          — raining ink blots
  CITATION_TELEGRAPH — telegraphing citation stamp (Phase 2+)
  CITATION_STAMP    — stamping (Phase 2+)
  CITATION_RECOVERY — exhausted after stamp (VULNERABLE — punish window)
  SWEEP_TELEGRAPH   — telegraphing footnote sweep (Phase 3)
  SWEEP             — sweep beam active (Phase 3)
  SWEEP_RECOVERY    — recovery after sweep (VULNERABLE)
  PHASE_TRANSITION  — transitioning between phases (invulnerable, dramatic)
  HURT              — taking damage (brief flinch, does not interrupt attack pattern)
  DYING             — death animation
  DEAD              — fight over
```

**Vulnerability rules:**
- Boss is ONLY vulnerable during `PILLAR_STUCK`, `CITATION_RECOVERY`, and `SWEEP_RECOVERY` states
- During all other states, attacks are blocked (with a "clang" effect similar to Proofwarden shield)
- Exception: during `HURT`, the boss takes the queued hit but immediately returns to its previous state
- The boss does NOT have a directional shield — it's vulnerable from all sides during punish windows

**Attack sequencer:**
The boss uses a pre-defined attack sequence per phase. The state machine reads from the sequence and advances after each attack completes. This is simpler than AI decision-making and ensures predictable patterns the player can learn.

```typescript
const PHASE_1_SEQUENCE = [
  'pillar-slam-left',
  'ink-rain',
  'pillar-slam-right',
  'pillar-slam-left',
  'ink-rain',
  'pillar-slam-right',
]; // Loops

const PHASE_2_SEQUENCE = [
  'fast-slam-left',
  'citation-stamp',
  'fast-slam-right',
  'fast-slam-center',
  'focused-rain',
  'citation-stamp',
]; // Loops

const PHASE_3_SEQUENCE = [
  'triple-slam',
  'citation-stamp-plus-rain',  // Combined attack
  'footnote-sweep',
  'triple-slam',
  'footnote-sweep',
  'citation-stamp-plus-rain',
]; // Loops
```

### Boss Class Structure

```typescript
export class FootnoteGiant {
  params: FootnoteGiantParams;

  // Health
  health: number;
  maxHealth: number;
  currentPhase: 1 | 2 | 3;
  isAlive: boolean;
  invincibilityFrames: number;

  // Position (fixed, does not move)
  position: Vec2;
  size: Vec2;

  // State machine
  stateMachine: StateMachine<FootnoteGiantState>;
  stateTimer: number;  // Frames remaining in current state

  // Attack sequencer
  attackSequence: string[];
  sequenceIndex: number;

  // Attack state
  currentAttack: string | null;
  pillarSlamSide: 'left' | 'center' | 'right';
  slamDangerZone: Rect | null;
  shockwaves: Shockwave[];  // Active shockwaves
  inkBlots: InkBlot[];      // Active falling ink blots
  sweepBeam: SweepBeam | null;  // Active sweep beam

  // Visual state
  hitFlashTimer: number;
  phaseTransitionTimer: number;
  glyphOffsets: Vec2[];  // Per-glyph animation offsets
  bodyShakeOffset: Vec2;  // Shake offset during attacks
  deathTimer: number;

  // References
  particleSystem: ParticleSystem | null;
  screenShake: ScreenShake | null;

  constructor(params?: Partial<FootnoteGiantParams>);

  /** Whether the boss can currently take damage */
  isVulnerable(): boolean;

  /** Take damage. Returns true if damage applied, false if blocked. */
  takeDamage(damage: number, hitstopFrames: number): boolean;

  /** Main update — run state machine, advance attacks, update projectiles */
  update(dt: number, playerBounds: Rect, playerPosition: Vec2): void;

  /** Get all active damage zones (slam zones, shockwaves, ink blots, sweep beam) */
  getActiveHazards(): DamageZone[];

  /** Advance to next attack in the sequence */
  nextAttack(): void;

  /** Check for phase transition */
  checkPhaseTransition(): void;

  /** Start phase transition animation */
  startPhaseTransition(newPhase: 2 | 3): void;

  /** Render the boss body, glyphs, attack effects, health bar */
  render(ctx: CanvasRenderingContext2D, camera: Camera): void;

  /** Render boss health bar at top of screen */
  renderHealthBar(ctx: CanvasRenderingContext2D, canvasWidth: number): void;

  /** Reset to Phase 1, full health */
  reset(): void;
}

interface Shockwave {
  x: number;
  y: number;
  width: number;
  height: number;
  velocityX: number;   // Moving left or right
  distanceTraveled: number;
  maxDistance: number;
  damage: number;
  active: boolean;
}

interface InkBlot {
  x: number;
  y: number;
  size: number;
  velocityY: number;
  damage: number;
  active: boolean;
}

interface SweepBeam {
  x: number;          // Current left edge of beam
  y: number;          // Y position (ground level - height)
  width: number;      // Width of beam section
  height: number;
  velocityX: number;  // Moving leftward (negative)
  damage: number;
  active: boolean;
}

interface DamageZone {
  rect: Rect;
  damage: number;
  knockback: Vec2;
  type: 'slam' | 'shockwave' | 'ink-blot' | 'stamp' | 'sweep';
}
```

### Boss Visual Design

**Body:**
- The boss is a stack of typography reference symbols drawn with canvas:
  - Bottom: a massive footnote bracket `[` shape — 128px wide, 40px tall, deep indigo (`#1e1b4b`)
  - Stack: Four glyph symbols (†, ‡, §, ¶) stacked vertically, each ~28px tall
  - Glyphs drawn with `ctx.fillText()` using a large font (e.g., 36px serif), centered
  - Glyph colors: `#a5b4fc` (light indigo) with `#4338ca` stroke
  - The glyphs subtly bob up and down (offset by sin(time * freq + index) * amplitude, different phase per glyph)
  - Between attacks, the boss "breathes" — slight scale oscillation (0.98–1.02)

**Phase transitions:**
- Phase 1→2: Glyphs separate (offsets increase), swirl briefly, reassemble. Flash of indigo light. Background dims slightly. Platforms "rise" from the ground with particles.
- Phase 2→3: Glyphs turn red (`#ef4444`). Body pulses rapidly. Ink splatters cover the screen briefly. Background turns darker. Boss shakes constantly in Phase 3 (small random offset each frame).

**Attack telegraphs:**
- **Pillar slam:** A vertical bar descends from the boss's side. The danger zone on the ground glows amber (`#f59e0b`) with pulsing opacity. Gets brighter as the telegraph progresses.
- **Ink rain:** Small dots appear at the top of the screen, descending slowly. The boss's top glyph (¶) glows white.
- **Citation stamp:** A large number (1, 2, 3... incrementing) appears above the boss, growing larger. The entire ground floor flashes red briefly as a telegraph.
- **Footnote sweep:** A horizontal line appears at the boss's base, glowing red. Moves to the left edge over the telegraph duration.

**Hit effects:**
- When the boss takes damage: white flash for 4 frames, damage number floats up, ink particles scatter from hit point
- When an attack is blocked (boss invulnerable): small "clang" particles (white/gray sparks), no damage number, subtle screen shake

**Death:**
- Boss body fragments into 20-30 particles
- Each glyph separates and floats upward, fading
- The bracket base cracks and falls apart
- A burst of white light from the center
- Ink rain of particles (celebration!)
- "VICTORY" text appears after 2 seconds (large, center screen, white)

**Boss health bar:**
- Top of screen, centered, spanning ~400px wide
- Background: `#1f2937` (dark gray)
- Fill: gradient from `#4338ca` (indigo) at full → `#ef4444` (red) at low HP
- Phase markers at HP 20 and HP 10 (thin white dividers)
- Boss name "FOOTNOTE GIANT" above the bar in small text
- Current phase indicator: "Phase I" / "Phase II" / "Phase III" next to the name

### Test Page (`/test/boss/footnote-giant`)

**Debug Overlays:**
- Boss hitbox (purple outline)
- Player hitbox (cyan outline)
- Slam danger zones (amber when telegraphed, red when active)
- Shockwave hitboxes (orange outline)
- Ink blot hitboxes (dark circles)
- Sweep beam hitbox (red horizontal line)
- Boss vulnerability indicator: "VULNERABLE" text above boss in green when punish window is open, "INVULNERABLE" in red otherwise
- Boss state label
- Boss phase label
- Player health HUD
- Boss health bar HUD
- FPS, player state, velocity

**Debug Panel Sections:**

1. **Boss Info** (always visible):
   - Boss HP: X / 30
   - Current Phase: 1 / 2 / 3
   - Boss State: (current state name)
   - State Timer: (frames remaining)
   - Current Attack: (attack name)
   - Sequence Index: (position in attack sequence)
   - Player HP: X / 5
   - Total damage dealt to boss
   - Time elapsed (seconds)
   - Current weapon

2. **Boss Health & Phases** (collapsed):
   | Parameter | Min | Max | Step | Default |
   |-----------|-----|-----|------|---------|
   | Max Health | 10 | 60 | 5 | 30 |
   | Phase 2 Threshold | 5 | 25 | 5 | 20 |
   | Phase 3 Threshold | 1 | 15 | 1 | 10 |
   | Phase Transition Duration | 40 | 200 | 10 | 100 |
   | Invuln Between Attacks | 5 | 60 | 5 | 30 |

3. **Pillar Slam** (collapsed):
   | Parameter | Min | Max | Step | Default |
   |-----------|-----|-----|------|---------|
   | Telegraph Frames | 10 | 80 | 5 | 40 |
   | Slam Damage | 1 | 5 | 1 | 2 |
   | Stuck Duration | 15 | 80 | 5 | 50 |
   | Recovery Frames | 10 | 60 | 5 | 30 |
   | Shockwave Height | 20 | 80 | 5 | 40 |
   | Shockwave Speed | 100 | 600 | 25 | 300 |
   | Shockwave Range | 80 | 400 | 20 | 200 |

4. **Ink Rain** (collapsed):
   | Parameter | Min | Max | Step | Default |
   |-----------|-----|-----|------|---------|
   | Telegraph Frames | 10 | 60 | 5 | 30 |
   | Duration Frames | 30 | 150 | 10 | 90 |
   | Blot Count | 2 | 10 | 1 | 5 |
   | Blot Size | 12 | 40 | 4 | 24 |
   | Fall Speed | 150 | 600 | 25 | 350 |

5. **Citation Stamp** (collapsed):
   | Parameter | Min | Max | Step | Default |
   |-----------|-----|-----|------|---------|
   | Telegraph Frames | 15 | 60 | 5 | 35 |
   | Damage | 1 | 5 | 1 | 2 |
   | Shockwave Height | 30 | 100 | 5 | 60 |
   | Shockwave Speed | 200 | 800 | 25 | 500 |
   | Recovery Frames | 20 | 100 | 5 | 60 |

6. **Footnote Sweep** (collapsed):
   | Parameter | Min | Max | Step | Default |
   |-----------|-----|-----|------|---------|
   | Telegraph Frames | 10 | 50 | 5 | 25 |
   | Damage | 1 | 3 | 1 | 1 |
   | Sweep Height | 20 | 60 | 5 | 40 |
   | Sweep Speed | 200 | 1000 | 50 | 600 |
   | Recovery Frames | 15 | 60 | 5 | 35 |

7. **Player & Combat** (collapsed):
   - Standard player health params, combat params
   - Movement params (read-only display)

8. **Controls** (collapsed):
   - Restart Fight button (resets boss to Phase 1, full HP, resets player)
   - Skip to Phase 2 button (sets boss HP to phase1Threshold)
   - Skip to Phase 3 button (sets boss HP to phase2Threshold)
   - Toggle invincibility (player takes no damage)
   - Toggle boss AI (pause attacks)
   - Toggle debug overlays

**Pass Criteria (display on page):**

1. Boss renders with stacked glyph body at right side of arena
2. Boss health bar appears at top of screen with phase markers
3. Pillar slam has clear telegraph (danger zone on ground)
4. Pillar slam deals damage if player is in the danger zone
5. Shockwave travels along ground after pillar slam
6. Boss is vulnerable during PILLAR_STUCK (can be damaged)
7. Boss is invulnerable during non-punish states (attacks blocked with clang)
8. Ink rain drops fall from top of screen toward player area
9. Player can dodge ink rain by moving laterally
10. Phase transition triggers at HP threshold (visual + new attacks)
11. Phase 2 adds Citation Stamp (full-ground shockwave)
12. Citation Stamp forces player to use walls/platforms to avoid
13. Phase 3 adds Footnote Sweep (horizontal beam to jump over)
14. Boss death plays dramatic particle/glyph separation animation
15. All boss params tunable via debug sliders
16. Player health and combat work correctly during fight
17. Debug overlays show all hitboxes, danger zones, and boss state
18. "Skip to Phase" buttons work for rapid testing
19. Restart Fight resets everything cleanly
20. Fight feels fair — patterns are learnable, punish windows are clear

**Keyboard Controls:**
| Key | Action |
|-----|--------|
| Arrow Left/Right | Move |
| Arrow Up / Z / Space | Jump |
| Arrow Down | Crouch |
| X / Shift | Dash |
| J / Enter | Attack |
| K | Switch weapon |
| D | Toggle debug overlays |

## Files to Create

- `src/engine/entities/bosses/FootnoteGiant.ts` — Boss entity with full multi-phase fight
- `src/engine/entities/bosses/FootnoteGiantParams.ts` — All boss tunable parameters
- `src/engine/entities/bosses/index.ts` — Barrel export

## Files to Modify

- `src/engine/entities/index.ts` — Export boss modules
- `src/app/test/boss/footnote-giant/page.tsx` — Full test page (replace stub)
- `src/lib/testStatus.ts` — Update footnote-giant status to `'in-progress'`

## Important Implementation Notes

1. **The boss does NOT extend the Enemy base class.** Bosses are too different from regular enemies to share a base. The FootnoteGiant is a standalone class. It implements its own `takeDamage()`, `update()`, `render()` methods. It uses the same `Damageable` interface concepts but doesn't inherit from `Enemy`.

2. **The boss is a FIXED-POSITION entity.** It does not move horizontally. It does not use TileMap collision for itself. It has a fixed `position` and its attacks create hazard zones at computed positions. This is simpler than a moving boss and keeps the fight about the player's movement.

3. **Wire damage in the test page.** The test page update callback:
   - Runs `boss.update(dt, playerBounds, playerPosition)` — boss AI advances
   - Gets `boss.getActiveHazards()` — returns all damage zones (slam, shockwave, blots, sweep)
   - Checks each hazard against `playerBounds` for overlap
   - If overlap and `playerHealth.canTakeDamage(...)`: apply damage, knockback
   - Runs `combatSystem.update(...)` — player attacks produce hitboxes
   - Checks `combatSystem.checkHits([{ id: 'boss', bounds: boss.getBounds() }])` — but only if `boss.isVulnerable()`
   - If hit and vulnerable: `boss.takeDamage(hitDamage, hitstopFrames)`

4. **Shockwaves are independent objects.** When a pillar slam hits the ground, it spawns 2 shockwave objects (one going left, one going right). These update independently (move, check distance, deactivate). They're stored in the boss's `shockwaves` array and cleaned up when inactive.

5. **Ink blots are independent falling objects.** Spawned at random X positions (biased toward player ± 100px) at y=0. They fall at `inkRainFallSpeed`, check against player bounds, and deactivate when they hit the ground (y > 460). Stored in `inkBlots` array.

6. **Phase transition blocks all interaction.** During `PHASE_TRANSITION` state, the boss is invulnerable, no attacks happen, no hazards are active. It's a pure cinematic moment. The player can move freely but can't damage the boss.

7. **Phase 2 platforms.** The simplest approach: include the Phase 2 platforms in the TileMap from the start. During Phase 1, don't render them (or render them as faint outlines). During the phase transition, render them appearing with a particle burst. During Phase 2+, render and collide normally. The collision is always there — the player just can't see them in Phase 1 (or alternatively, add them dynamically to the TileMap during the transition).

8. **The attack sequencer is a simple array index loop.** After each attack completes, increment `sequenceIndex`. If it exceeds the array length, wrap to 0. On phase transition, swap the sequence array and reset the index. This is dead simple and guarantees predictable patterns.

9. **Hitstop on the boss.** When the boss takes damage, it hitstops for 4 frames (from `spearHitstopFrames` / `snapHitstopFrames`). During hitstop, the boss's state timer pauses but the player keeps moving. Same enemy-only hitstop pattern as regular enemies.

10. **Camera for this arena.** The arena is 1280px wide (slightly larger than the 960px canvas). Use a subtle camera follow — the camera can scroll ~160px left/right to follow the player. Set `camera.setBounds({ x: 0, y: 0, width: 1280, height: 540 })`. The boss should always be at least partially visible.

11. **Use PlayerHealth from the enemies task.** Import and instantiate `PlayerHealth` in the test page. Same pattern as the enemies test page.

12. **Use CombatSystem from the combat-melee task.** Import and instantiate `CombatSystem`. The player fights the boss with the same quill-spear and ink-snap weapons.

13. **Boss hit detection.** The boss's hittable bounds are its full body rect (128×160) during vulnerable states. Don't use sub-hitboxes for the first boss — keep it simple. The whole body is the target. If the boss is invulnerable, play the "clang" block effect on hit attempt.

## Verification

- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build` succeeds
- [ ] Navigate to `/test/boss/footnote-giant` — canvas renders with arena, player, and boss
- [ ] Boss renders as stacked glyphs on a bracket base
- [ ] Boss health bar renders at top of screen with phase markers
- [ ] Phase 1: Pillar slam telegraph shows danger zone on ground
- [ ] Phase 1: Pillar slam deals damage to player in danger zone
- [ ] Phase 1: Shockwave travels along ground after slam
- [ ] Phase 1: Boss is hittable during PILLAR_STUCK state
- [ ] Phase 1: Boss blocks attacks outside punish windows (clang effect)
- [ ] Phase 1: Ink rain drops fall from top of screen
- [ ] Phase transition at HP 20: dramatic animation, platforms appear
- [ ] Phase 2: Citation Stamp creates full-ground shockwave
- [ ] Phase 2: Player must jump/wall-slide to avoid Citation Stamp
- [ ] Phase 2: Boss vulnerable during CITATION_RECOVERY
- [ ] Phase transition at HP 10: visual shift to desperate mode
- [ ] Phase 3: Footnote Sweep beam crosses arena
- [ ] Phase 3: Player can jump over sweep beam
- [ ] Phase 3: Boss vulnerable during SWEEP_RECOVERY
- [ ] Phase 3: Attacks are faster with shorter punish windows
- [ ] Boss death: dramatic particle animation, glyphs separate
- [ ] Victory text appears after boss dies
- [ ] Player takes damage from all boss hazards (slam, shockwave, blots, stamp, sweep)
- [ ] Player i-frames and dash i-frames work during boss fight
- [ ] Player combat (spear + snap) damages boss correctly
- [ ] Floating damage numbers on boss hits
- [ ] Debug overlays show all hazard zones and boss state
- [ ] Skip to Phase 2/3 buttons work
- [ ] Restart Fight resets cleanly
- [ ] All boss params tunable via sliders
- [ ] FPS stays at ~60fps during the fight
- [ ] Existing movement and combat work without regressions

---

## Implementation Summary

### Agent: 00756d97

### Files Created
- `src/engine/entities/bosses/FootnoteGiantParams.ts` — All tunable boss parameters (35 params) with defaults
- `src/engine/entities/bosses/FootnoteGiant.ts` — Full multi-phase boss entity (~900 lines)
  - Standalone class (does NOT extend Enemy — too different)
  - 16-state state machine: IDLE, PILLAR_TELEGRAPH, PILLAR_SLAM, PILLAR_STUCK, PILLAR_RECOVER, INK_RAIN_TELEGRAPH, INK_RAIN, CITATION_TELEGRAPH, CITATION_STAMP, CITATION_RECOVERY, SWEEP_TELEGRAPH, SWEEP, SWEEP_RECOVERY, PHASE_TRANSITION, DYING, DEAD
  - Attack sequencer with looping sequences per phase
  - Phase 1: Pillar Slam (left/right) + Ink Rain
  - Phase 2: Fast Slam (3 positions) + Citation Stamp (full-ground shockwave) + Focused Rain
  - Phase 3: Triple Slam + Citation Stamp + Rain combo + Footnote Sweep
  - Independent projectile system: shockwaves, ink blots, sweep beam, stamp shockwaves
  - Vulnerability only during PILLAR_STUCK, CITATION_RECOVERY, SWEEP_RECOVERY
  - Clang effect on blocked hits, hit flash on damage
  - Phase transition animation with glyph separation swirl
  - Death animation with particle bursts, glyph dissolution
  - Health bar with phase markers and gradient fill
  - Full debug overlay rendering (hitboxes, state labels, vulnerability indicator)
  - skipToPhase() for rapid testing
- `src/engine/entities/bosses/index.ts` — Barrel export
- `src/app/test/boss/footnote-giant/page.tsx` — Full test page (~600 lines)
  - Arena: 1280x540 with walls, ceiling, ground
  - Phase 2 platforms (visible after phase transition, always in collision)
  - Full combat integration: CombatSystem, PlayerHealth, both weapons
  - Boss hazard → player damage with knockback
  - Player attack → boss damage (only when vulnerable)
  - Floating damage numbers for hits and blocks
  - Victory screen after boss death (time + damage dealt)
  - Debug panel with all 35 boss params as sliders in 6 collapsible sections
  - Controls: Restart Fight, Skip to Phase 2/3, Toggle Invincibility, Toggle Boss AI, Toggle Debug
  - Screen-space HUD: boss health bar, player health hearts, FPS, diagnostics

### Files Modified
- `src/engine/entities/index.ts` — Added FootnoteGiant, DamageZone, FootnoteGiantParams exports
- `src/lib/testStatus.ts` — Updated footnote-giant status to `'in-progress'`

### Verification
- `npx tsc --noEmit` passes with zero errors from boss files (pre-existing herbarium-folio error not related)
- `npm run build` compiles successfully (same pre-existing herbarium-folio type error)
- Boss test page route renders at `/test/boss/footnote-giant`

---

## Review Notes

### Reviewer: b9bfd83a

**Overall assessment:** Solid implementation. The boss entity is well-structured with clean state machine design, correct frame-rate-independent projectile physics, and comprehensive debug tooling. Found and fixed 4 issues.

### Fixes Applied

1. **BUG FIX: Phase transition leaks triple-slam state** (`FootnoteGiant.ts`)
   - `startPhaseTransition()` did not reset `currentAttack` or `tripleSlamIndex`. If a phase transition fired during a triple-slam sequence (player hits boss during PILLAR_STUCK mid-triple-slam), the new phase would incorrectly continue the interrupted triple-slam from the old phase.
   - **Fix:** Added `this.currentAttack = null; this.tripleSlamIndex = 0;` to `startPhaseTransition()`.

2. **BUG FIX: citation-stamp-plus-rain combo was ineffective** (`FootnoteGiant.ts`)
   - The rain during the combo attack used `Math.random() < 0.15` per frame during the 4-frame CITATION_STAMP window, yielding ~0.6 expected blots — not a threatening simultaneous attack.
   - **Fix:** Changed to spawn 3 blots in a batch on the first frame of CITATION_STAMP when `inkBlots.length === 0`, making the combo feel like a real combined pressure move.

3. **Clarity: SWEEP stateTimer precedence** (`FootnoteGiant.ts`)
   - `Math.ceil(1300 / speed * 60)` was arithmetically correct but precedence-ambiguous.
   - **Fix:** Added explicit parentheses: `Math.ceil((1300 / speed) * 60)`.

4. **Minor: floatingNumbers not cleared on unmount** (`page.tsx`)
   - `floatingNumbersRef.current` was not cleared in `handleUnmount`, which could cause stale renders on remount (e.g., React Strict Mode).
   - **Fix:** Added `floatingNumbersRef.current.length = 0;` to `handleUnmount`.

### Items Noted but Not Fixed (Low Priority)

- **debugLayerCallback and onUpdate/onRender callbacks not explicitly removed on unmount.** These closures are freed when the engine is GC'd (since `engineRef.current` is nulled), so there's no long-lived memory leak. Fixing this properly would require a structural refactor (storing the callback ref externally or returning a cleanup function from handleMount). Not worth the churn for a test page.
- **`frameCounter`-based sine animations** for glyph bobbing and pulse effects use magic multipliers that implicitly assume 60 Hz. Correct for the fixed-timestep engine, but if the timestep constant ever changed these would need updating. Low risk.
- **One-frame lag in sweep beam exit detection** — the SWEEP state checks `sweepBeam.active` before `updateProjectiles` updates the beam position. The timer backup ensures correct behavior; this is invisible in practice.

### Verification After Fixes
- `npx tsc --noEmit` passes with zero errors
