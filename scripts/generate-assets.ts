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

interface AssetPrompt {
  id: string;
  filename: string;
  prompt: string;
  aspectRatio?: string;
}

const ASSET_PROMPTS: AssetPrompt[] = [
  // Player sprite sheets (9 total)
  {
    id: "player-idle",
    filename: "player-idle.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character in idle breathing pose, 4 frames side by side in a horizontal strip, subtle breathing animation: chest rises and falls, robe sways gently, each frame 64x64 pixels, warm parchment and indigo tones, game sprite sheet, 256x64 total`,
    aspectRatio: "16:9",
  },
  {
    id: "player-run",
    filename: "player-run-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character running, 6 frames side by side in a horizontal strip, full run cycle with contact-pass-reach progression, ink-stained robe flowing, each frame 64x64 pixels, warm parchment and indigo tones, game sprite sheet, 384x64 total`,
    aspectRatio: "16:9",
  },
  {
    id: "player-jump",
    filename: "player-jump-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character jumping, 3 frames side by side: jump launch crouching, mid-air at apex with robe flowing, falling with arms up, each frame 64x64 pixels, warm parchment and indigo tones, game sprite sheet, 192x64 total`,
    aspectRatio: "16:9",
  },
  {
    id: "player-dash",
    filename: "player-dash-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character dashing, 3 frames side by side: wind-up crouch with trailing ink, mid-dash blur with ink streak behind, dash exit with momentum lean, each frame 64x64 pixels, warm parchment and hot pink ink trail tones, game sprite sheet, 192x64 total`,
    aspectRatio: "16:9",
  },
  {
    id: "player-wall-slide",
    filename: "player-wall-slide-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character sliding down a wall, 2 frames side by side: gripping wall with one hand reaching up, sliding down with robe trailing upward, each frame 64x64 pixels, warm parchment and teal tones, game sprite sheet, 128x64 total`,
    aspectRatio: "16:9",
  },
  {
    id: "player-crouch",
    filename: "player-crouch-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character crouching, 2 frames side by side: low crouch with robe pooled around feet, crouch-slide with speed lines and robe streaming behind, each frame 64x64 pixels, warm parchment and dark blue tones, game sprite sheet, 128x64 total`,
    aspectRatio: "16:9",
  },
  {
    id: "player-land",
    filename: "player-land-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character landing hard, 3 frames side by side: heavy impact with dust puff and squashed pose, recovery pushing up from ground, standing up with slight wobble, each frame 64x64 pixels, warm parchment and amber tones, game sprite sheet, 192x64 total`,
    aspectRatio: "16:9",
  },
  {
    id: "player-attack-spear",
    filename: "player-attack-spear-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character thrusting a quill spear, 4 frames side by side: wind-up with spear pulled back, forward thrust with arm extended, spear at full extension with ink splash at tip, recovery pulling spear back, each frame 96x64 pixels (wider to show spear reach), warm parchment and steel blue tones, game sprite sheet, 384x64 total`,
    aspectRatio: "16:9",
  },
  {
    id: "player-attack-snap",
    filename: "player-attack-snap-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character performing an ink snap attack, 3 frames side by side: hand raised with gathering ink energy, snap gesture with ink burst radiating outward, fade out with ink droplets scattering, each frame 64x64 pixels, warm parchment and dark violet tones, game sprite sheet, 192x64 total`,
    aspectRatio: "16:9",
  },
  // Reader sprite sheets (4 total, 48×48 frames)
  {
    id: "reader-idle",
    filename: "reader-idle-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small frantic book creature called a Reader, 2 frames side by side, idle pose with pages fluttering nervously, hunched posture with visible spine ridges, each frame 48x48 pixels, red and dark parchment tones, game sprite sheet, 96x48 total`,
    aspectRatio: "16:9",
  },
  {
    id: "reader-rush",
    filename: "reader-rush-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small frantic book creature called a Reader rushing forward, 4 frames side by side, scrambling run with pages flying off, limbs flailing, speed lines, each frame 48x48 pixels, red and dark parchment tones, game sprite sheet, 192x48 total`,
    aspectRatio: "16:9",
  },
  {
    id: "reader-hit",
    filename: "reader-hit-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small book creature called a Reader getting hit, 2 frames side by side: recoil with pages scattering, dazed with stars, each frame 48x48 pixels, red and parchment tones, game sprite sheet, 96x48 total`,
    aspectRatio: "16:9",
  },
  {
    id: "reader-death",
    filename: "reader-death-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small book creature called a Reader dying, 3 frames side by side: crumpling inward, pages exploding outward, pile of loose pages on ground, each frame 48x48 pixels, red fading to gray tones, game sprite sheet, 144x48 total`,
    aspectRatio: "16:9",
  },
  // Binder sprite sheets (4 total, 64×64 frames)
  {
    id: "binder-idle",
    filename: "binder-idle-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a hunched thread-caster creature called a Binder, 2 frames side by side, idle weaving pose with glowing threads between hands, robed figure with thread tendrils, each frame 64x64 pixels, purple and dark ink tones, game sprite sheet, 128x64 total`,
    aspectRatio: "16:9",
  },
  {
    id: "binder-grapple",
    filename: "binder-grapple-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a thread-caster creature called a Binder shooting and retracting a thread, 5 frames in a row: arm extending with thread launching forward, thread stretching out, thread taut at full extension, thread pulling back with tension, arm retracted with thread coiled, each frame 64x64 pixels, purple and glowing thread tones, game sprite sheet, 320x64 total`,
    aspectRatio: "16:9",
  },
  {
    id: "binder-hit",
    filename: "binder-hit-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a robed thread-caster creature getting hit, 2 frames side by side: flinch with threads snapping, recoil with arms raised, each frame 64x64 pixels, purple and parchment tones, game sprite sheet, 128x64 total`,
    aspectRatio: "16:9",
  },
  {
    id: "binder-death",
    filename: "binder-death-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a robed thread-caster creature dying, 3 frames side by side: collapsing with threads unraveling, dissolving into loose threads, pile of tangled threads on ground, each frame 64x64 pixels, purple fading to gray, game sprite sheet, 192x64 total`,
    aspectRatio: "16:9",
  },
  // Proofwarden sprite sheets (5 total, 64×64 frames)
  {
    id: "proofwarden-idle",
    filename: "proofwarden-idle-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of an armored sentinel creature called a Proofwarden, 2 frames side by side, imposing stance with glowing shield in one hand, ink-etched armor with proofreading marks, each frame 64x64 pixels, blue and iron gray tones, game sprite sheet, 128x64 total`,
    aspectRatio: "16:9",
  },
  {
    id: "proofwarden-shield",
    filename: "proofwarden-shield-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of an armored sentinel raising and losing its shield, 5 frames in a row: shield raised with bright glow, shield at full power with energy aura, shield cracking with sparks, shield shattering with fragments, shield gone with staggered pose, each frame 64x64 pixels, blue glow to dim gray transition, game sprite sheet, 320x64 total`,
    aspectRatio: "16:9",
  },
  {
    id: "proofwarden-attack",
    filename: "proofwarden-attack-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of an armored sentinel doing a ground slam attack, 3 frames in a row: winding up with fist raised high, slamming down with shockwave ring, impact with ground crack lines radiating outward, each frame 64x64 pixels, blue and iron tones with impact yellow, game sprite sheet, 192x64 total`,
    aspectRatio: "16:9",
  },
  {
    id: "proofwarden-hit",
    filename: "proofwarden-hit-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of an armored sentinel getting hit, 2 frames side by side: armor sparking on impact, staggering backward, each frame 64x64 pixels, blue and iron gray tones, game sprite sheet, 128x64 total`,
    aspectRatio: "16:9",
  },
  {
    id: "proofwarden-death",
    filename: "proofwarden-death-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of an armored sentinel dying, 3 frames side by side: armor cracking and falling off, collapsing to knees with ink leaking, crumpled armor pile on ground, each frame 64x64 pixels, iron gray fading to black, game sprite sheet, 192x64 total`,
    aspectRatio: "16:9",
  },
  // ─── Footnote Giant sprite sheets (5 total, 128×128 frames) ─────
  {
    id: "giant-idle",
    filename: "giant-idle-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a massive towering footnote golem made of stacked books and parchment, 4 frames in a horizontal strip, idle breathing animation with pages rustling gently, heavy stone-like base, glowing arcane symbols on spine, each frame 128x128 pixels, indigo and gold tones, game boss sprite sheet, 512x128 total`,
    aspectRatio: "16:9",
  },
  {
    id: "giant-stomp",
    filename: "giant-stomp-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a massive footnote golem stomping attack, 4 frames in a horizontal strip: telegraph pose with arm raised, downward slam impact, shockwave burst from ground, stuck in ground recovery, each frame 128x128 pixels, indigo and orange impact tones, game boss sprite sheet, 512x128 total`,
    aspectRatio: "16:9",
  },
  {
    id: "giant-sweep",
    filename: "giant-sweep-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a massive footnote golem sweeping beam attack, 4 frames in a horizontal strip: telegraph pose with energy gathering, beam extending left, beam at full width, beam fading, each frame 128x128 pixels, indigo and red beam tones, game boss sprite sheet, 512x128 total`,
    aspectRatio: "16:9",
  },
  {
    id: "giant-vulnerable",
    filename: "giant-vulnerable-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a massive footnote golem in a stunned vulnerable state, 2 frames in a horizontal strip: dazed wobble left, dazed wobble right, stars and symbols circling head, cracked pages falling, each frame 128x128 pixels, indigo with yellow vulnerability glow, game boss sprite sheet, 256x128 total`,
    aspectRatio: "16:9",
  },
  {
    id: "giant-death",
    filename: "giant-death-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a massive footnote golem collapsing and dying, 4 frames in a horizontal strip: cracking apart, tilting over, crumbling to pieces, scattered pages on ground, each frame 128x128 pixels, fading indigo tones, game boss sprite sheet, 512x128 total`,
    aspectRatio: "16:9",
  },
  // ─── Misprint Seraph sprite sheets (5 total, 128×128 frames) ───
  {
    id: "seraph-hover",
    filename: "seraph-hover-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of an angelic floating seraph creature made of misprinted pages with torn paper wings, 4 frames in a horizontal strip, hovering animation with wing flaps and floating page debris, ethereal white and red corruption tones, halo of punctuation marks, each frame 128x128 pixels, game boss sprite sheet, 512x128 total`,
    aspectRatio: "16:9",
  },
  {
    id: "seraph-dive",
    filename: "seraph-dive-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a paper seraph diving downward in attack, 3 frames in a horizontal strip: wings tucked preparing to dive, mid-dive with wings swept back and speed lines, impact pose at bottom, each frame 128x128 pixels, white and red tones, game boss sprite sheet, 384x128 total`,
    aspectRatio: "16:9",
  },
  {
    id: "seraph-cast",
    filename: "seraph-cast-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a paper seraph casting a glyph spell, 4 frames in a horizontal strip: gathering energy with glowing hands, arms outstretched channeling, energy beams projecting from hands, spell release with page burst, each frame 128x128 pixels, white body with red energy tones, game boss sprite sheet, 512x128 total`,
    aspectRatio: "16:9",
  },
  {
    id: "seraph-stagger",
    filename: "seraph-stagger-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a paper seraph in a stunned staggering state, 2 frames in a horizontal strip: wings drooping and body tilted left, wings drooping and body tilted right, pages falling from body, each frame 128x128 pixels, dimmed white tones, game boss sprite sheet, 256x128 total`,
    aspectRatio: "16:9",
  },
  {
    id: "seraph-death",
    filename: "seraph-death-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a paper seraph dissolving in death, 4 frames in a horizontal strip: wings crumpling, body splitting into pages, pages scattering outward, final wisps of paper dust, each frame 128x128 pixels, fading white tones, game boss sprite sheet, 512x128 total`,
    aspectRatio: "16:9",
  },
  // ─── Index Eater sprite sheets (6 total, 128×96 frames) ────────
  {
    id: "eater-crawl",
    filename: "eater-crawl-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a segmented centipede-like creature made of filing tabs and index cards, 4 frames in a horizontal strip, crawling animation with undulating body segments and many tab-legs, tan and dark brown tones, wide low creature, each frame 128x96 pixels, game boss sprite sheet, 512x96 total`,
    aspectRatio: "16:9",
  },
  {
    id: "eater-lunge",
    filename: "eater-lunge-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a filing-tab centipede lunging forward to attack, 3 frames in a horizontal strip: coiled back preparing to strike, mid-lunge with body extended and jaws open, full extension with mouth snapping, each frame 128x96 pixels, tan and red danger tones, game boss sprite sheet, 384x96 total`,
    aspectRatio: "16:9",
  },
  {
    id: "eater-devour",
    filename: "eater-devour-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a filing-tab centipede devouring a platform, 4 frames in a horizontal strip: mouth opening wide, chomping down on floor piece, chewing with debris, stunned and bloated from overeating, each frame 128x96 pixels, tan with dark ink stain tones, game boss sprite sheet, 512x96 total`,
    aspectRatio: "16:9",
  },
  {
    id: "eater-spit",
    filename: "eater-spit-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a filing-tab centipede spitting card projectiles, 3 frames in a horizontal strip: head rearing back, mouth opening with visible cards, cards launching outward in fan pattern, each frame 128x96 pixels, tan body with amber projectile tones, game boss sprite sheet, 384x96 total`,
    aspectRatio: "16:9",
  },
  {
    id: "eater-stunned",
    filename: "eater-stunned-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a filing-tab centipede in stunned vulnerable state, 2 frames in a horizontal strip: belly exposed and legs twitching left, belly exposed and legs twitching right, tabs splayed out weakly, each frame 128x96 pixels, pale tan vulnerability tones, game boss sprite sheet, 256x96 total`,
    aspectRatio: "16:9",
  },
  {
    id: "eater-death",
    filename: "eater-death-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a filing-tab centipede dying and falling apart, 4 frames in a horizontal strip: body cracking, segments separating, tabs and cards scattering, pile of loose papers on ground, each frame 128x96 pixels, fading tan tones, game boss sprite sheet, 512x96 total`,
    aspectRatio: "16:9",
  },
  // Tile sets
  {
    id: "tiles-scribe-hall",
    filename: "tiles-scribe-hall.png",
    prompt: `${STYLE_PREFIX} 2D game tileset for a cozy library, 4 tiles in a row: wooden floor plank, wooden shelf block, stone wall block, wooden beam, each tile 32x32 pixels, warm brown and parchment tones, seamless tileable edges, game tileset, 128x32 total`,
    aspectRatio: "16:9",
  },
  {
    id: "tiles-herbarium-folio",
    filename: "tiles-herbarium-folio.png",
    prompt: `${STYLE_PREFIX} 2D game tileset for an enchanted botanical garden library, 4 tiles in a row: vine-covered stone floor, mossy stone block, leaf-wrapped column, thorny hedge block, each tile 32x32 pixels, deep green and aged parchment tones, seamless tileable edges, game tileset, 128x32 total`,
    aspectRatio: "16:9",
  },
  {
    id: "tiles-astral-atlas",
    filename: "tiles-astral-atlas.png",
    prompt: `${STYLE_PREFIX} 2D game tileset for a cosmic astral library, 4 tiles in a row: star-glass floor tile with glowing constellation lines, solid constellation block with embedded star patterns, nebula pillar tile with swirling purple-blue gas, void edge wall tile with dark boundary glow, each tile 32x32 pixels, deep navy blue and silver and gold star point tones, seamless tileable edges, game tileset, 128x32 total`,
    aspectRatio: "16:9",
  },
  {
    id: "tiles-maritime-ledger",
    filename: "tiles-maritime-ledger.png",
    prompt: `${STYLE_PREFIX} 2D game tileset for a nautical maritime library, 4 tiles in a row: driftwood plank floor tile with wood grain, coral block tile with barnacle detail, barnacle-encrusted pillar tile, kelp-draped wall tile, each tile 32x32 pixels, teal and sand and weathered wood brown and ocean blue tones, seamless tileable edges, game tileset, 128x32 total`,
    aspectRatio: "16:9",
  },
  {
    id: "tiles-gothic-errata",
    filename: "tiles-gothic-errata.png",
    prompt: `${STYLE_PREFIX} 2D game tileset for a dark gothic library, 4 tiles in a row: cracked stone floor tile with faint red veins, gargoyle-decorated solid block tile, iron column tile with rivets and rust, fog grate wall tile with wisps seeping through, each tile 32x32 pixels, dark charcoal gray and deep crimson and iron black and ash white tones, seamless tileable edges, game tileset, 128x32 total`,
    aspectRatio: "16:9",
  },
];

async function generateAsset(prompt: AssetPrompt): Promise<void> {
  const outputDir = path.join(process.cwd(), "public", "assets");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, prompt.filename);

  if (fs.existsSync(outputPath)) {
    console.log(`[skip] ${prompt.filename} already exists`);
    return;
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
      return;
    }

    for (const part of candidate.content.parts) {
      if (part.inlineData?.data) {
        const buffer = Buffer.from(part.inlineData.data, "base64");
        fs.writeFileSync(outputPath, buffer);
        console.log(`[ok] Saved ${prompt.filename} (${buffer.length} bytes)`);
        return;
      }
    }

    console.error(`[err] No image data in response for ${prompt.filename}`);
  } catch (error) {
    console.error(`[err] Failed to generate ${prompt.filename}:`, error);
  }
}

async function main() {
  console.log("=== Inkbinders Asset Generator ===");
  console.log(`Generating ${ASSET_PROMPTS.length} assets...\n`);

  for (const prompt of ASSET_PROMPTS) {
    await generateAsset(prompt);
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log("\nDone!");
}

main();
