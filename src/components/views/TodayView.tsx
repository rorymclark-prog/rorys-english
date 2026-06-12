"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Unit } from "@/lib/types";
import { useStudent } from "@/components/StudentContext";
import Screen from "@/components/Screen";
import { ChevronRightIcon, FlameIcon, ExternalIcon, ChartIcon } from "@/components/Icons";
import {
  bestStreak,
  countWordsDue,
  currentStreak,
  getStreakDays,
  isWeekComplete,
  recentActivity,
} from "@/lib/storage";

export default function TodayView({ unit }: { unit: Unit | null }) {
  const { code, studentId, displayName, greeting } = useStudent();
  const [mounted, setMounted] = useState(false);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [activity, setActivity] = useState<{ day: string; active: boolean }[]>([]);
  const [dueWeek, setDueWeek] = useState<Unit["homework"][number] | null>(null);
  const [allDone, setAllDone] = useState(false);
  const [wordsDue, setWordsDue] = useState(0);

  useEffect(() => {
    setMounted(true);
    const days = getStreakDays(studentId);
    setStreak(currentStreak(days));
    setBest(bestStreak(days));
    setActivity(recentActivity(days, 7));
    setWordsDue(countWordsDue(code));
    if (unit) {
      const next = unit.homework.find((h) => !isWeekComplete(studentId, unit.id, h.week));
      setDueWeek(next ?? null);
      setAllDone(unit.homework.length > 0 && !next);
    }
  }, [studentId, code, unit]);

  return (
    <Screen title={`${greeting ?? "Hi"} 👋`} subtitle={unit ? unit.title : undefined}>
      {/* Due-now card */}
      {unit && (
        <section className="mt-2">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-burgundy dark:text-amber/80">
            Due now
          </h2>

          {!mounted ? (
            <div className="h-28 animate-pulse rounded-card bg-white/70 shadow-card dark:bg-white/5" />
          ) : dueWeek ? (
            <Link
              href={`/s/${code}/homework/${dueWeek.week}/`}
              className="block rounded-card bg-white p-5 shadow-card active:scale-[.99] dark:bg-white/5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-bold text-navy dark:text-cream">{dueWeek.title}</p>
                  <p className="mt-1 text-sm text-burgundy dark:text-amber/80">Due {dueWeek.due}</p>
                </div>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber/15 text-amber-deep dark:text-amber">
                  <ChevronRightIcon />
                </span>
              </div>
            </Link>
          ) : (
            <div className="rounded-card bg-white p-5 text-center shadow-card dark:bg-white/5">
              <p className="text-2xl">🎉</p>
              <p className="mt-1 font-bold text-navy dark:text-cream">
                {allDone ? "All homework done — nice work!" : "No homework set yet."}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Activity strip — gentle, never guilt-tripping */}
      {mounted && activity.length > 0 && (
        <section className="mt-5 rounded-card bg-amber/10 p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber/25 text-amber-deep dark:text-amber">
              <FlameIcon />
            </span>
            <p className="text-sm font-semibold text-navy dark:text-cream">
              {streak > 0 ? (
                <>
                  {streak} day{streak === 1 ? "" : "s"} on the go. Keep it up!
                </>
              ) : (
                <>A little every day adds up. Tick off a task today!</>
              )}
              {best > streak && (
                <span className="ml-1 font-normal text-navy-soft dark:text-cream/60">
                  · best: {best}
                </span>
              )}
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between gap-1.5">
            {activity.map(({ day, active }, i) => (
              <div key={day} className="flex flex-1 flex-col items-center gap-1">
                <span
                  className={`relative h-7 w-7 rounded-full ${
                    active ? "bg-amber" : "bg-navy/10 dark:bg-white/10"
                  } ${i === activity.length - 1 ? "ring-2 ring-amber/70 dark:ring-amber" : ""}`}
                  aria-hidden
                >
                  {i === activity.length - 1 && <span className="sr-only">Today</span>}
                </span>
                <span className="text-[10px] font-medium text-navy-soft dark:text-cream/70">
                  {/* Sun=0 … Sat=6 → both ends are "S" */}
                  {"SMTWTFS"[new Date(day + "T00:00").getDay()]}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Vocab due for review (spaced repetition, written by the study tools) */}
      {mounted && wordsDue > 0 && (
        <section className="mt-5">
          <Link
            href={`/s/${code}/study/`}
            className="flex items-center justify-between gap-3 rounded-card border-2 border-amber/40 bg-amber/10 p-4 active:scale-[.99]"
          >
            <span className="flex items-center gap-3 font-semibold text-navy dark:text-cream">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber/25 text-lg" aria-hidden>
                🔁
              </span>
              {wordsDue} word{wordsDue === 1 ? "" : "s"} ready to review
            </span>
            <ChevronRightIcon className="shrink-0 text-amber-deep dark:text-amber" />
          </Link>
        </section>
      )}

      {/* Lessons & feedback (Drive-shared files) */}
      <section className="mt-5">
        <Link
          href={`/s/${code}/resources/`}
          className="flex items-center justify-between gap-3 rounded-card border border-navy/10 bg-white p-4 shadow-card dark:border-white/10 dark:bg-white/5"
        >
          <span className="flex items-center gap-3 font-semibold text-navy dark:text-cream">
            <span className="text-lg" aria-hidden>📚</span> Lessons &amp; feedback
          </span>
          <ChevronRightIcon className="text-navy-soft dark:text-cream/60" />
        </Link>
      </section>

      {/* Progress section */}
      <section className="mt-5">
        <Link
          href={`/s/${code}/progress/`}
          className="flex items-center justify-between gap-3 rounded-card border border-navy/10 bg-white p-4 shadow-card dark:border-white/10 dark:bg-white/5"
        >
          <span className="flex items-center gap-3 font-semibold text-navy dark:text-cream">
            <ChartIcon className="text-amber-deep dark:text-amber" /> See my progress
          </span>
          <ChevronRightIcon className="text-navy-soft dark:text-cream/60" />
        </Link>
      </section>

      {/* Quick link to study tools */}
      {unit && unit.studyTools.length > 0 && (
        <section className="mt-5">
          <Link
            href={`/s/${code}/study/`}
            className="flex items-center justify-between gap-3 rounded-card border border-navy/10 bg-white p-4 shadow-card dark:border-white/10 dark:bg-white/5"
          >
            <span className="flex items-center gap-3 font-semibold text-navy dark:text-cream">
              <ExternalIcon className="text-amber-deep dark:text-amber" /> Open a study tool
            </span>
            <ChevronRightIcon className="text-navy-soft dark:text-cream/60" />
          </Link>
        </section>
      )}
    </Screen>
  );
}
