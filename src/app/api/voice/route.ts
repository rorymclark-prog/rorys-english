import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { createHash } from "node:crypto";
import type { Account } from "@/lib/server/account-service";
import { authorizeVoice, voiceConfiguration } from "@/lib/server/voice-session";
import { postProgress, ProgressTransportError } from "@/lib/server/progress-transport";
import { googleHttp } from "@/lib/server/google-http";
import studentContent from "../../../../content/students.json";
import ferdiUnits from "../../../../content/ferdi/units.json";
import valentinUnits from "../../../../content/valentin/units.json";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;
const headers = { "Cache-Control": "no-store, private" };
const attempts = new Map<string, number[]>();
const enabled = () => process.env.LIVE_VOICE_ENABLED === "true" && !!process.env.OPENAI_API_KEY;
export async function GET() { return Response.json({ available: enabled() }, { headers }); }
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Origin not allowed" }, { status: 403, headers });
  if (!enabled()) return Response.json({ error: "Live voice is not connected yet. You can still rehearse below." }, { status: 503, headers });
  let body;
  try {
    const text = await request.text();
    if (text.length > 60000) return Response.json({ error: "Request too large" }, { status: 413, headers });
    body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
  } catch { return Response.json({ error: "Invalid request" }, { status: 400, headers }); }
  let uid: string;
  let roster: Record<string, Account>;
  try {
    roster = JSON.parse(process.env.ACCOUNT_ROSTER_JSON || "{}") as Record<string, Account>;
    uid = await authorizeVoice(body, roster, async token => {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      if (!projectId) throw new Error();
      const app = getApps().find(a => a.name === "english-server") || initializeApp({ projectId }, "english-server");
      return getAuth(app).verifyIdToken(token);
    }, async token => {
      const endpoint = process.env.APPS_SCRIPT_URL;
      if (!endpoint) throw new ProgressTransportError("teacher-service-missing");
      // This read is allowed only for a verified teacher session. Discard student data.
      const result = await postProgress(endpoint, { action: "teacherDashboard", session: token }, googleHttp);
      return result.ok === true && Array.isArray(result.students);
    });
  } catch (error) {
    if (error instanceof ProgressTransportError) return Response.json({ error: "The teacher sign-in service is taking too long. Please try the voice test again shortly." }, { status: 503, headers });
    return Response.json({ error: body.teacherTest === true ? "Sign in to the teacher dashboard again to test voice." : "Please sign in with the student email connected to these lessons. Teacher preview cannot start a voice session." }, { status: 403, headers });
  }
  let config;
  try {
    const practiceCode = body.teacherTest === true ? body.practiceStudent : body.code;
    const student = typeof practiceCode === "string" && Object.hasOwn(roster, practiceCode) ? studentContent.find(s => s.code === practiceCode) : null;
    const units = student?.id === "ferdi" ? ferdiUnits : student?.id === "valentin" ? valentinUnits : [];
    const unit = units.find(u => u.active);
    config = voiceConfiguration(body, unit ? { title: unit.title, vocabulary: "voiceVocabulary" in unit ? unit.voiceVocabulary : undefined } : null);
  }
  catch { return Response.json({ error: "Choose a topic and try connecting your microphone again." }, { status: 400, headers }); }
  // Per-instance burst protection, not an account-wide spending limit.
  const now = Date.now(); const recent = (attempts.get(uid) || []).filter(t => now - t < 3600000);
  if (recent.length >= 4 || recent.some(t => now - t < 30000)) return Response.json({ error: "Please wait before starting another conversation." }, { status: 429, headers });
  attempts.set(uid, [...recent, now]);
  try {
    const response = await fetch("https://api.openai.com/v1/live/sessions", {
      method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json", "OpenAI-Safety-Identifier": createHash("sha256").update(uid).digest("hex") },
      body: JSON.stringify(config), signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) {
      console.error("Live voice connection rejected", { status: response.status });
      return Response.json({ error: "Live voice could not connect. Try again later or use a rehearsal." }, { status: 502, headers });
    }
    const result = await response.json();
    if (typeof result?.session?.id !== "string" || typeof result?.transport?.sdp !== "string") throw new Error();
    return Response.json({ session: { id: result.session.id }, transport: { type: "webrtc", sdp: result.transport.sdp } }, { status: 201, headers });
  } catch { return Response.json({ error: "The voice connection timed out. No automatic retry was made." }, { status: 502, headers }); }
}
