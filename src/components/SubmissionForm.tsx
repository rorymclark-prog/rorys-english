"use client";
import {useEffect,useState} from "react";
import {isStudentPreview} from "@/lib/student-preview";
import {deliver,outbox,type PendingEvent} from "@/lib/sync";
import {fetchSubmissions,type Submission} from "@/lib/remote";
import FeedbackText from "@/components/FeedbackText";
import HandwrittenAnswer from "@/components/HandwrittenAnswer";
import AnswerWithPhotos from "@/components/AnswerWithPhotos";
import {handwritingParts} from "@/lib/handwritten-answer";
import ReviewTiming from "@/components/ReviewTiming";
import {useReviewRefresh} from "@/lib/use-review-refresh";
export interface AnswerField {id:string;prompt:string;type?:string}
export default function SubmissionForm({code,unit,task,title,fields,initialAnswers={},onSaved}:{code:string;unit:string;task:string;title?:string;fields:AnswerField[];initialAnswers?:Record<string,string>;onSaved?:(answers:Record<string,string>)=>void}) {
  const preview=isStudentPreview(code);
  const key=`re_draft_v2_${code}_${unit}_${task}`;
  const [answers,setAnswers]=useState<Record<string,string>>({});
  const [history,setHistory]=useState<Submission[]>([]);
  const [pending,setPending]=useState<PendingEvent|null>(null);
  const [busy,setBusy]=useState(false);
  const [photoBusy,setPhotoBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [ready,setReady]=useState(false);
  async function refresh() {
    const r=await fetchSubmissions(code);
    if(r.ok) setHistory((r.submissions||[]).filter(s=>s.unit===unit && s.task===task).reverse());
    else setMessage(r.error||"Could not load feedback. Your draft is still here.");
  }
  useEffect(()=>{
    try {
      setAnswers(JSON.parse(localStorage.getItem(key)||"null")||initialAnswers);
      setPending(outbox(code).find(e=>e.action==="submit" && e.unit===unit && e.task===task)||null);
    } catch {setMessage("Draft storage is unavailable. Copy your work before closing this page.");}
    setReady(true);void refresh();
    const update=()=>{
      const next=outbox(code).find(e=>e.action==="submit" && e.unit===unit && e.task===task)||null;
      setPending(next); if(!next) void refresh();
    };
    window.addEventListener("re-sync-change",update);
    return()=>window.removeEventListener("re-sync-change",update);
  // Initial legacy answers are read only when opening this task.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[key,code,unit,task]);
  function edit(id:string,value:string) {
    if(preview)return;
    const next={...answers,[id]:value};setAnswers(next);setMessage("");
    try {localStorage.setItem(key,JSON.stringify(next));onSaved?.(next);}
    catch {setMessage("Could not save on this device. Copy your answer before leaving.");}
  }
  async function submit() {
    if(preview)return;
    setBusy(true);setMessage("");
    const event=pending||{action:"submit",id:crypto.randomUUID(),code,unit,task,title:title||task,prompts:Object.fromEntries(fields.map(f=>[f.id,f.prompt])),answers:{...answers}};
    const r=await deliver(event);setBusy(false);
    setPending(outbox(code).find(e=>e.id===event.id)||null);
    if(r.ok) {setMessage("Received by Rory — waiting for review.");void refresh();}
    else setMessage(r.error||"Saved here, but not received yet. Retry when connected.");
  }
  const last=history[0];
  useReviewRefresh(()=>void refresh(),history.map(s=>s.feedbackAvailableAt));
  const unchanged=last && JSON.stringify(last.answers)===JSON.stringify(answers);
  return <div className="space-y-4">
    {fields.map(f=><label key={f.id} className="block rounded-card bg-surface p-4 shadow-card dark:bg-navy-raised">
      <span className="mb-2 block font-semibold"><FeedbackText text={f.prompt}/></span>
      {f.type==="voice" && <span className="mb-2 block text-sm">This box submits your note, not an audio file. A Speaking studio rehearsal stays on your device. Send a recording privately only if the task asks you to.</span>}
      {f.type==="checkbox" && <span className="mb-2 block text-sm">Tell Rory what you practised or what you found difficult.</span>}
      <textarea aria-label={f.prompt} disabled={preview||!ready||!!pending||busy||photoBusy} value={answers[f.id]||""} onChange={e=>edit(f.id,e.target.value)} rows={f.type==="written"?5:2} maxLength={6000} className="w-full rounded-lg border border-slate-300 bg-transparent p-3 disabled:opacity-60"/>
    </label>)}
    <HandwrittenAnswer code={code} title={title||task} context={`Task: ${task} · Unit: ${unit}\n${fields.map(f=>f.prompt).join("\n")}`} disabled={preview||!ready||!!pending||busy||handwritingParts(answers.handwritten_work||"").documentIds.length>=6} onBusyChange={setPhotoBusy} onSaved={reference=>edit("handwritten_work",[answers.handwritten_work,reference].filter(Boolean).join("\n"))}/>
    {answers.handwritten_work&&<AnswerWithPhotos key={answers.handwritten_work} code={code} answer={answers.handwritten_work}/>}
    <p className="text-xs">Drafts stay on this device. Submitted copies and Rory’s feedback are saved privately to your progress record. Avoid personal details.</p>
    <ReviewTiming availableAt={last?.feedbackAvailableAt}/>
    {pending && <p role="status" className="rounded-xl bg-amber-soft p-3 text-navy">A saved copy is waiting to send. Retry it before making a revision.</p>}
    <button type="button" disabled={preview||!ready||busy||photoBusy||(!pending&&(!Object.values(answers).some(v=>v.trim())||!!unchanged))} onClick={()=>void submit()} className="min-h-12 w-full rounded-xl bg-indigo-700 p-3 font-bold text-white disabled:opacity-50">
      {preview?"Sending is disabled in teacher preview":busy?"Sending…":pending?"Retry saved submission":last?"Submit revision":"Send answers to Rory"}
    </button>
    {message && <p role="status" className="text-sm">{message}</p>}
    {last && <section className="rounded-card border border-indigo-200 p-4">
      <h3 className="font-bold">{last.status==="revision-needed"?"Your next revision":last.status==="reviewed"?"Reviewed by Rory":"Received — waiting for Rory’s review"}</h3>
      {last.feedback && <p className="mt-2 whitespace-pre-wrap"><FeedbackText text={last.feedback}/></p>}
      <p className="mt-2 text-xs">{last.submitted} · {history.length} submitted version{history.length===1?"":"s"}</p>
      <details className="mt-3"><summary>View last submitted copy</summary>{Object.entries(last.answers).map(([id,value])=><div key={id} className="mt-2"><AnswerWithPhotos code={code} answer={value}/></div>)}</details>
    </section>}
  </div>;
}
