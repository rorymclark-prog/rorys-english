import type { LearningRecord } from "./learning";
import { teachingFiles, type TeachingFile } from "./teaching-files";
import { getYearPlan } from "./year-plans";

export type CoachLessonResource = {
  title: string;
  url: string;
  unit: string;
  schoolYear: string;
  blurb?: string;
};

export type CoachLearnerLibrary = {
  studentId: string;
  resources: CoachLessonResource[];
};

export type CoachLessonSelection = {
  id: string;
  learnerCode: string;
  kind: "plan" | "pack";
  title: string;
  unitLabel: string;
  task: string;
  objective: string;
  source: string;
  files: TeachingFile[];
};

/** Only an approved resource belonging to this learner can be opened in-app. */
export function coachPdfResources(library?: CoachLearnerLibrary): CoachLessonResource[] {
  if (!library || !/^[a-z0-9_-]+$/i.test(library.studentId)) return [];
  const prefix = `/lessons/${library.studentId}/`;
  return library.resources.filter(resource => {
    const path = resource.url;
    return path.startsWith(prefix) && /\.pdf$/i.test(path) &&
      !/[\\%?#]/.test(path) && !path.includes("//") &&
      !path.split("/").some(part => part === "." || part === "..");
  });
}

export function coachPlanLessons(code: string, studentId?: string): CoachLessonSelection[] {
  const plan = studentId ? getYearPlan(studentId) : undefined;
  if (!plan) return [];
  return plan.units.map(unit => {
    const title = `Unit ${unit.number} · ${unit.title}`;
    const unitLabel = `${plan.book} · ${plan.schoolYear}`;
    const pages = unit.pages.join("–");
    return {
      id: `plan:${studentId}:${unit.number}`,
      learnerCode: code,
      kind: "plan" as const,
      title,
      unitLabel,
      task: title.slice(0, 500),
      objective: [unit.focus, `Writing: ${unit.writing}`].join("\n").slice(0, 700),
      source: [
        "Saved annual learning plan · preparation only, not evidence of work completed or ability.",
        "This is a plan overview. The textbook pages, slides and linked files have not been read in this workspace.",
        unitLabel,
        title,
        `Book pages: ${pages}`,
        `Language focus: ${unit.focus}`,
        `Writing: ${unit.writing}`,
      ].join("\n").slice(0, 12000),
      files: [],
    };
  });
}

export function coachSavedLessons(code: string, records: LearningRecord[]): CoachLessonSelection[] {
  return records.flatMap(record => {
    const files = teachingFiles(record);
    if (!files.length) return [];
    const points = [record.body.lessonPoints, record.body.nextStep].filter(Boolean).join("\n");
    return [{
      id: `pack:${record.id}`,
      learnerCode: code,
      kind: "pack" as const,
      title: record.title,
      unitLabel: `${record.date} · Private teaching preparation`,
      task: record.title.slice(0, 500),
      objective: (points || record.body.summary || "Use the selected preparation as context; check the current activity against the original lesson.").slice(0, 700),
      source: [
        "Saved private teaching preparation · not evidence of a completed lesson or learner ability.",
        "Only the saved preparation text below is available. Linked PowerPoint, PDF and teacher-note contents have not been read in this workspace.",
        `Preparation: ${record.title}`,
        `Saved lesson date: ${record.date}`,
        record.body.summary,
        record.body.studentNotes,
        record.body.lessonPoints,
        record.body.nextStep && `Planned next step: ${record.body.nextStep}`,
      ].filter(Boolean).join("\n").slice(0, 12000),
      files,
    }];
  }).sort((a, b) => b.unitLabel.localeCompare(a.unitLabel));
}

export function matchesCoachLesson(query: string, ...text: (string | undefined)[]): boolean {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const haystack = text.filter(Boolean).join(" ").toLocaleLowerCase();
  return words.every(word => haystack.includes(word));
}
