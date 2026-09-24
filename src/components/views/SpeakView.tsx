"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useStudent } from "@/components/StudentContext";
import { markEffort } from "@/lib/momentum";
import { isStudentPreview } from "@/lib/student-preview";
import { savedSession } from "@/lib/api";
import { currentAccount } from "@/lib/account-auth";
import { ConversationArt, MicrophoneIcon } from "@/components/LearningVisuals";
import FeedbackText from "@/components/FeedbackText";
import MicrophoneHelp from "@/components/MicrophoneHelp";
import { ScreenAwake, type AwakeState } from "@/lib/screen-awake";
import {guidedSpeaking,type GuidedSpeaking} from "@/lib/guided-speaking";
import {saveSpeaking,analyseSpeaking,attachSpeakingAudio} from "@/lib/learning";
import {documentRequest,fileBase64,MAX_DOCUMENT_BYTES} from "@/lib/documents";
const voices = [
  {id:"vesper",label:"Vesper · British"},
  {id:"willow",label:"Willow · Irish"},
  {id:"stone",label:"Stone · Irish"},
  {id:"quartz",label:"Quartz · Australian"},
  {id:"gleam",label:"Gleam · North American"},
  {id:"meridian",label:"Meridian · North American"},
];
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
  const { code, studentId } = useStudent();
  return <VoiceStudio code={code} studentId={studentId} lines={lines} unitTitle={unitTitle} />;
}
export function VoiceStudio({ code, studentId, lines, teacherTest = false, unitTitle, practiceOptions = [] }: { code: string; studentId?: string; lines: string[]; teacherTest?: boolean; unitTitle?: string; practiceOptions?: { code: string; name: string; unit?: string }[] }) {
  const preview = isStudentPreview();
  const [topic, setTopic] = useState(0); const [sessionTopic, setSessionTopic] = useState(0); const [available, setAvailable] = useState<boolean | null>(null);
  const [grammar, setGrammar] = useState("past-simple"); const [practiceStudent, setPracticeStudent] = useState(practiceOptions[0]?.code || "");
  const [voice,setVoice]=useState("vesper");
  const [state, setState] = useState<State>("idle"); const [status, setStatus] = useState("");
  const [muted, setMuted] = useState(false); const [elapsed, setElapsed] = useState(0);
  const [fragments, setFragments] = useState<Fragment[]>([]); const [reflection, setReflection] = useState("");
  const [guided,setGuided]=useState<GuidedSpeaking|null>(null);
  const guidedRef=useRef<GuidedSpeaking|null>(null);
  const [saveState,setSaveState]=useState("");
  const [saving,setSaving]=useState(false),[sampleDownload,setSampleDownload]=useState('');
  const sampleUrl=useRef('');
  const fragmentsRef=useRef<Fragment[]>([]),sessionId=useRef(''),savedId=useRef(''),topicRef=useRef(0),reflectionRef=useRef('');
  const liveRecorder=useRef<MediaRecorder|null>(null),sampleReady=useRef<Promise<Blob|null>|null>(null),sampleStop=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [recording, setRecording] = useState(false); const [recorded, setRecorded] = useState("");
  const [recordError, setRecordError] = useState(""); const [recordBusy, setRecordBusy] = useState(false);
  const audio = useRef<HTMLAudioElement>(null); const peer = useRef<RTCPeerConnection | null>(null);
  const events = useRef<RTCDataChannel | null>(null); const mic = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null); const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null); const generation = useRef(0);
  const recorder = useRef<MediaRecorder | null>(null); const recordingMic = useRef<MediaStream | null>(null); const recordingUrl = useRef("");
  const mounted = useRef(true); const recordGeneration = useRef(0); const controller = useRef<AbortController | null>(null);
  const wakeLock=useRef<ScreenAwake|null>(null);
  const [awakeState,setAwakeState]=useState<AwakeState>("idle");
  const [micInterrupted,setMicInterrupted]=useState(false);
  const busy = state === "connecting" || state === "live" || state === "closing";
  const endpoint = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/voice/`;
  function dispose() {
    generation.current++; controller.current?.abort();
    if (timer.current) clearInterval(timer.current); if (timeout.current) clearTimeout(timeout.current); if (closeTimer.current) clearTimeout(closeTimer.current);
    const channel = events.current; events.current = null; channel?.close();
    peer.current?.close(); peer.current = null; mic.current?.getTracks().forEach(t => t.stop()); mic.current = null;
    if (audio.current) audio.current.srcObject = null;
    wakeLock.current?.stop();
  }
  function finish(message: string) { if(liveRecorder.current?.state==='recording')liveRecorder.current.stop();if(sampleStop.current)clearTimeout(sampleStop.current);dispose(); if (mounted.current) { setState("ended"); setStatus(message); setMuted(false); if(!teacherTest&&fragmentsRef.current.some(f=>f.speaker==='You')){if(studentId)markEffort(studentId,code);void persistConversation();} } }
  async function persistConversation(){
    const id=sessionId.current;if(!id||savedId.current===id)return;savedId.current=id;
    setSaving(true);
    try {
      const text=fragmentsRef.current.map(f=>`[${(f.start_ms/1000).toFixed(1)}s] ${f.speaker}: ${f.delta}`).join('\n').slice(0,24000);
      setSaveState('Saving your conversation…');
      const title=guidedRef.current?.savedTitle||topics[topicRef.current].title;
      const result=await saveSpeaking(code,id,title,text,reflectionRef.current);
      if(!result.ok){savedId.current='';setSaveState('Could not confirm the save. Keep this page open and choose Retry save.');return;}
      setSaveState('Conversation saved. Preparing transcript feedback…');
      const analysis=await analyseSpeaking(code,id);
      const sample=await sampleReady.current;
      if(sample&&sample.size>0&&sample.size<=MAX_DOCUMENT_BYTES){
        if(sampleUrl.current)URL.revokeObjectURL(sampleUrl.current);sampleUrl.current=URL.createObjectURL(sample);setSampleDownload(sampleUrl.current);
        const ext=sample.type==='audio/mp4'?'m4a':sample.type==='audio/ogg'?'ogg':'webm',documentId=crypto.randomUUID();
        const uploaded=await documentRequest(code,false,{action:'documentUpload',id:documentId,title:`AI conversation audio · ${title}`,context:`Student voice sample for speaking record ${id}. Up to three minutes; AI feedback uses captions, while Rory can listen to this recording.`,files:[{name:`speaking-${id}.${ext}`,type:sample.type,data:await fileBase64(sample)}]});
        const attached=uploaded.ok&&uploaded.received?await attachSpeakingAudio(code,id,documentId):null;
        setSaveState(attached?.ok?(analysis.ok?'Transcript feedback and a short audio sample are saved for Rory and your parents.':'Conversation and audio sample saved. AI transcript feedback is unavailable; Rory can review it.'):'Conversation saved. The audio sample could not be confirmed; download it and ask Rory if you want to keep the sound.');
      }else setSaveState(analysis.ok?'Saved with transcript feedback. No audio sample was available from this browser.':'Conversation saved. AI transcript feedback is unavailable; Rory can review it.');
    } catch {savedId.current='';setSaveState('Could not confirm the full save. Keep this page open and choose Retry save.');}
    finally {setSaving(false);}
  }
  function startSample(stream:MediaStream){
    if(teacherTest||!window.MediaRecorder)return;
    try {const type=['audio/webm;codecs=opus','audio/mp4','audio/ogg'].find(t=>MediaRecorder.isTypeSupported(t));const recorder=new MediaRecorder(stream,{...(type?{mimeType:type}:{}),audioBitsPerSecond:24000});const chunks:BlobPart[]=[];sampleReady.current=new Promise(resolve=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=()=>resolve(new Blob(chunks,{type:recorder.mimeType.split(';')[0]||'audio/webm'}));recorder.onerror=()=>resolve(null);});liveRecorder.current=recorder;recorder.start();sampleStop.current=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},180000);}catch{sampleReady.current=null;}
  }
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
    wakeLock.current=new ScreenAwake("wakeLock" in navigator?()=>navigator.wakeLock.request("screen"):undefined,()=>document.visibilityState==="visible",value=>{if(mounted.current)setAwakeState(value);});
    try{const choice=localStorage.getItem(`re_voice_${code}`);if(voices.some(v=>v.id===choice))setVoice(choice!);}catch{/* device storage unavailable */}
    fetch(endpoint, { cache: "no-store" }).then(r => r.json()).then(r => { if (mounted.current) setAvailable(r.available === true); }).catch(() => { if (mounted.current) setAvailable(false); });
    const leave = () => { if (events.current?.readyState === "open") events.current.send(JSON.stringify({ type: "session.close" })); dispose(); stopRecording(); };
    window.addEventListener("pagehide", leave);
    const visible=()=>{
      if(document.visibilityState!=="visible"||!peer.current)return;
      if(mic.current?.getAudioTracks().some(track=>track.readyState==="ended")){finish("Your phone stopped the microphone. Your transcript is still here. Press Start to begin a new conversation.");return;}
      void wakeLock.current?.resume();
      if(audio.current?.srcObject)void audio.current.play().catch(()=>{if(mounted.current)setStatus("Press play below to resume hearing your AI partner.");});
    };
    document.addEventListener("visibilitychange",visible);
    return () => { mounted.current = false; recordGeneration.current++; leave(); window.removeEventListener("pagehide", leave);document.removeEventListener("visibilitychange",visible); if (recordingUrl.current) URL.revokeObjectURL(recordingUrl.current);if(sampleUrl.current)URL.revokeObjectURL(sampleUrl.current); };
  }, [endpoint,code]);
  useEffect(()=>{
    if(teacherTest)return;
    const choice=new URLSearchParams(window.location.search).get("guided");
    const chat=guidedSpeaking(code,choice);
    setGuided(chat);guidedRef.current=chat;
    if(chat)setTopic(topics.findIndex(topic=>topic.id===chat.topic));
  },[code,teacherTest]);
  async function start() {
    if (preview || !available || busy || saving || recording || recordBusy) return;
    dispose(); setMicInterrupted(false); const run = generation.current;sessionId.current=crypto.randomUUID();savedId.current='';topicRef.current=topic;reflectionRef.current='';fragmentsRef.current=[];sampleReady.current=null;liveRecorder.current=null;if(sampleUrl.current)URL.revokeObjectURL(sampleUrl.current);sampleUrl.current='';setSampleDownload('');setSaveState('');setState("connecting"); setStatus("Connecting your microphone…"); setFragments([]); setElapsed(0); setReflection(""); setSessionTopic(topic);
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
      void wakeLock.current?.start();
      mic.current = stream; const connection = new RTCPeerConnection(); peer.current = connection;
      stream.getAudioTracks().forEach(track=>{
        track.addEventListener("mute",()=>{if(mounted.current&&run===generation.current)setMicInterrupted(true);});
        track.addEventListener("unmute",()=>{if(mounted.current&&run===generation.current)setMicInterrupted(false);});
        track.addEventListener("ended",()=>{if(mounted.current&&run===generation.current)finish("Your phone stopped the microphone. Your transcript is still here. Press Start to begin a new conversation.");});
      });
      connection.addEventListener("track", e => { if (run !== generation.current || !audio.current) return; audio.current.srcObject = new MediaStream([e.track]); void audio.current.play().catch(() => setStatus("Press play below to hear your AI partner.")); });
      stream.getTracks().forEach(t => connection.addTrack(t, stream));
      const channel = connection.createDataChannel("oai-events"); events.current = channel;
      channel.addEventListener("message", ({ data }) => {
        if (run !== generation.current) return;
        let event; try { event = JSON.parse(data); } catch { return; }
        if (event.type === "session.started") {
          if (timeout.current) clearTimeout(timeout.current); setState("live"); setStatus("Connected. Say hello when you’re ready.");
          if(mic.current)startSample(mic.current);
          const started = Date.now(); timer.current = setInterval(() => { const seconds = Math.floor((Date.now() - started) / 1000); setElapsed(seconds); if (seconds >= 900) { if (timer.current) clearInterval(timer.current); end(); } }, 1000);
        } else if (event.type === "session.closed") finish("Conversation ended. Keep one useful phrase and one next step.");
        else if (["session.input_transcript.delta", "session.output_transcript.delta"].includes(event.type) && typeof event.delta === "string") {
          const f: Fragment = { speaker: event.type === "session.input_transcript.delta" ? "You" : "AI partner", delta: event.delta, start_ms: Number(event.start_ms) || 0, end_ms: Number(event.end_ms) || 0 };
          fragmentsRef.current=[...fragmentsRef.current,f].slice(-3000);setFragments(fragmentsRef.current);
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
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.current.signal, body: JSON.stringify({ code, token, teacherTest, preview, topic: topics[topic].id, grammar, voice, homeworkFocus: guidedRef.current?.id, practiceStudent: teacherTest ? practiceStudent : undefined, sdp: connection.localDescription?.sdp }) });
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
  return <main className={`re-home re-speaking ${guided ? "hw-speaking-studio" : ""}`}><header className="re-page-heading"><p className="re-eyebrow">{teacherTest ? "TEACHER VOICE TEST" : guided ? `${guided.unitLabel} · CHAT ${guided.week}` : "SPEAKING STUDIO"}</p><h1>{teacherTest ? "Try your AI conversation partner." : guided ? guided.title : "Your voice. Your ideas."}</h1><p>{teacherTest ? "Use the same conversation partner your students use. This test uses your API credit and is not saved to a student’s work." : guided ? `Speak for about ${guided.duration}. When you end, the app saves the conversation for Rory. There is nothing to copy or paste.` : "One topic, one useful target, a little more confidence."}</p></header>
    {guided&&<div className="re-card hw-studio-note"><strong>Chat {guided.week} · {guided.cue}</strong><p>{guided.prompt}</p>{guided.purpose&&<p><strong>Why this chat? </strong>{guided.purpose}</p>}<p>If you get stuck, say: “Please ask me a simpler question.”</p><Link className="re-text-link" href={`/s/${code}/lessons/${guided.unitId}/homework/${guided.week}/`}>Back to this week&apos;s task →</Link></div>}
    <div className="re-speaking-grid"><section><div className="re-card">{guided?<><p className="re-eyebrow">YOUR FOCUS</p><p>{guided.focus}</p></>:<><p className="re-eyebrow">1 · CHOOSE A CONVERSATION</p><div className="re-topic-options">{topics.map((t, i) => <button key={t.id} disabled={busy || recording || recordBusy} aria-pressed={topic === i} onClick={() => setTopic(i)}><strong>{t.title}</strong><small>{t.target}</small></button>)}</div></>}
      {topics[topic].id === "grammar" && <label className="re-voice-choice">Choose a grammar focus<select value={grammar} onChange={e => setGrammar(e.target.value)} disabled={busy || recording || recordBusy}>{grammarTargets.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}</select></label>}
      {teacherTest && topics[topic].id === "unit" && <label className="re-voice-choice">Test this student&apos;s current unit<select value={practiceStudent} onChange={e => setPracticeStudent(e.target.value)} disabled={busy || recording || recordBusy}>{practiceOptions.map(p => <option key={p.code} value={p.code}>{p.name}{p.unit ? ` · ${p.unit}` : ""}</option>)}</select></label>}
      {!teacherTest && !guided && topics[topic].id === "unit" && <p className="re-small-copy">{unitTitle ? `Current unit: ${unitTitle}` : "Tell the partner your current school topic and a few words you want to practise."}</p>}
      <label className="re-voice-choice">Conversation voice<select value={voice} onChange={e=>{const next=e.target.value;setVoice(next);try{localStorage.setItem(`re_voice_${code}`,next);}catch{/* storage unavailable */}}} disabled={busy || recording || recordBusy}>{voices.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select></label>
      <p className="re-small-copy">Choose before starting. A voice change starts with your next conversation.</p>
      </div>
      <section className="re-card re-live-panel"><div className={`re-voice-orb is-${muted?"muted":state}`} aria-hidden><MicrophoneIcon /></div><p className="re-eyebrow">{guided?"VOICE CHAT":"LIVE AI CONVERSATION"}</p><h2>{state === "live" ? "Make yourself heard." : state === "connecting" ? "Opening your conversation…" : "A conversation, at your pace."}</h2><p>{guided?guided.cue:topics[topic].target}</p>
        <p className="re-voice-status" role="status">{status || (preview ? "Teacher preview is read-only. Voice is disabled here." : available === null ? "Checking live voice…" : available ? "Ready for a conversation of up to 15 minutes." : guided ? "Live voice is unavailable right now. Continue with the other steps in your task and tell Rory at your next lesson." : "Live AI voice is awaiting connection. Try a rehearsal below in the meantime.")}</p>
        {busy && <p className="re-timer">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} <small>/ 15:00</small></p>}
        <div className="re-voice-actions">{!busy ? <button className="re-button" disabled={!available || preview || saving || recording || recordBusy} onClick={() => void start()}>{saving?'Saving this conversation…':'Start conversation'}</button> : <><button className="re-button re-secondary" disabled={state !== "live"} onClick={() => { const next = !muted; mic.current?.getAudioTracks().forEach(t => { t.enabled = !next; }); setMuted(next); }}>{muted ? "Unmute microphone" : "Mute microphone"}</button><button className="re-button" disabled={state === "closing"} onClick={end}>{state === "closing" ? "Finishing…" : state === "connecting" ? "Cancel" : "End conversation"}</button></>}</div>
        <audio ref={audio} autoPlay controls className={busy ? "re-live-audio" : "hidden"} aria-label="AI partner audio" />
        {busy&&<p role="status" className="mt-3 text-sm">{awakeState==="held"?"Screen-awake protection is on while this app is visible.":awakeState==="idle"?"Screen-awake protection starts when the microphone connects.":"Screen-awake protection is unavailable or was released by your phone. Keep this screen open."}</p>}
        {busy&&micInterrupted&&<p role="alert" className="mt-3 text-sm">Your phone has paused the microphone. Return to this screen; if it does not recover, end the conversation and start again.</p>}
        <small>When connected, your microphone audio goes to OpenAI. The first three minutes of your voice are also saved privately for Rory and your parents to review. Caption feedback is separate from audio review. Muting keeps the session running; choose End to finish.</small>
        <MicrophoneHelp /></section>
      {!!fragments.length && <section className="re-card"><h2>Conversation captions</h2><p className="re-small-copy">Captions may contain mistakes. Both speakers can speak at once.</p><div className="re-caption-columns">{(["You", "AI partner"] as const).map(s => <div key={s}><h3>{s}</h3><p><FeedbackText text={transcript(s)}/></p></div>)}</div>{!guided&&<><label className="re-reflection">One useful phrase & my next target<textarea rows={3} maxLength={3000} value={reflection} onChange={e => {setReflection(e.target.value);reflectionRef.current=e.target.value;}} placeholder="What will you try again?" /></label><button className="re-button re-secondary" onClick={saveTranscript}>Download conversation & reflection</button>{sampleDownload&&<a className="re-button re-secondary" href={sampleDownload} download="my-speaking-sample">Download my audio sample</a>}</>}{!teacherTest&&<p className="re-small-copy" role="status">{saveState||'When you end, the app saves this conversation for Rory to review.'}</p>}{!teacherTest&&state==='ended'&&saveState.startsWith('Could not')&&<button className="re-button re-secondary" onClick={()=>void persistConversation()}>Retry save</button>}{teacherTest&&<p className="re-small-copy">This test stays in this tab. No student record is created.</p>}{guided&&state==='ended'&&!saving&&!!saveState&&!saveState.startsWith('Could not')&&<Link className="re-text-link" href={`/s/${code}/lessons/${guided.unitId}/homework/${guided.week}/`}>Continue to this week&apos;s task →</Link>}{!teacherTest&&!guided&&<Link className="re-text-link" href={`/s/${code}/progress/`}>View your speaking record →</Link>}</section>}
    </section>{!guided&&<aside><div className="re-card"><ConversationArt/><h2>A little structure helps.</h2><ol className="re-speaking-steps"><li><strong>Get started</strong>Choose a mode and bring one idea or useful word.</li><li><strong>Keep it going</strong>Say more, then ask a question back.</li><li><strong>Make it stick</strong>Try one correction in your own sentence. Ask for shorter chunks if you need them.</li></ol><p className="re-small-copy">This is supplementary practice, not a school assessment. Follow Rory’s assignment for what to submit.</p></div>
      <section className="re-card"><p className="re-eyebrow">QUICK REHEARSAL · ON THIS DEVICE</p><h2>Try it out loud.</h2><p className="re-rehearsal-prompt">{topics[topic].id === "unit" && lines.length ? lines[0] : topics[topic].prompt}</p><p className="re-small-copy">Record up to three minutes, listen back and try again. Your recording stays in this tab and is not sent to anyone.</p><button className="re-button re-secondary" disabled={preview || busy || recordBusy} onClick={() => recording ? stopRecording() : void record()}>{recording ? "Stop recording" : recordBusy ? "Opening microphone…" : "Record a rehearsal"}</button><p role="status">{recording ? "Recording…" : recordError}</p>{recorded && !recording && <audio controls src={recorded} className="re-live-audio" aria-label="Your rehearsal recording" />}</section>
    </aside>}</div>
  </main>;
}
