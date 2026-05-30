import type { Config } from "tailwindcss";

// Teaching-material identity: amber, navy, burgundy, cream.
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        amber: { DEFAULT: "#F59E0B", deep: "#C77F09" },
        navy: { DEFAULT: "#1E3A5F", soft: "#33507A" },
        burgundy: { DEFAULT: "#7C2D3B", soft: "#9A3D4E" },
        cream: "#FDF6EC",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      borderRadius: { card: "1rem" },
      boxShadow: { card: "0 6px 20px -8px rgba(30,58,95,0.28)" },
      keyframes: {
        pop: {
          "0%": { transform: "scale(0.85)", opacity: "0" },
          "60%": { transform: "scale(1.04)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        flash: {
          "0%": { backgroundColor: "rgba(34,197,94,0.0)" },
          "30%": { backgroundColor: "rgba(34,197,94,0.18)" },
          "100%": { backgroundColor: "rgba(34,197,94,0.0)" },
        },
      },
      animation: { pop: "pop 0.3s ease-out", flash: "flash 0.7s ease-out" },
    },
  },
  plugins: [],
};

export default config;
