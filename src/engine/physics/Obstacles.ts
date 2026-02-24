import type { Rect } from "@/lib/types";
import { aabbOverlap } from "./AABB";

// ─── Obstacle Types ─────────────────────────────────────────────────

export type ObstacleType = "spikes" | "barrier" | "laser" | "hazard_zone";

export interface Obstacle {
  /** Unique ID for tracking redaction state */
  id: string;
  /** World-space bounding box */
  rect: Rect;
  /** Type of obstacle — affects visuals and behavior */
  type: ObstacleType;
  /** Whether this obstacle is currently active (not redacted) */
  active: boolean;
  /** Damage dealt on contact (0 = blocking only, no damage) */
  damage: number;
  /** Whether the player can collide with this obstacle (solid barriers) */
  solid: boolean;
  /** Visual color when active */
  color: string;
  /** Visual color when redacted (ghost of former self) */
  redactedColor: string;
}

// ─── Obstacle Helpers ───────────────────────────────────────────────

/** Check if an entity rect overlaps an active (non-solid) obstacle */
export function checkObstacleOverlap(
  entityBounds: Rect,
  obstacles: Obstacle[],
): Obstacle | null {
  for (const obs of obstacles) {
    if (!obs.active) continue;
    if (obs.solid) continue; // Solid obstacles use TileMap collision
    if (aabbOverlap(entityBounds, obs.rect)) {
      return obs;
    }
  }
  return null;
}

/** Check overlap against ALL active obstacles that deal damage (including solid ones) */
export function checkDamageOverlap(
  entityBounds: Rect,
  obstacles: Obstacle[],
): Obstacle | null {
  for (const obs of obstacles) {
    if (!obs.active) continue;
    if (obs.damage <= 0) continue;
    if (aabbOverlap(entityBounds, obs.rect)) {
      return obs;
    }
  }
  return null;
}

// ─── Factory Helpers ────────────────────────────────────────────────

let obstacleIdCounter = 0;

function nextId(): string {
  return `obs_${++obstacleIdCounter}`;
}

/** Reset the ID counter (for tests) */
export function resetObstacleIdCounter(): void {
  obstacleIdCounter = 0;
}

export function createSpikes(rect: Rect, damage: number = 20): Obstacle {
  return {
    id: nextId(),
    rect,
    type: "spikes",
    active: true,
    damage,
    solid: false,
    color: "#dc2626",
    redactedColor: "rgba(220, 38, 38, 0.2)",
  };
}

export function createBarrier(rect: Rect): Obstacle {
  return {
    id: nextId(),
    rect,
    type: "barrier",
    active: true,
    damage: 0,
    solid: true,
    color: "#7c3aed",
    redactedColor: "rgba(124, 58, 237, 0.2)",
  };
}

export function createLaser(rect: Rect, damage: number = 10): Obstacle {
  return {
    id: nextId(),
    rect,
    type: "laser",
    active: true,
    damage,
    solid: false,
    color: "#ef4444",
    redactedColor: "rgba(239, 68, 68, 0.2)",
  };
}

export function createHazardZone(rect: Rect, damage: number = 5): Obstacle {
  return {
    id: nextId(),
    rect,
    type: "hazard_zone",
    active: true,
    damage,
    solid: false,
    color: "#f97316",
    redactedColor: "rgba(249, 115, 22, 0.2)",
  };
}
