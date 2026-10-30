export type CoachFolderFile = File & { webkitRelativePath: string };
export type CoachFolderLesson = { id: string; learner: "ferdi" | "valentin"; title: string; format: string; document: File; guide?: File };

/** Inspect only manifest metadata; document bytes are read after selection. */
export async function readCoachFolder(files: CoachFolderFile[]): Promise<CoachFolderLesson[]> {
  if (files.length > 10000) throw new Error("Choose the saved English lesson folder, rather than a larger documents folder.");
  const relative = (file: CoachFolderFile) => file.webkitRelativePath.split("/").slice(1).join("/");
  const safe = (path: string) => !!path && !path.includes("\\") && !path.split("/").some(part => !part || part === "." || part === "..");
  const manifest = files.find(file => relative(file) === "Current_Library_Manifest.json");
  if (!manifest || manifest.size > 2_000_000) throw new Error("Choose Rorys-English-Lesson-Library, containing Current_Library_Manifest.json and the Ferdi and Valentin folders.");
  const data = JSON.parse(await manifest.text());
  if (data?.schema !== 1 || !Array.isArray(data.packs) || data.packs.length > 500) throw new Error("This saved lesson catalogue is not supported.");
  const paths = new Map(files.filter(file => safe(relative(file))).map(file => [relative(file), file]));
  const result: CoachFolderLesson[] = [];
  for (const pack of data.packs) {
    const learner = pack.learner === "Ferdi" ? "ferdi" : pack.learner === "Valentin" ? "valentin" : null;
    if (!learner || typeof pack.directory !== "string" || !safe(pack.directory) || !pack.directory.startsWith(`${pack.learner}/`) || typeof pack.title !== "string" || pack.title.length > 500) continue;
    const directory = pack.directory;
    const document = paths.get(`${directory}/Teaching.pptx`) || paths.get(`${directory}/Student_Slides.pdf`);
    if (!document) continue;
    result.push({ id: directory, learner, title: pack.title, format: typeof pack.format === "string" ? pack.format.slice(0, 120) : "Prepared lesson", document, guide: paths.get(`${directory}/Delivery_Guide.md`) });
  }
  if (!result.length) throw new Error("No prepared lesson PowerPoints or slide PDFs were found in this folder.");
  return result;
}
