"use client";

/** The last resort: the root layout itself failed, so this file supplies its
 *  own <html>. No tokens, no fonts and no stylesheet are guaranteed here, which
 *  is why the few colours below are written out literally. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", padding: "2rem",
        background: "#151C2B", color: "#F7F6F2", textAlign: "center",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <div style={{ maxWidth: "24rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0 0 .75rem" }}>The app couldn&apos;t start</h1>
          <p style={{ margin: "0 0 1.5rem", lineHeight: 1.7, color: "#B4BFD3" }}>
            Close the app and open your link again. Your work is still saved on this device.
          </p>
          <button type="button" onClick={reset} style={{ minHeight: "3rem", padding: "0 1.5rem", border: 0,
            borderRadius: "13px", background: "#B4C7FF", color: "#1A2A4B", fontSize: ".95rem", fontWeight: 850 }}>
            Try again
          </button>
          {error.digest && <p style={{ marginTop: "1.5rem", fontSize: ".8rem", color: "#B4BFD3" }}>Code for Rory: {error.digest}</p>}
        </div>
      </body>
    </html>
  );
}
