// Surface Types — platform surface properties that modify player physics

export type SurfaceType = "normal" | "bouncy" | "icy" | "sticky" | "conveyor";

export interface SurfaceProperties {
  /** Type identifier */
  type: SurfaceType;
  /** Multiplier applied to player acceleration while on this surface (1.0 = normal) */
  accelerationMultiplier: number;
  /** Multiplier applied to player deceleration/friction (1.0 = normal) */
  frictionMultiplier: number;
  /** Multiplier applied to max run speed on this surface (1.0 = normal) */
  maxSpeedMultiplier: number;
  /** Bounce coefficient: velocity.y is multiplied by -bounce on landing (0 = no bounce) */
  bounce: number;
  /** Conveyor velocity added to the player each frame (px/s). Positive = right, negative = left. */
  conveyorSpeed: number;
  /** Whether the player can wall-slide on this surface type */
  wallSlidable: boolean;
  /** Multiplier for wall-slide friction (1.0 = normal grip) */
  wallFrictionMultiplier: number;
  /** Visual color for this surface type */
  color: string;
  /** Label for debug display */
  label: string;
}

export const SURFACE_PROPERTIES: Record<SurfaceType, SurfaceProperties> = {
  normal: {
    type: "normal",
    accelerationMultiplier: 1.0,
    frictionMultiplier: 1.0,
    maxSpeedMultiplier: 1.0,
    bounce: 0,
    conveyorSpeed: 0,
    wallSlidable: true,
    wallFrictionMultiplier: 1.0,
    color: "#4ade80",
    label: "Normal",
  },
  bouncy: {
    type: "bouncy",
    accelerationMultiplier: 0.8,
    frictionMultiplier: 0.6,
    maxSpeedMultiplier: 1.0,
    bounce: 0.85,
    conveyorSpeed: 0,
    wallSlidable: true,
    wallFrictionMultiplier: 0.3,
    color: "#f472b6",
    label: "Bouncy",
  },
  icy: {
    type: "icy",
    accelerationMultiplier: 0.25,
    frictionMultiplier: 0.08,
    maxSpeedMultiplier: 1.5,
    bounce: 0,
    conveyorSpeed: 0,
    wallSlidable: true,
    wallFrictionMultiplier: 0.15,
    color: "#67e8f9",
    label: "Icy",
  },
  sticky: {
    type: "sticky",
    accelerationMultiplier: 1.5,
    frictionMultiplier: 4.0,
    maxSpeedMultiplier: 0.5,
    bounce: 0,
    conveyorSpeed: 0,
    wallSlidable: true,
    wallFrictionMultiplier: 5.0,
    color: "#a78bfa",
    label: "Sticky",
  },
  conveyor: {
    type: "conveyor",
    accelerationMultiplier: 1.0,
    frictionMultiplier: 1.0,
    maxSpeedMultiplier: 1.0,
    bounce: 0,
    conveyorSpeed: 150,
    color: "#fb923c",
    label: "Conveyor",
    wallSlidable: true,
    wallFrictionMultiplier: 1.0,
  },
};

/** Get the surface properties for a given type, defaulting to normal */
export function getSurfaceProps(type: SurfaceType | undefined): SurfaceProperties {
  return SURFACE_PROPERTIES[type ?? "normal"];
}
