INKBINDERS: The Library That Fights Back

You're a junior archivist in a living library-city. Every "book" is a biome. The library is under a nightly corruption that rewrites rooms, flips symbols, and splices pages together.

Design pillars (in priority order):
	1.	Movement feel first — the character must feel impossibly good to control. Every jump, dash, and landing should feel tight, responsive, and satisfying before a single enemy or puzzle is added.
	2.	Editing as progression — you don't unlock movement, you unlock the power to rewrite the world.
	3.	Cozy-by-day / chaos-by-night — tension loop that drives pacing and retention.

Trend hooks (done with a new angle):
	•	Cozy/chaos contrast (players love this tension loop lately).
	•	Indies leaning into big sequel energy + recognizable genre comfort, but with a twist (people still want metroidvanias, just not carbon copies).

⸻

Development philosophy — test pages for everything

Every feature gets its own dedicated page before it touches the real game. A test page is a standalone route (`/test/[feature]`) that isolates one system, gives you knobs to tweak it, and proves it works. Nothing ships into the game world until it passes its test page.

Rules:
	•	One feature, one page. Don't combine systems on a test page — that's what the game is for.
	•	Every page gets visible debug info: frame times, state labels, velocity readouts, hitbox overlays — whatever matters for that system.
	•	Every tunable value is exposed as a slider or input, not buried in code. Change gravity, dash distance, coyote frames, etc. in real time.
	•	Test pages are permanent. They don't get deleted after the feature ships — they're your regression suite and your tuning dashboard forever.

Test page index (`/test`):
	A hub page that links to every individual test page with a status indicator (not started / in progress / passing). This is the project's real progress tracker.

⸻

Feature 1: Ground movement

The foundation everything else is built on.

Ground movement spec:
	•	Variable-speed run with smooth acceleration/deceleration curves (not linear). Ramp-up should feel instant but not teleport-y; ramp-down should have a tiny satisfying slide.
	•	Turn-around has a single-frame snap with a subtle dust puff — no sluggish pivot, no ice-skating.
	•	Crouching is a fast squash that preserves momentum: crouch while running to slide under gaps.

TEST PAGE: `/test/ground-movement`
	•	Flat ground with distance markers. No platforms, no walls, no enemies.
	•	Character runs left/right. Debug overlay shows: current velocity, acceleration curve visualization, current state (idle / accelerating / max speed / decelerating / turning / crouching / sliding).
	•	Sliders for: acceleration rate, deceleration rate, max run speed, turn snap speed, crouch-slide friction, crouch-slide duration.
	•	A few gap obstacles to test crouch-sliding under things at different heights.
	•	Pass criteria: moving around this flat room feels good for 60 seconds with zero abilities.

⸻

Feature 2: Jumping and air control

TEST PAGE: `/test/jumping`
	•	A room with platforms at various heights and gaps at various widths.
	•	Debug overlay shows: jump hold duration, current gravity, apex detection (flash when at apex), coyote time window (highlight when active), input buffer window (highlight when queued), air velocity vector.
	•	Sliders for: jump force, gravity (rise), gravity (fall), apex float duration, apex float gravity multiplier, coyote time frames, input buffer frames, air control strength, momentum bias factor.
	•	Visual markers on platforms showing required jump precision.
	•	Pass criteria: variable-height jump feels like Celeste-tier gravity — fast rise, a beat of float at the apex, crisp fall. Coyote time and input buffering feel generous but not sloppy.

Jumping spec:
	•	Variable-height jump (short tap = hop, hold = full arc). Fast rise, beat of float at the apex, crisp fall.
	•	Generous coyote time (6–8 frames after leaving a ledge, you can still jump).
	•	Input buffering (queue a jump input 4–6 frames before landing and it fires on contact).
	•	Full air control with slight momentum bias — you can redirect mid-air but your launch direction still matters. No floaty indecision.

⸻

Feature 3: Wall mechanics

TEST PAGE: `/test/wall-mechanics`
	•	A vertical shaft with walls on both sides, platforms at various heights, and gaps that require wall-jump chains.
	•	Debug overlay shows: wall contact state, slide friction value, grip state, wall-jump launch angle, input lockout timer, vertical velocity.
	•	Sliders for: wall-slide base friction, wall-grip friction multiplier, wall-jump launch angle, wall-jump force, wall-jump input lockout duration.
	•	Sections of the test room: simple wall-slide descent, wall-jump climb, alternating wall-jump ascent, wall-jump to platform landing.
	•	Pass criteria: wall-slide feels graduated (touch = slow, hold = grip). Wall-jump feels punchy with just enough lockout. Chaining wall-jumps up a shaft feels rhythmic.

Wall mechanics spec:
	•	Wall-slide with graduated friction: touch a wall and you slow, hold toward it and you grip.
	•	Wall-jump launches at a fixed angle with a brief input lockout (just enough to feel punchy, not enough to feel stiff).

⸻

Feature 4: Dash

TEST PAGE: `/test/dash`
	•	An open room with obstacles requiring precise dash distances and 8 directional targets.
	•	Debug overlay shows: dash direction, dash distance traveled, i-frame window, cooldown timer, post-dash velocity, dash state (wind-up / dashing / recovery), cancel window.
	•	Sliders for: dash distance, dash duration, wind-up frames, i-frame duration, cooldown duration, ground speed boost on dash-into-run, dash-cancel window.
	•	Obstacle courses: dash through a gap with i-frames, dash-cancel into jump, chain dash→run→jump for max distance, dash from wall-slide, dash from mid-air.
	•	Pass criteria: 8-directional dash feels snappy (1–2 frame wind-up). Dash-cancel out of any action feels like an "oh no" button. Chaining dashes into runs into jumps feels like flowing water.

Dash spec:
	•	Unlocked early (first 10 minutes). 8-directional, snappy startup (1–2 frame wind-up), fixed distance, brief invulnerability.
	•	Dash-cancel out of almost any action.
	•	On the ground, dash preserves a speed boost into your run if you keep holding forward.
	•	Cooldown is short enough to never feel punishing, long enough that spamming is slightly worse than timing.

⸻

Feature 5: Landing and transitions

TEST PAGE: `/test/transitions`
	•	A room with platforms at increasing heights (normal drop, medium drop, extreme drop) and direction-hold recovery zones.
	•	Debug overlay shows: fall distance, fall duration, current transition (labeled: run→jump, jump→wall-slide, wall-slide→wall-jump, dash→fall, etc.), landing type (soft / hard), recovery state, squash-stretch scale.
	•	Sliders for: hard landing threshold height, recovery roll duration, squash intensity, screen nudge intensity.
	•	The real test: a gauntlet that forces every state transition in sequence — run, jump, wall-slide, wall-jump, dash, fall, land, crouch-slide — with no pause. If the player ever feels a "seam" between two states, that's a bug.
	•	Pass criteria: no hard landing stun from normal heights. Every state transition is seamless. The gauntlet can be completed at full speed without any hitch.

Transitions spec:
	•	No hard landing stun from normal heights. Soft squash-and-stretch, tiny screen nudge, keep moving.
	•	Hard landings only from extreme heights — fast recovery roll if holding a direction.
	•	Every state transition (run→jump, jump→wall-slide, wall-slide→wall-jump, dash→fall) must be seamless. If the player feels a "seam", that's a bug.

⸻

Feature 6: Full movement integration

TEST PAGE: `/test/movement-playground`
	•	The "empty room test" — a playground with varied geometry (platforms, walls, gaps, shafts, slopes) but zero enemies, zero abilities, zero story.
	•	All debug overlays from previous test pages available via toggle.
	•	A timer and ghost replay so you can run the same route twice and compare feel.
	•	This is the "movement milestone" page: moving around this room with just platforms should feel fun for 5 minutes.
	•	Pass criteria: you open this page, you play for 5 minutes, and you don't want to stop. If you do want to stop, go back to the individual test pages and tune.

The golden rule: the player should feel like the character is an extension of their thumb. Laggy, floaty, or unresponsive movement is a ship-blocker, not a polish task.

⸻

Feature 7: Margin Stitch (Re-route ability)

Place a "stitch" between two nearby doorframes/walls to create a temporary passage. It's the "double jump equivalent", but spatial.

TEST PAGE: `/test/margin-stitch`
	•	A room with wall pairs at various distances and orientations. No enemies.
	•	Debug overlay shows: stitch placement targets (highlighted when in range), stitch active duration timer, passage hitbox, activation source state (ground / air / mid-dash).
	•	Sliders for: max stitch range, stitch duration, placement speed, cooldown.
	•	Scenarios: stitch from the ground, stitch mid-air, stitch mid-dash (momentum should never be interrupted). A sequence of platforms only reachable via stitching.
	•	Pass criteria: activation is instant from any state. Placing a stitch and immediately moving through it feels like one fluid action.

⸻

Feature 8: Redaction (Selective erase ability)

Erase one type of obstacle in a room for a short time (e.g., spikes become safe ink puddles; laser glyphs go dark). Not a key/door — it's a rule toggle.

TEST PAGE: `/test/redaction`
	•	A room with several obstacle types (spikes, laser glyphs, barriers) that can each be individually redacted.
	•	Debug overlay shows: redaction target type, redaction timer, affected objects (highlighted), cast state, player momentum during cast.
	•	Sliders for: redaction duration, cooldown, cast speed, area of effect.
	•	Scenarios: redact spikes while running over them, redact lasers mid-air, redact barriers mid-dash. Confirm the animation plays on the world, not on the player — momentum is never interrupted.
	•	Pass criteria: casting while moving feels seamless. The world changes, you don't.

⸻

Feature 9: Paste-over (Layer swap ability)

Copy a surface property from one thing to another. Copy "bouncy mushroom" onto a dull slab → now it bounces. Copy "icy" onto a wall → wall-skim instead of wall-slide.

TEST PAGE: `/test/paste-over`
	•	A room with objects that have distinct surface properties (bouncy, icy, sticky, conveyor) and neutral target surfaces.
	•	Debug overlay shows: sampled property (labeled), paste target (highlighted), active paste-over timers, surface property on each object.
	•	Sliders for: sample range, paste range, paste duration, cooldown.
	•	Scenarios: sample bounce → paste onto platform → jump on it. Sample ice → paste onto wall → wall-skim. Chain: sample, dash, paste without stopping.
	•	Pass criteria: tap to sample, tap to paste, never stop running. Property transfers feel immediately readable (clear visual change on the target).

⸻

Feature 10: Index Mark (Living map pin)

Instead of a static minimap, you pin "index tabs" that remember local hints.

TEST PAGE: `/test/index-mark`
	•	A multi-room test area (3–4 connected rooms) with points of interest.
	•	Debug overlay shows: active pin count, pin positions on a minimap overlay, pin data (what info is stored), distance to nearest pin.
	•	Sliders for: max active pins, pin visibility range, pin detail level.
	•	Scenarios: place a pin, leave the room, verify it persists and shows on the map. Place multiple pins, verify the UI stays readable. Delete a pin.
	•	Pass criteria: pinning and reading pins feels fast and useful, not like menu management.

⸻

Feature 11: Combat — melee

Combat should feel like an extension of movement, not an interruption of it. You never stop to fight — you fight while moving.

Weapons:
	•	Quill-spear — fast, mid-range poke, can attack in any direction including while dashing or wall-sliding.
	•	Ink snap — short whip, auto-aims nearest enemy, great for maintaining flow without precision-aiming.

TEST PAGE: `/test/combat-melee`
	•	A flat room with stationary and slow-moving target dummies.
	•	Debug overlay shows: attack hitbox (visible), active frames, commitment frames (should be near-zero), hitstop duration, damage numbers, player velocity during attack.
	•	Sliders for: attack speed, hitbox size, hitstop frames, screen shake intensity, commitment frames, ink-snap auto-aim range, ink-snap auto-aim cone.
	•	Scenarios: attack while running (no speed loss), attack while dashing, attack while wall-sliding, attack while jumping. Chain attack→dash→attack. Confirm the character never freezes — only the enemy does on hit.
	•	Pass criteria: attacking feels like a natural extension of movement. Zero flow interruption.

⸻

Feature 12: Combat — enemies

Three enemy archetypes per biome.

TEST PAGE: `/test/enemies`
	•	A room where you can spawn individual enemy types via a panel.
	•	Debug overlay shows: enemy state (idle / aggro / attacking / stunned), enemy hitbox, detection range, attack telegraph timing.
	•	Sliders for: enemy speed, aggro range, attack frequency, health.
	•	Enemy types to test:
		•	Reader (rush) — tests spacing and dodge timing.
		•	Binder (grapples / tethers) — tests dash-cancel reflexes.
		•	Proofwarden (shield you must "redact") — tests ability use under movement pressure.
	•	Scenarios: fight one of each type solo. Fight mixed groups. Fight in a tight room vs. an open room.
	•	Pass criteria: each archetype forces a different skill. Fights feel like high-speed movement puzzles, not standing combat.

⸻

Feature 13: Combat — boss encounters

Each boss is a conceptual editing mistake that attacks your movement mastery in a different way.

TEST PAGE: `/test/boss/[boss-name]`
	•	One page per boss. Arena geometry matches the real fight.
	•	Debug overlay shows: boss phase, attack pattern timeline, hitboxes for all attacks, safe zones highlighted, player proximity to danger.
	•	Sliders for: boss speed, attack frequency, phase health thresholds, arena size.
	•	Boss roster:
		•	The Footnote Giant — attacks from below lines, forces vertical play and wall-jump chains.
		•	The Misprint Seraph — spawns wrong symbols that invert your tools, demands precise dashing through chaos.
		•	The Index Eater — steals your map pins mid-fight, arena shrinks, tests tight-space movement under panic.
	•	A "practice mode" toggle: infinite player health, attack pattern labels visible, slow-motion option.
	•	Pass criteria: each boss tests a distinct movement skill. The fight feels like a movement exam, not a damage-sponge grind.

⸻

Feature 14: Biome movement textures

Each biome introduces a surface or environmental property that changes how the base controls feel.

TEST PAGE: `/test/biome/[biome-name]`
	•	One page per biome. Isolated room with that biome's movement texture and nothing else.
	•	Debug overlay shows: active environmental effect, modified physics values vs. base values, player velocity.
	•	Sliders for: each biome's unique physics modifier.
	•	Biomes:
		1.	Herbarium Folio (cozy-green) — vine grapple points that let you swing (preserving momentum into a launch). Sliders for swing speed, launch angle, momentum transfer.
		2.	Astral Atlas (clean neon + parchment) — low-gravity zones where jump arcs stretch and air control becomes more expressive. Sliders for gravity multiplier, air control boost.
		3.	Maritime Ledger (blueprints + storms) — current streams that boost or resist horizontal speed. Sliders for current strength, player resistance.
		4.	Gothic Errata (horror-cute) — "fear fog" that inverts left/right input until you redact it. Sliders for fog density, inversion delay.
	•	Pass criteria: the base movement still feels good with the texture applied. The texture adds flavor, not frustration.

⸻

Feature 15: Day/night cycle

Day is the cozy hub loop (Scribe Hall — restore pages, decorate, craft Ink Cards). Night is the danger loop (rooms shift, enemies get nastier, shortcuts collapse).

TEST PAGE: `/test/day-night`
	•	A small loop of 3–4 rooms that transitions between day and night states.
	•	Debug overlay shows: current cycle phase, time remaining in phase, room state (day version / night version), active corruption modifiers.
	•	Sliders for: day duration, night duration, transition speed, corruption intensity.
	•	Scenarios: walk through rooms in day mode (should feel cozy, safe). Trigger night transition — rooms shift, lighting changes, enemy spawns appear. Confirm the transition feels dramatic but not jarring.
	•	Pass criteria: the contrast between day and night is immediately obvious and emotionally distinct. The transition itself is smooth.

⸻

Feature 16: Ink Card crafting

Single-mod "edits" like: "Redaction lasts +2s", "Stitch range +20%", "Dash distance +15%".

TEST PAGE: `/test/ink-cards`
	•	A crafting UI test page — no game world, just the crafting interface.
	•	Shows: available materials, card recipes, preview of card effect (stat change shown numerically).
	•	Scenarios: craft a card, equip it, verify the stat change appears in the relevant ability test page's debug overlay. Craft multiple cards, test stacking rules.
	•	Pass criteria: crafting is fast (not menu-heavy), effects are immediately understandable, and the stat changes actually propagate to gameplay systems.

⸻

Feature 17: Room layout and gating

Map size: 60–90 rooms total. Abilities gate progression, not moves.

TEST PAGE: `/test/room-editor`
	•	A room layout sandbox. Place platforms, walls, hazards, doors, and ability gates.
	•	Debug overlay shows: room connections, gate requirements (which ability is needed), traversal paths.
	•	Scenarios: build a small 3-room sequence with a gate. Verify the player can't pass without the required ability. Verify the player can pass with it. Test that rooms connect seamlessly.
	•	Pass criteria: gates feel logical (the world blocks you, not an invisible wall). Room transitions are seamless.

⸻

World structure (4 biomes + hub, scoped for a solo dev)

Each biome is a book genre. Each biome also introduces a movement texture.

	1.	Herbarium Folio (cozy-green) — vines, pressed flowers, paper bark. Gating: redaction of thorns, paste-over "bouncy".
	2.	Astral Atlas (clean neon + parchment) — star charts, ink constellations. Gating: stitch between floating frames, low-gravity paste.
	3.	Maritime Ledger (blueprints + storms) — nautical knots, shipping stamps, soaked pages. Gating: water-ink that conducts / shorts glyph traps.
	4.	Gothic Errata (horror-cute) — cute librarian mascots become unsettling "misprints". Gating: erase "fear fog" walls; enemies mirror your edits.

⸻

Art direction (How to make this with Nano Banana)

Pick a style that's consistent and forgiving:
	•	Hand-inked lineart + soft watercolor fill
	•	Limited palette per biome (4–6 colors)
	•	Chunky silhouettes (readable sprites)
	•	Exaggerated squash-and-stretch on the character — this is what makes movement look as good as it feels

Your "style lock" phrase (use in every prompt):

hand-inked 2D game art, clean linework, watercolor wash fill, paper grain texture, high readability, metroidvania tileset, cohesive style, no text

Keep that constant. Change only biome descriptors.

⸻

Nano Banana prompt kit (copy/paste)

1) Main character sprite sheet (front-facing + side)

Use one prompt per action so it stays coherent. Every animation should emphasize fluid motion — smear frames, trailing ink, flowing cloak.

Idle (8 frames)

hand-inked 2D game sprite sheet, side-view archivist hero, short cloak, quill-spear, satchel of paper tabs, idle animation 8 frames, subtle breathing motion, cloak sway, clean linework, watercolor wash, paper grain texture, thick readable silhouette, transparent background, no text

Run (8 frames)

same character, run cycle 8 frames, dynamic cloak motion, trailing ink particles, exaggerated forward lean, smooth stride, consistent proportions, transparent background, no text

Jump (6 frames: launch, rise, apex float, fall, land squash, land recover)

same character, jump animation 6 frames, strong launch squash, stretched rise, brief apex float pose, fast fall silhouette, landing squash-and-stretch, transparent background, no text

Dash (4 frames: wind-up, blur, brake, recover)

same character, dash animation 4 frames, single-frame wind-up, ink-smear motion blur, sharp brake pose, fast recover to run, trailing ink particles, transparent background, no text

Attack (6 frames)

same character, quill-spear slash combo, attack animation 6 frames, exaggerated ink smear arc, character maintains forward momentum, transparent background, no text

Wall-slide (4 frames)

same character, wall-slide animation 4 frames, cloak dragging upward, one hand gripping wall, gradual deceleration pose, transparent background, no text

2) Tileset (the secret to shipping fast)

Herbarium tileset (16x16 or 32x32)

hand-inked metroidvania tileset, 32x32 tiles, herbarium book biome, pressed flowers, paper bark platforms, vine-covered stone, foreground tiles + edge tiles + slopes + background fillers, watercolor wash, paper grain, seamless, transparent background, no text

3) Background parallax layers

2D parallax background layers for metroidvania, inside a magical library greenhouse, distant shelves and hanging plants, soft watercolor, paper grain, 3 layers separated by depth, no text

4) Enemies (make them "stationery monsters")

hand-inked 2D enemy concept sheet, living origami bat made of torn paper, ink drips, cute but unsettling, 3 poses, watercolor wash, paper grain, transparent background, no text

5) Boss concept (big readable shapes)

hand-inked 2D boss concept, "Footnote Giant" made of stacked book pages and red string bindings, massive hands emerging from under lines, eerie librarian vibe, watercolor wash, paper grain, high readability, no text

⸻

Production-friendly scope (what you can realistically build)
	•	Map size: 60–90 rooms total
	•	Abilities: 4 core tools + 2 optional late-game variants
	•	Biomes: 4 + hub
	•	Bosses: 4 main + 2 mini
	•	Replay: nightly "corruption modifiers" (cheap to implement, adds freshness)
	•	Movement milestone: before any content is built, the character controller must pass the "empty room test" on `/test/movement-playground`.

⸻

Test page build order

This is the order to build and validate. Each page must pass before moving to the next.

Phase 1 — Core movement (build these first, nothing else matters yet):
	1.	`/test/ground-movement`
	2.	`/test/jumping`
	3.	`/test/wall-mechanics`
	4.	`/test/dash`
	5.	`/test/transitions`
	6.	`/test/movement-playground` ← the movement milestone gate

Phase 2 — Abilities (layer on top of proven movement):
	7.	`/test/margin-stitch`
	8.	`/test/redaction`
	9.	`/test/paste-over`
	10.	`/test/index-mark`

Phase 3 — Combat (built on movement + abilities):
	11.	`/test/combat-melee`
	12.	`/test/enemies`
	13.	`/test/boss/footnote-giant` (first boss only — prove the pattern)

Phase 4 — World systems:
	14.	`/test/biome/herbarium-folio` (first biome only — prove the pattern)
	15.	`/test/day-night`
	16.	`/test/ink-cards`
	17.	`/test/room-editor`

Phase 5 — Remaining content (repeat the proven patterns):
	18.	`/test/boss/misprint-seraph`
	19.	`/test/boss/index-eater`
	20.	`/test/biome/astral-atlas`
	21.	`/test/biome/maritime-ledger`
	22.	`/test/biome/gothic-errata`

⸻

The "hook sentence" for your Steam page

"A hand-inked metroidvania where the controls feel like water and progression isn't just movement — it's the power to edit the world."
