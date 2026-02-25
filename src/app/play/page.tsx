"use client";

import { Suspense, useRef, useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GameCanvas } from "@/components/canvas/GameCanvas";
import { Engine } from "@/engine/core/Engine";
import { Player, DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";
import { TileMap } from "@/engine/physics/TileMap";
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
import { GameHUD } from "@/engine/ui/GameHUD";
import { RoomManager } from "@/engine/world/RoomManager";
import { PRESET_ROOMS, PRESET_ROOM_NAMES } from "@/engine/world/presetRooms";
import {
  renderGates,
  renderExitIndicators,
  renderTransitionOverlay,
} from "@/engine/world/RoomRenderer";
import type { Obstacle } from "@/engine/physics/Obstacles";
import {
  createSpikes,
  createHazardZone,
  checkDamageOverlap,
} from "@/engine/physics/Obstacles";
import { GameSession } from "@/engine/core/GameSession";
import { RenderConfig } from "@/engine/core/RenderConfig";
import { loadTileSprites } from "@/engine/world/TileSprites";
import type { LoadedGameState } from "@/engine/save/SaveSystem";
import { useSaveSlots } from "@/hooks/useSaveSlots";
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS } from "@/lib/constants";
import type { Vec2 } from "@/lib/types";
import type { GateAbility } from "@/engine/world/Room";

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

function buildObstaclesFromRoom(
  roomObstacles: { id: string; rect: { x: number; y: number; width: number; height: number }; type: string; damage: number }[]
): Obstacle[] {
  return roomObstacles.map((o) => {
    switch (o.type) {
      case "spikes":
        return createSpikes(o.rect, o.damage);
      case "hazard_zone":
        return createHazardZone(o.rect, o.damage);
      default:
        return createSpikes(o.rect, o.damage);
    }
  });
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
  const slot = slotParam ? parseInt(slotParam, 10) : 0;

  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const engineRef = useRef<Engine | null>(null);
  const sessionRef = useRef<GameSession | null>(null);
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
          });
          sessionRef.current = session;

          // Build rooms map from presets
          const rooms = new Map<string, typeof PRESET_ROOMS[string]>();
          for (const [id, data] of Object.entries(PRESET_ROOMS)) {
            rooms.set(id, data);
          }

          const startingRoomId = session.getStartingRoomId();
          if (!rooms.has(startingRoomId)) {
            rooms.set(startingRoomId, PRESET_ROOMS["tutorial-corridor"]);
          }

          const roomManager = new RoomManager({
            rooms,
            startingRoomId,
          });

          // Load tile sprites (placeholders used if images are missing)
          await loadTileSprites();

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

          // Build initial obstacles
          let currentObstacles: Obstacle[] = buildObstaclesFromRoom(
            roomManager.currentObstacles.map((o) => ({
              id: o.id,
              rect: o.rect,
              type: o.type,
              damage: o.damage,
            }))
          );

          // Dummies from room's enemy spawns
          let dummies: TargetDummy[] = roomManager.currentEnemies.map(
            (e) =>
              new TargetDummy({
                position: { x: e.position.x, y: e.position.y },
                health: 3,
                color: "#ef4444",
                respawns: true,
                respawnDelay: 300,
                patrol: !!e.patrolRange,
                patrolRange: e.patrolRange ?? 0,
                patrolSpeed: 40,
                groundY: e.groundY ?? e.position.y,
              })
          );

          // Pause state (managed here, not by GameHUD)
          let paused = false;
          let pauseSelection = 0;
          let saveNotifyFrames = 0;
          let confirmingQuit = false;
          let confirmQuitSelection = 0;

          // Time tracking for session
          let time = 0;

          // Store ref
          engineRef.current = engine;

          // Show initial room name
          const roomName =
            PRESET_ROOM_NAMES[roomManager.currentRoom.id] ??
            roomManager.currentRoom.name;
          hud.showRoomName(roomName);
          session.enterRoom(roomManager.currentRoom.id, roomName);

          // ─── Helper: rebuild room systems after transition ────

          const rebuildRoomSystems = () => {
            player.tileMap = roomManager.currentTileMap;
            marginStitch.setTileMap(roomManager.currentTileMap);

            camera.bounds = {
              x: 0,
              y: 0,
              width: roomManager.currentRoom.width,
              height: roomManager.currentRoom.height,
            };

            currentObstacles = buildObstaclesFromRoom(
              roomManager.currentObstacles.map((o) => ({
                id: o.id,
                rect: o.rect,
                type: o.type,
                damage: o.damage,
              }))
            );

            dummies = roomManager.currentEnemies.map(
              (e) =>
                new TargetDummy({
                  position: { x: e.position.x, y: e.position.y },
                  health: 3,
                  color: "#ef4444",
                  respawns: true,
                  respawnDelay: 300,
                  patrol: !!e.patrolRange,
                  patrolRange: e.patrolRange ?? 0,
                  patrolSpeed: 40,
                  groundY: e.groundY ?? e.position.y,
                })
            );
          };

          // ─── Update Callback ──────────────────────────────────

          engine.onUpdate((dt) => {
            time += dt;

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
                      doSave();
                      saveNotifyFrames = SAVE_NOTIFICATION_FRAMES;
                      hud.notify("Game saved!", "info");
                      break;
                    case "Save & Quit":
                      session.setHealth(playerHealth.health, playerHealth.maxHealth);
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

                const newRoomName =
                  PRESET_ROOM_NAMES[result.roomId] ?? result.roomId;
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

                camera.snapTo({
                  x: player.position.x + player.size.x / 2,
                  y: player.position.y + player.size.y / 2,
                });

                // Auto-save on room transition
                session.setHealth(playerHealth.health, playerHealth.maxHealth);
                doSave();
                hud.notify("Auto-saved", "info");
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
                  }
                }
              }
            }

            // Fall off respawn
            if (
              player.position.y >
              roomManager.currentRoom.height + RESPAWN_Y_MARGIN
            ) {
              const sp = roomManager.currentRoom.defaultSpawn;
              player.position.x = sp.x;
              player.position.y = sp.y;
              player.velocity.x = 0;
              player.velocity.y = 0;
              player.grounded = false;
              playerHealth.takeDamage(1, { x: 0, y: -0.3 }, "fall");
              session.recordDeath();
            }

            // Camera follow
            const playerCenter: Vec2 = {
              x: player.position.x + player.size.x / 2,
              y: player.position.y + player.size.y / 2,
            };
            camera.follow(playerCenter, player.velocity, dt);

            // ─── Combat ─────────────────────────────────────────

            if (input.isPressed(InputAction.WeaponSwitch)) {
              selectedWeapon =
                selectedWeapon === "quill-spear" ? "ink-snap" : "quill-spear";
              combat.currentWeapon = selectedWeapon;
            }

            const playerState = player.stateMachine.getCurrentState();
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

            // Margin Stitch
            marginStitch.scanForPairs(
              playerCenter,
              roomManager.currentTileMap
            );
            if (
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

            const kb = playerHealth.getKnockbackVelocity();
            if (kb) {
              player.velocity.x += kb.x * dt * 60;
              player.velocity.y += kb.y * dt * 60;
            }

            // Sync session health
            session.setHealth(playerHealth.health, playerHealth.maxHealth);

            // Dummies
            for (const d of dummies) d.update(dt);

            // Day/Night
            dayNight.update(dt);

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

            // Gates
            renderGates(rCtx, roomManager.currentGates, time);

            // Exit indicators
            renderExitIndicators(rCtx, roomManager.currentRoom.exits, time);

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

            // Player (with invincibility blink)
            const showPlayer =
              playerHealth.invincibilityTimer <= 0 ||
              Math.floor(playerHealth.invincibilityTimer / 4) % 2 === 0;

            if (showPlayer) {
              if (
                playerHealth.invincibilityTimer > 0 &&
                playerHealth.knockbackTimer > 0
              ) {
                const oldColor = player.color;
                player.color = "#ef4444";
                player.render(renderer, 0);
                player.color = oldColor;
              } else {
                player.render(renderer, 0);
              }
            }
          });

          // ─── Screen-Space Layer (HUD + Pause) ────────────────

          const screenLayerCallback = (
            screenCtx: CanvasRenderingContext2D
          ) => {
            // HUD (always visible)
            hud.render(screenCtx, CANVAS_WIDTH, CANVAS_HEIGHT);

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
    [slot, isNew, load, doSave, router]
  );

  const handleUnmount = useCallback(() => {
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
            Loading...
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
          ESC = Pause
        </div>
      )}
    </div>
  );
}
