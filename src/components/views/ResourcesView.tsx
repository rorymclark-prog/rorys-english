"use client";

import { useEffect, useState, type SVGProps } from "react";
import { fetchResources, remoteEnabled, type ResourceItem } from "@/lib/remote";
import { ExternalIcon } from "@/components/Icons";

// File-type icons in the Icons.tsx 24px stroke style (kept local — this view
// is their only consumer; no emoji per design spec §6).
const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...p,
});

function SlidesIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(p)}>
      <path d="M2 3h20" />
      <path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3" />
      <path d="m7 21 5-5 5 5" />
    </svg>
  );
}

function PdfIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(p)}>
      <path d="M14 3v5h5" />
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    </svg>
  );
}

function DocIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(p)}>
      <path d="M14 3v5h5" />
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </svg>
  );
}

function SheetIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M3 15h18" />
      <path d="M12 9v12" />
    </svg>
  );
}

function ImageIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
    </svg>
  );
}

function AudioIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(p)}>
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <rect x="3" y="14" width="4" height="6" rx="1.5" />
      <rect x="17" y="14" width="4" height="6" rx="1.5" />
    </svg>
  );
}

function VideoIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m10 9 5 3-5 3z" />
    </svg>
  );
}

function FileIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(p)}>
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

type IconComponent = typeof FileIcon;

// Maps a Drive MIME type to an icon component + label.
function kindOf(type: string): { Icon: IconComponent; label: string } {
  if (type.includes("presentation")) return { Icon: SlidesIcon, label: "Slides" };
  if (type.includes("pdf")) return { Icon: PdfIcon, label: "PDF" };
  if (type.includes("document") || type.includes("msword")) return { Icon: DocIcon, label: "Document" };
  if (type.includes("spreadsheet")) return { Icon: SheetIcon, label: "Sheet" };
  if (type.startsWith("image/")) return { Icon: ImageIcon, label: "Image" };
  if (type.startsWith("audio/")) return { Icon: AudioIcon, label: "Audio" };
  if (type.startsWith("video/")) return { Icon: VideoIcon, label: "Video" };
  return { Icon: FileIcon, label: "File" };
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
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-soft dark:bg-amber-dusk" aria-hidden>
                    <k.Icon className="text-amber-deep dark:text-amber" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-navy dark:text-cream">{it.name}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs">
                      <span className="rounded-full bg-black/5 px-2 py-0.5 font-semibold text-navy-soft dark:bg-white/10 dark:text-navy-mist">
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
