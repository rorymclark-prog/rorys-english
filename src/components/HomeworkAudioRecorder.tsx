"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {documentRequest,fileBase64,MAX_DOCUMENT_BYTES} from "@/lib/documents";
import {isStudentPreview} from "@/lib/student-preview";
import ReviewTiming from "@/components/ReviewTiming";
import {markEffort} from "@/lib/momentum";

export default function HomeworkAudioRecorder({code,studentId,unitId,week,title,prompt}:{code:string;studentId:string;unitId:string;week:number;title:string;prompt:string}){
  const preview=isStudentPreview(code);
  const [recording,setRecording]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[sent,setSent]=useState(false),[file,setFile]=useState<File|null>(null),[url,setUrl]=useState("");
  const stream=useRef<MediaStream|null>(null),recorder=useRef<MediaRecorder|null>(null),parts=useRef<BlobPart[]>([]),take=useRef(crypto.randomUUID()),urlRef=useRef("");
  const marker=`Homework recording · ${unitId} · week ${week}`;
  useEffect(()=>{
    let live=true;
    void documentRequest(code,false,{action:"documents"}).then(r=>{if(live&&r.ok)setSent(!!r.documents?.some(d=>d.context.startsWith(marker)));}).catch(()=>{});
    return()=>{live=false;recorder.current?.state==="recording"&&recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop());if(urlRef.current)URL.revokeObjectURL(urlRef.current);};
  },[code,marker]);
  async function start(){
    if(preview||busy)return;
    setError("");
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){setError("Recording is not supported here. Try Safari on your iPhone or iPad.");return;}
    try{
      const media=await navigator.mediaDevices.getUserMedia({audio:true});stream.current=media;
      const type=["audio/mp4","audio/webm;codecs=opus","audio/webm","audio/ogg"].find(t=>MediaRecorder.isTypeSupported(t));
      const rec=new MediaRecorder(media,{...(type?{mimeType:type}:{}),audioBitsPerSecond:32000});recorder.current=rec;parts.current=[];
      rec.ondataavailable=e=>{if(e.data.size)parts.current.push(e.data);};
      rec.onstop=()=>{media.getTracks().forEach(t=>t.stop());stream.current=null;setRecording(false);const mime=rec.mimeType.split(";")[0]||"audio/mp4",ext=mime==="audio/mp4"?"m4a":mime==="audio/ogg"?"ogg":"webm";const next=new File(parts.current,`homework-talk-week-${week}.${ext}`,{type:mime});if(!next.size){setError("No sound was captured. Please record again.");return;}if(next.size>MAX_DOCUMENT_BYTES){setError("This take is too large. Record a shorter talk and try again.");return;}if(urlRef.current)URL.revokeObjectURL(urlRef.current);urlRef.current=URL.createObjectURL(next);setUrl(urlRef.current);setFile(next);take.current=crypto.randomUUID();};
      rec.onerror=()=>{media.getTracks().forEach(t=>t.stop());setRecording(false);setError("The recording stopped unexpectedly. Please try again.");};
      rec.start();setRecording(true);
    }catch(e){setError((e as Error).name==="NotAllowedError"?"Allow microphone access in your device settings, then try again.":"Could not open the microphone. Please try again.");}
  }
  async function submit(){
    if(!file||preview||busy)return;
    setBusy(true);setError("");
    try{
      const result=await documentRequest(code,false,{action:"documentUpload",id:take.current,title:`${title} · individual talk`.slice(0,150),context:`${marker}\n${prompt}`.slice(0,2000),files:[{name:file.name,type:file.type,data:await fileBase64(file)}]});
      if(!result.ok||!result.received)throw new Error(result.error||"The upload was not confirmed. Keep this page open and try Send again.");
      setSent(true);markEffort(studentId,code);setFile(null);setUrl("");if(urlRef.current){URL.revokeObjectURL(urlRef.current);urlRef.current="";}
    }catch(e){setError((e as Error).message||"The upload could not be confirmed. Try again.");}
    finally{setBusy(false);}
  }
  return <section className="re-card" aria-label="Record and send your individual talk"><p className="re-eyebrow">INDIVIDUAL TALK · IN THE APP</p><h2 className="mt-2 text-xl font-bold">Record and send your improved talk</h2><p className="re-small-copy mt-2">Record a take, listen to it, then record again if you want. Only the take you choose to send is saved privately for Rory and your parents.</p>
    <div className="mt-4 flex flex-wrap gap-3"><button type="button" className="re-button" disabled={preview||busy} onClick={()=>recording?recorder.current?.stop():void start()}>{recording?"Stop recording":file?"Record a better take":"Start recording"}</button>{file&&!recording&&<button type="button" className="re-button re-secondary" disabled={busy} onClick={()=>void submit()}>{busy?"Sending…":"Send this recording to Rory"}</button>}</div>
    {recording&&<p role="status" className="re-small-copy mt-3">Recording now. Stop when your talk is finished.</p>}
    {url&&!recording&&<audio controls src={url} className="re-live-audio mt-3" aria-label="Listen to your individual talk"/>}
    {sent&&<p role="status" className="re-small-copy mt-3">Recording received. <Link className="underline" href={`/s/${code}/documents/`}>Open My documents</Link> to listen to the saved file.</p>}
    <ReviewTiming/>
    {error&&<p role="alert" className="doc-error mt-3">{error}</p>}
  </section>;
}
