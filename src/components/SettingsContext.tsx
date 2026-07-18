"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings,
  type Settings,
  type Theme,
} from "@/lib/storage";

interface SettingsCtx {
  settings: Settings;
  ready: boolean;
  update: (patch: Partial<Settings>) => void;
}

const Ctx = createContext<SettingsCtx | null>(null);

// ── Dark is the app default ──────────────────────────────────────────────────
// A student with NO stored theme choice gets dark mode. An explicit stored
// choice (including "system"/Auto) always wins and is never overridden.
// `getSettings` merges DEFAULT_SETTINGS over the stored blob, which hides
// whether a theme was actually stored — so we peek at the raw record here.

/** Mirrors `settingsKey()` in lib/storage.ts (not exported from there). */
function rawSettingsKey(studentId: string): string {
  return `${studentId}_settings`;
}

/** The theme the student explicitly saved, or null if they never chose one. */
function storedTheme(studentId: string): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(rawSettingsKey(studentId));
    if (!raw) return null;
    const t = (JSON.parse(raw) as Partial<Settings>).theme;
    return t === "light" || t === "dark" || t === "system" ? t : null;
  } catch {
    return null;
  }
}

/** Stored settings with the dark default applied when no theme was chosen. */
function loadSettings(studentId: string): Settings {
  const s = getSettings(studentId);
  if (storedTheme(studentId) === null) s.theme = "dark";
  return s;
}

function applyToDocument(s: Settings) {
  const root = document.documentElement;
  root.setAttribute("data-text-scale", s.textScale);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = s.theme === "dark" || (s.theme === "system" && prefersDark);
  root.classList.toggle("dark", dark);
}

/**
 * Pre-paint theme script: SSR'd into the HTML, so it runs while the document
 * is still parsing — before first paint. Must mirror loadSettings():
 * stored "light" → light, stored "system" → follow OS, anything else → dark.
 */
function themeScript(studentId: string): string {
  const key = JSON.stringify(rawSettingsKey(studentId)).replace(/</g, "\\u003c");
  return (
    `(function(){try{var t=null;try{var r=localStorage.getItem(${key});` +
    `if(r)t=JSON.parse(r).theme}catch(e){}` +
    `var d;if(t==="light"){d=false}` +
    `else if(t==="system"){d=matchMedia("(prefers-color-scheme: dark)").matches}` +
    `else{d=true}` +
    `document.documentElement.classList.toggle("dark",d)}catch(e){}})()`
  );
}

export function SettingsProvider({ studentId, children }: { studentId: string; children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = loadSettings(studentId);
    setSettings(s);
    applyToDocument(s);
    setReady(true);
  }, [studentId]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyToDocument(settings);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [settings]);

  const update = (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      applyToDocument(next);
      saveSettings(studentId, next);
      return next;
    });
  };

  return (
    <Ctx.Provider value={{ settings, ready, update }}>
      <script dangerouslySetInnerHTML={{ __html: themeScript(studentId) }} />
      {children}
    </Ctx.Provider>
  );
}

export function useSettings(): SettingsCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSettings must be used inside <SettingsProvider>");
  return v;
}
