import type {LearningRecord} from './learning';
import {lessonBriefId,readLessonBrief,type LessonBrief} from './lesson-brief';
export type BriefSaveBase={version:1;token:string|null};
export type BriefDeviceDraft=LessonBrief&{_saveBase?:BriefSaveBase};
export const latestBriefRecord=(records:LearningRecord[]|undefined)=>records?.filter(r=>r.id===lessonBriefId).sort((a,b)=>b.created.localeCompare(a.created))[0];
/** Device-only metadata never enters the teacher's saved learning record. */
export function briefSaveValue(b:LessonBrief):LessonBrief{return {version:1,unitId:b.unitId,unitTitle:b.unitTitle,priorities:b.priorities,opening:b.opening,practice:b.practice,exit:b.exit,support:b.support,reserve:b.reserve,duration:b.duration,minutes:b.minutes,reserveMinutes:b.reserveMinutes};}
export function briefRecordToken(record:LearningRecord|undefined):string{return record?JSON.stringify([record.id,record.created,record.date,record.kind,record.visibility,record.body.tutorPrivate?.lessonBrief??null]):'absent';}
export function briefSaveBase(record:LearningRecord|undefined):BriefSaveBase{return {version:1,token:briefRecordToken(record)};}
export function readBriefSaveBase(value:unknown):BriefSaveBase|null{if(!value||typeof value!=='object')return null;const b=value as BriefSaveBase;return b.version===1&&(b.token===null||typeof b.token==='string'&&b.token.length<=35000)?b:null;}
export function briefSaveReceipt(record:LearningRecord|undefined,b:LessonBrief):boolean{return !!record&&record.id===lessonBriefId&&record.visibility==='teacher'&&record.kind==='test'&&JSON.stringify(record.body.tutorPrivate?.lessonBrief)===JSON.stringify(briefSaveValue(b));}
export type BriefSaveDecision={action:'confirmed'|'write'|'conflict';latest:LearningRecord|undefined;token:string};
/** Read-before-write detects known changes; the existing API does not provide an atomic compare-and-swap. */
export function decideBriefSave(records:LearningRecord[]|undefined,value:LessonBrief,base:BriefSaveBase|null,replaceToken?:string):BriefSaveDecision{
 const latest=latestBriefRecord(records),token=briefRecordToken(latest);
 const action=briefSaveReceipt(latest,value)?'confirmed':replaceToken===token||base?.token===token||!latest?'write':'conflict';
 return {action,latest,token};
}
export type BriefRecoveryCopy={version:1;savedAt:number;brief:LessonBrief};
type BriefStorage=Pick<Storage,'getItem'|'setItem'|'key'|'length'>;
/** Verify a scoped recovery copy before adopting the other version. Existing copies are never removed. */
export function keepBriefRecoveryCopy(storage:BriefStorage,scopeKey:string,value:LessonBrief,savedAt:number,id:string):void{
 if(!scopeKey||!Number.isFinite(savedAt)||!id)throw Error('The device recovery destination is unavailable. Your draft is kept.');
 const key=`${scopeKey}_brief_conflict_${savedAt}_${id}`;if(storage.getItem(key)!==null)throw Error('The recovery destination already exists. Your draft is kept.');
 const text=JSON.stringify({version:1,savedAt,brief:briefSaveValue(value)} satisfies BriefRecoveryCopy);storage.setItem(key,text);if(storage.getItem(key)!==text)throw Error('The device copy could not be kept safely. Download it before continuing.');
}
export function latestBriefRecoveryCopy(storage:BriefStorage,scopeKey:string):BriefRecoveryCopy|null{
 let latest:BriefRecoveryCopy|null=null;for(let i=0;i<storage.length;i++){const key=storage.key(i);if(!key?.startsWith(`${scopeKey}_brief_conflict_`))continue;try{const copy=JSON.parse(storage.getItem(key)||'') as BriefRecoveryCopy;if(copy.version===1&&Number.isFinite(copy.savedAt)&&readLessonBrief(copy.brief)&&(!latest||copy.savedAt>latest.savedAt))latest=copy;}catch{/* A corrupt recovery copy stays untouched. */}}
 return latest;
}
