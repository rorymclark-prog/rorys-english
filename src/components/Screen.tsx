"use client";


/** Standard screen header (title + settings gear) used by the main tabs. */
export default function Screen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <header
        className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-cream px-5 pb-3 dark:bg-navy"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
      >
        <div className="min-w-0">
          <h1 className="display text-2xl text-navy break-words dark:text-cream">{title}</h1>
          {subtitle && <p className="tnum mt-0.5 text-sm text-navy-soft dark:text-navy-mist">{subtitle}</p>}
        </div>

      </header>
      <main className="px-5 pb-10">{children}</main>
    </>
  );
}
