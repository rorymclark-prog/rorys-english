"use client";
import { isStudentPreview, previewTeacherSession, PREVIEW_READS, PREVIEW_NOTICE } from "./student-preview";

const endpoint = process.env.NEXT_PUBLIC_SYNC_URL || "";
export interface ApiResult { ok: boolean; error?: string; authRequired?: boolean }
export interface Session extends ApiResult { token: string; expires: number; role: string; authProvider?: "firebase"; accountUid?: string; verificationRequired?: boolean }
const accountsEnabled = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
let accountEpoch = 0;
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
  if (isStudentPreview() && !PREVIEW_READS.has(String(body.action))) return {ok:false,error:PREVIEW_NOTICE} as T;
  if (!endpoint) return { ok: false, error: "The secure connection is not configured yet." } as T;
  // Google can briefly fail while redirecting to its JSON response. Retrying
  // sign-in and reads is safe; writes and AI calls retain their explicit flow.
  const retryable = new Set(["login", "accountLogin", "progress", "resources", "assignments", "note", "submissions", "teacherDashboard"]);
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
      if (["login", "accountLogin"].includes(String(body.action)) && value.ok && (!value.token || !value.expires || !["student", "parent", "teacher"].includes(value.role || ""))) throw new Error("Missing sign-in confirmation");
      if (value.authRequired) {
        if (savedSession("__teacher__")?.token === body.session) forgetSession("__teacher__");
        else if (typeof body.code === "string") forgetSession(body.code);
      }
      return value;
    } catch {
      if (attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve, 500));
    } finally { clearTimeout(timeout); }
  }
  return { ok: false, error: ["login", "accountLogin"].includes(String(body.action))
    ? "Could not confirm sign-in because the service is taking too long. Please try again; you do not need to change your password."
    : "Could not reach Rory’s app. Your saved draft is still on this device. Try again when connected." } as T;
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
export async function loginWithAccount(code: string): Promise<Session> {
  const { currentAccount } = await import("./account-auth");
  const epoch = accountEpoch;
  const user = await currentAccount();
  if (!user) return {ok:false,error:"Please sign in.",token:"",expires:0,role:"student"};
  const idToken = await user.getIdToken();
  const result = await request<Session>({action:"accountLogin",code,idToken});
  if (epoch !== accountEpoch || (await currentAccount())?.uid !== user.uid) {
    return {ok:false,error:"Your account changed. Please sign in again.",token:"",expires:0,role:"student"};
  }
  if (result.ok && result.authProvider === "firebase" && result.accountUid === user.uid) {
    try { sessionStorage.setItem(key(code), JSON.stringify(result)); }
    catch { return {...result,ok:false,error:"This browser cannot store a sign-in. Please use a browser with storage enabled."}; }
    window.dispatchEvent(new CustomEvent("re-auth-change"));
  } else if (!result.ok) forgetSession(code);
  return result;
}
export async function authed<T extends ApiResult>(code: string, body: Record<string, unknown>): Promise<T> {
  if (isStudentPreview(code)) {
    if (!PREVIEW_READS.has(String(body.action))) return {ok:false,error:PREVIEW_NOTICE} as T;
    const teacher = previewTeacherSession();
    if (!teacher) return {ok:false,authRequired:true,error:"Your teacher session has ended. Return to the teacher workspace to sign in."} as T;
    return request<T>({...body,code,session:teacher.token,preview:true});
  }
  if (accountsEnabled && !code.includes("-fam-") && !String(body.action).startsWith("teacher")) {
    const { currentAccount } = await import("./account-auth");
    const user = await currentAccount();
    if (user) {
      try { return await request<T>({...body,code,session:await user.getIdToken(),authProvider:"firebase"}); }
      catch { return {ok:false,error:"Please reconnect and sign in again. Your saved draft is still on this device."} as T; }
    }
  }
  const session = String(body.action).startsWith("teacher") ? savedSession("__teacher__") : savedSession(code) || savedSession("__teacher__");
  return request<T>({ ...body, code, session: session?.token || "" });
}
export async function logout(code: string) {
  accountEpoch++;
  const session = savedSession(code);
  forgetSession(code);
  if (code !== "__teacher__" && accountsEnabled) {
    const { signOutAccount } = await import("./account-auth");
    await signOutAccount();
    for (const storedKey of Object.keys(sessionStorage)) {
      if (!storedKey.startsWith("re_session_v2_")) continue;
      try { if (JSON.parse(sessionStorage.getItem(storedKey) || "null")?.authProvider === "firebase") sessionStorage.removeItem(storedKey); } catch { /* invalid entry */ }
    }
    window.dispatchEvent(new CustomEvent("re-auth-change"));
  }
  if (session?.token && session.authProvider !== "firebase") await request({ action: "logout", session: session.token });
}
