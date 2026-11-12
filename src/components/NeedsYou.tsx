"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {inboxRequest} from "@/lib/inbox";
import {needsYou,type Need,type NeedStudent} from "@/lib/needs-you";
import {ChevronRightIcon} from "@/components/Icons";

/**
 * The first thing on the teacher home: what is waiting, one line each.
 * It reads the notifications Rory already has; it marks nothing as read.
 */
export default function NeedsYou({students,token}:{students:readonly NeedStudent[];token:string}){
  const [needs,setNeeds]=useState<Need[]|null>(null),[failed,setFailed]=useState(false);
  const pending=useRef(false);
  const refresh=useCallback(async()=>{
    if(pending.current||!token)return;pending.current=true;
    try{const r=await inboxRequest("__teacher__",token,{action:"teacherNotifications"});if(r.ok){setNeeds(needsYou(r.events||[],students));setFailed(false);}else setFailed(true);}
    catch{setFailed(true);}finally{pending.current=false;}
  },[students,token]);
  useEffect(()=>{void refresh();const again=()=>{if(!document.hidden)void refresh();};window.addEventListener("focus",again);window.addEventListener("re-inbox-change",again);return()=>{window.removeEventListener("focus",again);window.removeEventListener("re-inbox-change",again);};},[refresh]);
  return <section className="needs-you" aria-labelledby="needs-you-title" aria-busy={needs===null&&!failed}>
    <div className="needs-you-heading"><h2 id="needs-you-title">Needs you today{needs&&needs.length>0&&<span>{needs.length}</span>}</h2><a href="/teacher/?inbox=notifications">All notifications</a></div>
    {failed&&!needs?<p role="status" className="needs-you-note">This could not be checked. <button type="button" onClick={()=>void refresh()}>Try again</button> or open your notifications.</p>
    :needs===null?<p role="status" className="needs-you-note">Checking what is waiting…</p>
    :needs.length===0?<p className="needs-you-note">Nothing is waiting for you. New work and messages will appear here.</p>
    :<ul>{needs.map(need=><li key={need.id}><a href={need.href} className={`needs-you-row needs-${need.kind}`}><i aria-hidden="true"/><span><strong>{need.title}</strong><small>{need.detail}</small></span><ChevronRightIcon/></a></li>)}</ul>}
    {failed&&needs&&<p role="status" className="needs-you-note">The latest check failed, so this list may be out of date. <button type="button" onClick={()=>void refresh()}>Try again</button></p>}
  </section>;
}
