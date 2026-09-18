"use client";
import { useState } from "react";
import { startStudentPreview } from "@/lib/student-preview";
export default function StudentPreviewButton({code,name,onOpen}:{code:string;name:string;onOpen?:()=>void}) {
  const [error,setError]=useState("");
  return <div><button type="button" className="app-menu-link w-full" onClick={()=>{
    if(!startStudentPreview(code)){setError("Please sign in to your teacher account again first.");return;}
    onOpen?.();window.location.assign(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/s/${code}/`);
  }}>View as {name}<span aria-hidden="true">↗</span></button>{error&&<p role="alert" className="mt-2 text-sm text-bad dark:text-bad-bright">{error}</p>}</div>;
}
