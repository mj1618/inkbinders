// Physics — Collision detection, gravity, surfaces
export { aabbOverlap, aabbContains, aabbIntersection, resolveAABB } from "./AABB";
export { TileMap } from "./TileMap";
export type { Platform, CollisionResult } from "./TileMap";
export {
  checkObstacleOverlap,
  checkDamageOverlap,
  createSpikes,
  createBarrier,
  createLaser,
  createHazardZone,
  resetObstacleIdCounter,
} from "./Obstacles";
export type { Obstacle, ObstacleType } from "./Obstacles";
export { SURFACE_PROPERTIES, getSurfaceProps } from "./Surfaces";
export type { SurfaceType, SurfaceProperties } from "./Surfaces";
