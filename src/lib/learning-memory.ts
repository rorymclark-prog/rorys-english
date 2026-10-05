import type {LearningRecord} from './learning';
import {readLessonPractice} from './lesson-practice';

export type MemorySettings={enabled:boolean;since:string;focus:string[];excludedIds:string[]};
export type MemorySource={id:string;date:string;kind:'lesson'|'ai-conversation'|'rory-feedback';summary:string;strengths:string[];targets:string[]};
export type LearningMemory={version:1;code:string;generatedAt:string;enabled:boolean;focus:string[];sources:MemorySource[]};
const clean=(v:unknown,max:number)=>typeof v==='string'?v.replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):'';
const list=(v:unknown,n:number,max:number)=>Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,n).map(x=>clean(x,max)).filter(Boolean):[];
export function memorySettings(value:unknown):MemorySettings{
 const v=value&&typeof value==='object'?value as Record<string,unknown>:{};
 return {enabled:v.enabled!==false,since:/^20\d\d-\d\d-\d\d$/.test(String(v.since))?String(v.since):'',focus:list(v.focus,2,250),excludedIds:list(v.excludedIds,50,100)};
}
/** A fresh, bounded snapshot of this authenticated learner's released records. */
export function buildLearningMemory(code:string,records:LearningRecord[],settingsValue?:unknown,now=new Date()):LearningMemory{
 const settings=memorySettings(settingsValue),memory:LearningMemory={version:1,code,generatedAt:now.toISOString(),enabled:settings.enabled,focus:settings.focus,sources:[]};
 if(!settings.enabled)return {...memory,focus:[]};
 const cutoff=new Date(now.getTime()-90*86400000).toISOString().slice(0,10),since=settings.since>cutoff?settings.since:cutoff,today=now.toISOString().slice(0,10);
 const eligible=records.filter(r=>r.visibility==='shared'&&!r.reviewPending&&r.date>=since&&r.date<=today&&!settings.excludedIds.includes(r.id)&&!r.body.source?.includes('/lesson-recording/'))
  .sort((a,b)=>b.date.localeCompare(a.date)||b.created.localeCompare(a.created));
 let lessons=0,chats=0,teacher=0;
 for(const r of eligible){
  const p=readLessonPractice(r.body.lessonPractice);
  if(p&&p.status==='ready'&&r.date===p.lessonDate&&lessons++<1)memory.sources.push({id:r.id,date:r.date,kind:'lesson',summary:clean(p.recap,500),strengths:[],targets:list(p.focus,3,250)});
  else if(r.kind==='speaking'&&r.body.evidenceType==='AI conversation captions'&&chats<3){
   const feedback=r.body.plainAiFeedback;
   // Saved feedback is learning evidence. Never forward a full transcript, reflection or audio.
   if(feedback){chats++;memory.sources.push({id:r.id,date:r.date,kind:'ai-conversation',summary:clean(feedback.summary,300),strengths:list(feedback.strengths,2,250),targets:list(feedback.targets,2,250)});}
   else if(r.body.aiAnalysis){chats++;memory.sources.push({id:r.id,date:r.date,kind:'ai-conversation',summary:clean(r.body.aiAnalysis,1000),strengths:[],targets:[]});}
  }else if(r.author==='Rory'&&!r.body.lessonPractice&&!r.body.aiAnalysis&&r.body.evidenceType!=='AI conversation captions'&&teacher++<1){
   memory.sources.push({id:r.id,date:r.date,kind:'rory-feedback',summary:clean(r.body.summary,300),strengths:list(r.body.strengths,2,250),targets:list(r.body.targets,2,250)});
  }
 }
 return memory;
}
export function memoryInput(memory:LearningMemory):string|undefined{
 if(!memory.enabled||(!memory.sources.length&&!memory.focus.length))return undefined;
 // IDs and account identifiers stay in the app, never in model context.
 return JSON.stringify({currentFocusFromRory:memory.focus,recentLearning:memory.sources.map(({date,kind,summary,strengths,targets})=>({date,kind,summary,strengths,targets}))});
}
