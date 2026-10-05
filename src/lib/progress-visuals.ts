import type {LearningRecord} from './learning';
import {observationHistory} from './progress-evidence';
import {skillDomains,skillEntries,skillPercent,skillChange,type SkillDomain} from './skill-progress';
import {activeGoalPlan,goalProgress} from './learning-goals';
import {learningRecordsOnce} from './evidence-common';
export function visualProgress(records:LearningRecord[]){
 const unique=learningRecordsOnce(records),history=observationHistory(unique),entries=skillEntries(unique,true),plan=activeGoalPlan(unique);
 const areas=(Object.keys(skillDomains) as SkillDomain[]).map(domain=>{
  const examples=history.filter(e=>e.observation.observations.some(o=>o.domain===domain));
  const marks=entries.filter(e=>e.check.results.some(r=>r.domain===domain&&r.earned!==null)),latest=marks[0]||null,result=latest?.check.results.find(r=>r.domain===domain&&r.earned!==null)||null;
  const previous=latest?marks.slice(1).find(e=>e.record.date<latest.record.date&&skillChange(e.check,latest.check,domain)!==null)||null:null;
  return {domain,observed:examples.length>0,latest,result,percent:result?skillPercent(result):null,previous,change:latest&&previous?skillChange(previous.check,latest.check,domain):null};
 });
 return {areas,reviewed:areas.filter(a=>a.observed||a.result).length,marked:areas.filter(a=>a.result).length,total:areas.length,plan,goals:plan?goalProgress(plan,unique):null};
}
