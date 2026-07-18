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

  // VOLTSTONE bright-tier tokens only (safe on the #17161C dark base AND on cream):
  // amber #A2A4FC, burgundy-bright #F59D6E (ember reward), good-bright #4ADE80,
  // warn-bright #FBBF24. NOTE: #4F46E5 deliberately excluded — spec hard rule 1
  // bans it on the dark base (2.86:1) and this helper is mode-unaware.
  // Spec §6 prefers no confetti at all; removing the call site is owned by
  // HomeworkWeekView (delete this function once that call is gone).
  const colors = ["#A2A4FC", "#F59D6E", "#4ADE80", "#FBBF24"];
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
