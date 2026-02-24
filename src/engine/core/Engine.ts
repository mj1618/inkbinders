import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS } from "@/lib/constants";
import type { PerformanceMetrics } from "@/lib/types";
import { GameLoop } from "./GameLoop";
import { Renderer } from "./Renderer";
import { Camera } from "./Camera";
import { InputManager } from "@/engine/input/InputManager";
import { EntityManager } from "@/engine/entities/EntityManager";

export interface EngineConfig {
  ctx: CanvasRenderingContext2D;
  width?: number;
  height?: number;
}

type UpdateCallback = (dt: number) => void;
type RenderCallback = (renderer: Renderer, interpolation: number) => void;

/**
 * Top-level engine orchestrator.
 * Creates and owns all subsystems: GameLoop, Renderer, InputManager, EntityManager, Camera.
 */
export class Engine {
  private loop: GameLoop;
  private renderer: Renderer;
  private input: InputManager;
  private entities: EntityManager;
  private camera: Camera;

  private customUpdateCallbacks: UpdateCallback[] = [];
  private customRenderCallbacks: RenderCallback[] = [];

  private width: number;
  private height: number;

  constructor(config: EngineConfig) {
    this.width = config.width ?? CANVAS_WIDTH;
    this.height = config.height ?? CANVAS_HEIGHT;

    this.renderer = new Renderer(config.ctx, this.width, this.height);
    this.camera = new Camera(this.width, this.height);
    this.input = new InputManager();
    this.entities = new EntityManager();

    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: (interpolation) => this.render(interpolation),
    });
  }

  start(): void {
    this.input.attach();
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
    this.input.detach();
  }

  getLoop(): GameLoop {
    return this.loop;
  }

  getRenderer(): Renderer {
    return this.renderer;
  }

  getInput(): InputManager {
    return this.input;
  }

  getEntities(): EntityManager {
    return this.entities;
  }

  getCamera(): Camera {
    return this.camera;
  }

  getMetrics(): PerformanceMetrics {
    return this.loop.getMetrics();
  }

  /** Register a custom update callback (runs after entity updates) */
  onUpdate(callback: UpdateCallback): void {
    this.customUpdateCallbacks.push(callback);
  }

  /** Remove a custom update callback */
  offUpdate(callback: UpdateCallback): void {
    const idx = this.customUpdateCallbacks.indexOf(callback);
    if (idx !== -1) this.customUpdateCallbacks.splice(idx, 1);
  }

  /** Register a custom render callback (runs after entity rendering) */
  onRender(callback: RenderCallback): void {
    this.customRenderCallbacks.push(callback);
  }

  /** Remove a custom render callback */
  offRender(callback: RenderCallback): void {
    const idx = this.customRenderCallbacks.indexOf(callback);
    if (idx !== -1) this.customRenderCallbacks.splice(idx, 1);
  }

  private update(dt: number): void {
    // Snapshot input state
    this.input.update();

    // Update all entities
    this.entities.update(dt);

    // Run custom update callbacks
    for (const cb of this.customUpdateCallbacks) {
      cb(dt);
    }
  }

  private render(interpolation: number): void {
    // Clear canvas
    this.renderer.clear();
    this.renderer.fillRect(0, 0, this.width, this.height, COLORS.background);

    // Apply camera transform
    this.renderer.applyCamera(this.camera);

    // Render all entities
    this.entities.render(this.renderer, interpolation);

    // Run custom render callbacks (in camera space)
    for (const cb of this.customRenderCallbacks) {
      cb(this.renderer, interpolation);
    }

    // Render world-space layer callbacks (background, world, entities, fx)
    this.renderer.renderWorldLayers();

    // Reset to screen space for HUD/debug
    this.renderer.resetCamera();

    // Render screen-space layer callbacks (debug overlays, HUD)
    this.renderer.renderScreenLayers();
  }
}
