"use client";

// One place records "the student did some work today", so every screen that
// wants to count towards the streak agrees on what counts and the strip hears
// about it immediately rather than on the next page load.
import {touchStreak} from "./storage";
import {isStudentPreview} from "./student-preview";

export function markEffort(studentId: string, code?: string): void {
  // Rory previewing a student's page is not that student doing work.
  if (code && isStudentPreview(code)) return;
  touchStreak(studentId);
  try {
    window.dispatchEvent(new CustomEvent("re-streak-change"));
  } catch {
    /* No window (or events blocked) — the strip re-reads on its next mount. */
  }
}
