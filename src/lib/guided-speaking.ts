export type GuidedSpeaking = {
  id: string;
  studentCode: string;
  unitId: string;
  week: number;
  topic: "story" | "unit";
  unitLabel: string;
  title: string;
  savedTitle: string;
  focus: string;
  cue: string;
  prompt: string;
  duration: string;
  instructions: string;
};

const conversations: GuidedSpeaking[] = [
  {
    id: "ferdi-chat-1", studentCode: "ferdi-7h3k", unitId: "english-in-context5-unit01-2026", week: 1,
    topic: "story", unitLabel: "FAMILY LIFE", title: "Tell your story.", savedTitle: "Family life · Chat 1: story",
    focus: "Tell a short story in order.", cue: "First → then → finally",
    prompt: "Talk about a holiday or climbing day when a small plan changed. Use your own details.", duration: "12–15 minutes",
    instructions: "Invite a short real or imaginary holiday or climbing-day story. Help the learner use first, then and finally. Ask one simple follow-up at a time. Treat model sentences as starters and encourage the learner's own details.",
  },
  {
    id: "ferdi-chat-2", studentCode: "ferdi-7h3k", unitId: "english-in-context5-unit01-2026", week: 2,
    topic: "unit", unitLabel: "FAMILY LIFE", title: "Talk about family life.", savedTitle: "Family life · Chat 2: usually and now",
    focus: "Compare a normal day with today.", cue: "Usually ↔ now",
    prompt: "Compare what your family usually does with what they are doing now.", duration: "12–15 minutes",
    instructions: "Ask about what the learner's family or an invented family usually does and what they are doing now. Help them contrast present simple and present continuous in their own examples. Ask simple questions and give one brief model if they get stuck.",
  },
  {
    id: "valentin-chat-2", studentCode: "valentin-q9m2", unitId: "way2go8-unit01-2026", week: 2,
    topic: "unit", unitLabel: "HEALTHY AND HAPPY", title: "Discuss healthy habits.", savedTitle: "Healthy and happy · Chat 2: healthy habits",
    focus: "Explain choices and respond to a challenge.", cue: "Habit → reason → example → challenge",
    prompt: "Discuss two realistic habits that could help someone through a busy school week. Give reasons, examples and one possible obstacle. You can speak about an imaginary student.", duration: "8–10 minutes",
    instructions: "Discuss two general healthy habits for a busy school week. Ask for a reason and concrete example for each, then raise one realistic obstacle and invite a response. Encourage linking phrases and a balanced view. Do not request personal medical information or give individual medical advice. Do not turn the exchange into a memorised monologue.",
  },
  {
    id: "valentin-chat-3", studentCode: "valentin-q9m2", unitId: "way2go8-unit01-2026", week: 3,
    topic: "unit", unitLabel: "HEALTHY AND HAPPY", title: "Discuss a school wellbeing idea.", savedTitle: "Healthy and happy · Chat 3: school proposal",
    focus: "Make a proposal and respond politely.", cue: "Proposal → benefits → concern → response",
    prompt: "Suggest one realistic school wellbeing activity. Your partner will ask how it could work and raise one concern. Respond politely, then ask a question back.", duration: "8–10 minutes",
    instructions: "Role-play a school representative considering a student wellbeing proposal. Ask for the proposal, two benefits and a practical example. Raise one plausible concern and let the learner respond politely. Prompt one follow-up question from the learner. Keep this as spoken rehearsal; do not dictate or write the email for them. Avoid personal medical details.",
  },
];

export function guidedSpeaking(studentCode: string, id: string | null | undefined): GuidedSpeaking | null {
  return conversations.find(chat => chat.studentCode === studentCode && chat.id === id) || null;
}

export function guidedSpeakingForHomework(studentCode: string, unitId: string, week: number): GuidedSpeaking | null {
  return conversations.find(chat => chat.studentCode === studentCode && chat.unitId === unitId && chat.week === week) || null;
}
