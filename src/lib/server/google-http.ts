import { request } from "node:https";

// Use a fresh IPv4 TLS connection for Google's one-time response URLs.
// This avoids pooled fetch connections surviving a suspended serverless request.
export const googleHttp: typeof fetch = async (input, init = {}) => {
  const url = input instanceof URL ? input : new URL(String(input));
  if (url.protocol !== "https:" || !["script.google.com", "script.googleusercontent.com"].includes(url.hostname)) throw new Error("Unexpected Google service host");
  const headers = new Headers(init.headers);
  headers.set("accept-encoding", "identity");
  if (typeof init.body === "string") headers.set("content-length", String(Buffer.byteLength(init.body)));
  return new Promise<Response>((resolve, reject) => {
    const req = request(url, {
      method: init.method || "GET", headers: Object.fromEntries(headers.entries()),
      signal: init.signal || undefined, agent: false, family: 4,
    }, res => {
      const chunks: Buffer[] = []; let size = 0;
      res.on("data", chunk => {
        size += chunk.length;
        if (size > 10000000) { req.destroy(new Error("Progress response too large")); return; }
        chunks.push(Buffer.from(chunk));
      });
      res.on("error", reject);
      res.on("aborted", () => reject(new Error("Progress response interrupted")));
      res.on("end", () => {
        const responseHeaders = new Headers();
        for (const [key, value] of Object.entries(res.headers)) if (value !== undefined) responseHeaders.set(key, Array.isArray(value) ? value.join(", ") : value);
        const status = res.statusCode || 502;
        resolve(new Response([204,205,304].includes(status) ? null : Buffer.concat(chunks), {status, headers: responseHeaders}));
      });
    });
    req.on("error", reject);
    if (init.body !== undefined && init.body !== null) {
      if (typeof init.body !== "string") { req.destroy(new Error("Unsupported progress request")); return; }
      req.write(init.body);
    }
    req.end();
  });
};
