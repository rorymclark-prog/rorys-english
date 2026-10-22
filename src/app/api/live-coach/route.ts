import { createHash } from "node:crypto";
import { postProgress } from "@/lib/server/progress-transport";
import { googleHttp } from "@/lib/server/google-http";
import { authorizeCoach, coachAnalysis, coachQuestion, coachSession, feedbackFromResponse, textFromResponse } from "@/lib/server/live-coach-service";
import { readCoachPptx } from "@/lib/server/coach-material";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const headers = { "Cache-Control": "no-store, private" };
const attempts = new Map<string, { at: number; count: number }>();
const available = () => process.env.LIVE_COACH_ENABLED === "true" && !!process.env.OPENAI_API_KEY;
let checkedAccess: { until: number; signature: string } | undefined;
function reply(data: unknown, status = 200) { return Response.json(data, { status, headers }); }

async function verifyModelAccess() {
  const models = [process.env.LIVE_COACH_MODEL || "gpt-realtime-2.1", process.env.LIVE_COACH_TEXT_MODEL || "gpt-6-sol"];
  const signature = createHash("sha256").update(`${process.env.OPENAI_API_KEY}:${models.join(":")}`).digest("hex");
  if (checkedAccess?.signature === signature && checkedAccess.until > Date.now()) return;
  const checks = await Promise.all(models.map(model => fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, {
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, signal: AbortSignal.timeout(15000), cache: "no-store",
  })));
  if (checks.some(response => response.status === 401)) throw new Error("The AI credential could not be verified. Check the private hosting configuration before starting a lesson.");
  if (checks.some(response => response.status === 403 || response.status === 404)) throw new Error("The AI project cannot access one of the configured coaching models. Check the model configuration.");
  if (checks.some(response => !response.ok)) throw new Error("The AI connection check is unavailable. Try again later; no audio was sent.");
  checkedAccess = { until: Date.now() + 60000, signature };
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Origin not allowed" }, 403);
  let body: Record<string, unknown>;
  try {
    if (Number(request.headers.get("content-length") || 0) > 4_100_000) return reply({ error: "Request too large" }, 413);
    const reader = request.body?.getReader(); if (!reader) throw new Error();
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) { const { value, done } = await reader.read(); if (done) break; length += value.length; if (length > 4_100_000) { await reader.cancel(); return reply({ error: "Request too large" }, 413); } chunks.push(value); }
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
  } catch { return reply({ error: "Invalid request" }, 400); }
  try {
    await authorizeCoach(body, async token => {
      const endpoint = process.env.APPS_SCRIPT_URL;
      if (!endpoint) return false;
      const result = await postProgress(endpoint, { action: "teacherDashboard", session: token }, googleHttp);
      return result.ok === true && Array.isArray(result.students);
    });
  } catch { return reply({ error: "Sign in to the teacher dashboard again before using live coaching." }, 403); }
  if (body.action === "status") {
    if (!available()) return reply({ available: false });
    try { await verifyModelAccess(); return reply({ available: true, model: process.env.LIVE_COACH_MODEL || "gpt-realtime-2.1" }); }
    catch (error) { return reply({ error: error instanceof Error ? error.message : "The AI connection could not be checked." }, 503); }
  }
  if (body.action === "import") {
    try {
      if (typeof body.data !== "string" || body.data.length > 4_000_000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.data)) throw new Error("Choose a PowerPoint smaller than 3 MB.");
      return reply({ slides: readCoachPptx(Buffer.from(body.data, "base64")) });
    } catch (error) { return reply({ error: error instanceof Error ? error.message : "Could not read this presentation." }, 400); }
  }
  if (!new Set(["connect", "analyse", "question"]).has(String(body.action))) return reply({ error: "Unknown coaching action" }, 400);
  if (!available()) return reply({ error: "Live coaching is not enabled yet. Try the prepared rehearsal while the AI connection and API credit are checked." }, 503);
  let config;
  try { config = body.action === "connect" ? coachSession(body, process.env.LIVE_COACH_MODEL || "gpt-realtime-2.1") : body.action === "question" ? coachQuestion(body, process.env.LIVE_COACH_TEXT_MODEL || "gpt-6-sol") : coachAnalysis(body, process.env.LIVE_COACH_TEXT_MODEL || "gpt-6-sol"); }
  catch (error) { return reply({ error: error instanceof Error ? error.message : "Check the lesson context." }, 400); }
  const id = createHash("sha256").update(String(body.token)).digest("hex"), key = `${id}:${body.action}`, now = Date.now();
  // Bounded per-instance protection; Platform limits are still required.
  for (const [key, value] of attempts) if (now - value.at >= 3600000) attempts.delete(key);
  const previous = attempts.get(key), current = previous && now - previous.at < 3600000 ? previous : { at: now, count: 0 };
  if (current.count >= (body.action === "connect" ? 4 : 120) || attempts.size >= 1000) return reply({ error: "Please pause before starting more coaching requests." }, 429);
  current.count++; attempts.set(key, current);
  try {
    const auth = { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "OpenAI-Safety-Identifier": id };
    let response: Response;
    if (body.action === "connect") {
      const form = new FormData(); form.set("sdp", String(body.sdp)); form.set("session", JSON.stringify(config));
      response = await fetch("https://api.openai.com/v1/realtime/calls", { method: "POST", headers: auth, body: form, signal: AbortSignal.timeout(45000) });
    } else response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(config), signal: AbortSignal.timeout(45000) });
    if (!response.ok) return reply({ error: response.status === 429 ? "The AI project has reached a usage or credit limit. No automatic retry was made." : "The AI service could not connect. No automatic retry was made." }, 502);
    if (body.action === "connect") {
      const sdp = await response.text();
      if (!sdp.startsWith("v=0") || sdp.length > 100000) throw new Error();
      return reply({ sdp }, 201);
    }
    const result = await response.json();
    if (body.action === "question") { const answer = textFromResponse(result); if (!answer) throw new Error(); return reply({answer}); }
    return reply({ feedback: feedbackFromResponse(result) });
  } catch { return reply({ error: "Feedback could not be completed. Your current lesson stays open; no automatic retry was made." }, 502); }
}
