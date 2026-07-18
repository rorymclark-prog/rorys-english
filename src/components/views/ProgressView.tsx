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
          <h1 className="display text-2xl text-navy dark:text-cream">
            {mode === "parent" ? `${displayName}'s progress` : "Progress"}
          </h1>
          <p className="mt-0.5 text-sm text-navy-soft dark:text-navy-mist">
            {mode === "parent" ? "A snapshot for parents" : "Everything you've done so far"}
          </p>
        </div>
        {mode === "student" && studentCode && (
          <Link
            href={`/s/${studentCode}/settings/`}
            aria-label="Settings"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-navy-soft transition hover:bg-black/5 active:scale-[.97] dark:text-navy-mist dark:hover:bg-white/10"
          >
            <GearIcon />
          </Link>
        )}
      </header>

      <main className="px-5 pb-10">
        {state === "loading" && (
          <div className="mt-4 space-y-3">
            <div className="h-20 animate-pulse rounded-card bg-surface shadow-card dark:bg-navy-raised dark:shadow-card-dark" />
            <div className="h-40 animate-pulse rounded-card bg-surface shadow-card dark:bg-navy-raised dark:shadow-card-dark" />
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
              <p className="tnum mt-4 text-center text-xs text-navy-soft dark:text-navy-mist">
                Updated {data.generatedAt}
              </p>
            )}
          </>
        )}

        {/* Links shelf — dashboards / resources the tutor adds */}
        {links.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy-soft dark:text-navy-mist">
              Links
            </h2>
            <ul className="space-y-3">
              {links.map((l) => (
                <li key={l.url + l.title}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 rounded-card bg-surface p-4 shadow-card transition active:scale-[.97] dark:bg-navy-raised dark:shadow-card-dark"
                  >
                    <span className="min-w-0">
                      <span className="block font-bold text-navy dark:text-cream">{l.title}</span>
                      {l.blurb && (
                        <span className="block text-sm text-navy-soft dark:text-navy-mist">{l.blurb}</span>
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
    <p className="mt-6 rounded-card bg-surface p-5 text-center text-navy-soft shadow-card dark:bg-navy-raised dark:text-navy-mist dark:shadow-card-dark">
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
          className="rounded-card bg-surface p-3 text-center shadow-card dark:bg-navy-raised dark:shadow-card-dark"
        >
          <div className="tnum text-2xl font-extrabold text-navy dark:text-cream">{t.value}</div>
          <div className="mt-1 text-[0.6875rem] font-medium leading-tight text-navy-soft dark:text-navy-mist">
            {t.label}
          </div>
        </div>
      ))}
    </section>
  );
}

// ── a Sheet tab rendered as a compact, scrollable table ──────────────────────
/** "85", "85%", "9/10", "12.07.2026", "7:30" — anything numeral-shaped */
const NUMERAL_RE = /^-?\d+([.,:/\s]\d+)*\s*%?$/;

function SectionCard({ title, section }: { title: string; section?: Section }) {
  if (!section || section.rows.length === 0) return null;
  // a column is numeric if every non-empty cell is numeral-shaped (→ right-align + tnum)
  const numericCols = section.headers.map((_, ci) => {
    let seen = false;
    for (const row of section.rows) {
      const v = String(row[ci] ?? "").trim();
      if (v === "" || v === "—" || v === "-") continue;
      if (!NUMERAL_RE.test(v)) return false;
      seen = true;
    }
    return seen;
  });
  return (
    <section className="mt-5">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy-soft dark:text-navy-mist">
        {title}
      </h2>
      <div className="max-h-[70vh] overflow-auto rounded-card bg-surface shadow-card dark:bg-navy-raised dark:shadow-card-dark">
        <table className="w-full min-w-max text-left text-sm">
          <thead>
            <tr>
              {section.headers.map((h, i) => (
                <th
                  key={i}
                  className={`sticky top-0 z-[1] whitespace-nowrap bg-surface px-3 py-2 font-bold text-navy shadow-[inset_0_-1px_0_rgba(0,0,0,.06)] dark:bg-navy-raised dark:text-cream dark:shadow-[inset_0_-1px_0_rgba(255,255,255,.08)] ${
                    numericCols[i] ? "text-right" : ""
                  }`}
                >
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
                <tr key={ri} className="border-b border-black/[.04] last:border-0 dark:border-white/[.04]">
                  {row.map((cell, ci) => {
                    const v = String(cell);
                    const d = /^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v) : null;
                    return (
                      <td
                        key={ci}
                        className={`whitespace-nowrap px-3 py-2 text-navy-soft dark:text-navy-mist ${
                          numericCols[ci] ? "tnum text-right" : ""
                        }`}
                      >
                        {d
                          ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                          : v}
                      </td>
                    );
                  })}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
