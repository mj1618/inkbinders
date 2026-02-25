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
  {
    id: "player-idle",
    filename: "player-idle.png",
    prompt: `${STYLE_PREFIX} small hooded archivist character, front-facing idle pose, wearing ink-stained robe with scroll belt, chunky readable silhouette, warm parchment and indigo tones, 64x64 pixel art scale, game sprite`,
  },
  {
    id: "player-run",
    filename: "player-run-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character running, 4 frames side by side in a horizontal strip, each frame 64x64 pixels, ink-stained robe flowing, dynamic pose progression, warm parchment and indigo tones, game sprite sheet, 256x64 total`,
    aspectRatio: "16:9",
  },
  {
    id: "player-jump",
    filename: "player-jump-sheet.png",
    prompt: `${STYLE_PREFIX} sprite sheet of a small hooded archivist character jumping, 3 frames side by side: jump launch crouching, mid-air at apex with robe flowing, falling with arms up, each frame 64x64 pixels, warm parchment and indigo tones, game sprite sheet, 192x64 total`,
    aspectRatio: "16:9",
  },
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
