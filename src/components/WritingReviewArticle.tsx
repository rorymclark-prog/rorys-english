import type {LearningRecord} from '@/lib/learning';
import SentenceComparison from './SentenceComparison';
export default function WritingReviewArticle({record}:{record:LearningRecord}){
  const w=record.body.writing;if(!w)return null;
  return <article className="writing-review-article" aria-label="Writing review in the app"><header><p className="doc-eyebrow">SAVED WRITING REVIEW</p><h3>{record.title}</h3><p>{record.body.summary}</p></header>
    {!!record.body.strengths?.length&&<section className="doc-strengths"><h3>What already works</h3><ul>{record.body.strengths.map((s,i)=><li key={i}>{s}</li>)}</ul></section>}
    <SentenceComparison writing={w}/>
    {!!w.practice?.length&&<section className="doc-retry"><div><h3>Your next practice</h3><ol>{w.practice.map((s,i)=><li key={i}>{s}</li>)}</ol></div></section>}
    {!!record.body.nextStep&&<p className="doc-preserve">{record.body.nextStep}</p>}
  </article>;
}
