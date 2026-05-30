"use client";

import type { Unit } from "@/lib/types";
import Screen from "@/components/Screen";
import { ExternalIcon } from "@/components/Icons";

// The app does NOT host a quiz engine. Each study tool is an external HTML page
// (built in Claude, hosted on Netlify); we just link out. Add a tool by adding a
// URL to the unit's units.json — no code changes.
export default function StudyView({ unit }: { unit: Unit | null }) {
  const tools = unit?.studyTools ?? [];
  // Root-relative tool URLs (study tools bundled in /public) need the host's
  // base path; full http(s) URLs are used as-is.
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const resolve = (url: string) => (url.startsWith("/") ? `${base}${url}` : url);

  return (
    <Screen title="Study" subtitle={unit?.title}>
      {tools.length === 0 ? (
        <p className="mt-6 rounded-card bg-white p-5 text-center text-burgundy shadow-card dark:bg-white/5 dark:text-amber/80">
          No study tools yet. They&apos;ll appear here when Rory adds them.
        </p>
      ) : (
        <ul className="mt-2 space-y-4">
          {tools.map((tool) => (
            <li key={tool.url + tool.title} className="rounded-card bg-white p-5 shadow-card dark:bg-white/5">
              <h2 className="text-lg font-bold text-navy dark:text-cream">{tool.title}</h2>
              {tool.blurb && (
                <p className="mt-1 text-sm text-burgundy dark:text-amber/80">{tool.blurb}</p>
              )}
              <a
                href={resolve(tool.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-amber px-4 text-base font-bold text-navy active:scale-[.99]"
              >
                Open <ExternalIcon width={20} height={20} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
