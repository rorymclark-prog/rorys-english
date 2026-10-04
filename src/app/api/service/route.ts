import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { accountService, type Account } from "@/lib/server/account-service";
import { ProgressTransportError } from "@/lib/server/progress-transport";
import {upstream,backendSession} from "@/lib/server/progress-backend";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store, private" };
  // Strict, like /api/voice: a browser always sends Origin on a POST, so a
  // request without one is not a page of this app and must not be trusted.
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ ok: false, error: "Origin not allowed" }, { status: 403, headers });
  try {
    const text = await request.text();
    if (text.length > 3500000) return Response.json({ ok: false, error: "Request too large" }, { status: 413, headers });
    const body = JSON.parse(text);
    if (!["documentUpload", "calendarTestSave", "teacherCalendarTestSave"].includes(body?.action) && text.length > 60000) return Response.json({ok:false,error:"Request too large"}, {status:413,headers});
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
