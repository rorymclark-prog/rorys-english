"use client";

import { useEffect, useState } from "react";

/**
 * Registers the hand-rolled service worker (installs + offline) and shows a
 * small "new version" toast when a fresh deploy takes over an already-open
 * app, so students don't keep using stale content in long-lived sessions.
 */
export default function ServiceWorkerRegister() {
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

    // controllerchange also fires on first-ever install (clients.claim) —
    // only treat it as an update if a controller already existed.
    const hadController = !!navigator.serviceWorker.controller;
    const onControllerChange = () => {
      if (hadController) setUpdated(true);
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const onLoad = () => {
      navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch(() => {
        /* offline support is a progressive enhancement; ignore failures */
      });
    };
    // On a fast/cached repeat visit the 'load' event can fire before this effect
    // attaches its listener, so register immediately if the page is already done.
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad);
    return () => {
      window.removeEventListener("load", onLoad);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  if (!updated) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-sheet fixed inset-x-0 z-40 mx-auto max-w-md px-4"
      style={{ top: "calc(env(safe-area-inset-top) + 0.5rem)" }}
    >
      <button
        onClick={() => window.location.reload()}
        className="flex w-full items-center justify-center gap-2 rounded-card bg-amber-deep p-3 text-sm font-bold text-white shadow-card transition ease-out2026 active:scale-[.97] dark:bg-amber dark:text-navy dark:shadow-card-dark"
      >
        ✨ New version available — tap to refresh
      </button>
    </div>
  );
}
