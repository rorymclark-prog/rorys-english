import type { Reply } from "./account-service";

async function readReply(response: Response): Promise<Reply> {
  if (!response.ok) throw new Error("Progress service unavailable");
  const data = await response.json();
  if (typeof data?.ok !== "boolean" || data.service === "rorys-english") throw new Error("Unexpected progress response");
  return data;
}

export async function postProgress(endpoint: string, body: Record<string, unknown>, fetcher: typeof fetch = fetch): Promise<Reply> {
  const deadline = AbortSignal.timeout(40000);
  const response = await fetcher(endpoint, {
    method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body), cache: "no-store", redirect: "manual", signal: deadline,
  });
  if (response.status !== 302 && response.status !== 303) return readReply(response);
  // Apps Script runs the operation once, then serves its result from Google.
  // Only the response GET is retried; never replay an uncertain write or AI call.
  const location = response.headers.get("location");
  if (!location) throw new Error("Missing progress response");
  const resultUrl = new URL(location);
  if (resultUrl.protocol !== "https:" || resultUrl.hostname !== "script.googleusercontent.com") throw new Error("Unexpected progress destination");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await fetcher(resultUrl, {
        method: "GET", cache: "no-store", redirect: "error",
        signal: AbortSignal.any([deadline, AbortSignal.timeout(15000)]),
      });
      if (attempt === 0 && [404, 429, 500, 502, 503, 504].includes(result.status)) continue;
      return await readReply(result);
    } catch (error) {
      if (attempt || deadline.aborted) throw error;
    }
  }
  throw new Error("Progress service unavailable");
}
