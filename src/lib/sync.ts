"use client";
import { isStudentPreview, PREVIEW_NOTICE } from "./student-preview";
import {authed,savedSession} from "./api";
const PREFIX="re_outbox_v2_";
// A submission the service keeps refusing is moved here rather than deleted:
// the work is still the student's, so it stays readable and retryable.
const PARKED_PREFIX="re_outbox_parked_v1_";
const QUARANTINE_PREFIX="re_outbox_recovery_v1_";
const META_KEY="re_outbox_meta_v1";
const LOCK_KEY="re_sync_drain_lock";
// Tries before a refused submission is parked so the queue behind it can move.
const MAX_ATTEMPTS=5;
// Per student. Over this, the oldest are parked — never silently dropped.
const QUEUE_MAX=50;
const LOCK_MS=60000;
export const syncEnabled=()=>!!process.env.NEXT_PUBLIC_SYNC_URL;
export interface PendingEvent {id:string;code:string;action:string;[key:string]:unknown}
export interface ParkedEvent {event:PendingEvent;error:string;parked:number}
const eventKey=(e:PendingEvent)=>PREFIX+e.code+":"+e.id;
const parkedKey=(code:string,id:string)=>PARKED_PREFIX+code+":"+id;
export interface RecoveredQueueItem {originalKey:string;raw:string;detectedAt:number;reason:string}
function quarantine(key:string,code:string,raw:string,reason:string){
  try {const record:RecoveredQueueItem={originalKey:key,raw,detectedAt:Date.now(),reason};
    localStorage.setItem(QUARANTINE_PREFIX+code+":"+Date.now()+"_"+Math.random().toString(36).slice(2),JSON.stringify(record));
    localStorage.removeItem(key);
  }catch{/* Keep the original raw copy if recovery storage is unavailable. */}
}
function parseEvent(key:string,code:string):PendingEvent|null{
  const raw=localStorage.getItem(key);if(!raw)return null;
  try{const value=JSON.parse(raw);if(!value||typeof value.id!=="string"||!value.id||value.code!==code||typeof value.action!=="string"||!value.action||key!==PREFIX+code+":"+value.id)throw new Error("Invalid queue entry");return value;}
  catch{quarantine(key,code,raw,"This local copy could not be read. Other saved work can still send.");return null;}
}
export function recoveredQueueItems(code:string):RecoveredQueueItem[]{
  if(isStudentPreview())return [];
  try{return Object.keys(localStorage).filter(k=>k.startsWith(QUARANTINE_PREFIX+code+":")).flatMap(key=>{try{const v=JSON.parse(localStorage.getItem(key)||"null");return v&&typeof v.raw==='string'&&typeof v.originalKey==='string'&&Number.isFinite(v.detectedAt)?[v as RecoveredQueueItem]:[];}catch{return [];}});}catch{return [];}
}
export function outbox(code:string):PendingEvent[] {
  if(isStudentPreview())return [];
  try {return Object.keys(localStorage).filter(k=>k.startsWith(PREFIX+code+":")).flatMap(key=>{const event=parseEvent(key,code);return event?[event]:[];});}
  catch {return [];}
}
export function parkedItems(code:string):ParkedEvent[] {
  if(isStudentPreview())return [];
  try {return Object.keys(localStorage).filter(k=>k.startsWith(PARKED_PREFIX+code+":")).flatMap(key=>{
    const raw=localStorage.getItem(key);if(!raw)return [];try{const value=JSON.parse(raw);if(!value?.event||value.event.code!==code||typeof value.event.id!=="string"||typeof value.error!=="string")throw new Error('Invalid parked entry');return [value as ParkedEvent];}catch{quarantine(key,code,raw,"This unsent local copy needs recovery.");return [];}
  });}catch{return [];}
}
function notify(){window.dispatchEvent(new Event("re-sync-change"));}
// Tries and queue order live beside the queue, never inside the payload: a
// retry must send exactly what the student's device first saved.
interface Meta {tries:number;queued:number}
function readMeta():Record<string,Meta> {
  try {const value=JSON.parse(localStorage.getItem(META_KEY)||"{}");return value&&typeof value==="object"?value as Record<string,Meta>:{};}
  catch {return {};}
}
function writeMeta(next:Record<string,Meta>){try{localStorage.setItem(META_KEY,JSON.stringify(next));}catch{/* counting is best effort */}}
function noteQueued(key:string){const all=readMeta();if(!all[key])
  {all[key]={tries:0,queued:Date.now()};writeMeta(all);}}
function countAttempt(key:string):number{
  const all=readMeta();const meta=all[key]||{tries:0,queued:Date.now()};
  meta.tries+=1;all[key]=meta;writeMeta(all);return meta.tries;
}
function clearMeta(key:string){const all=readMeta();if(key in all){delete all[key];writeMeta(all);}}
function park(key:string,error:string){
  try {
    const raw=localStorage.getItem(key);
    if(raw){
      const event=JSON.parse(raw) as PendingEvent;
      const record:ParkedEvent={event,error,parked:Date.now()};
      localStorage.setItem(parkedKey(event.code,event.id),JSON.stringify(record));
    }
    localStorage.removeItem(key);
  } catch {/* The entry stays queued; the next drain tries again. */}
  clearMeta(key);
  notify();
}
export function retryParked(code:string,id:string){
  try {
    const raw=localStorage.getItem(parkedKey(code,id));
    if(!raw)return;
    const {event}=JSON.parse(raw) as ParkedEvent;
    localStorage.setItem(PREFIX+code+":"+event.id,JSON.stringify(event));
    localStorage.removeItem(parkedKey(code,id));
  } catch {/* Nothing moved; the parked copy is still there. */}
  notify();
}
export function discardParked(code:string,id:string){
  try {localStorage.removeItem(parkedKey(code,id));} catch {/* already gone */}
  notify();
}
// Keeps one student's queue bounded by parking the oldest entries.
function enforceCap(code:string){
  try {
    const keys=Object.keys(localStorage).filter(k=>k.startsWith(PREFIX+code+":"));
    if(keys.length<=QUEUE_MAX)return;
    const meta=readMeta();
    const oldestFirst=keys.sort((a,b)=>(meta[a]?.queued??0)-(meta[b]?.queued??0));
    for(const key of oldestFirst.slice(0,keys.length-QUEUE_MAX)) park(key,"This was waiting a long time behind other work. Rory has not received it yet.");
  } catch {/* Leave the queue as it is. */}
}
export async function deliver(event:PendingEvent):Promise<{ok:boolean;error?:string;offline?:boolean;authRequired?:boolean}> {
  if(isStudentPreview())return {ok:false,error:PREVIEW_NOTICE};
  try {
    const existing=localStorage.getItem(eventKey(event));
    if(existing) event=JSON.parse(existing); // Retries keep the original payload.
    else {localStorage.setItem(eventKey(event),JSON.stringify(event));noteQueued(eventKey(event));enforceCap(event.code);}
    notify();
  } catch{return {ok:false,error:"This browser could not save your submission. Copy your answer before closing it."};}
  const r=await authed<{ok:boolean;error?:string;offline?:boolean;authRequired?:boolean;id?:string;received?:string}>(event.code,event);
  if(r.ok && (r.id!==event.id || (event.action==="submit" && !r.received))) {
    return {ok:false,error:"Receipt is not confirmed yet. Your saved submission is still waiting to send; please retry."};
  }
  if(r.ok) {
    try {localStorage.removeItem(eventKey(event));clearMeta(eventKey(event));notify();}
    catch {return {ok:false,error:"Rory received this copy, but the device queue could not be cleared. A retry will not duplicate it."};}
  }
  return r;
}
// One tab drains at a time. The service is idempotent, so a stale lock costs a
// duplicate request at worst — never a lost submission.
const tabId=Math.random().toString(36).slice(2);
function lockHeldElsewhere():boolean {
  try {
    const raw=localStorage.getItem(LOCK_KEY);
    if(!raw)return false;
    const lock=JSON.parse(raw) as {at?:number;tab?:string}|null;
    return !!lock&&lock.tab!==tabId&&typeof lock.at==="number"&&Date.now()-lock.at<LOCK_MS;
  } catch {return false;}
}
function holdLock(){try{localStorage.setItem(LOCK_KEY,JSON.stringify({at:Date.now(),tab:tabId}));}catch{/* single tab then */}}
function releaseLock(){
  try {const raw=localStorage.getItem(LOCK_KEY);if(raw&&(JSON.parse(raw) as {tab?:string})?.tab===tabId)localStorage.removeItem(LOCK_KEY);}
  catch {/* it expires on its own */}
}
let draining=false;
export async function drainSyncQueue() {
  if(isStudentPreview())return;
  if(draining||typeof window==="undefined"||!navigator.onLine)return;
  if(lockHeldElsewhere())return;
  draining=true;holdLock();
  try {
    const keys=Object.keys(localStorage).filter(k=>k.startsWith(PREFIX)&&k.includes(":"));
    for(const key of keys) {
      const code=key.slice(PREFIX.length).split(":")[0];
      const event=parseEvent(key,code);
      if(!event||!savedSession(event.code))continue;
      holdLock(); // Keep it fresh through a long drain.
      const r=await deliver(event);
      if(r.ok)continue;
      // Offline, or the student has to sign in again: stop and keep everything
      // queued. Neither is this submission's fault, so neither costs it a try.
      if(r.offline||r.authRequired)break;
      // The service answered and refused. Let the rest of the queue through,
      // and park this one once it has had its tries.
      if(countAttempt(key)>=MAX_ATTEMPTS)park(key,r.error||"Rory’s app could not accept this submission.");
    }
  } catch { /* Saved entries remain untouched for the next retry. */ }
  finally {draining=false;releaseLock();}
}
export const syncHomework=(code:string,unitId:string,week:number,title:string,complete:boolean)=>
  deliver({action:"event",id:crypto.randomUUID(),type:"homework",code,unitId,week,title,status:complete?"complete":"incomplete"});
export const syncQuiz=(code:string,tool:string,section:string,score:number,total:number)=>
  deliver({action:"event",id:crypto.randomUUID(),type:"quiz",code,tool,section,score,total});
