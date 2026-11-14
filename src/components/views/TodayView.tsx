"use client";

import {useEffect,useState} from "react";
import Link from "next/link";
import type {Unit} from "@/lib/types";
import {useStudent} from "@/components/StudentContext";
import {fetchNote,fetchAssignments,fetchSubmissions,type Submission,rowToAssignment,isCurrentAssignment,type Assignment} from "@/lib/remote";
import {ChevronRightIcon} from "@/components/Icons";
import {RepeatIcon} from "@/components/LearningVisuals";
import {isFerdiSpeakingHomework} from "@/lib/speaking-homework";
import {readableDate,submissionStatus,isCompletedAssignment} from "@/lib/clarity";
import {LatestLessonPractice} from "@/components/LessonPractice";
import NextLesson from "@/components/NextLesson";
import YearPlanNotice from "@/components/YearPlanNotice";
import WeeklyPracticeSummary,{type WeeklySummaryState} from '@/components/WeeklyPracticeSummary';
import EngagementPanel from "@/components/EngagementPanel";
import StatusRow from "@/components/StatusRow";
import MomentumStrip from "@/components/MomentumStrip";
import {isStudentPreview} from "@/lib/student-preview";
import {assignmentTaskHref,learnerTaskTitle} from "@/lib/today-task";
import {fetchCalendar} from "@/lib/calendar-client";
import {viennaDate} from "@/lib/lesson-calendar";
import {weeklyEngagement} from "@/lib/engagement";

type NextStep={label:string;title:string;meta:string;href:string;action:string;pending:boolean;kind:'speaking'|'writing'|'task';homeworkLabel?:string};
const latestSubmission=(submissions:Submission[],unit:string,task:string)=>submissions.filter(s=>s.unit===unit&&s.task===task).sort((a,b)=>b.submitted.localeCompare(a.submitted))[0];
function taskStep(step:Omit<NextStep,"action"|"pending">,sent:Submission|undefined):NextStep{
  if(!sent)return {...step,action:"Start",pending:true};
  const revision=sent.status==="revision-needed",feedback=sent.status==="reviewed"&&!!sent.feedback&&!sent.reviewPending;
  return {...step,label:revision?"Revision requested":feedback?"Homework feedback":"Saved homework",meta:[submissionStatus([sent],sent.unit,sent.task),revision?step.meta:""].filter(Boolean).join(" · "),action:revision?"Revise":feedback?"View feedback":"View saved work",pending:revision};
}

export default function TodayView({unit,units}:{unit:Unit|null;units?:Unit[]}){
  const {code,displayName,studentId}=useStudent(),base=`/s/${code}`;
  const [note,setNote]=useState(""),[assignments,setAssignments]=useState<Assignment[]>([]),[error,setError]=useState(""),[loaded,setLoaded]=useState(false),[submissions,setSubmissions]=useState<Submission[]>([]);
  const [weeklySummary,setWeeklySummary]=useState<WeeklySummaryState>({status:'loading'});
  const [calendarState,setCalendarState]=useState<'checking'|'paused'|'ready'|'unavailable'>('checking');
  async function refresh(){setLoaded(false);setError("");try{const [n,a,sent]=await Promise.all([fetchNote(code),fetchAssignments(code),fetchSubmissions(code)]);if(sent.ok)setSubmissions(sent.submissions||[]);if(n.ok)setNote(n.note||"");if(a.ok)setAssignments((a.assignments?.rows||[]).map(rowToAssignment).filter(x=>isCurrentAssignment(x)));if(!n.ok||!a.ok||!sent.ok)setError(n.error||a.error||sent.error||"Could not load your latest update.");}catch{setError("Could not load your latest update.");}finally{setLoaded(true)}}
  useEffect(()=>{void refresh();},[code]);
  useEffect(()=>{let live=true;setCalendarState('checking');const check=()=>{void fetchCalendar(code).then(r=>{if(live)setCalendarState(r.ok?(weeklyEngagement([],viennaDate(),r.breaks||[]).paused?'paused':'ready'):'unavailable');}).catch(()=>{if(live)setCalendarState('unavailable');});};check();window.addEventListener('focus',check);return()=>{live=false;window.removeEventListener('focus',check);};},[code]);
  const today=viennaDate();
  const allUnits=units?.length?units:unit?[unit]:[];
  const currentUnits=allUnits.filter(u=>u.id===unit?.id||u.homePlacement==="current");
  const current=assignments.filter(a=>isCurrentAssignment(a)&&!/^(archived|superseded|cancelled|withdrawn)$/i.test(a.status.trim()));
  const readyAssignments=current.filter(a=>!isCompletedAssignment(a.status)||latestSubmission(submissions,"assigned",a.id)?.status==="revision-needed");
  const resetHomework=assignments.some(a=>isCurrentAssignment(a)&&a.id.startsWith("homework-reset-"));
  const ready=(resetHomework||current.some(a=>isFerdiSpeakingHomework(code,a))?[]:currentUnits.flatMap(u=>u.homework.map(homework=>({unitId:u.id,homework})))).filter(({homework:h})=>!h.availableFrom||h.availableFrom<=today);
  // Pending work comes before receipts; Rory's own assignment comes before unit practice.
  const steps:NextStep[]=[
    ...readyAssignments.map(a=>taskStep({label:"Homework from Rory",title:isFerdiSpeakingHomework(code,a)?"Family life · Speaking and writing practice":learnerTaskTitle(a.title).replace(/^HW[1-9]\d*\s*·\s*/i,''),homeworkLabel:a.title.match(/^HW[1-9]\d*\b/i)?.[0].toUpperCase(),meta:a.due?`Due ${readableDate(a.due)}`:"No deadline set",href:assignmentTaskHref(code,a.id),kind:isFerdiSpeakingHomework(code,a)?'speaking':'task'},latestSubmission(submissions,"assigned",a.id))),
    ...ready.map(({unitId,homework:h})=>taskStep({label:h.focus==="writing-spelling"?"Writing and spelling":h.subject==="maths"?"Maths check":h.tasks.some(t=>t.type==="voice"&&!t.optional)?"Speaking and writing":"Writing practice",title:learnerTaskTitle(h.title),meta:[h.estimatedMinutes?`About ${h.estimatedMinutes} min`:"",h.due?`Due ${readableDate(h.due)}`:""].filter(Boolean).join(" · "),href:`${base}/lessons/${unitId}/homework/${h.week}/`,kind:h.tasks.some(t=>t.type==='voice'&&!t.optional)?'speaking':'writing'},latestSubmission(submissions,unitId,`hw:${h.week}`))),
  ];
  const previous=allUnits.filter(u=>!currentUnits.some(c=>c.id===u.id)).flatMap(u=>u.homework.filter(h=>!h.availableFrom||h.availableFrom<=today).map(h=>taskStep({label:"Previous lesson · optional catch-up",title:learnerTaskTitle(h.title),meta:u.title,href:`${base}/lessons/${u.id}/homework/${h.week}/`,kind:'task'},latestSubmission(submissions,u.id,`hw:${h.week}`)))).filter(s=>s.pending);
  const taskLinks=(items:NextStep[])=>items.map(s=><Link key={s.href} className="today-row" href={s.href}><RepeatIcon/><span><small>{s.label}</small><strong>{s.title}</strong><small>{loaded&&!error?s.action:"Open task"}{s.meta?` · ${s.meta}`:""}</small></span><ChevronRightIcon/></Link>);
  const pending=steps.filter(s=>s.pending),next=pending[0]||steps.find(s=>s.action==="View feedback")||steps[0],more=pending.length-(next?.pending?1:0);
  const hero=error?{label:"Latest update unavailable",title:"Check your homework",meta:"Retry the update above to check your latest tasks.",href:`${base}/homework/`,action:"Open homework"}:!loaded?{label:"Checking with Rory…",title:"Your next step",meta:"One moment.",href:"",action:""}:next||{label:"Nothing new",title:"No new homework right now.",meta:"Have a short conversation instead.",href:`${base}/speak/`,action:"Speak"};
  const additionalSteps=steps.filter(step=>step.href!==hero.href);
  const heroButton=hero.action==="Start"?`Open this week’s work${'homeworkLabel' in hero&&hero.homeworkLabel?` · ${hero.homeworkLabel}`:''}`:hero.action;
  return <main className="re-home today-page studio-today">
    <header className="re-page-heading"><p className="re-eyebrow">YOUR LEARNING SPACE</p><h1>Hi, {displayName}.</h1></header>
    {error&&<StatusRow kind="error" className="mb-4" onRetry={()=>void refresh()}>{error}</StatusRow>}
    <section className="today-hero" aria-labelledby="today-hero-title" aria-busy={!loaded}>
      <div className="studio-task-copy">
      <p className="today-hero-label">THIS WEEK’S WORK · {hero.label}</p>
      <h2 id="today-hero-title">{hero.title}</h2>
      <p className="today-hero-meta">{hero.meta}</p>
      {calendarState==='paused'&&<div className="studio-break-note"><strong>Optional during the break</strong><p>Weekly practice is paused. Your work is here whenever you want to practise.</p></div>}
      {calendarState==='unavailable'&&<Link className="studio-calendar-note" href={`${base}/calendar/`}>Break dates could not be checked. Open your calendar.</Link>}
      {hero.action&&<Link className="re-button" href={hero.href} aria-label={`${heroButton}: ${hero.title}`}>{heroButton}</Link>}
      {loaded&&!error&&more>0&&<Link className="today-hero-more" href="#additional-work-title">{more} more {more===1?"task":"tasks"} below <ChevronRightIcon/></Link>}
      </div>
      <WeeklyPracticeSummary state={weeklySummary} href={`${base}/progress/#weekly-practice`}/>
    </section>
    {loaded&&!error&&additionalSteps.length>0&&<section aria-labelledby="additional-work-title">
      <h2 id="additional-work-title" className="week-form-heading">Other current tasks</h2>
      <div className="today-rows">{taskLinks(additionalSteps)}</div>
    </section>}
    <details className="work-archive">
      <summary>Previous lessons · unfinished work{loaded&&!error?` (${previous.length})`:""}</summary>
      <p className="ux-subtle">Optional catch-up unless Rory has assigned it again. Submitted work is not listed as unfinished.</p>
      {!loaded?<p>Checking your saved work…</p>:error?<p>Your saved work could not be checked. Retry the update above.</p>:previous.length?<div className="today-rows">{taskLinks(previous)}</div>:<p>No unfinished previous tasks found.</p>}
      <Link className="ux-link-row" href={`${base}/lessons/`}>Browse all previous lessons and saved work <ChevronRightIcon/></Link>
    </details>
    <LatestLessonPractice code={code} compact/>
    <div className="today-rows">
      <NextLesson code={code} row/>
      <Link className="today-row" href={`${base}/study/`}><RepeatIcon/><span><strong>Practice desk</strong><small>A few optional exercises from your own feedback</small></span><ChevronRightIcon/></Link>
    </div>
    {!isStudentPreview(code)&&<MomentumStrip studentId={studentId}/>}
    {/* The full rings and history live on Feedback. This loads the week for the summary above and draws nothing. */}
    <EngagementPanel code={code} summaryOnly onWeeklySummary={setWeeklySummary}/>
    <YearPlanNotice code={code} note={note}/>
  </main>;
}
