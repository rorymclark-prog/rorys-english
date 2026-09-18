import type { Reply } from "./account-service";

export class ProgressTransportError extends Error {
  constructor(public stage: string, public status: number = 0) { super("Progress service unavailable"); this.name = "ProgressTransportError"; }
}

async function readReply(response: Response): Promise<Reply> {
  if (!response.ok) throw new ProgressTransportError("response-http", response.status);
  let data;
  try { data = await response.json(); } catch { throw new ProgressTransportError("response-format", response.status); }
  if (typeof data?.ok !== "boolean" || data.service === "rorys-english") throw new ProgressTransportError("response-shape", response.status);
  return data;
}

export async function postProgress(endpoint: string, body: Record<string, unknown>, fetcher: typeof fetch = fetch): Promise<Reply> {
  const deadline = AbortSignal.timeout(40000);
  let response: Response;
  try { response = await fetcher(endpoint, {
    method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body), cache: "no-store", redirect: "manual", signal: deadline,
  }); } catch { throw new ProgressTransportError("post-network"); }
  if (response.status !== 302 && response.status !== 303) return readReply(response);
  // Apps Script runs the operation once, then serves its result from Google.
  // Only the response GET is retried; never replay an uncertain write or AI call.
  const location = response.headers.get("location");
  if (!location) throw new Error("Missing progress response");
  function resultLocation(location: string): URL {
    const url = new URL(location);
    if (url.protocol !== "https:" || !["script.googleusercontent.com", "script.google.com"].includes(url.hostname)) {
      throw new ProgressTransportError(url.hostname === "accounts.google.com" ? "google-sign-in-redirect" : "unexpected-redirect");
    }
    return url;
  }
  let resultUrl = resultLocation(location), redirects = 0, retries = 0;
  while (true) {
    let result: Response;
    try {
      result = await fetcher(resultUrl, {
        method: "GET", cache: "no-store", redirect: "manual", signal: deadline,
      });
    } catch {
      if (retries++ || deadline.aborted) throw new ProgressTransportError("result-network");
      continue;
    }
    if ([301, 302, 303, 307, 308].includes(result.status)) {
      const next = result.headers.get("location");
      if (!next || redirects++ >= 3) throw new ProgressTransportError("result-redirect-limit", result.status);
      resultUrl = resultLocation(new URL(next, resultUrl).href);
      continue;
    }
    if ([404, 429, 500, 502, 503, 504].includes(result.status) && retries++ === 0) continue;
    return readReply(result);
  }
}
