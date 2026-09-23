"use client";

import {useEffect,useState} from "react";
import Link from "next/link";
import type {HomeworkWeek,Unit} from "@/lib/types";
import {useStudent} from "@/components/StudentContext";
import Screen from "@/components/Screen";
import SubmissionForm from "@/components/SubmissionForm";
import SpeakingHomeworkCard from "@/components/views/SpeakingHomeworkCard";
import {isFerdiSpeakingHomework} from "@/lib/speaking-homework";
import {fetchAssignments,rowToAssignment,isCurrentAssignment,type Assignment} from "@/lib/remote";
import {BookIcon,ChevronRightIcon,CheckSquareIcon,ClockIcon,FileIcon,MessageIcon,PencilIcon,TargetIcon,UploadIcon} from "@/components/Icons";
import {MicrophoneIcon} from "@/components/LearningVisuals";

type WorkKind="speaking"|"writing"|"task";
const kindLabel:Record<WorkKind,string>={speaking:"Speaking",writing:"Writing",task:"Assignment"};
const kindIcon={speaking:MicrophoneIcon,writing:PencilIcon,task:CheckSquareIcon};
const kindForAssignment=(a:Assignment):WorkKind=>/speak|voice|conversation|chat|record|talk/i.test(`${a.title} ${a.details}`)?"speaking":/writ|essay|email|paragraph|draft/i.test(`${a.title} ${a.details}`)?"writing":"task";
const kindForWeek=(week:HomeworkWeek):WorkKind=>week.tasks.some(t=>t.type==="voice")?"speaking":week.tasks.some(t=>t.type==="written")?"writing":"task";
const dateLabel=(value:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return value;const date=new Date(`${value}T12:00:00`);return Number.isNaN(date.valueOf())?value:date.toLocaleDateString("en-GB",{day:"numeric",month:"short"});};
const localDate=()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;};
const isDone=(a:Assignment)=>/^(done|complete|completed|reviewed)$/i.test(a.status.trim());

function SectionHeading({eyebrow,title,count}:{eyebrow:string;title:string;count:number}){
  return <div className="work-section-heading"><div><p className="work-eyebrow">{eyebrow}</p><h2>{title}</h2></div><span className="work-count">{count}</span></div>;
}

function WeekCard({week,unitId,code,upcoming}:{week:HomeworkWeek;unitId:string;code:string;upcoming:boolean}){
  const kind=kindForWeek(week),Icon=kindIcon[kind];
  return <Link className={`work-card work-${kind} ${upcoming?"work-upcoming":""}`} href={`/s/${code}/lessons/${unitId}/homework/${week.week}/`}>
    <span className="work-icon" aria-hidden="true"><Icon/></span>
    <span className="work-card-main"><span className="work-card-top"><span className="work-kind">{kindLabel[kind]}</span><span className={`work-status ${upcoming?"is-upcoming":"is-ready"}`}>{upcoming?"Coming up":"Ready now"}</span></span><strong>{week.title}</strong><span className="work-description">{week.description||"Open the task to see your steps."}</span><span className="work-meta">{week.estimatedMinutes&&<span><ClockIcon/> About {week.estimatedMinutes} min</span>}<span>{upcoming?`Starts ${dateLabel(week.availableFrom||"")}`:week.due?`Due ${dateLabel(week.due)}`:"No deadline set"}</span></span></span>
    <span className="work-card-action">Open task<ChevronRightIcon/></span>
  </Link>;
}

function AssignedCard({assignment,code,previous=false}:{assignment:Assignment;code:string;previous?:boolean}){
  const kind=kindForAssignment(assignment),Icon=kindIcon[kind];
  return <details className={`work-card work-${kind} work-assigned ${previous?"work-upcoming":""}`}>
    <summary><span className="work-icon" aria-hidden="true"><Icon/></span><span className="work-card-main"><span className="work-card-top"><span className="work-kind">{kindLabel[kind]}</span><span className={`work-status ${isDone(assignment)?"is-done":"is-ready"}`}>{isDone(assignment)?"Marked complete":previous?"Previous year":"Assigned by Rory"}</span></span><strong>{assignment.title}</strong><span className="work-description">{assignment.details.trim().split(/\n|\.\s/)[0]||"Open to read the task."}</span><span className="work-meta"><span>{assignment.due?`Due ${dateLabel(assignment.due)}`:"No deadline set"}</span></span></span><span className="work-card-action">Read task<ChevronRightIcon/></span></summary>
    <div className="work-card-detail"><p className="whitespace-pre-wrap">{assignment.details}</p><SubmissionForm code={code} unit="assigned" task={assignment.id} title={assignment.title} fields={[{id:"answer",prompt:previous?"Optional revision or practice notes":"Your answer or practice notes",type:"written"}]}/></div>
  </details>;
}

export default function HomeworkListView({unit}:{unit:Unit|null}){
  const {code}=useStudent();
  const [assignments,setAssignments]=useState<Assignment[]>([]),[error,setError]=useState(""),[loaded,setLoaded]=useState(false);
  async function refresh(){setError("");try{const r=await fetchAssignments(code);if(r.ok)setAssignments((r.assignments?.rows||[]).map(rowToAssignment));else setError(r.error||"Could not load homework. Please retry.");}catch{setError("Could not load homework. Please retry.");}finally{setLoaded(true)}}
  useEffect(()=>{void refresh();},[code]);
  const current=assignments.filter(isCurrentAssignment),readyAssignments=current.filter(a=>!isDone(a)),completedAssignments=current.filter(isDone),previous=assignments.filter(a=>!isCurrentAssignment(a));
  const hasSpeakingHomework=current.some(a=>isFerdiSpeakingHomework(code,a));
  const today=localDate();
  const weeks=hasSpeakingHomework?[]:unit?.homework||[];
  const readyWeeks=weeks.filter(h=>!h.availableFrom||h.availableFrom<=today),upcomingWeeks=weeks.filter(h=>h.availableFrom&&h.availableFrom>today);
  const count=readyAssignments.length+readyWeeks.length;
  return <Screen title="Homework" subtitle={unit?.title}>
    <div className="work-page">
      <p className="work-intro">See what is ready, what comes later, and where to find Rory’s feedback.</p>
      <nav className="work-quick-links" aria-label="Related work"><Link href={`/s/${code}/test-prep/`}><TargetIcon/>Test prep<ChevronRightIcon/></Link><Link href={`/s/${code}/documents/`}><UploadIcon/>Upload work<ChevronRightIcon/></Link><Link href={`/s/${code}/progress/`}><MessageIcon/>Feedback<ChevronRightIcon/></Link></nav>
      {error&&<div role="alert" className="work-alert">{error}<button onClick={()=>void refresh()}>Try again</button></div>}
      {!loaded&&<p role="status" className="work-loading">Checking Rory’s assignments…</p>}
      {(count>0||loaded)&&<section className="work-section"><SectionHeading eyebrow="YOUR CURRENT WORK" title="Ready to do" count={count}/><div className="work-card-list">{readyAssignments.map(a=>isFerdiSpeakingHomework(code,a)?<SpeakingHomeworkCard key={a.id} code={code} assignment={a}/>:<AssignedCard key={a.id} assignment={a} code={code}/>)}{readyWeeks.map(h=><WeekCard key={`${unit!.id}-${h.week}`} week={h} unitId={unit!.id} code={code} upcoming={false}/>)}{loaded&&!error&&count===0&&<div className="work-empty"><BookIcon/><strong>Nothing new to do right now.</strong><p>Your lessons and earlier work are still here when you want to practise.</p></div>}</div></section>}
      {upcomingWeeks.length>0&&<section className="work-section"><SectionHeading eyebrow="PLAN AHEAD" title="Coming up" count={upcomingWeeks.length}/><div className="work-card-list">{upcomingWeeks.map(h=><WeekCard key={`${unit!.id}-${h.week}`} week={h} unitId={unit!.id} code={code} upcoming/>)}</div></section>}
      {completedAssignments.length>0&&<details className="work-archive"><summary><CheckSquareIcon/><span><strong>Completed assignments</strong><small>{completedAssignments.length} saved for reference</small></span><ChevronRightIcon/></summary><div className="work-card-list">{completedAssignments.map(a=><AssignedCard key={a.id} assignment={a} code={code}/>)}</div></details>}
      {previous.length>0&&<details className="work-archive"><summary><FileIcon/><span><strong>Previous-year assignments</strong><small>Optional revision · {previous.length} items</small></span><ChevronRightIcon/></summary><div className="work-card-list">{previous.map(a=><AssignedCard key={a.id} assignment={a} code={code} previous/>)}</div></details>}
      <Link className="work-library-link" href={`/s/${code}/lessons/`}><BookIcon/><span><strong>Find lessons and past material</strong><small>Current unit, practice and approved resources</small></span><ChevronRightIcon/></Link>
    </div>
  </Screen>;
}
