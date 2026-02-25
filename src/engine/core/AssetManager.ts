import { SpriteSheet } from "./SpriteSheet";
import type { SpriteSheetConfig } from "./SpriteSheet";

/** Colors used for placeholder sprites by asset ID prefix */
const PLACEHOLDER_COLORS: Record<string, string> = {
  player: "#f472b6",
  reader: "#ef4444",
  binder: "#a855f7",
  proofwarden: "#3b82f6",
  giant: "#8b5cf6",
  seraph: "#8b5cf6",
  eater: "#8b5cf6",
  "tiles-scribe-hall": "#6b5344",
  "tiles-herbarium-folio": "#3b6b3b",
  "tiles-astral-atlas": "#475569",
  "tiles-maritime-ledger": "#3b6b9b",
  "tiles-gothic-errata": "#5c3a3a",
  tiles: "#8b7355",
  "bg-scribe-hall": "#8b6914",
  "bg-herbarium": "#2d5a27",
  "bg-astral": "#1a1a4e",
  "bg-maritime": "#1a4a4a",
  "bg-gothic": "#2a1a1a",
  "combat-spear": "#60a5fa",
  "combat-snap": "#4338ca",
  "combat-hit": "#fbbf24",
  "combat-hitstop": "#ffffff",
  "vfx-stitch": "#f59e0b",
  "vfx-redaction": "#ef4444",
  "vfx-paste": "#f59e0b",
  "vfx-bookmark": "#f59e0b",
  "vfx-teleport": "#f59e0b",
  "vfx-index": "#f59e0b",
  vfx: "#fbbf24",
  hud: "#60a5fa",
  card: "#a78bfa",
  ui: "#60a5fa",
};

function getPlaceholderColor(id: string): string {
  for (const [prefix, color] of Object.entries(PLACEHOLDER_COLORS)) {
    if (id.startsWith(prefix)) return color;
  }
  return "#888888";
}

export class AssetManager {
  private static instance: AssetManager;
  private spriteSheets = new Map<string, SpriteSheet>();
  private images = new Map<string, HTMLImageElement>();
  private loading = new Map<string, Promise<void>>();

  static getInstance(): AssetManager {
    if (!AssetManager.instance) {
      AssetManager.instance = new AssetManager();
    }
    return AssetManager.instance;
  }

  /** Register and load a sprite sheet. Returns immediately if already loaded. */
  loadSpriteSheet(config: SpriteSheetConfig): Promise<SpriteSheet> {
    const existing = this.spriteSheets.get(config.id);
    if (existing && existing.isLoaded()) {
      return Promise.resolve(existing);
    }

    const existingLoad = this.loading.get(config.id);
    if (existingLoad) {
      return existingLoad.then(() => this.spriteSheets.get(config.id)!);
    }

    const sheet = new SpriteSheet(config);
    this.spriteSheets.set(config.id, sheet);

    const loadPromise = sheet.load().then(() => {
      if (!sheet.isLoaded()) {
        // Image failed to load — generate a placeholder
        const placeholder = this.createPlaceholder(config, getPlaceholderColor(config.id));
        sheet.setImageSource(placeholder);
      }
      this.loading.delete(config.id);
    });

    this.loading.set(config.id, loadPromise);
    return loadPromise.then(() => sheet);
  }

  /** Get a loaded sprite sheet by ID */
  getSpriteSheet(id: string): SpriteSheet | undefined {
    return this.spriteSheets.get(id);
  }

  /** Load a single image. Rejects if the image fails to load. */
  loadImage(id: string, src: string): Promise<HTMLImageElement> {
    const existing = this.images.get(id);
    if (existing) return Promise.resolve(existing);

    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.images.set(id, img);
        resolve(img);
      };
      img.onerror = () => {
        reject(new Error(`Failed to load image "${id}" from ${src}`));
      };
      img.src = src;
    });
  }

  /** Get a loaded image by ID */
  getImage(id: string): HTMLImageElement | undefined {
    return this.images.get(id);
  }

  /** Load multiple sprite sheets in parallel. Returns when all are loaded. */
  loadAll(configs: SpriteSheetConfig[]): Promise<void> {
    return Promise.all(configs.map((c) => this.loadSpriteSheet(c))).then(() => {});
  }

  /** Check if all registered assets are loaded */
  isReady(): boolean {
    if (this.loading.size > 0) return false;
    for (const sheet of this.spriteSheets.values()) {
      if (!sheet.isLoaded()) return false;
    }
    return true;
  }

  /** Check if a sprite sheet loaded from its real image (not a placeholder) */
  isRealAsset(id: string): boolean {
    const sheet = this.spriteSheets.get(id);
    if (!sheet) return false;
    const source = sheet.getImageSource();
    return source instanceof HTMLImageElement && source.naturalWidth > 0;
  }

  /** Clear all cached assets */
  clear(): void {
    this.spriteSheets.clear();
    this.images.clear();
    this.loading.clear();
  }

  /** Create a colored rectangle placeholder sprite sheet as a canvas */
  createPlaceholder(config: SpriteSheetConfig, color: string): HTMLCanvasElement {
    const rows = Math.ceil(config.totalFrames / config.columns);
    const canvas = document.createElement("canvas");
    canvas.width = config.frameWidth * config.columns;
    canvas.height = config.frameHeight * rows;
    const ctx = canvas.getContext("2d")!;

    for (let i = 0; i < config.totalFrames; i++) {
      const col = i % config.columns;
      const row = Math.floor(i / config.columns);
      const x = col * config.frameWidth;
      const y = row * config.frameHeight;

      // Frame background
      ctx.fillStyle = color;
      ctx.fillRect(x + 2, y + 2, config.frameWidth - 4, config.frameHeight - 4);

      // Frame border
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y + 1, config.frameWidth - 2, config.frameHeight - 2);

      // Frame number
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px monospace";
      ctx.fillText(String(i), x + 4, y + 14);

      // Asset ID label (small, at bottom)
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "8px monospace";
      ctx.fillText(config.id, x + 4, y + config.frameHeight - 6);
    }

    return canvas;
  }
}
