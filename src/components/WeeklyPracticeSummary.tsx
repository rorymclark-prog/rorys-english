"use client";
import Link from 'next/link';
import {PencilIcon,BookIcon} from './Icons';
import {MicrophoneIcon} from './LearningVisuals';
import {weeklyTimeEstimate} from '@/lib/homework-hub';
import type {ringProgress} from '@/lib/practice-rings';
export type WeeklySummaryState={status:'loading'|'ready'|'error'|'unavailable';progress?:ReturnType<typeof ringProgress>};
const amount=(n:number)=>n>0&&n<1?'<1':String(Math.round(n*10)/10);
/** Uses the same loaded sources, calendar and credit rules as the detailed rings. */
export default function WeeklyPracticeSummary({state,href='#weekly-practice'}:{state:WeeklySummaryState;/** Where the full rings live. */href?:string}){
 const p=state.progress,ready=state.status==='ready'&&!!p,paused=ready&&p.paused;
 const goals=[{id:'speaking',label:'Speaking',Icon:MicrophoneIcon,value:p?.minutes||0,target:p?.target||0,unit:'min',radius:78},{id:'writing',label:'Writing',Icon:PencilIcon,value:p?.writing||0,target:p?.writingTarget||0,unit:'attempt',radius:59},{id:'vocabulary',label:'Vocabulary',Icon:BookIcon,value:p?.vocabulary||0,target:p?.vocabularyTarget||0,unit:'words',radius:40}];
 return <aside className="today-weekly-summary" aria-label="This week’s saved practice">
  <Link href={href} className="today-weekly-open" aria-label="View weekly speaking, writing and vocabulary progress">
   <div className="weekly-rings-graphic" role="img" aria-label={ready?(paused?'Weekly practice paused for a holiday':goals.map(g=>`${g.label}: ${amount(g.value)} of ${g.target} ${g.unit}`).join('; ')):'Weekly progress unavailable until saved work and calendar are checked'}>
    <svg viewBox="0 0 180 180" aria-hidden="true">{goals.map(g=><g key={g.id} className={`weekly-ring-${g.id}`}><circle className="weekly-ring-track" style={{opacity:1}} cx="90" cy="90" r={g.radius}/><circle className="weekly-ring-fill" style={{opacity:ready&&!paused&&g.value>0?1:0}} cx="90" cy="90" r={g.radius} pathLength="100" strokeDasharray={`${ready&&!paused&&g.target?Math.min(1,g.value/g.target)*100:0} 100`}/></g>)}</svg>
    <span><strong>{!ready?'—':paused?'Rest':`${p.closed}/3`}</strong><small>{!ready?(state.status==='loading'?'checking':'unavailable'):paused?'holiday pause':'rings closed'}</small></span>
   </div>
   <span className="today-weekly-label">This week’s progress <span aria-hidden="true">↗</span></span>
  </Link>
  <ul className="today-weekly-legend">{goals.map(({id,label,Icon,value,target,unit})=><li key={id} className={`weekly-ring-${id}`}><Icon/><span>{label}</span><strong>{!ready?'—':paused?'Paused':`${amount(value)}/${target}`}<small>{ready&&!paused?` ${unit}`:''}</small></strong></li>)}</ul>
  {ready&&!paused&&<p className="weekly-time-estimate">{weeklyTimeEstimate(p)===0?'All three rings closed — well done!':`To close these rings: about ${weeklyTimeEstimate(p)} min left`}<br/><small>An estimate from saved work; your pace may vary.</small></p>}
  {state.status==='error'||state.status==='unavailable'?<p role="status">Progress could not be checked. <Link href={href}>Open the details to retry</Link>.</p>:state.status==='loading'?<p role="status">Checking saved work…</p>:<p>Saved practice · <Link href={href}>See details</Link></p>}
 </aside>;
}
