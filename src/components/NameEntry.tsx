"use client";

import { useState, useRef, useEffect } from "react";

// ─── Constants ──────────────────────────────────────────────────────

const DEFAULT_NAME = "Archivist";
const MAX_NAME_LENGTH = 20;
const VALID_CHARS = /^[a-zA-Z0-9 ]*$/;

// ─── Types ──────────────────────────────────────────────────────────

interface NameEntryProps {
  onConfirm: (name: string) => void;
  onBack: () => void;
}

// ─── Component ──────────────────────────────────────────────────────

export function NameEntry({ onConfirm, onBack }: NameEntryProps) {
  const [name, setName] = useState(DEFAULT_NAME);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleChange = (value: string) => {
    if (value.length > MAX_NAME_LENGTH) return;
    if (!VALID_CHARS.test(value)) return;
    setName(value);
  };

  const handleSubmit = () => {
    const trimmed = name.trim();
    onConfirm(trimmed || DEFAULT_NAME);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onBack();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-center font-mono text-xl font-bold tracking-wide text-zinc-100">
          Enter Your Name
        </h2>

        <div>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={MAX_NAME_LENGTH}
            className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-amber-500"
            placeholder={DEFAULT_NAME}
          />
          <p className="mt-1 font-mono text-xs text-zinc-600">
            Default: &quot;{DEFAULT_NAME}&quot;
          </p>
        </div>

        <div className="flex justify-center gap-4">
          <button
            onClick={handleSubmit}
            className="rounded border border-amber-700/50 px-6 py-2 font-mono text-sm text-amber-400 transition-colors hover:border-amber-500 hover:text-amber-300"
          >
            Begin
          </button>
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
