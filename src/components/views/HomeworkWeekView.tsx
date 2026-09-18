"use client";
import Link from "next/link";
import type {HomeworkWeek} from "@/lib/types";
import {useStudent} from "@/components/StudentContext";
import SubmissionForm from "@/components/SubmissionForm";
import {getTaskValue,setTaskValue} from "@/lib/storage";
import {buildHomeworkIcs,downloadIcs,parseDueDate} from "@/lib/ics";
export default function HomeworkWeekView({unitId,week,backHref,archived=false}:{unitId:string;week:HomeworkWeek;backHref:string;archived?:boolean}) {
  const {studentId,code}=useStudent();
  const due=parseDueDate(week.due);
  return <main className="space-y-4 p-5">
    <Link href={backHref} className="inline-block py-3">← Homework &amp; feedback</Link>
    <h1 className="display text-2xl">{week.title}</h1>
    {archived&&<p className="rounded-xl border p-3">Previous-year archive · optional revision, not current homework.</p>}
    {week.estimatedMinutes&&<p className="font-semibold">About {week.estimatedMinutes} minutes</p>}
    {week.description&&<p>{week.description}</p>}
    {week.objectives&&<ul className="list-disc pl-5">{week.objectives.map(o=><li key={o}>{o}</li>)}</ul>}
    <p>{week.due?"Due "+week.due:"No deadline assigned"}</p>
    <SubmissionForm code={code} unit={unitId} task={"hw:"+week.week} title={week.title} fields={week.tasks}
      initialAnswers={Object.fromEntries(week.tasks.map(t=>[t.id,getTaskValue(studentId,unitId,week.week,t.id)]))}
      onSaved={answers=>Object.entries(answers).forEach(([id,v])=>setTaskValue(studentId,unitId,week.week,id,v))}/>
    {week.source&&<p className="text-xs">{week.source}</p>}
    {due && !archived && <button className="min-h-11 rounded-xl border p-3" onClick={()=>downloadIcs(unitId+".ics",buildHomeworkIcs(week.title+" (due)",due,studentId+"-"+unitId+"-"+week.week))}>Add deadline to calendar</button>}
  </main>;
}
