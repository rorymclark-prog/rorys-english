"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings,
  type Settings,
} from "@/lib/storage";
import { themeScript, usesDarkTheme } from "@/lib/appearance";

interface SettingsCtx {
  settings: Settings;
  ready: boolean;
  update: (patch: Partial<Settings>) => void;
}

const Ctx = createContext<SettingsCtx | null>(null);

function applyToDocument(s: Settings) {
  const root = document.documentElement;
  root.setAttribute("data-text-scale", s.textScale);
  root.setAttribute("data-palette", ["blue","indigo","clay"].includes(s.palette||"")?s.palette!:"blue");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = usesDarkTheme(s.theme, prefersDark);
  root.classList.toggle("dark", dark);
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta => { meta.content = dark ? "#151C2B" : "#F7F6F2"; });
}

export function SettingsProvider({ studentId, children }: { studentId: string; children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = getSettings(studentId);
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
