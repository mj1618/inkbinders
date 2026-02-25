"use client";

import { useRef, useState, useCallback } from "react";
import { GameCanvas } from "@/components/canvas/GameCanvas";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { Slider } from "@/components/debug/Slider";
import { RenderModeToggle } from "@/components/debug/RenderModeToggle";
import { Engine } from "@/engine/core/Engine";
import { Player, DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";
import { ParticleSystem } from "@/engine/core/ParticleSystem";
import { ScreenShake } from "@/engine/core/ScreenShake";
import { RenderConfig } from "@/engine/core/RenderConfig";
import { InputAction } from "@/engine/input/InputManager";
import type { InputManager } from "@/engine/input/InputManager";
import { CombatSystem } from "@/engine/combat/CombatSystem";
import { PlayerHealth } from "@/engine/combat/PlayerHealth";
import type { AttackDirection, WeaponType } from "@/engine/combat/types";
import { MarginStitch } from "@/engine/abilities/MarginStitch";
import { Redaction } from "@/engine/abilities/Redaction";
import { PasteOver } from "@/engine/abilities/PasteOver";
import { IndexMark } from "@/engine/abilities/IndexMark";
import { DayNightRenderer } from "@/engine/world/DayNightRenderer";
import { CorruptionModifiers } from "@/engine/world/CorruptionModifiers";
import { GameWorld } from "@/engine/world/GameWorld";
import type { WorldFrameState } from "@/engine/world/GameWorld";
import { createDemoWorld } from "@/engine/world/demoWorld";
import type { BiomeTheme } from "@/engine/world/Biome";
import { GameHUD } from "@/engine/ui/GameHUD";
import type { GameHUDConfig } from "@/engine/ui/GameHUD";
import { Reader } from "@/engine/entities/enemies/Reader";
import { Binder } from "@/engine/entities/enemies/Binder";
import { Proofwarden } from "@/engine/entities/enemies/Proofwarden";
import type { Enemy, PlayerRef } from "@/engine/entities/Enemy";
import { checkDamageOverlap } from "@/engine/physics/Obstacles";
import type { Obstacle } from "@/engine/physics/Obstacles";
import {
  renderGates,
  renderExitIndicators,
  renderTransitionOverlay,
} from "@/engine/world/RoomRenderer";
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS } from "@/lib/constants";
import type { Vec2 } from "@/lib/types";
import type { RoomId, EnemySpawn } from "@/engine/world/Room";
import Link from "next/link";

// ─── Constants ──────────────────────────────────────────────────────

const MINIMAP_X = 720;
const MINIMAP_Y = 16;
const MINIMAP_WIDTH = 220;
const MINIMAP_HEIGHT = 140;
const MINIMAP_BG_ALPHA = 0.6;
const MINIMAP_PADDING = 8;

// ─── Helpers ────────────────────────────────────────────────────────

function getAttackDirection(
  input: InputManager,
  facingRight: boolean,
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
  let dx = 0;
  let dy = 0;
  if (input.isHeld(InputAction.Right)) dx = 1;
  else if (input.isHeld(InputAction.Left)) dx = -1;
  if (input.isHeld(InputAction.Up)) dy = -1;
  else if (input.isHeld(InputAction.Down)) dy = 1;
  if (dx === 0 && dy === 0) dx = facingRight ? 1 : -1;
  const len = Math.sqrt(dx * dx + dy * dy);
  return { x: dx / len, y: dy / len };
}

function spawnEnemiesForRoom(spawns: EnemySpawn[]): Enemy[] {
  const enemies: Enemy[] = [];
  for (const s of spawns) {
    switch (s.type) {
      case "reader":
        enemies.push(
          new Reader({
            position: { x: s.position.x, y: s.position.y },
            patrol: true,
            patrolRange: s.patrolRange ?? 100,
          }),
        );
        break;
      case "binder":
        enemies.push(
          new Binder({
            position: { x: s.position.x, y: s.position.y },
          }),
        );
        break;
      case "proofwarden":
        enemies.push(
          new Proofwarden({
            position: { x: s.position.x, y: s.position.y },
          }),
        );
        break;
    }
    const enemy = enemies[enemies.length - 1];
    enemy.facingRight = s.facingRight;
  }
  return enemies;
}

// ─── Minimap Layout ─────────────────────────────────────────────────

interface MinimapRoom {
  id: RoomId;
  rx: number;
  ry: number;
  rw: number;
  rh: number;
}

type MinimapConnection = [RoomId, RoomId];

interface MinimapData {
  rooms: MinimapRoom[];
  connections: MinimapConnection[];
}

function computeMinimapLayout(
  worldGraph: { rooms: Map<RoomId, { width: number; height: number; exits: Array<{ targetRoomId: RoomId }> }> },
): MinimapData {
  const roomIds = Array.from(worldGraph.rooms.keys());
  if (roomIds.length === 0) return { rooms: [], connections: [] };

  // Fixed positions for known rooms (relative grid)
  const gridPositions: Record<string, { gx: number; gy: number }> = {
    "scribe-hall": { gx: 1, gy: 0 },
    "tutorial-corridor": { gx: 0, gy: 0 },
    "archive-passage": { gx: 2, gy: 0 },
    "vertical-shaft": { gx: 1, gy: 1 },
    "vine-garden": { gx: 1, gy: 2 },
  };

  let nextGx = 3;
  for (const id of roomIds) {
    if (!gridPositions[id]) {
      gridPositions[id] = { gx: nextGx++, gy: 0 };
    }
  }

  const minGx = Math.min(...Object.values(gridPositions).map((p) => p.gx));
  const maxGx = Math.max(...Object.values(gridPositions).map((p) => p.gx));
  const minGy = Math.min(...Object.values(gridPositions).map((p) => p.gy));
  const maxGy = Math.max(...Object.values(gridPositions).map((p) => p.gy));

  const cols = maxGx - minGx + 1;
  const rows = maxGy - minGy + 1;
  const cellW = (MINIMAP_WIDTH - MINIMAP_PADDING * 2) / cols;
  const cellH = (MINIMAP_HEIGHT - MINIMAP_PADDING * 2) / rows;
  const roomPad = 4;

  const rooms: MinimapRoom[] = [];
  for (const id of roomIds) {
    const gp = gridPositions[id];
    const col = gp.gx - minGx;
    const row = gp.gy - minGy;
    rooms.push({
      id,
      rx: MINIMAP_PADDING + col * cellW + roomPad,
      ry: MINIMAP_PADDING + row * cellH + roomPad,
      rw: cellW - roomPad * 2,
      rh: cellH - roomPad * 2,
    });
  }

  // Deduplicated connections from actual exit data
  const seen = new Set<string>();
  const connections: MinimapConnection[] = [];
  for (const [id, room] of worldGraph.rooms) {
    for (const exit of room.exits) {
      const key = [id, exit.targetRoomId].sort().join("|");
      if (!seen.has(key)) {
        seen.add(key);
        connections.push([id, exit.targetRoomId]);
      }
    }
  }

  return { rooms, connections };
}

function renderMinimap(
  ctx: CanvasRenderingContext2D,
  minimap: MinimapData,
  currentRoomId: RoomId,
  visitedRooms: Set<string>,
  hubRoomId: RoomId,
  playerFractionX: number,
  playerFractionY: number,
): void {
  const layout = minimap.rooms;
  ctx.save();

  // Background
  ctx.fillStyle = `rgba(20, 20, 20, ${MINIMAP_BG_ALPHA})`;
  ctx.fillRect(MINIMAP_X, MINIMAP_Y, MINIMAP_WIDTH, MINIMAP_HEIGHT);
  ctx.strokeStyle = "#4b5563";
  ctx.lineWidth = 1;
  ctx.strokeRect(MINIMAP_X, MINIMAP_Y, MINIMAP_WIDTH, MINIMAP_HEIGHT);

  // Draw connections from actual exit data
  const roomById = new Map(layout.map((r) => [r.id, r]));
  ctx.strokeStyle = "rgba(100, 100, 100, 0.4)";
  ctx.lineWidth = 1;
  for (const [fromId, toId] of minimap.connections) {
    const from = roomById.get(fromId);
    const to = roomById.get(toId);
    if (!from || !to) continue;
    ctx.beginPath();
    ctx.moveTo(MINIMAP_X + from.rx + from.rw / 2, MINIMAP_Y + from.ry + from.rh / 2);
    ctx.lineTo(MINIMAP_X + to.rx + to.rw / 2, MINIMAP_Y + to.ry + to.rh / 2);
    ctx.stroke();
  }

  // Draw rooms
  for (const room of layout) {
    const x = MINIMAP_X + room.rx;
    const y = MINIMAP_Y + room.ry;
    const isCurrent = room.id === currentRoomId;
    const isVisited = visitedRooms.has(room.id);
    const isHub = room.id === hubRoomId;

    if (isVisited) {
      ctx.fillStyle = isCurrent
        ? isHub
          ? "rgba(251, 191, 36, 0.5)"
          : "rgba(96, 165, 250, 0.4)"
        : isHub
          ? "rgba(251, 191, 36, 0.2)"
          : "rgba(100, 100, 100, 0.3)";
      ctx.fillRect(x, y, room.rw, room.rh);
    }

    // Border
    if (isCurrent) {
      ctx.strokeStyle = isHub ? "#fbbf24" : "#60a5fa";
      ctx.lineWidth = 2;
    } else if (isHub) {
      ctx.strokeStyle = "rgba(251, 191, 36, 0.5)";
      ctx.lineWidth = 1;
    } else {
      ctx.strokeStyle = isVisited ? "#6b7280" : "#374151";
      ctx.lineWidth = 1;
    }
    ctx.strokeRect(x, y, room.rw, room.rh);

    // Room name label
    if (isVisited || isCurrent) {
      ctx.fillStyle = isCurrent ? "#ffffff" : "#9ca3af";
      ctx.font = "7px monospace";
      ctx.textAlign = "center";
      const name = room.id.replace(/-/g, " ");
      const shortName = name.length > 10 ? name.slice(0, 9) + "…" : name;
      ctx.fillText(shortName, x + room.rw / 2, y + room.rh / 2 + 3);
      ctx.textAlign = "left";
    }

    // Player dot in current room
    if (isCurrent) {
      const dotX = x + playerFractionX * room.rw;
      const dotY = y + playerFractionY * room.rh;
      ctx.fillStyle = "#22d3ee";
      ctx.beginPath();
      ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

// ─── Extended Engine Interface ──────────────────────────────────────

interface EngineRefs {
  gameWorld?: GameWorld;
  worldFrame?: WorldFrameState;
  corruption?: CorruptionModifiers;
  activeEnemies?: Enemy[];
  obstacles?: Obstacle[];
}

// ─── Test Page Component ────────────────────────────────────────────

export default function WorldAssemblyTest() {
  const engineRef = useRef<Engine | null>(null);
  const refsRef = useRef<EngineRefs>({});

  const [hudConfig, setHudConfig] = useState<GameHUDConfig>({
    showHealth: true,
    showAbilities: true,
    showWeapon: true,
    showClock: true,
    showRoomName: true,
    showMinimap: true,
    showNotifications: true,
  });
  const [cycleSpeed, setCycleSpeed] = useState(1.0);
  const [showOverlays, setShowOverlays] = useState(true);

  // Debug display state (updated from engine via refs)
  const [debugState, setDebugState] = useState({
    roomName: "Scribe Hall",
    roomId: "scribe-hall",
    biome: "scribe-hall",
    roomsVisited: 1,
    totalRooms: 5,
    gatesOpened: 0,
    deaths: 0,
    playTime: "0:00",
    timeOfDay: "dawn",
    lightLevel: 0.5,
    corruptionIntensity: 0,
  });

  const hudConfigRef = useRef(hudConfig);
  hudConfigRef.current = hudConfig;
  const cycleSpeedRef = useRef(cycleSpeed);
  cycleSpeedRef.current = cycleSpeed;
  const showOverlaysRef = useRef(showOverlays);
  showOverlaysRef.current = showOverlays;

  const updateHudConfig = useCallback(
    <K extends keyof GameHUDConfig>(key: K, value: GameHUDConfig[K]) => {
      setHudConfig((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const skipToPhase = useCallback((phase: "dawn" | "day" | "dusk" | "night") => {
    refsRef.current.gameWorld?.dayNight.skipTo(phase);
  }, []);

  // ─── Engine Mount ───────────────────────────────────────────────

  const handleMount = useCallback((ctx: CanvasRenderingContext2D) => {
    RenderConfig.setMode("rectangles");
    const engine = new Engine({ ctx });
    const camera = engine.getCamera();
    const input = engine.getInput();
    engineRef.current = engine;

    // Build the demo world
    const { worldGraph } = createDemoWorld();
    const gameWorld = new GameWorld({
      worldGraph,
      allAbilitiesUnlocked: true,
      dayNightParams: { timeScale: 1.0 },
    });
    refsRef.current.gameWorld = gameWorld;

    // Player
    const player = new Player();
    const spawn = gameWorld.roomManager.currentRoom.defaultSpawn;
    player.position.x = spawn.x;
    player.position.y = spawn.y;
    player.input = input;
    player.tileMap = gameWorld.roomManager.currentTileMap;

    const particleSystem = new ParticleSystem();
    const screenShake = new ScreenShake();
    player.particleSystem = particleSystem;
    player.screenShake = screenShake;
    engine.getEntities().add(player);

    // Camera
    const room = gameWorld.roomManager.currentRoom;
    camera.bounds = { x: 0, y: 0, width: room.width, height: room.height };
    camera.snapTo({ x: spawn.x, y: spawn.y });

    // Combat
    const combat = new CombatSystem();
    const playerHealth = new PlayerHealth();
    let selectedWeapon: WeaponType = "quill-spear";

    // Abilities
    const marginStitch = new MarginStitch();
    marginStitch.setTileMap(gameWorld.roomManager.currentTileMap);
    marginStitch.particleSystem = particleSystem;

    const redaction = new Redaction();
    redaction.particleSystem = particleSystem;

    const pasteOver = new PasteOver();
    const indexMark = new IndexMark();
    indexMark.particleSystem = particleSystem;

    // Corruption modifiers
    const corruption = new CorruptionModifiers();
    refsRef.current.corruption = corruption;

    // Enemies
    let activeEnemies = spawnEnemiesForRoom(gameWorld.getActiveEnemySpawns());
    for (const e of activeEnemies) {
      e.tileMap = gameWorld.roomManager.currentTileMap;
      e.particleSystem = particleSystem;
      e.screenShake = screenShake;
    }
    refsRef.current.activeEnemies = activeEnemies;

    // HUD
    const hud = new GameHUD(
      {
        health: playerHealth,
        combat,
        marginStitch,
        redaction,
        pasteOver,
        indexMark,
        dayNight: gameWorld.dayNight,
        input,
      },
      hudConfigRef.current,
    );
    hud.showRoomName("Scribe Hall");

    // Track current obstacles
    let currentObstacles: Obstacle[] = [...gameWorld.roomManager.currentObstacles];
    refsRef.current.obstacles = currentObstacles;

    // Minimap layout
    let minimapData = computeMinimapLayout(worldGraph);

    // Timer for debug state updates (every 15 frames)
    let debugUpdateCounter = 0;

    // Time accumulator for render-time animations
    let renderTime = 0;

    // ─── Handle Room Swap (called when transition midpoint occurs) ──

    function handleRoomSwap() {
      const rm = gameWorld.roomManager;
      const newRoom = rm.currentRoom;

      // Update player's tileMap ref
      player.tileMap = rm.currentTileMap;

      // Update camera bounds
      camera.bounds = { x: 0, y: 0, width: newRoom.width, height: newRoom.height };

      // Update abilities' tileMap
      marginStitch.setTileMap(rm.currentTileMap);

      // Spawn new enemies
      activeEnemies = spawnEnemiesForRoom(gameWorld.getActiveEnemySpawns());
      for (const e of activeEnemies) {
        e.tileMap = rm.currentTileMap;
        e.particleSystem = particleSystem;
        e.screenShake = screenShake;
      }
      refsRef.current.activeEnemies = activeEnemies;

      // Obstacles
      currentObstacles = [...rm.currentObstacles];
      refsRef.current.obstacles = currentObstacles;

      minimapData = computeMinimapLayout(worldGraph);

      // Show room name
      hud.showRoomName(newRoom.name);

      // Clear particles
      particleSystem.clear();
    }

    // ─── Update Callback ──────────────────────────────────────────

    engine.onUpdate((dt) => {
      // Sync HUD config from React
      hud.config = hudConfigRef.current;

      // Sync day/night speed
      gameWorld.dayNight.params.timeScale = cycleSpeedRef.current;

      // Pause handling
      const wasPaused = hud.paused;
      hud.checkPause();
      if (hud.paused) {
        const action = hud.handlePauseInput();
        if (action === "quit") {
          hud.paused = false;
          // Respawn at current room spawn
          const s = gameWorld.roomManager.currentRoom.defaultSpawn;
          player.position.x = s.x;
          player.position.y = s.y;
          player.velocity.x = 0;
          player.velocity.y = 0;
          playerHealth.reset();
        }
        hud.update(dt);
        return;
      }
      if (wasPaused) {
        hud.update(dt);
        return;
      }

      // ── World update (day/night, transitions, exits) ──────────

      const playerBounds = player.getBounds();
      const worldFrame = gameWorld.update(dt, playerBounds);
      refsRef.current.worldFrame = worldFrame;

      if (gameWorld.roomManager.transitioning) {
        player.velocity.x = 0;
        player.velocity.y = 0;
      }

      // ── Player respawn if fallen ──────────────────────────────

      const curRoom = gameWorld.roomManager.currentRoom;
      if (player.position.y > curRoom.height + 100) {
        player.position.x = curRoom.defaultSpawn.x;
        player.position.y = curRoom.defaultSpawn.y;
        player.velocity.x = 0;
        player.velocity.y = 0;
        player.grounded = false;
        playerHealth.takeDamage(1, { x: 0, y: 0 }, "hazard_zone");
      }

      // ── Player death ──────────────────────────────────────────

      if (playerHealth.health <= 0) {
        gameWorld.progression.recordDeath();
        playerHealth.reset();
        player.position.x = curRoom.defaultSpawn.x;
        player.position.y = curRoom.defaultSpawn.y;
        player.velocity.x = 0;
        player.velocity.y = 0;
        hud.notify("You died", "warning");
      }

      // ── Camera follow ─────────────────────────────────────────

      const playerCenter: Vec2 = {
        x: player.position.x + player.size.x / 2,
        y: player.position.y + player.size.y / 2,
      };
      camera.follow(playerCenter, player.velocity, dt);

      // ── Combat ────────────────────────────────────────────────

      if (input.isPressed(InputAction.WeaponSwitch)) {
        selectedWeapon = selectedWeapon === "quill-spear" ? "ink-snap" : "quill-spear";
        combat.currentWeapon = selectedWeapon;
      }

      const playerState = player.stateMachine.getCurrentState();
      if (input.isPressed(InputAction.Attack) && combat.canAttack(playerState)) {
        if (selectedWeapon === "quill-spear") {
          combat.startSpearAttack(getAttackDirection(input, player.facingRight));
        } else {
          const targets = activeEnemies
            .filter((e) => e.isAlive && e.invincibilityFrames <= 0)
            .map((e) => ({ id: e.id, bounds: e.getBounds() }));
          const aim = combat.findSnapTarget(playerCenter, targets);
          combat.startSnapAttack(
            aim?.position ?? null,
            aim?.id ?? null,
            player.facingRight,
          );
        }
      }

      combat.update(player.getBounds(), player.facingRight);

      // Hit detection
      if (combat.activeHitbox && combat.attackPhase === "active") {
        const hitTargets = activeEnemies
          .filter((e) => e.isAlive && e.invincibilityFrames <= 0)
          .map((e) => ({ id: e.id, bounds: e.getBounds() }));
        const hits = combat.checkHits(hitTargets);
        for (const hit of hits) {
          const enemy = activeEnemies.find((e) => e.id === hit.targetId);
          if (enemy) {
            const hitstop = combat.currentWeapon === "quill-spear"
              ? combat.params.spearHitstopFrames
              : combat.params.snapHitstopFrames;
            enemy.takeDamage(hit.damage, hit.knockback, hitstop);
            const si = combat.currentWeapon === "quill-spear"
              ? combat.params.spearShakeIntensity
              : combat.params.snapShakeIntensity;
            const sf = combat.currentWeapon === "quill-spear"
              ? combat.params.spearShakeFrames
              : combat.params.snapShakeFrames;
            screenShake.shake(si, sf);
            const angle = Math.atan2(hit.knockback.y, hit.knockback.x);
            particleSystem.emit({
              x: hit.hitPosition.x, y: hit.hitPosition.y,
              count: 6, speedMin: 60, speedMax: 150,
              angleMin: angle - 0.5, angleMax: angle + 0.5,
              lifeMin: 0.12, lifeMax: 0.3, sizeMin: 2, sizeMax: 4,
              colors: ["#1e1b4b", "#4338ca", "#e0e7ff"], gravity: 200,
            });
          }
        }
      }

      // ── Abilities ─────────────────────────────────────────────

      const tileMap = gameWorld.roomManager.currentTileMap;
      marginStitch.scanForPairs(playerCenter, tileMap);
      if (input.isPressed(InputAction.Ability1) && marginStitch.canActivate) {
        marginStitch.activate(playerCenter.y);
      }
      marginStitch.update(dt);

      const aimDir = getAimDirection(input, player.facingRight);
      redaction.scanForTargets(playerCenter, aimDir, currentObstacles);
      if (input.isPressed(InputAction.Ability2) && redaction.canActivate) {
        redaction.activate();
      }
      redaction.update(dt);

      const groundPlat = tileMap.getGroundPlatform(player);
      if (groundPlat?.surfaceType && groundPlat.surfaceType !== "normal") {
        pasteOver.autoCapture(groundPlat.surfaceType);
      }
      pasteOver.targetPlatform = groundPlat;
      if (input.isPressed(InputAction.Ability3) && pasteOver.canActivate) {
        pasteOver.activate();
      }
      pasteOver.update(dt);

      if (input.isPressed(InputAction.Ability3)) indexMark.onKeyDown();
      if (input.isHeld(InputAction.Ability3)) indexMark.onKeyHeld(input);
      if (input.isReleased(InputAction.Ability3)) {
        const result = indexMark.onKeyUp(playerCenter, player.grounded);
        if (result?.action === "teleport") {
          player.position.x = result.targetPosition.x - player.size.x / 2;
          player.position.y = result.targetPosition.y - player.size.y / 2;
          player.velocity.x = 0;
          player.velocity.y = 0;
        }
      }
      indexMark.update(dt);

      // ── Auto-open gates on proximity ──────────────────────────

      for (const gate of gameWorld.roomManager.currentGates) {
        if (gate.opened) continue;
        const gateCenter = {
          x: gate.rect.x + gate.rect.width / 2,
          y: gate.rect.y + gate.rect.height / 2,
        };
        const dist = Math.hypot(
          playerCenter.x - gateCenter.x,
          playerCenter.y - gateCenter.y,
        );
        if (dist < 60) {
          if (gameWorld.tryOpenGate(gate.id)) {
            hud.notify(`Gate opened (${gate.requiredAbility})`, "gate");
          }
        }
      }

      // ── Health / Damage ───────────────────────────────────────

      playerHealth.update();
      const canTakeDmg = playerHealth.canTakeDamage(playerState, player.isDashing);

      // Obstacle damage
      if (canTakeDmg) {
        const hitObs = checkDamageOverlap(player.getBounds(), currentObstacles);
        if (hitObs) {
          const dir = player.position.x < hitObs.rect.x + hitObs.rect.width / 2 ? -1 : 1;
          playerHealth.takeDamage(hitObs.damage, { x: dir, y: -0.5 }, hitObs.type);
        }
      }

      // Enemy contact damage
      if (canTakeDmg) {
        for (const enemy of activeEnemies) {
          if (!enemy.isAlive) continue;
          const eb = enemy.getBounds();
          const pb = player.getBounds();
          if (
            pb.x < eb.x + eb.width &&
            pb.x + pb.width > eb.x &&
            pb.y < eb.y + eb.height &&
            pb.y + pb.height > eb.y
          ) {
            const dir = player.position.x < enemy.position.x ? -1 : 1;
            playerHealth.takeDamage(enemy.contactDamage, { x: dir, y: -0.5 }, "contact");
            break;
          }
        }
      }

      // Knockback
      const kb = playerHealth.getKnockbackVelocity();
      if (kb) {
        player.velocity.x += kb.x * dt * 60;
        player.velocity.y += kb.y * dt * 60;
      }

      // ── Corruption (non-hub rooms) ────────────────────────────

      if (!worldFrame.isHub) {
        corruption.update(
          dt,
          worldFrame.corruptionIntensity,
          tileMap.platforms.length,
          curRoom.width,
          curRoom.height,
        );

        // Gravity pulse
        const gravMul = corruption.getGravityMultiplier();
        if (gravMul !== 1.0) {
          player.velocity.y += (gravMul - 1) * 980 * dt;
        }

        // Ink bleed particles
        for (const pos of corruption.pendingInkBleeds) {
          particleSystem.emit({
            x: pos.x, y: pos.y, count: 1,
            speedMin: 10, speedMax: 40,
            angleMin: -Math.PI, angleMax: Math.PI,
            lifeMin: 0.3, lifeMax: 0.6,
            sizeMin: 2, sizeMax: 5,
            colors: ["#4338ca", "#6366f1", "#1e1b4b"],
            gravity: 50,
          });
        }
      } else {
        corruption.reset();
      }

      // ── Enemy updates ─────────────────────────────────────────

      const playerRef: PlayerRef = {
        position: player.position,
        velocity: player.velocity,
        size: player.size,
        getBounds: () => player.getBounds(),
        facingRight: player.facingRight,
        grounded: player.grounded,
        isDashing: player.isDashing,
        stateMachine: player.stateMachine,
      };

      for (const enemy of activeEnemies) {
        enemy.playerRef = playerRef;
        enemy.update(dt);
      }

      // ── Particles & screen shake ──────────────────────────────

      particleSystem.update(dt);
      const shakeOff = screenShake.update();
      camera.position.x += shakeOff.offsetX;
      camera.position.y += shakeOff.offsetY;

      // ── HUD ───────────────────────────────────────────────────

      hud.update(dt);

      // ── Debug state update ────────────────────────────────────

      debugUpdateCounter++;
      if (debugUpdateCounter % 15 === 0) {
        const prog = gameWorld.progression;
        const t = prog.data.totalPlayTime;
        const mins = Math.floor(t / 60);
        const secs = Math.floor(t % 60);
        setDebugState({
          roomName: gameWorld.roomManager.currentRoom.name,
          roomId: gameWorld.roomManager.currentRoom.id,
          biome: gameWorld.roomManager.currentRoom.biomeId,
          roomsVisited: prog.data.visitedRooms.size,
          totalRooms: worldGraph.getRoomCount(),
          gatesOpened: prog.data.openedGates.size,
          deaths: prog.data.deathCount,
          playTime: `${mins}:${secs.toString().padStart(2, "0")}`,
          timeOfDay: worldFrame.timeOfDay,
          lightLevel: Math.round(worldFrame.lightLevel * 100) / 100,
          corruptionIntensity: Math.round(worldFrame.corruptionIntensity * 100) / 100,
        });
      }
    });

    // ─── Render Callback (world-space) ───────────────────────────

    engine.onRender((renderer, interpolation) => {
      const rCtx = renderer.getContext();
      const worldFrame = refsRef.current.worldFrame;
      const theme = gameWorld.currentTheme;

      // ── Background ────────────────────────────────────────────

      // Day/night atmosphere background (or biome background for hub)
      if (worldFrame) {
        if (worldFrame.isHub) {
          rCtx.save();
          rCtx.setTransform(1, 0, 0, 1, 0, 0);
          rCtx.fillStyle = theme.backgroundColor;
          rCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          rCtx.restore();
        } else {
          rCtx.save();
          rCtx.setTransform(1, 0, 0, 1, 0, 0);
          DayNightRenderer.renderBackground(rCtx, worldFrame.atmosphereColors, CANVAS_WIDTH, CANVAS_HEIGHT);
          rCtx.restore();
        }
      }

      // ── TileMap (biome-themed) ────────────────────────────────

      const tileMap = gameWorld.roomManager.currentTileMap;
      for (let i = 0; i < tileMap.platforms.length; i++) {
        const p = tileMap.platforms[i];
        rCtx.fillStyle = theme.platformFillColor;
        rCtx.fillRect(p.x, p.y, p.width, p.height);
        rCtx.strokeStyle = theme.platformStrokeColor;
        rCtx.lineWidth = 1;
        rCtx.strokeRect(p.x, p.y, p.width, p.height);

        // Corruption platform darkness + flicker
        if (worldFrame && !worldFrame.isHub && worldFrame.corruptionIntensity > 0) {
          DayNightRenderer.renderPlatformDarkness(
            rCtx, p.x, p.y, p.width, p.height,
            worldFrame.atmosphereColors.platformDarkness,
            corruption.isPlatformFlickering(i),
          );
        }
      }

      // ── Obstacles ─────────────────────────────────────────────

      for (const obs of currentObstacles) {
        if (!obs.active) continue;
        rCtx.fillStyle = obs.color;
        rCtx.fillRect(obs.rect.x, obs.rect.y, obs.rect.width, obs.rect.height);
        if (obs.type === "spikes") {
          rCtx.fillStyle = "#991b1b";
          const sw = 8;
          const count = Math.floor(obs.rect.width / sw);
          for (let i = 0; i < count; i++) {
            const sx = obs.rect.x + i * sw;
            rCtx.beginPath();
            rCtx.moveTo(sx, obs.rect.y);
            rCtx.lineTo(sx + sw / 2, obs.rect.y - 6);
            rCtx.lineTo(sx + sw, obs.rect.y);
            rCtx.closePath();
            rCtx.fill();
          }
        }
      }

      // ── Room elements ─────────────────────────────────────────

      renderTime += 1 / 60;
      renderGates(rCtx, gameWorld.roomManager.currentGates, renderTime);
      renderExitIndicators(rCtx, gameWorld.roomManager.currentRoom.exits, renderTime);

      // ── Enemies ───────────────────────────────────────────────

      for (const enemy of activeEnemies) {
        if (enemy.isAlive || enemy.deathProgress < 1) {
          enemy.render(renderer, interpolation);
        }
      }

      // ── Player ────────────────────────────────────────────────

      const showPlayer = playerHealth.invincibilityTimer <= 0 ||
        Math.floor(playerHealth.invincibilityTimer / 4) % 2 === 0;
      if (showPlayer) {
        if (playerHealth.invincibilityTimer > 0 && playerHealth.knockbackTimer > 0) {
          const oldColor = player.color;
          player.color = "#ef4444";
          player.render(renderer, interpolation);
          player.color = oldColor;
        } else {
          player.render(renderer, interpolation);
        }
      } else {
        player.render(renderer, interpolation);
      }

      // ── Combat visuals ────────────────────────────────────────

      combat.render(rCtx, camera);

      // ── Ability visuals ───────────────────────────────────────

      marginStitch.render(rCtx);
      redaction.render(rCtx);
      pasteOver.render(rCtx);
      indexMark.render(rCtx);

      // ── Particles ─────────────────────────────────────────────

      particleSystem.render(renderer);

      // ── Debug overlays (world space) ──────────────────────────

      if (showOverlaysRef.current) {
        const pos = player.getInterpolatedPosition(interpolation);
        renderer.strokeRect(pos.x, pos.y, player.size.x, player.size.y, COLORS.debug.hitbox, 1);
        const state = player.stateMachine.getCurrentState();
        renderer.drawText(state, pos.x, pos.y - 8, COLORS.debug.stateLabel, 10);
      }
    });

    // ─── Screen-Space Debug Layer ────────────────────────────────

    const debugLayerCb = (debugCtx: CanvasRenderingContext2D) => {
      const worldFrame = refsRef.current.worldFrame;

      // Day/night overlays (non-hub)
      if (worldFrame && !worldFrame.isHub) {
        DayNightRenderer.renderLightOverlay(debugCtx, worldFrame.atmosphereColors, CANVAS_WIDTH, CANVAS_HEIGHT);

        if (corruption.isFogActive()) {
          const pScreen = camera.worldToScreen({
            x: player.position.x + player.size.x / 2,
            y: player.position.y + player.size.y / 2,
          });
          DayNightRenderer.renderFogOfWar(
            debugCtx, pScreen, corruption.getFogRadius(),
            worldFrame.atmosphereColors.fogColor, CANVAS_WIDTH, CANVAS_HEIGHT,
          );
        }

        if (worldFrame.corruptionIntensity > 0.5) {
          DayNightRenderer.renderCorruptionDistortion(
            debugCtx, worldFrame.corruptionIntensity, CANVAS_WIDTH, CANVAS_HEIGHT,
          );
        }
      }

      // Transition overlay
      const transAlpha = gameWorld.roomManager.getTransitionAlpha();
      if (transAlpha > 0) {
        renderTransitionOverlay(debugCtx, transAlpha, CANVAS_WIDTH, CANVAS_HEIGHT);
      }

      // HUD
      hud.render(debugCtx, CANVAS_WIDTH, CANVAS_HEIGHT);
      hud.renderPauseMenu(debugCtx, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Minimap
      if (hudConfigRef.current.showMinimap) {
        const curRoom = gameWorld.roomManager.currentRoom;
        const fx = Math.max(0, Math.min(1, (player.position.x + player.size.x / 2) / curRoom.width));
        const fy = Math.max(0, Math.min(1, (player.position.y + player.size.y / 2) / curRoom.height));
        renderMinimap(
          debugCtx, minimapData,
          curRoom.id,
          gameWorld.progression.data.visitedRooms,
          worldGraph.data.hubRoomId,
          fx, fy,
        );
      }

      // FPS
      if (showOverlaysRef.current) {
        const metrics = engine.getMetrics();
        debugCtx.fillStyle = COLORS.debug.ground;
        debugCtx.font = "10px monospace";
        debugCtx.textAlign = "center";
        debugCtx.fillText(`FPS: ${Math.round(metrics.fps)}`, CANVAS_WIDTH / 2, 12);
        debugCtx.textAlign = "left";
      }
    };
    engine.getRenderer().addLayerCallback("debug", debugLayerCb);

    // ─── Room transition callback ────────────────────────────────

    gameWorld.onRoomTransition((result) => {
      player.position.x = result.spawnX;
      player.position.y = result.spawnY;
      player.velocity.x = 0;
      player.velocity.y = 0;
      player.grounded = false;
      camera.snapTo({ x: result.spawnX, y: result.spawnY });
      handleRoomSwap();
    });

    engine.start();
  }, []);

  const handleUnmount = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    refsRef.current = {};
  }, []);

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-zinc-800 px-4 py-2">
        <Link
          href="/test"
          className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          &larr; Tests
        </Link>
        <h1 className="font-mono text-sm font-bold text-amber-500">
          World Assembly
        </h1>
        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-mono text-amber-400">
          Phase 6 &mdash; Integration
        </span>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas area */}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
          <GameCanvas onMount={handleMount} onUnmount={handleUnmount} />

          {/* Pass criteria */}
          <div className="w-[960px] text-xs font-mono text-zinc-500 leading-relaxed">
            <span className="text-zinc-400">Pass criteria: </span>
            Scribe Hall loads &middot; Room transition works &middot;
            Biome theme changes &middot; Multi-room traversal &middot;
            Archive Passage route &middot; Day/night runs globally &middot;
            Hub is safe &middot; Corruption in non-hub &middot;
            Gates work &middot; Enemies spawn &middot;
            Progression tracks visits &middot; Minimap renders &middot;
            Player dot on minimap &middot; Return to hub &middot;
            Room name HUD
          </div>

          {/* Controls legend */}
          <div className="w-[960px] text-xs font-mono text-zinc-600 leading-relaxed">
            <span className="text-zinc-500">Controls: </span>
            Arrows = Move &middot; Z/Space = Jump &middot; X/Shift = Dash &middot;
            Down = Crouch &middot; J = Attack &middot; K = Switch Weapon &middot;
            E = Stitch &middot; Q = Redaction &middot; R = Paste/Index &middot;
            ESC = Pause
          </div>
        </div>

        {/* Debug panel */}
        <DebugPanel title="World Assembly">
          <RenderModeToggle />
          {/* World State */}
          <details open>
            <summary className="text-xs font-mono text-amber-400/80 uppercase tracking-wider cursor-pointer select-none">
              World State
            </summary>
            <div className="mt-2 flex flex-col gap-0.5 text-xs font-mono">
              <div className="text-zinc-400">
                Room: <span className="text-zinc-200">{debugState.roomName}</span>
              </div>
              <div className="text-zinc-400">
                ID: <span className="text-zinc-500">{debugState.roomId}</span>
              </div>
              <div className="text-zinc-400">
                Biome: <span className="text-zinc-300">{debugState.biome}</span>
              </div>
              <div className="text-zinc-400">
                Rooms visited: <span className="text-zinc-200">{debugState.roomsVisited}</span>
                <span className="text-zinc-600"> / {debugState.totalRooms}</span>
              </div>
              <div className="text-zinc-400">
                Gates opened: <span className="text-zinc-200">{debugState.gatesOpened}</span>
              </div>
              <div className="text-zinc-400">
                Deaths: <span className="text-zinc-200">{debugState.deaths}</span>
              </div>
              <div className="text-zinc-400">
                Play time: <span className="text-zinc-200">{debugState.playTime}</span>
              </div>
            </div>
          </details>

          {/* Day/Night */}
          <details>
            <summary className="text-xs font-mono text-indigo-400/80 uppercase tracking-wider cursor-pointer select-none pt-2">
              Day/Night
            </summary>
            <div className="mt-2 flex flex-col gap-1.5">
              <div className="text-xs font-mono text-zinc-400">
                Phase: <span className="text-zinc-200">{debugState.timeOfDay}</span>
              </div>
              <div className="text-xs font-mono text-zinc-400">
                Light: <span className="text-zinc-200">{debugState.lightLevel}</span>
              </div>
              <div className="text-xs font-mono text-zinc-400">
                Corruption: <span className="text-zinc-200">{debugState.corruptionIntensity}</span>
              </div>
              <Slider
                label="Cycle Speed"
                value={cycleSpeed}
                min={0.1}
                max={5.0}
                step={0.1}
                onChange={(v) => setCycleSpeed(v)}
              />
              <div className="flex gap-1">
                <button
                  onClick={() => skipToPhase("dawn")}
                  className="flex-1 rounded bg-orange-900/40 px-1.5 py-0.5 text-xs font-mono text-orange-300 hover:bg-orange-900/60"
                >
                  Dawn
                </button>
                <button
                  onClick={() => skipToPhase("day")}
                  className="flex-1 rounded bg-yellow-900/40 px-1.5 py-0.5 text-xs font-mono text-yellow-300 hover:bg-yellow-900/60"
                >
                  Day
                </button>
                <button
                  onClick={() => skipToPhase("dusk")}
                  className="flex-1 rounded bg-amber-900/40 px-1.5 py-0.5 text-xs font-mono text-amber-300 hover:bg-amber-900/60"
                >
                  Dusk
                </button>
                <button
                  onClick={() => skipToPhase("night")}
                  className="flex-1 rounded bg-indigo-900/40 px-1.5 py-0.5 text-xs font-mono text-indigo-300 hover:bg-indigo-900/60"
                >
                  Night
                </button>
              </div>
            </div>
          </details>

          {/* HUD Config */}
          <details>
            <summary className="text-xs font-mono text-purple-400/80 uppercase tracking-wider cursor-pointer select-none pt-2">
              HUD Config
            </summary>
            <div className="mt-2 flex flex-col gap-1">
              {(Object.keys(hudConfig) as Array<keyof GameHUDConfig>).map((key) => (
                <label key={key} className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                  <input
                    type="checkbox"
                    checked={hudConfig[key]}
                    onChange={(e) => updateHudConfig(key, e.target.checked)}
                    className="accent-purple-500"
                  />
                  {key.replace(/([A-Z])/g, " $1").replace(/^show /, "Show ")}
                </label>
              ))}
            </div>
          </details>

          {/* Room Map */}
          <details>
            <summary className="text-xs font-mono text-green-400/80 uppercase tracking-wider cursor-pointer select-none pt-2">
              Room Map
            </summary>
            <div className="mt-2 flex flex-col gap-0.5 text-xs font-mono">
              {[
                { id: "scribe-hall", name: "Scribe Hall", exits: "→ Tutorial Corridor, → Archive Passage" },
                { id: "tutorial-corridor", name: "Tutorial Corridor", exits: "← Scribe Hall, → Vertical Shaft" },
                { id: "archive-passage", name: "Archive Passage", exits: "← Scribe Hall, → Vertical Shaft" },
                { id: "vertical-shaft", name: "Vertical Shaft", exits: "← Tutorial Corridor, ↑ Vine Garden" },
                { id: "vine-garden", name: "Vine Garden", exits: "↓ Vertical Shaft" },
              ].map((r) => (
                <div key={r.id} className={`${r.id === debugState.roomId ? "text-amber-300" : "text-zinc-500"}`}>
                  {r.id === debugState.roomId ? "▸ " : "  "}
                  {r.name}
                  <span className="text-zinc-700 ml-1">({r.exits})</span>
                </div>
              ))}
            </div>
          </details>

          {/* Controls */}
          <div className="border-t border-zinc-800 pt-2 mt-2 flex flex-col gap-2">
            <button
              onClick={() => setShowOverlays((p) => !p)}
              className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700"
            >
              {showOverlays ? "Hide" : "Show"} Debug Overlays
            </button>
          </div>
        </DebugPanel>
      </div>
    </div>
  );
}
