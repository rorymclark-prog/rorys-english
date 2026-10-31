// A teacher can inspect the real family routes without signing in as a parent.
import { previewTeacherSession } from "./student-preview";
export const PARENT_PREVIEW_KEY = "re_teacher_parent_preview_v1";
export const PARENT_PREVIEW_READS = new Set(["progress", "resources", "note", "documents", "document", "documentFile", "learningRecords", "workFeedback", "calendarLessons", "calendarTestFile"]);
export const PARENT_PREVIEW_NOTICE = "Parent preview is read-only. Return to your teacher workspace to make changes.";
export function isParentPreview(code?: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const selected = sessionStorage.getItem(PARENT_PREVIEW_KEY);
    const root = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/p/${selected}`;
    return !!selected && (!code || code === selected) && (window.location.pathname === root || window.location.pathname.startsWith(`${root}/`));
  } catch { return false; }
}
export function startParentPreview(code: string): boolean {
  if (!previewTeacherSession()) return false;
  try { sessionStorage.setItem(PARENT_PREVIEW_KEY, code); return true; } catch { return false; }
}
export function endParentPreview() {
  try { sessionStorage.removeItem(PARENT_PREVIEW_KEY); } catch { /* optional storage */ }
}
