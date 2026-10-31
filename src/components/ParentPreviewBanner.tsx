"use client";
import { endParentPreview, isParentPreview } from "@/lib/parent-preview";
import ParentPreviewButton from "./ParentPreviewButton";
import roster from "../../content/students.json";
export default function ParentPreviewBanner({code,name}:{code:string;name:string}) {
  if(!isParentPreview(code))return null;
  return <aside className="m-5" aria-label="Parent preview"><div className="preview-banner"><div><strong>Viewing as {name}’s parent</strong><p>Read-only preview · the same shared information parents see.</p></div><button type="button" onClick={()=>{endParentPreview();window.location.assign(`${process.env.NEXT_PUBLIC_BASE_PATH||""}/teacher/`);}}>Exit preview ↗</button></div><details className="mt-3"><summary className="cursor-pointer text-sm font-bold">View another student’s parent page</summary>{roster.filter(student=>student.parentCode!==code).map(student=><ParentPreviewButton key={student.parentCode} code={student.parentCode} name={student.displayName}/>)}</details></aside>;
}
