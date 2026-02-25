// HealthPickup — collectible health recovery items placed in rooms

import type { Rect } from "@/lib/types";
import type { Camera } from "@/engine/core/Camera";
import type { PlayerHealth } from "@/engine/combat/PlayerHealth";
import type { HealthPickupDef } from "./Room";

/** Pickup hitbox size (centered on position) */
const PICKUP_HITBOX = 24;
/** Visual heart size */
const HEART_SIZE = 16;
/** Bob animation amplitude (pixels) */
const BOB_AMPLITUDE = 4;
/** Bob animation cycle duration (seconds) */
const BOB_PERIOD = 1.5;
/** Number of particles on collection */
const PARTICLE_COUNT = 5;
/** Particle lifetime (seconds) */
const PARTICLE_LIFETIME = 0.6;
/** Particle speed */
const PARTICLE_SPEED = 80;

interface CollectionParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export class HealthPickupManager {
  private pickups: HealthPickupDef[];
  private collected: Set<string> = new Set();
  private particles: CollectionParticle[] = [];

  constructor(pickups: HealthPickupDef[]) {
    this.pickups = pickups;
  }

  /** Check player overlap, heal if applicable. Returns true if a pickup was consumed. */
  update(playerBounds: Rect, playerHealth: PlayerHealth, dt: number): boolean {
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    let consumed = false;
    for (const pickup of this.pickups) {
      if (this.collected.has(pickup.id)) continue;

      // Don't consume if player is at max health
      if (playerHealth.health >= playerHealth.maxHealth) continue;

      // Check overlap
      const hx = pickup.position.x - PICKUP_HITBOX / 2;
      const hy = pickup.position.y - PICKUP_HITBOX / 2;
      const pickupRect: Rect = { x: hx, y: hy, width: PICKUP_HITBOX, height: PICKUP_HITBOX };

      if (rectsOverlap(playerBounds, pickupRect)) {
        // Heal player
        playerHealth.health = Math.min(
          playerHealth.health + pickup.healAmount,
          playerHealth.maxHealth,
        );
        this.collected.add(pickup.id);
        consumed = true;

        // Spawn particles
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
          this.particles.push({
            x: pickup.position.x,
            y: pickup.position.y,
            vx: Math.cos(angle) * PARTICLE_SPEED * (0.5 + Math.random() * 0.5),
            vy: Math.sin(angle) * PARTICLE_SPEED * (0.5 + Math.random() * 0.5),
            life: PARTICLE_LIFETIME * (0.5 + Math.random() * 0.5),
          });
        }
      }
    }
    return consumed;
  }

  /** Render all uncollected pickups and active particles.
   *  Assumes the canvas context already has a camera transform applied (world-space drawing). */
  render(ctx: CanvasRenderingContext2D, _camera: Camera, time: number): void {
    // Render uncollected pickups
    for (const pickup of this.pickups) {
      if (this.collected.has(pickup.id)) continue;

      const bobOffset = Math.sin((time / BOB_PERIOD) * Math.PI * 2) * BOB_AMPLITUDE;
      const sx = pickup.position.x - HEART_SIZE / 2;
      const sy = pickup.position.y - HEART_SIZE / 2 + bobOffset;

      // Glow effect (draw behind heart)
      ctx.globalAlpha = 0.2 + Math.sin((time / BOB_PERIOD) * Math.PI * 2) * 0.1;
      ctx.fillStyle = "#fca5a5";
      ctx.fillRect(sx - 2, sy - 2, HEART_SIZE + 4, HEART_SIZE + 4);
      ctx.globalAlpha = 1;

      // Draw heart shape
      ctx.fillStyle = "#ef4444";
      // Top bumps
      ctx.fillRect(sx + 1, sy, 6, 6);
      ctx.fillRect(sx + 9, sy, 6, 6);
      // Middle body
      ctx.fillRect(sx, sy + 3, HEART_SIZE, 6);
      // Bottom point
      ctx.fillRect(sx + 2, sy + 9, 12, 4);
      ctx.fillRect(sx + 4, sy + 13, 8, 2);
      ctx.fillRect(sx + 6, sy + 15, 4, 1);
    }

    // Render particles
    for (const p of this.particles) {
      const alpha = p.life / PARTICLE_LIFETIME;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  /** Reset collected state (call on room entry) */
  reset(): void {
    this.collected.clear();
    this.particles = [];
  }
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
