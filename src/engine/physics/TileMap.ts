import type { Rect, Vec2 } from "@/lib/types";
import type { Renderer } from "@/engine/core/Renderer";
import { aabbOverlap, aabbIntersection } from "./AABB";
import { COLORS } from "@/lib/constants";
import { RenderConfig } from "@/engine/core/RenderConfig";
import type { SurfaceType } from "./Surfaces";
import { getSurfaceProps } from "./Surfaces";

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Surface type — affects player physics when touching this platform */
  surfaceType?: SurfaceType;
  /** Original surface type before any paste-over was applied */
  originalSurfaceType?: SurfaceType;
  /** Whether this platform currently has a pasted surface (temporary override) */
  isPastedOver?: boolean;
}

export interface CollisionResult {
  grounded: boolean;
  hitCeiling: boolean;
  hitWall: boolean;
  wallDirection: -1 | 0 | 1; // -1 = wall on left, 0 = no wall, 1 = wall on right
}

export interface ExclusionZone {
  rect: Rect;
  excludedPlatforms: Platform[];
}

export class TileMap {
  platforms: Platform[];

  /** Rectangles where specific platforms are excluded from collision (e.g., active stitches) */
  exclusionZones: ExclusionZone[] = [];

  constructor(platforms: Platform[]) {
    this.platforms = platforms;
  }

  /** Add an exclusion zone — platforms in excludedPlatforms will be skipped when entity overlaps rect */
  addExclusionZone(rect: Rect, platforms: Platform[]): void {
    this.exclusionZones.push({ rect, excludedPlatforms: platforms });
  }

  /** Remove an exclusion zone by its rect reference */
  removeExclusionZone(rect: Rect): void {
    const idx = this.exclusionZones.findIndex((z) => z.rect === rect);
    if (idx !== -1) this.exclusionZones.splice(idx, 1);
  }

  /** Check if a rect overlaps any platform */
  checkCollision(bounds: Rect): Platform | null {
    for (const p of this.platforms) {
      if (aabbOverlap(bounds, p)) {
        return p;
      }
    }
    return null;
  }

  /**
   * Resolve an entity's position against all platforms.
   * Uses minimum-penetration-depth per overlap to pick the correct
   * resolution axis, avoiding the teleport bug that Y-then-X ordering
   * caused when walking horizontally into tall walls.
   */
  resolveCollisions(entity: {
    position: Vec2;
    velocity: Vec2;
    size: Vec2;
  }): CollisionResult {
    const result: CollisionResult = {
      grounded: false,
      hitCeiling: false,
      hitWall: false,
      wallDirection: 0,
    };

    const MAX_PASSES = 3;

    for (let pass = 0; pass < MAX_PASSES; pass++) {
      let corrected = false;

      for (const platform of this.platforms) {
        const bounds: Rect = {
          x: entity.position.x,
          y: entity.position.y,
          width: entity.size.x,
          height: entity.size.y,
        };

        const overlap = aabbIntersection(bounds, platform);
        if (!overlap) continue;

        // Check if this platform is excluded by an active exclusion zone
        if (this.isPlatformExcluded(platform, bounds)) continue;

        // Resolve along the axis with the smaller overlap (minimum penetration).
        // When equal, prefer vertical so ground detection wins on exact corners.
        if (overlap.height <= overlap.width) {
          const entityCenterY = entity.position.y + entity.size.y / 2;
          const platformCenterY = platform.y + platform.height / 2;

          if (entityCenterY < platformCenterY) {
            entity.position.y = platform.y - entity.size.y;
            if (entity.velocity.y > 0) entity.velocity.y = 0;
            result.grounded = true;
          } else {
            entity.position.y = platform.y + platform.height;
            if (entity.velocity.y < 0) entity.velocity.y = 0;
            result.hitCeiling = true;
          }
        } else {
          const entityCenterX = entity.position.x + entity.size.x / 2;
          const platformCenterX = platform.x + platform.width / 2;

          if (entityCenterX < platformCenterX) {
            entity.position.x = platform.x - entity.size.x;
            if (entity.velocity.x > 0) entity.velocity.x = 0;
            result.hitWall = true;
            result.wallDirection = 1;
          } else {
            entity.position.x = platform.x + platform.width;
            if (entity.velocity.x < 0) entity.velocity.x = 0;
            result.hitWall = true;
            result.wallDirection = -1;
          }
        }

        corrected = true;
      }

      if (!corrected) break;
    }

    return result;
  }

  /** Check if there's enough room to stand up at a position */
  hasHeadroom(position: Vec2, entityWidth: number, standingHeight: number, crouchHeight: number): boolean {
    const heightDiff = standingHeight - crouchHeight;
    const standingBounds: Rect = {
      x: position.x,
      y: position.y - heightDiff,
      width: entityWidth,
      height: standingHeight,
    };
    return this.checkCollision(standingBounds) === null;
  }

  /** Check if the entity is touching a wall on a specific side (within 1px adjacency) */
  isTouchingWall(entity: { position: Vec2; size: Vec2 }, side: -1 | 1): boolean {
    // Create a thin probe rect (1px wide) on the specified side
    const probe: Rect = side === 1
      ? { x: entity.position.x + entity.size.x, y: entity.position.y + 1, width: 1, height: entity.size.y - 2 }
      : { x: entity.position.x - 1, y: entity.position.y + 1, width: 1, height: entity.size.y - 2 };

    for (const p of this.platforms) {
      if (aabbOverlap(probe, p)) {
        return true;
      }
    }
    return false;
  }

  /** Check if a platform is excluded from collision for a given entity bounds */
  private isPlatformExcluded(platform: Platform, entityBounds: Rect): boolean {
    for (const zone of this.exclusionZones) {
      if (
        zone.excludedPlatforms.includes(platform) &&
        aabbOverlap(entityBounds, zone.rect)
      ) {
        return true;
      }
    }
    return false;
  }

  /** Get the surface type of the platform the entity is grounded on */
  getGroundSurface(entity: { position: Vec2; size: Vec2 }): SurfaceType | undefined {
    const probe: Rect = {
      x: entity.position.x + 2,
      y: entity.position.y + entity.size.y,
      width: entity.size.x - 4,
      height: 2,
    };
    for (const p of this.platforms) {
      if (aabbOverlap(probe, p)) {
        return p.surfaceType;
      }
    }
    return undefined;
  }

  /** Get the surface type of the wall the entity is touching on a given side */
  getWallSurface(entity: { position: Vec2; size: Vec2 }, side: -1 | 1): SurfaceType | undefined {
    const probe: Rect =
      side === 1
        ? { x: entity.position.x + entity.size.x, y: entity.position.y + 1, width: 2, height: entity.size.y - 2 }
        : { x: entity.position.x - 2, y: entity.position.y + 1, width: 2, height: entity.size.y - 2 };
    for (const p of this.platforms) {
      if (aabbOverlap(probe, p)) {
        return p.surfaceType;
      }
    }
    return undefined;
  }

  /** Get the platform the entity is grounded on */
  getGroundPlatform(entity: { position: Vec2; size: Vec2 }): Platform | null {
    const probe: Rect = {
      x: entity.position.x + 2,
      y: entity.position.y + entity.size.y,
      width: entity.size.x - 4,
      height: 2,
    };
    for (const p of this.platforms) {
      if (aabbOverlap(probe, p)) {
        return p;
      }
    }
    return null;
  }

  /** Get the wall platform the entity is touching on a given side */
  getWallPlatform(entity: { position: Vec2; size: Vec2 }, side: -1 | 1): Platform | null {
    const probe: Rect =
      side === 1
        ? { x: entity.position.x + entity.size.x, y: entity.position.y + 1, width: 2, height: entity.size.y - 2 }
        : { x: entity.position.x - 2, y: entity.position.y + 1, width: 2, height: entity.size.y - 2 };
    for (const p of this.platforms) {
      if (aabbOverlap(probe, p)) {
        return p;
      }
    }
    return null;
  }

  /** Render all platforms */
  render(renderer: Renderer): void {
    // Always render rectangles for tiles (no tile sprites yet)
    // TODO: sprite tile rendering (Task 5)
    if (RenderConfig.useRectangles() || RenderConfig.getMode() === "sprites") {
      for (const p of this.platforms) {
        const surfaceProps = getSurfaceProps(p.surfaceType);
        const fillColor = surfaceColorToFill(surfaceProps.color);
        renderer.fillRect(p.x, p.y, p.width, p.height, fillColor);
        renderer.strokeRect(p.x, p.y, p.width, p.height, surfaceProps.color, 1);
      }
    }
  }
}

/** Convert a surface color hex to a darker fill color */
function surfaceColorToFill(hex: string): string {
  // Parse hex to RGB
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Darken by 70%
  const factor = 0.3;
  const dr = Math.round(r * factor);
  const dg = Math.round(g * factor);
  const db = Math.round(b * factor);
  return `rgb(${dr}, ${dg}, ${db})`;
}
