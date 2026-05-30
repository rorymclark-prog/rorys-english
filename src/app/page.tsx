import { getAllStudents } from "@/lib/content";

// Reached only via private per-student links (/s/<code>). This landing page is
// intentionally minimal. In dev it lists the seeded links for quick access;
// that list is hidden in production builds.
export default function Home() {
  const isDev = process.env.NODE_ENV !== "production";
  const students = isDev ? getAllStudents() : [];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="text-5xl">📚</div>
      <h1 className="text-3xl font-extrabold text-navy">Rory&apos;s English</h1>
      <p className="text-burgundy">
        This is a private study app. Open it with your own personal link — the one Rory sent you —
        then tap <strong>Share → Add to Home Screen</strong> to install it.
      </p>

      {isDev && (
        <div className="mt-4 w-full rounded-card border border-amber/40 bg-white p-4 text-left text-sm">
          <p className="mb-2 font-semibold text-amber-deep">Dev links (hidden in production):</p>
          <ul className="space-y-1">
            {students.map((s) => (
              <li key={s.code}>
                <a className="text-burgundy underline" href={`/s/${s.code}/`}>
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
