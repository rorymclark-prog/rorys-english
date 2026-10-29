import {documentRequest,type DocumentExercise,type DocumentPracticeAttempt,type LearnerDocument} from './documents';
import {eventDay,viennaDay} from './teacher-metrics';
import {softwareCheck} from './evidence-common';

export type PracticeSource={id:string;title:string;created:string;documentId:string;version:string;exercises:DocumentExercise[];attempts:DocumentPracticeAttempt[]};
export type PracticeCard={id:string;sourceId:string;documentId:string;version:string;sourceTitle:string;sourceDate:string;exercise:DocumentExercise;attempts:DocumentPracticeAttempt[];state:'first'|'retry'|'revisit'|'recent';lastPractised:string|null};
declare const continuationBrand:unique symbol;
/** An in-memory snapshot handle. Never persist or transfer it between learners. */
export type PracticeContinuation={readonly [continuationBrand]:true};
export type PracticeDeskData={sources:PracticeSource[];cards:PracticeCard[];warnings:string[];hasMore:boolean;checked:number;remaining:number;failed:number;total:number;continuation:PracticeContinuation|null};
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
type Candidate={id:string;title:string;created:string};
type Snapshot={code:string;teacher:boolean;rpc:typeof documentRequest;today:string;candidates:Candidate[];offset:number;checked:Set<string>;failures:Map<string,Candidate>;operation?:Promise<PracticeDeskData>};
const snapshots=new WeakMap<PracticeContinuation,Snapshot>();
let activeReads=0;
const waitingReads:(()=>void)[]=[];
/** One shared pool also bounds overlapping refreshes and continuation actions. */
async function limitedRead<T>(read:()=>Promise<T>):Promise<T>{
  await new Promise<void>(resolve=>{if(activeReads<CONCURRENCY){activeReads++;resolve();}else waitingReads.push(resolve);});
  try{return await read();}finally{const next=waitingReads.shift();if(next)next();else activeReads--;}
}
function continuation(snapshot:Snapshot):PracticeContinuation|null{
  if(snapshot.offset>=snapshot.candidates.length&&!snapshot.failures.size)return null;
  const token=Object.freeze({}) as PracticeContinuation;snapshots.set(token,snapshot);return token;
}
function status(snapshot:Snapshot){
  const failed=snapshot.failures.size,remaining=snapshot.candidates.length-snapshot.offset;
  return {checked:snapshot.checked.size,remaining,failed,total:snapshot.candidates.length,hasMore:remaining>0,warnings:failed?[`${failed===1?'One piece':`${failed} pieces`} of saved work could not be checked. Retry these checks when you are ready.`]:[],continuation:continuation(snapshot)};
}

/** Preserve mounted tasks and their current attempts when older work arrives. */
export function appendPracticeDesk(previous:PracticeDeskData,batch:PracticeDeskData):PracticeDeskData{
  const sourceIds=new Set(previous.sources.map(source=>source.id)),cardIds=new Set(previous.cards.map(card=>card.id));
  const addedSourceIds=new Set<string>(),sources=[...previous.sources];for(const source of batch.sources)if(!sourceIds.has(source.id)){sourceIds.add(source.id);addedSourceIds.add(source.id);sources.push(source);}
  const cards=[...previous.cards];for(const card of batch.cards)if(addedSourceIds.has(card.sourceId)&&!cardIds.has(card.id)){cardIds.add(card.id);cards.push(card);}
  return {...batch,sources,cards};
}

async function readBatch(snapshot:Snapshot,selected:Candidate[]):Promise<PracticeDeskData>{
  const results:(PracticeSource|null)[]=selected.map(()=>null);let next=0;
  async function worker(){while(next<selected.length){const index=next++,candidate=selected[index];try{
    const response=await limitedRead(()=>snapshot.rpc(snapshot.code,snapshot.teacher,{action:'document',id:candidate.id})),document=response.document;
    if(!response.ok||!document||document.id!==candidate.id){snapshot.failures.delete(candidate.id);snapshot.failures.set(candidate.id,candidate);continue;}
    snapshot.checked.add(candidate.id);snapshot.failures.delete(candidate.id);
    if(!eligible(document)||!document.practiceVersion||!document.analysis?.writing?.original?.trim())continue;
    const exercises=(document.analysis.exercises||[]).flatMap(raw=>{const safe=taskOnly(raw);return safe?[safe]:[];});
    if(!exercises.length)continue;
    const source:PracticeSource={id:document.id,title:document.title||candidate.title||'Saved writing',created:document.created||candidate.created,documentId:document.id,version:document.practiceVersion,exercises,attempts:document.practiceAttempts||[]};
    const cards=buildPracticeCards([source],snapshot.today);source.exercises=cards.map(card=>card.exercise);source.attempts=cards.flatMap(card=>card.attempts);results[index]=source;
  }catch{snapshot.checked.delete(candidate.id);snapshot.failures.delete(candidate.id);snapshot.failures.set(candidate.id,candidate);}}}
  await Promise.all(Array.from({length:Math.min(CONCURRENCY,selected.length)},()=>worker()));
  const sources=results.filter((source):source is PracticeSource=>source!==null);
  return {sources,cards:buildPracticeCards(sources,snapshot.today),...status(snapshot)};
}

/** Read one recent batch. Later batches use this exact metadata snapshot. */
export async function loadPracticeDesk(code:string,teacher=false,options:LoadOptions={}):Promise<PracticeDeskData>{
  const rpc=options.request||documentRequest,today=options.today||practiceDeskToday();
  if(!eventDay(today))throw new Error('Use a valid calendar date for practice.');
  const list=await limitedRead(()=>rpc(code,teacher,{action:'documents'}));
  if(!list.ok)throw new Error(list.error||'Could not open saved practice.');
  const unique=new Map<string,Candidate>();
  for(const document of list.documents||[])if(eligible(document)&&!unique.has(document.id))unique.set(document.id,{id:document.id,title:document.title||'Saved writing',created:document.created||''});
  const candidates=[...unique.values()].sort((a,b)=>b.created.localeCompare(a.created)||a.id.localeCompare(b.id));
  const snapshot:Snapshot={code,teacher,rpc,today,candidates,offset:Math.min(SOURCE_LIMIT,candidates.length),checked:new Set(),failures:new Map()};
  return readBatch(snapshot,candidates.slice(0,SOURCE_LIMIT));
}

/** Each explicit action checks at most eight older or previously failed items. */
export async function extendPracticeDesk(code:string,teacher:boolean,previous:PracticeDeskData,mode:'older'|'retry'='older'):Promise<PracticeDeskData>{
  if(!previous.continuation)return previous;
  const saved=snapshots.get(previous.continuation);
  if(!saved||saved.code!==code||saved.teacher!==teacher)throw new Error('Refresh practice for this learner before checking more work.');
  // Repeated clicks on the same snapshot join its existing action. They never
  // silently consume another eight sources or create another request pool.
  if(saved.operation)return saved.operation;
  const snapshot:Snapshot={...saved,checked:new Set(saved.checked),failures:new Map(saved.failures),operation:undefined};
  const selected=mode==='retry'?[...snapshot.failures.values()].slice(0,SOURCE_LIMIT):snapshot.candidates.slice(snapshot.offset,snapshot.offset+SOURCE_LIMIT);
  if(mode==='older')snapshot.offset+=selected.length;
  if(!selected.length)return previous;
  saved.operation=readBatch(snapshot,selected).then(batch=>appendPracticeDesk(previous,batch));
  return saved.operation;
}
