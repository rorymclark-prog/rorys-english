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
    window.addEventListener("load", onLoad);
    return () => {
      window.removeEventListener("load", onLoad);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  if (!updated) return null;

  return (
    <div className="fixed inset-x-0 top-2 z-40 mx-auto max-w-md px-4">
      <button
        onClick={() => window.location.reload()}
        className="flex w-full items-center justify-center gap-2 rounded-card bg-navy p-3 text-sm font-bold text-cream shadow-card active:scale-[.99] dark:bg-amber dark:text-navy"
      >
        ✨ New version available — tap to refresh
      </button>
    </div>
  );
}
