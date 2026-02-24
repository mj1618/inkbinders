import type { Renderer } from "./Renderer";

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
}

export interface ParticleEmitConfig {
  x: number;
  y: number;
  count: number;
  speedMin: number;
  speedMax: number;
  angleMin: number;
  angleMax: number;
  lifeMin: number;
  lifeMax: number;
  sizeMin: number;
  sizeMax: number;
  colors: string[];
  gravity?: number;
}

/** Maximum number of particles alive at once */
const MAX_PARTICLES = 200;

/**
 * Lightweight immediate-mode particle system.
 * Colored rectangles with velocity, gravity, and alpha fade.
 */
export class ParticleSystem {
  particles: Particle[] = [];

  /** Multiplier for particle counts (0.5 - 2.0). Tunable from debug panel. */
  countMultiplier = 1.0;

  /** Master enabled flag */
  enabled = true;

  /** Spawn particles with randomized parameters */
  emit(config: ParticleEmitConfig): void {
    if (!this.enabled) return;

    const count = Math.round(config.count * this.countMultiplier);
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) {
        // Remove oldest particle
        this.particles.shift();
      }

      const angle = randomRange(config.angleMin, config.angleMax);
      const speed = randomRange(config.speedMin, config.speedMax);
      const life = randomRange(config.lifeMin, config.lifeMax);
      const size = randomRange(config.sizeMin, config.sizeMax);
      const color = config.colors[Math.floor(Math.random() * config.colors.length)];

      this.particles.push({
        x: config.x,
        y: config.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        size,
        color,
        gravity: config.gravity ?? 0,
      });
    }
  }

  /** Tick all particles, remove dead ones */
  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  /** Draw all particles as small rectangles with alpha fade */
  render(renderer: Renderer): void {
    const ctx = renderer.getContext();
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      renderer.fillRect(
        p.x - p.size / 2,
        p.y - p.size / 2,
        p.size,
        p.size,
        p.color,
      );
    }
    ctx.globalAlpha = 1;
  }

  /** Get the current count of active particles */
  getCount(): number {
    return this.particles.length;
  }

  /** Remove all particles */
  clear(): void {
    this.particles.length = 0;
  }
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
