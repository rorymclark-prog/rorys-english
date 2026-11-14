export type GuidedSpeaking = {
  id: string;
  /** Which learner this conversation is for. Matched against the start of their code ("<learner>-…"), so no sign-in code is written into public browser code. */
  learner: string;
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
  optional?: boolean;
  maxSeconds?: number;
};

const conversations: GuidedSpeaking[] = [
  {
    id: "kashi-chat-1", learner: "kashi", unitId: "kashi-writing-spelling-start-2026", week: 1,
    topic: "story", unitLabel: "WRITING AND SPELLING", title: "Talk through your story.", savedTitle: "Writing and spelling · Session 1: story ideas",
    optional: true, maxSeconds: 180, duration: "3 minutes",
    focus: "Organise your own ideas for the same enjoyable day or small problem as your writing.",
    cue: "What happened → what you did → why it mattered → next time",
    prompt: "Talk about the enjoyable day or small problem you chose for Session 1. The AI will ask one short question at a time. Real or invented is fine.",
    purpose: "Saying your ideas aloud can help you organise your writing. Your written work is the main task; this chat cannot check your spelling.",
    instructions: "This is Kashi's optional Session 1 writing rehearsal, about three minutes. Writing and spelling are the main goals. Briefly introduce yourself as the AI partner, explain that this optional chat helps organise ideas, then ask: What enjoyable day or small problem will you write about? Use that same topic throughout. Ask one short question at a time, waiting for the learner's own answer: what happened, what they did, why it mattered, and what they would do next time. Accept invented details. Do not switch to an unrelated hobby, game, film or sport. If the learner is stuck, offer one short sentence starter and let them finish it. Do not dictate or write the finished 80–120-word homework or supply a complete example paragraph. Do not claim to have read their writing. Do not assess spelling from spoken answers or captions. After these ideas, briefly name one clear idea they supplied, then say: End this conversation, return to Session 1, and write your own answer. If they already wrote, invite one detail they might improve while preserving the original. Do not add further homework or require a separate recording or written chat report.",
  },
  {
    id: "kashi-chat-2", learner: "kashi", unitId: "kashi-writing-spelling-start-2026", week: 2,
    topic: "story", unitLabel: "WRITING AND SPELLING", title: "Make one sentence clearer.", savedTitle: "Writing and spelling · Session 2: improve one sentence",
    optional: true, maxSeconds: 180, duration: "3 minutes",
    focus: "Explain one idea from your first paragraph and say one clearer sentence before writing it yourself.",
    cue: "Your sentence → your meaning → your improved sentence",
    prompt: "Read aloud one sentence you want to improve from Session 1, or explain your idea. The AI will help you make that one sentence clearer. Write and check the spelling yourself afterwards.",
    purpose: "A short spoken retry can help you make one sentence clearer. The required work is still your five spellings and revised paragraph.",
    instructions: "This is Kashi's optional Session 2 writing revision rehearsal, about three minutes. Writing and spelling remain the main goals. Introduce yourself briefly as the AI partner, then ask: Which one sentence from your first paragraph would you like to improve? Ask the learner to read it aloud or explain the idea; you cannot see their saved paragraph and must not claim to have read it. If they have no paragraph yet, direct them back to finish Session 1 rather than inventing a completed submission. Ask one short question about what they mean or one useful detail. Offer at most one short explanation or sentence starter when needed, then let them produce their own clearer sentence. Do not rewrite the paragraph or dictate the complete homework. Do not infer misspellings from speech or captions, select five supposedly wrong words without written evidence, or claim to have checked spelling by listening. End by asking them to return to Session 2, write their improved sentence in their own revised paragraph, check their five chosen spellings in writing, and click Send answers to Rory. Keep the original separate. Do not require a separate recording or chat report or add more work.",
  },
  {
    id: "ferdi-chat-1", learner: "ferdi", unitId: "english-in-context5-unit01-2026", week: 1,
    topic: "story", unitLabel: "FAMILY LIFE", title: "Tell a family day-out story.", savedTitle: "Family life · Chat 1: story",
    focus: "Tell a family day-out story in order, using past verbs.", cue: "First → then → finally",
    prompt: "Tell me about a family day out when a small plan changed. Who was there, what happened, and how did it end? A real or invented family is fine.", duration: "12–15 minutes",
    purpose: "This is Family life practice: use family words, past verbs and first, then, finally. Talking through the story helps you prepare your own 5–7-sentence written answer.",
    instructions: "Invite a short real or imaginary family day-out story in which a small plan changed. Start by asking who went on the day out. Keep the family connection clear: a holiday or climbing trip is only an example if it involves the family. A completely invented family is welcome; do not press for private family details. Help the learner use past verbs, first, then, finally and because. Ask one simple follow-up at a time. Explain briefly that this is oral rehearsal for their own 5–7-sentence written story. Treat model sentences as short starters, not a script; do not dictate or write the finished homework.",
  },
  {
    id: "ferdi-chat-2", learner: "ferdi", unitId: "english-in-context5-unit01-2026", week: 2,
    topic: "unit", unitLabel: "FAMILY LIFE", title: "Talk about family life.", savedTitle: "Family life · Chat 2: usually and now",
    focus: "Describe a usual routine, a past weekend and a reason.", cue: "Usually → last weekend → because",
    prompt: "Tell me what your family usually does, what happened last weekend, and one thing you liked or would change. An invented family is fine.", duration: "12–15 minutes",
    purpose: "Practise the three parts of your email: a usual routine, a past-weekend story, and something you like or would change with a reason.",
    instructions: "Rehearse the existing family-life email without writing it for the learner. Ask one question at a time: what a real or invented family usually does, what happened on a past weekend, and one thing they like or would change with a because reason. Help with present simple for routines and past verbs for the weekend only when needed. Invite their own new example after a short hint. A fictional family is welcome; do not request private details.",
  },
  {
    id: "valentin-chat-2", learner: "valentin", unitId: "way2go8-unit01-2026", week: 2,
    topic: "unit", unitLabel: "HEALTHY AND HAPPY", title: "Discuss healthy habits.", savedTitle: "Healthy and happy · Chat 2: healthy habits",
    focus: "Explain choices and respond to a challenge.", cue: "Habit → reason → example → challenge",
    prompt: "Discuss two realistic habits that could help someone through a busy school week. Give reasons, examples and one possible obstacle. You can speak about an imaginary student.", duration: "8–10 minutes",
    instructions: "Discuss two general healthy habits for a busy school week. Ask for a reason and concrete example for each, then raise one realistic obstacle and invite a response. Encourage linking phrases and a balanced view. Do not request personal medical information or give individual medical advice. Do not turn the exchange into a memorised monologue.",
  },
  {
    id: "valentin-chat-3", learner: "valentin", unitId: "way2go8-unit01-2026", week: 3,
    topic: "unit", unitLabel: "HEALTHY AND HAPPY", title: "Discuss a school wellbeing idea.", savedTitle: "Healthy and happy · Chat 3: school proposal",
    focus: "Make a proposal and respond politely.", cue: "Proposal → benefits → concern → response",
    prompt: "Suggest one realistic school wellbeing activity. Your partner will ask how it could work and raise one concern. Respond politely, then ask a question back.", duration: "8–10 minutes",
    instructions: "Role-play a school representative considering a student wellbeing proposal. Ask for the proposal, two benefits and a practical example. Raise one plausible concern and let the learner respond politely. Prompt one follow-up question from the learner. Keep this as spoken rehearsal; do not dictate or write the email for them. Avoid personal medical details.",
  },
];

export function guidedSpeaking(studentCode: string, id: string | null | undefined): GuidedSpeaking | null {
  return conversations.find(chat => studentCode.startsWith(`${chat.learner}-`) && chat.id === id) || null;
}

export function guidedSpeakingForHomework(studentCode: string, unitId: string, week: number): GuidedSpeaking | null {
  return conversations.find(chat => studentCode.startsWith(`${chat.learner}-`) && chat.unitId === unitId && chat.week === week) || null;
}

export function optionalGuidedSpeaking(studentCode: string): GuidedSpeaking[] {
  return conversations.filter(chat => chat.optional && studentCode.startsWith(`${chat.learner}-`));
}
