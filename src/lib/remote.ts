"use client";

// ─────────────────────────────────────────────────────────────────────────────
// REMOTE READS (progress / resources / AI)
//
// Primary path: a "simple" (text/plain, no preflight) POST that Apps Script now
// answers with CORS-readable JSON — so the request body carries the secret + any
// long text (essays) instead of the URL, with no length limit. If that ever
// fails (network / a deploy that breaks CORS), we fall back to JSONP GET.
// ─────────────────────────────────────────────────────────────────────────────

const URL = process.env.NEXT_PUBLIC_SYNC_URL || "";
const SECRET = process.env.NEXT_PUBLIC_SYNC_SECRET || "";

export function remoteEnabled(): boolean {
  return URL.length > 0;
}

// POST-first read; falls back to JSONP on failure.
async function call<T>(params: Record<string, string>): Promise<T> {
  if (!URL) throw new Error("sync not configured");
  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...params, secret: SECRET }),
    });
    if (!res.ok) throw new Error(`http ${res.status}`);
    return (await res.json()) as T;
  } catch {
    return jsonp<T>(params); // resilience fallback
  }
}

export interface Section {
  headers: string[];
  rows: (string | number)[][];
}

export interface Progress {
  ok: boolean;
  name?: string;
  generatedAt?: string;
  homework?: Section;
  quizzes?: Section;
  schoolTests?: Section;
  writing?: Section;
  speaking?: Section;
  mockTests?: Section;
  error?: string;
}

let counter = 0;

// Generic JSONP GET against the Apps Script doGet endpoint.
function jsonp<T>(params: Record<string, string>): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!URL) {
      reject(new Error("sync not configured"));
      return;
    }
    const cb = `__re_${params.action}_${counter++}_${Date.now()}`;
    const script = document.createElement("script");
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("timeout"));
    }, 20000);

    function cleanup() {
      window.clearTimeout(timer);
      delete (window as unknown as Record<string, unknown>)[cb];
      script.remove();
    }

    (window as unknown as Record<string, unknown>)[cb] = (data: T) => {
      cleanup();
      resolve(data);
    };

    const usp = new URLSearchParams({ ...params, secret: SECRET, callback: cb });
    script.src = `${URL}?${usp.toString()}`;
    script.onerror = () => {
      cleanup();
      reject(new Error("network error"));
    };
    document.body.appendChild(script);
  });
}

/** Fetch a progress snapshot by student code OR parent code. */
export function fetchProgress(code: string): Promise<Progress> {
  return call<Progress>({ action: "progress", code });
}

// ── AI helper (word lookup + writing coach) ──────────────────────────────────
export interface AiResult {
  ok: boolean;
  text?: string;
  error?: string;
}

/** Ask the AI helper. "word" = lookup; "writing" = coach; "tutor" = Q&A chat. */
export function fetchAi(
  code: string,
  kind: "word" | "writing" | "tutor",
  q: string,
): Promise<AiResult> {
  return call<AiResult>({ action: "ai", code, kind, q });
}

// ── Shared Drive resources (lesson slides, feedback, assessments) ────────────
export interface ResourceItem {
  name: string;
  url: string;
  type: string; // MIME type
  modified: string; // YYYY-MM-DD
}
export interface Resources {
  ok: boolean;
  name?: string;
  resources?: ResourceItem[];
  error?: string;
}

/** Fetch the student's shared Drive files by student code OR parent code. */
export function fetchResources(code: string): Promise<Resources> {
  return call<Resources>({ action: "resources", code });
}

// ── Assignments (tutor-pushed tasks) ─────────────────────────────────────────
export interface Assignment {
  date: string;
  title: string;
  details: string;
  due: string;
  id: string;
}
export interface AssignmentsResult {
  ok: boolean;
  assignments?: Section;
  error?: string;
}

/** Open (not-yet-done) assignments for a student code OR parent code. */
export function fetchAssignments(code: string): Promise<AssignmentsResult> {
  return call<AssignmentsResult>({ action: "assignments", code });
}

/** Assignments!headers order — see Code.gs TABS.Assignments. */
export function rowToAssignment(row: (string | number)[]): Assignment {
  return {
    date: String(row[0] ?? ""),
    title: String(row[1] ?? ""),
    details: String(row[2] ?? ""),
    due: String(row[3] ?? ""),
    id: String(row[5] ?? ""),
  };
}

/** Marks an assignment done via a REAL (non-opaque) POST — unlike the
 * fire-and-forget no-cors writes in sync.ts, this has no local fallback
 * truth (the Sheet IS the truth for Assignments), so a network-level
 * failure must come back as a real {ok:false}, not silently vanish. */
export async function completeAssignmentRemote(code: string, id: string): Promise<OkResult> {
  if (!URL) return { ok: false, error: "sync not configured" };
  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ secret: SECRET, code, type: "assignment", id, status: "done" }),
    });
    if (!res.ok) return { ok: false, error: `http ${res.status}` };
    return (await res.json()) as OkResult;
  } catch {
    return { ok: false, error: "network error" };
  }
}

// ── Tutor's focus note (shown on Today + woven into the AI system prompt) ────
export interface NoteResult {
  ok: boolean;
  note?: string;
  error?: string;
}

export function fetchNote(code: string): Promise<NoteResult> {
  return call<NoteResult>({ action: "note", code });
}

// ── Teacher dashboard + teacher-only actions ─────────────────────────────────
// POST-only, no JSONP fallback anywhere in this section (deliberately NOT
// using call()) — the teacher password gates every student's data (and these
// write actions can create/modify data for every student), so it must never
// be able to end up in a URL (browser history, server logs), not even as a
// resilience fallback on a flaky network.
export interface TeacherStudentSummary {
  homeworkDone: number | string;
  quizRounds: number | string;
  bestQuizPct: number | string;
  schoolTests: number | string;
  writingSamples: number | string;
  lastUpdated: string;
  daysSinceActivity: number | null;
}
export interface TeacherStudent {
  code: string;
  name: string;
  summary: TeacherStudentSummary | null;
  focusNote: string;
}
export interface TeacherDashboard {
  ok: boolean;
  generatedAt?: string;
  students?: TeacherStudent[];
  error?: string;
}

async function teacherPost<T>(body: Record<string, unknown>): Promise<T> {
  if (!URL) return { ok: false, error: "sync not configured" } as T;
  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { ok: false, error: `http ${res.status}` } as T;
    return (await res.json()) as T;
  } catch {
    return { ok: false, error: "network error" } as T;
  }
}

export function fetchTeacherDashboard(teacherSecret: string): Promise<TeacherDashboard> {
  return teacherPost<TeacherDashboard>({ action: "teacherDashboard", teacherSecret });
}

export interface AddStudentResult {
  ok: boolean;
  code?: string;
  parentCode?: string;
  name?: string;
  error?: string;
}

/** Provisions Drive/Sheet + a Roster row at request time — no redeploy needed
 * for the student's data infrastructure. The static app shell (their /s/code/
 * route) still needs one deploy — see scripts/add-student.mjs. */
export function addStudent(teacherSecret: string, name: string): Promise<AddStudentResult> {
  return teacherPost<AddStudentResult>({ action: "teacherAddStudent", teacherSecret, name });
}

export interface OkResult {
  ok: boolean;
  error?: string;
}

/** Pushes a new assignment into a student's Assignments tab — appears in
 * their app on next load, no redeploy. */
export function assignHomeworkFromDashboard(
  teacherSecret: string,
  code: string,
  title: string,
  details: string,
  due: string,
): Promise<OkResult> {
  return teacherPost<OkResult>({ action: "teacherAssignHomework", teacherSecret, code, title, details, due });
}

/** Sets (or clears, with an empty string) a student's focus note. */
export function setFocusNote(teacherSecret: string, code: string, note: string): Promise<OkResult> {
  return teacherPost<OkResult>({ action: "teacherSetFocusNote", teacherSecret, code, note });
}
