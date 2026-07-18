import Link from "next/link";
import { getBundle } from "@/lib/content";
import SpeakView from "@/components/views/SpeakView";
import { ChevronLeftIcon } from "@/components/Icons";

export default async function SpeakPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const bundle = getBundle(code)!;
  const lines = bundle.activeUnit?.speakingLines ?? [];
  return (
    <>
      <header
        className="sticky top-0 z-10 flex items-center gap-2 bg-cream/95 px-3 backdrop-blur dark:bg-navy/95"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)", paddingBottom: "0.25rem" }}
      >
        <Link
          href={`/s/${code}/study/`}
          aria-label="Back to study"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-navy-soft hover:bg-black/5 dark:text-cream/70 dark:hover:bg-white/10"
        >
          <ChevronLeftIcon />
        </Link>
      </header>
      <SpeakView lines={lines} />
    </>
  );
}
