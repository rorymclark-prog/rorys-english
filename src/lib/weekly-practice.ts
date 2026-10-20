import type {EngagementSource} from './engagement';
import {engagementEvents,weeklyEngagement} from './engagement';
import {eventDay} from './teacher-metrics';
import {learningRecordsOnce,softwareCheck} from './evidence-common';
import {lessonPracticeRecord} from './lesson-practice';
import {handwritingParts,handwritingReference} from './handwritten-answer';
export type VocabularyAttempt={word:string;meaning:string;sentence:string};
const vocabularyHeading='Weekly practice · Vocabulary';
const writingHeading='Weekly practice · Writing';
const line=(s:string)=>s.replace(/[\r\n]+/g,' ').trim();
export const wordKey=(s:string)=>s.normalize('NFKC').toLocaleLowerCase('en-GB').replace(/[^\p{L}\p{N}\s-]/gu,'').replace(/\s+/g,' ').trim();
export function validVocabulary(a:VocabularyAttempt){return !!wordKey(a.word)&&line(a.word).length<=60&&line(a.meaning).length>=2&&line(a.meaning).length<=300&&(line(a.sentence).match(/[\p{L}\p{N}]+/gu)||[]).length>=3&&line(a.sentence).length<=600;}
export function vocabularyAnswer(week:string,a:VocabularyAttempt){if(!validVocabulary(a))throw Error('Add a word, its meaning and your own sentence.');return `${vocabularyHeading}\nWeek starting: ${week}\nWord: ${line(a.word)}\nMeaning: ${line(a.meaning)}\nMy sentence: ${line(a.sentence)}`;}
export function readVocabularyAnswer(answer:string):({week:string}&VocabularyAttempt)|null{
 const match=answer.match(/^Weekly practice · Vocabulary\nWeek starting: (\d{4}-\d{2}-\d{2})\nWord: ([^\n]+)\nMeaning: ([^\n]+)\nMy sentence: ([^\n]+)$/);
 if(!match)return null;const a={week:match[1],word:match[2],meaning:match[3],sentence:match[4]};return validVocabulary(a)?a:null;
}
export function writingAnswer(week:string,id:string){return `${writingHeading}\nWeek starting: ${week}\nI am linking my own writing attempt or revision, uploaded this week.\n${handwritingReference(id)}`;}
export function writingDocuments(source:EngagementSource,from:string,to:string){return source.documents.filter(d=>d.uploadedBy==='Student'&&!softwareCheck(d.title)&&d.files.length>0&&!d.files.some(f=>f.type.startsWith('audio/'))&&!/^\[Document role: (task|review)\]$/m.test(d.context)&&!!eventDay(d.created)&&eventDay(d.created)!>=from&&eventDay(d.created)!<=to);}
export function weeklyPractice(source:EngagementSource,anchor:string,today:string,breaks:{from:string;to:string}[]=[]){
 const records=learningRecordsOnce(source.records).filter(r=>r.date<=today&&!softwareCheck(r.title));
 const week=weeklyEngagement(engagementEvents(source,today),anchor,breaks),entry=lessonPracticeRecord(records);
 const practices=new Set(records.filter(r=>lessonPracticeRecord([r])).map(r=>r.id));
 const within=(raw:string)=>{const d=eventDay(raw);return !!d&&d>=week.from&&d<=week.to&&d<=today;};
 const allowedDays=new Set<string>();for(let i=0;i<7;i++){const d=new Date(Date.parse(week.from+'T12:00:00Z')+i*86400000).toISOString().slice(0,10);if(!weeklyEngagement([],d,breaks).paused)allowedDays.add(d);}
 const docs=writingDocuments(source,week.from,[week.to,today].sort()[0]),docIds=new Set(docs.map(d=>d.id));
 let writing=0;const words=new Map<string,VocabularyAttempt>(),seen=new Set<string>();
 for(const r of source.replies){if(seen.has(r.id)||r.author!=='Student'||!practices.has(r.reviewId)||!within(r.created)||!allowedDays.has(eventDay(r.created)!))continue;seen.add(r.id);
  const vocabulary=readVocabularyAnswer(r.answer);if(vocabulary){if(vocabulary.week===week.from)words.set(wordKey(vocabulary.word),vocabulary);continue;}
  // An incomplete structured vocabulary answer never becomes writing credit.
  if(r.answer.startsWith(vocabularyHeading))continue;
  const parts=handwritingParts(r.answer);
  if(r.answer.startsWith(writingHeading)){if(r.answer.startsWith(`${writingHeading}\nWeek starting: ${week.from}\n`)&&parts.documentIds.some(id=>docIds.has(id)))writing=1;continue;}
  if(parts.documentIds.some(id=>docIds.has(id))||(parts.text.match(/[\p{L}\p{N}]+/gu)||[]).length>=3)writing=1;
 }
 // Named writing-task receipts also count; generic quiz answers and uploads do not.
 for(const s of source.submissions)if(within(s.submitted)&&allowedDays.has(eventDay(s.submitted)!)&&!softwareCheck(s.title,s.task)&&/\b(writing|write|email|essay|blog|letter|draft|revision)\b/i.test(s.title||'')&&Object.values(s.answers||{}).some(a=>handwritingParts(a).documentIds.some(id=>docIds.has(id))||(handwritingParts(a).text.match(/[\p{L}\p{N}]+/gu)||[]).length>=3))writing=1;
 const active=week.target!==null&&week.target>0,writingTarget=entry&&week.target!==null?(active?1:0):null,vocabularyTarget=entry&&week.target!==null?(active?Math.ceil(2*week.target/30):0):null;
 return {...week,entry,writing,writingTarget,words:[...words.values()],vocabularyTarget,documents:docs};
}
export async function practiceReplyId(reviewId:string,answer:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(reviewId+'\n'+answer));return 'weekly-practice-'+[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,40);}
