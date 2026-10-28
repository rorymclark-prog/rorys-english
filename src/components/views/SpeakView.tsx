"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useStudent } from "@/components/StudentContext";
import {practiceCatalog} from '@/lib/practice-catalog';
import { markEffort } from "@/lib/momentum";
import { WEEKLY_MINUTES, CALL_MINUTES, CALL_SECONDS, MIN_CALL_SECONDS, secondsLeft, recordSeconds } from "@/lib/speaking-budget";
import { isStudentPreview } from "@/lib/student-preview";
import { savedSession } from "@/lib/api";
import { currentAccount } from "@/lib/account-auth";
import { MicrophoneIcon,TopicArt } from "@/components/LearningVisuals";
import MicrophoneHelp from "@/components/MicrophoneHelp";
import { ScreenAwake, type AwakeState } from "@/lib/screen-awake";
import {guidedSpeaking,type GuidedSpeaking} from "@/lib/guided-speaking";
import LearningMemoryPanel from '@/components/LearningMemoryPanel';
import ConversationTranscript from '@/components/ConversationTranscript';
import {formatConversationTranscript} from '@/lib/conversation-transcript';
import {readableDate} from "@/lib/clarity";
import {lessonPracticeRecord,type LessonPractice} from "@/lib/lesson-practice";
import {getLearning,saveSpeaking,analyseSpeaking,attachSpeakingAudio} from "@/lib/learning";
import {documentRequest,fileBase64,MAX_DOCUMENT_BYTES} from "@/lib/documents";
import {useDurableDraft} from '@/lib/use-durable-draft';
import {readSpeakingRecovery,recoverableSpeech,freezeSpeakingPayload,persistSpeakingRecovery,type SpeakingRecovery} from '@/lib/speaking-recovery';
import {keepSpeakingChunk,readSpeakingAudio,discardSpeakingAudio,speakingChunkWriter} from '@/lib/speaking-recovery-audio';
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
  {id:"lesson",title:"My last lesson",target:"Work on your lesson targets, then try a fresh example.",prompt:"Use your latest lesson practice plan."},
  { id: "grammar", title: "Build sentences", target: "Practise one grammar pattern in your own sentences.", prompt: "Say a short sentence about something that happened yesterday. Now add one useful detail." },
];
const grammarTargets = [
  { id: "past-simple", title: "Finished events (past simple)" },
  { id: "past-perfect", title: "What happened earlier (past perfect)" },
  { id: "present-perfect", title: "Experience or a finished time (present perfect / past simple)" },
  { id: "future", title: "Talking about the future (future forms)" },
  { id: "conditionals", title: "If something happens (conditionals)" },
  { id: "sentence-building", title: "Build longer sentences" },
];
const OUT_OF_MINUTES = `That is this week's speaking time used up. You get ${WEEKLY_MINUTES} minutes a week — ask Rory for more, he can add them, and asking is a good sign. Your allowance starts again on Monday.`;
const spokenLeft = (seconds: number) => seconds >= 120 ? `${Math.floor(seconds / 60)} minutes` : seconds >= 60 ? "1 minute" : `${seconds} seconds`;
type State = "idle" | "connecting" | "live" | "closing" | "ended";
type Fragment = { speaker: "You" | "AI partner"; delta: string; start_ms: number; end_ms: number };
export default function SpeakView({ lines, unitTitle }: { lines: string[]; unitTitle?: string }) {
  const { code, studentId } = useStudent();
  return <VoiceStudio code={code} studentId={studentId} lines={lines} unitTitle={unitTitle} />;
}
export function VoiceStudio({ code, studentId, lines, teacherTest = false, unitTitle, practiceOptions = [] }: { code: string; studentId?: string; lines: string[]; teacherTest?: boolean; unitTitle?: string; practiceOptions?: { code: string; name: string; unit?: string }[] }) {
  const preview = isStudentPreview();
  const voiceDraft=useDurableDraft<SpeakingRecovery|null>({code,role:'student',source:'speaking-session',version:'1',enabled:!teacherTest&&!preview},null);
  const recoveryRef=useRef<SpeakingRecovery|null>(null),recoveryScope=useRef(''),savingRef=useRef(false),recoveryAction=useRef(false),startingRef=useRef(false),recoveryGeneration=useRef(0),recoveredRef=useRef(false);
  const latestIdentity=useRef({code,scope:voiceDraft.scopeKey});latestIdentity.current={code,scope:voiceDraft.scopeKey};
  const sampleWriter=useRef<ReturnType<typeof speakingChunkWriter>|null>(null);
  const [recoveryNotice,setRecoveryNotice]=useState(''),[recoveryLoading,setRecoveryLoading]=useState(false);
  const [topic, setTopic] = useState(!teacherTest&&unitTitle?4:0); const [sessionTopic, setSessionTopic] = useState(0); const [available, setAvailable] = useState<boolean | null>(null);
  const [grammar, setGrammar] = useState("past-simple"); const [practiceStudent, setPracticeStudent] = useState(practiceOptions[0]?.code || "");
  const [voice,setVoice]=useState("vesper");
  const [state, setState] = useState<State>("idle"); const [status, setStatus] = useState("");
  const [muted, setMuted] = useState(false); const [elapsed, setElapsed] = useState(0);
  // Read on the client only: localStorage does not exist while rendering on the
  // server, so reading it during render would hydrate to the wrong allowance.
  const [leftSecs, setLeftSecs] = useState<number | null>(null);
  const capSeconds = useRef(900); const usedSeconds = useRef(0);
  const [fragments, setFragments] = useState<Fragment[]>([]); const [reflection, setReflection] = useState("");
  const [lessonEntry,setLessonEntry]=useState<{id:string;practice:LessonPractice}|null>(null),[lessonLoading,setLessonLoading]=useState(true),[lessonError,setLessonError]=useState("");
  const practiceRef=useRef<{id:string;practice:LessonPractice}|null>(null);
  const sessionPractice=useRef<{id:string;practice:LessonPractice}|null>(null);
  const [ringUnitId,setRingUnitId]=useState('');
  const ringUnit=practiceCatalog(code).find(u=>u.id===ringUnitId&&u.available);
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
  function sameRecovery(id:string,scope:string,ownerCode=code){return mounted.current&&latestIdentity.current.code===ownerCode&&latestIdentity.current.scope===scope&&recoveryScope.current===scope&&recoveryRef.current?.id===id;}
  function checkpointRecovery(patch:Partial<SpeakingRecovery>){
    const value=recoveryRef.current;
    if(teacherTest||preview||!value||!sameRecovery(value.id,recoveryScope.current))return false;
    const next={...value,...patch};recoveryRef.current=next;return voiceDraft.checkpoint(next);
  }
  const checkpointRef=useRef(checkpointRecovery);checkpointRef.current=checkpointRecovery;
  function conversationTitle(){return sessionPractice.current?`Lesson practice · ${sessionPractice.current.practice.lessonDate} · ${sessionPractice.current.practice.title}`:guidedRef.current?.savedTitle||(ringUnit&&topics[topicRef.current].id==='unit'?`Unit practice · ${ringUnit.year} · ${ringUnit.title}`:topics[topicRef.current].title);}
  async function clearRecovery(id:string,scope:string,confirmedSave=false){
    if(!sameRecovery(id,scope))return false;
    const value=recoveryRef.current;let audioLeft=false;
    if(value?.audioExpected){try{await discardSpeakingAudio(scope,id);}catch{if(!confirmedSave)throw Error('The device audio copy could not be removed.');audioLeft=true;}}
    if(!sameRecovery(id,scope))return false;
    if(!voiceDraft.confirmSaved(null))return false;
    recoveryRef.current=null;recoveryScope.current='';
    setRecoveryNotice(audioLeft?'Your conversation and audio were received. An old audio copy could not be removed from this device.':'');
    return true;
  }
  async function openRecovery(){
    if(busy||savingRef.current||recoveryAction.current||startingRef.current||preview||teacherTest)return;
    const value=readSpeakingRecovery(voiceDraft.value);if(!value||!voiceDraft.ready)return;
    recoveryAction.current=true;setRecoveryLoading(true);const operation=++recoveryGeneration.current,scope=voiceDraft.scopeKey,owner=code,token=savedSession(code)?.token;
    const current=()=>operation===recoveryGeneration.current&&sameRecovery(value.id,scope,owner)&&savedSession(owner)?.token===token;
    try{
      recoveryRef.current=value;recoveryScope.current=scope;recoveredRef.current=true;sessionId.current=value.id;savedId.current='';topicRef.current=value.topic;
      fragmentsRef.current=value.fragments;reflectionRef.current=value.savePayload?.reflection??value.reflection;sessionPractice.current=null;guidedRef.current=null;
      setFragments(value.fragments);setReflection(reflectionRef.current);setSessionTopic(value.topic);setTopic(value.topic);setGuided(null);setElapsed(value.elapsed);setState('ended');
      setStatus('Interrupted conversation opened. It has not restarted the microphone.');setSaveState(value.audioSaved?'Your conversation and sound were received. Finish clearing the device copy below.':value.conversationSaved?'Your conversation was received. Confirm any remaining audio below.':'Recovered on this device. Save the conversation when you are ready.');
      const pending=readSpeakingAudio(scope,value.id).catch(()=>null);sampleReady.current=pending;
      const sample=await pending;if(!current())return;
      if(sample){checkpointRecovery({audioExpected:true});if(sampleUrl.current)URL.revokeObjectURL(sampleUrl.current);sampleUrl.current=URL.createObjectURL(sample);setSampleDownload(sampleUrl.current);}
    }finally{if(operation===recoveryGeneration.current){recoveryAction.current=false;if(mounted.current)setRecoveryLoading(false);}}
  }
  async function discardRecovery(){
    if(busy||savingRef.current||recoveryAction.current||startingRef.current||!voiceDraft.ready)return;
    const value=recoveryRef.current||readSpeakingRecovery(voiceDraft.value),scope=voiceDraft.scopeKey;
    recoveryAction.current=true;setRecoveryLoading(true);const operation=++recoveryGeneration.current;
    try{
      if(value){recoveryRef.current=value;recoveryScope.current=scope;if(!await clearRecovery(value.id,scope))throw Error('The device copy could not be removed.');}
      else if(!voiceDraft.confirmSaved(null))throw Error('The unreadable device copy could not be removed.');
      if(operation!==recoveryGeneration.current||!mounted.current||latestIdentity.current.code!==code)return;
      fragmentsRef.current=[];sessionId.current='';savedId.current='';sampleReady.current=null;recoveredRef.current=false;setFragments([]);setSaveState('');setState('idle');setStatus('');
      if(sampleUrl.current)URL.revokeObjectURL(sampleUrl.current);sampleUrl.current='';setSampleDownload('');
    }catch{if(operation===recoveryGeneration.current&&mounted.current)setRecoveryNotice('Could not remove the device copy. It is kept; try again before starting another conversation.');}
    finally{if(operation===recoveryGeneration.current){recoveryAction.current=false;if(mounted.current)setRecoveryLoading(false);}}
  }
  function dispose() {
    generation.current++; controller.current?.abort();
    if (timer.current) clearInterval(timer.current); if (timeout.current) clearTimeout(timeout.current); if (closeTimer.current) clearTimeout(closeTimer.current);
    const channel = events.current; events.current = null; channel?.close();
    peer.current?.close(); peer.current = null; mic.current?.getTracks().forEach(t => t.stop()); mic.current = null;
    if (audio.current) audio.current.srcObject = null;
    wakeLock.current?.stop();
  }
  function finish(message: string) { startingRef.current=false;if(liveRecorder.current?.state==='recording')liveRecorder.current.stop();if(sampleStop.current)clearTimeout(sampleStop.current);dispose();
    // Bank the minutes whether or not the student spoke: a connected session
    // costs the same either way, so the allowance has to reflect it.
    if(!teacherTest&&studentId&&usedSeconds.current>0){recordSeconds(studentId,usedSeconds.current);usedSeconds.current=0;}
    if (mounted.current) { setState("ended"); setStatus(message); setMuted(false); if(!teacherTest&&fragmentsRef.current.some(f=>f.speaker==='You')){if(studentId)markEffort(studentId,code);void persistConversation();}else if(!teacherTest&&!recoveryRef.current?.audioExpected&&!fragmentsRef.current.length){const value=recoveryRef.current;if(value)void clearRecovery(value.id,recoveryScope.current).catch(()=>{});} } }
  async function persistConversation(){
    const id=sessionId.current,scope=recoveryScope.current;
    if(!id||savingRef.current||recoveryAction.current||savedId.current===id||preview||teacherTest||!recoverableSpeech(recoveryRef.current)||!sameRecovery(id,scope))return;
    savingRef.current=true;setSaving(true);const operation=++recoveryGeneration.current,owner=code,token=savedSession(code)?.token;
    const current=()=>operation===recoveryGeneration.current&&sameRecovery(id,scope,owner)&&savedSession(owner)?.token===token;
    const frozen=freezeSpeakingPayload(recoveryRef.current,formatConversationTranscript(fragmentsRef.current),reflectionRef.current,()=>crypto.randomUUID()),sample=sampleReady.current;
    recoveryRef.current=frozen;
    try {
      const outcome=await persistSpeakingRecovery({value:frozen,recovered:recoveredRef.current,sample,maxAudioBytes:MAX_DOCUMENT_BYTES,current,
        checkpoint:value=>{if(!current())return false;recoveryRef.current=value;return voiceDraft.checkpoint(value);},
        onStatus:message=>{if(current())setSaveState(message);},
        save:value=>saveSpeaking(owner,value.id,value.savePayload!.title,value.savePayload!.transcript,value.savePayload!.reflection),
        analyse:value=>analyseSpeaking(owner,value),
        upload:async(value,blob)=>{const type=blob.type.split(';')[0],ext=type==='audio/mp4'?'m4a':type==='audio/ogg'?'ogg':'webm',data=await fileBase64(blob);if(!current())return {ok:false};return documentRequest(owner,false,{action:'documentUpload',id:value.audioDocumentId,title:`AI conversation audio · ${value.title}`.slice(0,150),context:`Student voice sample for speaking record ${value.id}. Up to three minutes; AI feedback uses captions, while Rory can listen to this recording.`,files:[{name:`speaking-${value.id}.${ext}`,type,data}]});},
        attach:(record,documentId)=>attachSpeakingAudio(owner,record,documentId),
      });
      if(!current()||outcome.kind==='stale')return;
      setSaveState(outcome.message);
      if(outcome.kind==='saved'){
        const cleared=await clearRecovery(id,scope,true);if(operation!==recoveryGeneration.current||!mounted.current)return;
        savedId.current=id;
        if(!cleared)setSaveState(`${outcome.message} The device recovery copy could not be cleared; discard it before starting again.`);
      }
    } catch {if(current())setSaveState('Could not confirm the full save. Your exact device copy is kept; choose Retry save.');}
    finally {if(operation===recoveryGeneration.current){savingRef.current=false;if(mounted.current)setSaving(false);}}
  }
  function startSample(stream:MediaStream){
    if(teacherTest||!window.MediaRecorder)return;
    try {const type=['audio/webm;codecs=opus','audio/mp4','audio/ogg'].find(t=>MediaRecorder.isTypeSupported(t));const recorder=new MediaRecorder(stream,{...(type?{mimeType:type}:{}),audioBitsPerSecond:24000});const chunks:BlobPart[]=[];
      const scope=recoveryScope.current,id=sessionId.current,owner=code,writer=speakingChunkWriter((sequence,blob)=>keepSpeakingChunk(scope,id,sequence,blob));sampleWriter.current=writer;checkpointRecovery({audioExpected:true});
      const belongs=()=>mounted.current&&latestIdentity.current.code===owner&&recoveryScope.current===scope&&sessionId.current===id;
      sampleReady.current=new Promise(resolve=>{let resolved=false;const finishSample=()=>{if(resolved)return;resolved=true;const sample=new Blob(chunks,{type:recorder.mimeType.split(';')[0]||'audio/webm'});void writer.flush().catch(()=>{}).then(()=>resolve(sample.size?sample:null));};
        recorder.ondataavailable=event=>{if(event.data.size){chunks.push(event.data);void writer.append(event.data).catch(()=>{if(belongs())setRecoveryNotice('Audio recovery is unavailable. Keep this page open and download the sample after ending.');});}};
        recorder.onstop=finishSample;
        recorder.onerror=()=>{if(belongs())setRecoveryNotice('The audio sample stopped unexpectedly. Keep this page open to retain the available sound.');if(recorder.state==='recording')try{recorder.stop();}catch{finishSample();}setTimeout(finishSample,1000);};
      });liveRecorder.current=recorder;recorder.start(1000);sampleStop.current=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},180000);
    }catch{sampleReady.current=null;checkpointRecovery({audioExpected:false});}
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
    const leave = () => { checkpointRef.current({fragments:fragmentsRef.current,reflection:reflectionRef.current});recoveryGeneration.current++;savingRef.current=false;recoveryAction.current=false;startingRef.current=false;if(liveRecorder.current?.state==='recording')liveRecorder.current.stop();if(sampleStop.current)clearTimeout(sampleStop.current);if(!teacherTest&&studentId&&usedSeconds.current>0){recordSeconds(studentId,usedSeconds.current);usedSeconds.current=0;}if (events.current?.readyState === "open") events.current.send(JSON.stringify({ type: "session.close" })); dispose(); stopRecording();if(mounted.current){setSaving(false);setRecoveryLoading(false);setState('ended');setStatus('The connection stopped. Reopen the device copy before saving or starting again.');} };
    window.addEventListener("pagehide", leave);
    const accountChanged=()=>{leave();recoveryRef.current=null;recoveryScope.current='';fragmentsRef.current=[];sessionId.current='';savedId.current='';sampleReady.current=null;if(sampleUrl.current)URL.revokeObjectURL(sampleUrl.current);sampleUrl.current='';if(mounted.current){setFragments([]);setReflection('');setSampleDownload('');setSaving(false);setRecoveryLoading(false);setState('idle');setStatus('Your sign-in changed. Reopen your own device copy before continuing.');}};
    window.addEventListener('re-auth-change',accountChanged);
    const visible=()=>{
      if(document.visibilityState!=="visible"||!peer.current)return;
      if(mic.current?.getAudioTracks().some(track=>track.readyState==="ended")){finish("Your phone stopped the microphone. Your transcript is still here. Press Start to begin a new conversation.");return;}
      void wakeLock.current?.resume();
      if(audio.current?.srcObject)void audio.current.play().catch(()=>{if(mounted.current)setStatus("Press play below to resume hearing your AI partner.");});
    };
    document.addEventListener("visibilitychange",visible);
    return () => { mounted.current = false; recordGeneration.current++; leave(); window.removeEventListener("pagehide", leave);document.removeEventListener("visibilitychange",visible);window.removeEventListener('re-auth-change',accountChanged); if (recordingUrl.current) URL.revokeObjectURL(recordingUrl.current);if(sampleUrl.current)URL.revokeObjectURL(sampleUrl.current); };
  }, [endpoint,code]);
  useEffect(()=>{
    if(teacherTest)return;
    const params=new URLSearchParams(window.location.search),unitId=params.get("unitPractice");
    if(practiceCatalog(code).some(u=>u.id===unitId&&u.available)){setRingUnitId(unitId!);setTopic(topics.findIndex(t=>t.id==='unit'));}
    const choice=params.get("guided");
    const chat=guidedSpeaking(code,choice);
    setGuided(chat);guidedRef.current=chat;
    if(chat)setTopic(topics.findIndex(topic=>topic.id===chat.topic));
  },[code,teacherTest]);
  useEffect(()=>{
    let live=true;setLessonEntry(null);practiceRef.current=null;setLessonLoading(true);setLessonError("");
    const selected=teacherTest?practiceStudent:code;
    const requested=teacherTest?undefined:new URLSearchParams(window.location.search).get("practice")||undefined;
    if(!teacherTest&&new URLSearchParams(window.location.search).get("mode")==="lesson")setTopic(topics.findIndex(t=>t.id==="lesson"));
    if(!selected){setLessonLoading(false);return;}
    getLearning(selected,teacherTest).then(r=>{
      if(!live)return;
      if(!r.ok)setLessonError(r.error||"Could not open your lesson practice.");
      const entry=r.ok?lessonPracticeRecord(r.records||[],requested):null;
      const value=entry?{id:entry.record.id,practice:entry.practice}:null;
      setLessonEntry(value);practiceRef.current=value;setLessonLoading(false);
    }).catch(()=>{if(live){setLessonError('Could not open your lesson practice. Please try again.');setLessonLoading(false);}});
    return()=>{live=false;};
  },[code,teacherTest,practiceStudent]);
  useEffect(()=>{
    if(teacherTest||!studentId)return;
    const read=()=>setLeftSecs(secondsLeft(studentId));
    read();
    window.addEventListener("re-speaking-budget-change",read);
    return ()=>window.removeEventListener("re-speaking-budget-change",read);
  },[teacherTest,studentId]);
  async function start() {
    if (preview || !available || busy || savingRef.current || recoveryAction.current || startingRef.current || recording || recordBusy || (!teacherTest&&(!voiceDraft.ready||voiceDraft.value!==null)) || (topics[topic].id==="lesson"&&(lessonLoading||!practiceRef.current))) return;
    sessionPractice.current=topics[topic].id==="lesson"?practiceRef.current:null;
    // The allowance is a fair-use guide, not a punishment: running out is the
    // cue to ask Rory for more, and the wording says so.
    const allowance = teacherTest || !studentId ? CALL_SECONDS : secondsLeft(studentId);
    if (allowance < MIN_CALL_SECONDS) { setStatus(OUT_OF_MINUTES); return; }
    capSeconds.current = Math.min(CALL_SECONDS, allowance); usedSeconds.current = 0;
    startingRef.current=true;recoveryGeneration.current++;recoveredRef.current=false;
    dispose(); setMicInterrupted(false); const run = generation.current;sessionId.current=crypto.randomUUID();savedId.current='';topicRef.current=topic;reflectionRef.current='';fragmentsRef.current=[];sampleReady.current=null;liveRecorder.current=null;if(sampleUrl.current)URL.revokeObjectURL(sampleUrl.current);sampleUrl.current='';setSampleDownload('');setSaveState('');setState("connecting"); setStatus("Connecting your microphone…"); setFragments([]); setElapsed(0); setReflection(""); setSessionTopic(topic);
    if(!teacherTest){recoveryScope.current=voiceDraft.scopeKey;recoveryRef.current={schema:1,id:sessionId.current,title:conversationTitle().slice(0,150),topic,fragments:[],reflection:'',elapsed:0,startedAt:new Date().toISOString(),conversationSaved:false,feedbackAttempted:false,feedbackReady:false,audioDocumentId:crypto.randomUUID(),audioExpected:false};if(!voiceDraft.checkpoint(recoveryRef.current)){startingRef.current=false;setState('idle');setStatus('Could not keep a recovery copy on this device. Check device storage before starting.');return;}setRecoveryNotice('');}
    let conversationStarted=false;
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
          if(conversationStarted)return;conversationStarted=true;
          if (timeout.current) clearTimeout(timeout.current);startingRef.current=false; setState("live"); setStatus("Connected. Say hello when you’re ready.");
          if(mic.current)startSample(mic.current);
          const started = Date.now(); timer.current = setInterval(() => { const seconds = Math.floor((Date.now() - started) / 1000); setElapsed(seconds); usedSeconds.current = seconds;checkpointRecovery({elapsed:seconds}); if (seconds >= capSeconds.current) { if (timer.current) clearInterval(timer.current); end(); } }, 1000);
        } else if (event.type === "session.closed") finish("Conversation ended. Keep one useful phrase and one next step.");
        else if (["session.input_transcript.delta", "session.output_transcript.delta"].includes(event.type) && typeof event.delta === "string") {
          const f: Fragment = { speaker: event.type === "session.input_transcript.delta" ? "You" : "AI partner", delta: event.delta, start_ms: Number(event.start_ms) || 0, end_ms: Number(event.end_ms) || 0 };
          fragmentsRef.current=[...fragmentsRef.current,f].slice(-3000);setFragments(fragmentsRef.current);
          checkpointRecovery({fragments:fragmentsRef.current});
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
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.current.signal, body: JSON.stringify({ code, token, teacherTest, preview, topic: topics[topic].id, grammar, voice, homeworkFocus: guidedRef.current?.id, lessonPracticeId: sessionPractice.current?.id, unitPracticeId: topics[topic].id==='unit'?ringUnit?.id:undefined, practiceStudent: teacherTest ? practiceStudent : undefined, sdp: connection.localDescription?.sdp }) });
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
    const text = `Rory's English — speaking practice\n${topics[sessionTopic].title}\nConversation feedback is practice advice; Rory’s review is separate.\n\n` + formatConversationTranscript(fragments) + `\n\nMy reflection\n${reflection}`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "my-speaking-practice.txt"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  // null until the client effect has read the device's counter.
  const budgeted = !teacherTest && !!studentId && leftSecs !== null;
  const outOfMinutes = budgeted && leftSecs! < MIN_CALL_SECONDS;
  const pendingRecovery=readSpeakingRecovery(voiceDraft.value);
  const recoveryBlocksStart=!teacherTest&&(!voiceDraft.ready||voiceDraft.value!==null);
  return <main className={`re-home re-speaking ${guided ? "hw-speaking-studio" : ""}`}><header className="re-page-heading"><p className="re-eyebrow">{teacherTest ? "TEACHER VOICE TEST" : guided ? `${guided.unitLabel} · CHAT ${guided.week}` : "SPEAKING STUDIO"}</p><h1>{teacherTest ? "Try your AI conversation partner." : guided ? guided.title : "Your voice. Your ideas."}</h1><p>{teacherTest ? "Use the same conversation partner your students use. This test uses your API credit and is not saved to a student’s work." : guided ? `Speak for about ${guided.duration}. When you end, the app saves the conversation for Rory. There is nothing to copy or paste.` : "One topic, one useful target, a little more confidence."}</p></header>
    {!teacherTest&&!preview&&voiceDraft.value!==null&&!busy&&<section className="studio-recovery" aria-label="Conversation recovery"><div><p className="re-eyebrow">KEPT ON THIS DEVICE</p><h2>{pendingRecovery?.conversationSaved?'Your conversation is saved. Keep its sound too.':'Pick up an unfinished conversation.'}</h2><p>{pendingRecovery?.title||'This saved device copy could not be read safely.'}</p><p className="re-small-copy">Review the recovered captions and any available audio before saving. A hard close can leave the last moment missing.</p></div><div className="studio-recovery-actions"><button className="re-button" disabled={saving||recoveryLoading||!pendingRecovery} onClick={()=>void openRecovery()}>Open device copy</button><button className="re-button re-secondary" disabled={saving||recoveryLoading} onClick={()=>void discardRecovery()}>Discard device copy</button></div></section>}
    {!teacherTest&&(voiceDraft.error||recoveryNotice)&&<p className="studio-recovery-warning" role="status">{voiceDraft.error||recoveryNotice}</p>}
    {!teacherTest&&!guided&&<section className="studio-conversation-picker" aria-label="Choose a conversation"><div className="studio-section-heading"><div><p className="re-eyebrow">CHOOSE YOUR STARTING POINT</p><h2>What will you talk about?</h2></div><span>One topic. Your ideas.</span></div><div className="studio-topic-grid">{[4,5,3].map(i=><button key={topics[i].id} type="button" className="studio-topic-card" aria-pressed={topic===i} disabled={busy||recording||recordBusy} onClick={()=>setTopic(i)}><span className="studio-topic-picture"><TopicArt kind={i===3?0:i===5?1:2}/></span><span><strong>{topics[i].title}</strong><small>{i===4?(ringUnit?.title||unitTitle||topics[i].target):i===5?'Use a target from your lesson with Rory.':topics[i].target}</small></span></button>)}</div><details className="studio-more-topics" open={[0,1,2,6].includes(topic)||undefined}><summary>More ways to practise</summary><div className="re-topic-chips" role="group" aria-label="More conversation choices">{[0,1,2,6].map(i=><button key={topics[i].id} type="button" disabled={busy||recording||recordBusy} aria-pressed={topic===i} onClick={()=>setTopic(i)}>{topics[i].title}</button>)}</div></details></section>}
    {guided&&<div className="re-card hw-studio-note"><strong>Chat {guided.week} · {guided.cue}</strong><p>{guided.prompt}</p>{guided.purpose&&<p><strong>Why this chat? </strong>{guided.purpose}</p>}<p>If you get stuck, say: “Please ask me a simpler question.”</p><Link className="re-text-link" href={`/s/${code}/lessons/${guided.unitId}/homework/${guided.week}/`}>Back to this practice task →</Link></div>}
    <div className="re-speaking-grid"><section>      <section className="re-card re-live-panel"><div className={`re-voice-orb is-${muted?"muted":state}`} aria-hidden><MicrophoneIcon /></div><p className="re-eyebrow">{guided?"VOICE CHAT":"AI CONVERSATION · SAVED WHEN YOU END"}</p><h2>{state === "live" ? "Make yourself heard." : state === "connecting" ? "Opening your conversation…" : "A conversation, at your pace."}</h2><p>{guided?guided.cue:topics[topic].target}</p>
        <p className="re-voice-status" role="status">{status || (preview ? "Teacher preview is read-only. Voice is disabled here." : available === null ? "Checking live voice…" : available ? (outOfMinutes ? OUT_OF_MINUTES : budgeted ? `Ready when you are. You have ${spokenLeft(leftSecs!)} of speaking left this week, in conversations of up to ${CALL_MINUTES} minutes.` : `Ready for a conversation of up to ${CALL_MINUTES} minutes.`) : guided ? "Live voice is unavailable right now. Continue with the other steps in your task and tell Rory at your next lesson." : "Live AI voice is awaiting connection. Try a rehearsal below in the meantime.")}</p>
        {busy && <p className="re-timer">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} <small>/ {Math.floor(capSeconds.current / 60)}:{String(capSeconds.current % 60).padStart(2, "0")}</small></p>}
        <div className="re-voice-actions">{!busy ? <button className="re-button" disabled={!available || preview || saving || recoveryLoading || recording || recordBusy || outOfMinutes || recoveryBlocksStart || (topics[topic].id==="lesson"&&(lessonLoading||!lessonEntry))} onClick={() => void start()}>{saving?'Saving this conversation…':outOfMinutes?'No minutes left this week':pendingRecovery?'Save or discard your device copy first':'Start conversation'}</button> : <><button className="re-button re-secondary" disabled={state !== "live"} onClick={() => { const next = !muted; mic.current?.getAudioTracks().forEach(t => { t.enabled = !next; }); setMuted(next); }}>{muted ? "Unmute microphone" : "Mute microphone"}</button><button className="re-button" disabled={state === "closing"} onClick={end}>{state === "closing" ? "Finishing…" : state === "connecting" ? "Cancel" : "End conversation"}</button></>}</div>
        <audio ref={audio} autoPlay controls className={busy ? "re-live-audio" : "hidden"} aria-label="AI partner audio" />
        {busy&&<p role="status" className="mt-3 text-sm">{awakeState==="held"?"Screen-awake protection is on while this app is visible.":awakeState==="idle"?"Screen-awake protection starts when the microphone connects.":"Screen-awake protection is unavailable or was released by your phone. Keep this screen open."}</p>}
        {busy&&micInterrupted&&<p role="alert" className="mt-3 text-sm">Your phone has paused the microphone. Return to this screen; if it does not recover, end the conversation and start again.</p>}
        <small>Your voice goes to OpenAI while connected.</small><details className="re-privacy-more"><summary>How your voice is saved</summary><p>The first three minutes are also saved privately for Rory and your parents to review. Caption feedback is separate from audio review. Muting keeps the session running; choose End to finish.</p></details>
        <MicrophoneHelp /></section>
      <div className="re-card studio-speaking-focus">{guided?<><p className="re-eyebrow">YOUR FOCUS</p><p>{guided.focus}</p></>:<><p className="re-eyebrow">{teacherTest?'CONVERSATION':'YOUR PRACTICE FOCUS'}</p>{teacherTest?<div className="re-topic-chips" role="group" aria-label="Choose a conversation">{topics.map((t, i) => <button key={t.id} type="button" disabled={busy || recording || recordBusy} aria-pressed={topic === i} onClick={() => setTopic(i)}>{t.title}</button>)}</div>:<h2>{topics[topic].title}</h2>}<p className="re-small-copy">{topics[topic].target}</p></>}
      {topics[topic].id === "grammar" && <label className="re-voice-choice">Choose a grammar focus<select value={grammar} onChange={e => setGrammar(e.target.value)} disabled={busy || recording || recordBusy}>{grammarTargets.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}</select></label>}
      {teacherTest && ["unit","lesson"].includes(topics[topic].id) && <label className="re-voice-choice">Test this student&apos;s practice<select value={practiceStudent} onChange={e => setPracticeStudent(e.target.value)} disabled={busy || recording || recordBusy}>{practiceOptions.map(p => <option key={p.code} value={p.code}>{p.name}{p.unit ? ` · ${p.unit}` : ""}</option>)}</select></label>}
      {!teacherTest && !guided && topics[topic].id === "unit" && <p className="re-small-copy">{ringUnit ? `Selected unit: ${ringUnit.title}` : unitTitle ? `Current unit: ${unitTitle}` : "Tell the partner your current school topic and a few words you want to practise."}</p>}
      {topics[topic].id==="lesson"&&<div className="mt-4 rounded-xl border border-indigo-200 p-3 text-sm" aria-label="Lesson practice brief">{lessonLoading?<p>Opening your lesson practice…</p>:lessonEntry?<><strong>{lessonEntry.practice.title} · {readableDate(lessonEntry.practice.lessonDate)}</strong><p className="mt-2">{lessonEntry.practice.recap}</p><ul className="mt-2 ml-5 list-disc">{lessonEntry.practice.focus.map(x=><li key={x}>{x}</li>)}</ul><p className="mt-2">{lessonEntry.practice.speakingPrompt}</p><p className="mt-2">About {lessonEntry.practice.speakingMinutes} minutes. Try once, get a little help, then use it in a different example.</p>{!teacherTest&&<Link className="re-text-link" href={`/s/${code}/progress/#review-${lessonEntry.id}`}>Open the short written task →</Link>}</>:<p>{lessonError||"No lesson practice is ready yet. Ask Rory, or choose another conversation mode."}</p>}</div>}
      <details className="re-options"><summary>Voice</summary><label className="re-voice-choice">Conversation voice<select value={voice} onChange={e=>{const next=e.target.value;setVoice(next);try{localStorage.setItem(`re_voice_${code}`,next);}catch{/* storage unavailable */}}} disabled={busy || recording || recordBusy}>{voices.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select></label>
      <p className="re-small-copy">A voice change starts with your next conversation.</p></details>
      </div>
      {!!fragments.length && <section className="re-card"><h2>Conversation captions</h2><p className="re-small-copy">Captions may contain mistakes. Both speakers can speak at once.</p><ConversationTranscript fragments={fragments}/>{!guided&&<><label className="re-reflection">One useful phrase & my next target<textarea rows={3} maxLength={3000} value={reflection} disabled={saving||!!recoveryRef.current?.savePayload||!!savedId.current} onChange={e => {if(savingRef.current||recoveryRef.current?.savePayload||savedId.current)return;setReflection(e.target.value);reflectionRef.current=e.target.value;checkpointRecovery({reflection:e.target.value});}} placeholder="What will you try again?" /></label><button className="re-button re-secondary" onClick={saveTranscript}>Download conversation & reflection</button>{sampleDownload&&<a className="re-button re-secondary" href={sampleDownload} download="my-speaking-sample">Download my audio sample</a>}</>}{!teacherTest&&<p className="re-small-copy" role="status">{saveState||'End the conversation to save it. Then open Feedback to read the feedback.'}</p>}{!teacherTest&&state==='ended'&&recoverableSpeech(recoveryRef.current)&&!savedId.current&&<button className="re-button re-secondary" disabled={saving||recoveryLoading} onClick={()=>void persistConversation()}>{saving?'Saving…':recoveryRef.current?.savePayload?'Retry save':'Save recovered conversation'}</button>}{!teacherTest&&recoveryRef.current?.savePayload&&<p className="re-small-copy">This reflection is kept with the exact conversation sent for saving. A retry uses the same words.</p>}{teacherTest&&<p className="re-small-copy">This test stays in this tab. No student record is created.</p>}{guided&&state==='ended'&&!saving&&!!saveState&&!saveState.startsWith('Could not')&&<Link className="re-text-link" href={`/s/${code}/lessons/${guided.unitId}/homework/${guided.week}/`}>Continue to this practice task →</Link>}{!teacherTest&&!guided&&sessionPractice.current&&state==='ended'&&<Link className="re-text-link" href={`/s/${code}/progress/#write-${sessionPractice.current.id}`}>Next: your short written task →</Link>}{!teacherTest&&!guided&&state==='ended'&&!saving&&savedId.current&&<Link className="re-text-link" href={savedId.current?`/s/${code}/progress/#review-${savedId.current}`:`/s/${code}/progress/`}>Read conversation feedback →</Link>}</section>}
    </section>{!guided&&<aside>
      {(!teacherTest||practiceStudent)&&<LearningMemoryPanel key={`${teacherTest?practiceStudent:code}-${saveState}`} code={teacherTest?practiceStudent:code} teacher={teacherTest}/>}
      <section className="re-card"><p className="re-eyebrow">PRIVATE REHEARSAL · STAYS IN THIS TAB</p><h2>Try it out loud.</h2><p className="re-rehearsal-prompt">{topics[topic].id==="lesson"?lessonEntry?.practice.speakingPrompt||"Choose another mode while Rory prepares lesson practice.":topics[topic].id === "unit" && lines.length ? lines[0] : topics[topic].prompt}</p><p className="re-small-copy">Record up to three minutes, listen back and try again. Your recording stays in this tab and is not sent to anyone.</p><button className="re-button re-secondary" disabled={preview || busy || recordBusy} onClick={() => recording ? stopRecording() : void record()}>{recording ? "Stop recording" : recordBusy ? "Opening microphone…" : "Record a rehearsal"}</button><p role="status">{recording ? "Recording…" : recordError}</p>{recorded && !recording && <audio controls src={recorded} className="re-live-audio" aria-label="Your rehearsal recording" />}</section>
    </aside>}</div>
  </main>;
}
