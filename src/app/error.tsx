"use client";

import { useEffect } from "react";

/** Any uncaught render error inside the app. Without this the student gets
 *  Next.js's own grey page, which looks nothing like the rest of the app and
 *  tells them nothing they can act on. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Console only. Nothing a student typed goes anywhere off the device.
    console.error("Screen failed to load:", error);
  }, [error]);

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-8 text-center">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-18%] h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,.10),transparent_70%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(139,92,246,.16),transparent_70%)]" />
        <div className="absolute left-1/2 top-[-6%] h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(79,70,229,.14),transparent_70%)] blur-2xl dark:bg-[radial-gradient(circle,rgba(79,70,229,.22),transparent_70%)]" />
      </div>

      <h1 className="display text-2xl text-navy dark:text-cream">This screen didn&apos;t load</h1>
      <p className="text-navy-soft dark:text-navy-mist">
        Nothing you wrote is lost — anything you sent is still saved on this device and will go to Rory once it can.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 min-h-12 rounded-xl bg-[linear-gradient(135deg,#4F46E5,#4338CA)] px-5 py-2.5 font-bold text-white shadow-[0_1px_2px_rgba(0,0,0,.06),0_4px_12px_-4px_#4F46E5] transition ease-out2026 active:scale-[.97] dark:bg-none dark:bg-amber dark:text-navy dark:shadow-none"
      >
        Try again
      </button>
      <p className="mt-2 text-sm text-navy-soft dark:text-navy-mist">
        If it keeps happening, tell Rory{error.digest ? ` and give him this code: ${error.digest}` : ""}.
      </p>
    </main>
  );
}
