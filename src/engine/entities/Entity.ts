import type { Vec2, Rect } from "@/lib/types";
import type { Renderer } from "@/engine/core/Renderer";

export interface EntityConfig {
  position?: Vec2;
  size?: Vec2;
  color?: string;
}

let nextEntityId = 0;

export class Entity {
  readonly id: string;
  position: Vec2;
  velocity: Vec2;
  size: Vec2;
  color: string;
  active: boolean;
  prevPosition: Vec2;

  constructor(config: EntityConfig = {}) {
    this.id = String(nextEntityId++);
    this.position = { x: config.position?.x ?? 0, y: config.position?.y ?? 0 };
    this.velocity = { x: 0, y: 0 };
    this.size = { x: config.size?.x ?? 32, y: config.size?.y ?? 32 };
    this.color = config.color ?? "#22d3ee";
    this.active = true;
    this.prevPosition = { x: this.position.x, y: this.position.y };
  }

  /** Override in subclasses. Base implementation applies velocity to position. */
  update(dt: number): void {
    this.prevPosition.x = this.position.x;
    this.prevPosition.y = this.position.y;
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
  }

  /** Override in subclasses. Base implementation draws a colored rectangle. */
  render(renderer: Renderer, interpolation: number): void {
    const pos = this.getInterpolatedPosition(interpolation);
    renderer.fillRect(pos.x, pos.y, this.size.x, this.size.y, this.color);
  }

  /** Returns AABB from position + size */
  getBounds(): Rect {
    return {
      x: this.position.x,
      y: this.position.y,
      width: this.size.x,
      height: this.size.y,
    };
  }

  /** Lerp between prevPosition and position for smooth rendering */
  getInterpolatedPosition(interpolation: number): Vec2 {
    return {
      x: this.prevPosition.x + (this.position.x - this.prevPosition.x) * interpolation,
      y: this.prevPosition.y + (this.position.y - this.prevPosition.y) * interpolation,
    };
  }
}
