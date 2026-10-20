import type {LearningRecord,LearningReply} from './learning';
import type {LearnerDocument} from './documents';
import type {Submission,Progress} from './remote';
import {learningRecordsOnce,softwareCheck} from './evidence-common';
import {eventDay} from './teacher-metrics';
export type EngagementPeriod='day'|'week'|'month'|'semester'|'year';
export type EngagementEvent={id:string;day:string;kind:'conversation'|'upload'|'answer'|'reply'|'quiz';seconds:number|null};
export type EngagementSource={records:LearningRecord[];documents:LearnerDocument[];submissions:Submission[];replies:LearningReply[];progress:Progress|null};
export const shiftDay=(day:string,n:number)=>new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const monday=(day:string)=>shiftDay(day,-((new Date(day+'T12:00:00Z').getUTCDay()+6)%7));
function schoolStart(year:number){const first=`${year}-09-01`;return shiftDay(first,(8-new Date(first+'T12:00:00Z').getUTCDay())%7);}
// Vienna's verified 2025/26 and 2026/27 semester boundaries; no assumed future dates.
const semesterStart:Record<number,string>={2025:'2026-02-02',2026:'2027-02-01'};
export function periodRange(period:EngagementPeriod,anchor:string){
 const year=Number(anchor.slice(0,4)),month=Number(anchor.slice(5,7));
 const sy=anchor>=schoolStart(year)?year:year-1,schoolFrom=schoolStart(sy),schoolTo=shiftDay(schoolStart(sy+1),-1),semester=semesterStart[sy];
 let from=anchor,to=anchor,label='Day';
 if(period==='week'){from=monday(anchor);to=shiftDay(from,6);label='Week';}
 if(period==='month'){from=anchor.slice(0,7)+'-01';to=new Date(Date.UTC(year,month,0,12)).toISOString().slice(0,10);label='Month';}
 if(period==='year'){from=schoolFrom;to=schoolTo;label=`School year ${sy}–${String(sy+1).slice(-2)}`;}
 if(period==='semester'){from=semester&&anchor>=semester?semester:schoolFrom;to=semester&&anchor<semester?shiftDay(semester,-1):schoolTo;label=semester?`${anchor<semester?'First':'Second'} semester`:'School year · semester dates unconfirmed';}
 return {from,to,label};
}
export function captionSeconds(transcript:string):number|null {
 // Elapsed saved conversation, including partner and pauses. Never learner talk time.
 const times=[...transcript.matchAll(/\[(\d+(?:\.\d+)?)s\]/g)].map(m=>Number(m[1]));
 const last=Math.max(...times);return times.length>1&&last>0&&last<=7200?last:null;
}
export function engagementEvents(source:EngagementSource,today:string):EngagementEvent[]{
 const events=new Map<string,EngagementEvent>();
 const add=(id:string,raw:string|number,kind:EngagementEvent['kind'],seconds:number|null=null)=>{const day=eventDay(raw);if(day&&day<=today)events.set(id,{id,day,kind,seconds});};
 for(const r of learningRecordsOnce(source.records))if(r.author==='Student'&&r.visibility==='shared'&&r.kind==='speaking'&&!softwareCheck(r.title))add('conversation:'+r.id,r.body.submittedAt||r.date,'conversation',captionSeconds(r.body.transcript||''));
 for(const d of source.documents)if(d.uploadedBy==='Student'&&!softwareCheck(d.title)&&!d.files.some(f=>f.type.startsWith('audio/'))&&!/Student voice sample for speaking record/i.test(d.context))add('upload:'+d.id,d.created,'upload');
 for(const s of source.submissions)if(!softwareCheck(s.title,s.task))add('answer:'+s.id,s.submitted,'answer');
 for(const r of source.replies)if(r.author==='Student'&&r.answer.trim())add('reply:'+r.id,r.created,'reply');
 const section=source.progress?.quizzes,date=section?.headers.findIndex(h=>h.toLowerCase()==='date')??-1;
 if(section&&date>=0)section.rows.forEach((r,i)=>{if(!softwareCheck(...r.slice(0,3)))add('quiz:'+i,r[date],'quiz');});
 return [...events.values()].sort((a,b)=>a.day.localeCompare(b.day));
}
export function engagementTotals(events:EngagementEvent[],from:string,to:string){
 const selected=events.filter(e=>e.day>=from&&e.day<=to),days=new Set(selected.map(e=>e.day));
 return {actions:selected.length,activeDays:days.size,conversations:selected.filter(e=>e.kind==='conversation').length,minutes:selected.reduce((s,e)=>s+(e.seconds||0),0)/60,untimed:selected.filter(e=>e.kind==='conversation'&&e.seconds===null).length,uploads:selected.filter(e=>e.kind==='upload').length,answers:selected.filter(e=>e.kind==='answer').length,replies:selected.filter(e=>e.kind==='reply').length,quizzes:selected.filter(e=>e.kind==='quiz').length,last:selected.at(-1)?.day||null};
}
export const engagementHolidays=[
 {from:'2026-10-26',to:'2026-11-02'}, {from:'2026-12-08',to:'2026-12-08'},
 {from:'2026-12-24',to:'2027-01-06'}, {from:'2027-02-01',to:'2027-02-07'},
 {from:'2027-03-20',to:'2027-03-29'}, {from:'2027-05-01',to:'2027-05-01'},
 {from:'2027-05-06',to:'2027-05-06'}, {from:'2027-05-15',to:'2027-05-17'},
 {from:'2027-05-27',to:'2027-05-27'}, {from:'2027-07-03',to:'2027-09-05'},
];
export function weeklyEngagement(events:EngagementEvent[],anchor:string,extraBreaks:{from:string;to:string}[]=[],goal=30){
 const {from,to}=periodRange('week',anchor),breaks=[...engagementHolidays,...extraBreaks];
 const holiday=(day:string)=>breaks.some(b=>day>=b.from&&day<=b.to);
 const teachingDays=Array.from({length:5},(_,i)=>shiftDay(from,i)).filter(d=>!holiday(d));
 const known=from>='2026-10-19'&&from<'2027-07-03';
 const target=known?goal*teachingDays.length/5:null;
 const minutes=engagementTotals(events.filter(e=>!holiday(e.day)),from,to).minutes;
 return {from,to,target,minutes,paused:known&&holiday(anchor),closed:target!==null&&target>0&&minutes>=target,remaining:target===null?null:Math.max(0,target-minutes)};
}
