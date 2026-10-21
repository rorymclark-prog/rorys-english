"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

export default function CoachSlidePresenter({ file, page, onLoaded, onContext, onPage }: { file: File; page: number; onLoaded: (count: number) => void; onContext: (page: number, text: string, image: string) => void; onPage: (page: number) => void }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const canvas = useRef<HTMLCanvasElement>(null);
  const rendering = useRef<RenderTask | null>(null);
  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<typeof import("pdfjs-dist").getDocument> | undefined;
    setDocument(null); setError(""); setLoading(true);
    void (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (cancelled) return;
      task = pdfjs.getDocument({ data: bytes, useSystemFonts: true });
      const pdf = await task.promise;
      if (cancelled) return;
      if (pdf.numPages > 200) throw new Error("For this prototype, choose a PDF with no more than 200 pages.");
      setDocument(pdf); onLoaded(pdf.numPages);
    })().catch(e => { if (!cancelled) { setError(e instanceof Error ? e.message : "The slide PDF could not be opened."); setLoading(false); } });
    return () => { cancelled = true; rendering.current?.cancel(); void task?.destroy(); };
  }, [file, onLoaded]);

  useEffect(() => {
    if (!document || !canvas.current) return;
    let cancelled = false; setLoading(true); setError(""); rendering.current?.cancel();
    void (async () => {
      const slide = await document.getPage(page);
      if (cancelled || !canvas.current) return;
      const baseViewport = slide.getViewport({ scale: 1 });
      const viewport = slide.getViewport({ scale: Math.min(2, 1440 / baseViewport.width) });
      const target = canvas.current, ctx = target.getContext("2d");
      if (!ctx) throw new Error("This browser cannot display the slide canvas.");
      target.width = Math.ceil(viewport.width); target.height = Math.ceil(viewport.height);
      const render = slide.render({ canvas: target, canvasContext: ctx, viewport }); rendering.current = render;
      await render.promise;
      const text = await slide.getTextContent();
      if (cancelled) return;
      const words = text.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("").trim().slice(0, 12000);
      onContext(page, words, target.toDataURL("image/jpeg", .72)); setLoading(false);
    })().catch(e => { if (!cancelled && e?.name !== "RenderingCancelledException") { setError("This slide could not be rendered. Try another page or open the PDF reference."); setLoading(false); } });
    return () => { cancelled = true; rendering.current?.cancel(); };
  }, [document, page, onContext]);

  return <section className="lc-panel lc-slide-presenter" aria-label="Private slide presenter">
    <div className="lc-slide-toolbar"><div><p className="teacher-eyebrow">CURRENT SLIDE</p><h2>{file.name}</h2></div><div className="lc-actions"><button type="button" className="teacher-quiet-button" disabled={!document || page <= 1} onClick={() => onPage(page - 1)}>← Previous</button><span>{page} / {document?.numPages || "…"}</span><button type="button" className="teacher-quiet-button" disabled={!document || page >= document.numPages} onClick={() => onPage(page + 1)}>Next →</button></div></div>
    {error && <p className="lc-error" role="alert">{error}</p>}
    <div className="lc-slide-canvas"><canvas ref={canvas} aria-label={`Slide ${page} from ${file.name}`}/></div>
    <p className="lc-hint" role="status">{loading ? "Preparing the current slide…" : "This slide and its extracted text are available as AI context when you start listening or ask a question. Your commentary and questions stay in this teacher view."}</p>
  </section>;
}
