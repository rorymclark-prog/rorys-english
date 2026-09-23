import type { Assignment } from "./remote";

export function isFerdiSpeakingHomework(code: string, assignment: Assignment) {
  return code === "ferdi-7h3k" && /Chat 1:\s*Tell a story/i.test(assignment.details)
    && /Chat 2:\s*Compare/i.test(assignment.details);
}
