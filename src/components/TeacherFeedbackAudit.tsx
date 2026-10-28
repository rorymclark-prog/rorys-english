"use client";
import {useState} from 'react';
import {documentRequest} from '@/lib/documents';
type Item={id:string;title?:string;type?:string;feedback:boolean;detailed?:boolean};
type Audit={documents:Item[];speaking:Item[];submissions:Item[];replies:Item[]};
export default function TeacherFeedbackAudit({code}:{code:string}){
 const [audit,setAudit]=useState<Audit|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function refresh(){setBusy(true);setError('');try{const r=await documentRequest(code,true,{action:'teacherFeedbackAudit'}) as Awaited<ReturnType<typeof documentRequest>>&Audit;if(r.ok)setAudit(r);else setError(r.error||'Could not check feedback coverage.');}finally{setBusy(false);}}
 const documents=audit?.documents.filter(d=>d.type!=='conversation'&&d.type!=='recording')||[],missing=documents.filter(d=>!d.feedback||!d.detailed);
 return <details className="doc-transcript"><summary>Feedback coverage · private audit</summary><p className="doc-muted">Check uploaded answers, saved conversations, submitted tasks and revisions. Completion logs and task instructions are separate from submitted English.</p><button className="doc-secondary" disabled={busy} onClick={()=>void refresh()}>{busy?'Checking…':audit?'Check again':'Audit saved work'}</button>{error&&<p role="alert">{error}</p>}{audit&&<><ul className="mt-3">{([['Uploaded answers',documents],['Saved conversations',audit.speaking],['Task submissions',audit.submissions],['Answers & revisions',audit.replies]] as [string,Item[]][]).map(([label,items])=><li key={label}>{label}: {items.filter(i=>i.feedback).length} / {items.length} have feedback</li>)}</ul>{missing.length>0&&<div className="doc-reading-note"><h4>Detailed reviews to prepare</h4>{missing.map(d=><p key={d.id}><a className="doc-link" href={`/teacher/?student=${encodeURIComponent(code)}&section=documents&document=${encodeURIComponent(d.id)}`}>{d.title||'Open saved work'}</a></p>)}</div>}{!missing.length&&<p className="mt-3">Every uploaded answer has a detailed review. A ready review remains separate from your private check.</p>}</>}</details>;
}
