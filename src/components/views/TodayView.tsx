"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import type {Unit} from "@/lib/types";
import {useStudent} from "@/components/StudentContext";
import {fetchNote,fetchAssignments,rowToAssignment,isCurrentAssignment,type Assignment} from "@/lib/remote";
import {BookIcon,CheckSquareIcon,ChartIcon,ChevronRightIcon} from "@/components/Icons";
import {MicrophoneIcon,ChatIcon,RepeatIcon,ConversationArt,TopicArt} from "@/components/LearningVisuals";
export default function TodayView({unit}:{unit:Unit|null}) {
 const {code,displayName,studentId}=useStudent();
 const [note,setNote]=useState("");const [assignments,setAssignments]=useState<Assignment[]>([]);
 const [error,setError]=useState("");const [loaded,setLoaded]=useState(false);
 const base=`/s/${code}`;const homework=unit?.homework||[];
 async function refresh(){setError("");try{const [n,a]=await Promise.all([fetchNote(code),fetchAssignments(code)]);if(n.ok)setNote(n.note||"");if(a.ok)setAssignments((a.assignments?.rows||[]).map(rowToAssignment).filter(x=>isCurrentAssignment(x)&&x.status!=="done"));if(!n.ok||!a.ok)setError(n.error||a.error||"Could not load your latest update.");}catch{setError("Could not load your latest update. Please try again.");}finally{setLoaded(true)}}
 useEffect(()=>{void refresh();},[code]);
 return <main className="re-home"><header className="re-page-heading"><p className="re-eyebrow">MAKE YOURSELF UNDERSTOOD</p><h1>Your next small step, {displayName}.</h1><p>A little practice. A useful conversation. Something to build on.</p></header>
 <nav className="re-learning-path" aria-label="Your learning cycle">{[{title:"Learn",text:"In your lesson",url:"lessons/",Icon:BookIcon},{title:"Try",text:"In your own words",url:"speak/",Icon:MicrophoneIcon},{title:"Reflect",text:"Use your feedback",url:"homework/",Icon:ChatIcon},{title:"Remember",text:"Try it again",url:"study/",Icon:RepeatIcon}].map(({title,text,url,Icon},i)=><Link href={`${base}/${url}`} key={title}><span className={`re-path-icon re-tone-${i}`}><Icon/></span><strong>{title}</strong><small>{text}</small></Link>)}</nav>
 <div className="re-home-grid"><div><section className="re-hero"><div><p className="re-eyebrow">SPEAKING STUDIO</p><h2>Your ideas.<br/>A little more confidence.</h2><p>Make room for a conversation. Practise one useful target, at your own pace.</p><Link href={`${base}/speak/`} className="re-button">Explore speaking practice <ChevronRightIcon width={18}/></Link><small>Short sessions · one clear language target</small></div><ConversationArt/></section>
 <div className="re-section-heading"><h2>Your learning, this week</h2><Link href={`${base}/homework/`}>All homework →</Link></div>
 {!loaded&&<div className="re-card" role="status">Checking for updates from Rory…</div>}
 {error&&<div className="re-card" role="alert"><p>{error}</p><button className="re-button re-secondary" onClick={()=>void refresh()}>Try again</button></div>}
 {homework.map(h=><Link key={h.week} href={`${base}/lessons/${unit!.id}/homework/${h.week}/`} className="re-task-card"><span className="re-task-image"><TopicArt kind={1}/></span><span className="re-task-copy"><strong>{h.title}</strong><small>{h.estimatedMinutes?`About ${h.estimatedMinutes} minutes · `:""}{h.due?`Due ${h.due}`:"No deadline set"}</small></span><ChevronRightIcon/></Link>)}
 {assignments.slice(0,3).map(a=><Link className="re-task-card" href={`${base}/homework/`} key={a.id}><span className="re-path-icon re-tone-2"><CheckSquareIcon/></span><span className="re-task-copy"><strong>{a.title}</strong><small>{a.due?`Due ${a.due}`:"Available now · no deadline set"}</small></span><ChevronRightIcon/></Link>)}
 {loaded&&!error&&!homework.length&&!assignments.length&&<div className="re-card"><BookIcon/><h3 className="mt-3 font-bold">A little breathing room.</h3><p className="mt-2 text-sm">No new homework assigned yet. Your lesson materials and earlier work are still here.</p></div>}
 <Link href={`${base}/homework/`} className="re-callout"><ChatIcon/><span><strong>Turn feedback into your next attempt</strong><small>Keep your first draft, read Rory’s feedback and try again.</small></span><ChevronRightIcon/></Link>
 <div className="re-section-heading"><h2>Keep useful English close</h2></div><div className="re-two-cards"><Link className="re-card re-feature-card" href={`${base}/coach/`}><span className="re-path-icon re-tone-1"><ChatIcon/></span><h3>Writing & word help</h3><p>Try it first. Ask for a hint. Make it your own.</p><span>Open helper →</span></Link><Link className="re-card re-feature-card" href={`${base}/progress/`}><span className="re-path-icon"><ChartIcon/></span><h3>See your progress</h3><p>Your practice, feedback and recorded work.</p><span>View progress →</span></Link></div></div>
 <aside className="re-supporting"><section className={`re-card ${note?"re-mentor-card":""}`}><div className="re-note-heading"><span className="re-avatar">R</span><div><h2>From Rory</h2><small>Your next learning steps</small></div></div>{note?<p className="re-real-note">{note}</p>:<p className="mt-5 text-sm">{loaded&&!error?"Your next note will appear here when Rory adds it.":"Checking your latest note…"}</p>}<Link className="re-text-link" href={`${base}/homework/`}>Homework & feedback →</Link></section>
 <section className="re-card"><p className="re-eyebrow">CURRENT SCHOOLWORK · {unit?.schoolYear||"2026–27"}</p><TopicArt kind={0}/><h2 className="mt-3 font-bold">{unit?.title||"Ready for the next lesson"}</h2><p className="mt-3 text-sm">{unit?.note||"Rory will confirm your current materials. Last year’s work remains in the archive."}</p>{unit?.tutoringFocus&&<p className="mt-3 text-sm">{unit.tutoringFocus}</p>}<Link className="re-text-link" href={`${base}/resources/`}>Slides & resources →</Link></section>
 <p className="re-schedule-note">{studentId==="valentin"?"Lessons every second Saturday":"Weekly lessons"}, during term time. Rory will confirm lesson dates and homework deadlines.</p></aside></div>
 </main>;
}
