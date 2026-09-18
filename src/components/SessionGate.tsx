"use client";
import { useEffect, useState } from "react";
import { isStudentPreview, previewTeacherSession, endStudentPreview } from "@/lib/student-preview";
import { login, loginWithAccount, logout, savedSession, forgetSession } from "@/lib/api";
import { accountsEnabled, googleEnabled, watchAccount, signInAccount, signInGoogle, resetAccountPassword, verifyAccountEmail, reloadAccount, signOutAccount, accountError } from "@/lib/account-auth";

export default function SessionGate({ code, children }: { code: string; children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [credential, setCredential] = useState("");
  const [email, setEmail] = useState("");
  const [remember, setRemember] = useState(true);
  const [legacy, setLegacy] = useState(!accountsEnabled || code.includes("-fam-"));
  const [hasAccount, setHasAccount] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true, accountPresent = false, refreshing = false;
    const preview=isStudentPreview(code);
    const refresh = () => { if (active) { setSignedIn(preview?!!previewTeacherSession():!!savedSession(code)); setReady(true); } };
    const renew = async () => {
      if (refreshing || !active) return;
      refreshing = true;
      try {
        const r = await loginWithAccount(code);
        if (active) { setMessage(r.ok ? "" : r.error || "Could not open your lessons."); setNeedsVerification(!!r.verificationRequired); }
      } catch { if (active) setMessage("Please reconnect to open your lessons."); }
      finally { refreshing = false; refresh(); }
    };
    refresh();
    const unwatch = !preview && accountsEnabled && !code.includes("-fam-") ? watchAccount(user => {
      accountPresent = !!user;
      if (!active) return;
      setHasAccount(!!user);
      if (user) { setEmail(user.email || ""); void renew(); }
      else { if (savedSession(code)?.authProvider === "firebase") forgetSession(code); refresh(); }
    }) : () => {};
    window.addEventListener("re-auth-change", refresh);
    const timer = setInterval(() => { if (accountPresent && !savedSession(code)) void renew(); else refresh(); }, 30000);
    return () => { active = false; unwatch(); window.removeEventListener("re-auth-change", refresh); clearInterval(timer); };
  }, [code]);
  async function finishAccount() {
    const r = await loginWithAccount(code);
    setNeedsVerification(!!r.verificationRequired);
    setMessage(r.ok ? "" : r.error || "Could not open your lessons.");
    if (r.ok) setCredential("");
  }
  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage("");
    try { await action(); } catch (error) { setMessage(accountError(error)); }
    finally { setBusy(false); }
  }
  if (!ready) return <p className="p-6">Opening your lessons…</p>;
  if (signedIn) return <>{children}</>;
  if (isStudentPreview(code)) return <main className="mx-auto max-w-md p-8"><h1 className="text-2xl font-bold">Teacher sign-in needed</h1><p className="my-4">Your preview session has ended. Sign in to your teacher workspace to continue.</p><button className="min-h-11 rounded-xl bg-indigo-700 p-3 text-white" onClick={()=>{endStudentPreview();window.location.assign(`${process.env.NEXT_PUBLIC_BASE_PATH||""}/teacher/`);}}>Back to teacher sign-in</button></main>;
  return <main className="mx-auto max-w-md px-6 py-12">
    <p className="mb-3 text-sm font-bold uppercase tracking-wide text-indigo-700">Rory’s English</p>
    <h1 className="display text-3xl">Your English lessons</h1>
    <p className="my-4">{legacy ? "Use the private access code Rory gave you." : "Sign in with the email address you use with Rory."}</p>
    <form onSubmit={e => { e.preventDefault(); void run(async () => {
      if (legacy) { await signOutAccount(); const r = await login(code, credential.trim()); if (!r.ok) setMessage(r.error || "Sign-in failed"); else setCredential(""); }
      else { await signInAccount(email, credential, remember); await finishAccount(); }
    }); }}>
      {!legacy && <><label className="block" htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={email} onChange={e=>setEmail(e.target.value)} className="my-3 w-full rounded-xl border p-3 text-navy" /></>}
      <label className="block" htmlFor="access">{legacy ? "Access code" : "Password"}</label>
      <input id="access" name="password" type="password" autoComplete="current-password" required value={credential} onChange={e=>setCredential(e.target.value)} className="my-3 w-full rounded-xl border p-3 text-navy" />
      {!legacy && <label className="mb-4 flex min-h-11 items-center gap-3"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} className="h-5 w-5" />Keep me signed in on this device</label>}
      <button disabled={busy} className="min-h-12 w-full rounded-xl bg-indigo-700 p-3 font-bold text-white disabled:opacity-50">{busy ? "Opening…" : "Sign in"}</button>
    </form>
    {!legacy && <>
      <p className="mt-3 text-sm">Use “Keep me signed in” on your own device. Leave it unticked on a shared computer.</p>
      {googleEnabled && <button disabled={busy} type="button" className="mt-5 min-h-12 w-full rounded-xl border p-3 font-bold" onClick={()=>void run(async()=>{await signInGoogle(remember);await finishAccount();})}>Continue with Google</button>}
      <button disabled={busy} type="button" className="mt-4 min-h-11 underline" onClick={()=>void run(async()=>{
        if (!email.trim() || !email.includes("@")) { setMessage("Enter your email address above first."); return; }
        await resetAccountPassword(email);
        setMessage("If this email has an account, a password-setting link is on its way. Check your inbox and spam folder.");
      })}>Set or reset password</button>
      <p className="text-sm">First visit? Enter your email and choose “Set or reset password” to choose your own password.</p>
      {needsVerification && <div className="mt-4 space-y-2 rounded-xl border p-3"><p>Verify your email before opening your work.</p><button disabled={busy} type="button" className="min-h-11 underline" onClick={()=>void run(async()=>{await verifyAccountEmail();setMessage("Check your inbox for the verification link.");})}>Send verification email</button><button disabled={busy} type="button" className="ml-3 min-h-11 underline" onClick={()=>void run(async()=>{await reloadAccount();await finishAccount();})}>I’ve verified my email</button></div>}
      {hasAccount && <button type="button" className="mt-3 block min-h-11 underline" onClick={()=>void logout(code)}>Use another account</button>}
    </>}
    <p role="status" aria-live="polite" className="mt-4">{message}</p>
    {accountsEnabled && !code.includes("-fam-") && <button type="button" className="mt-6 min-h-11 text-sm underline" onClick={()=>{setLegacy(!legacy);setMessage("");setCredential("");}}>{legacy ? "Use email and password" : "Use my existing access code"}</button>}
    {legacy && <p className="mt-4 text-sm">Your code stays valid until Rory replaces it. This sign-in lasts up to six hours.</p>}
  </main>;
}
