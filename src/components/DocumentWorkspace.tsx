"use client";

import {Children, cloneElement, isValidElement, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode} from 'react';

const STORAGE_KEY = 're_document_library_width_v1';
const HIDDEN_KEY = 're_document_library_hidden_v1';
const DEFAULT_SHARE = 0.335;
const HANDLE_WIDTH = 24;

/** A device-local layout preference; it never changes a learner's records. */
export default function DocumentWorkspace({children, resizable}: {children: ReactNode; resizable: boolean}) {
  const workspace = useRef<HTMLDivElement>(null);
  const pointer = useRef<{id: number; offset: number} | null>(null);
  const shareRef = useRef(DEFAULT_SHARE);
  const [share, setShare] = useState(DEFAULT_SHARE);
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [libraryHidden, setLibraryHidden] = useState(false);
  const libraryId = useId();

  useEffect(() => {
    try {
      setLibraryHidden(localStorage.getItem(HIDDEN_KEY) === 'true');
      const saved = Number(localStorage.getItem(STORAGE_KEY));
      if (Number.isFinite(saved) && saved >= 0.1 && saved <= 0.5) {
        shareRef.current = saved;
        setShare(saved);
      }
    } catch { /* Resizing still works when storage is unavailable. */ }
    const element = workspace.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.getBoundingClientRect().width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const minimum = Math.min(180, width / 2);
  const maximum = Math.max(minimum, Math.min(520, width / 2, width - 360 - HANDLE_WIDTH));
  const pixels = Math.round(Math.max(minimum, Math.min(maximum, share * width)));

  function save(value = shareRef.current) {
    try { localStorage.setItem(STORAGE_KEY, String(value)); } catch { /* Optional preference. */ }
  }
  function resize(next: number) {
    if (!width) return;
    const value = Math.max(minimum, Math.min(maximum, next)) / width;
    shareRef.current = value;
    setShare(value);
  }
  function reset() {
    shareRef.current = DEFAULT_SHARE;
    setShare(DEFAULT_SHARE);
    save(DEFAULT_SHARE);
  }
  function toggleLibrary() {
    const hidden = !libraryHidden;
    setLibraryHidden(hidden);
    try { localStorage.setItem(HIDDEN_KEY, String(hidden)); } catch { /* Optional preference. */ }
  }
  function start(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !workspace.current) return;
    event.preventDefault();
    event.currentTarget.focus();
    const left = workspace.current.getBoundingClientRect().left;
    pointer.current = {id: event.pointerId, offset: event.clientX - left - pixels};
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (pointer.current?.id !== event.pointerId || !workspace.current) return;
    resize(event.clientX - workspace.current.getBoundingClientRect().left - pointer.current.offset);
  }
  function finish() {
    if (!pointer.current) return;
    pointer.current = null;
    setDragging(false);
    save();
  }
  function key(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 50 : 20;
    if (event.key === 'ArrowLeft') resize(pixels - step);
    else if (event.key === 'ArrowRight') resize(pixels + step);
    else if (event.key === 'Home') resize(minimum);
    else if (event.key === 'End') resize(maximum);
    else if (event.key === 'Enter') reset();
    else return;
    event.preventDefault();
    save();
  }

  const panes = Children.toArray(children);
  const library = resizable && isValidElement<{id?: string}>(panes[0]) ? cloneElement(panes[0], {id: libraryId}) : panes[0];
  return <>
    {resizable && <div className="doc-workspace-layout-control"><button type="button" className="doc-secondary" aria-controls={libraryId} aria-expanded={!libraryHidden} onClick={toggleLibrary}>{libraryHidden ? 'Show saved work' : 'Hide saved work'}</button></div>}
    <div ref={workspace} className={`doc-workspace${resizable ? ' doc-workspace-resizable' : ''}${libraryHidden ? ' is-library-hidden' : ''}${dragging ? ' is-resizing' : ''}`} style={{'--doc-library-width': `${share * 100}%`} as CSSProperties}>
    {resizable ? <>
      {library}
      <div className="doc-workspace-divider" role="separator" aria-label="Resize saved-work list" aria-orientation="vertical" aria-controls={libraryId} aria-valuemin={Math.round(minimum)} aria-valuemax={Math.round(maximum)} aria-valuenow={pixels} aria-valuetext={`${pixels} pixels. Drag left for more review space. Use arrow keys to resize; Enter or double-click to reset.`} tabIndex={0} title="Drag left for more review space · double-click to reset" onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} onKeyDown={key} onDoubleClick={reset}>
        <span className="doc-workspace-grip" aria-hidden="true">⋮</span>
      </div>
      {panes.slice(1)}
    </> : children}
  </div></>;
}
