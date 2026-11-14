"use client";
import Link from "next/link";
import type {HomeworkWeek} from "@/lib/types";
import {useStudent} from "@/components/StudentContext";
import SubmissionForm from "@/components/SubmissionForm";
import {getTaskValue,setTaskValue} from "@/lib/storage";
import {markEffort} from "@/lib/momentum";
import {buildHomeworkIcs,downloadIcs,parseDueDate} from "@/lib/ics";
import {guidedSpeakingForHomework} from "@/lib/guided-speaking";
import HomeworkAudioRecorder from "@/components/HomeworkAudioRecorder";
import {readableDate} from "@/lib/clarity";
import {isHomeworkReleased} from "@/lib/homework-release";
import {lessonDate,viennaDate} from "@/lib/lesson-calendar";
import Screen from "@/components/Screen";
import {ClockIcon,MessageIcon,PencilIcon} from "@/components/Icons";
import {MicrophoneIcon} from "@/components/LearningVisuals";
export default function HomeworkWeekView({unitId,week,backHref,archived=false}:{unitId:string;week:HomeworkWeek;backHref:string;archived?:boolean}) {
  const {studentId,code}=useStudent();
  // A week that has not opened yet is hidden from the lists; it must not open from its address either.
  if(week.availableFrom&&!isHomeworkReleased(week,viennaDate()))return <Screen title="Homework" subtitle={week.title}><div className="week-page"><Link href={`/s/${code}/homework/`} className="week-back">← Back to homework</Link><p className="week-notice" role="status"><strong>This homework opens on {lessonDate(week.availableFrom)}.</strong> Come back then. Nothing is lost.</p></div></Screen>;
  const due=parseDueDate(week.due);
  const guided=guidedSpeakingForHomework(code,unitId,week.week);
  const voiceTask=week.tasks.find(task=>task.type==="voice");
  const requiredTasks=week.tasks.filter(task=>!task.optional);
  const optionalChat=voiceTask?.optional===true;
  const speaking=requiredTasks.some(task=>task.type==="voice"),Icon=speaking?MicrophoneIcon:PencilIcon;
  const maths=week.subject==="maths",writing=week.tasks.some(task=>task.type==="written");
  const taskLabel=week.focus==="writing-spelling"?"Writing and spelling":maths?"Maths check":speaking&&writing?"Speaking and writing task":speaking?"Speaking task":"Writing task";
  return <Screen title={week.title} subtitle={taskLabel}>
    <div className="week-page">
    <Link href={backHref} className="week-back">← Back to homework</Link>
    <section className={`week-summary ${speaking?"is-speaking":"is-writing"}`}><span className="week-summary-icon"><Icon/></span><div><p className="work-eyebrow">{archived?"OPTIONAL REVISION":taskLabel.toUpperCase()}</p><h2>{week.focus==="writing-spelling"?week.week===1?"Start with your writing":"Practise spelling, then improve your writing":"What you’ll do"}</h2>{week.description&&<p>{week.description}</p>}<div className="week-facts"><span><ClockIcon/> {week.estimatedMinutes?`About ${week.estimatedMinutes} minutes`:"Work at your own pace"}</span><span>{week.due?`Due ${readableDate(week.due)}`:"No deadline set"}</span>{week.availableFrom&&<span>Available from {readableDate(week.availableFrom)}</span>}</div></div></section>
    {week.focus==="writing-spelling"&&<div className="week-notice"><p><strong>{week.week===1?"1. Write → 2. List tricky words → 3. Send answers to Rory":"1. Practise five spellings → 2. Improve your paragraph → 3. Send answers to Rory"}</strong></p><p>Your spelling practice comes from your own writing. You can do the homework without speaking.</p><a className="re-button mt-3 inline-flex" href="#homework-answers">{week.week===1?"Start writing":"Start spelling practice"} ↓</a>{week.week===2&&<p className="mt-3"><Link className="underline" href={`/s/${code}/lessons/${unitId}/homework/1/`} target="_blank" rel="noopener">Open my Session 1 writing in another tab ↗</Link></p>}</div>}
    {archived&&<p className="week-notice">Previous-year archive · optional revision, not current homework.</p>}
    {!optionalChat&&(guided?<div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm dark:border-indigo-800 dark:bg-navy-raised"><strong>{studentId==="ferdi"?"Step 1 · Speak once":"Conversation practice · speak with your AI partner"}</strong><p className="mt-1">Chat {week.week} takes about {guided.duration} and is saved when you end it. No transcript to copy or paste.</p><Link className="mt-3 inline-block font-bold text-indigo-700 underline dark:text-amber" href={`/s/${code}/speak/?guided=${guided.id}`}>Open Chat {week.week} →</Link></div>:week.tasks.some(task=>task.type==="voice")&&<Link className="inline-block rounded-xl border p-3 font-semibold underline" href={`/s/${code}/speak/`}>Open Speaking studio →</Link>)}
    {!optionalChat&&guided?.purpose&&<p className="week-notice"><strong>Why this chat? </strong>{guided.purpose}</p>}
    {voiceTask&&!optionalChat&&!archived&&<HomeworkAudioRecorder code={code} studentId={studentId} unitId={unitId} week={week.week} title={week.title} prompt={voiceTask.prompt}/>}
    {week.focus!=="writing-spelling"&&week.objectives&&<section className="week-objectives"><div className="ux-panel-heading"><MessageIcon/><h2>What to focus on</h2></div><ul>{week.objectives.map(o=><li key={o}>{o}</li>)}</ul></section>}
    <h2 id="homework-answers" className="week-form-heading scroll-mt-6">{week.focus==="writing-spelling"?"Your homework":"Your steps and answers"}</h2>
    <SubmissionForm code={code} unit={unitId} task={"hw:"+week.week} title={week.title} fields={requiredTasks}
      initialAnswers={Object.fromEntries(week.tasks.map(t=>[t.id,getTaskValue(studentId,unitId,week.week,t.id)]))}
      onSaved={answers=>Object.entries(answers).forEach(([id,v])=>setTaskValue(studentId,unitId,week.week,id,v))}
      onSubmitted={()=>markEffort(studentId,code)}/>
    {optionalChat&&guided&&<details className="week-notice"><summary className="cursor-pointer font-bold">Optional · 3-minute AI chat: {guided.title}</summary><p className="mt-3">{voiceTask.prompt}</p><p className="mt-2"><strong>Why speak?</strong> {guided.purpose}</p><p className="mt-2">Click Open optional AI chat, then Start conversation. Allow your microphone and say “Hello”; the AI will ask the first question. When finished, click End conversation to save. Return here for your writing. No extra recording or chat report is needed.</p><Link className="re-button mt-3 inline-flex" href={`/s/${code}/speak/?guided=${guided.id}`}>Open optional AI chat →</Link></details>}
    {week.source&&<p className="text-xs">{week.source}</p>}
    {due && !archived && <button className="min-h-11 rounded-xl border p-3" onClick={()=>downloadIcs(unitId+".ics",buildHomeworkIcs(week.title+" (due)",due,studentId+"-"+unitId+"-"+week.week))}>Add deadline to calendar</button>}
    </div>
  </Screen>;
}
