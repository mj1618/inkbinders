// Day/Night Renderer — Rendering helpers for atmosphere, fog, clock HUD, corruption distortion

import type { DayNightAtmosphere } from "./DayNightAtmosphere";
import type { TimeOfDay } from "./DayNightCycle";
import type { Vec2 } from "@/lib/types";

/** Clock HUD position offset from top-right corner */
const CLOCK_MARGIN = 24;
/** Clock circle radius */
const CLOCK_RADIUS = 36;

/** Colors for time-of-day labels */
const TIME_LABEL_COLORS: Record<TimeOfDay, string> = {
  dawn: "#f472b6",
  day: "#fbbf24",
  dusk: "#ea580c",
  night: "#818cf8",
};

export class DayNightRenderer {
  /**
   * Render the sky/background based on current atmosphere.
   */
  static renderBackground(
    ctx: CanvasRenderingContext2D,
    atmosphere: DayNightAtmosphere,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    ctx.fillStyle = atmosphere.backgroundColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  /**
   * Render the light tint overlay (drawn after world, before debug).
   */
  static renderLightOverlay(
    ctx: CanvasRenderingContext2D,
    atmosphere: DayNightAtmosphere,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    ctx.fillStyle = atmosphere.lightTint;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  /**
   * Render fog overlay.
   */
  static renderFog(
    ctx: CanvasRenderingContext2D,
    fogColor: string,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    ctx.fillStyle = fogColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  /**
   * Render fog-of-war (radial visibility around player).
   * Creates a dark overlay with a transparent circle centered on the player.
   * Uses a radial gradient that goes from transparent (at player) to fog color (at edge).
   */
  static renderFogOfWar(
    ctx: CanvasRenderingContext2D,
    playerScreenPos: Vec2,
    radius: number,
    fogColor: string,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    ctx.save();

    // Parse fog color to get RGB components for gradient stops
    const match = fogColor.match(
      /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/,
    );
    const r = match ? parseInt(match[1], 10) : 10;
    const g = match ? parseInt(match[2], 10) : 10;
    const b = match ? parseInt(match[3], 10) : 26;
    const a = match && match[4] !== undefined ? parseFloat(match[4]) : 0.85;

    // Draw a radial gradient: transparent at center, fog color at edge and beyond.
    // The gradient covers from the player outward to the fog radius.
    // Beyond the radius, we need the fog color to fill the rest of the canvas.
    // Use a large outer radius to ensure coverage.
    const maxDist = Math.max(
      Math.hypot(playerScreenPos.x, playerScreenPos.y),
      Math.hypot(canvasWidth - playerScreenPos.x, playerScreenPos.y),
      Math.hypot(playerScreenPos.x, canvasHeight - playerScreenPos.y),
      Math.hypot(canvasWidth - playerScreenPos.x, canvasHeight - playerScreenPos.y),
    );
    const outerRadius = Math.max(radius * 1.5, maxDist);

    const gradient = ctx.createRadialGradient(
      playerScreenPos.x,
      playerScreenPos.y,
      0,
      playerScreenPos.x,
      playerScreenPos.y,
      outerRadius,
    );

    // Transparent at center, ramp up fog starting at 60% of radius
    const fogStart = radius * 0.6 / outerRadius;
    const fogFull = radius / outerRadius;
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
    gradient.addColorStop(fogStart, `rgba(${r}, ${g}, ${b}, ${(a * 0.2).toFixed(3)})`);
    gradient.addColorStop(fogFull, `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.restore();
  }

  /**
   * Render the clock/time HUD element.
   * A circular clock face showing current time, with day/night indicator.
   */
  static renderClockHUD(
    ctx: CanvasRenderingContext2D,
    time: number,
    timeOfDay: TimeOfDay,
    x: number,
    y: number,
    radius: number = CLOCK_RADIUS,
  ): void {
    const cx = x;
    const cy = y;

    // Clock background
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#1f2937";
    ctx.fill();

    // Clock border
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Time progress arc (amber for day portion, indigo for night portion)
    const startAngle = -Math.PI / 2; // 12 o'clock
    const progressAngle = startAngle + time * Math.PI * 2;

    ctx.beginPath();
    ctx.arc(cx, cy, radius - 4, startAngle, progressAngle);
    ctx.strokeStyle =
      timeOfDay === "day" || timeOfDay === "dawn"
        ? "rgba(251, 191, 36, 0.6)"
        : "rgba(129, 140, 248, 0.6)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Progress dot on the edge
    const dotX = cx + Math.cos(progressAngle) * (radius - 4);
    const dotY = cy + Math.sin(progressAngle) * (radius - 4);
    ctx.beginPath();
    ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    // Sun/Moon icon at center
    if (timeOfDay === "day" || timeOfDay === "dawn") {
      // Sun — filled circle
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#fbbf24";
      ctx.fill();
      // Sun rays
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const innerR = 10;
        const outerR = 14;
        ctx.beginPath();
        ctx.moveTo(
          cx + Math.cos(angle) * innerR,
          cy + Math.sin(angle) * innerR,
        );
        ctx.lineTo(
          cx + Math.cos(angle) * outerR,
          cy + Math.sin(angle) * outerR,
        );
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    } else {
      // Moon — crescent via two overlapping circles
      ctx.beginPath();
      ctx.arc(cx, cy, 9, 0, Math.PI * 2);
      ctx.fillStyle = "#818cf8";
      ctx.fill();
      // Cut out crescent
      ctx.beginPath();
      ctx.arc(cx + 5, cy - 3, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#1f2937";
      ctx.fill();
    }

    // Time-of-day label below clock
    const label = timeOfDay.toUpperCase();
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = TIME_LABEL_COLORS[timeOfDay];
    ctx.fillText(label, cx, cy + radius + 14);
    ctx.textAlign = "left";
  }

  /**
   * Render the clock HUD at the default top-right position.
   */
  static renderClockHUDDefault(
    ctx: CanvasRenderingContext2D,
    time: number,
    timeOfDay: TimeOfDay,
    canvasWidth: number,
  ): void {
    DayNightRenderer.renderClockHUD(
      ctx,
      time,
      timeOfDay,
      canvasWidth - CLOCK_MARGIN - CLOCK_RADIUS,
      CLOCK_MARGIN + CLOCK_RADIUS,
    );
  }

  /**
   * Render corruption visual distortion.
   * At high corruption: chromatic aberration effect (offset red/blue channels slightly).
   */
  static renderCorruptionDistortion(
    ctx: CanvasRenderingContext2D,
    corruptionIntensity: number,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    if (corruptionIntensity < 0.5) return;

    const intensity = (corruptionIntensity - 0.5) * 2; // 0-1 from threshold
    const offset = Math.round(intensity * 2); // 0-2px offset
    if (offset < 1) return;

    const alpha = 0.02 + intensity * 0.01; // 0.02 - 0.03

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = "lighter";
    // Red channel shift
    ctx.drawImage(
      ctx.canvas,
      offset,
      0,
      canvasWidth - offset,
      canvasHeight,
      0,
      0,
      canvasWidth - offset,
      canvasHeight,
    );
    ctx.globalAlpha = alpha * 0.7;
    // Blue channel shift (opposite direction)
    ctx.drawImage(
      ctx.canvas,
      0,
      0,
      canvasWidth - offset,
      canvasHeight,
      offset,
      0,
      canvasWidth - offset,
      canvasHeight,
    );
    ctx.restore();
  }

  /**
   * Render platform with darkness overlay and optional flicker effect.
   */
  static renderPlatformDarkness(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    platformDarkness: number,
    isFlickering: boolean,
  ): void {
    if (platformDarkness > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${platformDarkness * 0.8})`;
      ctx.fillRect(x, y, width, height);
    }

    if (isFlickering) {
      ctx.globalAlpha = 0.4 + Math.random() * 0.6;
      ctx.fillStyle = "rgba(99, 102, 241, 0.15)";
      ctx.fillRect(x, y, width, height);
      ctx.globalAlpha = 1;
    }
  }

  /**
   * Render shadow beneath a platform.
   */
  static renderPlatformShadow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    shadowOpacity: number,
  ): void {
    if (shadowOpacity <= 0) return;
    const shadowOffset = 4;
    const shadowBlur = 6;
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
    ctx.fillRect(
      x + shadowBlur / 2,
      y + height + shadowOffset - shadowBlur / 2,
      width - shadowBlur,
      shadowBlur,
    );
  }
}
