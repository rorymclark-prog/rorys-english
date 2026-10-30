export type CoachReference = {
  title: string;
  unit: string;
  overview: string;
  guide?: string;
  teacherNotes?: string;
  notesHistorical?: boolean;
};

/** Include the matching notes, not an arbitrary opening slice of a long guide. */
export function coachSlideNotes(notes: string, page: number): string {
  if (!Number.isSafeInteger(page) || page < 1) return "";
  const sections = notes.split(/(?=^#{1,4}\s+(?:Slide|Folie)\s+\d+\b)/im);
  return sections.find(section => new RegExp(`^#{1,4}\\s+(?:Slide|Folie)\\s+${page}\\b`, "i").test(section.trim()))?.trim().slice(0, 6000) || "";
}

export function coachReferenceSource(source: string, reference: CoachReference | null, page: number, embeddedNotes?: string): string {
  if (!reference && !embeddedNotes) return source.slice(0, 12000);
  const noteSource=embeddedNotes&&`Private teacher notes embedded in the selected PowerPoint (current slide; governs older supporting notes):\n${embeddedNotes.slice(0,4000)}`;
  if (!reference) return [source.slice(0,6500),noteSource].filter(Boolean).join("\n\n").slice(0,12000);
  const notes = coachSlideNotes(reference.teacherNotes || "", page);
  return [
    source && `Selected slide / exercise text:\n${source.slice(0, 6500)}`,
    `Selected saved preparation: ${reference.title}\n${reference.overview.slice(0, 1200)}`,
    reference.guide && `Current delivery guide (governs older media and book-opening directions):\n${reference.guide.slice(0, 2000)}`,
    noteSource || (notes && `${reference.notesHistorical ? "Supporting original teacher notes; check against the revised deck and delivery guide" : "Matching teacher notes"}:\n${notes}`),
  ].filter(Boolean).join("\n\n").slice(0, 12000);
}
