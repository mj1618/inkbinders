// World — Room system, biomes, day-night cycle
export { type BiomeTheme, HERBARIUM_FOLIO_THEME } from "./Biome";
export {
  VineSystem,
  type VineAnchor,
  type VineParams,
  DEFAULT_VINE_PARAMS,
} from "./VineSystem";
export {
  BiomeBackground,
  type BackgroundLayer,
  createHerbariumBackground,
} from "./BiomeBackground";
export {
  DayNightCycle,
  type TimeOfDay,
  type DayNightParams,
  DEFAULT_DAY_NIGHT_PARAMS,
} from "./DayNightCycle";
export {
  type DayNightAtmosphere,
  type TimeColors,
  DAY_COLORS,
  NIGHT_COLORS,
  DAWN_COLORS,
  DUSK_COLORS,
  lerpColor,
  lerpRgba,
  interpolateColors,
} from "./DayNightAtmosphere";
export {
  CorruptionModifiers,
  type CorruptionModifierType,
  type CorruptionModifier,
  type CorruptionParams,
  DEFAULT_CORRUPTION_PARAMS,
} from "./CorruptionModifiers";
export { DayNightRenderer } from "./DayNightRenderer";
export {
  type RoomData,
  type RoomId,
  type RoomPlatform,
  type RoomObstacle,
  type RoomExit,
  type AbilityGate,
  type EnemySpawn,
  type RoomVineAnchor,
  type ExitDirection,
  type GateAbility,
  GATE_COLORS,
  createEmptyRoom,
} from "./Room";
export { RoomManager, type RoomManagerConfig } from "./RoomManager";
export {
  renderGates,
  renderExitIndicators,
  renderBounds,
  renderTransitionOverlay,
  renderSpawnMarker,
  renderEnemyMarker,
  renderVineMarker,
} from "./RoomRenderer";
export { RoomEditor, type EditorTool } from "./RoomEditor";
export { PRESET_ROOMS, PRESET_ROOM_NAMES } from "./presetRooms";
