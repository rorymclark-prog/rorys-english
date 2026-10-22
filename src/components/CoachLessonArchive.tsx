"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  archivedAudio, audioChunkWriter, deleteArchivedLesson, lessonNotes, listArchivedLessons,
  makeArchivedLesson, realLessonEvidence, saveArchivedLesson, saveAudioChunk,
  type ArchivedLesson, type LessonSnapshot,
} from "@/lib/coach-archive";

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function duration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
function filename(lesson: ArchivedLesson) {
  return `lesson-${lesson.learnerCode.replace(/[^a-z0-9-]/gi, "")}-${lesson.startedAt.slice(0, 19).replace(/[T:]/g, "-")}`;
}

export default function CoachLessonArchive({ learnerCode, snapshot, onBusy, onFocus }: {
  learnerCode: string; snapshot: LessonSnapshot; onBusy: (busy: boolean) => void; onFocus: (note: string) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "starting" | "recording" | "paused" | "saving">("idle");
  const [allowed, setAllowed] = useState(false);
  const [lessons, setLessons] = useState<ArchivedLesson[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [teacherNote, setTeacherNote] = useState("");
  const [noteDirty, setNoteDirty] = useState(false);
  const [removeId, setRemoveId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [playback, setPlayback] = useState<{ id: string; url: string } | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [recoveryDownloaded, setRecoveryDownloaded] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const microphone = useRef<MediaStream | null>(null);
  const active = useRef<ArchivedLesson | null>(null);
  const writer = useRef<ReturnType<typeof audioChunkWriter> | null>(null);
  const pendingChunks = useRef(new Map<number, Blob>());
  const pendingSequence = useRef(0);
  const snapshotRef = useRef(snapshot); snapshotRef.current = snapshot;
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const mounted = useRef(true);
  const attempt = useRef(0);
  const segmentStarted = useRef(0);
  const recordedMs = useRef(0);
  const playbackRef = useRef("");
  const busy = phase !== "idle";

  const refresh = useCallback(async () => {
    const saved = await listArchivedLessons(learnerCode);
    if (mounted.current) setLessons(saved);
  }, [learnerCode]);
  const elapsedMs = useCallback(() => recordedMs.current + (segmentStarted.current ? Date.now() - segmentStarted.current : 0), []);

  useEffect(() => { onBusy(busy || recoveryPending); }, [busy, recoveryPending, onBusy]);
  useEffect(() => {
    let cancelled = false;
    void listArchivedLessons(learnerCode).then(saved => { if (!cancelled) setLessons(saved); })
      .catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [learnerCode]);

  useEffect(() => {
    mounted.current = true;
    const unload = (event: BeforeUnloadEvent) => {
      if (phaseRef.current !== "idle" || pendingChunks.current.size) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", unload);
    return () => {
      mounted.current = false; attempt.current++;
      window.removeEventListener("beforeunload", unload);
      if (recorder.current?.state !== "inactive") recorder.current?.stop();
      microphone.current?.getTracks().forEach(track => track.stop());
      if (playbackRef.current) URL.revokeObjectURL(playbackRef.current);
    };
  }, []);

  // Save metadata repeatedly while recording. Audio chunks have their own
  // durable, ordered writes; an interrupted page retains the committed prefix.
  useEffect(() => {
    if (phase !== "recording" && phase !== "paused") return;
    const clock = setInterval(() => setElapsed(elapsedMs()), 1000);
    const timer = setInterval(() => {
      const lesson = active.current;
      if (!lesson) return;
      const ms = elapsedMs(); setElapsed(ms);
      const updated = { ...lesson, ...realLessonEvidence(snapshotRef.current), durationMs: ms, updatedAt: new Date().toISOString() };
      active.current = updated;
      void saveArchivedLesson(updated).catch(e => {
        if (mounted.current) { setError(e.message); recorder.current?.stop(); }
      });
    }, 5000);
    return () => { clearInterval(timer); clearInterval(clock); };
  }, [phase, elapsedMs]);

  useEffect(() => {
    if (selectedId && !noteDirty) setTeacherNote(lessons.find(lesson => lesson.id === selectedId)?.teacherNote || "");
  }, [selectedId, lessons, noteDirty]);

  function finish() {
    const current = recorder.current;
    if (!current || current.state === "inactive") return;
    recordedMs.current = elapsedMs(); segmentStarted.current = 0;
    phaseRef.current = "saving"; setPhase("saving");
    current.stop();
    microphone.current?.getTracks().forEach(track => track.stop());
  }

  async function startRecording() {
    if (!allowed || phaseRef.current !== "idle" || !learnerCode) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Audio recording needs a secure browser with microphone and MediaRecorder support."); return;
    }
    const currentAttempt = ++attempt.current;
    phaseRef.current = "starting"; setPhase("starting"); setError(""); setMessage("");
    try {
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(type => MediaRecorder.isTypeSupported(type)) || "";
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      if (!mounted.current || currentAttempt !== attempt.current) { mic.getTracks().forEach(track => track.stop()); return; }
      microphone.current = mic;
      const media = mimeType ? new MediaRecorder(mic, { mimeType, audioBitsPerSecond: 64000 }) : new MediaRecorder(mic);
      const lesson = makeArchivedLesson(learnerCode, snapshotRef.current, media.mimeType || mimeType || "audio/webm");
      await saveArchivedLesson(lesson);
      if (!mounted.current || currentAttempt !== attempt.current) { mic.getTracks().forEach(track => track.stop()); return; }
      active.current = lesson; pendingChunks.current.clear(); pendingSequence.current = 0;
      recordedMs.current = 0; segmentStarted.current = Date.now(); setElapsed(0);
      writer.current = audioChunkWriter(async (sequence, blob) => {
        await saveAudioChunk(lesson.id, sequence, blob);
        pendingChunks.current.delete(sequence);
      });
      recorder.current = media;
      media.ondataavailable = event => {
        if (!event.data.size) return;
        const sequence = pendingSequence.current++;
        pendingChunks.current.set(sequence, event.data);
        if (active.current) active.current = { ...active.current, audioBytes: active.current.audioBytes + event.data.size };
        void writer.current?.append(event.data).catch(e => {
          if (mounted.current) setError(e.message);
          if (media.state !== "inactive") finish();
        });
      };
      media.onerror = () => {
        if (mounted.current) setError("The microphone recorder was interrupted. Review and download the saved portion.");
        if (media.state !== "inactive") finish();
      };
      media.onstop = () => {
        microphone.current?.getTracks().forEach(track => track.stop()); microphone.current = null;
        const ms = elapsedMs(); recordedMs.current = ms; segmentStarted.current = 0;
        void (async () => {
          let complete = true;
          try { await writer.current?.flush(); } catch { complete = false; }
          const current = active.current;
          if (current) {
            const updated: ArchivedLesson = { ...current, ...realLessonEvidence(snapshotRef.current), durationMs: ms, state: complete ? "complete" : "interrupted", updatedAt: new Date().toISOString() };
            active.current = updated;
            try { await saveArchivedLesson(updated); } catch { complete = false; }
            if (mounted.current) {
              setLessons(previous => [updated, ...previous.filter(item => item.id !== updated.id)]);
              setSelectedId(updated.id); setNoteDirty(false);
              setMessage(complete ? "Lesson audio and notes saved on this device. Download a copy to keep elsewhere." : "Storage was interrupted. Keep this page open and download the available audio now.");
            }
          }
          if (mounted.current) { phaseRef.current = "idle"; setPhase("idle"); await refresh().catch(e => setError(e.message)); }
          if (mounted.current && pendingChunks.current.size) setRecoveryPending(true);
        })();
      };
      mic.getAudioTracks().forEach(track => { track.onended = () => { if (media.state !== "inactive") finish(); }; });
      media.start(5000);
      phaseRef.current = "recording"; setPhase("recording");
      setMessage("Recording this lesson. Audio is saved in small parts on this device; live AI has separate controls.");
      await refresh().catch(e => { if (mounted.current) setError(e.message); });
    } catch (e) {
      microphone.current?.getTracks().forEach(track => track.stop()); microphone.current = null;
      if (mounted.current) { phaseRef.current = "idle"; setPhase("idle"); setError(e instanceof Error ? e.message : "The lesson could not be recorded."); }
    }
  }

  function pauseRecording() {
    const media = recorder.current;
    if (media?.state === "recording") {
      media.pause(); recordedMs.current = elapsedMs(); segmentStarted.current = 0;
      microphone.current?.getAudioTracks().forEach(track => { track.enabled = false; });
      phaseRef.current = "paused"; setPhase("paused");
    } else if (media?.state === "paused") {
      microphone.current?.getAudioTracks().forEach(track => { track.enabled = true; });
      segmentStarted.current = Date.now(); media.resume(); phaseRef.current = "recording"; setPhase("recording");
    }
  }

  async function saveNotes() {
    try {
      setError("");
      const evidence = realLessonEvidence(snapshotRef.current);
      if (!evidence.turns.length && !evidence.entries.length) { setMessage("No real lesson conversation to save yet. Prepared rehearsal is excluded."); return; }
      const updated = active.current ? { ...active.current, ...evidence, updatedAt: new Date().toISOString() } : makeArchivedLesson(learnerCode, evidence);
      await saveArchivedLesson(updated); active.current = updated;
      setSelectedId(updated.id); setNoteDirty(false); await refresh(); setMessage("Lesson notes saved on this device.");
    } catch (e) { setError(e instanceof Error ? e.message : "Notes could not be saved."); }
  }

  async function getAudio(lesson: ArchivedLesson) {
    const saved = await archivedAudio(lesson);
    const remaining = active.current?.id === lesson.id ? [...pendingChunks.current.entries()].sort(([a], [b]) => a - b).map(([, blob]) => blob) : [];
    return new Blob([saved, ...remaining], { type: lesson.mimeType });
  }

  async function audioAction(lesson: ArchivedLesson, play: boolean) {
    setLoadingAudio(true); setError("");
    try {
      const blob = await getAudio(lesson);
      if (!blob.size) throw new Error("No recorded audio was recovered for this lesson. Its saved notes are still available.");
      if (play) {
        if (playbackRef.current) URL.revokeObjectURL(playbackRef.current);
        playbackRef.current = URL.createObjectURL(blob); setPlayback({ id: lesson.id, url: playbackRef.current });
      } else {
        downloadBlob(blob, `${filename(lesson)}.${lesson.mimeType.includes("mp4") ? "m4a" : "webm"}`);
        if (recoveryPending && lesson.id === active.current?.id) setRecoveryDownloaded(true);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Audio could not be opened."); }
    finally { setLoadingAudio(false); }
  }

  const selected = lessons.find(lesson => lesson.id === selectedId);
  return <section className="lc-panel lc-recording" aria-label="Lesson recording and history">
    <div className="lc-section-title"><h2>Lesson recording & history</h2><span className="lc-badge">THIS DEVICE</span></div>
    <p className="lc-hint">Records the whole lesson on this device, separately from the AI. Nothing is uploaded or analysed. Download the lessons you want to keep.</p>
    <label className="lc-consent"><input type="checkbox" checked={allowed} disabled={busy} onChange={e => setAllowed(e.target.checked)}/>The learner and parent have agreed to recording and saving this lesson on my device.</label>
    <div className="lc-actions">
      {!busy ? <><button type="button" className="teacher-primary" disabled={!allowed || !learnerCode || recoveryPending} onClick={() => void startRecording()}>Record lesson</button><button type="button" className="teacher-quiet-button" onClick={() => void saveNotes()}>Save lesson notes</button></> : <><span className="lc-record-state" role="status">{phase === "starting" ? "Opening microphone…" : phase === "saving" ? "Saving final audio…" : `${phase === "paused" ? "Paused" : "Recording"} · ${duration(elapsed)}`}</span><button type="button" className="teacher-quiet-button" disabled={phase === "starting" || phase === "saving"} onClick={pauseRecording}>{phase === "paused" ? "Resume recording" : "Pause recording"}</button><button type="button" className="teacher-primary" disabled={phase === "starting" || phase === "saving"} onClick={finish}>Stop & save recording</button></>}
    </div>
    {message && <p className="lc-hint" role="status">{message}</p>}
    {error && <p className="lc-error" role="alert">{error}</p>}
    {recoveryPending && active.current && <div className="lc-actions"><button type="button" className="teacher-primary" disabled={loadingAudio} onClick={() => void audioAction(active.current!, false)}>Download recovery audio</button><button type="button" className="teacher-quiet-button" disabled={!recoveryDownloaded} onClick={() => { pendingChunks.current.clear(); setRecoveryPending(false); setRecoveryDownloaded(false); setMessage("Recovery copy downloaded. This browser retains only the successfully saved portion."); }}>I have saved the recovery copy</button></div>}
    <p className="lc-hint">Keep this page open while recording. An interrupted recording keeps the part already saved.</p>
    <details className="lc-saved-lessons"><summary>Saved lessons · {lessons.length}</summary>
      {!lessons.length && <p className="lc-hint">No lessons saved for this learner on this device yet.</p>}
      {lessons.map(lesson => <button type="button" className="lc-history-item" key={lesson.id} disabled={busy} aria-pressed={selectedId === lesson.id} onClick={() => { setSelectedId(lesson.id); setTeacherNote(lesson.teacherNote); setNoteDirty(false); setRemoveId(""); }}><strong>{new Date(lesson.startedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</strong><span>{lesson.context.task}</span><small>{lesson.mimeType ? `${duration(lesson.durationMs)} audio` : "Notes only"} · {lesson.state === "recording" ? busy && active.current?.id === lesson.id ? "Recording" : "Interrupted · review saved portion" : lesson.state === "interrupted" ? "Partial recording" : "Saved"}</small></button>)}
      {selected && !busy && <article className="lc-lesson-review">
        <h3>{selected.context.learner} · saved lesson</h3><p className="lc-hint">{selected.context.objective}</p>
        <div className="lc-actions"><button type="button" className="teacher-quiet-button" onClick={() => downloadBlob(new Blob([lessonNotes(selected)], { type: "text/plain;charset=utf-8" }), `${filename(selected)}-notes.txt`)}>Download notes</button>{selected.mimeType && <><button type="button" className="teacher-quiet-button" disabled={loadingAudio} onClick={() => void audioAction(selected, true)}>Play saved audio</button><button type="button" className="teacher-quiet-button" disabled={loadingAudio} onClick={() => void audioAction(selected, false)}>Download audio</button></>}</div>
        {playback?.id === selected.id && <audio controls preload="metadata" src={playback.url} aria-label="Saved lesson audio"/>}
        <label>My review & next lesson focus<textarea rows={3} maxLength={700} value={teacherNote} onChange={e => { setTeacherNote(e.target.value); setNoteDirty(true); }}/></label>
        <div className="lc-actions"><button type="button" className="teacher-primary" disabled={!noteDirty} onClick={() => { const updated = { ...selected, teacherNote, updatedAt: new Date().toISOString() }; void saveArchivedLesson(updated).then(async () => { if (active.current?.id === updated.id) active.current = updated; setNoteDirty(false); await refresh(); setMessage("Teacher review saved."); }).catch(e => setError(e.message)); }}>Save my review</button><button type="button" className="teacher-quiet-button" disabled={!teacherNote.trim() || noteDirty} onClick={() => onFocus(teacherNote)}>Use as next lesson focus</button></div>
        <details><summary>Saved conversation · {selected.turns.length} entries</summary>{selected.turns.map(turn => <p className="lc-saved-turn" key={turn.id}><strong>{turn.role === "learner" ? selected.context.learner : turn.role === "teacher" ? "Rory" : turn.role === "ai" ? "AI suggestion" : "Speaker unclear"}</strong> · {new Date(turn.at).toLocaleTimeString()}<br/>{turn.text}</p>)}</details>
        {removeId === selected.id ? <div className="lc-actions"><p className="lc-hint">Delete this lesson’s saved audio, notes and review from this browser?</p><button type="button" className="teacher-quiet-button" onClick={() => { void deleteArchivedLesson(selected.id).then(async () => { if (active.current?.id === selected.id) active.current = null; if (playback?.id === selected.id) { URL.revokeObjectURL(playbackRef.current); playbackRef.current = ""; setPlayback(null); } setSelectedId(""); setRemoveId(""); await refresh(); }).catch(e => setError(e.message)); }}>Delete lesson</button><button type="button" className="teacher-quiet-button" onClick={() => setRemoveId("")}>Keep lesson</button></div> : <button type="button" className="lc-link" onClick={() => setRemoveId(selected.id)}>Delete saved lesson…</button>}
      </article>}
    </details>
  </section>;
}
