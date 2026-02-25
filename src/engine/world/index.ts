// World — Room system, biomes, day-night cycle
export {
  type BiomeTheme,
  DEFAULT_THEME,
  SCRIBE_HALL_THEME,
  HERBARIUM_FOLIO_THEME,
  ASTRAL_ATLAS_THEME,
  MARITIME_LEDGER_THEME,
  GOTHIC_ERRATA_THEME,
  getBiomeTheme,
} from "./Biome";
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
  createMaritimeBackground,
  createGothicErrataBackground,
  createAstralAtlasBackground,
  createScribeHallBackground,
  createDefaultBackground,
  createBackgroundForBiome,
} from "./BiomeBackground";
export {
  type BackgroundLayerDef,
  BIOME_BACKGROUND_LAYERS,
  BIOME_BACKGROUND_CONFIGS,
  getBiomeBackgroundConfigs,
  getAllBiomeBackgroundConfigs,
  preloadBiomeBackground,
} from "./BiomeBackgroundSprites";
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
  type AbilityPickup,
  type EnemySpawn,
  type RoomVineAnchor,
  type GravityWellDef,
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
  renderAbilityPedestal,
} from "./RoomRenderer";
export { RoomEditor, type EditorTool } from "./RoomEditor";
export { PRESET_ROOMS, PRESET_ROOM_NAMES } from "./presetRooms";
export {
  FogSystem,
  type FogZone,
  type FogZoneType,
  type FogSystemParams,
  type FogState,
  DEFAULT_FOG_SYSTEM_PARAMS,
} from "./FogSystem";
export { SCRIBE_HALL } from "./scribeHall";
export { ARCHIVE_PASSAGE, DEMO_WORLD_DATA, createDemoWorld } from "./demoWorld";
export { CENTRAL_ARCHIVES_ROOMS, CENTRAL_ARCHIVES_ROOM_IDS } from "./centralArchivesRooms";
export { ABILITY_SHRINE_ROOMS, ABILITY_SHRINE_ROOM_IDS } from "./abilityShrineRooms";
export { ASTRAL_ATLAS_ROOMS, ASTRAL_ATLAS_ROOM_IDS } from "./astralAtlasRooms";
export {
  WORLD_OBJECT_SPRITE_CONFIGS,
  WORLD_OBJECT_ANIMATIONS,
  getWorldObjectConfigs,
  getWorldObjectAnimations,
  loadWorldObjectSprites,
  renderObstacleSprite,
  getGateFrameIndex,
  getExitArrowRotation,
} from "./WorldObjectSprites";
export { PlayerProgression, type PlayerProgressionData, type CardDeckData } from "./PlayerProgression";
export { WorldGraph, type WorldRegion, type WorldGraphData } from "./WorldGraph";
export { GameWorld, type GameWorldConfig, type WorldFrameState, type RoomTransitionResult } from "./GameWorld";
