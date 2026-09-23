"use client";

import {useEffect,useState} from "react";
import Link from "next/link";
import type {HomeworkWeek,Unit} from "@/lib/types";
import {useStudent} from "@/components/StudentContext";
import {fetchNote,fetchAssignments,rowToAssignment,isCurrentAssignment,type Assignment} from "@/lib/remote";
import {BookIcon,CheckSquareIcon,ChevronRightIcon,FileIcon,MessageIcon,PencilIcon,TargetIcon} from "@/components/Icons";
import {MicrophoneIcon,RepeatIcon} from "@/components/LearningVisuals";
import FeedbackText from "@/components/FeedbackText";

function WeekLink({h,unit,base}:{h:HomeworkWeek;unit:Unit;base:string}){
  const speaking=h.tasks.some(t=>t.type==="voice"),Icon=speaking?MicrophoneIcon:PencilIcon;
  return <Link href={`${base}/lessons/${unit.id}/homework/${h.week}/`} className={`today-next-card ${speaking?"is-speaking":"is-writing"}`}><span className="today-next-icon"><Icon/></span><span><small>{speaking?"SPEAKING TASK":"WRITING TASK"}</small><strong>{h.title}</strong><em>{h.estimatedMinutes?`About ${h.estimatedMinutes} min · `:""}{h.due?`Due ${h.due}`:"No deadline set"}</em></span><ChevronRightIcon/></Link>;
}

export default function TodayView({unit}:{unit:Unit|null}){
  const {code,displayName,studentId}=useStudent(),base=`/s/${code}`;
  const [note,setNote]=useState(""),[assignments,setAssignments]=useState<Assignment[]>([]),[error,setError]=useState(""),[loaded,setLoaded]=useState(false);
  async function refresh(){setError("");try{const [n,a]=await Promise.all([fetchNote(code),fetchAssignments(code)]);if(n.ok)setNote(n.note||"");if(a.ok)setAssignments((a.assignments?.rows||[]).map(rowToAssignment).filter(x=>isCurrentAssignment(x)&&x.status!=="done"));if(!n.ok||!a.ok)setError(n.error||a.error||"Could not load your latest update.");}catch{setError("Could not load your latest update. Please try again.");}finally{setLoaded(true)}}
  useEffect(()=>{void refresh();},[code]);
  const now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const ready=(unit?.homework||[]).filter(h=>!h.availableFrom||h.availableFrom<=today);
  return <main className="re-home today-page">
    <header className="re-page-heading"><p className="re-eyebrow">YOUR LEARNING SPACE</p><h1>Hi, {displayName}. Here’s your next step.</h1><p>Pick one task, practise it, and come back for feedback.</p></header>
    <div className="today-layout"><div className="today-primary">
      <section className="today-next-section" aria-labelledby="today-work-title"><div className="today-section-heading"><div><p className="work-eyebrow">START HERE</p><h2 id="today-work-title">Ready for you</h2></div><Link href={`${base}/homework/`}>All homework <ChevronRightIcon/></Link></div>
        {!loaded&&<div className="work-loading" role="status">Checking for updates from Rory…</div>}
        {error&&<div className="work-alert" role="alert">{error}<button onClick={()=>void refresh()}>Try again</button></div>}
        <div className="today-next-list">{assignments.slice(0,2).map(a=><Link key={a.id} href={`${base}/homework/`} className="today-next-card"><span className="today-next-icon"><CheckSquareIcon/></span><span><small>ASSIGNED BY RORY</small><strong>{a.title}</strong><em>{a.due?`Due ${a.due}`:"No deadline set"}</em></span><ChevronRightIcon/></Link>)}{ready.slice(0,3).map(h=><WeekLink key={h.week} h={h} unit={unit!} base={base}/>)}</div>
        {loaded&&!error&&!assignments.length&&!ready.length&&<div className="work-empty"><BookIcon/><strong>No new homework right now.</strong><p>You can practise speaking or open your current lesson.</p></div>}
      </section>
      <section className="today-practice-section" aria-labelledby="today-practice-title"><div className="today-section-heading"><div><p className="work-eyebrow">KEEP GOING</p><h2 id="today-practice-title">Ways to practise</h2></div></div><div className="ux-route-grid"><Link className="ux-route-card" href={`${base}/speak/`}><MicrophoneIcon/><span><strong>Speaking</strong><small>Have a short conversation</small></span><ChevronRightIcon/></Link><Link className="ux-route-card" href={`${base}/lessons/`}><BookIcon/><span><strong>Lessons</strong><small>Current unit and past work</small></span><ChevronRightIcon/></Link><Link className="ux-route-card" href={`${base}/study/`}><RepeatIcon/><span><strong>Practice</strong><small>Try a study tool</small></span><ChevronRightIcon/></Link></div></section>
      <section className="today-feedback-card"><MessageIcon/><div><p className="work-eyebrow">AFTER YOU TRY</p><h2>Use Rory’s feedback</h2><p>See what worked and what to try next.</p><Link href={`${base}/progress/`}>Open feedback & progress <ChevronRightIcon/></Link></div></section>
    </div><aside className="today-secondary"><section className={`ux-panel ${note?"re-mentor-card":""}`}><div className="ux-panel-heading"><span className="re-avatar">R</span><h2>From Rory</h2></div><p className="ux-subtle today-rory-note">{note?<FeedbackText text={note}/>:!loaded?"Checking your latest note…":"Your next note will appear here when Rory adds it."}</p></section><section className="ux-panel"><div className="ux-panel-heading"><BookIcon/><h2>Current unit</h2></div><p className="ux-chip">{unit?.schoolYear||"2026–27"}</p><h3 className="mt-3 font-bold">{unit?.title||"Ready for the next lesson"}</h3><p className="ux-subtle mt-2">{unit?.note||"Rory will confirm your current materials."}</p><Link className="ux-link-row" href={`${base}/resources/`}><FileIcon/>Open lesson resources<ChevronRightIcon/></Link></section><Link className="ux-route-card" href={`${base}/test-prep/`}><TargetIcon/><span><strong>Test prep</strong><small>Practise with Rory’s reviews</small></span><ChevronRightIcon/></Link><p className="re-schedule-note">{studentId==="valentin"?"Lessons every second Saturday":"Weekly lessons"}, during term time. Rory confirms dates and deadlines.</p></aside></div>
  </main>;
}
