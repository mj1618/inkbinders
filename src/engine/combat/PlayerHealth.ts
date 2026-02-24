import type { Vec2 } from "@/lib/types";

export interface PlayerHealthParams {
  maxHealth: number;
  invincibilityFrames: number;
  knockbackSpeed: number;
  knockbackDuration: number;
  dashIFrames: boolean;
}

export const DEFAULT_PLAYER_HEALTH_PARAMS: PlayerHealthParams = {
  maxHealth: 5,
  invincibilityFrames: 60,
  knockbackSpeed: 200,
  knockbackDuration: 10,
  dashIFrames: true,
};

export class PlayerHealth {
  params: PlayerHealthParams;
  health: number;
  maxHealth: number;
  invincibilityTimer = 0;
  knockbackTimer = 0;
  knockbackDirection: Vec2 = { x: 0, y: 0 };
  lastDamageSource = "";
  totalDamageTaken = 0;

  constructor(params?: Partial<PlayerHealthParams>) {
    this.params = { ...DEFAULT_PLAYER_HEALTH_PARAMS, ...params };
    this.health = this.params.maxHealth;
    this.maxHealth = this.params.maxHealth;
  }

  canTakeDamage(playerState: string, isDashing: boolean): boolean {
    if (this.invincibilityTimer > 0) return false;
    if (isDashing && this.params.dashIFrames) return false;
    if (this.health <= 0) return false;
    // Not blocking based on playerState for now — only dash i-frames
    void playerState;
    return true;
  }

  takeDamage(damage: number, knockbackDir: Vec2, source: string): boolean {
    if (this.invincibilityTimer > 0) return false;
    if (this.health <= 0) return false;

    this.health = Math.max(0, this.health - damage);
    this.totalDamageTaken += damage;
    this.invincibilityTimer = this.params.invincibilityFrames;
    this.knockbackTimer = this.params.knockbackDuration;
    this.knockbackDirection.x = knockbackDir.x;
    this.knockbackDirection.y = knockbackDir.y;
    this.lastDamageSource = source;

    return true;
  }

  update(): void {
    if (this.invincibilityTimer > 0) {
      this.invincibilityTimer--;
    }
    if (this.knockbackTimer > 0) {
      this.knockbackTimer--;
    }
  }

  getKnockbackVelocity(): Vec2 | null {
    if (this.knockbackTimer <= 0) return null;
    const t = this.knockbackTimer / this.params.knockbackDuration;
    return {
      x: this.knockbackDirection.x * this.params.knockbackSpeed * t,
      y: this.knockbackDirection.y * this.params.knockbackSpeed * t,
    };
  }

  renderHUD(ctx: CanvasRenderingContext2D, canvasWidth: number): void {
    const heartSize = 16;
    const spacing = 4;
    const totalWidth = this.maxHealth * (heartSize + spacing) - spacing;
    const startX = (canvasWidth - totalWidth) / 2;
    const y = 12;

    for (let i = 0; i < this.maxHealth; i++) {
      const x = startX + i * (heartSize + spacing);
      const filled = i < this.health;

      if (filled) {
        // Filled heart — simple cross/plus shape for simplicity
        ctx.fillStyle = "#ef4444";
        // Top bumps
        ctx.fillRect(x + 1, y, 6, 6);
        ctx.fillRect(x + 9, y, 6, 6);
        // Middle body
        ctx.fillRect(x, y + 3, heartSize, 6);
        // Bottom point
        ctx.fillRect(x + 2, y + 9, 12, 4);
        ctx.fillRect(x + 4, y + 13, 8, 2);
        ctx.fillRect(x + 6, y + 15, 4, 1);
      } else {
        // Empty heart outline
        ctx.strokeStyle = "#4b5563";
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 1, y, 6, 6);
        ctx.strokeRect(x + 9, y, 6, 6);
        ctx.strokeRect(x, y + 3, heartSize, 6);
        ctx.strokeRect(x + 2, y + 9, 12, 4);
      }
    }
  }

  reset(): void {
    this.health = this.params.maxHealth;
    this.maxHealth = this.params.maxHealth;
    this.invincibilityTimer = 0;
    this.knockbackTimer = 0;
    this.knockbackDirection.x = 0;
    this.knockbackDirection.y = 0;
    this.lastDamageSource = "";
  }
}
