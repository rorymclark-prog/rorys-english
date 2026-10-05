import type {LearningRecord,LearningReply} from './learning';
import type {LearnerDocument} from './documents';
import type {Progress,Section,Submission} from './remote';
import {documentMeta} from './document-groups';
import {isTeachingPack} from './teaching-files';
import {eventDay} from './teacher-metrics';
import {readSkillCheck,type SkillDomain} from './skill-progress';
import {softwareCheck,learningRecordsOnce} from './evidence-common';
export {softwareCheck,learningRecordsOnce,learnerProgress} from './evidence-common';

export type EvidenceKind='recording'|'conversation'|'writing'|'homework'|'quiz'|'school-test'|'checkpoint';
export const evidenceKinds:Record<EvidenceKind,string>={recording:'Recorded lessons',conversation:'App conversations',writing:'Written work',homework:'Homework & revisions',quiz:'Quizzes', 'school-test':'School tests',checkpoint:'Rory’s checks'};
export type ProgressSource={ref:string;aliases?:string[];kind:EvidenceKind;title:string;date:string;dateBasis:'performed'|'available-by'|'unknown';original?:string};
export type ProgressObservation={version:1;sourceRefs:string[];sources?:ProgressSource[];audioReviewed?:boolean;dateBasis:'performed'|'available-by'|'unknown';method:string;limits:string;observations:{domain:SkillDomain;finding:string;evidence:string;help:'independent'|'hints'|'model'|'unknown';confidence:'clear'|'provisional'}[];nextCheck:string};
export function readProgressObservation(v:unknown):ProgressObservation|null{
 if(!v||typeof v!=='object')return null;const p=v as ProgressObservation;
 if(p.version!==1||!['performed','available-by','unknown'].includes(p.dateBasis)||!Array.isArray(p.sourceRefs)||!p.sourceRefs.length||p.sourceRefs.length>20||p.sourceRefs.some(s=>typeof s!=='string'||!s.trim()||s.length>600)||[p.method,p.limits,p.nextCheck].some(s=>typeof s!=='string'||!s.trim()||s.length>3000)||!Array.isArray(p.observations)||!p.observations.length||p.observations.length>24)return null;
 const domains=['vocabulary','grammar','reading','listening','writing','speaking','pronunciation','fluency'];
 if(p.observations.some(o=>!o||!domains.includes(o.domain)||[o.finding,o.evidence].some(s=>typeof s!=='string'||!s.trim()||s.length>3000)||!['independent','hints','model','unknown'].includes(o.help)||!['clear','provisional'].includes(o.confidence)))return null;
 if(p.observations.some(o=>['pronunciation','fluency'].includes(o.domain))&&p.audioReviewed!==true)return null;
 if(p.sources!==undefined&&(!Array.isArray(p.sources)||p.sources.length>20||p.sources.some(s=>!s||!p.sourceRefs.includes(s.ref)||!Object.hasOwn(evidenceKinds,s.kind)||typeof s.title!=='string'||!s.title.trim()||s.title.length>250||typeof s.date!=='string'||s.date!==''&&!eventDay(s.date)||!['performed','available-by','unknown'].includes(s.dateBasis)||s.original!==undefined&&(typeof s.original!=='string'||s.original.length>15000))))return null;
 if(p.sources?.some(s=>s.aliases!==undefined&&(!Array.isArray(s.aliases)||s.aliases.length>10||s.aliases.some(a=>typeof a!=='string'||a===s.ref||!p.sourceRefs.includes(a)))))return null;
 return p;
}
export type ProgressEvidence={ref:string;aliases?:string[];kind:EvidenceKind;title:string;date:string;dateBasis:'performed'|'available-by'|'unknown';status:'needs-review'|'draft'|'marked'|'receipt-only'|'original-needed';summary:string;unitId:string;unitTitle:string;original?:string};
const hash=(s:string)=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(16);};
const summary=(r:LearningRecord)=>r.body.plainReview?.summary||r.body.plainAiFeedback?.summary||r.body.summary||'';
export function progressEvidence({records,documents=[],submissions=[],replies=[],progress=null}:{records:LearningRecord[];documents?:LearnerDocument[];submissions?:Submission[];replies?:LearningReply[];progress?:Progress|null}):{items:ProgressEvidence[];excluded:number;planned:number}{
 const rs=learningRecordsOnce(records),items:ProgressEvidence[]=[],linkedDocuments=new Set(rs.flatMap(r=>r.body.audioDocumentId?[r.body.audioDocumentId]:[]));let excluded=0,planned=0;
 const checks=rs.flatMap(r=>{const c=readSkillCheck(r.body.tutorPrivate?.skillCheck,r.date);return c?.sourceRef?[c.sourceRef]:[];});
 const observed=new Set(rs.flatMap(r=>readProgressObservation(r.body.tutorPrivate?.progressObservation)?.sourceRefs||[]));
 const status=(ref:string,base:ProgressEvidence['status'])=>checks.includes(ref)?'marked':observed.has(ref)?'draft':base;
 for(const r of rs){
  if(softwareCheck(r.title)){excluded++;continue;}
  if(isTeachingPack(r)||r.body.lessonPractice){planned++;continue;}
  if(r.body.tutorPrivate?.goalPlan||r.body.tutorPrivate?.dashboardSettings||r.body.tutorPrivate?.progressObservation||r.body.skillSnapshot||r.body.lessonSnapshot||r.body.source?.startsWith('skill-progress-summary:')||r.body.source?.startsWith('checkpoint-summary:'))continue;
  const c=readSkillCheck(r.body.tutorPrivate?.skillCheck,r.date);
  if(c?.sourceRef)continue; // assessed source stays one item; its check is linked by reference
  const ref='learning:'+r.id,conversation=r.kind==='speaking'&&r.author==='Student',kind:EvidenceKind=conversation?'conversation':r.body.writing?'writing':r.body.tutorPrivate?.checkpoint||c?'checkpoint':r.kind==='lesson'||r.kind==='speaking'?'recording':r.kind==='test'?'school-test':'homework';
  const date=eventDay(conversation?r.body.submittedAt||r.date:r.date)||'',basis=date?'performed':'unknown';
  items.push({ref,kind,title:r.title,date,dateBasis:basis,status:status(ref,c||r.body.tutorPrivate?.checkpoint?'marked':r.author==='AI draft'||r.body.tutorPrivate?.lessonAssessment?'draft':'needs-review'),summary:summary(r),unitId:c?.unitId||'',unitTitle:c?.unitTitle||r.title,original:r.body.writing?.original||r.body.transcript});
 }
 for(const d of documents){
  if(softwareCheck(d.title)){excluded++;continue;}const meta=documentMeta(d.context);
  if(meta.role==='task'||meta.role==='review'){planned++;continue;}
  if(linkedDocuments.has(d.id)||meta.reviewId&&!d.parentId&&rs.some(r=>r.id===meta.reviewId&&r.body.writing?.original))continue;
  const audio=d.files.some(f=>f.type.startsWith('audio/')),date=eventDay(meta.workDate)||eventDay(d.created)||'',ref='document:'+d.id;
  items.push({ref,kind:audio?'recording':'writing',title:d.title,date,dateBasis:meta.workDate?'performed':date?'available-by':'unknown',status:status(ref,'needs-review'),summary:d.analysis?.summary||'Original saved; assessment needed.',unitId:'',unitTitle:d.title,original:d.analysis?.writing?.original||d.analysis?.transcription});
 }
 for(const s of submissions){if(softwareCheck(s.title,s.task)){excluded++;continue;}const ref='submission:'+s.id;items.push({ref,kind:'homework',title:s.title||s.task,date:eventDay(s.submitted)||'',dateBasis:eventDay(s.submitted)?'performed':'unknown',status:status(ref,'needs-review'),summary:s.status==='revision-needed'?'Revision requested.':'Saved answer; receipt is separate from learning.',unitId:s.unit,unitTitle:s.title||s.task,original:Object.entries(s.answers).map(([k,v])=>`${s.prompts?.[k]||k}: ${v}`).join('\n')});}
 for(const r of replies){if(r.author==='Rory')continue;const ref='reply:'+r.id;items.push({ref,kind:'homework',title:rs.find(x=>x.id===r.reviewId)?.title||'Lesson practice answer',date:eventDay(r.created||'')||'',dateBasis:r.created?'performed':'unknown',status:status(ref,'needs-review'),summary:'Saved learner reply or revision.',unitId:'',unitTitle:'Lesson practice',original:r.answer});}
 const sections:Partial<Record<keyof Progress,EvidenceKind>>={homework:'homework',quizzes:'quiz',schoolTests:'school-test',writing:'writing',speaking:'recording',mockTests:'school-test'};
 for(const [key,kind] of Object.entries(sections)){const s=progress?.[key as keyof Progress] as Section|undefined;if(!s)continue;const occurrences=new Map<string,number>();for(const row of s.rows){
  if(softwareCheck(...row.slice(0,3))){excluded++;continue;}
  const get=(name:string)=>String(row[s.headers.findIndex(h=>h.toLowerCase()===name.toLowerCase())]??''),title=get('Title')||get('Test')||get('Paper')||get('Recording')||get('Section')||get('Unit')||'Saved record',date=eventDay(get('Date'))||'',identity=hash(JSON.stringify([get('Date'),get('Unit'),get('Section'),title])),occurrence=(occurrences.get(identity)||0)+1,ref=`legacy:${key}:${identity}:${occurrence}`;occurrences.set(identity,occurrence);
  const score=get('Score'),max=get('Max'),numeric=score.trim()!==''&&max.trim()!==''&&Number.isFinite(Number(score))&&Number(max)>0&&Number(score)>=0&&Number(score)<=Number(max);
  items.push({ref,kind:kind!,title,date,dateBasis:date?'performed':'unknown',status:status(ref,key==='homework'?'receipt-only':key==='writing'||key==='speaking'?'original-needed':'needs-review'),summary:numeric?`${score}/${max} saved task marks; marking guide and independence need verification.`:get('Feedback')||get('Notes')||'Historical record; original work and marking conditions need verification.',unitId:'',unitTitle:title});
 }}
 const imported=rs.filter(r=>r.visibility==='teacher').flatMap(r=>readProgressObservation(r.body.tutorPrivate?.progressObservation)?.sources||[]),aliases=new Set(imported.flatMap(s=>s.aliases||[]));
 const once=new Map(items.filter(e=>!aliases.has(e.ref)).map(e=>[e.ref,e]));
 for(const r of rs.filter(r=>r.visibility==='teacher')){const observation=readProgressObservation(r.body.tutorPrivate?.progressObservation);for(const source of observation?.sources||[]){if(!once.has(source.ref))once.set(source.ref,{...source,status:status(source.ref,'needs-review'),summary:observation!.observations.map(o=>o.finding).join(' '),unitId:'',unitTitle:source.title});}}
 return {items:[...once.values()].sort((a,b)=>b.date.localeCompare(a.date)||a.ref.localeCompare(b.ref)),excluded,planned};
}
export function observationHistory(records:LearningRecord[]){return learningRecordsOnce(records).filter(r=>r.visibility==='teacher').flatMap(record=>{const observation=readProgressObservation(record.body.tutorPrivate?.progressObservation);return observation?[{record,observation}]:[];}).sort((a,b)=>a.record.date.localeCompare(b.record.date));}
