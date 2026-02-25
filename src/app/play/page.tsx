"use client";

import { Suspense, useRef, useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GameCanvas } from "@/components/canvas/GameCanvas";
import { Engine } from "@/engine/core/Engine";
import { Player, DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";
import { ParticleSystem } from "@/engine/core/ParticleSystem";
import { ScreenShake } from "@/engine/core/ScreenShake";
import { InputAction } from "@/engine/input/InputManager";
import type { InputManager } from "@/engine/input/InputManager";
import { CombatSystem } from "@/engine/combat/CombatSystem";
import { PlayerHealth } from "@/engine/combat/PlayerHealth";
import { TargetDummy } from "@/engine/combat/TargetDummy";
import type { AttackDirection, WeaponType } from "@/engine/combat/types";
import { MarginStitch } from "@/engine/abilities/MarginStitch";
import { Redaction } from "@/engine/abilities/Redaction";
import { PasteOver } from "@/engine/abilities/PasteOver";
import { IndexMark } from "@/engine/abilities/IndexMark";
import { DayNightCycle } from "@/engine/world/DayNightCycle";
import { CorruptionModifiers } from "@/engine/world/CorruptionModifiers";
import { DayNightRenderer } from "@/engine/world/DayNightRenderer";
import { GameHUD } from "@/engine/ui/GameHUD";
import { VictoryScreen } from "@/engine/ui/VictoryScreen";
import { RoomManager } from "@/engine/world/RoomManager";
import { VineSystem } from "@/engine/world/VineSystem";
import type { VineAnchor } from "@/engine/world/VineSystem";
import { GravityWellSystem, DEFAULT_GRAVITY_WELL_PARAMS } from "@/engine/world/GravityWellSystem";
import type { GravityWell } from "@/engine/world/GravityWellSystem";
import { CurrentSystem } from "@/engine/world/CurrentSystem";
import type { CurrentZone } from "@/engine/world/CurrentSystem";
import { FogSystem } from "@/engine/world/FogSystem";
import type { FogZone } from "@/engine/world/FogSystem";
import {
  renderGates,
  renderExitIndicators,
  renderTransitionOverlay,
  renderAbilityPedestal,
} from "@/engine/world/RoomRenderer";
import type { Obstacle } from "@/engine/physics/Obstacles";
import type { SurfaceType } from "@/engine/physics/Surfaces";
import { checkDamageOverlap } from "@/engine/physics/Obstacles";
import { GameSession } from "@/engine/core/GameSession";
import {
  CardModifierEngine,
  CraftingSystem,
  CardRenderer,
  createCard,
} from "@/engine/cards";
import { RenderConfig } from "@/engine/core/RenderConfig";
import { AssetManager } from "@/engine/core/AssetManager";
import { TILE_SPRITE_CONFIGS } from "@/engine/world/TileSprites";
import { PLAYER_SPRITE_CONFIGS } from "@/engine/entities/PlayerSprites";
import {
  READER_SPRITE_CONFIGS,
  BINDER_SPRITE_CONFIGS,
  PROOFWARDEN_SPRITE_CONFIGS,
} from "@/engine/entities/enemies/EnemySprites";
import {
  GIANT_SPRITE_CONFIGS,
  SERAPH_SPRITE_CONFIGS,
  EATER_SPRITE_CONFIGS,
} from "@/engine/entities/bosses/BossSprites";
import { COMBAT_VFX_CONFIGS } from "@/engine/combat/CombatSprites";
import { ABILITY_VFX_SPRITE_CONFIGS } from "@/engine/abilities/AbilitySprites";
import { HUD_SPRITE_CONFIGS } from "@/engine/ui/HUDSprites";
import { WORLD_OBJECT_SPRITE_CONFIGS } from "@/engine/world/WorldObjectSprites";
import { getAllBiomeBackgroundConfigs } from "@/engine/world/BiomeBackgroundSprites";
import type { LoadedGameState } from "@/engine/save/SaveSystem";
import { useSaveSlots } from "@/hooks/useSaveSlots";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/constants";
import type { Vec2 } from "@/lib/types";
import { GATE_COLORS } from "@/engine/world/Room";
import type { GateAbility } from "@/engine/world/Room";
import { HealthPickupManager } from "@/engine/world/HealthPickup";
import { createFullWorld } from "@/engine/world/demoWorld";

// ─── Constants ──────────────────────────────────────────────────────

const LOADING_MIN_MS = 500;
const SAVE_NOTIFICATION_FRAMES = 90;
const RESPAWN_Y_MARGIN = 200;

const PAUSE_OPTIONS = ["Resume", "Save Game", "Save & Quit", "Quit"] as const;
type PauseOption = (typeof PAUSE_OPTIONS)[number];

// ─── Helpers ────────────────────────────────────────────────────────

function getAttackDirection(
  input: InputManager,
  facingRight: boolean
): AttackDirection {
  const up = input.isHeld(InputAction.Up);
  const down = input.isHeld(InputAction.Down);
  const left = input.isHeld(InputAction.Left);
  const right = input.isHeld(InputAction.Right);

  if (up && right) return "up-right";
  if (up && left) return "up-left";
  if (down && right) return "down-right";
  if (down && left) return "down-left";
  if (up) return "up";
  if (down) return "down";
  if (right) return "right";
  if (left) return "left";
  return facingRight ? "right" : "left";
}

function getAimDirection(input: InputManager, facingRight: boolean): Vec2 {
  const up = input.isHeld(InputAction.Up);
  const down = input.isHeld(InputAction.Down);
  const left = input.isHeld(InputAction.Left);
  const right = input.isHeld(InputAction.Right);

  let dx = 0;
  let dy = 0;
  if (right) dx = 1;
  else if (left) dx = -1;
  if (up) dy = -1;
  else if (down) dy = 1;

  if (dx === 0 && dy === 0) dx = facingRight ? 1 : -1;

  const len = Math.sqrt(dx * dx + dy * dy);
  return { x: dx / len, y: dy / len };
}

// ─── Custom Pause Menu Renderer ─────────────────────────────────────

function renderPlayPauseMenu(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  selection: number,
  saveNotifyFrames: number
): void {
  ctx.save();

  // Overlay
  ctx.fillStyle = `rgba(0, 0, 0, 0.7)`;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const menuWidth = 240;
  const menuHeight = 180;
  const mx = (canvasWidth - menuWidth) / 2;
  const my = (canvasHeight - menuHeight) / 2;

  // Background
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(mx, my, menuWidth, menuHeight);

  // Border
  ctx.strokeStyle = "#4b5563";
  ctx.lineWidth = 2;
  ctx.strokeRect(mx, my, menuWidth, menuHeight);

  // Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px monospace";
  ctx.textAlign = "center";
  ctx.fillText("PAUSED", mx + menuWidth / 2, my + 32);

  // Divider
  ctx.strokeStyle = "#374151";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(mx + 16, my + 44);
  ctx.lineTo(mx + menuWidth - 16, my + 44);
  ctx.stroke();

  // Options
  ctx.font = "14px monospace";
  for (let i = 0; i < PAUSE_OPTIONS.length; i++) {
    const optY = my + 66 + i * 24;
    const selected = i === selection;

    if (selected) {
      ctx.fillStyle = "rgba(75, 85, 99, 0.4)";
      ctx.fillRect(mx + 16, optY - 14, menuWidth - 32, 22);
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.fillText(`▸ ${PAUSE_OPTIONS[i]}`, mx + menuWidth / 2, optY);
    } else {
      ctx.fillStyle = "#9ca3af";
      ctx.textAlign = "center";
      ctx.fillText(PAUSE_OPTIONS[i], mx + menuWidth / 2, optY);
    }
  }

  // Save notification
  if (saveNotifyFrames > 0) {
    const alpha = Math.min(1, saveNotifyFrames / 20);
    ctx.fillStyle = `rgba(34, 197, 94, ${alpha})`;
    ctx.font = "bold 12px monospace";
    ctx.fillText("Saved!", mx + menuWidth / 2, my + menuHeight - 10);
  } else {
    ctx.fillStyle = "#6b7280";
    ctx.font = "10px monospace";
    ctx.fillText(
      "\u2191\u2193 Navigate  \u23CE Confirm  ESC Resume",
      mx + menuWidth / 2,
      my + menuHeight - 10
    );
  }

  ctx.restore();
}

// ─── Confirm Quit Overlay ──────────────────────────────────────────

function renderConfirmQuit(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  selection: number
): void {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const w = 280;
  const h = 100;
  const mx = (canvasWidth - w) / 2;
  const my = (canvasHeight - h) / 2;

  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(mx, my, w, h);
  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 2;
  ctx.strokeRect(mx, my, w, h);

  ctx.fillStyle = "#fca5a5";
  ctx.font = "13px monospace";
  ctx.textAlign = "center";
  ctx.fillText("Quit without saving?", mx + w / 2, my + 30);

  const opts = ["Cancel", "Quit"];
  for (let i = 0; i < opts.length; i++) {
    const ox = mx + w / 2 - 60 + i * 120;
    const oy = my + 65;
    const selected = i === selection;
    ctx.fillStyle = selected ? "#ffffff" : "#9ca3af";
    ctx.font = selected ? "bold 13px monospace" : "13px monospace";
    ctx.fillText(selected ? `▸ ${opts[i]}` : opts[i], ox, oy);
  }

  ctx.restore();
}

// ─── Page Component ────────────────────────────────────────────────

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-950">
          <p className="animate-pulse font-mono text-zinc-500">Loading...</p>
        </div>
      }
    >
      <PlayPageInner />
    </Suspense>
  );
}

function PlayPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { save, load } = useSaveSlots();

  const slotParam = searchParams.get("slot");
  const isNew = searchParams.get("new") === "1";
  const devMode = searchParams.get("dev") === "1";
  const slot = slotParam ? parseInt(slotParam, 10) : 0;

  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState({ loaded: 0, total: 0 });

  const engineRef = useRef<Engine | null>(null);
  const sessionRef = useRef<GameSession | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const saveCallbackRef = useRef(save);
  saveCallbackRef.current = save;

  // Redirect if no slot
  useEffect(() => {
    if (!slotParam || slot < 1 || slot > 3) {
      router.replace("/");
    }
  }, [slotParam, slot, router]);

  // ─── Save Helper ──────────────────────────────────────────────────

  const doSave = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    const snapshot = session.createSaveSnapshot();
    await saveCallbackRef.current(session.config.slot, snapshot);
  }, []);

  // ─── Engine Mount ─────────────────────────────────────────────────

  const handleMount = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      // Play page defaults to sprites mode (with placeholder fallback)
      RenderConfig.setMode("sprites");
      const loadStartTime = Date.now();

      (async () => {
        try {
          // Load save data
          let loadedState: LoadedGameState | null = null;
          let playerName = "Archivist";

          if (!isNew) {
            loadedState = await load(slot);
            if (!loadedState) {
              setLoadError("No save data found for this slot.");
              return;
            }
            playerName = loadedState.playerName;
          } else {
            // For new games the title screen already created a minimal save
            loadedState = await load(slot);
            if (loadedState) {
              playerName = loadedState.playerName;
            }
          }

          // Create session
          const session = new GameSession({
            slot,
            playerName,
            isNewGame: isNew,
            loadedState: isNew ? null : loadedState,
            devAllAbilities: devMode,
          });
          sessionRef.current = session;

          // Build rooms map from full world
          const { worldGraph, rooms } = createFullWorld();

          const startingRoomId = session.getStartingRoomId();

          const roomManager = new RoomManager({
            rooms,
            startingRoomId,
          });

          // Sync saved progression state into room manager
          const savedState = session.getState();
          const needsReload =
            savedState.defeatedBosses.length > 0 ||
            savedState.openedGates.length > 0;
          if (savedState.defeatedBosses.length > 0) {
            roomManager.syncDefeatedBosses(savedState.defeatedBosses);
          }
          if (savedState.openedGates.length > 0) {
            roomManager.syncOpenedGates(savedState.openedGates);
          }
          if (needsReload) {
            // Reload starting room so boss gates and ability gates reflect saved state
            roomManager.loadRoom(startingRoomId);
          }

          // Dev-mode world graph validation
          if (process.env.NODE_ENV === "development") {
            const validation = worldGraph.validate();
            if (validation.errors.length > 0) {
              console.error("[WorldGraph] Validation errors:", validation.errors);
            }
            if (validation.warnings.length > 0) {
              console.warn(`[WorldGraph] ${validation.warnings.length} warnings (${validation.stats.totalRooms} rooms, ${validation.stats.bidirectionalExits} bidirectional exits)`);
            }
          }

          // Load all sprite assets (placeholders used if images are missing)
          const allSpriteConfigs = [
            ...TILE_SPRITE_CONFIGS,
            ...PLAYER_SPRITE_CONFIGS,
            ...READER_SPRITE_CONFIGS,
            ...BINDER_SPRITE_CONFIGS,
            ...PROOFWARDEN_SPRITE_CONFIGS,
            ...GIANT_SPRITE_CONFIGS,
            ...SERAPH_SPRITE_CONFIGS,
            ...EATER_SPRITE_CONFIGS,
            ...COMBAT_VFX_CONFIGS,
            ...ABILITY_VFX_SPRITE_CONFIGS,
            ...HUD_SPRITE_CONFIGS,
            ...WORLD_OBJECT_SPRITE_CONFIGS,
            ...getAllBiomeBackgroundConfigs(),
          ];

          const am = AssetManager.getInstance();
          const loadPromise = am.loadAll(allSpriteConfigs);

          // Poll progress while assets load
          const progressInterval = setInterval(() => {
            setLoadProgress(am.getLoadProgress());
          }, 100);

          await loadPromise;
          clearInterval(progressInterval);
          setLoadProgress(am.getLoadProgress());

          // Engine setup
          const engine = new Engine({ ctx });
          const camera = engine.getCamera();
          const input = engine.getInput();

          camera.bounds = {
            x: 0,
            y: 0,
            width: roomManager.currentRoom.width,
            height: roomManager.currentRoom.height,
          };

          // Player
          const player = new Player();
          const spawn = roomManager.currentRoom.defaultSpawn;
          player.position.x = spawn.x;
          player.position.y = spawn.y;
          player.input = input;
          player.tileMap = roomManager.currentTileMap;

          const particleSystem = new ParticleSystem();
          const screenShake = new ScreenShake();
          player.particleSystem = particleSystem;
          player.screenShake = screenShake;

          engine.getEntities().add(player);

          // Combat
          const combat = new CombatSystem();
          const playerHealth = new PlayerHealth({ maxHealth: 5 });
          if (loadedState && !isNew) {
            playerHealth.health = loadedState.currentHealth;
            playerHealth.maxHealth = loadedState.maxHealth;
          }
          let selectedWeapon: WeaponType = "quill-spear";

          // Abilities
          const marginStitch = new MarginStitch();
          marginStitch.setTileMap(roomManager.currentTileMap);
          marginStitch.particleSystem = particleSystem;

          const redaction = new Redaction();
          redaction.particleSystem = particleSystem;

          const pasteOver = new PasteOver();

          const indexMark = new IndexMark();
          indexMark.particleSystem = particleSystem;

          // Day/Night
          const dayNight = new DayNightCycle({
            cycleDuration: 120,
            timeScale: 1.0,
          });

          // HUD — use GameHUD for non-pause elements
          const hud = new GameHUD(
            {
              health: playerHealth,
              combat,
              marginStitch,
              redaction,
              pasteOver,
              indexMark,
              dayNight,
              input,
            },
            {
              showHealth: true,
              showAbilities: true,
              showWeapon: true,
              showClock: true,
              showRoomName: true,
              showMinimap: false,
              showNotifications: true,
            }
          );

          // Use RoomManager's authoritative obstacle list directly
          // (Redaction modifies .active on these objects in-place)
          let currentObstacles: Obstacle[] = roomManager.currentObstacles;

          // Dummies from room's enemy spawns
          let dummies: TargetDummy[] = roomManager.currentEnemies.map(
            (e) =>
              new TargetDummy({
                position: { x: e.position.x, y: e.position.y },
                health: e.type === "boss" ? 10 : 3,
                color: "#ef4444",
                respawns: e.type !== "boss",
                respawnDelay: 300,
                patrol: !!e.patrolRange,
                patrolRange: e.patrolRange ?? 0,
                patrolSpeed: 40,
                groundY: e.groundY ?? e.position.y,
              })
          );

          // Track boss dummies → bossId mapping for defeat detection
          let bossDummies = new Map<string, string>();
          roomManager.currentEnemies.forEach((e, i) => {
            if (e.type === "boss" && e.bossId) {
              bossDummies.set(dummies[i].id, e.bossId);
            }
          });

          // Health pickups
          let pickupManager = new HealthPickupManager(
            roomManager.currentRoom.healthPickups ?? []
          );

          // Corruption modifiers (night effects)
          const corruption = new CorruptionModifiers();
          const baseRiseGravity = player.params.riseGravity;
          const baseFallGravity = player.params.fallGravity;
          let originalSurfaces: string[] = [];
          let effectiveCorruption = 0;

          // Biome systems
          let vineSystem: VineSystem | null = null;
          let gravityWellSystem: GravityWellSystem | null = null;
          let currentSystem: CurrentSystem | null = null;
          let fogSystem: FogSystem | null = null;

          // Build initial biome systems for starting room
          const buildBiomeSystems = (room: typeof roomManager.currentRoom) => {
            // Vine system (Herbarium Wing)
            vineSystem = null;
            if (room.vineAnchors.length > 0) {
              vineSystem = new VineSystem(
                room.vineAnchors.map((a): VineAnchor => ({
                  id: a.id,
                  position: a.position,
                  ropeLength: a.ropeLength,
                  active: true,
                  type: a.type,
                }))
              );
            }

            // Gravity well system (Astral Atlas)
            gravityWellSystem = null;
            if (room.gravityWells?.length) {
              gravityWellSystem = new GravityWellSystem(
                room.gravityWells.map((w): GravityWell => ({
                  id: w.id,
                  position: w.position,
                  radius: w.radius,
                  strength: w.strength,
                  type: w.type,
                  active: true,
                  color: w.type === "attract" ? "#818cf8" : "#f472b6",
                })),
                { ...DEFAULT_GRAVITY_WELL_PARAMS },
              );
            }

            // Current system (Maritime Ledger)
            currentSystem = null;
            if (room.currentZones?.length) {
              currentSystem = new CurrentSystem(
                room.currentZones.map((z): CurrentZone => ({
                  id: z.id,
                  rect: z.rect,
                  direction: z.direction,
                  strength: z.strength,
                  active: true,
                  type: z.type,
                  clockwise: z.clockwise,
                  gustOnDuration: z.gustOnDuration,
                  gustOffDuration: z.gustOffDuration,
                }))
              );
            }

            // Fog system (Gothic Errata)
            fogSystem = null;
            if (room.fogZones?.length) {
              fogSystem = new FogSystem(
                room.fogZones.map((z): FogZone => ({
                  id: z.id,
                  rect: z.rect,
                  type: z.type,
                  density: z.density,
                  active: true,
                }))
              );
            }
          };
          buildBiomeSystems(roomManager.currentRoom);
          originalSurfaces = roomManager.currentTileMap.platforms.map(
            (p) => p.surfaceType ?? "normal"
          );

          // Pause state (managed here, not by GameHUD)
          let paused = false;
          let pauseSelection = 0;
          let saveNotifyFrames = 0;
          let confirmingQuit = false;
          let confirmQuitSelection = 0;

          // Victory state
          let victoryTriggered = false;
          let victoryScreen: VictoryScreen | null = null;

          // ─── Card System ───────────────────────────────────────
          const cardEngine = new CardModifierEngine();
          const crafting = new CraftingSystem();

          // Restore cards from save
          if (loadedState && !isNew) {
            for (const cardStr of loadedState.ownedCards) {
              const [defId, tierStr] = cardStr.split(":");
              const tier = (parseInt(tierStr) || 1) as 1 | 2 | 3;
              cardEngine.addToCollection(createCard(defId, tier));
            }
            for (const cardStr of loadedState.equippedCards) {
              const [defId, tierStr] = cardStr.split(":");
              const tier = (parseInt(tierStr) || 1) as 1 | 2 | 3;
              const deck = cardEngine.getDeck();
              const match = deck.collection.find(
                (c) => c.definitionId === defId && c.tier === tier && !deck.equippedIds.includes(c.id)
              );
              if (match) cardEngine.equipCard(match.id);
            }
          }

          // Base params snapshot (before any card modifiers)
          const basePlayerParams = { ...player.params };
          const baseCombatParams = { ...combat.params };
          const baseHealthParams = { ...playerHealth.params };

          // Deck UI state
          let deckMode = false;
          const deckUI = {
            selectedCollectionIndex: 0,
            selectedRecipeIndex: 0,
            collectionScrollOffset: 0,
            activePanel: "collection" as "collection" | "crafting",
          };

          // Track which rooms have had their card collected
          const collectedCardRooms = new Set<string>();
          if (loadedState && !isNew) {
            const loadedCardStrings = new Set(loadedState.ownedCards);
            for (const [roomId, roomData] of rooms) {
              if (roomData.cardDrop) {
                const key = `${roomData.cardDrop.definitionId}:${roomData.cardDrop.tier}`;
                if (loadedCardStrings.has(key)) {
                  collectedCardRooms.add(roomId);
                }
              }
            }
          }

          // Card save sync helper
          function syncCardStateToSession() {
            const deck = cardEngine.getDeck();
            const ownedCards = deck.collection.map((c) => `${c.definitionId}:${c.tier}`);
            const equippedCards = deck.collection
              .filter((c) => deck.equippedIds.includes(c.id))
              .map((c) => `${c.definitionId}:${c.tier}`);
            session.setCardDeckData({ ownedCards, equippedCards });
          }

          // Time tracking for session
          let time = 0;
          let lastDt = 1 / 60;

          // Store ref
          engineRef.current = engine;

          // Show initial room name
          const roomName = roomManager.currentRoom.name ?? roomManager.currentRoom.id;
          hud.showRoomName(roomName);
          session.enterRoom(roomManager.currentRoom.id, roomName);

          // ─── Helper: rebuild room systems after transition ────

          const rebuildRoomSystems = () => {
            player.active = true; // Ensure player is active after room transition
            player.tileMap = roomManager.currentTileMap;
            marginStitch.setTileMap(roomManager.currentTileMap);

            camera.bounds = {
              x: 0,
              y: 0,
              width: roomManager.currentRoom.width,
              height: roomManager.currentRoom.height,
            };

            currentObstacles = roomManager.currentObstacles;

            dummies = roomManager.currentEnemies.map(
              (e) =>
                new TargetDummy({
                  position: { x: e.position.x, y: e.position.y },
                  health: e.type === "boss" ? 10 : 3,
                  color: "#ef4444",
                  respawns: e.type !== "boss",
                  respawnDelay: 300,
                  patrol: !!e.patrolRange,
                  patrolRange: e.patrolRange ?? 0,
                  patrolSpeed: 40,
                  groundY: e.groundY ?? e.position.y,
                })
            );

            // Rebuild boss dummy tracking
            bossDummies = new Map<string, string>();
            roomManager.currentEnemies.forEach((e, i) => {
              if (e.type === "boss" && e.bossId) {
                bossDummies.set(dummies[i].id, e.bossId);
              }
            });

            pickupManager = new HealthPickupManager(
              roomManager.currentRoom.healthPickups ?? []
            );

            // Rebuild biome systems for new room
            buildBiomeSystems(roomManager.currentRoom);

            // Reset corruption state for new room
            corruption.reset();
            originalSurfaces = roomManager.currentTileMap.platforms.map(
              (p) => p.surfaceType ?? "normal"
            );

            // Clear fog input remap when leaving a fog room
            input.setActionRemap(null);
          };

          // ─── Deck Mode Key Handling ──────────────────────────
          let deckTabPressed = false;
          let deckKeyQueue: string[] = [];
          const deckKeyHandler = (e: KeyboardEvent) => {
            if (e.key === "Tab") {
              e.preventDefault();
              deckTabPressed = true;
            }
            if (deckMode) {
              e.preventDefault();
              deckKeyQueue.push(e.key);
            }
          };
          window.addEventListener("keydown", deckKeyHandler);
          cleanupRef.current = () => window.removeEventListener("keydown", deckKeyHandler);

          // ─── Update Callback ──────────────────────────────────

          engine.onUpdate((dt) => {
            time += dt;
            lastDt = dt;

            // Victory screen takes priority over everything
            if (victoryScreen) {
              const anyKey =
                input.isPressed(InputAction.Jump) ||
                input.isPressed(InputAction.Attack) ||
                input.isPressed(InputAction.Dash) ||
                input.isPressed(InputAction.Pause) ||
                input.isPressed(InputAction.Left) ||
                input.isPressed(InputAction.Right) ||
                input.isPressed(InputAction.Up) ||
                input.isPressed(InputAction.Down);
              victoryScreen.update(dt, anyKey);
              if (victoryScreen.done) {
                engine.stop();
                router.push("/");
              }
              return;
            }

            // ─── Deck Mode ──────────────────────────────────────
            if (deckTabPressed) {
              deckTabPressed = false;
              if (!paused) {
                deckMode = !deckMode;
                if (deckMode) {
                  deckUI.selectedCollectionIndex = 0;
                  deckUI.selectedRecipeIndex = 0;
                  deckUI.activePanel = "collection";
                }
              }
            }

            if (deckMode) {
              // Process queued keys for deck UI navigation
              for (const key of deckKeyQueue) {
                if (key === "Escape") {
                  deckMode = false;
                  break;
                }
                const deck = cardEngine.getDeck();
                if (key === "ArrowLeft" || key === "ArrowRight") {
                  deckUI.activePanel = deckUI.activePanel === "collection" ? "crafting" : "collection";
                }
                if (deckUI.activePanel === "collection") {
                  if (key === "ArrowUp") {
                    deckUI.selectedCollectionIndex = Math.max(0, deckUI.selectedCollectionIndex - 1);
                  }
                  if (key === "ArrowDown") {
                    deckUI.selectedCollectionIndex = Math.min(
                      deck.collection.length - 1,
                      deckUI.selectedCollectionIndex + 1
                    );
                  }
                  if (key === "Enter" && deck.collection[deckUI.selectedCollectionIndex]) {
                    const card = deck.collection[deckUI.selectedCollectionIndex];
                    if (deck.equippedIds.includes(card.id)) {
                      cardEngine.unequipCard(card.id);
                    } else {
                      cardEngine.equipCard(card.id);
                    }
                  }
                } else {
                  // Crafting panel
                  const recipes = crafting.getAvailableCrafts(deck.collection);
                  if (key === "ArrowUp") {
                    deckUI.selectedRecipeIndex = Math.max(0, deckUI.selectedRecipeIndex - 1);
                  }
                  if (key === "ArrowDown") {
                    deckUI.selectedRecipeIndex = Math.min(
                      recipes.length - 1,
                      deckUI.selectedRecipeIndex + 1
                    );
                  }
                  if ((key === "c" || key === "C") && recipes[deckUI.selectedRecipeIndex]) {
                    const recipe = recipes[deckUI.selectedRecipeIndex];
                    const result = crafting.craft(deck.collection, recipe);
                    if (result) {
                      for (const consumed of result.consumed) {
                        cardEngine.removeFromCollection(consumed.id);
                      }
                      cardEngine.addToCollection(result.produced);
                      hud.notify(`Crafted ${result.produced.name} T${result.produced.tier}!`, "item");
                    }
                  }
                }
              }
              deckKeyQueue = [];
              hud.update(dt);
              return; // Skip game logic when deck is open
            }
            deckKeyQueue = [];

            // Save notification decay
            if (saveNotifyFrames > 0) saveNotifyFrames--;

            // ─── Pause handling ─────────────────────────────────
            if (input.isPressed(InputAction.Pause)) {
              if (confirmingQuit) {
                confirmingQuit = false;
              } else if (paused) {
                paused = false;
                session.paused = false;
              } else {
                paused = true;
                session.paused = true;
                pauseSelection = 0;
              }
            }

            if (paused) {
              if (confirmingQuit) {
                // Confirm quit dialog
                if (input.isPressed(InputAction.Left)) {
                  confirmQuitSelection = 0;
                }
                if (input.isPressed(InputAction.Right)) {
                  confirmQuitSelection = 1;
                }
                if (
                  input.isPressed(InputAction.Jump) ||
                  input.isPressed(InputAction.Attack)
                ) {
                  if (confirmQuitSelection === 0) {
                    // Cancel
                    confirmingQuit = false;
                  } else {
                    // Quit without saving
                    engine.stop();
                    router.push("/");
                    return;
                  }
                }
              } else {
                // Pause menu navigation
                if (input.isPressed(InputAction.Up)) {
                  pauseSelection = Math.max(0, pauseSelection - 1);
                }
                if (input.isPressed(InputAction.Down)) {
                  pauseSelection = Math.min(
                    PAUSE_OPTIONS.length - 1,
                    pauseSelection + 1
                  );
                }
                if (
                  input.isPressed(InputAction.Jump) ||
                  input.isPressed(InputAction.Attack)
                ) {
                  const action = PAUSE_OPTIONS[pauseSelection] as PauseOption;
                  switch (action) {
                    case "Resume":
                      paused = false;
                      session.paused = false;
                      break;
                    case "Save Game":
                      session.setHealth(playerHealth.health, playerHealth.maxHealth);
                      syncCardStateToSession();
                      doSave();
                      saveNotifyFrames = SAVE_NOTIFICATION_FRAMES;
                      hud.notify("Game saved!", "info");
                      break;
                    case "Save & Quit":
                      session.setHealth(playerHealth.health, playerHealth.maxHealth);
                      syncCardStateToSession();
                      doSave().then(() => {
                        engine.stop();
                        router.push("/");
                      });
                      return;
                    case "Quit":
                      confirmingQuit = true;
                      confirmQuitSelection = 0;
                      break;
                  }
                }
              }

              hud.update(dt);
              return;
            }

            // ─── Game logic (unpaused) ──────────────────────────

            // Room transitions
            if (roomManager.transitioning) {
              const result = roomManager.updateTransition(dt);
              if (result) {
                player.position.x = result.spawnX;
                player.position.y = result.spawnY;
                player.velocity.x = 0;
                player.velocity.y = 0;
                player.grounded = false;

                rebuildRoomSystems();

                const transRoom = rooms.get(result.roomId);
                const newRoomName = transRoom?.name ?? result.roomId;
                hud.showRoomName(newRoomName);
                session.enterRoom(result.roomId, newRoomName);

                // Auto-open gates the player has abilities for
                const abilities = session.getUnlockedAbilities();
                for (const gate of roomManager.currentGates) {
                  if (!gate.opened && abilities.has(gate.requiredAbility)) {
                    roomManager.tryOpenGate(gate, abilities as Set<GateAbility>);
                    session.openGate(gate.id);
                  }
                }
                // Rebuild originalSurfaces after gate opens may have spliced platforms
                originalSurfaces = roomManager.currentTileMap.platforms.map(
                  (p) => p.surfaceType ?? "normal"
                );

                camera.snapTo({
                  x: player.position.x + player.size.x / 2,
                  y: player.position.y + player.size.y / 2,
                });

                // Auto-save on room transition
                session.setHealth(playerHealth.health, playerHealth.maxHealth);
                syncCardStateToSession();
                doSave();
                hud.notify("Auto-saved", "info");

                // Victory check: all 3 main bosses defeated + entered hub
                if (!victoryTriggered && result.roomId === "scribe-hall") {
                  const defeated = session.getState().defeatedBosses;
                  const allBossesDefeated =
                    defeated.includes("footnote-giant") &&
                    defeated.includes("misprint-seraph") &&
                    defeated.includes("index-eater");
                  if (allBossesDefeated) {
                    // Auto-save final state
                    syncCardStateToSession();
                    doSave().catch(() => {});
                    victoryTriggered = true;
                    const state = session.getState();
                    victoryScreen = new VictoryScreen({
                      playerName: state.playerName,
                      playTimeSeconds: state.totalPlayTime,
                      deaths: state.deathCount,
                      roomsVisited: state.visitedRooms.length,
                      totalRooms: rooms.size,
                      abilitiesUnlocked: state.unlockedAbilities.length,
                      cardsCollected: state.cardDeckData?.ownedCards.length ?? 0,
                      completionPercent: state.completionPercent,
                    });
                  }
                }
              }
              hud.update(dt);
              return;
            }

            // Exit detection
            const playerRect = player.getBounds();
            const exit = roomManager.checkExits(playerRect);
            if (exit) {
              roomManager.startTransition(exit);
            }

            // Card pickup check
            const currentRoom = roomManager.currentRoom;
            if (currentRoom.cardDrop && !collectedCardRooms.has(currentRoom.id)) {
              const drop = currentRoom.cardDrop;
              const dropRect = { x: drop.position.x - 16, y: drop.position.y - 16, width: 32, height: 32 };
              if (
                playerRect.x < dropRect.x + dropRect.width &&
                playerRect.x + playerRect.width > dropRect.x &&
                playerRect.y < dropRect.y + dropRect.height &&
                playerRect.y + playerRect.height > dropRect.y
              ) {
                const card = createCard(drop.definitionId, drop.tier);
                cardEngine.addToCollection(card);
                collectedCardRooms.add(currentRoom.id);
                hud.notify(`Ink Card Found: ${card.name}`, "item");
              }
            }

            // Check ability pickups
            const pickup = roomManager.currentRoom.abilityPickup;
            if (pickup && !session.hasAbility(pickup.ability)) {
              const pz = pickup.zone;
              const pb = playerRect;
              const overlaps =
                pb.x < pz.x + pz.width &&
                pb.x + pb.width > pz.x &&
                pb.y < pz.y + pz.height &&
                pb.y + pb.height > pz.y;
              if (overlaps) {
                session.unlockAbility(pickup.ability);
                const abilityNames: Record<GateAbility, string> = {
                  "margin-stitch": "Margin Stitch",
                  "redaction": "Redaction",
                  "paste-over": "Paste-Over",
                  "index-mark": "Index Mark",
                };
                const keyBinds: Record<GateAbility, string> = {
                  "margin-stitch": "E",
                  "redaction": "Q",
                  "paste-over": "R",
                  "index-mark": "F",
                };
                hud.notify(
                  `${abilityNames[pickup.ability]} Acquired — Press [${keyBinds[pickup.ability]}] to use`,
                  "ability",
                );
                particleSystem.emit({
                  x: pickup.position.x,
                  y: pickup.position.y,
                  count: 20,
                  speedMin: 60,
                  speedMax: 160,
                  angleMin: 0,
                  angleMax: Math.PI * 2,
                  lifeMin: 0.3,
                  lifeMax: 0.8,
                  sizeMin: 2,
                  sizeMax: 5,
                  colors: [GATE_COLORS[pickup.ability], "#ffffff", "#e0e7ff"],
                  gravity: -40,
                });
              }
            }

            // Auto-open gates near player
            const abilities = session.getUnlockedAbilities();
            for (const gate of roomManager.currentGates) {
              if (!gate.opened) {
                const gateRect = gate.rect;
                const nearGate =
                  Math.abs(
                    player.position.x +
                      player.size.x / 2 -
                      (gateRect.x + gateRect.width / 2)
                  ) < 60 &&
                  Math.abs(
                    player.position.y +
                      player.size.y / 2 -
                      (gateRect.y + gateRect.height / 2)
                  ) < 80;
                if (nearGate) {
                  if (
                    roomManager.tryOpenGate(
                      gate,
                      abilities as Set<GateAbility>
                    )
                  ) {
                    session.openGate(gate.id);
                    hud.notify(`Gate opened!`, "gate");
                    // Rebuild originalSurfaces after platform splice
                    originalSurfaces = roomManager.currentTileMap.platforms.map(
                      (p) => p.surfaceType ?? "normal"
                    );
                  }
                }
              }
            }

            // Fall off respawn
            if (
              player.position.y >
              roomManager.currentRoom.height + RESPAWN_Y_MARGIN
            ) {
              // Detach from vine if swinging
              if (vineSystem?.isSwinging) {
                vineSystem.detach();
              }
              player.active = true;
              const sp = roomManager.currentRoom.defaultSpawn;
              player.position.x = sp.x;
              player.position.y = sp.y;
              player.velocity.x = 0;
              player.velocity.y = 0;
              player.grounded = false;
              playerHealth.takeDamage(1, { x: 0, y: -0.3 }, "fall");
              session.recordDeath();
              input.setActionRemap(null);
            }

            // Camera follow — track swing position when on vine
            const vineActive = vineSystem?.isSwinging ?? false;
            const playerCenter: Vec2 = vineActive
              ? { x: vineSystem!.swingPosition.x, y: vineSystem!.swingPosition.y }
              : {
                  x: player.position.x + player.size.x / 2,
                  y: player.position.y + player.size.y / 2,
                };
            const camVelocity = vineActive
              ? vineSystem!.swingVelocity
              : player.velocity;
            camera.follow(playerCenter, camVelocity, dt);

            // ─── Card Stat Modifiers ─────────────────────────────
            // Apply card modifiers BEFORE biome systems so that gravity wells
            // and corruption can override gravity params afterwards.
            if (cardEngine.getDeck().equippedIds.length > 0) {
              const modifiedPlayer = cardEngine.applyToPlayerParams(basePlayerParams);
              Object.assign(player.params, modifiedPlayer);
              player.size.x = player.params.playerWidth;

              const modifiedCombat = cardEngine.applyToCombatParams(baseCombatParams);
              Object.assign(combat.params, modifiedCombat);

              const modifiedHealth = cardEngine.applyToHealthParams(baseHealthParams);
              playerHealth.params = modifiedHealth;
              playerHealth.maxHealth = modifiedHealth.maxHealth;
              if (playerHealth.health > playerHealth.maxHealth) {
                playerHealth.health = playerHealth.maxHealth;
              }
            }

            // ─── Biome Systems ───────────────────────────────────

            const playerState = player.stateMachine.getCurrentState();

            // Vine system (Herbarium Wing)
            if (vineSystem) {
              vineSystem.swayTime += dt;
              if (vineSystem.isSwinging) {
                // Suppress normal player physics while swinging
                player.active = false;

                // Check detach: jump or dash
                let shouldDetach = false;
                if (input.isPressed(InputAction.Jump) || input.isPressed(InputAction.Up)) {
                  shouldDetach = true;
                }
                if (input.isPressed(InputAction.Dash) && player.dashAvailable) {
                  shouldDetach = true;
                }

                if (shouldDetach) {
                  const releaseVel = vineSystem.detach();
                  player.velocity.x = releaseVel.x;
                  player.velocity.y = releaseVel.y;
                  player.grounded = false;
                  player.active = true;
                } else {
                  // Update swing physics
                  const newPos = vineSystem.update(
                    dt,
                    input.isHeld(InputAction.Left),
                    input.isHeld(InputAction.Right),
                    input.isHeld(InputAction.Up),
                    input.isHeld(InputAction.Down),
                  );

                  // Check collision with platforms — auto-detach if swinging into a wall
                  const swingBounds = {
                    x: newPos.x - player.size.x / 2,
                    y: newPos.y - player.size.y / 2,
                    width: player.size.x,
                    height: player.size.y,
                  };
                  let collides = false;
                  for (const plat of roomManager.currentTileMap.platforms) {
                    if (
                      swingBounds.x < plat.x + plat.width &&
                      swingBounds.x + swingBounds.width > plat.x &&
                      swingBounds.y < plat.y + plat.height &&
                      swingBounds.y + swingBounds.height > plat.y
                    ) {
                      collides = true;
                      break;
                    }
                  }

                  if (collides) {
                    const releaseVel = vineSystem.detach();
                    player.velocity.x = releaseVel.x * 0.5;
                    player.velocity.y = releaseVel.y * 0.5;
                    player.grounded = false;
                    player.active = true;
                  } else {
                    player.position.x = newPos.x - player.size.x / 2;
                    player.position.y = newPos.y - player.size.y / 2;
                  }
                }
              } else {
                // Check for vine attach — use Ability1 (E) near a vine anchor
                // Priority: vine attach takes precedence over Margin Stitch when in range
                if (input.isPressed(InputAction.Ability1)) {
                  const nearest = vineSystem.findNearestAnchor(playerCenter);
                  if (nearest) {
                    vineSystem.attach(nearest, playerCenter, player.velocity);
                    player.active = false;
                  }
                }
              }
            }

            // Gravity wells (Astral Atlas)
            if (gravityWellSystem) {
              const gMult = gravityWellSystem.params.globalGravityMultiplier;
              player.params.riseGravity = DEFAULT_PLAYER_PARAMS.riseGravity * gMult;
              player.params.fallGravity = DEFAULT_PLAYER_PARAMS.fallGravity * gMult;
              player.params.maxFallSpeed = DEFAULT_PLAYER_PARAMS.maxFallSpeed * gMult;

              if (playerState !== "DASHING" || gravityWellSystem.params.affectsDash) {
                gravityWellSystem.applyToVelocity(playerCenter, player.velocity, dt);
              }
            } else {
              player.params.riseGravity = DEFAULT_PLAYER_PARAMS.riseGravity;
              player.params.fallGravity = DEFAULT_PLAYER_PARAMS.fallGravity;
              player.params.maxFallSpeed = DEFAULT_PLAYER_PARAMS.maxFallSpeed;
            }

            // Current streams (Maritime Ledger)
            if (currentSystem) {
              currentSystem.updateGusts(dt);
              currentSystem.applyToPlayer(player, dt, player.grounded, player.isDashing);
              const cameraRect = {
                x: camera.position.x,
                y: camera.position.y,
                width: CANVAS_WIDTH,
                height: CANVAS_HEIGHT,
              };
              currentSystem.updateParticles(dt, particleSystem, cameraRect);
            }

            // Fog system (Gothic Errata)
            if (fogSystem) {
              fogSystem.update(player.getBounds(), player.isDashing);
              const remap = fogSystem.getActiveRemap();
              input.setActionRemap(remap);
            } else {
              input.setActionRemap(null);
            }

            // ─── Combat ─────────────────────────────────────────

            if (input.isPressed(InputAction.WeaponSwitch)) {
              selectedWeapon =
                selectedWeapon === "quill-spear" ? "ink-snap" : "quill-spear";
              combat.currentWeapon = selectedWeapon;
            }

            if (
              input.isPressed(InputAction.Attack) &&
              combat.canAttack(playerState)
            ) {
              if (selectedWeapon === "quill-spear") {
                const direction = getAttackDirection(input, player.facingRight);
                combat.startSpearAttack(direction);
              } else {
                const aliveTargets = dummies
                  .filter((d) => d.isAlive)
                  .map((d) => ({ id: d.id, bounds: d.getBounds() }));
                const autoAimTarget = combat.findSnapTarget(
                  playerCenter,
                  aliveTargets
                );
                combat.startSnapAttack(
                  autoAimTarget?.position ?? null,
                  autoAimTarget?.id ?? null,
                  player.facingRight
                );
              }
            }

            combat.update(player.getBounds(), player.facingRight);

            // Hit detection
            if (combat.activeHitbox && combat.attackPhase === "active") {
              const hitTargets = dummies
                .filter((d) => d.isAlive && d.invincibilityFrames <= 0)
                .map((d) => ({ id: d.id, bounds: d.getBounds() }));
              const hits = combat.checkHits(hitTargets);

              for (const hit of hits) {
                const dummy = dummies.find((d) => d.id === hit.targetId);
                if (dummy) {
                  const hitstopFrames =
                    combat.currentWeapon === "quill-spear"
                      ? combat.params.spearHitstopFrames
                      : combat.params.snapHitstopFrames;
                  dummy.takeDamage(hit.damage, hit.knockback, hitstopFrames);

                  const shakeIntensity =
                    combat.currentWeapon === "quill-spear"
                      ? combat.params.spearShakeIntensity
                      : combat.params.snapShakeIntensity;
                  const shakeFrames =
                    combat.currentWeapon === "quill-spear"
                      ? combat.params.spearShakeFrames
                      : combat.params.snapShakeFrames;
                  screenShake.shake(shakeIntensity, shakeFrames);

                  const knockAngle = Math.atan2(
                    hit.knockback.y,
                    hit.knockback.x
                  );
                  particleSystem.emit({
                    x: hit.hitPosition.x,
                    y: hit.hitPosition.y,
                    count: 8,
                    speedMin: 80,
                    speedMax: 180,
                    angleMin: knockAngle - 0.6,
                    angleMax: knockAngle + 0.6,
                    lifeMin: 0.15,
                    lifeMax: 0.35,
                    sizeMin: 2,
                    sizeMax: 4,
                    colors: ["#1e1b4b", "#4338ca", "#e0e7ff"],
                    gravity: 200,
                  });
                }
              }
            }

            // ─── Abilities ──────────────────────────────────────

            // Margin Stitch (skip if vine swinging or just attached — both use Ability1/E)
            // Re-check vineSystem.isSwinging live to catch attach that happened earlier this frame
            marginStitch.scanForPairs(
              playerCenter,
              roomManager.currentTileMap
            );
            if (
              !(vineSystem?.isSwinging) &&
              input.isPressed(InputAction.Ability1) &&
              marginStitch.canActivate
            ) {
              marginStitch.activate(playerCenter.y);
            }
            marginStitch.update(dt);

            // Redaction
            const aimDir = getAimDirection(input, player.facingRight);
            redaction.scanForTargets(playerCenter, aimDir, currentObstacles);
            if (
              input.isPressed(InputAction.Ability2) &&
              redaction.canActivate
            ) {
              redaction.activate();
            }
            redaction.update(dt);

            // Paste-Over
            const groundPlatform = roomManager.currentTileMap.getGroundPlatform(
              player
            );
            if (
              groundPlatform?.surfaceType &&
              groundPlatform.surfaceType !== "normal"
            ) {
              pasteOver.autoCapture(groundPlatform.surfaceType);
            }
            pasteOver.targetPlatform = groundPlatform;
            if (
              input.isPressed(InputAction.Ability3) &&
              pasteOver.canActivate
            ) {
              pasteOver.activate();
            }
            pasteOver.update(dt);

            // Index Mark (Ability4 = F key)
            if (input.isPressed(InputAction.Ability4)) {
              indexMark.onKeyDown();
            }
            if (input.isHeld(InputAction.Ability4)) {
              indexMark.onKeyHeld(input);
            }
            if (input.isReleased(InputAction.Ability4)) {
              const result = indexMark.onKeyUp(
                {
                  x: player.position.x + player.size.x / 2,
                  y: player.position.y + player.size.y / 2,
                },
                player.grounded
              );
              if (result && result.action === "teleport") {
                player.position.x =
                  result.targetPosition.x - player.size.x / 2;
                player.position.y =
                  result.targetPosition.y - player.size.y / 2;
                player.velocity.x = 0;
                player.velocity.y = 0;
              }
            }
            indexMark.update(dt);

            // ─── Health / Damage ────────────────────────────────

            playerHealth.update();

            const canTakeDmg = playerHealth.canTakeDamage(
              playerState,
              player.isDashing
            );
            if (canTakeDmg) {
              const hitObs = checkDamageOverlap(
                player.getBounds(),
                currentObstacles
              );
              if (hitObs) {
                const dir =
                  player.position.x <
                  hitObs.rect.x + hitObs.rect.width / 2
                    ? -1
                    : 1;
                playerHealth.takeDamage(
                  hitObs.damage,
                  { x: dir, y: -0.5 },
                  hitObs.type
                );
              }
            }

            // Health pickups
            pickupManager.update(player.getBounds(), playerHealth, dt);

            const kb = playerHealth.getKnockbackVelocity();
            if (kb) {
              player.velocity.x += kb.x * dt * 60;
              player.velocity.y += kb.y * dt * 60;
            }

            // Sync session health
            session.setHealth(playerHealth.health, playerHealth.maxHealth);

            // Dummies
            for (const d of dummies) d.update(dt);

            // Boss defeat detection
            for (const d of dummies) {
              if (!d.isAlive) {
                const bossId = bossDummies.get(d.id);
                if (bossId && !session.getState().defeatedBosses.includes(bossId)) {
                  session.defeatBoss(bossId);
                  roomManager.openBossGate(bossId);
                  hud.notify("Boss defeated — gate opened!", "gate");
                  // Rebuild originalSurfaces after platform splice
                  originalSurfaces = roomManager.currentTileMap.platforms.map(
                    (p) => p.surfaceType ?? "normal"
                  );

                  // Check if this was the final boss
                  const defeated = session.getState().defeatedBosses;
                  if (
                    defeated.includes("footnote-giant") &&
                    defeated.includes("misprint-seraph") &&
                    defeated.includes("index-eater")
                  ) {
                    hud.notify("The Library is Restored — return to the Scribe Hall", "info");
                  }
                }
              }
            }

            // Day/Night
            dayNight.update(dt);

            // ─── Corruption Modifiers ────────────────────────────
            // Hub rooms are immune to corruption
            const isHubRoom = roomManager.currentRoom.id === "scribe-hall";
            effectiveCorruption = isHubRoom ? 0 : dayNight.corruptionIntensity;

            corruption.update(
              dt,
              effectiveCorruption,
              roomManager.currentTileMap.platforms.length,
              CANVAS_WIDTH,
              CANVAS_HEIGHT,
            );

            // Surface flip: restore originals then apply corrupted surfaces
            if (corruption.isSurfaceFlipActive()) {
              const platforms = roomManager.currentTileMap.platforms;
              for (let i = 0; i < originalSurfaces.length && i < platforms.length; i++) {
                platforms[i].surfaceType = corruption.getEffectiveSurface(originalSurfaces[i]) as SurfaceType;
              }
            } else {
              const platforms = roomManager.currentTileMap.platforms;
              for (let i = 0; i < originalSurfaces.length && i < platforms.length; i++) {
                platforms[i].surfaceType = (originalSurfaces[i] as SurfaceType) ?? "normal";
              }
            }

            // Gravity pulse: modulate player gravity during pulse
            // Only apply corruption gravity when NOT in a gravity well room
            if (!gravityWellSystem) {
              const gravMult = corruption.getGravityMultiplier();
              if (gravMult !== 1.0) {
                player.params.riseGravity = baseRiseGravity * gravMult;
                player.params.fallGravity = baseFallGravity * gravMult;
              } else {
                player.params.riseGravity = baseRiseGravity;
                player.params.fallGravity = baseFallGravity;
              }
            }

            // Ink bleed: spawn atmospheric particles
            for (const _pos of corruption.pendingInkBleeds) {
              const viewBounds = camera.getViewportBounds();
              particleSystem.emit({
                x: viewBounds.x + Math.random() * viewBounds.width,
                y: viewBounds.y,
                count: 1,
                speedMin: 10,
                speedMax: 40,
                angleMin: Math.PI * 0.3,
                angleMax: Math.PI * 0.7,
                lifeMin: 0.3,
                lifeMax: 0.8,
                sizeMin: 2,
                sizeMax: 5,
                colors: ["#4338ca", "#6366f1", "#1e1b4b", "#312e81"],
                gravity: 30,
              });
            }

            // Particles + shake
            particleSystem.update(dt);
            const shakeOffset = screenShake.update();
            camera.position.x += shakeOffset.offsetX;
            camera.position.y += shakeOffset.offsetY;

            // HUD update
            hud.update(dt);
          });

          // ─── World-Space Render Callback ─────────────────────

          engine.onRender((renderer) => {
            const rCtx = renderer.getContext();

            // TileMap
            roomManager.currentTileMap.render(renderer);

            // Obstacles
            for (const obs of currentObstacles) {
              if (!obs.active) continue;
              rCtx.fillStyle = obs.color;
              rCtx.fillRect(
                obs.rect.x,
                obs.rect.y,
                obs.rect.width,
                obs.rect.height
              );
              if (obs.type === "spikes") {
                rCtx.fillStyle = "#991b1b";
                const spikeW = 8;
                const count = Math.floor(obs.rect.width / spikeW);
                for (let i = 0; i < count; i++) {
                  const sx = obs.rect.x + i * spikeW;
                  rCtx.beginPath();
                  rCtx.moveTo(sx, obs.rect.y);
                  rCtx.lineTo(sx + spikeW / 2, obs.rect.y - 6);
                  rCtx.lineTo(sx + spikeW, obs.rect.y);
                  rCtx.closePath();
                  rCtx.fill();
                }
              }
            }

            // Platform flicker overlay (corruption)
            if (corruption.getModifier("platform-flicker")?.active) {
              const platforms = roomManager.currentTileMap.platforms;
              for (let i = 0; i < platforms.length; i++) {
                if (corruption.isPlatformFlickering(i)) {
                  const p = platforms[i];
                  rCtx.save();
                  rCtx.globalAlpha = 0.3 + Math.random() * 0.4;
                  rCtx.fillStyle = "#000";
                  rCtx.fillRect(p.x, p.y, p.width, p.height);
                  rCtx.restore();
                }
              }
            }

            // Health pickups
            pickupManager.render(rCtx, camera, time);

            // Gates
            renderGates(rCtx, roomManager.currentGates, time);

            // Boss gate (dark pulsing barrier)
            const bossGateDef = roomManager.currentRoom.bossGate;
            if (bossGateDef) {
              const bossRect = roomManager.getBossGateRect(bossGateDef.bossId);
              if (bossRect) {
                const pulse = 0.4 + 0.2 * Math.sin(time * 3);
                rCtx.fillStyle = `rgba(80, 20, 20, ${pulse})`;
                rCtx.fillRect(bossRect.x, bossRect.y, bossRect.width, bossRect.height);
                rCtx.strokeStyle = `rgba(200, 40, 40, ${pulse + 0.2})`;
                rCtx.lineWidth = 2;
                rCtx.strokeRect(bossRect.x, bossRect.y, bossRect.width, bossRect.height);
              }
            }

            // Ability pedestal
            const roomPickup = roomManager.currentRoom.abilityPickup;
            if (roomPickup) {
              renderAbilityPedestal(
                rCtx,
                roomPickup,
                session.hasAbility(roomPickup.ability),
                time,
              );
            }

            // Card drop visual (floating card icon)
            if (roomManager.currentRoom.cardDrop && !collectedCardRooms.has(roomManager.currentRoom.id)) {
              const drop = roomManager.currentRoom.cardDrop;
              const bobY = Math.sin(time * 3) * 4;
              rCtx.save();
              rCtx.shadowColor = "#f59e0b";
              rCtx.shadowBlur = 12;
              rCtx.fillStyle = "#f59e0b";
              rCtx.fillRect(drop.position.x - 10, drop.position.y - 14 + bobY, 20, 28);
              rCtx.strokeStyle = "#fbbf24";
              rCtx.lineWidth = 1.5;
              rCtx.strokeRect(drop.position.x - 10, drop.position.y - 14 + bobY, 20, 28);
              rCtx.shadowBlur = 0;
              rCtx.fillStyle = "#1e1b4b";
              rCtx.font = "bold 12px monospace";
              rCtx.textAlign = "center";
              rCtx.fillText("\u2726", drop.position.x, drop.position.y + 4 + bobY);
              rCtx.restore();
            }

            // Exit indicators
            renderExitIndicators(rCtx, roomManager.currentRoom.exits, time);

            // Biome system world-space rendering
            if (vineSystem) {
              const pc: Vec2 | null = vineSystem.isSwinging
                ? null
                : {
                    x: player.position.x + player.size.x / 2,
                    y: player.position.y + player.size.y / 2,
                  };
              vineSystem.render(rCtx, false, false, pc, lastDt);
            }
            if (gravityWellSystem) {
              gravityWellSystem.render(rCtx, camera.position, time, lastDt);
            }
            if (currentSystem) {
              currentSystem.renderFlow(rCtx);
            }
            if (fogSystem) {
              fogSystem.renderZoneBoundaries(
                rCtx,
                camera.position.x,
                camera.position.y,
                CANVAS_WIDTH,
                CANVAS_HEIGHT,
              );
            }

            // Dummies
            for (const d of dummies) d.render(renderer, 0);

            // Combat visuals
            combat.render(rCtx, camera);

            // Ability visuals
            marginStitch.render(rCtx);
            redaction.render(rCtx);
            pasteOver.render(rCtx);
            indexMark.render(rCtx);

            // Particles
            particleSystem.render(renderer);

            // Player (with invincibility blink + vine rotation)
            const showPlayer =
              playerHealth.invincibilityTimer <= 0 ||
              Math.floor(playerHealth.invincibilityTimer / 4) % 2 === 0;

            if (showPlayer) {
              const isSwinging = vineSystem?.isSwinging ?? false;
              const renderPlayer = () => {
                if (isSwinging && vineSystem) {
                  // Render with vine swing rotation
                  const cx = player.position.x + player.size.x / 2;
                  const cy = player.position.y + player.size.y / 2;
                  rCtx.save();
                  rCtx.translate(cx, cy);
                  rCtx.rotate(vineSystem.angle * 0.3);
                  rCtx.translate(-cx, -cy);
                  player.render(renderer, 0);
                  rCtx.restore();
                } else {
                  player.render(renderer, 0);
                }
              };

              if (
                playerHealth.invincibilityTimer > 0 &&
                playerHealth.knockbackTimer > 0
              ) {
                const oldColor = player.color;
                player.color = "#ef4444";
                renderPlayer();
                player.color = oldColor;
              } else {
                renderPlayer();
              }
            }
          });

          // ─── Screen-Space Layer (HUD + Pause) ────────────────

          const screenLayerCallback = (
            screenCtx: CanvasRenderingContext2D
          ) => {
            // Fog overlay (screen-space, rendered before HUD so HUD is visible)
            if (fogSystem) {
              const playerScreenX =
                player.position.x + player.size.x / 2 - camera.position.x;
              const playerScreenY =
                player.position.y + player.size.y / 2 - camera.position.y;
              fogSystem.renderFogOverlay(
                screenCtx,
                playerScreenX,
                playerScreenY,
                CANVAS_WIDTH,
                CANVAS_HEIGHT,
              );
              fogSystem.renderControlEffects(screenCtx, CANVAS_WIDTH, CANVAS_HEIGHT);
            }

            // Corruption fog-of-war (night) — only if biome fog isn't already active
            if (corruption.isFogActive() && !fogSystem) {
              const playerScreenPos = camera.worldToScreen({
                x: player.position.x + player.size.x / 2,
                y: player.position.y + player.size.y / 2,
              });
              DayNightRenderer.renderFogOfWar(
                screenCtx,
                playerScreenPos,
                corruption.getFogRadius(),
                "rgba(10, 10, 26, 0.85)",
                CANVAS_WIDTH,
                CANVAS_HEIGHT,
              );
            }

            // Corruption chromatic distortion (>0.5 corruption only)
            if (effectiveCorruption > 0.5) {
              DayNightRenderer.renderCorruptionDistortion(
                screenCtx,
                effectiveCorruption,
                CANVAS_WIDTH,
                CANVAS_HEIGHT,
              );
            }

            // Gravity pulse visual indicator
            if (corruption.gravityPulseActive) {
              screenCtx.fillStyle = "rgba(239, 68, 68, 0.15)";
              screenCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
              screenCtx.fillStyle = "rgba(239, 68, 68, 0.6)";
              screenCtx.fillRect(0, 0, CANVAS_WIDTH, 3);
              screenCtx.fillRect(0, CANVAS_HEIGHT - 3, CANVAS_WIDTH, 3);
            }

            // HUD (always visible)
            hud.render(screenCtx, CANVAS_WIDTH, CANVAS_HEIGHT);

            // Mini equipped cards bar (during gameplay)
            if (!deckMode && !paused) {
              const deck = cardEngine.getDeck();
              const equipped = deck.collection.filter((c) => deck.equippedIds.includes(c.id));
              if (equipped.length > 0) {
                const miniY = 32;
                const miniX = 16;
                for (let i = 0; i < equipped.length; i++) {
                  CardRenderer.renderCard(screenCtx, equipped[i], {
                    x: miniX + i * 36,
                    y: miniY,
                    width: 32,
                    height: 44,
                    selected: false,
                    equipped: true,
                    highlighted: false,
                    dimmed: false,
                  });
                }
              }
            }

            // Transition overlay
            const tAlpha = roomManager.getTransitionAlpha();
            if (tAlpha > 0) {
              renderTransitionOverlay(
                screenCtx,
                tAlpha,
                CANVAS_WIDTH,
                CANVAS_HEIGHT
              );
            }

            // Pause menu (custom 4-option)
            if (paused) {
              if (confirmingQuit) {
                renderPlayPauseMenu(
                  screenCtx,
                  CANVAS_WIDTH,
                  CANVAS_HEIGHT,
                  pauseSelection,
                  saveNotifyFrames
                );
                renderConfirmQuit(
                  screenCtx,
                  CANVAS_WIDTH,
                  CANVAS_HEIGHT,
                  confirmQuitSelection
                );
              } else {
                renderPlayPauseMenu(
                  screenCtx,
                  CANVAS_WIDTH,
                  CANVAS_HEIGHT,
                  pauseSelection,
                  saveNotifyFrames
                );
              }
            }

            // Deck screen overlay
            if (deckMode) {
              screenCtx.fillStyle = "rgba(0, 0, 0, 0.85)";
              screenCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

              screenCtx.fillStyle = "#e2e8f0";
              screenCtx.font = "bold 24px monospace";
              screenCtx.textAlign = "center";
              screenCtx.fillText("INK DECK", CANVAS_WIDTH / 2, 40);

              const deck = cardEngine.getDeck();
              CardRenderer.renderDeckBar(screenCtx, deck, CANVAS_WIDTH / 2 - 150, 60, -1);
              CardRenderer.renderCollectionGrid(
                screenCtx, deck.collection,
                40, 160, 360, 340,
                deckUI.collectionScrollOffset,
                deckUI.activePanel === "collection" ? deckUI.selectedCollectionIndex : -1,
                new Set(deck.equippedIds)
              );

              const recipes = crafting.getAvailableCrafts(deck.collection);
              CardRenderer.renderCraftingPanel(
                screenCtx, recipes, deck.collection,
                440, 160, 300, 340,
                deckUI.activePanel === "crafting" ? deckUI.selectedRecipeIndex : -1
              );

              const summary = cardEngine.getModifierSummary(basePlayerParams, baseCombatParams, baseHealthParams);
              CardRenderer.renderStatComparison(screenCtx, summary, 40, CANVAS_HEIGHT - 80, CANVAS_WIDTH - 80);

              if (deckUI.activePanel === "collection" && deck.collection[deckUI.selectedCollectionIndex]) {
                const selectedCard = deck.collection[deckUI.selectedCollectionIndex];
                CardRenderer.renderTooltip(screenCtx, selectedCard, CANVAS_WIDTH / 2 - 100, CANVAS_HEIGHT - 180, 200);
              }

              screenCtx.fillStyle = "#94a3b8";
              screenCtx.font = "12px monospace";
              screenCtx.textAlign = "center";
              screenCtx.fillText(
                "[Tab] Close  [\u2191\u2193] Navigate  [Enter] Equip/Unequip  [C] Craft  [\u2190\u2192] Switch Panel",
                CANVAS_WIDTH / 2, CANVAS_HEIGHT - 16
              );
            }

            // Victory screen overlay (renders on top of everything)
            if (victoryScreen) {
              victoryScreen.render(screenCtx, CANVAS_WIDTH, CANVAS_HEIGHT);
            }
          };
          engine.getRenderer().addLayerCallback("debug", screenLayerCallback);

          // Minimum loading time
          const elapsed = Date.now() - loadStartTime;
          const remaining = Math.max(0, LOADING_MIN_MS - elapsed);
          await new Promise((resolve) => setTimeout(resolve, remaining));

          engine.start();
          setIsReady(true);
        } catch (err) {
          console.error("Failed to initialize game:", err);
          setLoadError(
            err instanceof Error ? err.message : "Failed to load game"
          );
        }
      })();
    },
    [slot, isNew, devMode, load, doSave, router]
  );

  const handleUnmount = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    engineRef.current?.stop();
    engineRef.current = null;
    sessionRef.current = null;
  }, []);

  // ─── Render ───────────────────────────────────────────────────────

  if (!slotParam || slot < 1 || slot > 3) {
    return null; // redirecting
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950">
        <p className="font-mono text-red-400">{loadError}</p>
        <button
          onClick={() => router.push("/")}
          className="font-mono text-sm text-zinc-400 transition-colors hover:text-zinc-200"
        >
          Return to Menu
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950">
      {/* Loading overlay */}
      {!isReady && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-950">
          <p className="animate-pulse font-mono text-lg text-zinc-400">
            {loadProgress.total > 0
              ? `Loading assets... ${loadProgress.loaded}/${loadProgress.total}`
              : "Loading..."}
          </p>
          <p className="mt-2 font-mono text-xs text-zinc-600">
            Preparing the library
          </p>
        </div>
      )}

      {/* Game canvas */}
      <GameCanvas onMount={handleMount} onUnmount={handleUnmount} />

      {/* Controls hint (only shown once loaded) */}
      {isReady && (
        <div className="mt-3 font-mono text-xs text-zinc-600">
          Arrows = Move &middot; Z/Space = Jump &middot; X/Shift = Dash &middot;
          J = Attack &middot; K = Switch &middot; E/Q/R/F = Abilities &middot;
          Tab = Deck &middot; ESC = Pause
        </div>
      )}
    </div>
  );
}
