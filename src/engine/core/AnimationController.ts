import { SpriteSheet } from "./SpriteSheet";

export class AnimationController {
  private spriteSheet: SpriteSheet;
  private currentAnim = "";
  private currentFrame = 0;
  private frameTimer = 0;
  private finished = false;

  constructor(spriteSheet: SpriteSheet) {
    this.spriteSheet = spriteSheet;
  }

  /** Switch to a different sprite sheet (for state-driven sheet swapping) */
  setSpriteSheet(sheet: SpriteSheet): void {
    if (this.spriteSheet !== sheet) {
      this.spriteSheet = sheet;
      // Reset animation state when sheet changes
      this.currentAnim = "";
      this.currentFrame = 0;
      this.frameTimer = 0;
      this.finished = false;
    }
  }

  /** Get the current sprite sheet */
  getSpriteSheet(): SpriteSheet {
    return this.spriteSheet;
  }

  /** Play an animation. If it's already playing, does nothing (no restart). */
  play(animName: string): void {
    if (this.currentAnim === animName) return;
    this.currentAnim = animName;
    this.currentFrame = 0;
    this.frameTimer = 0;
    this.finished = false;
  }

  /** Force-restart an animation from frame 0 */
  restart(animName: string): void {
    this.currentAnim = animName;
    this.currentFrame = 0;
    this.frameTimer = 0;
    this.finished = false;
  }

  /** Update animation timing. Call once per frame with dt in seconds. */
  update(dt: number): void {
    const anim = this.spriteSheet.getAnimation(this.currentAnim);
    if (!anim || anim.frames.length <= 1) return;

    this.frameTimer += dt;
    const frameDuration = 1 / anim.fps;

    while (this.frameTimer >= frameDuration) {
      this.frameTimer -= frameDuration;
      this.currentFrame++;

      if (this.currentFrame >= anim.frames.length) {
        if (anim.loop) {
          this.currentFrame = 0;
        } else {
          this.currentFrame = anim.frames.length - 1;
          this.finished = true;
        }
      }
    }
  }

  /** Get the current frame index into the sprite sheet */
  getCurrentFrameIndex(): number {
    const anim = this.spriteSheet.getAnimation(this.currentAnim);
    if (!anim || anim.frames.length === 0) return 0;
    return anim.frames[this.currentFrame];
  }

  /** Check if a non-looping animation has finished */
  isFinished(): boolean {
    return this.finished;
  }

  /** Get the current animation name */
  getCurrentAnimation(): string {
    return this.currentAnim;
  }

  /** Get the current frame number within the animation */
  getCurrentFrameNumber(): number {
    return this.currentFrame;
  }

  /** Get total frame count for the current animation */
  getTotalFrames(): number {
    const anim = this.spriteSheet.getAnimation(this.currentAnim);
    return anim ? anim.frames.length : 0;
  }

  /**
   * Draw the current animation frame at the given position.
   * Delegates to SpriteSheet.drawFrame() with the current frame index.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    flipX = false,
    scaleX = 1,
    scaleY = 1,
  ): void {
    const frameIndex = this.getCurrentFrameIndex();
    this.spriteSheet.drawFrame(ctx, frameIndex, x, y, flipX, scaleX, scaleY);
  }
}
