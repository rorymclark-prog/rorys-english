import type {LearningRecord} from './learning';

export function latestRecordedLesson(records:LearningRecord[]):LearningRecord|null{
  return records.filter(r=>r.kind==='lesson'&&r.body.source?.includes('/lesson-recording/'))
    .sort((a,b)=>b.date.localeCompare(a.date)||b.created.localeCompare(a.created))[0]||null;
}

export function feedbackSource(record:LearningRecord):{label:string;note:string}|null{
  const b=record.body;
  if(b.source?.includes('/lesson-recording/'))return {label:'AI analysis of recorded lesson',note:'AI draft · Rory review pending. Based on the lesson transcript and the slides used.'};
  if(b.feedbackOrigin==='recorded-lesson-practice')return {label:'Practice from your recorded lesson',note:'AI-prepared recap and practice · the full lesson analysis is private and awaits Rory’s review.'};
  if(b.lessonPractice)return {label:'Practice from your lesson',note:'AI-prepared practice · separate from Rory’s reviewed feedback.'};
  if(record.kind==='speaking'&&b.evidenceType==='AI conversation captions')return {label:'AI conversation feedback',note:'Based on your AI conversation captions · Rory has not reviewed this. Captions can contain mistakes.'};
  return null;
}
