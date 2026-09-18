"use client";
import {useEffect,useState} from "react";
import {outbox,drainSyncQueue} from "@/lib/sync";
export default function OutboxStatus({code}:{code:string}) {
  const [count,setCount]=useState(0);
  useEffect(()=>{
    const refresh=()=>setCount(outbox(code).length);
    const retry=()=>{void drainSyncQueue();};
    refresh();retry();
    window.addEventListener("re-sync-change",refresh);
    window.addEventListener("storage",refresh);
    window.addEventListener("online",retry);
    window.addEventListener("re-auth-change",retry);
    return()=>{
      window.removeEventListener("re-sync-change",refresh);window.removeEventListener("storage",refresh);
      window.removeEventListener("online",retry);window.removeEventListener("re-auth-change",retry);
    };
  },[code]);
  return count?<div role="status" className="mx-auto max-w-2xl rounded-xl bg-amber-100 p-3 text-sm text-slate-900">{count} saved submission(s) waiting to send. <button className="underline" onClick={()=>void drainSyncQueue()}>Retry now</button></div>:null;
}
