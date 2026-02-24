import type { RenderLayer } from "@/lib/types";
import { Camera } from "./Camera";

/** World-space layers — rendered with camera transform applied */
const WORLD_LAYERS: RenderLayer[] = ["background", "world", "entities", "fx"];

/** Screen-space layers — rendered after camera reset (HUD, debug) */
const SCREEN_LAYERS: RenderLayer[] = ["debug"];

/** All layers in order */
const LAYER_ORDER: RenderLayer[] = [...WORLD_LAYERS, ...SCREEN_LAYERS];

type RenderCallback = (ctx: CanvasRenderingContext2D) => void;

/**
 * Canvas 2D renderer with a layer system for draw ordering.
 * Uses immediate-mode drawing — each frame, everything is redrawn.
 */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private layers = new Map<RenderLayer, RenderCallback[]>();

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  /** Register a render callback on a specific layer */
  addLayerCallback(layer: RenderLayer, callback: RenderCallback): void {
    let callbacks = this.layers.get(layer);
    if (!callbacks) {
      callbacks = [];
      this.layers.set(layer, callbacks);
    }
    callbacks.push(callback);
  }

  /** Remove a render callback from a layer */
  removeLayerCallback(layer: RenderLayer, callback: RenderCallback): void {
    const callbacks = this.layers.get(layer);
    if (!callbacks) return;
    const idx = callbacks.indexOf(callback);
    if (idx !== -1) callbacks.splice(idx, 1);
  }

  /** Execute all layer callbacks in order */
  renderLayers(): void {
    for (const layer of LAYER_ORDER) {
      this.renderLayerList([layer]);
    }
  }

  /** Execute world-space layer callbacks (background, world, entities, fx) */
  renderWorldLayers(): void {
    this.renderLayerList(WORLD_LAYERS);
  }

  /** Execute screen-space layer callbacks (debug) */
  renderScreenLayers(): void {
    this.renderLayerList(SCREEN_LAYERS);
  }

  private renderLayerList(layers: RenderLayer[]): void {
    for (const layer of layers) {
      const callbacks = this.layers.get(layer);
      if (callbacks) {
        for (const cb of callbacks) {
          cb(this.ctx);
        }
      }
    }
  }

  /** Clear the entire canvas */
  clear(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  /** Apply camera transform to the context */
  applyCamera(camera: Camera): void {
    this.ctx.save();
    this.ctx.translate(this.width / 2, this.height / 2);
    this.ctx.scale(camera.zoom, camera.zoom);
    this.ctx.translate(-camera.position.x, -camera.position.y);
  }

  /** Reset the context to screen space (undo camera transform) */
  resetCamera(): void {
    this.ctx.restore();
  }

  /** Draw a filled rectangle */
  fillRect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }

  /** Draw an outlined rectangle */
  strokeRect(
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    lineWidth: number = 1,
  ): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.strokeRect(x, y, w, h);
  }

  /** Draw a line segment */
  drawLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    lineWidth: number = 1,
  ): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.stroke();
  }

  /** Draw a circle */
  drawCircle(
    x: number,
    y: number,
    radius: number,
    color: string,
    fill: boolean = true,
  ): void {
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    if (fill) {
      this.ctx.fillStyle = color;
      this.ctx.fill();
    } else {
      this.ctx.strokeStyle = color;
      this.ctx.stroke();
    }
  }

  /** Draw text */
  drawText(
    text: string,
    x: number,
    y: number,
    color: string,
    fontSize: number = 12,
    font: string = "monospace",
  ): void {
    this.ctx.fillStyle = color;
    this.ctx.font = `${fontSize}px ${font}`;
    this.ctx.fillText(text, x, y);
  }

  /** Draw an image or image region at the given position */
  drawImage(
    image: CanvasImageSource,
    sx: number, sy: number, sw: number, sh: number,
    dx: number, dy: number, dw: number, dh: number,
  ): void {
    this.ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  /** Draw an image with optional horizontal flip */
  drawImageFlipped(
    image: CanvasImageSource,
    sx: number, sy: number, sw: number, sh: number,
    dx: number, dy: number, dw: number, dh: number,
    flipX: boolean,
  ): void {
    if (!flipX) {
      this.ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
      return;
    }
    this.ctx.save();
    this.ctx.translate(dx + dw, dy);
    this.ctx.scale(-1, 1);
    this.ctx.drawImage(image, sx, sy, sw, sh, 0, 0, dw, dh);
    this.ctx.restore();
  }

  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }
}
