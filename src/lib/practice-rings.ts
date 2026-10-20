import type {EngagementSource} from './engagement';
import {captionSeconds,periodRange,shiftDay,engagementHolidays} from './engagement';
import {eventDay} from './teacher-metrics';
import {learningRecordsOnce,softwareCheck} from './evidence-common';
import {lessonPracticeRecord} from './lesson-practice';
import {handwritingParts} from './handwritten-answer';
import {readVocabularyAnswer,validVocabulary,wordKey,type VocabularyAttempt} from './weekly-practice';
import {practiceCatalog,type RingUnit} from './practice-catalog';
export type RingScope={kind:'week'|'unit'|'lesson'|'course';id:string};
export type RingItem={id:string;kind:'speaking'|'writing'|'vocabulary';title:string;day:string;week:string;unit:string;lesson:string;minutes:number;word?:VocabularyAttempt;counted:boolean;creditId?:string};
export type RingLink={item:string;week:string;unit:string;lesson:string};
const prefix='Practice rings · ';
const clean=(s:string)=>s.replace(/[\r\n]+/g,' ').trim();
const hasWriting=(s:string)=>(s.match(/[\p{L}\p{N}]+/gu)||[]).length>=3;
export function ringWeek(day:string){return periodRange('week',day).from;}
export function validRingWeek(value:string,today:string){return /^20\d\d-\d\d-\d\d$/.test(value)&&!Number.isNaN(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value&&ringWeek(value)===value&&value<=today;}
export function ringLinkAnswer(link:RingLink){return `${prefix}Link saved work\nWork: ${link.item}\nWeek: ${link.week||'-'}\nUnit: ${link.unit||'-'}\nLesson: ${link.lesson||'-'}`;}
export function readRingLink(answer:string):RingLink|null{const m=answer.match(/^Practice rings · Link saved work\nWork: ((?:conversation|reply|submission|document):[A-Za-z0-9_-]{1,100})\nWeek: (\d{4}-\d{2}-\d{2}|-)\nUnit: ([A-Za-z0-9_-]{1,100}|-)\nLesson: ([A-Za-z0-9_-]{1,100}|-)$/);return m?{item:m[1],week:m[2]==='-'?'':m[2],unit:m[3]==='-'?'':m[3],lesson:m[4]==='-'?'':m[4]}:null;}
export function ringPracticeAnswer(kind:'writing'|'vocabulary',week:string,unit:string,lesson:string,value:string|VocabularyAttempt){
 const head=`${prefix}${kind==='writing'?'Writing':'Vocabulary'}\nWeek: ${week}\nUnit: ${unit||'-'}\nLesson: ${lesson||'-'}\n`;
 if(kind==='writing'){if(typeof value!=='string'||!hasWriting(value)||value.length>8000)throw Error('Add your own writing attempt before saving.');return head+'My writing:\n'+value.trim();}
 if(typeof value==='string'||!validVocabulary(value))throw Error('Add a word, meaning and original sentence.');return head+`Word: ${clean(value.word)}\nMeaning: ${clean(value.meaning)}\nMy sentence: ${clean(value.sentence)}`;
}
function readPractice(answer:string){const m=answer.match(/^Practice rings · (Writing|Vocabulary)\nWeek: (\d{4}-\d{2}-\d{2})\nUnit: ([A-Za-z0-9_-]{1,100}|-)\nLesson: ([A-Za-z0-9_-]{1,100}|-)\n([\s\S]+)$/);if(!m)return null;
 const base={week:m[2],unit:m[3]==='-'?'':m[3],lesson:m[4]==='-'?'':m[4]};
 if(m[1]==='Writing')return m[5].startsWith('My writing:\n')&&hasWriting(m[5].slice(12))?{...base,kind:'writing' as const}:null;
 const v=m[5].match(/^Word: ([^\n]+)\nMeaning: ([^\n]+)\nMy sentence: ([^\n]+)$/);if(!v)return null;const word={word:v[1],meaning:v[2],sentence:v[3]};return validVocabulary(word)?{...base,kind:'vocabulary' as const,word}:null;
}
export function inferUnit(text:string,units:RingUnit[]){
 const lower=text.toLocaleLowerCase('en-GB');const exact=units.filter(u=>lower.includes(u.id.toLowerCase()));if(exact.length===1)return exact[0].id;
 const matches=units.filter(u=>{const label=u.title.replace(/^Unit \d+ · /,'').replace(/^.*Unit \d+: /,'').toLowerCase();return label.length>5&&lower.includes(label);});
 if(matches.length===1)return matches[0].id;
 // These retained practice titles explicitly name the published units.
 if(/family life/.test(lower))return units.find(u=>u.id==='english-in-context5-unit01-2026')?.id||'';
 if(/friendships|friendship/.test(lower))return units.find(u=>u.id==='english-in-context5-unit02-2026')?.id||'';
 if(/healthy and happy|healthy habits|wellbeing idea/.test(lower))return units.find(u=>u.id==='way2go8-unit01-2026')?.id||'';
 return '';
}
export function ringEvidence(source:EngagementSource,code:string,today:string){
 const units=practiceCatalog(code),records=learningRecordsOnce(source.records).filter(r=>r.visibility==='shared'&&!r.reviewPending&&r.date<=today&&!softwareCheck(r.title));
 const lessons=records.filter(r=>lessonPracticeRecord([r]));const lessonIds=new Set(lessons.map(r=>r.id)),byRecord=new Map(records.map(r=>[r.id,r]));
 const items=new Map<string,RingItem>();
 const add=(id:string,kind:RingItem['kind'],title:string,raw:string,unit='',lesson='',minutes=0,word?:VocabularyAttempt,counted=true,week='')=>{const day=eventDay(raw);if(!day||day>today)return;items.set(id,{id,kind,title,day,week:week||ringWeek(day),unit,lesson,minutes,word,counted});};
 const writingDocs=source.documents.filter(d=>(d.uploadedBy==='Student'||hasWriting(d.analysis?.writing?.original||''))&&!softwareCheck(d.title)&&d.files.length&&!d.files.some(f=>f.type.startsWith('audio/'))&&!/^\[Document role: (task|review)\]$/m.test(d.context)&&!d.analysis?.exerciseAnswers?.length);
 const docIds=new Set(writingDocs.map(d=>d.id));
 for(const r of records)if(r.kind==='speaking'&&r.author==='Student'){
  const minutes=captionSeconds(r.body.transcript||'');if(minutes===null)continue;
  const lesson=lessons.find(l=>r.title.startsWith(`Lesson practice · ${l.date} · `)&&r.title.includes(l.body.lessonPractice!.title));
  add('conversation:'+r.id,'speaking',r.title,r.body.submittedAt||r.date,inferUnit(r.title,units),lesson?.id||'',minutes/60);
 }
 for(const d of writingDocs){const original=d.analysis?.writing?.original||'';add('document:'+d.id,'writing',d.title,d.created,inferUnit(d.context+' '+d.title,units),'',0,undefined,hasWriting(original)&&!d.analysis?.exerciseAnswers?.length);}
 const seen=new Set<string>();
 for(const r of source.replies){if(!eventDay(r.created)||eventDay(r.created)!>today||seen.has(r.id)||r.author!=='Student'||!byRecord.has(r.reviewId))continue;seen.add(r.id);
  const target=byRecord.get(r.reviewId)!,unit=inferUnit(target.title,units),lesson=lessonIds.has(target.id)?target.id:'';
  const structured=readPractice(r.answer);
  if(structured){if(!validRingWeek(structured.week,today)||structured.unit&&!units.some(u=>u.id===structured.unit&&u.available)||structured.lesson&&!lessonIds.has(structured.lesson))continue;add('reply:'+r.id,structured.kind,structured.kind==='writing'?'Saved writing attempt':structured.word!.word,r.created,structured.unit,structured.lesson,0,structured.kind==='vocabulary'?structured.word:undefined,true,structured.week);continue;}
  if(r.answer.startsWith(prefix))continue;
  const v=readVocabularyAnswer(r.answer);if(v){if(validRingWeek(v.week,today))add('reply:'+r.id,'vocabulary',v.word,r.created,unit,lesson,0,v,true,v.week);continue;}
  if(r.answer.startsWith('Weekly practice · Vocabulary')||!lesson)continue;
  const parts=handwritingParts(r.answer),docs=parts.documentIds.filter(id=>docIds.has(id));
  if(docs.length){for(const id of docs){const item=items.get('document:'+id);if(item){item.counted=true;item.lesson=lesson;item.unit=unit;}}continue;}
  // The legacy upload-link wording alone is never an actual writing attempt.
  if(!r.answer.startsWith('Weekly practice · Writing')&&hasWriting(parts.text))add('reply:'+r.id,'writing','Writing · '+target.title,r.created,unit,lesson);
 }
 for(const s of source.submissions){if(!eventDay(s.submitted)||eventDay(s.submitted)!>today||softwareCheck(s.title,s.task))continue;const unit=units.find(u=>u.id===s.unit),hw=unit?.homework.find(h=>`hw:${h.week}`===s.task);
  const writing=/\b(writing|write|email|essay|blog|letter|draft|revision)\b/i.test(s.title||'')||!!hw&&hw.tasks.some(t=>t.type==='written')&&!hw.tasks.some(t=>t.type==='voice');if(!writing)continue;
  const values=Object.values(s.answers||{}),linked=values.flatMap(a=>handwritingParts(a).documentIds).filter(id=>docIds.has(id));
  if(linked.length){for(const id of linked){const item=items.get('document:'+id);if(item){item.counted=true;item.unit=unit?.id||'';}}}
  else if(values.some(a=>hasWriting(handwritingParts(a).text)))add('submission:'+s.id,'writing',s.title||hw?.title||'Writing submission',s.submitted,unit?.id||'');
 }
 // Attribution is append-only. The latest valid link moves one original's ring
 // credit, while the source's real submission date and file stay untouched.
 for(const r of [...source.replies].sort((a,b)=>a.created.localeCompare(b.created)||a.id.localeCompare(b.id))){if(r.author!=='Student'||!byRecord.has(r.reviewId)||!eventDay(r.created)||eventDay(r.created)!>today)continue;const link=readRingLink(r.answer),item=link&&items.get(link.item);if(!link||!item)continue;
  if(link.week&&!validRingWeek(link.week,today)||link.unit&&!units.some(u=>u.id===link.unit&&u.available)||link.lesson&&!lessonIds.has(link.lesson))continue;
  if(link.week)item.week=link.week;if(link.unit)item.unit=link.unit;if(link.lesson)item.lesson=link.lesson;item.counted=true;item.creditId=r.id;
 }
 return {items:[...items.values()],lessons,units,entry:lessonPracticeRecord(records)};
}
export function ringTotals(items:RingItem[]){const words=new Map<string,VocabularyAttempt>();for(const item of items)if(item.kind==='vocabulary'&&item.word)words.set(wordKey(item.word.word),item.word);return {minutes:items.filter(i=>i.kind==='speaking').reduce((sum,i)=>sum+i.minutes,0),writing:items.some(i=>i.kind==='writing')?1:0,words:[...words.values()]};}
export function ringProgress(source:EngagementSource,code:string,scope:RingScope,today:string,breaks:{from:string;to:string}[]=[]){
 const evidence=ringEvidence(source,code,today),counted=evidence.items.filter(i=>i.counted),selectedUnit=evidence.units.find(u=>u.id===scope.id),selectedLesson=evidence.lessons.find(l=>l.id===scope.id);
 const holiday=(day:string)=>[...engagementHolidays,...breaks].some(b=>day>=b.from&&day<=b.to);
 const teachingDays=Array.from({length:5},(_,i)=>shiftDay(scope.kind==='week'?scope.id:ringWeek(today),i)).filter(d=>!holiday(d)).length;
 const automaticWeek=(item:RingItem)=>item.week===scope.id&&(item.week!==ringWeek(item.day)||!holiday(item.day));
 const selected=counted.filter(i=>scope.kind==='week'?automaticWeek(i):scope.kind==='unit'?i.unit===scope.id:scope.kind==='lesson'?i.lesson===scope.id:evidence.units.some(u=>u.year===scope.id&&u.id===i.unit));
 const units=evidence.units.filter(u=>u.year===scope.id),summary=ringTotals(selected);
 const courseUnits=units.map(unit=>({unit,...ringTotals(counted.filter(i=>i.unit===unit.id))}));
 const target=scope.kind==='week'?30*teachingDays/5:scope.kind==='lesson'?selectedLesson?.body.lessonPractice?.speakingMinutes??0:scope.kind==='course'?units.length*30:30;
 const writingTarget=scope.kind==='course'?units.length:target>0?1:0,vocabularyTarget=scope.kind==='course'?units.length*2:target>0?scope.kind==='week'?Math.ceil(target/15):2:0;
 const minutes=scope.kind==='course'?courseUnits.reduce((sum,u)=>sum+Math.min(30,u.minutes),0):summary.minutes;
 const writing=scope.kind==='course'?courseUnits.reduce((sum,u)=>sum+u.writing,0):summary.writing;
 const vocabulary=scope.kind==='course'?courseUnits.reduce((sum,u)=>sum+Math.min(2,u.words.length),0):summary.words.length;
 const closed=[minutes>=target&&target>0,writing>=writingTarget&&writingTarget>0,vocabulary>=vocabularyTarget&&vocabularyTarget>0].filter(Boolean).length;
 return {...evidence,...summary,minutes,writing,vocabulary,target,writingTarget,vocabularyTarget,closed,selected,selectedUnit,selectedLesson,courseUnits,paused:scope.kind==='week'&&(target===0||scope.id===ringWeek(today)&&holiday(today))};
}
export function claimRingCelebration(storage:Pick<Storage,'getItem'|'setItem'>,key:string){try{if(storage.getItem(key))return false;storage.setItem(key,'seen');return true;}catch{return false;}}

// Present readable receipts while retaining the exact immutable answer behind them.
export function ringAnswerText(answer:string,code:string){
 const linked=readRingLink(answer),practice=readPractice(answer);if(!linked&&!practice)return answer;
 const value=linked||practice!,unit=practiceCatalog(code).find(u=>u.id===value.unit);
 const context=[value.week?`Week of ${value.week}`:'',unit?.title||'',value.lesson?'Linked lesson practice':''].filter(Boolean).join(' · ');
 if(linked)return `Saved work linked to practice rings.\n${context}\nThe original work retains its actual submission date.`;
 if(practice!.kind==='writing')return `Writing practice · ${context}\n\n${answer.slice(answer.indexOf('My writing:\n')+12)}`;
 const word=practice!.kind==='vocabulary'?practice!.word:null;return `Vocabulary practice · ${context}\n\n${word?.word} — ${word?.meaning}\nMy sentence: ${word?.sentence}`;
}
