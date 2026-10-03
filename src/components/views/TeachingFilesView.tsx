"use client";
import {useEffect,useState} from 'react';
import {getLearning,type LearningRecord} from '@/lib/learning';
import {teachingFiles} from '@/lib/teaching-files';
export default function TeachingFilesView({code,name}:{code:string;name:string}){
 const [records,setRecords]=useState<LearningRecord[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let live=true;setLoading(true);setError('');getLearning(code,true).then(r=>{if(!live)return;if(r.ok)setRecords(r.records||[]);else setError(r.error||'Could not open teaching files.');setLoading(false);});return()=>{live=false;};},[code]);
 const packs=records.filter(r=>teachingFiles(r).length);
 return <section className="mt-5 space-y-4"><header className="rounded-2xl bg-white p-5 shadow-soft dark:bg-navy"><h2 className="display text-2xl">{name}’s teaching files</h2><p className="mt-2 text-sm text-navy-soft dark:text-navy-mist">Your PowerPoints, printable notes and preparation briefs. Private to Rory.</p></header>
 {loading?<p>Opening teaching files…</p>:error?<p role="alert">{error}</p>:!packs.length?<p className="rounded-2xl bg-white p-5 dark:bg-navy">No teaching packs saved yet.</p>:packs.map(r=><article key={r.id} className="rounded-2xl bg-white p-5 shadow-soft dark:bg-navy"><p className="text-sm text-navy-soft dark:text-navy-mist">{r.date} · Private preparation</p><h3 className="mt-1 text-lg font-bold">{r.title}</h3>{r.body.summary&&<p className="mt-2 text-sm">{r.body.summary}</p>}<ul className="mt-4 space-y-3">{teachingFiles(r).map(f=><li key={f.url}><a className="font-semibold underline underline-offset-4" href={f.url} target="_blank" rel="noopener noreferrer">{f.label} ↗</a></li>)}</ul><p className="mt-4 text-xs text-navy-soft dark:text-navy-mist">Open the PowerPoint in Slide Show to use answer reveals. Use your Rory Google account for these private files.</p></article>)}
 </section>;
}
