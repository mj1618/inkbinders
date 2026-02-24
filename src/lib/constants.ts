// Canvas dimensions
export const CANVAS_WIDTH = 960;
export const CANVAS_HEIGHT = 540;

// Physics
export const FIXED_TIMESTEP = 1 / 60; // 60 Hz physics update
export const MAX_ACCUMULATOR_TIME = 0.25; // Prevent spiral of death

// Physics defaults (will be overridden by test page sliders)
export const DEFAULT_GRAVITY = 980; // pixels/sec²
export const MAX_FALL_SPEED = 600; // pixels/sec

// Input
export const INPUT_BUFFER_SIZE = 10; // frames

// Debug
export const DEBUG_FONT = "12px monospace";
export const DEBUG_LINE_HEIGHT = 16;

// Colors
export const COLORS = {
  background: "#0a0a0a",
  debug: {
    hitbox: "#22d3ee",
    velocity: "#f59e0b",
    stateLabel: "#a78bfa",
    ground: "#4ade80",
  },
} as const;
