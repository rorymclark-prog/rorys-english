"use client";

// ─────────────────────────────────────────────────────────────────────────────
// DEVICE-LOCAL STORAGE (localStorage)
//
// Nothing leaves the device (privacy §6). Homework keys follow the readable,
// collision-free scheme from the spec: `{studentId}_{unitId}_{hwWeek}_{taskId}`.
// All helpers are SSR-safe (no-op when window is undefined).
// ─────────────────────────────────────────────────────────────────────────────

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode / quota — progress is best-effort */
  }
}

function remove(prefix: string): void {
  if (typeof window === "undefined") return;
  try {
    const toDelete: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(prefix)) toDelete.push(k);
    }
    toDelete.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

// ── Homework task values ─────────────────────────────────────────────────────
export function taskKey(studentId: string, unitId: string, week: number, taskId: string): string {
  return `${studentId}_${unitId}_hw${week}_${taskId}`;
}

export function getTaskValue(
  studentId: string,
  unitId: string,
  week: number,
  taskId: string,
): string {
  return read(taskKey(studentId, unitId, week, taskId)) ?? "";
}

export function setTaskValue(
  studentId: string,
  unitId: string,
  week: number,
  taskId: string,
  value: string,
): void {
  write(taskKey(studentId, unitId, week, taskId), value);
}

export function getTaskChecked(
  studentId: string,
  unitId: string,
  week: number,
  taskId: string,
): boolean {
  return read(taskKey(studentId, unitId, week, taskId)) === "1";
}

export function setTaskChecked(
  studentId: string,
  unitId: string,
  week: number,
  taskId: string,
  checked: boolean,
): void {
  write(taskKey(studentId, unitId, week, taskId), checked ? "1" : "0");
}

// ── Week completion flag ─────────────────────────────────────────────────────
function completeKey(studentId: string, unitId: string, week: number): string {
  return `${studentId}_${unitId}_hw${week}_complete`;
}

export function isWeekComplete(studentId: string, unitId: string, week: number): boolean {
  return read(completeKey(studentId, unitId, week)) === "1";
}

export function setWeekComplete(
  studentId: string,
  unitId: string,
  week: number,
  complete: boolean,
): void {
  write(completeKey(studentId, unitId, week), complete ? "1" : "0");
  if (complete) touchStreak(studentId);
}

// ── Streak (gentle, never guilt-tripping) ────────────────────────────────────
function streakKey(studentId: string): string {
  return `${studentId}_streak`;
}

export function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function getStreakDays(studentId: string): string[] {
  const raw = read(streakKey(studentId));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function touchStreak(studentId: string): void {
  const days = getStreakDays(studentId);
  const today = localDay();
  if (!days.includes(today)) {
    days.push(today);
    write(streakKey(studentId), JSON.stringify(days));
  }
}

/** Consecutive-day streak ending today (or yesterday, so it "holds" overnight). */
export function currentStreak(days: string[]): number {
  const set = new Set(days);
  const d = new Date();
  if (!set.has(localDay(d))) d.setDate(d.getDate() - 1);
  let count = 0;
  while (set.has(localDay(d))) {
    count += 1;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

/** Longest run of consecutive active days ever (for a gentle "best streak"). */
export function bestStreak(days: string[]): number {
  if (days.length === 0) return 0;
  const sorted = [...new Set(days)].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    prev.setDate(prev.getDate() + 1);
    if (localDay(prev) === sorted[i]) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }
  return best;
}

/** Which of the last `n` local days were active — for a 7-day activity strip. */
export function recentActivity(days: string[], n = 7): { day: string; active: boolean }[] {
  const set = new Set(days);
  const out: { day: string; active: boolean }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = localDay(d);
    out.push({ day: key, active: set.has(key) });
  }
  return out;
}

// ── Settings ─────────────────────────────────────────────────────────────────
export type TextScale = "normal" | "large" | "xl";
export type Theme = "light" | "dark" | "system";
export interface Settings {
  textScale: TextScale;
  theme: Theme;
}
export const DEFAULT_SETTINGS: Settings = { textScale: "normal", theme: "system" };

function settingsKey(studentId: string): string {
  return `${studentId}_settings`;
}

export function getSettings(studentId: string): Settings {
  const raw = read(settingsKey(studentId));
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(studentId: string, s: Settings): void {
  write(settingsKey(studentId), JSON.stringify(s));
}

// ── Progress summary (for the student-initiated "send to Rory" share) ────────
/** Scans this student's local keys into a short, human-readable summary. No
 *  content needed — counts completed weeks, ticked tasks and the streak. */
export function buildProgressSummary(studentId: string, displayName: string): string {
  let weeksComplete = 0;
  let ticked = 0;
  if (typeof window !== "undefined") {
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (!k || !k.startsWith(`${studentId}_`)) continue;
        const v = window.localStorage.getItem(k);
        if (k.endsWith("_complete")) {
          if (v === "1") weeksComplete += 1;
        } else if (/_hw\d+_/.test(k) && v === "1") {
          ticked += 1;
        }
      }
    } catch {
      /* ignore */
    }
  }
  const streak = currentStreak(getStreakDays(studentId));
  const lines = [
    `Hi Rory — ${displayName}'s progress:`,
    `• Homework weeks completed: ${weeksComplete}`,
    `• Tasks ticked off: ${ticked}`,
    `• Current streak: ${streak} day${streak === 1 ? "" : "s"}`,
  ];
  return lines.join("\n");
}

// ── Reset (Settings → "reset progress", with confirm in the UI) ──────────────
export function resetProgress(studentId: string): void {
  // Clears all of this student's homework, completion, streak and settings keys.
  remove(`${studentId}_`);
}
