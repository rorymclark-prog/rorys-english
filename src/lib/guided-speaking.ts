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
  purpose?: string;
  duration: string;
  instructions: string;
};

const conversations: GuidedSpeaking[] = [
  {
    id: "ferdi-chat-1", studentCode: "ferdi-7h3k", unitId: "english-in-context5-unit01-2026", week: 1,
    topic: "story", unitLabel: "FAMILY LIFE", title: "Tell a family day-out story.", savedTitle: "Family life · Chat 1: story",
    focus: "Tell a family day-out story in order, using past verbs.", cue: "First → then → finally",
    prompt: "Tell me about a family day out when a small plan changed. Who was there, what happened, and how did it end? A real or invented family is fine.", duration: "12–15 minutes",
    purpose: "This is Family life practice: use family words, past verbs and first, then, finally. Talking through the story helps you prepare your own 5–7-sentence written answer.",
    instructions: "Invite a short real or imaginary family day-out story in which a small plan changed. Start by asking who went on the day out. Keep the family connection clear: a holiday or climbing trip is only an example if it involves the family. A completely invented family is welcome; do not press for private family details. Help the learner use past verbs, first, then, finally and because. Ask one simple follow-up at a time. Explain briefly that this is oral rehearsal for their own 5–7-sentence written story. Treat model sentences as short starters, not a script; do not dictate or write the finished homework.",
  },
  {
    id: "ferdi-chat-2", studentCode: "ferdi-7h3k", unitId: "english-in-context5-unit01-2026", week: 2,
    topic: "unit", unitLabel: "FAMILY LIFE", title: "Talk about family life.", savedTitle: "Family life · Chat 2: usually and now",
    focus: "Describe a usual routine, a past weekend and a reason.", cue: "Usually → last weekend → because",
    prompt: "Tell me what your family usually does, what happened last weekend, and one thing you liked or would change. An invented family is fine.", duration: "12–15 minutes",
    purpose: "Practise the three parts of your email: a usual routine, a past-weekend story, and something you like or would change with a reason.",
    instructions: "Rehearse the existing family-life email without writing it for the learner. Ask one question at a time: what a real or invented family usually does, what happened on a past weekend, and one thing they like or would change with a because reason. Help with present simple for routines and past verbs for the weekend only when needed. Invite their own new example after a short hint. A fictional family is welcome; do not request private details.",
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
