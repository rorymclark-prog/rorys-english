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
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
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
        <h1 className="text-2xl font-extrabold text-navy dark:text-cream">English tutor</h1>
        <p className="mt-0.5 text-sm text-burgundy dark:text-amber/80">
          Ask questions, look up words, or get feedback on your writing. Just for practice — never graded.
        </p>
        <p className="mt-1 text-xs text-navy-soft dark:text-cream/50">
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
            className={`min-h-[48px] rounded-xl px-2 text-sm font-bold transition-colors active:scale-[.98] ${
              mode === m
                ? "bg-amber text-navy"
                : "bg-white text-navy-soft shadow-card dark:bg-white/5 dark:text-cream/70"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tutor chat history */}
      {mode === "tutor" && chat.length > 0 && (
        <div className="mt-4 space-y-2">
          {chat.map((m, i) => (
            <div key={i} className={`flex ${m.role === "you" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[0.95rem] leading-relaxed ${
                  m.role === "you"
                    ? "rounded-br-md bg-navy text-cream dark:bg-amber dark:text-navy"
                    : "rounded-bl-md bg-white text-navy shadow-card dark:bg-white/10 dark:text-cream"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {status === "loading" && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-sm text-navy-soft shadow-card dark:bg-white/10 dark:text-cream/60">
                Thinking…
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
          <button
            onClick={clearChat}
            className="mx-auto block pt-1 text-xs font-semibold text-navy-soft underline dark:text-cream/50"
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
            className="w-full rounded-xl border border-navy/15 bg-white p-3 text-base leading-relaxed text-navy outline-none focus:border-amber dark:border-white/15 dark:bg-white/5 dark:text-cream"
          />
        ) : (
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, mode === "tutor" ? TUTOR_MAX : 200))}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder={placeholder}
            className="w-full rounded-xl border border-navy/15 bg-white p-3 text-base text-navy outline-none focus:border-amber dark:border-white/15 dark:bg-white/5 dark:text-cream"
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
        {status === "loading"
          ? "Thinking…"
          : mode === "tutor"
            ? "Ask the tutor"
            : mode === "word"
              ? "Look up"
              : "Get feedback"}
      </button>

      {status === "error" && (
        <p className="mt-4 rounded-card bg-burgundy/10 p-4 text-center text-sm font-medium text-burgundy dark:text-amber/80">
          {errMsg}
        </p>
      )}

      {mode !== "tutor" && answer && (
        <section className="mt-4 rounded-card bg-white p-5 shadow-card dark:bg-white/5">
          <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed text-navy dark:text-cream">
            {answer}
          </p>
        </section>
      )}
    </main>
  );
}
