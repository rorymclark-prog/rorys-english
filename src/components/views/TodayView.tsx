"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Unit } from "@/lib/types";
import { useStudent } from "@/components/StudentContext";
import Screen from "@/components/Screen";
import { BookIcon, ChevronRightIcon, FlameIcon, ChartIcon } from "@/components/Icons";
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
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy-soft dark:text-navy-mist">
            Due now
          </h2>

          {!mounted ? (
            <div className="h-28 animate-pulse rounded-card bg-surface shadow-card dark:bg-navy-raised dark:shadow-card-dark" />
          ) : dueWeek ? (
            <Link
              href={`/s/${code}/homework/${dueWeek.week}/`}
              className="block rounded-card bg-surface p-5 shadow-card transition active:scale-[.97] dark:bg-navy-raised dark:shadow-card-dark"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-bold text-navy dark:text-cream">{dueWeek.title}</p>
                  <p className="tnum mt-1 inline-block w-fit rounded-full bg-warn-soft px-2 py-0.5 text-xs font-bold text-warn dark:bg-warn-dusk dark:text-warn-bright">Due {dueWeek.due}</p>
                </div>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-soft text-amber-deep dark:bg-amber-dusk dark:text-amber">
                  <ChevronRightIcon />
                </span>
              </div>
            </Link>
          ) : (
            <div className="rounded-card bg-surface p-5 text-center shadow-card dark:bg-navy-raised dark:shadow-card-dark">
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
        <section className="mt-5 rounded-card bg-burgundy-soft p-4 dark:bg-navy-raised dark:shadow-card-dark">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-burgundy/15 text-burgundy-deep dark:bg-burgundy-bright/10 dark:text-burgundy-bright">
              <FlameIcon />
            </span>
            <p className="text-sm font-semibold text-navy dark:text-cream">
              {streak > 0 ? (
                <>
                  <span className="tnum text-burgundy-deep dark:text-burgundy-bright">{streak}</span> day
                  {streak === 1 ? "" : "s"} on the go. Keep it up!
                </>
              ) : (
                <>A little every day adds up. Tick off a task today!</>
              )}
              {best > streak && (
                <span className="tnum ml-1 font-normal text-navy-soft dark:text-navy-mist">
                  · best: {best}
                </span>
              )}
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between gap-1.5">
            {activity.map(({ day, active }, i) => (
              <div key={day} className="flex flex-1 flex-col items-center gap-1">
                <span className="sr-only">
                  {(i === activity.length - 1
                    ? "Today"
                    : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
                        new Date(day + "T00:00").getDay()
                      ]) + ": " + (active ? "practiced" : "no activity")}
                </span>
                <span
                  className={`relative h-7 w-7 rounded-full transition ${
                    active ? "bg-burgundy dark:bg-burgundy-bright" : "bg-navy/10 dark:bg-white/10"
                  } ${i === activity.length - 1 ? "ring-2 ring-burgundy/50 dark:ring-burgundy-bright/60" : ""}`}
                  aria-hidden
                />
                <span className="font-mono text-[0.625rem] font-medium text-navy-soft dark:text-navy-mist" aria-hidden>
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
            className="flex items-center justify-between gap-3 rounded-card bg-amber-soft p-4 transition active:scale-[.97] dark:bg-amber-dusk"
          >
            <span className="flex items-center gap-3 font-semibold text-navy dark:text-cream">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-soft text-lg dark:bg-amber-dusk" aria-hidden>
                🔁
              </span>
              <span>
                <span className="tnum">{wordsDue}</span> word{wordsDue === 1 ? "" : "s"} ready to review
              </span>
            </span>
            <ChevronRightIcon className="shrink-0 text-amber-deep dark:text-amber" />
          </Link>
        </section>
      )}

      {/* AI tutor — the flagship helper, kept prominent */}
      <section className="mt-5">
        <Link
          href={`/s/${code}/coach/`}
          className="flex items-center justify-between gap-3 rounded-card bg-[linear-gradient(135deg,#4F46E5,#4338CA)] p-5 text-white shadow-glow transition active:scale-[.97] dark:bg-none dark:bg-amber dark:text-navy dark:shadow-glow-dark"
        >
          <span className="flex items-center gap-3 font-semibold">
            <span className="text-lg" aria-hidden>✨</span> Ask the English tutor
          </span>
          <ChevronRightIcon className="text-white/80 dark:text-navy/60" />
        </Link>
      </section>

      {/* Compact secondary row so these aren't pushed below the fold */}
      <section className="mt-3 grid grid-cols-2 gap-3">
        <Link
          href={`/s/${code}/resources/`}
          className="flex flex-col items-center gap-1 rounded-card bg-surface p-4 text-center shadow-card transition active:scale-[.97] dark:bg-navy-raised dark:shadow-card-dark"
        >
          <BookIcon className="text-amber-deep dark:text-amber" />
          <span className="text-sm font-semibold text-navy dark:text-cream">Lessons &amp; feedback</span>
        </Link>
        <Link
          href={`/s/${code}/progress/`}
          className="flex flex-col items-center gap-1 rounded-card bg-surface p-4 text-center shadow-card transition active:scale-[.97] dark:bg-navy-raised dark:shadow-card-dark"
        >
          <ChartIcon className="text-amber-deep dark:text-amber" />
          <span className="text-sm font-semibold text-navy dark:text-cream">My progress</span>
        </Link>
      </section>
    </Screen>
  );
}
