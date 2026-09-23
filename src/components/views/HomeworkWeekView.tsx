"use client";
import Link from "next/link";
import type {HomeworkWeek} from "@/lib/types";
import {useStudent} from "@/components/StudentContext";
import SubmissionForm from "@/components/SubmissionForm";
import {getTaskValue,setTaskValue} from "@/lib/storage";
import {buildHomeworkIcs,downloadIcs,parseDueDate} from "@/lib/ics";
import {guidedSpeakingForHomework} from "@/lib/guided-speaking";
export default function HomeworkWeekView({unitId,week,backHref,archived=false}:{unitId:string;week:HomeworkWeek;backHref:string;archived?:boolean}) {
  const {studentId,code}=useStudent();
  const due=parseDueDate(week.due);
  const guided=guidedSpeakingForHomework(code,unitId,week.week);
  return <main className="space-y-4 p-5">
    <Link href={backHref} className="inline-block py-3">← Homework &amp; feedback</Link>
    <h1 className="display text-2xl">{week.title}</h1>
    {archived&&<p className="rounded-xl border p-3">Previous-year archive · optional revision, not current homework.</p>}
    {week.estimatedMinutes&&<p className="font-semibold">About {week.estimatedMinutes} minutes</p>}
    {week.description&&<p>{week.description}</p>}
    {guided?<div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm dark:border-indigo-800 dark:bg-navy-raised"><strong>{code==="ferdi-7h3k"?"Step 1 · Speak once":"Conversation practice · speak with your AI partner"}</strong><p className="mt-1">Chat {week.week} takes about {guided.duration} and is saved when you end it. No transcript to copy or paste.</p><Link className="mt-3 inline-block font-bold text-indigo-700 underline dark:text-amber" href={`/s/${code}/speak/?guided=${guided.id}`}>Open Chat {week.week} →</Link></div>:week.tasks.some(task=>task.type==="voice")&&<Link className="inline-block rounded-xl border p-3 font-semibold underline" href={`/s/${code}/speak/`}>Open Speaking studio →</Link>}
    {guided&&week.tasks.some(task=>task.type==="voice")&&<Link className="inline-block rounded-xl border p-3 font-semibold underline" href={`/s/${code}/speak/`}>Open recording rehearsal →</Link>}
    {week.objectives&&<ul className="list-disc pl-5">{week.objectives.map(o=><li key={o}>{o}</li>)}</ul>}
    <p>{week.due?"Due "+week.due:"No deadline assigned"}</p>
    <SubmissionForm code={code} unit={unitId} task={"hw:"+week.week} title={week.title} fields={week.tasks}
      initialAnswers={Object.fromEntries(week.tasks.map(t=>[t.id,getTaskValue(studentId,unitId,week.week,t.id)]))}
      onSaved={answers=>Object.entries(answers).forEach(([id,v])=>setTaskValue(studentId,unitId,week.week,id,v))}/>
    {week.source&&<p className="text-xs">{week.source}</p>}
    {due && !archived && <button className="min-h-11 rounded-xl border p-3" onClick={()=>downloadIcs(unitId+".ics",buildHomeworkIcs(week.title+" (due)",due,studentId+"-"+unitId+"-"+week.week))}>Add deadline to calendar</button>}
  </main>;
}
