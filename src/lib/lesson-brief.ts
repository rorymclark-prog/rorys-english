import type {LearningRecord} from './learning';
import {readSkillCheck,skillDomains,b2WritingCriteria} from './skill-progress';
import {readCheckpoint} from './teacher-metrics';
import {readLessonAssessment} from './lesson-assessment';
import {readProgressObservation} from './progress-evidence';
import {isTeachingPack} from './teaching-files';
import {softwareCheck} from './evidence-common';

export const lessonBriefId='teacher-next-lesson-brief';
export const briefPhases={opening:'Independent opening check',unit:'Verified unit work',break:'Break',practice:'Focused practice',exit:'Fresh independent exit check'} as const;
export type BriefPhase=keyof typeof briefPhases;
export type BriefSource={id:string;recordId:string;title:string;date:string;kind:string;prompt:string;support:string;status:string;strengths:string[];limits:string};
export type LessonBrief={version:1;unitId:string;unitTitle:string;priorities:BriefSource[];opening:string;practice:string;exit:string;support:string;reserve:string;duration:number;minutes:Record<BriefPhase,number>;reserveMinutes:number};
const text=(value:unknown,max:number)=>typeof value==='string'&&value.length<=max;
const day=(value:unknown)=>typeof value==='string'&&/^20\d\d-\d\d-\d\d$/.test(value)&&!isNaN(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
const sourceValid=(s:BriefSource)=>!!s&&typeof s==='object'&&[s.id,s.recordId,s.title,s.kind,s.support,s.status].every(v=>text(v,600)&&v.trim())&&day(s.date)&&text(s.prompt,3000)&&!!s.prompt.trim()&&text(s.limits,4000)&&Array.isArray(s.strengths)&&s.strengths.length<=3&&s.strengths.every(v=>text(v,1000)&&v.trim());
export function briefTotal(brief:Pick<LessonBrief,'minutes'>):number{return Object.keys(briefPhases).reduce((sum,key)=>sum+brief.minutes[key as BriefPhase],0);}
/** An editable draft may be incomplete, but its nested values must remain safe to render. */
export function lessonBriefDraftValid(value:unknown):value is LessonBrief{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;const b=value as LessonBrief;
 return b.version===1&&text(b.unitId,150)&&text(b.unitTitle,300)&&Array.isArray(b.priorities)&&b.priorities.length<=2&&b.priorities.every(sourceValid)&&new Set(b.priorities.map(p=>p.id)).size===b.priorities.length&&[b.opening,b.practice,b.exit,b.support,b.reserve].every(v=>text(v,2000))&&Number.isFinite(b.duration)&&Number.isFinite(b.reserveMinutes)&&!!b.minutes&&typeof b.minutes==='object'&&Object.keys(b.minutes).length===Object.keys(briefPhases).length&&Object.keys(briefPhases).every(k=>Number.isFinite(b.minutes[k as BriefPhase]));
}
export function readLessonBrief(value:unknown):LessonBrief|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;const b=value as LessonBrief;
 if(b.version!==1||!text(b.unitId,150)||!text(b.unitTitle,300)||!Array.isArray(b.priorities)||b.priorities.length<1||b.priorities.length>2||b.priorities.some(s=>!sourceValid(s))||new Set(b.priorities.map(s=>s.id)).size!==b.priorities.length)return null;
 if([b.opening,b.practice,b.exit].some(v=>!text(v,2000)||!v.trim())||!text(b.support,2000)||!text(b.reserve,2000)||!Number.isInteger(b.duration)||b.duration<15||b.duration>240||!Number.isInteger(b.reserveMinutes)||b.reserveMinutes<0||b.reserveMinutes>60)return null;
 if(!b.minutes||typeof b.minutes!=='object'||Object.keys(b.minutes).length!==Object.keys(briefPhases).length||Object.keys(briefPhases).some(k=>!Number.isInteger(b.minutes[k as BriefPhase])||b.minutes[k as BriefPhase]<0||b.minutes[k as BriefPhase]>240)||briefTotal(b)!==b.duration||JSON.stringify(b).length>24000)return null;
 return b;
}
export function emptyLessonBrief(unit:{id:string;title:string}|null):LessonBrief{return {version:1,unitId:unit?.id||'',unitTitle:unit?.title||'Current school unit to confirm',priorities:[],opening:'',practice:'',exit:'',support:'',reserve:'',duration:90,minutes:{opening:10,unit:30,break:5,practice:30,exit:15},reserveMinutes:20};}
export function savedLessonBrief(records:LearningRecord[]):LessonBrief|null{const latest=records.filter(r=>r.id===lessonBriefId).sort((a,b)=>b.created.localeCompare(a.created))[0];return latest?.visibility==='teacher'?readLessonBrief(latest.body.tutorPrivate?.lessonBrief):null;}
/** Explicit next actions only: no inferred weakness, mastery score or invented task. */
export function lessonBriefSources(records:LearningRecord[],today:string):BriefSource[]{
 const latest=new Map<string,LearningRecord>();for(const r of [...records].sort((a,b)=>b.created.localeCompare(a.created)))if(!latest.has(r.id))latest.set(r.id,r);
 const sources:BriefSource[]=[];
 for(const r of latest.values()){
  if(r.visibility!=='teacher'||!day(r.date)||r.date>today||isTeachingPack(r)||r.body.tutorPrivate?.lessonBrief||softwareCheck(r.title))continue;
  const p=r.body.tutorPrivate;if(!p)continue;
  const strengths=(r.body.plainReview?.strengths||r.body.strengths||[]).filter(s=>text(s,1000)&&s.trim()).slice(0,3);
  const add=(key:string,kind:string,prompt:string,support:string,status:string,limits='',extraStrengths=strengths)=>{if(!prompt.trim())return;const source={id:`${r.id}:${key}`,recordId:r.id,title:r.title,date:r.date,kind,prompt:prompt.trim(),support,status,strengths:extraStrengths,limits};if(sourceValid(source))sources.push(source);};
  const skill=readSkillCheck(p.skillCheck,r.date);if(skill)add('skill','Skill check',skill.nextCheck,skill.help,'Marked task check',skill.protocol?`Comparison protocol: ${skill.protocol}`:'No comparison protocol recorded.');
  const checkpoint=readCheckpoint(p.checkpoint);if(checkpoint)add('checkpoint','Checkpoint',checkpoint.nextCheck,checkpoint.support,'Recorded checkpoint',checkpoint.protocol?`Comparison protocol: ${checkpoint.protocol}`:'No comparison protocol recorded.',checkpoint.strength.trim()?[checkpoint.strength]:strengths);
  const lesson=readLessonAssessment(p.lessonAssessment);if(lesson)lesson.checks.forEach((check,i)=>add(`lesson-${i}`,'Lesson check',check.nextCheck,'See original attempt conditions','Private assessment draft',`${check.task}. ${lesson.limits}${check.comparisonProtocol?` Comparison protocol: ${check.comparisonProtocol}`:''}`));
  const observation=readProgressObservation(p.progressObservation);if(observation)add('observation','Progress observation',observation.nextCheck,[...new Set(observation.observations.map(o=>o.help))].join(', '),observation.observations.some(o=>o.confidence==='provisional')?'Provisional observation':'Private observation draft',`${observation.dateBasis==='performed'?'Performed date':observation.dateBasis==='available-by'?'Available by this date':'Performance date unknown'}. ${observation.limits}`);
  const plan=p.plainPlan||p.plan;if(plan&&!plan.startsWith('Teaching files:'))add('plan','Teacher reflection',plan,'Not specified in this note','Private teaching note');
 }
 return sources.sort((a,b)=>b.date.localeCompare(a.date)||a.title.localeCompare(b.title)||a.id.localeCompare(b.id));
}
export type BriefEvidenceSection={heading:string;lines:string[]};
/** Read-only teaching evidence for the chosen next check; never a learner publication. */
export function lessonBriefEvidence(records:LearningRecord[],source:BriefSource):BriefEvidenceSection[]{
 const record=records.filter(r=>r.id===source.recordId).sort((a,b)=>b.created.localeCompare(a.created))[0];
 if(record?.visibility!=='teacher'||!record.body.tutorPrivate)return [];
 const p=record.body.tutorPrivate,sections:BriefEvidenceSection[]=[];
 const add=(heading:string,lines:(string|undefined)[])=>sections.push({heading,lines:lines.filter((line):line is string=>!!line?.trim())});
 if(source.id===`${record.id}:skill`){
  const c=readSkillCheck(p.skillCheck,record.date);if(!c)return [];
  add('Task and conditions',[`${c.unitTitle} · ${record.date}`,`Help: ${c.help}. Stage: ${c.stage}.`,c.protocol?`Comparison protocol: ${c.protocol}`:'Comparison protocol not recorded.',c.sourceRef?`Evidence reference: ${c.sourceRef}`:undefined]);
  for(const result of c.results)add(skillDomains[result.domain],[`Criterion: ${result.criterion}`,result.earned===null?'Unassessed':`Task marks: ${result.earned} / ${result.possible}`,`Evidence: ${result.evidence}`,result.rubric==='austrian-b2-writing'?'Austrian B2 writing marking guide':undefined,...(result.subscores?Object.entries(b2WritingCriteria).map(([key,label])=>`${label}: ${result.subscores![key as keyof typeof result.subscores]??'Unassessed'} / 10`):[])]);
  if(c.words.length)add('Vocabulary evidence',[c.vocabularySource,...c.words.map(w=>`${w.word} — recall: ${w.recall===null?'unassessed':w.recall?'shown':'not shown'}; own use: ${w.use===null?'unassessed':w.use?'shown':'not shown'}; later retention: ${w.retained===null?'unassessed':w.retained?'shown':'not shown'}. ${w.evidence}`)]);
 }else if(source.id===`${record.id}:checkpoint`){
  const c=readCheckpoint(p.checkpoint);if(!c)return [];
  add('Task and conditions',[c.objective,`Help: ${c.support}`,c.protocol?`Comparison protocol: ${c.protocol}`:'Comparison protocol not recorded.']);
  for(const criterion of c.criteria)add(criterion.skill,[criterion.earned===null?'Unassessed':`Task marks: ${criterion.earned} / ${criterion.possible}`,`Evidence: ${criterion.evidence}`]);
  add('Recorded feedback',[`What went well: ${c.strength}`,`Practise next: ${c.target}`]);
 }else if(source.id.startsWith(`${record.id}:lesson-`)){
  const lesson=readLessonAssessment(p.lessonAssessment),index=Number(source.id.slice(`${record.id}:lesson-`.length)),check=lesson?.checks[index];if(!lesson||!Number.isInteger(index)||!check)return [];
  add('Assessment method and limits',[lesson.method,lesson.limits]);
  add(check.task,[check.score===null?'Task support score unassessed':`Task support score: ${check.score} / 4`,check.evidence,check.comparisonProtocol?`Comparison protocol: ${check.comparisonProtocol}`:'Comparison protocol not recorded.']);
  for(const attempt of lesson.attempts)add(`${attempt.time} · ${attempt.task}`,[`Help: ${attempt.support}`,attempt.evidence,`Confidence: ${attempt.confidence}`]);
 }else if(source.id===`${record.id}:observation`){
  const observation=readProgressObservation(p.progressObservation);if(!observation)return [];
  add('Review method and limits',[observation.method,observation.limits,`Date basis: ${observation.dateBasis==='performed'?'performed on this date':observation.dateBasis==='available-by'?'available by this date':'performance date unknown'}`]);
  for(const item of observation.observations)add(skillDomains[item.domain],[item.finding,`Evidence: ${item.evidence}`,`Help: ${item.help}. Confidence: ${item.confidence}.`]);
 }else if(source.id===`${record.id}:plan`){
  add('Private teaching reflection',[p.plainWorked||p.worked,p.plainImprove||p.improve,p.plainPlan||p.plan]);
 }
 return sections;
}
export function lessonBriefText(name:string,b:LessonBrief):string{
 return [`PRIVATE TO RORY · LESSON PREPARATION`,name,b.unitTitle,`Core: ${b.duration} minutes. Reserve: ${b.reserveMinutes} additional minutes. No lesson date booked.`,...b.priorities.map((p,i)=>`Priority ${i+1}: ${p.prompt}\nSource: ${p.title} · ${p.date} · ${p.status}\nHelp recorded: ${p.support}${p.strengths.length?'\nStrengths: '+p.strengths.join('; '):''}${p.limits?'\nLimits: '+p.limits:''}`),...Object.entries(briefPhases).map(([key,label])=>`${label}: ${b.minutes[key as BriefPhase]} minutes`),`Opening check: ${b.opening}`,`Focused practice: ${b.practice}`,`Exit check: ${b.exit}`,`Support / stretch: ${b.support||'Not specified'}`,`Optional reserve: ${b.reserve||'Not specified'}`].join('\n\n');
}
