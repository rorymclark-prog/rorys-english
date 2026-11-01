"use client";
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {loadPracticeDesk,extendPracticeDesk,type PracticeDeskData,type PracticeCard} from '@/lib/practice-desk';
import {savedSession} from '@/lib/api';
import {isStudentPreview} from '@/lib/student-preview';
import PracticeExercise from './PracticeExercise';

type Filter='all'|'first'|'retry'|'revisit';
const labels:Record<PracticeCard['state'],string>={first:'First try',retry:'Try again',revisit:'Revisit',recent:'Recently practised'};
const filters:{id:Filter;label:string}[]=[{id:'all',label:'All'},{id:'first',label:'First try'},{id:'retry',label:'Try again'},{id:'revisit',label:'Revisit'}];
export default function PracticeDesk({code,name,teacher=false}:{code:string;name:string;teacher?:boolean}){
 const [result,setResult]=useState<{key:string;data:PracticeDeskData}|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[batchError,setBatchError]=useState(''),[batchLoading,setBatchLoading]=useState<'older'|'retry'|null>(null),[refresh,setRefresh]=useState(0),[filter,setFilter]=useState<Filter>('all'),[page,setPage]=useState(0),[saved,setSaved]=useState<string[]>([]);
 const preview=isStudentPreview(code),scope=JSON.stringify([code,teacher,preview]),generation=useRef(0),scopeRef=useRef(scope),operation=useRef<number|null>(null),sequence=useRef(0),readTail=useRef<Promise<void>>(Promise.resolve()),resultRef=useRef<{key:string;data:PracticeDeskData}|null>(null),disabled=teacher||preview;
 scopeRef.current=scope;
 const token=()=>savedSession(teacher||preview?'__teacher__':code)?.token;
 useEffect(()=>{
  let active=true;const attempt=++generation.current,id=++sequence.current,auth=token();operation.current=id;
  const current=()=>active&&attempt===generation.current&&scopeRef.current===scope&&isStudentPreview(code)===preview&&token()===auth;
  setLoading(true);setError('');setBatchError('');setBatchLoading(null);setResult(null);resultRef.current=null;setSaved([]);setPage(0);setFilter('all');
  // A new identity waits for an earlier read pool to settle. Its response can
  // never become the new learner's data, and no second pool starts alongside it.
  const read=readTail.current.then(async()=>{if(!current())return;try{const data=await loadPracticeDesk(code,teacher);if(current()){const next={key:scope,data};resultRef.current=next;setResult(next);}}catch(err){if(current())setError(err instanceof Error?err.message:'Could not open your practice. Your saved work is safe.');}finally{if(current())setLoading(false);if(operation.current===id)operation.current=null;}});
  readTail.current=read.catch(()=>{});
  const changed=()=>{generation.current++;setResult(null);resultRef.current=null;setSaved([]);setLoading(true);setBatchError('');setBatchLoading(null);setRefresh(value=>value+1);};window.addEventListener('re-auth-change',changed);
  return()=>{active=false;generation.current++;window.removeEventListener('re-auth-change',changed);};
 },[code,teacher,preview,refresh,scope]);
 const data=result?.key===scope?result.data:null;
 async function checkMore(mode:'older'|'retry'){
  const previous=resultRef.current;
  if(operation.current!==null||!previous||previous.key!==scope||!previous.data.continuation||(mode==='older'?previous.data.remaining===0:previous.data.failed===0))return;
  const attempt=generation.current,id=++sequence.current,auth=token();operation.current=id;setBatchLoading(mode);setBatchError('');
  const current=()=>attempt===generation.current&&scopeRef.current===scope&&isStudentPreview(code)===preview&&token()===auth;
  const read=readTail.current.then(async()=>{if(!current())return;try{const nextData=await extendPracticeDesk(code,teacher,previous.data,mode);if(current()){const next={key:scope,data:nextData};resultRef.current=next;setResult(next);}}catch(err){if(current())setBatchError(err instanceof Error?err.message:'Could not check this set. Your existing practice and drafts are kept.');}finally{if(current())setBatchLoading(null);if(operation.current===id)operation.current=null;}});
  readTail.current=read.catch(()=>{});await read;
 }
 const cards=data?.cards.filter(card=>filter==='all'||card.state===filter)||[],pages=Math.max(1,Math.ceil(cards.length/3)),currentPage=Math.min(page,pages-1),session=cards.slice(currentPage*3,currentPage*3+3),completed=session.filter(card=>saved.includes(card.id)).length;
 const chooseFilter=(value:Filter)=>{setFilter(value);setPage(0);setSaved([]);};
 const choosePage=(value:number)=>{setPage(value);setSaved([]);};
 return <section className="practice-desk" aria-labelledby="practice-desk-title" aria-busy={loading||batchLoading!==null}>
  <header className="practice-desk-header"><div><p className="work-eyebrow">A LITTLE, THEN RETURN LATER</p><h2 id="practice-desk-title">{teacher?`${name}’s practice desk`:'Your practice desk'}</h2><p>A little practice from feedback on your saved work. Try up to three prompts yourself, then compare with an example.</p></div><span className="practice-desk-badge">Optional · about 5 minutes</span></header>
  <p className="practice-desk-purpose">A saved try is practice, not a grade. “Revisit” means it has been at least three days since the last saved try; it does not mean the answer was forgotten.</p>
  {disabled&&<p className="practice-desk-notice" role="note">Read-only {teacher?'teacher view':'preview'}. Prompts and answer choices are available; attempts are saved only by the learner.</p>}
  {loading?<p className="practice-desk-loading" role="status">Finding practice from your saved feedback…</p>:error?<div className="practice-desk-notice"><p role="alert">{error}</p><button className="doc-secondary" onClick={()=>setRefresh(value=>value+1)}>Try loading again</button></div>:data&&<>
   {!!data.warnings.length&&<div className="practice-desk-notice" role="status"><strong>Some work could not be checked</strong>{data.warnings.map((warning,index)=><p key={index}>{warning}</p>)}</div>}
   <div className="practice-desk-coverage" role="status"><p>Checked {data.checked} of {data.total} pieces of saved work. {data.sources.length} {data.sources.length===1?'piece includes':'pieces include'} practice prompts.</p>{data.failed>0&&<p>{data.failed} {data.failed===1?'check needs':'checks need'} a retry. Unchecked work is not counted as checked.</p>}</div>
   <div className="practice-desk-filters" role="group" aria-label="Choose practice"><span>Choose a short set</span>{filters.map(item=><button key={item.id} type="button" aria-pressed={filter===item.id} onClick={()=>chooseFilter(item.id)}>{item.label}<span aria-hidden="true"> · {item.id==='all'?data.cards.length:data.cards.filter(card=>card.state===item.id).length}</span></button>)}</div>
   {!data.cards.length?<div className="practice-desk-empty"><h3>Your next practice will start here</h3><p>{data.remaining>0?'The pieces checked so far have no available practice prompts. Check older saved work below, or open your feedback.':'When feedback on a saved piece of writing includes practice prompts, they appear here. You can also read your feedback or have a short conversation.'}</p><Link href={`/s/${encodeURIComponent(code)}/progress/`}>Open feedback</Link></div>:!cards.length?<div className="practice-desk-empty"><h3>No prompts in this set</h3><p>Choose All to see the other optional practice. Nothing is overdue here.</p><button className="doc-secondary" onClick={()=>chooseFilter('all')}>Show all practice</button></div>:<>
    <div className="practice-desk-session-status" role="status"><strong>{completed===session.length?'This short set is saved':`${session.length} ${session.length===1?'prompt':'prompts'} in this short set`}</strong><span>{completed} of {session.length} saved this visit</span></div>
    <div className="practice-desk-grid">{session.map((card,index)=><section key={`${scope}:${refresh}:${filter}:${currentPage}:${card.id}`} className="practice-desk-card" aria-label={`Practice ${index+1}: ${card.exercise.focus}`}>
     <div className="practice-desk-card-meta"><span className={`practice-desk-state practice-desk-state-${card.state}`}>{labels[card.state]}</span>{saved.includes(card.id)&&<span className="practice-desk-saved">Saved this visit</span>}</div>
     <div className="practice-desk-source"><span>From your saved work</span><Link href={`/s/${encodeURIComponent(code)}/documents/?document=${encodeURIComponent(card.documentId)}`}>{card.sourceTitle}</Link>{card.lastPractised&&<small>Last saved try: {formatDay(card.lastPractised)}</small>}</div>
     <div className="document-practice"><PracticeExercise code={code} documentId={card.documentId} version={card.version} sourceType="document" disabled={disabled} teacher={teacher} exercise={card.exercise} index={index} attempts={card.attempts} hidePreviousUntilAttempt onSaved={()=>setSaved(previous=>previous.includes(card.id)?previous:[...previous,card.id])}/></div>
    </section>)}</div>
    <footer className="practice-desk-session-footer"><p>{completed===session.length?'You can stop here. Return another day for a fresh try.':'Save a try to see one possible answer. You can stop whenever you want.'}</p>{pages>1&&<nav aria-label="Practice sets">{currentPage>0&&<button className="doc-secondary" onClick={()=>choosePage(currentPage-1)}>Previous set</button>}<span>Set {currentPage+1} of {pages}</span>{currentPage<pages-1&&<button className="doc-secondary" onClick={()=>choosePage(currentPage+1)}>Another short set</button>}</nav>}</footer>
   </>}
   <div className="practice-desk-loading-actions">
    {batchError&&<p role="alert" className="doc-error">{batchError}</p>}
    {batchLoading&&<p role="status">{batchLoading==='older'?'Checking the next older set…':'Retrying unchecked work…'} Your current prompts and drafts stay in place.</p>}
    {data.remaining>0&&<button type="button" className="doc-secondary" disabled={batchLoading!==null} onClick={()=>void checkMore('older')}>Check older saved work</button>}
    {data.failed>0&&<button type="button" className="doc-secondary" disabled={batchLoading!==null} onClick={()=>void checkMore('retry')}>Retry unchecked work</button>}
    <p className="practice-desk-limits">{data.remaining>0?`${data.remaining} older pieces have not been checked in this visit. Each click checks up to eight.`:'No older pieces remain in this visit’s list.'} New uploads appear when you reopen this desk or refresh the list.</p>
    <button type="button" className="teacher-quiet-button" disabled={batchLoading!==null} onClick={()=>setRefresh(value=>value+1)}>Refresh saved-work list</button>
    <Link href={`/s/${encodeURIComponent(code)}/documents/`}>Open all saved work</Link>
   </div>
  </>}
 </section>;
}
function formatDay(day:string){const date=new Date(day.length===10?day+'T12:00:00Z':day);return Number.isNaN(date.getTime())?day:new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Vienna'}).format(date);}
