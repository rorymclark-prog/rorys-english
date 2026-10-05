import {sentenceReview,type WritingSource} from '@/lib/writing-review';
import {changed,Highlight} from './views/WritingAnalysis';
export default function SentenceComparison({writing}:{writing:WritingSource}){
  const review=sentenceReview(writing);
  return <section className="sentence-review" aria-label="Sentence by sentence"><h3>Sentence by sentence</h3><p className="doc-muted">Every sentence in order. Red highlights original wording to revisit, green a correction, and blue an optional improvement. Correct sentences stay visible.</p>
    {review.pending>0&&<p className="doc-reading-note">{review.pending} sentences need confirmation. They have not been marked as correct.</p>}
    {review.rows.map((row,i)=>{const first=changed(row.original,row.corrected||row.original),second=changed(row.corrected,row.improved||row.corrected);return row.status==='source-note'?<aside key={i} className="doc-reading-note">{row.original}<p>{row.note}</p></aside>:<article key={i} aria-label={`Sentence ${row.number}`}><header><strong>Sentence {row.number}</strong><span>{row.status==='unchanged'?'Already correct · keep it':row.status==='pending'?'Needs review':'Correction shown'}</span></header><div className="sentence-columns">
      <section className="sentence-original"><h4>Your sentence</h4><p><Highlight text={row.original} mask={first.old} mark="sentence-red"/></p></section>
      <section className="sentence-corrected"><h4>Correction</h4><p>{row.corrected?<Highlight text={row.corrected} mask={first.new} mark="sentence-green"/>:'Reading needs confirmation.'}</p></section>
      <section className="sentence-improved"><h4>Another way to say it · optional</h4><p>{row.improved?<Highlight text={row.improved} mask={second.new} mark="sentence-blue"/>:'No optional change needed.'}</p></section>
      <section className="sentence-comment"><h4>Why</h4><p>{row.note}</p></section>
    </div></article>;})}
  </section>;
}
