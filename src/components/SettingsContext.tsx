"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings,
  type Settings,
} from "@/lib/storage";

interface SettingsCtx {
  settings: Settings;
  ready: boolean;
  update: (patch: Partial<Settings>) => void;
}

const Ctx = createContext<SettingsCtx | null>(null);

function applyToDocument(s: Settings) {
  const root = document.documentElement;
  root.setAttribute("data-text-scale", s.textScale);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = s.theme === "dark" || (s.theme === "system" && prefersDark);
  root.classList.toggle("dark", dark);
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

  return <Ctx.Provider value={{ settings, ready, update }}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSettings must be used inside <SettingsProvider>");
  return v;
}
