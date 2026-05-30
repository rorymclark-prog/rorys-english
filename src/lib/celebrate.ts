"use client";

// Tiny, dependency-free celebration helpers. Kept cheap so they don't lag old
// phones, and they fully no-op when the user prefers reduced motion.

export function haptic(pattern: number | number[] = 12): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* not supported / blocked — fine */
  }
}

export function confettiBurst(): void {
  if (typeof document === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const colors = ["#F59E0B", "#1E3A5F", "#7C2D3B", "#22C55E", "#FBBF24"];
  const root = document.createElement("div");
  root.setAttribute("aria-hidden", "true");
  Object.assign(root.style, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    zIndex: "60",
    overflow: "hidden",
  } as CSSStyleDeclaration);
  document.body.appendChild(root);

  const count = 42;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    const size = 6 + Math.random() * 8;
    Object.assign(p.style, {
      position: "absolute",
      top: "-16px",
      left: `${Math.random() * 100}%`,
      width: `${size}px`,
      height: `${size * 0.6}px`,
      background: colors[i % colors.length],
      borderRadius: "1px",
    } as CSSStyleDeclaration);
    root.appendChild(p);

    const dx = (Math.random() * 2 - 1) * 140;
    const dy = window.innerHeight + 60;
    const rot = (Math.random() * 2 - 1) * 720;
    const dur = 900 + Math.random() * 900;
    p.animate(
      [
        { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity: 0.9 },
      ],
      { duration: dur, easing: "cubic-bezier(.2,.6,.4,1)", fill: "forwards" },
    );
  }
  window.setTimeout(() => root.remove(), 2000);
}
