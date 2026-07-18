import Link from "next/link";
import { getBundle } from "@/lib/content";
import ResourcesView from "@/components/views/ResourcesView";
import { ChevronLeftIcon } from "@/components/Icons";

export default async function ResourcesPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  getBundle(code); // 404 handled by the [code] layout
  return (
    <>
      <header
        className="sticky top-0 z-10 flex items-center gap-2 bg-cream/95 px-3 backdrop-blur dark:bg-navy/95"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)", paddingBottom: "0.25rem" }}
      >
        <Link
          href={`/s/${code}/`}
          aria-label="Back to today"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-navy-soft transition hover:bg-black/5 active:scale-[.97] dark:text-navy-mist dark:hover:bg-white/10"
        >
          <ChevronLeftIcon />
        </Link>
      </header>
      <ResourcesView fetchCode={code} mode="student" />
    </>
  );
}
