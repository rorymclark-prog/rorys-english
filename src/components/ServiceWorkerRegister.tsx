"use client";

import { useEffect } from "react";

/** Registers the hand-rolled service worker so the app installs + works offline. */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const onLoad = () => {
      navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch(() => {
        /* offline support is a progressive enhancement; ignore failures */
      });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
