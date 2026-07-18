"use client";

import Link from "next/link";
import type { Unit } from "@/lib/types";
import { useStudent } from "@/components/StudentContext";
import Screen from "@/components/Screen";
import { ExternalIcon, ChevronRightIcon } from "@/components/Icons";

// The app does NOT host a quiz engine. Each study tool is an external HTML page
// (built in Claude, hosted on Netlify); we just link out. Add a tool by adding a
// URL to the unit's units.json — no code changes.
export default function StudyView({ unit }: { unit: Unit | null }) {
  const { code } = useStudent();
  const tools = unit?.studyTools ?? [];
  const hasSpeaking = (unit?.speakingLines?.length ?? 0) > 0;
  // Root-relative tool URLs (study tools bundled in /public) need the host's
  // base path; full http(s) URLs are used as-is.
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const resolve = (url: string) => (url.startsWith("/") ? `${base}${url}` : url);

  return (
    <Screen title="Study" subtitle={unit?.title}>
      {/* In-app speaking practice (record & compare) */}
      {hasSpeaking && (
        <Link
          href={`/s/${code}/speak/`}
          className="mt-2 flex items-center justify-between gap-3 rounded-card bg-amber-soft p-4 transition active:scale-[.97] dark:bg-amber-dusk"
        >
          <span className="flex items-center gap-3 font-semibold text-navy dark:text-cream">
            <span className="text-lg" aria-hidden>🎤</span> Speaking practice
          </span>
          <ChevronRightIcon className="text-amber-deep dark:text-amber" />
        </Link>
      )}

      {tools.length === 0 ? (
        <p className="mt-6 rounded-card bg-surface p-5 text-center text-navy-soft shadow-card dark:bg-navy-raised dark:text-navy-mist dark:shadow-card-dark">
          No study tools yet. They&apos;ll appear here when Rory adds them.
        </p>
      ) : (
        <ul className="mt-2 space-y-4">
          {tools.map((tool) => (
            <li key={tool.url + tool.title} className="rounded-card bg-surface p-5 shadow-card dark:bg-navy-raised dark:shadow-card-dark">
              <h2 className="text-lg font-bold text-navy dark:text-cream">{tool.title}</h2>
              {tool.blurb && (
                <p className="mt-1 text-sm text-navy-soft dark:text-navy-mist">{tool.blurb}</p>
              )}
              <a
                href={resolve(tool.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#4F46E5,#4338CA)] px-4 text-base font-bold text-white shadow-[0_1px_2px_rgba(0,0,0,.06),0_4px_12px_-4px_#4F46E5] transition active:scale-[.97] dark:bg-none dark:bg-amber dark:text-navy dark:shadow-none"
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
