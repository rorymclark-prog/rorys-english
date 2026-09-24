"use client";

// The seven-day strip and the streak counter. storage.ts has carried
// getStreakDays/currentStreak/bestStreak/recentActivity since bedfc2f, and
// MASTERPLAN lists this strip as shipped, but 3d9386b removed every call site
// during the submissions rewrite and left the helpers stranded. This is the
// screen half, rebuilt to the spec rather than reinvented.
//
// MODERN-2026-SPEC §6: the streak stays chill — a quiet ember counter, zero
// guilt mechanics. So a broken run is never named, an empty week reads as an
// invitation, and nothing here nags. Ember (§1 rule 3) is the reward channel
// and is used for nothing else.

import {useCallback,useEffect,useState} from "react";
import {bestStreak,currentStreak,getStreakDays,localDay,recentActivity} from "@/lib/storage";

const DAY_INITIALS=["S","M","T","W","T","F","S"];

export default function MomentumStrip({studentId}:{studentId:string}){
  // localStorage is read after mount: rendering it during SSR would mismatch.
  const [days,setDays]=useState<string[]|null>(null);
  const read=useCallback(()=>setDays(getStreakDays(studentId)),[studentId]);
  useEffect(()=>{
    read();
    // Submitting work in another tab, or coming back to a tab left open
    // overnight, both have to move the strip.
    const onVisible=()=>{if(document.visibilityState==="visible")read();};
    window.addEventListener("re-streak-change",read);
    document.addEventListener("visibilitychange",onVisible);
    return()=>{window.removeEventListener("re-streak-change",read);document.removeEventListener("visibilitychange",onVisible);};
  },[read]);

  // Hold the row's height before the read lands so the page doesn't jump.
  if(days===null)return <div className="momentum-strip is-placeholder" aria-hidden="true"/>;

  const streak=currentStreak(days),best=bestStreak(days),week=recentActivity(days,7),today=localDay();
  const label=streak===0
    ?"No days recorded yet this week."
    :`${streak} ${streak===1?"day":"days"} in a row. ${week.filter(d=>d.active).length} of the last 7 days active.`;

  return <section className="momentum-strip" aria-label="Your recent activity">
    <div className="momentum-count">
      {/* A big ember 0 reads as a telling-off, which is the one thing §6 rules
          out. With nothing recorded yet the strip just names the week. */}
      {streak>0
        ?<><strong className="tnum">{streak}</strong><span>{streak===1?"day in a row":"days in a row"}</span></>
        :<span className="momentum-quiet">Your week</span>}
    </div>
    <ol className="momentum-days" role="list">
      {week.map(({day,active})=>{
        const weekday=new Date(day+"T00:00:00").getDay();
        return <li key={day} className={`momentum-day${active?" is-active":""}${day===today?" is-today":""}`}>
          <i aria-hidden="true"/>
          <span aria-hidden="true">{DAY_INITIALS[weekday]}</span>
        </li>;
      })}
    </ol>
    <p className="momentum-note">{streak===0
      ?"Send any piece of work and this starts."
      :best>streak?<>Your best run so far is <span className="tnum">{best}</span> days.</>
      :"That is your best run so far."}</p>
    <p className="sr-only">{label}</p>
  </section>;
}
