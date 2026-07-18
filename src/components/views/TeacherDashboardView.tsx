"use client";

import { useEffect, useState } from "react";
import {
  addStudent,
  assignHomeworkFromDashboard,
  fetchTeacherDashboard,
  setFocusNote,
  type TeacherStudent,
} from "@/lib/remote";
import { ChartIcon, ChevronRightIcon, ChevronLeftIcon } from "@/components/Icons";
import ProgressView from "./ProgressView";

// Persisted in localStorage (not sessionStorage) so Rory stays signed in
// across visits on his own device, matching how the rest of the app treats
// "this device" as trusted. The real gate is the server-side password check
// in Apps Script (getTeacherDashboard_) — this key is only a cache of a
// secret that's already been verified once.
const STORAGE_KEY = "re_teacher_secret";

// A student is flagged "quiet" once nothing has synced in this many days —
// framed for the tutor as "worth checking in", not a punitive metric.
const QUIET_DAYS = 7;

type LoadState = "idle" | "loading" | "ok" | "error";

export default function TeacherDashboardView() {
  const [ready, setReady] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [students, setStudents] = useState<TeacherStudent[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | undefined>();
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [showFullProgress, setShowFullProgress] = useState(false);
  const [addingStudent, setAddingStudent] = useState(false);

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
    setShowFullProgress(false);
  }

  /** Patches one student's cached fields locally after a successful save, so
   * re-opening their panel (without a full re-fetch) shows the new value. */
  function patchStudent(code: string, patch: Partial<TeacherStudent>) {
    setStudents((prev) => (prev ? prev.map((s) => (s.code === code ? { ...s, ...patch } : s)) : prev));
  }

  if (!ready) return null;
  if (!secret) return <PasswordGate input={input} setInput={setInput} authing={authing} authError={authError} onSubmit={submitGate} />;

  const selected = selectedCode ? students?.find((x) => x.code === selectedCode) ?? null : null;

  // Drill-down: full per-student progress (same tables the student/parent see).
  if (secret && loadState === "ok" && selected && showFullProgress) {
    return (
      <ProgressView
        fetchCode={selected.code}
        displayName={selected.name}
        mode="teacher"
        onBack={() => setShowFullProgress(false)}
      />
    );
  }

  // Mid-level: one student's quick-action panel (note + assign + triage).
  if (secret && loadState === "ok" && selected) {
    return (
      <TeacherStudentPanel
        secret={secret}
        student={selected}
        onBack={() => setSelectedCode(null)}
        onViewProgress={() => setShowFullProgress(true)}
        onPatch={(patch) => patchStudent(selected.code, patch)}
      />
    );
  }

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

        {loadState === "ok" && students && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {students.length === 0 && (
              <p className="col-span-full rounded-card bg-surface p-5 text-center text-navy-soft shadow-card dark:bg-navy-raised dark:text-navy-mist dark:shadow-card-dark">
                No students configured yet.
              </p>
            )}
            {students.map((s) => (
              <StudentCard key={s.code} student={s} onOpen={() => setSelectedCode(s.code)} />
            ))}
            <button
              type="button"
              onClick={() => setAddingStudent(true)}
              className="flex min-h-[9rem] flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-amber-deep/40 p-4 text-amber-deep transition ease-out2026 duration-200 active:scale-[.97] dark:border-amber/40 dark:text-amber"
            >
              <span className="text-2xl leading-none" aria-hidden>+</span>
              <span className="text-sm font-bold">Add student</span>
            </button>
          </div>
        )}
      </main>

      {addingStudent && (
        <AddStudentSheet
          secret={secret}
          onClose={() => setAddingStudent(false)}
          onAdded={(s) =>
            setStudents((prev) => [...(prev ?? []), { code: s.code, name: s.name, summary: null, focusNote: "" }])
          }
        />
      )}
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
  const quiet = s?.daysSinceActivity != null && s.daysSinceActivity >= QUIET_DAYS;
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
          <div className="flex items-center justify-between gap-2">
            <p className="tnum text-xs text-navy-soft dark:text-navy-mist">Updated {s.lastUpdated}</p>
            {quiet && (
              <span className="tnum shrink-0 rounded-full bg-warn-soft px-2 py-0.5 text-[0.625rem] font-bold text-warn dark:bg-warn-dusk dark:text-warn-bright">
                Quiet {s.daysSinceActivity}d
              </span>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-navy-soft dark:text-navy-mist">Not set up yet</p>
      )}
      {student.focusNote && (
        <p className="truncate text-xs text-amber-deep dark:text-amber">📌 {student.focusNote}</p>
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

// ── One student's quick-action panel ────────────────────────────────────────
function TeacherStudentPanel({
  secret,
  student,
  onBack,
  onViewProgress,
  onPatch,
}: {
  secret: string;
  student: TeacherStudent;
  onBack: () => void;
  onViewProgress: () => void;
  onPatch: (patch: Partial<TeacherStudent>) => void;
}) {
  const [note, setNote] = useState(student.focusNote);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [due, setDue] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignedFlash, setAssignedFlash] = useState(false);

  async function saveNote() {
    setNoteSaving(true);
    setNoteSaved(false);
    setNoteError(null);
    const trimmed = note.trim();
    const r = await setFocusNote(secret, student.code, trimmed);
    setNoteSaving(false);
    if (r.ok) {
      onPatch({ focusNote: trimmed });
      setNote(trimmed); // normalize local state to what was actually saved,
      // so the Save button's dirty-check (below) reflects reality even if
      // the teacher typed trailing whitespace.
      setNoteSaved(true);
      window.setTimeout(() => setNoteSaved(false), 2000);
    } else {
      setNoteError("Couldn't save that note — try again.");
    }
  }

  async function submitAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setAssigning(true);
    setAssignError(null);
    const r = await assignHomeworkFromDashboard(secret, student.code, title.trim(), details.trim(), due.trim());
    setAssigning(false);
    if (r.ok) {
      setTitle("");
      setDetails("");
      setDue("");
      setAssignedFlash(true);
      window.setTimeout(() => setAssignedFlash(false), 2000);
    } else {
      setAssignError("Couldn't assign that — try again.");
    }
  }

  const s = student.summary;

  return (
    <>
      <header
        className="sticky top-0 z-10 flex items-center gap-2 bg-cream px-3 pb-3 dark:bg-navy"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to students"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-navy-soft transition hover:bg-black/5 active:scale-[.97] dark:text-navy-mist dark:hover:bg-white/10"
        >
          <ChevronLeftIcon />
        </button>
        <h1 className="display truncate text-2xl text-navy dark:text-cream">{student.name}</h1>
      </header>

      <main className="px-5 pb-10">
        <button
          type="button"
          onClick={onViewProgress}
          className="flex w-full items-center justify-between gap-3 rounded-card bg-surface p-4 shadow-card transition active:scale-[.97] dark:bg-navy-raised dark:shadow-card-dark"
        >
          <span className="font-bold text-navy dark:text-cream">View full progress</span>
          <ChevronRightIcon className="shrink-0 text-navy-soft dark:text-navy-mist" />
        </button>
        {s?.lastUpdated && (
          <p className="tnum mt-2 text-center text-xs text-navy-soft dark:text-navy-mist">
            Last activity {s.lastUpdated}
            {s.daysSinceActivity != null && s.daysSinceActivity >= QUIET_DAYS ? ` · ${s.daysSinceActivity} days ago` : ""}
          </p>
        )}

        {/* Focus note — surfaces on the student's Today screen AND is woven
            into their next AI-tutor/writing-coach reply as soft context. */}
        <section className="mt-5">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy-soft dark:text-navy-mist">
            Focus note
          </h2>
          <div className="rounded-card bg-surface p-4 shadow-card dark:bg-navy-raised dark:shadow-card-dark">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Great with past tenses now — let's work on conditionals next"
              rows={3}
              maxLength={500}
              className="w-full resize-none rounded-lg bg-transparent text-sm text-navy outline-none placeholder:text-navy-soft dark:text-cream dark:placeholder:text-navy-mist"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs text-navy-soft dark:text-navy-mist">Shown to {student.name} on their Today screen.</p>
              <button
                type="button"
                onClick={saveNote}
                disabled={noteSaving || note.trim() === student.focusNote}
                className="shrink-0 rounded-lg bg-amber-deep px-3 py-1.5 text-xs font-bold text-white transition active:scale-[.97] disabled:opacity-40 dark:bg-amber dark:text-navy"
              >
                {noteSaving ? "Saving…" : noteSaved ? "Saved ✓" : "Save"}
              </button>
            </div>
            {noteError && <p className="mt-2 text-xs text-bad dark:text-bad-bright">{noteError}</p>}
          </div>
        </section>

        {/* Assign homework — appears in the student's Homework tab immediately. */}
        <section className="mt-5">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy-soft dark:text-navy-mist">
            Assign homework
          </h2>
          <form
            onSubmit={submitAssign}
            className="space-y-3 rounded-card bg-surface p-4 shadow-card dark:bg-navy-raised dark:shadow-card-dark"
          >
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (e.g. Read Unit 11 pages 4–6)"
              maxLength={200}
              className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm text-navy outline-none placeholder:text-navy-soft dark:border-white/10 dark:text-cream dark:placeholder:text-navy-mist"
            />
            <input
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Details (optional)"
              maxLength={500}
              className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm text-navy outline-none placeholder:text-navy-soft dark:border-white/10 dark:text-cream dark:placeholder:text-navy-mist"
            />
            <input
              value={due}
              onChange={(e) => setDue(e.target.value)}
              placeholder="Due (optional, e.g. Mon 24 Aug)"
              maxLength={40}
              className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm text-navy outline-none placeholder:text-navy-soft dark:border-white/10 dark:text-cream dark:placeholder:text-navy-mist"
            />
            {assignError && <p className="text-sm text-bad dark:text-bad-bright">{assignError}</p>}
            <button
              type="submit"
              disabled={assigning || !title.trim()}
              className="w-full rounded-lg bg-[linear-gradient(135deg,#4F46E5,#4338CA)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_1px_2px_rgba(0,0,0,.06),0_4px_12px_-4px_#4F46E5] transition active:scale-[.97] disabled:opacity-40 dark:bg-none dark:bg-amber dark:text-navy dark:shadow-none"
            >
              {assigning ? "Assigning…" : assignedFlash ? "Assigned ✓" : "Assign"}
            </button>
          </form>
        </section>
      </main>
    </>
  );
}

// ── Add-student sheet ────────────────────────────────────────────────────────
function AddStudentSheet({
  secret,
  onClose,
  onAdded,
}: {
  secret: string;
  onClose: () => void;
  onAdded: (s: { code: string; parentCode: string; name: string }) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ code: string; parentCode: string; name: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const r = await addStudent(secret, name.trim());
    setBusy(false);
    if (r.ok && r.code && r.parentCode && r.name) {
      const added = { code: r.code, parentCode: r.parentCode, name: r.name };
      setResult(added);
      onAdded(added);
    } else {
      // The backend's own validation messages ("enter a valid first name",
      // "a student named X already exists…") are already written for a human
      // reader — surface them as-is instead of hand-mapping a subset of
      // strings (that mapping previously matched nothing Code.gs actually
      // sends). Only the generic failure modes get a friendlier gloss.
      const raw = r.error || "";
      setError(
        raw === "unauthorized" || raw === "internal error" || !raw
          ? "Couldn't add that student — try again."
          : raw,
      );
    }
  }

  function copy(text: string, label: string) {
    if (!navigator.clipboard) {
      setCopyError(label);
      return;
    }
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopyError(null);
        setCopied(label);
        window.setTimeout(() => setCopied(null), 1500);
      })
      .catch(() => setCopyError(label));
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" onClick={result ? undefined : onClose}>
      <div
        className="animate-sheet w-full max-w-sm rounded-t-2xl bg-surface p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-card dark:bg-navy-raised dark:shadow-card-dark sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-navy/20 dark:bg-cream/20 sm:hidden" />

        {!result ? (
          <>
            <h2 className="display text-xl text-navy dark:text-cream">Add student</h2>
            <p className="mt-1 text-sm text-navy-soft dark:text-navy-mist">
              Creates their Drive folder + progress Sheet right away. Their app link still needs one deploy —
              see scripts/add-student.mjs.
            </p>
            <form onSubmit={submit} className="mt-4 space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="First name"
                autoFocus
                maxLength={60}
                className="w-full rounded-xl border border-black/10 bg-transparent px-4 py-3 text-navy outline-none placeholder:text-navy-soft dark:border-white/10 dark:text-cream dark:placeholder:text-navy-mist"
              />
              {error && <p className="text-sm text-bad dark:text-bad-bright">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl bg-black/5 px-4 py-3 font-bold text-navy-soft transition active:scale-[.97] dark:bg-white/10 dark:text-navy-mist"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || !name.trim()}
                  className="flex-1 rounded-xl bg-[linear-gradient(135deg,#4F46E5,#4338CA)] px-4 py-3 font-bold text-white shadow-[0_1px_2px_rgba(0,0,0,.06),0_4px_12px_-4px_#4F46E5] transition active:scale-[.97] disabled:opacity-40 dark:bg-none dark:bg-amber dark:text-navy dark:shadow-none"
                >
                  {busy ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h2 className="display text-xl text-navy dark:text-cream">{result.name} is set up</h2>
            <p className="mt-1 text-sm text-navy-soft dark:text-navy-mist">
              These codes are shown once — copy them now (or tap a code to select it). The student code is their app
              link; the parent code is read-only.
            </p>
            <div className="mt-4 space-y-2">
              <CodeRow
                label="Student code"
                value={result.code}
                onCopy={() => copy(result.code, "code")}
                copied={copied === "code"}
                failed={copyError === "code"}
              />
              <CodeRow
                label="Parent code"
                value={result.parentCode}
                onCopy={() => copy(result.parentCode, "parent")}
                copied={copied === "parent"}
                failed={copyError === "parent"}
              />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-xl bg-[linear-gradient(135deg,#4F46E5,#4338CA)] px-4 py-3 font-bold text-white shadow-[0_1px_2px_rgba(0,0,0,.06),0_4px_12px_-4px_#4F46E5] transition active:scale-[.97] dark:bg-none dark:bg-amber dark:text-navy dark:shadow-none"
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function CodeRow({
  label,
  value,
  onCopy,
  copied,
  failed,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
  failed: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-soft p-3 dark:bg-amber-dusk">
      <div className="min-w-0">
        <p className="text-[0.625rem] font-bold uppercase tracking-wide text-navy-soft dark:text-navy-mist">{label}</p>
        {/* select-all: a tap/click selects the whole code — the fallback when
            the Copy button's clipboard write silently isn't available. */}
        <p className="tnum select-all truncate font-mono text-sm font-bold text-navy dark:text-cream">{value}</p>
        {failed && (
          <p className="text-[0.625rem] font-medium text-bad dark:text-bad-bright">Couldn&apos;t copy — tap the code above to select it, then copy manually.</p>
        )}
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="shrink-0 rounded-lg bg-amber-deep px-3 py-1.5 text-xs font-bold text-white transition active:scale-[.97] dark:bg-amber dark:text-navy"
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}
