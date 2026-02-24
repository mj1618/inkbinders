// Shared types for the Inkbinders engine

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Engine types

export type RenderLayer = 'background' | 'world' | 'entities' | 'fx' | 'debug';

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  updateCount: number;
}
