import {skillDomains,skillEntries,skillPercent,type SkillDomain} from './skill-progress';
import type {LearningRecord} from './learning';
export type LearningGoal={id:string;domain:SkillDomain;title:string;criterion:string;source:string;threshold:number};
export type GoalPlan={version:1;planId:string;title:string;age:string;classYear:string;schoolType:string;confirmed:boolean;expectedLevel:string;goals:LearningGoal[]};
export function readGoalPlan(value:unknown):GoalPlan|null{
 if(!value||typeof value!=='object')return null;const p=value as GoalPlan;
 if(p.version!==1||[p.planId,p.title,p.age,p.classYear,p.schoolType,p.expectedLevel].some(x=>typeof x!=='string'||x.length>300)||!p.planId.trim()||!p.title.trim()||typeof p.confirmed!=='boolean'||p.confirmed&&(!p.age.trim()||!p.classYear.trim()||!p.schoolType.trim()||!p.expectedLevel.trim())||!Array.isArray(p.goals)||!p.goals.length||p.goals.length>60||JSON.stringify(p).length>25000)return null;
 if(p.goals.some(g=>!g||typeof g!=='object'||!Object.hasOwn(skillDomains,g.domain)||[g.id,g.title,g.criterion,g.source].some(x=>typeof x!=='string'||!x.trim()||x.length>600)||!Number.isFinite(g.threshold)||g.threshold<=0||g.threshold>100))return null;
 if(new Set(p.goals.map(g=>g.id)).size!==p.goals.length)return null;return p;
}
export function goalProgress(plan:GoalPlan,records:LearningRecord[]){
 const entries=skillEntries(records,true);
 const goals=plan.goals.map(goal=>{
  const observations=entries.flatMap(e=>{const result=e.check.results.find(r=>r.goalPlanId===plan.planId&&r.goalId===goal.id&&r.domain===goal.domain&&r.criterion===goal.criterion&&r.earned!==null);return result?[{...e,result}]:[];});
  // Supported work remains useful evidence, but cannot demonstrate an independent goal.
  const meets=(r:typeof observations[number]['result'])=>skillPercent(r)!>=goal.threshold&&(r.rubric!=='austrian-b2-writing'||Object.values(r.subscores!).every(v=>v!==null&&v>=6));
  const independent=observations.filter(e=>e.check.help==='independent'),latest=independent[0],demonstrated=!!latest&&meets(latest.result);
  const earlier=demonstrated?independent.slice(1).find(e=>e.record.date<latest.record.date&&meets(e.result)&&e.result.rubric===latest.result.rubric&&!!latest.check.protocol.trim()&&e.check.protocol===latest.check.protocol&&e.result.possible===latest.result.possible&&e.result.evidenceType===latest.result.evidenceType):undefined;
  const retained=demonstrated&&latest.check.stage==='retention'&&!!earlier;
  return {goal,latest,demonstrated,retained,observations,status:retained?'Retained on a later check':demonstrated?'Demonstrated independently':latest?'Working towards target':observations.length?'Supported practice observed':'Not assessed'};
 });
 return {goals,total:goals.length,assessed:goals.filter(g=>g.observations.length).length,demonstrated:goals.filter(g=>g.demonstrated).length,retained:goals.filter(g=>g.retained).length,percent:Math.round(goals.filter(g=>g.demonstrated).length/goals.length*100)};
}

export function goalPlans(records:LearningRecord[]){return records.filter(r=>r.visibility==='teacher'&&readGoalPlan(r.body.tutorPrivate?.goalPlan)).sort((a,b)=>b.created.localeCompare(a.created)).map(r=>({record:r,plan:readGoalPlan(r.body.tutorPrivate!.goalPlan)!}));}
export const activeGoalPlan=(records:LearningRecord[])=>goalPlans(records)[0]?.plan||null;
