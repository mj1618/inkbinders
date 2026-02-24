"use client";

import Link from "next/link";
import { TestStatus } from "@/lib/testStatus";

interface TestPageStubProps {
  name: string;
  description: string;
  phase: number;
  phaseName: string;
  status: TestStatus;
}

const STATUS_STYLES: Record<TestStatus, { label: string; className: string }> = {
  "not-started": { label: "Not Started", className: "bg-zinc-700 text-zinc-300" },
  "in-progress": { label: "In Progress", className: "bg-amber-900 text-amber-300" },
  passing: { label: "Passing", className: "bg-emerald-900 text-emerald-300" },
};

export function TestPageStub({ name, description, phase, phaseName, status }: TestPageStubProps) {
  const statusInfo = STATUS_STYLES[status];

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            href="/test"
            className="font-mono text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            &larr; Back to Index
          </Link>
          <span className="text-zinc-700">|</span>
          <span className="font-mono text-xs text-zinc-600">
            Phase {phase} &mdash; {phaseName}
          </span>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-2xl font-bold">{name}</h1>
          <span className={`rounded px-2 py-0.5 font-mono text-xs ${statusInfo.className}`}>
            {statusInfo.label}
          </span>
        </div>

        <p className="max-w-lg text-center text-sm text-zinc-400">{description}</p>

        <div className="flex h-[540px] w-[960px] items-center justify-center rounded border border-dashed border-zinc-800 bg-zinc-900/50">
          <span className="font-mono text-sm text-zinc-600">Canvas will render here</span>
        </div>
      </main>
    </div>
  );
}
