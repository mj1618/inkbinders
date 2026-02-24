# Task: Misprint Seraph — Second Boss Fight

## Overview

Implement the **Misprint Seraph boss** and its test page (`/test/boss/misprint-seraph`). This is Phase 5, step 20 — the second boss fight. Where the Footnote Giant was a grounded, stationary tower that tested positioning and timing, the Misprint Seraph is an **aerial, mobile boss** that tests air control, dash i-frames, and wall mechanics.

The Misprint Seraph is a corrupted angel-figure made of overlapping misprinted text — layered translucent pages forming wings, with a body of scrambled typefaces. It hovers above the arena and attacks with sweeping ink beams, page-fragment projectiles, and diving slashes. The fight is vertical: the arena has tall walls and high platforms, and the boss teleports between hover points.

**Core design principle:** The Misprint Seraph is a **dash and air-control test**. Phase 1 tests dash i-frames (dodging beams). Phase 2 tests wall-jumping and aerial positioning (the floor becomes dangerous). Phase 3 tests everything — the boss moves constantly and attacks overlap. The player must stay mobile and use all movement tools.

## Dependencies

- Phase 1 movement system ✅ (all states, dash, wall mechanics)
- Combat system (`src/engine/combat/`) — CombatSystem, combat types ✅
- PlayerHealth ✅
- FootnoteGiant boss pattern ✅ (use as structural template)
- StateMachine, ParticleSystem, ScreenShake, Camera ✅
- `aabbOverlap` from `src/engine/physics/AABB.ts` ✅

## Boss Design: Misprint Seraph

### Concept

The Misprint Seraph is an aerial boss that hovers at different positions around the arena. It's medium-sized (96×120 pixels — roughly 3× player size), NOT anchored to the ground. Instead of standing in one spot, it teleports between 5 pre-defined hover points and attacks from the air. The player must track its position, dodge ranged attacks, and strike during punish windows when it descends or staggers.

**Thematic visual:** A figure made of overlapping semi-transparent text pages forming angular "wings" (2 triangular wing shapes on each side). The body is a column of scrambled glyphs (?, !, ¿, ¡, «, »). The wings pulse and flutter. When damaged, pages tear away. A faint halo of misaligned text circles the head. Think "corrupted typographic angel."

### Stats

| Param | Value | Description |
|-------|-------|-------------|
| `maxHealth` | 24 | Total HP across all phases |
| `phase1Threshold` | 16 | HP at which Phase 2 begins (8 damage in Phase 1) |
| `phase2Threshold` | 8 | HP at which Phase 3 begins |
| `bodyWidth` | 96 | Boss body width |
| `bodyHeight` | 120 | Boss body height |
| `wingSpan` | 200 | Total wing visual width (extends beyond body hitbox) |
| `bodyColor` | `#f8fafc` | Near-white body (paper) |
| `glyphColor` | `#ef4444` | Red misprint glyphs |
| `wingColor` | `rgba(248, 250, 252, 0.4)` | Semi-transparent wing pages |
| `accentColor` | `#dc2626` | Red accent for attacks |
| `haloColor` | `rgba(239, 68, 68, 0.3)` | Red halo around head |

### Arena Layout

The arena is taller than the Footnote Giant arena — vertical with platforms for wall mechanics.

```typescript
const ARENA_WIDTH = 1280;
const ARENA_HEIGHT = 720;   // Taller than Footnote Giant (was 540)
const GROUND_Y = 640;       // Ground floor
const PLAYER_SPAWN: Vec2 = { x: 120, y: 600 };

const platforms: Platform[] = [
  // Ground floor
  { x: 0, y: GROUND_Y, width: ARENA_WIDTH, height: 80 },
  // Left wall
  { x: 0, y: 0, width: 20, height: 720 },
  // Right wall
  { x: 1260, y: 0, width: 20, height: 720 },
  // Ceiling
  { x: 0, y: 0, width: 1280, height: 20 },
  // Mid-left platform
  { x: 100, y: 460, width: 180, height: 20 },
  // Mid-right platform
  { x: 1000, y: 460, width: 180, height: 20 },
  // High-left platform
  { x: 60, y: 280, width: 160, height: 20 },
  // High-right platform
  { x: 1060, y: 280, width: 160, height: 20 },
  // Center platform (high)
  { x: 520, y: 340, width: 240, height: 20 },
  // Center platform (mid)
  { x: 460, y: 500, width: 360, height: 20 },
];

// Phase 2 additions (appear during phase transition):
const PHASE_2_PLATFORMS: Platform[] = [
  // Small floating platforms mid-arena for chasing
  { x: 300, y: 380, width: 100, height: 16 },
  { x: 880, y: 380, width: 100, height: 16 },
];
```

**Boss Hover Points (pre-defined positions it teleports between):**

```typescript
const HOVER_POINTS: Vec2[] = [
  { x: 640, y: 180 },   // Top-center (default hover)
  { x: 200, y: 200 },   // Top-left
  { x: 1080, y: 200 },  // Top-right
  { x: 400, y: 350 },   // Mid-left
  { x: 880, y: 350 },   // Mid-right
];
```

### Phase 1 — Ink Beam (HP 24→16)

**Tests: Dash i-frames, lateral movement**

The Seraph hovers at the top of the arena and attacks with sweeping beams and page projectiles.

**Attack A — Ink Beam Sweep:**
1. **Telegraph (30 frames / 500ms):** A thin red line appears from the Seraph's position aimed at the player. The line thickens over the telegraph, and the Seraph's wings glow red. A rising audio-like visual pulse on the line.
2. **Fire (40 frames / 667ms):** The Seraph fires a wide beam (32px tall) that sweeps horizontally across the arena. The beam originates from the Seraph and rotates ~60° over its duration (sweeping from one side to the other). Deals 2 damage on contact. The player must dash through the beam (i-frames) or jump over/under it depending on sweep direction.
3. **Cooldown (25 frames / 417ms):** Seraph is momentarily idle. Can be hit with spear (if in range) or snap (if close enough).

The beam is rendered as a wide red/white energy line with particle trail, origin at the Seraph's center. It sweeps in one direction (alternating left-sweep and right-sweep).

**Attack B — Page Barrage:**
1. **Telegraph (20 frames / 333ms):** The Seraph's wings fan outward, pages visibly detaching.
2. **Barrage (60 frames / 1s):** 6-8 page fragments launch from the Seraph toward the player's last known position. Each page is 16×16, moves at 350 px/s, deals 1 damage. Pages fly in a spread pattern (±15° from center aim). Pages are destroyed on contact with platforms or arena boundaries.
3. **Stagger (40 frames / 667ms):** After the barrage, the Seraph descends slightly (drops 80px from its hover point) and is **stunned** — this is the **punish window**. The player must jump up to hit it (or use wall mechanics to reach it).
4. **Recover (20 frames / 333ms):** Returns to hover point.

**Attack C — Teleport Reposition:**
After every 2 attacks, the Seraph teleports to a different hover point. The teleport is instant but has visual tell:
1. **Fade (8 frames):** Current position fades out (alpha decreasing, afterimage particles).
2. **Appear (8 frames):** New position fades in.
3. **Invulnerable during teleport** (16 frames total).

**Phase 1 Attack Pattern:**
`Ink Beam (left-sweep) → Teleport → Page Barrage → Ink Beam (right-sweep) → Page Barrage → Teleport → ...`

**Punish opportunity:** After every Page Barrage (40-frame stagger window). The Seraph descends to ~280-350px Y, making it reachable from mid-height platforms. 3-4 spear hits per window = 3-4 damage. ~3 cycles to end Phase 1.

### Phase 2 — Corrupted Floor (HP 16→8)

**Tests: Wall mechanics, aerial positioning**

**Phase transition:** When HP hits 16, the Seraph screams (visual distortion pulse), dives to the center of the arena, and slams the ground — ink spreads across the entire ground floor. The ground becomes a **damage zone** (deals 1 damage per second on contact). Two additional floating platforms appear. The player must stay airborne using wall-jumps and platforms.

The corrupted floor is rendered as a pulsing red/black overlay on the ground platform. It persists for the entire phase.

**Attack A — Dive Slash:**
1. **Telegraph (25 frames):** The Seraph locks onto the player's position, a red crosshair appears on the player for 15 frames, then a red line traces the Seraph's dive path.
2. **Dive (12 frames / 200ms):** The Seraph dives in a straight line from its hover point toward where the player was when the telegraph started. Moves at 800 px/s. Body hitbox is active during dive (2 damage, strong knockback).
3. **Recovery (50 frames / 833ms):** The Seraph is stuck at the dive endpoint (wherever it stopped — it stops on first platform contact or arena boundary). This is the **punish window**. The body is on a platform, easily reachable.
4. **Ascend (20 frames):** Returns to a random hover point.

**Attack B — Ink Beam (upgraded):**
Same as Phase 1 but faster:
- Telegraph: 22 frames (was 30)
- Beam sweep: 30 frames (was 40), wider beam (40px, was 32)
- The beam can now sweep vertically as well as horizontally (alternates: horizontal sweep, then vertical sweep aimed at the player)

**Attack C — Page Storm:**
1. **Telegraph (15 frames):** All wings fan out, visual scatter effect.
2. **Storm (80 frames / 1.33s):** Pages launch in ALL directions — 12-16 pages total, spread radially (every ~25°). Each page moves at 300 px/s, deals 1 damage. Pages bounce off walls once (change direction on wall collision) before being destroyed. The player must find safe gaps between pages or dash through them.
3. **Stagger (35 frames):** Extended stagger, Seraph descends.

**Phase 2 Attack Pattern:**
`Dive Slash → Beam (horizontal) → Teleport → Page Storm → Dive Slash → Beam (vertical) → Teleport → ...`

**Punish opportunity:** Dive Slash recovery (50 frames, Seraph is on a platform). Page Storm stagger (35 frames, Seraph descends).

### Phase 3 — Desperation Print (HP 8→0)

**Tests: Everything — constant movement required**

**Phase transition:** At HP 8, the Seraph's form glitches — rapid visual flicker between normal and distorted. Ink splatters across the screen. The corrupted floor heals (ground is safe again). The Seraph's speed increases and it starts attacking more aggressively.

**Attack A — Triple Beam:**
Same as Ink Beam but fires 3 narrow beams (20px each) in a fan pattern simultaneously. Telegraph is only 18 frames. The 3 beams have ~30° spacing, creating narrow safe lanes. Player must position precisely or dash through.

**Attack B — Rapid Dive:**
Like Phase 2 Dive Slash but:
- Telegraph: 15 frames (was 25)
- Dive speed: 1000 px/s (was 800)
- Recovery: 30 frames (was 50) — shorter punish window
- Does 2 dives in sequence (dive → brief 10-frame hover → second dive aimed at new player position)

**Attack C — Page Barrage (rapid):**
Like Phase 1 Page Barrage but:
- 10-12 pages instead of 6-8
- Speed: 400 px/s (was 350)
- Stagger: 25 frames (was 40) — shorter window
- Pages home slightly toward player (5° per second tracking)

**Attack D — Desperation Slam:**
When HP drops to 4 or below:
1. **Telegraph (40 frames):** The Seraph rises to the top of the arena, gathers energy (all pages swirl inward, bright red glow).
2. **Slam (8 frames):** Dives to the center of the ground floor. Massive screen shake. Full-arena shockwave along the ground (60px tall, 500 px/s both directions). Plus 8 page fragments scatter radially.
3. **Collapse (70 frames / 1.17s):** The Seraph lies on the ground, completely vulnerable. Maximum punish window. If the player can deal the remaining HP, the fight ends.
4. **Ascend (30 frames):** Slowly rises back to top-center.

**Phase 3 Attack Pattern:**
`Triple Beam → Rapid Dive → Teleport → Page Barrage → Triple Beam → Teleport → Rapid Dive → Page Barrage → ...`
At HP ≤ 4: replaces next attack in sequence with Desperation Slam.

## File Structure

### Files to Create

1. **`src/engine/entities/bosses/MisprintSeraphParams.ts`** — All tunable params with defaults
2. **`src/engine/entities/bosses/MisprintSeraph.ts`** — Boss class with state machine, attacks, rendering

### Files to Modify

1. **`src/engine/entities/bosses/index.ts`** — Add exports for MisprintSeraph + params
2. **`src/app/test/boss/misprint-seraph/page.tsx`** — Full test page (replace stub)
3. **`src/lib/testStatus.ts`** — Update misprint-seraph status to `'in-progress'`

## Detailed Param Interface

```typescript
// src/engine/entities/bosses/MisprintSeraphParams.ts

export interface MisprintSeraphParams {
  // Health
  maxHealth: number;
  phase1Threshold: number;
  phase2Threshold: number;
  desperationThreshold: number;

  // Body
  bodyWidth: number;
  bodyHeight: number;
  wingSpan: number;

  // Hover / movement
  hoverBobSpeed: number;        // Sine wave speed for idle bob
  hoverBobAmplitude: number;    // Pixels of vertical bob
  teleportFadeDuration: number; // Frames for fade-out + fade-in (each)

  // Phase 1 — Ink Beam
  beamTelegraph: number;        // Frames
  beamDuration: number;         // Frames (sweep time)
  beamWidth: number;            // Pixel height of the beam
  beamSweepAngle: number;       // Degrees of sweep arc
  beamDamage: number;
  beamCooldown: number;

  // Phase 1 — Page Barrage
  barrageTelegraph: number;
  barrageDuration: number;
  barragePageCount: number;
  barragePageSpeed: number;
  barragePageSize: number;
  barragePageDamage: number;
  barrageSpreadAngle: number;   // Total spread in degrees
  barrageStagger: number;       // Punish window frames
  barrageStaggerDescent: number;// How far Seraph descends during stagger

  // Phase 2 — Dive Slash
  diveTelegraph: number;
  diveCrosshairDuration: number; // How long crosshair shows
  diveSpeed: number;             // px/s
  diveDamage: number;
  diveKnockback: number;
  diveRecovery: number;          // Punish window frames
  diveAscendDuration: number;

  // Phase 2 — Corrupted Floor
  corruptedFloorDamagePerSec: number;

  // Phase 2 — Page Storm
  stormTelegraph: number;
  stormPageCount: number;
  stormPageSpeed: number;
  stormPageDamage: number;
  stormPageBounces: number;     // How many wall bounces
  stormStagger: number;

  // Phase 3 — Triple Beam
  tripleBeamTelegraph: number;
  tripleBeamWidth: number;
  tripleBeamSpacing: number;    // Degrees between beams

  // Phase 3 — Rapid Dive
  rapidDiveTelegraph: number;
  rapidDiveSpeed: number;
  rapidDiveRecovery: number;
  rapidDiveCount: number;       // How many dives in sequence
  rapidDiveInterDelay: number;  // Frames between dives

  // Phase 3 — Rapid Barrage
  rapidBarragePageCount: number;
  rapidBarragePageSpeed: number;
  rapidBarrageStagger: number;
  rapidBarrageTracking: number; // Degrees per second of page homing

  // Phase 3 — Desperation Slam
  desperationTelegraph: number;
  desperationDiveSpeed: number;
  desperationSlam Damage: number;
  desperationShockwaveHeight: number;
  desperationShockwaveSpeed: number;
  desperationPageCount: number;
  desperationCollapse: number;  // Punish window frames
  desperationAscend: number;

  // General
  phaseTransitionDuration: number;
  invulnBetweenAttacks: number;
  bossShakeOnHit: number;
  bossShakeFrames: number;
}

export const DEFAULT_MISPRINT_SERAPH_PARAMS: MisprintSeraphParams = {
  maxHealth: 24,
  phase1Threshold: 16,
  phase2Threshold: 8,
  desperationThreshold: 4,

  bodyWidth: 96,
  bodyHeight: 120,
  wingSpan: 200,

  hoverBobSpeed: 0.03,
  hoverBobAmplitude: 8,
  teleportFadeDuration: 8,

  // Phase 1 — Ink Beam
  beamTelegraph: 30,
  beamDuration: 40,
  beamWidth: 32,
  beamSweepAngle: 60,
  beamDamage: 2,
  beamCooldown: 25,

  // Phase 1 — Page Barrage
  barrageTelegraph: 20,
  barrageDuration: 60,
  barragePageCount: 7,
  barragePageSpeed: 350,
  barragePageSize: 16,
  barragePageDamage: 1,
  barrageSpreadAngle: 30,
  barrageStagger: 40,
  barrageStaggerDescent: 80,

  // Phase 2 — Dive Slash
  diveTelegraph: 25,
  diveCrosshairDuration: 15,
  diveSpeed: 800,
  diveDamage: 2,
  diveKnockback: 450,
  diveRecovery: 50,
  diveAscendDuration: 20,

  // Phase 2 — Corrupted Floor
  corruptedFloorDamagePerSec: 1,

  // Phase 2 — Page Storm
  stormTelegraph: 15,
  stormPageCount: 14,
  stormPageSpeed: 300,
  stormPageDamage: 1,
  stormPageBounces: 1,
  stormStagger: 35,

  // Phase 3 — Triple Beam
  tripleBeamTelegraph: 18,
  tripleBeamWidth: 20,
  tripleBeamSpacing: 30,

  // Phase 3 — Rapid Dive
  rapidDiveTelegraph: 15,
  rapidDiveSpeed: 1000,
  rapidDiveRecovery: 30,
  rapidDiveCount: 2,
  rapidDiveInterDelay: 10,

  // Phase 3 — Rapid Barrage
  rapidBarragePageCount: 11,
  rapidBarragePageSpeed: 400,
  rapidBarrageStagger: 25,
  rapidBarrageTracking: 5,

  // Phase 3 — Desperation Slam
  desperationTelegraph: 40,
  desperationDiveSpeed: 1200,
  desperationSlamDamage: 3,
  desperationShockwaveHeight: 60,
  desperationShockwaveSpeed: 500,
  desperationPageCount: 8,
  desperationCollapse: 70,
  desperationAscend: 30,

  // General
  phaseTransitionDuration: 100,
  invulnBetweenAttacks: 20,
  bossShakeOnHit: 3,
  bossShakeFrames: 4,
};
```

**Note:** Fix the space in `desperationSlam Damage` — it should be `desperationSlamDamage` in the actual code. The param listing above is the spec.

## MisprintSeraph Class Structure

Follow the same structural pattern as `FootnoteGiant`:

```typescript
export class MisprintSeraph {
  params: MisprintSeraphParams;

  // Health
  health: number;
  maxHealth: number;
  currentPhase: 1 | 2 | 3;
  isAlive: boolean;
  invincibilityFrames: number;
  totalDamageReceived: number;

  // Position (mobile — NOT fixed like Footnote Giant)
  position: Vec2;         // Current world position (top-left of body)
  targetHoverPoint: Vec2; // Which hover point we're at or moving to
  hoverPointIndex: number;
  size: Vec2;

  // State machine
  stateMachine: StateMachine<MisprintSeraph>;
  stateTimer: number;

  // Attack sequencer
  attackSequence: string[];
  sequenceIndex: number;
  currentAttack: string | null;

  // Sub-entities
  pages: PageProjectile[];       // Active page projectiles
  beamAngle: number;             // Current beam rotation
  beamTargetAngle: number;       // Target beam rotation
  beamActive: boolean;
  beamOrigin: Vec2;              // Beam start point
  divePath: { start: Vec2; end: Vec2 } | null;
  diveProgress: number;

  // Phase state
  corruptedFloorActive: boolean;
  phase2PlatformsVisible: boolean;

  // Teleport state
  teleportAlpha: number;         // 0 = invisible, 1 = fully visible
  teleportFromPoint: Vec2 | null;
  teleportToPoint: Vec2 | null;

  // Visual state
  hitFlashTimer: number;
  phaseTransitionTimer: number;
  wingFlutter: number;           // Animation counter for wing flutter
  bodyShakeOffset: Vec2;
  deathTimer: number;
  frameCounter: number;
  hitstopTimer: number;

  // Systems
  particleSystem: ParticleSystem | null;
  screenShake: ScreenShake | null;
  camera: Camera | null;

  // Player tracking
  private playerPosition: Vec2;

  constructor(position: Vec2, params?: Partial<MisprintSeraphParams>);

  // Vulnerability — same pattern as Footnote Giant
  isVulnerable(): boolean;
  // Vulnerable during: BARRAGE_STAGGER, DIVE_RECOVERY, STORM_STAGGER, DESPERATION_COLLAPSE

  takeDamage(damage: number, hitstopFrames: number): boolean;
  checkPhaseTransition(): void;

  update(dt: number, playerBounds: Rect, playerPosition: Vec2): void;
  render(ctx: CanvasRenderingContext2D, camera: Camera): void;

  // Hazard zones for player collision
  getActiveHazards(): DamageZone[];

  getBounds(): Rect;
  getBodyCenter(): Vec2;

  // Reset for retry
  reset(position: Vec2): void;
}
```

### State Machine States

```typescript
type MisprintSeraphState =
  | "IDLE"                    // Hovering, between attacks
  | "TELEPORT_OUT"            // Fading out to new position
  | "TELEPORT_IN"             // Fading in at new position
  | "BEAM_TELEGRAPH"          // Aiming beam
  | "BEAM_FIRE"               // Sweeping beam active
  | "BEAM_COOLDOWN"           // Brief post-beam idle
  | "BARRAGE_TELEGRAPH"       // Wings fanning
  | "BARRAGE_FIRE"            // Pages launching
  | "BARRAGE_STAGGER"         // PUNISH WINDOW — descended, stunned
  | "BARRAGE_RECOVER"         // Ascending back
  | "DIVE_TELEGRAPH"          // Crosshair on player
  | "DIVE_ATTACK"             // Diving toward target
  | "DIVE_RECOVERY"           // PUNISH WINDOW — stuck on surface
  | "DIVE_ASCEND"             // Rising back to hover point
  | "STORM_TELEGRAPH"         // Wings fan out
  | "STORM_FIRE"              // Pages launching radially
  | "STORM_STAGGER"           // PUNISH WINDOW
  | "STORM_RECOVER"           // Ascending back
  | "TRIPLE_BEAM_TELEGRAPH"   // Phase 3: 3 beam aims
  | "TRIPLE_BEAM_FIRE"        // Phase 3: 3 beams sweep
  | "RAPID_DIVE_TELEGRAPH"    // Phase 3: quick crosshair
  | "RAPID_DIVE_ATTACK"       // Phase 3: fast dive
  | "RAPID_DIVE_INTER"        // Phase 3: pause between dives
  | "DESPERATION_TELEGRAPH"   // Phase 3: rising + gathering
  | "DESPERATION_SLAM"        // Phase 3: diving to ground
  | "DESPERATION_COLLAPSE"    // PUNISH WINDOW — max opening
  | "DESPERATION_ASCEND"      // Rising slowly
  | "PHASE_TRANSITION"        // Between phases
  | "DYING"                   // Death animation
  | "DEAD";                   // Fight over
```

### Attack Sequences

```typescript
const PHASE_1_SEQUENCE = [
  "ink-beam-left",
  "teleport",
  "page-barrage",
  "ink-beam-right",
  "page-barrage",
  "teleport",
];

const PHASE_2_SEQUENCE = [
  "dive-slash",
  "beam-horizontal",
  "teleport",
  "page-storm",
  "dive-slash",
  "beam-vertical",
  "teleport",
];

const PHASE_3_SEQUENCE = [
  "triple-beam",
  "rapid-dive",
  "teleport",
  "rapid-barrage",
  "triple-beam",
  "teleport",
  "rapid-dive",
  "rapid-barrage",
];
// At HP ≤ desperationThreshold, next attack becomes "desperation-slam"
```

### PageProjectile Sub-entity

```typescript
interface PageProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  damage: number;
  rotation: number;       // Visual rotation (radians)
  rotationSpeed: number;  // Visual spin speed
  bouncesRemaining: number;
  trackingRate: number;   // Degrees/sec toward player (0 = no tracking)
  active: boolean;
}
```

Pages are rendered as small rotated squares with a slight paper texture (thin outline, slightly off-white fill with a red misprint mark).

### DamageZone type extension

The `DamageZone` type in `FootnoteGiant.ts` needs to be shared. Either:
- Move the `DamageZone` interface to `src/engine/entities/bosses/types.ts` (new file), OR
- Re-export it from the bosses index

Preferred: create `src/engine/entities/bosses/types.ts` with the shared `DamageZone` interface, and update FootnoteGiant to import from there. Update bosses `index.ts` to export from `types.ts`.

```typescript
// src/engine/entities/bosses/types.ts
import type { Rect, Vec2 } from "@/lib/types";

export interface DamageZone {
  rect: Rect;
  damage: number;
  knockback: Vec2;
  type: "slam" | "shockwave" | "ink-blot" | "stamp" | "sweep"
      | "beam" | "page" | "dive" | "floor";  // Add new types
}
```

Then update `FootnoteGiant.ts` to import `DamageZone` from `./types` instead of defining it inline. Update `index.ts` to export `DamageZone` from `types.ts`.

## Rendering Details

### Boss Body Rendering
- **Body:** A rounded rectangle (96×120) filled with a gradient from near-white to light gray. Contains 4-5 scrambled glyph characters (?, !, ¿, ¡, «) vertically stacked, rendered in red (`#ef4444`) at varying sizes (20-28px). Glyphs should have slight random offsets (misprint feel — each glyph has ±2px random jitter).
- **Wings:** Two triangular shapes on each side of the body. Each wing is a semi-transparent polygon (3 points: body edge top, body edge mid, and a point extending outward). Fill with `rgba(248, 250, 252, 0.4)`. Draw faint horizontal lines across wings (like text lines on a page). Wings flutter: oscillate their outer point vertically using a sine wave.
- **Halo:** A thin ring above the head (radius ~30px) rendered as a dashed circle in red at low alpha. The dash offset rotates slowly (spinning halo effect).
- **Damage flash:** On hit, fill entire body with white for 4 frames (same as Footnote Giant).
- **Phase 2/3 visual changes:** At Phase 2, add red pulsing glow around body. At Phase 3, wings become jagged (add extra vertices to wing polygon) and glyph flicker intensifies.

### Beam Rendering
- Draw a line from the Seraph's center to the arena boundary at the current beam angle.
- During telegraph: thin red dashed line (2px), pulsing alpha.
- During fire: thick beam (beamWidth px), gradient fill from white (center) to red (edges), with particle trail.
- Beam clips to arena bounds.

### Page Projectile Rendering
- Small square (pageSize × pageSize) rotated by `rotation`.
- Fill: `#f1f5f9` (very light gray). Stroke: `#ef4444` (red, 1px).
- A small red mark/squiggle in the center (random position, draw a 3-4px line).
- Rotate over time for tumbling effect.

### Dive Rendering
- During telegraph: red crosshair at target position (two crossing 20px lines). Then a red dashed line from Seraph to crosshair.
- During dive: Seraph body stretches slightly in dive direction. Speed lines (particle trails) behind it. Red afterimage at start position.
- During recovery: Seraph sits on surface with wings folded, "stunned" visual (stars/glyphs circling head — draw 3-4 small symbols in a circle, rotating).

### Corrupted Floor (Phase 2)
- Overlay the ground platform with a pulsing red-black gradient.
- Render as: draw the ground normally, then overlay a rectangle with `rgba(220, 38, 38, 0.3)` that pulses between 0.2 and 0.4 alpha using a sine wave.
- Faint upward-drifting red particles from the floor (2-3 per second).

### Health Bar
- Render at the bottom-center of the canvas (screen space, not world space).
- Background: dark gray bar, 400px wide, 12px tall.
- Fill: white/red gradient. Phase 1 = white, Phase 2 = light red, Phase 3 = bright red.
- Below the bar: boss name "MISPRINT SERAPH" in small text.
- Phase indicator dots: 3 dots, filled based on current phase.

### Death Animation
- Duration: 120 frames.
- The Seraph freezes, then body starts fragmenting — pages peel off and drift away (spawn 20-30 page particles with random outward velocity and slow gravity).
- Glyphs scatter individually.
- Wings dissolve (alpha fading from tips inward).
- Bright flash at frame 60.
- At completion: body fully dissolved, only a few drifting page particles remain.

## Test Page Structure

Follow the exact pattern of `/test/boss/footnote-giant/page.tsx`:

```
'use client'
imports...

// Arena constants
// Floating damage number helpers
// Attack direction helper
// Arena setup function (platforms, phase2 platforms)

export default function MisprintSeraphTest() {
  // Refs: engine, player, boss, combat, health, particles, screenShake, input, camera, tileMap
  // State: debug overlays, params, fight started, fight over, retry

  // Engine setup callback (from GameCanvas)
  const onEngineReady = useCallback((engine, canvas) => {
    // Create all systems
    // Create boss at top-center hover point
    // Wire engine.onUpdate:
    //   - player.update, collision, surface
    //   - boss.update(dt, playerBounds, playerPos)
    //   - combat.update(input, playerPos, facingRight, direction)
    //   - Hit detection: combat hitboxes vs boss bounds
    //   - Boss hazards vs player bounds (with PlayerHealth)
    //   - Corrupted floor damage check (Phase 2)
    //   - Respawn logic
    // Wire engine.onRender:
    //   - Background (dark, slightly purple-tinted for Seraph theme)
    //   - Corrupted floor overlay (Phase 2)
    //   - Platforms
    //   - Boss (boss.render)
    //   - Player
    //   - Combat hitboxes
    //   - Floating damage numbers
    //   - Health bar HUD (boss)
    //   - Player health hearts
    //   - Debug overlays
    //   - Particles
  }, []);

  return (
    <div className="flex h-screen bg-gray-950">
      <div className="flex-1 flex items-center justify-center">
        <GameCanvas onEngineReady={onEngineReady} width={960} height={720} />
      </div>
      <DebugPanel>
        {/* Boss Info section */}
        {/* Boss Params section with sliders */}
        {/* Player/Combat section */}
        {/* Fight Controls: Start, Retry, Skip to Phase 2/3 */}
        {/* Pass Criteria checklist */}
      </DebugPanel>
    </div>
  );
}
```

**Canvas size: 960×720** (taller than standard 960×540 to fit the vertical arena). The arena is 1280×720, so camera scrolls horizontally.

**Camera:** Follows player with `setBounds({ x: 0, y: 0, width: 1280, height: 720 })`. Standard smooth follow.

## Debug Panel Sections

1. **Boss Info** (always visible, read-only):
   - Phase: 1 / 2 / 3
   - State: current state machine state
   - HP: X / 24
   - Hover Point: index
   - Attack: current attack name
   - Corrupted Floor: active / inactive
   - Invulnerable: yes/no

2. **Boss Params** (collapsed):
   Key params with sliders:
   | Parameter | Min | Max | Step | Default |
   |-----------|-----|-----|------|---------|
   | Max Health | 6 | 48 | 2 | 24 |
   | Phase 1 Threshold | 4 | 40 | 2 | 16 |
   | Phase 2 Threshold | 2 | 30 | 2 | 8 |
   | Beam Telegraph | 10 | 60 | 5 | 30 |
   | Beam Duration | 20 | 80 | 5 | 40 |
   | Beam Width | 16 | 64 | 4 | 32 |
   | Beam Damage | 1 | 5 | 1 | 2 |
   | Barrage Page Count | 3 | 15 | 1 | 7 |
   | Barrage Stagger | 15 | 80 | 5 | 40 |
   | Dive Speed | 400 | 1400 | 100 | 800 |
   | Dive Recovery | 20 | 80 | 5 | 50 |
   | Storm Page Count | 6 | 24 | 2 | 14 |
   | Desperation Collapse | 30 | 120 | 10 | 70 |

3. **Fight Controls** (expanded):
   - "Start Fight" button (boss begins attack sequence)
   - "Retry" button (reset boss and player)
   - "Skip to Phase 2" button
   - "Skip to Phase 3" button
   - "Toggle AI" checkbox (disable boss attacks for exploration)
   - "Godmode" checkbox (player takes no damage)

4. **Player/Combat** (collapsed):
   - Standard player state, velocity, position
   - Weapon type, attack phase
   - Player HP

5. **Pass Criteria** (collapsed):
   Checklist displayed at bottom.

## Pass Criteria

1. Boss hovers at defined hover points with gentle bobbing animation
2. Boss teleports between hover points with fade-out/fade-in visual
3. Ink Beam: telegraph line appears aimed at player, then beam sweeps across arena
4. Beam damage: player takes 2 damage when hit by beam
5. Beam dodge: player can dash through beam using i-frames
6. Page Barrage: pages launch toward player's position in a spread pattern
7. Pages deal 1 damage on contact and are destroyed on platform collision
8. Barrage Stagger: boss descends and is stunnable after barrage
9. Player can hit boss during stagger window with spear or snap
10. Phase 2 transition: boss dives, floor corrupts, additional platforms appear
11. Corrupted floor deals damage to player standing on ground
12. Dive Slash: crosshair appears, boss dives toward player position, recovery is punish window
13. Page Storm: radial page spread, pages bounce off walls once
14. Phase 3 transition: floor heals, boss speeds up visually
15. Triple Beam: 3 beams in fan pattern fire simultaneously
16. Rapid Dive: 2 consecutive dives with brief pause between
17. Desperation Slam (HP ≤ 4): boss rises, gathers energy, slams ground with shockwave + pages, long collapse window
18. Boss death animation: fragment into pages, glyph scatter, wing dissolve
19. Health bar HUD shows boss HP accurately with phase indicators
20. All boss params tunable via debug sliders
21. Retry button resets fight cleanly
22. "Skip to Phase" buttons work correctly
23. FPS stays at ~60 with all visual effects active
24. No regressions to movement or combat systems

## Verification

- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build` succeeds
- [ ] Navigate to `/test/boss/misprint-seraph` — canvas renders arena with hovering boss
- [ ] Boss hovers with gentle bobbing, teleports between hover points
- [ ] Phase 1: Ink Beam sweeps across arena, Pages launch toward player
- [ ] Player can dash through beam (i-frames protect from damage)
- [ ] Barrage stagger allows 3-4 hits on descended boss
- [ ] Phase 2: Floor corrupts (visual + damage), dive slash tracks and punishes, page storm with bouncing pages
- [ ] Phase 3: Triple beam, rapid dive sequences, desperation slam at low HP
- [ ] Death animation plays on boss defeat (page fragment scatter)
- [ ] Health bar, floating damage numbers, and debug overlays all render correctly
- [ ] Retry resets boss HP, position, phase, and player position
- [ ] All params tunable via sliders
- [ ] TypeScript strict, no build errors

## Important Implementation Notes

1. **Follow the FootnoteGiant pattern exactly** for class structure: `StateMachine` with enter/update/exit hooks, `stateTimer` for frame counting, `attackSequence` array with `sequenceIndex` cycling, `getActiveHazards()` returning `DamageZone[]`, `takeDamage()` checking `isVulnerable()`, `render()` drawing all visual elements.

2. **The Seraph is MOBILE.** Unlike the Footnote Giant (fixed position), the Seraph's `position` changes. Hover points are target positions — the Seraph smoothly interpolates to them during teleport. The `position` field is always the current rendering position.

3. **Beam collision is line-rectangle intersection.** For the beam, check if the beam line (from origin to endpoint at beam angle) intersects the player's bounding box. The beam has width, so it's actually a rotated rectangle. A simplified approach: for each frame of the sweep, compute the beam as a series of connected rectangles along the sweep arc, and check AABB overlap with the player. OR: use the angle and check if the player's center is within `beamWidth/2` distance of the beam line. The latter is cleaner and more accurate.

4. **Page projectiles update independently.** Each frame, update all active pages: move by velocity, check collision with platforms (destroy on hit), check collision with player (damage + destroy), handle bouncing (reverse velocity component on wall hit), apply homing if tracking > 0 (rotate velocity toward player by tracking degrees/sec). Remove inactive pages.

5. **Teleport hover point selection.** When the boss teleports, pick a hover point that is NOT the current one. Prefer points that are far from the player (to give the player a brief respite). Simple algorithm: filter out current point, sort remaining by distance from player (descending), pick the furthest or second-furthest.

6. **Corrupted floor damage in the test page.** The corrupted floor is not a boss DamageZone (it's continuous, not per-frame). The test page handles it: each frame during Phase 2, check if the player is touching the ground platform. If so, accumulate a damage timer (`floorDamageAccumulator += dt`). When it reaches `1.0 / corruptedFloorDamagePerSec`, deal 1 damage and reset. This matches the "1 damage per second" spec.

7. **Canvas height 720.** The `GameCanvas` component must support a non-standard height. Check that `GameCanvas` accepts `width` and `height` props. The CANVAS_HEIGHT constant in `constants.ts` is 540, but the test page passes 720 directly to the canvas element and camera setup.

8. **Beam rendering with canvas rotation.** The beam is a rotated rectangle. Use `ctx.save()`, `ctx.translate(origin.x, origin.y)`, `ctx.rotate(beamAngle)`, then draw a rectangle from (0, -beamWidth/2) to (beamLength, beamWidth/2). Use `ctx.restore()` after.

9. **Wing flutter animation.** Use `Math.sin(frameCounter * 0.08) * 12` for wing tip oscillation. Each wing has 3 vertices: (bodyEdge.x, bodyTop.y), (bodyEdge.x, bodyMid.y), (bodyEdge.x ± wingExtent, bodyMid.y + flutter). Draw as filled polygon with stroke.

10. **Health bar is screen-space.** Render after resetting camera transform. Position at bottom-center: `x = canvasWidth/2 - 200, y = canvasHeight - 40`. The health bar should only appear after the fight starts.

11. **Boss starts in IDLE state, not attacking.** The fight begins when the player presses the "Start Fight" button or enters a trigger zone near the center of the arena. Before that, the boss hovers but doesn't attack (`aiEnabled = false`).

12. **Sound effects are visual-only for now.** Since there's no audio system, represent "impact" moments with screen shake + particles. Beam fire = small shake. Dive impact = medium shake. Desperation slam = large shake (same values as Footnote Giant's slam).

---

## Implementation Summary

### Files Created
1. **`src/engine/entities/bosses/types.ts`** — Shared `DamageZone` interface with extended type union including `beam`, `page`, `dive`, `floor` types
2. **`src/engine/entities/bosses/MisprintSeraphParams.ts`** — Full params interface with 60+ tunable parameters and defaults for all 3 phases
3. **`src/engine/entities/bosses/MisprintSeraph.ts`** — Complete boss class (~900 lines) with:
   - Full state machine: IDLE, TELEPORT_OUT/IN, BEAM_TELEGRAPH/FIRE/COOLDOWN, BARRAGE_TELEGRAPH/FIRE/STAGGER/RECOVER, DIVE_TELEGRAPH/ATTACK/RECOVERY/ASCEND, RAPID_DIVE_INTER, STORM_TELEGRAPH/FIRE/STAGGER/RECOVER, TRIPLE_BEAM_TELEGRAPH/FIRE, DESPERATION_TELEGRAPH/SLAM/COLLAPSE/ASCEND, PHASE_TRANSITION, DYING, DEAD
   - All 3 phases with distinct attack sequences
   - Mobile boss with hover point teleportation
   - Ink beam sweep with rotated beam rendering and segmented AABB collision
   - Page projectiles with bounce, tracking, and rotation
   - Dive slash with crosshair telegraph and recovery punish window
   - Desperation slam with ground shockwaves + radial page scatter
   - Corrupted floor (Phase 2) with damage zone rendering
   - Vulnerability system: only hittable during stagger/recovery/collapse states
   - Full rendering: body with glyphs, semi-transparent wings with flutter, spinning halo, beam gradients, page projectiles, stagger indicators, dive crosshairs, desperation swirl
   - Health bar HUD with phase markers and phase indicator dots
   - Debug overlays: hitboxes, hover point markers, state labels
   - Reset and skip-to-phase support

### Files Modified
4. **`src/engine/entities/bosses/FootnoteGiant.ts`** — Removed inline `DamageZone` definition, now imports from `./types`
5. **`src/engine/entities/bosses/index.ts`** — Added exports for MisprintSeraph, MisprintSeraphParams, and DamageZone from types.ts
6. **`src/engine/entities/index.ts`** — Updated DamageZone re-export to point at `./bosses/types` instead of `./bosses/FootnoteGiant`
7. **`src/app/test/boss/misprint-seraph/page.tsx`** — Full test page replacing the stub, with:
   - 1280×720 vertical arena (taller than Footnote Giant's arena)
   - 10 platforms + 2 Phase 2 floating platforms
   - Dark purple-tinted background for Seraph theme
   - Full player + combat + boss wiring following FootnoteGiant pattern exactly
   - Corrupted floor damage accumulator logic
   - Page deactivation on player hit
   - Debug panel with Boss Info, slider sections for all key params, fight controls (Start, Retry, Skip to Phase 2/3, AI toggle, Godmode, Overlays)
   - Health bar rendered at bottom-center in screen space (only after fight starts)
   - Canvas size 960×720 (non-standard height passed to GameCanvas)
8. **`src/lib/testStatus.ts`** — Updated Misprint Seraph status to `in-progress`

### Verification
- `npx tsc --noEmit` passes with zero errors
- `npm run build` succeeds with `/test/boss/misprint-seraph` route compiled

---

## Review Notes (reviewer: 8d9424ca)

### Issues Found & Fixed

1. **Bug: Rapid Barrage used Phase 1 params instead of Phase 3 params** (`MisprintSeraph.ts` BARRAGE_FIRE state)
   - `rapid-barrage` attack routed to the same `BARRAGE_FIRE` / `BARRAGE_STAGGER` states as the Phase 1 `page-barrage`, but used `barragePageCount` (7), `barragePageSpeed` (350), zero tracking, and `barrageStagger` (40) instead of `rapidBarragePageCount` (11), `rapidBarragePageSpeed` (400), `rapidBarrageTracking` (5°/s homing), and `rapidBarrageStagger` (25). Fixed by checking `currentAttack === "rapid-barrage"` and using the correct params in both states.

2. **Bug: Dive telegraph crosshair tracking used wrong duration in Phase 3** (`MisprintSeraph.ts` DIVE_TELEGRAPH update)
   - The crosshair tracking condition compared `stateTimer` against `diveTelegraph` (25) even in Phase 3, where the actual telegraph duration is `rapidDiveTelegraph` (15). Fixed by computing `tel` from `currentPhase` to match the enter method.

3. **Missing exports: `entities/index.ts` didn't re-export MisprintSeraph**
   - `FootnoteGiant` was exported from `entities/index.ts` but `MisprintSeraph` and its params were not. Fixed by adding the exports for consistency.

### Verified After Fixes
- `npx tsc --noEmit` passes clean
- `npm run build` succeeds, `/test/boss/misprint-seraph` route compiled

### Code Quality Notes (no fixes needed)
- Params file is clean — all 60+ params properly typed, no `any`, no `desperationSlam Damage` space bug from the spec
- DamageZone properly extracted to `bosses/types.ts`, FootnoteGiant updated to import from there
- State machine covers all 24+ states with proper enter/update lifecycle hooks
- Beam collision uses segmented AABB approximation (8 segments) — reasonable trade-off
- Page projectile homing, bouncing, and cleanup all frame-rate safe (uses `dt` correctly)
- Hover bob correctly limited to non-movement states
- Test page follows established patterns, proper cleanup on unmount
- Phase 2 platforms included in tilemap from the start (collision always works), just hidden visually until Phase 2
