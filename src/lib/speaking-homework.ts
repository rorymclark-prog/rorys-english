import type { Assignment } from "./remote";

export function isFerdiSpeakingHomework(code: string, assignment: Assignment) {
  return code === "ferdi-7h3k" && /Chat 1:\s*Tell a story/i.test(assignment.details)
    && /Chat 2:\s*Compare/i.test(assignment.details);
}

export type Caption = { speaker: "You" | "AI partner"; delta: string; start_ms: number };

/** Keep every caption in bounded fields that the existing progress service accepts. */
export function captionParts(captions: Caption[], maxChars = 4500): string[] {
  const turns: Caption[] = [];
  for (const fragment of captions) {
    const previous = turns.at(-1);
    if (previous?.speaker === fragment.speaker) previous.delta += fragment.delta;
    else turns.push({ ...fragment });
  }
  const text = turns.map(f => `[${(f.start_ms / 1000).toFixed(1)}s] ${f.speaker}: ${f.delta}`).join("\n");
  if (!text) return [];
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length) {
    if (remaining.length <= maxChars) { parts.push(remaining); break; }
    let cut = remaining.lastIndexOf("\n", maxChars);
    if (cut < maxChars / 2) cut = maxChars;
    else cut += 1;
    parts.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut);
  }
  return parts;
}
