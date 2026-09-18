"use client";
import {authed,savedSession} from "./api";
const PREFIX="re_outbox_v2_";
export const syncEnabled=()=>!!process.env.NEXT_PUBLIC_SYNC_URL;
export interface PendingEvent {id:string;code:string;action:string;[key:string]:unknown}
const eventKey=(e:PendingEvent)=>PREFIX+e.code+":"+e.id;
export function outbox(code:string):PendingEvent[] {
  try {return Object.keys(localStorage).filter(k=>k.startsWith(PREFIX+code+":")).map(k=>JSON.parse(localStorage.getItem(k)||"null")).filter(Boolean);}
  catch {return [];}
}
function notify(){window.dispatchEvent(new Event("re-sync-change"));}
export async function deliver(event:PendingEvent):Promise<{ok:boolean;error?:string}> {
  try {
    const existing=localStorage.getItem(eventKey(event));
    if(existing) event=JSON.parse(existing); // Retries keep the original payload.
    else localStorage.setItem(eventKey(event),JSON.stringify(event));
    notify();
  } catch{return {ok:false,error:"This browser could not save your submission. Copy your answer before closing it."};}
  const r=await authed<{ok:boolean;error?:string;id?:string;received?:string}>(event.code,event);
  if(r.ok && (r.id!==event.id || (event.action==="submit" && !r.received))) {
    return {ok:false,error:"Receipt is not confirmed yet. Your saved submission is still waiting to send; please retry."};
  }
  if(r.ok) {
    try {localStorage.removeItem(eventKey(event));notify();}
    catch {return {ok:false,error:"Rory received this copy, but the device queue could not be cleared. A retry will not duplicate it."};}
  }
  return r;
}
let draining=false;
export async function drainSyncQueue() {
  if(draining||typeof window==="undefined"||!navigator.onLine)return;
  draining=true;
  try {
    const keys=Object.keys(localStorage).filter(k=>k.startsWith(PREFIX)&&k.includes(":"));
    for(const key of keys) {
      const event=JSON.parse(localStorage.getItem(key)||"null") as PendingEvent|null;
      if(event&&savedSession(event.code)) {const r=await deliver(event);if(!r.ok)break;}
    }
  } catch { /* Saved entries remain untouched for the next retry. */ }
  finally {draining=false;}
}
export const syncHomework=(code:string,unitId:string,week:number,title:string,complete:boolean)=>
  deliver({action:"event",id:crypto.randomUUID(),type:"homework",code,unitId,week,title,status:complete?"complete":"incomplete"});
export const syncQuiz=(code:string,tool:string,section:string,score:number,total:number)=>
  deliver({action:"event",id:crypto.randomUUID(),type:"quiz",code,tool,section,score,total});
