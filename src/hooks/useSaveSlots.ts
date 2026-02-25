"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { SaveSystem, type GameSaveData, type LoadedGameState, type SaveSlotSummary } from "@/engine/save/SaveSystem";

// ─── Constants ──────────────────────────────────────────────────────

const STORAGE_SLOTS_KEY = "inkbinders-saves";
const STORAGE_PROGRESSION_KEY = "inkbinders-progression";

// ─── Types ──────────────────────────────────────────────────────────

export interface UseSaveSlotsResult {
  slots: SaveSlotSummary[];
  isConnected: boolean;
  isLoading: boolean;
  save: (slot: number, data: GameSaveData) => Promise<void>;
  load: (slot: number) => Promise<LoadedGameState | null>;
  deleteSave: (slot: number) => Promise<void>;
  getMostRecentSlot: () => SaveSlotSummary | null;
  refresh: () => void;
}

// ─── localStorage Helpers ───────────────────────────────────────────

function emptySlots(): SaveSlotSummary[] {
  return [1, 2, 3].map((s) => SaveSystem.emptySummary(s));
}

function loadSlotsFromStorage(): SaveSlotSummary[] {
  if (typeof window === "undefined") return emptySlots();
  try {
    const stored = localStorage.getItem(STORAGE_SLOTS_KEY);
    if (!stored) return emptySlots();
    return JSON.parse(stored) as SaveSlotSummary[];
  } catch {
    return emptySlots();
  }
}

function saveSlotsToStorage(slots: SaveSlotSummary[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_SLOTS_KEY, JSON.stringify(slots));
}

function loadProgressionFromStorage(slot: number): LoadedGameState | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(`${STORAGE_PROGRESSION_KEY}-${slot}`);
    if (!stored) return null;
    return JSON.parse(stored) as LoadedGameState;
  } catch {
    return null;
  }
}

function saveProgressionToStorage(slot: number, data: GameSaveData): void {
  if (typeof window === "undefined") return;
  const loaded: LoadedGameState = {
    slot: data.slot,
    playerName: data.playerName,
    totalPlayTime: data.totalPlayTime,
    currentRoomId: data.currentRoomId,
    currentRoomName: data.currentRoomName,
    completionPercent: data.completionPercent,
    deathCount: data.deathCount,
    lastSaved: new Date().toISOString(),
    unlockedAbilities: data.unlockedAbilities,
    openedGates: data.openedGates,
    defeatedBosses: data.defeatedBosses,
    visitedRooms: data.visitedRooms,
    currentHealth: data.currentHealth,
    maxHealth: data.maxHealth,
    ownedCards: data.ownedCards,
    equippedCards: data.equippedCards,
  };
  localStorage.setItem(
    `${STORAGE_PROGRESSION_KEY}-${slot}`,
    JSON.stringify(loaded)
  );
}

function deleteProgressionFromStorage(slot: number): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${STORAGE_PROGRESSION_KEY}-${slot}`);
}

// ─── Hook ───────────────────────────────────────────────────────────

export function useSaveSlots(): UseSaveSlotsResult {
  const [slots, setSlots] = useState<SaveSlotSummary[]>(emptySlots);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  // Load from localStorage on mount
  useEffect(() => {
    mountedRef.current = true;
    const loaded = loadSlotsFromStorage();
    setSlots(loaded);
    setIsLoading(false);
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(() => {
    const loaded = loadSlotsFromStorage();
    setSlots(loaded);
  }, []);

  const save = useCallback(async (slot: number, data: GameSaveData) => {
    // Save progression data
    saveProgressionToStorage(slot, data);

    // Update slot summary
    const current = loadSlotsFromStorage();
    const idx = current.findIndex((s) => s.slot === slot);
    if (idx !== -1) {
      current[idx] = {
        slot: data.slot,
        playerName: data.playerName,
        lastSaved: new Date().toISOString(),
        totalPlayTime: data.totalPlayTime,
        currentRoomId: data.currentRoomId,
        currentRoomName: data.currentRoomName,
        completionPercent: data.completionPercent,
        deathCount: data.deathCount,
        isEmpty: false,
      };
    }
    saveSlotsToStorage(current);
    if (mountedRef.current) {
      setSlots([...current]);
    }
  }, []);

  const load = useCallback(async (slot: number): Promise<LoadedGameState | null> => {
    return loadProgressionFromStorage(slot);
  }, []);

  const deleteSave = useCallback(async (slot: number) => {
    deleteProgressionFromStorage(slot);
    const current = loadSlotsFromStorage();
    const idx = current.findIndex((s) => s.slot === slot);
    if (idx !== -1) {
      current[idx] = SaveSystem.emptySummary(slot);
    }
    saveSlotsToStorage(current);
    if (mountedRef.current) {
      setSlots([...current]);
    }
  }, []);

  const getMostRecentSlot = useCallback((): SaveSlotSummary | null => {
    const nonEmpty = slots.filter((s) => !s.isEmpty);
    if (nonEmpty.length === 0) return null;
    return nonEmpty.reduce((best, s) => {
      if (!best.lastSaved) return s;
      if (!s.lastSaved) return best;
      return new Date(s.lastSaved).getTime() > new Date(best.lastSaved).getTime()
        ? s
        : best;
    });
  }, [slots]);

  return {
    slots,
    isConnected: false, // Using localStorage mock — Convex not deployed
    isLoading,
    save,
    load,
    deleteSave,
    getMostRecentSlot,
    refresh,
  };
}
