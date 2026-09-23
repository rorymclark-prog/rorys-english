"use client";
import {useState} from 'react';
import {saveLearning,type LearningRecord,type WritingComparison} from '@/lib/learning';

const colors={
  original:{panel:'border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30',label:'text-rose-800 dark:text-rose-200',mark:'text-rose-800 font-bold dark:text-rose-300'},
  corrected:{panel:'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30',label:'text-emerald-800 dark:text-emerald-200',mark:'text-emerald-800 font-bold dark:text-emerald-300'},
  improved:{panel:'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30',label:'text-blue-800 dark:text-blue-200',mark:'text-blue-800 font-bold dark:text-blue-300'},
  note:{panel:'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40',label:'text-slate-700 dark:text-slate-200',mark:'text-slate-600 italic dark:text-slate-300'},
};
const tokens=(s:string)=>s.match(/\s+|[^\s]+/g)||[];
function changed(before:string,after:string){
  const a=tokens(before),b=tokens(after);
  // Keep a sentence comparison bounded even if someone pastes a whole essay into a row.
  if(a.length*b.length>40000)return {old:a.map(t=>!/^\s+$/.test(t)),new:b.map(t=>!/^\s+$/.test(t))};
  const d=Array.from({length:a.length+1},()=>new Uint16Array(b.length+1));
  for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)d[i][j]=a[i]===b[j]?d[i+1][j+1]+1:Math.max(d[i+1][j],d[i][j+1]);
  const old=a.map(t=>!/^\s+$/.test(t)),fresh=b.map(t=>!/^\s+$/.test(t));
  let i=0,j=0;
  while(i<a.length&&j<b.length){if(a[i]===b[j]){old[i]=false;fresh[j]=false;i++;j++;}else if(d[i+1][j]>=d[i][j+1])i++;else j++;}
  return {old,new:fresh};
}
function Highlight({text,mask,mark}:{text:string;mask:boolean[];mark:string}){return <span className="whitespace-pre-wrap">{tokens(text).map((t,i)=>mask[i]?<span key={i} className={mark}>{t}</span>:<span key={i}>{t}</span>)}</span>}
const empty=():WritingComparison=>({original:'',corrected:'',improved:'',note:''});
function sentences(text:string){
  if(!text.trim())return [];
  if(typeof Intl.Segmenter==='function')return [...new Intl.Segmenter('en',{granularity:'sentence'}).segment(text)].map(part=>part.segment.trim()).filter(Boolean);
  return (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[]).map(part=>part.trim()).filter(Boolean);
}
function fullSentenceRows(original:string,corrected:string,comparisons:WritingComparison[]){
  const normal=(text:string)=>text.toLowerCase().replace(/[‘’]/g,"'").replace(/\s+/g,' ').trim();
  const before=sentences(original),after=sentences(corrected);
  if(!before.length||before.length!==after.length)return null;
  return before.map((sentence,index)=>{
    const fixed=after[index];
    const matches=comparisons.filter(row=>{
      const phrase=normal(row.original),replacement=normal(row.corrected);
      return phrase.length>=6&&normal(sentence).includes(phrase)||replacement.length>=6&&normal(fixed).includes(replacement);
    });
    const specific=matches.map(row=>row.note.trim()).filter(Boolean).join(' ');
    const unchanged=sentence===fixed;
    const signpost=/^(first|second|however|furthermore|in addition|in conclusion)\b/i.test(sentence);
    return {original:sentence,corrected:fixed,improved:matches.find(row=>row.original.trim()===sentence&&row.improved.trim())?.improved||'',note:specific|| (unchanged?(signpost?'Good as written — the linking phrase helps your reader follow the argument.':'Good as written — the idea is clear and no language correction is needed.'):'The full corrected sentence is shown here. Rory can add a more specific explanation.'),unchanged};
  });
}

export function ComparisonFields({rows,onChange}:{rows:WritingComparison[];onChange:(rows:WritingComparison[])=>void}){
  const update=(index:number,key:keyof WritingComparison,value:string)=>onChange(rows.map((r,i)=>i===index?{...r,[key]:value}:r));
  return <div className="space-y-3"><p className="text-xs text-navy-soft dark:text-navy-mist">Use complete sentences in each row, including correct sentences worth praising. Explain briefly why a sentence works or why a change helps. The app highlights only the changed words.</p>{rows.map((row,i)=><div key={i} className="rounded-xl border border-black/10 p-3 dark:border-white/15"><div className="flex items-center justify-between"><strong className="text-sm">Sentence {i+1}</strong><button type="button" className="text-sm font-semibold text-rose-700 dark:text-rose-300" onClick={()=>onChange(rows.filter((_,n)=>n!==i))}>Remove</button></div><div className="mt-2 grid gap-2 md:grid-cols-2">{(['original','corrected','improved','note'] as const).map(key=><label key={key} className="text-xs font-semibold capitalize">{key==='note'?'Why this helps':key}<textarea className="mt-1 w-full rounded-lg border border-black/15 bg-white p-2 text-sm font-normal text-navy dark:border-white/15 dark:bg-navy dark:text-cream" rows={2} maxLength={1200} value={row[key]} onChange={e=>update(i,key,e.target.value)}/></label>)}</div></div>)}<button type="button" className="rounded-xl border border-indigo-300 px-3 py-2 text-sm font-semibold dark:border-indigo-500" onClick={()=>onChange([...rows,empty()])}>Add a sentence</button></div>;
}

export default function WritingAnalysis({record,code,teacher,onSaved}:{record:LearningRecord;code:string;teacher:boolean;onSaved:()=>Promise<void>}){
  const w=record.body.writing;
  const existing=w?.comparisons||w?.corrections?.map(c=>({...c,improved:''}))||[];
  const complete=w?.original&&w?.corrected?fullSentenceRows(w.original,w.corrected,existing):null;
  const [rows,setRows]=useState<WritingComparison[]>(existing);
  const [busy,setBusy]=useState(false),[status,setStatus]=useState('');
  if(!w)return null;
  const save=async()=>{setBusy(true);setStatus('');const cleaned=rows.map(r=>({original:r.original.trim(),corrected:r.corrected.trim(),improved:r.improved.trim(),note:r.note.trim()})).filter(r=>r.original||r.corrected||r.improved||r.note);
    const result=await saveLearning(code,{id:record.id,date:record.date,kind:record.kind,title:record.title,visibility:record.visibility,body:{...record.body,writing:{...w,comparisons:cleaned}}});setBusy(false);
    if(result.ok){setStatus('Sentence comparisons saved.');await onSaved();}else setStatus(result.error||'Could not save the comparisons.');
  };
  return <details className="mt-4 rounded-xl border border-black/10 p-3 dark:border-white/15"><summary className="cursor-pointer font-semibold">Writing analysis and practice</summary><div className="mt-3 space-y-4 text-sm">
    <p className="text-xs text-navy-soft dark:text-navy-mist"><strong className={colors.original.label}>Red</strong> shows original wording to change; <strong className={colors.corrected.label}>green</strong> shows corrections; <strong className={colors.improved.label}>blue</strong> shows stronger optional wording. The comments explain why.</p>
    {(complete||existing.length>0)&&<section><h4 className="font-bold">Sentence by sentence</h4><p className="mt-1 text-xs text-navy-soft dark:text-navy-mist">{complete?'Every original sentence appears in order. Unchanged sentences are recognised too.':'Only selected changes are available for this review; Rory can add the full original and corrected versions.'}</p><div className="mt-2 space-y-2">{(complete||existing).map((row,i)=>{const first=changed(row.original,row.corrected),second=changed(row.corrected,row.improved||row.corrected);return <div key={i} className="grid overflow-hidden rounded-xl border border-black/10 dark:border-white/10 md:grid-cols-4">{(['original','corrected','improved','note'] as const).map(key=>{const value=row[key],theme=colors[key];return <div key={key} className={`border-b p-3 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0 ${theme.panel}`}><h5 className={`mb-1 text-xs font-bold uppercase tracking-wide ${theme.label}`}>{key==='note'?'Comment':key==='corrected'&&'unchanged' in row&&row.unchanged?'Good as written':`${key} · ${i+1}`}</h5><p className={key==='note'?theme.mark:''}>{key==='original'?<Highlight text={value} mask={first.old} mark={theme.mark}/>:key==='corrected'?<Highlight text={value} mask={first.new} mark={theme.mark}/>:key==='improved'?value?<Highlight text={value} mask={second.new} mark={theme.mark}/>:'—':value||'—'}</p></div>})}</div>})}</div></section>}
    {(w.original||w.corrected||w.model)&&<details><summary className="cursor-pointer font-semibold">Read the full versions</summary><div className="mt-2 grid gap-3 lg:grid-cols-3">{w.original&&<section className={`rounded-xl border p-3 ${colors.original.panel}`}><h4 className={`font-bold ${colors.original.label}`}>Original</h4><p className="mt-1 whitespace-pre-wrap">{w.original}</p></section>}{w.corrected&&<section className={`rounded-xl border p-3 ${colors.corrected.panel}`}><h4 className={`font-bold ${colors.corrected.label}`}>Corrected wording</h4><p className="mt-1 whitespace-pre-wrap">{w.corrected}</p></section>}{w.model&&<section className={`rounded-xl border p-3 ${colors.improved.panel}`}><h4 className={`font-bold ${colors.improved.label}`}>A more developed model</h4><p className="mt-1 whitespace-pre-wrap">{w.model}</p></section>}</div></details>}
    {!!w.practice?.length&&<section><h4 className="font-bold">Try these yourself</h4><ol className="ml-5 mt-1 list-decimal space-y-1">{w.practice.map((x,i)=><li key={i}>{x}</li>)}</ol></section>}
    {teacher&&<details className="rounded-xl border border-indigo-200 p-3 dark:border-indigo-800"><summary className="cursor-pointer font-semibold">Edit sentence comparisons</summary><div className="mt-3"><ComparisonFields rows={rows} onChange={setRows}/><button type="button" className="mt-3 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40" disabled={busy} onClick={()=>void save()}>{busy?'Saving…':'Save comparisons'}</button>{status&&<p role="status" className="mt-2 text-sm">{status}</p>}</div></details>}
  </div></details>;
}
