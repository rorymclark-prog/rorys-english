"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CoachFeedback } from "@/lib/live-coach";
import { companionIsVisible, openCoachCompanion, supportsFloatingCoach, type CoachCompanionTarget, type CompanionHost } from "@/lib/coach-companion";

export function useCoachCompanion() {
  const [target, setTarget] = useState<CoachCompanionTarget | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const [floatingSupported, setFloatingSupported] = useState(false);
  const [visibilityRevision, setVisibilityRevision] = useState(0);
  const current = useRef<CoachCompanionTarget | null>(null);
  const pending = useRef(false);
  const requestRevision = useRef(0);
  const mounted = useRef(true);
  const cleanup = useRef<() => void>(() => {});

  const close = useCallback(() => {
    requestRevision.current++; pending.current = false;
    const previous = current.current;
    current.current = null;
    cleanup.current(); cleanup.current = () => {};
    previous?.window.close();
    if (mounted.current) { setTarget(null); setOpening(false); setVisibilityRevision(value => value + 1); }
  }, []);

  const activeWhileHidden = useCallback(() => {
    if (companionIsVisible(current.current)) return true;
    // A PiP enter event can precede the requestWindow promise settling.
    const pipWindow = (window as CompanionHost).documentPictureInPicture?.window;
    return pending.current && !!pipWindow && companionIsVisible({ window: pipWindow });
  }, []);

  const open = useCallback(async (forcePopup = false) => {
    if (current.current && !current.current.window.closed) { current.current.window.focus(); return; }
    if (pending.current) return;
    const attempt = ++requestRevision.current;
    pending.current = true; setOpening(true); setError("");
    try {
      const next = await openCoachCompanion(window as CompanionHost, forcePopup);
      if (!mounted.current || requestRevision.current !== attempt) { next.window.close(); return; }
      cleanup.current(); current.current = next;
      const changed = () => { if (mounted.current) setVisibilityRevision(value => value + 1); };
      const ended = () => { if (current.current === next) close(); };
      next.window.addEventListener("pagehide", ended);
      const companionDocument = next.window.document;
      companionDocument.addEventListener("visibilitychange", changed);
      // Browser UI can close a popup without delivering pagehide in every engine.
      const check = window.setInterval(() => { if (next.window.closed) ended(); }, 1000);
      cleanup.current = () => {
        window.clearInterval(check);
        next.window.removeEventListener("pagehide", ended);
        companionDocument.removeEventListener("visibilitychange", changed);
      };
      setTarget(next); changed(); next.window.focus();
    } catch {
      if (mounted.current && requestRevision.current === attempt) setError("The coach window could not open. Allow popups or try a separate coach window below.");
    } finally {
      if (requestRevision.current === attempt) {
        pending.current = false;
        if (mounted.current) { setOpening(false); setVisibilityRevision(value => value + 1); }
      }
    }
  }, [close]);

  useEffect(() => {
    mounted.current = true;
    setFloatingSupported(supportsFloatingCoach(window as CompanionHost));
    const exit = () => close();
    window.addEventListener("pagehide", exit);
    return () => { mounted.current = false; window.removeEventListener("pagehide", exit); close(); };
  }, [close]);

  return { target, isOpen: !!target, opening, error, floatingSupported, visibilityRevision, open, close, activeWhileHidden };
}

export type CoachCompanionState = ReturnType<typeof useCoachCompanion>;
export type CoachCompanionProps = {
  companion: CoachCompanionState;
  learner: string;
  slide: string;
  status: string;
  phase: "idle" | "connecting" | "listening" | "paused";
  seconds: number;
  feedback?: CoachFeedback | null;
  answer?: string;
  rehearsal?: boolean;
  onPauseResume: () => void;
  onEnd: () => void;
  previousSlide?: () => void;
  nextSlide?: () => void;
};

const companionCss = `
html:has(.coach-companion-body){background:#edf1f7!important;color-scheme:light}
body.coach-companion-body{margin:0!important;padding:0!important;min-width:240px!important;background:#edf1f7!important;color:#17243b!important;font:15px/1.5 system-ui,sans-serif!important;overflow:auto!important}
.coach-companion{padding:16px;max-width:640px;margin:auto}.coach-companion *{box-sizing:border-box}.coach-companion header{display:flex;align-items:flex-start;gap:10px;justify-content:space-between}.coach-companion h1{font-size:18px;margin:3px 0}.coach-companion p{margin:6px 0}.coach-companion small{font-size:11px;letter-spacing:.04em}.coach-companion .cc-muted{font-size:12px;color:#4a5870}.coach-companion .cc-status{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid #cdd6e4;margin-bottom:12px}.coach-companion section{margin:12px 0;padding:12px;background:white;border:1px solid #d2dbe7;border-radius:12px}.coach-companion section.cc-prompt{background:#e2efff;border-color:#92b9ed}.coach-companion section.cc-warning{background:#fff4db;border-color:#d5b66c}.coach-companion h2{font-size:12px;letter-spacing:.03em;margin:0 0 5px;font-weight:750}.coach-companion .cc-prompt p{font-size:19px;line-height:1.4;font-weight:650}.coach-companion .cc-controls{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.coach-companion button{appearance:none;background:#fff;border:1px solid #9aaac1;border-radius:8px;padding:8px 10px;color:#17243b;cursor:pointer;font:600 13px system-ui,sans-serif;min-height:38px}.coach-companion button:focus-visible{outline:3px solid #2e6ec9;outline-offset:2px}.coach-companion .cc-end{background:#7f2335;border-color:#7f2335;color:white}.coach-companion .cc-copy{white-space:pre-wrap;overflow-wrap:anywhere}.coach-companion footer{font-size:11px;color:#4a5870;border-top:1px solid #cdd6e4;padding-top:10px}.coach-companion .cc-phase{font-weight:750}.coach-companion .cc-empty{color:#4a5870;font-size:14px}
`;

export default function CoachCompanion({ companion, learner, slide, status, phase, seconds, feedback, answer, rehearsal, onPauseResume, onEnd, previousSlide, nextSlide }: CoachCompanionProps) {
  const target = companion.target;
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return <>
    <div className="lc-companion-launcher">
      <button type="button" className="lc-link" disabled={companion.opening} onClick={() => void companion.open()}>{companion.opening ? "Opening coach…" : target ? "Show private coach" : companion.floatingSupported ? "Float private coach" : "Open separate coach window"}</button>
      {target && <button type="button" className="lc-link" onClick={companion.close}>Close coach</button>}
      <p className="lc-hint">{companion.floatingSupported ? "Move the floating coach beside PowerPoint. Keep this app open; select the matching slide here as you teach." : "A compact separate window for split screen with PowerPoint. This browser does not offer an always-on-top coach."}</p>
      {companion.error && <div role="alert"><p>{companion.error}</p><button type="button" className="lc-link" disabled={companion.opening} onClick={() => void companion.open(true)}>Try separate coach window</button></div>}
    </div>
    {target && createPortal(<><style>{companionCss}</style><main className="coach-companion" aria-label="Private teaching coach">
      <header><div><small>PRIVATE TEACHER GUIDANCE{rehearsal ? " · REHEARSAL" : ""}</small><h1>{learner}</h1></div><button type="button" aria-label="Close private coach" onClick={companion.close}>Close</button></header>
      <p className="cc-muted">{slide}</p>
      <div className="cc-status"><span className="cc-phase" role="status">{phase === "listening" ? "Listening" : phase === "paused" ? "Paused" : phase === "connecting" ? "Connecting…" : "Listening off"}</span><span aria-label={`${Math.floor(seconds / 60)} minutes ${seconds % 60} seconds`}>{clock}</span></div>
      <div className="cc-controls">{(phase === "listening" || phase === "paused") && <button type="button" onClick={onPauseResume}>{phase === "paused" ? "Resume listening" : "Pause listening"}</button>}{phase !== "idle" && <button type="button" className="cc-end" onClick={onEnd}>End listening</button>}</div>
      {(previousSlide || nextSlide) && <div className="cc-controls"><button type="button" disabled={!previousSlide} onClick={previousSlide}>Previous reference</button><button type="button" disabled={!nextSlide} onClick={nextSlide}>Next reference</button></div>}
      <div aria-live="polite" aria-atomic="false">
        {feedback?.prompt && <section className="cc-prompt"><h2>ASK NEXT</h2><p className="cc-copy">{feedback.prompt}</p></section>}
        {feedback?.focus && <section><h2>TEACHING FOCUS</h2><p className="cc-copy">{feedback.focus}</p></section>}
        {feedback?.correction && <section><h2>CHECK THIS CORRECTION</h2><p className="cc-copy">{feedback.correction}</p></section>}
        {feedback?.next && <section><h2>NEXT STEP</h2><p className="cc-copy">{feedback.next}</p></section>}
        {feedback?.uncertainty && <section className="cc-warning"><h2>CHECK THE EVIDENCE</h2><p className="cc-copy">{feedback.uncertainty}</p></section>}
        {answer && <section><h2>PRIVATE AI ANSWER</h2><p className="cc-copy">{answer}</p></section>}
        {!feedback && !answer && <section><p className="cc-empty">Your next question and teaching focus will appear here. Start listening or use Prepared rehearsal in the app.</p></section>}
      </div>
      <p className="cc-muted" role="status">{status}</p>
      <footer>{target.mode === "picture-in-picture" ? "Floating coach · drag this window to move it." : "Separate coach window · arrange beside PowerPoint; it is not always on top."} Share only the student slideshow window. PowerPoint slide changes do not sync automatically.</footer>
    </main></>, target.container)}
  </>;
}
