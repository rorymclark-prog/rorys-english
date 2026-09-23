// A reference inside the existing immutable answer format, never a public URL.
// Opening it still requires the student's/parent's or teacher's authenticated
// document service, which enforces ownership independently of this text.
export function handwritingReference(id: string): string {
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(id)) throw new Error("Invalid document reference");
  return `[Handwritten answer: ${id}]`;
}
export function handwritingParts(answer: string): { text: string; documentIds: string[] } {
  const ids: string[] = [];
  const text = answer.replace(/(?:\r?\n)?\[Handwritten answer: ([A-Za-z0-9_-]{16,100})\]/g, (_, id: string) => {
    if (!ids.includes(id)) ids.push(id);
    return "";
  });
  return { text, documentIds: ids.slice(0, 6) };
}
