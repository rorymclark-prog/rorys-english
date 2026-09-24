"use client";
import {useEffect,useState} from "react";
import {outbox,parkedItems,drainSyncQueue,retryParked,discardParked,type ParkedEvent} from "@/lib/sync";
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
  return <div className="mx-auto max-w-2xl space-y-2">
    {count>0&&<div role="status" className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn dark:bg-warn-dusk dark:text-warn-bright">
      <span className="font-semibold tnum">{count}</span> {count===1?"answer is":"answers are"} saved on this device, waiting to send.{" "}
      <button className="min-h-11 font-semibold underline underline-offset-2" onClick={()=>void drainSyncQueue()}>Send now</button>
    </div>}
    {/* Work the service refused. It stays here rather than blocking everything
        behind it, and the student decides what happens to it. */}
    {stuck.map(item=><div key={item.event.id} role="status" className="rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad dark:bg-bad-dusk dark:text-bad-bright">
      <p className="font-semibold">One answer could not be sent.</p>
      <p className="mt-1 opacity-90">{item.error}</p>
      <p className="mt-2 flex flex-wrap gap-4">
        <button className="min-h-11 font-semibold underline underline-offset-2" onClick={()=>{retryParked(code,item.event.id);void drainSyncQueue();}}>Try again</button>
        <button className="min-h-11 font-semibold underline underline-offset-2" onClick={()=>discardParked(code,item.event.id)}>Remove it</button>
      </p>
      <p className="mt-1 opacity-90">Show this to Rory if it keeps happening.</p>
    </div>)}
  </div>;
}
