"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {getLearning} from '@/lib/learning';
import {lessonPracticeRecord} from '@/lib/lesson-practice';
import type {Assignment} from '@/lib/remote';
import {homeworkSection} from '@/lib/homework-hub';
import {assignmentTargetId,learnerTaskTitle} from '@/lib/today-task';
import {BookIcon,PencilIcon} from './Icons';
import {MicrophoneIcon} from './LearningVisuals';
import SubmissionForm from './SubmissionForm';
import SavedWriting from './SavedWriting';
import EngagementPanel from './EngagementPanel';
export default function HomeworkHub({code,name,assignment}:{code:string;name:string;assignment:Assignment}){
 const [tab,setTab]=useState<'writing'|'vocabulary'|null>(null),[entry,setEntry]=useState<ReturnType<typeof lessonPracticeRecord>>(null);
 useEffect(()=>{let live=true;getLearning(code).then(r=>{if(live&&r.ok)setEntry(lessonPracticeRecord(r.records||[]));});const requested=new URLSearchParams(window.location.search).get('practice');if(requested==='vocabulary'||requested==='writing')setTab(requested);return()=>{live=false;};},[code,assignment.id]);
 const speaking=entry?`/s/${code}/speak/?mode=lesson&practice=${encodeURIComponent(entry.record.id)}`:`/s/${code}/speak/`;
 function open(next:'writing'|'vocabulary'){setTab(next);const url=new URL(window.location.href);url.searchParams.set('assignment',assignment.id);url.searchParams.set('practice',next);url.hash='homework-practice';window.history.replaceState(window.history.state,'',url);}
 const writing=homeworkSection(assignment.details,'writing'),vocabulary=homeworkSection(assignment.details,'vocabulary');
 return <section id={assignmentTargetId(assignment.id)} tabIndex={-1} className="homework-hub">
  <p className="work-eyebrow">YOUR CURRENT HOMEWORK</p><h2>{learnerTaskTitle(assignment.title)}</h2><p>Choose what you want to practise.</p>
  <nav className="homework-actions" aria-label="Choose homework practice">
   <Link href={speaking}><MicrophoneIcon/><strong>AI speaking</strong><small>Talk with your AI partner</small></Link>
   <button type="button" aria-pressed={tab==='writing'} onClick={()=>open('writing')}><PencilIcon/><strong>Writing</strong><small>Your task, writing and photos</small></button>
   <button type="button" aria-pressed={tab==='vocabulary'} onClick={()=>open('vocabulary')}><BookIcon/><strong>Vocabulary</strong><small>Word · meaning · your sentence</small></button>
  </nav>
  <div id="homework-practice">
   {tab==='writing'&&<section className="homework-practice-pane" aria-label="Writing homework"><h3>Writing</h3>{writing?<p className="whitespace-pre-wrap">{writing}</p>:<p>Use your writing task in the full homework instructions below.</p>}<p>Keep any work already submitted. Use its feedback for a revision; you do not need to start again.</p><SavedWriting code={code} name={name}/><SubmissionForm code={code} unit="assigned" task={assignment.id} title={`${assignment.title} · Writing`} fields={[{id:'answer',prompt:'Your writing',type:'written'}]}/></section>}
   {tab==='vocabulary'&&<section className="homework-practice-pane" aria-label="Vocabulary homework"><h3>Vocabulary</h3>{vocabulary&&<p className="whitespace-pre-wrap">{vocabulary}</p>}<EngagementPanel code={code} vocabularyOnly/></section>}
  </div>
  <details className="homework-full-instructions"><summary>Full homework instructions</summary><p className="whitespace-pre-wrap">{assignment.details}</p></details>
 </section>;
}
