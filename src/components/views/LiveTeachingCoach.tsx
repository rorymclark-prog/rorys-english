"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { automaticCoachFeedback, coachSpeakerLabel, parseCoachSpeaker, parseCoachPosition, boundCoachFeedback, coachInstructions, coachRehearsal, COACH_MINUTES, parseCoachFeedback, type CoachContext, type CoachEntry, type CoachFeedback } from "@/lib/live-coach";
import type { CoachSlide } from "@/lib/server/coach-material";
import "@/app/teacher/live-coach.css";
import CoachSlidePresenter from "@/components/CoachSlidePresenter";
import CoachLessonArchive from "@/components/CoachLessonArchive";
import type { CoachTurn } from "@/lib/coach-archive";
import { correctCoachSpeaker } from "@/lib/coach-evidence";
import { LessonAudioInput, releaseLessonAudio, type LessonAudioMode } from "@/lib/lesson-audio";
import { CoachTurnQueue, nativeCoachEvent } from "@/lib/coach-turns";
import { coachLessonMap, verifiedCoachPosition, type LessonPage } from "@/lib/coach-position";
import CoachFolderLibrary from "@/components/CoachFolderLibrary";
import CoachLessonPicker from "@/components/CoachLessonPicker";
import CoachCompanion, { useCoachCompanion } from "@/components/CoachCompanion";
import { coachPdfResources, type CoachLearnerLibrary, type CoachLessonResource, type CoachLessonSelection } from "@/lib/coach-lessons";
import { coachReferenceSource, coachSlideNotes, type CoachReference } from "@/lib/coach-reference";
import { readCoachPptxLocally, type LocalCoachSlide } from "@/lib/coach-pptx";
import CoachLibraryConnection, { type CoachCloudLesson, type CoachCloudMaterialMeta } from "@/components/CoachLibraryConnection";

type Learner = { code: string; name: string; unit?: string; focusNote?: string; library?: CoachLearnerLibrary };
type Phase = "idle" | "connecting" | "listening" | "paused";
type TalkTurn = CoachTurn;
const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function LiveTeachingCoach({ token, learners, onBack, initialLearner }: { token: string; learners: Learner[]; onBack: () => void; initialLearner?:string }) {
  const [learner, setLearner] = useState(initialLearner && learners.some(item=>item.code===initialLearner)?initialLearner:"");
  const selected = learners.find(s => s.code === learner);
  const [task, setTask] = useState("Talk about a recent day or experience.");
  const [objective, setObjective] = useState("Complete sentences, useful vocabulary and one reason or extra detail.");
  const [source, setSource] = useState("");
  const [reference, setReference] = useState<CoachReference | null>(null);
  const [lessonChosen,setLessonChosen]=useState(false);
  const [referenceLoading,setReferenceLoading]=useState(false);
  const [referenceReady,setReferenceReady]=useState(false);
  const [tracking,setTracking]=useState<"auto"|"manual">("auto");
  const [aiPage,setAiPage]=useState<number|null>(null);
  const [referenceRevision,setReferenceRevision]=useState(0);
  const [positionNote,setPositionNote]=useState("");
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [slides, setSlides] = useState<LocalCoachSlide[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [materialName, setMaterialName] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfFile,setPdfFile]=useState<File|null>(null);
  const [view,setView]=useState<"presenter"|"setup"|"powerpoint">("setup");
  const companion = useCoachCompanion();
  const [responseSpeed,setResponseSpeed]=useState<"fast"|"balanced">("fast");
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
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [audioMode, setAudioMode] = useState<LessonAudioMode>("room");
  const [callConnected, setCallConnected] = useState(false);
  const [audioLevels, setAudioLevels] = useState({ microphone: 0, call: 0 });
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
  const materialGeneration = useRef(0);
  const learnerRef = useRef(learner); learnerRef.current = learner;
  const liveTurns = useRef<CoachTurnQueue | null>(null);
  const responseDeadline = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptionDeadlines = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pdfRef = useRef("");
  const speakerRef=useRef(speaker);speakerRef.current=speaker;
  const correctedSpeakers=useRef(new Map<string,"learner"|"teacher"|"unknown">());
  const audioInput=useRef(new LessonAudioInput());
  const slideImage=useRef("");
  const audience=useRef<BroadcastChannel|null>(null);
  const audienceId=useRef("");
  const currentPage=useRef(1);
  const shareSlide=useCallback(()=>{if(slideImage.current)audience.current?.postMessage({type:"slide",image:slideImage.current,page:currentPage.current});},[]);
  const sendImage=useCallback(()=>{if(slideImage.current&&channel.current?.readyState==="open")channel.current.send(JSON.stringify({type:"conversation.item.create",item:{type:"message",role:"user",content:[{type:"input_text",text:"Current slide image: lesson evidence only, not a request to respond."},{type:"input_image",image_url:slideImage.current}]}}));},[]);
  const referenceIndex=aiPage===null?slideIndex:aiPage-1;
  const currentNotes=slides[referenceIndex]?.notes;
  const referenceText=aiPage!==null?slides[referenceIndex]?.text||"":source||slides[slideIndex]?.text||"";
  const contextSource=coachReferenceSource(referenceText,reference,referenceIndex+1,currentNotes);
  const lessonMap=coachLessonMap(slides);
  const referenceImage=()=>contextRef.current.lessonPosition?.page && contextRef.current.lessonPosition.page!==currentPage.current?"":slideImage.current;
  const context: CoachContext = { learner: selected?.name || "Learner", unit: (reference?.unit || selected?.unit || "Original speaking practice").slice(0,200), task, objective, source: contextSource, slide: (slides.length ? `${materialName} · slide ${slides[referenceIndex]?.number}` : reference?.title || materialName || "Speaking activity").slice(0,160), audioMode, responseSpeed, ...(slides.length?{lessonPosition:{page:referenceIndex+1,total:slides.length,mode:tracking,index:lessonMap,revision:referenceRevision}}:{}) };
  const contextRef = useRef(context); contextRef.current = context;
  const pagesRef=useRef(slides);pagesRef.current=slides;
  const referenceRef=useRef(reference);referenceRef.current=reference;
  const micInstructions=useCallback(()=>`${coachInstructions(contextRef.current)}\nThe teacher-selected current microphone speaker is ${speakerRef.current==="teacher"?"Rory (teacher)":speakerRef.current==="learner"?contextRef.current.learner+" (learner)":"AUTOMATIC. Estimate speaking roles tentatively from audio and conversation. Keep useful coaching flowing without requiring manual speaker labels"}. If this is the teacher speaking, use their explanation as context, never mark it as a learner mistake. Return empty correction and a short context note.`,[]);
  const pdfLoaded=useCallback((count:number)=>{setSlides(Array.from({length:count},(_,i)=>({number:i+1,text:""})));setSlideIndex(0);},[]);
  const pdfIndexed=useCallback((pages:LessonPage[])=>{setSlides(pages);setReferenceLoading(false);setReferenceReady(true);setStatus(pages.some(page=>page.text.trim())?`Whole PDF ready: ${pages.length} pages available for lesson tracking.`:"This PDF has no readable text. The AI can use the displayed page image, but cannot reliably locate other pages from speech.");},[]);
  const pdfIndexError=useCallback((message:string)=>{setReferenceLoading(false);setReferenceReady(false);setError(message);},[]);
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
    if (responseDeadline.current) clearTimeout(responseDeadline.current);
    for (const timer of transcriptionDeadlines.current.values()) clearTimeout(timer);
    transcriptionDeadlines.current.clear();
    const dc = channel.current; channel.current = null; dc?.close();
    const pc = peer.current; peer.current = null; pc?.close();
    releaseLessonAudio(stream.current); stream.current = null;
    liveTurns.current?.clear(); liveTurns.current = null; correctedSpeakers.current.clear();
    phaseRef.current = "idle";
    if (mounted.current) { setPhase("idle"); setStatus(message); }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; materialGeneration.current++; stop(""); audioInput.current.close(); if (pdfRef.current) URL.revokeObjectURL(pdfRef.current);audience.current?.postMessage({type:"clear"});audience.current?.close(); };
  }, [stop]);

  useEffect(() => {
    const request = new AbortController(); setChecking(true);
    post({ action: "status" }, request.signal).then(r => setAvailable(r.available === true)).catch(e => { if (!request.signal.aborted) setError(e.message); }).finally(() => { if (!request.signal.aborted) setChecking(false); });
    return () => request.abort();
  }, [post]);

  useEffect(() => {
    if (audioMode !== "online" || (!recordingBusy && phase === "idle")) { setAudioLevels({ microphone: 0, call: 0 }); return; }
    const timer = setInterval(() => setAudioLevels(audioInput.current.levels()), 150);
    return () => clearInterval(timer);
  }, [audioMode, recordingBusy, phase]);

  useEffect(() => {
    const onHidden = () => { if (document.hidden && !companion.activeWhileHidden() && phaseRef.current !== "idle") stop("Listening stopped because both the teaching page and private coach are hidden or closed. Start again when ready."); };
    const onExit = () => stop("");
    document.addEventListener("visibilitychange", onHidden); window.addEventListener("pagehide", onExit);
    onHidden();
    return () => { document.removeEventListener("visibilitychange", onHidden); window.removeEventListener("pagehide", onExit); };
  }, [stop,companion.activeWhileHidden,companion.isOpen,companion.visibilityRevision]);

  useEffect(() => {
    if (channel.current?.readyState === "open") {
      channel.current.send(JSON.stringify({ type: "session.update", session: { type: "realtime", instructions: micInstructions(), audio: { input: { turn_detection: { type: "server_vad", threshold: 0.5, prefix_padding_ms: 400, silence_duration_ms: responseSpeed === "fast" ? 650 : 1100, create_response: false, interrupt_response: false } } } } }));
    }
  }, [learner, task, objective, contextSource, materialName, slideIndex,aiPage,tracking,speaker,responseSpeed,micInstructions]);

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
    if (phaseRef.current !== "idle" || !available || !agreed || !learner || !lessonChosen || referenceLoading || !referenceReady || working || importing || libraryBusy || choosingAudio || (audioMode === "online" && !callConnected)) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) { setError("Live listening needs microphone support in a secure browser window."); return; }
    stop(""); const attempt = generation.current;
    const queue = new CoachTurnQueue(); liveTurns.current = queue;
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
      const requestNext = () => {
        if (generation.current !== attempt || dc.readyState !== "open") return;
        const request = queue.next();
        if (!request) return;
        dc.send(JSON.stringify(nativeCoachEvent(request)));
        responseDeadline.current = setTimeout(() => {
          if (generation.current === attempt) stop("AI feedback timed out. Listening stopped; your saved recording and lesson notes are separate. Start again when ready.");
        }, 45000);
      };
      dc.onopen = () => {
        if (generation.current !== attempt) return;
        if (connectionDeadline.current) clearTimeout(connectionDeadline.current);
        dc.send(JSON.stringify({type:"session.update",session:{type:"realtime",instructions:micInstructions()}}));sendImage();
        phaseRef.current = "listening"; setPhase("listening"); setStatus("Listening hands-free. Speaker estimates and teaching suggestions appear automatically.");
        let elapsed = 0;
        interval.current = setInterval(() => { elapsed++; setSeconds(elapsed); if (elapsed >= COACH_MINUTES * 60) stop("This 15-minute listening session has ended. You can start another when ready."); }, 1000);
      };
      dc.onclose = () => { if (generation.current === attempt) stop("The listening connection closed. Your feedback remains here."); };
      dc.onmessage = event => {
        if (generation.current !== attempt) return;
        try {
          const value = JSON.parse(event.data);
          if(value.type==="input_audio_buffer.speech_started"&&typeof value.item_id==="string")queue.speechStarted(value.item_id,speakerRef.current);
          if (value.type === "input_audio_buffer.committed" && typeof value.item_id === "string") {
            queue.committed(value.item_id, contextRef.current, speakerRef.current, referenceImage());
            if (queue.needsTranscript(value.item_id) && !transcriptionDeadlines.current.has(value.item_id)) {
              const id = value.item_id;
              transcriptionDeadlines.current.set(id, setTimeout(() => {
                transcriptionDeadlines.current.delete(id);
                if (generation.current !== attempt) return;
                queue.transcriptionFailed(id); setError("One caption timed out. No learner correction was made for that turn."); requestNext();
              }, 20000));
            }
            requestNext();
          }
          if (value.type === "response.created") queue.responseCreated(value.response || {});
          if (value.type === "conversation.item.input_audio_transcription.completed" && typeof value.item_id === "string") {
            clearTimeout(transcriptionDeadlines.current.get(value.item_id)); transcriptionDeadlines.current.delete(value.item_id);
            const turn = queue.transcribed(value.item_id, String(value.transcript || ""), speakerRef.current);
            if (turn) {
              setTranscript(turn.caption);
              setTurns(previous => previous.some(item => item.id === turn.id) ? previous : [...previous, { id: turn.id, at: new Date().toISOString(), role: turn.role, text: turn.caption }].slice(-4000));
            }
            requestNext();
          }
          if (value.type === "conversation.item.input_audio_transcription.failed" && typeof value.item_id === "string") {
            clearTimeout(transcriptionDeadlines.current.get(value.item_id)); transcriptionDeadlines.current.delete(value.item_id);
            queue.transcriptionFailed(value.item_id); setError("One caption could not be transcribed. No learner correction was made for that turn."); requestNext();
          }
          if (value.type === "response.done") {
            const response = value.response;
            const completed = queue.completed(response || {});
            if (!completed) return;
            if (responseDeadline.current) clearTimeout(responseDeadline.current);
            try {
              if (!completed.invalidated) {
                if (response.status !== "completed") setError("One feedback response was incomplete. Continue with the next answer.");
                else {
                  const text = (response.output || []).flatMap((o: { content?: { type: string; text?: string }[] }) => o.content || []).filter((c: { type: string }) => c.type === "output_text").map((c: { text?: string }) => c.text || "").join("");
                  if (!text) throw new Error("Empty coaching response");
                  const { turn } = completed.request;
                  const automatic = turn.role === "unknown";
                  const parsed = parseCoachFeedback(text);
                  const estimate = automatic ? parseCoachSpeaker(text) : undefined;
                  const feedback = estimate ? automaticCoachFeedback(parsed, turn.caption, estimate) : boundCoachFeedback(parsed, turn.caption);
                  if (estimate) {
                    queue.rememberSpeaker(turn.id, estimate);
                    setTurns(previous => previous.map(item => item.id === turn.id && item.role === "unknown" ? { ...item, speakerEstimate: estimate } : item));
                  }
                  const ctx = { ...turn.context };
                  if (estimate) ctx.learner = coachSpeakerLabel({ role: "unknown", speakerEstimate: estimate }, turn.context.learner);
                  else if (turn.role !== "learner") {
                    feedback.correction = ""; feedback.strength = ""; feedback.prompt = ""; feedback.next = "";
                    feedback.focus = turn.role === "teacher" ? "Teacher context only. This turn is not learner evidence." : "Confirm who spoke before using this turn as learner evidence.";
                    feedback.uncertainty = turn.role === "teacher" ? "Teacher speech: this is context, not learner performance." : "Speaker unconfirmed. Confirm the caption label before using this as learner evidence.";
                    ctx.learner = turn.role === "teacher" ? "Rory" : "Speaker unclear";
                  }
                  if(turn.context.lessonPosition?.mode==="auto" && contextRef.current.lessonPosition?.mode==="auto" && (contextRef.current.lessonPosition.revision||0)===(turn.context.lessonPosition.revision||0)){
                    const located=verifiedCoachPosition(parseCoachPosition(text),turn.caption,pagesRef.current);
                    if(located && located!==turn.context.lessonPosition.page){
                      setAiPage(located);setPositionNote(`AI reference follows page ${located} · estimated from the conversation. Displayed slides stay under your control.`);
                      ctx.slide=`${materialName} · slide ${located}`.slice(0,160);
                      ctx.source=coachReferenceSource(pagesRef.current[located-1]?.text||"",referenceRef.current,located,pagesRef.current[located-1]?.notes);
                      if(ctx.lessonPosition)ctx.lessonPosition={...ctx.lessonPosition,page:located};
                    }
                  }
                  queue.rememberFeedback(turn.id, feedback);
                  addFeedback(feedback, ctx, false, turn.id); setError("");
                }
              }
            } finally { requestNext(); }
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
    setStatus(paused ? "Microphone paused. Resume when ready." : "Listening. Automatic mode follows both speakers without clicks.");
  }

  async function analyseTyped() {
    if (!draft.trim() || working || !agreed || !available || !learner || !lessonChosen || referenceLoading || phaseRef.current !== "idle") return;
    const turnId = crypto.randomUUID();
    setTurns(previous=>[...previous,{id:turnId,at:new Date().toISOString(),role:"learner" as const,text:draft}].slice(-4000));
    const ctx = { ...contextRef.current }; setWorking(true); setError("");
    try { const result = await post({ action: "analyse", text: draft, context: ctx }); if (mounted.current) { if(!correctedSpeakers.current.has(turnId))addFeedback(result.feedback, ctx, false, turnId); setDraft(""); } }
    catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "Feedback is unavailable."); }
    finally { if (mounted.current) setWorking(false); }
  }

  async function askTeacherAI(){
    if(!question.trim()||asking||!available||!agreed||referenceLoading||!learner||!lessonChosen)return;
    const text=question;setQuestion("");setAsking(true);setError("");
    setTurns(previous=>[...previous,{id:crypto.randomUUID(),at:new Date().toISOString(),role:"teacher" as const,text}].slice(-4000));
    try{const result=await post({action:"question",question:text,context:contextRef.current,evidence:turns.filter(t=>!t.rehearsal).slice(-8).map(t=>`${t.role}: ${t.text}`).join("\n"),...(referenceImage()?{image:referenceImage()}:{})});if(mounted.current)setTurns(previous=>[...previous,{id:crypto.randomUUID(),at:new Date().toISOString(),role:"ai" as const,text:result.answer}].slice(-4000));}
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
    if(!turn||(turn.role===role&&!turn.speakerEstimate))return;
    correctedSpeakers.current.set(id,role);
    liveTurns.current?.correctSpeaker(id,role);
    const corrected=correctCoachSpeaker({context:contextRef.current,turns,entries},id,role);
    setTurns(corrected.turns);setEntries(corrected.entries);
    setEvidenceRevision(value=>value+1);
    setStatus("Speaker corrected for this turn. Linked suggestions were removed; automatic listening continues.");
    if(turn&&channel.current?.readyState==="open")channel.current.send(JSON.stringify({type:"conversation.item.create",item:{type:"message",role:"user",content:[{type:"input_text",text:`Rory corrected the speaker of this earlier caption to ${role==="teacher"?"Rory (teacher)":role==="learner"?contextRef.current.learner+" (learner)":"unassigned"}: ${JSON.stringify(turn.text)}. Treat as evidence correction, not a new learner answer. Do not attribute teacher speech to the learner.`}]}}));
  }

  function clearMaterial() {
    materialGeneration.current++;setAiPage(null);setPositionNote("");setReferenceReady(false);setReferenceLoading(false);
    if (pdfRef.current) URL.revokeObjectURL(pdfRef.current);
    pdfRef.current="";setPdfUrl("");setPdfFile(null);setSlides([]);setSlideIndex(0);setSource("");setMaterialName("");
    slideImage.current="";audience.current?.postMessage({type:"clear"});
  }

  function selectSlide(index: number) {
    if (index<0 || index>=slides.length) return;
    slideImage.current="";audience.current?.postMessage({type:"clear"});
    setReferenceRevision(value=>value+1);setSlideIndex(index);setAiPage(null);setPositionNote("");setSource(slides[index]?.text||"");
  }

  function chooseSavedLesson(lesson: CoachLessonSelection) {
    if (lesson.learnerCode!==learnerRef.current || live || importing || working || asking) return;
    clearMaterial();setSelectedLessonId(lesson.id);setLessonChosen(true);setReferenceReady(true);
    setReference({title:lesson.title,unit:lesson.unitLabel,overview:"Saved preparation only. Linked document contents have not been read."});
    setTask(lesson.task);setObjective(lesson.objective);setSource(lesson.source);
    setStatus("Saved preparation selected as AI reference. Open its slides or PowerPoint to add the current exercise.");
  }

  function chooseCloudLesson(lesson: CoachCloudLesson) {
    if (lesson.learnerCode!==learnerRef.current || live || importing || working || asking) return;
    const id=`cloud:${lesson.packId}`;
    if (selectedLessonId!==id) clearMaterial();
    setSelectedLessonId(id);setTask(lesson.task);setObjective(lesson.objective);setLessonChosen(true);setReferenceReady(true);
    setReference({title:lesson.title,unit:lesson.unitLabel,overview:`Private prepared lesson · ${lesson.edition}. Preparation is not evidence of completion or learner ability.`,guide:lesson.guide,teacherNotes:lesson.teacherNotes,notesHistorical:lesson.notesHistorical});
    setStatus("Saved lesson guidance selected. Its current delivery guide and matching supporting teacher notes accompany the selected slide.");
  }

  async function applyMaterial(file: File, attempt: number, owner: string, preserveReference: boolean) {
      const current=()=>mounted.current&&materialGeneration.current===attempt&&learnerRef.current===owner;
      if (/\.pdf$/i.test(file.name)) {
        if (!current()) return;
        if (pdfRef.current) URL.revokeObjectURL(pdfRef.current);
        pdfRef.current = URL.createObjectURL(file); setPdfUrl(pdfRef.current);setPdfFile(file); setMaterialName(file.name); setSlides([]);setSlideIndex(0); setSource("");slideImage.current="";setView("presenter");
        audience.current?.postMessage({type:"clear"});
        setLessonChosen(true);setReferenceLoading(true);setReferenceReady(false);setAiPage(null);setPositionNote("");setStatus("Reading the whole PDF so the AI can follow its activities, not just the cover.");
      } else {
        let next: LocalCoachSlide[];
        if (/\.pptx$/i.test(file.name)) {
          next = await readCoachPptxLocally(file);
        } else if (/\.txt$/i.test(file.name)) next = [{ number: 1, text: (await file.text()).slice(0, 12000) }];
        else throw new Error("Choose a .pptx, .pdf or .txt file.");
        if (!current()) return;
        if (pdfRef.current) URL.revokeObjectURL(pdfRef.current); pdfRef.current = ""; setPdfUrl("");setPdfFile(null);slideImage.current="";
        audience.current?.postMessage({type:"clear"});
        setSlides(next); setSlideIndex(0); setSource(next[0]?.text || ""); setMaterialName(file.name);
        setView("powerpoint");setLessonChosen(true);setReferenceReady(true);setReferenceLoading(false);setAiPage(null);setPositionNote("");
        setStatus("PowerPoint/source text is ready as AI reference. Teach from the original deck for layout, reveals and media; match the current slide here.");
      }
      if (!preserveReference) {setReference(null);setSelectedLessonId("");setTask(file.name.slice(0,500));setObjective("Follow the selected document’s current exercise and teaching instructions. Notice useful language, understanding and opportunities for a fuller answer.");}
  }

  async function importMaterial(file?: File, meta?: CoachCloudMaterialMeta) {
    if (!file || importing || phaseRef.current !== "idle" || working || asking || (meta&&meta.learnerCode!==learnerRef.current)) return;
    setError("");
    const limit=/\.pdf$/i.test(file.name)?25_000_000:/\.pptx$/i.test(file.name)?64_000_000:3_000_000;
    if (file.size>limit) {setError("Choose a PDF below 25 MB, a PowerPoint below 64 MB, or a text file below 3 MB.");return;}
    const attempt=++materialGeneration.current,owner=learnerRef.current;
    setImporting(true);
    try {
      await applyMaterial(file,attempt,owner,!!meta);
      if (!mounted.current || materialGeneration.current!==attempt || learnerRef.current!==owner) return;
      if (meta) {
        const id=`cloud:${meta.packId}`;
        if(selectedLessonId!==id||meta.guide){setReference({title:meta.title,unit:`${selected?.name} · ${meta.edition}`,overview:meta.historical?meta.warning:"Selected prepared lesson and its current document are the AI reference.",guide:meta.guide,teacherNotes:meta.teacherNotes,notesHistorical:meta.notesHistorical});setObjective(meta.focus.slice(0,700));}
        else if(meta.historical)setReference(previous=>previous?{...previous,overview:`${previous.overview}\n${meta.warning}`}:{title:meta.title,unit:meta.edition,overview:meta.warning});
        setSelectedLessonId(id);setTask(meta.title.slice(0,500));setLessonChosen(true);
        if(meta.warning)setStatus(meta.warning);
      }
    } catch (e) {if(mounted.current&&materialGeneration.current===attempt)setError(e instanceof Error ? e.message : "This material could not be opened.");}
    finally {if(mounted.current&&materialGeneration.current===attempt)setImporting(false);}
  }

  async function openSavedPdf(resource: CoachLessonResource) {
    if(importing||live||working||asking||!coachPdfResources(selected?.library).some(item=>item.url===resource.url))return;
    const attempt=++materialGeneration.current,owner=learnerRef.current;setImporting(true);setError("");
    try {
      const response=await fetch(`${base}${resource.url}`,{cache:"no-store"});
      if(!response.ok)throw new Error("The saved slide PDF could not be downloaded. Try again when connected.");
      const blob=await response.blob();
      if(blob.size>25_000_000)throw new Error("This PDF is larger than 25 MB. Open the original separately.");
      await applyMaterial(new File([blob],resource.url.split("/").pop()||"Lesson.pdf",{type:"application/pdf"}),attempt,owner,false);
      if(mounted.current&&materialGeneration.current===attempt&&learnerRef.current===owner){setSelectedLessonId(`pdf:${resource.url}`);setTask(resource.title.slice(0,500));setObjective(`Follow ${resource.unit}. Use the selected slide instructions and actual answers to choose the next teaching move.`.slice(0,700));setReference({title:resource.title,unit:resource.unit,overview:`Approved student slide copy · ${resource.schoolYear}. ${resource.blurb||""}`});}
    }catch(e){if(mounted.current&&materialGeneration.current===attempt)setError(e instanceof Error?e.message:"The saved PDF could not open.");}
    finally{if(mounted.current&&materialGeneration.current===attempt)setImporting(false);}
  }

  function download() {
    const text = [`# Live teaching notes`, `Exported ${new Date().toISOString()}`, "AI practice suggestions for teacher review. Rehearsal entries are labelled; no grades or automatic student submissions.","## Conversation",...turns.map(turn=>`${turn.at} · ${turn.rehearsal?"REHEARSAL · ":""}${coachSpeakerLabel(turn,selected?.name||"Learner")}\n${turn.text}`),"## Teaching feedback", ...[...entries].reverse().map(entry => `\n### ${entry.rehearsal ? "REHEARSAL · " : ""}${entry.context.learner} · ${entry.context.slide}\n${entry.at}\nObjective: ${entry.context.objective}\n${Object.entries(entry.feedback).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n")}`)].join("\n\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `teaching-notes-${new Date().toISOString().slice(0, 10)}.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function changeLearner(code: string) {
    if (recordingBusy || asking || working || importing) return;
    companion.close();clearMaterial();setReference(null);setSelectedLessonId("");
    stop("Learner changed. Choose the activity before starting again.");
    audioInput.current.close(); setCallConnected(false);
    setLearner(code);setLessonChosen(false);setReferenceReady(false);setReferenceLoading(false);setAiPage(null);setPositionNote(""); setEntries([]);setTurns([]);setQuestion(""); setTranscript(""); setDraft(""); setAgreed(false); setRehearsalIndex(0); setError("");setSpeaker("unknown");
    setTask("Talk about a recent day or experience.");setObjective("Complete sentences, useful vocabulary and one reason or extra detail.");
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
  return <div className={`teacher-workspace live-coach ${live?"lc-is-live":""} ${view==="presenter"?"lc-presenter-mode":""}`}>
    <header className="teacher-topbar"><button type="button" className="teacher-quiet-button" disabled={recordingBusy||importing} onClick={() => { stop(""); onBack(); }}>← Teacher dashboard</button><span className="lc-private">PRIVATE TEACHER VIEW</span><button type="button" className="teacher-quiet-button" onClick={download} disabled={!entries.length&&!turns.length}>Export notes</button></header>
    <main>
      <section className="lc-heading"><div><p className="teacher-eyebrow">LIVE TEACHING</p><h1>A little space to think.<br/><span>More room to teach.</span></h1><p>Your lesson, both voices, and a useful next question.</p></div><div className={`lc-connection lc-${phase}`} role="status"><span aria-hidden>●</span> {phase === "listening" ? "Listening" : phase === "paused" ? "Microphone paused" : phase === "connecting" ? "Connecting…" : checking ? "Checking AI connection…" : available ? "AI connection ready" : "Rehearsal available"}{live && <small>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")} / {COACH_MINUTES}:00</small>}</div></section>
      {error && <p className="lc-error" role="alert">{error}</p>}
      <details className="lc-panel lc-session-start" aria-label="Choose student and lesson" open={!live}><summary>{selected?`${selected.name} · ${materialName||reference?.title||(lessonChosen?"Conversation practice":"Choose a lesson")}`:"1. Choose student and lesson"}</summary>
          <label>1. Student<select value={learner} onChange={e => changeLearner(e.target.value)} disabled={live || working || importing || libraryBusy || asking || recordingBusy}><option value="">Choose a student…</option>{learners.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}</select></label>
          {selected&&<><h2>2. Choose {selected.name}’s lesson</h2>
          <CoachLessonPicker key={`picker-${learner}`} code={learner} name={selected.name} library={selected.library} blocked={live||working||importing||libraryBusy||asking} selectedId={selectedLessonId} onSelect={chooseSavedLesson} onOpenPdf={openSavedPdf}/>
          <details><summary>More prepared lessons from this device</summary><CoachFolderLibrary selectedId={selectedLessonId} code={learner} name={selected.name} studentId={selected.library?.studentId} blocked={live||working||importing||libraryBusy||asking||recordingBusy} onOpen={(file,meta)=>importMaterial(file,meta)}/></details>
          <label className="lc-upload">{importing ? "Reading lesson material…" : "Or open a document from this device"}<input type="file" accept=".pptx,.pdf,.txt" disabled={live || working || importing || libraryBusy || asking} onChange={e => { void importMaterial(e.target.files?.[0]); e.target.value = ""; }}/></label>
          <details><summary>All prepared lessons from your online library</summary><CoachLibraryConnection key={`cloud-${learner}`} code={learner} name={selected.name} studentId={selected.library?.studentId} autoOpenPowerPoint selectedId={selectedLessonId} blocked={live||working||importing||asking||recordingBusy} onSelect={chooseCloudLesson} onOpenPdf={(file,meta)=>importMaterial(file,meta)} onOpenPowerPoint={(file,meta)=>importMaterial(file,meta)} onBusyChange={setLibraryBusy}/></details>
          <button type="button" className="teacher-quiet-button" disabled={live||recordingBusy||importing||libraryBusy} onClick={()=>{clearMaterial();setReference(null);setSelectedLessonId("");setLessonChosen(true);setReferenceReady(true);setTask("Original conversation practice");setStatus("Conversation practice selected. No lesson document is in use.");}}>Conversation practice without a document</button>
          <p className="lc-hint" role="status">{referenceLoading?"Reading all PDF pages before coaching starts…":lessonChosen?`Ready reference: ${materialName||reference?.title||"Conversation practice"}`:"Choose a prepared lesson, app lesson or document before starting."}</p></>}
      </details>
      <nav className="lc-view-tabs" aria-label="Teaching workspace view"><button type="button" aria-pressed={view==="presenter"} onClick={()=>setView("presenter")}>Slides + guidance</button><button type="button" aria-pressed={view==="powerpoint"} onClick={()=>setView("powerpoint")}>PowerPoint + coach</button><button type="button" aria-pressed={view==="setup"} onClick={()=>setView("setup")}>Choose lesson</button><button type="button" onClick={openAudience} disabled={!pdfFile}>Open student window ↗</button></nav>
      <section className="lc-panel lc-companion-panel" aria-label="Private teaching companion">
        {view==="powerpoint"&&<><h2>Your PowerPoint, with a little guidance.</h2><p className="lc-hint">Use the original PowerPoint for answer reveals, audio and video. Keep the app beside it, or open a compact private coach. Match the slide number in the app as you teach; PowerPoint changes do not sync automatically.</p></>}
        <CoachCompanion companion={companion} learner={selected?.name||"Learner"} slide={context.slide} status={status} phase={phase} seconds={seconds} feedback={latest?.feedback} rehearsal={latest?.rehearsal} onPauseResume={togglePause} onEnd={()=>stop("Listening ended. Your lesson notes remain in the app.")} previousSlide={slideIndex>0?()=>selectSlide(slideIndex-1):undefined} nextSlide={slideIndex<slides.length-1?()=>selectSlide(slideIndex+1):undefined}/>
      </section>
      <details className="lc-panel lc-audio-source" aria-label="Lesson audio source"><summary>Audio · {audioMode === "online" ? "online call" : "in person"} · change if needed</summary>
        <label>Where is this lesson?<select value={audioMode} disabled={live || recordingBusy || choosingAudio} onChange={event=>{audioInput.current.close();setCallConnected(false);setAudioMode(event.target.value as LessonAudioMode);setSpeaker("unknown");setError("");}}><option value="room">In person · this microphone</option><option value="online">Online · microphone and call tab</option></select></label>
        {audioMode === "online" ? <><p className="lc-hint">Open your call in a browser tab. Connect that tab and tick Share tab audio so the learner is heard even when you use headphones. Only audio is used; no call video is sent or saved.</p><div className="lc-actions"><button type="button" className="teacher-quiet-button" disabled={live || recordingBusy || choosingAudio} onClick={()=>{if(callConnected){audioInput.current.disconnectCall();setCallConnected(false);}else void connectCallAudio();}}>{choosingAudio?"Choosing call tab…":callConnected?"Disconnect call audio":"Connect call audio"}</button><span role="status">{callConnected?"Call audio connected":"Choose a browser call tab with audio sharing"}</span></div><div className="lc-audio-signals" aria-label="Online audio signals"><label>My microphone<meter min={0} max={1} value={audioLevels.microphone} aria-label="My microphone signal"/><span>{live || recordingBusy ? "Speak to check the signal" : "Checked when listening or recording"}</span></label><label>Student’s call audio<meter min={0} max={1} value={audioLevels.call} aria-label="Student call audio signal"/><span>{callConnected ? "The meter moves when the call is heard" : "Connect the call tab first"}</span></label></div></> : <p className="lc-hint">The microphone captures people in the same room. For a remote learner, select Online and connect the call tab audio.</p>}
      </details>
      <div className={view==="presenter"?"lc-grid lc-presenter-grid":"lc-grid"}>
        <div className="lc-stage">
          {pdfFile&&<div hidden={view==="powerpoint"}><CoachSlidePresenter file={pdfFile} page={slideIndex+1} onLoaded={pdfLoaded} onIndex={pdfIndexed} onIndexError={pdfIndexError} onContext={pdfContext} onPage={page=>selectSlide(page-1)}/></div>}
          {view==="powerpoint"&&<section className="lc-panel lc-powerpoint-reference" aria-label="Current PowerPoint reference"><p className="teacher-eyebrow">MATCH YOUR POWERPOINT SLIDE</p><h2>{materialName||reference?.title||"Choose a saved lesson below"}</h2>{!!slides.length&&<div className="lc-actions"><button type="button" className="teacher-quiet-button" disabled={slideIndex<=0} onClick={()=>selectSlide(slideIndex-1)}>← Previous</button><strong>Slide {slideIndex+1} / {slides.length}</strong><button type="button" className="teacher-quiet-button" disabled={slideIndex>=slides.length-1} onClick={()=>selectSlide(slideIndex+1)}>Next →</button></div>}<p className="lc-hint">Text reference for the AI. Graphics, animations and media play in your original PowerPoint.</p>{source&&<pre>{source}</pre>}{!source&&<p className="lc-hint">Choose “Use current PowerPoint text” from the saved library or open your deck below.</p>}</section>}
          {view==="presenter"&&!pdfFile&&<div className="lc-panel lc-no-slide"><p className="teacher-eyebrow">PRESENTER VIEW</p><h2>Bring your slides into the lesson.</h2><p>Open a PDF exported from PowerPoint to keep the original layout. Slide images and text become context for your AI commentary and questions.</p><button type="button" className="teacher-primary" onClick={()=>setView("setup")}>Open lesson material</button>{source&&<pre>{source}</pre>}</div>}
        <details className={`lc-context lc-panel lc-context-settings ${view==="presenter"?"lc-context-collapsed":""}`} >
          <summary>Optional teaching adjustments</summary>

          <p className="lc-unit">{reference?.title || selected?.unit || "Original speaking practice"}</p>
          {selected?.focusNote && <p className="lc-hint">Saved teacher focus: {selected.focusNote}</p>}
          <label>Current activity<input value={task} maxLength={500} onChange={e => setTask(e.target.value)} placeholder="For example: tell me about yesterday"/></label>
          <label>What to listen for<textarea rows={3} value={objective} maxLength={700} onChange={e => setObjective(e.target.value)}/></label>

          <p className="lc-hint">A PDF shows as slides, with its current text and picture as AI context. PowerPoint supplies text only, read on this device. Neither file is published to students. PDF limit 25 MB; PowerPoint limit 64 MB.</p>
          {!!slides.length && <label>Current reference slide<select value={slideIndex} onChange={e => selectSlide(Number(e.target.value))}>{slides.map((s, i) => <option key={s.number} value={i}>Slide {s.number} · {s.text.slice(0, 55) || "No readable text"}</option>)}</select></label>}
          {reference&&<div className="lc-selected-lesson"><strong>AI reference: {reference.title}</strong><p className="lc-hint">{reference.overview}</p>{reference.guide&&<details><summary>Current delivery guide</summary><pre>{reference.guide}</pre></details>}{coachSlideNotes(reference.teacherNotes||"",slideIndex+1)&&<details><summary>Teacher notes for slide {slideIndex+1}{reference.notesHistorical?" · supporting original notes":""}</summary><pre>{coachSlideNotes(reference.teacherNotes||"",slideIndex+1)}</pre></details>}</div>}
          <label>Current slide / source text<textarea rows={7} value={source} maxLength={12000} onChange={e => setSource(e.target.value)} placeholder="Paste the current exercise, vocabulary or source passage. This text and the selected PDF slide image provide lesson context."/></label>
          {currentNotes&&<details className="lc-selected-lesson"><summary>Private notes embedded in this PowerPoint · slide {slideIndex+1}</summary><pre>{currentNotes}</pre></details>}
          {pdfUrl && <a className="lc-link" href={pdfUrl} target="_blank" rel="noreferrer">Open original PDF reference ↗</a>}
        </details></div>
        <section className="lc-main">
          <div className="lc-panel lc-controls"><div className="lc-section-title"><h2>Listen, then guide</h2><span className="lc-badge">{responseSpeed === "fast" ? "FAST" : "BALANCED"} · {speaker === "unknown" ? "HANDS-FREE" : "MANUAL SPEAKER"}</span></div>
            <label className="lc-consent"><input type="checkbox" checked={agreed} onChange={e => { setAgreed(e.target.checked); if (!e.target.checked && live) stop("Listening stopped."); }}/>The learner and parent understand and have agreed to AI processing for this lesson.</label>
            <details className="lc-listening-settings"><summary>AI settings · optional</summary>
            <p>Automatic mode follows both voices and suggests who is speaking, with no turn-by-turn clicks. Labels marked “AI estimate” can be wrong, especially during overlap or textbook role-play. For a clearer start, each person can briefly introduce themselves aloud.</p>
            <label>Response speed<select value={responseSpeed} onChange={e=>setResponseSpeed(e.target.value as typeof responseSpeed)}><option value="fast">Fast · concise live guidance</option><option value="balanced">Balanced · longer pause and fuller guidance</option></select></label>
            <label>Speaker mode<select value={speaker} onChange={e=>setSpeaker(e.target.value as typeof speaker)}><option value="unknown">Automatic · follow both speakers</option><option value="learner">Only {selected?.name||"Learner"} is speaking</option><option value="teacher">Only Rory is speaking</option></select></label>
            </details>
            <div className="lc-actions">{!live ? <button type="button" className="teacher-primary" disabled={!available || !agreed || working || importing || libraryBusy || !learner || !lessonChosen || referenceLoading || !referenceReady || choosingAudio || (audioMode === "online" && !callConnected)} onClick={() => void start()}>Start listening</button> : <><button type="button" className="teacher-primary" disabled={phase === "connecting"} onClick={togglePause}>{phase === "paused" ? "Resume microphone" : "Pause microphone"}</button><button type="button" className="teacher-quiet-button" onClick={() => stop("Listening ended. You can export the notes or start another session.")}>End listening</button></>}<button type="button" className="teacher-quiet-button" disabled={live || working} onClick={() => tryRehearsal(rehearsalIndex)}>Try prepared rehearsal</button></div>
            <p className="lc-hint" role="status">{status}</p>
            {!available && !checking && <p className="lc-hint">Live AI is not enabled. Rehearsal shows prepared examples without sending audio or using API credit.</p>}
            <p className="lc-hint">Text feedback only. Audio goes to OpenAI while connected. Each AI session ends after 15 minutes. Listening can continue beside PowerPoint while the private coach is visible; hiding both windows stops it. The lesson recorder below is separate.</p>
          </div>
          {!!slides.length&&<section className="lc-panel lc-position" aria-label="AI lesson position"><h2>AI lesson reference · page {referenceIndex+1} of {slides.length}</h2><details><summary>Tracking options · automatic by default</summary><label>Lesson tracking<select value={tracking} onChange={event=>{setReferenceRevision(value=>value+1);setTracking(event.target.value as typeof tracking);setAiPage(null);setPositionNote("");}}><option value="auto">Automatic · follow the conversation</option><option value="manual">Use the displayed page</option></select></label></details><p className="lc-hint">{positionNote||`Using displayed page ${slideIndex+1} as the starting reference. The whole readable lesson is available for context.`}</p>{aiPage!==null&&aiPage!==slideIndex+1&&<button type="button" className="teacher-quiet-button" onClick={()=>selectSlide(aiPage-1)}>Show that page</button>}</section>}
          <div className="lc-panel lc-feedback" aria-live="polite" aria-atomic="true"><div className="lc-section-title"><h2>Your next teaching move</h2>{latest?.rehearsal && <span className="lc-badge">PREPARED EXAMPLE</span>}</div>
            {latest ? <><p className="lc-evidence-label">{latest.context.learner} · {latest.context.slide}</p>{latest.feedback.prompt && <div className="lc-prompt"><h3>Ask the learner</h3><p>{latest.feedback.prompt}</p></div>}<blockquote>“{latest.feedback.heard || "The words were not clear enough to quote."}”</blockquote><div className={`lc-feedback-pair ${!latest.feedback.strength?"lc-feedback-context":""}`}>{latest.feedback.strength && <div><h3>What worked</h3><p>{latest.feedback.strength}</p></div>}<div><h3>{latest.context.learner === "Lesson conversation" || latest.context.learner.includes("AI estimate") ? "Conversation support" : "Focus now"}</h3><p>{latest.feedback.focus}</p></div></div>{latest.feedback.correction && <div className="lc-correction"><h3>{latest.context.learner.includes("AI estimate") ? "Possible correction · check who spoke" : "Minimal correction"}</h3><p>{latest.feedback.correction}</p></div>}<div className="lc-next"><h3>Teach next</h3><p>{latest.feedback.next}</p></div>{latest.feedback.uncertainty && <p className="lc-hint">{latest.feedback.uncertainty}</p>}</> : <div className="lc-empty"><span aria-hidden>↳</span><h3>Space to think, while they speak.</h3><p>A faithful quote, one useful teaching point and a question you can ask next will appear here.</p><button type="button" className="lc-link" onClick={() => tryRehearsal(0)}>See an example</button></div>}
          </div>
          <section className="lc-panel lc-commentary"><div className="lc-section-title"><h2>Running commentary</h2><span className="lc-badge">PRIVATE</span></div><div className="lc-talk-feed" role="log" aria-label="Rory, learner and AI conversation">{!turns.length&&<p className="lc-hint">{selected?.name||"Learner"}, Rory and AI will appear separately here. Automatic speaker labels appear as estimates; teaching guidance continues even when a voice is uncertain.</p>}{turns.map(turn=><article className={`lc-turn lc-turn-${turn.role}`} key={turn.id}><div className="lc-turn-heading"><strong>{coachSpeakerLabel(turn,selected?.name||"Learner")}{turn.rehearsal?" · rehearsal":""}</strong><small>{new Date(turn.at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</small></div><p>{turn.text}</p>{turn.role!=="ai"&&<details className="lc-speaker-correction"><summary>Correct speaker · optional</summary><label className="lc-speaker-edit">Confirmed speaker<select value={turn.role} onChange={e=>correctSpeaker(turn.id,e.target.value as "learner"|"teacher"|"unknown")}><option value="unknown">Unconfirmed conversation</option><option value="learner">{selected?.name||"Learner"}</option><option value="teacher">Rory</option></select></label></details>}</article>)}</div><details><summary>Ask the AI · optional</summary><form onSubmit={e=>{e.preventDefault();void askTeacherAI();}}><label>Ask the AI privately<textarea rows={2} value={question} maxLength={4000} onChange={e=>setQuestion(e.target.value)} placeholder="How can I explain this? What question should I ask next?"/></label><button type="submit" className="teacher-primary" disabled={!available||!agreed||!question.trim()||asking||referenceLoading||!learner||!lessonChosen}>{asking?"Thinking…":"Ask AI"}</button><p className="lc-hint">Uses the selected slide and recent conversation. Your question and answer stay in this teacher view.</p></form></details></section>
          <CoachLessonArchive key={`${learner}:${lessonSession}`} learnerCode={learner} snapshot={{ context, turns, entries }} acquireAudio={acquireAudio} evidenceRevision={evidenceRevision} onBusy={setRecordingBusy} onFocus={note => { setObjective(note); setStatus("Saved teacher review loaded as the lesson focus."); }}/>
          <details className="lc-panel lc-details"><summary>Enter an answer manually</summary><p className="lc-hint">For checking exact wording. Typed answers say nothing about pronunciation.</p><label>Learner’s actual words<textarea value={draft} maxLength={4000} rows={3} onChange={e => setDraft(e.target.value)} placeholder="Keep the learner’s original wording and mistakes."/></label><button className="teacher-primary" type="button" disabled={live || !available || !agreed || !draft.trim() || working || !learner || !lessonChosen || referenceLoading} onClick={() => void analyseTyped()}>{working ? "Preparing feedback…" : "Get teaching feedback"}</button></details>
          {transcript && <details className="lc-panel lc-details"><summary>Latest machine caption · check against what you heard</summary><p>{transcript}</p><p className="lc-hint">Captions can mishear or normalise errors. Use your judgement before correcting the learner.</p></details>}
          {!!entries.length && <details className="lc-panel lc-details"><summary>Session trail · {entries.length} {entries.length === 1 ? "answer" : "answers"}</summary>{entries.map(entry => <article className="lc-trail" key={entry.id}><small>{entry.rehearsal ? "REHEARSAL · " : ""}{new Date(entry.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {entry.context.slide}</small><p>“{entry.feedback.heard}”</p><p>{entry.feedback.focus}</p></article>)}<button type="button" className="teacher-quiet-button" disabled={recordingBusy || working || asking} onClick={() => { stop("Fresh lesson started. Previously saved history is still available."); setEntries([]);setTurns([]); setTranscript(""); setLessonSession(value => value + 1); }}>Start fresh lesson</button><p className="lc-hint">Save or export working notes first. Previously saved lessons are kept.</p></details>}
        </section>
      </div>
    </main>
  </div>;
}
