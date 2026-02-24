import { FIXED_TIMESTEP, MAX_ACCUMULATOR_TIME } from "@/lib/constants";
import type { PerformanceMetrics } from "@/lib/types";

export interface GameLoopCallbacks {
  update: (dt: number) => void;
  render: (interpolation: number) => void;
}

const FPS_SMOOTHING = 0.9;

/**
 * Fixed-timestep game loop with interpolated rendering.
 * Uses requestAnimationFrame for the render loop and an accumulator
 * pattern for fixed-step physics updates.
 */
export class GameLoop {
  private callbacks: GameLoopCallbacks;
  private accumulator = 0;
  private lastTime = 0;
  private running = false;
  private rafId: number | null = null;

  private metrics: PerformanceMetrics = {
    fps: 0,
    frameTime: 0,
    updateCount: 0,
  };

  constructor(callbacks: GameLoopCallbacks) {
    this.callbacks = callbacks;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame((t) => this.tick(t));
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  private tick(now: number): void {
    if (!this.running) return;

    const rawDelta = (now - this.lastTime) / 1000; // seconds
    this.lastTime = now;

    // Cap accumulated time to prevent spiral of death
    const delta = Math.min(rawDelta, MAX_ACCUMULATOR_TIME);
    this.accumulator += delta;

    // Track frame time
    this.metrics.frameTime = rawDelta * 1000; // ms

    // Smoothed FPS
    const instantFps = rawDelta > 0 ? 1 / rawDelta : 0;
    this.metrics.fps = this.metrics.fps * FPS_SMOOTHING + instantFps * (1 - FPS_SMOOTHING);

    // Fixed-timestep updates
    let updateCount = 0;
    while (this.accumulator >= FIXED_TIMESTEP) {
      this.callbacks.update(FIXED_TIMESTEP);
      this.accumulator -= FIXED_TIMESTEP;
      updateCount++;
    }
    this.metrics.updateCount = updateCount;

    // Render with interpolation factor
    const interpolation = this.accumulator / FIXED_TIMESTEP;
    this.callbacks.render(interpolation);

    this.rafId = requestAnimationFrame((t) => this.tick(t));
  }
}
