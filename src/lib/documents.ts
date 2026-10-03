import {authed, request, savedSession, type ApiResult} from './api';
import type {LearningRecord,WritingComparison} from './learning';
export type DocumentAnalysis={transcription:string;coverage:'complete'|'partial'|'unreadable';uncertainties:string[];summary:string;strengths:string[];corrections:{original:string;suggestion:string;explanation:string}[];retry:string;model?:string;writing?:{original:string;comparisons:WritingComparison[]}};
export type LearnerDocument={id:string;title:string;created:string;uploadedBy:string;files:{index:number;name:string;type:string;size:number}[];status:'saved'|'analysing'|'ready'|'error';feedback:string;reviewed:string;parentId:string;context:string;error:string;processing:boolean;analysis?:DocumentAnalysis|null;feedbackAvailableAt?:string;reviewPending?:boolean};
export type DocumentMessage={id:string;created?:string;question:string;answer:string;askedBy:string};
export type DocumentReply=ApiResult&{documents?:LearnerDocument[];document?:LearnerDocument;review?:LearningRecord|null;messages?:DocumentMessage[];message?:DocumentMessage;received?:boolean;pending?:boolean;file?:{name:string;type:string;data:string}};
export const MAX_DOCUMENT_BYTES=2500000;
export function analysisReadState(document:LearnerDocument,seenProcessing:boolean,previousError:string):'ready'|'error'|'waiting' {
  if(document.processing)return 'waiting';
  if(document.analysis?.writing)return 'ready';
  if(document.error&&(seenProcessing||document.error!==previousError))return 'error';
  return 'waiting';
}
export function documentRequest(code:string,teacher:boolean,body:Record<string,unknown>):Promise<DocumentReply> {
  return teacher?request({...body,code,session:savedSession('__teacher__')?.token||''}):authed(code,body);
}
export function fileBase64(file:Blob):Promise<string>{return new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(new Error('Could not read this file. Please choose it again.'));r.onload=()=>resolve(String(r.result).split(',')[1]);r.readAsDataURL(file);});}
export function validateDocumentFiles(files:File[]):string {
  if(!files.length||files.length>6)return 'Choose one PDF or up to six photos.';
  if(files.some(f=>!['application/pdf','image/jpeg','image/png','image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document','audio/webm','audio/mp4','audio/ogg','audio/mpeg'].includes(f.type)))return 'Choose a Word document, PDF, photo or audio recording. For an iPhone photo, use Scan pages or export a JPEG.';
  if(files.some(f=>f.type==='application/pdf'||f.type==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'||f.type.startsWith('audio/'))&&files.length>1)return 'Choose one document or recording at a time, or a set of photos.';
  if(files.reduce((n,f)=>n+f.size,0)>MAX_DOCUMENT_BYTES)return 'This upload is over 2.5 MB. Choose fewer photos, or export a smaller document or recording.';
  if(files.some(f=>!f.size))return 'One of these files is empty. Please choose it again.';
  return '';
}
