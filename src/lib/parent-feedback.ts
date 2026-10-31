import type {LearningRecord,LearningBody,PlainReview} from './learning';
import type {LearnerDocument} from './documents';
import {readLessonSnapshot} from './lesson-assessment';
import {assessmentDisplayLabel} from './feedback-source';
import {skillEntries,domainProgress,skillDomains,type SkillDomain} from './skill-progress';
// Display-only removal of retired workflow notices, never the student's original work.
export function familyFeedbackText(value:string|undefined):string{
 return assessmentDisplayLabel(value).replace(/(?:This (?:remains|is) )?(?:AI )?practice feedback awaiting Rory[’']s review\.?/gi,'').replace(/Rory has not (?:yet )?(?:reviewed|approved|provided|added)[^.!?]*(?:[.!?]|$)/gi,'').replace(/(?:Draft\s*[·—–:-]\s*)?Rory(?:[’']s)? review (?:is )?pending\.?/gi,'').replace(/(?:the )?full lesson analysis is private and awaits Rory[’']s review\.?/gi,'').replace(/Rory can add the reason for this change\.?/gi,'').replace(/Rory[’']s feedback/gi,'Feedback').trim();
}
export function familyRecordReview(body:LearningBody):{reviews:PlainReview[];additional:string}{
 const snapshot=readLessonSnapshot(body.lessonSnapshot);
 const basic=snapshot||body.plainReview||{summary:body.summary,strengths:body.strengths,targets:body.targets,nextStep:body.nextStep};
 const reviews=[basic,body.plainAiFeedback,body.audioReview].filter((value):value is PlainReview=>!!value&&!!(value.summary||value.strengths?.length||value.targets?.length||value.nextStep));
 const unique=reviews.filter((value,index)=>reviews.findIndex(other=>JSON.stringify(other)===JSON.stringify(value))===index);
 return {reviews:unique,additional:body.plainAiFeedback?'':familyFeedbackText(body.aiAnalysis||'')};
}
export function familyRecords(records:LearningRecord[]){return records.filter(record=>record.visibility==='shared'&&!record.body.skillSnapshot&&!record.body.tutorPrivate).slice().sort((a,b)=>b.date.localeCompare(a.date)||b.created.localeCompare(a.created));}
export function familySkillRings(records:LearningRecord[]){
 const entries=skillEntries(records.filter(record=>record.visibility==='shared'),false);
 return (Object.keys(skillDomains) as SkillDomain[]).map(domain=>{
  const entry=entries.find(item=>item.check.results.some(result=>result.domain===domain&&result.earned!==null));
  return {...(entry?domainProgress(entries,entry.check.unitId).find(item=>item.domain===domain)!:{latest:null,result:null,change:null,previous:null,history:[]}),domain};
 });
}
export function familyDocumentHasFeedback(document:LearnerDocument){return !!(document.analysis||document.hasConversationFeedback||document.feedback&&!document.reviewPending);}
