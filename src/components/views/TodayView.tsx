"use client";

import {useEffect,useState} from "react";
import Link from "next/link";
import type {Unit} from "@/lib/types";
import {useStudent} from "@/components/StudentContext";
import {fetchNote,fetchAssignments,fetchSubmissions,type Submission,rowToAssignment,isCurrentAssignment,type Assignment} from "@/lib/remote";
import {ChevronRightIcon,MessageIcon} from "@/components/Icons";
import {MicrophoneIcon,RepeatIcon,TopicArt} from "@/components/LearningVisuals";
import {isFerdiSpeakingHomework} from "@/lib/speaking-homework";
import {readableDate,submissionStatus,isCompletedAssignment} from "@/lib/clarity";
import {LatestLessonPractice} from "@/components/LessonPractice";
import NextLesson from "@/components/NextLesson";
import YearPlanNotice from "@/components/YearPlanNotice";
import EngagementPanel from "@/components/EngagementPanel";
import StatusRow from "@/components/StatusRow";
import MomentumStrip from "@/components/MomentumStrip";
import {isStudentPreview} from "@/lib/student-preview";
import {assignmentTaskHref,learnerTaskTitle} from "@/lib/today-task";
import {fetchCalendar} from "@/lib/calendar-client";
import {viennaDate} from "@/lib/lesson-calendar";
import {weeklyEngagement} from "@/lib/engagement";

type NextStep={label:string;title:string;meta:string;href:string;action:string;pending:boolean;kind:'speaking'|'writing'|'task'};
const latestSubmission=(submissions:Submission[],unit:string,task:string)=>submissions.filter(s=>s.unit===unit&&s.task===task).sort((a,b)=>b.submitted.localeCompare(a.submitted))[0];
function taskStep(step:Omit<NextStep,"action"|"pending">,sent:Submission|undefined):NextStep{
  if(!sent)return {...step,action:"Start",pending:true};
  const revision=sent.status==="revision-needed",feedback=sent.status==="reviewed"&&!!sent.feedback&&!sent.reviewPending;
  return {...step,label:revision?"Revision requested":feedback?"Homework feedback":"Saved homework",meta:[submissionStatus([sent],sent.unit,sent.task),revision?step.meta:""].filter(Boolean).join(" · "),action:revision?"Revise":feedback?"View feedback":"View saved work",pending:revision};
}

export default function TodayView({unit}:{unit:Unit|null}){
  const {code,displayName,studentId}=useStudent(),base=`/s/${code}`;
  const [note,setNote]=useState(""),[assignments,setAssignments]=useState<Assignment[]>([]),[error,setError]=useState(""),[loaded,setLoaded]=useState(false),[submissions,setSubmissions]=useState<Submission[]>([]);
  const [calendarState,setCalendarState]=useState<'checking'|'paused'|'ready'|'unavailable'>('checking');
  async function refresh(){setLoaded(false);setError("");try{const [n,a,sent]=await Promise.all([fetchNote(code),fetchAssignments(code),fetchSubmissions(code)]);if(sent.ok)setSubmissions(sent.submissions||[]);if(n.ok)setNote(n.note||"");if(a.ok)setAssignments((a.assignments?.rows||[]).map(rowToAssignment).filter(x=>isCurrentAssignment(x)));if(!n.ok||!a.ok||!sent.ok)setError(n.error||a.error||sent.error||"Could not load your latest update.");}catch{setError("Could not load your latest update.");}finally{setLoaded(true)}}
  useEffect(()=>{void refresh();},[code]);
  useEffect(()=>{let live=true;setCalendarState('checking');const check=()=>{void fetchCalendar(code).then(r=>{if(live)setCalendarState(r.ok?(weeklyEngagement([],viennaDate(),r.breaks||[]).paused?'paused':'ready'):'unavailable');}).catch(()=>{if(live)setCalendarState('unavailable');});};check();window.addEventListener('focus',check);return()=>{live=false;window.removeEventListener('focus',check);};},[code]);
  const today=viennaDate();
  const current=assignments.filter(a=>isCurrentAssignment(a)&&!/^(archived|superseded|cancelled|withdrawn)$/i.test(a.status.trim()));
  const readyAssignments=current.filter(a=>!isCompletedAssignment(a.status)||latestSubmission(submissions,"assigned",a.id)?.status==="revision-needed");
  const resetHomework=assignments.some(a=>isCurrentAssignment(a)&&a.id.startsWith("homework-reset-"));
  const ready=(resetHomework||current.some(a=>isFerdiSpeakingHomework(code,a))?[]:unit?.homework||[]).filter(h=>!h.availableFrom||h.availableFrom<=today);
  // Pending work comes before receipts; Rory's own assignment comes before unit practice.
  const steps:NextStep[]=[
    ...readyAssignments.map(a=>taskStep({label:"Homework from Rory",title:isFerdiSpeakingHomework(code,a)?"Family life · Speaking and writing practice":learnerTaskTitle(a.title),meta:a.due?`Due ${readableDate(a.due)}`:"No deadline set",href:assignmentTaskHref(code,a.id),kind:isFerdiSpeakingHomework(code,a)?'speaking':'task'},latestSubmission(submissions,"assigned",a.id))),
    ...ready.map(h=>taskStep({label:h.tasks.some(t=>t.type==="voice")?"Speaking task":"Writing task",title:learnerTaskTitle(h.title),meta:[h.estimatedMinutes?`About ${h.estimatedMinutes} min`:"",h.due?`Due ${readableDate(h.due)}`:""].filter(Boolean).join(" · "),href:`${base}/lessons/${unit!.id}/homework/${h.week}/`,kind:h.tasks.some(t=>t.type==='voice')?'speaking':'writing'},latestSubmission(submissions,unit!.id,`hw:${h.week}`))),
  ];
  const pending=steps.filter(s=>s.pending),next=pending[0]||steps.find(s=>s.action==="View feedback")||steps[0],more=pending.length-(next?.pending?1:0);
  const hero=error?{label:"Latest update unavailable",title:"Check your homework",meta:"Retry the update above to check your latest tasks.",href:`${base}/homework/`,action:"Open homework"}:!loaded?{label:"Checking with Rory…",title:"Your next step",meta:"One moment.",href:"",action:""}:next||{label:"Nothing new",title:"No new homework right now.",meta:"Have a short conversation instead.",href:`${base}/speak/`,action:"Speak"};
  return <main className="re-home today-page studio-today">
    <header className="re-page-heading"><p className="re-eyebrow">YOUR LEARNING SPACE</p><h1>Hi, {displayName}.</h1></header>
    {error&&<StatusRow kind="error" className="mb-4" onRetry={()=>void refresh()}>{error}</StatusRow>}
    <section className="today-hero" aria-labelledby="today-hero-title" aria-busy={!loaded}>
      <div className="studio-task-copy">
      <p className="today-hero-label">{hero.label}</p>
      <h2 id="today-hero-title">{hero.title}</h2>
      <p className="today-hero-meta">{hero.meta}</p>
      {calendarState==='paused'&&<div className="studio-break-note"><strong>Optional during the break</strong><p>Weekly practice is paused. Your work is here whenever you want to practise.</p></div>}
      {calendarState==='unavailable'&&<Link className="studio-calendar-note" href={`${base}/calendar/`}>Break dates could not be checked. Open your calendar.</Link>}
      {hero.action&&<Link className="re-button" href={hero.href} aria-label={`${hero.action}: ${hero.title}`}>{hero.action}</Link>}
      {loaded&&!error&&more>0&&<Link className="today-hero-more" href={`${base}/homework/`}>{more} more {more===1?"task":"tasks"} in Homework <ChevronRightIcon/></Link>}
      </div>
      <div className="studio-task-scene" aria-hidden="true"><TopicArt kind={'kind' in hero&&hero.kind==='writing'?1:2}/></div>
    </section>
    <LatestLessonPractice code={code} compact/>
    <div className="today-rows">
      <NextLesson code={code} row/>
      <Link className="today-row" href={`${base}/speak/`}><MicrophoneIcon/><span><strong>Speak</strong><small>A short conversation, saved for Rory</small></span><ChevronRightIcon/></Link>
      <Link className="today-row" href={`${base}/progress/`}><MessageIcon/><span><strong>Feedback</strong><small>What worked and what to try next</small></span><ChevronRightIcon/></Link>
      <Link className="today-row" href={`${base}/study/`}><RepeatIcon/><span><strong>Practice desk</strong><small>A few optional exercises from your own feedback</small></span><ChevronRightIcon/></Link>
    </div>
    {!isStudentPreview(code)&&<MomentumStrip studentId={studentId}/>}
    <EngagementPanel code={code} compact/>
    <YearPlanNotice code={code} note={note}/>
  </main>;
}
