"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import type {Unit} from "@/lib/types";
import {useStudent} from "@/components/StudentContext";
import Screen from "@/components/Screen";
import {fetchNote,fetchAssignments,rowToAssignment,isCurrentAssignment,type Assignment} from "@/lib/remote";
export default function TodayView({unit}:{unit:Unit|null}) {
  const {code,greeting,studentId}=useStudent();
  const [note,setNote]=useState("");const [assignments,setAssignments]=useState<Assignment[]>([]);
  const [error,setError]=useState("");const [loaded,setLoaded]=useState(false);
  const homework=unit?.homework||[];
  async function refresh() {
    setError("");
    const [n,a]=await Promise.all([fetchNote(code),fetchAssignments(code)]);setLoaded(true);
    if(n.ok)setNote(n.note||"");
    if(a.ok)setAssignments((a.assignments?.rows||[]).map(rowToAssignment).filter(a=>isCurrentAssignment(a)&&a.status!=="done"));
    if(!n.ok||!a.ok)setError(n.error||a.error||"Could not load the latest update.");
  }
  useEffect(()=>{void refresh();},[code]);
  const card="mt-4 block rounded-card bg-surface p-5 shadow-card dark:bg-navy-raised";
  return <Screen title={greeting||"Hello"} subtitle="Your English lesson hub">
    <section className={card}>
      <p className="text-xs font-bold uppercase tracking-wide">Start here</p>
      <h2 className="mt-2 text-xl font-bold">Your homework &amp; feedback</h2>
      {homework.map(h=><Link key={h.week} href={`/s/${code}/lessons/${unit!.id}/homework/${h.week}/`} className="mt-4 block rounded-xl border border-indigo-200 p-4">
        <span className="block font-bold">{h.title} →</span>
        <span className="mt-1 block text-sm">{h.estimatedMinutes?`About ${h.estimatedMinutes} minutes · `:""}{h.due?`Due ${h.due}`:"Available now · no deadline set"}</span>
      </Link>)}
      {!loaded&&<p role="status" className="mt-3">Checking for updates from Rory…</p>}
      {error&&<p role="alert" className="mt-3">{error} <button onClick={()=>void refresh()} className="underline">Retry</button></p>}
      {loaded&&!error&&!homework.length&&!assignments.length&&<p className="mt-3">No new homework assigned yet.</p>}
      {assignments.slice(0,3).map(a=><p className="mt-3 text-sm" key={a.id}>{a.title}{a.due?" · Due "+a.due:""}</p>)}
      <Link href={`/s/${code}/homework/`} className="mt-4 inline-block rounded-xl bg-indigo-700 px-4 py-3 font-bold text-white">All homework &amp; feedback →</Link>
      <p className="mt-3 text-sm">Save a draft, send your answers, then return here for Rory’s feedback.</p>
    </section>
    {note&&<section className={card}><h2 className="font-bold">From Rory</h2><p className="mt-2 whitespace-pre-wrap">{note}</p></section>}
    <section className={card}>
      <p className="text-xs font-bold uppercase tracking-wide">Current schoolwork · {unit?.schoolYear||"2026–27"}</p>
      <h2 className="mt-2 text-xl font-bold">{unit?.title||"New term — ready for your textbook"}</h2>
      <p className="mt-2 text-sm">{unit?.note||"Rory will confirm your current book and unit before setting new material. Last year’s work remains in the archive."}</p>
      {unit?.tutoringFocus&&<p className="mt-3">{unit.tutoringFocus}</p>}
      <Link href={`/s/${code}/lessons/`} className="mt-3 inline-block underline">Lesson materials &amp; previous years →</Link>
    </section>
    <Link className={card} href={`/s/${code}/coach/`}><h2 className="font-bold">Writing &amp; word helper</h2><p className="mt-1 text-sm">Try it yourself, ask for a hint, then revise. AI feedback is practice advice, not Rory’s assessment.</p></Link>
    <div className="grid grid-cols-2 gap-3">
      <Link className={card} href={`/s/${code}/resources/`}>Slides &amp; resources</Link>
      <Link className={card} href={`/s/${code}/progress/`}>My progress</Link>
    </div>
    <p className="mt-5 text-sm">{studentId==="valentin"?"Lessons every second Saturday":"Weekly lessons"}, during term time. Rory will confirm lesson dates and homework deadlines.</p>
  </Screen>;
}
