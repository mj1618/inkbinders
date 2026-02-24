import type { Vec2 } from "@/lib/types";
import type { Camera } from "@/engine/core/Camera";
import type { ParticleSystem } from "@/engine/core/ParticleSystem";
import { InputAction, InputManager } from "@/engine/input/InputManager";

// ─── Data Structures ───────────────────────────────────────────────

export interface IndexMarkParams {
  /** Maximum number of marks the player can have placed at once */
  maxMarks: number;
  /** Hold threshold in frames before entering teleport mode */
  holdThreshold: number;
  /** Cooldown after teleporting before another teleport (seconds) */
  teleportCooldown: number;
  /** Duration of the teleport visual effect (seconds) */
  teleportVisualDuration: number;
  /** Whether placed marks expire over time */
  marksExpire: boolean;
  /** Mark lifetime in seconds (only if marksExpire is true) */
  markLifetime: number;
  /** Brief invincibility frames after teleporting */
  teleportIFrames: number;
  /** Whether the ability is unlocked/available */
  enabled: boolean;
}

export const DEFAULT_INDEX_MARK_PARAMS: IndexMarkParams = {
  maxMarks: 4,
  holdThreshold: 10,
  teleportCooldown: 1.5,
  teleportVisualDuration: 0.3,
  marksExpire: false,
  markLifetime: 30.0,
  teleportIFrames: 12,
  enabled: true,
};

export interface PlacedMark {
  id: string;
  position: Vec2;
  colorIndex: number;
  placedAt: number;
  remainingLife: number;
  wasGrounded: boolean;
}

export interface TeleportState {
  selecting: boolean;
  selectedIndex: number;
  holdFrames: number;
  visualActive: boolean;
  visualTimer: number;
  teleportOrigin: Vec2 | null;
  teleportDestination: Vec2 | null;
}

export type IndexMarkAction =
  | { action: "place" }
  | { action: "teleport"; targetPosition: Vec2 }
  | { action: "cancel" };

// ─── Visual Colors ──────────────────────────────────────────────────

const MARK_COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#ef4444"]; // amber, blue, green, red
const MARK_GLOW_COLORS = [
  "rgba(245, 158, 11, 0.4)",
  "rgba(59, 130, 246, 0.4)",
  "rgba(16, 185, 129, 0.4)",
  "rgba(239, 68, 68, 0.4)",
];

// ─── IndexMark Class ────────────────────────────────────────────────

export class IndexMark {
  params: IndexMarkParams;

  /** All currently placed marks */
  marks: PlacedMark[] = [];

  /** Teleport selection / animation state */
  teleportState: TeleportState;

  /** Cooldown timer (seconds remaining) */
  cooldownTimer = 0;

  /** Remaining i-frames after teleport */
  iFramesRemaining = 0;

  /** Counter for generating unique IDs */
  private nextId = 0;

  /** Counter for color cycling */
  private nextColorIndex = 0;

  /** Pulse timer for animations */
  private pulseTimer = 0;

  /** Optional particle system */
  particleSystem: ParticleSystem | null = null;

  /** Timestamp counter (incremented each frame for mark age tracking) */
  private frameTimestamp = 0;

  constructor(params?: Partial<IndexMarkParams>) {
    this.params = { ...DEFAULT_INDEX_MARK_PARAMS, ...params };
    this.teleportState = this.createDefaultTeleportState();
  }

  private createDefaultTeleportState(): TeleportState {
    return {
      selecting: false,
      selectedIndex: 0,
      holdFrames: 0,
      visualActive: false,
      visualTimer: 0,
      teleportOrigin: null,
      teleportDestination: null,
    };
  }

  /** Whether the ability can place a new mark right now */
  get canPlace(): boolean {
    return this.params.enabled && !this.teleportState.selecting;
  }

  /** Whether the ability can initiate teleport selection */
  get canTeleport(): boolean {
    return (
      this.params.enabled &&
      this.marks.length > 0 &&
      this.cooldownTimer <= 0 &&
      !this.teleportState.visualActive
    );
  }

  /**
   * Handle ability key press start.
   * Call when the ability key is first pressed (isPressed).
   */
  onKeyDown(): void {
    if (!this.params.enabled) return;
    this.teleportState.holdFrames = 0;
  }

  /**
   * Handle ability key held each frame.
   * Increments hold counter, enters teleport mode after threshold.
   */
  onKeyHeld(input: InputManager): void {
    if (!this.params.enabled) return;

    this.teleportState.holdFrames++;

    // Enter teleport selection mode after threshold
    if (
      !this.teleportState.selecting &&
      this.teleportState.holdFrames >= this.params.holdThreshold &&
      this.canTeleport
    ) {
      this.teleportState.selecting = true;
      this.teleportState.selectedIndex = 0;
    }

    // Cycle marks with Left/Right during selection
    if (this.teleportState.selecting && this.marks.length > 0) {
      if (input.isPressed(InputAction.Left)) {
        this.cycleSelection(-1);
      }
      if (input.isPressed(InputAction.Right)) {
        this.cycleSelection(1);
      }
    }
  }

  /**
   * Handle ability key release.
   * If hold was short: place a mark.
   * If hold was long (teleport mode): execute teleport to selected mark.
   */
  onKeyUp(
    playerPosition: Vec2,
    playerGrounded: boolean,
  ): IndexMarkAction {
    if (!this.params.enabled) {
      return { action: "cancel" };
    }

    const wasSelecting = this.teleportState.selecting;

    // Reset hold state
    this.teleportState.selecting = false;
    this.teleportState.holdFrames = 0;

    if (wasSelecting) {
      // Was in teleport selection mode — execute teleport
      const target = this.executeTeleport();
      if (target) {
        return { action: "teleport", targetPosition: target };
      }
      return { action: "cancel" };
    } else {
      // Short press — place a mark
      if (this.canPlace) {
        this.placeMark(
          { x: playerPosition.x, y: playerPosition.y },
          playerGrounded,
        );
        return { action: "place" };
      }
      return { action: "cancel" };
    }
  }

  /**
   * Place a mark at the given position.
   * If at maxMarks, replaces the oldest mark.
   */
  placeMark(position: Vec2, grounded: boolean): PlacedMark {
    // If at max, remove the oldest mark
    if (this.marks.length >= this.params.maxMarks) {
      const oldest = this.marks.shift()!;
      // Emit removal particles
      this.emitRemovalParticles(oldest);
    }

    const mark: PlacedMark = {
      id: `mark-${this.nextId++}`,
      position: { x: position.x, y: position.y },
      colorIndex: this.nextColorIndex % MARK_COLORS.length,
      placedAt: this.frameTimestamp,
      remainingLife: this.params.markLifetime,
      wasGrounded: grounded,
    };

    this.nextColorIndex++;
    this.marks.push(mark);

    // Emit placement particles
    this.emitPlacementParticles(mark);

    return mark;
  }

  /**
   * Execute teleport to the selected mark.
   * Returns the destination position (caller must move the player).
   */
  executeTeleport(): Vec2 | null {
    if (this.marks.length === 0) return null;
    if (this.cooldownTimer > 0) return null;

    const idx = Math.min(
      this.teleportState.selectedIndex,
      this.marks.length - 1,
    );
    const mark = this.marks[idx];

    // Start cooldown
    this.cooldownTimer = this.params.teleportCooldown;

    // Start i-frames
    this.iFramesRemaining = this.params.teleportIFrames;

    // Start visual effect
    this.teleportState.visualActive = true;
    this.teleportState.visualTimer = this.params.teleportVisualDuration;
    this.teleportState.teleportOrigin = null; // Will be set by caller
    this.teleportState.teleportDestination = {
      x: mark.position.x,
      y: mark.position.y,
    };

    return { x: mark.position.x, y: mark.position.y };
  }

  /**
   * Set the teleport origin for visual effects (call after executeTeleport).
   */
  setTeleportOrigin(origin: Vec2): void {
    this.teleportState.teleportOrigin = { x: origin.x, y: origin.y };

    // Emit origin burst particles
    if (this.particleSystem && this.teleportState.teleportDestination) {
      const destMark = this.marks[
        Math.min(this.teleportState.selectedIndex, this.marks.length - 1)
      ];
      const color = destMark
        ? MARK_COLORS[destMark.colorIndex]
        : MARK_COLORS[0];

      // Origin burst
      this.particleSystem.emit({
        x: origin.x,
        y: origin.y,
        count: 10,
        speedMin: 60,
        speedMax: 150,
        angleMin: 0,
        angleMax: Math.PI * 2,
        lifeMin: 0.15,
        lifeMax: 0.35,
        sizeMin: 2,
        sizeMax: 5,
        colors: [color, "#ffffff"],
        gravity: 40,
      });

      // Destination converging particles
      const dest = this.teleportState.teleportDestination;
      this.particleSystem.emit({
        x: dest.x,
        y: dest.y,
        count: 8,
        speedMin: 40,
        speedMax: 100,
        angleMin: 0,
        angleMax: Math.PI * 2,
        lifeMin: 0.1,
        lifeMax: 0.25,
        sizeMin: 2,
        sizeMax: 4,
        colors: [color, "#ffffff"],
        gravity: 0,
      });
    }
  }

  /** Cycle mark selection left/right during teleport selection mode */
  cycleSelection(direction: -1 | 1): void {
    if (this.marks.length === 0) return;
    this.teleportState.selectedIndex =
      (this.teleportState.selectedIndex + direction + this.marks.length) %
      this.marks.length;
  }

  /** Remove a specific mark by ID */
  removeMark(id: string): void {
    const idx = this.marks.findIndex((m) => m.id === id);
    if (idx !== -1) {
      this.marks.splice(idx, 1);
    }
  }

  /** Clear all marks */
  clearAllMarks(): void {
    this.marks = [];
    this.nextColorIndex = 0;
  }

  /**
   * Update timers (cooldown, mark expiry, teleport visual, i-frames).
   * Call every physics frame.
   */
  update(dt: number): void {
    this.pulseTimer += dt;
    this.frameTimestamp++;

    // Update cooldown
    if (this.cooldownTimer > 0) {
      this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);
    }

    // Update i-frames
    if (this.iFramesRemaining > 0) {
      this.iFramesRemaining--;
    }

    // Update teleport visual
    if (this.teleportState.visualActive) {
      this.teleportState.visualTimer -= dt;
      if (this.teleportState.visualTimer <= 0) {
        this.teleportState.visualActive = false;
        this.teleportState.teleportOrigin = null;
        this.teleportState.teleportDestination = null;
      }
    }

    // Update mark expiry
    if (this.params.marksExpire) {
      for (let i = this.marks.length - 1; i >= 0; i--) {
        this.marks[i].remainingLife -= dt;
        if (this.marks[i].remainingLife <= 0) {
          this.emitRemovalParticles(this.marks[i]);
          this.marks.splice(i, 1);
        }
      }
    }
  }

  /**
   * Render all marks, teleport selection UI, and teleport visual effects.
   * Call during world-space render (with camera transform applied).
   */
  render(ctx: CanvasRenderingContext2D): void {
    if (!this.params.enabled) return;

    const pulse = Math.sin(this.pulseTimer * 3) * 0.15 + 0.55;

    // Draw teleport trail during visual
    if (
      this.teleportState.visualActive &&
      this.teleportState.teleportOrigin &&
      this.teleportState.teleportDestination
    ) {
      this.renderTeleportTrail(ctx);
    }

    // Draw all placed marks
    for (let i = 0; i < this.marks.length; i++) {
      const mark = this.marks[i];
      const isSelected =
        this.teleportState.selecting &&
        i === this.teleportState.selectedIndex;
      this.renderMark(ctx, mark, i, isSelected, pulse);
    }

    // Draw selection beam during teleport selection
    if (this.teleportState.selecting && this.marks.length > 0) {
      // The beam is rendered in the test page since it needs the player position
    }
  }

  /**
   * Render screen-space UI elements (mark inventory, cooldown indicator).
   * Call during screen-space render (no camera transform).
   */
  renderUI(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    playerWorldPos: Vec2,
    canvasWidth: number,
  ): void {
    if (!this.params.enabled) return;

    // Mark inventory HUD (top-right)
    this.renderMarkInventory(ctx, camera, playerWorldPos, canvasWidth);

    // Cooldown indicator near player
    if (this.cooldownTimer > 0) {
      const playerScreen = camera.worldToScreen(playerWorldPos);
      this.renderCooldownIndicator(ctx, playerScreen);
    }
  }

  // ─── Private Render Methods ──────────────────────────────────────

  private renderMark(
    ctx: CanvasRenderingContext2D,
    mark: PlacedMark,
    index: number,
    isSelected: boolean,
    pulse: number,
  ): void {
    const { x, y } = mark.position;
    const color = MARK_COLORS[mark.colorIndex];
    const glowColor = MARK_GLOW_COLORS[mark.colorIndex];

    ctx.save();

    // Glow
    const glowSize = isSelected ? 16 : 10;
    const glowAlpha = isSelected ? 0.5 + pulse * 0.3 : pulse;
    ctx.globalAlpha = glowAlpha;
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.arc(x + 4, y - 8, glowSize, 0, Math.PI * 2);
    ctx.fill();

    // Selection ring
    if (isSelected) {
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 4, y - 8, 18, 0, Math.PI * 2);
      ctx.stroke();

      // "TELEPORT" label
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = color;
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.fillText("TELEPORT", x + 4, y - 30);
      ctx.textAlign = "left";
    }

    // Tab / ribbon shape
    ctx.globalAlpha = 1;
    const tabW = 8;
    const tabH = 24;
    const tabX = x;
    const tabY = y - tabH;

    // Tab body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(tabX, tabY);
    ctx.lineTo(tabX + tabW, tabY);
    ctx.lineTo(tabX + tabW, tabY + tabH);
    ctx.lineTo(tabX + tabW / 2, tabY + tabH - 4); // notch at bottom
    ctx.lineTo(tabX, tabY + tabH);
    ctx.closePath();
    ctx.fill();

    // Tab outline
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Number label inside tab
    ctx.fillStyle = "#000000";
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "center";
    ctx.fillText(String(index + 1), tabX + tabW / 2, tabY + 12);
    ctx.textAlign = "left";

    // Thin ink line to ground
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(x + tabW / 2, y);
    ctx.lineTo(x + tabW / 2, y + 8);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }

  private renderTeleportTrail(ctx: CanvasRenderingContext2D): void {
    const origin = this.teleportState.teleportOrigin!;
    const dest = this.teleportState.teleportDestination!;
    const progress =
      1 -
      this.teleportState.visualTimer / this.params.teleportVisualDuration;

    ctx.save();

    // Fade out as visual progresses
    ctx.globalAlpha = Math.max(0, 0.6 * (1 - progress));
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(dest.x, dest.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Flash at destination
    if (progress < 0.3) {
      ctx.globalAlpha = 0.1 * (1 - progress / 0.3);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(dest.x - 40, dest.y - 40, 80, 80);
    }

    ctx.restore();
  }

  private renderMarkInventory(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    playerWorldPos: Vec2,
    canvasWidth: number,
  ): void {
    const slotSize = 18;
    const gap = 4;
    const startX = canvasWidth - (slotSize + gap) * this.params.maxMarks - 8;
    const startY = 8;

    for (let i = 0; i < this.params.maxMarks; i++) {
      const sx = startX + i * (slotSize + gap);
      const mark = this.marks[i];

      if (mark) {
        const color = MARK_COLORS[mark.colorIndex];
        const isSelected =
          this.teleportState.selecting &&
          i === this.teleportState.selectedIndex;

        // Filled slot
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(sx, startY, slotSize, slotSize);

        // Selected border
        if (isSelected) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.globalAlpha = 1;
          ctx.strokeRect(sx - 1, startY - 1, slotSize + 2, slotSize + 2);
        }

        // Distance readout
        const dx = mark.position.x - playerWorldPos.x;
        const dy = mark.position.y - playerWorldPos.y;
        const dist = Math.round(Math.sqrt(dx * dx + dy * dy));
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = "#a1a1aa";
        ctx.font = "8px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`${dist}`, sx + slotSize / 2, startY + slotSize + 10);
        ctx.textAlign = "left";
      } else {
        // Empty slot
        ctx.strokeStyle = "rgba(161, 161, 170, 0.3)";
        ctx.lineWidth = 1;
        ctx.globalAlpha = 1;
        ctx.strokeRect(sx, startY, slotSize, slotSize);
      }
    }

    ctx.globalAlpha = 1;
  }

  private renderCooldownIndicator(
    ctx: CanvasRenderingContext2D,
    playerScreenPos: Vec2,
  ): void {
    const radius = 8;
    const cx = playerScreenPos.x;
    const cy = playerScreenPos.y + 30;
    const ratio = this.cooldownTimer / this.params.teleportCooldown;

    ctx.save();

    // Background circle
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#4b5563";
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Cooldown arc
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(
      cx,
      cy,
      radius,
      -Math.PI / 2,
      -Math.PI / 2 + (1 - ratio) * Math.PI * 2,
    );
    ctx.closePath();
    ctx.fill();

    // Cooldown text
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "#f59e0b";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      this.cooldownTimer.toFixed(1),
      cx,
      cy + radius + 10,
    );
    ctx.textAlign = "left";

    ctx.restore();
  }

  // ─── Particle Methods ────────────────────────────────────────────

  private emitPlacementParticles(mark: PlacedMark): void {
    if (!this.particleSystem) return;
    const color = MARK_COLORS[mark.colorIndex];

    this.particleSystem.emit({
      x: mark.position.x + 4,
      y: mark.position.y,
      count: 6,
      speedMin: 20,
      speedMax: 60,
      angleMin: Math.PI * 0.8,
      angleMax: Math.PI * 1.2,
      lifeMin: 0.1,
      lifeMax: 0.25,
      sizeMin: 1.5,
      sizeMax: 3,
      colors: [color, "#fbbf24"],
      gravity: 100,
    });
  }

  private emitRemovalParticles(mark: PlacedMark): void {
    if (!this.particleSystem) return;
    const color = MARK_COLORS[mark.colorIndex];

    this.particleSystem.emit({
      x: mark.position.x + 4,
      y: mark.position.y - 12,
      count: 5,
      speedMin: 10,
      speedMax: 30,
      angleMin: Math.PI * 0.3,
      angleMax: Math.PI * 0.7,
      lifeMin: 0.2,
      lifeMax: 0.5,
      sizeMin: 1,
      sizeMax: 3,
      colors: [color, "#6b7280"],
      gravity: 60,
    });
  }
}
