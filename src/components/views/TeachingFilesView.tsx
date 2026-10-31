"use client";
import {useEffect,useState,useRef} from 'react';
import '@/app/teacher/live-coach.css';
import CoachLibraryConnection,{type CoachCloudLesson} from '@/components/CoachLibraryConnection';
import {getLearning,type LearningRecord} from '@/lib/learning';
import {teachingFiles} from '@/lib/teaching-files';
export default function TeachingFilesView({code,name}:{code:string;name:string}){
 const [records,setRecords]=useState<LearningRecord[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let live=true;setLoading(true);setError('');getLearning(code,true).then(r=>{if(!live)return;if(r.ok)setRecords(r.records||[]);else setError(r.error||'Could not open teaching files.');setLoading(false);});return()=>{live=false;};},[code,retry]);
 const [selection,setSelection]=useState<CoachCloudLesson|null>(null),[preview,setPreview]=useState<{url:string;name:string}|null>(null);
 const previewUrl=useRef('');
 const libraryPanel=useRef<HTMLDivElement>(null),notesHeading=useRef<HTMLHeadingElement>(null),previewHeading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{if(selection)notesHeading.current?.focus();},[selection]);
 useEffect(()=>{if(preview)previewHeading.current?.focus();},[preview]);
 useEffect(()=>{setSelection(null);setPreview(null);if(previewUrl.current)URL.revokeObjectURL(previewUrl.current);previewUrl.current='';return()=>{if(previewUrl.current)URL.revokeObjectURL(previewUrl.current);};},[code]);
 function openPdf(file:File){if(previewUrl.current)URL.revokeObjectURL(previewUrl.current);previewUrl.current=URL.createObjectURL(file);setPreview({url:previewUrl.current,name:file.name});}
 function download(file:File){const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),60000);}
 const studentId=name.toLowerCase().startsWith('ferdi')?'ferdi':name.toLowerCase().startsWith('valentin')?'valentin':undefined;
 const packs=records.filter(r=>teachingFiles(r).length);
 return <section className="live-coach mt-5 space-y-4"><header className="rounded-2xl bg-white p-5 shadow-soft dark:bg-navy"><h2 className="display text-2xl">{name}’s teaching materials</h2><p className="mt-2 text-sm text-navy-soft dark:text-navy-mist">Your PowerPoints, printable notes and preparation briefs. Private to Rory.</p></header>
 <div ref={libraryPanel} tabIndex={-1} className="rounded-2xl bg-white p-5 shadow-soft dark:bg-navy"><CoachLibraryConnection key={code} code={code} name={name} studentId={studentId} materials selectedId={selection?`cloud:${selection.packId}`:''} onSelect={setSelection} onOpenPdf={openPdf} onOpenPowerPoint={download}/></div>
 {selection&&<article className="rounded-2xl bg-white p-5 shadow-soft dark:bg-navy" aria-label="Current teacher notes"><h3 ref={notesHeading} tabIndex={-1} className="text-xl font-bold">{selection.title} - teacher notes</h3><p className="mt-2 text-sm">{selection.edition} · Private preparation. These materials do not record lesson completion.</p><button type="button" className="mt-3 underline" onClick={()=>libraryPanel.current?.focus()}>← Choose another lesson</button><pre className="mt-4 whitespace-pre-wrap break-words font-sans text-base leading-relaxed">{selection.teacherNotes&&!selection.notesHistorical?selection.teacherNotes:selection.guide}</pre></article>}
 {preview&&<section className="rounded-2xl bg-white p-5 shadow-soft dark:bg-navy" aria-label="Current slide preview"><h3 ref={previewHeading} tabIndex={-1} className="text-xl font-bold">{preview.name==='Teacher_Notes.pdf'?'Teacher guide':'Slide preview'}</h3><button type="button" className="mt-3 underline" onClick={()=>libraryPanel.current?.focus()}>← Choose another lesson</button><p className="my-3"><a className="underline" href={preview.url} download={preview.name}>Download PDF</a> · <a className="underline" href={preview.url} target="_blank" rel="noopener noreferrer">Open full screen</a></p><iframe title={preview.name==='Teacher_Notes.pdf'?'Current teacher guide':'Current lesson slide preview'} src={preview.url} className="h-[75dvh] w-full rounded-xl border"/></section>}
 <details className="rounded-2xl bg-white p-5 dark:bg-navy"><summary className="cursor-pointer font-bold">Earlier preparation records</summary>
 {loading?<p>Opening teaching files…</p>:error?<p role="alert">{error} <button type="button" className="underline" onClick={()=>setRetry(x=>x+1)}>Try again</button></p>:!packs.length?<p className="rounded-2xl bg-white p-5 dark:bg-navy">No teaching packs saved yet.</p>:packs.map(r=><article key={r.id} className="rounded-2xl bg-white p-5 shadow-soft dark:bg-navy"><p className="text-sm text-navy-soft dark:text-navy-mist">{r.date} · Private preparation</p><h3 className="mt-1 text-lg font-bold">{r.title}</h3>{r.body.summary&&<p className="mt-2 text-sm">{r.body.summary}</p>}<ul className="mt-4 space-y-3">{teachingFiles(r).map(f=><li key={f.url}><a className="font-semibold underline underline-offset-4" href={f.url} target="_blank" rel="noopener noreferrer">{f.label} ↗</a></li>)}</ul><p className="mt-4 text-xs text-navy-soft dark:text-navy-mist">Open the PowerPoint in Slide Show to use answer reveals. Use your Rory Google account for these private files.</p></article>)}
 </details></section>;
}
