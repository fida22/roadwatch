import type { Config } from "tailwindcss";
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink:   { DEFAULT: "#16222e", dark: "#e8edf2" },
        paper: { DEFAULT: "#f5f6f3", dark: "#0f1923" },
        surface: { DEFAULT: "#ffffff", dark: "#1a2535" },
        line:  { DEFAULT: "#d9ddd6", dark: "#2a3a4a" },
        brand: { DEFAULT: "#0e5a6b", dark: "#0a4452", soft: "#e3f0f2", "soft-dark": "#0d2e38" },
        st: {
          planned:   "#2563eb",
          ongoing:   "#f97316",
          delayed:   "#dc2626",
          completed: "#16a34a",
          cancelled: "#6b7280",
        },
      },
    },
  },
  plugins: [],
};
export default config;
