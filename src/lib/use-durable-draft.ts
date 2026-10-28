"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {resolveDraftScope,readDurableDraft,writeDurableDraft,removeDurableDraft,preserveUnreadableDraft,type DraftScope,type DurableDraft,type ResolvedDraftScope} from './durable-drafts';
export function useDurableDraft<T>(scope:DraftScope,initialValue:T){
 const tag=JSON.stringify([scope.code,scope.role,scope.source,scope.version,scope.enabled!==false]);
 const initial=useRef(initialValue);initial.current=initialValue;
 const resolved=useRef<ResolvedDraftScope|null>(null),draft=useRef<DurableDraft<T>|null>(null),generation=useRef(0);
 const [authEpoch,setAuthEpoch]=useState(0);
 const [state,setState]=useState<{tag:string;draft:DurableDraft<T>;ready:boolean;scopeKey:string}|null>(null),[error,setError]=useState('');
 useEffect(()=>{
  let live=true;const attempt=++generation.current;resolved.current=null;draft.current=null;setState(null);setError('');
  const load=async()=>{try{const destination=await resolveDraftScope(scope);if(!live||attempt!==generation.current)return;if(!destination)return;
   const empty:DurableDraft<T>={schema:1,value:initial.current,requestId:crypto.randomUUID(),pending:false,updatedAt:0};
   let restored:DurableDraft<T>|null=null;try{restored=readDurableDraft(destination,initial.current);}catch{preserveUnreadableDraft(destination);setError('An unreadable draft was kept separately in device recovery. You can start a fresh draft here.');}
   resolved.current=destination;draft.current=restored||empty;setState({tag,draft:draft.current,ready:true,scopeKey:destination.key});
  }catch{if(live)setError('Draft storage is unavailable. Copy your work before leaving.');}};
  void load();
  const changed=()=>{generation.current++;resolved.current=null;draft.current=null;setState(null);setAuthEpoch(value=>value+1);};
  window.addEventListener('re-auth-change',changed);
  return()=>{live=false;generation.current++;window.removeEventListener('re-auth-change',changed);};
 // Initial values are a fallback at scope entry, never a reason to overwrite an edit.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[tag,authEpoch]);
 const expectedScopeKey=state?.tag===tag?state.scopeKey:'';
 const checkpoint=useCallback((value:T|((previous:T)=>T))=>{
  const destination=resolved.current,current=draft.current;if(!destination||!current||!destination.current()||current.pending||!expectedScopeKey||destination.key!==expectedScopeKey)return false;
  const nextValue=typeof value==='function'?(value as (previous:T)=>T)(current.value):value;
  const next={...current,value:nextValue,requestId:current.pending?current.requestId:crypto.randomUUID(),updatedAt:Date.now()};
  draft.current=next;setState({tag,draft:next,ready:true,scopeKey:destination.key});
  try{writeDurableDraft(destination,next);setError('');return true;}catch{setError('Could not save on this device. Copy your work before leaving.');return false;}
 },[tag,expectedScopeKey]);
 const beginRequest=useCallback(()=>{
  const destination=resolved.current,current=draft.current;if(!destination||!current||!destination.current()||!expectedScopeKey||destination.key!==expectedScopeKey)throw new Error('Sign in before saving this work.');
  const next={...current,pending:true,updatedAt:Date.now()};
  try{writeDurableDraft(destination,next);}catch{setError('Could not save the pending copy on this device. Copy your work before leaving.');throw new Error('Could not keep a retry copy. Copy your work before trying again.');}
  draft.current=next;setState({tag,draft:next,ready:true,scopeKey:destination.key});return next.requestId;
 },[tag,expectedScopeKey]);
 // Use only after an explicit refusal: an uncertain response must keep its ID.
 const resumeEditing=useCallback(()=>{
  const destination=resolved.current,current=draft.current;if(!destination||!current||!destination.current()||!expectedScopeKey||destination.key!==expectedScopeKey)return false;
  const next={...current,pending:false,requestId:crypto.randomUUID(),updatedAt:Date.now()};
  try{writeDurableDraft(destination,next);}catch{setError('Could not save an editable draft. The pending copy is kept.');return false;}
  draft.current=next;setState({tag,draft:next,ready:true,scopeKey:destination.key});setError('');return true;
 },[tag,expectedScopeKey]);
 const confirmSaved=useCallback((nextValue?:T)=>{
  const destination=resolved.current;if(!destination||!destination.current()||!expectedScopeKey||destination.key!==expectedScopeKey)return false;
  try{removeDurableDraft(destination);setError('');}catch{setError('The device draft could not be cleared. It is kept here for you.');return false;}
  const next:DurableDraft<T>={schema:1,value:nextValue===undefined?initial.current:nextValue,requestId:crypto.randomUUID(),pending:false,updatedAt:0};draft.current=next;setState({tag,draft:next,ready:true,scopeKey:destination.key});return true;
 },[tag,expectedScopeKey]);
 const current=state?.tag===tag&&state.ready?state:null;
 return {value:current?.draft.value??initialValue,setValue:checkpoint,checkpoint,ready:!!current,pending:current?.draft.pending??false,requestId:current?.draft.requestId??'',scopeKey:current?.scopeKey??'',updatedAt:current?.draft.updatedAt??0,status:current?.draft.pending?'Delivery unconfirmed · retry this saved copy':current?.draft.updatedAt?'Draft saved on this device':'Draft stays on this device',error,beginRequest,resumeEditing,confirmSaved,discard:confirmSaved};
}
