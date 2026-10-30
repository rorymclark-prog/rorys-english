"use client";

import { useEffect, useRef, useState } from "react";
import { matchesCoachLesson } from "@/lib/coach-lessons";
import { CoachLibraryClient, COACH_LIBRARY_ORIGIN, libraryReference, readLibraryCatalogue, readLibraryContext, readLibraryMaterial, type LibraryCatalogue, type LibraryLearner, type LibraryPack } from "@/lib/coach-library";

export type CoachCloudLesson = { learnerCode: string; packId: string; title: string; unitLabel: string; task: string; objective: string; reference: string; guide: string; teacherNotes: string; notesHistorical: boolean; edition: string };
export type CoachCloudMaterialMeta = { learnerCode: string; packId: string; title: string; focus: string; historical: boolean; warning: string; edition: string; guide?: string; teacherNotes?: string; notesHistorical?: boolean };

export default function CoachLibraryConnection({ code, name, studentId, blocked = false, selectedId = "", onSelect, onOpenPdf, onOpenPowerPoint, onBusyChange }: {
  code: string;
  name: string;
  studentId?: string;
  blocked?: boolean;
  selectedId?: string;
  onBusyChange?: (busy: boolean) => void;
  onSelect: (selection: CoachCloudLesson) => void;
  onOpenPdf: (file: File, meta: CoachCloudMaterialMeta) => void | Promise<void>;
  onOpenPowerPoint: (file: File, meta: CoachCloudMaterialMeta) => void | Promise<void>;
}) {
  const learner: LibraryLearner | undefined = studentId === "ferdi" ? "Ferdi" : studentId === "valentin" ? "Valentin" : undefined;
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [catalogue, setCatalogue] = useState<{ code: string; data: LibraryCatalogue } | null>(null);
  const [selected, setSelected] = useState<{ code: string; packId: string; title: string; historical: boolean } | null>(null);
  const client = useRef<CoachLibraryClient | null>(null);
  const scope = useRef(code); scope.current = code;
  const revision = useRef(0);
  const inFlight = useRef(false);
  useEffect(() => { onBusyChange?.(!!busy); return () => onBusyChange?.(false); }, [busy,onBusyChange]);

  useEffect(() => {
    const current = ++revision.current;
    inFlight.current = false; setConnected(false); setBusy(""); setError(""); setCatalogue(null); setSelected(null); setQuery("");
    const connection = new CoachLibraryClient(window, () => { if (revision.current === current) setConnected(false); });
    client.current = connection;
    return () => { revision.current++; client.current = null; connection.close(); };
  }, [code, studentId]);

  async function connect() {
    if (blocked || inFlight.current || !learner || !client.current) return;
    const connection = client.current, current = revision.current, owner = code;
    inFlight.current = true; setBusy("Connecting private library…"); setError("");
    try {
      await connection.connect();
      const result = readLibraryCatalogue(await connection.request({ action: "catalogue", learner }), learner);
      if (scope.current !== owner || revision.current !== current) return;
      setCatalogue({ code: owner, data: result }); setConnected(true);
    } catch (error) { if (scope.current === owner && revision.current === current) setError(error instanceof Error ? error.message : "The private library could not connect."); }
    finally { if (scope.current === owner && revision.current === current) { inFlight.current = false; setBusy(""); } }
  }

  async function openPack(pack: LibraryPack, asset: "context" | "pdf" | "powerpoint") {
    if (blocked || inFlight.current || !learner || !client.current || pack.learner !== learner) return;
    const connection = client.current, current = revision.current, owner = code;
    inFlight.current = true; setError(""); setBusy(asset === "context" ? "Opening saved lesson guidance…" : asset === "pdf" ? "Opening supporting PDF…" : "Opening PowerPoint text…");
    try {
      const data = await connection.request({ action: "lesson", learner, packId: pack.id, asset });
      if (scope.current !== owner || revision.current !== current) return;
      if (asset === "context") {
        const context = readLibraryContext(data, learner, pack.id);
        onSelect({ learnerCode: owner, packId: pack.id, title: context.pack.title, unitLabel: `${learner} · ${context.edition}`, task: context.pack.title.slice(0, 500), objective: context.pack.focus.slice(0, 700), reference: libraryReference(context), guide: context.guide, teacherNotes: context.teacherNotes, notesHistorical: context.notesHistorical, edition: context.edition });
        setSelected({ code: owner, packId: pack.id, title: pack.title, historical: context.notesHistorical });
      } else {
        const material = readLibraryMaterial(data, learner, pack.id, asset);
        const file = new File([material.data], material.name, { type: material.type });
        const meta = { learnerCode: owner, packId: pack.id, title: pack.title, focus: pack.focus, historical: material.historical, warning: material.warning, edition: material.edition };
        await (asset === "pdf" ? onOpenPdf(file, meta) : onOpenPowerPoint(file, meta));
      }
    } catch (error) { if (scope.current === owner && revision.current === current) setError(error instanceof Error ? error.message : "This saved lesson could not be opened."); }
    finally { if (scope.current === owner && revision.current === current) { inFlight.current = false; setBusy(""); } }
  }

  const activeCatalogue = catalogue?.code === code ? catalogue.data : null;
  const activeSelected = selected?.code === code && selectedId === `cloud:${selected.packId}` ? selected : null;
  const packs = activeCatalogue?.packs.filter(pack => matchesCoachLesson(query, pack.title, pack.focus, pack.format)) || [];
  return <section className="lc-cloud-library" aria-label={`${name}’s complete lesson library`}>
    <div className="lc-section-title"><h3>{name}’s complete lesson library</h3><span className="lc-badge">SAVED LESSON PACKS</span></div>
    <p className="lc-hint">Connect your private library to select a prepared lesson and use its delivery guide as AI reference.</p>
    <div className="lc-actions"><button type="button" className="teacher-quiet-button" disabled={blocked || !!busy || !learner} onClick={() => void connect()}>{connected ? "Refresh lesson library" : "Connect private lesson library ↗"}</button><a className="lc-link" href={COACH_LIBRARY_ORIGIN} target="_blank" rel="noopener noreferrer">Open lesson library ↗</a></div>
    {busy && <p className="lc-hint" role="status">{busy}{busy.startsWith("Connecting") ? " Sign in in the library window if asked, then keep it open until the lessons appear." : ""}</p>}
    {error && <p className="lc-error" role="alert">{error}</p>}
    {!learner && <p className="lc-hint">The complete library is currently available for Ferdi and Valentin.</p>}
    {activeSelected && <div className="lc-selected-lesson" role="status"><strong>Saved reference: {activeSelected.title}</strong><p className="lc-hint">{activeSelected.historical ? "The current delivery guide is used for guidance. Older teacher notes and supporting PDFs may differ from the revised lesson." : "Saved preparation is available as reference. Check the current activity against the original material."}</p></div>}
    {activeCatalogue && <><label>Find a saved lesson<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search lesson, unit or teaching format…"/></label><p className="lc-hint">{activeCatalogue.edition} · {activeCatalogue.packs.length} packs for {name}{!connected ? " · reconnect to open another lesson" : ""}</p><div className="lc-lesson-options">{packs.map(pack => <article className={`lc-lesson-option ${activeSelected?.packId === pack.id ? "is-selected" : ""}`} key={pack.id}><div><small>{pack.format}</small><strong>{pack.title}</strong><p>{pack.focus}</p></div><div className="lc-actions"><button type="button" className="teacher-quiet-button" disabled={blocked || !!busy || !connected} onClick={() => void openPack(pack, "context")}>Use lesson guidance</button>{pack.files.some(file => file.type === "pptx") && <button type="button" className="teacher-quiet-button" disabled={blocked || !!busy || !connected} onClick={() => void openPack(pack, "powerpoint")}>Use current PowerPoint text</button>}{pack.files.some(file => file.type === "pdf") && <button type="button" className="lc-link" disabled={blocked || !!busy || !connected} onClick={() => void openPack(pack, "pdf")}>Open supporting PDF</button>}</div></article>)}</div>{!packs.length && <p className="lc-hint">No lessons match that search.</p>}</>}
    <p className="lc-hint">The private library opens separately. Keep its window open while selecting files; closing it leaves the current lesson reference in place. Supporting PDFs can be from an earlier edition and do not play PowerPoint reveals, audio or video.</p>
  </section>;
}
