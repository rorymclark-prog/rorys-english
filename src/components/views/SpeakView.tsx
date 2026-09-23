"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useStudent } from "@/components/StudentContext";
import { isStudentPreview } from "@/lib/student-preview";
import { savedSession } from "@/lib/api";
import { currentAccount } from "@/lib/account-auth";
import { ConversationArt, MicrophoneIcon } from "@/components/LearningVisuals";
const topics = [
  { id: "general", title: "Open chat", target: "Talk about anything you like.", prompt: "What would you like to talk about today?" },
  { id: "everyday", title: "Everyday conversation", target: "Answer, add a reason, ask a question.", prompt: "Tell me about something you enjoyed this week. Why did you enjoy it?" },
  { id: "opinions", title: "Ideas & opinions", target: "Give an opinion and a specific example.", prompt: "Is it better to learn something alone or with other people? Give an example." },
  { id: "story", title: "Tell a story", target: "Use a clear sequence and past tenses.", prompt: "Tell a short story about a time a plan changed. What happened next?" },
  { id: "unit", title: "My current unit", target: "Use new words from your school unit.", prompt: "Which two or three words from your current unit can you use in a story about your life?" },
  { id: "grammar", title: "Build sentences", target: "Practise one grammar pattern in your own sentences.", prompt: "Say a short sentence about something that happened yesterday. Now add one useful detail." },
];
const grammarTargets = [
  { id: "past-simple", title: "Past simple" },
  { id: "past-perfect", title: "Past perfect + past simple" },
  { id: "present-perfect", title: "Present perfect + past simple" },
  { id: "future", title: "Future forms" },
  { id: "conditionals", title: "Conditionals" },
  { id: "sentence-building", title: "Build longer sentences" },
];
type State = "idle" | "connecting" | "live" | "closing" | "ended";
type Fragment = { speaker: "You" | "AI partner"; delta: string; start_ms: number; end_ms: number };
export default function SpeakView({ lines, unitTitle }: { lines: string[]; unitTitle?: string }) {
  const { code } = useStudent();
  return <VoiceStudio code={code} lines={lines} unitTitle={unitTitle} />;
}
export function VoiceStudio({ code, lines, teacherTest = false, unitTitle, practiceOptions = [] }: { code: string; lines: string[]; teacherTest?: boolean; unitTitle?: string; practiceOptions?: { code: string; name: string; unit?: string }[] }) {
  const preview = isStudentPreview();
  const [topic, setTopic] = useState(0); const [sessionTopic, setSessionTopic] = useState(0); const [available, setAvailable] = useState<boolean | null>(null);
  const [grammar, setGrammar] = useState("past-simple"); const [practiceStudent, setPracticeStudent] = useState(practiceOptions[0]?.code || "");
  const [state, setState] = useState<State>("idle"); const [status, setStatus] = useState("");
  const [muted, setMuted] = useState(false); const [elapsed, setElapsed] = useState(0);
  const [fragments, setFragments] = useState<Fragment[]>([]); const [reflection, setReflection] = useState("");
  const [recording, setRecording] = useState(false); const [recorded, setRecorded] = useState("");
  const [recordError, setRecordError] = useState(""); const [recordBusy, setRecordBusy] = useState(false);
  const audio = useRef<HTMLAudioElement>(null); const peer = useRef<RTCPeerConnection | null>(null);
  const events = useRef<RTCDataChannel | null>(null); const mic = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null); const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null); const generation = useRef(0);
  const recorder = useRef<MediaRecorder | null>(null); const recordingMic = useRef<MediaStream | null>(null); const recordingUrl = useRef("");
  const mounted = useRef(true); const recordGeneration = useRef(0); const controller = useRef<AbortController | null>(null);
  const busy = state === "connecting" || state === "live" || state === "closing";
  const endpoint = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/voice/`;
  function dispose() {
    generation.current++; controller.current?.abort();
    if (timer.current) clearInterval(timer.current); if (timeout.current) clearTimeout(timeout.current); if (closeTimer.current) clearTimeout(closeTimer.current);
    const channel = events.current; events.current = null; channel?.close();
    peer.current?.close(); peer.current = null; mic.current?.getTracks().forEach(t => t.stop()); mic.current = null;
    if (audio.current) audio.current.srcObject = null;
  }
  function finish(message: string) { dispose(); if (mounted.current) { setState("ended"); setStatus(message); setMuted(false); } }
  function end() {
    if (events.current?.readyState === "open") {
      setState("closing"); setStatus("Finishing your conversation…");
      mic.current?.getAudioTracks().forEach(t => { t.enabled = false; });
      events.current.send(JSON.stringify({ type: "session.close" }));
      closeTimer.current = setTimeout(() => finish("Conversation ended. The final connection receipt was not received."), 15000);
    } else finish("Conversation ended.");
  }
  function stopRecording() { if (recorder.current?.state === "recording") recorder.current.stop(); recordingMic.current?.getTracks().forEach(t => t.stop()); }
  useEffect(() => {
    mounted.current = true;
    fetch(endpoint, { cache: "no-store" }).then(r => r.json()).then(r => { if (mounted.current) setAvailable(r.available === true); }).catch(() => { if (mounted.current) setAvailable(false); });
    const leave = () => { if (events.current?.readyState === "open") events.current.send(JSON.stringify({ type: "session.close" })); dispose(); stopRecording(); };
    window.addEventListener("pagehide", leave);
    return () => { mounted.current = false; recordGeneration.current++; leave(); window.removeEventListener("pagehide", leave); if (recordingUrl.current) URL.revokeObjectURL(recordingUrl.current); };
  }, [endpoint]);
  async function start() {
    if (preview || !available || busy || recording || recordBusy) return;
    dispose(); const run = generation.current; setState("connecting"); setStatus("Connecting your microphone…"); setFragments([]); setElapsed(0); setReflection(""); setSessionTopic(topic);
    const check = () => { if (!mounted.current || run !== generation.current) throw new Error("cancelled"); };
    try {
      let token: string;
      if (teacherTest) {
        const session = savedSession("__teacher__");
        if (!session || session.role !== "teacher") throw new Error("Return to the teacher dashboard and sign in again.");
        token = session.token;
      } else {
        const user = await currentAccount(); check();
        if (!user) throw new Error("Sign in with your student email to use live voice.");
        token = await user.getIdToken(); check();
      }
      if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) throw new Error("This browser does not support live voice. Try Safari or Chrome.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current || run !== generation.current) { stream.getTracks().forEach(t => t.stop()); return; }
      mic.current = stream; const connection = new RTCPeerConnection(); peer.current = connection;
      connection.addEventListener("track", e => { if (run !== generation.current || !audio.current) return; audio.current.srcObject = new MediaStream([e.track]); void audio.current.play().catch(() => setStatus("Press play below to hear your AI partner.")); });
      stream.getTracks().forEach(t => connection.addTrack(t, stream));
      const channel = connection.createDataChannel("oai-events"); events.current = channel;
      channel.addEventListener("message", ({ data }) => {
        if (run !== generation.current) return;
        let event; try { event = JSON.parse(data); } catch { return; }
        if (event.type === "session.started") {
          if (timeout.current) clearTimeout(timeout.current); setState("live"); setStatus("Connected. Say hello when you’re ready.");
          const started = Date.now(); timer.current = setInterval(() => { const seconds = Math.floor((Date.now() - started) / 1000); setElapsed(seconds); if (seconds >= 900) { if (timer.current) clearInterval(timer.current); end(); } }, 1000);
        } else if (event.type === "session.closed") finish("Conversation ended. Keep one useful phrase and one next step.");
        else if (["session.input_transcript.delta", "session.output_transcript.delta"].includes(event.type) && typeof event.delta === "string") {
          const f: Fragment = { speaker: event.type === "session.input_transcript.delta" ? "You" : "AI partner", delta: event.delta, start_ms: Number(event.start_ms) || 0, end_ms: Number(event.end_ms) || 0 };
          setFragments(prev => [...prev, f].slice(-3000));
        } else if (event.type === "error") setStatus("The voice service reported a problem. End the conversation if it does not recover.");
      });
      channel.addEventListener("close", () => { if (run === generation.current) finish("The connection ended. Your visible transcript is still here."); });
      connection.addEventListener("connectionstatechange", () => { if (run === generation.current && connection.connectionState === "failed") finish("The connection was lost. You can keep your transcript and try again."); });
      await connection.setLocalDescription(await connection.createOffer()); check();
      if (connection.iceGatheringState !== "complete") await new Promise<void>((resolve, reject) => {
        const wait = setTimeout(() => { connection.removeEventListener("icegatheringstatechange", changed); reject(new Error("The microphone connection timed out.")); }, 10000);
        function changed() { if (connection.iceGatheringState === "complete") { clearTimeout(wait); connection.removeEventListener("icegatheringstatechange", changed); resolve(); } }
        connection.addEventListener("icegatheringstatechange", changed); changed();
      });
      check(); controller.current = new AbortController();
      timeout.current = setTimeout(() => finish("The voice connection timed out. Please try again."), 55000);
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.current.signal, body: JSON.stringify({ code, token, teacherTest, preview, topic: topics[topic].id, grammar, practiceStudent: teacherTest ? practiceStudent : undefined, sdp: connection.localDescription?.sdp }) });
      const result = await response.json(); check(); if (!response.ok) throw new Error(result.error || "Live voice could not connect.");
      await connection.setRemoteDescription({ type: "answer", sdp: result.transport.sdp }); check();
    } catch (error) { if (run === generation.current) finish(error instanceof Error && error.name === "NotAllowedError" ? "Microphone access was declined. Allow it in your browser to try again." : error instanceof Error ? error.message : "Could not connect."); }
  }
  async function record() {
    if (preview || busy || recordBusy) return;
    setRecordError(""); setRecordBusy(true); const run = ++recordGeneration.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error("Recording is not supported in this browser. You can still practise aloud.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current || run !== recordGeneration.current) { stream.getTracks().forEach(t => t.stop()); return; }
      recordingMic.current = stream; const rec = new MediaRecorder(stream); recorder.current = rec; const chunks: BlobPart[] = [];
      rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      const limit = setTimeout(() => { if (rec.state === "recording") rec.stop(); }, 180000);
      rec.onstop = () => { clearTimeout(limit); stream.getTracks().forEach(t => t.stop()); if (!mounted.current || run !== recordGeneration.current) return; if (recordingUrl.current) URL.revokeObjectURL(recordingUrl.current); recordingUrl.current = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || "audio/webm" })); setRecorded(recordingUrl.current); setRecording(false); };
      rec.onerror = () => { clearTimeout(limit); stream.getTracks().forEach(t => t.stop()); if (mounted.current) { setRecording(false); setRecordError("The recording stopped. Please try again."); } };
      rec.start(); setRecording(true);
    } catch (error) { recordingMic.current?.getTracks().forEach(t => t.stop()); if (mounted.current) setRecordError(error instanceof Error && error.name !== "NotAllowedError" ? error.message : "Allow microphone access to record yourself."); }
    finally { if (mounted.current) setRecordBusy(false); }
  }
  function saveTranscript() {
    const text = `Rory's English — speaking practice\n${topics[sessionTopic].title}\nAI feedback is practice advice, not a teacher assessment.\n\n` + fragments.map(f => `[${(f.start_ms / 1000).toFixed(1)}s] ${f.speaker}: ${f.delta}`).join("\n") + `\n\nMy reflection\n${reflection}`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "my-speaking-practice.txt"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const transcript = (speaker: Fragment["speaker"]) => fragments.filter(f => f.speaker === speaker).map(f => f.delta).join("");
  return <main className="re-home re-speaking"><header className="re-page-heading"><p className="re-eyebrow">{teacherTest ? "TEACHER VOICE TEST" : "SPEAKING STUDIO"}</p><h1>{teacherTest ? "Try your AI conversation partner." : "Your voice. Your ideas."}</h1><p>{teacherTest ? "Use the same conversation partner your students use. This test uses your API credit and is not saved to a student’s work." : "One topic, one useful target, a little more confidence."}</p></header>
    <div className="re-speaking-grid"><section><div className="re-card"><p className="re-eyebrow">1 · CHOOSE A CONVERSATION</p><div className="re-topic-options">{topics.map((t, i) => <button key={t.id} disabled={busy || recording || recordBusy} aria-pressed={topic === i} onClick={() => setTopic(i)}><strong>{t.title}</strong><small>{t.target}</small></button>)}</div>
      {topics[topic].id === "grammar" && <label className="re-voice-choice">Choose a grammar focus<select value={grammar} onChange={e => setGrammar(e.target.value)} disabled={busy || recording || recordBusy}>{grammarTargets.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}</select></label>}
      {teacherTest && topics[topic].id === "unit" && <label className="re-voice-choice">Test this student&apos;s current unit<select value={practiceStudent} onChange={e => setPracticeStudent(e.target.value)} disabled={busy || recording || recordBusy}>{practiceOptions.map(p => <option key={p.code} value={p.code}>{p.name}{p.unit ? ` · ${p.unit}` : ""}</option>)}</select></label>}
      {!teacherTest && topics[topic].id === "unit" && <p className="re-small-copy">{unitTitle ? `Current unit: ${unitTitle}` : "Tell the partner your current school topic and a few words you want to practise."}</p>}
      </div>
      <section className="re-card re-live-panel"><div className={`re-voice-orb ${state === "live" ? "is-live" : ""}`} aria-hidden><MicrophoneIcon /></div><p className="re-eyebrow">LIVE AI CONVERSATION · GPT-LIVE-1</p><h2>{state === "live" ? "Make yourself heard." : state === "connecting" ? "Opening your conversation…" : "A conversation, at your pace."}</h2><p>{topics[topic].target}</p>
        <p className="re-voice-status" role="status">{status || (preview ? "Teacher preview is read-only. Voice is disabled here." : available === null ? "Checking live voice…" : available ? "Ready for a conversation of up to 15 minutes." : "Live AI voice is awaiting connection. Try a rehearsal below in the meantime.")}</p>
        {busy && <p className="re-timer">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} <small>/ 15:00</small></p>}
        <div className="re-voice-actions">{!busy ? <button className="re-button" disabled={!available || preview || recording || recordBusy} onClick={() => void start()}>Start conversation</button> : <><button className="re-button re-secondary" disabled={state !== "live"} onClick={() => { const next = !muted; mic.current?.getAudioTracks().forEach(t => { t.enabled = !next; }); setMuted(next); }}>{muted ? "Unmute microphone" : "Mute microphone"}</button><button className="re-button" disabled={state === "closing"} onClick={end}>{state === "closing" ? "Finishing…" : state === "connecting" ? "Cancel" : "End conversation"}</button></>}</div>
        <audio ref={audio} autoPlay controls className={busy ? "re-live-audio" : "hidden"} aria-label="AI partner audio" />
        <small>When connected, your microphone audio goes to OpenAI. This is an AI partner. Muting keeps the session running; choose End to finish.</small></section>
      {!!fragments.length && <section className="re-card"><h2>Conversation captions</h2><p className="re-small-copy">Captions may contain mistakes. Both speakers can speak at once.</p><div className="re-caption-columns">{(["You", "AI partner"] as const).map(s => <div key={s}><h3>{s}</h3><p>{transcript(s)}</p></div>)}</div><label className="re-reflection">One useful phrase & my next target<textarea rows={3} maxLength={3000} value={reflection} onChange={e => setReflection(e.target.value)} placeholder="What will you try again?" /></label><button className="re-button re-secondary" onClick={saveTranscript}>Download conversation & reflection</button><p className="re-small-copy">{teacherTest ? "This test stays in this tab. Download it before leaving if you want to keep it. No student record is created." : "Kept in this tab until you leave. Download it before leaving. Nothing has been submitted to Rory."}</p>{!teacherTest && <Link className="re-text-link" href={`/s/${code}/homework/`}>Open homework to submit your practice →</Link>}</section>}
    </section><aside><div className="re-card"><ConversationArt/><h2>A little structure helps.</h2><ol className="re-speaking-steps"><li><strong>Get started</strong>Choose a mode and bring one idea or useful word.</li><li><strong>Keep it going</strong>Say more, then ask a question back.</li><li><strong>Make it stick</strong>Try one correction in your own sentence. Ask for shorter chunks if you need them.</li></ol><p className="re-small-copy">This is supplementary practice, not a school assessment. Follow Rory’s assignment for what to submit.</p></div>
      <section className="re-card"><p className="re-eyebrow">QUICK REHEARSAL · ON THIS DEVICE</p><h2>Try it out loud.</h2><p className="re-rehearsal-prompt">{topics[topic].id === "unit" && lines.length ? lines[0] : topics[topic].prompt}</p><p className="re-small-copy">Record up to three minutes, listen back and try again. Your recording stays in this tab and is not sent to anyone.</p><button className="re-button re-secondary" disabled={preview || busy || recordBusy} onClick={() => recording ? stopRecording() : void record()}>{recording ? "Stop recording" : recordBusy ? "Opening microphone…" : "Record a rehearsal"}</button><p role="status">{recording ? "Recording…" : recordError}</p>{recorded && !recording && <audio controls src={recorded} className="re-live-audio" aria-label="Your rehearsal recording" />}</section>
    </aside></div>
  </main>;
}
