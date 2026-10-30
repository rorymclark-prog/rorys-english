"use client";

import { useRef, useState } from "react";
import { readCoachFolder, type CoachFolderFile, type CoachFolderLesson } from "@/lib/coach-folder";
import type { CoachCloudMaterialMeta } from "@/components/CoachLibraryConnection";

export default function CoachFolderLibrary({code,name,studentId,blocked,selectedId="",onOpen}:{code:string;name:string;studentId?:string;blocked:boolean;selectedId?:string;onOpen:(file:File,meta:CoachCloudMaterialMeta)=>Promise<void>}) {
  const [lessons,setLessons]=useState<CoachFolderLesson[]>([]);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const scope=useRef(code);scope.current=code;
  const revision=useRef(0);
  async function connect(files:FileList|null) {
    if(!files||blocked||busy)return;
    const attempt=++revision.current;setBusy(true);setError("");
    try {const value=await readCoachFolder(Array.from(files) as CoachFolderFile[]);if(attempt===revision.current)setLessons(value);}
    catch(error){if(attempt===revision.current)setError(error instanceof Error?error.message:"The saved folder could not open.");}
    finally{if(attempt===revision.current)setBusy(false);}
  }
  async function open(lesson:CoachFolderLesson) {
    if(blocked||busy||lesson.learner!==studentId)return;
    const owner=code;setBusy(true);setError("");
    try {
      const guide=lesson.guide&&lesson.guide.size<=500000?(await lesson.guide.text()).slice(0,500000):"";
      if(scope.current!==owner)return;
      await onOpen(lesson.document,{learnerCode:owner,packId:`folder:${lesson.id}`,title:lesson.title,focus:lesson.title,historical:false,warning:"",edition:"Saved self-contained lesson folder",guide});
    }catch(error){if(scope.current===owner)setError(error instanceof Error?error.message:"This lesson could not open.");}
    finally{setBusy(false);}
  }
  const available=lessons.filter(lesson=>lesson.learner===studentId);
  const shown=available;
  return <section className="lc-saved-lessons" aria-label="Saved lesson folder">
    <h3>Your prepared lessons</h3>
    <p className="lc-hint">Connect the saved lesson folder for this teaching session, then choose any prepared lesson for either student. Files stay on this device; only your selected lesson supplies AI context after consent.</p>
    <label className="lc-upload">{busy?"Opening saved lessons…":lessons.length?"Change saved lesson folder":"Connect saved lesson folder"}<input type="file" {...{webkitdirectory:"",directory:""}} multiple disabled={blocked||busy} onChange={event=>{void connect(event.target.files);event.target.value="";}}/></label>
    {error&&<p className="lc-error" role="alert">{error}</p>}
    {!!lessons.length&&<><p role="status">{available.length} prepared lessons for {name}</p><label>Prepared lesson<select value={available.some(lesson=>`cloud:folder:${lesson.id}`===selectedId)?selectedId.slice("cloud:folder:".length):""} disabled={blocked||busy} onChange={event=>{const lesson=shown.find(item=>item.id===event.target.value);if(lesson)void open(lesson);}}><option value="">Choose a prepared lesson…</option>{shown.map(lesson=><option key={lesson.id} value={lesson.id}>{lesson.title} · {lesson.format}</option>)}</select></label>{!shown.length&&<p className="lc-hint">No matching prepared lesson for this student.</p>}</>}
  </section>;
}
