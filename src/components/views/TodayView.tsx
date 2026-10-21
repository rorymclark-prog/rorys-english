"use client";

import {useEffect,useState} from "react";
import Link from "next/link";
import type {Unit} from "@/lib/types";
import {useStudent} from "@/components/StudentContext";
import {fetchNote,fetchAssignments,fetchSubmissions,type Submission,rowToAssignment,isCurrentAssignment,type Assignment} from "@/lib/remote";
import {ChevronRightIcon,MessageIcon} from "@/components/Icons";
import {MicrophoneIcon} from "@/components/LearningVisuals";
import {isFerdiSpeakingHomework} from "@/lib/speaking-homework";
import {readableDate,submissionStatus,isCompletedAssignment} from "@/lib/clarity";
import {LatestLessonPractice} from "@/components/LessonPractice";
import NextLesson from "@/components/NextLesson";
import YearPlanNotice from "@/components/YearPlanNotice";
import EngagementPanel from "@/components/EngagementPanel";
import StatusRow from "@/components/StatusRow";

type NextStep={label:string;title:string;meta:string;href:string};

export default function TodayView({unit}:{unit:Unit|null}){
  const {code,displayName}=useStudent(),base=`/s/${code}`;
  const [note,setNote]=useState(""),[assignments,setAssignments]=useState<Assignment[]>([]),[error,setError]=useState(""),[loaded,setLoaded]=useState(false),[submissions,setSubmissions]=useState<Submission[]>([]);
  async function refresh(){setError("");try{const [n,a,sent]=await Promise.all([fetchNote(code),fetchAssignments(code),fetchSubmissions(code)]);if(sent.ok)setSubmissions(sent.submissions||[]);if(n.ok)setNote(n.note||"");if(a.ok)setAssignments((a.assignments?.rows||[]).map(rowToAssignment).filter(x=>isCurrentAssignment(x)));if(!n.ok||!a.ok||!sent.ok)setError(n.error||a.error||sent.error||"Could not load your latest update.");}catch{setError("Could not load your latest update.");}finally{setLoaded(true)}}
  useEffect(()=>{void refresh();},[code]);
  const now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const readyAssignments=assignments.filter(a=>!isCompletedAssignment(a.status));
  const ready=(assignments.some(a=>isFerdiSpeakingHomework(code,a))?[]:unit?.homework||[]).filter(h=>!h.availableFrom||h.availableFrom<=today);
  // The one next step: Rory's own assignment first, then the next unit task.
  const steps:NextStep[]=[
    ...readyAssignments.map(a=>({label:"Homework from Rory",title:isFerdiSpeakingHomework(code,a)?"Family life · Speaking and writing practice":a.title,meta:a.due?`Due ${readableDate(a.due)}`:"No deadline set",href:`${base}/homework/`})),
    ...ready.map(h=>{const speaking=h.tasks.some(t=>t.type==="voice"),status=loaded?error?"":submissionStatus(submissions,unit!.id,`hw:${h.week}`):"";return {label:speaking?"Speaking task":"Writing task",title:h.title,meta:[h.estimatedMinutes?`About ${h.estimatedMinutes} min`:"",status,h.due?`Due ${readableDate(h.due)}`:""].filter(Boolean).join(" · "),href:`${base}/lessons/${unit!.id}/homework/${h.week}/`};}),
  ];
  const next=steps[0],more=steps.length-1;
  return <main className="re-home today-page">
    <header className="re-page-heading"><h1>Hi, {displayName}.</h1></header>
    {error&&<StatusRow kind="error" className="mb-4" onRetry={()=>void refresh()}>{error}</StatusRow>}
    <section className="today-hero" aria-labelledby="today-hero-title">
      <p className="today-hero-label">{next?next.label:loaded?"Nothing new":"Checking with Rory…"}</p>
      <h2 id="today-hero-title">{next?next.title:loaded?"No new homework right now.":"Your next step"}</h2>
      <p className="today-hero-meta">{next?next.meta:loaded?"Have a short conversation instead.":"One moment."}</p>
      <Link className="re-button" href={next?next.href:`${base}/speak/`}>{next?"Start":"Speak"}</Link>
      {more>0&&<Link className="today-hero-more" href={`${base}/homework/`}>{more} more {more===1?"task":"tasks"} in Homework <ChevronRightIcon/></Link>}
    </section>
    <LatestLessonPractice code={code}/>
    <div className="today-rows">
      <NextLesson code={code} row/>
      <Link className="today-row" href={`${base}/speak/`}><MicrophoneIcon/><span><strong>Speak</strong><small>A short conversation, saved for Rory</small></span><ChevronRightIcon/></Link>
      <Link className="today-row" href={`${base}/progress/`}><MessageIcon/><span><strong>Feedback</strong><small>What worked and what to try next</small></span><ChevronRightIcon/></Link>
    </div>
    <EngagementPanel code={code} compact/>
    <YearPlanNotice code={code} note={note}/>
  </main>;
}
