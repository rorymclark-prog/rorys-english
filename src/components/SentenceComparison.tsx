import {sentenceReview,type WritingSource} from '@/lib/writing-review';
import {changed,Highlight} from './WritingHighlights';
import WritingVersions from './WritingVersions';
const checks={spelling:'Spelling',grammar:'Grammar',wordChoice:'Word choice',punctuation:'Punctuation',flow:'Linking / flow',taskFit:'Fit to the task'};
export default function SentenceComparison({writing}:{writing:WritingSource}){
 const review=sentenceReview(writing);
 return <><section className="sentence-review" aria-label="Sentence by sentence"><h3>Sentence by sentence</h3><p className="doc-muted">Every sentence stays in order. Open a checked sentence for its detail. The full paragraph versions follow the table.</p>{review.pending>0&&<p className="doc-reading-note">{review.pending} {review.pending===1?'sentence needs':'sentences need'} reading confirmation. They stay unmarked.</p>}<div className="sentence-table-scroll"><table className="sentence-feedback-table"><thead><tr><th>Original · red</th><th>Corrected · green</th><th>Another way · blue</th><th>Checks & explanation</th></tr></thead><tbody>{review.rows.map((r,i)=>{
 if(r.status==='source-note')return <tr key={i}><td colSpan={4}>{r.original}</td></tr>;
 const first=changed(r.original,r.corrected||r.original),second=changed(r.corrected,r.improved||r.corrected),detail=<><p>{r.note}</p>{r.checks&&<dl className="writing-checks">{Object.entries(checks).map(([k,label])=><div key={k}><dt>{label}</dt><dd>{r.checks![k as keyof typeof r.checks]}</dd></div>)}</dl>}</>;
 if(r.status==='unchanged')return <tr key={i}><td colSpan={4}><details className="writing-checked"><summary><strong>Sentence {r.number}</strong> · {r.checks?'✓ Checked: spelling, grammar, word choice, punctuation, flow and task fit':'✓ No change suggested'}</summary><p className="doc-preserve">{r.original}</p>{r.improved&&<p className="sentence-blue">Optional wording: {r.improved}</p>}{detail}</details></td></tr>;
 return <tr key={i} aria-label={`Sentence ${r.number}`}><td><strong className="writing-sentence-number">Sentence {r.number}</strong><Highlight text={r.original} mask={first.old} mark="sentence-red"/></td><td>{r.corrected?<Highlight text={r.corrected} mask={first.new} mark="sentence-green"/>:'Reading needs confirmation.'}</td><td>{r.improved?<Highlight text={r.improved} mask={second.new} mark="sentence-blue"/>:'—'}</td><td>{detail}</td></tr>;
 })}</tbody></table></div></section><WritingVersions writing={writing}/></>;
}
