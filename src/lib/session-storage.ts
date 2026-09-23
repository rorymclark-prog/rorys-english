// Shared by the teacher dashboard and read-only previews. No passwords are saved.
export const sessionKey = (code: string) => `re_session_v2_${code}`;
export interface StoredSession { token: string; expires: number; role: string }
export function readSession<T extends StoredSession>(code: string): T | null {
  if (typeof window === "undefined") return null;
  // Validate independently: an expired/malformed tab entry must not shadow a
  // valid remembered sign-in, and blocked tab storage must not block local.
  for (const area of code === "__teacher__" ? ["localStorage", "sessionStorage"] as const : ["sessionStorage"] as const) {
    try {
      const value = JSON.parse(window[area].getItem(sessionKey(code)) || "null");
      if (value && typeof value.token === "string" && value.token &&
          Number.isFinite(value.expires) && value.expires > Date.now() &&
          (code === "__teacher__" ? value.role === "teacher" : ["student", "parent"].includes(value.role))) return value;
    } catch { /* Try the other storage area. */ }
  }
  return null;
}
