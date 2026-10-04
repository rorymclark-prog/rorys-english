"use client";
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {getLearning,saveLearning,type LearningRecord} from '@/lib/learning';
import {lessonPracticeRecord,readLessonPractice,type LessonPractice} from '@/lib/lesson-practice';

export function LessonPracticeDetails({code,record,practice,mode}:{code:string;record:LearningRecord;practice:LessonPractice;mode:'student'|'parent'|'teacher'}) {
  return <section className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm dark:border-indigo-800 dark:bg-navy-raised">
    <p className="re-eyebrow">FROM YOUR LESSON · {practice.lessonDate}</p><h3 className="mt-1 text-lg font-bold">{practice.title}</h3><p className="mt-2">{practice.recap}</p>
    <ul className="mt-3 ml-5 list-disc">{practice.focus.map(x=><li key={x}>{x}</li>)}</ul>
    <p className="mt-3"><strong>Speak · about {practice.speakingMinutes} minutes:</strong> {practice.speakingPrompt}</p>
    {mode==='student'&&<Link className="re-button mt-3 inline-block" href={`/s/${code}/speak/?mode=lesson&practice=${encodeURIComponent(record.id)}`}>Practise with AI →</Link>}
    <p className="mt-4"><strong>Write · about {practice.writingMinutes} minutes:</strong> {practice.writingPrompt}</p>
    <p className="mt-2">{mode==='student'?'Use the answer box below to save your own writing, or attach a photograph.':'The student can save writing or a photograph with this task in their app.'} There is no new deadline.</p>
    <p className="mt-3 font-semibold">Check your attempt</p><ul className="ml-5 list-disc">{practice.successCriteria.map(x=><li key={x}>{x}</li>)}</ul>
    <p className="mt-3 text-xs">Short practice from your lesson. AI hints are practice advice; Rory’s feedback stays separate.</p>
  </section>;
}
export function LatestLessonPractice({code}:{code:string}) {
  const [entry,setEntry]=useState<ReturnType<typeof lessonPracticeRecord>>(null);
  useEffect(()=>{let live=true;setEntry(null);getLearning(code).then(r=>{if(live&&r.ok)setEntry(lessonPracticeRecord(r.records||[]));}).catch(()=>{});return()=>{live=false;};},[code]);
  if(!entry)return null;
  const {record,practice}=entry;
  return <section className="re-card mt-5"><p className="re-eyebrow">FROM YOUR LAST LESSON · {practice.lessonDate}</p><h2 className="mt-1 text-xl font-bold">{practice.title}</h2><p className="mt-2 text-sm">{practice.recap}</p><div className="mt-4 flex flex-wrap gap-3"><Link className="re-button" href={`/s/${code}/speak/?mode=lesson&practice=${encodeURIComponent(record.id)}`}>Practise with AI · {practice.speakingMinutes} min</Link><Link className="re-button re-secondary" href={`/s/${code}/progress/#review-${record.id}`}>Short writing task · {practice.writingMinutes} min</Link></div></section>;
}
export function LessonPracticeEditor({code,record,existing,onSaved}:{code:string;record:LearningRecord;existing?:LearningRecord;onSaved:()=>void}) {
  const initial=readLessonPractice((existing||record).body.lessonPractice);
  const [title,setTitle]=useState(initial?.title||'Practise improvements from my last lesson'),[recap,setRecap]=useState(initial?.recap||''),[focus,setFocus]=useState(initial?.focus.join('\n')||'');
  const [speaking,setSpeaking]=useState(initial?.speakingPrompt||''),[coaching,setCoaching]=useState(initial?.coaching||''),[writing,setWriting]=useState(initial?.writingPrompt||''),[criteria,setCriteria]=useState(initial?.successCriteria.join('\n')||'');
  const [speakMinutes,setSpeakMinutes]=useState(initial?.speakingMinutes||6),[writeMinutes,setWriteMinutes]=useState(initial?.writingMinutes||5),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const id=useRef(existing?.id||(record.body.source?.startsWith('lesson-practice:')&&initial?record.id:''));
  const field='mt-1 w-full rounded-xl border border-black/15 bg-white p-3 text-sm text-navy dark:border-white/20 dark:bg-navy dark:text-cream';
  async function publish(){
    if(busy)return;
    const practice=readLessonPractice({version:1,status:'ready',sourceReviewId:initial?.sourceReviewId||record.id,lessonDate:record.date,title,recap,focus:focus.split('\n').map(x=>x.trim()).filter(Boolean),speakingPrompt:speaking,coaching,writingPrompt:writing,speakingMinutes:speakMinutes,writingMinutes:writeMinutes,successCriteria:criteria.split('\n').map(x=>x.trim()).filter(Boolean)});
    if(!practice){setMessage('Add a short recap, 1–3 focus points, both tasks, AI coaching and 1–4 success criteria.');return;}
    setBusy(true);setMessage('');id.current||=crypto.randomUUID();
    const result=await saveLearning(code,{id:id.current,date:practice.lessonDate,kind:'lesson',title:`Lesson practice · ${practice.lessonDate}`,visibility:'shared',body:{summary:practice.recap,evidenceType:'Student practice prepared from the lesson',source:`lesson-practice:${practice.sourceReviewId}`,lessonPractice:practice}});
    setBusy(false);if(result.ok){setMessage('Practice is ready for this student. Private teaching notes were not included.');onSaved();}else setMessage(result.error||'Could not save practice. Your draft stays here.');
  }
  async function pause(){if(!existing||busy)return;setBusy(true);const result=await saveLearning(code,{...existing,visibility:'teacher',body:{...existing.body,lessonPractice:{...initial!,status:'draft'}}});setBusy(false);if(result.ok){setMessage('Practice paused.');onSaved();}else setMessage(result.error||'Could not pause practice.');}
  return <details className="mt-4 rounded-xl border border-indigo-300 p-3 text-sm"><summary className="cursor-pointer font-bold">{existing?'Edit lesson practice':'Prepare lesson practice'}</summary><p className="mt-3">Publish only a student-safe recap and practice tasks. Raw recordings, transcripts and your teaching reflection stay private. This creates practice, not a grade or a new deadline.</p><div className="mt-3 space-y-3">
    <label className="block">Title<input className={field} maxLength={120} value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <label className="block">Student recap<textarea className={field} maxLength={1200} value={recap} onChange={e=>setRecap(e.target.value)}/></label>
    <label className="block">Practice focus · 1–3 points, one per line<textarea className={field} value={focus} onChange={e=>setFocus(e.target.value)}/></label>
    <label className="block">Fresh speaking prompt<textarea className={field} maxLength={1200} value={speaking} onChange={e=>setSpeaking(e.target.value)}/></label>
    <label className="block">AI coaching brief · support to give and remove<textarea className={field} maxLength={2000} rows={4} value={coaching} onChange={e=>setCoaching(e.target.value)}/></label>
    <label className="block">Small written task<textarea className={field} maxLength={1800} rows={3} value={writing} onChange={e=>setWriting(e.target.value)}/></label>
    <label className="block">Success criteria · 1–4 points, one per line<textarea className={field} value={criteria} onChange={e=>setCriteria(e.target.value)}/></label>
    <div className="flex gap-3"><label>Speaking minutes<input className={field} type="number" min={1} max={15} value={speakMinutes} onChange={e=>setSpeakMinutes(Number(e.target.value))}/></label><label>Writing minutes<input className={field} type="number" min={1} max={20} value={writeMinutes} onChange={e=>setWriteMinutes(Number(e.target.value))}/></label></div>
    <button className="re-button" type="button" disabled={busy} onClick={()=>void publish()}>{busy?'Saving…':'Publish practice'}</button>{existing?.visibility==='shared'&&<button type="button" className="re-button re-secondary ml-3" disabled={busy} onClick={()=>void pause()}>Pause practice</button>}
    {message&&<p role="status">{message}</p>}
  </div></details>;
}
