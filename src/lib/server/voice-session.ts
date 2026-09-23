import type { Account, Identity } from "./account-service";
import {guidedSpeaking} from "../guided-speaking";
export type VoiceRequest = { code?: unknown; token?: unknown; sdp?: unknown; topic?: unknown; grammar?: unknown; voice?: unknown; homeworkFocus?: unknown; practiceStudent?: unknown; preview?: unknown; teacherTest?: unknown };
export const voiceOptions = {
  vesper: "Vesper",
  willow: "Willow",
  stone: "Stone",
  quartz: "Quartz",
  gleam: "Gleam",
  meridian: "Meridian",
} as const;
export const voiceTopics: Record<string, { title: string; target: string }> = {
  general: { title: "Open conversation", target: "Follow the learner's interests and keep a natural conversation going." },
  everyday: { title: "Everyday conversation", target: "Give a complete answer, add a reason and ask a follow-up question." },
  opinions: { title: "Ideas & opinions", target: "State an opinion, support it with an example, and respond politely to a different view." },
  story: { title: "Tell a story", target: "Describe a real or imaginary event using a clear sequence and past tenses." },
  unit: { title: "Current unit", target: "Use the current school unit's vocabulary in original conversation and sentences." },
  grammar: { title: "Grammar builder", target: "Build original sentences with one chosen grammar pattern." },
};
export const grammarTargets: Record<string, string> = {
  "past-simple": "past simple: finished events and questions about them",
  "past-perfect": "past perfect with past simple: what happened before another past event",
  "present-perfect": "present perfect with past simple: experience versus a finished time",
  "future": "future forms: plans, predictions and decisions",
  "conditionals": "first and second conditionals: likely and imagined situations",
  "sentence-building": "sentence building: subject, verb, object, details and linking ideas",
};
export async function authorizeVoice(body: VoiceRequest, roster: Record<string, Account>, verify: (token: string) => Promise<Identity>, verifyTeacher?: (token: string) => Promise<boolean>) {
  if (body.preview) throw new Error("Voice is unavailable in read-only teacher preview.");
  if (typeof body.code !== "string" || typeof body.token !== "string" || !body.token) throw new Error("Sign in with your student email to use live voice.");
  if (body.teacherTest === true) {
    if (body.code !== "__teacher__" || !verifyTeacher || !await verifyTeacher(body.token)) throw new Error("Sign in to the teacher dashboard to test voice.");
    return "teacher-voice-test";
  }
  const account = roster[body.code];
  if (!account) throw new Error("This account cannot use live voice.");
  const identity = await verify(body.token);
  if (!identity.email_verified || identity.uid !== account.uid || identity.email?.toLowerCase() !== account.email.toLowerCase()) throw new Error("This account cannot use these lessons.");
  return identity.uid;
}
export function voiceConfiguration(body: VoiceRequest, unit?: { title: string; vocabulary?: string[] } | null) {
  if (typeof body.sdp !== "string" || body.sdp.length > 50000 || !body.sdp.startsWith("v=0")) throw new Error("The microphone connection could not be prepared.");
  if (typeof body.topic !== "string" || !Object.hasOwn(voiceTopics, body.topic)) throw new Error("Choose a speaking topic.");
  if (body.topic === "grammar" && (typeof body.grammar !== "string" || !Object.hasOwn(grammarTargets, body.grammar))) throw new Error("Choose a grammar target.");
  if (body.voice !== undefined && (typeof body.voice !== "string" || !Object.hasOwn(voiceOptions, body.voice))) throw new Error("Choose an available voice.");
  const topic = voiceTopics[body.topic];
  const focus = body.topic === "grammar" ? `Grammar focus: ${grammarTargets[body.grammar as string]}. Practise with meaningful original examples, not isolated rules.`
    : body.topic === "unit" ? unit ? `Current unit: ${unit.title}. ${unit.vocabulary?.length ? `Verified practice words: ${unit.vocabulary.join(", ")}. Weave a few into original questions and invite the learner to use them. Do not recite a list.` : "No verified vocabulary list is available. Ask the learner for two or three words from class, then practise those. Do not invent textbook details."}` : "No current unit is set. Ask which school topic and two or three words the learner wants to practise; do not invent textbook details." : "";
  const guided = typeof body.code === "string" && typeof body.homeworkFocus === "string"
    ? guidedSpeaking(body.code, body.homeworkFocus) : null;
  const homeworkFocus = guided && body.topic === guided.topic ? guided.instructions : "";
  const coaching = `You are an English tutor for a secondary-school learner. Keep the conversation age-appropriate and adaptive to what the learner says, without assigning a CEFR level. Ask one question at a time. Make the learner do most of the talking. Give specific, encouraging feedback on meaning first. After a substantial answer, choose at most one useful grammar correction; say the improved form briefly, explain it only if helpful, then ask the learner to use it in their own new sentence. Do not correct every mistake or interrupt a fluent thought. If they ask about grammar, explain with one short contrast and a new example. If a repeat exercise helps, give at most five or six words at once. Split a longer sentence into short meaningful chunks, wait for each chunk, then invite the learner to say the whole sentence only if they want to. Never demand verbatim recall of two sentences. A transcript does not establish precise pronunciation; give pronunciation advice only for a sound you clearly heard, and express uncertainty. Do not claim to be Rory, give grades, certify proficiency, save homework or invent private school content.`;
  return {
    session: {
      model: "gpt-live-1", store: false,
      audio: { output: { voice: typeof body.voice === "string" ? body.voice : "vesper" } },
      instructions: `You are Rory's English AI speaking partner. Speak natural, clear British English in short turns; let the learner finish and follow their ideas. Mode: ${topic.title}. Goal: ${topic.target} ${focus} ${homeworkFocus}\nBackchannel policy: Brief acknowledgements are fine while listening; never take over the learner's turn.\nInterruption policy: Stop speaking when the learner interrupts and listen.\nDelegation policy:\nBackend tools: A stronger language tutor can reason about grammar, compare tenses, design a short practice sequence and check a correction against the learner's actual sentence. It cannot access school records or external tools.\nDelegate to the backend when: the learner asks why a form is right, needs a comparison of tenses, asks for detailed feedback, struggles twice with one pattern, or asks a question needing careful reasoning. Delegate before giving an explanation that depends on this work; do not guess while waiting.\nDo not delegate to the backend when: you can naturally respond to a greeting, simple answer or follow-up, or need one brief clarification.\nCoaching: Encourage longer learner answers with one relevant follow-up. After a substantial answer, offer at most one useful grammar correction, never a running list. In grammar mode, keep returning to the selected pattern in meaningful examples. In unit mode, use only the verified context above or words the learner gives you. Repeat prompts must be five or six words maximum; split longer sentences and wait after each chunk. Never require verbatim recall of two sentences. If asked to finish, give one concrete strength and one next target. Feedback is practice advice, not a teacher assessment. Do not grade or claim precise pronunciation or CEFR from this call. Do not ask for identifying details.`,
      delegation: { type: "responses", responses: { model: "gpt-6-sol", instructions: `${coaching}\nMode: ${topic.title}. Goal: ${topic.target} ${focus} ${homeworkFocus}\nWhen delegated, return a concise explanation or coaching suggestion grounded in the learner's actual words. Identify one priority, show a short correct example, and give one open question or short practice step. If their meaning is unclear, ask rather than assume. Never write their homework for them. No external tools or actions.`, tools: [], tool_choice: "none" } },
    },
    transport: { type: "webrtc", sdp: body.sdp },
  };
}
