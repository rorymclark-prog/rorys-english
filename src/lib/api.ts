"use client";

const endpoint = process.env.NEXT_PUBLIC_SYNC_URL || "";
export interface ApiResult { ok: boolean; error?: string; authRequired?: boolean }
export interface Session extends ApiResult { token: string; expires: number; role: string }
const key = (code: string) => `re_session_v2_${code}`;
export function savedSession(code: string): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(sessionStorage.getItem(key(code)) || "null");
    return value?.expires > Date.now() ? value : null;
  } catch { return null; }
}
export function forgetSession(code: string) {
  try { sessionStorage.removeItem(key(code)); } catch { /* nothing persisted */ }
  window.dispatchEvent(new CustomEvent("re-auth-change"));
}
export async function request<T extends ApiResult>(body: Record<string, unknown>): Promise<T> {
  if (!endpoint) return { ok: false, error: "The secure connection is not configured yet." } as T;
  // Google can briefly fail while redirecting to its JSON response. Retrying
  // sign-in and reads is safe; writes and AI calls retain their explicit flow.
  const retryable = new Set(["login", "progress", "resources", "assignments", "note", "submissions", "teacherDashboard"]);
  const attempts = retryable.has(String(body.action)) ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body), signal: controller.signal });
      if (!res.ok) {
        if (![404, 429, 500, 502, 503, 504].includes(res.status)) break;
        throw new Error("temporarily unavailable");
      }
      const value = await res.json() as T & {service?: string; token?: string; expires?: number; role?: string};
      if (!value || typeof value.ok !== "boolean" || value.service === "rorys-english") throw new Error("Unexpected service response");
      if (body.action === "login" && value.ok && (!value.token || !value.expires || !["student", "parent", "teacher"].includes(value.role || ""))) throw new Error("Missing sign-in confirmation");
      if (value.authRequired) {
        if (savedSession("__teacher__")?.token === body.session) forgetSession("__teacher__");
        else if (typeof body.code === "string") forgetSession(body.code);
      }
      return value;
    } catch {
      if (attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve, 500));
    } finally { clearTimeout(timeout); }
  }
  return { ok: false, error: "Could not reach Rory’s app. Your saved draft is still on this device. Try again when connected." } as T;
}
export async function login(code: string, credential: string): Promise<Session> {
  const result = await request<Session>({ action: "login", code, credential });
  if (result.ok && result.token) {
    try {sessionStorage.setItem(key(code), JSON.stringify(result));}
    catch {return {...result,ok:false,error:"This browser cannot store a sign-in. Enable session storage or use a private device."};}
    window.dispatchEvent(new CustomEvent("re-auth-change"));
  }
  return result;
}
export function authed<T extends ApiResult>(code: string, body: Record<string, unknown>): Promise<T> {
  const session = String(body.action).startsWith("teacher") ? savedSession("__teacher__") : savedSession(code) || savedSession("__teacher__");
  return request<T>({ ...body, code, session: session?.token || "" });
}
export async function logout(code: string) {
  const token = savedSession(code)?.token;
  forgetSession(code);
  if (token) await request({ action: "logout", session: token });
}
