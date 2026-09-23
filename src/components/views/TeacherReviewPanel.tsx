"use client";
import { useCallback, useEffect, useState } from "react";
import { createAccess, fetchResources, fetchSubmissions, publishResources, reviewSubmission, type Submission, type ResourceItem } from "@/lib/remote";
import { BookIcon, CheckSquareIcon, GearIcon } from "@/components/Icons";
import AnswerWithPhotos from "@/components/AnswerWithPhotos";

type Filter = "waiting" | "revision" | "all";
const statusLabel = (status:string) => status === "reviewed" ? "Feedback given" : status === "revision-needed" ? "Revision requested" : "Ready for feedback";

export default function TeacherReviewPanel({code}:{code:string}) {
  const [rows,setRows]=useState<Submission[]>([]),[message,setMessage]=useState("");
  const [loading,setLoading]=useState(true),[loadError,setLoadError]=useState("");
  const [filter,setFilter]=useState<Filter>("waiting");
  const [access,setAccess]=useState(""),[resources,setResources]=useState<ResourceItem[]>([]);
  const [name,setName]=useState(""),[url,setUrl]=useState("");
  const [resourcesLoaded,setResourcesLoaded]=useState(false),[publishing,setPublishing]=useState(false),[creating,setCreating]=useState(false);
  const refresh=useCallback(async()=>{
    setLoading(true);setLoadError("");
    const r=await fetchSubmissions(code);
    if(r.ok)setRows(r.submissions || []);else setLoadError(r.error || "Could not load submissions. Please try again.");
    setLoading(false);
  },[code]);
  useEffect(()=>{void refresh();let live=true;setResourcesLoaded(false);fetchResources(code).then(r=>{if(!live)return;if(r.ok){setResources(r.resources || []);setResourcesLoaded(true);}else setMessage(r.error || "Could not load approved resources. Reload before adding one.");});return()=>{live=false;};},[code,refresh]);
  const waiting=rows.filter(r=>r.status!=="reviewed"&&r.status!=="revision-needed");
  const revisions=rows.filter(r=>r.status==="revision-needed");
  const visible=filter==="waiting"?waiting:filter==="revision"?revisions:rows;
  return <section>
    <div className="teacher-review-header"><div><p className="teacher-eyebrow">THE LEARNING CONVERSATION</p><h2>Work & feedback</h2></div><button type="button" onClick={refresh} disabled={loading} className="teacher-quiet-button">{loading?"Loading…":"Refresh work"}</button></div>
    <div className="teacher-review-filters" aria-label="Filter student work">
      {([["waiting","To review",waiting.length],["revision","Revisions",revisions.length],["all","All work",rows.length]] as const).map(([id,label,count])=><button key={id} type="button" aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}{!loading&&!loadError?` · ${count}`:""}</button>)}
    </div>
    {loadError?<div className="teacher-empty" role="alert"><p>{loadError}</p><button type="button" className="teacher-primary" onClick={refresh}>Try again</button></div>:loading?<div className="teacher-empty" role="status"><BookIcon/><p>Opening this student’s work…</p></div>:visible.length===0?<div className="teacher-empty"><CheckSquareIcon/><h3>{filter==="waiting"?"Nothing waiting for feedback":filter==="revision"?"No revisions requested":"The first page is still to come"}</h3><p>{rows.length===0?"When this student sends their answers, they’ll appear here for you to read and respond.":filter==="waiting"?"See All work to revisit answers and feedback you’ve already given.":"Revisions you request will appear here."}</p></div>:visible.slice().reverse().map(row=><Review key={row.id} row={row} code={code} onSaved={refresh}/>)}
    <div className="teacher-management">
      <details><summary><BookIcon/>Student materials<span>Share a useful resource</span></summary>
        <p className="teacher-section-intro">Add student-safe Google Drive files. Check that this student can open each file in Drive before sharing it here.</p>
        {resources.length>0&&<ul className="mb-4 space-y-2">{resources.map(r=><li key={r.url}><a href={r.url} target="_blank" rel="noopener noreferrer" className="underline">{r.name} ↗</a></li>)}</ul>}
        <label className="mb-3 block text-sm font-semibold">Resource title<input value={name} onChange={e=>setName(e.target.value)} className="mt-2 block w-full"/></label>
        <label className="mb-3 block text-sm font-semibold">Google Drive link<input type="url" value={url} onChange={e=>setUrl(e.target.value)} className="mt-2 block w-full"/></label>
        <button type="button" disabled={publishing||!resourcesLoaded||!name.trim()||!url.trim()} className="teacher-primary disabled:opacity-40" onClick={async()=>{setPublishing(true);const next=[...resources,{name:name.trim(),url:url.trim(),type:"",modified:""}];const r=await publishResources(code,next);setPublishing(false);setMessage(r.ok?"Added to student materials.":r.error || "Could not publish");if(r.ok){setResources(next);setName("");setUrl("");}}}>{publishing?"Adding…":"Add student resource"}</button>
      </details>
      <details><summary><GearIcon/>Access settings<span>Manage fallback codes</span></summary>
        <p className="teacher-section-intro">Students can use their email and their own password. Only replace a fallback code when needed: this ends existing code-based sessions.</p>
        {[false,true].map(parent=><button type="button" disabled={creating} key={String(parent)} className="teacher-quiet-button mr-2 border disabled:opacity-40" onClick={async()=>{if(!confirm(`Replace this ${parent?"parent":"student"} access code? Existing sessions will end.`))return;setCreating(true);const r=await createAccess(code,parent);setCreating(false);setAccess(r.access || "");setMessage(r.ok?"New code created. Copy it now and share privately.":r.error || "Could not create access");}}>{parent?"Replace parent code":"Replace student code"}</button>)}
        {access && <div className="mt-4"><label htmlFor="new-access">New access code (shown here only)</label><input id="new-access" readOnly value={access} className="my-2 w-full"/><button type="button" onClick={()=>setAccess("")} className="teacher-quiet-button">Hide code</button></div>}
      </details>
    </div>
    <p role="status" className="mt-3 text-sm">{message}</p>
  </section>;
}
function Review({row,code,onSaved}:{row:Submission;code:string;onSaved:()=>void}) {
  const [feedback,setFeedback]=useState(row.feedback),[message,setMessage]=useState("");
  const [saving,setSaving]=useState(false);
  return <article className="teacher-review-item space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-bold">{row.title||row.task}</h3><span className="teacher-status" data-status={row.status}>{statusLabel(row.status)}</span></div>
    <p className="text-xs text-navy-soft dark:text-navy-mist">{row.unit} · Sent {row.submitted}</p>
    {Object.entries(row.answers).map(([prompt,answer])=><div key={prompt} className="teacher-answer"><p>{row.prompts?.[prompt]||(prompt==="handwritten_work"?"Handwritten answer":prompt)}</p><AnswerWithPhotos answer={answer} code={code} teacher/></div>)}
    <label className="block text-sm font-bold">Your feedback<textarea value={feedback} onChange={e=>setFeedback(e.target.value)} className="mt-2 w-full font-normal" rows={4} maxLength={2000} placeholder="What went well? What could they try next?"/><span className="mt-1 block text-xs font-normal">Key instruction words are highlighted for the student. Add **double stars** around any other short phrase you want to highlight.</span></label>
    <div className="flex flex-wrap gap-2">{['reviewed','revision-needed'].map(status=><button type="button" disabled={saving} key={status} className={status==='reviewed'?"teacher-primary disabled:opacity-50":"teacher-quiet-button border disabled:opacity-50"} onClick={async()=>{setSaving(true);const r=await reviewSubmission(code,row.id,status,feedback);setSaving(false);setMessage(r.ok?"Feedback saved.":r.error || "Could not save");if(r.ok)onSaved();}}>{saving?"Saving…":status==='reviewed'?'Save feedback · reviewed':'Ask for a revision'}</button>)}</div>
    <p role="status" className="text-sm">{message}</p>
  </article>;
}
