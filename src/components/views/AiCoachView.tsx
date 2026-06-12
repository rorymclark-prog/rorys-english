"use client";

import { useState } from "react";
import { fetchAi, remoteEnabled } from "@/lib/remote";

const WRITING_MAX = 1500;

export default function AiCoachView({ code }: { code: string }) {
  const [mode, setMode] = useState<"word" | "writing">("word");
  const [input, setInput] = useState("");
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  const placeholder =
    mode === "word"
      ? "Type a word or phrase… e.g. “make a living”"
      : "Write a few sentences in English — anything you like. The coach will help, not grade.";

  const ask = async () => {
    const q = input.trim();
    if (!q || !remoteEnabled()) return;
    setStatus("loading");
    setAnswer("");
    setErrMsg("");
    try {
      const res = await fetchAi(code, mode, q);
      if (res.ok && res.text) {
        setAnswer(res.text);
        setStatus("idle");
      } else {
        setErrMsg(res.error || "Couldn't get an answer — try again.");
        setStatus("error");
      }
    } catch {
      setErrMsg("Couldn't reach the helper — check your connection and try again.");
      setStatus("error");
    }
  };

  const switchMode = (m: "word" | "writing") => {
    setMode(m);
    setInput("");
    setAnswer("");
    setStatus("idle");
    setErrMsg("");
  };

  return (
    <main className="px-5 pb-10">
      <header className="mb-3 pt-4">
        <h1 className="text-2xl font-extrabold text-navy dark:text-cream">Helper</h1>
        <p className="mt-0.5 text-sm text-burgundy dark:text-amber/80">
          Ask about a word, or write something and get friendly feedback. Just for practice — never graded.
        </p>
      </header>

      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-2">
        {(["word", "writing"] as const).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            aria-pressed={mode === m}
            className={`min-h-[48px] rounded-xl px-3 text-sm font-bold transition-colors active:scale-[.98] ${
              mode === m
                ? "bg-amber text-navy"
                : "bg-white text-navy-soft shadow-card dark:bg-white/5 dark:text-cream/70"
            }`}
          >
            {m === "word" ? "🔍 Word help" : "✍️ Writing coach"}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="mt-4">
        {mode === "word" ? (
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder={placeholder}
            className="w-full rounded-xl border border-navy/15 bg-white p-3 text-base text-navy outline-none focus:border-amber dark:border-white/15 dark:bg-white/5 dark:text-cream"
          />
        ) : (
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, WRITING_MAX))}
            placeholder={placeholder}
            rows={6}
            className="w-full rounded-xl border border-navy/15 bg-white p-3 text-base leading-relaxed text-navy outline-none focus:border-amber dark:border-white/15 dark:bg-white/5 dark:text-cream"
          />
        )}
        {mode === "writing" && (
          <p className="mt-1 text-right text-xs text-navy-soft dark:text-cream/50">
            {input.length}/{WRITING_MAX}
          </p>
        )}
      </div>

      <button
        onClick={ask}
        disabled={status === "loading" || !input.trim()}
        className="mt-2 min-h-[52px] w-full rounded-xl bg-navy px-4 text-base font-bold text-cream active:scale-[.99] disabled:opacity-50 dark:bg-amber dark:text-navy"
      >
        {status === "loading" ? "Thinking…" : mode === "word" ? "Ask" : "Get feedback"}
      </button>

      {status === "error" && (
        <p className="mt-4 rounded-card bg-burgundy/10 p-4 text-center text-sm font-medium text-burgundy dark:text-amber/80">
          {errMsg}
        </p>
      )}

      {answer && (
        <section className="mt-4 rounded-card bg-white p-5 shadow-card dark:bg-white/5">
          <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed text-navy dark:text-cream">
            {answer}
          </p>
        </section>
      )}
    </main>
  );
}
