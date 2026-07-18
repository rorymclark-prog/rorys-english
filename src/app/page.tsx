import { getAllStudents } from "@/lib/content";

// Reached only via private per-student links (/s/<code>). This landing page is
// intentionally minimal. In dev it lists the seeded links for quick access;
// that list is hidden in production builds.
export default function Home() {
  const isDev = process.env.NODE_ENV !== "production";
  const students = isDev ? getAllStudents() : [];

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-8 text-center">
      {/* Entry-moment glows: indigo core + violet halo, contained to this view */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-18%] h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,.10),transparent_70%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(139,92,246,.16),transparent_70%)]" />
        <div className="absolute left-1/2 top-[-6%] h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(79,70,229,.14),transparent_70%)] blur-2xl dark:bg-[radial-gradient(circle,rgba(79,70,229,.22),transparent_70%)]" />
      </div>

      <div className="text-5xl">📚</div>
      <h1 className="display text-3xl text-navy dark:text-cream">Rory&apos;s English</h1>
      <p className="rounded-card bg-amber-soft p-5 text-navy-soft dark:bg-amber-dusk dark:text-navy-mist">
        This is a private study app. Open it with your own personal link — the one Rory sent you —
        then tap <strong className="text-amber-deep dark:text-amber">Share → Add to Home Screen</strong> to install it.
      </p>

      {isDev && (
        <div className="mt-4 w-full rounded-card bg-surface p-4 text-left text-sm shadow-card dark:bg-navy-raised dark:shadow-card-dark">
          <p className="mb-2 font-semibold text-amber-deep dark:text-amber">Dev links (hidden in production):</p>
          <ul className="space-y-1">
            {students.map((s) => (
              <li key={s.code}>
                <a
                  className="text-amber-deep underline underline-offset-2 transition hover:text-amber-press dark:text-amber dark:hover:text-cream"
                  href={`/s/${s.code}/`}
                >
                  {s.displayName} → /s/{s.code}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
