/**
 * The picture from a unit's slide deck, shown as a banner on that unit's cards.
 *
 * Most units have no deck, so `src` is usually undefined and this renders
 * nothing at all — every card it sits in has to read correctly without it.
 * The picture is decoration for a heading that already says everything, so it
 * is hidden from screen readers rather than given invented alt text.
 */
export default function UnitCover({src,title}:{src?:string;title:string}) {
  if (!src) return null;
  const href = src.startsWith("/") ? (process.env.NEXT_PUBLIC_BASE_PATH||"")+src : src;
  return <div className="unit-cover">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={href} alt="" aria-hidden="true" loading="lazy" decoding="async" width={1000} height={562}
      title={`From the slide deck for ${title}`}/>
  </div>;
}
