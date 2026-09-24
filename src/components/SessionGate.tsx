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
  if (!ready) return <main className="signin-skeleton" aria-busy="true" aria-label="Opening your lessons">
    <span /><span /><span /><span /><span />
  </main>;
  if (signedIn) return <>{children}</>;
  if (isStudentPreview(code)) return <main className="signin mx-auto max-w-md p-8"><h1 className="display text-2xl">Teacher sign-in needed</h1><p className="signin-lede">Your preview session has ended. Sign in to your teacher workspace to continue.</p><button className="signin-submit" onClick={()=>{endStudentPreview();window.location.assign(`${process.env.NEXT_PUBLIC_BASE_PATH||""}/teacher/`);}}>Back to teacher sign-in</button></main>;
  return <main className="signin mx-auto max-w-md px-6 py-12">
    <div aria-hidden className="signin-glow" />
    <p className="work-eyebrow">RORY’S ENGLISH</p>
    <h1 className="display text-3xl">Your English lessons</h1>
    <p className="signin-lede">{legacy ? "Use the private access code Rory gave you." : "Sign in with the email address you use with Rory."}</p>
    <form onSubmit={e => { e.preventDefault(); void run(async () => {
      if (legacy) { await signOutAccount(); const r = await login(code, credential.trim()); if (!r.ok) setMessage(r.error || "Sign-in failed"); else setCredential(""); }
      else { await signInAccount(email, credential, remember); await finishAccount(); }
    }); }}>
      {!legacy && <><label className="signin-field" htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={email} onChange={e=>setEmail(e.target.value)} className="signin-input" /></>}
      <label className="signin-field" htmlFor="access">{legacy ? "Access code" : "Password"}</label>
      <input id="access" name="password" type="password" autoComplete="current-password" required value={credential} onChange={e=>setCredential(e.target.value)} className="signin-input" />
      {!legacy && <label className="signin-remember"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} />Keep me signed in on this device</label>}
      <button disabled={busy} className="signin-submit">{busy ? "Opening…" : "Sign in"}</button>
    </form>
    {!legacy && <>
      <p className="signin-note">Use “Keep me signed in” on your own device. Leave it unticked on a shared computer.</p>
      {googleEnabled && <button disabled={busy} type="button" className="signin-alt" onClick={()=>void run(async()=>{await signInGoogle(remember);await finishAccount();})}>Continue with Google</button>}
      <button disabled={busy} type="button" className="signin-link mt-5 block" onClick={()=>void run(async()=>{
        if (!email.trim() || !email.includes("@")) { setMessage("Enter your email address above first."); return; }
        await resetAccountPassword(email);
        setMessage("If this email has an account, a password-setting link is on its way. Check your inbox and spam folder.");
      })}>Set or reset password</button>
      <p className="signin-note">First visit? Enter your email and choose “Set or reset password” to choose your own password.</p>
      {needsVerification && <div className="signin-verify"><p>Verify your email before opening your work.</p><button disabled={busy} type="button" className="signin-link" onClick={()=>void run(async()=>{await verifyAccountEmail();setMessage("Check your inbox for the verification link.");})}>Send verification email</button><button disabled={busy} type="button" className="signin-link ml-4" onClick={()=>void run(async()=>{await reloadAccount();await finishAccount();})}>I’ve verified my email</button></div>}
      {hasAccount && <button type="button" className="signin-link mt-4 block" onClick={()=>void logout(code)}>Use another account</button>}
    </>}
    <p role="status" aria-live="polite" className="signin-message">{message}</p>
    {accountsEnabled && !code.includes("-fam-") && <button type="button" className="signin-switch" onClick={()=>{setLegacy(!legacy);setMessage("");setCredential("");}}>{legacy ? "Use email and password" : "Use my existing access code"}</button>}
    {legacy && <p className="signin-note mt-4">Your code stays valid until Rory replaces it. This sign-in lasts up to six hours.</p>}
  </main>;
}
