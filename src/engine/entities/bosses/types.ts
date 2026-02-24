import type { Rect, Vec2 } from "@/lib/types";

export interface DamageZone {
  rect: Rect;
  damage: number;
  knockback: Vec2;
  type:
    | "slam"
    | "shockwave"
    | "ink-blot"
    | "stamp"
    | "sweep"
    | "beam"
    | "page"
    | "dive"
    | "floor"
    | "lunge"
    | "whip"
    | "spit"
    | "devour-shockwave"
    | "flood"
    | "pounce"
    | "chain-storm"
    | "thrash";
}
