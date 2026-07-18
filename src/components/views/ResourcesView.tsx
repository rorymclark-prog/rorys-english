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
        <h1 className="display text-2xl text-navy dark:text-cream">Lessons &amp; feedback</h1>
        <p className="mt-0.5 text-sm text-navy-soft dark:text-navy-mist">
          Slides, marked work and assessments Rory has shared with you.
        </p>
      </header>

      {state === "loading" && (
        <div className="mt-4 space-y-3">
          <div className="h-16 animate-pulse rounded-card bg-surface shadow-card dark:bg-navy-raised dark:shadow-card-dark" />
          <div className="h-16 animate-pulse rounded-card bg-surface shadow-card dark:bg-navy-raised dark:shadow-card-dark" />
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
                  className="flex items-center gap-3 rounded-card bg-surface p-4 shadow-card transition active:scale-[.97] dark:bg-navy-raised dark:shadow-card-dark"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-soft text-xl dark:bg-amber-dusk" aria-hidden>
                    {k.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-navy dark:text-cream">{it.name}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs">
                      <span className="rounded-full bg-amber-soft px-2 py-0.5 font-semibold text-amber-deep dark:bg-amber-dusk dark:text-amber">
                        {k.label}
                      </span>
                      <span className="tnum text-navy-soft dark:text-navy-mist">{it.modified}</span>
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
    <p className="mt-6 rounded-card bg-surface p-5 text-center text-navy-soft shadow-card dark:bg-navy-raised dark:text-navy-mist dark:shadow-card-dark">
      {children}
    </p>
  );
}
