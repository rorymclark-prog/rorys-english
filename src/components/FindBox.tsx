"use client";

import {useEffect,useId,useMemo,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {findMatches,type FindEntry} from "@/lib/find";

/**
 * One box that finds a page, a task, a unit or a file by name.
 * Matching happens on the device; nothing typed here is sent anywhere.
 *
 * `hard` loads the address afresh, which the teacher workspace needs because
 * it reads its view from the address bar. `shortcut` lets "/" jump to the box.
 */
export default function FindBox({entries,placeholder="Find a page, task or lesson",onGo,hard=false,shortcut=false}:{entries:()=>FindEntry[];placeholder?:string;onGo?:()=>void;hard?:boolean;shortcut?:boolean}){
  const router=useRouter(),id=useId(),input=useRef<HTMLInputElement>(null);
  const [query,setQuery]=useState(""),[active,setActive]=useState(0);
  // Built the first time something is typed, not on every page.
  const index=useMemo(()=>query?entries():[],[!!query,entries]);// eslint-disable-line react-hooks/exhaustive-deps
  const results=useMemo(()=>findMatches(query,index),[query,index]);
  useEffect(()=>{setActive(0);},[query]);
  useEffect(()=>{
    if(!shortcut)return;
    const onKey=(e:KeyboardEvent)=>{
      const target=e.target as HTMLElement|null;
      if(e.key!=="/"||e.metaKey||e.ctrlKey||e.altKey||target?.closest("input,textarea,select,[contenteditable='true']"))return;
      if(!input.current||input.current.offsetParent===null)return;
      e.preventDefault();input.current.focus();
    };
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[shortcut]);
  const go=(entry:FindEntry)=>{
    setQuery("");onGo?.();
    if(hard)window.location.assign(`${process.env.NEXT_PUBLIC_BASE_PATH||""}${entry.href}`);else router.push(entry.href);
  };
  const typed=query.trim();
  return <div className="find-box" role="search">
    <label className="find-field"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span className="sr-only">Find</span>
      <input ref={input} type="search" value={query} placeholder={placeholder} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} enterKeyHint="go" role="combobox" aria-autocomplete="list" aria-expanded={!!typed} aria-controls={`${id}-results`} aria-activedescendant={results[active]?`${id}-${active}`:undefined}
        onChange={e=>setQuery(e.target.value)}
        onKeyDown={e=>{
          if(e.key==="ArrowDown"){e.preventDefault();setActive(i=>Math.min(i+1,results.length-1));}
          else if(e.key==="ArrowUp"){e.preventDefault();setActive(i=>Math.max(i-1,0));}
          else if(e.key==="Enter"&&results[active]){e.preventDefault();go(results[active]);}
          else if(e.key==="Escape"&&query){e.preventDefault();e.stopPropagation();setQuery("");}
        }}/>
      {shortcut&&!query&&<kbd aria-hidden="true">/</kbd>}
    </label>
    <ul id={`${id}-results`} role="listbox" aria-label="Results" className="find-results" hidden={!results.length}>{results.map((entry,i)=><li key={entry.href+entry.label} id={`${id}-${i}`} role="option" aria-selected={i===active} onMouseEnter={()=>setActive(i)} onClick={()=>go(entry)}><strong>{entry.label}</strong>{entry.hint&&<small>{entry.hint}</small>}<em>{entry.group}</em></li>)}</ul>
    <p className="find-empty" role="status">{typed&&!results.length?`Nothing found for “${typed}”. Try a page name, a task or a unit.`:""}</p>
  </div>;
}
