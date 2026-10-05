import type {LearningRecord} from './learning';
import type {Assignment,Progress,Submission} from './remote';
import type {Unit} from './types';
import {isCompletedAssignment} from './clarity';
import {isCurrentAssignment} from './remote';
import {isFerdiSpeakingHomework} from './speaking-homework';
import {guidedSpeakingForHomework} from './guided-speaking';
import {readLessonAssessment,matchedChange} from './lesson-assessment';
import {isTeachingPack} from './teaching-files';
export type Requirement='required'|'optional'|'unclassified';
export type DashboardSettings={version:1;requirements:Record<string,Requirement>;schoolContext:string};
export function dashboardSettings(value:unknown):DashboardSettings {
 const v=value as Partial<DashboardSettings>|null;
 if(!v||v.version!==1||typeof v.schoolContext!=='string'||!v.requirements||typeof v.requirements!=='object'||Array.isArray(v.requirements))return {version:1,requirements:{},schoolContext:''};
 const requirements=Object.fromEntries(Object.entries(v.requirements).filter(([,r])=>['required','optional','unclassified'].includes(r)));
 return {version:1,requirements,schoolContext:v.schoolContext.slice(0,1500)};
}
export type Checkpoint={version:1;objective:string;protocol:string;support:string;criteria:{skill:string;earned:number|null;possible:number;evidence:string}[];strength:string;target:string;nextCheck:string};
export function readCheckpoint(v:unknown):Checkpoint|null {
 if(!v||typeof v!=='object')return null;const c=v as Checkpoint;
 if(c.version!==1||[c.objective,c.protocol,c.support,c.strength,c.target,c.nextCheck].some(x=>typeof x!=='string')||!Array.isArray(c.criteria)||!c.criteria.length||c.criteria.length>8)return null;
 if(c.criteria.some(x=>!x||typeof x.skill!=='string'||typeof x.evidence!=='string'||!Number.isFinite(x.possible)||x.possible<=0||x.possible>1000||(x.earned!==null&&(!Number.isFinite(x.earned)||x.earned<0||x.earned>x.possible||!x.evidence.trim()))))return null;
 return c;
}
export function checkpointResult(c:Checkpoint):{earned:number;possible:number;percent:number}|null {
 if(!readCheckpoint(c)||c.criteria.some(x=>x.earned===null))return null;
 const earned=c.criteria.reduce((s,x)=>s+x.earned!,0),possible=c.criteria.reduce((s,x)=>s+x.possible,0);
 return {earned,possible,percent:Math.round(earned/possible*100)};
}
export function checkpointChange(before:Checkpoint,after:Checkpoint):number|null {
 const a=checkpointResult(before),b=checkpointResult(after);
 const same=before.objective===after.objective&&!!before.protocol.trim()&&before.protocol===after.protocol&&before.support==='Independent first attempt'&&after.support===before.support&&JSON.stringify(before.criteria.map(x=>[x.skill,x.possible]))===JSON.stringify(after.criteria.map(x=>[x.skill,x.possible]));
 return same&&a&&b?b.percent-a.percent:null;
}
export function viennaDay(date:Date=new Date()):string {return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Vienna',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function eventDay(raw:string|number):string|null {
 const text=String(raw).trim();if(!text)return null;
 if(/^\d{4,5}(\.\d+)?$/.test(text))return new Date(Date.UTC(1899,11,30)+Math.floor(Number(text))*86400000).toISOString().slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}/.test(text))return null;
 const day=text.slice(0,10),date=new Date(day+'T12:00:00Z');if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==day)return null;
 if(/(?:Z|[+-]\d{2}:\d{2})$/.test(text)){const instant=new Date(text);return Number.isNaN(instant.getTime())?null:viennaDay(instant);}
 return day;
}
export type HomeworkMetric={id:string;title:string;due:string;requirement:Requirement;received:boolean;reviewed:boolean;revision:boolean;overdue:boolean};
export function homeworkMetrics(code:string,unit:Unit|null,assignments:Assignment[],submissions:Submission[],records:LearningRecord[],settings:DashboardSettings,today:string):HomeworkMetric[] {
 const current=assignments.filter(isCurrentAssignment),combined=current.filter(a=>isFerdiSpeakingHomework(code,a));
 const item=(id:string,title:string,due:string,unitId:string,task:string,marked=false,speakingTitle?:string):HomeworkMetric=>{
  const sent=submissions.filter(s=>s.unit===unitId&&s.task===task).sort((a,b)=>b.submitted.localeCompare(a.submitted))[0];
  const speech=!speakingTitle||records.some(r=>r.kind==='speaking'&&r.author==='Student'&&r.title.startsWith(speakingTitle));
  const received=!!sent&&speech,revision=sent?.status==='revision-needed';
  const reviewed=(!revision&&marked)||!!(sent?.status==='reviewed'&&speech);
  const requirement=settings.requirements[id]||'unclassified',dueDay=eventDay(due);
  return {id,title,due,requirement,received,reviewed,revision,overdue:requirement==='required'&&!!dueDay&&dueDay<today&&!received&&!reviewed};
 };
 const items=current.filter(a=>!combined.includes(a)).map(a=>item(`assignment:${a.id}`,a.title,a.due,'assigned',a.id,isCompletedAssignment(a.status)));
 for(const week of unit?.homework||[]){if(week.availableFrom&&week.availableFrom>today)continue;const guided=guidedSpeakingForHomework(code,unit!.id,week.week);
  items.push(item(`unit:${unit!.id}:hw:${week.week}`,week.title,combined[0]?.due||week.due,unit!.id,`hw:${week.week}`,false,guided?.savedTitle));
 }
 return items;
}
export function activityMetrics(records:LearningRecord[],submissions:Submission[],progress:Progress|null,days:number,today:string){
 const start=new Date(today+'T12:00:00Z');start.setUTCDate(start.getUTCDate()-(days-1));const from=start.toISOString().slice(0,10),within=(date:string|null)=>!!date&&date<=today&&(days===0||date>=from);
 const events:{day:string;kind:string}[]=[];
 for(const r of records)if(r.author==='Student'&&r.visibility==='shared'&&r.kind==='speaking'&&within(eventDay(r.body.submittedAt||r.date)))events.push({day:eventDay(r.body.submittedAt||r.date)!,kind:'conversation'});
 const latest=new Map<string,Submission>();for(const s of submissions){const k=JSON.stringify([s.unit,s.task]);if(!latest.has(k)||s.submitted>latest.get(k)!.submitted)latest.set(k,s);}
 for(const s of latest.values())if(within(eventDay(s.submitted)))events.push({day:eventDay(s.submitted)!,kind:'answer'});
 const section=progress?.quizzes,dateCol=section?.headers.findIndex(h=>h.toLowerCase()==='date')??-1;
 if(section&&dateCol>=0)for(const r of section.rows)if(within(eventDay(r[dateCol])))events.push({day:eventDay(r[dateCol])!,kind:'quiz'});
 const dates=[...new Set(events.map(e=>e.day))].sort();
 return {activeDays:dates.length,conversations:events.filter(e=>e.kind==='conversation').length,answers:events.filter(e=>e.kind==='answer').length,quizzes:events.filter(e=>e.kind==='quiz').length,last:dates.at(-1)||null,dates};
}
export function assessedLessons(records:LearningRecord[]){return records.filter(r=>r.kind==='lesson'&&r.visibility==='teacher'&&!isTeachingPack(r)&&readLessonAssessment(r.body.tutorPrivate?.lessonAssessment)).sort((a,b)=>b.date.localeCompare(a.date)||b.created.localeCompare(a.created));}
export function lessonComparisons(records:LearningRecord[]){const lessons=assessedLessons(records),latest=lessons[0];if(!latest)return [];
 const after=readLessonAssessment(latest.body.tutorPrivate?.lessonAssessment)!;
 return after.checks.map(check=>{for(const r of lessons.slice(1)){if(r.date>=latest.date)continue;const before=readLessonAssessment(r.body.tutorPrivate?.lessonAssessment)!;const change=matchedChange(before,after,check.key);if(change!==null)return {task:check.task,score:check.score,change,before:r.date,after:latest.date};}return {task:check.task,score:check.score,change:null,before:null,after:latest.date};});
}
