"use client";

import { useState, useEffect } from "react";
import { RenderConfig } from "@/engine/core/RenderConfig";
import type { RenderMode } from "@/engine/core/RenderConfig";

export function RenderModeToggle() {
  const [mode, setMode] = useState<RenderMode>(RenderConfig.getMode());

  useEffect(() => {
    setMode(RenderConfig.getMode());
  }, []);

  const handleChange = (newMode: RenderMode) => {
    RenderConfig.setMode(newMode);
    setMode(newMode);
  };

  return (
    <div className="mb-4 pb-3 border-b border-gray-700">
      <label className="block text-xs text-gray-400 mb-1">Render Mode</label>
      <div className="flex gap-1">
        {(["rectangles", "sprites", "both"] as const).map((m) => (
          <button
            key={m}
            onClick={() => handleChange(m)}
            className={`px-2 py-1 text-xs rounded ${
              mode === m
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}
