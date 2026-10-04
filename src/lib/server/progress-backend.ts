import type {Reply} from "./account-service";
import {postProgress} from "./progress-transport";
import {googleHttp} from "./google-http";
const sessions = new Map<string, { token: string; expires: number }>();
const pending = new Map<string, Promise<string>>();
export async function upstream(body: Record<string, unknown>): Promise<Reply> {
  const endpoint = process.env.APPS_SCRIPT_URL;
  if (!endpoint) throw new Error("Missing progress service");
  return postProgress(endpoint, body, googleHttp, fetch);
}
export async function backendSession(code: string, idToken: string, refresh = false): Promise<string> {
  if (!refresh && (sessions.get(code)?.expires || 0) > Date.now() + 60000) return sessions.get(code)!.token;
  if (pending.has(code)) return pending.get(code)!;
  const attempt = (async () => {
    const result = await upstream({ action: "firebaseLogin", code, idToken });
    if (!result.ok || result.role !== "student" || typeof result.token !== "string" || typeof result.expires !== "number") throw new Error("Student connection unavailable");
    sessions.set(code, { token: result.token, expires: result.expires });
    return result.token;
  })();
  pending.set(code, attempt);
  try { return await attempt; } finally { pending.delete(code); }
}
