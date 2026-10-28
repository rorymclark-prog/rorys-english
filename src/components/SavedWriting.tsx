"use client";
import {useCallback,useEffect,useState} from 'react';
import dynamic from 'next/dynamic';
import {documentRequest,type LearnerDocument} from '@/lib/documents';
import WorkTypeIcon from '@/components/WorkTypeIcon';
import {documentWorkType,documentTypeLabel,documentStatusLabel} from '@/lib/document-feedback';
import {documentMeta} from '@/lib/document-groups';
import {readWorkContext,workSources} from '@/lib/work-source';
import {savedWritingGroups,savedWorkDate} from '@/lib/saved-writing';
import {useReviewRefresh} from '@/lib/use-review-refresh';
const DocumentsView=dynamic(()=>import('@/components/views/DocumentsView'));
const dateLabel=(date:string)=>new Date(date.length===10?`${date}T12:00:00`:date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});

export default function SavedWriting({code,name,teacher=false,parent=false,reviewIds=[],onlyRoryFeedback=false}:{code:string;name:string;teacher?:boolean;parent?:boolean;reviewIds?:string[];onlyRoryFeedback?:boolean}){
  const [documents,setDocuments]=useState<LearnerDocument[]>([]),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[open,setOpen]=useState('');
  const refresh=useCallback(async()=>{try{const result=await documentRequest(code,teacher,{action:'documents'});if(result.ok){setDocuments(result.documents||[]);setError('');}else setError(result.error||'Could not load uploaded homework.');}catch{setError('Could not load uploaded homework.');}finally{setLoaded(true);}},[code,teacher]);
  useEffect(()=>{void refresh();},[refresh]);
  useReviewRefresh(()=>void refresh(),documents.map(d=>d.feedbackAvailableAt));
  const groups=savedWritingGroups(documents,reviewIds).filter(group=>!onlyRoryFeedback||group.items.some(item=>item.feedback&&!item.reviewPending));
  if(loaded&&!error&&!groups.length)return null;
  return <section className="saved-writing space-y-3" aria-label="Uploaded homework and writing">
    <header className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Uploaded homework & writing</h2><p className="text-sm text-navy-soft dark:text-navy-mist">Completed work, original pages and feedback on your answers.</p></div><button type="button" className="doc-link" onClick={()=>void refresh()}>Refresh uploads</button></header>
    {!loaded&&<p role="status">Opening uploaded homework…</p>}
    {error&&<p role="alert">{error}</p>}
    {groups.map(group=>{const d=group.root,source=readWorkContext(documentMeta(d.context).context).source;return <article key={d.id} className="rounded-card bg-surface p-5 shadow-card dark:bg-navy-raised dark:shadow-card-dark">
      <p className="text-xs font-semibold text-navy-soft dark:text-navy-mist">{workSources[source]} · {dateLabel(savedWorkDate(d))} · {documentTypeLabel(d)}</p><h3 className="mt-2 flex items-center gap-3 text-lg font-bold"><WorkTypeIcon type={documentWorkType(d)}/>{d.title}</h3>
      <p className="my-3 text-sm">{documentStatusLabel([...group.items].reverse().find(x=>documentMeta(x.context).role==='answer')||d)}{teacher&&group.items.some(x=>x.needsTeacherCheck)?' · ⚑ Check feedback':''} · {group.items.length>1?`${group.items.length} linked items`:`${d.files.length} ${d.files.length===1?'file':'pages'}`}</p>
      <button type="button" className="doc-secondary" aria-expanded={open===d.id} onClick={()=>{setOpen(open===d.id?'':d.id);if(open===d.id)void refresh();}}>{open===d.id?'Close homework':'Open homework & feedback'}</button>
      {open===d.id&&<DocumentsView code={code} name={name} teacher={teacher} parent={parent} documentId={d.id}/>}
    </article>})}
  </section>;
}
