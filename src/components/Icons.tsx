// Inline stroke icons — no icon library, keeps the bundle tiny + offline-safe.
import type { SVGProps } from "react";

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

export function HomeIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(p)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}

export function BookIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(p)}>
      <path d="M3 5a2 2 0 0 1 2-2h6v16H5a2 2 0 0 0-2 2z" />
      <path d="M21 5a2 2 0 0 0-2-2h-6v16h6a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function CheckSquareIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(p)}>
      <path d="m9 11 3 3 5-6" />
      <path d="M21 12v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h9" />
    </svg>
  );
}

export function GearIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function ChevronRightIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(p)}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function ChevronLeftIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(p)}>
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

export function ExternalIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(p)}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

export function ChartIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(p)}>
      <path d="M3 3v18h18" />
      <rect x="7" y="12" width="3" height="5" />
      <rect x="12" y="8" width="3" height="9" />
      <rect x="17" y="5" width="3" height="12" />
    </svg>
  );
}

export function FlameIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(p)}>
      <path d="M12 3c1 3-2 4-2 7a2 2 0 0 0 4 0c0-1 0-1 .5-2 1 1.5 1.5 3 1.5 4.5a5 5 0 0 1-10 0C6 9 9 7 12 3z" />
    </svg>
  );
}
