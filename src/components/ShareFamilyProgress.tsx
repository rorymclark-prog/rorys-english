'use client';
import {useState} from 'react';
import {saveLearning,type LearningRecord} from '@/lib/learning';
import {familyProgressPublication} from '@/lib/family-progress-publication';
import {skillDomains} from '@/lib/skill-progress';
import {viennaDay} from '@/lib/teacher-metrics';
export default function ShareFamilyProgress({records,code,onSaved}:{records:LearningRecord[];code:string;onSaved:()=>Promise<void>}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const publication=familyProgressPublication(records,viennaDay());
 const pending=publication.filter(p=>!records.some(r=>r.id===p.id&&r.visibility==='shared'&&JSON.stringify(r.body.skillSnapshot)===JSON.stringify(p.body.skillSnapshot)));
 async function share(){if(busy)return;setBusy(true);setMessage('');try{for(const record of pending){const result=await saveLearning(code,record);if(!result.ok)throw Error(result.error||'Could not share this result.');}setMessage('Saved task results are now visible in the student and parent overviews.');await onSaved();}catch(error){setMessage(error instanceof Error?error.message:'Could not share the results.');}finally{setBusy(false);}}
 return <details className="my-4 rounded-xl border border-black/15 p-4"><summary className="cursor-pointer font-bold">Share existing task results with the family</summary><p className="mt-2">Use the latest recorded marks in each skill from existing writing and actual audio reviews. Sample estimates keep their date, support and marking guide. Private originals, marking evidence and teaching notes stay private. This does not claim a new test, an overall level or teacher authorship of the assessment.</p>{publication.map(record=><p className="mt-2" key={record.id}>{record.date} · {record.body.skillSnapshot.unitTitle} · {record.body.skillSnapshot.results.map(r=>`${skillDomains[r.domain]} ${r.earned}/${r.possible}`).join('; ')}</p>)}<button className="re-button mt-3" disabled={busy||!pending.length} onClick={()=>void share()}>{busy?'Sharing…':pending.length?'Share these task results':'Latest task results are shared'}</button>{message&&<p role="status">{message}</p>}</details>;
}
