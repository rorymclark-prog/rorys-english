"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import AppearanceSettings from "./AppearanceSettings";
import StudentPreviewButton from "./StudentPreviewButton";
import { RELEASE_NOTES, LATEST_RELEASE } from "@/lib/whats-new";
import { endStudentPreview, isStudentPreview } from "@/lib/student-preview";
import { logout } from "@/lib/api";
import roster from "../../content/students.json";
export default function AppMenu({code,teacher=false}:{code?:string;teacher?:boolean}) {
  const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
  const [panel,setPanel]=useState<"menu"|"settings"|"news"|"preview">("menu");
  const [unread,setUnread]=useState(false),[open,setOpen]=useState(false);
  const titleId=useId();
  const preview=isStudentPreview(code);
  const seenKey=`re_news_seen_${teacher||preview?"teacher":code}`;
  useEffect(()=>{try{setUnread(localStorage.getItem(seenKey)!==LATEST_RELEASE);}catch{setUnread(true);}},[seenKey]);
  useEffect(()=>{
    if(!open)return;
    const previous=document.body.style.overflow;document.body.style.overflow="hidden";
    return()=>{document.body.style.overflow=previous;};
  },[open]);
  const close=()=>dialog.current?.close();
  const viewNews=()=>{setPanel("news");setUnread(false);try{localStorage.setItem(seenKey,LATEST_RELEASE);}catch{/* optional badge */}};
  const links=code?[["Today",`/s/${code}/`],["Speaking studio",`/s/${code}/speak/`],["Homework & feedback",`/s/${code}/homework/`],["My documents",`/s/${code}/documents/`],["Lessons & archive",`/s/${code}/lessons/`],["Slides & resources",`/s/${code}/resources/`],["My progress",`/s/${code}/progress/`],["Writing & word helper",`/s/${code}/coach/`]]:[];
  return <>
    <button ref={trigger} type="button" className="app-menu-trigger" aria-label="Open menu" aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setPanel("menu");dialog.current?.showModal();setOpen(true);}}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>Menu</span>{unread&&<span className="app-news-dot" aria-label="New updates"/>}</button>
    <dialog ref={dialog} aria-labelledby={titleId} className="app-menu-dialog" onClose={()=>{setOpen(false);trigger.current?.focus();}} onClick={e=>{if(e.target===dialog.current){const rect=dialog.current.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)close();}}}>
      <header className="mb-6 flex items-center justify-between gap-3"><div>{panel!=="menu"&&<button type="button" className="mb-2 min-h-11 text-sm underline" onClick={()=>setPanel("menu")}>← Menu</button>}<p className="text-xs font-bold uppercase tracking-widest text-navy-soft dark:text-navy-mist">Rory’s English</p><h2 id={titleId} className="mt-1 text-2xl font-extrabold">{panel==="menu"?"Your space":panel==="news"?"What’s new":panel==="preview"?"View as student":"Settings"}</h2></div><button type="button" className="app-menu-close" aria-label="Close menu" onClick={close}>×</button></header>
      {panel==="menu"&&<div className="space-y-2">
        {teacher?<><Link className="app-menu-link" href="/teacher/" onClick={close}>Students & teaching<span aria-hidden>→</span></Link><button type="button" className="app-menu-link w-full" onClick={()=>setPanel("preview")}>View as student<span aria-hidden>↗</span></button></>:links.map(([label,href])=><Link key={href} href={href} onClick={close} className="app-menu-link">{label}<span aria-hidden>→</span></Link>)}
        <div className="my-3 border-t border-black/10 dark:border-white/10"/>
        <button type="button" className="app-menu-link w-full" onClick={()=>setPanel("settings")}>Settings<span className="text-xs font-normal">Appearance & text size</span></button>
        <button type="button" className="app-menu-link w-full" onClick={viewNews}>What’s new{unread?<span className="app-new-pill">New</span>:<span aria-hidden>→</span>}</button>
        {preview?<button type="button" className="app-menu-link w-full" onClick={()=>{endStudentPreview();window.location.assign(`${process.env.NEXT_PUBLIC_BASE_PATH||""}/teacher/`);}}>Back to teacher workspace<span aria-hidden>↗</span></button>:<button type="button" className="app-menu-link w-full" onClick={async()=>{close();await logout(teacher?"__teacher__":code||"");}}>Sign out<span aria-hidden>↗</span></button>}
      </div>}
      {panel==="settings"&&<AppearanceSettings/>}
      {panel==="preview"&&<div className="space-y-3"><p className="mb-4 text-sm text-navy-soft dark:text-navy-mist">Open the same pages your student sees. Preview is read-only, so their answers and progress stay unchanged.</p>{roster.map(s=><StudentPreviewButton key={s.code} code={s.code} name={s.displayName} onOpen={close}/>)}</div>}
      {panel==="news"&&<div className="space-y-6">{RELEASE_NOTES.map(note=><article key={note.date} className="rounded-2xl bg-black/5 p-4 dark:bg-white/5"><p className="text-xs text-navy-soft dark:text-navy-mist">{note.date}</p><h3 className="my-2 font-bold">{note.title}</h3><ul className="list-disc space-y-2 pl-4 text-sm leading-relaxed">{note.items.map(item=><li key={item}>{item}</li>)}</ul></article>)}</div>}
    </dialog>
  </>;
}
