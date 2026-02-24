import type { Renderer } from "@/engine/core/Renderer";
import { Entity } from "./Entity";

export class EntityManager {
  private entities = new Map<string, Entity>();

  add(entity: Entity): void {
    this.entities.set(entity.id, entity);
  }

  remove(id: string): void {
    this.entities.delete(id);
  }

  get(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  getAll(): Entity[] {
    return Array.from(this.entities.values());
  }

  clear(): void {
    this.entities.clear();
  }

  update(dt: number): void {
    for (const entity of this.entities.values()) {
      if (entity.active) {
        entity.update(dt);
      }
    }
  }

  render(renderer: Renderer, interpolation: number): void {
    for (const entity of this.entities.values()) {
      if (entity.active) {
        entity.render(renderer, interpolation);
      }
    }
  }
}
