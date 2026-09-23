"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import type {Unit} from "@/lib/types";
import {useStudent} from "@/components/StudentContext";
import Screen from "@/components/Screen";
import SubmissionForm from "@/components/SubmissionForm";
import SpeakingHomeworkCard from "@/components/views/SpeakingHomeworkCard";
import {isFerdiSpeakingHomework} from "@/lib/speaking-homework";
import {fetchAssignments,rowToAssignment,isCurrentAssignment,type Assignment} from "@/lib/remote";
export default function HomeworkListView({unit}:{unit:Unit|null}) {
  const {code}=useStudent();
  const [assignments,setAssignments]=useState<Assignment[]>([]);
  const [error,setError]=useState("");
  const [loaded,setLoaded]=useState(false);
  async function refresh() {
    setError("");const r=await fetchAssignments(code);setLoaded(true);
    if(r.ok) setAssignments((r.assignments?.rows||[]).map(rowToAssignment));
    else setError(r.error||"Could not load homework. Please retry.");
  }
  useEffect(()=>{void refresh();},[code]);
  const current=assignments.filter(isCurrentAssignment);
  const previous=assignments.filter(a=>!isCurrentAssignment(a));
  const hasSpeakingHomework=current.some(a=>isFerdiSpeakingHomework(code,a));
  return <Screen title="Homework & feedback" subtitle={unit?.title}>
    {!hasSpeakingHomework && <Link className="doc-homework-link" href={`/s/${code}/documents/`}>Working on paper? Scan or upload your work <span aria-hidden>↗</span></Link>}
    {!hasSpeakingHomework && <p className="mt-3 text-sm">Short tasks between lessons during term time. No holiday or school-break work is assumed; Rory sets each deadline.</p>}
    {error && <div role="alert" className="mt-4 rounded-xl border p-4">{error}<button className="ml-3 underline" onClick={()=>void refresh()}>Retry</button></div>}
    {!loaded && <p role="status" className="mt-4">Loading your assignments…</p>}
    {current.map(a=>isFerdiSpeakingHomework(code,a)?<SpeakingHomeworkCard key={a.id} code={code} assignment={a}/>:<details key={a.id} className="mt-4 rounded-card bg-surface p-4 shadow-card dark:bg-navy-raised">
      <summary className="cursor-pointer font-bold">{!isCurrentAssignment(a)?"Previous material · ":""}{a.title}{a.status==="done"?" · Reviewed":""}{a.due?" · "+a.due:""}</summary>
      <p className="my-3 whitespace-pre-wrap">{a.details}</p>
      <SubmissionForm code={code} unit="assigned" task={a.id} title={a.title} fields={[{id:"answer",prompt:"Your answer or practice notes",type:"written"}]}/>
    </details>)}
    {unit?.homework.map(h=><Link key={h.week} className="mt-4 block rounded-card border p-4" href={`/s/${code}/lessons/${unit.id}/homework/${h.week}/`}>{h.title} · {h.due||"No deadline assigned"}</Link>)}
    {loaded&&!error&&!current.length&&!unit?.homework.length && <p className="mt-6">No new homework assigned yet.</p>}
    {previous.length>0&&<details className="mt-6 rounded-card border p-4">
      <summary className="cursor-pointer font-bold">Previous-year assignments · optional reference ({previous.length})</summary>
      <p className="mt-2 text-sm">Saved from earlier lessons. These are not outstanding tasks for this year.</p>
      {previous.map(a=><details key={a.id} className="mt-4 border-t pt-3">
        <summary className="cursor-pointer">{a.title}{a.due?` · ${a.due}`:""}</summary>
        <p className="my-3 whitespace-pre-wrap">{a.details}</p>
        <SubmissionForm code={code} unit="assigned" task={a.id} title={a.title} fields={[{id:"answer",prompt:"Optional revision or practice notes",type:"written"}]}/>
      </details>)}
    </details>}
    <Link className="mt-6 inline-block underline" href={`/s/${code}/lessons/`}>Current lesson &amp; previous material</Link>
  </Screen>;
}
