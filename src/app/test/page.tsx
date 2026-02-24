import Link from "next/link";
import { TEST_PAGES, TestStatus } from "@/lib/testStatus";

const STATUS_STYLES: Record<TestStatus, { label: string; className: string }> = {
  "not-started": { label: "Not Started", className: "bg-zinc-700 text-zinc-300" },
  "in-progress": { label: "In Progress", className: "bg-amber-900 text-amber-300" },
  passing: { label: "Passing", className: "bg-emerald-900 text-emerald-300" },
};

export default function TestIndex() {
  const phases = Array.from(new Set(TEST_PAGES.map((t) => t.phase))).sort();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-8 py-6">
        <h1 className="font-mono text-3xl font-bold tracking-tight">Inkbinders</h1>
        <p className="mt-1 font-mono text-sm text-zinc-500">Test Page Index</p>
      </header>

      <main className="mx-auto max-w-4xl px-8 py-8">
        {phases.map((phase) => {
          const tests = TEST_PAGES.filter((t) => t.phase === phase);
          const phaseName = tests[0].phaseName;

          return (
            <section key={phase} className="mb-8">
              <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-zinc-500">
                Phase {phase} &mdash; {phaseName}
              </h2>
              <div className="flex flex-col gap-2">
                {tests.map((test) => {
                  const statusInfo = STATUS_STYLES[test.status];
                  return (
                    <Link
                      key={test.path}
                      href={test.path}
                      className="group flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/50 px-4 py-3 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-medium text-zinc-200 group-hover:text-white">
                          {test.name}
                        </span>
                        <span className={`rounded px-2 py-0.5 font-mono text-[10px] ${statusInfo.className}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-zinc-600 group-hover:text-zinc-400">
                        {test.description}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>

      <footer className="border-t border-zinc-800 px-8 py-4">
        <Link href="/" className="font-mono text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
          &larr; Home
        </Link>
      </footer>
    </div>
  );
}
