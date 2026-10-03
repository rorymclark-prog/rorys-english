import type {LearningRecord} from '@/lib/learning';
import SentenceComparison from './SentenceComparison';
export default function WritingReviewArticle({record}:{record:LearningRecord}){
  const w=record.body.writing;if(!w)return null;
  return <article className="writing-review-article" aria-label="Writing review in the app"><header><p className="doc-eyebrow">SAVED WRITING REVIEW</p><h3>{record.title}</h3><p>{record.body.summary}</p></header>
    {!!record.body.strengths?.length&&<section className="doc-strengths"><h3>What already works</h3><ul>{record.body.strengths.map((s,i)=><li key={i}>{s}</li>)}</ul></section>}
    <SentenceComparison writing={w}/>
    <details className="doc-transcript"><summary>Original writing</summary><p>{w.original}</p></details>
    {!!w.corrected&&<details className="doc-transcript"><summary>Corrected version <span>Your ideas with the necessary changes</span></summary><p>{w.corrected}</p></details>}
    {!!w.model&&<details className="doc-transcript"><summary>More developed example <span>An optional model, separate from your writing</span></summary><p>{w.model}</p></details>}
    {!!w.practice?.length&&<section className="doc-retry"><div><h3>Your next practice</h3><ol>{w.practice.map((s,i)=><li key={i}>{s}</li>)}</ol></div></section>}
    {!!record.body.nextStep&&<p className="doc-preserve">{record.body.nextStep}</p>}
  </article>;
}
