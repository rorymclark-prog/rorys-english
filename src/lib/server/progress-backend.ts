import type {Reply} from "./account-service";
import {postProgress, ProgressTransportError} from "./progress-transport";
import {googleHttp} from "./google-http";
const sessions = new Map<string, { token: string; expires: number }>();
const pending = new Map<string, Promise<string>>();
export async function upstream(body: Record<string, unknown>): Promise<Reply> {
  const endpoint = process.env.APPS_SCRIPT_URL;
  if (!endpoint) throw new ProgressTransportError("service-missing");
  return postProgress(endpoint, body, googleHttp, fetch);
}
export async function backendSession(code: string, idToken: string, refresh = false): Promise<string> {
  if (!refresh && (sessions.get(code)?.expires || 0) > Date.now() + 60000) return sessions.get(code)!.token;
  if (pending.has(code)) return pending.get(code)!;
  const attempt = (async () => {
    const result = await upstream({ action: "firebaseLogin", code, idToken });
    if (!result.ok || result.role !== "student" || typeof result.token !== "string" || typeof result.expires !== "number") throw new ProgressTransportError("student-session");
    sessions.set(code, { token: result.token, expires: result.expires });
    return result.token;
  })();
  pending.set(code, attempt);
  try { return await attempt; } finally { pending.delete(code); }
}
