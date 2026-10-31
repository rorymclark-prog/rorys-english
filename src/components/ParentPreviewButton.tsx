"use client";
import {useParentLanguage} from "./ParentLanguage";
import { useState } from "react";
import { startParentPreview } from "@/lib/parent-preview";
export default function ParentPreviewButton({code,name,onOpen}:{code:string;name:string;onOpen?:()=>void}) {
  const {t}=useParentLanguage();
  const [error,setError]=useState("");
  return <div><button type="button" className="app-menu-link w-full" onClick={()=>{
    if(!startParentPreview(code)){setError("Please sign in to your teacher account again first.");return;}
    onOpen?.();window.location.assign(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/p/${code}/`);
  }}>{t(`View as ${name}’s parent`,`Elternbereich für ${name} ansehen`)}<span aria-hidden="true">↗</span></button>{error&&<p role="alert" className="mt-2 text-sm text-bad dark:text-bad-bright">{error}</p>}</div>;
}
