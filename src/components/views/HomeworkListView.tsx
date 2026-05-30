"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Unit } from "@/lib/types";
import { useStudent } from "@/components/StudentContext";
import Screen from "@/components/Screen";
import { ChevronRightIcon } from "@/components/Icons";
import { getTaskChecked, isWeekComplete } from "@/lib/storage";

export default function HomeworkListView({ unit }: { unit: Unit | null }) {
  const { code, studentId } = useStudent();
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [progress, setProgress] = useState<Record<number, { done: number; total: number }>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!unit) return;
    const map: Record<number, boolean> = {};
    const prog: Record<number, { done: number; total: number }> = {};
    unit.homework.forEach((h) => {
      map[h.week] = isWeekComplete(studentId, unit.id, h.week);
      const checks = h.tasks.filter((t) => t.type === "checkbox");
      prog[h.week] = {
        total: checks.length,
        done: checks.filter((t) => getTaskChecked(studentId, unit.id, h.week, t.id)).length,
      };
    });
    setDone(map);
    setProgress(prog);
  }, [studentId, unit]);

  return (
    <Screen title="Homework" subtitle={unit?.title}>
      {!unit || unit.homework.length === 0 ? (
        <p className="mt-6 rounded-card bg-white p-5 text-center text-burgundy shadow-card dark:bg-white/5 dark:text-amber/80">
          No homework yet — check back soon.
        </p>
      ) : (
        <ul className="mt-2 space-y-3">
          {unit.homework.map((h) => {
            const complete = mounted && done[h.week];
            return (
              <li key={h.week}>
                <Link
                  href={`/s/${code}/homework/${h.week}/`}
                  className="flex items-center justify-between gap-3 rounded-card bg-white p-4 shadow-card active:scale-[.99] dark:bg-white/5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
                        complete
                          ? "bg-green-500 text-white"
                          : "bg-amber/15 text-amber-deep dark:text-amber"
                      }`}
                      aria-hidden
                    >
                      {complete ? "✓" : h.week}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-navy dark:text-cream">{h.title}</p>
                      <p className="text-sm text-burgundy dark:text-amber/80">
                        Due {h.due}
                        {mounted && !complete && progress[h.week]?.total > 0 && (
                          <span className="ml-2 text-navy-soft dark:text-cream/60">
                            · {progress[h.week].done}/{progress[h.week].total} ticked
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <ChevronRightIcon className="shrink-0 text-navy-soft dark:text-cream/60" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Screen>
  );
}
