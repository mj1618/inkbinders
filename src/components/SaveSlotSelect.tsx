"use client";

import { useState } from "react";
import { SaveSystem, type SaveSlotSummary } from "@/engine/save/SaveSystem";

// ─── Types ──────────────────────────────────────────────────────────

interface SaveSlotSelectProps {
  slots: SaveSlotSummary[];
  mode: "new-game" | "load";
  onSelect: (action: "load" | "new", slot: number) => void;
  onDelete: (slot: number) => void;
  onBack: () => void;
}

// ─── Component ──────────────────────────────────────────────────────

export function SaveSlotSelect({
  slots,
  mode,
  onSelect,
  onDelete,
  onBack,
}: SaveSlotSelectProps) {
  const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null);
  const [confirmingOverwrite, setConfirmingOverwrite] = useState<number | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
      <div className="w-full max-w-lg space-y-4 px-4">
        <h2 className="text-center font-mono text-2xl font-bold tracking-wide text-zinc-100">
          Select Save Slot
        </h2>

        {slots.map((slot) => (
          <div
            key={slot.slot}
            className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-zinc-600"
          >
            {slot.isEmpty ? (
              <EmptySlotCard
                slot={slot.slot}
                onNewGame={() => onSelect("new", slot.slot)}
              />
            ) : (
              <FilledSlotCard
                slot={slot}
                mode={mode}
                confirmingDelete={confirmingDelete === slot.slot}
                confirmingOverwrite={confirmingOverwrite === slot.slot}
                onLoad={() => onSelect("load", slot.slot)}
                onOverwrite={() => {
                  if (confirmingOverwrite === slot.slot) {
                    setConfirmingOverwrite(null);
                    onSelect("new", slot.slot);
                  } else {
                    setConfirmingOverwrite(slot.slot);
                    setConfirmingDelete(null);
                  }
                }}
                onDelete={() => {
                  if (confirmingDelete === slot.slot) {
                    setConfirmingDelete(null);
                    onDelete(slot.slot);
                  } else {
                    setConfirmingDelete(slot.slot);
                    setConfirmingOverwrite(null);
                  }
                }}
                onCancelConfirm={() => {
                  setConfirmingDelete(null);
                  setConfirmingOverwrite(null);
                }}
              />
            )}
          </div>
        ))}

        <div className="flex justify-center pt-2">
          <button
            onClick={onBack}
            className="font-mono text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function EmptySlotCard({
  slot,
  onNewGame,
}: {
  slot: number;
  onNewGame: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="font-mono text-sm text-zinc-500">
          Slot {slot} — Empty
        </span>
      </div>
      <button
        onClick={onNewGame}
        className="rounded border border-amber-700/50 px-3 py-1 font-mono text-sm text-amber-400 transition-colors hover:border-amber-500 hover:text-amber-300"
      >
        New Game
      </button>
    </div>
  );
}

function FilledSlotCard({
  slot,
  mode,
  confirmingDelete,
  confirmingOverwrite,
  onLoad,
  onOverwrite,
  onDelete,
  onCancelConfirm,
}: {
  slot: SaveSlotSummary;
  mode: "new-game" | "load";
  confirmingDelete: boolean;
  confirmingOverwrite: boolean;
  onLoad: () => void;
  onOverwrite: () => void;
  onDelete: () => void;
  onCancelConfirm: () => void;
}) {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-sm font-bold text-zinc-200">
          Slot {slot.slot} — &quot;{slot.playerName}&quot;
        </span>
        <span className="font-mono text-xs text-zinc-600">
          {slot.lastSaved ? SaveSystem.formatRelativeTime(slot.lastSaved) : ""}
        </span>
      </div>

      {/* Info line */}
      <div className="font-mono text-xs text-zinc-500">
        {slot.currentRoomName || slot.currentRoomId} · {slot.completionPercent}%
        · {SaveSystem.formatPlayTime(slot.totalPlayTime)} ·{" "}
        {slot.deathCount} death{slot.deathCount !== 1 ? "s" : ""}
      </div>

      {/* Confirmation dialogs */}
      {confirmingDelete && (
        <div className="rounded border border-red-900/50 bg-red-950/30 p-2">
          <p className="font-mono text-xs text-red-400">
            Are you sure? This cannot be undone.
          </p>
          <div className="mt-1 flex gap-2">
            <button
              onClick={onDelete}
              className="rounded bg-red-800 px-2 py-0.5 font-mono text-xs text-red-100 hover:bg-red-700"
            >
              Confirm
            </button>
            <button
              onClick={onCancelConfirm}
              className="font-mono text-xs text-zinc-500 hover:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {confirmingOverwrite && (
        <div className="rounded border border-amber-900/50 bg-amber-950/30 p-2">
          <p className="font-mono text-xs text-amber-400">
            Overwrite existing save?
          </p>
          <div className="mt-1 flex gap-2">
            <button
              onClick={onOverwrite}
              className="rounded bg-amber-800 px-2 py-0.5 font-mono text-xs text-amber-100 hover:bg-amber-700"
            >
              Confirm
            </button>
            <button
              onClick={onCancelConfirm}
              className="font-mono text-xs text-zinc-500 hover:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!confirmingDelete && !confirmingOverwrite && (
        <div className="flex gap-2">
          <button
            onClick={onLoad}
            className="rounded border border-green-700/50 px-3 py-1 font-mono text-xs text-green-400 transition-colors hover:border-green-500 hover:text-green-300"
          >
            Load
          </button>
          {mode === "new-game" && (
            <button
              onClick={onOverwrite}
              className="rounded border border-amber-700/50 px-3 py-1 font-mono text-xs text-amber-400 transition-colors hover:border-amber-500 hover:text-amber-300"
            >
              Overwrite
            </button>
          )}
          <button
            onClick={onDelete}
            className="rounded border border-red-700/50 px-3 py-1 font-mono text-xs text-red-400 transition-colors hover:border-red-500 hover:text-red-300"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
