"use client";
import {useState} from 'react';
import {saveLearning,type LearningRecord,type WritingComparison} from '@/lib/learning';
import {sentenceReview} from '@/lib/writing-review';

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

export function ComparisonFields({rows,onChange}:{rows:WritingComparison[];onChange:(rows:WritingComparison[])=>void}){
  const update=(index:number,key:keyof WritingComparison,value:string)=>onChange(rows.map((r,i)=>i===index?{...r,[key]:value}:r));
  return <div className="space-y-3"><p className="text-xs text-navy-soft dark:text-navy-mist">Include every original sentence in order, even when it is already correct. Repeat correct wording in the corrected field; leave it blank only if it still needs review. Improvements are optional, not corrections. Explain briefly why each sentence works or why a change helps.</p>{rows.map((row,i)=><div key={i} className="rounded-xl border border-black/10 p-3 dark:border-white/15"><div className="flex items-center justify-between"><strong className="text-sm">Sentence {i+1}</strong><button type="button" className="text-sm font-semibold text-rose-700 dark:text-rose-300" onClick={()=>onChange(rows.filter((_,n)=>n!==i))}>Remove</button></div><div className="mt-2 grid gap-2 md:grid-cols-2">{(['original','corrected','improved','note'] as const).map(key=><label key={key} className="text-xs font-semibold capitalize">{key==='note'?'Why this helps':key}<textarea className="mt-1 w-full rounded-lg border border-black/15 bg-white p-2 text-sm font-normal text-navy dark:border-white/15 dark:bg-navy dark:text-cream" rows={2} maxLength={1200} value={row[key]} onChange={e=>update(i,key,e.target.value)}/></label>)}</div></div>)}<button type="button" className="rounded-xl border border-indigo-300 px-3 py-2 text-sm font-semibold dark:border-indigo-500" onClick={()=>onChange([...rows,empty()])}>Add a sentence</button></div>;
}

export default function WritingAnalysis({record,code,teacher,onSaved}:{record:LearningRecord;code:string;teacher:boolean;onSaved:()=>Promise<void>}){
  const w=record.body.writing;
  const existing=w?.comparisons||w?.corrections?.map(c=>({...c,improved:''}))||[];
  const review=sentenceReview(w||{});
  const editable=(source:ReturnType<typeof sentenceReview>)=>source.rows.filter(row=>row.status!=='source-note').map(({original,corrected,improved,note})=>({original,corrected,improved,note}));
  const [rows,setRows]=useState<WritingComparison[]>(review.hasOriginal?editable(review):existing);
  const [original,setOriginal]=useState(w?.original||''),[corrected,setCorrected]=useState(w?.corrected||'');
  const [busy,setBusy]=useState(false),[status,setStatus]=useState('');
  if(!w)return null;
  const save=async()=>{if(busy)return;setBusy(true);setStatus('');const cleaned=rows.map(r=>({original:r.original.trim(),corrected:r.corrected.trim(),improved:r.improved.trim(),note:r.note.trim()})).filter(r=>r.original||r.corrected||r.improved||r.note);
    try {const result=await saveLearning(code,{id:record.id,date:record.date,kind:record.kind,title:record.title,visibility:record.visibility,body:{...record.body,writing:{...w,original,corrected,comparisons:cleaned}}});
      if(result.ok){setStatus('Sentence comparisons saved.');await onSaved();}else setStatus(result.error||'Could not save the comparisons.');
    }catch{setStatus('Could not confirm the save. Your edits are still here.');}finally{setBusy(false);}
  };
  return <details className="mt-4 rounded-xl border border-black/10 p-3 dark:border-white/15"><summary className="cursor-pointer font-semibold">Writing analysis and practice</summary><div className="mt-3 space-y-4 text-sm">
    <p className="text-xs text-navy-soft dark:text-navy-mist"><strong className={colors.original.label}>Red</strong> shows original wording to change; <strong className={colors.corrected.label}>green</strong> shows corrections; <strong className={colors.improved.label}>blue</strong> shows stronger optional wording. The comments explain why.</p>
    <section><h4 className="font-bold">Sentence by sentence</h4><p className="mt-1 text-xs text-navy-soft dark:text-navy-mist">{review.hasOriginal?`Every original sentence appears in full and in order, including sentences that are already correct.${review.pending?` ${review.pending} still need a complete correction or confirmation.`:''}`:'The full original text is needed for a complete sentence-by-sentence review. Saved extracts alone do not show which other sentences are correct.'}</p><div className="mt-3 space-y-4">{review.rows.map((row,i)=>{
      if(row.status==='source-note')return <aside key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><strong className="text-xs uppercase">Source note · not assessed</strong><p className="mt-1 whitespace-pre-wrap">{row.original}</p><p className="mt-1 text-xs">{row.note}</p></aside>;
      const first=changed(row.original,row.corrected||row.original),second=changed(row.corrected,row.improved||row.corrected);
      return <article key={i} className="overflow-hidden rounded-xl border border-black/10 dark:border-white/10" aria-label={`Sentence ${row.number}`}><header className="flex flex-wrap items-center gap-2 border-b border-black/10 px-3 py-2 dark:border-white/10"><h5 className="font-bold">Sentence {row.number}</h5><span className="text-xs">{row.status==='unchanged'?'Already correct':row.status==='pending'?'Needs review':'Correction shown'}</span></header><div className="grid lg:grid-cols-3">{(['original','corrected','improved'] as const).map(key=>{const value=row[key],theme=colors[key];return <section key={key} className={`min-w-0 break-words border-b p-3 lg:border-r lg:last:border-r-0 ${theme.panel}`}><h6 className={`mb-2 text-xs font-bold uppercase tracking-wide ${theme.label}`}>{key==='improved'?'Optional improvement':key}</h6><p>{key==='original'?<Highlight text={value} mask={first.old} mark={theme.mark}/>:key==='corrected'?value?<Highlight text={value} mask={first.new} mark={theme.mark}/>:'Full correction not yet saved.':value?<Highlight text={value} mask={second.new} mark={theme.mark}/>:'No optional rewrite added.'}</p></section>})}</div><section className={`p-3 ${colors.note.panel}`}><h6 className={`mb-1 text-xs font-bold uppercase tracking-wide ${colors.note.label}`}>Why / what works</h6><p className={`whitespace-pre-wrap ${colors.note.mark}`}>{row.note}</p></section></article>;
    })}</div></section>
    {!review.hasOriginal&&existing.length>0&&<details><summary className="cursor-pointer font-semibold">Saved extracts · incomplete review</summary><ul className="mt-2 space-y-2">{existing.map((row,i)=><li key={i}><p>{row.original} → {row.corrected}</p><p>{row.note}</p></li>)}</ul></details>}
    {(w.original||w.corrected||w.model)&&<details><summary className="cursor-pointer font-semibold">Read the full versions</summary><div className="mt-2 grid gap-3 lg:grid-cols-3">{w.original&&<section className={`rounded-xl border p-3 ${colors.original.panel}`}><h4 className={`font-bold ${colors.original.label}`}>Original</h4><p className="mt-1 whitespace-pre-wrap">{w.original}</p></section>}{w.corrected&&<section className={`rounded-xl border p-3 ${colors.corrected.panel}`}><h4 className={`font-bold ${colors.corrected.label}`}>Corrected wording</h4><p className="mt-1 whitespace-pre-wrap">{w.corrected}</p></section>}{w.model&&<section className={`rounded-xl border p-3 ${colors.improved.panel}`}><h4 className={`font-bold ${colors.improved.label}`}>A more developed model</h4><p className="mt-1 whitespace-pre-wrap">{w.model}</p></section>}</div></details>}
    {!!w.practice?.length&&<section><h4 className="font-bold">Try these yourself</h4><ol className="ml-5 mt-1 list-decimal space-y-1">{w.practice.map((x,i)=><li key={i}>{x}</li>)}</ol></section>}
    {teacher&&<details className="rounded-xl border border-indigo-200 p-3 dark:border-indigo-800"><summary className="cursor-pointer font-semibold">Edit sentence comparisons</summary><fieldset className="mt-3 space-y-3" disabled={busy}><label className="block text-sm font-semibold">Full original text<textarea className="mt-1 w-full rounded-lg border bg-transparent p-2 font-normal" rows={6} maxLength={12000} value={original} onChange={e=>setOriginal(e.target.value)}/></label><label className="block text-sm font-semibold">Full corrected text<textarea className="mt-1 w-full rounded-lg border bg-transparent p-2 font-normal" rows={6} maxLength={12000} value={corrected} onChange={e=>setCorrected(e.target.value)}/></label><p className="text-xs">After changing the full text, rebuild the rows, then check each sentence before saving.</p><button type="button" className="rounded-xl border border-indigo-300 px-3 py-2 text-sm font-semibold" disabled={!original.trim()} onClick={()=>setRows(editable(sentenceReview({original,corrected,comparisons:rows},{preferComparisons:false})))}>Build rows for every sentence</button><ComparisonFields rows={rows} onChange={setRows}/><button type="button" className="mt-3 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40" disabled={busy||!original.trim()} onClick={()=>void save()}>{busy?'Saving…':'Save comparisons'}</button>{status&&<p role="status" className="mt-2 text-sm">{status}</p>}</fieldset></details>}
  </div></details>;
}
