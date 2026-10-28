"use client";
import {savedSession} from './api';
import {isStudentPreview} from './student-preview';
export interface DraftScope {code:string;role:'teacher'|'student';source:string;version:string;enabled?:boolean}
export interface ResolvedDraftScope {key:string;current:()=>boolean}
export interface DurableDraft<T>{schema:1;value:T;requestId:string;pending:boolean;updatedAt:number}
const PREFIX='re_durable_draft_v1_';
// A session fingerprint is an opaque namespace, never an authentication credential.
// Legacy accounts have no stable account ID, so reauthentication starts a new scope.
export async function resolveDraftScope(scope:DraftScope):Promise<ResolvedDraftScope|null>{
 if(scope.enabled===false||!scope.code||!scope.source||isStudentPreview(scope.code)||typeof window==='undefined')return null;
 const sessionCode=scope.role==='teacher'?'__teacher__':scope.code,session=savedSession(sessionCode);
 if(!session||session.role!==scope.role)return null;
 const token=session.token;let identity:string;
 if(scope.role==='student'&&session.authProvider==='firebase'){
  const {currentAccount}=await import('./account-auth'),account=await currentAccount();
  if(!account||!session.accountUid||account.uid!==session.accountUid)return null;
  identity='account:'+account.uid;
 }else identity='session:'+token;
 if(isStudentPreview(scope.code)||savedSession(sessionCode)?.token!==token)return null;
 const bytes=new TextEncoder().encode(JSON.stringify([identity,scope.role,scope.code,scope.source,scope.version]));
 const digest=await window.crypto.subtle.digest('SHA-256',bytes);
 const key=PREFIX+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 return {key,current:()=>scope.enabled!==false&&!isStudentPreview(scope.code)&&savedSession(sessionCode)?.token===token};
}
function valueShape(value:unknown,sample:unknown):boolean{
 if(sample===null)return value===null||!!value&&typeof value==='object'&&!Array.isArray(value);
 if(Array.isArray(sample))return Array.isArray(value);
 if(sample&&typeof sample==='object')return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.entries(sample).every(([key,part])=>Object.hasOwn(value,key)&&valueShape((value as Record<string,unknown>)[key],part));
 return typeof value===typeof sample;
}
export function readDurableDraft<T>(scope:ResolvedDraftScope,initial:T):DurableDraft<T>|null{
 if(!scope.current())return null;
 const raw=window.localStorage.getItem(scope.key);if(!raw)return null;
 const draft=JSON.parse(raw) as DurableDraft<T>;
 const shape=valueShape(draft?.value,initial);
 if(!draft||draft.schema!==1||!shape||typeof draft.requestId!=='string'||!draft.requestId||typeof draft.pending!=='boolean'||!Number.isFinite(draft.updatedAt))throw new Error('This draft could not be read. Copy any open work before leaving.');
 return draft;
}
export function writeDurableDraft<T>(scope:ResolvedDraftScope,draft:DurableDraft<T>):void{
 if(!scope.current())throw new Error('Sign in again before saving this draft.');
 window.localStorage.setItem(scope.key,JSON.stringify(draft));
}
export function removeDurableDraft(scope:ResolvedDraftScope):void{if(scope.current())window.localStorage.removeItem(scope.key);}

// Preserve an unreadable local copy before a fresh editor can replace its key.
export function preserveUnreadableDraft(scope:ResolvedDraftScope):string|null{
 if(!scope.current())throw new Error('Sign in before recovering this draft.');
 const raw=window.localStorage.getItem(scope.key);if(raw===null)return null;
 const recoveryKey=scope.key+'_unreadable_'+Date.now()+'_'+crypto.randomUUID();
 window.localStorage.setItem(recoveryKey,raw);
 if(window.localStorage.getItem(recoveryKey)!==raw)throw new Error('The unreadable draft could not be kept.');
 window.localStorage.removeItem(scope.key);return recoveryKey;
}
