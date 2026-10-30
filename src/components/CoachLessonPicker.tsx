"use client";

import { useEffect, useState } from "react";
import { getLearning, type LearningRecord } from "@/lib/learning";
import {
  coachPdfResources, coachPlanLessons, coachSavedLessons, matchesCoachLesson,
  type CoachLearnerLibrary, type CoachLessonResource, type CoachLessonSelection,
} from "@/lib/coach-lessons";

type ScopedRecords = {
  code: string;
  status: "loading" | "ready" | "error";
  records: LearningRecord[];
  error: string;
};

export default function CoachLessonPicker({
  code, name, library, blocked = false, selectedId = "", onSelect, onOpenPdf,
}: {
  code: string;
  name: string;
  library?: CoachLearnerLibrary;
  blocked?: boolean;
  selectedId?: string;
  onSelect: (lesson: CoachLessonSelection) => void;
  onOpenPdf: (resource: CoachLessonResource) => void | Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [retry, setRetry] = useState(0);
  const [scope, setScope] = useState<ScopedRecords>({ code, status: "loading", records: [], error: "" });

  useEffect(() => {
    let current = true;
    setQuery("");
    setScope({ code, status: "loading", records: [], error: "" });
    if (!code) {
      setScope({ code, status: "ready", records: [], error: "" });
      return () => { current = false; };
    }
    void getLearning(code, true).then(result => {
      if (!current) return;
      if (!result.ok) throw new Error(result.error || "Saved teaching packs could not be opened.");
      setScope({ code, status: "ready", records: result.records || [], error: "" });
    }).catch(error => {
      if (current) setScope({ code, status: "error", records: [], error: error instanceof Error ? error.message : "Saved teaching packs could not be opened." });
    });
    return () => { current = false; };
  }, [code, retry]);

  const loaded = scope.code === code;
  const packs = coachSavedLessons(code, loaded ? scope.records : []);
  const plans = coachPlanLessons(code, library?.studentId);
  const resources = coachPdfResources(library);
  const lessons = [...packs, ...plans];
  const selected = lessons.find(lesson => lesson.id === selectedId);
  const shown = lessons.filter(lesson => matchesCoachLesson(query, lesson.title, lesson.unitLabel, lesson.objective));
  const shownResources = resources.filter(resource => matchesCoachLesson(query, resource.title, resource.unit, resource.schoolYear));
  const loading = !loaded || scope.status === "loading";

  return <section className="lc-saved-lessons" aria-label={`${name}’s saved lessons`}>
    <div className="lc-section-title"><h3>Choose from {name}’s lessons</h3><span className="lc-badge">PRIVATE REFERENCE</span></div>
    <p className="lc-hint">Use a saved teaching pack, an approved slide PDF, or a unit from the learning plan.</p>
    <label>Find a lesson<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search lesson, unit or language focus…"/></label>
    {loading && <p className="lc-hint" role="status">Opening {name}’s saved teaching packs…</p>}
    {loaded && scope.status === "error" && <p className="lc-error" role="alert">{scope.error} <button type="button" className="lc-link" disabled={blocked} onClick={() => setRetry(value => value + 1)}>Try again</button></p>}
    {selected && <div className="lc-selected-lesson" role="status"><strong>Selected reference: {selected.title}</strong><p className="lc-hint">{selected.kind === "pack" ? "Saved preparation text is selected. Open the original files below to teach from the full lesson." : "Learning-plan overview selected. Open lesson slides or a document to add the actual exercise."}</p>{!!selected.files.length && <ul className="lc-lesson-links">{selected.files.map(file => <li key={file.url}><a className="lc-link" href={file.url} target="_blank" rel="noopener noreferrer">{file.label} ↗</a></li>)}</ul>}</div>}
    <label>App lesson or learning-plan unit<select value={selectedId.startsWith("plan:")||selectedId.startsWith("pack:")||selectedId.startsWith("pdf:")?selectedId:""} disabled={blocked} onChange={event=>{const value=event.target.value;if(value.startsWith("pdf:")){const resource=shownResources.find(item=>`pdf:${item.url}`===value);if(resource)void onOpenPdf(resource);}else{const lesson=lessons.find(item=>item.id===value);if(lesson)onSelect(lesson);}}}><option value="">Choose a lesson…</option>{!!shownResources.length&&<optgroup label="Ready slide PDFs">{shownResources.map(resource=><option key={resource.url} value={`pdf:${resource.url}`}>{resource.title} · {resource.schoolYear}</option>)}</optgroup>}{shown.some(lesson=>lesson.kind==="pack")&&<optgroup label="Saved private teaching packs">{shown.filter(lesson=>lesson.kind==="pack").map(lesson=><option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}</optgroup>}<optgroup label="Learning-plan overviews · open a document for the exercises">{shown.filter(lesson=>lesson.kind==="plan").map(lesson=><option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}</optgroup></select></label>
    {!shown.length && !shownResources.length && <p className="lc-hint">{query.trim() ? "No matching lessons. Try another unit, title or focus." : loading ? "Your learning plan and available slides will appear here." : "No saved teaching packs or linked slides are available for this learner yet. You can still open a document below."}</p>}
    {!loading && !packs.length && plans.length > 0 && scope.status !== "error" && <p className="lc-hint">This learner’s plan is available. No private teaching-pack links are saved in the app yet.</p>}
    <p className="lc-hint">Plan overviews and saved summaries provide preparation context. The AI can read a linked file’s contents only after you open its PDF or import the document.</p>
  </section>;
}
