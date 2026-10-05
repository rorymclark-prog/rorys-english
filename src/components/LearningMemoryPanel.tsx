"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {getLearning,type LearningRecord} from '@/lib/learning';
import {buildLearningMemory,memorySettings,type LearningMemory,type MemorySettings} from '@/lib/learning-memory';
import {getMemorySettings,saveMemorySettings,setMemoryEnabled} from '@/lib/memory-api';
import {readableDate} from '@/lib/clarity';
import {isStudentPreview} from '@/lib/student-preview';

export default function LearningMemoryPanel({code,teacher=false,records}:{code:string;teacher?:boolean;records?:LearningRecord[]}){
 const [settings,setSettings]=useState<MemorySettings>(memorySettings(null)),[snapshot,setSnapshot]=useState<LearningMemory|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(''),[retry,setRetry]=useState(0);
 const [evidence,setEvidence]=useState<LearningRecord[]>([]);
 useEffect(()=>{let live=true;setSnapshot(null);setError('');
  Promise.all([getMemorySettings(code,teacher),records?Promise.resolve({ok:true,records}):getLearning(code,teacher)]).then(([s,r])=>{
   if(!live)return;if(!s.ok||!r.ok){setError(s.error||'Could not open learning memory.');return;}
   const value=memorySettings(s.settings);setSettings(value);setEvidence(r.records||[]);setSnapshot(buildLearningMemory(code,r.records||[],value));
  }).catch(()=>{if(live)setError('Could not open learning memory.');});return()=>{live=false;};
 },[code,teacher,records,retry]);
 async function save(value=settings){if(busy)return;setBusy(true);setSaved('');setError('');const r=teacher?await saveMemorySettings(code,value):await setMemoryEnabled(code,value.enabled);setBusy(false);if(r.ok){setSettings(value);setSnapshot(buildLearningMemory(code,evidence,value));setSaved('Memory settings saved. They apply to the next conversation.');}else {if(!teacher)setSettings(memorySettings({...value,enabled:snapshot?.enabled}));setError(r.error||'Could not save memory settings.');}}
 const preview=isStudentPreview(code);
 return <details className="re-card mt-4" aria-label="Learning memory"><summary className="cursor-pointer font-bold">{teacher?'Learning memory · what the AI can use':'What your AI remembers'}</summary>
  <p className="mt-3 text-sm">Each new conversation checks your recent saved lesson recap and AI practice feedback. It uses a short learning summary. Old AI hints are suggestions to check again, not permanent weaknesses.</p>
  {!snapshot&&!error&&<p role="status" className="mt-2 text-sm">Opening learning memory…</p>}
  {error&&<p role="alert" className="mt-2 text-sm">{error} <button className="underline" onClick={()=>setRetry(x=>x+1)}>Try again</button></p>}
  {snapshot&&<><label className="mt-3 flex gap-2 text-sm"><input type="checkbox" checked={settings.enabled} disabled={busy||preview} onChange={e=>{const value={...settings,enabled:e.target.checked};setSettings(value);if(!teacher)void save(value);}}/>Use recent practice in my next AI conversation</label>
   {teacher&&<div className="mt-3 space-y-3 text-sm"><label className="block">Rory’s current focus · up to two short targets<textarea className="mt-1 w-full rounded-xl border border-black/15 bg-transparent p-3" rows={3} maxLength={501} value={settings.focus.join('\n')} onChange={e=>setSettings({...settings,focus:e.target.value.split('\n').slice(0,2)})}/></label><label className="block">Use records from this date<input type="date" className="ml-2 rounded-lg border bg-transparent p-2" value={settings.since} onChange={e=>setSettings({...settings,since:e.target.value})}/></label><p className="text-xs">Blank means the most recent 90 days. A later date starts fresh without deleting saved work.</p></div>}
   {!snapshot.enabled?<p className="mt-3 text-sm">Past practice is switched off. A selected lesson task still supplies its own brief.</p>:<>
    {!!snapshot.focus.length&&<p className="mt-3 text-sm"><strong>Current focus from Rory:</strong> {snapshot.focus.join(' · ')}</p>}
    {!snapshot.sources.length&&<p className="mt-3 text-sm">No recent feedback to remember yet. The AI can start with a fresh question.</p>}
    <ul className="mt-3 space-y-3">{snapshot.sources.map(s=><li key={s.id} className="rounded-xl border border-black/10 p-3 text-sm dark:border-white/15"><strong>{s.kind==='lesson'?'Lesson recap & practice':s.kind==='ai-conversation'?'AI conversation feedback':'Rory’s feedback'} · {readableDate(s.date)}</strong>{s.summary&&<p className="mt-1">{s.summary}</p>}{s.strengths.map(x=><p className="mt-1" key={x}>What went well: {x}</p>)}{s.targets.map(x=><p className="mt-1" key={x}>Practise next: {x}</p>)}{!teacher&&<Link className="mt-2 inline-block underline" href={`/s/${code}/progress/#review-${s.id}`}>Open saved feedback</Link>}{teacher&&<button className="mt-2 block underline" onClick={()=>setSettings({...settings,excludedIds:[...new Set([...settings.excludedIds,s.id])]})}>Leave this entry out when settings are saved</button>}</li>)}</ul>
   </>}
   {teacher&&<div className="mt-3 flex flex-wrap gap-3"><button className="re-button" disabled={busy} onClick={()=>void save()}>{busy?'Saving…':'Save memory settings'}</button>{!!settings.excludedIds.length&&<button className="re-button re-secondary" onClick={()=>setSettings({...settings,excludedIds:[]})}>Include excluded entries again</button>}</div>}
   <p className="mt-3 text-xs">The summary refreshes from saved feedback before each conversation. Full transcripts, recordings and private teaching notes stay outside voice memory. New feedback appears after the conversation has been saved and analysed.</p>
  </>}{saved&&<p role="status" className="mt-2 text-sm">{saved}</p>}
 </details>;
}
