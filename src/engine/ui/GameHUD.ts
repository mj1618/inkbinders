// GameHUD — Unified in-game heads-up display
// Pure engine class: no React dependencies

import type { PlayerHealth } from "@/engine/combat/PlayerHealth";
import type { CombatSystem } from "@/engine/combat/CombatSystem";
import type { MarginStitch } from "@/engine/abilities/MarginStitch";
import type { Redaction } from "@/engine/abilities/Redaction";
import type { PasteOver } from "@/engine/abilities/PasteOver";
import type { IndexMark } from "@/engine/abilities/IndexMark";
import type { DayNightCycle } from "@/engine/world/DayNightCycle";
import { InputAction } from "@/engine/input/InputManager";
import type { InputManager } from "@/engine/input/InputManager";

// ─── Types ──────────────────────────────────────────────────────────

export interface GameHUDConfig {
  showHealth: boolean;
  showAbilities: boolean;
  showWeapon: boolean;
  showClock: boolean;
  showRoomName: boolean;
  showMinimap: boolean;
  showNotifications: boolean;
}

export interface GameHUDSystems {
  health: PlayerHealth | null;
  combat: CombatSystem | null;
  marginStitch: MarginStitch | null;
  redaction: Redaction | null;
  pasteOver: PasteOver | null;
  indexMark: IndexMark | null;
  dayNight: DayNightCycle | null;
  input: InputManager;
}

export type PauseAction = "resume" | "quit";
export type NotificationType = "info" | "ability" | "gate" | "item" | "warning";

export interface HUDNotification {
  message: string;
  type: NotificationType;
  timer: number;
  alpha: number;
}

// ─── Constants ──────────────────────────────────────────────────────

// Health bar
const HP_BAR_X = 16;
const HP_BAR_Y = 12;
const HP_BAR_WIDTH = 120;
const HP_BAR_HEIGHT = 12;
const HP_DAMAGE_FLASH_FRAMES = 6;
const HP_LOW_PULSE_RATE = 4; // Hz

// Ability bar
const ABILITY_BAR_Y_OFFSET = 56; // from bottom
const ABILITY_SLOT_WIDTH = 40;
const ABILITY_SLOT_HEIGHT = 52;
const ABILITY_SLOT_SPACING = 4;
const ABILITY_ICON_SIZE = 24;
const ABILITY_BAR_X = 16;

// Weapon indicator
const WEAPON_WIDTH = 80;
const WEAPON_HEIGHT = 44;
const WEAPON_Y_OFFSET = 56; // from bottom

// Room name
const ROOM_NAME_FADE_IN = 20;
const ROOM_NAME_HOLD = 120;
const ROOM_NAME_FADE_OUT = 30;
const ROOM_NAME_TOTAL = ROOM_NAME_FADE_IN + ROOM_NAME_HOLD + ROOM_NAME_FADE_OUT;

// Notifications
const NOTIFICATION_FADE_IN = 10;
const NOTIFICATION_HOLD = 90;
const NOTIFICATION_FADE_OUT = 20;
const NOTIFICATION_TOTAL = NOTIFICATION_FADE_IN + NOTIFICATION_HOLD + NOTIFICATION_FADE_OUT;
const NOTIFICATION_GAP = 10;
const MAX_QUEUED_NOTIFICATIONS = 5;

// Pause menu
const PAUSE_OVERLAY_ALPHA = 0.7;
const PAUSE_MENU_WIDTH = 200;
const PAUSE_MENU_HEIGHT = 120;
const PAUSE_OPTIONS = ["Resume", "Quit"] as const;

// Notification type styling
const NOTIFICATION_STYLES: Record<NotificationType, { color: string; prefix: string }> = {
  info: { color: "#ffffff", prefix: "" },
  ability: { color: "#22d3ee", prefix: "\u2726 " },
  gate: { color: "#fbbf24", prefix: "\u2B21 " },
  item: { color: "#4ade80", prefix: "\u25C6 " },
  warning: { color: "#ef4444", prefix: "\u26A0 " },
};

// ─── GameHUD Class ──────────────────────────────────────────────────

export class GameHUD {
  config: GameHUDConfig;
  systems: GameHUDSystems;

  // Pause state
  paused = false;
  pauseMenuSelection = 0;

  // Notification queue
  private notifications: HUDNotification[] = [];
  private notificationGapTimer = 0;

  // Room name display
  private roomNameText = "";
  private roomNameTimer = 0;

  // Internal frame counter for animations
  private frameCount = 0;

  // Track previous health for damage flash
  private prevHealth = -1;
  private damageFlashTimer = 0;

  constructor(systems: GameHUDSystems, config?: Partial<GameHUDConfig>) {
    this.systems = systems;
    this.config = {
      showHealth: true,
      showAbilities: true,
      showWeapon: true,
      showClock: true,
      showRoomName: true,
      showMinimap: false,
      showNotifications: true,
      ...config,
    };
  }

  /** Update HUD state. Call once per frame. */
  update(_dt: number): void {
    this.frameCount++;

    // Track damage flash
    if (this.systems.health) {
      const hp = this.systems.health.health;
      if (this.prevHealth >= 0 && hp < this.prevHealth) {
        this.damageFlashTimer = HP_DAMAGE_FLASH_FRAMES;
      }
      this.prevHealth = hp;
    }
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer--;
    }

    // Room name timer
    if (this.roomNameTimer > 0) {
      this.roomNameTimer--;
    }

    // Notification processing
    if (this.notifications.length > 0) {
      const notif = this.notifications[0];
      if (this.notificationGapTimer > 0) {
        this.notificationGapTimer--;
      } else {
        notif.timer--;

        // Compute alpha based on phase
        const elapsed = NOTIFICATION_TOTAL - notif.timer;
        if (elapsed < NOTIFICATION_FADE_IN) {
          notif.alpha = elapsed / NOTIFICATION_FADE_IN;
        } else if (notif.timer < NOTIFICATION_FADE_OUT) {
          notif.alpha = notif.timer / NOTIFICATION_FADE_OUT;
        } else {
          notif.alpha = 1;
        }

        if (notif.timer <= 0) {
          this.notifications.shift();
          this.notificationGapTimer = NOTIFICATION_GAP;
        }
      }
    }
  }

  /** Check and toggle pause state from input. Returns true if game is paused. */
  checkPause(): boolean {
    if (this.systems.input.isPressed(InputAction.Pause)) {
      if (this.paused) {
        this.paused = false;
      } else {
        this.paused = true;
        this.pauseMenuSelection = 0;
      }
    }
    return this.paused;
  }

  /** Handle pause menu input. Returns selected action or null. */
  handlePauseInput(): PauseAction | null {
    if (!this.paused) return null;

    const input = this.systems.input;

    // Navigation
    if (input.isPressed(InputAction.Up)) {
      this.pauseMenuSelection = Math.max(0, this.pauseMenuSelection - 1);
    }
    if (input.isPressed(InputAction.Down)) {
      this.pauseMenuSelection = Math.min(PAUSE_OPTIONS.length - 1, this.pauseMenuSelection + 1);
    }

    // Confirm
    if (input.isPressed(InputAction.Jump) || input.isPressed(InputAction.Attack)) {
      const action = PAUSE_OPTIONS[this.pauseMenuSelection].toLowerCase() as PauseAction;
      if (action === "resume") {
        this.paused = false;
      }
      return action;
    }

    return null;
  }

  /** Show a room name card */
  showRoomName(name: string): void {
    this.roomNameText = name;
    this.roomNameTimer = ROOM_NAME_TOTAL;
  }

  /** Push a notification message */
  notify(message: string, type: NotificationType = "info"): void {
    if (this.notifications.length >= MAX_QUEUED_NOTIFICATIONS) return;
    this.notifications.push({
      message,
      type,
      timer: NOTIFICATION_TOTAL,
      alpha: 0,
    });
  }

  /** Render the full HUD overlay in screen-space. */
  render(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    ctx.save();

    if (this.config.showHealth) {
      this.renderHealthBar(ctx);
    }
    if (this.config.showAbilities) {
      this.renderAbilityBar(ctx, canvasHeight);
    }
    if (this.config.showWeapon && this.systems.combat) {
      this.renderWeaponIndicator(ctx, canvasWidth, canvasHeight);
    }
    if (this.config.showClock && this.systems.dayNight) {
      this.renderClock(ctx, canvasWidth);
    }
    if (this.config.showRoomName && this.roomNameTimer > 0) {
      this.renderRoomName(ctx, canvasWidth, canvasHeight);
    }
    if (this.config.showNotifications && this.notifications.length > 0) {
      this.renderNotification(ctx, canvasHeight);
    }

    ctx.restore();
  }

  /** Render the pause menu overlay. Only renders when paused. */
  renderPauseMenu(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    if (!this.paused) return;

    ctx.save();

    // Dark overlay
    ctx.fillStyle = `rgba(0, 0, 0, ${PAUSE_OVERLAY_ALPHA})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Menu box
    const mx = (canvasWidth - PAUSE_MENU_WIDTH) / 2;
    const my = (canvasHeight - PAUSE_MENU_HEIGHT) / 2;

    // Background
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(mx, my, PAUSE_MENU_WIDTH, PAUSE_MENU_HEIGHT);

    // Border
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 2;
    ctx.strokeRect(mx, my, PAUSE_MENU_WIDTH, PAUSE_MENU_HEIGHT);

    // Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px monospace";
    ctx.textAlign = "center";
    ctx.fillText("PAUSED", mx + PAUSE_MENU_WIDTH / 2, my + 32);

    // Divider
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mx + 16, my + 44);
    ctx.lineTo(mx + PAUSE_MENU_WIDTH - 16, my + 44);
    ctx.stroke();

    // Options
    ctx.font = "14px monospace";
    for (let i = 0; i < PAUSE_OPTIONS.length; i++) {
      const optY = my + 68 + i * 24;
      const selected = i === this.pauseMenuSelection;

      if (selected) {
        // Highlight background
        ctx.fillStyle = "rgba(75, 85, 99, 0.4)";
        ctx.fillRect(mx + 16, optY - 14, PAUSE_MENU_WIDTH - 32, 22);
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText(`> ${PAUSE_OPTIONS[i]}`, mx + PAUSE_MENU_WIDTH / 2, optY);
      } else {
        ctx.fillStyle = "#9ca3af";
        ctx.textAlign = "center";
        ctx.fillText(PAUSE_OPTIONS[i], mx + PAUSE_MENU_WIDTH / 2, optY);
      }
    }

    // Controls hint
    ctx.fillStyle = "#6b7280";
    ctx.font = "10px monospace";
    ctx.fillText("\u2191\u2193 Navigate  \u23CE/Space Confirm  ESC Resume", mx + PAUSE_MENU_WIDTH / 2, my + PAUSE_MENU_HEIGHT - 8);

    ctx.restore();
  }

  // ─── Private Rendering Methods ──────────────────────────────────

  private renderHealthBar(ctx: CanvasRenderingContext2D): void {
    const health = this.systems.health;
    if (!health) return;

    const hp = health.health;
    const maxHp = health.maxHealth;

    // Background
    ctx.fillStyle = "#1f1f1f";
    roundRect(ctx, HP_BAR_X, HP_BAR_Y, HP_BAR_WIDTH, HP_BAR_HEIGHT, 3);
    ctx.fill();

    // Missing HP (dark red)
    ctx.fillStyle = "#7f1d1d";
    roundRect(ctx, HP_BAR_X, HP_BAR_Y, HP_BAR_WIDTH, HP_BAR_HEIGHT, 3);
    ctx.fill();

    // Current HP fill
    const fillWidth = maxHp > 0 ? (hp / maxHp) * HP_BAR_WIDTH : 0;
    if (fillWidth > 0) {
      // Determine fill color
      if (this.damageFlashTimer > 0) {
        ctx.fillStyle = "#ffffff";
      } else if (hp === 1) {
        // Pulse between red and orange at 4 Hz
        const t = (Math.sin(this.frameCount * HP_LOW_PULSE_RATE * 2 * Math.PI / 60) + 1) / 2;
        ctx.fillStyle = t > 0.5 ? "#f97316" : "#ef4444";
      } else {
        ctx.fillStyle = "#ef4444";
      }
      roundRect(ctx, HP_BAR_X, HP_BAR_Y, fillWidth, HP_BAR_HEIGHT, 3);
      ctx.fill();
    }

    // Border
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 1;
    roundRect(ctx, HP_BAR_X, HP_BAR_Y, HP_BAR_WIDTH, HP_BAR_HEIGHT, 3);
    ctx.stroke();

    // HP text
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`${hp} / ${maxHp}`, HP_BAR_X, HP_BAR_Y + HP_BAR_HEIGHT + 12);
  }

  private renderAbilityBar(ctx: CanvasRenderingContext2D, canvasHeight: number): void {
    const barY = canvasHeight - ABILITY_BAR_Y_OFFSET;

    const abilities: Array<{
      key: string;
      name: string;
      cooldownRatio: number;
      activeCount: number;
      maxCount: number;
      enabled: boolean;
      drawIcon: (cx: number, cy: number) => void;
    }> = [
      {
        key: "E",
        name: "Stitch",
        cooldownRatio: this.getStitchCooldownRatio(),
        activeCount: this.systems.marginStitch?.activeStitch ? 1 : 0,
        maxCount: 1,
        enabled: this.systems.marginStitch?.params.enabled ?? false,
        drawIcon: (cx, cy) => this.drawStitchIcon(ctx, cx, cy),
      },
      {
        key: "Q",
        name: "Red",
        cooldownRatio: this.getRedactionCooldownRatio(),
        activeCount: this.systems.redaction?.activeRedactions.length ?? 0,
        maxCount: this.systems.redaction?.params.maxActiveRedactions ?? 2,
        enabled: this.systems.redaction?.params.enabled ?? false,
        drawIcon: (cx, cy) => this.drawRedactionIcon(ctx, cx, cy),
      },
      {
        key: "R",
        name: "Paste",
        cooldownRatio: this.getPasteOverCooldownRatio(),
        activeCount: this.systems.pasteOver?.activePastes.length ?? 0,
        maxCount: this.systems.pasteOver?.params.maxActivePastes ?? 3,
        enabled: this.systems.pasteOver?.params.enabled ?? false,
        drawIcon: (cx, cy) => this.drawPasteOverIcon(ctx, cx, cy),
      },
      {
        key: "F",
        name: "Index",
        cooldownRatio: this.getIndexMarkCooldownRatio(),
        activeCount: this.systems.indexMark?.marks.length ?? 0,
        maxCount: this.systems.indexMark?.params.maxMarks ?? 4,
        enabled: this.systems.indexMark?.params.enabled ?? false,
        drawIcon: (cx, cy) => this.drawIndexMarkIcon(ctx, cx, cy),
      },
    ];

    for (let i = 0; i < abilities.length; i++) {
      const ab = abilities[i];
      const slotX = ABILITY_BAR_X + i * (ABILITY_SLOT_WIDTH + ABILITY_SLOT_SPACING);
      const slotY = barY;

      // Slot background
      ctx.fillStyle = ab.enabled ? "#1a1a1a" : "#111111";
      roundRect(ctx, slotX, slotY, ABILITY_SLOT_WIDTH, ABILITY_SLOT_HEIGHT, 4);
      ctx.fill();

      // Slot border — glow if active
      if (ab.activeCount > 0 && ab.cooldownRatio === 0) {
        ctx.strokeStyle = "#60a5fa";
        ctx.lineWidth = 1.5;
      } else {
        ctx.strokeStyle = "#374151";
        ctx.lineWidth = 1;
      }
      roundRect(ctx, slotX, slotY, ABILITY_SLOT_WIDTH, ABILITY_SLOT_HEIGHT, 4);
      ctx.stroke();

      // Keybind label
      ctx.fillStyle = ab.enabled ? "#9ca3af" : "#4b5563";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(ab.key, slotX + ABILITY_SLOT_WIDTH / 2, slotY + 12);

      // Ability icon
      const iconCx = slotX + ABILITY_SLOT_WIDTH / 2;
      const iconCy = slotY + 14 + ABILITY_ICON_SIZE / 2;
      if (ab.enabled) {
        ctx.globalAlpha = ab.cooldownRatio > 0 ? 0.4 : 1.0;
        ab.drawIcon(iconCx, iconCy);
        ctx.globalAlpha = 1.0;
      }

      // Cooldown overlay (sweeps from top to bottom)
      if (ab.cooldownRatio > 0 && ab.enabled) {
        const sweepHeight = ab.cooldownRatio * ABILITY_SLOT_HEIGHT;
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        roundRect(ctx, slotX, slotY, ABILITY_SLOT_WIDTH, sweepHeight, 4);
        ctx.fill();
      }

      // Active count dots
      if (ab.maxCount > 1) {
        const dotY = slotY + ABILITY_SLOT_HEIGHT - 8;
        const dotSpacing = 6;
        const totalDotWidth = ab.maxCount * dotSpacing;
        const startDotX = slotX + (ABILITY_SLOT_WIDTH - totalDotWidth) / 2 + dotSpacing / 2;

        for (let d = 0; d < ab.maxCount; d++) {
          const dotX = startDotX + d * dotSpacing;
          ctx.beginPath();
          ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
          ctx.fillStyle = d < ab.activeCount ? "#60a5fa" : "#374151";
          ctx.fill();
        }
      }
    }
  }

  private renderWeaponIndicator(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    const combat = this.systems.combat;
    if (!combat) return;

    const wx = Math.floor(canvasWidth / 2 - WEAPON_WIDTH / 2);
    const wy = canvasHeight - WEAPON_Y_OFFSET;

    // Background
    ctx.fillStyle = "#1a1a1a";
    roundRect(ctx, wx, wy, WEAPON_WIDTH, WEAPON_HEIGHT, 4);
    ctx.fill();

    // Border
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 1;
    roundRect(ctx, wx, wy, WEAPON_WIDTH, WEAPON_HEIGHT, 4);
    ctx.stroke();

    // Weapon icon
    const iconCx = wx + WEAPON_WIDTH / 2;
    const iconCy = wy + 18;
    const isAttacking = combat.attackPhase !== "idle";

    if (combat.currentWeapon === "quill-spear") {
      // Draw spear/quill line
      ctx.strokeStyle = isAttacking ? "#93c5fd" : "#60a5fa";
      ctx.lineWidth = isAttacking ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(iconCx - 14, iconCy + 8);
      ctx.lineTo(iconCx + 14, iconCy - 8);
      ctx.stroke();
      // Pointed tip
      ctx.beginPath();
      ctx.moveTo(iconCx + 14, iconCy - 8);
      ctx.lineTo(iconCx + 10, iconCy - 4);
      ctx.lineTo(iconCx + 10, iconCy - 10);
      ctx.closePath();
      ctx.fillStyle = isAttacking ? "#93c5fd" : "#60a5fa";
      ctx.fill();
    } else {
      // Draw starburst for ink-snap
      const color = isAttacking ? "#a5b4fc" : "#818cf8";
      ctx.strokeStyle = color;
      ctx.lineWidth = isAttacking ? 2.5 : 2;
      const rays = 6;
      const innerR = 4;
      const outerR = isAttacking ? 14 : 10;
      for (let r = 0; r < rays; r++) {
        const angle = (r / rays) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(iconCx + Math.cos(angle) * innerR, iconCy + Math.sin(angle) * innerR);
        ctx.lineTo(iconCx + Math.cos(angle) * outerR, iconCy + Math.sin(angle) * outerR);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(iconCx, iconCy, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    // Weapon name
    const weaponName = combat.currentWeapon === "quill-spear" ? "Spear" : "Snap";
    ctx.fillStyle = "#d1d5db";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(weaponName, iconCx, wy + WEAPON_HEIGHT - 10);

    // Switch hint
    ctx.fillStyle = "#6b7280";
    ctx.font = "8px monospace";
    ctx.fillText("[K]", iconCx, wy + WEAPON_HEIGHT - 2);
  }

  private renderClock(ctx: CanvasRenderingContext2D, canvasWidth: number): void {
    const dayNight = this.systems.dayNight;
    if (!dayNight) return;

    const clockX = canvasWidth - 136;
    const clockY = 12;

    // Phase info
    const phase = dayNight.timeOfDay;
    const t = dayNight.time;

    // Format time as M:SS from cycle elapsed
    const elapsed = dayNight.cycleElapsed;
    const mins = Math.floor(elapsed / 60);
    const secs = Math.floor(elapsed % 60);
    const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;

    // Phase name (capitalize first letter)
    const phaseName = phase.charAt(0).toUpperCase() + phase.slice(1);

    // Draw sun/moon icon
    const iconX = clockX;
    const iconY = clockY + 6;
    const iconR = 6;

    if (phase === "day" || phase === "dawn") {
      // Sun — filled circle with rays
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(iconX, iconY, iconR, 0, Math.PI * 2);
      ctx.fill();
      // Small rays
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 1;
      for (let r = 0; r < 8; r++) {
        const angle = (r / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(iconX + Math.cos(angle) * (iconR + 2), iconY + Math.sin(angle) * (iconR + 2));
        ctx.lineTo(iconX + Math.cos(angle) * (iconR + 4), iconY + Math.sin(angle) * (iconR + 4));
        ctx.stroke();
      }
    } else {
      // Moon — crescent
      ctx.fillStyle = "#e5e7eb";
      ctx.beginPath();
      ctx.arc(iconX, iconY, iconR, 0, Math.PI * 2);
      ctx.fill();
      // Dark cutout for crescent
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath();
      ctx.arc(iconX + 3, iconY - 2, iconR - 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Phase name + time text
    ctx.fillStyle = "#d1d5db";
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`${phaseName} ${timeStr}`, iconX + iconR + 6, clockY + 10);

    // Progress bar
    const barX = clockX;
    const barY = clockY + 18;
    const barW = 120;
    const barH = 4;

    ctx.fillStyle = "#374151";
    ctx.fillRect(barX, barY, barW, barH);

    // Progress fill
    const progressColor = phase === "day" ? "#fbbf24" : phase === "dawn" ? "#fb923c" : phase === "dusk" ? "#f97316" : "#6366f1";
    ctx.fillStyle = progressColor;
    ctx.fillRect(barX, barY, t * barW, barH);
  }

  private renderRoomName(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    if (this.roomNameTimer <= 0 || !this.roomNameText) return;

    // Compute alpha
    const remaining = this.roomNameTimer;
    const elapsed = ROOM_NAME_TOTAL - remaining;
    let alpha: number;
    if (elapsed < ROOM_NAME_FADE_IN) {
      alpha = elapsed / ROOM_NAME_FADE_IN;
    } else if (remaining < ROOM_NAME_FADE_OUT) {
      alpha = remaining / ROOM_NAME_FADE_OUT;
    } else {
      alpha = 1;
    }

    ctx.globalAlpha = alpha;

    // Measure text
    ctx.font = "14px monospace";
    const textWidth = ctx.measureText(this.roomNameText).width;
    const px = 12;
    const py = 4;
    const rx = canvasWidth - 16 - textWidth - px * 2;
    const ry = canvasHeight - 40;

    // Background pill
    ctx.fillStyle = "rgba(26, 26, 26, 0.8)";
    roundRect(ctx, rx, ry, textWidth + px * 2, 24, 6);
    ctx.fill();

    // Text
    ctx.fillStyle = "#e5e7eb";
    ctx.textAlign = "left";
    ctx.fillText(this.roomNameText, rx + px, ry + 16);

    ctx.globalAlpha = 1;
  }

  private renderNotification(ctx: CanvasRenderingContext2D, canvasHeight: number): void {
    if (this.notifications.length === 0 || this.notificationGapTimer > 0) return;

    const notif = this.notifications[0];
    const style = NOTIFICATION_STYLES[notif.type];

    const nx = 16;
    const ny = canvasHeight - 100;

    ctx.globalAlpha = notif.alpha;

    // Notification text with prefix
    const text = style.prefix + notif.message;

    // Background
    ctx.font = "12px monospace";
    const textWidth = ctx.measureText(text).width;
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    roundRect(ctx, nx - 4, ny - 12, textWidth + 12, 20, 4);
    ctx.fill();

    // Text
    ctx.fillStyle = style.color;
    ctx.textAlign = "left";
    ctx.fillText(text, nx, ny);

    ctx.globalAlpha = 1;
  }

  // ─── Cooldown Ratio Helpers ─────────────────────────────────────

  private getStitchCooldownRatio(): number {
    const s = this.systems.marginStitch;
    if (!s || s.params.stitchCooldown <= 0) return 0;
    return Math.min(1, s.cooldownTimer / s.params.stitchCooldown);
  }

  private getRedactionCooldownRatio(): number {
    const r = this.systems.redaction;
    if (!r || r.params.redactionCooldown <= 0) return 0;
    return Math.min(1, r.cooldownTimer / r.params.redactionCooldown);
  }

  private getPasteOverCooldownRatio(): number {
    const p = this.systems.pasteOver;
    if (!p || p.params.pasteCooldown <= 0) return 0;
    return Math.min(1, p.cooldownTimer / p.params.pasteCooldown);
  }

  private getIndexMarkCooldownRatio(): number {
    const im = this.systems.indexMark;
    if (!im || im.params.teleportCooldown <= 0) return 0;
    return Math.min(1, im.cooldownTimer / im.params.teleportCooldown);
  }

  // ─── Ability Icon Drawing ───────────────────────────────────────

  private drawStitchIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    // Two vertical lines with a horizontal bridge
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    // Left line
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 8);
    ctx.lineTo(cx - 8, cy + 8);
    ctx.stroke();
    // Right line
    ctx.beginPath();
    ctx.moveTo(cx + 8, cy - 8);
    ctx.lineTo(cx + 8, cy + 8);
    ctx.stroke();
    // Bridge stitches
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 3);
    ctx.lineTo(cx + 8, cy - 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + 3);
    ctx.lineTo(cx + 8, cy + 3);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawRedactionIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    // Black rectangle with red X
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(cx - 8, cy - 6, 16, 12);
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy - 4);
    ctx.lineTo(cx + 6, cy + 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 6, cy - 4);
    ctx.lineTo(cx - 6, cy + 4);
    ctx.stroke();
  }

  private drawPasteOverIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    // Stamp/paintbrush shape
    ctx.fillStyle = "#f59e0b";
    // Stamp head
    ctx.fillRect(cx - 6, cy - 8, 12, 8);
    // Handle
    ctx.fillRect(cx - 2, cy, 4, 8);
    // Stamp base line
    ctx.strokeStyle = "#d97706";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy);
    ctx.lineTo(cx + 7, cy);
    ctx.stroke();
  }

  private drawIndexMarkIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    // Bookmark/pin shape
    ctx.fillStyle = "#a78bfa";
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy - 8);
    ctx.lineTo(cx + 6, cy - 8);
    ctx.lineTo(cx + 6, cy + 4);
    ctx.lineTo(cx, cy + 8);
    ctx.lineTo(cx - 6, cy + 4);
    ctx.closePath();
    ctx.fill();
    // Inner line
    ctx.strokeStyle = "#7c3aed";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 3, cy - 4);
    ctx.lineTo(cx + 3, cy - 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 3, cy);
    ctx.lineTo(cx + 3, cy);
    ctx.stroke();
  }
}

// ─── Utility ──────────────────────────────────────────────────────

/** Draw a rounded rectangle path (does not fill/stroke) */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
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
