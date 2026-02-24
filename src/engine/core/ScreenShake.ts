/**
 * Simple screen shake system that produces per-frame camera offsets.
 * Used for hard landing impact, combat hitstop, etc.
 */
export class ScreenShake {
  private intensity = 0;
  private durationFrames = 0;
  private timer = 0;

  /** Master enabled flag */
  enabled = true;

  /** Intensity multiplier for tuning */
  intensityMultiplier = 1.0;

  /** Trigger a shake */
  shake(intensity: number, durationFrames: number): void {
    if (!this.enabled) return;
    this.intensity = intensity * this.intensityMultiplier;
    this.durationFrames = durationFrames;
    this.timer = durationFrames;
  }

  /** Returns per-frame offset. Call once per frame. */
  update(): { offsetX: number; offsetY: number } {
    if (this.timer <= 0) {
      return { offsetX: 0, offsetY: 0 };
    }

    const progress = this.timer / this.durationFrames;
    const currentIntensity = this.intensity * progress;

    const offsetX = (Math.random() * 2 - 1) * currentIntensity;
    const offsetY = (Math.random() * 2 - 1) * currentIntensity;

    this.timer--;

    return { offsetX, offsetY };
  }

  /** Whether a shake is currently active */
  isShaking(): boolean {
    return this.timer > 0;
  }
}
