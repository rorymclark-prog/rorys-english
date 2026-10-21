import {inferUnit,ringWeek,type RingScope, type ringProgress} from './practice-rings';

type Progress=ReturnType<typeof ringProgress>;
export type RingStep={id:'speaking'|'writing'|'vocabulary';done:boolean;action:string;completion:string;remaining:number;fraction:number};
// Round remaining time upwards: a rounded display must never say a ring is closed.
export const remainingMinutes=(value:number)=>Math.max(0,Math.ceil(Math.max(0,value)*10-1e-8)/10);
export function ringSteps(p:{minutes:number;target:number;writing:number;writingTarget:number;vocabulary:number;vocabularyTarget:number},course=false):RingStep[]{
 const minutes=remainingMinutes(p.target-p.minutes),writing=Math.max(0,p.writingTarget-p.writing),words=Math.max(0,p.vocabularyTarget-p.vocabulary);
 return [
  {id:'speaking',done:p.target>0&&p.minutes>=p.target,remaining:minutes,fraction:p.target?p.minutes/p.target:0,action:`Save ${minutes} more ${minutes===1?'minute':'minutes'} of speaking`,completion:'Speaking complete — saved conversations counted'},
  {id:'writing',done:p.writingTarget>0&&p.writing>=p.writingTarget,remaining:writing,fraction:p.writingTarget?p.writing/p.writingTarget:0,action:course?`Complete writing in ${writing} more ${writing===1?'unit':'units'}`:'Save one writing attempt or your own revision',completion:'Writing complete — your saved work counts'},
  {id:'vocabulary',done:p.vocabularyTarget>0&&p.vocabulary>=p.vocabularyTarget,remaining:words,fraction:p.vocabularyTarget?p.vocabulary/p.vocabularyTarget:0,action:`Save ${words===1?'one more word':`${words} words`} with ${words===1?'its meaning and your own sentence':'meanings and your own sentences'}`,completion:'Vocabulary complete — your saved words count'},
 ];
}
export function nextRingStep(steps:RingStep[]){
 // Finish a ring already underway first. With equal progress, start with writing.
 const priority={writing:0,vocabulary:1,speaking:2};
 return steps.filter(s=>!s.done&&s.remaining>0).sort((a,b)=>b.fraction-a.fraction||priority[a.id]-priority[b.id])[0];
}
export function ringNextPlan(p:Progress,scope:RingScope,today:string,year:string){
 const currentUnit=inferUnit(p.entry?.record.title||'',p.units)||p.units.find(u=>u.active)?.id;
 const optional=scope.kind==='week'?scope.id<ringWeek(today):scope.kind==='course'?scope.id!==year:scope.kind==='unit'?scope.id!==currentUnit:scope.id!==p.entry?.record.id;
 const pending=p.courseUnits.filter(u=>u.unit.available&&(u.minutes<30||u.writing<1||u.words.length<2));
 const nextUnit=pending.find(u=>u.unit.id===currentUnit)||pending[0];
 const steps=ringSteps(p,scope.kind==='course');
 const next=scope.kind==='course'?(nextUnit?nextRingStep(ringSteps({minutes:nextUnit.minutes,target:30,writing:nextUnit.writing,writingTarget:1,vocabulary:nextUnit.words.length,vocabularyTarget:2})):undefined):nextRingStep(steps);
 return {optional,steps,next,nextUnit};
}
