"use client";
import {useEffect,useState} from "react";
import {outbox,parkedItems,drainSyncQueue,retryParked,discardParked,type ParkedEvent} from "@/lib/sync";
import StatusRow from "@/components/StatusRow";
export default function OutboxStatus({code}:{code:string}) {
  const [count,setCount]=useState(0);
  const [stuck,setStuck]=useState<ParkedEvent[]>([]);
  useEffect(()=>{
    const refresh=()=>{setCount(outbox(code).length);setStuck(parkedItems(code));};
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
  if(!count&&!stuck.length)return null;
  return <div className="mx-auto max-w-2xl space-y-2 px-4">
    {count>0&&<StatusRow kind="loading" retryLabel="Send now" onRetry={()=>void drainSyncQueue()}><span className="tnum">{count}</span> {count===1?"answer is":"answers are"} saved on this device, waiting to send.</StatusRow>}
    {/* Work the service refused. It stays here rather than blocking everything
        behind it, and the student decides what happens to it. */}
    {stuck.map(item=><StatusRow key={item.event.id} kind="error" retryLabel="Try again" onRetry={()=>{retryParked(code,item.event.id);void drainSyncQueue();}}>One answer could not be sent: {item.error} <button type="button" className="underline" onClick={()=>discardParked(code,item.event.id)}>Remove it</button></StatusRow>)}
  </div>;
}
