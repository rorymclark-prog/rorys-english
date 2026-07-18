"use client";

import { useEffect, useRef, useState } from "react";

// Record-and-compare speaking practice. No scoring, no server: the student hears
// a model sentence (TTS), records themselves (MediaRecorder), and plays both back
// to self-compare. Audio is an in-memory blob URL — it never leaves the device.
export default function SpeakView({ lines }: { lines: string[] }) {
  const [i, setI] = useState(0);
  const [recording, setRecording] = useState(false);
  const [myAudio, setMyAudio] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const [err, setErr] = useState("");
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    setSupported(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof window.MediaRecorder !== "undefined",
    );
    return () => {
      if (myAudio) URL.revokeObjectURL(myAudio);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const line = lines[i] ?? "";

  const speak = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(line);
    u.lang = "en-GB";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  };

  const startRec = async () => {
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (myAudio) URL.revokeObjectURL(myAudio);
        setMyAudio(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setErr("I couldn't use the microphone. Check the mic permission and try again.");
    }
  };

  const stopRec = () => {
    recRef.current?.stop();
    setRecording(false);
  };

  const go = (next: number) => {
    if (recording) stopRec();
    if (myAudio) URL.revokeObjectURL(myAudio);
    setMyAudio(null);
    setErr("");
    setI((next + lines.length) % lines.length);
  };

  if (lines.length === 0) {
    return (
      <main className="px-5 pb-10">
        <p className="mt-6 rounded-card bg-surface p-5 text-center text-navy-soft shadow-card dark:bg-navy-raised dark:text-navy-mist dark:shadow-card-dark">
          No speaking practice for this unit yet.
        </p>
      </main>
    );
  }

  return (
    <main className="px-5 pb-10">
      <header className="mb-3 pt-4">
        <h1 className="display text-2xl font-extrabold text-navy dark:text-cream">Speaking practice</h1>
        <p className="mt-0.5 text-sm text-navy-soft dark:text-navy-mist">
          Listen, record yourself, then play both back and compare. Just for you — nothing is saved or sent.
        </p>
      </header>

      <section className="rounded-card bg-surface p-5 shadow-card dark:bg-navy-raised dark:shadow-card-dark">
        <p className="tnum text-xs font-bold uppercase tracking-wide text-amber-deep dark:text-amber">
          Sentence {i + 1} of {lines.length}
        </p>
        <p className="mt-2 text-xl font-bold leading-snug text-navy dark:text-cream">{line}</p>

        <button
          onClick={speak}
          className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-amber-soft px-4 font-bold text-amber-deep transition active:scale-[.97] dark:bg-amber-dusk dark:text-amber"
        >
          🔊 Listen
        </button>

        {supported ? (
          <button
            onClick={recording ? stopRec : startRec}
            className={`mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-4 text-base font-bold transition active:scale-[.97] ${
              recording
                ? "animate-pulse bg-bad-soft text-bad dark:bg-bad-dusk dark:text-bad-bright"
                : "bg-[linear-gradient(135deg,#4F46E5,#4338CA)] text-white shadow-[0_1px_2px_rgba(0,0,0,.06),0_4px_12px_-4px_#4F46E5] dark:bg-none dark:bg-amber dark:text-navy dark:shadow-none"
            }`}
          >
            {recording ? "⏹ Stop recording" : "● Record yourself"}
          </button>
        ) : (
          <p className="mt-3 rounded-lg bg-warn-soft p-3 text-center text-sm text-warn dark:bg-warn-dusk dark:text-warn-bright">
            Recording isn&apos;t supported in this browser — you can still Listen and repeat aloud.
          </p>
        )}

        {err && <p className="mt-3 text-center text-sm font-medium text-bad dark:text-bad-bright">{err}</p>}

        {myAudio && !recording && (
          <div className="mt-4">
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-deep dark:text-amber">
              Your recording
            </p>
            <audio src={myAudio} controls className="w-full" />
            <p className="mt-2 text-center text-xs text-navy-soft dark:text-navy-mist">
              Tip: play the model (🔊) then yours, and listen for the differences.
            </p>
          </div>
        )}
      </section>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          onClick={() => go(i - 1)}
          className="min-h-[48px] flex-1 rounded-xl bg-black/5 px-4 font-bold text-navy transition active:scale-[.97] dark:bg-white/10 dark:text-cream"
        >
          ← Back
        </button>
        <button
          onClick={() => go(i + 1)}
          className="min-h-[48px] flex-1 rounded-xl bg-navy px-4 font-bold text-cream transition active:scale-[.97] dark:bg-white/10 dark:text-cream"
        >
          Next →
        </button>
      </div>
    </main>
  );
}
