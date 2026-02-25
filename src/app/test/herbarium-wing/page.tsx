"use client";

import { useRef, useState, useCallback } from "react";
import { GameCanvas } from "@/components/canvas/GameCanvas";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { Slider } from "@/components/debug/Slider";
import { RenderModeToggle } from "@/components/debug/RenderModeToggle";
import { Engine } from "@/engine/core/Engine";
import { Player, DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";
import type { PlayerParams } from "@/engine/entities/Player";
import { ParticleSystem } from "@/engine/core/ParticleSystem";
import { ScreenShake } from "@/engine/core/ScreenShake";
import { RenderConfig } from "@/engine/core/RenderConfig";
import { CombatSystem } from "@/engine/combat/CombatSystem";
import type { AttackDirection } from "@/engine/combat/types";
import { PlayerHealth } from "@/engine/combat/PlayerHealth";
import { InputAction } from "@/engine/input/InputManager";
import type { InputManager } from "@/engine/input/InputManager";
import { VineSystem, DEFAULT_VINE_PARAMS } from "@/engine/world/VineSystem";
import type { VineParams } from "@/engine/world/VineSystem";
import { HERBARIUM_FOLIO_THEME } from "@/engine/world/Biome";
import { createHerbariumBackground } from "@/engine/world/BiomeBackground";
import { RoomManager } from "@/engine/world/RoomManager";
import type { RoomData, GateAbility } from "@/engine/world/Room";
import {
  renderGates,
  renderExitIndicators,
  renderBounds,
  renderTransitionOverlay,
} from "@/engine/world/RoomRenderer";
import { PRESET_ROOMS } from "@/engine/world/presetRooms";
import {
  HERBARIUM_WING_ROOMS,
  ELDER_BINDER_PARAMS,
} from "@/engine/world/herbariumRooms";
import { Reader } from "@/engine/entities/enemies/Reader";
import { Binder } from "@/engine/entities/enemies/Binder";
import { Proofwarden } from "@/engine/entities/enemies/Proofwarden";
import type { PlayerRef, Enemy } from "@/engine/entities/Enemy";
import { getSurfaceProps } from "@/engine/physics/Surfaces";
import { aabbOverlap } from "@/engine/physics/AABB";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/constants";
import type { Rect } from "@/lib/types";
import type { Renderer } from "@/engine/core/Renderer";
import Link from "next/link";

// ─── Constants ──────────────────────────────────────────────────────

const ALL_ABILITIES = new Set<GateAbility>([
  "margin-stitch",
  "redaction",
  "paste-over",
  "index-mark",
]);

const STARTING_ROOM = "vine-vestibule";

// ─── Helpers ────────────────────────────────────────────────────────

function getAttackDirection(input: InputManager, facingRight: boolean): AttackDirection {
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

function createEnemiesForRoom(room: RoomData): Enemy[] {
  const enemies: Enemy[] = [];
  for (const spawn of room.enemies) {
    const isElderBinder = spawn.id === "hh_elder_binder";
    switch (spawn.type) {
      case "reader":
        enemies.push(
          new Reader({
            position: { x: spawn.position.x, y: spawn.position.y },
            patrol: (spawn.patrolRange ?? 0) > 0,
            patrolRange: spawn.patrolRange,
          }),
        );
        break;
      case "binder":
        enemies.push(
          new Binder({
            position: { x: spawn.position.x, y: spawn.position.y },
            params: isElderBinder ? { ...ELDER_BINDER_PARAMS } : undefined,
          }),
        );
        break;
      case "proofwarden":
        enemies.push(
          new Proofwarden({
            position: { x: spawn.position.x, y: spawn.position.y },
          }),
        );
        break;
    }
  }
  return enemies;
}

/** Biome platform renderer */
function renderBiomePlatforms(
  ctx: CanvasRenderingContext2D,
  platforms: Array<{ x: number; y: number; width: number; height: number; surfaceType?: string }>,
): void {
  const theme = HERBARIUM_FOLIO_THEME;
  for (const plat of platforms) {
    if (plat.surfaceType) {
      const surfProps = getSurfaceProps(plat.surfaceType as "bouncy" | "icy" | "sticky" | "conveyor");
      const r = parseInt(surfProps.color.slice(1, 3), 16);
      const g = parseInt(surfProps.color.slice(3, 5), 16);
      const b = parseInt(surfProps.color.slice(5, 7), 16);
      ctx.fillStyle = `rgb(${Math.round(r * 0.3)}, ${Math.round(g * 0.3)}, ${Math.round(b * 0.3)})`;
      ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
      ctx.strokeStyle = surfProps.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(plat.x, plat.y, plat.width, plat.height);
    } else {
      ctx.fillStyle = theme.platformFillColor;
      ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
      ctx.strokeStyle = theme.platformStrokeColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(plat.x, plat.y, plat.width, plat.height);
    }

    // Grassy top line for horizontal platforms
    if (plat.width > plat.height && plat.height <= 80) {
      ctx.strokeStyle = "#4ade80";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plat.x, plat.y);
      ctx.lineTo(plat.x + plat.width, plat.y);
      ctx.stroke();
    }
  }
}

// ─── Pass Criteria ──────────────────────────────────────────────────

interface PassCriteria {
  vestibuleLoads: boolean;
  vineTutorialWorks: boolean;
  roomTransition: boolean;
  allRoomsAccessible: boolean;
  bidirectionalExits: boolean;
  enemiesSpawn: boolean;
  vineChaining: boolean;
  marginStitchGate: boolean;
  redactionGate: boolean;
  surfaceTypesWork: boolean;
  elderBinderFight: boolean;
  cameraBounds: boolean;
  biomeTheme: boolean;
}

// ─── World State ────────────────────────────────────────────────────

interface WorldState {
  currentRoom: string;
  currentRoomId: string;
  roomsVisited: Set<string>;
  gatesOpened: number;
  enemiesDefeated: number;
  elderBinderDefeated: boolean;
}

// ─── Test Page ──────────────────────────────────────────────────────

export default function HerbariumWingTest() {
  const engineRef = useRef<Engine | null>(null);
  const playerRef = useRef<Player | null>(null);
  const roomManagerRef = useRef<RoomManager | null>(null);
  const vineSystemRef = useRef<VineSystem | null>(null);
  const enemiesRef = useRef<Enemy[]>([]);
  const combatSystemRef = useRef<CombatSystem | null>(null);
  const playerHealthRef = useRef<PlayerHealth | null>(null);
  const worldStateRef = useRef<WorldState>({
    currentRoom: "Vine Vestibule",
    currentRoomId: STARTING_ROOM,
    roomsVisited: new Set([STARTING_ROOM]),
    gatesOpened: 0,
    enemiesDefeated: 0,
    elderBinderDefeated: false,
  });

  const [params, setParams] = useState<PlayerParams>({ ...DEFAULT_PLAYER_PARAMS });
  const [vineParams, setVineParams] = useState<VineParams>({ ...DEFAULT_VINE_PARAMS });
  const [, forceUpdate] = useState(0);
  const [criteria, setCriteria] = useState<PassCriteria>({
    vestibuleLoads: false,
    vineTutorialWorks: false,
    roomTransition: false,
    allRoomsAccessible: false,
    bidirectionalExits: false,
    enemiesSpawn: false,
    vineChaining: false,
    marginStitchGate: false,
    redactionGate: false,
    surfaceTypesWork: false,
    elderBinderFight: false,
    cameraBounds: false,
    biomeTheme: false,
  });

  const updateParam = useCallback(
    <K extends keyof PlayerParams>(key: K, value: PlayerParams[K]) => {
      setParams((prev) => {
        const next = { ...prev, [key]: value };
        const player = playerRef.current;
        if (player) player.params[key] = value;
        return next;
      });
    },
    [],
  );

  const updateVineParam = useCallback(
    <K extends keyof VineParams>(key: K, value: VineParams[K]) => {
      setVineParams((prev) => {
        const next = { ...prev, [key]: value };
        const vs = vineSystemRef.current;
        if (vs) vs.params[key] = value;
        return next;
      });
    },
    [],
  );

  // ─── Room Transition Handler ──────────────────────────────────────

  const loadRoomSystems = useCallback((roomManager: RoomManager, engine: Engine, player: Player) => {
    const room = roomManager.currentRoom;
    const camera = engine.getCamera();

    // Camera bounds
    camera.bounds = { x: 0, y: 0, width: room.width, height: room.height };

    // Create vine system for rooms with vine anchors
    if (roomManager.currentVineAnchors.length > 0) {
      vineSystemRef.current = new VineSystem(roomManager.currentVineAnchors);
    } else {
      vineSystemRef.current = null;
    }

    // Create enemies for the room
    const enemies = createEnemiesForRoom(room);
    enemiesRef.current = enemies;

    // Re-assign tileMap to player
    player.tileMap = roomManager.currentTileMap;

    // Update world state
    const ws = worldStateRef.current;
    ws.currentRoom = room.name;
    ws.currentRoomId = room.id;
    ws.roomsVisited.add(room.id);

    // Track criteria
    if (room.id === STARTING_ROOM) {
      setCriteria((c) => ({ ...c, vestibuleLoads: true, biomeTheme: true, cameraBounds: true }));
    }
    if (ws.roomsVisited.size >= 8) {
      setCriteria((c) => ({ ...c, allRoomsAccessible: true }));
    }
    if (enemies.length > 0) {
      setCriteria((c) => ({ ...c, enemiesSpawn: true }));
    }

    forceUpdate((n) => n + 1);
  }, []);

  // ─── Engine Mount ─────────────────────────────────────────────────

  const handleMount = useCallback((ctx: CanvasRenderingContext2D) => {
    RenderConfig.setMode("rectangles");
    const engine = new Engine({ ctx });
    const camera = engine.getCamera();
    const input = engine.getInput();

    // Build rooms map (preset rooms + herbarium wing rooms)
    const allRooms = new Map<string, RoomData>();
    for (const [id, room] of Object.entries(PRESET_ROOMS)) {
      allRooms.set(id, JSON.parse(JSON.stringify(room)));
    }
    for (const [id, room] of Object.entries(HERBARIUM_WING_ROOMS)) {
      allRooms.set(id, JSON.parse(JSON.stringify(room)));
    }

    const roomManager = new RoomManager({
      rooms: allRooms,
      startingRoomId: STARTING_ROOM,
    });

    // Player
    const player = new Player();
    player.position = { ...roomManager.currentRoom.defaultSpawn };
    player.velocity = { x: 0, y: 0 };
    player.input = input;
    player.tileMap = roomManager.currentTileMap;

    const particleSystem = new ParticleSystem();
    const screenShake = new ScreenShake();
    player.particleSystem = particleSystem;
    player.screenShake = screenShake;

    // Combat
    const combatSystem = new CombatSystem();
    const playerHealth = new PlayerHealth();

    engine.getEntities().add(player);

    // Biome background (max size for largest room)
    const biomeBackground = createHerbariumBackground(1920, 1080);
    const theme = HERBARIUM_FOLIO_THEME;

    // Store refs
    engineRef.current = engine;
    playerRef.current = player;
    roomManagerRef.current = roomManager;
    combatSystemRef.current = combatSystem;
    playerHealthRef.current = playerHealth;

    // Initial room load
    loadRoomSystems(roomManager, engine, player);
    camera.snapTo({
      x: player.position.x + player.size.x / 2,
      y: player.position.y + player.size.y / 2,
    });

    // Track vine chaining
    let vineChainCount = 0;
    let lastVineDetachTime = 0;

    // Ambient particle accumulator
    let ambientParticleAccum = 0;
    let gameTime = 0;

    // Track backtrack transitions for bidirectional criterion
    const transitionHistory: string[] = [STARTING_ROOM];

    // ─── Update ─────────────────────────────────────────────────

    engine.onUpdate((dt) => {
      gameTime += dt;

      // Room transition handling
      if (roomManager.transitioning) {
        const result = roomManager.updateTransition(dt);
        if (result) {
          player.position = { x: result.spawnX, y: result.spawnY };
          player.velocity = { x: 0, y: 0 };
          player.grounded = false;
          player.active = true;

          // Reset vine system on room change
          if (vineSystemRef.current?.isSwinging) {
            vineSystemRef.current.reset();
          }

          loadRoomSystems(roomManager, engine, player);
          camera.snapTo({
            x: player.position.x + player.size.x / 2,
            y: player.position.y + player.size.y / 2,
          });

          // Track bidirectional transitions
          transitionHistory.push(result.roomId);
          if (transitionHistory.length >= 3) {
            const last3 = transitionHistory.slice(-3);
            if (last3[0] === last3[2] && last3[0] !== last3[1]) {
              setCriteria((c) => ({ ...c, bidirectionalExits: true }));
            }
          }

          setCriteria((c) => ({ ...c, roomTransition: true }));
        }
        particleSystem.update(dt);
        return;
      }

      const vineSystem = vineSystemRef.current;
      const enemies = enemiesRef.current;

      // ─── Vine Input ───────────────────────────────────────────

      if (vineSystem) {
        vineSystem.swayTime += dt;

        if (vineSystem.isSwinging) {
          let shouldDetach = false;
          if (input.isPressed(InputAction.Ability1)) shouldDetach = true;
          if (vineSystem.params.jumpDetaches &&
              (input.isPressed(InputAction.Jump) || input.isPressed(InputAction.Up))) {
            shouldDetach = true;
          }
          const dashDetach = input.isPressed(InputAction.Dash) && player.dashAvailable;
          if (dashDetach) shouldDetach = true;

          if (shouldDetach) {
            const releaseVel = vineSystem.detach();
            player.position.x = vineSystem.swingPosition.x;
            player.position.y = vineSystem.swingPosition.y;
            player.velocity.x = releaseVel.x;
            player.velocity.y = releaseVel.y;
            player.grounded = false;
            player.active = true;
            lastVineDetachTime = gameTime;
          } else {
            const inputLeft = input.isHeld(InputAction.Left);
            const inputRight = input.isHeld(InputAction.Right);
            const inputUp = input.isHeld(InputAction.Up);
            const inputDown = input.isHeld(InputAction.Down);
            const newPos = vineSystem.update(dt, inputLeft, inputRight, inputUp, inputDown);

            // Platform collision during swing → auto-detach
            const swingBounds: Rect = { x: newPos.x, y: newPos.y, width: player.size.x, height: player.size.y };
            let collides = false;
            for (const plat of roomManager.currentTileMap.platforms) {
              if (aabbOverlap(swingBounds, plat)) { collides = true; break; }
            }

            if (collides) {
              const releaseVel = vineSystem.detach();
              player.velocity.x = releaseVel.x * 0.5;
              player.velocity.y = releaseVel.y * 0.5;
              player.grounded = false;
              player.active = true;
              lastVineDetachTime = gameTime;
            } else {
              player.prevPosition.x = player.position.x;
              player.prevPosition.y = player.position.y;
              player.position.x = newPos.x;
              player.position.y = newPos.y;
            }
          }

          // Vine trail particles
          if (vineSystem.isSwinging && Math.abs(vineSystem.angularVelocity) > 3) {
            particleSystem.emit({
              x: player.position.x + player.size.x / 2,
              y: player.position.y + player.size.y / 2,
              count: 1, speedMin: 10, speedMax: 30,
              angleMin: 0, angleMax: Math.PI * 2,
              lifeMin: 0.3, lifeMax: 0.6, sizeMin: 2, sizeMax: 3,
              colors: ["#4ade80", "#86efac"], gravity: 0,
            });
          }

          setCriteria((c) => ({ ...c, vineTutorialWorks: true }));
        } else {
          // Check for vine attach
          if (input.isPressed(InputAction.Ability1)) {
            const playerCenter = {
              x: player.position.x + player.size.x / 2,
              y: player.position.y + player.size.y / 2,
            };
            const nearest = vineSystem.findNearestAnchor(playerCenter);
            if (nearest) {
              vineSystem.attach(nearest, playerCenter, player.velocity);
              player.active = false;
              player.position.x = vineSystem.swingPosition.x;
              player.position.y = vineSystem.swingPosition.y;

              // Vine chaining detection
              if (gameTime - lastVineDetachTime < 2.0) {
                vineChainCount++;
                if (vineChainCount >= 4) {
                  setCriteria((c) => ({ ...c, vineChaining: true }));
                }
              } else {
                vineChainCount = 1;
              }
            }
          }
        }
      }

      // ─── Player Surface Physics ───────────────────────────────

      if (!vineSystem?.isSwinging) {
        const tileMap = roomManager.currentTileMap;
        const groundSurface = tileMap.getGroundSurface({ position: player.position, size: player.size });
        player.currentSurface = getSurfaceProps(groundSurface);
        if (player.wallSide !== 0) {
          player.currentWallSurface = getSurfaceProps(
            tileMap.getWallSurface({ position: player.position, size: player.size }, player.wallSide as -1 | 1),
          );
        }

        // Track surface type usage
        if (groundSurface && groundSurface !== "normal") {
          setCriteria((c) => ({ ...c, surfaceTypesWork: true }));
        }
      }

      // ─── Combat Input ─────────────────────────────────────────

      if (input.isPressed(InputAction.Attack) && combatSystem.canAttack(player.stateMachine.getCurrentState())) {
        if (combatSystem.currentWeapon === "quill-spear") {
          combatSystem.startSpearAttack(getAttackDirection(input, player.facingRight));
        } else {
          const snapTargets = enemies.filter((e) => e.isAlive).map((e) => ({
            id: e.id,
            position: { x: e.position.x + e.size.x / 2, y: e.position.y + e.size.y / 2 },
          }));
          const closest = snapTargets.length > 0 ? snapTargets[0] : null;
          combatSystem.startSnapAttack(closest?.position ?? null, closest?.id ?? null);
        }
      }
      if (input.isPressed(InputAction.WeaponSwitch)) {
        combatSystem.currentWeapon = combatSystem.currentWeapon === "quill-spear" ? "ink-snap" : "quill-spear";
      }

      combatSystem.update(player.getBounds(), player.facingRight);

      // ─── Hit Detection: Player → Enemies ──────────────────────

      const hitTargets = enemies.filter((e) => e.isAlive && e.canBeDamaged()).map((e) => ({ id: e.id, bounds: e.getBounds() }));
      const hits = combatSystem.checkHits(hitTargets);
      for (const hit of hits) {
        const enemy = enemies.find((e) => e.id === hit.targetId);
        if (!enemy) continue;
        const hitstopFrames = combatSystem.currentWeapon === "quill-spear" ? 4 : 3;
        const damaged = enemy.takeDamage(hit.damage, hit.knockback, hitstopFrames);
        if (damaged) {
          particleSystem.emit({
            x: hit.hitPosition.x, y: hit.hitPosition.y, count: 5,
            speedMin: 50, speedMax: 150, angleMin: 0, angleMax: Math.PI * 2,
            lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 4,
            colors: ["#f59e0b", "#fbbf24", "#fff"], gravity: 200,
          });
          screenShake.shake(2, 3);
        }
        if (!enemy.isAlive) {
          worldStateRef.current.enemiesDefeated++;
          if (enemy.id.includes("elder") || (roomManager.currentRoom.id === "herbarium-heart" && enemy instanceof Binder)) {
            worldStateRef.current.elderBinderDefeated = true;
            setCriteria((c) => ({ ...c, elderBinderFight: true }));
          }
          forceUpdate((n) => n + 1);
        }
      }

      // ─── Enemy Updates ────────────────────────────────────────

      const room = roomManager.currentRoom;
      const playerAsRef: PlayerRef = {
        position: player.position,
        velocity: player.velocity,
        size: player.size,
        getBounds: () => player.getBounds(),
        facingRight: player.facingRight,
        grounded: player.grounded,
        isDashing: player.isDashing,
        stateMachine: { getCurrentState: () => player.stateMachine.getCurrentState() },
      };

      for (const enemy of enemies) {
        enemy.playerRef = playerAsRef;
        enemy.update(dt);
      }

      // ─── Enemy → Player Damage ────────────────────────────────

      const canTakeDmg = playerHealth.canTakeDamage(player.stateMachine.getCurrentState(), player.isDashing);
      for (const enemy of enemies) {
        if (!enemy.isAlive) continue;
        const overlap = aabbOverlap(player.getBounds(), enemy.getBounds());
        if (overlap && canTakeDmg) {
          const dir = player.position.x > enemy.position.x ? 1 : -1;
          playerHealth.takeDamage(enemy.contactDamage, { x: dir, y: -0.5 }, enemy.constructor.name);
        }
        // Binder thread pull
        if (enemy instanceof Binder && enemy.pullForce) {
          player.velocity.x += enemy.pullForce.x * dt * 60;
          player.velocity.y += enemy.pullForce.y * dt * 60;
        }
      }

      playerHealth.update();

      // Respawn on death
      if (playerHealth.health <= 0) {
        playerHealth.health = playerHealth.params.maxHealth;
        player.position = { ...roomManager.currentRoom.defaultSpawn };
        player.velocity = { x: 0, y: 0 };
        player.active = true;
        if (vineSystem?.isSwinging) vineSystem.reset();
        camera.snapTo({
          x: player.position.x + player.size.x / 2,
          y: player.position.y + player.size.y / 2,
        });
      }

      // ─── Ability Gates ────────────────────────────────────────

      for (const gate of roomManager.currentGates) {
        if (gate.opened) continue;
        const px = player.position.x;
        const py = player.position.y;
        const pw = player.size.x;
        const ph = player.size.y;
        const gx = gate.rect.x - 16;
        const gy = gate.rect.y - 16;
        const gw = gate.rect.width + 32;
        const gh = gate.rect.height + 32;
        if (px < gx + gw && px + pw > gx && py < gy + gh && py + ph > gy) {
          if (roomManager.tryOpenGate(gate, ALL_ABILITIES)) {
            player.tileMap = roomManager.currentTileMap;
            worldStateRef.current.gatesOpened++;
            forceUpdate((n) => n + 1);

            if (gate.requiredAbility === "margin-stitch") {
              setCriteria((c) => ({ ...c, marginStitchGate: true }));
            }
            if (gate.requiredAbility === "redaction") {
              setCriteria((c) => ({ ...c, redactionGate: true }));
            }
          }
        }
      }

      // ─── Exit Detection ───────────────────────────────────────

      const playerRect = {
        x: player.position.x,
        y: player.position.y,
        width: player.size.x,
        height: player.size.y,
      };
      const exit = roomManager.checkExits(playerRect);
      if (exit) {
        roomManager.startTransition(exit);
        if (vineSystem?.isSwinging) {
          vineSystem.reset();
          player.active = true;
        }
      }

      // ─── Camera & Particles ───────────────────────────────────

      const camTarget = vineSystem?.isSwinging
        ? { x: vineSystem.swingPosition.x + player.size.x / 2, y: vineSystem.swingPosition.y + player.size.y / 2 }
        : { x: player.position.x + player.size.x / 2, y: player.position.y + player.size.y / 2 };
      const camVel = vineSystem?.isSwinging ? vineSystem.swingVelocity : player.velocity;
      camera.follow(camTarget, camVel, dt);

      particleSystem.update(dt);
      const shakeOffset = screenShake.update();
      camera.position.x += shakeOffset.offsetX;
      camera.position.y += shakeOffset.offsetY;

      // Ambient particles
      ambientParticleAccum += theme.ambientParticleRate * dt;
      while (ambientParticleAccum >= 1) {
        ambientParticleAccum -= 1;
        const viewport = camera.getViewportBounds();
        particleSystem.emit({
          x: viewport.x + Math.random() * viewport.width,
          y: viewport.y - 10,
          count: 1, speedMin: 5, speedMax: 15,
          angleMin: Math.PI * 0.3, angleMax: Math.PI * 0.7,
          lifeMin: 3.0, lifeMax: 5.0, sizeMin: 2, sizeMax: 4,
          colors: theme.ambientParticleColors, gravity: 0,
        });
      }

      // Fall respawn
      if (player.position.y > roomManager.currentRoom.height + 200) {
        player.position = { ...roomManager.currentRoom.defaultSpawn };
        player.velocity = { x: 0, y: 0 };
        player.active = true;
        if (vineSystem?.isSwinging) vineSystem.reset();
        camera.snapTo({
          x: player.position.x + player.size.x / 2,
          y: player.position.y + player.size.y / 2,
        });
      }
    });

    // ─── Render ─────────────────────────────────────────────────

    engine.onRender((renderer: Renderer, interpolation: number) => {
      const rCtx = renderer.getContext();
      const room = roomManager.currentRoom;
      const vineSystem = vineSystemRef.current;

      // Background
      rCtx.save();
      rCtx.fillStyle = theme.backgroundColor;
      rCtx.fillRect(
        camera.position.x - CANVAS_WIDTH, camera.position.y - CANVAS_HEIGHT,
        CANVAS_WIDTH * 3, CANVAS_HEIGHT * 3,
      );
      rCtx.restore();

      // Parallax background
      renderer.resetCamera();
      biomeBackground.render(
        rCtx,
        camera.position.x - CANVAS_WIDTH / 2,
        camera.position.y - CANVAS_HEIGHT / 2,
        CANVAS_WIDTH, CANVAS_HEIGHT,
      );
      renderer.applyCamera(camera);

      // Room bounds
      renderBounds(rCtx, room.width, room.height);

      // Platforms
      renderBiomePlatforms(rCtx, roomManager.currentTileMap.platforms);

      // Obstacles
      for (const obs of roomManager.currentObstacles) {
        if (!obs.active) continue;
        rCtx.fillStyle = obs.color;
        rCtx.globalAlpha = 0.7;
        rCtx.fillRect(obs.rect.x, obs.rect.y, obs.rect.width, obs.rect.height);
        rCtx.globalAlpha = 1;
      }

      // Gates + exit indicators
      renderGates(rCtx, roomManager.currentGates, gameTime);
      renderExitIndicators(rCtx, room.exits, gameTime);

      // Vine system
      if (vineSystem) {
        vineSystem.render(
          rCtx, false, false,
          vineSystem.isSwinging ? null : {
            x: player.position.x + player.size.x / 2,
            y: player.position.y + player.size.y / 2,
          },
        );
      }

      // Enemies
      for (const enemy of enemiesRef.current) {
        if (enemy.active || !enemy.isAlive) {
          enemy.render(renderer, interpolation);
        }
      }

      // Player (manual render when inactive/vine-swinging)
      if (!player.active && vineSystem?.isSwinging) {
        const pos = player.getInterpolatedPosition(interpolation);
        rCtx.save();
        const cx = pos.x + player.size.x / 2;
        const cy = pos.y + player.size.y / 2;
        rCtx.translate(cx, cy);
        rCtx.rotate(vineSystem.angle * 0.3);
        rCtx.translate(-cx, -cy);
        renderer.fillRect(pos.x, pos.y, player.size.x, player.size.y, player.color);
        rCtx.restore();
      }

      // Combat visuals
      combatSystem.render(rCtx, camera);

      // Particles
      particleSystem.render(renderer);

      // Foreground tint
      rCtx.save();
      rCtx.fillStyle = theme.foregroundTint;
      rCtx.fillRect(
        camera.position.x - CANVAS_WIDTH, camera.position.y - CANVAS_HEIGHT,
        CANVAS_WIDTH * 3, CANVAS_HEIGHT * 3,
      );
      rCtx.restore();

      // Transition overlay
      if (roomManager.transitioning) {
        renderTransitionOverlay(rCtx, roomManager.getTransitionAlpha(), CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    });

    // ─── Screen-Space Debug Layer ───────────────────────────────

    engine.getRenderer().addLayerCallback("debug", (debugCtx) => {
      const metrics = engine.getMetrics();
      debugCtx.fillStyle = "#4ade80";
      debugCtx.font = "12px monospace";
      debugCtx.fillText(`FPS: ${Math.round(metrics.fps)}`, 8, 16);

      const ws = worldStateRef.current;
      debugCtx.fillStyle = "#86efac";
      debugCtx.fillText(ws.currentRoom, 8, 32);

      // Health bar
      const ph = playerHealthRef.current;
      if (ph) {
        const hpX = 8;
        const hpY = 44;
        const hpW = 80;
        const hpH = 8;
        debugCtx.fillStyle = "rgba(0,0,0,0.5)";
        debugCtx.fillRect(hpX, hpY, hpW, hpH);
        const hpFrac = ph.health / ph.params.maxHealth;
        debugCtx.fillStyle = hpFrac > 0.3 ? "#ef4444" : "#dc2626";
        debugCtx.fillRect(hpX, hpY, hpW * hpFrac, hpH);
        debugCtx.fillStyle = "#fff";
        debugCtx.font = "9px monospace";
        debugCtx.fillText(`HP: ${ph.health}/${ph.params.maxHealth}`, hpX + hpW + 4, hpY + 7);
      }

      // Weapon indicator
      debugCtx.fillStyle = "#f59e0b";
      debugCtx.font = "10px monospace";
      debugCtx.textAlign = "right";
      debugCtx.fillText(
        `Weapon: ${combatSystem.currentWeapon} [K]`,
        CANVAS_WIDTH - 8,
        16,
      );
      debugCtx.textAlign = "left";

      // State label
      const state = playerRef.current?.stateMachine?.getCurrentState() ?? "?";
      const swinging = vineSystemRef.current?.isSwinging ? " [VINE]" : "";
      debugCtx.fillStyle = "#a78bfa";
      debugCtx.fillText(`State: ${state}${swinging}`, 8, CANVAS_HEIGHT - 8);
    });

    camera.snapTo({
      x: player.position.x + player.size.x / 2,
      y: player.position.y + player.size.y / 2,
    });

    engine.start();
  }, [loadRoomSystems]);

  const handleUnmount = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    playerRef.current = null;
    roomManagerRef.current = null;
    vineSystemRef.current = null;
    combatSystemRef.current = null;
    playerHealthRef.current = null;
  }, []);

  // ─── Render ───────────────────────────────────────────────────────

  const ws = worldStateRef.current;

  return (
    <div className="flex h-screen bg-zinc-950 text-white">
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-zinc-800 bg-zinc-900 px-4 py-2">
          <Link href="/test" className="text-xs text-zinc-500 hover:text-zinc-300">
            &larr; Tests
          </Link>
          <h1 className="font-mono text-sm font-bold text-green-500">Herbarium Wing</h1>
          <span className="rounded bg-green-500/20 px-2 py-0.5 text-xs font-mono text-green-400">
            Phase 6 — Content
          </span>
        </div>

        {/* Canvas */}
        <div className="flex flex-1 items-center justify-center bg-zinc-950 p-4">
          <GameCanvas onMount={handleMount} onUnmount={handleUnmount} />
        </div>

        {/* Pass Criteria */}
        <div className="border-t border-zinc-800 bg-zinc-900 px-4 py-2">
          <div className="flex flex-wrap gap-3 text-xs font-mono">
            {Object.entries(criteria).map(([key, val]) => (
              <span key={key} className={val ? "text-green-400" : "text-zinc-600"}>
                {val ? "\u2713" : "\u25CB"} {formatCriteriaName(key)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Debug Panel */}
      <DebugPanel title="Herbarium Wing">
        <RenderModeToggle />
        {/* World State */}
        <Section title="World State" open>
          <div className="text-xs font-mono text-zinc-400 space-y-0.5">
            <div>Room: <span className="text-zinc-200">{ws.currentRoom}</span></div>
            <div>ID: <span className="text-zinc-500">{ws.currentRoomId}</span></div>
            <div>Visited: <span className="text-zinc-200">{ws.roomsVisited.size}</span>/10</div>
            <div>Gates opened: <span className="text-zinc-200">{ws.gatesOpened}</span></div>
            <div>Enemies defeated: <span className="text-zinc-200">{ws.enemiesDefeated}</span></div>
            <div>Elder Binder: <span className={ws.elderBinderDefeated ? "text-green-400" : "text-zinc-600"}>{ws.elderBinderDefeated ? "Defeated" : "Alive"}</span></div>
          </div>
        </Section>

        {/* Room Map */}
        <Section title="Room Map" open>
          <div className="text-xs font-mono space-y-0.5">
            {[
              { id: "tutorial-corridor", name: "Tutorial Corridor", indent: 0 },
              { id: "vine-vestibule", name: "Vine Vestibule", indent: 1 },
              { id: "overgrown-stacks", name: "Overgrown Stacks", indent: 2 },
              { id: "canopy-walk", name: "Canopy Walk", indent: 2 },
              { id: "thorn-gallery", name: "Thorn Gallery", indent: 2 },
              { id: "root-cellar", name: "Root Cellar", indent: 2 },
              { id: "mushroom-grotto", name: "Mushroom Grotto", indent: 2 },
              { id: "spore-chamber", name: "Spore Chamber", indent: 2 },
              { id: "herbarium-heart", name: "Herbarium Heart", indent: 3 },
            ].map((r) => {
              const visited = ws.roomsVisited.has(r.id);
              const current = ws.currentRoomId === r.id;
              return (
                <div
                  key={r.id}
                  className={current ? "text-green-400" : visited ? "text-zinc-300" : "text-zinc-600"}
                  style={{ paddingLeft: `${r.indent * 12}px` }}
                >
                  {visited ? "\u2713" : "\u25CB"} {r.name} {current ? "\u25C0" : ""}
                </div>
              );
            })}
          </div>
        </Section>

        {/* Player Params */}
        <Section title="Player Params">
          <Slider label="Max Run Speed" value={params.maxRunSpeed} min={50} max={600} step={10} onChange={(v) => updateParam("maxRunSpeed", v)} />
          <Slider label="Jump Speed" value={params.jumpSpeed} min={200} max={600} step={10} onChange={(v) => updateParam("jumpSpeed", v)} />
          <Slider label="Dash Speed" value={params.dashSpeed} min={200} max={1200} step={25} onChange={(v) => updateParam("dashSpeed", v)} />
          <Slider label="Acceleration" value={params.acceleration} min={200} max={5000} step={100} onChange={(v) => updateParam("acceleration", v)} />
        </Section>

        {/* Vine Params */}
        <Section title="Vine Params">
          <Slider label="Attach Range" value={vineParams.attachRange} min={30} max={150} step={5} onChange={(v) => updateVineParam("attachRange", v)} />
          <Slider label="Swing Gravity" value={vineParams.swingGravity} min={400} max={1200} step={25} onChange={(v) => updateVineParam("swingGravity", v)} />
          <Slider label="Release Boost" value={vineParams.releaseBoost} min={1.0} max={2.0} step={0.05} onChange={(v) => updateVineParam("releaseBoost", v)} />
          <Slider label="Pump Force" value={vineParams.pumpForce} min={2.0} max={30.0} step={1.0} onChange={(v) => updateVineParam("pumpForce", v)} />
        </Section>

        {/* Controls Legend */}
        <Section title="Controls" open>
          <div className="text-xs font-mono text-zinc-500 space-y-0.5">
            <div>Arrows/WASD: Move</div>
            <div>Z/Space: Jump</div>
            <div>X/Shift: Dash</div>
            <div>E: Vine attach/detach</div>
            <div>J: Attack</div>
            <div>K: Switch weapon</div>
          </div>
        </Section>
      </DebugPanel>
    </div>
  );
}

// ─── Small UI Components ────────────────────────────────────────────

function Section({ title, children, open }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open}>
      <summary className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-500 cursor-pointer select-none">
        {title}
      </summary>
      <div className="flex flex-col gap-2 pt-2">
        {children}
      </div>
    </details>
  );
}

function formatCriteriaName(key: string): string {
  return key.replace(/([A-Z])/g, " $1").trim();
}
