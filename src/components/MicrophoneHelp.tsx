"use client";
import { useEffect, useState } from "react";
export default function MicrophoneHelp() {
  const [permission, setPermission] = useState<PermissionState | "unknown">("unknown");
  useEffect(() => {
    let active = true, status: PermissionStatus | undefined;
    const update = () => { if (active && status) setPermission(status.state); };
    // Querying never opens the microphone or asks for consent.
    if (navigator.permissions?.query) void navigator.permissions.query({ name: "microphone" as PermissionName })
      .then(value => { if (!active) return; status = value; update(); status.addEventListener("change", update); })
      .catch(() => { /* Not all browsers expose microphone permission status. */ });
    return () => { active = false; status?.removeEventListener("change", update); };
  }, []);
  return <details className="mt-4 text-sm"><summary className="cursor-pointer font-bold">Microphone permission & phone screen</summary>
    <p className="mt-3">{permission === "granted" ? "Microphone permission is currently allowed in this browser." : permission === "denied" ? "Microphone access is blocked. Change this site’s microphone permission before trying again." : "Your browser decides whether to ask for microphone access when you press Start or Record."}</p>
    <p className="mt-3">If it asks every time on iPhone: open this same website in Safari, open the Page Menu → Website Settings → Microphone, and choose Allow for this site. Keep iOS updated. A Home Screen app may have separate permissions, so Safari’s choice may not carry over. There is no need to allow every website.</p>
    <p className="mt-3">Use the same installed app or browser each time. Private browsing, clearing site data, or switching website addresses can require permission again. The app cannot save or override your phone’s permission.</p>
    <p className="mt-3">Screen-awake support prevents automatic locking where available. Manually locking the phone or leaving the app can still interrupt voice. We cannot guarantee locked-screen conversations in this web app. The microphone is released when you end the conversation.</p>
    <a className="mt-3 inline-block underline" href="https://support.apple.com/guide/iphone/iphb01fc3c85/ios" target="_blank" rel="noreferrer">Apple’s Safari permission guide</a>
  </details>;
}
