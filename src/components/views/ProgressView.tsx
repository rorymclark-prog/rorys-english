"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { StudyTool } from "@/lib/types";
import { fetchProgress, remoteEnabled, type Progress, type Section } from "@/lib/remote";
import { GearIcon, ExternalIcon } from "@/components/Icons";

type Mode = "student" | "parent";

export default function ProgressView({
  fetchCode,
  studentCode,
  displayName,
  mode,
  links = [],
}: {
  /** student code OR parent code — what we query the Sheet with */
  fetchCode: string;
  /** the student's own code, for the settings gear link (student mode only) */
  studentCode?: string;
  displayName: string;
  mode: Mode;
  links?: StudyTool[];
}) {
  const [state, setState] = useState<"loading" | "ok" | "error" | "off">("loading");
  const [data, setData] = useState<Progress | null>(null);

  useEffect(() => {
    if (!remoteEnabled()) {
      setState("off");
      return;
    }
    let live = true;
    fetchProgress(fetchCode)
      .then((d) => {
        if (!live) return;
        if (d.ok) {
          setData(d);
          setState("ok");
        } else {
          setState("error");
        }
      })
      .catch(() => live && setState("error"));
    return () => {
      live = false;
    };
  }, [fetchCode]);

  return (
    <>
      {/* Header (self-contained so this works in the app shell AND the parent page) */}
      <header
        className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-cream/95 px-5 pb-3 backdrop-blur dark:bg-navy/95"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
      >
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-navy dark:text-cream">
            {mode === "parent" ? `${displayName}'s progress` : "Progress"}
          </h1>
          <p className="mt-0.5 text-sm text-burgundy dark:text-amber/80">
            {mode === "parent" ? "A snapshot for parents" : "Everything you've done so far"}
          </p>
        </div>
        {mode === "student" && studentCode && (
          <Link
            href={`/s/${studentCode}/settings/`}
            aria-label="Settings"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-navy-soft hover:bg-black/5 dark:text-cream/70 dark:hover:bg-white/10"
          >
            <GearIcon />
          </Link>
        )}
      </header>

      <main className="px-5 pb-10">
        {state === "loading" && (
          <div className="mt-4 space-y-3">
            <div className="h-20 animate-pulse rounded-card bg-white/70 shadow-card dark:bg-white/5" />
            <div className="h-40 animate-pulse rounded-card bg-white/70 shadow-card dark:bg-white/5" />
          </div>
        )}

        {state === "off" && (
          <Note>Progress sync isn&apos;t switched on yet.</Note>
        )}

        {state === "error" && (
          <Note>
            Couldn&apos;t load progress right now. Check your connection and try again.
          </Note>
        )}

        {state === "ok" && data && (
          <>
            <SummaryTiles data={data} />
            <SectionCard title="Homework" section={data.homework} />
            <SectionCard title="Quizzes & vocab" section={data.quizzes} />
            <SectionCard title="School tests" section={data.schoolTests} />
            <SectionCard title="Writing" section={data.writing} />
            <SectionCard title="Speaking" section={data.speaking} />
            <SectionCard title="Mock tests" section={data.mockTests} />
            {data.generatedAt && (
              <p className="mt-4 text-center text-xs text-navy-soft dark:text-cream/50">
                Updated {data.generatedAt}
              </p>
            )}
          </>
        )}

        {/* Links shelf — dashboards / resources the tutor adds */}
        {links.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-burgundy dark:text-amber/80">
              Links
            </h2>
            <ul className="space-y-3">
              {links.map((l) => (
                <li key={l.url + l.title}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 rounded-card bg-white p-4 shadow-card active:scale-[.99] dark:bg-white/5"
                  >
                    <span className="min-w-0">
                      <span className="block font-bold text-navy dark:text-cream">{l.title}</span>
                      {l.blurb && (
                        <span className="block text-sm text-burgundy dark:text-amber/80">{l.blurb}</span>
                      )}
                    </span>
                    <ExternalIcon className="shrink-0 text-amber-deep dark:text-amber" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-6 rounded-card bg-white p-5 text-center text-burgundy shadow-card dark:bg-white/5 dark:text-amber/80">
      {children}
    </p>
  );
}

// ── summary tiles ────────────────────────────────────────────────────────────
function col(section: Section | undefined, name: string): number {
  if (!section) return -1;
  return section.headers.findIndex((h) => String(h).toLowerCase().includes(name.toLowerCase()));
}

function SummaryTiles({ data }: { data: Progress }) {
  const hw = data.homework;
  const statusIdx = col(hw, "status");
  const weeksDone =
    hw && statusIdx >= 0
      ? hw.rows.filter((r) => String(r[statusIdx]).toLowerCase() === "complete").length
      : 0;

  const qz = data.quizzes;
  const pctIdx = col(qz, "%");
  const bestPct =
    qz && pctIdx >= 0 && qz.rows.length
      ? Math.max(...qz.rows.map((r) => Number(r[pctIdx]) || 0))
      : null;

  const tiles: { label: string; value: string }[] = [
    { label: "Homework done", value: String(weeksDone) },
    { label: "Quiz rounds", value: String(qz?.rows.length ?? 0) },
    { label: "Best quiz", value: bestPct != null ? `${bestPct}%` : "—" },
    { label: "Writing", value: String(data.writing?.rows.length ?? 0) },
    { label: "Speaking", value: String(data.speaking?.rows.length ?? 0) },
    { label: "School tests", value: String(data.schoolTests?.rows.length ?? 0) },
  ];

  return (
    <section className="mt-4 grid grid-cols-3 gap-3">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="rounded-card bg-white p-3 text-center shadow-card dark:bg-white/5"
        >
          <div className="text-2xl font-extrabold text-amber-deep dark:text-amber">{t.value}</div>
          <div className="mt-1 text-[11px] font-medium leading-tight text-navy-soft dark:text-cream/70">
            {t.label}
          </div>
        </div>
      ))}
    </section>
  );
}

// ── a Sheet tab rendered as a compact, scrollable table ──────────────────────
function SectionCard({ title, section }: { title: string; section?: Section }) {
  if (!section || section.rows.length === 0) return null;
  return (
    <section className="mt-5">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-burgundy dark:text-amber/80">
        {title}
      </h2>
      <div className="overflow-x-auto rounded-card bg-white shadow-card dark:bg-white/5">
        <table className="w-full min-w-max text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/10">
              {section.headers.map((h, i) => (
                <th key={i} className="whitespace-nowrap px-3 py-2 font-bold text-navy dark:text-cream">
                  {String(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.rows
              .slice()
              .reverse()
              .map((row, ri) => (
                <tr key={ri} className="border-b border-black/5 last:border-0 dark:border-white/5">
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="whitespace-nowrap px-3 py-2 text-navy-soft dark:text-cream/80"
                    >
                      {String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
