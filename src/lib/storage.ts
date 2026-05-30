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

// ── Reset (Settings → "reset progress", with confirm in the UI) ──────────────
export function resetProgress(studentId: string): void {
  // Clears all of this student's homework, completion, streak and settings keys.
  remove(`${studentId}_`);
}
