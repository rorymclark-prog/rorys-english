"use client";

import { useEffect, useState } from "react";

// Lightweight "Add to Home Screen" nudge. Android/Chrome fires
// beforeinstallprompt (we show a real Install button); iOS Safari never does, so
// we show a one-line instruction instead. Dismissable, remembered per device.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "re_install_hint_dismissed";

export default function InstallHint() {
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Already installed / standalone? Never show.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari only
      window.navigator.standalone === true;
    if (standalone) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const ua = window.navigator.userAgent;
    // iPadOS 13+ reports "Macintosh" in the UA — detect it via touch support.
    const ipadOs13Plus = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    const ios = (/iPad|iPhone|iPod/.test(ua) || ipadOs13Plus) && !/CriOS|FxiOS/.test(ua);
    setIsIos(ios);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS gives no event — show the instruction after a short beat.
    let t: number | undefined;
    if (ios) t = window.setTimeout(() => setShow(true), 1200);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (t) window.clearTimeout(t);
    };
  }, []);

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    dismiss();
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-md px-4">
      <div className="flex items-center gap-3 rounded-card bg-navy p-3 text-cream shadow-card dark:bg-white/10">
        <span className="text-xl" aria-hidden>
          📲
        </span>
        <p className="flex-1 text-sm leading-snug">
          {isIos ? (
            <>
              Install this app: tap <strong>Share</strong>, then{" "}
              <strong>Add to Home Screen</strong>.
            </>
          ) : (
            <>Add this app to your home screen for one-tap access.</>
          )}
        </p>
        {!isIos && deferred && (
          <button
            onClick={install}
            className="min-h-[48px] shrink-0 rounded-lg bg-amber px-4 text-sm font-bold text-navy"
          >
            Install
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-cream/70 hover:bg-white/10"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
