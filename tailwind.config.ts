import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#16222e",
        paper: "#f5f6f3",
        line: "#d9ddd6",
        brand: { DEFAULT: "#0e5a6b", dark: "#0a4452", soft: "#e3f0f2" },
        // agreed map colours (section 2)
        st: { planned: "#2563eb", ongoing: "#f97316", delayed: "#dc2626", completed: "#16a34a", cancelled: "#6b7280" },
      },
      fontFamily: { sans: ["var(--font-plex)", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
