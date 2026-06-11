"use client";

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS SYNC (optional, best-effort)
//
// Posts homework + quiz events to the Apps Script Web App, which writes them
// into the student's Google Sheet. Configured via build-time env:
//   NEXT_PUBLIC_SYNC_URL     — the Apps Script /exec URL
//   NEXT_PUBLIC_SYNC_SECRET  — must match SECRET in the Apps Script
// If the URL is unset, every call is a no-op, so the app works fine without it.
//
// We use a "simple" text/plain POST in no-cors mode (fire-and-forget): the write
// lands in the Sheet; the opaque response is ignored. Progress always remains in
// localStorage as the source of truth, so a dropped event is never data loss.
// ─────────────────────────────────────────────────────────────────────────────

const URL = process.env.NEXT_PUBLIC_SYNC_URL || "";
const SECRET = process.env.NEXT_PUBLIC_SYNC_SECRET || "";

export function syncEnabled(): boolean {
  return URL.length > 0;
}

// ── Retry queue ──────────────────────────────────────────────────────────────
// no-cors gives an opaque response, so the only detectable failure is a network
// throw (offline, DNS, aborted). Those events are queued in localStorage and
// replayed when the connection returns — the Sheet catches up instead of
// silently staying stale. localStorage remains the source of truth regardless.
const QUEUE_KEY = "re_sync_queue";
const QUEUE_MAX = 50;

function readQueue(): Record<string, unknown>[] {
  try {
    return JSON.parse(window.localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeQueue(q: Record<string, unknown>[]): void {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-QUEUE_MAX)));
  } catch {
    /* quota/private mode — drop silently */
  }
}

function enqueue(payload: Record<string, unknown>): void {
  writeQueue([...readQueue(), payload]);
}

function send(payload: Record<string, unknown>): Promise<void> {
  return fetch(URL, {
    method: "POST",
    mode: "no-cors",
    keepalive: true,
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ secret: SECRET, ...payload }),
  }).then(() => undefined);
}

/** Replay queued events; keeps whatever still fails for the next attempt. */
export function drainSyncQueue(): void {
  if (!URL || typeof window === "undefined") return;
  const q = readQueue();
  if (q.length === 0) return;
  writeQueue([]); // claim the batch; failures get re-queued below
  q.forEach((payload) => {
    send(payload).catch(() => enqueue(payload));
  });
}

// Auto-drain when connectivity returns and once on app load.
if (typeof window !== "undefined" && URL) {
  window.addEventListener("online", drainSyncQueue);
  window.setTimeout(drainSyncQueue, 3000);
}

function post(payload: Record<string, unknown>): void {
  if (!URL) return;
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      enqueue(payload);
      return;
    }
    send(payload).catch(() => enqueue(payload));
  } catch {
    /* best-effort — localStorage stays the source of truth */
  }
}

export function syncHomework(
  code: string,
  unitId: string,
  week: number,
  title: string,
  complete: boolean,
): void {
  post({
    type: "homework",
    code,
    unitId,
    week,
    title,
    status: complete ? "complete" : "incomplete",
  });
}

export function syncQuiz(
  code: string,
  tool: string,
  section: string,
  score: number,
  total: number,
): void {
  post({ type: "quiz", code, tool, section, score, total });
}
