import type { CoachTurn, LessonSnapshot } from "./coach-archive";

/** Feedback for a mislabelled voice is invalid evidence, even after relabelling. */
export function correctCoachSpeaker(snapshot: LessonSnapshot, id: string, role: "learner" | "teacher" | "unknown"): LessonSnapshot {
  const turn = snapshot.turns.find(item => item.id === id);
  if (!turn || turn.role === role || turn.role === "ai") return snapshot;
  return {
    ...snapshot,
    turns: snapshot.turns.filter(item => item.sourceTurnId !== id).map((item): CoachTurn => item.id === id ? { ...item, role } : item),
    entries: snapshot.entries.filter(entry => entry.sourceTurnId !== id),
  };
}
