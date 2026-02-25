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
  // Tile sets
  {
    id: "tiles-scribe-hall",
    filename: "tiles-scribe-hall.png",
    prompt: `${STYLE_PREFIX} 2D game tileset for a cozy library, 4 tiles in a row: wooden floor plank, wooden shelf block, stone wall block, wooden beam, each tile 32x32 pixels, warm brown and parchment tones, seamless tileable edges, game tileset, 128x32 total`,
    aspectRatio: "16:9",
  },
  {
    id: "tiles-herbarium",
    filename: "tiles-herbarium.png",
    prompt: `${STYLE_PREFIX} 2D game tileset for an enchanted botanical garden library, 4 tiles in a row: vine-covered stone floor, mossy stone block, leaf-wrapped column, thorny hedge block, each tile 32x32 pixels, deep green and aged parchment tones, seamless tileable edges, game tileset, 128x32 total`,
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
