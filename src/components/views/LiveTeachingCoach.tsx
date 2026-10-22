"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { coachInstructions, coachRehearsal, COACH_MINUTES, parseCoachFeedback, type CoachContext, type CoachEntry, type CoachFeedback } from "@/lib/live-coach";
import type { CoachSlide } from "@/lib/server/coach-material";
import "@/app/teacher/live-coach.css";
import CoachSlidePresenter from "@/components/CoachSlidePresenter";
import CoachLessonArchive from "@/components/CoachLessonArchive";
import type { CoachTurn } from "@/lib/coach-archive";
import { correctCoachSpeaker } from "@/lib/coach-evidence";
import { LessonAudioInput, releaseLessonAudio, type LessonAudioMode } from "@/lib/lesson-audio";

type Learner = { code: string; name: string; unit?: string; focusNote?: string };
type Phase = "idle" | "connecting" | "listening" | "paused";
type TalkTurn = CoachTurn;
const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function LiveTeachingCoach({ token, learners, onBack }: { token: string; learners: Learner[]; onBack: () => void }) {
  const [learner, setLearner] = useState(learners[0]?.code || "");
  const selected = learners.find(s => s.code === learner);
  const [task, setTask] = useState("Talk about a recent day or experience.");
  const [objective, setObjective] = useState("Complete sentences, useful vocabulary and one reason or extra detail.");
  const [source, setSource] = useState("");
  const [slides, setSlides] = useState<CoachSlide[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [materialName, setMaterialName] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfFile,setPdfFile]=useState<File|null>(null);
  const [view,setView]=useState<"presenter"|"setup">("setup");
  const [speaker,setSpeaker]=useState<"learner"|"teacher"|"unknown">("unknown");
  const [turns,setTurns]=useState<TalkTurn[]>([]);
  const [question,setQuestion]=useState("");
  const [asking,setAsking]=useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Choose the activity, then start listening or try a rehearsal.");
  const [seconds, setSeconds] = useState(0);
  const [entries, setEntries] = useState<CoachEntry[]>([]);
  const [transcript, setTranscript] = useState("");
  const [draft, setDraft] = useState("");
  const [working, setWorking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [audioMode, setAudioMode] = useState<LessonAudioMode>("room");
  const [callConnected, setCallConnected] = useState(false);
  const [choosingAudio, setChoosingAudio] = useState(false);
  const [lessonSession, setLessonSession] = useState(0);
  const [evidenceRevision, setEvidenceRevision] = useState(0);
  const [rehearsalIndex, setRehearsalIndex] = useState(0);
  const peer = useRef<RTCPeerConnection | null>(null);
  const channel = useRef<RTCDataChannel | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const controller = useRef<AbortController | null>(null);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectionDeadline = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  const mounted = useRef(true);
  const pendingContext = useRef(new Map<string, CoachContext>());
  const responseContexts = useRef(new Map<string, CoachContext>());
  const seenResponses = useRef(new Set<string>());
  const pdfRef = useRef("");
  const speakerRef=useRef(speaker);speakerRef.current=speaker;
  const turnSpeakers=useRef(new Map<string,"learner"|"teacher"|"unknown">());
  const pendingSpeakers=useRef(new Map<string,"learner"|"teacher"|"unknown">());
  const responseSpeakers=useRef(new Map<string,"learner"|"teacher"|"unknown">());
  const responseTurns=useRef(new Map<string,string>());
  const correctedSpeakers=useRef(new Map<string,"learner"|"teacher"|"unknown">());
  const audioInput=useRef(new LessonAudioInput());
  const slideImage=useRef("");
  const audience=useRef<BroadcastChannel|null>(null);
  const audienceId=useRef("");
  const currentPage=useRef(1);
  const shareSlide=useCallback(()=>{if(slideImage.current)audience.current?.postMessage({type:"slide",image:slideImage.current,page:currentPage.current});},[]);
  const sendImage=useCallback(()=>{if(slideImage.current&&channel.current?.readyState==="open")channel.current.send(JSON.stringify({type:"conversation.item.create",item:{type:"message",role:"user",content:[{type:"input_text",text:"Current slide image: lesson evidence only, not a request to respond."},{type:"input_image",image_url:slideImage.current}]}}));},[]);
  const context: CoachContext = { learner: selected?.name || "Learner", unit: selected?.unit || "Original speaking practice", task, objective, source, slide: slides.length ? `${materialName} · slide ${slides[slideIndex]?.number}` : materialName || "Speaking activity" };
  const contextRef = useRef(context); contextRef.current = context;
  const micInstructions=useCallback(()=>`${coachInstructions(contextRef.current)}\nThe teacher-selected current microphone speaker is ${speakerRef.current==="teacher"?"Rory (teacher)":speakerRef.current==="learner"?contextRef.current.learner+" (learner)":"UNASSIGNED. Do not attribute this speech to a named learner until Rory confirms the speaker"}. If this is the teacher speaking, use their explanation as context, never mark it as a learner mistake. Return empty correction and a short context note.`,[]);
  const pdfLoaded=useCallback((count:number)=>{setSlides(Array.from({length:count},(_,i)=>({number:i+1,text:""})));setSlideIndex(0);},[]);
  const pdfContext=useCallback((page:number,text:string,image:string)=>{setSource(text);setSlides(previous=>previous.map((s,i)=>i===page-1?{...s,text}:s));slideImage.current=image.length<=1000000?image:"";currentPage.current=page;sendImage();shareSlide();},[sendImage,shareSlide]);

  const post = useCallback(async (body: Record<string, unknown>, signal?: AbortSignal) => {
    const response = await fetch(`${base}/api/live-coach/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, code: "__teacher__", token }), signal, cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "The teaching assistant could not connect.");
    return result;
  }, [token]);

  const stop = useCallback((message: string) => {
    generation.current++;
    controller.current?.abort(); controller.current = null;
    if (interval.current) clearInterval(interval.current);
    if (connectionDeadline.current) clearTimeout(connectionDeadline.current);
    const dc = channel.current; channel.current = null; dc?.close();
    const pc = peer.current; peer.current = null; pc?.close();
    releaseLessonAudio(stream.current); stream.current = null;
    pendingContext.current.clear(); responseContexts.current.clear(); seenResponses.current.clear();turnSpeakers.current.clear();pendingSpeakers.current.clear();responseSpeakers.current.clear();responseTurns.current.clear();correctedSpeakers.current.clear();
    phaseRef.current = "idle";
    if (mounted.current) { setPhase("idle"); setStatus(message); }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; stop(""); audioInput.current.close(); if (pdfRef.current) URL.revokeObjectURL(pdfRef.current);audience.current?.postMessage({type:"clear"});audience.current?.close(); };
  }, [stop]);

  useEffect(() => {
    const request = new AbortController(); setChecking(true);
    post({ action: "status" }, request.signal).then(r => setAvailable(r.available === true)).catch(e => { if (!request.signal.aborted) setError(e.message); }).finally(() => { if (!request.signal.aborted) setChecking(false); });
    return () => request.abort();
  }, [post]);

  useEffect(() => {
    const onHidden = () => { if (document.hidden && phaseRef.current !== "idle") stop("Listening stopped when this page moved to the background. Start again when ready."); };
    const onExit = () => stop("");
    document.addEventListener("visibilitychange", onHidden); window.addEventListener("pagehide", onExit);
    return () => { document.removeEventListener("visibilitychange", onHidden); window.removeEventListener("pagehide", onExit); };
  }, [stop]);

  useEffect(() => {
    if (channel.current?.readyState === "open") {
      channel.current.send(JSON.stringify({ type: "session.update", session: { type: "realtime", instructions: micInstructions() } }));
    }
  }, [learner, task, objective, source, materialName, slideIndex,speaker,micInstructions]);

  function addFeedback(feedback: CoachFeedback, ctx: CoachContext, rehearsal = false, sourceTurnId?: string) {
    setEntries(previous => [{ id: crypto.randomUUID(), at: new Date().toISOString(), context: { ...ctx }, feedback, rehearsal, sourceTurnId }, ...previous].slice(0, 1500));
    setTurns(previous=>[...previous,{id:crypto.randomUUID(),at:new Date().toISOString(),role:"ai" as const,text:[feedback.focus,feedback.correction&&`Correction: ${feedback.correction}`,feedback.prompt&&`Ask: ${feedback.prompt}`,feedback.next&&`Next: ${feedback.next}`].filter(Boolean).join("\n"),rehearsal,sourceTurnId}].slice(-4000));
  }

  const acquireAudio = useCallback(() => audioInput.current.acquire(audioMode), [audioMode]);

  async function connectCallAudio() {
    if (choosingAudio || phaseRef.current !== "idle" || recordingBusy) return;
    setChoosingAudio(true); setError("");
    try {
      const connected = await audioInput.current.connectCall(() => {
        if (!mounted.current) return;
        setCallConnected(false); stop("Call audio sharing ended. Listening stopped; check the saved recording before reconnecting.");
        setError("Call audio sharing ended. Connect the call tab again before continuing the online lesson.");
      });
      if (mounted.current) { setCallConnected(connected); if (connected) setStatus("Call audio connected. The coach and recorder will receive your microphone and the call tab's sound."); }
    } catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : "Call audio could not connect."); }
    finally { if (mounted.current) setChoosingAudio(false); }
  }

  async function start() {
    if (phaseRef.current !== "idle" || !available || !agreed || working || choosingAudio || (audioMode === "online" && !callConnected)) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) { setError("Live listening needs microphone support in a secure browser window."); return; }
    stop(""); const attempt = generation.current;
    phaseRef.current = "connecting"; setPhase("connecting"); setError(""); setTranscript(""); setSeconds(0);
    setStatus("Connecting the microphone. Feedback will appear here silently.");
    const abort = new AbortController(); controller.current = abort;
    connectionDeadline.current = setTimeout(() => { if (generation.current === attempt) stop("The microphone connection timed out. Try again when ready."); }, 60000);
    try {
      const mic = await acquireAudio();
      if (generation.current !== attempt) { releaseLessonAudio(mic); return; }
      stream.current = mic;
      const pc = new RTCPeerConnection(); peer.current = pc;
      mic.getAudioTracks().forEach(track => { pc.addTrack(track, mic); track.onended = () => { if (generation.current === attempt) stop("The microphone disconnected. Start again when ready."); }; });
      const dc = pc.createDataChannel("oai-events"); channel.current = dc;
      dc.onopen = () => {
        if (generation.current !== attempt) return;
        if (connectionDeadline.current) clearTimeout(connectionDeadline.current);
        dc.send(JSON.stringify({type:"session.update",session:{type:"realtime",instructions:micInstructions()}}));sendImage();
        phaseRef.current = "listening"; setPhase("listening"); setStatus("Listening to the selected speaker. Confirm the name or leave the turn unassigned.");
        let elapsed = 0;
        interval.current = setInterval(() => { elapsed++; setSeconds(elapsed); if (elapsed >= COACH_MINUTES * 60) stop("This 15-minute listening session has ended. You can start another when ready."); }, 1000);
      };
      dc.onclose = () => { if (generation.current === attempt) stop("The listening connection closed. Your feedback remains here."); };
      dc.onmessage = event => {
        if (generation.current !== attempt) return;
        try {
          const value = JSON.parse(event.data);
          if(value.type==="input_audio_buffer.speech_started"&&typeof value.item_id==="string")turnSpeakers.current.set(value.item_id,speakerRef.current);
          if (value.type === "input_audio_buffer.committed" && typeof value.item_id === "string") {pendingContext.current.set(value.item_id, { ...contextRef.current });if(!turnSpeakers.current.has(value.item_id))turnSpeakers.current.set(value.item_id,speakerRef.current);pendingSpeakers.current.set(value.item_id,turnSpeakers.current.get(value.item_id)||"unknown");}
          if (value.type === "response.created") {
            const ctx = pendingContext.current.values().next().value as CoachContext | undefined;
            if (value.response?.id) responseContexts.current.set(value.response.id, ctx || { ...contextRef.current });
            const first = pendingContext.current.keys().next().value; if (first) {if(value.response?.id){responseSpeakers.current.set(value.response.id,pendingSpeakers.current.get(first)||"unknown");responseTurns.current.set(value.response.id,first);}pendingSpeakers.current.delete(first);pendingContext.current.delete(first);}
          }
          if (value.type === "conversation.item.input_audio_transcription.completed") {const text=String(value.transcript||"");setTranscript(text);setTurns(previous=>[...previous,{id:value.item_id||crypto.randomUUID(),at:new Date().toISOString(),role:turnSpeakers.current.get(value.item_id)||"unknown",text}].slice(-4000));turnSpeakers.current.delete(value.item_id);}
          if (value.type === "response.done") {
            const response = value.response;
            if (!response?.id || seenResponses.current.has(response.id)) return;
            seenResponses.current.add(response.id);
            if (seenResponses.current.size > 200) seenResponses.current.delete(seenResponses.current.values().next().value!);
            const ctx = responseContexts.current.get(response.id) || { ...contextRef.current }; responseContexts.current.delete(response.id);
            if (response.status !== "completed") { setError("One feedback response was incomplete. Let the learner finish and try again."); return; }
            const text = (response.output || []).flatMap((o: { content?: { type: string; text?: string }[] }) => o.content || []).filter((c: { type: string }) => c.type === "output_text").map((c: { text?: string }) => c.text || "").join("");
            const sourceTurnId=responseTurns.current.get(response.id);responseTurns.current.delete(response.id);
            const corrected=sourceTurnId?correctedSpeakers.current.has(sourceTurnId):false;
            const role=(sourceTurnId?correctedSpeakers.current.get(sourceTurnId):undefined)||responseSpeakers.current.get(response.id)||"unknown";responseSpeakers.current.delete(response.id);
            if (text && !corrected) {const feedback=parseCoachFeedback(text);if(role!=="learner"){feedback.correction="";feedback.uncertainty=role==="teacher"?"Teacher speech: this is context, not learner performance.":"Speaker unconfirmed. Confirm the caption label before using this as learner evidence.";ctx.learner=role==="teacher"?"Rory":"Speaker unclear";}addFeedback(feedback, ctx, false, sourceTurnId); setError(""); }
          }
          if (value.type === "error") stop("The AI listening service reported an error. Your feedback remains here; no automatic retry was made.");
        } catch { setError("One feedback response could not be read. Continue with the next answer."); }
      };
      pc.onconnectionstatechange = () => { if (generation.current === attempt && ["failed", "disconnected"].includes(pc.connectionState)) stop("The listening connection was interrupted. Start again when ready."); };
      const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
      const result = await post({ action: "connect", sdp: offer.sdp, context: contextRef.current }, abort.signal);
      if (generation.current !== attempt) return;
      await pc.setRemoteDescription({ type: "answer", sdp: result.sdp });
    } catch (e) {
      if (generation.current !== attempt) return;
      stop("Listening has stopped."); setError(e instanceof Error ? e.message : "The microphone could not connect.");
    }
  }

  function togglePause() {
    const paused = phaseRef.current === "listening";
    stream.current?.getAudioTracks().forEach(track => { track.enabled = !paused; });
    phaseRef.current = paused ? "paused" : "listening"; setPhase(phaseRef.current);
    setStatus(paused ? "Microphone paused. Resume when ready." : "Listening to the selected speaker.");
  }

  async function analyseTyped() {
    if (!draft.trim() || working || !agreed || !available || phaseRef.current !== "idle") return;
    const turnId = crypto.randomUUID();
    setTurns(previous=>[...previous,{id:turnId,at:new Date().toISOString(),role:"learner" as const,text:draft}].slice(-4000));
    const ctx = { ...contextRef.current }; setWorking(true); setError("");
    try { const result = await post({ action: "analyse", text: draft, context: ctx }); if (mounted.current) { if(!correctedSpeakers.current.has(turnId))addFeedback(result.feedback, ctx, false, turnId); setDraft(""); } }
    catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "Feedback is unavailable."); }
    finally { if (mounted.current) setWorking(false); }
  }

  async function askTeacherAI(){
    if(!question.trim()||asking||!available||!agreed)return;
    const text=question;setQuestion("");setAsking(true);setError("");
    setTurns(previous=>[...previous,{id:crypto.randomUUID(),at:new Date().toISOString(),role:"teacher" as const,text}].slice(-4000));
    try{const result=await post({action:"question",question:text,context:contextRef.current,evidence:turns.filter(t=>!t.rehearsal).slice(-8).map(t=>`${t.role}: ${t.text}`).join("\n"),...(slideImage.current?{image:slideImage.current}:{})});if(mounted.current)setTurns(previous=>[...previous,{id:crypto.randomUUID(),at:new Date().toISOString(),role:"ai" as const,text:result.answer}].slice(-4000));}
    catch(e){if(mounted.current){setQuestion(text);setError(e instanceof Error?e.message:"Your question could not be answered.");}}
    finally{if(mounted.current)setAsking(false);}
  }

  function openAudience(){
    if(typeof BroadcastChannel==="undefined"){setError("This browser cannot open a synchronised student window. Share a PDF window in your call instead.");return;}
    if(!audience.current){audienceId.current=crypto.randomUUID();audience.current=new BroadcastChannel(`rory-slide-${audienceId.current}`);audience.current.onmessage=event=>{if(event.data?.type==="ready")shareSlide();};}
    const opened=window.open(`${base}/teacher/audience/#session=${audienceId.current}`,`lesson-${audienceId.current}`,"popup,width=1100,height=750");
    if(!opened)setError("Allow the student presentation window to open, then share that window in your video call.");
    else{shareSlide();setStatus("Student slide window opened. In Zoom or Meet, share only that window; keep this presenter view private.");}
  }

  function correctSpeaker(id:string,role:"learner"|"teacher"|"unknown"){
    const turn=turns.find(t=>t.id===id);
    if(!turn||turn.role===role)return;
    correctedSpeakers.current.set(id,role);
    const corrected=correctCoachSpeaker({context:contextRef.current,turns,entries},id,role);
    setTurns(corrected.turns);setEntries(corrected.entries);
    setEvidenceRevision(value=>value+1);
    setStatus("Speaker label updated. Earlier coaching for that caption was removed. Ask for fresh feedback using the corrected speaker if needed.");
    if(turn&&channel.current?.readyState==="open")channel.current.send(JSON.stringify({type:"conversation.item.create",item:{type:"message",role:"user",content:[{type:"input_text",text:`Rory corrected the speaker of this earlier caption to ${role==="teacher"?"Rory (teacher)":role==="learner"?contextRef.current.learner+" (learner)":"unassigned"}: ${JSON.stringify(turn.text)}. Treat as evidence correction, not a new learner answer. Do not attribute teacher speech to the learner.`}]}}));
  }

  async function importMaterial(file?: File) {
    if (!file || importing || phaseRef.current !== "idle" || working) return;
    setError("");
    if (file.size > (/\.pdf$/i.test(file.name)?25_000_000:3_000_000)) { setError("Choose a PDF below 25 MB or a PowerPoint below 3 MB."); return; }
    setImporting(true);
    try {
      if (/\.pdf$/i.test(file.name)) {
        if (pdfRef.current) URL.revokeObjectURL(pdfRef.current);
        pdfRef.current = URL.createObjectURL(file); setPdfUrl(pdfRef.current);setPdfFile(file); setMaterialName(file.name); setSlides([]); setSource("");slideImage.current="";setView("presenter");
        setStatus("PDF opened in presenter view. The current slide image and extracted text supply AI context.");
      } else {
        let next: CoachSlide[];
        if (/\.pptx$/i.test(file.name)) {
          const bytes = new Uint8Array(await file.arrayBuffer()); let binary = "";
          for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
          next = (await post({ action: "import", data: btoa(binary) })).slides;
        } else if (/\.txt$/i.test(file.name)) next = [{ number: 1, text: (await file.text()).slice(0, 12000) }];
        else throw new Error("Choose a .pptx, .pdf or .txt file.");
        if (pdfRef.current) URL.revokeObjectURL(pdfRef.current); pdfRef.current = ""; setPdfUrl("");setPdfFile(null);slideImage.current="";
        setSlides(next); setSlideIndex(0); setSource(next[0]?.text || ""); setMaterialName(file.name);
        setStatus("Slide text is ready. Check image-only content and add any missing exercise instructions below.");
      }
    } catch (e) { setError(e instanceof Error ? e.message : "This material could not be opened."); }
    finally { setImporting(false); }
  }

  function download() {
    const text = [`# Live teaching notes`, `Exported ${new Date().toISOString()}`, "AI practice suggestions for teacher review. Rehearsal entries are labelled; no grades or automatic student submissions.","## Conversation",...turns.map(turn=>`${turn.at} · ${turn.rehearsal?"REHEARSAL · ":""}${turn.role==="learner"?selected?.name||"Learner":turn.role==="teacher"?"Rory":turn.role==="ai"?"AI":"Speaker unclear"}\n${turn.text}`),"## Teaching feedback", ...[...entries].reverse().map(entry => `\n### ${entry.rehearsal ? "REHEARSAL · " : ""}${entry.context.learner} · ${entry.context.slide}\n${entry.at}\nObjective: ${entry.context.objective}\n${Object.entries(entry.feedback).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n")}`)].join("\n\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `teaching-notes-${new Date().toISOString().slice(0, 10)}.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function changeLearner(code: string) {
    if (recordingBusy || asking || working) return;
    stop("Learner changed. Choose the activity before starting again.");
    audioInput.current.close(); setCallConnected(false);
    setLearner(code); setEntries([]);setTurns([]);setQuestion(""); setTranscript(""); setDraft(""); setAgreed(false); setRehearsalIndex(0); setError("");setSpeaker("unknown");
    audience.current?.postMessage({type:"clear"});
    setSource(""); setSlides([]); setSlideIndex(0); setMaterialName("");
    if (pdfRef.current) URL.revokeObjectURL(pdfRef.current); pdfRef.current = ""; setPdfUrl("");setPdfFile(null);slideImage.current="";
  }

  function tryRehearsal(index:number){
    const feedback=coachRehearsal[index%coachRehearsal.length];
    const turnId=crypto.randomUUID();
    setTurns(previous=>[...previous,{id:crypto.randomUUID(),at:new Date().toISOString(),role:"teacher" as const,text:index%2===0?"Tell me about yesterday.":"What happened next?",rehearsal:true},{id:turnId,at:new Date().toISOString(),role:"learner" as const,text:feedback.heard,rehearsal:true}].slice(-4000));
    addFeedback(feedback,{...contextRef.current,slide:"Prepared rehearsal · original speaking example"},true,turnId);setRehearsalIndex(index+1);
  }

  const latest = entries[0];
  const live = phase !== "idle";
  return <div className={`teacher-workspace live-coach ${view==="presenter"?"lc-presenter-mode":""}`}>
    <header className="teacher-topbar"><button type="button" className="teacher-quiet-button" disabled={recordingBusy} onClick={() => { stop(""); onBack(); }}>← Teacher dashboard</button><span className="lc-private">PRIVATE TEACHER VIEW</span><button type="button" className="teacher-quiet-button" onClick={download} disabled={!entries.length&&!turns.length}>Export notes</button></header>
    <main>
      <section className="lc-heading"><div><p className="teacher-eyebrow">LIVE TEACHING</p><h1>Stay with the learner.<br/><span>Keep the next step close.</span></h1><p>Silent coaching alongside your conversation and lesson slides.</p></div><div className={`lc-connection lc-${phase}`} role="status"><span aria-hidden>●</span> {phase === "listening" ? "Listening" : phase === "paused" ? "Microphone paused" : phase === "connecting" ? "Connecting…" : checking ? "Checking AI connection…" : available ? "AI connection configured" : "Rehearsal available"}{live && <small>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")} / {COACH_MINUTES}:00</small>}</div></section>
      {error && <p className="lc-error" role="alert">{error}</p>}
      <nav className="lc-view-tabs" aria-label="Teaching workspace view"><button type="button" aria-pressed={view==="presenter"} onClick={()=>setView("presenter")}>Presenter view</button><button type="button" aria-pressed={view==="setup"} onClick={()=>setView("setup")}>Lesson setup</button><button type="button" onClick={openAudience} disabled={!pdfFile}>Open student window ↗</button></nav>
      <section className="lc-panel" aria-label="Lesson audio source">
        <label>Where is this lesson?<select value={audioMode} disabled={live || recordingBusy || choosingAudio} onChange={event=>{audioInput.current.close();setCallConnected(false);setAudioMode(event.target.value as LessonAudioMode);setError("");}}><option value="room">In person · this microphone</option><option value="online">Online · microphone and call tab</option></select></label>
        {audioMode === "online" ? <><p className="lc-hint">Open your call in a browser tab. Connect that tab and tick Share tab audio so the learner is heard even when you use headphones. Only audio is used; no call video is sent or saved. If your browser does not offer tab audio, use a browser that does.</p><div className="lc-actions"><button type="button" className="teacher-quiet-button" disabled={live || recordingBusy || choosingAudio} onClick={()=>{if(callConnected){audioInput.current.disconnectCall();setCallConnected(false);}else void connectCallAudio();}}>{choosingAudio?"Choosing call tab…":callConnected?"Disconnect call audio":"Connect call audio"}</button><span role="status">{callConnected?"Microphone + call audio ready":"Call audio is not connected"}</span></div></> : <p className="lc-hint">The microphone captures people in the same room. For a remote learner, select Online and connect the call tab audio.</p>}
      </section>
      <div className={view==="presenter"?"lc-grid lc-presenter-grid":"lc-grid"}>
        <div className="lc-stage">
          {pdfFile&&<CoachSlidePresenter file={pdfFile} page={slideIndex+1} onLoaded={pdfLoaded} onContext={pdfContext} onPage={page=>setSlideIndex(page-1)}/>}
          {view==="presenter"&&!pdfFile&&<div className="lc-panel lc-no-slide"><p className="teacher-eyebrow">PRESENTER VIEW</p><h2>Bring your slides into the lesson.</h2><p>Open a PDF exported from PowerPoint to keep the original layout. Slide images and text become context for your AI commentary and questions.</p><button type="button" className="teacher-primary" onClick={()=>setView("setup")}>Open lesson material</button>{source&&<pre>{source}</pre>}</div>}
        <aside className={`lc-context lc-panel ${view==="presenter"?"lc-context-collapsed":""}`}>
          <div className="lc-section-title"><h2>Lesson context</h2></div>
          <label>Learner<select value={learner} onChange={e => changeLearner(e.target.value)} disabled={live || working || importing || asking || recordingBusy}>{learners.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}</select></label>
          <p className="lc-unit">{selected?.unit || "Original speaking practice"}</p>
          {selected?.focusNote && <p className="lc-hint">Saved teacher focus: {selected.focusNote}</p>}
          <label>Current activity<input value={task} maxLength={500} onChange={e => setTask(e.target.value)} placeholder="For example: tell me about yesterday"/></label>
          <label>What to listen for<textarea rows={3} value={objective} maxLength={700} onChange={e => setObjective(e.target.value)}/></label>
          <label className="lc-upload">{importing ? "Reading presentation…" : "Open lesson material"}<input type="file" accept=".pptx,.pdf,.txt" disabled={live || working || importing || asking} onChange={e => { void importMaterial(e.target.files?.[0]); e.target.value = ""; }}/></label>
          <p className="lc-hint">A PDF shows as slides, with the current slide’s text and picture as context for the AI. PowerPoint gives slide text only. PDFs are opened on this device. PowerPoint text is read privately by the app. Neither file is published to students.</p>
          {!!slides.length && !pdfFile && <label>Current slide<select value={slideIndex} onChange={e => { const index = Number(e.target.value); setSlideIndex(index); setSource(slides[index]?.text || ""); }}>{slides.map((s, i) => <option key={s.number} value={i}>Slide {s.number} · {s.text.slice(0, 55) || "No readable text"}</option>)}</select></label>}
          <label>Current slide / source text<textarea rows={7} value={source} maxLength={12000} onChange={e => setSource(e.target.value)} placeholder="Paste the current exercise, vocabulary or source passage. This text and the selected PDF slide image provide lesson context."/></label>
          {pdfUrl && <a className="lc-link" href={pdfUrl} target="_blank" rel="noreferrer">Open original PDF reference ↗</a>}
        </aside></div>
        <section className="lc-main">
          <div className="lc-panel lc-controls"><div className="lc-section-title"><h2>Listen, then guide</h2></div>
            <p>Choose who is speaking, then start. Leave mixed or uncertain turns as “Speaker unclear” and check their labels in the commentary. Changing a label removes that turn’s earlier coaching.</p>
            <label className="lc-consent"><input type="checkbox" checked={agreed} onChange={e => { setAgreed(e.target.checked); if (!e.target.checked && live) stop("Listening stopped."); }}/>The learner and parent understand and have agreed to AI processing for this lesson.</label>
            <label>Microphone speaker<select value={speaker} onChange={e=>setSpeaker(e.target.value as typeof speaker)}><option value="unknown">Speaker unclear · keep unassigned</option><option value="learner">{selected?.name||"Learner"}</option><option value="teacher">Rory</option></select></label>
            <div className="lc-actions">{!live ? <button type="button" className="teacher-primary" disabled={!available || !agreed || working || importing || !learner || choosingAudio || (audioMode === "online" && !callConnected)} onClick={() => void start()}>Start listening</button> : <><button type="button" className="teacher-primary" disabled={phase === "connecting"} onClick={togglePause}>{phase === "paused" ? "Resume microphone" : "Pause microphone"}</button><button type="button" className="teacher-quiet-button" onClick={() => stop("Listening ended. You can export the notes or start another session.")}>End listening</button></>}<button type="button" className="teacher-quiet-button" disabled={live || working} onClick={() => tryRehearsal(rehearsalIndex)}>Try prepared rehearsal</button></div>
            <p className="lc-hint" role="status">{status}</p>
            {!available && !checking && <p className="lc-hint">Live AI is not enabled. Rehearsal shows prepared examples without sending audio or using API credit.</p>}
            <p className="lc-hint">Text feedback only. Audio goes to OpenAI while connected. Each AI session ends after 15 minutes, and leaving this page stops it. The lesson recorder below is separate and keeps going.</p>
          </div>
          <div className="lc-panel lc-feedback" aria-live="polite" aria-atomic="true"><div className="lc-section-title"><h2>Your next teaching move</h2>{latest?.rehearsal && <span className="lc-badge">PREPARED EXAMPLE</span>}</div>
            {latest ? <><p className="lc-evidence-label">{latest.context.learner} · {latest.context.slide}</p><blockquote>“{latest.feedback.heard || "The words were not clear enough to quote."}”</blockquote><div className="lc-feedback-pair"><div><h3>What worked</h3><p>{latest.feedback.strength || "Wait for a clearer answer."}</p></div><div><h3>Focus now</h3><p>{latest.feedback.focus}</p></div></div>{latest.feedback.correction && <div className="lc-correction"><h3>Minimal correction</h3><p>{latest.feedback.correction}</p></div>}<div className="lc-prompt"><h3>Ask the learner</h3><p>{latest.feedback.prompt}</p></div><div className="lc-next"><h3>Teach next</h3><p>{latest.feedback.next}</p></div>{latest.feedback.uncertainty && <p className="lc-hint">{latest.feedback.uncertainty}</p>}</> : <div className="lc-empty"><span aria-hidden>↳</span><h3>Space to think, while they speak.</h3><p>A faithful quote, one useful teaching point and a question you can ask next will appear here.</p><button type="button" className="lc-link" onClick={() => tryRehearsal(0)}>See an example</button></div>}
          </div>
          <section className="lc-panel lc-commentary"><div className="lc-section-title"><h2>Running commentary</h2><span className="lc-badge">PRIVATE</span></div><div className="lc-talk-feed" role="log" aria-label="Rory, learner and AI conversation">{!turns.length&&<p className="lc-hint">{selected?.name||"Learner"}, Rory and AI will appear separately here. Unknown speakers stay unassigned.</p>}{turns.map(turn=><article className={`lc-turn lc-turn-${turn.role}`} key={turn.id}><div className="lc-turn-heading"><strong>{turn.role==="ai"?"AI coaching":turn.role==="teacher"?"Rory":turn.role==="learner"?selected?.name||"Learner":"Speaker unclear"}{turn.rehearsal?" · rehearsal":""}</strong><small>{new Date(turn.at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</small></div><p>{turn.text}</p>{turn.role!=="ai"&&<label className="lc-speaker-edit">Speaker label<select value={turn.role} onChange={e=>correctSpeaker(turn.id,e.target.value as "learner"|"teacher"|"unknown")}><option value="unknown">Speaker unclear</option><option value="learner">{selected?.name||"Learner"}</option><option value="teacher">Rory</option></select></label>}</article>)}</div><form onSubmit={e=>{e.preventDefault();void askTeacherAI();}}><label>Ask the AI privately<textarea rows={2} value={question} maxLength={4000} onChange={e=>setQuestion(e.target.value)} placeholder="How can I explain this? What question should I ask next?"/></label><button type="submit" className="teacher-primary" disabled={!available||!agreed||!question.trim()||asking}>{asking?"Thinking…":"Ask AI"}</button><p className="lc-hint">Uses the selected slide and recent conversation. Your question and answer stay in this teacher view.</p></form></section>
          <CoachLessonArchive key={`${learner}:${lessonSession}`} learnerCode={learner} snapshot={{ context, turns, entries }} acquireAudio={acquireAudio} evidenceRevision={evidenceRevision} onBusy={setRecordingBusy} onFocus={note => { setObjective(note); setStatus("Saved teacher review loaded as the lesson focus."); }}/>
          <details className="lc-panel lc-details"><summary>Enter an answer manually</summary><p className="lc-hint">For checking exact wording. Typed answers say nothing about pronunciation.</p><label>Learner’s actual words<textarea value={draft} maxLength={4000} rows={3} onChange={e => setDraft(e.target.value)} placeholder="Keep the learner’s original wording and mistakes."/></label><button className="teacher-primary" type="button" disabled={live || !available || !agreed || !draft.trim() || working} onClick={() => void analyseTyped()}>{working ? "Preparing feedback…" : "Get teaching feedback"}</button></details>
          {transcript && <details className="lc-panel lc-details"><summary>Latest machine caption · check against what you heard</summary><p>{transcript}</p><p className="lc-hint">Captions can mishear or normalise errors. Use your judgement before correcting the learner.</p></details>}
          {!!entries.length && <details className="lc-panel lc-details"><summary>Session trail · {entries.length} {entries.length === 1 ? "answer" : "answers"}</summary>{entries.map(entry => <article className="lc-trail" key={entry.id}><small>{entry.rehearsal ? "REHEARSAL · " : ""}{new Date(entry.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {entry.context.slide}</small><p>“{entry.feedback.heard}”</p><p>{entry.feedback.focus}</p></article>)}<button type="button" className="teacher-quiet-button" disabled={recordingBusy || working || asking} onClick={() => { stop("Fresh lesson started. Previously saved history is still available."); setEntries([]);setTurns([]); setTranscript(""); setLessonSession(value => value + 1); }}>Start fresh lesson</button><p className="lc-hint">Save or export working notes first. Previously saved lessons are kept.</p></details>}
        </section>
      </div>
    </main>
  </div>;
}
