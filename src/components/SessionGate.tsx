"use client";
import { useEffect, useState } from "react";
import { login, logout, savedSession } from "@/lib/api";

export default function SessionGate({ code, children }: { code: string; children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [credential, setCredential] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const refresh = () => { setSignedIn(!!savedSession(code)); setReady(true); };
    refresh(); window.addEventListener("re-auth-change", refresh);
    const timer = setInterval(refresh, 30000);
    return () => { window.removeEventListener("re-auth-change", refresh); clearInterval(timer); };
  }, [code]);
  if (!ready) return <p className="p-6">Opening your lessons…</p>;
  if (signedIn) return <><div className="mx-auto flex max-w-2xl justify-end px-5 pt-2"><button onClick={() => logout(code)} className="min-h-11 text-sm underline">Sign out</button></div>{children}</>;
  return <main className="mx-auto max-w-md px-6 py-16">
    <h1 className="display text-3xl">Your English lessons</h1>
    <p className="my-4">Use the access code Rory gave you. Your lesson link alone does not give access to your work.</p>
    <form onSubmit={async e => { e.preventDefault(); setBusy(true); setMessage(""); const r = await login(code, credential.trim()); setBusy(false); if (!r.ok) setMessage(r.error || "Sign-in failed"); else setCredential(""); }}>
      <label className="block" htmlFor="access">Access code</label>
      <input id="access" type="password" autoComplete="current-password" required value={credential} onChange={e=>setCredential(e.target.value)} className="my-3 w-full rounded-xl border p-3 text-navy" />
      <button disabled={busy} className="min-h-12 w-full rounded-xl bg-indigo-700 p-3 font-bold text-white">{busy?"Signing in…":"Sign in"}</button>
    </form>
    <p role="status" className="mt-4">{message}</p>
    <p className="mt-6 text-sm">Sign-in lasts up to six hours in this browser session. Ask Rory if you need a new access code.</p>
  </main>;
}
