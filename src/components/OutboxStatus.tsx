"use client";
import {useEffect,useState} from "react";
import {outbox,parkedItems,recoveredQueueItems,drainSyncQueue,retryParked,discardParked,type ParkedEvent,type RecoveredQueueItem} from "@/lib/sync";
import StatusRow from "@/components/StatusRow";
export default function OutboxStatus({code}:{code:string}) {
  const [count,setCount]=useState(0);
  const [stuck,setStuck]=useState<ParkedEvent[]>([]);
  const [recovery,setRecovery]=useState<RecoveredQueueItem[]>([]);
  useEffect(()=>{
    const refresh=()=>{setCount(outbox(code).length);setStuck(parkedItems(code));setRecovery(recoveredQueueItems(code));};
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
  function downloadRecovery(){const url=URL.createObjectURL(new Blob([JSON.stringify(recovery,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='my-unsent-work-recovery.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  if(!count&&!stuck.length&&!recovery.length)return null;
  return <div className="mx-auto max-w-2xl space-y-2 px-4">
    {count>0&&<StatusRow kind="loading" retryLabel="Send now" onRetry={()=>void drainSyncQueue()}><span className="tnum">{count}</span> {count===1?"answer is":"answers are"} saved on this device, waiting to send.</StatusRow>}
    {/* Work the service refused. It stays here rather than blocking everything
        behind it, and the student decides what happens to it. */}
    {stuck.map(item=><StatusRow key={item.event.id} kind="error" retryLabel="Try again" onRetry={()=>{retryParked(code,item.event.id);void drainSyncQueue();}}>One answer could not be sent: {item.error} <button type="button" className="underline" onClick={()=>discardParked(code,item.event.id)}>Remove it</button></StatusRow>)}
    {recovery.length>0&&<section className="studio-queue-recovery" aria-label="Unsent work recovery"><p>One or more device copies could not be read. They have been kept separately so your other answers can send. Download the recovery copy and ask Rory for help.</p><button type="button" className="re-button re-secondary" onClick={downloadRecovery}>Download recovery copy</button></section>}
  </div>;
}
