"use client";

import { useEffect, useState } from "react";
import { fetchResources, remoteEnabled, type ResourceItem } from "@/lib/remote";
import { ExternalIcon } from "@/components/Icons";

// Maps a Drive MIME type to a friendly emoji + label.
function kindOf(type: string): { icon: string; label: string } {
  if (type.includes("presentation")) return { icon: "📊", label: "Slides" };
  if (type.includes("pdf")) return { icon: "📄", label: "PDF" };
  if (type.includes("document") || type.includes("msword")) return { icon: "📝", label: "Document" };
  if (type.includes("spreadsheet")) return { icon: "📈", label: "Sheet" };
  if (type.startsWith("image/")) return { icon: "🖼️", label: "Image" };
  if (type.startsWith("audio/")) return { icon: "🎧", label: "Audio" };
  if (type.startsWith("video/")) return { icon: "🎬", label: "Video" };
  return { icon: "📎", label: "File" };
}

export default function ResourcesView({
  fetchCode,
  mode,
}: {
  fetchCode: string;
  mode: "student" | "parent";
}) {
  const [state, setState] = useState<"loading" | "ok" | "error" | "off">("loading");
  const [items, setItems] = useState<ResourceItem[]>([]);

  useEffect(() => {
    if (!remoteEnabled()) {
      setState("off");
      return;
    }
    let live = true;
    fetchResources(fetchCode)
      .then((d) => {
        if (!live) return;
        if (d.ok) {
          setItems(d.resources ?? []);
          setState("ok");
        } else {
          setState("error");
        }
      })
      .catch(() => live && setState("error"));
    return () => {
      live = false;
    };
  }, [fetchCode]);

  return (
    <main className="px-5 pb-10">
      <header
        className="mb-2 pt-4"
        style={{ paddingTop: mode === "parent" ? "calc(env(safe-area-inset-top) + 1rem)" : undefined }}
      >
        <h1 className="text-2xl font-extrabold text-navy dark:text-cream">Lessons &amp; feedback</h1>
        <p className="mt-0.5 text-sm text-burgundy dark:text-amber/80">
          Slides, marked work and assessments Rory has shared with you.
        </p>
      </header>

      {state === "loading" && (
        <div className="mt-4 space-y-3">
          <div className="h-16 animate-pulse rounded-card bg-white/70 shadow-card dark:bg-white/5" />
          <div className="h-16 animate-pulse rounded-card bg-white/70 shadow-card dark:bg-white/5" />
        </div>
      )}

      {state === "off" && <Note>This isn&apos;t switched on yet.</Note>}
      {state === "error" && <Note>Couldn&apos;t load right now — check your connection and try again.</Note>}
      {state === "ok" && items.length === 0 && (
        <Note>Nothing shared here yet. New slides and feedback will appear automatically.</Note>
      )}

      {state === "ok" && items.length > 0 && (
        <ul className="mt-2 space-y-3">
          {items.map((it) => {
            const k = kindOf(it.type);
            return (
              <li key={it.url}>
                <a
                  href={it.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-card bg-white p-4 shadow-card active:scale-[.99] dark:bg-white/5"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber/15 text-xl" aria-hidden>
                    {k.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-navy dark:text-cream">{it.name}</span>
                    <span className="block text-xs text-burgundy dark:text-amber/80">
                      {k.label} · {it.modified}
                    </span>
                  </span>
                  <ExternalIcon className="shrink-0 text-amber-deep dark:text-amber" />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-6 rounded-card bg-white p-5 text-center text-burgundy shadow-card dark:bg-white/5 dark:text-amber/80">
      {children}
    </p>
  );
}
