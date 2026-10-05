import type {LearningRecord} from './learning';

export function latestRecordedLesson(records:LearningRecord[]):LearningRecord|null{
  return records.filter(r=>r.kind==='lesson'&&r.body.source?.includes('/lesson-recording/'))
    .sort((a,b)=>b.date.localeCompare(a.date)||b.created.localeCompare(a.created))[0]||null;
}
export type FeedbackFilter='all'|'homework'|'test'|'speaking'|'lesson'|'recorded'|'chat'|'rory';
export function matchesFeedbackFilter(record:LearningRecord,filter:FeedbackFilter):boolean{
  if(filter==='all')return true;
  if(filter==='recorded')return !!record.body.lessonSnapshot||!!record.body.source?.includes('/lesson-recording/')||record.body.feedbackOrigin==='recorded-lesson-practice';
  if(filter==='chat')return record.kind==='speaking'&&record.body.evidenceType==='AI conversation captions';
  if(filter==='rory')return !!record.body.audioReview||(record.author==='Rory'&&record.body.evidenceType!=='AI conversation captions'&&!record.body.aiAnalysis&&!record.body.lessonPractice&&!record.body.source?.includes('/lesson-recording/')&&record.visibility==='shared');
  return record.kind===filter;
}

export function feedbackSource(record:LearningRecord):{label:string;note:string}|null{
  const b=record.body;
  if(b.lessonSnapshot)return {label:'Recorded lesson feedback · reviewed by Rory',note:'A simple summary approved by Rory for the student and parents.'};
  if(b.source?.includes('/lesson-recording/'))return {label:'Lesson assessment',note:'Draft · Rory review pending. Based on the lesson transcript and the slides used.'};
  if(b.feedbackOrigin==='recorded-lesson-practice')return {label:'Practice from your recorded lesson',note:'Recap and practice · the full lesson analysis is private and awaits Rory’s review.'};
  if(b.lessonPractice)return {label:'Practice from your lesson',note:'Practice · separate from Rory’s reviewed feedback.'};
  if(record.kind==='speaking'&&b.evidenceType==='AI conversation captions')return {label:'Conversation feedback',note:'Based on your conversation captions · Rory has not reviewed this. Captions can contain mistakes.'};
  return null;
}

/** Presentation only: preserve original stored titles/evidence and review history. */
export function assessmentDisplayLabel(value:string|undefined):string{return (value||'').replace(/AI analysis of recorded lessons?/gi,'Lesson assessment').replace(/AI conversation captions/gi,'Conversation captions').replace(/AI conversation feedback/gi,'Conversation feedback').replace(/AI (?:practice |writing )?feedback/gi,'Feedback').replace(/AI (?:assessment|assessed)/gi,'Assessment').replace(/AI draft/gi,'Draft').replace(/AI-prepared/gi,'Prepared');}
