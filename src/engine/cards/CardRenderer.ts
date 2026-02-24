import type {
  InkCard,
  CardCategory,
  CardTier,
  CardDeck,
} from "./InkCard";
import { CATEGORY_COLORS, STAT_DISPLAY_NAMES } from "./InkCard";
import type { CraftingRecipe } from "./CraftingSystem";
import type { ComputedModifiers } from "./CardModifierEngine";
import { CARD_DEFINITIONS } from "./CardDefinitions";

// ─── Constants ──────────────────────────────────────────────────

export const CARD_RENDER_WIDTH = 80;
export const CARD_RENDER_HEIGHT = 110;
const CARD_PADDING = 10;
const CARD_BORDER_RADIUS = 4;
const CARD_BG_COLOR = "#1a1a2e";
const SLOT_EMPTY_COLOR = "#374151";
const SLOT_EMPTY_BG = "#111827";

// ─── Card Render Options ────────────────────────────────────────

export interface CardRenderOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  selected: boolean;
  equipped: boolean;
  highlighted: boolean;
  dimmed: boolean;
}

// ─── Card Renderer ──────────────────────────────────────────────

export class CardRenderer {
  static getCategoryColor(category: CardCategory): string {
    return CATEGORY_COLORS[category];
  }

  static getTierDots(tier: CardTier): string {
    return "●".repeat(tier);
  }

  static renderCard(
    ctx: CanvasRenderingContext2D,
    card: InkCard,
    options: CardRenderOptions,
  ): void {
    const { x, y, width, height, selected, equipped, dimmed } = options;
    const color = CATEGORY_COLORS[card.category];

    ctx.save();
    if (dimmed) ctx.globalAlpha = 0.5;

    // Background
    ctx.fillStyle = CARD_BG_COLOR;
    roundRect(ctx, x, y, width, height, CARD_BORDER_RADIUS);
    ctx.fill();

    // Subtle gradient tint
    const grad = ctx.createLinearGradient(x, y, x, y + height);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, hexToRgba(color, 0.08));
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, width, height, CARD_BORDER_RADIUS);
    ctx.fill();

    // Border
    const borderWidth = selected ? 3 : 2;
    ctx.strokeStyle = color;
    ctx.lineWidth = borderWidth;
    roundRect(ctx, x, y, width, height, CARD_BORDER_RADIUS);
    ctx.stroke();

    // Selected glow
    if (selected) {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = hexToRgba(color, 0.5);
      ctx.lineWidth = 2;
      roundRect(ctx, x - 2, y - 2, width + 4, height + 4, CARD_BORDER_RADIUS + 2);
      ctx.stroke();
      ctx.restore();
    }

    // Tier dots (top-right)
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px monospace";
    ctx.textAlign = "right";
    ctx.fillText(CardRenderer.getTierDots(card.tier), x + width - 6, y + 14);

    // Equipped badge (top-left)
    if (equipped) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x + 10, y + 10, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = CARD_BG_COLOR;
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("E", x + 10, y + 10);
      ctx.textBaseline = "alphabetic";
    }

    // Glyph (centered)
    ctx.fillStyle = color;
    ctx.font = `${Math.round(width * 0.3)}px serif`;
    ctx.textAlign = "center";
    ctx.fillText(card.glyph, x + width / 2, y + height * 0.52);

    // Name (bottom)
    ctx.fillStyle = "#ffffff";
    ctx.font = `${Math.min(10, Math.round(width * 0.12))}px monospace`;
    ctx.textAlign = "center";
    const nameY = y + height - 8;
    ctx.fillText(truncateText(ctx, card.name, width - 8), x + width / 2, nameY);

    ctx.restore();
  }

  static renderTooltip(
    ctx: CanvasRenderingContext2D,
    card: InkCard,
    x: number,
    y: number,
    maxWidth: number,
  ): void {
    const color = CATEGORY_COLORS[card.category];
    const lineHeight = 14;
    const padding = 8;

    const lines: string[] = [
      `${card.name} (T${card.tier})`,
      card.description,
      "",
    ];
    for (const mod of card.modifiers) {
      const name = STAT_DISPLAY_NAMES[mod.stat];
      if (mod.modifierType === "additive") {
        const sign = mod.value >= 0 ? "+" : "";
        lines.push(`${name}: ${sign}${mod.value}`);
      } else {
        lines.push(`${name}: ×${mod.value}`);
      }
    }

    const tooltipHeight = lines.length * lineHeight + padding * 2;
    const tooltipWidth = Math.min(maxWidth, 200);

    // Clamp tooltip to stay on screen (within 960x540 canvas)
    const clampedX = Math.min(x, 960 - tooltipWidth - 4);
    const clampedY = Math.min(y, 540 - tooltipHeight - 4);

    // Background
    ctx.fillStyle = "rgba(17, 24, 39, 0.95)";
    roundRect(ctx, clampedX, clampedY, tooltipWidth, tooltipHeight, 4);
    ctx.fill();

    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    roundRect(ctx, clampedX, clampedY, tooltipWidth, tooltipHeight, 4);
    ctx.stroke();

    // Text
    ctx.textAlign = "left";
    ctx.font = "11px monospace";
    let textY = clampedY + padding + 10;

    for (let i = 0; i < lines.length; i++) {
      if (i === 0) {
        ctx.fillStyle = color;
        ctx.font = "bold 11px monospace";
      } else if (i === 1) {
        ctx.fillStyle = "#9ca3af";
        ctx.font = "11px monospace";
      } else {
        ctx.fillStyle = "#d1d5db";
        ctx.font = "11px monospace";
      }
      ctx.fillText(lines[i], clampedX + padding, textY);
      textY += lineHeight;
    }
  }

  static renderDeckBar(
    ctx: CanvasRenderingContext2D,
    deck: CardDeck,
    x: number,
    y: number,
    selectedSlot: number,
  ): void {
    const slotW = 60;
    const slotH = 82;
    const slotGap = 8;

    ctx.font = "10px monospace";
    ctx.fillStyle = "#9ca3af";
    ctx.textAlign = "left";
    ctx.fillText("EQUIPPED DECK", x, y - 4);

    for (let i = 0; i < deck.maxEquipped; i++) {
      const sx = x + i * (slotW + slotGap);
      const sy = y + 2;
      const equippedId = deck.equippedIds[i];
      const card = equippedId
        ? deck.collection.find((c) => c.id === equippedId)
        : undefined;

      if (card) {
        CardRenderer.renderCard(ctx, card, {
          x: sx,
          y: sy,
          width: slotW,
          height: slotH,
          selected: i === selectedSlot,
          equipped: true,
          highlighted: false,
          dimmed: false,
        });
      } else {
        // Empty slot
        ctx.strokeStyle =
          i === selectedSlot ? "#6b7280" : SLOT_EMPTY_COLOR;
        ctx.lineWidth = i === selectedSlot ? 2 : 1;
        ctx.setLineDash([4, 4]);
        ctx.fillStyle = SLOT_EMPTY_BG;
        roundRect(ctx, sx, sy, slotW, slotH, CARD_BORDER_RADIUS);
        ctx.fill();
        roundRect(ctx, sx, sy, slotW, slotH, CARD_BORDER_RADIUS);
        ctx.stroke();
        ctx.setLineDash([]);

        // Empty label
        ctx.fillStyle = "#4b5563";
        ctx.font = "9px monospace";
        ctx.textAlign = "center";
        ctx.fillText("Empty", sx + slotW / 2, sy + slotH / 2 + 3);
        ctx.textAlign = "left";
      }
    }
  }

  static renderCollectionGrid(
    ctx: CanvasRenderingContext2D,
    collection: InkCard[],
    x: number,
    y: number,
    width: number,
    height: number,
    scrollOffset: number,
    selectedIndex: number,
    equippedIds: Set<string>,
  ): void {
    const cols = 4;
    const cellW = CARD_RENDER_WIDTH + CARD_PADDING;
    const cellH = CARD_RENDER_HEIGHT + CARD_PADDING;

    // Header
    ctx.fillStyle = "#9ca3af";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`COLLECTION (${collection.length})`, x, y - 4);

    // Background
    ctx.fillStyle = "rgba(17, 24, 39, 0.5)";
    roundRect(ctx, x, y, width, height, 4);
    ctx.fill();

    // Clip to grid area
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();

    for (let i = 0; i < collection.length; i++) {
      const card = collection[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = x + 6 + col * cellW;
      const cy = y + 6 + row * cellH - scrollOffset;

      // Skip cards outside visible area
      if (cy + CARD_RENDER_HEIGHT < y || cy > y + height) continue;

      CardRenderer.renderCard(ctx, card, {
        x: cx,
        y: cy,
        width: CARD_RENDER_WIDTH,
        height: CARD_RENDER_HEIGHT,
        selected: i === selectedIndex,
        equipped: equippedIds.has(card.id),
        highlighted: false,
        dimmed: false,
      });
    }

    ctx.restore();

    // Scroll indicator
    const totalRows = Math.ceil(collection.length / cols);
    const totalHeight = totalRows * cellH;
    if (totalHeight > height) {
      const scrollBarH = Math.max(20, (height / totalHeight) * height);
      const scrollBarY = y + (scrollOffset / totalHeight) * height;
      ctx.fillStyle = "rgba(107, 114, 128, 0.4)";
      roundRect(ctx, x + width - 6, scrollBarY, 4, scrollBarH, 2);
      ctx.fill();
    }
  }

  static renderCraftingPanel(
    ctx: CanvasRenderingContext2D,
    availableCrafts: CraftingRecipe[],
    collection: InkCard[],
    x: number,
    y: number,
    width: number,
    height: number,
    selectedRecipeIndex: number,
  ): void {
    // Header
    ctx.fillStyle = "#9ca3af";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`CRAFTING (${availableCrafts.length} recipes)`, x, y - 4);

    // Background
    ctx.fillStyle = "rgba(17, 24, 39, 0.5)";
    roundRect(ctx, x, y, width, height, 4);
    ctx.fill();

    if (availableCrafts.length === 0) {
      ctx.fillStyle = "#6b7280";
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText("No recipes available", x + width / 2, y + height / 2);
      ctx.textAlign = "left";
      return;
    }

    const rowH = 40;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();

    for (let i = 0; i < availableCrafts.length; i++) {
      const recipe = availableCrafts[i];
      const ry = y + 8 + i * rowH;
      if (ry > y + height) break;

      const isSelected = i === selectedRecipeIndex;
      const def = CARD_DEFINITIONS.find(
        (d) => d.id === recipe.inputDefinitionId,
      );
      const color = def
        ? CATEGORY_COLORS[def.category]
        : "#9ca3af";

      // Selection highlight
      if (isSelected) {
        ctx.fillStyle = hexToRgba(color, 0.15);
        ctx.fillRect(x + 4, ry - 4, width - 8, rowH - 4);
      }

      // Recipe text
      ctx.fillStyle = isSelected ? color : "#d1d5db";
      ctx.font = isSelected ? "bold 11px monospace" : "11px monospace";
      ctx.textAlign = "left";

      const name = def?.name ?? recipe.inputDefinitionId;
      ctx.fillText(
        `${recipe.inputCount}× ${name} T${recipe.inputTier}`,
        x + 10,
        ry + 10,
      );
      ctx.fillStyle = "#6b7280";
      ctx.fillText(`→ ${name} T${recipe.outputTier}`, x + 10, ry + 24);
    }

    ctx.restore();

    // Craft button hint at bottom
    if (selectedRecipeIndex >= 0 && selectedRecipeIndex < availableCrafts.length) {
      ctx.fillStyle = "#4ade80";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText("[C] Craft", x + width / 2, y + height - 8);
      ctx.textAlign = "left";
    }
  }

  static renderStatComparison(
    ctx: CanvasRenderingContext2D,
    entries: Array<{
      displayName: string;
      baseValue: number;
      modifiedValue: number;
      change: string;
    }>,
    x: number,
    y: number,
    width: number,
  ): void {
    ctx.fillStyle = "#9ca3af";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText("STAT PREVIEW", x, y - 4);

    // Background
    const rowH = 14;
    const bgH = Math.max(30, entries.length * rowH + 16);
    ctx.fillStyle = "rgba(17, 24, 39, 0.5)";
    roundRect(ctx, x, y, width, bgH, 4);
    ctx.fill();

    if (entries.length === 0) {
      ctx.fillStyle = "#6b7280";
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText("No modifiers active", x + width / 2, y + bgH / 2 + 3);
      ctx.textAlign = "left";
      return;
    }

    ctx.font = "10px monospace";
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const ey = y + 14 + i * rowH;
      const diff = entry.modifiedValue - entry.baseValue;

      // Stat name
      ctx.fillStyle = "#d1d5db";
      ctx.textAlign = "left";
      ctx.fillText(entry.displayName + ":", x + 6, ey);

      // Value comparison
      const isMultiplier = entry.change.startsWith("×");
      let valText: string;
      if (isMultiplier) {
        valText = entry.change;
      } else {
        valText = `${Math.round(entry.baseValue)} → ${Math.round(entry.modifiedValue)} (${entry.change})`;
      }

      if (diff > 0) ctx.fillStyle = "#4ade80";
      else if (diff < 0) ctx.fillStyle = "#f87171";
      else ctx.fillStyle = "#9ca3af";

      ctx.textAlign = "right";
      ctx.fillText(valText, x + width - 6, ey);
    }
    ctx.textAlign = "left";
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + "…").width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + "…";
}
