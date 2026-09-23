"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { documentRequest, fileBase64, validateDocumentFiles } from "@/lib/documents";
import { handwritingReference } from "@/lib/handwritten-answer";
import { isStudentPreview } from "@/lib/student-preview";
const Scanner = dynamic(() => import("./DocumentScanner"), { ssr: false });

export default function HandwrittenAnswer({ code, title, context, disabled = false, onSaved, onBusyChange }: {
  code: string; title: string; context: string; disabled?: boolean; onSaved: (reference: string) => void; onBusyChange?: (busy: boolean) => void;
}) {
  const [scanning, setScanning] = useState(false), [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [previews, setPreviews] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null), uploadId = useRef(crypto.randomUUID());
  const blocked = disabled || isStudentPreview(code);
  useEffect(() => {
    const urls = files.map(file => URL.createObjectURL(file)); setPreviews(urls);
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    if (files.length) window.addEventListener("beforeunload", warn);
    return () => { urls.forEach(url => URL.revokeObjectURL(url)); window.removeEventListener("beforeunload", warn); };
  }, [files]);
  function choose(next: File[]) {
    if (!next.length) return;
    const error = validateDocumentFiles(next);
    if (error) { setMessage(error); return; }
    setFiles(next); uploadId.current = crypto.randomUUID(); setMessage("");
  }
  async function save() {
    if (blocked || busy || !files.length) return;
    setBusy(true); onBusyChange?.(true); setMessage("");
    try {
      const r = await documentRequest(code, false, { action: "documentUpload", id: uploadId.current,
        title: `Handwritten answer · ${title}`.slice(0, 150), context: context.slice(0, 2000),
        files: await Promise.all(files.map(async file => ({ name: file.name, type: file.type, data: await fileBase64(file) }))) });
      if (!r.ok || !r.received || !r.document) throw new Error(r.error || "Upload not confirmed. Keep this page open and retry; the same upload will be checked.");
      onSaved(handwritingReference(r.document.id)); setFiles([]);
      uploadId.current = crypto.randomUUID();
      setMessage("Photo saved privately and attached to your draft. Now send or save your answer below so Rory sees it with this task.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not confirm the upload. Keep the photos here and retry."); }
    finally { setBusy(false); onBusyChange?.(false); }
  }
  return <section className="rounded-xl border border-indigo-200 p-4 dark:border-white/20" aria-label="Handwritten answer">
    <h4 className="font-semibold">Prefer to write by hand?</h4>
    <p className="mt-1 text-sm">Photograph your page or choose saved photos instead of typing. Keep all the words sharp and the whole page visible.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" className="min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold" disabled={blocked || busy} onClick={() => setScanning(true)}>Take a photo / scan pages</button>
      <button type="button" className="min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold" disabled={blocked || busy} onClick={() => input.current?.click()}>Choose photos</button>
      <input hidden ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => { choose(Array.from(event.target.files || [])); event.target.value = ""; }} />
    </div>
    {files.length > 0 && <div className="mt-3">
      <div className="flex flex-wrap gap-3">{files.map((file, index) => <figure key={index} className="w-28"><img src={previews[index]} alt={`Handwritten page ${index + 1} preview`} className="h-32 w-28 rounded-lg border object-contain" /><figcaption className="mt-1 text-xs">Page {index + 1}</figcaption></figure>)}</div>
      <p className="my-2 text-xs">Check the page order. Originals are kept privately for you, your parents and Rory. No AI reading runs when you attach a photo.</p>
      <button type="button" className="min-h-11 rounded-xl bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50" disabled={blocked || busy} onClick={() => void save()}>{busy ? "Saving photos…" : "Attach these photos to my answer"}</button>
      <button type="button" className="ml-3 min-h-11 underline" disabled={busy} onClick={() => setFiles([])}>Cancel</button>
    </div>}
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
    {scanning && <Scanner onClose={() => setScanning(false)} onUse={pages => { choose(pages); setScanning(false); }} />}
  </section>;
}
