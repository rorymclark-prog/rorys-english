"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Unit } from "@/lib/types";
import { useStudent } from "@/components/StudentContext";
import Screen from "@/components/Screen";
import { ChevronRightIcon } from "@/components/Icons";
import { completeAssignmentRemote, fetchAssignments, remoteEnabled, rowToAssignment, type Assignment } from "@/lib/remote";
import { getTaskChecked, isWeekComplete } from "@/lib/storage";

export default function HomeworkListView({ unit }: { unit: Unit | null }) {
  const { code, studentId } = useStudent();
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [progress, setProgress] = useState<Record<number, { done: number; total: number }>>({});
  const [mounted, setMounted] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!remoteEnabled()) return;
    let live = true;
    fetchAssignments(code)
      .then((d) => {
        if (live && d.ok && d.assignments) setAssignments(d.assignments.rows.map(rowToAssignment));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [code]);

  async function completeAssignment(a: Assignment) {
    setAssignmentError(null);
    setAssignments((prev) => prev.filter((x) => x.id !== a.id)); // optimistic
    const r = await completeAssignmentRemote(code, a.id);
    if (!r.ok) {
      // Roll back — Assignments have no local fallback truth, so a failed
      // write must not silently vanish the task from view.
      setAssignments((prev) => (prev.some((x) => x.id === a.id) ? prev : [...prev, a]));
      setAssignmentError("Couldn't mark that done — check your connection and try again.");
    }
  }

  return (
    <Screen title="Homework" subtitle={unit?.title}>
      {mounted && assignments.length > 0 && (
        <section className="mt-2">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy-soft dark:text-navy-mist">
            Assigned by Rory
          </h2>
          <ul className="space-y-3">
            {assignments.map((a) => (
              <li
                key={a.id}
                className="flex items-start gap-3 rounded-card bg-surface p-4 shadow-card dark:bg-navy-raised dark:shadow-card-dark"
              >
                <button
                  type="button"
                  onClick={() => completeAssignment(a)}
                  aria-label={`Mark "${a.title}" done`}
                  className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-amber-deep transition active:scale-[.9] dark:border-amber"
                />
                <div className="min-w-0">
                  <p className="font-bold text-navy dark:text-cream">{a.title}</p>
                  {a.details && <p className="mt-0.5 text-sm text-navy-soft dark:text-navy-mist">{a.details}</p>}
                  {a.due && (
                    <p className="tnum mt-1 inline-block rounded-full bg-warn-soft px-2 py-0.5 text-xs font-bold text-warn dark:bg-warn-dusk dark:text-warn-bright">
                      Due {a.due}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {assignmentError && (
            <p className="mt-2 text-sm text-bad dark:text-bad-bright">{assignmentError}</p>
          )}
        </section>
      )}

      {!unit || unit.homework.length === 0 ? (
        <p className="mt-6 rounded-card bg-surface p-5 text-center text-navy-soft shadow-card dark:bg-navy-raised dark:text-navy-mist dark:shadow-card-dark">
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
                  className="flex items-center justify-between gap-3 rounded-card bg-surface p-4 shadow-card transition active:scale-[.97] dark:bg-navy-raised dark:shadow-card-dark"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`tnum grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold transition-colors ${
                        complete
                          ? "bg-good-soft text-good dark:bg-good-dusk dark:text-good-bright"
                          : "bg-amber-soft text-amber-deep dark:bg-amber-dusk dark:text-amber"
                      }`}
                      aria-hidden
                    >
                      {complete ? "✓" : h.week}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-navy dark:text-cream">{h.title}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        {complete ? (
                          <span className="tnum text-navy-soft dark:text-navy-mist">Due {h.due}</span>
                        ) : (
                          <span className="tnum rounded-full bg-warn-soft px-2 py-0.5 text-xs font-bold text-warn dark:bg-warn-dusk dark:text-warn-bright">
                            Due {h.due}
                          </span>
                        )}
                        {mounted && !complete && progress[h.week]?.total > 0 && (
                          <span className="tnum text-navy-soft dark:text-navy-mist">
                            {progress[h.week].done}/{progress[h.week].total} ticked
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <ChevronRightIcon className="shrink-0 text-navy-soft dark:text-navy-mist" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Screen>
  );
}
