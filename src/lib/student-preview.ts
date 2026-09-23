// Preview is a tab-local mode; it never creates or borrows a student account.
export const PREVIEW_KEY = "re_teacher_preview_v1";
export const PREVIEW_READS = new Set(["progress", "resources", "assignments", "note", "submissions", "documents", "document", "documentFile", "learningRecords"]);
export const PREVIEW_NOTICE = "Student preview is read-only. Return to your teacher workspace to make changes.";
export function previewCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const code = sessionStorage.getItem(PREVIEW_KEY);
    const path = window.location.pathname;
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    return code && (path === `${base}/s/${code}` || path.startsWith(`${base}/s/${code}/`)) ? code : null;
  } catch { return null; }
}
export function isStudentPreview(code?: string): boolean {
  const selected = previewCode();
  return !!selected && (!code || selected === code);
}
export function previewTeacherSession(): { token: string; expires: number; role: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const session = JSON.parse(sessionStorage.getItem("re_session_v2___teacher__") || "null");
    return session?.role === "teacher" && typeof session.token === "string" && session.expires > Date.now() ? session : null;
  } catch { return null; }
}
export function startStudentPreview(code: string): boolean {
  if (!previewTeacherSession()) return false;
  try { sessionStorage.setItem(PREVIEW_KEY, code); return true; } catch { return false; }
}
export function endStudentPreview() {
  try { sessionStorage.removeItem(PREVIEW_KEY); } catch { /* no stored preview */ }
}
