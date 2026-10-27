"use client";

import { useEffect, useState } from "react";

/**
 * Registers the hand-rolled service worker (installs + offline) and shows a
 * small "new version" toast when a fresh deploy takes over an already-open
 * app, so students don't keep using stale content in long-lived sessions.
 */
export default function ServiceWorkerRegister() {
  const [updated, setUpdated] = useState(false);
  const [dismissed,setDismissed]=useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    let registration:ServiceWorkerRegistration|undefined,live=true,checking=false,lastCheck=0;
    const checkForUpdate=()=>{
      if(!registration||document.hidden||!navigator.onLine||checking||Date.now()-lastCheck<60000)return;
      lastCheck=Date.now();checking=true;
      void registration.update().catch(()=>{/* Recheck after the connection returns. */}).finally(()=>{checking=false;});
    };
    window.addEventListener('focus',checkForUpdate);
    window.addEventListener('online',checkForUpdate);
    document.addEventListener('visibilitychange',checkForUpdate);
    const timer=setInterval(checkForUpdate,60000);

    // controllerchange also fires on first-ever install (clients.claim) —
    // only treat it as an update if a controller already existed.
    let hadController = !!navigator.serviceWorker.controller;
    const onControllerChange = () => {
      // Never over the sign-in screen: nothing there is worth interrupting.
      if (hadController && !document.querySelector(".signin")) {setUpdated(true);setDismissed(false);}
      hadController=true;
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const onLoad = () => {
      navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/`,updateViaCache:"none" }).then(value=>{if(live)registration=value;}).catch(() => {
        /* offline support is a progressive enhancement; ignore failures */
      });
    };
    // On a fast/cached repeat visit the 'load' event can fire before this effect
    // attaches its listener, so register immediately if the page is already done.
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad);
    return () => {
      live=false;clearInterval(timer);
      window.removeEventListener('focus',checkForUpdate);
      window.removeEventListener('online',checkForUpdate);
      document.removeEventListener('visibilitychange',checkForUpdate);
      window.removeEventListener("load", onLoad);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  if (!updated||dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-sheet fixed inset-x-0 z-40 mx-auto max-w-md px-4 md:max-w-2xl"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)" }}
    >
      <button
        onClick={() => window.location.reload()}
        className="flex w-full items-center justify-center gap-2 rounded-card bg-amber-deep p-3 text-sm font-bold text-white shadow-card transition ease-out2026 active:scale-[.97] dark:bg-amber dark:text-navy dark:shadow-card-dark"
      >
        New app update · refresh when your work is saved
      </button><button type="button" className="mt-1 rounded-lg bg-surface px-3 py-2 text-sm font-semibold text-navy dark:bg-navy-raised dark:text-cream" onClick={()=>setDismissed(true)}>Keep working · update later</button>
    </div>
  );
}
