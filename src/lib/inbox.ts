"use client";
import {authed,request,type ApiResult} from './api';
export type InboxEvent={id:string;code:string;name?:string;at:string;kind:string;title:string;detail:string;view:string;read:boolean};
export type DirectMessage={id:string;created:string;sender:'student'|'teacher';text:string;read?:boolean};
export interface InboxResult extends ApiResult{events?:InboxEvent[];unread?:number;messages?:DirectMessage[];message?:DirectMessage;received?:boolean;hasEarlier?:boolean;students?:{code:string;name:string;lastActivity:string|null}[];generatedAt?:string}
export const inboxRequest=(code:string,teacherToken:string|undefined,body:Record<string,unknown>)=>teacherToken?request<InboxResult>({...body,code,session:teacherToken}):authed<InboxResult>(code,body);
export const inboxChanged=()=>window.dispatchEvent(new Event('re-inbox-change'));
export function inboxDate(at:string){return new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Vienna',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(at));}
