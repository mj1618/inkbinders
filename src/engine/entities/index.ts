// Entities — Player, enemies, bosses
export { Entity } from "./Entity";
export type { EntityConfig } from "./Entity";
export { EntityManager } from "./EntityManager";
export { Player, DEFAULT_PLAYER_PARAMS } from "./Player";
export type { PlayerParams } from "./Player";
export { Enemy } from "./Enemy";
export type { EnemyConfig, PlayerRef } from "./Enemy";
export { Reader } from "./enemies/Reader";
export { Binder } from "./enemies/Binder";
export { Proofwarden } from "./enemies/Proofwarden";
export {
  DEFAULT_READER_PARAMS,
  DEFAULT_BINDER_PARAMS,
  DEFAULT_PROOFWARDEN_PARAMS,
} from "./enemies/EnemyParams";
export type {
  ReaderParams,
  BinderParams,
  ProofwardenParams,
} from "./enemies/EnemyParams";
export { FootnoteGiant } from "./bosses/FootnoteGiant";
export { MisprintSeraph } from "./bosses/MisprintSeraph";
export type { DamageZone } from "./bosses/types";
export { DEFAULT_FOOTNOTE_GIANT_PARAMS } from "./bosses/FootnoteGiantParams";
export type { FootnoteGiantParams } from "./bosses/FootnoteGiantParams";
export { DEFAULT_MISPRINT_SERAPH_PARAMS } from "./bosses/MisprintSeraphParams";
export type { MisprintSeraphParams } from "./bosses/MisprintSeraphParams";
