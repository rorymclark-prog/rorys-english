"use client";
import {useEffect,useRef,useState} from 'react';
import {documentRequest,type DocumentExercise,type DocumentPracticeAttempt} from '@/lib/documents';
import {isStudentPreview} from '@/lib/student-preview';
import {useDurableDraft} from '@/lib/use-durable-draft';

export type PracticeExerciseProps={code:string;documentId:string;version:string;sourceType:'document'|'submission'|'reply';disabled:boolean;teacher:boolean;exercise:DocumentExercise;index:number;attempts:DocumentPracticeAttempt[];hidePreviousUntilAttempt?:boolean;onSaved?:(attempt:DocumentPracticeAttempt)=>void};

export default function PracticeExercise({code,documentId,version,sourceType,disabled,teacher,exercise:e,index,attempts,hidePreviousUntilAttempt=false,onSaved}:PracticeExerciseProps){
 const [saved,setSaved]=useState(attempts),[busy,setBusy]=useState(false),[error,setError]=useState(''),[revealedId,setRevealedId]=useState('');
 const draft=useDurableDraft({code,role:'student',source:`practice:${sourceType}:${documentId}:${e.id}`,version:JSON.stringify([version,e.prompt,e.options]),enabled:!disabled},'');
 const identity=JSON.stringify([code,documentId,version,sourceType,e.id,e.prompt,e.options]);
 const current=useRef({active:true,generation:0,scopeKey:draft.scopeKey,disabled,identity});
 current.current.scopeKey=draft.scopeKey;current.current.disabled=disabled;current.current.identity=identity;
 useEffect(()=>{current.current.active=true;const changed=()=>{current.current.generation++;setRevealedId('');setBusy(false);};window.addEventListener('re-auth-change',changed);return()=>{current.current.active=false;current.current.generation++;window.removeEventListener('re-auth-change',changed);};},[]);
 const history=saved.filter(a=>a.exerciseId===e.id&&a.version===version),latest=history.at(-1);
 const shown=hidePreviousUntilAttempt?history.find(a=>a.id===revealedId):latest;
 async function check(){
  if(disabled||busy||!draft.ready||!draft.value.trim()||isStudentPreview(code))return;
  const generation=current.current.generation,scopeKey=draft.scopeKey;
  const stillCurrent=()=>current.current.active&&current.current.generation===generation&&current.current.scopeKey===scopeKey&&current.current.identity===identity&&!current.current.disabled&&!isStudentPreview(code);
  setBusy(true);setError('');
  try{
   const id=draft.beginRequest(),answer=draft.value.trim();
   const r=await documentRequest(code,false,{action:sourceType==='document'?'documentPractice':'workPractice',sourceType,id:documentId,version,exerciseId:e.id,attemptId:id,answer});
   if(!stillCurrent())return;
   if(r.ok&&r.received&&r.attempt?.id===id&&r.attempt.documentId===(sourceType==='document'?documentId:`${sourceType}:${documentId}`)&&r.attempt.exerciseId===e.id&&r.attempt.version===version&&r.attempt.answer===answer){
    if(!draft.confirmSaved('')){setError('Your attempt was received, but this device copy could not be cleared. Keep your copy and reload before continuing.');return;}
    setSaved(all=>all.some(a=>a.id===id)?all:[...all,r.attempt!]);setRevealedId(id);onSaved?.(r.attempt);
   }else{if(!r.ok&&!r.offline&&!r.authRequired)draft.resumeEditing();setError(r.error||'Could not confirm your attempt. Retry this saved copy.');}
  }catch(err){if(stillCurrent())setError(err instanceof Error?err.message:'Could not confirm your attempt. Retry this saved copy.');}
  finally{if(stillCurrent())setBusy(false);}
 }
 return <article>
  <h4>{index+1}. {e.focus}</h4><p>{e.prompt}</p>
  {hidePreviousUntilAttempt&&!shown&&<p className="practice-desk-recall-note">Try from memory first. Your earlier answer and the example stay hidden until this attempt is saved.</p>}
  {disabled&&e.type==='choice'&&<ul className="ml-5 list-disc" aria-label={`Answer choices for exercise ${index+1}`}>{e.options.map(o=><li key={o}>{o}</li>)}</ul>}
  {!disabled&&(e.type==='choice'?<label className="sr-only-label">Your answer<select aria-label={`Your answer to exercise ${index+1}`} value={draft.value} disabled={busy||draft.pending||!draft.ready} onChange={ev=>draft.setValue(ev.target.value)}><option value="">Choose your answer</option>{e.options.map(o=><option key={o}>{o}</option>)}</select></label>:<label>Your answer<textarea aria-label={`Your answer to exercise ${index+1}`} rows={2} maxLength={1200} value={draft.value} disabled={busy||draft.pending||!draft.ready} onChange={ev=>draft.setValue(ev.target.value)}/></label>)}
  {!disabled&&<><p className="draft-save-status" role="status">{draft.error||draft.status}</p>{error&&<p role="alert" className="doc-error">{error}</p>}<button className="doc-secondary" disabled={busy||!draft.ready||!draft.value.trim()} onClick={()=>void check()}>{busy?'Saving…':draft.pending?'Retry saved answer':hidePreviousUntilAttempt?'Save this try':latest?'Check another try':'Check my answer'}</button></>}
  {shown&&<div className="doc-reading-note" role="status"><strong>{shown.result.status==='correct'?'✓ That matches':shown.result.status==='try-again'?'Try again':'Compare your answer'}</strong><p>Your saved answer: {shown.answer}</p><p>One possible answer: {shown.result.example}</p><p>{shown.result.explanation}</p></div>}
  {teacher&&!hidePreviousUntilAttempt&&e.example&&<details><summary>Answer guidance · for Rory</summary><p>{e.example}</p><p>{e.explanation}</p></details>}
  {history.length>1&&(!hidePreviousUntilAttempt||!!shown)&&<details><summary>{history.length} saved attempts</summary>{history.map(a=><p key={a.id}>{a.answer}</p>)}</details>}
 </article>;
}
