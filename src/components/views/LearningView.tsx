"use client";
import ConversationFeedback from "@/components/ConversationFeedback";
import WorkFeedback from "@/components/WorkFeedback";
import {documentRequest} from "@/lib/documents";
import StatusRow from "@/components/StatusRow";
import {LessonPracticeDetails,LessonPracticeEditor} from "@/components/LessonPractice";
import {readLessonPractice} from "@/lib/lesson-practice";
import {readLessonSnapshot} from '@/lib/lesson-assessment';
import LessonProgressSummary,{ApprovedLessonSummary} from '@/components/LessonProgressSummary';
import LessonAssessmentPanel from '@/components/LessonAssessmentPanel';
import LearningMemoryPanel from '@/components/LearningMemoryPanel';
import SavedWriting from '@/components/SavedWriting';
import {isTeachingPack} from '@/lib/teaching-files';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {getLearning,replyLearning,saveLearning,type LearningKind,type LearningRecord,type LearningReply,type WritingComparison} from '@/lib/learning';
import {isStudentPreview} from '@/lib/student-preview';
import FeedbackText from '@/components/FeedbackText';
import ConversationTranscript from '@/components/ConversationTranscript';
import PlainFeedback from '@/components/PlainFeedback';
import {readableDate} from '@/lib/clarity';
import {assessmentDisplayLabel,feedbackSource,matchesFeedbackFilter,focusedFeedbackFilter,type FeedbackFilter} from '@/lib/feedback-source';
import SpeakingAudioReview from './SpeakingAudioReview';
import WritingAnalysis,{ComparisonFields} from './WritingAnalysis';
import HandwrittenAnswer from '@/components/HandwrittenAnswer';
import {ringAnswerText} from '@/lib/practice-rings';
import AnswerWithPhotos from '@/components/AnswerWithPhotos';
import {handwritingParts,handwritingReference} from '@/lib/handwritten-answer';
import ReviewTiming from '@/components/ReviewTiming';
import {useReviewRefresh} from '@/lib/use-review-refresh';
import {useDurableDraft} from '@/lib/use-durable-draft';
import {emptyTeacherReview,teacherReviewPayload,learningReplyReceipt,teacherReviewReceipt,type TeacherReviewDraft} from '@/lib/learning-drafts';

const labels:Record<LearningKind,string>={homework:'Homework review',test:'Test preparation',speaking:'Speaking',lesson:'Lesson recap & notes'};
const kinds:LearningKind[]=['homework','test','speaking','lesson'];
const ratingLabels:Record<string,string>={fluency:'Flow',accuracy:'Grammar and vocabulary',organisation:'Development',interaction:'Interaction',intelligibility:'Intelligibility'};
const split=(s:string)=>s.split('\n').map(x=>x.trim()).filter(Boolean);
const join=(xs?:string[])=>xs?.join('\n')||'';
const box='w-full rounded-xl border border-black/10 bg-white p-3 text-sm text-navy outline-none focus:border-indigo-500 dark:border-white/15 dark:bg-navy dark:text-cream';
const card='rounded-card bg-surface p-5 shadow-card dark:bg-navy-raised dark:shadow-card-dark';
const button='rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40';
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Vienna'});

const filterLabels:Partial<Record<FeedbackFilter,string>>={all:'All feedback',recorded:'Recorded lessons',chat:'Conversations',homework:'Homework',test:'Tests',rory:'Rory’s feedback'};
export function chronologicalFeedback(records:LearningRecord[],filter:FeedbackFilter,linkedRecordId=''){
  return records.filter(record=>matchesFeedbackFilter(record,filter)||record.id===linkedRecordId)
    .slice().sort((a,b)=>b.date.localeCompare(a.date)||b.created.localeCompare(a.created)||a.id.localeCompare(b.id));
}
export function feedbackNextStep(record:LearningRecord):string{
  const body=record.body,practice=readLessonPractice(body.lessonPractice),snapshot=readLessonSnapshot(body.lessonSnapshot);
  const source=snapshot?.nextStep||body.plainReview?.nextStep||body.plainAiFeedback?.nextStep||body.nextStep||(practice?.status==='ready'?practice.focus[0]:'')||'';
  // The complete task stays in the expanded entry. A homepage-sized preview
  // must never repeat an entire writing brief or textbook passage above it.
  return source.length>280?source.slice(0,280).replace(/\s+\S*$/,'')+'…':source;
}

export default function LearningView({code,name,mode,initialFilter='all',showHeader=true,focusRecordId}:{code:string;name:string;mode:'student'|'parent'|'teacher';initialFilter?:FeedbackFilter;showHeader?:boolean;focusRecordId?:string}) {
  const [records,setRecords]=useState<LearningRecord[]>([]),[replies,setReplies]=useState<LearningReply[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [filter,setFilter]=useState<FeedbackFilter>(initialFilter),[linkedTarget,setLinkedTarget]=useState(''),[expanded,setExpanded]=useState<Record<string,boolean>>({});
  const focused=useRef(''),scrolled=useRef('');
  const disabled=mode==='parent'||isStudentPreview(code);
  const checkpoints=records.filter(r=>r.kind==='speaking'&&r.body.ratings&&Object.values(r.body.ratings).some(v=>v!=null)).sort((a,b)=>a.date.localeCompare(b.date));
  const refresh=useCallback(async()=>{const r=await getLearning(code,mode==='teacher');setLoading(false);if(r.ok){setRecords((r.records||[]).filter(record=>!isTeachingPack(record)&&record.id!=='teacher-dashboard-settings'&&!record.body.tutorPrivate?.goalPlan&&!record.body.tutorPrivate?.lessonBrief&&!record.body.tutorPrivate?.skillCheck&&!record.body.tutorPrivate?.progressObservation));setReplies(r.replies||[]);setError('');}else setError(r.error||'Could not open the learning record.');},[code,mode]);
  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{
    const readHash=()=>/^#(?:review|write)-/.test(window.location.hash)?window.location.hash.slice(1):'';
    setLinkedTarget(focusRecordId?`review-${focusRecordId}`:readHash());
    const onHash=()=>setLinkedTarget(readHash());
    window.addEventListener('hashchange',onHash);return()=>window.removeEventListener('hashchange',onHash);
  },[focusRecordId]);
  const linkedRecord=records.find(record=>linkedTarget===`review-${record.id}`||linkedTarget===`write-${record.id}`);
  const visibleRecords=chronologicalFeedback(records,filter,linkedRecord?.id);
  const overviewRecord=visibleRecords.find(record=>feedbackNextStep(record));
  useEffect(()=>{
    if(loading||!linkedRecord||!linkedTarget)return;
    if(focused.current!==linkedTarget){
      focused.current=linkedTarget;
      setFilter(focusedFeedbackFilter(linkedRecord));
      setExpanded(current=>({...current,[linkedRecord.id]:true}));
      return;
    }
    if(scrolled.current!==linkedTarget){const target=document.getElementById(linkedTarget);if(target){target.scrollIntoView({block:'start'});scrolled.current=linkedTarget;}}
  },[loading,linkedRecord,linkedTarget,filter,expanded]);
  useReviewRefresh(()=>void refresh(),[...records.map(r=>r.feedbackAvailableAt),...replies.map(r=>r.feedbackAvailableAt)]);
  return <div className="learning-record space-y-5 py-4 text-navy dark:text-cream">
    {showHeader&&<header className={card}><p className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-amber">FEEDBACK & PRACTICE</p><h2 className="display mt-1 text-2xl">{mode==='teacher'?`${name}'s reviews`:mode==='parent'?`${name}'s learning`:'Feedback and next steps'}</h2><p className="mt-2 text-sm text-navy-soft dark:text-navy-mist">Writing, speaking, lessons and school tests. Open an entry to see what worked and what to try next.</p></header>}
    <nav className="learning-filters refined-feedback-filters" aria-label="Filter learning records">{(['all','recorded','chat','homework','test','rory'] as const).map(key=><button key={key} type="button" aria-pressed={filter===key} onClick={()=>setFilter(key)}>{filterLabels[key]}</button>)}</nav>
    {mode==='teacher'&&<TeacherReviewComposer code={code} disabled={disabled} onSaved={refresh}/>}
    {error&&<StatusRow kind="error" onRetry={()=>void refresh()}>{error}</StatusRow>}{message&&<p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {!loading&&visibleRecords.length>0&&<section className="refined-feedback-overview" aria-label="Feedback overview"><div><p className="refined-feedback-kicker">{filterLabels[filter]||'Feedback'}</p><h3>{overviewRecord?'One useful next step':'Your saved feedback'}</h3><p className="refined-feedback-meta">{visibleRecords.length} saved {visibleRecords.length===1?'entry':'entries'} · latest {readableDate(visibleRecords[0].date)}</p></div>{overviewRecord?<div className="refined-feedback-next"><p><FeedbackText text={feedbackNextStep(overviewRecord)}/></p><a href={`#review-${overviewRecord.id}`} onClick={()=>setExpanded(current=>({...current,[overviewRecord.id]:true}))}>Open {assessmentDisplayLabel(overviewRecord.title)} <span aria-hidden="true">↗</span></a></div>:<p className="refined-feedback-meta">Open an entry to read its original work, feedback and saved practice.</p>}</section>}
    {linkedRecord&&!matchesFeedbackFilter(linkedRecord,filter)&&<p className="refined-feedback-linked" role="status">The entry opened from your link is also shown below.</p>}
    {loading?<p role="status">Opening the learning record…</p>:!visibleRecords.length?<p className={card}>No saved entries in this area yet. {filter==='all'?'Uploaded work appears below when available.':'Try All feedback to see your other work.'}</p>:<div className="refined-feedback-list">{visibleRecords.map(r=>{const origin=feedbackSource(r),b=r.body,w=b.writing,practice=readLessonPractice(b.lessonPractice),rs=replies.filter(x=>x.reviewId===r.id),snippet=b.plainReview?.summary||b.plainAiFeedback?.summary||b.summary;return <details key={r.id} id={`review-${r.id}`} className={`refined-feedback-entry learning-kind-${r.kind}`} open={!!expanded[r.id]} onToggle={event=>{if(event.target!==event.currentTarget)return;const open=event.currentTarget.open;setExpanded(current=>current[r.id]===open?current:{...current,[r.id]:open});}}>
      <summary className="refined-feedback-summary"><span className="refined-feedback-entry-heading"><span className="refined-feedback-entry-meta"><span>{origin?.label||labels[r.kind]}</span><time dateTime={r.date}>{readableDate(r.date)}</time>{r.visibility==='teacher'&&<span className="refined-feedback-private">Rory only</span>}</span><h3>{assessmentDisplayLabel(r.title)}</h3>{snippet&&<span className="refined-feedback-snippet">{assessmentDisplayLabel(snippet)}</span>}</span><span className="refined-feedback-open" aria-hidden="true">Read feedback <span>⌄</span></span></summary><div className="refined-feedback-body">{origin&&<div className="mt-3 rounded-xl border border-indigo-200 p-3 text-sm dark:border-indigo-800"><strong>{origin.label}</strong><p className="mt-1 text-xs">{origin.note}</p></div>}{b.plainReview&&<div className="mt-4"><PlainFeedback review={b.plainReview}/></div>}{!b.lessonSnapshot&&!b.plainReview&&!practice&&b.summary&&<p className="mt-2 whitespace-pre-wrap text-sm"><FeedbackText text={b.summary}/></p>}
      {b.lessonSnapshot&&<ApprovedLessonSummary value={b.lessonSnapshot}/>}
      {practice&&r.visibility==="shared"&&practice.status==="ready"&&<LessonPracticeDetails code={code} record={r} practice={practice} mode={mode}/>}
      {!b.plainReview&&(b.evidenceType||b.source)&&<p className="mt-2 text-xs text-navy-soft dark:text-navy-mist">{assessmentDisplayLabel(b.evidenceType)}{b.source&&!practice&&` · ${b.source}`}</p>}
      {!b.lessonSnapshot&&!b.plainReview&&!!b.strengths?.length&&<div className="mt-4"><h4 className="font-semibold">What went well</h4><ul className="ml-5 list-disc text-sm">{b.strengths.map((x,i)=><li key={i}><FeedbackText text={x}/></li>)}</ul></div>}
      {!b.lessonSnapshot&&!b.plainReview&&!!b.targets?.length&&<div className="mt-4"><h4 className="font-semibold">What to practise next</h4><ul className="ml-5 list-disc text-sm">{b.targets.map((x,i)=><li key={i}><FeedbackText text={x}/></li>)}</ul></div>}
      {!b.lessonSnapshot&&!b.plainReview&&b.nextStep&&<p className="mt-4 rounded-xl bg-indigo-50 p-3 text-sm dark:bg-navy"><strong>Try this:</strong> <FeedbackText text={b.nextStep}/></p>}
      {b.plainReview&&<details className="mt-4 rounded-xl border border-black/10 p-3 text-sm dark:border-white/15"><summary className="cursor-pointer font-semibold">Detailed lesson evidence</summary><p className="mt-3 whitespace-pre-wrap leading-7">{b.summary}</p><p className="mt-3 text-xs">{assessmentDisplayLabel(b.evidenceType)} · {b.source}</p><ul className="mt-3 ml-5 list-disc space-y-2">{[...(b.strengths||[]),...(b.targets||[])].map((x,i)=><li key={i}>{x}</li>)}</ul>{b.nextStep&&<p className="mt-3">{b.nextStep}</p>}</details>}{b.ratings&&Object.values(b.ratings).some(v=>v!=null)&&<div className="mt-4"><h4 className="font-semibold">Classroom checkpoint</h4><p className="text-xs text-navy-soft dark:text-navy-mist">Rory’s task based ratings, not a CEFR grade.</p><div className="mt-2 flex flex-wrap gap-2">{Object.entries(b.ratings).filter(([,v])=>v!=null).map(([k,v])=><span key={k} className="rounded-full bg-black/5 px-3 py-1 text-xs dark:bg-white/10">{ratingLabels[k]||k}: {v}/4</span>)}</div></div>}
      {w&&(w.original||w.corrected||w.model||w.practice?.length||w.comparisons?.length)?<WritingAnalysis key={`${r.id}-${r.created}`} record={r} code={code} teacher={mode==='teacher'} onSaved={refresh}/>:null}
      {b.transcript&&<details open={linkedRecord?.id===r.id} className="mt-4 rounded-xl border border-black/10 p-3 dark:border-white/15"><summary className="cursor-pointer font-semibold">Conversation transcript</summary><ConversationTranscript text={b.transcript}/><p className="mt-2 text-xs">Words are joined into speaker turns for easier reading. Captions may contain mistakes or interruptions; they do not show how clearly or quickly you spoke.</p></details>}
      {r.kind==='speaking'&&b.evidenceType==='AI conversation captions'&&<ConversationFeedback record={r} code={code} teacher={mode==='teacher'} parent={mode==='parent'} showTranscript={false} onSaved={refresh}/>}
      {b.audioDocumentId&&<SpeakingAudioReview code={code} name={name} mode={mode} record={r} onSaved={refresh}/>}
      {(b.studentNotes||b.lessonPoints)&&<details className="mt-4 space-y-2 text-sm"><summary className="cursor-pointer font-semibold">School context & lesson coverage</summary>{b.studentNotes&&<p><strong>Student notes:</strong> {b.studentNotes}</p>}{b.lessonPoints&&<p><strong>Lesson points:</strong> {b.lessonPoints}</p>}</details>}
      {mode==='teacher'&&b.tutorPrivate?.lessonAssessment&&<LessonAssessmentPanel record={r} records={records} code={code} onSaved={()=>void refresh()}/>}
      {mode==='teacher'&&b.tutorPrivate&&(b.tutorPrivate.worked||b.tutorPrivate.improve||b.tutorPrivate.plan)&&<div className="mt-4 rounded-xl border border-amber/50 p-3 text-sm"><strong>Your teaching reflection · private</strong>{b.tutorPrivate.worked&&<p>What helped: {b.tutorPrivate.plainWorked||b.tutorPrivate.worked}</p>}{b.tutorPrivate.improve&&<p>What to change: {b.tutorPrivate.plainImprove||b.tutorPrivate.improve}</p>}{b.tutorPrivate.plan&&<p>Next lesson: {b.tutorPrivate.plainPlan||b.tutorPrivate.plan}</p>}{b.tutorPrivate.plainPlan&&<details className="mt-3"><summary className="cursor-pointer font-semibold">Detailed teaching notes & private source links</summary><p className="mt-2">{b.tutorPrivate.worked}</p><p className="mt-2">{b.tutorPrivate.improve}</p><p className="mt-2">{b.tutorPrivate.plan}</p></details>}</div>}
      {mode==="teacher"&&r.kind==="lesson"&&<LessonPracticeEditor key={`${r.id}-${r.created}`} code={code} record={r} existing={practice&&r.body.source?.startsWith('lesson-practice:')?r:records.find(x=>x.body.source?.startsWith('lesson-practice:')&&x.body.lessonPractice?.sourceReviewId===r.id)} onSaved={()=>void refresh()}/>}
      {r.reviewPending&&mode==='teacher'&&<ReviewTiming availableAt={r.feedbackAvailableAt} teacher/>}
      {rs.length>0&&<div className="mt-4"><h4 className="font-semibold">Answers and revisions</h4>{rs.map(x=><div key={x.id} className="mt-2 rounded-xl bg-black/5 p-3 text-sm dark:bg-white/5"><small>{new Date(x.created).toLocaleDateString()} · {x.author}</small><AnswerWithPhotos answer={ringAnswerText(x.answer,code)} code={code} teacher={mode==='teacher'}/><WorkFeedback code={code} id={x.id} sourceType="reply" teacher={mode==='teacher'} parent={mode==='parent'} generate={mode==='student'}/></div>)}</div>}
      {mode==='student'&&r.visibility==='shared'&&(r.kind==='homework'||r.kind==='test'||r.kind==='lesson')&&<LearningReplyForm key={`${r.id}:${r.created}`} code={code} record={r} disabled={disabled} onSaved={refresh}/>}
    </div></details>;})}</div>}
    {(filter==='all'||filter==='homework'||filter==='rory')&&<SavedWriting code={code} name={name} teacher={mode==='teacher'} parent={mode==='parent'} reviewIds={records.map(record=>record.id)} onlyRoryFeedback={filter==='rory'}/>}
    {mode!=='teacher'&&!loading&&(filter==='all'||filter==='recorded')&&<details className="refined-feedback-support"><summary>Lesson progress overview</summary><LessonProgressSummary records={records} parent={mode==='parent'}/></details>}
    {checkpoints.length>0&&(filter==='all'||filter==='chat'||filter==='speaking')&&<details className="refined-feedback-support"><summary>Speaking checkpoints</summary><p className="refined-feedback-meta">Rory’s task based observations. Compare similar tasks and support levels before reading a change as progress.</p><div className="sentence-table-scroll"><table className="w-full text-left text-sm"><thead><tr><th scope="col">Date</th>{Object.entries(ratingLabels).map(([key,label])=><th key={key} scope="col">{label}</th>)}</tr></thead><tbody>{checkpoints.slice(-4).map(record=><tr key={record.id}><td>{readableDate(record.date)}</td>{Object.keys(ratingLabels).map(key=><td key={key}>{record.body.ratings?.[key]??'—'}</td>)}</tr>)}</tbody></table></div><p className="refined-feedback-meta">Scale: 1–4. A dash means not observed.</p></details>}
    {mode==='teacher'&&<details className="refined-feedback-support"><summary>Learning memory · private</summary><LearningMemoryPanel code={code} teacher records={records}/></details>}
    {mode==='parent'&&<p className="text-sm text-navy-soft dark:text-navy-mist">This view is read only. Ask {name} to add a revision in the student app.</p>}
  </div>;
}

function LearningReplyForm({code,record,disabled,onSaved}:{code:string;record:LearningRecord;disabled:boolean;onSaved:()=>Promise<void>}){
 const [busy,setBusy]=useState(false),[photoBusy,setPhotoBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const draft=useDurableDraft({code,role:'student',source:`learning-reply:${record.id}`,version:JSON.stringify([record.created,record.visibility,record.body]),enabled:!disabled},'');
 const parts=handwritingParts(draft.value),practice=readLessonPractice(record.body.lessonPractice),blocked=disabled||busy||photoBusy||draft.pending||!draft.ready;
 async function submit(){if(disabled||busy||photoBusy||!draft.ready||!draft.value.trim())return;setBusy(true);setError('');setMessage('');try{const pending=draft.pending,id=draft.beginRequest(),answer=draft.value.trim();let confirmed=false;
  if(pending){const existing=await getLearning(code);if(!existing.ok)throw new Error(existing.error||'Could not check your saved answer. Retry when connected.');confirmed=learningReplyReceipt(existing.replies?.find(reply=>reply.id===id),record.id,id,answer);}
  if(!confirmed){const saved=await replyLearning(code,record.id,id,answer);if(!saved.ok||!saved.received){if(!saved.ok&&!saved.offline&&!saved.authRequired)draft.resumeEditing();throw new Error(saved.error||'Could not confirm your answer. Retry this saved copy.');}const receipt=await getLearning(code);if(!receipt.ok)throw new Error(receipt.error||'Your receipt could not be checked. Retry this saved copy.');confirmed=learningReplyReceipt(receipt.replies?.find(reply=>reply.id===id),record.id,id,answer);}
  if(!confirmed)throw new Error('Your exact answer has not been confirmed. Retry this saved copy.');draft.confirmSaved('');void documentRequest(code,false,{action:'workFeedbackAnalyse',sourceType:'reply',id});setMessage('Done · received by Rory. Preparing your feedback.');await onSaved();
 }catch(e){setError(e instanceof Error?e.message:'Could not confirm your answer. Retry this saved copy.');}finally{setBusy(false);}}
 return <div className="mt-4 space-y-3 border-t border-black/10 pt-4 dark:border-white/10"><h4 id={`write-${record.id}`} className="font-semibold">Type your answer or photograph your handwriting</h4><textarea className={box} aria-label="Typed answer (optional if you attach handwriting)" rows={5} maxLength={11000} disabled={blocked} value={parts.text} onChange={e=>{const text=e.target.value;draft.setValue(previous=>[text,...handwritingParts(previous).documentIds.map(handwritingReference)].join('\n'));}} placeholder="Type here, or attach photos below. You do not need to type the same answer twice."/><HandwrittenAnswer code={code} title={assessmentDisplayLabel(record.title)} context={`Learning review: ${record.id}\n${practice?.writingPrompt||record.body.nextStep||record.body.summary||record.title}`} disabled={blocked||parts.documentIds.length>=6} onBusyChange={setPhotoBusy} onSaved={reference=>draft.setValue(previous=>[previous,reference].filter(Boolean).join('\n'))}/>{!!parts.documentIds.length&&<AnswerWithPhotos key={draft.value} code={code} answer={parts.documentIds.map(handwritingReference).join('\n')}/>}<p className="draft-save-status" role="status">{draft.error||draft.status}</p>{error&&<StatusRow kind="error">{error}</StatusRow>}{message&&<p role="status" className="text-sm">{message}</p>}<div className="flex flex-wrap gap-2"><button className={button} disabled={disabled||busy||photoBusy||!draft.ready||!draft.value.trim()} onClick={()=>void submit()}>{busy?'Sending…':draft.pending?'Retry saved answer':'Send answer to Rory'}</button>{(record.kind==='homework'||record.kind==='test')&&<a className="rounded-xl border border-indigo-300 px-4 py-2.5 text-sm font-semibold" href="/resources/writing-review-template.docx" download>Download worksheet</a>}<Link className="rounded-xl border border-indigo-300 px-4 py-2.5 text-sm font-semibold" href={`/s/${code}/documents/`}>My saved documents</Link></div><p className="text-xs text-navy-soft dark:text-navy-mist">Send answer to Rory sends your text and attached photos with this task. Rory and your parents can view the saved work.</p></div>;
}
function TeacherReviewComposer({code,disabled,onSaved}:{code:string;disabled:boolean;onSaved:()=>Promise<void>}){
 const draft=useDurableDraft({code,role:'teacher',source:'new-learning-review',version:'1',enabled:!disabled},emptyTeacherReview(today()));
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const {kind,title,date,visibility,summary,strengths,targets,nextStep,evidenceType,source,studentNotes,lessonPoints,original,corrected,model,practice,comparisons,worked,improve,plan,ratings}=draft.value;
 const field=<K extends keyof TeacherReviewDraft>(key:K)=>(value:TeacherReviewDraft[K]|((previous:TeacherReviewDraft[K])=>TeacherReviewDraft[K]))=>draft.setValue(previous=>({...previous,[key]:typeof value==='function'?(value as (p:TeacherReviewDraft[K])=>TeacherReviewDraft[K])(previous[key]):value}));
 const setKind=field('kind'),setTitle=field('title'),setDate=field('date'),setVisibility=field('visibility'),setSummary=field('summary'),setStrengths=field('strengths'),setTargets=field('targets'),setNextStep=field('nextStep'),setEvidenceType=field('evidenceType'),setSource=field('source'),setStudentNotes=field('studentNotes'),setLessonPoints=field('lessonPoints'),setOriginal=field('original'),setCorrected=field('corrected'),setModel=field('model'),setPractice=field('practice'),setComparisons=field('comparisons'),setWorked=field('worked'),setImprove=field('improve'),setPlan=field('plan'),setRatings=field('ratings');
 async function create(e:React.FormEvent){e.preventDefault();if(disabled||busy||!draft.ready||!title.trim())return;setBusy(true);setError('');setMessage('');try{const pending=draft.pending,id=draft.beginRequest(),payload=teacherReviewPayload(draft.value,id);let confirmed=false;
  if(pending){const existing=await getLearning(code,true);if(!existing.ok)throw new Error(existing.error||'Could not check the saved review. Retry when connected.');const record=existing.records?.find(record=>record.id===id);if(record&&!teacherReviewReceipt(record,payload))throw new Error('This saved review differs from the pending copy. Check the learning record before continuing.');confirmed=teacherReviewReceipt(record,payload);}
  if(!confirmed){const result=await saveLearning(code,payload);if(!result.ok){if(!result.offline&&!result.authRequired)draft.resumeEditing();throw new Error(result.error||'Could not confirm this review. Retry the saved copy.');}confirmed=teacherReviewReceipt(result.record,payload);if(!confirmed){const receipt=await getLearning(code,true);if(!receipt.ok)throw new Error(receipt.error||'Could not check this review. Retry the saved copy.');confirmed=teacherReviewReceipt(receipt.records?.find(record=>record.id===id),payload);}}
  if(!confirmed)throw new Error('The exact review has not been confirmed. Retry the saved copy.');draft.confirmSaved(emptyTeacherReview(today()));setMessage('Review saved to the learning record.');await onSaved();
 }catch(e){setError(e instanceof Error?e.message:'Could not confirm this review. Retry the saved copy.');}finally{setBusy(false);}}
 return <details className={card}><summary className="cursor-pointer font-bold">Add a review or lesson note</summary><form onSubmit={create} className="mt-4 space-y-3"><fieldset disabled={busy||draft.pending||!draft.ready||disabled} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Type<select className={box} value={kind} onChange={e=>setKind(e.target.value as LearningKind)}>{kinds.map(k=><option key={k} value={k}>{labels[k]}</option>)}</select></label><label className="text-sm">Date<input className={box} type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label></div>
      <label className="block text-sm">Title<input className={box} required maxLength={150} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Press freedom essay review"/></label>
      <label className="block text-sm">Who can see this?<select className={box} value={visibility} onChange={e=>setVisibility(e.target.value as 'shared'|'teacher')}><option value="shared">Student, parents and Rory</option><option value="teacher">Only Rory</option></select></label>
      <label className="block text-sm">Summary<textarea className={box} rows={2} value={summary} onChange={e=>setSummary(e.target.value)} placeholder="What this review found"/></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Strengths · one per line<textarea className={box} rows={3} value={strengths} onChange={e=>setStrengths(e.target.value)}/></label><label className="text-sm">Priorities · one per line<textarea className={box} rows={3} value={targets} onChange={e=>setTargets(e.target.value)}/></label></div>
      <label className="block text-sm">Next independent step<textarea className={box} rows={2} value={nextStep} onChange={e=>setNextStep(e.target.value)}/></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Evidence type<input className={box} value={evidenceType} onChange={e=>setEvidenceType(e.target.value)} placeholder="Handwritten page, audio, transcript…"/></label><label className="text-sm">School task or lesson ID<input className={box} value={source} onChange={e=>setSource(e.target.value)}/></label></div>
      {(kind==='speaking'||kind==='lesson')&&<fieldset className="rounded-xl border border-black/10 p-3 dark:border-white/15"><legend className="px-1 font-semibold">Optional classroom ratings · 1 to 4</legend><p className="mb-2 text-xs">1 = needs support; 4 = consistently effective for this task. Leave unobserved skills blank. These are not CEFR grades.</p><div className="grid gap-2 sm:grid-cols-2">{Object.entries(ratingLabels).map(([key,label])=><label key={key} className="text-sm">{label}<select className={box} value={ratings[key]??''} onChange={e=>setRatings(v=>({...v,[key]:e.target.value?Number(e.target.value):null}))}><option value="">Not observed</option>{[1,2,3,4].map(n=><option key={n} value={n}>{n} / 4</option>)}</select></label>)}</div></fieldset>}
      <label className="block text-sm">Student notes<textarea className={box} rows={2} value={studentNotes} onChange={e=>setStudentNotes(e.target.value)}/></label><label className="block text-sm">Lesson points<textarea className={box} rows={2} value={lessonPoints} onChange={e=>setLessonPoints(e.target.value)}/></label>
      {(kind==='homework'||kind==='test')&&<details className="rounded-xl border border-black/10 p-3 dark:border-white/15"><summary className="cursor-pointer font-semibold">Writing analysis and practice</summary><div className="mt-3 space-y-3"><label className="block text-sm">Original wording<textarea className={box} rows={5} value={original} onChange={e=>setOriginal(e.target.value)}/></label><label className="block text-sm">Corrected version<textarea className={box} rows={5} value={corrected} onChange={e=>setCorrected(e.target.value)}/></label><label className="block text-sm">More developed model<textarea className={box} rows={5} value={model} onChange={e=>setModel(e.target.value)}/></label><ComparisonFields rows={comparisons} onChange={setComparisons}/><label className="block text-sm">Practice questions · one per line<textarea className={box} rows={4} value={practice} onChange={e=>setPractice(e.target.value)}/></label></div></details>}
      <details className="rounded-xl border border-black/10 p-3 dark:border-white/15"><summary className="cursor-pointer font-semibold">Tutor reflection · only Rory sees this</summary><div className="mt-3 space-y-3"><label className="block text-sm">What worked<textarea className={box} rows={2} value={worked} onChange={e=>setWorked(e.target.value)}/></label><label className="block text-sm">What to improve<textarea className={box} rows={2} value={improve} onChange={e=>setImprove(e.target.value)}/></label><label className="block text-sm">What I will change next time<textarea className={box} rows={2} value={plan} onChange={e=>setPlan(e.target.value)}/></label></div></details>
      </fieldset><p className="draft-save-status" role="status">{draft.error||draft.status}</p>{error&&<StatusRow kind="error">{error}</StatusRow>}{message&&<p role="status" className="text-sm">{message}</p>}<button className={button} disabled={disabled||busy||!draft.ready||!title.trim()}>{busy?'Saving…':draft.pending?'Retry saved review':'Save review'}</button>
    </form></details>;
}
