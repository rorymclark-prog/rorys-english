import type { Config } from "tailwindcss";

// Paper & blue. Keep legacy token names compatible with existing screens.
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ink: primary text in light mode AND the dark-mode charcoal base.
        navy: {
          DEFAULT: "#202A40", // violet-cast charcoal (never #000)
          soft: "#616C80", //   muted/secondary text on light
          raised: "#1F293B", // dark-mode raised surface (+1 elevation, tone not borders)
          mist: "#B4BFD3", //   dark-mode muted body text (captions may use #A9A6B4)
        },
        // warm stone near-white: page bg in light mode, text in dark mode.
        cream: "#F7F6F2",
        // the ONE chromatic accent — electric indigo, used functionally only.
        amber: {
          DEFAULT: "#B4C7FF", // tone-80 indigo: dark-mode accent + bright fills (ink text on it)
          deep: "#3656aa", //    light-mode accent text / primary buttons / light focus ring
          press: "#2c468d", //   hover/pressed step
          soft: "#E8EDF9", //    lavender wash — light active pills/tints
          dusk: "#2E426F", //    indigo-tinted wash — dark active pills/tints
        },
        // ember: the warm REWARD channel (streaks, progress) — quiet, tints-first.
        burgundy: {
          DEFAULT: "#C2410C", // ember text on light (4.89:1)
          deep: "#9A3412", //    text on the soft wash (6.16:1)
          soft: "#FDE8D8", //    warm streak-pill wash
          bright: "#F59D6E", //  dark-mode ember numerals (8.50:1 on base)
        },
        // status — separate from the accent, soft-tint pattern (judge-fixed hexes).
        good: { DEFAULT: "#166534", soft: "#F0FDF4", bright: "#4ADE80", dusk: "#16281C" },
        warn: { DEFAULT: "#92400E", soft: "#FFFBEB", bright: "#FBBF24", dusk: "#2E2413" },
        bad: { DEFAULT: "#BE123C", soft: "#FFF1F2", bright: "#FDA4AF", dusk: "#2E1A1E" },
        // card surface (light) — never pure #fff per spec.
        surface: "#FFFEFA",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      // Radius vocabulary: 8 (rounded-lg) / 12 (rounded-xl) / 20 (rounded-card) / pill.
      borderRadius: { card: "20px" },
      boxShadow: {
        // Spec card recipe: lit-from-above inset highlight + long soft throw.
        card: "inset 0 1px 0 rgba(255,255,255,.7), 0 1px 2px rgba(23,22,28,.04), 0 12px 32px -16px rgba(23,22,28,.12)",
        "card-dark": "0 1px 2px rgba(0,0,0,.2), 0 12px 32px -16px rgba(0,0,0,.5)",
        // AI presence: indigo glow ring.
        glow: "0 0 0 6px rgba(79,70,229,.12), 0 8px 24px rgba(79,70,229,.35)",
        "glow-dark": "0 0 0 6px rgba(162,164,252,.14), 0 8px 24px rgba(162,164,252,.25)",
      },
      // Spec motion default (ease-out2026 @ 200ms) as the framework DEFAULT so
      // bare `transition` utilities comply everywhere without per-site opt-in.
      transitionTimingFunction: {
        DEFAULT: "cubic-bezier(0.16, 1, 0.3, 1)",
        out2026: "cubic-bezier(0.16, 1, 0.3, 1)",
        spring: "cubic-bezier(0.175, 0.885, 0.32, 1.1)",
      },
      transitionDuration: { DEFAULT: "200ms" },
      keyframes: {
        pop: {
          "0%": { transform: "scale(0.85)", opacity: "0" },
          "60%": { transform: "scale(1.04)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        // Completion wash uses good-bright (#4ADE80) — VOLTSTONE status family.
        flash: {
          "0%": { backgroundColor: "rgba(74,222,128,0.0)" },
          "30%": { backgroundColor: "rgba(74,222,128,0.18)" },
          "100%": { backgroundColor: "rgba(74,222,128,0.0)" },
        },
        sheetUp: {
          from: { transform: "translateY(24px)", opacity: "0.6" },
          to: { transform: "none", opacity: "1" },
        },
      },
      animation: {
        pop: "pop 0.3s cubic-bezier(0.175,0.885,0.32,1.1)",
        flash: "flash 0.7s ease-out",
        sheet: "sheetUp 260ms cubic-bezier(0.175,0.885,0.32,1.1)",
      },
    },
  },
  plugins: [],
};

export default config;
