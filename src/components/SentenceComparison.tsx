"use client";
import {useEffect,useState} from 'react';
import {sentenceReview,type SentenceRow,type WritingSource} from '@/lib/writing-review';
import {changed,Highlight} from './WritingHighlights';
import WritingVersions from './WritingVersions';

const checks={spelling:'Spelling',grammar:'Grammar',wordChoice:'Word choice',punctuation:'Punctuation',flow:'Linking / flow',taskFit:'Fit to the task'};
function SentenceNotes({row}:{row:SentenceRow}){
 return <><p>{row.note}</p>{row.checks&&<dl className="writing-checks">{Object.entries(checks).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{row.checks![key as keyof typeof row.checks]==='ok'?'No issue found.':row.checks![key as keyof typeof row.checks]}</dd></div>)}</dl>}</>;
}
function SentenceText({row,version}:{row:SentenceRow;version:'original'|'corrected'|'improved'}){
 if(version==='original')return row.readingUncertain?<span className="doc-preserve">{row.original}</span>:<Highlight text={row.original} mask={changed(row.original,row.corrected||row.original).old} mark="sentence-red"/>;
 if(version==='corrected')return row.corrected?(row.readingUncertain?<span className="doc-preserve">{row.corrected}</span>:<Highlight text={row.corrected} mask={changed(row.original,row.corrected).new} mark="sentence-green"/>):row.readingUncertain?'Reading needs confirmation.':'No complete correction saved.';
 return row.improved?<Highlight text={row.improved} mask={changed(row.corrected,row.improved).new} mark="sentence-blue"/>:'No optional wording saved.';
}

/** One reading representation is mounted at a time, keeping every sentence and check. */
export function SentenceCards({rows}:{rows:SentenceRow[]}){
 return <ol className="sentence-reading-cards" aria-label="Sentence cards">{rows.map((row,index)=>row.status==='source-note'?<li key={index} className="sentence-source-note"><p>{row.original}</p><p className="doc-muted">{row.note}</p></li>:<li key={index} className="sentence-reading-card">
   <header><h4>Sentence {row.number}</h4><p>{row.readingUncertain?'Reading needs confirmation':row.status==='pending'?'Correction not complete':row.status==='unchanged'?'No language change suggested':'Language change suggested'}</p></header>
   <section><h5>Original · red</h5><p><SentenceText row={row} version="original"/></p></section>
   <section><h5>Corrected · green</h5>{row.readingUncertain&&row.corrected&&<p className="doc-muted">Saved wording; the reading is still unconfirmed.</p>}<p><SentenceText row={row} version="corrected"/></p></section>
   <section><h5>Another way · blue · optional</h5><p><SentenceText row={row} version="improved"/></p></section>
   <section className="sentence-card-checks"><h5>Checks & explanation</h5><SentenceNotes row={row}/></section>
 </li>)}</ol>;
}

export default function SentenceComparison({writing}:{writing:WritingSource}){
 const [phone,setPhone]=useState(false),[readingMode,setReadingMode]=useState<'cards'|'table'>('cards');
 useEffect(()=>{const media=window.matchMedia('(max-width: 640px)'),update=()=>setPhone(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 const review=sentenceReview(writing),readingCount=review.rows.filter(row=>row.readingUncertain).length,missingCount=review.rows.filter(row=>row.status==='pending'&&!row.readingUncertain).length,cards=phone&&readingMode==='cards';
 return <><section className="sentence-review refined-sentence-review" aria-label="Sentence by sentence"><h3>Sentence by sentence</h3><p className="doc-muted">Every sentence stays in order. {cards?'Read each sentence and its saved checks below.':'Open a sentence with no changes for its review notes.'} The full paragraph versions follow {cards?'the cards':'the table'}.</p>
   {phone&&<div className="sentence-reading-controls" role="group" aria-label="Sentence reading layout"><button type="button" aria-pressed={readingMode==='cards'} onClick={()=>setReadingMode('cards')}>Sentence cards</button><button type="button" aria-pressed={readingMode==='table'} onClick={()=>setReadingMode('table')}>Full table</button></div>}
   {readingCount>0&&<p className="doc-reading-note">{readingCount} {readingCount===1?'sentence needs':'sentences need'} reading confirmation. Unclear wording stays unmarked.</p>}
   {missingCount>0&&<p className="doc-reading-note">{missingCount} {missingCount===1?'sentence has':'sentences have'} no complete correction saved yet. These sentences are not marked as correct.</p>}
   {cards?<SentenceCards rows={review.rows}/>:<div className="sentence-table-scroll" tabIndex={0} role="region" aria-label="Sentence comparison table"><table className="sentence-feedback-table"><thead><tr><th scope="col">Original · red</th><th scope="col">Corrected · green</th><th scope="col">Another way · blue</th><th scope="col">Checks & explanation</th></tr></thead><tbody>{review.rows.map((row,index)=>{
     if(row.status==='source-note')return <tr key={index}><td colSpan={4}>{row.original}</td></tr>;
     if(row.status==='unchanged'&&!row.readingUncertain)return <tr key={index}><td colSpan={4}><details className="writing-checked"><summary><strong>Sentence {row.number}</strong> · ✓ No language change suggested{row.checks?' · open review notes':''}</summary><p className="doc-preserve">{row.original}</p>{row.improved&&<p className="sentence-blue">Optional wording: {row.improved}</p>}<SentenceNotes row={row}/></details></td></tr>;
     return <tr key={index} aria-label={`Sentence ${row.number}`}><td><strong className="writing-sentence-number">Sentence {row.number}</strong>{row.readingUncertain&&<p className="doc-muted">Reading needs confirmation.</p>}<SentenceText row={row} version="original"/></td><td><SentenceText row={row} version="corrected"/></td><td><SentenceText row={row} version="improved"/></td><td><SentenceNotes row={row}/></td></tr>;
   })}</tbody></table></div>}
 </section><WritingVersions writing={writing}/></>;
}
