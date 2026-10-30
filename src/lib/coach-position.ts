export type LessonPage = { number: number; text: string; notes?: string };
export type LessonPosition = { page: number; total: number; mode: "auto" | "manual"; index: string };

/** Every page has a place in the map, including later reserve/answer pages. */
export function coachLessonMap(pages: LessonPage[]): string {
  if (!pages.length) return "";
  const width = Math.min(1400, Math.floor(40000 / pages.length) - 24);
  return pages.slice(0, 300).map(page => `PAGE ${page.number}: ${page.text.replace(/\s+/g, " ").trim().slice(0, Math.max(80, width)) || "[image-only page; use its visible image]"}`).join("\n").slice(0, 40000);
}

const ignored = new Set("the and that this with from your have what when where which about would could should there their then they were been into some more very lesson slide page exercise answer teacher student learner rory ferdi valentin".split(" "));
function words(value: string): Set<string> {
  return new Set((value.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(word => word.length > 2 && !ignored.has(word)));
}

/** Require real document evidence as well as the model's self-reported
 * confidence. This never moves the displayed/student slide or confirms work. */
export function verifiedCoachPosition(candidate: { page: number; confidence: string }, caption: string, pages: LessonPage[]): number | null {
  if (candidate.confidence !== "high" || !Number.isSafeInteger(candidate.page) || candidate.page < 1 || candidate.page > pages.length) return null;
  if (!pages.some(page => page.number === candidate.page && page.text.trim())) return null;
  const explicit = [...caption.matchAll(/\b(?:slide|page)\s+(\d{1,3})\b/gi)].map(match => Number(match[1]));
  if (explicit.length) return explicit.every(page => page === candidate.page) ? candidate.page : null;
  const spoken = words(caption);
  if (spoken.size < 3) return null;
  const scores = pages.map(page => ({ page: page.number, score: [...words(page.text)].filter(word => spoken.has(word)).length }));
  const target = scores.find(item => item.page === candidate.page)!;
  const other = Math.max(0, ...scores.filter(item => item.page !== candidate.page).map(item => item.score));
  return target.score >= 3 && target.score >= other + 2 ? candidate.page : null;
}
