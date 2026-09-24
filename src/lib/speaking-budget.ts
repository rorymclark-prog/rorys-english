"use client";
import { isStudentPreview } from "./student-preview";

// ─────────────────────────────────────────────────────────────────────────────
// WEEKLY SPEAKING ALLOWANCE
//
// Live speaking costs real money per minute, so each student gets a set number
// of minutes a week. Running out is not a punishment: it is the moment to ask
// Rory for more, and the wording everywhere says so.
//
// This counter lives on the device, like everything else in storage.ts. It is a
// fair-use guide, not a security boundary — clearing the browser clears it. The
// hard ceiling is the monthly spend cap set in the OpenAI dashboard, which no
// amount of clicking here can exceed.
//
// Where 35 comes from: live voice costs about €0.055 a minute all in (OpenAI's
// $0.05 a minute for gpt-live-1, converted, plus the gpt-6-sol text delegation
// in api/voice). 35 minutes a week is ~152 minutes a month, or about €8.35 per
// student — the bottom of Rory's €8–11 per student band, which leaves roughly
// €2.50 each of headroom for the extra minutes he grants on request.
// ─────────────────────────────────────────────────────────────────────────────

/** Minutes of live conversation per student per week. */
export const WEEKLY_MINUTES = 35;
const WEEKLY_SECONDS = WEEKLY_MINUTES * 60;

/**
 * One conversation still ends at 15 minutes, as it always has. The weekly
 * allowance is spent across several conversations, not in one sitting.
 */
export const CALL_MINUTES = 15;
export const CALL_SECONDS = CALL_MINUTES * 60;

/**
 * Below this, the week counts as spent. Connecting a microphone for a
 * conversation that dies after twenty seconds wastes everyone's time and still
 * costs a session, so the last scrap of allowance is not offered at all.
 */
export const MIN_CALL_SECONDS = 60;
const KEY = "re_speaking_week_v1_";

/**
 * The Monday of the week a date falls in, as YYYY-MM-DD in local time.
 * School weeks start on Monday here, so the allowance refreshes overnight on
 * Sunday rather than mid-weekend.
 */
export function weekKey(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // getDay(): Sunday is 0, so Sunday belongs to the week that began six days ago.
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type Week = { week: string; seconds: number };

function readWeek(studentId: string, now?: Date): Week {
  const fresh = { week: weekKey(now), seconds: 0 };
  if (typeof window === "undefined") return fresh;
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(KEY + studentId); } catch { return fresh; }
  if (!raw) return fresh;
  try {
    const parsed = JSON.parse(raw) as Partial<Week>;
    // A stored week that is not this week has simply expired, and anything that
    // is not a sane number counts as nothing used — never as everything used,
    // which would lock a student out over a corrupt value.
    if (parsed?.week !== fresh.week) return fresh;
    const seconds = Number(parsed.seconds);
    if (!Number.isFinite(seconds) || seconds < 0) return fresh;
    return { week: fresh.week, seconds: Math.min(seconds, WEEKLY_SECONDS) };
  } catch { return fresh; }
}

/** Seconds of speaking left this week, never negative. */
export function secondsLeft(studentId: string, now?: Date): number {
  return Math.max(0, WEEKLY_SECONDS - readWeek(studentId, now).seconds);
}

/** Whole minutes left, rounded down — a part-minute is not offered as a minute. */
export function minutesLeft(studentId: string, now?: Date): number {
  return Math.floor(secondsLeft(studentId, now) / 60);
}

/** Add a finished conversation to this week's total. */
export function recordSeconds(studentId: string, seconds: number, now?: Date): void {
  if (isStudentPreview()) return;                       // Rory looking is not the student talking.
  if (typeof window === "undefined") return;
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const current = readWeek(studentId, now);
  const value: Week = { week: current.week, seconds: Math.min(WEEKLY_SECONDS, current.seconds + Math.round(seconds)) };
  try { window.localStorage.setItem(KEY + studentId, JSON.stringify(value)); } catch { /* best-effort */ }
  try { window.dispatchEvent(new CustomEvent("re-speaking-budget-change")); } catch { /* no window events in tests */ }
}
