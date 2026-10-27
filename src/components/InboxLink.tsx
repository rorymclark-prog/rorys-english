"use client";
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {savedSession} from '@/lib/api';
import {inboxRequest} from '@/lib/inbox';
export default function InboxLink({code,teacher=false}:{code?:string;teacher?:boolean}){
 const [unread,setUnread]=useState<number|null>(null);
 useEffect(()=>{let live=true,pending=false;async function refresh(){if(document.hidden||pending)return;pending=true;const token=teacher?savedSession('__teacher__')?.token:undefined;if(teacher&&!token){setUnread(null);pending=false;return;}try{const r=await inboxRequest(code||'__teacher__',token,{action:teacher?'teacherNotifications':'notifications'});if(live)setUnread(r.ok?r.unread??0:null);}finally{pending=false;}}void refresh();const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);window.addEventListener('re-inbox-change',refresh);const auth=()=>{setUnread(null);void refresh();};window.addEventListener('re-auth-change',auth);return()=>{live=false;clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('re-inbox-change',refresh);window.removeEventListener('re-auth-change',auth);};},[code,teacher]);
 return <Link className="inbox-link" href={teacher?'/teacher/?inbox=notifications':`/s/${code}/notifications/`} aria-label={`Notifications${unread===null?' · unavailable':unread?` · ${unread} unread`:''}`}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span className="inbox-link-label">Notifications</span>{unread!==null&&unread>0&&<b>{unread>99?'99+':unread}</b>}</Link>;
}
