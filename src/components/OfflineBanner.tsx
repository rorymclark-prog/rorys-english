"use client";

import { useEffect, useState } from "react";
import StatusRow from "@/components/StatusRow";

// Quiet row while the connection is down. Already-loaded content keeps working
// (offline-first), so this only explains why nothing new will load.
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
  return <div className="mx-auto max-w-2xl px-4 pt-2" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}><StatusRow kind="error">Offline. Your saved work is safe and still here.</StatusRow></div>;
}
