import Link from "next/link";
import { getAllStudents } from "@/lib/content";
import {BookIcon,ChevronRightIcon} from "@/components/Icons";

// Reached only via private per-student links (/s/<code>). This landing page is
// intentionally minimal. In dev it lists the seeded links for quick access;
// that list is hidden in production builds.
export default function Home() {
  const isDev = process.env.NODE_ENV !== "production";
  const students = isDev ? getAllStudents() : [];

  return (
    <main className="landing-page relative mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-8 text-center">
      {/* Entry-moment glows: indigo core + violet halo, contained to this view */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-18%] h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,.10),transparent_70%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(139,92,246,.16),transparent_70%)]" />
        <div className="absolute left-1/2 top-[-6%] h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(79,70,229,.14),transparent_70%)] blur-2xl dark:bg-[radial-gradient(circle,rgba(79,70,229,.22),transparent_70%)]" />
      </div>

      <span className="landing-icon"><BookIcon width={29} height={29}/></span>
      <p className="work-eyebrow">YOUR PRIVATE LEARNING SPACE</p>
      <h1 className="display text-3xl text-navy dark:text-cream">Rory&apos;s English</h1>
      <p className="landing-intro">Lessons, homework, speaking practice and feedback in one place.</p>
      <section className="landing-instructions"><h2>How to get in</h2><p>Open the personal link Rory sent you, then sign in with your own account.</p><p>You can add the app to your home screen from your browser’s Share menu.</p></section>

      <Link href="/teacher/" className="landing-teacher-link">
        Teacher sign-in <ChevronRightIcon width={18} height={18}/>
      </Link>

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
