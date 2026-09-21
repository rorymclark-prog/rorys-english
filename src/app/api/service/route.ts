import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { accountService, type Account, type Reply } from "@/lib/server/account-service";
import { postProgress, ProgressTransportError } from "@/lib/server/progress-transport";
import { googleHttp } from "@/lib/server/google-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const sessions = new Map<string, { token: string; expires: number }>();
const pending = new Map<string, Promise<string>>();
async function upstream(body: Record<string, unknown>): Promise<Reply> {
  const endpoint = process.env.APPS_SCRIPT_URL;
  if (!endpoint) throw new Error("Missing progress service");
  return postProgress(endpoint, body, googleHttp);
}
async function backendSession(code: string, idToken: string, refresh = false): Promise<string> {
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
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store, private" };
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ ok: false, error: "Origin not allowed" }, { status: 403, headers });
  try {
    const text = await request.text();
    if (text.length > 3500000) return Response.json({ ok: false, error: "Request too large" }, { status: 413, headers });
    const body = JSON.parse(text);
    if (body?.action !== "documentUpload" && text.length > 60000) return Response.json({ok:false,error:"Request too large"}, {status:413,headers});
    if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ ok: false, error: "Invalid request" }, { status: 400, headers });
    const roster = JSON.parse(process.env.ACCOUNT_ROSTER_JSON || "{}") as Record<string, Account>;
    const result = await accountService(body, {
      roster, upstream, backendSession,
      verify: async token => {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        if (!projectId) throw new Error("Accounts are not configured");
        // Verification uses Google's public signing certificates and this exact project ID.
        const app = getApps().find(a => a.name === "english-server") || initializeApp({ projectId }, "english-server");
        return getAuth(app).verifyIdToken(token);
      },
    });
    return Response.json(result, { headers });
  } catch (error) {
    console.error("Progress connection failed", error instanceof ProgressTransportError ? {stage:error.stage,status:error.status} : {stage:"service"});
    return Response.json({ ok: false, error: "Could not connect to Rory’s app. Your saved draft is still on this device. Please try again." }, { status: 503, headers });
  }
}
