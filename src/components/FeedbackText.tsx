import { Fragment } from "react";

const operativeWords = /\b(next step|try again|first|then|finally|usually|right now|because|try|check|remember)\b/gi;
const isOperativeWord = /^(next step|try again|first|then|finally|usually|right now|because|try|check|remember)$/i;

/** Small, consistent emphasis for instructions and teacher feedback. */
export default function FeedbackText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return <span className="feedback-text">{parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <mark key={i}>{part.slice(2, -2)}</mark>;
    return <Fragment key={i}>{part.split(operativeWords).map((word, j) =>
      isOperativeWord.test(word) ? <mark key={j}>{word}</mark> : <Fragment key={j}>{word}</Fragment>
    )}</Fragment>;
  })}</span>;
}
