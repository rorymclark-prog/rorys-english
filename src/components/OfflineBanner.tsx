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
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-40 bg-burgundy px-4 py-1 text-center text-xs font-semibold text-cream"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.25rem)" }}
    >
      Offline — your saved work is safe and still here.
    </div>
  );
}
