"use client";

import { useRef, useState, useCallback } from "react";
import { GameCanvas } from "@/components/canvas/GameCanvas";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { Slider } from "@/components/debug/Slider";
import { RenderModeToggle } from "@/components/debug/RenderModeToggle";
import { Engine } from "@/engine/core/Engine";
import { Player, DEFAULT_PLAYER_PARAMS } from "@/engine/entities/Player";
import { TileMap } from "@/engine/physics/TileMap";
import type { Platform } from "@/engine/physics/TileMap";
import type { PlayerParams } from "@/engine/entities/Player";
import { ParticleSystem } from "@/engine/core/ParticleSystem";
import { ScreenShake } from "@/engine/core/ScreenShake";
import { RenderConfig } from "@/engine/core/RenderConfig";
import { InputAction } from "@/engine/input/InputManager";
import type { InputManager } from "@/engine/input/InputManager";
import { CombatSystem } from "@/engine/combat/CombatSystem";
import { DEFAULT_COMBAT_PARAMS } from "@/engine/combat/CombatParams";
import type { CombatParams } from "@/engine/combat/CombatParams";
import { TargetDummy } from "@/engine/combat/TargetDummy";
import { PlayerHealth, DEFAULT_PLAYER_HEALTH_PARAMS } from "@/engine/combat/PlayerHealth";
import type { PlayerHealthParams } from "@/engine/combat/PlayerHealth";
import type { AttackDirection, WeaponType } from "@/engine/combat/types";
import { COLORS, CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/constants";
import type { Vec2 } from "@/lib/types";
import {
  CardModifierEngine,
  DEFAULT_CARD_ENGINE_PARAMS,
  CraftingSystem,
  CardRenderer,
  CARD_RENDER_WIDTH,
  CARD_RENDER_HEIGHT,
  createCard,
  CATEGORY_COLORS,
} from "@/engine/cards";
import type {
  InkCard,
  CardModifierEngineParams,
  CraftingRecipe,
  ModifierSummaryEntry,
} from "@/engine/cards";
import Link from "next/link";

// ─── Constants ──────────────────────────────────────────────────

const SPAWN_X = 80;
const SPAWN_Y = 420;
const RESPAWN_Y_THRESHOLD = 600;
const MAIN_GROUND_Y = 460;

// ─── Floating Damage Number ─────────────────────────────────────

interface FloatingNumber {
  text: string;
  x: number;
  y: number;
  vy: number;
  alpha: number;
  timer: number;
  maxTimer: number;
}

const FLOAT_DURATION = 0.8;
const FLOAT_SPEED = -60;

// ─── UI Mode ────────────────────────────────────────────────────

type UIMode = "play" | "deck";

// ─── Deck UI State ──────────────────────────────────────────────

interface DeckUIState {
  selectedCollectionIndex: number;
  selectedRecipeIndex: number;
  collectionScrollOffset: number;
  activePanel: "collection" | "crafting";
}

// ─── Attack Direction Helper ────────────────────────────────────

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

// ─── Create Test Level ──────────────────────────────────────────

function createTestLevel(): { tileMap: TileMap; dummy: TargetDummy } {
  const platforms: Platform[] = [
    // Ground floor
    { x: 0, y: MAIN_GROUND_Y, width: 960, height: 80 },
    // Elevated platforms for jump testing
    { x: 100, y: 340, width: 120, height: 20 },
    { x: 360, y: 280, width: 100, height: 20 },
    { x: 600, y: 320, width: 140, height: 20 },
    // Wall for wall mechanics testing
    { x: 250, y: 200, width: 20, height: 260 },
    // High platform (tests enhanced jump)
    { x: 300, y: 180, width: 100, height: 20 },
    // Boundaries
    { x: 0, y: 0, width: 960, height: 20 }, // Ceiling
    { x: 0, y: 0, width: 20, height: 540 }, // Left wall
    { x: 940, y: 0, width: 20, height: 540 }, // Right wall
  ];

  const tileMap = new TileMap(platforms);

  const dummy = new TargetDummy({
    position: { x: 750, y: MAIN_GROUND_Y - 40 },
    health: 10,
    color: "#ef4444",
    respawns: true,
    respawnDelay: 120,
    patrol: false,
    patrolRange: 0,
    patrolSpeed: 0,
    groundY: MAIN_GROUND_Y,
  });
  dummy.mainFloorY = MAIN_GROUND_Y;

  return { tileMap, dummy };
}

// ─── Starting Collection ────────────────────────────────────────

function createStartingCollection(): InkCard[] {
  return [
    // Swiftness
    createCard("swift-strider", 1),
    createCard("swift-strider", 1),
    createCard("leap-glyph", 1),
    createCard("leap-glyph", 1),
    createCard("dash-inscription", 1),
    createCard("air-script", 1),
    // Might
    createCard("spear-verse", 1),
    createCard("spear-verse", 1),
    createCard("snap-verse", 1),
    createCard("snap-verse", 1),
    createCard("battle-tempo", 1),
    createCard("battle-tempo", 1),
    // Resilience
    createCard("vellum-shield", 1),
    createCard("vellum-shield", 1),
    createCard("ward-inscription", 1),
    createCard("stoic-page", 1),
    // Precision
    createCard("ledge-reader", 1),
    createCard("ledge-reader", 1),
    createCard("wall-binding", 1),
    // Arcana
    createCard("scribes-haste", 1),
    createCard("ink-well", 1),
    createCard("margin-expander", 1),
    // Pre-made Tier 2s
    createCard("swift-strider", 2),
    createCard("vellum-shield", 2),
  ];
}

// ─── Overlay Ref Interface ──────────────────────────────────────

interface EngineWithRefs extends Engine {
  __showOverlaysRef?: { current: boolean };
}

// ─── Collection Grid Layout ─────────────────────────────────────

const GRID_COLS = 4;
const GRID_CELL_W = CARD_RENDER_WIDTH + 10;
const GRID_CELL_H = CARD_RENDER_HEIGHT + 10;
const GRID_X = 20;
const GRID_Y = 110;
const GRID_WIDTH = GRID_COLS * GRID_CELL_W + 12;
const GRID_HEIGHT = 320;

// Crafting panel
const CRAFT_X = GRID_X + GRID_WIDTH + 16;
const CRAFT_Y = 110;
const CRAFT_WIDTH = 270;
const CRAFT_HEIGHT = 200;

// Stat preview
const STAT_X = GRID_X;
const STAT_Y = GRID_Y + GRID_HEIGHT + 24;
const STAT_WIDTH = GRID_WIDTH;

// Deck bar
const DECK_BAR_X = 20;
const DECK_BAR_Y = 14;

// ─── Test Page Component ────────────────────────────────────────

export default function InkCardsTest() {
  const engineRef = useRef<Engine | null>(null);
  const playerRef = useRef<Player | null>(null);
  const combatRef = useRef<CombatSystem | null>(null);
  const playerHealthRef = useRef<PlayerHealth | null>(null);
  const dummyRef = useRef<TargetDummy | null>(null);
  const cardEngineRef = useRef<CardModifierEngine | null>(null);
  const craftingRef = useRef<CraftingSystem | null>(null);
  const floatingNumbersRef = useRef<FloatingNumber[]>([]);
  const modeRef = useRef<UIMode>("play");
  const deckUIRef = useRef<DeckUIState>({
    selectedCollectionIndex: 0,
    selectedRecipeIndex: 0,
    collectionScrollOffset: 0,
    activePanel: "collection",
  });

  const [showOverlays, setShowOverlays] = useState(true);
  const [mode, setMode] = useState<UIMode>("play");
  const [, forceUpdate] = useState(0);

  // Card engine params (for slider binding)
  const [engineParams, setEngineParams] = useState<CardModifierEngineParams>({
    ...DEFAULT_CARD_ENGINE_PARAMS,
  });

  // ─── Param Updaters ─────────────────────────────────────────

  const updateCardEngineParam = useCallback(
    <K extends keyof CardModifierEngineParams>(
      key: K,
      value: CardModifierEngineParams[K],
    ) => {
      setEngineParams((prev) => {
        const next = { ...prev, [key]: value };
        const ce = cardEngineRef.current;
        if (ce) {
          (ce.params as unknown as Record<string, unknown>)[key] = value;
          if (key === "maxEquipped") {
            ce.deck.maxEquipped = value as number;
          }
        }
        return next;
      });
    },
    [],
  );

  const updateStatCap = useCallback(
    (stat: string, field: "min" | "max", value: number) => {
      setEngineParams((prev) => {
        const next = { ...prev, statCaps: { ...prev.statCaps } };
        const existing = next.statCaps[stat as keyof typeof next.statCaps] ?? {};
        next.statCaps[stat as keyof typeof next.statCaps] = {
          ...existing,
          [field]: value,
        };
        const ce = cardEngineRef.current;
        if (ce) {
          ce.params.statCaps = next.statCaps;
        }
        return next;
      });
    },
    [],
  );

  const resetCollection = useCallback(() => {
    const ce = cardEngineRef.current;
    if (!ce) return;
    ce.deck.equippedIds = [];
    ce.deck.collection = createStartingCollection();
    forceUpdate((n) => n + 1);
  }, []);

  const addRandomCard = useCallback(() => {
    const ce = cardEngineRef.current;
    if (!ce) return;
    const defs = [
      "swift-strider",
      "leap-glyph",
      "dash-inscription",
      "air-script",
      "spear-verse",
      "snap-verse",
      "battle-tempo",
      "vellum-shield",
      "ward-inscription",
      "stoic-page",
      "ledge-reader",
      "wall-binding",
      "scribes-haste",
      "ink-well",
      "margin-expander",
    ];
    const defId = defs[Math.floor(Math.random() * defs.length)];
    const card = createCard(defId, 1);
    ce.addToCollection(card);
    forceUpdate((n) => n + 1);
  }, []);

  const addAllTier1 = useCallback(() => {
    const ce = cardEngineRef.current;
    if (!ce) return;
    const defs = [
      "swift-strider",
      "leap-glyph",
      "dash-inscription",
      "air-script",
      "spear-verse",
      "snap-verse",
      "battle-tempo",
      "vellum-shield",
      "ward-inscription",
      "stoic-page",
      "ledge-reader",
      "wall-binding",
      "scribes-haste",
      "ink-well",
      "margin-expander",
    ];
    for (const defId of defs) {
      ce.addToCollection(createCard(defId, 1));
    }
    forceUpdate((n) => n + 1);
  }, []);

  const clearCollection = useCallback(() => {
    const ce = cardEngineRef.current;
    if (!ce) return;
    ce.deck.equippedIds = [];
    ce.deck.collection = [];
    forceUpdate((n) => n + 1);
  }, []);

  // ─── Engine Mount ─────────────────────────────────────────────

  const handleMount = useCallback((ctx: CanvasRenderingContext2D) => {
    RenderConfig.setMode("rectangles");
    const engine = new Engine({ ctx });
    const input = engine.getInput();
    const { tileMap, dummy } = createTestLevel();

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

    // Combat system
    const combat = new CombatSystem();
    const playerHealth = new PlayerHealth();
    let selectedWeapon: WeaponType = "quill-spear";

    // Card systems
    const cardEngine = new CardModifierEngine();
    const crafting = new CraftingSystem();

    // Load starting collection
    const startingCards = createStartingCollection();
    for (const card of startingCards) {
      cardEngine.addToCollection(card);
    }

    // Store refs
    engineRef.current = engine;
    playerRef.current = player;
    combatRef.current = combat;
    playerHealthRef.current = playerHealth;
    dummyRef.current = dummy;
    cardEngineRef.current = cardEngine;
    craftingRef.current = crafting;

    const showOverlaysRef = { current: true };
    (engine as EngineWithRefs).__showOverlaysRef = showOverlaysRef;

    const floatingNumbers = floatingNumbersRef.current;

    // Base params (unmodified by cards)
    const basePlayerParams = { ...DEFAULT_PLAYER_PARAMS };
    const baseCombatParams = { ...DEFAULT_COMBAT_PARAMS };
    const baseHealthParams = { ...DEFAULT_PLAYER_HEALTH_PARAMS };

    // ─── Deck Mode Key Handler ────────────────────────────────

    const handleDeckKeys = (e: KeyboardEvent) => {
      if (modeRef.current !== "deck") return;

      const ui = deckUIRef.current;
      const collection = cardEngine.deck.collection;
      const recipes = crafting.getAvailableCrafts(collection);

      switch (e.key) {
        case "ArrowLeft": {
          e.preventDefault();
          if (ui.activePanel === "collection") {
            if (ui.selectedCollectionIndex > 0) {
              ui.selectedCollectionIndex--;
            }
          }
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          if (ui.activePanel === "collection") {
            if (ui.selectedCollectionIndex < collection.length - 1) {
              ui.selectedCollectionIndex++;
            }
          }
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          if (ui.activePanel === "collection") {
            if (ui.selectedCollectionIndex >= GRID_COLS) {
              ui.selectedCollectionIndex -= GRID_COLS;
            }
          } else {
            if (ui.selectedRecipeIndex > 0) {
              ui.selectedRecipeIndex--;
            }
          }
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          if (ui.activePanel === "collection") {
            if (ui.selectedCollectionIndex + GRID_COLS < collection.length) {
              ui.selectedCollectionIndex += GRID_COLS;
            }
          } else {
            if (ui.selectedRecipeIndex < recipes.length - 1) {
              ui.selectedRecipeIndex++;
            }
          }
          break;
        }
        case "Enter": {
          e.preventDefault();
          if (
            ui.activePanel === "collection" &&
            ui.selectedCollectionIndex >= 0 &&
            ui.selectedCollectionIndex < collection.length
          ) {
            const card = collection[ui.selectedCollectionIndex];
            if (cardEngine.deck.equippedIds.includes(card.id)) {
              cardEngine.unequipCard(card.id);
            } else {
              cardEngine.equipCard(card.id);
            }
            forceUpdate((n) => n + 1);
          }
          break;
        }
        case "c":
        case "C": {
          e.preventDefault();
          if (
            ui.activePanel === "crafting" &&
            ui.selectedRecipeIndex >= 0 &&
            ui.selectedRecipeIndex < recipes.length
          ) {
            const recipe = recipes[ui.selectedRecipeIndex];
            const result = crafting.craft(collection, recipe);
            if (result) {
              for (const consumed of result.consumed) {
                cardEngine.removeFromCollection(consumed.id);
              }
              cardEngine.addToCollection(result.produced);
              // Reset recipe index if we went past the end
              const newRecipes = crafting.getAvailableCrafts(
                cardEngine.deck.collection,
              );
              if (ui.selectedRecipeIndex >= newRecipes.length) {
                ui.selectedRecipeIndex = Math.max(0, newRecipes.length - 1);
              }
              forceUpdate((n) => n + 1);
            }
          }
          break;
        }
        case "Escape": {
          e.preventDefault();
          ui.selectedCollectionIndex = -1;
          break;
        }
        // Switch panel focus
        case "q":
        case "Q": {
          e.preventDefault();
          ui.activePanel =
            ui.activePanel === "collection" ? "crafting" : "collection";
          break;
        }
      }

      // Update scroll to keep selected card visible
      if (ui.activePanel === "collection" && ui.selectedCollectionIndex >= 0) {
        const row = Math.floor(ui.selectedCollectionIndex / GRID_COLS);
        const cardTop = row * GRID_CELL_H;
        const cardBot = cardTop + GRID_CELL_H;

        if (cardTop < ui.collectionScrollOffset) {
          ui.collectionScrollOffset = cardTop;
        } else if (cardBot > ui.collectionScrollOffset + GRID_HEIGHT) {
          ui.collectionScrollOffset = cardBot - GRID_HEIGHT;
        }
      }
    };

    // ─── Play Mode Key Handler ─────────────────────────────────

    const handlePlayKeys = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        if (modeRef.current === "play") {
          modeRef.current = "deck";
          setMode("deck");
        } else {
          modeRef.current = "play";
          setMode("play");
        }
        return;
      }

      if (modeRef.current !== "play") return;

      if (e.key === "`") {
        showOverlaysRef.current = !showOverlaysRef.current;
        return;
      }

      if (e.key === "k" || e.key === "K") {
        selectedWeapon =
          selectedWeapon === "quill-spear" ? "ink-snap" : "quill-spear";
        combat.currentWeapon = selectedWeapon;
      }
    };

    window.addEventListener("keydown", handleDeckKeys);
    window.addEventListener("keydown", handlePlayKeys);

    // ─── Mouse Click Handler for Deck Mode ─────────────────────

    const canvas = ctx.canvas;
    const handleClick = (e: MouseEvent) => {
      if (modeRef.current !== "deck") return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      const ui = deckUIRef.current;
      const collection = cardEngine.deck.collection;

      // Check if click is in collection grid
      if (
        mx >= GRID_X &&
        mx <= GRID_X + GRID_WIDTH &&
        my >= GRID_Y &&
        my <= GRID_Y + GRID_HEIGHT
      ) {
        const localX = mx - GRID_X - 6;
        const localY = my - GRID_Y - 6 + ui.collectionScrollOffset;
        const col = Math.floor(localX / GRID_CELL_W);
        const row = Math.floor(localY / GRID_CELL_H);
        const idx = row * GRID_COLS + col;

        if (col >= 0 && col < GRID_COLS && idx >= 0 && idx < collection.length) {
          if (ui.selectedCollectionIndex === idx) {
            // Double-click = equip/unequip
            const card = collection[idx];
            if (cardEngine.deck.equippedIds.includes(card.id)) {
              cardEngine.unequipCard(card.id);
            } else {
              cardEngine.equipCard(card.id);
            }
          }
          ui.selectedCollectionIndex = idx;
          ui.activePanel = "collection";
          forceUpdate((n) => n + 1);
        }
      }

      // Check if click is in crafting panel
      if (
        mx >= CRAFT_X &&
        mx <= CRAFT_X + CRAFT_WIDTH &&
        my >= CRAFT_Y &&
        my <= CRAFT_Y + CRAFT_HEIGHT
      ) {
        const recipes = crafting.getAvailableCrafts(collection);
        const localY = my - CRAFT_Y - 8;
        const recipeIdx = Math.floor(localY / 40);
        if (recipeIdx >= 0 && recipeIdx < recipes.length) {
          ui.selectedRecipeIndex = recipeIdx;
          ui.activePanel = "crafting";
          forceUpdate((n) => n + 1);
        }
      }
    };
    canvas.addEventListener("click", handleClick);

    // ─── Update Callback ──────────────────────────────────────

    engine.onUpdate((dt) => {
      // Skip physics in deck mode
      if (modeRef.current === "deck") return;

      // Apply card modifiers to params
      const modifiedPlayerParams = cardEngine.applyToPlayerParams(basePlayerParams);
      const modifiedCombatParams = cardEngine.applyToCombatParams(baseCombatParams);
      const modifiedHealthParams = cardEngine.applyToHealthParams(baseHealthParams);

      // Sync modified params to player
      Object.assign(player.params, modifiedPlayerParams);
      player.size.x = player.params.playerWidth;

      // Sync combat params
      Object.assign(combat.params, modifiedCombatParams);

      // Sync health params
      playerHealth.params = modifiedHealthParams;
      playerHealth.maxHealth = modifiedHealthParams.maxHealth;
      if (playerHealth.health > playerHealth.maxHealth) {
        playerHealth.health = playerHealth.maxHealth;
      }

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
      }

      // Weapon switching
      if (input.isPressed(InputAction.WeaponSwitch)) {
        selectedWeapon =
          selectedWeapon === "quill-spear" ? "ink-snap" : "quill-spear";
        combat.currentWeapon = selectedWeapon;
      }

      // Attack input
      const playerState = player.stateMachine.getCurrentState();
      if (
        input.isPressed(InputAction.Attack) &&
        combat.canAttack(playerState)
      ) {
        const playerCenter: Vec2 = {
          x: player.position.x + player.size.x / 2,
          y: player.position.y + player.size.y / 2,
        };
        if (selectedWeapon === "quill-spear") {
          const direction = getAttackDirection(input, player.facingRight);
          combat.startSpearAttack(direction);
        } else {
          const aliveTargets = dummy.isAlive
            ? [{ id: dummy.id, bounds: dummy.getBounds() }]
            : [];
          const autoAimTarget = combat.findSnapTarget(
            playerCenter,
            aliveTargets,
          );
          combat.startSnapAttack(
            autoAimTarget?.position ?? null,
            autoAimTarget?.id ?? null,
            player.facingRight,
          );
        }
      }

      // Update combat system
      combat.update(player.getBounds(), player.facingRight);

      // Hit detection
      if (combat.activeHitbox && combat.attackPhase === "active") {
        const hitTargets =
          dummy.isAlive && dummy.invincibilityFrames <= 0
            ? [{ id: dummy.id, bounds: dummy.getBounds() }]
            : [];
        const hits = combat.checkHits(hitTargets);

        for (const hit of hits) {
          if (hit.targetId === dummy.id) {
            const hitstopFrames =
              combat.currentWeapon === "quill-spear"
                ? combat.params.spearHitstopFrames
                : combat.params.snapHitstopFrames;
            dummy.takeDamage(hit.damage, hit.knockback, hitstopFrames);

            // Screen shake
            const shakeIntensity =
              combat.currentWeapon === "quill-spear"
                ? combat.params.spearShakeIntensity
                : combat.params.snapShakeIntensity;
            const shakeFrames =
              combat.currentWeapon === "quill-spear"
                ? combat.params.spearShakeFrames
                : combat.params.snapShakeFrames;
            screenShake.shake(shakeIntensity, shakeFrames);

            // Hit particles
            const knockAngle = Math.atan2(hit.knockback.y, hit.knockback.x);
            particleSystem.emit({
              x: hit.hitPosition.x,
              y: hit.hitPosition.y,
              count: 10,
              speedMin: 80,
              speedMax: 200,
              angleMin: knockAngle - 0.8,
              angleMax: knockAngle + 0.8,
              lifeMin: 0.15,
              lifeMax: 0.4,
              sizeMin: 2,
              sizeMax: 5,
              colors: ["#1e1b4b", "#4338ca", "#e0e7ff", "#ffffff"],
              gravity: 200,
            });

            // Floating damage number
            floatingNumbers.push({
              text: String(hit.damage),
              x: hit.hitPosition.x,
              y: hit.hitPosition.y,
              vy: FLOAT_SPEED,
              alpha: 1,
              timer: FLOAT_DURATION,
              maxTimer: FLOAT_DURATION,
            });
          }
        }
      }

      // Update dummy
      dummy.update(dt);

      // Update player health
      playerHealth.update();

      // Update particles
      particleSystem.update(dt);

      // Update screen shake and apply offset to camera for this frame.
      // camera.follow() next frame will converge back toward the target.
      const shakeOffset = screenShake.update();
      const camera = engine.getCamera();
      camera.position.x += shakeOffset.offsetX;
      camera.position.y += shakeOffset.offsetY;

      // Update floating numbers
      for (let i = floatingNumbers.length - 1; i >= 0; i--) {
        const fn = floatingNumbers[i];
        fn.y += fn.vy * dt;
        fn.timer -= dt;
        fn.alpha = Math.max(0, fn.timer / fn.maxTimer);
        if (fn.timer <= 0) {
          floatingNumbers.splice(i, 1);
        }
      }
    });

    // ─── Render Callback ──────────────────────────────────────

    engine.onRender((renderer, interpolation) => {
      const rCtx = renderer.getContext();

      if (modeRef.current === "deck") {
        // ─── Deck Mode Render ──────────────────────────────
        rCtx.fillStyle = "#0a0a0f";
        rCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        const deck = cardEngine.getDeck();
        const collection = deck.collection;
        const equippedSet = new Set(deck.equippedIds);
        const ui = deckUIRef.current;
        const recipes = crafting.getAvailableCrafts(collection);

        // Deck bar
        CardRenderer.renderDeckBar(rCtx, deck, DECK_BAR_X, DECK_BAR_Y, -1);

        // Collection grid
        CardRenderer.renderCollectionGrid(
          rCtx,
          collection,
          GRID_X,
          GRID_Y,
          GRID_WIDTH,
          GRID_HEIGHT,
          ui.collectionScrollOffset,
          ui.activePanel === "collection" ? ui.selectedCollectionIndex : -1,
          equippedSet,
        );

        // Crafting panel
        CardRenderer.renderCraftingPanel(
          rCtx,
          recipes,
          collection,
          CRAFT_X,
          CRAFT_Y,
          CRAFT_WIDTH,
          CRAFT_HEIGHT,
          ui.activePanel === "crafting" ? ui.selectedRecipeIndex : -1,
        );

        // Stat preview
        const summary = cardEngine.getModifierSummary(
          basePlayerParams,
          baseCombatParams,
          baseHealthParams,
        );
        CardRenderer.renderStatComparison(
          rCtx,
          summary,
          STAT_X,
          STAT_Y,
          STAT_WIDTH,
        );

        // Tooltip for selected card
        if (
          ui.activePanel === "collection" &&
          ui.selectedCollectionIndex >= 0 &&
          ui.selectedCollectionIndex < collection.length
        ) {
          const card = collection[ui.selectedCollectionIndex];
          const col = ui.selectedCollectionIndex % GRID_COLS;
          const row = Math.floor(ui.selectedCollectionIndex / GRID_COLS);
          const tooltipX =
            GRID_X + 6 + col * GRID_CELL_W + CARD_RENDER_WIDTH + 8;
          const tooltipY =
            GRID_Y + 6 + row * GRID_CELL_H - ui.collectionScrollOffset;
          CardRenderer.renderTooltip(rCtx, card, tooltipX, tooltipY, 200);
        }

        // Controls hint
        rCtx.fillStyle = "#6b7280";
        rCtx.font = "10px monospace";
        rCtx.textAlign = "left";
        rCtx.fillText(
          "[Tab] Play Mode  [Arrows] Navigate  [Enter] Equip/Unequip  [C] Craft  [Q] Switch Panel",
          20,
          CANVAS_HEIGHT - 10,
        );

        return;
      }

      // ─── Play Mode Render ──────────────────────────────────

      // Draw tilemap
      tileMap.render(renderer);

      // Draw dummy
      dummy.render(renderer, interpolation);

      // Combat visuals
      const camera = engine.getCamera();
      combat.render(rCtx, camera);

      // Render particles
      particleSystem.render(renderer);

      // Floating damage numbers
      for (const fn of floatingNumbers) {
        rCtx.globalAlpha = fn.alpha;
        rCtx.fillStyle = "#ffffff";
        rCtx.font = "bold 14px monospace";
        rCtx.textAlign = "center";
        rCtx.fillText(fn.text, fn.x, fn.y);
        rCtx.textAlign = "left";
      }
      rCtx.globalAlpha = 1;

      if (!showOverlaysRef.current) return;

      const pos = player.getInterpolatedPosition(interpolation);
      const state = player.stateMachine.getCurrentState();

      // Player hitbox
      renderer.strokeRect(
        pos.x,
        pos.y,
        player.size.x,
        player.size.y,
        COLORS.debug.hitbox,
        1,
      );

      // Velocity vector
      const cx = pos.x + player.size.x / 2;
      const cy = pos.y + player.size.y / 2;
      const vScale = 0.15;
      const vx = player.velocity.x * vScale;
      const vy = player.velocity.y * vScale;
      if (Math.abs(vx) > 1 || Math.abs(vy) > 1) {
        renderer.drawLine(
          cx,
          cy,
          cx + vx,
          cy + vy,
          COLORS.debug.velocity,
          2,
        );
      }

      // State label
      renderer.drawText(state, pos.x, pos.y - 8, COLORS.debug.stateLabel, 10);

      // Ground contact
      if (player.grounded) {
        renderer.drawCircle(
          pos.x + player.size.x / 2,
          pos.y + player.size.y + 3,
          3,
          COLORS.debug.ground,
        );
      }

      // Combat debug overlays
      combat.renderDebug(rCtx, player.getBounds());

      // Dummy debug
      dummy.renderDebug(rCtx);
    });

    // ─── Screen-Space Debug Layer ────────────────────────────

    const debugLayerCallback = (debugCtx: CanvasRenderingContext2D) => {
      if (modeRef.current === "deck") return;

      // Health HUD
      playerHealth.renderHUD(debugCtx, CANVAS_WIDTH);

      // Equipped deck bar (play mode, top of screen)
      const deck = cardEngine.getDeck();
      if (deck.equippedIds.length > 0) {
        // Mini deck display
        const barX = 8;
        const barY = 36;
        const miniW = 32;
        const miniH = 44;
        const gap = 4;

        for (let i = 0; i < deck.maxEquipped; i++) {
          const eqId = deck.equippedIds[i];
          const card = eqId
            ? deck.collection.find((c) => c.id === eqId)
            : undefined;
          const sx = barX + i * (miniW + gap);

          if (card) {
            CardRenderer.renderCard(debugCtx, card, {
              x: sx,
              y: barY,
              width: miniW,
              height: miniH,
              selected: false,
              equipped: false,
              highlighted: false,
              dimmed: false,
            });
          } else {
            debugCtx.strokeStyle = "#374151";
            debugCtx.lineWidth = 1;
            debugCtx.setLineDash([2, 2]);
            debugCtx.strokeRect(sx, barY, miniW, miniH);
            debugCtx.setLineDash([]);
          }
        }

        // Active buffs summary
        const summary = cardEngine.getModifierSummary(
          basePlayerParams,
          baseCombatParams,
          baseHealthParams,
        );
        if (summary.length > 0) {
          debugCtx.fillStyle = "#9ca3af";
          debugCtx.font = "9px monospace";
          debugCtx.textAlign = "left";
          const buffStr = summary
            .slice(0, 4)
            .map((s) => `${s.change} ${s.displayName}`)
            .join("  ");
          debugCtx.fillText(buffStr, barX, barY + miniH + 12);
        }
      }

      if (!showOverlaysRef.current) return;

      const metrics = engine.getMetrics();

      // FPS
      debugCtx.fillStyle = COLORS.debug.ground;
      debugCtx.font = "12px monospace";
      debugCtx.textAlign = "right";
      debugCtx.fillText(
        `FPS: ${Math.round(metrics.fps)}`,
        CANVAS_WIDTH - 8,
        16,
      );
      debugCtx.textAlign = "left";

      // Velocity readout
      debugCtx.fillStyle = COLORS.debug.velocity;
      debugCtx.textAlign = "right";
      debugCtx.fillText(
        `VelX: ${Math.round(player.velocity.x)}`,
        CANVAS_WIDTH - 8,
        32,
      );
      debugCtx.fillText(
        `VelY: ${Math.round(player.velocity.y)}`,
        CANVAS_WIDTH - 8,
        48,
      );
      debugCtx.textAlign = "left";

      // Mode hint
      debugCtx.fillStyle = "#6b7280";
      debugCtx.font = "10px monospace";
      debugCtx.fillText("[Tab] Open Deck", 8, CANVAS_HEIGHT - 8);

      // Target dummy HP
      if (dummy.isAlive) {
        debugCtx.fillStyle = "#ef4444";
        debugCtx.font = "10px monospace";
        debugCtx.textAlign = "right";
        debugCtx.fillText(
          `Target: ${dummy.health}/${dummy.maxHealth} HP`,
          CANVAS_WIDTH - 8,
          CANVAS_HEIGHT - 8,
        );
        debugCtx.textAlign = "left";
      }
    };
    engine.getRenderer().addLayerCallback("debug", debugLayerCallback);

    engine.start();

    // Store cleanup function
    (engine as unknown as Record<string, unknown>).__cleanup = () => {
      window.removeEventListener("keydown", handleDeckKeys);
      window.removeEventListener("keydown", handlePlayKeys);
      canvas.removeEventListener("click", handleClick);
    };
  }, []);

  const handleUnmount = useCallback(() => {
    const engine = engineRef.current;
    if (engine) {
      const cleanup = (engine as unknown as Record<string, () => void>)
        .__cleanup;
      if (cleanup) cleanup();
      engine.stop();
    }
    engineRef.current = null;
    playerRef.current = null;
    combatRef.current = null;
    playerHealthRef.current = null;
    dummyRef.current = null;
    cardEngineRef.current = null;
    craftingRef.current = null;
  }, []);

  const toggleOverlays = useCallback(() => {
    setShowOverlays((prev) => {
      const next = !prev;
      const engine = engineRef.current as EngineWithRefs | null;
      if (engine?.__showOverlaysRef) engine.__showOverlaysRef.current = next;
      return next;
    });
  }, []);

  // ─── Get stats for debug panel ────────────────────────────

  const cardEngine = cardEngineRef.current;
  const equippedCount = cardEngine?.deck.equippedIds.length ?? 0;
  const collectionCount = cardEngine?.deck.collection.length ?? 0;
  const availableCrafts = craftingRef.current
    ? craftingRef.current.getAvailableCrafts(
        cardEngine?.deck.collection ?? [],
      ).length
    : 0;

  const modifierSummary: ModifierSummaryEntry[] = cardEngine
    ? cardEngine.getModifierSummary(
        DEFAULT_PLAYER_PARAMS,
        DEFAULT_COMBAT_PARAMS,
        DEFAULT_PLAYER_HEALTH_PARAMS,
      )
    : [];

  // ─── Render ───────────────────────────────────────────────────

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
          Ink Cards
        </h1>
        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-mono text-amber-400">
          Phase 4 — World Systems
        </span>
        <span
          className={`rounded px-2 py-0.5 text-xs font-mono ${
            mode === "deck"
              ? "bg-indigo-500/20 text-indigo-400"
              : "bg-green-500/20 text-green-400"
          }`}
        >
          {mode === "deck" ? "Deck Mode" : "Play Mode"}
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
            Deck mode shows cards &middot; Category-colored borders &middot;
            Tier dots &middot; Tooltip on select &middot; Enter equips/unequips
            &middot; Max 4 equipped &middot; Stat preview shows before/after
            &middot; Crafting 2× same → next tier &middot; Swiftness cards
            increase speed &middot; Might cards increase damage &middot;
            Resilience cards increase health &middot; Diminishing returns
            visible &middot; Stat caps enforced &middot; All params tunable
          </div>

          {/* Controls */}
          <div className="w-[960px] text-xs font-mono text-zinc-600 leading-relaxed">
            <span className="text-zinc-500">Controls: </span>
            Tab = Toggle Deck/Play &middot; Arrows = Move/Navigate &middot;
            Z/Space = Jump &middot; X/Shift = Dash &middot; J/Enter =
            Attack/Equip &middot; K = Switch Weapon &middot; C = Craft &middot;
            Q = Switch Panel &middot; ` = Debug
          </div>
        </div>

        {/* Debug panel */}
        <DebugPanel title="Ink Cards">
          <RenderModeToggle />
          {/* Deck Info (always visible) */}
          <div className="border-b border-zinc-800 pb-2 mb-2">
            <div className="text-xs font-mono text-amber-400 uppercase tracking-wider mb-1">
              Deck Info
            </div>
            <div className="text-xs font-mono text-zinc-400 space-y-0.5">
              <div>
                Mode:{" "}
                <span className="text-zinc-200">
                  {mode === "deck" ? "Deck" : "Play"}
                </span>
              </div>
              <div>
                Equipped:{" "}
                <span className="text-zinc-200">
                  {equippedCount} / {engineParams.maxEquipped}
                </span>
              </div>
              <div>
                Collection:{" "}
                <span className="text-zinc-200">{collectionCount} cards</span>
              </div>
              <div>
                Crafts:{" "}
                <span className="text-zinc-200">
                  {availableCrafts} recipes
                </span>
              </div>
            </div>
          </div>

          {/* Active Modifiers */}
          {modifierSummary.length > 0 && (
            <div className="border-b border-zinc-800 pb-2 mb-2">
              <div className="text-xs font-mono text-amber-400/80 uppercase tracking-wider mb-1">
                Active Modifiers
              </div>
              <div className="text-xs font-mono space-y-0.5">
                {modifierSummary.map((entry) => {
                  const diff = entry.modifiedValue - entry.baseValue;
                  const color =
                    diff > 0
                      ? "text-green-400"
                      : diff < 0
                        ? "text-red-400"
                        : "text-zinc-400";
                  return (
                    <div key={entry.stat} className={color}>
                      {entry.displayName}:{" "}
                      {entry.change.startsWith("×")
                        ? entry.change
                        : `${Math.round(entry.baseValue)} → ${Math.round(entry.modifiedValue)} (${entry.change})`}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Card Engine Params */}
          <details open>
            <summary className="text-xs font-mono text-amber-400/80 uppercase tracking-wider cursor-pointer select-none">
              Card Engine Params
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <Slider
                label="Max Equipped"
                value={engineParams.maxEquipped}
                min={1}
                max={8}
                step={1}
                onChange={(v) => updateCardEngineParam("maxEquipped", v)}
              />
              <label className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                <input
                  type="checkbox"
                  checked={engineParams.allowDuplicates}
                  onChange={(e) =>
                    updateCardEngineParam("allowDuplicates", e.target.checked)
                  }
                  className="accent-amber-500"
                />
                Allow Duplicates
              </label>
              <label className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                <input
                  type="checkbox"
                  checked={engineParams.diminishingReturns}
                  onChange={(e) =>
                    updateCardEngineParam(
                      "diminishingReturns",
                      e.target.checked,
                    )
                  }
                  className="accent-amber-500"
                />
                Diminishing Returns
              </label>
              <Slider
                label="Diminishing Factor"
                value={engineParams.diminishingFactor}
                min={0.3}
                max={1.0}
                step={0.05}
                onChange={(v) => updateCardEngineParam("diminishingFactor", v)}
              />
            </div>
          </details>

          {/* Stat Caps */}
          <details>
            <summary className="text-xs font-mono text-zinc-500 uppercase tracking-wider cursor-pointer select-none pt-2">
              Stat Caps
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <Slider
                label="Max Run Speed Cap"
                value={engineParams.statCaps.maxRunSpeed?.max ?? 500}
                min={300}
                max={800}
                step={25}
                onChange={(v) => updateStatCap("maxRunSpeed", "max", v)}
              />
              <Slider
                label="Jump Speed Cap"
                value={engineParams.statCaps.jumpSpeed?.max ?? 600}
                min={400}
                max={800}
                step={25}
                onChange={(v) => updateStatCap("jumpSpeed", "max", v)}
              />
              <Slider
                label="Dash Speed Cap"
                value={engineParams.statCaps.dashSpeed?.max ?? 900}
                min={600}
                max={1200}
                step={50}
                onChange={(v) => updateStatCap("dashSpeed", "max", v)}
              />
              <Slider
                label="Max Health Cap"
                value={engineParams.statCaps.maxHealth?.max ?? 10}
                min={5}
                max={20}
                step={1}
                onChange={(v) => updateStatCap("maxHealth", "max", v)}
              />
            </div>
          </details>

          {/* Collection Manager */}
          <details>
            <summary className="text-xs font-mono text-zinc-500 uppercase tracking-wider cursor-pointer select-none pt-2">
              Collection Manager
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <button
                onClick={addRandomCard}
                className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700"
              >
                Add Random Card
              </button>
              <button
                onClick={addAllTier1}
                className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700"
              >
                Add All Tier 1s
              </button>
              <button
                onClick={clearCollection}
                className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700"
              >
                Clear Collection
              </button>
              <button
                onClick={resetCollection}
                className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700"
              >
                Reset to Starting Deck
              </button>
            </div>
          </details>

          {/* Controls */}
          <div className="border-t border-zinc-800 pt-2 mt-2 flex flex-col gap-2">
            <button
              onClick={toggleOverlays}
              className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700"
            >
              {showOverlays ? "Hide" : "Show"} Overlays
            </button>
            <button
              onClick={() => {
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
                  player.canCoyoteJump = false;
                  player.wallSide = 0;
                  player.wallJumpLockoutTimer = 0;
                }
                combatRef.current?.reset();
                const ph = playerHealthRef.current;
                if (ph) ph.reset();
                dummyRef.current?.resetFull();
              }}
              className="rounded bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-700"
            >
              Reset Player
            </button>
          </div>
        </DebugPanel>
      </div>
    </div>
  );
}
