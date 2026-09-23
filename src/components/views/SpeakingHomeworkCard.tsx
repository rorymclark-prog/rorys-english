"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import FeedbackText from "@/components/FeedbackText";
import { fetchSubmissions, type Assignment, type Submission } from "@/lib/remote";

const chats = [
  {
    number: 1,
    title: "Tell a short story",
    time: "About 12–15 minutes",
    instruction: <>Talk about a <mark>holiday</mark> or <mark>climbing day</mark>. Say what happened in order.</>,
    examples: [
      <> <mark>First</mark>, we packed our bags and left early.</>,
      <> <mark>Then</mark>, we climbed the hill together.</>,
      <> <mark>Finally</mark>, we ate lunch and went home.</>,
    ],
    starter: "First, ... / Then, ... / Finally, ...",
  },
  {
    number: 2,
    title: "Family: usual and now",
    time: "About 12–15 minutes",
    instruction: <>Compare what your family <mark>usually</mark> does with what they are doing <mark>now</mark>.</>,
    examples: [
      <>We <mark>usually</mark> eat dinner at home.</>,
      <>Today, we <mark>are eating</mark> at my grandparents&apos; house.</>,
      <>My brother <mark>usually plays</mark> football, but <mark>now he is reading</mark>.</>,
    ],
    starter: "We usually ... / Today, we are ...",
  },
] as const;

export default function SpeakingHomeworkCard({ code, assignment }: { code: string; assignment: Assignment }) {
  const [history, setHistory] = useState<Submission[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    fetchSubmissions(code).then(r => {
      if (!live) return;
      if (r.ok) setHistory((r.submissions || []).filter(s => s.unit === "assigned" && s.task === assignment.id));
      else setError(r.error || "Could not load your sent conversations.");
    });
    return () => { live = false; };
  }, [code, assignment.id]);
  return <section className="hw-speaking" aria-labelledby={`speaking-${assignment.id}`}>
    <div className="hw-heading"><div><p className="hw-kicker">THIS WEEK · SPEAKING</p><h2 id={`speaking-${assignment.id}`}>{assignment.title}</h2><p>Two short chats on different days. <strong>About 30–35 minutes in total</strong>, including sending them.</p></div><span className="hw-time">2 × 15 min</span></div>
    <p className="hw-gentle-note">Choose your own ideas. The examples help you start; you do not need to memorise them. Stop if you reach 45 minutes this week.</p>
    <div className="hw-chat-grid">{chats.map(chat => {
      const sent = history.filter(s => s.answers.chat === String(chat.number));
      const latest = sent.at(-1);
      return <article className="hw-chat" key={chat.number}>
        <div className="hw-chat-top"><span className="hw-number">{chat.number}</span><div><h3>Chat {chat.number}: {chat.title}</h3><small>{chat.time}</small></div></div>
        <p className="hw-instruction">{chat.instruction}</p>
        <div className="hw-examples"><strong>Ideas to get started</strong><ul>{chat.examples.map((sentence, i) => <li key={i}>{sentence}</li>)}</ul></div>
        <p className="hw-starter"><strong>Useful starters</strong><span>{chat.starter}</span></p>
        <Link className="hw-start" href={`/s/${code}/speak/?homework=${encodeURIComponent(assignment.id)}&chat=${chat.number}`}>
          {latest ? `Practise chat ${chat.number} again` : `Start chat ${chat.number}`} <span aria-hidden>→</span>
        </Link>
        {latest && <div className="hw-sent"><strong>{latest.status === "reviewed" ? "Feedback from Rory" : latest.status === "revision-needed" ? "Rory has a next step for you" : "Sent to Rory"}</strong>
          {latest.feedback && <p><FeedbackText text={latest.feedback}/></p>}
          <small>{sent.length} conversation{sent.length === 1 ? "" : "s"} sent</small>
        </div>}
      </article>;
    })}</div>
    <p className="hw-how"><strong>When you finish a chat:</strong> tap <mark>Send to Rory</mark> in the Speaking Studio. The app adds the conversation captions for you. No copying, pasting or extra writing.</p>
    <p className="hw-footnote">If live voice is unavailable, leave it for another day and tell Rory in your next lesson. There is no fixed deadline or holiday catch-up task.</p>
    {error && <p role="alert" className="hw-footnote">{error}</p>}
  </section>;
}
