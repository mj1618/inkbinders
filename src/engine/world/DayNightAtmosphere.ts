// Day/Night Atmosphere — Color palettes and interpolation for each time of day

export interface DayNightAtmosphere {
  /** Background/sky color */
  backgroundColor: string;
  /** Global light tint (applied as a semi-transparent overlay) */
  lightTint: string;
  /** Ambient particle colors */
  ambientParticleColors: string[];
  /** Fog overlay color (rgba with alpha) */
  fogColor: string;
  /** Platform tint multiplier (darkens platforms at night) */
  platformDarkness: number; // 0.0 = full bright, 1.0 = fully darkened
  /** Corruption visual intensity (0-1, controls corruption effects) */
  corruptionIntensity: number;
  /** Shadow opacity (0 = no shadows, 1 = full shadows) */
  shadowOpacity: number;
}

export interface TimeColors {
  backgroundColor: string;
  lightTint: string;
  ambientParticleColors: string[];
  fogColor: string;
  platformDarkness: number;
  shadowOpacity: number;
}

export const DAY_COLORS: TimeColors = {
  backgroundColor: "#f0e6d3", // Warm parchment
  lightTint: "rgba(255, 248, 220, 0.08)", // Warm golden overlay
  ambientParticleColors: ["#fbbf24", "#f59e0b", "#ffffff", "#fde68a"], // Golden dust motes
  fogColor: "rgba(0, 0, 0, 0)", // No fog
  platformDarkness: 0.0,
  shadowOpacity: 0.15,
};

export const NIGHT_COLORS: TimeColors = {
  backgroundColor: "#0a0a1a", // Deep dark blue-black
  lightTint: "rgba(30, 27, 75, 0.15)", // Deep indigo tint
  ambientParticleColors: ["#4338ca", "#6366f1", "#818cf8", "#1e1b4b"], // Cold indigo sparks
  fogColor: "rgba(10, 10, 26, 0.3)", // Dark fog
  platformDarkness: 0.6, // Platforms significantly darker
  shadowOpacity: 0.6,
};

export const DAWN_COLORS: TimeColors = {
  backgroundColor: "#2d1f3d", // Purple-gray
  lightTint: "rgba(244, 114, 182, 0.06)", // Rosy pink tint
  ambientParticleColors: ["#f472b6", "#fb923c", "#fbbf24", "#a855f7"], // Pink/orange
  fogColor: "rgba(45, 31, 61, 0.1)", // Light purple fog
  platformDarkness: 0.3,
  shadowOpacity: 0.3,
};

export const DUSK_COLORS: TimeColors = {
  backgroundColor: "#1a0f2e", // Deep purple
  lightTint: "rgba(234, 88, 12, 0.06)", // Amber tint
  ambientParticleColors: ["#ea580c", "#dc2626", "#f59e0b", "#7c3aed"], // Warm reds/oranges
  fogColor: "rgba(26, 15, 46, 0.15)", // Purple fog
  platformDarkness: 0.4,
  shadowOpacity: 0.4,
};

/**
 * Parse a hex color (#RRGGBB or #RGB) into [r, g, b] (0-255).
 */
function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * Convert [r, g, b] (0-255) to hex #RRGGBB.
 */
function toHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    "#" +
    clamp(r).toString(16).padStart(2, "0") +
    clamp(g).toString(16).padStart(2, "0") +
    clamp(b).toString(16).padStart(2, "0")
  );
}

/**
 * Parse an rgba() string into [r, g, b, a].
 */
function parseRgba(rgba: string): [number, number, number, number] {
  const match = rgba.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/,
  );
  if (match) {
    return [
      parseInt(match[1], 10),
      parseInt(match[2], 10),
      parseInt(match[3], 10),
      match[4] !== undefined ? parseFloat(match[4]) : 1.0,
    ];
  }
  // Fallback: transparent
  return [0, 0, 0, 0];
}

/**
 * Linearly interpolate between two hex colors.
 */
export function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return toHex(
    ar + (br - ar) * t,
    ag + (bg - ag) * t,
    ab + (bb - ab) * t,
  );
}

/**
 * Linearly interpolate between two rgba color strings.
 */
export function lerpRgba(a: string, b: string, t: number): string {
  const [ar, ag, ab, aa] = parseRgba(a);
  const [br, bg, bb, ba] = parseRgba(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  const alpha = aa + (ba - aa) * t;
  return `rgba(${r}, ${g}, ${bl}, ${alpha.toFixed(3)})`;
}

/**
 * Linearly interpolate between two numbers.
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Interpolate between two TimeColors palettes.
 * @param a - Start palette
 * @param b - End palette
 * @param t - Progress (0 = a, 1 = b)
 * @param corruptionIntensity - Current corruption level
 */
export function interpolateColors(
  a: TimeColors,
  b: TimeColors,
  t: number,
  corruptionIntensity: number = 0,
): DayNightAtmosphere {
  const clamped = Math.max(0, Math.min(1, t));

  // Interpolate ambient particle colors (take from whichever is dominant)
  const ambientParticleColors =
    clamped < 0.5 ? a.ambientParticleColors : b.ambientParticleColors;

  return {
    backgroundColor: lerpColor(a.backgroundColor, b.backgroundColor, clamped),
    lightTint: lerpRgba(a.lightTint, b.lightTint, clamped),
    ambientParticleColors,
    fogColor: lerpRgba(a.fogColor, b.fogColor, clamped),
    platformDarkness: lerp(a.platformDarkness, b.platformDarkness, clamped),
    corruptionIntensity,
    shadowOpacity: lerp(a.shadowOpacity, b.shadowOpacity, clamped),
  };
}
