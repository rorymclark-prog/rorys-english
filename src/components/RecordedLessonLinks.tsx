"use client";
import {useEffect,useState} from 'react';
import {getLearning,type LearningRecord} from '@/lib/learning';
import {readableDate} from '@/lib/clarity';
import {latestRecordedLesson} from '@/lib/feedback-source';

export default function RecordedLessonLinks({students,onOpen}:{students:{code:string;name:string}[];onOpen:(code:string,id:string)=>void}){
  const [entries,setEntries]=useState<{code:string;name:string;record:LearningRecord}[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(false),[retry,setRetry]=useState(0);
  useEffect(()=>{let live=true;setLoading(true);setError(false);
    Promise.all(students.map(async s=>{try{return {s,result:await getLearning(s.code,true)};}catch{return {s,result:{ok:false,records:[]}};}})).then(all=>{
      if(!live)return;
      setError(all.some(x=>!x.result.ok));
      setEntries(all.flatMap(({s,result})=>{const record=result.ok?latestRecordedLesson(result.records||[]):null;return record?[{code:s.code,name:s.name,record}]:[];}));
      setLoading(false);
    });return()=>{live=false;};
  },[students,retry]);
  return <section className="re-card mb-6" aria-labelledby="recorded-lessons-title"><p className="teacher-eyebrow">LESSON RECORDING FEEDBACK</p><h2 id="recorded-lessons-title" className="mt-1 text-xl font-bold">Recorded lesson assessments</h2><p className="mt-2 text-sm">Open the latest lesson review for each student. These drafts are private and await your review.</p>
    {loading?<p className="mt-3 text-sm" role="status">Finding your lesson reviews…</p>:<><div className="mt-4 grid gap-3 sm:grid-cols-2">{entries.map(({code,name,record})=><button key={code} type="button" className="re-button re-secondary text-left" onClick={()=>onOpen(code,record.id)}><strong className="block">{name} · {readableDate(record.date)}</strong><span className="block mt-1">Open recorded lesson feedback →</span></button>)}</div>{!entries.length&&!error&&<p className="mt-3 text-sm">No recorded lesson reviews yet.</p>}</>}
    {error&&<p className="mt-3 text-sm" role="alert">Some lesson reviews could not be loaded. <button type="button" className="underline" onClick={()=>setRetry(x=>x+1)}>Try again</button></p>}
  </section>;
}
