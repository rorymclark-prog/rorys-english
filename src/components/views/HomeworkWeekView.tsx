"use client";
import Link from "next/link";
import type {HomeworkWeek} from "@/lib/types";
import {useStudent} from "@/components/StudentContext";
import SubmissionForm from "@/components/SubmissionForm";
import {getTaskValue,setTaskValue} from "@/lib/storage";
import {buildHomeworkIcs,downloadIcs,parseDueDate} from "@/lib/ics";
import {guidedSpeakingForHomework} from "@/lib/guided-speaking";
import HomeworkAudioRecorder from "@/components/HomeworkAudioRecorder";
import Screen from "@/components/Screen";
import {ClockIcon,MessageIcon,PencilIcon} from "@/components/Icons";
import {MicrophoneIcon} from "@/components/LearningVisuals";
export default function HomeworkWeekView({unitId,week,backHref,archived=false}:{unitId:string;week:HomeworkWeek;backHref:string;archived?:boolean}) {
  const {studentId,code}=useStudent();
  const due=parseDueDate(week.due);
  const guided=guidedSpeakingForHomework(code,unitId,week.week);
  const voiceTask=week.tasks.find(task=>task.type==="voice");
  const speaking=week.tasks.some(task=>task.type==="voice"),Icon=speaking?MicrophoneIcon:PencilIcon;
  return <Screen title={week.title} subtitle={speaking?"Speaking task":"Writing task"}>
    <div className="week-page">
    <Link href={backHref} className="week-back">← Back to homework</Link>
    <section className={`week-summary ${speaking?"is-speaking":"is-writing"}`}><span className="week-summary-icon"><Icon/></span><div><p className="work-eyebrow">{archived?"OPTIONAL REVISION":speaking?"SPEAKING TASK":"WRITING TASK"}</p><h2>What you’ll do</h2>{week.description&&<p>{week.description}</p>}<div className="week-facts"><span><ClockIcon/> {week.estimatedMinutes?`About ${week.estimatedMinutes} minutes`:"Work at your own pace"}</span><span>{week.due?`Due ${week.due}`:"No deadline set"}</span></div></div></section>
    {archived&&<p className="week-notice">Previous-year archive · optional revision, not current homework.</p>}
    {guided?<div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm dark:border-indigo-800 dark:bg-navy-raised"><strong>{code==="ferdi-7h3k"?"Step 1 · Speak once":"Conversation practice · speak with your AI partner"}</strong><p className="mt-1">Chat {week.week} takes about {guided.duration} and is saved when you end it. No transcript to copy or paste.</p><Link className="mt-3 inline-block font-bold text-indigo-700 underline dark:text-amber" href={`/s/${code}/speak/?guided=${guided.id}`}>Open Chat {week.week} →</Link></div>:week.tasks.some(task=>task.type==="voice")&&<Link className="inline-block rounded-xl border p-3 font-semibold underline" href={`/s/${code}/speak/`}>Open Speaking studio →</Link>}
    {guided?.purpose&&<p className="week-notice"><strong>Why this chat? </strong>{guided.purpose}</p>}
    {voiceTask&&!archived&&<HomeworkAudioRecorder code={code} unitId={unitId} week={week.week} title={week.title} prompt={voiceTask.prompt}/>}
    {week.objectives&&<section className="week-objectives"><div className="ux-panel-heading"><MessageIcon/><h2>What to focus on</h2></div><ul>{week.objectives.map(o=><li key={o}>{o}</li>)}</ul></section>}
    <h2 className="week-form-heading">Your steps and answers</h2>
    <SubmissionForm code={code} unit={unitId} task={"hw:"+week.week} title={week.title} fields={week.tasks}
      initialAnswers={Object.fromEntries(week.tasks.map(t=>[t.id,getTaskValue(studentId,unitId,week.week,t.id)]))}
      onSaved={answers=>Object.entries(answers).forEach(([id,v])=>setTaskValue(studentId,unitId,week.week,id,v))}/>
    {week.source&&<p className="text-xs">{week.source}</p>}
    {due && !archived && <button className="min-h-11 rounded-xl border p-3" onClick={()=>downloadIcs(unitId+".ics",buildHomeworkIcs(week.title+" (due)",due,studentId+"-"+unitId+"-"+week.week))}>Add deadline to calendar</button>}
    </div>
  </Screen>;
}
