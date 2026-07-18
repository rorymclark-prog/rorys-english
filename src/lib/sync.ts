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
//
// The queue is scoped per student code (`re_sync_queue_<code>`) so two students
// sharing one browser profile never mix events, and a cross-tab lock guards the
// drain so two open tabs can't replay — and double-write — the same batch.
const QUEUE_PREFIX = "re_sync_queue"; // per-code key: `${QUEUE_PREFIX}_<code>`
const LEGACY_QUEUE_KEY = "re_sync_queue"; // pre-scoping single queue; drained too
const QUEUE_MAX = 50;
const LOCK_KEY = "re_sync_drain_lock";
const LOCK_TTL = 15000; // ms a drain may hold the cross-tab lock before it lapses

function queueKey(code: unknown): string {
  const c =
    typeof code === "string" && code
      ? code.replace(/[^A-Za-z0-9_-]/g, "")
      : "unknown";
  return `${QUEUE_PREFIX}_${c}`;
}

function readQueueAt(key: string): Record<string, unknown>[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function writeQueueAt(key: string, q: Record<string, unknown>[]): void {
  try {
    if (q.length === 0) {
      window.localStorage.removeItem(key);
      return;
    }
    if (q.length > QUEUE_MAX) {
      const dropped = q.length - QUEUE_MAX;
      q = q.slice(-QUEUE_MAX);
      // Signal rather than drop in silence — 50 unsent events means the backend
      // has been unreachable for a long time; worth a console breadcrumb.
      console.warn(
        `[sync] ${key} exceeded ${QUEUE_MAX} events; dropped ${dropped} oldest`,
      );
    }
    window.localStorage.setItem(key, JSON.stringify(q));
  } catch {
    /* quota/private mode — drop silently */
  }
}

function enqueue(payload: Record<string, unknown>): void {
  const key = queueKey(payload.code);
  writeQueueAt(key, [...readQueueAt(key), payload]);
}

/** Every queue key in localStorage: the legacy single key + all per-code keys. */
function allQueueKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && (k === LEGACY_QUEUE_KEY || k.startsWith(`${QUEUE_PREFIX}_`))) {
        keys.push(k);
      }
    }
  } catch {
    /* ignore */
  }
  return keys;
}

// ── Cross-tab drain lock ─────────────────────────────────────────────────────
// localStorage has no atomic compare-and-swap, so this is a best-effort mutex:
// claim a fresh timestamp+token, then read it back — if another tab's token won
// the write, we back off. Combined with the synchronous batch-claim below it
// closes the "two tabs come online together and both replay the queue" window.
function acquireDrainLock(): boolean {
  try {
    const prev = window.localStorage.getItem(LOCK_KEY);
    if (prev && Date.now() - parseInt(prev, 10) < LOCK_TTL) return false;
    const token = `${Date.now()}:${Math.floor(Math.random() * 1e6)}`;
    window.localStorage.setItem(LOCK_KEY, token);
    return window.localStorage.getItem(LOCK_KEY) === token;
  } catch {
    // No localStorage (private mode): don't let the lock block sending.
    return true;
  }
}

function releaseDrainLock(): void {
  try {
    window.localStorage.removeItem(LOCK_KEY);
  } catch {
    /* ignore */
  }
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
  const keys = allQueueKeys();
  if (keys.length === 0) return;
  if (!acquireDrainLock()) return; // another tab is draining — let it
  try {
    keys.forEach((key) => {
      const q = readQueueAt(key);
      if (q.length === 0) return;
      writeQueueAt(key, []); // claim the batch synchronously; failures re-queue
      q.forEach((payload) => {
        send(payload).catch(() => enqueue(payload));
      });
    });
  } finally {
    // The batch is already claimed (queues emptied synchronously), so releasing
    // now is safe: a re-enqueue from a failed send is a legitimate later retry,
    // not a duplicate of something another tab is also holding.
    releaseDrainLock();
  }
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
