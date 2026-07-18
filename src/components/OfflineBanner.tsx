"use client";

import { useEffect, useState } from "react";

// Small reassurance bar when the connection drops — already-loaded content keeps
// working (offline-first), so this just explains why nothing new will load.
export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    // In normal flow (not fixed) so it never overlaps the sticky screen headers;
    // it only renders while offline, so there's no layout cost otherwise.
    <div
      role="status"
      aria-live="polite"
      className="animate-sheet bg-warn-soft px-4 py-1 text-center text-xs font-semibold text-warn dark:bg-warn-dusk dark:text-warn-bright"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.25rem)" }}
    >
      Offline — your saved work is safe and still here.
    </div>
  );
}
