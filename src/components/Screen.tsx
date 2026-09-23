"use client";


/** Consistent heading and content width for student screens. */
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
        className="re-screen-header flex items-start justify-between gap-3"
      >
        <div className="min-w-0">
          <h1 className="display text-2xl text-navy break-words dark:text-cream">{title}</h1>
          {subtitle && <p className="tnum mt-0.5 text-sm text-navy-soft dark:text-navy-mist">{subtitle}</p>}
        </div>

      </header>
      <main className="re-screen-main">{children}</main>
    </>
  );
}
