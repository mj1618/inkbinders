import type { Vec2 } from "@/lib/types";
import type { Platform } from "@/engine/physics/TileMap";
import { TileMap } from "@/engine/physics/TileMap";
import type { Renderer } from "@/engine/core/Renderer";
import type { Camera } from "@/engine/core/Camera";
import type { ParticleSystem } from "@/engine/core/ParticleSystem";
import type { SurfaceType } from "@/engine/physics/Surfaces";
import { getSurfaceProps, SURFACE_PROPERTIES } from "@/engine/physics/Surfaces";

// ─── Data Structures ───────────────────────────────────────────────

export interface PasteOverParams {
  /** Maximum distance from player to paste onto a platform (px) */
  maxPasteRange: number;
  /** Duration the pasted surface stays active (seconds) */
  pasteDuration: number;
  /** Cooldown after a paste expires before another can be placed (seconds) */
  pasteCooldown: number;
  /** Maximum number of simultaneously active paste-overs */
  maxActivePastes: number;
  /** Whether the ability is unlocked/available */
  enabled: boolean;
}

export const DEFAULT_PASTE_OVER_PARAMS: PasteOverParams = {
  maxPasteRange: 48,
  pasteDuration: 8.0,
  pasteCooldown: 2.0,
  maxActivePastes: 3,
  enabled: true,
};

export interface ActivePasteOver {
  /** The platform being modified */
  platform: Platform;
  /** The surface type pasted onto it */
  pastedSurface: SurfaceType;
  /** The original surface type (to restore on expiry) */
  originalSurface: SurfaceType | undefined;
  /** Remaining duration in seconds */
  remainingTime: number;
  /** Total duration (for visual fade calculations) */
  totalDuration: number;
}

// ─── Visual Colors ────────────────────────────────────────────────

const PASTE_COLORS = {
  clipboardBg: "#1f2937",
  targetDash: "rgba(255, 255, 255, 0.5)",
  timerBarBg: "rgba(55, 65, 81, 0.6)",
  particleColors: ["#fbbf24", "#f59e0b", "#d97706"],
};

// ─── PasteOver Class ──────────────────────────────────────────────

/**
 * Paste-Over — surface property transfer ability.
 *
 * Auto-copies surface type from any non-normal surface the player walks on.
 * Pressing the ability key pastes the clipboard surface onto the current
 * ground platform (or wall the player is sliding against) temporarily.
 */
export class PasteOver {
  params: PasteOverParams;

  /** The currently "copied" surface type (auto-captured from last non-normal surface) */
  clipboard: SurfaceType | null = null;

  /** Currently active paste-overs */
  activePastes: ActivePasteOver[] = [];

  /** Cooldown timer (seconds remaining) */
  cooldownTimer = 0;

  /** The platform the player could paste onto right now (for targeting highlight) */
  targetPlatform: Platform | null = null;

  /** Optional particle system for visual effects */
  particleSystem: ParticleSystem | null = null;

  /** Internal timer for pulsing animation */
  private pulseTimer = 0;

  /** Whether the clipboard just changed (for flash animation) */
  clipboardFlashTimer = 0;

  constructor(params?: Partial<PasteOverParams>) {
    this.params = { ...DEFAULT_PASTE_OVER_PARAMS, ...params };
  }

  /** Whether the ability can be activated right now */
  get canActivate(): boolean {
    return (
      this.params.enabled &&
      this.clipboard !== null &&
      this.targetPlatform !== null &&
      this.cooldownTimer <= 0 &&
      this.activePastes.length < this.params.maxActivePastes
    );
  }

  /**
   * Auto-copy: capture the surface type the player is currently on.
   * Called every frame. Only copies non-normal surfaces.
   */
  autoCapture(groundSurfaceType: SurfaceType | undefined): void {
    if (!this.params.enabled) return;
    if (groundSurfaceType && groundSurfaceType !== "normal") {
      if (this.clipboard !== groundSurfaceType) {
        this.clipboard = groundSurfaceType;
        this.clipboardFlashTimer = 0.3;
        this.emitCopyParticles(groundSurfaceType);
      }
    }
  }

  /**
   * Scan for the platform the player could paste onto.
   * Uses a foot probe (ground) or wall probe (wall-sliding) to find the target.
   * Call every frame.
   */
  scanForTarget(
    playerPosition: Vec2,
    playerSize: Vec2,
    tileMap: TileMap,
    wallSide: -1 | 0 | 1 = 0,
  ): void {
    if (!this.params.enabled || this.clipboard === null) {
      this.targetPlatform = null;
      return;
    }

    // Check ground platform first
    const groundPlatform = tileMap.getGroundPlatform({ position: playerPosition, size: playerSize });
    if (groundPlatform) {
      this.targetPlatform = groundPlatform;
      return;
    }

    // If wall-sliding, check wall platform
    if (wallSide !== 0) {
      const wallPlatform = tileMap.getWallPlatform(
        { position: playerPosition, size: playerSize },
        wallSide,
      );
      if (wallPlatform) {
        this.targetPlatform = wallPlatform;
        return;
      }
    }

    this.targetPlatform = null;
  }

  /**
   * Activate paste-over on the target platform.
   * Returns true if activation succeeded.
   */
  activate(): boolean {
    if (!this.canActivate || !this.targetPlatform || !this.clipboard) return false;

    const platform = this.targetPlatform;

    // Check if this platform already has an active paste — remove the old one
    const existingIdx = this.activePastes.findIndex((p) => p.platform === platform);
    if (existingIdx !== -1) {
      const existing = this.activePastes[existingIdx];
      // Restore original surface before re-pasting
      platform.surfaceType = existing.originalSurface;
      platform.isPastedOver = false;
      this.activePastes.splice(existingIdx, 1);
    }

    // Save original and apply new surface
    const originalSurface = platform.originalSurfaceType ?? platform.surfaceType;
    platform.originalSurfaceType = originalSurface;
    platform.surfaceType = this.clipboard;
    platform.isPastedOver = true;

    this.activePastes.push({
      platform,
      pastedSurface: this.clipboard,
      originalSurface,
      remainingTime: this.params.pasteDuration,
      totalDuration: this.params.pasteDuration,
    });

    // Emit paste particles
    this.emitPasteParticles(platform, this.clipboard);

    return true;
  }

  /**
   * Update timers (active paste durations, cooldown).
   * Restores original surface types on expiry.
   * Call every physics frame.
   */
  update(dt: number): void {
    this.pulseTimer += dt;

    // Clipboard flash timer
    if (this.clipboardFlashTimer > 0) {
      this.clipboardFlashTimer = Math.max(0, this.clipboardFlashTimer - dt);
    }

    // Update cooldown
    if (this.cooldownTimer > 0) {
      this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);
    }

    // Update active pastes (iterate backwards for safe removal)
    for (let i = this.activePastes.length - 1; i >= 0; i--) {
      const paste = this.activePastes[i];
      paste.remainingTime -= dt;

      if (paste.remainingTime <= 0) {
        // Restore original surface
        paste.platform.surfaceType = paste.originalSurface;
        paste.platform.isPastedOver = false;
        paste.platform.originalSurfaceType = undefined;

        // Emit expiration particles
        this.emitExpirationParticles(paste.platform, paste.pastedSurface);

        this.activePastes.splice(i, 1);
        this.cooldownTimer = this.params.pasteCooldown;
      }
    }
  }

  /**
   * Render paste-over visuals in world space.
   * Call during the render pass (in camera space).
   */
  render(ctx: CanvasRenderingContext2D, _camera?: Camera): void {
    if (!this.params.enabled) return;

    // Render targeting visuals
    if (this.targetPlatform && this.clipboard && this.canActivate) {
      this.renderTargetHighlight(ctx, this.targetPlatform);
    }

    // Render active paste-over timer bars and effects
    for (const paste of this.activePastes) {
      this.renderActivePaste(ctx, paste);
    }
  }

  /**
   * Render screen-space HUD (clipboard indicator).
   * Call after camera reset (in screen space).
   */
  renderUI(ctx: CanvasRenderingContext2D): void {
    if (!this.params.enabled) return;

    // Clipboard indicator (top-left)
    const x = 8;
    const y = 36;
    const boxWidth = 140;
    const boxHeight = 28;

    ctx.save();

    // Background
    ctx.fillStyle = PASTE_COLORS.clipboardBg;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(x, y, boxWidth, boxHeight);
    ctx.globalAlpha = 1;

    // Border
    if (this.clipboard) {
      const surfaceColor = getSurfaceProps(this.clipboard).color;
      ctx.strokeStyle = surfaceColor;
      ctx.lineWidth = this.clipboardFlashTimer > 0 ? 2 : 1;
      ctx.strokeRect(x, y, boxWidth, boxHeight);

      // Color swatch
      ctx.fillStyle = surfaceColor;
      ctx.fillRect(x + 4, y + 4, 20, 20);

      // Label
      ctx.fillStyle = "#e5e7eb";
      ctx.font = "11px monospace";
      ctx.fillText(`Clipboard: ${getSurfaceProps(this.clipboard).label}`, x + 28, y + 17);
    } else {
      ctx.strokeStyle = "#4b5563";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, boxWidth, boxHeight);

      // Empty label
      ctx.fillStyle = "#6b7280";
      ctx.font = "11px monospace";
      ctx.fillText("Clipboard: Empty", x + 8, y + 17);
    }

    ctx.restore();
  }

  /** Clear all active pastes and restore original surfaces */
  clearAllPastes(): void {
    for (const paste of this.activePastes) {
      paste.platform.surfaceType = paste.originalSurface;
      paste.platform.isPastedOver = false;
      paste.platform.originalSurfaceType = undefined;
    }
    this.activePastes = [];
    this.cooldownTimer = 0;
  }

  // ─── Private Methods ────────────────────────────────────────────

  private renderTargetHighlight(ctx: CanvasRenderingContext2D, platform: Platform): void {
    const pulse = Math.sin(this.pulseTimer * 4) * 0.15 + 0.85;
    const surfaceColor = this.clipboard ? getSurfaceProps(this.clipboard).color : "#ffffff";

    ctx.save();

    // Dashed outline in clipboard surface color
    ctx.strokeStyle = surfaceColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.globalAlpha = 0.4 * pulse;
    ctx.strokeRect(platform.x, platform.y, platform.width, platform.height);

    // Small downward arrow (paste icon) above platform center
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.6 * pulse;
    ctx.fillStyle = surfaceColor;
    const cx = platform.x + platform.width / 2;
    const arrowY = platform.y - 12;
    ctx.beginPath();
    ctx.moveTo(cx - 4, arrowY - 6);
    ctx.lineTo(cx + 4, arrowY - 6);
    ctx.lineTo(cx, arrowY);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private renderActivePaste(ctx: CanvasRenderingContext2D, paste: ActivePasteOver): void {
    const platform = paste.platform;
    const timeRatio = paste.remainingTime / paste.totalDuration;
    const surfaceProps = SURFACE_PROPERTIES[paste.pastedSurface];
    const isExpiring = paste.remainingTime <= 1.0;

    ctx.save();

    // Animated border to distinguish pasted surfaces from natural ones
    ctx.strokeStyle = surfaceProps.color;
    ctx.lineWidth = isExpiring ? 1 : 2;
    ctx.setLineDash([4, 4]);
    const dashOffset = this.pulseTimer * 20;
    ctx.lineDashOffset = dashOffset;
    ctx.globalAlpha = isExpiring ? 0.3 + (1 - paste.remainingTime) * 0.3 : 0.6;
    ctx.strokeRect(platform.x - 1, platform.y - 1, platform.width + 2, platform.height + 2);

    // Surface-specific visual effects on top
    ctx.setLineDash([]);
    ctx.globalAlpha = isExpiring ? 0.15 : 0.25;
    this.renderSurfaceEffect(ctx, platform, paste.pastedSurface);

    // Timer bar below the platform
    const barHeight = 3;
    const barY = platform.y + platform.height + 3;
    const barWidth = platform.width;

    // Background
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = PASTE_COLORS.timerBarBg;
    ctx.fillRect(platform.x, barY, barWidth, barHeight);

    // Fill (surface color → darker as time runs out)
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = surfaceProps.color;
    ctx.fillRect(platform.x, barY, barWidth * timeRatio, barHeight);

    ctx.restore();
  }

  private renderSurfaceEffect(
    ctx: CanvasRenderingContext2D,
    platform: Platform,
    surfaceType: SurfaceType,
  ): void {
    const surfaceProps = SURFACE_PROPERTIES[surfaceType];
    ctx.fillStyle = surfaceProps.color;
    ctx.strokeStyle = surfaceProps.color;

    switch (surfaceType) {
      case "bouncy": {
        // Small upward chevrons along the top surface
        ctx.lineWidth = 1.5;
        const spacing = 12;
        for (let x = platform.x + spacing / 2; x < platform.x + platform.width; x += spacing) {
          ctx.beginPath();
          ctx.moveTo(x - 3, platform.y + 4);
          ctx.lineTo(x, platform.y + 1);
          ctx.lineTo(x + 3, platform.y + 4);
          ctx.stroke();
        }
        break;
      }
      case "icy": {
        // Diagonal hatch lines (ice crystal pattern)
        ctx.lineWidth = 1;
        const hatchSpacing = 8;
        for (let i = -platform.height; i < platform.width + platform.height; i += hatchSpacing) {
          ctx.beginPath();
          ctx.moveTo(platform.x + i, platform.y);
          ctx.lineTo(platform.x + i - platform.height, platform.y + platform.height);
          ctx.stroke();
        }
        break;
      }
      case "sticky": {
        // Dots/stipple pattern
        const dotSpacing = 8;
        for (let x = platform.x + dotSpacing / 2; x < platform.x + platform.width; x += dotSpacing) {
          for (let y = platform.y + dotSpacing / 2; y < platform.y + platform.height; y += dotSpacing) {
            ctx.beginPath();
            ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
      }
      case "conveyor": {
        // Animated arrows pointing in conveyor direction
        ctx.lineWidth = 1.5;
        const direction = 1; // Right by default
        const arrowSpacing = 16;
        const offset = (this.pulseTimer * 40) % arrowSpacing;
        for (let x = platform.x - arrowSpacing + offset; x < platform.x + platform.width; x += arrowSpacing) {
          if (x < platform.x || x > platform.x + platform.width - 4) continue;
          const midY = platform.y + platform.height / 2;
          ctx.beginPath();
          ctx.moveTo(x, midY - 3);
          ctx.lineTo(x + 4 * direction, midY);
          ctx.lineTo(x, midY + 3);
          ctx.stroke();
        }
        break;
      }
      default:
        break;
    }
  }

  private emitCopyParticles(surfaceType: SurfaceType): void {
    // Copy particles are emitted by the test page (needs player position)
    // This is a no-op here — the test page handles it
    void surfaceType;
  }

  private emitPasteParticles(platform: Platform, surfaceType: SurfaceType): void {
    if (!this.particleSystem) return;

    const surfaceColor = getSurfaceProps(surfaceType).color;
    const cx = platform.x + platform.width / 2;
    const cy = platform.y + platform.height / 2;

    this.particleSystem.emit({
      x: cx,
      y: cy,
      count: 8,
      speedMin: 20,
      speedMax: 80,
      angleMin: 0,
      angleMax: Math.PI * 2,
      lifeMin: 0.2,
      lifeMax: 0.5,
      sizeMin: 2,
      sizeMax: 4,
      colors: [surfaceColor, ...PASTE_COLORS.particleColors],
      gravity: 50,
    });
  }

  private emitExpirationParticles(platform: Platform, surfaceType: SurfaceType): void {
    if (!this.particleSystem) return;

    const surfaceColor = getSurfaceProps(surfaceType).color;
    const cx = platform.x + platform.width / 2;
    const cy = platform.y + platform.height / 2;

    this.particleSystem.emit({
      x: cx,
      y: cy,
      count: 6,
      speedMin: 10,
      speedMax: 50,
      angleMin: -Math.PI,
      angleMax: 0,
      lifeMin: 0.2,
      lifeMax: 0.4,
      sizeMin: 1.5,
      sizeMax: 3,
      colors: [surfaceColor, "#6b7280"],
      gravity: 80,
    });
  }
}
