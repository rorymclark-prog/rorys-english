import type {LearningRecord} from './learning';
import type {Progress} from './remote';
export function softwareCheck(...labels:unknown[]):boolean{return labels.some(v=>/^(?:SECTEST\b|TEST\s*[—–:-]\s*(?:pipeline|smoke|synthetic|check)|synthetic\s+(?:test|check)|QA\s*[—–:-])/i.test(String(v||'').trim()));}
export function learningRecordsOnce(records:LearningRecord[]):LearningRecord[]{const byId=new Map<string,LearningRecord>(),unnamed:LearningRecord[]=[];for(const r of records){if(!r.id){unnamed.push(r);continue;}const old=byId.get(r.id);if(!old||r.created>old.created)byId.set(r.id,r);}return [...byId.values(),...unnamed];}
export function learnerProgress(progress:Progress):Progress{const result={...progress};for(const key of ['homework','quizzes','schoolTests','writing','speaking','mockTests'] as const){const s=progress[key];if(s)result[key]={...s,rows:s.rows.filter(row=>!softwareCheck(...row.slice(0,3)))};}return result;}
