export interface SpriteSheetConfig {
  /** Unique asset ID for caching */
  id: string;
  /** Path to the sprite sheet image (relative to public/) */
  src: string;
  /** Width of each frame in pixels */
  frameWidth: number;
  /** Height of each frame in pixels */
  frameHeight: number;
  /** Number of columns in the sheet */
  columns: number;
  /** Total number of frames in the sheet */
  totalFrames: number;
}

export interface AnimationDef {
  /** Name of the animation (e.g., "idle", "run", "jump") */
  name: string;
  /** Frame indices into the sprite sheet (0-based, left-to-right, top-to-bottom) */
  frames: number[];
  /** Frames per second for this animation */
  fps: number;
  /** Whether the animation loops */
  loop: boolean;
}

const ASSET_LOAD_TIMEOUT_MS = 5000;

export class SpriteSheet {
  readonly config: SpriteSheetConfig;
  private imageSource: CanvasImageSource | null = null;
  private loaded = false;
  private animations = new Map<string, AnimationDef>();

  constructor(config: SpriteSheetConfig) {
    this.config = config;
  }

  /** Returns a promise that resolves when the image is loaded */
  load(): Promise<void> {
    if (this.loaded) return Promise.resolve();

    return new Promise<void>((resolve) => {
      const img = new Image();

      const timeout = setTimeout(() => {
        // Timed out — will use placeholder
        this.loaded = false;
        resolve();
      }, ASSET_LOAD_TIMEOUT_MS);

      img.onload = () => {
        clearTimeout(timeout);
        this.imageSource = img;
        this.loaded = true;
        resolve();
      };

      img.onerror = () => {
        clearTimeout(timeout);
        this.loaded = false;
        resolve();
      };

      img.src = this.config.src;
    });
  }

  /** Check if the sprite sheet image is loaded */
  isLoaded(): boolean {
    return this.loaded;
  }

  /** Set the image source directly (used for placeholders) */
  setImageSource(source: CanvasImageSource): void {
    this.imageSource = source;
    this.loaded = true;
  }

  /** Get the underlying image source */
  getImageSource(): CanvasImageSource | null {
    return this.imageSource;
  }

  /** Register an animation definition */
  addAnimation(anim: AnimationDef): void {
    this.animations.set(anim.name, anim);
  }

  /** Get an animation by name */
  getAnimation(name: string): AnimationDef | undefined {
    return this.animations.get(name);
  }

  /**
   * Get the source rectangle for a specific frame index.
   * Frame 0 is top-left, frames go left-to-right then top-to-bottom.
   */
  getFrameRect(frameIndex: number): { sx: number; sy: number; sw: number; sh: number } {
    const clamped = Math.max(0, Math.min(frameIndex, this.config.totalFrames - 1));
    const col = clamped % this.config.columns;
    const row = Math.floor(clamped / this.config.columns);
    return {
      sx: col * this.config.frameWidth,
      sy: row * this.config.frameHeight,
      sw: this.config.frameWidth,
      sh: this.config.frameHeight,
    };
  }

  /**
   * Draw a specific frame at the given world position.
   * Supports horizontal flip (for facing direction) and scale.
   */
  drawFrame(
    ctx: CanvasRenderingContext2D,
    frameIndex: number,
    x: number,
    y: number,
    flipX = false,
    scaleX = 1,
    scaleY = 1,
  ): void {
    if (!this.imageSource) return;

    const { sx, sy, sw, sh } = this.getFrameRect(frameIndex);
    const dw = sw * scaleX;
    const dh = sh * scaleY;

    if (!flipX) {
      ctx.drawImage(this.imageSource, sx, sy, sw, sh, x, y, dw, dh);
      return;
    }

    ctx.save();
    ctx.translate(x + dw, y);
    ctx.scale(-1, 1);
    ctx.drawImage(this.imageSource, sx, sy, sw, sh, 0, 0, dw, dh);
    ctx.restore();
  }
}
