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

function post(payload: Record<string, unknown>): void {
  if (!URL) return;
  try {
    void fetch(URL, {
      method: "POST",
      mode: "no-cors",
      keepalive: true,
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ secret: SECRET, ...payload }),
    });
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
