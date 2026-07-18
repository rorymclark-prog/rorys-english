"use client";

import { useEffect, useRef, useState } from "react";
import { fetchAi, remoteEnabled } from "@/lib/remote";

const WRITING_MAX = 4000; // POST body now — full short essays fit
const TUTOR_MAX = 1000;
const CONTEXT_BUDGET = 1200; // chars of prior conversation sent for continuity

type Mode = "tutor" | "word" | "writing";
interface ChatMsg {
  role: "you" | "tutor";
  text: string;
}

export default function AiCoachView({ code }: { code: string }) {
  const [mode, setMode] = useState<Mode>("tutor");
  const [input, setInput] = useState("");
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Tutor chat survives reloads on this device (it's their notebook, not synced).
  const chatKey = `re_tutor_chat_${code}`;
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(chatKey);
      if (saved) setChat(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }, [chatKey]);
  useEffect(() => {
    try {
      window.localStorage.setItem(chatKey, JSON.stringify(chat.slice(-30)));
    } catch {
      /* ignore */
    }
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    chatEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
  }, [chat, chatKey]);

  const placeholder =
    mode === "word"
      ? "Type a word or phrase… e.g. “make a living”"
      : mode === "writing"
        ? "Write a few sentences in English — anything you like. The coach will help, not grade."
        : "Ask anything about English… e.g. “when do I use since vs for?”";

  // Build a compact context block from the last few turns, within budget.
  const buildTutorPayload = (question: string): string => {
    const lines: string[] = [];
    let used = 0;
    for (let i = chat.length - 1; i >= 0 && lines.length < 6; i--) {
      const m = chat[i];
      const line = `${m.role === "you" ? "Student" : "Tutor"}: ${m.text.slice(0, 220)}`;
      if (used + line.length > CONTEXT_BUDGET) break;
      lines.unshift(line);
      used += line.length;
    }
    const ctx = lines.length ? `Previous conversation:\n${lines.join("\n")}\n\n` : "";
    return `${ctx}Student asks: ${question}`;
  };

  const ask = async () => {
    const q = input.trim();
    if (!q || status === "loading") return;
    if (!remoteEnabled()) {
      setErrMsg("The tutor isn't switched on yet.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setErrMsg("");
    if (mode === "tutor") {
      setChat((c) => [...c, { role: "you", text: q }]);
      setInput("");
    } else {
      setAnswer("");
    }
    try {
      const payload = mode === "tutor" ? buildTutorPayload(q) : q;
      const res = await fetchAi(code, mode, payload);
      if (res.ok && res.text) {
        if (mode === "tutor") {
          setChat((c) => [...c, { role: "tutor", text: res.text as string }]);
        } else {
          setAnswer(res.text);
        }
        setStatus("idle");
      } else {
        setErrMsg(res.error || "Couldn't get an answer — try again.");
        setStatus("error");
      }
    } catch {
      setErrMsg("Couldn't reach the tutor — check your connection and try again.");
      setStatus("error");
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setInput("");
    setAnswer("");
    setStatus("idle");
    setErrMsg("");
  };

  const clearChat = () => {
    setChat([]);
    try {
      window.localStorage.removeItem(chatKey);
    } catch {
      /* ignore */
    }
  };

  return (
    <main className="px-5 pb-10">
      <header className="mb-3 pt-4">
        <h1 className="display text-2xl text-navy dark:text-cream">English tutor</h1>
        <p className="mt-0.5 text-sm text-navy-soft dark:text-navy-mist">
          Ask questions, look up words, or get feedback on your writing. Just for practice — never graded.
        </p>
        <p className="mt-1 text-xs text-navy-soft dark:text-navy-mist">
          Keep it about English — please don&apos;t share personal or private information here.
        </p>
      </header>

      {/* Mode toggle */}
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["tutor", "💬 Ask"],
            ["word", "🔍 Words"],
            ["writing", "✍️ Writing"],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            aria-pressed={mode === m}
            className={`min-h-[48px] rounded-xl px-2 text-sm font-bold transition active:scale-[.97] ${
              mode === m
                ? "bg-amber-soft text-amber-deep dark:bg-amber-dusk dark:text-amber"
                : "bg-surface text-navy-soft shadow-card dark:bg-navy-raised dark:text-navy-mist dark:shadow-card-dark"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tutor chat history */}
      {mode === "tutor" && chat.length > 0 && (
        <div
          role="log"
          aria-label="Tutor conversation"
          className="glass mt-4 space-y-2 rounded-card p-3 shadow-card dark:shadow-card-dark"
        >
          {chat.map((m, i) => (
            <div key={i} className={`flex ${m.role === "you" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-card px-4 py-2.5 text-[0.95rem] leading-relaxed ${
                  m.role === "you"
                    ? "rounded-br-lg bg-surface text-navy shadow-card dark:bg-navy-raised dark:text-cream dark:shadow-card-dark"
                    : "rounded-bl-lg bg-[linear-gradient(135deg,#4F46E5,#4338CA)] text-white shadow-glow dark:shadow-glow-dark"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {status === "loading" && (
            <div role="status" className="flex justify-start">
              <div className="rounded-card rounded-bl-lg bg-surface px-4 py-2.5 text-sm text-navy-soft shadow-card dark:bg-navy-raised dark:text-navy-mist dark:shadow-card-dark">
                <span className="ai-shimmer">Thinking…</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
          <button
            onClick={clearChat}
            className="mx-auto flex min-h-[44px] items-center justify-center px-4 text-xs font-semibold text-navy-soft underline transition active:scale-[.97] dark:text-navy-mist"
          >
            Clear conversation
          </button>
        </div>
      )}

      {/* Input */}
      <div className="mt-4">
        {mode === "writing" ? (
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, WRITING_MAX))}
            placeholder={placeholder}
            rows={6}
            className="w-full rounded-xl border border-black/[.06] bg-surface p-3 text-base leading-relaxed text-navy shadow-card outline-none transition focus:border-amber-deep dark:border-white/10 dark:bg-navy-raised dark:text-cream dark:shadow-card-dark dark:focus:border-amber"
          />
        ) : (
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, mode === "tutor" ? TUTOR_MAX : 200))}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder={placeholder}
            className="w-full rounded-xl border border-black/[.06] bg-surface p-3 text-base text-navy shadow-card outline-none transition focus:border-amber-deep dark:border-white/10 dark:bg-navy-raised dark:text-cream dark:shadow-card-dark dark:focus:border-amber"
          />
        )}
        {mode === "writing" && (
          <p className="tnum mt-1 text-right text-xs text-navy-soft dark:text-navy-mist">
            {input.length}/{WRITING_MAX}
          </p>
        )}
      </div>

      <button
        onClick={ask}
        disabled={status === "loading" || !input.trim()}
        className={`mt-2 min-h-[52px] w-full rounded-xl bg-[linear-gradient(135deg,#4F46E5,#4338CA)] px-4 text-base font-bold text-white shadow-[0_1px_2px_rgba(0,0,0,.06),0_4px_12px_-4px_#4F46E5] transition active:scale-[.97] dark:bg-none dark:bg-amber dark:text-navy dark:shadow-none ${
          status === "loading" ? "" : "disabled:opacity-50"
        }`}
      >
        {status === "loading"
          ? "Thinking…"
          : mode === "tutor"
            ? "Ask the tutor"
            : mode === "word"
              ? "Look up"
              : "Get feedback"}
      </button>

      {status === "error" && (
        <p
          role="status"
          className="mt-4 animate-sheet rounded-card bg-bad-soft p-4 text-center text-sm font-medium text-bad dark:bg-bad-dusk dark:text-bad-bright"
        >
          {errMsg}
        </p>
      )}

      {mode !== "tutor" && answer && (
        <section
          role="status"
          className="glass mt-4 animate-sheet rounded-card p-5 shadow-card dark:shadow-card-dark"
        >
          <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed text-navy dark:text-cream">
            {answer}
          </p>
        </section>
      )}
    </main>
  );
}
