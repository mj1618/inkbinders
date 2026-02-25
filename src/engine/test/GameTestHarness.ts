import { FIXED_TIMESTEP, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/constants";
import type { Vec2 } from "@/lib/types";
import { Player, DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";
import type { PlayerParams } from "@/engine/entities/Player";
import { TileMap } from "@/engine/physics/TileMap";
import type { Platform } from "@/engine/physics/TileMap";
import type { SurfaceType } from "@/engine/physics/Surfaces";
import { getSurfaceProps, SURFACE_PROPERTIES } from "@/engine/physics/Surfaces";
import { Camera } from "@/engine/core/Camera";
import { CombatSystem } from "@/engine/combat/CombatSystem";
import type { CombatParams } from "@/engine/combat/CombatParams";
import { PlayerHealth } from "@/engine/combat/PlayerHealth";
import type { PlayerHealthParams } from "@/engine/combat/PlayerHealth";
import { InputAction } from "@/engine/input/InputManager";
import { MarginStitch } from "@/engine/abilities/MarginStitch";
import type { MarginStitchParams } from "@/engine/abilities/MarginStitch";
import { Redaction } from "@/engine/abilities/Redaction";
import type { RedactionParams } from "@/engine/abilities/Redaction";
import { PasteOver } from "@/engine/abilities/PasteOver";
import type { PasteOverParams } from "@/engine/abilities/PasteOver";
import { IndexMark } from "@/engine/abilities/IndexMark";
import type { IndexMarkParams } from "@/engine/abilities/IndexMark";
import type { Obstacle } from "@/engine/physics/Obstacles";
import {
  createSpikes,
  createBarrier,
  createLaser,
  createHazardZone,
} from "@/engine/physics/Obstacles";
import type {
  RoomData,
  RoomExit,
  RoomObstacle,
  GateAbility,
} from "@/engine/world/Room";
import { RoomManager } from "@/engine/world/RoomManager";
import type { RoomId } from "@/engine/world/Room";
import { VineSystem } from "@/engine/world/VineSystem";
import type { VineAnchor, VineParams } from "@/engine/world/VineSystem";
import { DayNightCycle } from "@/engine/world/DayNightCycle";
import type { DayNightParams, TimeOfDay } from "@/engine/world/DayNightCycle";
import { TestInputManager } from "./TestInputManager";

export interface HarnessConfig {
  playerParams?: Partial<PlayerParams>;
  platforms?: Platform[];
  worldWidth?: number;
  worldHeight?: number;
}

export interface WorldState {
  roomId: string | null;
  roomName: string | null;
  timeOfDay: TimeOfDay | null;
  lightLevel: number;
  corruptionIntensity: number;
  transitioning: boolean;
}

/**
 * Headless game testing harness. Runs the engine without a browser or canvas.
 *
 * Usage:
 *   const h = new GameTestHarness({ platforms: [{ x: 0, y: 300, width: 960, height: 32 }] });
 *   h.setPlayerPosition(100, 260);
 *   h.tickUntil(() => h.grounded, 60);
 *   h.pressJump();
 *   h.tick();
 *   expect(h.state).toBe('JUMPING');
 */
export class GameTestHarness {
  readonly player: Player;
  readonly input: TestInputManager;
  readonly camera: Camera;
  readonly dt: number = FIXED_TIMESTEP;
  frame = 0;

  private _tileMap: TileMap;
  private _combat: CombatSystem | null = null;
  private _health: PlayerHealth | null = null;
  private _marginStitch: MarginStitch | null = null;
  private _redaction: Redaction | null = null;
  private _pasteOver: PasteOver | null = null;
  private _indexMark: IndexMark | null = null;
  private _obstacles: Obstacle[] = [];
  private _currentRoom: RoomData | null = null;
  private _roomManager: RoomManager | null = null;
  private _pendingExit: RoomExit | null = null;
  private _vineSystem: VineSystem | null = null;
  private _dayNight: DayNightCycle | null = null;
  private _gatePlatforms: Map<string, Platform> = new Map();

  constructor(config?: HarnessConfig) {
    const platforms = config?.platforms ?? [];
    this._tileMap = new TileMap(platforms);

    this.input = new TestInputManager();

    this.player = new Player(config?.playerParams);
    this.player.input = this.input;
    this.player.tileMap = this._tileMap;

    const w = config?.worldWidth ?? CANVAS_WIDTH;
    const h = config?.worldHeight ?? CANVAS_HEIGHT;
    this.camera = new Camera(w, h);
  }

  // ── TileMap access ──────────────────────────────────────────

  get tileMap(): TileMap {
    return this._tileMap;
  }

  /** Replace the tilemap entirely (e.g. for room transitions). */
  setTileMap(platforms: Platform[]): void {
    this._tileMap = new TileMap(platforms);
    this.player.tileMap = this._tileMap;
    if (this._marginStitch) this._marginStitch.setTileMap(this._tileMap);
    if (this._redaction) this._redaction.setTileMap(this._tileMap);
  }

  /** Add a platform and return a reference to it. */
  addPlatform(
    x: number,
    y: number,
    width: number,
    height: number,
    surfaceType?: SurfaceType,
  ): Platform {
    const p: Platform = { x, y, width, height, surfaceType };
    this._tileMap.platforms.push(p);
    return p;
  }

  /** Remove a specific platform. */
  removePlatform(platform: Platform): void {
    const idx = this._tileMap.platforms.indexOf(platform);
    if (idx !== -1) this._tileMap.platforms.splice(idx, 1);
  }

  /** Remove a platform matching exact position and size. */
  removePlatformAt(x: number, y: number, width: number, height: number): void {
    const idx = this._tileMap.platforms.findIndex(
      (p) => p.x === x && p.y === y && p.width === width && p.height === height,
    );
    if (idx !== -1) this._tileMap.platforms.splice(idx, 1);
  }

  // ── Player setup ────────────────────────────────────────────

  setPlayerPosition(x: number, y: number): void {
    this.player.position.x = x;
    this.player.position.y = y;
    this.player.prevPosition.x = x;
    this.player.prevPosition.y = y;
  }

  setPlayerVelocity(vx: number, vy: number): void {
    this.player.velocity.x = vx;
    this.player.velocity.y = vy;
  }

  // ── Simulation ──────────────────────────────────────────────

  /** Advance one fixed-timestep frame. */
  tick(): void {
    this.input.update();

    // Vine system — when swinging, suppress normal player update
    const vineSwinging = this._vineSystem?.isSwinging ?? false;
    if (vineSwinging) {
      this.player.active = false;
    }

    // Surface detection
    const groundSurface = this._tileMap.getGroundSurface(this.player);
    this.player.currentSurface = getSurfaceProps(groundSurface);
    if (this.player.wallSide !== 0) {
      const wallSurface = this._tileMap.getWallSurface(
        this.player,
        this.player.wallSide as -1 | 1,
      );
      this.player.currentWallSurface = getSurfaceProps(wallSurface);
    } else {
      this.player.currentWallSurface = SURFACE_PROPERTIES.normal;
    }

    // PasteOver autoCapture + scan (needs current surface, before player update)
    if (this._pasteOver) {
      this._pasteOver.autoCapture(groundSurface);
      this._pasteOver.scanForTarget(
        this.player.position,
        this.player.size,
        this._tileMap,
        this.player.wallSide !== 0
          ? (this.player.wallSide as -1 | 1)
          : undefined,
      );
    }

    // Player update (includes state machine, gravity, velocity, position, collision)
    // Skipped when vine swinging (player.active = false suppresses Entity.update)
    this.player.update(this.dt);

    // Vine system update — override player position from pendulum physics
    if (vineSwinging && this._vineSystem) {
      const pos = this._vineSystem.update(
        this.dt,
        this.input.isHeld(InputAction.Left),
        this.input.isHeld(InputAction.Right),
        this.input.isHeld(InputAction.Up),
        this.input.isHeld(InputAction.Down),
      );
      this.player.position.x = pos.x - this.player.size.x / 2;
      this.player.position.y = pos.y - this.player.size.y / 2;
    }

    // Restore player active after vine handling
    if (vineSwinging) {
      this.player.active = true;
    }

    // MarginStitch scan + update
    if (this._marginStitch) {
      const center = this.playerCenter;
      this._marginStitch.scanForPairs(center, this._tileMap);
      this._marginStitch.update(this.dt);
    }

    // Redaction scan + update
    if (this._redaction) {
      const center = this.playerCenter;
      const aim = { x: this.player.facingRight ? 1 : -1, y: 0 };
      this._redaction.scanForTargets(center, aim, this._obstacles);
      this._redaction.update(this.dt);
    }

    // PasteOver timer update
    if (this._pasteOver) {
      this._pasteOver.update(this.dt);
    }

    // IndexMark timer/cooldown update
    if (this._indexMark) {
      this._indexMark.update(this.dt);
    }

    // Combat update
    if (this._combat) {
      this._combat.update(this.player.getBounds(), this.player.facingRight);
    }

    // Health update
    if (this._health) {
      this._health.update();
    }

    // Day/night cycle
    if (this._dayNight) {
      this._dayNight.update(this.dt);
    }

    // Room exit detection
    if (this._roomManager && !this._roomManager.transitioning) {
      const playerBounds = {
        x: this.player.position.x,
        y: this.player.position.y,
        width: this.player.size.x,
        height: this.player.size.y,
      };
      this._pendingExit = this._roomManager.checkExits(playerBounds);
    }

    // Camera follow
    this.camera.follow(this.playerCenter, this.player.velocity, this.dt);

    this.frame++;
  }

  /** Advance N frames. */
  tickN(n: number): void {
    for (let i = 0; i < n; i++) {
      this.tick();
    }
  }

  /**
   * Advance frames until predicate returns true, or until maxFrames is reached.
   * Returns the number of frames elapsed. Throws if maxFrames exceeded.
   */
  tickUntil(predicate: () => boolean, maxFrames: number = 300): number {
    let elapsed = 0;
    while (!predicate() && elapsed < maxFrames) {
      this.tick();
      elapsed++;
    }
    if (!predicate()) {
      throw new Error(
        `tickUntil: predicate not satisfied after ${maxFrames} frames`,
      );
    }
    return elapsed;
  }

  /**
   * Advance frames until predicate returns true, or return false if maxFrames exceeded.
   * Non-throwing variant of tickUntil.
   */
  tickWhile(predicate: () => boolean, maxFrames: number = 300): number {
    let elapsed = 0;
    while (predicate() && elapsed < maxFrames) {
      this.tick();
      elapsed++;
    }
    return elapsed;
  }

  /** Advance a number of real-time seconds (at 60 Hz). */
  tickSeconds(seconds: number): void {
    this.tickN(Math.ceil(seconds * 60));
  }

  // ── Input helpers ───────────────────────────────────────────

  pressJump(): void {
    this.input.press(InputAction.Jump);
  }

  pressLeft(): void {
    this.input.press(InputAction.Left);
  }

  pressRight(): void {
    this.input.press(InputAction.Right);
  }

  pressUp(): void {
    this.input.press(InputAction.Up);
  }

  pressDown(): void {
    this.input.press(InputAction.Down);
  }

  pressDash(): void {
    this.input.press(InputAction.Dash);
  }

  pressCrouch(): void {
    this.input.press(InputAction.Crouch);
  }

  pressAttack(): void {
    this.input.press(InputAction.Attack);
  }

  releaseJump(): void {
    this.input.release(InputAction.Jump);
  }

  releaseLeft(): void {
    this.input.release(InputAction.Left);
  }

  releaseRight(): void {
    this.input.release(InputAction.Right);
  }

  releaseAll(): void {
    this.input.releaseAll();
  }

  pressAbility1(): void {
    this.input.press(InputAction.Ability1);
  }

  pressAbility2(): void {
    this.input.press(InputAction.Ability2);
  }

  pressAbility3(): void {
    this.input.press(InputAction.Ability3);
  }

  releaseAbility3(): void {
    this.input.release(InputAction.Ability3);
  }

  // ── State inspection ────────────────────────────────────────

  get pos(): Vec2 {
    return { x: this.player.position.x, y: this.player.position.y };
  }

  get vel(): Vec2 {
    return { x: this.player.velocity.x, y: this.player.velocity.y };
  }

  get state(): string {
    return this.player.stateMachine.getCurrentState();
  }

  get grounded(): boolean {
    return this.player.grounded;
  }

  get facingRight(): boolean {
    return this.player.facingRight;
  }

  get speed(): number {
    return Math.sqrt(
      this.player.velocity.x ** 2 + this.player.velocity.y ** 2,
    );
  }

  get horizontalSpeed(): number {
    return Math.abs(this.player.velocity.x);
  }

  get playerCenter(): Vec2 {
    return {
      x: this.player.position.x + this.player.size.x / 2,
      y: this.player.position.y + this.player.size.y / 2,
    };
  }

  // ── Optional system wiring ──────────────────────────────────

  get combat(): CombatSystem | null {
    return this._combat;
  }

  get health(): PlayerHealth | null {
    return this._health;
  }

  get marginStitch(): MarginStitch | null {
    return this._marginStitch;
  }

  get redaction(): Redaction | null {
    return this._redaction;
  }

  get pasteOver(): PasteOver | null {
    return this._pasteOver;
  }

  get indexMark(): IndexMark | null {
    return this._indexMark;
  }

  get obstacles(): Obstacle[] {
    return this._obstacles;
  }

  enableCombat(params?: Partial<CombatParams>): CombatSystem {
    this._combat = new CombatSystem(params);
    return this._combat;
  }

  enableHealth(params?: Partial<PlayerHealthParams>): PlayerHealth {
    this._health = new PlayerHealth(params);
    return this._health;
  }

  enableMarginStitch(params?: Partial<MarginStitchParams>): MarginStitch {
    this._marginStitch = new MarginStitch(params);
    this._marginStitch.setTileMap(this._tileMap);
    return this._marginStitch;
  }

  enableRedaction(params?: Partial<RedactionParams>): Redaction {
    this._redaction = new Redaction(params);
    this._redaction.setTileMap(this._tileMap);
    return this._redaction;
  }

  enablePasteOver(params?: Partial<PasteOverParams>): PasteOver {
    this._pasteOver = new PasteOver(params);
    return this._pasteOver;
  }

  enableIndexMark(params?: Partial<IndexMarkParams>): IndexMark {
    this._indexMark = new IndexMark(params);
    return this._indexMark;
  }

  addObstacle(obstacle: Obstacle): Obstacle {
    this._obstacles.push(obstacle);
    if (obstacle.solid && this._redaction) {
      const platform = this.addPlatform(
        obstacle.rect.x,
        obstacle.rect.y,
        obstacle.rect.width,
        obstacle.rect.height,
      );
      this._redaction.registerObstaclePlatform(obstacle.id, platform);
    }
    return obstacle;
  }

  // ── Room system ────────────────────────────────────────────

  get currentRoom(): RoomData | null {
    return this._currentRoom;
  }

  get roomManager(): RoomManager | null {
    return this._roomManager;
  }

  get pendingExit(): RoomExit | null {
    return this._pendingExit;
  }

  /** Load a single room into the harness (standalone, no RoomManager). */
  loadRoom(roomData: RoomData): void {
    this._currentRoom = roomData;

    // Build platforms from room
    const platforms: Platform[] = roomData.platforms.map((p) => ({
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
      surfaceType: p.surfaceType,
    }));

    // Add gate platforms for locked gates
    this._gatePlatforms.clear();
    for (const gate of roomData.gates) {
      if (!gate.opened) {
        const gatePlat: Platform = {
          x: gate.rect.x,
          y: gate.rect.y,
          width: gate.rect.width,
          height: gate.rect.height,
        };
        platforms.push(gatePlat);
        this._gatePlatforms.set(gate.id, gatePlat);
      }
    }

    this.setTileMap(platforms);

    // Set camera world bounds
    this.camera.bounds = {
      x: 0,
      y: 0,
      width: roomData.width,
      height: roomData.height,
    };

    // Position player at default spawn
    this.setPlayerPosition(roomData.defaultSpawn.x, roomData.defaultSpawn.y);

    // Load obstacles
    this._obstacles = [];
    for (const obs of roomData.obstacles) {
      this.addObstacleFromRoom(obs);
    }
  }

  /** Convert a RoomObstacle to an Obstacle using factory functions. */
  private addObstacleFromRoom(roomObs: RoomObstacle): void {
    let obstacle: Obstacle;
    switch (roomObs.type) {
      case "spikes":
        obstacle = createSpikes(roomObs.rect, roomObs.damage);
        break;
      case "barrier":
        obstacle = createBarrier(roomObs.rect);
        break;
      case "laser":
        obstacle = createLaser(roomObs.rect, roomObs.damage);
        break;
      case "hazard_zone":
        obstacle = createHazardZone(roomObs.rect, roomObs.damage);
        break;
      default: {
        const _exhaustive: never = roomObs.type;
        throw new Error(`Unknown obstacle type: ${_exhaustive}`);
      }
    }
    // Override the auto-generated ID with the room obstacle's ID
    obstacle.id = roomObs.id;
    this._obstacles.push(obstacle);
  }

  /** Enable RoomManager with a set of rooms. Loads the starting room. */
  enableRoomManager(
    rooms: Record<string, RoomData>,
    startingRoomId: string,
  ): RoomManager {
    const roomMap = new Map<RoomId, RoomData>(Object.entries(rooms));
    this._roomManager = new RoomManager({
      rooms: roomMap,
      startingRoomId,
    });
    this.loadRoomFromManager(startingRoomId);
    return this._roomManager;
  }

  /** Load a room via the RoomManager and sync tilemap/obstacles to harness. */
  private loadRoomFromManager(roomId: string): void {
    if (!this._roomManager) return;
    // Only call loadRoom if the room isn't already loaded (avoids double-load
    // when called right after the RoomManager constructor which auto-loads)
    if (this._roomManager.currentRoom.id !== roomId) {
      this._roomManager.loadRoom(roomId);
    }
    this._currentRoom = this._roomManager.currentRoom;

    // Sync tilemap from RoomManager
    this._tileMap = this._roomManager.currentTileMap;
    this.player.tileMap = this._tileMap;
    if (this._marginStitch) this._marginStitch.setTileMap(this._tileMap);
    if (this._redaction) this._redaction.setTileMap(this._tileMap);

    // Sync obstacles
    this._obstacles = [...this._roomManager.currentObstacles];

    // Set camera bounds
    this.camera.bounds = {
      x: 0,
      y: 0,
      width: this._currentRoom.width,
      height: this._currentRoom.height,
    };
  }

  /** Transition to a new room via an exit. Completes instantly (no fade animation). */
  transitionToRoom(exit: RoomExit): void {
    if (!this._roomManager) return;
    this.loadRoomFromManager(exit.targetRoomId);
    this.setPlayerPosition(exit.targetSpawnPoint.x, exit.targetSpawnPoint.y);
    this._pendingExit = null;
  }

  /** Try to open an ability gate. Returns true if opened. */
  tryOpenGate(gateId: string, abilities: GateAbility[]): boolean {
    if (!this._currentRoom) return false;
    const gate = this._currentRoom.gates.find((g) => g.id === gateId);
    if (!gate || gate.opened) return false;
    if (!abilities.includes(gate.requiredAbility)) return false;

    gate.opened = true;

    // Remove the gate's platform from tilemap
    const gatePlat = this._gatePlatforms.get(gateId);
    if (gatePlat) {
      this.removePlatform(gatePlat);
      this._gatePlatforms.delete(gateId);
    } else {
      // Fallback: find by position
      this.removePlatformAt(
        gate.rect.x,
        gate.rect.y,
        gate.rect.width,
        gate.rect.height,
      );
    }

    // Also notify RoomManager if it's active
    if (this._roomManager) {
      const rmGate = this._roomManager.currentGates.find(
        (g) => g.id === gateId,
      );
      if (rmGate) {
        this._roomManager.tryOpenGate(rmGate, new Set(abilities));
      }
    }

    return true;
  }

  // ── Vine system ────────────────────────────────────────────

  get vineSystem(): VineSystem | null {
    return this._vineSystem;
  }

  get vineSwinging(): boolean {
    return this._vineSystem?.isSwinging ?? false;
  }

  get vineAngle(): number {
    return this._vineSystem?.angle ?? 0;
  }

  get vineVelocity(): Vec2 {
    return this._vineSystem?.swingVelocity ?? { x: 0, y: 0 };
  }

  /** Enable vine system with anchors and optional params. */
  enableVineSystem(
    anchors: VineAnchor[],
    params?: Partial<VineParams>,
  ): VineSystem {
    this._vineSystem = new VineSystem(anchors, params);
    return this._vineSystem;
  }

  /** Attach to the nearest vine anchor. Returns true if attached. */
  attachVine(): boolean {
    if (!this._vineSystem) return false;
    const center = this.playerCenter;
    const anchor = this._vineSystem.findNearestAnchor(center);
    if (!anchor) return false;
    this._vineSystem.attach(
      anchor,
      center,
      { x: this.player.velocity.x, y: this.player.velocity.y },
    );
    return true;
  }

  /** Detach from vine. Sets player velocity to release velocity. */
  detachVine(): void {
    if (!this._vineSystem || !this._vineSystem.isSwinging) return;
    const vel = this._vineSystem.detach();
    this.player.velocity.x = vel.x;
    this.player.velocity.y = vel.y;
    this.player.active = true;
  }

  // ── Day/Night cycle ────────────────────────────────────────

  get dayNight(): DayNightCycle | null {
    return this._dayNight;
  }

  get timeOfDay(): TimeOfDay | null {
    return this._dayNight?.getTimeOfDay() ?? null;
  }

  get corruptionIntensity(): number {
    return this._dayNight?.getCorruptionIntensity() ?? 0;
  }

  get lightLevel(): number {
    return this._dayNight?.getLightLevel() ?? 1;
  }

  get dayNightTime(): number {
    return this._dayNight?.time ?? 0;
  }

  /** Enable day/night cycle with optional params. */
  enableDayNightCycle(params?: Partial<DayNightParams>): DayNightCycle {
    this._dayNight = new DayNightCycle(params);
    return this._dayNight;
  }

  // ── World state ────────────────────────────────────────────

  /** Get composite world state from all enabled systems. */
  getWorldState(): WorldState {
    return {
      roomId: this._currentRoom?.id ?? null,
      roomName: this._currentRoom?.name ?? null,
      timeOfDay: this._dayNight?.getTimeOfDay() ?? null,
      lightLevel: this._dayNight?.getLightLevel() ?? 1,
      corruptionIntensity: this._dayNight?.getCorruptionIntensity() ?? 0,
      transitioning: this._roomManager?.transitioning ?? false,
    };
  }

  // ── Utility ─────────────────────────────────────────────────

  /** Create a standard floor across the full width. */
  addFloor(y: number = 300, width: number = 960): Platform {
    return this.addPlatform(0, y, width, 32);
  }

  /** Create walls on left and right sides. */
  addWalls(
    leftX: number = 0,
    rightX: number = 936,
    y: number = 0,
    height: number = 540,
  ): { left: Platform; right: Platform } {
    const left = this.addPlatform(leftX - 32, y, 32, height);
    const right = this.addPlatform(rightX, y, 32, height);
    return { left, right };
  }

  /** Snapshot the current player state for comparison. */
  snapshot(): PlayerSnapshot {
    return {
      frame: this.frame,
      position: { ...this.player.position },
      velocity: { ...this.player.velocity },
      state: this.state,
      grounded: this.player.grounded,
      facingRight: this.player.facingRight,
      wallSide: this.player.wallSide,
      dashAvailable: this.player.dashAvailable,
      dashCooldownTimer: this.player.dashCooldownTimer,
      coyoteTimer: this.player.coyoteTimer,
    };
  }
}

export interface PlayerSnapshot {
  frame: number;
  position: Vec2;
  velocity: Vec2;
  state: string;
  grounded: boolean;
  facingRight: boolean;
  wallSide: -1 | 0 | 1;
  dashAvailable: boolean;
  dashCooldownTimer: number;
  coyoteTimer: number;
}
