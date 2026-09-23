"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import FeedbackText from "@/components/FeedbackText";
import { fetchSubmissions, type Assignment, type Submission } from "@/lib/remote";
import { getLearning, type LearningRecord } from "@/lib/learning";

const unitId = "english-in-context5-unit01-2026";
const weeks = [
  {
    number: 1,
    when: "WEEK OF 23 SEPTEMBER",
    title: "A short story",
    time: "About 30 minutes total",
    instruction: <>Tell a <mark>holiday</mark> or <mark>climbing day</mark> story where a small plan changed. Then write your best version.</>,
    examples: [
      <><mark>First</mark>, we planned to meet at the station.</>,
      <><mark>Then</mark>, my brother went to the wrong platform.</>,
      <><mark>Finally</mark>, we found him <mark>because</mark> we called.</>,
    ],
    starter: "First, … / Then, … / Finally, …",
    writing: "Write 5–7 sentences",
  },
  {
    number: 2,
    when: "WEEK OF 30 SEPTEMBER",
    title: "Family: usual and now",
    time: "About 35–40 minutes total",
    instruction: <>Compare what your family <mark>usually</mark> does with what they are doing <mark>now</mark>. Use your ideas in a short email.</>,
    examples: [
      <>We <mark>usually</mark> eat dinner at home.</>,
      <>Today, we <mark>are eating</mark> at my grandparents&apos; house.</>,
      <>My brother <mark>usually plays</mark> football, but <mark>now he is reading</mark>.</>,
    ],
    starter: "We usually … / Today, we are …",
    writing: "Write a short email",
  },
] as const;

export default function SpeakingHomeworkCard({ code, assignment }: { code: string; assignment: Assignment }) {
  const [records, setRecords] = useState<LearningRecord[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  useEffect(() => {
    let live = true;
    void Promise.all([getLearning(code), fetchSubmissions(code)]).then(([learning, sent]) => {
      if (!live) return;
      if (learning.ok) setRecords(learning.records || []);
      if (sent.ok) setSubmissions(sent.submissions || []);
    });
    return () => { live = false; };
  }, [code]);
  return <section className="hw-speaking" aria-labelledby={`speaking-${assignment.id}`}>
    <div className="hw-heading"><div><p className="hw-kicker">FAMILY LIFE · TWO TEACHING WEEKS</p><h2 id={`speaking-${assignment.id}`}>Speaking and writing, one step at a time</h2><p><strong>One chat and one short written answer each week.</strong> The chat replaces the speaking rehearsal in the linked task.</p></div><span className="hw-time">30–40 min / week</span></div>
    <p className="hw-gentle-note">Choose your own ideas. These are examples to help you start, not sentences to memorise. <strong>Stop at 45 minutes for the week.</strong></p>
    <div className="hw-chat-grid">{weeks.map(week => {
      const saved = records.some(r => r.kind === "speaking" && r.title.startsWith(`Family life · Chat ${week.number}`));
      const sent = submissions.filter(s => s.unit === unitId && s.task === `hw:${week.number}`);
      const latest = sent.at(-1);
      return <article className="hw-chat" key={week.number}>
        <p className="hw-kicker">{week.when}</p>
        <div className="hw-chat-top"><span className="hw-number">{week.number}</span><div><h3>{week.title}</h3><small>{week.time}</small></div></div>
        <p className="hw-instruction">{week.instruction}</p>
        <div className="hw-examples"><strong>Ideas to get started</strong><ul>{week.examples.map((sentence, i) => <li key={i}>{sentence}</li>)}</ul></div>
        <p className="hw-starter"><strong>Useful starters</strong><span>{week.starter}</span></p>
        <div className="hw-steps"><span>1 · Speak</span><span>2 · {week.writing}</span></div>
        <Link className="hw-start" href={`/s/${code}/speak/?guided=ferdi-chat-${week.number}`}>{saved ? "Chat saved · practise again" : `Open chat ${week.number}`} <span aria-hidden>→</span></Link>
        <Link className="hw-writing-link" href={`/s/${code}/lessons/${unitId}/homework/${week.number}/`}>{latest ? "View writing and feedback" : week.writing} <span aria-hidden>→</span></Link>
        {(saved || latest) && <div className="hw-sent"><strong>{saved ? "Speaking saved" : "Speaking not yet saved"}{latest ? " · Writing sent" : ""}</strong>{latest?.feedback && <p><FeedbackText text={latest.feedback}/></p>}</div>}
      </article>;
    })}</div>
    <p className="hw-how"><strong>Easy finish:</strong> end the voice chat and let the app save it. Write in the linked answer box. <mark>No transcript to copy or paste.</mark></p>
    <p className="hw-footnote">If live voice is unavailable, finish the short writing task and tell Rory at your next lesson. There is no holiday catch-up task or fixed deadline.</p>
  </section>;
}
