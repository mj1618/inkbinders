import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const API_KEY = process.env.NANOBANANA_API_KEY;
if (!API_KEY) {
  console.error("Missing NANOBANANA_API_KEY in .env.local");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const STYLE_PREFIX =
  "hand-inked 2D game art, clean linework, watercolor wash fill, paper grain texture, high readability, metroidvania sprite, cohesive style, no text, no background, transparent background PNG,";

const BG_STYLE_PREFIX =
  "hand-inked 2D game background art, clean linework, watercolor wash fill, paper grain texture, parallax layer, seamless horizontal tiling, no characters, no text, atmospheric depth,";

const VALID_CATEGORIES = [
  "player",
  "enemies",
  "bosses",
  "tiles",
  "backgrounds",
  "ability-vfx",
  "combat-vfx",
  "ui",
  "world-objects",
] as const;

type AssetCategory = (typeof VALID_CATEGORIES)[number];

interface AssetPrompt {
  id: string;
  filename: string;
  prompt: string;
  aspectRatio?: string;
  category: AssetCategory;
}

const ASSET_PROMPTS: AssetPrompt[] = [
  // ─── Player sprite sheets (9 total) ─────────────────────────────────
  {
    id: "player-idle",
    filename: "player-idle.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character in idle breathing pose, 4 frames side by side in a horizontal strip, subtle breathing animation: chest rises and falls, robe sways gently, each frame 64x64 pixels, warm parchment and indigo tones, game sprite sheet, 256x64 total`,
    aspectRatio: "16:9",
    category: "player",
  },
  {
    id: "player-run",
    filename: "player-run-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character running, 6 frames side by side in a horizontal strip, full run cycle with contact-pass-reach progression, ink-stained robe flowing, each frame 64x64 pixels, warm parchment and indigo tones, game sprite sheet, 384x64 total`,
    aspectRatio: "16:9",
    category: "player",
  },
  {
    id: "player-jump",
    filename: "player-jump-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character jumping, 3 frames side by side: jump launch crouching, mid-air at apex with robe flowing, falling with arms up, each frame 64x64 pixels, warm parchment and indigo tones, game sprite sheet, 192x64 total`,
    aspectRatio: "16:9",
    category: "player",
  },
  {
    id: "player-dash",
    filename: "player-dash-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character dashing, 3 frames side by side: wind-up crouch with trailing ink, mid-dash blur with ink streak behind, dash exit with momentum lean, each frame 64x64 pixels, warm parchment and hot pink ink trail tones, game sprite sheet, 192x64 total`,
    aspectRatio: "16:9",
    category: "player",
  },
  {
    id: "player-wall-slide",
    filename: "player-wall-slide-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character sliding down a wall, 2 frames side by side: gripping wall with one hand reaching up, sliding down with robe trailing upward, each frame 64x64 pixels, warm parchment and teal tones, game sprite sheet, 128x64 total`,
    aspectRatio: "16:9",
    category: "player",
  },
  {
    id: "player-crouch",
    filename: "player-crouch-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character crouching, 2 frames side by side: low crouch with robe pooled around feet, crouch-slide with speed lines and robe streaming behind, each frame 64x64 pixels, warm parchment and dark blue tones, game sprite sheet, 128x64 total`,
    aspectRatio: "16:9",
    category: "player",
  },
  {
    id: "player-land",
    filename: "player-land-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character landing hard, 3 frames side by side: heavy impact with dust puff and squashed pose, recovery pushing up from ground, standing up with slight wobble, each frame 64x64 pixels, warm parchment and amber tones, game sprite sheet, 192x64 total`,
    aspectRatio: "16:9",
    category: "player",
  },
  {
    id: "player-attack-spear",
    filename: "player-attack-spear-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character thrusting a quill spear, 4 frames side by side: wind-up with spear pulled back, forward thrust with arm extended, spear at full extension with ink splash at tip, recovery pulling spear back, each frame 96x64 pixels (wider to show spear reach), warm parchment and steel blue tones, game sprite sheet, 384x64 total`,
    aspectRatio: "16:9",
    category: "player",
  },
  {
    id: "player-attack-snap",
    filename: "player-attack-snap-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character performing an ink snap attack, 3 frames side by side: hand raised with gathering ink energy, snap gesture with ink burst radiating outward, fade out with ink droplets scattering, each frame 64x64 pixels, warm parchment and dark violet tones, game sprite sheet, 192x64 total`,
    aspectRatio: "16:9",
    category: "player",
  },
  // ─── Reader sprite sheets (4 total, 48×48 frames) ──────────────────
  {
    id: "reader-idle",
    filename: "reader-idle-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small frantic book creature called a Reader, 2 frames side by side, idle pose with pages fluttering nervously, hunched posture with visible spine ridges, each frame 48x48 pixels, red and dark parchment tones, game sprite sheet, 96x48 total`,
    aspectRatio: "16:9",
    category: "enemies",
  },
  {
    id: "reader-rush",
    filename: "reader-rush-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small frantic book creature called a Reader rushing forward, 4 frames side by side, scrambling run with pages flying off, limbs flailing, speed lines, each frame 48x48 pixels, red and dark parchment tones, game sprite sheet, 192x48 total`,
    aspectRatio: "16:9",
    category: "enemies",
  },
  {
    id: "reader-hit",
    filename: "reader-hit-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small book creature called a Reader getting hit, 2 frames side by side: recoil with pages scattering, dazed with stars, each frame 48x48 pixels, red and parchment tones, game sprite sheet, 96x48 total`,
    aspectRatio: "16:9",
    category: "enemies",
  },
  {
    id: "reader-death",
    filename: "reader-death-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small book creature called a Reader dying, 3 frames side by side: crumpling inward, pages exploding outward, pile of loose pages on ground, each frame 48x48 pixels, red fading to gray tones, game sprite sheet, 144x48 total`,
    aspectRatio: "16:9",
    category: "enemies",
  },
  // ─── Binder sprite sheets (4 total, 64×64 frames) ──────────────────
  {
    id: "binder-idle",
    filename: "binder-idle-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a hunched thread-caster creature called a Binder, 2 frames side by side, idle weaving pose with glowing threads between hands, robed figure with thread tendrils, each frame 64x64 pixels, purple and dark ink tones, game sprite sheet, 128x64 total`,
    aspectRatio: "16:9",
    category: "enemies",
  },
  {
    id: "binder-grapple",
    filename: "binder-grapple-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a thread-caster creature called a Binder shooting and retracting a thread, 5 frames in a row: arm extending with thread launching forward, thread stretching out, thread taut at full extension, thread pulling back with tension, arm retracted with thread coiled, each frame 64x64 pixels, purple and glowing thread tones, game sprite sheet, 320x64 total`,
    aspectRatio: "16:9",
    category: "enemies",
  },
  {
    id: "binder-hit",
    filename: "binder-hit-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a robed thread-caster creature getting hit, 2 frames side by side: flinch with threads snapping, recoil with arms raised, each frame 64x64 pixels, purple and parchment tones, game sprite sheet, 128x64 total`,
    aspectRatio: "16:9",
    category: "enemies",
  },
  {
    id: "binder-death",
    filename: "binder-death-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a robed thread-caster creature dying, 3 frames side by side: collapsing with threads unraveling, dissolving into loose threads, pile of tangled threads on ground, each frame 64x64 pixels, purple fading to gray, game sprite sheet, 192x64 total`,
    aspectRatio: "16:9",
    category: "enemies",
  },
  // ─── Proofwarden sprite sheets (5 total, 64×64 frames) ─────────────
  {
    id: "proofwarden-idle",
    filename: "proofwarden-idle-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of an armored sentinel creature called a Proofwarden, 2 frames side by side, imposing stance with glowing shield in one hand, ink-etched armor with proofreading marks, each frame 64x64 pixels, blue and iron gray tones, game sprite sheet, 128x64 total`,
    aspectRatio: "16:9",
    category: "enemies",
  },
  {
    id: "proofwarden-shield",
    filename: "proofwarden-shield-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of an armored sentinel raising and losing its shield, 5 frames in a row: shield raised with bright glow, shield at full power with energy aura, shield cracking with sparks, shield shattering with fragments, shield gone with staggered pose, each frame 64x64 pixels, blue glow to dim gray transition, game sprite sheet, 320x64 total`,
    aspectRatio: "16:9",
    category: "enemies",
  },
  {
    id: "proofwarden-attack",
    filename: "proofwarden-attack-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of an armored sentinel doing a ground slam attack, 3 frames in a row: winding up with fist raised high, slamming down with shockwave ring, impact with ground crack lines radiating outward, each frame 64x64 pixels, blue and iron tones with impact yellow, game sprite sheet, 192x64 total`,
    aspectRatio: "16:9",
    category: "enemies",
  },
  {
    id: "proofwarden-hit",
    filename: "proofwarden-hit-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of an armored sentinel getting hit, 2 frames side by side: armor sparking on impact, staggering backward, each frame 64x64 pixels, blue and iron gray tones, game sprite sheet, 128x64 total`,
    aspectRatio: "16:9",
    category: "enemies",
  },
  {
    id: "proofwarden-death",
    filename: "proofwarden-death-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of an armored sentinel dying, 3 frames side by side: armor cracking and falling off, collapsing to knees with ink leaking, crumpled armor pile on ground, each frame 64x64 pixels, iron gray fading to black, game sprite sheet, 192x64 total`,
    aspectRatio: "16:9",
    category: "enemies",
  },
  // ─── Footnote Giant sprite sheets (5 total, 128×128 frames) ─────────
  {
    id: "giant-idle",
    filename: "giant-idle-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a massive towering footnote golem made of stacked books and parchment, 4 frames in a horizontal strip, idle breathing animation with pages rustling gently, heavy stone-like base, glowing arcane symbols on spine, each frame 128x128 pixels, indigo and gold tones, game boss sprite sheet, 512x128 total`,
    aspectRatio: "16:9",
    category: "bosses",
  },
  {
    id: "giant-stomp",
    filename: "giant-stomp-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a massive footnote golem stomping attack, 4 frames in a horizontal strip: telegraph pose with arm raised, downward slam impact, shockwave burst from ground, stuck in ground recovery, each frame 128x128 pixels, indigo and orange impact tones, game boss sprite sheet, 512x128 total`,
    aspectRatio: "16:9",
    category: "bosses",
  },
  {
    id: "giant-sweep",
    filename: "giant-sweep-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a massive footnote golem sweeping beam attack, 4 frames in a horizontal strip: telegraph pose with energy gathering, beam extending left, beam at full width, beam fading, each frame 128x128 pixels, indigo and red beam tones, game boss sprite sheet, 512x128 total`,
    aspectRatio: "16:9",
    category: "bosses",
  },
  {
    id: "giant-vulnerable",
    filename: "giant-vulnerable-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a massive footnote golem in a stunned vulnerable state, 2 frames in a horizontal strip: dazed wobble left, dazed wobble right, stars and symbols circling head, cracked pages falling, each frame 128x128 pixels, indigo with yellow vulnerability glow, game boss sprite sheet, 256x128 total`,
    aspectRatio: "16:9",
    category: "bosses",
  },
  {
    id: "giant-death",
    filename: "giant-death-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a massive footnote golem collapsing and dying, 4 frames in a horizontal strip: cracking apart, tilting over, crumbling to pieces, scattered pages on ground, each frame 128x128 pixels, fading indigo tones, game boss sprite sheet, 512x128 total`,
    aspectRatio: "16:9",
    category: "bosses",
  },
  // ─── Misprint Seraph sprite sheets (5 total, 128×128 frames) ────────
  {
    id: "seraph-hover",
    filename: "seraph-hover-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of an angelic floating seraph creature made of misprinted pages with torn paper wings, 4 frames in a horizontal strip, hovering animation with wing flaps and floating page debris, ethereal white and red corruption tones, halo of punctuation marks, each frame 128x128 pixels, game boss sprite sheet, 512x128 total`,
    aspectRatio: "16:9",
    category: "bosses",
  },
  {
    id: "seraph-dive",
    filename: "seraph-dive-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a paper seraph diving downward in attack, 3 frames in a horizontal strip: wings tucked preparing to dive, mid-dive with wings swept back and speed lines, impact pose at bottom, each frame 128x128 pixels, white and red tones, game boss sprite sheet, 384x128 total`,
    aspectRatio: "16:9",
    category: "bosses",
  },
  {
    id: "seraph-cast",
    filename: "seraph-cast-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a paper seraph casting a glyph spell, 4 frames in a horizontal strip: gathering energy with glowing hands, arms outstretched channeling, energy beams projecting from hands, spell release with page burst, each frame 128x128 pixels, white body with red energy tones, game boss sprite sheet, 512x128 total`,
    aspectRatio: "16:9",
    category: "bosses",
  },
  {
    id: "seraph-stagger",
    filename: "seraph-stagger-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a paper seraph in a stunned staggering state, 2 frames in a horizontal strip: wings drooping and body tilted left, wings drooping and body tilted right, pages falling from body, each frame 128x128 pixels, dimmed white tones, game boss sprite sheet, 256x128 total`,
    aspectRatio: "16:9",
    category: "bosses",
  },
  {
    id: "seraph-death",
    filename: "seraph-death-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a paper seraph dissolving in death, 4 frames in a horizontal strip: wings crumpling, body splitting into pages, pages scattering outward, final wisps of paper dust, each frame 128x128 pixels, fading white tones, game boss sprite sheet, 512x128 total`,
    aspectRatio: "16:9",
    category: "bosses",
  },
  // ─── Index Eater sprite sheets (6 total, 128×96 frames) ────────────
  {
    id: "eater-crawl",
    filename: "eater-crawl-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a segmented centipede-like creature made of filing tabs and index cards, 4 frames in a horizontal strip, crawling animation with undulating body segments and many tab-legs, tan and dark brown tones, wide low creature, each frame 128x96 pixels, game boss sprite sheet, 512x96 total`,
    aspectRatio: "16:9",
    category: "bosses",
  },
  {
    id: "eater-lunge",
    filename: "eater-lunge-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a filing-tab centipede lunging forward to attack, 3 frames in a horizontal strip: coiled back preparing to strike, mid-lunge with body extended and jaws open, full extension with mouth snapping, each frame 128x96 pixels, tan and red danger tones, game boss sprite sheet, 384x96 total`,
    aspectRatio: "16:9",
    category: "bosses",
  },
  {
    id: "eater-devour",
    filename: "eater-devour-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a filing-tab centipede devouring a platform, 4 frames in a horizontal strip: mouth opening wide, chomping down on floor piece, chewing with debris, stunned and bloated from overeating, each frame 128x96 pixels, tan with dark ink stain tones, game boss sprite sheet, 512x96 total`,
    aspectRatio: "16:9",
    category: "bosses",
  },
  {
    id: "eater-spit",
    filename: "eater-spit-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a filing-tab centipede spitting card projectiles, 3 frames in a horizontal strip: head rearing back, mouth opening with visible cards, cards launching outward in fan pattern, each frame 128x96 pixels, tan body with amber projectile tones, game boss sprite sheet, 384x96 total`,
    aspectRatio: "16:9",
    category: "bosses",
  },
  {
    id: "eater-stunned",
    filename: "eater-stunned-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a filing-tab centipede in stunned vulnerable state, 2 frames in a horizontal strip: belly exposed and legs twitching left, belly exposed and legs twitching right, tabs splayed out weakly, each frame 128x96 pixels, pale tan vulnerability tones, game boss sprite sheet, 256x96 total`,
    aspectRatio: "16:9",
    category: "bosses",
  },
  {
    id: "eater-death",
    filename: "eater-death-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a filing-tab centipede dying and falling apart, 4 frames in a horizontal strip: body cracking, segments separating, tabs and cards scattering, pile of loose papers on ground, each frame 128x96 pixels, fading tan tones, game boss sprite sheet, 512x96 total`,
    aspectRatio: "16:9",
    category: "bosses",
  },
  // ─── Tile sets (5 total) ───────────────────────────────────────────
  {
    id: "tiles-scribe-hall",
    filename: "tiles-scribe-hall.png",
    prompt: `${STYLE_PREFIX} 2D game tileset for a cozy library, 4 tiles in a row: wooden floor plank, wooden shelf block, stone wall block, wooden beam, each tile 32x32 pixels, warm brown and parchment tones, seamless tileable edges, game tileset, 128x32 total`,
    aspectRatio: "16:9",
    category: "tiles",
  },
  {
    id: "tiles-herbarium-folio",
    filename: "tiles-herbarium-folio.png",
    prompt: `${STYLE_PREFIX} 2D game tileset for an enchanted botanical garden library, 4 tiles in a row: vine-covered stone floor, mossy stone block, leaf-wrapped column, thorny hedge block, each tile 32x32 pixels, deep green and aged parchment tones, seamless tileable edges, game tileset, 128x32 total`,
    aspectRatio: "16:9",
    category: "tiles",
  },
  {
    id: "tiles-astral-atlas",
    filename: "tiles-astral-atlas.png",
    prompt: `${STYLE_PREFIX} 2D game tileset for a cosmic astral library, 4 tiles in a row: star-glass floor tile with glowing constellation lines, solid constellation block with embedded star patterns, nebula pillar tile with swirling purple-blue gas, void edge wall tile with dark boundary glow, each tile 32x32 pixels, deep navy blue and silver and gold star point tones, seamless tileable edges, game tileset, 128x32 total`,
    aspectRatio: "16:9",
    category: "tiles",
  },
  {
    id: "tiles-maritime-ledger",
    filename: "tiles-maritime-ledger.png",
    prompt: `${STYLE_PREFIX} 2D game tileset for a nautical maritime library, 4 tiles in a row: driftwood plank floor tile with wood grain, coral block tile with barnacle detail, barnacle-encrusted pillar tile, kelp-draped wall tile, each tile 32x32 pixels, teal and sand and weathered wood brown and ocean blue tones, seamless tileable edges, game tileset, 128x32 total`,
    aspectRatio: "16:9",
    category: "tiles",
  },
  {
    id: "tiles-gothic-errata",
    filename: "tiles-gothic-errata.png",
    prompt: `${STYLE_PREFIX} 2D game tileset for a dark gothic library, 4 tiles in a row: cracked stone floor tile with faint red veins, gargoyle-decorated solid block tile, iron column tile with rivets and rust, fog grate wall tile with wisps seeping through, each tile 32x32 pixels, dark charcoal gray and deep crimson and iron black and ash white tones, seamless tileable edges, game tileset, 128x32 total`,
    aspectRatio: "16:9",
    category: "tiles",
  },
  // ─── Ability VFX Sprite Sheets (10 total) ──────────────────────────
  {
    id: "vfx-stitch-line",
    filename: "vfx-stitch-line-sheet.png",
    prompt: `${STYLE_PREFIX} ability VFX sprite sheet, 4 frames in a horizontal strip, each frame 64x16 pixels, glowing amber thread line pulsing, stitching two surfaces together, needle-and-thread motif, golden amber glow, game-ready, 256x16 total`,
    aspectRatio: "16:9",
    category: "ability-vfx",
  },
  {
    id: "vfx-stitch-needle",
    filename: "vfx-stitch-needle-sheet.png",
    prompt: `${STYLE_PREFIX} ability VFX sprite sheet, 3 frames in a horizontal strip, each frame 32x32 pixels, sewing needle flash burst, amber glow expanding outward, activation effect, spark radiating, game-ready, 96x32 total`,
    aspectRatio: "16:9",
    category: "ability-vfx",
  },
  {
    id: "vfx-redaction-splat",
    filename: "vfx-redaction-splat-sheet.png",
    prompt: `${STYLE_PREFIX} ability VFX sprite sheet, 4 frames in a horizontal strip, each frame 64x64 pixels, ink blot expanding from center, dark black ink splatter growing larger each frame, redaction censorship effect, game-ready, 256x64 total`,
    aspectRatio: "16:9",
    category: "ability-vfx",
  },
  {
    id: "vfx-redaction-drip",
    filename: "vfx-redaction-drip-sheet.png",
    prompt: `${STYLE_PREFIX} ability VFX sprite sheet, 3 frames in a horizontal strip, each frame 16x32 pixels, black ink dripping downward, ink drop falling sequence, dark ink tones, game-ready, 48x32 total`,
    aspectRatio: "16:9",
    category: "ability-vfx",
  },
  {
    id: "vfx-redaction-bar",
    filename: "vfx-redaction-bar-sheet.png",
    prompt: `${STYLE_PREFIX} ability VFX sprite sheet, 2 frames in a horizontal strip, each frame 64x16 pixels, pulsing black strike-through bar, censorship redaction line with glowing red edges, game-ready, 128x16 total`,
    aspectRatio: "16:9",
    category: "ability-vfx",
  },
  {
    id: "vfx-paste-glow",
    filename: "vfx-paste-glow-sheet.png",
    prompt: `${STYLE_PREFIX} ability VFX sprite sheet, 4 frames in a horizontal strip, each frame 64x32 pixels, glowing surface pulse effect, magical warm amber glow on a platform, pulse cycle brightening and dimming, game-ready, 256x32 total`,
    aspectRatio: "16:9",
    category: "ability-vfx",
  },
  {
    id: "vfx-paste-swoosh",
    filename: "vfx-paste-swoosh-sheet.png",
    prompt: `${STYLE_PREFIX} ability VFX sprite sheet, 3 frames in a horizontal strip, each frame 48x48 pixels, clipboard copy swoosh effect, magical capture swirl, paper clipboard motif, amber energy, game-ready, 144x48 total`,
    aspectRatio: "16:9",
    category: "ability-vfx",
  },
  {
    id: "vfx-bookmark",
    filename: "vfx-bookmark-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of 4 bookmark ribbon tabs in a horizontal strip, colors left to right: amber, blue, green, red, pointed bottom edge, library bookmark style, each frame 16x24 pixels, game-ready, 64x24 total`,
    aspectRatio: "16:9",
    category: "ability-vfx",
  },
  {
    id: "vfx-teleport-flash",
    filename: "vfx-teleport-flash-sheet.png",
    prompt: `${STYLE_PREFIX} ability VFX sprite sheet, 4 frames in a horizontal strip, each frame 64x64 pixels, teleport flash burst effect, expanding ring of light, magical warp with ink paper particles, bright amber to white, game-ready, 256x64 total`,
    aspectRatio: "16:9",
    category: "ability-vfx",
  },
  {
    id: "vfx-index-ring",
    filename: "vfx-index-ring-sheet.png",
    prompt: `${STYLE_PREFIX} ability VFX sprite sheet, 4 frames in a horizontal strip, each frame 48x48 pixels, spinning selection ring, dotted circle rotating at different angles, magical targeting reticle, amber glow, game-ready, 192x48 total`,
    aspectRatio: "16:9",
    category: "ability-vfx",
  },
  // ─── Combat VFX Sprite Sheets (5 total) ────────────────────────────
  {
    id: "combat-spear-slash",
    filename: "combat-spear-slash.png",
    prompt: `${STYLE_PREFIX} combat VFX sprite sheet, 3 frames in a horizontal strip, each frame 96x96 pixels, sword slash arc VFX, glowing blue ink sweep, frame 1: thin arc starting, frame 2: full crescent sweep, frame 3: fading trail with ink droplets, blue ink brush stroke aesthetic, game-ready, 288x96 total`,
    aspectRatio: "16:9",
    category: "combat-vfx",
  },
  {
    id: "combat-snap-burst",
    filename: "combat-snap-burst.png",
    prompt: `${STYLE_PREFIX} combat VFX sprite sheet, 3 frames in a horizontal strip, each frame 64x64 pixels, magic burst VFX, dark indigo ink explosion, frame 1: small center point, frame 2: expanding ring with ink droplets, frame 3: large dissipating ring, game-ready, 192x64 total`,
    aspectRatio: "16:9",
    category: "combat-vfx",
  },
  {
    id: "combat-hit-flash",
    filename: "combat-hit-flash.png",
    prompt: `${STYLE_PREFIX} combat VFX sprite sheet, 3 frames in a horizontal strip, each frame 48x48 pixels, impact flash VFX, white-gold star burst, frame 1: bright center flash, frame 2: radiating points, frame 3: fading sparkle, game-ready, 144x48 total`,
    aspectRatio: "16:9",
    category: "combat-vfx",
  },
  {
    id: "combat-hit-sparks",
    filename: "combat-hit-sparks.png",
    prompt: `${STYLE_PREFIX} combat VFX sprite sheet, 2 frames in a horizontal strip, each frame 32x32 pixels, hit spark particles VFX, small ink droplets scattering outward, frame 1: tight cluster, frame 2: scattered spread, game-ready, 64x32 total`,
    aspectRatio: "16:9",
    category: "combat-vfx",
  },
  {
    id: "combat-hitstop-flash",
    filename: "combat-hitstop-flash.png",
    prompt: `${STYLE_PREFIX} single frame, white silhouette flash overlay for hitstop freeze frame effect, pure white filled rounded rectangle shape with soft glow edges, 64x64 pixels, game-ready`,
    category: "combat-vfx",
  },
  // ─── HUD & UI Sprites (19 total) ──────────────────────────────────
  // HUD Icons
  {
    id: "hud-health-heart",
    filename: "hud-health-heart.png",
    prompt: `${STYLE_PREFIX} 3-frame horizontal sprite strip, pixel-art heart icons for health HUD, frame 1: full red heart with ink outline, frame 2: half heart left half filled, frame 3: empty heart outline only, 16x16 pixels per frame, transparent background, 48x16 total image`,
    category: "ui",
  },
  {
    id: "hud-ability-stitch",
    filename: "hud-ability-stitch.png",
    prompt: `${STYLE_PREFIX} single icon, margin stitch ability, two parallel pages with glowing cyan thread stitching between them, 32x32 pixels, transparent background, cyan and white color palette`,
    category: "ui",
  },
  {
    id: "hud-ability-redaction",
    filename: "hud-ability-redaction.png",
    prompt: `${STYLE_PREFIX} single icon, redaction ability, black ink rectangle with red strike-through X mark, dripping ink edges, 32x32 pixels, transparent background, black and red color palette`,
    category: "ui",
  },
  {
    id: "hud-ability-paste",
    filename: "hud-ability-paste.png",
    prompt: `${STYLE_PREFIX} single icon, paste-over ability, glowing stamp or paintbrush pressing onto a surface, amber orange glow, 32x32 pixels, transparent background, amber and gold color palette`,
    category: "ui",
  },
  {
    id: "hud-ability-index",
    filename: "hud-ability-index.png",
    prompt: `${STYLE_PREFIX} single icon, index mark ability, ornate bookmark ribbon with purple glow, pin waypoint marker shape, 32x32 pixels, transparent background, purple and lavender color palette`,
    category: "ui",
  },
  {
    id: "hud-weapon-spear",
    filename: "hud-weapon-spear.png",
    prompt: `${STYLE_PREFIX} single icon, quill spear weapon, elegant writing quill with sharp pointed nib angled diagonally, blue ink glow, 32x32 pixels, transparent background, blue color palette`,
    category: "ui",
  },
  {
    id: "hud-weapon-snap",
    filename: "hud-weapon-snap.png",
    prompt: `${STYLE_PREFIX} single icon, ink snap weapon, starburst explosion of dark ink droplets radiating outward, 6 rays, indigo glow, 32x32 pixels, transparent background, indigo color palette`,
    category: "ui",
  },
  {
    id: "hud-sun",
    filename: "hud-sun.png",
    prompt: `${STYLE_PREFIX} single icon, sun for daytime, warm glowing sun with 8 short rays, amber gold watercolor, 16x16 pixels, transparent background`,
    category: "ui",
  },
  {
    id: "hud-moon",
    filename: "hud-moon.png",
    prompt: `${STYLE_PREFIX} single icon, crescent moon for nighttime, elegant thin crescent with soft indigo glow, 16x16 pixels, transparent background`,
    category: "ui",
  },
  // Card Category Icons
  {
    id: "card-category-swiftness",
    filename: "card-category-swiftness.png",
    prompt: `${STYLE_PREFIX} single icon, swiftness card category, flowing wind trail or speed lines, cyan teal color, 24x24 pixels, transparent background`,
    category: "ui",
  },
  {
    id: "card-category-might",
    filename: "card-category-might.png",
    prompt: `${STYLE_PREFIX} single icon, might card category, clenched fist or rising flame, amber gold color, 24x24 pixels, transparent background`,
    category: "ui",
  },
  {
    id: "card-category-resilience",
    filename: "card-category-resilience.png",
    prompt: `${STYLE_PREFIX} single icon, resilience card category, shield or oak leaf, green color, 24x24 pixels, transparent background`,
    category: "ui",
  },
  {
    id: "card-category-precision",
    filename: "card-category-precision.png",
    prompt: `${STYLE_PREFIX} single icon, precision card category, crosshair target or magnifying glass, purple lavender color, 24x24 pixels, transparent background`,
    category: "ui",
  },
  {
    id: "card-category-arcana",
    filename: "card-category-arcana.png",
    prompt: `${STYLE_PREFIX} single icon, arcana card category, mystic rune circle or glowing glyph, indigo blue-violet color, 24x24 pixels, transparent background`,
    category: "ui",
  },
  // Card Frames
  {
    id: "card-frame-tier1",
    filename: "card-frame-tier1.png",
    prompt: `${STYLE_PREFIX} ornate card border frame tier 1, simple clean ink border with subtle corner flourishes, parchment texture interior, 80x110 pixels, transparent outside border`,
    category: "ui",
  },
  {
    id: "card-frame-tier2",
    filename: "card-frame-tier2.png",
    prompt: `${STYLE_PREFIX} ornate card border frame tier 2, elegant ink border with vine-like decorative corners and side accents, golden line accent, parchment texture interior, 80x110 pixels, transparent outside border`,
    category: "ui",
  },
  {
    id: "card-frame-tier3",
    filename: "card-frame-tier3.png",
    prompt: `${STYLE_PREFIX} ornate card border frame tier 3, elaborate illuminated manuscript border with detailed floral corner ornaments and gold leaf accents, glowing edges, parchment interior, 80x110 pixels, transparent outside border`,
    category: "ui",
  },
  // Title & Menu
  {
    id: "ui-title-logo",
    filename: "ui-title-logo.png",
    prompt: `${STYLE_PREFIX} game logo text INKBINDERS, hand-lettered calligraphy with ink drips and quill flourishes, amber gold on dark background, ornate but readable, 480x120 pixels`,
    aspectRatio: "16:9",
    category: "ui",
  },
  {
    id: "ui-menu-button",
    filename: "ui-menu-button.png",
    prompt: `${STYLE_PREFIX} horizontal UI button background, ink-wash rectangle with torn paper edges and subtle watercolor gradient, dark parchment center, 200x40 pixels, transparent background`,
    aspectRatio: "16:9",
    category: "ui",
  },
  // ─── Parallax Background Images (15 total, 960×540 per image) ──────
  // Scribe Hall backgrounds
  {
    id: "bg-scribe-hall-far",
    filename: "backgrounds/bg-scribe-hall-far.png",
    prompt: `${BG_STYLE_PREFIX} distant bookshelves, warm amber glow, candlelight, old library, deep background, muted colors, 960x540`,
    aspectRatio: "16:9",
    category: "backgrounds",
  },
  {
    id: "bg-scribe-hall-mid",
    filename: "backgrounds/bg-scribe-hall-mid.png",
    prompt: `${BG_STYLE_PREFIX} candelabras, reading desks, wooden furniture, mid-distance, warm brown tones, 960x540`,
    aspectRatio: "16:9",
    category: "backgrounds",
  },
  {
    id: "bg-scribe-hall-near",
    filename: "backgrounds/bg-scribe-hall-near.png",
    prompt: `${BG_STYLE_PREFIX} hanging scrolls, ink bottles, quill pens, close foreground elements, warm gold highlights, 960x540`,
    aspectRatio: "16:9",
    category: "backgrounds",
  },
  // Herbarium Folio backgrounds
  {
    id: "bg-herbarium-folio-far",
    filename: "backgrounds/bg-herbarium-folio-far.png",
    prompt: `${BG_STYLE_PREFIX} ruled notebook lines, faint leaf silhouettes, pale parchment background, very subtle, 960x540`,
    aspectRatio: "16:9",
    category: "backgrounds",
  },
  {
    id: "bg-herbarium-folio-mid",
    filename: "backgrounds/bg-herbarium-folio-mid.png",
    prompt: `${BG_STYLE_PREFIX} botanical stems and leaf outlines, pressed flower shapes, green ink on parchment, 960x540`,
    aspectRatio: "16:9",
    category: "backgrounds",
  },
  {
    id: "bg-herbarium-folio-near",
    filename: "backgrounds/bg-herbarium-folio-near.png",
    prompt: `${BG_STYLE_PREFIX} vine tendrils, curling plant forms, detailed botanical foreground, rich greens, 960x540`,
    aspectRatio: "16:9",
    category: "backgrounds",
  },
  // Astral Atlas backgrounds
  {
    id: "bg-astral-atlas-far",
    filename: "backgrounds/bg-astral-atlas-far.png",
    prompt: `${BG_STYLE_PREFIX} star field, distant galaxies, deep navy blue space, silver pinpoints, cosmic depth, 960x540`,
    aspectRatio: "16:9",
    category: "backgrounds",
  },
  {
    id: "bg-astral-atlas-mid",
    filename: "backgrounds/bg-astral-atlas-mid.png",
    prompt: `${BG_STYLE_PREFIX} floating constellation charts, star map diagrams, silver outlines on dark blue, 960x540`,
    aspectRatio: "16:9",
    category: "backgrounds",
  },
  {
    id: "bg-astral-atlas-near",
    filename: "backgrounds/bg-astral-atlas-near.png",
    prompt: `${BG_STYLE_PREFIX} drifting astral pages, glowing star fragments, purple nebula wisps, foreground debris, 960x540`,
    aspectRatio: "16:9",
    category: "backgrounds",
  },
  // Maritime Ledger backgrounds
  {
    id: "bg-maritime-ledger-far",
    filename: "backgrounds/bg-maritime-ledger-far.png",
    prompt: `${BG_STYLE_PREFIX} distant harbor, lighthouse silhouettes, calm ocean horizon, teal and sand colors, 960x540`,
    aspectRatio: "16:9",
    category: "backgrounds",
  },
  {
    id: "bg-maritime-ledger-mid",
    filename: "backgrounds/bg-maritime-ledger-mid.png",
    prompt: `${BG_STYLE_PREFIX} moored ships, rope rigging, dock structures, mid-ocean depth, nautical elements, 960x540`,
    aspectRatio: "16:9",
    category: "backgrounds",
  },
  {
    id: "bg-maritime-ledger-near",
    filename: "backgrounds/bg-maritime-ledger-near.png",
    prompt: `${BG_STYLE_PREFIX} wave spray, floating cargo crates, rope coils, close-up ocean foreground, cyan highlights, 960x540`,
    aspectRatio: "16:9",
    category: "backgrounds",
  },
  // Gothic Errata backgrounds
  {
    id: "bg-gothic-errata-far",
    filename: "backgrounds/bg-gothic-errata-far.png",
    prompt: `${BG_STYLE_PREFIX} cathedral spires, dark stormy sky, distant gothic architecture, ominous silhouettes, 960x540`,
    aspectRatio: "16:9",
    category: "backgrounds",
  },
  {
    id: "bg-gothic-errata-mid",
    filename: "backgrounds/bg-gothic-errata-mid.png",
    prompt: `${BG_STYLE_PREFIX} broken stained glass panels, crumbling arches, gargoyle silhouettes, crimson and gray, 960x540`,
    aspectRatio: "16:9",
    category: "backgrounds",
  },
  {
    id: "bg-gothic-errata-near",
    filename: "backgrounds/bg-gothic-errata-near.png",
    prompt: `${BG_STYLE_PREFIX} drifting fog wisps, close gargoyle details, iron grates, cracked stone foreground, eerie atmosphere, 960x540`,
    aspectRatio: "16:9",
    category: "backgrounds",
  },
  // ─── World Object Sprites (14 total) ──────────────────────────────
  {
    id: "vine-rope",
    filename: "vine-rope.png",
    prompt: `${STYLE_PREFIX} single vine rope segment, 1 frame on transparent background. Braided green vine with leaf texture, 8x32 pixels. Dark green and brown tones.`,
    category: "world-objects",
  },
  {
    id: "vine-anchor",
    filename: "vine-anchor.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a vine anchor point, 2 frames side by side in a horizontal strip on transparent background. Frame 1: dormant stone hook with dried vine wrapped around it. Frame 2: active glowing green hook with fresh vine. Each frame 32x32 pixels. Earthy green and brown tones. 64x32 total.`,
    category: "world-objects",
  },
  {
    id: "spikes-up",
    filename: "spikes-up.png",
    prompt: `${STYLE_PREFIX} upward-facing spike hazard tile, 1 frame on transparent background. Sharp iron spikes pointing upward from a stone base, rusty red-brown metal with dark ink outlines, 32x32 pixels.`,
    category: "world-objects",
  },
  {
    id: "spikes-down",
    filename: "spikes-down.png",
    prompt: `${STYLE_PREFIX} downward-facing spike hazard tile, 1 frame on transparent background. Sharp iron spikes pointing downward from a stone ceiling mount, rusty red-brown metal with dark ink outlines, 32x32 pixels.`,
    category: "world-objects",
  },
  {
    id: "spikes-left",
    filename: "spikes-left.png",
    prompt: `${STYLE_PREFIX} left-facing spike hazard tile, 1 frame on transparent background. Sharp iron spikes pointing left from a wall mount, rusty red-brown metal with dark ink outlines, 32x32 pixels.`,
    category: "world-objects",
  },
  {
    id: "spikes-right",
    filename: "spikes-right.png",
    prompt: `${STYLE_PREFIX} right-facing spike hazard tile, 1 frame on transparent background. Sharp iron spikes pointing right from a wall mount, rusty red-brown metal with dark ink outlines, 32x32 pixels.`,
    category: "world-objects",
  },
  {
    id: "barrier",
    filename: "barrier.png",
    prompt: `${STYLE_PREFIX} dark ink barrier block tile, 1 frame on transparent background. Dense black ink barrier with swirling corruption patterns, faint purple glow at edges, 32x32 pixels. Tileable vertically.`,
    category: "world-objects",
  },
  {
    id: "laser-beam",
    filename: "laser-beam.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a laser beam hazard, 2 frames side by side in a horizontal strip on transparent background. Frame 1: bright red-orange beam at full intensity. Frame 2: dimmer pulsing beam with flicker effect. Each frame 32x8 pixels. Hot red and orange tones. 64x8 total.`,
    category: "world-objects",
  },
  {
    id: "ability-gate",
    filename: "ability-gate.png",
    prompt: `${STYLE_PREFIX} sprite sheet of ability gate barriers, 4 frames side by side in a horizontal strip on transparent background. Frame 1: cyan thread barrier (Margin Stitch). Frame 2: red ink barrier (Redaction). Frame 3: amber paper barrier (Paste-Over). Frame 4: purple glyph barrier (Index Mark). Each frame 16x96 pixels. Glowing magical barrier with matching ability color. 64x96 total.`,
    category: "world-objects",
  },
  {
    id: "exit-arrow",
    filename: "exit-arrow.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a directional exit arrow indicator, 2 frames side by side in a horizontal strip on transparent background. Frame 1: dim arrow pointing right. Frame 2: bright pulsing arrow pointing right with glow effect. Each frame 32x32 pixels. White-gold tones. 64x32 total.`,
    category: "world-objects",
  },
  {
    id: "gravity-well-attract",
    filename: "gravity-well-attract.png",
    prompt: `${STYLE_PREFIX} sprite sheet of an attracting gravity well, 4 frames side by side in a horizontal strip on transparent background. Pulsing concentric indigo rings pulling inward, ethereal cosmic energy, each frame shows a different pulse phase. Each frame 128x128 pixels. Indigo and purple tones. 512x128 total.`,
    aspectRatio: "16:9",
    category: "world-objects",
  },
  {
    id: "gravity-well-repel",
    filename: "gravity-well-repel.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a repelling gravity well, 4 frames side by side in a horizontal strip on transparent background. Pulsing concentric pink rings pushing outward, ethereal cosmic energy, each frame shows a different pulse phase. Each frame 128x128 pixels. Pink and magenta tones. 512x128 total.`,
    aspectRatio: "16:9",
    category: "world-objects",
  },
  {
    id: "current-arrow",
    filename: "current-arrow.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a water current flow arrow, 2 frames side by side in a horizontal strip on transparent background. Frame 1: water flow arrow pointing right with droplets. Frame 2: animated water flow arrow with splash particles. Each frame 32x32 pixels. Cyan and teal water tones. 64x32 total.`,
    category: "world-objects",
  },
  {
    id: "fog-wisp",
    filename: "fog-wisp.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a drifting fog wisp particle, 2 frames side by side in a horizontal strip on transparent background. Frame 1: small fog wisp curling to the left. Frame 2: fog wisp curling to the right. Each frame 16x16 pixels. Gray-purple ethereal tones. 32x16 total.`,
    category: "world-objects",
  },
];

// ─── CLI Helpers ────────────────────────────────────────────────────────

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function getAssetPath(filename: string): string {
  return path.join(process.cwd(), "public", "assets", filename);
}

function assetExists(filename: string): boolean {
  return fs.existsSync(getAssetPath(filename));
}

// ─── Generation with tracking ──────────────────────────────────────────

interface GenerationResult {
  generated: string[];
  skipped: string[];
  failed: { id: string; error: string }[];
}

let currentDelay = 1000;

async function generateAsset(
  prompt: AssetPrompt,
  force: boolean,
): Promise<{ status: "generated" | "skipped" | "failed"; error?: string }> {
  const outputDir = path.join(process.cwd(), "public", "assets");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, prompt.filename);

  // Ensure subdirectories exist (e.g., backgrounds/)
  const outputFileDir = path.dirname(outputPath);
  if (!fs.existsSync(outputFileDir)) {
    fs.mkdirSync(outputFileDir, { recursive: true });
  }

  if (fs.existsSync(outputPath) && !force) {
    console.log(`[skip] ${prompt.filename} already exists`);
    return { status: "skipped" };
  }

  if (force && fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
    console.log(`[force] Deleted existing ${prompt.filename}`);
  }

  console.log(`[gen] Generating ${prompt.filename}...`);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: prompt.prompt,
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: prompt.aspectRatio || "1:1",
        },
      },
    });

    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
      console.error(`[err] No content in response for ${prompt.filename}`);
      return { status: "failed", error: "No content in response" };
    }

    for (const part of candidate.content.parts) {
      if (part.inlineData?.data) {
        const buffer = Buffer.from(part.inlineData.data, "base64");
        fs.writeFileSync(outputPath, buffer);
        console.log(`[ok] Saved ${prompt.filename} (${buffer.length} bytes)`);
        currentDelay = 1000;
        return { status: "generated" };
      }
    }

    console.error(`[err] No image data in response for ${prompt.filename}`);
    return { status: "failed", error: "No image data in response" };
  } catch (error) {
    const errMsg =
      error instanceof Error ? error.message : String(error);
    console.error(`[err] Failed to generate ${prompt.filename}: ${errMsg}`);

    // Back off on rate limit errors
    if (errMsg.toLowerCase().includes("rate") || errMsg.includes("429")) {
      currentDelay = Math.min(currentDelay * 2, 10000);
      console.log(`[backoff] Increasing delay to ${currentDelay}ms`);
    }

    return { status: "failed", error: errMsg };
  }
}

// ─── List command ──────────────────────────────────────────────────────

function listAssets(assets: AssetPrompt[]) {
  const grouped = new Map<AssetCategory, AssetPrompt[]>();
  for (const cat of VALID_CATEGORIES) {
    grouped.set(cat, []);
  }
  for (const asset of assets) {
    grouped.get(asset.category)!.push(asset);
  }

  let totalExist = 0;
  let totalMissing = 0;
  for (const asset of assets) {
    if (assetExists(asset.filename)) totalExist++;
    else totalMissing++;
  }

  console.log(
    `=== Inkbinders Assets (${assets.length} total, ${totalExist} exist, ${totalMissing} missing) ===\n`,
  );

  for (const [cat, catAssets] of grouped) {
    if (catAssets.length === 0) continue;
    let catExist = 0;
    let catMissing = 0;
    for (const a of catAssets) {
      if (assetExists(a.filename)) catExist++;
      else catMissing++;
    }

    console.log(
      `[${cat}] (${catAssets.length} total, ${catExist} exist, ${catMissing} missing)`,
    );
    for (const a of catAssets) {
      const status = assetExists(a.filename) ? "\u2713" : "\u2717";
      console.log(
        `  ${status} ${a.id.padEnd(28)} \u2192 ${a.filename}`,
      );
    }
    console.log();
  }
}

// ─── Dry-run command ───────────────────────────────────────────────────

function dryRun(assets: AssetPrompt[], force: boolean) {
  const toGenerate = assets.filter(
    (a) => force || !assetExists(a.filename),
  );

  if (toGenerate.length === 0) {
    console.log("[dry-run] All assets already exist. Nothing to generate.");
    return;
  }

  console.log(
    `[dry-run] Would generate ${toGenerate.length} asset${toGenerate.length === 1 ? "" : "s"}:`,
  );
  for (const a of toGenerate) {
    console.log(`  ${a.id} \u2192 ${a.filename}`);
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

async function main() {
  const categoryArg = getArg("--category");
  const force = hasFlag("--force");
  const dryRunFlag = hasFlag("--dry-run");
  const listFlag = hasFlag("--list");

  // Filter by category if specified
  let assets = ASSET_PROMPTS;
  if (categoryArg) {
    if (!VALID_CATEGORIES.includes(categoryArg as AssetCategory)) {
      console.error(`Unknown category: "${categoryArg}"\n`);
      console.log("Available categories:");
      for (const cat of VALID_CATEGORIES) {
        const count = ASSET_PROMPTS.filter((a) => a.category === cat).length;
        console.log(`  ${cat.padEnd(16)} (${count} assets)`);
      }
      process.exit(1);
    }
    assets = ASSET_PROMPTS.filter((a) => a.category === categoryArg);
  }

  // --list: print asset status and exit
  if (listFlag) {
    listAssets(assets);
    return;
  }

  // --dry-run: preview what would be generated and exit
  if (dryRunFlag) {
    dryRun(assets, force);
    return;
  }

  // Generation mode
  const existingCount = assets.filter((a) => assetExists(a.filename)).length;
  if (force && existingCount > 0) {
    console.log(
      `--force: Will regenerate ${existingCount} existing asset${existingCount === 1 ? "" : "s"}`,
    );
  }

  console.log("=== Inkbinders Asset Generator ===");
  console.log(
    `Processing ${assets.length} assets${categoryArg ? ` (category: ${categoryArg})` : ""}...\n`,
  );

  const result: GenerationResult = {
    generated: [],
    skipped: [],
    failed: [],
  };

  for (const prompt of assets) {
    const { status, error } = await generateAsset(prompt, force);
    if (status === "generated") result.generated.push(prompt.id);
    else if (status === "skipped") result.skipped.push(prompt.id);
    else
      result.failed.push({
        id: prompt.id,
        error: error ?? "unknown error",
      });

    await new Promise((r) => setTimeout(r, currentDelay));
  }

  // Print summary
  console.log("\n=== Generation Complete ===");
  console.log(`Generated: ${result.generated.length}`);
  console.log(`Skipped (existing): ${result.skipped.length}`);
  console.log(`Failed: ${result.failed.length}`);
  if (result.failed.length > 0) {
    for (const f of result.failed) {
      console.log(`  - ${f.id} (${f.error})`);
    }
  }
  console.log(
    `Total: ${result.generated.length + result.skipped.length}/${assets.length}`,
  );

  if (result.failed.length > 0) {
    console.log(
      `\nRe-run with: npx tsx scripts/generate-assets.ts${categoryArg ? ` --category ${categoryArg}` : ""} to retry failed assets`,
    );
  }
}

main();
