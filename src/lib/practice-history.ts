import type {DocumentPracticeAttempt} from './documents';
export type PracticeSource='document'|'submission'|'reply';
/** Saved answers belong to one original, exercise and feedback version. */
export function practiceHistory(attempts:DocumentPracticeAttempt[],documentId:string,sourceType:PracticeSource,version:string,exerciseId:string){
 const namespace=sourceType==='document'?documentId:`${sourceType}:${documentId}`;
 return attempts.filter(attempt=>attempt.documentId===namespace&&attempt.version===version&&attempt.exerciseId===exerciseId).slice().sort((a,b)=>a.created.localeCompare(b.created));
}
