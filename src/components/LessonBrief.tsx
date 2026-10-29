'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {savedSession} from '@/lib/api';
import type {Unit} from '@/lib/types';
import {getLearning,saveLearning,type LearningRecord} from '@/lib/learning';
import {useDurableDraft} from '@/lib/use-durable-draft';
import {viennaDay} from '@/lib/teacher-metrics';
import {readableDate} from '@/lib/clarity';
import {briefPhases,briefTotal,emptyLessonBrief,lessonBriefId,lessonBriefSources,lessonBriefEvidence,lessonBriefText,lessonBriefDraftValid,readLessonBrief,savedLessonBrief,type BriefPhase,type BriefSource,type LessonBrief as Brief} from '@/lib/lesson-brief';
const input='mt-1 w-full rounded-lg border border-black/15 bg-transparent p-2 dark:border-white/20';
const latestBrief=(records:LearningRecord[]|undefined)=>records?.filter(r=>r.id===lessonBriefId).sort((a,b)=>b.created.localeCompare(a.created))[0];
const matches=(r:LearningRecord|undefined,b:Brief)=>!!r&&r.id===lessonBriefId&&r.visibility==='teacher'&&r.kind==='test'&&JSON.stringify(r.body.tutorPrivate?.lessonBrief)===JSON.stringify(b);
export default function LessonBrief({code,name,unit,records,onSaved}:{code:string;name:string;unit:Unit|null;records:LearningRecord[];onSaved:()=>Promise<void>}){
 const saved=useMemo(()=>savedLessonBrief(records),[records]),initial=saved||emptyLessonBrief(unit),draft=useDurableDraft<Brief>({code,role:'teacher',source:lessonBriefId,version:'1'},initial);
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const mounted=useRef(true),scopeRef=useRef('');scopeRef.current=JSON.stringify([code,draft.scopeKey]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const value=lessonBriefDraftValid(draft.value)?draft.value:initial,sources=useMemo(()=>lessonBriefSources(records,viennaDay()),[records]),total=briefTotal(value),valid=!!readLessonBrief(value),changed=JSON.stringify(saved)!==JSON.stringify(value);
 const update=(patch:Partial<Brief>)=>{draft.setValue(v=>({...v,...patch}));setMessage('');};
 function select(source:BriefSource){const selected=value.priorities.some(p=>p.id===source.id);if(!selected&&value.priorities.length>=2)return;update({priorities:selected?value.priorities.filter(p=>p.id!==source.id):[...value.priorities,source]});}
 async function save(){
  if(!valid||busy||!draft.ready)return;
  const scope=scopeRef.current,token=savedSession('__teacher__')?.token,current=()=>mounted.current&&scopeRef.current===scope&&!!token&&savedSession('__teacher__')?.token===token;
  if(!current())return;setBusy(true);setMessage('');
  try{
   if(draft.pending){
    const readback=await getLearning(code,true);if(!current())return;
    if(!readback.ok)throw Error('The last save is still unconfirmed. Your retry copy is kept.');
    if(matches(latestBrief(readback.records),value)){
     if(!draft.confirmSaved(value))throw Error('The saved brief was found, but the device copy could not be cleared. It is kept for you.');
     if(!current())return;setMessage('Private brief confirmed saved.');await onSaved();return;
    }
   }
   if(!current())return;draft.beginRequest();
   const result=await saveLearning(code,{id:lessonBriefId,date:viennaDay(),kind:'test',title:'Next lesson brief · private preparation',visibility:'teacher',body:{tutorPrivate:{lessonBrief:value}}});
   if(!current())return;
   if(!result.ok){if(!result.offline&&!result.authRequired)draft.resumeEditing();throw Error(result.error||'The brief was not saved. Your device draft is kept.');}
   let confirmed=matches(result.record,value);
   if(!confirmed){const readback=await getLearning(code,true);if(!current())return;confirmed=!!readback.ok&&matches(latestBrief(readback.records),value);}
   if(!confirmed)throw Error('The saved copy could not be confirmed exactly. Keep this draft and retry to check it.');
   if(!current())return;
   if(!draft.confirmSaved(value))throw Error('The saved brief was confirmed, but the device copy could not be cleared. It is kept for you.');
   if(!current())return;setMessage('Private lesson brief saved.');await onSaved();
  }catch(e){if(current())setMessage(e instanceof Error?e.message:'Save not confirmed. Your retry copy is kept.');}finally{if(current())setBusy(false);}
 }
 function download(){if(!valid)return;const url=URL.createObjectURL(new Blob([lessonBriefText(name,value)],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=`private-lesson-brief-${name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.txt`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 const field=(key:'opening'|'practice'|'exit'|'support'|'reserve',label:string,hint:string)=><label className="lesson-brief-field" key={key}><strong>{label}</strong><span>{hint}</span><textarea className={input} rows={3} maxLength={2000} value={value[key]} onChange={e=>update({[key]:e.target.value})}/></label>;
 if(draft.ready&&!lessonBriefDraftValid(draft.value))return <section className="lesson-brief insight-card mb-5" aria-label="Lesson brief recovery"><h2>Your device draft needs recovery</h2><p>The saved device copy contains unreadable details. It is still kept on this device.</p><div className="lesson-brief-actions"><button type="button" className="re-button re-secondary" onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(draft.value,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='private-lesson-brief-recovery.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Download private recovery copy</button><button type="button" className="re-button re-secondary" onClick={()=>draft.discard(initial)}>Replace device draft with latest saved brief</button></div>{draft.error&&<p role="status">{draft.error}</p>}</section>;
 return <section className="lesson-brief insight-card mb-5" aria-label={`${name}’s next lesson brief`}>
  <header className="lesson-brief-header"><div><p className="teacher-eyebrow">NEXT LESSON · PRIVATE TO RORY</p><h2>Turn evidence into a lesson</h2><p>Choose up to two recorded next checks, then plan the opening, practice and fresh exit task.</p></div><button className="re-button re-secondary" type="button" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{open?'Close brief':saved?'Open lesson brief':'Build lesson brief'}</button></header>
  {!open&&<p className="lesson-brief-summary">{saved?`${saved.priorities.length} ${saved.priorities.length===1?'priority':'priorities'} · ${saved.duration}-minute core · ${saved.reserveMinutes}-minute optional reserve. ${saved.unitTitle}.`:'A short preparation brief keeps the evidence, help given and next independent check together.'}{draft.updatedAt>0?' A device draft is available.':''}</p>}
  {open&&<>
   <p className="lesson-brief-note">This is private preparation. Saving keeps the latest brief and its earlier versions; it does not book a lesson or assign student work.</p>
   {saved&&unit&&saved.unitId!==unit.id&&<p className="lesson-brief-warning">This saved brief names a different unit. Check the school focus before reusing it.</p>}
   {!draft.ready?<p role="status">Opening your private draft…</p>:<form onSubmit={e=>{e.preventDefault();void save();}}>
    <fieldset disabled={busy||draft.pending}>
     <label className="lesson-brief-field"><strong>School unit / lesson focus</strong><input className={input} maxLength={300} value={value.unitTitle} onChange={e=>update({unitTitle:e.target.value})}/></label>
     {unit&&value.unitId!==unit.id&&<button className="teacher-quiet-button" type="button" onClick={()=>update({unitId:unit.id,unitTitle:unit.title})}>Use current unit: {unit.title}</button>}
     <div className="lesson-brief-section-heading"><h3>Choose the next checks</h3><span>{value.priorities.length} / 2 selected</span></div>
     <p className="text-sm">These are the recorded prompts, in the source’s own words. Select by today’s school priorities; an old observation is not proof that a difficulty persists.</p>
     {value.priorities.filter(p=>!sources.some(s=>s.id===p.id&&JSON.stringify(s)===JSON.stringify(p))).map(p=><article className="lesson-brief-source lesson-brief-source-selected" key={p.id}><strong>Saved priority · source may have changed</strong><p>{p.prompt}</p><p className="text-sm">{p.title} · {readableDate(p.date)} · {p.status}</p><button type="button" className="teacher-quiet-button" onClick={()=>update({priorities:value.priorities.filter(s=>s.id!==p.id)})}>Remove saved priority</button></article>)}
     <div className="lesson-brief-sources">{sources.map(source=>{const selected=value.priorities.some(p=>p.id===source.id),original=lessonBriefEvidence(records,source);return <article className={`lesson-brief-source${selected?' lesson-brief-source-selected':''}`} key={source.id}>
      <label className="lesson-brief-choice"><input type="checkbox" checked={selected} disabled={!selected&&value.priorities.length>=2} onChange={()=>select(source)}/><span><strong>{source.prompt}</strong><small>{source.kind} · {readableDate(source.date)} · {source.status}</small></span></label>
      <p className="lesson-brief-source-detail">Help recorded: {source.support}</p>{source.strengths.length>0&&<p className="lesson-brief-source-detail">Strengths: {source.strengths.join('; ')}</p>}
      <details className="lesson-brief-source-detail"><summary>Source and limits</summary><p>{source.title}</p><p>{source.limits||'No additional limits recorded; check the original evidence.'}</p><details className="mt-2"><summary>Original evidence · private to Rory</summary>{original.length?original.map((section,i)=><div className="mt-3" key={i}><strong>{section.heading}</strong>{section.lines.map((line,j)=><p className="mt-1 whitespace-pre-wrap" key={j}>{line}</p>)}</div>):<p>The original private note is no longer available in the loaded records. Refresh the dashboard before relying on it.</p>}</details></details>
     </article>;})}</div>
     {!sources.length&&<p className="lesson-brief-note">No explicit next checks have been recorded yet. Add a next check to an existing skill check, checkpoint, lesson assessment or private teaching reflection, then refresh the dashboard.</p>}
     <h3 className="lesson-brief-subheading">Plan what the learner will do</h3>
     {value.priorities.length>0&&<button type="button" className="teacher-quiet-button" onClick={()=>update({opening:value.priorities.map(p=>p.prompt).join('\n\n')})}>Copy selected prompts into opening check</button>}
     <div className="lesson-brief-fields">{field('opening','Opening independent check','Give the exact fresh task before examples. Note what Rory will observe.')}{field('practice','Focused practice','Name the verified unit work, useful language and the learner’s action.')}{field('exit','Fresh independent exit check','Use a different task for the same objective. Leave the actual result to the lesson.')}{field('support','Support and stretch','State a small cue, a supported retry or a harder route, chosen from the learner’s response.')}</div>
     <h3 className="lesson-brief-subheading">Keep the timing realistic</h3>
     <div className="lesson-brief-timing"><label>Core lesson minutes<input className={input} type="number" min={15} max={240} value={value.duration} onChange={e=>update({duration:Number(e.target.value)})}/></label>{Object.entries(briefPhases).map(([key,label])=><label key={key}>{label}<input className={input} type="number" min={0} max={240} value={value.minutes[key as BriefPhase]} onChange={e=>update({minutes:{...value.minutes,[key]:Number(e.target.value)}})}/></label>)}</div>
     <p className={total===value.duration?'lesson-brief-total':'lesson-brief-warning'}>{total} / {value.duration} core minutes planned{total!==value.duration?' · adjust the phases to match the lesson length.':'.'}</p>
     {field('reserve','Optional reserve','A separate activity for genuine spare time or an agreed extension; it does not replace core work.')}
     <label className="lesson-brief-reserve">Additional reserve minutes<input className={input} type="number" min={0} max={60} value={value.reserveMinutes} onChange={e=>update({reserveMinutes:Number(e.target.value)})}/></label>
    </fieldset>
    <div className="lesson-brief-actions"><button type="submit" className="re-button" disabled={busy||!valid||!draft.ready||!changed&&!draft.pending}>{busy?'Confirming save…':draft.pending?'Check & retry saved brief':'Save private lesson brief'}</button><button type="button" className="re-button re-secondary" disabled={!valid} onClick={download}>Download private text copy</button><span className="text-sm" role="status">{draft.status}</span></div>
    {!valid&&<p className="text-sm mt-2">Select one or two priorities, complete opening, practice and exit tasks, and match the core minutes before saving.</p>}
   </form>}
   {(message||draft.error)&&<p className="lesson-brief-note" role="status">{message||draft.error}</p>}
  </>}
 </section>;
}
