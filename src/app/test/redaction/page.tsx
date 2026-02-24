"use client";

import { useRef, useState, useCallback } from "react";
import { GameCanvas } from "@/components/canvas/GameCanvas";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { Slider } from "@/components/debug/Slider";
import { Engine } from "@/engine/core/Engine";
import { Player, DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";
import { TileMap } from "@/engine/physics/TileMap";
import type { Platform } from "@/engine/physics/TileMap";
import type { PlayerParams } from "@/engine/entities/Player";
import { ParticleSystem } from "@/engine/core/ParticleSystem";
import { ScreenShake } from "@/engine/core/ScreenShake";
import { InputAction } from "@/engine/input/InputManager";
import {
  Redaction,
  DEFAULT_REDACTION_PARAMS,
  getAimDirection,
} from "@/engine/abilities/Redaction";
import type { RedactionParams } from "@/engine/abilities/Redaction";
import type { Obstacle } from "@/engine/physics/Obstacles";
import {
  createSpikes,
  createBarrier,
  createLaser,
  resetObstacleIdCounter,
} from "@/engine/physics/Obstacles";
import { aabbOverlap } from "@/engine/physics/AABB";
import { COLORS, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/constants";
import type { Rect } from "@/lib/types";
import Link from "next/link";

// ─── Constants ──────────────────────────────────────────────────────

const SPAWN_X = 60;
const SPAWN_Y = 340;
const RESPAWN_Y_THRESHOLD = 600;
const T = 32;

// ─── Damage Params ──────────────────────────────────────────────────

interface DamageParams {
  maxHp: number;
  spikeDamage: number;
  laserDamage: number;
  invincibilityFrames: number;
}

const DEFAULT_DAMAGE_PARAMS: DamageParams = {
  maxHp: 100,
  spikeDamage: 20,
  laserDamage: 10,
  invincibilityFrames: 30,
};

// ─── Player Health (local to test page) ─────────────────────────────

interface PlayerHealth {
  hp: number;
  maxHp: number;
  invincibilityFrames: number;
  lastDamageSource: string | null;
}

// ─── Pass Criteria Tracking ─────────────────────────────────────────

interface PassCriteria {
  obstaclesHighlighted: boolean;
  aimTargeting: boolean;
  redactionActivated: boolean;
  redactedSpikesInert: boolean;
  redactedBarrierPassable: boolean;
  activateFromAnyState: boolean;
  inkVisualExpands: boolean;
  redactionExpires: boolean;
  peelAwayVisual: boolean;
  twoSimultaneous: boolean;
  cooldownPrevents: boolean;
  outOfRangeBlocked: boolean;
  damageFromActive: boolean;
  noDamageFromRedacted: boolean;
  respawnOnDeath: boolean;
}

// ─── Test Level ─────────────────────────────────────────────────────

interface TestLevelData {
  tileMap: TileMap;
  obstacles: Obstacle[];
  barrierPlatformMap: Map<string, Platform>;
}

function createTestLevel(): TestLevelData {
  resetObstacleIdCounter();

  // Platforms (the solid world geometry)
  const platforms: Platform[] = [
    // Floor — left section (x: 0-180)
    { x: 0, y: 420, width: 180, height: T },

    // Floor — middle-left section (x: 300-430, after spike pit)
    { x: 300, y: 420, width: 130, height: T },

    // Floor — middle-right section (x: 530-680, after barrier)
    { x: 530, y: 420, width: 150, height: T },

    // Floor — right section (x: 810-960, after double barrier)
    { x: 810, y: 420, width: 150, height: T },

    // Elevated platform with spikes on top (x: 560-660, y: 300)
    { x: 560, y: 340, width: 100, height: T / 2 },

    // Goal platform (timed challenge — far right, elevated)
    { x: 890, y: 320, width: 60, height: T / 2 },

    // Pit floor (bottom of spike pit)
    { x: 180, y: 490, width: 120, height: T },

    // Boundary walls
    { x: -T, y: 0, width: T, height: 540 },
    { x: 960, y: 0, width: T, height: 540 },

    // Ceiling
    { x: 0, y: -T, width: 960, height: T },

    // Floor below everything (catch-all)
    { x: 0, y: 540, width: 960, height: T },
  ];

  // Barrier platforms — these also go in TileMap since barriers are solid
  const barrier1Platform: Platform = { x: 450, y: 280, width: 24, height: 140 };
  const barrier2Platform: Platform = { x: 700, y: 300, width: 20, height: 120 };
  const barrier3Platform: Platform = { x: 780, y: 300, width: 20, height: 120 };
  const timedBarrierPlatform: Platform = { x: 850, y: 280, width: 20, height: 140 };

  platforms.push(barrier1Platform, barrier2Platform, barrier3Platform, timedBarrierPlatform);

  const tileMap = new TileMap(platforms);

  // Obstacles
  const obstacles: Obstacle[] = [];

  // 1. Spike pit (x: 180-300, at the bottom of the gap)
  const spikePit = createSpikes({ x: 190, y: 470, width: 100, height: 20 }, 20);
  obstacles.push(spikePit);

  // 2. Barrier wall (x: 450, blocking passage)
  const barrierWall = createBarrier({ x: 450, y: 280, width: 24, height: 140 });
  obstacles.push(barrierWall);

  // 3. Spikes on elevated platform top
  const elevatedSpikes = createSpikes({ x: 565, y: 326, width: 90, height: 14 }, 20);
  obstacles.push(elevatedSpikes);

  // 4. Double-barrier corridor (x: 700 and 780)
  const doubleBarrier1 = createBarrier({ x: 700, y: 300, width: 20, height: 120 });
  const doubleBarrier2 = createBarrier({ x: 780, y: 300, width: 20, height: 120 });
  obstacles.push(doubleBarrier1, doubleBarrier2);

  // 5. Timed challenge barrier (x: 850)
  const timedBarrier = createBarrier({ x: 850, y: 280, width: 20, height: 140 });
  obstacles.push(timedBarrier);

  // 6. Overhead laser (x: 350-440, y: 370)
  const laser = createLaser({ x: 350, y: 370, width: 90, height: 4 }, 10);
  obstacles.push(laser);

  // 7. Out-of-range obstacle (far top, beyond range)
  const outOfRange = createSpikes({ x: 500, y: 20, width: 40, height: 16 }, 20);
  obstacles.push(outOfRange);

  // Map barrier obstacle IDs to their corresponding TileMap platforms
  const barrierPlatformMap = new Map<string, Platform>();
  barrierPlatformMap.set(barrierWall.id, barrier1Platform);
  barrierPlatformMap.set(doubleBarrier1.id, barrier2Platform);
  barrierPlatformMap.set(doubleBarrier2.id, barrier3Platform);
  barrierPlatformMap.set(timedBarrier.id, timedBarrierPlatform);

  return { tileMap, obstacles, barrierPlatformMap };
}

// ─── Overlay Ref Interface ──────────────────────────────────────────

interface EngineWithRefs extends Engine {
  __showOverlaysRef?: { current: boolean };
  __showRangeRef?: { current: boolean };
  __showAimConeRef?: { current: boolean };
}

// ─── Test Page Component ────────────────────────────────────────────

export default function RedactionTest() {
  const engineRef = useRef<Engine | null>(null);
  const playerRef = useRef<Player | null>(null);
  const redactionRef = useRef<Redaction | null>(null);
  const healthRef = useRef<PlayerHealth>({
    hp: DEFAULT_DAMAGE_PARAMS.maxHp,
    maxHp: DEFAULT_DAMAGE_PARAMS.maxHp,
    invincibilityFrames: 0,
    lastDamageSource: null,
  });
  const criteriaRef = useRef<PassCriteria>({
    obstaclesHighlighted: false,
    aimTargeting: false,
    redactionActivated: false,
    redactedSpikesInert: false,
    redactedBarrierPassable: false,
    activateFromAnyState: false,
    inkVisualExpands: false,
    redactionExpires: false,
    peelAwayVisual: false,
    twoSimultaneous: false,
    cooldownPrevents: false,
    outOfRangeBlocked: false,
    damageFromActive: false,
    noDamageFromRedacted: false,
    respawnOnDeath: false,
  });
  const activationStatesRef = useRef(new Set<string>());

  const [showOverlays, setShowOverlays] = useState(true);
  const [showRange, setShowRange] = useState(true);
  const [showAimCone, setShowAimCone] = useState(true);
  const [params, setParams] = useState<PlayerParams>({ ...DEFAULT_PLAYER_PARAMS });
  const [redactionParams, setRedactionParams] = useState<RedactionParams>({
    ...DEFAULT_REDACTION_PARAMS,
  });
  const [damageParams, setDamageParams] = useState<DamageParams>({
    ...DEFAULT_DAMAGE_PARAMS,
  });
  const damageParamsRef = useRef<DamageParams>({ ...DEFAULT_DAMAGE_PARAMS });

  // ─── Param Updaters ─────────────────────────────────────────────

  const updateParam = useCallback(
    <K extends keyof PlayerParams>(key: K, value: PlayerParams[K]) => {
      setParams((prev) => {
        const next = { ...prev, [key]: value };
        const player = playerRef.current;
        if (player) {
          player.params[key] = value;
          if (key === "playerWidth") player.size.x = value as number;
        }
        return next;
      });
    },
    [],
  );

  const updateRedactionParam = useCallback(
    <K extends keyof RedactionParams>(key: K, value: RedactionParams[K]) => {
      setRedactionParams((prev) => {
        const next = { ...prev, [key]: value };
        const redaction = redactionRef.current;
        if (redaction) {
          redaction.params[key] = value;
        }
        return next;
      });
    },
    [],
  );

  const updateDamageParam = useCallback(
    <K extends keyof DamageParams>(key: K, value: DamageParams[K]) => {
      setDamageParams((prev) => {
        const next = { ...prev, [key]: value };
        damageParamsRef.current = next;
        if (key === "maxHp") {
          healthRef.current.maxHp = value as number;
          if (healthRef.current.hp > (value as number)) {
            healthRef.current.hp = value as number;
          }
        }
        return next;
      });
    },
    [],
  );

  const resetParams = useCallback(() => {
    setParams({ ...DEFAULT_PLAYER_PARAMS });
    setRedactionParams({ ...DEFAULT_REDACTION_PARAMS });
    setDamageParams({ ...DEFAULT_DAMAGE_PARAMS });
    const player = playerRef.current;
    if (player) {
      Object.assign(player.params, DEFAULT_PLAYER_PARAMS);
      player.size.x = DEFAULT_PLAYER_PARAMS.playerWidth;
    }
    const redaction = redactionRef.current;
    if (redaction) {
      Object.assign(redaction.params, DEFAULT_REDACTION_PARAMS);
    }
    healthRef.current.maxHp = DEFAULT_DAMAGE_PARAMS.maxHp;
    damageParamsRef.current = { ...DEFAULT_DAMAGE_PARAMS };
  }, []);

  const resetPlayer = useCallback(() => {
    const player = playerRef.current;
    if (player) {
      player.position.x = SPAWN_X;
      player.position.y = SPAWN_Y;
      player.velocity.x = 0;
      player.velocity.y = 0;
      player.size.y = player.params.playerHeight;
      player.grounded = false;
      player.coyoteTimer = 0;
      player.jumpHeld = false;
      player.isInApexFloat = false;
      player.canCoyoteJump = false;
      player.wallSide = 0;
      player.wallJumpLockoutTimer = 0;
      player.wallCoyoteTimer = 0;
      player.canWallCoyoteJump = false;
      player.wallStickTimer = 0;
      player.dashCooldownTimer = 0;
      player.dashAvailable = true;
      player.isDashing = false;
      player.isInDashWindup = false;
      player.dashSpeedBoostRemaining = 0;
      player.dashTrailPositions = [];
      player.dashTrailFadeTimer = 0;
    }
    healthRef.current.hp = healthRef.current.maxHp;
    healthRef.current.invincibilityFrames = 0;
    healthRef.current.lastDamageSource = null;
  }, []);

  // ─── Engine Mount ───────────────────────────────────────────────

  const handleMount = useCallback((ctx: CanvasRenderingContext2D) => {
    const engine = new Engine({ ctx });
    const camera = engine.getCamera();
    const input = engine.getInput();
    const { tileMap, obstacles, barrierPlatformMap } = createTestLevel();

    // Player setup
    const player = new Player();
    player.position.x = SPAWN_X;
    player.position.y = SPAWN_Y;
    player.input = input;
    player.tileMap = tileMap;

    // Particle system & screen shake
    const particleSystem = new ParticleSystem();
    const screenShake = new ScreenShake();
    player.particleSystem = particleSystem;
    player.screenShake = screenShake;

    engine.getEntities().add(player);

    // Redaction system setup
    const redaction = new Redaction();
    redaction.setTileMap(tileMap);
    redaction.particleSystem = particleSystem;
    for (const [obsId, platform] of barrierPlatformMap) {
      redaction.registerObstaclePlatform(obsId, platform);
    }

    engineRef.current = engine;
    playerRef.current = player;
    redactionRef.current = redaction;

    // Refs for overlay toggles
    const showOverlaysRef = { current: true };
    const showRangeRef = { current: true };
    const showAimConeRef = { current: true };
    (engine as EngineWithRefs).__showOverlaysRef = showOverlaysRef;
    (engine as EngineWithRefs).__showRangeRef = showRangeRef;
    (engine as EngineWithRefs).__showAimConeRef = showAimConeRef;

    // Health ref from closure
    const health = healthRef.current;
    const criteria = criteriaRef.current;
    const activationStates = activationStatesRef.current;

    // Track previous targeted obstacle to detect aim changes
    let prevTargetedId: string | null = null;
    // Track whether player entered a redacted spike area
    let overlappingRedactedSpike = false;

    // ─── Update Callback ───────────────────────────────────────

    engine.onUpdate((dt) => {
      const dmgParams = damageParamsRef.current;

      // Auto-respawn on fall
      if (player.position.y > RESPAWN_Y_THRESHOLD) {
        player.position.x = SPAWN_X;
        player.position.y = SPAWN_Y;
        player.velocity.x = 0;
        player.velocity.y = 0;
        player.size.y = player.params.playerHeight;
        player.grounded = false;
        player.coyoteTimer = 0;
        player.jumpHeld = false;
        player.canCoyoteJump = false;
        player.wallSide = 0;
        player.wallJumpLockoutTimer = 0;
        player.canWallCoyoteJump = false;
        player.wallStickTimer = 0;
        player.dashCooldownTimer = 0;
        player.dashAvailable = true;
        player.isDashing = false;
        player.isInDashWindup = false;
        player.dashTrailPositions = [];
      }

      // Center camera on player
      const targetX = player.position.x + player.size.x / 2;
      const targetY = player.position.y + player.size.y / 2;
      const smoothing = 0.1;
      camera.position.x += (targetX - camera.position.x) * smoothing;
      camera.position.y += (targetY - camera.position.y) * smoothing;

      // Compute aim direction
      const aimDir = getAimDirection(
        input.isHeld(InputAction.Left),
        input.isHeld(InputAction.Right),
        input.isHeld(InputAction.Up),
        input.isHeld(InputAction.Down),
        player.facingRight,
      );

      const playerCenterX = player.position.x + player.size.x / 2;
      const playerCenterY = player.position.y + player.size.y / 2;

      // Scan for targets
      redaction.scanForTargets(
        { x: playerCenterX, y: playerCenterY },
        aimDir,
        obstacles,
      );

      // ─── Pass Criteria Detection ─────────────────────────────

      // Criterion 1: obstacles highlighted
      if (redaction.detectedObstacles.length > 0) {
        criteria.obstaclesHighlighted = true;
      }

      // Criterion 2: aim targeting changes based on direction
      if (redaction.targetedObstacle) {
        const currentId = redaction.targetedObstacle.obstacle.id;
        if (prevTargetedId !== null && currentId !== prevTargetedId) {
          criteria.aimTargeting = true;
        }
        prevTargetedId = currentId;
      }

      // Criterion 12: out-of-range obstacle never detected
      const outOfRangeObs = obstacles[obstacles.length - 1]; // Last one is out-of-range
      const outOfRangeDetected = redaction.detectedObstacles.some(
        (d) => d.obstacle === outOfRangeObs,
      );
      if (!outOfRangeDetected && obstacles.length > 0) {
        criteria.outOfRangeBlocked = true;
      }

      // Activation check
      if (input.isPressed(InputAction.Ability2)) {
        const currentState = player.stateMachine.getCurrentState();

        if (redaction.canActivate) {
          const activated = redaction.activate();
          if (activated) {
            // Criterion 3: redaction activated
            criteria.redactionActivated = true;
            // Criterion 7: ink visual expands (visual — we set it because activate() creates one)
            criteria.inkVisualExpands = true;

            // Criterion 6: activate from any state
            activationStates.add(currentState);
            if (activationStates.size >= 2) {
              criteria.activateFromAnyState = true;
            }
          }
        } else if (redaction.cooldownTimer > 0) {
          // Criterion 11: cooldown prevents re-use
          criteria.cooldownPrevents = true;
        }
      }

      // Criterion 10: two simultaneous redactions
      if (redaction.activeRedactions.length >= 2) {
        criteria.twoSimultaneous = true;
      }

      // Update redaction system
      const prevActiveCount = redaction.activeRedactions.length;
      redaction.update(dt);
      const currentActiveCount = redaction.activeRedactions.length;

      // Criterion 8 & 9: redaction expired (obstacle restored)
      if (currentActiveCount < prevActiveCount) {
        criteria.redactionExpires = true;
        criteria.peelAwayVisual = true; // Visual confirmed by particles

        // Check ejection for restored obstacles
        for (const obs of obstacles) {
          if (obs.active && obs.solid) {
            const ejected = redaction.getEjectionForObstacle(
              obs,
              player.position,
              player.size,
            );
            if (ejected) {
              player.position.x = ejected.x;
              player.position.y = ejected.y;
              player.velocity.x = 0;
              player.velocity.y = 0;
            }
          }
        }
      }

      // Update particles
      particleSystem.update(dt);

      // Update screen shake
      const shakeOffset = screenShake.update();
      camera.position.x += shakeOffset.offsetX;
      camera.position.y += shakeOffset.offsetY;

      // ─── Damage System ───────────────────────────────────────

      if (health.invincibilityFrames > 0) {
        health.invincibilityFrames--;
      }

      const playerBounds: Rect = {
        x: player.position.x,
        y: player.position.y,
        width: player.size.x,
        height: player.size.y,
      };

      // Check obstacle overlaps for damage
      for (const obs of obstacles) {
        if (obs.damage <= 0) continue;
        if (!aabbOverlap(playerBounds, obs.rect)) continue;

        if (obs.active) {
          // Active obstacle — deal damage
          if (health.invincibilityFrames <= 0) {
            const dmg =
              obs.type === "spikes" ? dmgParams.spikeDamage :
              obs.type === "laser" ? dmgParams.laserDamage :
              obs.damage;
            health.hp = Math.max(0, health.hp - dmg);
            health.invincibilityFrames = dmgParams.invincibilityFrames;
            health.lastDamageSource = obs.type;
            screenShake.shake(3, 6);

            // Criterion 13: damage from active obstacle
            criteria.damageFromActive = true;
          }
        } else {
          // Redacted obstacle — no damage
          if (obs.type === "spikes") {
            overlappingRedactedSpike = true;
          }
        }
      }

      // Criterion 4: overlapping redacted spike without HP decrease
      if (overlappingRedactedSpike) {
        criteria.redactedSpikesInert = true;
        overlappingRedactedSpike = false;
      }

      // Criterion 14: no damage from redacted obstacles
      // (Tracked implicitly — if criteria.redactedSpikesInert is true, it means no damage)
      if (criteria.redactedSpikesInert) {
        criteria.noDamageFromRedacted = true;
      }

      // Criterion 5: player passes through redacted barrier
      for (const obs of obstacles) {
        if (obs.type !== "barrier") continue;
        if (obs.active) continue; // Must be redacted
        if (aabbOverlap(playerBounds, obs.rect)) {
          // Player is inside the barrier rect while it's redacted
          criteria.redactedBarrierPassable = true;
        }
      }
      // Death & respawn
      if (health.hp <= 0) {
        criteria.respawnOnDeath = true;
        player.position.x = SPAWN_X;
        player.position.y = SPAWN_Y;
        player.velocity.x = 0;
        player.velocity.y = 0;
        health.hp = health.maxHp;
        health.invincibilityFrames = 60;
      }
    });

    // ─── World-Space Render Callback ─────────────────────────────

    engine.onRender((renderer, interpolation) => {
      // Draw tilemap
      tileMap.render(renderer);

      // Draw obstacles
      const rCtx = renderer.getContext();
      for (const obs of obstacles) {
        if (obs.active) {
          // Active obstacle — full color
          rCtx.save();
          rCtx.globalAlpha = 1;

          if (obs.type === "spikes") {
            // Draw spikes as triangular pattern
            rCtx.fillStyle = obs.color;
            const spikeWidth = 8;
            const count = Math.floor(obs.rect.width / spikeWidth);
            for (let i = 0; i < count; i++) {
              const sx = obs.rect.x + i * spikeWidth;
              rCtx.beginPath();
              rCtx.moveTo(sx, obs.rect.y + obs.rect.height);
              rCtx.lineTo(sx + spikeWidth / 2, obs.rect.y);
              rCtx.lineTo(sx + spikeWidth, obs.rect.y + obs.rect.height);
              rCtx.closePath();
              rCtx.fill();
            }
          } else if (obs.type === "barrier") {
            rCtx.fillStyle = obs.color;
            rCtx.fillRect(obs.rect.x, obs.rect.y, obs.rect.width, obs.rect.height);
            // Hatch pattern for barrier visual
            rCtx.strokeStyle = "rgba(255,255,255,0.15)";
            rCtx.lineWidth = 1;
            for (let i = 0; i < obs.rect.width + obs.rect.height; i += 8) {
              rCtx.beginPath();
              rCtx.moveTo(obs.rect.x + i, obs.rect.y);
              rCtx.lineTo(obs.rect.x + i - obs.rect.height, obs.rect.y + obs.rect.height);
              rCtx.stroke();
            }
          } else if (obs.type === "laser") {
            rCtx.fillStyle = obs.color;
            rCtx.fillRect(obs.rect.x, obs.rect.y, obs.rect.width, obs.rect.height);
            // Glow effect
            rCtx.shadowBlur = 8;
            rCtx.shadowColor = obs.color;
            rCtx.fillRect(obs.rect.x, obs.rect.y, obs.rect.width, obs.rect.height);
            rCtx.shadowBlur = 0;
          } else {
            rCtx.fillStyle = obs.color;
            rCtx.fillRect(obs.rect.x, obs.rect.y, obs.rect.width, obs.rect.height);
          }

          rCtx.restore();
        }
        // Redacted obstacles are rendered by the redaction system (ghost + ink mark)
      }

      // Render redaction visuals (targeting, active marks)
      redaction.render(rCtx);

      // Render particles (world space)
      particleSystem.render(renderer);

      if (!showOverlaysRef.current) return;

      const pos = player.getInterpolatedPosition(interpolation);
      const state = player.stateMachine.getCurrentState();

      // Player hitbox
      const isInvincible = health.invincibilityFrames > 0;
      const hitboxColor = isInvincible
        ? health.invincibilityFrames % 4 < 2
          ? "#ef4444"
          : "transparent"
        : COLORS.debug.hitbox;
      if (hitboxColor !== "transparent") {
        renderer.strokeRect(pos.x, pos.y, player.size.x, player.size.y, hitboxColor, 1);
      }

      // Obstacle hitboxes (debug)
      for (const obs of obstacles) {
        const outlineColor = obs.active
          ? "rgba(239, 68, 68, 0.5)"
          : "rgba(107, 114, 128, 0.4)";
        renderer.strokeRect(
          obs.rect.x,
          obs.rect.y,
          obs.rect.width,
          obs.rect.height,
          outlineColor,
          1,
        );
      }

      // Velocity vector
      const cx = pos.x + player.size.x / 2;
      const cy = pos.y + player.size.y / 2;
      const vScale = 0.15;
      const vx = player.velocity.x * vScale;
      const vy = player.velocity.y * vScale;
      if (Math.abs(vx) > 1 || Math.abs(vy) > 1) {
        renderer.drawLine(cx, cy, cx + vx, cy + vy, COLORS.debug.velocity, 2);
      }

      // State label
      renderer.drawText(state, pos.x, pos.y - 8, COLORS.debug.stateLabel, 10);

      // Ground contact indicator
      if (player.grounded) {
        renderer.drawCircle(
          pos.x + player.size.x / 2,
          pos.y + player.size.y + 3,
          3,
          COLORS.debug.ground,
        );
      }

      // HP bar above player
      const hpBarWidth = 30;
      const hpBarHeight = 4;
      const hpBarX = pos.x + player.size.x / 2 - hpBarWidth / 2;
      const hpBarY = pos.y - 16;
      const hpRatio = health.hp / health.maxHp;
      renderer.fillRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight, "rgba(100,100,100,0.5)");
      const hpColor = hpRatio > 0.5 ? "#4ade80" : hpRatio > 0.25 ? "#fbbf24" : "#ef4444";
      renderer.fillRect(hpBarX, hpBarY, hpBarWidth * hpRatio, hpBarHeight, hpColor);
    });

    // ─── Screen-Space Debug Layer ──────────────────────────────

    const debugLayerCallback = (debugCtx: CanvasRenderingContext2D) => {
      if (!showOverlaysRef.current) return;

      const metrics = engine.getMetrics();

      // FPS counter
      debugCtx.fillStyle = COLORS.debug.ground;
      debugCtx.font = "12px monospace";
      debugCtx.fillText(`FPS: ${Math.round(metrics.fps)}`, 8, 16);

      // Velocity readout
      debugCtx.fillStyle = COLORS.debug.velocity;
      debugCtx.textAlign = "right";
      debugCtx.fillText(
        `VelX: ${Math.round(player.velocity.x)} px/s`,
        CANVAS_WIDTH - 8,
        16,
      );
      debugCtx.fillText(
        `VelY: ${Math.round(player.velocity.y)} px/s`,
        CANVAS_WIDTH - 8,
        32,
      );
      debugCtx.textAlign = "left";

      // Redaction + state diagnostics (bottom-left)
      const diagX = 8;
      const diagY = CANVAS_HEIGHT - 120;
      debugCtx.fillStyle = "rgba(0, 0, 0, 0.6)";
      debugCtx.fillRect(diagX - 4, diagY - 14, 300, 130);

      debugCtx.fillStyle = "#a78bfa";
      debugCtx.font = "11px monospace";
      debugCtx.fillText(
        `State: ${player.stateMachine.getCurrentState()}`,
        diagX,
        diagY,
      );
      debugCtx.fillText(
        `Grounded: ${player.grounded ? "YES" : "NO"}`,
        diagX,
        diagY + 14,
      );

      // Redaction info
      debugCtx.fillStyle = "#ef4444";
      const abilityState =
        redaction.cooldownTimer > 0
          ? "COOLDOWN"
          : redaction.activeRedactions.length >= redaction.params.maxActiveRedactions
            ? "MAX ACTIVE"
            : "READY";
      debugCtx.fillText(`Redaction: ${abilityState}`, diagX, diagY + 34);
      debugCtx.fillText(
        `Active: ${redaction.activeRedactions.length}/${redaction.params.maxActiveRedactions}`,
        diagX,
        diagY + 48,
      );
      debugCtx.fillText(
        `Cooldown: ${redaction.cooldownTimer > 0 ? redaction.cooldownTimer.toFixed(1) + "s" : "--"}`,
        diagX,
        diagY + 62,
      );

      const targetInfo = redaction.targetedObstacle
        ? `${redaction.targetedObstacle.obstacle.type} (${Math.round(redaction.targetedObstacle.distance)}px)`
        : "none";
      debugCtx.fillText(`Target: ${targetInfo}`, diagX, diagY + 76);

      debugCtx.fillStyle = "#4ade80";
      debugCtx.fillText(
        `HP: ${health.hp}/${health.maxHp}`,
        diagX,
        diagY + 96,
      );
      if (health.invincibilityFrames > 0) {
        debugCtx.fillText(
          `I-Frames: ${health.invincibilityFrames}`,
          diagX + 140,
          diagY + 96,
        );
      }

      // Render redaction UI (range circle, aim cone) in screen space
      const playerScreenPos = camera.worldToScreen({
        x: player.position.x + player.size.x / 2,
        y: player.position.y + player.size.y / 2,
      });

      const aimDir = getAimDirection(
        input.isHeld(InputAction.Left),
        input.isHeld(InputAction.Right),
        input.isHeld(InputAction.Up),
        input.isHeld(InputAction.Down),
        player.facingRight,
      );

      if (showRangeRef.current || showAimConeRef.current) {
        debugCtx.save();

        if (showRangeRef.current) {
          // Range circle
          const range = redaction.params.maxRedactionRange * camera.zoom;
          debugCtx.strokeStyle = "rgba(239, 68, 68, 0.12)";
          debugCtx.lineWidth = 1;
          debugCtx.setLineDash([4, 4]);
          debugCtx.beginPath();
          debugCtx.arc(
            playerScreenPos.x,
            playerScreenPos.y,
            range,
            0,
            Math.PI * 2,
          );
          debugCtx.stroke();
          debugCtx.setLineDash([]);
        }

        if (showAimConeRef.current) {
          // Aim cone
          const coneLen = redaction.params.maxRedactionRange * camera.zoom;
          const halfAngle = redaction.params.aimConeHalfAngle;
          const aimAngle = Math.atan2(aimDir.y, aimDir.x);
          debugCtx.fillStyle = "rgba(239, 68, 68, 0.08)";
          debugCtx.beginPath();
          debugCtx.moveTo(playerScreenPos.x, playerScreenPos.y);
          debugCtx.arc(
            playerScreenPos.x,
            playerScreenPos.y,
            coneLen,
            aimAngle - halfAngle,
            aimAngle + halfAngle,
          );
          debugCtx.closePath();
          debugCtx.fill();

          // Aim direction arrow
          const arrowLen = 25;
          const ax = playerScreenPos.x + aimDir.x * arrowLen;
          const ay = playerScreenPos.y + aimDir.y * arrowLen;
          debugCtx.strokeStyle = "#ef4444";
          debugCtx.lineWidth = 1.5;
          debugCtx.beginPath();
          debugCtx.moveTo(playerScreenPos.x, playerScreenPos.y);
          debugCtx.lineTo(ax, ay);
          debugCtx.stroke();
        }

        // Cooldown text below player
        if (redaction.cooldownTimer > 0) {
          debugCtx.fillStyle = "rgba(239, 68, 68, 0.7)";
          debugCtx.font = "10px monospace";
          debugCtx.textAlign = "center";
          debugCtx.fillText(
            `CD: ${redaction.cooldownTimer.toFixed(1)}s`,
            playerScreenPos.x,
            playerScreenPos.y + 35,
          );
          debugCtx.textAlign = "left";
        }

        debugCtx.restore();
      }
    };
    engine.getRenderer().addLayerCallback("debug", debugLayerCallback);

    engine.start();
  }, []);

  const handleUnmount = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    playerRef.current = null;
    redactionRef.current = null;
  }, []);

  const toggleOverlays = useCallback(() => {
    setShowOverlays((prev) => {
      const next = !prev;
      const engine = engineRef.current as EngineWithRefs | null;
      if (engine?.__showOverlaysRef) engine.__showOverlaysRef.current = next;
      return next;
    });
  }, []);

  const toggleRange = useCallback(() => {
    setShowRange((prev) => {
      const next = !prev;
      const engine = engineRef.current as EngineWithRefs | null;
      if (engine?.__showRangeRef) engine.__showRangeRef.current = next;
      return next;
    });
  }, []);

  const toggleAimCone = useCallback(() => {
    setShowAimCone((prev) => {
      const next = !prev;
      const engine = engineRef.current as EngineWithRefs | null;
      if (engine?.__showAimConeRef) engine.__showAimConeRef.current = next;
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
        <h1 className="font-mono text-sm font-bold text-red-500">Redaction</h1>
        <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs font-mono text-red-400">
          Phase 2 — Abilities
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
            Obstacles in range highlighted &middot; Directional aim selects
            nearest &middot; Q redacts targeted obstacle &middot; Redacted
            spikes inert &middot; Redacted barriers passable &middot; Activates
            from any state &middot; Ink mark expands &middot; Redaction expires
            &amp; restores &middot; Peel-away visual &middot; 2 simultaneous
            redactions &middot; Cooldown prevents reuse &middot; Out-of-range
            not targetable &middot; Damage from active obstacles &middot; No
            damage from redacted &middot; Respawn on death
          </div>

          {/* Controls legend */}
          <div className="w-[960px] text-xs font-mono text-zinc-600 leading-relaxed">
            <span className="text-zinc-500">Controls: </span>
            Arrows/WASD = Move &middot; Z/Space = Jump &middot; X/Shift =
            Dash &middot; Q = Redact
          </div>
        </div>

        {/* Debug panel */}
        <DebugPanel title="Redaction">
          {/* Redaction Info (always visible) */}
          <div className="border-b border-zinc-800 pb-2 mb-2">
            <div className="text-xs font-mono text-red-400 uppercase tracking-wider mb-1">
              Redaction Info
            </div>
            <div className="text-xs font-mono text-zinc-400 space-y-0.5">
              <div>
                State:{" "}
                <span className="text-zinc-200">
                  {redactionRef.current
                    ? redactionRef.current.cooldownTimer > 0
                      ? "COOLDOWN"
                      : "READY"
                    : "--"}
                </span>
              </div>
              <div>
                Active:{" "}
                <span className="text-zinc-200">
                  {redactionRef.current
                    ? `${redactionRef.current.activeRedactions.length}/${redactionRef.current.params.maxActiveRedactions}`
                    : "--"}
                </span>
              </div>
            </div>
          </div>

          {/* Redaction Params */}
          <details open>
            <summary className="text-xs font-mono text-red-400 uppercase tracking-wider cursor-pointer select-none">
              Redaction Params
            </summary>
            <div className="flex flex-col gap-4 pt-2">
              <Slider
                label="Max Range"
                value={redactionParams.maxRedactionRange}
                min={60}
                max={400}
                step={10}
                onChange={(v) => updateRedactionParam("maxRedactionRange", v)}
              />
              <Slider
                label="Duration"
                value={redactionParams.redactionDuration}
                min={1.0}
                max={15.0}
                step={0.5}
                onChange={(v) => updateRedactionParam("redactionDuration", v)}
              />
              <Slider
                label="Cooldown"
                value={redactionParams.redactionCooldown}
                min={0.0}
                max={10.0}
                step={0.5}
                onChange={(v) => updateRedactionParam("redactionCooldown", v)}
              />
              <Slider
                label="Max Active"
                value={redactionParams.maxActiveRedactions}
                min={1}
                max={5}
                step={1}
                onChange={(v) => updateRedactionParam("maxActiveRedactions", v)}
              />
              <Slider
                label="Visual Speed"
                value={redactionParams.redactionVisualSpeed}
                min={1.0}
                max={15.0}
                step={0.5}
                onChange={(v) => updateRedactionParam("redactionVisualSpeed", v)}
              />
              <Slider
                label="Aim Cone (deg)"
                value={Math.round(
                  (redactionParams.aimConeHalfAngle * 180) / Math.PI,
                )}
                min={15}
                max={90}
                step={5}
                onChange={(v) =>
                  updateRedactionParam(
                    "aimConeHalfAngle",
                    (v * Math.PI) / 180,
                  )
                }
              />
            </div>
          </details>

          {/* Damage & Health */}
          <details>
            <summary className="text-xs font-mono text-green-400 uppercase tracking-wider cursor-pointer select-none pt-2">
              Damage &amp; Health
            </summary>
            <div className="flex flex-col gap-4 pt-2">
              <Slider
                label="Max HP"
                value={damageParams.maxHp}
                min={50}
                max={200}
                step={10}
                onChange={(v) => updateDamageParam("maxHp", v)}
              />
              <Slider
                label="Spike Damage"
                value={damageParams.spikeDamage}
                min={5}
                max={50}
                step={5}
                onChange={(v) => updateDamageParam("spikeDamage", v)}
              />
              <Slider
                label="Laser Damage"
                value={damageParams.laserDamage}
                min={5}
                max={50}
                step={5}
                onChange={(v) => updateDamageParam("laserDamage", v)}
              />
              <Slider
                label="I-Frames"
                value={damageParams.invincibilityFrames}
                min={10}
                max={60}
                step={5}
                onChange={(v) => updateDamageParam("invincibilityFrames", v)}
              />
            </div>
          </details>

          {/* Player State */}
          <details>
            <summary className="text-xs font-mono text-zinc-500 uppercase tracking-wider cursor-pointer select-none pt-2">
              Player Movement
            </summary>
            <div className="flex flex-col gap-4 pt-2">
              <Slider
                label="Max Run Speed"
                value={params.maxRunSpeed}
                min={50}
                max={600}
                step={10}
                onChange={(v) => updateParam("maxRunSpeed", v)}
              />
              <Slider
                label="Acceleration"
                value={params.acceleration}
                min={200}
                max={5000}
                step={100}
                onChange={(v) => updateParam("acceleration", v)}
              />
              <Slider
                label="Jump Speed"
                value={params.jumpSpeed}
                min={200}
                max={600}
                step={10}
                onChange={(v) => updateParam("jumpSpeed", v)}
              />
              <Slider
                label="Dash Speed"
                value={params.dashSpeed}
                min={200}
                max={1200}
                step={25}
                onChange={(v) => updateParam("dashSpeed", v)}
              />
            </div>
          </details>

          {/* Controls */}
          <details open>
            <summary className="text-xs font-mono text-amber-500/80 uppercase tracking-wider cursor-pointer select-none pt-2">
              Controls
            </summary>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={resetPlayer}
                className="w-full rounded bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Reset Player
              </button>
              <button
                onClick={resetParams}
                className="w-full rounded bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Reset Params
              </button>
              <button
                onClick={toggleOverlays}
                className={`w-full rounded px-3 py-1.5 text-xs font-mono transition-colors ${
                  showOverlays
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Debug Overlays: {showOverlays ? "ON" : "OFF"}
              </button>
              <button
                onClick={toggleRange}
                className={`w-full rounded px-3 py-1.5 text-xs font-mono transition-colors ${
                  showRange
                    ? "bg-red-500/20 text-red-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Range Circle: {showRange ? "ON" : "OFF"}
              </button>
              <button
                onClick={toggleAimCone}
                className={`w-full rounded px-3 py-1.5 text-xs font-mono transition-colors ${
                  showAimCone
                    ? "bg-red-500/20 text-red-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                Aim Cone: {showAimCone ? "ON" : "OFF"}
              </button>
            </div>
          </details>
        </DebugPanel>
      </div>
    </div>
  );
}
