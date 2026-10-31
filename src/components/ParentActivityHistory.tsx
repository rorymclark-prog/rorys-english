"use client";
import {useEffect,useState} from 'react';
import {fetchProgress,type Progress,type Section} from '@/lib/remote';
import {useParentLanguage} from './ParentLanguage';
import {familyFeedbackText} from '@/lib/parent-feedback';
import {parentDate} from '@/lib/parent-language';
const fieldNames:Record<string,string>={date:'Datum',unit:'Lerneinheit',week:'Woche',title:'Titel',status:'Status',tool:'Übung',section:'Bereich',score:'Punkte',max:'Maximum',total:'Gesamt',test:'Prüfung',feedback:'Feedback',grammar:'Grammatik',vocab:'Wortschatz',coherence:'Zusammenhang',notes:'Notizen',recording:'Aufnahme',fluency:'Sprechfluss',pronunciation:'Aussprache'};
export default function ParentActivityHistory({code}:{code:string}){
 const {t,language}=useParentLanguage();const [data,setData]=useState<Progress|null>(null),[error,setError]=useState(false);
 useEffect(()=>{let active=true;fetchProgress(code).then(result=>{if(active){if(result.ok)setData(result);else setError(true);}}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[code]);
 const sections:[string,Section|undefined][]=[[t('Homework','Hausübungen'),data?.homework],[t('Quizzes & vocabulary','Quiz & Wortschatz'),data?.quizzes],[t('School tests','Schulprüfungen'),data?.schoolTests],[t('Writing','Schreiben'),data?.writing],[t('Speaking','Sprechen'),data?.speaking],[t('Practice tests','Übungsprüfungen'),data?.mockTests]];
 return <details className="parent-feedback-card"><summary><strong>{t('Practice history & school results','Übungsverlauf & schulische Ergebnisse')}</strong><span>⌄</span></summary><p className="parent-status">{t('Activity counts and quiz attempts are separate from measured skill progress.','Aktivitäten und Quizversuche werden getrennt vom gemessenen Lernfortschritt betrachtet.')}</p>{error?<p>{t('This history could not be loaded.','Der Verlauf konnte nicht geladen werden.')}</p>:!data?<p role="status">{t('Loading history…','Verlauf wird geladen…')}</p>:sections.filter(([,section])=>section?.rows.length).map(([title,section])=><section key={title}><h3>{title}</h3>{section!.rows.slice().reverse().map((row,index)=><dl className="parent-original" key={index}>{section!.headers.map((field,column)=>{const value=String(row[column]??'');if(!value.trim())return null;const date=/^\d{4}-\d{2}-\d{2}(T|$)/.test(value);return <div key={column}><dt className="font-bold text-sm">{language==='de'?fieldNames[field.toLowerCase()]||field:field}</dt><dd>{date?parentDate(value,language):familyFeedbackText(value)}</dd></div>;})}</dl>)}</section>)}</details>;
}
