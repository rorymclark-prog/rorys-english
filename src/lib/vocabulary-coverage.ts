import {parseConversationTranscript} from './conversation-transcript';
/** Exact phrase matches in learner captions only. No independence or mastery judgement. */
export function vocabularyCoverage(transcript:string,targets:string[]){
 const turns=parseConversationTranscript(transcript),learner=turns?.filter(t=>t.speaker==='You');
 const words=(text:string)=>text.toLocaleLowerCase('en').normalize('NFKC').replace(/[’‘]/g,"'").match(/[\p{L}\p{N}]+(?:'[\p{L}]+)?/gu)||[];
 const cleaned=[...new Set(targets.map(t=>t.trim()).filter(Boolean))];
 if(!learner?.length||!cleaned.length)return null;
 const texts=learner.map(t=>` ${words(t.text).join(' ')} `),found=cleaned.filter(target=>{const phrase=words(target).join(' ');return !!phrase&&texts.some(text=>text.includes(` ${phrase} `));});
 return {found,missing:cleaned.filter(t=>!found.includes(t)),total:cleaned.length,learnerWords:learner.reduce((n,t)=>n+words(t.text).length,0)};
}
