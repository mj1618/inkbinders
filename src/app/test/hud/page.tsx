"use client";

import { useRef, useState, useCallback } from "react";
import { GameCanvas } from "@/components/canvas/GameCanvas";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { Slider } from "@/components/debug/Slider";
import { RenderModeToggle } from "@/components/debug/RenderModeToggle";
import { Engine } from "@/engine/core/Engine";
import { RenderConfig } from "@/engine/core/RenderConfig";
import { Player, DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";
import { TileMap } from "@/engine/physics/TileMap";
import type { Platform } from "@/engine/physics/TileMap";
import { ParticleSystem } from "@/engine/core/ParticleSystem";
import { ScreenShake } from "@/engine/core/ScreenShake";
import { InputAction } from "@/engine/input/InputManager";
import type { InputManager } from "@/engine/input/InputManager";
import { CombatSystem } from "@/engine/combat/CombatSystem";
import { DEFAULT_COMBAT_PARAMS } from "@/engine/combat/CombatParams";
import { PlayerHealth } from "@/engine/combat/PlayerHealth";
import { TargetDummy } from "@/engine/combat/TargetDummy";
import type { AttackDirection, WeaponType } from "@/engine/combat/types";
import { MarginStitch } from "@/engine/abilities/MarginStitch";
import { Redaction } from "@/engine/abilities/Redaction";
import { PasteOver } from "@/engine/abilities/PasteOver";
import { IndexMark } from "@/engine/abilities/IndexMark";
import { DayNightCycle } from "@/engine/world/DayNightCycle";
import { createSpikes } from "@/engine/physics/Obstacles";
import type { Obstacle } from "@/engine/physics/Obstacles";
import { checkDamageOverlap } from "@/engine/physics/Obstacles";
import { GameHUD } from "@/engine/ui/GameHUD";
import type { GameHUDConfig } from "@/engine/ui/GameHUD";
import { COLORS, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/constants";
import type { Vec2 } from "@/lib/types";
import Link from "next/link";

// ─── Constants ──────────────────────────────────────────────────────

const LEVEL_WIDTH = 960;
const LEVEL_HEIGHT = 540;
const SPAWN_X = 100;
const SPAWN_Y = 360;
const MAIN_GROUND_Y = 460;
const RESPAWN_Y_THRESHOLD = 600;

// ─── Attack Direction Helper ────────────────────────────────────────

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

// ─── Aim Direction Helper ───────────────────────────────────────────

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

  if (dx === 0 && dy === 0) {
    dx = facingRight ? 1 : -1;
  }

  const len = Math.sqrt(dx * dx + dy * dy);
  return { x: dx / len, y: dy / len };
}

// ─── Test Level ─────────────────────────────────────────────────────

function createTestLevel(): {
  tileMap: TileMap;
  dummies: TargetDummy[];
  obstacles: Obstacle[];
} {
  const platforms: Platform[] = [
    // Main ground
    { x: 0, y: MAIN_GROUND_Y, width: LEVEL_WIDTH, height: 80 },
    // Left wall (for margin stitch)
    { x: 0, y: 0, width: 20, height: LEVEL_HEIGHT },
    // Right wall (for margin stitch)
    { x: LEVEL_WIDTH - 20, y: 0, width: 20, height: LEVEL_HEIGHT },
    // Ceiling
    { x: 0, y: 0, width: LEVEL_WIDTH, height: 20 },
    // Left elevated platform
    { x: 60, y: 360, width: 120, height: 20 },
    // Center platform
    { x: 380, y: 340, width: 160, height: 20 },
    // Right elevated platform
    { x: 700, y: 380, width: 140, height: 20 },
    // Inner wall pair (for margin stitch)
    { x: 260, y: 300, width: 24, height: 160 },
    { x: 340, y: 300, width: 24, height: 160 },
    // Surface platforms (bouncy and icy for paste-over)
    { x: 560, y: 420, width: 100, height: 20, surfaceType: "bouncy" as const },
    { x: 160, y: 420, width: 100, height: 20, surfaceType: "icy" as const },
  ];

  const tileMap = new TileMap(platforms);

  // Target dummies
  const dummies: TargetDummy[] = [
    new TargetDummy({
      position: { x: 420, y: MAIN_GROUND_Y - 40 },
      health: 5,
      color: "#ef4444",
      respawns: true,
      respawnDelay: 180,
      patrol: false,
      patrolRange: 0,
      patrolSpeed: 0,
      groundY: MAIN_GROUND_Y,
    }),
    new TargetDummy({
      position: { x: 600, y: MAIN_GROUND_Y - 40 },
      health: 3,
      color: "#f97316",
      respawns: true,
      respawnDelay: 180,
      patrol: true,
      patrolRange: 60,
      patrolSpeed: 40,
      groundY: MAIN_GROUND_Y,
    }),
    new TargetDummy({
      position: { x: 800, y: 380 - 40 },
      health: 3,
      color: "#eab308",
      respawns: true,
      respawnDelay: 180,
      patrol: false,
      patrolRange: 0,
      patrolSpeed: 0,
      groundY: 380,
    }),
  ];

  for (const d of dummies) {
    d.mainFloorY = MAIN_GROUND_Y;
  }

  // Spike obstacle in the center (damage source for health testing)
  const obstacles: Obstacle[] = [
    createSpikes({ x: 440, y: MAIN_GROUND_Y - 8, width: 80, height: 8 }, 1),
  ];

  return { tileMap, dummies, obstacles };
}

// ─── Overlay Ref Interface ──────────────────────────────────────────

interface EngineWithRefs extends Engine {
  __showOverlaysRef?: { current: boolean };
}

// ─── Test Page Component ────────────────────────────────────────────

export default function HUDTest() {
  const engineRef = useRef<Engine | null>(null);
  const hudRef = useRef<GameHUD | null>(null);

  const [hudConfig, setHudConfig] = useState<GameHUDConfig>({
    showHealth: true,
    showAbilities: true,
    showWeapon: true,
    showClock: true,
    showRoomName: true,
    showMinimap: false,
    showNotifications: true,
  });
  const [showOverlays, setShowOverlays] = useState(true);
  const [cycleSpeed, setCycleSpeed] = useState(4.0);

  const hudConfigRef = useRef(hudConfig);
  hudConfigRef.current = hudConfig;

  const cycleSpeedRef = useRef(cycleSpeed);
  cycleSpeedRef.current = cycleSpeed;

  // ─── HUD Config Updater ─────────────────────────────────────────

  const updateHudConfig = useCallback(
    <K extends keyof GameHUDConfig>(key: K, value: GameHUDConfig[K]) => {
      setHudConfig((prev) => {
        const next = { ...prev, [key]: value };
        if (hudRef.current) {
          hudRef.current.config[key] = value;
        }
        return next;
      });
    },
    [],
  );

  // ─── HUD Actions ────────────────────────────────────────────────

  const showRoomName = useCallback(() => {
    hudRef.current?.showRoomName("Test Chamber");
  }, []);

  const sendNotification = useCallback((type: "info" | "ability" | "gate" | "item" | "warning") => {
    const messages: Record<string, string> = {
      info: "Test notification",
      ability: "Margin Stitch unlocked!",
      gate: "Gate opened!",
      item: "Ink Card found",
      warning: "Low health!",
    };
    hudRef.current?.notify(messages[type], type);
  }, []);

  const skipToPhase = useCallback((phase: "dawn" | "day" | "dusk" | "night") => {
    // Access the day/night system via a ref stored on the engine
    const eng = engineRef.current as EngineWithRefs & { __dayNight?: DayNightCycle } | null;
    eng?.__dayNight?.skipTo(phase);
  }, []);

  // ─── Engine Mount ───────────────────────────────────────────────

  const handleMount = useCallback((ctx: CanvasRenderingContext2D) => {
    RenderConfig.setMode("rectangles");
    const engine = new Engine({ ctx });
    const camera = engine.getCamera();
    const input = engine.getInput();
    const { tileMap, dummies, obstacles } = createTestLevel();

    // Camera setup for single-screen level
    camera.bounds = { x: 0, y: 0, width: LEVEL_WIDTH, height: LEVEL_HEIGHT };
    camera.snapTo({ x: LEVEL_WIDTH / 2, y: LEVEL_HEIGHT / 2 });

    // Player setup
    const player = new Player();
    player.position.x = SPAWN_X;
    player.position.y = SPAWN_Y;
    player.input = input;
    player.tileMap = tileMap;

    const particleSystem = new ParticleSystem();
    const screenShake = new ScreenShake();
    player.particleSystem = particleSystem;
    player.screenShake = screenShake;

    engine.getEntities().add(player);

    // Combat
    const combat = new CombatSystem();
    const playerHealth = new PlayerHealth();
    let selectedWeapon: WeaponType = "quill-spear";

    // Abilities
    const marginStitch = new MarginStitch();
    marginStitch.setTileMap(tileMap);
    marginStitch.particleSystem = particleSystem;

    const redaction = new Redaction();
    redaction.particleSystem = particleSystem;

    const pasteOver = new PasteOver();

    const indexMark = new IndexMark();
    indexMark.particleSystem = particleSystem;

    // Day/Night
    const dayNight = new DayNightCycle({
      cycleDuration: 30, // Fast cycle for testing
      timeScale: 4.0,
    });

    // GameHUD
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
      hudConfigRef.current,
    );

    engineRef.current = engine;
    hudRef.current = hud;

    // Store day/night ref for phase skip buttons
    (engine as EngineWithRefs & { __dayNight?: DayNightCycle }).__dayNight = dayNight;

    const showOverlaysRef = { current: true };
    (engine as EngineWithRefs).__showOverlaysRef = showOverlaysRef;

    // ─── Update Callback ───────────────────────────────────────

    engine.onUpdate((dt) => {
      // Sync day/night speed from slider
      dayNight.params.timeScale = cycleSpeedRef.current;

      // Check pause first
      const wasPaused = hud.paused;
      hud.checkPause();

      if (hud.paused) {
        // Handle pause menu navigation (but don't advance game)
        const action = hud.handlePauseInput();
        if (action === "quit") {
          // "Quit" in this context just resets the player
          hud.paused = false;
          player.position.x = SPAWN_X;
          player.position.y = SPAWN_Y;
          player.velocity.x = 0;
          player.velocity.y = 0;
          playerHealth.reset();
        }
        // Update HUD timers even when paused (for notification fade-outs etc)
        hud.update(dt);
        return;
      }

      // If we just unpaused, skip one frame of game logic to avoid phantom inputs
      if (wasPaused) {
        hud.update(dt);
        return;
      }

      // Auto-respawn on fall
      if (player.position.y > RESPAWN_Y_THRESHOLD) {
        player.position.x = SPAWN_X;
        player.position.y = SPAWN_Y;
        player.velocity.x = 0;
        player.velocity.y = 0;
        player.grounded = false;
      }

      // Camera follow
      const playerCenter: Vec2 = {
        x: player.position.x + player.size.x / 2,
        y: player.position.y + player.size.y / 2,
      };
      camera.follow(playerCenter, player.velocity, dt);

      // ─── Combat ─────────────────────────────────────────────

      // Weapon switching
      if (input.isPressed(InputAction.WeaponSwitch)) {
        selectedWeapon = selectedWeapon === "quill-spear" ? "ink-snap" : "quill-spear";
        combat.currentWeapon = selectedWeapon;
      }

      // Attack input
      const playerState = player.stateMachine.getCurrentState();
      if (input.isPressed(InputAction.Attack) && combat.canAttack(playerState)) {
        if (selectedWeapon === "quill-spear") {
          const direction = getAttackDirection(input, player.facingRight);
          combat.startSpearAttack(direction);
        } else {
          const aliveTargets = dummies
            .filter((d) => d.isAlive)
            .map((d) => ({ id: d.id, bounds: d.getBounds() }));
          const autoAimTarget = combat.findSnapTarget(playerCenter, aliveTargets);
          combat.startSnapAttack(
            autoAimTarget?.position ?? null,
            autoAimTarget?.id ?? null,
            player.facingRight,
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

            const knockAngle = Math.atan2(hit.knockback.y, hit.knockback.x);
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

      // ─── Abilities ──────────────────────────────────────────

      // Margin Stitch
      marginStitch.scanForPairs(playerCenter, tileMap);
      if (input.isPressed(InputAction.Ability1) && marginStitch.canActivate) {
        marginStitch.activate(playerCenter.y);
      }
      marginStitch.update(dt);

      // Redaction
      const aimDir = getAimDirection(input, player.facingRight);
      redaction.scanForTargets(playerCenter, aimDir, obstacles);
      if (input.isPressed(InputAction.Ability2) && redaction.canActivate) {
        redaction.activate();
      }
      redaction.update(dt);

      // Paste-Over
      const groundPlatform = tileMap.getGroundPlatform(player);
      if (groundPlatform && groundPlatform.surfaceType && groundPlatform.surfaceType !== "normal") {
        pasteOver.autoCapture(groundPlatform.surfaceType);
      }
      pasteOver.targetPlatform = groundPlatform;
      if (input.isPressed(InputAction.Ability3) && pasteOver.canActivate) {
        pasteOver.activate();
      }
      pasteOver.update(dt);

      // Index Mark (tap = place, hold = teleport select)
      if (input.isPressed(InputAction.Ability3)) {
        indexMark.onKeyDown();
      }
      if (input.isHeld(InputAction.Ability3)) {
        indexMark.onKeyHeld(input);
      }
      if (input.isReleased(InputAction.Ability3)) {
        const result = indexMark.onKeyUp(
          { x: player.position.x + player.size.x / 2, y: player.position.y + player.size.y / 2 },
          player.grounded,
        );
        if (result && result.action === "teleport") {
          player.position.x = result.targetPosition.x - player.size.x / 2;
          player.position.y = result.targetPosition.y - player.size.y / 2;
          player.velocity.x = 0;
          player.velocity.y = 0;
        }
      }
      indexMark.update(dt);

      // ─── Health / Damage ────────────────────────────────────

      playerHealth.update();

      // Spike damage
      const canTakeDmg = playerHealth.canTakeDamage(playerState, player.isDashing);
      if (canTakeDmg) {
        const hitObs = checkDamageOverlap(player.getBounds(), obstacles);
        if (hitObs) {
          const dir = player.position.x < hitObs.rect.x + hitObs.rect.width / 2 ? -1 : 1;
          playerHealth.takeDamage(hitObs.damage, { x: dir, y: -0.5 }, hitObs.type);
        }
      }

      // Apply knockback
      const kb = playerHealth.getKnockbackVelocity();
      if (kb) {
        player.velocity.x += kb.x * dt * 60;
        player.velocity.y += kb.y * dt * 60;
      }

      // Update dummies
      for (const d of dummies) {
        d.update(dt);
      }

      // Day/night
      dayNight.update(dt);

      // Particles & screen shake
      particleSystem.update(dt);
      const shakeOffset = screenShake.update();
      camera.position.x += shakeOffset.offsetX;
      camera.position.y += shakeOffset.offsetY;

      // Update HUD
      hud.update(dt);
    });

    // ─── World-Space Render Callback ─────────────────────────────

    engine.onRender((renderer, interpolation) => {
      // Draw tilemap
      tileMap.render(renderer);

      // Draw obstacles (spikes)
      const rCtx = renderer.getContext();
      for (const obs of obstacles) {
        if (!obs.active) continue;
        rCtx.fillStyle = obs.color;
        rCtx.fillRect(obs.rect.x, obs.rect.y, obs.rect.width, obs.rect.height);
        // Spike triangles
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

      // Draw dummies
      for (const d of dummies) {
        d.render(renderer, interpolation);
      }

      // Combat visuals
      combat.render(rCtx, camera);

      // Ability visuals (world space)
      marginStitch.render(rCtx);
      redaction.render(rCtx);
      pasteOver.render(rCtx);
      indexMark.render(rCtx);

      // Particles
      particleSystem.render(renderer);

      // Player invincibility blink
      const showPlayer = playerHealth.invincibilityTimer <= 0 ||
        Math.floor(playerHealth.invincibilityTimer / 4) % 2 === 0;

      if (showPlayer) {
        const pos = player.getInterpolatedPosition(interpolation);
        if (playerHealth.invincibilityTimer > 0 && playerHealth.knockbackTimer > 0) {
          const oldColor = player.color;
          player.color = "#ef4444";
          player.render(renderer, interpolation);
          player.color = oldColor;
        } else {
          player.render(renderer, interpolation);
        }

        if (showOverlaysRef.current) {
          // Debug overlays
          renderer.strokeRect(
            pos.x, pos.y,
            player.size.x, player.size.y,
            COLORS.debug.hitbox, 1,
          );

          const cx = pos.x + player.size.x / 2;
          const cy = pos.y + player.size.y / 2;
          const vScale = 0.15;
          const vx = player.velocity.x * vScale;
          const vy = player.velocity.y * vScale;
          if (Math.abs(vx) > 1 || Math.abs(vy) > 1) {
            renderer.drawLine(cx, cy, cx + vx, cy + vy, COLORS.debug.velocity, 2);
          }

          const state = player.stateMachine.getCurrentState();
          renderer.drawText(state, pos.x, pos.y - 8, COLORS.debug.stateLabel, 10);

          if (player.grounded) {
            renderer.drawCircle(
              pos.x + player.size.x / 2,
              pos.y + player.size.y + 3,
              3,
              COLORS.debug.ground,
            );
          }
        }
      } else {
        // Still render at reduced alpha during blink
        player.render(renderer, interpolation);
      }
    });

    // ─── Screen-Space Debug Layer ──────────────────────────────

    const debugLayerCallback = (debugCtx: CanvasRenderingContext2D) => {
      // HUD always renders (even if overlays are hidden)
      hud.render(debugCtx, CANVAS_WIDTH, CANVAS_HEIGHT);
      hud.renderPauseMenu(debugCtx, CANVAS_WIDTH, CANVAS_HEIGHT);

      if (!showOverlaysRef.current) return;

      const metrics = engine.getMetrics();

      // FPS counter (top-center, so it doesn't overlap HUD elements)
      debugCtx.fillStyle = COLORS.debug.ground;
      debugCtx.font = "10px monospace";
      debugCtx.textAlign = "center";
      debugCtx.fillText(`FPS: ${Math.round(metrics.fps)}`, CANVAS_WIDTH / 2, 12);
      debugCtx.textAlign = "left";
    };
    engine.getRenderer().addLayerCallback("debug", debugLayerCallback);

    engine.start();

    // Show initial room name
    hud.showRoomName("Test Chamber");
  }, []);

  const handleUnmount = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    hudRef.current = null;
  }, []);

  const toggleOverlays = useCallback(() => {
    setShowOverlays((prev) => {
      const next = !prev;
      const engine = engineRef.current as EngineWithRefs | null;
      if (engine?.__showOverlaysRef) engine.__showOverlaysRef.current = next;
      return next;
    });
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
        <h1 className="font-mono text-sm font-bold text-purple-500">
          HUD &amp; Game UI
        </h1>
        <span className="rounded bg-purple-500/20 px-2 py-0.5 text-xs font-mono text-purple-400">
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
            HP bar top-left &middot; Damage flash &middot; Low HP pulse &middot;
            Ability bar bottom-left &middot; Cooldown overlays &middot;
            Active count dots &middot; Weapon indicator bottom-center &middot;
            K switches weapon &middot; Clock top-right &middot; Clock updates &middot;
            Room name fades in/out &middot; Notifications with colors &middot;
            Notification queue &middot; ESC pause menu &middot; Pause navigation &middot;
            Resume works &middot; HUD toggles &middot; Null-safe rendering &middot;
            No regressions &middot; TypeScript strict
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
        <DebugPanel title="HUD & Game UI">
          <RenderModeToggle />
          {/* HUD Config Toggles */}
          <details open>
            <summary className="text-xs font-mono text-purple-400/80 uppercase tracking-wider cursor-pointer select-none">
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

          {/* HUD Actions */}
          <details open>
            <summary className="text-xs font-mono text-purple-400/80 uppercase tracking-wider cursor-pointer select-none pt-2">
              HUD Actions
            </summary>
            <div className="mt-2 flex flex-col gap-1.5">
              <button
                onClick={showRoomName}
                className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700"
              >
                Show Room Name
              </button>
              <button
                onClick={() => sendNotification("info")}
                className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-white hover:bg-zinc-700"
              >
                Notify: Info
              </button>
              <button
                onClick={() => sendNotification("ability")}
                className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-cyan-300 hover:bg-zinc-700"
              >
                Notify: Ability
              </button>
              <button
                onClick={() => sendNotification("gate")}
                className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-amber-300 hover:bg-zinc-700"
              >
                Notify: Gate
              </button>
              <button
                onClick={() => sendNotification("item")}
                className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-green-300 hover:bg-zinc-700"
              >
                Notify: Item
              </button>
              <button
                onClick={() => sendNotification("warning")}
                className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-red-300 hover:bg-zinc-700"
              >
                Notify: Warning
              </button>
            </div>
          </details>

          {/* Day/Night */}
          <details open>
            <summary className="text-xs font-mono text-amber-400/80 uppercase tracking-wider cursor-pointer select-none pt-2">
              Day/Night Cycle
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <Slider
                label="Cycle Speed"
                value={cycleSpeed}
                min={0.5}
                max={10.0}
                step={0.5}
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

          {/* Controls */}
          <div className="border-t border-zinc-800 pt-2 mt-2 flex flex-col gap-2">
            <button
              onClick={toggleOverlays}
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
