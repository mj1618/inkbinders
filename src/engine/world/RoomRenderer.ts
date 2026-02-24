// RoomRenderer — rendering for room-specific elements (gates, exits, transitions, bounds)

import type {
  AbilityGate,
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

// ─── Gate Rendering ─────────────────────────────────────────────────

/** Render ability gates (locked = colored barrier with pulse, opened = invisible) */
export function renderGates(
  ctx: CanvasRenderingContext2D,
  gates: AbilityGate[],
  time: number,
): void {
  for (const gate of gates) {
    if (gate.opened) continue;

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
  ctx.globalAlpha = 1;
}

// ─── Exit Indicators ────────────────────────────────────────────────

/** Render arrows at room edges where exits are */
export function renderExitIndicators(
  ctx: CanvasRenderingContext2D,
  exits: RoomExit[],
  time: number,
): void {
  for (const exit of exits) {
    const { zone, direction } = exit;

    // Pulse
    const pulse = (Math.sin(time * 2 * Math.PI) + 1) / 2;
    const alpha = 0.3 + pulse * 0.3;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = EXIT_INDICATOR_COLOR;

    const cx = zone.x + zone.width / 2;
    const cy = zone.y + zone.height / 2;
    const s = EXIT_INDICATOR_SIZE;

    ctx.beginPath();
    drawArrow(ctx, cx, cy, s, direction);
    ctx.fill();
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
