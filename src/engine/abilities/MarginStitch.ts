import type { Vec2, Rect } from "@/lib/types";
import type { Platform } from "@/engine/physics/TileMap";
import { TileMap } from "@/engine/physics/TileMap";
import type { Renderer } from "@/engine/core/Renderer";
import type { Camera } from "@/engine/core/Camera";
import type { ParticleSystem } from "@/engine/core/ParticleSystem";
import { aabbOverlap } from "@/engine/physics/AABB";

// ─── Data Structures ───────────────────────────────────────────────

export interface StitchTarget {
  /** The wall platform being stitched */
  platform: Platform;
  /** Which side of the platform the stitch opens on (entry side) */
  side: "left" | "right" | "top" | "bottom";
  /** World position of the stitch point on the wall surface */
  surfaceX: number;
  /** Y-range of the wall surface */
  surfaceTop: number;
  surfaceBottom: number;
}

export interface WallPair {
  /** First wall of the pair (right edge of left platform) */
  wallA: StitchTarget;
  /** Second wall of the pair (left edge of right platform) */
  wallB: StitchTarget;
  /** Distance between the two wall surfaces */
  gap: number;
  /** The passage rect that would open between them (computed on activation) */
  passageRect: Rect;
  /** Distance from player center to the midpoint of the passage */
  distanceToPlayer: number;
}

export interface ActiveStitch {
  /** The wall pair being stitched */
  pair: WallPair;
  /** Remaining duration in seconds */
  remainingTime: number;
  /** Total duration for calculating visual fade */
  totalDuration: number;
  /** Whether the stitch is currently open (passage traversable) */
  isOpen: boolean;
  /** The actual passage rect used for exclusion (centered on player Y at activation) */
  passageRect: Rect;
  /** Reference to excluded platforms for cleanup */
  excludedPlatforms: Platform[];
}

export interface MarginStitchParams {
  /** Maximum distance from player to detect stitch-eligible walls (px) */
  maxStitchRange: number;
  /** Duration the stitch passage stays open (seconds) */
  stitchDuration: number;
  /** Cooldown after a stitch closes before another can be placed (seconds) */
  stitchCooldown: number;
  /** Height of the passage opening (must fit the player) */
  passageHeight: number;
  /** Whether the ability is unlocked/available */
  enabled: boolean;
}

export const DEFAULT_MARGIN_STITCH_PARAMS: MarginStitchParams = {
  maxStitchRange: 160,
  stitchDuration: 4.0,
  stitchCooldown: 2.0,
  passageHeight: 48,
  enabled: true,
};

// ─── Stitch Visual Colors ──────────────────────────────────────────

const STITCH_COLORS = {
  targetHighlight: "rgba(245, 158, 11, 0.4)",    // amber 40%
  targetHighlightBright: "rgba(245, 158, 11, 0.7)", // amber 70%
  activeThread: "rgba(245, 158, 11, 0.8)",        // amber 80%
  timerBarStart: "#f59e0b",                        // amber
  timerBarEnd: "#ef4444",                          // red
  closingFlash: "#fef3c7",                         // light cream
  rangeCircle: "rgba(245, 158, 11, 0.15)",         // very faint amber
  passageHatch: "rgba(245, 158, 11, 0.12)",        // subtle amber
  particleColors: ["#fbbf24", "#f59e0b", "#d97706"],
};

// Minimum player width + clearance for passage
const MIN_PASSAGE_CLEARANCE = 4;

// ─── MarginStitch Class ────────────────────────────────────────────

/**
 * Margin Stitch — temporary passage creation between wall pairs.
 *
 * Scans the TileMap for eligible wall pairs (facing vertical walls),
 * auto-targets the nearest pair, and creates a traversable passage
 * on activation by adding an exclusion zone to the TileMap.
 *
 * Wall pair detection is O(N²) where N = number of platforms.
 * Fine for test levels (~15 platforms); optimize with spatial hashing later.
 */
export class MarginStitch {
  params: MarginStitchParams;

  /** All detected wall pairs in range */
  detectedPairs: WallPair[] = [];

  /** The currently highlighted (nearest/best) pair — null if none in range */
  targetedPair: WallPair | null = null;

  /** The currently active stitch — null if no stitch is open */
  activeStitch: ActiveStitch | null = null;

  /** Cooldown timer (seconds remaining) */
  cooldownTimer = 0;

  /** Reference to the TileMap for exclusion zone management */
  private tileMap: TileMap | null = null;

  /** Optional particle system for visual effects */
  particleSystem: ParticleSystem | null = null;

  /** Internal timer for pulsing animation */
  private pulseTimer = 0;

  /** Flag to clear a closed stitch on the next update (allows one frame for ejection check) */
  private pendingStitchClear = false;

  /** Player width used for gap validation */
  private playerWidth = 24;

  constructor(params?: Partial<MarginStitchParams>) {
    this.params = { ...DEFAULT_MARGIN_STITCH_PARAMS, ...params };
  }

  /** Whether the ability can be activated right now */
  get canActivate(): boolean {
    return (
      this.params.enabled &&
      this.targetedPair !== null &&
      this.cooldownTimer <= 0
    );
  }

  /** Set the TileMap reference for exclusion zone management */
  setTileMap(tileMap: TileMap): void {
    this.tileMap = tileMap;
  }

  /** Set the player width for gap validation */
  setPlayerWidth(width: number): void {
    this.playerWidth = width;
  }

  /**
   * Scan the TileMap for eligible wall pairs near the player.
   * Call this every frame. Updates detectedPairs and targetedPair.
   */
  scanForPairs(playerCenter: Vec2, tileMap: TileMap): void {
    if (!this.params.enabled) {
      this.detectedPairs = [];
      this.targetedPair = null;
      return;
    }

    const range = this.params.maxStitchRange;
    const minGap = this.playerWidth + MIN_PASSAGE_CLEARANCE;

    // Step 1: Find nearby wall surfaces (vertical walls only)
    const rightEdges: StitchTarget[] = [];
    const leftEdges: StitchTarget[] = [];

    for (const platform of tileMap.platforms) {
      // Right edge of platform (facing right — could be entry for stitch)
      const rightX = platform.x + platform.width;
      const distRight = Math.abs(rightX - playerCenter.x);
      if (distRight <= range) {
        rightEdges.push({
          platform,
          side: "right",
          surfaceX: rightX,
          surfaceTop: platform.y,
          surfaceBottom: platform.y + platform.height,
        });
      }

      // Left edge of platform (facing left — could be entry for stitch)
      const distLeft = Math.abs(platform.x - playerCenter.x);
      if (distLeft <= range) {
        leftEdges.push({
          platform,
          side: "left",
          surfaceX: platform.x,
          surfaceTop: platform.y,
          surfaceBottom: platform.y + platform.height,
        });
      }
    }

    // Step 2: Match wall pairs (right edge A + left edge B, A.x < B.x)
    const pairs: WallPair[] = [];

    for (const wallA of rightEdges) {
      for (const wallB of leftEdges) {
        // Skip if same platform
        if (wallA.platform === wallB.platform) continue;

        // A must be to the left of B
        if (wallA.surfaceX >= wallB.surfaceX) continue;

        const gap = wallB.surfaceX - wallA.surfaceX;

        // Gap must be wide enough for player + clearance, and within range
        if (gap < minGap || gap > range) continue;

        // Check Y-range overlap
        const overlapTop = Math.max(wallA.surfaceTop, wallB.surfaceTop);
        const overlapBottom = Math.min(wallA.surfaceBottom, wallB.surfaceBottom);
        const overlapHeight = overlapBottom - overlapTop;

        // Overlap must be at least passageHeight
        if (overlapHeight < this.params.passageHeight) continue;

        // Compute passage rect (centered vertically in the overlap, but will
        // be repositioned to player Y on activation). For targeting display,
        // use the overlap midpoint.
        const passageCenterY = (overlapTop + overlapBottom) / 2;
        const passageRect: Rect = {
          x: wallA.surfaceX,
          y: passageCenterY - this.params.passageHeight / 2,
          width: gap,
          height: this.params.passageHeight,
        };

        // Distance from player to passage midpoint
        const passageMidX = wallA.surfaceX + gap / 2;
        const passageMidY = passageCenterY;
        const dx = passageMidX - playerCenter.x;
        const dy = passageMidY - playerCenter.y;
        const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);

        pairs.push({
          wallA,
          wallB,
          gap,
          passageRect,
          distanceToPlayer,
        });
      }
    }

    // Step 3: Sort by distance, pick nearest
    pairs.sort((a, b) => a.distanceToPlayer - b.distanceToPlayer);

    this.detectedPairs = pairs;
    this.targetedPair = pairs.length > 0 ? pairs[0] : null;
  }

  /**
   * Activate a stitch on the targeted wall pair.
   * Returns true if activation succeeded.
   * playerCenterY is used to position the passage vertically.
   */
  activate(playerCenterY: number): boolean {
    if (!this.canActivate || !this.targetedPair || !this.tileMap) return false;

    const pair = this.targetedPair;

    // If there's an existing stitch, close it first (replace, no cooldown)
    if (this.activeStitch) {
      this.closeStitch(false);
    }

    // Position the passage centered on player's Y, clamped to the wall overlap
    const overlapTop = Math.max(pair.wallA.surfaceTop, pair.wallB.surfaceTop);
    const overlapBottom = Math.min(pair.wallA.surfaceBottom, pair.wallB.surfaceBottom);

    let passageY = playerCenterY - this.params.passageHeight / 2;
    // Clamp to overlap region
    passageY = Math.max(overlapTop, passageY);
    passageY = Math.min(overlapBottom - this.params.passageHeight, passageY);

    const passageRect: Rect = {
      x: pair.wallA.surfaceX,
      y: passageY,
      width: pair.gap,
      height: this.params.passageHeight,
    };

    // Add exclusion zone to TileMap
    const excludedPlatforms = [pair.wallA.platform, pair.wallB.platform];
    this.tileMap.addExclusionZone(passageRect, excludedPlatforms);

    this.activeStitch = {
      pair,
      remainingTime: this.params.stitchDuration,
      totalDuration: this.params.stitchDuration,
      isOpen: true,
      passageRect,
      excludedPlatforms,
    };

    // Emit opening particles
    this.emitOpeningParticles(passageRect);

    return true;
  }

  /**
   * Update timers (active stitch duration, cooldown).
   * Call every physics frame.
   */
  update(dt: number): void {
    this.pulseTimer += dt;

    // Clear closed stitch from previous frame (allows one frame for ejection check)
    if (this.pendingStitchClear) {
      if (this.activeStitch && !this.activeStitch.isOpen) {
        this.activeStitch = null;
      }
      this.pendingStitchClear = false;
    }

    // Update cooldown
    if (this.cooldownTimer > 0) {
      this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);
    }

    // Update active stitch
    if (this.activeStitch) {
      this.activeStitch.remainingTime -= dt;

      // Emit drift particles along thread lines (subtle, ~1-2 per second)
      if (this.activeStitch.isOpen && Math.random() < dt * 1.5) {
        this.emitDriftParticle(this.activeStitch.passageRect);
      }

      if (this.activeStitch.remainingTime <= 0) {
        this.closeStitch(true);
      }
    }
  }

  /**
   * Render stitch visuals: targeting highlights, active passage, timer.
   * Call during the render pass (in world/camera space).
   */
  render(ctx: CanvasRenderingContext2D, _camera?: Camera): void {
    if (!this.params.enabled) return;

    // Render detected pairs as targeting highlights
    for (const pair of this.detectedPairs) {
      const isTargeted = pair === this.targetedPair;
      this.renderTargetingVisuals(ctx, pair, isTargeted);
    }

    // Render active stitch
    if (this.activeStitch?.isOpen) {
      this.renderActiveStitch(ctx, this.activeStitch);
    }
  }

  /**
   * Render screen-space UI (range circle, cooldown, state readout).
   * Call after camera reset (in screen space).
   */
  renderUI(ctx: CanvasRenderingContext2D, playerScreenPos: Vec2, camera: Camera): void {
    if (!this.params.enabled) return;

    // Range circle around player (in world space, need to convert)
    // This is rendered in screen space, so we draw it at player screen position
    const range = this.params.maxStitchRange;
    ctx.save();
    ctx.strokeStyle = STITCH_COLORS.rangeCircle;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(playerScreenPos.x, playerScreenPos.y, range * camera.zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  /**
   * Eject the player if they're inside the passage when it closes.
   * Returns the corrected position, or null if no correction needed.
   */
  getEjectionPosition(playerPos: Vec2, playerSize: Vec2): Vec2 | null {
    if (!this.activeStitch || this.activeStitch.isOpen) return null;

    // This is called from the test page after closeStitch()
    // The passage just closed — check if the player is inside any excluded platform
    const rect = this.activeStitch.passageRect;
    const playerBounds: Rect = {
      x: playerPos.x,
      y: playerPos.y,
      width: playerSize.x,
      height: playerSize.y,
    };

    if (!aabbOverlap(playerBounds, rect)) return null;

    // Player is in the passage region — push them to the nearest open side
    const playerCenterX = playerPos.x + playerSize.x / 2;
    const passageCenterX = rect.x + rect.width / 2;

    const corrected = { x: playerPos.x, y: playerPos.y };
    if (playerCenterX < passageCenterX) {
      // Push left (out to wallA side)
      corrected.x = rect.x - playerSize.x;
    } else {
      // Push right (out to wallB side)
      corrected.x = rect.x + rect.width;
    }

    return corrected;
  }

  // ─── Private Methods ─────────────────────────────────────────────

  private closeStitch(startCooldown: boolean): void {
    if (!this.activeStitch || !this.tileMap) return;

    // Remove the exclusion zone
    this.tileMap.removeExclusionZone(this.activeStitch.passageRect);

    // Emit closing particles
    this.emitClosingParticles(this.activeStitch.passageRect);

    this.activeStitch.isOpen = false;

    if (startCooldown) {
      this.cooldownTimer = this.params.stitchCooldown;
    }

    // Mark for clearing on the next update tick (allows one frame for ejection check)
    this.pendingStitchClear = true;
  }

  private renderTargetingVisuals(ctx: CanvasRenderingContext2D, pair: WallPair, isTargeted: boolean): void {
    const pulse = Math.sin(this.pulseTimer * 4) * 0.15 + 0.85;
    const baseAlpha = isTargeted ? 0.7 * pulse : 0.4;

    ctx.save();

    // Draw dashed lines along eligible wall surfaces
    ctx.strokeStyle = isTargeted ? STITCH_COLORS.targetHighlightBright : STITCH_COLORS.targetHighlight;
    ctx.lineWidth = isTargeted ? 2 : 1;
    ctx.setLineDash([4, 3]);

    // Wall A right edge
    const overlapTop = Math.max(pair.wallA.surfaceTop, pair.wallB.surfaceTop);
    const overlapBottom = Math.min(pair.wallA.surfaceBottom, pair.wallB.surfaceBottom);

    ctx.beginPath();
    ctx.moveTo(pair.wallA.surfaceX, overlapTop);
    ctx.lineTo(pair.wallA.surfaceX, overlapBottom);
    ctx.stroke();

    // Wall B left edge
    ctx.beginPath();
    ctx.moveTo(pair.wallB.surfaceX, overlapTop);
    ctx.lineTo(pair.wallB.surfaceX, overlapBottom);
    ctx.stroke();

    // Dotted line connecting the two stitch points (passage midline)
    ctx.setLineDash([2, 6]);
    ctx.globalAlpha = baseAlpha * 0.5;
    const midY = (overlapTop + overlapBottom) / 2;
    ctx.beginPath();
    ctx.moveTo(pair.wallA.surfaceX, midY);
    ctx.lineTo(pair.wallB.surfaceX, midY);
    ctx.stroke();

    // X marks at stitch points
    ctx.setLineDash([]);
    ctx.globalAlpha = baseAlpha;
    const markSize = 4;
    for (const x of [pair.wallA.surfaceX, pair.wallB.surfaceX]) {
      ctx.beginPath();
      ctx.moveTo(x - markSize, midY - markSize);
      ctx.lineTo(x + markSize, midY + markSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + markSize, midY - markSize);
      ctx.lineTo(x - markSize, midY + markSize);
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderActiveStitch(ctx: CanvasRenderingContext2D, stitch: ActiveStitch): void {
    const rect = stitch.passageRect;
    const timeRatio = stitch.remainingTime / stitch.totalDuration;
    const isExpiring = stitch.remainingTime <= 1.0;

    ctx.save();

    // Passage background (subtle cross-hatch)
    ctx.fillStyle = STITCH_COLORS.passageHatch;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

    // Cross-hatch pattern
    ctx.strokeStyle = STITCH_COLORS.activeThread;
    ctx.lineWidth = 1;
    const hatchSpacing = 8;
    ctx.globalAlpha = isExpiring ? 0.3 + Math.random() * 0.3 : 0.3;
    for (let i = -rect.height; i < rect.width + rect.height; i += hatchSpacing) {
      ctx.beginPath();
      ctx.moveTo(rect.x + i, rect.y);
      ctx.lineTo(rect.x + i - rect.height, rect.y + rect.height);
      ctx.stroke();
    }

    // Thread lines connecting the two wall edges (3-5 diagonal lines)
    ctx.globalAlpha = isExpiring ? 0.5 + Math.random() * 0.3 : 0.8;
    ctx.lineWidth = 2;
    const threadCount = 4;
    for (let i = 0; i < threadCount; i++) {
      const t = (i + 0.5) / threadCount;
      const y1 = rect.y + rect.height * t;
      const y2 = rect.y + rect.height * (1 - t);

      // Flicker when expiring
      if (isExpiring && Math.random() < 0.2) continue;

      ctx.beginPath();
      ctx.moveTo(rect.x, y1);
      ctx.lineTo(rect.x + rect.width, y2);
      ctx.stroke();
    }

    // Needle hole dots at wall surfaces
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = STITCH_COLORS.activeThread;
    const dotSize = 3;
    for (let i = 0; i < threadCount; i++) {
      const t = (i + 0.5) / threadCount;
      const y = rect.y + rect.height * t;
      ctx.beginPath();
      ctx.arc(rect.x, y, dotSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(rect.x + rect.width, rect.y + rect.height * (1 - t), dotSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Timer bar above the passage
    const barHeight = 3;
    const barY = rect.y - barHeight - 4;
    const barWidth = rect.width;

    // Background
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#374151";
    ctx.fillRect(rect.x, barY, barWidth, barHeight);

    // Fill (amber → red as time runs out)
    ctx.globalAlpha = 0.9;
    const r = Math.round(245 + (239 - 245) * (1 - timeRatio));
    const g = Math.round(158 + (68 - 158) * (1 - timeRatio));
    const b = Math.round(11 + (68 - 11) * (1 - timeRatio));
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(rect.x, barY, barWidth * timeRatio, barHeight);

    // Passage border
    ctx.globalAlpha = isExpiring ? 0.4 + Math.random() * 0.2 : 0.6;
    ctx.strokeStyle = STITCH_COLORS.activeThread;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

    ctx.restore();
  }

  private emitOpeningParticles(rect: Rect): void {
    if (!this.particleSystem) return;

    // Burst from both wall surfaces
    const midY = rect.y + rect.height / 2;
    for (const x of [rect.x, rect.x + rect.width]) {
      this.particleSystem.emit({
        x,
        y: midY,
        count: 6,
        speedMin: 20,
        speedMax: 80,
        angleMin: 0,
        angleMax: Math.PI * 2,
        lifeMin: 0.2,
        lifeMax: 0.5,
        sizeMin: 2,
        sizeMax: 4,
        colors: STITCH_COLORS.particleColors,
        gravity: 0,
      });
    }
  }

  private emitClosingParticles(rect: Rect): void {
    if (!this.particleSystem) return;

    // Snap burst along the thread lines
    const midX = rect.x + rect.width / 2;
    const midY = rect.y + rect.height / 2;
    this.particleSystem.emit({
      x: midX,
      y: midY,
      count: 10,
      speedMin: 40,
      speedMax: 120,
      angleMin: 0,
      angleMax: Math.PI * 2,
      lifeMin: 0.15,
      lifeMax: 0.4,
      sizeMin: 2,
      sizeMax: 5,
      colors: [STITCH_COLORS.closingFlash, ...STITCH_COLORS.particleColors],
      gravity: 100,
    });
  }

  private emitDriftParticle(rect: Rect): void {
    if (!this.particleSystem) return;

    // Single particle drifting along a thread line
    const t = Math.random();
    const x = rect.x + rect.width * t;
    const y = rect.y + rect.height * Math.random();
    this.particleSystem.emit({
      x,
      y,
      count: 1,
      speedMin: 5,
      speedMax: 15,
      angleMin: -Math.PI / 4,
      angleMax: Math.PI / 4,
      lifeMin: 0.5,
      lifeMax: 1.0,
      sizeMin: 1,
      sizeMax: 3,
      colors: STITCH_COLORS.particleColors,
      gravity: 0,
    });
  }
}
