import type { Vec2, Rect } from "@/lib/types";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/constants";

/**
 * Camera represents the viewport into the game world.
 * Position (0,0) means the world origin is at the center of the canvas.
 *
 * Supports smooth following with look-ahead and bounds clamping
 * for levels larger than the viewport.
 */
export class Camera {
  position: Vec2 = { x: 0, y: 0 };
  zoom: number = 1;

  private viewportWidth: number;
  private viewportHeight: number;

  /** Smooth follow speed — higher = snappier. Units: per-second lerp rate. */
  followSpeed = 8.0;

  /** Offset camera target in the player's movement direction (pixels) */
  lookaheadX = 80;
  lookaheadY = 40;

  /** World bounds for clamping. null = no clamping. */
  bounds: Rect | null = null;

  constructor(viewportWidth: number = CANVAS_WIDTH, viewportHeight: number = CANVAS_HEIGHT) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
  }

  /** Convert world coordinates to screen pixels */
  worldToScreen(worldPos: Vec2): Vec2 {
    return {
      x: (worldPos.x - this.position.x) * this.zoom + this.viewportWidth / 2,
      y: (worldPos.y - this.position.y) * this.zoom + this.viewportHeight / 2,
    };
  }

  /** Convert screen pixels to world coordinates */
  screenToWorld(screenPos: Vec2): Vec2 {
    return {
      x: (screenPos.x - this.viewportWidth / 2) / this.zoom + this.position.x,
      y: (screenPos.y - this.viewportHeight / 2) / this.zoom + this.position.y,
    };
  }

  /** Get the visible world-space rectangle */
  getViewportBounds(): Rect {
    const halfW = (this.viewportWidth / 2) / this.zoom;
    const halfH = (this.viewportHeight / 2) / this.zoom;
    return {
      x: this.position.x - halfW,
      y: this.position.y - halfH,
      width: this.viewportWidth / this.zoom,
      height: this.viewportHeight / this.zoom,
    };
  }

  /**
   * Smoothly follow a target position with look-ahead based on velocity.
   * Call once per fixed update tick.
   */
  follow(targetPos: Vec2, velocity: Vec2, dt: number): void {
    // Apply look-ahead offset based on velocity direction
    const maxSpeed = 300; // normalizing reference for look-ahead
    const lx = (velocity.x / maxSpeed) * this.lookaheadX;
    const ly = (velocity.y / maxSpeed) * this.lookaheadY;

    const goalX = targetPos.x + lx;
    const goalY = targetPos.y + ly;

    // Exponential smoothing (framerate-independent lerp)
    const t = 1 - Math.exp(-this.followSpeed * dt);
    this.position.x += (goalX - this.position.x) * t;
    this.position.y += (goalY - this.position.y) * t;

    // Clamp to world bounds
    this.clampToBounds();
  }

  /** Snap camera directly to a position (no smoothing). Respects bounds. */
  snapTo(pos: Vec2): void {
    this.position.x = pos.x;
    this.position.y = pos.y;
    this.clampToBounds();
  }

  /** Clamp camera so the viewport doesn't show beyond world bounds */
  private clampToBounds(): void {
    if (!this.bounds) return;

    const halfW = (this.viewportWidth / 2) / this.zoom;
    const halfH = (this.viewportHeight / 2) / this.zoom;

    const minX = this.bounds.x + halfW;
    const maxX = this.bounds.x + this.bounds.width - halfW;
    const minY = this.bounds.y + halfH;
    const maxY = this.bounds.y + this.bounds.height - halfH;

    if (minX < maxX) {
      this.position.x = Math.max(minX, Math.min(maxX, this.position.x));
    } else {
      // Level narrower than viewport — center it
      this.position.x = this.bounds.x + this.bounds.width / 2;
    }

    if (minY < maxY) {
      this.position.y = Math.max(minY, Math.min(maxY, this.position.y));
    } else {
      this.position.y = this.bounds.y + this.bounds.height / 2;
    }
  }
}
