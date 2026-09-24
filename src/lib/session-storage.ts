// Shared by the teacher dashboard and read-only previews. No passwords are saved.
export const sessionKey = (code: string) => `re_session_v2_${code}`;
export interface StoredSession { token: string; expires: number; role: string }
export function readSession<T extends StoredSession>(code: string): T | null {
  if (typeof window === "undefined") return null;
  // Validate independently: an expired/malformed tab entry must not shadow a
  // valid remembered sign-in, and blocked tab storage must not block local.
  // localStorage first, for every code. sessionStorage dies with the tab, so a
  // student who closed the app was signing in again even though their session
  // still had hours left on it. A remembered sign-in has to outlive the tab.
  for (const area of ["localStorage", "sessionStorage"] as const) {
    try {
      const value = JSON.parse(window[area].getItem(sessionKey(code)) || "null");
      if (value && typeof value.token === "string" && value.token &&
          Number.isFinite(value.expires) && value.expires > Date.now() &&
          (code === "__teacher__" ? value.role === "teacher" : ["student", "parent"].includes(value.role))) return value;
    } catch { /* Try the other storage area. */ }
  }
  return null;
}
