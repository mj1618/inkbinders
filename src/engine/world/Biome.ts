// Biome — visual theme definitions for world areas

export interface BiomeTheme {
  /** Unique biome identifier */
  id: string;
  /** Display name */
  name: string;
  /** Background color (canvas clear color) */
  backgroundColor: string;
  /** Platform fill color */
  platformFillColor: string;
  /** Platform stroke color */
  platformStrokeColor: string;
  /** Ambient particle colors */
  ambientParticleColors: string[];
  /** How many ambient particles to spawn per second */
  ambientParticleRate: number;
  /** Foreground tint overlay (rgba, very low alpha) */
  foregroundTint: string;
  /** Color palette (4-6 colors used throughout the biome) */
  palette: string[];
}

export const ASTRAL_ATLAS_THEME: BiomeTheme = {
  id: "astral-atlas",
  name: "Astral Atlas",
  backgroundColor: "#0a0e1a",
  platformFillColor: "#1e293b",
  platformStrokeColor: "#475569",
  ambientParticleColors: ["#fbbf24", "#fde68a", "#818cf8", "#e0e7ff"],
  ambientParticleRate: 4,
  foregroundTint: "rgba(99, 102, 241, 0.03)",
  palette: [
    "#0a0e1a", // Deep navy (background)
    "#1e293b", // Slate blue (platforms)
    "#475569", // Medium slate (outlines)
    "#fbbf24", // Gold (stars, nodes)
    "#818cf8", // Indigo (gravity wells)
    "#f5f5dc", // Parchment (texture)
  ],
};

export const MARITIME_LEDGER_THEME: BiomeTheme = {
  id: "maritime-ledger",
  name: "Maritime Ledger",
  backgroundColor: "#0a1628",
  platformFillColor: "#1e3a5f",
  platformStrokeColor: "#3b6b9b",
  ambientParticleColors: ["#38bdf8", "#7dd3fc", "#fbbf24", "#bae6fd"],
  ambientParticleRate: 3,
  foregroundTint: "rgba(56, 189, 248, 0.03)",
  palette: [
    "#0a1628",  // Deep ocean navy (background)
    "#1e3a5f",  // Maritime blue (platforms)
    "#3b6b9b",  // Compass blue (outlines)
    "#38bdf8",  // Sky blue (currents, highlights)
    "#fbbf24",  // Gold (compass roses, markers)
    "#f5f5dc",  // Parchment (paper grain)
  ],
};

export const GOTHIC_ERRATA_THEME: BiomeTheme = {
  id: "gothic-errata",
  name: "Gothic Errata",
  backgroundColor: "#0d0a0a",
  platformFillColor: "#2d1f1f",
  platformStrokeColor: "#5c3a3a",
  ambientParticleColors: ["#4ade80", "#dc2626", "#a855f7", "#78716c"],
  ambientParticleRate: 3,
  foregroundTint: "rgba(220, 38, 38, 0.02)",
  palette: [
    "#0d0a0a",  // Charcoal (background)
    "#2d1f1f",  // Dark maroon (platforms)
    "#5c3a3a",  // Rusted crimson (outlines)
    "#dc2626",  // Blood red (corruption)
    "#4ade80",  // Sickly green (errata)
    "#d4c4a8",  // Stained parchment (texture)
  ],
};

export const HERBARIUM_FOLIO_THEME: BiomeTheme = {
  id: "herbarium-folio",
  name: "Herbarium Folio",
  backgroundColor: "#0a1a0f",
  platformFillColor: "#1a3a1a",
  platformStrokeColor: "#3b6b3b",
  ambientParticleColors: [
    "#4ade80", // Green (leaf)
    "#86efac", // Light green
    "#fbbf24", // Golden pollen
    "#a3e635", // Lime
  ],
  ambientParticleRate: 2,
  foregroundTint: "rgba(34, 197, 94, 0.03)",
  palette: [
    "#0a1a0f", // Deep dark green (background)
    "#1a3a1a", // Dark green (platforms)
    "#3b6b3b", // Medium green (outlines)
    "#4ade80", // Bright green (vines, highlights)
    "#fbbf24", // Golden (pollen, accents)
    "#f5f5dc", // Beige/parchment (paper texture)
  ],
};
