"use client";
import type {ReactNode} from "react";

/** The one loading / error / empty presentation. A quiet inline row: icon · one line · optional Retry. */
export default function StatusRow({kind,children,onRetry,retryLabel="Retry",className=""}:{kind:"loading"|"error"|"empty";children:ReactNode;onRetry?:()=>void;retryLabel?:string;className?:string}){
  return <div className={`status-row is-${kind} ${className}`.trim()} role={kind==="error"?"alert":"status"}>
    <span className="status-row-icon" aria-hidden="true">{kind==="loading"?<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3a9 9 0 1 0 9 9"/></svg>:kind==="error"?<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4m0 4h.01"/></svg>:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M9 13.5c.8 1 1.8 1.5 3 1.5s2.2-.5 3-1.5"/></svg>}</span>
    <span className="status-row-text">{children}</span>
    {onRetry&&<button type="button" className="status-row-retry" onClick={onRetry}>{retryLabel}</button>}
  </div>;
}
