"use client";

import { ReactNode } from "react";

interface DebugPanelProps {
  title: string;
  children: ReactNode;
}

export function DebugPanel({ title, children }: DebugPanelProps) {
  return (
    <div className="w-72 shrink-0 overflow-y-auto border-l border-zinc-800 bg-zinc-900 p-4">
      <h2 className="mb-4 font-mono text-sm font-bold uppercase tracking-wider text-amber-500">
        {title}
      </h2>
      <div className="flex flex-col gap-4">
        {children}
      </div>
    </div>
  );
}
