import english from '../../content/kashi/kashi-writing-spelling-start-2026/homework.json';
import maths from '../../content/kashi/kashi-multiplication-start-2026/homework.json';
import type {HomeworkWeek,HomeworkTask} from './types';
import type {Submission} from './remote';
import {eventDay} from './teacher-metrics';
import {handwritingParts} from './handwritten-answer';
export type HomeworkArea='writing'|'spelling'|'multiplication';
export type HomeworkGoal={id:string;area:HomeworkArea;unitId:string;week:number;assignmentWeek:string;title:string;fields:HomeworkTask[];required:number;answered:number;received:boolean;photo:boolean;status:'not-submitted'|'partial'|'submitted'|'revision';latest?:Submission;versions:number};
export type HomeworkProgress={assignmentWeek:string;weeks:string[];goals:HomeworkGoal[];submitted:number;total:number;hasWork:boolean};
const units=[{id:'kashi-writing-spelling-start-2026',homework:english as HomeworkWeek[]},{id:'kashi-multiplication-start-2026',homework:maths as HomeworkWeek[]}];
const validWeek=(value:string)=>/^20\d\d-\d\d-\d\d$/.test(value)&&!Number.isNaN(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value&&new Date(value+'T12:00:00Z').getUTCDay()===1;
/** Routing prefixes select approved task content, never authenticate a record read. */
export function usesHomeworkProgress(code:string){return code.startsWith('kashi-')||code.startsWith('kashifam-');}
export function homeworkProgress(code:string,submissions:Submission[],today:string,selectedWeek=''):HomeworkProgress{
 if(!usesHomeworkProgress(code))return {assignmentWeek:'',weeks:[],goals:[],submitted:0,total:0,hasWork:false};
 const plans=units.flatMap(unit=>unit.homework.filter(w=>w.assignmentWeek&&validWeek(w.assignmentWeek)&&w.assignmentWeek<=today&&(!w.availableFrom||w.availableFrom<=today)&&w.progress).map(w=>({unitId:unit.id,week:w})));
 const weeks=[...new Set(plans.map(p=>p.week.assignmentWeek!))].sort().reverse();
 const assignmentWeek=weeks.includes(selectedWeek)?selectedWeek:weeks[0]||'';
 const goals:HomeworkGoal[]=plans.filter(p=>p.week.assignmentWeek===assignmentWeek).flatMap(({unitId,week})=>{
  const fields=week.tasks.filter(t=>week.progress!.requiredTaskIds.includes(t.id)&&t.type==='written'&&!t.optional);
  if(!fields.length||fields.length!==new Set(week.progress!.requiredTaskIds).size)return [];
  const history=submissions.filter(s=>{const day=eventDay(s.submitted);return s.id&&s.unit===unitId&&s.task===`hw:${week.week}`&&(!day||day<=today);}).sort((a,b)=>b.submitted.localeCompare(a.submitted)||b.id.localeCompare(a.id));
  const latest=history[0],answers=latest?.answers||{};
  const answered=fields.filter(f=>handwritingParts(answers[f.id]||'').text.trim()).length;
  const photo=handwritingParts(answers.handwritten_work||'').documentIds.length>0||fields.some(f=>handwritingParts(answers[f.id]||'').documentIds.length>0);
  // A confirmed photographed submission is a receipt, not a claim to have read
  // every answer on its page. Keep the typed-answer count separate.
  const received=!!latest&&(answered===fields.length||photo);
  const status:HomeworkGoal['status']=latest?.status==='revision-needed'&&!latest.reviewPending?'revision':received?'submitted':latest?'partial':'not-submitted';
  return [{id:`${unitId}:hw:${week.week}`,area:week.progress!.area,unitId,week:week.week,assignmentWeek,title:week.title,fields,required:fields.length,answered,received,photo,status,latest,versions:new Set(history.map(s=>s.id)).size}];
 });
 return {assignmentWeek,weeks,goals,submitted:goals.filter(g=>g.received).length,total:goals.length,hasWork:goals.some(g=>!!g.latest)};
}
