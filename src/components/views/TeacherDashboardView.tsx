"use client";

import { useEffect, useState } from "react";
import {
  addStudent,
  analyseWriting,
  assignHomeworkFromDashboard,
  fetchTeacherDashboard,
  logMockTest,
  logSchoolTest,
  setFocusNote,
  type WritingAssessment,
  type TeacherStudent,
} from "@/lib/remote";
import { ChartIcon, ChevronRightIcon, ChevronLeftIcon, BookIcon, CheckSquareIcon } from "@/components/Icons";
import ProgressView from "./ProgressView";
import { login, savedSession, forgetSession } from "@/lib/api";
import { publishAssessment } from "@/lib/remote";
import { VoiceStudio } from "./SpeakView";
import DocumentsView from "./DocumentsView";
import LearningView from "./LearningView";
import TeachingProgress from "./TeachingProgress";
import TeacherReviewPanel from "./TeacherReviewPanel";
import AppMenu from "@/components/AppMenu";
import ProfileAvatar from "@/components/ProfileAvatar";
import QuickAppearance from "@/components/QuickAppearance";
import StudentPreviewButton from "@/components/StudentPreviewButton";
import studentRoster from "../../../content/students.json";

// One-time removal of the old persisted password; only expiring tokens remain.
const STORAGE_KEY = "re_teacher_secret";

type LoadState = "idle" | "loading" | "ok" | "error";

export default function TeacherDashboardView() {
  const [testingVoice, setTestingVoice] = useState(false);
  const [ready, setReady] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [students, setStudents] = useState<TeacherStudent[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | undefined>();
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [showFullProgress, setShowFullProgress] = useState(false);
  const [addingStudent, setAddingStudent] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [input, setInput] = useState("");
  const [authing, setAuthing] = useState(false);
  const [rememberTeacher,setRememberTeacher]=useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Read any previously-verified password once on mount (pre-paint gate flash
  // isn't worth solving here — this page is never linked from student flows).
  useEffect(() => {
    try {window.localStorage.removeItem(STORAGE_KEY);} catch { /* no stored password */ }
    const refresh=()=>setSecret(savedSession("__teacher__")?.token || null);
    refresh();window.addEventListener("re-auth-change",refresh);
    const timer=setInterval(refresh,30000);
    setReady(true);
    return()=>{window.removeEventListener("re-auth-change",refresh);clearInterval(timer);};
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
        } else if(d.authRequired) {
          // Stored password no longer valid (e.g. Rory rotated it) — drop it
          // and fall back to the gate rather than looping on a 401.
          forgetSession("__teacher__");
          setSecret(null);
          setLoadState("idle");
        } else {
          setLoadState("error");
        }
      })
      .catch(() => live && setLoadState("error"));
    return () => {
      live = false;
    };
  }, [secret, refreshKey]);

  async function submitGate(e: React.FormEvent) {
    e.preventDefault();
    const attempt = input.trim();
    if (!attempt) return;
    setAuthing(true);
    setAuthError(null);
    const session = await login("__teacher__", attempt, rememberTeacher);
    setAuthing(false);
    if (session.ok) {
      // The session effect loads the dashboard once after sign-in.
      setSecret(session.token);
      setInput("");
    } else {
      setAuthError(session.error || "Could not sign in. Please try again.");
    }
  }

  /** Patches one student's cached fields locally after a successful save, so
   * re-opening their panel (without a full re-fetch) shows the new value. */
  function patchStudent(code: string, patch: Partial<TeacherStudent>) {
    setStudents((prev) => (prev ? prev.map((s) => (s.code === code ? { ...s, ...patch } : s)) : prev));
  }

  if (!ready) return null;
  if (!secret) return <PasswordGate input={input} setInput={setInput} authing={authing} authError={authError} remember={rememberTeacher} setRemember={setRememberTeacher} onSubmit={submitGate} />;

  if (testingVoice) return <div className="teacher-workspace">
    <header className="teacher-topbar"><button type="button" className="teacher-quiet-button" onClick={() => setTestingVoice(false)}>← Back to teacher dashboard</button><div className="flex items-center gap-2"><QuickAppearance/><AppMenu teacher/></div></header>
    <VoiceStudio code="__teacher__" lines={[]} teacherTest practiceOptions={studentRoster.map(s => ({ code: s.code, name: s.displayName, unit: s.units.find(u => u.active)?.title }))} />
  </div>;

  const selected = selectedCode ? students?.find((x) => x.code === selectedCode) ?? null : null;

  // Drill-down: full per-student progress (same tables the student/parent see).
  if (secret && loadState === "ok" && selected && showFullProgress) {
    return (
      <div><div className="flex justify-end px-5 pt-3"><QuickAppearance/><AppMenu teacher/></div><ProgressView
        fetchCode={selected.code}
        displayName={selected.name}
        mode="teacher"
        onBack={() => setShowFullProgress(false)}
      /></div>
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
    <div className="teacher-workspace">
      <header className="teacher-topbar">
        <a href="/teacher/" className="teacher-brand"><span aria-hidden>r.</span><div>Rory’s English<small>TEACHER WORKSPACE</small></div></a>
        <div className="flex items-center gap-2">
          <button type="button" disabled={loadState === "loading"} onClick={() => setRefreshKey(k => k + 1)} className="teacher-quiet-button">{loadState === "loading" ? "Refreshing…" : "Refresh"}</button>
          <QuickAppearance/><AppMenu teacher/>
        </div>
      </header>
      <main>
        <section className="teacher-welcome">
          <div>
            <p className="teacher-eyebrow">YOUR TEACHING, AT A GLANCE</p>
            <h1>Room to learn.<br/><span>Space to grow.</span></h1>
            <p>Welcome back, Rory. Choose a student to review their work,<br className="hidden sm:block"/> give feedback or plan their next step.</p>
          </div>
          <div className="teacher-book-art" aria-hidden="true"><BookIcon/><span className="teacher-art-star">✦</span><span className="teacher-art-note"><CheckSquareIcon/> A little practice.<br/>A little progress.</span></div>
        </section>
        <section className="re-card mb-6"><h2>Try the speaking partner</h2><p>Test a live AI conversation yourself before a lesson. Your test stays separate from student work.</p><button type="button" className="teacher-primary mt-3" onClick={() => setTestingVoice(true)}>Test AI voice</button></section>
        {loadState === "loading" && <div className="teacher-student-grid" role="status" aria-label="Loading students">{[0,1].map(i=><div key={i} className="h-72 animate-pulse rounded-card bg-amber-soft dark:bg-amber-dusk"/>)}</div>}
        {loadState === "error" && <div className="teacher-empty" role="alert"><ChartIcon/><h2>Let’s try that again</h2><p>Your students’ records could not be loaded.</p><button className="teacher-primary" onClick={()=>setRefreshKey(k=>k+1)}>Reload students</button></div>}
        {loadState === "ok" && students && <>
          <div className="teacher-section-heading"><div><p className="teacher-eyebrow">ONE STEP AT A TIME</p><h2>Your students <span>{students.length}</span></h2></div><button type="button" onClick={()=>setAddingStudent(true)} className="teacher-quiet-button">+ Add student</button></div>
          <div className="teacher-student-grid">
            {students.length===0 && <div className="teacher-empty"><BookIcon/><h2>Your classroom starts here</h2><p>Add your first student to get started.</p></div>}
            {students.map(student=><StudentCard key={student.code} student={student} onOpen={()=>setSelectedCode(student.code)}/>)}
          </div>
          <TeachingProgress students={students} onOpen={setSelectedCode}/>
          <div className="teacher-bottom-note"><CheckSquareIcon/><p>Review the work. Celebrate the effort. Choose the next step.<small>Figures include earlier records. A best quiz score is a snapshot, not a measure of mastery.</small></p></div>
          {generatedAt && <p className="teacher-updated">Records updated {generatedAt}</p>}
        </>}
      </main>
      {addingStudent && <AddStudentSheet secret={secret} onClose={()=>setAddingStudent(false)} onAdded={s=>setStudents(prev=>[...(prev??[]),{code:s.code,name:s.name,summary:null,focusNote:""}])}/>}
    </div>
  );
}

function PasswordGate({
  input,
  setInput,
  authing,
  authError,
  remember,
  setRemember,
  onSubmit,
}: {
  input: string;
  setInput: (v: string) => void;
  authing: boolean;
  authError: string | null;
  remember: boolean;
  setRemember: (v: boolean) => void;
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
        <label className="flex items-center gap-2 text-left text-sm"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/>Keep me signed in on this device for up to six hours</label>
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

function ScoreRing({ value }: { value: number | string | undefined }) {
  const numeric = value !== undefined && String(value).trim() !== "" ? Number(value) : NaN;
  const score = Number.isFinite(numeric) && numeric >= 0 && numeric <= 100 ? numeric : null;
  return <div className="teacher-score" aria-label={score === null ? "No quiz score recorded" : `Best quiz score: ${score}%`}>
    <svg viewBox="0 0 100 100" aria-hidden="true"><circle className="teacher-score-track" cx="50" cy="50" r="42"/><circle className="teacher-score-fill" cx="50" cy="50" r="42" pathLength="100" strokeDasharray={`${score ?? 0} 100`}/></svg>
    <div><strong>{score === null ? "—" : `${score}%`}</strong><small>Best quiz</small></div>
  </div>;
}
function StudentCard({ student, onOpen }: { student: TeacherStudent; onOpen: () => void }) {
  const s = student.summary;
  const unit = studentRoster.find(entry=>entry.code===student.code)?.units.find(unit=>unit.active);
  return <button type="button" onClick={onOpen} className={`teacher-student-card ${student.code.startsWith("ferdi-") ? "teacher-blue" : "teacher-lilac"}`} aria-label={`Open ${student.name}’s teaching workspace`}>
    <div className="teacher-card-heading"><ProfileAvatar code={student.code} name={student.name} className="teacher-avatar"/><div><h3>{student.name}</h3><p>{unit?.title || "Ready for a new chapter"}</p></div><ChevronRightIcon className="ml-auto shrink-0"/></div>
    <div className="teacher-card-data"><ScoreRing value={s?.bestQuizPct}/><div className="teacher-card-counts"><div><CheckSquareIcon/><span><strong>{s?.homeworkDone ?? "—"}</strong> homework recorded</span></div><div><BookIcon/><span><strong>{s?.writingSamples ?? "—"}</strong> writing samples</span></div><div><ChartIcon/><span><strong>{s?.quizRounds ?? "—"}</strong> quiz rounds</span></div></div></div>
    <div className="teacher-focus"><span>{student.focusNote ? "CURRENT FOCUS" : "NEXT STEP"}</span><p>{student.focusNote || "Open their workspace to review answers or assign a little practice."}</p></div>
    <div className="teacher-card-footer"><span>{s?.lastUpdated ? `Last activity ${s.lastUpdated}` : "No activity recorded yet"}</span><strong>Open workspace <span aria-hidden>↗</span></strong></div>
  </button>;
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
  const [section, setSection] = useState<"review" | "assign" | "assess" | "documents" | "learning">("review");
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
    <div className="teacher-workspace">
      <header className="teacher-topbar">
        <button type="button" onClick={onBack} className="teacher-quiet-button flex items-center gap-2"><ChevronLeftIcon/>All students</button>
        <QuickAppearance/><AppMenu teacher/>
      </header>
      <main>
        <section className={`teacher-student-banner ${student.code.startsWith("ferdi-") ? "teacher-blue" : "teacher-lilac"}`}>
          <div className="teacher-banner-name"><ProfileAvatar code={student.code} name={student.name} editable className="teacher-avatar"/><div><p className="teacher-eyebrow">STUDENT WORKSPACE</p><h1>{student.name}</h1><p>{s?.lastUpdated ? `Last activity ${s.lastUpdated}` : "Ready for the first step"}</p></div></div>
          <button type="button" onClick={onViewProgress} className="teacher-progress-button"><ScoreRing value={s?.bestQuizPct}/><span>Full progress <span aria-hidden>↗</span></span></button>
        </section>
        <div className="mb-4 flex justify-end"><StudentPreviewButton code={student.code} name={student.name}/></div>
        <nav className="teacher-section-nav" aria-label="Student workspace sections">
          <button type="button" aria-pressed={section === "learning"} onClick={()=>setSection("learning")}><ChartIcon/><span>Learning reviews<small>Writing, speaking & lessons</small></span></button>
          <button type="button" aria-pressed={section === "documents"} onClick={()=>setSection("documents")}><BookIcon/><span>Documents<small>Scan, upload & discuss</small></span></button>
          <button type="button" aria-pressed={section === "review"} onClick={()=>setSection("review")}><CheckSquareIcon/><span>Work & feedback<small>Read, respond, encourage</small></span></button>
          <button type="button" aria-pressed={section === "assign"} onClick={()=>setSection("assign")}><BookIcon/><span>Plan homework<small>Set the next step</small></span></button>
          <button type="button" aria-pressed={section === "assess"} onClick={()=>setSection("assess")}><ChartIcon/><span>Assessments<small>Record & reflect</small></span></button>
        </nav>
        {section === "documents" && <DocumentsView key={student.code} code={student.code} name={student.name} teacher/>}
        {section === "learning" && <LearningView key={student.code} code={student.code} name={student.name} mode="teacher"/>}
        <div hidden={section !== "review"}><TeacherReviewPanel code={student.code}/></div>
        <div hidden={section !== "assign"}>
        <div className="teacher-form-grid">
        {/* Focus note — surfaces on the student's Today screen AND is woven
            into their next AI-tutor/writing-coach reply as soft context. */}
        <section className="mt-5">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy-soft dark:text-navy-mist">
            Focus note
          </h2>
          <div className="rounded-card bg-surface p-4 shadow-card dark:bg-navy-raised dark:shadow-card-dark">
            <textarea
              aria-label="Student focus note"
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
              aria-label="Homework title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (e.g. Read Unit 11 pages 4–6)"
              maxLength={200}
              className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm text-navy outline-none placeholder:text-navy-soft dark:border-white/10 dark:text-cream dark:placeholder:text-navy-mist"
            />
            <input
              aria-label="Homework instructions"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Details (optional)"
              maxLength={500}
              className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm text-navy outline-none placeholder:text-navy-soft dark:border-white/10 dark:text-cream dark:placeholder:text-navy-mist"
            />
            <input
              aria-label="Homework due date (optional)"
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

        </div>
        </div>
        <div hidden={section !== "assess"} className="teacher-assessments">
          <p className="teacher-section-intro">Keep a record of school results and your own feedback. Choose what you’d like to add.</p>
          <details open><summary><CheckSquareIcon/>School test<span>Record a result</span></summary><SchoolTestForm secret={secret} code={student.code}/></details>
          <details><summary><ChartIcon/>Mock exam<span>Practise for the real thing</span></summary><MockTestForm secret={secret} code={student.code}/></details>
          <details><summary><BookIcon/>Writing feedback<span>Prepare and review an AI draft</span></summary><WritingAnalysisForm secret={secret} code={student.code}/></details>
        </div>
      </main>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm text-navy outline-none placeholder:text-navy-soft dark:border-white/10 dark:text-cream dark:placeholder:text-navy-mist";
const primaryBtnCls =
  "w-full rounded-lg bg-[linear-gradient(135deg,#4F46E5,#4338CA)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_1px_2px_rgba(0,0,0,.06),0_4px_12px_-4px_#4F46E5] transition active:scale-[.97] disabled:opacity-40 dark:bg-none dark:bg-amber dark:text-navy dark:shadow-none";
// Plain non-negative decimal only — Number() alone would silently accept
// "1e5" (100000) or "0x10" (16) as a valid score, which a typo could produce
// with no warning. A test/mock-exam score realistically never exceeds 999.
const SCORE_RE = /^\d{1,3}(\.\d+)?$/;
function validScore(raw: string): boolean {
  return SCORE_RE.test(raw.trim());
}

function SchoolTestForm({ secret, code }: { secret: string; code: string }) {
  const [test, setTest] = useState("");
  const [score, setScore] = useState("");
  const [max, setMax] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  const scoreN = Number(score);
  const maxN = Number(max);
  const valid = Boolean(test.trim()) && validScore(score) && validScore(max) && maxN > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    const r = await logSchoolTest(secret, code, test.trim(), scoreN, maxN, notes.trim());
    setBusy(false);
    if (r.ok) {
      setTest("");
      setScore("");
      setMax("");
      setNotes("");
      setFlash(true);
      window.setTimeout(() => setFlash(false), 2000);
    } else {
      setError("Couldn't log that — try again.");
    }
  }

  return (
    <section className="mt-5">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy-soft dark:text-navy-mist">
        Log a school test
      </h2>
      <form onSubmit={submit} className="space-y-3 rounded-card bg-surface p-4 shadow-card dark:bg-navy-raised dark:shadow-card-dark">
        <input value={test} onChange={(e) => setTest(e.target.value)} placeholder="Test name (e.g. Schularbeit 3)" maxLength={200} className={inputCls} />
        <div className="flex gap-3">
          <input value={score} onChange={(e) => setScore(e.target.value)} placeholder="Score" inputMode="decimal" className={inputCls} />
          <input value={max} onChange={(e) => setMax(e.target.value)} placeholder="Max" inputMode="decimal" className={inputCls} />
        </div>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" maxLength={500} className={inputCls} />
        {error && <p className="text-sm text-bad dark:text-bad-bright">{error}</p>}
        <button type="submit" disabled={busy || !valid} className={primaryBtnCls}>
          {busy ? "Logging…" : flash ? "Logged ✓" : "Log test"}
        </button>
      </form>
    </section>
  );
}

function MockTestForm({ secret, code }: { secret: string; code: string }) {
  const [paper, setPaper] = useState("");
  const [reading, setReading] = useState("");
  const [listening, setListening] = useState("");
  const [writing, setWriting] = useState("");
  const [speaking, setSpeaking] = useState("");
  const [useOfEnglish, setUseOfEnglish] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  const skills = [reading, listening, writing, speaking, useOfEnglish];
  const skillNs = skills.map(Number);
  const valid = Boolean(paper.trim()) && skills.every(validScore);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    const [r, l, w, sp, u] = skillNs;
    const res = await logMockTest(secret, code, paper.trim(), r, l, w, sp, u, notes.trim());
    setBusy(false);
    if (res.ok) {
      setPaper("");
      setReading("");
      setListening("");
      setWriting("");
      setSpeaking("");
      setUseOfEnglish("");
      setNotes("");
      setFlash(true);
      window.setTimeout(() => setFlash(false), 2000);
    } else {
      setError("Couldn't log that — try again.");
    }
  }

  return (
    <section className="mt-5">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy-soft dark:text-navy-mist">
        Log a mock test
      </h2>
      <form onSubmit={submit} className="space-y-3 rounded-card bg-surface p-4 shadow-card dark:bg-navy-raised dark:shadow-card-dark">
        <input value={paper} onChange={(e) => setPaper(e.target.value)} placeholder="Paper (e.g. B1 Mock — Paper 1)" maxLength={200} className={inputCls} />
        <div className="grid grid-cols-2 gap-3">
          <input value={reading} onChange={(e) => setReading(e.target.value)} placeholder="Reading" inputMode="decimal" className={inputCls} />
          <input value={listening} onChange={(e) => setListening(e.target.value)} placeholder="Listening" inputMode="decimal" className={inputCls} />
          <input value={writing} onChange={(e) => setWriting(e.target.value)} placeholder="Writing" inputMode="decimal" className={inputCls} />
          <input value={speaking} onChange={(e) => setSpeaking(e.target.value)} placeholder="Speaking" inputMode="decimal" className={inputCls} />
        </div>
        <input value={useOfEnglish} onChange={(e) => setUseOfEnglish(e.target.value)} placeholder="Use of English" inputMode="decimal" className={inputCls} />
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" maxLength={500} className={inputCls} />
        {error && <p className="text-sm text-bad dark:text-bad-bright">{error}</p>}
        <button type="submit" disabled={busy || !valid} className={primaryBtnCls}>
          {busy ? "Logging…" : flash ? "Logged ✓" : "Log mock test"}
        </button>
      </form>
    </section>
  );
}

function WritingAnalysisForm({ secret, code }: { secret: string; code: string }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WritingAssessment | null>(null);
  const [assessmentId,setAssessmentId]=useState("");
  const [published,setPublished]=useState(false);
  const [publishing,setPublishing]=useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length < 20) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setPublished(false);
    const r = await analyseWriting(secret, code, title.trim() || "Writing sample", text.trim());
    setBusy(false);
    if (r.ok && r.assessment) {
      setResult(r.assessment);
      setAssessmentId(crypto.randomUUID());
    } else {
      setError(r.error || "Couldn't analyse that — try again.");
    }
  }

  return (
    <section className="mt-5">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy-soft dark:text-navy-mist">
        Analyse writing
      </h2>
      <form onSubmit={submit} className="space-y-3 rounded-card bg-surface p-4 shadow-card dark:bg-navy-raised dark:shadow-card-dark">
        <p className="text-xs text-navy-soft dark:text-navy-mist">
          Paste a submitted piece. AI suggests a draft assessment; check it against the original, edit it, then explicitly approve it for the student’s Writing record. This is not an official grade.
        </p>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional, e.g. HW2 essay)" maxLength={200} className={inputCls} />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the writing sample here…"
          rows={5}
          maxLength={8000}
          className={`${inputCls} resize-none`}
        />
        {error && <p className="text-sm text-bad dark:text-bad-bright">{error}</p>}
        <button type="submit" disabled={busy || text.trim().length < 20} className={primaryBtnCls}>
          {busy ? "Analysing…" : "Prepare AI draft"}
        </button>
        {result && (
          <div className="space-y-1.5 rounded-lg bg-amber-soft p-3 dark:bg-amber-dusk">
            <p className="text-sm font-bold text-navy dark:text-cream">
              {result.cefr} · Grammar {result.grammar}/10 · Vocab {result.vocab}/10 · Coherence {result.coherence}/10
            </p>
            {result.errors.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-4 text-xs text-navy-soft dark:text-navy-mist">
                {result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
            <label className="block text-sm">Your final feedback<textarea value={result.feedback} maxLength={2000} disabled={published||publishing} onChange={e=>setResult({...result,feedback:e.target.value})} rows={4} className={inputCls}/></label>
            <div className="grid grid-cols-2 gap-2">
              <label>CEFR estimate<select disabled={published||publishing} value={result.cefr} onChange={e=>setResult({...result,cefr:e.target.value})} className={inputCls}>{["A1","A2","B1","B1+","B2","B2+","C1","C2"].map(v=><option key={v}>{v}</option>)}</select></label>
              {(["grammar","vocab","coherence"] as const).map(k=><label key={k}>{k} /10<input type="number" min={0} max={10} disabled={published||publishing} value={result[k]} onChange={e=>setResult({...result,[k]:Number(e.target.value)})} className={inputCls}/></label>)}
            </div>
            <p className="mt-3 text-sm">AI draft, not a published assessment or official Matura grade. Check the source writing before approval.</p>
            <button type="button" disabled={published||publishing} className="mt-3 min-h-11 rounded-xl bg-indigo-700 p-3 text-white disabled:opacity-50" onClick={async()=>{setPublishing(true);const r=await publishAssessment(secret,code,title,result,assessmentId);setPublishing(false);if(r.ok)setPublished(true);setError(r.ok?null:r.error || "Could not publish.");}}>{published?"Published after your approval":publishing?"Publishing…":"Approve and publish assessment"}</button>
          </div>
        )}
      </form>
    </section>
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
