"use client";
import {useEffect,useRef,useState} from 'react';
import {documentRequest} from '@/lib/documents';
import {reviewSpeakingAudio,type AudioReview,type LearningRecord} from '@/lib/learning';

const areas:Record<string,string>={fluency:'Flow',accuracy:'Grammar and vocabulary',organisation:'Development',interaction:'Interaction',intelligibility:'Intelligibility'};
const field='w-full rounded-xl border border-black/10 bg-white p-3 text-sm text-navy dark:border-white/15 dark:bg-navy dark:text-cream';
const lines=(value:string)=>value.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,3);

export default function SpeakingAudioReview({code,name,mode,record,onSaved}:{code:string;name:string;mode:'student'|'parent'|'teacher';record:LearningRecord;onSaved:()=>Promise<void>}) {
  const review=record.body.audioReview,documentId=record.body.audioDocumentId;
  const [audioUrl,setAudioUrl]=useState(''),[audioError,setAudioError]=useState(''),[loading,setLoading]=useState(false);
  const [summary,setSummary]=useState(review?.summary||''),[strengths,setStrengths]=useState(review?.strengths?.join('\n')||''),[targets,setTargets]=useState(review?.targets?.join('\n')||''),[nextStep,setNextStep]=useState(review?.nextStep||'');
  const [ratings,setRatings]=useState<Record<string,number|null>>(record.body.ratings||{}),[saving,setSaving]=useState(false),[message,setMessage]=useState('');
  const attempt=useRef(crypto.randomUUID());
  useEffect(()=>()=>{if(audioUrl)URL.revokeObjectURL(audioUrl);},[audioUrl]);
  if(!documentId)return null;
  async function openAudio(){
    if(loading||audioUrl)return;setLoading(true);setAudioError('');
    const result=await documentRequest(code,mode==='teacher',{action:'documentFile',id:documentId,index:0});
    if(!result.ok||!result.file||!result.file.type.startsWith('audio/')){setAudioError(result.error||'Could not open this recording.');setLoading(false);return;}
    try {const bytes=Uint8Array.from(atob(result.file.data),x=>x.charCodeAt(0));setAudioUrl(URL.createObjectURL(new Blob([bytes],{type:result.file.type})));}
    catch {setAudioError('Could not play this recording in the browser.');}
    setLoading(false);
  }
  async function save(e:React.FormEvent){
    e.preventDefault();if(mode!=='teacher'||saving||!audioUrl||!summary.trim())return;
    setSaving(true);setMessage('');
    const next:AudioReview={summary:summary.trim(),strengths:lines(strengths),targets:lines(targets),nextStep:nextStep.trim(),ratings};
    const result=await reviewSpeakingAudio(code,record.id,attempt.current,next);
    setSaving(false);
    if(result.ok){attempt.current=crypto.randomUUID();setMessage(`Audio review saved for ${name} and the family.`);await onSaved();}
    else setMessage(result.error||'Could not confirm the audio review. Keep this page open and try again.');
  }
  return <section className="mt-4 rounded-xl border border-indigo-200 p-3 text-sm dark:border-white/15">
    <h4 className="font-semibold">Voice recording</h4><p className="mt-1 text-xs text-navy-soft dark:text-navy-mist">Listen to the saved sample. Its audio can support a separate review of speech; caption feedback only checks the transcript.</p>
    {audioUrl?<audio className="mt-2 w-full" controls src={audioUrl} aria-label="Student voice recording"/>:<button type="button" className="mt-2 rounded-xl border border-indigo-300 px-3 py-2 font-semibold" disabled={loading} onClick={()=>void openAudio()}>{loading?'Opening recording…':'Listen to recording'}</button>}
    {audioError&&<p role="alert" className="mt-2 text-red-700">{audioError}</p>}
    {review&&<div className="mt-3 rounded-xl bg-indigo-50 p-3 dark:bg-navy"><strong>Rory’s audio review</strong><p className="mt-1 whitespace-pre-wrap">{review.summary}</p>{!!review.strengths?.length&&<p className="mt-2">Strengths: {review.strengths.join(' · ')}</p>}{!!review.targets?.length&&<p className="mt-1">Next focus: {review.targets.join(' · ')}</p>}{review.nextStep&&<p className="mt-1">Next try: {review.nextStep}</p>}</div>}
    {mode==='teacher'&&<details className="mt-3"><summary className="cursor-pointer font-semibold">{review?'Update audio review':'Add audio review'}</summary><form className="mt-3 space-y-3" onSubmit={e=>void save(e)}>
      <p className="text-xs">Listen first. Note what you actually heard; leave any unobserved skill blank. These are task based observations, not a school grade.</p>
      <label className="block">What you heard<textarea className={field} rows={3} maxLength={2000} required value={summary} onChange={e=>setSummary(e.target.value)}/></label>
      <div className="grid gap-3 sm:grid-cols-2"><label>Strengths · one per line<textarea className={field} rows={3} value={strengths} onChange={e=>setStrengths(e.target.value)}/></label><label>Next focus · one per line<textarea className={field} rows={3} value={targets} onChange={e=>setTargets(e.target.value)}/></label></div>
      <label className="block">Next speaking task<textarea className={field} rows={2} maxLength={1000} value={nextStep} onChange={e=>setNextStep(e.target.value)}/></label>
      <fieldset><legend className="font-semibold">Optional classroom checkpoints</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{Object.entries(areas).map(([key,label])=><label key={key}>{label}<select className={field} value={ratings[key]??''} onChange={e=>setRatings(v=>({...v,[key]:e.target.value?Number(e.target.value):null}))}><option value="">Not observed</option>{[1,2,3,4].map(n=><option key={n} value={n}>{n} / 4</option>)}</select></label>)}</div></fieldset>
      <button className="rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white disabled:opacity-40" disabled={saving||!audioUrl||!summary.trim()}>{saving?'Saving…':'Save audio review'}</button>{message&&<p role="status">{message}</p>}
    </form></details>}
  </section>;
}
