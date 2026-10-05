export type Support='independent'|'prompted'|'modelled'|'read-aloud';
export const supportLabels:Record<Support,string>={independent:'Own answer · no example sentence',prompted:'With a small hint',modelled:'After an example or lots of help','read-aloud':'Reading prepared words'};
export type LessonAssessment={version:1;method:string;limits:string;attempts:{id:string;time:string;task:string;support:Support;evidence:string;confidence:string}[];checks:{key:string;task:string;score:number|null;evidence:string;nextCheck:string;comparable:boolean;comparisonProtocol?:string}[];areas:{title:string;observation:string;assessed:boolean}[];withinLesson:string;retainedProgress:string;teaching:{title:string;observation:string;time:string}[]};
export function readLessonAssessment(value:unknown):LessonAssessment|null{
 if(!value||typeof value!=='object')return null;const v=value as LessonAssessment;
 if(v.version!==1||typeof v.method!=='string'||typeof v.limits!=='string'||!Array.isArray(v.attempts)||v.attempts.length>20||!Array.isArray(v.checks)||v.checks.length>10||!Array.isArray(v.areas)||v.areas.length>8||!Array.isArray(v.teaching)||v.teaching.length>8)return null;
 if(v.attempts.some(a=>!a||!Object.hasOwn(supportLabels,a.support)||typeof a.id!=='string'||typeof a.task!=='string'||typeof a.confidence!=='string'||typeof a.evidence!=='string'||typeof a.time!=='string'))return null;
 if(v.checks.some(c=>!c||typeof c.key!=='string'||typeof c.task!=='string'||typeof c.evidence!=='string'||typeof c.nextCheck!=='string'||typeof c.comparable!=='boolean'||(c.comparisonProtocol!==undefined&&typeof c.comparisonProtocol!=='string')||(c.score!==null&&(!Number.isInteger(c.score)||c.score<1||c.score>4))))return null;
 if(v.areas.some(a=>!a||typeof a.title!=='string'||typeof a.observation!=='string'||typeof a.assessed!=='boolean')||v.teaching.some(t=>!t||typeof t.title!=='string'||typeof t.observation!=='string'||typeof t.time!=='string'))return null;
 if(typeof v.withinLesson!=='string'||typeof v.retainedProgress!=='string')return null;
 return v;
}
export function supportCounts(a:LessonAssessment):Record<Support,number>{const counts:Record<Support,number>={independent:0,prompted:0,modelled:0,'read-aloud':0};for(const attempt of a.attempts)counts[attempt.support]++;return counts;}
export function matchedChange(before:LessonAssessment,after:LessonAssessment,key:string):number|null{
 const a=before.checks.find(x=>x.key===key),b=after.checks.find(x=>x.key===key);
 return before.version===after.version&&a?.comparable&&b?.comparable&&!!a.comparisonProtocol&&a.comparisonProtocol===b.comparisonProtocol&&a.score!=null&&b.score!=null?b.score-a.score:null;
}

export type LessonSnapshot={version:1;sourceReviewId:string;reviewedBy:'Rory';reviewedAt:string;summary:string;strengths:string[];targets:string[];nextStep:string;checks:{task:string;score:number|null}[];counts:Record<Support,number>|null;scope:string};
export function readLessonSnapshot(value:unknown):LessonSnapshot|null{
 if(!value||typeof value!=='object')return null;const v=value as LessonSnapshot;
 if(v.version!==1||v.reviewedBy!=='Rory'||typeof v.sourceReviewId!=='string'||typeof v.reviewedAt!=='string'||typeof v.summary!=='string'||typeof v.nextStep!=='string'||typeof v.scope!=='string'||!Array.isArray(v.strengths)||!Array.isArray(v.targets)||!Array.isArray(v.checks)||v.checks.length>10)return null;
 if([...v.strengths,...v.targets].some(x=>typeof x!=='string')||v.checks.some(c=>!c||typeof c.task!=='string'||(c.score!==null&&(!Number.isInteger(c.score)||c.score<1||c.score>4))))return null;
 if(v.counts!==null&&(!v.counts||Object.keys(supportLabels).some(k=>!Number.isInteger(v.counts![k as Support])||v.counts![k as Support]<0)))return null;
 return v;
}
