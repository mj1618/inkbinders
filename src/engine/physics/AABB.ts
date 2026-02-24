import type { Rect, Vec2 } from "@/lib/types";

/** Check if two AABBs overlap */
export function aabbOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/** Check if a point is inside an AABB */
export function aabbContains(outer: Rect, point: Vec2): boolean {
  return (
    point.x >= outer.x &&
    point.x <= outer.x + outer.width &&
    point.y >= outer.y &&
    point.y <= outer.y + outer.height
  );
}

/** Return the overlap rectangle of two AABBs, or null if they don't overlap */
export function aabbIntersection(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);

  if (right <= x || bottom <= y) {
    return null;
  }

  return { x, y, width: right - x, height: bottom - y };
}

/**
 * Resolve collision between a moving AABB and a static AABB.
 * Pushes the moving AABB out along the axis of minimum penetration.
 * Returns the resolved position and the collision normal.
 */
export function resolveAABB(
  moving: Rect,
  velocity: Vec2,
  static_: Rect,
): { position: Vec2; normal: Vec2 } {
  const overlap = aabbIntersection(moving, static_);

  if (!overlap) {
    return {
      position: { x: moving.x, y: moving.y },
      normal: { x: 0, y: 0 },
    };
  }

  // Determine push-out axis based on minimum penetration
  const position = { x: moving.x, y: moving.y };
  const normal: Vec2 = { x: 0, y: 0 };

  if (overlap.width < overlap.height) {
    // Push out horizontally
    // Use velocity when available; fall back to relative center positions for zero velocity
    const movingCenterX = moving.x + moving.width / 2;
    const staticCenterX = static_.x + static_.width / 2;
    if (velocity.x > 0 || (velocity.x === 0 && movingCenterX < staticCenterX)) {
      position.x = static_.x - moving.width;
      normal.x = -1;
    } else {
      position.x = static_.x + static_.width;
      normal.x = 1;
    }
  } else {
    // Push out vertically
    const movingCenterY = moving.y + moving.height / 2;
    const staticCenterY = static_.y + static_.height / 2;
    if (velocity.y > 0 || (velocity.y === 0 && movingCenterY < staticCenterY)) {
      position.y = static_.y - moving.height;
      normal.y = -1;
    } else {
      position.y = static_.y + static_.height;
      normal.y = 1;
    }
  }

  return { position, normal };
}
