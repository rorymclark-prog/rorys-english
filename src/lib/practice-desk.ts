import {documentRequest,type DocumentExercise,type DocumentPracticeAttempt,type LearnerDocument} from './documents';
import {eventDay,viennaDay} from './teacher-metrics';
import {softwareCheck} from './evidence-common';

export type PracticeSource={id:string;title:string;created:string;documentId:string;version:string;exercises:DocumentExercise[];attempts:DocumentPracticeAttempt[]};
export type PracticeCard={id:string;sourceId:string;documentId:string;version:string;sourceTitle:string;sourceDate:string;exercise:DocumentExercise;attempts:DocumentPracticeAttempt[];state:'first'|'retry'|'revisit'|'recent';lastPractised:string|null};
export type PracticeDeskData={sources:PracticeSource[];cards:PracticeCard[];warnings:string[];hasMore:boolean};
export const practiceDeskToday=viennaDay;
const SOURCE_LIMIT=8,CONCURRENCY=3;
const calendarNumber=(day:string)=>Date.parse(day+'T12:00:00Z')/86400000;

// Whitelist task fields even for a teacher read. Answer guidance belongs to a
// confirmed attempt, never to the new-task payload used by the practice desk.
function taskOnly(exercise:DocumentExercise):DocumentExercise|null {
  if(!exercise||typeof exercise.id!=='string'||!exercise.id||!['choice','gap','rewrite','write'].includes(exercise.type)||typeof exercise.prompt!=='string'||!exercise.prompt.trim()||typeof exercise.focus!=='string')return null;
  const options=Array.isArray(exercise.options)?exercise.options.filter((option):option is string=>typeof option==='string'):[];
  if(exercise.type==='choice'&&!options.length)return null;
  return {id:exercise.id,type:exercise.type,prompt:exercise.prompt,focus:exercise.focus,options:exercise.type==='choice'?options:[]};
}

export function buildPracticeCards(sources:PracticeSource[],today:string):PracticeCard[] {
  const validToday=eventDay(today);if(!validToday)throw new Error('Use a valid calendar date for practice.');
  const cards:PracticeCard[]=[],seenSources=new Set<string>();
  for(const source of sources){
    if(!source.id||!source.documentId||!source.version||seenSources.has(source.id))continue;seenSources.add(source.id);
    const seenExercises=new Set<string>();
    for(const raw of source.exercises){const exercise=taskOnly(raw);if(!exercise||seenExercises.has(exercise.id))continue;seenExercises.add(exercise.id);
      const seenAttempts=new Set<string>();
      const attempts=source.attempts.filter(attempt=>{
        const day=eventDay(attempt.created);
        if(!attempt.id||seenAttempts.has(attempt.id)||attempt.documentId!==source.documentId||attempt.version!==source.version||attempt.exerciseId!==exercise.id||!day||day>validToday||!attempt.result||!['correct','try-again','compare'].includes(attempt.result.status))return false;
        seenAttempts.add(attempt.id);return true;
      }).sort((a,b)=>(Date.parse(a.created)-Date.parse(b.created))||a.created.localeCompare(b.created)||a.id.localeCompare(b.id));
      const latest=attempts.at(-1),day=latest?eventDay(latest.created):null;
      const state:PracticeCard['state']=!latest?'first':latest.result.status==='try-again'?'retry':day&&calendarNumber(validToday)-calendarNumber(day)>=3?'revisit':'recent';
      cards.push({id:JSON.stringify([source.id,source.version,exercise.id]),sourceId:source.id,documentId:source.documentId,version:source.version,sourceTitle:source.title,sourceDate:source.created,exercise,attempts,state,lastPractised:latest?.created||null});
    }
  }
  const rank={first:0,retry:1,revisit:2,recent:3};
  // Preserve exercise order within a source; source dates and IDs break ties
  // deterministically without treating more attempts as better learning.
  return cards.sort((a,b)=>rank[a.state]-rank[b.state]||b.sourceDate.localeCompare(a.sourceDate)||a.sourceId.localeCompare(b.sourceId));
}

function eligible(document:LearnerDocument):boolean {
  if(!document||typeof document.id!=='string'||!document.id||document.status!=='ready'||document.processing||document.reviewPending||document.analysisStage||softwareCheck(document.title))return false;
  const release=document.feedbackAvailableAt?Date.parse(document.feedbackAvailableAt):null;
  if(release!==null&&(!Number.isFinite(release)||release>Date.now()))return false;
  if(document.hasConversationFeedback||document.conversationId||/^AI conversation audio\b/i.test(document.title||'')||/^\[Document role: (task|review)\]$/m.test(document.context||''))return false;
  if((Array.isArray(document.files)?document.files:[]).some(file=>typeof file?.type==='string'&&file.type.startsWith('audio/')))return false;
  if(document.analysis?.workType==='material')return false;
  return !document.workType||document.workType==='writing'||document.workType==='worksheet';
}

type LoadOptions={request?:typeof documentRequest;today?:string};
/** Reads saved feedback only. It never generates feedback or writes attempts. */
export async function loadPracticeDesk(code:string,teacher=false,options:LoadOptions={}):Promise<PracticeDeskData> {
  const rpc=options.request||documentRequest,today=options.today||practiceDeskToday();
  const list=await rpc(code,teacher,{action:'documents'});
  if(!list.ok)throw new Error(list.error||'Could not open saved practice.');
  const unique=new Map<string,LearnerDocument>();
  for(const document of list.documents||[])if(eligible(document)&&!unique.has(document.id))unique.set(document.id,document);
  const candidates=[...unique.values()].sort((a,b)=>String(b.created||'').localeCompare(String(a.created||''))||a.id.localeCompare(b.id));
  const selected=candidates.slice(0,SOURCE_LIMIT),results:(PracticeSource|null)[]=selected.map(()=>null);
  let next=0,failed=0;
  async function worker(){while(next<selected.length){const index=next++,candidate=selected[index];try{
    const response=await rpc(code,teacher,{action:'document',id:candidate.id}),document=response.document;
    if(!response.ok||!document||document.id!==candidate.id){failed++;continue;}
    if(!eligible(document)||!document.practiceVersion||!document.analysis?.writing?.original?.trim())continue;
    const exercises=(document.analysis.exercises||[]).flatMap(raw=>{const safe=taskOnly(raw);return safe?[safe]:[];});
    if(!exercises.length)continue;
    const source:PracticeSource={id:document.id,title:document.title||candidate.title||'Saved writing',created:document.created||candidate.created,documentId:document.id,version:document.practiceVersion,exercises,attempts:document.practiceAttempts||[]};
    // Keep only attempts belonging to this exact source and feedback version.
    const cards=buildPracticeCards([source],today);source.exercises=cards.map(card=>card.exercise);source.attempts=cards.flatMap(card=>card.attempts);results[index]=source;
  }catch{failed++;}}}
  await Promise.all(Array.from({length:Math.min(CONCURRENCY,selected.length)},()=>worker()));
  const sources=results.filter((source):source is PracticeSource=>source!==null);
  return {sources,cards:buildPracticeCards(sources,today),warnings:failed?[`${failed===1?'One piece':`${failed} pieces`} of saved work could not be checked. You can refresh to try again.`]:[],hasMore:candidates.length>SOURCE_LIMIT};
}
