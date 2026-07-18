"use client";

import { useEffect, useState } from "react";
import { fetchTeacherDashboard, type TeacherStudent } from "@/lib/remote";
import { ChartIcon, ChevronRightIcon } from "@/components/Icons";
import ProgressView from "./ProgressView";

// Persisted in localStorage (not sessionStorage) so Rory stays signed in
// across visits on his own device, matching how the rest of the app treats
// "this device" as trusted. The real gate is the server-side password check
// in Apps Script (getTeacherDashboard_) — this key is only a cache of a
// secret that's already been verified once.
const STORAGE_KEY = "re_teacher_secret";

type LoadState = "idle" | "loading" | "ok" | "error";

export default function TeacherDashboardView() {
  const [ready, setReady] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [students, setStudents] = useState<TeacherStudent[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | undefined>();
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const [authing, setAuthing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Read any previously-verified password once on mount (pre-paint gate flash
  // isn't worth solving here — this page is never linked from student flows).
  useEffect(() => {
    setSecret(window.localStorage.getItem(STORAGE_KEY));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!secret) return;
    let live = true;
    setLoadState("loading");
    fetchTeacherDashboard(secret)
      .then((d) => {
        if (!live) return;
        if (d.ok) {
          setStudents(d.students ?? []);
          setGeneratedAt(d.generatedAt);
          setLoadState("ok");
        } else {
          // Stored password no longer valid (e.g. Rory rotated it) — drop it
          // and fall back to the gate rather than looping on a 401.
          window.localStorage.removeItem(STORAGE_KEY);
          setSecret(null);
          setLoadState("idle");
        }
      })
      .catch(() => live && setLoadState("error"));
    return () => {
      live = false;
    };
  }, [secret]);

  async function submitGate(e: React.FormEvent) {
    e.preventDefault();
    const attempt = input.trim();
    if (!attempt) return;
    setAuthing(true);
    setAuthError(null);
    const d = await fetchTeacherDashboard(attempt);
    setAuthing(false);
    if (d.ok) {
      window.localStorage.setItem(STORAGE_KEY, attempt);
      setStudents(d.students ?? []);
      setGeneratedAt(d.generatedAt);
      setLoadState("ok");
      setSecret(attempt);
      setInput("");
    } else {
      setAuthError("Wrong password. Try again.");
    }
  }

  function signOut() {
    window.localStorage.removeItem(STORAGE_KEY);
    setSecret(null);
    setStudents(null);
    setLoadState("idle");
    setSelectedCode(null);
  }

  if (!ready) return null;

  // Drill-down into one student's full progress.
  if (secret && loadState === "ok" && selectedCode) {
    const s = students?.find((x) => x.code === selectedCode);
    return (
      <ProgressView
        fetchCode={selectedCode}
        displayName={s?.name ?? "Student"}
        mode="teacher"
        onBack={() => setSelectedCode(null)}
      />
    );
  }

  if (!secret) return <PasswordGate input={input} setInput={setInput} authing={authing} authError={authError} onSubmit={submitGate} />;

  return (
    <>
      <header
        className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-cream px-5 pb-3 dark:bg-navy"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
      >
        <div className="min-w-0">
          <h1 className="display text-2xl text-navy dark:text-cream">Students</h1>
          {generatedAt && <p className="tnum mt-0.5 text-sm text-navy-soft dark:text-navy-mist">Updated {generatedAt}</p>}
        </div>
        <button
          type="button"
          onClick={signOut}
          className="shrink-0 rounded-full px-3 py-2 text-xs font-semibold text-navy-soft transition ease-out2026 duration-200 hover:bg-black/5 active:scale-[.97] dark:text-navy-mist dark:hover:bg-white/10"
        >
          Sign out
        </button>
      </header>

      <main className="px-5 pb-10">
        {loadState === "loading" && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-card bg-surface shadow-card dark:bg-navy-raised dark:shadow-card-dark"
              />
            ))}
          </div>
        )}

        {loadState === "error" && (
          <p className="mt-6 rounded-card bg-surface p-5 text-center text-navy-soft shadow-card dark:bg-navy-raised dark:text-navy-mist dark:shadow-card-dark">
            Couldn&apos;t load the dashboard right now. Check your connection and try again.
          </p>
        )}

        {loadState === "ok" && students?.length === 0 && (
          <p className="mt-6 rounded-card bg-surface p-5 text-center text-navy-soft shadow-card dark:bg-navy-raised dark:text-navy-mist dark:shadow-card-dark">
            No students configured yet.
          </p>
        )}

        {loadState === "ok" && students && students.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {students.map((s) => (
              <StudentCard key={s.code} student={s} onOpen={() => setSelectedCode(s.code)} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function PasswordGate({
  input,
  setInput,
  authing,
  authError,
  onSubmit,
}: {
  input: string;
  setInput: (v: string) => void;
  authing: boolean;
  authError: string | null;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-18%] h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,.10),transparent_70%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(139,92,246,.16),transparent_70%)]" />
        <div className="absolute left-1/2 top-[-6%] h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(79,70,229,.14),transparent_70%)] blur-2xl dark:bg-[radial-gradient(circle,rgba(79,70,229,.22),transparent_70%)]" />
      </div>
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-soft text-amber-deep dark:bg-amber-dusk dark:text-amber">
        <ChartIcon />
      </span>
      <h1 className="display text-2xl text-navy dark:text-cream">Teacher dashboard</h1>
      <p className="max-w-xs text-sm text-navy-soft dark:text-navy-mist">
        Enter the teacher password to see every student&apos;s progress in one place.
      </p>
      <form onSubmit={onSubmit} className="flex w-full max-w-xs flex-col gap-3">
        <input
          type="password"
          autoComplete="current-password"
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Password"
          className="w-full rounded-xl border border-black/10 bg-surface px-4 py-3 text-center text-navy shadow-card outline-none dark:border-white/10 dark:bg-navy-raised dark:text-cream dark:shadow-card-dark"
        />
        {authError && <p className="text-sm text-bad dark:text-bad-bright">{authError}</p>}
        <button
          type="submit"
          disabled={authing || !input.trim()}
          className="rounded-xl bg-[linear-gradient(135deg,#4F46E5,#4338CA)] px-5 py-3 font-bold text-white shadow-[0_1px_2px_rgba(0,0,0,.06),0_4px_12px_-4px_#4F46E5] transition ease-out2026 duration-200 active:scale-[.97] disabled:opacity-50 dark:bg-none dark:bg-amber dark:text-navy dark:shadow-none"
        >
          {authing ? "Checking…" : "Enter"}
        </button>
      </form>
    </main>
  );
}

function StudentCard({ student, onOpen }: { student: TeacherStudent; onOpen: () => void }) {
  const s = student.summary;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col gap-3 rounded-card bg-surface p-4 text-left shadow-card transition ease-out2026 duration-200 active:scale-[.97] dark:bg-navy-raised dark:shadow-card-dark"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="display text-lg text-navy dark:text-cream">{student.name}</span>
        <ChevronRightIcon className="shrink-0 text-navy-soft dark:text-navy-mist" />
      </div>
      {s ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="HW" value={String(s.homeworkDone)} />
            <Stat label="Best quiz" value={s.bestQuizPct === "—" || s.bestQuizPct === "" ? "—" : `${s.bestQuizPct}%`} />
            <Stat label="Writing" value={String(s.writingSamples)} />
          </div>
          <p className="tnum text-xs text-navy-soft dark:text-navy-mist">Updated {s.lastUpdated}</p>
        </>
      ) : (
        <p className="text-sm text-navy-soft dark:text-navy-mist">Not set up yet</p>
      )}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-amber-soft p-2 text-center dark:bg-amber-dusk">
      <div className="tnum text-base font-extrabold text-navy dark:text-cream">{value}</div>
      <div className="text-[0.625rem] font-medium uppercase tracking-wide text-navy-soft dark:text-navy-mist">
        {label}
      </div>
    </div>
  );
}
