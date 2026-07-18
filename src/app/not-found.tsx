import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-8 text-center">
      {/* Entry-moment glows: indigo core + violet halo */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-18%] h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,.10),transparent_70%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(139,92,246,.16),transparent_70%)]" />
        <div className="absolute left-1/2 top-[-6%] h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(79,70,229,.14),transparent_70%)] blur-2xl dark:bg-[radial-gradient(circle,rgba(79,70,229,.22),transparent_70%)]" />
      </div>

      <div className="text-5xl">🔑</div>
      <h1 className="display text-2xl text-navy dark:text-cream">This link isn&apos;t right</h1>
      <p className="text-navy-soft dark:text-navy-mist">
        Check the personal link Rory sent you — it&apos;s the key to your app.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-xl bg-[linear-gradient(135deg,#4F46E5,#4338CA)] px-5 py-2.5 font-bold text-white shadow-[0_1px_2px_rgba(0,0,0,.06),0_4px_12px_-4px_#4F46E5] transition ease-out2026 active:scale-[.97] dark:bg-none dark:bg-amber dark:text-navy dark:shadow-none"
      >
        Go to start
      </Link>
    </main>
  );
}
