"use client";

import Link from "next/link";
import { useStudent } from "./StudentContext";
import { GearIcon } from "./Icons";

/** Standard screen header (title + settings gear) used by the main tabs. */
export default function Screen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { code } = useStudent();
  return (
    <>
      <header
        className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-cream px-5 pb-3 dark:bg-navy"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
      >
        <div className="min-w-0">
          <h1 className="display text-2xl text-navy break-words dark:text-cream">{title}</h1>
          {subtitle && <p className="tnum mt-0.5 text-sm text-navy-soft dark:text-navy-mist">{subtitle}</p>}
        </div>
        <Link
          href={`/s/${code}/settings/`}
          aria-label="Settings"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-navy-soft transition ease-out2026 duration-200 hover:bg-black/5 active:scale-[.97] dark:text-navy-mist dark:hover:bg-white/10"
        >
          <GearIcon />
        </Link>
      </header>
      <main className="px-5 pb-10">{children}</main>
    </>
  );
}
