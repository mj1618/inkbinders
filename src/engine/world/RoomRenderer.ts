// RoomRenderer — rendering for room-specific elements (gates, exits, transitions, bounds)

import type {
  AbilityGate,
  AbilityPickup,
  RoomExit,
  ExitDirection,
  GateAbility,
  EnemySpawn,
  RoomVineAnchor,
} from "./Room";
import {
  GATE_COLORS,
  GATE_PULSE_SPEED,
  GATE_PULSE_ALPHA_MIN,
  GATE_PULSE_ALPHA_MAX,
  EXIT_INDICATOR_SIZE,
  EXIT_INDICATOR_COLOR,
} from "./Room";
import type { Vec2 } from "@/lib/types";
import { RenderConfig } from "@/engine/core/RenderConfig";
import { AssetManager } from "@/engine/core/AssetManager";
import { getGateFrameIndex, getExitArrowRotation } from "./WorldObjectSprites";

// ─── Gate Rendering ─────────────────────────────────────────────────

/** Render ability gates (locked = colored barrier with pulse, opened = invisible) */
export function renderGates(
  ctx: CanvasRenderingContext2D,
  gates: AbilityGate[],
  time: number,
): void {
  const am = AssetManager.getInstance();

  for (const gate of gates) {
    if (gate.opened) continue;

    // Sprite mode: draw ability-gate sprite
    if (RenderConfig.useSprites()) {
      const sheet = am.getSpriteSheet("ability-gate");
      if (sheet) {
        const frameIdx = getGateFrameIndex(gate.requiredAbility);
        // Scale sprite to fill gate rect
        const scaleX = gate.rect.width / sheet.config.frameWidth;
        const scaleY = gate.rect.height / sheet.config.frameHeight;
        sheet.drawFrame(ctx, frameIdx, gate.rect.x, gate.rect.y, false, scaleX, scaleY);
      }
    }

    // Rectangle mode: existing colored rect + glyph
    if (RenderConfig.useRectangles()) {
      const color = GATE_COLORS[gate.requiredAbility] ?? gate.lockedColor;

      // Pulse alpha
      const pulse = Math.sin(time * GATE_PULSE_SPEED * Math.PI * 2);
      const alpha =
        GATE_PULSE_ALPHA_MIN +
        ((pulse + 1) / 2) * (GATE_PULSE_ALPHA_MAX - GATE_PULSE_ALPHA_MIN);

      // Fill
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(gate.rect.x, gate.rect.y, gate.rect.width, gate.rect.height);

      // Stroke
      ctx.globalAlpha = alpha + 0.2;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(
        gate.rect.x,
        gate.rect.y,
        gate.rect.width,
        gate.rect.height,
      );

      // Ability glyph in center
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#fff";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const cx = gate.rect.x + gate.rect.width / 2;
      const cy = gate.rect.y + gate.rect.height / 2;
      const glyphMap: Record<GateAbility, string> = {
        "margin-stitch": "S",
        redaction: "R",
        "paste-over": "P",
        "index-mark": "I",
      };
      ctx.fillText(glyphMap[gate.requiredAbility], cx, cy);
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
    }
  }
  ctx.globalAlpha = 1;
}

// ─── Exit Indicators ────────────────────────────────────────────────

/** Render arrows at room edges where exits are */
export function renderExitIndicators(
  ctx: CanvasRenderingContext2D,
  exits: RoomExit[],
  time: number,
): void {
  const am = AssetManager.getInstance();
  const exitSheet = am.getSpriteSheet("exit-arrow");

  for (const exit of exits) {
    const { zone, direction } = exit;
    const cx = zone.x + zone.width / 2;
    const cy = zone.y + zone.height / 2;

    // Sprite mode: draw exit-arrow sprite, rotated based on direction
    if (RenderConfig.useSprites() && exitSheet) {
      const pulse = (Math.sin(time * 2 * Math.PI) + 1) / 2;
      const frameIdx = Math.floor(pulse * 2) % 2; // alternate between 2 frames
      const rotation = getExitArrowRotation(direction);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotation);
      exitSheet.drawFrame(ctx, frameIdx, -16, -16); // center the 32×32 sprite
      ctx.restore();
    }

    // Rectangle mode: existing arrow drawing
    if (RenderConfig.useRectangles()) {
      const pulse = (Math.sin(time * 2 * Math.PI) + 1) / 2;
      const alpha = 0.3 + pulse * 0.3;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = EXIT_INDICATOR_COLOR;

      const s = EXIT_INDICATOR_SIZE;
      ctx.beginPath();
      drawArrow(ctx, cx, cy, s, direction);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  direction: ExitDirection,
): void {
  const h = size;
  const w = size * 0.6;
  switch (direction) {
    case "right":
      ctx.moveTo(cx, cy - w);
      ctx.lineTo(cx + h, cy);
      ctx.lineTo(cx, cy + w);
      break;
    case "left":
      ctx.moveTo(cx, cy - w);
      ctx.lineTo(cx - h, cy);
      ctx.lineTo(cx, cy + w);
      break;
    case "top":
      ctx.moveTo(cx - w, cy);
      ctx.lineTo(cx, cy - h);
      ctx.lineTo(cx + w, cy);
      break;
    case "bottom":
      ctx.moveTo(cx - w, cy);
      ctx.lineTo(cx, cy + h);
      ctx.lineTo(cx + w, cy);
      break;
  }
  ctx.closePath();
}

// ─── Room Bounds ────────────────────────────────────────────────────

/** Render a rectangle outline for the room bounds */
export function renderBounds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(0, 0, width, height);
  ctx.setLineDash([]);
}

// ─── Transition Overlay ─────────────────────────────────────────────

/** Render a fade-to-black overlay for room transitions */
export function renderTransitionOverlay(
  ctx: CanvasRenderingContext2D,
  alpha: number,
  canvasWidth: number,
  canvasHeight: number,
): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset to screen space
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ─── Editor-mode element markers ────────────────────────────────────

/** Render spawn point marker (crosshair) */
export function renderSpawnMarker(
  ctx: CanvasRenderingContext2D,
  spawn: Vec2,
): void {
  const size = 12;
  ctx.strokeStyle = "#22d3ee";
  ctx.lineWidth = 2;

  // Crosshair
  ctx.beginPath();
  ctx.moveTo(spawn.x - size, spawn.y);
  ctx.lineTo(spawn.x + size, spawn.y);
  ctx.moveTo(spawn.x, spawn.y - size);
  ctx.lineTo(spawn.x, spawn.y + size);
  ctx.stroke();

  // Circle
  ctx.beginPath();
  ctx.arc(spawn.x, spawn.y, size * 0.7, 0, Math.PI * 2);
  ctx.stroke();

  // Label
  ctx.fillStyle = "#22d3ee";
  ctx.font = "9px monospace";
  ctx.fillText("SPAWN", spawn.x + size + 4, spawn.y + 3);
}

/** Render enemy spawn marker (icon in editor mode) */
export function renderEnemyMarker(
  ctx: CanvasRenderingContext2D,
  enemy: EnemySpawn,
): void {
  const colorMap: Record<string, string> = {
    reader: "#ef4444",
    binder: "#8b5cf6",
    proofwarden: "#f59e0b",
  };
  const color = colorMap[enemy.type] ?? "#fff";
  const size = 16;

  ctx.fillStyle = color;
  ctx.globalAlpha = 0.6;
  ctx.fillRect(
    enemy.position.x - size / 2,
    enemy.position.y - size,
    size,
    size,
  );
  ctx.globalAlpha = 1;

  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(
    enemy.position.x - size / 2,
    enemy.position.y - size,
    size,
    size,
  );

  ctx.fillStyle = "#fff";
  ctx.font = "8px monospace";
  ctx.textAlign = "center";
  ctx.fillText(
    enemy.type[0].toUpperCase(),
    enemy.position.x,
    enemy.position.y - size / 2 + 3,
  );
  ctx.textAlign = "start";
}

/** Render vine anchor marker (editor mode) */
export function renderVineMarker(
  ctx: CanvasRenderingContext2D,
  vine: RoomVineAnchor,
): void {
  const color = "#4ade80";

  // Anchor point
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(vine.position.x, vine.position.y, 4, 0, Math.PI * 2);
  ctx.fill();

  // Rope line
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(vine.position.x, vine.position.y);
  ctx.lineTo(vine.position.x, vine.position.y + vine.ropeLength);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Label
  ctx.fillStyle = color;
  ctx.font = "8px monospace";
  ctx.fillText("V", vine.position.x + 6, vine.position.y + 3);
}

// ─── Ability Pedestal Rendering ──────────────────────────────────

const PEDESTAL_BASE_W = 48;
const PEDESTAL_BASE_H = 16;
const PEDESTAL_COL_W = 16;
const PEDESTAL_COL_H = 32;
const PEDESTAL_ORB_R = 12;
const PEDESTAL_GLOW_R = 20;
const PEDESTAL_PULSE_SPEED = 3;
const PEDESTAL_MOTE_COUNT = 3;

/** Render an ability pickup pedestal — pulsing glow when uncollected, dimmed when collected */
export function renderAbilityPedestal(
  ctx: CanvasRenderingContext2D,
  pickup: AbilityPickup,
  isCollected: boolean,
  time: number,
): void {
  const { x, y } = pickup.position;
  const color = GATE_COLORS[pickup.ability];

  if (isCollected) {
    // Dimmed base + column
    ctx.globalAlpha = 0.3;

    ctx.fillStyle = "#555";
    ctx.fillRect(x - PEDESTAL_BASE_W / 2, y + 16, PEDESTAL_BASE_W, PEDESTAL_BASE_H);

    ctx.fillStyle = "#777";
    ctx.fillRect(x - PEDESTAL_COL_W / 2, y - 16, PEDESTAL_COL_W, PEDESTAL_COL_H);

    // Very dim orb
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y - 28, PEDESTAL_ORB_R, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    return;
  }

  // Uncollected pedestal — full brightness with pulsing glow

  // Base
  ctx.fillStyle = "#555";
  ctx.fillRect(x - PEDESTAL_BASE_W / 2, y + 16, PEDESTAL_BASE_W, PEDESTAL_BASE_H);

  // Column
  ctx.fillStyle = "#777";
  ctx.fillRect(x - PEDESTAL_COL_W / 2, y - 16, PEDESTAL_COL_W, PEDESTAL_COL_H);

  // Pulsing glow
  const pulse = Math.sin(time * PEDESTAL_PULSE_SPEED);
  const glowAlpha = 0.4 + (pulse + 1) / 2 * 0.4; // 0.4 to 0.8

  const gradient = ctx.createRadialGradient(x, y - 28, 0, x, y - 28, PEDESTAL_GLOW_R);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "transparent");
  ctx.globalAlpha = glowAlpha;
  ctx.fillStyle = gradient;
  ctx.fillRect(x - PEDESTAL_GLOW_R, y - 28 - PEDESTAL_GLOW_R, PEDESTAL_GLOW_R * 2, PEDESTAL_GLOW_R * 2);

  // Orb
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - 28, PEDESTAL_ORB_R, 0, Math.PI * 2);
  ctx.fill();

  // Rising motes
  for (let i = 0; i < PEDESTAL_MOTE_COUNT; i++) {
    const phase = (time * 0.8 + i * 2.1) % 3;
    const moteY = y - 28 - phase * 20;
    const moteX = x + Math.sin(time * 2 + i * 1.7) * 10;
    const moteAlpha = Math.max(0, 1 - phase / 3);

    ctx.globalAlpha = moteAlpha * 0.7;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(moteX, moteY, 2 + (1 - phase / 3), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}
