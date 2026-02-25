"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSaveSlots } from "@/hooks/useSaveSlots";
import { SaveSlotSelect } from "@/components/SaveSlotSelect";
import { NameEntry } from "@/components/NameEntry";

// ─── Constants ──────────────────────────────────────────────────────

const PARTICLE_COUNT = 50;
const PARTICLE_MIN_SPEED = -30;
const PARTICLE_MAX_SPEED = -15;
const PARTICLE_MIN_SIZE = 2;
const PARTICLE_MAX_SIZE = 6;
const PARTICLE_MIN_ALPHA = 0.1;
const PARTICLE_MAX_ALPHA = 0.3;

// ─── Types ──────────────────────────────────────────────────────────

interface InkDrop {
  x: number;
  y: number;
  vy: number;
  size: number;
  alpha: number;
  baseAlpha: number;
}

type MenuScreen = "main" | "slot-select" | "name-entry";

// ─── Ink Wash Background ────────────────────────────────────────────

function InkWashBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let grainCanvas: HTMLCanvasElement | null = null;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      // Rebuild grain texture at new size
      grainCanvas = document.createElement("canvas");
      grainCanvas.width = canvas.width;
      grainCanvas.height = canvas.height;
      const gCtx = grainCanvas.getContext("2d");
      if (gCtx) {
        gCtx.fillStyle = "rgba(255, 255, 255, 0.008)";
        for (let gx = 0; gx < grainCanvas.width; gx += 4) {
          for (let gy = 0; gy < grainCanvas.height; gy += 4) {
            if (Math.random() > 0.5) {
              gCtx.fillRect(gx, gy, 2, 2);
            }
          }
        }
      }
    };
    resize();
    window.addEventListener("resize", resize);

    const drops: InkDrop[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      drops.push(createDrop(canvas.width, canvas.height, true));
    }

    let animId: number;
    let lastTime = performance.now();
    const c = canvas;
    const cx = ctx;

    function animate(now: number) {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      cx.clearRect(0, 0, c.width, c.height);

      const cycle = Math.sin(now * 0.0003) * 0.5 + 0.5;
      const r = Math.floor(10 + cycle * 8);
      const g = Math.floor(10 + cycle * 4);
      const b = Math.floor(10 + cycle * 16);
      cx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      cx.fillRect(0, 0, c.width, c.height);

      for (let i = 0; i < drops.length; i++) {
        const drop = drops[i];
        drop.y += drop.vy * dt;
        drop.x += Math.sin(now * 0.001 + i) * 0.2;
        drop.alpha =
          drop.baseAlpha * (0.7 + 0.3 * Math.sin(now * 0.002 + i * 0.5));

        if (drop.y < -drop.size * 2) {
          Object.assign(drop, createDrop(c.width, c.height, false));
          drop.y = c.height + drop.size;
        }

        cx.beginPath();
        cx.arc(drop.x, drop.y, drop.size, 0, Math.PI * 2);
        cx.fillStyle = `rgba(100, 100, 140, ${drop.alpha})`;
        cx.fill();
      }

      if (grainCanvas) {
        cx.drawImage(grainCanvas, 0, 0);
      }

      animId = requestAnimationFrame(animate);
    }
    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 h-full w-full" />;
}

function createDrop(
  canvasWidth: number,
  canvasHeight: number,
  randomY: boolean
): InkDrop {
  const baseAlpha =
    PARTICLE_MIN_ALPHA +
    Math.random() * (PARTICLE_MAX_ALPHA - PARTICLE_MIN_ALPHA);
  return {
    x: Math.random() * canvasWidth,
    y: randomY
      ? Math.random() * canvasHeight
      : canvasHeight + Math.random() * 20,
    vy:
      PARTICLE_MIN_SPEED +
      Math.random() * (PARTICLE_MAX_SPEED - PARTICLE_MIN_SPEED),
    size:
      PARTICLE_MIN_SIZE +
      Math.random() * (PARTICLE_MAX_SIZE - PARTICLE_MIN_SIZE),
    alpha: baseAlpha,
    baseAlpha,
  };
}

// ─── Menu Button (sprite background with text fallback) ─────────────

function MenuButton({
  label,
  selected,
  onClick,
  onMouseEnter,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  const [bgLoaded, setBgLoaded] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`relative font-mono text-xl transition-colors ${
        selected ? "text-white" : "text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {/* Probe for menu button background asset */}
      {!bgLoaded && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/assets/ui-menu-button.png"
          alt=""
          className="hidden"
          onLoad={() => setBgLoaded(true)}
          onError={() => setBgLoaded(false)}
        />
      )}
      {bgLoaded && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/assets/ui-menu-button.png"
          alt=""
          className="absolute inset-0 h-full w-full object-contain opacity-60"
          onError={() => setBgLoaded(false)}
        />
      )}
      <span className="relative">
        {selected ? `\u25B8 ${label}` : `  ${label}`}
      </span>
    </button>
  );
}

// ─── Title Logo (sprite with text fallback) ─────────────────────────

function TitleLogo() {
  const [logoLoaded, setLogoLoaded] = useState(false);

  return logoLoaded ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/assets/ui-title-logo.png"
      alt="INKBINDERS"
      width={480}
      height={120}
      onError={() => setLogoLoaded(false)}
    />
  ) : (
    <>
      {/* Hidden probe image to detect if the asset exists */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/ui-title-logo.png"
        alt=""
        className="hidden"
        onLoad={() => setLogoLoaded(true)}
        onError={() => setLogoLoaded(false)}
      />
      <h1 className="font-mono text-4xl font-bold tracking-[0.25em] text-amber-200">
        INKBINDERS
      </h1>
    </>
  );
}

// ─── Main Menu ──────────────────────────────────────────────────────

const MENU_ITEMS_BASE = ["New Game", "Test Pages"] as const;

export default function Home() {
  const router = useRouter();
  const { slots, isLoading, save, deleteSave, getMostRecentSlot, load } =
    useSaveSlots();

  const [screen, setScreen] = useState<MenuScreen>("main");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [slotForNewGame, setSlotForNewGame] = useState<number | null>(null);

  // Determine if Continue should be shown
  const mostRecent = getMostRecentSlot();
  const hasSaves = mostRecent !== null;
  const menuItems = hasSaves
    ? (["Continue", ...MENU_ITEMS_BASE] as string[])
    : ([...MENU_ITEMS_BASE] as string[]);

  // Clamp selectedIndex if menu items changed
  useEffect(() => {
    if (selectedIndex >= menuItems.length) {
      setSelectedIndex(Math.max(0, menuItems.length - 1));
    }
  }, [menuItems.length, selectedIndex]);

  const handleMenuSelect = useCallback(
    (item: string) => {
      switch (item) {
        case "Continue": {
          if (mostRecent) {
            router.push(`/play?slot=${mostRecent.slot}`);
          }
          break;
        }
        case "New Game":
          setScreen("slot-select");
          break;
        case "Test Pages":
          router.push("/test");
          break;
      }
    },
    [mostRecent, router]
  );

  // Refs for stable keyboard handler closure
  const menuItemsRef = useRef(menuItems);
  menuItemsRef.current = menuItems;
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;
  const handleMenuSelectRef = useRef(handleMenuSelect);
  handleMenuSelectRef.current = handleMenuSelect;

  // Keyboard navigation on the main menu
  useEffect(() => {
    if (screen !== "main") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "w") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === "ArrowDown" || e.key === "s") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          Math.min(menuItemsRef.current.length - 1, prev + 1)
        );
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleMenuSelectRef.current(
          menuItemsRef.current[selectedIndexRef.current]
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [screen]);

  const handleSlotSelect = useCallback(
    async (action: "load" | "new", slot: number) => {
      if (action === "load") {
        router.push(`/play?slot=${slot}`);
      } else {
        setSlotForNewGame(slot);
        setScreen("name-entry");
      }
    },
    [router]
  );

  const handleSlotDelete = useCallback(
    async (slot: number) => {
      await deleteSave(slot);
    },
    [deleteSave]
  );

  const handleNameConfirm = useCallback(
    async (name: string) => {
      if (slotForNewGame === null) return;

      // Create a minimal initial save so the slot isn't empty
      const { SaveSystem } = await import("@/engine/save/SaveSystem");
      const snapshot = SaveSystem.createSnapshot({
        slot: slotForNewGame,
        playerName: name,
        totalPlayTime: 0,
        currentRoomId: "tutorial-corridor",
        currentRoomName: "Tutorial Corridor",
        deathCount: 0,
        unlockedAbilities: [],
        openedGates: [],
        defeatedBosses: [],
        visitedRooms: ["tutorial-corridor"],
        currentHealth: 5,
        maxHealth: 5,
        ownedCards: [],
        equippedCards: [],
      });
      await save(slotForNewGame, snapshot);
      router.push(`/play?slot=${slotForNewGame}&new=1`);
    },
    [slotForNewGame, save, router]
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="animate-pulse font-mono text-zinc-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950">
      <InkWashBackground />

      {/* Main menu overlay */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center">
        <main className="flex flex-col items-center gap-6 px-8 text-center">
          {/* Title */}
          <TitleLogo />
          <p className="font-mono text-lg italic text-zinc-500">
            The Library That Fights Back
          </p>

          {/* Menu */}
          <nav className="mt-8 flex flex-col items-center gap-3">
            {menuItems.map((item, i) => (
              <MenuButton
                key={item}
                label={item}
                selected={selectedIndex === i}
                onClick={() => handleMenuSelect(item)}
                onMouseEnter={() => setSelectedIndex(i)}
              />
            ))}
          </nav>
        </main>

        {/* Footer */}
        <div className="absolute bottom-6 font-mono text-sm text-zinc-700">
          &copy; 2026 — Hand-inked with care
        </div>
      </div>

      {/* Overlays */}
      {screen === "slot-select" && (
        <SaveSlotSelect
          slots={slots}
          mode="new-game"
          onSelect={handleSlotSelect}
          onDelete={handleSlotDelete}
          onBack={() => setScreen("main")}
        />
      )}

      {screen === "name-entry" && (
        <NameEntry
          onConfirm={handleNameConfirm}
          onBack={() => setScreen("slot-select")}
        />
      )}
    </div>
  );
}
