import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#121417",
        primary: {
          DEFAULT: "#0B6E4F",
          accent: "#12A66A",
        },
        gold: {
          DEFAULT: "#D4AF37",
          highlight: "#F0B94A",
        },
        cream: "#F2EFE9",
        volatile: "#4A2E6B",
        danger: "#C13A3A",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      borderRadius: {
        card: "0.75rem",
      },
    },
  },
  plugins: [],
};

export default config;
