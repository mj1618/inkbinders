// BiomeBackground — parallax background rendering for biome visual depth

import { RenderConfig } from "@/engine/core/RenderConfig";
import { AssetManager } from "@/engine/core/AssetManager";
import { BIOME_BACKGROUND_LAYERS } from "./BiomeBackgroundSprites";

export interface BackgroundLayer {
  /** Scroll speed relative to camera (0 = fixed, 1 = moves with camera) */
  parallaxFactor: number;
  /** If true, this layer renders OVER the player (foreground depth) */
  foreground?: boolean;
  /** Layer opacity (0.0–1.0). Default: 1.0 */
  opacity?: number;
  /** Render function for this layer */
  render: (
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    canvasWidth: number,
    canvasHeight: number,
  ) => void;
}

export class BiomeBackground {
  layers: BackgroundLayer[];

  constructor(layers: BackgroundLayer[]) {
    this.layers = layers;
  }

  /** Internal helper to render a subset of layers */
  private renderLayers(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    canvasWidth: number,
    canvasHeight: number,
    foreground: boolean,
  ): void {
    for (const layer of this.layers) {
      if ((layer.foreground ?? false) !== foreground) continue;
      ctx.save();
      const prevAlpha = ctx.globalAlpha;
      ctx.globalAlpha = layer.opacity ?? 1.0;
      const offsetX = -cameraX * layer.parallaxFactor;
      ctx.translate(offsetX, 0);
      layer.render(ctx, cameraX, cameraY, canvasWidth, canvasHeight);
      ctx.globalAlpha = prevAlpha;
      ctx.restore();
    }
  }

  /** Render background layers (foreground !== true) — call BEFORE platforms/player */
  renderBackground(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    this.renderLayers(ctx, cameraX, cameraY, canvasWidth, canvasHeight, false);
  }

  /** Render foreground layers (foreground === true) — call AFTER platforms/player, before HUD */
  renderForeground(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    this.renderLayers(ctx, cameraX, cameraY, canvasWidth, canvasHeight, true);
  }

  /** Render all layers (backward-compatible — calls renderBackground then renderForeground) */
  render(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    this.renderBackground(ctx, cameraX, cameraY, canvasWidth, canvasHeight);
    this.renderForeground(ctx, cameraX, cameraY, canvasWidth, canvasHeight);
  }
}

// ─── Seeded pseudo-random for deterministic background generation ───────

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ─── Sprite layer rendering helper ──────────────────────────────────────

const BG_IMAGE_WIDTH = 960;

/**
 * Render a background sprite layer, tiling horizontally with mirror-flip to
 * hide seams. The caller's ctx has already been translated by
 * (-cameraX * parallaxFactor, 0). Sprites are drawn at y=0 (no vertical tiling
 * since images match canvas height).
 */
function renderSpriteLayer(
  ctx: CanvasRenderingContext2D,
  sheetId: string,
  cameraX: number,
  parallaxFactor: number,
  canvasWidth: number,
): void {
  const sheet = AssetManager.getInstance().getSpriteSheet(sheetId);
  if (!sheet) return;

  const visibleStart = cameraX * parallaxFactor;
  const startTile = Math.floor(visibleStart / BG_IMAGE_WIDTH);
  const endTile = Math.ceil((visibleStart + canvasWidth) / BG_IMAGE_WIDTH);

  for (let i = startTile; i <= endTile; i++) {
    const flipX = (i & 1) !== 0;
    sheet.drawFrame(ctx, 0, i * BG_IMAGE_WIDTH, 0, flipX);
  }
}

// ─── Biome background dispatch ─────────────────────────────────────────

/**
 * Create the correct parallax background for a given biome ID.
 * Falls back to a simple dark fill if the biome is unknown.
 */
export function createBackgroundForBiome(
  biomeId: string,
  levelWidth: number,
  levelHeight: number,
): BiomeBackground {
  switch (biomeId) {
    case "scribe-hall":
      return createScribeHallBackground(levelWidth, levelHeight);
    case "herbarium-folio":
      return createHerbariumBackground(levelWidth, levelHeight);
    case "astral-atlas":
      return createAstralAtlasBackground(levelWidth, levelHeight);
    case "maritime-ledger":
      return createMaritimeBackground(levelWidth, levelHeight);
    case "gothic-errata":
      return createGothicErrataBackground(levelWidth, levelHeight);
    default:
      return createDefaultBackground(levelWidth, levelHeight);
  }
}

// ─── Default background (simple gradient fill) ─────────────────────────

export function createDefaultBackground(
  levelWidth: number,
  levelHeight: number,
): BiomeBackground {
  const layers: BackgroundLayer[] = [
    {
      parallaxFactor: 0.1,
      render: (ctx, cameraX, _cameraY, canvasWidth) => {
        if (RenderConfig.useSprites()) {
          renderSpriteLayer(ctx, "bg-default-far", cameraX, 0.1, canvasWidth);
        }
        if (RenderConfig.useRectangles()) {
          ctx.fillStyle = "#0a0a0f";
          ctx.fillRect(-500, -500, levelWidth + 1000, levelHeight + 1000);
        }
      },
    },
  ];
  return new BiomeBackground(layers);
}


// ─── Scribe Hall background ─────────────────────────────────────────────


/**
 * Create the Scribe Hall parallax background layers.
 * 9-layer warm library aesthetic driven by BiomeBackgroundSprites config.
 */
export function createScribeHallBackground(
  levelWidth: number,
  levelHeight: number,
): BiomeBackground {
  const layerDefs = BIOME_BACKGROUND_LAYERS["scribe-hall"];
  if (!layerDefs) return createDefaultBackground(levelWidth, levelHeight);

  const layers: BackgroundLayer[] = layerDefs.map((def, idx) => ({
    parallaxFactor: def.parallaxFactor,
    foreground: def.foreground,
    opacity: def.opacity,
    render: (
      ctx: CanvasRenderingContext2D,
      cameraX: number,
      _cameraY: number,
      canvasWidth: number,
      canvasHeight: number,
    ) => {
      if (RenderConfig.useSprites()) {
        renderSpriteLayer(ctx, def.sheetId, cameraX, def.parallaxFactor, canvasWidth);
      }
      if (RenderConfig.useRectangles() && idx === 0) {
        const grad = ctx.createLinearGradient(0, canvasHeight, 0, 0);
        grad.addColorStop(0, "#0f0a05");
        grad.addColorStop(0.7, "#1a1512");
        grad.addColorStop(1, "#2a1a0f");
        ctx.fillStyle = grad;
        ctx.fillRect(-500, -500, levelWidth + 1000, levelHeight + 1000);
      }
    },
  }));

  return new BiomeBackground(layers);
}

// ─── Herbarium Folio background layer generators ────────────────────────

interface LeafShape {
  x: number;
  y: number;
  size: number;
  rotation: number;
  type: "oval" | "pointed" | "round";
}

interface StemShape {
  x: number;
  y: number;
  height: number;
  curve: number;
  hasLeaf: boolean;
}

interface TendrilShape {
  x: number;
  y: number;
  length: number;
  angle: number;
  segments: number;
}

function generateLeafShapes(count: number, seed: number, width: number, height: number): LeafShape[] {
  const rng = seededRandom(seed);
  const shapes: LeafShape[] = [];
  const types: LeafShape["type"][] = ["oval", "pointed", "round"];
  for (let i = 0; i < count; i++) {
    shapes.push({
      x: rng() * width,
      y: rng() * height,
      size: 60 + rng() * 100,
      rotation: rng() * Math.PI * 2,
      type: types[Math.floor(rng() * types.length)],
    });
  }
  return shapes;
}

function generateStemShapes(count: number, seed: number, width: number, height: number): StemShape[] {
  const rng = seededRandom(seed);
  const shapes: StemShape[] = [];
  for (let i = 0; i < count; i++) {
    shapes.push({
      x: rng() * width,
      y: rng() * height * 0.3 + height * 0.3,
      height: 60 + rng() * 120,
      curve: (rng() - 0.5) * 40,
      hasLeaf: rng() > 0.4,
    });
  }
  return shapes;
}

function generateTendrilShapes(count: number, seed: number, width: number, height: number): TendrilShape[] {
  const rng = seededRandom(seed);
  const shapes: TendrilShape[] = [];
  for (let i = 0; i < count; i++) {
    shapes.push({
      x: rng() * width,
      y: rng() * height * 0.6 + height * 0.2,
      length: 30 + rng() * 60,
      angle: rng() * Math.PI * 0.5 - Math.PI * 0.25,
      segments: 3 + Math.floor(rng() * 4),
    });
  }
  return shapes;
}

function drawLeaf(ctx: CanvasRenderingContext2D, leaf: LeafShape): void {
  ctx.save();
  ctx.translate(leaf.x, leaf.y);
  ctx.rotate(leaf.rotation);

  ctx.beginPath();
  if (leaf.type === "oval") {
    ctx.ellipse(0, 0, leaf.size * 0.4, leaf.size * 0.6, 0, 0, Math.PI * 2);
  } else if (leaf.type === "pointed") {
    ctx.moveTo(0, -leaf.size * 0.5);
    ctx.quadraticCurveTo(leaf.size * 0.3, 0, 0, leaf.size * 0.5);
    ctx.quadraticCurveTo(-leaf.size * 0.3, 0, 0, -leaf.size * 0.5);
  } else {
    ctx.arc(0, 0, leaf.size * 0.35, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
}

function drawStem(ctx: CanvasRenderingContext2D, stem: StemShape): void {
  ctx.beginPath();
  ctx.moveTo(stem.x, stem.y);
  ctx.quadraticCurveTo(
    stem.x + stem.curve,
    stem.y - stem.height * 0.5,
    stem.x + stem.curve * 0.5,
    stem.y - stem.height,
  );
  ctx.stroke();

  if (stem.hasLeaf) {
    const leafX = stem.x + stem.curve * 0.5;
    const leafY = stem.y - stem.height;
    ctx.beginPath();
    ctx.ellipse(leafX + 8, leafY, 10, 5, Math.PI * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTendril(ctx: CanvasRenderingContext2D, tendril: TendrilShape): void {
  const segLen = tendril.length / tendril.segments;
  ctx.beginPath();
  ctx.moveTo(tendril.x, tendril.y);

  let cx = tendril.x;
  let cy = tendril.y;
  for (let i = 0; i < tendril.segments; i++) {
    const t = (i + 1) / tendril.segments;
    const nextX = cx + Math.cos(tendril.angle + t * Math.PI * 0.5) * segLen;
    const nextY = cy + Math.sin(tendril.angle + t * Math.PI * 0.5) * segLen;
    const cpX = (cx + nextX) / 2 + (Math.sin(t * Math.PI) * 8);
    const cpY = (cy + nextY) / 2 - 5;
    ctx.quadraticCurveTo(cpX, cpY, nextX, nextY);
    cx = nextX;
    cy = nextY;
  }
  ctx.stroke();
}

/**
 * Create the Herbarium Folio parallax background layers.
 * Layers are pre-generated using a deterministic seed.
 */
export function createHerbariumBackground(
  levelWidth: number,
  levelHeight: number,
  seed: number = 42,
): BiomeBackground {
  // Pre-generate shapes for each layer
  const deepLeaves = generateLeafShapes(4, seed, levelWidth, levelHeight);
  const midStems = generateStemShapes(10, seed + 100, levelWidth, levelHeight);
  const nearTendrils = generateTendrilShapes(6, seed + 200, levelWidth, levelHeight);

  const RULED_LINE_SPACING = 40;

  const herbSheetIds = BIOME_BACKGROUND_LAYERS["herbarium-folio"];

  const layers: BackgroundLayer[] = [
    // Layer 1: Deep background (parallax 0.1) — ruled lines + faint leaf silhouettes
    {
      parallaxFactor: 0.1,
      render: (ctx, cameraX, _cameraY, canvasWidth, canvasHeight) => {
        if (RenderConfig.useSprites() && herbSheetIds) {
          renderSpriteLayer(ctx, herbSheetIds[0].sheetId, cameraX, 0.1, canvasWidth);
        }
        if (RenderConfig.useRectangles()) {
          ctx.fillStyle = "#050f08";
          ctx.fillRect(-500, -500, levelWidth + 1000, levelHeight + 1000);

          // Ruled horizontal lines (like notebook paper)
          ctx.save();
          ctx.strokeStyle = "#0a1a0f";
          ctx.lineWidth = 0.5;
          ctx.globalAlpha = 0.3;
          for (let y = 0; y < levelHeight + canvasHeight; y += RULED_LINE_SPACING) {
            ctx.beginPath();
            ctx.moveTo(-500, y);
            ctx.lineTo(levelWidth + 500, y);
            ctx.stroke();
          }
          ctx.restore();

          // Faint large leaf silhouettes
          ctx.save();
          ctx.globalAlpha = 0.04;
          ctx.fillStyle = "#1a4a1a";
          for (const leaf of deepLeaves) {
            drawLeaf(ctx, leaf);
          }
          ctx.restore();
        }
      },
    },

    // Layer 2: Mid background (parallax 0.3) — stems and small leaf outlines
    {
      parallaxFactor: 0.3,
      render: (ctx, cameraX, _cameraY, canvasWidth) => {
        if (RenderConfig.useSprites() && herbSheetIds) {
          renderSpriteLayer(ctx, herbSheetIds[1].sheetId, cameraX, 0.3, canvasWidth);
        }
        if (RenderConfig.useRectangles()) {
          ctx.save();
          ctx.globalAlpha = 0.15;
          ctx.strokeStyle = "#0a2a0a";
          ctx.fillStyle = "#0a2a0a";
          ctx.lineWidth = 1.5;
          for (const stem of midStems) {
            drawStem(ctx, stem);
          }
          ctx.restore();
        }
      },
    },

    // Layer 3: Near background (parallax 0.6) — vine tendrils and small detailed leaves
    {
      parallaxFactor: 0.6,
      render: (ctx, cameraX, _cameraY, canvasWidth) => {
        if (RenderConfig.useSprites() && herbSheetIds) {
          renderSpriteLayer(ctx, herbSheetIds[2].sheetId, cameraX, 0.6, canvasWidth);
        }
        if (RenderConfig.useRectangles()) {
          ctx.save();
          ctx.globalAlpha = 0.2;
          ctx.strokeStyle = "#1a3a1a";
          ctx.lineWidth = 1;
          for (const tendril of nearTendrils) {
            drawTendril(ctx, tendril);
          }
          ctx.restore();
        }
      },
    },
  ];

  return new BiomeBackground(layers);
}

// ─── Maritime Ledger background layer generators ──────────────────────

interface ContourArc {
  cx: number;
  cy: number;
  radius: number;
  startAngle: number;
  endAngle: number;
}

interface CompassRose {
  x: number;
  y: number;
  size: number;
  rotation: number;
}

interface FlowArrow {
  x: number;
  y: number;
  angle: number;
  length: number;
}

function generateContourArcs(
  count: number,
  seed: number,
  width: number,
  height: number,
): ContourArc[] {
  const rng = seededRandom(seed);
  const arcs: ContourArc[] = [];
  for (let i = 0; i < count; i++) {
    arcs.push({
      cx: rng() * width,
      cy: rng() * height,
      radius: 60 + rng() * 200,
      startAngle: rng() * Math.PI * 2,
      endAngle: rng() * Math.PI * 2,
    });
  }
  return arcs;
}

function generateCompassRoses(
  count: number,
  seed: number,
  width: number,
  height: number,
): CompassRose[] {
  const rng = seededRandom(seed);
  const roses: CompassRose[] = [];
  for (let i = 0; i < count; i++) {
    roses.push({
      x: rng() * width,
      y: rng() * height,
      size: 15 + rng() * 30,
      rotation: rng() * Math.PI * 2,
    });
  }
  return roses;
}

function generateFlowArrows(
  count: number,
  seed: number,
  width: number,
  height: number,
): FlowArrow[] {
  const rng = seededRandom(seed);
  const arrows: FlowArrow[] = [];
  for (let i = 0; i < count; i++) {
    arrows.push({
      x: rng() * width,
      y: rng() * height,
      angle: rng() * Math.PI * 2,
      length: 8 + rng() * 14,
    });
  }
  return arrows;
}

function drawCompassRose(ctx: CanvasRenderingContext2D, rose: CompassRose): void {
  ctx.save();
  ctx.translate(rose.x, rose.y);
  ctx.rotate(rose.rotation);

  // Four main points
  const s = rose.size;
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(
      Math.cos(angle - 0.15) * s * 0.3,
      Math.sin(angle - 0.15) * s * 0.3,
    );
    ctx.lineTo(Math.cos(angle) * s, Math.sin(angle) * s);
    ctx.lineTo(
      Math.cos(angle + 0.15) * s * 0.3,
      Math.sin(angle + 0.15) * s * 0.3,
    );
    ctx.closePath();
    ctx.fill();
  }

  // Center circle
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawFlowArrow(ctx: CanvasRenderingContext2D, arrow: FlowArrow): void {
  const endX = arrow.x + Math.cos(arrow.angle) * arrow.length;
  const endY = arrow.y + Math.sin(arrow.angle) * arrow.length;

  ctx.beginPath();
  ctx.moveTo(arrow.x, arrow.y);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  // Small arrowhead
  const headSize = 3;
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - Math.cos(arrow.angle - 0.5) * headSize,
    endY - Math.sin(arrow.angle - 0.5) * headSize,
  );
  ctx.lineTo(
    endX - Math.cos(arrow.angle + 0.5) * headSize,
    endY - Math.sin(arrow.angle + 0.5) * headSize,
  );
  ctx.closePath();
  ctx.fill();
}

/**
 * Create the Maritime Ledger parallax background layers.
 * Nautical chart aesthetic — depth contour arcs, compass roses, current flow arrows.
 */
export function createMaritimeBackground(
  levelWidth: number,
  levelHeight: number,
  seed: number = 55,
): BiomeBackground {
  const contourArcs = generateContourArcs(12, seed, levelWidth, levelHeight);
  const compassRoses = generateCompassRoses(6, seed + 100, levelWidth, levelHeight);
  const flowArrows = generateFlowArrows(20, seed + 200, levelWidth, levelHeight);

  const GRID_SPACING = 80;
  const maritimeSheetIds = BIOME_BACKGROUND_LAYERS["maritime-ledger"];

  const layers: BackgroundLayer[] = [
    // Layer 1: Depth contour lines + lat/long grid (parallax 0.1)
    {
      parallaxFactor: 0.1,
      render: (ctx, cameraX, _cameraY, canvasWidth, canvasHeight) => {
        if (RenderConfig.useSprites() && maritimeSheetIds) {
          renderSpriteLayer(ctx, maritimeSheetIds[0].sheetId, cameraX, 0.1, canvasWidth);
        }
        if (RenderConfig.useRectangles()) {
          // Deep background fill
          ctx.fillStyle = "#060e1c";
          ctx.fillRect(-500, -500, levelWidth + 1000, levelHeight + 1000);

          // Faint latitude/longitude grid
          ctx.save();
          ctx.strokeStyle = "#1e3a5f";
          ctx.lineWidth = 0.5;
          ctx.globalAlpha = 0.08;
          for (let x = 0; x < levelWidth; x += GRID_SPACING) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, levelHeight);
            ctx.stroke();
          }
          for (let y = 0; y < levelHeight + canvasHeight; y += GRID_SPACING) {
            ctx.beginPath();
            ctx.moveTo(-500, y);
            ctx.lineTo(levelWidth + 500, y);
            ctx.stroke();
          }
          ctx.restore();

          // Depth contour arcs
          ctx.save();
          ctx.strokeStyle = "#3b6b9b";
          ctx.lineWidth = 0.8;
          ctx.globalAlpha = 0.08;
          for (const arc of contourArcs) {
            ctx.beginPath();
            ctx.arc(arc.cx, arc.cy, arc.radius, arc.startAngle, arc.endAngle);
            ctx.stroke();
          }
          ctx.restore();
        }
      },
    },

    // Layer 2: Compass roses + navigation routes (parallax 0.3)
    {
      parallaxFactor: 0.3,
      render: (ctx, cameraX, _cameraY, canvasWidth) => {
        if (RenderConfig.useSprites() && maritimeSheetIds) {
          renderSpriteLayer(ctx, maritimeSheetIds[1].sheetId, cameraX, 0.3, canvasWidth);
        }
        if (RenderConfig.useRectangles()) {
          // Compass roses
          ctx.save();
          ctx.globalAlpha = 0.12;
          ctx.fillStyle = "#fbbf24";
          for (const rose of compassRoses) {
            drawCompassRose(ctx, rose);
          }
          ctx.restore();

          // Navigation route dotted lines between roses
          ctx.save();
          ctx.strokeStyle = "#fbbf24";
          ctx.lineWidth = 0.6;
          ctx.globalAlpha = 0.06;
          ctx.setLineDash([4, 8]);
          for (let i = 0; i < compassRoses.length - 1; i++) {
            const a = compassRoses[i];
            const b = compassRoses[i + 1];
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
          ctx.setLineDash([]);
          ctx.restore();
        }
      },
    },

    // Layer 3: Current flow arrows (parallax 0.6)
    {
      parallaxFactor: 0.6,
      render: (ctx, cameraX, _cameraY, canvasWidth) => {
        if (RenderConfig.useSprites() && maritimeSheetIds) {
          renderSpriteLayer(ctx, maritimeSheetIds[2].sheetId, cameraX, 0.6, canvasWidth);
        }
        if (RenderConfig.useRectangles()) {
          ctx.save();
          ctx.strokeStyle = "#38bdf8";
          ctx.fillStyle = "#38bdf8";
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.2;
          for (const arrow of flowArrows) {
            drawFlowArrow(ctx, arrow);
          }
          ctx.restore();
        }
      },
    },
  ];

  return new BiomeBackground(layers);
}

// ─── Gothic Errata background layer generators ────────────────────────

interface RedactedBlock {
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
}

interface SquigglyLine {
  x: number;
  y: number;
  length: number;
  angle: number;
  amplitude: number;
}

interface InkBlot {
  x: number;
  y: number;
  radius: number;
  irregularity: number;
}

function generateRedactedBlocks(
  count: number,
  seed: number,
  width: number,
  height: number,
): RedactedBlock[] {
  const rng = seededRandom(seed);
  const blocks: RedactedBlock[] = [];
  for (let i = 0; i < count; i++) {
    blocks.push({
      x: rng() * width,
      y: rng() * height,
      width: 40 + rng() * 120,
      height: 8 + rng() * 20,
      angle: (rng() - 0.5) * 0.3,
    });
  }
  return blocks;
}

function generateSquigglyLines(
  count: number,
  seed: number,
  width: number,
  height: number,
): SquigglyLine[] {
  const rng = seededRandom(seed);
  const lines: SquigglyLine[] = [];
  for (let i = 0; i < count; i++) {
    lines.push({
      x: rng() * width,
      y: rng() * height,
      length: 20 + rng() * 60,
      angle: (rng() - 0.5) * 0.5,
      amplitude: 2 + rng() * 4,
    });
  }
  return lines;
}

function generateInkBlots(
  count: number,
  seed: number,
  width: number,
  height: number,
): InkBlot[] {
  const rng = seededRandom(seed);
  const blots: InkBlot[] = [];
  for (let i = 0; i < count; i++) {
    blots.push({
      x: rng() * width,
      y: rng() * height,
      radius: 10 + rng() * 30,
      irregularity: 0.3 + rng() * 0.5,
    });
  }
  return blots;
}

/**
 * Create the Gothic Errata parallax background layers.
 * Torn manuscript aesthetic — redacted blocks, corrupted marginalia, ink blots.
 */
export function createGothicErrataBackground(
  levelWidth: number,
  levelHeight: number,
  seed: number = 666,
): BiomeBackground {
  const redactedBlocks = generateRedactedBlocks(8, seed, levelWidth, levelHeight);
  const squigglyLines = generateSquigglyLines(15, seed + 100, levelWidth, levelHeight);
  const inkBlots = generateInkBlots(6, seed + 200, levelWidth, levelHeight);

  const RULED_LINE_SPACING = 35;
  const gothicSheetIds = BIOME_BACKGROUND_LAYERS["gothic-errata"];

  const layers: BackgroundLayer[] = [
    // Layer 1: Faint manuscript lines + redacted blocks (parallax 0.05)
    {
      parallaxFactor: 0.05,
      render: (ctx, cameraX, _cameraY, canvasWidth, canvasHeight) => {
        if (RenderConfig.useSprites() && gothicSheetIds) {
          renderSpriteLayer(ctx, gothicSheetIds[0].sheetId, cameraX, 0.05, canvasWidth);
        }
        if (RenderConfig.useRectangles()) {
          // Deep background fill
          ctx.fillStyle = "#080606";
          ctx.fillRect(-500, -500, levelWidth + 1000, levelHeight + 1000);

          // Ruled lines at slight random angles (torn pages)
          ctx.save();
          ctx.strokeStyle = "#1a1010";
          ctx.lineWidth = 0.5;
          ctx.globalAlpha = 0.06;
          for (let y = 0; y < levelHeight + canvasHeight; y += RULED_LINE_SPACING) {
            ctx.beginPath();
            ctx.moveTo(-500, y + Math.sin(y * 0.01) * 3);
            ctx.lineTo(levelWidth + 500, y + Math.sin(y * 0.01 + 2) * 3);
            ctx.stroke();
          }
          ctx.restore();

          // Redacted blocks (black rectangles with red strikethrough)
          ctx.save();
          ctx.globalAlpha = 0.06;
          for (const block of redactedBlocks) {
            ctx.save();
            ctx.translate(block.x + block.width / 2, block.y + block.height / 2);
            ctx.rotate(block.angle);
            // Black block
            ctx.fillStyle = "#000000";
            ctx.fillRect(-block.width / 2, -block.height / 2, block.width, block.height);
            // Red strikethrough
            ctx.strokeStyle = "#dc2626";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-block.width / 2, 0);
            ctx.lineTo(block.width / 2, 0);
            ctx.stroke();
            ctx.restore();
          }
          ctx.restore();
        }
      },
    },

    // Layer 2: Corrupted marginalia — squiggly lines, drip marks (parallax 0.2)
    {
      parallaxFactor: 0.2,
      render: (ctx, cameraX, _cameraY, canvasWidth) => {
        if (RenderConfig.useSprites() && gothicSheetIds) {
          renderSpriteLayer(ctx, gothicSheetIds[1].sheetId, cameraX, 0.2, canvasWidth);
        }
        if (RenderConfig.useRectangles()) {
          ctx.save();
          ctx.globalAlpha = 0.10;
          ctx.strokeStyle = "#dc2626";
          ctx.lineWidth = 0.8;

          // Squiggly text-like lines
          for (const line of squigglyLines) {
            ctx.beginPath();
            ctx.moveTo(line.x, line.y);
            const steps = 8;
            const stepLen = line.length / steps;
            for (let i = 1; i <= steps; i++) {
              const px = line.x + Math.cos(line.angle) * stepLen * i;
              const py = line.y + Math.sin(line.angle) * stepLen * i +
                Math.sin(i * 1.5) * line.amplitude;
              ctx.lineTo(px, py);
            }
            ctx.stroke();
          }

          // Vertical drip marks
          ctx.strokeStyle = "#5c3a3a";
          ctx.lineWidth = 0.6;
          for (let i = 0; i < squigglyLines.length; i += 3) {
            const line = squigglyLines[i];
            ctx.beginPath();
            ctx.moveTo(line.x, line.y);
            ctx.lineTo(line.x + (i % 2 === 0 ? 2 : -2), line.y + 20 + i * 3);
            ctx.stroke();
          }

          // Small cross marks
          ctx.strokeStyle = "#dc2626";
          ctx.lineWidth = 1;
          for (let i = 1; i < squigglyLines.length; i += 4) {
            const line = squigglyLines[i];
            const sz = 4;
            ctx.beginPath();
            ctx.moveTo(line.x - sz, line.y - sz);
            ctx.lineTo(line.x + sz, line.y + sz);
            ctx.moveTo(line.x + sz, line.y - sz);
            ctx.lineTo(line.x - sz, line.y + sz);
            ctx.stroke();
          }

          ctx.restore();
        }
      },
    },

    // Layer 3: Torn page edges + ink blots (parallax 0.5)
    {
      parallaxFactor: 0.5,
      render: (ctx, cameraX, _cameraY, canvasWidth) => {
        if (RenderConfig.useSprites() && gothicSheetIds) {
          renderSpriteLayer(ctx, gothicSheetIds[2].sheetId, cameraX, 0.5, canvasWidth);
        }
        if (RenderConfig.useRectangles()) {
          ctx.save();
          ctx.globalAlpha = 0.15;

          // Jagged torn edges (vertical and horizontal)
          ctx.strokeStyle = "#78716c";
          ctx.lineWidth = 1;
          const rng = seededRandom(seed + 300);
          for (let i = 0; i < 4; i++) {
            const startX = rng() * levelWidth;
            const startY = rng() * levelHeight;
            const vertical = rng() > 0.5;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            for (let j = 0; j < 12; j++) {
              const dx = vertical ? (rng() - 0.5) * 10 : 20 + rng() * 10;
              const dy = vertical ? 20 + rng() * 10 : (rng() - 0.5) * 10;
              ctx.lineTo(startX + dx * (j + 1) * 0.3, startY + dy * (j + 1) * 0.3);
            }
            ctx.stroke();
          }

          // Ink blots (irregular dark circles)
          ctx.fillStyle = "#1a0f0f";
          for (const blot of inkBlots) {
            ctx.beginPath();
            const steps = 12;
            for (let i = 0; i <= steps; i++) {
              const angle = (i / steps) * Math.PI * 2;
              const r = blot.radius * (1 + Math.sin(angle * 3) * blot.irregularity);
              const bx = blot.x + Math.cos(angle) * r;
              const by = blot.y + Math.sin(angle) * r;
              if (i === 0) ctx.moveTo(bx, by);
              else ctx.lineTo(bx, by);
            }
            ctx.closePath();
            ctx.fill();
          }

          ctx.restore();
        }
      },
    },
  ];

  return new BiomeBackground(layers);
}

// ─── Astral Atlas background layer generators ─────────────────────────

interface Star {
  x: number;
  y: number;
  size: number;
  brightness: number;
  color: string;
}

interface ConstellationLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface NebulaCluster {
  x: number;
  y: number;
  radius: number;
  color: string;
}

function generateStars(
  count: number,
  seed: number,
  width: number,
  height: number,
): Star[] {
  const rng = seededRandom(seed);
  const stars: Star[] = [];
  const colors = ["#fbbf24", "#fde68a", "#e0e7ff", "#ffffff", "#c4b5fd"];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rng() * width,
      y: rng() * height,
      size: 1 + rng() * 2.5,
      brightness: 0.3 + rng() * 0.7,
      color: colors[Math.floor(rng() * colors.length)],
    });
  }
  return stars;
}

function generateConstellationLines(
  starPositions: Star[],
  seed: number,
  maxConnections: number,
): ConstellationLine[] {
  const rng = seededRandom(seed);
  const lines: ConstellationLine[] = [];
  const maxDist = 200;

  for (let i = 0; i < maxConnections && i < starPositions.length; i++) {
    const a = starPositions[Math.floor(rng() * starPositions.length)];
    const b = starPositions[Math.floor(rng() * starPositions.length)];
    if (a === b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.sqrt(dx * dx + dy * dy) < maxDist) {
      lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
  }
  return lines;
}

function generateNebulaClusters(
  count: number,
  seed: number,
  width: number,
  height: number,
): NebulaCluster[] {
  const rng = seededRandom(seed);
  const clusters: NebulaCluster[] = [];
  const colors = ["#818cf8", "#fbbf24", "#c4b5fd", "#fde68a"];
  for (let i = 0; i < count; i++) {
    clusters.push({
      x: rng() * width,
      y: rng() * height,
      radius: 40 + rng() * 100,
      color: colors[Math.floor(rng() * colors.length)],
    });
  }
  return clusters;
}

/**
 * Create the Astral Atlas parallax background layers.
 * Celestial chart aesthetic — star field, constellation lines, nebula patches.
 */
export function createAstralAtlasBackground(
  levelWidth: number,
  levelHeight: number,
  seed: number = 77,
): BiomeBackground {
  const deepStars = generateStars(80, seed, levelWidth, levelHeight);
  const midStars = generateStars(30, seed + 50, levelWidth, levelHeight);
  const constellationLines = generateConstellationLines(
    midStars,
    seed + 100,
    20,
  );
  const nebulae = generateNebulaClusters(5, seed + 200, levelWidth, levelHeight);

  const GRID_SPACING = 60;
  const astralSheetIds = BIOME_BACKGROUND_LAYERS["astral-atlas"];

  const layers: BackgroundLayer[] = [
    // Layer 1: Deep star field (parallax 0.05)
    {
      parallaxFactor: 0.05,
      render: (ctx, cameraX, _cameraY, canvasWidth, canvasHeight) => {
        if (RenderConfig.useSprites() && astralSheetIds) {
          renderSpriteLayer(ctx, astralSheetIds[0].sheetId, cameraX, 0.05, canvasWidth);
        }
        if (RenderConfig.useRectangles()) {
          // Deep background fill
          ctx.fillStyle = "#050810";
          ctx.fillRect(-500, -500, levelWidth + 1000, levelHeight + 1000);

          // Stars (static — removed Date.now() blinking to avoid frame-rate-dependent rendering)
          for (const star of deepStars) {
            ctx.save();
            ctx.globalAlpha = star.brightness;
            ctx.fillStyle = star.color;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      },
    },

    // Layer 2: Constellation lines + grid (parallax 0.15)
    {
      parallaxFactor: 0.15,
      render: (ctx, cameraX, _cameraY, canvasWidth) => {
        if (RenderConfig.useSprites() && astralSheetIds) {
          renderSpriteLayer(ctx, astralSheetIds[1].sheetId, cameraX, 0.15, canvasWidth);
        }
        if (RenderConfig.useRectangles()) {
          // Faint grid lines (celestial chart)
          ctx.save();
          ctx.strokeStyle = "#1e293b";
          ctx.lineWidth = 0.5;
          ctx.globalAlpha = 0.12;
          for (let x = 0; x < levelWidth; x += GRID_SPACING) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, levelHeight);
            ctx.stroke();
          }
          for (let y = 0; y < levelHeight; y += GRID_SPACING) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(levelWidth, y);
            ctx.stroke();
          }
          ctx.restore();

          // Constellation lines
          ctx.save();
          ctx.strokeStyle = "#475569";
          ctx.lineWidth = 0.8;
          ctx.globalAlpha = 0.15;
          for (const line of constellationLines) {
            ctx.beginPath();
            ctx.moveTo(line.x1, line.y1);
            ctx.lineTo(line.x2, line.y2);
            ctx.stroke();
          }
          ctx.restore();

          // Mid-layer stars (constellation nodes)
          ctx.save();
          for (const star of midStars) {
            ctx.globalAlpha = star.brightness * 0.6;
            ctx.fillStyle = star.color;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size * 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      },
    },

    // Layer 3: Nebula clusters (parallax 0.4)
    {
      parallaxFactor: 0.4,
      render: (ctx, cameraX, _cameraY, canvasWidth) => {
        if (RenderConfig.useSprites() && astralSheetIds) {
          renderSpriteLayer(ctx, astralSheetIds[2].sheetId, cameraX, 0.4, canvasWidth);
        }
        if (RenderConfig.useRectangles()) {
          ctx.save();
          for (const nebula of nebulae) {
            const gradient = ctx.createRadialGradient(
              nebula.x,
              nebula.y,
              0,
              nebula.x,
              nebula.y,
              nebula.radius,
            );
            gradient.addColorStop(0, nebula.color);
            gradient.addColorStop(1, "rgba(0,0,0,0)");
            ctx.globalAlpha = 0.04;
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(nebula.x, nebula.y, nebula.radius, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      },
    },
  ];

  return new BiomeBackground(layers);
}
