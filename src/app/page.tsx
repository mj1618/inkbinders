import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100">
      <main className="flex flex-col items-center gap-8 px-8 text-center">
        <h1 className="font-mono text-4xl font-bold tracking-tight">
          Inkbinders
        </h1>
        <p className="font-mono text-lg text-zinc-400">
          The Library That Fights Back
        </p>
        <p className="max-w-md text-sm text-zinc-500">
          A hand-inked 2D metroidvania where a living manuscript fights to
          rewrite its own fate. Explore enchanted libraries, master ink-based
          abilities, and survive the night.
        </p>
        <Link
          href="/test"
          className="rounded border border-zinc-700 px-6 py-2 font-mono text-sm text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
        >
          Test Pages &rarr;
        </Link>
      </main>
    </div>
  );
}
