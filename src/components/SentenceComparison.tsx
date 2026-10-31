"use client";
import {useEffect,useState} from 'react';
import {sentenceReview,type SentenceRow,type WritingSource} from '@/lib/writing-review';
import {writingTranslator,unchangedNote,type WritingLanguage} from '@/lib/writing-labels';
import {changed,Highlight} from './WritingHighlights';
import WritingVersions from './WritingVersions';

type Display={language?:WritingLanguage;formatNote?:(value:string)=>string};
function SentenceNotes({row,language='en',formatNote=unchangedNote}:{row:SentenceRow}&Display){
 const t=writingTranslator(language),checks={spelling:t('Spelling','Rechtschreibung'),grammar:t('Grammar','Grammatik'),wordChoice:t('Word choice','Wortwahl'),punctuation:t('Punctuation','Zeichensetzung'),flow:t('Linking / flow','Verknüpfung / Lesefluss'),taskFit:t('Fit to the task','Erfüllung der Aufgabe')};
 return <><p>{formatNote(row.note)}</p>{row.checks&&<dl className="writing-checks">{Object.entries(checks).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{row.checks![key as keyof typeof row.checks]==='ok'?t('No issue found.','Keine Auffälligkeit festgestellt.'):formatNote(row.checks![key as keyof typeof row.checks])}</dd></div>)}</dl>}</>;
}
function SentenceText({row,version,language='en'}:{row:SentenceRow;version:'original'|'corrected'|'improved'}&Display){
 const t=writingTranslator(language);
 if(version==='original')return row.readingUncertain?<span className="doc-preserve">{row.original}</span>:<Highlight text={row.original} mask={changed(row.original,row.corrected||row.original).old} mark="sentence-red"/>;
 if(version==='corrected')return row.corrected?(row.readingUncertain?<span className="doc-preserve">{row.corrected}</span>:<Highlight text={row.corrected} mask={changed(row.original,row.corrected).new} mark="sentence-green"/>):row.readingUncertain?t('Reading needs confirmation.','Lesart muss bestätigt werden.'):t('No complete correction saved.','Keine vollständige Korrektur gespeichert.');
 return row.improved?<Highlight text={row.improved} mask={changed(row.corrected,row.improved).new} mark="sentence-blue"/>:t('No optional wording saved.','Keine zusätzliche Formulierung gespeichert.');
}

/** One reading representation is mounted at a time, keeping every sentence and check. */
export function SentenceCards({rows,language='en',formatNote=unchangedNote}:{rows:SentenceRow[]}&Display){
 const t=writingTranslator(language);
 return <ol className="sentence-reading-cards" aria-label={t('Sentence cards','Satzkarten')}>{rows.map((row,index)=>row.status==='source-note'?<li key={index} className="sentence-source-note"><p>{row.original}</p><p className="doc-muted">{formatNote(row.note)}</p></li>:<li key={index} className="sentence-reading-card">
   <header><h4>{t('Sentence','Satz')} {row.number}</h4><p>{row.readingUncertain?t('Reading needs confirmation','Lesart muss bestätigt werden'):row.status==='pending'?t('Correction not complete','Korrektur unvollständig'):row.status==='unchanged'?t('No language change suggested','Keine sprachliche Änderung vorgeschlagen'):t('Language change suggested','Sprachliche Änderung vorgeschlagen')}</p></header>
   <section><h5>{t('Original · red','Original · rot')}</h5><p><SentenceText row={row} version="original" language={language}/></p></section>
   <section><h5>{t('Corrected · green','Korrigiert · grün')}</h5>{row.readingUncertain&&row.corrected&&<p className="doc-muted">{t('Saved wording; the reading is still unconfirmed.','Gespeicherter Wortlaut; die Lesart ist noch nicht bestätigt.')}</p>}<p><SentenceText row={row} version="corrected" language={language}/></p></section>
   <section><h5>{t('Another way · blue · optional','Andere Formulierung · blau · optional')}</h5><p><SentenceText row={row} version="improved" language={language}/></p></section>
   <section className="sentence-card-checks"><h5>{t('Checks & explanation','Prüfpunkte & Erklärung')}</h5><SentenceNotes row={row} language={language} formatNote={formatNote}/></section>
 </li>)}</ol>;
}

export default function SentenceComparison({writing,language='en',formatNote=unchangedNote}:{writing:WritingSource}&Display){
 const t=writingTranslator(language),[phone,setPhone]=useState(false),[readingMode,setReadingMode]=useState<'cards'|'table'>('cards');
 useEffect(()=>{const media=window.matchMedia('(max-width: 640px)'),update=()=>setPhone(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 const review=sentenceReview(writing),readingCount=review.rows.filter(row=>row.readingUncertain).length,missingCount=review.rows.filter(row=>row.status==='pending'&&!row.readingUncertain).length,cards=phone&&readingMode==='cards';
 return <><section className="sentence-review refined-sentence-review" aria-label={t('Sentence by sentence','Satz für Satz')}><h3>{t('Sentence by sentence','Satz für Satz')}</h3><p className="doc-muted">{t('Every sentence stays in order.','Alle Sätze bleiben in ihrer ursprünglichen Reihenfolge.')} {cards?t('Read each sentence and its saved checks below.','Hier finden Sie jeden Satz mit den gespeicherten Prüfpunkten.'):t('Open a sentence with no changes for its review notes.','Öffnen Sie auch unveränderte Sätze, um die zugehörigen Erklärungen zu lesen.')} {t(`The full paragraph versions follow ${cards?'the cards':'the table'}.`,`Die vollständigen Textfassungen folgen unter ${cards?'den Karten':'der Tabelle'}.`)}</p>
   {phone&&<div className="sentence-reading-controls" role="group" aria-label={t('Sentence reading layout','Darstellung der Satzkorrekturen')}><button type="button" aria-pressed={readingMode==='cards'} onClick={()=>setReadingMode('cards')}>{t('Sentence cards','Satzkarten')}</button><button type="button" aria-pressed={readingMode==='table'} onClick={()=>setReadingMode('table')}>{t('Full table','Vollständige Tabelle')}</button></div>}
   {readingCount>0&&<p className="doc-reading-note">{t(`${readingCount} ${readingCount===1?'sentence needs':'sentences need'} reading confirmation. Unclear wording stays unmarked.`,`${readingCount} ${readingCount===1?'Satz enthält':'Sätze enthalten'} eine unklare Lesart. Unklarer Wortlaut bleibt unmarkiert.`)}</p>}
   {missingCount>0&&<p className="doc-reading-note">{t(`${missingCount} ${missingCount===1?'sentence has':'sentences have'} no complete correction saved yet. These sentences are not marked as correct.`,missingCorrectionNote(missingCount))}</p>}
   {cards?<SentenceCards rows={review.rows} language={language} formatNote={formatNote}/>:<div className="sentence-table-scroll" tabIndex={0} role="region" aria-label={t('Sentence comparison table','Tabelle der Satzkorrekturen')}><table className="sentence-feedback-table"><thead><tr><th scope="col">{t('Original · red','Original · rot')}</th><th scope="col">{t('Corrected · green','Korrigiert · grün')}</th><th scope="col">{t('Another way · blue','Andere Formulierung · blau')}</th><th scope="col">{t('Checks & explanation','Prüfpunkte & Erklärung')}</th></tr></thead><tbody>{review.rows.map((row,index)=>{
     if(row.status==='source-note')return <tr key={index}><td colSpan={4}>{row.original}</td></tr>;
     if(row.status==='unchanged'&&!row.readingUncertain)return <tr key={index}><td colSpan={4}><details className="writing-checked"><summary><strong>{t('Sentence','Satz')} {row.number}</strong> · ✓ {t('No language change suggested','Keine sprachliche Änderung vorgeschlagen')}{row.checks?t(' · open review notes',' · Erklärungen öffnen'):''}</summary><p className="doc-preserve">{row.original}</p>{row.improved&&<p className="sentence-blue">{t('Optional wording:','Optionale Formulierung:')} {row.improved}</p>}<SentenceNotes row={row} language={language} formatNote={formatNote}/></details></td></tr>;
     return <tr key={index} aria-label={`${t('Sentence','Satz')} ${row.number}`}><td><strong className="writing-sentence-number">{t('Sentence','Satz')} {row.number}</strong>{row.readingUncertain&&<p className="doc-muted">{t('Reading needs confirmation.','Lesart muss bestätigt werden.')}</p>}<SentenceText row={row} version="original" language={language}/></td><td><SentenceText row={row} version="corrected" language={language}/></td><td><SentenceText row={row} version="improved" language={language}/></td><td><SentenceNotes row={row} language={language} formatNote={formatNote}/></td></tr>;
   })}</tbody></table></div>}
 </section><WritingVersions writing={writing} language={language} formatNote={formatNote}/></>;
}
function missingCorrectionNote(count:number){return `Für ${count} ${count===1?'Satz ist':'Sätze ist'} noch keine vollständige Korrektur gespeichert. Diese Sätze werden nicht als richtig markiert.`;}
