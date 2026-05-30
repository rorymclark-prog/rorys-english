"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { HomeworkTask, HomeworkWeek } from "@/lib/types";
import { useStudent } from "@/components/StudentContext";
import { ChevronLeftIcon } from "@/components/Icons";
import {
  getTaskChecked,
  getTaskValue,
  isWeekComplete,
  setTaskChecked,
  setTaskValue,
  setWeekComplete,
} from "@/lib/storage";
import { confettiBurst, haptic } from "@/lib/celebrate";
import { buildHomeworkIcs, downloadIcs, parseDueDate } from "@/lib/ics";

export default function HomeworkWeekView({
  unitId,
  week,
  backHref,
}: {
  unitId: string;
  week: HomeworkWeek;
  backHref: string;
}) {
  const { studentId } = useStudent();
  const [complete, setComplete] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    setComplete(isWeekComplete(studentId, unitId, week.week));
  }, [studentId, unitId, week.week]);

  const toggleComplete = () => {
    const next = !complete;
    setComplete(next);
    setWeekComplete(studentId, unitId, week.week, next);
    if (next) {
      setFlash(true);
      window.setTimeout(() => setFlash(false), 700);
      confettiBurst();
      haptic([10, 40, 20]);
    }
  };

  const addToCalendar = () => {
    const date = parseDueDate(week.due);
    if (!date) return;
    const ics = buildHomeworkIcs(`${week.title} (due)`, date, `${studentId}-${unitId}-hw${week.week}`);
    downloadIcs(`${unitId}-hw${week.week}.ics`, ics);
  };

  const canAddCalendar = parseDueDate(week.due) !== null;

  return (
    <div className={flash ? "animate-flash" : undefined}>
      {/* Header with back link */}
      <header
        className="sticky top-0 z-10 flex items-center gap-2 bg-cream/95 px-3 pb-3 backdrop-blur dark:bg-navy/95"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
        <Link
          href={backHref}
          aria-label="Back to homework"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-navy-soft hover:bg-black/5 dark:text-cream/70 dark:hover:bg-white/10"
        >
          <ChevronLeftIcon />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold text-navy dark:text-cream">{week.title}</h1>
          <p className="text-sm text-burgundy dark:text-amber/80">Due {week.due}</p>
        </div>
      </header>

      <main className="space-y-4 px-5 pt-2">
        {week.tasks.map((task, i) => (
          <TaskCard key={task.id} studentId={studentId} unitId={unitId} week={week.week} index={i} task={task} />
        ))}

        {/* Add the deadline to the phone calendar */}
        {canAddCalendar && (
          <button
            onClick={addToCalendar}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-navy/15 bg-white px-4 text-sm font-bold text-navy active:scale-[.99] dark:border-white/15 dark:bg-white/5 dark:text-cream"
          >
            📅 Add due date to my calendar
          </button>
        )}

        {/* Mark complete */}
        <button
          onClick={toggleComplete}
          className={`mt-2 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-4 text-base font-bold transition-colors active:scale-[.99] ${
            complete ? "bg-green-500 text-white" : "bg-navy text-cream dark:bg-amber dark:text-navy"
          }`}
        >
          {complete ? "✓ Completed" : "Mark as complete"}
        </button>
        {complete && (
          <p className="pb-2 text-center text-sm text-burgundy dark:text-amber/80">
            Nice one. Don&apos;t forget to send Rory your voice memos on WhatsApp.
          </p>
        )}
      </main>
    </div>
  );
}

// ── One task card, type-driven ───────────────────────────────────────────────
function TaskCard({
  studentId,
  unitId,
  week,
  index,
  task,
}: {
  studentId: string;
  unitId: string;
  week: number;
  index: number;
  task: HomeworkTask;
}) {
  return (
    <section className="rounded-card bg-white p-5 shadow-card dark:bg-white/5">
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-sm font-bold text-amber-deep dark:text-amber">{index + 1}</span>
        <p className="font-semibold leading-snug text-navy dark:text-cream">{task.prompt}</p>
      </div>

      {task.type === "checkbox" && (
        <CheckTask studentId={studentId} unitId={unitId} week={week} task={task} />
      )}
      {task.type === "written" && (
        <WrittenTask studentId={studentId} unitId={unitId} week={week} task={task} />
      )}
      {task.type === "voice" && (
        <p className="rounded-lg bg-burgundy/10 px-3 py-2 text-sm text-burgundy dark:text-amber/80">
          🎙️ Record this on your phone&apos;s voice recorder and send it to Rory on WhatsApp.
        </p>
      )}
    </section>
  );
}

function CheckTask({
  studentId,
  unitId,
  week,
  task,
}: {
  studentId: string;
  unitId: string;
  week: number;
  task: HomeworkTask;
}) {
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    setChecked(getTaskChecked(studentId, unitId, week, task.id));
  }, [studentId, unitId, week, task.id]);

  const toggle = () => {
    const next = !checked;
    setChecked(next);
    setTaskChecked(studentId, unitId, week, task.id, next);
    if (next) haptic(12);
  };

  return (
    <button
      onClick={toggle}
      aria-pressed={checked}
      aria-label={`${task.prompt} — ${checked ? "done" : "tap when done"}`}
      className="flex min-h-[44px] w-full items-center gap-3 text-left"
    >
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 transition-colors ${
          checked
            ? "border-green-500 bg-green-500 text-white"
            : "border-navy/30 bg-transparent dark:border-cream/30"
        }`}
        aria-hidden
      >
        {checked ? "✓" : ""}
      </span>
      <span className="text-sm font-medium text-navy-soft dark:text-cream/80">
        {checked ? "Done" : "Tap when done"}
      </span>
    </button>
  );
}

function WrittenTask({
  studentId,
  unitId,
  week,
  task,
}: {
  studentId: string;
  unitId: string;
  week: number;
  task: HomeworkTask;
}) {
  const [value, setValue] = useState("");
  const timer = useRef<number | null>(null);
  const valueRef = useRef("");
  valueRef.current = value;
  const lines = task.lines ?? 3;

  useEffect(() => {
    setValue(getTaskValue(studentId, unitId, week, task.id));
  }, [studentId, unitId, week, task.id]);

  const onChange = (v: string) => {
    setValue(v);
    if (timer.current) window.clearTimeout(timer.current);
    // Debounced autosave (500ms) so we're not writing on every keystroke.
    timer.current = window.setTimeout(() => {
      setTaskValue(studentId, unitId, week, task.id, v);
    }, 500);
  };

  // Flush any pending save on unmount.
  useEffect(() => {
    return () => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        setTaskValue(studentId, unitId, week, task.id, valueRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={lines}
      placeholder="Write your answer here…"
      aria-label={task.prompt}
      className="lined-paper w-full rounded-lg border border-navy/15 p-3 text-base leading-8 text-navy outline-none focus:border-amber dark:border-white/15 dark:text-cream"
    />
  );
}
