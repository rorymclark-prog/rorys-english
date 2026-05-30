"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStudent } from "./StudentContext";
import { HomeIcon, BookIcon, CheckSquareIcon } from "./Icons";

export default function TabBar() {
  const { code } = useStudent();
  const pathname = usePathname();
  const base = `/s/${code}`;

  const tabs = [
    { href: `${base}/`, label: "Today", Icon: HomeIcon, match: (p: string) => p === `${base}` || p === `${base}/` },
    { href: `${base}/study/`, label: "Study", Icon: BookIcon, match: (p: string) => p.startsWith(`${base}/study`) },
    {
      href: `${base}/homework/`,
      label: "Homework",
      Icon: CheckSquareIcon,
      match: (p: string) => p.startsWith(`${base}/homework`),
    },
  ];

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-black/10 bg-cream/95 backdrop-blur dark:border-white/10 dark:bg-navy/95"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around pb-safe">
        {tabs.map(({ href, label, Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-1 pt-2 text-xs font-semibold transition-colors ${
                  active ? "text-amber-deep dark:text-amber" : "text-navy-soft dark:text-cream/60"
                }`}
              >
                <Icon width={26} height={26} strokeWidth={active ? 2.4 : 2} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
