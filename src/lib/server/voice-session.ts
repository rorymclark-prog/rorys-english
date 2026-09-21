import type { Account, Identity } from "./account-service";
export type VoiceRequest = { code?: unknown; token?: unknown; sdp?: unknown; topic?: unknown; preview?: unknown; teacherTest?: unknown };
export const voiceTopics: Record<string, { title: string; target: string }> = {
  everyday: { title: "Everyday conversation", target: "Give a complete answer, add a reason and ask a follow-up question." },
  opinions: { title: "Ideas & opinions", target: "State an opinion, support it with an example, and respond politely to a different view." },
  story: { title: "Tell a story", target: "Describe a real or imaginary event using a clear sequence and past tenses." },
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
export function voiceConfiguration(body: VoiceRequest) {
  if (typeof body.sdp !== "string" || body.sdp.length > 50000 || !body.sdp.startsWith("v=0")) throw new Error("The microphone connection could not be prepared.");
  if (typeof body.topic !== "string" || !Object.hasOwn(voiceTopics, body.topic)) throw new Error("Choose a speaking topic.");
  const topic = voiceTopics[body.topic];
  return {
    session: {
      model: "gpt-live-1", store: false,
      audio: { output: { voice: "vesper" } },
      instructions: `You are an AI English conversation partner in Rory's English, for a secondary-school learner. Speak clear, natural British English. Keep each turn short and ask one question at a time. Let the learner finish. Adapt your language to their demonstrated level, without assuming a CEFR level. Today's topic: ${topic.title}. Target: ${topic.target} Encourage the learner to speak most of the time. Use one gentle correction at a time and ask them to try again. Do not write their homework for them. Do not claim to be Rory, award grades, certify proficiency, save homework, or claim to know their private school materials. Explain that feedback is practice advice, not a teacher assessment. Use age-appropriate, non-sensitive topics and never request personal identifying details. If asked to finish, give one concrete strength, one next target, and invite the learner to keep one useful phrase.`,
      delegation: { type: "responses", responses: { model: "gpt-5.6-terra", instructions: "Support a brief English-learning conversation. No external tools or actions. Give concise language explanations when needed. Do not invent student records or school textbook content.", tools: [], tool_choice: "none" } },
    },
    transport: { type: "webrtc", sdp: body.sdp },
  };
}
