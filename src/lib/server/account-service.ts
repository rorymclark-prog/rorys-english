export type Reply = { ok: boolean; error?: string; authRequired?: boolean; [key: string]: unknown };
export type Account = { email: string; uid: string };
export type Identity = { uid: string; email?: string; email_verified?: boolean; exp: number };
export type Dependencies = {
  verify: (token: string) => Promise<Identity>;
  roster: Record<string, Account>;
  upstream: (body: Record<string, unknown>) => Promise<Reply>;
  backendSession: (code: string, idToken: string, refresh?: boolean) => Promise<string>;
};
const studentActions = new Set(["progress", "resources", "assignments", "note", "submissions", "ai", "submit", "event"]);
export async function accountService(body: Record<string, unknown>, deps: Dependencies): Promise<Reply> {
  if (body.preview && !new Set(["progress","resources","assignments","note","submissions"]).has(String(body.action))) return {ok:false,error:"Student preview is read-only."};
  // Legacy teacher/student codes stay compatible during the move.
  if (body.action !== "accountLogin" && body.authProvider !== "firebase") return deps.upstream(body);
  const token = body.action === "accountLogin" ? body.idToken : body.session;
  if (typeof token !== "string" || !token) return { ok: false, authRequired: true, error: "Please sign in again." };
  let identity: Identity;
  try { identity = await deps.verify(token); }
  catch { return { ok: false, authRequired: true, error: "Please sign in again." }; }
  if (!identity.email_verified) return { ok: false, error: "Please verify your email address, then try again.", verificationRequired: true };
  const code = typeof body.code === "string" ? body.code : "";
  const account = deps.roster[code];
  if (!account || account.uid !== identity.uid || account.email.toLowerCase() !== identity.email?.toLowerCase()) {
    return { ok: false, error: "This account is not connected to these lessons. Open your own lesson link or ask Rory." };
  }
  if (body.action === "accountLogin") return { ok: true, token, expires: identity.exp * 1000, role: "student", authProvider: "firebase", accountUid: identity.uid };
  if (body.action === "logout") return { ok: true };
  if (!studentActions.has(String(body.action))) return { ok: false, error: "Access denied" };
  const outgoing: Record<string, unknown> = { ...body, code, session: await deps.backendSession(code, token) };
  delete outgoing.authProvider;
  delete outgoing.idToken;
  let response = await deps.upstream(outgoing);
  // An explicit authentication rejection means the operation never ran.
  if (response.authRequired) {
    outgoing.session = await deps.backendSession(code, token, true);
    response = await deps.upstream(outgoing);
  }
  return response;
}
