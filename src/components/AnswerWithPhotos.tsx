"use client";
import { useEffect, useRef, useState } from "react";
import { documentRequest } from "@/lib/documents";
import { handwritingParts } from "@/lib/handwritten-answer";
export default function AnswerWithPhotos({ answer, code, teacher = false }: { answer: string; code: string; teacher?: boolean }) {
  const { text, documentIds } = handwritingParts(answer);
  const [images, setImages] = useState<{ url: string; name: string }[]>([]), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const urls = useRef<string[]>([]), active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; urls.current.forEach(url => URL.revokeObjectURL(url)); }; }, []);
  async function open() {
    setBusy(true); setMessage("");
    const next: { url: string; name: string }[] = [];
    try {
      for (const id of documentIds) {
        const meta = await documentRequest(code, teacher, { action: "document", id });
        if (!meta.ok || !meta.document) throw new Error(meta.error || "Could not open the handwritten answer.");
        for (const file of meta.document.files) {
          if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) continue;
          const r = await documentRequest(code, teacher, { action: "documentFile", id, index: file.index });
          if (!r.ok || !r.file) throw new Error(r.error || "Could not open this page.");
          if (!["image/jpeg", "image/png", "image/webp"].includes(r.file.type)) throw new Error("This attachment is not a photo.");
          const bytes = Uint8Array.from(atob(r.file.data), c => c.charCodeAt(0));
          next.push({ url: URL.createObjectURL(new Blob([bytes], { type: r.file.type })), name: r.file.name });
        }
      }
      if (!active.current) { next.forEach(item => URL.revokeObjectURL(item.url)); return; }
      urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current = next.map(item => item.url);
      setImages(next); if (!next.length) setMessage("No photos found. Open My documents to check this attachment.");
    } catch (error) { next.forEach(item => URL.revokeObjectURL(item.url)); if (active.current) setMessage(error instanceof Error ? error.message : "Could not open the photo."); }
    finally { if (active.current) setBusy(false); }
  }
  return <div>{text && <p className="whitespace-pre-wrap">{text}</p>}{documentIds.length > 0 && <>
    <button type="button" disabled={busy} className="mt-2 min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold" onClick={() => images.length ? setImages([]) : void open()}>{busy ? "Opening handwritten work…" : images.length ? "Hide handwritten pages" : "View handwritten answer"}</button>
    {images.map((image, index) => <figure key={image.url} className="mt-3"><img src={image.url} alt={`Handwritten answer, page ${index + 1}`} className="max-h-[80vh] max-w-full rounded-lg border object-contain" /><figcaption className="mt-1 text-xs">Page {index + 1} · original handwriting</figcaption><a href={image.url} download={image.name} className="text-sm underline">Download this page</a></figure>)}
    {message && <p role="status" className="mt-2 text-sm">{message}</p>}
  </>}</div>;
}
