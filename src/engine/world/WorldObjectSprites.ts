// WorldObjectSprites — sprite sheet configs, animation definitions, and rendering helpers
// for interactive and decorative world objects: vines, obstacles, gates, exits, gravity wells,
// current zones, and fog zone boundaries.

import type { SpriteSheetConfig, AnimationDef } from "@/engine/core/SpriteSheet";
import { AnimationController } from "@/engine/core/AnimationController";
import { AssetManager } from "@/engine/core/AssetManager";
import { RenderConfig } from "@/engine/core/RenderConfig";
import type { Obstacle } from "@/engine/physics/Obstacles";

// ─── Sprite Sheet Configs ────────────────────────────────────────────

const VINE_ROPE_CONFIG: SpriteSheetConfig = {
  id: "vine-rope",
  src: "/assets/vine-rope.png",
  frameWidth: 8,
  frameHeight: 32,
  columns: 1,
  totalFrames: 1,
};

const VINE_ANCHOR_CONFIG: SpriteSheetConfig = {
  id: "vine-anchor",
  src: "/assets/vine-anchor.png",
  frameWidth: 32,
  frameHeight: 32,
  columns: 2,
  totalFrames: 2,
};

const SPIKES_UP_CONFIG: SpriteSheetConfig = {
  id: "spikes-up",
  src: "/assets/spikes-up.png",
  frameWidth: 32,
  frameHeight: 32,
  columns: 1,
  totalFrames: 1,
};

const SPIKES_DOWN_CONFIG: SpriteSheetConfig = {
  id: "spikes-down",
  src: "/assets/spikes-down.png",
  frameWidth: 32,
  frameHeight: 32,
  columns: 1,
  totalFrames: 1,
};

const SPIKES_LEFT_CONFIG: SpriteSheetConfig = {
  id: "spikes-left",
  src: "/assets/spikes-left.png",
  frameWidth: 32,
  frameHeight: 32,
  columns: 1,
  totalFrames: 1,
};

const SPIKES_RIGHT_CONFIG: SpriteSheetConfig = {
  id: "spikes-right",
  src: "/assets/spikes-right.png",
  frameWidth: 32,
  frameHeight: 32,
  columns: 1,
  totalFrames: 1,
};

const BARRIER_CONFIG: SpriteSheetConfig = {
  id: "barrier",
  src: "/assets/barrier.png",
  frameWidth: 32,
  frameHeight: 32,
  columns: 1,
  totalFrames: 1,
};

const LASER_BEAM_CONFIG: SpriteSheetConfig = {
  id: "laser-beam",
  src: "/assets/laser-beam.png",
  frameWidth: 32,
  frameHeight: 8,
  columns: 2,
  totalFrames: 2,
};

const ABILITY_GATE_CONFIG: SpriteSheetConfig = {
  id: "ability-gate",
  src: "/assets/ability-gate.png",
  frameWidth: 16,
  frameHeight: 96,
  columns: 4,
  totalFrames: 4,
};

const EXIT_ARROW_CONFIG: SpriteSheetConfig = {
  id: "exit-arrow",
  src: "/assets/exit-arrow.png",
  frameWidth: 32,
  frameHeight: 32,
  columns: 2,
  totalFrames: 2,
};

const GRAVITY_WELL_ATTRACT_CONFIG: SpriteSheetConfig = {
  id: "gravity-well-attract",
  src: "/assets/gravity-well-attract.png",
  frameWidth: 128,
  frameHeight: 128,
  columns: 4,
  totalFrames: 4,
};

const GRAVITY_WELL_REPEL_CONFIG: SpriteSheetConfig = {
  id: "gravity-well-repel",
  src: "/assets/gravity-well-repel.png",
  frameWidth: 128,
  frameHeight: 128,
  columns: 4,
  totalFrames: 4,
};

const CURRENT_ARROW_CONFIG: SpriteSheetConfig = {
  id: "current-arrow",
  src: "/assets/current-arrow.png",
  frameWidth: 32,
  frameHeight: 32,
  columns: 2,
  totalFrames: 2,
};

const FOG_WISP_CONFIG: SpriteSheetConfig = {
  id: "fog-wisp",
  src: "/assets/fog-wisp.png",
  frameWidth: 16,
  frameHeight: 16,
  columns: 2,
  totalFrames: 2,
};

// ─── All Configs ─────────────────────────────────────────────────────

export const WORLD_OBJECT_SPRITE_CONFIGS: SpriteSheetConfig[] = [
  VINE_ROPE_CONFIG,
  VINE_ANCHOR_CONFIG,
  SPIKES_UP_CONFIG,
  SPIKES_DOWN_CONFIG,
  SPIKES_LEFT_CONFIG,
  SPIKES_RIGHT_CONFIG,
  BARRIER_CONFIG,
  LASER_BEAM_CONFIG,
  ABILITY_GATE_CONFIG,
  EXIT_ARROW_CONFIG,
  GRAVITY_WELL_ATTRACT_CONFIG,
  GRAVITY_WELL_REPEL_CONFIG,
  CURRENT_ARROW_CONFIG,
  FOG_WISP_CONFIG,
];

// ─── Animation Definitions ──────────────────────────────────────────

export const WORLD_OBJECT_ANIMATIONS: Record<string, AnimationDef[]> = {
  "vine-anchor": [
    { name: "idle", frames: [0], fps: 1, loop: true },
    { name: "active", frames: [0, 1], fps: 4, loop: true },
  ],
  "laser-beam": [
    { name: "pulse", frames: [0, 1], fps: 6, loop: true },
  ],
  "exit-arrow": [
    { name: "pulse", frames: [0, 1], fps: 3, loop: true },
  ],
  "gravity-well-attract": [
    { name: "pulse", frames: [0, 1, 2, 3], fps: 4, loop: true },
  ],
  "gravity-well-repel": [
    { name: "pulse", frames: [0, 1, 2, 3], fps: 4, loop: true },
  ],
  "current-arrow": [
    { name: "flow", frames: [0, 1], fps: 4, loop: true },
  ],
  "fog-wisp": [
    { name: "drift", frames: [0, 1], fps: 2, loop: true },
  ],
};

// ─── Helper Accessors ────────────────────────────────────────────────

export function getWorldObjectConfigs(): SpriteSheetConfig[] {
  return WORLD_OBJECT_SPRITE_CONFIGS;
}

export function getWorldObjectAnimations(): Record<string, AnimationDef[]> {
  return WORLD_OBJECT_ANIMATIONS;
}

// ─── Asset Loading ───────────────────────────────────────────────────

/** Load all world object sprite sheets and register animations. */
export async function loadWorldObjectSprites(): Promise<void> {
  const am = AssetManager.getInstance();
  await am.loadAll(WORLD_OBJECT_SPRITE_CONFIGS);

  // Register animations on loaded sheets
  for (const [sheetId, anims] of Object.entries(WORLD_OBJECT_ANIMATIONS)) {
    const sheet = am.getSpriteSheet(sheetId);
    if (sheet) {
      for (const anim of anims) {
        sheet.addAnimation(anim);
      }
    }
  }
}

// ─── Obstacle Sprite Rendering ───────────────────────────────────────

/** Gate ability → ability-gate frame index mapping */
const GATE_ABILITY_FRAME: Record<string, number> = {
  "margin-stitch": 0,
  redaction: 1,
  "paste-over": 2,
  "index-mark": 3,
};

/**
 * Determine spike direction sheet ID based on obstacle rect shape.
 * Wider-than-tall → horizontal (up/down), taller-than-wide → vertical (left/right).
 */
function getSpikeSheetId(obstacle: Obstacle): string {
  if (obstacle.rect.width > obstacle.rect.height * 2) {
    return "spikes-up"; // horizontal spike strip (default up)
  }
  if (obstacle.rect.height > obstacle.rect.width * 2) {
    return "spikes-left"; // vertical spike strip (default left)
  }
  return "spikes-up";
}

/**
 * Render an obstacle as a sprite. Returns true if the sprite was drawn.
 * Callers should use this within a RenderConfig.useSprites() check.
 */
export function renderObstacleSprite(
  ctx: CanvasRenderingContext2D,
  obstacle: Obstacle,
  assetManager?: AssetManager,
  time?: number,
): boolean {
  const am = assetManager ?? AssetManager.getInstance();
  const { rect, type } = obstacle;

  if (type === "spikes") {
    const sheetId = getSpikeSheetId(obstacle);
    const sheet = am.getSpriteSheet(sheetId);
    if (!sheet) return false;

    const fw = sheet.config.frameWidth;
    const fh = sheet.config.frameHeight;

    // Tile spikes across the obstacle area
    for (let x = rect.x; x < rect.x + rect.width; x += fw) {
      for (let y = rect.y; y < rect.y + rect.height; y += fh) {
        const drawW = Math.min(fw, rect.x + rect.width - x);
        const drawH = Math.min(fh, rect.y + rect.height - y);
        if (drawW === fw && drawH === fh) {
          sheet.drawFrame(ctx, 0, x, y);
        } else {
          // Partial tile — clip
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, drawW, drawH);
          ctx.clip();
          sheet.drawFrame(ctx, 0, x, y);
          ctx.restore();
        }
      }
    }
    return true;
  }

  if (type === "barrier") {
    const sheet = am.getSpriteSheet("barrier");
    if (!sheet) return false;

    const fw = sheet.config.frameWidth;
    const fh = sheet.config.frameHeight;

    // Tile barrier vertically
    for (let y = rect.y; y < rect.y + rect.height; y += fh) {
      for (let x = rect.x; x < rect.x + rect.width; x += fw) {
        const drawW = Math.min(fw, rect.x + rect.width - x);
        const drawH = Math.min(fh, rect.y + rect.height - y);
        if (drawW === fw && drawH === fh) {
          sheet.drawFrame(ctx, 0, x, y);
        } else {
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, drawW, drawH);
          ctx.clip();
          sheet.drawFrame(ctx, 0, x, y);
          ctx.restore();
        }
      }
    }
    return true;
  }

  if (type === "laser") {
    const sheet = am.getSpriteSheet("laser-beam");
    if (!sheet) return false;

    const fw = sheet.config.frameWidth;
    const fh = sheet.config.frameHeight;

    // Use game time for frame toggle (fall back to performance.now if no time passed)
    const t = time ?? performance.now() / 1000;
    const frameIdx = Math.floor(t * 6) % 2;

    // Tile laser horizontally
    for (let x = rect.x; x < rect.x + rect.width; x += fw) {
      for (let y = rect.y; y < rect.y + rect.height; y += fh) {
        const drawW = Math.min(fw, rect.x + rect.width - x);
        const drawH = Math.min(fh, rect.y + rect.height - y);
        if (drawW === fw && drawH === fh) {
          sheet.drawFrame(ctx, frameIdx, x, y);
        } else {
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, drawW, drawH);
          ctx.clip();
          sheet.drawFrame(ctx, frameIdx, x, y);
          ctx.restore();
        }
      }
    }
    return true;
  }

  return false;
}

/**
 * Get the ability-gate frame index for a given gate ability.
 */
export function getGateFrameIndex(ability: string): number {
  return GATE_ABILITY_FRAME[ability] ?? 0;
}

/**
 * Get the exit arrow rotation in radians based on exit direction.
 * Base sprite faces right (0 radians).
 */
export function getExitArrowRotation(direction: string): number {
  switch (direction) {
    case "right":
      return 0;
    case "bottom":
      return Math.PI / 2;
    case "left":
      return Math.PI;
    case "top":
      return -Math.PI / 2;
    default:
      return 0;
  }
}
