import type {LearningRecord} from './learning';
export const skillDomains = {vocabulary:'Vocabulary',grammar:'Grammar',reading:'Reading',listening:'Listening',writing:'Writing',speaking:'Speaking & interaction',pronunciation:'Pronunciation',fluency:'Fluency'} as const;
export type SkillDomain=keyof typeof skillDomains;
export const b2WritingCriteria={task:'Completing the task',organisation:'Organisation and linking',range:'Language range',accuracy:'Language accuracy'} as const;
export type B2WritingMarks=Record<keyof typeof b2WritingCriteria,number|null>;
export const b2WritingGuide='Austrian B2 writing rubric: completing the task, organisation, language range and accuracy; apply the four published descriptors, including the task-achievement veto.';
export function b2WritingTotal(m:B2WritingMarks){return Object.values(m).some(v=>v===null)?null:Object.values(m).reduce<number>((n,v)=>n+v!,0);}
export type SkillResult={domain:SkillDomain;goalId?:string;goalPlanId?:string;rubric?:'austrian-b2-writing';subscores?:B2WritingMarks;criterion:string;earned:number|null;possible:number;evidence:string;evidenceType:'written'|'transcript'|'audio'|'live'};
export type WordCheck={word:string;recall:boolean|null;use:boolean|null;retained:boolean|null;previousDate:string;evidence:string};
export type SkillCheck={version:1;sourceKind?:'lesson'|'homework'|'conversation'|'writing'|'quiz'|'school-test'|'checkpoint';sourceRef?:string;unitId:string;unitTitle:string;protocol:string;help:'independent'|'hints'|'model'|'unknown';stage:'baseline'|'checkpoint'|'retention';results:SkillResult[];vocabularySource:string;words:WordCheck[];nextCheck:string};
export type SkillSnapshot=Omit<SkillCheck,'results'|'words'|'sourceRef'> & {results:Omit<SkillResult,'evidence'>[];words:Omit<WordCheck,'evidence'>[]};
function validWritingRubric(r:SkillResult):boolean{
 if(r.rubric===undefined)return r.subscores===undefined;
 if(r.rubric!=='austrian-b2-writing'||r.domain!=='writing'||!r.subscores||typeof r.subscores!=='object'||Array.isArray(r.subscores)||Object.keys(r.subscores).length!==4)return false;
 for(const k of Object.keys(b2WritingCriteria) as (keyof B2WritingMarks)[]){const v=r.subscores[k];if(!Object.hasOwn(r.subscores,k)||v!==null&&(!Number.isInteger(v)||v<0||v>10))return false;}
 return r.possible===40&&r.earned===b2WritingTotal(r.subscores);
}
const dateValid=(d:string)=>/^20\d\d-\d\d-\d\d$/.test(d)&&!isNaN(new Date(d+'T12:00:00Z').getTime())&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
function valid(value:unknown,date:string,privateEvidence:boolean):boolean{
 if(!value||typeof value!=='object'||!dateValid(date)||JSON.stringify(value).length>26000)return false;const c=value as SkillCheck;
 if(c.version!==1||[c.unitId,c.unitTitle,c.protocol,c.vocabularySource,c.nextCheck].some(x=>typeof x!=='string'||x.length>1500)||!c.unitId.trim()||!c.unitTitle.trim()||!['independent','hints','model','unknown'].includes(c.help)||!['baseline','checkpoint','retention'].includes(c.stage)||!Array.isArray(c.results)||c.results.length>8||!Array.isArray(c.words)||c.words.length>60)return false;
 if(c.sourceKind!==undefined&&!['lesson','homework','conversation','writing','quiz','school-test','checkpoint'].includes(c.sourceKind)||c.sourceRef!==undefined&&(typeof c.sourceRef!=='string'||c.sourceRef.length>600))return false;
 if(c.results.some(r=>!r||typeof r!=='object')||c.words.some(w=>!w||typeof w!=='object'||typeof w.word!=='string'))return false;
 if(c.words.some(w=>[w.recall,w.use,w.retained].some(x=>x!==null))&&c.help!=='independent')return false;
 if(new Set(c.results.map(x=>x.domain)).size!==c.results.length)return false;
 if(c.results.some(r=>!r||!Object.hasOwn(skillDomains,r.domain)||r.goalId!==undefined&&(typeof r.goalId!=='string'||r.goalId.length>150)||r.goalPlanId!==undefined&&(typeof r.goalPlanId!=='string'||r.goalPlanId.length>150)||!!r.goalId&&!r.goalPlanId?.trim()||typeof r.criterion!=='string'||r.criterion.length>600||!['written','transcript','audio','live'].includes(r.evidenceType)||!Number.isFinite(r.possible)||r.possible<=0||r.possible>1000||r.earned!==null&&(!Number.isFinite(r.earned)||r.earned<0||r.earned>r.possible||!r.criterion.trim()||(['pronunciation','fluency'].includes(r.domain)&&!['audio','live'].includes(r.evidenceType)))||privateEvidence&&(typeof r.evidence!=='string'||r.evidence.length>1000||r.earned!==null&&!r.evidence.trim())))return false;
 if(c.results.some(r=>!validWritingRubric(r)))return false;
 if(new Set(c.words.map(w=>w.word.trim().toLowerCase())).size!==c.words.length||c.words.length>0&&!c.vocabularySource.trim())return false;
 if(c.words.some(w=>!w||typeof w.word!=='string'||!w.word.trim()||w.word.length>100||[w.recall,w.use,w.retained].some(x=>x!==null&&typeof x!=='boolean')||typeof w.previousDate!=='string'||w.retained!==null&&(!dateValid(w.previousDate)||w.previousDate>=date||c.help!=='independent'||w.recall===null||w.use===null)||w.retained===true&&(w.recall!==true||w.use!==true)||privateEvidence&&(typeof w.evidence!=='string'||w.evidence.length>500||[w.recall,w.use,w.retained].some(x=>x!==null)&&!w.evidence.trim())))return false;
 return c.results.some(r=>r.earned!==null)||c.words.some(w=>[w.recall,w.use,w.retained].some(x=>x!==null));
}
export const readSkillCheck=(v:unknown,date:string):SkillCheck|null=>valid(v,date,true)?v as SkillCheck:null;
export const readSkillSnapshot=(v:unknown,date:string):SkillSnapshot|null=>valid(v,date,false)?v as SkillSnapshot:null;
/** Explicit publication whitelist: exclude transcripts, marking evidence and private teaching. */
export function skillSnapshot(c:SkillCheck):SkillSnapshot {return {version:1,sourceKind:c.sourceKind,unitId:c.unitId,unitTitle:c.unitTitle,protocol:c.protocol,help:c.help,stage:c.stage,vocabularySource:c.vocabularySource,nextCheck:c.nextCheck,results:c.results.filter(r=>r.earned!==null).map(r=>({domain:r.domain,goalId:r.goalId,goalPlanId:r.goalPlanId,rubric:r.rubric,subscores:r.subscores?{...r.subscores}:undefined,criterion:r.criterion,earned:r.earned,possible:r.possible,evidenceType:r.evidenceType})),words:c.words.map(w=>({word:w.word,recall:w.recall,use:w.use,retained:w.retained,previousDate:w.previousDate}))};}
export function skillEntries(records:LearningRecord[],teacher:boolean){const privateIds=new Set(teacher?records.filter(r=>r.visibility==='teacher'&&readSkillCheck(r.body.tutorPrivate?.skillCheck,r.date)).map(r=>r.id):[]);return records.flatMap(r=>{
 if(r.body.source?.startsWith('skill-progress-summary:')&&privateIds.has(r.body.source.slice('skill-progress-summary:'.length)))return [];
 const check=teacher&&r.visibility==='teacher'?readSkillCheck(r.body.tutorPrivate?.skillCheck,r.date):r.visibility==='shared'&&r.author==='Rory'&&r.body.source?.startsWith('skill-progress-summary:')?readSkillSnapshot(r.body.skillSnapshot,r.date):null;
 return check?[{record:r,check}]:[];
 }).sort((a,b)=>b.record.date.localeCompare(a.record.date)||b.record.created.localeCompare(a.record.created));}
export const skillPercent=(r:Pick<SkillResult,'earned'|'possible'>)=>r.earned===null?null:Math.round(r.earned/r.possible*100);
export function skillChange(before:SkillCheck|SkillSnapshot,after:SkillCheck|SkillSnapshot,domain:SkillDomain){
 const a=before.results.find(r=>r.domain===domain),b=after.results.find(r=>r.domain===domain);
 return a&&b&&a.earned!==null&&b.earned!==null&&before.unitId===after.unitId&&before.help==='independent'&&after.help==='independent'&&!!after.protocol.trim()&&before.protocol===after.protocol&&a.criterion===b.criterion&&a.possible===b.possible&&a.evidenceType===b.evidenceType?skillPercent(b)!-skillPercent(a)!:null;
}
export function domainProgress(entries:ReturnType<typeof skillEntries>,unitId:string){return (Object.keys(skillDomains) as SkillDomain[]).map(domain=>{
 const history=entries.filter(e=>e.check.unitId===unitId&&e.check.results.some(r=>r.domain===domain&&r.earned!==null));const latest=history[0];if(!latest)return {domain,latest:null,result:null,change:null,previous:null,history};const result=latest.check.results.find(r=>r.domain===domain)!;
 const previous=history.slice(1).find(e=>e.record.date<latest.record.date&&skillChange(e.check,latest.check,domain)!==null)||null;
 return {domain,latest,result,change:previous?skillChange(previous.check,latest.check,domain):null,previous,history};
 });}
export function wordProgress(c:SkillCheck|SkillSnapshot){return (['recall','use','retained'] as const).map(key=>({key,total:c.words.length,checked:c.words.filter(w=>w[key]!==null).length,demonstrated:c.words.filter(w=>w[key]===true).length,percent:c.words.length?Math.round(c.words.filter(w=>w[key]===true).length/c.words.length*100):null}));}
export function wordChange(before:SkillCheck|SkillSnapshot,after:SkillCheck|SkillSnapshot,key:'recall'|'use'|'retained'){
 const targets=(c:SkillCheck|SkillSnapshot)=>c.words.map(w=>w.word.trim().toLowerCase()).sort();
 if(before.unitId!==after.unitId||before.help!=='independent'||after.help!=='independent'||!after.protocol.trim()||before.protocol!==after.protocol||before.vocabularySource!==after.vocabularySource||JSON.stringify(targets(before))!==JSON.stringify(targets(after)))return null;
 const a=wordProgress(before).find(x=>x.key===key)!,b=wordProgress(after).find(x=>x.key===key)!;
 return a.checked===a.total&&b.checked===b.total&&a.percent!==null&&b.percent!==null?b.percent-a.percent:null;
}
