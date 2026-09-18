"use client";
import { getApps, initializeApp } from "firebase/app";
import { getAuth, browserLocalPersistence, browserSessionPersistence, setPersistence, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut, sendPasswordResetEmail, sendEmailVerification, onIdTokenChanged, type User } from "firebase/auth";

export const accountsEnabled = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
export const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_SIGN_IN === "true";
function auth() {
  const app = getApps().find(a => a.name === "english-accounts") || initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }, "english-accounts");
  return getAuth(app);
}
export async function currentAccount(): Promise<User | null> {
  if (!accountsEnabled) return null;
  const a = auth();
  await a.authStateReady();
  return a.currentUser;
}
export function watchAccount(callback: (user: User | null) => void) {
  return onIdTokenChanged(auth(), callback);
}
export async function signInAccount(email: string, password: string, remember: boolean) {
  const a = auth();
  await setPersistence(a, remember ? browserLocalPersistence : browserSessionPersistence);
  return signInWithEmailAndPassword(a, email.trim(), password);
}
export async function signInGoogle(remember: boolean) {
  const a = auth();
  await setPersistence(a, remember ? browserLocalPersistence : browserSessionPersistence);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return signInWithPopup(a, provider);
}
export async function signOutAccount() { if (accountsEnabled) await signOut(auth()); }
export async function resetAccountPassword(email: string) { await sendPasswordResetEmail(auth(), email.trim()); }
export async function verifyAccountEmail() {
  const user = await currentAccount();
  if (user && !user.emailVerified) await sendEmailVerification(user);
}
export async function reloadAccount() {
  const user = await currentAccount();
  if (user) { await user.reload(); await user.getIdToken(true); }
}
export function accountError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "Google sign-in was closed. You can try again or use email and password.";
  if (code === "auth/popup-blocked") return "Allow the Google sign-in window, or use email and password.";
  if (code === "auth/too-many-requests") return "Too many attempts. Please wait a little and try again.";
  if (code === "auth/network-request-failed") return "Check your internet connection and try again.";
  if (code === "auth/unauthorized-domain" || code === "auth/operation-not-allowed") return "This sign-in option is not ready yet. Please tell Rory.";
  return "Could not sign in. Check your email and password, or use Set or reset password.";
}

