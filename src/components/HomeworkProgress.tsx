'use client';
import {useState} from 'react';
import Link from 'next/link';
import type {HomeworkArea,HomeworkGoal,HomeworkProgress} from '@/lib/homework-progress';
import {useParentLanguage} from './ParentLanguage';
import AnswerWithPhotos from './AnswerWithPhotos';
import WorkFeedback from './WorkFeedback';
import {eventDay} from '@/lib/teacher-metrics';
import {PencilIcon,BookIcon,CheckSquareIcon} from './Icons';
const areaNames:Record<HomeworkArea,[string,string]>={writing:['Writing','Schreiben'],spelling:['Spelling','Rechtschreibung'],multiplication:['Multiplication','Multiplizieren']};
const classes:Record<HomeworkArea,string>={writing:'weekly-ring-writing',spelling:'weekly-ring-vocabulary',multiplication:'weekly-ring-speaking'};
const icons={writing:PencilIcon,spelling:BookIcon,multiplication:CheckSquareIcon};
const date=(day:string,language:string)=>new Intl.DateTimeFormat(language==='de'?'de-AT':'en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Vienna'}).format(new Date(day+'T12:00:00Z'));
function GoalRings({progress}:{progress:HomeworkProgress}){
 const {t}=useParentLanguage();
 return <div className="weekly-rings-graphic" role="img" aria-label={t(`${progress.submitted} of ${progress.total} homework tasks submitted`,`${progress.submitted} von ${progress.total} Hausaufgaben abgegeben`)}>
  <svg viewBox="0 0 180 180" aria-hidden="true">{progress.goals.map((g,i)=>{const radius=78-i*38/Math.max(1,progress.goals.length-1),fraction=g.received?1:g.answered/g.required;return <g key={g.id} className={classes[g.area]}><circle className="weekly-ring-track" cx="90" cy="90" r={radius}/><circle className="weekly-ring-fill" style={{opacity:fraction>0?1:0}} cx="90" cy="90" r={radius} pathLength="100" strokeDasharray={`${Math.min(100,fraction*100)} 100`}/></g>;})}</svg>
  <span><strong>{progress.submitted}/{progress.total}</strong><small>{t('tasks submitted','Aufgaben abgegeben')}</small></span>
 </div>;
}
function useGoalStatus(){const {t}=useParentLanguage();return (goal:HomeworkGoal)=>goal.status==='revision'?t('Revision requested','Überarbeitung nötig'):goal.received?t('Submitted','Abgegeben'):goal.latest?t('Partly submitted','Teilweise abgegeben'):t('Not submitted','Noch nicht abgegeben');}
export function HomeworkProgressSummary({progress,href,status}:{progress?:HomeworkProgress;href:string;status:'loading'|'ready'|'error'|'unavailable'}){
 const {t,language}=useParentLanguage(),goalStatus=useGoalStatus();
 if(status!=='ready'||!progress)return <aside className="today-weekly-summary homework-progress-summary" aria-label={t('Homework progress','Fortschritt bei den Hausaufgaben')}><strong>{status==='loading'?t('Checking homework…','Hausaufgaben werden geladen…'):t('Saved homework could not load','Gespeicherte Hausaufgaben konnten nicht geladen werden')}</strong><p><Link href={href}>{status==='loading'?t('Open progress','Fortschritt öffnen'):t('Open details to retry','Details öffnen und erneut versuchen')}</Link></p></aside>;
 return <aside className="today-weekly-summary homework-progress-summary" aria-label={t('Homework progress','Fortschritt bei den Hausaufgaben')}>
  <Link className="today-weekly-open" href={href} aria-label={t('View writing, spelling and multiplication progress','Fortschritt in Schreiben, Rechtschreibung und Multiplizieren anzeigen')}><GoalRings progress={progress}/><span className="today-weekly-label">{t('Homework progress','Fortschritt bei den Hausaufgaben')} ↗</span></Link>
  <ul className="today-weekly-legend">{progress.goals.map(g=>{const Icon=icons[g.area];return <li key={g.id} className={classes[g.area]}><Icon/><span>{t(...areaNames[g.area])}</span><strong>{goalStatus(g)}</strong></li>;})}</ul>
  <p>{progress.assignmentWeek?t(`Week of ${date(progress.assignmentWeek,language)}`,`Woche ab ${date(progress.assignmentWeek,language)}`):t('No weekly homework assigned yet.','Noch keine Wochenhausaufgaben zugewiesen.')}<br/>{progress.hasWork?t('Saved work · open details for feedback','Gespeicherte Arbeiten · Details für Feedback öffnen'):t('No homework submitted yet. Not assessed yet.','Noch keine Hausaufgaben abgegeben. Noch nicht beurteilt.')}</p>
 </aside>;
}
function GoalCard({goal,code,teacher,parent}:{goal:HomeworkGoal;code:string;teacher:boolean;parent:boolean}){
 const {t,language}=useParentLanguage(),goalStatus=useGoalStatus(),[open,setOpen]=useState(false);
 const last=goal.latest,day=last&&eventDay(last.submitted),href=`/s/${code}/lessons/${goal.unitId}/homework/${goal.week}/`;
 return <article className={`weekly-goal homework-goal ${classes[goal.area]} ${goal.received?'is-complete':''}`}>
  <header><span className="weekly-ring-dot" aria-hidden="true"/><h4>{t(...areaNames[goal.area])}</h4><strong>{goalStatus(goal)}</strong></header>
  <p>{goal.photo?t('Photographed work received. Individual answers can be checked in the feedback.','Fotografierte Arbeit erhalten. Die einzelnen Antworten können im Feedback geprüft werden.'):t(`${goal.answered}/${goal.required} required parts submitted`,`${goal.answered}/${goal.required} erforderliche Teile abgegeben`)}</p>
  {last?<><p>{day?t(`Saved ${date(day,language)}`,`Gespeichert am ${date(day,language)}`):t('Submission date unavailable.','Abgabedatum nicht verfügbar.')}{day&&day<goal.assignmentWeek?t(' · Earlier work kept',' · Frühere Arbeit bleibt angerechnet'):''}</p>{goal.status==='revision'&&<p>{t('Use the feedback for your next revision. Your original stays saved.','Nutze das Feedback für die Überarbeitung. Das Original bleibt gespeichert.')}</p>}
   <details onToggle={e=>{if(e.target===e.currentTarget)setOpen(e.currentTarget.open);}}><summary>{t('Show saved work and feedback','Gespeicherte Arbeit und Feedback anzeigen')}</summary>{open&&<div className="homework-saved-work">{goal.fields.filter(f=>last.answers[f.id]?.trim()).map(f=><div key={f.id}><strong>{f.title||f.prompt}</strong><AnswerWithPhotos code={code} teacher={teacher} answer={last.answers[f.id]}/></div>)}{last.answers.handwritten_work&&<AnswerWithPhotos code={code} teacher={teacher} answer={last.answers.handwritten_work}/>} {!!last.feedback&&!last.reviewPending&&<p>{last.feedback}</p>}<WorkFeedback code={code} id={last.id} sourceType="submission" teacher={teacher} parent={parent}/><p>{goal.versions} {t('saved version(s). Originals and revisions stay separate.','gespeicherte Version(en). Originale und Überarbeitungen bleiben getrennt.')}</p></div>}</details>
  </>:<p>{t('No saved answer yet. Submit this task to start tracking it.','Noch keine gespeicherte Antwort. Gib diese Aufgabe ab, damit sie hier erscheint.')}</p>}
  {!parent&&<Link className="re-button re-secondary" href={teacher?`/teacher/?student=${encodeURIComponent(code)}&section=documents`:href}>{teacher?t('Review saved work','Gespeicherte Arbeiten prüfen'):goal.received?t('Open saved homework','Gespeicherte Hausaufgabe öffnen'):t('Open this task','Aufgabe öffnen')}</Link>}
 </article>;
}
export default function HomeworkProgressPanel({progress,code,teacher=false,parent=false,onWeekChange,onRefresh,warning=''}:{progress:HomeworkProgress;code:string;teacher?:boolean;parent?:boolean;onWeekChange?:(week:string)=>void;onRefresh?:()=>void;warning?:string}){
 const {t,language}=useParentLanguage();
 return <section className="engagement-panel homework-progress-panel" aria-label={t('Homework progress','Fortschritt bei den Hausaufgaben')}>
  <header className="engagement-heading"><div><p className="re-eyebrow">{t('WRITING · SPELLING · MULTIPLICATION','SCHREIBEN · RECHTSCHREIBUNG · MULTIPLIZIEREN')}</p><h2>{t('Homework progress','Fortschritt bei den Hausaufgaben')}</h2></div>{onRefresh&&<button className="engagement-refresh" onClick={onRefresh}>{t('Refresh','Aktualisieren')}</button>}</header>
  {!!progress.weeks.length&&<label className="homework-progress-week">{t('Homework week','Hausaufgabenwoche')}<select value={progress.assignmentWeek} disabled={!onWeekChange} onChange={e=>onWeekChange?.(e.target.value)}>{progress.weeks.map(week=><option key={week} value={week}>{t('Week of ','Woche ab ')}{date(week,language)}</option>)}</select></label>}
  <div className="weekly-rings-overview"><GoalRings progress={progress}/><div><h3>{t(`${progress.submitted} of ${progress.total} tasks submitted`,`${progress.submitted} von ${progress.total} Aufgaben abgegeben`)}</h3><p>{progress.hasWork?t('These rings show saved homework, not accuracy or a grade. Open each task’s work and feedback to see what went well and what needs practice.','Die Ringe zeigen abgegebene Hausaufgaben, keine Genauigkeit oder Note. Öffne Arbeit und Feedback, um Stärken und Übungsbedarf zu sehen.'):progress.total?t('No homework submitted yet. Accuracy is not assessed yet. The rings update when an answer or photographed page is received.','Noch keine Hausaufgaben abgegeben. Die Genauigkeit wurde noch nicht beurteilt. Die Ringe aktualisieren sich, sobald eine Antwort oder ein Foto eingegangen ist.'):t('No weekly homework assigned yet.','Noch keine Wochenhausaufgaben zugewiesen.')}</p></div></div>
  {warning&&<p className="engagement-note" role="status">{warning}</p>}
  <div className="weekly-ring-goals">{progress.goals.map(goal=><GoalCard key={goal.id} goal={goal} code={code} teacher={teacher} parent={parent}/>)}</div>
  <p className="engagement-note">{t('Optional chats, stretch questions and checkboxes do not fill these homework rings. Unsent device drafts are not submissions. Keep any work already received; do not upload it again.','Optionale Gespräche, Zusatzaufgaben und Kontrollkästchen füllen diese Ringe nicht. Nicht versendete Geräteentwürfe zählen nicht als Abgabe. Bereits eingegangene Arbeiten bleiben gespeichert und müssen nicht erneut hochgeladen werden.')}</p>
 </section>;
}
