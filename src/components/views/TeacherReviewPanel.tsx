"use client";
import { useEffect, useState } from "react";
import { createAccess, fetchResources, fetchSubmissions, publishResources, reviewSubmission, type Submission, type ResourceItem } from "@/lib/remote";

export default function TeacherReviewPanel({code}:{code:string}) {
  const [rows,setRows]=useState<Submission[]>([]),[message,setMessage]=useState("");
  const [access,setAccess]=useState(""),[resources,setResources]=useState<ResourceItem[]>([]);
  const [name,setName]=useState(""),[url,setUrl]=useState("");
  const [resourcesLoaded,setResourcesLoaded]=useState(false);
  const refresh=async()=>{const r=await fetchSubmissions(code);if(r.ok)setRows(r.submissions || []);else setMessage(r.error || "Could not load submissions");};
  useEffect(()=>{void refresh();setResourcesLoaded(false);fetchResources(code).then(r=>{if(r.ok){setResources(r.resources || []);setResourcesLoaded(true);}else setMessage(r.error || "Could not load approved resources. Reload before adding one.");});},[code]);
  return <section className="space-y-5 rounded-xl border p-4">
    <h2 className="text-xl font-bold">Work awaiting your feedback</h2>
    <button type="button" onClick={refresh} className="min-h-11 underline">Refresh submissions</button>
    {rows.length===0 && <p>No submissions received yet.</p>}
    {rows.slice().reverse().map(row=><Review key={row.id} row={row} code={code} onSaved={refresh}/>)}
    <h3 className="font-bold">Student access</h3>
    <p className="text-sm">Creating a new access code revokes the previous code and sessions. Share it privately with the intended recipient.</p>
    {[false,true].map(parent=><button type="button" key={String(parent)} className="mr-3 min-h-11 rounded-lg border p-2" onClick={async()=>{if(!confirm(`Replace this ${parent?"parent":"student"} access code? Existing sessions will end.`))return;const r=await createAccess(code,parent);setAccess(r.access || "");setMessage(r.ok?"New code created. Copy it now and share privately.":r.error || "Could not create access");}}>{parent?"New parent access code":"New student access code"}</button>)}
    {access && <div><label htmlFor="new-access">New access code (shown here only)</label><input id="new-access" readOnly value={access} className="my-2 w-full rounded border p-2 text-navy"/><button type="button" onClick={()=>setAccess("")} className="min-h-11 underline">Hide code</button></div>}
    <h3 className="font-bold">Approved student materials</h3>
    <p className="text-sm">Add only student-safe Google Drive files. Set access for the intended student in Drive yourself; this app never changes sharing.</p>
    <ul>{resources.map(r=><li key={r.url}><a href={r.url} target="_blank" rel="noopener noreferrer" className="underline">{r.name}</a></li>)}</ul>
    <label className="block">Resource title<input value={name} onChange={e=>setName(e.target.value)} className="block w-full rounded border p-2 text-navy"/></label>
    <label className="block">Google Drive link<input type="url" value={url} onChange={e=>setUrl(e.target.value)} className="block w-full rounded border p-2 text-navy"/></label>
    <button type="button" disabled={!resourcesLoaded||!name.trim()||!url.trim()} className="min-h-11 rounded-lg bg-indigo-700 p-3 text-white disabled:opacity-40" onClick={async()=>{const next=[...resources,{name:name.trim(),url:url.trim(),type:"",modified:""}];const r=await publishResources(code,next);setMessage(r.ok?"Added to approved materials.":r.error || "Could not publish");if(r.ok){setResources(next);setName("");setUrl("");}}}>Approve this resource</button>
    <p role="status">{message}</p>
  </section>;
}
function Review({row,code,onSaved}:{row:Submission;code:string;onSaved:()=>void}) {
  const [feedback,setFeedback]=useState(row.feedback),[message,setMessage]=useState("");
  return <article className="space-y-3 rounded-lg bg-black/5 p-4 dark:bg-white/5">
    <h3 className="font-bold">{row.title||row.task}</h3><p className="text-sm">{row.unit} · {row.status} · {row.submitted}</p>
    {Object.entries(row.answers).map(([prompt,answer])=><div key={prompt}><p className="text-sm font-bold">{row.prompts?.[prompt]||prompt}</p><p className="whitespace-pre-wrap">{answer}</p></div>)}
    <label className="block">Your feedback<textarea value={feedback} onChange={e=>setFeedback(e.target.value)} className="mt-2 w-full rounded border p-2 text-navy" rows={4} maxLength={2000}/></label>
    {['reviewed','revision-needed'].map(status=><button type="button" key={status} className="mr-2 min-h-11 rounded border p-2" onClick={async()=>{const r=await reviewSubmission(code,row.id,status,feedback);setMessage(r.ok?"Feedback saved.":r.error || "Could not save");if(r.ok)onSaved();}}>{status==='reviewed'?'Reviewed':'Ask for a revision'}</button>)}
    <p role="status">{message}</p>
  </article>;
}
