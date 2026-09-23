"use client";
import {useEffect,useRef} from "react";

// Server controls release. Timers only refresh the page's data; changing a
// device clock never unlocks feedback. Reopen/focus also refreshes after sleep.
export function useReviewRefresh(refresh:()=>void,times:(string|undefined)[]) {
  const latest=useRef(refresh);latest.current=refresh;
  const deadlines=times.filter(Boolean).join("|");
  useEffect(()=>{
    const remaining=deadlines.split("|").map(t=>Date.parse(t)-Date.now()).filter(n=>Number.isFinite(n)&&n>=0);
    const timer=remaining.length?window.setTimeout(()=>latest.current(),Math.min(...remaining)+1500):undefined;
    const onFocus=()=>latest.current();
    window.addEventListener("focus",onFocus);
    return()=>{window.clearTimeout(timer);window.removeEventListener("focus",onFocus);};
  },[deadlines]);
}
