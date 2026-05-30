"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Unit } from "@/lib/types";
import { useStudent } from "@/components/StudentContext";
import Screen from "@/components/Screen";
import { ChevronRightIcon, FlameIcon, ExternalIcon } from "@/components/Icons";
import { currentStreak, getStreakDays, isWeekComplete } from "@/lib/storage";

export default function TodayView({ unit }: { unit: Unit | null }) {
  const { code, studentId, displayName, greeting } = useStudent();
  const [mounted, setMounted] = useState(false);
  const [streak, setStreak] = useState(0);
  const [dueWeek, setDueWeek] = useState<Unit["homework"][number] | null>(null);
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    setMounted(true);
    setStreak(currentStreak(getStreakDays(studentId)));
    if (unit) {
      const next = unit.homework.find((h) => !isWeekComplete(studentId, unit.id, h.week));
      setDueWeek(next ?? null);
      setAllDone(unit.homework.length > 0 && !next);
    }
  }, [studentId, unit]);

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

      {/* Streak — gentle, never guilt-tripping */}
      {mounted && streak > 0 && (
        <section className="mt-5 flex items-center gap-3 rounded-card bg-amber/10 p-4">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-amber/25 text-amber-deep">
            <FlameIcon />
          </span>
          <p className="text-sm font-semibold text-navy dark:text-cream">
            {streak} day{streak === 1 ? "" : "s"} on the go. Keep it up!
          </p>
        </section>
      )}

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
