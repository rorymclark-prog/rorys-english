import type {LearningRecord} from './learning';
import {learningRecordsOnce,softwareCheck} from './evidence-common';
import {skillEntries,skillSnapshot,readSkillCheck,skillDomains,type SkillDomain} from './skill-progress';
/** Explicit teacher publication of existing marks. Never expose private evidence or imply a new assessment. */
export function familyProgressPublication(records:LearningRecord[],today:string){
 const entries=skillEntries(learningRecordsOnce(records).filter(r=>r.date<=today&&!r.reviewPending&&!softwareCheck(r.title)),true);
 const selected=new Map<string,Set<SkillDomain>>();
 for(const domain of Object.keys(skillDomains) as SkillDomain[]){
  const latest=entries.find(e=>e.check.results.some(r=>r.domain===domain&&r.earned!==null));
  if(latest?.record.visibility==='teacher'){const domains=selected.get(latest.record.id)||new Set<SkillDomain>();domains.add(domain);selected.set(latest.record.id,domains);}
 }
 return entries.filter(e=>selected.has(e.record.id)).map(e=>{
  const snapshot=skillSnapshot(readSkillCheck(e.record.body.tutorPrivate?.skillCheck,e.record.date)!);
  snapshot.results=snapshot.results.filter(r=>selected.get(e.record.id)!.has(r.domain));
  snapshot.words=[];snapshot.vocabularySource='';
  snapshot.nextCheck='Use a fresh task to check the same skill, keeping the task conditions and support clear.';
  const id=`${e.record.id}-progress-summary`,body={source:`skill-progress-summary:${e.record.id}`,evidenceType:'Task-based sample estimate',skillSnapshot:snapshot};
  return {id,date:e.record.date,kind:'test' as const,title:`Task results · ${snapshot.unitTitle}`.slice(0,150),visibility:'shared' as const,body};
 });
}
